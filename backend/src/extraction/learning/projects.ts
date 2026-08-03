/**
 * Extraction Projects — Postgres-backed (Drizzle).
 *
 * Frueher YAML-Files unter `data/extraction-projects/<id>/project.yaml`,
 * jetzt in `extraction.projects`. Das `learning`-Feld + Few-Shot-Examples
 * leben mit in der DB (Examples in `extraction.examples`).
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db';
import { extractionProjects } from '../../db/schema/extraction';
import type { ExtractionProject } from './types';

function rowToProject(row: typeof extractionProjects.$inferSelect): ExtractionProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created: row.createdAt,
    updated: row.updatedAt,
    fields: row.fields as ExtractionProject['fields'],
    instructions: row.instructions ?? undefined,
    guidelines: row.guidelines,
    learning: row.learning as ExtractionProject['learning'],
    extraction: (row.extraction as ExtractionProject['extraction']) ?? undefined,
    rules: (row.rules as ExtractionProject['rules']) ?? undefined,
  };
}

export async function getAllProjects(): Promise<ExtractionProject[]> {
  const db = getDb();
  const rows = await db.select().from(extractionProjects).orderBy(desc(extractionProjects.updatedAt));
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<ExtractionProject | null> {
  const db = getDb();
  const rows = await db.select().from(extractionProjects).where(eq(extractionProjects.id, id)).limit(1);
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function createProject(data: {
  name: string;
  description?: string;
  fields: ExtractionProject['fields'];
  instructions?: string;
  extraction?: ExtractionProject['extraction'];
  rules?: ExtractionProject['rules'];
}): Promise<ExtractionProject> {
  const id = data.name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const now = new Date().toISOString();
  const project: ExtractionProject = {
    id,
    name: data.name,
    description: data.description || '',
    created: now,
    updated: now,
    fields: data.fields,
    instructions: data.instructions,
    guidelines: '',
    learning: {
      total_examples: 0,
      accuracy_estimate: 0,
      guideline_version: 0,
    },
    extraction: data.extraction,
    rules: data.rules,
  };

  const db = getDb();
  await db.insert(extractionProjects).values({
    id,
    name: project.name,
    description: project.description,
    fields: project.fields as never,
    instructions: project.instructions ?? null,
    guidelines: project.guidelines,
    learning: project.learning as never,
    extraction: (project.extraction ?? null) as never,
    rules: (project.rules ?? null) as never,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[Extraction] Created project: ${id}`);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<ExtractionProject, 'name' | 'description' | 'fields' | 'instructions' | 'guidelines' | 'learning' | 'extraction' | 'rules'>>,
): Promise<ExtractionProject | null> {
  const existing = await getProject(id);
  if (!existing) return null;
  // Nur explizit gesetzte Felder uebernehmen — `undefined` (z.B. ein PUT ohne
  // `extraction`) darf bestehende Werte NICHT ueberschreiben.
  const defined = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  const merged: ExtractionProject = {
    ...existing,
    ...defined,
    id,
    updated: new Date().toISOString(),
  };
  const db = getDb();
  await db.update(extractionProjects)
    .set({
      name: merged.name,
      description: merged.description,
      fields: merged.fields as never,
      instructions: merged.instructions ?? null,
      guidelines: merged.guidelines,
      learning: merged.learning as never,
      extraction: (merged.extraction ?? null) as never,
      rules: (merged.rules ?? null) as never,
      updatedAt: merged.updated,
    })
    .where(eq(extractionProjects.id, id));
  return merged;
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionProjects).where(eq(extractionProjects.id, id)).returning({ id: extractionProjects.id });
  if (res.length > 0) console.log(`[Extraction] Deleted project: ${id}`);
  return res.length > 0;
}
