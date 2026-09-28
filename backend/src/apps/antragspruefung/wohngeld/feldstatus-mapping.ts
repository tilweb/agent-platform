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

/**
 * Feld-Status-Pfade einer aus dem Antrag angelegten Person — ALLES, was die KI aus dem Antrag in die
 * Person schreibt, ist ein KI-Vorschlag: Name, Geburtsdatum, Erwerbsstatus, Einkommensliste,
 * Pflege/Behinderung, Ausschlüsse (§ 7), Vermögenspositionen. Listen/Objekte als Ganzes.
 * (Kindergeld-Bezug wird nach der Nachweis-Zuordnung abgeleitet und dort markiert.)
 */
export function feldStatusHaushaltPfade(p: {
  vorname?: string; nachname?: string; geburtsdatum?: string; erwerbsstatus?: string;
  einkommen?: unknown[]; pflege_behinderung?: object; ausschluesse?: unknown[]; vermoegenPositionen?: unknown[];
}): string[] {
  const out = feldStatusPersonPfade(p);
  if (p.erwerbsstatus) out.push('erwerbsstatus');
  if (p.einkommen?.length) out.push('einkommen');
  if (p.pflege_behinderung && Object.keys(p.pflege_behinderung).length) out.push('pflege_behinderung');
  if (p.ausschluesse?.length) out.push('ausschluesse');
  if (p.vermoegenPositionen?.length) out.push('vermoegenPositionen');
  return out;
}
