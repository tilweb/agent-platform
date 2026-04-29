import { pgSchema, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

export const chatSchema = pgSchema('chat');

export const chatFolders = chatSchema.table('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  parentId: text('parent_id'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('chat_folders_user_idx').on(t.userId),
}));

export const chats = chatSchema.table('chats', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  summary: text('summary'),
  keywords: jsonb('keywords'),                      // string[]
  agentId: text('agent_id'),
  projectId: text('project_id'),                    // optional: Chat ist projekt-gescoped
  shareToken: text('share_token'),                  // null = nicht geteilt
  sharedAt: timestamp('shared_at', { withTimezone: true, mode: 'string' }),
  metadata: jsonb('metadata'),                      // model, provider, materials, lastError, ...
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('chats_user_idx').on(t.userId),
  projectIdx: index('chats_project_idx').on(t.projectId),
  shareIdx: index('chats_share_idx').on(t.shareToken),
  updatedIdx: index('chats_updated_idx').on(t.updatedAt),
}));

/**
 * Chat-Folder-Memberships (n:m). Eine Chat-Session kann in mehreren Foldern
 * sein (UI erlaubt Multi-Tagging).
 */
export const chatFolderMembers = chatSchema.table('folder_members', {
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').notNull().references(() => chatFolders.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  chatIdx: index('chat_folder_members_chat_idx').on(t.chatId),
  folderIdx: index('chat_folder_members_folder_idx').on(t.folderId),
}));

export const messages = chatSchema.table('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),                     // user | assistant | system | tool
  content: jsonb('content').notNull(),              // string oder ContentPart[]
  toolCalls: jsonb('tool_calls'),
  toolCallId: text('tool_call_id'),
  name: text('name'),
  metadata: jsonb('metadata'),                      // streaming chunks, agentId, etc.
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  chatIdx: index('messages_chat_idx').on(t.chatId, t.createdAt),
}));

export const chatAttachments = chatSchema.table('attachments', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id'),
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  s3Key: text('s3_key').notNull(),                  // S3-Pfad zum Binary
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index('attachments_session_idx').on(t.sessionId),
}));
