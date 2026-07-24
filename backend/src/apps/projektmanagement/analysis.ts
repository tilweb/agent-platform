/**
 * Projektmanagement Analysis Service
 * LLM-based step analysis for Projektauftrag wizard (Steps 2-7)
 * Validates against PM Masterclass criteria and checks consistency
 */

import { llmService, type Message } from '../../services/llm';
import { getStepKnowledge, generateAnalysisPrompt, type StepKnowledge } from './knowledge';
import type { Projektauftrag } from './types';
import type { UsageContext } from '../../services/usageTracking';

// ============== Types ==============

export interface MasterclassAnalysis {
  staerken: string[];       // What was done well
  schwaechen: string[];     // Areas for improvement
  hinweise: string[];       // Concrete recommendations
  score: number;            // 0-100 rating
}

export interface ConsistencyFinding {
  bereich: string;          // e.g., "Ziele vs Aufgaben"
  beschreibung: string;     // Specific observation
  empfehlung: string;       // How to fix
}

export interface ConsistencyAnalysis {
  status: 'konsistent' | 'warnung' | 'inkonsistent';
  findings: ConsistencyFinding[];
}

export interface StepAnalysisResult {
  step: number;
  stepName: string;
  timestamp: string;
  masterclassAnalysis: MasterclassAnalysis;
  konsistenzAnalysis: ConsistencyAnalysis;
}

// ============== Step Configuration ==============

const STEP_NAMES: Record<number, string> = {
  2: 'Ziele & Erfolgskriterien',
  3: 'Inhalt & Umfang',
  4: 'Hauptaufgaben',
  5: 'Meilensteine',
  6: 'Budget & Risiken',
  7: 'Organisation & Stakeholder',
};

// Welche Felder das Tool je Schritt tatsächlich erfassen kann, inkl. Mapping
// von Masterclass-Konzepten auf vorhandene Felder. Wird in den Analyse-Prompt
// injiziert, damit das LLM (a) bereits über ein Feld Abgedecktes anerkennt und
// (b) nur einpflegbare Verbesserungen vorschlägt — statt Felder/Strukturen zu
// fordern, die es im Tool nicht gibt.
// WICHTIG: Code-eigen halten und bei Datenmodell-Änderungen mitpflegen
// (Quelle: STEP_DATA_EXTRACTORS + types.ts). Nicht über den MasterclassEditor
// editierbar machen — das Schema muss zwingend zum Datenmodell passen.
const STEP_FIELD_SCHEMA: Record<number, string> = {
  2: `- goals: Freitext (Projektziele)
- criteria: Liste von Erfolgskriterien (je Eintrag Freitext)
Mapping: Messbare/SMART-Kriterien werden als einzelne Einträge in "criteria" erfasst. Es gibt kein separates Feld für Zielgewichtung oder Zieltermine.`,
  3: `- scope: Freitext (Umfangsbeschreibung)
- in_scope: Liste (was zum Projekt gehört)
- out_scope: Liste (Abgrenzung, was NICHT dazugehört)
Mapping: Abgrenzungen gehören in "out_scope". Kein separates Feld für Annahmen/Abhängigkeiten.`,
  4: `- tasks: Liste von Aufgaben, je Aufgabe: Name, Verantwortlich (responsible), Startdatum, Enddatum, Aufwand (effort), Status (open/in_progress/completed)
Mapping: Zuständigkeiten/Verantwortlichkeiten werden je Aufgabe über "responsible" erfasst. Kein separates Arbeitspaket-/Hierarchie-Feld.`,
  5: `- milestones: Liste von Meilensteinen, je Meilenstein: Name, Datum, Beschreibung (optional)
Mapping: Kein separates Feld für Quality Gates oder Abhängigkeiten zwischen Meilensteinen.`,
  6: `- budget: Liste von Budgetposten, je Posten: Bezeichnung (item), Anbieter (provider), Betrag (amount), Kategorie (category)
- risks: Liste von Risiken, je Risiko: Typ, Beschreibung, Wahrscheinlichkeit (low/medium/high), Auswirkung (low/medium/high), Gegenmaßnahme (mitigation)
Mapping: Risiko-Strategie/Maßnahmen werden über "mitigation" erfasst. Kein separates Feld für Risiko-Verantwortlichen/-Status oder Budget-Zeitverlauf.`,
  7: `Projektteam (organization), je Person: Name, Rolle (Auswahlliste), Unternehmen, Status (intern/extern), Gruppe (Auswahl: Auftraggeber/Projektteam/Stakeholder), Aufgabe (Freitext), Interesse, Einfluss, Bemerkung (Freitext).
Stakeholder (stakeholders), je Person: Name, Rolle/Position, Status, Interesse, Einfluss, Erwartungen (Freitext).
Mapping wichtig:
- "Auftraggeber/Sponsor": über Gruppe="Auftraggeber" bzw. die Rolle — es gibt KEIN separates Sponsor-Feld.
- "Lenkungskreis/Steering Committee": über Gruppe/Rolle abbilden.
- "Rollenbeschreibung/konkrete Verantwortlichkeiten": über das Feld "Aufgabe".
- "Stellvertreterregelung": über das Feld "Bemerkung".
- Es gibt KEIN separates Jobtitel-Feld; die Funktion steht in "Rolle".`,
};

