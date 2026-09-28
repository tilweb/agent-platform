/**
 * Vorrang Wohngeld ↔ Grundsicherung — Grunddaten-Vertrag.
 *
 * Beide Apps liefern über `grunddatenFuerVorrangpruefung(snapshot)` dieselbe Datenform.
 * Eine spätere, deterministische Vorrang-Einschätzung (Pilot) hängt NUR an diesem Vertrag,
 * nicht an den Fachmodellen der Apps. Dieses Modul enthält KEINE Rechenlogik (keine
 * Wohngeld- oder Bedarfsberechnung, keine Einschätzung) und importiert nichts aus den Apps.
 *
 * Grundsatz „unbekannt statt geraten": JEDES optionale Feld darf fehlen. Fehlt ein Wert,
 * ist er unbekannt — er wird nicht aus Nachbarangaben erschlossen, nicht mit 0/false
 * vorbelegt und nicht aus einem anderen Begriff umgedeutet (z. B. setzt Wohngeld
 * `bruttokaltmiete`, lässt aber `kaltmiete`/`nebenkosten_kalt` leer). `false`/`0` heißt
 * „ausdrücklich nein bzw. null". Welche Werte fehlen, sagt {@link vollstaendigkeit}.
 *
 * Personenbezug über `person` = Index in `haushalt` (ohne Namen, Datensparsamkeit);
 * `personId` nur zur Rückverfolgung in der liefernden App.
 *
 * Fachgrundlage: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 5.3,
 * docs/antragspruefung-architektur-konzept-2026-09-27.md („Grunddaten-Vertrag").
 */
import type {
  VorrangEinkommensart, VorrangRentenart, VorrangTransferart, VorrangVermoegensart,
} from './arten';

export * from './arten';

/** Stand der Vertragsform — bei jeder Formänderung hochzählen. */
export const VORRANG_GRUNDDATEN_VERSION = 1;

/** Liefernde App. */
export type VorrangQuelle = 'wohngeld' | 'grundsicherung';

/** Rolle im Sinne der Einsatzgemeinschaft (§ 43 Abs. 1 SGB XII) — auch für Wohngeld-Haushalte. */
export type VorrangRolle = 'antragsteller' | 'partner' | 'haushaltsangehoerig';

/** Verhältnis zur antragstellenden Person. */
export type VorrangVerwandtschaft = 'ehegatte' | 'lebenspartner' | 'eheaehnlich' | 'kind' | 'elternteil' | 'sonstige';

/** Partnerschaft der antragstellenden Person. `keine` = ausdrücklich keine. */
export type VorrangPartnerschaft = 'verheiratet' | 'lebenspartnerschaft' | 'eheaehnlich' | 'getrennt_lebend' | 'keine';

export interface VorrangHaushaltsmitglied {
  rolle: VorrangRolle;
  /** ISO `YYYY-MM-DD`. */
  geburtsdatum?: string;
  verwandtschaft?: VorrangVerwandtschaft;
  /** Vermögen erfasst (auch „ausdrücklich keins"). Fehlt = keine Angabe zur Person. */
  vermoegen_angegeben?: boolean;
  /** ID der Person in der liefernden App (Rückverfolgung). */
  personId?: string;
}

export interface VorrangEinkommen {
  /** Index in `haushalt`. */
  person: number;
  art: VorrangEinkommensart;
  /** Originalwert der liefernden App (Nachvollziehbarkeit). */
  art_quelle: string;
  /** Nur bei Renten, soweit bekannt. */
  rentenart?: VorrangRentenart;
  /** Monatsbetrag in Euro. */
  betrag_monat?: number;
  /** `true` = Bruttobetrag, `false` = Zahl-/Nettobetrag; fehlt = unbekannt. */
  brutto?: boolean;
}

/** Abzüge je Person (für die spätere Bereinigung; hier nur erhoben). */
export interface VorrangAbzuege {
  person: number;
  /** KV/PV-Beiträge werden selbst gezahlt (`true`) bzw. von Rente/Lohn einbehalten oder entfallen (`false`). */
  kv_pv_selbst_gezahlt?: boolean;
  /** Monatlicher KV/PV-Beitrag in Euro. */
  kv_pv_beitrag_monat?: number;
  /** Steuern auf das Einkommen werden gezahlt. */
  steuern?: boolean;
}

