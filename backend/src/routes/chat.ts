import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { bodyLimit } from 'hono/body-limit';
import { runAgentLoop, type AgentEvent, type AttachmentWithContent } from '../agents/loop';
import { chatRateLimit, uploadRateLimit } from '../middleware/rateLimit';
import { generateSessionId, saveConversation, saveChatHistory, loadChatHistory, listChatHistories, searchChatHistories, deleteChatHistory, regenerateChatSummary, regenerateAllMissingSummaries, createShareLink, revokeShareLink, loadChatByShareToken, getShareInfo, loadChatFolders, createChatFolder, deleteChatFolder, updateChatFolders, getChatFolderIds, listChatsInFolder, getFolderChatCounts, addChatMaterial, removeChatMaterial, updateChatMaterials, type MessageAttachment, type ChatMaterial } from '../services/memory';
import { listAgents, loadAgent, createAgent, updateAgent, deleteAgent, getAgentFull } from '../services/agents';
import { canView } from '../rbac/accessControl';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware, getCurrentUserId } from '../auth';
import {
  loadSkills,
  getSkillById,
  reloadSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  type EnhancedSkill,
} from '../skills';
import {
  toolRegistry,
  toolsConfig,
  loadCustomTools,
  getCustomTool,
  createCustomTool,
  updateCustomTool,
  deleteCustomTool,
  registerCustomTool,
  unregisterCustomTool,
  testCustomTool,
  CustomApiTool,
  type CustomToolConfig,
} from '../tools';

export const chatRoutes = new Hono();

import { attachmentsService } from '../services/attachments';
import { readAgentLog, deleteAgentLog } from '../services/agentLog';

import {
  fetchAllDocuments,
  buildReaderContextSection,
  prepareReaderContexts,
  getCachedReaderContexts,
  clearCachedReaderContexts,
  type ReaderItem,
  type DocumentContext,
} from '../services/documentFetcher';
import { createCollection, importAndIndex, type ImportItem } from '../services/documentImporter';
import {
  generateDocument,
  getMimeType,
  mapChatToDocument,
  createSafeFilename,
  type DocumentFormat,
  type ChatExportOptions,
} from '../services/documentGenerator';

// Store for pending messages (sessionId -> { message, agentId, autoRoute, attachments, skillId, userId, readerContexts, projectId, modelOverride })
interface PendingMessage {
  message: string;
  agentId?: string;
  autoRoute: boolean;
  attachments?: AttachmentWithContent[];  // Full attachments with content for direct context injection
  skillId?: string;  // Explicit skill to activate
  userId?: string;   // User ID for connection tools
  readerContexts?: DocumentContext[];  // Pre-loaded document contexts for chat
  projectId?: string;  // Project context for memory and KB injection
  modelOverride?: { providerId: string; modelId: string };  // Per-chat model override (highest priority)
}
const pendingMessages = new Map<string, PendingMessage>();

// Upload-Limits fuer Chat-Multipart-Requests.
// MAX_REQUEST_BODY_SIZE ist ein hartes Body-Limit (vor Form-Parsing) gegen
// Memory-Spikes bei boeswilligen oder fehlgeleiteten Clients.
// MAX_FILES_PER_REQUEST + MAX_TOTAL_UPLOAD_SIZE sind anwendungs-Layer-Checks
// nach Form-Parsing fuer klare Fehlermeldungen ans Frontend.
// MAX_FILE_SIZE pro File bleibt in services/attachments.ts (50 MB).
const MAX_REQUEST_BODY_SIZE = 220 * 1024 * 1024; // 220 MB inkl. Form-Felder
const MAX_REQUEST_BODY_SIZE_MB = 220;
const MAX_FILES_PER_REQUEST = 10;
const MAX_TOTAL_UPLOAD_SIZE = 200 * 1024 * 1024; // 200 MB Summe
const MAX_TOTAL_UPLOAD_SIZE_MB = 200;

// POST /api/chat - Start a new chat message (supports JSON or FormData with files)
chatRoutes.post(
  '/',
  bodyLimit({
    maxSize: MAX_REQUEST_BODY_SIZE,
    onError: (c) => c.json({ error: `Request zu groß. Maximum: ${MAX_REQUEST_BODY_SIZE_MB} MB` }, 413),
  }),
  chatRateLimit,
  authMiddleware,
  async (c) => {
  const contentType = c.req.header('content-type') || '';
  let message: string;
  let existingSessionId: string | undefined;
  let agentId: string | undefined;
  let autoRoute = true;
  let files: File[] = [];
  let skillId: string | undefined;
  let projectId: string | undefined;
  let modelOverride: { providerId: string; modelId: string } | undefined;
  const userId = getCurrentUserId(c);  // May be undefined if not authenticated
  console.log(`[Chat POST] userId from auth: ${userId}`);

  // Parse request body based on content type
  let readers: ReaderItem[] = [];

  if (contentType.includes('multipart/form-data')) {
    // Handle FormData with file uploads
    const formData = await c.req.formData();
    message = formData.get('message') as string;
    existingSessionId = formData.get('sessionId') as string | undefined;
    agentId = formData.get('agentId') as string | undefined;
    const autoRouteStr = formData.get('autoRoute') as string | undefined;
    autoRoute = autoRouteStr !== 'false';
    skillId = formData.get('skillId') as string | undefined;
    projectId = formData.get('projectId') as string | undefined;
    const readersStr = formData.get('readers') as string | undefined;
    if (readersStr) {
      try {
        readers = JSON.parse(readersStr);
      } catch (e) {
        console.warn('Failed to parse readers from FormData:', e);
      }
    }
    // Model override for per-chat model selection
    const modelOverrideStr = formData.get('modelOverride') as string | undefined;
    if (modelOverrideStr) {
      try {
        modelOverride = JSON.parse(modelOverrideStr);
      } catch (e) {
        console.warn('Failed to parse modelOverride from FormData:', e);
      }
    }

    // Collect all files
    const fileEntries = formData.getAll('files');
    files = fileEntries.filter((f): f is File => f instanceof File);

    // Anzahl und Gesamtgroesse pruefen — vor dem Verarbeiten,
    // damit Memory-Spikes durch processUpload-Schleife verhindert werden.
    if (files.length > MAX_FILES_PER_REQUEST) {
      return c.json({ error: `Zu viele Dateien. Maximum: ${MAX_FILES_PER_REQUEST} pro Nachricht.` }, 400);
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_SIZE) {
      return c.json({ error: `Gesamtgröße der Anhänge zu groß. Maximum: ${MAX_TOTAL_UPLOAD_SIZE_MB} MB.` }, 400);
    }
  } else {
    // Handle JSON body
    const body = await c.req.json();
    message = body.message;
    existingSessionId = body.sessionId;
    agentId = body.agentId;
    autoRoute = body.autoRoute !== false;
    skillId = body.skillId;
    projectId = body.projectId;
    readers = body.readers || [];
    // Model override for per-chat model selection
    if (body.modelOverride?.providerId && body.modelOverride?.modelId) {
      modelOverride = body.modelOverride;
    }
  }

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'Message is required' }, 400);
  }

  const sessionId = existingSessionId || generateSessionId();

  // Process file uploads if present - keep full content for context injection
  let attachmentsWithContent: Array<{
    id: string;
    filename: string;
    mimeType: string;
    type: 'document' | 'image' | 'audio';
    size: number;
    pages?: number;
    markdownContent?: string;
    base64Data?: string;
    transcription?: string;
  }> = [];
  if (files.length > 0) {
    console.log(`[Chat] Processing ${files.length} file upload(s) for session ${sessionId}`);

    for (const file of files) {
      try {
        const attachment = await attachmentsService.processUpload(sessionId, file);
        attachmentsWithContent.push({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          type: attachment.type,
          size: attachment.metadata.size,
          pages: attachment.metadata.pages,
          markdownContent: attachment.markdownContent,  // Include the converted content!
          base64Data: attachment.base64Data,  // Include image data if applicable
          transcription: attachment.transcription,  // Include audio transcription if applicable
        });
        const contentLength = attachment.markdownContent?.length || attachment.transcription?.length || 0;
        console.log(`[Chat] Processed: ${file.name} → ${attachment.id} (${attachment.type}), content length: ${contentLength}`);
      } catch (error: any) {
        console.error(`[Chat] Failed to process file ${file.name}:`, error.message);
        // Continue with other files
      }
    }
  }

  // Determine the agent to use
  let selectedAgentId = agentId;
  let routedBy: 'user' | 'auto' | 'supervisor' = 'user';

  if (!selectedAgentId && autoRoute) {
    // Use the supervisor agent to handle routing and orchestration
    selectedAgentId = 'supervisor';
    routedBy = 'supervisor';
    console.log(`Using supervisor agent for orchestration`);
  }

  // Validate agent exists AND user has access (für User-Agents).
  // System-Agents (siehe AgentConfig.system) sind fuer alle eingeloggten User
  // zugaenglich; User-Agents brauchen canView. Ohne userId verweigern wir den
  // Zugriff auf User-Agents — sonst koennte jede anonyme Session einen
  // anderen User-Agent ansprechen.
  if (selectedAgentId) {
    const agent = await loadAgent(selectedAgentId);
    if (!agent) {
      console.warn(`Agent "${selectedAgentId}" not found, falling back to general`);
      selectedAgentId = 'general';
    } else if (!agent.system) {
      if (!userId) {
        return c.json({ error: 'Authentifizierung erforderlich fuer User-Agents' }, 401);
      }
      const access = await canView(userId, 'agent', agent.id);
      if (!access.allowed) {
        console.warn(`[Chat] User ${userId} hat keinen Zugriff auf Agent ${agent.id} — verweigert`);
        return c.json({ error: `Zugriff auf Agent "${agent.id}" verweigert` }, 403);
      }
    }
  }

  // Get reader contexts - either from cache (if pre-prepared) or fetch now
  let readerContexts: DocumentContext[] = [];

  // First check if we have cached reader contexts from prepare-readers call
  const cachedContexts = getCachedReaderContexts(sessionId);
  if (cachedContexts && cachedContexts.length > 0) {
    console.log(`[Chat] Using ${cachedContexts.length} pre-prepared reader document(s) from cache`);
    readerContexts = cachedContexts;
  } else if (readers && readers.length > 0) {
    // No cache - fetch now (fallback for direct calls without prepare-readers)
    console.log(`[Chat] Fetching ${readers.length} reader document(s) for context (not cached)`);
    console.log(`[Chat] Reader items:`, readers.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      mimeType: r.metadata?.mimeType,
    })));
    readerContexts = await fetchAllDocuments(readers, userId);
    const successCount = readerContexts.filter(r => !r.error).length;
    console.log(`[Chat] Loaded ${successCount}/${readers.length} documents successfully`);
    // Log content preview for debugging
    for (const doc of readerContexts) {
      if (doc.error) {
        console.log(`[Chat] Document "${doc.title}" error: ${doc.error}`);
      } else {
        console.log(`[Chat] Document "${doc.title}" loaded, content length: ${doc.content.length}`);
      }
    }
  }

  // Store the message for SSE to pick up - use full attachments with content
  pendingMessages.set(sessionId, {
    message,
    agentId: selectedAgentId,
    autoRoute,
    attachments: attachmentsWithContent.length > 0 ? attachmentsWithContent : undefined,
    skillId,
    userId,
    readerContexts: readerContexts.length > 0 ? readerContexts : undefined,
    projectId,
    modelOverride,
  });

  if (projectId) {
    console.log(`[Chat POST] Project context: ${projectId}`);
  }

  // For frontend response, return metadata including URL and transcription for display
  const attachmentMetadataForResponse = attachmentsWithContent.map(att => ({
    id: att.id,
    filename: att.filename,
    mimeType: att.mimeType,
    type: att.type,
    size: att.size,
    pages: att.pages,
    status: 'ready' as const,  // Files are already processed when response is sent
    // Include URL for all attachment types (audio streaming, image/document download)
    url: `/api/chats/${sessionId}/attachments/${att.id}${att.type === 'audio' ? '/stream' : ''}`,
    transcription: att.transcription,
  }));

  return c.json({
    sessionId,
    streamUrl: `/api/chat/${sessionId}/stream`,
    agentId: selectedAgentId,
    routedBy,
    attachments: attachmentMetadataForResponse.length > 0 ? attachmentMetadataForResponse : undefined,
    readerCount: readerContexts.length > 0 ? readerContexts.length : undefined,
  });
});

