import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listVorgaenge, getVorgang, createVorgang, updateVorgang, deleteVorgang,
  getAkte, listAkten, listPersonen, listDokumente, listPruefschritte, listSchreiben, listAktivitaeten,
  getVorgangSnapshot, syncPruefschritte, listFeldStatus, listNotizen, listAuditEintraege,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { audit, auditUpdate } from '../audit';
import { pruefeVorgang } from '../checker';
import { berechneVorgangEinkommen, unterhaltsabzuegeFuer } from '../einkommen';
import { berechneBwzVorschlag } from '../bwz';
import { istUeberfaellig } from '../fristen';
import { verfuegungToDocument } from '../verfuegung-export';
import { generateDocument, getMimeType, type DocumentFormat } from '../../../services/documentGenerator';
import type { VerfuegungEntscheidung } from '../types';
import { denyIfNotAppEditor } from './_shared';

const VERFUEGUNG_ENTSCHEIDUNGEN: VerfuegungEntscheidung[] = ['bewilligt', 'abgelehnt', 'teilweise', 'offen'];

export const vorgaengeRoutes = new Hono();

vorgaengeRoutes.get('/vorgaenge', async (c) => {
  const akteId = c.req.query('akteId');
  const status = c.req.query('status');
  return c.json({ vorgaenge: await listVorgaenge({ akteId, status }) });
});

/**
 * Wiedervorlage-/Fristen-Liste (Welle 4, WP7): alle Vorgänge mit gesetzter
 * Wiedervorlage, angereichert um Antragsteller (aus Akte) + Überfälligkeit.
 * Heute-Datum serverseitig, sortiert nach Wiedervorlagedatum (früheste zuerst).
 */
vorgaengeRoutes.get('/wiedervorlage', async (c) => {
  const heute = new Date().toISOString().slice(0, 10);
  const [vorgaenge, akten] = await Promise.all([listVorgaenge(), listAkten()]);
  const akteById = new Map(akten.map((a) => [a.id, a]));
  const items = vorgaenge
    .filter((v) => !!v.wiedervorlage)
    .map((v) => {
      const akte = akteById.get(v.akteId);
      return {
        id: v.id,
        antragsId: v.antragsId,
        antragsteller: akte?.antragstellerName || akte?.name || '—',
        status: v.status,
        wiedervorlage: v.wiedervorlage,
        frist: v.frist,
        ueberfaellig: istUeberfaellig(v.wiedervorlage, heute),
      };
    })
    .sort((a, b) => (a.wiedervorlage! < b.wiedervorlage! ? -1 : a.wiedervorlage! > b.wiedervorlage! ? 1 : 0));
  return c.json({ wiedervorlage: items });
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
  // Lesezugriff auf Sozialdaten protokollieren (§ 35 SGB I) — Fall geöffnet.
  await audit(c, { aktion: 'vorgang.geoeffnet', objektTyp: 'vorgang', objektId: id, vorgangId: id });
  const [akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen, protokoll] = await Promise.all([
    getAkte(vorgang.akteId), listPersonen(id), listDokumente(id),
    listPruefschritte(id), listSchreiben(id), listAktivitaeten(id),
    listFeldStatus(id), listNotizen(id), listAuditEintraege(id),
  ]);
  return c.json({ vorgang, akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen, protokoll });
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
  await audit(c, { aktion: 'vorgang.erstellt', objektTyp: 'vorgang', objektId: vorgang.id, vorgangId: vorgang.id, detail: vorgang.antragsId });
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
    const before = await getVorgang(c.req.param('id'));
    const vorgang = await updateVorgang(c.req.param('id'), updates, { expectedVersion, force });
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    await auditUpdate(c, {
      aktion: 'vorgang.geaendert', objektTyp: 'vorgang', objektId: vorgang.id, vorgangId: vorgang.id,
      before, after: vorgang,
      felder: ['status', 'wohngeldart', 'antragsart', 'sachbearbeiter', 'prioritaet', 'wohnung', 'bwz', 'frist', 'wiedervorlage'],
    });
    return c.json({ vorgang });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

vorgaengeRoutes.delete('/vorgaenge/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getVorgang(id);
  const ok = await deleteVorgang(id);
  if (ok) await audit(c, { aktion: 'vorgang.geloescht', objektTyp: 'vorgang', objektId: id, vorgangId: id, detail: before?.antragsId });
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
  await audit(c, { aktion: 'pruefung.ausgefuehrt', objektTyp: 'vorgang', objektId: id, vorgangId: id, detail: `${befunde.length} Befund(e)` });
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
    await audit(c, { aktion: 'bwz.uebernommen', objektTyp: 'vorgang', objektId: id, vorgangId: id, detail: `${vorschlag.start} – ${vorschlag.ende}` });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Übernahme fehlgeschlagen' }, 500);
  }
});

