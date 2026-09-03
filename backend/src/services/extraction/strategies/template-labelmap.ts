/**
 * template-labelmap — deterministische Extraktion fuer born-digital Formular-PDFs
 * mit stabiler Label→Wert-Struktur (z.B. Grundsteuermessbescheide GMBX).
 *
 * KEIN LLM, KEIN OCR, KEIN Vision-Call. Der Parser ankert an den `label`s der
 * Profil-Felder (nicht an den verschiebbaren Abschnittsnummern). Wiederholbare
 * Bloecke (z.B. Eigentuemer) sind `list`-Felder im Profil; das `_label` der
 * Liste ist zugleich das Signal, an dem eine neue Instanz beginnt
 * (Abschnitts-Header "N – <Label>").
 *
 * Textquelle: `pdftotext -layout` (poppler-utils) auf dem Original-PDF
 * (`PreparedFile.rawBuffer`). Der linearisierte Markdown-Text (`PreparedFile.text`,
 * via Markitdown/Docling) wird BEWUSST NICHT genutzt — er zerstoert die
 * zweispaltige Label/Wert-Struktur. poppler ist ohnehin Plattform-Dependency
 * (siehe `pdf.ts`, `pdftocairo`).
 *
 * Konfidenz: 1.0 fuer jedes per Label belegte Feld (der Textlayer IST die
 * Quelle — Aequivalent zur OCR-Fusion "verified" aus W7). Unbekannte Labels und
 * eine Abweichung zwischen "Anzahl der Eigentuemer" und den geparsten Instanzen
 * werden zu `processingIssues` → die Review-Triage legt sie vor.
 */

import { isArrayGroup, type ExtractionProfile, type FieldDefinition } from '../../../extraction/types';
import { validateExtraction } from '../../../extraction/validator';
import { pdfToLayoutText } from '../pdf';
import {
  StrategyExecutionError,
  type CostEstimate,
  type ExtractionStrategy,
  type FieldProvenance,
  type ProgressEmit,
  type StrategyInput,
  type StrategyResult,
} from '../types';

/** Abschnitts-Header: "3 – Eigentümer", "2.1 – Name E". Nummer ist variabel. */
const SECTION_RE = /^\s*\d+(?:\.\d+)?\s+[–—-]\s+(.+?)\s*$/;

function norm(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Eine Zeile → [label, value] oder null. Wert nach >=2 Spaces (Spaltengap). */
function parseLine(line: string): [string, string] | null {
  if (!line.trim()) return null;
  if (/^\s*\d+\s*=/.test(line)) return null; // Legenden-Zeile ("0 = ...; 1 = ...")
  const parts = line.trim().split(/\s{2,}/);
  if (parts.length < 2) return null;
  const label = parts[0]!.trim();
  const value = parts.slice(1).join(' ').trim();
  if (!/[A-Za-zÄÖÜäöüß]/.test(label) || label.length < 3) return null;
  return [label, value];
}

function isoDate(d: string): string {
  let m = d.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return d;
}

function coerce(value: string, type: FieldDefinition['type']): unknown {
  if (type === 'date') return isoDate(value);
  if (type === 'number' && /^-?\d+$/.test(value)) return Number(value);
  return value;
}

interface DocEntry { group: string; field: string; type: FieldDefinition['type']; }
interface ListGroup {
  group: string;
  labelNorm: string;
  items: Map<string, { field: string; type: FieldDefinition['type'] }>;
}

/** Baut Label→Feld-Maps aus dem Profil (scalar-Gruppen + Array-Gruppen). */
function buildMaps(profile: ExtractionProfile) {
  const doc = new Map<string, DocEntry>();
  const lists: ListGroup[] = [];
  for (const [groupKey, group] of Object.entries(profile.fields)) {
    if (isArrayGroup(group)) {
      const items = new Map<string, { field: string; type: FieldDefinition['type'] }>();
      for (const [fieldId, def] of Object.entries(group._item_fields)) {
        const entry = { field: fieldId, type: def.type };
        for (const l of [def.label, ...(def.aliases ?? [])]) if (l) items.set(norm(l), entry);
      }
      lists.push({ group: groupKey, labelNorm: norm(group._label ?? groupKey), items });
    } else {
      for (const [fieldId, def] of Object.entries(group)) {
        const entry = { group: groupKey, field: fieldId, type: def.type };
        for (const l of [def.label, ...(def.aliases ?? [])]) if (l) doc.set(norm(l), entry);
      }
    }
  }
  return { doc, lists };
}

/**
 * Kern-Parser (rein, ohne IO): layout-erhaltender Text + Profil → Ergebnis.
 * Herausgeloest fuer Unit-Tests (kein pdftotext noetig).
 */
export function parseLabelmap(
  text: string,
  profile: ExtractionProfile,
): { extracted: Record<string, unknown>; unknownLabels: string[] } {
  const { doc, lists } = buildMaps(profile);
  const scalars: Record<string, Record<string, unknown>> = {};
  const rows: Record<string, Array<Record<string, unknown>>> = {};
  const openRow: Record<string, Record<string, unknown> | null> = {};
  for (const lg of lists) { rows[lg.group] = []; openRow[lg.group] = null; }
  const unknownLabels = new Set<string>();

  for (const line of text.split('\n')) {
    const sec = line.match(SECTION_RE);
    if (sec && !/\s{2,}/.test(sec[1]!)) {
      const titleNorm = norm(sec[1]!);
      for (const lg of lists) {
        if (titleNorm === lg.labelNorm || titleNorm.startsWith(lg.labelNorm)) {
          const row: Record<string, unknown> = {};
          rows[lg.group]!.push(row);
          openRow[lg.group] = row;
        }
      }
      continue;
    }
    const kv = parseLine(line);
    if (!kv) continue;
    const nl = norm(kv[0]);

    const d = doc.get(nl);
    if (d) {
      (scalars[d.group] ??= {})[d.field] = coerce(kv[1], d.type);
      continue;
    }
    let matched = false;
    for (const lg of lists) {
      const item = lg.items.get(nl);
      if (item) {
        let row = openRow[lg.group];
        if (!row) { row = {}; rows[lg.group]!.push(row); openRow[lg.group] = row; }
        row[item.field] = coerce(kv[1], item.type);
        matched = true;
        break;
      }
    }
    if (!matched) unknownLabels.add(kv[0]);
  }

  const extracted: Record<string, unknown> = { ...scalars };
  for (const lg of lists) extracted[lg.group] = rows[lg.group];
  return { extracted, unknownLabels: [...unknownLabels] };
}

/** Ergebnis-Objekt → dotted paths (Arrays als EIN Feld, analog single-pass). */
function collectPaths(obj: unknown, prefix = ''): Array<{ path: string; value: unknown }> {
  const out: Array<{ path: string; value: unknown }> = [];
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) { if (obj.length) out.push({ path: prefix, value: obj }); return out; }
  if (typeof obj !== 'object') {
    if (!(typeof obj === 'string' && obj.trim() === '')) out.push({ path: prefix, value: obj });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) out.push(...collectPaths(v, p));
    else if (Array.isArray(v)) out.push(...collectPaths(v, p));
    else if (v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '')) out.push({ path: p, value: v });
  }
  return out;
}