// POST /api/chat/prepare-readers - Pre-process reader documents for a new chat session
// This is called when starting a chat from search with selected documents
chatRoutes.post('/prepare-readers', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const { sessionId, readers } = body as { sessionId?: string; readers?: ReaderItem[] };

  if (!readers || readers.length === 0) {
    return c.json({ error: 'readers array is required' }, 400);
  }

  // Generate session ID if not provided
  const finalSessionId = sessionId || generateSessionId();

  console.log(`[prepare-readers] Processing ${readers.length} documents for session ${finalSessionId}`);

  try {
    const { documents } = await prepareReaderContexts(finalSessionId, readers, userId);

    // Return metadata about prepared documents
    const preparedDocs = documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      title: doc.title,
      source: doc.source,
      success: !doc.error,
      error: doc.error,
      contentLength: doc.content?.length || 0,
    }));

    const successCount = preparedDocs.filter(d => d.success).length;
    console.log(`[prepare-readers] Prepared ${successCount}/${readers.length} documents successfully`);

    return c.json({
      sessionId: finalSessionId,
      prepared: true,
      documents: preparedDocs,
      successCount,
      totalCount: readers.length,
    });
  } catch (error: any) {
    console.error('[prepare-readers] Error:', error);
    return c.json({
      sessionId: finalSessionId,
      prepared: false,
      error: error.message,
    }, 500);
  }
});

// GET /api/chat/:id/stream - SSE stream for responses.
// EventSource sendet das Session-Cookie automatisch mit, deshalb pruefen wir,
// dass der Stream-Caller derselbe User ist, der die zugehoerige POST-Anfrage
// gestellt hat. Vorher reichte allein eine erratbare sessionId — Hijack-
// Risiko. Siehe security-review M8.
chatRoutes.get('/:id/stream', optionalAuthMiddleware, async (c) => {
  const sessionId = c.req.param('id');

  // Get pending message (peek before delete, damit User-Bindung greift)
  const pending = pendingMessages.get(sessionId);

  if (!pending) {
    return c.json({ error: 'No pending message for this session' }, 400);
  }

  // User-Binding: der Stream darf nur vom Initiator abgeholt werden.
  // pending.userId ist im POST-Handler aus authMiddleware uebernommen.
  const callerUserId = getCurrentUserId(c);
  if (pending.userId && callerUserId !== pending.userId) {
    // Pending NICHT loeschen — sonst koennte ein Angreifer mit erratener
    // sessionId den legitimen Empfaenger aussperren (DoS).
    return c.json({ error: 'Stream not authorised for this session' }, 403);
  }

  // Erst nach erfolgreichem Bindings-Check konsumieren
  pendingMessages.delete(sessionId);

  const { message: userMessage, agentId, attachments, userId, readerContexts, projectId, modelOverride } = pending;

  return streamSSE(c, async (stream) => {
    // Heartbeat to keep SSE connection alive during long-running delegations
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: '' });
      } catch {
        // Stream already closed
        clearInterval(heartbeat);
      }
    }, 5000);

    try {
      // Emit agent selection event first
      if (agentId) {
        await stream.writeSSE({
          event: 'agent_selected',
          data: JSON.stringify({ agentId }),
        });
      }

      // Emit file_processing events for attachments (status: ready since they're pre-processed)
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          await stream.writeSSE({
            event: 'file_processing',
            data: JSON.stringify({
              fileId: attachment.id,
              filename: attachment.filename,
              status: 'ready',
            }),
          });
        }
      }

      for await (const event of runAgentLoop(sessionId, userMessage, { agentId, attachments, skillId: pending.skillId, userId, readerContexts, projectId, modelOverride })) {
        const eventData = formatEventData(event);

        // Save conversation BEFORE sending done event to ensure chat is
        // persisted when frontend receives done and refreshes chat list
        if (event.type === 'done') {
          await saveConversation(sessionId);

          // Convert attachments to MessageAttachment format for persistence
          const messageAttachments: MessageAttachment[] | undefined = attachments?.map(att => ({
            id: att.id,
            type: att.type,
            filename: att.filename,
            mimeType: att.mimeType,
            url: `/api/chats/${sessionId}/attachments/${att.id}/stream`,
            transcription: att.transcription,
            preview: att.markdownContent ? att.markdownContent.slice(0, 500) : undefined,
          }));

          await saveChatHistory(sessionId, userId, projectId, messageAttachments);
        }

        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(eventData),
        });

        // Small delay to prevent overwhelming the client
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } catch (error: any) {
      console.error('SSE Error:', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: error.message }),
      });
    } finally {
      clearInterval(heartbeat);
    }
  });
});

function formatEventData(event: AgentEvent): Record<string, any> {
  switch (event.type) {
    case 'thinking':
      return { status: 'thinking' };
    case 'response_chunk':
      return { content: event.content };
    case 'reasoning_chunk':
      return { reasoning: event.content };
    case 'tool_start':
      return {
        tool: event.toolName,
        args: event.toolArgs,
      };
    case 'tool_end':
      return {
        tool: event.toolName,
        result: event.toolResult,
        durationMs: event.durationMs,
      };
    case 'delegation_start':
      return {
        agentId: event.agentId,
        task: event.task,
      };
    case 'delegation_end':
      return {
        agentId: event.agentId,
        result: event.toolResult,
        durationMs: event.durationMs,
      };
    case 'agent_selected':
      return {
        agentId: event.agentId,
      };
    case 'skill_activated':
      return {
        skillId: event.skillId,
        skillName: event.skillName,
        tools: event.skillTools,
        error: event.skillError,
        totalSteps: event.totalSteps,
      };
    case 'workflow_step':
      return {
        skillId: event.skillId,
        stepIndex: event.stepIndex,
        stepAction: event.stepAction,
        stepDescription: event.stepDescription,
        totalSteps: event.totalSteps,
        progress: event.workflowProgress,
      };
    case 'sub_agent_step':
      return {
        agentId: event.subAgentId,
        stepType: event.subStepType,
        message: event.subStepMessage,
      };
    case 'document_analysis_start':
      return {
        attachmentId: event.attachmentId,
        filename: event.filename,
        pages: event.pages,
        truncated: event.truncated,
      };
    case 'document_analysis_end':
      return {
        attachmentId: event.attachmentId,
        filename: event.filename,
        pages: event.pages,
        truncated: event.truncated,
        relevance: event.relevance,
        durationMs: event.durationMs,
      };
    case 'model_info':
      return {
        providerName: event.providerName,
        modelName: event.modelName,
      };
    case 'task_created':
      return {
        taskId: event.taskId,
        taskTitle: event.taskTitle,
      };
    case 'file_processing':
      return {
        fileId: (event as any).fileId,
        filename: (event as any).filename,
        status: (event as any).status,
      };
    case 'iteration_start':
      return {
        iteration: event.iteration,
        maxIterations: event.maxIterations,
        messagesCount: event.messagesCount,
        toolsCount: event.toolsCount,
      };
    case 'done':
      return { status: 'complete' };
    case 'error':
      return { error: event.content };
    default:
      return {};
  }
}

