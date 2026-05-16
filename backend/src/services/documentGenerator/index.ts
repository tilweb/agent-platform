/**
 * Document Generator Service
 * Factory and interfaces for generating documents in various formats
 */

import { generateExcel } from './excelGenerator';
import { generatePdf } from './pdfGenerator';
import { generateWord } from './wordGenerator';
import { generateMarkdown } from './markdownGenerator';

export { mapProjektideeToDocument } from './idee-mapper';

// Re-export types
export type {
  DocumentData,
  DocumentSection,
  TableContent,
  KeyValueContent,
  ListContent,
  DocumentFormat,
  RichCell,
  CellValue,
} from './types';

// Import types for use in this file
import type { DocumentData, DocumentSection, DocumentFormat, RichCell } from './types';

// Re-export chat exporter
export {
  mapChatToDocument,
  extractTablesFromMarkdown,
  extractListsFromMarkdown,
  extractCodeBlocks,
  createSafeFilename,
  type ChatExportOptions,
} from './chatExporter';

// ============== Projektauftrag Mapping ==============

/**
 * Maps a Projektauftrag to DocumentData structure
 */
export function mapProjektauftragToDocument(projektauftrag: any): DocumentData {
  const sections: DocumentSection[] = [];

  // Section: Project Information
  const projectInfo: { key: string; value: string }[] = [
    { key: 'Projektleiter', value: projektauftrag.projektleiter || '-' },
    { key: 'Auftraggeber', value: projektauftrag.auftraggeber || '-' },
    { key: 'Projekttyp', value: getProjectTypeLabel(projektauftrag.project_type) },
    { key: 'Zeitraum', value: formatDateRange(projektauftrag.start_date, projektauftrag.end_date) },
    { key: 'Status', value: getStatusLabel(projektauftrag.status) },
    { key: 'Erstellt am', value: formatDate(projektauftrag.created_at) },
    { key: 'Zuletzt geändert', value: formatDate(projektauftrag.updated_at) },
  ];

  sections.push({
    title: 'Projekt-Informationen',
    type: 'keyvalue',
    content: { items: projectInfo },
  });

  // Section: Project Description
  if (projektauftrag.description) {
    sections.push({
      title: 'Projektbeschreibung',
      type: 'text',
      content: projektauftrag.description,
    });
  }

  // Section: Goals & Success Criteria
  if (projektauftrag.goals || projektauftrag.criteria?.length > 0) {
    sections.push({
      title: 'Ziele & Erfolgskriterien',
      type: 'text',
      content: projektauftrag.goals || '',
    });

    if (projektauftrag.criteria?.length > 0) {
      sections.push({
        title: 'Erfolgskriterien',
        type: 'list',
        content: { items: projektauftrag.criteria.map((c: any) => c.description || c) },
      });
    }
  }

  // Section: Scope
  if (projektauftrag.scope || projektauftrag.in_scope?.length > 0 || projektauftrag.out_scope?.length > 0) {
    sections.push({
      title: 'Inhalt & Umfang',
      type: 'text',
      content: projektauftrag.scope || '',
    });

    if (projektauftrag.in_scope?.length > 0) {
      sections.push({
        title: 'In Scope',
        type: 'list',
        content: { items: projektauftrag.in_scope },
      });
    }

    if (projektauftrag.out_scope?.length > 0) {
      sections.push({
        title: 'Out of Scope',
        type: 'list',
        content: { items: projektauftrag.out_scope },
      });
    }
  }

  // Section: Tasks (with start/end dates)
  if (projektauftrag.tasks?.length > 0) {
    const taskRows = projektauftrag.tasks.map((task: any) => [
      task.name || '-',
      task.responsible || '-',
      formatDate(task.start_date),
      formatDate(task.end_date),
      task.effort ? String(task.effort) : '-',
      getTaskStatusLabel(task.status),
    ]);

    sections.push({
      title: 'Hauptaufgaben',
      type: 'table',
      content: {
        headers: ['Aufgabe', 'Verantwortlich', 'Start', 'Ende', 'Aufwand', 'Status'],
        rows: taskRows,
      },
    });
  }

  // Section: Milestones
  if (projektauftrag.milestones?.length > 0) {
    const milestoneRows = projektauftrag.milestones.map((ms: any) => [
      ms.name || '-',
      ms.date || '-',
      ms.description || '-',
    ]);

    sections.push({
      title: 'Meilensteine',
      type: 'table',
      content: {
        headers: ['Meilenstein', 'Datum', 'Beschreibung'],
        rows: milestoneRows,
      },
    });
  }

  // Section: Budget (with category)
  if (projektauftrag.budget?.length > 0) {
    const budgetRows = projektauftrag.budget.map((item: any) => [
      item.item || '-',
      item.category || '-',
      item.provider || '-',
      formatCurrency(item.amount),
    ]);

    const totalBudget = projektauftrag.budget.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.amount) || 0),
      0
    );

    budgetRows.push(['Gesamtbudget', '', '', formatCurrency(totalBudget)]);

    sections.push({
      title: 'Budget',
      type: 'table',
      content: {
        headers: ['Position', 'Kategorie', 'Anbieter', 'Betrag'],
        rows: budgetRows,
      },
    });
  }

  // Section: Risks
  if (projektauftrag.risks?.length > 0) {
    const riskRows = projektauftrag.risks.map((risk: any) => [
      risk.description || '-',
      risk.type || '-',
      getProbabilityLabel(risk.probability),
      getImpactLabel(risk.impact),
      risk.mitigation || '-',
    ]);

    sections.push({
      title: 'Risiken',
      type: 'table',
      content: {
        headers: ['Risiko', 'Typ', 'Wahrsch.', 'Auswirkung', 'Maßnahme'],
        rows: riskRows,
      },
    });
  }

  // Section: Organization (with email and availability)
  if (projektauftrag.organization?.length > 0) {
    const orgRows = projektauftrag.organization.map((member: any) => [
      member.name || '-',
      member.role || '-',
      member.email || '-',
      member.availability != null ? `${member.availability}%` : '-',
    ]);

    sections.push({
      title: 'Organisation',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'E-Mail', 'Verfügbarkeit'],
        rows: orgRows,
      },
    });
  }

  // Section: Stakeholders (with expectations)
  if (projektauftrag.stakeholders?.length > 0) {
    const stakeholderRows = projektauftrag.stakeholders.map((sh: any) => [
      sh.name || '-',
      sh.role || '-',
      getInterestLabel(sh.interest),
      getInfluenceLabel(sh.influence),
      sh.expectations || '-',
    ]);

    sections.push({
      title: 'Stakeholder',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'Interesse', 'Einfluss', 'Erwartungen'],
        rows: stakeholderRows,
      },
    });
  }

  // Section: Step Analyses (if available)
  if (projektauftrag.stepAnalyses) {
    const stepNames: Record<number, string> = {
      1: 'Basis-Informationen',
      2: 'Ziele & Erfolgskriterien',
      3: 'Inhalt & Umfang',
      4: 'Hauptaufgaben',
      5: 'Meilensteine',
      6: 'Budget & Risiken',
      7: 'Organisation & Stakeholder',
    };

    const stepRows: string[][] = [];
    for (let i = 1; i <= 7; i++) {
      const sa = projektauftrag.stepAnalyses[i];
      if (sa) {
        stepRows.push([
          sa.stepName || stepNames[i] || `Schritt ${i}`,
          sa.masterclassAnalysis?.score != null ? `${sa.masterclassAnalysis.score}/100` : '-',
          sa.konsistenzAnalysis?.status || '-',
        ]);
      }
    }

    if (stepRows.length > 0) {
      sections.push({
        title: 'KI-Analyse: Schritt-Bewertungen',
        type: 'table',
        content: {
          headers: ['Schritt', 'Score', 'Konsistenz'],
          rows: stepRows,
        },
      });
    }
  }

  // Section: Gesamtbewertung (with correct field names from StoredGesamtbewertung)
  if (projektauftrag.gesamtbewertung) {
    const gb = projektauftrag.gesamtbewertung;

    // Overview key-values
    const bewertungInfo: { key: string; value: string }[] = [];
    if (gb.gesamtScore != null) {
      bewertungInfo.push({ key: 'Gesamtscore', value: `${gb.gesamtScore}/100` });
    }
    if (gb.projektreife) {
      bewertungInfo.push({ key: 'Projektreife', value: getProjektreifeLabel(gb.projektreife.status) });
    }
    if (gb.risikoeinschaetzung) {
      bewertungInfo.push({ key: 'Risikolevel', value: getRisikolevelLabel(gb.risikoeinschaetzung.level) });
    }

    if (bewertungInfo.length > 0) {
      sections.push({
        title: 'KI-Analyse: Gesamtbewertung',
        type: 'keyvalue',
        content: { items: bewertungInfo },
      });
    }

    // Projektreife Begründung
    if (gb.projektreife?.begruendung) {
      sections.push({
        title: 'Projektreife-Begründung',
        type: 'text',
        content: gb.projektreife.begruendung,
      });
    }

    // Step Scores Table
    if (gb.stepScores?.length > 0) {
      const scoreRows = gb.stepScores.map((ss: any) => [
        ss.stepName || `Schritt ${ss.step}`,
        ss.score != null ? `${ss.score}/100` : '-',
        ss.kurzfazit || '-',
      ]);

      sections.push({
        title: 'Bewertung pro Schritt',
        type: 'table',
        content: {
          headers: ['Schritt', 'Score', 'Kurzfazit'],
          rows: scoreRows,
        },
      });
    }

    // Hauptstärken
    if (gb.hauptstaerken?.length > 0) {
      sections.push({
        title: 'Hauptstärken',
        type: 'list',
        content: { items: gb.hauptstaerken },
      });
    }

    // Hauptrisiken
    if (gb.hauptrisiken?.length > 0) {
      sections.push({
        title: 'Hauptrisiken',
        type: 'list',
        content: { items: gb.hauptrisiken },
      });
    }

    // Risikofaktoren
    if (gb.risikoeinschaetzung?.faktoren?.length > 0) {
      sections.push({
        title: 'Risikofaktoren',
        type: 'list',
        content: { items: gb.risikoeinschaetzung.faktoren },
      });
    }

    // Handlungsempfehlungen
    if (gb.handlungsempfehlungen?.length > 0) {
      sections.push({
        title: 'Handlungsempfehlungen',
        type: 'list',
        content: { items: gb.handlungsempfehlungen },
      });
    }
  }

  return {
    title: `Projektauftrag: ${projektauftrag.name || 'Unbenannt'}`,
    metadata: {
      Erstellt: formatDate(projektauftrag.created_at),
      'Zuletzt geändert': formatDate(projektauftrag.updated_at),
      Projektleiter: projektauftrag.projektleiter || '-',
      Status: getStatusLabel(projektauftrag.status),
    },
    sections,
  };
}

