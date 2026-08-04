/**
 * Projektmanagement Storage Service
 * File-based storage for Projektauftraege
 */

import { parse, stringify } from 'yaml';
import type { Projektauftrag, Vorlage, Statusbericht } from './types';
import { withLock, checkVersion } from './concurrency';

const BASE_PATH = './data/apps/projektmanagement';
const PROJEKTAUFTRAEGE_PATH = `${BASE_PATH}/projektauftraege`;
const VORLAGEN_PATH = `${BASE_PATH}/vorlagen`;

// ============== Projektauftrag Storage ==============

/**
 * Generate a unique Projektauftrag ID
 */
export function generateProjektauftragId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `projekt-${timestamp}-${random}`;
}

/**
 * Ensure directories exist
 */
async function ensureDirectories(): Promise<void> {
  await Bun.$`mkdir -p ${PROJEKTAUFTRAEGE_PATH}`;
  await Bun.$`mkdir -p ${VORLAGEN_PATH}`;
}

/**
 * Optionen fuer `getProjektauftraege` — Pagination + DB-aequivalentes Filtern.
 *
 * In der YAML-Variante muessen wir alle Files lesen (Glob), dann sortieren,
 * dann slicen. Bei kleiner Demo-Datenmenge unkritisch. Die API bleibt
 * identisch zur main-Variante (Postgres), damit Route-Handler 1:1 portierbar
 * sind.
 *
 * Permission-Filter laeuft NACH dem Read in routes.ts — fuer Nicht-App-Owner
 * koennen Seiten daher sparser sein als `limit` suggeriert.
 */
export interface GetProjektauftraegeOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export const MAX_PROJEKTAUFTRAEGE_LIMIT = 1000;

export async function getProjektauftraege(
  options: GetProjektauftraegeOptions = {},
): Promise<Projektauftrag[]> {
  const projektauftraege: Projektauftrag[] = [];

  try {
    const glob = new Bun.Glob('*/metadata.yaml');

    for await (const path of glob.scan(PROJEKTAUFTRAEGE_PATH)) {
      const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const projektauftrag = parse(content) as Projektauftrag;
        if (options.status && projektauftrag.status !== options.status) continue;
        projektauftraege.push(projektauftrag);
      }
    }
  } catch (error) {
    console.log('No Projektauftraege found, returning empty list');
  }

  // Sort by updated_at, newest first
  projektauftraege.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // Pagination ist opt-in: ohne `limit` werden alle Rows zurueckgegeben
  // (Stats + interne Aufrufer). Routen, die paginieren, setzen `limit` explizit.
  if (options.limit !== undefined) {
    const limit = Math.min(Math.max(1, options.limit), MAX_PROJEKTAUFTRAEGE_LIMIT);
    const offset = Math.max(0, options.offset ?? 0);
    return projektauftraege.slice(offset, offset + limit);
  }
  return projektauftraege;
}

/**
 * Get a specific Projektauftrag by ID
 */
