import { writeFile, readFile, mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Message } from './llm';
import { llmService } from './llm';
import { saveProjectChat } from '../projects/storage';
import { CONVERSATIONS_DIR, CHATS_DIR, CHAT_FOLDERS_FILE } from '../utils/paths';

// ============================================
// File-level mutexes to prevent race conditions
// ============================================

// Per-session locks for chat file read-modify-write
const chatLocks = new Map<string, Promise<void>>();

async function withChatLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = chatLocks.get(sessionId) || Promise.resolve();
  chatLocks.set(sessionId, new Promise<void>((resolve) => { release = resolve; }));
  await prev;
  try {
    return await fn();
  } finally {
    release!();
    // Clean up lock entries for sessions no longer contended
    if (chatLocks.get(sessionId) === undefined) {
      chatLocks.delete(sessionId);
    }
  }
}

// Global lock for the shared chat-folders.yaml file
let foldersLock: Promise<void> = Promise.resolve();

async function withFoldersLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = foldersLock;
  foldersLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

export interface ConversationSession {
  id: string;
  userId?: string;  // Owner of the session
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

// In-memory store for active sessions
// Key format: "${userId}::${sessionId}" for user-isolated sessions
const activeSessions = new Map<string, ConversationSession>();

// Store attachments for the next user message in a session
// Key format: "${userId}::${sessionId}" for user-isolated attachments
const pendingAttachments = new Map<string, MessageAttachment[]>();

/**
 * Generate a composite key for user-isolated storage
 */
function getSessionKey(userId: string | undefined, sessionId: string): string {
  // Use 'anonymous' for undefined userId to maintain backwards compatibility
  return userId ? `${userId}::${sessionId}` : `anonymous::${sessionId}`;
}

/**
 * Set pending attachments for the next user message in a session
 */
export function setPendingAttachments(sessionId: string, attachments: MessageAttachment[], userId?: string): void {
  const key = getSessionKey(userId, sessionId);
  pendingAttachments.set(key, attachments);
}

/**
 * Get and clear pending attachments for a session
 */
export function popPendingAttachments(sessionId: string, userId?: string): MessageAttachment[] | undefined {
  const key = getSessionKey(userId, sessionId);
  const attachments = pendingAttachments.get(key);
  pendingAttachments.delete(key);
  return attachments;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getSession(sessionId: string, userId?: string): ConversationSession | undefined {
  const key = getSessionKey(userId, sessionId);
  return activeSessions.get(key);
}

export function createSession(sessionId: string, userId?: string): ConversationSession {
  const session: ConversationSession = {
    id: sessionId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  const key = getSessionKey(userId, sessionId);
  activeSessions.set(key, session);
  return session;
}

export function getOrCreateSession(sessionId: string, userId?: string): ConversationSession {
  let session = getSession(sessionId, userId);
  if (!session) {
    session = createSession(sessionId, userId);
  }
  return session;
}

export function addMessage(sessionId: string, message: Message, userId?: string): void {
  const session = getOrCreateSession(sessionId, userId);
  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
}

export function getMessages(sessionId: string, userId?: string): Message[] {
  const session = getSession(sessionId, userId);
  return session?.messages || [];
}

function formatMessagesAsMarkdown(session: ConversationSession): string {
  const lines: string[] = [
    `# Conversation ${session.id}`,
    '',
    `Created: ${session.createdAt}`,
    `Updated: ${session.updatedAt}`,
    '',
    '---',
    '',
  ];

  for (const msg of session.messages) {
    const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

    if (msg.role === 'tool') {
      lines.push(`### Tool Result (${msg.name || 'unknown'})`);
      lines.push('```');
      lines.push(msg.content || '');
      lines.push('```');
    } else if (msg.tool_calls && msg.tool_calls.length > 0) {
      lines.push(`### ${roleLabel}`);
      if (msg.content) {
        lines.push(msg.content);
      }
      lines.push('');
      lines.push('**Tool Calls:**');
      for (const tc of msg.tool_calls) {
        lines.push(`- \`${tc.function.name}\`: ${tc.function.arguments}`);
      }
    } else {
      lines.push(`### ${roleLabel}`);
      lines.push(msg.content || '');
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function saveConversation(sessionId: string, userId?: string): Promise<void> {
  const session = getSession(sessionId, userId);
  if (!session || session.messages.length === 0) return;

  // Ensure directory exists
  if (!existsSync(CONVERSATIONS_DIR)) {
    await mkdir(CONVERSATIONS_DIR, { recursive: true });
  }

  const markdown = formatMessagesAsMarkdown(session);
  const fileName = `${sessionId}.md`;
  const filePath = join(CONVERSATIONS_DIR, fileName);

  await writeFile(filePath, markdown, 'utf-8');
  console.log(`Saved conversation to ${filePath}`);
}

export async function loadConversation(sessionId: string): Promise<ConversationSession | null> {
  const filePath = join(CONVERSATIONS_DIR, `${sessionId}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  // For simplicity, we don't parse the markdown back to messages
  // In a real implementation, you might use a JSON file for exact reconstruction
  return null;
}

// Cleanup old sessions (called periodically)
export function cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();

  for (const [key, session] of activeSessions) {
    const updatedAt = new Date(session.updatedAt).getTime();
    if (now - updatedAt > maxAgeMs) {
      activeSessions.delete(key);
      console.log(`Cleaned up old session: ${key}`);
    }
  }
}

// ---- Chat History (YAML-based persistence) ----

/**
 * Attachment stored with a chat message for persistent display
 */
export interface MessageAttachment {
  id: string;
  type: 'document' | 'image' | 'audio';
  filename: string;
  mimeType: string;
  // For display in chat history:
  url?: string;           // URL to retrieve the file (for audio player / image display)
  transcription?: string; // For audio files
  preview?: string;       // For documents (first few lines)
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  routedBy?: string;
  attachments?: MessageAttachment[];  // Attachments sent with this message
}

// Chat Material - collected work results in a chat
export interface ChatMaterial {
  id: string;
  type: 'upload' | 'transcript' | 'skill_result' | 'user_marked';
  title: string;
  content: string;           // Markdown or plain text
  mimeType?: string;         // For uploads
  sourceMessageIndex?: number; // Reference to chat message
  createdAt: number;
  metadata?: {
    filename?: string;
    duration?: number;       // For audio
    skillId?: string;        // For skill results
  };
}

export interface ChatHistory {
  id: string;
  userId?: string;  // User who owns this chat (undefined = anonymous)
  projectId?: string;  // Project this chat belongs to (if any)
  folderIds?: string[];  // Folders this chat belongs to (can be in multiple)
  title: string;
  summary?: string;
  keywords?: string[];
  lastSummaryAt?: number; // Message count when summary was last generated
  createdAt: string;
  updatedAt: string;
  messages: ChatHistoryMessage[];
  materials?: ChatMaterial[];  // Collected materials from this chat
  // Share-Link fields
  shareToken?: string;  // 22-character token for sharing (128 bits)
  sharedAt?: string;    // When the share link was created
  sharedBy?: string;    // User ID who created the share link
}

// Number of new messages before regenerating summary
const SUMMARY_REGENERATE_THRESHOLD = 6;

export interface ChatHistorySummary {
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
}

function escapeYamlString(str: string): string {
  if (!str) return '""';
  // Use double-quoted style for strings with special chars
  if (/[\n\r":{}[\],&*?|<>=!%@`#]/.test(str) || str.startsWith(' ') || str.endsWith(' ')) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  }
  return str;
}

function formatChatAsYaml(chat: ChatHistory): string {
  const lines: string[] = [
    `id: ${chat.id}`,
  ];

  // Add userId if present
  if (chat.userId) {
    lines.push(`userId: ${escapeYamlString(chat.userId)}`);
  }

  // Add projectId if present
  if (chat.projectId) {
    lines.push(`projectId: ${escapeYamlString(chat.projectId)}`);
  }

  // Add folderIds if present
  if (chat.folderIds && chat.folderIds.length > 0) {
    lines.push('folderIds:');
    for (const folderId of chat.folderIds) {
      lines.push(`  - ${escapeYamlString(folderId)}`);
    }
  }

  lines.push(`title: ${escapeYamlString(chat.title)}`);

  // Add summary if present
  if (chat.summary) {
    lines.push(`summary: ${escapeYamlString(chat.summary)}`);
  }

  // Add keywords if present
  if (chat.keywords && chat.keywords.length > 0) {
    lines.push('keywords:');
    for (const kw of chat.keywords) {
      lines.push(`  - ${escapeYamlString(kw)}`);
    }
  }

  // Track when summary was last generated
  if (chat.lastSummaryAt !== undefined) {
    lines.push(`lastSummaryAt: ${chat.lastSummaryAt}`);
  }

  // Share-Link fields
  if (chat.shareToken) {
    lines.push(`shareToken: ${escapeYamlString(chat.shareToken)}`);
  }
  if (chat.sharedAt) {
    lines.push(`sharedAt: "${chat.sharedAt}"`);
  }
  if (chat.sharedBy) {
    lines.push(`sharedBy: ${escapeYamlString(chat.sharedBy)}`);
  }

  lines.push(`createdAt: "${chat.createdAt}"`);
  lines.push(`updatedAt: "${chat.updatedAt}"`);
  lines.push('messages:');

  for (const msg of chat.messages) {
    lines.push(`  - role: ${msg.role}`);
    lines.push(`    content: ${escapeYamlString(msg.content)}`);
    if (msg.agentId) {
      lines.push(`    agentId: ${msg.agentId}`);
    }
    if (msg.routedBy) {
      lines.push(`    routedBy: ${msg.routedBy}`);
    }
    // Serialize attachments if present
    if (msg.attachments && msg.attachments.length > 0) {
      lines.push('    attachments:');
      for (const att of msg.attachments) {
        lines.push(`      - id: ${escapeYamlString(att.id)}`);
        lines.push(`        type: ${att.type}`);
        lines.push(`        filename: ${escapeYamlString(att.filename)}`);
        lines.push(`        mimeType: ${escapeYamlString(att.mimeType)}`);
        if (att.url) {
          lines.push(`        url: ${escapeYamlString(att.url)}`);
        }
        if (att.transcription) {
          lines.push(`        transcription: ${escapeYamlString(att.transcription)}`);
        }
        if (att.preview) {
          lines.push(`        preview: ${escapeYamlString(att.preview)}`);
        }
      }
    }
  }

  // Serialize materials if present
  if (chat.materials && chat.materials.length > 0) {
    lines.push('materials:');
    for (const mat of chat.materials) {
      lines.push(`  - id: ${escapeYamlString(mat.id)}`);
      lines.push(`    type: ${mat.type}`);
      lines.push(`    title: ${escapeYamlString(mat.title)}`);
      lines.push(`    content: ${escapeYamlString(mat.content)}`);
      lines.push(`    createdAt: ${mat.createdAt}`);
      if (mat.mimeType) {
        lines.push(`    mimeType: ${escapeYamlString(mat.mimeType)}`);
      }
      if (mat.sourceMessageIndex !== undefined) {
        lines.push(`    sourceMessageIndex: ${mat.sourceMessageIndex}`);
      }
      if (mat.metadata) {
        lines.push('    metadata:');
        if (mat.metadata.filename) {
          lines.push(`      filename: ${escapeYamlString(mat.metadata.filename)}`);
        }
        if (mat.metadata.duration !== undefined) {
          lines.push(`      duration: ${mat.metadata.duration}`);
        }
        if (mat.metadata.skillId) {
          lines.push(`      skillId: ${escapeYamlString(mat.metadata.skillId)}`);
        }
      }
    }
  }

  return lines.join('\n') + '\n';
}

function parseChatYaml(content: string): ChatHistory | null {
  try {
    const lines = content.split('\n');
    const chat: ChatHistory = { id: '', title: '', createdAt: '', updatedAt: '', messages: [] };

    let inMessages = false;
    let inMaterials = false;
    let inKeywords = false;
    let inFolderIds = false;
    let currentMsg: Partial<ChatHistoryMessage> | null = null;
    let currentMaterial: Partial<ChatMaterial> | null = null;
    let inMaterialMetadata = false;

    for (const line of lines) {
      // Check for folderIds array items (before inMessages check)
      if (inFolderIds && !inMessages) {
        const folderIdMatch = line.match(/^\s+-\s*(.+)$/);
        if (folderIdMatch) {
          if (!chat.folderIds) chat.folderIds = [];
          let val = folderIdMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          chat.folderIds.push(val);
          continue;
        } else {
          inFolderIds = false; // Exit folderIds section
        }
      }

      // Check for keywords array items (before inMessages check)
      if (inKeywords && !inMessages) {
        const keywordMatch = line.match(/^\s+-\s*(.+)$/);
        if (keywordMatch) {
          if (!chat.keywords) chat.keywords = [];
          let val = keywordMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          chat.keywords.push(val);
          continue;
        } else {
          inKeywords = false; // Exit keywords section
        }
      }

      if (!inMessages) {
        const idMatch = line.match(/^id:\s*(.+)$/);
        if (idMatch) { chat.id = idMatch[1]!.trim(); continue; }

        const userIdMatch = line.match(/^userId:\s*(.+)$/);
        if (userIdMatch) {
          let val = userIdMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          chat.userId = val;
          continue;
        }

        const projectIdMatch = line.match(/^projectId:\s*(.+)$/);
        if (projectIdMatch) {
          let val = projectIdMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          chat.projectId = val;
          continue;
        }

        if (line.match(/^folderIds:\s*$/)) {
          inFolderIds = true;
          chat.folderIds = [];
          continue;
        }

        const titleMatch = line.match(/^title:\s*(.+)$/);
        if (titleMatch) {
          let val = titleMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          chat.title = val;
          continue;
        }

        const summaryMatch = line.match(/^summary:\s*(.+)$/);
        if (summaryMatch) {
          let val = summaryMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          chat.summary = val;
          continue;
        }

        if (line.match(/^keywords:\s*$/)) {
          inKeywords = true;
          chat.keywords = [];
          continue;
        }

        const lastSummaryAtMatch = line.match(/^lastSummaryAt:\s*(\d+)\s*$/);
        if (lastSummaryAtMatch) {
          chat.lastSummaryAt = parseInt(lastSummaryAtMatch[1]!, 10);
          continue;
        }

        // Share-Link fields
        const shareTokenMatch = line.match(/^shareToken:\s*(.+)$/);
        if (shareTokenMatch) {
          let val = shareTokenMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          chat.shareToken = val;
          continue;
        }

        const sharedAtMatch = line.match(/^sharedAt:\s*"?(.+?)"?\s*$/);
        if (sharedAtMatch) {
          chat.sharedAt = sharedAtMatch[1]!;
          continue;
        }

        const sharedByMatch = line.match(/^sharedBy:\s*(.+)$/);
        if (sharedByMatch) {
          let val = sharedByMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          chat.sharedBy = val;
          continue;
        }

        const createdMatch = line.match(/^createdAt:\s*"?(.+?)"?\s*$/);
        if (createdMatch) { chat.createdAt = createdMatch[1]!; continue; }

        const updatedMatch = line.match(/^updatedAt:\s*"?(.+?)"?\s*$/);
        if (updatedMatch) { chat.updatedAt = updatedMatch[1]!; continue; }

        if (line.match(/^messages:\s*$/)) { inMessages = true; inMaterials = false; inKeywords = false; continue; }
        if (line.match(/^materials:\s*$/)) { inMaterials = true; inMessages = false; inKeywords = false; chat.materials = []; continue; }
      } else if (inMaterials) {
        // Parse materials section
        const matIdMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
        if (matIdMatch) {
          // Save previous material
          if (currentMaterial && currentMaterial.id) {
            chat.materials!.push(currentMaterial as ChatMaterial);
          }
          let val = matIdMatch[1]!.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          currentMaterial = { id: val };
          inMaterialMetadata = false;
          continue;
        }

        if (currentMaterial) {
          // Check for metadata section
          if (line.match(/^\s+metadata:\s*$/)) {
            currentMaterial.metadata = {};
            inMaterialMetadata = true;
            continue;
          }

          if (inMaterialMetadata && currentMaterial.metadata) {
            const metaFilenameMatch = line.match(/^\s+filename:\s*(.+)$/);
            if (metaFilenameMatch) {
              let val = metaFilenameMatch[1]!.trim();
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              }
              currentMaterial.metadata.filename = val;
              continue;
            }

            const metaDurationMatch = line.match(/^\s+duration:\s*(\d+)\s*$/);
            if (metaDurationMatch) {
              currentMaterial.metadata.duration = parseInt(metaDurationMatch[1]!, 10);
              continue;
            }

            const metaSkillIdMatch = line.match(/^\s+skillId:\s*(.+)$/);
            if (metaSkillIdMatch) {
              let val = metaSkillIdMatch[1]!.trim();
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
              }
              currentMaterial.metadata.skillId = val;
              continue;
            }
          }

          // Non-metadata fields (if not indented deeply)
          const matTypeMatch = line.match(/^\s+type:\s*(.+)$/);
          if (matTypeMatch && !inMaterialMetadata) {
            currentMaterial.type = matTypeMatch[1]!.trim() as ChatMaterial['type'];
            continue;
          }

          const matTitleMatch = line.match(/^\s+title:\s*(.+)$/);
          if (matTitleMatch && !inMaterialMetadata) {
            let val = matTitleMatch[1]!.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            currentMaterial.title = val;
            continue;
          }

          const matContentMatch = line.match(/^\s+content:\s*(.+)$/);
          if (matContentMatch && !inMaterialMetadata) {
            let val = matContentMatch[1]!.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            currentMaterial.content = val;
            continue;
          }

          const matCreatedAtMatch = line.match(/^\s+createdAt:\s*(\d+)\s*$/);
          if (matCreatedAtMatch && !inMaterialMetadata) {
            currentMaterial.createdAt = parseInt(matCreatedAtMatch[1]!, 10);
            continue;
          }

          const matMimeTypeMatch = line.match(/^\s+mimeType:\s*(.+)$/);
          if (matMimeTypeMatch && !inMaterialMetadata) {
            let val = matMimeTypeMatch[1]!.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1);
            }
            currentMaterial.mimeType = val;
            continue;
          }

          const matSourceMsgMatch = line.match(/^\s+sourceMessageIndex:\s*(\d+)\s*$/);
          if (matSourceMsgMatch && !inMaterialMetadata) {
            currentMaterial.sourceMessageIndex = parseInt(matSourceMsgMatch[1]!, 10);
            continue;
          }
        }
      } else {
        const roleMatch = line.match(/^\s+-\s+role:\s*(.+)$/);
        if (roleMatch) {
          if (currentMsg && currentMsg.role && currentMsg.content !== undefined) {
            chat.messages.push(currentMsg as ChatHistoryMessage);
          }
          currentMsg = { role: roleMatch[1]!.trim() as 'user' | 'assistant' };
          continue;
        }

        if (currentMsg) {
          const contentMatch = line.match(/^\s+content:\s*(.+)$/);
          if (contentMatch) {
            let val = contentMatch[1]!.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            currentMsg.content = val;
            continue;
          }

          const agentMatch = line.match(/^\s+agentId:\s*(.+)$/);
          if (agentMatch) { currentMsg.agentId = agentMatch[1]!.trim(); continue; }

          const routedMatch = line.match(/^\s+routedBy:\s*(.+)$/);
          if (routedMatch) { currentMsg.routedBy = routedMatch[1]!.trim(); continue; }

          // Parse attachments section
          if (line.match(/^\s+attachments:\s*$/)) {
            currentMsg.attachments = [];
            continue;
          }

          // Parse individual attachment
          if (currentMsg.attachments !== undefined) {
            const attIdMatch = line.match(/^\s+-\s+id:\s*(.+)$/);
            if (attIdMatch) {
              let val = attIdMatch[1]!.trim();
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
              }
              // Add new attachment
              currentMsg.attachments.push({
                id: val,
                type: 'document',
                filename: '',
                mimeType: ''
              });
              continue;
            }

            // Parse attachment properties
            const currentAtt = currentMsg.attachments[currentMsg.attachments.length - 1];
            if (currentAtt) {
              const typeMatch = line.match(/^\s+type:\s*(.+)$/);
              if (typeMatch) {
                currentAtt.type = typeMatch[1]!.trim() as 'document' | 'image' | 'audio';
                continue;
              }

              const filenameMatch = line.match(/^\s+filename:\s*(.+)$/);
              if (filenameMatch) {
                let val = filenameMatch[1]!.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                currentAtt.filename = val;
                continue;
              }

              const mimeMatch = line.match(/^\s+mimeType:\s*(.+)$/);
              if (mimeMatch) {
                let val = mimeMatch[1]!.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.slice(1, -1);
                }
                currentAtt.mimeType = val;
                continue;
              }

              const urlMatch = line.match(/^\s+url:\s*(.+)$/);
              if (urlMatch) {
                let val = urlMatch[1]!.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                currentAtt.url = val;
                continue;
              }

              const transcriptionMatch = line.match(/^\s+transcription:\s*(.+)$/);
              if (transcriptionMatch) {
                let val = transcriptionMatch[1]!.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                currentAtt.transcription = val;
                continue;
              }

              const previewMatch = line.match(/^\s+preview:\s*(.+)$/);
              if (previewMatch) {
                let val = previewMatch[1]!.trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                currentAtt.preview = val;
                continue;
              }
            }
          }
        }
      }
    }

    // Push last message
    if (currentMsg && currentMsg.role && currentMsg.content !== undefined) {
      chat.messages.push(currentMsg as ChatHistoryMessage);
    }

    // Push last material
    if (currentMaterial && currentMaterial.id) {
      if (!chat.materials) chat.materials = [];
      chat.materials.push(currentMaterial as ChatMaterial);
    }

    return chat.id ? chat : null;
  } catch (err) {
    console.error('Error parsing chat YAML:', err);
    return null;
  }
}

interface ChatSummaryResult {
  title: string;
  summary: string;
  keywords: string[];
}

/**
 * Generate a summary, title, and keywords for a chat using LLM
 */
async function generateChatSummary(messages: ChatHistoryMessage[]): Promise<ChatSummaryResult | null> {
  try {
    // Build conversation text for LLM
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n\n');

    // Limit to avoid token limits
    const truncatedText = conversationText.slice(0, 4000);

    const response = await llmService.chat([
      {
        role: 'user',
        content: `Analysiere diese Chat-Konversation und erstelle:
1. Einen aussagekräftigen TITEL (max 60 Zeichen) - beschreibe das Hauptthema
2. Eine kurze ZUSAMMENFASSUNG (max 200 Zeichen) - was wurde besprochen/erreicht
3. 3-7 KEYWORDS für die Suche (deutsch und englisch gemischt)

KONVERSATION:
${truncatedText}

Antworte NUR im folgenden JSON-Format:
{
  "title": "Aussagekräftiger Titel",
  "summary": "Kurze Zusammenfassung des Chats",
  "keywords": ["Keyword1", "Keyword2", "Keyword3"]
}`,
      },
    ]);

    const text = response.content || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse chat summary JSON');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: (parsed.title || '').slice(0, 60),
      summary: (parsed.summary || '').slice(0, 300),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
    };
  } catch (error) {
    console.error('Error generating chat summary:', error);
    return null;
  }
}

