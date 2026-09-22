/**
 * Wohngeld → Heavy-Extraction-Pipeline-Schema + Mapping.
 *
 * Baut ein inline `ExtractionSchema` (kein DB-Projekt) fuer den Wohngeldantrag
 * und bildet das generische Pipeline-Ergebnis (`extracted` + `fieldConfidences`)
 * auf die wohngeld-eigenen Typen (`ExtrahierteStammdaten`/`DokumentAnalyse`) ab.
 *
 * Die harte Enum-Pruefung + Zahl-/String-Normalisierung bleibt im App-Code:
 * `mapPipelineToErgebnis` verwendet `pickStammdaten`/`pickAnalyse` aus
 * `extraction.ts` wieder. Enum-Werte gehen nur als `hint` ins Schema.
 */

import type { ExtractionProfile } from '../../extraction/types';
import { extractionModelConfig, EXTRACTION_MODEL_ID } from '../../extraction/model';
import {
  applyExtractionDefaults,
  type ExtractionSchema,
  type StrategyId,
  type PipelineRunResult,
} from '../../services/extraction';
import { pickStammdaten, pickAnalyse, pickIdentitaet, type ExtrahierteStammdaten, type Identitaet } from './extraction';
import { WOHNGELD_PROMPT_VERSION } from './ki-governance';
import type { DokumentAnalyse, DokumentTyp, DokumentExtraktion, DokumentExtraktionFeld } from './types';

/**
 * Optionale Identitäts-Feldgruppe für Nachweis-Dokumente. Liefert das leichte
 * Match-Signal (nachname/vorname/geburtsdatum), damit auch ein Ausweis-/
 * Nachweis-Scan einem Vorgang zugeordnet werden kann — oder eben nicht.
 */
const IDENTITAET_FELDER = {
  nachname: { type: 'text', label: 'Nachname der im Dokument genannten Person' },
  vorname: { type: 'text', label: 'Vorname der im Dokument genannten Person' },
  geburtsdatum: { type: 'date', label: 'Geburtsdatum der Person (ISO JJJJ-MM-TT)' },
} as const;

/**
 * ExtractionProfile fuer den Wohngeldantrag. Feldgruppen so benannt, dass das
 * Mapping zu den `feld_status`-Pfaden (`feldstatus-mapping.ts`) sauber ueber die
 * `PIPELINE_TO_FELDSTATUS`-Map laeuft.
 */
const WOHNGELD_PROFILE: ExtractionProfile = {
  id: 'wohngeld-antrag',
  name: 'Wohngeldantrag',
  description: 'Stammdaten- und Analyse-Extraktion aus einem Wohngeldantrag.',
  version: '1.0',
  detection: { keywords: ['wohngeld', 'mietzuschuss', 'lastenzuschuss', 'antrag auf wohngeld'] },
  fields: {
    antragsteller: {
      vorname: { type: 'text', label: 'Vorname der antragstellenden Person' },
      nachname: { type: 'text', label: 'Nachname der antragstellenden Person' },
      geburtsdatum: { type: 'date', label: 'Geburtsdatum (ISO JJJJ-MM-TT)' },
    },
    adresse: {
      strasse: { type: 'text', label: 'Strasse der Wohnung' },
      hausnummer: { type: 'text', label: 'Hausnummer' },
      plz: { type: 'text', label: 'Postleitzahl' },
      ort: { type: 'text', label: 'Ort' },
    },
    wohnung: {
      miete: { type: 'number', label: 'Bruttokaltmiete in EUR' },
      wohnflaeche_qm: { type: 'number', label: 'Wohnflaeche in m2' },
    },
    antrag: {
      antragsdatum: { type: 'date', label: 'Antragsdatum (ISO JJJJ-MM-TT)' },
      wohngeldart: {
        type: 'text',
        label: 'Wohngeldart',
        hint: 'Moegliche Werte: mietzuschuss, lastenzuschuss',
      },
      antragsart: {
        type: 'text',
        label: 'Antragsart',
        hint: 'Moegliche Werte: erstantrag, weiterleistungsantrag, erhoehungsantrag, aenderungsantrag',
      },
    },
    analyse: {
      unterschrift_vorhanden: { type: 'boolean', label: 'Ist der Antrag unterschrieben?' },
      datum_vorhanden: { type: 'boolean', label: 'Traegt der Antrag ein Datum?' },
    },
  },
};

