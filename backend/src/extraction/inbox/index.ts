/**
 * Posteingang (Welle 4) — Public API.
 */

export { processInboxUpload, routePart, sweepStaleUploads, eingangsModus, planeTeile } from './service';
export { ladeUmschlag, baueUmschlag, umschlagNachLauf, type Umschlag } from './umschlag';
export {
  createUpload,
  listUploads,
  getUpload,
  deleteUpload,
  safeExt,
} from './store';
export type {
  InboxUpload,
  InboxUploadWithParts,
  InboxPart,
  InboxUploadStatus,
  InboxPartStatus,
} from './store';
export { rangesFromBoundaries, parseBoundaryVerdict, SPLIT_PROMPT } from './split';
export { parseClassification, partFilename, buildClassifyPrompt } from './classify';
export type { PartClassification } from './classify';
