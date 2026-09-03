import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  businessAreas,
  folderBusinessAreas,
  folders,
  userBusinessAreaGrants,
  users,
  type BusinessArea,
  type NewBusinessArea,
  type UserBusinessAreaGrant,
} from '../db/schema.js';
import { log as logAudit } from './audit.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionLevel =
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'EXPORT'
  | 'SCHEDULE'
  | 'VIEW';

export interface BusinessAreaWithGrants extends BusinessArea {
  grants: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string | null;
    permissionLevel: PermissionLevel;
    grantedBy: string | null;
    grantedAt: Date;
  }>;
}

export interface GrantWithUser extends UserBusinessAreaGrant {
  userEmail: string;
  userName: string | null;
}

// Permission hierarchy — higher index = more inclusive
const PERMISSION_HIERARCHY: PermissionLevel[] = [
  'VIEW',
  'EXPORT',
  'SCHEDULE',
  'CREATE',
  'EDIT',
  'DELETE',
];

function permissionSatisfies(
  held: PermissionLevel,
  required: PermissionLevel,
): boolean {
  const heldIdx = PERMISSION_HIERARCHY.indexOf(held);
  const requiredIdx = PERMISSION_HIERARCHY.indexOf(required);
  return heldIdx >= requiredIdx;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(
  data: {
    name: string;
    description?: string | null;
  },
  createdBy: string,
): Promise<BusinessArea> {
  const values: NewBusinessArea = {
    name: data.name,
    description: data.description ?? null,
    createdBy,
    updatedBy: createdBy,
  };

  const rows = await db.insert(businessAreas).values(values).returning();
  return rows[0]!;
}

export async function update(
  id: string,
  data: {
    name?: string;
    description?: string | null;
  },
): Promise<BusinessArea | null> {
  const values: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  const [row] = await db
    .update(businessAreas)
    .set(values)
    .where(eq(businessAreas.id, id))
    .returning();

  return row ?? null;
}

export async function getById(
  id: string,
  opts: { includeGrants?: boolean } = {},
): Promise<BusinessAreaWithGrants | null> {
  const [row] = await db
    .select()
    .from(businessAreas)
    .where(eq(businessAreas.id, id))
    .limit(1);

  if (!row) return null;

  if (opts.includeGrants) {
    const grants = await getBusinessAreaGrants(id);
    return { ...row, grants };
  }

  return { ...row, grants: [] };
}

export async function list(): Promise<BusinessArea[]> {
  const rows = await db
    .select()
    .from(businessAreas)
    .where(eq(businessAreas.isActive, true))
    .orderBy(businessAreas.name);
  return rows;
}

export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(businessAreas)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(businessAreas.id, id))
    .returning({ id: businessAreas.id });

  return !!row;
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

export async function grantAccess(
  businessAreaId: string,
  userId: string,
  permissionLevel: PermissionLevel,
  grantedBy: string,
): Promise<UserBusinessAreaGrant> {
  // Upsert — if the same (user, ba, permission) exists, update grantedBy/grantedAt.
  const rows = await db
    .insert(userBusinessAreaGrants)
    .values({
      userId,
      businessAreaId,
      permissionLevel,
      grantedBy,
    })
    .onConflictDoUpdate({
      target: [
        userBusinessAreaGrants.userId,
        userBusinessAreaGrants.businessAreaId,
        userBusinessAreaGrants.permissionLevel,
      ],
      set: {
        grantedBy,
        grantedAt: new Date(),
      },
    })
    .returning();

  return rows[0]!;
}

export async function revokeAccess(
  businessAreaId: string,
  userId: string,
): Promise<number> {
  const rows = await db
    .delete(userBusinessAreaGrants)
    .where(
      and(
        eq(userBusinessAreaGrants.businessAreaId, businessAreaId),
        eq(userBusinessAreaGrants.userId, userId),
      ),
    )
    .returning({ id: userBusinessAreaGrants.id });

  return rows.length;
}

export async function revokeSpecificPermission(
  businessAreaId: string,
  userId: string,
  permissionLevel: PermissionLevel,
): Promise<boolean> {
  const rows = await db
    .delete(userBusinessAreaGrants)
    .where(
      and(
        eq(userBusinessAreaGrants.businessAreaId, businessAreaId),
        eq(userBusinessAreaGrants.userId, userId),
        eq(userBusinessAreaGrants.permissionLevel, permissionLevel),
      ),
    )
    .returning({ id: userBusinessAreaGrants.id });

  return rows.length > 0;
}

