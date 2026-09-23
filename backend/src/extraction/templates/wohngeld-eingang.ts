/**
 * Vorlage: Segmentprofil „Wohngeld-Eingang" — ein Sammel-Eingang (Antrag + Nachweise
 * in einer PDF) wird seitenweise klassifiziert (Segmentierung W10) und je Abschnitt
 * ausgelesen. Die Wohngeld-App legt das Profil beim ersten Gebrauch unter der ID
 * `wohngeld-eingang` an; danach ist es in der Document-Processing-Oberfläche pflegbar.
 *
 * Beschreibungen sind bewusst konkret: sie adressieren die in der Golden-Dataset-
 * Messung (docs/wohngeld-golden-messung-ergebnis-2026-09-24.md) gefundenen Fehler
 * (Formularrückseiten ≠ neues Dokument, Monatsabrechnungen = je eigenes Dokument).
 *
 * Spec: docs/wohngeld-dp-segmentprofil-spec-2026-09-24.md
 */
import type { ExtractionProject, ProjectField, SegmentTypeDef } from '../learning/types';

export const WOHNGELD_PROFIL_ID = 'wohngeld-eingang';
/** Bei fachlichen Änderungen der Vorlage hochzählen (steht in der Profilbeschreibung). */
export const WOHNGELD_PROFIL_VORLAGE_STAND = '2026-09-24b';

const txt = (label: string, description?: string): ProjectField => ({ type: 'text', required: false, label, ...(description ? { description } : {}) });
const num = (label: string, description?: string): ProjectField => ({ type: 'number', required: false, label, ...(description ? { description } : {}) });
const dat = (label: string, description?: string): ProjectField => ({ type: 'date', required: false, label, ...(description ? { description } : {}) });
/** Beträge stehen im Dokument mit Dezimalkomma („468,50") — als Zahl 468.5 angeben, nie ohne Komma. */
const EURO = 'Betrag mit Dezimalkomma im Dokument (z. B. „468,50") als Zahl 468.5 angeben — Nachkommastellen nicht verlieren';
const bool = (label: string, description?: string): ProjectField => ({ type: 'boolean', required: false, label, ...(description ? { description } : {}) });

const PERSON = {
  nachname: txt('Nachname', 'Familienname der Person, auf die sich das Dokument bezieht'),
  vorname: txt('Vorname(n)'),
};
const UNTERSCHRIFT = (wer: string) => bool('Unterschrift vorhanden', `true, wenn im Unterschriftsfeld ${wer} eine handschriftliche Unterschrift (gezeichnete Linie) zu sehen ist; false, wenn das Feld leer ist`);

