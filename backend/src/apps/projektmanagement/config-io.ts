/**
 * Projektmanagement Config Import/Export
 *
 * Reine Transformations-Logik (keine Persistenz) fuer den Datei-Transport der
 * Auswahllisten zwischen Kunden-Instanzen: Excel/CSV Export, leeres Template,
 * Parsing, Diff (fuer die Import-Vorschau) und das kontrollierte Anwenden.
 *
 * Persistenz laeuft ueber getConfig()/saveConfig() in storage.ts — diese Datei
 * ist daher in beiden Worktrees (DB + YAML) identisch.
 *
 * Die Listen-Metadaten spiegeln FIELD_LABELS/FIELD_USAGE/FIELD_ORDER/
 * LOCKED_KEY_FIELDS aus dem Frontend (Einstellungen.jsx) + abschluss_checkliste.
 * Bei Aenderungen an den Listen dort mitpflegen.
 */

import ExcelJS from 'exceljs';

export interface ConfigListMeta {
  /** Technischer Key = zugleich Excel-Blattname und CSV-`liste`-Wert. */
  key: string;
  /** Deutscher Anzeigename (Excel-Titelzeile). */
  label: string;
  /** Wo die Liste eingesetzt wird (Excel-Titelzeile, Hilfe fuer Konfiguratoren). */
  usage: string;
  /** Feldname des stabilen Schluessels im Config-Item. */
  keyField: 'value' | 'id';
  /**
   * Werte sind im Code verdrahtet (Badges/Filter) — beim Import werden nur
   * Anzeigenamen existierender Schluessel uebernommen, Schluessel nie geaendert.
   */
  locked: boolean;
}

