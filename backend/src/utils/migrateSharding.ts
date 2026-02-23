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
import { dateBucketFromId, dateBucketFromFilename } from './dateBucket';
import { DATA_DIR, TASKS_DIR, TASK_RESULTS_DIR, CHATS_DIR, CONVERSATIONS_DIR, GENERATED_IMAGES_DIR, EXPORTS_DIR } from './paths';
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
 * @param bucketExtractor - Extract YYYY/MM bucket from filename (return null to skip)
 * @returns Number of files migrated
 */
async function migrateToDateBuckets(
  dir: string,
  pattern: string,
  bucketExtractor: (filename: string) => string | null,
): Promise<number> {
  if (!existsSync(dir)) return 0;

  let migrated = 0;
  const files = await readdir(dir);

  for (const file of files) {
    // Only process matching files
    if (!file.endsWith(pattern)) continue;
    if (SKIP_FILES.has(file)) continue;

    const bucket = bucketExtractor(file);
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

/** Helper: extract bucket from ID-based filename (strips extension, then parses ID) */
function bucketFromIdFile(filename: string, prefix: string, ext: string): string | null {
  const id = filename.replace(new RegExp(`\\${ext}$`), '');
  if (!id.startsWith(prefix)) return null;
  return dateBucketFromId(id);
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
 *
 * The marker file includes a version number. When new directories are added,
 * bump MIGRATION_VERSION to re-run migration for the new entries.
 */
const MIGRATION_VERSION = 2; // v1: tasks/chats/conversations, v2: +images/exports

export async function runShardingMigration(): Promise<void> {
  // Check marker version — re-run if version is outdated
  if (existsSync(MARKER_FILE)) {
    try {
      const marker = await Bun.file(MARKER_FILE).text();
      const markerVersion = parseInt(marker.split('\n')[1] || '0', 10);
      if (markerVersion >= MIGRATION_VERSION) return;
    } catch {
      // Marker exists but unreadable — re-run to be safe
    }
  }

  console.log('[Migration] Starting date-based sharding migration (v' + MIGRATION_VERSION + ')...');
  const start = Date.now();

  // 1. Migrate task YAML files
  const tasksMigrated = await migrateToDateBuckets(
    TASKS_DIR,
    '.yaml',
    (f) => bucketFromIdFile(f, 'task_', '.yaml'),
  );

  // 2. Migrate task result JSON files
  const resultsMigrated = await migrateToDateBuckets(
    TASK_RESULTS_DIR,
    '.json',
    (f) => {
      const match = f.match(/^(task_[^-]+)-result\.json$/);
      return match ? dateBucketFromId(match[1]!) : null;
    },
  );

  // 3. Migrate chat YAML files
  const chatsMigrated = await migrateToDateBuckets(
    CHATS_DIR,
    '.yaml',
    (f) => bucketFromIdFile(f, 'session_', '.yaml'),
  );

  // 4. Migrate conversation Markdown files
  const convMigrated = await migrateToDateBuckets(
    CONVERSATIONS_DIR,
    '.md',
    (f) => bucketFromIdFile(f, 'session_', '.md'),
  );

  // 5. Migrate generated images (img_*.png/jpg/webp/json)
  let imagesMigrated = 0;
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.json']) {
    imagesMigrated += await migrateToDateBuckets(
      GENERATED_IMAGES_DIR,
      ext,
      (f) => bucketFromIdFile(f, 'img_', ext),
    );
  }

  // 6. Migrate export files ({slug}_{timestamp}.{ext})
  let exportsMigrated = 0;
  for (const ext of ['.xlsx', '.pdf', '.docx']) {
    exportsMigrated += await migrateToDateBuckets(
      EXPORTS_DIR,
      ext,
      (f) => dateBucketFromFilename(f),
    );
  }

  // 7. Update result_file paths in task files
  let pathsUpdated = 0;
  if (resultsMigrated > 0) {
    pathsUpdated = await updateTaskResultPaths(TASKS_DIR, TASK_RESULTS_DIR);
  }

  const elapsed = Date.now() - start;
  const parts = [
    tasksMigrated > 0 ? `${tasksMigrated} tasks` : '',
    resultsMigrated > 0 ? `${resultsMigrated} results` : '',
    chatsMigrated > 0 ? `${chatsMigrated} chats` : '',
    convMigrated > 0 ? `${convMigrated} conversations` : '',
    imagesMigrated > 0 ? `${imagesMigrated} images` : '',
    exportsMigrated > 0 ? `${exportsMigrated} exports` : '',
    pathsUpdated > 0 ? `${pathsUpdated} result paths updated` : '',
  ].filter(Boolean);

  console.log(
    `[Migration] Sharding v${MIGRATION_VERSION} complete in ${elapsed}ms` +
    (parts.length > 0 ? `: ${parts.join(', ')}` : ' (nothing to migrate)'),
  );

  // Write marker file with version
  await Bun.write(MARKER_FILE, `${new Date().toISOString()}\n${MIGRATION_VERSION}`);
}
