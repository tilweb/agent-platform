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
import type { Person } from './types';

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
