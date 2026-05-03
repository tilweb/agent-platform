/**
 * Projektauftrag Import Service
 *
 * Multi-document import pipeline for Projektauftrag/Projektidee creation.
 * Phasen 1+2 (File-zu-Text, Heartbeats, xlsx-Reorder) liegen im shared
 * `services/multiFileImporter.ts`. Hier nur PM-spezifisch:
 *   3) LLM-Extraktion mit forced function calling (PM-Schema)
 *   4) Validation + Auto-Correction
 *   5) Mapping zu Projektauftrag-/Projektidee-Struktur + Persistierung
 */

import { llmService, type Message, type ChatOptions } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { buildFunctionSchema, buildToolChoice } from '../../extraction/schema-builder';
import { validateExtraction } from '../../extraction/validator';
import type { ExtractionProfile } from '../../extraction/types';
import type { Projektauftrag, Projektidee, BusinessCaseItem, Risk } from './types';
import { createProjektauftrag, generateSubEntityId } from './service';
import { createIdee } from './idee-service';
import {
  processFilesToText,
  withHeartbeat,
  HEARTBEAT_MS,
  type FileImportEvent,
  type FileImportEventCallback,
  type FileImportReport,
  type ProcessedFile,
} from '../../services/multiFileImporter';

// ============== Import Report ==============

export interface ImportReport extends FileImportReport {
  fieldsExtracted: number;
}

// ============== Progress-Events ==============

/**
 * Events die der Import-Service waehrend der Pipeline emittiert.
 * Phasen-1+2-Events kommen aus dem shared FileImportEvent; PM-spezifisch
 * sind extracting_*, validating, creating, done, idee_done, error.
 */
export type ImportEvent =
  | FileImportEvent
  | { type: 'extracting_started'; data: { textChars: number } }
  | { type: 'extracting_progress'; data: { elapsedMs: number } }
  | { type: 'extracting_done';     data: { fieldsExtracted: number; durationMs: number } }
  | { type: 'validating';          data: { warningCount: number } }
  | { type: 'creating';            data: Record<string, never> }
  | { type: 'done';                data: { projektauftrag: Projektauftrag; report: ImportReport } }
  | { type: 'idee_done';           data: { projektidee: Projektidee; report: ImportReport } }
  | { type: 'error';               data: { message: string } };

export type ImportEventCallback = (event: ImportEvent) => void | Promise<void>;

// ============== Extraction Profile ==============

