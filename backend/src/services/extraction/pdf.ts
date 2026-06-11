/**
 * Heavy Extraction Pipeline — PDF-Seiten zu PNG-Images rendern.
 *
 * Strategie: System-Tool `pdftocairo` (poppler-utils) ueber Bun.spawn. Vorteil:
 * keine npm-Native-Bindings (canvas/jsdom), keine Build-Probleme im Container.
 * Nachteil: muss auf dem Server installiert sein:
 *   - macOS: brew install poppler
 *   - Ubuntu/Scalingo: apt-get install poppler-utils
 *   - Railway/Dockerfile: RUN apt-get install -y poppler-utils
 *
 * Falls `pdftocairo` nicht im PATH ist, wirft `renderPdfToImages` einen
 * `PdfRenderError`. Die vision-per-page-Strategy faengt das ab und eskaliert
 * zurueck auf eine text-basierte Strategy.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class PdfRenderError extends Error {
  public readonly underlyingCause?: unknown;
  constructor(message: string, underlyingCause?: unknown) {
    super(message);
    this.name = 'PdfRenderError';
    this.underlyingCause = underlyingCause;
  }
}

let pdftocairoChecked = false;
let pdftocairoAvailable = false;

/**
 * Einmaliger Health-Check: ist `pdftocairo` im PATH? Cached, da sich das zur
 * Laufzeit nicht aendert.
 */
export async function isPdfRendererAvailable(): Promise<boolean> {
  if (pdftocairoChecked) return pdftocairoAvailable;
  pdftocairoChecked = true;
  try {
    const proc = Bun.spawn(['pdftocairo', '-v'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    pdftocairoAvailable = true;
  } catch {
    pdftocairoAvailable = false;
  }
  return pdftocairoAvailable;
}

export interface PdfPageImage {
  pageNumber: number;          // 1-basiert
  pngBuffer: Buffer;
  width: number;               // Pixel
  height: number;              // Pixel
}

/** Liest Breite/Hoehe aus dem PNG-IHDR-Header (Bytes 16-23, Big-Endian). */
export function pngDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24) return { width: 0, height: 0 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export interface RenderOptions {
  /** DPI fuer die Image-Aufloesung. Default 200 — fuer Vision-LLM ausreichend. */
  dpi?: number;
  /** Maximale Seitenzahl. Schutz vor 1000-Seiten-PDFs. Default 500. */
  maxPages?: number;
  /** Nur diese Seiten rendern (1-basiert). Default: alle. */
  pageSelection?: number[];
}

/**
 * Rendert ein PDF in eine Liste von PNG-Buffers, eine pro Seite.
 *
 * Schreibt PDF in ein Temp-Verzeichnis, ruft pdftocairo, liest die generierten
 * PNGs ein, raeumt das Temp-Verzeichnis wieder auf.
 *
 * Wirft `PdfRenderError` bei Fehler — `vision-per-page` interpretiert das als
 * Hinweis, dass diese Datei nicht via Vision-Pfad gehen kann.
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  options: RenderOptions = {},
): Promise<PdfPageImage[]> {
  if (!(await isPdfRendererAvailable())) {
    throw new PdfRenderError(
      '`pdftocairo` ist nicht im PATH. Installiere poppler-utils (apt-get install poppler-utils oder brew install poppler).',
    );
  }

  const dpi = options.dpi ?? 200;
  const maxPages = options.maxPages ?? 500;

  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'extraction-pdf-'));
    const pdfPath = join(tmpDir, 'input.pdf');
    const outPrefix = join(tmpDir, 'page');

    await Bun.write(pdfPath, pdfBuffer);

    // Wenn pageSelection vorhanden: pro Seite einen Aufruf (-singlefile fixiert
    // den Output-Namen; -f N -l N waehlt die Seite). Sonst alle Seiten in einem
    // Rutsch.
    const pages = options.pageSelection;
    if (pages && pages.length > 0) {
      const out: PdfPageImage[] = [];
      for (const pageNumber of pages.slice(0, maxPages)) {
        const singleOutPrefix = join(tmpDir, `single-${pageNumber}`);
        const proc = Bun.spawn(
          ['pdftocairo', '-png', '-singlefile', '-r', String(dpi), '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, singleOutPrefix],
          { stdout: 'pipe', stderr: 'pipe' },
        );
        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new PdfRenderError(`pdftocairo Exit ${exitCode} bei Seite ${pageNumber}: ${stderr}`);
        }
        const pngPath = `${singleOutPrefix}.png`;
        const buf = await readFile(pngPath);
        out.push({ pageNumber, pngBuffer: buf, ...pngDimensions(buf) });
      }
      return out;
    }

    // Alle Seiten in einem Aufruf
    const proc = Bun.spawn(
      ['pdftocairo', '-png', '-r', String(dpi), pdfPath, outPrefix],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new PdfRenderError(`pdftocairo Exit ${exitCode}: ${stderr}`);
    }

    // Output-Dateien einlesen: page-1.png, page-2.png, ... (oder ohne Suffix
    // bei single-page-PDFs: page.png)
    const out: PdfPageImage[] = [];
    const glob = new Bun.Glob('page*.png');
    const pngs: string[] = [];
    for await (const name of glob.scan({ cwd: tmpDir })) {
      pngs.push(name);
    }
    pngs.sort((a, b) => {
      const na = parseInt(a.replace(/[^\d]/g, ''), 10) || 0;
      const nb = parseInt(b.replace(/[^\d]/g, ''), 10) || 0;
      return na - nb;
    });
    for (let i = 0; i < pngs.length && i < maxPages; i += 1) {
      const buf = await readFile(join(tmpDir, pngs[i]!));
      out.push({ pageNumber: i + 1, pngBuffer: buf, ...pngDimensions(buf) });
    }
    return out;
  } catch (err) {
    if (err instanceof PdfRenderError) throw err;
    throw new PdfRenderError(`PDF-Render fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`, err);
  } finally {
    if (tmpDir) {
      // Best-effort cleanup
      try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
    }
  }
}

/**
 * Zaehlt nur die Seiten eines PDFs (ohne sie zu rendern). Nuetzlich fuer
 * estimateCost. Nutzt pdftocairo -f 1 -l 1 als Indirekt-Probe — wenn es Erfolg
 * hat, gibts mindestens 1 Seite. Fuer den exakten Count fragen wir pdfinfo,
 * sofern vorhanden. Fallback: rendere mit hohem Limit, zaehle Output.
 */
export async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  if (!(await isPdfRendererAvailable())) return 0;

  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'extraction-pdf-info-'));
    const pdfPath = join(tmpDir, 'input.pdf');
    await Bun.write(pdfPath, pdfBuffer);

    // pdfinfo ist ebenfalls Teil von poppler-utils
    try {
      const proc = Bun.spawn(['pdfinfo', pdfPath], { stdout: 'pipe', stderr: 'pipe' });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      const match = out.match(/Pages:\s*(\d+)/);
      if (match && match[1]) return parseInt(match[1], 10);
    } catch {
      // pdfinfo nicht da → Fallback
    }
    return 0;
  } finally {
    if (tmpDir) {
      try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
    }
  }
}
