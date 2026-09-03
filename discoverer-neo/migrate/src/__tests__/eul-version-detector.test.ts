import { describe, it, expect } from '@jest/globals';
import {
  EulDetectionError,
  assertSafeIdentifier,
  describeDiscovererRelease,
  detectEulVersion,
  detectEulVersionFromExecutor,
} from '../services/eul-version-detector.js';
import {
  EUL3_OWNER,
  EUL4_OWNER,
  EUL5_OWNER,
  catalogFor,
  eul3Db,
  eul4Db,
  eul5Db,
  mixedDb,
  mockExecutor,
} from './helpers/mock-eul.js';

describe('detectEulVersion', () => {
  describe('EUL5 detection', () => {
    it('detects a pure EUL5 schema', async () => {
      const db = eul5Db();
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.version).toBe('EUL5');
      expect(info.prefix).toBe('EUL5_');
      // Read from EUL5_VERSIONS.VER_RELEASE — there is no EUL5_EUL table.
      expect(info.schemaVersion).toBe('5.1.0.0.0');
      expect(info.discovererVersion).toBe('10.1.2/11.1.1');
      expect(info.owner).toBe(EUL5_OWNER);
      expect(info.supported).toBe(true);
      expect(info.tableNames).toContain('EUL5_BAS');
      expect(info.tableNames).toContain('EUL5_ACCESS_PRIVS');
    });

    it('is also reachable through the EulSource wrapper', async () => {
      const db = eul5Db();
      const info = await detectEulVersion(mockExecutor(db));
      expect(info.version).toBe('EUL5');
    });

    it('derives the Discoverer release from VER_RELEASE', async () => {
      const db = eul5Db();
      db.tables.EUL5_VERSIONS = [{ VER_RELEASE: '5.0.2.0.0' }];
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.discovererVersion).toBe('9.0.2.53/9.0.4');
    });

    it('warns when tables EUL5 retired appear under the EUL5_ prefix', async () => {
      // The EUL4/EUL5 inventories are otherwise identical, so a half-upgraded
      // schema is the only table-presence signal there is.
      const db = eul5Db();
      db.catalog = [...db.catalog, { owner: EUL5_OWNER, tableName: 'EUL5_NAMED_ELEMS' }];
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.version).toBe('EUL5');
      expect(info.warnings.join('\n')).toMatch(/retired in EUL5/);
    });

    it('warns about missing core tables', async () => {
      const db = eul5Db();
      db.catalog = db.catalog.filter((row) => row.tableName !== 'EUL5_DOCUMENTS');
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.warnings.join('\n')).toMatch(/EUL5_DOCUMENTS/);
    });

    it('warns when VER_RELEASE contradicts the table prefix', async () => {
      const db = eul5Db();
      db.tables.EUL5_VERSIONS = [{ VER_RELEASE: '4.1.8.0.0' }];
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.version).toBe('EUL5'); // prefix stays authoritative
      expect(info.warnings.join('\n')).toMatch(/does not match/);
    });
  });

  describe('EUL4 detection', () => {
    it('detects a pure EUL4 schema', async () => {
      const db = eul4Db();
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.version).toBe('EUL4');
      expect(info.prefix).toBe('EUL4_');
      expect(info.schemaVersion).toBe('4.1.8.0.0');
      expect(info.discovererVersion).toBe('4.1.x');
      expect(info.owner).toBe(EUL4_OWNER);
      expect(info.supported).toBe(true);
      expect(info.tableNames).toContain('EUL4_BAS');
      expect(info.tableNames).not.toContain('EUL5_BAS');
    });
  });

  describe('EUL3 detection', () => {
    it('detects EUL3 and marks it unsupported', async () => {
      const db = eul3Db();
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.version).toBe('EUL3');
      expect(info.prefix).toBe('EUL_');
      expect(info.discovererVersion).toBe('3.x');
      expect(info.owner).toBe(EUL3_OWNER);
      expect(info.supported).toBe(false);
      expect(info.warnings.join('\n')).toMatch(/not supported/);
    });
  });

  describe('no EUL', () => {
    it('throws EulDetectionError when no EUL tables exist', async () => {
      const db = eul5Db();
      db.catalog = [];
      await expect(detectEulVersionFromExecutor(mockExecutor(db))).rejects.toThrow(
        EulDetectionError,
      );
    });

    it('throws when only non-BA EUL-ish tables exist', async () => {
      const db = eul5Db();
      db.catalog = catalogFor(EUL5_OWNER, ['EUL5_OBJS', 'EUL5_VERSIONS']);
      await expect(detectEulVersionFromExecutor(mockExecutor(db))).rejects.toThrow(
        /No EUL schema detected/,
      );
    });
  });

  describe('mixed schema (upgrade in progress)', () => {
    it('prefers EUL5 and warns', async () => {
      const db = mixedDb();
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.version).toBe('EUL5');
      expect(info.warnings.join('\n')).toMatch(/Mixed EUL schema/);
      // Only EUL5 tables are reported for the chosen version.
      expect(info.tableNames).toContain('EUL5_BAS');
      expect(info.tableNames).not.toContain('EUL4_BAS');
    });

    it('honours preferVersion: EUL4 on a mixed schema', async () => {
      const db = mixedDb();
      const info = await detectEulVersionFromExecutor(mockExecutor(db), {
        preferVersion: 'EUL4',
      });

      expect(info.version).toBe('EUL4');
      expect(info.prefix).toBe('EUL4_');
      expect(info.schemaVersion).toBe('4.1.8.0.0');
      expect(info.warnings.join('\n')).toMatch(/preferVersion override applied/);
    });

    it('ignores preferVersion when its tables are absent', async () => {
      const db = eul5Db();
      const info = await detectEulVersionFromExecutor(mockExecutor(db), {
        preferVersion: 'EUL4',
      });
      expect(info.version).toBe('EUL5');
      expect(info.warnings.join('\n')).toMatch(/preferVersion=EUL4 ignored/);
    });
  });

  describe('VERSIONS table edge cases', () => {
    it('handles a missing EUL*_VERSIONS table (ORA-00942)', async () => {
      const db = eul5Db();
      delete db.tables.EUL5_VERSIONS;
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.version).toBe('EUL5');
      expect(info.schemaVersion).toBe('unknown');
      expect(info.discovererVersion).toBe('unknown');
      expect(info.warnings.join('\n')).toMatch(/not found or not readable/);
    });

    it('handles an empty EUL*_VERSIONS table', async () => {
      const db = eul5Db();
      db.tables.EUL5_VERSIONS = [];
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.schemaVersion).toBe('unknown');
      expect(info.warnings.join('\n')).toMatch(/is empty/);
    });

    it('uses the first row and warns when EUL*_VERSIONS has several rows', async () => {
      const db = eul5Db();
      db.tables.EUL5_VERSIONS = [
        { VER_RELEASE: '5.1.0.0.0' },
        { VER_RELEASE: '5.0.2.0.0' },
      ];
      const info = await detectEulVersionFromExecutor(mockExecutor(db));

      expect(info.schemaVersion).toBe('5.1.0.0.0');
      expect(info.discovererVersion).toBe('10.1.2/11.1.1');
      expect(info.warnings.join('\n')).toMatch(/2 rows/);
    });
  });

  describe('schema owner resolution', () => {
    it('prefers the connected user when several schemas hold EUL tables', async () => {
      const db = eul5Db();
      db.catalog = [...db.catalog, ...catalogFor('OTHER_EUL', ['EUL5_BAS', 'EUL5_VERSIONS'])];
      db.currentUser = EUL5_OWNER;
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.owner).toBe(EUL5_OWNER);
      expect(info.warnings.join('\n')).not.toMatch(/Multiple schemas/);
    });

    it('warns and picks deterministically when the connected user owns nothing', async () => {
      const db = eul5Db();
      db.catalog = [...db.catalog, ...catalogFor('AAA_EUL', ['EUL5_BAS', 'EUL5_VERSIONS'])];
      db.currentUser = 'SOMEONE_ELSE';
      const info = await detectEulVersionFromExecutor(mockExecutor(db));
      expect(info.owner).toBe('AAA_EUL'); // alphabetical
      expect(info.warnings.join('\n')).toMatch(/Multiple schemas contain EUL tables/);
    });

    it('honours an explicit schemaOwner', async () => {
      const db = eul5Db();
      db.catalog = [...db.catalog, ...catalogFor('OTHER_EUL', ['EUL4_BAS', 'EUL4_VERSIONS'])];
      db.tables.EUL4_VERSIONS = [{ VER_RELEASE: '4.1.8.0.0' }];
      const info = await detectEulVersionFromExecutor(mockExecutor(db), {
        schemaOwner: 'other_eul',
      });
      expect(info.owner).toBe('OTHER_EUL');
      expect(info.version).toBe('EUL4');
    });

    it('throws when the explicit schemaOwner has no EUL tables', async () => {
      const db = eul5Db();
      await expect(
        detectEulVersionFromExecutor(mockExecutor(db), { schemaOwner: 'NOT_A_EUL' }),
      ).rejects.toThrow(/contains no EUL business-area table/);
    });
  });

  describe('helpers', () => {
    it('maps schema versions to Discoverer releases', () => {
      expect(describeDiscovererRelease('EUL3', 'anything')).toBe('3.x');
      expect(describeDiscovererRelease('EUL4', 'anything')).toBe('4.1.x');
      expect(describeDiscovererRelease('EUL5', '5.1.0.0.0')).toBe('10.1.2/11.1.1');
      expect(describeDiscovererRelease('EUL5', '5.0.2.1.0')).toBe('9.0.2.53/9.0.4');
      expect(describeDiscovererRelease('EUL5', '5.0.0.0.0')).toBe('9.0.2');
      expect(describeDiscovererRelease('EUL5', 'unknown')).toBe('unknown');
    });

    it('rejects unsafe identifiers and uppercases safe ones', () => {
      expect(assertSafeIdentifier('eul5_us')).toBe('EUL5_US');
      expect(() => assertSafeIdentifier('X; DROP TABLE users')).toThrow(EulDetectionError);
      expect(() => assertSafeIdentifier('bad name')).toThrow(EulDetectionError);
    });
  });
});
