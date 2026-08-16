/**
 * Analyse-Tiefen T-A/T-B/T-C — Regel-Modul aus
 * STANDARD_Input-Anforderungskatalog_Analyse-Tiefen.md.
 *
 *   T-A = nur I1 (Prozess-Exporte)            → „hier KANN etwas schiefgehen"
 *                                                Struktur sicher, Verhalten ❓
 *   T-B = I1+I2(+I3/I4) Betriebsdaten         → „hier GEHT etwas schief — so oft, seit wann"
 *                                                Beweise + Zahlen. Pflicht, wo Betriebsdaten existieren.
 *   T-C = alles (I1–I6, inkl. Briefing+Panel) → „belegt vollständig, Soll geklärt"
 *
 * Drei normative Regeln, hier deterministisch geprüft:
 *  · Seite-1-Prinzip: jede RGA deklariert ihre Tiefe; der Bericht verspricht
 *    nie mehr, als seine Tiefe trägt (über-deklarieren = ungetragen).
 *  · Klassen-Scan-Pflicht (D-072): ein neu erkanntes Muster wird über den
 *    GANZEN Export-Satz gescannt; Einzelfund ohne Klassen-Scan = „Zufallsfund".
 *  · Vollständigkeits-Regel (D-072): Fehlerklassen ohne statische Spur brauchen
 *    eine vollständige Panel-Pflichtliste (T-C-Evidenz); eine Vollständigkeits-
 *    Aussage setzt die abgearbeitete Liste voraus. Statik liefert die LISTE,
 *    das Panel liefert den BEWEIS.
 *
 * Rein & deterministisch (kein LLM, kein DB).
 */

export type AnalyseTiefe = 'T-A' | 'T-B' | 'T-C';
export const TIEFE_RANK: Record<AnalyseTiefe, number> = { 'T-A': 1, 'T-B': 2, 'T-C': 3 };

/** Input-Inventar I1–I6 (Datengrundlage der Analyse). */
export interface InputInventar {
  I1?: boolean; // Prozess-Exporte (PDF + .emtc) — Pflicht-Basis
  I2?: boolean; // Betriebsdaten (Archiv-Stände, Logs, Ergebnis-Excels als Zeitreihe)
  I3?: boolean; // Run-Reports + Beweisbilder
  I4?: boolean; // Ordnerstruktur
  I5?: boolean; // Briefing/Interview (Fach-Soll, Sonderfälle, Mengengerüst)
  I6?: boolean; // Video/Panel-Session
}

export const INPUT_LABEL: Record<keyof InputInventar, string> = {
  I1: 'Prozess-Exporte', I2: 'Betriebsdaten', I3: 'Run-Reports + Beweisbilder',
  I4: 'Ordnerstruktur', I5: 'Briefing/Interview (Fach-Soll)', I6: 'Video/Panel-Session',
};

/** Die Kern-Zusage je Tiefe (was der Bericht versprechen darf). */
export const TIEFE_VERSPRICHT: Record<AnalyseTiefe, string> = {
  'T-A': 'hier KANN etwas schiefgehen — Struktur sicher, Verhalten ❓',
  'T-B': 'hier GEHT etwas schief — so oft, seit wann (Beweise + Zahlen)',
  'T-C': 'belegt vollständig, Soll geklärt',
};

/** Höchste durch das Inventar getragene Tiefe (null wenn nicht einmal I1 da ist). */
export function maxTiefe(inv: InputInventar): AnalyseTiefe | null {
  if (!inv.I1) return null;                          // ohne Exporte keine Analyse
  if (inv.I2 && inv.I5 && inv.I6) return 'T-C';      // Betriebsdaten + Soll + Panel
  if (inv.I2) return 'T-B';                          // Betriebsdaten (Zeitreihe)
  return 'T-A';                                      // nur Exporte
}

/** Behauptungs-Klassen, die eine Tiefe abdecken darf. */
export type BehauptungsKlasse = 'struktur' | 'risiko' | 'verhalten' | 'zahlen' | 'vollstaendigkeit' | 'soll';

const ERLAUBT: Record<AnalyseTiefe, BehauptungsKlasse[]> = {
  'T-A': ['struktur', 'risiko'],
  'T-B': ['struktur', 'risiko', 'verhalten', 'zahlen'],
  'T-C': ['struktur', 'risiko', 'verhalten', 'zahlen', 'vollstaendigkeit', 'soll'],
};

/** Darf ein Bericht dieser Tiefe eine Aussage dieser Klasse treffen? */
export function darfBehaupten(tiefe: AnalyseTiefe, klasse: BehauptungsKlasse): boolean {
  return ERLAUBT[tiefe].includes(klasse);
}

