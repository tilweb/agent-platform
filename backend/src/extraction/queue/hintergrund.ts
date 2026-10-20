/**
 * Generische Hintergrund-Jobs (Stufe S1): Posteingang, Vorgang-Upload, Evaluation.
 *
 * Gleiche Semantik wie die Batch-Warteschlange (`learning/jobs.ts`): Postgres, `FOR UPDATE SKIP LOCKED`,
 * Lease 90 s mit Heartbeat 20 s, Uebernahme nach Ablauf der Lease (Absturz, Neustart). Batch-Laeufe bleiben in
 * `extraction.jobs` — diese Tabelle ist `extraction.hintergrund_jobs`.
 *
 * Regeln fuer Job-Arten:
 * - Die Nutzlast traegt nur Schluessel/IDs, nie Dateipfade: Dateien liegen dauerhaft (S3/DB), bevor der Job
 *   eingestellt wird — ein Worker-Container sieht das /tmp des Web-Prozesses nicht.
 * - `ausfuehren` muss wiederholbar sein: Nach einer Uebernahme laeuft der Job erneut und raeumt den
 *   Zwischenstand des vorigen Versuchs selbst auf.
 * - Fachliche Fehler behandelt der Job selbst (Status am Datensatz). Wirft er, gilt der Job als gescheitert
 *   und `beiAbbruch` markiert den Datensatz. Nach mehr als 3 Versuchen (wiederholte Abstuerze) ebenso.
 * - `stelleEin` ist idempotent ueber `schluessel`: hoechstens ein offener Job je Schluessel.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { getSql } from '../../db/client';
import { istWorkerProzess, verarbeitetHier, workerModus } from './modus';

export interface JobKontext {
  jobId: string;
  userId?: string;
  versuch: number;
}

export interface JobArt<N> {
  /** Rueckgabewert wird als `ergebnis` gespeichert (abrufbar ueber `jobStatus`). */
  ausfuehren(nutzlast: N, kontext: JobKontext): Promise<unknown>;
  /** Job endgueltig gescheitert (Ausnahme oder zu viele Versuche) — Datensatz sichtbar als Fehler markieren. */
  beiAbbruch?(nutzlast: N, fehler: string): Promise<void>;
}

/** Kleiner = frueher. Posteingang/Upload vor Evaluation. */
export const PRIORITAET = { eingang: 0, evaluation: 5 } as const;

const MAX_VERSUCHE = 3;

/** Kennung dieses Prozesses (Container + PID) — steht am Job (`bearbeiter`) und im Lebenszeichen. */
const PROZESS = `${process.env.CONTAINER ?? hostname()}:${process.pid}`;

/**
 * JSON fuer den Roh-Client: Drizzle (getDb) teilt sich den Postgres-Client und ersetzt dessen JSON-(De-)Serializer.
 * Deshalb als Text uebergeben und in SQL nach jsonb casten; beim Lesen Strings selbst parsen.
 */
function alsJsonText(wert: unknown): string {
  return JSON.stringify(wert ?? null);
}
function jsonWert<T>(wert: unknown): T {
  return (typeof wert === 'string' ? JSON.parse(wert) : wert) as T;
}

const arten = new Map<string, JobArt<unknown>>();

export function registriereJobArt<N>(art: string, def: JobArt<N>): void {
  arten.set(art, def as JobArt<unknown>);
}

/** Lease des laufenden Hintergrund-Jobs — `modelWork` prueft sie vor jedem Modellaufruf. */
export const hintergrundKontext = new AsyncLocalStorage<{ jobId: string; token: string }>();

/** Wirft, wenn der laufende Hintergrund-Job seine Lease verloren hat (von einem anderen Worker uebernommen). */
export async function pruefeHintergrundLease(): Promise<void> {
  const owner = hintergrundKontext.getStore();
  if (!owner) return;
  const rows = await getSql()`SELECT 1 FROM extraction.hintergrund_jobs WHERE id=${owner.jobId} AND token=${owner.token} AND state='running' AND lease_until>now()`;
  if (!rows.length) throw new Error('Job-Lease nicht mehr gültig');
}

