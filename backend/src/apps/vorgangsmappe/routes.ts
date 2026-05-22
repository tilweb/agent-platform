/**
 * Vorgangsmappe — REST API Endpoints
 *
 * Mounted at `/api/apps/vorgangsmappe` (siehe `backend/src/routes/apps.ts`).
 * Alle Endpoints verlangen App-Access (Standard-Pattern).
 */

import { Hono } from 'hono';
import { requireAppAccess } from '../permissions-middleware';
import { getCurrentUserId } from '../../auth/middleware';
import { connectionRegistry } from '../../connections';
import { loadConfig } from './config-loader';
import { freeFilterSearch, getVorgangByReference, runComplianceCheck } from './service';
import { isReferencePattern, normalizeReferenceNumber } from './reference-utils';
import { interpretQuery } from './nlu';
import { settingsRoutes } from './settings-routes';

const vorgangsmappe = new Hono();

vorgangsmappe.use('*', requireAppAccess('vorgangsmappe'));

// Settings-Routen unter /settings/...
vorgangsmappe.route('/settings', settingsRoutes);

// Loose pattern for reference path params — 1-4 Buchstaben + optional
// Ziffern-Suffix + optionaler Bindestrich + 1-6 Ziffern.
// Beispiele: V-1000, ERB-000129, AB26-12345, ABC-00000.
const REFERENCE_PARAM_REGEX = /^[A-Z]{1,4}\d{0,4}-?\d{1,6}$/i;

function statusFromError(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  if (/keine aktive docuware-verbindung/i.test(msg)) return 401;
  if (/noch nicht konfiguriert|cabinet-id.*leer/i.test(msg)) return 503;
  if (/401|403/.test(msg)) return 401;
  return 400;
}

/**
 * GET /api/apps/vorgangsmappe/config
 *
 * Liefert die aufgeloeste App-Config (Cabinet + Feld-Mapping + Default-
 * Requirement-Set). Wird vom Frontend beim Start gefetched, damit Inputs
 * passende Labels/Hints zeigen koennen.
 */
vorgangsmappe.get('/config', async (c) => {
  const cfg = await loadConfig();
  if (!cfg) {
    return c.json(
      {
        error: 'Vorgangsmappe ist noch nicht konfiguriert. Lege data/apps/vorgangsmappe/config.yaml an.',
        configured: false,
      },
      503,
    );
  }
  return c.json({ configured: true, config: cfg });
});

/**
 * GET /api/apps/vorgangsmappe/vorgaenge/:reference
 *
 * Drilldown auf einen Vorgang anhand seiner Vorgangsnummer (AB26-xxxxx).
 * Returnt alle Dokumente sortiert nach DATUM desc + (Stub-)Compliance.
 */
vorgangsmappe.get('/vorgaenge/:reference', async (c) => {
  const raw = c.req.param('reference');
  if (!raw || !REFERENCE_PARAM_REGEX.test(raw)) {
    return c.json({ error: 'Ungueltige Vorgangsnummer.' }, 400);
  }
  const userId = getCurrentUserId(c)!;
  try {
    const detail = await getVorgangByReference(userId, raw);
    return c.json(detail);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
  }
});

/**
 * GET /api/apps/vorgangsmappe/vorgaenge/:reference/compliance
 *
 * Eigenständiger Compliance-Check. Liefert ComplianceReport — optional mit
 * `?ruleSet=<id>` Override.
 */
vorgangsmappe.get('/vorgaenge/:reference/compliance', async (c) => {
  const raw = c.req.param('reference');
  const incoterm = c.req.query('incoterm');
  const geschaeftsart = c.req.query('geschaeftsart');
  if (!raw || !REFERENCE_PARAM_REGEX.test(raw)) {
    return c.json({ error: 'Ungueltige Vorgangsnummer.' }, 400);
  }
  const userId = getCurrentUserId(c)!;
  try {
    const res = await runComplianceCheck(userId, raw, { incoterm, geschaeftsart });
    return c.json(res);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
  }
});

