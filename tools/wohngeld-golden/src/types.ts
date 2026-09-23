/**
 * Fallmodell des Golden Datasets. Eine Fallbeschreibung ist die einzige Quelle
 * für alle Unterlagen eines Falls UND für die Erwartungsdatei — so passen die
 * Zahlen über alle Dokumente zusammen, und Widersprüche sind nur dort, wo sie
 * über `antragAbweichung`/`dokumente[].optionen` bewusst gesetzt werden.
 */

/** App-Dokumenttypen (Spiegel von backend/src/apps/wohngeld/types.ts). */
export type DokumentTyp =
  | 'wohngeldantrag' | 'personalausweis' | 'mietvertrag' | 'mietbescheinigung'
  | 'rentenbescheid' | 'verdienstbescheinigung' | 'gehaltsabrechnung' | 'kontoauszug'
  | 'kv_pv_nachweis' | 'schwerbehindertenausweis' | 'pflegenachweis' | 'kindergeldnachweis'
  | 'unterhaltsnachweis' | 'transferleistungsbescheid' | 'vermoegensnachweis' | 'sonstiges';

export type Geschlecht = 'maennlich' | 'weiblich' | 'divers' | 'keineAngabe';
export type Familienstand = 'ledig' | 'verheiratet' | 'getrenntlebend' | 'eingLebenspartner' | 'geschieden' | 'verwitwet' | 'nichtehelicheLebenspartner';
export type Erwerb = 'Arbeitnehmer' | 'Selbständiger' | 'Azubi' | 'Rentner' | 'Nichterwerbsperson' | 'Arbeitslos';

export interface Einnahme {
  art: string;                 // Formulartext, z. B. "Gehalt/Lohn", "Altersrente"
  brutto: number;              // EUR je Turnus
  turnus: 'monatlich' | 'jährlich' | 'einmalig';
}

export interface Beschaeftigung {
  arbeitgeber: string;
  arbeitgeberAnschrift: string;
  personalnummer: string;
  eintritt: string;            // ISO
  steuerklasse: string;        // "I", "III" …
  wochenstunden: number;
  kirche: boolean;
}

export interface Rente {
  art: string;                 // "Regelaltersrente", "Witwerrente" …
  traeger: string;
  traegerAnschrift: string;
  versicherungsnummer: string;
  brutto: number;              // monatlich
  rentenbeginn: string;        // ISO
}

export interface Person {
  id: string;                  // "P1" = antragstellende Person
  vorname: string;
  nachname: string;
  geburtsname?: string;
  geburtsdatum: string;        // ISO
  geburtsort: string;
  staatsangehoerigkeit: string;
  geschlecht: Geschlecht;
  familienstand: Familienstand;
  erwerb: Erwerb;
  verhaeltnis?: string;        // nur Haushaltsmitglieder: "Ehemann", "Tochter" …
  einnahmen: Einnahme[];       // leer ⇒ "keine Einnahmen"
  abzuege: { steuern: boolean; rvlv: boolean; kv: boolean };
  beschaeftigung?: Beschaeftigung;
  rente?: Rente;
  ausweis?: { nummer: string; ausgestellt: string; gueltigBis: string; behoerde: string; groesseCm: number; augenfarbe: string };
}

export interface Wohnung {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  lage: string;                // "2. OG links"
  zimmer: number;
  flaeche: number;             // m²
  grundmiete: number;          // Nettokaltmiete
  nebenkosten: number;         // kalte Betriebskosten
  heizkosten: number;          // in der Miete enthalten (0 = nicht enthalten)
  warmwasser: number;          // in der Miete enthalten (0 = nicht enthalten)
  gefoerdert: boolean;
  einzug: string;              // ISO
  mietbeginn: string;          // ISO
  mieteSeit: string;           // ISO — seit wann in aktueller Höhe
}

export interface Vermieter {
  name: string;
  vertreter?: string;
  strasse: string;
  plzOrt: string;
  telefon?: string;
  iban: string;
  bank: string;
}

export interface Bank { name: string; iban: string; bic: string }

