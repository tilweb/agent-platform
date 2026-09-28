/**
 * Vorrang Wohngeld ↔ Grundsicherung — gemeinsame Arten-Listen (Einkommen, Vermögen,
 * Transferleistungen) und ihre Abbildung aus den Erfassungswerten beider Apps.
 *
 * Reine Konstanten und Nachschlage-Helfer. Keine Rechenlogik, keine Importe aus den Apps:
 * Die App-Werte stehen hier als Zeichenketten (Vokabular der jeweiligen Erfassung).
 * Unbekannte Werte landen bei `sonstiges`; der Originalwert bleibt im Grunddatum erhalten
 * (`art_quelle`), damit nichts stillschweigend umgedeutet wird.
 *
 * Fachgrundlage: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 5.3.
 */

// ── Einkommen ───────────────────────────────────────────────────────────────

/** Gemeinsame Einkommensarten. */
export const VORRANG_EINKOMMENSARTEN = [
  /** Gesetzliche Rente (Alters-, EM-, Hinterbliebenenrente). */
  'gesetzliche_rente',
  /** Betriebs-/Zusatz-/Privatrente, Pension. */
  'betriebs_privatrente',
  /** Rente, bei der die Erfassung gesetzlich/betrieblich nicht unterscheidet (Wohngeld). */
  'rente_unbestimmt',
  /** Nichtselbständige Erwerbstätigkeit, Minijob, Werkstattentgelt. */
  'erwerb',
  'selbstaendig',
  'kapital',
  'vermietung',
  'unterhalt',
  'wohngeld',
  /** Arbeitslosengeld, Krankengeld, Elterngeld. */
  'lohnersatz',
  /** Andere Sozialleistungen (z. B. Bürgergeld). */
  'sozialleistung',
  /** Zuwendungen Dritter. */
  'zuwendung',
  'sonstiges',
] as const;
export type VorrangEinkommensart = typeof VORRANG_EINKOMMENSARTEN[number];

/** Einkommensarten, die als Erwerbseinkünfte gelten (Vorrang-Hinweis „nur Rente"). */
export const ERWERBS_EINKOMMENSARTEN: readonly VorrangEinkommensart[] = ['erwerb', 'selbstaendig'];

/** Einkommensarten, die eine Rente sind. */
export const RENTEN_EINKOMMENSARTEN: readonly VorrangEinkommensart[] = ['gesetzliche_rente', 'betriebs_privatrente', 'rente_unbestimmt'];

/** Rentenart einer gesetzlichen Rente, soweit bekannt. */
export type VorrangRentenart = 'alter' | 'volle_em' | 'teilweise_em' | 'em_unbestimmt' | 'hinterbliebene' | 'sonstige';

/** Abbildung Wohngeld `Einkommensposition.art` (§ 14 WoGG) → gemeinsame Art. */
export const EINKOMMENSART_AUS_WOHNGELD: Readonly<Record<string, VorrangEinkommensart>> = {
  lohn_gehalt: 'erwerb',
  rente: 'rente_unbestimmt',
  kapitalertraege: 'kapital',
  v_und_v: 'vermietung',
  selbststaendig: 'selbstaendig',
  alg1: 'lohnersatz',
  krankengeld: 'lohnersatz',
  elterngeld: 'lohnersatz',
  unterhalt: 'unterhalt',
  sonstiges: 'sonstiges',
};

/** Abbildung Grundsicherung `Einkommensposition.art` → gemeinsame Art. */
export const EINKOMMENSART_AUS_GRUNDSICHERUNG: Readonly<Record<string, VorrangEinkommensart>> = {
  altersrente: 'gesetzliche_rente',
  em_rente: 'gesetzliche_rente',
  hinterbliebenenrente: 'gesetzliche_rente',
  rente: 'gesetzliche_rente',
  betriebsrente: 'betriebs_privatrente',
  zusatzversorgung: 'betriebs_privatrente',
  pension: 'betriebs_privatrente',
  private_rente: 'betriebs_privatrente',
  wohngeld: 'wohngeld',
  unterhalt: 'unterhalt',
  erwerbseinkommen: 'erwerb',
  minijob: 'erwerb',
  wfbm_entgelt: 'erwerb',
  kapitalertraege: 'kapital',
  vermietung: 'vermietung',
  zuwendung: 'zuwendung',
  krankengeld: 'lohnersatz',
  arbeitslosengeld: 'lohnersatz',
  grundsicherungsgeld: 'sozialleistung',
  sozialleistung: 'sozialleistung',
  selbstaendig: 'selbstaendig',
  sonstiges: 'sonstiges',
};

