/**
 * Phase 7.2 — owner and map resolution against a real target, using the
 * exact matching this estate's live EUL data was validated against
 * (`migrate/EUL_SCHEMA_GROUND_TRUTH.md` §3.8): owner by
 * `usernameToEmailLocal(EU_USERNAME)@migrated.local`, map by workbook name
 * then, for a multi-worksheet workbook, by the `"<workbook> — <sheet>"`
 * naming convention `map-reimport` gives a worksheet map.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../../db/index.js';
import { workbooks, maps } from '../../db/schema.js';
import { usernameToEmailLocal, MIGRATED_EMAIL_DOMAIN } from '@discoverer-neo/core/migration';
import { resolveOwnerUserId, resolveTargetMap } from '../../services/schedule-import.service.js';
import { createTestUser, cleanupIntegrationUsers } from './test-helper.js';

let ownerId: string;

beforeAll(async () => {
  await cleanupIntegrationUsers();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
  const email = `${usernameToEmailLocal('MAPTESTES')}@${MIGRATED_EMAIL_DOMAIN}`;
  const user = await createTestUser(email, 'irrelevant-password-1', 'USER');
  ownerId = user.id;
});

describe('resolveOwnerUserId', () => {
  it('resolves an EUL username to the migrated user with the same synthesised email', async () => {
    const id = await resolveOwnerUserId('MAPTESTES');
    expect(id).toBe(ownerId);
  });

  it('is case-insensitive the same way usernameToEmailLocal is', async () => {
    const id = await resolveOwnerUserId('maptestes');
    expect(id).toBe(ownerId);
  });

  it('returns null for a username no migrated user matches', async () => {
    const id = await resolveOwnerUserId('NO_SUCH_EUL_USER');
    expect(id).toBeNull();
  });
});

describe('resolveTargetMap', () => {
  it('resolves a single-worksheet workbook directly by name', async () => {
    const [wb] = await db.insert(workbooks).values({ name: 'M04A_V02', createdBy: ownerId }).returning();
    const [map] = await db
      .insert(maps)
      .values({ name: 'M04A_V02', mapType: 'TABLE', createdBy: ownerId, workbookId: wb!.id })
      .returning();

    const resolved = await resolveTargetMap('M04A_V02', 'M4A');
    expect(resolved).toEqual({ mapId: map!.id, ambiguous: false });
  });

  it('resolves a multi-worksheet workbook by the "<workbook> — <sheet>" suffix', async () => {
    const [wb] = await db.insert(workbooks).values({ name: 'M65_V17', createdBy: ownerId }).returning();
    await db.insert(maps).values({
      name: 'M65_V17 — M65 Valores em Carteira',
      mapType: 'TABLE',
      createdBy: ownerId,
      workbookId: wb!.id,
    });
    const [target] = await db
      .insert(maps)
      .values({
        name: 'M65_V17 — M65 Contencioso',
        mapType: 'TABLE',
        createdBy: ownerId,
        workbookId: wb!.id,
      })
      .returning();

    const resolved = await resolveTargetMap('M65_V17', 'M65 Contencioso');
    expect(resolved).toEqual({ mapId: target!.id, ambiguous: false });
  });

  it('reports ambiguous when no worksheet suffix matches on a multi-map workbook', async () => {
    const [wb] = await db.insert(workbooks).values({ name: 'M58D_V09', createdBy: ownerId }).returning();
    await db
      .insert(maps)
      .values([
        { name: 'M58D_V09 — Recibos Vencidos', mapType: 'TABLE', createdBy: ownerId, workbookId: wb!.id },
        { name: 'M58D_V09 — Recibos Não Vencidos', mapType: 'TABLE', createdBy: ownerId, workbookId: wb!.id },
      ]);

    const resolved = await resolveTargetMap('M58D_V09', 'Co-Seguro');
    expect(resolved).toEqual({ mapId: '', ambiguous: true });
  });

  it('returns null when the workbook itself is not on the target', async () => {
    const resolved = await resolveTargetMap('NOT_MIGRATED_WB', 'Sheet1');
    expect(resolved).toBeNull();
  });
});
