/**
 * Lieferantenmanagement CSV Export
 */

import type { Supplier, Audit } from './types';
import * as storage from './storage';

export async function exportSuppliersCSV(): Promise<string> {
  const suppliers = await storage.getSuppliers();

  const headers = [
    'ID', 'Firmenname', 'Status', 'Kundennummer', 'PLZ', 'Ort', 'Land',
    'Gesamtrisiko', 'Lifecycle-Phase', 'Anzahl Leistungen', 'DORA-relevant',
    'Erstellt am', 'Aktualisiert am',
  ];

  const rows = suppliers.map((s) => [
    s.id,
    escapeCsv(s.firmenname),
    s.status,
    escapeCsv(s.stammdaten.kundennummer),
    escapeCsv(s.stammdaten.adresse.plz),
    escapeCsv(s.stammdaten.adresse.ort),
    escapeCsv(s.stammdaten.adresse.land),
    s.gesamtrisiko,
    s.lifecycle.phase,
    s.leistungen.filter((l) => l.status === 'active').length.toString(),
    s.leistungen.some((l) => l.risikobewertung?.dora_relevant) ? 'Ja' : 'Nein',
    s.created_at,
    s.updated_at,
  ]);

  const csv = [
    headers.join(';'),
    ...rows.map((r) => r.join(';')),
  ].join('\n');

  return csv;
}

const RISIKO_LABELS: Record<string, string> = {
  very_high: 'Sehr hoch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig',
};

const STATUS_LABELS: Record<string, string> = {
  offen: 'Offen', teilweise: 'Teilweise', erledigt: 'Erledigt',
};

export async function exportAuditPlanCSV(year: number): Promise<string> {
  const plan = await storage.getAuditPlan(year);
  if (!plan) throw new Error(`Kein Auditplan fuer ${year} vorhanden`);

  const suppliers = await storage.getSuppliers();
  const audits = await storage.getAudits();
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const config = await storage.getConfig();
  const scopeLabels: Record<string, string> = {};
  for (const s of config?.pruefungs_scopes || []) {
    scopeLabels[s.id] = s.label;
  }
  const typLabels: Record<string, string> = {};
  for (const t of config?.audit_typen || []) {
    typLabels[t.id] = t.label;
  }
  const teamMap: Record<string, string> = {};
  for (const t of config?.teams || []) {
    teamMap[t.id] = t.name;
  }

  const headers = [
    'Lieferant', 'Leistung', 'BIA-Stufe', 'Erforderliche Pruefungen',
    'Erledigte Pruefungen', 'Status',
  ];

  const rows = plan.eintraege.map((e: any) => {
    const supplier = supplierMap.get(e.supplier_id);
    const leistung = supplier?.leistungen?.find((l: any) => l.id === e.leistung_id);
    const erforderlich: string[] = e.erforderliche_scopes || [];

    const relevantAudits = audits.filter(
      (a) => a.supplier_id === e.supplier_id && a.leistung_id === e.leistung_id && a.status === 'abgeschlossen'
        && a.durchgefuehrt_am && new Date(a.durchgefuehrt_am).getFullYear() === year
    );
    const erledigteScopes = new Set(relevantAudits.map((a) => a.scope).filter(Boolean));
    const abgedeckt = erforderlich.filter((s: string) => erledigteScopes.has(s));

    let status = 'offen';
    if (erforderlich.length > 0) {
      if (abgedeckt.length >= erforderlich.length) status = 'erledigt';
      else if (abgedeckt.length > 0) status = 'teilweise';
    }

    return [
      escapeCsv(supplier?.firmenname || '-'),
      escapeCsv(leistung?.bezeichnung || '-'),
      RISIKO_LABELS[e.bia_level] || e.bia_level || '-',
      escapeCsv(erforderlich.map((s: string) => scopeLabels[s] || s).join(', ')),
      escapeCsv(abgedeckt.map((s: string) => scopeLabels[s] || s).join(', ') || '-'),
      STATUS_LABELS[status] || status,
    ];
  });

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

function escapeCsv(value: string): string {
  if (!value) return '';
  // Prevent formula injection in Excel/Sheets
  let safe = value;
  if (/^[=@+\-\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(';') || safe.includes('"') || safe.includes('\n') || safe !== value) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
