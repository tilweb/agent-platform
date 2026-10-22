/**
 * Prozesstyp `worker` (Stufe S1, docs/konzept-document-processing-dienst-2026-09-25.md §11).
 *
 * Arbeitet die DP-Warteschlangen ab — Batch-Laeufe (`extraction.jobs`) und Hintergrund-Jobs
 * (`extraction.hintergrund_jobs`: Posteingang, Upload am Vorgang, Evaluation) — ohne HTTP-Server, Seeds,
 * Agent-Executor oder MCP. Der Web-Prozess laeuft dazu mit `DP_WORKER_MODUS=extern` und legt nur Jobs an.
 *
 * Start: `cd backend && bun run src/worker.ts` (Procfile: `worker`).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getSql } from './db/client';
import { llmService } from './services/llm';
import { alsWorkerProzess } from './extraction/queue/modus';
import { beendeHintergrundWorker, starteHintergrundWorker, starteLebenszeichen } from './extraction/queue/hintergrund';
import { startExtractionWorker } from './extraction/learning/jobs';
// Job-Arten registrieren sich beim Import ihrer Module.
import './extraction/inbox/service';
import './extraction/learning/service';
import './apps/antragspruefung/wohngeld/routes/posteingang-queue';
import './apps/antragspruefung/grundsicherung/routes/posteingang-queue';

alsWorkerProzess();

/**
 * Migrationen fuehrt der Web-Prozess aus; der Worker wartet, bis die Datenbank auf dem Stand des Codes ist.
 * Gleiche Regel wie der Drizzle-Migrator: Stand erreicht, wenn die zuletzt angewendete Migration (`created_at`)
 * mindestens so neu ist wie der juengste Journal-Eintrag (`when`). Die Anzahl der Zeilen taugt nicht — sie weicht je
 * Datenbank vom Journal ab.
 */
async function warteAufMigrationen(timeoutMs = 5 * 60_000): Promise<void> {
  const ordner = [resolve(process.cwd(), 'drizzle'), resolve(process.cwd(), 'backend/drizzle')].find(existsSync);
  if (!ordner) return;
  const journal = JSON.parse(await readFile(resolve(ordner, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ when: number; tag: string }> };
  const juengste = journal.entries.reduce((a, b) => (b.when > a.when ? b : a));
  const ende = Date.now() + timeoutMs;
  while (Date.now() < ende) {
    try {
      const [r] = await getSql()`SELECT max(created_at)::bigint AS zuletzt FROM drizzle.__drizzle_migrations`;
      if (Number(r?.zuletzt ?? 0) >= juengste.when) return;
      console.log(`[worker] warte auf Migration ${juengste.tag} …`);
    } catch {
      console.log('[worker] warte auf Datenbank …');
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
  console.warn('[worker] Migrationen nach 5 min nicht vollstaendig — starte trotzdem.');
}

async function main(): Promise<void> {
  if (!process.env.SCALINGO_POSTGRES) {
    console.error('[worker] SCALINGO_POSTGRES fehlt — ohne Datenbank gibt es keine Warteschlange.');
    process.exit(1);
  }
  await warteAufMigrationen();
  await llmService.initialize();
  startExtractionWorker();
  starteHintergrundWorker();
  starteLebenszeichen();
  console.log('[worker] Verarbeitung gestartet (Batch + Hintergrund-Jobs).');
}

let beendet = false;
async function beende(signal: string): Promise<void> {
  if (beendet) return;
  beendet = true;
  console.log(`[worker] ${signal} — gebe laufende Jobs frei und beende.`);
  await beendeHintergrundWorker();
  process.exit(0);
}
process.on('SIGTERM', () => void beende('SIGTERM'));
process.on('SIGINT', () => void beende('SIGINT'));

main().catch((err) => {
  console.error('[worker] Start fehlgeschlagen:', err);
  process.exit(1);
});

// Prozess am Leben halten (alle Timer sind unref).
setInterval(() => {}, 60_000);