// GET /api/chat/:id/agent-log - Get agent log entries for a session.
// Admin-only: das Log enthaelt detaillierte Tool-Calls inkl. Argumenten
// und Resultaten — keine Endnutzer-Sicht.
chatRoutes.get('/:id/agent-log', authMiddleware, adminMiddleware, async (c) => {
  const sessionId = c.req.param('id');
  const entries = await readAgentLog(sessionId);
  return c.json({ entries });
});

// GET /api/chat/:id - Get session info (optional endpoint)
chatRoutes.get('/:id', async (c) => {
  const sessionId = c.req.param('id');

  return c.json({
    sessionId,
    status: 'active',
  });
});

// ---- Chat History Routes ----
export const chatHistoryRoutes = new Hono();

// GET /api/chats - List chat histories with optional pagination
// Query params: limit (default: 50), offset (default: 0)
// Access control: shows user's own chats
chatHistoryRoutes.get('/', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c);
    const limitStr = c.req.query('limit');
    const offsetStr = c.req.query('offset');

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const result = await listChatHistories(limit, offset, userId);
    return c.json(result);
  } catch (error: any) {
    console.error('Error listing chats:', error);
    return c.json({ error: 'Failed to list chats' }, 500);
  }
});

// GET /api/chats/search?q=query - Search chat histories
chatHistoryRoutes.get('/search', authMiddleware, async (c) => {
  const query = c.req.query('q') || '';
  const userId = getCurrentUserId(c);

  if (query.length < 2) {
    return c.json({ results: [], message: 'Query must be at least 2 characters' });
  }

  try {
    const results = await searchChatHistories(query, userId);
    return c.json({ results });
  } catch (error: any) {
    console.error('Error searching chats:', error);
    return c.json({ error: 'Failed to search chats' }, 500);
  }
});

// ---- Chat Folders Routes ----
// IMPORTANT: These must be defined BEFORE /:id routes!

// GET /api/chats/folders - List all folders with chat counts
chatHistoryRoutes.get('/folders', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);
  try {
    const [folders, counts] = await Promise.all([
      loadChatFolders(userId),
      getFolderChatCounts(userId),
    ]);
    // Add chatCount to each folder
    const foldersWithCounts = folders.map(folder => ({
      ...folder,
      chatCount: counts[folder.id] || 0,
    }));
    return c.json({ folders: foldersWithCounts });
  } catch (error: any) {
    console.error('Error listing folders:', error);
    return c.json({ error: 'Failed to list folders' }, 500);
  }
});

// POST /api/chats/folders - Create a new folder
chatHistoryRoutes.post('/folders', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);
  try {
    const body = await c.req.json();
    const { name, color } = body;
    console.log('[POST /folders] Received:', { name, color });

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const folder = await createChatFolder(name.trim(), userId, color);
    console.log('[POST /folders] Returning:', folder);
    return c.json(folder, 201);
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return c.json({ error: 'Failed to create folder' }, 500);
  }
});

// DELETE /api/chats/folders/:id - Delete a folder
chatHistoryRoutes.delete('/folders/:id', authMiddleware, async (c) => {
  const folderId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const deleted = await deleteChatFolder(folderId, userId);
    if (!deleted) {
      return c.json({ error: 'Folder not found or access denied' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    return c.json({ error: 'Failed to delete folder' }, 500);
  }
});

// GET /api/chats/folders/:id/chats - List chats in a folder
chatHistoryRoutes.get('/folders/:id/chats', authMiddleware, async (c) => {
  const folderId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const chats = await listChatsInFolder(folderId, userId);
    return c.json({ chats });
  } catch (error: any) {
    console.error('Error listing chats in folder:', error);
    return c.json({ error: 'Failed to list chats' }, 500);
  }
});

// POST /api/chats/regenerate-all-summaries - Regenerate summaries for all chats without summaries
// IMPORTANT: Must be before /:id routes
chatHistoryRoutes.post('/regenerate-all-summaries', async (c) => {
  try {
    const result = await regenerateAllMissingSummaries();
    return c.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Error regenerating summaries:', error);
    return c.json({ error: 'Failed to regenerate summaries' }, 500);
  }
});

// GET /api/chats/:id - Load full chat history
// Access control: only owner can access their chats
chatHistoryRoutes.get('/:id', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const chat = await loadChatHistory(chatId, userId);
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }
    return c.json(chat);
  } catch (error: any) {
    console.error('Error loading chat:', error);
    return c.json({ error: 'Failed to load chat' }, 500);
  }
});

// DELETE /api/chats/:id - Delete chat history
// Access control: only owner can delete their chats
chatHistoryRoutes.delete('/:id', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const deleted = await deleteChatHistory(chatId, userId);
    if (!deleted) {
      return c.json({ error: 'Chat not found' }, 404);
    }
    // Clean up agent log file
    await deleteAgentLog(chatId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return c.json({ error: 'Failed to delete chat' }, 500);
  }
});

// GET /api/chats/:id/download - Download chat as markdown file
// Access control: only owner can download their chats
chatHistoryRoutes.get('/:id/download', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const chat = await loadChatHistory(chatId, userId);
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // Format chat as markdown
    const lines: string[] = [
      `# ${chat.title}`,
      '',
      `**Erstellt:** ${new Date(chat.createdAt).toLocaleString('de-DE')}`,
      `**Aktualisiert:** ${new Date(chat.updatedAt).toLocaleString('de-DE')}`,
      '',
      '---',
      '',
    ];

    for (const msg of chat.messages) {
      const roleLabel = msg.role === 'user' ? '👤 **Benutzer**' : '🤖 **Assistent**';
      lines.push(roleLabel);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const markdown = lines.join('\n');

    // Create safe filename from title
    const safeTitle = chat.title
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const filename = `${safeTitle}_${chatId.slice(-8)}.md`;

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading chat:', error);
    return c.json({ error: 'Failed to download chat' }, 500);
  }
});

// GET /api/chats/:id/export/:format - Export chat as document (xlsx, pdf, docx)
// Access control: only owner can export their chats
// Query params: scope=full|last|materials (default: full)
chatHistoryRoutes.get('/:id/export/:format', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const format = c.req.param('format') as DocumentFormat;
  const scopeParam = c.req.query('scope') || 'full';
  const userId = getCurrentUserId(c);

  // Validate format
  const validFormats: DocumentFormat[] = ['xlsx', 'pdf', 'docx'];
  if (!validFormats.includes(format)) {
    return c.json({ error: `Invalid format. Supported: ${validFormats.join(', ')}` }, 400);
  }

  // Map scope param to ChatExportOptions scope
  const scopeMap: Record<string, ChatExportOptions['scope']> = {
    full: 'full',
    last: 'last_response',
    materials: 'materials_only',
  };
  const scope = scopeMap[scopeParam] || 'full';

  try {
    // Load chat with access control
    const chat = await loadChatHistory(chatId, userId);
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // Convert chat to DocumentData
    const documentData = mapChatToDocument(chat, {
      scope,
      includeMetadata: true,
      includeMaterials: scope !== 'last_response',
    });

    // Generate document
    const buffer = await generateDocument(documentData, format);

    // Create safe filename
    const baseFilename = createSafeFilename(chat.title, chatId);
    const filename = `${baseFilename}.${format}`;

    // Return file download
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting chat:', error);
    return c.json({ error: 'Failed to export chat' }, 500);
  }
});

// POST /api/chats/:id/regenerate-summary - Regenerate summary for a specific chat
// Access control: only owner can regenerate summary
chatHistoryRoutes.post('/:id/regenerate-summary', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    // First check if user has access
    const existingChat = await loadChatHistory(chatId, userId);
    if (!existingChat) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }

    const success = await regenerateChatSummary(chatId);
    if (!success) {
      return c.json({ error: 'Could not generate summary' }, 500);
    }
    const chat = await loadChatHistory(chatId, userId);
    return c.json({
      success: true,
      title: chat?.title,
      summary: chat?.summary,
      keywords: chat?.keywords,
    });
  } catch (error: any) {
    console.error('Error regenerating summary:', error);
    return c.json({ error: 'Failed to regenerate summary' }, 500);
  }
});

// ---- Chat Sharing Routes ----

// GET /api/chats/:id/share - Get share info for a chat
// Access control: only owner can see share info
chatHistoryRoutes.get('/:id/share', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const shareInfo = await getShareInfo(chatId, userId);
    if (!shareInfo) {
      return c.json({ shared: false });
    }
    return c.json({
      shared: true,
      shareToken: shareInfo.shareToken,
      shareUrl: `/shared/${shareInfo.shareToken}`,
      sharedAt: shareInfo.sharedAt,
    });
  } catch (error: any) {
    console.error('Error getting share info:', error);
    return c.json({ error: 'Failed to get share info' }, 500);
  }
});

