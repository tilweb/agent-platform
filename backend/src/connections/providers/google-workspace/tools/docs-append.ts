/**
 * Google Docs: Text ans Ende eines Dokuments anhängen (write)
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { DOCS_API_BASE } from '../config';

export function createDocsAppendTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdocs_append_text',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdocs_append_text',
          description:
            'Hängt Text ans Ende eines Google Docs an. Funktioniert nur für Dokumente, die der Agent angelegt hat oder die der Nutzer freigegeben hat.',
          parameters: {
            type: 'object',
            properties: {
              document_id: { type: 'string', description: 'Die ID des Google Docs' },
              text: { type: 'string', description: 'Der anzuhängende Text' },
            },
            required: ['document_id', 'text'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { document_id, text } = args;
      if (!document_id || !text) {
        return JSON.stringify({ error: 'document_id und text sind erforderlich' });
      }
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Docs' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Google ist nicht verbunden. Bitte zuerst unter „Meine Verbindungen" verbinden.' });
      }

      try {
        const res = await fetch(`${DOCS_API_BASE}/${document_id}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{ insertText: { endOfSegmentLocation: {}, text } }],
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          if (res.status === 401 || res.status === 403) {
            return JSON.stringify({
              error:
                'Zugriff verweigert. Token abgelaufen (neu verbinden) oder Dokument nicht vom Agenten angelegt/freigegeben (drive.file-Scope).',
            });
          }
          throw new Error(`Failed to append text: ${res.status} - ${t}`);
        }

        return JSON.stringify({ ok: true, appendedChars: text.length });
      } catch (error: any) {
        return JSON.stringify({ error: error.message });
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
