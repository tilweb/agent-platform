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
  /**
   * Mindest-Konfidenz der Extraktion für „Unterschriftsfeld leer", ab der `plausi-mietvertrag-unsigniert`
   * als Anforderung (statt als Hinweis zum Sichten) gemeldet wird. Die Pipeline deckelt Feld-Konfidenzen
   * derzeit bei 0,7 (LLM-Selbsteinschätzung, kein Bildbefund) — mit dem Standard 0,9 bleibt es deshalb
   * bewusst beim Hinweis. Spec: docs/wohngeld-fehlalarme-2026-09-28.md.
   */
  UNTERSCHRIFT_LEER_MIN_KONFIDENZ: number;
  /**
   * Grober Einkommens-Orientierungswert (Brutto, EUR/Monat) für `vorrang-grundsicherung-mitpruefen`:
   * liegt das Einkommen der alleinstehenden Person darüber, entfällt der Hinweis. KEINE
   * Bedarfsberechnung — nur eine Schwelle; kommunal festzulegen (Regelbedarf + örtlich angemessene
   * Unterkunftskosten). Env: `WOHNGELD_GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR`.
   */
  GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR: number;
  /** Wie oben für Ehe-/Lebenspartner zusammen (Summe beider Einkommen) — kommunal festzulegen. */
  GRUNDSICHERUNG_ORIENTIERUNG_PAAR_EUR: number;
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
  UNTERSCHRIFT_LEER_MIN_KONFIDENZ: 0.9,
  // Herleitung (Stand 2026, nur Orientierung): Regelbedarfsstufe 1 563 € + örtlich angemessene
  // Bruttowarmmiete ≈ 550 € ≈ 1.113 € netto; Renten brutto ≈ netto + 11 % KVdR/PV ⇒ ≈ 1.250 €.
  // Paar: 2 × 506 € + ≈ 650 € ≈ 1.662 € netto ⇒ ≈ 1.900 € brutto. Bewusst eher hoch angesetzt
  // (Hinweis lieber einmal zu viel als zu wenig).
  GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR: 1250,
  GRUNDSICHERUNG_ORIENTIERUNG_PAAR_EUR: 1900,
});

/** Größen, die die Kommune festlegt (Verwaltungspraxis, kein Gesetzeswert) — für Regelkatalog und Doku. */
export const KOMMUNAL_FESTZULEGEN: ReadonlyArray<keyof WohngeldKonstanten> = [
  'GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR', 'GRUNDSICHERUNG_ORIENTIERUNG_PAAR_EUR',
];

// ── Kontoeingänge, die kein Einkommen sind (plausi-kontoauszug-unerklaerte-eingaenge) ──
// Stichwörter werden normalisiert verglichen (klein, Umlaute umgeschrieben: ü → ue, ß → ss).
// Nachvollziehbarkeit: ein so ausgenommener Eingang wird nicht stillschweigend verworfen, sondern
// die Regel begründet ihn (Tests in abgleich.test.ts); die Liste ist bewusst kurz und konkret.

/** Umbuchung zwischen eigenen Konten (Verwendungszweck/Absender). */
export const UMBUCHUNG_STICHWOERTER: readonly string[] = ['umbuchung', 'uebertrag', 'eigenuebertrag', 'kontouebertrag'];

/**
 * Rückbuchungen und Erstattungen — kein laufendes Einkommen (Krankenkasse, Finanzamt, Versicherung,
 * Nebenkosten-/Betriebskostenguthaben, Rücklastschrift). Eine Leistung der Krankenkasse (Krankengeld)
 * ist KEINE Erstattung — deshalb „krankenkasse" nur zusammen mit „erstatt…".
 */
export const ERSTATTUNG_STICHWOERTER: readonly string[] = [
  'erstattung', 'rueckerstattung', 'steuererstattung', 'finanzamt', 'rueckbuchung', 'ruecklastschrift', 'storno',
  'rueckzahlung', 'gutschrift nebenkosten', 'nebenkostenguthaben', 'betriebskostenguthaben', 'guthaben nebenkosten',
  'guthaben betriebskosten', 'nebenkostenabrechnung', 'betriebskostenabrechnung', 'heizkostenabrechnung',
  'versicherungsleistung', 'schadenregulierung',
];

/** Leistungen, die kein Einkommen im Sinne des § 14 WoGG sind bzw. im Antrag gesondert stehen. */
export const KEIN_EINKOMMEN_STICHWOERTER: readonly string[] = ['kindergeld', 'familienkasse', 'wohngeld'];

/** Pflegegeld der Pflegekasse — erklärt, wenn im Haushalt ein Pflegegrad erfasst ist. */
export const PFLEGEGELD_STICHWOERTER: readonly string[] = ['pflegegeld', 'pflegekasse'];

/** Transferleistungen — erklärt, wenn im Antrag eine Transferleistung/ein Ausschluss angegeben ist. */
export const TRANSFER_STICHWOERTER: readonly string[] = ['jobcenter', 'buergergeld', 'grundsicherung', 'sozialamt', 'bafoeg', 'studierendenwerk', 'agentur fuer arbeit', 'arbeitslosengeld'];

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
