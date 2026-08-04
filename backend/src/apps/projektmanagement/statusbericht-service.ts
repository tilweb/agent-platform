/**
 * Statusbericht Service
 * Business logic for Statusberichte
 */

import type {
  Statusbericht,
  StatusberichtDashboardEntry,
  CriterionTracking,
  RoadmapItemTracking,
  QualityGateSnapshot,
  MilestoneSnapshot,
  TaskSnapshot,
  CostMonthData,
  RiskTrackingItem,
} from './types';
import { withLock, checkVersion } from './concurrency';
import {
  getProjektauftrag,
  getProjektauftraege,
  getStatusberichte,
  getStatusbericht,
  saveStatusbericht,
  deleteStatusbericht,
  generateStatusberichtId,
} from './storage';

// Default tracking values
const defaultCriterionTracking = (): CriterionTracking => ({
  fortschritt: 0, ampel: 'gruen' as const, bemerkung: '',
});

const defaultRoadmapTracking = (): RoadmapItemTracking => ({
  fortschritt: 0, ampel: 'gruen' as const, bemerkung: '', status: 'planned', ist_datum: '',
});

/**
 * Pre-fill helper: copy from last bericht or use default
 */
function prefillCriterionArray(count: number, lastTracking?: CriterionTracking[]): CriterionTracking[] {
  return Array.from({ length: count }, (_, i) => {
    const prev = lastTracking?.[i];
    return prev
      ? { fortschritt: prev.fortschritt, ampel: prev.ampel, bemerkung: prev.bemerkung }
      : defaultCriterionTracking();
  });
}

function prefillRoadmapArray(count: number, lastTracking?: RoadmapItemTracking[]): RoadmapItemTracking[] {
  return Array.from({ length: count }, (_, i) => {
    const prev = lastTracking?.[i];
    return prev
      ? { fortschritt: prev.fortschritt, ampel: prev.ampel, bemerkung: prev.bemerkung, status: prev.status || 'planned', ist_datum: prev.ist_datum || '' }
      : defaultRoadmapTracking();
  });
}

/**
 * Generate month keys (YYYY-MM) from project start to end
 */
