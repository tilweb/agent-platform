/**
 * Eval-Harness fuer den Lern-Loop (Welle 2).
 *
 * Misst, wie gut ein Guidelines-Text die Trainingsbeispiele reproduziert:
 * jedes Beispiel wird text-only re-extrahiert (gespeicherter `document_text`,
 * single-pass, LLM-Confidence aus) und Feld fuer Feld normalisiert gegen die
 * Ground Truth (`corrected_extraction`) verglichen.
 *
 * Bewusste Design-Entscheidungen:
 *  - OHNE Few-Shot: Few-Shot speist sich aus demselben Beispiel-Pool — ein
 *    Beispiel saehe sich selbst (Leakage). Das Eval misst genau das, was sich
 *    bei einem Guideline-Update aendert: instructions + guidelines.
 *  - Text-only: Beispiele speichern nur `document_text`, keine Originaldatei.
 *    Guenstige Naeherung; Vision-Qualitaet wird nicht mitgemessen.
 */

import { createHash } from 'crypto';
import { runPipeline, type PreparedFile } from '../../services/extraction';
import { extractionProjectToExtractionSchema, PROJECT_FIELD_GROUP } from './pipeline-adapter';
import { extractionModelLabel } from '../model';
import { dedupeListItems } from './list-utils';
import { correctNumber, correctDate } from './validators';
import type {
  ExtractionProject,
  ProjectField,
  ProjectItemField,
  TrainingExample,
  EvalScore,
} from './types';

const EVAL_CONCURRENCY = parseInt(process.env.EXTRACTION_EVAL_CONCURRENCY || '3', 10);
/** Zahlenvergleich-Toleranz (Rundungs-/Formatdifferenzen). */
const NUMBER_EPSILON = 0.005;

export interface EvalOutcome extends EvalScore {
  /** true, wenn zu viele Beispiele scheiterten (>50 %) — Ergebnis unbrauchbar. */
  failed: boolean;
  /** Anzahl der Beispiele, deren Re-Extraktion fehlschlug. */
  failures: number;
}

// ============== Pure Vergleichslogik (testbar ohne LLM) ==============

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function normalizeText(v: unknown): string {
  return String(v).trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'ja', 'yes', '1', 'wahr'].includes(s)) return true;
    if (['false', 'nein', 'no', '0', 'falsch'].includes(s)) return false;
  }
  return null;
}

/**
 * Normalisiert einen Skalar-Wert typgerecht fuer den Vergleich. Rueckgabe ist
 * ein Vergleichs-Key (string) oder null (leer/nicht normalisierbar).
 */
export function normalizeForCompare(
  type: ProjectItemField['type'],
  value: unknown,
): string | null {
  if (isEmptyValue(value)) return null;
  switch (type) {
    case 'number': {
      const n = correctNumber(value);
      // Auf Epsilon-Raster runden, damit 0.1249 und 0.125 nicht zufaellig
      // verschiedene Keys ergeben.
      return n === null ? normalizeText(value) : String(Math.round(n / NUMBER_EPSILON));
    }
    case 'date': {
      const d = correctDate(value);
      return d === null ? normalizeText(value) : d;
    }
    case 'boolean': {
      const b = normalizeBool(value);
      return b === null ? normalizeText(value) : String(b);
    }
    default:
      return normalizeText(value);
  }
}

/** Multiset-Key einer Listen-Zeile ueber die definierten Spalten. */
function listItemKey(item: unknown, itemFields: Record<string, ProjectItemField>): string {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return `raw:${normalizeText(item)}`;
  }
  const rec = item as Record<string, unknown>;
  return JSON.stringify(
    Object.entries(itemFields).map(([id, itf]) => normalizeForCompare(itf.type, rec[id])),
  );
}

/**
 * Vergleicht erwarteten und extrahierten Wert eines Projekt-Felds
 * (typ-normalisiert; Listen als ordnungs-unabhaengiges Multiset).
 */
export function compareField(field: ProjectField, expected: unknown, actual: unknown): boolean {
  if (field.type === 'list') {
    const itemFields = field.item_fields ?? {};
    const exp = Array.isArray(expected) ? expected : [];
    const act = Array.isArray(actual) ? actual : [];
    if (exp.length !== act.length) return false;
    const counts = new Map<string, number>();
    for (const item of exp) {
      const k = listItemKey(item, itemFields);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const item of act) {
      const k = listItemKey(item, itemFields);
      const c = counts.get(k);
      if (!c) return false;
      counts.set(k, c - 1);
    }
    return true;
  }

  const expEmpty = isEmptyValue(expected);
  const actEmpty = isEmptyValue(actual);
  if (expEmpty || actEmpty) return expEmpty === actEmpty;

  if (field.type === 'number') {
    const e = correctNumber(expected);
    const a = correctNumber(actual);
    if (e !== null && a !== null) return Math.abs(e - a) <= NUMBER_EPSILON;
  }
  return normalizeForCompare(field.type, expected) === normalizeForCompare(field.type, actual);
}

