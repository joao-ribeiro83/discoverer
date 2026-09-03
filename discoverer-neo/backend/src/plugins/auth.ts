import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      ...roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorizeAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

/**
 * The only routes an account with a pending password change may reach.
 *
 * Kept minimal on purpose: changing the password, reading who you are (the
 * client needs it to render the change screen), and logging out.
 */
const PASSWORD_CHANGE_EXEMPT_ROUTES = new Set<string>([
  '/api/auth/change-password',
  '/api/auth/me',
  '/api/auth/logout',
]);

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export default fp(
  async (fastify) => {
    fastify.register(fastifyJwt, {
      secret: config.JWT_SECRET,
      sign: { expiresIn: config.JWT_EXPIRES_IN },
    });

    // Check if a token is blacklisted in Redis
    async function isTokenBlacklisted(
      request: FastifyRequest,
    ): Promise<boolean> {
      const authHeader = request.headers.authorization;
      if (!authHeader) return false;

      const token = authHeader.replace('Bearer ', '');
      const result = await fastify.redis.get(`token:blacklist:${token}`);
      return result !== null;
    }

    // preHandler: verify JWT and check blacklist
    fastify.decorate(
      'authenticate',
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();

          // Check if token has been blacklisted (logged out)
          if (await isTokenBlacklisted(request)) {
            reply.code(401).send({ error: 'Token has been revoked' });
            return;
          }
        } catch {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }

        // An account provisioned with a temporary password may do exactly one
        // thing: change that password. Enforced HERE rather than in the UI —
        // the API is reachable directly, so a front-end-only prompt would be
        // decoration, not a control.
        //
        // The flag is read from the database, not the JWT: a token minted
        // before the change would otherwise keep asserting the stale value
        // until it expired.
        if (!PASSWORD_CHANGE_EXEMPT_ROUTES.has(request.routeOptions.url ?? '')) {
          const [row] = await db
            .select({ mustChangePassword: users.mustChangePassword })
            .from(users)
            .where(eq(users.id, request.user.sub))
            .limit(1);

          if (row?.mustChangePassword) {
            reply.code(403).send({
              error: 'Password change required',
              // A stable code so the client can route to the change screen
              // instead of pattern-matching on prose.
              code: 'PASSWORD_CHANGE_REQUIRED',
            });
            return;
          }
        }
      },
    );

    // Decorator: role-based authorization factory
    fastify.decorate('authorize', (...roles: string[]) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;

        if (!user) {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }

        if (roles.length > 0 && !roles.includes(user.role)) {
          reply.code(403).send({
            error: 'Forbidden',
            details: `Requires one of roles: ${roles.join(', ')}`,
          });
          return;
        }
      };
    });

    // Shortcut: admin-only
    fastify.decorate(
      'authorizeAdmin',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;

        if (!user) {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }

        if (user.role !== 'ADMIN') {
          reply.code(403).send({
            error: 'Forbidden',
            details: 'Requires ADMIN role',
          });
          return;
        }
      },
    );
  },
  { name: 'auth', dependencies: ['redis'] },
);