export async function getUserGrants(
  userId: string,
): Promise<Array<UserBusinessAreaGrant & { businessAreaName: string }>> {
  const rows = await db
    .select({
      id: userBusinessAreaGrants.id,
      userId: userBusinessAreaGrants.userId,
      businessAreaId: userBusinessAreaGrants.businessAreaId,
      permissionLevel: userBusinessAreaGrants.permissionLevel,
      grantedBy: userBusinessAreaGrants.grantedBy,
      grantedAt: userBusinessAreaGrants.grantedAt,
      businessAreaName: businessAreas.name,
    })
    .from(userBusinessAreaGrants)
    .innerJoin(
      businessAreas,
      eq(userBusinessAreaGrants.businessAreaId, businessAreas.id),
    )
    .where(eq(userBusinessAreaGrants.userId, userId));

  return rows;
}

export async function getBusinessAreaUsers(
  businessAreaId: string,
): Promise<Array<{
  userId: string;
  email: string;
  name: string | null;
  permissions: PermissionLevel[];
}>> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      permissionLevel: userBusinessAreaGrants.permissionLevel,
    })
    .from(userBusinessAreaGrants)
    .innerJoin(users, eq(userBusinessAreaGrants.userId, users.id))
    .where(eq(userBusinessAreaGrants.businessAreaId, businessAreaId));

  // Group by user
  const userMap = new Map<
    string,
    { userId: string; email: string; name: string | null; permissions: PermissionLevel[] }
  >();

  for (const row of rows) {
    const existing = userMap.get(row.userId);
    if (existing) {
      existing.permissions.push(row.permissionLevel);
    } else {
      userMap.set(row.userId, {
        userId: row.userId,
        email: row.email,
        name: row.name,
        permissions: [row.permissionLevel],
      });
    }
  }

  return Array.from(userMap.values());
}

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

export async function userHasPermission(
  userId: string,
  businessAreaId: string,
  requiredLevel: PermissionLevel,
): Promise<{ hasPermission: boolean; heldLevel: PermissionLevel | null }> {
  const [grant] = await db
    .select()
    .from(userBusinessAreaGrants)
    .where(
      and(
        eq(userBusinessAreaGrants.userId, userId),
        eq(userBusinessAreaGrants.businessAreaId, businessAreaId),
      ),
    )
    .limit(1);

  if (!grant) {
    return { hasPermission: false, heldLevel: null };
  }

  return {
    hasPermission: permissionSatisfies(grant.permissionLevel, requiredLevel),
    heldLevel: grant.permissionLevel,
  };
}

export async function userHasAnyPermission(
  userId: string,
  businessAreaId: string,
): Promise<boolean> {
  const [grant] = await db
    .select({ id: userBusinessAreaGrants.id })
    .from(userBusinessAreaGrants)
    .where(
      and(
        eq(userBusinessAreaGrants.userId, userId),
        eq(userBusinessAreaGrants.businessAreaId, businessAreaId),
      ),
    )
    .limit(1);

  return !!grant;
}

export async function getUserPermissionLevels(
  userId: string,
  businessAreaId: string,
): Promise<PermissionLevel[]> {
  const rows = await db
    .select({ permissionLevel: userBusinessAreaGrants.permissionLevel })
    .from(userBusinessAreaGrants)
    .where(
      and(
        eq(userBusinessAreaGrants.userId, userId),
        eq(userBusinessAreaGrants.businessAreaId, businessAreaId),
      ),
    );

  return rows.map((r) => r.permissionLevel);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getBusinessAreaGrants(
  businessAreaId: string,
): Promise<BusinessAreaWithGrants['grants']> {
  const rows = await db
    .select({
      id: userBusinessAreaGrants.id,
      userId: userBusinessAreaGrants.userId,
      userEmail: users.email,
      userName: users.name,
      permissionLevel: userBusinessAreaGrants.permissionLevel,
      grantedBy: userBusinessAreaGrants.grantedBy,
      grantedAt: userBusinessAreaGrants.grantedAt,
    })
    .from(userBusinessAreaGrants)
    .innerJoin(users, eq(userBusinessAreaGrants.userId, users.id))
    .where(eq(userBusinessAreaGrants.businessAreaId, businessAreaId));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.userEmail,
    userName: r.userName,
    permissionLevel: r.permissionLevel,
    grantedBy: r.grantedBy,
    grantedAt: r.grantedAt,
  }));
}


// ---------------------------------------------------------------------------
// Folder entitlement — the second authorisation gate (D-016)
// ---------------------------------------------------------------------------