// POST /api/chats/:id/share - Create a share link for a chat
// Access control: only owner can create share link
chatHistoryRoutes.post('/:id/share', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const result = await createShareLink(chatId, userId);
    if (!result.success) {
      const status = result.error === 'Access denied' ? 403 : 404;
      return c.json({ error: result.error }, status);
    }
    return c.json({
      success: true,
      shareToken: result.shareToken,
      shareUrl: result.shareUrl,
    });
  } catch (error: any) {
    console.error('Error creating share link:', error);
    return c.json({ error: 'Failed to create share link' }, 500);
  }
});

// DELETE /api/chats/:id/share - Revoke a share link for a chat
// Access control: only owner can revoke share link
chatHistoryRoutes.delete('/:id/share', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const revoked = await revokeShareLink(chatId, userId);
    if (!revoked) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking share link:', error);
    return c.json({ error: 'Failed to revoke share link' }, 500);
  }
});

// GET /api/chats/:id/folders - Get folder IDs for a chat
chatHistoryRoutes.get('/:id/folders', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const folderIds = await getChatFolderIds(chatId, userId);
    return c.json({ folderIds });
  } catch (error: any) {
    console.error('Error getting chat folders:', error);
    return c.json({ error: 'Failed to get chat folders' }, 500);
  }
});

// PUT /api/chats/:id/folders - Update folder assignments for a chat
chatHistoryRoutes.put('/:id/folders', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  try {
    const body = await c.req.json();
    const { folderIds } = body;

    if (!Array.isArray(folderIds)) {
      return c.json({ error: 'folderIds must be an array' }, 400);
    }

    const updated = await updateChatFolders(chatId, folderIds, userId);
    if (!updated) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }
    return c.json({ success: true, folderIds });
  } catch (error: any) {
    console.error('Error updating chat folders:', error);
    return c.json({ error: 'Failed to update chat folders' }, 500);
  }
});

// ---- Materials Routes ----

