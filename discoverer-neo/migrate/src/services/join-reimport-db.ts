/**
 * The Drizzle implementation of `JoinReimportDb`.
 *
 * Separate from `join-reimport.ts` so the re-import logic — which is where the
 * decisions are — stays a pure function of two maps and can be tested without
 * a database.
 */

import { eq, sql } from 'drizzle-orm';

import type { TargetDatabase } from '../db/client.js';
import { folders, items, joinPredicates, joins } from '../db/schema.js';
import { itemKey, type JoinReimportDb } from './join-reimport.js';

export function createJoinReimportDb(db: TargetDatabase): JoinReimportDb {
  return {
    async folderIdsByName() {
      const rows = await db
        .select({ id: folders.id, name: folders.name })
        .from(folders)
        .where(eq(folders.isActive, true));
      // Last write wins on a duplicate name. Two active folders sharing a name
      // is already ambiguous for a name-keyed re-import, and the caller sees
      // the consequence as a skipped join rather than a wrong one: a source
      // folder that maps to the wrong target folder would produce a join
      // between the wrong tables.
      return new Map(rows.map((r) => [r.name, r.id]));
    },

    async itemIdsByFolderAndName() {
      const rows = await db
        .select({
          id: items.id,
          name: items.name,
          folderName: folders.name,
        })
        .from(items)
        .innerJoin(folders, eq(items.folderId, folders.id))
        .where(eq(items.isActive, true));
      return new Map(rows.map((r) => [itemKey(r.folderName, r.name), r.id]));
    },

    async replaceJoins(joinRows, predicateRows) {
      return db.transaction(async (tx) => {
        // `join_predicates.join_id` cascades, so deleting the joins takes the
        // predicates with them. The explicit delete is for the case where a
        // predicate row somehow outlives its join.
        await tx.delete(joinPredicates);
        const deleted = await tx.delete(joins).returning({ id: joins.id });

        if (joinRows.length > 0) {
          await tx.insert(joins).values(joinRows as never);
        }
        if (predicateRows.length > 0) {
          await tx.insert(joinPredicates).values(predicateRows as never);
        }

        return {
          joinsDeleted: deleted.length,
          joinsInserted: joinRows.length,
          predicatesInserted: predicateRows.length,
        };
      });
    },
  };
}

/**
 * The Phase 3.2 handover query, run against the target.
 *
 * Every join with its four flags and how many predicate components it carries.
 * A join with `predicates = 0` cannot generate SQL and refuses by name.
 */
export async function joinSummary(db: TargetDatabase): Promise<
  Array<{
    name: string;
    masterFolder: string;
    detailFolder: string;
    oneToOne: boolean;
    allowMasterNoDetail: boolean;
    allowDetailNoMaster: boolean;
    mandatory: boolean;
    predicates: number;
  }>
> {
  const rows = await db.execute<{
    name: string;
    master_folder: string;
    detail_folder: string;
    one_to_one: boolean;
    allow_master_no_detail: boolean;
    allow_detail_no_master: boolean;
    mandatory: boolean;
    predicates: string;
  }>(sql`
    SELECT j.name,
           lf.name AS master_folder,
           rf.name AS detail_folder,
           j.one_to_one,
           j.allow_master_no_detail,
           j.allow_detail_no_master,
           j.mandatory,
           count(p.id) AS predicates
      FROM joins j
      JOIN folders lf ON lf.id = j.left_folder_id
      JOIN folders rf ON rf.id = j.right_folder_id
      LEFT JOIN join_predicates p ON p.join_id = j.id
     GROUP BY j.id, j.name, lf.name, rf.name, j.one_to_one,
              j.allow_master_no_detail, j.allow_detail_no_master, j.mandatory
     ORDER BY j.name
  `);
  return rows.rows.map((r) => ({
    name: r.name,
    masterFolder: r.master_folder,
    detailFolder: r.detail_folder,
    oneToOne: r.one_to_one,
    allowMasterNoDetail: r.allow_master_no_detail,
    allowDetailNoMaster: r.allow_detail_no_master,
    mandatory: r.mandatory,
    predicates: Number(r.predicates),
  }));
}