export async function saveChatHistory(sessionId: string, userId?: string, projectId?: string, attachments?: MessageAttachment[], materials?: ChatMaterial[]): Promise<void> {
  return withChatLock(sessionId, async () => {
  const session = getSession(sessionId);
  if (!session || session.messages.length === 0) return;

  if (!existsSync(CHATS_DIR)) {
    await mkdir(CHATS_DIR, { recursive: true });
  }

  // Filter to only user and assistant messages (no tool, no tool_calls)
  const chatMessages: ChatHistoryMessage[] = [];
  let lastUserMessageIndex = -1;

  for (const msg of session.messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) continue;
      if (!msg.content) continue;
      const chatMsg: ChatHistoryMessage = {
        role: msg.role,
        content: msg.content,
      };
      chatMessages.push(chatMsg);
      if (msg.role === 'user') {
        lastUserMessageIndex = chatMessages.length - 1;
      }
    }
  }

  if (chatMessages.length === 0) return;

  // Associate attachments with the last user message (if any)
  if (attachments && attachments.length > 0 && lastUserMessageIndex >= 0) {
    chatMessages[lastUserMessageIndex]!.attachments = attachments;
  }

  // Check if chat already exists to preserve createdAt and existing summary
  const existingPath = join(CHATS_DIR, `${sessionId}.yaml`);
  let createdAt = session.createdAt;
  let existingChat: ChatHistory | null = null;

  if (existsSync(existingPath)) {
    try {
      existingChat = parseChatYaml(await readFile(existingPath, 'utf-8'));
      if (existingChat) createdAt = existingChat.createdAt;

      // Preserve existing attachments from prior messages
      if (existingChat?.messages) {
        for (let i = 0; i < Math.min(existingChat.messages.length, chatMessages.length); i++) {
          const existingMsg = existingChat.messages[i];
          if (existingMsg?.attachments && existingMsg.attachments.length > 0) {
            // Don't overwrite if we already have attachments for this message
            if (!chatMessages[i]!.attachments) {
              chatMessages[i]!.attachments = existingMsg.attachments;
            }
          }
        }
      }
    } catch {}
  }

  // Determine if we need to generate a new summary
  // Generate summary if:
  // 1. No existing summary OR
  // 2. Message count increased by SUMMARY_REGENERATE_THRESHOLD since last summary
  const lastSummaryAt = existingChat?.lastSummaryAt ?? 0;
  const messagesSinceLastSummary = chatMessages.length - lastSummaryAt;

  const needsSummary =
    !existingChat?.summary ||
    !existingChat?.keywords ||
    existingChat.keywords.length === 0 ||
    messagesSinceLastSummary >= SUMMARY_REGENERATE_THRESHOLD;

  let title: string;
  let summary: string | undefined;
  let keywords: string[] | undefined;
  let newLastSummaryAt: number | undefined;

  if (needsSummary && chatMessages.length >= 2) {
    // Generate LLM summary for meaningful conversations
    const summaryResult = await generateChatSummary(chatMessages);

    if (summaryResult) {
      title = summaryResult.title;
      summary = summaryResult.summary;
      keywords = summaryResult.keywords;
      newLastSummaryAt = chatMessages.length; // Track when we generated this summary
      console.log(`Generated chat summary: "${title}" with ${keywords.length} keywords (at ${chatMessages.length} messages)`);
    } else {
      // Fallback to first message
      const firstUserMsg = chatMessages.find((m) => m.role === 'user');
      title = firstUserMsg ? firstUserMsg.content.replace(/\n/g, ' ').slice(0, 60) : 'Untitled Chat';
      newLastSummaryAt = existingChat?.lastSummaryAt;
    }
  } else if (existingChat?.summary) {
    // Preserve existing summary
    title = existingChat.title;
    summary = existingChat.summary;
    keywords = existingChat.keywords;
    newLastSummaryAt = existingChat.lastSummaryAt;
  } else {
    // Fallback for very short chats
    const firstUserMsg = chatMessages.find((m) => m.role === 'user');
    title = firstUserMsg ? firstUserMsg.content.replace(/\n/g, ' ').slice(0, 60) : 'Untitled Chat';
  }

  // Determine userId: preserve existing or use new one
  const chatUserId = existingChat?.userId || userId;

  // Determine projectId: preserve existing or use new one
  const chatProjectId = existingChat?.projectId || projectId;

  // Merge materials: existing + new (avoiding duplicates by id)
  let chatMaterials: ChatMaterial[] | undefined;
  const existingMaterialIds = new Set((existingChat?.materials || []).map(m => m.id));
  if (materials && materials.length > 0) {
    const newMaterials = materials.filter(m => !existingMaterialIds.has(m.id));
    chatMaterials = [...(existingChat?.materials || []), ...newMaterials];
  } else if (existingChat?.materials && existingChat.materials.length > 0) {
    chatMaterials = existingChat.materials;
  }

  const chat: ChatHistory = {
    id: sessionId,
    userId: chatUserId,
    projectId: chatProjectId,
    title,
    summary,
    keywords,
    lastSummaryAt: newLastSummaryAt,
    createdAt,
    updatedAt: session.updatedAt,
    messages: chatMessages,
    materials: chatMaterials,
  };

  const yaml = formatChatAsYaml(chat);
  await writeFile(existingPath, yaml, 'utf-8');
  console.log(`Saved chat history to ${existingPath}`);

  // Also save to project directory if projectId is present
  if (chatProjectId) {
    try {
      await saveProjectChat({
        id: sessionId,
        projectId: chatProjectId,
        userId: chatUserId || 'anonymous',
        title,
        summary,
        createdAt,
        updatedAt: session.updatedAt,
        messages: chatMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });
      console.log(`Saved chat to project ${chatProjectId}`);
    } catch (err) {
      console.error(`Failed to save chat to project ${chatProjectId}:`, err);
    }
  }
  }); // end withChatLock
}

