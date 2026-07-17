import type { FastifyReply, FastifyRequest } from 'fastify';

const ROLES = ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

/**
 * Fastify preHandler that checks the user's role.
 * Must be used after the `authenticate` preHandler.
 *
 * Usage:
 *   { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] }
 */
export function authorize(...allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(user.role as Role)) {
      reply.code(403).send({
        error: 'Forbidden',
        details: `Requires one of roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }
  };
}

/** Shortcut for admin-only routes. */
export const authorizeAdmin = authorize('ADMIN');
