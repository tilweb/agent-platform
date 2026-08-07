/**
 * OCR-basierte Wort-Lokalisierung (Tesseract) zum praezisen Verorten extrahierter
 * Feld-Werte im Dokument. Vision-Modelle liefern die WERTE, aber ihre Bounding-
 * Boxes sind zu ungenau (systematischer Versatz). Tesseract liefert pixelgenaue
 * Wort-Boxen; wir matchen die Werte darauf.
 *
 * System-Requirement: `tesseract` im PATH (+ Sprachdaten deu/eng). Fehlt es,
 * liefert die Pipeline einfach keine Boxen (Extraktion laeuft normal weiter).
 */

import { spawnSync } from 'child_process';
import type { ExtractionProfile, FieldDefinition } from '../../extraction/types';
import { isArrayGroup } from '../../extraction/types';
import type { FieldBox } from './types';

export interface OcrWord {
  text: string;
  left: number; top: number; width: number; height: number;  // Pixel
  conf: number;
}

let tesseractAvailable: boolean | null = null;
export function isTesseractAvailable(): boolean {
  if (tesseractAvailable !== null) return tesseractAvailable;
  try {
    const r = spawnSync('tesseract', ['--version'], { encoding: 'utf8' });
    tesseractAvailable = r.status === 0;
  } catch {
    tesseractAvailable = false;
  }
  if (!tesseractAvailable) console.warn('[ocr] tesseract nicht verfuegbar — keine Bounding-Boxes.');
  return tesseractAvailable;
}

let cachedLang: string | null = null;
function ocrLang(): string {
  if (cachedLang) return cachedLang;
  try {
    const r = spawnSync('tesseract', ['--list-langs'], { encoding: 'utf8' });
    const langs = `${r.stdout || ''}${r.stderr || ''}`;
    cachedLang = langs.includes('deu') ? 'deu+eng' : 'eng';
  } catch {
    cachedLang = 'eng';
  }
  return cachedLang;
}

function parseTsv(stdout: string): OcrWord[] {
  return stdout.split('\n').map((l) => l.split('\t'))
    .filter((c) => c[0] === '5' && c[11] && c[11].trim())
    .map((c) => ({ left: +c[6]!, top: +c[7]!, width: +c[8]!, height: +c[9]!, conf: +c[10]!, text: c[11]!.trim() }))
    .filter((wd) => Number.isFinite(wd.left) && wd.conf > 30);
}

/**
 * Tesseract auf einem PNG-Buffer (via stdin) → Wort-Boxen (Pixel).
 *
 * ASYNC (Bun.spawn): die alte spawnSync-Variante blockierte den Bun-Event-Loop
 * fuer die gesamte OCR-Dauer JEDER Seite — unter Last stand der ganze Server
 * (W9-Befund #11).
 */
export async function ocrWordBoxes(pngBuffer: Buffer): Promise<OcrWord[]> {
  try {
    const proc = Bun.spawn(['tesseract', '-', 'stdout', '-l', ocrLang(), 'tsv'], {
      stdin: pngBuffer,
      stdout: 'pipe',
      stderr: 'ignore',
      env: { ...process.env, OMP_THREAD_LIMIT: '1' },  // stabilisiert tesseract im Subprozess
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0 || !stdout) return [];
    return parseTsv(stdout);
  } catch {
    return [];
  }
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

/** Such-Strings fuer einen Wert. Datums-Werte (YYYY-MM-DD) → gedruckte DE-Formate. */
function valueSearchStrings(value: unknown, type: FieldDefinition['type']): string[] {
  const s = String(value);
  if (type === 'date') {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return [`${d}.${mo}.${y!.slice(2)}`, `${d}.${mo}.${y}`, s];
    }
  }
  return [s];
}

/** Lokalisiert einen Wert in den OCR-Wörtern → normalisierte Box (0..1) oder null. */
export function locateValue(
  value: unknown,
  type: FieldDefinition['type'],
  words: OcrWord[],
  imgW: number,
  imgH: number,
): { x: number; y: number; w: number; h: number } | null {
  if (value === null || value === undefined || value === '' || type === 'boolean') return null;
  if (!(imgW > 0) || !(imgH > 0) || words.length === 0) return null;

  for (const search of valueSearchStrings(value, type)) {
    const tokens = search.split(/\s+/).map(norm).filter((t) => t.length >= 3);
    if (tokens.length === 0) continue;

    const used = new Set<number>();
    const matched: OcrWord[] = [];
    for (const tok of tokens) {
      let best = -1, bestScore = 0;
      words.forEach((wd, i) => {
        if (used.has(i)) return;
        const nw = norm(wd.text);
        let score = 0;
        if (nw === tok) score = 3;
        else if (nw.length >= 4 && (nw.includes(tok) || tok.includes(nw))) score = 2;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0) { used.add(best); matched.push(words[best]!); }
    }
    if (matched.length === 0 || matched.length < Math.ceil(tokens.length / 2)) continue;

    const L = Math.min(...matched.map((m) => m.left));
    const T = Math.min(...matched.map((m) => m.top));
    const R = Math.max(...matched.map((m) => m.left + m.width));
    const B = Math.max(...matched.map((m) => m.top + m.height));
    // Plausibilitaet: ein gematchter Wert sollte nicht das halbe Blatt umspannen
    // (dann wurden vermutlich weit entfernte Woerter erwischt).
    if ((B - T) / imgH > 0.5) continue;
    return { x: L / imgW, y: T / imgH, w: (R - L) / imgW, h: (B - T) / imgH };
  }
  return null;
}

export interface OcrPage { pngBuffer: Buffer; width: number; height: number; pageNumber: number; }

