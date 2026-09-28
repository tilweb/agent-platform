/**
 * Grundsicherung — Beschreibung aller Prüfregeln (aufrufbare Dokumentation der Regel-Engine).
 *
 * Lebt neben den Regeln (nachweise.ts, plausibilitaet.ts, vorrang.ts, ausserhalb.ts). Der Wächter
 * `regeln.test.ts` stellt sicher, dass jede im Checker erzeugte Regel-ID hier beschrieben ist und
 * umgekehrt. Bei fachlichen Änderungen: Beschreibung mitziehen und REGELKATALOG_STAND hochzählen.
 * Antwortform von GET /regeln identisch zu Wohngeld (Frontend-Kern-Bauteil RegelKatalog).
 * Fachgrundlage: docs/grundsicherung-regelkatalog-2026-09-27.md.
 */
import type { PruefKategorie, PruefTyp } from '../types';
import { STANDARD_KONSTANTEN as K } from './konstanten';

export const REGELKATALOG_STAND = '2026-09-28';

export type RegelGruppe =
  | 'antrag' | 'anspruch' | 'wohnen' | 'einkommen' | 'vermoegen'
  | 'mehrbedarf_versicherung' | 'vorrang' | 'verfahren';

export const REGEL_GRUPPE_LABEL: Record<RegelGruppe, string> = {
  antrag: 'Antrag, Identität, Vertretung',
  anspruch: 'Anspruchsgrund Alter / Erwerbsminderung',
  wohnen: 'Unterkunft und Heizung',
  einkommen: 'Einkommen',
  vermoegen: 'Vermögen und Unterhalt',
  mehrbedarf_versicherung: 'Mehrbedarfe und Versicherung',
  vorrang: 'Vorrang anderer Leistungen',
  verfahren: 'Verfahren und Prüfumfang',
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
  /** Bekannte Grenzen der automatischen Prüfung; kommunal festzulegende Größen. */
  hinweise?: string[];
}

const eur = (n: number) => n.toLocaleString('de-DE') + ' €';
const KOMMUNAL = 'Kommunal festzulegen';

