/**
 * Ablage der gerenderten Seitenbilder eines Batch-Ergebnisses (Welle 5).
 *
 * Bis Welle 4 lagen die PNGs als base64-`dataUri` im Datei-Record: eine
 * 5-seitige Vision-Extraktion blaeht damit ein einzelnes YAML auf mehrere MB
 * auf, das bei jedem Polling-Zugriff geparst wird. Die Bytes wandern deshalb in
 * separate Dateien; im Record bleibt eine Referenz (Seite + Groesse),
 * ausgeliefert wird ueber eine Proxy-Route (same-origin — signierte URLs
 * blockiert die CSP `img-src 'self'`).
 *
 * DIVERGENT: Railway = Volume-Datei unter `data/extraction-batch-pages/`,
 * Scalingo = S3 (dort ist das Dateisystem ephemer). Alle Aufrufer nutzen nur
 * die hier exportierten Signaturen.
 *
 * Fail-Soft: Laesst sich nicht speichern, behaelt das Bild seinen `dataUri`
 * (altes Verhalten) — eine Extraktion darf nie an der Vorschau scheitern.
 */

import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { PageImage } from '../../services/extraction/types';

const PAGES_DIR = resolve(process.cwd(), '../data/extraction-batch-pages');

/** Nur unverdaechtige Ids in Pfade lassen (kein Traversal). */
const ID_REGEX = /^[a-zA-Z0-9_.\-]{1,128}$/;

function assertSafeId(id: string, label: string): void {
  if (!id || !ID_REGEX.test(id)) throw new Error(`Invalid ${label}: "${id}"`);
}

function pagePath(runId: string, fileId: string, page: number): string {
  assertSafeId(runId, 'runId');
  assertSafeId(fileId, 'fileId');
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error(`Invalid page: ${page}`);
  return join(PAGES_DIR, runId, fileId, `p${page}.png`);
}

/**
 * Seitenbild, wie es im Datei-Record gespeichert wird: entweder ausgelagert
 * (nur Metadaten) oder — im Fallback — weiterhin inline.
 */
export interface StoredPageImage {
  page: number;
  width: number;
  height: number;
  /** Nur im Fallback gesetzt (Ablage nicht verfuegbar). */
  dataUri?: string;
}

/** `data:image/png;base64,...` → Bytes. Null, wenn das Format nicht passt. */
export function dataUriToBuffer(dataUri: string): Buffer | null {
  const comma = dataUri.indexOf(',');
  if (comma === -1 || !dataUri.startsWith('data:')) return null;
  try {
    return Buffer.from(dataUri.slice(comma + 1), 'base64');
  } catch {
    return null;
  }
}

/**
 * Seitenbilder auslagern. Gibt die Referenzen zurueck, die im Datei-Record
 * gespeichert werden.
 */
export async function savePageImages(
  runId: string,
  fileId: string,
  images: PageImage[] | undefined,
): Promise<StoredPageImage[] | undefined> {
  if (!images || images.length === 0) return images ? [] : undefined;

  const stored: StoredPageImage[] = [];
  for (const img of images) {
    const buffer = dataUriToBuffer(img.dataUri);
    if (!buffer) {
      stored.push({ page: img.page, width: img.width, height: img.height, dataUri: img.dataUri });
      continue;
    }
    try {
      const path = pagePath(runId, fileId, img.page);
      await mkdir(join(PAGES_DIR, runId, fileId), { recursive: true });
      await writeFile(path, buffer);
      stored.push({ page: img.page, width: img.width, height: img.height });
    } catch (err) {
      console.error(
        `[page-store] Seite ${img.page} von ${runId}/${fileId} nicht ausgelagert:`,
        err instanceof Error ? err.message : err,
      );
      stored.push({ page: img.page, width: img.width, height: img.height, dataUri: img.dataUri });
    }
  }
  return stored;
}

/** Ein Seitenbild lesen (Proxy-Route). Null, wenn es nicht (mehr) existiert. */
export async function readPageImage(runId: string, fileId: string, page: number): Promise<Buffer | null> {
  try {
    const path = pagePath(runId, fileId, page);
    if (!existsSync(path)) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

/** Alle Seitenbilder eines Laufs entfernen (beim Loeschen des Laufs). */
export async function deletePageImages(runId: string): Promise<void> {
  try {
    assertSafeId(runId, 'runId');
    await rm(join(PAGES_DIR, runId), { recursive: true, force: true });
  } catch (err) {
    console.error(`[page-store] Aufraeumen von ${runId} fehlgeschlagen:`, err instanceof Error ? err.message : err);
  }
}
