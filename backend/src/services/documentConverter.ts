/**
 * Zentraler Dokument-Konverter (W8).
 *
 * Vorher war der Markitdown-HTTP-Call ~9x kopiert (attachments, multiFileImporter,
 * indexer, Vertragsmanagement, Extraction, Learning, Profil-Generierung,
 * Gmail-Attachment, Google-Drive-Fetch) — mit SSRF-Allowlist an nur 2 der 9
 * Stellen und Timeout an nur 1. Hier: EIN Fetch, EINE Allowlist, EIN Timeout.
 *
 * Backends:
 *   - markitdown  MARKITDOWN_API_URL (Default Adacor documentMarkdown) — heute
 *   - docling     DOCLING_API_URL — kommt als Adacor-Endpunkt mit demselben
 *                 Vertrag (PUT, multipart-Feld `document`, Antwort = Markdown
 *                 als Text). Solange die ENV fehlt, laeuft alles wie bisher.
 *
 * Routing (`backend: 'auto'`, Default):
 *   - Office/HTML/CSV/RTF → Docling (Tabellenstruktur; Markitdown flacht ab)
 *   - PDF MIT Textlayer   → Docling (born-digital)
 *   - PDF OHNE Textlayer  → Markitdown (Scan; die eigentliche Extraktion
 *     laeuft ohnehin ueber den Vision-Pfad — Docling-OCR/EasyOCR ist auf Scans
 *     schwach und wird bewusst nicht genutzt, siehe Standortbestimmung 2026-08-08)
 *   - Docling nicht konfiguriert → immer Markitdown
 *
 * Fallback: Schlaegt Docling fehl (5xx/Timeout/Netz), wird derselbe Request
 * einmal gegen Markitdown wiederholt — der Konverter-Wechsel darf keine
 * bestehende Strecke brechen.
 */

import { spawnSync } from 'child_process';
import { extname } from 'path';

const DEFAULT_MARKITDOWN_URL = 'https://api.adacor.ai/v1/documentMarkdown/';
const DEFAULT_TIMEOUT_MS = 120_000;

/** Formate, die Docling besser kann als Markitdown (Tabellen, Layout). */
const DOCLING_PREFERRED_EXTENSIONS = [
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.html', '.htm', '.csv', '.rtf',
];

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
};

export class ConverterError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ConverterError';
  }
}

/** MIME aus dem Dateinamen — Bun.file() erkennt Grossschreibung (.PDF) nicht. */
export function mimeTypeForFilename(filename: string): string {
  return MIME_BY_EXTENSION[extname(filename).toLowerCase()] || 'application/octet-stream';
}

/**
 * SSRF-Allowlist (security-review M13): Konverter-URLs duerfen nur auf
 * adacor.ai oder localhost zeigen — vorher an 7 von 9 Callsites ungeprueft.
 */
function assertAllowedUrl(rawUrl: string, envName: string): string {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.adacor.ai') ||
    host === 'adacor.ai';
  if (!allowed) {
    throw new ConverterError(`${envName} host "${host}" ist nicht auf der Allowlist (adacor.ai oder localhost).`);
  }
  return rawUrl;
}

function markitdownUrl(): string {
  return assertAllowedUrl(process.env.MARKITDOWN_API_URL || DEFAULT_MARKITDOWN_URL, 'MARKITDOWN_API_URL');
}

export function doclingConfigured(): boolean {
  return !!process.env.DOCLING_API_URL;
}

function doclingUrl(): string {
  const raw = process.env.DOCLING_API_URL;
  if (!raw) throw new ConverterError('DOCLING_API_URL ist nicht konfiguriert.');
  return assertAllowedUrl(raw, 'DOCLING_API_URL');
}

// ============== PDF-Textlayer-Erkennung (fuer das Routing) ==============