/** Rentenart aus der Grundsicherungs-Einkommensart (nur wo die Art sie festlegt). */
export const RENTENART_AUS_GRUNDSICHERUNG: Readonly<Record<string, VorrangRentenart>> = {
  altersrente: 'alter',
  em_rente: 'em_unbestimmt',
  hinterbliebenenrente: 'hinterbliebene',
};

// ── Vermögen ────────────────────────────────────────────────────────────────

/** Gemeinsame Vermögensarten. */
export const VORRANG_VERMOEGENSARTEN = [
  /** Giro-, Spar-, Tages-, Festgeldkonto, Sparbuch, Bankguthaben. */
  'konto',
  'wertpapiere',
  'bausparvertrag',
  /** Lebens-/Kapitalversicherung (Rückkaufswert). */
  'lebensversicherung',
  /** Staatlich geförderte Altersvorsorge (Riester). */
  'gefoerderte_altersvorsorge',
  /** Bestattungsvorsorge, Sterbegeldversicherung. */
  'bestattungsvorsorge',
  'selbstgenutzte_immobilie',
  'immobilie',
  'kfz',
  'hausrat',
  'bargeld',
  'sonstiges',
] as const;
export type VorrangVermoegensart = typeof VORRANG_VERMOEGENSARTEN[number];

/** Abbildung Grundsicherung `VermoegenPosition.art` → gemeinsame Art. */
export const VERMOEGENSART_AUS_GRUNDSICHERUNG: Readonly<Record<string, VorrangVermoegensart>> = {
  girokonto: 'konto',
  sparkonto: 'konto',
  sparbuch: 'konto',
  tagesgeld: 'konto',
  festgeld: 'konto',
  depot: 'wertpapiere',
  bausparvertrag: 'bausparvertrag',
  lebensversicherung: 'lebensversicherung',
  kapitalversicherung: 'lebensversicherung',
  riester: 'gefoerderte_altersvorsorge',
  bestattungsvorsorge: 'bestattungsvorsorge',
  sterbegeldversicherung: 'bestattungsvorsorge',
  eigenheim: 'selbstgenutzte_immobilie',
  immobilie: 'immobilie',
  kfz: 'kfz',
  hausrat: 'hausrat',
  sonstiges: 'sonstiges',
};

/**
 * Wohngeld erfasst die Vermögensart als Freitext (z. B. „Bankguthaben", „Wertpapiere").
 * Stichworte in Prüfreihenfolge (erstes Muster gewinnt) → gemeinsame Art.
 */
export const VERMOEGENSART_STICHWORTE_WOHNGELD: ReadonlyArray<readonly [RegExp, VorrangVermoegensart]> = [
  [/riester|r[üu]rup/i, 'gefoerderte_altersvorsorge'],
  [/bestattung|sterbegeld/i, 'bestattungsvorsorge'],
  [/bauspar/i, 'bausparvertrag'],
  [/lebensversicherung|kapitalversicherung|rentenversicherung/i, 'lebensversicherung'],
  [/wertpapier|depot|aktie|fonds|anleihe/i, 'wertpapiere'],
  [/selbst ?genutzt|eigenheim|eigentumswohnung.*selbst/i, 'selbstgenutzte_immobilie'],
  [/hausrat/i, 'hausrat'],
  [/immobilie|grundst[üu]ck|haus|wohnung/i, 'immobilie'],
  [/kfz|\bauto|fahrzeug|pkw/i, 'kfz'],
  [/bargeld|\bbar\b/i, 'bargeld'],
  [/konto|guthaben|spar|tagesgeld|festgeld|bank/i, 'konto'],
];

// ── Transferleistungen ──────────────────────────────────────────────────────

