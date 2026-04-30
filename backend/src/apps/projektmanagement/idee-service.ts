/**
 * Projektidee Service — Business-Logik.
 *
 * Erzeugen / Aktualisieren / Loeschen von Ideen sowie Konvertierung
 * Idee → Projektauftrag (Vorbelegung der gemeinsamen Felder).
 */

import {
  generateProjektideeId,
  getProjektideen,
  getProjektidee,
  saveProjektidee,
  updateProjektidee as storageUpdate,
  deleteProjektidee,
} from './idee-storage';
import { generateProjektauftragId, saveProjektauftrag, getProjektauftrag } from './storage';
import type { Projektidee, BusinessCaseItem, Projektauftrag, Risk } from './types';

export function generateSubEntityId(prefix = 'item'): string {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${ts}-${r}`;
}

function emptyIdee(): Omit<Projektidee, 'id' | 'created_at' | 'updated_at' | 'created_by'> {
  return {
    name: '',
    status: 'draft',
    goals: '',
    context: { ausgangslage: '', rahmenbedingungen: '' },
    in_scope: [],
    out_scope: [],
    business_case: { investitionen: [], nutzen: [] },
    unternehmensrisiken: [],
    current_step: 1,
  };
}

export async function listIdeen(): Promise<Projektidee[]> {
  return getProjektideen();
}

export async function getIdeeDetails(id: string): Promise<Projektidee | null> {
  return getProjektidee(id);
}

export async function createIdee(
  payload: Partial<Projektidee>,
  userId: string,
): Promise<Projektidee> {
  const id = generateProjektideeId();
  const now = new Date().toISOString();
  const idee: Projektidee = {
    ...emptyIdee(),
    ...payload,
    id,
    created_at: now,
    updated_at: now,
    created_by: userId,
  };
  await saveProjektidee(idee);
  const stored = await getProjektidee(id);
  return stored!;
}

export async function updateIdee(
  id: string,
  updates: Partial<Projektidee>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektidee | null> {
  return storageUpdate(id, updates, options);
}

/**
 * Speichert nur die Felder eines bestimmten Wizard-Steps. Restliche Felder
 * bleiben unangetastet. Spiegelt updateProjektauftragStep aus dem Auftrag-Service.
 */
export async function updateIdeeStep(
  id: string,
  step: number,
  partial: Partial<Projektidee>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektidee | null> {
  return storageUpdate(id, { ...partial, current_step: step }, options);
}

export async function removeIdee(id: string): Promise<boolean> {
  return deleteProjektidee(id);
}

// ============== Idee -> Auftrag-Konvertierung ==============

/**
 * Erzeugt einen Projektauftrag aus einer Idee mit Vor-Mapping. Die Idee bleibt
 * unangetastet — das ist Absicht: der Auftrag soll sich von der Hypothese
 * loesen koennen.
 *
 * Mapping:
 * - Stammdaten (name, project_type, Datums, projektleiter, auftraggeber, description, goals)
 *   werden 1:1 uebernommen.
 * - Business Case Investitionen + Nutzen werden zu BudgetItem zusammengefasst:
 *   Investitionen mit positivem Betrag (sind ja Kosten), Nutzen mit negativem
 *   Betrag (sind Ertraege; im Auftrag-Budget bedeuten negative Werte
 *   einnahmenseite). Der ROI bleibt damit nachrechenbar.
 * - Unternehmensrisiken werden zu Projektrisiken (gleiche Struktur).
 * - in_scope/out_scope werden 1:1 uebernommen (gleiche Struktur in beiden Modellen).
 * - Tasks/Meilensteine/Stakeholder/Organisation/criteria bleiben leer — diese
 *   werden im Auftrag-Wizard ausgearbeitet.
 *
 * Der Auftrag bekommt `ideeId = idee.id` damit die Verknuepfung sichtbar bleibt.
 */
export async function createAuftragFromIdee(
  ideeId: string,
  userId: string,
): Promise<Projektauftrag | null> {
  const idee = await getProjektidee(ideeId);
  if (!idee) return null;

  const now = new Date().toISOString();
  const auftragId = generateProjektauftragId();

  const budget = [
    ...idee.business_case.investitionen.map((it) => mapToBudgetItem(it, 'Investition', it.betrag)),
    ...idee.business_case.nutzen.map((it) => mapToBudgetItem(it, 'Nutzen', -it.betrag)),
  ];

  const auftrag: Projektauftrag = {
    id: auftragId,
    name: idee.name,
    project_type: (idee.project_type as Projektauftrag['project_type']) ?? 'internal',
    start_date: idee.start_date ?? '',
    end_date: idee.end_date ?? '',
    projektleiter: idee.projektleiter ?? '',
    auftraggeber: idee.auftraggeber ?? '',
    description: idee.description,
    goals: idee.goals,
    criteria: [],
    scope: '',
    in_scope: idee.in_scope ?? [],
    out_scope: idee.out_scope ?? [],
    tasks: [],
    milestones: [],
    budget,
    risks: idee.unternehmensrisiken.map((r): Risk => ({ ...r, id: generateSubEntityId('risk') })),
    organization: [],
    stakeholders: [],
    created_at: now,
    updated_at: now,
    created_by: userId,
    status: 'draft',
    current_step: 1,
  };

  // saveProjektauftrag uebernimmt das jsonb-Schreiben — die ideeId-Spalte muss
  // separat gesetzt werden, da sie ausserhalb des `data`-Blobs liegt.
  await saveProjektauftrag(auftrag);
  await setAuftragIdeeId(auftragId, ideeId);

  return getProjektauftrag(auftragId);
}

function mapToBudgetItem(
  bc: BusinessCaseItem,
  category: 'Investition' | 'Nutzen',
  amount: number,
) {
  return {
    id: generateSubEntityId('budget'),
    item: bc.beschreibung,
    provider: bc.anbieter,
    amount,
    category,
  };
}

async function setAuftragIdeeId(auftragId: string, ideeId: string): Promise<void> {
  const { eq } = await import('drizzle-orm');
  const { paProjektauftraege } = await import('../../db/schema/projektmgmt');
  const { getDb } = await import('../../db');
  await getDb().update(paProjektauftraege).set({ ideeId }).where(eq(paProjektauftraege.id, auftragId));
}
