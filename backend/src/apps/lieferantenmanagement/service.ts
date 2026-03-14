/**
 * Lieferantenmanagement Service
 * Business logic for supplier management
 */

import type {
  Supplier, SupplierFilters, Leistung, BiaBewerung, RisikoLevel,
  Audit, AuditPlan, AuditPlanEintrag, LifecyclePhase,
  Risikobewertung, Regulatorik,
} from './types';
import * as storage from './storage';
import { appendChangelog } from './changelog';

// ============== Change Diff Helpers ==============

interface FieldChange {
  feld: string;
  alt: string;
  neu: string;
}

/**
 * Diff two flat/nested objects and return human-readable changes.
 * Only tracks known fields, ignores IDs and timestamps.
 */
function diffRegulatorik(oldReg: any, newReg: any): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!oldReg || !newReg) return changes;

  const boolStr = (v: any) => v ? 'Ja' : 'Nein';
  const dateStr = (v: any) => v || '-';

  const ROLLE_LABELS: Record<string, string> = {
    verantwortlicher: 'Verantwortlicher',
    auftragsverarbeiter: 'Auftragsverarbeiter',
    gemeinsame_verantwortung: 'Gemeinsame Verantwortung',
  };
  const DORA_LABELS: Record<string, string> = {
    ja: 'Ja', nein: 'Nein', nicht_anwendbar: 'Nicht anwendbar',
  };

  if (oldReg.personenbezogene_daten !== newReg.personenbezogene_daten) {
    changes.push({ feld: 'Personenbezogene Daten', alt: boolStr(oldReg.personenbezogene_daten), neu: boolStr(newReg.personenbezogene_daten) });
  }
  if ((oldReg.datenschutz_rolle || '') !== (newReg.datenschutz_rolle || '')) {
    changes.push({ feld: 'Datenschutz-Rolle', alt: ROLLE_LABELS[oldReg.datenschutz_rolle] || '-', neu: ROLLE_LABELS[newReg.datenschutz_rolle] || '-' });
  }

  for (const doc of ['avv', 'nda', 'rahmenvertrag'] as const) {
    const label = doc === 'avv' ? 'AVV' : doc === 'nda' ? 'NDA' : 'Rahmenvertrag';
    const oldDoc = oldReg[doc] || {};
    const newDoc = newReg[doc] || {};

    if (!!oldDoc.vorhanden !== !!newDoc.vorhanden) {
      changes.push({ feld: `${label} vorhanden`, alt: boolStr(oldDoc.vorhanden), neu: boolStr(newDoc.vorhanden) });
    }
    if ((oldDoc.abgeschlossen_am || '') !== (newDoc.abgeschlossen_am || '')) {
      changes.push({ feld: `${label} abgeschlossen am`, alt: dateStr(oldDoc.abgeschlossen_am), neu: dateStr(newDoc.abgeschlossen_am) });
    }
    if ((oldDoc.gueltig_bis || '') !== (newDoc.gueltig_bis || '')) {
      changes.push({ feld: `${label} gueltig bis`, alt: dateStr(oldDoc.gueltig_bis), neu: dateStr(newDoc.gueltig_bis) });
    }
    if (doc === 'rahmenvertrag') {
      const oldDora = String(oldDoc.dora_konform ?? '');
      const newDora = String(newDoc.dora_konform ?? '');
      if (oldDora !== newDora) {
        changes.push({ feld: 'DORA-konform', alt: DORA_LABELS[oldDora] || oldDora || '-', neu: DORA_LABELS[newDora] || newDora || '-' });
      }
    }
  }

  return changes;
}

function diffLeistung(oldL: any, newL: any): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!oldL || !newL) return changes;

  if (oldL.bezeichnung !== newL.bezeichnung) changes.push({ feld: 'Bezeichnung', alt: oldL.bezeichnung || '-', neu: newL.bezeichnung || '-' });
  if (oldL.abteilung !== newL.abteilung) changes.push({ feld: 'Abteilung', alt: oldL.abteilung || '-', neu: newL.abteilung || '-' });
  if (oldL.status !== newL.status) changes.push({ feld: 'Status', alt: oldL.status || '-', neu: newL.status || '-' });
  if (oldL.beschreibung !== newL.beschreibung) changes.push({ feld: 'Beschreibung', alt: 'geaendert', neu: 'geaendert' });
  if ((oldL.team_id || '') !== (newL.team_id || '')) changes.push({ feld: 'Team', alt: oldL.team_id || '-', neu: newL.team_id || '-' });

  return changes;
}