/** Arten der Unterlagen, die der Generator erzeugen kann. */
export type DokArt =
  // Formulare + Basis (Pilot)
  | 'antrag' | 'vermieterbescheinigung' | 'hinweisblatt' | 'unterhaltsanlage' | 'zusatzblatt_haushalt'
  | 'personalausweis' | 'rentenbescheid' | 'mietvertrag' | 'kontoauszug'
  | 'gehaltsabrechnung' | 'mieterhoehung' | 'stromrechnung' | 'leerseite'
  // Behördenbescheide (nachweise/bescheide.ts)
  | 'kindergeldbescheid' | 'uvs_bescheid' | 'elterngeldbescheid' | 'bafoeg_bescheid' | 'buergergeld_bescheid'
  | 'jobcenter_ablehnung' | 'jobcenter_aufforderung' | 'alg1_bescheid' | 'pflegebescheid'
  | 'sterbegeld_mitteilung' | 'kita_gebuehrenbescheid'
  // Karten (nachweise/karten.ts)
  | 'aufenthaltstitel' | 'schwerbehindertenausweis' | 'kv_karte'
  // Verträge, Urkunden, Erklärungen (nachweise/urkunden.ts)
  | 'untermietvertrag' | 'heimvertrag' | 'betreuungsvereinbarung' | 'abfindungsvereinbarung'
  | 'betreuerausweis' | 'sterbeurkunde' | 'zuwendungserklaerung' | 'unterhaltszahlung'
  // Finanzen (nachweise/finanzen.ts)
  | 'steuerbescheid' | 'euer' | 'kv_beitragsnachweis' | 'depotauszug' | 'verdienstbescheinigung';

/**
 * Signatur aller Dokument-Generatoren. Dokumentspezifische Daten kommen über
 * `spec.optionen` (jeder Generator exportiert dafür ein eigenes Interface);
 * personenbezogene Dokumente lesen die Person über `spec.person` (Default 'P1').
 */
export type Generator = (fall: Fall, spec: DokSpec) => Promise<ErzeugtesDokument>;

export interface DokSpec {
  art: DokArt;
  person?: string;             // Personen-ID, falls personenbezogen
  monat?: string;              // "2026-07" für Abrechnungen/Auszüge
  /** Seiten (1-basiert) des erzeugten Dokuments, die in der Sendung fehlen. */
  seitenFehlen?: number[];
  /** Seiten, die doppelt eingescannt wurden (direkt hintereinander). */
  seitenDoppelt?: number[];
  /** Dokument quer eingescannt (um 90° gedreht). */
  quer?: boolean;
  optionen?: Record<string, unknown>;
}

/** Name + Vorname einer Person außerhalb von `personen` (z. B. Mitbewohner, Verstorbene). */
export interface NamePerson { nachname: string; vorname: string }

/**
 * Antwortpfade des Antrags über die Grundangaben hinaus. Alles optional; fehlt ein
 * Eintrag, wird die Frage mit „Nein" beantwortet. Personenbezüge über Personen-IDs.
 */
export interface AntragAngaben {
  /** Formular handschriftlich ausgefüllt (Handschrift-Schrift statt Formularfeldern). */
  handschrift?: boolean;
  /** Bewusst leer gelassene Angaben: 'flaeche', 'gesamtmiete', '<PersonId>.geburtsdatum', 'P1.staatsangehoerigkeit' … */
  leer?: string[];
  /** Frage 2: noch nicht eingezogen — aktuelle Anschrift + geplanter Einzug. */
  zuzug?: { strasse: string; hausnummer: string; plz: string; ort: string; einzugsdatum: string };
  /** Frage 4: für eine andere Wohnung Wohngeld bezogen/beantragt. */
  andereWohnungWohngeld?: boolean;
  /** Frage 5: Zweitwohnsitz. */
  zweitwohnsitz?: boolean;
  /** Frage 6 (Drittstaaten): Verpflichtungserklärung § 68 AufenthG. Nur gesetzt, wenn Drittstaatsangehörige im Haushalt. */
  drittstaatVerpflichtung?: boolean;
  /** Frage 7: weitere Personen in der Wohnung, die nicht zum Haushalt gehören (max. 2). */
  mitbewohner?: NamePerson[];
  /** Frage 8: Haushaltsmitglied in den letzten 12 Monaten verstorben. */
  verstorben?: NamePerson & { datum: string; transfer: boolean; umgezogen: boolean };
  /** Frage 9: Änderung der Haushaltsgröße / geplanter Umzug. */
  haushaltAenderung?: { datum: string; grund: string };
  umzugGeplant?: string;
  /** Frage 10: Transferleistungen (max. 3). */
  transfer?: Array<{ person: string; leistung: string; beantragt?: string; bewilligt?: string; weggefallen?: string; abgelehnt?: string }>;
  /** Frage 11: von Transferbehörde zur Wohngeld-Antragstellung aufgefordert. */
  aufforderungTransferbehoerde?: boolean;
  /** Frage 13: Werbungskosten über Pauschbetrag (EUR/Monat, max. 2). */
  werbungskosten?: Array<{ person: string; betrag: number }>;
  /** Frage 14: Kinderbetreuungskosten (EUR/Monat, max. 2). */
  kinderbetreuung?: Array<{ person: string; betrag: number }>;
  /** Frage 15: Schwerbehinderung/Pflegegrad (max. 2). */
  schwerbehinderung?: Array<{ person: string; gdb?: number; pflegegrad?: number; haeuslich?: boolean }>;
  /** Frage 16: gezahlter Unterhalt (max. 2). */
  unterhaltGezahlt?: Array<{ zahler: string; fuer: NamePerson & { geburtsdatum: string; anschrift: string }; verwandt: string; betrag: number }>;
  /** Frage 17: nicht durchsetzbarer Unterhaltsanspruch (betrag undefined = Höhe nicht bekannt). */
  unterhaltAnspruch?: Array<{ person: string; betrag?: number }>;
  /** Frage 18: einmalige Einnahmen (max. 2). */
  einmalig?: Array<{ person: string; art: string; betrag: number; datum: string }>;
  /** Frage 19: erwartete Einnahmeänderung. */
  einnahmeAenderung?: { richtung: 'verringern' | 'erhoehen'; eintraege: Array<{ person: string; art: string; zeitpunkt: string; grund: string; betrag: number }> };
  /** Frage 20: angegebenes Vermögen über Freigrenze („Ja" + Werte). */
  vermoegen?: { immobilie?: number; geld?: number; gegenstaende?: number; sonstiges?: number };
  /** Frage 21: Wohnstatus. Default hauptmieter. */
  status?: 'hauptmieter' | 'untermieter' | 'heim' | 'eigentuemerMfh' | 'sonstiges';
  statusSonstiges?: string;
  vermieterVerwandt?: boolean;
  /** Frage 24: weitere in der Miete enthaltene Kosten (EUR/Monat). */
  garage?: number;
  service?: number;
  haushaltsenergie?: number;
  /** Frage 25: sonstige Kosten an Dritte (EUR/Monat). */
  kostenDritte?: number;
  /** Frage 26: Mietzuschuss von Dritten. */
  zuschussDritter?: NamePerson & { betrag: number; zeitraum: string };
  /** Frage 27: Mietänderung in den nächsten 12 Monaten. */
  mieteAenderung?: { richtung: 'verringern' | 'erhoehen'; wann: string; grund: string; zukuenftig: number };
  /** Frage 28/29: Untervermietung/Mitbenutzung. */
  untervermietung?: { flaeche: number; entgeltlich: boolean; entgelt: number; heizung?: number; strom?: number; garage?: number };
  beruflichGenutzt?: number;
  /** Frage 30: Auszahlung an Dritte (z. B. Vermieter/Heim). */
  zahlungAn?: NamePerson & { anschrift: string; bank: string; iban: string };
  /** Unterschrift durch Bevollmächtigte/Betreuer statt antragstellender Person. */
  bevollmaechtigter?: NamePerson;
}

