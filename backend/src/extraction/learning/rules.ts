/**
 * Fachliche Pruefregeln (Welle 5).
 *
 * Bisher pruefte das Feature nur Typ/Format (`extraction/validator.ts`) und
 * Konfidenz (Review-Triage, Welle 3). Beides sagt nichts darueber, ob ein
 * Ergebnis fachlich stimmig ist: Eine Rechnung, deren Positionen nicht zum
 * Gesamtbetrag summieren, ist mit hoher Konfidenz trotzdem falsch.
 *
 * Zwei Regeltypen:
 *   - `sum`    — Positions-Spalte summiert (in Toleranz) auf ein Zielfeld
 *   - `lookup` — Feldwert muss in einer Tabellen-Spalte (Tables) vorkommen
 *
 * Die reine Auswertung ist bewusst frei von Storage-Zugriffen (testbar); die
 * Wertequelle des Lookups kommt als Callback herein. Damit kann Welle 6
 * (kontrollierte Wertelisten am Feld) dieselbe Auswertung mit einer anderen
 * Quelle nutzen.
 *
 * Identisch in beiden Worktrees.
 */

import { correctNumber } from './validators';
import type {
  CountRule,
  ExtractionProject,
  ExtractionRule,
  LookupRule,
  RuleIssue,
  RuleSeverity,
  SumRule,
} from './types';

/** Absolute Default-Toleranz des Summen-Checks (Cent-Genauigkeit). */
const DEFAULT_TOLERANCE = 0.01;

/** Anzeigename einer Regel fuer Meldungstexte. */
function fieldLabel(project: ExtractionProject, fieldId: string): string {
  return project.fields[fieldId]?.label || fieldId;
}

function itemFieldLabel(project: ExtractionProject, listField: string, itemField: string): string {
  return project.fields[listField]?.item_fields?.[itemField]?.label || itemField;
}

/** Zahl-Formatierung fuer Meldungen (deutsch, 2 Nachkommastellen). */
export function fmtNumber(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/** Normalisierung fuer den Stammdaten-Vergleich: trim + casefold + Mehrfach-Leerzeichen. */
export function normalizeLookupValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Summen-Check. Kein Befund, wenn das Zielfeld leer ist ODER die Liste leer ist
 * — dann gibt es schlicht nichts zu vergleichen (sonst Dauer-Alarm bei
 * unvollstaendigen Dokumenten). Nicht-numerische Positionswerte werden ueber
 * `correctNumber` normalisiert (deutsche Formate) und sonst uebersprungen.
 */
export function evaluateSumRule(
  rule: SumRule,
  data: Record<string, unknown>,
  project: ExtractionProject,
): RuleIssue | null {
  const items = data[rule.list_field];
  const target = correctNumber(data[rule.target_field]);

  if (!Array.isArray(items) || items.length === 0) return null;
  if (isEmpty(data[rule.target_field]) || target === null) return null;

  let sum = 0;
  let counted = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = (item as Record<string, unknown>)[rule.item_field];
    const num = correctNumber(raw);
    if (num === null) continue;
    sum += num;
    counted += 1;
  }
  if (counted === 0) return null;

  const tolerance = typeof rule.tolerance === 'number' && rule.tolerance >= 0 ? rule.tolerance : DEFAULT_TOLERANCE;
  const diff = Math.abs(sum - target);
  // Fliesskomma-Rauschen (0.1 + 0.2) darf keinen Befund ausloesen.
  if (diff <= tolerance + 1e-9) return null;

  const listLabel = fieldLabel(project, rule.list_field);
  const colLabel = itemFieldLabel(project, rule.list_field, rule.item_field);
  const targetLabel = fieldLabel(project, rule.target_field);
  return {
    rule_id: rule.id,
    type: 'sum',
    severity: 'error',
    message:
      `Summe "${colLabel}" aus ${counted} Position${counted === 1 ? '' : 'en'} (${listLabel}) ` +
      `ergibt ${fmtNumber(sum)}, "${targetLabel}" nennt ${fmtNumber(target)} ` +
      `(Abweichung ${fmtNumber(diff)}).`,
    fields: [rule.list_field, rule.target_field],
  };
}

/**
 * Anzahl-Check: Positionen eines `list`-Felds vs. skalares Soll-Anzahl-Feld.
 * Fehlt die Soll-Anzahl (leer/unparsebar), ist nichts pruefbar → kein Befund.
 * Deckt anders als der Summen-Check auch den Fall „Instanz fehlt/erfunden" ab.
 */
export function evaluateCountRule(
  rule: CountRule,
  data: Record<string, unknown>,
  project: ExtractionProject,
): RuleIssue | null {
  if (isEmpty(data[rule.target_field])) return null;
  const target = correctNumber(data[rule.target_field]);
  if (target === null) return null;

  const items = data[rule.list_field];
  const actual = Array.isArray(items) ? items.length : 0;
  if (actual === target) return null;

  const listLabel = fieldLabel(project, rule.list_field);
  const targetLabel = fieldLabel(project, rule.target_field);
  const severity: RuleSeverity = rule.severity === 'warn' ? 'warn' : 'error';
  return {
    rule_id: rule.id,
    type: 'count',
    severity,
    message:
      `"${targetLabel}" nennt ${target}, extrahiert wurde${actual === 1 ? '' : 'n'} aber ${actual} ` +
      `${listLabel}-Eintrag${actual === 1 ? '' : 'e'}.`,
    fields: [rule.list_field, rule.target_field],
  };
}