/**
 * Verfügung als PDF oder Word (docx) herunterladen (Welle 5, WP11). Read-only.
 * Zusammenfassung aus Vorgangsdaten + §13-Ergebnis + Prüfstatus. KEINE §19-Betragsfestsetzung.
 */
vorgaengeRoutes.get('/vorgaenge/:id/verfuegung/export', async (c) => {
  const fmtParam = (c.req.query('format') ?? 'pdf').toLowerCase();
  if (fmtParam !== 'pdf' && fmtParam !== 'docx') return c.json({ error: 'format muss pdf oder docx sein' }, 400);
  const format = fmtParam as DocumentFormat;
  const id = c.req.param('id');
  const snapshot = await getVorgangSnapshot(id);
  if (!snapshot) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const [akte, pruefschritte] = await Promise.all([getAkte(snapshot.vorgang.akteId), listPruefschritte(id)]);
  const unterhalt = unterhaltsabzuegeFuer(snapshot.personen);
  const einkommen = berechneVorgangEinkommen(snapshot.personen, snapshot.dokumente, unterhalt);
  const doc = verfuegungToDocument(snapshot.vorgang, akte, snapshot.personen, einkommen, pruefschritte);
  const buffer = await generateDocument(doc, format);
  await audit(c, { aktion: 'verfuegung.exportiert', objektTyp: 'verfuegung', objektId: id, vorgangId: id, detail: format });
  const base = `Verfuegung-${snapshot.vorgang.antragsId}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': getMimeType(format),
      'Content-Disposition': `attachment; filename="${base}.${format}"`,
    },
  });
});

/**
 * Verfügung speichern (Welle 5, WP11): Entscheidung + Bemerkung in vorgang.data,
 * Status → `entscheidung`, erstelltAm setzen, Aktivität. Editor-Gate.
 */
vorgaengeRoutes.put('/vorgaenge/:id/verfuegung', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const vorgang = await getVorgang(id);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  type VerfuegungBody = { entscheidung?: string; bemerkung?: string; expectedVersion?: number };
  const body = await c.req.json<VerfuegungBody>().catch(() => ({} as VerfuegungBody));
  const entscheidung = VERFUEGUNG_ENTSCHEIDUNGEN.includes(body.entscheidung as VerfuegungEntscheidung)
    ? (body.entscheidung as VerfuegungEntscheidung) : 'offen';
  try {
    const updated = await updateVorgang(id, {
      verfuegung: {
        entscheidung,
        bemerkung: body.bemerkung?.trim() || undefined,
        erstelltAm: vorgang.verfuegung?.erstelltAm ?? new Date().toISOString(),
      },
      status: 'entscheidung',
    }, { expectedVersion: body.expectedVersion ?? vorgang.version });
    await audit(c, {
      aktion: 'verfuegung.gespeichert', objektTyp: 'verfuegung', objektId: id, vorgangId: id,
      detail: `Entscheidung: ${entscheidung}`,
      vorher: { entscheidung: vorgang.verfuegung?.entscheidung ?? null },
      nachher: { entscheidung },
    });
    return c.json({ vorgang: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Speichern fehlgeschlagen' }, 500);
  }
});