/** Gemeinsame Arten laufender oder beantragter Transferleistungen. */
export const VORRANG_TRANSFERARTEN = [
  'wohngeld',
  /** Grundsicherung im Alter und bei Erwerbsminderung (SGB XII, 4. Kapitel). */
  'grundsicherung',
  /** Bürgergeld / Grundsicherungsgeld (SGB II). */
  'sgb2',
  /** Hilfe zum Lebensunterhalt (SGB XII, 3. Kapitel). */
  'hilfe_lebensunterhalt',
  'asylblg',
  /** Ausbildungsförderung (BAföG, BAB). */
  'ausbildungsfoerderung',
  'sonstige',
] as const;
export type VorrangTransferart = typeof VORRANG_TRANSFERARTEN[number];

/** Abbildung Wohngeld `Ausschluss.grund` (§ 7 WoGG) → gemeinsame Art. */
export const TRANSFERART_AUS_WOHNGELD_AUSSCHLUSS: Readonly<Record<string, VorrangTransferart>> = {
  sgb2_buergergeld: 'sgb2',
  grundsicherung_alter_em: 'grundsicherung',
  hilfe_lebensunterhalt_sgb12: 'hilfe_lebensunterhalt',
  ergaenzende_hilfe_bvg: 'sonstige',
  hilfe_stationaer: 'sonstige',
  kinder_jugendhilfe_sgb8: 'sonstige',
  asylblg: 'asylblg',
  ausbildungsfoerderung: 'ausbildungsfoerderung',
  sonstiger_grund: 'sonstige',
};

/** Abbildung Grundsicherung `Vorgang.vorbezug.leistung` → gemeinsame Art. */
export const TRANSFERART_AUS_GRUNDSICHERUNG_VORBEZUG: Readonly<Record<string, VorrangTransferart>> = {
  buergergeld: 'sgb2',
  hilfe_zum_lebensunterhalt: 'hilfe_lebensunterhalt',
  wohngeld: 'wohngeld',
  sonstige: 'sonstige',
};

/** Freitext-Stichworte (z. B. Wohngeld-Transferleistung „Grundsicherung") → gemeinsame Art. */
export const TRANSFERART_STICHWORTE: ReadonlyArray<readonly [RegExp, VorrangTransferart]> = [
  [/wohngeld|lastenzuschuss|mietzuschuss/i, 'wohngeld'],
  [/grundsicherung.*(alter|erwerbsminder)|sgb ?xii.*4|4\. ?kap/i, 'grundsicherung'],
  [/b[üu]rgergeld|sgb ?ii\b|alg ?ii|arbeitslosengeld ?ii|hartz|jobcenter|grundsicherungsgeld|grundsicherung f[üu]r arbeitsuchende/i, 'sgb2'],
  [/hilfe zum lebensunterhalt|sozialhilfe/i, 'hilfe_lebensunterhalt'],
  [/grundsicherung/i, 'grundsicherung'],
  [/asyl/i, 'asylblg'],
  [/baf[öo]g|ausbildungsf[öo]rderung|\bbab\b|berufsausbildungsbeihilfe/i, 'ausbildungsfoerderung'],
];

// ── Nachschlage-Helfer (keine Rechenlogik) ──────────────────────────────────

/** Art aus einer Abbildungstabelle; unbekannt → `sonstiges`. */
export function einkommensartAus(tabelle: Readonly<Record<string, VorrangEinkommensart>>, art: string | undefined): VorrangEinkommensart {
  return (art && tabelle[art]) || 'sonstiges';
}

/** Art aus einer Abbildungstabelle; unbekannt → `sonstiges`. */
export function vermoegensartAus(tabelle: Readonly<Record<string, VorrangVermoegensart>>, art: string | undefined): VorrangVermoegensart {
  return (art && tabelle[art]) || 'sonstiges';
}

/** Erste passende Art aus einer Stichwortliste; kein Treffer → `undefined`. */
export function artAusStichworten<T extends string>(liste: ReadonlyArray<readonly [RegExp, T]>, text: string | undefined): T | undefined {
  if (!text?.trim()) return undefined;
  for (const [muster, art] of liste) if (muster.test(text)) return art;
  return undefined;
}
