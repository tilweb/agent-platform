/**
 * Beschreibung aller Prüfregeln — die aufrufbare Dokumentation der Regel-Engine.
 *
 * Lebt bewusst neben den Regeln (nachweise.ts, plausibilitaet.ts). Der Test
 * `regeln.test.ts` stellt sicher, dass jede im Checker erzeugte Regel-ID hier
 * beschrieben ist. Bei fachlichen Änderungen an einer Regel: Beschreibung mitziehen
 * und REGELKATALOG_STAND hochzählen.
 *
 * Spec: docs/wohngeld-pruefregeln-doku-spec-2026-09-24.md
 *       docs/wohngeld-antrag-beleg-abgleich-spec-2026-09-28.md (Abgleich Antrag ↔ Beleg)
 *       docs/wohngeld-fehlalarme-2026-09-28.md (Fehlalarme der Golden-Messung, Stand 2026-09-28a)
 */
import type { PruefKategorie, PruefTyp } from '../types';
import { STANDARD_KONSTANTEN as K } from './konstanten';

const eur = (n: number) => `${n.toLocaleString('de-DE')} €`;

export const REGELKATALOG_STAND = '2026-09-28a';

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
      'Ohne Datum im Formular gilt fachlich der Eingang bei der Behörde als Antragsdatum; dann das Eingangsdatum eintragen. Ist das Formular ohne Datum eingegangen, meldet das „Antrag ohne Datum" — das Antragsdatum wird dann hier nicht zusätzlich aufgeführt.',
      'Bei Heimbewohnern (Heimvertrag liegt vor) wird im Antrag keine Miete angegeben — die Miethöhe gilt dann nicht als fehlend.',
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
    ausloeser: 'Mietzuschuss und im Vorgang liegt kein Dokument vom Typ Mietvertrag vor. Beim Weiterleistungsantrag nur, wenn auch keine Vermieterbescheinigung vorliegt.',
    nachweis: 'Mietvertrag (bei Heimbewohnern Heimvertrag, bei Untermiete Untermietvertrag)',
    rechtsgrundlage: '§ 3 Abs. 1 WoGG',
    erledigung: 'Mietvertrag nachfordern oder vorhandenen Vertrag als Mietvertrag einordnen.',
    hinweise: ['Weiterleistungsantrag: der Mietvertrag liegt aus dem Vorverfahren in der Akte; die aktuelle Vermieterbescheinigung genügt. Bei Umzug oder neuem Vertrag den Prüfschritt manuell anlegen.'],
  },
  {
    id: 'vermieterbescheinigung', titel: 'Vermieterbescheinigung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietzuschuss und im Vorgang liegt keine Vermieterbescheinigung (Typ Mietbescheinigung) vor. Entfällt, wenn ein Heimvertrag vorliegt.',
    nachweis: 'Vermieterbescheinigung mit Miethöhe, Wohnfläche und Beginn des Mietverhältnisses',
    rechtsgrundlage: '§§ 9, 11 WoGG; § 23 Abs. 3 WoGG (Auskunftspflicht des Vermieters)',
    erledigung: 'Vermieterbescheinigung beim Antragsteller anfordern oder direkt beim Vermieter erfragen.',
    hinweise: ['Bei Heimbewohnern ersetzt der Heimvertrag die Vermieterbescheinigung; erkannt wird das am Dokument „Heimvertrag". Liegt er nicht vor, meldet die Regel weiter.'],
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
    ausloeser: 'Die Bruttokaltmiete im Antrag weicht vom maßgeblichen Mietdokument ab (mehr als 1 € Rundungstoleranz). Maßgeblich ist das aktuellste aller Mietdokumente: zuerst nach dem Datum, ab dem die Miete gilt (Mietbeginn, Mieterhöhung ab, „Miete seit"), sonst Vermieterbescheinigung vor Mieterhöhung vor Mietvertrag.',
    rechtsgrundlage: '§§ 9, 11 WoGG',
    erledigung: 'Aktuelle Miethöhe klären (z. B. Mieterhöhung), die maßgebliche Miete im Vorgang eintragen.',
    hinweise: [
      'Ältere Mietverträge mit der früheren Miete gelten nicht als Widerspruch; der Belegtext nennt sie nur zur Information.',
      'Verglichen wird die Bruttokaltmiete (ohne Heiz- und Warmwasserkosten). Entspricht die Differenz genau den Heiz-/Warmwasserkosten, wurde vermutlich die Gesamtmiete gelesen — dann kein Befund.',
      'Ein Untermietvertrag zählt nur, wenn kein anderes Mietdokument vorliegt (sonst ist die antragstellende Person meist die Untervermieterin).',
      'Toleranz per WOHNGELD_MIETE_TOLERANZ_EUR / _PROZENT einstellbar (kommunal festzulegen).',
    ],
  },
  {
    id: 'plausi-wohnflaeche-abweichung', titel: 'Wohnfläche prüfen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Wohnfläche im Antrag weicht von der Wohnfläche im maßgeblichen Mietdokument mit Flächenangabe ab (Auswahl wie bei der Miethöhe).',
    rechtsgrundlage: '§ 11 WoGG',
    erledigung: 'Richtige Wohnfläche feststellen und im Vorgang eintragen; relevant v. a. bei teilweiser Untervermietung.',
  },
  {
    id: 'plausi-mietzahlung-abweichung', titel: 'Mietzahlung weicht von der Miete ab', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Mietabbuchung auf einem Kontoauszug passt weder zur Bruttokaltmiete laut Antrag noch zur Bruttokaltmiete zuzüglich der bekannten Heiz-/Warmwasserkosten (Antrag oder Mietdokument). Sind keine Heizkosten bekannt, meldet die Regel nur eine Zahlung unter der Bruttokaltmiete. Ein Befund je Vorgang, alle abweichenden Auszüge im Belegtext.',
    rechtsgrundlage: '§ 9 WoGG',
    erledigung: 'Klären, ob sich die Miete geändert hat, Teil- oder Nachzahlungen vorliegen oder weitere Kosten (Garage, Strom) mit abgebucht werden.',
    hinweise: ['Nur ein Hinweis: die Abbuchung kann Nachzahlungen oder andere Kosten enthalten.', 'Entspricht die Zahlung dem maßgeblichen Mietdokument, meldet bereits „Miethöhe klären" — kein zweiter Befund.'],
  },
  {
    id: 'plausi-mieter-nicht-im-haushalt', titel: 'Mieter:in nicht im Haushalt erfasst', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Ein Mietvertrag nennt eine Person als Mieter:in, die im Antrag nicht als Haushaltsmitglied erfasst ist (Abgleich über Name bzw. Geburtsdatum). Wohngeld-Pendant zu „Partner:in fehlt" der Grundsicherung.',
    rechtsgrundlage: '§§ 5, 6 WoGG',
    erledigung: 'Klären, ob die Person noch in der Wohnung lebt (dann Haushaltsmitglied mit Einkommen erfassen) oder ausgezogen bzw. verstorben ist (Nachweis anfordern).',
    hinweise: ['Meldebescheinigungen werden noch nicht ausgewertet — es gibt dafür keinen eigenen Dokumenttyp.', 'Untermietverträge bleiben außen vor.'],
  },
  {
    id: 'plausi-mietvertrag-unsigniert', titel: 'Unterschrift im Mietvertrag bitte sichten', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Die Auswertung des (ersten) Mietvertrags hat keine Unterschriften beider Parteien erkannt. Standard ist ein Hinweis zum Sichten mit Seitenangabe (Fundstelle, sonst letzte Seite des Vertrags). Als Anforderung „Mietvertrag ohne Unterschrift" nur, wenn die Extraktion das leere Feld mit einer Konfidenz ab UNTERSCHRIFT_LEER_MIN_KONFIDENZ meldet.',
    rechtsgrundlage: '§ 9 WoGG',
    erledigung: 'Unterschriftsbereich im Dokument ansehen. Ist der Vertrag unterschrieben, Hinweis verwerfen; sonst unterschriebenen Vertrag nachfordern.',
    hinweise: [
      'Die Unterschriftserkennung ist unsicher: in der Golden-Messung wurden 35 von 60 unterschriebenen Mietverträgen als unsigniert gelesen.',
      `Die Pipeline deckelt Feld-Konfidenzen derzeit bei 0,7 (Selbsteinschätzung des Modells, kein Bildbefund). Mit dem Standard ${K.UNTERSCHRIFT_LEER_MIN_KONFIDENZ.toLocaleString('de-DE')} bleibt es deshalb beim Hinweis; Env WOHNGELD_UNTERSCHRIFT_LEER_MIN_KONFIDENZ.`,
      'Eine zusätzliche Bildprüfung des Unterschriftsbereichs ist als Option beschrieben (docs/wohngeld-fehlalarme-2026-09-28.md), nicht gebaut.',
    ],
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
    ausloeser: 'Für eine volljährige Person im Haushalt ist kein Ausweisdokument (Typ Personalausweis) zugeordnet. Stichtag ist das Antragsdatum; ohne Geburtsdatum gilt die Person als volljährig. Nicht beim Weiterleistungsantrag (Identität aus dem Vorverfahren belegt).',
    nachweis: 'Personalausweis, Reisepass oder Aufenthaltstitel',
    rechtsgrundlage: '§ 5 WoGG',
    erledigung: 'Vorhandenen Ausweis der Person zuordnen oder nachfordern.',
    hinweise: [
      'Gezählt wird nur ein Ausweis, der der Person im Vorgang zugeordnet ist. Der Posteingang ordnet Ausweise über Geburtsdatum und Name zu (ein abweichender Buchstabe je Namensteil gilt als Lesefehler, z. B. „GÜNTER"/„Günther"); ist die Zuordnung nicht eindeutig, trägt das Dokument den Hinweis „Person nicht eindeutig zuordenbar" und die Regel meldet, bis es zugeordnet ist.',
      'Weiterleistungsantrag: kommt ein Haushaltsmitglied neu hinzu, den Ausweis manuell anfordern — die Regel erkennt neue Mitglieder nicht.',
      'Mitbewohner (Antrag Frage 7) und verstorbene Mitglieder (Frage 8) legt der Posteingang nicht als Haushaltsmitglieder an; für sie wird kein Ausweis verlangt.',
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

  {
    id: 'plausi-geburtsdatum-abweichung', titel: 'Geburtsdatum weicht ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'identitaet_versicherung',
    ausloeser: 'Das Geburtsdatum einer Person im Antrag weicht vom Geburtsdatum in einem ihr zugeordneten Beleg ab (Ausweis, Rentenbescheid, Mietvertrag u. a.).',
    rechtsgrundlage: '§ 60 SGB I',
    erledigung: 'Richtiges Geburtsdatum klären (Ausweis ist maßgeblich) und die Zuordnung des Belegs prüfen.',
    hinweise: ['Der Posteingang ordnet Belege mit abweichendem Geburtsdatum nicht automatisch zu; der Befund entsteht deshalb meist nach manueller Zuordnung oder Korrektur.'],
  },
  {
    id: 'plausi-name-abweichung', titel: 'Name im Beleg weicht ab', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'identitaet_versicherung',
    ausloeser: 'Vor- oder Nachname in einem der Person zugeordneten Ausweis, Renten-, Lohn-, Versicherungs-, Schwerbehinderten- oder Pflegenachweis passt nicht zum Namen (oder Geburtsnamen) im Antrag. Ein abweichender Buchstabe gilt als Schreib-/Lesefehler.',
    rechtsgrundlage: '§ 60 SGB I',
    erledigung: 'Prüfen, ob der Beleg zur Person gehört (Heirat, Geburtsname, Schreibweise); ggf. Zuordnung korrigieren.',
    hinweise: ['Kontoauszüge und Bescheide an Dritte (Kindergeld, Unterhalt) werden nicht verglichen — dort steht oft der Name einer anderen Person.'],
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
    id: 'plausi-rente-abweichung', titel: 'Rentenbetrag weicht ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Die im Antrag angegebene gesetzliche Rente einer Person (Monatswert, jährliche Angaben ÷ 12) weicht um mehr als 1 € von der Bruttorente im Rentenbescheid bzw. in der Rentenanpassungsmitteilung derselben Person ab. Je Rentenart (Alters-, Hinterbliebenen-, Waisen-, EM-Rente) zählt der neueste Bescheid.',
    rechtsgrundlage: '§ 14 WoGG',
    erledigung: 'Aktuelle Bruttorente klären (häufig: Rentenanpassung zum 01.07. nicht berücksichtigt) und die Angabe im Vorgang berichtigen.',
    hinweise: [
      'Betriebs-, Zusatz- und Privatrenten sowie Pensionen im Antrag bleiben außen vor — sie stehen nicht im Bescheid der Rentenversicherung.',
      'Greift nur, wenn der Bescheid der Person zugeordnet ist und eine Bruttorente ausweist; nennt er nur den Zahlbetrag, meldet „Rentenhöhe prüfen (nur Zahlbetrag belegt)".',
    ],
  },
  {
    id: 'plausi-rente-zahlbetrag-pruefen', titel: 'Rentenhöhe prüfen (nur Zahlbetrag belegt)', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Der Rentenbescheid nennt nur den Zahlbetrag (nach Kranken-/Pflegeversicherung), und die Bruttoangabe im Antrag liegt unter dem Zahlbetrag oder mehr als 15 % darüber.',
    rechtsgrundlage: '§ 14 WoGG',
    erledigung: 'Bruttorente aus einem vollständigen Bescheid feststellen oder beim Antragsteller erfragen.',
    hinweise: ['Wohngeld rechnet mit der Bruttorente; der Zahlbetrag ist nur ein Anhaltspunkt. Faktor per WOHNGELD_RENTE_BRUTTO_ZAHLBETRAG_FAKTOR einstellbar.'],
  },
  {
    id: 'plausi-einkommen-abweichung', titel: 'Einkommen weicht vom Nachweis ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Das im Antrag angegebene Brutto-Erwerbseinkommen einer Person (Monatswert, jährliche Angaben ÷ 12, ohne Einmal- und Sonderzahlungen) weicht vom Monatsdurchschnitt ihrer Gehaltsabrechnungen (je Monat über alle Arbeitgeber summiert) bzw. ihrer Verdienstbescheinigung ab; ebenso Arbeitslosen-, Kranken- und Elterngeld gegenüber dem jeweiligen Bescheid. Toleranz: 5 %, mindestens 10 €. Je Einkunftsart ein Befund.',
    rechtsgrundlage: '§§ 14, 15 WoGG',
    erledigung: 'Aktuelles Einkommen klären (Stundenänderung, Lohnerhöhung, Zuschläge) und für die Prognose maßgebliche Nachweise anfordern.',
    hinweise: [
      'Mehrere Beschäftigungen werden nur verglichen, wenn die Abrechnungsmonate lesbar sind (sonst ist die Monatssumme nicht bestimmbar).',
      'Steuerunterlagen (Selbständige) werden nicht verglichen — Gewinn des Vorjahres und Prognose sind nicht gleichartig.',
      'Toleranz per WOHNGELD_EINKOMMEN_TOLERANZ_EUR / _PROZENT einstellbar (kommunal festzulegen).',
    ],
  },
  {
    id: 'plausi-kontoauszug-unerklaerte-eingaenge', titel: 'Nicht angegebene Eingänge auf dem Konto', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Auf den Kontoauszügen einer Person gehen wiederkehrende Zahlungen ein (als laufend erkannt oder auf mehreren Auszügen), die keine im Antrag angegebene Einkommensart erklärt — oder Erwerbseinkommen von einem Arbeitgeber, für den keine Gehaltsabrechnung/Verdienstbescheinigung vorliegt. Kapitalerträge zählen auch einmalig. Wurde derselbe Absender auf einem Auszug als erklärt oder ausgenommen gelesen, bleibt er insgesamt außen vor. Ein Befund je Person mit Absender, Betrag und Auszug.',
    rechtsgrundlage: '§ 14 WoGG',
    erledigung: 'Herkunft der Zahlungen klären, ggf. als Einkommen erfassen und Nachweise (z. B. Minijob-Abrechnungen) anfordern.',
    hinweise: [
      'Kindergeld, Wohngeld, Erstattungen, Zuschüsse Dritter (Antrag Frage 26 wird nicht ausgelesen) und nicht zuordenbare Eingänge bleiben außen vor; Untermieteinnahmen gelten mit vorliegendem Untermietvertrag als erklärt.',
      'Kein Einkommen sind außerdem (konkrete Kriterien, Stichwortlisten in konstanten.ts): Umbuchungen zwischen eigenen Konten („Umbuchung", „Übertrag" oder die IBAN eines anderen Kontoauszugs im Haushalt), Erstattungen und Rückbuchungen (Finanzamt, Krankenkassen-/Versicherungserstattung, Nebenkosten-/Betriebskostenguthaben, Rücklastschrift — Krankengeld dagegen schon), Kindergeld/Familienkasse und Wohngeld, Pflegegeld bei erfasstem Pflegegrad, Zahlungen eines Haushaltsmitglieds (Vor- und Nachname im Verwendungszweck; nicht bei Erwerbs-, Renten- oder Unterhaltseingängen) sowie Transferleistungen (Jobcenter, BAföG …), wenn im Antrag eine angegeben ist. Gemeldet die Regel für die Person trotzdem, nennt der Befund die so ausgenommenen Eingänge.',
      'Der Arbeitgeber-Abgleich greift nur, wenn für jede Person mit angegebenem Erwerbseinkommen ein Lohnnachweis mit lesbarem Arbeitgeber vorliegt — fehlt ein Nachweis, meldet bereits „Verdienstbescheinigung / Gehaltsabrechnungen".',
      'Liegt die Eingangsliste vor, ersetzt diese Regel „Einkünfte auf dem Kontoauszug nicht angegeben" für diesen Auszug.',
    ],
  },
  {
    id: 'plausi-kontoauszug-unerklaerte-einkuenfte', titel: 'Einkünfte auf dem Kontoauszug nicht angegeben', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'einkommen',
    ausloeser: 'Auf einem Kontoauszug wurden Einkünfte erkannt (z. B. Kapitalerträge, Mieteinnahmen, Lohn, Rente), die bei der zugeordneten Person nicht als Einkommen erfasst sind. Je Einkunftsart ein Befund.',
    rechtsgrundlage: '§ 14 WoGG',
    erledigung: 'Herkunft der Zahlungen beim Antragsteller erfragen und ggf. als Einkommen erfassen.',
    hinweise: [
      'Setzt voraus, dass der Kontoauszug einer Person zugeordnet ist und deren Einkommen erfasst wurde.',
      'Als Mieteinnahme erkannte Eingänge gelten als erklärt, wenn ein Untermietvertrag vorliegt oder ein anderes Haushaltsmitglied Bürgergeld/Grundsicherung/Hilfe zum Lebensunterhalt bezieht (Mietanteil aus den Unterkunftskosten, keine Mieteinnahme).',
    ],
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
    hinweise: ['Rechnet nur mit dem im Vorgang erfassten Vermögen. Werte aus beiliegenden Depot- oder Kontoauszügen prüft „Vermögensangabe weicht von den Belegen ab".'],
  },
  {
    id: 'plausi-vermoegen-beleg-abweichung', titel: 'Vermögensangabe weicht von den Belegen ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'vermoegen',
    ausloeser: 'Die Belege des Haushalts (Vermögensnachweise plus letzter positiver Kontostand je Konto) liegen deutlich über dem erfassten Vermögen (mehr als 10 %, mindestens 250 €). Ist kein Vermögen erfasst (Frage 20 „Nein"), meldet die Regel nur, wenn die Belege die Freigrenze übersteigen.',
    rechtsgrundlage: '§ 21 Nr. 3 WoGG',
    erledigung: 'Vermögensangabe berichtigen lassen, Vermögen im Vorgang erfassen und Zweckerklärung anfordern; danach prüft „Vermögen über Freigrenze" die Höhe.',
    hinweise: [
      'Weniger Guthaben als angegeben ist kein Widerspruch (Vermögen kann auf Konten ohne Auszug liegen).',
      'Kontoauszüge ohne lesbare IBAN gelten als ein Konto, damit Monatsauszüge nicht doppelt zählen.',
      'Wohngeld-Pendant zu „Kontostand weicht von der Vermögensangabe ab" der Grundsicherung, aber haushaltsweit und einschließlich Depot-/Sparnachweisen.',
    ],
  },

  // ── Ausschlussgründe ──
  {
    id: 'ausschluss-person-transferbezug', titel: 'Möglicher Wohngeld-Ausschluss (§ 7)', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'ausschluss',
    ausloeser: 'Bei der Person ist ein Ausschlussgrund erfasst (z. B. Bürgergeld, Grundsicherung, BAföG) oder eine Transferleistung mit Unterkunftskosten.',
    rechtsgrundlage: '§ 7 WoGG; § 20 Abs. 2 WoGG (Ausbildungsförderung)',
    erledigung: 'Prüfen, ob die Person bei der Wohngeldberechnung außer Betracht bleibt oder der ganze Haushalt ausgeschlossen ist.',
    hinweise: [
      'Greift nur bei erfasstem Ausschlussgrund; eine Transferleistung, die nur aus einem Bescheid hervorgeht, muss zuerst bei der Person eingetragen werden.',
      'Bei Grundsicherung im Alter und bei Erwerbsminderung erscheint zusätzlich der Hinweis „Grundsicherungsbezug angegeben — Vorrang klären" für den Haushalt; diese Regel bleibt für die Frage zuständig, ob die Person außer Betracht bleibt.',
    ],
  },
  {
    id: 'vorrang-grundsicherungsbescheid-bei-wohngeld', titel: 'Grundsicherungsbezug angegeben — Vorrang klären', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'ausschluss',
    ausloeser: 'Bei einer Person im Haushalt ist Grundsicherung im Alter und bei Erwerbsminderung als Ausschlussgrund oder Transferleistung erfasst, deren Bezug nicht vor dem Antragsdatum endet. Ein Befund je Vorgang.',
    rechtsgrundlage: '§ 7 Abs. 1 Satz 1 Nr. 5 und Satz 3 WoGG; § 8 WoGG',
    erledigung: 'Grundsicherungsbescheid anfordern oder mit der Grundsicherungsstelle klären, ob die Ausnahme nach § 7 Abs. 1 Satz 3 WoGG greift (Wohngeld vermeidet die Hilfebedürftigkeit, Grundsicherung noch nicht erbracht) oder ein Verzicht nach § 8 WoGG erklärt wird.',
    hinweise: [
      'Es gibt keinen eigenen Dokumenttyp für den Grundsicherungsbescheid; ein solcher Bescheid wird als „Transferleistungsbescheid" eingeordnet. Die Regel greift deshalb nur über die Angaben bei der Person, nicht über ein Dokument.',
      'Keine Berechnung: ob Wohngeld die Hilfebedürftigkeit vermeidet, entscheidet die Sachbearbeitung in Abstimmung mit der Grundsicherungsstelle.',
    ],
  },
  {
    id: 'vorrang-grundsicherung-mitpruefen', titel: 'Grundsicherung mitprüfen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'ausschluss',
    ausloeser: `Die antragstellende Person oder ihr Ehe-/Lebenspartner hat im Antragsmonat die Altersgrenze nach § 41 Abs. 2 SGB XII erreicht oder ist laut Rentenbescheid dauerhaft voll erwerbsgemindert, bei beiden sind keine Erwerbseinkünfte erfasst, ihr Vermögen liegt unter 10.000 € je Person — erfasst oder durch Belege (Vermögensnachweise, letzte Kontostände) — und das erfasste Monatseinkommen (brutto) liegt nicht über dem Orientierungswert von ${eur(K.GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR)} (Alleinstehende) bzw. ${eur(K.GRUNDSICHERUNG_ORIENTIERUNG_PAAR_EUR)} (Paar, Summe). Entfällt, wenn schon Grundsicherungsbezug angegeben ist oder ein Heimvertrag vorliegt.`,
    rechtsgrundlage: '§ 41 SGB XII; § 2 Abs. 1 SGB XII; § 7 Abs. 1 WoGG',
    erledigung: 'Antragsteller auf die Grundsicherung im Alter und bei Erwerbsminderung hinweisen und die Vorrangfrage mit der Grundsicherungsstelle abstimmen. Den Hinweis verwerfen, wenn das Einkommen offensichtlich deutlich über dem Grundsicherungsniveau liegt.',
    hinweise: [
      'Keine Bedarfsberechnung: das Einkommen wird nur mit einem groben Orientierungswert verglichen. Die Orientierungswerte sind kommunal festzulegen (Regelbedarf + örtlich angemessene Unterkunftskosten; Env WOHNGELD_GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR / _PAAR_EUR). Der Standard ist bewusst eher hoch angesetzt (Hinweis lieber einmal zu viel).',
      'Ist die Höhe einer Einkommensposition nicht erfasst, bleibt der Hinweis (Einkommen unbekannt).',
      'Heim-/Einrichtungsfälle (Heimvertrag liegt vor) sind ausgenommen — dort klärt der Sozialhilfeträger Hilfe zur Pflege bzw. Grundsicherung in der Einrichtung gesondert.',
      'Stichtag ist das Antragsdatum; ohne Antragsdatum oder Geburtsdatum greift die Regel nicht.',
      'Die Erwerbsminderung wird nur aus der Rentenart im Rentenbescheid gelesen und muss ausdrücklich unbefristet sein; eine befristete oder unklare Erwerbsminderungsrente löst den Hinweis nicht aus.',
      'Ein eheähnlicher Partner ist im Wohngeld nicht als Partner erfasst; sein Einkommen und Vermögen bleiben hier unberücksichtigt.',
    ],
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