/**
 * Load a chat history with access control
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID (undefined = anonymous)
 * @returns The chat if accessible, null otherwise
 *
 * Access rules:
 * - If chat has no userId (anonymous chat): accessible by everyone
 * - If chat has userId: only accessible by that user
 * - Anonymous users can only access anonymous chats
 */
export async function loadChatHistory(sessionId: string, userId?: string): Promise<ChatHistory | null> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) return null;

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);

    if (!chat) return null;

    // Access control: check if user has access to this chat
    if (chat.userId) {
      // Chat belongs to a specific user - only that user can access
      if (chat.userId !== userId) {
        console.log(`[loadChatHistory] Access denied: chat ${sessionId} belongs to ${chat.userId}, requested by ${userId || 'anonymous'}`);
        return null;
      }
    }
    // Anonymous chats (no userId) are accessible by everyone

    return chat;
  } catch (err) {
    console.error(`Error loading chat history ${sessionId}:`, err);
    return null;
  }
}

/**
 * Get the owner userId for a chat session (internal use, bypasses access check)
 * Used by background services like task executor that need to know who owns a chat
 * @param sessionId - The chat session ID
 * @returns The userId or null if chat not found or has no owner
 */
export async function getChatOwnerId(sessionId: string): Promise<string | null> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) return null;

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);
    return chat?.userId || null;
  } catch (err) {
    console.error(`Error getting chat owner ${sessionId}:`, err);
    return null;
  }
}