/**
 * Analyse-Profile fuer Nachweis-Dokumente (kein Stammdaten — nur die Felder,
 * die `checker/plausibilitaet.ts` konsumiert). Alle Analyse-Felder liegen in
 * einer Gruppe `analyse`, damit `mapPipelineToAnalyse` einheitlich `e.analyse`
 * liest.
 */
const MIET_PROFILE: ExtractionProfile = {
  id: 'wohngeld-mietnachweis',
  name: 'Mietvertrag/Mietbescheinigung',
  description: 'Analyse eines Mietvertrags oder einer Mietbescheinigung (Miethoehe, Flaeche, Unterschrift).',
  version: '1.0',
  detection: { keywords: ['mietvertrag', 'mietbescheinigung', 'miete', 'vermieter'] },
  fields: {
    identitaet: { ...IDENTITAET_FELDER },
    analyse: {
      miete: { type: 'number', label: 'Bruttokaltmiete in EUR laut Dokument' },
      wohnflaeche_qm: { type: 'number', label: 'Wohnflaeche in m2 laut Dokument' },
      unterschrift_vorhanden: { type: 'boolean', label: 'Ist das Dokument (von allen Parteien) unterschrieben? true/false' },
    },
  },
};

const KONTO_PROFILE: ExtractionProfile = {
  id: 'wohngeld-kontoauszug',
  name: 'Kontoauszug',
  description: 'Analyse eines Kontoauszugs (Mietzahlung, unerklaerte Einkuenfte).',
  version: '1.0',
  detection: { keywords: ['kontoauszug', 'iban', 'buchung', 'saldo'] },
  fields: {
    identitaet: { ...IDENTITAET_FELDER },
    analyse: {
      mietzahlung_erkannt: { type: 'boolean', label: 'Ist auf dem Auszug eine Mietabbuchung/Mietzahlung erkennbar? true/false' },
      kapitalertraege_erkannt: { type: 'boolean', label: 'Sind Kapitalertraege (Zinsen, Dividenden) erkennbar? true/false' },
      mieteinnahmen_erkannt: { type: 'boolean', label: 'Sind Mieteinnahmen aus Vermietung/Verpachtung erkennbar? true/false' },
    },
  },
};

const RENTEN_PROFILE: ExtractionProfile = {
  id: 'wohngeld-rentenbescheid',
  name: 'Rentenbescheid',
  description: 'Analyse eines Rentenbescheids (Rentenart, Grundrentenzeiten, Betrag).',
  version: '1.0',
  detection: { keywords: ['rentenbescheid', 'rente', 'deutsche rentenversicherung'] },
  fields: {
    identitaet: { ...IDENTITAET_FELDER },
    analyse: {
      rentenart_vorhanden: { type: 'boolean', label: 'Nennt der Bescheid die Rentenart? true/false' },
      grundrentenzeiten_vorhanden: { type: 'boolean', label: 'Sind Grundrentenzeiten ausgewiesen? true/false' },
      betrag: { type: 'number', label: 'Rentenbetrag in EUR (monatlich)' },
    },
  },
};

/**
 * Personalausweis: kein Analyse-Signal für den Checker, aber ein starkes
 * Identitäts-Signal fürs Zuordnungs-Matching (nachname/vorname/geburtsdatum).
 */
const AUSWEIS_PROFILE: ExtractionProfile = {
  id: 'wohngeld-personalausweis',
  name: 'Personalausweis',
  description: 'Identitäts-Extraktion aus einem Personalausweis (Name, Geburtsdatum) für die Vorgangs-Zuordnung.',
  version: '1.0',
  detection: { keywords: ['personalausweis', 'bundesrepublik deutschland', 'identity card', 'ausweis'] },
  fields: {
    identitaet: { ...IDENTITAET_FELDER },
  },
};

/**
 * Generisches Identitäts-Schema für BELIEBIGE Nachreichungen ohne eigenes Fach-Schema
 * (Nachreichungen können alles sein). Extrahiert nur Name/Geburtsdatum als Match-Signal
 * für die Vorgangs-Zuordnung. Ohne verwertbare Identität → kein Vorschlag (sicherer Fallback).
 */
const IDENTITAET_PROFILE: ExtractionProfile = {
  id: 'wohngeld-identitaet',
  name: 'Identität',
  description: 'Leichte Identitäts-Extraktion (Name, Geburtsdatum) für die Vorgangs-Zuordnung beliebiger Nachreichungen.',
  version: '1.0',
  detection: { keywords: [] },
  fields: {
    identitaet: { ...IDENTITAET_FELDER },
  },
};

