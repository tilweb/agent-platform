/**
 * Wohngeld — Ablage hochgeladener Originaldateien.
 *
 * Etabliertes Muster: S3 (Flow.swiss), wenn FLOW_S3_* gesetzt ist; andernfalls
 * lokaler Fallback unter `../data/apps/wohngeld/uploads/` (Dev ohne S3).
 * Zurückgegeben wird ein opaker `storageRef` (`s3:<key>` bzw. `local:<key>`), der
 * beim Anlegen des Dokuments in `s3Key`/`pfad` aufgelöst wird.
 */
import { resolve, join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { isS3Configured, putObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';

const DATA_DIR = resolve(process.cwd(), '../data');

function safeName(filename: string): string {
  const base = (filename || 'datei').split(/[\\/]/).pop() || 'datei';
  const cleaned = base.replace(/[^a-zA-Z0-9_.\- ]/g, '_').replace(/\.\./g, '_').slice(0, 200);
  return cleaned || 'datei';
}

function segment(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface StoredFile {
  /** Opaker Verweis: `s3:<key>` oder `local:<key>`. */
  storageRef: string;
  /** Anzeige-/Dateiname (bereinigt). */
  filename: string;
}

/** Aufgelöster Verweis für die Dokument-Persistenz. */
export interface ResolvedRef {
  s3Key?: string;
  pfad?: string;
}

/** Speichert Bytes (S3 falls konfiguriert, sonst lokal) und gibt einen storageRef zurück. */
export async function storeUpload(bytes: Uint8Array, filename: string, contentType?: string): Promise<StoredFile> {
  const name = safeName(filename);
  const key = s3Paths.wohngeldUpload(segment(), name);

  if (isS3Configured()) {
    try {
      await putObject(key, bytes, contentType ?? 'application/octet-stream');
      return { storageRef: `s3:${key}`, filename: name };
    } catch (err) {
      console.warn('[wohngeld] S3-Upload fehlgeschlagen, weiche auf lokale Ablage aus:', err instanceof Error ? err.message : err);
    }
  }

  const abs = join(DATA_DIR, key);
  await mkdir(dirname(abs), { recursive: true });
  await Bun.write(abs, bytes);
  return { storageRef: `local:${key}`, filename: name };
}

/** Löst einen storageRef in die Dokument-Felder `s3Key`/`pfad` auf. */
export function resolveStorageRef(storageRef?: string): ResolvedRef {
  if (!storageRef || typeof storageRef !== 'string') return {};
  if (storageRef.startsWith('s3:')) return { s3Key: storageRef.slice(3) };
  if (storageRef.startsWith('local:')) return { pfad: storageRef.slice(6) };
  return {};
}
