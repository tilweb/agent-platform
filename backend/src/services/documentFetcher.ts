/**
 * Document Fetcher Service
 *
 * Fetches document contents from various sources (chats, knowledge base, confluence, gdrive)
 * for use as context in chat conversations.
 *
 * NOTE: For binary files (PDF, DOCX, etc.) from Google Drive, we download them
 * and convert via Markitdown API to get readable text.
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { loadChatHistory, type ChatHistory } from './memory';

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');
const TEMP_DIR = resolve(process.cwd(), '../data/temp');

// Markitdown API settings (same as indexer.ts)
const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

export interface ReaderItem {
  id: string;
  type: 'chat' | 'chats' | 'knowledge' | 'confluence' | 'gdrive' | 'contract';
  title: string;
  metadata?: Record<string, any>;
}

export interface DocumentContext {
  id: string;
  type: string;
  title: string;
  content: string;
  source: string;
  error?: string;
}

/**
 * Format chat history as readable text
 */
function formatChatAsText(chat: ChatHistory): string {
  const lines: string[] = [
    `# Chat: ${chat.title}`,
    '',
    `Erstellt: ${new Date(chat.createdAt).toLocaleString('de-DE')}`,
    '',
  ];

  if (chat.summary) {
    lines.push(`**Zusammenfassung:** ${chat.summary}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  for (const msg of chat.messages) {
    const roleLabel = msg.role === 'user' ? 'Benutzer' : 'Assistent';
    lines.push(`**${roleLabel}:**`);
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Fetch content from a single document source
 */
async function fetchDocumentContent(
  item: ReaderItem,
  userId?: string
): Promise<DocumentContext> {
  const baseResult: DocumentContext = {
    id: item.id,
    type: item.type,
    title: item.title,
    content: '',
    source: '',
  };

  try {
    switch (item.type) {
      case 'chat':
      case 'chats': {
        // Load chat history and format as text
        const chat = await loadChatHistory(item.id);
        if (!chat) {
          return { ...baseResult, error: 'Chat nicht gefunden', source: 'Chat' };
        }
        return {
          ...baseResult,
          content: formatChatAsText(chat),
          source: 'Chat',
        };
      }

      case 'knowledge': {
        // Read KB document content.md (documents now inside collections)
        const docPath = item.metadata?.path || item.id;
        const collectionId = item.metadata?.collection_id || item.metadata?.collectionId;

        if (!collectionId) {
          return { ...baseResult, error: 'Collection-ID fehlt', source: 'Knowledge Base' };
        }

        // Security: Permission-Check vor Read. Ohne userId verweigern wir,
        // sonst koennte jeder anonyme Aufruf jede Collection laden.
        if (!userId) {
          return { ...baseResult, error: 'Kein User-Kontext — Zugriff verweigert', source: 'Knowledge Base' };
        }
        const { canView } = await import('../rbac/accessControl');
        const access = await canView(userId, 'collection', collectionId);
        if (!access.allowed) {
          return { ...baseResult, error: 'Zugriff auf Collection verweigert', source: 'Knowledge Base' };
        }

        const contentPath = join(KB_BASE, 'collections', collectionId, 'documents', docPath, 'content.md');

        if (!existsSync(contentPath)) {
          return { ...baseResult, error: 'Dokument nicht gefunden', source: 'Knowledge Base' };
        }

        const content = await readFile(contentPath, 'utf-8');
        return {
          ...baseResult,
          content,
          source: 'Knowledge Base',
        };
      }

      case 'confluence': {
        // Fetch from Confluence via MCP tool
        const pageId = item.metadata?.pageId || item.id;

        try {
          // Try to use the MCP confluence tool
          const { mcpManager } = await import('../mcp');

          // Find confluence server
          const servers = await mcpManager.getServers();
          const confluenceServer = servers.find(
            (s) => s.name.toLowerCase().includes('confluence') && s.status === 'connected'
          );

          if (!confluenceServer) {
            return { ...baseResult, error: 'Confluence nicht verbunden', source: 'Confluence' };
          }

          // Execute read page tool
          const result = await mcpManager.callTool(
            confluenceServer.id,
            'confluence_read_page',
            { page_id: pageId }
          );

          return {
            ...baseResult,
            content: typeof result === 'string' ? result : JSON.stringify(result),
            source: 'Confluence',
          };
        } catch (error: any) {
          return { ...baseResult, error: error.message, source: 'Confluence' };
        }
      }

      case 'gdrive': {
        // Fetch from Google Drive - handles both text and binary files (PDF, DOCX, etc.)
        const fileId = item.metadata?.fileId || item.id;
        const mimeType = item.metadata?.mimeType || '';

        console.log(`[documentFetcher] Processing Google Drive file: ${item.title}`);
        console.log(`[documentFetcher]   fileId: ${fileId}`);
        console.log(`[documentFetcher]   mimeType: ${mimeType || '(not provided)'}`);
        console.log(`[documentFetcher]   metadata:`, JSON.stringify(item.metadata));

        try {
          const { connectionRegistry } = await import('../connections/registry');

          if (!userId) {
            return { ...baseResult, error: 'User-Authentifizierung erforderlich', source: 'Google Drive' };
          }

          // Get tokens for the user
          const tokens = await connectionRegistry.getTokens(userId, 'google-drive');
          if (!tokens) {
            return { ...baseResult, error: 'Nicht mit Google Drive verbunden', source: 'Google Drive' };
          }

          const headers = {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          };

          // Check if this is a binary file that needs Markitdown conversion
          const binaryTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/msword', // .doc
            'application/vnd.ms-excel', // .xls
            'application/vnd.ms-powerpoint', // .ppt
          ];
          const isBinaryFile = binaryTypes.includes(mimeType);

          if (isBinaryFile) {
            // Download the binary file and convert via Markitdown API
            console.log(`[documentFetcher] Downloading binary file from Google Drive: ${mimeType}`);

            const downloadResponse = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
              { headers }
            );

            if (!downloadResponse.ok) {
              const errorText = await downloadResponse.text();
              throw new Error(`Download fehlgeschlagen: ${downloadResponse.status} - ${errorText}`);
            }

            const buffer = await downloadResponse.arrayBuffer();

            // Determine file extension
            const extMap: Record<string, string> = {
              'application/pdf': '.pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
              'application/msword': '.doc',
              'application/vnd.ms-excel': '.xls',
              'application/vnd.ms-powerpoint': '.ppt',
            };
            const extension = extMap[mimeType] || '';

            // Save to temp file for Markitdown API
            if (!existsSync(TEMP_DIR)) {
              await mkdir(TEMP_DIR, { recursive: true });
            }
            const tempFilename = `temp-${fileId}-${Date.now()}${extension}`;
            const tempFilePath = join(TEMP_DIR, tempFilename);
            await writeFile(tempFilePath, Buffer.from(buffer));

            try {
              // Convert via Markitdown API
              console.log(`[documentFetcher] Converting via Markitdown: ${tempFilename}`);
              const file = Bun.file(tempFilePath);
              const formData = new FormData();
              formData.append('document', file, tempFilename);

              const markitdownResponse = await fetch(MARKITDOWN_URL, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${MARKITDOWN_API_KEY}`,
                },
                body: formData,
              });

              if (!markitdownResponse.ok) {
                const errorText = await markitdownResponse.text();
                throw new Error(`Markitdown Konvertierung fehlgeschlagen: ${markitdownResponse.status} - ${errorText}`);
              }

              const markdownContent = await markitdownResponse.text();
              console.log(`[documentFetcher] Successfully converted, length: ${markdownContent.length}`);

              // Clean up temp file
              await rm(tempFilePath, { force: true });

              return {
                ...baseResult,
                content: markdownContent,
                source: 'Google Drive',
              };
            } catch (convError: any) {
              // Clean up temp file on error
              await rm(tempFilePath, { force: true }).catch(() => {});
              throw convError;
            }
          }

          // For text-based files, use the standard gdrive_read_file tool
          const { toolRegistry } = await import('../tools/registry');
          const tool = toolRegistry.get('gdrive_read_file');

          if (!tool) {
            return { ...baseResult, error: 'Google Drive Tool nicht verfügbar', source: 'Google Drive' };
          }

          const resultStr = await tool.execute(
            { file_id: fileId },
            { userId }
          );

          // Parse the JSON result
          let parsed: { content?: string; error?: string; file?: { name: string; type: string } };
          try {
            parsed = JSON.parse(resultStr);
          } catch {
            // If it's not JSON, assume it's the content directly
            return {
              ...baseResult,
              content: resultStr,
              source: 'Google Drive',
            };
          }

          if (parsed.error) {
            // The gdrive_read_file tool couldn't read it - try to download and convert
            if (parsed.file?.type) {
              console.log(`[documentFetcher] gdrive_read_file failed, attempting binary download for: ${parsed.file.type}`);

              // Download and try Markitdown conversion as fallback
              const downloadResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                { headers }
              );

              if (downloadResponse.ok) {
                const buffer = await downloadResponse.arrayBuffer();

                // Save to temp file
                if (!existsSync(TEMP_DIR)) {
                  await mkdir(TEMP_DIR, { recursive: true });
                }
                const tempFilename = `temp-${fileId}-${Date.now()}`;
                const tempFilePath = join(TEMP_DIR, tempFilename);
                await writeFile(tempFilePath, Buffer.from(buffer));

                try {
                  const file = Bun.file(tempFilePath);
                  const formData = new FormData();
                  formData.append('document', file, parsed.file?.name || tempFilename);

                  const markitdownResponse = await fetch(MARKITDOWN_URL, {
                    method: 'PUT',
                    headers: {
                      Authorization: `Bearer ${MARKITDOWN_API_KEY}`,
                    },
                    body: formData,
                  });

                  if (markitdownResponse.ok) {
                    const markdownContent = await markitdownResponse.text();
                    await rm(tempFilePath, { force: true });
                    return {
                      ...baseResult,
                      content: markdownContent,
                      source: 'Google Drive',
                    };
                  }
                } catch {
                  // Fallback conversion failed
                }
                await rm(tempFilePath, { force: true }).catch(() => {});
              }
            }

            return { ...baseResult, error: parsed.error, source: 'Google Drive' };
          }

          if (!parsed.content) {
            return { ...baseResult, error: 'Kein Inhalt von Google Drive erhalten', source: 'Google Drive' };
          }

          return {
            ...baseResult,
            content: parsed.content,
            source: 'Google Drive',
          };
        } catch (error: any) {
          console.error('[documentFetcher] gdrive error:', error);
          return { ...baseResult, error: error.message, source: 'Google Drive' };
        }
      }

      case 'contract': {
        // Read contract document from vertragsmanagement storage
        const contractId = item.id;
        const contractDocPath = resolve(process.cwd(), `data/apps/vertragsmanagement/contracts/${contractId}/document.md`);

        if (!existsSync(contractDocPath)) {
          return { ...baseResult, error: 'Vertragsdokument nicht gefunden', source: 'Vertragsmanagement' };
        }

        const content = await readFile(contractDocPath, 'utf-8');
        return {
          ...baseResult,
          content,
          source: 'Vertragsmanagement',
        };
      }

      default:
        return { ...baseResult, error: `Unbekannter Dokumenttyp: ${item.type}`, source: 'Unbekannt' };
    }
  } catch (error: any) {
    return { ...baseResult, error: error.message, source: item.type };
  }
}

