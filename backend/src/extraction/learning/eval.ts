import { withPriority } from '../../services/extraction/runtime';
/** Independent holdout evaluation through the production extraction entry point. */
import { createHash } from 'crypto';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { createSnapshot, profileHash, stableHash, sameDocument, type ExtractionSnapshot } from './snapshot';
import { updateCalibration } from './review';
import { extractionModelLabel } from '../model';
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
  case_results?: Array<{ id: string; group?: string; error?: string; actual?: Record<string, unknown>; validations?: import('./types').RuleIssue[]; field_confidences?: Record<string, number>; strategy?: string }>;
  /** true bei mindestens einem Ausfall; verhindert die Regelübernahme. */
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
  | { expected: Record<string, unknown>; actual: Record<string, unknown>; valid?: boolean; group?: string }
  | { error: string; group?: string };

/** Wilson 95% interval for document-level successes; fields are not independent samples. */
export function documentInterval(correct: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 100 };
  const z2 = 1.96 ** 2, p = correct / total, denominator = 1 + z2 / total;
  const middle = (p + z2 / (2 * total)) / denominator;
  const margin = 1.96 * Math.sqrt(p * (1 - p) / total + z2 / (4 * total ** 2)) / denominator;
  return { low: Math.max(0, Math.round((middle - margin) * 1000) / 10), high: Math.min(100, Math.round((middle + margin) * 1000) / 10) };
}

