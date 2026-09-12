/**
 * Phase 5.3b — `map_conditions_reference_ck`.
 *
 * `validateConditionInputs` already refuses a condition naming both or
 * neither of itemId/calculatedFieldName before anything reaches the
 * database. This proves the CHECK is real at the database layer too — the
 * backstop for anything that writes a row without going through
 * `map.service.ts` (a raw script, a future migration path, a bug).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../db/index.js';
import { maps, mapCalculatedFields, mapConditions } from '../../db/schema.js';
import {
  createTestUser,
  createTestBusinessArea,
  createTestFolder,
  createTestItem,
  cleanupIntegrationUsers,
} from './test-helper.js';

describe('map_conditions_reference_ck', () => {
  let itemId: string;
  let calcFieldId: string;
  let mapId: string;

  beforeAll(async () => {
    const user = await createTestUser(
      `int-condition-ck-${Date.now()}@test.com`,
      'TestPass123!',
      'ADMIN',
    );
    const ba = await createTestBusinessArea(`Condition CK BA ${Date.now()}`, user.id);
    const folder = await createTestFolder(ba.id, `Condition CK Folder ${Date.now()}`);
    const item = await createTestItem(folder.id, `Condition CK Item ${Date.now()}`);
    itemId = item.id;

    const [map] = await db
      .insert(maps)
      .values({
        name: `Condition CK Map ${Date.now()}`,
        mapType: 'TABLE',
        businessAreaId: ba.id,
        createdBy: user.id,
      })
      .returning();
    mapId = map!.id;

    const [calcField] = await db
      .insert(mapCalculatedFields)
      .values({ mapId, name: 'Calc', formula: '1' })
      .returning();
    calcFieldId = calcField!.id;
  });

  afterAll(async () => {
    await cleanupIntegrationUsers();
  });

  /**
   * node-postgres wraps the actual constraint violation in `error.cause`,
   * not `error.message` — drizzle's own message is just "Failed query: ...".
   * The constraint name only shows up in the cause.
   */
  async function expectConstraintViolation(insert: Promise<unknown>): Promise<void> {
    await expect(insert).rejects.toMatchObject({
      cause: { message: expect.stringContaining('map_conditions_reference_ck') },
    });
  }

  it('rejects a row naming both itemId and calculatedFieldId', async () => {
    await expectConstraintViolation(
      db.insert(mapConditions).values({
        mapId,
        itemId,
        calculatedFieldId: calcFieldId,
        operator: '=',
        value: 'x',
        conditionType: 'STATIC',
      }),
    );
  });

  it('rejects a row naming neither itemId nor calculatedFieldId', async () => {
    await expectConstraintViolation(
      db.insert(mapConditions).values({
        mapId,
        itemId: null,
        calculatedFieldId: null,
        operator: '=',
        value: 'x',
        conditionType: 'STATIC',
      }),
    );
  });

  it('accepts a row naming exactly one', async () => {
    const [row] = await db
      .insert(mapConditions)
      .values({
        mapId,
        itemId,
        operator: '=',
        value: 'x',
        conditionType: 'STATIC',
      })
      .returning();
    expect(row?.itemId).toBe(itemId);

    const [calcRow] = await db
      .insert(mapConditions)
      .values({
        mapId,
        calculatedFieldId: calcFieldId,
        operator: '=',
        value: 'x',
        conditionType: 'STATIC',
      })
      .returning();
    expect(calcRow?.calculatedFieldId).toBe(calcFieldId);
  });
});
