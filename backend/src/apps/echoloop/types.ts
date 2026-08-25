/**
 * Echo-Loop Domänen-Typen (Ebene Kunde → Prozess → Baustand).
 */
import type { Dim } from './scoring';
import type { GateNachweis } from './scoring';
import type { PMFinding } from './checker/types';
import type { AnalyseTiefe, InputInventar, PanelPflichtEintrag } from './analyse-tiefen';
import type { NkConfig } from './lvar/nkconfig';

export type AppRole = 'owner' | 'editor' | 'viewer';

/** Ebene 1 — Kunde (Zwilling-Wurzel). */
export interface Kunde {
  id: string;
  name: string;
  branche?: string;
  notizen?: string;
  /** Additive, kundenspezifische NK-Anpassung über dem fixen Paket-Standard (Scheibe C). */
  nkConfig?: NkConfig;
  ownerId?: string;
  permissions?: unknown;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

/** Kritikalitäts-Profil (WB44c): 6 Fragen a|b|c → K-Stufe (Maximum-Prinzip). */
export interface KritProfil {
  antworten?: Partial<Record<'k1' | 'k2' | 'k3' | 'k4' | 'k5' | 'k6', 'a' | 'b' | 'c'>>;
  stufe?: 'normal' | 'hoch' | 'sehr_hoch';
  treiber?: string[];
}

/** Ebene 2 — Prozess-Akte. */
export interface Prozess {
  id: string;
  kundeId: string;
  name: string;
  emmaPlanNr?: string;
  beschreibung?: string;
  systeme?: string[];
  kritikalitaet?: KritProfil;
  ownerId?: string;
  permissions?: unknown;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

/** Kundenfähiges Narrativ je Dimension (Gold-Form): Zweck-Frage + Beleg-Prosa + Empfehlungen. */
export interface DimNarrativ {
  purpose?: string;
  beleg: string;
  recs: string[];
}

/** Kundenfähige RGA-Kundenfassung (Gold-Dramaturgie, D-050-Sprachregeln). */
export interface Narrativ {
  exec: { was: string; findings: string[]; staerken: string[] };
  prosa: string[];
  dims: Partial<Record<Dim, DimNarrativ>>;
  stabilityNote?: string;
  erzeugtAm: string;
  modell: string;
}

/** Ein abhakbarer Bau-Schritt (D-061 interaktiv). */
export interface Bauschritt {
  text: string;
  done?: boolean;
}

/** Eine Bau-Karte (eine Maßnahme der Bauanleitung), abhakbar + Feedback (D-061). */
export interface Baukarte {
  id: string; // z.B. "BK-0", "BK-1"
  titel: string;
  dimension?: string; // "D5"
  prio: 'hoch' | 'mittel' | 'niedrig';
  warum: string;
  schritte: Bauschritt[];
  status?: 'offen' | 'in_arbeit' | 'erledigt' | 'frage' | 'anders_gebaut';
  feedback?: string;
}

/** Bauanleitung zu einem Baustand (Ziel-Level RGn), interaktiv (D-061). */
export interface Bauanleitung {
  zielLevel: number;
  einleitung: string;
  karten: Baukarte[];
  erzeugtAm: string;
  modell: string;
}

export type BaustandStatus = 'entwurf' | 'in_review' | 'freigegeben';

/** Bewertung einer RGA-Dimension mit Beleg + Evidenz-Disziplin. */
export interface DimensionBewertung {
  ist: number;
  soll: number;
  relevanz: 0 | 1;
  beleg?: string;
  /** Provenienz-Tag: [G Text] | [Graph] | [Panel] | [Interview]. */
  provenienz?: string;
  konfidenz?: 'hart' | 'weich' | 'offen';
  /** Begründung der Maskierung (Pflicht wenn relevanz=0). */
  maskeGrund?: string;
}

export interface Kennzahlen {
  gesamtRg: number;
  rgStar: number;
  rgq: number;
  seQuotient: number;
  limiter: string[];
  notenZeile: string;
}

/** Ebene 3 — Baustand: ein Reifegrad-Analyse-Stand. */
export interface Baustand {
  id: string;
  prozessId: string;
  datum: string;
  status: BaustandStatus;
  quelle?: string;
  dimensionen: Record<Dim, DimensionBewertung>;
  befunde: PMFinding[];
  kennzahlen: Kennzahlen;
  /** Analyse-Tiefe (Seite-1-Prinzip) + Input-Inventar I1–I6, aus denen sie deklariert wurde. */
  analyseTiefe?: AnalyseTiefe;
  inputInventar?: InputInventar;
  /** Panel-Pflichtliste für Fehlerklassen ohne statische Spur (Vollständigkeits-Regel D-072). */
  panelPflichtliste?: PanelPflichtEintrag[];
  /** Doppel-Nachweise (T-A + T-B/T-C) je Vereinbarungs-Gate (Zwei-Naturen R3), Key = Gate-ID. */
  gateNachweise?: Record<string, GateNachweis>;
  /** LLM-Vor-Benotungs-Begründungen je Dimension (Entwurf, vom Menschen zu prüfen). */
  llmBegruendung?: Partial<Record<Dim, string>>;
  /** Deterministische Top-Hebel aus dem Checker (priorisierte Maßnahmen). */
  topHebel?: { dim: string; titel: string; wirkung: string }[];
  /** Adversariale PA-Prüfagenten-Befunde (Stufe 2, beobachtend), dedupliziert gegen die Checker-Anker. */
  paBefunde?: import('./pruefagenten/types').PAFinding[];
  /** Kundenfähige Narrativ-Synthese (on-demand, Reasoning-Modell) — Gold-Form. */
  narrativ?: Narrativ;
  /** Interaktive Bauanleitung (on-demand generiert, D-061 abhakbar). */
  bauanleitung?: Bauanleitung;
  reviewerId?: string;
  permissions?: unknown;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

// ── PAKET_2 · L-VAR-Datenspine (Familie → Einzelprozess → Variable/CFG) ──────

/** NK-Rolle einer Variable (Kanon C_/H_/T_/Fachwert/A_Ergebnis). */
export type VarRolle = 'C_' | 'H_' | 'T_' | 'Fachwert' | 'A_Ergebnis';

/** NK-Gate-Befunde G1–G7 je Variable (soft-default; hart nur bei Kanon-Verstoß). */
export type NkBefunde = Partial<Record<'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7', string>>;

/** Persistierte Variable (Zeile der EMMA-„Variable Informationen"-Tabelle). */
export interface Variable {
  id: string;
  prozessItemId: string;
  prozessId: string;              // Familie (denormalisiert für familienweite Cluster)
  p: string;                      // Prozessnummer
  varId: string;                  // EMMA-Variablen-ID
  name: string;
  typ?: string;
  schnitt?: string;
  rolle?: VarRolle;
  init?: string;
  pos?: number;
  fund?: { s: string; typ: string }[];
  umbruch?: boolean;              // geratene Umbruch-Klebung → ❓, nie Befund (Prinzip §3.4)
  neu?: boolean;                  // Ziel-/Neuvorschlag (NK)
  nkBefunde?: NkBefunde;
  created_at?: string;
}

/** Einzelprozess-Steckbrief innerhalb einer Familie (Extraktions-Ergebnis je Lauf). */
export interface ProzessItem {
  id: string;
  prozessId: string;              // Familie
  baustandId?: string;
  nr: string;                     // EMMA-Prozessnummer
  nameExport?: string;
  typ?: 'MP' | 'TP' | 'SP';       // Prozesstyp §A9
  kritikalitaet?: string;
  kritGrund?: string;
  kopfblock?: string;
  prozessStand?: string;
  druckStand?: string;
  aufrufe?: string[];             // Call-Graph-Ziele (TestCaseID)
  cvrefs?: { s: string; nnn: number; name: string }[];
  ausgaenge?: { erfolg: number; fehler: number };
  fingerprint?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

/** Diff-Klasse eines CFG-Schlüssels (CFG-Generator, 7 Klassen). */
export type CfgDiffKlasse =
  | 'deckungsgleich' | 'nur_produzent' | 'nur_konsument' | 'wert_konflikt'
  | 'quelle_konflikt' | 'waise_produzent' | 'waise_konsument';

/** Konfigurations-Schlüssel einer Familie (CFG-Generator). */
export interface CfgKey {
  id: string;
  prozessId: string;              // Familie
  schluessel: string;
  wert?: string;
  wertQuelle?: string;
  produzent?: string[];
  konsument?: string[];
  diffKlasse?: CfgDiffKlasse;
  herkunft?: string;
  created_at?: string;
}