export interface Einstellung {
  schluessel: string;
  userId?: string | null;
  prioritaet?: number;
}

/** Job einstellen (idempotent je Schluessel). Liefert die ID des neuen oder des schon offenen Jobs. */
export async function stelleEin<N>(art: string, nutzlast: N, opt: Einstellung): Promise<{ id: string; neu: boolean }> {
  const db = getSql();
  const id = randomUUID();
  const rows = await db`INSERT INTO extraction.hintergrund_jobs (id, art, schluessel, nutzlast, prioritaet, user_id)
    VALUES (${id}, ${art}, ${opt.schluessel}, ${alsJsonText(nutzlast)}::text::jsonb, ${opt.prioritaet ?? PRIORITAET.eingang}, ${opt.userId ?? null})
    ON CONFLICT (schluessel) WHERE state IN ('pending', 'running') DO NOTHING RETURNING id`;
  wecke();
  if (rows.length) return { id, neu: true };
  const [offen] = await db`SELECT id FROM extraction.hintergrund_jobs WHERE schluessel=${opt.schluessel} AND state IN ('pending', 'running')`;
  return { id: String(offen?.id ?? id), neu: false };
}

export interface JobStatus {
  art: string;
  status: 'wartet' | 'laeuft' | 'fertig' | 'fehler';
  nutzlast: unknown;
  ergebnis: unknown;
  fehler: string | null;
  fortschritt: { text: string; aktualisiert: string } | null;
}

/** Status eines Jobs fuer die Abfrage durch die Oberflaeche. */
export async function jobStatus(id: string): Promise<JobStatus | null> {
  const [r] = await getSql()`SELECT art, state, nutzlast, ergebnis, error, fortschritt FROM extraction.hintergrund_jobs WHERE id=${id}`;
  if (!r) return null;
  const state = String(r.state);
  return {
    art: String(r.art),
    status: state === 'completed' ? 'fertig' : state === 'failed' || state === 'cancelled' ? 'fehler' : state === 'running' ? 'laeuft' : 'wartet',
    nutzlast: jsonWert(r.nutzlast), ergebnis: jsonWert(r.ergebnis) ?? null, fehler: (r.error as string | null) ?? null,
    fortschritt: jsonWert<JobStatus['fortschritt']>(r.fortschritt) ?? null,
  };
}

/** Fortschrittstext des laufenden Jobs (no-op ausserhalb eines Jobs). */
export async function setzeJobFortschritt(text: string): Promise<void> {
  const owner = hintergrundKontext.getStore();
  if (!owner) return;
  const db = getSql();
  await db`UPDATE extraction.hintergrund_jobs SET fortschritt=${alsJsonText({ text, aktualisiert: new Date().toISOString() })}::text::jsonb, updated_at=now()
    WHERE id=${owner.jobId} AND token=${owner.token}`.catch(() => {});
}

/** Offener (wartender oder laufender) Job zu einem Schluessel? */
export async function hatOffenenJob(schluessel: string): Promise<boolean> {
  const rows = await getSql()`SELECT 1 FROM extraction.hintergrund_jobs WHERE schluessel=${schluessel} AND state IN ('pending', 'running')`;
  return rows.length > 0;
}

/** Offene Jobs mit Schluessel-Praefix (z. B. „wohngeld:posteingang:"). */
export async function offeneSchluessel(praefix: string): Promise<Set<string>> {
  const rows = await getSql()`SELECT schluessel FROM extraction.hintergrund_jobs WHERE state IN ('pending', 'running') AND schluessel LIKE ${`${praefix}%`}`;
  return new Set(rows.map((r) => String(r.schluessel)));
}