export type EvalRow =
  | { expected: Record<string, unknown>; actual: Record<string, unknown> }
  | { error: string };

/** Aggregiert Vergleichs-Zeilen zu Feld-/Gesamt-Accuracy (Prozent, 1 Dezimale). */
export function scoreEvalRows(project: ExtractionProject, rows: EvalRow[]): EvalOutcome {
  const fieldIds = Object.keys(project.fields);
  const ok = rows.filter((r): r is Extract<EvalRow, { expected: unknown }> => !('error' in r));
  const failures = rows.length - ok.length;

  const byField: Record<string, number> = {};
  let matchesTotal = 0;
  for (const fieldId of fieldIds) {
    const field = project.fields[fieldId]!;
    let matches = 0;
    for (const row of ok) {
      if (compareField(field, row.expected[fieldId], row.actual[fieldId])) matches += 1;
    }
    matchesTotal += matches;
    byField[fieldId] = ok.length > 0 ? Math.round((matches / ok.length) * 1000) / 10 : 0;
  }

  const pairs = ok.length * fieldIds.length;
  return {
    overall: pairs > 0 ? Math.round((matchesTotal / pairs) * 1000) / 10 : 0,
    by_field: byField,
    examples: ok.length,
    failures,
    failed: rows.length === 0 || failures > rows.length / 2,
  };
}

/** Stabiler Hash des Eval-Sets (Champion-Score-Cache-Invalidierung). */
export function evalSetHash(exampleIds: string[], model: string, cap: number): string {
  const h = createHash('sha256');
  h.update([...exampleIds].sort().join('|'));
  h.update(`|${model}|${cap}`);
  return h.digest('hex').slice(0, 16);
}

/**
 * Akzeptanzregel: Challenger uebernehmen, wenn sein Eval nutzbar ist und er
 * den Champion nicht unterschreitet (Gleichstand zaehlt als Verbesserung —
 * neuere Regeln spiegeln mehr Beispiele).
 */
export function decideAcceptance(
  championOverall: number | null,
  challenger: EvalOutcome,
): { accept: boolean; reason: 'error' | 'better-or-equal' | 'worse' | 'no-champion' } {
  if (challenger.failed) return { accept: false, reason: 'error' };
  if (championOverall === null) return { accept: true, reason: 'no-champion' };
  return challenger.overall >= championOverall
    ? { accept: true, reason: 'better-or-equal' }
    : { accept: false, reason: 'worse' };
}

// ============== Eval-Lauf (LLM) ==============

/** Worker-Pool (Muster batch-service.ts). */
async function pLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
}

/** Entpackt ein Pipeline-Ergebnis zu flachen Projekt-Feldern (wie extract()). */
function unpackExtracted(
  project: ExtractionProject,
  extracted: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    ...((extracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>),
  };
  for (const [fieldId, field] of Object.entries(project.fields)) {
    if (field.type !== 'list') continue;
    const raw = extracted[fieldId];
    data[fieldId] = dedupeListItems(Array.isArray(raw) ? raw : [], field.item_fields ?? {});
  }
  return data;
}

/** Anzeigename des Eval-Modells (fuers Audit/Hash — Override oder Systemstandard). */
export function evalModelLabel(project: ExtractionProject): string {
  const o = project.extraction?.model_override;
  // Ohne projekteigenes Modell laeuft die Extraktion auf dem festen
  // Extraktions-Modell (extraction/model.ts) — nicht mehr auf dem
  // System-/Session-Standard. Das Audit soll das ehrlich benennen.
  return o ? `${o.provider_id}/${o.model_id}` : extractionModelLabel();
}

/**
 * Misst einen Guidelines-Text gegen die uebergebenen Beispiele.
 * Fail-Soft je Beispiel; `failed` wenn >50 % scheitern.
 */
export async function runEval(
  project: ExtractionProject,
  guidelinesText: string,
  examples: TrainingExample[],
  userId?: string,
): Promise<EvalOutcome> {
  // Schema einmal bauen: Projekt-Kopie mit Kandidaten-Guidelines, KEIN Few-Shot.
  const schema = extractionProjectToExtractionSchema(
    { ...project, guidelines: guidelinesText },
    [],
  );
  schema.config.strategy = 'single-pass'; // Engine eskaliert bei Overflow selbst zu chunked
  schema.config.llm_confidence = false;   // Heuristik reicht — Scores werden nicht verglichen

  const rows: EvalRow[] = new Array(examples.length);
  await pLimit(examples, EVAL_CONCURRENCY, async (example, idx) => {
    try {
      const files: PreparedFile[] = [
        {
          filename: example.source_filename || 'beispiel',
          text: example.document_text,
          mimeType: 'text/plain',
        },
      ];
      const result = await runPipeline({ files, schema, userId: userId ?? '' });
      rows[idx] = {
        expected: example.corrected_extraction,
        actual: unpackExtracted(project, result.extracted),
      };
    } catch (err) {
      rows[idx] = { error: err instanceof Error ? err.message : String(err) };
    }
  });

  return scoreEvalRows(project, rows);
}
