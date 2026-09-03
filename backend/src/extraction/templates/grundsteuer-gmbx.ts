/**
 * GMBX-Profil (Grundsteuermessbetraege nach GrStRefG von 2019).
 *
 * Born-digital PDFs (jsPDF aus ELSTER-XML), sauberer Textlayer, strikte
 * Label→Wert-Struktur. Extrahiert wird deterministisch von der Strategie
 * `template-labelmap` — die Feld-`label`s hier sind die EXAKTEN Dokument-Labels,
 * an denen der Parser ankert (unabhaengig von den verschiebbaren
 * Abschnittsnummern). Die Eigentuemer sind ein `list`-Feld; sein `label`
 * ("Eigentuemer") ist zugleich das Signal, an dem der Parser eine neue
 * Eigentuemer-Instanz oeffnet (Abschnitts-Header "N – Eigentuemer").
 *
 * Herkunft der Felder: Kartierung von 341 echten Bescheiden, siehe
 * docs/grundsteuer-gmbx-extraktion-2026-09-03.md.
 *
 * Nutzung:
 *   - Seed in die Plattform:  createProject(GRUNDSTEUER_GMBX_SPEC)
 *   - Ohne DB (Tests/Harness): buildGrundsteuerGmbxProject()
 */

import type { ExtractionProject, ExtractionRule, ProjectField, ProjectItemField } from '../learning/types';

function txt(label: string, description?: string): ProjectField {
  return { type: 'text', required: false, label, ...(description ? { description } : {}) };
}
function num(label: string, description?: string): ProjectField {
  return { type: 'number', required: false, label, ...(description ? { description } : {}) };
}
function date(label: string): ProjectField {
  return { type: 'date', required: false, label };
}
function icol(type: ProjectItemField['type'], label: string): ProjectItemField {
  return { type, label };
}

/** Feld-Definitionen des GMBX-Profils (Label = exaktes Dokument-Label). */
export const GRUNDSTEUER_GMBX_FIELDS: Record<string, ProjectField> = {
  // --- Kopf / Stammdaten ---
  aktenzeichen: { type: 'text', required: true, label: 'Aktenzeichen' },
  ags: txt('Amtlicher Gemeindeschlüssel (AGS)'),
  bundesland_finanzamt: txt('Bundesland des Finanzamtes'),
  finanzamtsnummer: txt('Bundeseinheitliche Finanzamtsnummer'),
  erklaerungs_id: txt('Erklärungs-ID'),
  vorgangs_id: txt('Vorgangs-ID'),
  datum_berechnung: date('Datum der Berechnung des Bescheids'),
  grund_veranlagung: txt('Grund der Veranlagung', '0=Aufhebung; 1=Hauptveranlagung; 2=Neuveranlagung; 3=Nachveranlagung; 4=reine Zerlegung; 5=Zerlegung §23 Abs.2 GrStG; 9=keine Neuveranlagung'),
  feststellungszeitpunkt: date('Feststellungszeitpunkt'),
  abweichende_gueltigkeit: date('Abweichende Gültigkeit des Messbetrags'),
  art_wirtschaftliche_einheit: txt('Art der wirtschaftlichen Einheit', '1=unbebautes Grundstück; 2=bebautes Grundstück; 3=Betrieb der Land- und Forstwirtschaft; 4=zusätzlicher Wert für BW'),
  eigentumsverhaeltnis: txt('Eigentumsverhältnis', '0=Alleineigentum natürl. Person; 4=Ehegatten/Lebenspartner; 5=Erbengemeinschaft; …'),
  // Mehrzeiliges Label im PDF ("Sonstige Bescheidkennzeichnungen (z.B.
  // geändert), Nebenbestimmungen, Billigkeitsangaben") — der Wert steht auf der
  // Mittelzeile; Anker daher per Alias auf genau dieses Fragment.
  sonstige_bescheidkennzeichnungen: {
    type: 'text',
    required: false,
    label: 'Sonstige Bescheidkennzeichnungen / Nebenbestimmungen / Billigkeitsangaben',
    description: 'Codewert (z.B. 11=teilw. vorläufig §165; 13=Vorbehalt der Nachprüfung §164)',
    aliases: ['geändert), Nebenbestimmungen,'],
  },
  datum_messbetragsbescheid: date('Datum des Messbetragsbescheids'),
  anzahl_eigentuemer: num('Anzahl der Eigentümer'),
  messbetrag: num('Messbetrag', 'Ganzzahl in Cent'),
  grundsteuerwert: num('Grundsteuerwert', 'in Euro ohne Cent'),
  bisheriger_grundsteuermessbetrag: num('Bisheriger Grundsteuermessbetrag', 'Ganzzahl inkl. Cent'),
  grundsteuerbefreit: txt('Grundsteuerbefreit'),
  grundsteuerverguenstigt: txt('Grundsteuervergünstigt'),
  zusatzangabe: txt('Zusatzangabe'),
  empfangsvollmacht: txt('Empfangsvollmacht'),

  // --- Lage der wirtschaftlichen Einheit (Labels global eindeutig, daher flach) ---
  lage_plz: txt('Postleitzahl der wirtschaftlichen Einheit'),
  lage_ort: txt('Ort der wirtschaftlichen Einheit'),
  lage_strasse: txt('Straße der wirtschaftlichen Einheit'),
  lage_hausnummer: txt('Hausnummer der wirtschaftlichen Einheit'),
  lage_gemarkung: txt('Erste Gemarkung der wirtschaftlichen Einheit'),
  lage_flur: txt('Erster Flur der wirtschaftlichen Einheit'),

  // --- Zerlegung (nur bei Zerlegungsbescheid) ---
  zerlegung_hinweis: txt('Es liegt eine Zerlegung vor.'),
  zerlegung_anteil_zaehler: num('Anteil Zähler'),
  zerlegung_reinertrag: num('Anteil Zähler - Reinertrag in Euro und Cent'),
  zerlegung_anteil_nenner: num('Anteil Nenner'),
  zerlegung_zugewiesener_anteil: num('Zugewiesener Zerlegungsanteil'),
  zerlegung_anzahl_gemeinden: num('Anzahl Zerlegungsgemeinden'),
  zerlegung_messbetrag_massstab: num('Zerlegungsanteil Messbetrag laut Maßstab'),
  zerlegung_messbetrag_anteil: num('Zerlegungsanteil Messbetrag'),

  // --- Eigentuemer (wiederholbar: 1..n je Bescheid) ---
  // WICHTIG: label === "Eigentümer" — daran erkennt template-labelmap den
  // Abschnitts-Header "N – Eigentümer" und oeffnet eine neue Instanz.
  eigentuemer: {
    type: 'list',
    required: false,
    label: 'Eigentümer',
    item_fields: {
      anrede: icol('text', 'Anrede'),
      titel: icol('text', 'Titel des Eigentümers'),
      nachname: icol('text', 'Nachname des Eigentümers'),
      vorname: icol('text', 'Vorname des Eigentümers'),
      geburtsdatum: icol('date', 'Geburtsdatum des Eigentümers'),
      namenszeile_1: icol('text', 'Namenszeile 1 des Eigentümers'),
      namenszeile_2: icol('text', 'Namenszeile 2 des Eigentümers'),
      namenszeile_3: icol('text', 'Namenszeile 3 des Eigentümers'),
      namenszeile_4: icol('text', 'Namenszeile 4 des Eigentümers'),
      strasse: icol('text', 'Strasse'),
      hausnummer: icol('text', 'Hausnummer des Eigentümers'),
      zusatz_hausnummer: icol('text', 'Zusatz Hausnummer des Eigentümers'),
      ort: icol('text', 'Ort des Eigentümers'),
      plz_inland: icol('text', 'Postleitzahl Inland des Eigentümers'),
      plz_ausland: icol('text', 'Postleitzahl Ausland des Eigentümers'),
      staatenschluessel: icol('text', 'Staatenschlüssel'),
    },
  },
};

