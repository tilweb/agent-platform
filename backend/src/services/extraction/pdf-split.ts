/**
 * PDF in Teil-PDFs zerlegen — Seitenbereiche extrahieren via System-Tools
 * `pdfseparate` + `pdfunite` (poppler-utils, wie `pdftocairo` in pdf.ts).
 *
 * Genutzt von der Eingangsstrecke (Posteingang, Welle 4): Sammel-Scans werden
 * an erkannten Dokumentgrenzen in eigenstaendige PDFs getrennt.
 *
 * Installation wie pdf.ts: macOS `brew install poppler`, Ubuntu/Scalingo
 * `poppler-utils` (Aptfile), Railway-Dockerfile installiert poppler-utils.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class PdfSplitError extends Error {
  public readonly underlyingCause?: unknown;
  constructor(message: string, underlyingCause?: unknown) {
    super(message);
    this.name = 'PdfSplitError';
    this.underlyingCause = underlyingCause;
  }
}

let splitterChecked = false;
let splitterAvailable = false;

/** Einmaliger Health-Check: sind `pdfseparate` UND `pdfunite` im PATH? (cached) */
export async function isPdfSplitterAvailable(): Promise<boolean> {
  if (splitterChecked) return splitterAvailable;
  splitterChecked = true;
  try {
    for (const bin of ['pdfseparate', 'pdfunite']) {
      const proc = Bun.spawn([bin, '-v'], { stdout: 'pipe', stderr: 'pipe' });
      await proc.exited;
    }
    splitterAvailable = true;
  } catch {
    splitterAvailable = false;
  }
  return splitterAvailable;
}

/**
 * Extrahiert die Seiten `from`..`to` (1-basiert, inklusiv) aus einem PDF als
 * eigenstaendiges PDF. Wirft `PdfSplitError` bei Fehlern (z.B. verschluesselte
 * PDFs — pdfseparate verweigert die dann trotz renderbarer Seiten).
 */
export async function buildPartPdf(pdfPath: string, from: number, to: number): Promise<Buffer> {
  if (!(await isPdfSplitterAvailable())) {
    throw new PdfSplitError(
      '`pdfseparate`/`pdfunite` sind nicht im PATH. Installiere poppler-utils (apt-get install poppler-utils oder brew install poppler).',
    );
  }
  if (from < 1 || to < from) {
    throw new PdfSplitError(`Ungueltiger Seitenbereich ${from}-${to}`);
  }

  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'extraction-split-'));

    // Einzelseiten extrahieren: page-<n>.pdf je Seite im Bereich.
    const sepProc = Bun.spawn(
      ['pdfseparate', '-f', String(from), '-l', String(to), pdfPath, join(tmpDir, 'page-%d.pdf')],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const sepExit = await sepProc.exited;
    if (sepExit !== 0) {
      const stderr = await new Response(sepProc.stderr).text();
      throw new PdfSplitError(`pdfseparate Exit ${sepExit}: ${stderr.trim()}`);
    }

    // Eine Seite → direkt lesen (pdfunite braucht >= 2 Inputs).
    if (from === to) {
      return await readFile(join(tmpDir, `page-${from}.pdf`));
    }

    const pagePaths: string[] = [];
    for (let p = from; p <= to; p += 1) pagePaths.push(join(tmpDir, `page-${p}.pdf`));
    const outPath = join(tmpDir, 'out.pdf');
    const uniteProc = Bun.spawn(['pdfunite', ...pagePaths, outPath], { stdout: 'pipe', stderr: 'pipe' });
    const uniteExit = await uniteProc.exited;
    if (uniteExit !== 0) {
      const stderr = await new Response(uniteProc.stderr).text();
      throw new PdfSplitError(`pdfunite Exit ${uniteExit}: ${stderr.trim()}`);
    }
    return await readFile(outPath);
  } catch (err) {
    if (err instanceof PdfSplitError) throw err;
    throw new PdfSplitError(
      `PDF-Split fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  } finally {
    if (tmpDir) {
      try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
    }
  }
}
