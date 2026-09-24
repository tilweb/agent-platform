/**
 * Beschreibung aller Prüfregeln — die aufrufbare Dokumentation der Regel-Engine.
 *
 * Lebt bewusst neben den Regeln (nachweise.ts, plausibilitaet.ts). Der Test
 * `regeln.test.ts` stellt sicher, dass jede im Checker erzeugte Regel-ID hier
 * beschrieben ist. Bei fachlichen Änderungen an einer Regel: Beschreibung mitziehen
 * und REGELKATALOG_STAND hochzählen.
 *
 * Spec: docs/wohngeld-pruefregeln-doku-spec-2026-09-24.md
 */
import type { PruefKategorie, PruefTyp } from '../types';

export const REGELKATALOG_STAND = '2026-09-24b';

export type RegelGruppe =
  | 'grundangaben' | 'wohnen' | 'identitaet_versicherung' | 'einkommen'
  | 'familie_pflege' | 'vermoegen' | 'ausschluss' | 'verfahren';

export const REGEL_GRUPPE_LABEL: Record<RegelGruppe, string> = {
  grundangaben: 'Antrag und Grundangaben',
  wohnen: 'Wohnung und Miete',
  identitaet_versicherung: 'Identität und Versicherung',
  einkommen: 'Einkommen',
  familie_pflege: 'Familie, Behinderung, Pflege',
  vermoegen: 'Vermögen',
  ausschluss: 'Ausschlussgründe',
  verfahren: 'Verfahren',
};

export interface RegelBeschreibung {
  id: string;
  titel: string;
  kategorie: PruefKategorie;
  typ: PruefTyp;
  /** Worauf sich ein Befund bezieht. */
  bezug: 'vorgang' | 'person' | 'dokument';
  gruppe: RegelGruppe;
  /** Wann die Regel greift — in Klartext. */
  ausloeser: string;
  /** Geforderter Nachweis (Vollständigkeitsregeln). */
  nachweis?: string;
  rechtsgrundlage: string;
  /** Wie die Sachbearbeitung den Prüfschritt erledigt. */
  erledigung: string;
  /** Bekannte Grenzen der automatischen Prüfung. */
  hinweise?: string[];
}