/**
 * Update materials for a chat
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID
 * @param materials - The updated materials array
 */
export async function updateChatMaterials(sessionId: string, userId: string, materials: ChatMaterial[]): Promise<boolean> {
  return withChatLock(sessionId, async () => {
    const chat = await loadChatHistory(sessionId, userId);
    if (!chat) return false;

    const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
    try {
      chat.materials = materials;
      chat.updatedAt = new Date().toISOString();
      const yaml = formatChatAsYaml(chat);
      await writeFile(filePath, yaml, 'utf-8');
      return true;
    } catch (err) {
      console.error(`Error updating chat materials ${sessionId}:`, err);
      return false;
    }
  });
}

/**
 * Add a single material to a chat
 */
export async function addChatMaterial(sessionId: string, userId: string, material: ChatMaterial): Promise<boolean> {
  return withChatLock(sessionId, async () => {
    const chat = await loadChatHistory(sessionId, userId);
    if (!chat) return false;

    const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
    try {
      if (!chat.materials) chat.materials = [];
      // Avoid duplicates
      if (!chat.materials.some(m => m.id === material.id)) {
        chat.materials.push(material);
      }
      chat.updatedAt = new Date().toISOString();
      const yaml = formatChatAsYaml(chat);
      await writeFile(filePath, yaml, 'utf-8');
      return true;
    } catch (err) {
      console.error(`Error adding chat material ${sessionId}:`, err);
      return false;
    }
  });
}

