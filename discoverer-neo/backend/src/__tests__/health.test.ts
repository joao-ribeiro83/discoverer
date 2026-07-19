/**
 * Health-check route tests. Both mount points share one handler; hitting each
 * confirms the Postgres + Redis probes report "connected" against the live
 * services in this environment.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('health routes', () => {
  for (const path of ['/health', '/api/health']) {
    it(`GET ${path} reports service status`, async () => {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBeTruthy();
      expect(typeof body.uptime).toBe('number');
      // Postgres and Redis are both up in this environment.
      expect(body.database).toBe('connected');
      expect(body.redis).toBe('connected');
      expect(body.timestamp).toBeTruthy();
    });
  }
});
