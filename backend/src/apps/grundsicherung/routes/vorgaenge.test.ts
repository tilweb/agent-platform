/**
 * Grundsicherung — Vorgangs-Routen mit In-Memory-Fakes (über `app.request(...)`):
 * Editor-Gate, Einschränkungs-Gate (Art. 18), Audit beim Anlegen/Ändern/Lesen, Vier-Augen.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { Hono, type Context } from 'hono';
import { createVorgaengeRoutes, type VorgaengeDeps } from './vorgaenge';
import type { Akte, Vorgang } from '../types';
import type { AuditEvent } from '../audit';

function aufbau(rolle: 'owner' | 'editor' | 'viewer', vorgaengeStart: Vorgang[] = []) {
  const vorgaenge = new Map(vorgaengeStart.map((v) => [v.id, structuredClone(v)]));
  const akten = new Map<string, Akte>([['a1', { id: 'a1', name: 'Muster, Erika', version: 1, created_at: '', updated_at: '' }]]);
  const audits: AuditEvent[] = [];
  const pruefungen: string[] = [];
  let n = 0;

  const fake: Partial<VorgaengeDeps> = {
    listVorgaenge: async () => [...vorgaenge.values()],
    listAkten: async () => [...akten.values()],
    getAkte: async (id: string) => akten.get(id) ?? null,
    getVorgang: async (id: string) => (vorgaenge.has(id) ? structuredClone(vorgaenge.get(id)!) : null),
    createVorgang: async (input) => {
      n += 1;
      const v = { antragsart: 'erstantrag', status: 'posteingang', prioritaet: 'normal', ...input, id: `v-neu-${n}`, vorgangsnummer: `GS-${n}`, version: 1, created_at: '', updated_at: '' } as Vorgang;
      vorgaenge.set(v.id, v);
      return structuredClone(v);
    },
    updateVorgang: async (id, updates) => {
      const alt = vorgaenge.get(id);
      if (!alt) return null;
      const neu = { ...alt, ...updates, version: alt.version + 1 } as Vorgang;
      vorgaenge.set(id, neu);
      return structuredClone(neu);
    },
    audit: async (_c: Context, e: AuditEvent) => { audits.push(e); },
    auditUpdate: async (_c: Context, o) => { audits.push({ aktion: o.aktion, objektTyp: o.objektTyp, objektId: o.objektId, vorgangId: o.vorgangId }); },
    pruefeAutomatisch: async (id) => { if (id) pruefungen.push(id); },
    ladeSachbearbeitung: async () => [{ id: 'u1', name: 'Sabine Sachbearbeiterin' }],
    vierAugenAktiv: () => false,
    listPersonen: async () => [], listDokumente: async () => [], listPruefschritte: async () => [],
    listSchreiben: async () => [], listAktivitaeten: async () => [], listFeldStatus: async () => [],
    listNotizen: async () => [], listAuditEintraege: async () => [],
  };

  const app = new Hono();
  app.use('*', async (c: Context, next) => { c.set('appRole', rolle); c.set('userId', 'u1'); await next(); });
  app.route('/', createVorgaengeRoutes(fake as VorgaengeDeps));
  return { app, audits, vorgaenge, pruefungen, fake };
}

const basisVorgang = (o: Partial<Vorgang> = {}): Vorgang => ({
  id: 'v1', akteId: 'a1', vorgangsnummer: 'GS-1', antragsart: 'erstantrag', status: 'sachbearbeitung',
  prioritaet: 'normal', version: 1, created_at: '', updated_at: '', ...o,
});

const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

afterEach(() => { delete process.env.GRUNDSICHERUNG_VIERAUGEN; });

describe('POST /vorgaenge', () => {
  test('legt an, weist der anlegenden Person zu und protokolliert vorgang.erstellt', async () => {
    const { app, audits } = aufbau('editor');
    const res = await app.request('/vorgaenge', json('POST', { akteId: 'a1', anspruchsgrund: 'alter', legalHold: true }));
    expect(res.status).toBe(201);
    const { vorgang } = await res.json() as { vorgang: Vorgang };
    expect(vorgang.anspruchsgrund).toBe('alter');
    expect(vorgang.sachbearbeiterId).toBe('u1');
    expect(vorgang.legalHold).toBeUndefined(); // geschütztes Feld nicht über den Body setzbar
    expect(audits).toEqual([{ aktion: 'vorgang.erstellt', objektTyp: 'vorgang', objektId: vorgang.id, vorgangId: vorgang.id, detail: vorgang.vorgangsnummer }]);
  });

  test('Editor-Gate: Viewer darf nicht anlegen, kein Audit', async () => {
    const { app, audits, vorgaenge } = aufbau('viewer');
    const res = await app.request('/vorgaenge', json('POST', { akteId: 'a1' }));
    expect(res.status).toBe(403);
    expect(vorgaenge.size).toBe(0);
    expect(audits).toEqual([]);
  });

  test('unbekannte Akte → 404, unbekannter Anspruchsgrund → 400', async () => {
    const { app } = aufbau('editor');
    expect((await app.request('/vorgaenge', json('POST', { akteId: 'nix' }))).status).toBe(404);
    expect((await app.request('/vorgaenge', json('POST', { akteId: 'a1', anspruchsgrund: 'jugend' }))).status).toBe(400);
  });
});

describe('PUT /vorgaenge/:id', () => {
  test('ändert, auditiert mit Diff-Audit und stößt die Auto-Prüfung an', async () => {
    const { app, audits, pruefungen, vorgaenge } = aufbau('editor', [basisVorgang()]);
    const res = await app.request('/vorgaenge/v1', json('PUT', { antragsdatum: '2026-03-17', status: 'abgeschlossen' }));
    expect(res.status).toBe(200);
    expect(vorgaenge.get('v1')!.antragsdatum).toBe('2026-03-17');
    expect(vorgaenge.get('v1')!.status).toBe('sachbearbeitung'); // Status nur über /status
    expect(audits.map((a) => a.aktion)).toEqual(['vorgang.geaendert']);
    expect(pruefungen).toEqual(['v1']);
  });

  test('Editor-Gate: Viewer → 403', async () => {
    const { app, audits } = aufbau('viewer', [basisVorgang()]);
    expect((await app.request('/vorgaenge/v1', json('PUT', { antragsdatum: '2026-03-17' }))).status).toBe(403);
    expect(audits).toEqual([]);
  });

  test('Einschränkungs-Gate (Art. 18): eingeschränkter Vorgang → 403, keine Änderung, kein Audit', async () => {
    const { app, audits, vorgaenge } = aufbau('owner', [basisVorgang({ eingeschraenkt: true })]);
    const res = await app.request('/vorgaenge/v1', json('PUT', { antragsdatum: '2026-03-17' }));
    expect(res.status).toBe(403);
    expect(vorgaenge.get('v1')!.antragsdatum).toBeUndefined();
    expect(audits).toEqual([]);
  });

  test('Zuweisung nur an Personen mit Bearbeitungsrecht', async () => {
    const { app } = aufbau('editor', [basisVorgang()]);
    expect((await app.request('/vorgaenge/v1', json('PUT', { sachbearbeiterId: 'fremd' }))).status).toBe(400);
  });
});

describe('PUT /vorgaenge/:id/status', () => {
  test('Vier-Augen aktiv: Editor darf nicht final abschließen', async () => {
    const { app, fake } = aufbau('editor', [basisVorgang()]);
    fake.vierAugenAktiv = () => true;
    const res = await app.request('/vorgaenge/v1/status', json('PUT', { status: 'entscheidung', abschluss: { ergebnis: 'bewilligt' } }));
    expect(res.status).toBe(403);
  });

  test('Abschluss setzt Aufbewahrungsfrist und wird auditiert', async () => {
    const { app, audits, vorgaenge } = aufbau('editor', [basisVorgang()]);
    const res = await app.request('/vorgaenge/v1/status', json('PUT', { status: 'abgeschlossen', abschluss: { ergebnis: 'bewilligt' } }));
    expect(res.status).toBe(200);
    expect(vorgaenge.get('v1')!.aufbewahrungBis).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(audits[0]!.aktion).toBe('vorgang.status_geaendert');
  });
});

describe('Lesen und Owner-Routen', () => {
  test('Detail protokolliert den Lesezugriff', async () => {
    const { app, audits } = aufbau('viewer', [basisVorgang()]);
    const res = await app.request('/vorgaenge/v1/detail');
    expect(res.status).toBe(200);
    expect(audits.map((a) => a.aktion)).toEqual(['vorgang.geoeffnet']);
  });

  test('Einschränkung aufheben nur Owner; Legal Hold sperrt Löschung', async () => {
    const e = aufbau('editor', [basisVorgang({ eingeschraenkt: true, legalHold: true })]);
    expect((await e.app.request('/vorgaenge/v1/einschraenkung', json('PUT', { eingeschraenkt: false }))).status).toBe(403);
    const o = aufbau('owner', [basisVorgang({ legalHold: true })]);
    expect((await o.app.request('/vorgaenge/v1', { method: 'DELETE' })).status).toBe(409);
  });

  test('Löschfällig-Liste nur für Owner', async () => {
    const { app } = aufbau('editor', [basisVorgang({ aufbewahrungBis: '2020-01-01' })]);
    expect((await app.request('/loeschfaellig')).status).toBe(403);
    const o = aufbau('owner', [basisVorgang({ aufbewahrungBis: '2020-01-01' })]);
    const body = await (await o.app.request('/loeschfaellig')).json() as { loeschfaellig: unknown[] };
    expect(body.loeschfaellig).toHaveLength(1);
  });
});
