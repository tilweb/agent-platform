/**
 * Docuware-spezifische Sub-Routen unter /api/connections/docuware
 *
 * Read-only Proxy-Routen fuer Viewer-/Thumbnail-Use-Cases:
 *   - GET /cabinets/:cabinetId/documents/:docId/thumbnail
 *   - GET /cabinets/:cabinetId/documents/:docId/pages/:pageNum
 *   - GET /cabinets/:cabinetId/documents/:docId/file
 *
 * Alle Routen:
 *   - benoetigen User-Authentifizierung (Session-Cookie),
 *   - holen das User-Token via connectionRegistry,
 *   - rufen die DocuWare Platform-API serverseitig auf,
 *   - streamen das Binary an den Client zurueck (Content-Type
 *     uebernommen),
 *   - probieren bei 404/415 den Section-Level-Pfad als Fallback,
 *     wenn keine section_id mitgegeben wurde.
 *
 * Sicherheit: kein Token wird ans Frontend exposed. Cabinet- und Doc-IDs
 * werden gegen ein konservatives Pattern validiert. Path-Traversal ist
 * durch das Pattern + encodeURIComponent in den DocuWare-URL-Helpern
 * ausgeschlossen.
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth';
import { connectionRegistry } from '../connections';
import {
  getDocumentPageImageUrl,
  getDocumentThumbnailUrl,
  getDocumentFileDownloadUrl,
  getDocumentSectionsUrl,
  getFieldSelectListUrl,
} from '../connections/providers/docuware/config';
import { resolveSearchDialog } from '../connections/providers/docuware/dialogs';
import { executeStructuredSearch } from '../connections/providers/docuware/search';

const docuwareRoutes = new Hono();

// IDs are typically GUIDs (cabinet) or numeric (doc), but we accept any
// safe identifier shape to stay forwards-compatible.
const SAFE_ID = /^[A-Za-z0-9_.\-:]{1,128}$/;
const SAFE_SECTION_ID = /^[A-Za-z0-9_.\-:]{1,256}$/;
const MAX_PAGE = 2000;

/**
 * Resolve the first section ID of a document. Used as fallback when the
 * doc-level image/thumbnail endpoint is unsupported and the caller did not
 * provide an explicit section_id.
 */
async function resolveFirstSectionId(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(getDocumentSectionsUrl(apiDomain, cabinetId, documentId), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const sections = data.Section || data.Sections || data.section || data.sections || [];
    if (!Array.isArray(sections) || sections.length === 0) return null;
    const id = sections[0].Id || sections[0].id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/**
 * Proxy a binary response from DocuWare back to the client.
 */
async function proxyBinary(
  c: any,
  upstreamUrl: string,
  accessToken: string,
  fallbackContentType: string,
  cacheControl: string,
): Promise<Response> {
  const upstream = await fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: fallbackContentType + ',*/*',
    },
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    if (upstream.status === 401 || upstream.status === 403) {
      return c.json({ error: 'Docuware access denied — please reconnect.' }, 401);
    }
    if (upstream.status === 404) {
      return c.json({ error: 'Not found in Docuware', detail: text }, 404);
    }
    return c.json({ error: `Docuware upstream error: ${upstream.status}`, detail: text }, 502);
  }

  const buffer = await upstream.arrayBuffer();
  const ct = upstream.headers.get('content-type') || fallbackContentType;

  c.header('Content-Type', ct);
  c.header('Content-Length', buffer.byteLength.toString());
  c.header('Cache-Control', cacheControl);
  return c.body(buffer);
}

/**
 * Helper: get tokens or return 401.
 */
async function getDocuwareTokensOr401(c: any) {
  const userId = getCurrentUserId(c);
  if (!userId) return { error: c.json({ error: 'Unauthorized' }, 401) };
  const tokens = await connectionRegistry.getTokens(userId, 'docuware');
  if (!tokens) {
    return { error: c.json({ error: 'Not connected to Docuware' }, 401) };
  }
  return { tokens };
}