/**
 * Fetch contents from multiple document sources in parallel
 */
export async function fetchAllDocuments(
  items: ReaderItem[],
  userId?: string
): Promise<DocumentContext[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const results = await Promise.all(
    items.map((item) => fetchDocumentContent(item, userId))
  );

  return results;
}

// ============================================
// Reader Context Cache
// ============================================

interface CachedReaderContext {
  documents: DocumentContext[];
  preparedAt: number;
  readers: ReaderItem[];
}

// In-memory cache for prepared reader contexts (sessionId -> context)
const readerContextCache = new Map<string, CachedReaderContext>();

// Cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Prepare and cache reader contexts for a session
 * This is called when the user starts a chat with selected documents
 */
export async function prepareReaderContexts(
  sessionId: string,
  items: ReaderItem[],
  userId?: string
): Promise<{ documents: DocumentContext[]; cached: boolean }> {
  if (!items || items.length === 0) {
    return { documents: [], cached: false };
  }

  console.log(`[ReaderCache] Preparing ${items.length} documents for session ${sessionId}`);

  // Fetch all documents
  const documents = await fetchAllDocuments(items, userId);

  // Cache the results
  readerContextCache.set(sessionId, {
    documents,
    preparedAt: Date.now(),
    readers: items,
  });

  const successCount = documents.filter(d => !d.error).length;
  console.log(`[ReaderCache] Cached ${successCount}/${items.length} documents for session ${sessionId}`);

  return { documents, cached: true };
}

