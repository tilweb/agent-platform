/**
 * Antrag-Kern — Routen-Fabrik des Posteingangs mit In-Memory-Fakes
 * (Store, Ablage, Audit, KI-Verbrauch, Split, fachliche Hooks) über `app.request(...)`.
 */
import { describe, test, expect } from 'bun:test';
import { Hono, type Context } from 'hono';
import type { KiVerbrauchUebersicht } from '../ki-verbrauch';
import { createPosteingangRoutes, type PosteingangAuditEvent, type PosteingangRoutenOptionen } from './routen';
import type { PosteingangStore } from './store';
import type { Posteingang, PosteingangDateiBasis } from './typen';

type Datei = PosteingangDateiBasis<'antrag' | 'nachweis'> & { notiz?: string };
type Eingang = Posteingang<Datei, { id: string }>;

// ── Fakes ────────────────────────────────────────────────────────────────────

function fakeStore(): PosteingangStore<Eingang> & { rows: Map<string, Eingang> } {
  const rows = new Map<string, Eingang>();
  let n = 0;
  const kopie = (e: Eingang): Eingang => structuredClone(e);
  return {
    rows,
    async listPosteingang(filter) {
      return [...rows.values()]
        .filter((e) => (!filter?.status || e.status === filter.status) && (!filter?.quelle || e.quelle === filter.quelle))
        .sort((a, b) => b.eingegangenAm.localeCompare(a.eingegangenAm))
        .map(kopie);
    },
    async getPosteingang(id) { const e = rows.get(id); return e ? kopie(e) : null; },
    async findePosteingangNachHash(hash) {
      const e = [...rows.values()].filter((x) => x.hash === hash && x.status !== 'verworfen')
        .sort((a, b) => b.eingegangenAm.localeCompare(a.eingegangenAm))[0];
      return e ? kopie(e) : null;
    },
    async createPosteingang(input = {}) {
      n += 1;
      const jetzt = new Date().toISOString();
      const e: Eingang = {
        id: `pe-${n}`, quelle: input.quelle ?? 'manuell', eingegangenAm: input.eingegangenAm ?? jetzt,
        betreff: input.betreff, status: input.status ?? 'eingegangen', dateien: input.dateien ?? [],
        matchVorschlag: input.matchVorschlag, bearbeiterId: input.bearbeiterId, hash: input.hash,
        data: input.data ?? {}, version: 1, created_at: jetzt, updated_at: jetzt,
      };
      rows.set(e.id, e);
      return kopie(e);
    },
    async updatePosteingang(id, updates) {
      const e = rows.get(id);
      if (!e) return null;
      const neu = { ...e, ...structuredClone(updates), id, version: e.version + 1 } as Eingang;
      rows.set(id, neu);
      return kopie(neu);
    },
    async deletePosteingang(id) { return rows.delete(id); },
    async setzePosteingangFortschritt(id, f) {
      const e = rows.get(id);
      if (!e) return;
      const data = { ...(e.data ?? {}) };
      if (f === null) delete data.fortschritt; else data.fortschritt = f;
      rows.set(id, { ...e, data });
    },
  };
}

function fakeAblage() {
  const dateien = new Map<string, Uint8Array>();
  const entfernt: string[] = [];
  let n = 0;
  return {
    dateien, entfernt,
    async storeUpload(bytes: Uint8Array, filename: string) {
      n += 1;
      const key = `mem/${n}/${filename}`;
      dateien.set(key, bytes);
      return { storageRef: `local:${key}`, filename };
    },
    resolveStorageRef(ref?: string) {
      return ref?.startsWith('local:') ? { pfad: ref.slice(6) } : {};
    },
    async loadDokumentDatei(ref: { s3Key?: string; pfad?: string }) {
      return (ref.pfad && dateien.get(ref.pfad)) || null;
    },
    async removeStoredFile(ref: { s3Key?: string; pfad?: string }) {
      if (ref.pfad) { entfernt.push(ref.pfad); dateien.delete(ref.pfad); }
    },
  };
}