export const REGELKATALOG: RegelBeschreibung[] = [
  // ── Antrag, Identität, Vertretung ──
  {
    id: 'antrag-vollstaendig-unterschrieben', titel: 'Vollständiger, unterschriebener Antrag', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'antrag',
    ausloeser: 'Im Vorgang liegt kein Dokument vom Typ „Antrag auf Grundsicherung" vor, oder auf allen vorliegenden Anträgen wurde keine Unterschrift erkannt.',
    nachweis: 'Ausgefüllter, datierter und unterschriebener Antrag (Antragsteller:in bzw. Vertretung)',
    rechtsgrundlage: '§ 44 Abs. 1 SGB XII; § 60 Abs. 1, 2 SGB I',
    erledigung: 'Antrag nachfordern bzw. zur Unterschrift zurücksenden, oder das eingegangene Formular als Antrag einordnen.',
    hinweise: ['Ob die Unterschrift der Partnerin bzw. des Partners fehlt, erkennt die Regel noch nicht getrennt.'],
  },
  {
    id: 'identitaet-jede-person', titel: 'Identitätsnachweis', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'antrag',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft (Antragsteller:in, Partner:in) ist kein Personalausweis bzw. Reisepass zugeordnet.',
    nachweis: 'Personalausweis oder Reisepass mit Geburtsdatum',
    rechtsgrundlage: '§ 41 Abs. 1, 2 SGB XII; § 60 SGB I',
    erledigung: 'Kopie des Ausweises anfordern oder ein vorhandenes Dokument der Person zuordnen.',
    hinweise: ['Haushaltsangehörige außerhalb der Einsatzgemeinschaft brauchen keinen eigenen Nachweis.'],
  },
  {
    id: 'bankverbindung', titel: 'Bankverbindung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'antrag',
    ausloeser: 'Im Vorgang ist keine IBAN erfasst.',
    nachweis: 'Kontoverbindung (IBAN, Kontoinhaber, ggf. P-Konto)',
    rechtsgrundlage: '§ 60 SGB I',
    erledigung: 'IBAN aus dem Antrag übernehmen oder nachfordern.',
  },
  {
    id: 'betreuung-bestellungsurkunde', titel: 'Betreuerausweis / Bestellungsurkunde', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'antrag',
    ausloeser: 'Bei einer Person der Einsatzgemeinschaft ist gesetzliche Betreuung angegeben und kein Betreuerausweis (der Person oder ohne Personenzuordnung) liegt vor.',
    nachweis: 'Betreuerausweis bzw. Bestellungsurkunde mit Aufgabenkreisen',
    rechtsgrundlage: '§ 60 SGB I',
    erledigung: 'Betreuerausweis anfordern; Aufgabenkreise (Vermögenssorge, Behördenangelegenheiten) prüfen.',
  },
  {
    id: 'vollmacht-bevollmaechtigte', titel: 'Vollmacht', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'antrag',
    ausloeser: 'Bei einer Person der Einsatzgemeinschaft ist Vertretung durch Vollmacht angegeben und keine Vollmacht liegt vor.',
    nachweis: 'Vollmacht der vertretenen Person',
    rechtsgrundlage: '§ 60 SGB I; § 13 SGB X',
    erledigung: 'Vollmacht anfordern und zum Vorgang nehmen.',
  },

  // ── Anspruchsgrund ──
  {
    id: 'anspruchsgrund-alter-nachweis', titel: 'Geburtsdatum für Anspruchsgrund Alter', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Anspruchsgrund ist Alter, für die antragstellende Person ist aber weder im Antrag noch auf Ausweis oder Rentenbescheid ein Geburtsdatum erfasst.',
    nachweis: 'Ausweis mit Geburtsdatum',
    rechtsgrundlage: '§ 41 Abs. 2 SGB XII',
    erledigung: 'Geburtsdatum erfassen bzw. Ausweis anfordern; danach prüft die App die Altersgrenze.',
    hinweise: ['Ob die Altersgrenze erreicht ist, melden die Regeln „Altersgrenze noch nicht erreicht" und „Altersgrenze erst im Folgemonat erreicht".'],
  },
  {
    id: 'em-rentenbescheid-unbefristet', titel: 'Rentenbescheid Erwerbsminderung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Anspruchsgrund ist Erwerbsminderung, eine Erwerbsminderungsrente ist als Einkommen angegeben, aber kein Rentenbescheid liegt vor.',
    nachweis: 'Rentenbescheid über Rente wegen voller Erwerbsminderung mit Rentenart, Befristung und Angabe zur Arbeitsmarktlage',
    rechtsgrundlage: '§ 41 Abs. 3, § 45 Satz 3 Nr. 1 SGB XII; § 102 Abs. 2 SGB VI',
    erledigung: 'Rentenbescheid anfordern. Aus ihm ergibt sich, ob ein Ersuchen an den Rentenversicherungsträger entbehrlich ist.',
  },
  {
    id: 'em-feststellung-rv', titel: 'Feststellung der dauerhaften vollen Erwerbsminderung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Anspruchsgrund ist Erwerbsminderung, eine unbefristete, volle, arbeitsmarktunabhängige EM-Rente ist nicht belegt (befristet, teilweise, Arbeitsmarktrente oder keine EM-Rente) und keine Feststellung des Rentenversicherungsträgers liegt vor.',
    nachweis: 'Feststellung des RV-Trägers (Ergebnis des Ersuchens nach § 45 SGB XII oder Stellungnahme nach § 109a Abs. 2, 3 SGB VI)',
    rechtsgrundlage: '§ 45 Satz 1, 2 SGB XII',
    erledigung: 'Ersuchen an den Rentenversicherungsträger stellen bzw. vorhandene Feststellung anfordern. Solange die Feststellung fehlt, ist die Leistungsberechtigung nach dem 4. Kapitel nicht belegt.',
    hinweise: ['Ist eine EM-Rente angegeben, aber der Bescheid fehlt noch, wartet die Regel auf den Bescheid („Rentenbescheid Erwerbsminderung").', 'Für die Partnerin bzw. den Partner greift die Regel, wenn eine Erwerbsminderung erfasst und die Altersgrenze nicht erreicht ist.'],
  },
  {
    id: 'plausi-altersgrenze-nicht-erreicht', titel: 'Altersgrenze noch nicht erreicht', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Anspruchsgrund ist Alter, die antragstellende Person erreicht die Altersgrenze nach § 41 Abs. 2 SGB XII aber erst zwei oder mehr Monate nach dem Antragsmonat.',
    rechtsgrundlage: '§ 41 Abs. 2 SGB XII; § 44 Abs. 2 SGB XII',
    erledigung: 'Anspruchsgrund klären: dauerhafte volle Erwerbsminderung prüfen oder Zuständigkeit des Jobcenters (SGB II). Antragsteller:in informieren.',
    hinweise: [
      'Altersgrenze tagesgenau nach Tabelle § 41 Abs. 2 SGB XII (vor 1947: 65 Jahre, stufenweise bis Jahrgang 1964: 67 Jahre); das Lebensjahr ist mit Ablauf des Vortags des Geburtstags vollendet (§§ 187, 188 BGB).',
      'Maßgeblich ist das frühere von Antragsdatum und Ersteingang bei einer anderen Stelle (§ 16 Abs. 2 SGB I).',
      'Wird die Grenze im unmittelbar folgenden Monat erreicht, meldet stattdessen „Altersgrenze erst im Folgemonat erreicht".',
    ],
  },
  {
    id: 'plausi-altersgrenze-folgemonat', titel: 'Altersgrenze erst im Folgemonat erreicht', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Anspruchsgrund ist Alter und die Altersgrenze wird im Kalendermonat unmittelbar nach dem Antragsmonat erreicht.',
    rechtsgrundlage: '§ 44 Abs. 2 SGB XII; § 41 Abs. 2 SGB XII',
    erledigung: 'Leistungsbeginn frühestens ab dem Monat, in dem die Altersgrenze erreicht wird; für den Antragsmonat ggf. andere Leistung (SGB II) prüfen.',
  },
  {
    id: 'plausi-geburtsdatum-abweichung', titel: 'Geburtsdatum weicht ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft weichen Geburtsdaten aus Antrag, Ausweis und Rentenbescheid voneinander ab.',
    rechtsgrundlage: '§ 41 Abs. 2 SGB XII; § 60 SGB I',
    erledigung: 'Richtiges Geburtsdatum anhand des Ausweises klären und im Vorgang korrigieren.',
  },
  {
    id: 'plausi-em-rente-befristet', titel: 'EM-Rente befristet', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Erwerbsminderung ist Anspruchsgrund und Rentenbescheid oder Antragsangabe weisen die Erwerbsminderungsrente als befristet aus.',
    rechtsgrundlage: '§ 41 Abs. 3, § 45 SGB XII; § 102 Abs. 2 SGB VI',
    erledigung: 'Ersuchen an den Rentenversicherungsträger prüfen; bis zur Feststellung ggf. Zuständigkeit SGB II / 3. Kapitel SGB XII klären.',
  },
  {
    id: 'plausi-em-rente-teilweise-oder-arbeitsmarkt', titel: 'EM-Rente teilweise oder wegen Arbeitsmarktlage', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'anspruch',
    ausloeser: 'Erwerbsminderung ist Anspruchsgrund und Rentenbescheid oder Angabe weisen nur teilweise Erwerbsminderung oder eine volle EM-Rente wegen der Arbeitsmarktlage aus.',
    rechtsgrundlage: '§ 41 Abs. 3 SGB XII; § 43 Abs. 2 SGB VI',
    erledigung: 'Keine Feststellung im Sinne des § 41 Abs. 3 — Ersuchen nach § 45 SGB XII prüfen oder Zuständigkeit des Jobcenters klären.',
  },

  // ── Wohnen ──
  {
    id: 'mietvertrag', titel: 'Mietvertrag', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Wohnsituation Miete oder Untermiete und kein Mietvertrag liegt vor. (Ein Mietvertrag ohne erkannte Unterschrift meldet seit 2026-09-28 „Unterschrift im Mietvertrag bitte sichten".)',
    nachweis: 'Mietvertrag bzw. Untermietvertrag (alle Seiten, unterschrieben)',
    rechtsgrundlage: '§ 42 Nr. 4, § 42a Abs. 1, § 35 Abs. 1 SGB XII',
    erledigung: 'Mietvertrag anfordern oder vorhandenes Dokument als Mietvertrag einordnen.',
  },
  {
    id: 'plausi-mietvertrag-unsigniert', titel: 'Unterschrift im Mietvertrag bitte sichten', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'wohnen',
    ausloeser: 'Mietwohnung und auf allen vorliegenden Mietverträgen hat die Auswertung keine Unterschrift erkannt. Standard ist ein Hinweis zum Sichten mit Seitenangabe (Unterschriftsbereich, sonst letzte Seite); als Anforderung „Mietvertrag ohne Unterschrift" nur, wenn die Extraktion das leere Feld mit einer Konfidenz ab UNTERSCHRIFT_LEER_MIN_KONFIDENZ meldet.',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII',
    erledigung: 'Unterschriftsbereich im Dokument ansehen. Ist der Vertrag unterschrieben, Hinweis verwerfen; sonst unterschriebenen Vertrag (alle Seiten) anfordern.',
    hinweise: [
      `Die Unterschriftserkennung ist unsicher (Golden-Messung: je Runde ein unterschriebener Vertrag als unsigniert gelesen). Die Pipeline deckelt Feld-Konfidenzen bei 0,7; mit dem Standard ${K.UNTERSCHRIFT_LEER_MIN_KONFIDENZ.toLocaleString('de-DE')} bleibt es beim Hinweis (Env GRUNDSICHERUNG_UNTERSCHRIFT_LEER_MIN_KONFIDENZ).`,
      'Eine zusätzliche Bildprüfung des Unterschriftsbereichs ist als Option beschrieben (docs/wohngeld-fehlalarme-2026-09-28.md), nicht gebaut.',
    ],
  },
  {
    id: 'mietbescheinigung-aktuell', titel: 'Aktuelle Mietbescheinigung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: `Mietwohnung, Mietvertrag liegt vor, keine Vermieterbescheinigung — und der Vertrag ist älter als ${K.MIETVERTRAG_AKTUELL_MONATE} Monate oder weist Grundmiete und kalte Nebenkosten nicht getrennt aus.`,
    nachweis: 'Vermieterbescheinigung oder letzte Mietänderung mit Grundmiete, kalten Nebenkosten und Heizkosten',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII; § 117 Abs. 5 SGB XII',
    erledigung: 'Vermieterbescheinigung anfordern (ggf. direkt beim Vermieter, § 117 SGB XII).',
  },
  {
    id: 'nebenkostenabrechnung', titel: 'Letzte Betriebskostenabrechnung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Wohnsituation Miete, keine Nebenkostenabrechnung liegt vor; nicht bei Pauschalmiete und nicht bei Mietbeginn innerhalb der letzten 12 Monate.',
    nachweis: 'Letzte Betriebs-/Nebenkostenabrechnung des Vermieters',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII',
    erledigung: 'Abrechnung anfordern; ist noch keine erstellt worden, Prüfschritt mit Begründung verwerfen.',
  },
  {
    id: 'heizkosten-nachweis', titel: 'Nachweis der Heizkosten', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Eigene Wohnung (Miete, Untermiete, Eigentum) und weder Energieabrechnung noch Nebenkostenabrechnung mit Heizkostenanteil noch Vermieterbescheinigung mit Heizkosten liegen vor. Nicht bei Heizung in der (Pauschal-)Miete.',
    nachweis: 'Abschlagsplan und letzte Jahresabrechnung des Versorgers oder Heizkostenanteil in der Nebenkostenabrechnung; Energieart',
    rechtsgrundlage: '§ 35 Abs. 1 Satz 1, § 42a Abs. 1 SGB XII',
    erledigung: 'Heizkostennachweis anfordern.',
    hinweise: ['Ist die Heizung in der Miete enthalten, meldet stattdessen „Heizkosten nicht getrennt ausgewiesen".'],
  },
  {
    id: 'mietzahlungsnachweis', titel: 'Nachweis der Mietzahlung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Wohnsituation Miete oder Untermiete und kein Kontoauszug der Einsatzgemeinschaft liegt vor.',
    nachweis: 'Kontoauszug mit Mietabbuchung',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII (tatsächliche Aufwendungen)',
    erledigung: 'Kontoauszug mit Mietzahlung anfordern.',
    hinweise: ['Liegt ein Kontoauszug ohne erkennbare Mietzahlung vor, meldet „Mietzahlung nicht erkennbar".'],
  },
  {
    id: 'eigentum-kostenaufstellung', titel: 'Kosten des Wohneigentums', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Wohnsituation Eigentum und kein Nachweis zum Wohneigentum (Kostenaufstellung, Darlehen, Grundsteuer) liegt vor.',
    nachweis: 'Aufstellung der Kosten und Belastungen mit Belegen (Schuldzinsen, Grundsteuer, Gebäudeversicherung, Nebenkosten)',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII',
    erledigung: 'Kostenaufstellung mit Belegen anfordern.',
    hinweise: ['Darlehen, Grundsteuer und Verkehrswert werden im ersten Wurf nicht einzeln geprüft.'],
  },
  {
    id: 'plausi-miete-abweichung', titel: 'Miethöhe weicht ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Kaltmiete oder kalte Nebenkosten im Antrag weichen von Vermieterbescheinigung (vorrangig) bzw. Mietvertrag ab, oder die Mietzahlung auf dem Kontoauszug passt weder zu Kaltmiete + Nebenkosten noch zu Kaltmiete + Nebenkosten + Heizkosten.',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII',
    erledigung: 'Aktuelle Miethöhe klären (z. B. letzte Mieterhöhung anfordern) und Angaben im Vorgang korrigieren.',
    hinweise: [`${KOMMUNAL}: Toleranz (Standard ${Math.round(K.MIETE_TOLERANZ_PROZENT * 100)} %, mindestens ${eur(K.MIETE_TOLERANZ_EUR)}; GRUNDSICHERUNG_MIETE_TOLERANZ_PROZENT / _EUR).`],
  },
  {
    id: 'plausi-miete-nicht-gezahlt', titel: 'Mietzahlung nicht erkennbar', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietwohnung; auf mindestens einem Kontoauszug der Einsatzgemeinschaft wurde ausdrücklich keine Mietzahlung erkannt und auf keinem eine.',
    rechtsgrundlage: '§ 35 Abs. 1 SGB XII',
    erledigung: 'Klären, wie die Miete gezahlt wird (bar, durch Dritte, anderes Konto), und Nachweis anfordern.',
  },
  {
    id: 'plausi-heizung-in-miete-unklar', titel: 'Heizkosten nicht getrennt ausgewiesen', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'wohnen',
    ausloeser: 'Mietwohnung mit Pauschalmiete bzw. Heizung in der Miete ohne eigenen Heizkostenbetrag (Mietvertrag oder Antrag), und keine Vermieterbescheinigung mit Heizkosten liegt vor.',
    rechtsgrundlage: '§ 35 Abs. 1, § 42a SGB XII',
    erledigung: 'Aufteilung in Grundmiete, kalte Nebenkosten und Heizkosten beim Vermieter anfordern.',
    hinweise: ['Die Karenzzeit nach § 35 Abs. 1 Satz 2 gilt nur für die Unterkunft, nicht für die Heizung — deshalb ist die Aufteilung nötig.'],
  },

  // ── Einkommen ──
  {
    id: 'rentenbescheid', titel: 'Rentenbescheid', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft ist eine gesetzliche Rente (Alters-, EM-, Hinterbliebenenrente) angegeben und kein Rentenbescheid ist ihr zugeordnet.',
    nachweis: 'Aktueller Rentenbescheid (Rentenart, Zahlbetrag, KV/PV-Beitrag, Rentenbeginn, Befristung)',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII',
    erledigung: 'Rentenbescheid anfordern.',
    hinweise: ['Bei Erwerbsminderung als Anspruchsgrund fordert „Rentenbescheid Erwerbsminderung" denselben Bescheid an.'],
  },
  {
    id: 'rentenanpassungsmitteilung', titel: 'Rentenanpassungsmitteilung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: `Gesetzliche Rente angegeben, der Bewilligungszeitraum reicht über den Anpassungsstichtag (${K.RENTENANPASSUNG_STICHTAG}) hinaus, der vorliegende Rentenbescheid ist älter und keine Anpassungsmitteilung liegt vor.`,
    nachweis: 'Rentenanpassungsmitteilung zum Stichtag',
    rechtsgrundlage: '§ 82 Abs. 1, 7 SGB XII',
    erledigung: 'Rentenanpassungsmitteilung anfordern.',
    hinweise: ['Stichtag GRUNDSICHERUNG_RENTENANPASSUNG_STICHTAG jährlich zum 01.07. fortschreiben.', 'Bewilligungszeitraum: erfasster Zeitraum, sonst Vorschlag 12 Monate ab Antragsmonat.'],
  },
  {
    id: 'betriebsrente-nachweis', titel: 'Nachweis Betriebsrente / Zusatzversorgung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft ist eine Betriebs-/Zusatz-/Privatrente oder Pension angegeben oder auf ihrem Kontoauszug erkennbar, und keine Leistungsmitteilung liegt vor.',
    nachweis: 'Leistungsmitteilung des Trägers (Betriebsrente, VBL/Zusatzversorgung, Pension, private Rente)',
    rechtsgrundlage: '§ 82 Abs. 1, 4, 5 SGB XII',
    erledigung: 'Leistungsmitteilung anfordern; bei zusätzlicher Altersvorsorge den Freibetrag prüfen.',
  },
  {
    id: 'wohngeldbescheid', titel: 'Wohngeldbescheid', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'vorgang', gruppe: 'einkommen',
    ausloeser: 'Wohngeld ist als Einkommen angegeben oder auf einem Kontoauszug erkennbar, und kein Wohngeldbescheid liegt vor.',
    nachweis: 'Wohngeld- bzw. Lastenzuschussbescheid',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII; § 7 WoGG',
    erledigung: 'Wohngeldbescheid anfordern.',
    hinweise: ['Ein nur beantragtes, noch nicht beschiedenes Wohngeld meldet „Wohngeldantrag läuft parallel".'],
  },
  {
    id: 'kein-einkommen-erklaerung', titel: 'Erklärung zum bisherigen Lebensunterhalt', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Niemand in der Einsatzgemeinschaft gibt Einkommen an, kein früherer Leistungsbezug ist erfasst und der Antrag enthält keine Angabe, wovon der Lebensunterhalt bisher bestritten wurde.',
    nachweis: 'Erklärung, wovon der Lebensunterhalt bisher bestritten wurde',
    rechtsgrundlage: '§ 60 Abs. 1 SGB I',
    erledigung: 'Erklärung anfordern.',
    hinweise: ['Hat die Partnerin bzw. der Partner Einkommen, gilt der Lebensunterhalt als erklärt.'],
  },
  {
    id: 'plausi-rente-abweichung', titel: 'Rentenbetrag weicht ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Der im Antrag angegebene Rentenbetrag weicht von der aktuellsten Quelle ab (Anpassungsmitteilung vor Kontoauszug vor Rentenbescheid).',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII',
    erledigung: 'Aktuellen Zahlbetrag klären und im Vorgang korrigieren.',
    hinweise: [`Toleranz ${eur(K.RENTE_TOLERANZ_EUR)} (GRUNDSICHERUNG_RENTE_TOLERANZ_EUR).`],
  },
  {
    id: 'plausi-rentenanpassung-fehlt', titel: 'Rentenangabe vor der Rentenanpassung', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Der Bewilligungszeitraum reicht über den Anpassungsstichtag hinaus, es liegt nur ein älterer Rentenbescheid vor und die Rentenangabe im Antrag entspricht dessen Zahlbetrag.',
    rechtsgrundlage: '§ 82 Abs. 1, 7 SGB XII',
    erledigung: 'Angepassten Betrag ab dem Stichtag ermitteln (Anpassungsmitteilung) und für die Monate ab Stichtag berücksichtigen.',
  },
  {
    id: 'plausi-kontoauszug-unerklaerte-eingaenge', titel: 'Nicht angegebene regelmäßige Eingänge', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'einkommen',
    ausloeser: 'Auf einem Kontoauszug der Person gibt es wiederkehrende Eingänge (z. B. Betriebsrente, Unterhalt, Mieteinnahmen, nicht zuordenbare Zahlungen), deren Einkommensart in der Einsatzgemeinschaft nicht angegeben ist.',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII; § 84 SGB XII (Zuwendungen)',
    erledigung: 'Herkunft der Eingänge klären, Einkommen erfassen und Nachweis anfordern.',
    hinweise: ['Wohngeld-Eingänge meldet die Regel „Wohngeld nicht als Einkommen angegeben"; einmalige Eingänge und Erstattungen werden nicht gemeldet.'],
  },
  {
    id: 'plausi-wohngeld-als-einkommen', titel: 'Wohngeld nicht als Einkommen angegeben', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'einkommen',
    ausloeser: 'Ein Wohngeldbescheid liegt vor oder ein Kontoauszug zeigt Wohngeld-Eingänge, aber niemand in der Einsatzgemeinschaft hat Wohngeld als Einkommen angegeben.',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII',
    erledigung: 'Wohngeld als Einkommen erfassen (für die Zeit des Bezugs).',
  },

  // ── Vermögen und Unterhalt ──
  {
    id: 'vermoegenserklaerung', titel: 'Vermögensangaben', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft sind keine Vermögensangaben erfasst (auch nicht „kein Vermögen").',
    nachweis: 'Vollständige Vermögensangaben (Bargeld, Konten, Wertpapiere, Versicherungen, Kfz, Immobilien, Forderungen — im In- und Ausland)',
    rechtsgrundlage: '§ 90 Abs. 1, § 43 Abs. 1 SGB XII',
    erledigung: 'Vermögensangaben aus dem Antrag erfassen (auch „kein Vermögen") oder nachfordern.',
  },
  {
    id: 'kontoauszuege', titel: 'Kontoauszüge', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: `Für die antragstellende Person bzw. für jede Person mit angegebenem Konto liegen keine Kontoauszüge vor, oder die erkannten Auszugszeiträume decken weniger als ${K.KONTOAUSZUG_MONATE} Monate ab.`,
    nachweis: `Lückenlose Kontoauszüge aller Konten der letzten ${K.KONTOAUSZUG_MONATE} Monate`,
    rechtsgrundlage: '§ 60 Abs. 1 SGB I; § 90 Abs. 1 SGB XII',
    erledigung: 'Fehlende Auszüge anfordern.',
    hinweise: [`${KOMMUNAL}: Zeitraum in Monaten (Standard ${K.KONTOAUSZUG_MONATE}; GRUNDSICHERUNG_KONTOAUSZUG_MONATE).`, 'Ob für jedes angegebene Konto ein Auszug vorliegt, prüft die Regel noch nicht einzeln.'],
  },
  {
    id: 'lebensversicherung-rueckkaufswert', titel: 'Rückkaufswert Lebensversicherung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Eine Lebens-/Kapitalversicherung ist angegeben und kein Vermögensnachweis der Person weist einen Rückkaufswert aus.',
    nachweis: 'Aktuelle Bescheinigung des Rückkaufswerts',
    rechtsgrundlage: '§ 90 Abs. 1, 3 SGB XII',
    erledigung: 'Rückkaufswert-Bescheinigung beim Versicherer anfordern.',
  },
  {
    id: 'bestattungsvorsorge-vertrag', titel: 'Bestattungsvorsorgevertrag', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Eine Bestattungsvorsorge oder Sterbegeldversicherung ist angegeben und kein Vertrag liegt vor.',
    nachweis: 'Bestattungsvorsorge-/Treuhandvertrag bzw. Sterbegeldversicherung mit Leistungsverzeichnis und Betrag',
    rechtsgrundlage: '§ 90 Abs. 3 SGB XII',
    erledigung: 'Vertrag anfordern; Angemessenheit entscheidet die Sachbearbeitung.',
  },
  {
    id: 'angaben-kinder-eltern', titel: 'Angaben zu Kindern und Eltern', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft sind die Angaben zu Kindern und Eltern (einschließlich der 100.000-€-Frage) nicht als erfasst markiert.',
    nachweis: 'Angaben zu Kindern und Eltern (Namen, Berufe) und Einschätzung, ob jemand mehr als 100.000 € Jahreseinkommen hat',
    rechtsgrundlage: '§ 94 Abs. 1a SGB XII',
    erledigung: 'Angaben aus dem Antrag erfassen oder nachfordern. Einkommensnachweise der Kinder werden nicht angefordert.',
  },
  {
    id: 'plausi-vermoegen-ueber-schonbetrag', titel: 'Vermögen über dem Schonbetrag', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'vermoegen',
    ausloeser: `Das verwertbare Barvermögen der Einsatzgemeinschaft (das Höhere aus Antragsangaben und belegten Ständen: Vermögensnachweise, letzter Endsaldo je Konto) liegt über dem Barbetrag (${eur(K.SCHONBETRAG_JE_PERSON)} je volljähriger Person + ${eur(K.SCHONBETRAG_UNTERHALTENE)} je unterhaltener Person).`,
    rechtsgrundlage: '§ 90 Abs. 2 Nr. 9, Abs. 3 SGB XII; § 1 BarbetragsVO',
    erledigung: 'Einsatz, Schonvermögen und Härte prüfen. Keine automatische Ablehnung.',
    hinweise: ['Als geschützt markierte Positionen, Eigenheim, Kfz, Hausrat, Riester und Bestattungsvorsorge zählen nicht mit.', 'Als unterhaltene Personen zählen minderjährige Haushaltsangehörige.'],
  },
  {
    id: 'plausi-kontostand-abweichung', titel: 'Kontostand weicht von der Vermögensangabe ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: 'Die Summe der letzten Endsalden je Konto auf den Kontoauszügen der Person liegt über der Summe ihrer angegebenen Kontoguthaben — oder, wenn genau ein Girokonto angegeben ist und ein Konto belegt ist, darunter.',
    rechtsgrundlage: '§ 90 Abs. 1 SGB XII',
    erledigung: 'Abweichung klären und Vermögensangaben korrigieren.',
    hinweise: [
      'Weniger Guthaben als angegeben wird bei mehreren Konten nicht gemeldet, weil nicht jedes Konto (z. B. Sparbuch) einen Kontoauszug hat.',`${KOMMUNAL}: Toleranz (Standard ${Math.round(K.KONTOSTAND_TOLERANZ_PROZENT * 100)} %, mindestens ${eur(K.KONTOSTAND_TOLERANZ_EUR)}; GRUNDSICHERUNG_KONTOSTAND_TOLERANZ_PROZENT / _EUR).`],
  },
  {
    id: 'plausi-grosse-abgaenge', titel: 'Größere Abgänge ohne erkennbaren Zweck', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'vermoegen',
    ausloeser: `Ein Kontoauszug der Person weist Abbuchungen oder Barabhebungen ohne erkennbaren Zweck ab ${eur(K.GROSSE_ABGAENGE_SCHWELLE)} aus.`,
    rechtsgrundlage: '§ 90, § 41 Abs. 4 SGB XII',
    erledigung: 'Verbleib klären. Sachbearbeitung entscheidet, ob Vermögen oder herbeigeführte Bedürftigkeit vorliegt.',
    hinweise: [`${KOMMUNAL}: Schwelle (Standard ${eur(K.GROSSE_ABGAENGE_SCHWELLE)}; GRUNDSICHERUNG_GROSSE_ABGAENGE_SCHWELLE).`],
  },

  // ── Mehrbedarfe und Versicherung ──
  {
    id: 'kv-pv-nachweis', titel: 'Nachweis Kranken-/Pflegeversicherung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'mehrbedarf_versicherung',
    ausloeser: 'Für eine Person der Einsatzgemeinschaft ist kein Nachweis der Kranken-/Pflegeversicherung zugeordnet (außer „keine Versicherung" ist angegeben).',
    nachweis: 'Mitgliedsbescheinigung der Kranken- und Pflegekasse mit Versicherungsart',
    rechtsgrundlage: '§ 32 Abs. 1, 2, § 42 Nr. 2 SGB XII',
    erledigung: 'Mitgliedsbescheinigung anfordern.',
    hinweise: ['Ist „keine Versicherung" angegeben, klärt die Sachbearbeitung den Versicherungsstatus manuell.'],
  },
  {
    id: 'schwerbehindertenausweis-g', titel: 'Schwerbehindertenausweis mit Merkzeichen G', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'mehrbedarf_versicherung',
    ausloeser: 'Merkzeichen G oder aG ist angegeben, die Person hat die Altersgrenze erreicht (oder unbekannt) oder ist voll erwerbsgemindert, und kein Ausweis liegt vor bzw. der Ausweis weist G nicht aus.',
    nachweis: 'Schwerbehindertenausweis (Vorder- und Rückseite) oder Feststellungsbescheid mit Merkzeichen G',
    rechtsgrundlage: '§ 30 Abs. 1 SGB XII; § 152 Abs. 4, 5 SGB IX',
    erledigung: 'Ausweis bzw. Bescheid anfordern; Mehrbedarf erst ab Nachweis.',
  },
  {
    id: 'ernaehrung-aerztliche-bescheinigung', titel: 'Ärztliche Bescheinigung kostenaufwändige Ernährung', kategorie: 'vollstaendigkeit', typ: 'anforderung', bezug: 'person', gruppe: 'mehrbedarf_versicherung',
    ausloeser: 'Mehrbedarf für kostenaufwändige Ernährung ist beantragt und keine passende ärztliche Bescheinigung der Person liegt vor.',
    nachweis: 'Ärztliche Bescheinigung über Erkrankung und medizinisch notwendige Kostform',
    rechtsgrundlage: '§ 30 Abs. 5 SGB XII',
    erledigung: 'Bescheinigung anfordern (ggf. kommunaler Vordruck).',
  },
  {
    id: 'plausi-merkzeichen-g-nicht-beantragt', titel: 'Merkzeichen G — Mehrbedarf nicht beantragt', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'mehrbedarf_versicherung',
    ausloeser: 'Ein Schwerbehindertenausweis der Person weist Merkzeichen G/aG aus, im Antrag ist es nicht angegeben; Altersgrenze erreicht (oder unbekannt) oder volle Erwerbsminderung.',
    rechtsgrundlage: '§ 30 Abs. 1 SGB XII',
    erledigung: 'Mehrbedarf zugunsten der Person prüfen und Merkzeichen erfassen.',
  },
  {
    id: 'plausi-ausweis-abgelaufen', titel: 'Schwerbehindertenausweis läuft ab', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'person', gruppe: 'mehrbedarf_versicherung',
    ausloeser: 'Ein Schwerbehindertenausweis der Person ist nur bis zu einem Datum vor Ende des Bewilligungszeitraums gültig (ohne Bewilligungszeitraum: vor dem Antragsdatum).',
    rechtsgrundlage: '§ 30 Abs. 1 SGB XII',
    erledigung: 'Verlängerung bzw. neuen Feststellungsbescheid anfordern; Mehrbedarf ggf. befristen.',
  },

  // ── Vorrang ──
  {
    id: 'vorrang-wohngeldbescheid-liegt-vor', titel: 'Laufender Wohngeldbescheid', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'vorrang',
    ausloeser: 'Ein Wohngeldbescheid liegt vor, dessen Bewilligungszeitraum den Antragsmonat überschneidet (oder nicht erkannt wurde).',
    rechtsgrundlage: '§ 82 Abs. 1 SGB XII; § 7 Abs. 1 Satz 1 Nr. 5 WoGG',
    erledigung: 'Wohngeld als Einkommen erfassen; bei Bewilligung der Grundsicherung die Wohngeldstelle informieren.',
  },
  {
    id: 'vorrang-wohngeld-antrag-parallel', titel: 'Wohngeldantrag läuft parallel', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'vorrang',
    ausloeser: 'Im Vorgang ist angegeben, dass ein Wohngeldantrag gestellt und noch nicht beschieden ist.',
    rechtsgrundlage: '§ 2 Abs. 1, § 44a SGB XII; § 7 Abs. 1 Satz 3 WoGG',
    erledigung: 'Mit der Wohngeldstelle abstimmen; ggf. vorläufig entscheiden.',
  },
  {
    id: 'vorrang-vermoegen-ueber-schonbetrag', titel: 'Wohngeld statt Grundsicherung prüfen (Vermögen)', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'vorrang',
    ausloeser: `Das Barvermögen liegt über dem Barbetrag der Grundsicherung, aber unter der Wohngeld-Freigrenze (${eur(K.WOHNGELD_FREIGRENZE_ERSTE_PERSON)} + ${eur(K.WOHNGELD_FREIGRENZE_WEITERE_PERSON)} je weiterem Haushaltsmitglied).`,
    rechtsgrundlage: '§ 90 Abs. 2 Nr. 9 SGB XII; § 21 Nr. 3 WoGG',
    erledigung: 'Auf Beratung zum Wohngeld hinweisen. Keine Berechnung, keine Ablehnung durch die App.',
  },
  {
    id: 'vorrang-weiterleitung-antragsdatum', titel: 'Antrag zuerst bei anderer Stelle eingegangen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'vorrang',
    ausloeser: 'Im Vorgang ist ein Ersteingang bei einer anderen Stelle (Datum oder Stelle) erfasst.',
    rechtsgrundlage: '§ 16 Abs. 2 SGB I; § 44 Abs. 2 SGB XII',
    erledigung: 'Eingangsdatum der ersten Stelle als Antragsdatum übernehmen und dokumentieren.',
  },
  {
    id: 'vorrang-sgb2-statt-sgb12', titel: 'Zuständigkeit Jobcenter (SGB II) prüfen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'person', gruppe: 'vorrang',
    ausloeser: 'Person unter der Altersgrenze und: EM-Rente befristet, nur teilweise Erwerbsminderung, Arbeitsmarktrente, negative Feststellung des RV-Trägers oder (bei Anspruchsgrund Alter) Altersgrenze im Antragsmonat nicht erreicht.',
    rechtsgrundlage: '§ 41 Abs. 3 SGB XII; § 16 Abs. 2 SGB I',
    erledigung: 'Zuständigkeit klären; Antrag ggf. an das Jobcenter weiterleiten.',
  },

  // ── Verfahren und Prüfumfang ──
  {
    id: 'plausi-regelbedarfsstufe-inkonsistent', titel: 'Regelbedarfsstufe prüfen', kategorie: 'plausibilitaet', typ: 'info', bezug: 'dokument', gruppe: 'verfahren',
    ausloeser: 'Die im Antrag angegebene Regelbedarfsstufe passt nicht zur Wohn- und Partnersituation (Stufe 2 ohne Partner:in, Stufe 1 mit Partner:in, Stufe 3 bei eigener Wohnung).',
    rechtsgrundlage: 'Anlage zu § 28 SGB XII; § 27a Abs. 4 SGB XII',
    erledigung: 'Stufe prüfen; die Festsetzung trifft das Fachverfahren.',
  },
  {
    id: 'plausi-partner-fehlt', titel: 'Partner:in fehlt in der Einsatzgemeinschaft', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'vorgang', gruppe: 'verfahren',
    ausloeser: 'Keine Partnerin bzw. kein Partner erfasst, aber Familienstand verheiratet/Lebenspartnerschaft/eheähnlich, eine Mitmieterin bzw. ein Mitmieter gleichen Nachnamens im Mietvertrag, oder eine haushaltsangehörige erwachsene Person gleichen Nachnamens und ähnlichen Alters (±10 Jahre).',
    rechtsgrundlage: '§ 43 Abs. 1 Satz 2, § 20, § 27 Abs. 2 SGB XII',
    erledigung: 'Einsatzgemeinschaft klären, Partner:in erfassen und deren Einkommen, Vermögen und Nachweise anfordern.',
  },
  {
    id: 'plausi-antrag-ohne-datum', titel: 'Antragsdatum fehlt', kategorie: 'plausibilitaet', typ: 'anforderung', bezug: 'dokument', gruppe: 'verfahren',
    ausloeser: 'Ein Antrag liegt vor, aber weder Antragsdatum noch Ersteingang sind im Vorgang erfasst.',
    rechtsgrundlage: '§ 44 Abs. 2 SGB XII; § 16 Abs. 2 SGB I',
    erledigung: 'Eingangsdatum (Eingangsstempel, bei Weiterleitung Eingang bei der ersten Stelle) als Antragsdatum erfassen — der Prüfschritt entfällt dann beim nächsten Prüflauf.',
  },
  {
    id: 'ausserhalb-pruefumfang', titel: 'Teile außerhalb des Prüfumfangs', kategorie: 'plausibilitaet', typ: 'info', bezug: 'vorgang', gruppe: 'verfahren',
    ausloeser: 'Wohnsituation Einrichtung/besondere Wohnform, Werkstatt-Entgelt oder Einkommen aus selbständiger Tätigkeit ist erfasst.',
    rechtsgrundlage: '§ 42a Abs. 2, 5; § 41 Abs. 3a; § 82 SGB XII',
    erledigung: 'Diese Teile manuell prüfen (Nachweise, Zuständigkeit, Einkommen). Die übrigen Regeln laufen normal.',
    hinweise: ['Aufenthaltsrecht, Schenkungsrückforderung und Kfz-Angemessenheit prüft die App im ersten Wurf ebenfalls nicht — ohne eigenen Hinweis.'],
  },
];

const INDEX = new Map(REGELKATALOG.map((r) => [r.id, r]));

/** Beschreibung zu einer Regel-ID; parametrisierte IDs (`basis:parameter`) über den Präfix. */
export function regelBeschreibung(regelId: string): RegelBeschreibung | undefined {
  return INDEX.get(regelId) ?? INDEX.get(regelId.split(':')[0]!);
}
