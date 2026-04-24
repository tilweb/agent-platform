/**
 * Public-API audit log — append-only JSONL, one file per month.
 * Stored under data/audit/api-public/<YYYY-MM>.jsonl (gitignored).
 *
 * Does not log request/response bodies — only metadata for accountability.
 */

import { join } from 'path';
import { appendFile, mkdir } from 'node:fs/promises';
import type { AuditEntry } from './types';

const DATA_DIR = join(import.meta.dir, '../../../data');
const AUDIT_DIR = join(DATA_DIR, 'audit/api-public');

let dirReady = false;

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await mkdir(AUDIT_DIR, { recursive: true });
  dirReady = true;
}

function monthFile(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return join(AUDIT_DIR, `${y}-${m}.jsonl`);
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await ensureDir();
    await appendFile(monthFile(), JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error('[public-api/audit] write failed:', err);
  }
}
