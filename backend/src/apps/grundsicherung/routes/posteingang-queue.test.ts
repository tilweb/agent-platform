/**
 * Grundsicherung — Posteingang-Adapter mit Kern-Fakes (Store, Ablage, KI-Verbrauch, DP-Erkennung)
 * über `app.request(...)`: Einliefern (Quelle Weiterleitung) → Auswerten (Profil, Trennung) →
 * Zuordnen (neuer Vorgang mit Ersteingang, KI-Verbrauch geht an den Vorgang) → Upload am Vorgang.
 * Keine DB, kein LLM.
 */
import { describe, expect, test } from 'bun:test';
import { Hono, type Context } from 'hono';
import { createPosteingangQueue, type PosteingangQueueDeps } from './posteingang-queue';
import { createVerteilung } from '../verteilung';
import { fakeVerteilungDeps } from '../test-fakes';
import { mappeAbschnitt, type ErkannterAbschnitt, type ProfilLauf } from '../dp-erkennung';
import { buildGrundsicherungEingangProject } from '../../../extraction/templates/grundsicherung-eingang';
import type { KiBezug } from '../../_antrag-kern/ki-verbrauch';
import type { AuditEvent } from '../audit';
import type { Posteingang, PosteingangDatei } from '../types';

function fakeStore() {
  const rows = new Map<string, Posteingang>();
  let n = 0;
  const kopie = (e: Posteingang) => structuredClone(e);
  const store: PosteingangQueueDeps['store'] = {
    async listPosteingang() { return [...rows.values()].map(kopie); },
    async getPosteingang(id) { const e = rows.get(id); return e ? kopie(e) : null; },
    async findePosteingangNachHash(hash) { const e = [...rows.values()].find((x) => x.hash === hash && x.status !== 'verworfen'); return e ? kopie(e) : null; },
    async createPosteingang(input = {}) {
      n += 1;
      const e = { id: `pe-${n}`, quelle: 'manuell', eingegangenAm: new Date().toISOString(), status: 'eingegangen', dateien: [], data: {}, version: 1, created_at: '', updated_at: '', ...input } as Posteingang;
      rows.set(e.id, e);
      return kopie(e);
    },
    async updatePosteingang(id, updates) {
      const e = rows.get(id);
      if (!e) return null;
      const neu = { ...e, ...structuredClone(updates), version: e.version + 1 } as Posteingang;
      rows.set(id, neu);
      return kopie(neu);
    },
    async deletePosteingang(id) { return rows.delete(id); },
    async setzePosteingangFortschritt(id, f) { const e = rows.get(id); if (e) rows.set(id, { ...e, data: { ...(e.data ?? {}), fortschritt: f ?? undefined } }); },
  };
  return { store, rows };
}

function fakeAblage() {
  const dateien = new Map<string, Uint8Array>();
  let n = 0;
  return {
    dateien,
    async storeUpload(bytes: Uint8Array, filename: string) { n += 1; dateien.set(`mem/${n}/${filename}`, bytes); return { storageRef: `local:mem/${n}/${filename}`, filename }; },
    resolveStorageRef(ref?: string) { return ref?.startsWith('local:') ? { pfad: ref.slice(6) } : {}; },
    async loadDokumentDatei(ref: { s3Key?: string; pfad?: string }) { return (ref.pfad && dateien.get(ref.pfad)) || null; },
    async removeStoredFile() {},
  };
}

const profil = buildGrundsicherungEingangProject();
function abschnitt(typ: string, von: number, bis: number, roh: Record<string, unknown>): ErkannterAbschnitt {
  return { ...mappeAbschnitt(typ, roh), abschnitt: typ, seiteVon: von, seiteBis: bis, konfidenz: 0.9, text: `${typ} Text`, rohwerte: roh, extraktion: { felder: [] } };
}
const ANTRAG_ROH = {
  antragsart: 'Erstantrag', antragsdatum: '2026-09-01', anspruchsgrund: 'Altersgrenze erreicht', unterschrift_vorhanden: true,
  antragsteller_nachname: 'Meyer', antragsteller_vorname: 'Gerda', antragsteller_geburtsdatum: '1955-05-05', kein_vermoegen: true,
  plz: '26789', ort: 'Leer', kaltmiete: 400,
};

