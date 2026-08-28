/**
 * Read Chat Attachment Tool
 *
 * Allows agents to read content from chat attachments (uploaded files).
 * Used by chat-document-reader and vision-analyzer agents.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { attachmentsService } from '../../services/attachments';

// Levenshtein-Distanz für die Tippfehler-Korrektur von attachment_ids: LLMs
// verdrehen beim Abtippen langer IDs gelegentlich einzelne Zeichen. Ein
// eindeutiger naher Kandidat wird automatisch aufgeloest statt hart zu failen.
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n)];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n]!;
}

const ID_CORRECTION_MAX_DISTANCE = 3;

export class ReadChatAttachmentTool extends LocalTool {
  constructor() {
    super({
      name: 'read_chat_attachment',
      description: 'Liest den Inhalt eines im Chat hochgeladenen Attachments. Fuer Dokumente wird der konvertierte Markdown-Text zurueckgegeben, fuer Bilder die Base64-Daten, fuer Audio die Transkription. Mit format "list" (ohne attachment_id) werden alle Attachments des Chats mit ihren IDs aufgelistet.',
      parameters: {
        type: 'object',
        properties: {
          attachment_id: {
            type: 'string',
            description: 'Die ID des Attachments (z.B. "att-1234567890-abc123"). Nicht noetig bei format "list".',
          },
          format: {
            type: 'string',
            enum: ['full', 'summary', 'metadata', 'list'],
            description: 'Format der Rueckgabe: "full" = vollstaendiger Inhalt (Standard), "summary" = Zusammenfassung (erste 2000 Zeichen), "metadata" = nur Metadaten, "list" = alle Attachments dieses Chats auflisten (keine attachment_id noetig)',
          },
        },
        required: [],
      },
      category: 'attachments',
    });
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    const { attachment_id, format = 'full' } = args;

    // List-Modus: alle Attachments der Chat-Session aufzaehlen — Discovery-
    // Fallback, wenn dem Agent keine attachment_id (mehr) vorliegt.
    const listSessionId = context?.parentSessionId || context?.sessionId;
    if (format === 'list' || !attachment_id) {
      if (!listSessionId) {
        return JSON.stringify({
          success: false,
          error: 'Keine Chat-Session im Kontext — Auflistung nicht moeglich',
        });
      }
      try {
        const attachments = await attachmentsService.getSessionAttachments(listSessionId);
        return JSON.stringify({
          success: true,
          count: attachments.length,
          attachments: attachments.map(att => ({
            attachment_id: att.id,
            filename: att.filename,
            type: att.type,
            mimeType: att.mimeType,
            size: att.metadata.size,
            pages: att.metadata.pages,
            uploadedAt: att.metadata.convertedAt,
            hasAnalysis: Boolean(att.analysis),
          })),
        });
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || 'Fehler beim Auflisten der Attachments',
        });
      }
    }

    try {
      // Get attachment from service - try parentSessionId first (for delegation), then current sessionId
      const sessionIdToUse = context?.parentSessionId || context?.sessionId;
      let attachment = await attachmentsService.getAttachment(attachment_id, sessionIdToUse);
      let correctedFrom: string | undefined;

      // Nicht gefunden: Tippfehler-Korrektur gegen die Session-Attachments.
      // Ein EINDEUTIGER naher Kandidat (Distanz <= 3, kein Gleichstand) wird
      // automatisch aufgeloest; sonst kommt der Fehler mit der Liste der
      // verfuegbaren Attachments zurueck, damit sich das Modell in einem
      // Schritt selbst korrigieren kann.
      if (!attachment && sessionIdToUse) {
        const sessionAttachments = await attachmentsService.getSessionAttachments(sessionIdToUse);
        if (sessionAttachments.length > 0) {
          const ranked = sessionAttachments
            .map(att => ({ att, distance: editDistance(att.id, attachment_id) }))
            .sort((a, b) => a.distance - b.distance);
          const best = ranked[0]!;
          const runnerUp = ranked[1];
          if (best.distance <= ID_CORRECTION_MAX_DISTANCE && (!runnerUp || runnerUp.distance > best.distance)) {
            attachment = best.att;
            correctedFrom = attachment_id;
            console.log(`[ReadChatAttachment] ID auto-korrigiert: "${attachment_id}" -> "${best.att.id}" (Distanz ${best.distance})`);
          } else {
            return JSON.stringify({
              success: false,
              error: `Attachment "${attachment_id}" nicht gefunden`,
              hint: 'Verfuegbare Attachments in diesem Chat — nutze exakt eine dieser IDs:',
              attachments: sessionAttachments.map(att => ({
                attachment_id: att.id,
                filename: att.filename,
                type: att.type,
              })),
            });
          }
        }
      }

      if (!attachment) {
        return JSON.stringify({
          success: false,
          error: `Attachment "${attachment_id}" nicht gefunden`,
        });
      }

      // Erfolgs-Antworten ggf. um den Korrektur-Hinweis ergaenzen
      const resolved = attachment;
      const respond = (payload: Record<string, any>): string => JSON.stringify(
        correctedFrom
          ? { ...payload, note: `attachment_id "${correctedFrom}" war fehlerhaft — automatisch aufgeloest zu "${resolved.id}"` }
          : payload,
      );

      // Metadata only
      if (format === 'metadata') {
        return respond({
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
          return respond({
            success: true,
            attachment_id: attachment.id,
            filename: attachment.filename,
            type: 'document',
            content: summary,
            truncated,
            totalLength: content.length,
          });
        }

        // Full content — Hard-Cap, sonst kollidiert das Tool-Result mit dem
        // Modell-Context-Limit (Qwen 30B 128k → ~480k Zeichen Marge inkl.
        // System-Prompt + History). Bei 200k-Token-PDFs (>800k Zeichen) wuerden
        // wir sonst 413 vom Provider bekommen.
        const FULL_CAP = 360 * 1024; // 360k chars ≈ 90k Tokens
        if (content.length > FULL_CAP) {
          return respond({
            success: true,
            attachment_id: attachment.id,
            filename: attachment.filename,
            type: 'document',
            content: content.substring(0, FULL_CAP) + `\n\n[... Dokument wurde nach ${FULL_CAP} Zeichen gekuerzt — Originallaenge: ${content.length}. Nutze die Pre-Analysis im System-Prompt fuer den Rest, oder rufe das Tool mit format: "summary" auf.]`,
            truncated: true,
            totalLength: content.length,
            cap: FULL_CAP,
          });
        }
        return respond({
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
        return respond({
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
          return respond({
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
        return respond({
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
