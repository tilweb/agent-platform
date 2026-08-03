/**
 * Extraction Projects - YAML-based project management
 *
 * CRUD for extraction projects stored in data/extraction-projects/{id}/project.yaml
 */

import { readFile, writeFile, readdir, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ExtractionProject } from './types';

const PROJECTS_DIR = resolve(process.cwd(), '../data/extraction-projects');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function projectDir(id: string): string {
  return join(PROJECTS_DIR, id);
}

function projectFile(id: string): string {
  return join(projectDir(id), 'project.yaml');
}

/**
 * Load all projects from disk
 */
export async function getAllProjects(): Promise<ExtractionProject[]> {
  await ensureDir(PROJECTS_DIR);
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects: ExtractionProject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = projectFile(entry.name);
    if (!existsSync(file)) continue;

    try {
      const content = await readFile(file, 'utf-8');
      const project = parseYaml(content) as ExtractionProject;
      if (project?.id) {
        projects.push(project);
      }
    } catch (error) {
      console.error(`[Extraction] Failed to load project ${entry.name}:`, error);
    }
  }

  return projects.sort((a, b) => b.updated.localeCompare(a.updated));
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<ExtractionProject | null> {
  const file = projectFile(id);
  if (!existsSync(file)) return null;

  try {
    const content = await readFile(file, 'utf-8');
    return parseYaml(content) as ExtractionProject;
  } catch {
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(data: {
  name: string;
  description?: string;
  fields: ExtractionProject['fields'];
  instructions?: string;
  extraction?: ExtractionProject['extraction'];
  rules?: ExtractionProject['rules'];
  webhook?: ExtractionProject['webhook'];
}): Promise<ExtractionProject> {
  // Generate ID from name
  const id = data.name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const dir = projectDir(id);
  await ensureDir(dir);
  await ensureDir(join(dir, 'examples'));

  const now = new Date().toISOString();
  const project: ExtractionProject = {
    id,
    name: data.name,
    description: data.description || '',
    created: now,
    updated: now,
    fields: data.fields,
    ...(data.instructions ? { instructions: data.instructions } : {}),
    guidelines: '',
    learning: {
      total_examples: 0,
      accuracy_estimate: 0,
      guideline_version: 0,
    },
    ...(data.extraction ? { extraction: data.extraction } : {}),
    ...(data.rules ? { rules: data.rules } : {}),
    ...(data.webhook ? { webhook: data.webhook } : {}),
  };

  await writeFile(projectFile(id), stringifyYaml(project), 'utf-8');
  console.log(`[Extraction] Created project: ${id}`);
  return project;
}

/**
 * Update an existing project
 */
export async function updateProject(
  id: string,
  updates: Partial<Pick<ExtractionProject, 'name' | 'description' | 'fields' | 'instructions' | 'guidelines' | 'learning' | 'extraction' | 'rules' | 'webhook'>>
): Promise<ExtractionProject | null> {
  const project = await getProject(id);
  if (!project) return null;

  // Nur explizit gesetzte Felder uebernehmen — `undefined` (z.B. ein PUT ohne
  // `extraction`) darf bestehende Werte NICHT ueberschreiben.
  const defined = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  const updated: ExtractionProject = {
    ...project,
    ...defined,
    id, // prevent ID change
    updated: new Date().toISOString(),
  };

  await writeFile(projectFile(id), stringifyYaml(updated), 'utf-8');
  return updated;
}

/**
 * Delete a project and all its examples
 */
export async function deleteProject(id: string): Promise<boolean> {
  const dir = projectDir(id);
  if (!existsSync(dir)) return false;

  await rm(dir, { recursive: true, force: true });
  console.log(`[Extraction] Deleted project: ${id}`);
  return true;
}
