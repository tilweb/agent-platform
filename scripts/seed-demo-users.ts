/**
 * Seed Demo Users — Postgres-backed (Drizzle).
 *
 * Idempotent: skips users that already exist. Wird im Docker-Container beim
 * Start aufgerufen (siehe Dockerfile + initialize() in src/index.ts) und
 * kann auch lokal manuell laufen via:
 *
 *   /Users/andreasbachmann/.bun/bin/bun run scripts/seed-demo-users.ts
 *
 * Voraussetzung: SCALINGO_POSTGRES gesetzt + Drizzle-Migration appliziert.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Wenn als Script aufgerufen: backend/.env mitladen, damit DB-Connection geht.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvFile(join(import.meta.dir, '../backend/.env'));

import { findUserByUsername, createUser } from '../backend/src/auth/storage';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const MARKETING_PASSWORD = process.env.MARKETING_PASSWORD || 'Marketing2026!';

const DEMO_USERS: Array<{ username: string; displayName: string; password: string; role?: 'admin' | 'user' }> = [
  { username: 'demo1', displayName: 'Demo User 1', password: DEMO_PASSWORD, role: 'admin' },
  { username: 'demo2', displayName: 'Demo User 2', password: DEMO_PASSWORD },
  { username: 'demo3', displayName: 'Demo User 3', password: DEMO_PASSWORD },
  { username: 'demo4', displayName: 'Demo User 4', password: DEMO_PASSWORD },
  { username: 'marketing1', displayName: 'Marketing User 1', password: MARKETING_PASSWORD },
  { username: 'marketing2', displayName: 'Marketing User 2', password: MARKETING_PASSWORD },
  { username: 'marketing3', displayName: 'Marketing User 3', password: MARKETING_PASSWORD },
  { username: 'ruhrpm', displayName: 'RuhrPM User', password: 'MesseEWorld2026=Demo!' },
  { username: 'people1', displayName: 'People 1', password: 'BDP29mK<' },
  { username: 'yneo-ai', displayName: 'Yneo AI', password: 'Yneo.ai-2026!' },
  { username: 'andreas_bachmann', displayName: 'Andreas Bachmann', password: 'N34kPLAX', role: 'admin' },
];

export interface SeedResult {
  created: string[];
  skipped: string[];
}

/**
 * Idempotently create the demo users. Safe to call repeatedly — existing
 * users (gleicher username) bleiben unangetastet, ihre Passwoerter werden
 * NICHT ueberschrieben.
 */
export async function seedDemoUsers(): Promise<SeedResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const demo of DEMO_USERS) {
    const existing = await findUserByUsername(demo.username);
    if (existing) {
      skipped.push(demo.username);
      continue;
    }
    const user = await createUser({
      username: demo.username,
      password: demo.password,
      displayName: demo.displayName,
      role: demo.role,
    });
    created.push(`${demo.username} (${user.id})`);
  }

  return { created, skipped };
}

// Wenn als Skript direkt aufgerufen: ausführen + loggen.
if (import.meta.main) {
  (async () => {
    try {
      const { created, skipped } = await seedDemoUsers();
      console.log(`[seed] Demo users — created: ${created.length}, skipped: ${skipped.length}`);
      for (const c of created) console.log(`  + ${c}`);
      for (const s of skipped) console.log(`  - ${s} (skipped)`);
    } catch (err) {
      console.error('[seed] Error:', err);
      process.exit(1);
    }
  })();
}
