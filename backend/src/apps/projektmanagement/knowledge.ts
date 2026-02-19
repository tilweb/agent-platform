/**
 * Projektmanagement Knowledge Service
 * Loads and provides PM Masterclass knowledge for each wizard step
 */

import { parse } from 'yaml';
import { join } from 'path';
import { APPS_DIR } from '../../utils/paths';

const KNOWLEDGE_PATH = join(APPS_DIR, 'projektmanagement/knowledge');

export interface StepKnowledge {
  meta: {
    step: number;
    title: string;
    description: string;
  };
  kernkonzepte: Record<string, any>;
  pruefkriterien: Record<string, string[]>;
  typische_fehler: string[] | Record<string, string[]>;
  verbesserungsvorschlaege: Record<string, any>;
}

// Cache for loaded knowledge
let knowledgeCache: Map<number, StepKnowledge> | null = null;

/**
 * Load all knowledge files
 */
export async function loadAllKnowledge(): Promise<Map<number, StepKnowledge>> {
  if (knowledgeCache) {
    return knowledgeCache;
  }

  knowledgeCache = new Map();

  const stepFiles = [
    { step: 1, file: 'step_01_basis_informationen.yaml' },
    { step: 2, file: 'step_02_ziele_erfolgskriterien.yaml' },
    { step: 3, file: 'step_03_inhalt_umfang.yaml' },
    { step: 4, file: 'step_04_hauptaufgaben.yaml' },
    { step: 5, file: 'step_05_meilensteine.yaml' },
    { step: 6, file: 'step_06_budget_risiken.yaml' },
    { step: 7, file: 'step_07_organisation_stakeholder.yaml' },
  ];

  for (const { step, file } of stepFiles) {
    try {
      const filePath = `${KNOWLEDGE_PATH}/${file}`;
      const bunFile = Bun.file(filePath);

      if (await bunFile.exists()) {
        const content = await bunFile.text();
        const knowledge = parse(content) as StepKnowledge;
        knowledgeCache.set(step, knowledge);
      }
    } catch (error) {
      console.error(`Error loading knowledge for step ${step}:`, error);
    }
  }

  return knowledgeCache;
}

/**
 * Get knowledge for a specific step
 */
export async function getStepKnowledge(step: number): Promise<StepKnowledge | null> {
  const knowledge = await loadAllKnowledge();
  return knowledge.get(step) || null;
}

/**
 * Get all available knowledge
 */
export async function getAllKnowledge(): Promise<StepKnowledge[]> {
  const knowledge = await loadAllKnowledge();
  return Array.from(knowledge.values());
}

/**
 * Get pruefkriterien (validation criteria) for a step
 */
export async function getPruefkriterien(step: number): Promise<Record<string, string[]> | null> {
  const knowledge = await getStepKnowledge(step);
  return knowledge?.pruefkriterien || null;
}

/**
 * Get typical errors for a step
 */
export async function getTypischeFehler(step: number): Promise<string[] | Record<string, string[]> | null> {
  const knowledge = await getStepKnowledge(step);
  return knowledge?.typische_fehler || null;
}

/**
 * Get improvement suggestions for a step
 */
export async function getVerbesserungsvorschlaege(step: number): Promise<Record<string, any> | null> {
  const knowledge = await getStepKnowledge(step);
  return knowledge?.verbesserungsvorschlaege || null;
}

/**
 * Clear knowledge cache (for reloading)
 */
export function clearKnowledgeCache(): void {
  knowledgeCache = null;
}

/**
 * Generate a system prompt for LLM analysis based on step knowledge
 */
export async function generateAnalysisPrompt(step: number): Promise<string | null> {
  const knowledge = await getStepKnowledge(step);
  if (!knowledge) return null;

  const sections: string[] = [];

  // Meta
  sections.push(`# Analyse für Schritt ${step}: ${knowledge.meta.title}`);
  sections.push(`${knowledge.meta.description}\n`);

  // Kernkonzepte
  if (knowledge.kernkonzepte) {
    sections.push('## Kernkonzepte');
    sections.push(formatKernkonzepte(knowledge.kernkonzepte));
  }

  // Prüfkriterien
  if (knowledge.pruefkriterien) {
    sections.push('## Prüfkriterien');
    for (const [category, criteria] of Object.entries(knowledge.pruefkriterien)) {
      sections.push(`### ${category}`);
      for (const criterion of criteria) {
        sections.push(`- ${criterion}`);
      }
    }
  }

  // Typische Fehler
  if (knowledge.typische_fehler) {
    sections.push('\n## Typische Fehler zu vermeiden');
    if (Array.isArray(knowledge.typische_fehler)) {
      for (const fehler of knowledge.typische_fehler) {
        sections.push(`- ${fehler}`);
      }
    } else {
      for (const [category, fehler] of Object.entries(knowledge.typische_fehler)) {
        sections.push(`### ${category}`);
        if (Array.isArray(fehler)) {
          for (const f of fehler) {
            sections.push(`- ${f}`);
          }
        }
      }
    }
  }

  return sections.join('\n');
}

function formatKernkonzepte(konzepte: Record<string, any>, indent = ''): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(konzepte)) {
    if (typeof value === 'string') {
      lines.push(`${indent}**${key}**: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${indent}**${key}**:`);
      for (const item of value) {
        lines.push(`${indent}  - ${item}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${indent}### ${key}`);
      lines.push(formatKernkonzepte(value, indent + '  '));
    }
  }

  return lines.join('\n');
}
