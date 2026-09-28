/**
 * Grundsicherung — Dokumente: Liste, Metadaten-Patch, Löschen, Datei/Vorschau/Seite.
 * Upload/Erkennung kommen mit dem Posteingang (G3). Dateiablage aus dem Kern (appId 'grundsicherung').
 */
import { Hono } from 'hono';
import { listDokumente, getDokument, updateDokument, deleteDokument, getPerson } from '../storage';
import { VersionConflictError } from '../concurrency';
import { loadDokumentDatei } from '../filestore';
import { denyIfNotAppEditor, denyIfVorgangEingeschraenkt } from './_shared';
import { audit, auditUpdate } from '../audit';
import { pruefeAutomatisch } from '../pruefung';
import { vorschauInfo, seitenAntwort } from '../seitenvorschau';
import { DOKUMENT_TYPEN, type Dokument } from '../types';

export const dokumenteRoutes = new Hono();

/** Content-Type aus der Dateiendung ableiten; unbekannt → octet-stream. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
export function contentTypeForName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}
/** Anzeige-/Download-Dateiname eines Dokuments (bereinigt). */
export function dateinameFuer(dok: Pick<Dokument, 'quelle' | 'titel' | 's3Key' | 'pfad' | 'typ'>): string {
  const raw = dok.quelle || dok.titel || (dok.s3Key || dok.pfad || '').split(/[\\/]/).pop() || `dokument-${dok.typ ?? 'datei'}`;
  return raw.replace(/[^a-zA-Z0-9_.\- ]/g, '_').slice(0, 200) || 'datei';
}

/** Metadaten, die per PUT geändert werden dürfen (keine Ablage-Verweise, keine Extraktion). */
const DOKUMENT_PATCH_FELDER = ['typ', 'titel', 'personId', 'istOriginal', 'abgelegt', 'eingegangenAm', 'seiten'] as const;

dokumenteRoutes.get('/vorgaenge/:vorgangId/dokumente', async (c) => {
  return c.json({ dokumente: await listDokumente(c.req.param('vorgangId')) });
});

dokumenteRoutes.get('/dokumente/:id', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  return c.json({ dokument });
});

/** GET /dokumente/:id/vorschau — { art, seiten } (Lesezugriff wird protokolliert). */
dokumenteRoutes.get('/dokumente/:id/vorschau', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  const bytes = await loadDokumentDatei({ s3Key: dokument.s3Key, pfad: dokument.pfad }).catch(() => null);
  if (!bytes) return c.json({ error: 'Keine Datei hinterlegt' }, 404);
  await audit(c, { aktion: 'dokument.angesehen', objektTyp: 'dokument', objektId: dokument.id, vorgangId: dokument.vorgangId, detail: dokument.titel });
  try {
    return c.json(await vorschauInfo(bytes, contentTypeForName(dateinameFuer(dokument))));
  } catch (err) {
    return c.json({ error: `Vorschau nicht möglich: ${err instanceof Error ? err.message : err}` }, 500);
  }
});

/** GET /dokumente/:id/seite/:n — Seite n als PNG. */
dokumenteRoutes.get('/dokumente/:id/seite/:n', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  const bytes = await loadDokumentDatei({ s3Key: dokument.s3Key, pfad: dokument.pfad }).catch(() => null);
  if (!bytes) return c.json({ error: 'Keine Datei hinterlegt' }, 404);
  return seitenAntwort(bytes, contentTypeForName(dateinameFuer(dokument)), Number(c.req.param('n')));
});

/** GET /dokumente/:id/datei — Bytes inline (Download wird protokolliert, §§ 67d ff. SGB X). */
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
  await audit(c, { aktion: 'dokument.heruntergeladen', objektTyp: 'dokument', objektId: dokument.id, vorgangId: dokument.vorgangId, detail: dokument.titel });
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

/** Metadaten ändern (Typ, Titel, Personenzuordnung, Ablage-Status, Eingangsdatum). */
dokumenteRoutes.put('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force } = body ?? {};
    const updates: Record<string, unknown> = {};
    for (const f of DOKUMENT_PATCH_FELDER) if (body && f in body) updates[f] = body[f];
    if (updates.typ !== undefined && !DOKUMENT_TYPEN.includes(updates.typ as Dokument['typ'])) return c.json({ error: 'Unbekannter Dokumenttyp' }, 400);
    const before = await getDokument(c.req.param('id'));
    if (!before) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    // Zuordnung nur zu einer Person desselben Vorgangs (null = fallübergreifend).
    if (updates.personId === null || updates.personId === '') updates.personId = undefined;
    else if (typeof updates.personId === 'string') {
      const person = await getPerson(updates.personId);
      if (!person || person.vorgangId !== before.vorgangId) return c.json({ error: 'Person gehört nicht zu diesem Vorgang' }, 400);
    }
    const dokument = await updateDokument(before.id, updates as Partial<Dokument>, { expectedVersion, force });
    if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    await auditUpdate(c, {
      aktion: 'dokument.geaendert', objektTyp: 'dokument', objektId: dokument.id, vorgangId: dokument.vorgangId,
      before, after: dokument, felder: [...DOKUMENT_PATCH_FELDER],
    });
    await pruefeAutomatisch(dokument.vorgangId);
    return c.json({ dokument });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

dokumenteRoutes.delete('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getDokument(id);
  if (!before) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
  if (eingeschr) return c.json(eingeschr, 403);
  const ok = await deleteDokument(id);
  if (ok) {
    await audit(c, { aktion: 'dokument.geloescht', objektTyp: 'dokument', objektId: id, vorgangId: before.vorgangId, detail: before.titel });
    await pruefeAutomatisch(before.vorgangId);
  }
  return ok ? c.json({ ok: true }) : c.json({ error: 'Dokument nicht gefunden' }, 404);
});
