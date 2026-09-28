/**
 * § 13 WoGG — Gesamteinkommen: Aggregationslogik (rein, DB-frei, testbar).
 *
 * NUR die Struktur (welche Positionen addiert/abgezogen werden) — KEINE
 * Wohngeld-Betragsberechnung (§ 19). Verwendet für die Plausibilitätsprüfung
 * von Einkommensangaben.
 *
 * Kette:
 *   Gesamteinkommen (§13) = Σ Jahreseinkommen (§14) je Mitglied
 *                            − Freibeträge (§17) − Unterhaltsabzüge (§18)
 *   Jahreseinkommen (§14)  = Σ positive Einkünfte + Hinzurechnungen − §16-Pauschale
 *   Monatswert = Gesamteinkommen / 12 (§13 Abs. 2)
 */
import type { Person, Dokument, Frequenz, UnterhaltVerwandtschaft } from './types';

/** § 16 — abziehbare Beitrags-/Steuerkategorien (je 10 %, max. 30 %). */
export interface Abzugskategorien16 {
  steuern?: boolean;         // Einkommen-/Lohnsteuer
  kvPv?: boolean;            // gesetzl. Kranken- + Pflegeversicherung
  rv?: boolean;             // gesetzl. Rentenversicherung
}

/** Freibeträge nach § 17 (Jahresbeträge). */
export const FREIBETRAG_17 = {
  schwerbehinderung: 1800,   // GdB 100 oder GdB < 100 + Pflegebedürftigkeit (Nr. 1)
  ns_verfolgung: 750,        // Nr. 2
  alleinerziehend: 1320,     // Nr. 3
  kind_erwerb_max: 1200,     // Nr. 4 — max. je Kind i. H. des eigenen Erwerbseinkommens
} as const;

/** § 18 — Höchstbeträge Unterhaltsabzug (ohne Titel/Nachweis). */
export const UNTERHALT_18_MAX = {
  auswaertige_ausbildung: 3000,   // Nr. 1
  kind_anderer_elternteil: 3000,  // Nr. 2
  ehegatte_getrennt: 6000,        // Nr. 3
  sonstige: 3000,                 // Nr. 4
} as const;

/**
 * § 18 — Kappungsgrenze je Verwandtschaftsverhältnis (neue forml-Shape).
 * Mappt das UI-Verwandtschaftsfeld auf die § 18-Höchstbeträge.
 */
export const UNTERHALT_18_MAX_VERWANDTSCHAFT: Record<UnterhaltVerwandtschaft, number> = {
  kind: UNTERHALT_18_MAX.kind_anderer_elternteil,       // 3000
  auswaertige_ausbildung: UNTERHALT_18_MAX.auswaertige_ausbildung, // 3000
  ehegatte_getrennt: UNTERHALT_18_MAX.ehegatte_getrennt, // 6000
  elternteil: UNTERHALT_18_MAX.sonstige,                 // 3000
  sonstige: UNTERHALT_18_MAX.sonstige,                   // 3000
};

/**
 * Umrechnungsfaktor einer Zahlungsfrequenz auf einen Jahresbetrag (reiner Helfer).
 * `einmalig` zählt als 1× (Jahresbetrag = Betrag); fehlend/unbekannt → 12 (wie monatlich).
 */
export function frequenzProJahr(frequenz?: Frequenz): number {
  switch (frequenz) {
    case 'taeglich': return 365;
    case 'woechentlich': return 52;
    case 'vierzehntaegig': return 26;
    case 'monatlich': return 12;
    case 'vierteljaehrlich': return 4;
    case 'jaehrlich': return 1;
    case 'einmalig': return 1;
    case 'schwankend': return 12;
    case 'sonstige': return 12;
    default: return 12;
  }
}

/**
 * § 16 — Staffel-Abzugssatz: 10 % je zutreffender Kategorie, max. 30 %.
 * Rückgabe als Faktor (0 / 0.1 / 0.2 / 0.3).
 */
export function abzugssatz16(kat: Abzugskategorien16): number {
  const n = (kat.steuern ? 1 : 0) + (kat.kvPv ? 1 : 0) + (kat.rv ? 1 : 0);
  return Math.min(n, 3) * 0.1;
}

/** Rohes Jahreseinkommen einer Person: Summe der (positiven) Jahresbeträge aller Positionen. */
export function jahreseinkommenRoh(person: Person): number {
  const pos = person.einkommen ?? [];
  return pos.reduce((sum, p) => {
    const jahr = p.betrag_jaehrlich ?? ((p.betrag_monatlich ?? 0) * 12);
    return sum + Math.max(0, jahr); // keine Verlustverrechnung (§14 Abs. 1)
  }, 0);
}

/**
 * Jahreseinkommen nach § 14/§ 16 einer Person.
 * @param kat  zutreffende §16-Kategorien (default: keine → kein Abzug).
 */
