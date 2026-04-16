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
import type { Projektauftrag } from './types';
import { createProjektauftrag, generateSubEntityId } from './service';

// Markitdown API for document conversion (same as extraction service)
const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

// Limits
const MAX_COMBINED_CHARS = 30000;
const MAX_IMAGE_DESC_CHARS = 3000;

// ============== Import Report ==============

export interface ImportReport {
  filesProcessed: number;
  filesFailed: number;
  fieldsExtracted: number;
  errors: string[];
  warnings: string[];
}

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

    return await response.text();
  }

  throw new Error(`Dateityp nicht unterstützt: ${ext} (${filename})`);
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
    baseUrl: visionModel.provider.api_url,
    apiKey: visionModel.provider.api_key || null,
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

  const parts: string[] = [];
  let totalChars = 0;

  for (const file of sorted) {
    const header = `\n=== Datei: ${file.filename} ===\n`;
    const available = MAX_COMBINED_CHARS - totalChars - header.length;

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

// ============== Main Import Function ==============

export async function importProjektauftrag(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  userId: string
): Promise<{ projektauftrag: Projektauftrag; report: ImportReport }> {
  const report: ImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    fieldsExtracted: 0,
    errors: [],
    warnings: [],
  };

  console.log(`[PM-Import] Starting import with ${files.length} files`);

  // 1. Process files in parallel
  const results = await Promise.allSettled(
    files.map(async (f) => {
      const text = await processFile(f.buffer, f.filename, f.mimeType, userId);
      const ext = getExtension(f.filename);
      return {
        filename: f.filename,
        text,
        isImage: IMAGE_EXTENSIONS.includes(ext),
      } as ProcessedFile;
    })
  );

  const processedFiles: ProcessedFile[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.text.trim()) {
        processedFiles.push(result.value);
        report.filesProcessed++;
      } else {
        report.warnings.push(`${result.value.filename}: Kein Text extrahiert (leeres Dokument?)`);
        report.filesFailed++;
      }
    } else {
      report.filesFailed++;
      report.errors.push(result.reason?.message || 'Unbekannter Fehler bei Dateiverarbeitung');
    }
  }

  if (processedFiles.length === 0) {
    throw new Error('Keine Dateien konnten verarbeitet werden');
  }

  console.log(`[PM-Import] ${processedFiles.length}/${files.length} files processed`);

  // 2. Combine texts
  const combinedText = combineTexts(processedFiles);
  console.log(`[PM-Import] Combined text: ${combinedText.length} chars`);

  // 3. LLM extraction
  console.log('[PM-Import] Starting LLM extraction...');
  const extractedData = await extractWithLLM(combinedText, userId);

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

  // 5. Map to Projektauftrag structure
  const mappedData = mapToProjektauftrag(extractedData);
  report.fieldsExtracted = countExtractedFields(mappedData);

  console.log(`[PM-Import] Extracted ${report.fieldsExtracted} fields`);

  // 6. Create Projektauftrag
  const projektauftrag = await createProjektauftrag(mappedData, userId);

  console.log(`[PM-Import] Created Projektauftrag: ${projektauftrag.id}`);

  return { projektauftrag, report };
}
