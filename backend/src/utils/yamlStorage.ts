/**
 * Shared YAML file storage utilities.
 *
 * Provides low-level helpers (ensureDir, loadYaml, saveYaml, listYamlIds, deleteYaml)
 * and a high-level factory (createYamlStore) for the common single-file-per-entity pattern.
 */

import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml, type Scalar } from 'yaml';

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

  const getPath = (id: string) => join(baseDir, `${id}${ext}`);

  return {
    ensureDir: () => ensureDir(baseDir),

    filePath: getPath,

    load: (id: string) => loadYaml<T>(getPath(id)),

    save: async (id: string, data: T) => {
      await ensureDir(baseDir);
      await saveYaml(getPath(id), data, yamlOpts);
    },

    listIds: () => listYamlIds(baseDir, prefix),

    delete: (id: string) => deleteYaml(getPath(id)),
  };
}