/** Einheitliche Config (Modell + Repair + LLM-Confidence) fuer alle Wohngeld-Schemas. */
function baseConfig(strategy: StrategyId) {
  return applyExtractionDefaults({
    strategy,
    model_override: extractionModelConfig(),
    validation_repair: true,
    llm_confidence: true,
  });
}

/**
 * Baut das ExtractionSchema fuer den Wohngeldantrag mit der gewaehlten Strategy
 * (single-pass fuer born-digital, hybrid fuer Scans/Bilder).
 */
export function WOHNGELD_SCHEMA(strategy: StrategyId): ExtractionSchema {
  return { id: WOHNGELD_PROFILE.id, name: WOHNGELD_PROFILE.name, profile: WOHNGELD_PROFILE, config: baseConfig(strategy) };
}

/**
 * Selektor: liefert das typ-spezifische Schema oder `null`, wenn fuer den Typ
 * keine Pipeline-Extraktion vorgesehen ist (dann nur Klassifikation).
 *
 *   wohngeldantrag                    → Stammdaten + Analyse (unterschrift/datum)
 *   personalausweis                   → identitaet (nachname/vorname/geburtsdatum)
 *   mietvertrag | mietbescheinigung   → identitaet + miete, wohnflaeche_qm, unterschrift
 *   kontoauszug                       → identitaet + mietzahlung, kapitalertraege, mieteinnahmen
 *   rentenbescheid                    → identitaet + rentenart, grundrentenzeiten, betrag
 *   alle übrigen Typen                → identitaet (generisch, nur für die Zuordnung)
 *
 * Es gibt bewusst KEIN `null` mehr: Nachreichungen können alles sein, daher bekommt jeder
 * klassifizierte Typ mindestens eine leichte Identitäts-Extraktion als Match-Signal.
 */
export function schemaFuerTyp(typ: DokumentTyp, strategy: StrategyId): ExtractionSchema {
  switch (typ) {
    case 'wohngeldantrag':
      return WOHNGELD_SCHEMA(strategy);
    case 'personalausweis':
      return { id: AUSWEIS_PROFILE.id, name: AUSWEIS_PROFILE.name, profile: AUSWEIS_PROFILE, config: baseConfig(strategy) };
    case 'mietvertrag':
    case 'mietbescheinigung':
      return { id: MIET_PROFILE.id, name: MIET_PROFILE.name, profile: MIET_PROFILE, config: baseConfig(strategy) };
    case 'kontoauszug':
      return { id: KONTO_PROFILE.id, name: KONTO_PROFILE.name, profile: KONTO_PROFILE, config: baseConfig(strategy) };
    case 'rentenbescheid':
      return { id: RENTEN_PROFILE.id, name: RENTEN_PROFILE.name, profile: RENTEN_PROFILE, config: baseConfig(strategy) };
    default:
      return { id: IDENTITAET_PROFILE.id, name: IDENTITAET_PROFILE.name, profile: IDENTITAET_PROFILE, config: baseConfig(strategy) };
  }
}

/**
 * Uebersetzung Pipeline-Feldpfad → `feld_status`-Feldpfad. Die Pipeline liefert
 * Gruppen-Pfade (`antrag.antragsdatum`, `adresse.strasse`, `antragsteller.vorname`),
 * `feld_status` erwartet die flacheren Vorgang-/Person-Pfade aus
 * `feldstatus-mapping.ts`.
 */
const PIPELINE_TO_FELDSTATUS: Record<string, string> = {
  // Vorgang-Pfade
  'antrag.antragsdatum': 'antragsdatum',
  'antrag.wohngeldart': 'wohngeldart',
  'antrag.antragsart': 'antragsart',
  'adresse.strasse': 'wohnung.strasse',
  'adresse.hausnummer': 'wohnung.hausnummer',
  'adresse.plz': 'wohnung.plz',
  'adresse.ort': 'wohnung.ort',
  'wohnung.miete': 'wohnung.miete',
  'wohnung.wohnflaeche_qm': 'wohnung.wohnflaeche_qm',
  // Person-Pfade (Antragsteller)
  'antragsteller.vorname': 'vorname',
  'antragsteller.nachname': 'nachname',
  'antragsteller.geburtsdatum': 'geburtsdatum',
};

