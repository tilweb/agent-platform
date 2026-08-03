/**
 * Kontrollierte Wertelisten (Welle 6).
 *
 * Viele Felder haben einen bekannten, endlichen Wertevorrat — Einheiten,
 * Statuscodes, Kostenstellen, Lieferanten. Ohne hinterlegte Liste raet die
 * Extraktion frei und liefert mal "Stk", mal "Stück", mal "stk."; bei hoher
 * Konfidenz faellt das niemandem auf. Ein Katalog am Feld wirkt an drei Stellen:
 *
 *   (a) Prompt        — `renderCatalogHint` haengt die Werte an den Feld-Hinweis.
 *                       Der wird von BEIDEN Prompt-Bauern gerendert (Function-
 *                       Calling in schema-builder.ts, Vision-Freitext-JSON in
 *                       extract-call.ts) — deshalb braucht keine Strategie eine
 *                       Aenderung.
 *   (b) Normalisierung — `applyCatalogs` setzt einen eindeutig zuordenbaren Wert
 *                       auf die kanonische Schreibweise und protokolliert das.
 *   (c) Pruefung      — bleibt ein Wert ausserhalb der Liste, entsteht ein
 *                       Befund (Default `error` → erzwingt "Zu pruefen").
 *
 * Bewusst KEINE harte `enum`-Bindung im Function-Schema: die wuerde das Modell
 * zwingen, auch bei einem echten Ausreisser einen Listenwert zu liefern — der
 * Fehler waere unsichtbar statt sichtbar, und (c) koennte nie ausloesen.
 *
 * Das Matching ist deterministisch (keine LLM-Calls) und jede Stufe verlangt
 * EINDEUTIGKEIT: zwei gleich nahe Kandidaten bedeuten "nicht gemappt, gemeldet".
 *
 * Identisch in beiden Worktrees.
 */

import type {
  CatalogValue,
  ExtractionProject,
  FieldCatalog,
  ProjectField,
  ProjectItemField,
  RuleIssue,
} from './types';

/** Wieviele Werte maximal in den Prompt wandern (Kontext-Schutz). */
const HINT_VALUE_CAP = 40;
/** Ab dieser Laenge greift das Praefix-/Enthalten-Matching. */
const CONTAINS_MIN_LEN = 6;

/**
 * Normalisierung fuer den Vergleich: Umlaute falten, casefold, Interpunktion
 * und Mehrfach-Leerzeichen zusammenziehen. Bewusst aggressiver als
 * `normalizeLookupValue` (rules.ts) — hier soll "Stück." auf "stueck" treffen.
 */
