/**
 * Antrag-Kern — Routen-Fabrik der Feld-Provenienz mit In-Memory-Fakes
 * (Store, Audit, Gates, fachliche Hooks) über `app.request(...)`.
 */
import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import {
  createFeldstatusRoutes, type FeldStatus, type FeldStatusStore, type FeldstatusAuditEvent,
  type FeldstatusRoutenOptionen,
} from './feldstatus';

type Ziel = 'fall' | 'mitglied';
type FS = FeldStatus<Ziel>;

// ── Fakes ────────────────────────────────────────────────────────────────────

function fakeStore(start: FS[]): FeldStatusStore<Ziel> & { rows: Map<string, FS> } {
  const rows = new Map(start.map((f) => [f.id, structuredClone(f)]));
  const kopie = (f: FS): FS => structuredClone(f);
  const store: FeldStatusStore<Ziel> & { rows: Map<string, FS> } = {
    rows,
    async listFeldStatus(vorgangId) {
      return [...rows.values()].filter((f) => f.vorgangId === vorgangId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(kopie);
    },
    async getFeldStatus(id) { const f = rows.get(id); return f ? kopie(f) : null; },
    async setFeldStatus() { throw new Error('nicht benötigt'); },
    async bestaetigeFeld(id) {
      const f = rows.get(id);
      if (!f) return null;
      f.bestaetigt = true;
      return kopie(f);
    },
    async bestaetigeAlle(vorgangId) {
      for (const f of rows.values()) if (f.vorgangId === vorgangId) f.bestaetigt = true;
      return store.listFeldStatus(vorgangId);
    },
    async loescheFeldStatus(id) { return rows.delete(id); },
  };
  return store;
}

const fs = (id: string, vorgangId: string, feldPfad: string, bestaetigt = false, zielTyp: Ziel = 'fall'): FS => ({
  id, vorgangId, zielTyp, zielId: zielTyp === 'fall' ? vorgangId : 'm-1', feldPfad, quelle: 'llm', bestaetigt,
  quellDokumentId: 'd-1', confidence: 0.8, created_at: `2026-01-01T00:00:0${id.slice(-1)}Z`, updated_at: '2026-01-01T00:00:00Z',
});

function aufbau(rolle: 'owner' | 'editor' | 'viewer' = 'editor', opts: { eingeschraenkt?: string[]; ohneHooks?: boolean } = {}) {
  const store = fakeStore([
    fs('fs-1', 'v-1', 'adresse.ort'),
    fs('fs-2', 'v-1', 'einnahmen', false, 'mitglied'),
    fs('fs-3', 'v-1', 'name', true),
    fs('fs-4', 'v-2', 'adresse.plz'),
  ]);
  const audits: FeldstatusAuditEvent[] = [];
  /** Reihenfolge aller Seiteneffekte (Hooks + Audit + Store-Löschung). */
  const ablauf: string[] = [];
  const hooks: Partial<FeldstatusRoutenOptionen<Ziel>> = opts.ohneHooks ? {} : {
    beiBestaetigt: async (f) => { ablauf.push(`bestaetigt:${f.id}`); },
    beiVerwerfen: async (f) => { ablauf.push(`verwerfen:${f.id}:${store.rows.has(f.id)}`); },
    beiEntscheidung: async (v, felder, e) => { ablauf.push(`entscheidung:${v}:${felder.map((x) => x.id).join(',')}:${e}`); },
    nachAenderung: async (v, e) => { ablauf.push(`nach:${v}:${e}`); },
  };
  const routes = createFeldstatusRoutes<Ziel>({
    store: {
      ...store,
      loescheFeldStatus: async (id) => { ablauf.push(`geloescht:${id}`); return store.loescheFeldStatus(id); },
    },
    guards: {
      denyIfNotAppEditor: (c) => (['owner', 'editor'].includes(c.get('appRole') as string) ? null : { error: 'kein Editor' }),
      denyIfVorgangEingeschraenkt: async (id) => (opts.eingeschraenkt?.includes(id) ? { error: 'eingeschränkt' } : null),
    },
    audit: async (_c, e) => { audits.push(e); ablauf.push(`audit:${e.aktion}`); },
    ...hooks,
  });
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('appRole' as never, rolle as never); c.set('userId' as never, 'u-1' as never); await next(); });
  app.route('/', routes);
  return { store, audits, ablauf, app };
}

