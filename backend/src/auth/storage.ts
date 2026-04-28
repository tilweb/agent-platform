/**
 * User Storage — Postgres-backed (Drizzle).
 *
 * Phase 2: ersetzt das frühere YAML-File-basierte Storage 1:1.
 * Schnittstelle bleibt stabil, damit Routes/Middleware nichts merken.
 */

import { eq, sql as rawSql } from 'drizzle-orm';
import { getDb } from '../db';
import { users as usersTable } from '../db/schema/auth';
import { hashPassword } from './password';
import type { User, CreateUserInput } from './types';

/**
 * Generate a unique user ID — gleiches Format wie bisher (`user_<ts>_<rand>`),
 * damit alte Referenzen / Pfade weiterhin gültig sind.
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function rowToUser(row: typeof usersTable.$inferSelect): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? undefined,
    displayName: row.displayName ?? undefined,
    passwordHash: row.passwordHash,
    role: (row.role as User['role']) ?? 'user',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isActive: row.isActive,
    preferences: (row.preferences ?? undefined) as User['preferences'],
  };
}

export async function saveUser(user: User): Promise<void> {
  const db = getDb();
  const row = {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    passwordHash: user.passwordHash,
    role: user.role ?? 'user',
    isActive: user.isActive,
    preferences: (user.preferences ?? null) as never,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  await db.insert(usersTable).values(row).onConflictDoUpdate({
    target: usersTable.id,
    set: {
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      passwordHash: row.passwordHash,
      role: row.role,
      isActive: row.isActive,
      preferences: row.preferences,
      updatedAt: row.updatedAt,
    },
  });
}

export async function loadUser(userId: string): Promise<User | null> {
  const db = getDb();
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(rawSql`lower(${usersTable.username}) = ${username.toLowerCase()}`)
    .limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(rawSql`lower(${usersTable.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function createUser(
  input: CreateUserInput & { role?: 'admin' | 'user' },
): Promise<User> {
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  // First user becomes admin (genau wie im YAML-Pfad).
  const isFirstUser = !(await hasUsers());
  const role = input.role || (isFirstUser ? 'admin' : 'user');

  const user: User = {
    id: generateUserId(),
    username: input.username,
    email: input.email,
    displayName: input.displayName || input.username,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  await saveUser(user);
  return user;
}

export async function updateUser(
  userId: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>,
): Promise<User | null> {
  const existing = await loadUser(userId);
  if (!existing) return null;
  const merged: User = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveUser(merged);
  return merged;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning({ id: usersTable.id });
  return res.length > 0;
}

export async function listUsers(): Promise<User[]> {
  const db = getDb();
  const rows = await db.select().from(usersTable);
  return rows.map(rowToUser);
}

export async function hasUsers(): Promise<boolean> {
  const db = getDb();
  const rows = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  return rows.length > 0;
}
