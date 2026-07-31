/**
 * Echo-Loop Domänen-Typen (Ebene Kunde → Prozess → Baustand).
 */
import type { Dim } from './scoring';
import type { PMFinding } from './checker/types';

export type AppRole = 'owner' | 'editor' | 'viewer';

/** Ebene 1 — Kunde (Zwilling-Wurzel). */
export interface Kunde {
  id: string;
  name: string;
  branche?: string;
  notizen?: string;
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
  /** LLM-Vor-Benotungs-Begründungen je Dimension (Entwurf, vom Menschen zu prüfen). */
  llmBegruendung?: Partial<Record<Dim, string>>;
  /** Deterministische Top-Hebel aus dem Checker (priorisierte Maßnahmen). */
  topHebel?: { dim: string; titel: string; wirkung: string }[];
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