// Which fields to extract for each step
// Note: We use ensureArray for array fields to handle cases where empty arrays
// might be parsed as empty objects from YAML/JSON
const STEP_DATA_EXTRACTORS: Record<number, (data: Projektauftrag) => Record<string, any>> = {
  1: (data) => ({
    name: data.name,
    project_type: data.project_type,
    start_date: data.start_date,
    end_date: data.end_date,
    projektleiter: data.projektleiter,
    auftraggeber: data.auftraggeber,
    description: data.description,
  }),
  2: (data) => ({
    goals: data.goals,
    criteria: ensureArray(data.criteria),
  }),
  3: (data) => ({
    scope: data.scope,
    in_scope: ensureArray(data.in_scope),
    out_scope: ensureArray(data.out_scope),
  }),
  4: (data) => ({
    tasks: ensureArray(data.tasks),
  }),
  5: (data) => ({
    milestones: ensureArray(data.milestones),
  }),
  6: (data) => ({
    budget: ensureArray(data.budget),
    risks: ensureArray(data.risks),
  }),
  7: (data) => ({
    organization: ensureArray(data.organization),
    stakeholders: ensureArray(data.stakeholders),
  }),
};

// Which previous steps to check for consistency
const CONSISTENCY_CHECKS: Record<number, number[]> = {
  2: [],                    // No previous data to check against
  3: [2],                   // Scope should align with goals
  4: [2, 3],                // Tasks should support goals and cover scope
  5: [4],                   // Milestones should align with tasks and end date
  6: [4, 5],                // Budget/risks should relate to tasks/milestones
  7: [4, 6],                // Organization should cover tasks and address risks
};

// ============== Helper Functions ==============

/**
 * Ensure a value is an array (handles cases where YAML parsing or data loading
 * might return {} instead of [] for empty arrays)
 */
function ensureArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  // Handle case where empty array is parsed as empty object
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return [];
  }
  // If it's a non-empty object, wrap it in an array
  if (typeof value === 'object') {
    return [value];
  }
  return [];
}

/**
 * Format step data for display in prompt
 */
