/**
 * Vertragsmanagement — Boot-Time-Seed der ContractSchemas aus YAML in die DB.
 *
 * Hintergrund: Schemas leben in `data/apps/vertragsmanagement/schemas/*.yaml`
 * als statische Dateien, im Postgres-Worktree (main) werden sie zur Laufzeit
 * aber aus der `vertragsmgmt.schemas`-Tabelle gelesen. Ohne Seeder hat ein
 * frisch aufgesetztes Backend keine Schemas — Vertrags-Import schlaegt fehl.
 *
 * Seeder ist idempotent: er liest ALLE YAMLs unter dem Schema-Verzeichnis,
 * prueft pro `id` ob das Schema schon in der DB existiert, und legt es nur
 * an wenn nicht. Bestehende user-editierte Schemas werden NICHT ueberschrieben.
 *
 * Wird beim Boot in `index.ts` aufgerufen, nach `runMigrations`. Ohne
 * SCALINGO_POSTGRES wird die ganze Funktion uebersprungen.
 */

import { parse } from 'yaml';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ContractSchema } from '../types';
import { getSchema, saveSchema } from './storage';
import { validateContractSchema } from './schema-validation';

/**
 * Suche das Schema-Verzeichnis an mehreren plausiblen Stellen. Lokal liegt es
 * meistens unter `data/apps/...`, im Container unter `/app/data/apps/...`.
 */
function findSchemasDir(): string | null {
  const candidates = [
    resolve(process.cwd(), 'data/apps/vertragsmanagement/schemas'),
    resolve(process.cwd(), '../data/apps/vertragsmanagement/schemas'),
    resolve(process.cwd(), 'backend/data/apps/vertragsmanagement/schemas'),
    resolve(import.meta.dir, '../../../../data/apps/vertragsmanagement/schemas'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export interface SeedResult {
  created: number;
  skipped: number;
  errors: number;
}

export async function seedContractSchemasFromYamlIfNeeded(): Promise<SeedResult> {
  const dir = findSchemasDir();
  if (!dir) {
    console.warn('[seed-contract-schemas] schemas/-Verzeichnis nicht gefunden — ueberspringe Seed.');
    return { created: 0, skipped: 0, errors: 0 };
  }

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    console.warn(`[seed-contract-schemas] readdir(${dir}) fehlgeschlagen:`, err instanceof Error ? err.message : err);
    return { created: 0, skipped: 0, errors: 0 };
  }

  const yamlFiles = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of yamlFiles) {
    try {
      const content = await readFile(join(dir, file), 'utf8');
      const schema = parse(content) as ContractSchema;
      if (!schema?.id || !schema?.name) {
        console.warn(`[seed-contract-schemas] ${file}: ungueltiges Schema (id/name fehlt) — ueberspringe.`);
        errors += 1;
        continue;
      }

      const existing = await getSchema(schema.id);
      if (existing) {
        skipped += 1;
        continue;
      }

      // Validierung: mapping muss konsistent sein. Wenn nicht — Hinweis loggen
      // und trotzdem seeden, weil das System-Schema vom Maintainer kommt und
      // unsere Validation eine Warnung statt einer Blockade sein sollte.
      const issues = validateContractSchema(schema);
      if (issues.length > 0) {
        console.warn(`[seed-contract-schemas] ${file}: Validation-Hinweise:`, issues.map((i) => `${i.field}=${i.message}`).join('; '));
      }

      await saveSchema(schema);
      created += 1;
    } catch (err) {
      errors += 1;
      console.error(`[seed-contract-schemas] ${file}: Fehler:`, err instanceof Error ? err.message : err);
    }
  }

  return { created, skipped, errors };
}
