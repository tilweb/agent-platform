/**
 * Optimistic Concurrency Control — gemeinsame Bausteine fuer Idee, Auftrag, Statusbericht.
 *
 * - VersionConflictError: wird von Storage-Update-Funktionen geworfen wenn die
 *   erwartete Version nicht der aktuellen entspricht. Routes mappen sie auf 409.
 * - withLock: per-Entity-ID Promise-Chain-Mutex. Serialisiert konkurrierende
 *   Read-Modify-Write-Zyklen auf der gleichen Datei (YAML-Storage). Ohne diese
 *   Sperrung koennten parallele Saves auf dieselbe Idee verschachtelt schreiben.
 *
 * Reicht fuer Single-Process (was demo/messe ist). Fuer Multi-Process-Demo
 * waere zusaetzliches flock(2) noetig — out-of-scope.
 */

export class VersionConflictError<T = unknown> extends Error {
  constructor(public readonly current: T) {
    super('Version conflict — entity has been modified by another user');
    this.name = 'VersionConflictError';
  }
}

const locks = new Map<string, Promise<unknown>>();

/**
 * Serialisiert konkurrierende async-Operationen auf der gleichen Entity-ID.
 * Spaetere Aufrufe warten auf den Vorgaenger, fuehren ihre Operation aus,
 * und geben den Mutex frei.
 */
export async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(id, next.catch(() => undefined));
  try {
    return await next;
  } finally {
    if (locks.get(id) === next.catch(() => undefined)) {
      // Best-effort cleanup; falls eine andere Operation in der Zwischenzeit
      // ankam, lassen wir die Map-Entry fuer sie stehen.
      locks.delete(id);
    }
  }
}

/**
 * Pruefen-und-Inkrement-Helper — wird in jeder updateXxx-Funktion verwendet.
 * Wirft VersionConflictError wenn expected ungleich current ist (und force=false).
 */
export function checkVersion<T extends { version?: number }>(
  current: T,
  expectedVersion: number | undefined,
  force: boolean,
): void {
  if (force) return;
  if (expectedVersion === undefined) return; // Kein Check angefordert
  const currentVersion = current.version ?? 1;
  if (currentVersion !== expectedVersion) {
    throw new VersionConflictError(current);
  }
}
