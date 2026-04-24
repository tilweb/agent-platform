/**
 * API-Key storage — YAML files under data/auth/api-keys/<id>.yaml.
 *
 * Keeps an in-memory prefix-index for O(1) lookup on request path.
 * Index is rebuilt lazily on first access and after every mutation.
 */

import { parse, stringify } from 'yaml';
import { join } from 'path';
import { readdir, stat } from 'node:fs/promises';
import type { ApiKey } from '../types';

const DATA_DIR = join(import.meta.dir, '../../../../data');
const KEYS_DIR = join(DATA_DIR, 'auth/api-keys');

// Prefix-index caches prefix → keyId. Rebuilt whenever the KEYS_DIR mtime
// changes — this keeps the backend in sync with keys created by external
// processes (CLI, admin script) without needing an explicit cache bust.
let prefixIndex: Map<string, string> | null = null;
let prefixIndexMtime = 0;

async function ensureDir(): Promise<void> {
  await Bun.write(join(KEYS_DIR, '.gitkeep'), '');
}

async function rebuildIndex(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = await readdir(KEYS_DIR);
  } catch {
    return map;
  }
  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    try {
      const key = parse(await Bun.file(join(KEYS_DIR, file)).text()) as ApiKey;
      if (key?.prefix && key.id) map.set(key.prefix, key.id);
    } catch {
      // skip invalid
    }
  }
  return map;
}

async function dirMtime(): Promise<number> {
  try {
    const s = await stat(KEYS_DIR);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

async function getIndex(): Promise<Map<string, string>> {
  const current = await dirMtime();
  if (!prefixIndex || current !== prefixIndexMtime) {
    prefixIndex = await rebuildIndex();
    prefixIndexMtime = current;
  }
  return prefixIndex;
}

export function invalidateIndex(): void {
  prefixIndex = null;
  prefixIndexMtime = 0;
}

export async function saveKey(key: ApiKey): Promise<void> {
  await ensureDir();
  await Bun.write(join(KEYS_DIR, `${key.id}.yaml`), stringify(key));
  invalidateIndex();
}

export async function loadKeyById(id: string): Promise<ApiKey | null> {
  const file = Bun.file(join(KEYS_DIR, `${id}.yaml`));
  if (!(await file.exists())) return null;
  return parse(await file.text()) as ApiKey;
}

export async function loadKeyByPrefix(prefix: string): Promise<ApiKey | null> {
  const index = await getIndex();
  const id = index.get(prefix);
  if (!id) return null;
  return loadKeyById(id);
}

export async function listKeys(): Promise<ApiKey[]> {
  await ensureDir();
  const files = await readdir(KEYS_DIR);
  const keys: ApiKey[] = [];
  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    try {
      keys.push(parse(await Bun.file(join(KEYS_DIR, file)).text()) as ApiKey);
    } catch {
      /* skip */
    }
  }
  keys.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return keys;
}