/** Aggregiert Vergleichs-Zeilen zu Feld-/Gesamt-Accuracy (Prozent, 1 Dezimale). */
export function scoreEvalRows(project: ExtractionProject, rows: EvalRow[]): EvalOutcome {
  const scoredFields: Record<string, ProjectField> = { ...project.fields };
  // Segment fields are scored as complete instances including duplicate counts.
  for (const [id, segment] of Object.entries(project.segments ?? {})) {
    scoredFields[id] = { type: 'text', label: segment.label, required: !!segment.required };
  }
  const fieldIds = Object.keys(scoredFields);
  const matchesField = (id: string, expected: unknown, actual: unknown) => project.segments?.[id]
    ? stableHash(expected ?? null) === stableHash(actual ?? null)
    : compareField(scoredFields[id]!, expected, actual);
  const ok = rows.filter((r): r is Extract<EvalRow, { expected: unknown }> => !('error' in r));
  const failures = rows.length - ok.length;

  const byField: Record<string, number> = {};
  let matchesTotal = 0;
  for (const fieldId of fieldIds) {

    let matches = 0;
    for (const row of ok) {
      if (matchesField(fieldId, row.expected[fieldId], row.actual[fieldId])) matches += 1;
    }
    matchesTotal += matches;
    byField[fieldId] = rows.length > 0 ? Math.round((matches / rows.length) * 1000) / 10 : 0;
  }

  const pairs = rows.length * fieldIds.length;
  const documentCorrect = (row: EvalRow) => !('error' in row) && row.valid !== false && fieldIds.every(id => matchesField(id, row.expected[id], row.actual[id]));
  const by_group: Record<string, number> = {};
  const by_group_examples: Record<string, number> = {};
  for (const group of new Set(rows.map(r => r.group ?? 'nicht zugeordnet'))) {
    const subset = rows.filter(r => (r.group ?? 'nicht zugeordnet') === group);
    by_group_examples[group] = subset.length;
    by_group[group] = Math.round(subset.filter(documentCorrect).length / subset.length * 1000) / 10;
  }
  return {
    overall: pairs > 0 ? Math.round((matchesTotal / pairs) * 1000) / 10 : 0,
    by_field: byField,
    examples: rows.length,
    document_accuracy: rows.length ? Math.round(rows.filter(documentCorrect).length / rows.length * 1000) / 10 : 0,
    by_group, by_group_examples,
    document_interval: documentInterval(rows.filter(documentCorrect).length, rows.length),
    failures,
    failed: rows.length === 0 || fieldIds.length === 0 || failures > 0,
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
  championOverall: number | EvalScore | null,
  challenger: EvalOutcome,
): { accept: boolean; reason: 'error' | 'better-or-equal' | 'worse' | 'no-champion' } {
  if (challenger.failed || challenger.failures > 0 || challenger.aligned === false) return { accept: false, reason: 'error' };
  if (championOverall === null) return { accept: true, reason: 'no-champion' };
  if (typeof championOverall === 'object') {
    const champion = championOverall;
    if (champion.examples !== challenger.examples || champion.dataset_hash !== challenger.dataset_hash
      || (challenger.document_accuracy ?? 0) < (champion.document_accuracy ?? 0)
      || Object.entries(champion.by_field).some(([id, score]) => (challenger.by_field[id] ?? 0) < score)
      || Object.entries(champion.by_group ?? {}).some(([id, score]) => (challenger.by_group?.[id] ?? 0) < score)) return { accept: false, reason: 'worse' };
    championOverall = champion.overall;
  }
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
 * Alle Fälle zählen; ein Ausfall verhindert die Übernahme.
 */
export async function runEval(
  project: ExtractionProject,
  guidelinesText: string,
  examples: TrainingExample[],
  userId?: string,
  trainingExamples: TrainingExample[] = [],
  captured?: ExtractionSnapshot,
  runner?: typeof import('./service').extract,
): Promise<EvalOutcome> {
  const { extract, captureSnapshot } = await import('./service');
  const snapshot = captured ? createSnapshot({ ...captured.project, guidelines: guidelinesText }, trainingExamples)
    : await captureSnapshot({ ...project, guidelines: guidelinesText }, trainingExamples);
  if (captured) snapshot.references = structuredClone(captured.references);
  snapshot.hash = stableHash({ hash: snapshot.hash, references: snapshot.references });
  const rows: EvalRow[] = new Array(examples.length);
  const results: Array<Awaited<ReturnType<typeof extract>> | undefined> = new Array(examples.length);
  await pLimit(examples, Math.max(1, EVAL_CONCURRENCY || 1), async (example, idx) => {
    let dir: string | undefined;
    const group = example.dataset?.group || 'nicht zugeordnet';
    try {
      if (trainingExamples.some(e => sameDocument(e, example))) throw new Error('Testdokument im Lernbestand');
      if (example.dataset?.purpose !== 'test' || !example.dataset.original) throw new Error('Kein unabhängiges Testbeispiel mit Original');
      const original = example.dataset.original;
      const bytes = Buffer.from(original.base64, 'base64');
      if (createHash('sha256').update(bytes).digest('hex') !== original.sha256) throw new Error('Original-Prüfsumme stimmt nicht');
      dir = await mkdtemp(join(tmpdir(), 'extraction-eval-'));
      const filename = basename(original.filename);
      const path = join(dir, filename);
      await writeFile(path, bytes);
      const result = await withPriority('evaluation', () => (runner ?? extract)(project.id, { type: 'file', path, filename }, userId, snapshot));
      results[idx] = result;
      if (!result.success || result.validations?.some(i => i.rule_id === 'verarbeitung' || i.rule_id === 'segmentierung' || i.status === 'not_evaluated')) {
        throw new Error(result.error || 'Verarbeitung unvollständig oder Prüfung nicht ausgeführt');
      }
      rows[idx] = { expected: example.corrected_extraction, actual: result.data, valid: !result.validations?.some(i => i.rule_id !== 'quellenpruefung' && i.severity === 'error'), group };
    } catch (err) {
      rows[idx] = { error: err instanceof Error ? err.message : String(err), group };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  });
  const score = scoreEvalRows(project, rows);
  let calibration: import('./types').CalibrationState | undefined;
  for (let idx = 0; idx < examples.length; idx++) {
    const result = results[idx];
    if (result?.success && result.fieldConfidences) calibration = updateCalibration(calibration, project, result.data, examples[idx]!.corrected_extraction, result.fieldConfidences);
  }
  score.case_results = rows.map((row, index) => ({ id: examples[index]!.id, group: row.group,
    error: 'error' in row ? row.error : undefined, actual: results[index]?.data,
    validations: results[index]?.validations, field_confidences: results[index]?.fieldConfidences, strategy: results[index]?.strategyUsed }));
  score.calibration = calibration;
  score.dataset_version = project.learning.dataset_version ?? 0;
  score.measured_strategy = project.segments ? 'segmented' : snapshot.project.extraction!.strategy;
  score.production_strategy = score.measured_strategy;
  score.aligned = true;
  score.dataset_hash = stableHash(examples.map(e => ({ id: e.id, truth: e.corrected_extraction, source: e.dataset?.original?.sha256, group: e.dataset?.group })).sort((a,b) => a.id.localeCompare(b.id)));
  score.dataset_manifest = examples.map(e => ({ id: e.id, source_sha256: e.dataset?.original?.sha256, group: e.dataset?.group, truth: structuredClone(e.corrected_extraction) }));
  score.profile_hash = profileHash(snapshot.project);
  return score;
}
