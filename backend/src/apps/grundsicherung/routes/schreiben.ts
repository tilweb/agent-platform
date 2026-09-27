/**
 * Grundsicherung — Schreiben (Nachforderung nach § 60 SGB I mit Frist und Rechtsfolgenbelehrung
 * § 66 SGB I). Endpunkte, Request- und Antwortformen wie Wohngeld:
 *  GET    /vorgaenge/:vorgangId/schreiben
 *  GET    /schreiben/:id
 *  GET    /schreiben/:id/export?format=pdf|docx
 *  POST   /vorgaenge/:vorgangId/schreiben/generieren   { art?, fristTage?, schreibenId? (= neu erzeugen) }
 *  POST   /vorgaenge/:vorgangId/schreiben/:sid/versendet   → Status warte_auf_rueckmeldung, Frist/Wiedervorlage
 *  POST   /vorgaenge/:vorgangId/schreiben/text-anhaengen   { text }
 *  PUT    /schreiben/:id
 *  DELETE /schreiben/:id
 * Rein deterministisch — kein LLM.
 */
import { Hono } from 'hono';
import {
  listSchreiben, getSchreiben, createSchreiben, updateSchreiben, deleteSchreiben,
  getVorgang, updateVorgang, getAkte, listPersonen, listPruefschritte, listTextbausteine,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { generiereAnforderungsschreiben, STANDARD_FRIST_TAGE } from '../schreiben-generator';
import { plusTage, wiedervorlagePufferTage } from '../fristen';
import { schreibenToDocument } from '../schreiben-export';
import { generateDocument, getMimeType, type DocumentFormat } from '../../../services/documentGenerator';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';
import type { SchreibenArt } from '../types';

export const schreibenRoutes = new Hono();

const ARTEN: readonly SchreibenArt[] = ['erstanforderung', 'erinnerung', 'zweitanforderung', 'sonstiges'];

function fmtDe(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? '');
}

schreibenRoutes.get('/vorgaenge/:vorgangId/schreiben', async (c) => {
  return c.json({ schreiben: await listSchreiben(c.req.param('vorgangId')) });
});

schreibenRoutes.get('/schreiben/:id', async (c) => {
  const schreiben = await getSchreiben(c.req.param('id'));
  if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  return c.json({ schreiben });
});

/** Schreiben als PDF oder Word (docx) herunterladen. Export wird protokolliert. */
schreibenRoutes.get('/schreiben/:id/export', async (c) => {
  const fmtParam = (c.req.query('format') ?? 'pdf').toLowerCase();
  if (fmtParam !== 'pdf' && fmtParam !== 'docx') return c.json({ error: 'format muss pdf oder docx sein' }, 400);
  const format = fmtParam as DocumentFormat;
  const schreiben = await getSchreiben(c.req.param('id'));
  if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  const vorgang = await getVorgang(schreiben.vorgangId);
  const akte = vorgang ? await getAkte(vorgang.akteId) : null;
  const buffer = await generateDocument(schreibenToDocument(schreiben, vorgang, akte), format);
  await audit(c, { aktion: 'schreiben.exportiert', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId: schreiben.vorgangId, detail: format });
  const base = `Anforderungsschreiben-${vorgang?.vorgangsnummer ?? schreiben.id}`;
  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': getMimeType(format), 'Content-Disposition': `attachment; filename="${base}.${format}"` },
  });
});

/**
 * Nachforderungsschreiben aus den offenen Prüfschritten (Typ „anforderung") erzeugen.
 * Frist/Wiedervorlage am Vorgang vorbelegen (Status erst bei „versendet"). `schreibenId` ⇒
 * vorhandenen Entwurf neu erzeugen (überschreiben) statt neu anlegen.
 */
schreibenRoutes.post('/vorgaenge/:vorgangId/schreiben/generieren', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  type Body = { art?: string; fristTage?: number; schreibenId?: string };
  const body = await c.req.json<Body>().catch(() => ({} as Body));
  const [personen, pruefschritte, textbausteine] = await Promise.all([listPersonen(vorgangId), listPruefschritte(vorgangId), listTextbausteine()]);
  const entwurf = generiereAnforderungsschreiben(vorgang, personen, pruefschritte, {
    art: ARTEN.includes(body?.art as SchreibenArt) ? (body!.art as SchreibenArt) : 'erstanforderung',
    fristTage: body?.fristTage ?? STANDARD_FRIST_TAGE,
    textbausteine,
  });
  if (entwurf.frist) {
    try {
      await updateVorgang(vorgangId, { frist: entwurf.frist, wiedervorlage: plusTage(entwurf.frist, wiedervorlagePufferTage()) ?? undefined }, { expectedVersion: vorgang.version });
    } catch { /* Vorbelegung ist optional */ }
  }
  if (body?.schreibenId) {
    const bestehend = await getSchreiben(body.schreibenId);
    if (bestehend && bestehend.vorgangId === vorgangId) {
      try {
        const schreiben = await updateSchreiben(body.schreibenId, {
          art: entwurf.art, betreff: entwurf.betreff, frist: entwurf.frist, body: entwurf.body, items: entwurf.items,
        }, { expectedVersion: bestehend.version });
        await audit(c, { aktion: 'schreiben.generiert', objektTyp: 'schreiben', objektId: body.schreibenId, vorgangId, detail: 'neu erzeugt' });
        return c.json({ schreiben }, 200);
      } catch (err) {
        if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
        return c.json({ error: 'Neu erzeugen fehlgeschlagen' }, 500);
      }
    }
  }
  const schreiben = await createSchreiben({ vorgangId, ...entwurf });
  await audit(c, { aktion: 'schreiben.generiert', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId });
  return c.json({ schreiben }, 201);
});

/**
 * Schreiben als „versendet" markieren: Vorgang-Status `warte_auf_rueckmeldung`, Frist = Frist des
 * Schreibens, Wiedervorlage = Frist + Puffer (`GRUNDSICHERUNG_WIEDERVORLAGE_PUFFER_TAGE`).
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
      wiedervorlage: plusTage(frist, wiedervorlagePufferTage()) ?? frist ?? undefined,
    }, { expectedVersion: vorgang.version });
    await audit(c, { aktion: 'schreiben.versendet', objektTyp: 'schreiben', objektId: sid, vorgangId, detail: `Frist ${frist ? fmtDe(frist) : 'ohne Frist'}` });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
  }
});

/** Text (z. B. aus einer Assistenz-Antwort) an das jüngste Schreiben anhängen; ohne Schreiben neu anlegen. */
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
  const juengstes = (await listSchreiben(vorgangId))[0];
  try {
    if (juengstes) {
      const alt = (juengstes.body ?? '').trimEnd();
      const schreiben = await updateSchreiben(juengstes.id, { body: alt ? `${alt}\n\n${text}` : text }, { expectedVersion: juengstes.version });
      await audit(c, { aktion: 'schreiben.text_angehaengt', objektTyp: 'schreiben', objektId: juengstes.id, vorgangId, detail: 'Text übernommen' });
      return c.json({ schreiben }, 200);
    }
    const schreiben = await createSchreiben({ vorgangId, art: 'erstanforderung', body: text });
    await audit(c, { aktion: 'schreiben.text_angehaengt', objektTyp: 'schreiben', objektId: schreiben.id, vorgangId, detail: 'Schreiben aus Text angelegt' });
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
    delete (updates as Record<string, unknown>).id;
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