export interface VorrangWohnkosten {
  /** Grundmiete (ohne Nebenkosten). */
  kaltmiete?: number;
  /** Kalte Nebenkosten (Betriebskosten ohne Heizung). */
  nebenkosten_kalt?: number;
  /** Bruttokaltmiete (Grundmiete + kalte Nebenkosten), wenn nur so erfasst (Wohngeld, § 9 WoGG). */
  bruttokaltmiete?: number;
  /** Monatliche Heizkosten. */
  heizkosten?: number;
  /** Warmwassererzeugung. */
  warmwasser_erzeugung?: 'zentral' | 'dezentral';
  /** Monatliche Warmwasserkosten, soweit getrennt erfasst. */
  warmwasser_kosten?: number;
  /** Heizkosten sind in der Miete enthalten (Pauschalmiete). */
  heizung_in_miete?: boolean;
  wohnflaeche_qm?: number;
  /** Personen in der Wohnung (Kopfteil). */
  bewohner?: number;
  /** Selbst genutztes Eigentum (`true`) bzw. Miete/Untermiete (`false`). */
  eigentum?: boolean;
}

export interface VorrangVermoegen {
  person: number;
  art: VorrangVermoegensart;
  art_quelle: string;
  betrag?: number;
  /** Als Schonvermögen gekennzeichnet (nur Vermerk der Erfassung, keine Bewertung). */
  schonvermoegen?: boolean;
}

export interface VorrangAlterEm {
  person: number;
  /** Altersgrenze § 41 Abs. 2 SGB XII bis Ende des Antragsmonats erreicht. */
  altersgrenze_erreicht?: boolean;
  /** Datum, mit dessen Ablauf die Altersgrenze erreicht ist (ISO). */
  altersgrenze_am?: string;
  /** Dauerhaft voll erwerbsgemindert (`false` = befristet, teilweise oder arbeitsmarktbedingt). */
  em_voll_dauerhaft?: boolean;
}

export interface VorrangSchwerbehinderung {
  person: number;
  gdb?: number;
  /** Merkzeichen (z. B. G, aG); fehlt = nicht erfasst, `[]` = ausdrücklich keine. */
  merkzeichen?: string[];
}

export interface VorrangTransferleistung {
  /** Index in `haushalt`; fehlt = Haushalt/Vorgang als Ganzes. */
  person?: number;
  art: VorrangTransferart;
  art_quelle: string;
  /** `bezug` = bewilligt/laufend oder früher bezogen, `beantragt` = noch nicht beschieden. */
  stand?: 'bezug' | 'beantragt';
  von?: string;
  bis?: string;
  /** Woher die Angabe stammt. */
  herkunft: 'angabe' | 'dokument';
}

/** Stelle, bei der der Antrag zuerst eingegangen ist (§ 16 Abs. 2 SGB I). */
export type VorrangErsteStelle = 'wohngeldstelle' | 'grundsicherungstraeger' | 'andere';

export interface VorrangEingang {
  /** Antragsdatum laut Vorgang (ISO). */
  antragsdatum?: string;
  /** Datum des Ersteingangs (ISO). */
  datum?: string;
  erste_stelle?: VorrangErsteStelle;
  /** Bezeichnung einer anderen Stelle (Freitext der Erfassung). */
  erste_stelle_bezeichnung?: string;
}

/** Die Grunddaten eines Vorgangs für eine spätere Vorrang-Einschätzung. */
export interface VorrangGrunddaten {
  version: typeof VORRANG_GRUNDDATEN_VERSION;
  quelle: VorrangQuelle;
  vorgangId: string;
  /** Maßgeblicher Stichtag für Altersgrenze (ISO), i. d. R. das Antragsdatum. */
  stichtag?: string;
  /** Antragsteller:in zuerst. */
  haushalt: VorrangHaushaltsmitglied[];
  partnerschaft?: VorrangPartnerschaft;
  einkommen: VorrangEinkommen[];
  /** Je Person des Haushalts (gleiche Reihenfolge). */
  abzuege: VorrangAbzuege[];
  wohnkosten: VorrangWohnkosten;
  vermoegen: VorrangVermoegen[];
  /** Je Person des Haushalts (gleiche Reihenfolge). */
  alter_em: VorrangAlterEm[];
  /** Je Person des Haushalts (gleiche Reihenfolge). */
  schwerbehinderung: VorrangSchwerbehinderung[];
  transferleistungen: VorrangTransferleistung[];
  eingang: VorrangEingang;
}