// ============== Earned Value Management Helpers ==============

interface CumDataPoint {
  month: string;
  cumPlan: number;
  cumIst: number | null;
  cumForecast: number | null;
  cumEV: number | null;
  cpi: number | null;
  spi: number | null;
}

interface PrognoseResult {
  latestCpi: number | null;
  latestSpi: number | null;
  budgetPrognose: number | null;
  budgetAbweichung: number | null;
}

function computeCumulative(months: any[], budget: number, fortschritt: number): CumDataPoint[] {
  let cumPlan = 0, cumIst = 0, cumForecast = 0;
  let lastIstIndex = -1;

  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].ist > 0) { lastIstIndex = i; break; }
  }

  const cumEV = budget * (fortschritt / 100);
  const totalPlanUpToIst = months.slice(0, lastIstIndex + 1).reduce((s: number, m: any) => s + m.plan, 0);

  return months.map((m: any, i: number) => {
    cumPlan += m.plan;
    cumIst += m.ist;
    if (i <= lastIstIndex) { cumForecast += m.ist; } else { cumForecast += m.forecast; }

    let evAtMonth: number | null = null;
    if (i <= lastIstIndex && totalPlanUpToIst > 0) {
      const planSoFar = months.slice(0, i + 1).reduce((s: number, x: any) => s + x.plan, 0);
      evAtMonth = cumEV * (planSoFar / totalPlanUpToIst);
    } else if (i <= lastIstIndex) {
      evAtMonth = cumEV * ((i + 1) / (lastIstIndex + 1));
    }

    const cpi = (i <= lastIstIndex && cumIst > 0 && evAtMonth != null) ? evAtMonth / cumIst : null;
    const spi = (i <= lastIstIndex && cumPlan > 0 && evAtMonth != null) ? evAtMonth / cumPlan : null;

    return {
      month: m.month,
      cumPlan,
      cumIst: i <= lastIstIndex ? cumIst : null,
      cumForecast: i >= lastIstIndex ? cumForecast : null,
      cumEV: evAtMonth,
      cpi,
      spi,
    };
  });
}