export async function getProjektauftrag(projektId: string): Promise<Projektauftrag | null> {
  const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${projektId}/metadata.yaml`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const auftrag = parse(content) as Projektauftrag;
  // Backward-Compat: ältere Datensätze ohne version bekommen 1.
  if (auftrag.version === undefined) auftrag.version = 1;

  // Idee-Referenz anreichern (Pendant zum Drizzle-JOIN auf main):
  // idee_id steht in der Auftrag-YAML, idee.name lesen wir aus der Idee-YAML.
  if (auftrag.idee_id) {
    const ideeFile = Bun.file(`${BASE_PATH}/projektideen/${auftrag.idee_id}/metadata.yaml`);
    if (await ideeFile.exists()) {
      const idee = parse(await ideeFile.text()) as { id: string; name: string };
      auftrag.idee = { id: idee.id, name: idee.name };
    }
  }

  return auftrag;
}

/**
 * Save a Projektauftrag
 */
export async function saveProjektauftrag(projektauftrag: Projektauftrag): Promise<void> {
  const dir = `${PROJEKTAUFTRAEGE_PATH}/${projektauftrag.id}`;

  // Ensure directory exists
  await Bun.$`mkdir -p ${dir}`;

  // `idee` wird beim Read angereichert — nicht persistieren.
  const { idee: _ignore, ...dataToStore } = projektauftrag;
  void _ignore;
  // version sicherstellen (Initial-Save: 1).
  if (dataToStore.version === undefined) dataToStore.version = 1;
  await Bun.write(`${dir}/metadata.yaml`, stringify(dataToStore));
}

/**
 * Update a Projektauftrag — mit optionalem Optimistic-Concurrency-Check.
 * Wirft VersionConflictError wenn expectedVersion gesetzt ist und nicht passt.
 */
export async function updateProjektauftrag(
  projektId: string,
  updates: Partial<Projektauftrag>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektauftrag | null> {
  return withLock(`auftrag:${projektId}`, async () => {
    const existing = await getProjektauftrag(projektId);
    if (!existing) return null;
    checkVersion(existing, options.expectedVersion, options.force ?? false);
    const updated: Projektauftrag = {
      ...existing,
      ...updates,
      id: projektId,
      updated_at: new Date().toISOString(),
      version: (existing.version ?? 1) + 1,
    };
    await saveProjektauftrag(updated);
    return updated;
  });
}

/**
 * Delete a Projektauftrag
 */
export async function deleteProjektauftrag(projektId: string): Promise<boolean> {
  const dir = `${PROJEKTAUFTRAEGE_PATH}/${projektId}`;
  const metadataFile = Bun.file(`${dir}/metadata.yaml`);

  if (!(await metadataFile.exists())) {
    return false;
  }

  // Remove entire directory
  await Bun.$`rm -rf ${dir}`;
  return true;
}

// ============== Statusbericht Storage ==============

/**
 * Generate a unique Statusbericht ID
 */
export function generateStatusberichtId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sb-${timestamp}-${random}`;
}

/**
 * Get all Statusberichte for a Projekt, sorted by nummer
 */
export async function getStatusberichte(projektId: string): Promise<Statusbericht[]> {
  const dir = `${PROJEKTAUFTRAEGE_PATH}/${projektId}/statusberichte`;
  const berichte: Statusbericht[] = [];

  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(dir)) {
      const file = Bun.file(`${dir}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const bericht = parse(content) as Statusbericht;
        berichte.push(bericht);
      }
    }
  } catch {
    // No statusberichte directory yet
  }

  berichte.sort((a, b) => a.nummer - b.nummer);
  return berichte;
}

/**
 * Get a single Statusbericht
 */
export async function getStatusbericht(projektId: string, sbId: string): Promise<Statusbericht | null> {
  const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${projektId}/statusberichte/${sbId}.yaml`);
  if (!(await file.exists())) {
    return null;
  }
  const content = await file.text();
  return parse(content) as Statusbericht;
}

/**
 * Save a Statusbericht (create or update)
 */
export async function saveStatusbericht(projektId: string, sb: Statusbericht): Promise<void> {
  const dir = `${PROJEKTAUFTRAEGE_PATH}/${projektId}/statusberichte`;
  await Bun.$`mkdir -p ${dir}`;
  await Bun.write(`${dir}/${sb.id}.yaml`, stringify(sb));
}

/**
 * Delete a Statusbericht
 */
export async function deleteStatusbericht(projektId: string, sbId: string): Promise<boolean> {
  const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${projektId}/statusberichte/${sbId}.yaml`);
  if (!(await file.exists())) {
    return false;
  }
  await Bun.$`rm -f ${PROJEKTAUFTRAEGE_PATH}/${projektId}/statusberichte/${sbId}.yaml`;
  return true;
}

// ============== Vorlagen Storage ==============

/**
 * Get all Vorlagen (templates)
 */
export async function getVorlagen(): Promise<Vorlage[]> {
  const vorlagen: Vorlage[] = [];

  try {
    const glob = new Bun.Glob('*.yaml');

    for await (const path of glob.scan(VORLAGEN_PATH)) {
      const file = Bun.file(`${VORLAGEN_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const vorlage = parse(content) as Vorlage;
        vorlagen.push(vorlage);
      }
    }
  } catch (error) {
    console.log('No Vorlagen found, returning empty list');
  }

  return vorlagen;
}

/**
 * Get a specific Vorlage by ID
 */
