/**
 * Health-check route tests. /health (+ /api/health) is readiness — it must
 * go red (503) when a dependency is down (INF-02) — and /live (+ /api/live)
 * is liveness, which never checks dependencies. Both mount-point pairs share
 * one handler each.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('readiness (/health, /api/health)', () => {
  for (const path of ['/health', '/api/health']) {
    it(`GET ${path} reports 200 when Postgres and Redis are reachable`, async () => {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBeTruthy();
      expect(typeof body.uptime).toBe('number');
      expect(body.database).toBe('connected');
      expect(body.redis).toBe('connected');
      expect(body.timestamp).toBeTruthy();
    });

    it(`GET ${path} reports 503 when Postgres is unreachable`, async () => {
      const spy = jest.spyOn(db, 'execute').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('disconnected');
      spy.mockRestore();
    });

    it(`GET ${path} reports 503 when Redis is unreachable`, async () => {
      const spy = jest.spyOn(app.redis, 'ping').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.redis).toBe('disconnected');
      spy.mockRestore();
    });
  }
});

describe('liveness (/live, /api/live)', () => {
  for (const path of ['/live', '/api/live']) {
    it(`GET ${path} reports 200 with no dependency checks`, async () => {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok', uptime: expect.any(Number) });
    });

    it(`GET ${path} stays 200 when Postgres is unreachable`, async () => {
      const spy = jest.spyOn(db, 'execute').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      spy.mockRestore();
    });
  }
});
