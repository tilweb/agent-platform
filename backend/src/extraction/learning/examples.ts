/**
 * Training Examples - CRUD + Selection
 *
 * Manages training examples stored in data/extraction-projects/{id}/examples/{ex-id}.yaml
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { TrainingExample } from './types';

const PROJECTS_DIR = resolve(process.cwd(), '../data/extraction-projects');

function examplesDir(projectId: string): string {
  return join(PROJECTS_DIR, projectId, 'examples');
}

function exampleFile(projectId: string, exampleId: string): string {
  return join(examplesDir(projectId), `${exampleId}.yaml`);
}

/**
 * Generate a unique example ID
 */
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `ex_${ts}_${rand}`;
}

/**
 * Get all examples for a project
 */
export async function getExamples(projectId: string): Promise<TrainingExample[]> {
  const dir = examplesDir(projectId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml'));
  const examples: TrainingExample[] = [];

  for (const file of yamlFiles) {
    try {
      const content = await readFile(join(dir, file), 'utf-8');
      const example = parseYaml(content) as TrainingExample;
      if (example?.id) {
        examples.push(example);
      }
    } catch (error) {
      console.error(`[Extraction] Failed to load example ${file}:`, error);
    }
  }

  return examples.sort((a, b) => b.created.localeCompare(a.created));
}

/**
 * Save a new training example
 */
export async function saveExample(
  projectId: string,
  data: {
    source_filename: string;
    document_text: string;
    initial_extraction: Record<string, unknown>;
    corrected_extraction: Record<string, unknown>;
  }
): Promise<TrainingExample> {
  const dir = examplesDir(projectId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Compute corrections
  const corrections: TrainingExample['corrections'] = [];
  let confirmedCorrect = true;

  for (const [field, correctedValue] of Object.entries(data.corrected_extraction)) {
    const initialValue = data.initial_extraction[field];
    if (JSON.stringify(initialValue) !== JSON.stringify(correctedValue)) {
      corrections.push({
        field,
        was: initialValue,
        corrected_to: correctedValue,
      });
      confirmedCorrect = false;
    }
  }

  const id = generateId();
  const example: TrainingExample = {
    id,
    created: new Date().toISOString(),
    source_filename: data.source_filename,
    document_text: data.document_text,
    initial_extraction: data.initial_extraction,
    corrected_extraction: data.corrected_extraction,
    corrections,
    confirmed_correct: confirmedCorrect,
  };

  await writeFile(exampleFile(projectId, id), stringifyYaml(example), 'utf-8');
  return example;
}

/**
 * Delete a training example
 */
export async function deleteExample(projectId: string, exampleId: string): Promise<boolean> {
  const file = exampleFile(projectId, exampleId);
  if (!existsSync(file)) return false;

  await unlink(file);
  return true;
}

/**
 * Select best examples for few-shot prompting
 *
 * Strategy:
 * - Prioritize corrections (more informative than confirmed-correct)
 * - Prefer newer examples
 * - Max 5 examples, max ~4000 token budget
 * - Truncate document_text to first 500 chars for few-shot
 */
export async function selectFewShotExamples(
  projectId: string,
  maxExamples: number = 5,
  maxTokenBudget: number = 4000
): Promise<TrainingExample[]> {
  const all = await getExamples(projectId);
  if (all.length === 0) return [];

  // Sort: corrections first, then by date (newest first)
  const sorted = [...all].sort((a, b) => {
    // Corrections first
    if (a.corrections.length > 0 && b.corrections.length === 0) return -1;
    if (a.corrections.length === 0 && b.corrections.length > 0) return 1;
    // Then by date (newest first)
    return b.created.localeCompare(a.created);
  });

  const selected: TrainingExample[] = [];
  let estimatedTokens = 0;

  for (const example of sorted) {
    if (selected.length >= maxExamples) break;

    // Rough token estimate: ~4 chars per token
    const docSnippet = example.document_text.substring(0, 500);
    const correctedJson = JSON.stringify(example.corrected_extraction);
    const tokenEstimate = Math.ceil((docSnippet.length + correctedJson.length) / 4);

    if (estimatedTokens + tokenEstimate > maxTokenBudget) break;

    selected.push(example);
    estimatedTokens += tokenEstimate;
  }

  return selected;
}
