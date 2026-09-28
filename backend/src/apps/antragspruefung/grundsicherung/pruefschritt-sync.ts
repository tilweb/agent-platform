/**
 * Grundsicherung — Abgleich der automatischen Prüfschritte mit einem Prüfergebnis (rein, DB-frei).
 *
 * Semantik laut Muster (Abschnitt 3), identisch zu Wohngeld:
 * - Neue Befunde → anlegen (status offen, automatisch).
 * - Befunde, die es nicht mehr gibt → automatische, noch OFFENE Schritte entfernen.
 * - Offene automatische Schritte, deren Regel inzwischen einen anderen Typ/Titel liefert (z. B.
 *   Anforderung → Hinweis), werden angeglichen — sonst bliebe der alte Stand bis zum Erledigen stehen.
 * - Manuelle Schritte (automatisch=false) und erledigte/verworfene bleiben unberührt.
 * Schlüssel: regelId + personId.
 */
import type { PruefBefund, Pruefschritt } from './types';

export interface PruefschrittSyncPlan {
  /** Befunde, für die ein neuer automatischer Prüfschritt angelegt wird. */
  anlegen: PruefBefund[];
  /** IDs automatischer, offener Prüfschritte ohne passenden Befund. */
  entfernen: string[];
  /** Offene automatische Schritte mit geändertem Typ/Titel der Regel → neuer Stand aus dem Befund. */
  angleichen: Array<{ id: string; befund: PruefBefund }>;
}

/** Stabiler Schlüssel eines Befunds/Prüfschritts. */
export function pruefschrittSchluessel(regelId: string, personId?: string | null): string {
  return `${regelId}::${personId ?? ''}`;
}

type Bestand = Pick<Pruefschritt, 'id' | 'regelId' | 'personId' | 'status' | 'automatisch'> & Partial<Pick<Pruefschritt, 'typ' | 'titel'>>;

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

  // Nur bei geändertem Typ/Titel (Regeländerung) — nicht bei jedem neuen Belegtext, sonst liefen
  // parallele Bearbeitungen des Schritts ständig in Versionskonflikte (wie Wohngeld).
  const befundJeSchluessel = new Map(befunde.map((b) => [pruefschrittSchluessel(b.regelId, b.personId), b]));
  const angleichen = bestand
    .filter((p) => p.automatisch && p.status === 'offen')
    .flatMap((p) => {
      const b = befundJeSchluessel.get(pruefschrittSchluessel(p.regelId, p.personId));
      return b && p.typ !== undefined && (b.typ !== p.typ || b.titel !== p.titel) ? [{ id: p.id, befund: b }] : [];
    });

  return { anlegen, entfernen, angleichen };
}
