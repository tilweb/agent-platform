/**
 * PDF → Layout-Text. Dünner Wrapper um die Plattform-Extraction-Funktion
 * `pdfToLayoutText` (poppler-utils, `pdftotext -layout`), damit die
 * pdftotext-Logik nur an EINER Stelle gepflegt wird. `-layout` bewahrt die
 * Spaltenstruktur von Formularen/Bescheinigungen (Key:Value je Zeile).
 */
import { pdfToLayoutText } from '../../services/extraction/pdf';

/** Liest PDF-Bytes, gibt Layout-Text zurück (delegiert an die Plattform-Pipeline). */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  return pdfToLayoutText(Buffer.from(bytes));
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