export function jahreseinkommen(person: Person, kat: Abzugskategorien16 = {}): number {
  const roh = jahreseinkommenRoh(person);
  return roh * (1 - abzugssatz16(kat));
}

/** Freibeträge nach § 17 für eine Person (Jahresbetrag). */
export function freibetraege17(person: Person): number {
  let f = 0;
  const pb = person.pflege_behinderung;
  if (pb) {
    const gdb = pb.schwerbehinderungsgrad ?? 0;
    if (gdb >= 100 || (gdb > 0 && (pb.pflegebeduerftig || (pb.pflegegrad ?? 0) > 0))) {
      f += FREIBETRAG_17.schwerbehinderung;
    }
  }
  // Kind < 25 mit eigenem Erwerbseinkommen: Freibetrag i. H. des Erwerbseinkommens, max. 1.200 €
  if (person.rolle === 'kind') {
    const erwerb = (person.einkommen ?? [])
      .filter(p => p.art === 'lohn_gehalt' || p.art === 'selbststaendig')
      .reduce((s, p) => s + (p.betrag_jaehrlich ?? (p.betrag_monatlich ?? 0) * 12), 0);
    f += Math.min(Math.max(0, erwerb), FREIBETRAG_17.kind_erwerb_max);
  }
  return f;
}

export interface GesamteinkommenInput {
  person: Person;
  kat?: Abzugskategorien16;
}

export interface GesamteinkommenErgebnis {
  proPersonJahr: Array<{ personId: string; jahreseinkommen: number; freibetraege: number }>;
  summeJahreseinkommen: number;
  summeFreibetraege: number;
  unterhaltsabzuege: number;
  gesamteinkommenJahr: number;
  gesamteinkommenMonat: number;
}

/**
 * § 13 — Gesamteinkommen des Haushalts.
 * @param unterhaltsabzuege  Summe § 18 (aus Vorgangsdaten), default 0.
 */
export function gesamteinkommen(inputs: GesamteinkommenInput[], unterhaltsabzuege = 0): GesamteinkommenErgebnis {
  const proPersonJahr = inputs.map(({ person, kat }) => ({
    personId: person.id,
    jahreseinkommen: jahreseinkommen(person, kat ?? {}),
    freibetraege: freibetraege17(person),
  }));
  const summeJahreseinkommen = proPersonJahr.reduce((s, p) => s + p.jahreseinkommen, 0);
  const summeFreibetraege = proPersonJahr.reduce((s, p) => s + p.freibetraege, 0);
  const gesamteinkommenJahr = Math.max(0, summeJahreseinkommen - summeFreibetraege - unterhaltsabzuege);
  return {
    proPersonJahr,
    summeJahreseinkommen,
    summeFreibetraege,
    unterhaltsabzuege,
    gesamteinkommenJahr,
    gesamteinkommenMonat: gesamteinkommenJahr / 12,
  };
}

/**
 * Vermögens-Freigrenze § 21 Nr. 3: 60.000 € für das erste, +30.000 € je weiteres Mitglied.
 */
export function vermoegensFreigrenze(anzahlHaushaltsmitglieder: number): number {
  const n = Math.max(1, anzahlHaushaltsmitglieder);
  return 60000 + 30000 * (n - 1);
}

/**
 * Vermögenssumme einer Person: Summe der strukturierten `vermoegenPositionen`,
 * ansonsten der Legacy-Einzelwert `vermoegen`. Rückwärtskompatibel.
 */
export function vermoegenSummeFuer(person: Person): number {
  const positionen = person.vermoegenPositionen;
  if (positionen && positionen.length > 0) {
    return positionen.reduce((s, p) => s + Math.max(0, p.betrag ?? 0), 0);
  }
  return Math.max(0, person.vermoegen ?? 0);
}

/** Haushalts-Vermögenssumme über alle Personen (§ 21 Nr. 3). */
export function haushaltsVermoegen(personen: Person[]): number {
  return personen.reduce((s, p) => s + vermoegenSummeFuer(p), 0);
}

/**
 * § 18 — Unterhaltsabzüge einer einzelnen Person aus ihren `unterhaltsverpflichtungen`.
 *
 * Neue forml-Shape (`verwandtschaft` gesetzt): Jahresbetrag = `betrag` × `frequenzProJahr(frequenz)`,
 * gekappt auf den verwandtschaftsspezifischen Höchstbetrag (UNTERHALT_18_MAX_VERWANDTSCHAFT).
 *
 * Legacy-Shape (`empfaengerKategorie`): `betrag` ist bereits ein Jahresbetrag; mit Titel →
 * tatsächliche Höhe, ohne Titel → gedeckelt auf UNTERHALT_18_MAX[empfaengerKategorie].
 */