const SEGMENTE: Record<string, SegmentTypeDef> = {
  wohngeldantrag: {
    label: 'Wohngeldantrag',
    description: 'Amtliches Formular „Wohngeldantrag für den Mietzuschuss" (oder Lastenzuschuss), 11 Seiten mit der Kopfzeile „Wohngeldantrag für den Mietzuschuss" und „Seite x von 11", nummerierte Fragen 1–31 mit Ankreuzfeldern. ALLE Seiten dieses Formulars gehören dazu — auch Seiten mit Einnahmen, Freibeträgen, Miete, Bankverbindung, Hinweisen und Unterschrift. Neustart nur auf „Seite 1 von 11".',
    fields: {
      antragsdatum: dat('Antragsdatum', 'Datum neben der Unterschrift auf der letzten Seite'),
      wohngeldart: txt('Wohngeldart', '„mietzuschuss" oder „lastenzuschuss" laut Formulartitel'),
      antragsart: txt('Antragsart', '„weiterleistungsantrag", wenn eine Wohngeldnummer/ein Aktenzeichen eingetragen ist, sonst „erstantrag"'),
      wohngeldnummer: txt('Wohngeldnummer/Aktenzeichen'),
      antragsteller_nachname: txt('Familienname der antragstellenden Person', 'Frage 1'),
      antragsteller_vorname: txt('Vorname(n) der antragstellenden Person', 'Frage 1'),
      antragsteller_geburtsdatum: dat('Geburtsdatum der antragstellenden Person', 'Frage 1'),
      strasse: txt('Straße der Wohnung', 'Frage 2'),
      hausnummer: txt('Hausnummer', 'Frage 2'),
      plz: txt('Postleitzahl', 'Frage 2'),
      ort: txt('Ort', 'Frage 2'),
      wohnflaeche_qm: num('Wohnfläche in m²', 'Frage 22'),
      gesamtmiete: num('Gesamtmiete in EUR/Monat', 'Frage 23: gesamte Miete an den Vermieter inklusive aller Nebenkosten — ' + EURO),
      heizkosten: num('Heizkosten in EUR/Monat', 'Frage 24, nur wenn „Ja" mit Betrag angekreuzt — ' + EURO),
      warmwasser: num('Warmwasserkosten in EUR/Monat', 'Frage 24 — ' + EURO),
      garage: num('Garage/Stellplatz in EUR/Monat', 'Frage 24 — ' + EURO),
      haushaltsenergie: num('Haushaltsenergie in EUR/Monat', 'Frage 24 — ' + EURO),
      unterschrift_vorhanden: UNTERSCHRIFT('„Unterschrift Antragsteller/Antragstellerin" oder „Bevollmächtigter/gesetzlicher Vertreter" auf der letzten Seite'),
      datum_vorhanden: bool('Datum vorhanden', 'true, wenn neben der Unterschrift ein Datum eingetragen ist'),
    },
  },
  zusatzblatt: {
    label: 'Zusatzblatt zum Antrag',
    description: 'Formloses Zusatzblatt zum Wohngeldantrag mit weiteren Haushaltsmitgliedern (ab dem 5.) und deren Einnahmen, meist mit Überschrift „Zusatzblatt".',
    mode: 'classify-only',
  },
  vermieterbescheinigung: {
    label: 'Vermieterbescheinigung',
    description: 'Formular „Angaben des/der Vermieters/in zum Wohnraum" (Vermieterbescheinigung, Auskunft nach § 23 Abs. 3 WoGG), 2 Seiten: Vorderseite mit Mietpartei, Beginn des Mietverhältnisses, Wohnfläche, Miete, Ankreuzfeldern zu Betriebskosten und Unterschrift/Stempel des Vermieters; RÜCKSEITE mit dem Text der Betriebskostenverordnung (§ 2 BetrKV, nummerierte Kostenarten 1–17). Die Rückseite ist eine Fortsetzung, KEIN neues Dokument.',
    fields: {
      ...PERSON,
      wohnflaeche_qm: num('Gesamtfläche der Wohnung in m²'),
      gesamtmiete: num('Miete einschließlich Betriebskosten in EUR/Monat', EURO),
      heizkosten: num('Heizkosten in EUR/Monat', 'nur wenn „ja, in Höhe von" angekreuzt — ' + EURO),
      warmwasser: num('Warmwasserkosten in EUR/Monat', 'nur wenn „ja, in Höhe von" angekreuzt — ' + EURO),
      unterschrift_vorhanden: UNTERSCHRIFT('„Unterschrift/Stempel Vermieter/in bzw. Verwalter/in"'),
    },
  },
  mietvertrag: {
    label: 'Mietvertrag',
    description: 'Wohnraum-Mietvertrag zwischen Vermieter und Mieter: mehrere Seiten mit §-Gliederung (Mietsache, Mietzeit, Miete, Kaution …) und Unterschriftenblock am Ende. Folgeseiten mit weiteren Paragrafen sind Fortsetzung.',
    fields: {
      ...PERSON,
      wohnflaeche_qm: num('Wohnfläche in m²'),
      grundmiete: num('Grundmiete (Nettokaltmiete) in EUR/Monat', EURO),
      nebenkosten: num('Vorauszahlung Betriebskosten ohne Heizung in EUR/Monat', EURO),
      heizkosten: num('Vorauszahlung Heizkosten in EUR/Monat', EURO),
      warmwasser: num('Vorauszahlung Warmwasser in EUR/Monat', EURO),
      gesamtmiete: num('Gesamtmiete in EUR/Monat', EURO),
      unterschrift_vorhanden: UNTERSCHRIFT('am Vertragsende — true nur, wenn Vermieter UND Mieter unterschrieben haben'),
    },
  },
  untermietvertrag: {
    label: 'Untermietvertrag',
    description: 'Untermietvertrag über ein Zimmer: Hauptmieter überlässt einem Untermieter einen Teil der Wohnung gegen Entgelt.',
    fields: {
      ...PERSON,
      zimmer_qm: num('Größe des untervermieteten Zimmers in m²'),
      entgelt: num('Monatliches Gesamtentgelt des Untermieters in EUR', EURO),
      unterschrift_vorhanden: UNTERSCHRIFT('am Vertragsende (beide Parteien)'),
    },
  },
  heimvertrag: {
    label: 'Heimvertrag',
    description: 'Wohn- und Betreuungsvertrag eines Pflegeheims bzw. einer Einrichtung (WBVG) mit Entgelt für Unterkunft, Verpflegung, Investitionskosten und Pflege.',
    fields: {
      ...PERSON,
      unterkunft_gesamt: num('Entgelt für Unterkunft einschließlich Investitionskosten in EUR/Monat', 'Summe aus Unterkunft und Investitionskosten, ohne Verpflegung und Pflege — ' + EURO),
      unterschrift_vorhanden: UNTERSCHRIFT('am Vertragsende'),
    },
  },
  mieterhoehung: {
    label: 'Mieterhöhung',
    description: 'Schreiben des Vermieters/der Hausverwaltung mit Mieterhöhungsverlangen (§ 558 BGB) oder Mitteilung einer neuen Miete, mit bisheriger und neuer Miete.',
    fields: {
      ...PERSON,
      neue_gesamtmiete: num('Neue Gesamtmiete in EUR/Monat', EURO),
      heizung_warmwasser: num('Darin enthaltene Heiz-/Warmwasserkosten in EUR/Monat', EURO),
    },
  },
  personalausweis: {
    label: 'Personalausweis',
    description: 'Kopie eines deutschen Personalausweises oder Reisepasses (Vorder- und Rückseite meist auf einer Seite). Jede Person hat eine eigene Kopie — neue Person = neues Dokument.',
    repeatable: true,
    fields: { ...PERSON, geburtsdatum: dat('Geburtsdatum') },
  },
  aufenthaltstitel: {
    label: 'Aufenthaltstitel',
    description: 'Kopie eines elektronischen Aufenthaltstitels (eAT, „Aufenthaltstitel"/„Residence Permit", z. B. Niederlassungserlaubnis) einer ausländischen Person.',
    repeatable: true,
    fields: { ...PERSON, geburtsdatum: dat('Geburtsdatum') },
  },
  gehaltsabrechnung: {
    label: 'Gehaltsabrechnung',
    description: 'Monatliche Entgelt-/Verdienstabrechnung eines Arbeitgebers (auch Minijob/Aushilfe, Ausbildungsvergütung, Kurzarbeit) mit Brutto, Abzügen und Netto. JEDE Monatsabrechnung ist ein eigenes Dokument — anderer Abrechnungsmonat oder andere Person = Neustart.',
    repeatable: true,
    fields: {
      ...PERSON,
      brutto: num('Gesamtbrutto des Monats in EUR', EURO),
    },
  },
  verdienstbescheinigung: {
    label: 'Verdienstbescheinigung',
    description: 'Bescheinigung des Arbeitgebers über die Bruttoverdienste der letzten Monate (Monatstabelle), oft „zur Vorlage bei der Wohngeldstelle", mit Stempel/Unterschrift.',
    repeatable: true,
    fields: { ...PERSON, monatsbrutto: num('Aktuelles Monatsbrutto in EUR', EURO) },
  },
  lohnersatzbescheid: {
    label: 'Bescheid über Lohnersatz/Förderung',
    description: 'Bewilligungsbescheid über Arbeitslosengeld (Agentur für Arbeit), Elterngeld (Elterngeldstelle), BAföG (Amt für Ausbildungsförderung) oder Krankengeld.',
    repeatable: true,
    fields: { ...PERSON, betrag: num('Monatsbetrag in EUR', EURO) },
  },
  steuerunterlagen: {
    label: 'Steuerbescheid/EÜR',
    description: 'Einkommensteuerbescheid des Finanzamts oder Einnahmen-Überschuss-Rechnung (EÜR) einer selbständigen Person.',
    repeatable: true,
    fields: { ...PERSON, jahreseinkuenfte: num('Einkünfte bzw. Gewinn im Jahr in EUR', EURO) },
  },
  rentenbescheid: {
    label: 'Rentenbescheid',
    description: 'Rentenbescheid oder Rentenanpassungsmitteilung eines Rentenversicherungsträgers (auch Witwen-/Witwerrente) mit monatlicher Bruttorente.',
    repeatable: true,
    fields: {
      ...PERSON,
      rentenart: txt('Rentenart', 'z. B. Regelaltersrente, Witwerrente — wie im Bescheid genannt'),
      betrag: num('Monatliche Bruttorente in EUR', EURO),
      grundrentenzeiten_vorhanden: bool('Grundrentenzeiten ausgewiesen', 'true, wenn Grundrentenzeiten/Grundrentenzuschlag genannt sind; false, wenn der Bescheid sie nicht nennt'),
    },
  },
  kontoauszug: {
    label: 'Kontoauszug',
    description: 'Kontoauszug einer Bank/Sparkasse mit Buchungsliste und altem/neuem Kontostand. Jeder Auszug (Monat/Auszugsnummer) ist ein eigenes Dokument.',
    repeatable: true,
    fields: {
      ...PERSON,
      mietzahlung_erkannt: bool('Mietzahlung erkennbar', 'true, wenn eine Überweisung/ein Dauerauftrag der Miete an Vermieter oder Hausverwaltung gebucht ist'),
      kapitalertraege_erkannt: bool('Kapitalerträge erkennbar'),
      mieteinnahmen_erkannt: bool('Mieteinnahmen erkennbar'),
    },
  },
  kv_nachweis: {
    label: 'Kranken-/Pflegeversicherung',
    description: 'Nachweis der Kranken- und Pflegeversicherung: Kopie der Gesundheitskarte (eGK/EHIC) oder Beitragsbescheinigung einer Krankenversicherung.',
    repeatable: true,
    fields: { ...PERSON },
  },
  schwerbehindertenausweis: {
    label: 'Schwerbehindertenausweis',
    description: 'Kopie eines Schwerbehindertenausweises (grün bzw. grün-orange) oder Feststellungsbescheid über den Grad der Behinderung (GdB).',
    repeatable: true,
    fields: { ...PERSON, gdb: num('Grad der Behinderung') },
  },
  pflegebescheid: {
    label: 'Pflegebescheid',
    description: 'Bescheid einer Pflegekasse über die Feststellung eines Pflegegrads.',
    repeatable: true,
    fields: { ...PERSON, pflegegrad: num('Pflegegrad') },
  },
  kindergeldbescheid: {
    label: 'Kindergeldbescheid',
    description: 'Bescheid der Familienkasse über die Festsetzung von Kindergeld.',
    repeatable: true,
    fields: { ...PERSON, betrag: num('Kindergeld insgesamt in EUR/Monat', EURO) },
  },
  unterhaltsnachweis: {
    label: 'Unterhaltsnachweis',
    description: 'Nachweis zu Unterhalt: Bescheid über Unterhaltsvorschuss (Jugendamt/UVG), amtliche Anlage „Aufwendungen zur Erfüllung gesetzlicher Unterhaltsverpflichtungen" (2 Seiten, Rückseite mit Hinweisen ist Fortsetzung), Jugendamtsurkunde/Unterhaltstitel oder Zahlungsbelege für Unterhalt.',
    repeatable: true,
    fields: { ...PERSON, betrag: num('Unterhaltsbetrag in EUR/Monat', EURO) },
  },
  transferleistungsbescheid: {
    label: 'Bescheid Bürgergeld/Sozialhilfe',
    description: 'Bescheid eines Jobcenters oder Sozialamts über Bürgergeld (SGB II) oder Sozialhilfe — Bewilligung oder Ablehnung.',
    repeatable: true,
    fields: { ...PERSON },
  },
  vermoegensnachweis: {
    label: 'Vermögensnachweis',
    description: 'Depot- oder Vermögensaufstellung einer Bank, Sparbuch, Bausparvertrag oder Nachweis zu Immobilienvermögen.',
    repeatable: true,
    fields: { ...PERSON, gesamtwert: num('Gesamtwert in EUR', EURO) },
  },
  sonstiges: {
    label: 'Sonstiges Schreiben',
    description: 'Sonstiges ohne eigenen Nachweistyp: Hinweisblatt zum Wohngeldantrag, Strom-/Energierechnung, Sterbeurkunde, Betreuerausweis/Bestellungsurkunde, Kita-Gebührenbescheid, Aufforderung des Jobcenters, Betreuungsvereinbarung getrennter Eltern, Abfindungs-/Aufhebungsvereinbarung, Erklärung von Angehörigen über Zuschüsse, Mitteilung über Sterbegeld.',
    mode: 'classify-only',
    repeatable: true,
  },
};

export function buildWohngeldEingangProject(): ExtractionProject {
  const now = `${WOHNGELD_PROFIL_VORLAGE_STAND}T00:00:00.000Z`;
  return {
    id: WOHNGELD_PROFIL_ID,
    name: 'Wohngeld-Eingang',
    description: `Sammel-Eingang der Wohngeldstelle: Antrag und Nachweise in einer PDF — Abschnitte erkennen und auslesen (Vorlage ${WOHNGELD_PROFIL_VORLAGE_STAND}, genutzt von der Wohngeld-App).`,
    created: now,
    updated: now,
    fields: {},
    instructions: 'Deutsche Unterlagen zu einem Wohngeldantrag. Beträge als Zahl in Euro (ohne Tausenderpunkt, Dezimalpunkt), Datumsangaben im Format JJJJ-MM-TT, Namen genau wie im Dokument. Nicht sichtbare Werte leer lassen, nichts erfinden.',
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    extraction: { strategy: 'hybrid', max_pages: 150, llm_confidence: false },
    segments: SEGMENTE,
  };
}
