/**
 * Run pending Drizzle migrations on startup. Idempotent — Drizzle tracks
 * applied migrations in `drizzle.__drizzle_migrations`. No-op if there are
 * no new migrations or if SCALINGO_POSTGRES is not configured (dev without DB).
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getSql } from './client';

export async function runMigrations(): Promise<void> {
  if (!process.env.SCALINGO_POSTGRES) {
    console.log('[db] SCALINGO_POSTGRES not set — skipping migrations.');
    return;
  }

  // The compiled image has CWD=/app/backend; migrations live at /app/backend/drizzle.
  // Locally we may be at the repo root; check both spots.
  const candidates = [
    resolve(process.cwd(), 'drizzle'),
    resolve(process.cwd(), 'backend/drizzle'),
  ];
  const migrationsFolder = candidates.find(existsSync);
  if (!migrationsFolder) {
    console.warn('[db] migrations folder not found (looked at', candidates, ') — skipping.');
    return;
  }

  const started = Date.now();
  // Local dev frequently runs against a Postgres that is only reachable
  // from the Scalingo container — abort migrations after 10s instead of
  // blocking the whole server boot.
  const TIMEOUT_MS = Number(process.env.DB_MIGRATE_TIMEOUT_MS) || 10_000;
  try {
    const db = drizzle(getSql());
    await Promise.race([
      migrate(db, { migrationsFolder }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`migration timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
      ),
    ]);
    console.log(`[db] migrations applied in ${Date.now() - started}ms (folder: ${migrationsFolder})`);
  } catch (err) {
    console.warn('[db] migration skipped/failed (server will still start):', err instanceof Error ? err.message : err);
  }
}
