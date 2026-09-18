import { and, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import {
  generateTemporaryPassword,
  type ProvisionedCredential,
} from './credential-file.service.js';
import { db } from '../db/index.js';
import { users, type User } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

export type SafeUser = Omit<User, 'passwordHash'>;

function toSafe(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function list(): Promise<SafeUser[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map(toSafe);
}

export async function getById(id: string): Promise<SafeUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toSafe(row) : null;
}

export async function getByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

/**
 * The account behind a session, read fresh — or null when it may no longer
 * hold one: deleted, deactivated, or a database role (which never logs in).
 *
 * Called on every authenticated request and every refresh, so role and status
 * always come from `users`, never from the token.
 */
export async function getSessionUser(id: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      isActive: users.isActive,
      isRole: users.isRole,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row && row.isActive && !row.isRole ? row : null;
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

/**
 * Search users by name/email substring for use in non-admin flows (e.g. the
 * map-sharing picker). Deliberately returns a minimal field set — no role,
 * no timestamps — since any authenticated user can call this, unlike
 * `list()`/`getById()` which are admin-only.
 */
export async function search(
  query: string,
  excludeUserId: string,
  limit = 20,
): Promise<UserSearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const pattern = `%${term}%`;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        ne(users.id, excludeUserId),
        or(ilike(users.name, pattern), ilike(users.email, pattern)),
      ),
    )
    .orderBy(users.name)
    .limit(limit);

  return rows;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
}

export async function create(data: CreateUserInput): Promise<SafeUser> {
  const passwordHash = await hashPassword(data.password);
  const [row] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role ?? 'USER',
    })
    .returning();
  return toSafe(row!);
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
  isActive?: boolean;
}

export async function update(id: string, data: UpdateUserInput): Promise<SafeUser | null> {
  const { password, ...rest } = data;
  const values: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (password) {
    values.passwordHash = await hashPassword(password);
  }

  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return row ? toSafe(row) : null;
}

/**
 * Issue a fresh temporary password to each named account and force a change
 * at next login.
 *
 * This is how an operator recovers from the one-way step in a migration: the
 * passwords it generated were hashed on the way in and written to a
 * credentials file that is deleted on a timer, so once that file is gone
 * nobody can hand a migrated user their password — the only way back is to
 * issue a new one. A database role is skipped: it holds grants and can never
 * sign in, so a credential for it would be a credential nobody should use.
 *
 * Returns plaintext. The caller hands it straight to the administrator who
 * asked; nothing here logs it or stores it anywhere but the hash column.
 */
export async function issueTemporaryPasswords(
  userIds: string[],
): Promise<ProvisionedCredential[]> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return [];

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, isRole: users.isRole })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.isRole, false)));

  const issued: ProvisionedCredential[] = [];
  for (const row of rows) {
    const temporaryPassword = generateTemporaryPassword();
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.id));
    issued.push({
      username: row.name ?? row.email,
      email: row.email,
      temporaryPassword,
    });
  }
  return issued;
}

export async function remove(id: string): Promise<boolean> {
  const [row] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return !!row;
}
