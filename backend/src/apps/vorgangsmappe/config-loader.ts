/**
 * Vorgangsmappe — Config-Loader
 *
 * Laedt `data/apps/vorgangsmappe/config.yaml` (Cabinet + Felder + Requirement-
 * Set-Default) und `data/apps/vorgangsmappe/requirements/<id>.yaml` (einzelne
 * Soll-Listen). Beides cached in-memory mit 60s TTL, weil Reads im Hot-Path
 * der Such- und Compliance-Routes liegen.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { VorgangsmappeConfig, RequirementSet } from './types';

const CACHE_TTL_MS = 60 * 1000;

let configCache: { value: VorgangsmappeConfig | null; loadedAt: number } | null = null;
const requirementsCache = new Map<string, { value: RequirementSet | null; loadedAt: number }>();

/**
 * Suche das App-Konfig-Verzeichnis an mehreren Stellen (lokal vs. Container).
 */
function findConfigDir(): string | null {
  const candidates = [
    resolve(process.cwd(), 'data/apps/vorgangsmappe'),
    resolve(process.cwd(), '../data/apps/vorgangsmappe'),
    resolve(process.cwd(), 'backend/data/apps/vorgangsmappe'),
    resolve(import.meta.dir, '../../../../data/apps/vorgangsmappe'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function loadConfig(): Promise<VorgangsmappeConfig | null> {
  const now = Date.now();
  if (configCache && now - configCache.loadedAt < CACHE_TTL_MS) {
    return configCache.value;
  }

  const dir = findConfigDir();
  if (!dir) {
    configCache = { value: null, loadedAt: now };
    return null;
  }
  const path = join(dir, 'config.yaml');
  if (!existsSync(path)) {
    configCache = { value: null, loadedAt: now };
    return null;
  }

  try {
    const text = await readFile(path, 'utf8');
    const parsed = parse(text) as VorgangsmappeConfig;
    if (!parsed?.cabinet?.id || !parsed.reference_field || !parsed.document_type_field) {
      console.warn('[vorgangsmappe] config.yaml unvollstaendig — cabinet.id, reference_field, document_type_field sind Pflicht.');
      configCache = { value: null, loadedAt: now };
      return null;
    }
    configCache = { value: parsed, loadedAt: now };
    return parsed;
  } catch (err) {
    console.error('[vorgangsmappe] config.yaml lesen fehlgeschlagen:', err);
    configCache = { value: null, loadedAt: now };
    return null;
  }
}

export async function loadRequirementSet(id: string): Promise<RequirementSet | null> {
  const now = Date.now();
  const safeId = id.replace(/[^a-z0-9_-]/gi, '');
  const cached = requirementsCache.get(safeId);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const dir = findConfigDir();
  if (!dir) {
    requirementsCache.set(safeId, { value: null, loadedAt: now });
    return null;
  }
  const path = join(dir, 'requirements', `${safeId}.yaml`);
  if (!existsSync(path)) {
    requirementsCache.set(safeId, { value: null, loadedAt: now });
    return null;
  }

  try {
    const text = await readFile(path, 'utf8');
    const parsed = parse(text) as RequirementSet;
    if (!parsed?.id || !Array.isArray(parsed.requirements)) {
      console.warn(`[vorgangsmappe] requirements/${safeId}.yaml ungueltig — id/requirements fehlen.`);
      requirementsCache.set(safeId, { value: null, loadedAt: now });
      return null;
    }
    requirementsCache.set(safeId, { value: parsed, loadedAt: now });
    return parsed;
  } catch (err) {
    console.error(`[vorgangsmappe] requirements/${safeId}.yaml lesen fehlgeschlagen:`, err);
    requirementsCache.set(safeId, { value: null, loadedAt: now });
    return null;
  }
}

export function clearConfigCache(): void {
  configCache = null;
  requirementsCache.clear();
}