function diffStammdaten(oldS: any, newS: any): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!oldS || !newS) return changes;

  const LABELS: Record<string, string> = {
    firmenname: 'Firmenname', status: 'Status', notizen: 'Notizen',
  };
  const STAMM_LABELS: Record<string, string> = {
    kundennummer: 'Kundennummer', url: 'Website',
  };

  // Top-level fields
  for (const key of ['firmenname', 'status', 'notizen'] as const) {
    if (oldS[key] !== undefined && newS[key] !== undefined && oldS[key] !== newS[key]) {
      changes.push({ feld: LABELS[key] || key, alt: String(oldS[key] || '-'), neu: String(newS[key] || '-') });
    }
  }

  // Stammdaten sub-fields
  if (newS.stammdaten) {
    const os = oldS.stammdaten || {};
    const ns = newS.stammdaten;
    for (const key of ['kundennummer', 'url'] as const) {
      if (ns[key] !== undefined && (os[key] || '') !== (ns[key] || '')) {
        changes.push({ feld: STAMM_LABELS[key] || key, alt: os[key] || '-', neu: ns[key] || '-' });
      }
    }
    if (ns.adresse) {
      const oa = os.adresse || {};
      const na = ns.adresse;
      const oldAddr = [oa.strasse, oa.plz, oa.ort, oa.land].filter(Boolean).join(', ') || '-';
      const newAddr = [na.strasse, na.plz, na.ort, na.land].filter(Boolean).join(', ') || '-';
      if (oldAddr !== newAddr) {
        changes.push({ feld: 'Adresse', alt: oldAddr, neu: newAddr });
      }
    }
  }

  // Verantwortlichkeiten
  if (newS.verantwortlichkeiten) {
    const ov = oldS.verantwortlichkeiten || {};
    const nv = newS.verantwortlichkeiten;
    if (nv.fachverantwortlicher !== undefined && (ov.fachverantwortlicher || '') !== (nv.fachverantwortlicher || '')) {
      changes.push({ feld: 'Fachverantwortlicher', alt: ov.fachverantwortlicher || '-', neu: nv.fachverantwortlicher || '-' });
    }
    if (nv.ism_verantwortlicher !== undefined && (ov.ism_verantwortlicher || '') !== (nv.ism_verantwortlicher || '')) {
      changes.push({ feld: 'ISM-Verantwortlicher', alt: ov.ism_verantwortlicher || '-', neu: nv.ism_verantwortlicher || '-' });
    }
  }

  return changes;
}

function diffAnsprechpartner(oldAp: any, newAp: any): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!oldAp || !newAp) return changes;

  const LABELS: Record<string, string> = { name: 'Name', rolle: 'Rolle', telefon: 'Telefon', email: 'E-Mail' };
  for (const key of ['name', 'rolle', 'telefon', 'email'] as const) {
    if ((oldAp[key] || '') !== (newAp[key] || '')) {
      changes.push({ feld: LABELS[key] || key, alt: oldAp[key] || '-', neu: newAp[key] || '-' });
    }
  }
  if (!!oldAp.ist_hauptansprechpartner !== !!newAp.ist_hauptansprechpartner) {
    changes.push({ feld: 'Hauptansprechpartner', alt: oldAp.ist_hauptansprechpartner ? 'Ja' : 'Nein', neu: newAp.ist_hauptansprechpartner ? 'Ja' : 'Nein' });
  }
  return changes;
}

function diffZertifizierung(oldZ: any, newZ: any): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!oldZ || !newZ) return changes;

  if (oldZ.typ !== newZ.typ) changes.push({ feld: 'Typ', alt: oldZ.typ || '-', neu: newZ.typ || '-' });
  if ((oldZ.gueltig_bis || '') !== (newZ.gueltig_bis || '')) changes.push({ feld: 'Gueltig bis', alt: oldZ.gueltig_bis || '-', neu: newZ.gueltig_bis || '-' });
  if ((oldZ.ausgestellt_am || '') !== (newZ.ausgestellt_am || '')) changes.push({ feld: 'Ausgestellt am', alt: oldZ.ausgestellt_am || '-', neu: newZ.ausgestellt_am || '-' });
  if ((oldZ.zertifizierer || '') !== (newZ.zertifizierer || '')) changes.push({ feld: 'Zertifizierer', alt: oldZ.zertifizierer || '-', neu: newZ.zertifizierer || '-' });
  if (!!oldZ.nachweis_vorhanden !== !!newZ.nachweis_vorhanden) changes.push({ feld: 'Nachweis', alt: oldZ.nachweis_vorhanden ? 'Ja' : 'Nein', neu: newZ.nachweis_vorhanden ? 'Ja' : 'Nein' });

  return changes;
}