export interface Fall {
  id: string;                  // "F01"
  titel: string;
  gruppe: 'A' | 'B' | 'C' | 'D';
  antragsdatum: string;        // ISO
  antragsart: 'erstantrag' | 'weiterleistungsantrag';
  wohngeldnummer?: string;
  behoerde: string;            // mehrzeilige Anschrift der Wohngeldbehörde
  telefon?: string;
  email?: string;
  personen: Person[];          // [0] = antragstellende Person
  wohnung: Wohnung;
  vermieter: Vermieter;
  bank: Bank;
  /** Bewusste Abweichungen der Antragsangaben von der Wirklichkeit (Widerspruchsfälle). */
  antragAbweichung?: { gesamtmiete?: number; heizkosten?: number; flaeche?: number; mieteVeraenderung?: 'nein' | 'erhoehen' };
  /** Mieterhöhung (Fall F18): alte Werte + Stichtag. */
  mieterhoehung?: { alteGrundmiete: number; ab: string; schreibenVom: string };
  unterschrift: { antrag: boolean; antragDatum: boolean; mietvertrag: boolean };
  /** Weitere Antragsangaben (Ja-Pfade, Handschrift, Lücken). */
  antrag?: AntragAngaben;
  dokumente: DokSpec[];
  erwartung: {
    /** App-regelIds, die fachlich erwartet werden (ohne Standardbefunde). */
    befunde: string[];
    /** Fachlich erwartete Befunde ohne passende App-Regel. */
    befundeOhneAppRegel: string[];
    hinweise?: string[];
    /**
     * Überschreibt erwartete Antragsfelder (App-Pfade), z. B. wenn eine Antragsseite
     * fehlt und Werte deshalb nicht auslesbar sind. `null` = nicht auslesbar.
     */
    antragFelder?: Record<string, unknown>;
  };
}

/** Ergebnis eines Dokument-Generators. */
export interface ErzeugtesDokument {
  art: DokArt;
  typ: DokumentTyp;
  titel: string;
  person?: string;
  pdf: Uint8Array;
  /** Erwartete Extraktion (App-Feldpfade). */
  erwartet?: {
    stammdaten?: Record<string, unknown>;
    analyse?: Record<string, unknown>;
    identitaet?: Record<string, unknown>;
  };
  leerseite?: boolean;
}
