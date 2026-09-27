/**
 * Antrag-Kern — Aufbewahrung & Löschung (GOV-5; rein, DB-frei, testbar).
 *
 * Reines Datums-/Fristen-Rechnen auf ISO-Datumsteilen (YYYY-MM-DD). KEINE Persistenz.
 * Bei Abschluss eines Vorgangs (Abschluss-Status der App) wird ab dem Stichtag die
 * Aufbewahrungsfrist berechnet. Löschung erfolgt NIE automatisch — `istLoeschfaellig`
 * liefert nur den Kandidaten. Fristen + Abschluss-Status liefert die App.
 */
import { addJahre, dayPart, toUtcDay } from './datum';

/** Jahre als feste Zahl oder als Getter (z. B. zur Laufzeit aus der Umgebung gelesen). */
export type JahreQuelle = number | (() => number);

export interface AufbewahrungKonfig {
  /** Standardfrist (Jahre) ab Abschluss. */
  jahre: JahreQuelle;
  /** Kürzere Frist (Jahre) für abgelehnte/gegenstandslose Anträge. */
  jahreAbgelehnt: JahreQuelle;
  /** Status, ab denen die Frist läuft. */
  abschlussStatus: readonly string[];
}

/** Struktureller Mindesttyp eines aufbewahrten Objekts. */
export interface Aufbewahrbar {
  aufbewahrungBis?: string;
  legalHold?: boolean;
}

function jahreWert(q: JahreQuelle): number {
  return typeof q === 'function' ? q() : q;
}

/**
 * Ist ein Objekt löschfällig? Löschfällig = `aufbewahrungBis` liegt VOR heute
 * (strikt <) UND kein Legal Hold. Ohne gesetzte Frist → nicht löschfällig.
 * Löschung bleibt manuell + bestätigungspflichtig (kein Auto-Delete).
 */
export function istLoeschfaellig(
  objekt: Aufbewahrbar | null | undefined,
  heuteIso: string,
): boolean {
  if (!objekt) return false;
  if (objekt.legalHold) return false;
  const bis = dayPart(objekt.aufbewahrungBis);
  const heute = dayPart(heuteIso);
  if (!bis || !heute) return false;
  return toUtcDay(bis) < toUtcDay(heute);
}

/** Aufbewahrungs-Funktionen mit App-Konfiguration. */
export function createAufbewahrung(konfig: AufbewahrungKonfig) {
  /** true, wenn der Status ein Abschluss-Status ist. */
  function istAbschlussStatus(status: string | undefined): boolean {
    return !!status && konfig.abschlussStatus.includes(status);
  }

  /** Standard-Aufbewahrungsfrist (Jahre). */
  function aufbewahrungJahreDefault(): number {
    return jahreWert(konfig.jahre);
  }

  /** Kürzere Aufbewahrungsfrist (Jahre) für abgelehnte/gegenstandslose Anträge. */
  function aufbewahrungJahreAbgelehnt(): number {
    return jahreWert(konfig.jahreAbgelehnt);
  }

  /**
   * Aufbewahrungs-Enddatum berechnen. Nur bei Abschluss-Status; sonst `undefined`
   * (Frist beginnt erst mit Abschluss). `stichtagIso` = Abschluss-Datum (i. d. R.
   * heute). `jahre` optional — sonst Standardfrist.
   */
  function berechneAufbewahrungBis(
    status: string | undefined,
    stichtagIso: string | undefined,
    jahre?: number,
  ): string | undefined {
    if (!istAbschlussStatus(status)) return undefined;
    const day = dayPart(stichtagIso);
    if (!day) return undefined;
    const years = jahre ?? aufbewahrungJahreDefault();
    return addJahre(day, years);
  }

  return { istAbschlussStatus, aufbewahrungJahreDefault, aufbewahrungJahreAbgelehnt, berechneAufbewahrungBis, istLoeschfaellig };
}
