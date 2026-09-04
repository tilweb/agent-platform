/**
 * Projektmanagement Knowledge Service
 *
 * Lädt das PM-Masterclass-Wissen — generalisiert auf **(Element, Segment)**:
 *   - element ∈ projektauftrag | projektidee | portfolio | statusbericht
 *   - segment = Wissensschlüssel im Element (Wizards: je Step; Portfolio: `_general`)
 *
 * Auflösung mit Fallback: fehlt die Datei eines Segments, wird `_general` des
 * Elements genutzt. Der Projektauftrag behält seine FLACHEN Dateien
 * (`step_0X_*.yaml`) — kein Umzug, kein Verhaltenswechsel; die step-basierten
 * Alt-Funktionen bleiben als dünne Wrapper erhalten.
 *
 * Wissen ist in BEIDEN Worktrees file-basiert (kein Postgres).
 */

import { parse, stringify } from 'yaml';

const KNOWLEDGE_PATH = './data/apps/projektmanagement/knowledge';

export interface StepKnowledge {
  meta: {
    step?: number;
    title: string;
    description: string;
  };
  kernkonzepte: Record<string, any>;
  pruefkriterien: Record<string, string[]>;
  typische_fehler: string[] | Record<string, string[]>;
  verbesserungsvorschlaege: Record<string, any>;
}

// ============== Element-Registry ==============

export type PmElement = 'projektauftrag' | 'projektidee' | 'portfolio' | 'statusbericht';

export interface SegmentDef {
  /** Stabiler Schlüssel innerhalb des Elements (URL-/Dateiname-tauglich). */
  key: string;
  /** Anzeige-Titel (Editor). */
  title: string;
  /** Relativer Dateipfad unter KNOWLEDGE_PATH. */
  file: string;
}

export interface ElementDef {
  element: PmElement;
  label: string;
  /** Ist das Element ein Ausfüll-Wizard (per-Step) oder ein Analyse-Dashboard? */
  kind: 'wizard' | 'dashboard';
  segments: SegmentDef[];
}

/** Projektauftrag — bestehende FLACHE Dateien, Segmentschlüssel `step_1..step_7`. */
const PROJEKTAUFTRAG_STEPS: Array<{ n: number; title: string; file: string }> = [
  { n: 1, title: 'Basis-Informationen', file: 'step_01_basis_informationen.yaml' },
  { n: 2, title: 'Ziele & Erfolgskriterien', file: 'step_02_ziele_erfolgskriterien.yaml' },
  { n: 3, title: 'Inhalt & Umfang', file: 'step_03_inhalt_umfang.yaml' },
  { n: 4, title: 'Hauptaufgaben', file: 'step_04_hauptaufgaben.yaml' },
  { n: 5, title: 'Meilensteine', file: 'step_05_meilensteine.yaml' },
  { n: 6, title: 'Budget & Risiken', file: 'step_06_budget_risiken.yaml' },
  { n: 7, title: 'Organisation & Stakeholder', file: 'step_07_organisation_stakeholder.yaml' },
];

/** Projektidee — analog zum 7-Step-Idee-Wizard (Dateien kommen mit RuhrPM/PM5). */
const PROJEKTIDEE_STEPS: Array<{ key: string; title: string }> = [
  { key: 'basis', title: 'Basis-Informationen' },
  { key: 'ziele', title: 'Ziele' },
  { key: 'projektkontext', title: 'Projektkontext' },
  { key: 'businesscase', title: 'Business Case' },
  { key: 'unternehmensrisiken', title: 'Unternehmensrisiken' },
  { key: 'personen', title: 'Personen' },
  { key: 'uebersicht', title: 'Übersicht' },
];