function formatStepData(step: number, data: Record<string, any>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      lines.push(`${key}: (nicht angegeben)`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: (leer)`);
      } else if (typeof value[0] === 'object') {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${formatObject(item)}`);
        }
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof value === 'object') {
      // Check if this looks like an empty array that was parsed as an object
      if (Object.keys(value).length === 0) {
        lines.push(`${key}: (leer)`);
      } else {
        lines.push(`${key}: ${formatObject(value)}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

function formatObject(obj: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.join(', ');
}

/**
 * Format previous steps summary for consistency check
 */
function formatPreviousStepsSummary(projektauftrag: Projektauftrag, stepsToCheck: number[]): string {
  if (stepsToCheck.length === 0) {
    return '(Erster Schritt - keine vorherigen Daten)';
  }

  const summaries: string[] = [];

  for (const step of stepsToCheck) {
    const extractor = STEP_DATA_EXTRACTORS[step];
    if (!extractor) continue;

    const stepData = extractor(projektauftrag);
    const stepName = STEP_NAMES[step];

    summaries.push(`### Schritt ${step}: ${stepName}`);
    summaries.push(formatStepData(step, stepData));
    summaries.push('');
  }

  // Also add basic project info
  summaries.unshift(`### Projekt-Basis`);
  summaries.unshift(`Name: ${projektauftrag.name || '(nicht angegeben)'}`);
  summaries.unshift(`Zeitraum: ${projektauftrag.start_date || '?'} bis ${projektauftrag.end_date || '?'}`);
  summaries.unshift(`Projektleiter: ${projektauftrag.projektleiter || '(nicht angegeben)'}`);
  summaries.unshift('');

  return summaries.join('\n');
}

/**
 * Format pruefkriterien for prompt
 */
function formatPruefkriterien(pruefkriterien: Record<string, string[]>): string {
  const lines: string[] = [];

  for (const [category, criteria] of Object.entries(pruefkriterien)) {
    lines.push(`### ${category}`);
    // Use ensureArray to handle cases where criteria might be {} instead of []
    const criteriaArray = ensureArray(criteria);
    for (const criterion of criteriaArray) {
      lines.push(`- ${criterion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format typische_fehler for prompt
 */
function formatTypischeFehler(fehler: string[] | Record<string, string[]>): string {
  const lines: string[] = [];

  const fehlerArray = ensureArray(fehler);
  if (fehlerArray.length > 0 && typeof fehlerArray[0] === 'string') {
    // It's an array of strings
    for (const f of fehlerArray) {
      lines.push(`- ${f}`);
    }
  } else if (typeof fehler === 'object' && !Array.isArray(fehler)) {
    // It's an object with categories
    for (const [category, items] of Object.entries(fehler)) {
      lines.push(`### ${category}`);
      const itemsArray = ensureArray(items);
      for (const item of itemsArray) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============== Main Analysis Function ==============

/**
 * Analyze a specific step of a Projektauftrag using LLM
 */
export async function analyzeStep(
  step: number,
  projektauftrag: Projektauftrag,
  triggeringUserId?: string
): Promise<StepAnalysisResult> {
  // Validate step
  if (step < 2 || step > 7) {
    throw new Error(`Analyse nur für Schritte 2-7 verfügbar (erhalten: ${step})`);
  }

  // Load knowledge for this step
  const knowledge = await getStepKnowledge(step);
  if (!knowledge) {
    throw new Error(`Keine Knowledge-Daten für Schritt ${step} gefunden`);
  }

  // Extract current step data
  const extractor = STEP_DATA_EXTRACTORS[step];
  const currentStepData = extractor(projektauftrag);

  // Get previous steps for consistency check
  const stepsToCheck = CONSISTENCY_CHECKS[step];

  // Build the analysis prompt
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    step,
    knowledge,
    currentStepData,
    projektauftrag,
    stepsToCheck
  );

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'projektmanagement',
    operation: `analyze_step_${step}`,
  };

  // Call LLM
  const response = await llmService.chat(messages, undefined, usageContext);

  // Parse response
  const result = parseAnalysisResponse(response.content || '', step);

  return result;
}

/**
 * Extrahiert die für einen Step relevanten Auftragsdaten (Chat-/Analyse-Kontext).
 * Steps ohne Extractor (z. B. 8/9) liefern {}.
 */
export function extractStepData(step: number, projektauftrag: Projektauftrag): Record<string, any> {
  const extractor = STEP_DATA_EXTRACTORS[step];
  return extractor ? extractor(projektauftrag) : {};
}

/**
 * System-Prompt für den Wissenspool-Chat eines Steps: Masterclass-Wissen (als
 * Grounding) + die aktuellen Eingaben des Nutzers in diesem Step.
 */
export async function buildStepChatSystemPrompt(
  step: number,
  projektauftrag: Projektauftrag
): Promise<string> {
  const knowledgeMd = await generateAnalysisPrompt(step);
  const stepData = extractStepData(step, projektauftrag);
  const stepName = STEP_NAMES[step] || `Schritt ${step}`;

  const sections: string[] = [
    `Du bist ein erfahrener Projektmanagement-Berater nach der RUHR PM Masterclass Methodik.`,
    `Der Nutzer bearbeitet gerade den Schritt "${stepName}" eines Projektauftrags und stellt dir dazu Fragen.`,
    `Beantworte seine Fragen konkret, konstruktiv und auf Deutsch. Leitplanken:`,
    `- Stütze dich AUSSCHLIESSLICH auf das unten stehende Masterclass-Wissen und die aktuellen Eingaben des Nutzers.`,
    `- Bleib beim Thema dieses Schritts ("${stepName}"). Bei themenfremden Fragen weise freundlich darauf hin.`,
    `- Erfinde keine Fakten. Wenn das Wissen eine Frage nicht abdeckt, sage das offen.`,
    `- Beziehe dich, wo sinnvoll, konkret auf die aktuellen Eingaben des Nutzers.`,
    `- Fasse dich prägnant; nutze bei Bedarf kurze Aufzählungen.`,
  ];

  if (knowledgeMd) {
    sections.push(`\n---\n# Masterclass-Wissen zu diesem Schritt\n\n${knowledgeMd}`);
  } else {
    sections.push(
      `\n(Für diesen Schritt liegt kein spezifisches Masterclass-Wissen vor — antworte aus allgemeiner PM-Best-Practice, bleib aber beim Thema.)`
    );
  }

  sections.push(
    `\n---\n## Aktuelle Eingaben des Nutzers in diesem Schritt\n\n\`\`\`json\n${JSON.stringify(stepData, null, 2)}\n\`\`\``
  );

  return sections.join('\n');
}

/**
 * Build system prompt for LLM
 */
function buildSystemPrompt(): string {
  return `Du bist ein erfahrener Projektmanagement-Berater nach der RUHR PM Masterclass Methodik.
Deine Aufgabe ist es, die Eingaben eines Projektmanagers kritisch aber konstruktiv zu analysieren.

Du prüfst:
1. Gegen die Masterclass-Prüfkriterien (Best Practices)
2. Auf typische Fehler (die vermieden werden sollten)
3. Auf Konsistenz mit bereits erfassten Projektdaten

Dein Feedback soll:
- Konkret und umsetzbar sein
- Stärken würdigen
- Verbesserungspotential aufzeigen
- Inkonsistenzen zwischen Schritten aufdecken

WICHTIG — Bezug auf die im Tool erfassbaren Felder (Abschnitt "Im Tool erfassbare Felder"):
- Schlage NUR Verbesserungen vor, die der Projektmanager über diese Felder tatsächlich umsetzen kann.
- Wenn ein Best-Practice-Konzept bereits über ein vorhandenes Feld abgedeckt ist (z. B. Auftraggeber via Gruppe/Rolle), erkenne das als vorhanden an und melde es NICHT als fehlend.
- Wenn etwas nur über ein Freitextfeld erfassbar ist (z. B. "Bemerkung" oder "Aufgabe"), formuliere die Empfehlung mit klarem Bezug auf dieses Feld (z. B. "… im Feld Bemerkung dokumentieren").
- Fordere NIEMALS Felder oder Strukturen, die es laut diesem Abschnitt im Tool nicht gibt (z. B. einen separaten Jobtitel).

Antworte IMMER im folgenden JSON-Format (und NUR in diesem Format, ohne zusätzlichen Text):

{
  "masterclassAnalysis": {
    "staerken": ["Stärke 1", "Stärke 2"],
    "schwaechen": ["Schwäche 1", "Schwäche 2"],
    "hinweise": ["Konkreter Hinweis 1", "Konkreter Hinweis 2"],
    "score": 75
  },
  "konsistenzAnalysis": {
    "status": "konsistent",
    "findings": [
      {
        "bereich": "Ziele vs Aufgaben",
        "beschreibung": "Konkrete Beobachtung",
        "empfehlung": "Was getan werden sollte"
      }
    ]
  }
}

Der Score (0-100) sollte widerspiegeln:
- 0-40: Grundlegende Probleme, wesentliche Nacharbeit nötig
- 41-60: Ausbaufähig, mehrere Verbesserungen empfohlen
- 61-80: Gut, kleinere Optimierungen möglich
- 81-100: Sehr gut bis exzellent

Der Konsistenz-Status:
- "konsistent": Keine wesentlichen Widersprüche
- "warnung": Kleine Unstimmigkeiten gefunden
- "inkonsistent": Wesentliche Widersprüche vorhanden`;
}

/**
 * Build user prompt with step data and knowledge
 */
function buildUserPrompt(
  step: number,
  knowledge: StepKnowledge,
  currentStepData: Record<string, any>,
  projektauftrag: Projektauftrag,
  stepsToCheck: number[]
): string {
  const stepName = STEP_NAMES[step];

  const sections: string[] = [];

  sections.push(`## Analyse für Schritt ${step}: ${stepName}`);
  sections.push('');

  sections.push('### Aktuelle Eingaben des Projektmanagers:');
  sections.push(formatStepData(step, currentStepData));
  sections.push('');

  if (STEP_FIELD_SCHEMA[step]) {
    sections.push('### Im Tool erfassbare Felder (Verbesserungen MÜSSEN hierüber umsetzbar sein):');
    sections.push(STEP_FIELD_SCHEMA[step]);
    sections.push('');
  }

  if (knowledge.pruefkriterien) {
    sections.push('### Masterclass Prüfkriterien (gegen diese prüfen):');
    sections.push(formatPruefkriterien(knowledge.pruefkriterien));
  }

  if (knowledge.typische_fehler) {
    sections.push('### Typische Fehler (darauf achten):');
    sections.push(formatTypischeFehler(knowledge.typische_fehler));
  }

  sections.push('### Bisherige Projektdaten (für Konsistenz-Prüfung):');
  sections.push(formatPreviousStepsSummary(projektauftrag, stepsToCheck));

  sections.push('');
  sections.push('Analysiere die Eingaben und antworte im JSON-Format.');

  return sections.join('\n');
}

/**
 * Parse LLM response into StepAnalysisResult
 */
function parseAnalysisResponse(content: string, step: number): StepAnalysisResult {
  const stepName = STEP_NAMES[step];

  // Try to extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    // Return default/error result if parsing fails
    return {
      step,
      stepName,
      timestamp: new Date().toISOString(),
      masterclassAnalysis: {
        staerken: [],
        schwaechen: ['Analyse konnte nicht durchgeführt werden'],
        hinweise: ['Bitte versuchen Sie es erneut'],
        score: 0,
      },
      konsistenzAnalysis: {
        status: 'warnung',
        findings: [],
      },
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    const masterclass = parsed.masterclassAnalysis || parsed.masterclass_analysis || {};
    const konsistenz = parsed.konsistenzAnalysis || parsed.konsistenz_analysis || {};

    return {
      step,
      stepName,
      timestamp: new Date().toISOString(),
      masterclassAnalysis: {
        staerken: Array.isArray(masterclass.staerken) ? masterclass.staerken : [],
        schwaechen: Array.isArray(masterclass.schwaechen) ? masterclass.schwaechen : [],
        hinweise: Array.isArray(masterclass.hinweise) ? masterclass.hinweise : [],
        score: typeof masterclass.score === 'number' ? Math.min(100, Math.max(0, masterclass.score)) : 50,
      },
      konsistenzAnalysis: {
        status: ['konsistent', 'warnung', 'inkonsistent'].includes(konsistenz.status)
          ? konsistenz.status
          : 'konsistent',
        findings: Array.isArray(konsistenz.findings)
          ? konsistenz.findings.map((f: any) => ({
              bereich: String(f.bereich || ''),
              beschreibung: String(f.beschreibung || ''),
              empfehlung: String(f.empfehlung || ''),
            }))
          : [],
      },
    };
  } catch (error) {
    console.error('Failed to parse analysis response:', error);

    return {
      step,
      stepName,
      timestamp: new Date().toISOString(),
      masterclassAnalysis: {
        staerken: [],
        schwaechen: ['Analyse-Antwort konnte nicht verarbeitet werden'],
        hinweise: [],
        score: 0,
      },
      konsistenzAnalysis: {
        status: 'warnung',
        findings: [],
      },
    };
  }
}

/**
 * Check if step has enough data for analysis
 */
export function hasEnoughDataForAnalysis(step: number, projektauftrag: Projektauftrag): boolean {
  const extractor = STEP_DATA_EXTRACTORS[step];
  if (!extractor) return false;

  const data = extractor(projektauftrag);

  // Check if there's meaningful data
  for (const value of Object.values(data)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string' && value.trim().length > 0) {
      return true;
    }

    // Array fields are already converted by ensureArray in extractors
    if (Array.isArray(value) && value.length > 0) {
      return true;
    }

    // Handle case where value might still be an object (shouldn't happen with extractors, but be safe)
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
      return true;
    }
  }

  return false;
}

// ============== Gesamtbewertung Types ==============

export interface GesamtbewertungResult {
  timestamp: string;

  // Overall score (weighted average from all steps)
  gesamtScore: number;

  // Project readiness assessment
  projektreife: {
    status: 'bereit' | 'bedingt_bereit' | 'nicht_bereit';
    begruendung: string;
  };

  // Aggregated analysis
  hauptstaerken: string[];       // Top 3-5 overall strengths
  hauptrisiken: string[];        // Top 3-5 critical issues
  handlungsempfehlungen: string[]; // Prioritized recommendations

  // Step-by-step summary (only for steps with analysis)
  stepScores: {
    step: number;
    stepName: string;
    score: number;
    kurzfazit: string;
  }[];

  // Overall risk assessment
  risikoeinschaetzung: {
    level: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
    faktoren: string[];
  };
}

// ============== Gesamtbewertung Function ==============

/**
 * Generate overall project assessment
 * Takes the complete Projektauftrag and optional step analyses (2-7)
 */
export async function analyzeGesamt(
  projektauftrag: Projektauftrag,
  stepAnalyses?: { [step: number]: StepAnalysisResult },
  triggeringUserId?: string
): Promise<GesamtbewertungResult> {
  const systemPrompt = buildGesamtSystemPrompt();
  const userPrompt = buildGesamtUserPrompt(projektauftrag, stepAnalyses);

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'projektmanagement',
    operation: 'analyze_gesamt',
  };

  // Call LLM
  const response = await llmService.chat(messages, undefined, usageContext);

  // Parse response
  const result = parseGesamtResponse(response.content || '', projektauftrag, stepAnalyses);

  return result;
}

