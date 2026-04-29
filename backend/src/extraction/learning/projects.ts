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
    guidelines: row.guidelines,
    learning: row.learning as ExtractionProject['learning'],
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
    guidelines: '',
    learning: {
      total_examples: 0,
      accuracy_estimate: 0,
      guideline_version: 0,
    },
  };

  const db = getDb();
  await db.insert(extractionProjects).values({
    id,
    name: project.name,
    description: project.description,
    fields: project.fields as never,
    guidelines: project.guidelines,
    learning: project.learning as never,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[Extraction] Created project: ${id}`);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<ExtractionProject, 'name' | 'description' | 'fields' | 'guidelines' | 'learning'>>,
): Promise<ExtractionProject | null> {
  const existing = await getProject(id);
  if (!existing) return null;
  const merged: ExtractionProject = {
    ...existing,
    ...updates,
    id,
    updated: new Date().toISOString(),
  };
  const db = getDb();
  await db.update(extractionProjects)
    .set({
      name: merged.name,
      description: merged.description,
      fields: merged.fields as never,
      guidelines: merged.guidelines,
      learning: merged.learning as never,
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
