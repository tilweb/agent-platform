/**
 * Document Importer Service
 *
 * Imports documents from various sources (chats, confluence, gdrive)
 * into the knowledge base for indexing into collections.
 */

import { writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { loadChatHistory, type ChatHistory } from './memory';
import { indexerService } from './indexer';
import { KB_BASE, KB_INCOMING_DIR as INCOMING_DIR, APPS_DIR } from '../utils/paths';

export interface ImportItem {
  id: string;
  type: 'chat' | 'chats' | 'knowledge' | 'confluence' | 'gdrive' | 'contract' | 'material';
  title: string;
  content?: string;  // Direct content for material type
  metadata?: Record<string, any>;
}

export interface ImportResult {
  itemId: string;
  itemType: string;
  title: string;
  success: boolean;
  documentId?: string;
  error?: string;
}

/**
 * Save content to incoming folder
 */
async function saveToIncoming(content: string, filename: string): Promise<string> {
  if (!existsSync(INCOMING_DIR)) {
    await mkdir(INCOMING_DIR, { recursive: true });
  }

  const filePath = join(INCOMING_DIR, filename);
  await writeFile(filePath, content, 'utf-8');
  return filename;
}

/**
 * Format chat history as a document
 */
function formatChatAsDocument(chat: ChatHistory): string {
  const lines: string[] = [
    `# ${chat.title}`,
    '',
    `> Chat-Export vom ${new Date(chat.createdAt).toLocaleDateString('de-DE')}`,
    '',
  ];

  if (chat.summary) {
    lines.push('## Zusammenfassung');
    lines.push('');
    lines.push(chat.summary);
    lines.push('');
  }

  if (chat.keywords && chat.keywords.length > 0) {
    lines.push(`**Keywords:** ${chat.keywords.join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Gesprächsverlauf');
  lines.push('');

  for (const msg of chat.messages) {
    const roleLabel = msg.role === 'user' ? '👤 Benutzer' : '🤖 Assistent';
    lines.push(`### ${roleLabel}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a material (marked response, skill result, etc.) as a document
 */
function formatMaterialAsDocument(item: ImportItem): string {
  const lines: string[] = [
    `# ${item.title}`,
    '',
    `> Material-Export vom ${new Date().toLocaleDateString('de-DE')}`,
    '',
  ];

  // Add metadata if available
  if (item.metadata) {
    if (item.metadata.skillId) {
      lines.push(`**Skill:** ${item.metadata.skillId}`);
    }
    if (item.metadata.filename) {
      lines.push(`**Quelldatei:** ${item.metadata.filename}`);
    }
    if (item.metadata.chatId) {
      lines.push(`**Chat-ID:** ${item.metadata.chatId}`);
    }
    if (lines.length > 4) {
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Inhalt');
  lines.push('');
  lines.push(item.content || '');

  return lines.join('\n');
}

/**
 * Copy an existing KB document to a new collection
 * (With the new structure, documents live inside collections, so we need to copy)
 */
async function copyDocumentToCollection(
  sourceDocId: string,
  sourceCollectionId: string,
  targetCollectionId: string,
  title: string
): Promise<string> {
  const { readFile: readFileAsync, writeFile: writeFileAsync, mkdir: mkdirAsync, readdir } = await import('fs/promises');
  const { cp } = await import('fs/promises');

  // Find the source document
  const sourceDocDir = join(KB_BASE, 'collections', sourceCollectionId, 'documents', sourceDocId);
  if (!existsSync(sourceDocDir)) {
    throw new Error(`Quelldokument nicht gefunden: ${sourceDocId} in ${sourceCollectionId}`);
  }

  // Generate new document ID for the copy
  const timestamp = Date.now();
  const newDocId = `${sourceDocId}-copy-${timestamp}`;

  // Copy document to target collection
  const targetDocDir = join(KB_BASE, 'collections', targetCollectionId, 'documents', newDocId);
  await mkdirAsync(targetDocDir, { recursive: true });
  await cp(sourceDocDir, targetDocDir, { recursive: true });

  // Read indexed date from meta
  let indexedDate = new Date().toISOString().split('T')[0] ?? '';
  const metaPath = join(targetDocDir, 'DOCUMENT_META.md');
  if (existsSync(metaPath)) {
    const meta = await readFileAsync(metaPath, 'utf-8');
    const dateMatch = meta.match(/Indiziert:\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      indexedDate = dateMatch[1] ?? indexedDate;
    }
  }

  // Update collection manifest
  const manifestPath = join(KB_BASE, 'collections', targetCollectionId, 'manifest.yaml');
  let manifest = await readFileAsync(manifestPath, 'utf-8');

  const newEntry = [
    `  - document_id: "${newDocId}"`,
    `    title: "${title}"`,
    `    path: "${newDocId}"`,
    `    indexed_date: "${indexedDate}"`,
  ].join('\n');

  if (manifest.includes('documents: []')) {
    manifest = manifest.replace('documents: []', `documents:\n${newEntry}`);
  } else {
    manifest = manifest.trimEnd() + '\n' + newEntry + '\n';
  }

  manifest = manifest.replace(
    /last_updated: ".*"/,
    `last_updated: "${new Date().toISOString()}"`
  );

  await writeFileAsync(manifestPath, manifest, 'utf-8');

  // Update document count in collections.yaml
  const collectionsPath = join(KB_BASE, 'collections.yaml');
  let collectionsContent = await readFileAsync(collectionsPath, 'utf-8');

  const regex = new RegExp(
    `(- id: "${targetCollectionId}"[\\s\\S]*?document_count: )(\\d+)`
  );
  const match = collectionsContent.match(regex);
  if (match) {
    const currentCount = parseInt(match[2] ?? '0', 10);
    collectionsContent = collectionsContent.replace(regex, `$1${currentCount + 1}`);
    await writeFileAsync(collectionsPath, collectionsContent, 'utf-8');
  }

  return newDocId;
}

export interface IndexingOptions {
  preAllocatedDocumentId?: string;
  skipManifestEntry?: boolean;
}

/**
 * Import and index a single document
 */
export async function importAndIndex(
  item: ImportItem,
  collectionId: string,
  userId?: string,
  indexingOptions?: IndexingOptions,
): Promise<ImportResult> {
  console.log('[documentImporter] Processing item:', {
    id: item.id,
    type: item.type,
    title: item.title,
    metadata: item.metadata,
    userId,
  });

  // Resolve user display name for owner field
  let ownerName: string | undefined;
  if (userId) {
    try {
      const { loadUser } = await import('../auth/storage');
      const user = await loadUser(userId);
      ownerName = user?.displayName || user?.username;
    } catch { /* ignore lookup errors */ }
  }

  const baseResult: ImportResult = {
    itemId: item.id,
    itemType: item.type,
    title: item.title,
    success: false,
  };

  try {
    switch (item.type) {
      case 'knowledge': {
        // Existing KB document - copy to new collection
        const sourceDocId = item.metadata?.path || item.id;
        const sourceCollectionId = item.metadata?.collection_id || item.metadata?.collectionId;

        if (!sourceCollectionId) {
          return { ...baseResult, error: 'Quell-Collection-ID fehlt' };
        }

        const newDocId = await copyDocumentToCollection(
          sourceDocId,
          sourceCollectionId,
          collectionId,
          item.title
        );
        return {
          ...baseResult,
          success: true,
          documentId: newDocId,
        };
      }

      case 'chat':
      case 'chats': {
        // Export chat as markdown document
        console.log('[documentImporter] Processing chat, id:', item.id);
        const chat = await loadChatHistory(item.id);
        console.log('[documentImporter] Chat loaded:', chat ? 'yes' : 'no');
        if (!chat) {
          return { ...baseResult, error: 'Chat nicht gefunden' };
        }

        const chatMd = formatChatAsDocument(chat);
        const safeTitle = item.title
          .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 50);
        const filename = `chat-${safeTitle}-${Date.now()}.md`;
        await saveToIncoming(chatMd, filename);

        const result = await indexerService.indexDocument(filename, collectionId, {
          title: `Chat: ${item.title}`,
          confidentiality: 'internal',
          owner: ownerName,
        }, userId, indexingOptions);

        return {
          ...baseResult,
          success: true,
          documentId: result.document_id,
        };
      }

      case 'confluence': {
        // Fetch from Confluence and import via connection tool
        const pageId = item.metadata?.pageId || item.id;

        try {
          const { toolRegistry } = await import('../tools/registry');

          const tool = toolRegistry.get('confluence_read_page');
          if (!tool) {
            return { ...baseResult, error: 'Confluence Tool nicht verfügbar' };
          }

          const resultStr = await tool.execute(
            { page_id: pageId },
            { userId }
          );

          // The Confluence tool returns markdown directly (not JSON)
          if (resultStr.startsWith('Error:') || resultStr.includes('Not connected')) {
            return { ...baseResult, error: resultStr };
          }

          const filename = `confluence-${pageId}-${Date.now()}.md`;
          await saveToIncoming(resultStr, filename);

          const result = await indexerService.indexDocument(filename, collectionId, {
            title: item.title,
            confidentiality: 'internal',
          }, userId, indexingOptions);

          return {
            ...baseResult,
            success: true,
            documentId: result.document_id,
          };
        } catch (error: any) {
          return { ...baseResult, error: error.message };
        }
      }

      case 'gdrive': {
        // Fetch from Google Drive and import
        const fileId = item.metadata?.fileId || item.id;
        const mimeType = item.metadata?.mimeType || '';
        console.log('[documentImporter] Processing gdrive, fileId:', fileId, 'mimeType:', mimeType);

        try {
          const { connectionRegistry } = await import('../connections/registry');

          if (!userId) {
            return { ...baseResult, error: 'User-Authentifizierung erforderlich' };
          }

          // Get tokens for the user
          const tokens = await connectionRegistry.getTokens(userId, 'google-drive');
          if (!tokens) {
            return { ...baseResult, error: 'Nicht mit Google Drive verbunden' };
          }

          const headers = {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          };

          const safeTitle = item.title
            .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-_.]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50);

          // Determine if we should download the file directly or read its content
          // Text-based files that gdrive_read_file can handle:
          const textBasedTypes = [
            'text/',
            'application/json',
            'application/vnd.google-apps.document',
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.google-apps.presentation',
          ];
          const isTextBased = textBasedTypes.some(t => mimeType.startsWith(t));

          // Download binary files (PDF, DOCX, XLSX, images, etc.) directly
          // The indexer's Markitdown API can handle these
          if (!isTextBased && mimeType) {
            console.log('[documentImporter] Downloading file from Google Drive:', mimeType);

            // Download the file
            const downloadResponse = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
              { headers }
            );

            if (!downloadResponse.ok) {
              throw new Error(`Download fehlgeschlagen: ${downloadResponse.status}`);
            }

            const buffer = await downloadResponse.arrayBuffer();
            const extension = mimeType === 'application/pdf' ? '.pdf' : '';
            const filename = `gdrive-${safeTitle}-${Date.now()}${extension}`;

            // Save binary file to incoming
            const filePath = join(INCOMING_DIR, filename);
            if (!existsSync(INCOMING_DIR)) {
              await mkdir(INCOMING_DIR, { recursive: true });
            }
            await writeFile(filePath, Buffer.from(buffer));
            console.log('[documentImporter] Binary file saved:', filename);

            const result = await indexerService.indexDocument(filename, collectionId, {
              title: item.title,
              confidentiality: 'internal',
            }, userId, indexingOptions);

            return {
              ...baseResult,
              success: true,
              documentId: result.document_id,
            };
          }

          // For text-based files, use the read tool
          const { toolRegistry } = await import('../tools/registry');
          const tool = toolRegistry.get('gdrive_read_file');

          if (!tool) {
            return { ...baseResult, error: 'Google Drive Tool nicht verfügbar' };
          }

          const resultStr = await tool.execute(
            { file_id: fileId },
            { userId }
          );

          // Parse the JSON result
          let parsed: { content?: string; error?: string; file?: { name: string } };
          try {
            parsed = JSON.parse(resultStr);
          } catch {
            return { ...baseResult, error: 'Ungültige Antwort von Google Drive' };
          }

          if (parsed.error) {
            return { ...baseResult, error: parsed.error };
          }

          if (!parsed.content) {
            return { ...baseResult, error: 'Kein Inhalt von Google Drive erhalten' };
          }

          // Create markdown content with title
          const mdContent = `# ${item.title}\n\n${parsed.content}`;
          const filename = `gdrive-${safeTitle}-${Date.now()}.md`;
          await saveToIncoming(mdContent, filename);

          const result = await indexerService.indexDocument(filename, collectionId, {
            title: item.title,
            confidentiality: 'internal',
          }, userId, indexingOptions);

          return {
            ...baseResult,
            success: true,
            documentId: result.document_id,
          };
        } catch (error: any) {
          console.error('[documentImporter] gdrive error:', error);
          return { ...baseResult, error: error.message };
        }
      }

      case 'contract': {
        // Import contract document from vertragsmanagement
        const contractId = item.id;
        const contractDocPath = join(APPS_DIR, 'vertragsmanagement/contracts', contractId, 'document.md');
        const contractMetaPath = join(APPS_DIR, 'vertragsmanagement/contracts', contractId, 'metadata.yaml');

        if (!existsSync(contractDocPath)) {
          return { ...baseResult, error: 'Vertragsdokument nicht gefunden' };
        }

        const { readFile: readFileAsync } = await import('fs/promises');
        let content = await readFileAsync(contractDocPath, 'utf-8');

        // Try to add metadata header
        if (existsSync(contractMetaPath)) {
          try {
            const { parse } = await import('yaml');
            const metaContent = await readFileAsync(contractMetaPath, 'utf-8');
            const meta = parse(metaContent);

            // Add metadata header to content
            const header = [
              `# ${item.title}`,
              '',
              `> Vertragstyp: ${meta.contract_type || 'Unbekannt'}`,
              `> Hochgeladen: ${meta.uploaded_at || 'Unbekannt'}`,
              `> Datei: ${meta.upload_filename || 'Unbekannt'}`,
              '',
              '---',
              '',
            ].join('\n');

            content = header + content;
          } catch {
            // Continue without metadata header
          }
        }

        const safeTitle = item.title
          .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 50);
        const filename = `contract-${safeTitle}-${Date.now()}.md`;
        await saveToIncoming(content, filename);

        const result = await indexerService.indexDocument(filename, collectionId, {
          title: item.title,
          confidentiality: 'internal',
          owner: ownerName,
        }, userId, indexingOptions);

        return {
          ...baseResult,
          success: true,
          documentId: result.document_id,
        };
      }

      case 'material': {
        // Direct content from chat materials (transcripts, marked responses, etc.)
        console.log('[documentImporter] Processing material:', item.id, 'title:', item.title);

        // Special handling for uploaded files (PDF, images, etc.): use the actual file
        if (item.metadata?.materialType === 'upload' && item.metadata?.attachmentId) {
          const uploadResult = await importUploadedMaterial(item, collectionId, userId, indexingOptions, ownerName);
          return { ...baseResult, ...uploadResult };
        }

        // Special handling for generated images: include the actual image file
        if (item.metadata?.materialType === 'generated_image' && item.metadata?.imageId) {
          const imageResult = await importGeneratedImageMaterial(item, collectionId, userId, indexingOptions, ownerName);
          return { ...baseResult, ...imageResult };
        }

        if (!item.content) {
          return { ...baseResult, error: 'Material hat keinen Inhalt' };
        }

        // Format as markdown document (text-only materials)
        const materialMd = formatMaterialAsDocument(item);
        const safeTitle = (item.title || 'material')
          .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 50);
        const filename = `material-${safeTitle}-${Date.now()}.md`;
        await saveToIncoming(materialMd, filename);

        const result = await indexerService.indexDocument(filename, collectionId, {
          title: item.title || 'Material',
          confidentiality: 'internal',
          owner: ownerName,
        }, userId, indexingOptions);

        return {
          ...baseResult,
          success: true,
          documentId: result.document_id,
        };
      }

      default:
        console.log('[documentImporter] Unknown type:', item.type);
        return { ...baseResult, error: `Unbekannter Dokumenttyp: ${item.type}` };
    }
  } catch (error: any) {
    console.error('[documentImporter] Error:', error);
    return { ...baseResult, error: error.message };
  }
}