export const ELEMENT_REGISTRY: Record<PmElement, ElementDef> = {
  projektauftrag: {
    element: 'projektauftrag',
    label: 'Projektauftrag',
    kind: 'wizard',
    segments: PROJEKTAUFTRAG_STEPS.map((s) => ({ key: `step_${s.n}`, title: s.title, file: s.file })),
  },
  projektidee: {
    element: 'projektidee',
    label: 'Projektidee',
    kind: 'wizard',
    segments: PROJEKTIDEE_STEPS.map((s) => ({ key: s.key, title: s.title, file: `projektidee/${s.key}.yaml` })),
  },
  portfolio: {
    element: 'portfolio',
    label: 'Portfolio',
    kind: 'dashboard',
    segments: [{ key: '_general', title: 'Portfolio-Wissen', file: 'portfolio/_general.yaml' }],
  },
  statusbericht: {
    element: 'statusbericht',
    label: 'Statusbericht',
    kind: 'dashboard',
    // Vorerst nur registriert (Verdrahtung im Nachgang). `_general` als Platzhalter.
    segments: [{ key: '_general', title: 'Statusbericht-Wissen', file: 'statusbericht/_general.yaml' }],
  },
};

function isPmElement(v: string): v is PmElement {
  return v === 'projektauftrag' || v === 'projektidee' || v === 'portfolio' || v === 'statusbericht';
}

/** Segment-Definition auflösen; unbekanntes Segment → null. */
function findSegment(element: PmElement, segment: string): SegmentDef | null {
  return ELEMENT_REGISTRY[element]?.segments.find((s) => s.key === segment) ?? null;
}

/** Datei eines (element, segment) — mit Fallback auf `<element>/_general.yaml`. */
async function resolveKnowledgePath(element: PmElement, segment: string): Promise<string | null> {
  const seg = findSegment(element, segment);
  if (seg) {
    const p = `${KNOWLEDGE_PATH}/${seg.file}`;
    if (await Bun.file(p).exists()) return p;
  }
  // Fallback: Element-Allgemeinwissen
  const general = `${KNOWLEDGE_PATH}/${element}/_general.yaml`;
  if (await Bun.file(general).exists()) return general;
  return null;
}

// Cache je `${element}/${segment}` (aufgelöste Datei), lazily befüllt.
const knowledgeCache = new Map<string, StepKnowledge | null>();

// ============== Generalisierte API ==============

/** Wissen eines (element, segment) laden (mit Fallback), oder null. */
export async function getKnowledge(element: PmElement, segment: string): Promise<StepKnowledge | null> {
  const cacheKey = `${element}/${segment}`;
  if (knowledgeCache.has(cacheKey)) return knowledgeCache.get(cacheKey)!;

  let result: StepKnowledge | null = null;
  try {
    const path = await resolveKnowledgePath(element, segment);
    if (path) {
      const content = await Bun.file(path).text();
      result = parse(content) as StepKnowledge;
    }
  } catch (error) {
    console.error(`Error loading knowledge for ${element}/${segment}:`, error);
  }
  knowledgeCache.set(cacheKey, result);
  return result;
}

/** Roh-YAML eines (element, segment) — OHNE Fallback (Editor bearbeitet die eigene Datei). */
export async function getRawKnowledge(element: PmElement, segment: string): Promise<string | null> {
  const seg = findSegment(element, segment);
  if (!seg) return null;
  const file = Bun.file(`${KNOWLEDGE_PATH}/${seg.file}`);
  if (!(await file.exists())) return null;
  return file.text();
}

/** YAML eines (element, segment) speichern (validiert + Cache invalidieren). */
export async function saveKnowledge(element: PmElement, segment: string, yamlContent: string): Promise<void> {
  const seg = findSegment(element, segment);
  if (!seg) throw new Error(`Unbekanntes Segment: ${element}/${segment}`);
  parse(yamlContent); // validieren
  await Bun.write(`${KNOWLEDGE_PATH}/${seg.file}`, yamlContent);
  knowledgeCache.delete(`${element}/${segment}`);
}

/** YAML eines (element, segment) aus JSON-Objekt speichern (Editor). */
export async function saveKnowledgeJson(element: PmElement, segment: string, data: Record<string, any>): Promise<void> {
  return saveKnowledge(element, segment, stringify(data));
}

/** Übersicht aller Elemente + Segmente (für Editor/Endpunkte). */
export function listElements(): ElementDef[] {
  return Object.values(ELEMENT_REGISTRY);
}

export function clearKnowledgeCache(): void {
  knowledgeCache.clear();
}

// ============== Back-Compat: step-basierte Projektauftrag-API ==============
// Bestehende Aufrufer (analysis.ts, routes.ts) bleiben unverändert lauffähig.

export async function getStepKnowledge(step: number): Promise<StepKnowledge | null> {
  return getKnowledge('projektauftrag', `step_${step}`);
}

