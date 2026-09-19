import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { listDokumente, getDokument, createDokument, updateDokument, deleteDokument, getVorgang, addAktivitaet } from '../storage';
import { VersionConflictError } from '../concurrency';
import { loadDokumentDatei } from '../filestore';
import { denyIfNotAppEditor } from './_shared';

export const dokumenteRoutes = new Hono();

/** Content-Type aus der Dateiendung ableiten; unbekannt → octet-stream. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
function contentTypeForName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}
/** Anzeige-/Download-Dateiname eines Dokuments (bereinigt). */
function dateinameFuer(dok: { quelle?: string; titel?: string; s3Key?: string; pfad?: string; typ?: string }): string {
  const raw = dok.quelle || dok.titel || (dok.s3Key || dok.pfad || '').split(/[\\/]/).pop() || `dokument-${dok.typ ?? 'datei'}`;
  return raw.replace(/[^a-zA-Z0-9_.\- ]/g, '_').slice(0, 200) || 'datei';
}

dokumenteRoutes.get('/vorgaenge/:vorgangId/dokumente', async (c) => {
  return c.json({ dokumente: await listDokumente(c.req.param('vorgangId')) });
});

dokumenteRoutes.get('/dokumente/:id', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  return c.json({ dokument });
});

/**
 * Datei-Serving (Welle 5, WP10): liefert die hinterlegten Bytes eines Dokuments
 * mit passendem Content-Type und `Content-Disposition: inline` (native
 * Browser-Vorschau). Keine hinterlegte Datei → 404.
 */
dokumenteRoutes.get('/dokumente/:id/datei', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  let bytes: Uint8Array | null;
  try {
    bytes = await loadDokumentDatei({ s3Key: dokument.s3Key, pfad: dokument.pfad });
  } catch {
    return c.json({ error: 'Datei konnte nicht geladen werden' }, 404);
  }
  if (!bytes) return c.json({ error: 'Keine Datei hinterlegt' }, 404);
  const name = dateinameFuer(dokument);
  const body = new Uint8Array(bytes);
  return new Response(body, {
    headers: {
      'Content-Type': contentTypeForName(name),
      'Content-Disposition': `inline; filename="${name}"`,
      'Content-Length': String(body.byteLength),
    },
  });
});

/**
 * Ablage-Status setzen (Welle 5, WP10): markiert das Dokument als „ins
 * Fachverfahren abgelegt" (nur Status, keine echte Schnittstelle). Editor-Gate.
 */
dokumenteRoutes.post('/dokumente/:id/ablegen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const dokument = await getDokument(id);
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  const updated = await updateDokument(id, { abgelegt: true });
  await addAktivitaet({
    vorgangId: dokument.vorgangId, typ: 'dokument', akteur: getCurrentUserId(c),
    beschreibung: `Dokument „${dateinameFuer(dokument)}" ins Fachverfahren abgelegt`,
  });
  return c.json({ dokument: updated });
});

dokumenteRoutes.post('/vorgaenge/:vorgangId/dokumente', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<Record<string, unknown>>();
  const dokument = await createDokument({ ...body, vorgangId });
  return c.json({ dokument }, 201);
});

dokumenteRoutes.put('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const dokument = await updateDokument(c.req.param('id'), updates, { expectedVersion, force });
    if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    return c.json({ dokument });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

dokumenteRoutes.delete('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteDokument(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Dokument nicht gefunden' }, 404);
});