/** Ergebnis des reinen Pipeline→Wohngeld-Mappings. */
export interface PipelineMapping {
  stammdaten: ExtrahierteStammdaten;
  analyse: DokumentAnalyse;
  /** Identitäts-Signal (aus `stammdaten.antragsteller` abgeleitet) fürs Matching. */
  identitaet?: Identitaet;
  /** Confidence je `feld_status`-Feldpfad (0..1). */
  confidenceByPfad: Record<string, number>;
}

/**
 * Reine Funktion: bildet `PipelineRunResult.extracted` + `fieldConfidences` auf
 * die Wohngeld-Typen ab. Verwendet die Enum-Guards `pickStammdaten`/`pickAnalyse`
 * wieder (harte Enum-Pruefung + DE-Zahl-Normalisierung). Kein I/O, kein LLM.
 */
export function mapPipelineToErgebnis(
  extracted: Record<string, unknown> | undefined,
  fieldConfidences: Record<string, number> | undefined,
): PipelineMapping {
  const e = (extracted ?? {}) as Record<string, unknown>;
  const antrag = (e.antrag ?? {}) as Record<string, unknown>;

  // Pipeline-Gruppen auf die von `pickStammdaten` erwartete Struktur flachziehen
  // (antrag.* liegt bei pickStammdaten auf Top-Level).
  const stammRaw = {
    antragsdatum: antrag.antragsdatum,
    wohngeldart: antrag.wohngeldart,
    antragsart: antrag.antragsart,
    antragsteller: e.antragsteller,
    adresse: e.adresse,
    wohnung: e.wohnung,
  };
  const stammdaten = pickStammdaten(stammRaw) ?? {};
  const analyse = pickAnalyse(e.analyse);
  const identitaet = pickIdentitaet(stammdaten.antragsteller);

  const confidenceByPfad: Record<string, number> = {};
  for (const [pipelinePath, conf] of Object.entries(fieldConfidences ?? {})) {
    const feldPfad = PIPELINE_TO_FELDSTATUS[pipelinePath];
    if (feldPfad && typeof conf === 'number') confidenceByPfad[feldPfad] = conf;
  }

  return { stammdaten, analyse, identitaet, confidenceByPfad };
}

/** Ergebnis des reinen Analyse-Mappings (Nachweis-Dokumente). */
export interface AnalyseMapping {
  analyse: DokumentAnalyse;
  /** Identitäts-Signal aus der `identitaet`-Feldgruppe (Match gegen bestehende Vorgänge). */
  identitaet?: Identitaet;
  /** Confidence je DokumentAnalyse-Feldname (0..1). */
  confidenceByPfad: Record<string, number>;
}

function istWahr(v: unknown): boolean {
  return v === true || v === 'true';
}

/**
 * Reine Funktion: bildet das Pipeline-Ergebnis eines Nachweis-Dokuments auf
 * `DokumentAnalyse` ab — je Dokumenttyp die relevanten Felder. `pickAnalyse`
 * bleibt der Normalisierungs-/Enum-Guard.
 *
 * Kompatibilitaet zum bestehenden `DokumentAnalyse.erkannte_einkuenfte`
 * (string[]) des Checkers: `kapitalertraege_erkannt === true` →
 * `'kapitalertraege'`, `mieteinnahmen_erkannt === true` → `'v_und_v'`.
 */
export function mapPipelineToAnalyse(
  typ: DokumentTyp,
  extracted: Record<string, unknown> | undefined,
  fieldConfidences: Record<string, number> | undefined,
): AnalyseMapping {
  const e = (extracted ?? {}) as Record<string, unknown>;
  const identitaet = pickIdentitaet(e.identitaet);
  const rawAnalyse = { ...((e.analyse ?? {}) as Record<string, unknown>) };

  // Kontoauszug: boolesche Erkennungs-Flags → erkannte_einkuenfte[] (Checker-kompatibel).
  if (typ === 'kontoauszug') {
    const einkuenfte: string[] = [];
    if (istWahr(rawAnalyse.kapitalertraege_erkannt)) einkuenfte.push('kapitalertraege');
    if (istWahr(rawAnalyse.mieteinnahmen_erkannt)) einkuenfte.push('v_und_v');
    if (einkuenfte.length) rawAnalyse.erkannte_einkuenfte = einkuenfte;
  }

  const analyse = pickAnalyse(rawAnalyse);

  // Confidence je DokumentAnalyse-Feldname (analyse.<feld> → <feld>). Die
  // Erkennungs-Flags des Kontoauszugs zaehlen auf erkannte_einkuenfte.
  const confidenceByPfad: Record<string, number> = {};
  for (const [pipelinePath, conf] of Object.entries(fieldConfidences ?? {})) {
    if (typeof conf !== 'number') continue;
    if (!pipelinePath.startsWith('analyse.')) continue;
    const feld = pipelinePath.slice('analyse.'.length);
    const ziel = (feld === 'kapitalertraege_erkannt' || feld === 'mieteinnahmen_erkannt')
      ? 'erkannte_einkuenfte'
      : feld;
    // Nur Felder behalten, die tatsaechlich in der Analyse gelandet sind.
    if (ziel in analyse) confidenceByPfad[ziel] = conf;
  }

  return { analyse, identitaet, confidenceByPfad };
}

