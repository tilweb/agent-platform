/**
 * PDF → Text via `pdftotext -layout` (poppler-utils, bereits System-Abhängigkeit
 * im Backend, vgl. services/extraction/pdf.ts). `-layout` bewahrt die Spalten-
 * struktur der EMMA-Export-Eigenschaften (Key:Value je Zeile), die der Checker
 * braucht — bewusst NICHT Markitdown (das die Struktur reflowt).
 */

/** Liest PDF-Bytes über stdin, gibt Layout-Text über stdout zurück. */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(['pdftotext', '-layout', '-', '-'], {
      stdin: bytes,
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch (e) {
    throw new Error('pdftotext (poppler-utils) nicht verfügbar: ' + (e as Error).message);
  }
  const text = await new Response(proc.stdout as ReadableStream).text();
  const code = await proc.exited;
  if (code !== 0 && !text.trim()) {
    const err = await new Response(proc.stderr as ReadableStream).text();
    throw new Error(`pdftotext exit ${code}: ${err.slice(0, 200)}`);
  }
  return text;
}

/** Prüft einmalig, ob pdftotext im PATH liegt (für Health/Diagnose). */
export async function isPdftotextAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['pdftotext', '-v'], { stdout: 'pipe', stderr: 'pipe' });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}
