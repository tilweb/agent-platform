/**
 * Betriebsform der DP-Verarbeitung (Stufe S1, docs/konzept-document-processing-dienst-2026-09-25.md §11).
 *
 *   DP_WORKER_MODUS=intern (Standard) — der Web-Prozess arbeitet die Warteschlangen selbst ab (wie bisher).
 *   DP_WORKER_MODUS=extern            — der Web-Prozess legt nur Jobs an; der Prozesstyp `worker`
 *                                       (`bun run src/worker.ts`) arbeitet sie ab.
 *
 * `EXTRACTION_WORKER_DISABLED=1` schaltet die Verarbeitung in diesem Prozess ab (Tests, Rollen-Trennung) —
 * gilt nicht fuer den Worker-Prozess selbst.
 */

export type WorkerModus = 'intern' | 'extern';

let workerProzess = false;

/** Vom Einstiegspunkt `worker.ts` gesetzt. */
export function alsWorkerProzess(): void {
  workerProzess = true;
}

export function istWorkerProzess(): boolean {
  return workerProzess;
}

export function workerModus(): WorkerModus {
  return process.env.DP_WORKER_MODUS === 'extern' ? 'extern' : 'intern';
}

/** Arbeitet dieser Prozess Jobs ab (Batch, Posteingang, Vorgang-Upload, Evaluation)? */
export function verarbeitetHier(): boolean {
  if (workerProzess) return true;
  return workerModus() === 'intern' && process.env.EXTRACTION_WORKER_DISABLED !== '1';
}
