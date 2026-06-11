/**
 * Google Docs: Dokument anlegen (optional gleich mit Text)
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { DOCS_API_BASE } from '../config';

export function createCreateDocumentTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdocs_create_document',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdocs_create_document',
          description:
            'Erstellt ein neues Google Doc im Konto des Nutzers und gibt ID und Link zurück. Optional kann direkt Text eingefügt werden. Das Dokument gehört danach dem Nutzer und kann mit gdocs_append_text / gdocs_read_document weiter bearbeitet werden.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Titel des neuen Google Docs' },
              text: { type: 'string', description: 'Optionaler Anfangstext für das Dokument' },
            },
            required: ['title'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { title, text } = args;
      if (!title) return JSON.stringify({ error: 'title is required' });
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Docs' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Google ist nicht verbunden. Bitte zuerst unter „Meine Verbindungen" verbinden.' });
      }

      const headers = {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        const createRes = await fetch(DOCS_API_BASE, {
          method: 'POST',
          headers,
          body: JSON.stringify({ title }),
        });

        if (!createRes.ok) {
          const t = await createRes.text();
          if (createRes.status === 401 || createRes.status === 403) {
            return JSON.stringify({ error: 'Google-Zugriff verweigert/abgelaufen. Bitte neu verbinden.' });
          }
          throw new Error(`Failed to create document: ${createRes.status} - ${t}`);
        }

        const doc = (await createRes.json()) as { documentId: string };

        if (text && text.length > 0) {
          await fetch(`${DOCS_API_BASE}/${doc.documentId}:batchUpdate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              requests: [{ insertText: { endOfSegmentLocation: {}, text } }],
            }),
          });
        }

        return JSON.stringify({
          documentId: doc.documentId,
          url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
          title,
        });
      } catch (error: any) {
        return JSON.stringify({ error: error.message });
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
