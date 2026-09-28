/**
 * Alltagssprachliche Suchbegriffe je Paragraph (Ergänzung zum kuratierten C2-Korpus) —
 * nur für die Vorauswahl beim Gesetz-Nachschlagen. Ändert keinen Gesetzestext.
 * Schlüssel: „<Gesetz>|<Paragraph>".
 */
export const ZUSATZ_SUCHBEGRIFFE: Record<string, string[]> = {
  'SGB I|§ 60': ['mitwirkung', 'mitwirkungspflicht', 'unterlagen', 'nachweise', 'vorlegen', 'einreichen', 'belege', 'auskunft', 'angaben machen', 'änderungen mitteilen', 'nachforderung'],
  'SGB I|§ 61': ['persönliches erscheinen', 'vorsprache', 'termin', 'erscheinen'],
  'SGB I|§ 62': ['untersuchung', 'ärztliche untersuchung'],
  'SGB I|§ 65': ['grenzen der mitwirkung', 'unzumutbar', 'verweigern', 'auskunft verweigern'],
  'SGB I|§ 66': ['folgen fehlender mitwirkung', 'versagung', 'versagen', 'entziehung', 'ablehnen', 'frist', 'fristsetzung', 'hinweis', 'belehrung', 'nicht mitgewirkt', 'unterlagen fehlen'],
  'SGB I|§ 67': ['nachholung der mitwirkung', 'nachträglich', 'nachreichen', 'unterlagen nachgereicht'],
  'WoGG|§ 5': ['haushalt', 'wer gehört zum haushalt', 'haushaltsmitglied', 'familienmitglied', 'kinder', 'partner', 'ehegatte', 'wohngemeinschaft'],
  'WoGG|§ 6': ['zu berücksichtigende haushaltsmitglieder', 'nicht berücksichtigt', 'haushaltsgröße'],
  'WoGG|§ 12': ['höchstbetrag', 'mietenstufe', 'höchstbeträge', 'miete begrenzt'],
  'WoGG|§ 14': ['minijob', 'geringfügige beschäftigung', 'pauschal besteuert', 'nebenjob', 'einnahmen'],
  'WoGG|§ 21': ['vermögen', 'vermögensgrenze', 'erhebliches vermögen', 'ersparnisse', 'missbräuchlich'],
  'WoGG|§ 22': ['antrag', 'antragstellung', 'antragsteller', 'wer stellt den antrag'],
  'WoGG|§ 23': ['auskunftspflicht', 'arbeitgeber auskunft', 'vermieter auskunft', 'vermieterbescheinigung'],
  'WoGG|§ 27': ['änderung', 'erhöhung', 'mieterhöhung', 'einkommen gestiegen', 'neu berechnen'],
};