// ============== BIA Calculation (Maximalprinzip) ==============

const BIA_WEIGHTS: Record<string, Record<string, number>> = {
  sla_relevanz: { sla_kritisch: 4, sla_relevant: 3, sla_gering: 2, sla_keine: 1 },
  datenschutz_niveau: { hoch_vertraulich: 4, gelegentlich_hoch: 3, nicht_sensibel: 2, keine: 1 },
  vertraulichkeit: { dauerhaft_hoch: 4, gelegentlich_hoch: 3, nicht_sensibel: 2, keine: 1 },
  kundenbezug: { direkt: 4, indirekt: 2, kein: 1 },
  ausschreibungsvolumen: { ueber_250k: 4, '120k_250k': 3, '10k_120k': 2, unter_10k: 1 },
};

export function calculateBiaErgebnis(bia: Omit<BiaBewerung, 'ergebnis' | 'berechnet_am'>): RisikoLevel {
  const scores = [
    BIA_WEIGHTS.sla_relevanz[bia.sla_relevanz] || 1,
    BIA_WEIGHTS.datenschutz_niveau[bia.datenschutz_niveau] || 1,
    BIA_WEIGHTS.vertraulichkeit[bia.vertraulichkeit] || 1,
    BIA_WEIGHTS.kundenbezug[bia.kundenbezug] || 1,
    BIA_WEIGHTS.ausschreibungsvolumen[bia.ausschreibungsvolumen] || 1,
  ];

  // Maximalprinzip: highest score determines level
  const maxScore = Math.max(...scores);

  if (maxScore >= 4) return 'very_high';
  if (maxScore >= 3) return 'high';
  if (maxScore >= 2) return 'medium';
  return 'low';
}

/**
 * Calculate overall risk for a supplier (Maximalprinzip across active services)
 */
export function calculateGesamtrisiko(leistungen: Leistung[]): RisikoLevel {
  const activeLeistungen = leistungen.filter((l) => l.status === 'active');

  // No active services → default to 'low' (no risk assessment possible)
  if (activeLeistungen.length === 0) return 'low';

  const risikoOrder: Record<RisikoLevel, number> = {
    very_high: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let maxRisiko: RisikoLevel = 'low';
  for (const leistung of activeLeistungen) {
    const ergebnis = leistung.risikobewertung?.bia?.ergebnis || 'low';
    if (risikoOrder[ergebnis] > risikoOrder[maxRisiko]) {
      maxRisiko = ergebnis;
    }
  }

  return maxRisiko;
}

// ============== Supplier CRUD ==============

export async function createSupplier(
  data: Partial<Supplier>,
  userId: string
): Promise<Supplier> {
  const now = new Date().toISOString();
  const id = storage.generateSupplierId();

  const supplier: Supplier = {
    id,
    firmenname: data.firmenname || '',
    status: 'active',
    created_at: now,
    updated_at: now,
    created_by: userId,
    stammdaten: data.stammdaten || {
      kundennummer: '',
      vertragsnummern: [],
      auftragsnummern: [],
      adresse: { strasse: '', plz: '', ort: '', land: 'Deutschland' },
      url: '',
    },
    ansprechpartner: data.ansprechpartner || [],
    zertifizierungen: data.zertifizierungen || [],
    leistungen: data.leistungen || [],
    lifecycle: data.lifecycle || {
      phase: 'vorbereitung',
      phasen_historie: [{
        phase: 'vorbereitung',
        eingetreten_am: now,
        abgeschlossen_am: null,
        bearbeiter: userId,
      }],
    },
    verantwortlichkeiten: data.verantwortlichkeiten || {
      fachverantwortlicher: userId,
      ism_verantwortlicher: '',
    },
    gesamtrisiko: 'low',
    notizen: data.notizen || '',
  };

  await storage.saveSupplier(supplier);
  await appendChangelog(id, {
    user: userId,
    aktion: 'erstellt',
    bereich: 'stammdaten',
    details: { firmenname: supplier.firmenname },
  });

  return supplier;
}

export async function listSuppliers(filters?: SupplierFilters): Promise<Supplier[]> {
  let suppliers = await storage.getSuppliers();

  if (!filters) return suppliers;

  if (filters.status) {
    suppliers = suppliers.filter((s) => s.status === filters.status);
  }

  if (filters.abteilung) {
    suppliers = suppliers.filter((s) =>
      s.leistungen.some((l) => l.abteilung === filters.abteilung)
    );
  }

  if (filters.bia_level) {
    suppliers = suppliers.filter((s) => s.gesamtrisiko === filters.bia_level);
  }

  if (filters.dora !== undefined) {
    suppliers = suppliers.filter((s) =>
      s.leistungen.some((l) => l.risikobewertung?.dora_relevant === filters.dora)
    );
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    suppliers = suppliers.filter((s) =>
      s.firmenname.toLowerCase().includes(q) ||
      s.stammdaten.kundennummer.toLowerCase().includes(q) ||
      s.leistungen.some((l) => l.bezeichnung.toLowerCase().includes(q))
    );
  }

  return suppliers;
}

export async function updateSupplier(
  supplierId: string,
  updates: Partial<Supplier>,
  userId: string
): Promise<Supplier | null> {
  const existing = await storage.getSupplier(supplierId);
  if (!existing) return null;

  const changes = diffStammdaten(existing, updates);

  const updated: Supplier = {
    ...existing,
    ...updates,
    id: supplierId,
    updated_at: new Date().toISOString(),
  };

  // Recalculate gesamtrisiko
  updated.gesamtrisiko = calculateGesamtrisiko(updated.leistungen);

  await storage.saveSupplier(updated);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'stammdaten',
    details: { felder: Object.keys(updates), aenderungen: changes },
  });

  return updated;
}

