#!/usr/bin/env bun
/**
 * Migration Script: RBAC for Collections and Agents
 *
 * Initializes owner access for existing collections and agents that don't have RBAC entries.
 * Run this once to migrate existing data.
 *
 * Usage: bun migrate-rbac-collections-agents.mjs [defaultOwnerId]
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';

// Import RBAC functions
const rbacStoragePath = './src/rbac/storage.ts';

// We'll use dynamic imports for the compiled TypeScript
async function main() {
  console.log('=== RBAC Migration für Collections und Agents ===\n');

  // Get default owner from command line or use first admin user
  let defaultOwnerId = process.argv[2];

  if (!defaultOwnerId) {
    // Find first admin user
    const authDir = resolve(process.cwd(), '../data/auth');
    const usersDir = resolve(authDir, 'users');

    if (existsSync(usersDir)) {
      const userFiles = await readdir(usersDir);
      for (const file of userFiles) {
        if (file.endsWith('.yaml')) {
          const userPath = resolve(usersDir, file);
          const content = await readFile(userPath, 'utf-8');
          const user = parseYaml(content);
          if (user.role === 'admin') {
            defaultOwnerId = user.id;
            console.log(`Verwende Admin-User als Default-Owner: ${user.username} (${user.id})`);
            break;
          }
        }
      }
    }
  }

  if (!defaultOwnerId) {
    console.error('Fehler: Kein Default-Owner gefunden. Bitte UserId als Argument angeben.');
    process.exit(1);
  }

  console.log(`Default Owner ID: ${defaultOwnerId}\n`);

  // Import the migration functions
  const { migrateExistingCollections } = await import('./src/routes/knowledge.ts');
  const { migrateExistingAgents } = await import('./src/routes/agents.ts');

  // Migrate collections
  console.log('--- Collections migrieren ---');
  const collectionsResult = await migrateExistingCollections(defaultOwnerId);
  console.log(`Collections: ${collectionsResult.migrated} migriert, ${collectionsResult.skipped} übersprungen\n`);

  // Migrate agents
  console.log('--- Agents migrieren ---');
  const agentsResult = await migrateExistingAgents(defaultOwnerId);
  console.log(`Agents: ${agentsResult.migrated} migriert, ${agentsResult.skipped} übersprungen\n`);

  console.log('=== Migration abgeschlossen ===');
}

main().catch(console.error);