export async function getPruefkriterien(step: number): Promise<Record<string, string[]> | null> {
  return (await getStepKnowledge(step))?.pruefkriterien || null;
}

export async function getTypischeFehler(step: number): Promise<string[] | Record<string, string[]> | null> {
  return (await getStepKnowledge(step))?.typische_fehler || null;
}

export async function getVerbesserungsvorschlaege(step: number): Promise<Record<string, any> | null> {
  return (await getStepKnowledge(step))?.verbesserungsvorschlaege || null;
}

export async function getRawStepKnowledge(step: number): Promise<string | null> {
  return getRawKnowledge('projektauftrag', `step_${step}`);
}

export async function saveStepKnowledge(step: number, yamlContent: string): Promise<void> {
  return saveKnowledge('projektauftrag', `step_${step}`, yamlContent);
}

export async function saveStepKnowledgeJson(step: number, data: Record<string, any>): Promise<void> {
  return saveStepKnowledge(step, stringify(data));
}

/** Alle Projektauftrag-Step-Wissen (für die bestehende /knowledge-Übersicht). */
export async function getAllKnowledge(): Promise<StepKnowledge[]> {
  const out: StepKnowledge[] = [];
  for (const seg of ELEMENT_REGISTRY.projektauftrag.segments) {
    const k = await getKnowledge('projektauftrag', seg.key);
    if (k) out.push(k);
  }
  return out;
}

// ============== Analyse-Prompt (Markdown) ==============

/**
 * System-Prompt-Wissensteil für ein (element, segment) als Markdown.
 * Überladung: `generateAnalysisPrompt(step)` (Alt, Projektauftrag) bleibt gültig.
 */
export async function generateAnalysisPrompt(step: number): Promise<string | null>;
export async function generateAnalysisPrompt(element: PmElement, segment: string): Promise<string | null>;
export async function generateAnalysisPrompt(a: number | PmElement, b?: string): Promise<string | null> {
  const knowledge = typeof a === 'number'
    ? await getStepKnowledge(a)
    : await getKnowledge(a, b!);
  if (!knowledge) return null;

  const sections: string[] = [];
  const title = knowledge.meta?.title ?? '';
  sections.push(`# Analyse${title ? `: ${title}` : ''}`);
  if (knowledge.meta?.description) sections.push(`${knowledge.meta.description}\n`);

  if (knowledge.kernkonzepte) {
    sections.push('## Kernkonzepte');
    sections.push(formatKernkonzepte(knowledge.kernkonzepte));
  }

  if (knowledge.pruefkriterien) {
    sections.push('## Prüfkriterien');
    for (const [category, criteria] of Object.entries(knowledge.pruefkriterien)) {
      sections.push(`### ${category}`);
      if (Array.isArray(criteria)) {
        for (const criterion of criteria) sections.push(`- ${criterion}`);
      } else if (criteria && typeof criteria === 'object') {
        sections.push(formatKernkonzepte(criteria as Record<string, any>));
      } else if (criteria) {
        sections.push(`- ${criteria}`);
      }
    }
  }

  if (knowledge.typische_fehler) {
    sections.push('\n## Typische Fehler zu vermeiden');
    if (Array.isArray(knowledge.typische_fehler)) {
      for (const fehler of knowledge.typische_fehler) sections.push(`- ${fehler}`);
    } else {
      for (const [category, fehler] of Object.entries(knowledge.typische_fehler)) {
        sections.push(`### ${category}`);
        if (Array.isArray(fehler)) for (const f of fehler) sections.push(`- ${f}`);
      }
    }
  }

  const knownKeys = new Set(['meta', 'kernkonzepte', 'pruefkriterien', 'typische_fehler', 'verbesserungsvorschlaege']);
  for (const [key, value] of Object.entries(knowledge as Record<string, any>)) {
    if (knownKeys.has(key)) continue;
    const t = key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    sections.push(`\n## ${t}`);
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
      for (const item of value) lines.push(`${indent}  - ${item}`);
    } else if (typeof value === 'object') {
      lines.push(`${indent}### ${key}`);
      lines.push(formatKernkonzepte(value, indent + '  '));
    }
  }
  return lines.join('\n');
}

export { isPmElement };