let pdftotextAvailable: boolean | null = null;
function isPdftotextAvailable(): boolean {
  if (pdftotextAvailable !== null) return pdftotextAvailable;
  try {
    pdftotextAvailable = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).status !== null;
  } catch {
    pdftotextAvailable = false;
  }
  return pdftotextAvailable;
}

/**
 * Stichprobe: hat das PDF einen Textlayer? (erste Seite, > 50 Zeichen)
 * Scans vom Kopierer liefern 0 Zeichen — die gehen an Markitdown (und im
 * Extraktions-Kontext ohnehin an den Vision-Pfad).
 */
export function pdfHasTextLayer(buffer: Buffer): boolean {
  if (!isPdftotextAvailable()) return false;
  try {
    const r = spawnSync('pdftotext', ['-l', '1', '-', '-'], {
      input: buffer,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (r.status !== 0 || !r.stdout) return false;
    return r.stdout.replace(/\s+/g, '').length > 50;
  } catch {
    return false;
  }
}

// ============== Konvertierung ==============

export type ConverterBackend = 'auto' | 'markitdown' | 'docling';

export interface ConvertOptions {
  /** Default 120s. */
  timeoutMs?: number;
  /** Default 'auto' (Routing siehe Kopfkommentar). */
  backend?: ConverterBackend;
}

/** Entscheidet das Backend fuer 'auto' — exportiert fuer Tests. */
export function resolveBackend(filename: string, buffer: Buffer, backend: ConverterBackend = 'auto'): 'markitdown' | 'docling' {
  if (backend !== 'auto') return backend;
  if (!doclingConfigured()) return 'markitdown';
  const ext = extname(filename).toLowerCase();
  if (DOCLING_PREFERRED_EXTENSIONS.includes(ext)) return 'docling';
  if (ext === '.pdf') return pdfHasTextLayer(buffer) ? 'docling' : 'markitdown';
  return 'markitdown';
}

async function callBackend(
  url: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  timeoutMs: number,
): Promise<string> {
  const blob = new Blob([buffer as unknown as BlobPart], { type: mimeType });
  const formData = new FormData();
  formData.append('document', blob, filename);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${process.env.ADACOR_AI_API_KEY || ''}` },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const e = error as { name?: string };
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new ConverterError(`Dokumentkonvertierung: Timeout nach ${Math.round(timeoutMs / 1000)}s (${filename})`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ConverterError(`Dokumentkonvertierung fehlgeschlagen (${filename}): ${response.status} - ${errorText}`, response.status);
  }

  // Der Endpunkt antwortet je nach Version als Plain-Text oder JSON
  // ({markdown|text|content}) — vorher behandelte das nur die Gmail-Callsite.
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const result = await response.json() as { markdown?: string; text?: string; content?: string };
    return result.markdown || result.text || result.content || '';
  }
  return await response.text();
}

/**
 * Konvertiert ein Dokument zu Markdown. `.md`/`.txt` liest der Aufrufer selbst —
 * hier landen nur Formate, die einen Konverter brauchen.
 */
export async function convertDocument(
  input: { buffer: Buffer; filename: string; mimeType?: string },
  opts: ConvertOptions = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const mimeType = input.mimeType || mimeTypeForFilename(input.filename);
  const backend = resolveBackend(input.filename, input.buffer, opts.backend ?? 'auto');

  if (backend === 'docling') {
    try {
      return await callBackend(doclingUrl(), input.buffer, input.filename, mimeType, timeoutMs);
    } catch (err) {
      // Der Konverter-Wechsel darf keine bestehende Strecke brechen:
      // einmaliger Fallback auf Markitdown, mit Log fuer die Diagnose.
      console.warn(`[documentConverter] Docling fehlgeschlagen fuer ${input.filename} (${err instanceof Error ? err.message : String(err)}) — Fallback auf Markitdown.`);
      return await callBackend(markitdownUrl(), input.buffer, input.filename, mimeType, timeoutMs);
    }
  }
  return await callBackend(markitdownUrl(), input.buffer, input.filename, mimeType, timeoutMs);
}