export async function getVorlage(vorlageId: string): Promise<Vorlage | null> {
  const file = Bun.file(`${VORLAGEN_PATH}/${vorlageId}.yaml`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parse(content) as Vorlage;
}

/**
 * Save a Vorlage
 */
export async function saveVorlage(vorlage: Vorlage): Promise<void> {
  await ensureDirectories();
  await Bun.write(`${VORLAGEN_PATH}/${vorlage.id}.yaml`, stringify(vorlage));
}

/**
 * Delete a Vorlage
 */
export async function deleteVorlage(vorlageId: string): Promise<boolean> {
  const file = Bun.file(`${VORLAGEN_PATH}/${vorlageId}.yaml`);

  if (!(await file.exists())) {
    return false;
  }

  await Bun.$`rm -f ${VORLAGEN_PATH}/${vorlageId}.yaml`;
  return true;
}

// ============== Config Storage ==============

const CONFIG_PATH = `${BASE_PATH}/config.json`;

const DEFAULT_CONFIG = {
  project_type: [
    { value: 'internal', label: 'Internes Projekt' },
    { value: 'external', label: 'Externes Projekt' },
    { value: 'research', label: 'Forschungsprojekt' },
    { value: 'infrastructure', label: 'Infrastrukturprojekt' },
  ],
  project_size: [
    { value: 'small', label: 'Klein' },
    { value: 'medium', label: 'Mittel' },
    { value: 'large', label: 'Groß' },
  ],
  priority: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
    { value: 'critical', label: 'Kritisch' },
  ],
  project_driver: [
    { value: 'strategic', label: 'Strategisch' },
    { value: 'legal', label: 'Gesetzlich' },
    { value: 'operational', label: 'Operativ' },
  ],
  project_status: [
    { value: 'initiation', label: 'Initiierung' },
    { value: 'planning', label: 'Planung' },
    { value: 'execution', label: 'Umsetzung' },
    { value: 'closing', label: 'Abschluss' },
    { value: 'stopped', label: 'Gestoppt' },
  ],
  order_status: [
    { value: 'draft', label: 'Entwurf' },
    { value: 'active', label: 'Aktiv' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'cancelled', label: 'Abgebrochen' },
  ],
  // Projektidee-Status. Werte sind semantisch verdrahtet (Badges/Filter in der
  // Ideen-Ansicht) — Labels editierbar, Kern-Werte stabil halten.
  idee_status: [
    { value: 'draft', label: 'Entwurf' },
    { value: 'review', label: 'In Prüfung' },
    { value: 'approved', label: 'Genehmigt' },
    { value: 'rejected', label: 'Abgelehnt' },
    { value: 'archived', label: 'Archiviert' },
  ],
  role: [
    { value: 'projektleiter', label: 'Projektleiter' },
    { value: 'teilprojektleiter', label: 'Teilprojektleiter' },
    { value: 'entwickler', label: 'Entwickler' },
    { value: 'analyst', label: 'Analyst' },
    { value: 'designer', label: 'Designer' },
    { value: 'tester', label: 'Tester' },
    { value: 'berater', label: 'Berater' },
  ],
  member_status: [
    { value: 'intern', label: 'Intern' },
    { value: 'extern', label: 'Extern' },
  ],
  gruppe: [
    { value: 'auftraggeber', label: 'Auftraggeber' },
    { value: 'projektteam', label: 'Projektteam' },
    { value: 'stakeholder', label: 'Stakeholder' },
  ],
  interest: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  influence: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  // Klassifizierungs-Matrix (Interesse×Einfluss): die 4 Quadranten-Texte.
  // Schluessel sind fixiert (Position in der Matrix), nur die Labels sind editierbar.
  stakeholder_quadrants: [
    { value: 'hi_influence_lo_interest', label: 'Ausreichend informieren' },
    { value: 'hi_influence_hi_interest', label: 'Regelmäßig informieren' },
    { value: 'lo_influence_lo_interest', label: 'Gut informieren und einbeziehen' },
    { value: 'lo_influence_hi_interest', label: 'Umfangreich informieren und einbeziehen' },
  ],
  probability: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  impact: [
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ],
  roadmap_status: [
    { value: 'planned', label: 'Geplant' },
    { value: 'in_progress', label: 'In Bearbeitung' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'delayed', label: 'Verzögert' },
    { value: 'blocked', label: 'Blockiert' },
    { value: 'cancelled', label: 'Abgesagt' },
  ],
  risk_strategie: [
    { value: 'B-vermeiden', label: 'B-vermeiden' },
    { value: 'B-uebertragen', label: 'B-übertragen' },
    { value: 'B-mindern', label: 'B-mindern' },
    { value: 'B-akzeptieren', label: 'B-akzeptieren' },
    { value: 'C-nutzen', label: 'C-nutzen' },
    { value: 'C-teilen', label: 'C-teilen' },
    { value: 'C-verbessern', label: 'C-verbessern' },
    { value: 'C-akzeptieren', label: 'C-akzeptieren' },
  ],
  risk_status: [
    { value: 'vorbesetzt', label: 'Vorbesetzt' },
    { value: 'identifiziert', label: 'Identifiziert' },
    { value: 'bewertet', label: 'Bewertet' },
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'vermieden', label: 'Vermieden' },
    { value: 'eingetreten', label: 'Eingetreten' },
  ],
  lesson_themengebiet: [
    { value: 'basis', label: 'Basis' },
    { value: 'stakeholder', label: 'Stakeholder' },
    { value: 'organisation', label: 'Organisation' },
    { value: 'ziele', label: 'Ziele' },
    { value: 'inhalt', label: 'Inhalt' },
    { value: 'roadmap', label: 'Roadmap' },
    { value: 'kosten', label: 'Kosten' },
    { value: 'risiko', label: 'Risiko' },
    { value: 'lessons_learned', label: 'Lessons Learned' },
    { value: 'projektidee', label: 'Projektidee' },
    { value: 'auftragsklaerung', label: 'Auftragsklärung' },
    { value: 'umsetzung', label: 'Umsetzung' },
    { value: 'projektabschluss', label: 'Projektabschluss' },
  ],
  lesson_kategorie: [
    { value: 'strength', label: 'Strength' },
    { value: 'weakness', label: 'Weakness' },
    { value: 'opportunity', label: 'Opportunity' },
    { value: 'threat', label: 'Threat' },
  ],
  // Portfolio-Stammdaten (Portfolio-Detail → Basis-Tab).
  portfolio_type: [
    { value: 'strategic', label: 'Strategisch' },
    { value: 'operational', label: 'Operativ' },
    { value: 'program', label: 'Programm' },
    { value: 'product', label: 'Produkt' },
    { value: 'transformation', label: 'Transformation' },
  ],
  portfolio_driver: [
    { value: 'strategic', label: 'Strategisch' },
    { value: 'legal', label: 'Gesetzlich' },
    { value: 'operational', label: 'Operativ' },
    { value: 'market', label: 'Markt' },
    { value: 'innovation', label: 'Innovation' },
  ],
  // Portfoliostatus. Schlüssel `active`/`archived` sind verdrahtet (Archivierung,
  // Listenfilter, Badges) — nur Anzeigename editierbar.
  portfolio_status: [
    { value: 'vorbereitung', label: 'In Vorbereitung' },
    { value: 'active', label: 'Aktiv' },
    { value: 'pausiert', label: 'Pausiert' },
    { value: 'abgeschlossen', label: 'Abgeschlossen' },
    { value: 'archived', label: 'Archiviert' },
  ],
  // Abschluss-Checkliste: unternehmensspezifische Aufgaben/Rahmenbedingungen,
  // die beim Projektabschluss immer betrachtet werden. In den Einstellungen
  // pflegbar. { id, label } statt { value, label } — id ist der stabile Key.
  abschluss_checkliste: [
    { id: 'doku_archiviert', label: 'Projektdokumentation vollständig abgelegt/archiviert' },
    { id: 'ressourcen_freigegeben', label: 'Personal- und Sachressourcen freigegeben' },
    { id: 'vertraege_geschlossen', label: 'Verträge/Bestellungen abgeschlossen und abgerechnet' },
    { id: 'restbudget_geklaert', label: 'Restbudget / offene Kosten geklärt' },
    { id: 'zugriffe_entzogen', label: 'System-Zugänge und Berechtigungen entzogen' },
    { id: 'abnahme_erfolgt', label: 'Formale Abnahme durch den Auftraggeber erfolgt' },
    { id: 'lessons_dokumentiert', label: 'Lessons Learned dokumentiert' },
    { id: 'kommunikation_abschluss', label: 'Projektabschluss an Stakeholder kommuniziert' },
  ],
};

/**
 * Get config, merging defaults with saved overrides
 */
export async function getConfig(): Promise<Record<string, any>> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    return { ...DEFAULT_CONFIG };
  }
  const content = await file.text();
  const saved = JSON.parse(content);
  return { ...DEFAULT_CONFIG, ...saved };
}

/**
 * Save config
 */
export async function saveConfig(config: Record<string, any>): Promise<void> {
  await ensureDirectories();
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============== Initialization ==============

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  await ensureDirectories();
}
