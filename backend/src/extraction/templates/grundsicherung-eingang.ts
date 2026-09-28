/**
 * Vorlage: Segmentprofil „Grundsicherung-Eingang" — ein Sammel-Eingang (Antrag auf Grundsicherung
 * im Alter und bei Erwerbsminderung + Nachweise in einer PDF) wird seitenweise klassifiziert
 * (Segmentierung) und je Abschnitt ausgelesen. Die Grundsicherungs-App legt das Profil beim
 * ersten Gebrauch unter der ID `grundsicherung-eingang` an; danach ist es in der
 * Document-Processing-Oberfläche pflegbar (nie bearbeitete Profile werden auf neue
 * Vorlagenstände angehoben).
 *
 * Segmenttypen = die 21 Dokumenttypen der App (1:1, `apps/grundsicherung/types.ts`). Die Felder
 * sind so gewählt, dass sie ohne Umdeutung auf den DokumentAnalyse-Vertrag der Regel-Engine und
 * die Antrags-Stammdaten (Personen, Anspruchsgrund, Wohnung, Einkommen/Vermögen je Person …)
 * abbildbar sind — Abbildung in `apps/grundsicherung/dp-erkennung.ts`.
 *
 * Beschreibungen sind bewusst konkret (Lehren aus dem Wohngeld-Profil): Formularfolgeseiten
 * sind KEIN neues Dokument; Monats-Kontoauszüge und Bescheide je Person sind je ein Dokument.
 *
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md (Posteingang und Erkennung),
 * Felder: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 6.
 */
import type { ExtractionProject, ProjectField, ProjectItemField, SegmentTypeDef } from '../learning/types';

export const GRUNDSICHERUNG_PROFIL_ID = 'grundsicherung-eingang';
/** Bei fachlichen Änderungen der Vorlage hochzählen (steht in der Profilbeschreibung). */
export const GRUNDSICHERUNG_PROFIL_VORLAGE_STAND = '2026-09-28a';

const txt = (label: string, description?: string): ProjectField => ({ type: 'text', required: false, label, ...(description ? { description } : {}) });
const num = (label: string, description?: string): ProjectField => ({ type: 'number', required: false, label, ...(description ? { description } : {}) });
const dat = (label: string, description?: string): ProjectField => ({ type: 'date', required: false, label, ...(description ? { description } : {}) });
const bool = (label: string, description?: string): ProjectField => ({ type: 'boolean', required: false, label, ...(description ? { description } : {}) });
const spalte = (type: 'text' | 'number' | 'date' | 'boolean', label: string, description?: string): ProjectItemField => ({ type, label, ...(description ? { description } : {}) });
const liste = (label: string, description: string, item_fields: Record<string, ProjectItemField>): ProjectField => ({ type: 'list', required: false, label, description, item_fields });

/** Beträge stehen im Dokument mit Dezimalkomma („468,50") — als Zahl 468.5 angeben, nie ohne Komma. */
const EURO = 'Betrag mit Dezimalkomma im Dokument (z. B. „468,50") als Zahl 468.5 angeben — Nachkommastellen nicht verlieren';
const NEIN_LEER = 'Nur setzen, wenn im Dokument erkennbar; sonst leer lassen (nicht false raten)';

const NAME_SPALTEN = {
  nachname: spalte('text', 'Familienname', 'Name der Person, zu der die Zeile gehört (Block-Kopf bzw. Spalte „Person")'),
  vorname: spalte('text', 'Vorname(n)'),
};
const PERSON = {
  nachname: txt('Nachname', 'Familienname der Person, auf die sich das Dokument bezieht (Adressat, Versicherte:r, Kontoinhaber:in)'),
  vorname: txt('Vorname(n)'),
};
const UNTERSCHRIFT = (wo: string) => bool('Unterschrift vorhanden', `true, wenn ${wo} eine handschriftliche Unterschrift (gezeichnete Linie) zu sehen ist; false, wenn das Unterschriftsfeld leer ist`);
/** Standard-Neustartregel für Briefe/Bescheide mit Adressfeld. */
const NEUSTART_BRIEF = 'NEUSTART: Jede Seite mit eigenem Briefkopf mit Adressfeld (Herrn/Frau …), Datum und Anrede ist IMMER der Beginn eines neuen Dokuments (neustart = true) — auch wenn die vorige Seite vom selben Absender stammt und gleich aussieht. Folgeseiten ohne Adressfeld (Berechnung, Anlagen, Hinweise, Rechtsbehelfsbelehrung) sind Fortsetzung.';

