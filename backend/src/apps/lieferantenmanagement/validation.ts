/**
 * Lieferantenmanagement Input Validation
 * Lightweight validation without external dependencies
 */

import type {
  SupplierStatus, ZertifizierungsTyp, LifecyclePhase, AuditTyp, AuditStatus,
  SlaRelevanz, DatenschutzNiveau, Vertraulichkeit, Kundenbezug, Ausschreibungsvolumen,
  DatenschutzRolle, DoraKonformStatus, Bonitaet,
} from './types';

// ============== Result Type ==============

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function ok(): ValidationResult { return { ok: true }; }
function fail(msg: string): ValidationResult { return { ok: false, error: msg }; }

// ============== Helpers ==============

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!value) return true; // empty dates are allowed (optional fields)
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isOptionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): boolean {
  if (value === undefined || value === null || value === '') return true;
  return isOneOf(value, allowed);
}

function isOptionalDate(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && isValidDateString(value);
}

// ============== Enum Values ==============

const SUPPLIER_STATUSES: readonly SupplierStatus[] = ['active', 'inactive', 'beendet'];
const ZERTIFIZIERUNG_TYPEN: readonly ZertifizierungsTyp[] = ['ISO27001', 'TISAX', 'PCI_DSS', 'ISO23001', 'ISO22301'];
const LIFECYCLE_PHASEN: readonly LifecyclePhase[] = ['vorbereitung', 'risikoanalyse', 'vertragspruefung', 'betrieb', 'beendigung'];
const AUDIT_TYPEN: readonly AuditTyp[] = ['vertragspruefung', 'soc_bericht', 'bonitaetspruefung', 'interview', 'vor_ort_pruefung', 'dokumentenpruefung'];
const AUDIT_STATUSES: readonly AuditStatus[] = ['geplant', 'in_durchfuehrung', 'abgeschlossen', 'uebersprungen'];
const AUDIT_BEWERTUNGEN = ['bestanden', 'bestanden_mit_auflagen', 'nicht_bestanden'] as const;

const SLA_RELEVANZ: readonly SlaRelevanz[] = ['sla_kritisch', 'sla_relevant', 'sla_gering', 'sla_keine'];
const DATENSCHUTZ_NIVEAU: readonly DatenschutzNiveau[] = ['hoch_vertraulich', 'gelegentlich_hoch', 'nicht_sensibel', 'keine'];
const VERTRAULICHKEIT: readonly Vertraulichkeit[] = ['dauerhaft_hoch', 'gelegentlich_hoch', 'nicht_sensibel', 'keine'];
const KUNDENBEZUG: readonly Kundenbezug[] = ['direkt', 'indirekt', 'kein'];
const AUSSCHREIBUNGSVOLUMEN: readonly Ausschreibungsvolumen[] = ['ueber_250k', '120k_250k', '10k_120k', 'unter_10k'];
const DATENSCHUTZ_ROLLEN: readonly DatenschutzRolle[] = ['verantwortlicher', 'auftragsverarbeiter', 'gemeinsame_verantwortung'];
const DORA_STATUS: readonly DoraKonformStatus[] = ['ja', 'nein', 'nicht_anwendbar'];
const BONITAET_STUFEN: readonly Bonitaet[] = ['gut', 'ausreichend', 'mangelhaft', 'unbekannt'];

// ============== Entity Validators ==============

export function validateCreateSupplier(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isNonEmptyString(data.firmenname)) return fail('firmenname ist erforderlich');
  return ok();
}

export function validateUpdateSupplier(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (data.status !== undefined && !isOneOf(data.status, SUPPLIER_STATUSES)) {
    return fail(`Ungueltiger Status: ${data.status}`);
  }
  if (data.firmenname !== undefined && typeof data.firmenname !== 'string') {
    return fail('firmenname muss ein String sein');
  }
  return ok();
}

export function validateAnsprechpartner(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isNonEmptyString(data.name)) return fail('name ist erforderlich');
  return ok();
}

export function validateZertifizierung(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isOneOf(data.typ, ZERTIFIZIERUNG_TYPEN)) return fail(`Ungueltiger Zertifizierungstyp: ${data.typ}`);
  if (!isOptionalDate(data.gueltig_bis)) return fail(`Ungueltiges Datum gueltig_bis: ${data.gueltig_bis}`);
  if (!isOptionalDate(data.ausgestellt_am)) return fail(`Ungueltiges Datum ausgestellt_am: ${data.ausgestellt_am}`);
  return ok();
}

export function validateLeistung(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isNonEmptyString(data.bezeichnung)) return fail('bezeichnung ist erforderlich');
  return ok();
}

