/**
 * Projektauftrag Import Service
 *
 * Multi-document import pipeline for Projektauftrag creation.
 * Processes multiple uploaded files (PDFs, images, Word, Excel, etc.),
 * extracts text, combines them, and uses LLM forced function calling
 * to extract structured Projektauftrag data.
 */

import { llmService, type Message, type ChatOptions, createImageContent, type ContentPart } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { resolveActiveModel } from '../../services/providers';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import { buildFunctionSchema, buildToolChoice } from '../../extraction/schema-builder';
import { validateExtraction } from '../../extraction/validator';
import type { ExtractionProfile } from '../../extraction/types';
import type { Projektauftrag, Projektidee, BusinessCaseItem, Risk } from './types';
import { createProjektauftrag, generateSubEntityId } from './service';
import { createIdee } from './idee-service';

// Markitdown API for document conversion (same as extraction service)
const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

// Limits
const MAX_COMBINED_CHARS = 30000;
// xlsx-Sheets sind sehr dicht (Tabellen) — bei 30K dauert die LLM-Extraktion teils >3min
// und timeoutet. Niedrigerer Budget produziert immer noch volle Extraktion (P-Auftrag-Sheet
// kommt mit Reorder zuerst), Tasks/Risken bleiben erhalten.
const MAX_COMBINED_CHARS_XLSX = 20000;
const MAX_IMAGE_DESC_CHARS = 3000;

// ============== Import Report ==============

export interface ImportReport {
  filesProcessed: number;
  filesFailed: number;
  fieldsExtracted: number;
  errors: string[];
  warnings: string[];
}

// ============== Progress-Events ==============

/**
 * Events die der Import-Service waehrend der Pipeline emittiert.
 * Die Route streamt diese als SSE ans Frontend, damit User auch waehrend
 * langer Vision/LLM-Phasen sieht dass etwas passiert.
 */
export type ImportEvent =
  | { type: 'started';             data: { fileCount: number; filenames: string[] } }
  | { type: 'file_started';        data: { filename: string; index: number; total: number; kind: 'image' | 'document' | 'text' } }
  | { type: 'file_progress';       data: { filename: string; elapsedMs: number; phase: 'vision' | 'markitdown' } }
  | { type: 'file_done';           data: { filename: string; index: number; total: number; chars: number; durationMs: number } }
  | { type: 'file_failed';         data: { filename: string; index: number; total: number; error: string } }
  | { type: 'combining';           data: { processedCount: number; totalChars: number } }
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
      project_type: { type: 'text', label: 'Projekttyp', hint: 'Einer von: internal, external, research, infrastructure. Deutsch: Intern, Extern, Forschung, Infrastruktur' },
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
- probability: "low", "medium", "high"
- impact: "low", "medium", "high"
- interest: "low", "medium", "high"
- influence: "low", "medium", "high"

Wenn ein Wert wie "Hoch", "Mittel", "Niedrig" vorkommt, übersetze ihn in den englischen Enum-Wert.
Wenn ein Projekttyp wie "Intern", "Extern" vorkommt, übersetze ihn in den englischen Enum-Wert.