/**
 * Build system prompt for Gesamtbewertung
 */
function buildGesamtSystemPrompt(): string {
  return `Du bist ein erfahrener Projektmanagement-Berater nach der RUHR PM Masterclass Methodik.
Du erstellst eine Gesamtbewertung eines Projektauftrags basierend auf:
1. Dem vollständigen Projektauftrag
2. Den bereits durchgeführten Einzelschritt-Analysen (falls vorhanden)

Deine Gesamtbewertung soll:
- Eine realistische Einschätzung der Projektreife geben
- Die wichtigsten Stärken und Risiken hervorheben
- Priorisierte Handlungsempfehlungen liefern
- Auf Basis der Einzelbewertungen einen gewichteten Gesamtscore berechnen

Antworte IMMER im folgenden JSON-Format (und NUR in diesem Format, ohne zusätzlichen Text):

{
  "gesamtScore": 75,
  "projektreife": {
    "status": "bedingt_bereit",
    "begruendung": "Der Projektauftrag ist grundsätzlich gut strukturiert, aber..."
  },
  "hauptstaerken": ["Stärke 1", "Stärke 2", "Stärke 3"],
  "hauptrisiken": ["Risiko 1", "Risiko 2", "Risiko 3"],
  "handlungsempfehlungen": ["Empfehlung 1 (Priorität hoch)", "Empfehlung 2", "Empfehlung 3"],
  "stepKurzfazite": {
    "2": "Kurzes Fazit für Schritt 2",
    "3": "Kurzes Fazit für Schritt 3",
    "4": "Kurzes Fazit für Schritt 4",
    "5": "Kurzes Fazit für Schritt 5",
    "6": "Kurzes Fazit für Schritt 6",
    "7": "Kurzes Fazit für Schritt 7"
  },
  "risikoeinschaetzung": {
    "level": "mittel",
    "faktoren": ["Risikofaktor 1", "Risikofaktor 2"]
  }
}

Bewertungsskala für gesamtScore:
- 0-40: Nicht bereit - Grundlegende Nacharbeit erforderlich
- 41-60: Bedingt bereit - Wesentliche Verbesserungen nötig
- 61-80: Bereit mit Einschränkungen - Kleine Optimierungen empfohlen
- 81-100: Voll bereit - Projekt kann gestartet werden

Projektreifen-Status:
- "nicht_bereit": Wesentliche Mängel, Projektstart nicht empfohlen
- "bedingt_bereit": Mit Auflagen/Nacharbeiten durchführbar
- "bereit": Vollständig und konsistent, Projektstart möglich`;
}

