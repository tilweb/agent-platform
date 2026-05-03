/**
 * Attachment Routes
 * Handles retrieval and streaming of chat attachments
 */

import { Hono } from 'hono';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { attachmentsService } from '../services/attachments';
import { loadChatHistory } from '../services/memory';
import { validationError, notFoundError, internalError } from '../utils/errorHandler';
import { authMiddleware, getCurrentUserId } from '../auth';
import { contentDispositionHeader } from '../utils/contentDisposition';

const attachmentRoutes = new Hono();

/**
 * GET /api/chats/:chatId/attachments/:attachmentId
 * Retrieve an attachment file (for documents and images)
 * Note: No auth middleware - links opened in new tabs don't send cookies.
 * Security: Attachment IDs are random and unguessable.
 */
attachmentRoutes.get('/:chatId/attachments/:attachmentId', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const attachmentId = c.req.param('attachmentId');

    // Validate IDs
    if (!chatId || !/^[a-zA-Z0-9_-]+$/.test(chatId)) {
      return validationError(c, 'Ungültige Chat-ID');
    }
    if (!attachmentId || !/^att-[a-zA-Z0-9_-]+$/.test(attachmentId)) {
      return validationError(c, 'Ungültige Attachment-ID');
    }

    // Get attachment file path
    const fileInfo = await attachmentsService.getAttachmentFilePath(attachmentId, chatId);
    if (!fileInfo) {
      return notFoundError(c, 'Attachment');
    }

    // Read and return file
    const fileBuffer = await readFile(fileInfo.path);

    c.header('Content-Type', fileInfo.mimeType);
    c.header('Content-Disposition', contentDispositionHeader(fileInfo.filename, fileInfo.mimeType));
    c.header('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    return c.body(fileBuffer);
  } catch (error) {
    console.error('[Attachments] Error retrieving attachment:', error);
    return internalError(c, error, { operation: 'get_attachment' });
  }
});

/**
 * GET /api/chats/:chatId/attachments/:attachmentId/stream
 * Stream an attachment (for audio files with range support)
 * Note: No auth middleware - audio/video elements don't send cookies.
 * Security: Attachment IDs are random and unguessable.
 */
attachmentRoutes.get('/:chatId/attachments/:attachmentId/stream', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const attachmentId = c.req.param('attachmentId');

    // Validate IDs
    if (!chatId || !/^[a-zA-Z0-9_-]+$/.test(chatId)) {
      return validationError(c, 'Ungültige Chat-ID');
    }
    if (!attachmentId || !/^att-[a-zA-Z0-9_-]+$/.test(attachmentId)) {
      return validationError(c, 'Ungültige Attachment-ID');
    }

    // Get attachment file path
    const fileInfo = await attachmentsService.getAttachmentFilePath(attachmentId, chatId);
    if (!fileInfo) {
      return notFoundError(c, 'Attachment');
    }

    // Get file stats for range requests
    const fileStats = await stat(fileInfo.path);
    const fileSize = fileStats.size;

    // Handle range request for audio seeking
    const rangeHeader = c.req.header('Range');

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]!, 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

        if (start >= fileSize) {
          return c.text('Range Not Satisfiable', 416);
        }

        const chunkSize = end - start + 1;

        // Read the specific range
        const fileBuffer = await readFile(fileInfo.path);
        const chunk = fileBuffer.subarray(start, end + 1);

        c.status(206); // Partial Content
        c.header('Content-Type', fileInfo.mimeType);
        c.header('Content-Length', chunkSize.toString());
        c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        c.header('Accept-Ranges', 'bytes');
        c.header('Cache-Control', 'private, max-age=3600');

        return c.body(chunk);
      }
    }

    // No range request - return full file
    const fileBuffer = await readFile(fileInfo.path);

    c.header('Content-Type', fileInfo.mimeType);
    c.header('Content-Length', fileSize.toString());
    c.header('Accept-Ranges', 'bytes');
    c.header('Cache-Control', 'private, max-age=3600');

    return c.body(fileBuffer);
  } catch (error) {
    console.error('[Attachments] Error streaming attachment:', error);
    return internalError(c, error, { operation: 'stream_attachment' });
  }
});

/**
 * GET /api/chats/:chatId/attachments/:attachmentId/metadata
 * Get attachment metadata without downloading the file
 */
attachmentRoutes.get('/:chatId/attachments/:attachmentId/metadata', authMiddleware, async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const attachmentId = c.req.param('attachmentId');
    const userId = getCurrentUserId(c);

    // Validate IDs
    if (!chatId || !/^[a-zA-Z0-9_-]+$/.test(chatId)) {
      return validationError(c, 'Ungültige Chat-ID');
    }
    if (!attachmentId || !/^att-[a-zA-Z0-9_-]+$/.test(attachmentId)) {
      return validationError(c, 'Ungültige Attachment-ID');
    }

    // Verify user has access to this chat
    const chat = await loadChatHistory(chatId, userId);
    if (!chat) {
      return notFoundError(c, 'Chat');
    }

    // Get attachment metadata
    const metadata = await attachmentsService.getAttachmentMetadata(attachmentId, chatId);
    if (!metadata) {
      return notFoundError(c, 'Attachment');
    }

    return c.json(metadata);
  } catch (error) {
    console.error('[Attachments] Error getting attachment metadata:', error);
    return internalError(c, error, { operation: 'get_attachment_metadata' });
  }
});

export { attachmentRoutes };