function computePrognose(cumData: CumDataPoint[], budget: number): PrognoseResult {
  let latestCpi: number | null = null, latestSpi: number | null = null;
  for (let i = cumData.length - 1; i >= 0; i--) {
    if (cumData[i].cpi != null) { latestCpi = cumData[i].cpi; break; }
  }
  for (let i = cumData.length - 1; i >= 0; i--) {
    if (cumData[i].spi != null) { latestSpi = cumData[i].spi; break; }
  }

  const budgetPrognose = latestCpi && latestCpi > 0 ? budget / latestCpi : null;
  const budgetAbweichung = budgetPrognose != null ? budgetPrognose - budget : null;

  return { latestCpi, latestSpi, budgetPrognose, budgetAbweichung };
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

// ============== Risk Movement Helpers ==============

const RISK_SCORE_MAP: Record<string, number> = { low: 0, medium: 1, high: 2 };

function riskScore(prob: string, impact: string): number | null {
  const p = RISK_SCORE_MAP[prob];
  const i = RISK_SCORE_MAP[impact];
  if (p == null || i == null) return null;
  return p + i;
}

interface RiskMovementEntry {
  beschreibung: string;
  type: string;
  origProb: string;
  origImpact: string;
  currProb: string;
  currImpact: string;
  trend: string; // 'verbessert' | 'verschlechtert' | 'unverändert' | 'nicht bewertet'
}

function computeRiskMovement(riskTracking: any[], projektauftragRisks: any[]): RiskMovementEntry[] {
  const origMap = new Map<string, any>();
  for (const r of projektauftragRisks) {
    origMap.set(r.id, r);
  }

  return riskTracking.map((t: any) => {
    const orig = t.auftrag_risk_id ? origMap.get(t.auftrag_risk_id) : null;
    const origProb = orig?.probability || '';
    const origImpact = orig?.impact || '';
    const currProb = t.wahrscheinlichkeit || '';
    const currImpact = t.auswirkung_bewertung || '';

    const origScore = riskScore(origProb, origImpact);
    const currScore = riskScore(currProb, currImpact);

    let trend = 'nicht bewertet';
    if (origScore != null && currScore != null) {
      if (t.type === 'chance') {
        // For opportunities: higher score = improved
        trend = currScore > origScore ? 'verbessert' : currScore < origScore ? 'verschlechtert' : 'unverändert';
      } else {
        // For threats: lower score = improved
        trend = currScore < origScore ? 'verbessert' : currScore > origScore ? 'verschlechtert' : 'unverändert';
      }
    }

    return {
      beschreibung: t.beschreibung || '-',
      type: t.type === 'chance' ? 'Chance' : 'Bedrohung',
      origProb: getProbabilityLabel(origProb),
      origImpact: getImpactLabel(origImpact),
      currProb: getProbabilityLabel(currProb),
      currImpact: getImpactLabel(currImpact),
      trend,
    };
  });
}

const TREND_COLORS: Record<string, string> = {
  'verbessert': '#22C55E',
  'verschlechtert': '#EF4444',
  'unverändert': '#64748B',
  'nicht bewertet': '#94A3B8',
};

function getTrendCell(trend: string): RichCell {
  const labels: Record<string, string> = {
    'verbessert': 'Verbessert',
    'verschlechtert': 'Verschlechtert',
    'unverändert': 'Unverändert',
    'nicht bewertet': 'Nicht bewertet',
  };
  return { text: labels[trend] || trend, dot: TREND_COLORS[trend] };
}

// ============== Statusbericht Mapping ==============

/**
 * Maps a Statusbericht to DocumentData structure.
 * Accepts full Projektauftrag for EVM calculations and Risk Movement analysis.
 */
export function mapStatusberichtToDocument(sb: any, projektauftrag?: any): DocumentData {
  const projektName = projektauftrag?.name;
  const sections: DocumentSection[] = [];

  // Section: Berichts-Informationen
  const infoItems: { key: string; value: string | RichCell }[] = [
    { key: 'Projekt', value: projektName || '-' },
    { key: 'Bericht Nr.', value: sb.nummer ? `#${sb.nummer}` : '-' },
    { key: 'Berichtsdatum', value: formatDate(sb.datum) },
    { key: 'Ampelstatus', value: getAmpelCell(sb.ampel) },
    { key: 'Status', value: sb.status === 'final' ? 'Final' : 'Entwurf' },
    { key: 'Erstellt am', value: formatDate(sb.created_at) },
    { key: 'Zuletzt geändert', value: formatDate(sb.updated_at) },
  ];

  sections.push({
    title: 'Berichts-Informationen',
    type: 'keyvalue',
    content: { items: infoItems },
  });

  // Section: Management Summary
  if (sb.management_summary) {
    sections.push({
      title: 'Management Summary',
      type: 'text',
      content: sb.management_summary,
    });
  }

  // Section: Ziele
  if (sb.goals_snapshot || sb.criteria_snapshot?.length > 0) {
    if (sb.goals_snapshot) {
      const goalsInfo: { key: string; value: string | RichCell }[] = [
        { key: 'Ziele', value: sb.goals_snapshot },
      ];
      if (sb.goals_tracking) {
        goalsInfo.push(
          { key: 'Fortschritt', value: sb.goals_tracking.fortschritt != null ? `${sb.goals_tracking.fortschritt}%` : '-' },
          { key: 'Ampel', value: getAmpelCell(sb.goals_tracking.ampel) },
        );
        if (sb.goals_tracking.bemerkung) {
          goalsInfo.push({ key: 'Bemerkung', value: sb.goals_tracking.bemerkung });
        }
      }
      sections.push({
        title: 'Ziele',
        type: 'keyvalue',
        content: { items: goalsInfo },
      });
    }

    if (sb.criteria_snapshot?.length > 0) {
      const criteriaRows = sb.criteria_snapshot.map((criterion: string, i: number) => {
        const tracking = sb.criteria_tracking?.[i];
        return [
          criterion,
          tracking?.fortschritt != null ? `${tracking.fortschritt}%` : '-',
          getAmpelCell(tracking?.ampel),
          tracking?.bemerkung || '-',
        ];
      });

      sections.push({
        title: 'Erfolgskriterien',
        type: 'table',
        content: {
          headers: ['Kriterium', 'Fortschritt', 'Ampel', 'Bemerkung'],
          rows: criteriaRows,
        },
      });
    }
  }

  // Section: Meilensteine
  if (sb.milestones_snapshot?.length > 0) {
    const msRows = sb.milestones_snapshot.map((ms: any, i: number) => {
      const tracking = sb.milestones_tracking?.[i];
      return [
        ms.name || '-',
        formatDate(ms.date),
        tracking?.ist_datum ? formatDate(tracking.ist_datum) : '-',
        tracking?.fortschritt != null ? `${tracking.fortschritt}%` : '-',
        getAmpelCell(tracking?.ampel),
        tracking?.status || '-',
        tracking?.bemerkung || '-',
      ];
    });

    sections.push({
      title: 'Meilensteine',
      type: 'table',
      content: {
        headers: ['Meilenstein', 'Soll', 'Ist', 'Fortschritt', 'Ampel', 'Status', 'Bemerkung'],
        rows: msRows,
      },
    });
  }

  // Section: Aufgaben
  if (sb.tasks_snapshot?.length > 0) {
    const taskRows = sb.tasks_snapshot.map((task: any, i: number) => {
      const tracking = sb.tasks_tracking?.[i];
      return [
        task.name || '-',
        task.responsible || '-',
        tracking?.fortschritt != null ? `${tracking.fortschritt}%` : '-',
        getAmpelCell(tracking?.ampel),
        tracking?.status || '-',
        tracking?.bemerkung || '-',
      ];
    });

    sections.push({
      title: 'Aufgaben',
      type: 'table',
      content: {
        headers: ['Aufgabe', 'Verantwortlich', 'Fortschritt', 'Ampel', 'Status', 'Bemerkung'],
        rows: taskRows,
      },
    });
  }

  // Section: Quality Gates
  if (sb.quality_gates_snapshot?.length > 0) {
    const qgRows = sb.quality_gates_snapshot.map((qg: any, i: number) => {
      const tracking = sb.quality_gates_tracking?.[i];
      return [
        qg.name || '-',
        formatDate(qg.date),
        tracking?.ist_datum ? formatDate(tracking.ist_datum) : '-',
        getAmpelCell(tracking?.ampel),
        tracking?.status || '-',
        tracking?.bemerkung || '-',
      ];
    });

    sections.push({
      title: 'Quality Gates',
      type: 'table',
      content: {
        headers: ['Gate', 'Soll', 'Ist', 'Ampel', 'Status', 'Bemerkung'],
        rows: qgRows,
      },
    });
  }

  // Section: Kosten
  if (sb.cost_budget || sb.cost_months?.length > 0) {
    const costInfo: { key: string; value: string }[] = [];
    if (sb.cost_budget) {
      costInfo.push({ key: 'Gesamtbudget', value: formatCurrency(sb.cost_budget) });
    }

    // Calculate totals from monthly data
    if (sb.cost_months?.length > 0) {
      const totalPlan = sb.cost_months.reduce((s: number, m: any) => s + (m.plan || 0), 0);
      const totalIst = sb.cost_months.reduce((s: number, m: any) => s + (m.ist || 0), 0);
      const totalForecast = sb.cost_months.reduce((s: number, m: any) => s + (m.forecast || 0), 0);
      costInfo.push(
        { key: 'Plan (Summe)', value: formatCurrency(totalPlan) },
        { key: 'Ist (Summe)', value: formatCurrency(totalIst) },
        { key: 'Forecast (Summe)', value: formatCurrency(totalForecast) },
      );
    }

    if (costInfo.length > 0) {
      sections.push({
        title: 'Kosten-Übersicht',
        type: 'keyvalue',
        content: { items: costInfo },
      });
    }

    if (sb.cost_months?.length > 0) {
      const monthRows = sb.cost_months.map((m: any) => [
        formatMonth(m.month),
        formatCurrency(m.plan),
        formatCurrency(m.ist),
        formatCurrency(m.forecast),
      ]);

      sections.push({
        title: 'Monatliche Kosten',
        type: 'table',
        content: {
          headers: ['Monat', 'Plan', 'Ist', 'Forecast'],
          rows: monthRows,
        },
      });
    }
  }

  // ── Earned Value Management ──────────────────────────
  const budget = sb.cost_budget ?? 0;
  const months = sb.cost_months || [];
  const fortschritt = sb.goals_tracking?.fortschritt ?? 0;

  if (months.length > 0 && budget > 0) {
    const cumData = computeCumulative(months, budget, fortschritt);
    const prognose = computePrognose(cumData, budget);
    const cumEV = budget * (fortschritt / 100);

    // EVM KPIs
    const evmKpis: { key: string; value: string | RichCell }[] = [
      { key: 'Earned Value (EV)', value: formatCurrency(cumEV) },
    ];

    if (prognose.latestCpi != null) {
      const cpiColor = prognose.latestCpi >= 1 ? '#22C55E' : prognose.latestCpi >= 0.9 ? '#EAB308' : '#EF4444';
      evmKpis.push({ key: 'CPI (Cost Performance)', value: { text: prognose.latestCpi.toFixed(2), dot: cpiColor } });
    }
    if (prognose.latestSpi != null) {
      const spiColor = prognose.latestSpi >= 1 ? '#22C55E' : prognose.latestSpi >= 0.9 ? '#EAB308' : '#EF4444';
      evmKpis.push({ key: 'SPI (Schedule Performance)', value: { text: prognose.latestSpi.toFixed(2), dot: spiColor } });
    }

    sections.push({
      title: 'Earned Value Kennzahlen',
      type: 'keyvalue',
      content: { items: evmKpis },
    });

    // Cumulative table (months that have data)
    const cumRows = cumData.map((d) => [
      formatMonth(d.month),
      formatCurrency(d.cumPlan),
      d.cumIst != null ? formatCurrency(d.cumIst) : '-',
      d.cumEV != null ? formatCurrency(Math.round(d.cumEV)) : '-',
      d.cpi != null ? d.cpi.toFixed(2) : '-',
      d.spi != null ? d.spi.toFixed(2) : '-',
    ]);

    sections.push({
      title: 'Kumulierte Kostenentwicklung',
      type: 'table',
      content: {
        headers: ['Monat', 'Plan (kum.)', 'Ist (kum.)', 'EV (kum.)', 'CPI', 'SPI'],
        rows: cumRows,
      },
    });

    // Terminprognose (needs Projektauftrag dates)
    const startDate = projektauftrag?.start_date || '';
    const endDate = projektauftrag?.end_date || '';
    const berichtsDatum = sb.datum || '';

    if (startDate && endDate) {
      const daysEnd = daysBetween(startDate, endDate);
      const daysBericht = daysBetween(startDate, berichtsDatum);

      let terminPrognose: string | null = null;
      let terminPrognoseDays: number | null = null;
      let terminAbweichung: number | null = null;

      if (prognose.latestSpi && prognose.latestSpi > 0 && daysEnd != null) {
        terminPrognoseDays = Math.round(daysEnd / prognose.latestSpi);
        const startMs = new Date(startDate).getTime();
        if (!isNaN(startMs)) {
          terminPrognose = new Date(startMs + terminPrognoseDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
        terminAbweichung = terminPrognoseDays - daysEnd;
      }

      const terminItems: { key: string; value: string | RichCell }[] = [
        { key: 'Starttermin', value: formatDate(startDate) },
        { key: 'Berichtsdatum', value: `${formatDate(berichtsDatum)}${daysBericht != null ? ` (${daysBericht} Tage)` : ''}` },
        { key: 'Endtermin (Soll)', value: `${formatDate(endDate)}${daysEnd != null ? ` (${daysEnd} Tage)` : ''}` },
      ];

      if (terminPrognose) {
        const abwColor = terminAbweichung != null && terminAbweichung > 0 ? '#EF4444' : '#22C55E';
        terminItems.push({
          key: 'Prognose (Ist)',
          value: {
            text: `${formatDate(terminPrognose)}${terminPrognoseDays != null ? ` (${terminPrognoseDays} Tage)` : ''}`,
            dot: abwColor,
          },
        });
        if (terminAbweichung != null) {
          terminItems.push({
            key: 'Abweichung',
            value: terminAbweichung > 0 ? `+${terminAbweichung} Tage` : `${terminAbweichung} Tage`,
          });
        }
      }

      sections.push({
        title: 'Terminprognose',
        type: 'keyvalue',
        content: { items: terminItems },
      });
    }

    // Budgetprognose
    if (prognose.budgetPrognose != null) {
      const abwColor = prognose.budgetAbweichung != null && prognose.budgetAbweichung > 0 ? '#EF4444' : '#22C55E';
      const budgetItems: { key: string; value: string | RichCell }[] = [
        { key: 'Budget (Plan)', value: formatCurrency(budget) },
        {
          key: 'EAC (Prognose)',
          value: {
            text: formatCurrency(Math.round(prognose.budgetPrognose)),
            dot: abwColor,
          },
        },
      ];
      if (prognose.budgetAbweichung != null) {
        budgetItems.push({
          key: 'Abweichung',
          value: prognose.budgetAbweichung > 0
            ? `+${formatCurrency(Math.round(prognose.budgetAbweichung))}`
            : formatCurrency(Math.round(prognose.budgetAbweichung)),
        });
      }

      sections.push({
        title: 'Budgetprognose',
        type: 'keyvalue',
        content: { items: budgetItems },
      });
    }
  }

  // ── Risiken ──────────────────────────────────────────
  if (sb.risk_tracking?.length > 0) {
    const riskRows = sb.risk_tracking.map((r: any) => [
      r.beschreibung || '-',
      r.type === 'chance' ? 'Chance' : 'Bedrohung',
      getAmpelCell(r.ampel),
      getProbabilityLabel(r.wahrscheinlichkeit),
      getImpactLabel(r.auswirkung_bewertung),
    ]);

    sections.push({
      title: 'Risiken',
      type: 'table',
      content: {
        headers: ['Beschreibung', 'Typ', 'Ampel', 'Wahrsch.', 'Auswirkung'],
        rows: riskRows,
      },
    });
  }

  // ── Risikobewegung ──────────────────────────────────
  const paRisks = projektauftrag?.risks || [];
  if (sb.risk_tracking?.length > 0 && paRisks.length > 0) {
    const movements = computeRiskMovement(sb.risk_tracking, paRisks);

    // Only include risks that have both original and current ratings
    const rated = movements.filter((m) => m.trend !== 'nicht bewertet');
    const unrated = movements.filter((m) => m.trend === 'nicht bewertet');

    if (rated.length > 0) {
      const movementRows = rated.map((m) => [
        m.beschreibung,
        m.type,
        `${m.origProb} / ${m.origImpact}`,
        `${m.currProb} / ${m.currImpact}`,
        getTrendCell(m.trend),
      ]);

      sections.push({
        title: 'Risikobewegung (Soll → Ist)',
        type: 'table',
        content: {
          headers: ['Risiko', 'Typ', 'Soll (W/A)', 'Ist (W/A)', 'Trend'],
          rows: movementRows,
        },
      });

      // Summary
      const improved = rated.filter((m) => m.trend === 'verbessert').length;
      const worsened = rated.filter((m) => m.trend === 'verschlechtert').length;
      const unchanged = rated.filter((m) => m.trend === 'unverändert').length;

      const summaryItems: { key: string; value: string | RichCell }[] = [];
      if (improved > 0) summaryItems.push({ key: 'Verbessert', value: { text: `${improved} Risiken`, dot: '#22C55E' } });
      if (worsened > 0) summaryItems.push({ key: 'Verschlechtert', value: { text: `${worsened} Risiken`, dot: '#EF4444' } });
      if (unchanged > 0) summaryItems.push({ key: 'Unverändert', value: { text: `${unchanged} Risiken`, dot: '#64748B' } });
      if (unrated.length > 0) summaryItems.push({ key: 'Nicht bewertet', value: `${unrated.length} Risiken` });

      if (summaryItems.length > 0) {
        sections.push({
          title: 'Risikobewegung – Zusammenfassung',
          type: 'keyvalue',
          content: { items: summaryItems },
        });
      }
    }
  }

  return {
    title: `Statusbericht #${sb.nummer || '?'}${projektName ? `: ${projektName}` : ''}`,
    metadata: {
      Datum: formatDate(sb.datum),
      Ampel: getAmpelLabel(sb.ampel),
      Status: sb.status === 'final' ? 'Final' : 'Entwurf',
    },
    sections,
  };
}

// ============== Abschlussbericht Mapping ==============

/**
 * Maps an Abschlussbericht to DocumentData. Combines SB-style sections (Goals/
 * Roadmap/Cost/Risk-Tracking) with Auftrag-Snapshots (Scope/Stakeholder/Budget-
 * Plan) and abschluss-spezifische Felder (Findings, Übergabe, Akzeptanz, LL).
 *
 * Lessons Learned werden live durchgereicht (nicht im data persistiert).
 */
// Risk-Type ist Wizard-hardcoded (kein Config-Eintrag). Mapping deckt
// englische Wizard-Werte und Legacy-deutsche Daten ab.
const ABSCHLUSS_RISK_TYPE_LABEL: Record<string, string> = {
  threat: 'Bedrohung', chance: 'Chance', bedrohung: 'Bedrohung',
  technical: 'Technisch', technisch: 'Technisch',
  organizational: 'Organisatorisch', organisatorisch: 'Organisatorisch',
  financial: 'Finanziell', finanziell: 'Finanziell',
  schedule: 'Terminlich', terminlich: 'Terminlich',
  resource: 'Ressourcen', ressourcen: 'Ressourcen',
  external: 'Extern', extern: 'Extern',
};

function riskTypeLabel(value: any): string {
  if (!value) return '-';
  return ABSCHLUSS_RISK_TYPE_LABEL[String(value)] || String(value);
}

function configValueLabel(appConfig: any, key: string, value: any): string {
  if (!value) return '-';
  const opt = (appConfig?.[key] || []).find((o: any) => o.value === value);
  return opt?.label || String(value);
}

export function mapAbschlussberichtToDocument(
  bericht: any,
  projektauftrag?: any,
  lessonsLearned?: any[],
  appConfig?: any,
): DocumentData {
  const data = bericht?.data || {};
  const projektName = projektauftrag?.name || '-';
  const sections: DocumentSection[] = [];

  // Section: Berichts-Informationen
  const infoItems: { key: string; value: string | RichCell }[] = [
    { key: 'Projekt', value: projektName },
    { key: 'Abschluss-Datum', value: formatDate(data.datum) },
    { key: 'Gesamt-Ampel', value: getAmpelCell(data.ampel) },
    { key: 'Status', value: bericht?.status === 'final' ? 'Final' : 'Entwurf' },
  ];
  if (bericht?.finalizedAt) infoItems.push({ key: 'Finalisiert am', value: formatDate(bericht.finalizedAt) });
  if (data.start_date_plan && data.end_date_plan) {
    infoItems.push({ key: 'Geplanter Zeitraum', value: `${formatDate(data.start_date_plan)} – ${formatDate(data.end_date_plan)}` });
  }
  if (data.auftraggeber) infoItems.push({ key: 'Auftraggeber', value: data.auftraggeber });
  if (data.project_type) infoItems.push({ key: 'Projekttyp', value: getProjectTypeLabel(data.project_type) });
  sections.push({ title: 'Berichts-Informationen', type: 'keyvalue', content: { items: infoItems } });

  // Section: Soll/Ist-Dashboard (computed)
  const dashboard = buildAbschlussDashboard(data);
  if (dashboard.length > 0) {
    sections.push({ title: 'Soll/Ist-Dashboard', type: 'keyvalue', content: { items: dashboard } });
  }

  // Section: Management Summary
  if (data.management_summary) {
    sections.push({ title: 'Management Summary', type: 'text', content: data.management_summary });
  }

  // Section: Key Findings
  if (data.key_findings) {
    sections.push({ title: 'Key Findings', type: 'text', content: data.key_findings });
  }

  // Section: Ziele
  if (data.goals_snapshot || (data.criteria_snapshot?.length > 0)) {
    const goalsInfo: { key: string; value: string | RichCell }[] = [];
    if (data.goals_snapshot) goalsInfo.push({ key: 'Ziele', value: data.goals_snapshot });
    if (data.goals_tracking) {
      goalsInfo.push(
        { key: 'Fortschritt', value: data.goals_tracking.fortschritt != null ? `${data.goals_tracking.fortschritt}%` : '-' },
        { key: 'Ampel', value: getAmpelCell(data.goals_tracking.ampel) },
      );
      if (data.goals_tracking.bemerkung) goalsInfo.push({ key: 'Bemerkung', value: data.goals_tracking.bemerkung });
    }
    sections.push({ title: 'Ziele', type: 'keyvalue', content: { items: goalsInfo } });

    if ((data.criteria_snapshot?.length || 0) > 0) {
      const rows = (data.criteria_snapshot || []).map((c: string, i: number) => {
        const t = data.criteria_tracking?.[i] || {};
        return [c, t.fortschritt != null ? `${t.fortschritt}%` : '-', getAmpelCell(t.ampel), t.bemerkung || ''];
      });
      sections.push({
        title: 'Kriterien',
        type: 'table',
        content: { headers: ['Kriterium', 'Fortschritt', 'Ampel', 'Bemerkung'], rows },
      });
    }
  }

  // Section: Scope (aus Auftrag)
  if (data.scope || data.in_scope?.length || data.out_scope?.length) {
    const scopeItems: { key: string; value: string | RichCell }[] = [];
    if (data.scope) scopeItems.push({ key: 'Beschreibung', value: data.scope });
    if (data.in_scope?.length) scopeItems.push({ key: 'In Scope', value: data.in_scope.join('\n') });
    if (data.out_scope?.length) scopeItems.push({ key: 'Out of Scope', value: data.out_scope.join('\n') });
    sections.push({ title: 'Scope', type: 'keyvalue', content: { items: scopeItems } });
  }

  // Section: Roadmap (Soll vs Ist via Milestones-Tracking)
  if ((data.milestones_snapshot?.length || 0) > 0) {
    const rows = (data.milestones_snapshot || []).map((m: any, i: number) => {
      const t = data.milestones_tracking?.[i] || {};
      return [m.name || '-', formatDate(m.date), formatDate(t.ist_datum), t.status || '-', getAmpelCell(t.ampel), t.bemerkung || ''];
    });
    sections.push({
      title: 'Meilensteine',
      type: 'table',
      content: { headers: ['Meilenstein', 'Soll', 'Ist', 'Status', 'Ampel', 'Bemerkung'], rows },
    });
  }

  // Section: Kosten — wir nutzen den bestehenden EVM-Helper, wenn vorhanden.
  if ((data.cost_months?.length || 0) > 0) {
    const evmRows = (data.cost_months || []).map((m: any) => [
      m.month, fmtCurrency(m.plan), fmtCurrency(m.ist), fmtCurrency(m.forecast),
    ]);
    sections.push({
      title: 'Kosten (EVM)',
      type: 'table',
      content: { headers: ['Monat', 'Plan', 'Ist', 'Forecast'], rows: evmRows },
    });
    const totalIst = (data.cost_months || []).reduce((sum: number, m: any) => sum + (Number(m.ist) || 0), 0);
    const abweichung = data.cost_budget ? ((totalIst - data.cost_budget) / data.cost_budget) * 100 : 0;
    sections.push({
      title: 'Kosten — Gesamtbild',
      type: 'keyvalue',
      content: {
        items: [
          { key: 'Gesamtbudget', value: fmtCurrency(data.cost_budget) },
          { key: 'Ist (Summe)', value: fmtCurrency(totalIst) },
          { key: 'Abweichung', value: data.cost_budget ? `${abweichung >= 0 ? '+' : ''}${abweichung.toFixed(1)}%` : '-' },
        ],
      },
    });
  }

  // Section: Risiken — Plan vs Ist
  if ((data.risks_plan?.length || 0) > 0 || (data.risk_tracking?.length || 0) > 0) {
    if ((data.risks_plan?.length || 0) > 0) {
      const rows = (data.risks_plan || []).map((r: any) => [
        riskTypeLabel(r.type),
        r.description || '-',
        configValueLabel(appConfig, 'probability', r.probability),
        configValueLabel(appConfig, 'impact', r.impact),
        r.mitigation || '-',
      ]);
      sections.push({
        title: 'Risiken (Plan, aus Projektauftrag)',
        type: 'table',
        content: { headers: ['Typ', 'Beschreibung', 'Wahrsch.', 'Auswirk.', 'Maßnahme'], rows },
      });
    }
    if ((data.risk_tracking?.length || 0) > 0) {
      const rows = (data.risk_tracking || []).map((r: any) => [
        riskTypeLabel(r.type),
        r.beschreibung || '-',
        configValueLabel(appConfig, 'risk_status', r.status),
        r.massnahmen || '-',
        getAmpelCell(r.ampel),
      ]);
      sections.push({
        title: 'Risiken (Ist, eingetreten/vermieden)',
        type: 'table',
        content: { headers: ['Typ', 'Beschreibung', 'Status', 'Maßnahmen', 'Ampel'], rows },
      });
    }
  }

  // Section: Stakeholder-Akzeptanz
  if ((data.stakeholder_akzeptanz?.length || 0) > 0) {
    const rows = (data.stakeholder_akzeptanz || []).map((s: any) => [
      s.name || s.stakeholder_id || '-', getAmpelCell(s.bewertung), s.bemerkung || '',
    ]);
    sections.push({
      title: 'Stakeholder-Akzeptanz',
      type: 'table',
      content: { headers: ['Stakeholder', 'Bewertung', 'Bemerkung'], rows },
    });
  }

  // Section: Übergabe
  if (data.uebergabe_an || data.uebergabe_datum || data.uebergabe_inhalte) {
    const ueb: { key: string; value: string | RichCell }[] = [];
    if (data.uebergabe_an) ueb.push({ key: 'Übergabe an', value: data.uebergabe_an });
    if (data.uebergabe_datum) ueb.push({ key: 'Datum', value: formatDate(data.uebergabe_datum) });
    if (data.uebergabe_inhalte) ueb.push({ key: 'Inhalte', value: data.uebergabe_inhalte });
    sections.push({ title: 'Übergabe', type: 'keyvalue', content: { items: ueb } });
  }

  // Section: Folgeprojekt-Empfehlung
  if (data.folgeprojekt_empfehlung) {
    sections.push({ title: 'Empfehlung für Folgeprojekte', type: 'text', content: data.folgeprojekt_empfehlung });
  }

  // Section: Lessons Learned (live)
  if (lessonsLearned && lessonsLearned.length > 0) {
    const swotOrder = ['strength', 'weakness', 'opportunity', 'threat'];
    const swotLabels: Record<string, string> = {
      strength: 'Strength', weakness: 'Weakness', opportunity: 'Opportunity', threat: 'Threat',
    };
    const sorted = [...lessonsLearned].sort((a, b) =>
      swotOrder.indexOf(a.kategorie) - swotOrder.indexOf(b.kategorie),
    );
    const rows = sorted.map((l: any) => [
      l.title || '-',
      swotLabels[l.kategorie] || l.kategorie || '-',
      l.themengebiet || '-',
      l.beschreibung || '',
      l.empfehlung || '',
    ]);
    sections.push({
      title: 'Lessons Learned',
      type: 'table',
      content: { headers: ['Titel', 'Kategorie', 'Themengebiet', 'Beschreibung', 'Empfehlung'], rows },
    });
  }

  // Section: Abnahme
  if (data.abnahme_durch || data.abnahme_datum || data.abnahme_signiert) {
    const ab: { key: string; value: string | RichCell }[] = [];
    if (data.abnahme_durch) ab.push({ key: 'Abnahme durch', value: data.abnahme_durch });
    if (data.abnahme_datum) ab.push({ key: 'Datum', value: formatDate(data.abnahme_datum) });
    ab.push({ key: 'Formal abgenommen', value: data.abnahme_signiert ? 'Ja' : 'Nein' });
    sections.push({ title: 'Abnahme', type: 'keyvalue', content: { items: ab } });
  }

  return {
    title: `Abschlussbericht — ${projektName}`,
    metadata: { status: bericht?.status === 'final' ? 'Final' : 'Entwurf' },
    sections,
  };
}

function buildAbschlussDashboard(data: any): { key: string; value: string | RichCell }[] {
  const items: { key: string; value: string | RichCell }[] = [];

  // Termin-Abweichung
  if (data.end_date_plan && data.tasks_tracking?.length) {
    const istEnd = data.tasks_tracking
      .map((t: any) => t.ist_datum).filter(Boolean).sort().pop();
    if (istEnd) {
      const planMs = new Date(data.end_date_plan).getTime();
      const istMs = new Date(istEnd).getTime();
      if (!isNaN(planMs) && !isNaN(istMs)) {
        const diffDays = Math.round((istMs - planMs) / (1000 * 60 * 60 * 24));
        items.push({ key: 'Termin-Abweichung', value: `${diffDays >= 0 ? '+' : ''}${diffDays} Tage` });
      }
    }
  }

  // Budget-Abweichung
  if (data.cost_budget && data.cost_months?.length) {
    const totalIst = data.cost_months.reduce((s: number, m: any) => s + (Number(m.ist) || 0), 0);
    const pct = ((totalIst - data.cost_budget) / data.cost_budget) * 100;
    items.push({ key: 'Budget-Abweichung', value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` });
  }

  // Goal-Erfüllung
  if (data.criteria_tracking?.length) {
    const fortschritte = data.criteria_tracking.map((c: any) => Number(c.fortschritt) || 0);
    const avg = fortschritte.reduce((s: number, n: number) => s + n, 0) / fortschritte.length;
    items.push({ key: 'Ziel-Erfüllung (Ø)', value: `${avg.toFixed(0)}%` });
  }

  // Risiko-Bilanz
  if (data.risk_tracking?.length) {
    let eingetreten = 0, vermieden = 0, aktiv = 0;
    for (const r of data.risk_tracking) {
      const s = (r.status || '').toLowerCase();
      if (s === 'eingetreten') eingetreten++;
      else if (s === 'vermieden') vermieden++;
      else if (s === 'aktiv' || s === 'bewertet' || s === 'identifiziert') aktiv++;
    }
    items.push({
      key: 'Risiko-Bilanz',
      value: `${eingetreten} eingetreten / ${vermieden} vermieden / ${aktiv} aktiv`,
    });
  }

  // Stakeholder-Zufriedenheit
  if (data.stakeholder_akzeptanz?.length) {
    let gruen = 0, gelb = 0, rot = 0;
    for (const s of data.stakeholder_akzeptanz) {
      if (s.bewertung === 'gruen') gruen++;
      else if (s.bewertung === 'gelb') gelb++;
      else if (s.bewertung === 'rot') rot++;
    }
    items.push({
      key: 'Stakeholder-Akzeptanz',
      value: `${gruen} gruen / ${gelb} gelb / ${rot} rot`,
    });
  }

  return items;
}

function fmtCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value));
}

// ============== Helper Functions ==============

function getProjectTypeLabel(type: string): string {
  const types: Record<string, string> = {
    internal: 'Intern',
    external: 'Extern',
    research: 'Forschung',
    infrastructure: 'IT/Infrastruktur',
  };
  return types[type] || type || '-';
}

function getStatusLabel(status: string): string {
  const statuses: Record<string, string> = {
    draft: 'Entwurf',
    active: 'Aktiv',
    completed: 'Abgeschlossen',
    cancelled: 'Abgebrochen',
  };
  return statuses[status] || status || '-';
}

function getTaskStatusLabel(status: string): string {
  const statuses: Record<string, string> = {
    open: 'Offen',
    pending: 'Ausstehend',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
  };
  return statuses[status] || status || '-';
}

function getProbabilityLabel(value: string): string {
  const labels: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };
  return labels[value] || value || '-';
}

function getImpactLabel(value: string): string {
  const labels: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };
  return labels[value] || value || '-';
}

function getInterestLabel(value: string): string {
  const labels: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };
  return labels[value] || value || '-';
}

function getInfluenceLabel(value: string): string {
  const labels: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };
  return labels[value] || value || '-';
}

function getProjektreifeLabel(status: string): string {
  const labels: Record<string, string> = {
    bereit: 'Bereit',
    bedingt_bereit: 'Bedingt bereit',
    nicht_bereit: 'Nicht bereit',
  };
  return labels[status] || status || '-';
}

function getRisikolevelLabel(level: string): string {
  const labels: Record<string, string> = {
    niedrig: 'Niedrig',
    mittel: 'Mittel',
    hoch: 'Hoch',
    kritisch: 'Kritisch',
  };
  return labels[level] || level || '-';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('de-DE');
  } catch {
    return dateStr;
  }
}

function formatDateRange(start: string, end: string): string {
  if (!start && !end) return '-';
  const s = formatDate(start);
  const e = formatDate(end);
  if (!start) return `bis ${e}`;
  if (!end) return `ab ${s}`;
  return `${s} – ${e}`;
}

const AMPEL_COLORS: Record<string, string> = {
  gruen: '#22C55E',
  gelb: '#EAB308',
  rot: '#EF4444',
};

const AMPEL_LABELS: Record<string, string> = {
  gruen: 'Grün',
  gelb: 'Gelb',
  rot: 'Rot',
};

function getAmpelLabel(ampel: string): string {
  return AMPEL_LABELS[ampel] || ampel || '-';
}

function getAmpelCell(ampel: string): RichCell {
  return {
    text: AMPEL_LABELS[ampel] || ampel || '-',
    dot: AMPEL_COLORS[ampel],
  };
}

function formatMonth(monthStr: string): string {
  if (!monthStr) return '-';
  // "2024-08" → "Aug 2024"
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

// ============== Factory Function ==============

/**
 * Generate a document in the specified format
 */
export async function generateDocument(
  data: DocumentData,
  format: DocumentFormat
): Promise<Buffer> {
  switch (format) {
    case 'xlsx':
      return generateExcel(data);
    case 'pdf':
      return generatePdf(data);
    case 'docx':
      return generateWord(data);
    case 'md':
      return generateMarkdown(data);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Get MIME type for a document format
 */
export function getMimeType(format: DocumentFormat): string {
  switch (format) {
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'md':
      return 'text/markdown; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Get file extension for a document format
 */
export function getFileExtension(format: DocumentFormat): string {
  return format;
}