function generateMonthKeys(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

const defaultCostMonth = (month: string): CostMonthData => ({
  month, plan: 0, ist: 0, forecast: 0,
});

function prefillCostMonths(months: string[], budget: number, lastCostMonths?: CostMonthData[]): CostMonthData[] {
  const lastByMonth = new Map<string, CostMonthData>();
  if (lastCostMonths) {
    for (const cm of lastCostMonths) lastByMonth.set(cm.month, cm);
  }
  // Erster Bericht: Plan = Budget / Anzahl Monate (gleichverteilt)
  const defaultPlan = months.length > 0 ? Math.round(budget / months.length) : 0;
  return months.map((m) => {
    const prev = lastByMonth.get(m);
    return prev
      ? { month: m, plan: prev.plan, ist: prev.ist, forecast: prev.forecast }
      : { ...defaultCostMonth(m), plan: defaultPlan };
  });
}

/**
 * Create a new Statusbericht for a Projekt
 */
export async function createStatusbericht(projektId: string, userId: string): Promise<Statusbericht> {
  const auftrag = await getProjektauftrag(projektId);
  if (!auftrag) {
    throw new Error('Projektauftrag nicht gefunden');
  }

  const existing = await getStatusberichte(projektId);
  const nummer = existing.length + 1;
  const last = existing.length > 0 ? existing[existing.length - 1] : null;

  // === Tab: Ziele ===
  const goalsSnapshot = auftrag.goals || '';
  const criteriaSnapshot = auftrag.criteria || [];

  const goalsTracking: CriterionTracking = last?.goals_tracking
    ? { fortschritt: last.goals_tracking.fortschritt, ampel: last.goals_tracking.ampel, bemerkung: last.goals_tracking.bemerkung }
    : defaultCriterionTracking();

  const criteriaTracking = prefillCriterionArray(criteriaSnapshot.length, last?.criteria_tracking);

  // === Tab: Roadmap ===
  const rawMilestones = auftrag.milestones || [];
  const milestonesSnapshot: MilestoneSnapshot[] = rawMilestones.map((m: any) => ({
    id: m.id, name: m.name, date: m.date || '', description: m.description || '',
  }));

  const rawTasks = auftrag.tasks || [];
  const tasksSnapshot: TaskSnapshot[] = rawTasks.map((t: any) => ({
    id: t.id, name: t.name, responsible: t.responsible || '', start_date: t.start_date || '', end_date: t.end_date || '', effort: t.effort || 0,
  }));

  const rawGates = (auftrag as any).quality_gates || [];
  const qualityGatesSnapshot: QualityGateSnapshot[] = rawGates.map((g: any) => ({
    id: g.id, name: g.name, date: g.date || '',
  }));

  const milestonesTracking = prefillRoadmapArray(milestonesSnapshot.length, last?.milestones_tracking);
  const tasksTracking = prefillRoadmapArray(tasksSnapshot.length, last?.tasks_tracking);
  const qualityGatesTracking = prefillRoadmapArray(qualityGatesSnapshot.length, last?.quality_gates_tracking as RoadmapItemTracking[] | undefined);

  // === Tab: Kosten (EVM) ===
  const budgetItems = auftrag.budget || [];
  const costBudget = last?.cost_budget ?? budgetItems.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
  const monthKeys = generateMonthKeys(auftrag.start_date, auftrag.end_date);
  const costMonths = prefillCostMonths(monthKeys, costBudget, last?.cost_months);

  const now = new Date().toISOString();
  const today = now.split('T')[0] ?? '';

  // === Tab: Risiken ===
  let riskTracking: RiskTrackingItem[];
  if (last?.risk_tracking && last.risk_tracking.length > 0) {
    riskTracking = last.risk_tracking.map((r: RiskTrackingItem) => ({ ...r }));
  } else {
    const auftragRisks = auftrag.risks || [];
    riskTracking = auftragRisks.map((r: any, i: number) => {
      const ampel = (r.probability === 'high' && r.impact === 'high') ? 'rot' as const
        : (r.probability === 'high' || r.impact === 'high') ? 'gelb' as const
        : 'gruen' as const;
      const riskType = (r.nature === 'chance') ? 'chance' as const : 'bedrohung' as const;
      return {
        id: `rt-${i}-${Math.random().toString(36).substring(2, 6)}`,
        auftrag_risk_id: r.id || '',
        type: riskType,
        strategie: '',
        status: 'identifiziert',
        verantwortlich: '',
        erkannt: today,
        aktualisiert: today,
        erwartet_bis: '',
        ampel,
        beschreibung: r.description || '',
        auswirkung: '',
        massnahmen: r.mitigation || '',
        wahrscheinlichkeit: r.probability || '',
        auswirkung_bewertung: r.impact || '',
      };
    });
  }
  // Personen-Snapshot + Tracking (Tracking aus letztem Bericht uebernehmen).
  const organizationSnapshot = auftrag.organization || [];
  const stakeholdersSnapshot = auftrag.stakeholders || [];
  const defaultPersonTracking = { status: 'unveraendert', bemerkung: '' };
  const organizationTracking = organizationSnapshot.map((_: any, i: number) =>
    last?.organization_tracking?.[i] ? { ...last.organization_tracking[i] } : { ...defaultPersonTracking });
  const stakeholdersTracking = stakeholdersSnapshot.map((_: any, i: number) =>
    last?.stakeholders_tracking?.[i] ? { ...last.stakeholders_tracking[i] } : { ...defaultPersonTracking });

  const sb: Statusbericht = {
    id: generateStatusberichtId(),
    projekt_id: projektId,
    nummer,
    ampel: 'gruen',
    datum: now.split('T')[0] ?? '',
    management_summary: '',
    goals_snapshot: goalsSnapshot,
    goals_tracking: goalsTracking,
    criteria_snapshot: criteriaSnapshot,
    criteria_tracking: criteriaTracking,
    milestones_snapshot: milestonesSnapshot,
    milestones_tracking: milestonesTracking,
    tasks_snapshot: tasksSnapshot,
    tasks_tracking: tasksTracking,
    quality_gates_snapshot: qualityGatesSnapshot,
    quality_gates_tracking: qualityGatesTracking,
    cost_budget: costBudget,
    cost_months: costMonths,
    risk_tracking: riskTracking,
    organization_snapshot: organizationSnapshot,
    stakeholders_snapshot: stakeholdersSnapshot,
    organization_tracking: organizationTracking,
    stakeholders_tracking: stakeholdersTracking,
    status: 'draft',
    created_at: now,
    updated_at: now,
    created_by: userId,
  };

  await saveStatusbericht(projektId, sb);
  return sb;
}

/**
 * List all Statusberichte for a Projekt, sorted by nummer desc
 */
export async function listStatusberichte(projektId: string): Promise<Statusbericht[]> {
  const berichte = await getStatusberichte(projektId);
  return berichte.reverse();
}

/**
 * Get a single Statusbericht with details
 */
export async function getStatusberichtDetails(projektId: string, sbId: string): Promise<Statusbericht | null> {
  return getStatusbericht(projektId, sbId);
}

/**
 * Update a Statusbericht (partial update mit Optimistic-Concurrency).
 * Wirft VersionConflictError wenn expectedVersion gesetzt + nicht passend.
 */
export async function updateStatusbericht(
  projektId: string,
  sbId: string,
  updates: Partial<Statusbericht>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Statusbericht | null> {
  return withLock(`sb:${projektId}:${sbId}`, async () => {
    const existing = await getStatusbericht(projektId, sbId);
    if (!existing) {
      return null;
    }
    if (existing.version === undefined) existing.version = 1;
    checkVersion(existing, options.expectedVersion, options.force ?? false);

    const updated: Statusbericht = {
      ...existing,
      ...updates,
      id: sbId,
      projekt_id: projektId,
      updated_at: new Date().toISOString(),
      version: (existing.version ?? 1) + 1,
    };

    await saveStatusbericht(projektId, updated);
    return updated;
  });
}

/**
 * Remove a Statusbericht (only draft)
 */
export async function removeStatusbericht(projektId: string, sbId: string): Promise<boolean> {
  const sb = await getStatusbericht(projektId, sbId);
  if (!sb) {
    return false;
  }
  if (sb.status !== 'draft') {
    throw new Error('Nur Entwurfs-Berichte können gelöscht werden');
  }
  return deleteStatusbericht(projektId, sbId);
}

/**
 * Dashboard: All active projects with their latest Statusbericht
 */
export async function getDashboard(): Promise<StatusberichtDashboardEntry[]> {
  const allProjekte = await getProjektauftraege();
  const entries: StatusberichtDashboardEntry[] = [];

  for (const projekt of allProjekte) {
    if (projekt.status !== 'active') continue;

    const berichte = await getStatusberichte(projekt.id);
    if (berichte.length === 0) continue;

    const latest = berichte[berichte.length - 1]!;
    entries.push({
      projekt_id: projekt.id,
      projekt_name: projekt.name,
      projektleiter: projekt.projektleiter,
      project_type: projekt.project_type,
      latest_ampel: latest.ampel,
      latest_datum: latest.datum,
      latest_nummer: latest.nummer,
      bericht_count: berichte.length,
    });
  }

  return entries;
}
