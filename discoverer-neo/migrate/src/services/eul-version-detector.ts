/**
 * EUL version detection.
 *
 * Detection algorithm (EUL_VERSION_REFERENCE.md §5):
 *   1. Query ALL_TABLES for tables matching 'EUL%'
 *   2. EUL5_BA exists → EUL5; else EUL4_BA → EUL4; else EUL_BA → EUL3
 *   3. Else → no EUL detected (throws EulDetectionError)
 *   4. Read EUL*_EUL for EU_VERSION (+ EU_DISC_VERSION on EUL5)
 *   5. Scan version-specific tables to confirm, collect warnings
 *
 * Mixed schemas (EUL4_ and EUL5_ side by side — Oracle's official upgrade is
 * non-destructive, so this is a real state) resolve to EUL5 with a warning;
 * `preferVersion: 'EUL4'` overrides that when the EUL5 copy is the one still
 * being validated.
 */

import type { EulSource, OracleExecutor } from './oracle-client.js';
import { dbString, isTableNotFoundError, resolveExecutor } from './oracle-client.js';
import type {
  EulTablePrefix,
  EulVersion,
  EulVersionInfo,
} from '../types/eul-versions.js';
import {
  CORE_TABLES,
  EUL5_ONLY_TABLES,
  EUL_PREFIX,
  EUL_VERSIONS_BY_PRECEDENCE,
} from '../types/eul-versions.js';

export class EulDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EulDetectionError';
  }
}

export interface DetectEulVersionOptions {
  /**
   * Schema that owns the EUL tables. When omitted, the detector prefers the
   * connected user's own schema, then falls back to any accessible schema
   * containing an EUL *_BA table.
   */
  schemaOwner?: string;
  /**
   * Force a version on a mixed EUL4/EUL5 schema (upgrade in progress).
   * Ignored — with a warning — if the preferred version's tables are absent.
   */
  preferVersion?: EulVersion;
}

// ---------------------------------------------------------------------------
// Identifier safety
// ---------------------------------------------------------------------------

