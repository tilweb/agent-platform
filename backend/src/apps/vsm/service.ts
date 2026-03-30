/**
 * VSM Service
 * Business logic for VSM project management
 */

import type { VsmProjekt, VsmData, VsmProjektFilters, VsmStats } from './types';
import * as storage from './storage';

// ============== Default VSM Data ==============

function createDefaultVsmData(): VsmData {
  return {
    meta_daten: {},
    kunde: {},
    produkt_info: {},
    lieferanten: [],
    prozessschritte: [],
    kennzahlen_ist: {},
    informationsfluss: {},
    personal: {},
  };
}

// ============== CRUD Operations ==============

export async function createProjekt(body: any, userId: string): Promise<VsmProjekt> {
  const projekt: VsmProjekt = {
    id: storage.generateProjektId(),
    name: body.name || 'Neues VSM-Projekt',
    beschreibung: body.beschreibung || '',
    status: 'entwurf',
    vsm_data: createDefaultVsmData(),
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await storage.saveProjekt(projekt);
  return projekt;
}

export async function listProjekte(filters: VsmProjektFilters = {}): Promise<VsmProjekt[]> {
  let projekte = await storage.getProjekte();

  if (filters.status) {
    projekte = projekte.filter(p => p.status === filters.status);
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    projekte = projekte.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.beschreibung.toLowerCase().includes(search) ||
      (p.vsm_data.meta_daten?.unternehmen || '').toLowerCase().includes(search) ||
      (p.vsm_data.meta_daten?.produkt || '').toLowerCase().includes(search)
    );
  }

  return projekte;
}

export async function getProjektDetails(id: string): Promise<VsmProjekt | null> {
  return storage.getProjekt(id);
}

export async function updateProjekt(id: string, updates: Partial<VsmProjekt>, userId: string): Promise<VsmProjekt | null> {
  const projekt = await storage.getProjekt(id);
  if (!projekt) return null;

  if (updates.name !== undefined) projekt.name = updates.name;
  if (updates.beschreibung !== undefined) projekt.beschreibung = updates.beschreibung;
  if (updates.status !== undefined) projekt.status = updates.status;
  if (updates.vsm_data !== undefined) projekt.vsm_data = updates.vsm_data;
  if (updates.analyse_ergebnis !== undefined) projekt.analyse_ergebnis = updates.analyse_ergebnis;

  projekt.updated_at = new Date().toISOString();

  await storage.saveProjekt(projekt);
  return projekt;
}

export async function updateVsmData(id: string, section: string, data: any, userId: string): Promise<VsmProjekt | null> {
  const projekt = await storage.getProjekt(id);
  if (!projekt) return null;

  const validSections = ['meta_daten', 'kunde', 'produkt_info', 'lieferanten', 'prozessschritte', 'kennzahlen_ist', 'informationsfluss', 'personal'];

  if (!validSections.includes(section)) {
    throw new Error(`Invalid section: ${section}`);
  }

  (projekt.vsm_data as any)[section] = data;

  // Auto-calculate tagesbedarf if updating kunde
  if (section === 'kunde' && data.monatsbedarf_stueck && data.arbeitstage_pro_monat) {
    projekt.vsm_data.kunde.tagesbedarf_stueck = Math.round(data.monatsbedarf_stueck / data.arbeitstage_pro_monat);
  }

  // Auto-calculate netto_arbeitszeit for process steps
  if (section === 'prozessschritte' && Array.isArray(data)) {
    for (const step of data) {
      if (step.typ === 'Prozess' && step.arbeitszeit_pro_tag_min && step.pausen_min !== undefined) {
        step.netto_arbeitszeit_min = step.arbeitszeit_pro_tag_min - step.pausen_min;
      }
    }
  }

  // Update status to 'erfassung' if it was 'entwurf' and data is being entered
  if (projekt.status === 'entwurf') {
    projekt.status = 'erfassung';
  }

  projekt.updated_at = new Date().toISOString();

  await storage.saveProjekt(projekt);
  return projekt;
}

export async function removeProjekt(id: string): Promise<boolean> {
  return storage.deleteProjekt(id);
}

// ============== Stats ==============

export async function getStats(): Promise<VsmStats> {
  const projekte = await storage.getProjekte();

  return {
    total: projekte.length,
    entwurf: projekte.filter(p => p.status === 'entwurf').length,
    erfassung: projekte.filter(p => p.status === 'erfassung').length,
    analyse: projekte.filter(p => p.status === 'analyse').length,
    abgeschlossen: projekte.filter(p => p.status === 'abgeschlossen').length,
  };
}