/** MIME types that are images and should NOT be sent to Markitdown */
const IMAGE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
  'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
]);

/** File extensions that are images */
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
]);

function isImageFile(mimeType?: string, filename?: string): boolean {
  if (mimeType && IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) return true;
  if (filename) {
    const ext = extname(filename).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) return true;
  }
  return false;
}

/**
 * Import an uploaded file material (PDF, image, etc.): copies the actual
 * attachment file from chat-uploads into the incoming directory and indexes it.
 * Images are handled specially (stored as-is with markdown wrapper) since
 * Markitdown cannot process image files.
 */
async function importUploadedMaterial(
  item: ImportItem,
  collectionId: string,
  userId?: string,
  indexingOptions?: IndexingOptions,
  ownerName?: string,
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const attachmentId = item.metadata?.attachmentId;
  const chatId = item.metadata?.chatId;

  if (!attachmentId || !chatId) {
    return { success: false, error: 'Keine Attachment-ID oder Chat-ID vorhanden' };
  }

  const { attachmentsService } = await import('./attachments');

  // Get the actual file path from attachment storage
  const fileInfo = await attachmentsService.getAttachmentFilePath(attachmentId, chatId);
  if (!fileInfo) {
    return { success: false, error: 'Originaldatei nicht gefunden' };
  }

  // All file types (images, PDFs, Word, etc.) go through the indexer.
  // The indexer routes images to Vision LLM and documents to Markitdown API.
  const ext = extname(fileInfo.filename);
  const base = basename(fileInfo.filename, ext);
  const uniqueFilename = `${base}-${Date.now()}${ext}`;

  if (!existsSync(INCOMING_DIR)) {
    await mkdir(INCOMING_DIR, { recursive: true });
  }
  await copyFile(fileInfo.path, join(INCOMING_DIR, uniqueFilename));
  console.log(`[documentImporter] Copied attachment ${attachmentId} to incoming/${uniqueFilename}`);

  const result = await indexerService.indexDocument(uniqueFilename, collectionId, {
    title: item.title || fileInfo.filename,
    confidentiality: 'internal',
    owner: ownerName,
  }, userId, indexingOptions);

  return { success: true, documentId: result.document_id };
}


