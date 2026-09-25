import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workbooks, maps, mapLayouts, type Map } from '../db/schema.js';
import {
  canAccessMap,
  canDuplicate,
  canManageShares,
  duplicate,
  listAll,
  listShares,
  revokeShare,
  shareWith,
} from './map.service.js';

export type WorkbookWithMaps = typeof workbooks.$inferSelect & { maps: Map[] };

/**
 * Workbook browse view (Phase 7.1b).
 *
 * Groups `listAll`'s entitlement-filtered maps by workbook — it does not add
 * a second visibility check. A workbook whose worksheets the caller cannot
 * see does not appear, and a worksheet the caller cannot see does not appear
 * inside one that does (D-020: workbook membership grants nothing).
 */
export async function listWorkbooksWithMaps(user: {
  sub: string;
  role: string;
}): Promise<WorkbookWithMaps[]> {
  const visibleMaps = await listAll(user);
  const withWorkbook = visibleMaps.filter((m) => m.workbookId !== null);
  if (!withWorkbook.length) return [];

  const workbookIds = [...new Set(withWorkbook.map((m) => m.workbookId as string))];
  const [wbRows, layoutRows] = await Promise.all([
    db.select().from(workbooks).where(inArray(workbooks.id, workbookIds)),
    db
      .select({ mapId: mapLayouts.mapId, worksheetIndex: mapLayouts.worksheetIndex })
      .from(mapLayouts)
      .where(inArray(mapLayouts.mapId, withWorkbook.map((m) => m.id))),
  ]);
  const indexByMap = new Map(layoutRows.map((r) => [r.mapId, r.worksheetIndex ?? 0]));

  const mapsByWorkbook = new Map<string, Map[]>();
  for (const m of withWorkbook) {
    const list = mapsByWorkbook.get(m.workbookId as string) ?? [];
    list.push(m);
    mapsByWorkbook.set(m.workbookId as string, list);
  }
  for (const list of mapsByWorkbook.values()) {
    list.sort((a, b) => (indexByMap.get(a.id) ?? 0) - (indexByMap.get(b.id) ?? 0));
  }

  return wbRows
    .map((w) => ({ ...w, maps: mapsByWorkbook.get(w.id) ?? [] }))
    .filter((w) => w.maps.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Share every worksheet of a workbook with one person, in one step.
 *
 * Discoverer had no per-worksheet grant: `ACCESS_PRIVS.AP_TYPE = 'GD'` names a
 * whole workbook (`GD_DOC_ID`), and that is how the estate's fifty grants were
 * written. Neo's unit of sharing is the map, so the workbook grant is a fan-out
 * over its worksheets — done here so an administrator hands over a report, not
 * twelve rows.
 *
 * Only the worksheets the caller may themselves manage are shared: `maps` is
 * already the caller's entitlement set, and `canManageShares` decides each one.
 * A worksheet they cannot pass on is reported by name rather than skipped
 * quietly, because "shared the workbook" must not mean "shared most of it".
 */
export async function shareWorkbook(
  workbookId: string,
  sharedWithUserId: string,
  permissionLevel: 'VIEW' | 'EDIT' | 'EXPORT',
  actor: { sub: string; role: string },
): Promise<{ shared: number; refused: string[] }> {
  const visible = await listAll(actor);
  const sheets = visible.filter((m) => m.workbookId === workbookId);
  if (sheets.length === 0) return { shared: 0, refused: [] };

  const refused: string[] = [];
  let shared = 0;
  for (const sheet of sheets) {
    if (!(await canManageShares(actor, sheet))) {
      refused.push(sheet.name);
      continue;
    }
    await shareWith(sheet.id, sharedWithUserId, permissionLevel, actor.sub);
    shared += 1;
  }
  return { shared, refused };
}

/**
 * Who holds this workbook, and on how many of its worksheets.
 *
 * The shares are per worksheet, so a person can hold some sheets and not
 * others — a half-share is exactly the state an administrator needs to see,
 * and reporting one number per person would hide it. `sheets` is the count
 * they hold out of `total`.
 */
export async function listWorkbookShares(
  workbookId: string,
  actor: { sub: string; role: string },
): Promise<{
  total: number;
  shares: Array<{
    userId: string;
    email: string | null;
    name: string | null;
    permissionLevel: string;
    sheets: number;
  }>;
}> {
  const visible = await listAll(actor);
  const sheets = visible.filter((m) => m.workbookId === workbookId);
  const byUser = new Map<
    string,
    { userId: string; email: string | null; name: string | null; permissionLevel: string; sheets: number }
  >();

  for (const sheet of sheets) {
    for (const share of await listShares(sheet.id)) {
      const held = byUser.get(share.sharedWithUserId);
      if (held) {
        held.sheets += 1;
        // Report the narrowest level held, so a mixed share never reads as
        // more access than the person actually has everywhere.
        if (SHARE_ORDER.indexOf(share.permissionLevel) < SHARE_ORDER.indexOf(held.permissionLevel)) {
          held.permissionLevel = share.permissionLevel;
        }
      } else {
        byUser.set(share.sharedWithUserId, {
          userId: share.sharedWithUserId,
          email: share.sharedWithEmail,
          name: share.sharedWithName,
          permissionLevel: share.permissionLevel,
          sheets: 1,
        });
      }
    }
  }

  return {
    total: sheets.length,
    shares: [...byUser.values()].sort((a, b) =>
      (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''),
    ),
  };
}

/**
 * Copy a whole workbook — Discoverer's "Save As". The copy gets a new name,
 * belongs to the caller, and holds a private copy of every worksheet, so the
 * copy can be edited while the original stays as it was.
 *
 * Only worksheets the caller can see are copied (D-020: membership grants
 * nothing). If they may not copy any one of those, nothing is copied and the
 * refused sheets are named — a copy missing sheets is not the same workbook.
 * One transaction: a failure part-way leaves no half-copy behind.
 */
export async function duplicateWorkbook(
  workbookId: string,
  actor: { sub: string; role: string },
  newName?: string,
): Promise<
  | { status: 'not_found' }
  | { status: 'refused'; refused: string[] }
  | { status: 'ok'; workbook: WorkbookWithMaps }
> {
  const visible = await listAll(actor);
  const sheets = visible.filter((m) => m.workbookId === workbookId);
  if (sheets.length === 0) return { status: 'not_found' };

  const refused: string[] = [];
  for (const sheet of sheets) {
    if (!(await canDuplicate(actor, sheet))) refused.push(sheet.name);
  }
  if (refused.length) return { status: 'refused', refused };

  const [source] = await db.select().from(workbooks).where(eq(workbooks.id, workbookId));
  if (!source) return { status: 'not_found' };

  const workbook = await db.transaction(async (tx) => {
    const [wb] = await tx
      .insert(workbooks)
      .values({
        name: newName ?? `${source.name} (copy)`,
        description: source.description,
        createdBy: actor.sub,
      })
      .returning();
    const copies: Map[] = [];
    for (const sheet of sheets) {
      // Worksheets keep their names; the layout copy keeps their order.
      const copy = await duplicate(sheet.id, actor.sub, sheet.name, { workbookId: wb!.id, tx });
      if (!copy) throw new Error(`Worksheet ${sheet.id} vanished during the copy`);
      copies.push(copy);
    }
    return { ...wb!, maps: copies };
  });
  return { status: 'ok', workbook };
}

/**
 * Delete a workbook: soft-delete every worksheet the caller can see, the same
 * delete a single map gets. All-or-nothing, like `duplicateWorkbook` — if the
 * caller may not delete one sheet, nothing is deleted and that sheet is named.
 *
 * The workbook row itself goes only once no active worksheet is left in it.
 * Sheets the caller cannot see (D-020) stay where they are, still grouped.
 */
export async function deleteWorkbook(
  workbookId: string,
  actor: { sub: string; role: string },
): Promise<
  | { status: 'not_found' }
  | { status: 'refused'; refused: string[] }
  | { status: 'ok'; deleted: number }
> {
  const visible = await listAll(actor);
  const sheets = visible.filter((m) => m.workbookId === workbookId);
  if (sheets.length === 0) return { status: 'not_found' };

  const refused: string[] = [];
  for (const sheet of sheets) {
    if (!(await canAccessMap(actor, sheet, 'DELETE'))) refused.push(sheet.name);
  }
  if (refused.length) return { status: 'refused', refused };

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(maps)
      .set({ isActive: false, updatedAt: now })
      .where(inArray(maps.id, sheets.map((s) => s.id)));
    const [left] = await tx
      .select({ id: maps.id })
      .from(maps)
      .where(and(eq(maps.workbookId, workbookId), eq(maps.isActive, true)))
      .limit(1);
    if (!left) await tx.delete(workbooks).where(eq(workbooks.id, workbookId));
  });
  return { status: 'ok', deleted: sheets.length };
}

/** Narrowest first — see `listWorkbookShares`. */
const SHARE_ORDER = ['VIEW', 'EXPORT', 'EDIT'];

/** Remove one person's share from every worksheet of a workbook. */
export async function revokeWorkbookShare(
  workbookId: string,
  sharedWithUserId: string,
  actor: { sub: string; role: string },
): Promise<{ revoked: number }> {
  const visible = await listAll(actor);
  const sheets = visible.filter((m) => m.workbookId === workbookId);

  let revoked = 0;
  for (const sheet of sheets) {
    if (!(await canManageShares(actor, sheet))) continue;
    if (await revokeShare(sheet.id, sharedWithUserId)) revoked += 1;
  }
  return { revoked };
}
