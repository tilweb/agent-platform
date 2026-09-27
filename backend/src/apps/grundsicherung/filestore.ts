/**
 * Grundsicherung — Ablage hochgeladener Originaldateien (Adapter auf den Antrag-Kern).
 * S3, wenn FLOW_S3_* gesetzt ist; sonst lokal unter `../data/apps/grundsicherung/uploads/`.
 */
import { createDateiablage } from '../_antrag-kern/dateiablage';

export type { StoredFile, ResolvedRef } from '../_antrag-kern/dateiablage';

export const ablage = createDateiablage({ appId: 'grundsicherung', logPraefix: '[grundsicherung]' });

export const storeUpload = ablage.storeUpload;
export const resolveStorageRef = ablage.resolveStorageRef;
export const loadDokumentDatei = ablage.loadDokumentDatei;
export const removeStoredFile = ablage.removeStoredFile;
