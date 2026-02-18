#!/usr/bin/env bun
/**
 * Migration Script: Single-User → Multi-User
 *
 * Assigns all existing tasks and chats without userId to a specified admin user.
 *
 * Usage:
 *   bun run scripts/migrate-to-multiuser.ts --admin-user=<userId>
 *
 * Options:
 *   --admin-user=<userId>  Required. The user ID to assign orphaned data to.
 *   --dry-run              Optional. Show what would be migrated without making changes.
 *   --help                 Show this help message.
 *
 * Examples:
 *   bun run scripts/migrate-to-multiuser.ts --admin-user=user_abc123
 *   bun run scripts/migrate-to-multiuser.ts --admin-user=user_abc123 --dry-run
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import * as yaml from 'yaml';

// Paths relative to backend directory
const DATA_DIR = resolve(process.cwd(), '../data');
const TASKS_DIR = resolve(DATA_DIR, 'tasks');
const CHATS_DIR = resolve(DATA_DIR, 'chats');

interface MigrationStats {
  tasksChecked: number;
  tasksMigrated: number;
  tasksSkipped: number;
  tasksErrors: number;
  chatsChecked: number;
  chatsMigrated: number;
  chatsSkipped: number;
  chatsErrors: number;
}

function parseArgs(): { adminUserId: string | null; dryRun: boolean; help: boolean } {
  const args = process.argv.slice(2);
  let adminUserId: string | null = null;
  let dryRun = false;
  let help = false;

  for (const arg of args) {
    if (arg.startsWith('--admin-user=')) {
      adminUserId = arg.split('=')[1] || null;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }

  return { adminUserId, dryRun, help };
}

function printUsage(): void {
  console.log(`
Migration Script: Single-User → Multi-User

Assigns all existing tasks and chats without userId to a specified admin user.

Usage:
  bun run scripts/migrate-to-multiuser.ts --admin-user=<userId>

Options:
  --admin-user=<userId>  Required. The user ID to assign orphaned data to.
  --dry-run              Optional. Show what would be migrated without making changes.
  --help                 Show this help message.

Examples:
  bun run scripts/migrate-to-multiuser.ts --admin-user=user_abc123
  bun run scripts/migrate-to-multiuser.ts --admin-user=user_abc123 --dry-run
`);
}

async function migrateTasks(adminUserId: string, dryRun: boolean): Promise<Partial<MigrationStats>> {
  const stats: Partial<MigrationStats> = {
    tasksChecked: 0,
    tasksMigrated: 0,
    tasksSkipped: 0,
    tasksErrors: 0,
  };

  if (!existsSync(TASKS_DIR)) {
    console.log('  Tasks directory not found, skipping tasks migration.');
    return stats;
  }

  const files = await readdir(TASKS_DIR);
  const taskFiles = files.filter(f => f.startsWith('task_') && f.endsWith('.yaml'));

  console.log(`  Found ${taskFiles.length} task files to check.`);

  for (const file of taskFiles) {
    stats.tasksChecked!++;
    const filePath = join(TASKS_DIR, file);

    try {
      const content = await readFile(filePath, 'utf-8');
      const task = yaml.parse(content);

      if (!task) {
        console.log(`    [SKIP] ${file}: Invalid YAML`);
        stats.tasksErrors!++;
        continue;
      }

      if (task.userId) {
        console.log(`    [SKIP] ${file}: Already has userId (${task.userId})`);
        stats.tasksSkipped!++;
        continue;
      }

      // Assign admin user
      task.userId = adminUserId;
      task.updated_at = new Date().toISOString();

      if (dryRun) {
        console.log(`    [DRY-RUN] ${file}: Would assign userId=${adminUserId}`);
      } else {
        const updatedYaml = yaml.stringify(task, { indent: 2, lineWidth: 0 });
        await writeFile(filePath, updatedYaml, 'utf-8');
        console.log(`    [MIGRATED] ${file}: Assigned userId=${adminUserId}`);
      }

      stats.tasksMigrated!++;
    } catch (error: any) {
      console.error(`    [ERROR] ${file}: ${error.message}`);
      stats.tasksErrors!++;
    }
  }

  return stats;
}

async function migrateChats(adminUserId: string, dryRun: boolean): Promise<Partial<MigrationStats>> {
  const stats: Partial<MigrationStats> = {
    chatsChecked: 0,
    chatsMigrated: 0,
    chatsSkipped: 0,
    chatsErrors: 0,
  };

  if (!existsSync(CHATS_DIR)) {
    console.log('  Chats directory not found, skipping chats migration.');
    return stats;
  }

  const files = await readdir(CHATS_DIR);
  const chatFiles = files.filter(f => f.endsWith('.yaml'));

  console.log(`  Found ${chatFiles.length} chat files to check.`);

  for (const file of chatFiles) {
    stats.chatsChecked!++;
    const filePath = join(CHATS_DIR, file);

    try {
      const content = await readFile(filePath, 'utf-8');

      // Check if userId is present in the file (simple check)
      if (content.includes('userId:')) {
        console.log(`    [SKIP] ${file}: Already has userId`);
        stats.chatsSkipped!++;
        continue;
      }

      // Parse and update
      const chat = yaml.parse(content);

      if (!chat || !chat.id) {
        console.log(`    [SKIP] ${file}: Invalid YAML structure`);
        stats.chatsErrors!++;
        continue;
      }

      // Assign admin user
      chat.userId = adminUserId;

      if (dryRun) {
        console.log(`    [DRY-RUN] ${file}: Would assign userId=${adminUserId}`);
      } else {
        const updatedYaml = yaml.stringify(chat, { indent: 2, lineWidth: 0 });
        await writeFile(filePath, updatedYaml, 'utf-8');
        console.log(`    [MIGRATED] ${file}: Assigned userId=${adminUserId}`);
      }

      stats.chatsMigrated!++;
    } catch (error: any) {
      console.error(`    [ERROR] ${file}: ${error.message}`);
      stats.chatsErrors!++;
    }
  }

  return stats;
}

async function main(): Promise<void> {
  const { adminUserId, dryRun, help } = parseArgs();

  if (help) {
    printUsage();
    process.exit(0);
  }

  if (!adminUserId) {
    console.error('Error: --admin-user=<userId> is required.');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Multi-User Migration Script');
  console.log('='.repeat(60));
  console.log(`Admin User ID: ${adminUserId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Data Directory: ${DATA_DIR}`);
  console.log('='.repeat(60));
  console.log('');

  // Migrate tasks
  console.log('[1/2] Migrating Tasks...');
  const taskStats = await migrateTasks(adminUserId, dryRun);
  console.log('');

  // Migrate chats
  console.log('[2/2] Migrating Chats...');
  const chatStats = await migrateChats(adminUserId, dryRun);
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log('Tasks:');
  console.log(`  Checked:  ${taskStats.tasksChecked}`);
  console.log(`  Migrated: ${taskStats.tasksMigrated}`);
  console.log(`  Skipped:  ${taskStats.tasksSkipped}`);
  console.log(`  Errors:   ${taskStats.tasksErrors}`);
  console.log('');
  console.log('Chats:');
  console.log(`  Checked:  ${chatStats.chatsChecked}`);
  console.log(`  Migrated: ${chatStats.chatsMigrated}`);
  console.log(`  Skipped:  ${chatStats.chatsSkipped}`);
  console.log(`  Errors:   ${chatStats.chatsErrors}`);
  console.log('');

  if (dryRun) {
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('Migration complete!');
  }

  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