// ── Extraktions-Transparenz (Baum-Übersicht) ────────────────────────────────

/** Deutsche Anzeige-Labels für Enum-Werte (Baum-Übersicht). */
const WGA_LABEL: Record<string, string> = {
  mietzuschuss: 'Mietzuschuss',
  lastenzuschuss: 'Lastenzuschuss',
};
const ANTRAGSART_LABEL: Record<string, string> = {
  erstantrag: 'Erstantrag',
  weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag',
  aenderungsantrag: 'Änderungsantrag',
};
const EINKUNFTSART_LABEL: Record<string, string> = {
  kapitalertraege: 'Kapitalerträge',
  v_und_v: 'Vermietung/Verpachtung',
};

/** ISO-Datum (JJJJ-MM-TT…) → TT.MM.JJJJ; sonst Roh-Wert. */
function fmtDatum(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
}
/** Zahl → Euro (de-DE). */
function fmtEuro(v?: number): string | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
/** Zahl → „72 m²". */
function fmtQm(v?: number): string | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  return `${v.toLocaleString('de-DE')} m²`;
}
/** boolean → „vorhanden"/„fehlt". */
function fmtVorhanden(v?: boolean): string | undefined {
  if (v === true) return 'vorhanden';
  if (v === false) return 'fehlt';
  return undefined;
}
/** boolean → „ja"/„nein". */
function fmtJaNein(v?: boolean): string | undefined {
  if (v === true) return 'ja';
  if (v === false) return 'nein';
  return undefined;
}
/** erkannte_einkuenfte[] → lesbare, komma-getrennte Liste. */
function fmtEinkuenfte(arr?: string[]): string | undefined {
  if (!Array.isArray(arr) || !arr.length) return undefined;
  return arr.map((x) => EINKUNFTSART_LABEL[x] ?? x).join(', ');
}

