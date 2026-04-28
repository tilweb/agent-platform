/**
 * Drizzle ORM entrypoint.
 * Re-exports the typed db handle and all schema definitions.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { getSql } from './client';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazy-initialised Drizzle handle. Call `getDb()` instead of importing a
 * top-level singleton, so modules that don't touch the DB don't trigger
 * the postgres connection on import.
 */
export function getDb() {
  if (_db) return _db;
  _db = drizzle(getSql(), { schema });
  return _db;
}

export { schema };
export type DB = ReturnType<typeof getDb>;