// ============== Ansprechpartner ==============

export async function addAnsprechpartner(
  supplierId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const ap = {
    id: storage.generateAnsprechpartnerId(),
    name: data.name || '',
    rolle: data.rolle || '',
    telefon: data.telefon || '',
    email: data.email || '',
    ist_hauptansprechpartner: data.ist_hauptansprechpartner || false,
  };

  supplier.ansprechpartner.push(ap);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'ansprechpartner',
    neuer_wert: ap.name,
    details: { aktion: 'hinzugefuegt', id: ap.id },
  });

  return supplier;
}

export async function updateAnsprechpartner(
  supplierId: string,
  apId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const idx = supplier.ansprechpartner.findIndex((a) => a.id === apId);
  if (idx === -1) return null;

  const oldAp = { ...supplier.ansprechpartner[idx] };
  supplier.ansprechpartner[idx] = { ...supplier.ansprechpartner[idx], ...data, id: apId };
  const apChanges = diffAnsprechpartner(oldAp, supplier.ansprechpartner[idx]);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'ansprechpartner',
    details: { id: apId, name: supplier.ansprechpartner[idx].name, aenderungen: apChanges },
  });

  return supplier;
}

export async function deleteAnsprechpartner(
  supplierId: string,
  apId: string,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  supplier.ansprechpartner = supplier.ansprechpartner.filter((a) => a.id !== apId);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'ansprechpartner',
    details: { aktion: 'entfernt', id: apId },
  });

  return supplier;
}

// ============== Zertifizierungen ==============

export async function addZertifizierung(
  supplierId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const zert = {
    id: storage.generateZertifizierungId(),
    typ: data.typ,
    gueltig_bis: data.gueltig_bis || '',
    ausgestellt_am: data.ausgestellt_am || '',
    zertifizierer: data.zertifizierer || '',
    nachweis_vorhanden: data.nachweis_vorhanden || false,
  };

  supplier.zertifizierungen.push(zert);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'zertifizierungen',
    neuer_wert: zert.typ,
    details: { aktion: 'hinzugefuegt', id: zert.id },
  });

  return supplier;
}

