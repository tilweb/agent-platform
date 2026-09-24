/**
 * Wohngeld — Antragsdaten in den Vorgang übernehmen (Posteingang, Upload am Vorgang).
 *
 * Reine Funktion: berechnet die Vorgangs-Änderungen und die Feldpfade, die tatsächlich aus
 * dem Antrag übernommen wurden (nur diese werden als KI-Vorschlag markiert).
 * - Neuer Vorgang: alle gelesenen Werte.
 * - Bestehender Vorgang (Nachreichung, Upload am Vorgang): nur LEERE Felder füllen — von Hand
 *   erfasste Werte bleiben. Wohngeldart und Antragsart überschreibt ein gelesener Antrag
 *   (das Anlegeformular setzt sie nur als Vorbelegung).
 *
 * Spec: docs/wohngeld-testrueckmeldungen-umsetzung-spec-2026-09-24.md (Punkte 2 und 5)
 */
import type { ExtrahierteStammdaten } from './extraction';
import type { Vorgang, WohnungMiete } from './types';

const leer = (v: unknown) => v === undefined || v === null || v === '';

export interface Uebernahme {
  updates: Partial<Vorgang>;
  /** Übernommene Feldpfade (Feld-Status-Schreibweise, z. B. „wohnung.plz"). */
  pfade: string[];
}

export function stammdatenUebernahme(
  vorgang: Pick<Vorgang, 'antragsdatum' | 'wohngeldart' | 'antragsart' | 'wohnung' | 'wohngeldnummer'>,
  s: ExtrahierteStammdaten,
  nurLeere: boolean,
): Uebernahme {
  const updates: Partial<Vorgang> = {};
  const pfade: string[] = [];
  const darf = (alt: unknown) => !nurLeere || leer(alt);

  if (s.antragsdatum && darf(vorgang.antragsdatum)) {
    if (s.antragsdatum !== vorgang.antragsdatum) updates.antragsdatum = s.antragsdatum;
    pfade.push('antragsdatum');
  }
  if (s.wohngeldart && s.wohngeldart !== vorgang.wohngeldart) { updates.wohngeldart = s.wohngeldart; pfade.push('wohngeldart'); }
  else if (s.wohngeldart && !nurLeere) pfade.push('wohngeldart');
  if (s.antragsart && s.antragsart !== vorgang.antragsart) { updates.antragsart = s.antragsart; pfade.push('antragsart'); }
  else if (s.antragsart && !nurLeere) pfade.push('antragsart');
  if (s.wohngeldnummer && darf(vorgang.wohngeldnummer)) { updates.wohngeldnummer = s.wohngeldnummer; pfade.push('wohngeldnummer'); }

  const w: WohnungMiete = { ...(vorgang.wohnung ?? {}) };
  const setze = <K extends keyof WohnungMiete>(k: K, v: WohnungMiete[K] | undefined) => {
    if (leer(v) || !darf(w[k])) return;
    w[k] = v; pfade.push(`wohnung.${k}`);
  };
  setze('strasse', s.adresse?.strasse);
  setze('hausnummer', s.adresse?.hausnummer);
  setze('plz', s.adresse?.plz);
  setze('ort', s.adresse?.ort);
  setze('miete', s.wohnung?.miete);
  setze('wohnflaeche_qm', s.wohnung?.wohnflaeche_qm);
  if (pfade.some((p) => p.startsWith('wohnung.'))) updates.wohnung = w;

  return { updates, pfade };
}
