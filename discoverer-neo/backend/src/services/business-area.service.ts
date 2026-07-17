import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  businessAreas,
  userBusinessAreaGrants,
  users,
  type BusinessArea,
  type NewBusinessArea,
  type UserBusinessAreaGrant,
} from '../db/schema.js';

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
