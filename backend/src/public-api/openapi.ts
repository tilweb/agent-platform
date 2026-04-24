/**
 * OpenAPI 3.1 spec builder for the Public-API.
 *
 * Listet alle publicFunctions aller enabled Apps als OpenAPI-Paths. Nutzt die
 * bestehenden JsonSchema-Definitionen direkt (kompatibles Subset) — keine
 * zusaetzlichen Schema-Konvertierungen noetig.
 *
 * Ausgabe unter GET /api/public/v1/openapi.json (unauth'd), damit externe
 * Integratoren ohne Key Code generieren koennen. Sensible Inhalte stehen
 * nicht drin; die Endpoints sind ohnehin nur mit Bearer-Token aufrufbar.
 */

import { getApps } from '../apps/registry';
import type { PublicFunction, JsonSchema } from './types';

export interface OpenApiSpec {
  openapi: '3.1.0';
  info: Record<string, unknown>;
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas?: Record<string, JsonSchema>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
}

function errorSchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      error: { type: 'string' },
      code: { type: 'string' },
    },
    required: ['error', 'code'],
  };
}

export async function buildOpenApiSpec(baseUrl?: string): Promise<OpenApiSpec> {
  const apps = await getApps();

  const paths: Record<string, Record<string, unknown>> = {};
  const tags: Array<{ name: string; description?: string }> = [];

  // Health (unauth'd)
  paths['/health'] = {
    get: {
      summary: 'Liveness check',
      tags: ['Meta'],
      security: [],
      responses: {
        '200': {
          description: 'Service is up',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string' }, version: { type: 'string' } },
                required: ['status', 'version'],
              },
            },
          },
        },
      },
    },
  };

  // Discovery (auth'd)
  paths['/'] = {
    get: {
      summary: 'Discover available apps and functions (scope-filtered)',
      tags: ['Meta'],
      responses: {
        '200': {
          description: 'Apps + functions callable by the authenticated key',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema() } } },
      },
    },
  };

  for (const app of apps) {
    if (!app.enabled || !Array.isArray(app.publicFunctions) || app.publicFunctions.length === 0) continue;
    tags.push({ name: app.name, description: app.description });

    for (const fn of app.publicFunctions as PublicFunction[]) {
      const path = `/${app.id}/${fn.id}`;
      paths[path] = {
        post: {
          summary: fn.description.split('.')[0] ?? fn.id,
          description: fn.description,
          tags: [app.name],
          operationId: `${app.id}__${fn.id}`,
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: fn.input },
            },
          },
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      result: fn.output ?? { type: 'object' },
                    },
                    required: ['result'],
                  },
                },
              },
            },
            '400': { description: 'Validation failed', content: { 'application/json': { schema: errorSchema() } } },
            '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema() } } },
            '403': { description: 'Key lacks permission for this function', content: { 'application/json': { schema: errorSchema() } } },
            '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: errorSchema() } } },
            '500': { description: 'Internal error', content: { 'application/json': { schema: errorSchema() } } },
          },
        },
      };
    }
  }

  const servers: Array<{ url: string; description?: string }> = [];
  if (baseUrl) servers.push({ url: baseUrl, description: 'Current host' });
  servers.push({ url: '/api/public/v1', description: 'Relative (same origin)' });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Agent Platform — Public API',
      version: 'v1',
      description:
        'Authenticated HTTP-API for app-exposed functions. Each key scoped via permissions like `app:<appId>:<functionId>`.',
    },
    servers,
    security: [{ apiKey: [] }],
    tags,
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'apk_<prefix>.<secret>',
          description: 'Admin-generated API key — see Einstellungen → API-Keys.',
        },
      },
    },
  };
}
