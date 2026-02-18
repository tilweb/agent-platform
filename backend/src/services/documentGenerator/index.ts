/**
 * Document Generator Service
 * Factory and interfaces for generating documents in various formats
 */

import { generateExcel } from './excelGenerator';
import { generatePdf } from './pdfGenerator';
import { generateWord } from './wordGenerator';

// Re-export types
export type {
  DocumentData,
  DocumentSection,
  TableContent,
  KeyValueContent,
  ListContent,
  DocumentFormat,
} from './types';

// Import types for use in this file
import type { DocumentData, DocumentSection, DocumentFormat } from './types';

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
  ];

  sections.push({
    title: 'Projekt-Informationen',
    type: 'keyvalue',
    content: { items: projectInfo },
  });

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

  // Section: Tasks
  if (projektauftrag.tasks?.length > 0) {
    const taskRows = projektauftrag.tasks.map((task: any) => [
      task.name || '-',
      task.responsible || '-',
      task.effort || '-',
      getTaskStatusLabel(task.status),
    ]);

    sections.push({
      title: 'Hauptaufgaben',
      type: 'table',
      content: {
        headers: ['Aufgabe', 'Verantwortlich', 'Aufwand', 'Status'],
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

  // Section: Budget
  if (projektauftrag.budget?.length > 0) {
    const budgetRows = projektauftrag.budget.map((item: any) => [
      item.item || '-',
      item.provider || '-',
      formatCurrency(item.amount),
    ]);

    const totalBudget = projektauftrag.budget.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.amount) || 0),
      0
    );

    budgetRows.push(['Gesamtbudget', '', formatCurrency(totalBudget)]);

    sections.push({
      title: 'Budget',
      type: 'table',
      content: {
        headers: ['Position', 'Anbieter', 'Betrag'],
        rows: budgetRows,
      },
    });
  }

  // Section: Risks
  if (projektauftrag.risks?.length > 0) {
    const riskRows = projektauftrag.risks.map((risk: any) => [
      risk.description || '-',
      risk.type || '-',
      risk.probability || '-',
      risk.impact || '-',
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

  // Section: Organization
  if (projektauftrag.organization?.length > 0) {
    const orgRows = projektauftrag.organization.map((member: any) => [
      member.name || '-',
      member.role || '-',
    ]);

    sections.push({
      title: 'Organisation',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle'],
        rows: orgRows,
      },
    });
  }

  // Section: Stakeholders
  if (projektauftrag.stakeholders?.length > 0) {
    const stakeholderRows = projektauftrag.stakeholders.map((sh: any) => [
      sh.name || '-',
      sh.role || '-',
      sh.interest || '-',
      sh.influence || '-',
    ]);

    sections.push({
      title: 'Stakeholder',
      type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'Interesse', 'Einfluss'],
        rows: stakeholderRows,
      },
    });
  }

  // Section: AI Analysis (if available)
  if (projektauftrag.gesamtbewertung) {
    const gb = projektauftrag.gesamtbewertung;
    let analysisText = '';

    if (gb.summary) {
      analysisText += `Zusammenfassung:\n${gb.summary}\n\n`;
    }
    if (gb.strengths?.length > 0) {
      analysisText += `Stärken:\n${gb.strengths.map((s: string) => `- ${s}`).join('\n')}\n\n`;
    }
    if (gb.weaknesses?.length > 0) {
      analysisText += `Verbesserungspotential:\n${gb.weaknesses.map((w: string) => `- ${w}`).join('\n')}\n\n`;
    }
    if (gb.recommendations?.length > 0) {
      analysisText += `Empfehlungen:\n${gb.recommendations.map((r: string) => `- ${r}`).join('\n')}`;
    }

    if (analysisText) {
      sections.push({
        title: 'KI-Analyse (Gesamtbewertung)',
        type: 'text',
        content: analysisText,
      });
    }
  }

  return {
    title: `Projektauftrag: ${projektauftrag.name || 'Unbenannt'}`,
    metadata: {
      Erstellt: new Date().toLocaleDateString('de-DE'),
      Projektleiter: projektauftrag.projektleiter || '-',
      Status: getStatusLabel(projektauftrag.status),
    },
    sections,
  };
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
    pending: 'Ausstehend',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
  };
  return statuses[status] || status || '-';
}

function formatDateRange(start: string, end: string): string {
  if (!start && !end) return '-';
  if (!start) return `bis ${end}`;
  if (!end) return `ab ${start}`;
  return `${start} - ${end}`;
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
