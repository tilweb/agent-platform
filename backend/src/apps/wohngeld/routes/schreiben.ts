import { Hono } from 'hono';
import {
  listSchreiben, getSchreiben, createSchreiben, updateSchreiben, deleteSchreiben,
  getVorgang, updateVorgang, getAkte, listPersonen, listPruefschritte,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { generiereAnforderungsschreiben } from '../schreiben-generator';
import { plusTage, WIEDERVORLAGE_PUFFER_TAGE } from '../fristen';
import { fmtDe } from '../bwz';
import { schreibenToDocument } from '../schreiben-export';
import { generateDocument, getMimeType, type DocumentFormat } from '../../../services/documentGenerator';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';

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
  await audit(c, { aktion: 'schreiben.exportiert', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId: schreiben.vorgangId, detail: format });
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
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  const body = await c.req.json<{ art?: string; fristTage?: number; schreibenId?: string }>().catch(() => ({} as { art?: string; fristTage?: number; schreibenId?: string }));
  const [personen, pruefschritte] = await Promise.all([listPersonen(vorgangId), listPruefschritte(vorgangId)]);
  const entwurf = generiereAnforderungsschreiben(vorgang, personen, pruefschritte, {
    art: (body?.art as never) ?? 'erstanforderung',
    fristTage: body?.fristTage ?? 14,
  });
  // Frist/Wiedervorlage vorbelegen (Status NICHT ändern — erst beim „versendet", WP7).
  if (entwurf.frist) {
    try {
      await updateVorgang(vorgangId, { frist: entwurf.frist, wiedervorlage: plusTage(entwurf.frist, WIEDERVORLAGE_PUFFER_TAGE) }, { expectedVersion: vorgang.version });
    } catch { /* Vorbelegung ist optional — keine harte Blockade des Generierens */ }
  }
  // „Neu erzeugen": vorhandenen Entwurf überschreiben, statt einen neuen anzulegen.
  if (body?.schreibenId) {
    const bestehend = await getSchreiben(body.schreibenId);
    if (bestehend && bestehend.vorgangId === vorgangId) {
      const schreiben = await updateSchreiben(body.schreibenId, {
        betreff: entwurf.betreff, frist: entwurf.frist, body: entwurf.body, items: entwurf.items,
      }, { expectedVersion: bestehend.version });
      await audit(c, { aktion: 'schreiben.generiert', objektTyp: 'schreiben', objektId: body.schreibenId, vorgangId, detail: 'neu erzeugt' });
      return c.json({ schreiben }, 200);
    }
  }
  const schreiben = await createSchreiben({ vorgangId, ...entwurf });
  await audit(c, { aktion: 'schreiben.generiert', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId });
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
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  const schreiben = await getSchreiben(sid);
  if (!schreiben || schreiben.vorgangId !== vorgangId) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  try {
    const frist = schreiben.frist;
    const updated = await updateVorgang(vorgangId, {
      status: 'warte_auf_rueckmeldung',
      frist: frist ?? undefined,
      wiedervorlage: plusTage(frist, WIEDERVORLAGE_PUFFER_TAGE) ?? frist ?? undefined,
    }, { expectedVersion: vorgang.version });
    const fristTxt = frist ? fmtDe(frist) : 'ohne Frist';
    await audit(c, { aktion: 'schreiben.versendet', objektTyp: 'schreiben', objektId: sid, vorgangId, detail: `Frist ${fristTxt}` });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
  }
});

/**
 * Chat-Assistenz-Text an ein Schreiben anhängen (C3, Editor-Gate).
 * Hängt `text` als neuen Absatz an das JÜNGSTE Schreiben des Vorgangs an;
 * existiert noch keines, wird ein neues angelegt. Gibt `{ schreiben }` zurück.
 */
schreibenRoutes.post('/vorgaenge/:vorgangId/schreiben/text-anhaengen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  const body = await c.req.json<{ text?: string }>().catch(() => ({} as { text?: string }));
  const text = (body?.text ?? '').trim();
  if (!text) return c.json({ error: 'text ist erforderlich' }, 400);

  const bestehende = await listSchreiben(vorgangId); // desc(createdAt) → [0] = jüngstes
  const juengstes = bestehende[0];
  try {
    if (juengstes) {
      const body0 = (juengstes.body ?? '').trimEnd();
      const neuerBody = body0 ? `${body0}\n\n${text}` : text;
      const schreiben = await updateSchreiben(juengstes.id, { body: neuerBody }, { expectedVersion: juengstes.version });
      await audit(c, { aktion: 'schreiben.text_angehaengt', objektTyp: 'schreiben', objektId: juengstes.id, vorgangId, detail: 'Assistenz-Text übernommen' });
      return c.json({ schreiben }, 200);
    }
    const schreiben = await createSchreiben({ vorgangId, art: 'erstanforderung', body: text });
    await audit(c, { aktion: 'schreiben.text_angehaengt', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId, detail: 'Schreiben aus Assistenz-Text angelegt' });
    return c.json({ schreiben }, 201);
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Anhängen fehlgeschlagen' }, 500);
  }
});

schreibenRoutes.put('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const before = await getSchreiben(c.req.param('id'));
    const eingeschr = await denyIfVorgangEingeschraenkt(before?.vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    const schreiben = await updateSchreiben(c.req.param('id'), updates, { expectedVersion, force });
    if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
    await audit(c, { aktion: 'schreiben.geaendert', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId: schreiben.vorgangId });
    return c.json({ schreiben });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

schreibenRoutes.delete('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getSchreiben(id);
  const eingeschr = await denyIfVorgangEingeschraenkt(before?.vorgangId);
  if (eingeschr) return c.json(eingeschr, 403);
  const ok = await deleteSchreiben(id);
  if (ok) await audit(c, { aktion: 'schreiben.geloescht', objektTyp: 'schreiben', objektId: id, vorgangId: before?.vorgangId });
  return ok ? c.json({ ok: true }) : c.json({ error: 'Schreiben nicht gefunden' }, 404);
});
