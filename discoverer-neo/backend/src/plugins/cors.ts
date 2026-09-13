import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

// ---------------------------------------------------------------------------
// CORS (INF-13).
//
// `origin: true` reflects whatever `Origin` header the caller sends. Combined
// with `credentials: true`, that lets any site ride a logged-in user's
// cookies — the allowlist is the fix, not a hardening extra. Credentials
// require an exact origin match, so there is no wildcard mode here.
// ---------------------------------------------------------------------------

const allowedOrigins = new Set(config.CORS_ALLOWED_ORIGINS);

/** Exact match against the configured allowlist. No Origin header (curl, same-origin, server-to-server) is not a browser cross-origin call and is always allowed. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.has(origin);
}

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyCors, {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin "${origin}" is not allowed`), false);
    },
    credentials: true,
  });
}, { name: 'cors' });
