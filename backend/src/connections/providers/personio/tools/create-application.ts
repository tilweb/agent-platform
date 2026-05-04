/**
 * Personio Create Application Tool (v1).
 *
 * POST https://api.personio.de/v1/recruiting/applications
 *   Header: Authorization: Bearer <v1-recruiting-token>, X-Company-ID: <id>
 *   Body:   JSON mit candidate (first_name, last_name, email), job_position_id,
 *           optional phase, message, source_id.
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { PERSONIO_API_BASE } from '../config';

export function createCreateApplicationTool(providerId: string): ConnectionTool {
  return {
    name: 'personio_create_application',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'personio_create_application',
          description:
            'Legt eine neue Bewerbung in Personio an (v1 Recruiting-API). Benoetigt v1-Recruiting-Token und Company-ID in der Connection.',
          parameters: {
            type: 'object',
            properties: {
              first_name: { type: 'string', description: 'Vorname des Bewerbers.' },
              last_name: { type: 'string', description: 'Nachname des Bewerbers.' },
              email: { type: 'string', description: 'E-Mail des Bewerbers.' },
              job_position_id: {
                type: ['string', 'integer'],
                description: 'Personio Job-Position-ID.',
              },
              phase: {
                type: 'string',
                description: 'Optional: Initial-Phase (z.B. "unassigned", "rejected", "offer", "accepted") oder Custom-Phase-Name.',
              },
              message: {
                type: 'string',
                description: 'Optional: Bewerber-Anschreiben/Notiz.',
              },
              source_id: {
                type: ['string', 'integer'],
                description: 'Optional: Recruiting-Source-ID (z.B. interner Job-Board-Identifier).',
              },
            },
            required: ['first_name', 'last_name', 'email', 'job_position_id'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      if (!context?.userId) {
        return 'Error: User authentication required to use Personio.';
      }
      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Not connected to Personio. Please connect first in the Connections page.';
      }
      if (!tokens.secondaryAccessToken || !tokens.companyId) {
        return 'Error: Diese Personio-Connection hat keinen v1-Recruiting-Token / keine Company-ID hinterlegt. Reconnect mit Token + Company-ID, oder benutze stattdessen das Lese-Tool.';
      }

      const body: Record<string, any> = {
        candidate: {
          first_name: args.first_name,
          last_name: args.last_name,
          email: args.email,
        },
        job_position_id: args.job_position_id,
      };
      if (args.phase) body.phase = { name: String(args.phase) };
      if (args.message) body.message = args.message;
      if (args.source_id) body.source_id = args.source_id;

      try {
        const response = await fetch(`${PERSONIO_API_BASE}/v1/recruiting/applications`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.secondaryAccessToken}`,
            'X-Company-ID': tokens.companyId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.status === 401 || response.status === 403) {
          return 'Error: Personio v1 access denied. v1-Token ungueltig oder fehlt.';
        }
        if (!response.ok) {
          const text = await response.text();
          return `Error: Personio v1 POST failed: ${response.status} - ${text}`;
        }

        const data = (await response.json()) as Record<string, any>;
        const id = data.id || data.application_id || data.data?.id || '?';
        return `Bewerbung angelegt: ID ${id}\n\n${JSON.stringify(data, null, 2)}`;
      } catch (error: any) {
        console.error('Personio create application error:', error);
        return `Error creating Personio application: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