const post = (app: Hono, pfad: string) => app.request(pfad, { method: 'POST' });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Liste', () => {
  test('GET liefert die Feld-Status des Vorgangs (auch für Leser)', async () => {
    const a = aufbau('viewer');
    const res = await a.app.request('/vorgaenge/v-1/feldstatus');
    expect(res.status).toBe(200);
    const body = await res.json() as { feldStatus: FS[] };
    expect(body.feldStatus.map((f) => f.id)).toEqual(['fs-1', 'fs-2', 'fs-3']);
    expect(a.audits).toEqual([]);
  });
});

describe('bestätigen (einzeln)', () => {
  test('setzt bestaetigt, Hook → Audit → Entscheidung → nachAenderung', async () => {
    const a = aufbau();
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/fs-2/bestaetigen');
    expect(res.status).toBe(200);
    const body = await res.json() as { feldStatus: FS };
    expect(body.feldStatus).toMatchObject({ id: 'fs-2', bestaetigt: true });
    expect(a.store.rows.get('fs-2')!.bestaetigt).toBe(true);
    expect(a.ablauf).toEqual(['bestaetigt:fs-2', 'audit:feld.bestaetigt', 'entscheidung:v-1:fs-2:bestaetigt', 'nach:v-1:bestaetigt']);
    expect(a.audits).toEqual([{ aktion: 'feld.bestaetigt', objektTyp: 'feldstatus', objektId: 'fs-2', vorgangId: 'v-1', detail: 'einnahmen' }]);
  });

  test('unbekannter Eintrag ⇒ 404, keine Hooks, kein Audit', async () => {
    const a = aufbau();
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/fs-x/bestaetigen');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Feld-Status nicht gefunden' });
    expect(a.ablauf).toEqual([]);
  });

  test('ohne Hooks: nur Store + Audit', async () => {
    const a = aufbau('owner', { ohneHooks: true });
    expect((await post(a.app, '/vorgaenge/v-1/feldstatus/fs-1/bestaetigen')).status).toBe(200);
    expect(a.ablauf).toEqual(['audit:feld.bestaetigt']);
  });
});

describe('verwerfen (einzeln)', () => {
  test('Hook vor Löschen, Entscheidung vor Audit, nachAenderung zuletzt', async () => {
    const a = aufbau();
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/fs-1/verwerfen');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(a.store.rows.has('fs-1')).toBe(false);
    expect(a.ablauf).toEqual([
      'verwerfen:fs-1:true', 'geloescht:fs-1', 'entscheidung:v-1:fs-1:verworfen', 'audit:feld.verworfen', 'nach:v-1:verworfen',
    ]);
    expect(a.audits).toEqual([{ aktion: 'feld.verworfen', objektTyp: 'feldstatus', objektId: 'fs-1', vorgangId: 'v-1', detail: 'adresse.ort' }]);
  });

  test('unbekannter Eintrag ⇒ 404, nichts gelöscht', async () => {
    const a = aufbau();
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/fs-x/verwerfen');
    expect(res.status).toBe(404);
    expect(a.ablauf).toEqual([]);
    expect(a.store.rows.size).toBe(4);
  });
});

