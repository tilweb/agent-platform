/**
 * Checker-Typen — Datenmodell fuer die deterministische Pruefung von
 * EMMA-Studio-Prozess-Exporten (aus `pdftotext -layout`-Text).
 *
 * Bewusst property-zentrisch statt spalten-positions-basiert: der PDF-Export
 * druckt Schritt-Eigenschaften als `Key:Value`-Zeilen, die robust extrahierbar
 * sind — Spaltenpositionen driften je Export.
 */

/** Ein Schleifen-Baustein (fuer PM-01/PM-04/PM-04b). */
export interface EmmaLoop {
  schrittId: number;
  /** MaxLoopCount roh, z.B. "614" (Literal) oder "{CV:Anzahl}" (variabel). */
  maxLoopCount: string | null;
  /** true wenn MaxLoopCount eine reine Zahl ist (kein {CV:...}). */
  maxIstLiteral: boolean;
  resetBeforeStart: boolean | null;
  resetOnMax: boolean | null;
  /** Hinweis auf variablengebundenen Zaehler (Name-Spalte "Schleife:V:N"). */
  zaehlerVariabel: boolean;
  nameHint: string;
}

/** Ein OCR-ausloesender Lese-Schritt (fuer PM-09). */
export interface EmmaOcrRead {
  schrittId: number;
  /** "Text" oder "RegEx". */
  subject: string;
  timeoutMs: number | null;
  /** "Accurate" | "Fast" | null. */
  textExtractionMode: string | null;
  nameHint: string;
}

/** Ein Aufruf eines Unterprozesses (Verschachtelter Prozess → TestCaseID). */
export interface EmmaCall {
  schrittId: number;
  /** Ziel-Prozessnummer; -1/0 = kein Ziel (toter Aufruf, PM-03). */
  testCaseId: number;
  nameHint: string;
}

/** Ein `Warten`-Schritt im Zeit-Modus (feste Wartezeit — Bautechnik D2). */
export interface EmmaFixedWait {
  schrittId: number;
  /** Timeout in Sekunden (Subject:Time). */
  sekunden: number;
  /** true wenn der Schritt ein bewusster Manipulations-/Sammel-Knoten ist (WB50) — kein blindes Warten. */
  istManipulation: boolean;
  nameHint: string;
}

/** Ein `Klicken`-Schritt auf feste Bildschirm-Koordinaten (Bautechnik D1). */
export interface EmmaFixedClick {
  schrittId: number;
  x: number;
  y: number;
  /** true wenn X=0 und Y=0 — deutet auf Fund-Bindung (Klick am Fundort) hin → ❓ am Panel. */
  vermutlichFundgebunden: boolean;
  nameHint: string;
}

export interface EmmaVariable {
  varId: string;
  name: string;
  typ: string;
  init: string;
  schnittstelle: string;
}

export interface EmmaProcess {
  /** Prozessnummer (aus "Prozess NNNN" oder Dateiname). */
  nr: string;
  name: string;
  sourceFile: string;
  loops: EmmaLoop[];
  ocrReads: EmmaOcrRead[];
  calls: EmmaCall[];
  fixedWaits: EmmaFixedWait[];
  fixedClicks: EmmaFixedClick[];
  variables: EmmaVariable[];
  /** Alle Datums-/Zeitstempel-Literale (fuer PM-10 Kohorten-Analyse). */
  dateLiterals: string[];
  /** Hart verdrahtete Windows-Pfade (Bautechnik D6/D10). */
  hardcodedPaths: string[];
  /** true wenn ein Klartext-Kennwort-Literal gefunden wurde (Bautechnik D8). */
  hasPlaintextPassword: boolean;
  /** Gesamtzahl erkannter Schritte (grobe Groesse). */
  schrittCount: number;
}

export interface EmmaFamily {
  processes: EmmaProcess[];
  byNr: Map<string, EmmaProcess>;
}

/** 🔴 kritisch · 🔶 hoch · 🟡 mittel · ⚪ niedrig · ❓ Panel-Frage (statisch nicht entscheidbar). */
export type Severity = 'kritisch' | 'hoch' | 'mittel' | 'niedrig' | 'frage';

export const SEVERITY_ICON: Record<Severity, string> = {
  kritisch: '🔴',
  hoch: '🔶',
  mittel: '🟡',
  niedrig: '⚪',
  frage: '❓',
};

/**
 * Einheitliches Befund-Schema (Prüf-Assistenten-Suite WB36).
 * Provenienz: [G Text]=aus PDF-Text belegt · [Graph]=Call-Graph · [Panel]=nur
 * am Eigenschaften-Panel entscheidbar · [Interview]=Rueckfrage.
 */
export interface PMFinding {
  pm: string; // "PM-01" ...
  aspekt: string;
  prozessNr: string;
  schrittId?: number;
  befund: string;
  beleg: string;
  provenienz: '[G Text]' | '[Graph]' | '[Panel]' | '[Interview]';
  schwere: Severity;
  /** nur bei Seed-vs-Bug-relevanten Mustern gesetzt. */
  seedOrBug?: 'seed' | 'bug' | 'unklar';
  empfehlung: string;
  /** betroffene RGA-Dimensionen, z.B. ["D2","D4"]. */
  dimensionen: string[];
  /**
   * true = beobachtendes Muster (PAKET_2-Governance: läuft still bis 0 Fehlalarme
   * auf Fixtures, eskaliert NIE hart, färbt keine Kennzahl). Scharf­schaltung nur
   * im Regel-Review nach FP-Messung. Scharfe Muster (PM-01/02/03…) tragen den Flag nicht.
   */
  beobachtend?: boolean;
}

export interface CheckerResult {
  findings: PMFinding[];
  family: {
    prozessNummern: string[];
    callGraph: { von: string; nach: string; schrittId: number }[];
  };
}
