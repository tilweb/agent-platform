/**
 * Wohngeld — Feld-Provenienz-Mapping (WP3), rein/testbar.
 *
 * Bildet aus den beim Verteilen übernommenen Wohngeldantrag-Stammdaten die Liste
 * der Feld-Pfade, die als KI-Vorschlag (`quelle='llm', bestaetigt=false`) markiert
 * werden. Pragmatisch: nur tatsächlich befüllte Felder.
 */
import type { ExtrahierteStammdaten } from './extraction';

/** Vorgang-Feldpfade, die durch die Stammdaten befüllt wurden. */
export function feldStatusVorgangPfade(s: ExtrahierteStammdaten | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.antragsdatum) out.push('antragsdatum');
  if (s.wohngeldart) out.push('wohngeldart');
  if (s.antragsart) out.push('antragsart');
  if (s.adresse?.strasse) out.push('wohnung.strasse');
  if (s.adresse?.hausnummer) out.push('wohnung.hausnummer');
  if (s.adresse?.plz) out.push('wohnung.plz');
  if (s.adresse?.ort) out.push('wohnung.ort');
  if (s.wohnung?.miete !== undefined) out.push('wohnung.miete');
  if (s.wohnung?.wohnflaeche_qm !== undefined) out.push('wohnung.wohnflaeche_qm');
  return out;
}

/** Person-Feldpfade des Antragstellers, die durch die Stammdaten befüllt wurden. */
export function feldStatusPersonPfade(at: ExtrahierteStammdaten['antragsteller'] | undefined): string[] {
  if (!at) return [];
  const out: string[] = [];
  if (at.nachname) out.push('nachname');
  if (at.vorname) out.push('vorname');
  if (at.geburtsdatum) out.push('geburtsdatum');
  return out;
}
