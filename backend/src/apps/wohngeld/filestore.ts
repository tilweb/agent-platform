/**
 * Wohngeld — Ablage hochgeladener Originaldateien (Adapter auf den Antrag-Kern).
 *
 * S3 (Flow.swiss), wenn FLOW_S3_* gesetzt ist; andernfalls lokaler Fallback unter
 * `../data/apps/wohngeld/uploads/`. Logik in `apps/_antrag-kern/dateiablage.ts`.
 */
import { createDateiablage } from '../_antrag-kern/dateiablage';

export type { StoredFile, ResolvedRef } from '../_antrag-kern/dateiablage';

export const ablage = createDateiablage({ appId: 'wohngeld', logPraefix: '[wohngeld]' });

/** Speichert Bytes (S3 falls konfiguriert, sonst lokal) und gibt einen storageRef zurück. */
export const storeUpload = ablage.storeUpload;
/** Löst einen storageRef in die Dokument-Felder `s3Key`/`pfad` auf. */
export const resolveStorageRef = ablage.resolveStorageRef;
/** Lädt die hinterlegten Bytes eines Dokuments (S3 via `s3Key`, sonst lokal via `pfad`). */
export const loadDokumentDatei = ablage.loadDokumentDatei;
/** Entfernt die lokal abgelegten Bytes eines Verweises (best-effort). Wirft nie. */
export const removeStoredFile = ablage.removeStoredFile;
