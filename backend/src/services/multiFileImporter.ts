/**
 * Multi-File Import Pipeline (shared) — Phasen 1+2 fuer alle App-Importer.
 *
 * Was hier passiert:
 * - File-zu-Text-Konvertierung pro File (Vision-LLM fuer Bilder, Markitdown
 *   fuer PDF/Office, Plain-Read fuer .txt/.md, xlsx-Reordering fuer Excel)
 * - Heartbeats waehrend langer Vision-/Markitdown-Calls (3s-Intervall)
 * - Char-Budget-Trimming + sortiertes Concat (Bilder ans Ende)
 * - Generische SSE-Events die der Aufrufer ans Frontend streamen kann
 *
 * Was hier NICHT passiert (app-spezifisch):
 * - LLM-Extraktion mit Function-Calling (PM/VM bauen eigenes Schema)
 * - Validation, Mapping, Persistierung (alles app-eigen)
 * - "done"-Event mit der erzeugten Entitaet — der Aufrufer emittiert das selbst
 *
 * Erste Konsumenten: projektmanagement/import-service.ts, vertragsmanagement/
 * import-service.ts. Spaeter koennen lieferantenmanagement / vsm / wzbar-matcher
 * dasselbe Pattern nutzen.
 */

import { llmService, type Message, createImageContent, type ContentPart } from './llm';
import { resolveActiveModel } from './providers';
import { OpenAIAdapter } from './llm/adapters/openai';

// ============== Public Types ==============

export interface ProcessedFile {
  filename: string;
  text: string;
  isImage: boolean;
  /** Char-Anzahl des extrahierten Texts (vor Combine-Trimming). */
  charCount: number;
}

export interface FileImportReport {
  filesProcessed: number;
  filesFailed: number;
  errors: string[];
  warnings: string[];
}

/**
 * Generische File-Phasen-Events. App-spezifische Events (extracting/validating/
 * done/error) emittiert der Aufrufer selbst.
 */
export type FileImportEvent =
  | { type: 'started';        data: { fileCount: number; filenames: string[] } }
  | { type: 'file_started';   data: { filename: string; index: number; total: number; kind: 'image' | 'document' | 'text' } }
  | { type: 'file_progress';  data: { filename: string; elapsedMs: number; phase: 'vision' | 'markitdown' } }
  | { type: 'file_done';      data: { filename: string; index: number; total: number; chars: number; durationMs: number } }
  | { type: 'file_failed';    data: { filename: string; index: number; total: number; error: string } }
  | { type: 'combining';      data: { processedCount: number; totalChars: number } };

export type FileImportEventCallback = (event: FileImportEvent) => void | Promise<void>;

export interface ProcessFilesOptions {
  userId?: string;
  emit?: FileImportEventCallback;
  /** Default: 30000. */
  maxCombinedChars?: number;
  /** Default: 20000. xlsx-Sheets sind dichter — niedrigerer Budget verhindert LLM-Timeouts. */
  maxCombinedCharsXlsx?: number;
  /** Default: 3000. Bild-Beschreibung wird hart abgeschnitten falls Vision-LLM zu viel produziert. */
  maxImageDescChars?: number;
  /** Default: 'multiFileImporter'. Wird im console.log-Prefix angezeigt — Aufrufer setzt z.B. 'PM-Import' oder 'VM-Import'. */
  logPrefix?: string;
  /**
   * Wenn `true`: ueberspringt das Char-Budget in `combineTexts` komplett — der
   * vollstaendige Text aller Files wird in `combinedText` zurueckgegeben.
   * Defense-in-Depth fuer die Heavy-Extraction-Pipeline (siehe
   * `backend/src/services/extraction/`), die intern chunked und niemals
   * truncieren darf. Hat KEINE Auswirkung auf den image-description-Cap
   * (`maxImageDescChars`) — die Vision-Beschreibung wird weiterhin gekuerzt,
   * weil sie eine zweite Token-Quelle (Bild + Beschreibung) waere. Default: false.
   */
  unbounded?: boolean;
}

// ============== Constants ==============

const MARKITDOWN_URL = validateMarkitdownUrl(
  process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/',
);
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

/**
 * Verhindert dass eine fehlkonfigurierte MARKITDOWN_API_URL den Server zur
 * SSRF-Quelle macht. Whitelist auf adacor.ai-Hosts (plus localhost fuer
 * lokales Development). Siehe security-review M13.
 */
function validateMarkitdownUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`MARKITDOWN_API_URL is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`MARKITDOWN_API_URL must use http(s): ${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.adacor.ai') ||
    host === 'adacor.ai';
  if (!allowed) {
    throw new Error(
      `MARKITDOWN_API_URL host "${host}" is not on the allowlist. ` +
      'Permitted: *.adacor.ai or localhost.',
    );
  }
  return url;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const TEXT_EXTENSIONS = ['.txt', '.md'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];

const DEFAULT_MAX_COMBINED_CHARS = 30000;
const DEFAULT_MAX_COMBINED_CHARS_XLSX = 20000;
const DEFAULT_MAX_IMAGE_DESC_CHARS = 3000;

// ============== Helpers ==============

export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

export function getFileKind(filename: string): 'image' | 'document' | 'text' {
  const ext = getExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  return 'document';
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
 * Default-Heartbeat-Intervall (3s) — App-Importer koennen mit eigenem
 * Intervall aufrufen wenn noetig.
 */
export const HEARTBEAT_MS = 3000;

/**
 * Wrappt ein Promise und ruft `emit(elapsedMs)` alle `intervalMs` waehrend es
 * laeuft. Resolve/Reject werden unveraendert durchgereicht. Kein Heartbeat-
 * Event nach Resolve. Wird auch von App-Importern genutzt fuer ihre eigenen
 * langen LLM-Calls (Klassifikation, Extraktion).
 */
export async function withHeartbeat<T>(
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

// ============== File-to-Text ==============

async function processFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  userId: string | undefined,
  maxImageDescChars: number,
  logPrefix: string,
): Promise<string> {
  const ext = getExtension(filename);

  // Image: Vision LLM
  if (IMAGE_EXTENSIONS.includes(ext)) {
    console.log(`[${logPrefix}] Processing image via Vision: ${filename}`);
    const base64 = buffer.toString('base64');
    const imageMime = getMimeTypeForImage(ext);
    const text = await prepareVision(base64, imageMime, userId);
    return text.length > maxImageDescChars
      ? text.substring(0, maxImageDescChars) + '\n[... gekürzt]'
      : text;
  }

  // Text/Markdown: direct read
  if (TEXT_EXTENSIONS.includes(ext)) {
    console.log(`[${logPrefix}] Processing text: ${filename}`);
    return buffer.toString('utf-8');
  }

  // Documents: Markitdown API
  if (DOCUMENT_EXTENSIONS.includes(ext)) {
    console.log(`[${logPrefix}] Processing document via Markitdown: ${filename}`);
    const blob = new Blob([buffer as unknown as BlobPart], { type: mimeType });
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
    if (ext === '.xlsx' || ext === '.xls') {
      return reorderXlsxSheets(text);
    }
    return text;
  }

  throw new Error(`Dateityp nicht unterstützt: ${ext} (${filename})`);
}

/**
 * xlsx-Sheets sind durch ## Headers getrennt. Glossar-/Listen-Sheets dominieren
 * die ersten 30K chars und verdraengen die echten Inhalts-Sheets — Re-ordern
 * hilft enorm. Niedrige Priority-Zahl = wichtiger.
 */
function reorderXlsxSheets(markdown: string): string {
  const headerMatch = markdown.match(/^Document [^"]*"""/);
  const prefix = headerMatch ? headerMatch[0] : '';
  const body = prefix ? markdown.slice(prefix.length) : markdown;

  const sheets: { name: string; content: string; priority: number }[] = [];
  const sections = body.split(/\n(?=##\s?\S)/);
  for (const section of sections) {
    const nameMatch = section.match(/^##\s?([^|]+?)(?:\||$)/m);
    if (!nameMatch) {
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
 * Standard-Heuristik fuer xlsx-Sheet-Reihenfolge. App-Importer koennen das spaeter
 * via Optional-Override anpassen wenn sie spezifische Sheet-Namen kennen.
 *  0  = intro/Pre-Content
 *  1  = Stammdaten/Hauptblatt (P-Auftrag, Vertrag, Vereinbarung)
 *  2  = Inhalt/Scope (Aufgaben, Leistungen, Items)
 *  3  = Kosten/Budget/Aufwand
 *  4  = Risiken/Stakeholder/Organisation
 *  5  = Reports/Status/Reviews
 *  9  = Boilerplate (Glossar, Listen, Bilder, Templates)
 */
function sheetPriority(sheetName: string): number {
  const lower = sheetName.toLowerCase();
  if (lower === '_intro') return 0;
  if (/p-auftrag|projektauftrag|projektsteckbrief|vertrag|vereinbarung|hauptblatt|stammdaten/.test(lower)) return 1;
  if (/inhalt|story|scope|aufgaben|tasks|leistung|items/.test(lower)) return 2;
  if (/aufwand|beschaffung|budget|kosten|preis/.test(lower)) return 3;
  if (/risk|sh\b|org\b|stakeholder|verantwortlich/.test(lower)) return 4;
  if (/status|msp|meilenstein|review/.test(lower)) return 5;
  if (/glossar|listen|bild|evm|plan-ist|template|legende/.test(lower)) return 9;
  return 6;
}

/**
 * Vision-LLM fuer Bilder. Beschreibt Dokumente detailliert, extrahiert allen
 * sichtbaren Text. Wird auch fuer eingescannte Vertraege/Whiteboards verwendet.
 */
async function prepareVision(
  imageBase64: string,
  imageMimeType: string,
  userId?: string,
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

// ============== Combine ==============

/**
 * Concat aller File-Texte mit File-Markern. Bilder ans Ende (strukturierte
 * Dokumente sind aussagekraeftiger fuer den Extraktor). Char-Budget verhindert
 * LLM-Timeouts bei riesigen xlsx-Toolboxen.
 */
function combineTexts(
  files: ProcessedFile[],
  maxCombinedChars: number,
  maxCombinedCharsXlsx: number,
): string {
  const sorted = [...files].sort((a, b) => {
    if (a.isImage && !b.isImage) return 1;
    if (!a.isImage && b.isImage) return -1;
    return 0;
  });

  const allXlsx = sorted.length > 0 && sorted.every(f => /\.xlsx?$/i.test(f.filename));
  const budget = allXlsx ? maxCombinedCharsXlsx : maxCombinedChars;

  const parts: string[] = [];
  let totalChars = 0;

  for (const file of sorted) {
    const header = `\n=== Datei: ${file.filename} ===\n`;
    const available = budget - totalChars - header.length;
    if (available <= 100) break;

    let text = file.text;
    if (text.length > available) {
      text = text.substring(0, available) + '\n[... gekürzt]';
    }
    parts.push(header + text);
    totalChars += header.length + text.length;
  }

  return parts.join('\n');
}

// ============== Main entry ==============

/**
 * Verarbeitet alle Files sequentiell zu Text + Concat fuer LLM-Extraktion.
 *
 * Sequentiell statt parallel: bei parallelen Vision-Calls kollidieren die
 * Heartbeat-Events und der LLM-Anbieter koennte rate-limiten. Performance-
 * Verlust ist gering bei typisch 2-5 Files.
 *
 * Wirft bei 0 erfolgreich verarbeiteten Files. Aufrufer entscheidet wie er
 * mit teilweisen Fehlern umgeht (siehe `report.errors`).
 */
export async function processFilesToText(
  files: { buffer: Buffer; filename: string; mimeType: string }[],
  options: ProcessFilesOptions = {},
): Promise<{ processedFiles: ProcessedFile[]; combinedText: string; report: FileImportReport }> {
  const {
    userId,
    emit,
    maxCombinedChars: rawMaxCombined = DEFAULT_MAX_COMBINED_CHARS,
    maxCombinedCharsXlsx: rawMaxCombinedXlsx = DEFAULT_MAX_COMBINED_CHARS_XLSX,
    maxImageDescChars = DEFAULT_MAX_IMAGE_DESC_CHARS,
    logPrefix = 'multiFileImporter',
    unbounded = false,
  } = options;

  // `unbounded` setzt die Char-Budgets effektiv auf "unendlich" (Number.MAX_SAFE_INTEGER).
  // `combineTexts` schneidet dann faktisch nichts ab. Image-Description bleibt
  // gekuerzt (zweite Token-Quelle, siehe Doc oben).
  const maxCombinedChars = unbounded ? Number.MAX_SAFE_INTEGER : rawMaxCombined;
  const maxCombinedCharsXlsx = unbounded ? Number.MAX_SAFE_INTEGER : rawMaxCombinedXlsx;

  const fire = emit ?? (async () => { /* noop */ });

  const report: FileImportReport = {
    filesProcessed: 0,
    filesFailed: 0,
    errors: [],
    warnings: [],
  };

  await fire({ type: 'started', data: { fileCount: files.length, filenames: files.map(f => f.filename) } });

  const processedFiles: ProcessedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const kind = getFileKind(f.filename);
    await fire({ type: 'file_started', data: { filename: f.filename, index: i + 1, total: files.length, kind } });

    const fileStart = Date.now();
    try {
      const text = kind === 'text'
        ? await processFile(f.buffer, f.filename, f.mimeType, userId, maxImageDescChars, logPrefix)
        : await withHeartbeat(
            processFile(f.buffer, f.filename, f.mimeType, userId, maxImageDescChars, logPrefix),
            HEARTBEAT_MS,
            async (elapsedMs) => {
              await fire({
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
        processedFiles.push({ filename: f.filename, text, isImage: kind === 'image', charCount: text.length });
        report.filesProcessed++;
        await fire({
          type: 'file_done',
          data: { filename: f.filename, index: i + 1, total: files.length, chars: text.length, durationMs: Date.now() - fileStart },
        });
      } else {
        report.warnings.push(`${f.filename}: Kein Text extrahiert (leeres Dokument?)`);
        report.filesFailed++;
        await fire({
          type: 'file_failed',
          data: { filename: f.filename, index: i + 1, total: files.length, error: 'Kein Text extrahiert' },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler bei Dateiverarbeitung';
      report.filesFailed++;
      report.errors.push(msg);
      await fire({
        type: 'file_failed',
        data: { filename: f.filename, index: i + 1, total: files.length, error: msg },
      });
    }
  }

  if (processedFiles.length === 0) {
    throw new Error('Keine Dateien konnten verarbeitet werden');
  }

  const combinedText = combineTexts(processedFiles, maxCombinedChars, maxCombinedCharsXlsx);
  console.log(`[${logPrefix}] ${processedFiles.length}/${files.length} files processed, combined ${combinedText.length} chars`);
  await fire({ type: 'combining', data: { processedCount: processedFiles.length, totalChars: combinedText.length } });

  return { processedFiles, combinedText, report };
}