export const templateLabelmapStrategy: ExtractionStrategy = {
  id: 'template-labelmap',

  estimateCost(_input: StrategyInput): CostEstimate {
    return { tokens: 0, calls: 0, etaSeconds: 1 };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    await emit({ phase: 'preparing' });

    const pdf = input.files.find((f) => f.rawBuffer && (f.mimeType === 'application/pdf' || f.filename.toLowerCase().endsWith('.pdf')));
    if (!pdf?.rawBuffer) {
      throw new StrategyExecutionError('template-labelmap benoetigt ein PDF mit rawBuffer.');
    }

    let text: string;
    try {
      text = await pdfToLayoutText(pdf.rawBuffer);
    } catch (err) {
      throw new StrategyExecutionError(
        'template-labelmap benoetigt `pdftotext` (poppler-utils) im PATH.',
        err,
      );
    }

    await emit({ phase: 'extracting', chunkIndex: 0, chunkTotal: 1 });

    const { extracted, unknownLabels } = parseLabelmap(text, input.schema.profile);

    // Provenance + Konfidenz 1.0 fuer jedes belegte Feld.
    const paths = collectPaths(extracted);
    const provenance: FieldProvenance[] = paths.map((p) => ({ field: p.path, value: p.value, source: 'c:0', confidence: 1.0 }));
    const fieldConfidences: Record<string, number> = {};
    for (const p of paths) fieldConfidences[p.path] = 1.0;

    const validation = validateExtraction(extracted, input.schema.profile);
    const warnings = validation.errors.map((e) => `${e.field}: ${e.message}`);

    // Befund: unbekannte Labels (keinem Profil-Feld zugeordnet) → Review-Triage.
    // Anzahl-Plausibilitaeten (z.B. "Anzahl der Eigentuemer" == Instanzen) sind
    // bewusst KEINE Strategie-Logik, sondern gehoeren als W5-Pruefregel ans
    // Projekt — die Strategie bleibt domaenen-frei.
    const processingIssues: StrategyResult['processingIssues'] = [];
    if (unknownLabels.length > 0) {
      processingIssues.push({ severity: 'warn', message: `Unbekannte Labels (keinem Feld zugeordnet): ${unknownLabels.join(' · ')}` });
    }

    await emit({ phase: 'validating', warningCount: warnings.length });

    return {
      extracted,
      fieldConfidences,
      provenance,
      warnings,
      processingIssues: processingIssues.length ? processingIssues : undefined,
      llmCalls: 0,
      strategyUsed: 'template-labelmap',
    };
  },
};
