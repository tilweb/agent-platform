/**
 * XLSX-Aufbereitung eines Batch-Laufs — zwei Formen, ein Baustein.
 *
 * `grouped` (Default, bisheriges Verhalten): ein Hauptblatt je Dokument plus je
 * Listen-Feld ein Zusatzblatt mit einer Zeile je Position.
 *
 * `flat`: EIN Blatt, eine Zeile je Position, Kopfdaten wiederholt. Genau das
 * Format, das nachgelagerte Systeme (RPA, ERP-Import) erwarten — sie lesen
 * zeilenweise und wollen zu jeder Position die Belegdaten daneben stehen haben,
 * statt zwei Blätter über eine Dateispalte zusammenführen zu müssen.
 *
 * Von der REST-Route und von der Public-API-Function genutzt; identisch in
 * beiden Worktrees.
 */

import type { BatchFileSummary } from './batch-runs';
import type { ExtractionProject, ProjectField, SegmentInstance, SegmentTypeDef } from './types';

export type ExportFormat = 'grouped' | 'flat';

export interface DocumentSection {
  title: string;
  type: 'table';
  content: { headers: string[]; rows: string[][] };
  sheet?: string;
}

const REVIEW_LABEL: Record<string, string> = {
  auto_ok: 'ok',
  needs_review: 'zu pruefen',
  reviewed: 'geprueft',
};

/** Stringifiziert einen extrahierten Wert für eine Zelle. */
export function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Excel-Blattnamen: max. 31 Zeichen, verbotene Zeichen ersetzen. */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[\[\]:*?/\\]/g, '-').substring(0, 31).trim() || 'Liste';
}

function scalarFields(project: ExtractionProject): Array<[string, ProjectField]> {
  return Object.entries(project.fields).filter(([, f]) => f.type !== 'list');
}

function listFields(project: ExtractionProject): Array<[string, ProjectField]> {
  return Object.entries(project.fields).filter(([, f]) => f.type === 'list');
}

/**
 * Flaches Blatt: je Position eine Zeile, Belegdaten wiederholt. Dokumente ohne
 * Positionen bekommen trotzdem eine Zeile (sonst verschwinden Fehlschläge und
 * positionslose Belege stillschweigend aus dem Export).
 */
function buildFlatSection(project: ExtractionProject, files: BatchFileSummary[]): DocumentSection {
  const scalars = scalarFields(project);
  const lists = listFields(project);
  // Bewusst nur die ERSTE Positionsliste: ein flaches Blatt kann nicht zwei
  // unabhängige Listen kreuzen, ohne Zeilen zu multiplizieren.
  const [listId, listField] = lists[0] ?? [];
  const itemEntries = Object.entries(listField?.item_fields ?? {});

  const headers = [
    'Datei',
    'Status',
    'Pruefung',
    'Befunde',
    ...scalars.map(([fid, f]) => f.label || fid),
    ...itemEntries.map(([iid, itf]) => itf.label || iid),
  ];

  const rows: string[][] = [];
  for (const file of files) {
    const befunde = (file.validations ?? []).filter((v) => v.severity !== 'info');
    const kopf = [
      file.filename,
      file.status,
      file.reviewStatus ? (REVIEW_LABEL[file.reviewStatus] ?? file.reviewStatus) : '',
      befunde.length > 0 ? befunde.map((v) => v.message).join(' | ') : (file.error ?? ''),
      ...scalars.map(([fid]) => cellString(file.data?.[fid])),
    ];

    const items = listId ? file.data?.[listId] : null;
    if (!Array.isArray(items) || items.length === 0) {
      rows.push([...kopf, ...itemEntries.map(() => '')]);
      continue;
    }
    for (const item of items) {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      rows.push([...kopf, ...itemEntries.map(([iid]) => cellString(row[iid]))]);
    }
  }

  return { title: 'Positionen', type: 'table', content: { headers, rows } };
}

/** Bisheriges Format: Hauptblatt + je Listen-Feld ein Zusatzblatt. */
function buildGroupedSections(project: ExtractionProject, files: BatchFileSummary[]): DocumentSection[] {
  const fieldEntries = Object.entries(project.fields);
  const headers = ['Datei', 'Status', ...fieldEntries.map(([, f]) => f.label || '')];
  const rows = files.map((file) => [
    file.filename,
    file.status,
    ...fieldEntries.map(([fid, f]) => {
      const v = file.data?.[fid];
      if (f.type === 'list') {
        return Array.isArray(v) && v.length > 0 ? `${v.length} Positionen` : '';
      }
      return cellString(v);
    }),
  ]);

  const sections: DocumentSection[] = [
    { title: 'Ergebnisse', type: 'table', content: { headers, rows } },
  ];

  for (const [fid, f] of fieldEntries) {
    if (f.type !== 'list') continue;
    const itemEntries = Object.entries(f.item_fields ?? {});
    const itemHeaders = ['Datei', ...itemEntries.map(([, itf]) => itf.label || '')];
    const itemRows = files.flatMap((file) => {
      const items = file.data?.[fid];
      if (!Array.isArray(items)) return [];
      return items.map((item) => [
        file.filename,
        ...itemEntries.map(([iid]) =>
          cellString(item && typeof item === 'object' ? (item as Record<string, unknown>)[iid] : null),
        ),
      ]);
    });
    sections.push({
      title: f.label || fid,
      type: 'table',
      content: { headers: itemHeaders, rows: itemRows },
      sheet: sanitizeSheetName(f.label || fid),
    });
  }

  return sections;
}

