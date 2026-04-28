/**
 * Postgres connection (postgres-js) for Drizzle ORM.
 * Lazy-loaded so the backend boots even if SCALINGO_POSTGRES is not yet set
 * (e.g. for modules that haven't been migrated to DB-storage yet).
 */

import postgres, { type Sql } from 'postgres';

let _sql: Sql | null = null;

/**
 * Returns the lazy-initialized postgres client. Throws if `SCALINGO_POSTGRES`
 * is missing — only call this from code paths that actually need the DB.
 */
export function getSql(): Sql {
  if (_sql) return _sql;
  const connStr = process.env.SCALINGO_POSTGRES;
  if (!connStr) {
    throw new Error(
      'SCALINGO_POSTGRES env not set — cannot initialize Postgres client. ' +
        'Set the connection string in backend/.env or in your hosting environment.',
    );
  }
  _sql = postgres(connStr, {
    max: 10,
    ssl: 'require',
    prepare: false,
  });
  return _sql;
}

/**
 * Test-only: close the client. Not used at runtime, useful for clean shutdown
 * in scripts and integration tests.
 */
export async function closeSql(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}
