/**
 * Grundsicherung — Antragsdaten in den Vorgang übernehmen (Posteingang, Upload am Vorgang) und
 * fachliche Helfer des Posteingangs (Betreff, Weiterleitung/Ersteingang). Reine Funktionen.
 *
 * - Neuer Vorgang: alle gelesenen Werte.
 * - Bestehender Vorgang (Nachreichung, Upload am Vorgang): nur LEERE Felder füllen — von Hand
 *   erfasste Werte bleiben. Die Antragsart überschreibt ein gelesener Antrag (das Anlegeformular
 *   setzt sie nur als Vorbelegung).
 * Nur tatsächlich übernommene Pfade werden als KI-Vorschlag (Feld-Status) markiert.
 */
import { dayPart } from '../_antrag-kern/datum';
import type { ExtrahierteStammdaten, Ersteingang, PosteingangDatei, PosteingangQuelle, Vorgang, Wohnung } from './types';

const leer = (v: unknown) => v === undefined || v === null || v === '';

export interface Uebernahme {
  updates: Partial<Vorgang>;
  /** Übernommene Feldpfade (Feld-Status-Schreibweise, z. B. „wohnung.kaltmiete"). */
  pfade: string[];
}

type VorgangTeil = Pick<Vorgang,
  'antragsdatum' | 'antragsart' | 'anspruchsgrund' | 'aktenzeichen' | 'wohnsituation' | 'wohnung' | 'iban' | 'vorbezug' | 'wohngeld_antrag_laeuft'>;

export function stammdatenUebernahme(vorgang: VorgangTeil, s: ExtrahierteStammdaten, nurLeere: boolean): Uebernahme {
  const updates: Partial<Vorgang> = {};
  const pfade: string[] = [];
  const darf = (alt: unknown) => !nurLeere || leer(alt);
  const skalar = <K extends keyof VorgangTeil>(k: K, v: VorgangTeil[K] | undefined) => {
    if (leer(v) || !darf(vorgang[k])) return;
    if (v !== vorgang[k]) (updates as Record<string, unknown>)[k] = v;
    pfade.push(k);
  };

  skalar('antragsdatum', s.antragsdatum);
  if (s.antragsart && s.antragsart !== vorgang.antragsart) { updates.antragsart = s.antragsart; pfade.push('antragsart'); }
  else if (s.antragsart && !nurLeere) pfade.push('antragsart');
  skalar('anspruchsgrund', s.anspruchsgrund);
  skalar('aktenzeichen', s.aktenzeichen);
  skalar('wohnsituation', s.wohnsituation);
  skalar('iban', s.iban);
  skalar('wohngeld_antrag_laeuft', s.wohngeld_antrag_laeuft);
  if (s.vorbezug?.leistung && darf(vorgang.vorbezug?.leistung)) { updates.vorbezug = { ...s.vorbezug }; pfade.push('vorbezug'); }

  const w: Wohnung = { ...(vorgang.wohnung ?? {}) };
  let wohnungGeaendert = false;
  const setze = <K extends keyof Wohnung>(k: K, v: Wohnung[K] | undefined) => {
    if (leer(v) || !darf(w[k])) return;
    if (w[k] !== v) { w[k] = v; wohnungGeaendert = true; }
    pfade.push(`wohnung.${k}`);
  };
  setze('strasse', s.adresse?.strasse);
  setze('hausnummer', s.adresse?.hausnummer);
  setze('plz', s.adresse?.plz);
  setze('ort', s.adresse?.ort);
  for (const k of ['kaltmiete', 'nebenkosten_kalt', 'heizkosten', 'warmwasser', 'wohnflaeche_qm', 'bewohner_anzahl', 'heizung_in_miete_enthalten'] as const) {
    setze(k, s.wohnung?.[k] as Wohnung[typeof k] | undefined);
  }
  if (wohnungGeaendert) updates.wohnung = w;

  return { updates, pfade };
}

// ── Weiterleitung / Ersteingang (§ 16 Abs. 2 SGB I) ─────────────────────────

const STELLE_MUSTER = /weiter(?:ge)?leit(?:et|ung)\s*(?:von|durch|vom|aus)?\s*:?\s*(.+?)\s*\)?$/i;

/**
 * Erste Stelle aus einem Betreff wie „Weitergeleitet von Wohngeldstelle Musterstadt" oder
 * „Schmidt, Erika — Erstantrag (weitergeleitet von Deutsche Rentenversicherung)". Unbekannt → undefined.
 */
export function stelleAusBetreff(betreff?: string): string | undefined {
  if (!betreff) return undefined;
  const m = betreff.match(STELLE_MUSTER);
  const stelle = m?.[1]?.replace(/^(der|dem|den)\s+/i, '').replace(/[)\].,;]+$/, '').trim();
  return stelle || undefined;
}

/**
 * Ersteingang eines weitergeleiteten Eingangs: Eingangsdatum = Datum des Ersteingangs bei der
 * ersten Stelle (so eingeliefert), Stelle aus Metadatum (`data.weitergeleitetVon`) oder Betreff.
 * Andere Quellen → undefined.
 */
