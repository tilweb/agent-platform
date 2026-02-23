/**
 * One-time migration: Move flat files into YYYY/MM date-bucketed subdirectories.
 *
 * Migrates:
 * - tasks/*.yaml → tasks/YYYY/MM/*.yaml
 * - tasks/results/*.json → tasks/results/YYYY/MM/*.json
 * - chats/session_*.yaml → chats/YYYY/MM/session_*.yaml
 * - conversations/session_*.md → conversations/YYYY/MM/session_*.md
 *
 * Uses fs.rename() which is atomic and O(1) on the same filesystem.
 * Skips: queue.yaml, chat-folders.yaml
 */

import { readdir, rename, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { dateBucketFromId, currentDateBucket } from './dateBucket';
import { DATA_DIR, TASKS_DIR, TASK_RESULTS_DIR, CHATS_DIR, CONVERSATIONS_DIR } from './paths';
import { loadYaml, saveYaml } from './yamlStorage';

const MARKER_FILE = join(DATA_DIR, '.sharding-migrated');

/** Files to skip during migration (not entity files) */
const SKIP_FILES = new Set([
  'queue.yaml',
  'chat-folders.yaml',
  '.gitkeep',
]);

/**
 * Generic migration: move matching flat files into YYYY/MM buckets.
 *
 * @param dir - Directory containing flat files
 * @param pattern - File extension filter (e.g. '.yaml', '.json')
 * @param idExtractor - Extract entity ID from filename (return null to skip)
 * @returns Number of files migrated
 */
async function migrateToDateBuckets(
  dir: string,
  pattern: string,
  idExtractor: (filename: string) => string | null,
): Promise<number> {
  if (!existsSync(dir)) return 0;

  let migrated = 0;
  const files = await readdir(dir);

  for (const file of files) {
    // Only process matching files
    if (!file.endsWith(pattern)) continue;
    if (SKIP_FILES.has(file)) continue;

    const id = idExtractor(file);
    if (!id) continue;

    const bucket = dateBucketFromId(id);
    if (!bucket) continue;

    const srcPath = join(dir, file);
    const destDir = join(dir, bucket);
    const destPath = join(destDir, file);

    // Skip if already in a bucket or destination already exists
    if (existsSync(destPath)) continue;

    await mkdir(destDir, { recursive: true });
    await rename(srcPath, destPath);
    migrated++;
  }

  return migrated;
}

/**
 * Update result_file paths in migrated task YAML files.
 * After task results are moved, the absolute paths stored in task files become stale.
 */
async function updateTaskResultPaths(tasksDir: string, resultsDir: string): Promise<number> {
  let updated = 0;
  const glob = new Bun.Glob('**/*.yaml');

  try {
    for await (const relPath of glob.scan(tasksDir)) {
      const basename = relPath.split('/').pop()!;
      if (!basename.startsWith('task_') || SKIP_FILES.has(basename)) continue;

      const filePath = join(tasksDir, relPath);
      const task = await loadYaml<{ result_file?: string }>(filePath);
      if (!task?.result_file) continue;

      // Check if the stored result_file path still exists
      if (existsSync(task.result_file)) continue;

      // Try to find the result file in the bucketed location
      const resultBasename = task.result_file.split('/').pop()!;
      const taskId = basename.replace(/\.yaml$/, '');
      const bucket = dateBucketFromId(taskId);
      if (!bucket) continue;

      const newResultPath = join(resultsDir, bucket, resultBasename);
      if (existsSync(newResultPath)) {
        task.result_file = newResultPath;
        await saveYaml(filePath, task);
        updated++;
      }
    }
  } catch {
    // Ignore errors during path update
  }

  return updated;
}

/**
 * Run the full sharding migration. Idempotent — skips if marker file exists.
 */
export async function runShardingMigration(): Promise<void> {
  if (existsSync(MARKER_FILE)) return;

  console.log('[Migration] Starting date-based sharding migration...');
  const start = Date.now();

  // 1. Migrate task YAML files
  const tasksMigrated = await migrateToDateBuckets(
    TASKS_DIR,
    '.yaml',
    (f) => {
      const id = f.replace(/\.yaml$/, '');
      return id.startsWith('task_') ? id : null;
    },
  );

  // 2. Migrate task result JSON files
  const resultsMigrated = await migrateToDateBuckets(
    TASK_RESULTS_DIR,
    '.json',
    (f) => {
      // Filename: task_xxx-result.json → extract task_xxx
      const match = f.match(/^(task_[^-]+)-result\.json$/);
      return match ? match[1]! : null;
    },
  );

  // 3. Migrate chat YAML files
  const chatsMigrated = await migrateToDateBuckets(
    CHATS_DIR,
    '.yaml',
    (f) => {
      const id = f.replace(/\.yaml$/, '');
      return id.startsWith('session_') ? id : null;
    },
  );

  // 4. Migrate conversation Markdown files
  const convMigrated = await migrateToDateBuckets(
    CONVERSATIONS_DIR,
    '.md',
    (f) => {
      const id = f.replace(/\.md$/, '');
      return id.startsWith('session_') ? id : null;
    },
  );

  // 5. Update result_file paths in task files
  let pathsUpdated = 0;
  if (resultsMigrated > 0) {
    pathsUpdated = await updateTaskResultPaths(TASKS_DIR, TASK_RESULTS_DIR);
  }

  const elapsed = Date.now() - start;
  console.log(
    `[Migration] Sharding complete in ${elapsed}ms: ` +
    `${tasksMigrated} tasks, ${resultsMigrated} results, ` +
    `${chatsMigrated} chats, ${convMigrated} conversations migrated` +
    (pathsUpdated > 0 ? `, ${pathsUpdated} result paths updated` : ''),
  );

  // Write marker file
  await Bun.write(MARKER_FILE, new Date().toISOString());
}
