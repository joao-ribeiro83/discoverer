/**
 * One-off diagnostic for Phase 5.2: does a pick-list actually come back from
 * the live source?
 *
 *   npx tsx src/scripts/probe-lov.ts <itemId> [search]
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { items, users } from '../db/schema.js';
import { resolveLov, resolveLovSource } from '../services/lov.service.js';

async function main() {
  const itemId = process.argv[2];
  const search = process.argv[3];
  if (!itemId) throw new Error('usage: probe-lov.ts <itemId> [search]');

  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) throw new Error('item not found');

  const [admin] = await db.select().from(users).where(eq(users.role, 'ADMIN')).limit(1);
  if (!admin) throw new Error('no admin user in the target');

  const source = await resolveLovSource(itemId);
  console.log(`item      : ${item.name}`);
  console.log(`class     : ${source.itemClassId ?? '(none — falling back to the item)'}`);
  console.log(`reads     : ${source.tableRef}.${source.valueColumn}`);
  console.log(`sort      : ${source.sortColumn ?? '(alphabetical)'}`);
  console.log(`cardinality: ${source.cardinality ?? '(not recorded)'}`);
  console.log('');

  const started = Date.now();
  const result = await resolveLov(itemId, { id: admin.id, role: admin.role }, {
    limit: 20,
    ...(search ? { search } : {}),
  });
  console.log(`mode      : ${result.mode}`);
  console.log(`truncated : ${result.truncated}`);
  console.log(`values    : ${result.values.length} in ${Date.now() - started} ms`);
  console.log(result.values.slice(0, 20).join(', '));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