function aufbau(opts: { splitAktiv?: boolean } = {}) {
  const { store, rows } = fakeStore();
  const ablage = fakeAblage();
  const verteilung = fakeVerteilungDeps();
  const audits: AuditEvent[] = [];
  const messungen: Array<{ aktion: string; bezug: KiBezug }> = [];
  const zugeordnet: Array<[string, string, boolean]> = [];
  const gebauteTeile: number[][] = [];
  const v = createVerteilung(verteilung.deps);

  const deps: PosteingangQueueDeps = {
    store,
    ablage,
    split: {
      trenneManuell: async () => { throw new Error('nicht im Test'); },
      splitAktiv: () => opts.splitAktiv ?? false,
      baueTeile: async (original, _bytes, _seiten, bereiche) => {
        gebauteTeile.push(bereiche.map((b) => b.from));
        return bereiche.map((b, i) => ({ ...original, dateiname: `teil${i + 1}.pdf`, hash: `${original.hash}-${i + 1}`, pfad: original.pfad, teilVon: { dateiname: original.dateiname, hash: original.hash, contentType: original.contentType, groesse: 1, seitenGesamt: 3, seiteVon: b.from, seiteBis: b.to, teilNr: i + 1, teileGesamt: bereiche.length } }) as PosteingangDatei);
      },
    },
    audit: async (_c: Context, e: AuditEvent) => { audits.push(e); },
    kiVerbrauch: {
      messeKiVerbrauch: async (aktion, bezug, fn) => { messungen.push({ aktion, bezug }); return fn(); },
      ordneKiVerbrauchZu: async (pid, vid, neu) => { zugeordnet.push([pid, vid, neu]); },
      kiVerbrauchFuerPosteingang: async () => ({ summe: { anzahl: 0, aufrufe: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, ohneAngabe: 0 } }) as never,
    },
    vorschau: { info: async () => ({ art: 'keine' }), seitenAntwort: async () => new Response('') },
    ladeProfil: async () => ({ profil, beispiele: [], quelle: 'vorlage' as const }),
    erkenne: async (): Promise<ProfilLauf> => ({
      abschnitte: [
        abschnitt('grundsicherungsantrag', 1, 2, ANTRAG_ROH),
        abschnitt('personalausweis', 3, 3, { nachname: 'Meyer', vorname: 'Gerda', geburtsdatum: '1955-05-05' }),
      ],
      seiten: 3, quelle: 'vorlage', hinweise: [],
    }),
    verteile: v.verteileDokumente,
    ermittleMatchKandidaten: v.ermittleMatchKandidaten,
    getVorgang: verteilung.deps.getVorgang,
  };
  const q = createPosteingangQueue(deps);
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('appRole' as never, 'editor' as never); c.set('userId' as never, 'u1' as never); await next(); });
  app.route('/', q.routes);
  return { app, q, rows, verteilung, audits, messungen, zugeordnet, gebauteTeile };
}

