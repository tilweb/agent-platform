/**
 * Zentrale S3-Key-Konventionen. Kein Modul soll Pfade als Strings hardcoden —
 * alle Schreib-/Lese-Operationen gehen ueber diese Helper, damit das Layout
 * an einer Stelle dokumentiert ist und sich kontrolliert weiterentwickeln laesst.
 *
 * Sicherheit: Alle ID-Parameter werden vor dem Bauen geprueft. Ein Caller
 * darf z.B. `contractId="../other"` nicht durchschmuggeln (Path-Injection).
 * S3 hat keine echten Verzeichnisse, aber `..`-Segmente koennten fremde
 * Bucket-Prefixe treffen wenn ein Service unsanitized vom Client weiterreicht.
 * Siehe security-review H8.
 */

const ID_REGEX = /^[a-zA-Z0-9_.\-]{1,128}$/;
const EXT_REGEX = /^[a-zA-Z0-9]{1,12}$/;
const FILENAME_REGEX = /^[a-zA-Z0-9_.\- ]{1,255}$/;

function assertSafeId(id: string, label: string): void {
  if (!id || !ID_REGEX.test(id)) {
    throw new Error(`Invalid ${label}: "${id}" must match ${ID_REGEX}`);
  }
}

function assertSafeExt(ext: string): void {
  if (!ext || !EXT_REGEX.test(ext)) {
    throw new Error(`Invalid extension: "${ext}" must match ${EXT_REGEX}`);
  }
}

function assertSafeFilename(name: string): void {
  // basename-Vergleich: keine Pfad-Trenner, keine Traversal-Segmente
  if (!name || !FILENAME_REGEX.test(name) || name.includes('..')) {
    throw new Error(`Invalid filename: "${name}"`);
  }
}

export const s3Paths = {
  userFile: (userId: string, path: string) => {
    assertSafeId(userId, 'userId');
    return `users/${userId}/${stripLeadingSlash(path)}`;
  },
  chatUpload: (sessionId: string, file: string) => {
    assertSafeId(sessionId, 'sessionId');
    assertSafeFilename(file);
    return `chat-uploads/${sessionId}/${file}`;
  },
  kbContent: (collectionId: string, docId: string) => {
    assertSafeId(collectionId, 'collectionId');
    assertSafeId(docId, 'docId');
    return `kb/${collectionId}/${docId}/content.md`;
  },
  kbIndex: (collectionId: string, docId: string) => {
    assertSafeId(collectionId, 'collectionId');
    assertSafeId(docId, 'docId');
    return `kb/${collectionId}/${docId}/INDEX.md`;
  },
  kbIncoming: (uploadId: string, filename: string) => {
    assertSafeId(uploadId, 'uploadId');
    assertSafeFilename(filename);
    return `kb/incoming/${uploadId}/${filename}`;
  },
  generatedImage: (imageId: string, ext = 'png') => {
    assertSafeId(imageId, 'imageId');
    assertSafeExt(ext);
    return `generated-images/${imageId}.${ext}`;
  },
  exportFile: (exportId: string, ext: string) => {
    assertSafeId(exportId, 'exportId');
    assertSafeExt(ext);
    return `exports/${exportId}.${ext}`;
  },
  contractDocument: (contractId: string) => {
    assertSafeId(contractId, 'contractId');
    return `apps/vertragsmanagement/${contractId}/document.md`;
  },
  contractOriginal: (contractId: string, ext: string) => {
    assertSafeId(contractId, 'contractId');
    assertSafeExt(ext);
    return `apps/vertragsmanagement/${contractId}/original.${ext}`;
  },
  // Multi-File-Attachments (Phase 2): Original + ggf. Markitdown-Output pro Anhang.
  contractAttachmentOriginal: (contractId: string, attachmentId: string, ext: string) => {
    assertSafeId(contractId, 'contractId');
    assertSafeId(attachmentId, 'attachmentId');
    assertSafeExt(ext);
    return `apps/vertragsmanagement/${contractId}/attachments/${attachmentId}/original.${ext}`;
  },
  contractAttachmentMarkdown: (contractId: string, attachmentId: string) => {
    assertSafeId(contractId, 'contractId');
    assertSafeId(attachmentId, 'attachmentId');
    return `apps/vertragsmanagement/${contractId}/attachments/${attachmentId}/document.md`;
  },
  paAttachment: (paId: string, file: string) => {
    assertSafeId(paId, 'paId');
    assertSafeFilename(file);
    return `apps/projektmanagement/${paId}/anhaenge/${file}`;
  },
  supplierDoc: (supplierId: string, docId: string, file: string) => {
    assertSafeId(supplierId, 'supplierId');
    assertSafeId(docId, 'docId');
    assertSafeFilename(file);
    return `apps/lieferantenmanagement/${supplierId}/${docId}/${file}`;
  },
  // Podcast-Repurposing: hochgeladenes Video + extrahiertes Audio pro Episode.
  prVideo: (episodeId: string, ext: string) => {
    assertSafeId(episodeId, 'episodeId');
    assertSafeExt(ext);
    return `apps/podcast-repurposing/${episodeId}/source.${ext}`;
  },
  prAudio: (episodeId: string) => {
    assertSafeId(episodeId, 'episodeId');
    return `apps/podcast-repurposing/${episodeId}/audio.mp3`;
  },
};

function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, '');
}
