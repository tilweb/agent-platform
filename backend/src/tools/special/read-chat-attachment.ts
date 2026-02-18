/**
 * Read Chat Attachment Tool
 *
 * Allows agents to read content from chat attachments (uploaded files).
 * Used by chat-document-reader and vision-analyzer agents.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { attachmentsService } from '../../services/attachments';

export class ReadChatAttachmentTool extends LocalTool {
  constructor() {
    super({
      name: 'read_chat_attachment',
      description: 'Liest den Inhalt eines im Chat hochgeladenen Attachments. Fuer Dokumente wird der konvertierte Markdown-Text zurueckgegeben, fuer Bilder die Base64-Daten, fuer Audio die Transkription.',
      parameters: {
        type: 'object',
        properties: {
          attachment_id: {
            type: 'string',
            description: 'Die ID des Attachments (z.B. "att-1234567890-abc123")',
          },
          format: {
            type: 'string',
            enum: ['full', 'summary', 'metadata'],
            description: 'Format der Rueckgabe: "full" = vollstaendiger Inhalt (Standard), "summary" = Zusammenfassung (erste 2000 Zeichen), "metadata" = nur Metadaten',
          },
        },
        required: ['attachment_id'],
      },
      category: 'attachments',
    });
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    const { attachment_id, format = 'full' } = args;

    if (!attachment_id) {
      return JSON.stringify({
        success: false,
        error: 'attachment_id ist erforderlich',
      });
    }

    try {
      // Get attachment from service - try parentSessionId first (for delegation), then current sessionId
      const sessionIdToUse = context?.parentSessionId || context?.sessionId;
      const attachment = await attachmentsService.getAttachment(attachment_id, sessionIdToUse);

      if (!attachment) {
        return JSON.stringify({
          success: false,
          error: `Attachment "${attachment_id}" nicht gefunden`,
        });
      }

      // Metadata only
      if (format === 'metadata') {
        return JSON.stringify({
          success: true,
          attachment_id: attachment.id,
          filename: attachment.filename,
          type: attachment.type,
          mimeType: attachment.mimeType,
          size: attachment.metadata.size,
          pages: attachment.metadata.pages,
          convertedAt: attachment.metadata.convertedAt,
        });
      }

      // Document content
      if (attachment.type === 'document') {
        const content = attachment.markdownContent || '';

        if (format === 'summary') {
          const summary = content.substring(0, 2000);
          const truncated = content.length > 2000;
          return JSON.stringify({
            success: true,
            attachment_id: attachment.id,
            filename: attachment.filename,
            type: 'document',
            content: summary,
            truncated,
            totalLength: content.length,
          });
        }

        // Full content
        return JSON.stringify({
          success: true,
          attachment_id: attachment.id,
          filename: attachment.filename,
          type: 'document',
          content,
          totalLength: content.length,
        });
      }

      // Image content
      if (attachment.type === 'image') {
        return JSON.stringify({
          success: true,
          attachment_id: attachment.id,
          filename: attachment.filename,
          type: 'image',
          mimeType: attachment.mimeType,
          base64: attachment.base64Data,
        });
      }

      // Audio content (with transcription)
      if (attachment.type === 'audio') {
        const transcription = attachment.transcription || '';

        if (format === 'summary') {
          const summary = transcription.substring(0, 2000);
          const truncated = transcription.length > 2000;
          return JSON.stringify({
            success: true,
            attachment_id: attachment.id,
            filename: attachment.filename,
            type: 'audio',
            mimeType: attachment.mimeType,
            transcription: summary,
            truncated,
            totalLength: transcription.length,
          });
        }

        // Full transcription
        return JSON.stringify({
          success: true,
          attachment_id: attachment.id,
          filename: attachment.filename,
          type: 'audio',
          mimeType: attachment.mimeType,
          transcription,
          totalLength: transcription.length,
        });
      }

      return JSON.stringify({
        success: false,
        error: `Unbekannter Attachment-Typ: ${attachment.type}`,
      });
    } catch (error: any) {
      console.error(`[ReadChatAttachment] Error reading ${attachment_id}:`, error);
      return JSON.stringify({
        success: false,
        error: error.message || 'Fehler beim Lesen des Attachments',
      });
    }
  }
}