export function validateBia(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isOneOf(data.sla_relevanz, SLA_RELEVANZ)) return fail(`Ungueltige sla_relevanz: ${data.sla_relevanz}`);
  if (!isOneOf(data.datenschutz_niveau, DATENSCHUTZ_NIVEAU)) return fail(`Ungueltiges datenschutz_niveau: ${data.datenschutz_niveau}`);
  if (!isOneOf(data.vertraulichkeit, VERTRAULICHKEIT)) return fail(`Ungueltige vertraulichkeit: ${data.vertraulichkeit}`);
  if (!isOneOf(data.kundenbezug, KUNDENBEZUG)) return fail(`Ungueltiger kundenbezug: ${data.kundenbezug}`);
  if (!isOneOf(data.ausschreibungsvolumen, AUSSCHREIBUNGSVOLUMEN)) return fail(`Ungueltiges ausschreibungsvolumen: ${data.ausschreibungsvolumen}`);
  return ok();
}

export function validateRegulatorik(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (data.datenschutz_rolle !== undefined && data.datenschutz_rolle !== '') {
    if (!isOneOf(data.datenschutz_rolle, DATENSCHUTZ_ROLLEN)) {
      return fail(`Ungueltige datenschutz_rolle: ${data.datenschutz_rolle}`);
    }
  }
  // Validate doc sub-objects if present
  for (const docKey of ['avv', 'nda', 'rahmenvertrag'] as const) {
    const doc = data[docKey];
    if (doc && typeof doc === 'object') {
      if (!isOptionalDate(doc.abgeschlossen_am)) return fail(`Ungueltiges Datum ${docKey}.abgeschlossen_am`);
      if (!isOptionalDate(doc.gueltig_bis)) return fail(`Ungueltiges Datum ${docKey}.gueltig_bis`);
    }
  }
  if (data.rahmenvertrag?.dora_konform !== undefined) {
    if (!isOptionalOneOf(data.rahmenvertrag.dora_konform, DORA_STATUS) && data.rahmenvertrag.dora_konform !== true && data.rahmenvertrag.dora_konform !== false) {
      return fail(`Ungueltiger dora_konform Status: ${data.rahmenvertrag.dora_konform}`);
    }
  }
  return ok();
}

export function validateLifecycleTransition(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isOneOf(data.phase, LIFECYCLE_PHASEN)) return fail(`Ungueltige Phase: ${data.phase}`);
  return ok();
}

export function validateCreateAudit(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (!isNonEmptyString(data.supplier_id)) return fail('supplier_id ist erforderlich');
  if (!isNonEmptyString(data.leistung_id)) return fail('leistung_id ist erforderlich');
  if (data.typ !== undefined && !isOneOf(data.typ, AUDIT_TYPEN)) return fail(`Ungueltiger Audit-Typ: ${data.typ}`);
  if (data.status !== undefined && !isOneOf(data.status, AUDIT_STATUSES)) return fail(`Ungueltiger Audit-Status: ${data.status}`);
  if (!isOptionalDate(data.geplant_fuer)) return fail(`Ungueltiges Datum geplant_fuer: ${data.geplant_fuer}`);
  if (!isOptionalDate(data.durchgefuehrt_am)) return fail(`Ungueltiges Datum durchgefuehrt_am: ${data.durchgefuehrt_am}`);
  if (data.bewertung !== undefined && data.bewertung !== null) {
    if (!isOneOf(data.bewertung, AUDIT_BEWERTUNGEN)) return fail(`Ungueltige Bewertung: ${data.bewertung}`);
  }
  return ok();
}

export function validateUpdateAudit(data: any): ValidationResult {
  if (!data || typeof data !== 'object') return fail('Body muss ein Objekt sein');
  if (data.typ !== undefined && !isOneOf(data.typ, AUDIT_TYPEN)) return fail(`Ungueltiger Audit-Typ: ${data.typ}`);
  if (data.status !== undefined && !isOneOf(data.status, AUDIT_STATUSES)) return fail(`Ungueltiger Audit-Status: ${data.status}`);
  if (!isOptionalDate(data.geplant_fuer)) return fail(`Ungueltiges Datum geplant_fuer: ${data.geplant_fuer}`);
  if (!isOptionalDate(data.durchgefuehrt_am)) return fail(`Ungueltiges Datum durchgefuehrt_am: ${data.durchgefuehrt_am}`);
  if (data.bewertung !== undefined && data.bewertung !== null) {
    if (!isOneOf(data.bewertung, AUDIT_BEWERTUNGEN)) return fail(`Ungueltige Bewertung: ${data.bewertung}`);
  }
  return ok();
}

// Re-export isValidDateString for use in service.ts
export { DATE_PATTERN };
