/**
 * Personio List Applications Tool (v2 Beta).
 *
 * GET https://api.personio.de/v2/recruiting/applications
 *   Header: Authorization: Bearer <v2-token>, Beta: true
 *   Query:  limit (1-200, default 100), cursor, candidate.email,
 *           updated_at.gt, updated_at.lt
 */

import type { ToolDefinition, ToolContext } from '../../../../tools/types';
import type { ConnectionTool } from '../../../types';
import { connectionRegistry } from '../../../registry';
import { PERSONIO_API_BASE } from '../config';

export function createListApplicationsTool(providerId: string): ConnectionTool {
  return {
    name: 'personio_list_applications',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'personio_list_applications',
          description:
            'Listet Personio-Bewerbungen (sortiert nach updatedAt absteigend). Filterbar nach Bewerber-E-Mail oder Update-Zeitfenster.',
          parameters: {
            type: 'object',
            properties: {
              limit: {
                type: 'integer',
                description: 'Anzahl Eintraege (1-200, Default 100).',
                minimum: 1,
                maximum: 200,
              },
              candidate_email: {
                type: 'string',
                description: 'Optional: Filter auf eine konkrete Bewerber-E-Mail.',
              },
              updated_after: {
                type: 'string',
                description: 'Optional: ISO-8601 Datum/Zeit. Nur Bewerbungen die danach aktualisiert wurden.',
              },
              updated_before: {
                type: 'string',
                description: 'Optional: ISO-8601 Datum/Zeit. Nur Bewerbungen die davor aktualisiert wurden.',
              },
              cursor: {
                type: 'string',
                description: 'Optional: Pagination-Cursor aus einer vorherigen Antwort.',
              },
            },
            required: [],
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

      const params = new URLSearchParams();
      if (args.limit) params.set('limit', String(args.limit));
      if (args.candidate_email) params.set('candidate.email', String(args.candidate_email));
      if (args.updated_after) params.set('updated_at.gt', String(args.updated_after));
      if (args.updated_before) params.set('updated_at.lt', String(args.updated_before));
      if (args.cursor) params.set('cursor', String(args.cursor));

      const url = `${PERSONIO_API_BASE}/v2/recruiting/applications${params.toString() ? `?${params}` : ''}`;

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
            Accept: 'application/json',
            Beta: 'true',
          },
        });

        if (response.status === 401 || response.status === 403) {
          return 'Error: Personio access denied. Token expired or scope missing.';
        }
        if (!response.ok) {
          const text = await response.text();
          return `Error: Personio v2 request failed: ${response.status} - ${text}`;
        }

        const data = (await response.json()) as Record<string, any>;
        const applications: any[] = data._data || data.data || [];
        const nextCursor =
          data._meta?.cursor?.next ||
          data.meta?.cursor?.next ||
          null;

        if (applications.length === 0) {
          return 'No applications found for the given filters.';
        }

        let output = `Found ${applications.length} application(s)`;
        if (nextCursor) output += ` (more available — pass cursor=${nextCursor} for next page)`;
        output += `:\n\n`;

        for (const app of applications) {
          const candidate = app.candidate || {};
          const job = app.job || {};
          const channel = app.channel || {};
          const stage = app.current_stage || {};
          const createdAt = app.created_at?.['date-time'] || app.created_at?.date_time || app.created_at;
          const updatedAt = app.updated_at?.['date-time'] || app.updated_at?.date_time || app.updated_at;

          const fullName = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').trim() || '(anonym)';
          output += `### ${fullName}\n`;
          if (app.id) output += `- **Application-ID**: ${app.id}\n`;
          if (candidate.email) output += `- **Email**: ${candidate.email}\n`;
          if (candidate.id) output += `- **Candidate-ID**: ${candidate.id}\n`;
          if (job.name || job.title) output += `- **Position**: ${job.name || job.title}\n`;
          if (job.department?.name) output += `- **Abteilung**: ${job.department.name}\n`;
          if (stage.name) output += `- **Stage**: ${stage.name}${stage.kind ? ` (${stage.kind})` : ''}\n`;
          if (channel.name) output += `- **Channel**: ${channel.name}\n`;
          if (app.application_date) output += `- **Bewerbungsdatum**: ${app.application_date}\n`;
          if (createdAt) output += `- **Eingegangen**: ${createdAt}\n`;
          if (updatedAt && updatedAt !== createdAt) output += `- **Letztes Update**: ${updatedAt}\n`;
          if (app.is_anonymized) output += `- _DSGVO-anonymisiert_\n`;
          output += `\n`;
        }

        return output;
      } catch (error: any) {
        console.error('Personio list applications error:', error);
        return `Error listing Personio applications: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