function formular(felder: Record<string, string>, dateiname = 'eingang.pdf') {
  const fd = new FormData();
  fd.append('files', new File([new Uint8Array([37, 80, 68, 70])], dateiname, { type: 'application/pdf' }));
  for (const [k, w] of Object.entries(felder)) fd.append(k, w);
  return { method: 'POST', body: fd };
}
const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('Posteingang Grundsicherung — Einliefern, Auswerten, Zuordnen', () => {
  test('Weiterleitung → Auswertung über Profil → neuer Vorgang mit Ersteingang, KI-Verbrauch zugeordnet', async () => {
    const t = aufbau();
    const ein = await t.app.request('/posteingang/ingest', formular({ quelle: 'weiterleitung', eingegangenAm: '2026-09-03T09:00:00.000Z', betreff: 'Weitergeleitet von Wohngeldstelle Leer' }));
    expect(ein.status).toBe(201);
    const { id } = await ein.json() as { id: string };
    expect(t.rows.get(id)!.quelle).toBe('weiterleitung');

    expect((await t.app.request('/posteingang/analysieren', json({ ids: [id] }))).status).toBe(202);
    await t.q.hintergrund();
    const nachAuswertung = t.rows.get(id)!;
    expect(nachAuswertung.status).toBe('analysiert');
    // ohne Trennung: größter Abschnitt bestimmt die Datei
    expect(nachAuswertung.dateien[0]!.typ).toBe('grundsicherungsantrag');
    expect(nachAuswertung.dateien[0]!.stammdaten!.antragsteller).toEqual({ nachname: 'Meyer', vorname: 'Gerda', geburtsdatum: '1955-05-05' });
    expect(nachAuswertung.dateien[0]!.profil).toMatchObject({ abschnitt: 'grundsicherungsantrag', quelle: 'vorlage' });
    expect(nachAuswertung.betreff).toBe('Meyer, Gerda — Erstantrag (weitergeleitet von Wohngeldstelle Leer)');
    expect(nachAuswertung.matchVorschlag).toEqual([]);
    // Governance-Metadaten am Messbereich
    expect(t.messungen[0]).toMatchObject({ aktion: 'posteingang_auswertung', bezug: { posteingangId: id } });
    expect(t.messungen[0]!.bezug.detail).toContain('Profil grundsicherung-eingang');

    const zu = await t.app.request(`/posteingang/${id}/zuordnen`, json({}));
    expect(zu.status).toBe(200);
    const antwort = await zu.json() as { posteingang: Posteingang; vorgang: { id: string; ersteingang: unknown; antragsdatum: string }; akte: { name: string }; befundeCount: number };
    expect(antwort.posteingang.status).toBe('zugeordnet');
    expect(antwort.posteingang.zugeordneterVorgangId).toBe(antwort.vorgang.id);
    expect(antwort.vorgang.ersteingang).toEqual({ datum: '2026-09-03', stelle: 'Wohngeldstelle Leer' });
    expect(antwort.vorgang.antragsdatum).toBe('2026-09-01');
    expect(antwort.akte.name).toBe('Meyer, Gerda');
    expect(antwort.befundeCount).toBe(3);
    expect(t.zugeordnet).toEqual([[id, antwort.vorgang.id, true]]);
    const personen = [...t.verteilung.personen.values()];
    expect(personen.map((p) => [p.rolle, p.vorname, p.vermoegen])).toEqual([['antragsteller', 'Gerda', []]]);
    expect([...t.verteilung.dokumente.values()][0]!.personId).toBe(personen[0]!.id);
    expect(t.audits.map((a) => a.aktion)).toContain('posteingang.zugeordnet');

    // Zweite Zuordnung ist gesperrt (Terminal)
    expect((await t.app.request(`/posteingang/${id}/zuordnen`, json({}))).status).toBe(409);
  });

  test('Sammel-PDF: Trennung in Teile je Abschnitt; Match-Vorschlag bei bestehendem Vorgang', async () => {
    const t = aufbau({ splitAktiv: true });
    // bestehender Vorgang derselben Person
    await t.verteilung.deps.createAkte({ name: 'Meyer, Gerda' });
    const vg = await t.verteilung.deps.createVorgang({ akteId: 'akte-1' });
    await t.verteilung.deps.createPerson({ vorgangId: vg.id, rolle: 'antragsteller', nachname: 'Meyer', vorname: 'Gerda', geburtsdatum: '1955-05-05' });

    const { id } = await (await t.app.request('/posteingang/ingest', formular({}))).json() as { id: string };
    await t.app.request('/posteingang/analysieren', json({ ids: [id] }));
    await t.q.hintergrund();
    const e = t.rows.get(id)!;
    expect(t.gebauteTeile).toEqual([[1, 3]]);
    expect(e.dateien.map((d) => d.typ)).toEqual(['grundsicherungsantrag', 'personalausweis']);
    expect(e.dateien[1]!.identitaet).toEqual({ nachname: 'Meyer', vorname: 'Gerda', geburtsdatum: '1955-05-05' });
    expect(e.matchVorschlag![0]).toMatchObject({ vorgangId: vg.id, level: 'hoch' });
    expect(t.audits.map((a) => a.aktion)).toContain('posteingang.getrennt');

    // Nachreichung über den Vorschlag
    const zu = await (await t.app.request(`/posteingang/${id}/zuordnen`, json({ vorgangId: vg.id, viaVorschlag: true, matchLevel: 'hoch' }))).json() as { vorgang: { id: string } };
    expect(zu.vorgang.id).toBe(vg.id);
    expect(t.zugeordnet).toEqual([[id, vg.id, false]]);
    expect([...t.verteilung.personen.values()]).toHaveLength(1);        // keine Personen-Dubletten
    expect([...t.verteilung.dokumente.values()].every((d) => d.personId)).toBe(true);
  });

  test('Quelle unbekannt → manuell; Zuordnen vor Auswertung abgelehnt', async () => {
    const t = aufbau();
    const { id } = await (await t.app.request('/posteingang/ingest', formular({ quelle: 'fax' }))).json() as { id: string };
    expect(t.rows.get(id)!.quelle).toBe('manuell');
    expect((await t.app.request(`/posteingang/${id}/zuordnen`, json({}))).status).toBe(409);
  });
});

describe('Upload am Vorgang', () => {
  test('gleiche Erkennung, Verteilung an den Vorgang, KI-Verbrauch „dokument_upload" am Vorgang', async () => {
    const t = aufbau();
    await t.verteilung.deps.createAkte({ name: 'Meyer, Gerda' });
    const vg = await t.verteilung.deps.createVorgang({ akteId: 'akte-1', antragsdatum: '2026-08-01' });
    const r = await t.app.request(`/vorgaenge/${vg.id}/dokumente/upload`, formular({}));
    expect(r.status).toBe(201);
    const body = await r.json() as { dokumente: Array<{ typ: string }>; dokument: { typ: string }; befundeCount: number };
    expect(body.dokument.typ).toBe('grundsicherungsantrag');
    expect(body.befundeCount).toBe(3);
    expect(t.messungen[0]).toMatchObject({ aktion: 'dokument_upload', bezug: { vorgangId: vg.id, phase: 'bearbeitung' } });
    expect(t.verteilung.vorgaenge.get(vg.id)!.antragsdatum).toBe('2026-08-01');   // Handeingabe bleibt
    expect((await t.app.request('/vorgaenge/fehlt/dokumente/upload', formular({}))).status).toBe(404);
  });
  test('eingeschränkter Vorgang (Art. 18) → 403', async () => {
    const t = aufbau();
    const vg = await t.verteilung.deps.createVorgang({ akteId: 'a', eingeschraenkt: true });
    expect((await t.app.request(`/vorgaenge/${vg.id}/dokumente/upload`, formular({}))).status).toBe(403);
  });
});