/** Personen der Einsatzgemeinschaft (Antragsteller:in und Partner:in) als Indizes. */
export function einsatzgemeinschaft(g: VorrangGrunddaten): number[] {
  return g.haushalt.flatMap((h, i) => (h.rolle === 'antragsteller' || h.rolle === 'partner' ? [i] : []));
}

/**
 * Welche Pflicht-Grunddaten fehlen (reine Funktion, keine Bewertung).
 * Pfade in Punktnotation, Personen über ihren Index, z. B. `haushalt[1].geburtsdatum`.
 *
 * Pflicht: Haushalt mit Antragsteller:in und Geburtsdaten; Partnerschaft; Vermögensangabe
 * der Einsatzgemeinschaft; Beträge vorhandener Einkommens-/Vermögenspositionen; mindestens
 * eine Einkommensposition im Haushalt (fehlt sie, ist „kein Einkommen" zu bestätigen);
 * Wohnkosten (Eigentum ja/nein, Miete getrennt oder brutto-kalt, Heizkosten, Wohnfläche,
 * Bewohner); Altersgrenze der Einsatzgemeinschaft und — wo sie nicht erreicht ist — die
 * Erwerbsminderung; Eingangs- bzw. Antragsdatum.
 */
export function vollstaendigkeit(g: VorrangGrunddaten): { fehlend: string[] } {
  const fehlend: string[] = [];
  const f = (pfad: string) => { if (!fehlend.includes(pfad)) fehlend.push(pfad); };
  const eg = new Set(einsatzgemeinschaft(g));

  if (g.haushalt.length === 0) f('haushalt');
  if (!g.haushalt.some((h) => h.rolle === 'antragsteller')) f('haushalt.antragsteller');
  g.haushalt.forEach((h, i) => {
    if (!h.geburtsdatum) f(`haushalt[${i}].geburtsdatum`);
    if (eg.has(i) && h.vermoegen_angegeben === undefined) f(`haushalt[${i}].vermoegen_angegeben`);
  });
  if (g.partnerschaft === undefined) f('partnerschaft');

  if (g.einkommen.length === 0) f('einkommen');
  g.einkommen.forEach((e, i) => { if (e.betrag_monat === undefined) f(`einkommen[${i}].betrag_monat`); });
  g.vermoegen.forEach((v, i) => { if (v.betrag === undefined) f(`vermoegen[${i}].betrag`); });

  const w = g.wohnkosten;
  if (w.eigentum === undefined) f('wohnkosten.eigentum');
  if (w.eigentum !== true && w.bruttokaltmiete === undefined) {
    if (w.kaltmiete === undefined) f('wohnkosten.kaltmiete');
    if (w.nebenkosten_kalt === undefined) f('wohnkosten.nebenkosten_kalt');
  }
  if (w.heizkosten === undefined && w.heizung_in_miete !== true) f('wohnkosten.heizkosten');
  if (w.wohnflaeche_qm === undefined) f('wohnkosten.wohnflaeche_qm');
  if (w.bewohner === undefined) f('wohnkosten.bewohner');

  for (const a of g.alter_em) {
    if (!eg.has(a.person)) continue;
    if (a.altersgrenze_erreicht === undefined) f(`alter_em[${a.person}].altersgrenze_erreicht`);
    if (a.altersgrenze_erreicht !== true && a.em_voll_dauerhaft === undefined) f(`alter_em[${a.person}].em_voll_dauerhaft`);
  }

  if (!g.eingang.datum && !g.eingang.antragsdatum) f('eingang.datum');
  return { fehlend };
}