export async function updateZertifizierung(
  supplierId: string,
  zertId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const idx = supplier.zertifizierungen.findIndex((z) => z.id === zertId);
  if (idx === -1) return null;

  const oldZert = { ...supplier.zertifizierungen[idx] };
  supplier.zertifizierungen[idx] = { ...supplier.zertifizierungen[idx], ...data, id: zertId };
  const zertChanges = diffZertifizierung(oldZert, supplier.zertifizierungen[idx]);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'zertifizierungen',
    details: { id: zertId, typ: supplier.zertifizierungen[idx].typ, aenderungen: zertChanges },
  });

  return supplier;
}

export async function deleteZertifizierung(
  supplierId: string,
  zertId: string,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  supplier.zertifizierungen = supplier.zertifizierungen.filter((z) => z.id !== zertId);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'zertifizierungen',
    details: { aktion: 'entfernt', id: zertId },
  });

  return supplier;
}

// ============== Leistungen ==============

export async function addLeistung(
  supplierId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const defaultRisikobewertung: Risikobewertung = {
    bonitaet: 'unbekannt',
    bonitaet_datum: '',
    bonitaet_quelle: '',
    bia: {
      sla_relevanz: 'sla_keine',
      datenschutz_niveau: 'keine',
      vertraulichkeit: 'keine',
      kundenbezug: 'kein',
      ausschreibungsvolumen: 'unter_10k',
      ergebnis: 'low',
      berechnet_am: new Date().toISOString(),
    },
    dora_relevant: false,
    naechste_pruefung: '',
  };

  const defaultRegulatorik: Regulatorik = {
    personenbezogene_daten: false,
    avv: { vorhanden: false, abgeschlossen_am: '', gueltig_bis: '' },
    nda: { vorhanden: false, abgeschlossen_am: '', gueltig_bis: '' },
    rahmenvertrag: { vorhanden: false, abgeschlossen_am: '', gueltig_bis: '', dora_konform: 'nicht_anwendbar' },
  };

  const leistung: Leistung = {
    id: storage.generateLeistungId(),
    bezeichnung: data.bezeichnung || '',
    abteilung: data.abteilung || '',
    status: 'active',
    beschreibung: data.beschreibung || '',
    team_id: data.team_id || undefined,
    risikobewertung: data.risikobewertung || defaultRisikobewertung,
    regulatorik: data.regulatorik || defaultRegulatorik,
  };

  supplier.leistungen.push(leistung);
  supplier.gesamtrisiko = calculateGesamtrisiko(supplier.leistungen);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'leistungen',
    neuer_wert: leistung.bezeichnung,
    details: { aktion: 'hinzugefuegt', id: leistung.id },
  });

  return supplier;
}

export async function updateLeistung(
  supplierId: string,
  leistungId: string,
  data: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const idx = supplier.leistungen.findIndex((l) => l.id === leistungId);
  if (idx === -1) return null;

  const oldLeistung = { ...supplier.leistungen[idx] };
  supplier.leistungen[idx] = { ...supplier.leistungen[idx], ...data, id: leistungId };
  const leistChanges = diffLeistung(oldLeistung, supplier.leistungen[idx]);
  supplier.gesamtrisiko = calculateGesamtrisiko(supplier.leistungen);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'leistungen',
    details: { id: leistungId, bezeichnung: supplier.leistungen[idx].bezeichnung, aenderungen: leistChanges },
  });

  return supplier;
}

export async function deleteLeistung(
  supplierId: string,
  leistungId: string,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  supplier.leistungen = supplier.leistungen.filter((l) => l.id !== leistungId);
  supplier.gesamtrisiko = calculateGesamtrisiko(supplier.leistungen);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'leistungen',
    details: { aktion: 'entfernt', id: leistungId },
  });

  return supplier;
}

// ============== BIA Update ==============

export async function updateBia(
  supplierId: string,
  leistungId: string,
  biaData: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const idx = supplier.leistungen.findIndex((l) => l.id === leistungId);
  if (idx === -1) return null;

  const ergebnis = calculateBiaErgebnis(biaData);

  supplier.leistungen[idx].risikobewertung.bia = {
    ...biaData,
    ergebnis,
    berechnet_am: new Date().toISOString(),
  };

  // Auto-set naechste_pruefung based on review cycle
  const cycle = REVIEW_CYCLES[ergebnis];
  if (cycle !== null) {
    const next = new Date();
    next.setMonth(next.getMonth() + cycle);
    supplier.leistungen[idx].risikobewertung.naechste_pruefung = next.toISOString().split('T')[0];
  }

  supplier.gesamtrisiko = calculateGesamtrisiko(supplier.leistungen);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'leistungen',
    feld: 'bia',
    neuer_wert: ergebnis,
    details: { leistung_id: leistungId },
  });

  return supplier;
}

