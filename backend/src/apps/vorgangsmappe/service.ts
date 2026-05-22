/**
 * Vorgangsmappe — Service Layer
 *
 * Buendelt die Aufrufe gegen den DocuWare-Connector und liefert
 * vorgangs-orientierte Sichten (Detail eines Vorgangs, Gruppierung von
 * Such-Treffern nach REFERENCE).
 */

import { connectionRegistry } from '../../connections';
import { executeStructuredSearch } from '../../connections/providers/docuware/search';
import type { StructuredSearchHit, StructuredSearchFilter } from '../../connections/providers/docuware/search';
import { loadConfig } from './config-loader';
import { normalizeReferenceNumber } from './reference-utils';
import { computeCompliance } from './compliance';
import { listDocumentTypes } from './settings-storage';
import type { ComplianceReport, VorgangDetail, VorgangSummary, VorgangsmappeConfig } from './types';

const VORGANG_DOC_LIMIT = 100;
const FREE_SEARCH_DEFAULT_COUNT = 50;

/**
 * Sicherstellen, dass eine DocuWare-Connection besteht und Tokens geliefert
 * werden. Wirft mit verstaendlichem Text bei Fehler — Routen koennen den
 * Status (401 vs 503) anhand des Fehlertexts setzen.
 */
async function getDocuwareTokensOrFail(userId: string) {
  const tokens = await connectionRegistry.getTokens(userId, 'docuware');
  if (!tokens) {
    throw new Error('Keine aktive DocuWare-Verbindung. Bitte zuerst unter Einstellungen → Verbindungen verbinden.');
  }
  if (!tokens.apiDomain) {
    throw new Error('DocuWare-Verbindung hat keine API-Domain hinterlegt.');
  }
  return tokens;
}

async function getConfigOrFail(): Promise<VorgangsmappeConfig> {
  const cfg = await loadConfig();
  if (!cfg) {
    throw new Error('Vorgangsmappe ist noch nicht konfiguriert (data/apps/vorgangsmappe/config.yaml fehlt oder ist unvollstaendig).');
  }
  if (!cfg.cabinet.id) {
    throw new Error('Cabinet-ID in data/apps/vorgangsmappe/config.yaml ist leer.');
  }
  return cfg;
}

/**
 * Vorgang per Reference-Nummer laden. Returnt alle Dokumente sortiert nach
 * Datum descending (neueste oben).
 */
export async function getVorgangByReference(
  userId: string,
  rawReference: string,
): Promise<VorgangDetail> {
  const config = await getConfigOrFail();
  const tokens = await getDocuwareTokensOrFail(userId);

  const reference = normalizeReferenceNumber(rawReference);
  // Wildcard-Suche, damit auch Docs gefunden werden, in denen mehrere
  // Vorgangsnummern komma- oder semikolon-getrennt im REFERENCE-Feld
  // stehen (z.B. „AB23-00020, AB23-00021"). Boundary-Pruefung passiert
  // anschliessend serverseitig in `referenceContainsToken`.
  const filters: StructuredSearchFilter[] = [
    { field: config.reference_field, values: [`*${reference}*`] },
  ];

  const result = await executeStructuredSearch(tokens.apiDomain, tokens.accessToken, {
    cabinetId: config.cabinet.id,
    filters,
    operation: 'And',
    count: VORGANG_DOC_LIMIT,
  });

  // Post-Filter: nur Docs behalten, deren REFERENCE-Wert die Nummer
  // tatsaechlich als komplettes Token enthaelt — verhindert Treffer
  // wie „AB23-000201" beim Drilldown auf „AB23-00020".
  const exactMatches = result.items.filter((doc) =>
    referenceContainsToken(doc.fields[config.reference_field], reference),
  );
  const docs = sortDocsByDateDesc(exactMatches).map((d) => enhanceTitle(d, config));
  const dateRange = computeDateRange(docs);
  const compliance = await computeCompliance(docs, config);
  const statusInfo = await computeVorgangStatus(docs, config);

  return {
    reference,
    documentCount: docs.length,
    documents: docs,
    dateRange,
    cabinetId: config.cabinet.id,
    cabinetName: config.cabinet.displayName,
    vorgangstyp: compliance.ruleSetName,
    compliance,
    status: statusInfo.status,
    status_source: statusInfo.source,
  };
}

/**
 * Ermittelt den Vorgangs-Status aus den Dokumenten:
 *   - Doc-Types-Settings laden (gibt `statusgebend`-Flag pro Doc-Type)
 *   - Docs sind bereits nach Datum desc sortiert
 *   - Erstes Doc finden, dessen `document_type_field` zu einem
 *     statusgebenden Doc-Type matched UND einen Wert im `status_field` hat
 *   - Dessen Status-Wert zurueckgeben
 */
