/**
 * Vorgangsmappe — Settings-Routen
 *
 * CRUD-Endpoints fuer Dokumententypen, Incoterms und Pflicht-Mappings.
 * Werden in `routes.ts` unter `/settings/...` gemountet.
 */

import { Hono } from 'hono';
import {
  listDocumentTypes, getDocumentType, createDocumentType, updateDocumentType, deleteDocumentType,
  listIncoterms, getIncoterm, createIncoterm, updateIncoterm, deleteIncoterm,
  listMappings, replaceMappingsForKey, upsertMapping,
} from './settings-storage';

const settings = new Hono();

/* -------------------- Document Types -------------------- */

settings.get('/document-types', async (c) => {
  const rows = await listDocumentTypes();
  return c.json({ documentTypes: rows });
});

settings.post('/document-types', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.id || !body.label || !body.bereich) {
    return c.json({ error: 'id, label, bereich sind Pflicht.' }, 400);
  }
  if (!/^[a-z0-9_-]{2,64}$/i.test(body.id)) {
    return c.json({ error: 'id darf nur Buchstaben/Ziffern/Underscore/Bindestrich enthalten (2–64 Zeichen).' }, 400);
  }
  if (await getDocumentType(body.id)) {
    return c.json({ error: 'Document-Type mit dieser id existiert bereits.' }, 409);
  }
  try {
    const created = await createDocumentType({
      id: body.id,
      label: String(body.label),
      bereich: String(body.bereich),
      matchAny: Array.isArray(body.matchAny) ? body.matchAny.map(String) : [],
      description: body.description ?? null,
      statusgebend: !!body.statusgebend,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 9999,
    });
    return c.json({ documentType: created }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'create failed' }, 500);
  }
});

settings.put('/document-types/:id', async (c) => {
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const existing = await getDocumentType(id);
  if (!existing) return c.json({ error: 'Nicht gefunden.' }, 404);
  const updated = await updateDocumentType(id, {
    label: body.label,
    bereich: body.bereich,
    matchAny: Array.isArray(body.matchAny) ? body.matchAny.map(String) : undefined,
    description: body.description,
    statusgebend: typeof body.statusgebend === 'boolean' ? body.statusgebend : undefined,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
  });
  return c.json({ documentType: updated });
});

settings.delete('/document-types/:id', async (c) => {
  const id = c.req.param('id');
  const ok = await deleteDocumentType(id);
  if (!ok) return c.json({ error: 'Nicht gefunden.' }, 404);
  return c.json({ success: true });
});

/* -------------------- Incoterms -------------------- */

settings.get('/incoterms', async (c) => {
  const rows = await listIncoterms();
  return c.json({ incoterms: rows });
});

settings.post('/incoterms', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.code || !body.label) {
    return c.json({ error: 'code und label sind Pflicht.' }, 400);
  }
  if (!/^[A-Z]{2,6}$/i.test(body.code)) {
    return c.json({ error: 'code muss 2–6 Buchstaben sein (z.B. FOB, CIF).' }, 400);
  }
  const code = String(body.code).toUpperCase();
  if (await getIncoterm(code)) {
    return c.json({ error: 'Incoterm mit diesem code existiert bereits.' }, 409);
  }
  try {
    const created = await createIncoterm({
      code,
      label: String(body.label),
      description: body.description ?? null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 9999,
    });
    return c.json({ incoterm: created }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'create failed' }, 500);
  }
});

settings.put('/incoterms/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const existing = await getIncoterm(code);
  if (!existing) return c.json({ error: 'Nicht gefunden.' }, 404);
  const updated = await updateIncoterm(code, {
    label: body.label,
    description: body.description,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
  });
  return c.json({ incoterm: updated });
});

settings.delete('/incoterms/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const ok = await deleteIncoterm(code);
  if (!ok) return c.json({ error: 'Nicht gefunden.' }, 404);
  return c.json({ success: true });
});

/* -------------------- Mappings -------------------- */

settings.get('/mappings', async (c) => {
  const incoterm = c.req.query('incoterm');
  const geschaeftsart = c.req.query('geschaeftsart');
  const rows = await listMappings({
    incoterm: incoterm ? incoterm.toUpperCase() : undefined,
    geschaeftsart: geschaeftsart ? geschaeftsart.toLowerCase() : undefined,
  });
  return c.json({ mappings: rows });
});

/**
 * POST /mappings  — Einzel-Upsert
 * Body: { incoterm, geschaeftsart, documentTypeId, required }
 */
settings.post('/mappings', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.incoterm || !body.geschaeftsart || !body.documentTypeId) {
    return c.json({ error: 'incoterm, geschaeftsart, documentTypeId sind Pflicht.' }, 400);
  }
  await upsertMapping(
    String(body.incoterm).toUpperCase(),
    String(body.geschaeftsart).toLowerCase(),
    String(body.documentTypeId),
    body.required !== false,
  );
  return c.json({ success: true });
});

/**
 * PUT /mappings/:incoterm/:geschaeftsart — Bulk-Replace
 * Body: { documentTypeIds: string[] }
 * Loescht alle aktuellen Pflicht-Mappings fuer diese Kombi und legt die
 * neuen aus der Liste an. Praktisch fuer Matrix-Editor.
 */
settings.put('/mappings/:incoterm/:geschaeftsart', async (c) => {
  const incoterm = c.req.param('incoterm').toUpperCase();
  const geschaeftsart = c.req.param('geschaeftsart').toLowerCase();
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const ids = Array.isArray(body.documentTypeIds) ? body.documentTypeIds.map(String) : [];
  await replaceMappingsForKey(incoterm, geschaeftsart, ids);
  return c.json({ success: true, count: ids.length });
});

export { settings as settingsRoutes };
