/**
 * Seed Demo Users
 *
 * Creates demo1-demo4 and marketing1-marketing3 user accounts.
 * Idempotent: skips users that already exist.
 *
 * Path resolution:
 * - Docker: script runs from /app/backend/scripts/, data at /app/data/ → ../../data
 * - Local:  script runs from agent-platform/scripts/, data at agent-platform/data/ → ../data
 *
 * Resolves to whichever of the two parent-data locations actually exists.
 */

import { join } from 'path';
import { readdir, stat } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const MARKETING_PASSWORD = process.env.MARKETING_PASSWORD || 'Marketing2026!';
const DEMO_USERS = [
  { username: 'demo1', displayName: 'Demo User 1', password: DEMO_PASSWORD },
  { username: 'demo2', displayName: 'Demo User 2', password: DEMO_PASSWORD },
  { username: 'demo3', displayName: 'Demo User 3', password: DEMO_PASSWORD },
  { username: 'demo4', displayName: 'Demo User 4', password: DEMO_PASSWORD },
  { username: 'marketing1', displayName: 'Marketing User 1', password: MARKETING_PASSWORD },
  { username: 'marketing2', displayName: 'Marketing User 2', password: MARKETING_PASSWORD },
  { username: 'marketing3', displayName: 'Marketing User 3', password: MARKETING_PASSWORD },
  { username: 'ruhrpm', displayName: 'RuhrPM User', password: 'MesseEWorld2026=Demo!' },
  { username: 'people1', displayName: 'People 1', password: 'BDP29mK<' },
  { username: 'yneo-ai', displayName: 'Yneo AI', password: 'Yneo.ai-2026!' },
];

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function findUserByUsername(usersDir: string, username: string): Promise<boolean> {
  let files: string[];
  try {
    files = await readdir(usersDir);
  } catch {
    return false;
  }

  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    try {
      const content = await Bun.file(join(usersDir, file)).text();
      const user = parseYaml(content);
      if (user?.username === username) {
        return true;
      }
    } catch {
      // Skip invalid files
    }
  }
  return false;
}

async function resolveDataDir(): Promise<string> {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const candidates = [
    join(import.meta.dir, '../data'),       // local: agent-platform/scripts/ → agent-platform/data/
    join(import.meta.dir, '../../data'),    // docker: /app/backend/scripts/ → /app/data/
  ];
  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isDirectory()) return candidate;
    } catch { /* not found, try next */ }
  }
  return candidates[0]!;
}

async function main() {
  const dataDir = await resolveDataDir();
  const usersDir = join(dataDir, 'auth/users');

  // Ensure directory exists
  await Bun.write(join(usersDir, '.gitkeep'), '');

  console.log(`[seed] Checking demo users in ${usersDir}`);

  let created = 0;
  let skipped = 0;

  for (const demoUser of DEMO_USERS) {
    const exists = await findUserByUsername(usersDir, demoUser.username);

    if (exists) {
      console.log(`[seed] User "${demoUser.username}" already exists, skipping.`);
      skipped++;
      continue;
    }

    const userId = generateUserId();
    const now = new Date().toISOString();
    const passwordHash = await Bun.password.hash(demoUser.password, {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = {
      id: userId,
      username: demoUser.username,
      displayName: demoUser.displayName,
      email: '',
      role: 'user',
      isActive: true,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    const filePath = join(usersDir, `${userId}.yaml`);
    await Bun.write(filePath, stringifyYaml(user));

    console.log(`[seed] Created user "${demoUser.username}" (${userId})`);
    created++;
  }

  console.log(`[seed] Done. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