const PROJEKTAUFTRAG_PROFILE: ExtractionProfile = {
  id: 'projektauftrag-import',
  name: 'Projektauftrag Import',
  description: 'Projektauftrag aus mehreren Dokumenten extrahieren',
  version: '1.0',
  detection: {
    keywords: ['Projektauftrag', 'Projektleiter', 'Meilensteine', 'Budget'],
  },
  fields: {
    basis: {
      name: { type: 'text', required: true, label: 'Projektname', hint: 'Name oder Titel des Projekts' },
      project_id: { type: 'text', label: 'Projekt-ID', hint: 'Optional: Kennummer (z.B. PRJ-2026-001)' },
      project_type: { type: 'text', label: 'Projekttyp', hint: 'Einer von: internal, external, research, infrastructure. Deutsch: Intern, Extern, Forschung, Infrastruktur' },
      project_status: { type: 'text', label: 'Projektstatus', hint: 'Einer von: initiation, planning, execution, closing, stopped. Deutsch: Initiierung, Planung, Umsetzung, Abschluss, Gestoppt' },
      project_driver: { type: 'text', label: 'Projekttreiber', hint: 'Einer von: strategic, legal, operational. Deutsch: Strategisch, Gesetzlich, Operativ' },
      project_size: { type: 'text', label: 'Projektgroesse', hint: 'Einer von: small, medium, large. Deutsch: Klein, Mittel, Gross' },
      priority: { type: 'text', label: 'Prioritaet', hint: 'Einer von: low, medium, high, critical. Deutsch: Niedrig, Mittel, Hoch, Kritisch' },
      start_date: { type: 'date', label: 'Startdatum' },
      end_date: { type: 'date', label: 'Enddatum' },
      projektleiter: { type: 'text', label: 'Projektleiter', hint: 'Name des Projektleiters / Project Managers' },
      auftraggeber: { type: 'text', label: 'Auftraggeber', hint: 'Auftraggeber / Sponsor / Kunde' },
      description: { type: 'text', label: 'Beschreibung', hint: 'Kurzbeschreibung des Projekts' },
    },
    kriterien: {
      _array: true,
      _item_fields: {
        text: { type: 'text', required: true, label: 'Erfolgskriterium' },
      },
    },
    ziele: {
      goals: { type: 'text', label: 'Projektziele', hint: 'Beschreibung der Projektziele' },
      scope: { type: 'text', label: 'Projektumfang / Scope', hint: 'Beschreibung des Projektumfangs' },
    },
    in_scope: {
      _array: true,
      _item_fields: {
        text: { type: 'text', required: true, label: 'Im Scope enthalten' },
      },
    },
    out_scope: {
      _array: true,
      _item_fields: {
        text: { type: 'text', required: true, label: 'Nicht im Scope' },
      },
    },
    aufgaben: {
      _array: true,
      _item_fields: {
        name: { type: 'text', required: true, label: 'Aufgabenname' },
        responsible: { type: 'text', label: 'Verantwortlich' },
        start_date: { type: 'date', label: 'Start' },
        end_date: { type: 'date', label: 'Ende' },
        effort: { type: 'number', label: 'Aufwand in Stunden' },
      },
    },
    meilensteine: {
      _array: true,
      _item_fields: {
        name: { type: 'text', required: true, label: 'Meilenstein-Name' },
        date: { type: 'date', label: 'Datum' },
        description: { type: 'text', label: 'Beschreibung' },
      },
    },
    budget: {
      _array: true,
      _item_fields: {
        item: { type: 'text', required: true, label: 'Budgetposition' },
        provider: { type: 'text', label: 'Anbieter / Lieferant' },
        amount: { type: 'number', label: 'Betrag in EUR' },
        category: { type: 'text', label: 'Kategorie' },
      },
    },
    risiken: {
      _array: true,
      _item_fields: {
        type: { type: 'text', label: 'Risikotyp', hint: 'z.B. technisch, organisatorisch, finanziell' },
        description: { type: 'text', required: true, label: 'Risikobeschreibung' },
        probability: { type: 'text', label: 'Eintrittswahrscheinlichkeit', hint: 'Einer von: low, medium, high' },
        impact: { type: 'text', label: 'Auswirkung', hint: 'Einer von: low, medium, high' },
        mitigation: { type: 'text', label: 'Gegenmaßnahme' },
      },
    },
    team: {
      _array: true,
      _item_fields: {
        name: { type: 'text', required: true, label: 'Name des Teammitglieds' },
        role: { type: 'text', label: 'Rolle im Projekt' },
        email: { type: 'text', label: 'E-Mail' },
        availability: { type: 'number', label: 'Verfügbarkeit in Prozent' },
      },
    },
    stakeholder: {
      _array: true,
      _item_fields: {
        name: { type: 'text', required: true, label: 'Stakeholder-Name' },
        role: { type: 'text', label: 'Rolle / Position' },
        interest: { type: 'text', label: 'Interesse', hint: 'Einer von: low, medium, high' },
        influence: { type: 'text', label: 'Einfluss', hint: 'Einer von: low, medium, high' },
        expectations: { type: 'text', label: 'Erwartungen' },
      },
    },
  },
  guidelines: `Du bist ein erfahrener Projektmanagement-Experte. Extrahiere alle verfügbaren Projektinformationen aus den gegebenen Dokumenten.

Regeln:
- Extrahiere NUR Informationen, die explizit in den Dokumenten stehen. ERFINDE NICHTS.
- Setze fehlende Werte auf null.
- Datumsangaben immer im Format YYYY-MM-DD.
- Zahlen als numerische Werte (nicht als String).

Gültige Enum-Werte:
- project_type: "internal", "external", "research", "infrastructure"
- project_status: "initiation", "planning", "execution", "closing", "stopped"
- project_driver: "strategic", "legal", "operational"
- project_size: "small", "medium", "large"
- priority: "low", "medium", "high", "critical"
- probability: "low", "medium", "high"
- impact: "low", "medium", "high"
- interest: "low", "medium", "high"
- influence: "low", "medium", "high"

Wenn ein Wert wie "Hoch", "Mittel", "Niedrig" vorkommt, übersetze ihn in den englischen Enum-Wert.
Wenn ein Projekttyp wie "Intern", "Extern" vorkommt, übersetze ihn in den englischen Enum-Wert.
Bei Projektstatus: "Initiierung"→"initiation", "Planung"→"planning", "Umsetzung"/"Durchführung"→"execution", "Abschluss"→"closing", "Gestoppt"/"Pausiert"→"stopped".
Bei Projekttreiber: "Strategisch"→"strategic", "Gesetzlich"/"Compliance"→"legal", "Operativ"→"operational".
Bei Projektgröße: "Klein"→"small", "Mittel"→"medium", "Groß"→"large".
Bei Priorität: "Kritisch"/"Critical"→"critical".

Die Dokumente können verschiedene Formate und Quellen haben (Screenshots, Tabellen, Texte). Kombiniere die Informationen aus allen Quellen zu einem konsistenten Ergebnis.`,
};

// ============== LLM Extraction ==============

/**
 * Extract structured data from combined text using forced function calling
 */