/**
 * Fachliche Pruefregeln (W5/G3): die extrahierte Eigentuemer-Anzahl muss der im
 * Bescheid genannten „Anzahl der Eigentuemer" entsprechen. Faengt eine verpasste
 * oder erfundene Instanz — den einen Fall, den die deterministische Extraktion
 * selbst nicht sehen kann (sie liest, was da steht).
 */
export const GRUNDSTEUER_GMBX_RULES: ExtractionRule[] = [
  {
    id: 'eigentuemer-anzahl',
    type: 'count',
    list_field: 'eigentuemer',
    target_field: 'anzahl_eigentuemer',
    label: 'Anzahl der Eigentuemer stimmt mit den extrahierten Instanzen ueberein',
  },
];

/** Projekt-Spezifikation fuer `createProject(...)`. */
export const GRUNDSTEUER_GMBX_SPEC = {
  name: 'Grundsteuermessbescheide (GMBX)',
  description: 'Massen-Extraktion born-digital Grundsteuermessbescheide (GMBX/ELSTER) — deterministisch, ein Datensatz je Bescheid.',
  fields: GRUNDSTEUER_GMBX_FIELDS,
  extraction: { strategy: 'template-labelmap' as const },
  rules: GRUNDSTEUER_GMBX_RULES,
};

/** Vollstaendiges ExtractionProject ohne DB (Tests/Harness). */
export function buildGrundsteuerGmbxProject(): ExtractionProject {
  const now = '2026-09-03T00:00:00.000Z';
  return {
    id: 'grundsteuermessbescheide-gmbx',
    name: GRUNDSTEUER_GMBX_SPEC.name,
    description: GRUNDSTEUER_GMBX_SPEC.description,
    created: now,
    updated: now,
    fields: GRUNDSTEUER_GMBX_FIELDS,
    guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    extraction: { strategy: 'template-labelmap' },
    rules: GRUNDSTEUER_GMBX_RULES,
  };
}