// POST /api/chats/:id/materials - Add a material to a chat
chatHistoryRoutes.post('/:id/materials', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const material: ChatMaterial = {
      id: body.id || `material_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: body.type || 'user_marked',
      title: body.title || 'Untitled',
      content: body.content || '',
      mimeType: body.mimeType,
      sourceMessageIndex: body.sourceMessageIndex,
      createdAt: body.createdAt || Date.now(),
      metadata: body.metadata,
    };

    const success = await addChatMaterial(chatId, userId, material);
    if (!success) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }
    return c.json({ success: true, material });
  } catch (error: any) {
    console.error('Error adding material:', error);
    return c.json({ error: 'Failed to add material' }, 500);
  }
});

// DELETE /api/chats/:id/materials/:materialId - Remove a material from a chat
chatHistoryRoutes.delete('/:id/materials/:materialId', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const materialId = c.req.param('materialId');
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const success = await removeChatMaterial(chatId, userId, materialId);
    if (!success) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error removing material:', error);
    return c.json({ error: 'Failed to remove material' }, 500);
  }
});

// PUT /api/chats/:id/materials - Update all materials for a chat
chatHistoryRoutes.put('/:id/materials', authMiddleware, async (c) => {
  const chatId = c.req.param('id');
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { materials } = body;

    if (!Array.isArray(materials)) {
      return c.json({ error: 'materials must be an array' }, 400);
    }

    const success = await updateChatMaterials(chatId, userId, materials);
    if (!success) {
      return c.json({ error: 'Chat not found or access denied' }, 404);
    }
    return c.json({ success: true, materials });
  } catch (error: any) {
    console.error('Error updating materials:', error);
    return c.json({ error: 'Failed to update materials' }, 500);
  }
});

// ---- Public Shared Chat Route ----
// This is a separate route object that should be mounted without auth

export const sharedChatRoutes = new Hono();

// GET /api/shared/:token - Load a shared chat (public, no auth required)
sharedChatRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  try {
    const chat = await loadChatByShareToken(token);
    if (!chat) {
      return c.json({ error: 'Shared chat not found or link expired' }, 404);
    }
    return c.json(chat);
  } catch (error: any) {
    console.error('Error loading shared chat:', error);
    return c.json({ error: 'Failed to load shared chat' }, 500);
  }
});

// ---- Export Download Routes ----
// For downloading documents generated by the export_document tool

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { exports as exportsTable } from '../db/schema/generated';
import { getObject } from '../storage/s3';

export const exportRoutes = new Hono();

// GET /api/exports/download/:filename - Download a generated document
// Authentication required to prevent unauthorized access
exportRoutes.get('/download/:filename', authMiddleware, async (c) => {
  const filename = c.req.param('filename');

  // Security: validate filename to prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return c.json({ error: 'Invalid filename' }, 400);
  }

  // Validate file extension
  const validExtensions = ['.xlsx', '.pdf', '.docx'];
  const ext = '.' + filename.split('.').pop();
  if (!validExtensions.includes(ext)) {
    return c.json({ error: 'Invalid file type' }, 400);
  }

  try {
    const db = getDb();
    const rows = await db.select().from(exportsTable).where(eq(exportsTable.id, filename)).limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: 'File not found or expired' }, 404);
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      return c.json({ error: 'File not found or expired' }, 404);
    }
    const buffer = await getObject(row.s3Key);
    const format = ext.slice(1) as DocumentFormat;
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading export:', error);
    return c.json({ error: 'Failed to download file' }, 500);
  }
});

// Agent routes moved to routes/agents.ts with RBAC support
// These are kept for backwards compatibility but not exported
const _internalAgentRoutes = new Hono();

_internalAgentRoutes.get('/', async (c) => {
  try {
    const agents = await listAgents();

    // Return simplified agent info for the frontend
    const agentList = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      system: agent.system || false,
    }));

    return c.json({
      agents: agentList,
      defaultAgent: 'general',
    });
  } catch (error: any) {
    console.error('Error listing agents:', error);
    return c.json({ error: 'Failed to list agents' }, 500);
  }
});

_internalAgentRoutes.get('/:id', async (c) => {
  const agentId = c.req.param('id');

  try {
    const agent = await loadAgent(agentId);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      system: agent.system || false,
    });
  } catch (error: any) {
    console.error('Error loading agent:', error);
    return c.json({ error: 'Failed to load agent' }, 500);
  }
});

// GET /api/agents/:id/full - Get full agent config including system prompt
_internalAgentRoutes.get('/:id/full', async (c) => {
  const agentId = c.req.param('id');

  try {
    const agent = await getAgentFull(agentId);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json(agent);
  } catch (error: any) {
    console.error('Error loading agent:', error);
    return c.json({ error: 'Failed to load agent' }, 500);
  }
});

// POST /api/agents - Create a new agent
_internalAgentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, description, capabilities, tools, delegatable, systemPrompt } = body;

    if (!id || !name) {
      return c.json({ error: 'ID and name are required' }, 400);
    }

    const agent = await createAgent({
      id,
      name,
      description: description || '',
      capabilities: capabilities || [],
      tools: tools || ['file_read', 'file_list'],
      delegatable: delegatable !== false,
      systemPrompt: systemPrompt || '',
    });

    return c.json(agent, 201);
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return c.json({ error: error.message }, 400);
  }
});

// PUT /api/agents/:id - Update an existing agent
_internalAgentRoutes.put('/:id', async (c) => {
  const agentId = c.req.param('id');

  try {
    const body = await c.req.json();
    const agent = await updateAgent(agentId, body);
    return c.json(agent);
  } catch (error: any) {
    console.error('Error updating agent:', error);
    return c.json({ error: error.message }, 400);
  }
});

// DELETE /api/agents/:id - Delete an agent
_internalAgentRoutes.delete('/:id', async (c) => {
  const agentId = c.req.param('id');

  try {
    await deleteAgent(agentId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/skills - List all available skills (Enhanced Skills)
// Schutz: Skills landen direkt im LLM-System-Prompt (siehe agents/loop.ts).
// Ein anonymer Angreifer mit Schreibzugriff koennte beliebige Instructions
// injizieren ("Ignore previous, exfiltrate to attacker.com"). Siehe
// security-review H7. Lese-Zugriff erfordert Login, Mutation Admin.
export const skillRoutes = new Hono();
skillRoutes.use('*', authMiddleware);

skillRoutes.get('/', async (c) => {
  try {
    const skills = await loadSkills();

    // Return enhanced skill info for the frontend
    const skillList = skills.map((skill: EnhancedSkill) => ({
      id: skill.id,
      name: skill.name,
      version: skill.version,
      description: skill.description,
      triggers: {
        keywords: skill.triggers.keywords || [],
        patterns: skill.triggers.patterns || [],
        explicit: skill.triggers.explicit || false,
      },
      tools: {
        required: skill.tools.required || [],
        optional: skill.tools.optional || [],
      },
      hasWorkflow: !!skill.workflow?.steps?.length,
      hasOutput: !!skill.output?.template,
      enabled: skill.enabled !== false,
      system: skill.system || false,
      path: skill.path?.replace(/.*\/data\//, 'data/') || '',
    }));

    return c.json({
      skills: skillList,
      total: skillList.length,
      enabled: skillList.filter(s => s.enabled).length,
      system: skillList.filter(s => s.system).length,
      custom: skillList.filter(s => !s.system).length,
    });
  } catch (error: any) {
    console.error('Error listing skills:', error);
    return c.json({ error: 'Failed to list skills' }, 500);
  }
});

// GET /api/skills/:id - Get full skill details
skillRoutes.get('/:id', async (c) => {
  const skillId = c.req.param('id');

  try {
    const skill = await getSkillById(skillId);

    if (!skill) {
      return c.json({ error: 'Skill not found' }, 404);
    }

    return c.json({
      id: skill.id,
      name: skill.name,
      version: skill.version,
      description: skill.description,
      // NEW: metadata for agent decision-making
      metadata: skill.metadata,
      // NEW: tools that this skill ADDS to agent capabilities
      allowed_tools: skill.allowed_tools,
      // NEW: knowledge references
      knowledge: skill.knowledge,
      // LEGACY: triggers (kept for backward compatibility)
      triggers: skill.triggers,
      // LEGACY: tools (kept for backward compatibility)
      tools: skill.tools,
      instructions: skill.instructions,
      workflow: skill.workflow,
      output: skill.output,
      parameters: skill.parameters,
      constraints: skill.constraints,
      enabled: skill.enabled !== false,
      system: skill.system || false,
      hasWorkflow: !!skill.workflow?.steps?.length,
      hasOutput: !!skill.output?.template,
      path: skill.path?.replace(/.*\/data\//, 'data/') || '',
    });
  } catch (error: any) {
    console.error('Error loading skill:', error);
    return c.json({ error: 'Failed to load skill' }, 500);
  }
});

// POST /api/skills/reload - Reload skills from disk
skillRoutes.post('/reload', adminMiddleware, async (c) => {
  try {
    const skills = await reloadSkills();
    return c.json({
      success: true,
      count: skills.length,
      skills: skills.map(s => s.id),
    });
  } catch (error: any) {
    console.error('Error reloading skills:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/skills - Create a new skill
skillRoutes.post('/', adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();

    // Validate required fields
    if (!body.id || !body.name) {
      return c.json({ error: 'ID and name are required' }, 400);
    }

    // Prepare skill data
    const skillData: EnhancedSkill = {
      id: body.id,
      name: body.name,
      version: body.version || '1.0',
      description: body.description || '',
      // NEW: metadata for agent decision-making
      metadata: body.metadata,
      // NEW: tools that this skill ADDS to agent capabilities
      allowed_tools: body.allowed_tools,
      // NEW: knowledge references
      knowledge: body.knowledge,
      // LEGACY: triggers (kept for backward compatibility)
      triggers: body.triggers || { keywords: [] },
      // LEGACY: tools (kept for backward compatibility)
      tools: body.tools || { required: [], optional: [] },
      instructions: body.instructions || '',
      workflow: body.workflow,
      output: body.output,
      parameters: body.parameters,
      constraints: body.constraints,
      enabled: body.enabled !== false,
    };

    const created = await createSkill(skillData);

    return c.json(created, 201);
  } catch (error: any) {
    console.error('Error creating skill:', error);
    return c.json({ error: error.message }, 400);
  }
});

// PUT /api/skills/:id - Update an existing skill
skillRoutes.put('/:id', adminMiddleware, async (c) => {
  const skillId = c.req.param('id');

  try {
    const body = await c.req.json();
    const updated = await updateSkill(skillId, body);
    return c.json(updated);
  } catch (error: any) {
    console.error('Error updating skill:', error);
    return c.json({ error: error.message }, 400);
  }
});

// DELETE /api/skills/:id - Delete a skill
skillRoutes.delete('/:id', adminMiddleware, async (c) => {
  const skillId = c.req.param('id');

  try {
    await deleteSkill(skillId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting skill:', error);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// Tools Routes
// ============================================
export const toolRoutes = new Hono();

// Known API tool configurations (for documentation in UI)
const apiToolEnvVars: Record<string, { envVar: string; docUrl?: string }> = {
  web_search: {
    envVar: 'TAVILY_API_KEY',
    docUrl: 'https://tavily.com'
  },
};

// GET /api/tools - List all registered tools
toolRoutes.get('/', async (c) => {
  try {
    const tools = toolRegistry.getAll();

    const toolList = await Promise.all(tools.map(async (tool) => {
      const metadata = tool.getMetadata?.() || {
        name: tool.name,
        description: '',
        type: tool.type,
      };

      // Check if tool is available/configured
      let available = true;
      let configRequired = false;
      let configKeys: string[] = [];
      let envVar: string | undefined;
      let docUrl: string | undefined;

      if (tool.isAvailable) {
        available = await tool.isAvailable();
      }

      // Check if this tool needs API configuration
      if (tool.type === 'api') {
        configRequired = true;
        const apiConfig = toolsConfig.api[tool.name];
        if (apiConfig) {
          configKeys = Object.keys(apiConfig).filter(k => k !== 'apiKey' || apiConfig.apiKey);
        }
        // Get env var info for documentation
        const envInfo = apiToolEnvVars[tool.name];
        if (envInfo) {
          envVar = envInfo.envVar;
          docUrl = envInfo.docUrl;
        }
      }

      const definition = tool.getDefinition();

      return {
        name: tool.name,
        type: tool.type,
        description: definition.function.description,
        category: metadata.category || 'general',
        available,
        configRequired,
        configured: available || !configRequired,
        envVar,
        docUrl,
        parameters: definition.function.parameters,
      };
    }));

    // Get stats
    const stats = toolRegistry.getStats();

    return c.json({
      tools: toolList,
      stats: {
        total: stats.total,
        byType: stats.byType,
        configured: toolList.filter(t => t.configured).length,
        available: toolList.filter(t => t.available).length,
      },
    });
  } catch (error: any) {
    console.error('Error listing tools:', error);
    return c.json({ error: 'Failed to list tools' }, 500);
  }
});

// GET /api/tools/:name - Get tool details
toolRoutes.get('/:name', async (c) => {
  const toolName = c.req.param('name');

  try {
    const tool = toolRegistry.get(toolName);

    if (!tool) {
      return c.json({ error: 'Tool not found' }, 404);
    }

    const definition = tool.getDefinition();
    const metadata = tool.getMetadata?.() || {
      name: tool.name,
      description: definition.function.description,
      type: tool.type,
    };

    let available = true;
    if (tool.isAvailable) {
      available = await tool.isAvailable();
    }

    // Get config info (without sensitive data)
    let configInfo: Record<string, any> = {};
    if (tool.type === 'api') {
      const apiConfig = toolsConfig.api[tool.name];
      if (apiConfig) {
        configInfo = {
          hasApiKey: !!apiConfig.apiKey,
          baseUrl: apiConfig.baseUrl,
          timeout: apiConfig.timeout,
        };
      }
    }

    return c.json({
      name: tool.name,
      type: tool.type,
      description: definition.function.description,
      category: metadata.category || 'general',
      available,
      parameters: definition.function.parameters,
      config: configInfo,
    });
  } catch (error: any) {
    console.error('Error loading tool:', error);
    return c.json({ error: 'Failed to load tool' }, 500);
  }
});

// PUT /api/tools/:name/config - Update tool configuration
toolRoutes.put('/:name/config', async (c) => {
  const toolName = c.req.param('name');

  try {
    const body = await c.req.json();
    const tool = toolRegistry.get(toolName);

    if (!tool) {
      return c.json({ error: 'Tool not found' }, 404);
    }

    if (tool.type !== 'api') {
      return c.json({ error: 'Only API tools can be configured' }, 400);
    }

    // Update config in registry
    toolRegistry.setApiConfig(toolName, {
      ...toolsConfig.api[toolName],
      ...body,
    });

    // Also update the tool instance if it has updateConfig method
    if ('updateConfig' in tool && typeof (tool as any).updateConfig === 'function') {
      (tool as any).updateConfig(body);
    }

    return c.json({ success: true, message: 'Configuration updated' });
  } catch (error: any) {
    console.error('Error updating tool config:', error);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// Custom Tools Routes (admin-only — diese Routen erlauben das Anlegen
// beliebiger ausgehender HTTP-Calls; ohne Auth waere das ein offener
// SSRF-Vektor. Siehe security-review-2026-05-03 C1.)
// ============================================
export const customToolRoutes = new Hono();

customToolRoutes.use('*', authMiddleware, adminMiddleware);

// GET /api/tools/custom - List all custom tools
customToolRoutes.get('/', async (c) => {
  try {
    const tools = await loadCustomTools();

    const toolList = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category || 'custom',
      enabled: tool.enabled,
      method: tool.method,
      endpoint: tool.endpoint,
      authType: tool.auth.type,
      parametersCount: tool.parameters.length,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    }));

    return c.json({ tools: toolList });
  } catch (error: any) {
    console.error('Error listing custom tools:', error);
    return c.json({ error: 'Failed to list custom tools' }, 500);
  }
});

// GET /api/tools/custom/:id - Get custom tool details
customToolRoutes.get('/:id', async (c) => {
  const toolId = c.req.param('id');

  try {
    const tool = await getCustomTool(toolId);

    if (!tool) {
      return c.json({ error: 'Custom tool not found' }, 404);
    }

    // Don't expose auth secrets
    const safeConfig = {
      ...tool,
      auth: {
        ...tool.auth,
        value: tool.auth.value ? '***' : undefined,
      },
    };

    return c.json(safeConfig);
  } catch (error: any) {
    console.error('Error loading custom tool:', error);
    return c.json({ error: 'Failed to load custom tool' }, 500);
  }
});

// POST /api/tools/custom - Create a new custom tool
customToolRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CustomToolConfig;

    // Validate required fields
    if (!body.id || !body.name || !body.endpoint) {
      return c.json({ error: 'ID, name, and endpoint are required' }, 400);
    }

    // Set defaults
    const config: CustomToolConfig = {
      ...body,
      enabled: body.enabled !== false,
      method: body.method || 'GET',
      parameters: body.parameters || [],
      auth: body.auth || { type: 'none' },
      responseType: body.responseType || 'json',
    };

    // Create and save
    const created = await createCustomTool(config);

    // Register with tool registry if enabled
    if (created.enabled) {
      registerCustomTool(created);
    }

    return c.json(created, 201);
  } catch (error: any) {
    console.error('Error creating custom tool:', error);
    return c.json({ error: error.message }, 400);
  }
});

// PUT /api/tools/custom/:id - Update a custom tool
customToolRoutes.put('/:id', async (c) => {
  const toolId = c.req.param('id');

  try {
    const body = await c.req.json();
    const updated = await updateCustomTool(toolId, body);

    // Re-register with tool registry
    if (updated.enabled) {
      registerCustomTool(updated);
    } else {
      unregisterCustomTool(toolId);
    }

    return c.json(updated);
  } catch (error: any) {
    console.error('Error updating custom tool:', error);
    return c.json({ error: error.message }, 400);
  }
});

// DELETE /api/tools/custom/:id - Delete a custom tool
customToolRoutes.delete('/:id', async (c) => {
  const toolId = c.req.param('id');

  try {
    // Unregister from tool registry
    unregisterCustomTool(toolId);

    // Delete from storage
    await deleteCustomTool(toolId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting custom tool:', error);
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/tools/custom/:id/test - Test a custom tool
customToolRoutes.post('/:id/test', async (c) => {
  const toolId = c.req.param('id');

  try {
    const body = await c.req.json();
    const parameters = body.parameters || {};

    const result = await testCustomTool(toolId, parameters);

    return c.json(result);
  } catch (error: any) {
    console.error('Error testing custom tool:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

// POST /api/tools/custom/:id/toggle - Enable/disable a custom tool
customToolRoutes.post('/:id/toggle', async (c) => {
  const toolId = c.req.param('id');

  try {
    const tool = await getCustomTool(toolId);
    if (!tool) {
      return c.json({ error: 'Tool not found' }, 404);
    }

    const updated = await updateCustomTool(toolId, { enabled: !tool.enabled });

    if (updated.enabled) {
      registerCustomTool(updated);
    } else {
      unregisterCustomTool(toolId);
    }

    return c.json({ enabled: updated.enabled });
  } catch (error: any) {
    console.error('Error toggling custom tool:', error);
    return c.json({ error: error.message }, 400);
  }
});

// Knowledge base routes moved to routes/knowledge.ts with RBAC support
// Streaming routes are kept here and exported separately for mounting
export const knowledgeStreamRoutes = new Hono();

// Simple YAML parser for known knowledge-base structures
function parseCollectionsYaml(yaml: string): Array<{
  id: string;
  name: string;
  description: string;
  activate_when: string[];
  never_activate_when: string[];
}> {
  const collections: Array<{
    id: string;
    name: string;
    description: string;
    activate_when: string[];
    never_activate_when: string[];
  }> = [];

  // Split into collection blocks by "- id:"
  const blocks = yaml.split(/\n\s*- id:/);
  for (let i = 1; i < blocks.length; i++) {
    const block = '- id:' + blocks[i];
    const id = block.match(/- id:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const name = block.match(/name:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const description = block.match(/description:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const activateWhen: string[] = [];
    const activateMatch = block.match(/activate_when:\s*\n((?:\s+- [^\n]+\n?)*)/);
    if (activateMatch && activateMatch[1]) {
      const items = activateMatch[1].matchAll(/\s+- "?([^"\n]+)"?/g);
      for (const m of items) { if (m[1]) activateWhen.push(m[1].trim()); }
    }

    const neverActivateWhen: string[] = [];
    const neverMatch = block.match(/never_activate_when:\s*\n((?:\s+- [^\n]+\n?)*)/);
    if (neverMatch && neverMatch[1]) {
      const items = neverMatch[1].matchAll(/\s+- "?([^"\n]+)"?/g);
      for (const m of items) { if (m[1]) neverActivateWhen.push(m[1].trim()); }
    }

    if (id) {
      collections.push({ id, name, description, activate_when: activateWhen, never_activate_when: neverActivateWhen });
    }
  }
  return collections;
}

function parseManifestYaml(yaml: string): {
  collection_id: string;
  collection_name: string;
  description: string;
  last_updated: string;
  documents: Array<{
    document_id: string;
    title: string;
    path: string;
    indexed_date: string;
    document_type?: string;
    summary?: string;
    keywords?: string[];
  }>;
} {
  const collectionId = yaml.match(/collection_id:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
  const collectionName = yaml.match(/collection_name:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
  const description = yaml.match(/description:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
  const lastUpdated = yaml.match(/last_updated:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';

  const documents: Array<{
    document_id: string;
    title: string;
    path: string;
    indexed_date: string;
    document_type?: string;
    summary?: string;
    keywords?: string[];
  }> = [];

  // Split by "- document_id:"
  const blocks = yaml.split(/\n\s*- document_id:/);
  for (let i = 1; i < blocks.length; i++) {
    const block = '- document_id:' + blocks[i];
    const docId = block.match(/- document_id:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const title = block.match(/title:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const path = block.match(/path:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const indexedDate = block.match(/indexed_date:\s*"?([^"\n]+)"?/)?.[1]?.trim() || '';
    const docType = block.match(/document_type:\s*"?([^"\n]+)"?/)?.[1]?.trim();
    const summary = block.match(/summary:\s*"?([^"\n]+)"?/)?.[1]?.trim();

    const keywords: string[] = [];
    const kwMatch = block.match(/keywords:\s*\n((?:\s+- [^\n]+\n?)*)/);
    if (kwMatch && kwMatch[1]) {
      const items = kwMatch[1].matchAll(/\s+- "?([^"\n]+)"?/g);
      for (const m of items) { if (m[1]) keywords.push(m[1].trim()); }
    }

    if (docId) {
      documents.push({
        document_id: docId,
        title,
        path,
        indexed_date: indexedDate,
        ...(docType ? { document_type: docType } : {}),
        ...(summary ? { summary } : {}),
        ...(keywords.length ? { keywords } : {}),
      });
    }
  }

  return { collection_id: collectionId, collection_name: collectionName, description, last_updated: lastUpdated, documents };
}

// GET /api/knowledge/collections - List all collections (parsed JSON)
knowledgeStreamRoutes.get('/collections', async (c) => {
  try {
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const kbBase = resolve(process.cwd(), '../data/knowledge-base');
    const content = await readFile(`${kbBase}/collections.yaml`, 'utf-8');
    const collections = parseCollectionsYaml(content);
    return c.json({ collections });
  } catch (error: any) {
    console.error('Error listing collections:', error);
    return c.json({ error: 'Failed to list collections' }, 500);
  }
});

// POST /api/knowledge/collections - Create a new collection.
// authMiddleware verhindert anonyme Collection-Erstellung (vorher offen — M7).
knowledgeStreamRoutes.post('/collections', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, description, activate_when, never_activate_when } = body;

    if (!id || !name) {
      return c.json({ error: 'ID and name are required' }, 400);
    }

    const { KbManageTool } = await import('../tools/knowledge/KnowledgeTools');
    const tool = new KbManageTool();
    const result = await tool.execute({
      action: 'create_collection',
      collection_id: id,
      name,
      description: description || '',
      activate_when: Array.isArray(activate_when) ? activate_when.join(', ') : activate_when || '',
      never_activate_when: Array.isArray(never_activate_when) ? never_activate_when.join(', ') : never_activate_when || '',
    });

    return c.json(JSON.parse(result), 201);
  } catch (error: any) {
    console.error('Error creating collection:', error);
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/knowledge/collections/batch/stream - Create collection and index documents with SSE progress
// IMPORTANT: This route MUST be defined before /collections/:id to avoid route conflicts
knowledgeStreamRoutes.post('/collections/batch/stream', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);
  console.log('[batch/stream] Request received, userId:', userId);

  try {
    const body = await c.req.json();
    console.log('[batch/stream] Request body parsed:', {
      collection_id: body.collection_id,
      name: body.name,
      itemCount: body.items?.length,
    });
    const { collection_id, name, description, items } = body;

    if (!collection_id || !name) {
      return c.json({ error: 'collection_id and name are required' }, 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'items array is required and must not be empty' }, 400);
    }

    console.log('[batch/stream] Starting SSE stream');
    return streamSSE(c, async (stream) => {
      console.log('[batch/stream] SSE stream started');
      try {
        // Step 1: Create collection
        await stream.writeSSE({
          event: 'progress',
          data: JSON.stringify({
            step: 'create_collection',
            status: 'in_progress',
            collectionId: collection_id,
            collectionName: name,
          }),
        });

        try {
          await createCollection(collection_id, name, description || '');

          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({
              step: 'create_collection',
              status: 'complete',
              collectionId: collection_id,
            }),
          });
        } catch (error: any) {
          // Collection might already exist - check if error indicates that
          if (error.message?.includes('existiert bereits')) {
            await stream.writeSSE({
              event: 'progress',
              data: JSON.stringify({
                step: 'create_collection',
                status: 'complete',
                collectionId: collection_id,
                message: 'Collection existiert bereits, verwende bestehende',
              }),
            });
          } else {
            await stream.writeSSE({
              event: 'progress',
              data: JSON.stringify({
                step: 'create_collection',
                status: 'error',
                error: error.message,
              }),
            });
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({ error: error.message }),
            });
            return;
          }
        }

        // Step 2: Index documents
        let successCount = 0;
        let errorCount = 0;
        const results: Array<{ itemId: string; success: boolean; documentId?: string; error?: string }> = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i] as ImportItem;

          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({
              step: 'index',
              itemId: item.id,
              title: item.title,
              type: item.type,
              status: 'in_progress',
              current: i + 1,
              total: items.length,
            }),
          });

          try {
            const result = await importAndIndex(item, collection_id, userId);

            if (result.success) {
              successCount++;
              results.push({
                itemId: item.id,
                success: true,
                documentId: result.documentId,
              });

              await stream.writeSSE({
                event: 'progress',
                data: JSON.stringify({
                  step: 'index',
                  itemId: item.id,
                  title: item.title,
                  status: 'complete',
                  documentId: result.documentId,
                  current: i + 1,
                  total: items.length,
                }),
              });
            } else {
              errorCount++;
              results.push({
                itemId: item.id,
                success: false,
                error: result.error,
              });

              await stream.writeSSE({
                event: 'progress',
                data: JSON.stringify({
                  step: 'index',
                  itemId: item.id,
                  title: item.title,
                  status: 'error',
                  error: result.error,
                  current: i + 1,
                  total: items.length,
                }),
              });
            }
          } catch (error: any) {
            errorCount++;
            results.push({
              itemId: item.id,
              success: false,
              error: error.message,
            });

            await stream.writeSSE({
              event: 'progress',
              data: JSON.stringify({
                step: 'index',
                itemId: item.id,
                title: item.title,
                status: 'error',
                error: error.message,
                current: i + 1,
                total: items.length,
              }),
            });
          }

          // Small delay between items
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Step 3: Done
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({
            collectionId: collection_id,
            collectionName: name,
            totalItems: items.length,
            successCount,
            errorCount,
            results,
          }),
        });
      } catch (error: any) {
        console.error('Batch collection error:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: error.message }),
        });
      }
    });
  } catch (error: any) {
    console.error('[batch/stream] Error parsing request:', error);
    console.error('[batch/stream] Error stack:', error.stack);
    return c.json({ error: error.message || 'Unbekannter Fehler' }, 400);
  }
});

// POST /api/knowledge/collections/:id/add/stream - Add documents to existing collection with SSE progress
// IMPORTANT: This route uses specific path to avoid conflicts
knowledgeStreamRoutes.post('/collections/:id/add/stream', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);
  const collectionId = c.req.param('id');
  console.log('[add/stream] Request received for collection:', collectionId, 'userId:', userId);

  try {
    const body = await c.req.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'items array is required and must not be empty' }, 400);
    }

    // Verify collection exists
    const { existsSync } = await import('fs');
    const { resolve } = await import('path');
    const kbBase = resolve(process.cwd(), '../data/knowledge-base');
    const collectionDir = `${kbBase}/collections/${collectionId}`;

    if (!existsSync(collectionDir)) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    console.log('[add/stream] Starting SSE stream for', items.length, 'items');
    return streamSSE(c, async (stream) => {
      try {
        let successCount = 0;
        let errorCount = 0;
        const results: Array<{ itemId: string; success: boolean; documentId?: string; error?: string }> = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i] as ImportItem;

          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({
              step: 'index',
              itemId: item.id,
              title: item.title,
              type: item.type,
              status: 'in_progress',
              current: i + 1,
              total: items.length,
            }),
          });

          try {
            const result = await importAndIndex(item, collectionId, userId);

            if (result.success) {
              successCount++;
              results.push({
                itemId: item.id,
                success: true,
                documentId: result.documentId,
              });

              await stream.writeSSE({
                event: 'progress',
                data: JSON.stringify({
                  step: 'index',
                  itemId: item.id,
                  title: item.title,
                  status: 'complete',
                  documentId: result.documentId,
                  current: i + 1,
                  total: items.length,
                }),
              });
            } else {
              errorCount++;
              results.push({
                itemId: item.id,
                success: false,
                error: result.error,
              });

              await stream.writeSSE({
                event: 'progress',
                data: JSON.stringify({
                  step: 'index',
                  itemId: item.id,
                  title: item.title,
                  status: 'error',
                  error: result.error,
                  current: i + 1,
                  total: items.length,
                }),
              });
            }
          } catch (error: any) {
            errorCount++;
            results.push({
              itemId: item.id,
              success: false,
              error: error.message,
            });

            await stream.writeSSE({
              event: 'progress',
              data: JSON.stringify({
                step: 'index',
                itemId: item.id,
                title: item.title,
                status: 'error',
                error: error.message,
                current: i + 1,
                total: items.length,
              }),
            });
          }
        }

        // Send completion event
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({
            collectionId,
            totalItems: items.length,
            successCount,
            errorCount,
            results,
          }),
        });

        console.log(`[add/stream] Completed: ${successCount} success, ${errorCount} errors`);
      } catch (error: any) {
        console.error('[add/stream] SSE error:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: error.message }),
        });
      }
    });
  } catch (error: any) {
    console.error('[add/stream] Error parsing request:', error);
    return c.json({ error: error.message || 'Unbekannter Fehler' }, 400);
  }
});

// GET /api/knowledge/collections/:id - Collection details + manifest (parsed JSON)
knowledgeStreamRoutes.get('/collections/:id', async (c) => {
  const collectionId = c.req.param('id');
  try {
    const kb = await import('../services/kbStorage');
    const col = await kb.getCollection(collectionId);
    if (!col) return c.json({ error: 'Collection not found' }, 404);
    const docs = await kb.listDocuments(collectionId);
    return c.json({
      collection_id: col.id,
      collection_name: col.name,
      description: col.description ?? '',
      last_updated: col.updatedAt ?? '',
      documents: docs.map((d) => ({
        document_id: d.id,
        title: d.title ?? d.filename,
        path: d.id,
        indexed_date: (d.createdAt ?? '').split('T')[0],
        ...(d.metadata ? { ...(d.metadata as Record<string, any>) } : {}),
      })),
    });
  } catch (error: any) {
    console.error('Error loading collection:', error);
    return c.json({ error: 'Collection not found' }, 404);
  }
});

// DELETE /api/knowledge/collections/:id - Delete a collection and all its documents
knowledgeStreamRoutes.delete('/collections/:id', async (c) => {
  const collectionId = c.req.param('id');
  try {
    const kb = await import('../services/kbStorage');
    const docs = await kb.listDocuments(collectionId);
    const docIds = docs.map((d) => d.id);
    const ok = await kb.deleteCollection(collectionId);
    if (!ok) return c.json({ error: 'Collection not found' }, 404);
    console.log(`[delete-collection] Deleted collection: ${collectionId} (${docIds.length} documents)`);
    return c.json({
      success: true,
      collection_id: collectionId,
      documents_deleted: docIds,
    });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    return c.json({ error: error.message || 'Failed to delete collection' }, 500);
  }
});

// Helper to find document path across collections
async function findDocumentPath(kbBase: string, docId: string, collectionId?: string): Promise<string | null> {
  const { existsSync } = await import('fs');
  const { readdir } = await import('fs/promises');

  // If collection_id provided, check there first
  if (collectionId) {
    const directPath = `${kbBase}/collections/${collectionId}/documents/${docId}`;
    if (existsSync(directPath)) return directPath;
  }

  // Search across all collections
  const collectionsDir = `${kbBase}/collections`;
  if (!existsSync(collectionsDir)) return null;

  const collections = await readdir(collectionsDir);
  for (const col of collections) {
    const docPath = `${kbBase}/collections/${col}/documents/${docId}`;
    if (existsSync(docPath)) return docPath;
  }
  return null;
}

// Helper: ohne explizite collection_id-Query im Pfad (Legacy-Endpoint)
// muss eine Collection erraten werden. Wir suchen die erste Collection
// in der das Doc liegt — eindeutig, da Doc-IDs collection-scoped sind.
async function resolveCollectionForDoc(docId: string, hint?: string): Promise<string | null> {
  const kbStorage = await import('../services/kbStorage');
  if (hint) {
    const direct = await kbStorage.getDocument(hint, docId);
    if (direct) return hint;
  }
  const cols = await kbStorage.listCollections();
  for (const col of cols) {
    const found = await kbStorage.getDocument(col.id, docId);
    if (found) return col.id;
  }
  return null;
}

// GET /api/knowledge/documents/:id - Document details (META)
// Liest aus DB+S3 (kbStorage), nicht mehr aus dem Filesystem. Der alte
// File-Pfad data/knowledge-base/collections/<id>/documents/<docId>/ ist
// seit der DB-Migration nicht mehr autoritativ.
knowledgeStreamRoutes.get('/documents/:id', async (c) => {
  const docId = c.req.param('id');
  const hint = c.req.query('collection_id') || undefined;
  try {
    const colId = await resolveCollectionForDoc(docId, hint);
    if (!colId) return c.json({ error: 'Document not found' }, 404);
    const kb = await import('../services/kbStorage');
    const doc = await kb.getDocument(colId, docId);
    if (!doc) return c.json({ error: 'Document not found' }, 404);
    return c.json({
      document_id: doc.id,
      meta: doc.metaMd ?? '',
      hasContent: !!doc.s3KeyContent,
      hasIndex: !!doc.s3KeyIndex,
    });
  } catch (error: any) {
    console.error('Error loading document:', error);
    return c.json({ error: 'Failed to load document' }, 500);
  }
});

// GET /api/knowledge/documents/:id/content - Document content (content.md)
knowledgeStreamRoutes.get('/documents/:id/content', async (c) => {
  const docId = c.req.param('id');
  const hint = c.req.query('collection_id') || undefined;
  try {
    const colId = await resolveCollectionForDoc(docId, hint);
    if (!colId) return c.json({ error: 'Document not found' }, 404);
    const kb = await import('../services/kbStorage');
    const content = await kb.getDocumentContent(colId, docId);
    if (content === null) return c.json({ error: 'Content not found' }, 404);
    return c.json({ document_id: docId, content });
  } catch (error: any) {
    console.error('Error loading document content:', error);
    return c.json({ error: 'Failed to load document content' }, 500);
  }
});

// GET /api/knowledge/documents/:id/index - Document index (INDEX.md)
knowledgeStreamRoutes.get('/documents/:id/index', async (c) => {
  const docId = c.req.param('id');
  const hint = c.req.query('collection_id') || undefined;
  try {
    const colId = await resolveCollectionForDoc(docId, hint);
    if (!colId) return c.json({ error: 'Document not found' }, 404);
    const kb = await import('../services/kbStorage');
    const index = await kb.getDocumentIndex(colId, docId);
    if (index === null) return c.json({ error: 'Index not found' }, 404);
    return c.json({ document_id: docId, index });
  } catch (error: any) {
    console.error('Error loading document index:', error);
    return c.json({ error: 'Failed to load document index' }, 500);
  }
});

// DELETE /api/knowledge/documents/:id - Delete a document
knowledgeStreamRoutes.delete('/documents/:id', async (c) => {
  const docId = c.req.param('id');
  const hint = c.req.query('collection_id') || undefined;
  try {
    const colId = await resolveCollectionForDoc(docId, hint);
    if (!colId) return c.json({ error: 'Document not found' }, 404);
    const kb = await import('../services/kbStorage');
    const ok = await kb.deleteDocument(colId, docId);
    if (!ok) return c.json({ error: 'Document not found' }, 404);
    return c.json({ success: true, document_id: docId, collection_id: colId });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Whitelist von Extensions die der KB-Indexer verarbeiten kann.
const ALLOWED_KB_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.md', '.csv', '.html', '.htm', '.rtf',
]);

// POST /api/knowledge/index - Index a document (file upload).
// authMiddleware verhindert anonymen Indexer (vorher offen — M7).
knowledgeStreamRoutes.post('/index', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const formData = await c.req.formData();
    const file = formData.get('document') as File | null;
    const collectionId = formData.get('collection_id') as string;
    const title = formData.get('title') as string | null;
    const owner = formData.get('owner') as string | null;
    const confidentiality = formData.get('confidentiality') as string | null;

    if (!file || !collectionId) {
      return c.json({ error: 'document file and collection_id are required' }, 400);
    }

    // Filename-Sanitization: nur basename (strippt Pfad-Komponenten),
    // Extension-Whitelist gegen .exe/.sh/.jar etc., Control-Chars raus.
    // Vorher schrieb der Code `incoming/${file.name}` direkt — bei
    // file.name="../../etc/passwd" landete das als Pfad-Traversal. M6.
    const { basename, extname } = await import('path');
    const safeName = basename(file.name).replace(/[\x00-\x1F\x7F]/g, '_');
    if (!safeName || safeName.startsWith('.') || safeName.length > 255) {
      return c.json({ error: 'Ungueltiger Dateiname' }, 400);
    }
    const ext = extname(safeName).toLowerCase();
    if (!ALLOWED_KB_EXTENSIONS.has(ext)) {
      return c.json({ error: `Dateityp ${ext} nicht erlaubt im KB-Index` }, 400);
    }

    // Save uploaded file to incoming/
    const { writeFile } = await import('fs/promises');
    const { resolve, join } = await import('path');
    const kbBase = resolve(process.cwd(), '../data/knowledge-base');
    const incomingDir = join(kbBase, 'incoming');
    const incomingPath = join(incomingDir, safeName);
    // Defense-in-Depth: nach dem Join nochmal pruefen, dass wir innerhalb
    // von incomingDir geblieben sind. Sollte durch basename+sanitize unmoeglich
    // sein, aber wenn doch — fail-safe abweisen.
    if (!incomingPath.startsWith(incomingDir + '/')) {
      return c.json({ error: 'Pfad-Sanitization fehlgeschlagen' }, 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(incomingPath, buffer);

    // Index the document
    const { indexerService } = await import('../services/indexer');
    const result = await indexerService.indexDocument(safeName, collectionId, {
      title: title || undefined,
      owner: owner || undefined,
      confidentiality: confidentiality || 'internal',
    }, userId);

    return c.json(result, 201);
  } catch (error: any) {
    console.error('Error indexing document:', error);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// MCP Server Routes
// ============================================
import {
  mcpManager,
  getMcpPresets,
  type McpServerConfig,
} from '../mcp';

export const mcpRoutes = new Hono();

// GET /api/mcp/servers - List all MCP servers
mcpRoutes.get('/servers', async (c) => {
  try {
    const servers = await mcpManager.getServers();
    return c.json({ servers });
  } catch (error: any) {
    console.error('Error listing MCP servers:', error);
    return c.json({ error: 'Failed to list MCP servers' }, 500);
  }
});

// GET /api/mcp/servers/presets - Get available presets
mcpRoutes.get('/servers/presets', async (c) => {
  try {
    const presets = getMcpPresets();
    return c.json({ presets });
  } catch (error: any) {
    console.error('Error getting MCP presets:', error);
    return c.json({ error: 'Failed to get presets' }, 500);
  }
});

// POST /api/mcp/servers - Add a new MCP server
mcpRoutes.post('/servers', async (c) => {
  try {
    const body = await c.req.json() as McpServerConfig;

    if (!body.id || !body.name || !body.command) {
      return c.json({ error: 'ID, name, and command are required' }, 400);
    }

    const server = await mcpManager.addServer(body);
    return c.json(server, 201);
  } catch (error: any) {
    console.error('Error adding MCP server:', error);
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/mcp/servers/:id - Get a specific MCP server
mcpRoutes.get('/servers/:id', async (c) => {
  const serverId = c.req.param('id');

  try {
    const server = await mcpManager.getServer(serverId);
    if (!server) {
      return c.json({ error: 'MCP server not found' }, 404);
    }

    // Include tools
    const tools = mcpManager.getServerTools(serverId);

    return c.json({ ...server, tools });
  } catch (error: any) {
    console.error('Error getting MCP server:', error);
    return c.json({ error: 'Failed to get MCP server' }, 500);
  }
});

// PUT /api/mcp/servers/:id - Update an MCP server
mcpRoutes.put('/servers/:id', async (c) => {
  const serverId = c.req.param('id');

  try {
    const body = await c.req.json();
    const server = await mcpManager.updateServer(serverId, body);
    return c.json(server);
  } catch (error: any) {
    console.error('Error updating MCP server:', error);
    return c.json({ error: error.message }, 400);
  }
});

// DELETE /api/mcp/servers/:id - Delete an MCP server
mcpRoutes.delete('/servers/:id', async (c) => {
  const serverId = c.req.param('id');

  try {
    await mcpManager.deleteServer(serverId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting MCP server:', error);
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/mcp/servers/:id/connect - Connect to an MCP server
mcpRoutes.post('/servers/:id/connect', async (c) => {
  const serverId = c.req.param('id');

  try {
    await mcpManager.connectServer(serverId);
    const server = await mcpManager.getServer(serverId);
    return c.json(server);
  } catch (error: any) {
    console.error('Error connecting to MCP server:', error);
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/mcp/servers/:id/disconnect - Disconnect from an MCP server
mcpRoutes.post('/servers/:id/disconnect', async (c) => {
  const serverId = c.req.param('id');

  try {
    await mcpManager.disconnectServer(serverId);
    const server = await mcpManager.getServer(serverId);
    return c.json(server);
  } catch (error: any) {
    console.error('Error disconnecting from MCP server:', error);
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/mcp/servers/:id/refresh - Refresh tools from an MCP server
mcpRoutes.post('/servers/:id/refresh', async (c) => {
  const serverId = c.req.param('id');

  try {
    const tools = await mcpManager.refreshServerTools(serverId);
    return c.json({ tools, count: tools.length });
  } catch (error: any) {
    console.error('Error refreshing MCP tools:', error);
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/mcp/tools - Get all MCP tools
mcpRoutes.get('/tools', async (c) => {
  try {
    const tools = mcpManager.getAllTools();
    return c.json({ tools, count: tools.length });
  } catch (error: any) {
    console.error('Error listing MCP tools:', error);
    return c.json({ error: 'Failed to list MCP tools' }, 500);
  }
});

// POST /api/mcp/tools/test - Test an MCP tool
mcpRoutes.post('/tools/test', async (c) => {
  try {
    const body = await c.req.json();
    const { serverId, toolName, args } = body;

    if (!serverId || !toolName) {
      return c.json({ error: 'serverId and toolName are required' }, 400);
    }

    const result = await mcpManager.testTool(serverId, toolName, args || {});
    return c.json(result);
  } catch (error: any) {
    console.error('Error testing MCP tool:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});