/**
 * Stammdaten-Abgleich gegen eine Menge zulaessiger Werte. `allowedValues` ist
 * bereits normalisiert (siehe `normalizeLookupValue`). `null` bedeutet: Quelle
 * nicht ladbar → `warn`-Befund statt falscher Sicherheit.
 */
export function evaluateLookupRule(
  rule: LookupRule,
  data: Record<string, unknown>,
  allowedValues: Set<string> | null,
  project: ExtractionProject,
  sourceError?: string,
): RuleIssue | null {
  const label = fieldLabel(project, rule.field);
  const severity: RuleSeverity = rule.severity === 'warn' ? 'warn' : 'error';

  if (allowedValues === null) {
    return {
      rule_id: rule.id,
      type: 'lookup',
      severity: 'warn',
      message: `Stammdaten fuer "${label}" nicht pruefbar: ${sourceError || `Tabelle "${rule.table_id}" nicht verfuegbar`}.`,
      fields: [rule.field],
    };
  }

  const raw = data[rule.field];
  if (isEmpty(raw)) return null; // leeres Feld ist Sache der Pflichtfeld-/Konfidenz-Pruefung

  if (allowedValues.has(normalizeLookupValue(raw))) return null;

  return {
    rule_id: rule.id,
    type: 'lookup',
    severity,
    message: `"${label}": Wert "${String(raw)}" steht nicht in den Stammdaten (Tabelle "${rule.table_id}", Spalte "${rule.column_id}").`,
    fields: [rule.field],
  };
}

/** Lade-Callback fuer Lookup-Werte — vom Aufrufer (Service) mit Tables verdrahtet. */
export type LoadAllowedValues = (
  tableId: string,
  columnId: string,
) => Promise<{ values: Set<string> } | { error: string }>;

/**
 * Alle Regeln eines Projekts gegen ein Extraktionsergebnis pruefen.
 * Lookup-Quellen werden je (Tabelle, Spalte) nur EINMAL geladen.
 */
export async function evaluateRules(
  project: ExtractionProject,
  data: Record<string, unknown>,
  loadAllowedValues: LoadAllowedValues,
): Promise<RuleIssue[]> {
  const rules = project.rules ?? [];
  if (rules.length === 0) return [];

  const issues: RuleIssue[] = [];
  const sourceCache = new Map<string, { values: Set<string> } | { error: string }>();

  for (const rule of rules) {
    try {
      if (rule.type === 'sum') {
        const issue = evaluateSumRule(rule, data, project);
        if (issue) issues.push(issue);
        continue;
      }
      if (rule.type === 'count') {
        const issue = evaluateCountRule(rule, data, project);
        if (issue) issues.push(issue);
        continue;
      }
      if (rule.type === 'lookup') {
        const cacheKey = `${rule.table_id}::${rule.column_id}`;
        let source = sourceCache.get(cacheKey);
        if (!source) {
          source = await loadAllowedValues(rule.table_id, rule.column_id);
          sourceCache.set(cacheKey, source);
        }
        const issue =
          'error' in source
            ? evaluateLookupRule(rule, data, null, project, source.error)
            : evaluateLookupRule(rule, data, source.values, project);
        if (issue) issues.push(issue);
      }
    } catch (err) {
      // Eine kaputte Regel darf die Extraktion nie kippen.
      console.error(`[rules] Regel "${rule.id}" fehlgeschlagen:`, err instanceof Error ? err.message : err);
      issues.push({
        rule_id: rule.id,
        type: rule.type,
        severity: 'warn',
        message: `Regel "${rule.label || rule.id}" konnte nicht geprueft werden.`,
        fields: [],
      });
    }
  }

  return issues;
}

/** Gibt es einen blockierenden Befund (→ erzwingt "Zu pruefen")? */
export function hasBlockingIssue(issues: RuleIssue[] | undefined): boolean {
  return !!issues?.some((i) => i.severity === 'error');
}

/** Kurzbeschreibung einer Regel fuer Listen/Anzeige. */
export function describeRule(rule: ExtractionRule, project: ExtractionProject): string {
  if (rule.type === 'sum') {
    return `Summe "${itemFieldLabel(project, rule.list_field, rule.item_field)}" (${fieldLabel(project, rule.list_field)}) = "${fieldLabel(project, rule.target_field)}"`;
  }
  if (rule.type === 'count') {
    return `Anzahl "${fieldLabel(project, rule.list_field)}" = "${fieldLabel(project, rule.target_field)}"`;
  }
  return `"${fieldLabel(project, rule.field)}" in Tabelle "${rule.table_id}" (Spalte "${rule.column_id}")`;
}
