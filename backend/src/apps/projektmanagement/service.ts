/**
 * Projektmanagement Service
 * Business logic for Projektauftrag management
 */

import type {
  Projektauftrag,
  ProjektauftragFilters,
  ProjektauftragStats,
  Vorlage,
  Task,
  Milestone,
  BudgetItem,
  Risk,
  TeamMember,
  Stakeholder,
} from './types';
import {
  getProjektauftraege,
  getProjektauftrag,
  saveProjektauftrag,
  updateProjektauftrag as updateProjektauftragStorage,
  deleteProjektauftrag as deleteProjektauftragStorage,
  generateProjektauftragId,
  getVorlagen,
  getVorlage,
  initializeStorage,
} from './storage';
import { defaultOwnerPermissions } from './permissions';

// ============== Projektauftrag CRUD ==============

/**
 * Create a new Projektauftrag
 */
export async function createProjektauftrag(
  data: Partial<Projektauftrag>,
  userId: string
): Promise<Projektauftrag> {
  await initializeStorage();

  const now = new Date().toISOString();
  const projektauftrag: Projektauftrag = {
    // Defaults
    name: '',
    project_type: 'internal',
    start_date: '',
    end_date: '',
    projektleiter: '',
    auftraggeber: '',
    goals: '',
    criteria: [],
    scope: '',
    in_scope: [],
    out_scope: [],
    tasks: [],
    milestones: [],
    budget: [],
    risks: [],
    organization: [],
    stakeholders: [],
    status: 'draft',
    current_step: 1,
    // Apply provided data
    ...data,
    // Ensure these are not overwritten by data
    id: data.id || generateProjektauftragId(),
    created_at: now,
    updated_at: now,
    created_by: userId,
    // Default-Permissions: Ersteller ist explizit Owner. Caller kann via
    // `data.permissions` ueberschreiben (z.B. bei Imports mit eigener
    // Permission-Map). null bleibt erlaubt — wird vom Resolver via
    // `created_by`-Fallback gehandhabt.
    permissions: data.permissions !== undefined ? data.permissions : defaultOwnerPermissions(userId),
  };

  await saveProjektauftrag(projektauftrag);
  return projektauftrag;
}

/**
 * Create Projektauftrag from Vorlage
 */
export async function createFromVorlage(
  vorlageId: string,
  userId: string
): Promise<Projektauftrag | null> {
  const vorlage = await getVorlage(vorlageId);
  if (!vorlage) {
    return null;
  }

  return createProjektauftrag(vorlage.template, userId);
}

/**
 * List Projektauftraege with optional filtering
 */
export async function listProjektauftraege(
  filters?: ProjektauftragFilters
): Promise<Projektauftrag[]> {
  let projektauftraege = await getProjektauftraege();

  if (!filters) {
    return projektauftraege;
  }

  // Apply filters
  if (filters.status) {
    projektauftraege = projektauftraege.filter((p) => p.status === filters.status);
  }

  if (filters.project_type) {
    projektauftraege = projektauftraege.filter((p) => p.project_type === filters.project_type);
  }

  if (filters.projektleiter) {
    const search = filters.projektleiter.toLowerCase();
    projektauftraege = projektauftraege.filter((p) =>
      p.projektleiter.toLowerCase().includes(search)
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    projektauftraege = projektauftraege.filter((p) =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm) ||
      p.projektleiter.toLowerCase().includes(searchTerm) ||
      p.auftraggeber.toLowerCase().includes(searchTerm)
    );
  }

  if (filters.from_date) {
    const fromDate = new Date(filters.from_date);
    projektauftraege = projektauftraege.filter((p) =>
      new Date(p.start_date) >= fromDate
    );
  }

  if (filters.to_date) {
    const toDate = new Date(filters.to_date);
    projektauftraege = projektauftraege.filter((p) =>
      new Date(p.end_date) <= toDate
    );
  }

  return projektauftraege;
}

/**
 * Get Projektauftrag details
 */
export async function getProjektauftragDetails(
  projektId: string
): Promise<Projektauftrag | null> {
  return getProjektauftrag(projektId);
}

/**
 * Update Projektauftrag
 */