// ============== Regulatorik Update ==============

export async function updateRegulatorik(
  supplierId: string,
  leistungId: string,
  regulatorikData: any,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const idx = supplier.leistungen.findIndex((l) => l.id === leistungId);
  if (idx === -1) return null;

  const oldReg = supplier.leistungen[idx].regulatorik ? { ...supplier.leistungen[idx].regulatorik } : {};
  // Deep copy docs for diffing
  const oldRegCopy = JSON.parse(JSON.stringify(oldReg));

  supplier.leistungen[idx].regulatorik = {
    ...supplier.leistungen[idx].regulatorik,
    ...regulatorikData,
  };
  const regChanges = diffRegulatorik(oldRegCopy, supplier.leistungen[idx].regulatorik);
  supplier.updated_at = new Date().toISOString();

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'geaendert',
    bereich: 'regulatorik',
    details: { leistung_id: leistungId, bezeichnung: supplier.leistungen[idx].bezeichnung, aenderungen: regChanges },
  });

  return supplier;
}

// ============== Lifecycle ==============

const LIFECYCLE_ORDER: LifecyclePhase[] = [
  'vorbereitung', 'risikoanalyse', 'vertragspruefung', 'betrieb', 'beendigung',
];

export async function transitionLifecycle(
  supplierId: string,
  targetPhase: LifecyclePhase,
  userId: string
): Promise<Supplier | null> {
  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const currentIdx = LIFECYCLE_ORDER.indexOf(supplier.lifecycle.phase);
  const targetIdx = LIFECYCLE_ORDER.indexOf(targetPhase);

  // Only allow forward transitions or same phase
  if (targetIdx < currentIdx && targetPhase !== 'beendigung') {
    return null;
  }

  const now = new Date().toISOString();
  const alterWert = supplier.lifecycle.phase;

  // Close current phase
  const currentHist = supplier.lifecycle.phasen_historie.find(
    (h) => h.phase === supplier.lifecycle.phase && !h.abgeschlossen_am
  );
  if (currentHist) {
    currentHist.abgeschlossen_am = now;
  }

  // Open new phase
  supplier.lifecycle.phase = targetPhase;
  supplier.lifecycle.phasen_historie.push({
    phase: targetPhase,
    eingetreten_am: now,
    abgeschlossen_am: null,
    bearbeiter: userId,
  });

  if (targetPhase === 'beendigung') {
    supplier.status = 'beendet';
  }

  supplier.updated_at = now;

  await storage.saveSupplier(supplier);
  await appendChangelog(supplierId, {
    user: userId,
    aktion: 'phase_gewechselt',
    bereich: 'lifecycle',
    alter_wert: alterWert,
    neuer_wert: targetPhase,
  });

  return supplier;
}

// ============== Audits ==============

export async function createAudit(data: Partial<Audit>, userId: string): Promise<Audit> {
  const now = new Date().toISOString();
  const audit: Audit = {
    id: storage.generateAuditId(),
    supplier_id: data.supplier_id || '',
    leistung_id: data.leistung_id || '',
    typ: data.typ || 'dokumentenpruefung',
    scope: data.scope || undefined,
    status: data.status || 'geplant',
    geplant_fuer: data.geplant_fuer || '',
    durchgefuehrt_am: data.durchgefuehrt_am || '',
    pruefer: data.pruefer || userId,
    team_id: data.team_id || undefined,
    ergebnis: data.ergebnis || null,
    bewertung: data.bewertung || null,
    massnahmen: data.massnahmen || [],
    notizen: data.notizen || '',
    created_at: now,
    updated_at: now,
  };

  await storage.saveAudit(audit);
  return audit;
}

export async function listAudits(filters?: {
  supplier_id?: string;
  status?: string;
}): Promise<Audit[]> {
  let audits = await storage.getAudits();

  if (filters?.supplier_id) {
    audits = audits.filter((a) => a.supplier_id === filters.supplier_id);
  }
  if (filters?.status) {
    audits = audits.filter((a) => a.status === filters.status);
  }

  return audits;
}