export async function claimHintergrundJob(): Promise<Record<string, unknown> | undefined> {
  const registriert = [...arten.keys()];
  if (!registriert.length) return undefined;
  const token = randomUUID();
  const rows = await getSql()`WITH kandidat AS (
      SELECT id FROM extraction.hintergrund_jobs
      WHERE art = ANY(${registriert}) AND (state = 'pending' OR (state = 'running' AND lease_until < now()))
      ORDER BY prioritaet, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE extraction.hintergrund_jobs j SET state='running', token=${token}, lease_until=now()+interval '90 seconds',
      attempts=attempts+1, bearbeiter=${PROZESS}, updated_at=now()
    FROM kandidat k WHERE j.id=k.id RETURNING j.*`;
  return rows[0];
}

async function erneuere(id: string, token: string): Promise<boolean> {
  const rows = await getSql()`UPDATE extraction.hintergrund_jobs SET lease_until=now()+interval '90 seconds', updated_at=now()
    WHERE id=${id} AND token=${token} AND state='running' AND lease_until>now() RETURNING id`;
  return rows.length > 0;
}

async function abschliessen(id: string, token: string, state: 'completed' | 'failed', fehler?: string, ergebnis?: unknown): Promise<boolean> {
  const db = getSql();
  const rows = await db`UPDATE extraction.hintergrund_jobs SET state=${state}, error=${fehler ?? null},
    ergebnis=${ergebnis === undefined ? null : alsJsonText(ergebnis)}::text::jsonb, token=null, lease_until=null, updated_at=now()
    WHERE id=${id} AND token=${token} RETURNING id`;
  return rows.length > 0;
}

/** Laufende Jobs dieses Prozesses (fuer das Freigeben beim Beenden). */
const laufend = new Map<string, string>();

/** Einen geholten Job ausfuehren (Heartbeat, Abschluss, Abbruch). */
async function fuehreAus(job: Record<string, unknown>): Promise<void> {
  const id = String(job.id), token = String(job.token), art = String(job.art);
  const versuch = Number(job.attempts);
  const def = arten.get(art);
  const nutzlast = jsonWert<unknown>(job.nutzlast);
  laufend.set(id, token);
  console.log(`[hintergrund] ${art} ${id} gestartet (Versuch ${versuch}, ${PROZESS})`);
  const timer = setInterval(() => {
    void erneuere(id, token).catch((e) => console.error('[hintergrund] Heartbeat:', e instanceof Error ? e.message : e));
  }, 20_000);
  timer.unref();
  try {
    if (!def) throw new Error(`Unbekannte Job-Art „${art}"`);
    if (versuch > MAX_VERSUCHE) throw new Error(`Verarbeitung nach ${MAX_VERSUCHE} unterbrochenen Versuchen gestoppt.`);
    const ergebnis = await hintergrundKontext.run({ jobId: id, token }, () => def.ausfuehren(nutzlast, { jobId: id, userId: (job.user_id as string | null) ?? undefined, versuch }));
    await abschliessen(id, token, 'completed', undefined, ergebnis);
  } catch (err) {
    const fehler = err instanceof Error ? err.message : String(err);
    // Lease verloren → ein anderer Worker hat uebernommen; nichts markieren.
    if (await abschliessen(id, token, 'failed', fehler).catch(() => false)) {
      console.error(`[hintergrund] ${art} ${id} gescheitert:`, fehler);
      await def?.beiAbbruch?.(nutzlast, fehler).catch((e) => console.error('[hintergrund] beiAbbruch:', e instanceof Error ? e.message : e));
    }
  } finally {
    clearInterval(timer);
    laufend.delete(id);
  }
}

/** Einen Job holen und ausfuehren. `false` = nichts zu tun. */
export async function verarbeiteEinenHintergrundJob(): Promise<boolean> {
  const job = await claimHintergrundJob();
  if (!job) return false;
  await fuehreAus(job);
  return true;
}

// ---------- Schleife ----------

const PARALLEL = Math.max(1, Number(process.env.DP_HINTERGRUND_PARALLEL) || 2);
let gestartet = false, beendet = false, aktiv = 0, pumpt = false, nochmal = false;

