import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

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