export function ersteingangAus(e: { quelle: PosteingangQuelle; eingegangenAm: string; betreff?: string; data?: Record<string, unknown> }): Ersteingang | undefined {
  if (e.quelle !== 'weiterleitung') return undefined;
  const meta = typeof e.data?.weitergeleitetVon === 'string' ? e.data.weitergeleitetVon.trim() : '';
  const stelle = meta || stelleAusBetreff(e.betreff);
  const datum = dayPart(e.eingegangenAm) ?? undefined;
  return { ...(datum ? { datum } : {}), ...(stelle ? { stelle } : {}) };
}

/** Ersteingang am Vorgang nur setzen, wenn dort noch keiner erfasst ist. */
export function ersteingangUebernahme(vorgang: Pick<Vorgang, 'ersteingang'>, e: Ersteingang | undefined): Partial<Vorgang> {
  if (!e || (!e.datum && !e.stelle)) return {};
  if (vorgang.ersteingang?.datum || vorgang.ersteingang?.stelle) return {};
  return { ersteingang: e };
}

// ── Betreff ────────────────────────────────────────────────────────────────

const ANTRAGSART_KURZ: Record<string, string> = {
  erstantrag: 'Erstantrag', weiterbewilligung: 'Weiterbewilligung', aenderung: 'Änderung',
};

/**
 * Sprechender Betreff aus den ausgewerteten Dateien, z. B. „Schmidt, Erika — Erstantrag".
 * Ohne Antrag: erste Nachweis-Identität; sonst der erste Dateiname. Ein Weiterleitungs-Hinweis
 * im bisherigen Betreff bleibt als Zusatz erhalten (Stelle für den Ersteingang).
 */
export function leiteBetreffAb(dateien: PosteingangDatei[], betreffAlt?: string): string | undefined {
  const antrag = dateien.find((d) => d.typ === 'grundsicherungsantrag' && d.stammdaten);
  const at = antrag?.stammdaten?.antragsteller;
  let betreff: string | undefined;
  if (at && (at.nachname || at.vorname)) {
    const name = [at.nachname, at.vorname].filter(Boolean).join(', ');
    const art = antrag?.stammdaten?.antragsart ? ANTRAGSART_KURZ[antrag.stammdaten.antragsart] : undefined;
    betreff = art ? `${name} — ${art}` : name;
  } else {
    const nachweis = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname));
    betreff = nachweis ? [nachweis.nachname, nachweis.vorname].filter(Boolean).join(', ') : dateien[0]?.dateiname;
  }
  const stelle = stelleAusBetreff(betreffAlt);
  if (stelle && betreff && !stelleAusBetreff(betreff)) return `${betreff} (weitergeleitet von ${stelle})`;
  return betreff ?? betreffAlt;
}

// ── Korrektur aus dem Posteingang-Formular ──────────────────────────────────

/** Nur gesetzte Werte übernehmen (JSON lässt `undefined` weg, leere Strings zählen als nicht gesetzt). */
function gesetzte<T extends object>(o: T | undefined): Partial<T> {
  const aus: Partial<T> = {};
  for (const [k, v] of Object.entries(o ?? {})) if (!leer(v)) (aus as Record<string, unknown>)[k] = v;
  return aus;
}

/**
 * Führt die Korrektur aus dem Formular mit den erkannten Antragsdaten zusammen. Das Formular
 * zeigt nur einen Teil der Felder — alles andere Erkannte (Personenliste mit Einkommen/Vermögen,
 * IBAN, Vorbezug, weitere Wohnungsangaben) bleibt erhalten. Gesetzte Formularwerte gewinnen;
 * Name/Geburtsdatum der antragstellenden Person werden auch in der Personenliste nachgezogen.
 */
export function korrigiereStammdaten(erkannt: ExtrahierteStammdaten | undefined, korrektur: ExtrahierteStammdaten): ExtrahierteStammdaten {
  const basis = erkannt ?? {};
  const oben = gesetzte(korrektur);
  delete oben.antragsteller; delete oben.adresse; delete oben.wohnung; delete oben.personen; delete oben.ersteingang;
  const antragsteller = { ...(basis.antragsteller ?? {}), ...gesetzte(korrektur.antragsteller) };
  const ergebnis: ExtrahierteStammdaten = {
    ...basis,
    ...oben,
    antragsteller,
    adresse: { ...(basis.adresse ?? {}), ...gesetzte(korrektur.adresse) },
    wohnung: { ...(basis.wohnung ?? {}), ...gesetzte(korrektur.wohnung) },
  };
  if (basis.personen?.length) {
    ergebnis.personen = basis.personen.map((p) => (p.rolle === 'antragsteller' ? { ...p, ...gesetzte(korrektur.antragsteller) } : p));
  }
  const eingang = gesetzte(korrektur.ersteingang);
  if (eingang.datum || eingang.stelle) ergebnis.ersteingang = eingang as Ersteingang;
  return ergebnis;
}

/** Ersteingang: von Hand erfasste Werte gewinnen über die aus dem Posteingang abgeleiteten. */
export function ersteingangMitKorrektur(abgeleitet: Ersteingang | undefined, manuell: Ersteingang | undefined): Ersteingang | undefined {
  const e = { ...(abgeleitet ?? {}), ...gesetzte(manuell) };
  return e.datum || e.stelle ? e : undefined;
}
