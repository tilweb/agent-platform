import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listSchreiben, getSchreiben, createSchreiben, updateSchreiben, deleteSchreiben,
  getVorgang, updateVorgang, getAkte, listPersonen, listPruefschritte, addAktivitaet,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { generiereAnforderungsschreiben } from '../schreiben-generator';
import { fmtDe } from '../bwz';
import { schreibenToDocument } from '../schreiben-export';
import { generateDocument, getMimeType, type DocumentFormat } from '../../../services/documentGenerator';
import { denyIfNotAppEditor } from './_shared';

export const schreibenRoutes = new Hono();

schreibenRoutes.get('/vorgaenge/:vorgangId/schreiben', async (c) => {
  return c.json({ schreiben: await listSchreiben(c.req.param('vorgangId')) });
});

schreibenRoutes.get('/schreiben/:id', async (c) => {
  const schreiben = await getSchreiben(c.req.param('id'));
  if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  return c.json({ schreiben });
});

/** Schreiben als PDF oder Word (docx) herunterladen. Read-only. */
schreibenRoutes.get('/schreiben/:id/export', async (c) => {
  const fmtParam = (c.req.query('format') ?? 'pdf').toLowerCase();
  if (fmtParam !== 'pdf' && fmtParam !== 'docx') {
    return c.json({ error: 'format muss pdf oder docx sein' }, 400);
  }
  const format = fmtParam as DocumentFormat;
  const schreiben = await getSchreiben(c.req.param('id'));
  if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  const vorgang = await getVorgang(schreiben.vorgangId);
  const akte = vorgang ? await getAkte(vorgang.akteId) : null;
  const doc = schreibenToDocument(schreiben, vorgang, akte);
  const buffer = await generateDocument(doc, format);
  const base = `Anforderungsschreiben-${vorgang?.antragsId ?? schreiben.id}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': getMimeType(format),
      'Content-Disposition': `attachment; filename="${base}.${format}"`,
    },
  });
});

/**
 * Anforderungsschreiben aus den offenen Prüfschritten (Typ „anforderung") generieren.
 * Erzeugt einen Entwurf (deterministischer Text), den die Sachbearbeitung editieren kann.
 */
schreibenRoutes.post('/vorgaenge/:vorgangId/schreiben/generieren', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<{ art?: string; fristTage?: number; schreibenId?: string }>().catch(() => ({} as { art?: string; fristTage?: number; schreibenId?: string }));
  const [personen, pruefschritte] = await Promise.all([listPersonen(vorgangId), listPruefschritte(vorgangId)]);
  const entwurf = generiereAnforderungsschreiben(vorgang, personen, pruefschritte, {
    art: (body?.art as never) ?? 'erstanforderung',
    fristTage: body?.fristTage ?? 14,
  });
  // Frist/Wiedervorlage vorbelegen (Status NICHT ändern — erst beim „versendet", WP7).
  if (entwurf.frist) {
    try {
      await updateVorgang(vorgangId, { frist: entwurf.frist, wiedervorlage: entwurf.frist }, { expectedVersion: vorgang.version });
    } catch { /* Vorbelegung ist optional — keine harte Blockade des Generierens */ }
  }
  // „Neu erzeugen": vorhandenen Entwurf überschreiben, statt einen neuen anzulegen.
  if (body?.schreibenId) {
    const bestehend = await getSchreiben(body.schreibenId);
    if (bestehend && bestehend.vorgangId === vorgangId) {
      const schreiben = await updateSchreiben(body.schreibenId, {
        betreff: entwurf.betreff, frist: entwurf.frist, body: entwurf.body, items: entwurf.items,
      }, { expectedVersion: bestehend.version });
      await addAktivitaet({ vorgangId, typ: 'schreiben', akteur: getCurrentUserId(c), beschreibung: 'Anforderungsschreiben neu erzeugt' });
      return c.json({ schreiben }, 200);
    }
  }
  const schreiben = await createSchreiben({ vorgangId, ...entwurf });
  await addAktivitaet({ vorgangId, typ: 'schreiben', akteur: getCurrentUserId(c), beschreibung: 'Anforderungsschreiben generiert' });
  return c.json({ schreiben }, 201);
});

/**
 * Schreiben als „versendet" markieren (Welle 4, WP7): Vorgang-Status auf
 * `warte_auf_rueckmeldung`, Frist + Wiedervorlage = Frist des Schreibens,
 * Aktivität protokollieren. Editor-Gate.
 */
schreibenRoutes.post('/vorgaenge/:vorgangId/schreiben/:sid/versendet', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const sid = c.req.param('sid');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const schreiben = await getSchreiben(sid);
  if (!schreiben || schreiben.vorgangId !== vorgangId) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  try {
    const frist = schreiben.frist;
    const updated = await updateVorgang(vorgangId, {
      status: 'warte_auf_rueckmeldung',
      frist: frist ?? undefined,
      wiedervorlage: frist ?? undefined,
    }, { expectedVersion: vorgang.version });
    const fristTxt = frist ? fmtDe(frist) : 'ohne Frist';
    await addAktivitaet({ vorgangId, typ: 'schreiben', akteur: getCurrentUserId(c), beschreibung: `Anforderung versendet, Frist ${fristTxt}` });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
  }
});

schreibenRoutes.put('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const schreiben = await updateSchreiben(c.req.param('id'), updates, { expectedVersion, force });
    if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
    return c.json({ schreiben });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

schreibenRoutes.delete('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteSchreiben(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Schreiben nicht gefunden' }, 404);
});