/**
 * Get cached reader contexts for a session
 */
export function getCachedReaderContexts(sessionId: string): DocumentContext[] | null {
  const cached = readerContextCache.get(sessionId);

  if (!cached) {
    return null;
  }

  // Check if cache is expired
  if (Date.now() - cached.preparedAt > CACHE_EXPIRY_MS) {
    console.log(`[ReaderCache] Cache expired for session ${sessionId}`);
    readerContextCache.delete(sessionId);
    return null;
  }

  console.log(`[ReaderCache] Using cached documents for session ${sessionId}`);
  return cached.documents;
}

/**
 * Clear cached reader contexts for a session
 */
export function clearCachedReaderContexts(sessionId: string): void {
  if (readerContextCache.has(sessionId)) {
    readerContextCache.delete(sessionId);
    console.log(`[ReaderCache] Cleared cache for session ${sessionId}`);
  }
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCaches(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, cached] of readerContextCache.entries()) {
    if (now - cached.preparedAt > CACHE_EXPIRY_MS) {
      readerContextCache.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[ReaderCache] Cleaned up ${cleanedCount} expired cache entries`);
  }

  return cleanedCount;
}

/**
 * Build context section for system prompt from loaded documents
 */
export function buildReaderContextSection(documents: DocumentContext[]): string {
  if (!documents || documents.length === 0) {
    return '';
  }

  const MAX_CONTENT_LENGTH = 15000;

  const sections = documents.map((doc, i) => {
    if (doc.error) {
      return `
### ${i + 1}. ${doc.title} (Quelle: ${doc.source}) - FEHLER

Konnte nicht geladen werden: ${doc.error}
`;
    }

    const truncatedContent = doc.content.length > MAX_CONTENT_LENGTH
      ? doc.content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... gekürzt ...]'
      : doc.content;

    return `
### ${i + 1}. ${doc.title} (Quelle: ${doc.source})

${truncatedContent}
`;
  });

  return `

## WICHTIG: Geladene Kontext-Dokumente

Der Benutzer hat explizit folgende Dokumente als Kontext für diesen Chat geladen:

${sections.join('\n')}

---

### PRIORISIERUNG FÜR FRAGEN:

1. **ZUERST** die oben geladenen Dokumente durchsuchen
2. Wenn die Antwort in den Dokumenten gefunden wird: **DIREKT antworten** (nicht an andere Agenten delegieren!)
3. Zitiere relevante Passagen aus den Dokumenten
4. **NUR** wenn die Information definitiv NICHT in den geladenen Dokumenten ist:
   - Sage klar: "Diese Information ist nicht in den geladenen Dokumenten enthalten."
   - Biete an, in anderen Quellen zu suchen

**NICHT** an \`knowledge\` delegieren für Fragen, die die geladenen Dokumente betreffen!
Die Dokumente sind bereits hier im Kontext - du hast direkten Zugriff.
`;
}
