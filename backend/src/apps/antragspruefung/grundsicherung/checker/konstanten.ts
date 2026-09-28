/**
 * Grundsicherung — Schwellen und Konstanten der Regel-Engine.
 *
 * Jede Größe ist per Umgebungsvariable `GRUNDSICHERUNG_<NAME>` überschreibbar. Größen, die die
 * Kommune festlegt (Verwaltungspraxis, kein Gesetzeswert), sind mit „kommunal festzulegen"
 * markiert und im Regelkatalog (`regeln.ts`) als solche ausgewiesen.
 * Fachgrundlage: docs/grundsicherung-regelkatalog-2026-09-27.md (3.2, 8.3).
 */

export interface GrundsicherungKonstanten {
  /** Barbetrag je volljähriger Person der Einsatzgemeinschaft (§ 1 BarbetragsVO zu § 90 Abs. 2 Nr. 9 SGB XII). */
  SCHONBETRAG_JE_PERSON: number;
  /** Barbetrag je überwiegend unterhaltener Person (§ 1 BarbetragsVO). */
  SCHONBETRAG_UNTERHALTENE: number;
  /** Mindestzeitraum lückenloser Kontoauszüge in Monaten — kommunal festzulegen (Katalog 8.3). */
  KONTOAUSZUG_MONATE: number;
  /** Ab diesem Betrag gilt eine Abbuchung/Barabhebung als „großer Abgang" — kommunal festzulegen. */
  GROSSE_ABGAENGE_SCHWELLE: number;
  /** Stichtag der letzten Rentenanpassung (ISO). Jährlich zum 01.07. fortschreiben. */
  RENTENANPASSUNG_STICHTAG: string;
  /** Relative Toleranz für Mietvergleiche (0.05 = 5 %) — kommunal festzulegen. */
  MIETE_TOLERANZ_PROZENT: number;
  /** Absolute Mindest-Toleranz für Mietvergleiche in Euro — kommunal festzulegen. */
  MIETE_TOLERANZ_EUR: number;
  /** Toleranz für Rentenbeträge in Euro (Rundung, Cent-Differenzen). */
  RENTE_TOLERANZ_EUR: number;
  /** Absolute Mindest-Toleranz Kontostand ↔ Vermögensangabe in Euro — kommunal festzulegen. */
  KONTOSTAND_TOLERANZ_EUR: number;
  /** Relative Toleranz Kontostand ↔ Vermögensangabe (0.1 = 10 %) — kommunal festzulegen. */
  KONTOSTAND_TOLERANZ_PROZENT: number;
  /** Wohngeld-Vermögensfreigrenze für das erste Haushaltsmitglied (§ 21 Nr. 3 WoGG, Verwaltungsvorschrift). */
  WOHNGELD_FREIGRENZE_ERSTE_PERSON: number;
  /** Wohngeld-Vermögensfreigrenze je weiterem Haushaltsmitglied. */
  WOHNGELD_FREIGRENZE_WEITERE_PERSON: number;
  /** Mietvertrag älter als so viele Monate → aktuelle Mietbescheinigung nötig. */
  MIETVERTRAG_AKTUELL_MONATE: number;
  /**
   * Mindest-Konfidenz der Extraktion für „Unterschriftsfeld leer", ab der `plausi-mietvertrag-unsigniert`
   * als Anforderung (statt als Hinweis zum Sichten) gemeldet wird. Die Pipeline deckelt Feld-Konfidenzen
   * derzeit bei 0,7 — mit dem Standard 0,9 bleibt es bewusst beim Hinweis (docs/wohngeld-fehlalarme-2026-09-28.md).
   */
  UNTERSCHRIFT_LEER_MIN_KONFIDENZ: number;
}

export const STANDARD_KONSTANTEN: Readonly<GrundsicherungKonstanten> = Object.freeze({
  SCHONBETRAG_JE_PERSON: 10000,
  SCHONBETRAG_UNTERHALTENE: 500,
  KONTOAUSZUG_MONATE: 3,
  GROSSE_ABGAENGE_SCHWELLE: 1000,
  RENTENANPASSUNG_STICHTAG: '2026-07-01',
  MIETE_TOLERANZ_PROZENT: 0.05,
  MIETE_TOLERANZ_EUR: 10,
  RENTE_TOLERANZ_EUR: 1,
  KONTOSTAND_TOLERANZ_EUR: 250,
  KONTOSTAND_TOLERANZ_PROZENT: 0.1,
  WOHNGELD_FREIGRENZE_ERSTE_PERSON: 60000,
  WOHNGELD_FREIGRENZE_WEITERE_PERSON: 30000,
  MIETVERTRAG_AKTUELL_MONATE: 12,
  UNTERSCHRIFT_LEER_MIN_KONFIDENZ: 0.9,
});

/** Größen, die die Kommune festlegt (für Regelkatalog und Oberfläche). */
export const KOMMUNAL_FESTZULEGEN: ReadonlyArray<keyof GrundsicherungKonstanten> = [
  'KONTOAUSZUG_MONATE', 'GROSSE_ABGAENGE_SCHWELLE', 'MIETE_TOLERANZ_PROZENT', 'MIETE_TOLERANZ_EUR',
  'KONTOSTAND_TOLERANZ_EUR', 'KONTOSTAND_TOLERANZ_PROZENT',
];

/** Konstanten laden; `GRUNDSICHERUNG_<NAME>` überschreibt den Standard (ungültige Werte werden ignoriert). */
export function ladeKonstanten(env: Record<string, string | undefined> = process.env): GrundsicherungKonstanten {
  const out: GrundsicherungKonstanten = { ...STANDARD_KONSTANTEN };
  for (const key of Object.keys(STANDARD_KONSTANTEN) as Array<keyof GrundsicherungKonstanten>) {
    const raw = env[`GRUNDSICHERUNG_${key}`]?.trim();
    if (!raw) continue;
    if (typeof STANDARD_KONSTANTEN[key] === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) (out as unknown as Record<string, unknown>)[key] = raw;
    } else {
      const n = Number(raw.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) (out as unknown as Record<string, unknown>)[key] = n;
    }
  }
  return out;
}

/** Beim Import geladene Konstanten (Prozess-Env). */
export const KONSTANTEN: Readonly<GrundsicherungKonstanten> = Object.freeze(ladeKonstanten());