async function extractWithLLM(
  combinedText: string,
  userId?: string
): Promise<Record<string, unknown>> {
  const functionSchema = buildFunctionSchema(PROJEKTAUFTRAG_PROFILE);
  const toolChoice = buildToolChoice(PROJEKTAUFTRAG_PROFILE);

  const systemPrompt = `Du bist ein erfahrener Projektmanagement-Experte und Dokumenten-Extraktions-Spezialist.
Deine Aufgabe: Extrahiere strukturierte Projektauftragsdaten aus den gegebenen Dokumenten.

Allgemeine Regeln:
- Datumsangaben immer im Format YYYY-MM-DD
- Fehlende Werte als null setzen, NICHT erfinden
- Zahlen als numerische Werte (nicht als String)
- Text exakt aus den Dokumenten übernehmen
- Informationen aus allen Dokumenten zusammenführen

${PROJEKTAUFTRAG_PROFILE.guidelines}`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Extrahiere die strukturierten Projektauftragsdaten aus folgenden Dokumenten:\n\n${combinedText}` },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'import_extract',
  };

  const options: ChatOptions = {
    userId,
    toolChoice: toolChoice as ChatOptions['toolChoice'],
  };

  const response = await llmService.chat(messages, [functionSchema], usageContext, options);

  // Primary: tool_calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    const args = response.tool_calls[0]!.function.arguments;
    try {
      return JSON.parse(args);
    } catch {
      throw new Error(`Ungültiges JSON in Function-Call-Antwort: ${args.substring(0, 200)}`);
    }
  }

  // Fallback: JSON from content
  if (response.content) {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through
      }
    }
  }

  throw new Error('LLM hat keine strukturierten Daten zurückgegeben');
}

// ============== Mapping ==============

/**
 * Normalize enum values (German → English)
 */
function normalizeProjectType(value: unknown): Projektauftrag['project_type'] {
  if (typeof value !== 'string') return 'internal';
  const map: Record<string, Projektauftrag['project_type']> = {
    internal: 'internal', intern: 'internal',
    external: 'external', extern: 'external',
    research: 'research', forschung: 'research',
    infrastructure: 'infrastructure', infrastruktur: 'infrastructure',
  };
  return map[value.toLowerCase()] || 'internal';
}

function normalizeLowMediumHigh(value: unknown): 'low' | 'medium' | 'high' {
  if (typeof value !== 'string') return 'medium';
  const map: Record<string, 'low' | 'medium' | 'high'> = {
    low: 'low', niedrig: 'low', gering: 'low',
    medium: 'medium', mittel: 'medium',
    high: 'high', hoch: 'high',
  };
  return map[value.toLowerCase()] || 'medium';
}

function normalizeAuftragPriority(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, string> = {
    low: 'low', niedrig: 'low', gering: 'low',
    medium: 'medium', mittel: 'medium',
    high: 'high', hoch: 'high',
    critical: 'critical', kritisch: 'critical',
  };
  return map[value.toLowerCase()];
}

function normalizeAuftragSize(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, string> = {
    small: 'small', klein: 'small',
    medium: 'medium', mittel: 'medium',
    large: 'large', gross: 'large', 'groß': 'large', big: 'large',
  };
  return map[value.toLowerCase().trim()];
}

function normalizeAuftragDriver(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, string> = {
    strategic: 'strategic', strategisch: 'strategic',
    legal: 'legal', gesetzlich: 'legal', compliance: 'legal',
    operational: 'operational', operativ: 'operational',
  };
  return map[value.toLowerCase()];
}

function normalizeAuftragProjectStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, string> = {
    initiation: 'initiation', initiierung: 'initiation', initialisierung: 'initiation',
    planning: 'planning', planung: 'planning',
    execution: 'execution', umsetzung: 'execution', durchfuehrung: 'execution', 'durchführung': 'execution',
    closing: 'closing', abschluss: 'closing',
    stopped: 'stopped', gestoppt: 'stopped', pausiert: 'stopped',
  };
  return map[value.toLowerCase()];
}

/**
 * Map flat extraction result to nested Projektauftrag structure
 */
function mapToProjektauftrag(data: Record<string, unknown>): Partial<Projektauftrag> {
  const basis = (data.basis || {}) as Record<string, unknown>;
  const ziele = (data.ziele || {}) as Record<string, unknown>;
  const kriterien = (data.kriterien || []) as Array<Record<string, unknown>>;
  const inScope = (data.in_scope || []) as Array<Record<string, unknown>>;
  const outScope = (data.out_scope || []) as Array<Record<string, unknown>>;
  const aufgaben = (data.aufgaben || []) as Array<Record<string, unknown>>;
  const meilensteine = (data.meilensteine || []) as Array<Record<string, unknown>>;
  const budgetItems = (data.budget || []) as Array<Record<string, unknown>>;
  const risiken = (data.risiken || []) as Array<Record<string, unknown>>;
  const teamItems = (data.team || []) as Array<Record<string, unknown>>;
  const stakeholderItems = (data.stakeholder || []) as Array<Record<string, unknown>>;

  const result: Partial<Projektauftrag> = {};

  // Basis
  if (basis.name) result.name = String(basis.name);
  if (basis.project_id) (result as { project_id?: string }).project_id = String(basis.project_id);
  if (basis.project_type) result.project_type = normalizeProjectType(basis.project_type);
  const projectStatus = normalizeAuftragProjectStatus(basis.project_status);
  if (projectStatus) (result as { project_status?: string }).project_status = projectStatus;
  const projectDriver = normalizeAuftragDriver(basis.project_driver);
  if (projectDriver) (result as { project_driver?: string }).project_driver = projectDriver;
  const projectSize = normalizeAuftragSize(basis.project_size);
  if (projectSize) (result as { project_size?: string }).project_size = projectSize;
  const priority = normalizeAuftragPriority(basis.priority);
  if (priority) (result as { priority?: string }).priority = priority;
  if (basis.start_date) result.start_date = String(basis.start_date);
  if (basis.end_date) result.end_date = String(basis.end_date);
  if (basis.projektleiter) result.projektleiter = String(basis.projektleiter);
  if (basis.auftraggeber) result.auftraggeber = String(basis.auftraggeber);
  if (basis.description) result.description = String(basis.description);

  // Ziele
  if (ziele.goals) result.goals = String(ziele.goals);
  if (ziele.scope) result.scope = String(ziele.scope);

  // Kriterien → criteria (string array)
  if (Array.isArray(kriterien) && kriterien.length > 0) {
    result.criteria = kriterien
      .filter((k) => k.text)
      .map((k) => String(k.text));
  }

  // In/Out Scope → string arrays
  if (Array.isArray(inScope) && inScope.length > 0) {
    result.in_scope = inScope
      .filter((s) => s.text)
      .map((s) => String(s.text));
  }
  if (Array.isArray(outScope) && outScope.length > 0) {
    result.out_scope = outScope
      .filter((s) => s.text)
      .map((s) => String(s.text));
  }

  // Aufgaben → tasks
  if (Array.isArray(aufgaben) && aufgaben.length > 0) {
    result.tasks = aufgaben
      .filter((a) => a.name)
      .map((a) => ({
        id: generateSubEntityId(),
        name: String(a.name || ''),
        responsible: String(a.responsible || ''),
        start_date: String(a.start_date || ''),
        end_date: String(a.end_date || ''),
        effort: Number(a.effort) || 0,
        status: 'open' as const,
      }));
  }

  // Meilensteine → milestones
  if (Array.isArray(meilensteine) && meilensteine.length > 0) {
    result.milestones = meilensteine
      .filter((m) => m.name)
      .map((m) => ({
        id: generateSubEntityId(),
        name: String(m.name || ''),
        date: String(m.date || ''),
        description: m.description ? String(m.description) : undefined,
      }));
  }

  // Budget
  if (Array.isArray(budgetItems) && budgetItems.length > 0) {
    result.budget = budgetItems
      .filter((b) => b.item)
      .map((b) => ({
        id: generateSubEntityId(),
        item: String(b.item || ''),
        provider: b.provider ? String(b.provider) : undefined,
        amount: Number(b.amount) || 0,
        category: b.category ? String(b.category) : undefined,
      }));
  }

  // Risiken → risks
  if (Array.isArray(risiken) && risiken.length > 0) {
    result.risks = risiken
      .filter((r) => r.description)
      .map((r) => ({
        id: generateSubEntityId(),
        type: String(r.type || ''),
        description: String(r.description || ''),
        probability: normalizeLowMediumHigh(r.probability),
        impact: normalizeLowMediumHigh(r.impact),
        mitigation: String(r.mitigation || ''),
      }));
  }

  // Team → organization
  if (Array.isArray(teamItems) && teamItems.length > 0) {
    result.organization = teamItems
      .filter((t) => t.name)
      .map((t) => ({
        id: generateSubEntityId(),
        name: String(t.name || ''),
        role: String(t.role || ''),
        email: t.email ? String(t.email) : undefined,
        availability: t.availability ? Number(t.availability) : undefined,
      }));
  }

  // Stakeholder
  if (Array.isArray(stakeholderItems) && stakeholderItems.length > 0) {
    result.stakeholders = stakeholderItems
      .filter((s) => s.name)
      .map((s) => ({
        id: generateSubEntityId(),
        name: String(s.name || ''),
        role: String(s.role || ''),
        interest: normalizeLowMediumHigh(s.interest),
        influence: normalizeLowMediumHigh(s.influence),
        expectations: s.expectations ? String(s.expectations) : undefined,
      }));
  }

  return result;
}

/**
 * Count extracted fields for the report
 */
function countExtractedFields(data: Partial<Projektauftrag>): number {
  let count = 0;
  const ext = data as Record<string, unknown>;
  // Scalar fields
  if (data.name) count++;
  if (ext.project_id) count++;
  if (data.project_type) count++;
  if (ext.project_status) count++;
  if (ext.project_driver) count++;
  if (ext.project_size) count++;
  if (ext.priority) count++;
  if (data.start_date) count++;
  if (data.end_date) count++;
  if (data.projektleiter) count++;
  if (data.auftraggeber) count++;
  if (data.description) count++;
  if (data.goals) count++;
  if (data.scope) count++;
  // Arrays
  if (data.criteria?.length) count += data.criteria.length;
  if (data.in_scope?.length) count += data.in_scope.length;
  if (data.out_scope?.length) count += data.out_scope.length;
  if (data.tasks?.length) count += data.tasks.length;
  if (data.milestones?.length) count += data.milestones.length;
  if (data.budget?.length) count += data.budget.length;
  if (data.risks?.length) count += data.risks.length;
  if (data.organization?.length) count += data.organization.length;
  if (data.stakeholders?.length) count += data.stakeholders.length;
  return count;
}

// ============== Shared File-Processing Helper ==============

/**
/**
 * Mergt das (sub-)Report von der shared file-pipeline in das PM-eigene
 * Report-Objekt — `fieldsExtracted` bleibt unbeeinflusst, der Rest wird
 * uebernommen.
 */
function mergeReport(report: ImportReport, sub: FileImportReport): void {
  report.filesProcessed = sub.filesProcessed;
  report.filesFailed = sub.filesFailed;
  report.errors.push(...sub.errors);
  report.warnings.push(...sub.warnings);
}

// ============== Main Import Function ==============

export async function importProjektauftrag(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  userId: string,
  onEvent?: ImportEventCallback,
): Promise<{ projektauftrag: Projektauftrag; report: ImportReport }> {
  const report: ImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    fieldsExtracted: 0,
    errors: [],
    warnings: [],
  };

  const emit = onEvent ?? (async () => { /* noop */ });

  console.log(`[PM-Import] Starting import with ${files.length} files`);

  const { combinedText, report: subReport } = await processFilesToText(files, {
    userId,
    emit,
    logPrefix: 'PM-Import',
  });
  mergeReport(report, subReport);

  // 3. LLM extraction
  console.log('[PM-Import] Starting LLM extraction...');
  await emit({ type: 'extracting_started', data: { textChars: combinedText.length } });
  const extractStart = Date.now();
  const extractedData = await withHeartbeat(
    extractWithLLM(combinedText, userId),
    HEARTBEAT_MS,
    async (elapsedMs) => {
      await emit({ type: 'extracting_progress', data: { elapsedMs } });
    },
  );

  // 4. Validate + auto-correct
  const validation = validateExtraction(extractedData, PROJEKTAUFTRAG_PROFILE);
  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      report.warnings.push(`Validierung: ${err.field} - ${err.message}`);
    }
  }
  if (validation.corrected.length > 0) {
    console.log(`[PM-Import] Auto-corrected fields: ${validation.corrected.join(', ')}`);
  }
  await emit({ type: 'validating', data: { warningCount: validation.errors.length } });

  // 5. Map to Projektauftrag structure
  const mappedData = mapToProjektauftrag(extractedData);
  report.fieldsExtracted = countExtractedFields(mappedData);

  console.log(`[PM-Import] Extracted ${report.fieldsExtracted} fields`);
  await emit({
    type: 'extracting_done',
    data: { fieldsExtracted: report.fieldsExtracted, durationMs: Date.now() - extractStart },
  });

  // 6. Create Projektauftrag
  await emit({ type: 'creating', data: {} });
  const projektauftrag = await createProjektauftrag(mappedData, userId);

  console.log(`[PM-Import] Created Projektauftrag: ${projektauftrag.id}`);
  await emit({ type: 'done', data: { projektauftrag, report } });

  return { projektauftrag, report };
}

// ============================================================================
// Projektidee-Import — gleiche Pipeline (Phase 1+2) wie Projektauftrag, aber
// schlankeres LLM-Profile, andere Extraction-Guidelines, anderer Mapper +
// andere Persistence (createIdee statt createProjektauftrag).
// ============================================================================

const PROJEKTIDEE_PROFILE: ExtractionProfile = {
  id: 'projektidee-import',
  name: 'Projektidee Import',
  description: 'Projektidee aus Brainstorm-Artefakten (Whiteboards, Workshops, Konzept-PDFs) extrahieren',
  version: '1.0',
  detection: {
    keywords: ['Projektidee', 'Vision', 'Konzept', 'Treiber', 'Business Case'],
  },
  fields: {
    basis: {
      name: { type: 'text', required: true, label: 'Projektname', hint: 'Name oder Titel der Projektidee' },
      projekt_id: { type: 'text', label: 'Projekt-ID', hint: 'Optional: Kennummer (z.B. PRJ-2026-001)' },
      project_type: { type: 'text', label: 'Projekttyp', hint: 'Einer von: internal, external, research, infrastructure' },
      project_status: { type: 'text', label: 'Projektstatus', hint: 'Freitext, z.B. Konzept, Pre-Approval' },
      projekttreiber: { type: 'text', label: 'Projekttreiber', hint: 'Wer treibt diese Idee? z.B. HR, IT-Strategie, Marketing' },
      projektgroesse: { type: 'text', label: 'Projektgroesse', hint: 'Einer von: klein, mittel, gross, sehr_gross' },
      prioritaet: { type: 'text', label: 'Prioritaet', hint: 'Einer von: low, medium, high, critical' },
      description: { type: 'text', label: 'Kurzbeschreibung', hint: 'Idee in wenigen Saetzen' },
      start_date: { type: 'date', label: 'Geplantes Startdatum' },
      end_date: { type: 'date', label: 'Geplantes Enddatum' },
      projektleiter: { type: 'text', label: 'Vorgesehener Projektleiter' },
      auftraggeber: { type: 'text', label: 'Vorgesehener Auftraggeber' },
    },
    ziele: {
      goals: { type: 'text', label: 'Projektziele', hint: 'Vision / Outcome — Tasks/Milestones gehoeren NICHT hierher' },
    },
    kontext: {
      ausgangslage: { type: 'text', label: 'Ausgangslage', hint: 'Warum und in welchem Rahmen ist die Idee entstanden?' },
      rahmenbedingungen: { type: 'text', label: 'Rahmenbedingungen', hint: 'Constraints, Abhaengigkeiten, regulatorische Vorgaben' },
    },
    in_scope: {
      _array: true,
      _item_fields: {
        text: { type: 'text', required: true, label: 'Was gehoert in den Projektumfang?' },
      },
    },
    out_scope: {
      _array: true,
      _item_fields: {
        text: { type: 'text', required: true, label: 'Was gehoert NICHT in den Projektumfang?' },
      },
    },
    investitionen: {
      _array: true,
      _item_fields: {
        beschreibung: { type: 'text', required: true, label: 'Investitions-Position', hint: 'Aussagekraeftige Beschreibung inkl. Anbieter/Quelle wenn bekannt' },
        betrag: { type: 'number', label: 'Betrag in EUR (immer positiv)' },
      },
    },
    nutzen: {
      _array: true,
      _item_fields: {
        beschreibung: { type: 'text', required: true, label: 'Nutzen-Position', hint: 'Aussagekraeftige Beschreibung des erwarteten Ertrags' },
        betrag: { type: 'number', label: 'Erwarteter Ertrag in EUR (immer positiv)' },
      },
    },
    unternehmensrisiken: {
      _array: true,
      _item_fields: {
        type: { type: 'text', label: 'Risikotyp', hint: 'z.B. strategisch, operativ, finanziell, rechtlich, technisch, markt, chance' },
        description: { type: 'text', required: true, label: 'Risikobeschreibung' },
        probability: { type: 'text', label: 'Eintrittswahrscheinlichkeit', hint: 'Einer von: low, medium, high' },
        impact: { type: 'text', label: 'Auswirkung', hint: 'Einer von: low, medium, high' },
        mitigation: { type: 'text', label: 'Gegenmassnahme / Nutzungsplan' },
      },
    },
  },
  guidelines: `Du extrahierst eine PROJEKTIDEE — also eine fruehe Konzept-Skizze, KEINEN detaillierten Auftrag.

WICHTIG: Tasks, Meilensteine, Stakeholder, Team-Mitglieder gehoeren NICHT in eine Idee. Diese Felder kommen erst spaeter im Projektauftrag. Wenn das Quell-Dokument solche Listen enthaelt, IGNORIERE sie.

Konzentriere dich auf:
- Vision / Outcome / Was soll erreicht werden?
- Treiber / Motivation / Welche strategische Frage?
- Ausgangslage / Status Quo / Welches Problem?
- Scope-Abgrenzung: Was gehoert in den Projektumfang (in_scope) und was AUSDRUECKLICH NICHT (out_scope)? Auf Whiteboards oft als zwei Spalten "drin"/"draussen" oder mit Ja/Nein-Symbolen markiert.
- Business Case-Skizze: Investitionen vs. Nutzen (alle Betraege POSITIV erfassen — Vorzeichen wird in der ROI-Rechnung interpretiert)
- Strategische Risiken & Chancen auf Unternehmensebene

Whiteboard-Fotos / Skizzen / Mind-Maps:
- Interpretiere Pfeile, Cluster, Hierarchien
- Investitionen sind oft links/unten, Nutzen rechts/oben (oder umgekehrt) visuell getrennt
- Ueberschriften haben groessere Schrift / sind eingerahmt
- Stichworte ohne Kontext darfst du in plausible Felder einsortieren (z.B. "DSGVO" → unternehmensrisiken)

Allgemeine Regeln:
- Extrahiere NUR Informationen, die explizit im Quell-Material stehen oder klar daraus interpretierbar sind. ERFINDE NICHTS.
- Setze fehlende Werte auf null.
- Datumsangaben im Format YYYY-MM-DD.
- Zahlen als numerische Werte (nicht als String).

Gueltige Enum-Werte:
- project_type: "internal", "external", "research", "infrastructure"
- projektgroesse: "klein", "mittel", "gross", "sehr_gross"
- prioritaet: "low", "medium", "high", "critical"
- probability/impact: "low", "medium", "high"

Deutsche Werte uebersetzen:
- "Hoch"/"Mittel"/"Niedrig" → "high"/"medium"/"low"
- "Gross"/"Klein" → "gross"/"klein"
- "Intern"/"Extern" → "internal"/"external"
- "Kritisch" → "critical"`,
};

async function extractIdeeWithLLM(
  combinedText: string,
  userId?: string
): Promise<Record<string, unknown>> {
  const functionSchema = buildFunctionSchema(PROJEKTIDEE_PROFILE);
  const toolChoice = buildToolChoice(PROJEKTIDEE_PROFILE);

  const systemPrompt = `Du bist ein erfahrener Innovationsmanager und Konzept-Spezialist.
Deine Aufgabe: Aus den gegebenen Brainstorm-Artefakten (Whiteboard-Fotos, Workshop-Notizen, Konzept-Dokumenten)
eine strukturierte Projektidee extrahieren.

${PROJEKTIDEE_PROFILE.guidelines}`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Extrahiere die Projektidee aus folgenden Materialien:\n\n${combinedText}` },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'import_extract_idee',
  };

  const options: ChatOptions = {
    userId,
    toolChoice: toolChoice as ChatOptions['toolChoice'],
  };

  const response = await llmService.chat(messages, [functionSchema], usageContext, options);

  // Primary: tool_calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    const args = response.tool_calls[0]!.function.arguments;
    try {
      return JSON.parse(args);
    } catch {
      throw new Error(`Ungueltiges JSON in Function-Call-Antwort: ${args.substring(0, 200)}`);
    }
  }

  // Fallback: JSON aus content
  if (response.content) {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through
      }
    }
  }

  throw new Error('LLM hat keine strukturierten Daten zurueckgegeben');
}

