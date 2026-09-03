/**
 * Dev-only verification tool (see `README.md` in this directory) — NOT part
 * of the migration pipeline and not exported from the package.
 *
 * Compares every workbook `dump-corpus.ps1` has produced so far against what
 * `workbook-parser.ts` reads from the same workbook's live bytes, using
 * `d4wkdmp-differ.ts`. Connects directly to the source Oracle EUL — the
 * migrate workspace's own pattern (`services/oracle-client.ts`), not the
 * backend's.
 *
 *   npx tsx src/scripts/diff-corpus.ts \
 *     --manifest E:\claude\discoverer\d4dumps\_manifest.json \
 *     --dumps-dir E:\claude\discoverer\d4dumps \
 *     --password-file <path to a plaintext password file> \
 *     [--limit N] [--report <output.json>]
 *
 * `--bytes-dir <path>` reads each workbook's bytes from `<docId>.bin` on disk
 * instead of from Oracle, so a corpus exported once can be re-diffed offline
 * — no live source, no password, no thick-mode client. That is how the
 * before/after numbers for a parser change are produced without holding a
 * connection to a customer database open for the length of the work.
 *
 * Only workbooks that already have a `<docId>.txt` dump are diffed, so this
 * can be run against a partial corpus while `dump-corpus.ps1` is still
 * running in the background — re-run it later for the full 558.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseD4wkdmpDump } from '../services/d4wkdmp-dump-parser.js';
import { diffWorkbookDump, mergeFieldTallies, type FieldTally } from '../services/d4wkdmp-differ.js';
import { parseWorkbookDocument } from '../services/workbook-parser.js';
import {
  createExecutor,
  closeAllPools,
  importOracleDb,
  type EulConnectionConfig,
} from '../services/oracle-client.js';

/**
 * The source this tool was built against (Discoverer 4.1 / Oracle 8) uses a
 * pre-11g password verifier `node-oracledb`'s default Thin mode cannot
 * authenticate at all (`NJS-116`) — Thick mode is not an optional
 * optimization here, it is required. Same check as
 * `backend/src/scripts/probe-eul-workbooks.ts`; `oracle-client.ts` itself
 * stays Thin-only since most of migrate's own test/CI paths never touch a
 * source this old.
 */
async function initThickModeIfConfigured(): Promise<void> {
  if (process.env.ORACLE_THICK_MODE !== 'true') return;
  const oracledb = await importOracleDb();
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH || '/opt/oracle/instantclient' });
  } catch {
    /* already initialised */
  }
}