interface Aufbau {
  store: ReturnType<typeof fakeStore>;
  ablage: ReturnType<typeof fakeAblage>;
  audits: PosteingangAuditEvent[];
  ki: string[];
  zuordnungen: string[];
  app: Hono;
  kern: ReturnType<typeof createPosteingangRoutes<Datei, { id: string }, Eingang>>;
}

function aufbau(rolle: 'owner' | 'editor' | 'viewer' = 'editor', over: Partial<PosteingangRoutenOptionen<Datei, { id: string }, Eingang>> = {}): Aufbau {
  const store = fakeStore();
  const ablage = fakeAblage();
  const audits: PosteingangAuditEvent[] = [];
  const ki: string[] = [];
  const zuordnungen: string[] = [];
  const leer: KiVerbrauchUebersicht = { summe: { aufrufe: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, ohneAngabe: 0 }, jePhase: {}, jeAktion: [], jeModell: [], eintraege: [] } as unknown as KiVerbrauchUebersicht;

  const kern = createPosteingangRoutes<Datei, { id: string }, Eingang>({
    store,
    ablage,
    split: {
      trenneManuell: (async (original: Datei, startSeiten: number[]) => {
        if (startSeiten.length < 2) {
          return { dateien: [{ ...original, typ: undefined, trennung: { status: 'ein_dokument', seitenGesamt: 4, manuell: true } }], getrennt: false, bereiche: [{ from: 1, to: 4 }], seitenGesamt: 4 };
        }
        const teil = (nr: number, von: number, bis: number): Datei => ({
          dateiname: `teil-${nr}.pdf`, contentType: 'application/pdf', groesse: 1, hash: `h-teil-${nr}`, pfad: `mem/teil-${nr}.pdf`,
          teilVon: { dateiname: original.dateiname, pfad: original.pfad, hash: original.hash, contentType: 'application/pdf', groesse: original.groesse, seitenGesamt: 4, seiteVon: von, seiteBis: bis, teilNr: nr, teileGesamt: 2, manuell: true },
        });
        return { dateien: [teil(1, 1, 1), teil(2, 2, 4)], getrennt: true, bereiche: [{ from: 1, to: 1 }, { from: 2, to: 4 }], seitenGesamt: 4 };
      }) as never,
    },
    audit: async (_c, e) => { audits.push(e); },
    kiVerbrauch: {
      messeKiVerbrauch: async (aktion, _bezug, fn) => { ki.push(aktion); return fn(); },
      ordneKiVerbrauchZu: async (pe, vorgang, neu) => { ki.push(`zu:${pe}:${vorgang}:${neu}`); },
      kiVerbrauchFuerPosteingang: async () => leer,
    },
    guards: {
      denyIfNotAppEditor: (c) => (['owner', 'editor'].includes(c.get('appRole') as string) ? null : { error: 'kein Editor' }),
      denyIfVorgangEingeschraenkt: async (id) => (id === 'v-gesperrt' ? { error: 'eingeschränkt' } : null),
    },
    vorschau: {
      info: async () => ({ art: 'pdf', seiten: 1 }),
      seitenAntwort: async () => new Response('png'),
    },
    analysiere: async (dateien) => ({
      dateien: dateien.map((d) => ({ ...d, typ: d.dateiname.includes('kaputt') ? undefined : 'antrag' as const, analyseFehler: d.dateiname.includes('kaputt') ? 'nicht lesbar' : undefined })),
      protokoll: [],
    }),
    werteNeueDateienAus: async (dateien) => { for (const d of dateien) d.typ = 'nachweis'; },
    werteUmschlagAus: async (dateien, betreffAlt) => ({
      matchVorschlag: dateien.some((d) => d.typ) ? [{ id: 'v-1' }] : [],
      betreff: dateien[0]?.dateiname ?? betreffAlt,
    }),
    zuordnen: async (_c, eingang, body) => {
      zuordnungen.push(eingang.id);
      if (body.fehler) return { ok: false, error: 'Vorgang nicht gefunden', status: 404 };
      return { ok: true, vorgangId: 'v-1', akteId: 'a-1', istNeuerVorgang: true, detail: 'zugeordnet', antwort: { vorgang: { id: 'v-1' }, akte: { id: 'a-1' } } };
    },
    maxGesamtBytes: 1024,
    logPraefix: '[test]',
    ...over,
  });

  const app = new Hono();
  app.use('*', async (c, next) => { c.set('appRole' as never, rolle as never); c.set('userId' as never, 'u-1' as never); await next(); });
  app.route('/', kern.routes);
  return { store, ablage, audits, ki, zuordnungen, app, kern };
}