/**
 * Remove a material from a chat
 */
export async function removeChatMaterial(sessionId: string, userId: string, materialId: string): Promise<boolean> {
  return withChatLock(sessionId, async () => {
    const chat = await loadChatHistory(sessionId, userId);
    if (!chat) return false;

    const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
    try {
      if (chat.materials) {
        chat.materials = chat.materials.filter(m => m.id !== materialId);
      }
      chat.updatedAt = new Date().toISOString();
      const yaml = formatChatAsYaml(chat);
      await writeFile(filePath, yaml, 'utf-8');
      return true;
    } catch (err) {
      console.error(`Error removing chat material ${sessionId}:`, err);
      return false;
    }
  });
}

export interface ChatListResult {
  chats: ChatHistorySummary[];
  total: number;
  hasMore: boolean;
}

/**
 * List chat histories with access control
 * @param limit - Maximum number of chats to return
 * @param offset - Pagination offset
 * @param userId - The requesting user's ID (undefined = anonymous)
 * @returns List of accessible chats
 *
 * Access rules:
 * - If userId is provided: show user's own chats + anonymous chats
 * - If userId is undefined (anonymous): show only anonymous chats
 */
export async function listChatHistories(limit?: number, offset: number = 0, userId?: string, projectId?: string): Promise<ChatListResult> {
  if (!existsSync(CHATS_DIR)) return { chats: [], total: 0, hasMore: false };

  try {
    const files = await readdir(CHATS_DIR);
    const summaries: ChatHistorySummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);
        if (!chat) continue;

        // Filter by projectId if provided
        if (projectId) {
          // Only include chats that belong to this project
          if (chat.projectId !== projectId) continue;
        } else {
          // When not filtering by project, exclude project chats
          if (chat.projectId) continue;
        }

        // Access control filtering
        if (chat.userId) {
          // Chat belongs to a specific user
          if (userId && chat.userId === userId) {
            // User's own chat - include it
          } else {
            // Not the user's chat - skip it
            continue;
          }
        }
        // Anonymous chats (no userId) are included for everyone

        summaries.push({
          id: chat.id,
          title: chat.title,
          summary: chat.summary,
          updatedAt: chat.updatedAt,
        });
      } catch {}
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const total = summaries.length;

    // Apply pagination if limit is specified
    if (limit !== undefined) {
      const paginated = summaries.slice(offset, offset + limit);
      return {
        chats: paginated,
        total,
        hasMore: offset + limit < total,
      };
    }

    return { chats: summaries, total, hasMore: false };
  } catch (err) {
    console.error('Error listing chat histories:', err);
    return { chats: [], total: 0, hasMore: false };
  }
}

export interface ChatSearchResult extends ChatHistorySummary {
  matchedIn: 'title' | 'content';
  snippet?: string;
}

export interface ChatSearchResultWithScore extends ChatSearchResult {
  matchScore: number;
  firstMessage?: string;
  messageCount: number;
  summary?: string;
  keywords?: string[];
}

export interface ChatSearchOptions {
  query: string;
  limit?: number;
  includeMessages?: boolean;
}

