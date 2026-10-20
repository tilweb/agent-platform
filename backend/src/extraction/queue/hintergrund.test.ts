/**
 * Hintergrund-Warteschlange gegen die echte Datenbank (lokal `SCALINGO_POSTGRES`; ohne DB uebersprungen).
 * Eigene Job-Arten `test-*`: ein parallel laufendes Dev-Backend kennt sie nicht und greift sie nicht ab.
 */
process.env.EXTRACTION_WORKER_DISABLED = '1'; // keine automatische Abarbeitung in diesem Prozess

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { getSql } from '../../db/client';
import { getDb } from '../../db';
import {
  claimHintergrundJob, hatOffenenJob, jobStatus, pruefeHintergrundLease, registriereJobArt, setzeJobFortschritt,
  stelleEin, verarbeiteEinenHintergrundJob,
} from './hintergrund';

const MIT_DB = !!process.env.SCALINGO_POSTGRES;
const LAUF = randomUUID().slice(0, 8);
const art = (n: string) => `test-${LAUF}-${n}`;

async function aufraeumen() {
  await getSql()`DELETE FROM extraction.hintergrund_jobs WHERE art LIKE ${`test-${LAUF}-%`}`;
}

describe.skipIf(!MIT_DB)('Hintergrund-Warteschlange', () => {
  const ausgefuehrt: string[] = [];
  const abgebrochen: string[] = [];

  beforeAll(async () => {
    // Wie im Server: Drizzle initialisiert und ersetzt die JSON-Serializer des gemeinsamen Clients.
    getDb();
    await aufraeumen();
    registriereJobArt<{ n: string }>(art('ok'), {
      async ausfuehren(n) {
        await setzeJobFortschritt(`arbeite an ${n.n}`);
        ausgefuehrt.push(n.n);
        return { fertig: n.n };
      },
    });
    registriereJobArt<{ n: string }>(art('fehler'), {
      async ausfuehren() { throw new Error('kaputt'); },
      async beiAbbruch(n, fehler) { abgebrochen.push(`${n.n}:${fehler}`); },
    });
  });
  afterAll(aufraeumen);

  test('stelleEin ist idempotent je Schluessel, solange der Job offen ist', async () => {
    const s = `${art('ok')}:a`;
    const a = await stelleEin(art('ok'), { n: 'a' }, { schluessel: s });
    const b = await stelleEin(art('ok'), { n: 'a' }, { schluessel: s });
    expect(a.neu).toBe(true);
    expect(b).toEqual({ id: a.id, neu: false });
    expect(await hatOffenenJob(s)).toBe(true);
    expect(await verarbeiteEinenHintergrundJob()).toBe(true);
    expect(await hatOffenenJob(s)).toBe(false);
    const st = await jobStatus(a.id);
    expect(st).toMatchObject({ status: 'fertig', ergebnis: { fertig: 'a' }, fortschritt: { text: 'arbeite an a' } });
    // Abgeschlossen → darf erneut eingestellt werden.
    expect((await stelleEin(art('ok'), { n: 'a' }, { schluessel: s })).neu).toBe(true);
    await verarbeiteEinenHintergrundJob();
  });

  test('Prioritaet: kleinere zuerst, sonst Reihenfolge des Einstellens', async () => {
    ausgefuehrt.length = 0;
    await stelleEin(art('ok'), { n: 'spaet' }, { schluessel: `${art('ok')}:p1`, prioritaet: 5 });
    await stelleEin(art('ok'), { n: 'frueh1' }, { schluessel: `${art('ok')}:p2`, prioritaet: 0 });
    await stelleEin(art('ok'), { n: 'frueh2' }, { schluessel: `${art('ok')}:p3`, prioritaet: 0 });
    while (await verarbeiteEinenHintergrundJob());
    expect(ausgefuehrt).toEqual(['frueh1', 'frueh2', 'spaet']);
  });

  test('Claim ist exklusiv, auch bei parallelen Versuchen', async () => {
    const { id } = await stelleEin(art('ok'), { n: 'x' }, { schluessel: `${art('ok')}:excl` });
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimHintergrundJob()));
    const getroffen = claims.filter((c) => c && c.id === id);
    expect(getroffen.length).toBe(1);
    await getSql()`UPDATE extraction.hintergrund_jobs SET state='completed' WHERE id=${id}`;
  });

  test('Uebernahme nach Ablauf der Lease: neuer Token, alter Besitzer verliert die Lease', async () => {
    const { id } = await stelleEin(art('ok'), { n: 'lease' }, { schluessel: `${art('ok')}:lease` });
    const erster = await claimHintergrundJob();
    expect(erster?.id).toBe(id);
    await getSql()`UPDATE extraction.hintergrund_jobs SET lease_until=now()-interval '1 second' WHERE id=${id}`;
    const zweiter = await claimHintergrundJob();
    expect(zweiter?.id).toBe(id);
    expect(zweiter?.token).not.toBe(erster?.token);
    expect(Number(zweiter?.attempts)).toBe(2);
    // Der erste Besitzer darf nicht weiterrechnen.
    const { hintergrundKontext } = await import('./hintergrund');
    await expect(hintergrundKontext.run({ jobId: id, token: String(erster!.token) }, () => pruefeHintergrundLease())).rejects.toThrow('Job-Lease nicht mehr gültig');
    await hintergrundKontext.run({ jobId: id, token: String(zweiter!.token) }, () => pruefeHintergrundLease());
    await getSql()`UPDATE extraction.hintergrund_jobs SET state='completed' WHERE id=${id}`;
  });

  test('Fehler im Job: gescheitert, beiAbbruch markiert den Datensatz', async () => {
    const { id } = await stelleEin(art('fehler'), { n: 'f' }, { schluessel: `${art('fehler')}:f` });
    await verarbeiteEinenHintergrundJob();
    expect(await jobStatus(id)).toMatchObject({ status: 'fehler', fehler: 'kaputt' });
    expect(abgebrochen).toEqual(['f:kaputt']);
  });

  test('Nach mehr als drei unterbrochenen Versuchen wird abgebrochen', async () => {
    abgebrochen.length = 0;
    const { id } = await stelleEin(art('fehler'), { n: 'oft' }, { schluessel: `${art('fehler')}:oft` });
    await getSql()`UPDATE extraction.hintergrund_jobs SET attempts=3 WHERE id=${id}`;
    await verarbeiteEinenHintergrundJob();
    const st = await jobStatus(id);
    expect(st?.status).toBe('fehler');
    expect(st?.fehler).toContain('unterbrochenen Versuchen');
    expect(abgebrochen[0]).toContain('oft:');
  });
});