function normalizeIdeeProjektgroesse(value: unknown): Projektidee['projektgroesse'] | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, NonNullable<Projektidee['projektgroesse']>> = {
    klein: 'klein', small: 'klein',
    mittel: 'mittel', medium: 'mittel', mid: 'mittel',
    gross: 'gross', large: 'gross', big: 'gross', groß: 'gross',
    sehr_gross: 'sehr_gross', 'sehr gross': 'sehr_gross', 'sehr_groß': 'sehr_gross', 'sehr groß': 'sehr_gross', xlarge: 'sehr_gross',
  };
  return map[value.toLowerCase().trim()];
}

function normalizeIdeePrioritaet(value: unknown): Projektidee['prioritaet'] | undefined {
  if (typeof value !== 'string') return undefined;
  const map: Record<string, NonNullable<Projektidee['prioritaet']>> = {
    low: 'low', niedrig: 'low', gering: 'low',
    medium: 'medium', mittel: 'medium',
    high: 'high', hoch: 'high',
    critical: 'critical', kritisch: 'critical',
  };
  return map[value.toLowerCase()];
}

/**
 * Map flat extraction result auf Projektidee-Struktur.
 */
function mapToProjektidee(data: Record<string, unknown>): Partial<Projektidee> {
  const basis = (data.basis || {}) as Record<string, unknown>;
  const ziele = (data.ziele || {}) as Record<string, unknown>;
  const kontext = (data.kontext || {}) as Record<string, unknown>;
  const inScope = (data.in_scope || []) as Array<Record<string, unknown>>;
  const outScope = (data.out_scope || []) as Array<Record<string, unknown>>;
  const investitionen = (data.investitionen || []) as Array<Record<string, unknown>>;
  const nutzen = (data.nutzen || []) as Array<Record<string, unknown>>;
  const risiken = (data.unternehmensrisiken || []) as Array<Record<string, unknown>>;

  const result: Partial<Projektidee> = {};

  // Basis
  if (basis.name) result.name = String(basis.name);
  if (basis.projekt_id) result.projekt_id = String(basis.projekt_id);
  if (basis.project_type) {
    const t = normalizeProjectType(basis.project_type);
    // normalizeProjectType faellt auf 'internal' zurueck — wir akzeptieren das,
    // weil das LLM project_type meist explizit setzt oder gar nicht. Fuer Idee
    // ist 'internal' ein sinnvoller Default.
    result.project_type = t;
  }
  if (basis.project_status) result.project_status = String(basis.project_status);
  if (basis.projekttreiber) result.projekttreiber = String(basis.projekttreiber);
  const groesse = normalizeIdeeProjektgroesse(basis.projektgroesse);
  if (groesse) result.projektgroesse = groesse;
  const prio = normalizeIdeePrioritaet(basis.prioritaet);
  if (prio) result.prioritaet = prio;
  if (basis.description) result.description = String(basis.description);
  if (basis.start_date) result.start_date = String(basis.start_date);
  if (basis.end_date) result.end_date = String(basis.end_date);
  if (basis.projektleiter) result.projektleiter = String(basis.projektleiter);
  if (basis.auftraggeber) result.auftraggeber = String(basis.auftraggeber);

  // Ziele
  if (ziele.goals) result.goals = String(ziele.goals);

  // Kontext
  result.context = {
    ausgangslage: kontext.ausgangslage ? String(kontext.ausgangslage) : '',
    rahmenbedingungen: kontext.rahmenbedingungen ? String(kontext.rahmenbedingungen) : '',
  };

  // In/Out Scope
  if (Array.isArray(inScope) && inScope.length > 0) {
    result.in_scope = inScope.filter((s) => s.text).map((s) => String(s.text));
  } else {
    result.in_scope = [];
  }
  if (Array.isArray(outScope) && outScope.length > 0) {
    result.out_scope = outScope.filter((s) => s.text).map((s) => String(s.text));
  } else {
    result.out_scope = [];
  }

  // Business Case
  const mapBcItem = (it: Record<string, unknown>): BusinessCaseItem => ({
    id: generateSubEntityId(),
    beschreibung: String(it.beschreibung || ''),
    betrag: Math.abs(Number(it.betrag) || 0),
  });

  result.business_case = {
    investitionen: Array.isArray(investitionen)
      ? investitionen.filter((i) => i.beschreibung).map(mapBcItem)
      : [],
    nutzen: Array.isArray(nutzen)
      ? nutzen.filter((n) => n.beschreibung).map(mapBcItem)
      : [],
  };

  // Unternehmensrisiken
  if (Array.isArray(risiken) && risiken.length > 0) {
    result.unternehmensrisiken = risiken
      .filter((r) => r.description)
      .map((r): Risk => ({
        id: generateSubEntityId(),
        type: String(r.type || ''),
        description: String(r.description || ''),
        probability: normalizeLowMediumHigh(r.probability),
        impact: normalizeLowMediumHigh(r.impact),
        mitigation: String(r.mitigation || ''),
      }));
  } else {
    result.unternehmensrisiken = [];
  }

  return result;
}

