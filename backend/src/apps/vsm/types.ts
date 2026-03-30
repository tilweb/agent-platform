/**
 * Value Stream Mapping (VSM) Types
 * Data model based on professional VSM methodology
 */

// ============== Core VSM Data Structures ==============

export interface VsmMetaDaten {
  projekt_id: string;
  unternehmen: string;
  standort: string;
  produktfamilie: string;
  produkt: string;
  erfassungsdatum: string;
  erfasst_von: string;
  erfassungsmethode: string;
  erfassungsdauer_tage: number;
}

export interface VsmKunde {
  kundenname: string;
  kundennummer: string;
  monatsbedarf_stueck: number;
  lieferrhythmus: string;
  lieferrhythmus_tage: number;
  arbeitstage_pro_monat: number;
  tagesbedarf_stueck: number;
  bestellmenge_stueck: number;
  lieferzeit_forderung_tage: number;
  lieferzeit_aktuell_tage: number;
}

export interface VsmProduktInfo {
  artikelnummer: string;
  bezeichnung: string;
  losgrösse_aktuell: number;
  gewicht_kg: number;
  materialkosten_euro: number;
  verkaufspreis_euro: number;
  anzahl_komponenten: number;
  zeichnungsnummer: string;
}

export interface VsmLieferant {
  lieferant_id: string;
  lieferant_name: string;
  material: string;
  lieferzeit_tage: number;
  lieferrhythmus: string;
  mindestbestellmenge: string;
  zuverlaessigkeit_prozent: number;
  letzter_liefertermin: string;
}

export interface VsmProzessschritt {
  schritt_nr: number;
  bezeichnung: string;
  typ: 'Prozess' | 'Lager' | 'Puffer';
  standort: string;
  // Process fields
  maschine?: string;
  maschinen_id?: string;
  baujahr?: number;
  zykluszeit_min?: number;
  ruestzeit_min?: number;
  bearbeitungszeit_pro_stueck_min?: number;
  verfuegbarkeit_prozent?: number;
  ausschuss_prozent?: number;
  ausschussgrund?: string;
  schichtmodell?: string;
  arbeitszeit_pro_tag_min?: number;
  pausen_min?: number;
  netto_arbeitszeit_min?: number;
  mitarbeiter_anzahl?: number;
  mitarbeiter_qualifikation?: string;
  mitarbeiter_erfahrung_jahre?: number;
  kapazitaet_stueck_pro_tag?: number;
  aktuelle_produktion_stueck_pro_tag?: number;
  auslastung_prozent?: number;
  engpass?: boolean;
  // Storage/Buffer fields
  bestand_tage?: number;
  bestand_stueck?: number;
  flaeche_qm?: number;
  mitarbeiter_schicht?: string;
  lagersystem?: string;
  // Buffer-specific fields
  bestand_schwankung_stueck?: number;
  wartegrund?: string;
  transportart?: string;
  transportdistanz_meter?: number;
  transportzeit_min?: number;
}

export interface VsmInformationsfluss {
  auftragseingang: {
    quelle: string;
    frequenz: string;
    vorlaufzeit_tage: number;
    medium: string;
    bearbeitungszeit_std: number;
    verantwortlich: string;
  };
  produktionsplanung: {
    system: string;
    planungshorizont_wochen: number;
    planungsrhythmus: string;
    planungsdauer_std: number;
    verantwortlich: string;
    automatisierungsgrad_prozent: number;
  };
  fertigungssteuerung: {
    methode: string;
    steuerungsmittel: string;
    weitergabe: string;
    transparenz: string;
  };
}

export interface VsmPersonal {
  schichtmodell_aktuell: string;
  arbeitszeit_schicht_std: number;
  pausenzeit_schicht_min: number;
  arbeitstage_pro_woche: number;
  betriebsferien_wochen_pro_jahr: number;
  krankenquote_prozent: number;
}

export interface VsmKennzahlen {
  gesamtdurchlaufzeit_tage?: number;
  wertschoepfungszeit_min?: number;
  prozesseffizienz_prozent?: number;
  wip_bestand_stueck?: number;
  wip_bestand_tage?: number;
  kapitalbindung_euro?: number;
  ausschussrate_gesamt_prozent?: number;
  oee_gesamt_prozent?: number;
}

// ============== VSM Data (IST-Zustand) ==============

export interface VsmData {
  meta_daten: Partial<VsmMetaDaten>;
  kunde: Partial<VsmKunde>;
  produkt_info: Partial<VsmProduktInfo>;
  lieferanten: VsmLieferant[];
  prozessschritte: VsmProzessschritt[];
  kennzahlen_ist: Partial<VsmKennzahlen>;
  informationsfluss: Partial<VsmInformationsfluss>;
  personal: Partial<VsmPersonal>;
}

// ============== VSM Projekt (Top-Level Entity) ==============

export interface VsmProjekt {
  id: string;
  name: string;
  beschreibung: string;
  status: 'entwurf' | 'erfassung' | 'analyse' | 'abgeschlossen';
  vsm_data: VsmData;
  analyse_ergebnis?: VsmAnalyseErgebnis;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============== Analyse Result ==============

export interface VsmAnalyseErgebnis {
  timestamp: string;
  report_markdown: string;
}

// ============== API Types ==============

export interface VsmProjektFilters {
  search?: string;
  status?: string;
}

export interface VsmStats {
  total: number;
  entwurf: number;
  erfassung: number;
  analyse: number;
  abgeschlossen: number;
}
