/**
 * Ablage der gerenderten Seitenbilder eines Batch-Ergebnisses (Welle 5).
 *
 * Bis Welle 4 lagen die PNGs als base64-`dataUri` in der `detail`-Spalte der
 * Datei-Zeile: eine 5-seitige Vision-Extraktion blaeht damit eine einzelne
 * Postgres-Zeile auf mehrere MB auf (Backup-, Replikations- und
 * Query-Kosten fuer Daten, die nur beim Aufklappen einer Zeile gebraucht
 * werden). Die Bytes wandern deshalb nach S3; in der Zeile bleibt eine
 * Referenz (Seite + Groesse), ausgeliefert wird ueber eine Proxy-Route
 * (same-origin — signierte S3-URLs blockiert die CSP `img-src 'self'`).
 *
 * DIVERGENT: Scalingo = S3 (ephemeres Dateisystem), Railway = Volume-Datei.
 * Alle Aufrufer nutzen nur die hier exportierten Signaturen.
 *
 * Fail-Soft: Laesst sich nicht speichern, behaelt das Bild seinen `dataUri`
 * (altes Verhalten) — eine Extraktion darf nie an der Vorschau scheitern.
 */

import { deleteObject, getObject, isS3Configured, listObjectsByPrefix, putObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import type { PageImage } from '../../services/extraction/types';

/**
 * Seitenbild, wie es in der Datei-Zeile gespeichert wird: entweder ausgelagert
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
 * Seitenbilder auslagern. Gibt die Referenzen zurueck, die in `detail`
 * gespeichert werden.
 */
export async function savePageImages(
  runId: string,
  fileId: string,
  images: PageImage[] | undefined,
): Promise<StoredPageImage[] | undefined> {
  if (!images || images.length === 0) return images ? [] : undefined;

  if (!isS3Configured()) {
    // Kein Objektspeicher (z.B. lokale Entwicklung ohne S3-Zugang): inline lassen.
    return images.map((img) => ({ page: img.page, width: img.width, height: img.height, dataUri: img.dataUri }));
  }

  const stored: StoredPageImage[] = [];
  for (const img of images) {
    const buffer = dataUriToBuffer(img.dataUri);
    if (!buffer) {
      stored.push({ page: img.page, width: img.width, height: img.height, dataUri: img.dataUri });
      continue;
    }
    try {
      await putObject(s3Paths.batchPageImage(runId, fileId, img.page), buffer, 'image/png');
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
  if (!isS3Configured()) return null;
  try {
    return await getObject(s3Paths.batchPageImage(runId, fileId, page));
  } catch {
    return null;
  }
}

/** Alle Seitenbilder eines Laufs entfernen (beim Loeschen des Laufs). */
export async function deletePageImages(runId: string): Promise<void> {
  if (!isS3Configured()) return;
  try {
    const prefix = `extraction-pages/${runId}/`;
    const objects = await listObjectsByPrefix(prefix);
    await Promise.all(objects.map((o) => deleteObject(o.key).catch(() => {})));
  } catch (err) {
    console.error(`[page-store] Aufraeumen von ${runId} fehlgeschlagen:`, err instanceof Error ? err.message : err);
  }
}