export async function searchChatHistories(query: string): Promise<ChatSearchResult[]> {
  if (!query || query.length < 2) return [];
  if (!existsSync(CHATS_DIR)) return [];

  const queryLower = query.toLowerCase();
  const results: ChatSearchResult[] = [];

  try {
    const files = await readdir(CHATS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);
        if (!chat) continue;

        // Check title first
        if (chat.title.toLowerCase().includes(queryLower)) {
          results.push({
            id: chat.id,
            title: chat.title,
            updatedAt: chat.updatedAt,
            matchedIn: 'title',
          });
          continue;
        }

        // Check message contents
        for (const msg of chat.messages) {
          if (msg.content.toLowerCase().includes(queryLower)) {
            // Extract snippet around the match
            const idx = msg.content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx - 30);
            const end = Math.min(msg.content.length, idx + query.length + 30);
            let snippet = msg.content.substring(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < msg.content.length) snippet = snippet + '...';

            results.push({
              id: chat.id,
              title: chat.title,
              updatedAt: chat.updatedAt,
              matchedIn: 'content',
              snippet,
            });
            break; // One match per chat is enough
          }
        }
      } catch {}
    }

    // Sort by updatedAt descending
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return results;
  } catch (err) {
    console.error('Error searching chat histories:', err);
    return [];
  }
}

/**
 * Tokenize text into searchable tokens
 */
function tokenize(text: string): string[] {
  return text
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter((t) => t.length > 2)
    .map((t) => t.toLowerCase());
}

/**
 * Get first user message from a chat
 */
function getFirstUserMessage(chat: ChatHistory): string | undefined {
  const firstUser = chat.messages.find((m) => m.role === 'user');
  return firstUser?.content;
}

/**
 * Extract a snippet around a match
 */
function extractSnippet(content: string, query: string): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const idx = contentLower.indexOf(queryLower);

  if (idx === -1) return content.slice(0, 100);

  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + query.length + 30);
  let snippet = content.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Enhanced chat search with scoring for smart re-ranking
 *
 * Scoring weights:
 * - Title match: 10 points (exact) / 3 per token
 * - Keyword match: 8 points per keyword
 * - Summary match: 6 points
 * - Assistant message: 5 points
 * - User message: 3 points
 *
 * This function provides better scoring for search results, enabling
 * the smart search service to do effective LLM-based re-ranking.
 */
export async function searchChatHistoriesWithScoring(
  options: ChatSearchOptions
): Promise<ChatSearchResultWithScore[]> {
  const { query, limit = 50, includeMessages = false } = options;

  if (!query || query.length < 2) return [];
  if (!existsSync(CHATS_DIR)) return [];

  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(query);
  const results: ChatSearchResultWithScore[] = [];

  try {
    const files = await readdir(CHATS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);
        if (!chat) continue;

        let matchScore = 0;
        let matchedIn: 'title' | 'summary' | 'keywords' | 'content' | null = null;
        let snippet = '';

        // 1. Title matching (highest weight: 10 points exact, 3 per token)
        const titleLower = chat.title.toLowerCase();
        if (titleLower.includes(queryLower)) {
          matchScore += 10;
          matchedIn = 'title';
        } else {
          const titleTokens = tokenize(chat.title);
          const tokenOverlap = queryTokens.filter((t) => titleTokens.includes(t)).length;
          if (tokenOverlap > 0) {
            matchScore += tokenOverlap * 3;
            matchedIn = 'title';
          }
        }

        // 2. Keyword matching (8 points per keyword match)
        if (chat.keywords && chat.keywords.length > 0) {
          for (const keyword of chat.keywords) {
            const keywordLower = keyword.toLowerCase();
            if (keywordLower.includes(queryLower) || queryLower.includes(keywordLower)) {
              matchScore += 8;
              if (!matchedIn) matchedIn = 'keywords';
            } else {
              // Token-based keyword matching
              const keywordTokens = tokenize(keyword);
              const tokenOverlap = queryTokens.filter((t) => keywordTokens.includes(t)).length;
              if (tokenOverlap > 0) {
                matchScore += tokenOverlap * 4;
                if (!matchedIn) matchedIn = 'keywords';
              }
            }
          }
        }

        // 3. Summary matching (6 points)
        if (chat.summary) {
          const summaryLower = chat.summary.toLowerCase();
          if (summaryLower.includes(queryLower)) {
            matchScore += 6;
            snippet = extractSnippet(chat.summary, query);
            if (!matchedIn) matchedIn = 'summary';
          } else {
            const summaryTokens = tokenize(chat.summary);
            const tokenOverlap = queryTokens.filter((t) => summaryTokens.includes(t)).length;
            if (tokenOverlap > 0) {
              matchScore += tokenOverlap * 2;
              if (!matchedIn) matchedIn = 'summary';
            }
          }
        }

        // 4. Message content matching (5 points for assistant, 3 for user)
        for (const msg of chat.messages) {
          const msgContent = msg.content || '';
          const msgLower = msgContent.toLowerCase();

          if (msgLower.includes(queryLower)) {
            // Assistant messages are weighted higher (contain the actual answers)
            matchScore += msg.role === 'assistant' ? 5 : 3;
            if (!snippet) {
              snippet = extractSnippet(msgContent, query);
            }
            if (!matchedIn) matchedIn = 'content';
            break; // One match per chat is enough for messages
          }
        }

        if (matchScore > 0 && matchedIn) {
          results.push({
            id: chat.id,
            title: chat.title,
            updatedAt: chat.updatedAt,
            matchedIn: matchedIn === 'keywords' || matchedIn === 'summary' ? 'content' : matchedIn,
            snippet: snippet || chat.summary || undefined,
            matchScore,
            firstMessage: includeMessages ? getFirstUserMessage(chat) : undefined,
            messageCount: chat.messages.length,
            summary: chat.summary,
            keywords: chat.keywords,
          });
        }
      } catch {
        // Skip invalid chat files
      }
    }

    // Sort by score descending, then by date descending
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return results.slice(0, limit);
  } catch (err) {
    console.error('Error searching chat histories with scoring:', err);
    return [];
  }
}

/**
 * Delete a chat history with ownership check
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID (undefined = anonymous)
 * @returns true if deleted, false if not found or no access
 *
 * Access rules:
 * - If chat has no userId (anonymous): anyone can delete
 * - If chat has userId: only that user can delete
 */
export async function deleteChatHistory(sessionId: string, userId?: string): Promise<boolean> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) return false;

  try {
    // First, check ownership
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);

    if (chat && chat.userId) {
      // Chat belongs to a specific user - only that user can delete
      if (chat.userId !== userId) {
        console.log(`[deleteChatHistory] Access denied: chat ${sessionId} belongs to ${chat.userId}, delete requested by ${userId || 'anonymous'}`);
        return false;
      }
    }
    // Anonymous chats can be deleted by anyone

    await unlink(filePath);
    console.log(`Deleted chat history: ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error deleting chat history ${sessionId}:`, err);
    return false;
  }
}

/**
 * Regenerate summary for an existing chat
 * Useful for migrating old chats without summaries
 */
