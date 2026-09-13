/**
 * CORS allowlist (INF-13). `@fastify/cors` used to reflect any `Origin` with
 * `credentials: true` — any site could ride a logged-in user's cookies. Now
 * only origins in CORS_ALLOWED_ORIGINS (config.ts default includes the two
 * dev frontend ports) get the credentialed response.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('CORS', () => {
  it('reflects an allowlisted origin with credentials enabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects an unlisted origin with credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
