/**
 * Projektmanagement Storage Service
 * File-based storage for Projektauftraege
 */

import { parse, stringify } from 'yaml';
import type { Projektauftrag, Vorlage } from './types';

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
 * Get all Projektauftraege
 */
export async function getProjektauftraege(): Promise<Projektauftrag[]> {
  const projektauftraege: Projektauftrag[] = [];

  try {
    const glob = new Bun.Glob('*/metadata.yaml');

    for await (const path of glob.scan(PROJEKTAUFTRAEGE_PATH)) {
      const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const projektauftrag = parse(content) as Projektauftrag;
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
  return parse(content) as Projektauftrag;
}

/**
 * Save a Projektauftrag
 */
export async function saveProjektauftrag(projektauftrag: Projektauftrag): Promise<void> {
  const dir = `${PROJEKTAUFTRAEGE_PATH}/${projektauftrag.id}`;

  // Ensure directory exists
  await Bun.$`mkdir -p ${dir}`;

  // Save metadata
  await Bun.write(`${dir}/metadata.yaml`, stringify(projektauftrag));
}

/**
 * Update a Projektauftrag
 */
export async function updateProjektauftrag(
  projektId: string,
  updates: Partial<Projektauftrag>
): Promise<Projektauftrag | null> {
  const existing = await getProjektauftrag(projektId);

  if (!existing) {
    return null;
  }

  const updated: Projektauftrag = {
    ...existing,
    ...updates,
    id: projektId, // Ensure ID is not changed
    updated_at: new Date().toISOString(),
  };

  await saveProjektauftrag(updated);
  return updated;
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

// ============== Initialization ==============

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  await ensureDirectories();
}
