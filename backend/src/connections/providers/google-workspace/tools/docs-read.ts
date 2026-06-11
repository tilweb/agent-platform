/**
 * Google Docs: Dokumentinhalt als Text lesen
 */

import type { ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { DOCS_API_BASE } from '../config';

/** Extrahiert den reinen Text aus der Google-Docs-Body-Struktur. */
function extractText(body: any): string {
  const parts: string[] = [];
  const content = body?.content ?? [];
  for (const el of content) {
    const elements = el?.paragraph?.elements ?? [];
    for (const e of elements) {
      const t = e?.textRun?.content;
      if (typeof t === 'string') parts.push(t);
    }
  }
  return parts.join('');
}

export function createDocsReadTool(providerId: string): ConnectionTool {
  return {
    type: 'connection',
    providerId,
    name: 'gdocs_read_document',

    getDefinition() {
      return {
        type: 'function',
        function: {
          name: 'gdocs_read_document',
          description:
            'Liest den Textinhalt eines Google Docs. Funktioniert nur für Dokumente, die der Agent angelegt hat oder die der Nutzer freigegeben hat.',
          parameters: {
            type: 'object',
            properties: {
              document_id: { type: 'string', description: 'Die ID des Google Docs' },
            },
            required: ['document_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext) {
      const { document_id } = args;
      if (!document_id) return JSON.stringify({ error: 'document_id is required' });
      if (!context?.userId) {
        return JSON.stringify({ error: 'User authentication required to use Google Docs' });
      }

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return JSON.stringify({ error: 'Google ist nicht verbunden. Bitte zuerst unter „Meine Verbindungen" verbinden.' });
      }

      try {
        const res = await fetch(`${DOCS_API_BASE}/${document_id}`, {
          headers: { Authorization: `${tokens.tokenType} ${tokens.accessToken}` },
        });

        if (!res.ok) {
          const t = await res.text();
          if (res.status === 401 || res.status === 403) {
            return JSON.stringify({
              error:
                'Zugriff verweigert. Token abgelaufen (neu verbinden) oder Dokument nicht vom Agenten angelegt/freigegeben (drive.file-Scope).',
            });
          }
          throw new Error(`Failed to read document: ${res.status} - ${t}`);
        }

        const doc = (await res.json()) as { title?: string; body?: any };
        let content = extractText(doc.body);
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        if (truncated) content = content.substring(0, maxLength) + '\n\n[Inhalt gekürzt...]';

        return JSON.stringify({
          documentId: document_id,
          title: doc.title,
          content,
          truncated,
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
