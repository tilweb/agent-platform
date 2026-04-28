import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from 'drizzle-kit';

/**
 * Load backend/.env without adding a dotenv dependency. drizzle-kit runs via
 * Node (not Bun), so Bun's automatic .env-loading doesn't apply here.
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(import.meta.dir ?? __dirname, 'backend/.env'));

const url = process.env.SCALINGO_POSTGRES;
if (!url) {
  throw new Error(
    'SCALINGO_POSTGRES not set — please add it to backend/.env or your shell environment.',
  );
}

export default {
  schema: './backend/src/db/schema/*',
  out: './backend/drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
