import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLog, users } from '../db/schema.js';

/**
 * Audit log writes and reads. `log()` is the single insertion point — called
 * by `plugins/audit.ts` for every mutating request, and available for
 * explicit calls (e.g. auth routes that want a specific action name rather
 * than the generic method+route the plugin derives).
 */

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
}

export async function log(entry: AuditLogInput): Promise<void> {
  await db.insert(auditLog).values({
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

const rowSelection = {
  id: auditLog.id,
  userId: auditLog.userId,
  userName: users.name,
  userEmail: users.email,
  action: auditLog.action,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  details: auditLog.details,
  ipAddress: auditLog.ipAddress,
  createdAt: auditLog.createdAt,
};

export interface AuditQueryFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  data: AuditLogRow[];
  total: number;
}

const MAX_PAGE_SIZE = 200;

function buildFilters(filters: {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const conditions = [
    filters.userId ? eq(auditLog.userId, filters.userId) : undefined,
    filters.action ? eq(auditLog.action, filters.action) : undefined,
    filters.entityType ? eq(auditLog.entityType, filters.entityType) : undefined,
    filters.dateFrom ? gte(auditLog.createdAt, filters.dateFrom) : undefined,
    filters.dateTo ? lte(auditLog.createdAt, filters.dateTo) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), MAX_PAGE_SIZE);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = buildFilters(filters);

  const [data, totalRows] = await Promise.all([
    db
      .select(rowSelection)
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditLog).where(where),
  ]);

  return { data, total: totalRows[0]?.value ?? 0 };
}

export async function getEntityHistory(
  entityType: string,
  entityId: string,
): Promise<AuditLogRow[]> {
  return db
    .select(rowSelection)
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt));
}

export async function getUserActivity(
  userId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  return db
    .select(rowSelection)
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), MAX_PAGE_SIZE));
}

export interface AuditStats {
  totalActions: number;
  byDay: { date: string; count: number }[];
  byUser: { userId: string | null; userName: string | null; count: number }[];
  byActionType: { action: string; count: number }[];
}

export async function getStats(dateFrom?: Date, dateTo?: Date): Promise<AuditStats> {
  const where = buildFilters({ dateFrom, dateTo });
  const dayExpr = sql<string>`to_char(${auditLog.createdAt}, 'YYYY-MM-DD')`;

  const [totalRows, byDayRows, byUserRows, byActionRows] = await Promise.all([
    db.select({ value: count() }).from(auditLog).where(where),
    db
      .select({ date: dayExpr, value: count() })
      .from(auditLog)
      .where(where)
      .groupBy(dayExpr)
      .orderBy(dayExpr),
    db
      .select({ userId: auditLog.userId, userName: users.name, value: count() })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(where)
      .groupBy(auditLog.userId, users.name)
      .orderBy(desc(count()))
      .limit(20),
    db
      .select({ action: auditLog.action, value: count() })
      .from(auditLog)
      .where(where)
      .groupBy(auditLog.action)
      .orderBy(desc(count())),
  ]);

  return {
    totalActions: totalRows[0]?.value ?? 0,
    byDay: byDayRows.map((r) => ({ date: r.date, count: r.value })),
    byUser: byUserRows.map((r) => ({ userId: r.userId, userName: r.userName, count: r.value })),
    byActionType: byActionRows.map((r) => ({ action: r.action, count: r.value })),
  };
}