function formular(dateien: Array<[string, string]>, felder: Record<string, string> = {}): FormData {
  const f = new FormData();
  for (const [name, inhalt] of dateien) f.append('files', new File([inhalt], name, { type: 'application/pdf' }));
  for (const [k, v] of Object.entries(felder)) f.append(k, v);
  return f;
}

async function ingest(a: Aufbau, dateien: Array<[string, string]>, felder: Record<string, string> = {}) {
  const res = await a.app.request('/posteingang/ingest', { method: 'POST', body: formular(dateien, felder) });
  return { status: res.status, body: await res.json() as { id: string; duplicate?: boolean; posteingang: Eingang; error?: string } };
}

const post = (a: Aufbau, pfad: string, body: unknown) =>
  a.app.request(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function auswerten(a: Aufbau, id: string) {
  const res = await post(a, '/posteingang/analysieren', { ids: [id] });
  await a.kern.hintergrund();
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ingest / einliefern', () => {
  test('legt Eingang an, speichert Dateien, protokolliert', async () => {
    const a = aufbau();
    const r = await ingest(a, [['antrag.pdf', 'A'], ['beleg.pdf', 'B']], { quelle: 'scan', betreff: 'Test' });
    expect(r.status).toBe(201);
    expect(r.body.posteingang).toMatchObject({ status: 'eingegangen', quelle: 'scan', betreff: 'Test', bearbeiterId: 'u-1' });
    expect(r.body.posteingang.dateien.map((d) => d.dateiname)).toEqual(['antrag.pdf', 'beleg.pdf']);
    expect(r.body.posteingang.dateien[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.ablage.dateien.size).toBe(2);
    expect(a.audits.map((e) => e.aktion)).toEqual(['posteingang.eingegangen']);
    expect(a.audits[0]!.detail).toBe('2 Datei(en) über „scan" eingeliefert');
  });

  test('Dedupe per Umschlag-Hash (Reihenfolge egal)', async () => {
    const a = aufbau();
    const erst = await ingest(a, [['a.pdf', 'A'], ['b.pdf', 'B']]);
    const zweit = await ingest(a, [['b.pdf', 'B'], ['a.pdf', 'A']]);
    expect(zweit.status).toBe(200);
    expect(zweit.body).toMatchObject({ duplicate: true, id: erst.body.id });
    expect(a.store.rows.size).toBe(1);
    expect(a.audits.map((e) => e.aktion)).toEqual(['posteingang.eingegangen', 'posteingang.dublette_ignoriert']);
  });

  test('Dedupe per idempotencyKey, verworfene zählen nicht', async () => {
    const a = aufbau();
    const erst = await ingest(a, [['a.pdf', 'A']], { idempotencyKey: 'scan-1' });
    const zweit = await ingest(a, [['anders.pdf', 'X']], { idempotencyKey: 'scan-1' });
    expect(zweit.body.duplicate).toBe(true);
    await post(a, `/posteingang/${erst.body.id}/verwerfen`, { grund: 'Test' });
    const dritt = await ingest(a, [['anders.pdf', 'X']], { idempotencyKey: 'scan-1' });
    expect(dritt.status).toBe(201);
  });

  test('unbekannte bzw. nicht zugelassene Quelle ⇒ manuell', async () => {
    const a = aufbau('editor', { quellen: ['manuell', 'scan'] });
    expect((await ingest(a, [['a.pdf', 'A']], { quelle: 'weiterleitung' })).body.posteingang.quelle).toBe('manuell');
    expect((await ingest(aufbau(), [['a.pdf', 'A']], { quelle: 'weiterleitung' })).body.posteingang.quelle).toBe('weiterleitung');
  });

  test('ohne Datei 400, zu groß 413', async () => {
    const a = aufbau();
    expect((await ingest(a, [])).status).toBe(400);
    const gross = await ingest(a, [['a.pdf', 'x'.repeat(2000)]]);
    expect(gross.status).toBe(413);
    expect(gross.body.error).toBe('Upload zu groß (max. 0 MB gesamt)');
    expect(a.store.rows.size).toBe(0);
  });

  test('einliefern() ohne HTTP', async () => {
    const a = aufbau();
    const kontext = {} as Context;
    const bytes = new TextEncoder().encode('Weitergeleitet');
    const r = await a.kern.einliefern([{ bytes, dateiname: 'mail.pdf', contentType: 'application/pdf' }], { kontext, quelle: 'weiterleitung', betreff: 'Weiterleitung' });
    expect(r.art).toBe('neu');
    if (r.art === 'zu_gross') throw new Error('unerwartet');
    expect(r.posteingang).toMatchObject({ quelle: 'weiterleitung', betreff: 'Weiterleitung', status: 'eingegangen' });
    const noch = await a.kern.einliefern([{ bytes, dateiname: 'mail.pdf' }], { kontext });
    expect(noch.art).toBe('dublette');
    expect(a.audits.map((e) => e.aktion)).toEqual(['posteingang.eingegangen', 'posteingang.dublette_ignoriert']);
  });
});

describe('Rollen-Guard', () => {
  test('Nicht-Editor ⇒ 403 bei allen Schreibrouten, Lesen erlaubt', async () => {
    const a = aufbau('viewer');
    const e = await a.store.createPosteingang({ status: 'analysiert' });
    expect((await a.app.request('/posteingang/ingest', { method: 'POST', body: formular([['a.pdf', 'A']]) })).status).toBe(403);
    expect((await post(a, '/posteingang/analysieren', { ids: [e.id] })).status).toBe(403);
    expect((await post(a, `/posteingang/${e.id}/zuordnen`, {})).status).toBe(403);
    expect((await post(a, `/posteingang/${e.id}/verwerfen`, {})).status).toBe(403);
    expect((await post(a, `/posteingang/${e.id}/trennung`, { hash: 'x' })).status).toBe(403);
    expect((await a.app.request(`/posteingang/${e.id}`, { method: 'PATCH', body: '{}' })).status).toBe(403);
    expect((await a.app.request(`/posteingang/${e.id}`, { method: 'DELETE' })).status).toBe(403);
    expect((await a.app.request('/posteingang')).status).toBe(200);
    expect(a.store.rows.get(e.id)!.status).toBe('analysiert');
  });
});

describe('Auswertung im Hintergrund', () => {
  test('setzt in_analyse, ruft Hook, setzt Ergebnis + Fortschritt weg', async () => {
    let freigabe: () => void = () => {};
    const gate = new Promise<void>((r) => { freigabe = r; });
    const gesehen: string[] = [];
    const a = aufbau('editor', {
      analysiere: async (dateien, { melder }) => {
        gesehen.push(...dateien.map((d) => d.dateiname));
        melder.setze({ phase: 'auslesen', text: 'läuft' });
        await gate;
        return { dateien: dateien.map((d) => ({ ...d, typ: 'antrag' as const })), protokoll: [{ dateiname: 'a.pdf', bereiche: [{ from: 1, to: 2 }, { from: 3, to: 3 }], modell: 'M' }] };
      },
    });
    const { body } = await ingest(a, [['a.pdf', 'A']]);
    const res = await post(a, '/posteingang/analysieren', { ids: [body.id, 'gibtsnicht'] });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ gestartet: [body.id], abgelehnt: [{ id: 'gibtsnicht', error: 'Eingang nicht gefunden' }] });
    expect(a.store.rows.get(body.id)!.status).toBe('in_analyse');
    expect(a.store.rows.get(body.id)!.data?.fortschritt).toBeDefined();

    freigabe();
    await a.kern.hintergrund();
    const e = a.store.rows.get(body.id)!;
    expect(gesehen).toEqual(['a.pdf']);
    expect(e.status).toBe('analysiert');
    expect(e.matchVorschlag).toEqual([{ id: 'v-1' }]);
    expect(e.betreff).toBe('a.pdf');
    expect(e.data?.fortschritt).toBeUndefined();
    expect(a.ki).toEqual(['posteingang_auswertung']);
    expect(a.audits.slice(1).map((x) => [x.aktion, x.detail])).toEqual([
      ['posteingang.getrennt', '„a.pdf" automatisch in 2 Dokumente getrennt (S. 1–2, S. 3) · Modell M'],
      ['posteingang.analysiert', '1 Datei(en) ausgewertet, 1 Vorschlag/Vorschläge'],
    ]);
  });

  test('alle Dateien fehlerhaft ⇒ Status fehler', async () => {
    const a = aufbau();
    const { body } = await ingest(a, [['kaputt.pdf', 'K']]);
    await auswerten(a, body.id);
    expect(a.store.rows.get(body.id)!.status).toBe('fehler');
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.analyse_fehler', ergebnis: 'fehler' });
  });

  test('Hook wirft ⇒ Status fehler, Audit mit Meldung', async () => {
    const a = aufbau('editor', { analysiere: async () => { throw new Error('Modell weg'); } });
    const { body } = await ingest(a, [['a.pdf', 'A']]);
    await auswerten(a, body.id);
    expect(a.store.rows.get(body.id)!.status).toBe('fehler');
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.analyse_fehler', detail: 'Modell weg' });
  });

  test('nicht auswertbar abgelehnt; hängende Auswertung darf neu starten', async () => {
    const a = aufbau();
    const zu = await a.store.createPosteingang({ status: 'zugeordnet' });
    const laeuft = await a.store.createPosteingang({ status: 'in_analyse', data: { fortschritt: { phase: 'seiten', text: '', gestartet: '', aktualisiert: new Date().toISOString() } } });
    const haengt = await a.store.createPosteingang({ status: 'in_analyse', data: { fortschritt: { phase: 'seiten', text: '', gestartet: '', aktualisiert: new Date(Date.now() - 11 * 60_000).toISOString() } } });
    const res = await post(a, '/posteingang/analysieren', { ids: [zu.id, laeuft.id, haengt.id] });
    await a.kern.hintergrund();
    const j = await res.json() as { gestartet: string[]; abgelehnt: Array<{ id: string; error: string }> };
    expect(j.gestartet).toEqual([haengt.id]);
    expect(j.abgelehnt).toEqual([
      { id: zu.id, error: 'Status „zugeordnet" ist nicht auswertbar' },
      { id: laeuft.id, error: 'Status „in_analyse" ist nicht auswertbar' },
    ]);
  });

  test('ohne ids 400', async () => {
    expect((await post(aufbau(), '/posteingang/analysieren', {})).status).toBe(400);
  });
});

