import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listVorgaenge, getVorgang, createVorgang, updateVorgang, deleteVorgang,
  getAkte, listPersonen, listDokumente, listPruefschritte, listSchreiben, listAktivitaeten,
  getVorgangSnapshot, syncPruefschritte, addAktivitaet, listFeldStatus, listNotizen,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { pruefeVorgang } from '../checker';
import { berechneVorgangEinkommen, unterhaltsabzuegeFuer } from '../einkommen';
import { berechneBwzVorschlag } from '../bwz';
import { denyIfNotAppEditor } from './_shared';

export const vorgaengeRoutes = new Hono();

vorgaengeRoutes.get('/vorgaenge', async (c) => {
  const akteId = c.req.query('akteId');
  const status = c.req.query('status');
  return c.json({ vorgaenge: await listVorgaenge({ akteId, status }) });
});

vorgaengeRoutes.get('/vorgaenge/:id', async (c) => {
  const vorgang = await getVorgang(c.req.param('id'));
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  return c.json({ vorgang });
});

/** Voll-Detail für die Arbeitsfläche: Vorgang + Akte + Personen + Dokumente + Prüfschritte + Schreiben + Verlauf. */
vorgaengeRoutes.get('/vorgaenge/:id/detail', async (c) => {
  const id = c.req.param('id');
  const vorgang = await getVorgang(id);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const [akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen] = await Promise.all([
    getAkte(vorgang.akteId), listPersonen(id), listDokumente(id),
    listPruefschritte(id), listSchreiben(id), listAktivitaeten(id),
    listFeldStatus(id), listNotizen(id),
  ]);
  return c.json({ vorgang, akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen });
});

/**
 * § 13-Gesamteinkommen des Vorgangs (read-only, keine Betragsberechnung § 19).
 * Leitet §16-Abzugskategorien pragmatisch aus den vorhandenen Merkmalen ab
 * (siehe berechneVorgangEinkommen) — im UI als angenommene Kategorien kennzeichnen.
 */
vorgaengeRoutes.get('/vorgaenge/:id/einkommen', async (c) => {
  const id = c.req.param('id');
  const snapshot = await getVorgangSnapshot(id);
  if (!snapshot) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const unterhalt = unterhaltsabzuegeFuer(snapshot.personen);
  const einkommen = berechneVorgangEinkommen(snapshot.personen, snapshot.dokumente, unterhalt);
  return c.json({ einkommen });
});

vorgaengeRoutes.post('/vorgaenge', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ akteId?: string; [k: string]: unknown }>();
  if (!body?.akteId) return c.json({ error: 'akteId ist erforderlich' }, 400);
  const akte = await getAkte(body.akteId);
  if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
  const vorgang = await createVorgang({ ...body, akteId: body.akteId, ownerId: getCurrentUserId(c) });
  await addAktivitaet({ vorgangId: vorgang.id, typ: 'erstellt', akteur: getCurrentUserId(c), beschreibung: 'Vorgang erstellt' });
  return c.json({ vorgang }, 201);
});

vorgaengeRoutes.put('/vorgaenge/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    delete (updates as Record<string, unknown>).akteId;
    const vorgang = await updateVorgang(c.req.param('id'), updates, { expectedVersion, force });
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    return c.json({ vorgang });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

vorgaengeRoutes.delete('/vorgaenge/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteVorgang(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Vorgang nicht gefunden' }, 404);
});

/**
 * Regel-Engine ausführen (Vollständigkeit + Plausibilität) und Prüfschritte synchronisieren.
 * Idempotent: erhält manuelle und bereits erledigte Prüfschritte.
 */
vorgaengeRoutes.post('/vorgaenge/:id/pruefen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const snapshot = await getVorgangSnapshot(id);
  if (!snapshot) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const befunde = pruefeVorgang(snapshot);
  const pruefschritte = await syncPruefschritte(id, befunde);
  await addAktivitaet({ vorgangId: id, typ: 'pruefung', akteur: getCurrentUserId(c), beschreibung: `Prüfung ausgeführt — ${befunde.length} Befund(e)` });
  return c.json({ pruefschritte, befundeCount: befunde.length });
});

/**
 * Bewilligungszeitraum-Vorschlag übernehmen: 12 Monate ab Antragsmonat (§ 22/§ 25).
 * Setzt die BWZ-Liste (führend) und die Legacy-Felder bwz_start/bwz_ende (Kompatibilität).
 */
vorgaengeRoutes.post('/vorgaenge/:id/bwz-vorschlag-uebernehmen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const vorgang = await getVorgang(id);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const vorschlag = berechneBwzVorschlag(vorgang.antragsdatum);
  if (!vorschlag) return c.json({ error: 'Kein Antragsdatum vorhanden — Vorschlag nicht berechenbar' }, 400);
  const bwzId = `bwz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const updated = await updateVorgang(id, {
      bwz: [{ id: bwzId, start: vorschlag.start, ende: vorschlag.ende }],
      bwz_start: vorschlag.start,
      bwz_ende: vorschlag.ende,
    }, { expectedVersion: vorgang.version });
    await addAktivitaet({ vorgangId: id, typ: 'bwz', akteur: getCurrentUserId(c), beschreibung: `Bewilligungszeitraum-Vorschlag übernommen (${vorschlag.start} – ${vorschlag.ende})` });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Übernahme fehlgeschlagen' }, 500);
  }
});