export async function regenerateChatSummary(sessionId: string): Promise<boolean> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) return false;

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);
    if (!chat || chat.messages.length < 2) return false;

    // Generate new summary
    const summaryResult = await generateChatSummary(chat.messages);
    if (!summaryResult) return false;

    // Update chat with new summary
    chat.title = summaryResult.title;
    chat.summary = summaryResult.summary;
    chat.keywords = summaryResult.keywords;
    chat.lastSummaryAt = chat.messages.length; // Track when we generated this summary

    // Save updated chat
    const yaml = formatChatAsYaml(chat);
    await writeFile(filePath, yaml, 'utf-8');

    console.log(`Regenerated summary for chat ${sessionId}: "${chat.title}"`);
    return true;
  } catch (err) {
    console.error(`Error regenerating summary for ${sessionId}:`, err);
    return false;
  }
}

/**
 * Regenerate summaries for all chats without summaries
 * Returns count of chats updated
 */
export async function regenerateAllMissingSummaries(): Promise<{ updated: number; errors: number }> {
  if (!existsSync(CHATS_DIR)) return { updated: 0, errors: 0 };

  let updated = 0;
  let errors = 0;

  try {
    const files = await readdir(CHATS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      try {
        const filePath = join(CHATS_DIR, file);
        const content = await readFile(filePath, 'utf-8');
        const chat = parseChatYaml(content);

        // Skip if already has summary or too few messages
        if (!chat || chat.summary || chat.messages.length < 2) continue;

        // Generate summary
        const summaryResult = await generateChatSummary(chat.messages);
        if (!summaryResult) {
          errors++;
          continue;
        }

        // Update chat
        chat.title = summaryResult.title;
        chat.summary = summaryResult.summary;
        chat.keywords = summaryResult.keywords;
        chat.lastSummaryAt = chat.messages.length;

        // Save
        const yaml = formatChatAsYaml(chat);
        await writeFile(filePath, yaml, 'utf-8');

        console.log(`Updated chat ${chat.id}: "${chat.title}"`);
        updated++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
        errors++;
      }
    }

    return { updated, errors };
  } catch (err) {
    console.error('Error regenerating summaries:', err);
    return { updated, errors };
  }
}

// ---- Chat Sharing Functions ----

import { randomBytes } from 'crypto';

/**
 * Generate a secure share token (12 characters, URL-safe)
 */
function generateShareToken(): string {
  return randomBytes(16).toString('base64url'); // 22 characters, 128 bits entropy
}

export interface ShareResult {
  success: boolean;
  shareToken?: string;
  shareUrl?: string;
  error?: string;
}

/**
 * Create a share link for a chat
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID
 * @returns ShareResult with the share URL or error
 *
 * Only the chat owner can create a share link.
 */
export async function createShareLink(sessionId: string, userId?: string): Promise<ShareResult> {
  return withChatLock(sessionId, async () => {
    const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
    if (!existsSync(filePath)) {
      return { success: false, error: 'Chat not found' };
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const chat = parseChatYaml(content);

      if (!chat) {
        return { success: false, error: 'Could not parse chat' };
      }

      // Only the owner can create a share link
      if (chat.userId && chat.userId !== userId) {
        return { success: false, error: 'Access denied' };
      }

      // If already shared, return existing token
      if (chat.shareToken) {
        return {
          success: true,
          shareToken: chat.shareToken,
          shareUrl: `/shared/${chat.shareToken}`,
        };
      }

      // Generate new share token
      const shareToken = generateShareToken();
      chat.shareToken = shareToken;
      chat.sharedAt = new Date().toISOString();
      chat.sharedBy = userId;

      // Save updated chat
      const yaml = formatChatAsYaml(chat);
      await writeFile(filePath, yaml, 'utf-8');

      return {
        success: true,
        shareToken,
        shareUrl: `/shared/${shareToken}`,
      };
    } catch (err) {
      console.error(`Error creating share link for ${sessionId}:`, err);
      return { success: false, error: 'Failed to create share link' };
    }
  });
}

/**
 * Revoke a share link for a chat
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID
 * @returns true if revoked, false otherwise
 *
 * Only the chat owner can revoke a share link.
 */
export async function revokeShareLink(sessionId: string, userId?: string): Promise<boolean> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);

    if (!chat) {
      return false;
    }

    // Only the owner can revoke a share link
    if (chat.userId && chat.userId !== userId) {
      console.log(`[revokeShareLink] Access denied: chat ${sessionId} belongs to ${chat.userId}, requested by ${userId || 'anonymous'}`);
      return false;
    }

    // If not shared, nothing to revoke
    if (!chat.shareToken) {
      return true;
    }

    // Remove share fields
    delete chat.shareToken;
    delete chat.sharedAt;
    delete chat.sharedBy;

    // Save updated chat
    const yaml = formatChatAsYaml(chat);
    await writeFile(filePath, yaml, 'utf-8');

    console.log(`[revokeShareLink] Revoked share link for chat ${sessionId}`);
    return true;
  } catch (err) {
    console.error(`Error revoking share link for ${sessionId}:`, err);
    return false;
  }
}

export interface SharedChatResult {
  id: string;
  title: string;
  summary?: string;
  sharedAt?: string;
  sharedBy?: string;
  createdAt: string;
  messages: ChatHistoryMessage[];
}

/**
 * Load a chat by share token (public access)
 * @param shareToken - The share token
 * @returns The chat (without sensitive fields) or null if not found
 */
export async function loadChatByShareToken(shareToken: string): Promise<SharedChatResult | null> {
  if (!shareToken || !existsSync(CHATS_DIR)) {
    return null;
  }

  try {
    const files = await readdir(CHATS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);

        if (chat && chat.shareToken === shareToken) {
          // Return chat without sensitive fields (userId, projectId)
          return {
            id: chat.id,
            title: chat.title,
            summary: chat.summary,
            sharedAt: chat.sharedAt,
            sharedBy: chat.sharedBy,
            createdAt: chat.createdAt,
            messages: chat.messages,
          };
        }
      } catch {
        // Skip invalid files
      }
    }

    return null;
  } catch (err) {
    console.error('Error loading chat by share token:', err);
    return null;
  }
}

/**
 * Check if a chat has an active share link
 * @param sessionId - The chat session ID
 * @param userId - The requesting user's ID
 * @returns Share info or null
 */
export async function getShareInfo(sessionId: string, userId?: string): Promise<{ shareToken: string; sharedAt: string } | null> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);

    if (!chat) {
      return null;
    }

    // Only the owner can see share info
    if (chat.userId && chat.userId !== userId) {
      return null;
    }

    if (chat.shareToken && chat.sharedAt) {
      return {
        shareToken: chat.shareToken,
        sharedAt: chat.sharedAt,
      };
    }

    return null;
  } catch (err) {
    console.error(`Error getting share info for ${sessionId}:`, err);
    return null;
  }
}

// ---- Chat Folders Functions ----

const FOLDERS_FILE = CHAT_FOLDERS_FILE;

export interface ChatFolder {
  id: string;
  name: string;
  color?: string;
  userId?: string;  // Owner of the folder
  createdAt: string;
}

/**
 * Load all chat folders (internal - no filtering)
 */