// ============== Segment-Profile (Welle 10.4) ==============

/** Wert einer Segment-Instanz aus der aggregierten data-Struktur. */
function segmentValues(
  file: BatchFileSummary,
  seg: SegmentInstance,
  def: SegmentTypeDef | undefined,
): Record<string, unknown> {
  const raw = file.data?.[seg.type];
  const v = def?.repeatable && Array.isArray(raw) ? raw[seg.instance - 1] : raw;
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Union der Skalarfelder ueber alle Segmenttypen (Reihenfolge: Deklaration). */
function segmentFieldUnion(defs: Record<string, SegmentTypeDef>): Array<[string, ProjectField, string]> {
  const out: Array<[string, ProjectField, string]> = [];
  const seen = new Set<string>();
  for (const def of Object.values(defs)) {
    for (const [fid, f] of Object.entries(def.fields ?? {})) {
      if (f.type === 'list' || seen.has(fid)) continue;
      seen.add(fid);
      out.push([fid, f, f.label || fid]);
    }
  }
  return out;
}

/**
 * Segment-Blatt: EINE Zeile je Segment-Instanz (auch classify-only und
 * `unbekannt` — sonst verschwinden sie still aus dem Export), Belegdaten
 * wiederholt. Feld-Spalten sind die Union ueber alle Segmenttypen; Zellen
 * fremder Typen bleiben leer.
 */
function buildSegmentSection(project: ExtractionProject, files: BatchFileSummary[]): DocumentSection {
  const defs = project.segments ?? {};
  const fieldUnion = segmentFieldUnion(defs);
  const headers = [
    'Datei', 'Status', 'Pruefung', 'Befunde',
    'Segment', 'Instanz', 'Seiten', 'Konfidenz', 'Beleg',
    ...fieldUnion.map(([, , label]) => label),
  ];
  const rows: string[][] = [];
  for (const file of files) {
    const befunde = (file.validations ?? []).filter((v) => v.severity !== 'info');
    const kopf = [
      file.filename,
      file.status,
      file.reviewStatus ? (REVIEW_LABEL[file.reviewStatus] ?? file.reviewStatus) : '',
      befunde.length > 0 ? befunde.map((v) => v.message).join(' | ') : (file.error ?? ''),
    ];
    const segs = file.segments ?? [];
    if (segs.length === 0) {
      rows.push([...kopf, '', '', '', '', '', ...fieldUnion.map(() => '')]);
      continue;
    }
    for (const seg of segs) {
      const def = defs[seg.type];
      const values = segmentValues(file, seg, def);
      const label = def?.label ?? (seg.type === 'leerseite' ? 'Leer-/Trennseite' : seg.type === 'unbekannt' ? 'Nicht zugeordnet' : seg.type);
      rows.push([
        ...kopf,
        label,
        String(seg.instance),
        seg.pageFrom === seg.pageTo ? String(seg.pageFrom) : `${seg.pageFrom}-${seg.pageTo}`,
        `${Math.round(seg.confidence * 100)}%`,
        cellString(seg.summary ?? (values as Record<string, unknown>)._beleg ?? ''),
        ...fieldUnion.map(([fid]) => cellString(values[fid])),
      ]);
    }
  }
  return { title: 'Segmente', type: 'table', content: { headers, rows } };
}

/** Segment-Profil, gruppiert: Hauptblatt je Datei + Zusatzblatt je Instanz. */
function buildSegmentGroupedSections(project: ExtractionProject, files: BatchFileSummary[]): DocumentSection[] {
  const defs = project.segments ?? {};
  const headers = ['Datei', 'Status', 'Segmente'];
  const rows = files.map((file) => [
    file.filename,
    file.status,
    (file.segments ?? [])
      .map((s) => `${defs[s.type]?.label ?? s.type} (S.${s.pageFrom}${s.pageTo !== s.pageFrom ? `-${s.pageTo}` : ''})`)
      .join(' | '),
  ]);
  const segmentSheet = buildSegmentSection(project, files);
  segmentSheet.sheet = sanitizeSheetName('Segmente');
  return [
    { title: 'Ergebnisse', type: 'table', content: { headers, rows } },
    segmentSheet,
  ];
}

export function buildBatchExportSections(
  project: ExtractionProject,
  files: BatchFileSummary[],
  format: ExportFormat,
): DocumentSection[] {
  // Segment-Profile (Welle 10): eigene Aufbereitung — die Feld-Spalten liegen
  // in den Segmenttypen, nicht in project.fields.
  if (project.segments && Object.keys(project.segments).length > 0) {
    return format === 'flat'
      ? [buildSegmentSection(project, files)]
      : buildSegmentGroupedSections(project, files);
  }
  return format === 'flat' ? [buildFlatSection(project, files)] : buildGroupedSections(project, files);
}

/** Zeilenzahl des Exports (für Meldungen/API-Antwort). */
export function countExportRows(sections: DocumentSection[]): number {
  return sections.reduce((sum, s) => sum + s.content.rows.length, 0);
}
