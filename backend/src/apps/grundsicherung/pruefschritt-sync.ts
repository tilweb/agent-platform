/**
 * Grundsicherung — Abgleich der automatischen Prüfschritte mit einem Prüfergebnis (rein, DB-frei).
 *
 * Semantik laut Muster (Abschnitt 3), identisch zu Wohngeld:
 * - Neue Befunde → anlegen (status offen, automatisch).
 * - Befunde, die es nicht mehr gibt → automatische, noch OFFENE Schritte entfernen.
 * - Manuelle Schritte (automatisch=false) und erledigte/verworfene bleiben unberührt.
 * Schlüssel: regelId + personId.
 */
import type { PruefBefund, Pruefschritt } from './types';

export interface PruefschrittSyncPlan {
  /** Befunde, für die ein neuer automatischer Prüfschritt angelegt wird. */
  anlegen: PruefBefund[];
  /** IDs automatischer, offener Prüfschritte ohne passenden Befund. */
  entfernen: string[];
}

/** Stabiler Schlüssel eines Befunds/Prüfschritts. */
export function pruefschrittSchluessel(regelId: string, personId?: string | null): string {
  return `${regelId}::${personId ?? ''}`;
}

type Bestand = Pick<Pruefschritt, 'id' | 'regelId' | 'personId' | 'status' | 'automatisch'>;

export function planePruefschrittSync(bestand: Bestand[], befunde: PruefBefund[]): PruefschrittSyncPlan {
  const automatischeSchluessel = new Set(
    bestand.filter((p) => p.automatisch).map((p) => pruefschrittSchluessel(p.regelId, p.personId)),
  );
  const befundSchluessel = new Set(befunde.map((b) => pruefschrittSchluessel(b.regelId, b.personId)));

  const anlegen: PruefBefund[] = [];
  const geplant = new Set<string>();
  for (const b of befunde) {
    const k = pruefschrittSchluessel(b.regelId, b.personId);
    if (automatischeSchluessel.has(k) || geplant.has(k)) continue; // Doppel-Befunde nur einmal anlegen
    geplant.add(k);
    anlegen.push(b);
  }

  const entfernen = bestand
    .filter((p) => p.automatisch && p.status === 'offen' && !befundSchluessel.has(pruefschrittSchluessel(p.regelId, p.personId)))
    .map((p) => p.id);

  return { anlegen, entfernen };
}
