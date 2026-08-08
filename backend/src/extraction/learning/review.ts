/**
 * Review-Triage + Konfidenz-Kalibrierung (Welle 3).
 *
 * Triage: Nach einer Batch-Extraktion wird je Datei entschieden, ob sie ein
 * menschliches Review braucht (`needs_review`) oder automatisch okay ist
 * (`auto_ok`). Nach einem "Uebernehmen & lernen" wird sie `reviewed`.
 *
 * Kalibrierung: Bei jedem Korrektur-Training (Training-Tab ODER Batch-Review)
 * wird je Feld mit Konfidenz gezaehlt, ob die initiale Extraktion tatsaechlich
 * korrekt war — aggregiert in 5 Konfidenz-Buckets. Damit laesst sich ablesen,
 * ob die Konfidenz echte Fehler vorhersagt (ueber-/unterkonfident).
 */

import { compareField } from './eval';
import { hasBlockingIssue } from './rules';
import type { CalibrationState, ExtractionProject, ReviewStatus, RuleIssue } from './types';

/** Default-Schwelle, wenn weder review_threshold noch confidence_threshold gesetzt. */
const DEFAULT_REVIEW_THRESHOLD = 0.6;

/** Review-Schwelle des Projekts (eigenes Feld → Pipeline-Schwelle → Default). */
export function resolveReviewThreshold(project: ExtractionProject): number {
  return (
    project.extraction?.review_threshold ??
    project.extraction?.confidence_threshold ??
    DEFAULT_REVIEW_THRESHOLD
  );
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Triage-Regel: `needs_review`, wenn irgendein Feld Konfidenz < Schwelle hat
 * UND (Wert vorhanden ODER Feld required). Leere optionale Felder mit
 * Konfidenz 0 loesen bewusst KEIN Review aus (sonst Dauer-Alarm bei selten
 * belegten Feldern). Fehlende Konfidenz zaehlt wie Konfidenz 0.
 *
 * Zusaetzlich (Welle 5): Ein `error`-Befund der fachlichen Pruefregeln erzwingt
 * das Review UNABHAENGIG von der Konfidenz — ein sicher extrahierter, fachlich
 * unplausibler Wert ist genau der Fall, den die Konfidenz nicht sieht.
 */
export function computeReviewStatus(
  project: ExtractionProject,
  data: Record<string, unknown>,
  fieldConfidences: Record<string, number> | undefined,
  validations?: RuleIssue[],
): Extract<ReviewStatus, 'auto_ok' | 'needs_review'> {
  if (hasBlockingIssue(validations)) return 'needs_review';
  const threshold = resolveReviewThreshold(project);
  for (const [fieldId, field] of Object.entries(project.fields)) {
    const conf = fieldConfidences?.[fieldId] ?? 0;
    if (conf >= threshold) continue;
    const hasValue = !isEmptyValue(data?.[fieldId]);
    if (hasValue || field.required) return 'needs_review';
  }
  // Segment-Profile (Welle 10): Konfidenzen sind namespaced
  // ("segId.feld" bzw. "segId[2].feld") — jede unter der Schwelle mit
  // vorhandenem Wert zieht ein Review. `unbekannt`-Segmente und fehlende
  // Pflicht-Segmente kommen bereits als error-Befund herein (hasBlockingIssue).
  if (project.segments && fieldConfidences) {
    for (const [path, conf] of Object.entries(fieldConfidences)) {
      if (!path.includes('.')) continue;
      if (conf >= threshold) continue;
      const value = resolveSegmentValue(data, path);
      if (!isEmptyValue(value)) return 'needs_review';
    }
  }
  return 'auto_ok';
}

/** Loest "segId.feld" / "segId[2].feld" gegen die aggregierte Segment-Datenstruktur auf. */
function resolveSegmentValue(data: Record<string, unknown>, path: string): unknown {
  const m = path.match(/^([^.[]+)(?:\[(\d+)\])?\.(.+)$/);
  if (!m) return undefined;
  const [, segId, instance, fieldId] = m;
  const seg = data?.[segId!];
  const obj = instance !== undefined && Array.isArray(seg) ? seg[Number(instance) - 1] : seg;
  if (!obj || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[fieldId!];
}

export function emptyCalibration(): CalibrationState {
  return {
    buckets: Array.from({ length: 5 }, () => ({ total: 0, correct: 0 })),
    samples: 0,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Kalibrierung fortschreiben: fuer jedes Projekt-Feld mit Konfidenz wird
 * gezaehlt, ob die initiale Extraktion korrekt war (Vergleich mit der vom
 * Menschen bestaetigten `corrected`-Version — typ-normalisiert via
 * `compareField`, damit reine Formatabweichungen nicht als Fehler zaehlen).
 * Gibt einen NEUEN State zurueck (Input bleibt unveraendert).
 */
export function updateCalibration(
  state: CalibrationState | undefined,
  project: ExtractionProject,
  initial: Record<string, unknown>,
  corrected: Record<string, unknown>,
  fieldConfidences: Record<string, number>,
): CalibrationState {
  const next: CalibrationState = state
    ? {
        buckets: state.buckets.map((b) => ({ ...b })),
        samples: state.samples,
        updated_at: new Date().toISOString(),
      }
    : emptyCalibration();

  for (const [fieldId, field] of Object.entries(project.fields)) {
    const conf = fieldConfidences[fieldId];
    if (typeof conf !== 'number' || Number.isNaN(conf)) continue;
    const bucket = Math.min(4, Math.max(0, Math.floor(conf * 5)));
    const correct = compareField(field, corrected[fieldId], initial[fieldId]);
    next.buckets[bucket]!.total += 1;
    if (correct) next.buckets[bucket]!.correct += 1;
    next.samples += 1;
  }

  return next;
}