export async function updateProjektauftrag(
  projektId: string,
  updates: Partial<Projektauftrag>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektauftrag | null> {
  return updateProjektauftragStorage(projektId, updates, options);
}

/**
 * Update specific step of Projektauftrag
 */
export async function updateProjektauftragStep(
  projektId: string,
  step: number,
  data: Partial<Projektauftrag>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektauftrag | null> {
  const existing = await getProjektauftrag(projektId);
  if (!existing) {
    return null;
  }

  // Update current_step if moving forward
  const current_step = Math.max(existing.current_step, step);

  return updateProjektauftragStorage(projektId, {
    ...data,
    current_step,
  }, options);
}

/**
 * Delete Projektauftrag
 */
export async function removeProjektauftrag(projektId: string): Promise<boolean> {
  return deleteProjektauftragStorage(projektId);
}

// ============== Statistics ==============

/**
 * Get Projektauftrag statistics. Optional ein vorgefiltertes Set (z.B. nur
 * berechtigte Auftraege fuer den eingeloggten User).
 */
export async function getProjektauftragStats(scope?: Projektauftrag[]): Promise<ProjektauftragStats> {
  const projektauftraege = scope ?? await getProjektauftraege();

  const stats: ProjektauftragStats = {
    total: projektauftraege.length,
    draft: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    total_budget: 0,
    avg_risk_score: 0,
  };

  let riskScoreSum = 0;
  let riskScoreCount = 0;

  for (const p of projektauftraege) {
    // Status counts
    switch (p.status) {
      case 'draft':
        stats.draft++;
        break;
      case 'active':
        stats.active++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
    }

    // Budget sum
    if (p.budget) {
      stats.total_budget += p.budget.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    // Risk score
    if (p.analysis?.risk_score !== undefined) {
      riskScoreSum += p.analysis.risk_score;
      riskScoreCount++;
    }
  }

  stats.avg_risk_score = riskScoreCount > 0 ? Math.round(riskScoreSum / riskScoreCount) : 0;

  return stats;
}

// ============== Search ==============

/**
 * Search Projektauftraege
 */
export async function searchProjektauftraege(
  query: string
): Promise<Projektauftrag[]> {
  const projektauftraege = await getProjektauftraege();
  const searchTerm = query.toLowerCase();

  return projektauftraege.filter((p) => {
    const searchableText = [
      p.name,
      p.description || '',
      p.projektleiter,
      p.auftraggeber,
      p.goals,
      p.scope,
      ...p.criteria,
      ...p.in_scope,
      ...p.out_scope,
      ...p.tasks.map((t) => t.name),
      ...p.milestones.map((m) => m.name),
      ...p.organization.map((o) => `${o.name} ${o.role}`),
      ...p.stakeholders.map((s) => `${s.name} ${s.role}`),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchTerm);
  });
}

// ============== Validation ==============

/**
 * Validate Projektauftrag step
 */
export function validateStep(
  projektauftrag: Projektauftrag,
  step: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (step) {
    case 1: // Basis
      if (!projektauftrag.name?.trim()) errors.push('Projektname ist erforderlich');
      if (!projektauftrag.projektleiter?.trim()) errors.push('Projektleiter ist erforderlich');
      if (!projektauftrag.auftraggeber?.trim()) errors.push('Auftraggeber ist erforderlich');
      if (!projektauftrag.start_date) errors.push('Startdatum ist erforderlich');
      break;

    case 2: // Ziele
      if (!projektauftrag.goals?.trim()) errors.push('Projektziele sind erforderlich');
      if (!projektauftrag.criteria?.length) errors.push('Mindestens ein Erfolgskriterium ist erforderlich');
      break;

    case 3: // Umfang
      if (!projektauftrag.scope?.trim()) errors.push('Projektumfang ist erforderlich');
      break;

    case 4: // Aufgaben
      if (!projektauftrag.tasks?.length) errors.push('Mindestens eine Aufgabe ist erforderlich');
      break;

    case 5: // Meilensteine
      if (!projektauftrag.milestones?.length) errors.push('Mindestens ein Meilenstein ist erforderlich');
      break;

    case 6: // Budget & Risiken
      // Budget and risks are optional but recommended
      break;

    case 7: // Organisation
      if (!projektauftrag.organization?.length) errors.push('Mindestens ein Teammitglied ist erforderlich');
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate completeness percentage
 */
export function calculateCompleteness(projektauftrag: Projektauftrag): number {
  const checks = [
    !!projektauftrag.name,
    !!projektauftrag.projektleiter,
    !!projektauftrag.auftraggeber,
    !!projektauftrag.start_date,
    !!projektauftrag.goals,
    projektauftrag.criteria?.length > 0,
    !!projektauftrag.scope,
    projektauftrag.tasks?.length > 0,
    projektauftrag.milestones?.length > 0,
    projektauftrag.budget?.length > 0,
    projektauftrag.risks?.length > 0,
    projektauftrag.organization?.length > 0,
    projektauftrag.stakeholders?.length > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

// ============== Vorlagen ==============

/**
 * List available Vorlagen
 */
export async function listVorlagen(): Promise<Vorlage[]> {
  return getVorlagen();
}

/**
 * Get specific Vorlage
 */
export async function getVorlageDetails(vorlageId: string): Promise<Vorlage | null> {
  return getVorlage(vorlageId);
}

// ============== Helper Functions ==============

/**
 * Generate unique ID for sub-entities
 */
export function generateSubEntityId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Create empty Task
 */
export function createEmptyTask(): Task {
  return {
    id: generateSubEntityId(),
    name: '',
    responsible: '',
    start_date: '',
    end_date: '',
    effort: 0,
    status: 'open',
  };
}

/**
 * Create empty Milestone
 */
export function createEmptyMilestone(): Milestone {
  return {
    id: generateSubEntityId(),
    name: '',
    date: '',
  };
}

/**
 * Create empty BudgetItem
 */
export function createEmptyBudgetItem(): BudgetItem {
  return {
    id: generateSubEntityId(),
    item: '',
    amount: 0,
  };
}

/**
 * Create empty Risk
 */
export function createEmptyRisk(): Risk {
  return {
    id: generateSubEntityId(),
    type: '',
    description: '',
    probability: 'medium',
    impact: 'medium',
    mitigation: '',
  };
}

/**
 * Create empty TeamMember
 */
export function createEmptyTeamMember(): TeamMember {
  return {
    id: generateSubEntityId(),
    name: '',
    role: '',
  };
}

/**
 * Create empty Stakeholder
 */
export function createEmptyStakeholder(): Stakeholder {
  return {
    id: generateSubEntityId(),
    name: '',
    role: '',
    interest: 'medium',
    influence: 'medium',
  };
}

// ============== Re-exports ==============

export { getProjektauftraege, getProjektauftrag, getVorlagen, getVorlage } from './storage';