export async function updateAudit(
  auditId: string,
  updates: Partial<Audit>,
  userId: string = 'system'
): Promise<Audit | null> {
  const existing = await storage.getAudit(auditId);
  if (!existing) return null;

  const updated: Audit = {
    ...existing,
    ...updates,
    id: auditId,
    updated_at: new Date().toISOString(),
  };

  await storage.saveAudit(updated);

  if (existing.status !== updated.status || existing.bewertung !== updated.bewertung) {
    await appendChangelog(existing.supplier_id, {
      user: userId,
      aktion: 'geaendert',
      bereich: 'audit',
      feld: existing.status !== updated.status ? 'status' : 'bewertung',
      alter_wert: existing.status !== updated.status ? existing.status : (existing.bewertung || '-'),
      neuer_wert: existing.status !== updated.status ? updated.status : (updated.bewertung || '-'),
      details: { audit_id: auditId },
    });
  }

  return updated;
}

// ============== Audit Plan Generation ==============

const REVIEW_CYCLES: Record<RisikoLevel, number | null> = {
  very_high: 12,
  high: 36,
  medium: null,
  low: null,
};

const DEFAULT_SCOPE_REGELN: Record<string, string[]> = {
  very_high: ['fachpruefung', 'compliance_pruefung'],
  high: ['fachpruefung', 'compliance_pruefung'],
  medium: ['fachpruefung'],
  low: ['fachpruefung'],
};

export async function generateAuditPlan(year: number): Promise<AuditPlan> {
  const suppliers = await storage.getSuppliers();
  const config = await storage.getConfig();
  const scopeRegeln = config?.scope_regeln || DEFAULT_SCOPE_REGELN;
  const eintraege: AuditPlanEintrag[] = [];

  for (const supplier of suppliers) {
    if (supplier.status === 'beendet') continue;

    for (const leistung of supplier.leistungen) {
      if (leistung.status !== 'active') continue;

      const biaLevel = leistung.risikobewertung?.bia?.ergebnis || 'low';
      const cycle = REVIEW_CYCLES[biaLevel];

      if (cycle === null) continue; // no mandatory review

      const erforderlicheScopes = scopeRegeln[biaLevel] || ['fachpruefung'];

      eintraege.push({
        supplier_id: supplier.id,
        leistung_id: leistung.id,
        bia_level: biaLevel,
        erforderliche_scopes: erforderlicheScopes,
        geplante_audits: [],
        status: 'offen',
      });
    }
  }

  const plan: AuditPlan = { jahr: year, eintraege };
  await storage.saveAuditPlan(plan);
  return plan;
}

// ============== Stats ==============

export async function getStats(): Promise<any> {
  const suppliers = await storage.getSuppliers();
  const audits = await storage.getAudits();

  const active = suppliers.filter((s) => s.status === 'active').length;
  const inactive = suppliers.filter((s) => s.status === 'inactive').length;
  const beendet = suppliers.filter((s) => s.status === 'beendet').length;

  const riskDistribution = { very_high: 0, high: 0, medium: 0, low: 0 };
  for (const s of suppliers.filter((s) => s.status === 'active')) {
    riskDistribution[s.gesamtrisiko]++;
  }

  const offeneAudits = audits.filter((a) => a.status === 'geplant' || a.status === 'in_durchfuehrung').length;
  const doraRelevant = suppliers.filter((s) =>
    s.leistungen.some((l) => l.risikobewertung?.dora_relevant)
  ).length;

  return {
    gesamt: suppliers.length,
    active,
    inactive,
    beendet,
    riskDistribution,
    offeneAudits,
    doraRelevant,
  };
}

export async function getRiskDistribution(): Promise<any> {
  const suppliers = await storage.getSuppliers();

  const matrix: Array<{ supplier_id: string; firmenname: string; gesamtrisiko: RisikoLevel; leistungen: number }> = [];

  for (const s of suppliers.filter((s) => s.status !== 'beendet')) {
    matrix.push({
      supplier_id: s.id,
      firmenname: s.firmenname,
      gesamtrisiko: s.gesamtrisiko,
      leistungen: s.leistungen.filter((l) => l.status === 'active').length,
    });
  }

  return matrix;
}