describe('Zustands-Gates und Zuordnung', () => {
  test('Nachreichung an eingeschränkten Vorgang ⇒ 403, Hook nicht aufgerufen, Eingang bleibt offen', async () => {
    const a = aufbau();
    const { body } = await ingest(a, [['a.pdf', 'A']]);
    await auswerten(a, body.id);
    const res = await post(a, `/posteingang/${body.id}/zuordnen`, { vorgangId: 'v-gesperrt' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'eingeschränkt' });
    expect(a.zuordnungen).toEqual([]);
    expect((await a.store.getPosteingang(body.id))!.status).toBe('analysiert');
  });

  test('zuordnen vor Auswertung ⇒ 409, danach ⇒ zugeordnet', async () => {
    const a = aufbau();
    const { body } = await ingest(a, [['a.pdf', 'A']]);
    const vorher = await post(a, `/posteingang/${body.id}/zuordnen`, {});
    expect(vorher.status).toBe(409);
    expect(a.zuordnungen).toEqual([]);

    await auswerten(a, body.id);
    const res = await post(a, `/posteingang/${body.id}/zuordnen`, { akteId: 'a-1' });
    expect(res.status).toBe(200);
    const j = await res.json() as Record<string, unknown>;
    expect(Object.keys(j)).toEqual(['posteingang', 'vorgang', 'akte']);
    expect(j.posteingang).toMatchObject({ status: 'zugeordnet', zugeordneterVorgangId: 'v-1', zugeordneteAkteId: 'a-1' });
    expect(a.ki).toContain(`zu:${body.id}:v-1:true`);
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.zugeordnet', vorgangId: 'v-1', detail: 'zugeordnet' });

    // Terminal: erneut zuordnen / verwerfen / patchen ⇒ 409
    expect((await post(a, `/posteingang/${body.id}/zuordnen`, {})).status).toBe(409);
    expect((await post(a, `/posteingang/${body.id}/verwerfen`, {})).status).toBe(409);
    expect((await a.app.request(`/posteingang/${body.id}`, { method: 'PATCH', body: JSON.stringify({ betreff: 'x' }) })).status).toBe(409);
  });

  test('Fehler des Zuordnungs-Hooks wird durchgereicht, Eingang bleibt analysiert', async () => {
    const a = aufbau();
    const e = await a.store.createPosteingang({ status: 'analysiert' });
    const res = await post(a, `/posteingang/${e.id}/zuordnen`, { fehler: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Vorgang nicht gefunden' });
    expect(a.store.rows.get(e.id)!.status).toBe('analysiert');
  });

  test('verwerfen mit Grund', async () => {
    const a = aufbau();
    const e = await a.store.createPosteingang({});
    const res = await post(a, `/posteingang/${e.id}/verwerfen`, { grund: ' Werbung ' });
    expect(((await res.json()) as { posteingang: Eingang }).posteingang).toMatchObject({ status: 'verworfen', verworfenGrund: 'Werbung' });
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.verworfen', detail: 'Werbung' });
  });

  test('patch: Betreff und Dateityp', async () => {
    const a = aufbau();
    const { body } = await ingest(a, [['a.pdf', 'A']]);
    const res = await a.app.request(`/posteingang/${body.id}`, { method: 'PATCH', body: JSON.stringify({ betreff: 'Neu', dateiTypen: [{ index: 0, typ: 'nachweis' }] }) });
    const j = await res.json() as { posteingang: Eingang };
    expect(j.posteingang.betreff).toBe('Neu');
    expect(j.posteingang.dateien[0]!.typ).toBe('nachweis');
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.geaendert', detail: 'betreff, dateien' });
  });
});

describe('Trennung', () => {
  test('während in_analyse ⇒ 409', async () => {
    const a = aufbau();
    const e = await a.store.createPosteingang({ status: 'in_analyse', dateien: [{ dateiname: 'a.pdf', contentType: 'application/pdf', groesse: 1, hash: 'h' }] });
    const res = await post(a, `/posteingang/${e.id}/trennung`, { hash: 'h', startSeiten: [1, 2] });
    expect(res.status).toBe(409);
  });

  test('ausgewerteter Eingang: trennt, entfernt alte Teile, wertet neue aus', async () => {
    const a = aufbau();
    const alt: Datei = {
      dateiname: 'alt-teil.pdf', contentType: 'application/pdf', groesse: 1, hash: 'h-alt', pfad: 'mem/alt-teil.pdf', typ: 'antrag',
      teilVon: { dateiname: 'scan.pdf', pfad: 'mem/scan.pdf', hash: 'h-orig', contentType: 'application/pdf', groesse: 4, seitenGesamt: 4, seiteVon: 1, seiteBis: 4, teilNr: 1, teileGesamt: 1 },
    };
    const e = await a.store.createPosteingang({ status: 'analysiert', dateien: [alt] });
    const res = await post(a, `/posteingang/${e.id}/trennung`, { hash: 'h-orig', startSeiten: [1, 2] });
    expect(res.status).toBe(200);
    const neu = a.store.rows.get(e.id)!;
    expect(neu.dateien.map((d) => [d.dateiname, d.typ])).toEqual([['teil-1.pdf', 'nachweis'], ['teil-2.pdf', 'nachweis']]);
    expect(neu.status).toBe('analysiert');
    expect(a.ablage.entfernt).toEqual(['mem/alt-teil.pdf']);
    expect(a.ki).toEqual(['posteingang_trennung']);
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.getrennt', detail: '„scan.pdf" manuell in 2 Dokumente getrennt (S. 1, S. 2–4)' });
  });

  test('unbekannter Hash 404, Nicht-PDF 400', async () => {
    const a = aufbau();
    const e = await a.store.createPosteingang({ dateien: [{ dateiname: 'foto.jpg', contentType: 'image/jpeg', groesse: 1, hash: 'h-f' }] });
    expect((await post(a, `/posteingang/${e.id}/trennung`, { hash: 'x' })).status).toBe(404);
    expect((await post(a, `/posteingang/${e.id}/trennung`, { hash: 'h-f' })).status).toBe(400);
  });
});

describe('Lesen und Löschen', () => {
  test('Liste mit Filter, Detail, Datei-Bytes mit Lese-Audit', async () => {
    const a = aufbau();
    const { body } = await ingest(a, [['a.pdf', 'Inhalt']]);
    await a.store.createPosteingang({ status: 'verworfen' });
    const liste = await (await a.app.request('/posteingang?status=eingegangen')).json() as { posteingang: Eingang[] };
    expect(liste.posteingang.map((p) => p.id)).toEqual([body.id]);
    expect((await a.app.request(`/posteingang/${body.id}`)).status).toBe(200);
    expect((await a.app.request('/posteingang/gibtsnicht')).status).toBe(404);

    const datei = await a.app.request(`/posteingang/${body.id}/datei/0`);
    expect(await datei.text()).toBe('Inhalt');
    expect(datei.headers.get('Content-Disposition')).toBe('inline; filename="a.pdf"');
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.datei_gelesen', detail: 'a.pdf' });
    expect((await a.app.request(`/posteingang/${body.id}/datei/5`)).status).toBe(404);
    expect(await (await a.app.request(`/posteingang/${body.id}/datei/0/vorschau`)).json()).toEqual({ art: 'pdf', seiten: 1 });
    expect((await a.app.request(`/posteingang/${body.id}/ki-verbrauch`)).status).toBe(200);
  });

  test('delete entfernt Teile und Originale, dann den Eingang', async () => {
    const a = aufbau();
    const teil = (nr: number): Datei => ({
      dateiname: `t${nr}.pdf`, contentType: 'application/pdf', groesse: 1, hash: `h${nr}`, pfad: `mem/t${nr}.pdf`,
      teilVon: { dateiname: 'scan.pdf', pfad: 'mem/scan.pdf', hash: 'h-orig', contentType: 'application/pdf', groesse: 2, seitenGesamt: 2, seiteVon: nr, seiteBis: nr, teilNr: nr, teileGesamt: 2 },
    });
    const e = await a.store.createPosteingang({ dateien: [teil(1), teil(2)] });
    const res = await a.app.request(`/posteingang/${e.id}`, { method: 'DELETE' });
    expect(await res.json()).toEqual({ ok: true });
    expect(a.ablage.entfernt).toEqual(['mem/t1.pdf', 'mem/scan.pdf', 'mem/t2.pdf']);
    expect(a.store.rows.has(e.id)).toBe(false);
    expect(a.audits.at(-1)).toMatchObject({ aktion: 'posteingang.geloescht', detail: '2 Datei(en) entfernt' });
  });
});