interface Manifest {
  owner: string;
  prefix: string;
  connect: {
    username: string;
    host: string | null;
    port: number | null;
    serviceName: string | null;
    sid: string | null;
    connectionString: string | null;
  };
  documents: Array<{ docId: number; docName: string; docLength: number }>;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a?.startsWith('--')) {
      const key = a.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        out[key] = value;
        i += 1;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

function emptyTally(): FieldTally {
  return { agree: 0, disagree: 0, onlyInDump: 0, onlyInParser: 0 };
}

function fmtPct(n: number, total: number): string {
  if (total === 0) return 'n/a';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function printSectionSummary(title: string, dumpTotal: number, matched: number, fields: Record<string, FieldTally>): void {
  console.log(`\n${title}: ${matched}/${dumpTotal} matched (${fmtPct(matched, dumpTotal)})`);
  for (const [field, t] of Object.entries(fields)) {
    const total = t.agree + t.disagree + t.onlyInDump + t.onlyInParser;
    console.log(
      `  ${field}: agree=${t.agree} disagree=${t.disagree} onlyInDump=${t.onlyInDump} ` +
        `onlyInParser=${t.onlyInParser} (agree rate ${fmtPct(t.agree, total)})`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = args.manifest;
  const dumpsDir = args['dumps-dir'];
  const passwordFile = args['password-file'];
  const bytesDir = args['bytes-dir'];
  const limit = args.limit ? Number(args.limit) : 0;
  const reportPath = args.report;

  if (!manifestPath || !dumpsDir || (!passwordFile && !bytesDir)) {
    throw new Error(
      'usage: diff-corpus.ts --manifest <path> --dumps-dir <path> ' +
        '(--password-file <path> | --bytes-dir <path>) [--limit N] [--report <path>]',
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  // Offline: the bytes come from `<docId>.bin` in `--bytes-dir`. Online: from
  // `DOC_DOCUMENT` on the live source, which is what the harness was built
  // against and stays the default when no `--bytes-dir` is given.
  let readBytes: (docId: number) => Promise<Buffer | null>;
  if (bytesDir) {
    readBytes = (docId) => {
      const path = join(bytesDir, `${docId}.bin`);
      return Promise.resolve(existsSync(path) ? readFileSync(path) : null);
    };
  } else {
    await initThickModeIfConfigured();
    const password = readFileSync(passwordFile!, 'latin1').trim();
    const connection: EulConnectionConfig = {
      user: manifest.connect.username,
      password,
      host: manifest.connect.host ?? undefined,
      port: manifest.connect.port ?? undefined,
      serviceName: manifest.connect.serviceName ?? undefined,
      sid: manifest.connect.sid ?? undefined,
      connectString: manifest.connect.connectionString ?? undefined,
    };
    const execute = createExecutor(connection);
    readBytes = async (docId) => {
      const rows = await execute(
        `SELECT DOC_DOCUMENT FROM ${manifest.owner}.${manifest.prefix}DOCUMENTS WHERE DOC_ID = :id`,
        { id: docId },
      );
      const body = rows[0]?.DOC_DOCUMENT;
      return Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
          ? Buffer.from(body, 'latin1')
          : null;
    };
  }

  const dumped = new Set(
    readdirSync(dumpsDir)
      .filter((f) => /^\d+\.txt$/.test(f))
      .map((f) => Number(f.replace(/\.txt$/, ''))),
  );
  let toDiff = manifest.documents.filter((d) => dumped.has(d.docId));
  if (limit > 0) toDiff = toDiff.slice(0, limit);

  console.log(`${dumped.size} workbook(s) dumped so far; diffing ${toDiff.length} of them`);

  const aggregate = {
    items: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    functions: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    calculations: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0, viaRawId: 0, viaName: 0 },
    privateFilters: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0, viaSql: 0, viaName: 0 },
    parameters: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    sorts: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    queryRequests: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    joins: { fields: {} as Record<string, FieldTally>, dumpTotal: 0, matched: 0 },
    sheets: {
      dumpTotal: 0,
      matched: 0,
      itemsMatched: 0,
      itemsOnlyInDump: 0,
      itemsOnlyInParser: 0,
      queryItemsMatched: 0,
      queryItemsOnlyInDump: 0,
      queryItemsOnlyInParser: 0,
      nameAgree: 0,
      nameDisagree: 0,
      queries: emptyTally(),
      filters: emptyTally(),
      joins: emptyTally(),
      axisItems: emptyTally(),
      measureItems: emptyTally(),
      hiddenItems: emptyTally(),
      distinct: emptyTally(),
      sortItems: emptyTally(),
    },
    framing: { framed: 0, unframed: 0 },
  };
  const perWorkbook: Array<Record<string, unknown>> = [];
  const failures: Array<{ docId: number; docName: string; error: string }> = [];
  let processed = 0;

  for (const document of toDiff) {
    const dumpPath = join(dumpsDir, `${document.docId}.txt`);
    try {
      const dumpText = readFileSync(dumpPath, 'latin1');
      const dump = parseD4wkdmpDump(dumpText);

      const rawBytes = await readBytes(document.docId);
      if (!rawBytes) throw new Error('workbook body was empty or not a recognizable type');

      const doc = parseWorkbookDocument(rawBytes);
      const report = diffWorkbookDump(dump, doc, rawBytes);

      aggregate.items.dumpTotal += report.items.dumpCount;
      aggregate.items.matched += report.items.matched;
      mergeFieldTallies(aggregate.items.fields, report.items.fields);

      aggregate.functions.dumpTotal += report.functions.dumpCount;
      aggregate.functions.matched += report.functions.matched;
      mergeFieldTallies(aggregate.functions.fields, report.functions.fields);

      aggregate.calculations.dumpTotal += report.calculations.dumpCount;
      aggregate.calculations.matched += report.calculations.matched;
      aggregate.calculations.viaRawId += report.calculations.matchedVia.rawId;
      aggregate.calculations.viaName += report.calculations.matchedVia.name;
      mergeFieldTallies(aggregate.calculations.fields, report.calculations.fields);

      aggregate.privateFilters.dumpTotal += report.privateFilters.dumpCount;
      aggregate.privateFilters.matched += report.privateFilters.matched;
      aggregate.privateFilters.viaSql += report.privateFilters.matchedVia.sql;
      aggregate.privateFilters.viaName += report.privateFilters.matchedVia.name;
      mergeFieldTallies(aggregate.privateFilters.fields, report.privateFilters.fields);

      aggregate.parameters.dumpTotal += report.parameters.dumpCount;
      aggregate.parameters.matched += report.parameters.matched;
      mergeFieldTallies(aggregate.parameters.fields, report.parameters.fields);

      for (const [into, from] of [
        [aggregate.sorts, report.sorts],
        [aggregate.queryRequests, report.queryRequests],
        [aggregate.joins, report.joins],
      ] as const) {
        into.dumpTotal += from.dumpCount;
        into.matched += from.matched;
        mergeFieldTallies(into.fields, from.fields);
      }

      aggregate.framing.framed += report.framing.framed;
      aggregate.framing.unframed += report.framing.unframed;

      for (const sheet of report.sheets.sheets) {
        aggregate.sheets.dumpTotal += 1;
        aggregate.sheets.matched += 1;
        aggregate.sheets.itemsMatched += sheet.itemsMatched;
        aggregate.sheets.itemsOnlyInDump += sheet.itemsOnlyInDump.length;
        aggregate.sheets.itemsOnlyInParser += sheet.itemsOnlyInParser.length;
        aggregate.sheets.nameAgree += sheet.name.agree;
        aggregate.sheets.nameDisagree += sheet.name.disagree;
        aggregate.sheets.queryItemsMatched += sheet.queryItemsMatched;
        aggregate.sheets.queryItemsOnlyInDump += sheet.queryItemsOnlyInDump.length;
        aggregate.sheets.queryItemsOnlyInParser += sheet.queryItemsOnlyInParser.length;
        for (const [into, from] of [
          [aggregate.sheets.queries, sheet.queries],
          [aggregate.sheets.filters, sheet.filters],
          [aggregate.sheets.joins, sheet.joins],
          [aggregate.sheets.axisItems, sheet.axisItems],
          [aggregate.sheets.measureItems, sheet.measureItems],
          [aggregate.sheets.hiddenItems, sheet.hiddenItems],
          [aggregate.sheets.distinct, sheet.distinct],
          [aggregate.sheets.sortItems, sheet.sortItems],
        ] as const) {
          into.agree += from.agree;
          into.disagree += from.disagree;
          into.onlyInDump += from.onlyInDump;
          into.onlyInParser += from.onlyInParser;
        }
      }
      aggregate.sheets.dumpTotal += report.sheets.unmatchedDumpSheets.length;

      perWorkbook.push({ docId: document.docId, docName: document.docName, report });
      processed += 1;
      if (processed % 25 === 0) console.log(`  ...${processed}/${toDiff.length}`);
    } catch (err) {
      failures.push({ docId: document.docId, docName: document.docName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await closeAllPools();

  console.log(`\n${'='.repeat(78)}`);
  console.log(`Diffed ${processed}/${toDiff.length} workbook(s); ${failures.length} failed to diff`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures.slice(0, 20)) console.log(`  ${f.docId} ${f.docName}: ${f.error}`);
  }

  printSectionSummary('Items (EUL Item Reference, IoId-correlated)', aggregate.items.dumpTotal, aggregate.items.matched, aggregate.items.fields);
  printSectionSummary('Custom functions (EUL Function Reference, IoId-correlated)', aggregate.functions.dumpTotal, aggregate.functions.matched, aggregate.functions.fields);
  console.log(`  matched via raw synthetic id: ${aggregate.calculations.viaRawId}, via name: ${aggregate.calculations.viaName}`);
  printSectionSummary('Calculations (EUL Private Item, id-correlated)', aggregate.calculations.dumpTotal, aggregate.calculations.matched, aggregate.calculations.fields);
  console.log(`  matched via sql text: ${aggregate.privateFilters.viaSql}, via name: ${aggregate.privateFilters.viaName}`);
  printSectionSummary('Private filters (EUL Private Filter, name-correlated)', aggregate.privateFilters.dumpTotal, aggregate.privateFilters.matched, aggregate.privateFilters.fields);
  printSectionSummary('Parameters (name-correlated)', aggregate.parameters.dumpTotal, aggregate.parameters.matched, aggregate.parameters.fields);
  printSectionSummary('Sorts (EUL Sort Item Reference, position-correlated)', aggregate.sorts.dumpTotal, aggregate.sorts.matched, aggregate.sorts.fields);
  printSectionSummary('Query requests (Query Request QRn, position-correlated)', aggregate.queryRequests.dumpTotal, aggregate.queryRequests.matched, aggregate.queryRequests.fields);
  printSectionSummary('Joins (EUL Join Reference, id-correlated)', aggregate.joins.dumpTotal, aggregate.joins.matched, aggregate.joins.fields);

  console.log(`\nSheets (position-correlated): ${aggregate.sheets.matched}/${aggregate.sheets.dumpTotal} matched`);
  console.log(`  name: agree=${aggregate.sheets.nameAgree} disagree=${aggregate.sheets.nameDisagree}`);
  console.log(
    `  displayed items (vs layout columns): matched=${aggregate.sheets.itemsMatched} ` +
      `onlyInDump=${aggregate.sheets.itemsOnlyInDump} onlyInParser=${aggregate.sheets.itemsOnlyInParser}`,
  );
  console.log(
    `  Items :- (vs query items): matched=${aggregate.sheets.queryItemsMatched} ` +
      `onlyInDump=${aggregate.sheets.queryItemsOnlyInDump} onlyInParser=${aggregate.sheets.queryItemsOnlyInParser}`,
  );
  for (const [label, tally] of [
    ['Query(s) used', aggregate.sheets.queries],
    ['Filters :-', aggregate.sheets.filters],
    ['Joins :-', aggregate.sheets.joins],
    // The layout model as the migration writes it: which axis each item is
    // on, where on it, which items nothing displays, and SELECT DISTINCT.
    ['Axis Item Usage (vs axis_type/axis_order)', aggregate.sheets.axisItems],
    ['Measure Item Usage (vs axis_type/axis_order)', aggregate.sheets.measureItems],
    ['Items :- with no column (vs is_hidden)', aggregate.sheets.hiddenItems],
    ['Distinct (vs select_distinct)', aggregate.sheets.distinct],
    ['Sort On (vs sort_direction/sort_order)', aggregate.sheets.sortItems],
  ] as const) {
    console.log(
      `  ${label}: agree=${tally.agree} disagree=${tally.disagree} ` +
        `onlyInDump=${tally.onlyInDump} onlyInParser=${tally.onlyInParser}`,
    );
  }

  const elementTotal = aggregate.framing.framed + aggregate.framing.unframed;
  console.log(
    `\nElement framing: ${aggregate.framing.framed}/${elementTotal} bodies read as a complete ` +
      `record sequence (${fmtPct(aggregate.framing.framed, elementTotal)}); ` +
      `${aggregate.framing.unframed} fell back to the resynchronizing scan`,
  );

  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ aggregate, failures, perWorkbook }, null, 2));
    console.log(`\nFull report written to ${reportPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