/** Seite (aus Provenienz-Source `p:N`) für einen Pipeline-Feldpfad. */
function seiteAusProvenance(provenance: PipelineRunResult['provenance'] | undefined, pfad: string): number | undefined {
  const prov = provenance?.find((p) => p.field === pfad);
  if (!prov || typeof prov.source !== 'string') return undefined;
  const m = prov.source.match(/p:(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Gemappte Werte, aus denen die Übersicht gebaut wird. */
export interface ExtraktionUebersichtTeile {
  stammdaten?: ExtrahierteStammdaten;
  analyse?: DokumentAnalyse;
  identitaet?: Identitaet;
}

/**
 * Reine Funktion: baut aus den gemappten Werten (Stammdaten/Analyse/Identität)
 * plus `result.fieldConfidences`/`result.provenance` die `felder`-Liste der
 * Extraktions-Transparenz — mit lesbaren deutschen Labels, formatierten Werten,
 * Konfidenz je Feld und (falls vorhanden) Seitenzahl.
 *
 * Gruppen: Antragsteller/Adresse/Wohnung/Antrag (nur beim Antrag),
 * Identität (Nachweise ohne Stammdaten), Analyse (Nachweise).
 *
 * Setzt bewusst KEIN `erzeugtAm` (Date.now() gehört in den Aufruf-/Route-Kontext,
 * damit die Funktion in Testpfaden deterministisch bleibt).
 */
export function baueExtraktionsUebersicht(
  typ: DokumentTyp,
  teile: ExtraktionUebersichtTeile,
  result?: PipelineRunResult,
): DokumentExtraktion {
  void typ; // Layout leitet sich aus den vorhandenen Teilen ab, nicht aus dem Typ.
  const felder: DokumentExtraktionFeld[] = [];
  const fc = result?.fieldConfidences ?? {};
  const prov = result?.provenance;

  const add = (gruppe: string, label: string, pfad: string | undefined, wert: string | undefined): void => {
    if (wert == null || wert === '') return;
    const feld: DokumentExtraktionFeld = { gruppe, label, wert };
    if (pfad) {
      const c = fc[pfad];
      if (typeof c === 'number') feld.confidence = c;
      const s = seiteAusProvenance(prov, pfad);
      if (s !== undefined) feld.seite = s;
    }
    felder.push(feld);
  };

  const s = teile.stammdaten;
  if (s) {
    // Antrag: Antragsteller / Adresse / Wohnung / Antrag.
    add('Antragsteller', 'Vorname', 'antragsteller.vorname', s.antragsteller?.vorname);
    add('Antragsteller', 'Nachname', 'antragsteller.nachname', s.antragsteller?.nachname);
    add('Antragsteller', 'Geburtsdatum', 'antragsteller.geburtsdatum', fmtDatum(s.antragsteller?.geburtsdatum));
    add('Adresse', 'Straße', 'adresse.strasse', s.adresse?.strasse);
    add('Adresse', 'Hausnummer', 'adresse.hausnummer', s.adresse?.hausnummer);
    add('Adresse', 'PLZ', 'adresse.plz', s.adresse?.plz);
    add('Adresse', 'Ort', 'adresse.ort', s.adresse?.ort);
    add('Wohnung', 'Bruttokaltmiete', 'wohnung.miete', fmtEuro(s.wohnung?.miete));
    add('Wohnung', 'Wohnfläche', 'wohnung.wohnflaeche_qm', fmtQm(s.wohnung?.wohnflaeche_qm));
    add('Antrag', 'Antragsdatum', 'antrag.antragsdatum', fmtDatum(s.antragsdatum));
    add('Antrag', 'Wohngeldart', 'antrag.wohngeldart', s.wohngeldart ? WGA_LABEL[s.wohngeldart] : undefined);
    add('Antrag', 'Antragsart', 'antrag.antragsart', s.antragsart ? ANTRAGSART_LABEL[s.antragsart] : undefined);
  } else if (teile.identitaet) {
    // Nachweis: Identitäts-Signal.
    const id = teile.identitaet;
    add('Identität', 'Nachname', 'identitaet.nachname', id.nachname);
    add('Identität', 'Vorname', 'identitaet.vorname', id.vorname);
    add('Identität', 'Geburtsdatum', 'identitaet.geburtsdatum', fmtDatum(id.geburtsdatum));
  }

  const a = teile.analyse;
  if (a) {
    add('Analyse', 'Miete laut Dokument', 'analyse.miete', fmtEuro(a.miete));
    add('Analyse', 'Wohnfläche laut Dokument', 'analyse.wohnflaeche_qm', fmtQm(a.wohnflaeche_qm));
    add('Analyse', 'Unterschrift', 'analyse.unterschrift_vorhanden', fmtVorhanden(a.unterschrift_vorhanden));
    add('Analyse', 'Datum', 'analyse.datum_vorhanden', fmtVorhanden(a.datum_vorhanden));
    add('Analyse', 'Rentenart', 'analyse.rentenart_vorhanden', fmtVorhanden(a.rentenart_vorhanden));
    add('Analyse', 'Grundrentenzeiten', 'analyse.grundrentenzeiten_vorhanden', fmtVorhanden(a.grundrentenzeiten_vorhanden));
    add('Analyse', 'Mietzahlung erkannt', 'analyse.mietzahlung_erkannt', fmtJaNein(a.mietzahlung_erkannt));
    // erkannte_einkuenfte hat keinen direkten Pipeline-Confidence-Pfad (abgeleitet).
    add('Analyse', 'Erkannte Einkünfte', undefined, fmtEinkuenfte(a.erkannte_einkuenfte));
    add('Analyse', 'Betrag', 'analyse.betrag', fmtEuro(a.betrag));
  }

  const uebersicht: DokumentExtraktion = { felder };
  if (felder.length) {
    uebersicht.modell = EXTRACTION_MODEL_ID;
    uebersicht.stand = WOHNGELD_PROMPT_VERSION;
  }
  return uebersicht;
}
