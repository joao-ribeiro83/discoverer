import { eq } from 'drizzle-orm';
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

export async function remove(id: string): Promise<boolean> {
  const [row] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return !!row;
}
