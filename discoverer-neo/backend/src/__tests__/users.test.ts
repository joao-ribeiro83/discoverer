import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

let app: FastifyInstance;

const TEST_PASSWORD = 'SecurePass123!';
const SEARCHER_EMAIL = 'users-search-me@example.com';
const MATCH_EMAIL = 'users-search-match@example.com';
const OTHER_EMAIL = 'users-search-noise@example.com';

let searcherToken: string;
let matchUserId: string;

async function createTestUser(email: string, name: string) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, role: 'USER' })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  return res.json().data.token as string;
}

async function cleanupTestData() {
  for (const email of [SEARCHER_EMAIL, MATCH_EMAIL, OTHER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await cleanupTestData();

  await createTestUser(SEARCHER_EMAIL, 'Searching Sam');
  const match = await createTestUser(MATCH_EMAIL, 'Findable Fiona');
  await createTestUser(OTHER_EMAIL, 'Unrelated Una');

  matchUserId = match.id;
  searcherToken = await login(SEARCHER_EMAIL);
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

describe('GET /api/users/search', () => {
  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=findable',
    });
    expect(res.statusCode).toBe(401);
  });

  it('is available to a non-admin user (unlike GET /api/users)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=findable',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.some((u: { id: string }) => u.id === matchUserId)).toBe(true);
  });

  it('matches by email substring too', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=search-match',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.some((u: { id: string }) => u.id === matchUserId)).toBe(true);
  });

  it('excludes the requesting user from their own results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=searching',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.every((u: { id: string }) => u.id !== undefined)).toBe(true);
    expect(data.some((u: { email: string }) => u.email === SEARCHER_EMAIL)).toBe(false);
  });

  it('returns only id/name/email, never a password hash or role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=fiona',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    const { data } = res.json();
    const hit = data.find((u: { id: string }) => u.id === matchUserId);
    expect(hit).toBeDefined();
    expect(Object.keys(hit).sort()).toEqual(['email', 'id', 'name']);
  });

  it('returns an empty array for a blank query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});