export function normalizeForMatch(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Levenshtein-Distanz mit Frueh-Abbruch: sobald die beste Distanz einer Zeile
 * `max` uebersteigt, kann das Ergebnis nur groesser werden.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** Tippfehler-Budget: kurze Werte duerfen kaum abweichen, lange etwas mehr. */
function typoBudget(length: number): number {
  return Math.max(1, Math.floor(length / 8));
}

export type CatalogMatchKind = 'exact' | 'synonym' | 'contains' | 'fuzzy' | 'ambiguous' | 'none';

export interface CatalogMatch {
  kind: CatalogMatchKind;
  /** Kanonische Schreibweise — nur bei einem eindeutigen Treffer gesetzt. */
  value?: string;
  /** Bei 'ambiguous'/'none': die naechstliegenden Katalogwerte fuer die Meldung. */
  candidates?: string[];
}

/**
 * Einen Rohwert einem Katalogwert zuordnen. Reihenfolge: exakt → Synonym →
 * Praefix/Enthalten → Tippfehler. Jede Stufe zaehlt ihre Treffer; bei mehr als
 * einem gilt der Wert als mehrdeutig (kein Mapping).
 */
export function matchCatalogValue(raw: unknown, values: CatalogValue[]): CatalogMatch {
  const needle = normalizeForMatch(raw);
  if (!needle || values.length === 0) return { kind: 'none' };

  const normalized = values.map((v) => ({ value: v.value, norm: normalizeForMatch(v.value), entry: v }));

  // 1) exakt
  const exact = normalized.filter((v) => v.norm === needle);
  if (exact.length === 1) return { kind: 'exact', value: exact[0]!.value };
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact.map((v) => v.value) };

  // 2) gepflegtes Synonym
  const bySynonym = normalized.filter((v) =>
    (v.entry.synonyms ?? []).some((s) => normalizeForMatch(s) === needle),
  );
  if (bySynonym.length === 1) return { kind: 'synonym', value: bySynonym[0]!.value };
  if (bySynonym.length > 1) return { kind: 'ambiguous', candidates: bySynonym.map((v) => v.value) };

  // 3) Praefix/Enthalten ("Muster Bau" ↔ "Muster Bau GmbH") — erst ab einer
  //    Mindestlaenge, sonst trifft "m" auf alles.
  if (needle.length >= CONTAINS_MIN_LEN) {
    const contains = normalized.filter(
      (v) => v.norm.length >= CONTAINS_MIN_LEN && (v.norm.startsWith(needle) || needle.startsWith(v.norm)),
    );
    if (contains.length === 1) return { kind: 'contains', value: contains[0]!.value };
    if (contains.length > 1) return { kind: 'ambiguous', candidates: contains.map((v) => v.value) };
  }

  // 4) Tippfehler — bestes Ergebnis muss eindeutig sein.
  const budget = typoBudget(needle.length);
  const scored = normalized
    .map((v) => ({ ...v, distance: levenshtein(needle, v.norm, budget) }))
    .filter((v) => v.distance <= budget)
    .sort((a, b) => a.distance - b.distance);

  if (scored.length === 1) return { kind: 'fuzzy', value: scored[0]!.value };
  if (scored.length > 1) {
    if (scored[0]!.distance < scored[1]!.distance) return { kind: 'fuzzy', value: scored[0]!.value };
    return { kind: 'ambiguous', candidates: scored.filter((s) => s.distance === scored[0]!.distance).map((s) => s.value) };
  }

  // Nichts getroffen — die naechsten drei Werte als Hilfestellung melden.
  const nearest = normalized
    .map((v) => ({ value: v.value, distance: levenshtein(needle, v.norm) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((v) => v.value);
  return { kind: 'none', candidates: nearest };
}

/**
 * Der Katalog-Teil des Feld-Hinweises fuer den Extraktions-Prompt. Leerer
 * String, wenn kein Katalog hinterlegt ist oder die Werte erst zur Laufzeit aus
 * einer Tabelle kommen und nicht aufgeloest wurden.
 */
export function renderCatalogHint(values: CatalogValue[] | undefined): string {
  if (!values || values.length === 0) return '';
  const shown = values.slice(0, HINT_VALUE_CAP).map((v) => v.value);
  const rest = values.length - shown.length;
  const list = shown.join(' · ') + (rest > 0 ? ` … (${rest} weitere)` : '');
  return `Zulaessige Werte: ${list}. Passt keiner davon, gib den im Dokument gefundenen Wert zurueck.`;
}

/** Wertequelle: liefert die Katalogwerte eines Feldes (statisch oder aus einer Tabelle). */
export type ResolveCatalog = (
  catalog: FieldCatalog,
) => Promise<{ values: CatalogValue[] } | { error: string }>;

/** Statische Kataloge brauchen keine Aufloesung — Tabellen schon. */
export function staticCatalogValues(catalog: FieldCatalog | undefined): CatalogValue[] | undefined {
  if (!catalog || catalog.source !== 'list') return undefined;
  return (catalog.values ?? []).filter((v) => v?.value?.trim());
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

interface CatalogTarget {
  /** Pfad fuer die Meldung: fieldId bzw. "fieldId[3].spalte". */
  path: string;
  /** fieldIds fuer die Markierung im Formular. */
  fields: string[];
  label: string;
  catalog: FieldCatalog;
  read: () => unknown;
  write: (value: string) => void;
}

/** Alle katalogisierten Werte eines Ergebnisses einsammeln (Skalare + Listen-Spalten). */
function collectTargets(project: ExtractionProject, data: Record<string, unknown>): CatalogTarget[] {
  const targets: CatalogTarget[] = [];

  for (const [fieldId, field] of Object.entries(project.fields)) {
    if (field.type === 'list') {
      const items = data[fieldId];
      if (!Array.isArray(items)) continue;
      for (const [itemId, column] of Object.entries(field.item_fields ?? {})) {
        if (!column.catalog) continue;
        items.forEach((item, idx) => {
          if (!item || typeof item !== 'object') return;
          const row = item as Record<string, unknown>;
          targets.push({
            path: `${fieldId}[${idx + 1}].${itemId}`,
            fields: [fieldId],
            label: `${field.label || fieldId} · ${column.label || itemId} (Position ${idx + 1})`,
            catalog: column.catalog!,
            read: () => row[itemId],
            write: (value) => { row[itemId] = value; },
          });
        });
      }
      continue;
    }

    if (!field.catalog) continue;
    targets.push({
      path: fieldId,
      fields: [fieldId],
      label: field.label || fieldId,
      catalog: field.catalog,
      read: () => data[fieldId],
      write: (value) => { data[fieldId] = value; },
    });
  }

  return targets;
}

/**
 * Kataloge auf ein Extraktionsergebnis anwenden: eindeutige Treffer angleichen
 * (protokolliert als `info`), Ausreisser melden. Mutiert `data` in-place —
 * der Aufrufer arbeitet ohnehin auf dem frisch entpackten Objekt.
 */
export async function applyCatalogs(
  project: ExtractionProject,
  data: Record<string, unknown>,
  resolve: ResolveCatalog,
): Promise<RuleIssue[]> {
  const targets = collectTargets(project, data);
  if (targets.length === 0) return [];

  const issues: RuleIssue[] = [];
  // Wertequellen je Katalog-Definition nur EINMAL aufloesen (Tabellen sind teuer).
  const cache = new Map<string, { values: CatalogValue[] } | { error: string }>();

  for (const target of targets) {
    if (isEmpty(target.read())) continue; // leere Felder sind Sache der Pflicht-/Konfidenzpruefung

    const key = target.catalog.source === 'table'
      ? `table:${target.catalog.table_id}:${target.catalog.column_id}`
      : `list:${target.path}`;

    let source = cache.get(key);
    if (!source) {
      const staticValues = staticCatalogValues(target.catalog);
      source = staticValues ? { values: staticValues } : await resolve(target.catalog);
      cache.set(key, source);
    }

    if ('error' in source) {
      issues.push({
        rule_id: `catalog:${target.path}`,
        type: 'catalog',
        severity: 'warn',
        message: `Werteliste fuer "${target.label}" nicht pruefbar: ${source.error}.`,
        fields: target.fields,
      });
      continue;
    }
    if (source.values.length === 0) continue; // leerer Katalog = keine Aussage

    const raw = target.read();
    const match = matchCatalogValue(raw, source.values);
    const autoMap = target.catalog.auto_map !== false;
    const severity = target.catalog.severity === 'warn' ? 'warn' : 'error';

    // Schon exakt in Katalog-Schreibweise — nichts zu tun. Ein nur NORMALISIERT
    // gleicher Wert ("acme ag" vs. "Acme AG") ist dagegen genau der Fall, den die
    // Angleichung aufraeumen soll, und laeuft unten mit.
    if (match.value !== undefined && match.value === raw) continue;

    if (match.value) {
      if (autoMap) {
        target.write(match.value);
        issues.push({
          rule_id: `catalog:${target.path}`,
          type: 'catalog',
          severity: 'info',
          message: `"${target.label}": Wert "${String(raw)}" auf den Katalogwert "${match.value}" angeglichen.`,
          fields: target.fields,
        });
      } else {
        issues.push({
          rule_id: `catalog:${target.path}`,
          type: 'catalog',
          severity,
          message: `"${target.label}": Wert "${String(raw)}" weicht vom Katalogwert "${match.value}" ab.`,
          fields: target.fields,
        });
      }
      continue;
    }

    const hint = match.candidates?.length ? ` Naechste Katalogwerte: ${match.candidates.join(' · ')}.` : '';
    issues.push({
      rule_id: `catalog:${target.path}`,
      type: 'catalog',
      severity,
      message: match.kind === 'ambiguous'
        ? `"${target.label}": Wert "${String(raw)}" ist nicht eindeutig zuzuordnen.${hint}`
        : `"${target.label}": Wert "${String(raw)}" steht nicht in der hinterlegten Werteliste.${hint}`,
      fields: target.fields,
    });
  }

  return issues;
}

/** Katalog-Hinweis eines Projekt-Feldes (nur statische Listen landen im Prompt). */
export function fieldCatalogHint(field: ProjectField | ProjectItemField): string {
  return renderCatalogHint(staticCatalogValues(field.catalog));
}