/**
 * Import a generated image material: copies the actual image file into the
 * KB document directory and creates a markdown document with both the image
 * and its description/prompt.
 */
/**
 * Fast-path import for generated images. All metadata (prompt, model, provider)
 * is already known — no LLM calls needed. Just store content.md, DOCUMENT_META.md,
 * and the image file, then update the manifest.
 */
async function importGeneratedImageMaterial(
  item: ImportItem,
  collectionId: string,
  _userId?: string,
  indexingOptions?: IndexingOptions,
  ownerName?: string,
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const imageId = item.metadata?.imageId;
  if (!imageId) {
    return { success: false, error: 'Keine Bild-ID vorhanden' };
  }

  const { getGeneratedImage, getImageMimeType } = await import('./imageStorage');

  const imageBuffer = await getGeneratedImage(imageId);
  if (!imageBuffer) {
    return { success: false, error: 'Bild nicht gefunden' };
  }

  const mimeType = await getImageMimeType(imageId);
  const ext = mimeType?.includes('png') ? 'png'
    : mimeType?.includes('jpeg') || mimeType?.includes('jpg') ? 'jpg'
    : mimeType?.includes('webp') ? 'webp'
    : 'png';

  const prompt = item.metadata?.prompt || item.title || '';
  const model = item.metadata?.model || item.metadata?.provider || 'unbekannt';
  const today = new Date().toISOString().split('T')[0] ?? '';
  const imageFilename = `image.${ext}`;

  // Truncate long titles (generated image prompts can be very long)
  const displayTitle = item.title.length > 80
    ? item.title.slice(0, 77) + '...'
    : item.title;

  // Generate document ID
  const timestamp = Date.now();
  const documentId = indexingOptions?.preAllocatedDocumentId || (() => {
    const base = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `doc-${base}-${timestamp}`;
  })();

  // Create document directory
  const docDir = join(KB_BASE, 'collections', collectionId, 'documents', documentId);
  await mkdir(docDir, { recursive: true });

  // content.md — the searchable document
  const contentMd = [
    `# ${item.title}`,
    '',
    `> Generiertes Bild vom ${new Date().toLocaleDateString('de-DE')}`,
    '',
    `**Modell:** ${model}`,
    '',
    '---',
    '',
    '## Bild',
    '',
    `![${prompt}](${imageFilename})`,
    '',
    '## Prompt',
    '',
    prompt,
    '',
  ].join('\n');

  // DOCUMENT_META.md — pre-built, no LLM needed
  const metaMd = [
    '# DOCUMENT_META',
    '',
    '## Basisdaten',
    `- **Titel:** ${displayTitle}`,
    `- **Dokument-ID:** ${documentId}`,
    '- **Typ:** generiertes-bild',
    `- **Erstellt:** ${today}`,
    `- **Indiziert:** ${today}`,
    `- **Quelle:** Bildgenerierung (${model})`,
    '- **Seitenanzahl:** 1',
    '- **Sprache:** de',
    '',
    '## Klassifizierung',
    `- **Collection:** ${collectionId}`,
    '- **Vertraulichkeit:** internal',
    `- **Owner:** ${ownerName || 'unbekannt'}`,
    '',
    '## Inhaltsbeschreibung',
    `Generiertes Bild mit dem Prompt: "${prompt}"`,
    '',
    '## Keywords',
    `generiertes bild, ${model}, ${prompt.toLowerCase().split(/\s+/).slice(0, 8).join(', ')}`,
    '',
    '## Beantwortet Fragen zu',
    `- Was zeigt das generierte Bild "${item.title}"?`,
    `- Welcher Prompt wurde für "${item.title}" verwendet?`,
    '',
  ].join('\n');

  // Write all files
  await Promise.all([
    writeFile(join(docDir, 'content.md'), contentMd, 'utf-8'),
    writeFile(join(docDir, 'DOCUMENT_META.md'), metaMd, 'utf-8'),
    writeFile(join(docDir, imageFilename), imageBuffer),
  ]);

  // Update manifest (skip if placeholder already exists from queue)
  if (!indexingOptions?.skipManifestEntry) {
    await indexerService.updateManifestPublic(collectionId, {
      document_id: documentId,
      title: displayTitle,
      path: documentId,
      source_file: imageFilename,
      indexed_date: today,
    });
    await indexerService.updateCollectionCountPublic(collectionId);
  } else {
    await indexerService.updateManifestSourceFilePublic(collectionId, documentId, imageFilename);
  }

  console.log(`[documentImporter] Generated image fast-indexed: ${item.title} → ${collectionId}/${documentId}`);
  return { success: true, documentId };
}

/**
 * Create a new collection in the knowledge base
 */
export async function createCollection(
  collectionId: string,
  name: string,
  description: string
): Promise<void> {
  const { KbManageTool } = await import('../tools/knowledge/KnowledgeTools');
  const tool = new KbManageTool();

  const result = await tool.execute({
    action: 'create_collection',
    collection_id: collectionId,
    name,
    description,
    activate_when: '',
    never_activate_when: '',
  });

  const parsed = JSON.parse(result);
  if (!parsed.success) {
    throw new Error(parsed.message || 'Fehler beim Erstellen der Collection');
  }
}
