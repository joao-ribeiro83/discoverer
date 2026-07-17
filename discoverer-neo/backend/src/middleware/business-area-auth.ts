import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { folders, hierarchies, items, joins } from '../db/schema.js';
import {
  userHasPermission,
  userHasAnyPermission,
  getUserPermissionLevels,
} from '../services/business-area.service.js';

// Permission hierarchy — must match the service
const PERMISSION_HIERARCHY = [
  'VIEW',
  'EXPORT',
  'SCHEDULE',
  'CREATE',
  'EDIT',
  'DELETE',
] as const;

export type PermissionLevel = (typeof PERMISSION_HIERARCHY)[number];

declare module 'fastify' {
  interface FastifyInstance {
    requireBusinessAreaAccess: (
      permissionLevel: PermissionLevel,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Factory: returns a preHandler that checks whether the authenticated user
 * has the required permission level for the business area identified by
 * the `:id` route param.
 *
 * Admins bypass all checks.
 *
 * Usage:
 *   fastify.get(
 *     '/api/business-areas/:id',
 *     { preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('VIEW')] },
 *     handler,
 *   )
 */
export function requireBusinessAreaAccess(permissionLevel: PermissionLevel) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Admins bypass all permission checks.
    if (user.role === 'ADMIN') {
      return;
    }

    // Extract business area ID from route params. Routes may use either
    // `:id` (business-areas routes) or `:baId` (nested resources).
    const params = request.params as Record<string, string>;
    const businessAreaId = params?.id ?? params?.baId;

    if (!businessAreaId) {
      return reply.code(400).send({
        error: 'Business area ID is required in route params',
      });
    }

    const { hasPermission } = await userHasPermission(
      user.sub,
      businessAreaId,
      permissionLevel,
    );

    if (!hasPermission) {
      return reply.code(403).send({
        error: 'Forbidden',
        details: `Requires "${permissionLevel}" permission for this business area`,
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Entity-scoped variants
//
// Grants are stored per business area, but many routes are keyed by a child
// entity (folder, item, join, hierarchy). These variants resolve the owning
// business area from the entity ID in the route params, then run the same
// grant check as `requireBusinessAreaAccess`.
// ---------------------------------------------------------------------------

interface OwnedEntity {
  /** Human-readable name used in error messages, e.g. 'Folder'. */
  label: string;
  /** Route params that may carry the entity ID, checked in order. */
  paramNames: string[];
  /** Resolve the owning business area ID, or null if the entity does not exist. */
  resolveBusinessAreaId: (entityId: string) => Promise<string | null>;
}

async function folderBusinessAreaId(folderId: string): Promise<string | null> {
  const [row] = await db
    .select({ businessAreaId: folders.businessAreaId })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);
  return row?.businessAreaId ?? null;
}

async function itemBusinessAreaId(itemId: string): Promise<string | null> {
  const [row] = await db
    .select({ businessAreaId: folders.businessAreaId })
    .from(items)
    .innerJoin(folders, eq(items.folderId, folders.id))
    .where(eq(items.id, itemId))
    .limit(1);
  return row?.businessAreaId ?? null;
}

// Joins do not reference a business area directly; both sides are validated
// to live in the same business area on create/update, so the left folder
// determines the owner.
async function joinBusinessAreaId(joinId: string): Promise<string | null> {
  const [row] = await db
    .select({ businessAreaId: folders.businessAreaId })
    .from(joins)
    .innerJoin(folders, eq(joins.leftFolderId, folders.id))
    .where(eq(joins.id, joinId))
    .limit(1);
  return row?.businessAreaId ?? null;
}

async function hierarchyBusinessAreaId(hierarchyId: string): Promise<string | null> {
  const [row] = await db
    .select({ businessAreaId: hierarchies.businessAreaId })
    .from(hierarchies)
    .where(eq(hierarchies.id, hierarchyId))
    .limit(1);
  return row?.businessAreaId ?? null;
}

function requireOwnedEntityAccess(
  entity: OwnedEntity,
  permissionLevel: PermissionLevel,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Admins bypass all permission checks.
    if (user.role === 'ADMIN') {
      return;
    }

    const params = request.params as Record<string, string>;
    const entityId = entity.paramNames
      .map((name) => params?.[name])
      .find((value) => !!value);

    if (!entityId) {
      return reply.code(400).send({
        error: `${entity.label} ID is required in route params`,
      });
    }

    const businessAreaId = await entity.resolveBusinessAreaId(entityId);

    if (!businessAreaId) {
      return reply.code(404).send({ error: `${entity.label} not found` });
    }

    const { hasPermission } = await userHasPermission(
      user.sub,
      businessAreaId,
      permissionLevel,
    );

    if (!hasPermission) {
      return reply.code(403).send({
        error: 'Forbidden',
        details: `Requires "${permissionLevel}" permission for this business area`,
      });
    }
  };
}

/** Grant check for routes keyed by a folder ID (`:folderId` or `:id`). */
export function requireFolderAccess(permissionLevel: PermissionLevel) {
  return requireOwnedEntityAccess(
    {
      label: 'Folder',
      paramNames: ['folderId', 'id'],
      resolveBusinessAreaId: folderBusinessAreaId,
    },
    permissionLevel,
  );
}

/** Grant check for routes keyed by an item ID (`:itemId` or `:id`). */
export function requireItemAccess(permissionLevel: PermissionLevel) {
  return requireOwnedEntityAccess(
    {
      label: 'Item',
      paramNames: ['itemId', 'id'],
      resolveBusinessAreaId: itemBusinessAreaId,
    },
    permissionLevel,
  );
}

/** Grant check for routes keyed by a join ID (`:joinId` or `:id`). */
export function requireJoinAccess(permissionLevel: PermissionLevel) {
  return requireOwnedEntityAccess(
    {
      label: 'Join',
      paramNames: ['joinId', 'id'],
      resolveBusinessAreaId: joinBusinessAreaId,
    },
    permissionLevel,
  );
}

/** Grant check for routes keyed by a hierarchy ID (`:hierarchyId` or `:id`). */
export function requireHierarchyAccess(permissionLevel: PermissionLevel) {
  return requireOwnedEntityAccess(
    {
      label: 'Hierarchy',
      paramNames: ['hierarchyId', 'id'],
      resolveBusinessAreaId: hierarchyBusinessAreaId,
    },
    permissionLevel,
  );
}

/**
 * Lighter check — only verifies the user has *any* grant on the business
 * area (regardless of level). Useful for listing endpoints.
 */
export function requireBusinessAreaMembership() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (user.role === 'ADMIN') {
      return;
    }

    const params = request.params as Record<string, string>;
    const businessAreaId = params?.id ?? params?.baId;

    if (!businessAreaId) {
      return reply.code(400).send({
        error: 'Business area ID is required in route params',
      });
    }

    const isMember = await userHasAnyPermission(user.sub, businessAreaId);

    if (!isMember) {
      return reply.code(403).send({
        error: 'Forbidden',
        details: 'You do not have access to this business area',
      });
    }
  };
}

/**
 * Attach the user's permission levels for the business area onto
 * `request.businessAreaPermissions` so downstream handlers can make
 * fine-grained decisions (e.g., show/hide action buttons).
 */
export async function attachBusinessAreaPermissions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.user;
  if (!user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const params = request.params as Record<string, string>;
  const businessAreaId = params?.id ?? params?.baId;

  if (!businessAreaId) {
    return;
  }

  const levels = await getUserPermissionLevels(user.sub, businessAreaId);
  (request as FastifyRequest & { businessAreaPermissions?: PermissionLevel[] }).businessAreaPermissions = levels;
}
