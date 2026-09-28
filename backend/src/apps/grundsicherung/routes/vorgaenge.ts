/**
 * Grundsicherung — Vorgänge: Liste (Filter), Detail (auditierter Lesezugriff), Anlegen,
 * Patch mit Diff-Audit, Status/Abschluss (Vier-Augen opt-in), Aufbewahrung, Legal Hold,
 * Einschränkung (Art. 18), Löschfällig-Liste, KI-Verbrauch, Prüfen, BWZ-Vorschlag.
 *
 * Als Fabrik mit Abhängigkeiten gebaut (`createVorgaengeRoutes(deps)`), damit die Gates
 * und das Audit mit Fakes getestet werden können; `vorgaengeRoutes` nutzt die echten.
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listVorgaenge, getVorgang, createVorgang, updateVorgang, deleteVorgang,
  getAkte, listAkten, listPersonen, listDokumente, listPruefschritte, listSchreiben, listAktivitaeten,
  listFeldStatus, listNotizen, listAuditEintraege, getVorgangSnapshot,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { audit, auditUpdate } from '../audit';
import { berechneBwzVorschlag } from '../bwz';
import { istLoeschfaellig } from '../retention';
import { dayPart } from '../../_antrag-kern/datum';
import {
  denyIfNotAppEditor, denyIfNotAppOwner, denyIfEingeschraenkt, vierAugenAktiv, getAppRole,
} from './_shared';
import { pruefeAutomatisch, pruefeUndSynchronisiere } from '../pruefung';
import { ladeSachbearbeitung } from '../sachbearbeitung';
import { kiVerbrauchFuerVorgang } from '../ki-verbrauch';
import { grunddatenFuerVorrangpruefung } from '../vorrang-grunddaten';
import { vollstaendigkeit } from '../../_vorrang/grunddaten';
import {
  bereinigeVorgangUpdates, filtereVorgaenge, planeStatusWechsel, VORGANG_AUDIT_FELDER,
} from '../vorgang-helfer';
import { ANSPRUCHSGRUENDE, ANTRAGSARTEN, type Vorgang } from '../types';

const standardDeps = {
  listVorgaenge, getVorgang, createVorgang, updateVorgang, deleteVorgang,
  getAkte, listAkten, listPersonen, listDokumente, listPruefschritte, listSchreiben, listAktivitaeten,
  listFeldStatus, listNotizen, listAuditEintraege, getVorgangSnapshot,
  audit, auditUpdate, pruefeAutomatisch, pruefeUndSynchronisiere, ladeSachbearbeitung, kiVerbrauchFuerVorgang,
  vierAugenAktiv,
};

export type VorgaengeDeps = typeof standardDeps;

const heute = () => new Date().toISOString();

function fehler409(err: unknown) {
  return err instanceof VersionConflictError ? { error: 'version_conflict', current: err.current } : null;
}

export function createVorgaengeRoutes(d: VorgaengeDeps) {
  const r = new Hono();

  /** Liste mit Filtern: akteId, status, antragsart, anspruchsgrund, sachbearbeiterId ('ich' | '-' | id), q. */
  r.get('/vorgaenge', async (c) => {
    const q = (n: string) => c.req.query(n)?.trim() || undefined;
    const [vorgaenge, akten] = await Promise.all([
      d.listVorgaenge({ akteId: q('akteId'), status: q('status'), antragsart: q('antragsart'), anspruchsgrund: q('anspruchsgrund') }),
      d.listAkten(),
    ]);
    const sb = q('sachbearbeiterId');
    const sachbearbeiterId = sb === 'ich' ? (getCurrentUserId(c) ?? '__niemand__') : sb;
    return c.json({ vorgaenge: filtereVorgaenge(vorgaenge, akten, { sachbearbeiterId, q: q('q') }) });
  });

  /** Löschfällige Vorgänge (Owner-Gate): Frist abgelaufen UND kein Legal Hold. Löschung bleibt manuell. */
  r.get('/loeschfaellig', async (c) => {
    const denied = denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const tag = heute().slice(0, 10);
    const [vorgaenge, akten] = await Promise.all([d.listVorgaenge(), d.listAkten()]);
    const akteById = new Map(akten.map((a) => [a.id, a]));
    const items = vorgaenge
      .filter((v) => istLoeschfaellig(v, tag))
      .map((v) => {
        const akte = akteById.get(v.akteId);
        return {
          id: v.id, vorgangsnummer: v.vorgangsnummer,
          antragsteller: akte?.antragstellerName || akte?.name || '—',
          status: v.status, aufbewahrungBis: v.aufbewahrungBis,
        };
      })
      .sort((a, b) => ((a.aufbewahrungBis || '') < (b.aufbewahrungBis || '') ? -1 : 1));
    return c.json({ loeschfaellig: items });
  });

  r.get('/vorgaenge/:id', async (c) => {
    const vorgang = await d.getVorgang(c.req.param('id'));
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    return c.json({ vorgang });
  });

  /** Voll-Detail für die Arbeitsfläche. Lesezugriff auf Sozialdaten wird protokolliert (§ 35 SGB I). */
  r.get('/vorgaenge/:id/detail', async (c) => {
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    await d.audit(c, { aktion: 'vorgang.geoeffnet', objektTyp: 'vorgang', objektId: id, vorgangId: id });
    const [akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen, protokoll] = await Promise.all([
      d.getAkte(vorgang.akteId), d.listPersonen(id), d.listDokumente(id),
      d.listPruefschritte(id), d.listSchreiben(id), d.listAktivitaeten(id),
      d.listFeldStatus(id), d.listNotizen(id), d.listAuditEintraege(id),
    ]);
    return c.json({ vorgang, akte, personen, dokumente, pruefschritte, schreiben, aktivitaeten, feldStatus, notizen, protokoll, vierAugen: d.vierAugenAktiv() });
  });

  /**
   * Grunddaten für eine spätere Vorrang-Einschätzung Wohngeld ↔ Grundsicherung (nur lesen,
   * keine Berechnung) plus die Liste fehlender Grunddaten. Lesezugriff wird protokolliert.
   */
  r.get('/vorgaenge/:id/vorrang-grunddaten', async (c) => {
    const id = c.req.param('id');
    const snapshot = await d.getVorgangSnapshot(id);
    if (!snapshot) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    await d.audit(c, { aktion: 'vorrang_grunddaten.gelesen', objektTyp: 'vorgang', objektId: id, vorgangId: id });
    const grunddaten = grunddatenFuerVorrangpruefung(snapshot);
    return c.json({ grunddaten, fehlend: vollstaendigkeit(grunddaten).fehlend });
  });

  /** KI-Verbrauch (Tokens) des Falls — Summe, je Phase, je Aktion, je Modell plus Verlauf. */
  r.get('/vorgaenge/:id/ki-verbrauch', async (c) => {
    const id = c.req.param('id');
    if (!(await d.getVorgang(id))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    return c.json(await d.kiVerbrauchFuerVorgang(id));
  });

  r.post('/vorgaenge', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    const akteId = typeof body?.akteId === 'string' ? body.akteId : undefined;
    if (!akteId) return c.json({ error: 'akteId ist erforderlich' }, 400);
    if (!(await d.getAkte(akteId))) return c.json({ error: 'Akte nicht gefunden' }, 404);
    const { updates } = bereinigeVorgangUpdates(body);
    if (updates.antragsart && !ANTRAGSARTEN.includes(updates.antragsart)) return c.json({ error: 'Unbekannte Antragsart' }, 400);
    if (updates.anspruchsgrund && !ANSPRUCHSGRUENDE.includes(updates.anspruchsgrund)) return c.json({ error: 'Unbekannter Anspruchsgrund' }, 400);
    // Manuell angelegt ⇒ der anlegenden Person zugewiesen (sofern sie Bearbeitungsrecht hat).
    const ich = getCurrentUserId(c);
    const zuweisung = updates.sachbearbeiterId === undefined && ich
      ? (await d.ladeSachbearbeitung()).find((n) => n.id === ich)
      : undefined;
    const vorgang = await d.createVorgang({
      ...updates, akteId, ownerId: ich,
      ...(zuweisung ? { sachbearbeiterId: zuweisung.id, sachbearbeiter: zuweisung.name } : {}),
    });
    await d.audit(c, { aktion: 'vorgang.erstellt', objektTyp: 'vorgang', objektId: vorgang.id, vorgangId: vorgang.id, detail: vorgang.vorgangsnummer });
    return c.json({ vorgang }, 201);
  });

  r.put('/vorgaenge/:id', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    try {
      const { updates, expectedVersion, force } = bereinigeVorgangUpdates(await c.req.json<Record<string, unknown>>().catch(() => null));
      if (updates.antragsart && !ANTRAGSARTEN.includes(updates.antragsart)) return c.json({ error: 'Unbekannte Antragsart' }, 400);
      if (updates.anspruchsgrund && !ANSPRUCHSGRUENDE.includes(updates.anspruchsgrund)) return c.json({ error: 'Unbekannter Anspruchsgrund' }, 400);
      // Zuweisung: nur Nutzer mit Bearbeitungsrecht; Anzeigename kommt vom Server.
      if ('sachbearbeiterId' in updates) {
        const sid = updates.sachbearbeiterId as unknown;
        if (sid === null || sid === '') {
          Object.assign(updates, { sachbearbeiterId: undefined, sachbearbeiter: undefined });
        } else {
          const n = (await d.ladeSachbearbeitung()).find((x) => x.id === sid);
          if (!n) return c.json({ error: 'Diese Person hat kein Bearbeitungsrecht für Grundsicherung.' }, 400);
          Object.assign(updates, { sachbearbeiter: n.name });
        }
      }
      const before = await d.getVorgang(id);
      if (!before) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
      const eingeschr = denyIfEingeschraenkt(before);
      if (eingeschr) return c.json(eingeschr, 403);
      const vorgang = await d.updateVorgang(id, updates, { expectedVersion, force });
      if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
      await d.auditUpdate(c, {
        aktion: 'vorgang.geaendert', objektTyp: 'vorgang', objektId: id, vorgangId: id,
        before, after: vorgang, felder: VORGANG_AUDIT_FELDER,
      });
      await d.pruefeAutomatisch(id);
      return c.json({ vorgang: (await d.getVorgang(id)) ?? vorgang });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Update fehlgeschlagen' }, 500);
    }
  });

  /**
   * Status setzen, optional mit Abschluss-Vermerk { ergebnis, bemerkung }. Finale Ergebnisse
   * unterliegen dem Vier-Augen-Prinzip (opt-in); bei Abschluss wird die Aufbewahrungsfrist gesetzt.
   */
  r.put('/vorgaenge/:id/status', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const eingeschr = denyIfEingeschraenkt(vorgang);
    if (eingeschr) return c.json(eingeschr, 403);
    type Body = { status?: unknown; abschluss?: { ergebnis?: unknown; bemerkung?: unknown } | null; expectedVersion?: number };
    const body = await c.req.json<Body>().catch(() => ({} as Body));
    const vierAugen = d.vierAugenAktiv();
    const plan = planeStatusWechsel({
      vorher: vorgang, status: body.status, abschluss: body.abschluss,
      appRole: getAppRole(c), vierAugen, heuteIso: heute(),
    });
    if (!plan.ok) return c.json({ error: plan.error }, plan.code);
    try {
      const updated = await d.updateVorgang(id, plan.updates, { expectedVersion: body.expectedVersion ?? vorgang.version });
      await d.audit(c, {
        aktion: 'vorgang.status_geaendert', objektTyp: 'vorgang', objektId: id, vorgangId: id,
        detail: `${vorgang.status} → ${plan.updates.status}${plan.updates.abschluss?.ergebnis ? ` · Ergebnis: ${plan.updates.abschluss.ergebnis}` : ''}${vierAugen ? ' · Vier-Augen aktiv' : ''}`,
        vorher: { status: vorgang.status, abschluss: vorgang.abschluss ?? null, aufbewahrungBis: vorgang.aufbewahrungBis ?? null },
        nachher: { status: updated?.status, abschluss: updated?.abschluss ?? null, aufbewahrungBis: updated?.aufbewahrungBis ?? null },
      });
      return c.json({ vorgang: updated });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Statuswechsel fehlgeschlagen' }, 500);
    }
  });

  /** Aufbewahrungsfrist manuell setzen/korrigieren (Owner-Gate, DSB/Revision). `null` = entfernen. */
  r.put('/vorgaenge/:id/aufbewahrung', async (c) => {
    const denied = denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const body = await c.req.json<{ aufbewahrungBis?: string | null; expectedVersion?: number }>().catch(() => ({} as { aufbewahrungBis?: string | null; expectedVersion?: number }));
    const bis = body.aufbewahrungBis === null || body.aufbewahrungBis === '' ? undefined : dayPart(body.aufbewahrungBis ?? undefined);
    if (bis === null) return c.json({ error: 'aufbewahrungBis muss ein Datum (JJJJ-MM-TT) oder null sein' }, 400);
    try {
      const updated = await d.updateVorgang(id, { aufbewahrungBis: bis }, { expectedVersion: body.expectedVersion ?? vorgang.version });
      await d.audit(c, {
        aktion: 'vorgang.aufbewahrung_geaendert', objektTyp: 'vorgang', objektId: id, vorgangId: id,
        vorher: { aufbewahrungBis: vorgang.aufbewahrungBis ?? null }, nachher: { aufbewahrungBis: bis ?? null },
      });
      return c.json({ vorgang: updated });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
    }
  });

  /** Legal Hold setzen/aufheben (Owner-Gate). Verhindert die Löschung. */
  r.put('/vorgaenge/:id/legal-hold', async (c) => {
    const denied = denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const body = await c.req.json<{ legalHold?: boolean; expectedVersion?: number }>().catch(() => ({} as { legalHold?: boolean; expectedVersion?: number }));
    const legalHold = !!body.legalHold;
    if (legalHold === !!vorgang.legalHold) return c.json({ vorgang }); // idempotent
    try {
      const updated = await d.updateVorgang(id, { legalHold }, { expectedVersion: body.expectedVersion ?? vorgang.version });
      await d.audit(c, {
        aktion: legalHold ? 'vorgang.legal_hold_gesetzt' : 'vorgang.legal_hold_aufgehoben',
        objektTyp: 'vorgang', objektId: id, vorgangId: id,
        detail: legalHold ? 'Löschsperre gesetzt' : 'Löschsperre aufgehoben',
      });
      return c.json({ vorgang: updated });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
    }
  });

  /** Einschränkung (Art. 18 DSGVO): Setzen Editor/Owner, Aufheben nur Owner. */
  r.put('/vorgaenge/:id/einschraenkung', async (c) => {
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const body = await c.req.json<{ eingeschraenkt?: boolean; expectedVersion?: number }>().catch(() => ({} as { eingeschraenkt?: boolean; expectedVersion?: number }));
    const eingeschraenkt = !!body.eingeschraenkt;
    const denied = eingeschraenkt ? denyIfNotAppEditor(c) : denyIfNotAppOwner(c);
    if (denied) {
      return c.json(eingeschraenkt ? denied : { error: 'Aufheben der Einschränkung nur durch Owner (DSB/Revision).' }, 403);
    }
    if (eingeschraenkt === !!vorgang.eingeschraenkt) return c.json({ vorgang }); // idempotent
    try {
      const updated = await d.updateVorgang(id, { eingeschraenkt }, { expectedVersion: body.expectedVersion ?? vorgang.version });
      await d.audit(c, {
        aktion: eingeschraenkt ? 'vorgang.einschraenkung_gesetzt' : 'vorgang.einschraenkung_aufgehoben',
        objektTyp: 'vorgang', objektId: id, vorgangId: id,
        detail: eingeschraenkt ? 'Verarbeitung eingeschränkt (Art. 18)' : 'Einschränkung aufgehoben',
      });
      return c.json({ vorgang: updated });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Aktion fehlgeschlagen' }, 500);
    }
  });

  r.delete('/vorgaenge/:id', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const before = await d.getVorgang(id);
    if (!before) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    if (before.legalHold) return c.json({ error: 'Löschung gesperrt: Für diesen Vorgang besteht ein Legal Hold.' }, 409);
    const eingeschr = denyIfEingeschraenkt(before);
    if (eingeschr) return c.json(eingeschr, 403);
    const ok = await d.deleteVorgang(id);
    if (ok) await d.audit(c, { aktion: 'vorgang.geloescht', objektTyp: 'vorgang', objektId: id, vorgangId: id, detail: before.vorgangsnummer });
    return ok ? c.json({ ok: true }) : c.json({ error: 'Vorgang nicht gefunden' }, 404);
  });

  /** Regel-Engine ausführen und Prüfschritte synchronisieren (idempotent). */
  r.post('/vorgaenge/:id/pruefen', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const eingeschr = denyIfEingeschraenkt(vorgang);
    if (eingeschr) return c.json(eingeschr, 403);
    const erg = await d.pruefeUndSynchronisiere(id);
    if (!erg) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    await d.audit(c, { aktion: 'pruefung.ausgefuehrt', objektTyp: 'vorgang', objektId: id, vorgangId: id, detail: `${erg.befundeCount} Befund(e)` });
    return c.json({ pruefschritte: erg.pruefschritte, befundeCount: erg.befundeCount, geprueftAm: erg.geprueftAm });
  });

  /** BWZ-Vorschlag übernehmen: 12 Monate ab Monatserster des Antragsmonats (nur Vorschlag). */
  r.post('/vorgaenge/:id/bwz-vorschlag-uebernehmen', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const id = c.req.param('id');
    const vorgang = await d.getVorgang(id);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const eingeschr = denyIfEingeschraenkt(vorgang);
    if (eingeschr) return c.json(eingeschr, 403);
    const vorschlag = berechneBwzVorschlag(vorgang.antragsdatum);
    if (!vorschlag) return c.json({ error: 'Kein Antragsdatum vorhanden — Vorschlag nicht berechenbar' }, 400);
    try {
      const updated = await d.updateVorgang(id, { bwz: vorschlag } as Partial<Vorgang>, { expectedVersion: vorgang.version });
      await d.audit(c, {
        aktion: 'bwz.uebernommen', objektTyp: 'vorgang', objektId: id, vorgangId: id,
        detail: `${vorschlag.start} – ${vorschlag.ende}`, vorher: { bwz: vorgang.bwz ?? null }, nachher: { bwz: vorschlag },
      });
      await d.pruefeAutomatisch(id);
      return c.json({ vorgang: (await d.getVorgang(id)) ?? updated });
    } catch (err) {
      const k = fehler409(err);
      if (k) return c.json(k, 409);
      return c.json({ error: 'Übernahme fehlgeschlagen' }, 500);
    }
  });

  return r;
}

export const vorgaengeRoutes = createVorgaengeRoutes(standardDeps);