export const CONFIG_LISTS: ConfigListMeta[] = [
  { key: 'project_type', label: 'Projekttyp', usage: 'Projekt-Wizard (Basisinfo), Projektidee (Basis), Portfolio', keyField: 'value', locked: false },
  { key: 'project_size', label: 'Projektgröße', usage: 'Projekt-Wizard (Basisinfo), Projektidee (Basis)', keyField: 'value', locked: false },
  { key: 'priority', label: 'Priorität', usage: 'Projekt-Wizard (Basisinfo), Projektidee (Basis)', keyField: 'value', locked: false },
  { key: 'project_driver', label: 'Projekttreiber', usage: 'Projekt-Wizard (Basisinfo), Projektidee (Basis)', keyField: 'value', locked: false },
  { key: 'project_status', label: 'Projektstatus', usage: 'Projekt-Wizard (Basisinfo), Projektidee (Basis), Abschlussbericht, Portfolio', keyField: 'value', locked: false },
  { key: 'order_status', label: 'Projektauftragsstatus', usage: 'Projekt-Wizard (Basisinfo)', keyField: 'value', locked: false },
  { key: 'idee_status', label: 'Projektidee-Status', usage: 'Projektidee (Basis)', keyField: 'value', locked: true },
  { key: 'role', label: 'Rolle', usage: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix', keyField: 'value', locked: false },
  { key: 'member_status', label: 'Status (intern/extern)', usage: 'Projekt-Wizard (Organisation/Stakeholder)', keyField: 'value', locked: false },
  { key: 'gruppe', label: 'Gruppe', usage: 'Projekt-Wizard (Personen), Projektidee (Personen)', keyField: 'value', locked: false },
  { key: 'interest', label: 'Interesse', usage: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix', keyField: 'value', locked: false },
  { key: 'influence', label: 'Einfluss', usage: 'Projekt-Wizard (Organisation/Stakeholder), Stakeholder-Matrix', keyField: 'value', locked: false },
  { key: 'stakeholder_quadrants', label: 'Klassifizierungs-Matrix (Quadranten)', usage: 'Stakeholder-Matrix (Idee/Auftrag/Portfolio)', keyField: 'value', locked: true },
  { key: 'probability', label: 'Wahrscheinlichkeit', usage: 'Projekt-Wizard (Risiken), Statusberichte, Abschlussbericht', keyField: 'value', locked: false },
  { key: 'impact', label: 'Auswirkung', usage: 'Projekt-Wizard (Risiken), Statusberichte, Abschlussbericht', keyField: 'value', locked: false },
  { key: 'roadmap_status', label: 'Roadmap-Status', usage: 'Statusberichte (Roadmap)', keyField: 'value', locked: false },
  { key: 'risk_strategie', label: 'Risiko-Strategie', usage: 'Statusberichte (Risiken)', keyField: 'value', locked: false },
  { key: 'risk_status', label: 'Risiko-Status', usage: 'Statusberichte (Risiken), Abschlussbericht', keyField: 'value', locked: false },
  { key: 'lesson_themengebiet', label: 'Themengebiet', usage: 'Lessons Learned', keyField: 'value', locked: false },
  { key: 'lesson_kategorie', label: 'Kategorie', usage: 'Lessons Learned', keyField: 'value', locked: false },
  { key: 'portfolio_type', label: 'Portfoliotyp', usage: 'Portfolio (Basis)', keyField: 'value', locked: false },
  { key: 'portfolio_driver', label: 'Portfoliotreiber', usage: 'Portfolio (Basis)', keyField: 'value', locked: false },
  { key: 'portfolio_status', label: 'Portfoliostatus', usage: 'Portfolio (Basis), Portfolio-Liste', keyField: 'value', locked: true },
  { key: 'abschluss_checkliste', label: 'Abschluss-Checkliste', usage: 'Abschlussbericht', keyField: 'id', locked: false },
];

const LIST_BY_KEY: Record<string, ConfigListMeta> = Object.fromEntries(
  CONFIG_LISTS.map((m) => [m.key, m]),
);

export type ConfigItem = { value?: string; id?: string; label: string };
export type Config = Record<string, ConfigItem[]>;

export interface ParsedConfig {
  /** Nur bekannte Listen; pro Liste bereinigte, deduplizierte Items. */
  lists: Config;
  /** Format-Warnungen (leere Anzeigenamen, doppelte Schluessel, unbekannte Listen). */
  warnings: string[];
}

export interface ListDiff {
  added: string[];
  changed: { key: string; from: string; to: string }[];
  removed: string[];
}

const HEADER_KEY = 'Schlüssel';
const HEADER_LABEL = 'Anzeigename';

function keyOf(meta: ConfigListMeta, item: ConfigItem): string {
  return String(item[meta.keyField] ?? '');
}

function buildItem(meta: ConfigListMeta, key: string, label: string): ConfigItem {
  return meta.keyField === 'id' ? { id: key, label } : { value: key, label };
}

/** Baut aus rohen (key,label)-Zeilen eine bereinigte Item-Liste + Warnungen. */
function itemsFromRows(
  meta: ConfigListMeta,
  rows: { key: string; label: string }[],
  warnings: string[],
): ConfigItem[] {
  const items: ConfigItem[] = [];
  const seen = new Set<string>();
  for (const { key, label } of rows) {
    const k = key.trim();
    const l = label.trim();
    if (!k && !l) continue; // Leerzeile
    if (!k) {
      warnings.push(`${meta.label}: Zeile ohne Schlüssel übersprungen ("${l}").`);
      continue;
    }
    if (!l) {
      warnings.push(`${meta.label}: Schlüssel "${k}" ohne Anzeigename übersprungen.`);
      continue;
    }
    if (seen.has(k)) {
      warnings.push(`${meta.label}: doppelter Schlüssel "${k}" ignoriert.`);
      continue;
    }
    seen.add(k);
    items.push(buildItem(meta, k, l));
  }
  return items;
}

// ============== Excel Export ==============

export async function exportToExcel(config: Config): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addInfoSheet(wb);
  for (const meta of CONFIG_LISTS) {
    addListSheet(wb, meta, config[meta.key] || []);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/**
 * Leeres Template: editierbare Listen nur mit Kopfzeile, gesperrte Listen
 * (idee_status) mit ihren fixen Schluesseln vorbefuellt (nur Label änderbar).
 */
export async function buildTemplateExcel(current: Config): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addInfoSheet(wb);
  for (const meta of CONFIG_LISTS) {
    const items = meta.locked ? current[meta.key] || [] : [];
    addListSheet(wb, meta, items);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

function addInfoSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Anleitung');
  ws.getColumn(1).width = 100;
  const lines = [
    'Projektmanagement — Auswahllisten (Import/Export)',
    '',
    'Jedes weitere Tabellenblatt entspricht einer Auswahlliste (Blattname = technischer Schlüssel).',
    'Spalte A "Schlüssel": stabiler technischer Wert — nicht übersetzen, klein/englisch belassen.',
    'Spalte B "Anzeigename": frei editierbarer Text, der in der Oberfläche erscheint.',
    '',
    'Beim Import:',
    '• Nur bekannte Blätter werden gelesen; dieses Info-Blatt und unbekannte Blätter werden ignoriert.',
    '• Zeilen ohne Schlüssel oder ohne Anzeigename werden übersprungen.',
    '• "Projektidee-Status" (idee_status) ist fixiert: nur Anzeigenamen werden übernommen, Schlüssel nicht.',
    '• Vor dem Speichern wird eine Vorschau angezeigt; du wählst pro Liste, ob sie ersetzt wird.',
  ];
  lines.forEach((text, i) => {
    const row = ws.addRow([text]);
    if (i === 0) row.font = { bold: true, size: 13 };
  });
}

function addListSheet(wb: ExcelJS.Workbook, meta: ConfigListMeta, items: ConfigItem[]): void {
  const ws = wb.addWorksheet(meta.key);
  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 48;

  const titleSuffix = meta.locked ? ' — Schlüssel fixiert, nur Anzeigename änderbar' : '';
  const title = ws.addRow([`${meta.label} · Verwendet in: ${meta.usage}${titleSuffix}`]);
  title.font = { italic: true, color: { argb: 'FF888888' } };

  const header = ws.addRow([HEADER_KEY, HEADER_LABEL]);
  header.font = { bold: true };

  for (const it of items) {
    ws.addRow([keyOf(meta, it), it.label ?? '']);
  }
}

// ============== Excel Parse ==============

export async function parseExcel(buffer: Buffer): Promise<ParsedConfig> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const lists: Config = {};
  const warnings: string[] = [];

  wb.eachSheet((ws) => {
    const meta = LIST_BY_KEY[ws.name];
    if (!meta) return; // Info-Blatt / unbekannt
    const rows: { key: string; label: string }[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Titel- + Kopfzeile
      const key = cellText(row.getCell(1));
      const label = cellText(row.getCell(2));
      // Falls jemand die Kopfzeile verschoben hat, die Header-Zeile ignorieren.
      if (key === HEADER_KEY && label === HEADER_LABEL) return;
      rows.push({ key, label });
    });
    lists[meta.key] = itemsFromRows(meta, rows, warnings);
  });

  if (Object.keys(lists).length === 0) {
    warnings.push('Keine bekannten Auswahllisten in der Datei gefunden.');
  }
  return { lists, warnings };
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    // RichText / Hyperlink / Formel-Ergebnis → Anzeigetext nutzen
    return String(cell.text ?? '').trim();
  }
  return String(v).trim();
}

