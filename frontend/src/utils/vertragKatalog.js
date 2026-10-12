/**
 * Vertragskatalog im Prüfdialog: Bezeichnungen, fachliche Reihenfolge und die Elemente, die vor der Freigabe
 * abgehakt sein müssen. Feldnamen und Status kommen aus dem Backend (extraction/vertragskatalog.ts).
 */

export const KATALOG_LABEL = {
  vertragsart: 'Vertragsart', parteien: 'Parteien', vertragsnummern: 'Vertrags-/Kundennummern', unterschriften: 'Unterschriften',
  datum_abschluss: 'Abschluss', beginn: 'Beginn', laufzeit: 'Laufzeit', verlaengerung: 'Verlängerung', kuendigung: 'Kündigung',
  entgelte: 'Entgelte', zahlungsbedingungen: 'Zahlungsbedingungen', preisanpassung: 'Preisanpassung', haftung: 'Haftung',
  gewaehrleistung: 'Gewährleistung', verfuegbarkeit_sla: 'Verfügbarkeit / Störungen', vertragsstrafe: 'Vertragsstrafe',
  vertraulichkeit: 'Vertraulichkeit', exklusivitaet_wettbewerb: 'Exklusivität / Wettbewerb', gerichtsstand: 'Gerichtsstand',
  rechtswahl: 'Rechtswahl', schriftform: 'Schriftform', widerruf: 'Widerruf', anlagen: 'Anlagen',
};

/** Fachliche Reihenfolge: wer, was, wann, wie lange, was kostet es, was gilt bei Problemen, Formalia. */
export const REIHENFOLGE = [
  'parteien', 'vertragsart', 'vertragsnummern', 'datum_abschluss', 'beginn', 'laufzeit', 'verlaengerung', 'kuendigung',
  'entgelte', 'zahlungsbedingungen', 'preisanpassung', 'verfuegbarkeit_sla', 'haftung', 'gewaehrleistung', 'vertragsstrafe',
  'vertraulichkeit', 'exklusivitaet_wettbewerb', 'schriftform', 'gerichtsstand', 'rechtswahl', 'widerruf', 'anlagen', 'unterschriften',
];

export const NICHT_GEREGELT_SCHLUESSEL = '__nicht_geregelt';

/**
 * Elemente, die vor der Freigabe abgehakt sein müssen: alle geregelten bzw. abweichenden Elemente plus ein
 * Sammelhaken für die nicht geregelten. Leer, wenn das Ergebnis keine Katalogfelder trägt.
 */
export function pruefElemente(vertrag, felder, values) {
  if (!vertrag || !felder || !Object.keys(felder).some((id) => id.startsWith('katalog_'))) return [];
  if (values?.katalog_beginn_status === undefined) return [];
  const status = (el) => values[`katalog_${el}_status`] ?? vertrag.katalog?.[el]?.status ?? 'nicht_geregelt';
  const geregelt = REIHENFOLGE.filter((el) => status(el) !== 'nicht_geregelt');
  return REIHENFOLGE.some((el) => status(el) === 'nicht_geregelt') ? [...geregelt, NICHT_GEREGELT_SCHLUESSEL] : geregelt;
}