/** Freie Plaetze mit Jobs fuellen; nie mehr als PARALLEL gleichzeitig. */
async function pumpe(): Promise<void> {
  if (beendet) return;
  if (pumpt) { nochmal = true; return; }
  pumpt = true;
  try {
    do {
      nochmal = false;
      while (aktiv < PARALLEL && !beendet) {
        const job = await claimHintergrundJob();
        if (!job) break;
        aktiv++;
        void fuehreAus(job).finally(() => { aktiv--; void pumpe(); });
      }
    } while (nochmal && aktiv < PARALLEL && !beendet);
  } catch (e) {
    console.error('[hintergrund]', e instanceof Error ? e.message : e);
  } finally {
    pumpt = false;
  }
}

/** Startet die Abarbeitung in diesem Prozess (no-op, wenn hier nicht verarbeitet wird). */
export function starteHintergrundWorker(): void {
  if (gestartet || !verarbeitetHier()) return;
  gestartet = true;
  const timer = setInterval(() => void pumpe(), 2000);
  timer.unref();
  void pumpe();
}

/** Nach dem Einstellen sofort anstossen (nur wenn hier verarbeitet wird). */
function wecke(): void {
  if (!verarbeitetHier()) return;
  starteHintergrundWorker();
  void pumpe();
}

/** Beim Beenden: keine neuen Jobs, laufende Leases freigeben — ein anderer Worker uebernimmt sofort. */
export async function beendeHintergrundWorker(): Promise<void> {
  beendet = true;
  for (const [id, token] of laufend) {
    await getSql()`UPDATE extraction.hintergrund_jobs SET state='pending', token=null, lease_until=null, updated_at=now()
      WHERE id=${id} AND token=${token}`.catch(() => {});
  }
}

/** Fuer Tests: warten, bis keine Jobs mehr offen sind (nur sinnvoll, wenn hier verarbeitet wird). */
export async function warteAufLeereWarteschlange(timeoutMs = 120_000): Promise<void> {
  const ende = Date.now() + timeoutMs;
  while (Date.now() < ende) {
    const [r] = await getSql()`SELECT count(*)::int AS n FROM extraction.hintergrund_jobs WHERE state IN ('pending', 'running')`;
    if (!Number(r?.n) && aktiv === 0) return;
    void pumpe();
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Warteschlange nicht leer geworden');
}

// ---------- Lebenszeichen ----------

/** Worker-Prozess: alle 20 s Lebenszeichen schreiben. */
export function starteLebenszeichen(): void {
  const schreibe = () => getSql()`INSERT INTO extraction.worker_status (prozess, zuletzt, info)
      VALUES (${PROZESS}, now(), ${alsJsonText({ aktiv, parallel: PARALLEL })}::text::jsonb)
      ON CONFLICT (prozess) DO UPDATE SET zuletzt=now(), info=excluded.info`
    .catch((e) => console.error('[hintergrund] Lebenszeichen:', e instanceof Error ? e.message : e));
  void schreibe();
  setInterval(() => void schreibe(), 20_000).unref();
}

export interface VerarbeitungsStatus {
  modus: 'intern' | 'extern';
  /** Im Modus `extern`: hat sich in den letzten 2 min ein Worker gemeldet? */
  workerAktiv: boolean | null;
  offeneJobs: number;
}

/** Fuer /health und Hinweise in der Oberflaeche. */
export async function verarbeitungsStatus(): Promise<VerarbeitungsStatus> {
  const modus = workerModus();
  const db = getSql();
  const [o] = await db`SELECT count(*)::int AS n FROM extraction.hintergrund_jobs WHERE state IN ('pending', 'running')`;
  if (modus === 'intern' && !istWorkerProzess()) return { modus, workerAktiv: null, offeneJobs: Number(o?.n ?? 0) };
  const [w] = await db`SELECT count(*)::int AS n FROM extraction.worker_status WHERE zuletzt > now() - interval '2 minutes'`;
  return { modus, workerAktiv: Number(w?.n ?? 0) > 0, offeneJobs: Number(o?.n ?? 0) };
}
