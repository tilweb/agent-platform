/**
 * API-Key storage — Postgres-backed (Drizzle).
 *
 * Frueher YAML-Files mit Prefix-Lookup-Index. Jetzt nutzt der DB-Index
 * (`api_keys_prefix_idx`) das gleiche O(1)-Lookup-Verhalten — der
 * In-Memory-Index ist nicht mehr noetig. Die Schnittstelle bleibt stabil.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { apiKeys as apiKeysTable } from '../../db/schema/auth';
import type { ApiKey } from '../types';

function rowToKey(row: typeof apiKeysTable.$inferSelect): ApiKey {
  return {
    id: row.id,
    label: row.label,
    hashedKey: row.hashedKey,
    prefix: row.prefix,
    scope: row.scope as ApiKey['scope'],
    permissions: row.permissions as ApiKey['permissions'],
    rateLimit: row.rateLimit as ApiKey['rateLimit'],
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    revokedAt: row.revokedAt,
  };
}

/**
 * Beibehalten fuer API-Kompatibilitaet — bei DB-Storage ein No-op,
 * weil der Postgres-Index immer aktuell ist.
 */
export function invalidateIndex(): void {
  /* no-op — DB index is authoritative */
}

export async function saveKey(key: ApiKey): Promise<void> {
  const db = getDb();
  const row = {
    id: key.id,
    label: key.label,
    hashedKey: key.hashedKey,
    prefix: key.prefix,
    scope: key.scope as never,
    permissions: key.permissions as never,
    rateLimit: key.rateLimit as never,
    createdAt: key.createdAt,
    createdBy: key.createdBy,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    isActive: key.isActive,
    revokedAt: key.revokedAt,
  };
  await db.insert(apiKeysTable).values(row).onConflictDoUpdate({
    target: apiKeysTable.id,
    set: {
      label: row.label,
      hashedKey: row.hashedKey,
      prefix: row.prefix,
      scope: row.scope,
      permissions: row.permissions,
      rateLimit: row.rateLimit,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      isActive: row.isActive,
      revokedAt: row.revokedAt,
    },
  });
}

export async function loadKeyById(id: string): Promise<ApiKey | null> {
  const db = getDb();
  const rows = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)).limit(1);
  return rows[0] ? rowToKey(rows[0]) : null;
}

export async function loadKeyByPrefix(prefix: string): Promise<ApiKey | null> {
  const db = getDb();
  const rows = await db.select().from(apiKeysTable).where(eq(apiKeysTable.prefix, prefix)).limit(1);
  return rows[0] ? rowToKey(rows[0]) : null;
}

export async function listKeys(): Promise<ApiKey[]> {
  const db = getDb();
  const rows = await db.select().from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
  return rows.map(rowToKey);
}