// ============== CSV Export ==============

export function exportToCsv(config: Config): string {
  const lines = [['liste', 'schluessel', 'anzeige'].join(',')];
  for (const meta of CONFIG_LISTS) {
    for (const it of config[meta.key] || []) {
      lines.push([meta.key, keyOf(meta, it), it.label ?? ''].map(csvEscape).join(','));
    }
  }
  // BOM, damit Excel UTF-8 (Umlaute) korrekt erkennt.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function buildTemplateCsv(current: Config): string {
  const lines = [['liste', 'schluessel', 'anzeige'].join(',')];
  for (const meta of CONFIG_LISTS) {
    if (!meta.locked) continue; // editierbare Listen leer lassen
    for (const it of current[meta.key] || []) {
      lines.push([meta.key, keyOf(meta, it), it.label ?? ''].map(csvEscape).join(','));
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function csvEscape(value: string): string {
  const v = String(value ?? '');
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

// ============== CSV Parse ==============

export function parseCsv(text: string): ParsedConfig {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  const warnings: string[] = [];
  const lists: Config = {};
  const headerRow = rows[0];
  if (!headerRow) {
    return { lists, warnings: ['Die CSV-Datei ist leer.'] };
  }

  // Header-Spalten flexibel zuordnen; Fallback = feste Reihenfolge.
  const header = headerRow.map((h) => h.trim().toLowerCase());
  let iList = header.indexOf('liste');
  let iKey = header.indexOf('schluessel');
  if (iKey === -1) iKey = header.indexOf('schlüssel');
  let iLabel = header.indexOf('anzeige');
  if (iLabel === -1) iLabel = header.indexOf('anzeigename');
  let dataStart = 1;
  if (iList === -1 || iKey === -1 || iLabel === -1) {
    // Kein erkennbarer Header → Spalten 0,1,2 annehmen, Zeile 0 ist bereits Daten.
    iList = 0; iKey = 1; iLabel = 2;
    dataStart = 0;
  }

  const grouped: Record<string, { key: string; label: string }[]> = {};
  for (let r = dataStart; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols) continue;
    const listKey = (cols[iList] || '').trim();
    if (!listKey) continue;
    const meta = LIST_BY_KEY[listKey];
    if (!meta) {
      warnings.push(`Unbekannte Liste "${listKey}" ignoriert.`);
      continue;
    }
    (grouped[listKey] ||= []).push({ key: cols[iKey] || '', label: cols[iLabel] || '' });
  }

  for (const [listKey, rawRows] of Object.entries(grouped)) {
    const meta = LIST_BY_KEY[listKey];
    if (!meta) continue;
    lists[listKey] = itemsFromRows(meta, rawRows, warnings);
  }
  if (Object.keys(lists).length === 0 && warnings.length === 0) {
    warnings.push('Keine bekannten Auswahllisten in der Datei gefunden.');
  }
  return { lists, warnings };
}

/** Minimaler, korrekter CSV-Parser (RFC-4180-Quoting, \r\n / \n Zeilenenden). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { pushRow(); i++; continue; }
    field += ch; i++;
  }
  // letztes Feld/letzte Zeile
  if (field.length > 0 || row.length > 0) pushRow();
  // vollstaendig leere Zeilen entfernen
  return rows.filter((r) => !(r.length === 1 && (r[0] ?? '').trim() === ''));
}

// ============== Diff & Apply ==============

/**
 * Diff pro Liste (nur fuer Listen, die in `incoming` vorkommen). Vergleicht
 * Ersetzungs-Semantik: added = neu, removed = faellt weg, changed = Label anders.
 */
export function diffConfig(current: Config, incoming: Config): Record<string, ListDiff> {
  const out: Record<string, ListDiff> = {};
  for (const key of Object.keys(incoming)) {
    const meta = LIST_BY_KEY[key];
    if (!meta) continue;
    const cur = current[key] || [];
    const inc = incoming[key] || [];
    const curMap = new Map(cur.map((it) => [keyOf(meta, it), it.label]));
    const incMap = new Map(inc.map((it) => [keyOf(meta, it), it.label]));
    const diff: ListDiff = { added: [], changed: [], removed: [] };
    for (const [k, label] of incMap) {
      if (!curMap.has(k)) diff.added.push(k);
      else if (curMap.get(k) !== label) diff.changed.push({ key: k, from: curMap.get(k) ?? '', to: label ?? '' });
    }
    for (const k of curMap.keys()) {
      if (!incMap.has(k)) diff.removed.push(k);
    }
    out[key] = diff;
  }
  return out;
}

/**
 * Warnungen zu gesperrten Listen (idee_status): Schluessel-Aenderungen werden
 * beim Anwenden ignoriert — hier fuer die Vorschau sichtbar gemacht.
 */
export function lockedWarnings(current: Config, incoming: Config): string[] {
  const warnings: string[] = [];
  for (const meta of CONFIG_LISTS) {
    if (!meta.locked || !incoming[meta.key]) continue;
    const curKeys = new Set((current[meta.key] || []).map((it) => keyOf(meta, it)));
    const incKeys = new Set((incoming[meta.key] || []).map((it) => keyOf(meta, it)));
    const extra = [...incKeys].filter((k) => !curKeys.has(k));
    const missing = [...curKeys].filter((k) => !incKeys.has(k));
    if (extra.length || missing.length) {
      warnings.push(
        `${meta.label}: Schlüssel sind fixiert — nur Anzeigenamen werden übernommen ` +
        `(neue/entfernte Schlüssel ignoriert).`,
      );
    }
  }
  return warnings;
}

/**
 * Wendet die ausgewaehlten Listen auf die aktuelle Config an.
 * - editierbare Liste: komplett durch `incoming` ersetzt.
 * - gesperrte Liste (locked): nur Anzeigenamen existierender Schluessel werden
 *   uebernommen; Schluessel bleiben unveraendert (nichts hinzufuegen/entfernen).
 * - nicht ausgewaehlte Listen: unveraendert.
 */
export function applyImport(
  current: Config,
  incoming: Config,
  selectedKeys: string[],
): Config {
  const selected = new Set(selectedKeys);
  const result: Config = { ...current };
  for (const meta of CONFIG_LISTS) {
    const inc = incoming[meta.key];
    if (!selected.has(meta.key) || !inc) continue;
    if (meta.locked) {
      const incMap = new Map(inc.map((it) => [keyOf(meta, it), it.label]));
      result[meta.key] = (current[meta.key] || []).map((it) => {
        const k = keyOf(meta, it);
        return incMap.has(k) ? { ...it, label: incMap.get(k) as string } : it;
      });
    } else {
      result[meta.key] = inc;
    }
  }
  return result;
}
