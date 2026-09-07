import { profileHash } from './snapshot';
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
  const project: ExtractionProject = {
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
    webhook: (row.webhook as ExtractionProject['webhook']) ?? undefined,
    segments: (row.segments as ExtractionProject['segments']) ?? undefined,
  };
  const champion = project.learning.eval?.champion;
  if (champion) champion.stale = champion.profile_hash !== profileHash(project)
    || champion.dataset_version !== (project.learning.dataset_version ?? 0);
  return project;
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
  webhook?: ExtractionProject['webhook'];
  segments?: ExtractionProject['segments'];
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
    segments: data.segments,
    webhook: data.webhook,
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
    webhook: (project.webhook ?? null) as never,
    segments: (project.segments ?? null) as never,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[Extraction] Created project: ${id}`);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<ExtractionProject, 'name' | 'description' | 'fields' | 'instructions' | 'guidelines' | 'learning' | 'extraction' | 'rules' | 'webhook' | 'segments'>>,
): Promise<ExtractionProject | null> {
  const defined = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
  const rows = await getDb().update(extractionProjects).set({ ...defined, updatedAt: new Date().toISOString() } as never)
    .where(eq(extractionProjects.id, id)).returning();
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(extractionProjects).where(eq(extractionProjects.id, id)).returning({ id: extractionProjects.id });
  if (res.length > 0) console.log(`[Extraction] Deleted project: ${id}`);
  return res.length > 0;
}

/** Serialize read-modify-write of learning metadata across requests and server processes. */
export async function mutateProject(id: string, mutate: (project: ExtractionProject) => Partial<ExtractionProject>): Promise<void> {
  await getDb().transaction(async tx => {
    const [row] = await tx.select().from(extractionProjects).where(eq(extractionProjects.id, id)).for('update');
    if (!row) return;
    const update = mutate(rowToProject(row));
    await tx.update(extractionProjects).set({
      ...(update.learning ? { learning: update.learning as never } : {}),
      ...(update.guidelines !== undefined ? { guidelines: update.guidelines } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(extractionProjects.id, id));
  });
}