export async function getComplianceStats(): Promise<any> {
  const suppliers = await storage.getSuppliers();
  const now = new Date();

  let total = 0;
  let avvCount = 0;
  let ndaCount = 0;
  let rahmenvertragCount = 0;
  let personenbezugCount = 0;

  const details: any[] = [];

  for (const s of suppliers.filter((s) => s.status === 'active')) {
    for (const l of s.leistungen.filter((l) => l.status === 'active')) {
      total++;
      const reg = l.regulatorik || {} as any;
      if (reg.avv?.vorhanden) avvCount++;
      if (reg.nda?.vorhanden) ndaCount++;
      if (reg.rahmenvertrag?.vorhanden) rahmenvertragCount++;
      if (reg.personenbezogene_daten) personenbezugCount++;

      // Build detail entry with status per document
      const isExpired = (doc: any) => doc?.gueltig_bis ? new Date(doc.gueltig_bis) < now : false;

      const getDocStatus = (docKey: string) => {
        const doc = reg[docKey];
        if (doc?.vorhanden) {
          return isExpired(doc) ? 'abgelaufen' : 'erfuellt';
        }
        // AVV required when personenbezogene_daten + auftragsverarbeiter
        if (docKey === 'avv' && reg.personenbezogene_daten && reg.datenschutz_rolle === 'auftragsverarbeiter') {
          return 'fehlend';
        }
        return 'nicht_vorhanden';
      };

      details.push({
        supplier_id: s.id,
        firmenname: s.firmenname,
        leistung_id: l.id,
        bezeichnung: l.bezeichnung,
        personenbezogene_daten: !!reg.personenbezogene_daten,
        datenschutz_rolle: reg.datenschutz_rolle || null,
        avv_status: getDocStatus('avv'),
        nda_status: getDocStatus('nda'),
        rahmenvertrag_status: getDocStatus('rahmenvertrag'),
        avv_gueltig_bis: reg.avv?.gueltig_bis || null,
        nda_gueltig_bis: reg.nda?.gueltig_bis || null,
        rahmenvertrag_gueltig_bis: reg.rahmenvertrag?.gueltig_bis || null,
      });
    }
  }

  return {
    total_services: total,
    avv_count: avvCount,
    nda_count: ndaCount,
    rahmenvertrag_count: rahmenvertragCount,
    personenbezug_count: personenbezugCount,
    details,
  };
}

export async function getExpiringItems(): Promise<any> {
  const suppliers = await storage.getSuppliers();
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const expiring: any[] = [];

  for (const s of suppliers.filter((s) => s.status === 'active')) {
    // Check certs
    for (const z of s.zertifizierungen) {
      if (z.gueltig_bis) {
        const date = new Date(z.gueltig_bis);
        if (date <= in90Days) {
          expiring.push({
            typ: 'zertifizierung',
            supplier_id: s.id,
            firmenname: s.firmenname,
            bezeichnung: z.typ,
            ablauf: z.gueltig_bis,
          });
        }
      }
    }

    // Check AVV/NDA/Rahmenvertrag
    for (const l of s.leistungen) {
      for (const doc of ['avv', 'nda', 'rahmenvertrag'] as const) {
        const d = l.regulatorik?.[doc];
        if (d?.vorhanden && d.gueltig_bis) {
          const date = new Date(d.gueltig_bis);
          if (date <= in90Days) {
            expiring.push({
              typ: doc,
              supplier_id: s.id,
              firmenname: s.firmenname,
              leistung: l.bezeichnung,
              bezeichnung: doc.toUpperCase(),
              ablauf: d.gueltig_bis,
            });
          }
        }
      }
    }
  }

  expiring.sort((a, b) => new Date(a.ablauf).getTime() - new Date(b.ablauf).getTime());
  return expiring;
}

export async function getPendingReviews(): Promise<any> {
  const suppliers = await storage.getSuppliers();
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const reviews: any[] = [];

  for (const s of suppliers.filter((s) => s.status === 'active')) {
    for (const l of s.leistungen) {
      if (l.status !== 'active') continue;
      const np = l.risikobewertung?.naechste_pruefung;
      if (!np) continue;
      const date = new Date(np);
      // Include overdue + upcoming within 90 days
      if (date <= in90Days) {
        reviews.push({
          typ: 'review',
          supplier_id: s.id,
          firmenname: s.firmenname,
          leistung_id: l.id,
          leistung: l.bezeichnung,
          faellig: np,
          ueberfaellig: date < now,
          bia_level: l.risikobewertung?.bia?.ergebnis || null,
        });
      }
    }
  }

  reviews.sort((a, b) => new Date(a.faellig).getTime() - new Date(b.faellig).getTime());
  return reviews;
}