/**
 * GET /api/connections/docuware/cabinets/:cabinetId/documents/:docId/thumbnail
 * Optional: ?section_id=...
 */
docuwareRoutes.get(
  '/cabinets/:cabinetId/documents/:docId/thumbnail',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');
    const docId = c.req.param('docId');
    const sectionQ = c.req.query('section_id');

    if (!SAFE_ID.test(cabinetId) || !SAFE_ID.test(docId)) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    if (sectionQ && !SAFE_SECTION_ID.test(sectionQ)) {
      return c.json({ error: 'Invalid section_id' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    // 1) Doc-Level oder explizite Section
    const firstUrl = getDocumentThumbnailUrl(tokens.apiDomain, cabinetId, docId, sectionQ);
    const firstTry = await fetch(firstUrl, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'image/*' },
    });

    if (firstTry.ok) {
      const buffer = await firstTry.arrayBuffer();
      c.header('Content-Type', firstTry.headers.get('content-type') || 'image/jpeg');
      c.header('Content-Length', buffer.byteLength.toString());
      c.header('Cache-Control', 'private, max-age=86400');
      return c.body(buffer);
    }

    // 2) Auf Section-Pfad zurueckfallen, wenn keine section_id mitgegeben
    if ((firstTry.status === 404 || firstTry.status === 415) && !sectionQ) {
      const sectionId = await resolveFirstSectionId(
        tokens.apiDomain,
        cabinetId,
        docId,
        tokens.accessToken,
      );
      if (sectionId) {
        return proxyBinary(
          c,
          getDocumentThumbnailUrl(tokens.apiDomain, cabinetId, docId, sectionId),
          tokens.accessToken,
          'image/jpeg',
          'private, max-age=86400',
        );
      }
    }

    if (firstTry.status === 401 || firstTry.status === 403) {
      return c.json({ error: 'Docuware access denied — please reconnect.' }, 401);
    }
    if (firstTry.status === 404) {
      return c.json({ error: 'Thumbnail not found' }, 404);
    }
    const text = await firstTry.text().catch(() => '');
    return c.json({ error: `Docuware thumbnail error: ${firstTry.status}`, detail: text }, 502);
  },
);

/**
 * GET /api/connections/docuware/cabinets/:cabinetId/documents/:docId/pages/:pageNum
 * Optional: ?section_id=...
 *
 * Liefert ein gerendertes Seitenbild (Web-Viewer-Modus).
 */
docuwareRoutes.get(
  '/cabinets/:cabinetId/documents/:docId/pages/:pageNum',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');
    const docId = c.req.param('docId');
    const pageNumRaw = c.req.param('pageNum');
    const sectionQ = c.req.query('section_id');

    if (!SAFE_ID.test(cabinetId) || !SAFE_ID.test(docId)) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    if (sectionQ && !SAFE_SECTION_ID.test(sectionQ)) {
      return c.json({ error: 'Invalid section_id' }, 400);
    }
    const pageNum = parseInt(pageNumRaw, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > MAX_PAGE) {
      return c.json({ error: 'Invalid page number (1..2000)' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    const firstUrl = getDocumentPageImageUrl(
      tokens.apiDomain,
      cabinetId,
      docId,
      pageNum,
      sectionQ,
    );
    const firstTry = await fetch(firstUrl, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'image/*' },
    });

    if (firstTry.ok) {
      const buffer = await firstTry.arrayBuffer();
      c.header('Content-Type', firstTry.headers.get('content-type') || 'image/jpeg');
      c.header('Content-Length', buffer.byteLength.toString());
      c.header('Cache-Control', 'private, max-age=3600');
      return c.body(buffer);
    }

    if ((firstTry.status === 404 || firstTry.status === 415) && !sectionQ) {
      const sectionId = await resolveFirstSectionId(
        tokens.apiDomain,
        cabinetId,
        docId,
        tokens.accessToken,
      );
      if (sectionId) {
        return proxyBinary(
          c,
          getDocumentPageImageUrl(tokens.apiDomain, cabinetId, docId, pageNum, sectionId),
          tokens.accessToken,
          'image/jpeg',
          'private, max-age=3600',
        );
      }
    }

    if (firstTry.status === 401 || firstTry.status === 403) {
      return c.json({ error: 'Docuware access denied — please reconnect.' }, 401);
    }
    if (firstTry.status === 404) {
      return c.json({ error: 'Page not found' }, 404);
    }
    const text = await firstTry.text().catch(() => '');
    return c.json({ error: `Docuware page error: ${firstTry.status}`, detail: text }, 502);
  },
);