/**
 * Build user prompt for Gesamtbewertung
 */
function buildGesamtUserPrompt(
  projektauftrag: Projektauftrag,
  stepAnalyses?: { [step: number]: StepAnalysisResult }
): string {
  const sections: string[] = [];

  sections.push('# Gesamtbewertung Projektauftrag');
  sections.push('');

  // Project overview
  sections.push('## Projektübersicht');
  sections.push(`Name: ${projektauftrag.name || '(nicht angegeben)'}`);
  sections.push(`Typ: ${projektauftrag.project_type || '(nicht angegeben)'}`);
  sections.push(`Zeitraum: ${projektauftrag.start_date || '?'} bis ${projektauftrag.end_date || '?'}`);
  sections.push(`Projektleiter: ${projektauftrag.projektleiter || '(nicht angegeben)'}`);
  sections.push(`Auftraggeber: ${projektauftrag.auftraggeber || '(nicht angegeben)'}`);
  sections.push('');

  // Key data from each step
  sections.push('## Projektdaten nach Schritten');
  sections.push('');

  sections.push('### Schritt 2: Ziele');
  sections.push(`Ziele: ${projektauftrag.goals || '(nicht angegeben)'}`);
  sections.push(`Kriterien: ${ensureArray(projektauftrag.criteria).join(', ') || '(keine)'}`);
  sections.push('');

  sections.push('### Schritt 3: Umfang');
  sections.push(`Umfang: ${projektauftrag.scope || '(nicht angegeben)'}`);
  sections.push(`In Scope: ${ensureArray(projektauftrag.in_scope).join(', ') || '(keine)'}`);
  sections.push(`Out of Scope: ${ensureArray(projektauftrag.out_scope).join(', ') || '(keine)'}`);
  sections.push('');

  sections.push('### Schritt 4: Aufgaben');
  const tasks = ensureArray(projektauftrag.tasks);
  if (tasks.length > 0) {
    for (const task of tasks) {
      sections.push(`- ${task.name} (${task.responsible || 'k.A.'}, ${task.effort || 0} PT)`);
    }
  } else {
    sections.push('(keine Aufgaben definiert)');
  }
  sections.push('');

  sections.push('### Schritt 5: Meilensteine');
  const milestones = ensureArray(projektauftrag.milestones);
  if (milestones.length > 0) {
    for (const ms of milestones) {
      sections.push(`- ${ms.name} (${ms.date || 'kein Datum'})`);
    }
  } else {
    sections.push('(keine Meilensteine definiert)');
  }
  sections.push('');

  sections.push('### Schritt 6: Budget & Risiken');
  const budget = ensureArray(projektauftrag.budget);
  const totalBudget = budget.reduce((sum, item) => sum + (item.amount || 0), 0);
  sections.push(`Gesamtbudget: ${totalBudget} EUR`);
  const risks = ensureArray(projektauftrag.risks);
  if (risks.length > 0) {
    sections.push('Risiken:');
    for (const risk of risks) {
      sections.push(`- ${risk.type || 'k.A.'}: ${risk.description || 'k.A.'} (Auswirkung: ${risk.impact || 'k.A.'})`);
    }
  } else {
    sections.push('(keine Risiken definiert)');
  }
  sections.push('');

  sections.push('### Schritt 7: Organisation');
  const org = ensureArray(projektauftrag.organization);
  if (org.length > 0) {
    sections.push('Team:');
    for (const member of org) {
      sections.push(`- ${member.name || 'k.A.'}: ${member.role || 'k.A.'}`);
    }
  } else {
    sections.push('(kein Team definiert)');
  }
  const stakeholders = ensureArray(projektauftrag.stakeholders);
  if (stakeholders.length > 0) {
    sections.push('Stakeholder:');
    for (const sh of stakeholders) {
      sections.push(`- ${sh.name || 'k.A.'}: ${sh.role || 'k.A.'}`);
    }
  }
  sections.push('');

  // Include previous step analyses if available
  if (stepAnalyses && Object.keys(stepAnalyses).length > 0) {
    sections.push('## Bereits durchgeführte Einzelschritt-Analysen');
    sections.push('');

    for (const step of [2, 3, 4, 5, 6, 7]) {
      const analysis = stepAnalyses[step];
      if (analysis) {
        sections.push(`### Schritt ${step}: ${analysis.stepName} (Score: ${analysis.masterclassAnalysis?.score || 0}/100)`);
        sections.push(`Stärken: ${ensureArray(analysis.masterclassAnalysis?.staerken).join(', ') || 'keine'}`);
        sections.push(`Schwächen: ${ensureArray(analysis.masterclassAnalysis?.schwaechen).join(', ') || 'keine'}`);
        sections.push(`Konsistenz: ${analysis.konsistenzAnalysis?.status || 'unbekannt'}`);
        sections.push('');
      }
    }
  } else {
    sections.push('## Hinweis');
    sections.push('Es liegen keine vorherigen Einzelschritt-Analysen vor. Erstelle die Gesamtbewertung ausschließlich basierend auf den Projektdaten.');
    sections.push('');
  }

  sections.push('');
  sections.push('Erstelle jetzt eine umfassende Gesamtbewertung im JSON-Format.');

  return sections.join('\n');
}

