/**
 * Projektmanagement Knowledge Service
 * Loads and provides PM Masterclass knowledge for each wizard step
 */

import { parse, stringify } from 'yaml';

const KNOWLEDGE_PATH = './data/apps/projektmanagement/knowledge';

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

// Step file mapping
const STEP_FILES = [
  { step: 1, file: 'step_01_basis_informationen.yaml' },
  { step: 2, file: 'step_02_ziele_erfolgskriterien.yaml' },
  { step: 3, file: 'step_03_inhalt_umfang.yaml' },
  { step: 4, file: 'step_04_hauptaufgaben.yaml' },
  { step: 5, file: 'step_05_meilensteine.yaml' },
  { step: 6, file: 'step_06_budget_risiken.yaml' },
  { step: 7, file: 'step_07_organisation_stakeholder.yaml' },
];

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

  for (const { step, file } of STEP_FILES) {
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
 * Get raw YAML content for a step
 */
export async function getRawStepKnowledge(step: number): Promise<string | null> {
  const entry = STEP_FILES.find((s) => s.step === step);
  if (!entry) return null;

  const filePath = `${KNOWLEDGE_PATH}/${entry.file}`;
  const bunFile = Bun.file(filePath);

  if (!(await bunFile.exists())) return null;
  return bunFile.text();
}

/**
 * Save knowledge YAML for a step
 */
export async function saveStepKnowledge(step: number, yamlContent: string): Promise<void> {
  const entry = STEP_FILES.find((s) => s.step === step);
  if (!entry) throw new Error(`Invalid step: ${step}`);

  // Validate that the YAML is parseable
  parse(yamlContent);

  const filePath = `${KNOWLEDGE_PATH}/${entry.file}`;
  await Bun.write(filePath, yamlContent);

  // Invalidate cache so next read picks up changes
  knowledgeCache = null;
}

/**
 * Save knowledge from a JSON object (serializes to YAML)
 */
export async function saveStepKnowledgeJson(step: number, data: Record<string, any>): Promise<void> {
  const yamlContent = stringify(data);
  await saveStepKnowledge(step, yamlContent);
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
      // Werte sind i.d.R. string[]; einzelne Steps liefern aber ein (ggf. leeres)
      // Objekt oder einen String — defensiv behandeln, sonst wirft for..of.
      if (Array.isArray(criteria)) {
        for (const criterion of criteria) {
          sections.push(`- ${criterion}`);
        }
      } else if (criteria && typeof criteria === 'object') {
        sections.push(formatKernkonzepte(criteria as Record<string, any>));
      } else if (criteria) {
        sections.push(`- ${criteria}`);
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

  // Custom/additional sections (any top-level key not in the known set)
  const knownKeys = new Set(['meta', 'kernkonzepte', 'pruefkriterien', 'typische_fehler', 'verbesserungsvorschlaege']);
  for (const [key, value] of Object.entries(knowledge as Record<string, any>)) {
    if (knownKeys.has(key)) continue;
    const title = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    sections.push(`\n## ${title}`);
    sections.push(formatKernkonzepte(typeof value === 'object' && !Array.isArray(value) ? value : { inhalt: value }));
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