async function computeVorgangStatus(
  docs: StructuredSearchHit[],
  config: VorgangsmappeConfig,
): Promise<{ status: string | null; source: VorgangDetail['status_source'] | null }> {
  const statusField = config.status_field || 'BC_STATUS';
  const docTypeField = config.document_type_field;

  let docTypes;
  try {
    docTypes = await listDocumentTypes();
  } catch {
    return { status: null, source: null };
  }
  const statusgebende = docTypes.filter((dt) => dt.statusgebend);
  if (statusgebende.length === 0) return { status: null, source: null };

  // Helper-Match
  const matchesType = (value: unknown, matchAny: string[]): boolean => {
    if (typeof value !== 'string' || value.trim() === '') return false;
    for (const cand of matchAny) {
      if (!cand) continue;
      if (cand.includes('*')) {
        const escaped = cand.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        if (new RegExp(`^${escaped}$`, 'i').test(value)) return true;
      } else if (cand.toLowerCase() === value.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  for (const doc of docs) {
    const docTypeValue = doc.fields[docTypeField];
    const statusValue = doc.fields[statusField];
    if (typeof statusValue !== 'string' || !statusValue.trim()) continue;

    for (const dt of statusgebende) {
      if (matchesType(docTypeValue, dt.matchAny)) {
        return {
          status: statusValue.trim(),
          source: {
            documentId: doc.id,
            documentTypeId: dt.id,
            documentTypeLabel: dt.label,
          },
        };
      }
    }
  }
  return { status: null, source: null };
}

/**
 * Eigenständiger Compliance-Check mit optionalem Incoterm/Geschaeftsart-
 * Override (UI-Hilfe wenn die Felder im Vorgang nicht gepflegt sind).
 */
export async function runComplianceCheck(
  userId: string,
  rawReference: string,
  override?: { incoterm?: string; geschaeftsart?: string },
): Promise<{ reference: string; compliance: ComplianceReport; documentCount: number }> {
  const config = await getConfigOrFail();
  const tokens = await getDocuwareTokensOrFail(userId);

  const reference = normalizeReferenceNumber(rawReference);
  const result = await executeStructuredSearch(tokens.apiDomain, tokens.accessToken, {
    cabinetId: config.cabinet.id,
    filters: [{ field: config.reference_field, values: [`*${reference}*`] }],
    operation: 'And',
    count: VORGANG_DOC_LIMIT,
  });
  const docs = result.items.filter((doc) =>
    referenceContainsToken(doc.fields[config.reference_field], reference),
  );
  const compliance = await computeCompliance(docs, config, override);
  return { reference, compliance, documentCount: docs.length };
}

/**
 * Prueft, ob der `REFERENCE`-Feldwert eines Dokuments die gesuchte
 * Nummer als komplettes Token enthaelt. Tokens werden an Komma,
 * Semikolon, Slash und Whitespace getrennt — DocuWare-Pfleger:innen
 * nutzen typischerweise eines davon.
 */
function referenceContainsToken(fieldValue: unknown, reference: string): boolean {
  if (typeof fieldValue !== 'string') return false;
  const tokens = fieldValue.split(/[,;/\s]+/).map((t) => t.trim()).filter(Boolean);
  const needle = reference.toLowerCase();
  return tokens.some((t) => t.toLowerCase() === needle);
}

/**
 * Freie Suche per beliebigen Filtern. Wird in Phase C primaer vom NLU-Pfad
 * benutzt; hier schon vorhanden, damit die Route in Phase B bereits einen
 * "Filter-direkt"-Modus anbieten kann (Frontend-Form ohne LLM).
 */
export async function freeFilterSearch(
  userId: string,
  filters: StructuredSearchFilter[],
  options: { operation?: 'And' | 'Or'; count?: number } = {},
): Promise<{
  filters: StructuredSearchFilter[];
  documents: StructuredSearchHit[];
  vorgaenge: VorgangSummary[];
}> {
  const config = await getConfigOrFail();
  const tokens = await getDocuwareTokensOrFail(userId);

  const result = await executeStructuredSearch(tokens.apiDomain, tokens.accessToken, {
    cabinetId: config.cabinet.id,
    filters,
    operation: options.operation || 'And',
    count: options.count || FREE_SEARCH_DEFAULT_COUNT,
  });

  const docs = sortDocsByDateDesc(result.items).map((d) => enhanceTitle(d, config));
  const vorgaenge = groupByReference(docs, config);
  return { filters, documents: docs, vorgaenge };
}

/**
 * DocuWare gibt bei vielen Tenants generische Auto-Titel zurueck
 * ("Unnamed Document with id 74 from 5/21/2026"). Die sind in der UI
 * nicht hilfreich. Wir bauen einen besseren Titel aus den Index-Feldern.
 *
 * Strategie (tenant-agnostisch):
 *   - Wenn Title nach Auto-Pattern aussieht oder leer ist:
 *     1. Subject-aehnliche Felder bevorzugen (SUBJECT/BETREFF/TITLE/…)
 *     2. Sonst `<Dokumentenart> · <Firma/Company>` aus den ueblichen Feldern
 *     3. Sonst irgendein ausreichend langer Index-String
 *   - Sonst Original-Title behalten.
 */
const SUBJECT_LIKE_FIELDS = ['SUBJECT', 'BETREFF', 'TITLE', 'TITEL', 'DOCUMENT_TITLE', 'NAME'];
const COMPANY_LIKE_FIELDS = ['COMPANY', 'FIRMA', 'KUNDE', 'LIEFERANT', 'MANDANT'];
const NUMBER_LIKE_FIELDS = ['BELEGNUMMER', 'VERTRAGSNUMMER', 'SOURCE_NUMBER', 'CUSTOMER_NUMBER'];

function enhanceTitle(doc: StructuredSearchHit, config: VorgangsmappeConfig): StructuredSearchHit {
  if (looksMeaningful(doc.title)) return doc;

  const find = (keys: string[]): string => {
    for (const k of keys) {
      const v = stringField(doc.fields[k]);
      if (v) return v;
    }
    return '';
  };

  const subject = find(SUBJECT_LIKE_FIELDS);
  const docType = stringField(doc.fields[config.document_type_field]) || find(['DOCUMENT_TYPE', 'ART_DES_DOKUMENTES', 'BELEGART']);
  const company = find(COMPANY_LIKE_FIELDS);
  const number = find(NUMBER_LIKE_FIELDS);

  let title = '';
  if (subject) {
    // Subject ist meistens am aussagekraeftigsten — Doku-Typ als Vorspann
    title = docType ? `${docType}: ${subject}` : subject;
  } else if (docType || company) {
    const parts = [docType, company].filter(Boolean);
    title = parts.join(' · ');
  }
  if (number) title = title ? `${title} #${number}` : `#${number}`;

  if (!title) {
    // Fallback: erstes nicht-DW-Feld mit ausreichender Laenge
    for (const [k, v] of Object.entries(doc.fields)) {
      if (k.startsWith('DW') || k.startsWith('@')) continue;
      if (typeof v === 'string' && v.length >= 4) {
        title = v;
        break;
      }
    }
  }
  if (!title) title = doc.title || `Dokument ${doc.id}`;

  return { ...doc, title };
}

function stringField(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function looksMeaningful(title: string | undefined): boolean {
  if (!title) return false;
  // Auto-Pattern: "Unnamed Document with id 74 from 5/21/2026"
  if (/^Unnamed\s+Document\s+with\s+id\s+\d+/i.test(title)) return false;
  if (/^Document\s+\d+$/i.test(title)) return false;
  if (title.length < 4) return false;
  return true;
}

/* ------------------------------ Helpers ------------------------------ */

function sortDocsByDateDesc(docs: StructuredSearchHit[]): StructuredSearchHit[] {
  return [...docs].sort((a, b) => {
    const ad = extractDateMs(a);
    const bd = extractDateMs(b);
    return bd - ad;
  });
}

/**
 * DocuWare liefert Datums-Felder als `/Date(epoch)/`-Strings ODER ISO. Wir
 * versuchen beide Varianten und nutzen DATUM, fallback DWSTOREDATETIME.
 */
function extractDateMs(doc: StructuredSearchHit): number {
  const candidates = ['DATUM', 'DWSTOREDATETIME', 'DWSTOREDATE'];
  for (const key of candidates) {
    const raw = doc.fields[key];
    if (typeof raw === 'string') {
      const ms = parseDocuwareDate(raw);
      if (ms !== null) return ms;
    }
  }
  return 0;
}

function parseDocuwareDate(raw: string): number | null {
  const m = raw.match(/\/Date\((\d+)(?:[+-]\d{4})?\)\//);
  if (m) {
    const ms = parseInt(m[1]!, 10);
    return Number.isFinite(ms) ? ms : null;
  }
  const iso = Date.parse(raw);
  return Number.isFinite(iso) ? iso : null;
}

function computeDateRange(
  docs: StructuredSearchHit[],
): { from: string | null; to: string | null } | null {
  if (docs.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const doc of docs) {
    const ms = extractDateMs(doc);
    if (ms > 0) {
      if (ms < min) min = ms;
      if (ms > max) max = ms;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return {
    from: new Date(min).toISOString().slice(0, 10),
    to: new Date(max).toISOString().slice(0, 10),
  };
}

function groupByReference(
  docs: StructuredSearchHit[],
  config: VorgangsmappeConfig,
): VorgangSummary[] {
  const groups = new Map<string, StructuredSearchHit[]>();
  for (const doc of docs) {
    const refRaw = doc.fields[config.reference_field];
    const ref = typeof refRaw === 'string' ? refRaw.trim() : '';
    if (!ref) continue;
    const list = groups.get(ref) || [];
    list.push(doc);
    groups.set(ref, list);
  }
  return Array.from(groups.entries()).map(([ref, list]) => ({
    reference: ref,
    documentCount: list.length,
    dateRange: computeDateRange(list),
    cabinetId: config.cabinet.id,
    cabinetName: config.cabinet.displayName,
  }));
}
