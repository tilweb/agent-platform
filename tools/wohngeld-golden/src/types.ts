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
  | 'antrag' | 'vermieterbescheinigung' | 'hinweisblatt'
  | 'personalausweis' | 'rentenbescheid' | 'mietvertrag' | 'kontoauszug'
  | 'gehaltsabrechnung' | 'mieterhoehung' | 'stromrechnung' | 'leerseite';

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