async function loadAllChatFolders(): Promise<ChatFolder[]> {
  if (!existsSync(FOLDERS_FILE)) {
    return [];
  }

  try {
    const content = await readFile(FOLDERS_FILE, 'utf-8');
    const folders: ChatFolder[] = [];

    // Parse YAML - look for folder blocks starting with "- id:"
    const lines = content.split('\n');
    let currentFolder: Partial<ChatFolder> | null = null;

    for (const line of lines) {
      // Skip empty lines and the "folders:" header
      if (!line.trim() || line.trim() === 'folders:') continue;

      // New folder starts with "- id:"
      const idMatch = line.match(/^- id:\s*"?([^"\n]+)"?/);
      if (idMatch) {
        // Save previous folder if valid
        if (currentFolder && currentFolder.id && currentFolder.name) {
          folders.push(currentFolder as ChatFolder);
        }
        currentFolder = { id: idMatch[1]?.trim() };
        continue;
      }

      // Parse folder properties
      if (currentFolder) {
        const nameMatch = line.match(/^\s+name:\s*"?([^"\n]+)"?/);
        if (nameMatch) {
          let val = nameMatch[1]?.trim() || '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          currentFolder.name = val;
          continue;
        }

        const colorMatch = line.match(/^\s+color:\s*"?([^"\n]+)"?/);
        if (colorMatch) {
          currentFolder.color = colorMatch[1]?.trim();
          continue;
        }

        const userIdMatch = line.match(/^\s+userId:\s*"?([^"\n]+)"?/);
        if (userIdMatch) {
          currentFolder.userId = userIdMatch[1]?.trim();
          continue;
        }

        const createdAtMatch = line.match(/^\s+createdAt:\s*"?([^"\n]+)"?/);
        if (createdAtMatch) {
          currentFolder.createdAt = createdAtMatch[1]?.trim();
          continue;
        }
      }
    }

    // Don't forget the last folder
    if (currentFolder && currentFolder.id && currentFolder.name) {
      folders.push(currentFolder as ChatFolder);
    }

    return folders;
  } catch (err) {
    console.error('Error loading chat folders:', err);
    return [];
  }
}

/**
 * Load chat folders for a user (filtered by ownership)
 */
export async function loadChatFolders(userId?: string): Promise<ChatFolder[]> {
  const allFolders = await loadAllChatFolders();
  // Filter by userId: show user's own folders + folders without userId (shared)
  return allFolders.filter(folder => !folder.userId || folder.userId === userId);
}

/**
 * Save all chat folders
 */
async function saveChatFolders(folders: ChatFolder[]): Promise<void> {
  const lines: string[] = ['folders:'];

  for (const folder of folders) {
    lines.push(`- id: ${escapeYamlString(folder.id)}`);
    lines.push(`  name: ${escapeYamlString(folder.name)}`);
    if (folder.color) {
      lines.push(`  color: ${escapeYamlString(folder.color)}`);
    }
    if (folder.userId) {
      lines.push(`  userId: ${escapeYamlString(folder.userId)}`);
    }
    lines.push(`  createdAt: "${folder.createdAt}"`);
  }

  await writeFile(FOLDERS_FILE, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Create a new chat folder
 */
export async function createChatFolder(name: string, userId?: string, color?: string): Promise<ChatFolder> {
  return withFoldersLock(async () => {
    const folders = await loadAllChatFolders();

    // Generate ID from name
    const id = name.toLowerCase()
      .replace(/[äöü]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[c] || c))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '_' + Date.now().toString(36);

    const folder: ChatFolder = {
      id,
      name,
      color,
      userId,
      createdAt: new Date().toISOString(),
    };

    folders.push(folder);
    await saveChatFolders(folders);

    return folder;
  });
}

/**
 * Delete a chat folder
 */
export async function deleteChatFolder(folderId: string, userId?: string): Promise<boolean> {
  return withFoldersLock(async () => {
    const allFolders = await loadAllChatFolders();
    const folder = allFolders.find(f => f.id === folderId);

    if (!folder) {
      return false;
    }

    // Check ownership
    if (folder.userId && folder.userId !== userId) {
      return false;
    }

    const remaining = allFolders.filter(f => f.id !== folderId);
    await saveChatFolders(remaining);

    return true;
  });
}

/**
 * Update chat folder assignments
 */
export async function updateChatFolders(sessionId: string, folderIds: string[], userId?: string): Promise<boolean> {
  const filePath = join(CHATS_DIR, `${sessionId}.yaml`);
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const chat = parseChatYaml(content);

    if (!chat) {
      return false;
    }

    // Check ownership
    if (chat.userId && chat.userId !== userId) {
      console.log(`[updateChatFolders] Access denied: chat ${sessionId} belongs to ${chat.userId}, requested by ${userId || 'anonymous'}`);
      return false;
    }

    // Update folder IDs
    chat.folderIds = folderIds.length > 0 ? folderIds : undefined;

    // Save updated chat
    const yaml = formatChatAsYaml(chat);
    await writeFile(filePath, yaml, 'utf-8');

    console.log(`[updateChatFolders] Updated folders for chat ${sessionId}: ${folderIds.join(', ') || '(none)'}`);
    return true;
  } catch (err) {
    console.error(`Error updating chat folders for ${sessionId}:`, err);
    return false;
  }
}

/**
 * Get folder IDs for a chat
 */
export async function getChatFolderIds(sessionId: string, userId?: string): Promise<string[]> {
  const chat = await loadChatHistory(sessionId, userId);
  return chat?.folderIds || [];
}

/**
 * List chats in a specific folder
 */
export async function listChatsInFolder(folderId: string, userId?: string): Promise<ChatHistorySummary[]> {
  if (!existsSync(CHATS_DIR)) return [];

  try {
    const files = await readdir(CHATS_DIR);
    const summaries: ChatHistorySummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);
        if (!chat) continue;

        // Access control
        if (chat.userId && chat.userId !== userId) {
          continue;
        }

        // Check if chat is in this folder
        if (chat.folderIds && chat.folderIds.includes(folderId)) {
          summaries.push({
            id: chat.id,
            title: chat.title,
            summary: chat.summary,
            updatedAt: chat.updatedAt,
          });
        }
      } catch {}
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return summaries;
  } catch (err) {
    console.error('Error listing chats in folder:', err);
    return [];
  }
}

/**
 * Get chat counts for all folders
 */
export async function getFolderChatCounts(userId?: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (!existsSync(CHATS_DIR)) return counts;

  try {
    const files = await readdir(CHATS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      try {
        const content = await readFile(join(CHATS_DIR, file), 'utf-8');
        const chat = parseChatYaml(content);
        if (!chat) continue;

        // Access control
        if (chat.userId && chat.userId !== userId) {
          continue;
        }

        // Count for each folder this chat belongs to
        if (chat.folderIds) {
          for (const folderId of chat.folderIds) {
            counts[folderId] = (counts[folderId] || 0) + 1;
          }
        }
      } catch {}
    }

    return counts;
  } catch (err) {
    console.error('Error getting folder chat counts:', err);
    return counts;
  }
}