describe('alle bestätigen', () => {
  test('nur vorher offene Felder an Hooks, dann Audit, Antwort = ganze Liste', async () => {
    const a = aufbau();
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/alle-bestaetigen');
    expect(res.status).toBe(200);
    const body = await res.json() as { feldStatus: FS[] };
    expect(body.feldStatus.map((f) => [f.id, f.bestaetigt])).toEqual([['fs-1', true], ['fs-2', true], ['fs-3', true]]);
    expect(a.store.rows.get('fs-4')!.bestaetigt).toBe(false); // anderer Vorgang
    expect(a.ablauf).toEqual([
      'bestaetigt:fs-1', 'bestaetigt:fs-2', 'entscheidung:v-1:fs-1,fs-2:bestaetigt', 'audit:feld.alle_bestaetigt', 'nach:v-1:bestaetigt',
    ]);
    expect(a.audits).toEqual([{ aktion: 'feld.alle_bestaetigt', objektTyp: 'feldstatus', vorgangId: 'v-1', detail: 'Alle offenen KI-Vorschläge bestätigt' }]);
  });

  test('nichts offen ⇒ trotzdem Audit, Entscheidung mit leerer Liste', async () => {
    const a = aufbau();
    await post(a.app, '/vorgaenge/v-1/feldstatus/alle-bestaetigen');
    a.ablauf.length = 0;
    expect((await post(a.app, '/vorgaenge/v-1/feldstatus/alle-bestaetigen')).status).toBe(200);
    expect(a.ablauf).toEqual(['entscheidung:v-1::bestaetigt', 'audit:feld.alle_bestaetigt', 'nach:v-1:bestaetigt']);
  });
});

describe('Gates', () => {
  test('Nicht-Editor ⇒ 403 bei allen Schreibrouten, nichts verändert', async () => {
    const a = aufbau('viewer');
    for (const pfad of ['/vorgaenge/v-1/feldstatus/fs-1/bestaetigen', '/vorgaenge/v-1/feldstatus/fs-1/verwerfen', '/vorgaenge/v-1/feldstatus/alle-bestaetigen']) {
      const res = await post(a.app, pfad);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'kein Editor' });
    }
    expect(a.ablauf).toEqual([]);
    expect(a.store.rows.get('fs-1')!.bestaetigt).toBe(false);
  });

  test('eingeschränkter Vorgang ⇒ 403 bei allen Schreibrouten (Prüfung über die vorgangId der URL)', async () => {
    const a = aufbau('owner', { eingeschraenkt: ['v-1'] });
    for (const pfad of ['/vorgaenge/v-1/feldstatus/fs-1/bestaetigen', '/vorgaenge/v-1/feldstatus/fs-1/verwerfen', '/vorgaenge/v-1/feldstatus/alle-bestaetigen']) {
      const res = await post(a.app, pfad);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'eingeschränkt' });
    }
    expect(a.ablauf).toEqual([]);
    expect(a.store.rows.size).toBe(4);
    // Lesen bleibt erlaubt.
    expect((await a.app.request('/vorgaenge/v-1/feldstatus')).status).toBe(200);
  });

  test('Eintrag eines anderen Vorgangs ⇒ 404, nichts verändert (Einschränkung nicht über fremde URL umgehbar)', async () => {
    const a = aufbau('owner', { eingeschraenkt: ['v-2'] });
    for (const pfad of ['/vorgaenge/v-1/feldstatus/fs-4/bestaetigen', '/vorgaenge/v-1/feldstatus/fs-4/verwerfen']) {
      const res = await post(a.app, pfad);
      expect(res.status).toBe(404);
    }
    expect(a.ablauf).toEqual([]);
    expect(a.store.rows.get('fs-4')!.bestaetigt).toBe(false);
  });

  test('Editor-Gate vor Einschränkungs-Gate', async () => {
    const a = aufbau('viewer', { eingeschraenkt: ['v-1'] });
    const res = await post(a.app, '/vorgaenge/v-1/feldstatus/fs-1/bestaetigen');
    expect(await res.json()).toEqual({ error: 'kein Editor' });
  });
});