const SEGMENTE: Record<string, SegmentTypeDef> = {
  grundsicherungsantrag: {
    label: 'Antrag auf Grundsicherung',
    description: 'Antragsformular auf Leistungen der Grundsicherung im Alter und bei Erwerbsminderung nach dem Vierten Kapitel SGB XII — Erst- oder Weiterbewilligungsantrag, als Muster des Deutschen Vereins oder als kommunales Formular des Sozialamts. Mehrseitig (typisch 8–16 Seiten) mit nummerierten Abschnitten: Angaben zur antragstellenden Person, Ehegatte/Lebenspartner:in, weitere Personen im Haushalt, Anspruchsgrund (Altersgrenze erreicht / dauerhaft voll erwerbsgemindert), Wohnung und Unterkunftskosten, Einkommen, Vermögen, Kranken- und Pflegeversicherung, Mehrbedarfe, Unterhaltspflichtige Kinder/Eltern, Bankverbindung, Erklärung und Unterschrift. ALLE Seiten dieses Formulars gehören dazu — auch Seiten mit Tabellen zu Einkommen/Vermögen, Ankreuzfeldern, Hinweisen zum Datenschutz (§ 67a SGB X) und zur Mitwirkung (§§ 60 ff. SGB I) sowie Anlagen/Zusatzblätter zum Antrag (z. B. „Anlage Einkommen", „Anlage Vermögen", „Anlage Unterkunft"). Neustart nur auf der ersten Formularseite (Titel „Antrag auf Leistungen der Grundsicherung …").',
    fields: {
      antragsart: txt('Antragsart', '„erstantrag", „weiterbewilligung" (Weiterbewilligungs-/Folgeantrag, oft mit Aktenzeichen) oder „aenderung"'),
      aktenzeichen: txt('Aktenzeichen des Sozialamts', 'nur wenn eingetragen (Weiterbewilligung)'),
      antragsdatum: dat('Antragsdatum', 'Datum neben der Unterschrift auf der letzten Seite, sonst Eingangsstempel'),
      datum_vorhanden: bool('Datum bei der Unterschrift vorhanden', 'true, wenn neben der Unterschrift ein Datum eingetragen ist; false, wenn das Datumsfeld leer ist'),
      unterschrift_vorhanden: UNTERSCHRIFT('im Feld „Unterschrift Antragsteller/in" bzw. „Unterschrift Betreuer/in / Bevollmächtigte/r" auf der letzten Seite'),
      anspruchsgrund: txt('Anspruchsgrund', '„alter", wenn „Altersgrenze erreicht"/„Altersrente" angekreuzt ist; „erwerbsminderung", wenn „dauerhaft voll erwerbsgemindert" angekreuzt ist'),
      antragsteller_nachname: txt('Familienname der antragstellenden Person'),
      antragsteller_vorname: txt('Vorname(n) der antragstellenden Person'),
      antragsteller_geburtsname: txt('Geburtsname der antragstellenden Person'),
      antragsteller_geburtsdatum: dat('Geburtsdatum der antragstellenden Person'),
      antragsteller_familienstand: txt('Familienstand der antragstellenden Person', 'angekreuzter Wert als Text: ledig, verheiratet, getrennt lebend, geschieden, verwitwet, eingetragene Lebenspartnerschaft, eheähnliche Gemeinschaft'),
      antragsteller_staatsangehoerigkeit: txt('Staatsangehörigkeit der antragstellenden Person'),
      partner_nachname: txt('Familienname Ehegatte/Lebenspartner:in', 'Abschnitt „Ehegatte / Lebenspartner / Partner einer eheähnlichen Gemeinschaft" — leer, wenn der Abschnitt nicht ausgefüllt ist'),
      partner_vorname: txt('Vorname(n) Ehegatte/Lebenspartner:in'),
      partner_geburtsdatum: dat('Geburtsdatum Ehegatte/Lebenspartner:in'),
      partner_staatsangehoerigkeit: txt('Staatsangehörigkeit Ehegatte/Lebenspartner:in'),
      haushaltsangehoerige: liste('Weitere Personen im Haushalt', 'Abschnitt „Weitere Personen in der Wohnung/im Haushalt" (z. B. erwachsene Kinder, Angehörige, Untermieter): je ausgefüllter Zeile eine Zeile. Antragsteller:in und Partner:in gehören NICHT dazu.', {
        ...NAME_SPALTEN,
        geburtsdatum: spalte('date', 'Geburtsdatum'),
        verhaeltnis: spalte('text', 'Verhältnis zur antragstellenden Person', 'wie eingetragen, z. B. „Sohn", „Tochter", „Untermieter"'),
      }),
      strasse: txt('Straße der Wohnung'),
      hausnummer: txt('Hausnummer'),
      plz: txt('Postleitzahl'),
      ort: txt('Ort'),
      wohnsituation: txt('Wohnsituation', 'angekreuzt als Text: „miete" (Mietwohnung), „untermiete", „eigentum" (eigenes Haus/Eigentumswohnung), „bei_angehoerigen" (mietfrei bei Angehörigen), „einrichtung" (Heim, besondere Wohnform)'),
      kaltmiete: num('Grundmiete (Kaltmiete) in EUR/Monat', EURO),
      nebenkosten_kalt: num('Kalte Nebenkosten/Betriebskosten-Vorauszahlung in EUR/Monat', 'ohne Heizung — ' + EURO),
      heizkosten: num('Heizkosten-Vorauszahlung in EUR/Monat', EURO),
      heizung_in_miete_enthalten: bool('Heizkosten in der Miete enthalten (Pauschal-/Inklusivmiete)', NEIN_LEER),
      warmwasser: txt('Warmwasserbereitung', '„zentral" (über die Heizung) oder „dezentral" (Boiler/Durchlauferhitzer, Strom)'),
      wohnflaeche_qm: num('Wohnfläche in m²'),
      bewohner_anzahl: num('Anzahl der Personen in der Wohnung'),
      einkommen: liste('Einkommen je Person', 'Abschnitt Einkommen (auch Anlage Einkommen): je angegebener Einkommensart und Person eine Zeile mit dem Monatsbetrag. Leere Zeilen und „nein"-Antworten weglassen.', {
        ...NAME_SPALTEN,
        art: spalte('text', 'Art des Einkommens', 'wie eingetragen, z. B. „Altersrente", „Rente wegen Erwerbsminderung", „Witwenrente", „Betriebsrente", „Zusatzversorgung (VBL)", „Wohngeld", „Unterhalt", „Minijob", „Kapitalerträge", „Mieteinnahmen"'),
        betrag_monat: spalte('number', 'Betrag in EUR/Monat', 'Zahlbetrag — ' + EURO),
        traeger: spalte('text', 'Zahlende Stelle', 'z. B. „Deutsche Rentenversicherung Bund", „VBL"'),
      }),
      keine_einkuenfte: bool('„Keine Einkünfte" angekreuzt', NEIN_LEER),
      bisheriger_lebensunterhalt: txt('Wovon wurde der Lebensunterhalt bisher bestritten?', 'Freitext, nur wenn ausgefüllt'),
      vermoegen: liste('Vermögen je Person', 'Abschnitt Vermögen (auch Anlage Vermögen): je angegebener Vermögensposition eine Zeile. Leere Zeilen und „nein"-Antworten weglassen.', {
        ...NAME_SPALTEN,
        art: spalte('text', 'Art', 'wie eingetragen, z. B. „Girokonto", „Sparbuch", „Tagesgeld", „Depot", „Bausparvertrag", „Lebensversicherung", „Bestattungsvorsorge", „Kfz", „Haus/Eigentumswohnung"'),
        betrag: spalte('number', 'Wert/Stand in EUR', EURO),
      }),
      kein_vermoegen: bool('„Kein Vermögen" angekreuzt', 'true, wenn ausdrücklich angekreuzt ist, dass kein Vermögen vorhanden ist; sonst leer'),
      krankenversicherung: liste('Kranken-/Pflegeversicherung je Person', 'Abschnitt Kranken- und Pflegeversicherung: je Person eine Zeile.', {
        ...NAME_SPALTEN,
        art: spalte('text', 'Art der Versicherung', 'z. B. „pflichtversichert (KVdR)", „familienversichert", „freiwillig versichert", „privat versichert", „nicht versichert"'),
        kasse: spalte('text', 'Krankenkasse/Versicherung'),
        beitrag: spalte('number', 'Eigener Beitrag in EUR/Monat', EURO),
      }),
      schwerbehinderung: liste('Schwerbehinderung je Person', 'nur wenn „Schwerbehindertenausweis vorhanden" angegeben: je Person eine Zeile.', {
        ...NAME_SPALTEN,
        gdb: spalte('number', 'Grad der Behinderung (GdB)'),
        merkzeichen: spalte('text', 'Merkzeichen', 'wie eingetragen, mehrere mit Komma, z. B. „G", „G, B", „aG"'),
        gueltig_bis: spalte('date', 'Ausweis gültig bis'),
      }),
      mehrbedarf_ernaehrung: liste('Mehrbedarf kostenaufwändige Ernährung', 'nur wenn Mehrbedarf wegen kostenaufwändiger Ernährung (Krankenkost) beantragt ist: je betroffener Person eine Zeile.', {
        ...NAME_SPALTEN,
        erkrankung: spalte('text', 'Erkrankung/Kostform', 'nur wenn angegeben'),
      }),
      em_voll: bool('Volle Erwerbsminderung angegeben', 'true bei „voll erwerbsgemindert", false bei „teilweise erwerbsgemindert"; sonst leer'),
      em_dauerhaft: bool('Dauerhafte Erwerbsminderung angegeben', 'true bei „dauerhaft"/„unbefristet", false bei „befristet"/„auf Zeit"; sonst leer'),
      em_befristet_bis: dat('Erwerbsminderungsrente befristet bis', 'nur wenn ein Datum eingetragen ist'),
      betreuung: txt('Rechtliche Vertretung', '„betreuung" (gesetzliche Betreuung), „vollmacht" (Bevollmächtigte:r), „keine"'),
      vertreter_name: txt('Name der Betreuerin/des Betreuers bzw. der/des Bevollmächtigten'),
      unterhalt_angaben_gemacht: bool('Angaben zu unterhaltspflichtigen Kindern/Eltern gemacht', 'true, wenn der Abschnitt „Unterhaltspflichtige Angehörige (Kinder, Eltern)" ausgefüllt ist (auch „keine Kinder"); false, wenn er leer ist'),
      unterhalt_ueber_100k: bool('Einkommen eines Kindes/Elternteils über 100.000 € möglich', 'Ankreuzfrage „Hat ein Kind/Elternteil ein jährliches Gesamteinkommen von mehr als 100.000 €?" (§ 94 Abs. 1a SGB XII): true bei „ja"/„möglich", false bei „nein"; sonst leer'),
      iban: txt('IBAN der Bankverbindung', 'ohne Leerzeichen'),
      vorbezug_leistung: txt('Bisher bezogene Leistung', 'nur wenn angegeben, z. B. „Bürgergeld", „Hilfe zum Lebensunterhalt", „Wohngeld"'),
      vorbezug_bis: dat('Bisheriger Leistungsbezug bis'),
      wohngeld_antrag_laeuft: bool('Wohngeldantrag gestellt und noch nicht beschieden', NEIN_LEER),
      regelbedarfsstufe: num('Regelbedarfsstufe', 'nur wenn im Formular eingetragen (1, 2 oder 3)'),
    },
  },
  personalausweis: {
    label: 'Personalausweis / Pass',
    description: 'Kopie eines deutschen Personalausweises, Reisepasses oder eines ausländischen Passes bzw. Aufenthaltstitels (Vorder- und Rückseite meist auf einer Seite). Jede Person hat eine eigene Kopie — neue Person = neues Dokument. NEUSTART: Jede Seite mit eigenem Ausweisbild (Foto/Name der Person) ist IMMER der Beginn eines neuen Dokuments (neustart = true).',
    repeatable: true,
    fields: {
      ...PERSON,
      geburtsname: txt('Geburtsname'),
      geburtsdatum: dat('Geburtsdatum'),
      staatsangehoerigkeit: txt('Staatsangehörigkeit'),
      gueltig_bis: dat('Gültig bis'),
    },
  },
  betreuerausweis: {
    label: 'Betreuerausweis / Vollmacht',
    description: 'Betreuerausweis bzw. Bestellungsurkunde des Betreuungsgerichts (mit Aufgabenkreisen) oder Vorsorge-/Generalvollmacht für die antragstellende Person.',
    repeatable: true,
    fields: {
      ...PERSON,
      art: txt('Art', '„Betreuerausweis", „Bestellungsurkunde" oder „Vollmacht"'),
      vertreter_name: txt('Name der Betreuerin/des Betreuers bzw. der/des Bevollmächtigten'),
      gueltig_bis: dat('Gültig bis'),
    },
  },
  rentenbescheid: {
    label: 'Rentenbescheid',
    description: 'Rentenbescheid eines Trägers der gesetzlichen Rentenversicherung (Deutsche Rentenversicherung Bund/Land, Knappschaft) über Altersrente, Rente wegen voller oder teilweiser Erwerbsminderung oder Hinterbliebenenrente, typisch mehrseitig (Bescheid, Berechnung der Rente, Anlagen, Hinweise zur Kranken- und Pflegeversicherung). ' + NEUSTART_BRIEF + ' Zwei Bescheide für zwei Personen (Ehepaar) sind zwei Dokumente. Eine reine „Rentenanpassung zum 1. Juli"-Mitteilung ist KEIN Rentenbescheid, sondern „rentenanpassungsmitteilung".',
    repeatable: true,
    fields: {
      ...PERSON,
      geburtsdatum: dat('Geburtsdatum', 'im Bescheid genannt (Adresskopf/Versicherungsnummer-Zeile)'),
      rentenart: txt('Rentenart', 'wie im Bescheid genannt, z. B. „Regelaltersrente", „Altersrente für schwerbehinderte Menschen", „Rente wegen voller Erwerbsminderung", „Rente wegen teilweiser Erwerbsminderung", „große Witwenrente"'),
      befristet_bis: dat('Rente befristet bis', 'nur bei „Rente auf Zeit"/„befristet bis …"'),
      unbefristet: bool('Rente ausdrücklich unbefristet', 'true, wenn der Bescheid „unbefristet"/„auf Dauer" sagt; false, wenn er „befristet"/„auf Zeit" sagt; sonst leer'),
      arbeitsmarktabhaengig: bool('Arbeitsmarktrente', 'true, wenn die volle Erwerbsminderungsrente wegen verschlossenem Teilzeitarbeitsmarkt gewährt wird („Arbeitsmarktlage"); sonst leer'),
      zahlbetrag: num('Monatlicher Zahlbetrag in EUR', 'Betrag nach Abzug der Kranken-/Pflegeversicherungsbeiträge („Zahlbetrag", „laufende Zahlung") — ' + EURO),
      zahlbetrag_ab: dat('Zahlbetrag gilt ab'),
      bruttorente: num('Monatliche Rente vor Abzügen in EUR', EURO),
      bescheiddatum: dat('Datum des Bescheids'),
      grundrentenzuschlag: bool('Grundrentenzuschlag ausgewiesen', NEIN_LEER),
      versicherungsnummer: txt('Versicherungsnummer'),
    },
  },
  rentenanpassungsmitteilung: {
    label: 'Rentenanpassungsmitteilung',
    description: 'Mitteilung über die Rentenanpassung zum 1. Juli (Renten Service der Deutschen Post / Rentenversicherung), meist 1–2 Seiten mit bisherigem und neuem Zahlbetrag. ' + NEUSTART_BRIEF,
    repeatable: true,
    fields: {
      ...PERSON,
      stichtag: dat('Anpassung zum', 'z. B. 2026-07-01'),
      zahlbetrag_alt: num('Bisheriger Zahlbetrag in EUR/Monat', EURO),
      zahlbetrag_neu: num('Neuer Zahlbetrag in EUR/Monat', EURO),
    },
  },
  em_feststellung_rv: {
    label: 'Feststellung Erwerbsminderung (Rentenversicherung)',
    description: 'Gutachterliche Stellungnahme bzw. Mitteilung des Rentenversicherungsträgers an den Sozialhilfeträger über die Prüfung der dauerhaften vollen Erwerbsminderung (Ersuchen nach § 45 SGB XII / § 109a SGB VI). ' + NEUSTART_BRIEF,
    repeatable: true,
    fields: {
      ...PERSON,
      geburtsdatum: dat('Geburtsdatum'),
      dauerhaft_voll_erwerbsgemindert: bool('Ergebnis: dauerhaft voll erwerbsgemindert', 'true, wenn die Stellungnahme dauerhafte volle Erwerbsminderung bejaht; false, wenn sie sie verneint'),
      datum: dat('Datum der Stellungnahme'),
    },
  },
  betriebsrente_mitteilung: {
    label: 'Mitteilung Betriebsrente / Zusatzversorgung',
    description: 'Leistungsmitteilung einer Betriebsrente, Zusatzversorgung des öffentlichen Dienstes (VBL, ZVK), Pensionskasse, Beamtenpension oder privaten Rente (auch Riester-Rente) mit monatlichem Betrag. ' + NEUSTART_BRIEF,
    repeatable: true,
    fields: {
      ...PERSON,
      traeger: txt('Zahlende Stelle', 'z. B. „VBL", „Pensionskasse …"'),
      art: txt('Art', '„betriebsrente", „zusatzversorgung", „pension" oder „private_rente"'),
      betrag_monat: num('Monatlicher Zahlbetrag in EUR', EURO),
    },
  },
  kontoauszug: {
    label: 'Kontoauszug',
    description: 'Kontoauszug einer Bank/Sparkasse (Giro-, Spar-, Tagesgeldkonto, auch Online-Umsatzliste) mit Buchungsliste und altem/neuem Kontostand. Jeder Auszug (Monat/Auszugsnummer, anderes Konto) ist ein eigenes Dokument. NEUSTART: Jede Seite mit eigenem Auszugskopf (Bank, Auszugsnummer/Zeitraum, „Alter Kontostand", „Blatt 1 von …") ist IMMER der Beginn eines neuen Dokuments (neustart = true) — auch wenn die vorige Seite vom selben Kreditinstitut stammt und gleich aussieht; eine andere Auszugsnummer (Nr. 3 → Nr. 4) oder ein anderer Monat ist immer ein neues Dokument. Fortsetzung (neustart = false) ist nur eine Seite, die OBEN mit „Übertrag von Blatt …" beginnt bzw. „Blatt 2 von 2" zeigt. Ein „Übertrag auf Blatt 2" am SEITENENDE macht die Seite NICHT zur Fortsetzung — sie ist Blatt 1 des neuen Auszugs.',
    repeatable: true,
    fields: {
      ...PERSON,
      iban: txt('IBAN', 'ohne Leerzeichen'),
      zeitraum_von: dat('Zeitraum von', 'erstes Buchungs-/Auszugsdatum'),
      zeitraum_bis: dat('Zeitraum bis', 'letztes Buchungs-/Auszugsdatum'),
      endsaldo: num('Neuer Kontostand (Endsaldo) in EUR', 'negativ bei „Soll" — ' + EURO),
      eingaenge: liste('Wiederkehrende und auffällige Eingänge', 'Gutschriften (Haben-Buchungen), je Absender GENAU EINE Zeile (z. B. drei Rentenzahlungen = eine Zeile mit anzahl 3; bei mehrseitigen Auszügen dieselbe Buchung nicht doppelt aufnehmen). Nicht aufnehmen: Umbuchungen zwischen eigenen Konten.', {
        betrag: spalte('number', 'Einzelbetrag je Buchung in EUR', EURO),
        verwendungszweck: spalte('text', 'Absender/Verwendungszweck', 'kurz, wie auf dem Auszug, z. B. „Deutsche Rentenversicherung", „VBL", „Wohngeld Stadt"'),
        art: spalte('text', 'Art', 'eine von: rente (gesetzliche Rentenversicherung), betriebsrente (Betriebsrente, VBL/ZVK, Pensionskasse), wohngeld, unterhalt, erwerb (Lohn/Gehalt), kapitalertrag, miete_einnahme, zuwendung (regelmäßige Überweisungen von Angehörigen/Partner:in, z. B. „Haushaltsgeld"), sozialleistung (Jobcenter, Sozialamt, Krankengeld), erstattung, sonstige'),
        wiederkehrend: spalte('boolean', 'Wiederkehrend', 'true, wenn die Zahlung erkennbar laufend ist — auch wenn sie im Monatsauszug nur EINMAL vorkommt: Renten und Betriebsrenten (Verwendungszweck mit Monat, z. B. „RENTE 05/26", „BETRIEBSRENTE 03/2026"), Wohngeld, Unterhalt, Lohn, Dauerauftrag, regelmäßiges Haushaltsgeld. false nur für erkennbar einmalige Gutschriften (Erstattung, Rückzahlung, Geschenk)'),
        anzahl: spalte('number', 'Anzahl Buchungen im Zeitraum'),
      }),
      mietzahlung_erkannt: bool('Mietzahlung erkennbar', 'true, wenn eine Überweisung/ein Dauerauftrag der Miete an Vermieter oder Hausverwaltung gebucht ist; false, wenn der Auszug geprüft ist und keine Miete enthält'),
      mietzahlung_betrag: num('Betrag der Mietzahlung in EUR', EURO),
      grosse_abgaenge: liste('Größere Abbuchungen/Barabhebungen', 'Abbuchungen und Barabhebungen ab 500 EUR, die keine laufenden Kosten (Miete, Energie, Versicherung) sind.', {
        betrag: spalte('number', 'Betrag in EUR', 'positiv angeben — ' + EURO),
        datum: spalte('date', 'Buchungsdatum'),
        verwendungszweck: spalte('text', 'Empfänger/Verwendungszweck'),
      }),
    },
  },
  mietvertrag: {
    label: 'Mietvertrag',
    description: 'Wohnraum-Mietvertrag oder Untermietvertrag zwischen Vermieter und Mieter:in(nen): mehrere Seiten mit §-Gliederung (Mietsache, Mietzeit, Miete und Nebenkosten, Kaution …) und Unterschriftenblock am Ende. Folgeseiten mit weiteren Paragrafen und Anlagen (Hausordnung, Übergabeprotokoll) sind Fortsetzung.',
    fields: {
      mieter: liste('Mieter:innen', 'alle im Vertragskopf als Mieter genannten Personen, je Person GENAU EINE Zeile (Namen im Unterschriftenblock nicht erneut aufnehmen)', { ...NAME_SPALTEN }),
      beginn: dat('Mietbeginn'),
      wohnflaeche_qm: num('Wohnfläche in m²'),
      grundmiete: num('Grundmiete (Nettokaltmiete) in EUR/Monat', EURO),
      nebenkosten_kalt: num('Vorauszahlung Betriebskosten ohne Heizung in EUR/Monat', EURO),
      heizkosten: num('Vorauszahlung Heizkosten in EUR/Monat', EURO),
      pauschalmiete: num('Pauschal-/Inklusivmiete in EUR/Monat', 'nur wenn der Vertrag einen Gesamtbetrag ohne Aufschlüsselung nennt — ' + EURO),
      heizkosten_enthalten: bool('Heizkosten in der Miete enthalten', 'true, wenn Heizkosten ausdrücklich in der (Pauschal-)Miete enthalten sind, ohne eigenen Betrag; sonst leer'),
      unterschrift_vorhanden: UNTERSCHRIFT('im Unterschriftenblock am Vertragsende (meist letzte Seite, über den Beschriftungen „Vermieter" und „Mieter") — true, wenn dort über den Linien gezeichnete Unterschriften von Vermieter UND Mieter zu sehen sind; ein gedrucktes Ort/Datum allein ist keine Unterschrift —'),
    },
  },
  vermieterbescheinigung: {
    label: 'Vermieterbescheinigung',
    description: 'Mietbescheinigung/Vermieterbescheinigung für das Sozialamt (Formular mit Grundmiete, Nebenkosten, Heizkosten, Bewohnerzahl, Unterschrift/Stempel des Vermieters) oder Schreiben des Vermieters über eine Mieterhöhung bzw. neue Vorauszahlungen. Rückseiten mit Erläuterungen oder Gesetzestext gehören dazu (neustart = false).',
    repeatable: true,
    fields: {
      grundmiete: num('Grundmiete in EUR/Monat', EURO),
      nebenkosten_kalt: num('Kalte Nebenkosten in EUR/Monat', EURO),
      heizkosten: num('Heizkosten in EUR/Monat', EURO),
      gueltig_ab: dat('Gültig ab'),
      bewohner_anzahl: num('Anzahl Bewohner:innen'),
    },
  },
  nebenkostenabrechnung: {
    label: 'Nebenkostenabrechnung',
    description: 'Jährliche Betriebs- und/oder Heizkostenabrechnung des Vermieters bzw. der Hausverwaltung (auch vom Messdienst, z. B. ista, Techem, Brunata) mit Abrechnungszeitraum, Kostenaufstellung, Nachzahlung/Guthaben und neuer Vorauszahlung. Mehrseitig — Aufstellungs- und Erläuterungsseiten sind Fortsetzung.',
    repeatable: true,
    fields: {
      abrechnungszeitraum_von: dat('Abrechnungszeitraum von'),
      abrechnungszeitraum_bis: dat('Abrechnungszeitraum bis'),
      heizkosten_enthalten: bool('Heizkostenanteil ausgewiesen', 'true, wenn die Abrechnung Heiz-/Warmwasserkosten enthält; false, wenn nur kalte Betriebskosten abgerechnet werden'),
      nachzahlung_guthaben: num('Nachzahlung (positiv) bzw. Guthaben (negativ) in EUR', EURO),
      neue_vorauszahlung: num('Neue monatliche Vorauszahlung in EUR', EURO),
    },
  },
  energieabrechnung: {
    label: 'Heiz-/Energiekostenabrechnung',
    description: 'Jahresabrechnung oder Abschlagsplan eines Energieversorgers (Gas, Fernwärme, Strom für Heizung/Warmwasser) oder Rechnung über Heizöl/Pellets.',
    repeatable: true,
    fields: {
      art: txt('Energieart', 'z. B. „Gas", „Fernwärme", „Heizöl", „Strom"'),
      abschlag: num('Monatlicher Abschlag in EUR', EURO),
      jahresbetrag: num('Jahresbetrag in EUR', EURO),
    },
  },
  eigentum_nachweis: {
    label: 'Nachweis Wohneigentum / Hauslasten',
    description: 'Unterlagen zum selbst genutzten Wohneigentum: Grundbuchauszug, Kaufvertrag, Darlehensvertrag oder -kontoauszug (Zinsen/Tilgung), Grundsteuerbescheid, Wohngebäudeversicherung, Abrechnung der Eigentümergemeinschaft (Hausgeld).',
    repeatable: true,
    fields: {
      art: txt('Art des Nachweises', 'z. B. „Grundsteuerbescheid", „Darlehenskontoauszug", „Hausgeldabrechnung"'),
      betrag: num('Betrag in EUR (Jahr bzw. laut Dokument)', EURO),
    },
  },
  vermoegensnachweis: {
    label: 'Vermögensnachweis',
    description: 'Nachweis über Vermögen: Sparbuch (Kopie der letzten beschriebenen Seite), Depot- oder Vermögensaufstellung der Bank, Bausparvertrag, Bescheinigung über den Rückkaufswert einer Lebens-/Kapitalversicherung, Riester-Bescheinigung. Jede Anlage/jedes Konto ist ein eigenes Dokument.',
    repeatable: true,
    fields: {
      ...PERSON,
      art: txt('Art', 'eine von: girokonto, sparbuch, tagesgeld, depot, bausparvertrag, lebensversicherung, riester, sonstiges'),
      stand: num('Stand/Guthaben bzw. Kurswert in EUR', EURO),
      stichtag: dat('Stichtag des Stands'),
      rueckkaufswert: num('Rückkaufswert in EUR', 'nur bei Lebens-/Kapitalversicherung — ' + EURO),
    },
  },
  bestattungsvorsorge: {
    label: 'Bestattungsvorsorgevertrag',
    description: 'Bestattungsvorsorgevertrag mit einem Bestattungsinstitut, Treuhandvertrag (z. B. Deutsche Bestattungsvorsorge Treuhand) oder Sterbegeldversicherung mit Leistungsverzeichnis und Betrag.',
    repeatable: true,
    fields: {
      ...PERSON,
      art: txt('Art', '„Bestattungsvorsorgevertrag", „Treuhandvertrag" oder „Sterbegeldversicherung"'),
      betrag: num('Vertrags-/Versicherungssumme in EUR', EURO),
    },
  },
  kv_pv_nachweis: {
    label: 'Kranken-/Pflegeversicherungsnachweis',
    description: 'Nachweis der Kranken- und Pflegeversicherung: Mitgliedsbescheinigung, Beitragsbescheid einer gesetzlichen Krankenkasse, Kopie der Gesundheitskarte oder Versicherungsschein einer privaten Krankenversicherung (auch Basistarif).',
    repeatable: true,
    fields: {
      ...PERSON,
      art: txt('Art der Versicherung', 'z. B. „pflichtversichert (KVdR)", „familienversichert", „freiwillig versichert", „privat versichert"'),
      kasse: txt('Krankenkasse/Versicherung'),
      beitrag: num('Monatlicher Beitrag in EUR', EURO),
    },
  },
  schwerbehindertenausweis: {
    label: 'Schwerbehindertenausweis',
    description: 'Kopie eines Schwerbehindertenausweises (grün bzw. grün-orange, Vorder- und Rückseite) oder Feststellungsbescheid des Versorgungsamts über den Grad der Behinderung (GdB) und Merkzeichen.',
    repeatable: true,
    fields: {
      ...PERSON,
      gdb: num('Grad der Behinderung (GdB)'),
      merkzeichen: txt('Merkzeichen', 'alle eingetragenen Merkzeichen mit Komma, z. B. „G", „G, B", „aG, RF"; leer, wenn keine'),
      gueltig_bis: dat('Gültig bis', 'leer bei „unbefristet"'),
    },
  },
  aerztliche_bescheinigung: {
    label: 'Ärztliche Bescheinigung',
    description: 'Ärztliche Bescheinigung oder Attest: über eine Erkrankung mit notwendiger kostenaufwändiger Ernährung (Krankenkost, Mehrbedarf § 30 Abs. 5 SGB XII) oder ärztliche Befunde/Gutachten zur Leistungsfähigkeit (für die Prüfung der Erwerbsminderung).',
    repeatable: true,
    fields: {
      ...PERSON,
      zweck: txt('Zweck', '„ernaehrung" (Krankenkost/kostenaufwändige Ernährung), „em_befund" (Befund zur Erwerbsfähigkeit) oder „sonstiges"'),
      datum: dat('Ausstellungsdatum'),
    },
  },
  wohngeldbescheid: {
    label: 'Wohngeldbescheid',
    description: 'Bescheid der Wohngeldstelle über Wohngeld (Mietzuschuss oder Lastenzuschuss) mit monatlichem Betrag, Bewilligungszeitraum und berücksichtigten Haushaltsmitgliedern. ' + NEUSTART_BRIEF,
    repeatable: true,
    fields: {
      ...PERSON,
      betrag_monat: num('Wohngeld in EUR/Monat', EURO),
      bwz_von: dat('Bewilligungszeitraum von'),
      bwz_bis: dat('Bewilligungszeitraum bis'),
      bescheiddatum: dat('Datum des Bescheids'),
    },
  },
  transferleistungsbescheid: {
    label: 'Bescheid über andere Sozialleistungen',
    description: 'Bescheid über eine andere Sozialleistung: Bürgergeld (Jobcenter, SGB II), Arbeitslosengeld (Agentur für Arbeit), Krankengeld, Hilfe zum Lebensunterhalt, Leistungen nach BVG/LAG — Bewilligung, Änderung, Einstellung oder Ablehnung. ' + NEUSTART_BRIEF,
    repeatable: true,
    fields: {
      ...PERSON,
      leistung: txt('Leistung', 'z. B. „Bürgergeld", „Arbeitslosengeld", „Krankengeld"'),
      betrag_monat: num('Betrag in EUR/Monat', EURO),
      bis: dat('Bewilligt bis bzw. eingestellt zum'),
    },
  },
  sonstiges: {
    label: 'Sonstiges Schreiben',
    description: 'Sonstiges ohne eigenen Nachweistyp: Anschreiben, formlose Erklärungen, Meldebescheinigung, Sterbeurkunde, Unterhaltstitel, Schenkungs-/Übergabevertrag, Fahrzeugschein, Gehaltsabrechnung, Werkstattbescheinigung (WfbM), Weiterleitungsschreiben einer anderen Behörde (z. B. „Ihr Antrag wurde an das zuständige Sozialamt weitergeleitet"). NICHT „sonstiges": Folge-, Rück- und Hinweisseiten eines Formulars oder Bescheids — diese gehören zum Dokument davor.',
    mode: 'classify-only',
    repeatable: true,
  },
};

export function buildGrundsicherungEingangProject(): ExtractionProject {
  const now = `${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND.slice(0, 10)}T00:00:00.000Z`;
  return {
    id: GRUNDSICHERUNG_PROFIL_ID,
    name: 'Grundsicherung-Eingang',
    description: `Sammel-Eingang des Sozialamts (Grundsicherung im Alter und bei Erwerbsminderung): Antrag und Nachweise in einer PDF — Abschnitte erkennen und auslesen (Vorlage ${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND}, genutzt von der Grundsicherungs-App).`,
    created: now,
    updated: now,
    fields: {},
    instructions: 'Deutsche Unterlagen zu einem Antrag auf Grundsicherung im Alter und bei Erwerbsminderung (SGB XII). Beträge als Zahl in Euro (ohne Tausenderpunkt, Dezimalpunkt), Datumsangaben im Format JJJJ-MM-TT, Namen genau wie im Dokument. Nicht sichtbare Werte leer lassen, nichts erfinden; Ja/Nein-Felder nur setzen, wenn die Antwort im Dokument erkennbar ist.',
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    extraction: { strategy: 'hybrid', max_pages: 150, llm_confidence: false },
    segments: SEGMENTE,
  };
}
