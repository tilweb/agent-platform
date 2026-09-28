/**
 * Altersgrenze nach § 41 Abs. 2 SGB XII (rein, DB-frei, testbar).
 *
 * Gemeinsam genutzt von Grundsicherung (Anspruchsgrund Alter) und Wohngeld (Vorrang-Hinweis
 * „Grundsicherung mitprüfen"). Liegt unter `_vorrang/`, weil die Apps einander nicht importieren.
 *
 * Gesetz (§ 41 Abs. 2 SGB XII): „Leistungsberechtigt wegen Alters nach Absatz 1 ist, wer die
 * Altersgrenze erreicht hat. Personen, die vor dem 1. Januar 1947 geboren sind, erreichen die
 * Altersgrenze mit Vollendung des 65. Lebensjahres. Für Personen, die nach dem 31. Dezember 1946
 * geboren sind, wird die Altersgrenze wie folgt angehoben: …" (Tabelle: Jahrgang 1947 um 1 Monat
 * auf 65 Jahre 1 Monat … 1958 um 12 Monate auf 66 Jahre, 1959 um 14 Monate auf 66 Jahre 2 Monate
 * … 1963 um 22 Monate auf 66 Jahre 10 Monate, ab 1964 um 24 Monate auf 67 Jahre).
 * Katalog: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 0.2.
 *
 * Tagesgenaue Regel („Vollendung"): Das Lebensjahr wird nach § 187 Abs. 2 Satz 2 und § 188 Abs. 2
 * BGB mit Ablauf des Tages VOR dem Geburtstag vollendet (Geburtstag zählt als erster Tag). Für
 * die zusätzlichen Monate gilt dieselbe Fristrechnung (§ 188 Abs. 2 BGB); fehlt der
 * entsprechende Tag im Endmonat, endet die Frist mit Ablauf des letzten Monatstags
 * (§ 188 Abs. 3 BGB). Beispiel: geb. 01.08.1960 (66 J. 4 Mon.) → Altersgrenze erreicht mit Ablauf
 * des 30.11.2026, nicht erst am 01.12.2026.
 *
 * Monatsregel: § 41 Abs. 2 SGB XII kennt — anders als § 7a SGB II („Ablauf des Monats") — KEINE
 * Monatsend-Regel. Die Monatswirkung entsteht erst über § 44 Abs. 2 SGB XII: Der Antrag wirkt auf
 * den Ersten des Antragsmonats zurück, wenn die Voraussetzungen innerhalb dieses Kalendermonats
 * erfüllt werden. Deshalb liefert diese Datei das tagesgenaue Datum; der Monatsvergleich
 * geschieht in den Prüfregeln (`plausi-altersgrenze-*`).
 */
import { dayPart } from '../_antrag-kern/datum';

export interface Altersgrenze {
  jahre: number;
  monate: number;
}

/** Altersgrenze eines Geburtsjahrgangs laut Tabelle § 41 Abs. 2 SGB XII. */
export function altersgrenzeFuerJahrgang(jahrgang: number): Altersgrenze {
  if (jahrgang < 1947) return { jahre: 65, monate: 0 };
  if (jahrgang <= 1958) {
    const anhebung = jahrgang - 1946;              // 1947 → 1 … 1958 → 12 Monate
    return { jahre: 65 + Math.floor(anhebung / 12), monate: anhebung % 12 };
  }
  if (jahrgang <= 1963) {
    const anhebung = 12 + (jahrgang - 1958) * 2;   // 1959 → 14 … 1963 → 22 Monate
    return { jahre: 65 + Math.floor(anhebung / 12), monate: anhebung % 12 };
  }
  return { jahre: 67, monate: 0 };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Datum, mit dessen Ablauf die Altersgrenze erreicht ist (ISO `YYYY-MM-DD`).
 * Ungültiges/leeres Geburtsdatum → `null`.
 */
export function altersgrenzeErreichtAm(geburtsdatum?: string): string | null {
  const tag = dayPart(geburtsdatum);
  if (!tag) return null;
  const [y, m, d] = tag.split('-').map(Number) as [number, number, number];
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const { jahre, monate } = altersgrenzeFuerJahrgang(y);
  const monatsIndex = (m - 1) + monate;
  const zielJahr = y + jahre + Math.floor(monatsIndex / 12);
  const zielMonat = (monatsIndex % 12) + 1;
  const letzterTag = new Date(Date.UTC(zielJahr, zielMonat, 0)).getUTCDate();
  if (d > letzterTag) {
    // § 188 Abs. 3 BGB: entsprechender Tag fehlt → Ablauf des letzten Tages des Monats.
    return `${zielJahr}-${pad2(zielMonat)}-${pad2(letzterTag)}`;
  }
  // § 188 Abs. 2 BGB: Ablauf des Tages vor dem „Jahres-/Monatstag".
  const ms = Date.UTC(zielJahr, zielMonat - 1, d) - 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monat (`YYYY-MM`), in dem die Altersgrenze erreicht wird — maßgeblich für § 44 Abs. 2. */
export function altersgrenzeMonat(geburtsdatum?: string): string | null {
  return altersgrenzeErreichtAm(geburtsdatum)?.slice(0, 7) ?? null;
}

/**
 * Ist die Altersgrenze bis zum Ende des Kalendermonats von `stichtag` erreicht (§ 44 Abs. 2)?
 * `null`, wenn Geburtsdatum oder Stichtag fehlen.
 */
export function altersgrenzeImMonatErreicht(geburtsdatum: string | undefined, stichtag: string | undefined): boolean | null {
  const monat = altersgrenzeMonat(geburtsdatum);
  const st = dayPart(stichtag);
  if (!monat || !st) return null;
  return monat <= st.slice(0, 7);
}

/** Formatiert eine Altersgrenze („66 Jahre 4 Monate"). */
export function fmtAltersgrenze(a: Altersgrenze): string {
  return a.monate ? `${a.jahre} Jahre ${a.monate} Monat${a.monate === 1 ? '' : 'e'}` : `${a.jahre} Jahre`;
}
