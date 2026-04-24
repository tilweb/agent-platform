/**
 * Public-API router — mounts under /api/public/v1.
 *
 * Endpoints:
 *   GET  /health                        — unauth'd ok-check
 *   GET  /                              — auth'd, scope-filtered discovery
 *   POST /:appId/:functionId            — auth'd + scope-checked + rate-limited function dispatch
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getApps } from '../apps/registry';
import type { AppConfig } from '../apps/types';
import type { PublicFunction, PublicFunctionContext, ApiKey } from './types';
import { scopeMatches, validate } from './validator';
import { apiKeyAuth, apiKeyRateLimit } from './middleware';
import { writeAudit } from './audit';

const router = new Hono();

router.get('/health', (c) => c.json({ status: 'ok', version: 'v1' }));

/**
 * Discovery — returns apps + functions that the authenticated key may call.
 * Scope-filtered: only visible what `permissions` allow.
 */
router.get('/', apiKeyAuth, async (c) => {
  const key = c.get('apiKey');
  const apps = await getApps();

  const payload = apps
    .filter(app => app.enabled && Array.isArray(app.publicFunctions) && app.publicFunctions.length > 0)
    .map(app => ({
      app,
      functions: (app.publicFunctions as PublicFunction[]).filter(fn =>
        scopeMatches(`app:${app.id}:${fn.id}`, key.permissions),
      ),
    }))
    .filter(({ functions }) => functions.length > 0)
    .map(({ app, functions }) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      version: app.version,
      functions: functions.map(fn => ({
        id: fn.id,
        description: fn.description,
        path: `/api/public/v1/${app.id}/${fn.id}`,
        method: 'POST',
        input: fn.input,
        output: fn.output,
        rateLimit: fn.defaultRateLimit ?? { requests: key.rateLimit.requests, windowSec: key.rateLimit.windowSec },
      })),
    }));

  return c.json({ version: 'v1', apps: payload });
});

/**
 * Function dispatch. We run apiKeyAuth first to populate c.apiKey, then do
 * scope-check + function-resolve + rate-limit + validation + handler.
 * Wrapped so every exit path writes an audit entry.
 */
router.post('/:appId/:functionId', apiKeyAuth, async (c) => {
  const appId = c.req.param('appId');
  const functionId = c.req.param('functionId');
  const key = c.get('apiKey');
  const started = Date.now();
  const requestId = c.get('requestId');

  const finish = async (status: number, body: Record<string, unknown>, errorCode?: string) => {
    await writeAudit({
      timestamp: new Date().toISOString(),
      requestId,
      apiKeyId: key?.id ?? null,
      scopeType: key?.scope.type ?? null,
      scopeId: scopeIdentifier(key),
      method: 'POST',
      path: c.req.path,
      appId,
      functionId,
      status,
      errorCode,
      durationMs: Date.now() - started,
    });
    return c.json(body, status as 200 | 400 | 401 | 403 | 404 | 429 | 500);
  };

  // scope
  if (!scopeMatches(`app:${appId}:${functionId}`, key.permissions)) {
    return finish(403, { error: 'Key lacks permission for this function', code: 'scope_denied' }, 'scope_denied');
  }

  // resolve function
  const fn = await resolveFunction(appId, functionId);
  if (!fn) {
    return finish(404, { error: `Function not found: ${appId}.${functionId}`, code: 'not_found' }, 'not_found');
  }

  // rate-limit (per-key, per-function)
  const rl = apiKeyRateLimit(appId, functionId);
  const rateResult = await runMiddleware(c, rl);
  if (rateResult) return rateResult; // already-finished rate-limit response; audit written below
  // If rate-limit did not short-circuit, continue.

  // body + validate
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return finish(400, { error: 'Invalid JSON body', code: 'validation_failed' }, 'validation_failed');
  }
  const errors = validate(body, fn.input);
  if (errors.length > 0) {
    return finish(400, { error: 'Validation failed', code: 'validation_failed', details: errors }, 'validation_failed');
  }

  // handler
  try {
    const ctx: PublicFunctionContext = {
      apiKeyId: key.id,
      scope: key.scope,
      permissions: key.permissions,
      requestId,
    };
    const result = await fn.handler(body, ctx);
    return finish(200, { result });
  } catch (err) {
    console.error(`[public-api] handler ${appId}.${functionId} failed:`, err);
    return finish(500, { error: 'Internal error', code: 'internal_error' }, 'internal_error');
  }
});

async function resolveFunction(appId: string, functionId: string): Promise<PublicFunction | null> {
  const apps = await getApps();
  const app = apps.find(a => a.id === appId && a.enabled) as AppConfig | undefined;
  if (!app || !Array.isArray(app.publicFunctions)) return null;
  return (app.publicFunctions as PublicFunction[]).find(f => f.id === functionId) ?? null;
}

function scopeIdentifier(key: ApiKey | undefined): string | null {
  if (!key) return null;
  if (key.scope.type === 'service') return key.scope.serviceName ?? null;
  if (key.scope.type === 'org') return key.scope.orgId ?? null;
  if (key.scope.type === 'user') return key.scope.userId ?? null;
  return null;
}

/**
 * Run a middleware and return the short-circuit Response if it wrote one,
 * otherwise undefined. Used for rate-limit which writes response headers.
 */
async function runMiddleware(c: Context, mw: ReturnType<typeof apiKeyRateLimit>): Promise<Response | undefined> {
  let nextCalled = false;
  const res = await mw(c, async () => { nextCalled = true; });
  if (!nextCalled && res) return res as Response;
  return undefined;
}

export { router as publicApiRouter };