/**
 * GET /api/connections/docuware/cabinets/:cabinetId/documents/:docId/file
 *
 * Liefert das Dokument standardmaessig als **rendered PDF**
 * (`?targetFileType=PDF`) — geeignet fuer `<iframe src>` oder
 * pdf.js-Embedding ohne ZIP-Entpacken.
 *
 * Query-Params:
 *   - format=pdf (default) | original | zip
 *     - pdf      → DocuWare rendert in PDF (auch wenn Original Word/Image)
 *     - original → kein targetFileType-Param; DocuWare liefert ein ZIP
 *                  mit allen Sections, Annotations und Originaldateien
 *   - annotations=keep (default) | strip
 *     Wird nur bei format=pdf ausgewertet (strip → Annotations entfernen).
 */
docuwareRoutes.get(
  '/cabinets/:cabinetId/documents/:docId/file',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');
    const docId = c.req.param('docId');
    const format = (c.req.query('format') || 'pdf').toLowerCase();
    const annotations = (c.req.query('annotations') || 'keep').toLowerCase();

    if (!SAFE_ID.test(cabinetId) || !SAFE_ID.test(docId)) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    if (!['pdf', 'original', 'zip'].includes(format)) {
      return c.json({ error: 'Invalid format (pdf|original|zip)' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    const baseUrl = getDocumentFileDownloadUrl(tokens.apiDomain, cabinetId, docId);
    const params = new URLSearchParams();
    if (format === 'pdf') {
      params.set('targetFileType', 'PDF');
      if (annotations === 'strip') params.set('keepAnnotations', 'false');
    }
    const qs = params.toString();
    const upstreamUrl = qs ? `${baseUrl}?${qs}` : baseUrl;

    const fallbackContentType =
      format === 'pdf' ? 'application/pdf' : 'application/octet-stream';

    return proxyBinary(
      c,
      upstreamUrl,
      tokens.accessToken,
      fallbackContentType,
      'private, max-age=600',
    );
  },
);

/**
 * GET /api/connections/docuware/cabinets/:cabinetId/fields
 *
 * Liefert die filterbaren Index-Felder eines Cabinets (Default-Search-Dialog).
 * Frontend nutzt das, um ein Filter-Formular dynamisch zu generieren.
 *
 * Optional: ?dialog=<id-or-displayName-fragment>
 */
docuwareRoutes.get(
  '/cabinets/:cabinetId/fields',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');
    const dialogHint = c.req.query('dialog');

    if (!SAFE_ID.test(cabinetId)) {
      return c.json({ error: 'Invalid cabinet id' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    try {
      const dialog = await resolveSearchDialog(
        tokens.apiDomain,
        cabinetId,
        tokens.accessToken,
        dialogHint,
      );
      return c.json({
        cabinetId,
        dialog: {
          id: dialog.id,
          displayName: dialog.displayName,
          type: dialog.type,
          isDefault: dialog.isDefault,
        },
        fields: dialog.fields,
      });
    } catch (err: any) {
      console.error('[docuware] fields error:', err);
      const status = /401|403/.test(err.message || '') ? 401 : 502;
      return c.json({ error: err.message }, status);
    }
  },
);

/**
 * GET /api/connections/docuware/cabinets/:cabinetId/fields/:fieldName/select-list
 *
 * Liefert die erlaubten Werte ("Keyword List") fuer ein Feld — fuer
 * UI-Dropdowns.
 *
 * Optional: ?dialog=<id-or-displayName-fragment>
 */
docuwareRoutes.get(
  '/cabinets/:cabinetId/fields/:fieldName/select-list',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');
    const fieldName = c.req.param('fieldName');
    const dialogHint = c.req.query('dialog');

    if (!SAFE_ID.test(cabinetId)) {
      return c.json({ error: 'Invalid cabinet id' }, 400);
    }
    // DBFieldNames sind upper-case A-Z, 0-9, underscore.
    if (!/^[A-Z0-9_]{1,64}$/i.test(fieldName)) {
      return c.json({ error: 'Invalid field name' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    try {
      const dialog = await resolveSearchDialog(
        tokens.apiDomain,
        cabinetId,
        tokens.accessToken,
        dialogHint,
      );
      const fieldDef = dialog.fields.find((f) => f.dbFieldName === fieldName);
      if (!fieldDef) {
        return c.json({ error: `Field "${fieldName}" not found in dialog "${dialog.displayName}"` }, 404);
      }
      if (!fieldDef.hasSelectList) {
        return c.json({
          field: fieldDef,
          values: [],
          message: 'Field has no select list configured.',
        });
      }

      const res = await fetch(
        getFieldSelectListUrl(tokens.apiDomain, cabinetId, dialog.id, fieldName),
        { headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' } },
      );
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401 || res.status === 403) {
          return c.json({ error: 'Docuware access denied — please reconnect.' }, 401);
        }
        return c.json({ error: `Docuware select-list error: ${res.status}`, detail: text }, 502);
      }
      const data = (await res.json()) as any;
      return c.json({
        field: fieldDef,
        values: (data.Value || data.values || []) as string[],
      });
    } catch (err: any) {
      console.error('[docuware] select-list error:', err);
      const status = /401|403/.test(err.message || '') ? 401 : 502;
      return c.json({ error: err.message }, status);
    }
  },
);

/**
 * POST /api/connections/docuware/cabinets/:cabinetId/search
 *
 * Strukturierte Suche per DialogExpression. Body:
 *   {
 *     "filters": [
 *       { "field": "ART_DES_DOKUMENTES", "values": ["Vertrag"] },
 *       { "field": "FIRMA",              "values": ["WIANCO*"] },
 *       { "field": "DATUM",              "values": ["2024-01-01", "2026-12-31"] }
 *     ],
 *     "operation": "And",     // optional, default "And"
 *     "count": 20,            // optional, default 20, max 100
 *     "dialog": "Default..."   // optional
 *   }
 */
docuwareRoutes.post(
  '/cabinets/:cabinetId/search',
  authMiddleware,
  async (c) => {
    const cabinetId = c.req.param('cabinetId');

    if (!SAFE_ID.test(cabinetId)) {
      return c.json({ error: 'Invalid cabinet id' }, 400);
    }

    const result = await getDocuwareTokensOr401(c);
    if ('error' in result) return result.error;
    const { tokens } = result;

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || !Array.isArray(body.filters) || body.filters.length === 0) {
      return c.json({ error: 'filters[] is required (at least one filter)' }, 400);
    }

    try {
      const searchResult = await executeStructuredSearch(
        tokens.apiDomain,
        tokens.accessToken,
        {
          cabinetId,
          filters: body.filters,
          operation: body.operation,
          count: body.count,
          dialogHint: body.dialog,
        },
      );
      return c.json(searchResult);
    } catch (err: any) {
      console.error('[docuware] search error:', err);
      const status = /401|403/.test(err.message || '') ? 401 : 400;
      return c.json({ error: err.message }, status);
    }
  },
);

export { docuwareRoutes };