/**
 * The business areas each folder belongs to: its owning `business_area_id`
 * plus every business area it is shared into via `folder_business_areas`.
 *
 * Discoverer's `BA_OBJ_LINKS` is many-to-many and sharing a dimension folder
 * across business areas is ordinary practice, so "which business area grants
 * this folder" has never had a single answer.
 */
export async function businessAreasForFolders(
  folderIds: string[],
): Promise<globalThis.Map<string, string[]>> {
  const byFolder = new globalThis.Map<string, string[]>();
  const ids = [...new Set(folderIds)];
  if (ids.length === 0) return byFolder;

  const owning = await db
    .select({ id: folders.id, businessAreaId: folders.businessAreaId })
    .from(folders)
    .where(inArray(folders.id, ids));
  for (const row of owning) {
    byFolder.set(row.id, [row.businessAreaId]);
  }

  const shared = await db
    .select({
      folderId: folderBusinessAreas.folderId,
      businessAreaId: folderBusinessAreas.businessAreaId,
    })
    .from(folderBusinessAreas)
    .where(inArray(folderBusinessAreas.folderId, ids));
  for (const row of shared) {
    const list = byFolder.get(row.folderId);
    if (list && !list.includes(row.businessAreaId)) {
      list.push(row.businessAreaId);
    }
  }

  return byFolder;
}

export class DataEntitlementError extends Error {
  constructor(
    message: string,
    public folderName: string,
  ) {
    super(message);
    this.name = 'DataEntitlementError';
  }
}

/**
 * The DATA gate: may this user read the rows these folders hold?
 *
 * Deliberately separate from `canAccessMap`, which answers a different
 * question — may this user see this map *object*. `canAccessMap` has five
 * grant paths and four of them (admin, owner, public, explicit share) return
 * before any business-area check, so bolting the folder rule onto its last
 * branch would leave map sharing as business-area grant escalation: I own a
 * map over folders in a business area you were never granted, I share it with
 * you, and you read the data.
 *
 * So this runs unconditionally after it, on every execute and export path.
 *
 * All-of across folders: every folder the query touches must be entitled.
 * Any-of within one folder: a grant on ANY business area the folder belongs to
 * entitles it, because sharing a folder into a business area is what grants
 * that area's members access to it — requiring a grant on all of them would
 * mean sharing a folder silently revoked access from everyone already using it.
 *
 * Admins bypass, as they do at every other grant check in this codebase; the
 * bypass is recorded in the audit log rather than being silent.
 */
export async function assertDataEntitlement(
  userId: string,
  folderIds: string[],
): Promise<void> {
  const ids = [...new Set(folderIds)];
  if (ids.length === 0) return;

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new DataEntitlementError(
      'Executing user not found — refusing to read data',
      '',
    );
  }

  const baByFolder = await businessAreasForFolders(ids);
  const grants = await db
    .select({ businessAreaId: userBusinessAreaGrants.businessAreaId })
    .from(userBusinessAreaGrants)
    .where(eq(userBusinessAreaGrants.userId, userId));
  const granted = new Set(grants.map((g) => g.businessAreaId));

  const ungranted = ids.filter(
    (folderId) =>
      !(baByFolder.get(folderId) ?? []).some((ba) => granted.has(ba)),
  );
  if (ungranted.length === 0) return;

  if (user.role === 'ADMIN') {
    // The bypass is deliberate, and only reached when the admin genuinely
    // holds no grant — so the audit log records real bypasses, not every
    // query an admin runs.
    await logAdminBypass(userId, ungranted);
    return;
  }

  const [folder] = await db
    .select({ name: folders.name })
    .from(folders)
    .where(eq(folders.id, ungranted[0]!))
    .limit(1);
  const name = folder?.name ?? ungranted[0]!;
  throw new DataEntitlementError(
    `You do not have access to the data in folder "${name}"`,
    name,
  );
}

/**
 * Record that an admin read data without a business-area grant. The bypass is
 * deliberate; leaving no trace of it would not be.
 */
async function logAdminBypass(
  userId: string,
  folderIds: string[],
): Promise<void> {
  try {
    await logAudit({
      userId,
      action: 'DATA_ENTITLEMENT_ADMIN_BYPASS',
      entityType: 'FOLDER',
      entityId: folderIds[0] ?? null,
      details: { folderCount: folderIds.length, folderIds },
    });
  } catch {
    // An audit write must never block a read the user is entitled to make.
  }
}
