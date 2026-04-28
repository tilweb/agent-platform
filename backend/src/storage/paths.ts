/**
 * Zentrale S3-Key-Konventionen. Kein Modul soll Pfade als Strings hardcoden —
 * alle Schreib-/Lese-Operationen gehen ueber diese Helper, damit das Layout
 * an einer Stelle dokumentiert ist und sich kontrolliert weiterentwickeln laesst.
 */

export const s3Paths = {
  userFile: (userId: string, path: string) => `users/${userId}/${stripLeadingSlash(path)}`,
  chatUpload: (sessionId: string, file: string) => `chat-uploads/${sessionId}/${file}`,
  kbContent: (collectionId: string, docId: string) => `kb/${collectionId}/${docId}/content.md`,
  kbIndex: (collectionId: string, docId: string) => `kb/${collectionId}/${docId}/INDEX.md`,
  kbIncoming: (uploadId: string, filename: string) => `kb/incoming/${uploadId}/${filename}`,
  generatedImage: (imageId: string, ext = 'png') => `generated-images/${imageId}.${ext}`,
  exportFile: (exportId: string, ext: string) => `exports/${exportId}.${ext}`,
  contractDocument: (contractId: string) => `apps/vertragsmanagement/${contractId}/document.md`,
  contractOriginal: (contractId: string, ext: string) =>
    `apps/vertragsmanagement/${contractId}/original.${ext}`,
  paAttachment: (paId: string, file: string) =>
    `apps/projektmanagement/${paId}/anhaenge/${file}`,
  supplierDoc: (supplierId: string, docId: string, file: string) =>
    `apps/lieferantenmanagement/${supplierId}/${docId}/${file}`,
};

function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, '');
}
