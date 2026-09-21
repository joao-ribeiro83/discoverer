/**
 * Two things the EUL does not record but the Oracle data dictionary does:
 *
 * 1. Whether a simple folder's object is a TABLE or a VIEW. `EUL4_OBJS.OBJ_TYPE`
 *    only says SOBJ (simple) or COBJ (complex), so every migrated folder used
 *    to land as TABLE — which is what `normalizeFolderType` still yields, and
 *    what this file corrects from `ALL_OBJECTS`.
 * 2. Column comments (`ALL_COL_COMMENTS`), which become the description of
 *    any item that has none of its own.
 *
 * Both are best-effort: the EUL reader's connection may not see the data
 * schema at all, and a migration must not fail for want of a comment.
 */
import type { OracleExecutor } from './oracle-client.js';
import { dbString } from './oracle-client.js';

export interface ObjectRef {
  owner: string | null | undefined;
  name: string | null | undefined;
}

export type CatalogObjectType = 'TABLE' | 'VIEW';

export interface CatalogLookup {
  /** `OWNER.NAME` (upper-cased) → TABLE | VIEW, for every object found. */
  objectTypes: Map<string, CatalogObjectType>;
  /** `OWNER.TABLE.COLUMN` (upper-cased) → comment text, non-empty only. */
  columnComments: Map<string, string>;
  /** Owners whose dictionary rows could not be read, with the reason. */
  failures: Array<{ owner: string; reason: string }>;
}

export function objectKey(owner: string, name: string): string {
  return `${owner.toUpperCase()}.${name.toUpperCase()}`;
}

export function columnKey(owner: string, table: string, column: string): string {
  return `${objectKey(owner, table)}.${column.toUpperCase()}`;
}

function distinctOwners(refs: ObjectRef[]): string[] {
  const owners = new Set<string>();
  for (const ref of refs) {
    const owner = (ref.owner ?? '').trim();
    if (owner && (ref.name ?? '').trim()) owners.add(owner.toUpperCase());
  }
  return [...owners].sort();
}

/**
 * Read object types and column comments for every owner the refs mention.
 * One query per owner and per dictionary view: owners are few (a handful of
 * schemas per estate), objects are many, and `IN (...)` lists would need
 * bind-list plumbing for no gain.
 */
export async function readCatalog(execute: OracleExecutor, refs: ObjectRef[]): Promise<CatalogLookup> {
  const lookup: CatalogLookup = { objectTypes: new Map(), columnComments: new Map(), failures: [] };

  for (const owner of distinctOwners(refs)) {
    try {
      const objects = await execute(
        `SELECT OBJECT_NAME, OBJECT_TYPE FROM ALL_OBJECTS
          WHERE OWNER = :owner AND OBJECT_TYPE IN ('TABLE', 'VIEW')`,
        { owner },
      );
      for (const row of objects) {
        const type = dbString(row.OBJECT_TYPE).toUpperCase();
        if (type === 'TABLE' || type === 'VIEW') {
          lookup.objectTypes.set(objectKey(owner, dbString(row.OBJECT_NAME)), type);
        }
      }

      const comments = await execute(
        `SELECT TABLE_NAME, COLUMN_NAME, COMMENTS FROM ALL_COL_COMMENTS
          WHERE OWNER = :owner AND COMMENTS IS NOT NULL`,
        { owner },
      );
      for (const row of comments) {
        const text = dbString(row.COMMENTS).trim();
        if (text === '') continue;
        lookup.columnComments.set(
          columnKey(owner, dbString(row.TABLE_NAME), dbString(row.COLUMN_NAME)),
          text,
        );
      }
    } catch (err) {
      lookup.failures.push({ owner, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return lookup;
}
