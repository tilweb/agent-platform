/**
 * Wohngeld — Schwellen der Abgleiche Antrag ↔ Beleg (checker/abgleich.ts).
 *
 * Jede Größe ist per Umgebungsvariable `WOHNGELD_<NAME>` überschreibbar. Toleranzen sind
 * Verwaltungspraxis, kein Gesetzeswert („kommunal festzulegen"); die Standardwerte folgen der
 * Grundsicherung (`grundsicherung/checker/konstanten.ts`), außer bei der Miete: Wohngeld
 * rechnet unmittelbar mit der Miethöhe, deshalb nur Rundungstoleranz.
 * Spec: docs/wohngeld-antrag-beleg-abgleich-spec-2026-09-28.md
 */

export interface WohngeldKonstanten {
  /** Absolute Toleranz Miete Antrag ↔ Mietdokument/Mietzahlung in Euro (Rundung). */
  MIETE_TOLERANZ_EUR: number;
  /** Relative Toleranz Miete (0 = aus). */
  MIETE_TOLERANZ_PROZENT: number;
  /** Toleranz Rentenbetrag Antrag ↔ Rentenbescheid in Euro (wie Grundsicherung). */
  RENTE_TOLERANZ_EUR: number;
  /** Absolute Mindest-Toleranz Erwerbs-/Lohnersatzeinkommen Antrag ↔ Beleg in Euro. */
  EINKOMMEN_TOLERANZ_EUR: number;
  /** Relative Toleranz Erwerbs-/Lohnersatzeinkommen (0.05 = 5 %; wie Mietvergleich Grundsicherung). */
  EINKOMMEN_TOLERANZ_PROZENT: number;
  /** Absolute Mindest-Toleranz Vermögensangabe ↔ Belege in Euro (wie Grundsicherung). */
  VERMOEGEN_TOLERANZ_EUR: number;
  /** Relative Toleranz Vermögensangabe ↔ Belege (0.1 = 10 %). */
  VERMOEGEN_TOLERANZ_PROZENT: number;
  /** Obergrenze Bruttorente ÷ Zahlbetrag (KVdR + PV ≈ 12 %) — nur für den Hinweis ohne Bruttoangabe. */
  RENTE_BRUTTO_ZAHLBETRAG_FAKTOR: number;
}

export const STANDARD_KONSTANTEN: Readonly<WohngeldKonstanten> = Object.freeze({
  MIETE_TOLERANZ_EUR: 1,
  MIETE_TOLERANZ_PROZENT: 0,
  RENTE_TOLERANZ_EUR: 1,
  EINKOMMEN_TOLERANZ_EUR: 10,
  EINKOMMEN_TOLERANZ_PROZENT: 0.05,
  VERMOEGEN_TOLERANZ_EUR: 250,
  VERMOEGEN_TOLERANZ_PROZENT: 0.1,
  RENTE_BRUTTO_ZAHLBETRAG_FAKTOR: 1.15,
});

/** Konstanten laden; `WOHNGELD_<NAME>` überschreibt den Standard (ungültige Werte werden ignoriert). */
export function ladeKonstanten(env: Record<string, string | undefined> = process.env): WohngeldKonstanten {
  const out: WohngeldKonstanten = { ...STANDARD_KONSTANTEN };
  for (const key of Object.keys(STANDARD_KONSTANTEN) as Array<keyof WohngeldKonstanten>) {
    const raw = env[`WOHNGELD_${key}`]?.trim();
    if (!raw) continue;
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

/** Beim Import geladene Konstanten (Prozess-Env). */
export const KONSTANTEN: Readonly<WohngeldKonstanten> = Object.freeze(ladeKonstanten());

/** Toleranz = das Größere aus Euro- und Prozent-Toleranz bezogen auf `basis`. */
export function toleranz(eur: number, prozent: number, basis: number): number {
  return Math.max(eur, Math.abs(basis) * prozent);
}