export const REGELKATALOG: RegelBeschreibung[] = [
  // ── Antrag und Grundangaben ──
  {
    id: 'essenzielle-angaben', titel: 'Essenzielle Angaben fehlen', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'grundangaben',
    ausloeser: 'Im Vorgang fehlt mindestens eine Kernangabe: Name der antragstellenden Person, Antragsdatum, Anschrift (PLZ und Ort oder Straße), Miethöhe beim Mietzuschuss oder jede Person im Haushalt.',
    rechtsgrundlage: '§ 22 WoGG; § 60 SGB I',
    erledigung: 'Fehlende Angaben im Hauptformular erfassen — meist aus dem Antrag ablesbar. Fehlen sie auch dort, beim Antragsteller nachfordern.',
    hinweise: [
      'Ohne Datum im Formular gilt fachlich der Eingang bei der Behörde als Antragsdatum; dann das Eingangsdatum eintragen.',
      'Bei Heimbewohnern wird im Antrag keine Miete angegeben; die Regel meldet dann trotzdem eine fehlende Miethöhe.',
    ],
  },
  {
    id: 'antrag-vollstaendig-unterschrieben', titel: 'Vollständiger, unterschriebener Antrag', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'grundangaben',
    ausloeser: 'Im Vorgang liegt kein Dokument vom Typ Wohngeldantrag vor.',
    nachweis: 'Ausgefüllter und unterschriebener Wohngeldantrag',
    rechtsgrundlage: '§ 22 WoGG; §§ 60 ff. SGB I',
    erledigung: 'Antrag nachfordern oder das eingegangene Antragsformular als Wohngeldantrag einordnen.',
    hinweise: ['Eine fehlende Unterschrift auf einem vorhandenen Antrag erkennt die Regel „Antrag ohne Unterschrift".'],
  },
  {
    id: 'plausi-antrag-ohne-unterschrift', titel: 'Antrag ohne Unterschrift', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'grundangaben',
    ausloeser: 'Die Auswertung des Wohngeldantrags hat keine Unterschrift erkannt.',
    rechtsgrundlage: '§ 22 WoGG',
    erledigung: 'Unterschrift im Original prüfen. Fehlt sie, Antrag zur Unterschrift zurücksenden oder Unterschrift nachholen lassen.',
    hinweise: ['Bei digital eingereichten Formularen wird die Unterschrift aus dem Text beurteilt und kann übersehen werden — im Dokument nachsehen.'],
  },
  {
    id: 'plausi-antrag-ohne-datum', titel: 'Antrag ohne Datum', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'grundangaben',
    ausloeser: 'Die Auswertung des Wohngeldantrags hat kein Datum bei der Unterschrift erkannt.',
    rechtsgrundlage: '§ 22 WoGG',
    erledigung: 'Eingangsdatum als maßgebliches Antragsdatum verwenden und im Vorgang eintragen.',
  },

  // ── Wohnung und Miete ──
  {
    id: 'mietvertrag', titel: 'Aktueller Mietvertrag', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietzuschuss und im Vorgang liegt kein Dokument vom Typ Mietvertrag vor.',
    nachweis: 'Mietvertrag (bei Heimbewohnern Heimvertrag, bei Untermiete Untermietvertrag)',
    rechtsgrundlage: '§ 3 Abs. 1 WoGG',
    erledigung: 'Mietvertrag nachfordern oder vorhandenen Vertrag als Mietvertrag einordnen.',
    hinweise: ['Die Regel unterscheidet nicht nach Antragsart: bei einem Weiterleistungsantrag liegt der Mietvertrag meist schon in der Akte — dann verwerfen.'],
  },
  {
    id: 'vermieterbescheinigung', titel: 'Vermieterbescheinigung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietzuschuss und im Vorgang liegt keine Vermieterbescheinigung (Typ Mietbescheinigung) vor.',
    nachweis: 'Vermieterbescheinigung mit Miethöhe, Wohnfläche und Beginn des Mietverhältnisses',
    rechtsgrundlage: '§§ 9, 11 WoGG; § 23 Abs. 3 WoGG (Auskunftspflicht des Vermieters)',
    erledigung: 'Vermieterbescheinigung beim Antragsteller anfordern oder direkt beim Vermieter erfragen.',
    hinweise: ['Bei Heimbewohnern ersetzt der Heimvertrag die Vermieterbescheinigung — dann verwerfen.'],
  },
  {
    id: 'mietzahlungsnachweis', titel: 'Nachweis der Mietzahlung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietzuschuss und im Vorgang liegt kein Kontoauszug vor.',
    nachweis: 'Aktueller Kontoauszug mit der Mietzahlung (oder Quittungen bei Barzahlung)',
    rechtsgrundlage: '§ 9 WoGG',
    erledigung: 'Kontoauszug der letzten Monate nachfordern.',
  },
  {
    id: 'plausi-miethoehe-abweichung', titel: 'Miethöhe klären', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Miete im Antrag weicht von der Miete im Mietvertrag bzw. in der Vermieterbescheinigung ab (Differenz ab 1 Cent).',
    rechtsgrundlage: '§§ 9, 11 WoGG',
    erledigung: 'Aktuelle Miethöhe klären (z. B. Mieterhöhung), die maßgebliche Miete im Vorgang eintragen.',
    hinweise: [
      'Verglichen wird nur mit dem ersten Mietdokument im Vorgang (Mietvertrag oder Vermieterbescheinigung). Nennt der ältere Mietvertrag noch die frühere Miete, bleibt eine Abweichung zur Vermieterbescheinigung unentdeckt.',
      'Verglichen wird die Bruttokaltmiete (ohne Heiz- und Warmwasserkosten).',
    ],
  },
  {
    id: 'plausi-wohnflaeche-abweichung', titel: 'Wohnfläche prüfen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Wohnfläche im Antrag weicht von der Wohnfläche im ersten Mietdokument ab.',
    rechtsgrundlage: '§ 11 WoGG',
    erledigung: 'Richtige Wohnfläche feststellen und im Vorgang eintragen; relevant v. a. bei teilweiser Untervermietung.',
    hinweise: ['Wie bei der Miethöhe wird nur das erste Mietdokument verglichen.'],
  },
  {
    id: 'plausi-mietvertrag-unsigniert', titel: 'Mietvertrag ohne Unterschrift', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Auswertung des Mietvertrags hat keine Unterschriften beider Parteien erkannt.',
    rechtsgrundlage: '§ 9 WoGG',
    erledigung: 'Unterschriften im Dokument prüfen; fehlen sie, unterschriebenen Vertrag nachfordern.',
  },
  {
    id: 'plausi-mietzahlung-fehlt', titel: 'Mietzahlung nicht belegt', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Auf einem vorliegenden Kontoauszug ist keine Mietzahlung erkennbar. Die Regel meldet je Kontoauszug.',
    rechtsgrundlage: '§ 9 WoGG',
    erledigung: 'Mietzahlung klären: anderes Konto, Barzahlung (Quittungen) oder Mietrückstand.',
  },

  // ── Identität und Versicherung ──
  {
    id: 'identitaet-jede-person', titel: 'Personalausweis', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'identitaet_versicherung',
    ausloeser: 'Für eine volljährige Person im Haushalt ist kein Ausweisdokument (Typ Personalausweis) zugeordnet. Stichtag ist das Antragsdatum; ohne Geburtsdatum gilt die Person als volljährig.',
    nachweis: 'Personalausweis, Reisepass oder Aufenthaltstitel',
    rechtsgrundlage: '§ 5 WoGG',
    erledigung: 'Vorhandenen Ausweis der Person zuordnen oder nachfordern.',
    hinweise: [
      'Gezählt wird nur ein Ausweis, der der Person im Vorgang zugeordnet ist. Der Posteingang ordnet Ausweise über Name und Geburtsdatum zu; ist die Zuordnung nicht eindeutig, trägt das Dokument den Hinweis „Person nicht eindeutig zuordenbar" und die Regel meldet, bis es zugeordnet ist.',
      'Für Kinder unter 18 wird kein Ausweis verlangt — sie sind im Antrag erfasst.',
    ],
  },
  {
    id: 'krankenversicherung-nachweis', titel: 'Nachweis Kranken-/Pflegeversicherung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'identitaet_versicherung',
    ausloeser: 'Für eine volljährige Person im Haushalt ist kein Nachweis der Kranken- und Pflegeversicherung zugeordnet. Stichtag ist das Antragsdatum; ohne Geburtsdatum gilt die Person als volljährig.',
    nachweis: 'Versichertenkarte, Beitragsbescheinigung oder Mitgliedsbescheinigung',
    rechtsgrundlage: '§ 16 WoGG',
    erledigung: 'Prüfen, ob die Beiträge schon aus Gehaltsabrechnung oder Rentenbescheid hervorgehen; nur sonst nachfordern.',
    hinweise: ['Kinder unter 18 sind ausgenommen (in der Regel familienversichert).', 'Für Arbeitnehmer und Rentner ist der Nachweis meist schon über Abrechnung bzw. Rentenbescheid belegt; ob ein eigener Nachweis nur für Selbständige und privat Versicherte nötig ist, ist fachlich noch offen.'],
  },

  // ── Einkommen ──
  {
    id: 'verdienstbescheinigung', titel: 'Verdienstbescheinigung / Gehaltsabrechnungen', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Die Person hat Einkommen aus Lohn/Gehalt oder den Erwerbsstatus „angestellt", aber keine Verdienstbescheinigung und keine Gehaltsabrechnung ist ihr zugeordnet.',
    nachweis: 'Verdienstbescheinigung des Arbeitgebers oder Gehaltsabrechnungen der letzten Monate',
    rechtsgrundlage: '§§ 14, 15 WoGG',
    erledigung: 'Abrechnungen der Person zuordnen oder nachfordern (auch für Minijobs).',
  },
  {
    id: 'rentenbescheid', titel: 'Aktueller Rentenbescheid', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Die Person hat Renteneinkommen oder den Erwerbsstatus „Rente/Pension", aber kein Rentenbescheid ist ihr zugeordnet.',
    nachweis: 'Aktueller Rentenbescheid oder Rentenanpassungsmitteilung',
    rechtsgrundlage: '§ 14 Abs. 2 WoGG',
    erledigung: 'Rentenbescheid der Person zuordnen oder nachfordern.',
  },
  {
    id: 'plausi-rentenart-fehlt', titel: 'Rentenart/Grundrentenzeiten unklar', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'einkommen',
    ausloeser: 'Ein vorliegender Rentenbescheid nennt die Rentenart oder die Grundrentenzeiten nicht.',
    rechtsgrundlage: '§ 17 WoGG',
    erledigung: 'Für die Freibetragsprüfung einen Bescheid mit Rentenart/Grundrentenzeiten nachfordern.',
    hinweise: ['Greift nur, wenn ein Rentenbescheid vorliegt. Eine im Antrag fehlende Rentenart ohne Bescheid meldet stattdessen „Aktueller Rentenbescheid".'],
  },
  {
    id: 'plausi-kontoauszug-unerklaerte-einkuenfte', titel: 'Einkünfte auf dem Kontoauszug nicht angegeben', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'einkommen',
    ausloeser: 'Auf einem Kontoauszug wurden Einkünfte erkannt (z. B. Kapitalerträge, Mieteinnahmen, Lohn, Rente), die bei der zugeordneten Person nicht als Einkommen erfasst sind. Je Einkunftsart ein Befund.',
    rechtsgrundlage: '§ 14 WoGG',
    erledigung: 'Herkunft der Zahlungen beim Antragsteller erfragen und ggf. als Einkommen erfassen.',
    hinweise: ['Setzt voraus, dass der Kontoauszug einer Person zugeordnet ist und deren Einkommen erfasst wurde.'],
  },

  // ── Familie, Behinderung, Pflege ──
  {
    id: 'kindergeld-nachweis', titel: 'Nachweis Kindergeld', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'familie_pflege',
    ausloeser: 'Bei der Person ist „erhält Kindergeld" erfasst, aber kein Kindergeldnachweis ist ihr zugeordnet.',
    nachweis: 'Kindergeldbescheid der Familienkasse oder Kontoauszug mit Kindergeldzahlung',
    rechtsgrundlage: '§§ 5, 17 WoGG',
    erledigung: 'Kindergeldbescheid zuordnen oder nachfordern.',
  },
  {
    id: 'schwerbehinderung-nachweis', titel: 'Nachweis Schwerbehinderung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'familie_pflege',
    ausloeser: 'Bei der Person ist ein Grad der Behinderung erfasst, aber kein Schwerbehindertenausweis ist ihr zugeordnet.',
    nachweis: 'Schwerbehindertenausweis oder Feststellungsbescheid (GdB)',
    rechtsgrundlage: '§ 17 Nr. 1 WoGG',
    erledigung: 'Ausweis bzw. Bescheid zuordnen oder nachfordern.',
  },
  {
    id: 'pflegegrad-nachweis', titel: 'Nachweis Pflegebedürftigkeit', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'familie_pflege',
    ausloeser: 'Bei der Person ist ein Pflegegrad oder häusliche Pflegebedürftigkeit erfasst, aber kein Pflegenachweis ist ihr zugeordnet.',
    nachweis: 'Bescheid der Pflegekasse über den Pflegegrad',
    rechtsgrundlage: '§ 17 Nr. 1 WoGG',
    erledigung: 'Pflegekassenbescheid zuordnen oder nachfordern.',
  },

  // ── Vermögen ──
  {
    id: 'vermoegensnachweise', titel: 'Vermögensnachweise', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Bei der Person ist Vermögen erfasst, aber kein Vermögensnachweis ist ihr zugeordnet.',
    nachweis: 'Kontoauszüge, Depot- oder Sparbuchauszüge, Nachweise zu Immobilien',
    rechtsgrundlage: '§ 21 Nr. 3 WoGG',
    erledigung: 'Vermögensnachweise zuordnen oder nachfordern.',
    hinweise: ['Greift nur, wenn Vermögen bei der Person erfasst ist. Ein beiliegender Depotauszug allein löst keine Prüfung aus.'],
  },
  {
    id: 'plausi-vermoegen-ueber-freigrenze', titel: 'Vermögen über Freigrenze', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'vermoegen',
    ausloeser: 'Das erfasste Vermögen aller Haushaltsmitglieder übersteigt die Freigrenze (60.000 € plus 30.000 € je weiterem Mitglied).',
    rechtsgrundlage: '§ 21 Nr. 3 WoGG',
    erledigung: 'Vermögensnachweise und Zweckerklärung anfordern, dann im Einzelfall bewerten.',
    hinweise: ['Rechnet nur mit dem im Vorgang erfassten Vermögen. Werte aus beiliegenden Depot- oder Kontoauszügen fließen erst ein, wenn sie erfasst sind.'],
  },

  // ── Ausschlussgründe ──
  {
    id: 'ausschluss-person-transferbezug', titel: 'Möglicher Wohngeld-Ausschluss (§ 7)', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'ausschluss',
    ausloeser: 'Bei der Person ist ein Ausschlussgrund erfasst (z. B. Bürgergeld, Grundsicherung, BAföG) oder eine Transferleistung mit Unterkunftskosten.',
    rechtsgrundlage: '§ 7 WoGG; § 20 Abs. 2 WoGG (Ausbildungsförderung)',
    erledigung: 'Prüfen, ob die Person bei der Wohngeldberechnung außer Betracht bleibt oder der ganze Haushalt ausgeschlossen ist.',
    hinweise: ['Greift nur bei erfasstem Ausschlussgrund; eine Transferleistung, die nur aus einem Bescheid hervorgeht, muss zuerst bei der Person eingetragen werden.'],
  },

  // ── Verfahren ──
  {
    id: 'bwz-vorschlag-pruefen', titel: 'Bewilligungszeitraum festlegen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'verfahren',
    ausloeser: 'Ein Antragsdatum ist erfasst, aber noch kein Bewilligungszeitraum. Die App schlägt 12 Monate ab Antragsmonat vor.',
    rechtsgrundlage: '§§ 22, 25 WoGG',
    erledigung: 'Bewilligungszeitraum prüfen und übernehmen oder anpassen.',
  },
];

const INDEX = new Map(REGELKATALOG.map((r) => [r.id, r]));

/** Beschreibung zu einer Regel-ID; parametrisierte IDs (`basis:parameter`) über den Präfix. */
export function regelBeschreibung(regelId: string): RegelBeschreibung | undefined {
  return INDEX.get(regelId) ?? INDEX.get(regelId.split(':')[0]!);
}