/**
 * POST /api/apps/vorgangsmappe/search
 *
 * Strukturierte Suche per Filter-JSON. Body:
 *   { filters: [{field, values}], operation?: 'And'|'Or', count?: number }
 *
 * Der LLM-NLU-Pfad (Phase C) wird hier zusaetzlich `query: string` akzeptieren.
 * In Phase B: nur Filter-Pfad + AB-Pattern Fast-Path.
 */
vorgangsmappe.post('/search', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const userId = getCurrentUserId(c)!;

  // Fast-Path: query mit AB-Pattern → direkter Reference-Drilldown (1 Treffer)
  if (typeof body.query === 'string' && isReferencePattern(body.query)) {
    try {
      const detail = await getVorgangByReference(userId, body.query);
      return c.json({
        filters: [{ field: 'REFERENCE', values: [normalizeReferenceNumber(body.query)] }],
        interpretation: `AB-Nummer ${normalizeReferenceNumber(body.query)} erkannt — direkter Drilldown`,
        documents: detail.documents,
        vorgaenge: [
          {
            reference: detail.reference,
            documentCount: detail.documentCount,
            dateRange: detail.dateRange,
            cabinetId: detail.cabinetId,
            cabinetName: detail.cabinetName,
          },
        ],
        usedLlm: false,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
    }
  }

  // Volltext-Query via LLM-NLU
  if (typeof body.query === 'string' && body.query.trim()) {
    try {
      const cfg = await loadConfig();
      if (!cfg) {
        return c.json({ error: 'Vorgangsmappe ist noch nicht konfiguriert.' }, 503);
      }
      const tokens = await connectionRegistry.getTokens(userId, 'docuware');
      if (!tokens) {
        return c.json({ error: 'Keine aktive DocuWare-Verbindung.' }, 401);
      }
      const interp = await interpretQuery({
        query: body.query,
        apiDomain: tokens.apiDomain,
        accessToken: tokens.accessToken,
        cabinetId: cfg.cabinet.id,
        userId,
      });

      if (interp.filters.length === 0) {
        return c.json({
          filters: [],
          interpretation: interp.interpretation || 'Keine konkreten Filter erkannt.',
          documents: [],
          vorgaenge: [],
          usedLlm: interp.used_llm,
        });
      }

      const result = await freeFilterSearch(userId, interp.filters, {
        operation: interp.operation,
        count: body.count,
      });
      return c.json({
        ...result,
        interpretation: interp.interpretation,
        usedLlm: interp.used_llm,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
    }
  }

  if (!Array.isArray(body.filters) || body.filters.length === 0) {
    return c.json({ error: 'filters[] oder query ist erforderlich.' }, 400);
  }

  try {
    const result = await freeFilterSearch(userId, body.filters, {
      operation: body.operation,
      count: body.count,
    });
    return c.json({
      ...result,
      usedLlm: false,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
  }
});

/**
 * POST /api/apps/vorgangsmappe/nlu/preview
 *
 * Nur Interpretation, ohne Suche — Frontend zeigt damit Filter-Pills,
 * bevor der User Suche ausloest.
 */
vorgangsmappe.post('/nlu/preview', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const query = typeof body.query === 'string' ? body.query : '';
  if (!query.trim()) return c.json({ error: 'query ist erforderlich.' }, 400);

  const userId = getCurrentUserId(c)!;
  try {
    const cfg = await loadConfig();
    if (!cfg) return c.json({ error: 'Vorgangsmappe ist noch nicht konfiguriert.' }, 503);

    const tokens = await connectionRegistry.getTokens(userId, 'docuware');
    if (!tokens) return c.json({ error: 'Keine aktive DocuWare-Verbindung.' }, 401);

    const interp = await interpretQuery({
      query,
      apiDomain: tokens.apiDomain,
      accessToken: tokens.accessToken,
      cabinetId: cfg.cabinet.id,
      userId,
    });
    return c.json(interp);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Fehler' }, statusFromError(err) as 400 | 401 | 503);
  }
});

export { vorgangsmappe as vorgangsmappeRoutes };
