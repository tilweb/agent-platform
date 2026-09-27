/**
 * Antrag-Kern — Routen-Fabrik der Notizen mit In-Memory-Fakes (Store, Audit, Gate)
 * über `app.request(...)`.
 */
import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createNotizenRoutes, type Notiz, type NotizAuditEvent, type NotizenStore } from './notizen';

function fakeStore(): NotizenStore & { rows: Map<string, Notiz> } {
  const rows = new Map<string, Notiz>();
  let n = 0;
  return {
    rows,
    async listNotizen(vorgangId) {
      return [...rows.values()].filter((x) => x.vorgangId === vorgangId).map((x) => ({ ...x }));
    },
    async addNotiz(input) {
      n += 1;
      const notiz: Notiz = { id: `notiz-${n}`, vorgangId: input.vorgangId, anker: input.anker, autor: input.autor, text: input.text, created_at: `2026-01-01T00:00:0${n}Z` };
      rows.set(notiz.id, notiz);
      return { ...notiz };
    },
    async getNotiz(id) { const x = rows.get(id); return x ? { ...x } : null; },
    async loescheNotiz(id) { return rows.delete(id); },
  };
}

function aufbau(rolle: 'owner' | 'editor' | 'viewer' = 'editor') {
  const store = fakeStore();
  const audits: NotizAuditEvent[] = [];
  const routes = createNotizenRoutes({
    store,
    vorgangExistiert: async (id) => id === 'v-1',
    guards: { denyIfNotAppEditor: (c) => (['owner', 'editor'].includes(c.get('appRole') as string) ? null : { error: 'kein Editor' }) },
    audit: async (_c, e) => { audits.push(e); },
  });
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('appRole' as never, rolle as never); c.set('userId' as never, 'u-1' as never); await next(); });
  app.route('/', routes);
  return { store, audits, app };
}

const anlegen = (app: Hono, vorgangId: string, body: unknown) =>
  app.request(`/vorgaenge/${vorgangId}/notizen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('Notiz anlegen', () => {
  test('201, Werte getrimmt, Autor = angemeldeter Nutzer, Audit', async () => {
    const a = aufbau();
    const res = await anlegen(a.app, 'v-1', { anker: ' sektion:allgemein ', text: '  Rückruf vereinbart ' });
    expect(res.status).toBe(201);
    const { notiz } = await res.json() as { notiz: Notiz };
    expect(notiz).toMatchObject({ id: 'notiz-1', vorgangId: 'v-1', anker: 'sektion:allgemein', text: 'Rückruf vereinbart', autor: 'u-1' });
    expect(a.audits).toEqual([{ aktion: 'notiz.erstellt', objektTyp: 'notiz', objektId: 'notiz-1', vorgangId: 'v-1', detail: 'sektion:allgemein' }]);
  });

  test('unbekannter Vorgang ⇒ 404', async () => {
    const a = aufbau();
    const res = await anlegen(a.app, 'v-x', { anker: 'a', text: 't' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Vorgang nicht gefunden' });
    expect(a.store.rows.size).toBe(0);
  });

  test('fehlender Anker/Text bzw. kaputter Body ⇒ 400', async () => {
    const a = aufbau();
    expect(await (await anlegen(a.app, 'v-1', { text: 't' })).json()).toEqual({ error: 'anker ist erforderlich' });
    expect(await (await anlegen(a.app, 'v-1', { anker: 'a', text: '   ' })).json()).toEqual({ error: 'text ist erforderlich' });
    expect((await anlegen(a.app, 'v-1', '{kaputt')).status).toBe(400);
    expect(a.store.rows.size).toBe(0);
    expect(a.audits).toEqual([]);
  });

  test('Nicht-Editor ⇒ 403 (vor der Vorgangsprüfung)', async () => {
    const a = aufbau('viewer');
    const res = await anlegen(a.app, 'v-x', { anker: 'a', text: 't' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'kein Editor' });
  });
});

describe('Liste', () => {
  test('GET liefert die Notizen des Vorgangs (auch für Leser)', async () => {
    const a = aufbau('viewer');
    await a.store.addNotiz({ vorgangId: 'v-1', anker: 'a', text: 'eins' });
    await a.store.addNotiz({ vorgangId: 'v-2', anker: 'b', text: 'zwei' });
    const res = await a.app.request('/vorgaenge/v-1/notizen');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { notizen: Notiz[] }).notizen.map((x) => x.text)).toEqual(['eins']);
  });
});

describe('Notiz löschen', () => {
  test('ok + Audit mit Vorgang und Anker der gelöschten Notiz', async () => {
    const a = aufbau();
    const n = await a.store.addNotiz({ vorgangId: 'v-1', anker: 'person:p-1', text: 'x' });
    const res = await a.app.request(`/notizen/${n.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(a.store.rows.size).toBe(0);
    expect(a.audits).toEqual([{ aktion: 'notiz.geloescht', objektTyp: 'notiz', objektId: n.id, vorgangId: 'v-1', detail: 'person:p-1' }]);
  });

  test('unbekannte Notiz ⇒ 404, kein Audit', async () => {
    const a = aufbau();
    const res = await a.app.request('/notizen/notiz-x', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Notiz nicht gefunden' });
    expect(a.audits).toEqual([]);
  });

  test('Nicht-Editor ⇒ 403, Notiz bleibt', async () => {
    const a = aufbau('viewer');
    const n = await a.store.addNotiz({ vorgangId: 'v-1', anker: 'a', text: 'x' });
    expect((await a.app.request(`/notizen/${n.id}`, { method: 'DELETE' })).status).toBe(403);
    expect(a.store.rows.size).toBe(1);
  });
});
