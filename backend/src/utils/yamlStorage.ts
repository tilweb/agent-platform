/**
 * Shared YAML file storage utilities.
 *
 * Provides low-level helpers (ensureDir, loadYaml, saveYaml, listYamlIds, deleteYaml)
 * and a high-level factory (createYamlStore) for the common single-file-per-entity pattern.
 */

import { join, dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml, type Scalar } from 'yaml';
import { dateBucketFromId, currentDateBucket } from './dateBucket';

// ── Low-level helpers ────────────────────────────────────────────────

/**
 * Ensure a directory exists (recursive). Idempotent.
 */
export async function ensureDir(dir: string): Promise<void> {
  const { mkdir } = await import('fs/promises');
  const { existsSync } = await import('fs');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load and parse a YAML file. Returns null if file does not exist.
 */
export async function loadYaml<T>(filePath: string, validate?: (data: unknown) => T): Promise<T | null> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  const text = await file.text();
  const parsed = parseYaml(text);
  if (parsed === null || parsed === undefined) return null;
  if (validate) return validate(parsed);
  return parsed as T;
}

/**
 * Stringify and write a YAML file. Creates parent directory if needed.
 */
export async function saveYaml<T>(
  filePath: string,
  data: T,
  options?: { indent?: number; lineWidth?: number; defaultStringType?: Scalar.Type; defaultKeyType?: Scalar.Type }
): Promise<void> {
  const { dirname } = await import('path');
  await ensureDir(dirname(filePath));
  const opts = {
    indent: options?.indent ?? 2,
    lineWidth: options?.lineWidth ?? 0,
    ...(options?.defaultStringType ? { defaultStringType: options.defaultStringType } : {}),
    ...(options?.defaultKeyType ? { defaultKeyType: options.defaultKeyType } : {}),
  };
  const content = stringifyYaml(data, opts);
  await Bun.write(filePath, content);
}

/**
 * List YAML file IDs (basenames without extension) in a directory.
 */
export async function listYamlIds(dir: string, prefix?: string): Promise<string[]> {
  const ids: string[] = [];
  const glob = new Bun.Glob('*.yaml');
  try {
    for await (const name of glob.scan(dir)) {
      if (name === '.gitkeep') continue;
      const id = name.replace(/\.yaml$/, '');
      if (prefix && !id.startsWith(prefix)) continue;
      ids.push(id);
    }
  } catch {
    // Directory doesn't exist yet → empty list
  }
  return ids;
}

/**
 * Delete a YAML file. Returns true if deleted, false if not found.
 */
export async function deleteYaml(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return false;
  const { unlink } = await import('fs/promises');
  await unlink(filePath);
  return true;
}

// ── High-level factory ───────────────────────────────────────────────

export interface YamlStoreOptions {
  /** YAML stringify options */
  yaml?: { indent?: number; lineWidth?: number; defaultStringType?: Scalar.Type; defaultKeyType?: Scalar.Type };
  /** File name prefix filter for listing (e.g. 'task_') */
  prefix?: string;
  /** Custom file extension (default: '.yaml') */
  ext?: string;
  /** Enable date-based sharding (YYYY/MM subdirectories) */
  bucketed?: boolean;
}

export interface YamlStore<T> {
  /** Ensure the base directory exists */
  ensureDir(): Promise<void>;
  /** Get full file path for an ID */
  filePath(id: string): string;
  /** Load a single item by ID */
  load(id: string): Promise<T | null>;
  /** Save an item by ID */
  save(id: string, data: T): Promise<void>;
  /** List all item IDs */
  listIds(): Promise<string[]>;
  /** Delete an item by ID. Returns true if deleted. */
  delete(id: string): Promise<boolean>;
}

/**
 * Create a typed YAML store for a directory.
 *
 * Usage:
 * ```ts
 * const userStore = createYamlStore<User>(USERS_DIR);
 * const user = await userStore.load('user_123');
 * await userStore.save('user_123', { ... });
 * const ids = await userStore.listIds();
 * ```
 */
export function createYamlStore<T>(baseDir: string, options?: YamlStoreOptions): YamlStore<T> {
  const ext = options?.ext ?? '.yaml';
  const yamlOpts = options?.yaml;
  const prefix = options?.prefix;
  const bucketed = options?.bucketed ?? false;

  /** Compute the bucketed path: baseDir/YYYY/MM/id.ext */
  const getBucketPath = (id: string) => {
    const bucket = dateBucketFromId(id) || currentDateBucket();
    return join(baseDir, bucket, `${id}${ext}`);
  };

  /** Flat path (legacy): baseDir/id.ext */
  const getFlatPath = (id: string) => join(baseDir, `${id}${ext}`);

  /** Primary path for new writes */
  const getPath = (id: string) => bucketed ? getBucketPath(id) : getFlatPath(id);

  return {
    ensureDir: () => ensureDir(baseDir),

    filePath: getPath,

    load: async (id: string) => {
      if (bucketed) {
        // Try bucketed path first, fall back to flat (backward-compat)
        const bucketPath = getBucketPath(id);
        const bucketFile = Bun.file(bucketPath);
        if (await bucketFile.exists()) {
          return loadYaml<T>(bucketPath);
        }
        // Fallback to flat path
        return loadYaml<T>(getFlatPath(id));
      }
      return loadYaml<T>(getPath(id));
    },

    save: async (id: string, data: T) => {
      const path = getPath(id);
      await ensureDir(dirname(path));
      await saveYaml(path, data, yamlOpts);
    },

    listIds: async () => {
      if (bucketed) {
        // Scan all subdirectories recursively
        const ids: string[] = [];
        const glob = new Bun.Glob(`**/*${ext}`);
        try {
          for await (const name of glob.scan(baseDir)) {
            if (name === '.gitkeep') continue;
            // Extract basename without extension from nested paths like 2026/02/task_xxx.yaml
            const basename = name.split('/').pop()!.replace(new RegExp(`\\${ext}$`), '');
            if (prefix && !basename.startsWith(prefix)) continue;
            ids.push(basename);
          }
        } catch {
          // Directory doesn't exist yet → empty list
        }
        return ids;
      }
      return listYamlIds(baseDir, prefix);
    },

    delete: async (id: string) => {
      if (bucketed) {
        // Try bucketed path first, fall back to flat
        const bucketPath = getBucketPath(id);
        const deleted = await deleteYaml(bucketPath);
        if (deleted) return true;
        return deleteYaml(getFlatPath(id));
      }
      return deleteYaml(getPath(id));
    },
  };
}
