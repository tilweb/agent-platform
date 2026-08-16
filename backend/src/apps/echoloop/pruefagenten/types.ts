/**
 * PA-Prüfagenten (PA-F1…F4) — Typen. Referenz: PA-PRUEFAGENTEN_Manifest_v1.
 *
 * Vier adversariale Spezialagenten (F = Muster-Familie), die parallel zum
 * deterministischen Checker (Stufe 1) laufen und je Befund einen aktiven
 * Widerlegungs-Versuch (Refutation) dokumentieren. Nur was den Widerlegungs-
 * versuch übersteht (Status „belegt") wird Befund; Graph≠Text → „verify".
 */
import type { Severity } from '../checker/types';

export type PAAgentId = 'PA-F1' | 'PA-F2' | 'PA-F3' | 'PA-F4';

/** Verdikt: belegt · ❓verify (nur am Panel/Graph entscheidbar) · widerlegt (mit Gegenbeleg). */
export type PAStatus = 'belegt' | 'verify' | 'widerlegt';

export interface PAFinding {
  agent: PAAgentId;
  id: string;               // "PA-F1-1"
  titel: string;
  prozessNr: string;        // Fundstelle Pflicht (ohne Fundstelle kein Befund)
  schrittId?: number;
  beleg: string;            // Roh-Extrakt, wortgetreu, gekürzt
  status: PAStatus;
  schwere: Severity;
  dimensionen: string[];    // D1–D10
  refutation: string;       // aktiv versuchter Gegenbeleg + warum er misslang
  empfehlung: string;       // 1 Satz, baukartenfähig
  /**
   * 0-FP-Regel (Experten-Wette 1): neue Muster-Kandidaten laufen beobachtend
   * (kein 🔴 in der Kundenfassung), bis sie am Fixture-Bestand ohne Fehlalarm
   * bestehen. Bis dahin beobachtend:true.
   */
  beobachtend: boolean;
}

export interface PAAgentResult {
  agent: PAAgentId;
  befunde: PAFinding[];
  zusammenfassung: string;      // 3-Zeilen-Zusammenfassung
  nichtGeprueft: string[];      // NICHT geprüfte Evidenzquellen (Input des Completeness-Kritikers)
  fehler?: string;              // gesetzt wenn der Agent-Lauf scheiterte (Timeout/Parse)
}

export interface PAFanoutResult {
  agenten: PAAgentResult[];
  /** alle „belegt"/„verify"-Befunde, dedupliziert gegen die Checker-Anker. */
  befunde: PAFinding[];
  /** Befunde, die einen Checker-Anker an derselben Fundstelle doppeln (zusammengeführt, nicht doppelt gemeldet). */
  zusammengefuehrt: number;
  /** offen ausgewiesene Widersprüche Agent vs. Checker. */
  widersprueche: string[];
}