/**
 * Parse Gesamtbewertung LLM response
 */
function parseGesamtResponse(
  content: string,
  projektauftrag: Projektauftrag,
  stepAnalyses?: { [step: number]: StepAnalysisResult }
): GesamtbewertungResult {
  // Try to extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  // Calculate fallback score from step analyses if available
  let fallbackScore = 50;
  const existingStepScores: { step: number; stepName: string; score: number; kurzfazit: string }[] = [];

  if (stepAnalyses) {
    const scores: number[] = [];
    for (const step of [2, 3, 4, 5, 6, 7]) {
      const analysis = stepAnalyses[step];
      // Defensiv: aeltere/teilweise gespeicherte Analysen koennen kein
      // masterclassAnalysis haben — dann diesen Schritt ueberspringen statt zu crashen.
      const mc = analysis?.masterclassAnalysis;
      if (analysis && typeof mc?.score === 'number') {
        scores.push(mc.score);
        existingStepScores.push({
          step,
          stepName: analysis.stepName,
          score: mc.score,
          kurzfazit: ensureArray(mc.hinweise)[0] || 'Keine Zusammenfassung',
        });
      }
    }
    if (scores.length > 0) {
      fallbackScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  if (!jsonMatch) {
    // Return default result if parsing fails
    return {
      timestamp: new Date().toISOString(),
      gesamtScore: fallbackScore,
      projektreife: {
        status: 'bedingt_bereit',
        begruendung: 'Automatische Bewertung konnte nicht vollständig durchgeführt werden.',
      },
      hauptstaerken: [],
      hauptrisiken: ['Bewertung konnte nicht vollständig durchgeführt werden'],
      handlungsempfehlungen: ['Bitte führen Sie die Gesamtbewertung erneut durch'],
      stepScores: existingStepScores,
      risikoeinschaetzung: {
        level: 'mittel',
        faktoren: [],
      },
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Build step scores from LLM response + existing analyses
    const stepScores: { step: number; stepName: string; score: number; kurzfazit: string }[] = [];

    for (const step of [2, 3, 4, 5, 6, 7]) {
      const analysis = stepAnalyses?.[step];
      const kurzfazit = parsed.stepKurzfazite?.[String(step)] ||
        ensureArray(analysis?.masterclassAnalysis?.hinweise)[0] ||
        'Keine Bewertung';

      stepScores.push({
        step,
        stepName: STEP_NAMES[step],
        score: analysis?.masterclassAnalysis?.score ?? 50,
        kurzfazit,
      });
    }

    // Validate projektreife status
    const validStatuses = ['bereit', 'bedingt_bereit', 'nicht_bereit'];
    const projektreifeStatus = validStatuses.includes(parsed.projektreife?.status)
      ? parsed.projektreife.status
      : 'bedingt_bereit';

    // Validate risk level
    const validRiskLevels = ['niedrig', 'mittel', 'hoch', 'kritisch'];
    const riskLevel = validRiskLevels.includes(parsed.risikoeinschaetzung?.level)
      ? parsed.risikoeinschaetzung.level
      : 'mittel';

    return {
      timestamp: new Date().toISOString(),
      gesamtScore: typeof parsed.gesamtScore === 'number'
        ? Math.min(100, Math.max(0, parsed.gesamtScore))
        : fallbackScore,
      projektreife: {
        status: projektreifeStatus,
        begruendung: String(parsed.projektreife?.begruendung || 'Keine Begründung verfügbar'),
      },
      hauptstaerken: Array.isArray(parsed.hauptstaerken) ? parsed.hauptstaerken : [],
      hauptrisiken: Array.isArray(parsed.hauptrisiken) ? parsed.hauptrisiken : [],
      handlungsempfehlungen: Array.isArray(parsed.handlungsempfehlungen) ? parsed.handlungsempfehlungen : [],
      stepScores,
      risikoeinschaetzung: {
        level: riskLevel,
        faktoren: Array.isArray(parsed.risikoeinschaetzung?.faktoren)
          ? parsed.risikoeinschaetzung.faktoren
          : [],
      },
    };
  } catch (error) {
    console.error('Failed to parse Gesamtbewertung response:', error);

    return {
      timestamp: new Date().toISOString(),
      gesamtScore: fallbackScore,
      projektreife: {
        status: 'bedingt_bereit',
        begruendung: 'Analyse-Antwort konnte nicht verarbeitet werden.',
      },
      hauptstaerken: [],
      hauptrisiken: ['Parsing-Fehler bei der Analyse'],
      handlungsempfehlungen: ['Bitte führen Sie die Gesamtbewertung erneut durch'],
      stepScores: existingStepScores,
      risikoeinschaetzung: {
        level: 'mittel',
        faktoren: [],
      },
    };
  }
}