function countExtractedIdeeFields(data: Partial<Projektidee>): number {
  let count = 0;
  if (data.name) count++;
  if (data.projekt_id) count++;
  if (data.project_type) count++;
  if (data.project_status) count++;
  if (data.projekttreiber) count++;
  if (data.projektgroesse) count++;
  if (data.prioritaet) count++;
  if (data.description) count++;
  if (data.start_date) count++;
  if (data.end_date) count++;
  if (data.projektleiter) count++;
  if (data.auftraggeber) count++;
  if (data.goals) count++;
  if (data.context?.ausgangslage) count++;
  if (data.context?.rahmenbedingungen) count++;
  if (data.in_scope?.length) count += data.in_scope.length;
  if (data.out_scope?.length) count += data.out_scope.length;
  if (data.business_case?.investitionen?.length) count += data.business_case.investitionen.length;
  if (data.business_case?.nutzen?.length) count += data.business_case.nutzen.length;
  if (data.unternehmensrisiken?.length) count += data.unternehmensrisiken.length;
  return count;
}

export async function importProjektidee(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  userId: string,
  onEvent?: ImportEventCallback,
): Promise<{ projektidee: Projektidee; report: ImportReport }> {
  const report: ImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    fieldsExtracted: 0,
    errors: [],
    warnings: [],
  };

  const emit = onEvent ?? (async () => { /* noop */ });

  console.log(`[PM-Idee-Import] Starting import with ${files.length} files`);

  const { combinedText, report: subReport } = await processFilesToText(files, {
    userId,
    emit,
    logPrefix: 'PM-Idee-Import',
  });
  mergeReport(report, subReport);

  // 3. LLM extraction (Idee-spezifisch)
  console.log('[PM-Idee-Import] Starting LLM extraction...');
  await emit({ type: 'extracting_started', data: { textChars: combinedText.length } });
  const extractStart = Date.now();
  const extractedData = await withHeartbeat(
    extractIdeeWithLLM(combinedText, userId),
    HEARTBEAT_MS,
    async (elapsedMs) => {
      await emit({ type: 'extracting_progress', data: { elapsedMs } });
    },
  );

  // 4. Validate
  const validation = validateExtraction(extractedData, PROJEKTIDEE_PROFILE);
  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      report.warnings.push(`Validierung: ${err.field} - ${err.message}`);
    }
  }
  if (validation.corrected.length > 0) {
    console.log(`[PM-Idee-Import] Auto-corrected fields: ${validation.corrected.join(', ')}`);
  }
  await emit({ type: 'validating', data: { warningCount: validation.errors.length } });

  // 5. Map auf Projektidee-Struktur
  const mappedData = mapToProjektidee(extractedData);
  report.fieldsExtracted = countExtractedIdeeFields(mappedData);

  console.log(`[PM-Idee-Import] Extracted ${report.fieldsExtracted} fields`);
  await emit({
    type: 'extracting_done',
    data: { fieldsExtracted: report.fieldsExtracted, durationMs: Date.now() - extractStart },
  });

  // 6. Persist
  await emit({ type: 'creating', data: {} });
  if (!mappedData.name) {
    // createIdee verlangt einen Namen — Fallback aus Datei-Liste falls LLM keinen liefert.
    mappedData.name = `Idee-Import (${new Date().toLocaleDateString('de-DE')})`;
    report.warnings.push('Kein Projektname extrahiert — Fallback gesetzt');
  }
  const projektidee = await createIdee(mappedData, userId);

  console.log(`[PM-Idee-Import] Created Projektidee: ${projektidee.id}`);
  await emit({ type: 'idee_done', data: { projektidee, report } });

  return { projektidee, report };
}
