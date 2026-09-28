/**
 * Grundsicherung — reine Helfer für die Vorgangs-Routen (DB-frei, testbar):
 * Patch bereinigen, Audit-Felder, Statuswechsel mit Vier-Augen/Aufbewahrung, Listenfilter.
 */
import { darfEntscheiden } from '../kern/rollen';
import { aufbewahrungsPatch } from './retention';
import {
  ABSCHLUSS_ERGEBNISSE, VORGANG_STATUS,
  type AbschlussErgebnis, type Akte, type Vorgang, type VorgangAbschluss, type VorgangStatus,
} from './types';

/**
 * Felder, die der allgemeine Patch NICHT ändern darf — sie haben eigene (auditierte) Routen
 * oder werden nur vom System gesetzt.
 */
export const GESCHUETZTE_VORGANG_FELDER = [
  'id', 'akteId', 'vorgangsnummer', 'ownerId', 'permissions', 'version', 'created_at', 'updated_at',
  'status', 'abschluss',                            // → PUT /vorgaenge/:id/status
  'legalHold', 'eingeschraenkt', 'aufbewahrungBis', // → eigene Routen (Owner/Editor)
  'geprueftAm',                                     // → nur der Prüflauf
] as const;

/** Kernfelder, deren Änderung im Protokoll als Vorher/Nachher-Diff erscheint. */
export const VORGANG_AUDIT_FELDER: Array<keyof Vorgang & string> = [
  'status', 'antragsart', 'anspruchsgrund', 'sachbearbeiter', 'sachbearbeiterId', 'aktenzeichen',
  'antragsdatum', 'prioritaet', 'wohnsituation', 'wohnung', 'bwz', 'ersteingang', 'vorbezug',
  'wohngeld_antrag_laeuft', 'iban', 'frist', 'wiedervorlage', 'abschluss', 'aufbewahrungBis',
];

/** Body eines PUT /vorgaenge/:id → Updates ohne geschützte Felder + Locking-Optionen. */
export function bereinigeVorgangUpdates(body: Record<string, unknown> | null | undefined): {
  updates: Partial<Vorgang>;
  expectedVersion?: number;
  force?: boolean;
} {
  const { expectedVersion, force, ...rest } = (body ?? {}) as Record<string, unknown> & { expectedVersion?: number; force?: boolean };
  const updates: Record<string, unknown> = { ...rest };
  for (const f of GESCHUETZTE_VORGANG_FELDER) delete updates[f];
  return {
    updates: updates as Partial<Vorgang>,
    expectedVersion: typeof expectedVersion === 'number' ? expectedVersion : undefined,
    force: force === true,
  };
}

export function istVorgangStatus(s: unknown): s is VorgangStatus {
  return typeof s === 'string' && (VORGANG_STATUS as readonly string[]).includes(s);
}

/** Finale Ergebnisse (Vier-Augen-pflichtig, falls aktiv); `offen` = Vorbereitung. */
export const FINALE_ERGEBNISSE: AbschlussErgebnis[] = ABSCHLUSS_ERGEBNISSE.filter((e) => e !== 'offen');

export type StatusWechselErgebnis =
  | { ok: true; updates: Partial<Vorgang> }
  | { ok: false; code: 400 | 403; error: string };

/**
 * Statuswechsel planen (rein): validiert Status und Abschluss-Ergebnis, erzwingt das
 * Vier-Augen-Prinzip für finale Ergebnisse und setzt bei Abschluss die Aufbewahrungsfrist.
 */
export function planeStatusWechsel(o: {
  vorher: Pick<Vorgang, 'status' | 'aufbewahrungBis' | 'abschluss'>;
  status: unknown;
  abschluss?: { ergebnis?: unknown; bemerkung?: unknown } | null;
  appRole: string | undefined;
  vierAugen: boolean;
  heuteIso: string;
}): StatusWechselErgebnis {
  if (!istVorgangStatus(o.status)) return { ok: false, code: 400, error: `Unbekannter Status: ${String(o.status)}` };
  const updates: Partial<Vorgang> = { status: o.status };
  if (o.abschluss) {
    const ergebnis = o.abschluss.ergebnis;
    if (ergebnis !== undefined && !(ABSCHLUSS_ERGEBNISSE as readonly unknown[]).includes(ergebnis)) {
      return { ok: false, code: 400, error: `Unbekanntes Ergebnis: ${String(ergebnis)}` };
    }
    const e = ergebnis as AbschlussErgebnis | undefined;
    if (e && FINALE_ERGEBNISSE.includes(e) && !darfEntscheiden(o.appRole, o.vierAugen)) {
      return { ok: false, code: 403, error: 'Finaler Abschluss nur durch Freigabeberechtigte (Vier-Augen-Prinzip).' };
    }
    const abschluss: VorgangAbschluss = {
      ergebnis: e,
      bemerkung: typeof o.abschluss.bemerkung === 'string' && o.abschluss.bemerkung.trim() ? o.abschluss.bemerkung.trim() : undefined,
      am: o.vorher.abschluss?.am ?? o.heuteIso,
    };
    updates.abschluss = abschluss;
  }
  Object.assign(updates, aufbewahrungsPatch(o.vorher, updates, o.heuteIso));
  return { ok: true, updates };
}

/** Listenfilter, die nicht als Spalte existieren (Zuständigkeit, Freitext). */
export function filtereVorgaenge(
  vorgaenge: Vorgang[],
  akten: Akte[],
  f: { sachbearbeiterId?: string; q?: string },
): Vorgang[] {
  const akteById = new Map(akten.map((a) => [a.id, a]));
  const q = f.q?.trim().toLowerCase();
  return vorgaenge.filter((v) => {
    if (f.sachbearbeiterId === '-') { if (v.sachbearbeiterId) return false; }
    else if (f.sachbearbeiterId && v.sachbearbeiterId !== f.sachbearbeiterId) return false;
    if (q) {
      const a = akteById.get(v.akteId);
      const heu = [v.vorgangsnummer, v.aktenzeichen, a?.name, a?.antragstellerName].filter(Boolean).join(' ').toLowerCase();
      if (!heu.includes(q)) return false;
    }
    return true;
  });
}