Die Dokumente können verschiedene Formate und Quellen haben (Screenshots, Tabellen, Texte). Kombiniere die Informationen aus allen Quellen zu einem konsistenten Ergebnis.`,
};

// ============== File Processing ==============

interface ProcessedFile {
  filename: string;
  text: string;
  isImage: boolean;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const TEXT_EXTENSIONS = ['.txt', '.md'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

function getMimeTypeForImage(ext: string): string {
  switch (ext) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

function getFileKind(filename: string): 'image' | 'document' | 'text' {
  const ext = getExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  return 'document';
}

/**
 * Wrappt ein Promise und ruft `emit(elapsedMs)` alle `intervalMs` waehrend es laeuft.
 * Resolve/Reject werden unveraendert durchgereicht. Kein Heartbeat-Event nach Resolve.
 */
async function withHeartbeat<T>(
  promise: Promise<T>,
  intervalMs: number,
  emit: (elapsedMs: number) => void | Promise<void>,
): Promise<T> {
  const start = Date.now();
  const timer = setInterval(() => { void emit(Date.now() - start); }, intervalMs);
  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

const HEARTBEAT_MS = 3000;

/**
 * Process a single file into text
 */
async function processFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  userId?: string
): Promise<string> {
  const ext = getExtension(filename);

  // Images: Vision LLM
  if (IMAGE_EXTENSIONS.includes(ext)) {
    console.log(`[PM-Import] Processing image: ${filename}`);
    const base64 = buffer.toString('base64');
    const imageMime = getMimeTypeForImage(ext);
    const text = await prepareVision(base64, imageMime, userId);
    // Truncate image descriptions
    return text.length > MAX_IMAGE_DESC_CHARS ? text.substring(0, MAX_IMAGE_DESC_CHARS) + '\n[... gekürzt]' : text;
  }

  // Text/Markdown: direct
  if (TEXT_EXTENSIONS.includes(ext)) {
    console.log(`[PM-Import] Processing text: ${filename}`);
    return buffer.toString('utf-8');
  }

  // Documents: Markitdown API
  if (DOCUMENT_EXTENSIONS.includes(ext)) {
    console.log(`[PM-Import] Processing document via Markitdown: ${filename}`);
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('document', blob, filename);

    const response = await fetch(MARKITDOWN_URL, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${MARKITDOWN_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markitdown-Konvertierung fehlgeschlagen für ${filename}: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    // xlsx (Excel-Toolbox) schreiben Sheets als ## Sheet-Header mit Pipe-Tabellen.
    // Glossar/Listen-Sheets dominieren oft die ersten 30K chars und verdraengen
    // die echten Projektdaten. Re-ordern hilft enorm.
    if (ext === '.xlsx' || ext === '.xls') {
      return reorderXlsxSheets(text);
    }
    return text;
  }

  throw new Error(`Dateityp nicht unterstützt: ${ext} (${filename})`);
}

/**
 * Sortiert die Markitdown-Sheets nach Relevanz: Projektdaten zuerst,
 * Boilerplate-Sheets (Glossar, Listen, etc.) ans Ende.
 */
function reorderXlsxSheets(markdown: string): string {
  // Sheets sind durch `## `-Header getrennt. Erste Zeile bleibt der "Document ..."-Prefix.
  const headerMatch = markdown.match(/^Document [^"]*"""/);
  const prefix = headerMatch ? headerMatch[0] : '';
  const body = prefix ? markdown.slice(prefix.length) : markdown;

  // Split anhand von Zeilen, die mit `##` (mit oder ohne Space) starten.
  const sheets: { name: string; content: string; priority: number }[] = [];
  const sections = body.split(/\n(?=##\s?\S)/);
  for (const section of sections) {
    const nameMatch = section.match(/^##\s?([^|]+?)(?:\||$)/m);
    if (!nameMatch) {
      // Vor dem ersten Sheet (Pre-Content) — als Priority 0 behalten.
      if (section.trim()) sheets.push({ name: '_intro', content: section, priority: 0 });
      continue;
    }
    const name = nameMatch[1]!.trim();
    sheets.push({ name, content: section, priority: sheetPriority(name) });
  }

  sheets.sort((a, b) => a.priority - b.priority);
  return prefix + sheets.map(s => s.content).join('\n');
}

/**
 * Niedrigere Zahl = wichtiger (kommt zuerst).
 *  0  = intro/Pre-Content
 *  1  = P-Auftrag (Stammdaten)
 *  2  = Aufgaben/Inhalt/Story (Scope)
 *  3  = Aufwand/Beschaffung/Budget
 *  4  = Risk/SH/ORG/Stakeholder
 *  5  = Status PL/AG/MSP (Reports)
 *  9  = Glossar/Listen/Bild/EVM-Templates (Boilerplate)
 */
function sheetPriority(sheetName: string): number {
  const lower = sheetName.toLowerCase();
  if (lower === '_intro') return 0;
  if (/p-auftrag|projektauftrag|projektsteckbrief/.test(lower)) return 1;
  if (/inhalt|story|scope|aufgaben|tasks/.test(lower)) return 2;
  if (/aufwand|beschaffung|budget|kosten/.test(lower)) return 3;
  if (/risk|sh\b|org\b|stakeholder/.test(lower)) return 4;
  if (/status|msp|meilenstein|review/.test(lower)) return 5;
  if (/glossar|listen|bild|evm|plan-ist|template|legende/.test(lower)) return 9;
  return 6;  // unbekannt — neutral
}

/**
 * Vision LLM for image description (re-implemented from extraction service)
 */
async function prepareVision(
  imageBase64: string,
  imageMimeType: string,
  userId?: string
): Promise<string> {
  const visionModel = await resolveActiveModel('vision', userId);
  if (!visionModel) {
    throw new Error('Kein Vision-Modell konfiguriert');
  }

  const visionAdapter = new OpenAIAdapter({
    baseUrl: visionModel.base_url,
    apiKey: visionModel.api_key,
    defaultModel: visionModel.model.id,
  });

  const contentParts: ContentPart[] = [
    {
      type: 'text',
      text: `Beschreibe dieses Dokument detailliert. Extrahiere ALLEN sichtbaren Text vollständig und wörtlich.
Behalte die Struktur bei (Tabellen, Listen, Kopfdaten).
Gib den Text in der Originalsprache wieder.
Antworte NUR mit dem extrahierten Inhalt, keine eigenen Kommentare.`,
    },
    createImageContent(imageBase64, imageMimeType),
  ];

  const messages: Message[] = [
    { role: 'user', content: contentParts },
  ];

  const result = await visionAdapter.chat(messages, visionModel.model.id);

  if (!result.content) {
    throw new Error('Vision-LLM hat keinen Text zurückgegeben');
  }

  return result.content;
}

// ============== Text Combination ==============

/**
 * Combine texts from multiple files with headers
 */
function combineTexts(files: ProcessedFile[]): string {
  // Sort: structured documents first, images last
  const sorted = [...files].sort((a, b) => {
    if (a.isImage && !b.isImage) return 1;
    if (!a.isImage && b.isImage) return -1;
    return 0;
  });

  // Wenn nur xlsx-Files dabei sind, niedrigeren Budget verwenden um LLM-Timeouts zu vermeiden.
  const allXlsx = sorted.length > 0 && sorted.every(f => /\.xlsx?$/i.test(f.filename));
  const budget = allXlsx ? MAX_COMBINED_CHARS_XLSX : MAX_COMBINED_CHARS;

  const parts: string[] = [];
  let totalChars = 0;

  for (const file of sorted) {
    const header = `\n=== Datei: ${file.filename} ===\n`;
    const available = budget - totalChars - header.length;

    if (available <= 100) {
      break; // No more space
    }

    let text = file.text;
    if (text.length > available) {
      text = text.substring(0, available) + '\n[... gekürzt]';
    }

    parts.push(header + text);
    totalChars += header.length + text.length;
  }

  return parts.join('\n');
}

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
  if (basis.project_type) result.project_type = normalizeProjectType(basis.project_type);
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
  // Scalar fields
  if (data.name) count++;
  if (data.project_type) count++;
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
 * Phasen 1+2 der Import-Pipeline (mode-unabhaengig):
 *   - File-Loop mit per-File-Events + Heartbeats waehrend Vision/Markitdown
 *   - combineTexts() mit xlsx-Char-Budget-Reduktion
 *
 * Wird sowohl von importProjektauftrag als auch von importProjektidee genutzt.
 * Mode-spezifisch ist nur was DANACH passiert (LLM-Prompt, Mapping, Persistence).
 */
async function processFilesToText(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  userId: string,
  emit: ImportEventCallback,
  report: ImportReport,
): Promise<{ processedFiles: ProcessedFile[]; combinedText: string }> {
  // 1. Process files SEQUENTIELL — sonst kollidieren Heartbeat-Events mehrerer
  // paralleler Vision-Calls. Performance-Verlust ist gering bei typisch 2-5 Files.
  const processedFiles: ProcessedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const kind = getFileKind(f.filename);
    await emit({ type: 'file_started', data: { filename: f.filename, index: i + 1, total: files.length, kind } });

    const fileStart = Date.now();
    try {
      const text = kind === 'text'
        ? await processFile(f.buffer, f.filename, f.mimeType, userId)
        : await withHeartbeat(
            processFile(f.buffer, f.filename, f.mimeType, userId),
            HEARTBEAT_MS,
            async (elapsedMs) => {
              await emit({
                type: 'file_progress',
                data: {
                  filename: f.filename,
                  elapsedMs,
                  phase: kind === 'image' ? 'vision' : 'markitdown',
                },
              });
            },
          );

      if (text.trim()) {
        processedFiles.push({ filename: f.filename, text, isImage: kind === 'image' });
        report.filesProcessed++;
        await emit({
          type: 'file_done',
          data: { filename: f.filename, index: i + 1, total: files.length, chars: text.length, durationMs: Date.now() - fileStart },
        });
      } else {
        report.warnings.push(`${f.filename}: Kein Text extrahiert (leeres Dokument?)`);
        report.filesFailed++;
        await emit({
          type: 'file_failed',
          data: { filename: f.filename, index: i + 1, total: files.length, error: 'Kein Text extrahiert' },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler bei Dateiverarbeitung';
      report.filesFailed++;
      report.errors.push(msg);
      await emit({
        type: 'file_failed',
        data: { filename: f.filename, index: i + 1, total: files.length, error: msg },
      });
    }
  }

  if (processedFiles.length === 0) {
    throw new Error('Keine Dateien konnten verarbeitet werden');
  }

  console.log(`[PM-Import] ${processedFiles.length}/${files.length} files processed`);

  // 2. Combine texts
  const combinedText = combineTexts(processedFiles);
  console.log(`[PM-Import] Combined text: ${combinedText.length} chars`);
  await emit({ type: 'combining', data: { processedCount: processedFiles.length, totalChars: combinedText.length } });

  return { processedFiles, combinedText };
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

  // Wenn kein Callback gesetzt: ein No-Op verwenden, damit die Phase-Pings keinen
  // Wrapper-Overhead haben.
  const emit = onEvent ?? (async () => { /* noop */ });

  console.log(`[PM-Import] Starting import with ${files.length} files`);
  await emit({ type: 'started', data: { fileCount: files.length, filenames: files.map(f => f.filename) } });

  const { combinedText } = await processFilesToText(files, userId, emit, report);

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
        beschreibung: { type: 'text', required: true, label: 'Investitions-Position' },
        betrag: { type: 'number', label: 'Betrag in EUR (immer positiv)' },
        anbieter: { type: 'text', label: 'Anbieter / Lieferant' },
        hinweis: { type: 'text', label: 'Hinweis' },
      },
    },
    nutzen: {
      _array: true,
      _item_fields: {
        beschreibung: { type: 'text', required: true, label: 'Nutzen-Position' },
        betrag: { type: 'number', label: 'Erwarteter Ertrag in EUR (immer positiv)' },
        anbieter: { type: 'text', label: 'Quelle / Bereich' },
        hinweis: { type: 'text', label: 'Hinweis' },
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
    gross: 'gross', 'gross': 'gross', large: 'gross', big: 'gross', groß: 'gross',
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
    ...(it.anbieter ? { anbieter: String(it.anbieter) } : {}),
    ...(it.hinweis ? { hinweis: String(it.hinweis) } : {}),
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
  await emit({ type: 'started', data: { fileCount: files.length, filenames: files.map(f => f.filename) } });

  const { combinedText } = await processFilesToText(files, userId, emit, report);

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