const IDENTIFIER_RE = /^[A-Z0-9_$#]+$/;

/**
 * Owner/table names are interpolated into SQL (Oracle cannot bind
 * identifiers). Everything interpolated here comes from ALL_TABLES or our own
 * constants, but validate anyway so a hostile catalog row cannot smuggle SQL.
 */
export function assertSafeIdentifier(name: string): string {
  const upper = name.toUpperCase();
  if (!IDENTIFIER_RE.test(upper)) {
    throw new EulDetectionError(`Unsafe Oracle identifier: "${name}"`);
  }
  return upper;
}

// ---------------------------------------------------------------------------
// Discoverer release mapping
// ---------------------------------------------------------------------------

/** Map an EU_VERSION string to a human-readable Discoverer release. */
export function describeDiscovererRelease(
  version: EulVersion,
  schemaVersion: string,
): string {
  if (version === 'EUL3') return '3.x';
  if (version === 'EUL4') return '4.1.x';
  if (schemaVersion.startsWith('5.1')) return '10.1.2/11.1.1';
  if (schemaVersion.startsWith('5.0.2')) return '9.0.2.53/9.0.4';
  if (schemaVersion.startsWith('5.0')) return '9.0.2';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

interface CatalogRow {
  owner: string;
  tableName: string;
}

async function listEulTables(execute: OracleExecutor): Promise<CatalogRow[]> {
  const rows = await execute(
    `SELECT owner, table_name FROM all_tables WHERE table_name LIKE 'EUL%' ORDER BY owner, table_name`,
  );
  return rows.map((row) => ({
    owner: dbString(row.OWNER ?? '').toUpperCase(),
    tableName: dbString(row.TABLE_NAME ?? '').toUpperCase(),
  }));
}

async function currentUser(execute: OracleExecutor): Promise<string | null> {
  try {
    const rows = await execute(`SELECT USER AS CURRENT_USER FROM DUAL`);
    const value = rows[0]?.CURRENT_USER;
    return value ? dbString(value).toUpperCase() : null;
  } catch {
    return null;
  }
}

function versionsPresent(tableNames: Set<string>): EulVersion[] {
  // Precedence-ordered. Note EUL5_BA also matches the 'EUL%' pattern of
  // EUL_BA — membership checks are exact, so there is no ambiguity.
  return EUL_VERSIONS_BY_PRECEDENCE.filter((v) =>
    tableNames.has(`${EUL_PREFIX[v]}BA`),
  );
}

/**
 * Pick the schema owner whose tables we will read. Preference order:
 * explicit option → connected user → the only owner with EUL tables →
 * first owner alphabetically (with a warning).
 */
function chooseOwner(
  catalog: CatalogRow[],
  user: string | null,
  schemaOwner: string | undefined,
  warnings: string[],
): string | null {
  const owners = new Map<string, Set<string>>();
  for (const row of catalog) {
    let set = owners.get(row.owner);
    if (!set) {
      set = new Set<string>();
      owners.set(row.owner, set);
    }
    set.add(row.tableName);
  }

  const ownersWithBa = [...owners.entries()]
    .filter(([, tables]) => versionsPresent(tables).length > 0)
    .map(([owner]) => owner);

  if (schemaOwner) {
    const wanted = schemaOwner.toUpperCase();
    if (ownersWithBa.includes(wanted)) return wanted;
    throw new EulDetectionError(
      `Schema "${wanted}" contains no EUL business-area table ` +
        `(owners with EUL tables: ${ownersWithBa.join(', ') || 'none'})`,
    );
  }

  if (ownersWithBa.length === 0) return null;
  if (user && ownersWithBa.includes(user)) return user;
  if (ownersWithBa.length === 1) return ownersWithBa[0] ?? null;

  const chosen = [...ownersWithBa].sort()[0] ?? null;
  warnings.push(
    `Multiple schemas contain EUL tables (${ownersWithBa.sort().join(', ')}); ` +
      `using "${chosen ?? ''}". Pass schemaOwner to choose explicitly.`,
  );
  return chosen;
}

interface EulIdentity {
  schemaVersion: string;
  discVersion: string | null;
}

async function readEulIdentity(
  execute: OracleExecutor,
  owner: string,
  prefix: EulTablePrefix,
  version: EulVersion,
  warnings: string[],
): Promise<EulIdentity> {
  const table = `${assertSafeIdentifier(owner)}.${prefix}EUL`;
  const columns =
    version === 'EUL5'
      ? 'EU_ID, EU_NAME, EU_VERSION, EU_DISC_VERSION'
      : 'EU_ID, EU_NAME, EU_VERSION';
  try {
    const rows = await execute(`SELECT ${columns} FROM ${table}`);
    if (rows.length === 0) {
      warnings.push(`${prefix}EUL is empty — EUL schema version is unknown`);
      return { schemaVersion: 'unknown', discVersion: null };
    }
    if (rows.length > 1) {
      warnings.push(
        `${prefix}EUL has ${rows.length} rows (expected 1); using the first`,
      );
    }
    const row = rows[0] ?? {};
    const schemaVersion = row.EU_VERSION ? dbString(row.EU_VERSION) : 'unknown';
    const discVersion = row.EU_DISC_VERSION ? dbString(row.EU_DISC_VERSION) : null;
    return { schemaVersion, discVersion };
  } catch (err) {
    if (isTableNotFoundError(err)) {
      warnings.push(
        `${prefix}EUL table not found or not readable — EUL schema version is unknown`,
      );
      return { schemaVersion: 'unknown', discVersion: null };
    }
    throw err;
  }
}

/**
 * Core detection against an executor. `detectEulVersion` wraps this with a
 * live connection; tests call it with a mock executor.
 */
export async function detectEulVersionFromExecutor(
  execute: OracleExecutor,
  options: DetectEulVersionOptions = {},
): Promise<EulVersionInfo> {
  const warnings: string[] = [];

  const catalog = await listEulTables(execute);
  const user = await currentUser(execute);
  const owner = chooseOwner(catalog, user, options.schemaOwner, warnings);

  if (owner === null) {
    throw new EulDetectionError(
      'No EUL schema detected: no accessible EUL_BA/EUL4_BA/EUL5_BA table found. ' +
        'Check that the connection user can see the EUL owner schema.',
    );
  }

  const tableNames = new Set(
    catalog.filter((row) => row.owner === owner).map((row) => row.tableName),
  );

  const present = versionsPresent(tableNames);
  let version = present[0] as EulVersion; // owner was chosen because it has ≥1

  if (present.length > 1) {
    warnings.push(
      `Mixed EUL schema in "${owner}" (${present.join(' + ')}) — likely an ` +
        `upgrade in progress. Defaulting to ${version}.`,
    );
    if (options.preferVersion && options.preferVersion !== version) {
      if (present.includes(options.preferVersion)) {
        version = options.preferVersion;
        warnings.push(`preferVersion override applied: using ${version}.`);
      } else {
        warnings.push(
          `preferVersion=${options.preferVersion} ignored — its tables are not present.`,
        );
      }
    }
  } else if (options.preferVersion && options.preferVersion !== version) {
    warnings.push(
      `preferVersion=${options.preferVersion} ignored — only ${version} tables are present.`,
    );
  }

  const prefix = EUL_PREFIX[version];

  // Only this version's tables are relevant downstream. EUL5_% also matches
  // the EUL_ prefix, so for EUL3 exclude the numbered variants explicitly.
  const versionTables = [...tableNames]
    .filter((name) => {
      if (!name.startsWith(prefix)) return false;
      if (version === 'EUL3' && /^EUL[45]_/.test(name)) return false;
      return true;
    })
    .sort();

  const identity = await readEulIdentity(execute, owner, prefix, version, warnings);

  // Cross-check the identity row against the prefix-based detection.
  const expectedMajor = version === 'EUL5' ? '5' : version === 'EUL4' ? '4' : '3';
  if (
    identity.schemaVersion !== 'unknown' &&
    !identity.schemaVersion.startsWith(expectedMajor)
  ) {
    warnings.push(
      `${prefix}EUL reports EU_VERSION "${identity.schemaVersion}", which does ` +
        `not match the ${version} table prefix — treating table prefix as authoritative.`,
    );
  }

  // Confirm version-specific tables.
  if (version === 'EUL5') {
    const eul5Markers = EUL5_ONLY_TABLES.map((base) => `${prefix}${base}`);
    if (!eul5Markers.some((t) => tableNames.has(t))) {
      warnings.push(
        `None of the EUL5-only tables (${eul5Markers.join(', ')}) were found — ` +
          `the schema may be incomplete or from a very early 9.0.2 EUL.`,
      );
    }
  }

  // Missing core tables are worth knowing about before a migration starts.
  const missingCore = CORE_TABLES.map((base) => `${prefix}${base}`).filter(
    (t) => !tableNames.has(t),
  );
  if (missingCore.length > 0) {
    warnings.push(`Missing expected core tables: ${missingCore.join(', ')}`);
  }

  const supported = version !== 'EUL3';
  if (!supported) {
    warnings.push(
      'EUL 3.x detected: automated migration is not supported for this version. ' +
        'Upgrade the EUL to 4.x/5.x with Oracle tooling first, or migrate manually.',
    );
  }

  const discovererVersion =
    version === 'EUL5' && identity.discVersion
      ? identity.discVersion
      : describeDiscovererRelease(version, identity.schemaVersion);

  return {
    version,
    prefix,
    discovererVersion,
    schemaVersion: identity.schemaVersion,
    tableNames: versionTables,
    owner,
    supported,
    warnings,
  };
}

/** Detect the EUL version of a source database. */
export async function detectEulVersion(
  source: EulSource,
  options: DetectEulVersionOptions = {},
): Promise<EulVersionInfo> {
  return detectEulVersionFromExecutor(resolveExecutor(source), options);
}
