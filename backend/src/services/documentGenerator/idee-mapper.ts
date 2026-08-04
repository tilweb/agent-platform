/**
 * Projektidee → DocumentData Mapper
 * Strukturiert eine Projektidee fuer den Dokument-Export (PDF / DOCX / Markdown).
 * Section-Reihenfolge folgt den 5 Eingabe-Tabs aus dem Wizard.
 */

import type { DocumentData, DocumentSection } from './types';
import type { Projektidee } from '../../apps/projektmanagement/types';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  internal: 'Internes Projekt',
  external: 'Externes Projekt',
  research: 'Forschungsprojekt',
  infrastructure: 'Infrastrukturprojekt',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  review: 'In Pruefung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

const SIZE_LABELS: Record<string, string> = {
  klein: 'Klein',
  mittel: 'Mittel',
  gross: 'Gross',
  sehr_gross: 'Sehr gross',
};

const PRIO_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

const LEVEL_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

const RISK_TYPE_LABELS: Record<string, string> = {
  strategisch: 'Strategisch',
  operativ: 'Operativ',
  finanziell: 'Finanziell',
  rechtlich: 'Rechtlich',
  technisch: 'Technisch',
  markt: 'Markt',
  chance: 'Chance',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Löst einen Wert über die App-Config-Liste zu ihrem Label auf; Fallback auf die
// statische Label-Map, dann auf den Rohwert. '-' wenn leer.
function configLabel(
  config: Record<string, any> | undefined,
  key: string,
  value: string | undefined | null,
  fallback: Record<string, string> = {},
): string {
  if (value == null || value === '') return '-';
  const found = config?.[key]?.find?.((o: any) => o.value === value);
  return found?.label ?? fallback[value] ?? value;
}

function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '-';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmt(v: string | undefined | null): string {
  if (v == null || v === '') return '-';
  return v;
}

export function mapProjektideeToDocument(idee: Projektidee, config?: Record<string, any>): DocumentData {
  const sections: DocumentSection[] = [];

  // ============== Tab 1: Basis ==============
  sections.push({
    title: 'Basis',
    type: 'keyvalue',
    content: {
      items: [
        { key: 'Projektname', value: fmt(idee.name) },
        { key: 'Projekt-ID', value: fmt(idee.projekt_id) },
        { key: 'Projekttyp', value: configLabel(config, 'project_type', idee.project_type, PROJECT_TYPE_LABELS) },
        { key: 'Projektidee Status', value: configLabel(config, 'idee_status', idee.status, STATUS_LABELS) },
        { key: 'Projektstatus', value: configLabel(config, 'project_status', idee.project_status) },
        { key: 'Projekttreiber', value: configLabel(config, 'project_driver', idee.projekttreiber) },
        { key: 'Projektgroesse', value: configLabel(config, 'project_size', idee.projektgroesse, SIZE_LABELS) },
        { key: 'Prioritaet', value: configLabel(config, 'priority', idee.prioritaet, PRIO_LABELS) },
        { key: 'Startdatum', value: formatDate(idee.start_date) },
        { key: 'Enddatum', value: formatDate(idee.end_date) },
        { key: 'Projektleiter', value: fmt(idee.projektleiter) },
        { key: 'Auftraggeber', value: fmt(idee.auftraggeber) },
      ],
    },
  });

  // ============== Tab 2: Personen ==============
  const team = idee.organization ?? [];
  const stakeholders = idee.stakeholders ?? [];
  if (team.length > 0) {
    sections.push({
      title: 'Projektteam',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'Geplanter Einsatz'],
        rows: team.map((m) => [
          m.name || '-',
          m.role || '-',
          m.geplanter_einsatz?.wert
            ? `${m.geplanter_einsatz.wert} ${m.geplanter_einsatz.einheit ?? ''}`.trim()
            : '-',
        ]),
      },
    });
  }
  if (stakeholders.length > 0) {
    sections.push({
      title: 'Stakeholder',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'Interesse', 'Einfluss'],
        rows: stakeholders.map((s) => [
          s.name || '-',
          s.role || '-',
          configLabel(config, 'interest', s.interest, LEVEL_LABELS),
          configLabel(config, 'influence', s.influence, LEVEL_LABELS),
        ]),
      },
    });
  }

  if (idee.description) {
    sections.push({
      title: 'Kurzbeschreibung',
      type: 'text',
      content: idee.description,
    });
  }

  // ============== Tab 2: Ziele ==============
  sections.push({
    title: 'Ziele',
    type: 'text',
    content: idee.goals || '',
  });

  // ============== Tab 3: Projektkontext ==============
  const ctx = idee.context ?? { ausgangslage: '', rahmenbedingungen: '' };
  if (ctx.ausgangslage || ctx.rahmenbedingungen) {
    sections.push({
      title: 'Ausgangslage',
      type: 'text',
      content: ctx.ausgangslage || '',
    });
    sections.push({
      title: 'Rahmenbedingungen',
      type: 'text',
      content: ctx.rahmenbedingungen || '',
    });
  }

  if (idee.in_scope && idee.in_scope.length > 0) {
    sections.push({
      title: 'Im Projektumfang (In-Scope)',
      type: 'list',
      content: { items: idee.in_scope },
    });
  }
  if (idee.out_scope && idee.out_scope.length > 0) {
    sections.push({
      title: 'Ausserhalb des Projekts (Out-of-Scope)',
      type: 'list',
      content: { items: idee.out_scope },
    });
  }

  // ============== Tab 4: Business Case ==============
  const bc = idee.business_case ?? { investitionen: [], nutzen: [] };
  const sumInvest = bc.investitionen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  const sumNutzen = bc.nutzen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  const saldo = sumNutzen - sumInvest;

  if (bc.investitionen.length > 0) {
    sections.push({
      title: 'Business Case — Investitionen',
      type: 'table',
      content: {
        headers: ['Beschreibung', 'Betrag'],
        rows: bc.investitionen.map((it) => [
          it.beschreibung || '-',
          formatCurrency(it.betrag),
        ]),
      },
    });
  }

  if (bc.nutzen.length > 0) {
    sections.push({
      title: 'Business Case — Nutzen',
      type: 'table',
      content: {
        headers: ['Beschreibung', 'Betrag'],
        rows: bc.nutzen.map((it) => [
          it.beschreibung || '-',
          formatCurrency(it.betrag),
        ]),
      },
    });
  }

  if (bc.investitionen.length > 0 || bc.nutzen.length > 0) {
    let roiLabel: string;
    if (sumInvest === 0 && sumNutzen === 0) {
      roiLabel = '— noch keine Werte erfasst —';
    } else if (saldo > 0) {
      roiLabel = `${formatCurrency(saldo)} (ROI erreicht)`;
    } else if (saldo === 0) {
      roiLabel = `${formatCurrency(saldo)} (Break-even)`;
    } else {
      roiLabel = `${formatCurrency(saldo)} (ROI nicht erreicht)`;
    }

    sections.push({
      title: 'Business Case — Saldo / ROI',
      type: 'keyvalue',
      content: {
        items: [
          { key: 'Summe Investitionen', value: formatCurrency(sumInvest) },
          { key: 'Summe Nutzen', value: formatCurrency(sumNutzen) },
          { key: 'Saldo (Nutzen − Investitionen)', value: roiLabel },
        ],
      },
    });
  }

  // ============== Tab 5: Unternehmensrisiken ==============
  const risiken = idee.unternehmensrisiken ?? [];
  if (risiken.length > 0) {
    sections.push({
      title: 'Unternehmensrisiken',
      type: 'table',
      content: {
        headers: ['Typ', 'Beschreibung', 'Wahrsch.', 'Auswirkung', 'Gegenmassnahme'],
        rows: risiken.map((r) => [
          RISK_TYPE_LABELS[r.type ?? ''] ?? r.type ?? '-',
          r.description || '-',
          LEVEL_LABELS[r.probability ?? ''] ?? '-',
          LEVEL_LABELS[r.impact ?? ''] ?? '-',
          r.mitigation || '-',
        ]),
      },
    });
  }

  // ============== Abgeleitete Auftraege ==============
  const auftraege = idee.abgeleitete_auftraege ?? [];
  if (auftraege.length > 0) {
    sections.push({
      title: 'Abgeleitete Projektauftraege',
      type: 'table',
      content: {
        headers: ['Name', 'Status', 'Erstellt am'],
        rows: auftraege.map((a) => [a.name || '-', a.status || '-', formatDate(a.created_at)]),
      },
    });
  }

  return {
    title: idee.name || 'Projektidee',
    metadata: {
      'Projektidee Status': STATUS_LABELS[idee.status] ?? idee.status,
      'Erstellt am': formatDate(idee.created_at),
      'Zuletzt geaendert': formatDate(idee.updated_at),
    },
    sections,
  };
}
