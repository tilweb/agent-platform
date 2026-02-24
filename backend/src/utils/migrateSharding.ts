/**
 * One-time migration: Move flat files into YYYY/MM date-bucketed subdirectories.
 *
 * Migrates:
 * - tasks/*.yaml → tasks/YYYY/MM/*.yaml
 * - tasks/results/*.json → tasks/YYYY/MM/*.json (consolidated alongside task YAMLs)
 * - chats/session_*.yaml → chats/YYYY/MM/session_*.yaml
 * - conversations/session_*.md → conversations/YYYY/MM/session_*.md
 * - generated-images/img_*.* → generated-images/YYYY/MM/img_*.*
 * - exports/{slug}_{ts}.* → exports/YYYY/MM/{slug}_{ts}.*
 *
 * Uses fs.rename() which is atomic and O(1) on the same filesystem.
 * Skips: queue.yaml, chat-folders.yaml
 */

import { readdir, rename, mkdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { dateBucketFromId, dateBucketFromFilename } from './dateBucket';
import { DATA_DIR, TASKS_DIR, CHATS_DIR, CONVERSATIONS_DIR, GENERATED_IMAGES_DIR, EXPORTS_DIR, CHAT_UPLOADS_DIR } from './paths';
import { loadYaml, saveYaml } from './yamlStorage';

const MARKER_FILE = join(DATA_DIR, '.sharding-migrated');
const LEGACY_RESULTS_DIR = join(TASKS_DIR, 'results');

/** Files to skip during migration (not entity files) */
const SKIP_FILES = new Set([
  'queue.yaml',
  'chat-folders.yaml',
  '.gitkeep',
]);

/**
 * Generic migration: move matching flat files into YYYY/MM buckets.
 *
 * @param dir - Source directory containing flat files
 * @param pattern - File extension filter (e.g. '.yaml', '.json')
 * @param bucketExtractor - Extract YYYY/MM bucket from filename (return null to skip)
 * @param destDir - Optional destination base directory (defaults to same as dir)
 * @returns Number of files migrated
 */
async function migrateToDateBuckets(
  dir: string,
  pattern: string,
  bucketExtractor: (filename: string) => string | null,
  destDir?: string,
): Promise<number> {
  if (!existsSync(dir)) return 0;

  const targetDir = destDir || dir;
  let migrated = 0;
  const files = await readdir(dir);

  for (const file of files) {
    if (!file.endsWith(pattern)) continue;
    if (SKIP_FILES.has(file)) continue;

    const bucket = bucketExtractor(file);
    if (!bucket) continue;

    const srcPath = join(dir, file);
    const destBucketDir = join(targetDir, bucket);
    const destPath = join(destBucketDir, file);

    // Skip if destination already exists
    if (existsSync(destPath)) continue;

    await mkdir(destBucketDir, { recursive: true });
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
 * Consolidate task result files from tasks/results/ into tasks/ (same bucket as task YAMLs).
 * Scans recursively to handle both flat and already-bucketed results.
 */
async function consolidateTaskResults(): Promise<number> {
  if (!existsSync(LEGACY_RESULTS_DIR)) return 0;

  let consolidated = 0;
  const glob = new Bun.Glob('**/*.json');

  for await (const relPath of glob.scan(LEGACY_RESULTS_DIR)) {
    const filename = relPath.split('/').pop()!;
    // Extract task ID from result filename: task_xxx-result.json → task_xxx
    const match = filename.match(/^(task_.+)-result\.json$/);
    if (!match) continue;

    const taskId = match[1]!;
    const bucket = dateBucketFromId(taskId);
    if (!bucket) continue;

    const srcPath = join(LEGACY_RESULTS_DIR, relPath);
    const destDir = join(TASKS_DIR, bucket);
    const destPath = join(destDir, filename);

    if (existsSync(destPath)) continue;

    await mkdir(destDir, { recursive: true });
    await rename(srcPath, destPath);
    consolidated++;
  }

  return consolidated;
}

/**
 * Update result_file paths in task YAML files to point to the consolidated location.
 */
async function updateTaskResultPaths(): Promise<number> {
  let updated = 0;
  const glob = new Bun.Glob('**/*.yaml');

  try {
    for await (const relPath of glob.scan(TASKS_DIR)) {
      const basename = relPath.split('/').pop()!;
      if (!basename.startsWith('task_') || SKIP_FILES.has(basename)) continue;

      const filePath = join(TASKS_DIR, relPath);
      const task = await loadYaml<{ result_file?: string }>(filePath);
      if (!task?.result_file) continue;

      // Check if the stored result_file path still exists
      if (existsSync(task.result_file)) continue;

      // Compute expected consolidated path
      const resultBasename = task.result_file.split('/').pop()!;
      const taskId = basename.replace(/\.yaml$/, '');
      const bucket = dateBucketFromId(taskId);
      if (!bucket) continue;

      const newResultPath = join(TASKS_DIR, bucket, resultBasename);
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
 * Remove the legacy tasks/results/ directory if it's empty after consolidation.
 */
async function removeLegacyResultsDir(): Promise<boolean> {
  if (!existsSync(LEGACY_RESULTS_DIR)) return false;

  try {
    // Check if any files remain
    const glob = new Bun.Glob('**/*');
    for await (const _file of glob.scan(LEGACY_RESULTS_DIR)) {
      // Still has files — don't remove
      return false;
    }
    // Empty — safe to remove
    await rm(LEGACY_RESULTS_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generic migration: move matching flat **directories** into YYYY/MM buckets.
 * Used for chat-uploads where each session is a directory (not a file).
 *
 * @param dir - Source directory containing flat session dirs
 * @param prefix - Directory name prefix filter (e.g. 'session_')
 * @param bucketExtractor - Extract YYYY/MM bucket from dir name (return null to skip)
 * @returns Number of directories migrated
 */
async function migrateDirsToDateBuckets(
  dir: string,
  prefix: string,
  bucketExtractor: (dirname: string) => string | null,
): Promise<number> {
  if (!existsSync(dir)) return 0;

  let migrated = 0;
  const entries = await readdir(dir);

  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;

    const srcPath = join(dir, entry);

    // Only migrate directories, skip files
    try {
      const s = await stat(srcPath);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    const bucket = bucketExtractor(entry);
    if (!bucket) continue;

    const destBucketDir = join(dir, bucket);
    const destPath = join(destBucketDir, entry);

    // Skip if destination already exists
    if (existsSync(destPath)) continue;

    await mkdir(destBucketDir, { recursive: true });
    await rename(srcPath, destPath);
    migrated++;
  }

  return migrated;
}

/**
 * Run the full sharding migration. Idempotent — skips if marker file exists.
 *
 * The marker file includes a version number. When new directories are added,
 * bump MIGRATION_VERSION to re-run migration for the new entries.
 */
const MIGRATION_VERSION = 4; // v1: tasks/chats/conversations, v2: +images/exports, v3: consolidate results, v4: chat-uploads

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

  // 1. Migrate task YAML files (flat → bucketed)
  const tasksMigrated = await migrateToDateBuckets(
    TASKS_DIR,
    '.yaml',
    (f) => bucketFromIdFile(f, 'task_', '.yaml'),
  );

  // 2. Migrate task result files: flat results in tasks/results/ → tasks/YYYY/MM/
  const flatResultsMigrated = await migrateToDateBuckets(
    LEGACY_RESULTS_DIR,
    '.json',
    (f) => {
      const match = f.match(/^(task_.+)-result\.json$/);
      return match ? dateBucketFromId(match[1]!) : null;
    },
    TASKS_DIR, // destination: tasks directory (not results subdirectory)
  );

  // 3. Consolidate already-bucketed results from tasks/results/YYYY/MM/ → tasks/YYYY/MM/
  const resultsConsolidated = await consolidateTaskResults();

  // 4. Migrate chat YAML files
  const chatsMigrated = await migrateToDateBuckets(
    CHATS_DIR,
    '.yaml',
    (f) => bucketFromIdFile(f, 'session_', '.yaml'),
  );

  // 5. Migrate conversation Markdown files
  const convMigrated = await migrateToDateBuckets(
    CONVERSATIONS_DIR,
    '.md',
    (f) => bucketFromIdFile(f, 'session_', '.md'),
  );

  // 6. Migrate generated images (img_*.png/jpg/webp/json)
  let imagesMigrated = 0;
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.json']) {
    imagesMigrated += await migrateToDateBuckets(
      GENERATED_IMAGES_DIR,
      ext,
      (f) => bucketFromIdFile(f, 'img_', ext),
    );
  }

  // 7. Migrate export files ({slug}_{timestamp}.{ext})
  let exportsMigrated = 0;
  for (const ext of ['.xlsx', '.pdf', '.docx']) {
    exportsMigrated += await migrateToDateBuckets(
      EXPORTS_DIR,
      ext,
      (f) => dateBucketFromFilename(f),
    );
  }

  // 8. Update result_file paths in task YAMLs
  const totalResultsMoved = flatResultsMigrated + resultsConsolidated;
  let pathsUpdated = 0;
  if (totalResultsMoved > 0) {
    pathsUpdated = await updateTaskResultPaths();
  }

  // 9. Clean up empty legacy results directory
  const resultsRemoved = await removeLegacyResultsDir();

  // 10. Migrate chat-uploads session directories (session_* → YYYY/MM/session_*)
  const uploadsMigrated = await migrateDirsToDateBuckets(
    CHAT_UPLOADS_DIR,
    'session_',
    (dirname) => dateBucketFromId(dirname),
  );

  const elapsed = Date.now() - start;
  const parts = [
    tasksMigrated > 0 ? `${tasksMigrated} tasks` : '',
    totalResultsMoved > 0 ? `${totalResultsMoved} results consolidated` : '',
    chatsMigrated > 0 ? `${chatsMigrated} chats` : '',
    convMigrated > 0 ? `${convMigrated} conversations` : '',
    imagesMigrated > 0 ? `${imagesMigrated} images` : '',
    exportsMigrated > 0 ? `${exportsMigrated} exports` : '',
    pathsUpdated > 0 ? `${pathsUpdated} result paths updated` : '',
    resultsRemoved ? 'tasks/results/ removed' : '',
    uploadsMigrated > 0 ? `${uploadsMigrated} chat-uploads` : '',
  ].filter(Boolean);

  console.log(
    `[Migration] Sharding v${MIGRATION_VERSION} complete in ${elapsed}ms` +
    (parts.length > 0 ? `: ${parts.join(', ')}` : ' (nothing to migrate)'),
  );

  // Write marker file with version
  await Bun.write(MARKER_FILE, `${new Date().toISOString()}\n${MIGRATION_VERSION}`);
}
