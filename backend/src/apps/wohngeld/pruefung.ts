/**
 * Wohngeld — Prüflauf (Vollständigkeit + Plausibilität) ausführen und Prüfschritte synchronisieren.
 *
 * Eine Stelle für alle Auslöser: Button „Prüfen", Posteingang/Upload und die automatische
 * Neuprüfung nach fachlich relevanten Änderungen (Personen, Dokumente, Vorgangsfelder,
 * Feld-Status). Deterministisch und idempotent — manuelle und erledigte Schritte bleiben.
 * Setzt den Prüfzeitpunkt (`geprueftAm`) ohne Versionssprung.
 *
 * Spec: docs/wohngeld-testrueckmeldungen-umsetzung-spec-2026-09-24.md (Punkte 1 und 3)
 */
import { pruefeVorgang } from './checker';
import { getVorgangSnapshot, setzeGeprueftAm, syncPruefschritte } from './storage';
import type { Pruefschritt } from './types';

export interface PruefErgebnis {
  befundeCount: number;
  pruefschritte: Pruefschritt[];
  geprueftAm: string;
}

/** Prüft den Vorgang und synchronisiert die Prüfschritte. `null`, wenn der Vorgang fehlt. */
export async function pruefeUndSynchronisiere(vorgangId: string): Promise<PruefErgebnis | null> {
  const snapshot = await getVorgangSnapshot(vorgangId);
  if (!snapshot) return null;
  const befunde = pruefeVorgang(snapshot);
  const pruefschritte = await syncPruefschritte(vorgangId, befunde);
  const geprueftAm = new Date().toISOString();
  await setzeGeprueftAm(vorgangId, geprueftAm);
  return { befundeCount: befunde.length, pruefschritte, geprueftAm };
}

/**
 * Automatische Neuprüfung nach einer Änderung. Fehler sind nicht fatal (die auslösende
 * Änderung ist gespeichert). Bei eingeschränkter Verarbeitung (Art. 18) keine Prüfung.
 */
export async function pruefeAutomatisch(vorgangId: string | undefined | null): Promise<void> {
  if (!vorgangId) return;
  try {
    const snapshot = await getVorgangSnapshot(vorgangId);
    if (!snapshot || snapshot.vorgang.eingeschraenkt) return;
    await syncPruefschritte(vorgangId, pruefeVorgang(snapshot));
    await setzeGeprueftAm(vorgangId);
  } catch (err) {
    console.warn('[wohngeld] automatische Neuprüfung fehlgeschlagen:', err instanceof Error ? err.message : err);
  }
}
