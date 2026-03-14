/**
 * Lieferantenmanagement Changelog
 * Append-only JSONL logging for supplier changes
 */

import type { ChangelogEntry } from './types';
import { validateId } from './storage';
import { appendFile } from 'node:fs/promises';

const BASE_PATH = './data/apps/lieferantenmanagement/changelog';

/**
 * Append a changelog entry for a supplier
 * Uses fs.appendFile for atomic append (no read-then-write race condition)
 */
export async function appendChangelog(
  supplierId: string,
  entry: Omit<ChangelogEntry, 'timestamp'>
): Promise<void> {
  await Bun.$`mkdir -p ${BASE_PATH}`;

  const fullEntry: ChangelogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(fullEntry) + '\n';
  const filePath = `${BASE_PATH}/${supplierId}.jsonl`;

  await appendFile(filePath, line, 'utf-8');
}

/**
 * Read changelog entries for a supplier (newest first)
 */
export async function getChangelog(
  supplierId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ entries: ChangelogEntry[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  if (!validateId(supplierId)) return { entries: [], total: 0 };

  const filePath = `${BASE_PATH}/${supplierId}.jsonl`;

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return { entries: [], total: 0 };
  }

  const content = await file.text();
  const lines = content.trim().split('\n').filter(Boolean);

  const entries: ChangelogEntry[] = lines
    .map((line) => {
      try {
        return JSON.parse(line) as ChangelogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is ChangelogEntry => e !== null);

  // Newest first
  entries.reverse();

  const total = entries.length;
  const paginated = entries.slice(offset, offset + limit);

  return { entries: paginated, total };
}

/**
 * Delete changelog for a supplier (when supplier is deleted)
 */
export async function deleteChangelog(supplierId: string): Promise<void> {
  if (!validateId(supplierId)) return;

  const filePath = `${BASE_PATH}/${supplierId}.jsonl`;
  const file = Bun.file(filePath);

  if (await file.exists()) {
    await Bun.$`rm ${filePath}`;
  }
}
