import { inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workbooks, mapLayouts, type Map } from '../db/schema.js';
import { listAll } from './map.service.js';

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