export interface TiefeDeklaration {
  deklariert: AnalyseTiefe;
  inventar: InputInventar;
  maxGetragen: AnalyseTiefe | null;
  /** true wenn die deklarierte Tiefe vom Inventar gedeckt ist (kein Über-Versprechen). */
  getragen: boolean;
  /** true wenn Betriebsdaten (I2) da sind, aber nur T-A deklariert wurde (T-B-Pflicht verletzt). */
  tbPflichtVerletzt: boolean;
  verspricht: string;
  hinweise: string[];
}

/**
 * Prüft eine Tiefe-Deklaration gegen das Inventar (Seite-1-Prinzip):
 * über-deklarieren ist ungetragen; T-B ist Pflicht, wo Betriebsdaten existieren.
 */
export function deklariereTiefe(deklariert: AnalyseTiefe, inventar: InputInventar): TiefeDeklaration {
  const max = maxTiefe(inventar);
  const getragen = max !== null && TIEFE_RANK[deklariert] <= TIEFE_RANK[max];
  const tbPflichtVerletzt = !!inventar.I2 && deklariert === 'T-A';
  const hinweise: string[] = [];
  if (max === null) hinweise.push('Ohne Prozess-Exporte (I1) ist keine Analyse möglich.');
  if (!getragen && max) hinweise.push(`Deklariert ${deklariert}, getragen nur ${max}: der Bericht darf nicht mehr versprechen, als die Tiefe trägt.`);
  if (tbPflichtVerletzt) hinweise.push('Betriebsdaten (I2) vorhanden → T-B ist Pflicht (Verdacht → Beweis + Quantifizierung).');
  return { deklariert, inventar, maxGetragen: max, getragen, tbPflichtVerletzt, verspricht: TIEFE_VERSPRICHT[deklariert], hinweise };
}

// ── Klassen-Scan-Pflicht (D-072) ─────────────────────────────────────────────

export interface KlassenScanErgebnis<T> {
  treffer: T[];
  abgedeckteProzesse: string[];
  /** true wenn wirklich über den gesamten Export-Satz gescannt wurde. */
  vollstaendig: boolean;
}

/**
 * Führt ein neu erkanntes Muster über den GESAMTEN Export-Satz aus (nicht nur
 * den Einzelfund). Ein Ergebnis gilt nur als Klassen-Scan, wenn alle Prozesse
 * abgedeckt sind.
 */
export function klassenScan<T>(alleProzessNummern: string[], scan: (nr: string) => T[]): KlassenScanErgebnis<T> {
  const treffer: T[] = [];
  const abgedeckt: string[] = [];
  for (const nr of alleProzessNummern) {
    abgedeckt.push(nr);
    treffer.push(...scan(nr));
  }
  const vollstaendig = abgedeckt.length === alleProzessNummern.length && alleProzessNummern.length > 0;
  return { treffer, abgedeckteProzesse: abgedeckt, vollstaendig };
}

/**
 * Markiert einen Befund als „Zufallsfund", wenn er NICHT aus einem vollständigen
 * Klassen-Scan stammt (D-072: Einzelbefunde ohne Klassen-Scan sind Zufallsfunde).
 */
export function markiereZufallsfund<F extends object>(finding: F, ausVollstaendigemScan: boolean): F & { zufallsfund?: boolean } {
  return ausVollstaendigemScan ? finding : { ...finding, zufallsfund: true };
}

// ── Vollständigkeits-Regel / Panel-Pflichtliste (D-072) ──────────────────────

export interface PanelPflichtEintrag {
  klasse: string;      // Fehlerklasse ohne statische Spur (z.B. „Bindung/Reihenfolge")
  frage: string;       // die am Panel zu beantwortende Frage
  erledigt: boolean;   // am Panel abgearbeitet (Beweis erbracht)
  beleg?: string;      // Panel-Beleg (T-C-Evidenz)
}

/** Noch offene (nicht abgearbeitete) Panel-Pflichtfragen. */
export function offenePanelFragen(liste: PanelPflichtEintrag[]): PanelPflichtEintrag[] {
  return liste.filter((e) => !e.erledigt);
}

/**
 * Ist eine Vollständigkeits-Aussage zulässig? Nur wenn die Panel-Pflichtliste
 * existiert UND vollständig abgearbeitet ist (Statik liefert LISTE, Panel BEWEIS).
 */
export function vollstaendigkeitZulaessig(liste: PanelPflichtEintrag[]): boolean {
  return liste.length > 0 && offenePanelFragen(liste).length === 0;
}