export function unterhaltsabzuegeFuerPerson(person: Person): number {
  const posn = person.unterhaltsverpflichtungen ?? [];
  return posn.reduce((sum, u) => {
    const betrag = Math.max(0, u.betrag ?? 0);
    if (u.verwandtschaft) {
      const jahr = betrag * frequenzProJahr(u.frequenz);
      const max = UNTERHALT_18_MAX_VERWANDTSCHAFT[u.verwandtschaft] ?? UNTERHALT_18_MAX.sonstige;
      return sum + Math.min(jahr, max);
    }
    // Legacy
    const max = (u.empfaengerKategorie && UNTERHALT_18_MAX[u.empfaengerKategorie]) ?? UNTERHALT_18_MAX.sonstige;
    return sum + (u.titelVorhanden ? betrag : Math.min(betrag, max));
  }, 0);
}

/** § 18 — Summe der Unterhaltsabzüge über alle Haushaltsmitglieder. */
export function unterhaltsabzuegeFuer(personen: Person[]): number {
  return personen.reduce((s, p) => s + unterhaltsabzuegeFuerPerson(p), 0);
}

/**
 * ANNAHME (pragmatisch, nicht rechtsverbindlich): Die § 16-Abzugskategorien werden
 * aus vorhandenen Merkmalen einer Person + ihren Dokumenten abgeleitet. Die echte
 * Prüfung (welche Beiträge tatsächlich abziehbar sind) obliegt der Sachbearbeitung
 * — deshalb im UI als „angenommene Abzugskategorien, bitte prüfen" kennzeichnen.
 *
 * Ableitung:
 *  - kvPv:    KV/PV-Nachweis für die Person vorhanden ODER Erwerbs-/Renteneinkommen.
 *  - steuern: Einkommensposition 'lohn_gehalt' oder 'selbststaendig'.
 *  - rv:      Erwerbsstatus 'angestellt' oder 'selbststaendig'.
 */
export function abzugskategorienFuer(person: Person, dokumente: Dokument[]): Abzugskategorien16 {
  const arten = new Set((person.einkommen ?? []).map(p => p.art));
  const hatErwerbOderRente = arten.has('lohn_gehalt') || arten.has('selbststaendig') || arten.has('rente');
  const hatKvPvNachweis = dokumente.some(d => d.typ === 'kv_pv_nachweis' && d.personId === person.id);
  return {
    kvPv: hatKvPvNachweis || hatErwerbOderRente,
    steuern: arten.has('lohn_gehalt') || arten.has('selbststaendig'),
    rv: person.erwerbsstatus === 'angestellt' || person.erwerbsstatus === 'selbststaendig',
  };
}

/** Pro-Person-Zeile der Vorgangs-Einkommensberechnung (für die §13-Ansicht). */
export interface VorgangEinkommenProPerson {
  personId: string;
  name: string;
  jahreseinkommen: number;      // § 14/§ 16 (nach Abzugssatz)
  freibetraege: number;         // § 17
  abzugskategorien: Abzugskategorien16;
}

/** Ergebnis der Vorgangs-Einkommensberechnung (§13-Kette, aufbereitet fürs UI). */
export interface VorgangEinkommenErgebnis {
  proPerson: VorgangEinkommenProPerson[];
  summeJahreseinkommen: number;
  summeFreibetraege: number;
  unterhaltsabzuege: number;    // § 18
  gesamteinkommenJahr: number;  // § 13
  gesamteinkommenMonat: number;
}

/**
 * § 13-Kette für einen ganzen Vorgang: leitet je Person die §16-Kategorien ab
 * (siehe abzugskategorienFuer), ruft gesamteinkommen(...) und reichert das
 * Ergebnis um Name + angesetzte Kategorien an. Rein, DB-frei, testbar.
 */
export function berechneVorgangEinkommen(
  personen: Person[],
  dokumente: Dokument[],
  unterhaltsabzuege = 0,
): VorgangEinkommenErgebnis {
  const katByPerson = new Map(personen.map(p => [p.id, abzugskategorienFuer(p, dokumente)]));
  const inputs: GesamteinkommenInput[] = personen.map(person => ({ person, kat: katByPerson.get(person.id) }));
  const basis = gesamteinkommen(inputs, unterhaltsabzuege);
  const nameById = new Map(personen.map(p => [p.id, `${p.vorname} ${p.nachname}`.trim() || 'Person']));
  const proPerson: VorgangEinkommenProPerson[] = basis.proPersonJahr.map(z => ({
    personId: z.personId,
    name: nameById.get(z.personId) ?? 'Person',
    jahreseinkommen: z.jahreseinkommen,
    freibetraege: z.freibetraege,
    abzugskategorien: katByPerson.get(z.personId) ?? {},
  }));
  return {
    proPerson,
    summeJahreseinkommen: basis.summeJahreseinkommen,
    summeFreibetraege: basis.summeFreibetraege,
    unterhaltsabzuege: basis.unterhaltsabzuege,
    gesamteinkommenJahr: basis.gesamteinkommenJahr,
    gesamteinkommenMonat: basis.gesamteinkommenMonat,
  };
}
