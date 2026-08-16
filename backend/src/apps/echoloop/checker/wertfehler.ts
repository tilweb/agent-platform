/**
 * /wertfehler — Wertfehler-/Wertketten-Analyse (SKILL_wertfehler.md).
 *
 * Die Klasse „Prozess läuft weiter, Wert ist falsch/leer" — Frank Priebes
 * häufigste + teuerste Fehlerklasse, STILL (kein roter Schritt). Ohne
 * Betriebsdaten (T-B) strukturell nur teilweise sichtbar.
 *
 * Diese Assembly strukturiert die vorhandenen statischen W-Befunde (PM-W-a/b/c,
 * deterministischer Checker) entlang der **6-Stationen-Herkunftskette** und
 * führt die nur am Panel entscheidbaren Suchrichtungen (W2 Prüf-Entscheidung,
 * W3 Sentinel/Altwert — der schwerste Fall) als stehende ❓-Fragen mit.
 *
 * Methoden-Kern (SKILL §3): nicht das Kettenabgehen allein, sondern den
 * „letzten beweisbar richtigen Punkt" finden — der Fehler liegt zwischen der
 * letzten nachweislich richtigen und der ersten nachweislich falschen Station.
 *
 * Rein & deterministisch. Der adversariale Teil (6-Stationen aktiv verfolgen)
 * liegt im PA-F1-Prüfagenten (Stufe 2, opt-in).
 */
import type { PMFinding } from './types';

/** Die W-Prüfmuster (statisch entscheidbar, beobachtend). */
export const W_MUSTER = new Set(['PM-W-a', 'PM-W-b', 'PM-W-c']);

export interface WertStation {
  nr: number;
  station: string;
  prueft: string;
  muster: string[];              // welche PM-W-Muster hier greifen (leer = nur Panel)
  befunde: PMFinding[];          // vorliegende statische Befunde an dieser Station
}

export interface WertfehlerAnalyse {
  statischeBefunde: PMFinding[];
  stationen: WertStation[];
  panelFragen: string[];         // W2/W3 — nie statisch, immer am Panel klären
  methodenHinweis: string;
}

/** Zuordnung Muster → Stations-Nummer (Ablage = Typ; Übertragung = Key-Tippen). */
const MUSTER_STATION: Record<string, number> = { 'PM-W-b': 3, 'PM-W-c': 3, 'PM-W-a': 5 };

const STATIONEN: Omit<WertStation, 'befunde'>[] = [
  { nr: 1, station: 'Ursprung', prueft: 'Woher stammt der Wert (Datei/Beleg/Vordatensatz)?', muster: [] },
  { nr: 2, station: 'Aufnahme (Finden/Lesen/Import)', prueft: 'Hat die Extraktion einen negativen Ausgang, oder liefert sie stumm leer?', muster: [] },
  { nr: 3, station: 'Ablage (Ergebnisfeld/Variable)', prueft: 'Typ korrekt? Sentinel-Vorbelegung vorhanden oder Altwert-Gefahr (W3)?', muster: ['PM-W-b', 'PM-W-c'] },
  { nr: 4, station: 'Umformung (Variablen-Op)', prueft: 'Extrahieren/Ersetzen — Prüfung auf leer/unverändert danach?', muster: [] },
  { nr: 5, station: 'Übertragung (Tippen/Einsetzen)', prueft: 'Key-Tippen-Zeichenverlust, >20-Zeichen-Ketten ohne Zielfeld-Prüfung (W1)?', muster: ['PM-W-a'] },
  { nr: 6, station: 'Ziel (Feld/Zelle/Maske/Mail)', prueft: 'Plausibilitäts-/0-€-/Leer-Sperre VOR Buchen/Senden (W2)? Ergebnis geprüft?', muster: [] },
];

const PANEL_FRAGEN = [
  'W2 · Steht vor jedem Schreiben/Buchen/Senden eine Prüf-Entscheidung (0-€-Sperre, Leer-Sperre, Plausibilität)? Besonders bei Beträgen.',
  'W3 (schwerster Fall) · Werden Schleifen-Variablen mit einem Sentinel vorbelegt? Sonst überlebt der Altwert eines Nicht-Treffers und wird plausibel weitergeschrieben.',
  'Wirkungs-Nachweis (F-D3-6) · Endet ein Wert als „Erfolg", ohne dass das ERGEBNIS geprüft wurde?',
];

/** Strukturiert die Checker-Befunde als Wertfehler-Analyse entlang der 6 Stationen. */
export function wertfehlerAnalyse(findings: PMFinding[]): WertfehlerAnalyse {
  const statischeBefunde = findings.filter((f) => W_MUSTER.has(f.pm));
  const stationen: WertStation[] = STATIONEN.map((st) => ({
    ...st,
    befunde: statischeBefunde.filter((f) => MUSTER_STATION[f.pm] === st.nr),
  }));
  return {
    statischeBefunde,
    stationen,
    panelFragen: PANEL_FRAGEN,
    methodenHinweis: 'Nicht raten („müsste stimmen"): den letzten beweisbar richtigen Punkt finden — der Fehler liegt zwischen der letzten nachweislich richtigen und der ersten nachweislich falschen Station.',
  };
}
