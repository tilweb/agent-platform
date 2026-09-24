/**
 * GENERIERT von scripts/wohngeld-recht/importiere-gesetze.ts — nicht von Hand ändern.
 * Amtlicher Wortlaut (gesetze-im-internet.de, gemeinfrei nach § 5 UrhG), zerlegt in Absätze.
 */
import type { GesetzAbsatz, GesetzQuelle } from './gesetz-parser';

export const GESETZ_QUELLEN: GesetzQuelle[] = [
  {
    "gesetz": "WoGG",
    "name": "Wohngeldgesetz",
    "stand": "Zuletzt geändert durch Art. 11 Abs. 8 G v. 16.4.2026 I Nr. 107",
    "abgerufen": "2026-06-30",
    "url": "https://www.gesetze-im-internet.de/wogg/"
  },
  {
    "gesetz": "WoGV",
    "name": "Wohngeldverordnung",
    "stand": "zuletzt geändert durch Art. 2 V v. 21.10.2024 I Nr. 314",
    "abgerufen": "2026-05-06",
    "url": "https://www.gesetze-im-internet.de/wogv/"
  },
  {
    "gesetz": "SGB I",
    "name": "Sozialgesetzbuch (SGB) Erstes Buch (I) - Allgemeiner Teil - (Artikel I des Gesetzes vom 11. Dezember 1975, BGBl. I S. 3015)",
    "stand": "Zuletzt geändert durch Art. 3 G v. 22.7.2026 I Nr. 223",
    "abgerufen": "2026-07-28",
    "url": "https://www.gesetze-im-internet.de/sgb_1/"
  }
];

export const GESETZ_ABSAETZE: GesetzAbsatz[] = [
 {
  "id": "wogg-1-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 1",
  "absatz": "Abs. 1",
  "titel": "Zweck des Wohngeldes",
  "text": "(1) Das Wohngeld dient der wirtschaftlichen Sicherung angemessenen und familiengerechten Wohnens.",
  "url": "https://www.gesetze-im-internet.de/wogg/__1.html"
 },
 {
  "id": "wogg-1-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 1",
  "absatz": "Abs. 2",
  "titel": "Zweck des Wohngeldes",
  "text": "(2) Das Wohngeld wird als Zuschuss zur Miete (Mietzuschuss) oder zur Belastung (Lastenzuschuss) für den selbst genutzten Wohnraum geleistet.",
  "url": "https://www.gesetze-im-internet.de/wogg/__1.html"
 },
 {
  "id": "wogg-2",
  "gesetz": "WoGG",
  "paragraph": "§ 2",
  "titel": "Wohnraum",
  "text": "Wohnraum sind Räume, die vom Verfügungsberechtigten zum Wohnen bestimmt und hierfür nach ihrer baulichen Anlage und Ausstattung tatsächlich geeignet sind.",
  "url": "https://www.gesetze-im-internet.de/wogg/__2.html"
 },
 {
  "id": "wogg-3-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 3",
  "absatz": "Abs. 1",
  "titel": "Wohngeldberechtigung",
  "text": "(1) Wohngeldberechtigte Person ist für den Mietzuschuss jede natürliche Person, die Wohnraum gemietet hat und diesen selbst nutzt. Ihr gleichgestellt sind\n1. die nutzungsberechtigte Person des Wohnraums bei einem dem Mietverhältnis ähnlichen Nutzungsverhältnis (zur mietähnlichen Nutzung berechtigte Person), insbesondere die Person, die ein mietähnliches Dauerwohnrecht hat,\n2. die Person, die Wohnraum im eigenen Haus, das mehr als zwei Wohnungen hat, bewohnt, und\n3. die Person, die in einem Heim im Sinne des Heimgesetzes oder entsprechender Gesetze der Länder nicht nur vorübergehend aufgenommen ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__3.html"
 },
 {
  "id": "wogg-3-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 3",
  "absatz": "Abs. 2",
  "titel": "Wohngeldberechtigung",
  "text": "(2) Wohngeldberechtigte Person ist für den Lastenzuschuss jede natürliche Person, die Eigentum an selbst genutztem Wohnraum hat. Ihr gleichgestellt sind\n1. die erbbauberechtigte Person,\n2. die Person, die ein eigentumsähnliches Dauerwohnrecht, ein Wohnungsrecht oder einen Nießbrauch innehat, und\n3. die Person, die einen Anspruch auf Bestellung oder Übertragung des Eigentums, des Erbbaurechts, des eigentumsähnlichen Dauerwohnrechts, des Wohnungsrechts oder des Nießbrauchs hat.\nDie Sätze 1 und 2 gelten nicht im Fall des Absatzes 1 Satz 2 Nr. 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__3.html"
 },
 {
  "id": "wogg-3-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 3",
  "absatz": "Abs. 3",
  "titel": "Wohngeldberechtigung",
  "text": "(3) Erfüllen mehrere Personen für denselben Wohnraum die Voraussetzungen des Absatzes 1 oder des Absatzes 2 und sind sie zugleich Haushaltsmitglieder (§ 5), ist nur eine dieser Personen wohngeldberechtigt. In diesem Fall bestimmen diese Personen die wohngeldberechtigte Person.",
  "url": "https://www.gesetze-im-internet.de/wogg/__3.html"
 },
 {
  "id": "wogg-3-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 3",
  "absatz": "Abs. 4",
  "titel": "Wohngeldberechtigung",
  "text": "(4) Wohngeldberechtigt ist nach Maßgabe der Absätze 1 bis 3 auch, wer zwar nach den §§ 7 und 8 Abs. 1 vom Wohngeld ausgeschlossen ist, aber mit mindestens einem zu berücksichtigenden Haushaltsmitglied (§ 6) Wohnraum gemeinsam bewohnt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__3.html"
 },
 {
  "id": "wogg-3-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 3",
  "absatz": "Abs. 5",
  "titel": "Wohngeldberechtigung",
  "text": "(5) Ausländer im Sinne des § 2 Abs. 1 des Aufenthaltsgesetzes (ausländische Personen) sind nach Maßgabe der Absätze 1 bis 4 nur wohngeldberechtigt, wenn sie sich im Bundesgebiet tatsächlich aufhalten und\n1. ein Aufenthaltsrecht nach dem Freizügigkeitsgesetz/EU haben,\n2. einen Aufenthaltstitel oder eine Duldung nach dem Aufenthaltsgesetz haben,\n3. ein Recht auf Aufenthalt nach einem völkerrechtlichen Abkommen haben,\n4. eine Aufenthaltsgestattung nach dem Asylgesetz haben,\n5. die Rechtsstellung eines heimatlosen Ausländers im Sinne des Gesetzes über die Rechtsstellung heimatloser Ausländer im Bundesgebiet haben oder\n6. auf Grund einer Rechtsverordnung vom Erfordernis eines Aufenthaltstitels befreit sind.\nNicht wohngeldberechtigt sind ausländische Personen, die durch eine völkerrechtliche Vereinbarung von der Anwendung deutscher Vorschriften auf dem Gebiet der sozialen Sicherheit befreit sind. In der Regel nicht wohngeldberechtigt sind Ausländer, die im Besitz eines Aufenthaltstitels zur Ausbildungsplatzsuche nach § 17 Absatz 1 des Aufenthaltsgesetzes, zur Arbeitsplatzsuche im Anschluss an Aufenthalte im Bundesgebiet nach § 20 des Aufenthaltsgesetzes, aufgrund einer Chancenkarte nach § 20a des Aufenthaltsgesetzes, für ein studienbezogenes Praktikum nach § 16e des Aufenthaltsgesetzes oder zur Teilnahme am europäischen Freiwilligendienst nach § 19e des Aufenthaltsgesetzes sind.",
  "url": "https://www.gesetze-im-internet.de/wogg/__3.html"
 },
 {
  "id": "wogg-4",
  "gesetz": "WoGG",
  "paragraph": "§ 4",
  "titel": "Berechnungsgrößen des Wohngeldes",
  "text": "Das Wohngeld richtet sich nach\n1. der Anzahl der zu berücksichtigenden Haushaltsmitglieder (§§ 5 bis 8),\n2. der zu berücksichtigenden Miete oder Belastung (§§ 9 bis 12) und\n3. dem Gesamteinkommen (§§ 13 bis 18)\nund ist nach § 19 zu berechnen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__4.html"
 },
 {
  "id": "wogg-5-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 5",
  "absatz": "Abs. 1",
  "titel": "Haushaltsmitglieder",
  "text": "(1) Haushaltsmitglied ist die wohngeldberechtigte Person, wenn der Wohnraum, für den sie Wohngeld beantragt, der Mittelpunkt ihrer Lebensbeziehungen ist. Haushaltsmitglied ist auch, wer\n1. als Ehegatte eines Haushaltsmitgliedes von diesem nicht dauernd getrennt lebt,\n2. als Lebenspartner oder Lebenspartnerin eines Haushaltsmitgliedes von diesem nicht dauernd getrennt lebt,\n3. mit einem Haushaltsmitglied so zusammenlebt, dass nach verständiger Würdigung der wechselseitige Wille anzunehmen ist, Verantwortung füreinander zu tragen und füreinander einzustehen,\n4. mit einem Haushaltsmitglied in gerader Linie oder zweiten oder dritten Grades in der Seitenlinie verwandt oder verschwägert ist,\n5. ohne Rücksicht auf das Alter Pflegekind eines Haushaltsmitgliedes ist,\n6. Pflegemutter oder Pflegevater eines Haushaltsmitgliedes ist\nund mit der wohngeldberechtigten Person den Wohnraum, für den Wohngeld beantragt wird, gemeinsam bewohnt, wenn dieser Wohnraum der jeweilige Mittelpunkt der Lebensbeziehungen ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__5.html"
 },
 {
  "id": "wogg-5-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 5",
  "absatz": "Abs. 2",
  "titel": "Haushaltsmitglieder",
  "text": "(2) Ein wechselseitiger Wille, Verantwortung füreinander zu tragen und füreinander einzustehen, wird vermutet, wenn mindestens eine der Voraussetzungen nach den Nummern 1 bis 4 des § 7 Abs. 3a des Zweiten Buches Sozialgesetzbuch erfüllt ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__5.html"
 },
 {
  "id": "wogg-5-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 5",
  "absatz": "Abs. 3",
  "titel": "Haushaltsmitglieder",
  "text": "(3) Ausländische Personen sind nur Haushaltsmitglieder nach Absatz 1 Satz 2, wenn sie die Voraussetzungen der Wohngeldberechtigung nach § 3 Abs. 5 erfüllen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__5.html"
 },
 {
  "id": "wogg-5-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 5",
  "absatz": "Abs. 4",
  "titel": "Haushaltsmitglieder",
  "text": "(4) Betreuen nicht nur vorübergehend getrennt lebende Eltern ein Kind oder mehrere Kinder zu annähernd gleichen Teilen, ist jedes dieser Kinder bei beiden Elternteilen Haushaltsmitglied. Gleiches gilt bei einer Aufteilung der Betreuung bis zu einem Verhältnis von mindestens einem Drittel zu zwei Dritteln je Kind. Betreuen die Eltern mindestens zwei dieser Kinder nicht in einem Verhältnis nach Satz 1 oder 2, ist bei dem Elternteil mit dem geringeren Betreuungsanteil nur das jüngste dieser Kinder Haushaltsmitglied. Für Pflegekinder und Pflegeeltern gelten die Sätze 1 bis 3 entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__5.html"
 },
 {
  "id": "wogg-6-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 6",
  "absatz": "Abs. 1",
  "titel": "Zu berücksichtigende Haushaltsmitglieder",
  "text": "(1) Bei der Berechnung des Wohngeldes sind vorbehaltlich des Absatzes 2 und der §§ 7 und 8 sämtliche Haushaltsmitglieder zu berücksichtigen (zu berücksichtigende Haushaltsmitglieder).",
  "url": "https://www.gesetze-im-internet.de/wogg/__6.html"
 },
 {
  "id": "wogg-6-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 6",
  "absatz": "Abs. 2",
  "titel": "Zu berücksichtigende Haushaltsmitglieder",
  "text": "(2) Stirbt ein zu berücksichtigendes Haushaltsmitglied, ist dies für die Dauer von zwölf Monaten nach dem Sterbemonat ohne Einfluss auf die bisher maßgebende Anzahl der zu berücksichtigenden Haushaltsmitglieder. Satz 1 ist nicht mehr anzuwenden, wenn nach dem Todesfall\n1. die Wohnung aufgegeben wird,\n2. die Zahl der zu berücksichtigenden Haushaltsmitglieder sich mindestens auf den Stand vor dem Todesfall erhöht oder\n3. der auf den Verstorbenen entfallende Anteil der Kosten der Unterkunft in einer Leistung nach § 7 Abs. 1 mindestens teilweise berücksichtigt wird.",
  "url": "https://www.gesetze-im-internet.de/wogg/__6.html"
 },
 {
  "id": "wogg-7-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 7",
  "absatz": "Abs. 1",
  "titel": "Ausschluss vom Wohngeld",
  "text": "(1) Vom Wohngeld ausgeschlossen sind Empfänger und Empfängerinnen von\n1. Grundsicherungsgeld nach dem Zweiten Buch Sozialgesetzbuch, auch in den Fällen des § 25 des Zweiten Buches Sozialgesetzbuch,\n2. Leistungen für Auszubildende nach § 27 Absatz 3 des Zweiten Buches Sozialgesetzbuch, die als Zuschuss erbracht werden,\n3. (weggefallen)\n4. Verletztengeld in Höhe des Betrages des Grundsicherungsgeldes nach § 19 Absatz 1 Satz 1 des Zweiten Buches Sozialgesetzbuch nach § 47 Abs. 2 des Siebten Buches Sozialgesetzbuch,\n5. Grundsicherung im Alter und bei Erwerbsminderung nach dem Zwölften Buch Sozialgesetzbuch,\n6. Hilfe zum Lebensunterhalt nach dem Zwölften Buch Sozialgesetzbuch,\n7.\na) Leistungen zum Lebensunterhalt oder\nb) anderen Leistungen in einer stationären Einrichtung, die den Lebensunterhalt umfassen,\nnach dem Vierzehnten Buch Sozialgesetzbuch oder nach einem Gesetz, das dieses für anwendbar erklärt,\n8. Leistungen in besonderen Fällen und Grundleistungen nach dem Asylbewerberleistungsgesetz oder\n9. Leistungen nach dem Achten Buch Sozialgesetzbuch in Haushalten, zu denen ausschließlich Personen gehören, die diese Leistungen empfangen,\nwenn bei deren Berechnung Kosten der Unterkunft berücksichtigt worden sind (Leistungen). Der Ausschluss besteht im Fall des Satzes 1 Nummer 4, wenn bei der Berechnung des Grundsicherungsgeldes nach § 19 Absatz 1 Satz 1 des Zweiten Buches Sozialgesetzbuch Kosten der Unterkunft berücksichtigt worden sind. Der Ausschluss besteht nicht, wenn\n1. die Leistungen nach den Sätzen 1 und 2 ausschließlich als Darlehen gewährt werden oder\n2. durch Wohngeld die Hilfebedürftigkeit im Sinne des § 9 des Zweiten Buches Sozialgesetzbuch, des § 19 Abs. 1 und 2 des Zwölften Buches Sozialgesetzbuch oder des § 93 des Vierzehnten Buches Sozialgesetzbuch vermieden oder beseitigt werden kann und\na) die Leistungen nach Satz 1 Nr. 1 bis 7 während der Dauer des Verwaltungsverfahrens zur Feststellung von Grund und Höhe dieser Leistungen noch nicht erbracht worden sind oder\nb) der zuständige Träger eine der in Satz 1 Nr. 1 bis 7 genannten Leistungen als nachrangig verpflichteter Leistungsträger nach § 104 des Zehnten Buches Sozialgesetzbuch erbringt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__7.html"
 },
 {
  "id": "wogg-7-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 7",
  "absatz": "Abs. 2",
  "titel": "Ausschluss vom Wohngeld",
  "text": "(2) Ausgeschlossen sind auch Haushaltsmitglieder, die keine Empfänger der in Absatz 1 Satz 1 genannten Leistungen sind und\n1. die in § 7 Absatz 3 des Zweiten Buches Sozialgesetzbuch, auch in den Fällen des Übergangs- oder Verletztengeldes nach Absatz 1 Satz 1 Nummer 3 und 4 genannt und deren Einkommen und Vermögen bei der Ermittlung der Leistungen eines anderen Haushaltsmitglieds nach Absatz 1 Satz 1 Nummer 1, 3 oder 4 berücksichtigt worden sind,\n2. deren Einkommen und Vermögen nach § 43 Absatz 1 Satz 2 des Zwölften Buches Sozialgesetzbuch bei der Ermittlung der Leistung eines anderen Haushaltsmitglieds nach Absatz 1 Satz 1 Nummer 5 berücksichtigt worden sind,\n3. deren Einkommen und Vermögen nach § 27 Absatz 2 Satz 2 oder 3 des Zwölften Buches Sozialgesetzbuch bei der Ermittlung der Leistung eines anderen Haushaltsmitglieds nach Absatz 1 Satz 1 Nummer 6 berücksichtigt worden sind,\n4. deren Einkommen und Vermögen nach § 93 des Vierzehnten Buches Sozialgesetzbuch in Verbindung mit § 27 Absatz 2 Satz 2 oder 3 des Zwölften Buches Sozialgesetzbuch bei der Ermittlung der Leistung eines anderen Haushaltsmitglieds nach Absatz 1 Satz 1 Nummer 7 berücksichtigt worden sind, oder\n5. deren Einkommen und Vermögen nach § 7 Absatz 1 des Asylbewerberleistungsgesetzes bei der Ermittlung der Leistung eines anderen Haushaltsmitglieds nach Absatz 1 Satz 1 Nummer 8 berücksichtigt worden sind.\nDer Ausschluss besteht nicht, wenn\n1. die Leistungen nach Absatz 1 Satz 1 und 2 ausschließlich als Darlehen gewährt werden oder\n2. die Voraussetzungen des Absatzes 1 Satz 3 Nr. 2 vorliegen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__7.html"
 },
 {
  "id": "wogg-7-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 7",
  "absatz": "Abs. 3",
  "titel": "Ausschluss vom Wohngeld",
  "text": "(3) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogg/__7.html"
 },
 {
  "id": "wogg-8-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 8",
  "absatz": "Abs. 1",
  "titel": "Dauer des Ausschlusses vom Wohngeld und Verzicht auf Leistungen",
  "text": "(1) Der Ausschluss vom Wohngeld besteht vorbehaltlich des § 7 Abs. 1 Satz 3 Nr. 2 und Abs. 2 Satz 2 Nr. 2 für die Dauer des Verwaltungsverfahrens zur Feststellung von Grund und Höhe der Leistungen nach § 7 Abs. 1. Der Ausschluss besteht vorbehaltlich des § 7 Abs. 1 Satz 3 Nr. 2 und Abs. 2 Satz 2 Nr. 2\n1. nach der Antragstellung auf eine Leistung nach § 7 Abs. 1 ab dem Ersten\na) des Monats, für den der Antrag gestellt worden ist, oder\nb) des nächsten Monats, wenn die Leistung nach § 7 Abs. 1 nicht vom Ersten eines Monats an beantragt wird,\n2. nach der Bewilligung einer Leistung nach § 7 Abs. 1 ab dem Ersten\na) des Monats, für den die Leistung nach § 7 Abs. 1 bewilligt wird, oder\nb) des nächsten Monats, wenn die Leistung nach § 7 Abs. 1 nicht vom Ersten eines Monats an bewilligt wird,\n3. bis zum Letzten\na) des Monats, wenn die Leistung nach § 7 Abs. 1 bis zum Letzten eines Monats bewilligt wird, oder\nb) des Vormonats, wenn die Leistung nach § 7 Abs. 1 nicht bis zum Letzten eines Monats bewilligt wird.\nDer Ausschluss gilt für den Zeitraum als nicht erfolgt, für den\n1. der Antrag auf eine Leistung nach § 7 Absatz 1 zurückgenommen wird,\n2. die Leistung nach § 7 Absatz 1 abgelehnt, versagt, entzogen oder ausschließlich als Darlehen gewährt wird,\n3. der Bewilligungsbescheid über eine Leistung nach § 7 Absatz 1 zurückgenommen oder aufgehoben wird,\n4. der Anspruch auf eine Leistung nach § 7 Absatz 1 nachträglich im Sinne des § 103 Absatz 1 des Zehnten Buches Sozialgesetzbuch ganz entfallen ist oder nach § 104 Absatz 1 oder 2 des Zehnten Buches Sozialgesetzbuch oder nach § 40a des Zweiten Buches Sozialgesetzbuch nachrangig ist oder\n5. die Leistung nach § 7 Absatz 1 nachträglich durch den Übergang eines Anspruchs in vollem Umfang erstattet wird.",
  "url": "https://www.gesetze-im-internet.de/wogg/__8.html"
 },
 {
  "id": "wogg-8-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 8",
  "absatz": "Abs. 2",
  "titel": "Dauer des Ausschlusses vom Wohngeld und Verzicht auf Leistungen",
  "text": "(2) Verzichten Haushaltsmitglieder auf die Leistungen nach § 7 Abs. 1, um Wohngeld zu beantragen, gilt ihr Ausschluss vom Zeitpunkt der Wirkung des Verzichts an als nicht erfolgt; § 46 Abs. 2 des Ersten Buches Sozialgesetzbuch ist in diesem Fall nicht anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__8.html"
 },
 {
  "id": "wogg-9-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 9",
  "absatz": "Abs. 1",
  "titel": "Miete",
  "text": "(1) Miete ist das vereinbarte Entgelt für die Gebrauchsüberlassung von Wohnraum auf Grund von Mietverträgen oder ähnlichen Nutzungsverhältnissen einschließlich Umlagen, Zuschlägen und Vergütungen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__9.html"
 },
 {
  "id": "wogg-9-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 9",
  "absatz": "Abs. 2",
  "titel": "Miete",
  "text": "(2) Bei der Ermittlung der Miete nach Absatz 1 bleiben folgende Kosten und Vergütungen außer Betracht:\n1. Heizkosten und Kosten für die Erwärmung von Wasser,\n2. Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser, soweit sie den in Nummer 1 bezeichneten Kosten entsprechen,\n3. die Kosten der Haushaltsenergie, soweit sie nicht von den Nummern 1 und 2 erfasst sind,\n4. Vergütungen für die Überlassung einer Garage sowie eines Stellplatzes für Kraftfahrzeuge,\n5. Vergütungen für Leistungen, die über die Gebrauchsüberlassung von Wohnraum hinausgehen, insbesondere für allgemeine Unterstützungsleistungen wie die Vermittlung von Pflege- oder Betreuungsleistungen, Leistungen der hauswirtschaftlichen Versorgung oder Notrufdienste.\nErgeben sich diese Beträge nicht aus dem Mietvertrag oder entsprechenden Unterlagen, sind Pauschbeträge abzusetzen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__9.html"
 },
 {
  "id": "wogg-9-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 9",
  "absatz": "Abs. 3",
  "titel": "Miete",
  "text": "(3) Im Fall des § 3 Abs. 1 Satz 2 Nr. 2 ist als Miete der Mietwert des Wohnraums zu Grunde zu legen. Im Fall des § 3 Abs. 1 Satz 2 Nr. 3 ist als Miete die Summe aus dem Höchstbetrag nach § 12 Absatz 1 und der Klimakomponente nach § 12 Absatz 7 zu Grunde zu legen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__9.html"
 },
 {
  "id": "wogg-10-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 10",
  "absatz": "Abs. 1",
  "titel": "Belastung",
  "text": "(1) Belastung sind die Kosten für den Kapitaldienst und die Bewirtschaftung von Wohnraum in vereinbarter oder festgesetzter Höhe.",
  "url": "https://www.gesetze-im-internet.de/wogg/__10.html"
 },
 {
  "id": "wogg-10-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 10",
  "absatz": "Abs. 2",
  "titel": "Belastung",
  "text": "(2) Die Belastung ist von der Wohngeldbehörde (§ 24 Abs. 1 Satz 1) in einer Wohngeld-Lastenberechnung zu ermitteln. Von einer vollständigen Wohngeld-Lastenberechnung kann abgesehen werden, wenn die auf den Wohnraum entfallende Belastung aus Zinsen und Tilgungen die Summe aus dem Höchstbetrag nach § 12 Absatz 1 und der Klimakomponente nach § 12 Absatz 7 erreicht oder übersteigt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__10.html"
 },
 {
  "id": "wogg-11-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 11",
  "absatz": "Abs. 1",
  "titel": "Zu berücksichtigende Miete und Belastung",
  "text": "(1) Die bei der Berechnung des Wohngeldes zu berücksichtigende Miete oder Belastung ist die Summe aus\n1. der Miete oder Belastung, die sich nach § 9 oder § 10 ergibt, soweit sie nicht nach Absatz 2 oder Absatz 3 in dieser Berechnungsreihenfolge außer Betracht bleibt, jedoch nur bis zur Höhe der Summe, die sich aus dem Höchstbetrag nach § 12 Absatz 1 und der Klimakomponente nach § 12 Absatz 7 ergibt, und\n2. dem Gesamtbetrag zur Entlastung bei den Heizkosten nach § 12 Absatz 6.\nIm Fall des § 3 Absatz 1 Satz 2 Nummer 3 ist die Summe aus dem Höchstbetrag nach § 12 Absatz 1, dem Gesamtbetrag zur Entlastung bei den Heizkosten nach § 12 Absatz 6 und der Klimakomponente nach § 12 Absatz 7 zu berücksichtigen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__11.html"
 },
 {
  "id": "wogg-11-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 11",
  "absatz": "Abs. 2",
  "titel": "Zu berücksichtigende Miete und Belastung",
  "text": "(2) Die Miete oder Belastung, die sich nach § 9 oder § 10 ergibt, bleibt in folgender Berechnungsreihenfolge und zu dem Anteil außer Betracht,\n1. der auf den Teil des Wohnraums entfällt, der ausschließlich gewerblich oder beruflich genutzt wird;\n2. der auf den Teil des Wohnraums entfällt, der einer Person, die kein Haushaltsmitglied ist, entgeltlich oder unentgeltlich zum Gebrauch überlassen ist; übersteigt das Entgelt für die Gebrauchsüberlassung die auf diesen Teil des Wohnraums entfallende Miete oder Belastung, ist das Entgelt in voller Höhe abzuziehen;\n3. der dem Anteil einer entgeltlich oder unentgeltlich mitbewohnenden Person, die kein Haushaltsmitglied ist, aber deren Mittelpunkt der Lebensbeziehungen der Wohnraum ist und die nicht selbst die Voraussetzungen des § 3 Abs. 1 oder Abs. 2 erfüllt, an der Gesamtzahl der Bewohner und Bewohnerinnen entspricht; übersteigt das Entgelt der mitbewohnenden Person die auf diese entfallende Miete oder Belastung, ist das Entgelt in voller Höhe abzuziehen;\n4. der durch Leistungen aus öffentlichen Haushalten oder Zweckvermögen, insbesondere Leistungen zur Wohnkostenentlastung nach dem Zweiten Wohnungsbaugesetz, dem Wohnraumförderungsgesetz oder entsprechenden Gesetzen der Länder, an den Mieter oder den selbst nutzenden Eigentümer zur Senkung der Miete oder Belastung gedeckt wird, soweit die Leistungen nicht von § 14 Abs. 2 Nr. 30 erfasst sind;\n5. der durch Leistungen einer nach § 68 des Aufenthaltsgesetzes verpflichteten Person gedeckt wird, die ein zu berücksichtigendes Haushaltsmitglied zur Bezahlung der Miete oder Aufbringung der Belastung erhält.",
  "url": "https://www.gesetze-im-internet.de/wogg/__11.html"
 },
 {
  "id": "wogg-11-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 11",
  "absatz": "Abs. 3",
  "titel": "Zu berücksichtigende Miete und Belastung",
  "text": "(3) Ist mindestens ein Haushaltsmitglied vom Wohngeld ausgeschlossen, ist nur der Anteil der Miete oder Belastung zu berücksichtigen, der dem Anteil der zu berücksichtigenden Haushaltsmitglieder an der Gesamtzahl der Haushaltsmitglieder entspricht. In diesem Fall sind nur der Anteil des Höchstbetrages nach § 12 Absatz 1, der Anteil des Gesamtbetrages zur Entlastung bei den Heizkosten nach § 12 Absatz 6 und der Anteil des Betrages der Klimakomponente nach § 12 Absatz 7 zu berücksichtigen, der jeweils dem Anteil der zu berücksichtigenden Haushaltsmitglieder an der Gesamtzahl der Haushaltsmitglieder entspricht. Für die Ermittlung des Höchstbetrages nach § 12 Absatz 1, des Gesamtbetrages zur Entlastung bei den Heizkosten nach § 12 Absatz 6 und des Betrages der Klimakomponente nach § 12 Absatz 7 ist jeweils die Gesamtzahl der Haushaltsmitglieder maßgebend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__11.html"
 },
 {
  "id": "wogg-12-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 1",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(1) Die monatlichen Höchstbeträge für Miete und Belastung sind vorbehaltlich des § 11 Absatz 3 nach der Anzahl der zu berücksichtigenden Haushaltsmitglieder und nach der Mietenstufe zu berücksichtigen. Sie ergeben sich aus Anlage 1.",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 2",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(2) Die Zugehörigkeit einer Gemeinde zu einer Mietenstufe richtet sich nach dem Mietenniveau von Wohnraum der Hauptmieter und Hauptmieterinnen sowie der gleichzustellenden zur mietähnlichen Nutzung berechtigten Personen, für den Mietzuschuss geleistet wird. Das Mietenniveau ist die durchschnittliche prozentuale Abweichung der Quadratmetermieten von Wohnraum in Gemeinden vom Durchschnitt der Quadratmetermieten des Wohnraums im Bundesgebiet. Zu berücksichtigen sind nur Quadratmetermieten von Wohnraum im Sinne des Satzes 1.",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 3",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(3) Das Mietenniveau ist vom Statistischen Bundesamt festzustellen für Gemeinden mit\n1. einer Einwohnerzahl von 10 000 und mehr gesondert,\n2. einer Einwohnerzahl von weniger als 10 000 und gemeindefreie Gebiete nach Kreisen zusammengefasst.\nMaßgebend für die Zuordnung nach Satz 1 ist die Einwohnerzahl, die auf der Grundlage von § 5 des Bevölkerungsstatistikgesetzes fortgeschrieben wurde.",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 4",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(4) Das Mietenniveau wird vom Statistischen Bundesamt bei einer Anpassung der Höchstbeträge nach Absatz 1 oder einer entsprechenden strukturellen Änderung der höchstens zu berücksichtigenden Miete oder Belastung auf der Grundlage von zwei aufeinanderfolgenden Ergebnissen der jährlichen Wohngeldstatistik für Dezember (§ 36 Absatz 1 Satz 2 Nummer 2) festgestellt. Es ist ein bundesweit einheitlicher Stichtag für die Ergebnisse der Bevölkerungsstatistik zu Grunde zu legen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs4a",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 4a",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(4a) Für die Gemeinden Baltrum, Borkum (Stadt), Juist, Langeoog, Norderney (Stadt), Spiekeroog, Wangerooge (Nordseebad), Nebel, Norddorf auf Amrum, Wittdün auf Amrum, Alkersum, Borgsum, Dunsum, Midlum, Nieblum, Oevenum, Oldsum, Süderende, Utersum, Witsum, Wrixum, Wyk auf Föhr (Stadt), Helgoland, Gröde, Hallig Hooge, Langeneß, Pellworm und Insel Hiddensee, die auf Inseln ohne Festlandanschluss liegen, wird ein gemeinsames Mietenniveau festgestellt. Sie erhalten eine eigene gemeinsame Mietenstufenzuordnung und für die Anlage zu § 1 Absatz 3 der Wohngeldverordnung die Bezeichnung Inseln ohne Festlandanschluss. Abweichend von Absatz 4 wird das Statistische Bundesamt nach den Absätzen 2 und 3 einmalig ausschließlich das gemeinsame Mietenniveau dieser Gemeinden und das jeweilige Mietenniveau der von dieser Änderung betroffenen Kreise vor der nächsten Anpassung der Höchstbeträge nach Absatz 1 feststellen. Diese Feststellung erfolgt auf der Grundlage der Ergebnisse der Wohngeldstatistiken für Dezember 2016 und Dezember 2017 (§ 36 Absatz 1 Satz 2 Nummer 2). Die Anlage zu § 1 Absatz 3 der Wohngeldverordnung kann vor der nächsten Anpassung der Höchstbeträge entsprechend angepasst werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 5",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(5) Den Mietenstufen nach Absatz 1 sind folgende Mietenniveaus zugeordnet:\nMietenstufe | Mietenniveau\nI | niedriger als minus 15 Prozent\nII | minus 15 Prozent bis\nniedriger als minus 5 Prozent\nIII | minus 5 Prozent bis\nniedriger als 5 Prozent\nIV | 5 Prozent bis\nniedriger als 15 Prozent\nV | 15 Prozent bis\nniedriger als 25 Prozent\nVI | 25 Prozent bis\nniedriger als 35 Prozent\nVII | 35 Prozent und höher",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 6",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(6) Der folgende monatliche Gesamtbetrag zur Entlastung bei den Heizkosten als Summe aus dem Betrag zur Entlastung bei den Heizkosten auf Grund der CO 2 -Bepreisung und dem Betrag der dauerhaften Heizkostenkomponente ist vorbehaltlich des § 11 Absatz 3 nach der Anzahl der zu berücksichtigenden Haushaltsmitglieder zu berücksichtigen:\nAnzahl\nder zu\nberücksichtigenden Haushaltsmit-\nglieder | Betrag zur Entlastung bei den Heizkosten auf Grund der CO 2 -Bepreisung in Euro | Betrag\nder dauerhaften Heiz-kostenkomponente in Euro | Gesamtbetrag zur Entlastung bei den Heizkosten in Euro\n1 | 14,40 | 96 | 110,40\n2 | 18,60 | 124 | 142,60\n3 | 22,20 | 148 | 170,20\n4 | 25,80 | 172 | 197,80\n5 | 29,40 | 196 | 225,40\nMehrbetrag\nfür jedes weitere\nzu berücksichtigende Haushaltsmitglied | 3,60 | 24 | 27,60",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-12-abs7",
  "gesetz": "WoGG",
  "paragraph": "§ 12",
  "absatz": "Abs. 7",
  "titel": "Höchstbeträge für Miete und Belastung sowie Entlastung bei den Heizkosten und die Klimakomponente",
  "text": "(7) Der folgende monatliche Betrag ist vorbehaltlich des § 11 Absatz 3 nach der Anzahl der zu berücksichtigenden Haushaltsmitglieder als Klimakomponente zu berücksichtigen:\nAnzahl der zu\nberücksichtigenden\nHaushaltsmitglieder | Als Klimakomponente\nzu berücksichtigender Zuschlag zu den\nHöchstbeträgen nach\n§ 12 Absatz 1 in Euro\n1 | 19,20\n2 | 24,80\n3 | 29,60\n4 | 34,40\n5 | 39,20\nMehrbetrag für jedes weitere zu berücksichtigende Haushaltsmitglied | 4,80",
  "url": "https://www.gesetze-im-internet.de/wogg/__12.html"
 },
 {
  "id": "wogg-13-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 13",
  "absatz": "Abs. 1",
  "titel": "Gesamteinkommen",
  "text": "(1) Das Gesamteinkommen ist die Summe der Jahreseinkommen (§ 14) der zu berücksichtigenden Haushaltsmitglieder abzüglich der Freibeträge (die §§ 17 und 17a) und der Abzugsbeträge für Unterhaltsleistungen (§ 18).",
  "url": "https://www.gesetze-im-internet.de/wogg/__13.html"
 },
 {
  "id": "wogg-13-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 13",
  "absatz": "Abs. 2",
  "titel": "Gesamteinkommen",
  "text": "(2) Das monatliche Gesamteinkommen ist ein Zwölftel des Gesamteinkommens.",
  "url": "https://www.gesetze-im-internet.de/wogg/__13.html"
 },
 {
  "id": "wogg-14-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 14",
  "absatz": "Abs. 1",
  "titel": "Jahreseinkommen",
  "text": "(1) Das Jahreseinkommen eines zu berücksichtigenden Haushaltsmitgliedes ist vorbehaltlich des Absatzes 3 die Summe der positiven Einkünfte im Sinne des § 2 Abs. 1 und 2 des Einkommensteuergesetzes zuzüglich der Einnahmen nach Absatz 2 abzüglich der Abzugsbeträge für Steuern und Sozialversicherungsbeiträge (§ 16). Bei den Einkünften im Sinne des § 2 Abs. 1 Satz 1 Nr. 1 bis 3 des Einkommensteuergesetzes ist § 7g Abs. 1 bis 4 und 7 des Einkommensteuergesetzes nicht anzuwenden. Von den Einkünften aus nichtselbständiger Arbeit, die nach dem Einkommensteuergesetz vom Arbeitgeber pauschal besteuert werden, zählen zum Jahreseinkommen nur\n1. die nach § 37b des Einkommensteuergesetzes pauschal besteuerten Sachzuwendungen und\n2. der nach § 40a des Einkommensteuergesetzes pauschal besteuerte Arbeitslohn und das pauschal besteuerte Arbeitsentgelt, jeweils abzüglich der Aufwendungen zu dessen Erwerbung, Sicherung oder Erhaltung, höchstens jedoch bis zur Höhe dieser Einnahmen.\nEin Ausgleich mit negativen Einkünften aus anderen Einkunftsarten oder mit negativen Einkünften des zusammenveranlagten Ehegatten ist nicht zulässig.",
  "url": "https://www.gesetze-im-internet.de/wogg/__14.html"
 },
 {
  "id": "wogg-14-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 14",
  "absatz": "Abs. 2",
  "titel": "Jahreseinkommen",
  "text": "(2) Zum Jahreseinkommen gehören:\n1. der nach § 19 Abs. 2 und § 22 Nr. 4 Satz 4 Buchstabe b des Einkommensteuergesetzes steuerfreie Betrag von Versorgungsbezügen;\n2. die einkommensabhängigen, nach § 3 Nr. 6 des Einkommensteuergesetzes steuerfreien Bezüge, die auf Grund gesetzlicher Vorschriften aus öffentlichen Mitteln versorgungshalber an Wehrdienstbeschädigte, im freiwilligen Wehrdienst Beschädigte, Zivildienstbeschädigte und im Bundesfreiwilligendienst Beschädigte oder ihre Hinterbliebenen, Kriegsbeschädigte und Kriegshinterbliebene sowie ihnen gleichgestellte Personen gezahlt werden;\n3. die den Ertragsanteil oder den der Besteuerung unterliegenden Anteil nach § 22 Nr. 1 Satz 3 Buchstabe a des Einkommensteuergesetzes übersteigenden Teile von Leibrenten sowie der nach § 3 Nummer 14a des Einkommensteuergesetzes steuerfreie Anteil der Rente aus der gesetzlichen Rentenversicherung, der auf Grund des Zuschlags an Entgeltpunkten für langjährige Versicherung nach dem Sechsten Buch Sozialgesetzbuch geleistet wird;\n4. die nach § 3 Nr. 3 des Einkommensteuergesetzes steuerfreien\na) Rentenabfindungen,\nb) Beitragserstattungen,\nc) Leistungen aus berufsständischen Versorgungseinrichtungen,\nd) Kapitalabfindungen,\ne) Ausgleichszahlungen;\n5. die nach § 3 Nr. 1 Buchstabe a des Einkommensteuergesetzes steuerfreien\na) Renten wegen Minderung der Erwerbsfähigkeit nach den §§ 56 bis 62 des Siebten Buches Sozialgesetzbuch,\nb) Renten und Beihilfen an Hinterbliebene nach den §§ 63 bis 71 des Siebten Buches Sozialgesetzbuch,\nc) Abfindungen nach den §§ 75 bis 80 des Siebten Buches Sozialgesetzbuch;\n6. die Lohn- und Einkommensersatzleistungen nach § 32b Absatz 1 Satz 1 Nummer 1 des Einkommensteuergesetzes; § 10 des Bundeselterngeld- und Elternzeitgesetzes bleibt unberührt;\n7. die ausländischen Einkünfte nach § 32b Absatz 1 Satz 1 Nummer 2 bis 5 sowie Satz 2 und 3 des Einkommensteuergesetzes;\n8. die Hälfte der nach § 3 Nr. 7 des Einkommensteuergesetzes steuerfreien\na) Unterhaltshilfe nach den §§ 261 bis 278a des Lastenausgleichsgesetzes,\nb) Beihilfe zum Lebensunterhalt nach den §§ 301 bis 301b des Lastenausgleichsgesetzes,\nc) Unterhaltshilfe nach § 44 und Unterhaltsbeihilfe nach § 45 des Reparationsschädengesetzes,\nd) Beihilfe zum Lebensunterhalt nach den §§ 10 bis 15 des Flüchtlingshilfegesetzes,\nmit Ausnahme der Pflegezulage nach § 269 Abs. 2 des Lastenausgleichsgesetzes;\n9. die nach § 3 Nr. 1 Buchstabe a des Einkommensteuergesetzes steuerfreien Krankentagegelder;\n10. die Hälfte der nach § 3 Nr. 68 des Einkommensteuergesetzes steuerfreien Renten nach § 3 Abs. 2 des Anti-D-Hilfegesetzes;\n11. die nach § 3b des Einkommensteuergesetzes steuerfreien Zuschläge für Sonntags-, Feiertags- oder Nachtarbeit;\n12. die nach § 3 Nummer 21 des Einkommensteuergesetzes steuerfreien Einnahmen;\n13. (weggefallen)\n14. die nach § 3 Nr. 56 des Einkommensteuergesetzes steuerfreien Zuwendungen des Arbeitgebers an eine Pensionskasse und die nach § 3 Nr. 63 des Einkommensteuergesetzes steuerfreien Beiträge des Arbeitgebers an einen Pensionsfonds, eine Pensionskasse oder für eine Direktversicherung zum Aufbau einer kapitalgedeckten betrieblichen Altersversorgung;\n15. der nach § 20 Abs. 9 des Einkommensteuergesetzes steuerfreie Betrag (Sparer-Pauschbetrag), soweit die Kapitalerträge 100 Euro übersteigen;\n16. die auf erhöhte Absetzungen entfallenden Beträge, soweit sie die höchstmöglichen Absetzungen für Abnutzung nach § 7 des Einkommensteuergesetzes übersteigen, und die auf Sonderabschreibungen entfallenden Beträge;\n17. der nach § 3 Nr. 27 des Einkommensteuergesetzes steuerfreie Grundbetrag der Produktionsaufgaberente und das Ausgleichsgeld nach dem Gesetz zur Förderung der Einstellung der landwirtschaftlichen Erwerbstätigkeit;\n18. die nach § 3 Nr. 60 des Einkommensteuergesetzes steuerfreien Leistungen aus öffentlichen Mitteln an Arbeitnehmer des Steinkohlen-, Pechkohlen- und Erzbergbaues, des Braunkohlentiefbaues und der Eisen- und Stahlindustrie aus Anlass von Stilllegungs-, Einschränkungs-, Umstellungs- oder Rationalisierungsmaßnahmen;\n19. die nach § 22 Nummer 1 Satz 2 des Einkommensteuergesetzes der Empfängerin oder dem Empfänger nicht zuzurechnenden Bezüge, die ihr oder ihm von einer natürlichen Person, die kein Haushaltsmitglied ist, oder von einer juristischen Person gewährt werden, mit Ausnahme der Bezüge\na) bis zu einer Höhe von 6 540 Euro jährlich, die für eine Pflegeperson oder Pflegekraft aufgewendet werden, die die Empfängerin oder den Empfänger wegen ihrer oder seiner Pflegebedürftigkeit im Sinne des § 14 des Elften Buches Sozialgesetzbuch pflegt, oder\nb) bis zu einer Höhe von insgesamt 480 Euro jährlich von einer natürlichen Person, die gegenüber der Empfängerin oder dem Empfänger nicht vorrangig gesetzlich unterhaltsverpflichtet ist oder war, oder von einer juristischen Person;\ndies gilt entsprechend, wenn anstelle von wiederkehrenden Unterhaltsleistungen Unterhaltsleistungen als Einmalbetrag gewährt werden;\n20.\na) die Unterhaltsleistungen des geschiedenen oder dauernd getrennt lebenden Ehegatten, mit Ausnahme der Unterhaltsleistungen bis zu einer Höhe von 6 540 Euro jährlich, die für eine Pflegeperson oder Pflegekraft geleistet werden, die den Empfänger oder die Empfängerin wegen eigener Pflegebedürftigkeit im Sinne des § 14 des Elften Buches Sozialgesetzbuch pflegt,\nb) die Versorgungsleistungen, die Leistungen auf Grund eines schuldrechtlichen Versorgungsausgleichs und Ausgleichsleistungen zur Vermeidung eines Versorgungsausgleichs,\nsoweit diese Leistungen nicht von § 22 Nummer 1a des Einkommensteuergesetzes erfasst sind;\n21. die Leistungen nach dem Unterhaltsvorschussgesetz;\n22. die Leistungen von natürlichen Personen, die keine Haushaltsmitglieder sind, zur Bezahlung der Miete oder Aufbringung der Belastung, soweit die Leistungen nicht von Absatz 1 Satz 1 oder Satz 3, von Nummer 19 oder Nummer 20 erfasst sind;\n23. (weggefallen)\n24. die Hälfte der Pauschale für die laufenden Leistungen für den notwendigen Unterhalt ohne die Kosten der Erziehung von Kindern, Jugendlichen oder jungen Volljährigen nach § 39 Abs. 1 in Verbindung mit § 33 oder mit § 35a Abs. 2 Nr. 3, auch in Verbindung mit § 41 Abs. 2 des Achten Buches Sozialgesetzbuch, als Einkommen des Kindes, Jugendlichen oder jungen Volljährigen;\n25. die Hälfte der Pauschale für die laufenden Leistungen für die Kosten der Erziehung von Kindern, Jugendlichen oder jungen Volljährigen nach § 39 Abs. 1 in Verbindung mit § 33 oder mit § 35a Abs. 2 Nr. 3, auch in Verbindung mit § 41 Abs. 2 des Achten Buches Sozialgesetzbuch, als Einkommen der Pflegeperson;\n26. die Hälfte der nach § 3 Nr. 36 des Einkommensteuergesetzes steuerfreien Einnahmen für Leistungen zu körperbezogenen Pflegemaßnahmen, pflegerischen Betreuungsmaßnahmen oder Hilfen bei der Haushaltsführung einer Person, die kein Haushaltsmitglied ist;\n27. die Hälfte der als Zuschüsse erbrachten\na) Leistungen zur Förderung der Ausbildung nach dem Bundesausbildungsförderungsgesetz, mit Ausnahme der Leistungen nach § 14a des Bundesausbildungsförderungsgesetzes in Verbindung mit den §§ 6 und 7 der Verordnung über Zusatzleistungen in Härtefällen nach dem Bundesausbildungsförderungsgesetz und mit Ausnahme des Kinderbetreuungszuschlages nach Maßgabe des § 14b des Bundesausbildungsförderungsgesetzes,\nb) Leistungen der Begabtenförderungswerke, soweit sie nicht von Nummer 28 erfasst sind,\nc) Stipendien, soweit sie nicht von Buchstabe b, Nummer 28 oder Nummer 29 erfasst sind,\nd) Berufsausbildungsbeihilfen und des Ausbildungsgeldes nach dem Dritten Buch Sozialgesetzbuch,\ne) Beiträge zur Deckung des Unterhaltsbedarfs nach dem Aufstiegsfortbildungsförderungsgesetz,\nf) Leistungen zur Sicherung des Lebensunterhaltes während des ausbildungsbegleitenden Praktikums oder der betrieblichen Berufsausbildung bei Teilnahme am Sonderprogramm Förderung der beruflichen Mobilität von ausbildungsinteressierten Jugendlichen und arbeitslosen jungen Fachkräften aus Europa;\n28. die als Zuschuss gewährte Graduiertenförderung;\n29. die Hälfte der nach § 3 Nr. 42 des Einkommensteuergesetzes steuerfreien Zuwendungen, die auf Grund des Fulbright-Abkommens gezahlt werden;\n30. die wiederkehrenden Leistungen nach § 7 Absatz 1 Satz 1 Nummer 1 bis 9, auch wenn bei deren Berechnung die Kosten der Unterkunft nicht berücksichtigt worden sind, mit Ausnahme\na) der darin enthaltenen Kosten der Unterkunft, wenn diese nicht für den Wohnraum gewährt werden, für den Wohngeld beantragt wurde,\nb) der von Nummer 24 oder Nummer 25 erfassten Leistungen,\nc) des Grundsicherungsgeldes nach § 19 Absatz 1 Satz 2 des Zweiten Buches Sozialgesetzbuch, das ein zu berücksichtigendes Kind als Mitglied der Bedarfsgemeinschaft im Haushalt des getrennt lebenden anderen Elternteils anteilig erhält,\nd) der Hilfe zum Lebensunterhalt, die ein nach dem Dritten Kapitel des Zwölften Buches Sozialgesetzbuch leistungsberechtigtes Kind im Haushalt des getrennt lebenden Elternteils anteilig erhält, oder\ne) der Leistungen, die in den Fällen des § 7 Absatz 1 Satz 3 oder Absatz 2 Satz 2 erbracht werden, in denen kein Ausschluss vom Wohngeld besteht;\n31. der Mietwert des von den in § 3 Abs. 1 Satz 2 Nr. 2 genannten Personen selbst genutzten Wohnraums.",
  "url": "https://www.gesetze-im-internet.de/wogg/__14.html"
 },
 {
  "id": "wogg-14-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 14",
  "absatz": "Abs. 3",
  "titel": "Jahreseinkommen",
  "text": "(3) Zum Jahreseinkommen gehören nicht:\n1. Einkünfte aus Vermietung oder Verpachtung eines Teils des Wohnraums, für den Wohngeld beantragt wird;\n2. das Entgelt, das eine den Wohnraum mitbewohnende Person im Sinne des § 11 Abs. 2 Nr. 3 hierfür zahlt;\n3. Leistungen einer nach § 68 des Aufenthaltsgesetzes verpflichteten Person, soweit sie von § 11 Abs. 2 Nr. 5 erfasst sind.",
  "url": "https://www.gesetze-im-internet.de/wogg/__14.html"
 },
 {
  "id": "wogg-15-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 15",
  "absatz": "Abs. 1",
  "titel": "Ermittlung des Jahreseinkommens",
  "text": "(1) Bei der Ermittlung des Jahreseinkommens ist das Einkommen zu Grunde zu legen, das im Zeitpunkt der Antragstellung im Bewilligungszeitraum zu erwarten ist. Hierzu können die Verhältnisse vor dem Zeitpunkt der Antragstellung herangezogen werden; § 24 Abs. 2 bleibt unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__15.html"
 },
 {
  "id": "wogg-15-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 15",
  "absatz": "Abs. 2",
  "titel": "Ermittlung des Jahreseinkommens",
  "text": "(2) Einmaliges Einkommen, das für einen bestimmten Zeitraum bezogen wird, ist diesem Zeitraum zuzurechnen. Ist kein Zurechnungszeitraum festgelegt oder vereinbart, so ist das einmalige Einkommen zu einem Zwölftel in den zwölf Monaten nach dem Zuflussmonat zuzurechnen. Ist das einmalige Einkommen vor der Antragstellung zugeflossen, ist es nur dann nach Satz 1 oder Satz 2 zuzurechnen, wenn es innerhalb von einem Jahr vor der Antragstellung zugeflossen ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__15.html"
 },
 {
  "id": "wogg-15-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 15",
  "absatz": "Abs. 3",
  "titel": "Ermittlung des Jahreseinkommens",
  "text": "(3) Sonderzuwendungen, Gratifikationen und gleichartige Bezüge und Vorteile, die in größeren als monatlichen Abständen gewährt werden, sind den im Bewilligungszeitraum liegenden Monaten zu je einem Zwölftel zuzurechnen, wenn sie in den nächsten zwölf Monaten nach Beginn des Bewilligungszeitraums zufließen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__15.html"
 },
 {
  "id": "wogg-15-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 15",
  "absatz": "Abs. 4",
  "titel": "Ermittlung des Jahreseinkommens",
  "text": "(4) Beträgt der Bewilligungszeitraum nicht zwölf Monate, ist als Einkommen das Zwölffache des im Sinne der Absätze 1 bis 3 und des § 24 Abs. 2 im Bewilligungszeitraum zu erwartenden durchschnittlichen monatlichen Einkommens zu Grunde zu legen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__15.html"
 },
 {
  "id": "wogg-16",
  "gesetz": "WoGG",
  "paragraph": "§ 16",
  "titel": "Abzugsbeträge für Steuern und Sozialversicherungsbeiträge",
  "text": "Bei der Ermittlung des Jahreseinkommens sind von dem Betrag, der sich nach den §§ 14 und 15 ergibt, jeweils 10 Prozent abzuziehen, wenn zu erwarten ist, dass im Bewilligungszeitraum die folgenden Steuern und Pflichtbeiträge zu leisten sind:\n1. Steuern vom Einkommen,\n2. Pflichtbeiträge zur gesetzlichen Kranken- und Pflegeversicherung,\n3. Pflichtbeiträge zur gesetzlichen Rentenversicherung.\nSatz 1 Nummer 2 und 3 gilt entsprechend, wenn keine Pflichtbeiträge, aber laufende Beiträge zu öffentlichen oder privaten Versicherungen oder ähnlichen Einrichtungen zu leisten sind, die dem Zweck der Pflichtbeiträge nach Satz 1 Nummer 2 oder Nummer 3 entsprechen. Satz 2 gilt auch, wenn die Beiträge zu Gunsten eines zu berücksichtigenden Haushaltsmitgliedes zu leisten sind. Die Sätze 2 und 3 gelten nicht, wenn eine im Wesentlichen beitragsfreie Sicherung oder eine Sicherung besteht, für die Beiträge von Dritten zu leisten sind. Die Sätze 1 und 2 gelten bei einmaligem Einkommen im Sinne des § 15 Absatz 2 in jedem Jahr der Zurechnung entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__16.html"
 },
 {
  "id": "wogg-17",
  "gesetz": "WoGG",
  "paragraph": "§ 17",
  "titel": "Freibeträge",
  "text": "Bei der Ermittlung des Gesamteinkommens sind die folgenden jährlichen Freibeträge abzuziehen:\n1. 1 800 Euro für jedes schwerbehinderte zu berücksichtigende Haushaltsmitglied mit einem Grad der Behinderung\na) von 100 oder\nb) von unter 100 bei Pflegebedürftigkeit im Sinne des § 14 des Elften Buches Sozialgesetzbuch und gleichzeitiger häuslicher oder teilstationärer Pflege oder Kurzzeitpflege;\n2. 750 Euro für jedes zu berücksichtigende Haushaltsmitglied, das Opfer der nationalsozialistischen Verfolgung oder ihm im Sinne des Bundesentschädigungsgesetzes gleichgestellt ist;\n3. 1 320 Euro, wenn\na) ein zu berücksichtigendes Haushaltsmitglied ausschließlich mit einem Kind oder mehreren Kindern Wohnraum gemeinsam bewohnt und\nb) mindestens eines dieser Kinder noch nicht 18 Jahre alt ist und für dieses Kindergeld nach dem Einkommensteuergesetz oder dem Bundeskindergeldgesetz oder eine in § 65 Absatz 1 Satz 1 des Einkommensteuergesetzes genannte Leistung gewährt wird;\n4. ein Betrag in Höhe der eigenen Einnahmen aus Erwerbstätigkeit jedes Kindes eines Haushaltsmitgliedes, höchstens jedoch 1 200 Euro, wenn das Kind ein zu berücksichtigendes Haushaltsmitglied und noch nicht 25 Jahre alt ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__17.html"
 },
 {
  "id": "wogg-17a-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 17a",
  "absatz": "Abs. 1",
  "titel": "Freibetrag für zu berücksichtigende Haushaltsmitglieder mit Grundrentenzeiten oder entsprechenden Zeiten aus anderweitigen Alterssicherungssystemen",
  "text": "(1) Für jedes zu berücksichtigende Haushaltsmitglied, das mindestens 33 Jahre an Grundrentenzeiten nach § 76g Absatz 2 des Sechsten Buches Sozialgesetzbuch erreicht hat, ist bei der Ermittlung des Gesamteinkommens ein jährlicher Freibetrag abzuziehen. Dieser beträgt 1 200 Euro vom jährlichen Einkommen aus der gesetzlichen Rente zuzüglich 30 Prozent des diesen Betrag übersteigenden jährlichen Einkommens aus der gesetzlichen Rente, höchstens jedoch ein mit zwölf zu multiplizierender Betrag in Höhe von 50 Prozent der Regelbedarfsstufe 1 nach der Anlage zu § 28 des Zwölften Buches Sozialgesetzbuch.",
  "url": "https://www.gesetze-im-internet.de/wogg/__17a.html"
 },
 {
  "id": "wogg-17a-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 17a",
  "absatz": "Abs. 2",
  "titel": "Freibetrag für zu berücksichtigende Haushaltsmitglieder mit Grundrentenzeiten oder entsprechenden Zeiten aus anderweitigen Alterssicherungssystemen",
  "text": "(2) Absatz 1 gilt entsprechend für zu berücksichtigende Haushaltsmitglieder, die mindestens 33 Jahre an Grundrentenzeiten vergleichbaren Zeiten in\n1. einer Versicherungspflicht nach § 1 des Gesetzes über die Alterssicherung der Landwirte,\n2. einer Beschäftigung, in der Versicherungsfreiheit nach § 5 Absatz 1 oder Befreiung von der Versicherungspflicht nach § 6 Absatz 1 Satz 1 Nummer 2 des Sechsten Buches Sozialgesetzbuch bestand, oder\n3. einer Versicherungspflicht in einer Versicherungs- oder Versorgungseinrichtung, die für Angehörige bestimmter Berufe errichtet ist,\nerreicht haben. Absatz 1 gilt auch, wenn die 33 Jahre durch die Zusammenrechnung der Zeiten nach Satz 1 Nummer 1 bis 3 und der Grundrentenzeiten nach § 76g Absatz 2 des Sechsten Buches Sozialgesetzbuch erfüllt werden. Je Kalendermonat wird eine Grundrentenzeit oder eine nach Satz 1 vergleichbare Zeit angerechnet.",
  "url": "https://www.gesetze-im-internet.de/wogg/__17a.html"
 },
 {
  "id": "wogg-17a-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 17a",
  "absatz": "Abs. 3",
  "titel": "Freibetrag für zu berücksichtigende Haushaltsmitglieder mit Grundrentenzeiten oder entsprechenden Zeiten aus anderweitigen Alterssicherungssystemen",
  "text": "(3) Ist Wohngeld vor dem 1. Januar 2021 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2020, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom 1. Januar 2021 neu zu entscheiden, wenn die Wohngeldbehörde erstmals durch eine Mitteilung des Rentenversicherungsträgers oder der sich aus Absatz 2 Satz 1 ergebenden Träger davon Kenntnis erlangt, dass die Voraussetzungen nach Absatz 1 Satz 1 oder Absatz 2 Satz 1 oder 2 im Zeitraum ab dem 1. Januar 2021 vorliegen. Die Entscheidung nach Satz 1 folgt der Entscheidung nach § 42c Absatz 1 nach. Die Wohngeldbehörde entscheidet über Wohngeldleistungen ohne Berücksichtigung eines möglichen Freibetrages nach Absatz 1 oder 2, solange sie nicht durch eine Mitteilung des Rentenversicherungsträgers oder der sich aus Absatz 2 Satz 1 ergebenden Träger Kenntnis davon hat, dass die Voraussetzungen nach Absatz 1 Satz 1 oder Absatz 2 Satz 1 oder 2 vorliegen. Sie entscheidet von Amts wegen neu, wenn sie erstmals Kenntnis davon erlangt, dass die Voraussetzungen nach Absatz 1 Satz 1 oder Absatz 2 Satz 1 oder 2 vorliegen. Der Zeitpunkt der Kenntnis der Wohngeldbehörde nach Satz 1 oder 4 gilt als Zeitpunkt der Antragstellung im Sinne des § 24 Absatz 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__17a.html"
 },
 {
  "id": "wogg-17a-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 17a",
  "absatz": "Abs. 4",
  "titel": "Freibetrag für zu berücksichtigende Haushaltsmitglieder mit Grundrentenzeiten oder entsprechenden Zeiten aus anderweitigen Alterssicherungssystemen",
  "text": "(4) Wurde der Freibetrag bei der Wohngeldbewilligung bereits berücksichtigt, so werden im laufenden Bewilligungszeitraum Änderungen der Höhe des Freibetrages nach Absatz 1 oder 2 nur unter den Voraussetzungen des § 27 berücksichtigt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__17a.html"
 },
 {
  "id": "wogg-18",
  "gesetz": "WoGG",
  "paragraph": "§ 18",
  "titel": "Abzugsbeträge für Unterhaltsleistungen",
  "text": "Bei der Ermittlung des Gesamteinkommens sind die folgenden zu erwartenden Aufwendungen zur Erfüllung gesetzlicher Unterhaltsverpflichtungen abzuziehen:\n1. bis zu 3 000 Euro jährlich für ein zu berücksichtigendes Haushaltsmitglied, das wegen Berufsausbildung auswärts wohnt, soweit es nicht von Nummer 2 erfasst ist;\n2. bis zu 3 000 Euro jährlich für ein Kind, das Haushaltsmitglied nach § 5 Absatz 4 ist; dies gilt nur für Aufwendungen, die an das Kind als Haushaltsmitglied bei dem anderen Elternteil geleistet werden;\n3. bis zu 6 000 Euro jährlich für einen früheren oder dauernd getrennt lebenden Ehegatten oder Lebenspartner oder eine frühere oder dauernd getrennt lebende Lebenspartnerin, der oder die kein Haushaltsmitglied ist;\n4. bis zu 3 000 Euro jährlich für eine sonstige Person, die kein Haushaltsmitglied ist.\nLiegt in den Fällen des Satzes 1 eine notariell beurkundete Unterhaltsvereinbarung, ein Unterhaltstitel oder ein Bescheid vor, sind die jährlichen Aufwendungen bis zu dem darin festgelegten Betrag abzuziehen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__18.html"
 },
 {
  "id": "wogg-19-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 19",
  "absatz": "Abs. 1",
  "titel": "Höhe des Wohngeldes",
  "text": "(1) Das ungerundete monatliche Wohngeld für bis zu zwölf zu berücksichtigende Haushaltsmitglieder beträgt\n1,15 · (M – (a + b · M + c · Y) · Y) Euro. „M“ ist die zu berücksichtigende monatliche Miete oder Belastung in Euro. „Y“ ist das monatliche Gesamteinkommen in Euro. „a“, „b“ und „c“ sind nach der Anzahl der zu berücksichtigenden Haushaltsmitglieder unterschiedene Werte und ergeben sich aus der Anlage 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__19.html"
 },
 {
  "id": "wogg-19-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 19",
  "absatz": "Abs. 2",
  "titel": "Höhe des Wohngeldes",
  "text": "(2) Die zur Berechnung des Wohngeldes erforderlichen Rechenschritte und Rundungen sind in der Reihenfolge auszuführen, die sich aus der Anlage 3 ergibt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__19.html"
 },
 {
  "id": "wogg-19-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 19",
  "absatz": "Abs. 3",
  "titel": "Höhe des Wohngeldes",
  "text": "(3) Sind mehr als zwölf Haushaltsmitglieder zu berücksichtigen, erhöht sich für das 13. und jedes weitere zu berücksichtigende Haushaltsmitglied das nach den Absätzen 1 und 2 berechnete monatliche Wohngeld um jeweils 65 Euro, höchstens jedoch bis zur Höhe der zu berücksichtigenden Miete oder Belastung.",
  "url": "https://www.gesetze-im-internet.de/wogg/__19.html"
 },
 {
  "id": "wogg-20-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 20",
  "absatz": "Abs. 1",
  "titel": "Gesetzeskonkurrenz",
  "text": "(1) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogg/__20.html"
 },
 {
  "id": "wogg-20-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 20",
  "absatz": "Abs. 2",
  "titel": "Gesetzeskonkurrenz",
  "text": "(2) Es besteht kein Wohngeldanspruch, wenn allen Haushaltsmitgliedern eine der folgenden Leistungen dem Grunde nach zusteht oder im Fall ihres Antrages dem Grunde nach zustünde:\n1. Leistungen zur Förderung der Ausbildung nach dem Bundesausbildungsförderungsgesetz,\n2. Leistungen nach den §§ 56, 116 Absatz 3 oder 4 oder § 122 des Dritten Buches Sozialgesetzbuch oder\n3. Leistungen zur Sicherung des Lebensunterhaltes während des ausbildungsbegleitenden Praktikums oder der betrieblichen Berufsausbildung bei Teilnahme am Sonderprogramm Förderung der beruflichen Mobilität von ausbildungsinteressierten Jugendlichen und arbeitslosen jungen Fachkräften aus Europa.\nSatz 1 gilt auch, wenn dem Grunde nach Förderungsberechtigte der Höhe nach keinen Anspruch auf Förderung haben. Satz 1 gilt nicht, wenn die Leistungen ausschließlich als Darlehen gewährt werden. Ist Wohngeld für einen Zeitraum bewilligt, in den der Beginn der Ausbildung fällt, ist das Wohngeld bis zum Ablauf des Bewilligungszeitraums in gleicher Höhe weiterzuleisten; § 27 Abs. 2 und § 28 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__20.html"
 },
 {
  "id": "wogg-21",
  "gesetz": "WoGG",
  "paragraph": "§ 21",
  "titel": "Sonstige Gründe",
  "text": "Ein Wohngeldanspruch besteht nicht,\n1. wenn das Wohngeld weniger als 10 Euro monatlich betragen würde,\n2. wenn alle Haushaltsmitglieder nach den §§ 7 und 8 Abs. 1 vom Wohngeld ausgeschlossen sind oder\n3. soweit die Inanspruchnahme missbräuchlich wäre, insbesondere wegen erheblichen Vermögens.",
  "url": "https://www.gesetze-im-internet.de/wogg/__21.html"
 },
 {
  "id": "wogg-22-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 22",
  "absatz": "Abs. 1",
  "titel": "Wohngeldantrag",
  "text": "(1) Wohngeld wird nur auf Antrag der wohngeldberechtigten Person geleistet.",
  "url": "https://www.gesetze-im-internet.de/wogg/__22.html"
 },
 {
  "id": "wogg-22-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 22",
  "absatz": "Abs. 2",
  "titel": "Wohngeldantrag",
  "text": "(2) Im Fall des § 3 Abs. 3 wird vermutet, dass die antragstellende Person von den anderen Haushaltsmitgliedern als wohngeldberechtigte Person bestimmt ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__22.html"
 },
 {
  "id": "wogg-22-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 22",
  "absatz": "Abs. 3",
  "titel": "Wohngeldantrag",
  "text": "(3) Zieht die wohngeldberechtigte Person aus oder stirbt sie, kann der Antrag nach § 27 Abs. 1 auch von einem anderen Haushaltsmitglied gestellt werden, das die Voraussetzungen des § 3 Abs. 1 oder Abs. 2 erfüllt. § 3 Abs. 3 bis 5 gilt entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__22.html"
 },
 {
  "id": "wogg-22-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 22",
  "absatz": "Abs. 4",
  "titel": "Wohngeldantrag",
  "text": "(4) Wird ein Wohngeldantrag für die Zeit nach dem laufenden Bewilligungszeitraum früher als zwei Monate vor Ablauf dieses Zeitraums gestellt, gilt der Erste des zweiten Monats vor Ablauf dieses Zeitraums als Zeitpunkt der Antragstellung im Sinne des § 24 Abs. 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__22.html"
 },
 {
  "id": "wogg-22-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 22",
  "absatz": "Abs. 5",
  "titel": "Wohngeldantrag",
  "text": "(5) § 65a des Ersten und § 115 des Zehnten Buches Sozialgesetzbuch sind nicht anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__22.html"
 },
 {
  "id": "wogg-23-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 23",
  "absatz": "Abs. 1",
  "titel": "Auskunftspflicht",
  "text": "(1) Soweit die Durchführung dieses Gesetzes es erfordert, sind folgende Personen verpflichtet, auf Verlangen der Wohngeldbehörde Auskunft über ihre für das Wohngeld maßgebenden Verhältnisse zu geben:\n1. die Haushaltsmitglieder,\n2. die sonstigen Personen, die mit der wohngeldberechtigten Person den Wohnraum gemeinsam bewohnen, und\n3. bei einer Prüfung nach § 21 Nr. 3 zur Feststellung eines Unterhaltsanspruchs auch\na) der Ehegatte, der Lebenspartner oder die Lebenspartnerin,\nb) der frühere Ehegatte, der frühere Lebenspartner oder die frühere Lebenspartnerin,\nc) die Kinder der zu berücksichtigenden Haushaltsmitglieder und\nd) die Eltern der zu berücksichtigenden Haushaltsmitglieder,\ndie keine Haushaltsmitglieder sind.\nDie Haushaltsmitglieder sind verpflichtet, ihr Geschlecht anzugeben (§ 33 Abs. 3 Satz 1 Nr. 6 und § 35 Abs. 1 Nr. 5). Die wohngeldberechtigte Person hat im Wohngeldantrag nach § 22 und im Antrag nach § 27 Absatz 1 alle Tatsachen anzugeben, die für die Leistung erheblich sind.",
  "url": "https://www.gesetze-im-internet.de/wogg/__23.html"
 },
 {
  "id": "wogg-23-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 23",
  "absatz": "Abs. 2",
  "titel": "Auskunftspflicht",
  "text": "(2) Soweit die Durchführung dieses Gesetzes es erfordert, sind die Arbeitgeber der zu berücksichtigenden Haushaltsmitglieder verpflichtet, auf Verlangen der Wohngeldbehörde über Art und Dauer des Arbeitsverhältnisses sowie über Arbeitsstätte und Arbeitsverdienst Auskunft zu geben.",
  "url": "https://www.gesetze-im-internet.de/wogg/__23.html"
 },
 {
  "id": "wogg-23-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 23",
  "absatz": "Abs. 3",
  "titel": "Auskunftspflicht",
  "text": "(3) Der Empfänger oder die Empfängerin der Miete ist verpflichtet, auf Verlangen der Wohngeldbehörde über die Höhe und Zusammensetzung der Miete sowie über andere das Miet- oder Nutzungsverhältnis betreffende Umstände Auskunft zu geben, soweit die Durchführung dieses Gesetzes es erfordert.",
  "url": "https://www.gesetze-im-internet.de/wogg/__23.html"
 },
 {
  "id": "wogg-23-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 23",
  "absatz": "Abs. 4",
  "titel": "Auskunftspflicht",
  "text": "(4) Zur Aufdeckung rechtswidriger Inanspruchnahme von Wohngeld sind die Kapitalerträge auszahlenden Stellen, denen ein zu berücksichtigendes Haushaltsmitglied einen Freistellungsauftrag für Kapitalerträge erteilt hat, verpflichtet, der Wohngeldbehörde Auskunft über die Höhe der zugeflossenen Kapitalerträge zu erteilen. § 21 Absatz 3 Satz 4 des Zehnten Buches Sozialgesetzbuch gilt entsprechend. Ein Auskunftsersuchen der Wohngeldbehörde ist nur zulässig, wenn auf Grund eines Datenabgleichs nach § 33 der Verdacht besteht oder feststeht, dass Wohngeld rechtswidrig in Anspruch genommen wurde oder wird und dass das zu berücksichtigende Haushaltsmitglied, auch soweit es dazu berechtigt ist, nicht oder nicht vollständig bei der Ermittlung der Kapitalerträge mitwirkt. Die Auslagen für Auskünfte von Kapitalerträge auszahlenden Stellen, die durch die Ermittlung der rechtswidrigen Inanspruchnahme von Wohngeld entstanden sind, sollen abweichend von § 64 Absatz 1 des Zehnten Buches Sozialgesetzbuch von der Person, die Wohngeld zu erstatten hat, erhoben werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__23.html"
 },
 {
  "id": "wogg-23-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 23",
  "absatz": "Abs. 5",
  "titel": "Auskunftspflicht",
  "text": "(5) Auf die nach den Absätzen 1 bis 3 Auskunftspflichtigen sind die §§ 60 und 65 Abs. 1 und 3 des Ersten Buches Sozialgesetzbuch entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__23.html"
 },
 {
  "id": "wogg-24-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 24",
  "absatz": "Abs. 1",
  "titel": "Wohngeldbehörde und Entscheidung",
  "text": "(1) Zuständig für die Durchführung dieses Gesetzes sind die nach Landesrecht zuständigen Stellen. Die Landesregierung kann diese Befugnis nach Satz 1 auf die für die Ausführung des Wohngeldgesetzes zuständige oberste Landesbehörde übertragen. Die nach Satz 1 bestimmte Stelle ist eine Wohngeldbehörde im Sinne dieses Gesetzes. § 69 des Ersten Buches Sozialgesetzbuch bleibt unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__24.html"
 },
 {
  "id": "wogg-24-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 24",
  "absatz": "Abs. 2",
  "titel": "Wohngeldbehörde und Entscheidung",
  "text": "(2) Die Entscheidung über den Wohngeldantrag ist durch die Wohngeldbehörde schriftlich zu erlassen. Der Entscheidung sind die Verhältnisse im Bewilligungszeitraum, die im Zeitpunkt der Antragstellung zu erwarten sind, zu Grunde zu legen. Treten nach dem Zeitpunkt der Antragstellung bis zur Bekanntgabe des Wohngeldbescheides Änderungen der Verhältnisse im Bewilligungszeitraum ein, sind sie grundsätzlich nicht zu berücksichtigen; Änderungen im Sinne des § 27 Absatz 1 und 2 oder § 28 Absatz 1 bis 3 sollen berücksichtigt werden. Satz 3 gilt für nach dem Zeitpunkt der Antragstellung bis zur Bekanntgabe des Wohngeldbescheides zu erwartende Änderungen entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__24.html"
 },
 {
  "id": "wogg-24-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 24",
  "absatz": "Abs. 3",
  "titel": "Wohngeldbehörde und Entscheidung",
  "text": "(3) Der Bewilligungsbescheid muss die in § 27 Abs. 3 Satz 1 Nr. 2 und 3 genannten Beträge ausweisen und einen Hinweis über die Mitteilungspflichten nach § 27 Abs. 3 und 4 sowie § 28 Abs. 1 Satz 2 und Abs. 4 Satz 1 enthalten. Er soll einen Hinweis enthalten, dass der Wohngeldantrag für die Zeit nach Ablauf des Bewilligungszeitraums wiederholt werden kann und dass eine Neuentscheidung von Amts wegen mit der Folge des Wohngeldwegfalles oder eines verringerten Wohngeldes auch dann möglich ist, wenn keine Mitteilungspflicht besteht.",
  "url": "https://www.gesetze-im-internet.de/wogg/__24.html"
 },
 {
  "id": "wogg-24-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 24",
  "absatz": "Abs. 4",
  "titel": "Wohngeldbehörde und Entscheidung",
  "text": "(4) Erzielt mindestens eines der zu berücksichtigenden Haushaltsmitglieder Einkünfte aus selbständiger Arbeit, aus Gewerbebetrieb oder aus Land- und Forstwirtschaft, so kann der Wohngeldbewilligungsbescheid mit der Auflage verbunden werden, dass die Einkommensteuerbescheide, die den Zeitraum der Wohngeldbewilligung betreffen, unverzüglich der Wohngeldbehörde zur Prüfung, ob ein Fall des § 27 Absatz 2 Satz 1 Nummer 3 vorliegt, vorzulegen sind.",
  "url": "https://www.gesetze-im-internet.de/wogg/__24.html"
 },
 {
  "id": "wogg-24-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 24",
  "absatz": "Abs. 5",
  "titel": "Wohngeldbehörde und Entscheidung",
  "text": "(5) Wenn infolge des Umzugs der wohngeldberechtigten Person eine andere Wohngeldbehörde zuständig wird, bleibt abweichend von § 44 Absatz 3 des Zehnten Buches Sozialgesetzbuch die Wohngeldbehörde, die den Wohngeldbescheid erlassen hat, zuständig für\n1. die Aufhebung eines Wohngeldbescheides,\n2. die Rückforderung des zu erstattenden Wohngeldes sowie\n3. die Unterrichtung und den Hinweis nach § 28 Absatz 5.",
  "url": "https://www.gesetze-im-internet.de/wogg/__24.html"
 },
 {
  "id": "wogg-25-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 25",
  "absatz": "Abs. 1",
  "titel": "Bewilligungszeitraum",
  "text": "(1) Das Wohngeld soll für zwölf Monate bewilligt werden. Der Bewilligungszeitraum kann unter Berücksichtigung der zu erwartenden maßgeblichen Verhältnisse verkürzt, geteilt oder bei voraussichtlich gleichbleibenden Verhältnissen auf bis zu 24 Monate verlängert werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__25.html"
 },
 {
  "id": "wogg-25-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 25",
  "absatz": "Abs. 2",
  "titel": "Bewilligungszeitraum",
  "text": "(2) Der Bewilligungszeitraum beginnt am Ersten des Monats, in dem der Wohngeldantrag gestellt worden ist. Treten die Voraussetzungen für die Bewilligung des Wohngeldes erst in einem späteren Monat ein, beginnt der Bewilligungszeitraum am Ersten dieses Monats.",
  "url": "https://www.gesetze-im-internet.de/wogg/__25.html"
 },
 {
  "id": "wogg-25-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 25",
  "absatz": "Abs. 3",
  "titel": "Bewilligungszeitraum",
  "text": "(3) Der Bewilligungszeitraum beginnt am Ersten des Monats, von dem ab Leistungen im Sinne des § 7 Abs. 1 abgelehnt worden sind, wenn der Wohngeldantrag vor Ablauf des Kalendermonats gestellt wird, der auf die Kenntnis der Ablehnung folgt. Dies gilt entsprechend, wenn der Ausschluss nach § 8 Abs. 1 Satz 3 oder Abs. 2 als nicht erfolgt gilt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__25.html"
 },
 {
  "id": "wogg-25-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 25",
  "absatz": "Abs. 4",
  "titel": "Bewilligungszeitraum",
  "text": "(4) Ist ein Wohngeldbewilligungsbescheid nach § 28 Absatz 3 unwirksam geworden, beginnt der Wohngeldbewilligungszeitraum abweichend von § 25 Absatz 3 Satz 1 frühestens am Ersten des Monats, von dem an die Unwirksamkeit des Wohngeldbewilligungsbescheides eingetreten ist; dies gilt nur unter der Voraussetzung, dass der Wohngeldantrag vor Ablauf des Kalendermonats gestellt wird, der\n1. auf die Kenntnis der Ablehnung einer Leistung nach § 7 Absatz 1 folgt oder\n2. auf die Kenntnis von der Unwirksamkeit des Wohngeldbewilligungsbescheides folgt, wenn nur ein Teil der zu berücksichtigenden Haushaltsmitglieder nach § 7 vom Wohngeld ausgeschlossen ist.\nDer Ablehnung einer Leistung nach § 7 Absatz 1 im Sinne des § 25 Absatz 4 Satz 1 Nummer 1 stehen die Fälle des § 8 Absatz 1 Satz 3 und Absatz 2 gleich. Wird eine Leistung nach § 7 Absatz 1 rückwirkend für alle zu berücksichtigenden Haushaltsmitglieder und nur für einen Teil des bisherigen Wohngeldbewilligungszeitraums gewährt, beginnt der neue Wohngeldbewilligungszeitraum am Ersten des Monats, von dem an die Leistung nach § 7 Absatz 1 nicht mehr gewährt wird; dies gilt nur unter der Voraussetzung, dass der Wohngeldantrag vor Ablauf des Kalendermonats gestellt wird, der auf die Kenntnis von dem Ende des Bewilligungszeitraums einer Leistung nach § 7 Absatz 1 folgt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__25.html"
 },
 {
  "id": "wogg-25-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 25",
  "absatz": "Abs. 5",
  "titel": "Bewilligungszeitraum",
  "text": "(5) Der neue Bewilligungszeitraum im Fall des § 27 Abs. 1 Satz 2 beginnt am Ersten des Monats, von dem an die erhöhte Miete oder Belastung rückwirkend berücksichtigt wird, wenn der Antrag vor Ablauf des Kalendermonats gestellt wird, der auf die Kenntnis von der Erhöhung der Miete oder Belastung folgt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__25.html"
 },
 {
  "id": "wogg-26-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 26",
  "absatz": "Abs. 1",
  "titel": "Zahlung des Wohngeldes",
  "text": "(1) Das Wohngeld ist an die wohngeldberechtigte Person zu zahlen. Es kann mit schriftlicher Einwilligung der wohngeldberechtigten Person oder, wenn dies im Einzelfall geboten ist, auch ohne deren Einwilligung, an ein anderes Haushaltsmitglied, an den Empfänger oder die Empfängerin der Miete oder in den Fällen des § 3 Abs. 1 Satz 2 Nr. 3 an den Leistungsträger im Sinne des § 12 des Ersten Buches Sozialgesetzbuch gezahlt werden. Wird das Wohngeld nach Satz 2 gezahlt, ist die wohngeldberechtigte Person hiervon zu unterrichten.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26.html"
 },
 {
  "id": "wogg-26-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 26",
  "absatz": "Abs. 2",
  "titel": "Zahlung des Wohngeldes",
  "text": "(2) Das Wohngeld ist monatlich im Voraus auf ein Konto eines Haushaltsmitgliedes bei einem Geldinstitut, für das die Verordnung (EU) Nr. 260/2012 des Europäischen Parlaments und des Rates vom 14. März 2012 zur Festlegung der technischen Vorschriften und der Geschäftsanforderungen für Überweisungen und Lastschriften in Euro und zur Änderung der Verordnung (EG) Nr. 924/2009 (ABl. L 94 vom 30.3.2012, S. 22), die zuletzt durch die Verordnung (EU) 2024/886 (ABl. L, 2024/886, 19.3.2024) geändert worden ist, gilt (Geldinstitut), zu zahlen. Ist ein solches Konto nicht vorhanden, kann das Wohngeld an den Wohnsitz der wohngeldberechtigten Person übermittelt werden; die dadurch veranlassten Kosten sollen vom Wohngeld abgezogen werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26.html"
 },
 {
  "id": "wogg-26a-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 26a",
  "absatz": "Abs. 1",
  "titel": "Vorläufige Zahlung des Wohngeldes",
  "text": "(1) Eine vorläufige Zahlung des Wohngeldes kann erfolgen, wenn zur Feststellung des Wohngeldanspruchs voraussichtlich längere Zeit erforderlich ist und mit hinreichender Wahrscheinlichkeit ein Anspruch auf Wohngeld besteht. Grundlage der vorläufigen Zahlung sind ausschließlich die für das Wohngeld maßgeblichen Berechnungsgrößen nach § 4.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26a.html"
 },
 {
  "id": "wogg-26a-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 26a",
  "absatz": "Abs. 2",
  "titel": "Vorläufige Zahlung des Wohngeldes",
  "text": "(2) Die Entscheidung über die vorläufige Zahlung des Wohngeldes steht unter dem Vorbehalt der endgültigen Entscheidung über Wohngeld. Der Bewilligungsbescheid muss den Hinweis enthalten, dass die Zahlung unter Vorbehalt der endgültigen Entscheidung über Wohngeld und der möglichen Rückforderung von zu viel gezahltem Wohngeld erfolgt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26a.html"
 },
 {
  "id": "wogg-26a-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 26a",
  "absatz": "Abs. 3",
  "titel": "Vorläufige Zahlung des Wohngeldes",
  "text": "(3) Die endgültige Entscheidung über Wohngeld kann auch im Zusammenhang mit der Entscheidung über einen Weiterleistungsantrag erfolgen. Der Zeitpunkt der Antragstellung für die vorläufige Zahlung gilt auch als Zeitpunkt der Antragstellung für die endgültige Entscheidung über Wohngeld. Über den Wohngeldanspruch ist endgültig zu entscheiden, sofern die vorläufige Entscheidung nicht der endgültigen Entscheidung entspricht. Ergeht innerhalb eines Jahres nach Ablauf des Bewilligungszeitraums keine endgültige Entscheidung, gilt eine vorläufig bewilligte Zahlung als endgültig festgesetzt. Dies gilt nicht, wenn die wohngeldberechtigte Person innerhalb der Frist nach Satz 4 eine endgültige Entscheidung beantragt oder wenn die Wohngeldbehörde Kenntnis von Tatsachen erlangt, dass der Wohngeldanspruch nicht oder nur in geringerer Höhe als die vorläufige Zahlung besteht und sie über den Wohngeldanspruch innerhalb eines Jahres seit Kenntniserlangung von diesen Tatsachen, spätestens aber nach Ablauf von zehn Jahren nach der Bekanntgabe der vorläufigen Zahlung, endgültig entscheidet.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26a.html"
 },
 {
  "id": "wogg-26a-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 26a",
  "absatz": "Abs. 4",
  "titel": "Vorläufige Zahlung des Wohngeldes",
  "text": "(4) Das vorläufig gezahlte Wohngeld ist auf das endgültig zu leistende Wohngeld anzurechnen. Übersteigt das vorläufig gezahlte das endgültig zu leistende Wohngeld, so ist der übersteigende Betrag zu erstatten. § 30a gilt entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__26a.html"
 },
 {
  "id": "wogg-27-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 27",
  "absatz": "Abs. 1",
  "titel": "Änderung des Wohngeldes",
  "text": "(1) Das Wohngeld ist auf Antrag neu zu bewilligen, wenn sich im laufenden Bewilligungszeitraum\n1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder erhöht,\n2. die zu berücksichtigende Miete oder Belastung abzüglich des Gesamtbetrages zur Entlastung bei den Heizkosten um mehr als 10 Prozent erhöht oder\n3. das Gesamteinkommen um mehr als 10 Prozent verringert\nund sich dadurch das Wohngeld erhöht. Im Fall des Satzes 1 Nr. 2 ist das Wohngeld auch rückwirkend zu bewilligen, frühestens jedoch ab Beginn des laufenden Bewilligungszeitraums, wenn sich die zu berücksichtigende Miete oder Belastung abzüglich des Gesamtbetrages zur Entlastung bei den Heizkosten rückwirkend um mehr als 10 Prozent erhöht hat. Satz 1 Nr. 3 ist auch anzuwenden, wenn sich das Gesamteinkommen um mehr als 10 Prozent verringert, weil sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder verringert hat.",
  "url": "https://www.gesetze-im-internet.de/wogg/__27.html"
 },
 {
  "id": "wogg-27-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 27",
  "absatz": "Abs. 2",
  "titel": "Änderung des Wohngeldes",
  "text": "(2) Über die Leistung des Wohngeldes ist von Amts wegen mit Wirkung ab dem Zeitpunkt der Änderung der Verhältnisse unter Aufhebung des Bewilligungsbescheides neu zu entscheiden, wenn sich im laufenden Bewilligungszeitraum nicht nur vorübergehend\n1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder auf mindestens ein zu berücksichtigendes Haushaltsmitglied verringert; § 6 Abs. 2 bleibt unberührt,\n2. die zu berücksichtigende Miete oder Belastung abzüglich des Gesamtbetrages zur Entlastung bei den Heizkosten um mehr als 15 Prozent verringert; § 6 Abs. 2 bleibt unberührt, oder\n3. das Gesamteinkommen um mehr als 15 Prozent erhöht\nund dadurch das Wohngeld wegfällt oder sich verringert. Als Zeitpunkt der Änderung der Verhältnisse gilt im Fall des Satzes 1 Nr. 1 der Tag nach dem Auszug, im Fall des Satzes 1 Nr. 2 der Beginn des Zeitraums, für den sich die zu berücksichtigende Miete oder Belastung abzüglich des Gesamtbetrages zur Entlastung bei den Heizkosten um mehr als 15 Prozent verringert, und im Fall des Satzes 1 Nr. 3 der Beginn des Zeitraums, für den das erhöhte Einkommen bezogen wird, das zu einer Erhöhung des Gesamteinkommens um mehr als 15 Prozent führt. Tritt die Änderung der Verhältnisse nicht zum Ersten eines Monats ein, ist mit Wirkung vom Ersten des nächsten Monats an zu entscheiden. Satz 1 Nr. 3 ist auch anzuwenden, wenn sich das Gesamteinkommen um mehr als 15 Prozent erhöht, weil sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder erhöht hat. Als Zeitpunkt der Antragstellung im Sinne des § 24 Abs. 2 gilt der Zeitpunkt der Kenntnis der Wohngeldbehörde von den geänderten Verhältnissen. Eine Neuentscheidung von Amts wegen muss innerhalb eines Jahres, nachdem die Wohngeldbehörde von der Änderung der Verhältnisse Kenntnis erlangt hat, erfolgen. Die Neuentscheidung ist unabhängig vom Bestehen einer Mitteilungspflicht.",
  "url": "https://www.gesetze-im-internet.de/wogg/__27.html"
 },
 {
  "id": "wogg-27-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 27",
  "absatz": "Abs. 3",
  "titel": "Änderung des Wohngeldes",
  "text": "(3) Die wohngeldberechtigte Person muss der Wohngeldbehörde unverzüglich mitteilen, wenn sich im laufenden Bewilligungszeitraum nicht nur vorübergehend\n1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder (§ 6 Abs. 1) auf mindestens ein zu berücksichtigendes Haushaltsmitglied verringert oder die Anzahl der vom Wohngeld ausgeschlossenen Haushaltsmitglieder (§§ 7 und 8 Abs. 1) erhöht,\n2. die monatliche Miete (§ 9) oder die monatliche Belastung (§ 10) um mehr als 15 Prozent gegenüber der im Bewilligungsbescheid genannten Miete oder Belastung verringert oder\n3. die Summe aus den monatlichen positiven Einkünften nach § 14 Abs. 1 und den monatlichen Einnahmen nach § 14 Abs. 2 aller zu berücksichtigenden Haushaltsmitglieder um mehr als 15 Prozent gegenüber dem im Bewilligungsbescheid genannten Betrag erhöht; dies gilt auch, wenn sich der Betrag um mehr als 15 Prozent erhöht, weil sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder erhöht hat.\nDie zu berücksichtigenden Haushaltsmitglieder sind verpflichtet, der wohngeldberechtigten Person Änderungen ihrer monatlichen positiven Einkünfte nach § 14 Abs. 1 und ihrer monatlichen Einnahmen nach § 14 Abs. 2 mitzuteilen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__27.html"
 },
 {
  "id": "wogg-27-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 27",
  "absatz": "Abs. 4",
  "titel": "Änderung des Wohngeldes",
  "text": "(4) Die Absätze 2 und 3 gelten entsprechend, wenn sich die Änderungen nach Absatz 2 Satz 1 und 4 und Absatz 3 Satz 1 auf einen abgelaufenen Bewilligungszeitraum beziehen. Werden die Änderungen erst nach Ablauf des Bewilligungszeitraums bekannt und wirken sie auf einen oder mehrere abgelaufene Bewilligungszeiträume zurück, so ist eine Entscheidung nach Absatz 2 längstens für die drei Jahre, bevor die wohngeldberechtigte Person oder die zu berücksichtigenden Haushaltsmitglieder von der Änderung der Verhältnisse Kenntnis erlangt haben, zulässig; der Kenntnis steht die Nichtkenntnis infolge grober Fahrlässigkeit gleich. Hat die wohngeldberechtigte Person eine Änderung nach Absatz 2 Satz 1 und 4 im laufenden Bewilligungszeitraum nicht mitgeteilt und erhält die Wohngeldbehörde daher erst nach Ablauf des Bewilligungszeitraums von der Änderung Kenntnis, so ist eine Entscheidung nach Absatz 2 längstens für zehn Jahre seit Änderung der Verhältnisse zulässig.",
  "url": "https://www.gesetze-im-internet.de/wogg/__27.html"
 },
 {
  "id": "wogg-28-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 1",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(1) Der Bewilligungsbescheid wird vom Ersten des Monats an unwirksam, in dem der Wohnraum, für den Wohngeld bewilligt ist, von keinem zu berücksichtigenden Haushaltsmitglied mehr genutzt wird; erfolgt die Nutzungsaufgabe nicht zum Ersten eines Monats, wird der Bewilligungsbescheid vom Ersten des nächsten Monats an unwirksam. Die wohngeldberechtigte Person muss der Wohngeldbehörde unverzüglich mitteilen, dass der Wohnraum nicht mehr genutzt wird. Der Wechsel des Wohnraums innerhalb desselben Heimes im Sinne des Heimgesetzes oder entsprechender Gesetze der Länder gilt nicht als Nutzungsaufgabe.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-28-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 2",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(2) Der Wohngeldanspruch fällt für den Monat weg, in dem das Wohngeld vollständig oder überwiegend nicht zur Bezahlung der Miete oder zur Aufbringung der Belastung verwendet wird (zweckwidrige Verwendung). Der Bewilligungsbescheid ist mit Wirkung vom Ersten des Monats der zweckwidrigen Verwendung an aufzuheben, wenn seine Bekanntgabe nicht länger als zehn Jahre und die Kenntnis der Wohngeldbehörde von der zweckwidrigen Verwendung nicht länger als ein Jahr zurückliegt. Die Sätze 1 und 2 gelten nicht, soweit der Wohngeldanspruch Gegenstand einer Aufrechnung, Verrechnung oder Pfändung nach den §§ 51, 52 und 54 des Ersten Buches Sozialgesetzbuch ist oder auf einen Leistungsträger im Sinne des § 12 des Ersten Buches Sozialgesetzbuch übergegangen ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-28-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 3",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(3) Der Bewilligungsbescheid wird von dem Zeitpunkt an unwirksam, ab dem ein zu berücksichtigendes Haushaltsmitglied nach den §§ 7 und 8 Abs. 1 vom Wohngeld ausgeschlossen ist. Im Fall des § 8 Abs. 1 Satz 3 bleibt der Bewilligungsbescheid unwirksam.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-28-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 4",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(4) Die wohngeldberechtigte Person muss der Wohngeldbehörde unverzüglich mitteilen, wenn für ein zu berücksichtigendes Haushaltsmitglied ein Verwaltungsverfahren zur Feststellung von Grund und Höhe einer Leistung nach § 7 Abs. 1 oder Abs. 2 begonnen hat oder ein zu berücksichtigendes Haushaltsmitglied eine Leistung nach § 7 Abs. 1 empfängt. Die zu berücksichtigenden Haushaltsmitglieder sind verpflichtet, der wohngeldberechtigten Person die in Satz 1 genannten Tatsachen mitzuteilen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-28-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 5",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(5) Die wohngeldberechtigte Person ist von der Unwirksamkeit des Bewilligungsbescheides zu unterrichten und im Fall des Absatzes 3 auf die Antragsfrist nach § 25 Absatz 4 hinzuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-28-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 28",
  "absatz": "Abs. 6",
  "titel": "Unwirksamkeit des Bewilligungsbescheides und Wegfall des Wohngeldanspruchs",
  "text": "(6) Der Wohngeldanspruch ändert sich nur wegen der in § 17a Absatz 3, § 27, den vorstehenden Absätzen 1 bis 3, § 42a oder der in den §§ 42b bis 44 genannten Umstände.",
  "url": "https://www.gesetze-im-internet.de/wogg/__28.html"
 },
 {
  "id": "wogg-29-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 29",
  "absatz": "Abs. 1",
  "titel": "Haftung, Aufrechnung, Verrechnung und vorläufige Zahlungseinstellung",
  "text": "(1) Ist Wohngeld nach § 50 des Zehnten Buches Sozialgesetzbuch zu erstatten, haften neben der wohngeldberechtigten Person die volljährigen und bei der Berechnung des Wohngeldes berücksichtigten Haushaltsmitglieder als Gesamtschuldner.",
  "url": "https://www.gesetze-im-internet.de/wogg/__29.html"
 },
 {
  "id": "wogg-29-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 29",
  "absatz": "Abs. 2",
  "titel": "Haftung, Aufrechnung, Verrechnung und vorläufige Zahlungseinstellung",
  "text": "(2) Die Wohngeldbehörde kann mit Ansprüchen auf Erstattung zu Unrecht erbrachten Wohngeldes abweichend von § 51 Abs. 2 des Ersten Buches Sozialgesetzbuch gegen Wohngeldansprüche statt bis zu deren Hälfte in voller Höhe aufrechnen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__29.html"
 },
 {
  "id": "wogg-29-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 29",
  "absatz": "Abs. 3",
  "titel": "Haftung, Aufrechnung, Verrechnung und vorläufige Zahlungseinstellung",
  "text": "(3) Die Wohngeldbehörde kann Ansprüche eines anderen Leistungsträgers abweichend von § 52 des Ersten Buches Sozialgesetzbuch mit der ihr obliegenden Wohngeldleistung verrechnen, soweit nach Absatz 2 die Aufrechnung zulässig ist.",
  "url": "https://www.gesetze-im-internet.de/wogg/__29.html"
 },
 {
  "id": "wogg-29-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 29",
  "absatz": "Abs. 4",
  "titel": "Haftung, Aufrechnung, Verrechnung und vorläufige Zahlungseinstellung",
  "text": "(4) Die Wohngeldbehörde kann die Zahlung des Wohngeldes ohne Erlass eines Bescheides vorläufig ganz oder teilweise einstellen, wenn sie Kenntnis von Tatsachen erhält, die die Annahme rechtfertigen, dass\n1. der Bewilligungsbescheid bei Erlass rechtswidrig war und die wohngeldberechtigte Person sich nach § 45 Absatz 2 Satz 3 des Zehnten Buches Sozialgesetzbuch nicht auf Vertrauensschutz berufen kann oder\n2. die Voraussetzungen des § 27 Absatz 2, auch in Verbindung mit Absatz 4 oder § 28 Absatz 1 bis 3, vorliegen.\nSoweit die Kenntnis nicht auf Angaben der wohngeldberechtigten Person beruht, sind dieser unverzüglich die vorläufige Einstellung der Wohngeldzahlung sowie die dafür maßgeblichen Gründe mitzuteilen und ist ihr Gelegenheit zu geben, sich zu äußern. Die Wohngeldbehörde hat eine vorläufig eingestellte Wohngeldleistung unverzüglich nachzuzahlen, wenn nicht entweder der Bewilligungsbescheid, aus dem sich der Anspruch ergibt, zwei Monate nach der Einstellung der Zahlung mit Wirkung für die Vergangenheit aufgehoben oder nachträglich die Unwirksamkeit des Bewilligungsbescheides festgestellt worden ist. Satz 3 gilt nicht, wenn die Wohngeldleistung zwischenzeitlich nach Maßgabe des § 66 des Ersten Buches Sozialgesetzbuch entzogen wurde.",
  "url": "https://www.gesetze-im-internet.de/wogg/__29.html"
 },
 {
  "id": "wogg-30-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 30",
  "absatz": "Abs. 1",
  "titel": "Rücküberweisung und Erstattung im Todesfall",
  "text": "(1) Wird der Bewilligungsbescheid nach § 28 Abs. 1 Satz 1 auf Grund eines Todesfalles unwirksam, gilt Wohngeld, das für die Zeit nach dem Tod des zu berücksichtigenden Haushaltsmitgliedes auf ein Konto bei einem Geldinstitut überwiesen wurde, als unter Vorbehalt geleistet. Das Geldinstitut muss es der überweisenden Behörde oder der Wohngeldbehörde zurücküberweisen, wenn diese es als zu Unrecht geleistet zurückfordert. Eine Verpflichtung zur Rücküberweisung besteht nicht, soweit\n1. über den entsprechenden Betrag bei Eingang der Rückforderung bereits anderweitig verfügt worden ist, es sei denn, die Rücküberweisung kann aus einem Guthaben erfolgen, oder\n2. die Wohngeldbehörde das Wohngeld an den Empfänger oder die Empfängerin der Miete überwiesen hat.\nDas Geldinstitut darf den nach Satz 1 überwiesenen Betrag nicht zur Befriedigung eigener Forderungen verwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__30.html"
 },
 {
  "id": "wogg-30-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 30",
  "absatz": "Abs. 2",
  "titel": "Rücküberweisung und Erstattung im Todesfall",
  "text": "(2) Wird der Bewilligungsbescheid nach § 28 Abs. 1 Satz 1 auf Grund eines Todesfalles unwirksam und ist Wohngeld weiterhin geleistet worden, sind mit Ausnahme des Empfängers oder der Empfängerin der Miete folgende Personen verpflichtet, der Wohngeldbehörde den entsprechenden Betrag zu erstatten:\n1. Personen, die das Wohngeld unmittelbar in Empfang genommen haben,\n2. Personen, auf deren Konto der entsprechende Betrag durch ein bankübliches Zahlungsgeschäft weitergeleitet wurde, und\n3. Personen, die über den entsprechenden Betrag verfügungsberechtigt sind und ein bankübliches Zahlungsgeschäft zu Lasten des Kontos vorgenommen oder zugelassen haben.\nDer Erstattungsanspruch ist durch Verwaltungsakt geltend zu machen. Ein Geldinstitut, das eine Rücküberweisung mit dem Hinweis abgelehnt hat, dass über den entsprechenden Betrag bereits anderweitig verfügt wurde, muss der überweisenden Behörde oder der Wohngeldbehörde auf Verlangen Name und Anschrift der in Satz 1 Nr. 2 und 3 genannten Personen und etwaiger neuer Kontoinhaber oder Kontoinhaberinnen benennen. Ein Anspruch nach § 50 des Zehnten Buches Sozialgesetzbuch bleibt unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__30.html"
 },
 {
  "id": "wogg-30-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 30",
  "absatz": "Abs. 3",
  "titel": "Rücküberweisung und Erstattung im Todesfall",
  "text": "(3) Der Rücküberweisungs- und der Erstattungsanspruch verjähren in vier Jahren nach Ablauf des Kalenderjahres, in dem die Wohngeldbehörde Kenntnis von der Überzahlung erlangt hat.",
  "url": "https://www.gesetze-im-internet.de/wogg/__30.html"
 },
 {
  "id": "wogg-30a",
  "gesetz": "WoGG",
  "paragraph": "§ 30a",
  "titel": "Bagatellgrenze bei Rückforderungen",
  "text": "Zur Erprobung einer Bagatellgrenze wird nach Aufhebung der Bewilligung oder Feststellung der Unwirksamkeit eines Wohngeldbescheides durch die Wohngeldbehörde bis zu einer Höhe von 50 Euro von einer Erstattung überzahlten Wohngeldes abgesehen. Dies gilt auch in Fällen einer Aufrechnung oder Verrechnung. Die Erprobung dauert bis zum 31. Dezember 2024.",
  "url": "https://www.gesetze-im-internet.de/wogg/__30a.html"
 },
 {
  "id": "wogg-31",
  "gesetz": "WoGG",
  "paragraph": "§ 31",
  "titel": "Rücknahme eines rechtswidrigen nicht begünstigenden Wohngeldbescheides",
  "text": "Wird ein rechtswidriger nicht begünstigender Wohngeldbescheid mit Wirkung für die Vergangenheit zurückgenommen, muss die Wohngeldbehörde längstens für zwei Jahre vor der Rücknahme Wohngeld leisten. Im Übrigen bleibt § 44 des Zehnten Buches Sozialgesetzbuch unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__31.html"
 },
 {
  "id": "wogg-32",
  "gesetz": "WoGG",
  "paragraph": "§ 32",
  "titel": "Erstattung des Wohngeldes durch den Bund",
  "text": "Wohngeld nach diesem Gesetz, das von einem Land gezahlt worden ist, ist diesem zur Hälfte vom Bund zu erstatten.",
  "url": "https://www.gesetze-im-internet.de/wogg/__32.html"
 },
 {
  "id": "wogg-33-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 1",
  "titel": "Datenabgleich",
  "text": "(1) Die Wohngeldbehörde ist verpflichtet, auf Verlangen\n1. der zuständigen Behörde für die Erhebung der Ausgleichszahlung nach dem Gesetz über den Abbau der Fehlsubventionierung im Wohnungswesen und den hierzu erlassenen landesrechtlichen Vorschriften und\n2. der jeweils zuständigen Behörde nach entsprechenden Gesetzen der Länder\ndiesen Behörden mitzuteilen, ob der betroffene Wohnungsinhaber Wohngeld erhält. Maßgebend hierfür ist der Zeitraum, der zwischen dem Zeitpunkt nach § 3 Abs. 2 des Gesetzes über den Abbau der Fehlsubventionierung im Wohnungswesen und den hierzu erlassenen landesrechtlichen Vorschriften oder nach entsprechenden Gesetzen der Länder und der Erteilung des Bescheides über die Ausgleichszahlung liegt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs1a",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 1a",
  "titel": "Datenabgleich",
  "text": "(1a) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 2",
  "titel": "Datenabgleich",
  "text": "(2) Die Wohngeldbehörde darf, um die rechtswidrige Inanspruchnahme von Wohngeld zu vermeiden oder aufzudecken, die Haushaltsmitglieder regelmäßig durch einen Datenabgleich daraufhin überprüfen,\n1. ob und für welche Zeiträume Leistungen nach § 7 Abs. 1 beantragt oder empfangen werden oder wurden oder ein Ausschlussgrund nach § 7 Abs. 2, Abs. 3 oder § 8 Abs. 1 vorliegt oder vorlag,\n2. ob und welche Daten nach § 45d Abs. 1 und § 45e des Einkommensteuergesetzes, insbesondere zu der Höhe von Kapitalerträgen, für die ein Freistellungsauftrag erteilt worden ist, dem Bundeszentralamt für Steuern übermittelt worden sind,\n3. ob und für welche Zeiträume bereits Wohngeld beantragt oder empfangen wird oder wurde,\n4. ob und von welchem Zeitpunkt an die Bundesagentur für Arbeit die Leistung von Arbeitslosengeld eingestellt hat,\n5. ob, mit welchem Wohnungsstatus und von welchem Zeitpunkt an ein Haushaltsmitglied unter der Anschrift der Wohnung, für die Wohngeld beantragt wird oder geleistet wird oder wurde, bei der Meldebehörde gemeldet ist oder nicht mehr gemeldet ist und unter welcher neuen Anschrift es gemeldet ist,\n6. ob, für welche Zeiträume und bei welchem Arbeitgeber eine Versicherungspflicht im Sinne des § 2 Abs. 1 des Vierten Buches Sozialgesetzbuch oder eine geringfügige Beschäftigung besteht oder bestand und entsprechende Daten an die Datenstelle der Rentenversicherung (Datenstelle) und die Minijob-Zentrale der Deutschen Rentenversicherung Knappschaft-Bahn-See übermittelt worden sind,\n7. ob, in welcher Höhe und für welche Zeiträume Leistungen der Renten- und Unfallversicherungen durch die Deutsche Post AG oder die Deutsche Rentenversicherung Knappschaft-Bahn-See gezahlt worden sind.\nRichtet sich eine Überprüfung auf einen abgelaufenen Bewilligungszeitraum, ist diese bis zum Ablauf von zehn Jahren nach Bekanntgabe des zugehörigen Bewilligungsbescheides zulässig.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 3",
  "titel": "Datenabgleich",
  "text": "(3) Zur Durchführung des Datenabgleichs dürfen nur\n1. Familienname, Vornamen unter Kennzeichnung des gebräuchlichen Vornamens, Geburtsname,\n2. Geburtsdatum, Geburtsort,\n3. Anschrift der Wohnung, für die Wohngeld beantragt oder bewilligt wurde,\n4. Tatsache des Wohngeldantrages und des Wohngeldempfangs,\n5. Zeitraum des Wohngeldempfangs und\n6. Geschlecht\nan die in Absatz 1 Satz 1 und Absatz 2 Satz 1 Nr. 2, 4, 6 und 7 genannten und die für die Leistungen nach Absatz 2 Satz 1 Nummer 1 und 3 zuständigen Stellen sowie an die Meldebehörden übermittelt werden. Die Daten, die der Wohngeldbehörde oder der sonst nach Landesrecht für den Datenabgleich zuständigen oder von der Landesregierung durch Rechtsverordnung oder auf sonstige Weise für den Datenabgleich bestimmten Stelle (zentralen Landesstelle) übermittelt werden, dürfen nur für den Zweck der Überprüfung nach den Absätzen 1 und 2 genutzt werden. Die übermittelten Daten, bei denen die Überprüfung zu keinen abweichenden Feststellungen führt, sind unverzüglich zu löschen oder zu vernichten. Die betroffenen Personen sind von der Wohngeldbehörde auf die Datenübermittlung hinzuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 4",
  "titel": "Datenabgleich",
  "text": "(4) Die in Absatz 2 Satz 1 Nummer 2, 4, 6 und 7 genannten und die für die Leistungen nach Absatz 2 Satz 1 Nummer 1 und 3 zuständigen Stellen sowie die Meldebehörden führen den Datenabgleich durch und übermitteln die Daten über Feststellungen im Sinne des Absatzes 2 an die Wohngeldbehörde oder die zentrale Landesstelle oder über die zentrale Landesstelle an die Wohngeldbehörde. Die jenen Stellen überlassenen Daten und Datenträger sind nach Durchführung des Datenabgleichs unverzüglich zurückzugeben, zu löschen oder zu vernichten.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 5",
  "titel": "Datenabgleich",
  "text": "(5) Der Datenabgleich nach den Absätzen 1 und 2 ist auch in automatisierter Form zulässig. Hierzu dürfen die erforderlichen Daten nach den Absätzen 1 bis 3 auch der Datenstelle als Vermittlungsstelle übermittelt werden. Die Datenstelle darf die nach den Absätzen 1 bis 3 übermittelten Daten speichern, nutzen und an die in Absatz 2 Satz 1 Nr. 2, 4, 6 und 7 genannten Stellen weiter übermitteln, soweit dies für den Datenabgleich nach den Absätzen 1 und 2 erforderlich ist. Die Datenstelle darf die nach § 52 Absatz 1 und 2 des Zweiten Buches Sozialgesetzbuch und nach § 118 Absatz 2 des Zwölften Buches Sozialgesetzbuch übermittelten Daten sowie die Daten der Stammsatzdatei im Sinne des § 150 des Sechsten Buches Sozialgesetzbuch und des bei ihr für die Prüfung bei den Arbeitgebern geführten Dateisystems im Sinne des § 28p Absatz 8 Satz 3 des Vierten Buches Sozialgesetzbuch nutzen, soweit dies für den Datenabgleich nach den Absätzen 1 und 2 erforderlich ist. Die Datenstelle gleicht die übermittelten Daten ab und leitet Feststellungen im Sinne des Absatzes 2 an die übermittelnde Wohngeldbehörde oder die zentrale Landesstelle oder über die zentrale Landesstelle an die übermittelnde Wohngeldbehörde zurück. Die nach Satz 3 bei der Datenstelle gespeicherten Daten sind unverzüglich nach Abschluss der Datenabgleiche zu löschen. Bei einer Weiterübermittlung der Daten nach Satz 3 gilt Absatz 4 für die in Absatz 2 Satz 1 Nr. 2, 4, 6 und 7 genannten Stellen entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 6",
  "titel": "Datenabgleich",
  "text": "(6) Die Landesregierung kann ihre Befugnis, eine zentrale Landesstelle für den Datenabgleich zu bestimmen (Absatz 3 Satz 2, Absatz 4 Satz 1 und Absatz 5 Satz 5), auf die für die Ausführung des Wohngeldgesetzes zuständige oberste Landesbehörde übertragen. § 69 des Ersten Buches Sozialgesetzbuch bleibt unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-33-abs7",
  "gesetz": "WoGG",
  "paragraph": "§ 33",
  "absatz": "Abs. 7",
  "titel": "Datenabgleich",
  "text": "(7) Die Landesregierungen werden ermächtigt, durch Rechtsverordnung die Einzelheiten des Verfahrens des automatisierten Datenabgleichs und die Kosten des Verfahrens zu regeln, solange und soweit nicht die Bundesregierung von der Ermächtigung nach § 38 Nr. 3 Gebrauch gemacht hat.",
  "url": "https://www.gesetze-im-internet.de/wogg/__33.html"
 },
 {
  "id": "wogg-34-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 34",
  "absatz": "Abs. 1",
  "titel": "Zweck der Wohngeldstatistik, Auskunfts- und Hinweispflicht",
  "text": "(1) Über die Anträge und Entscheidungen nach diesem Gesetz sowie über die persönlichen und sachlichen Verhältnisse der zu berücksichtigenden Haushaltsmitglieder, die für die Berechnung des regionalen Mietenniveaus (§ 12 Abs. 3 und 4), den Wohngeld- und Mietenbericht (§ 39), die Beurteilung der Auswirkungen dieses Gesetzes und dessen Fortentwicklung erforderlich sind, ist eine Bundesstatistik zu führen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__34.html"
 },
 {
  "id": "wogg-34-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 34",
  "absatz": "Abs. 2",
  "titel": "Zweck der Wohngeldstatistik, Auskunfts- und Hinweispflicht",
  "text": "(2) Für die Erhebung sind die Wohngeldbehörden auskunftspflichtig. Die Angaben der in § 23 Abs. 1 bis 3 bezeichneten Personen dienen zur Ermittlung der statistischen Daten im Rahmen der Erhebungsmerkmale (§ 35).",
  "url": "https://www.gesetze-im-internet.de/wogg/__34.html"
 },
 {
  "id": "wogg-34-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 34",
  "absatz": "Abs. 3",
  "titel": "Zweck der Wohngeldstatistik, Auskunfts- und Hinweispflicht",
  "text": "(3) Die wohngeldberechtigte Person ist auf die Verwendung der auf Grund der Bearbeitung bekannten Daten für die Wohngeldstatistik und auf die Möglichkeit der Übermittlung nach § 36 Abs. 2 Satz 2 hinzuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__34.html"
 },
 {
  "id": "wogg-35-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 35",
  "absatz": "Abs. 1",
  "titel": "Erhebungs- und Hilfsmerkmale",
  "text": "(1) Erhebungsmerkmale sind\n1. die Art des Wohngeldantrages und der Entscheidung;\n2. der Betrag des im Erhebungszeitraum gezahlten Wohngeldes;\n3. der Beginn und das Ende des Bewilligungszeitraums nach Monat und Jahr; die Art und die Höhe des monatlichen Wohngeldes;\n4. die Anzahl der zu berücksichtigenden Haushaltsmitglieder, ihre jeweilige Beteiligung am Erwerbsleben und Stellung im Beruf sowie jeweils die Anzahl derjenigen zu berücksichtigenden Haushaltsmitglieder, die\na) noch nicht 18 Jahre alt sind oder\nb) mindestens 18 Jahre, aber noch nicht 25 Jahre alt sind;\nist mindestens ein Haushaltsmitglied vom Wohngeld ausgeschlossen, sind auch die Gesamtzahl der Haushaltsmitglieder und die Zahl der vom Wohngeld ausgeschlossenen Haushaltsmitglieder Erhebungsmerkmale;\n5. das jeweilige Geschlecht der zu berücksichtigenden Haushaltsmitglieder;\n6. der bei der Berechnung des Wohngeldes berücksichtigte Höchstbetrag für Miete und Belastung (§ 12 Abs. 1), im Fall des § 11 Abs. 3 der Anteil des Höchstbetrages, der dem Anteil der zu berücksichtigenden Haushaltsmitglieder an der Gesamtzahl der Haushaltsmitglieder entspricht;\n7. die Wohnverhältnisse der zu berücksichtigenden Haushaltsmitglieder nach Größe der Wohnung, nach Höhe der monatlichen Miete oder Belastung, im Fall des § 10 Abs. 2 Satz 2 die Belastung aus Zinsen und Tilgung, nach öffentlicher Förderung der Wohnung oder Förderung nach dem Wohnraumförderungsgesetz oder entsprechenden Gesetzen der Länder, der Grund der Wohngeldberechtigung (§ 3 Abs. 1 bis 3) sowie die Gemeinde und deren Mietenstufe (§ 12); ist mindestens ein Haushaltsmitglied vom Wohngeld ausgeschlossen, sind die Größe der Wohnung und die Höhe der monatlichen Miete oder Belastung kopfteilig zu erheben;\n8.\na) das monatliche Gesamteinkommen, die Freibeträge nach den §§ 17, 17a und die Abzugsbeträge für Unterhaltsleistungen nach § 18;\nb) die Summe der positiven Einkünfte und der Einnahmen nach § 14 sowie die Abzugsbeträge für Steuern und Sozialversicherungsbeiträge nach § 16 für jedes einzelne zu berücksichtigende Haushaltsmitglied;\nim Fall einer nach den §§ 7 und 8 Absatz 1 vom Wohngeld ausgeschlossenen wohngeldberechtigten Person ist die Art der beantragten oder empfangenen Leistung nach § 7 Absatz 1 Erhebungsmerkmal;\n9. das Datum der Berechnung des Wohngeldes und die angewandte Gesetzesfassung.",
  "url": "https://www.gesetze-im-internet.de/wogg/__35.html"
 },
 {
  "id": "wogg-35-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 35",
  "absatz": "Abs. 2",
  "titel": "Erhebungs- und Hilfsmerkmale",
  "text": "(2) Hilfsmerkmale sind:\n1. Name und Anschrift der auskunftspflichtigen Wohngeldbehörde;\n2. Wohngeldnummern; diese dürfen keine Angaben über persönliche oder sachliche Verhältnisse der wohngeldberechtigten Personen sowie der in § 23 Absatz 1 bis 3 bezeichneten Personen enthalten oder einen Rückschluss auf diese Verhältnisse zulassen.\nDie Wohngeldnummern sind zu löschen, sobald bei den statistischen Landesämtern die Überprüfung der Erhebungs- und Hilfsmerkmale auf ihre Schlüssigkeit und Vollständigkeit sowie die Erstellung und Prüfung von Ergebnissen aus der Bestandsfortschreibung abgeschlossen sind, spätestens jedoch nach Ablauf von fünf Jahren seit dem Zeitpunkt, zu dem die Erhebung durchgeführt worden ist (§ 36 Absatz 1).",
  "url": "https://www.gesetze-im-internet.de/wogg/__35.html"
 },
 {
  "id": "wogg-35-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 35",
  "absatz": "Abs. 3",
  "titel": "Erhebungs- und Hilfsmerkmale",
  "text": "(3) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogg/__35.html"
 },
 {
  "id": "wogg-36-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 36",
  "absatz": "Abs. 1",
  "titel": "Erhebungszeitraum und Zusatzaufbereitungen",
  "text": "(1) Die Erhebung der Angaben nach § 35 Abs. 1 ist vierteljährlich für das jeweils abgelaufene Kalendervierteljahr durchzuführen. Die statistischen Landesämter stellen dem Statistischen Bundesamt unverzüglich nach Ablauf des Erhebungszeitraums oder zu dem in der Rechtsverordnung nach § 38 angegebenen Zeitpunkt folgende Angaben zur Verfügung:\n1. vierteljährlich\na) für den Erhebungszeitraum die Angaben nach § 35 Abs. 1 Nr. 1 bis 3;\nb) für den vergleichbaren Erhebungszeitraum des vorausgehenden Kalenderjahres die Angaben nach § 35 Abs. 1 Nr. 1 und 3 unter Berücksichtigung der rückwirkenden Entscheidungen aus den folgenden zwölf Monaten;\n2. jährlich die Angaben nach § 35 Abs. 1 Nr. 3 bis 9 für den Monat Dezember unter Berücksichtigung der rückwirkenden Entscheidungen aus dem folgenden Kalendervierteljahr.",
  "url": "https://www.gesetze-im-internet.de/wogg/__36.html"
 },
 {
  "id": "wogg-36-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 36",
  "absatz": "Abs. 2",
  "titel": "Erhebungszeitraum und Zusatzaufbereitungen",
  "text": "(2) Einzelangaben nach § 35 Abs. 1 aus einer Zufallsstichprobe mit einem Auswahlsatz von 25 Prozent der wohngeldberechtigten Personen sind dem Statistischen Bundesamt jährlich unverzüglich nach Ablauf des Erhebungszeitraums für Zusatzaufbereitungen zur Verfügung zu stellen. Zu diesem Zweck dürfen die Einzelangaben auch dem Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen oder, wenn die Aufgabe der Zusatzaufbereitung an das Bundesamt für Bauwesen und Raumordnung übertragen worden ist, an dieses übermittelt werden. Dabei sind mehr als fünf zu berücksichtigende Haushaltsmitglieder, die Wohnraum gemeinsam bewohnen, in einer Gruppe zusammenzufassen. Bei der empfangenden Stelle ist eine Organisationseinheit einzurichten, die räumlich, organisatorisch und personell von anderen Aufgabenbereichen zu trennen ist. Die in dieser Organisationseinheit tätigen Personen müssen Amtsträger oder für den öffentlichen Dienst besonders Verpflichtete sein. Sie dürfen aus ihrer Tätigkeit gewonnene Erkenntnisse nur für Zwecke des § 34 Abs. 1 verwenden. Die nach Satz 2 übermittelten Einzelangaben dürfen nicht mit anderen Daten zusammengeführt werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__36.html"
 },
 {
  "id": "wogg-36-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 36",
  "absatz": "Abs. 3",
  "titel": "Erhebungszeitraum und Zusatzaufbereitungen",
  "text": "(3) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogg/__36.html"
 },
 {
  "id": "wogg-37-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 37",
  "absatz": "Abs. 1",
  "titel": "Bußgeld",
  "text": "(1) Ordnungswidrig handelt, wer vorsätzlich oder leichtfertig\n1. entgegen § 23 Absatz 1 Satz 1, Absatz 2 oder Absatz 3 eine Auskunft nicht, nicht richtig, nicht vollständig oder nicht rechtzeitig gibt,\n2. entgegen § 23 Absatz 1 Satz 3 eine Angabe nicht richtig macht oder\n3. entgegen § 27 Abs. 3 Satz 1, auch in Verbindung mit Abs. 4, oder § 28 Abs. 1 Satz 2 oder Abs. 4 Satz 1 eine Änderung in den Verhältnissen, die für den Wohngeldanspruch erheblich ist, nicht, nicht richtig, nicht vollständig oder nicht rechtzeitig mitteilt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__37.html"
 },
 {
  "id": "wogg-37-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 37",
  "absatz": "Abs. 2",
  "titel": "Bußgeld",
  "text": "(2) Die Ordnungswidrigkeit kann mit einer Geldbuße bis zu zweitausend Euro geahndet werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__37.html"
 },
 {
  "id": "wogg-37-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 37",
  "absatz": "Abs. 3",
  "titel": "Bußgeld",
  "text": "(3) Verwaltungsbehörden im Sinne des § 36 Abs. 1 Nr. 1 des Gesetzes über Ordnungswidrigkeiten sind die Wohngeldbehörden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__37.html"
 },
 {
  "id": "wogg-38",
  "gesetz": "WoGG",
  "paragraph": "§ 38",
  "titel": "Verordnungsermächtigung",
  "text": "Die Bundesregierung wird ermächtigt, durch Rechtsverordnung mit Zustimmung des Bundesrates\n1. nähere Vorschriften zur Durchführung dieses Gesetzes über die Ermittlung\na) der zu berücksichtigenden Miete oder Belastung (§§ 9 bis 12) und\nb) des Einkommens (§§ 13 bis 18)\nzu erlassen, wobei pauschalierende Regelungen getroffen werden dürfen, soweit die Ermittlung im Einzelnen nicht oder nur mit unverhältnismäßig großen Schwierigkeiten möglich ist;\n2. die Mietenstufen für Gemeinden festzulegen (§ 12);\n3. die Einzelheiten des Verfahrens des automatisierten Datenabgleichs und die Kosten des Verfahrens (§ 33) zu regeln; dabei kann auch geregelt werden, dass die Länder der Datenstelle die Kosten für die Durchführung des Datenabgleichs zu erstatten haben;\n4. die in § 43 Absatz 1 Satz 1 Nummer 1 bis 6 genannten Berechnungsgrößen nach einer gesetzlichen Änderung nach § 43 zum 1. Januar jedes zweiten Jahres fortzuschreiben und die bisherigen Anlagen 1 bis 3 zu ersetzen. Soweit der Deutsche Bundestag beschließt, die Höchstbeträge für Miete und Belastung (§ 12 Absatz 1), die Mietenstufen (§ 12 Absatz 2) oder die Höhe des Wohngeldes (§ 19) für ein solches Jahr neu festzusetzen, hat dieser Beschluss Vorrang gegenüber der Verordnungsermächtigung.",
  "url": "https://www.gesetze-im-internet.de/wogg/__38.html"
 },
 {
  "id": "wogg-39-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 39",
  "absatz": "Abs. 1",
  "titel": "Wohngeld- und Mietenbericht; Bericht über die Lage und Entwicklung der Wohnungs- und Immobilienwirtschaft in Deutschland",
  "text": "(1) Die Höchstbeträge für Miete und Belastung (§ 12 Absatz 1), die Mietenstufen (§ 12 Absatz 2) und die Höhe des Wohngeldes (§ 19) sind alle zwei Jahre zu überprüfen. Dabei ist der bundesdurchschnittlichen und regionalen Entwicklung der Wohnkosten sowie der Veränderung der Einkommensverhältnisse und der Lebenshaltungskosten Rechnung zu tragen. Die Bundesregierung berichtet dem Deutschen Bundestag über die Überprüfung nach den Sätzen 1 und 2, über die Durchführung dieses Gesetzes und über die Entwicklung der Mieten für Wohnraum alle zwei Jahre bis zum 30. Juni. Dabei fließen auch miet- und wohnungsmarktrelevante Daten der Länder ein. Bis einschließlich 2025 fließen daneben auch die Einschätzungen der Länder zu den Wirkungen der dauerhaften Heizkostenkomponente nach § 12 Absatz 6 und der Klimakomponente nach § 12 Absatz 7 ein. Der erste erweiterte Bericht erfolgt bis zum 30. Juni 2017.",
  "url": "https://www.gesetze-im-internet.de/wogg/__39.html"
 },
 {
  "id": "wogg-39-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 39",
  "absatz": "Abs. 2",
  "titel": "Wohngeld- und Mietenbericht; Bericht über die Lage und Entwicklung der Wohnungs- und Immobilienwirtschaft in Deutschland",
  "text": "(2) Die Bundesregierung berichtet dem Deutschen Bundestag über die Lage und Entwicklung der Wohnungs- und Immobilienwirtschaft in Deutschland alle vier Jahre bis zum 30. Juni. Der nächste Bericht erfolgt bis zum 30. Juni 2017. Eine im gleichen Jahr vorzulegende Berichterstattung nach Absatz 1 ist jeweils zu integrieren.",
  "url": "https://www.gesetze-im-internet.de/wogg/__39.html"
 },
 {
  "id": "wogg-39-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 39",
  "absatz": "Abs. 3",
  "titel": "Wohngeld- und Mietenbericht; Bericht über die Lage und Entwicklung der Wohnungs- und Immobilienwirtschaft in Deutschland",
  "text": "(3) Zum Zwecke der Evaluierung berichten die Länder nach Ablauf von zwei Jahren spätestens bis zum 31. März 2025 gegenüber dem Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen über die maßgeblichen Kennzahlen der Experimentierklausel des § 30a.",
  "url": "https://www.gesetze-im-internet.de/wogg/__39.html"
 },
 {
  "id": "wogg-40",
  "gesetz": "WoGG",
  "paragraph": "§ 40",
  "titel": "Einkommen bei anderen Sozialleistungen",
  "text": "Das einer vom Wohngeld ausgeschlossenen wohngeldberechtigten Person bewilligte Wohngeld ist bei Sozialleistungen nicht als deren Einkommen zu berücksichtigen.",
  "url": "https://www.gesetze-im-internet.de/wogg/__40.html"
 },
 {
  "id": "wogg-41-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 41",
  "absatz": "Abs. 1",
  "titel": "Auswirkung von Rechtsänderungen auf die Wohngeldentscheidung",
  "text": "(1) Ist im Zeitpunkt des Inkrafttretens von Änderungen dieses Gesetzes oder der Wohngeldverordnung über einen Wohngeldantrag noch nicht entschieden, ist für die Zeit bis zum Inkrafttreten der Änderungen nach dem bis dahin geltenden Recht, für die darauf folgende Zeit nach dem neuen Recht zu entscheiden. Ist über einen nach dem Zeitpunkt des Inkrafttretens von Änderungen dieses Gesetzes oder der Wohngeldverordnung gestellten Wohngeldantrag, einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 zu entscheiden und beginnt der Bewilligungszeitraum vor dem Zeitpunkt des Inkrafttretens von Änderungen dieses Gesetzes oder der Wohngeldverordnung, ist Satz 1 entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__41.html"
 },
 {
  "id": "wogg-41-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 41",
  "absatz": "Abs. 2",
  "titel": "Auswirkung von Rechtsänderungen auf die Wohngeldentscheidung",
  "text": "(2) Ist vor dem Inkrafttreten von Änderungen dieses Gesetzes oder der Wohngeldverordnung über einen Wohngeldantrag entschieden worden, verbleibt es für die Leistung des Wohngeldes auf Grund dieses Antrages bei der Anwendung des jeweils bis zu der Entscheidung geltenden Rechts.",
  "url": "https://www.gesetze-im-internet.de/wogg/__41.html"
 },
 {
  "id": "wogg-42-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 42",
  "absatz": "Abs. 1",
  "titel": "Gesetz zur Neuregelung des Wohngeldrechts und zur Änderung des Sozialgesetzbuches",
  "text": "(1) Ist bis zum 31. Dezember 2008 über einen Wohngeldantrag, einen Antrag nach § 29 Abs. 1 oder Abs. 2 des Wohngeldgesetzes in der bis zum 31. Dezember 2008 geltenden Fassung oder in einem Verfahren nach § 29 Abs. 3 des Wohngeldgesetzes in der bis zum 31. Dezember 2008 geltenden Fassung noch nicht entschieden worden, ist für die Zeit bis zum 31. Dezember 2008 nach dem bis dahin geltenden Recht, für die darauf folgende Zeit nach dem neuen Recht zu entscheiden. Ist in den Fällen des Satzes 1 das ab dem 1. Januar 2009 zu bewilligende Wohngeld geringer als das für Dezember 2008 zu bewilligende Wohngeld, verbleibt es auch für den Teil des Bewilligungszeitraums ab dem 1. Januar 2009 bei diesem Wohngeld; § 24 Abs. 2 und § 27 Abs. 2 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42.html"
 },
 {
  "id": "wogg-42-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 42",
  "absatz": "Abs. 2",
  "titel": "Gesetz zur Neuregelung des Wohngeldrechts und zur Änderung des Sozialgesetzbuches",
  "text": "(2) Ist Wohngeld vor dem 1. Januar 2009 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums im Jahr 2009, ist von Amts wegen über die Leistung des Wohngeldes für den nach dem 31. Dezember 2008 liegenden Teil des Bewilligungszeitraums unter Anwendung des ab dem 1. Januar 2009 geltenden Rechts nach Ablauf des Bewilligungszeitraums schriftlich neu zu entscheiden; ergibt sich kein höheres Wohngeld, verbleibt es bei dem bereits bewilligten Wohngeld. In den Fällen des Satzes 1 sind bei der Entscheidung abweichend von § 24 Abs. 2 die tatsächlichen Verhältnisse im Zeitraum, für den über die Leistung des Wohngeldes rückwirkend neu zu entscheiden ist, zu Grunde zu legen. Die §§ 29 und 30 des Wohngeldgesetzes in der bis zum 31. Dezember 2008 geltenden Fassung und die §§ 27 und 28 bleiben unberührt. Liegt das Ende des Bewilligungszeitraums, über den nach Satz 1 neu zu entscheiden ist, nach dem 31. März 2009, kann eine angemessene vorläufige Zahlung geleistet werden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42.html"
 },
 {
  "id": "wogg-42-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 42",
  "absatz": "Abs. 3",
  "titel": "Gesetz zur Neuregelung des Wohngeldrechts und zur Änderung des Sozialgesetzbuches",
  "text": "(3) Ist über einen nach dem 31. Dezember 2008 gestellten Wohngeldantrag, einen Antrag nach § 27 Abs. 1 oder in einem Verfahren nach § 27 Abs. 2 zu entscheiden und beginnt der Bewilligungszeitraum vor dem 1. Januar 2009, ist Absatz 1 entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42.html"
 },
 {
  "id": "wogg-42-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 42",
  "absatz": "Abs. 4",
  "titel": "Gesetz zur Neuregelung des Wohngeldrechts und zur Änderung des Sozialgesetzbuches",
  "text": "(4) Wären bei einer Entscheidung nach den Absätzen 1 und 3 Haushaltsmitglieder nach § 6 zu berücksichtigen, die in einem anderen Bescheid für denselben Wohnraum bereits als zum Haushalt rechnende Familienmitglieder berücksichtigt worden sind, bleibt dieser andere Bescheid von der Entscheidung nach den Absätzen 1 und 3 unberührt. Bei der Entscheidung nach den Absätzen 1 und 3 ist das Wohngeld ohne die Haushaltsmitglieder nach Satz 1 und unter entsprechender Anwendung des § 11 Abs. 3 zu berechnen. Die Fälle der Sätze 1 und 2 gelten als erhebliche Änderung der maßgeblichen Verhältnisse nach § 25 Abs. 1 Satz 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42.html"
 },
 {
  "id": "wogg-42-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 42",
  "absatz": "Abs. 5",
  "titel": "Gesetz zur Neuregelung des Wohngeldrechts und zur Änderung des Sozialgesetzbuches",
  "text": "(5) Bei Wohn- und Wirtschaftsgemeinschaften von Personen, welche die Voraussetzungen nach § 4 des Wohngeldgesetzes in der bis zum 31. Dezember 2008 geltenden Fassung nicht erfüllen und keinen gemeinsamen Wohngeldbescheid erhalten haben, ist bei der Entscheidung nach Absatz 2 rückwirkend das Wohngeld gemeinsam zu berechnen, wenn die Voraussetzungen nach den §§ 5 und 6 Abs. 1 erfüllt werden. Enden die Bewilligungszeiträume in den Fällen des Satzes 1 nicht gleichzeitig, ist abweichend von Absatz 2 Satz 1 Halbsatz 1 nach dem Ende des zuletzt ablaufenden Bewilligungszeitraums für alle zu berücksichtigenden Haushaltsmitglieder nach § 6 einheitlich neu zu entscheiden. Beträgt der Zeitraum zwischen dem Ende des zuerst ablaufenden Bewilligungszeitraums und dem Ende des zuletzt ablaufenden Bewilligungszeitraums mehr als drei Monate, ist auf Antrag eine angemessene vorläufige Zahlung zu leisten.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42.html"
 },
 {
  "id": "wogg-42a-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 42a",
  "absatz": "Abs. 1",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Reform des Wohngeldrechts und zur Änderung des Wohnraumförderungsgesetzes",
  "text": "(1) Ist Wohngeld vor dem 1. Januar 2016 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2015, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom 1. Januar 2016 bis zum Ende des bisherigen Bewilligungszeitraums neu zu entscheiden. Bei der Entscheidung nach Satz 1 sind die §§ 12 und 16 Satz 1 bis 4 und § 19 dieses Gesetzes sowie die Anlage zu § 1 Absatz 3 der Wohngeldverordnung in der ab dem 1. Januar 2016 geltenden Fassung anzuwenden, alle anderen Vorschriften in der bis zum 31. Dezember 2015 geltenden Fassung. Ergibt sich bei der Entscheidung nach Satz 1 kein höheres Wohngeld, verbleibt es bis zum Ende des bisherigen Bewilligungszeitraums bei dem bereits bewilligten Wohngeld. Ist bei der Entscheidung nach Satz 1 nicht berücksichtigt worden, dass sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder, die zu berücksichtigende Miete oder Belastung oder das Gesamteinkommen verändert hat oder das Wohngeld zweckwidrig verwendet wird, so ist abweichend von § 45 des Zehnten Buches Sozialgesetzbuch die Entscheidung nach Satz 1 nur rechtswidrig, wenn gleichzeitig die Voraussetzungen des § 27 oder § 28 Absatz 2 dieses Gesetzes vorliegen; im Übrigen bleibt § 45 des Zehnten Buches Sozialgesetzbuch unberührt. Wird die Entscheidung nach Satz 1 unter den Voraussetzungen des § 45 des Zehnten Buches Sozialgesetzbuch zurückgenommen, wird der bisherige Bewilligungsbescheid wieder wirksam; die §§ 27 und 28 bleiben unberührt. Ist Wohngeld vor dem 1. Januar 2016 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2015 und ist über einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 neu zu entscheiden, so ist für die Zeit bis zum 31. Dezember 2015 nach dem bis dahin geltenden Recht, ab dem 1. Januar 2016 bis zum Ende des bisherigen Bewilligungszeitraums nach neuem Recht nach Maßgabe des Satzes 2 und danach vollständig nach neuem Recht zu entscheiden. Der Bewilligungsbescheid nach Satz 1 muss auf die besonderen Entscheidungsgrundlagen der Sätze 1 bis 5 hinweisen, insbesondere darauf, dass eine Entscheidung nach § 27 oder § 28 Absatz 2 dem Bewilligungsbescheid nach Satz 1 noch nachfolgen kann und bezogen auf den Zeitpunkt der Änderung, der auch vor dem 1. Januar 2016 liegen kann, das Wohngeld wegfallen oder sich verringern kann.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42a.html"
 },
 {
  "id": "wogg-42a-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 42a",
  "absatz": "Abs. 2",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Reform des Wohngeldrechts und zur Änderung des Wohnraumförderungsgesetzes",
  "text": "(2) Ist bis zum 31. Dezember 2015 über einen Wohngeldantrag nach § 22 noch nicht entschieden, so ist für die Zeit bis zum 31. Dezember 2015 nach dem bis dahin geltenden Recht und für die darauffolgende Zeit nach dem neuen Recht zu entscheiden. Ist in den Fällen des Satzes 1 das ab dem 1. Januar 2016 zu bewilligende Wohngeld geringer als das für Dezember 2015 zu bewilligende Wohngeld, verbleibt es auch für den Teil des Bewilligungszeitraums ab dem 1. Januar 2016 bei diesem Wohngeld. Ist über einen nach dem 31. Dezember 2015 gestellten Wohngeldantrag nach § 22 zu entscheiden und beginnt der Bewilligungszeitraum vor dem 1. Januar 2016, so sind die Sätze 1 und 2 entsprechend anzuwenden. § 24 Absatz 2 und § 27 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42a.html"
 },
 {
  "id": "wogg-42a-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 42a",
  "absatz": "Abs. 3",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Reform des Wohngeldrechts und zur Änderung des Wohnraumförderungsgesetzes",
  "text": "(3) In Fällen des § 31 Absatz 1 Satz 1 des Unterhaltssicherungsgesetzes sind § 14 Absatz 2 Nummer 23 und § 20 Absatz 1 dieses Gesetzes in der bis zum 31. Oktober 2015 geltenden Fassung anzuwenden. Im Übrigen gelten die Absätze 1 und 2.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42a.html"
 },
 {
  "id": "wogg-42b-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 1",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(1) Ist Wohngeld vor dem 1. Januar 2020 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2019, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom 1. Januar 2020 bis zum Ende des bisherigen Bewilligungszeitraums neu zu entscheiden. Bei der Entscheidung nach Satz 1 sind die §§ 12, 17 und 19 dieses Gesetzes und die Anlage zu § 1 Absatz 3 der Wohngeldverordnung in der ab dem 1. Januar 2020 geltenden Fassung anzuwenden. Ergibt sich aus der Entscheidung nach Satz 1 kein höheres Wohngeld, verbleibt es bis zum Ende des bisherigen Bewilligungszeitraums bei dem bereits bewilligten Wohngeld.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42b-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 2",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(2) Ist bei der Entscheidung nach Absatz 1 Satz 1 nicht berücksichtigt worden, dass\n1. sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder, die zu berücksichtigende Miete oder Belastung oder das Gesamteinkommen geändert hat,\n2. das Wohngeld zweckwidrig verwendet wird oder\n3. die Voraussetzungen für den erhöhten anrechnungsfreien Betrag nach § 14 Absatz 2 Nummer 19 Buchstabe a oder Nummer 20 Buchstabe a oder einen anrechnungsfreien Betrag nach § 14 Absatz 2 Nummer 19 Buchstabe b vorliegen,\nso ist diese Entscheidung nur rechtswidrig, wenn gleichzeitig die Voraussetzungen der §§ 27 oder 28 Absatz 2 dieses Gesetzes vorliegen; im Übrigen bleibt § 45 des Zehnten Buches Sozialgesetzbuch unberührt. Wird die Entscheidung nach Absatz 1 Satz 1 unter den Voraussetzungen des § 45 des Zehnten Buches Sozialgesetzbuch zurückgenommen, so wird der bisherige Bewilligungsbescheid wieder wirksam; die §§ 27 und 28 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42b-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 3",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(3) Ist Wohngeld vor dem 1. Januar 2020 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2019 und ist über einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 neu zu entscheiden, so ist für die Zeit bis zum 31. Dezember 2019 nach dem bis dahin geltenden Recht, ab dem 1. Januar 2020 nach neuem Recht zu entscheiden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42b-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 4",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(4) Der Bewilligungsbescheid nach Absatz 1 Satz 1 muss auf die besonderen Entscheidungsgrundlagen der Absätze 1 und 2 hinweisen, insbesondere darauf, dass eine Entscheidung nach den §§ 27 oder 28 Absatz 2 oder die Mitteilung über die Unwirksamkeit nach § 28 Absatz 1 oder 3 dem Bewilligungsbescheid noch folgen kann und bezogen auf den Zeitpunkt der Änderung der Verhältnisse, der auch vor dem 1. Januar 2020 liegen kann, das Wohngeld wegfallen oder sich verringern kann.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42b-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 5",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(5) Ist bis zum 31. Dezember 2019 über einen Wohngeldantrag nach § 22 noch nicht entschieden, so ist für die Zeit bis zum 31. Dezember 2019 nach dem bis dahin geltenden Recht und für die darauffolgende Zeit nach dem neuen Recht zu entscheiden. Ist in den Fällen des Satzes 1 das ab dem 1. Januar 2020 zu bewilligende Wohngeld geringer als das für Dezember 2019 zu bewilligende Wohngeld, so verbleibt es auch für den Teil des Bewilligungszeitraums ab dem 1. Januar 2020 bei diesem Wohngeld.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42b-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 42b",
  "absatz": "Abs. 6",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Stärkung des Wohngeldes",
  "text": "(6) Ist über einen nach dem 31. Dezember 2019 gestellten Wohngeldantrag nach § 22 zu entscheiden und beginnt der Bewilligungszeitraum vor dem 1. Januar 2020, so ist Absatz 5 entsprechend anzuwenden. § 24 Absatz 2 und § 27 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42b.html"
 },
 {
  "id": "wogg-42c-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 1",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(1) Ist Wohngeld vor dem 1. Januar 2021 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2020, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom 1. Januar 2021 bis zum Ende des bisherigen Bewilligungszeitraums neu zu entscheiden. Bei der Entscheidung nach Satz 1 sind die §§ 11 und 12 dieses Gesetzes in der ab dem 1. Januar 2021 geltenden Fassung anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42c-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 2",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(2) Ist bei der Entscheidung nach Absatz 1 Satz 1 nicht berücksichtigt worden, dass sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder, die zu berücksichtigende Miete oder Belastung oder das Gesamteinkommen geändert hat, so ist diese Entscheidung nur rechtswidrig, wenn gleichzeitig die Voraussetzungen des § 27 Absatz 1 oder 2 vorliegen. Im Übrigen bleibt § 45 des Zehnten Buches Sozialgesetzbuch unberührt. Wird die Entscheidung nach Absatz 1 Satz 1 unter den Voraussetzungen des § 45 des Zehnten Buches Sozialgesetzbuch zurückgenommen, so wird der bisherige Bewilligungsbescheid wieder wirksam. Die §§ 27 und 28 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42c-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 3",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(3) Ist Wohngeld vor dem 1. Januar 2021 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2020 und ist über einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 neu zu entscheiden, so ist für die Zeit bis zum 31. Dezember 2020 nach dem bis dahin geltenden Recht und ab dem 1. Januar 2021 nach neuem Recht zu entscheiden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42c-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 4",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(4) Der Bewilligungsbescheid nach Absatz 1 Satz 1 muss auf die besonderen Entscheidungsgrundlagen der Absätze 1 und 2 hinweisen, insbesondere darauf, dass eine Entscheidung nach den §§ 27 oder 28 Absatz 2 oder die Mitteilung über die Unwirksamkeit nach § 28 Absatz 1 oder 3 dem Bewilligungsbescheid noch folgen kann und dass ab dem Zeitpunkt der Änderung der Verhältnisse, der auch vor dem 1. Januar 2021 liegen kann, das Wohngeld wegfallen oder sich verringern kann.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42c-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 5",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(5) Ist bis zum 31. Dezember 2020 über einen Wohngeldantrag nach § 22 noch nicht entschieden, so ist für die Zeit bis zum 31. Dezember 2020 nach dem bis dahin geltenden Recht und für die darauf folgende Zeit nach dem neuen Recht zu entscheiden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42c-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 42c",
  "absatz": "Abs. 6",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Entlastung bei den Heizkosten im Wohngeld im Kontext der CO 2 -Bepreisung",
  "text": "(6) Ist über einen nach dem 31. Dezember 2020 gestellten Wohngeldantrag nach § 22 zu entscheiden und beginnt der Bewilligungszeitraum vor dem 1. Januar 2021, so ist Absatz 5 entsprechend anzuwenden. § 24 Absatz 2 und § 27 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42c.html"
 },
 {
  "id": "wogg-42d-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 1",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(1) Ist Wohngeld vor dem 1. Januar 2023 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2022, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom 1. Januar 2023 bis zum Ende des bisherigen Bewilligungszeitraums neu zu entscheiden. Bei der Entscheidung nach Satz 1 sind die §§ 11, 12 und 19 dieses Gesetzes und die sich aus der Anlage zu § 1 Absatz 3 der Wohngeldverordnung in der ab dem 1. Januar 2023 geltenden Fassung ergebenden Mietenstufen anzuwenden. Ergibt sich aus der Entscheidung nach Satz 1 kein höheres Wohngeld, verbleibt es bis zum Ende des bisherigen Bewilligungszeitraums bei dem bereits bewilligten Wohngeld.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-42d-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 2",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(2) Ist bei der Entscheidung nach Absatz 1 Satz 1 nicht berücksichtigt worden, dass sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder, die zu berücksichtigende Miete oder Belastung oder das Gesamteinkommen geändert hat oder das Wohngeld zweckwidrig verwendet wird, so ist die Entscheidung nur rechtswidrig, wenn gleichzeitig die Voraussetzungen des § 27 vorliegen. Im Übrigen bleibt § 45 des Zehnten Buches Sozialgesetzbuch unberührt. Wird die Entscheidung nach Absatz 1 Satz 1 unter den Voraussetzungen des § 45 des Zehnten Buches Sozialgesetzbuch zurückgenommen, so wird der bisherige Bewilligungsbescheid wieder wirksam. Die §§ 27 und 28 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-42d-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 3",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(3) Ist Wohngeld vor dem 1. Januar 2023 bewilligt worden und liegt mindestens ein Teil des Bewilligungszeitraums nach dem 31. Dezember 2022 und ist über einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 neu zu entscheiden, so ist für die Zeit bis zum 31. Dezember 2022 nach dem bis dahin geltenden Recht und ab dem 1. Januar 2023 nach neuem Recht zu entscheiden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-42d-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 4",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(4) Der Bewilligungsbescheid nach Absatz 1 Satz 1 muss auf die besonderen Entscheidungsgrundlagen der Absätze 1 und 2 hinweisen, insbesondere darauf, dass eine Entscheidung nach § 27 oder § 28 Absatz 2 oder die Mitteilung über die Unwirksamkeit nach § 28 Absatz 1 oder Absatz 3 dem Bewilligungsbescheid noch folgen kann und dass ab dem Zeitpunkt der Änderung der Verhältnisse, der auch vor dem 1. Januar 2023 liegen kann, das Wohngeld wegfallen oder sich verringern kann.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-42d-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 5",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(5) Ist bis zum 31. Dezember 2022 über einen Wohngeldantrag nach § 22 noch nicht entschieden, so ist für die Zeit bis zum 31. Dezember 2022 nach dem bis dahin geltenden Recht und für die darauf folgende Zeit nach dem neuen Recht zu entscheiden. Ist in den Fällen des Satzes 1 das ab dem 1. Januar 2023 zu bewilligende Wohngeld geringer als das für Dezember 2022 zu bewilligende Wohngeld, so verbleibt es auch für den Teil des Bewilligungszeitraums ab dem 1. Januar 2023 bei dem für Dezember 2022 zu bewilligenden höheren Wohngeld.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-42d-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 42d",
  "absatz": "Abs. 6",
  "titel": "Übergangsregelung aus Anlass des Wohngeld-Plus-Gesetzes",
  "text": "(6) Ist über einen nach dem 31. Dezember 2022 gestellten Wohngeldantrag nach § 22 zu entscheiden und beginnt der Bewilligungszeitraum vor dem 1. Januar 2023, so ist Absatz 5 entsprechend anzuwenden. § 24 Absatz 2 und § 27 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__42d.html"
 },
 {
  "id": "wogg-43-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 1",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(1) Wurden durch die Änderung dieses Gesetzes die Höchstbeträge für Miete und Belastung (§ 12 Absatz 1), die Mietenstufen (§ 12 Absatz 2) oder die Höhe des Wohngeldes (§ 19) neu ermittelt und festgesetzt, so werden danach zum 1. Januar jedes zweiten Jahres die folgenden Berechnungsgrößen des Wohngeldes durch Rechtsverordnung mit Zustimmung des Bundesrates (§ 38 Nummer 4) fortgeschrieben:\n1. die Höchstbeträge für Miete und Belastung (Anlage 1) auf Grund der Entwicklung der bundesweiten Bruttokaltmieten, gemessen durch den Teilindex für Nettokaltmiete und Wohnungsnebenkosten des Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes;\n2. die Werte für „b“ (Anlage 2) auf Grund der Entwicklung der bundesweiten Bruttokaltmieten, gemessen durch den Teilindex für Nettokaltmiete und Wohnungsnebenkosten des Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes;\n3. die Werte für „c“ (Anlage 2) auf Grund der bundesweiten Entwicklung der Verbraucherpreise, gemessen durch den Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes;\n4. die Werte für „M“ (Anlage 3) auf Grund der Entwicklung der bundesweiten Bruttokaltmieten, gemessen durch den Teilindex für Nettokaltmiete und Wohnungsnebenkosten des Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes;\n5. die Werte für „Y“ (Anlage 3) auf Grund der bundesweiten Entwicklung der Verbraucherpreise, gemessen durch den Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes;\n6. das zusätzliche Wohngeld für das 13. und jedes weitere zu berücksichtigende Haushaltsmitglied nach § 19 Absatz 3 auf Grund der bundesweiten Entwicklung der Verbraucherpreise, gemessen durch den Verbraucherpreisindex für Deutschland des Statistischen Bundesamtes.\nDie erste Fortschreibung der Werte für „M“ und „Y“ (Anlage 3) und des zusätzlichen Wohngeldes für das 13. und jedes weitere zu berücksichtigende Haushaltsmitglied nach § 19 Absatz 3 erfolgt zum 1. Januar 2025.",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 2",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(2) § 12 Absatz 4 Satz 1 findet bei der Fortschreibung des Wohngeldes keine Anwendung.",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 3",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(3) Für die Fortschreibung der Berechnungsgrößen maßgeblich ist die prozentuale Veränderung der Jahresdurchschnittswerte der in Absatz 1 genannten Indizes des zweiten Jahres vor Inkrafttreten der Fortschreibung des Wohngeldes gegenüber den jeweiligen Jahresdurchschnittswerten des vierten Jahres vor Inkrafttreten der Fortschreibung.",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 4",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(4) Die Höchstbeträge für Miete und Belastung (Anlage 1) werden am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar um den Prozentsatz erhöht oder verringert, um den sich der vom Statistischen Bundesamt festgestellte Teilindex nach Absatz 1 Nummer 1 verändert hat. Für die Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Teilindex nach Absatz 1 Nummer 1 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Beträge sind jeweils bis unter 0,50 Euro auf den nächsten vollen Euro-Betrag abzurunden sowie ab 0,50 Euro auf den nächsten vollen Euro-Betrag aufzurunden und ergeben die fortgeschriebenen Höchstbeträge für Miete und Belastung (Anlage 1).",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 5",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(5) Die Werte für „b“ (Anlage 2) werden am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar mit einhundert multipliziert und anschließend durch die Summe aus einhundert und dem Prozentsatz dividiert, um den sich der vom Statistischen Bundesamt festgestellte Teilindex nach Absatz 1 Nummer 2 verändert hat. Für die prozentuale Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Teilindex nach Absatz 1 Nummer 2 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Werte sind jeweils auf die siebte Nachkommastelle abzurunden und ergeben die fortgeschriebenen Werte für „b“ (Anlage 2).",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs6",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 6",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(6) Die Werte für „c“ (Anlage 2) werden am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar mit einhundert multipliziert und anschließend durch die Summe aus einhundert und dem Prozentsatz dividiert, um den sich der vom Statistischen Bundesamt festgestellte Verbraucherpreisindex nach Absatz 1 Nummer 3 verändert hat. Für die prozentuale Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Verbraucherpreisindex nach Absatz 1 Nummer 3 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Werte sind jeweils auf die siebte Nachkommastelle abzurunden und ergeben die fortgeschriebenen Werte für „c“ (Anlage 2).",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs7",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 7",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(7) Die Werte für „M“ (Anlage 3) werden am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar um den Prozentsatz erhöht oder verringert, um den sich der vom Statistischen Bundesamt festgestellte Teilindex nach Absatz 1 Satz 1 Nummer 4 verändert hat. Für die Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Teilindex nach Absatz 1 Satz 1 Nummer 4 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Beträge sind bei einem Nachkommawert unter 0,50 Euro auf den nächsten vollen Euro-Betrag abzurunden sowie bei einem Nachkommawert ab 0,50 Euro auf den nächsten vollen Euro-Betrag aufzurunden; die gerundeten Beträge ergeben die neuen Werte für „M“ (Anlage 3).",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs8",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 8",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(8) Die Werte für „Y“ (Anlage 3) werden am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar um den Prozentsatz erhöht oder verringert, um den sich der vom Statistischen Bundesamt festgestellte Verbraucherpreisindex nach Absatz 1 Satz 1 Nummer 5 verändert hat. Für die Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Verbraucherpreisindex nach Absatz 1 Satz 1 Nummer 5 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Beträge sind bei einem Nachkommawert bis unter 0,50 Euro auf den nächsten vollen Euro-Betrag abzurunden sowie bei einem Nachkommawert ab 0,50 Euro auf den nächsten vollen Euro-Betrag aufzurunden; die gerundeten Beträge ergeben die neuen Werte für „Y“ (Anlage 3).",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs9",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 9",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(9) Der Wert für das zusätzliche Wohngeld für das 13. und jedes weitere zu berücksichtigende Haushaltsmitglied nach § 19 Absatz 3 wird am 1. Januar 2025 und dann alle zwei Jahre zum 1. Januar um den Prozentsatz erhöht oder verringert, um den sich der vom Statistischen Bundesamt festgestellte Verbraucherpreisindex nach Absatz 1 Satz 1 Nummer 6 verändert hat. Für die Veränderung am 1. Januar 2025 ist die Erhöhung oder Verringerung des Jahresdurchschnitts des Verbraucherpreisindex nach Absatz 1 Satz 1 Nummer 6 maßgeblich, die im Jahr 2023 gegenüber dem Jahr 2021 eingetreten ist. Die sich danach ergebenden Beträge sind bei einem Nachkommawert bis unter 0,50 Euro auf den nächsten vollen Euro-Betrag abzurunden sowie bei einem Nachkommawert ab 0,50 Euro auf den nächsten vollen Euro-Betrag aufzurunden; die gerundeten Beträge ergeben die neuen Werte für das zusätzliche Wohngeld für das 13. und jedes weitere zu berücksichtigende Haushaltsmitglied nach § 19 Absatz 3.",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-43-abs10",
  "gesetz": "WoGG",
  "paragraph": "§ 43",
  "absatz": "Abs. 10",
  "titel": "Fortschreibung des Wohngeldes",
  "text": "(10) Für die Fortschreibungen nach dem 1. Januar 2025 gelten die Absätze 4 bis 9 entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__43.html"
 },
 {
  "id": "wogg-44-abs1",
  "gesetz": "WoGG",
  "paragraph": "§ 44",
  "absatz": "Abs. 1",
  "titel": "Übergangsregelung bei Fortschreibung des Wohngeldes",
  "text": "(1) Ist Wohngeld vor dem Inkrafttreten der Fortschreibung des Wohngeldes (§ 43) bewilligt worden und dauert mindestens ein Teil des Bewilligungszeitraums nach dem Inkrafttreten der Fortschreibung noch an, so ist abweichend von § 41 Absatz 2 von Amts wegen über die Leistung des Wohngeldes für den Zeitraum vom Inkrafttreten der Fortschreibung bis zum Ende des bisherigen Bewilligungszeitraums neu zu entscheiden. Bei der Entscheidung sind die Berechnungsgrößen des Wohngeldes nach § 43 Absatz 1 Satz 1 Nummer 1 bis 6 in der ab dem Inkrafttreten der aktuellen Fortschreibung geltenden Fassung anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__44.html"
 },
 {
  "id": "wogg-44-abs2",
  "gesetz": "WoGG",
  "paragraph": "§ 44",
  "absatz": "Abs. 2",
  "titel": "Übergangsregelung bei Fortschreibung des Wohngeldes",
  "text": "(2) Ist bei der Entscheidung nach Absatz 1 Satz 1 nicht berücksichtigt worden, dass sich die Anzahl der zu berücksichtigenden Haushaltsmitglieder, die zu berücksichtigende Miete oder Belastung oder das Gesamteinkommen geändert hat, so ist diese Entscheidung nur rechtswidrig, wenn gleichzeitig die Voraussetzungen des § 27 Absatz 1 oder 2 vorliegen. Im Übrigen bleibt § 45 des Zehnten Buches Sozialgesetzbuch unberührt. Wird die Entscheidung nach Absatz 1 Satz 1 unter den Voraussetzungen des § 45 des Zehnten Buches Sozialgesetzbuch zurückgenommen, so wird der bisherige Bewilligungsbescheid wieder wirksam. Die §§ 27 und 28 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__44.html"
 },
 {
  "id": "wogg-44-abs3",
  "gesetz": "WoGG",
  "paragraph": "§ 44",
  "absatz": "Abs. 3",
  "titel": "Übergangsregelung bei Fortschreibung des Wohngeldes",
  "text": "(3) Ist Wohngeld vor dem Inkrafttreten der aktuellen Fortschreibung bewilligt worden und dauert mindestens ein Teil des Bewilligungszeitraums nach dem Inkrafttreten der Fortschreibung noch an und ist über einen Antrag nach § 27 Absatz 1 oder in einem Verfahren nach § 27 Absatz 2 neu zu entscheiden, so ist für die Zeit bis zum Inkrafttreten der Fortschreibung nach dem bis dahin geltenden Recht, ab dem Inkrafttreten der Fortschreibung nach neuem Recht zu entscheiden.",
  "url": "https://www.gesetze-im-internet.de/wogg/__44.html"
 },
 {
  "id": "wogg-44-abs4",
  "gesetz": "WoGG",
  "paragraph": "§ 44",
  "absatz": "Abs. 4",
  "titel": "Übergangsregelung bei Fortschreibung des Wohngeldes",
  "text": "(4) Der Bewilligungsbescheid nach Absatz 1 Satz 1 muss auf die besonderen Entscheidungsgrundlagen der Absätze 1 und 2 hinweisen, insbesondere darauf, dass eine Entscheidung nach den §§ 27 oder 28 Absatz 2 oder die Mitteilung über die Unwirksamkeit nach § 28 Absatz 1 oder 3 dem Bewilligungsbescheid noch folgen kann und bezogen auf den Zeitpunkt der Änderung der Verhältnisse, der auch vor dem Inkrafttreten der aktuellen Fortschreibung liegen kann, das Wohngeld wegfallen oder sich verringern kann.",
  "url": "https://www.gesetze-im-internet.de/wogg/__44.html"
 },
 {
  "id": "wogg-44-abs5",
  "gesetz": "WoGG",
  "paragraph": "§ 44",
  "absatz": "Abs. 5",
  "titel": "Übergangsregelung bei Fortschreibung des Wohngeldes",
  "text": "(5) Ist bis zum Inkrafttreten der Fortschreibung über einen Wohngeldantrag nach § 22 noch nicht entschieden, so ist für die Zeit bis zum Inkrafttreten der Fortschreibung nach dem bis dahin geltenden Recht und für die darauf folgende Zeit nach dem neuen Recht zu entscheiden. Ist über einen vor dem Inkrafttreten der Fortschreibung gestellten Wohngeldantrag nach § 22 zu entscheiden und beginnt der Bewilligungszeitraum vor dem Inkrafttreten der Fortschreibung, so ist Satz 1 entsprechend anzuwenden. § 24 Absatz 2 und § 27 bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogg/__44.html"
 },
 {
  "id": "wogg-45",
  "gesetz": "WoGG",
  "paragraph": "§ 45",
  "titel": "Übergangsregelung aus Anlass des Gesetzes zur Regelung des Sozialen Entschädigungsrechts",
  "text": "Personen, die\na) ergänzende Hilfe zum Lebensunterhalt oder\nb) andere Hilfen in einer stationären Einrichtung, die den Lebensunterhalt umfassen,\nnach dem Bundesversorgungsgesetz in der am 31. Dezember 2023 geltenden Fassung oder nach einem Gesetz, das dieses für anwendbar erklärt, empfangen, sind vom Wohngeld ausgeschlossen, wenn bei der Berechnung ihrer Hilfen Kosten der Unterkunft berücksichtigt worden sind. § 7 Absatz 1 Satz 3 und Absatz 2 und 3 in der Fassung bis zum 31. Dezember 2023 gelten entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogg/__45.html"
 },
 {
  "id": "wogg-46",
  "gesetz": "WoGG",
  "paragraph": "§ 46",
  "titel": "Übergangsregelung zu § 33",
  "text": "Ab dem in § 3 Absatz 1 des Postaufgabenüberleitungsgesetzes vom 22. Dezember 2025 (BGBl. 2025 I Nr. 345) genannten Zeitpunkt ist § 33 mit der Maßgabe anzuwenden, dass sich § 33 Absatz 2 Satz 1 Nummer 7 auch auf Leistungen der Renten- und Unfallversicherungen bezieht, die durch das Vorgängerunternehmen im Sinne des § 1 Absatz 1 des Postaufgabenüberleitungsgesetzes gezahlt worden sind. Das Nachfolgeunternehmen nach § 1 Absatz 1 des Postaufgabenüberleitungsgesetzes ist auch insoweit nach § 33 Absatz 3 bis 5 berechtigt und verpflichtet.",
  "url": "https://www.gesetze-im-internet.de/wogg/__46.html"
 },
 {
  "id": "wogg-anlage-1",
  "gesetz": "WoGG",
  "paragraph": "Anlage 1",
  "titel": "(zu § 12 Absatz 1)",
  "text": "Anzahl\nder zu berücksichtigenden\nHaushaltsmitglieder | Mietenstufe | Höchstbetrag in Euro\n1 | I | 361\nII | 408\nIII | 456\nIV | 511\nV | 562\nVI | 615\nVII | 677\n2 | I | 437\nII | 493\nIII | 551\nIV | 619\nV | 680\nVI | 745\nVII | 820\n3 | I | 521\nII | 587\nIII | 657\nIV | 737\nV | 809\nVI | 887\nVII | 975\n4 | I | 608\nII | 686\nIII | 766\nIV | 858\nV | 946\nVI | 1 035\nVII | 1 139\n5 | I | 694\nII | 782\nIII | 875\nIV | 982\nV | 1 080\nVI | 1 183\nVII | 1 302\nMehrbetrag\nfür jedes weitere zu\nberücksichtigende\nHaushaltsmitglied | I | 82\nII | 94\nIII | 106\nIV | 119\nV | 129\nVI | 149\nVII | 163",
  "url": "https://www.gesetze-im-internet.de/wogg/"
 },
 {
  "id": "wogg-anlage-2",
  "gesetz": "WoGG",
  "paragraph": "Anlage 2",
  "titel": "(zu § 19 Absatz 1)",
  "text": "Werte für „a“, „b“ und „c“\nDie in die Formel nach § 19 Absatz 1 Satz 1 einzusetzenden, nach der Anzahl der zu berücksichtigenden Haushaltsmitglieder unterschiedenen Werte „a“, „b“ und „c“ sind der nachfolgenden Tabelle zu entnehmen:\n1\nHaushalts-\nmitglied | 2\nHaushalts-\nmitglieder | 3\nHaushalts-\nmitglieder | 4\nHaushalts-\nmitglieder | 5\nHaushalts-\nmitglieder | 6\nHaushalts-\nmitglieder\na | 4,000E-2 | 3,000E-2 | 2,000E-2 | 1,000E-2 | 0 | – 1,000E-2\nb | 4,797E-4 | 3,571E-4 | 2,917E-4 | 2,163E-4 | 1,907E-4 | 1,722E-4\nc | 4,080E-5 | 3,040E-5 | 2,450E-5 | 1,760E-5 | 1,720E-5 | 1,660E-5\n7\nHaushalts-\nmitglieder | 8\nHaushalts-\nmitglieder | 9\nHaushalts-\nmitglieder | 10\nHaushalts-\nmitglieder | 11\nHaushalts-\nmitglieder | 12\nHaushalts-\nmitglieder\na | – 2,000E-2 | – 3,000E-2 | – 4,000E-2 | – 6,000E-2 | – 9,000E-2 | – 1,200E-1\nb | 1,592E-4 | 1,583E-4 | 1,376E-4 | 1,249E-4 | 1,141E-4 | 1,107E-4\nc | 1,650E-5 | 1,650E-5 | 1,660E-5 | 1,660E-5 | 1,960E-5 | 2,210E-5\nHierbei bedeuten: |\nE-1 geteilt durch | 10,\nE-2 geteilt durch | 100,\nE-4 geteilt durch | 10 000,\nE-5 geteilt durch | 100 000.",
  "url": "https://www.gesetze-im-internet.de/wogg/"
 },
 {
  "id": "wogg-anlage-3",
  "gesetz": "WoGG",
  "paragraph": "Anlage 3",
  "titel": "(zu § 19 Absatz 2)",
  "text": "Rechenschritte und Rundungen\n1. Werte für „M“ und „Y“, die unterhalb der folgenden Tabellenwerte liegen, werden durch diese ersetzt:\n1\nHaushalts-\nmitglied | 2\nHaushalts-\nmitglieder | 3\nHaushalts-\nmitglieder | 4\nHaushalts-\nmitglieder | 5\nHaushalts-\nmitglieder | 6\nHaushalts-\nmitglieder\nM | 54 | 67 | 79 | 92 | 103 | 103\nY | 396 | 679 | 906 | 1 132 | 1 358 | 1 585\n7\nHaushalts-\nmitglieder | 8\nHaushalts-\nmitglieder | 9\nHaushalts-\nmitglieder | 10\nHaushalts-\nmitglieder | 11\nHaushalts-\nmitglieder | 12\nHaushalts-\nmitglieder\nM | 115 | 128 | 140 | 152 | 187 | 298\nY | 1 811 | 2 037 | 2 264 | 2 490 | 2 717 | 2 943\n2. Das ungerundete monatliche Wohngeld ergibt sich durch Einsetzen der Werte für „a“, „b“, „c“ (Anlage 2) und für „M“ und „Y“ in die Formel nach § 19 Absatz 1 Satz 1 und durch Ausführen der vier folgenden Rechenschritte: Berechnung der Dezimalzahlen z1 = a + b · M + c ∙ Y, z2 = z1 ∙ Y, z3 = M – z2, z4 = 1,15 ∙ z3. Hierbei sind die Dezimalzahlen als Festkommazahlen mit zehn Nachkommastellen zu berechnen.\n3. Dieses ungerundete monatliche Wohngeld ist bis unter 0,50 Euro auf den nächsten vollen Euro-Betrag abzurunden sowie von 0,50 Euro an auf den nächsten vollen Euro-Betrag aufzurunden.",
  "url": "https://www.gesetze-im-internet.de/wogg/"
 },
 {
  "id": "wogv-1-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 1",
  "absatz": "Abs. 1",
  "titel": "Anwendungsbereich",
  "text": "(1) Die Miete und der Mietwert im Sinne des Wohngeldgesetzes sind nach den Vorschriften des Teils 2 dieser Verordnung zu ermitteln.",
  "url": "https://www.gesetze-im-internet.de/wogv/__1.html"
 },
 {
  "id": "wogv-1-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 1",
  "absatz": "Abs. 2",
  "titel": "Anwendungsbereich",
  "text": "(2) Die Belastung im Sinne des Wohngeldgesetzes ist nach Teil 3 dieser Verordnung zu berechnen, soweit nicht nach § 10 Abs. 2 Satz 2 des Wohngeldgesetzes von einer vollständigen Wohngeld-Lastenberechnung abgesehen werden kann.",
  "url": "https://www.gesetze-im-internet.de/wogv/__1.html"
 },
 {
  "id": "wogv-1-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 1",
  "absatz": "Abs. 3",
  "titel": "Anwendungsbereich",
  "text": "(3) Die Mietenstufen für Gemeinden ergeben sich aus der dieser Verordnung beigefügten Anlage.",
  "url": "https://www.gesetze-im-internet.de/wogv/__1.html"
 },
 {
  "id": "wogv-2-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 2",
  "absatz": "Abs. 1",
  "titel": "Miete",
  "text": "(1) Zur Miete im Sinne des § 9 Abs. 1 des Wohngeldgesetzes gehören auch Beträge, die im Zusammenhang mit dem Miet- oder mietähnlichen Nutzungsverhältnis auf Grund eines Vertrages mit dem Vermieter oder einem Dritten an einen Dritten zu zahlen sind.",
  "url": "https://www.gesetze-im-internet.de/wogv/__2.html"
 },
 {
  "id": "wogv-2-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 2",
  "absatz": "Abs. 2",
  "titel": "Miete",
  "text": "(2) Von der Miete sind keine anderen Beträge als die in § 9 Absatz 2 des Wohngeldgesetzes genannten Kosten und Vergütungen abzusetzen. § 5 bleibt unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogv/__2.html"
 },
 {
  "id": "wogv-3-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 3",
  "absatz": "Abs. 1",
  "titel": "Mietvorauszahlungen und Mieterdarlehen",
  "text": "(1) Ist die Miete ganz oder teilweise im Voraus bezahlt worden (Mietvorauszahlung), sind die im Voraus bezahlten Beträge so zu behandeln, als ob sie jeweils in dem Zeitraum bezahlt worden wären, für den sie bestimmt sind.",
  "url": "https://www.gesetze-im-internet.de/wogv/__3.html"
 },
 {
  "id": "wogv-3-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 3",
  "absatz": "Abs. 2",
  "titel": "Mietvorauszahlungen und Mieterdarlehen",
  "text": "(2) Hat der Mieter dem Vermieter ein Mieterdarlehen gegeben und wird die Forderung des Mieters aus dem Mieterdarlehen ganz oder teilweise mit der Miete verrechnet, gehören zur Miete auch die Beträge, um die sich die Miete hierdurch tatsächlich vermindert.",
  "url": "https://www.gesetze-im-internet.de/wogv/__3.html"
 },
 {
  "id": "wogv-4-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 4",
  "absatz": "Abs. 1",
  "titel": "Sach- und Dienstleistungen des Mieters",
  "text": "(1) Erbringt der Mieter Sach- oder Dienstleistungen für den Vermieter und wird deshalb die Miete ermäßigt, ist die ermäßigte Miete zu Grunde zu legen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__4.html"
 },
 {
  "id": "wogv-4-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 4",
  "absatz": "Abs. 2",
  "titel": "Sach- und Dienstleistungen des Mieters",
  "text": "(2) Erbringt der Mieter Sach- oder Dienstleistungen für den Vermieter und erhält er dafür von diesem eine bestimmte Vergütung, ist diese Vergütung ohne Einfluss auf die Miete.",
  "url": "https://www.gesetze-im-internet.de/wogv/__4.html"
 },
 {
  "id": "wogv-5",
  "gesetz": "WoGV",
  "paragraph": "§ 5",
  "titel": "Nicht feststehende Betriebskosten",
  "text": "Stehen bei der Entscheidung über den Mietzuschussantrag die Umlagen für Betriebskosten ganz oder teilweise nicht fest, sind Erfahrungswerte als Pauschbeträge anzusetzen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__5.html"
 },
 {
  "id": "wogv-6-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 6",
  "absatz": "Abs. 1",
  "titel": "Außer Betracht bleibende Kosten und Vergütungen",
  "text": "(1) Kosten, die nach § 9 Absatz 2 Nummer 1 und 2 des Wohngeldgesetzes außer Betracht bleiben, sind:\n1. Betriebskosten für Heizungs- und Brennstoffversorgungsanlagen sowie Warmwasserversorgungsanlagen im Sinne des § 2 Nummer 4 Buchstabe a, b und d, Nummer 5 Buchstabe a und c und Nummer 6 Buchstabe a und c der Betriebskostenverordnung;\n2. Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser im Sinne des § 2 Nummer 4 Buchstabe c, Nummer 5 Buchstabe b und Nummer 6 Buchstabe b der Betriebskostenverordnung.",
  "url": "https://www.gesetze-im-internet.de/wogv/__6.html"
 },
 {
  "id": "wogv-6-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 6",
  "absatz": "Abs. 2",
  "titel": "Außer Betracht bleibende Kosten und Vergütungen",
  "text": "(2) Kommt nach § 9 Absatz 2 Satz 2 des Wohngeldgesetzes nur der Abzug eines Pauschbetrages von der Miete in Betracht, so beträgt dieser:\n1. für Betriebskosten für zentrale Heizungs- und Brennstoffversorgungsanlagen oder für die Kosten der eigenständig gewerblichen Lieferung von Wärme 1,25 Euro monatlich je Quadratmeter Wohnfläche;\n2. für Betriebskosten für zentrale Warmwasserversorgungsanlagen oder für die Kosten der eigenständig gewerblichen Lieferung von Warmwasser für eine Bewohnerin oder einen Bewohner 9 Euro monatlich, für zwei Bewohnerinnen oder Bewohner 17 Euro monatlich und für jede weitere Bewohnerin oder jeden weiteren Bewohner 3 Euro monatlich;\n3. für die übrigen Kosten der Haushaltsenergie für eine Bewohnerin oder einen Bewohner 41 Euro monatlich, für zwei Bewohnerinnen oder Bewohner 74 Euro monatlich und für jede weitere Bewohnerin oder jeden weiteren Bewohner 15 Euro monatlich;\n4. für die Überlassung einer Garage 36 Euro monatlich; für die Überlassung eines Stellplatzes zum Abstellen von Kraftfahrzeugen 25 Euro monatlich.",
  "url": "https://www.gesetze-im-internet.de/wogv/__6.html"
 },
 {
  "id": "wogv-6-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 6",
  "absatz": "Abs. 3",
  "titel": "Außer Betracht bleibende Kosten und Vergütungen",
  "text": "(3) Bei der Ermittlung des Mietwertes nach § 7 und der Untermiete sind die Absätze 1 und 2 entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogv/__6.html"
 },
 {
  "id": "wogv-7-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 7",
  "absatz": "Abs. 1",
  "titel": "Mietwert",
  "text": "(1) Als Mietwert des Wohnraums (§ 9 Abs. 3 Satz 1 des Wohngeldgesetzes) soll der Betrag zu Grunde gelegt werden, der der Miete für vergleichbaren Wohnraum entspricht. Dabei sind Unterschiede des Wohnwertes, insbesondere in der Größe, Lage und Ausstattung des Wohnraums, durch angemessene Zu- oder Abschläge zu berücksichtigen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__7.html"
 },
 {
  "id": "wogv-7-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 7",
  "absatz": "Abs. 2",
  "titel": "Mietwert",
  "text": "(2) Der Mietwert ist zu schätzen, wenn ein der Miete für vergleichbaren Wohnraum entsprechender Betrag nicht zu Grunde gelegt werden kann.",
  "url": "https://www.gesetze-im-internet.de/wogv/__7.html"
 },
 {
  "id": "wogv-8",
  "gesetz": "WoGV",
  "paragraph": "§ 8",
  "titel": "Aufstellung der Wohngeld-Lastenberechnung",
  "text": "Bei der Aufstellung der Wohngeld-Lastenberechnung ist von der im Bewilligungszeitraum zu erwartenden Belastung auszugehen. Ist die Belastung für das dem Bewilligungszeitraum vorangegangene Kalenderjahr feststellbar und ist eine Änderung im Bewilligungszeitraum nicht zu erwarten, ist von dieser Belastung auszugehen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__8.html"
 },
 {
  "id": "wogv-9-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 9",
  "absatz": "Abs. 1",
  "titel": "Gegenstand und Inhalt der Wohngeld-Lastenberechnung",
  "text": "(1) Als Belastung ist die Belastung zu berücksichtigen, die auf den selbst genutzten Wohnraum entfällt. Selbst genutzter Wohnraum ist der Wohnraum, der von der wohngeldberechtigten Person und den zu berücksichtigenden Haushaltsmitgliedern zu Wohnzwecken benutzt wird.",
  "url": "https://www.gesetze-im-internet.de/wogv/__9.html"
 },
 {
  "id": "wogv-9-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 9",
  "absatz": "Abs. 2",
  "titel": "Gegenstand und Inhalt der Wohngeld-Lastenberechnung",
  "text": "(2) Als Belastung ist zu berücksichtigen:\n1. bei einer Eigentumswohnung die Belastung für den im Sondereigentum stehenden Wohnraum und den damit verbundenen Miteigentumsanteil an dem gemeinschaftlichen Eigentum,\n2. bei einer Wohnung in der Rechtsform des eigentumsähnlichen Dauerwohnrechts die Belastung für den Wohnraum und den Teil des Grundstücks, auf den sich das Dauerwohnrecht erstreckt,\n3. bei einem landwirtschaftlichen Betrieb die Belastung für den Wohnraum.",
  "url": "https://www.gesetze-im-internet.de/wogv/__9.html"
 },
 {
  "id": "wogv-9-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 9",
  "absatz": "Abs. 3",
  "titel": "Gegenstand und Inhalt der Wohngeld-Lastenberechnung",
  "text": "(3) In die Wohngeld-Lastenberechnung sind in den Fällen des § 3 Abs. 2 des Wohngeldgesetzes auch zugehörige Nebengebäude, Anlagen und bauliche Einrichtungen sowie das Grundstück einzubeziehen; dies gilt jedoch nicht bei einem landwirtschaftlichen Betrieb mit Wohnteil. Das Grundstück besteht aus den überbauten und den dazugehörigen Flächen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__9.html"
 },
 {
  "id": "wogv-9-abs4",
  "gesetz": "WoGV",
  "paragraph": "§ 9",
  "absatz": "Abs. 4",
  "titel": "Gegenstand und Inhalt der Wohngeld-Lastenberechnung",
  "text": "(4) In der Wohngeld-Lastenberechnung sind die Fremdmittel und die Belastung auszuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__9.html"
 },
 {
  "id": "wogv-10",
  "gesetz": "WoGV",
  "paragraph": "§ 10",
  "titel": "Fremdmittel",
  "text": "Fremdmittel im Sinne dieser Verordnung sind\n1. Darlehen,\n2. gestundete Restkaufgelder,\n3. gestundete öffentliche Lasten des Grundstücks\nohne Rücksicht darauf, ob sie dinglich gesichert sind oder nicht.",
  "url": "https://www.gesetze-im-internet.de/wogv/__10.html"
 },
 {
  "id": "wogv-11-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 11",
  "absatz": "Abs. 1",
  "titel": "Ausweisung der Fremdmittel",
  "text": "(1) In der Wohngeld-Lastenberechnung sind Fremdmittel mit dem Nennbetrag auszuweisen, wenn sie der Finanzierung folgender Zwecke gedient haben:\n1. des Wohnungsbaus im Sinne des § 16 Abs. 1 und 2 des Wohnraumförderungsgesetzes; maßgebend ist der Wohnraumbegriff des § 2 des Wohngeldgesetzes;\n2. der Verbesserung des Gegenstandes der Wohngeld-Lastenberechnung durch Modernisierung im Sinne des § 16 Abs. 3 des Wohnraumförderungsgesetzes; maßgebend ist der Wohnraumbegriff des § 2 des Wohngeldgesetzes;\n3. der nachträglichen Errichtung oder des nachträglichen Ausbaus einer dem öffentlichen Verkehr dienenden Verkehrsfläche oder des nachträglichen Anschlusses an Versorgungs- und Entwässerungsanlagen;\n4. des Kaufpreises und der Erwerbskosten für den Gegenstand der Wohngeld-Lastenberechnung.\nZu den mit dem Nennbetrag auszuweisenden Fremdmitteln gehören auch Darlehen zur Deckung der laufenden Aufwendungen sowie Annuitätsdarlehen aus Mitteln öffentlicher Haushalte.",
  "url": "https://www.gesetze-im-internet.de/wogv/__11.html"
 },
 {
  "id": "wogv-11-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 11",
  "absatz": "Abs. 2",
  "titel": "Ausweisung der Fremdmittel",
  "text": "(2) Sind die in Absatz 1 bezeichneten Fremdmittel durch andere Fremdmittel ersetzt worden, so sind in der Wohngeld-Lastenberechnung die anderen Fremdmittel an Stelle der ersetzten Fremdmittel höchstens mit dem Betrag auszuweisen, der bis zur Ersetzung noch nicht getilgt war. Eine Ersetzung liegt nicht vor, wenn Dauerfinanzierungsmittel an die Stelle von Zwischenfinanzierungsmitteln treten.",
  "url": "https://www.gesetze-im-internet.de/wogv/__11.html"
 },
 {
  "id": "wogv-11-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 11",
  "absatz": "Abs. 3",
  "titel": "Ausweisung der Fremdmittel",
  "text": "(3) Ist für die in den Absätzen 1 und 2 bezeichneten Fremdmittel Kapitaldienst nicht, noch nicht oder nicht mehr zu leisten, sind sie in der Wohngeld-Lastenberechnung nicht auszuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__11.html"
 },
 {
  "id": "wogv-12-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 12",
  "absatz": "Abs. 1",
  "titel": "Belastung aus dem Kapitaldienst",
  "text": "(1) Als Belastung aus dem Kapitaldienst sind auszuweisen:\n1. die Zinsen und laufenden Nebenleistungen, insbesondere Verwaltungskostenbeiträge der ausgewiesenen Fremdmittel,\n2. die Tilgungen der ausgewiesenen Fremdmittel,\n3. die laufenden Bürgschaftskosten der ausgewiesenen Fremdmittel,\n4. die Erbbauzinsen, Renten und sonstigen wiederkehrenden Leistungen zur Finanzierung der in § 11 genannten Zwecke.\nAls Tilgungen sind auch die\na) Prämien für Personenversicherungen zur Rückzahlung von Festgeldhypotheken und\nb) Bausparbeiträge, wenn der angesparte Betrag für die Rückzahlung von Fremdmitteln zweckgebunden ist,\nin Höhe von 2 Prozent dieser Fremdmittel auszuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__12.html"
 },
 {
  "id": "wogv-12-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 12",
  "absatz": "Abs. 2",
  "titel": "Belastung aus dem Kapitaldienst",
  "text": "(2) Für die in Absatz 1 Nr. 1 und 2 genannte Belastung aus dem Kapitaldienst darf höchstens die vereinbarte Jahresleistung angesetzt werden. Ist die tatsächliche Leistung geringer, ist die geringere Leistung anzusetzen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__12.html"
 },
 {
  "id": "wogv-13-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 13",
  "absatz": "Abs. 1",
  "titel": "Belastung aus der Bewirtschaftung",
  "text": "(1) Als Belastung aus der Bewirtschaftung sind Instandhaltungskosten, Verwaltungskosten und Betriebskosten ohne die Heizkosten auszuweisen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__13.html"
 },
 {
  "id": "wogv-13-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 13",
  "absatz": "Abs. 2",
  "titel": "Belastung aus der Bewirtschaftung",
  "text": "(2) Als Instandhaltungs- und Betriebskosten sind im Jahr 36 Euro je Quadratmeter Wohnfläche und je Quadratmeter Nutzfläche der Geschäftsräume sowie die für den Gegenstand der Wohngeld-Lastenberechnung entrichtete Grundsteuer anzusetzen. Als Verwaltungskosten sind die für den Gegenstand der Wohngeld-Lastenberechnung an einen Dritten für die Verwaltung geleisteten Beträge anzusetzen. Über die in den Sätzen 1 und 2 genannten Beträge hinaus dürfen Bewirtschaftungskosten nicht angesetzt werden.",
  "url": "https://www.gesetze-im-internet.de/wogv/__13.html"
 },
 {
  "id": "wogv-14-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 14",
  "absatz": "Abs. 1",
  "titel": "Nutzungsentgelte und Wärmelieferungskosten",
  "text": "(1) Leistet die wohngeldberechtigte Person an Stelle des Kapitaldienstes, der Instandhaltungskosten, der Betriebskosten und der Verwaltungskosten ein Nutzungsentgelt an einen Dritten, so ist das Nutzungsentgelt in der Wohngeld-Lastenberechnung in Höhe der nach den §§ 12 und 13 ansetzbaren Beträge anzusetzen. Soweit die Beträge nach Satz 1 im Nutzungsentgelt nicht enthalten sind und von der wohngeldberechtigten Person unmittelbar an den Gläubiger entrichtet werden, sind diese Beträge dem Nutzungsentgelt hinzuzurechnen. Soweit eine Aufgliederung des Nutzungsentgelts nicht möglich ist, ist in der Wohngeld-Lastenberechnung das gesamte Nutzungsentgelt anzusetzen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__14.html"
 },
 {
  "id": "wogv-14-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 14",
  "absatz": "Abs. 2",
  "titel": "Nutzungsentgelte und Wärmelieferungskosten",
  "text": "(2) Bezahlt die wohngeldberechtigte Person Beträge zur Deckung der Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser, so sind diese Beträge mit Ausnahme der in § 15 Abs. 2 Satz 1 Nr. 2 bezeichneten Kosten in der Wohngeld-Lastenberechnung anzusetzen. § 6 Abs. 2 Satz 1 Nr. 1 und 2 ist entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogv/__14.html"
 },
 {
  "id": "wogv-15-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 15",
  "absatz": "Abs. 1",
  "titel": "Außer Betracht bleibende Belastung",
  "text": "(1) In den Fällen des § 11 Abs. 2 Nr. 1 des Wohngeldgesetzes bleibt die Belastung insoweit außer Betracht, als sie auf die in § 9 Abs. 2 und 3 dieser Verordnung bezeichneten Räume oder Flächen entfällt, die ausschließlich gewerblich oder beruflich benutzt werden. Soweit die Belastung auf Räume oder Flächen entfällt, die zum Wirtschaftsteil einer Kleinsiedlung oder einer landwirtschaftlichen Nebenerwerbsstelle gehören, wird sie jedoch berücksichtigt, soweit sie nicht nach § 11 Abs. 2 und 3 des Wohngeldgesetzes außer Betracht bleiben.",
  "url": "https://www.gesetze-im-internet.de/wogv/__15.html"
 },
 {
  "id": "wogv-15-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 15",
  "absatz": "Abs. 2",
  "titel": "Außer Betracht bleibende Belastung",
  "text": "(2) In den Fällen des § 11 Abs. 2 Nr. 2 des Wohngeldgesetzes sind von dem Entgelt für die Gebrauchsüberlassung von Räumen oder Flächen an einen anderen die darin enthaltenen Beträge\n1. zur Deckung der Betriebskosten für Heizungs- und Brennstoffversorgungsanlagen sowie Warmwasserversorgungsanlagen und\n2. zur Deckung der Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser, soweit sie den in Nummer 1 bezeichneten Kosten entsprechen,\n3. (weggefallen)\nabzusetzen. § 6 Abs. 1 und 2 dieser Verordnung ist entsprechend anzuwenden.",
  "url": "https://www.gesetze-im-internet.de/wogv/__15.html"
 },
 {
  "id": "wogv-15-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 15",
  "absatz": "Abs. 3",
  "titel": "Außer Betracht bleibende Belastung",
  "text": "(3) Ist eine Garage oder ein Stellplatz zum Abstellen von Kraftfahrzeugen Gegenstand der Wohngeld-Lastenberechnung, gilt hinsichtlich der außer Betracht bleibenden Belastung § 6 Absatz 2 Nummer 4 entsprechend. Ist die Garage oder der Stellplatz einem anderen gegen ein höheres Entgelt überlassen als zu den in § 6 Absatz 2 Nummer 4 genannten Beträgen, so ist das Entgelt in voller Höhe abzusetzen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__15.html"
 },
 {
  "id": "wogv-15-abs4",
  "gesetz": "WoGV",
  "paragraph": "§ 15",
  "absatz": "Abs. 4",
  "titel": "Außer Betracht bleibende Belastung",
  "text": "(4) (weggefallen)",
  "url": "https://www.gesetze-im-internet.de/wogv/__15.html"
 },
 {
  "id": "wogv-16",
  "gesetz": "WoGV",
  "paragraph": "§ 16",
  "titel": "Anwendungsbereich",
  "text": "Die §§ 17 bis 22 gelten für den automatisierten Datenabgleich nach § 33 Absatz 5 in Verbindung mit Absatz 2 des Wohngeldgesetzes zwischen der Wohngeldbehörde, der sonst nach Landesrecht für den Datenabgleich zuständigen oder von der Landesregierung durch Rechtsverordnung oder auf sonstige Weise für den Datenabgleich bestimmten Stelle (zentrale Landesstelle) und der Datenstelle der Rentenversicherung (Datenstelle), dem Bundeszentralamt für Steuern, der Deutschen Post AG sowie der Deutschen Rentenversicherung Knappschaft-Bahn-See. Rechtsverordnungen der Landesregierungen, die über die Regelungen der §§ 16 bis 22 hinausgehen, bleiben unberührt.",
  "url": "https://www.gesetze-im-internet.de/wogv/__16.html"
 },
 {
  "id": "wogv-17-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 17",
  "absatz": "Abs. 1",
  "titel": "Abgleichszeitraum und Übermittlungsverfahren",
  "text": "(1) Der automatisierte Datenabgleich nach § 33 Absatz 5 in Verbindung mit Absatz 2 Satz 1 des Wohngeldgesetzes wird vierteljährlich für das ihm jeweils vorangegangene Kalendervierteljahr (Abgleichszeitraum) durchgeführt. Abweichend von Satz 1 werden in den Datenabgleich nach § 18 Absatz 2 im dritten Kalendervierteljahr alle zu berücksichtigenden Haushaltsmitglieder einbezogen, die innerhalb der dem Abgleich vorangegangenen zwölf Kalendermonate bei der Berechnung des Wohngeldes berücksichtigt wurden.",
  "url": "https://www.gesetze-im-internet.de/wogv/__17.html"
 },
 {
  "id": "wogv-17-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 17",
  "absatz": "Abs. 2",
  "titel": "Abgleichszeitraum und Übermittlungsverfahren",
  "text": "(2) Die Wohngeldbehörde übermittelt der Datenstelle nach § 33 Absatz 5 in Verbindung mit Absatz 2 Satz 1 Nummer 1, 2, 6 und 7 des Wohngeldgesetzes zwischen dem ersten und dem 15. des auf den Abgleichszeitraum folgenden Monats für jedes im Abgleichszeitraum bei der Berechnung des Wohngeldes berücksichtigte Haushaltsmitglied einen Anfragedatensatz. Der Anfragedatensatz enthält die Wohngeldnummer und die in § 33 Absatz 3 Satz 1 Nummer 1 bis 3, 5 und 6 des Wohngeldgesetzes genannten Daten. Er wird über die zentrale Landesstelle übermittelt, wenn diese für die Erfassung und Weiterübermittlung der Daten an die Datenstelle zuständig ist.",
  "url": "https://www.gesetze-im-internet.de/wogv/__17.html"
 },
 {
  "id": "wogv-17-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 17",
  "absatz": "Abs. 3",
  "titel": "Abgleichszeitraum und Übermittlungsverfahren",
  "text": "(3) Die Datenstelle übermittelt die Anfragedatensätze bis zum Ende des auf den Abgleichszeitraum folgenden Monats an\n1. das Bundeszentralamt für Steuern,\n2. die Deutsche Post AG und\n3. die Deutsche Rentenversicherung Knappschaft-Bahn-See.\nIm Fall des Satzes 1 Nummer 1 werden vor der Übermittlung der Anfragedatensätze die Angaben zum Geschlecht und Geburtsort entfernt. Im Fall des Satzes 1 Nummer 2 und 3 werden die Anfragedatensätze, wenn möglich, um die Versicherungsnummer ergänzt. Die in Satz 1 genannten Stellen übermitteln die Antwortdatensätze bis zum 15. des zweiten auf den Abgleichszeitraum folgenden Monats an die Datenstelle.",
  "url": "https://www.gesetze-im-internet.de/wogv/__17.html"
 },
 {
  "id": "wogv-17-abs4",
  "gesetz": "WoGV",
  "paragraph": "§ 17",
  "absatz": "Abs. 4",
  "titel": "Abgleichszeitraum und Übermittlungsverfahren",
  "text": "(4) Die Datenstelle übermittelt der Wohngeldbehörde die Antwortdatensätze aus dem automatisierten Datenabgleich nach § 18 Absatz 1 und die Antwortdatensätze nach Absatz 3 Satz 4 bis zum Ende des zweiten auf den Abgleichszeitraum folgenden Monats. Im Fall des Absatzes 2 Satz 3 erfolgt die Übermittlung über die zentrale Landesstelle, die in diesem Fall die Antwortdatensätze ordnend aufbereiten darf.",
  "url": "https://www.gesetze-im-internet.de/wogv/__17.html"
 },
 {
  "id": "wogv-18-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 18",
  "absatz": "Abs. 1",
  "titel": "Einzelheiten des automatisierten Datenabgleichs",
  "text": "(1) Die Datenstelle gleicht die ihr nach § 17 Absatz 2 übermittelten Daten ab mit den bei ihr gespeicherten Daten nach\n1. § 52 Absatz 1 und 2 des Zweiten Buches Sozialgesetzbuch zur Prüfung, ob und für welche Zeiträume im Abgleichszeitraum Leistungen nach dem Zweiten Buch Sozialgesetzbuch empfangen wurden,\n2. § 118 Absatz 2 des Zwölften Buches Sozialgesetzbuch zur Prüfung, ob und für welche Zeiträume im Abgleichszeitraum Leistungen der Hilfe zum Lebensunterhalt und der Grundsicherung im Alter und bei Erwerbsminderung nach dem Zwölften Buch Sozialgesetzbuch empfangen wurden,\n3. § 150 des Sechsten Buches Sozialgesetzbuch zur Feststellung der Versicherungsnummer,\n4. § 28p Absatz 8 Satz 3 des Vierten Buches Sozialgesetzbuch zur Prüfung des Bestehens einer versicherungspflichtigen oder einer geringfügigen Beschäftigung unter Angabe des jeweiligen Arbeitgebers und des Beschäftigungszeitraums.",
  "url": "https://www.gesetze-im-internet.de/wogv/__18.html"
 },
 {
  "id": "wogv-18-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 18",
  "absatz": "Abs. 2",
  "titel": "Einzelheiten des automatisierten Datenabgleichs",
  "text": "(2) Das Bundeszentralamt für Steuern gleicht die ihm nach § 17 Absatz 3 Satz 1 Nummer 1 übermittelten Daten mit den Daten ab, die bei ihm nach § 45d Absatz 1 und § 45e des Einkommensteuergesetzes in Verbindung mit § 9 Absatz 3 der Zinsinformationsverordnung gespeichert sind. Dieser automatisierte Datenabgleich dient der Feststellung\n1. der Höhe von Kapitalerträgen, für die ein Freistellungsauftrag erteilt worden ist,\n2. von Namen und Anschrift des Empfängers oder der Empfängerin des Freistellungsauftrags sowie\n3. der Höhe von Zinszahlungen, die dem Bundeszentralamt für Steuern von den zuständigen Behörden der anderen Mitgliedstaaten der Europäischen Union mitgeteilt worden sind.",
  "url": "https://www.gesetze-im-internet.de/wogv/__18.html"
 },
 {
  "id": "wogv-18-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 18",
  "absatz": "Abs. 3",
  "titel": "Einzelheiten des automatisierten Datenabgleichs",
  "text": "(3) Die Deutsche Post AG und die Deutsche Rentenversicherung Knappschaft-Bahn-See gleichen die ihnen nach § 17 Absatz 3 Satz 1 Nummer 2 und 3 übermittelten Daten mit den Daten ab, die bei ihnen im Rahmen der §§ 119 und 148 des Sechsten Buches Sozialgesetzbuch sowie des § 99 des Siebten Buches Sozialgesetzbuch gespeichert sind. Dieser automatisierte Datenabgleich dient der Feststellung der Höhe und des Leistungszeitraums von\n1. laufenden Leistungen und\n2. Einmalzahlungen\naus der gesetzlichen Renten- und Unfallversicherung.",
  "url": "https://www.gesetze-im-internet.de/wogv/__18.html"
 },
 {
  "id": "wogv-19-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 19",
  "absatz": "Abs. 1",
  "titel": "Anforderungen an die Datenübermittlung und Datenspeicherung",
  "text": "(1) Bei der Datenübermittlung und Datenspeicherung sind alle erforderlichen und angemessenen technischen und organisatorischen Maßnahmen zu treffen, um die Verfügbarkeit, Integrität und Vertraulichkeit der Daten sowie die Authentizität von Absender und Empfänger der übermittelten Daten entsprechend dem jeweiligen Stand der Technik sicherzustellen. Im Fall der Nutzung allgemein zugänglicher Netze sind Verschlüsselungsverfahren anzuwenden, die dem jeweiligen Stand der Technik entsprechen. Die einschlägigen Standards für eine sichere Datenübermittlung durch die Datenstelle sind im Einvernehmen mit dem Bundesamt für Sicherheit in der Informationstechnik festzulegen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__19.html"
 },
 {
  "id": "wogv-19-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 19",
  "absatz": "Abs. 2",
  "titel": "Anforderungen an die Datenübermittlung und Datenspeicherung",
  "text": "(2) Werden Mängel festgestellt, die eine ordnungsgemäße Übernahme der Daten beeinträchtigen, kann die Übernahme ganz oder teilweise abgelehnt werden. Die übermittelnde Stelle ist über die festgestellten Mängel unter Beachtung der Verfahrensgrundsätze (§ 21) zu unterrichten. Sie soll die abgelehnten Datensätze unverzüglich berichtigen und für den ursprünglichen Abgleichszeitraum erneut übermitteln.",
  "url": "https://www.gesetze-im-internet.de/wogv/__19.html"
 },
 {
  "id": "wogv-19-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 19",
  "absatz": "Abs. 3",
  "titel": "Anforderungen an die Datenübermittlung und Datenspeicherung",
  "text": "(3) Das Bundeszentralamt für Steuern, die Deutsche Post AG und die Deutsche Rentenversicherung Knappschaft-Bahn-See haben den Eingang der Anfragedatensätze, die ihnen von der Datenstelle übermittelt werden, zu überwachen und die eingegangenen Anfragedatensätze auf Vollständigkeit zu überprüfen. Sie haben der Datenstelle unverzüglich den Eingang zu bestätigen und das Ergebnis der Prüfung auf Vollständigkeit mitzuteilen. Satz 1 gilt entsprechend für die Datenstelle hinsichtlich der ihr vom Bundeszentralamt für Steuern, von der Deutschen Post AG und der Deutschen Rentenversicherung Knappschaft-Bahn-See übermittelten Antwortdatensätze.",
  "url": "https://www.gesetze-im-internet.de/wogv/__19.html"
 },
 {
  "id": "wogv-19-abs4",
  "gesetz": "WoGV",
  "paragraph": "§ 19",
  "absatz": "Abs. 4",
  "titel": "Anforderungen an die Datenübermittlung und Datenspeicherung",
  "text": "(4) Das Bundeszentralamt für Steuern, die Deutsche Post AG, die Deutsche Rentenversicherung Knappschaft-Bahn-See und die Datenstelle haben die ihnen übermittelten Daten unverzüglich nach Abschluss des automatisierten Datenabgleichs zu löschen. Im Fall des § 17 Absatz 2 Satz 3 darf die zentrale Landesstelle die Antwortdatensätze nach Abschluss eines automatisierten Datenabgleichs bis zum Abschluss des nächsten automatisierten Datenabgleichs speichern, um in beiden automatisierten Datenabgleichen identische Antwortdatensätze zu identifizieren.",
  "url": "https://www.gesetze-im-internet.de/wogv/__19.html"
 },
 {
  "id": "wogv-20",
  "gesetz": "WoGV",
  "paragraph": "§ 20",
  "titel": "Weiterverwendung der Antwortdatensätze",
  "text": "Die von der Datenstelle oder der zentralen Landesstelle an die Wohngeldbehörde übermittelten Antwortdatensätze dürfen in das Wohngeldfachverfahren übernommen werden und sind durch die Wohngeldbehörde zu überprüfen. Führt die Überprüfung nicht zu abweichenden Feststellungen, sind diese Antwortdatensätze unverzüglich zu löschen. Führt die Überprüfung zu abweichenden Feststellungen, dürfen diese Antwortdatensätze zur Weiterverwendung im Wohngeldfachverfahren gespeichert werden, um eine mögliche rechtswidrige Inanspruchnahme von Wohngeld zu klären und überzahlte Beträge zurückzufordern. In diesem Fall erfolgt eine maschinelle Löschung der Daten erst bei Löschung der Akte im Wohngeldverfahren.",
  "url": "https://www.gesetze-im-internet.de/wogv/__20.html"
 },
 {
  "id": "wogv-21",
  "gesetz": "WoGV",
  "paragraph": "§ 21",
  "titel": "Verfahrensgrundsätze",
  "text": "Die technischen Einzelheiten des automatisierten Datenabgleichsverfahrens nach § 16, insbesondere des Aufbaus, der Übermittlung sowie der Prüfung und Berichtigung der Datensätze, sind von der Datenstelle, dem Bundeszentralamt für Steuern, der Deutschen Post AG, der Deutschen Rentenversicherung Knappschaft-Bahn-See und den für die Durchführung des Wohngeldgesetzes zuständigen obersten Landesbehörden in einheitlichen Verfahrensgrundsätzen einvernehmlich festzulegen. Der Bundesbeauftragte für den Datenschutz und die Informationsfreiheit ist vor Festlegung der Verfahrensgrundsätze zu hören. Die Verfahrensgrundsätze sind von der Datenstelle auf der Internetseite der Deutschen Rentenversicherung zu veröffentlichen.",
  "url": "https://www.gesetze-im-internet.de/wogv/__21.html"
 },
 {
  "id": "wogv-22-abs1",
  "gesetz": "WoGV",
  "paragraph": "§ 22",
  "absatz": "Abs. 1",
  "titel": "Kosten",
  "text": "(1) Die Länder haben der Datenstelle die notwendigen Kosten für die Durchführung und Vermittlung des automatisierten Datenabgleichs nach § 16 zu erstatten. Diese Kostenerstattung richtet sich in den Fällen des § 17 Absatz 2 Satz 3 nach den Absätzen 2 und 3.",
  "url": "https://www.gesetze-im-internet.de/wogv/__22.html"
 },
 {
  "id": "wogv-22-abs2",
  "gesetz": "WoGV",
  "paragraph": "§ 22",
  "absatz": "Abs. 2",
  "titel": "Kosten",
  "text": "(2) Für die Länder, die vor dem 1. Januar 2013 einen automatisierten Datenabgleich unter Vermittlung der Datenstelle durchführen und weiterhin daran teilnehmen, legt die Datenstelle die für das Jahr 2013 zu erstattenden Kosten auf der Grundlage der tatsächlich entstandenen Kosten einheitlich neu fest, wobei jedoch die zu erstattenden Kosten höchstens 3 800 Euro je Land betragen. Die festgelegten Kosten erhöhen sich für jedes weitere Kalenderjahr der Teilnahme am automatisierten Datenabgleich pauschal um 3 Prozent. Die Datenstelle teilt den für die Durchführung des Wohngeldgesetzes zuständigen obersten Landesbehörden die zu erstattenden Kosten mit; die Erstattung ist jeweils am 1. April für das laufende Kalenderjahr fällig und berechtigt zur viermaligen Teilnahme am automatisierten Datenabgleich.",
  "url": "https://www.gesetze-im-internet.de/wogv/__22.html"
 },
 {
  "id": "wogv-22-abs3",
  "gesetz": "WoGV",
  "paragraph": "§ 22",
  "absatz": "Abs. 3",
  "titel": "Kosten",
  "text": "(3) Die übrigen Länder haben für das erste Kalenderjahr der Teilnahme eines Landes am automatisierten Datenabgleich pauschal einmalige Kosten in Höhe von 2 700 Euro zuzüglich 950 Euro je Kalendervierteljahr der Teilnahme zu erstatten. Die Erstattung ist am 31. Januar des folgenden Kalenderjahres fällig. Für jedes weitere Kalenderjahr der Teilnahme am automatisierten Datenabgleich sind die Kosten nach Absatz 2 Satz 1 in Verbindung mit Absatz 2 Satz 2 zu erstatten; Absatz 2 Satz 3 gilt entsprechend.",
  "url": "https://www.gesetze-im-internet.de/wogv/__22.html"
 },
 {
  "id": "wogv-anlage-x",
  "gesetz": "WoGV",
  "paragraph": "Anlage",
  "titel": "(zu § 1 Absatz 3)\nMietenstufen der Gemeinden nach Ländern ab 1. Januar 2023",
  "text": "Soweit die zu einem Kreis gehörenden Gemeinden in den Tabellen nicht gesondert aufgeführt sind, gilt die Mietenstufe des Kreises für diese Gemeinden. Zu Grunde liegen Daten der Wohngeldstatistik zum 31. Dezember 2019 und 31. Dezember 2020 einschließlich der bis zum 31. März 2021 erfolgten rückwirkenden Bewilligungen. Relevanter Gebietsstand ist der 31. März 2021, der für die 10 000-Einwohner-Schwelle relevante Stichtag der Bevölkerung ist der 30. September 2020.\nLand: Baden-Württemberg\nGemeinde | Mietenstufe\nAalen, Stadt | III\nAchern, Stadt | II\nAlbstadt, Stadt | II\nAltensteig, Stadt | II\nAmmerbuch | IV\nAppenweier | II\nAsperg, Stadt | V\nAulendorf, Stadt | II\nBacknang, Stadt | IV\nBad Dürrheim, Stadt | III\nBad Friedrichshall, Stadt | IV\nBad Krozingen, Stadt | V\nBad Mergentheim, Stadt | III\nBad Rappenau, Stadt | III\nBad Säckingen, Stadt | IV\nBad Saulgau, Stadt | II\nBad Schönborn | IV\nBad Urach, Stadt | IV\nBad Waldsee, Stadt | II\nBad Wildbad, Stadt | II\nBad Wurzach, Stadt | II\nBaden-Baden, Stadt | IV\nBaiersbronn | II\nBalingen, Stadt | II\nBesigheim, Stadt | V\nBiberach an der Riß, Stadt | III\nBietigheim-Bissingen, Stadt | V\nBirkenfeld | III\nBlaubeuren, Stadt | III\nBlaustein, Stadt | V\nBlumberg, Stadt | I\nBöblingen, Stadt | VI\nBopfingen, Stadt | II\nBrackenheim, Stadt | III\nBreisach am Rhein, Stadt | IV\nBretten, Stadt | III\nBretzfeld | II\nBruchsal, Stadt | III\nBrühl | III\nBuchen (Odenwald), Stadt | II\nBühl, Stadt | III\nBurladingen, Stadt | I\nCalw, Stadt | IV\nCrailsheim, Stadt | II\nDenkendorf | V\nDenzlingen | IV\nDitzingen, Stadt | V\nDonaueschingen, Stadt | II\nDonzdorf, Stadt | II\nDossenheim | V\nDurmersheim | IV\nEberbach, Stadt | II\nEbersbach an der Fils, Stadt | IV\nEdingen-Neckarhausen | III\nEggenstein-Leopoldshafen | IV\nEhingen (Donau), Stadt | III\nEislingen/Fils, Stadt | IV\nEllwangen (Jagst), Stadt | III\nEmmendingen, Stadt | IV\nEndingen am Kaiserstuhl, Stadt | III\nEngen, Stadt | III\nEningen unter Achalm | IV\nEppelheim, Stadt | V\nEppingen, Stadt | III\nErbach, Stadt | III\nEsslingen am Neckar, Stadt | V\nEttenheim, Stadt | II\nEttlingen, Stadt | IV\nFellbach, Stadt | V\nFilderstadt, Stadt | V\nFreiberg am Neckar, Stadt | VI\nFreiburg im Breisgau, Stadt | VI\nFreudenstadt, Stadt | III\nFriedrichshafen, Stadt | V\nFriesenheim | II\nGärtringen | IV\nGaggenau, Stadt | III\nGaildorf, Stadt | II\nGeislingen an der Steige, Stadt | III\nGengenbach, Stadt | III\nGerlingen, Stadt | VI\nGernsbach, Stadt | III\nGerstetten | I\nGiengen an der Brenz, Stadt | II\nGöppingen, Stadt | III\nGottmadingen | III\nGraben-Neudorf | III\nGrenzach-Wyhlen | V\nGundelfingen | V\nHaigerloch, Stadt | I\nHechingen, Stadt | IV\nHeddesheim | III\nHeidelberg, Stadt | V\nHeidenheim an der Brenz, Stadt | IV\nHeilbronn, Stadt | IV\nHemsbach, Stadt | III\nHerbolzheim, Stadt | III\nHerbrechtingen, Stadt | II\nHerrenberg, Stadt | V\nHockenheim, Stadt | III\nHolzgerlingen, Stadt | VI\nHorb am Neckar, Stadt | II\nIsny im Allgäu, Stadt | III\nKarlsbad | III\nKarlsdorf-Neuthard | III\nKarlsruhe, Stadt | IV\nKehl, Stadt | III\nKenzingen, Stadt | IV\nKernen im Remstal | V\nKetsch | IV\nKirchheim unter Teck, Stadt | V\nKorb | V\nKönigsbach-Stein | II\nKonstanz, Universitätsstadt | V\nKorntal-Münchingen, Stadt | VI\nKornwestheim, Stadt | VI\nKraichtal, Stadt | I\nKünzelsau, Stadt | III\nLadenburg, Stadt | IV\nLahr/Schwarzwald, Stadt | III\nLaichingen, Stadt | III\nLangenau, Stadt | III\nLauda-Königshofen, Stadt | I\nLauffen am Neckar, Stadt | IV\nLaupheim, Stadt | III\nLeimen, Stadt | IV\nLeinfelden-Echterdingen, Stadt | VI\nLeingarten, Stadt | IV\nLeonberg, Stadt | VI\nLeutenbach | IV\nLeutkirch im Allgäu, Stadt | II\nLinkenheim-Hochstetten | III\nLorch, Stadt | III\nLörrach, Stadt | V\nLudwigsburg, Stadt | VI\nMalsch | III\nMannheim, Universitätsstadt | V\nMarbach am Neckar, Stadt | V\nMarkdorf, Stadt | V\nMarkgröningen, Stadt | IV\nMeckenbeuren | IV\nMeßstetten, Stadt | II\nMetzingen, Stadt | V\nMöglingen | V\nMössingen, Stadt | IV\nMosbach, Stadt | III\nMühlacker, Stadt | III\nMüllheim, Stadt | IV\nMünsingen, Stadt | II\nMurrhardt, Stadt | II\nNagold, Stadt | IV\nNeckargemünd, Stadt | III\nNeckarsulm, Stadt | IV\nNeuenburg am Rhein, Stadt | V\nNeuenstadt am Kocher, Stadt | II\nNeuhausen auf den Fildern | V\nNiefern-Öschelbronn | III\nNürtingen, Stadt | IV\nNußloch | V\nOberderdingen | III\nOberkirch, Stadt | II\nOberndorf am Neckar, Stadt | II\nObersulm | III\nÖhringen, Stadt | IV\nÖstringen, Stadt | II\nOffenburg, Stadt | III\nOftersheim | IV\nOstfildern, Stadt | V\nPfinztal | III\nPforzheim, Stadt | IV\nPfullendorf, Stadt | II\nPfullingen, Stadt | IV\nPhillipsburg, Stadt | II\nPlankstadt | IV\nPlochingen, Stadt | V\nRadolfzell am Bodensee, Stadt | IV\nRastatt, Stadt | III\nRavensburg, Stadt | V\nRemchingen | II\nRemseck am Neckar, Stadt | V\nRemshalden | III\nRenningen, Stadt | V\nReutlingen, Stadt | IV\nRheinfelden (Baden), Stadt | IV\nRheinau, Stadt | II\nRheinstetten, Stadt | IV\nRiedlingen, Stadt | II\nRielasingen-Worblingen | IV\nRottenburg am Neckar, Stadt | IV\nRottweil, Stadt | III\nRudersberg | II\nRutesheim, Stadt | V\nSachsenheim, Stadt | IV\nSalem | III\nSandhausen | IV\nSt. Georgen i. Schwarzwald, Stadt | II\nSankt Leon-Rot | III\nSchopfheim, Stadt | III\nSchorndorf, Stadt | IV\nSchönaich | IV\nSchramberg, Stadt | II\nSchriesheim, Stadt | IV\nSchwäbisch Gmünd, Stadt | III\nSchwäbisch Hall, Stadt | III\nSchwaigern, Stadt | III\nSchwetzingen, Stadt | IV\nSchwieberdingen | VI\nSigmaringen, Stadt | II\nSindelfingen, Stadt | IV\nSingen (Hohentwiel), Stadt | IV\nSinsheim, Stadt | III\nSinzheim | IV\nSpaichingen, Stadt | III\nSteinheim an der Murr, Stadt | IV\nStockach, Stadt | II\nStraubenhardt | II\nStutensee, Stadt | III\nStuttgart, Landeshauptstadt | VI\nSüßen, Stadt | III\nSulz am Neckar, Stadt | II\nTamm | VI\nTauberbischofsheim, Stadt | I\nTeningen | III\nTettnang, Stadt | V\nTitisee-Neustadt, Stadt | II\nTrossingen, Stadt | IV\nTübingen, Universitätsstadt | VII\nTuttlingen, Stadt | IV\nUbstadt-Weiher | III\nÜberlingen, Stadt | IV\nUhingen, Stadt | III\nUlm, Universitätsstadt | IV\nVaihingen an der Enz, Stadt | III\nVillingen-Schwenningen, Stadt | III\nWaghäusel, Stadt | III\nWaiblingen, Stadt | V\nWaldbronn | IV\nWaldkirch, Stadt | IV\nWaldshut-Tiengen, Stadt | III\nWalldorf, Stadt | IV\nWalldürn, Stadt | I\nWangen im Allgäu, Stadt | III\nWehr, Stadt | IV\nWeil am Rhein, Stadt | V\nWeil der Stadt, Stadt | V\nWeilheim an der Teck, Stadt | III\nWeil im Schönbuch | VI\nWeingarten, Baden | III\nWeingarten, Stadt | V\nWeinheim, Stadt | IV\nWeinsberg, Stadt | IV\nWeinstadt, Stadt | V\nWelzheim, Stadt | III\nWendlingen am Neckar, Stadt | IV\nWernau (Neckar), Stadt | V\nWertheim, Stadt | II\nWiesloch, Stadt | IV\nWildberg, Stadt | II\nWinnenden, Stadt | V\nKreis | Mietenstufe\nAlb-Donau-Kreis | II\nBiberach | II\nBodenseekreis | IV\nBöblingen | V\nBreisgau-Hochschwarzwald | IV\nCalw | II\nEmmendingen | II\nEnzkreis | III\nEsslingen | IV\nFreudenstadt | I\nGöppingen | II\nHeidenheim | II\nHeilbronn | III\nHohenlohekreis | I\nKarlsruhe | II\nKonstanz | III\nLörrach | III\nLudwigsburg | IV\nMain-Tauber-Kreis | I\nNeckar-Odenwald-Kreis | I\nOrtenaukreis | II\nOstalbkreis | II\nRastatt | II\nRavensburg | II\nRems-Murr-Kreis | III\nReutlingen | III\nRhein-Neckar-Kreis | II\nRottweil | I\nSchwäbisch-Hall | I\nSchwarzwald-Baar-Kreis | II\nSigmaringen | I\nTübingen | IV\nTuttlingen | II\nWaldshut | II\nZollernalbkreis | I\nLand: Bayern\nGemeinde | Mietenstufe\nAbensberg, Stadt | III\nAichach, Stadt | III\nAltdorf, Markt | III\nAltdorf bei Nürnberg, Stadt | II\nAltötting, Stadt | II\nAltusried, Markt | I\nAlzenau i. Ufr., Stadt | II\nAmberg, Stadt | II\nAnsbach, Stadt | III\nAschaffenburg, Stadt | IV\nAugsburg, Stadt | V\nBad Abbach, Markt | III\nBad Aibling, Stadt | V\nBad Kissingen, Stadt | II\nBad Neustadt a. d. Saale, Stadt | I\nBad Reichenhall, Stadt | III\nBad Staffelstein, Stadt | I\nBad Tölz, Stadt | V\nBad Windsheim, Stadt | II\nBad Wörishofen, Stadt | III\nBamberg, Stadt | III\nBayreuth, Stadt | III\nBobingen, Stadt | IV\nBogen | II\nBruckmühl, Markt | IV\nBuchloe, Stadt | IV\nBurgau, Stadt | II\nBurghausen, Stadt | III\nBurgkirchen a. d. Alz | I\nBurglengenfeld, Stadt | II\nBurgthann | III\nCadolzburg, Markt | III\nCham, Stadt | I\nCoburg, Stadt | II\nDachau, Stadt | VII\nDeggendorf, Stadt | II\nDiedorf, Markt | IV\nDießen a. Ammersee, Markt | V\nDillingen a. d. Donau, Stadt | II\nDingolfing, Stadt | II\nDinkelsbühl, Stadt | I\nDonauwörth, Stadt | II\nDorfen, Stadt | IV\nEbersberg, Stadt | VI\nEching | VII\nEckental, Markt | III\nEggenfelden, Stadt | II\nEichenau | VII\nEichstätt, Stadt | III\nErding, Stadt | VI\nErgolding, Markt | IV\nErlangen, Stadt | IV\nErlenbach am Main, Stadt | II\nEssenbach, Markt | II\nFeldkirchen-Westerham | V\nFeucht, Markt | IV\nFeuchtwangen, Stadt | II\nForchheim, Stadt | III\nFreilassing, Stadt | III\nFreising, Stadt | VII\nFriedberg, Stadt | III\nFürstenfeldbruck, Stadt | VII\nFürth, Stadt | IV\nFüssen, Stadt | III\nGaimersheim, Markt | V\nGarching bei München, Stadt | VII\nGarmisch-Partenkirchen, Markt | VI\nGauting | VI\nGeisenfeld, Stadt | III\nGemünden am Main, Stadt | I\nGeretsried, Stadt | IV\nGermering, Stadt | VII\nGersthofen, Stadt | III\nGilching | VII\nGoldbach, Markt | III\nGräfelfing | VII\nGrafing bei München, Stadt | VII\nGröbenzell | VII\nGroßostheim, Markt | II\nGrünwald | VII\nGünzburg, Stadt | II\nGunzenhausen, Stadt | I\nHaar | VII\nHallbergmoos | VII\nHammelburg, Stadt | I\nHaßfurt, Stadt | II\nHauzenberg, Stadt | I\nHerrsching a. Ammersee | V\nHersbruck, Stadt | III\nHerzogenaurach, Stadt | IV\nHilpoltstein, Stadt | II\nHirschaid, Markt | I\nHöchstadt a. d. Aisch, Stadt | III\nHöhenkirchen-Siegertsbrunn | VII\nHösbach, Markt | II\nHof, Stadt | I\nHolzkirchen, Markt | VI\nIllertissen, Stadt | III\nImmenstadt i. Allgäu, Stadt | III\nIngolstadt | V\nIsmaning | VI\nKarlsfeld | VII\nKarlstadt, Stadt | II\nKaufbeuren, Stadt | III\nKaufering, Markt | IV\nKelheim, Stadt | III\nKempten (Allgäu), Stadt | IV\nKirchheim bei München | VI\nKirchseeon, Markt | VI\nKissing | IV\nKitzingen, Stadt | II\nKönigsbrunn, Stadt | IV\nKolbermoor, Stadt | IV\nKronach, Stadt | II\nKrumbach (Schwaben), Stadt | II\nKulmbach, Stadt | I\nLandau an der Isar, Stadt | I\nLandsberg a. Lech, Stadt | VI\nLandshut, Stadt | IV\nLangenzenn, Stadt | III\nLappersdorf, Markt | III\nLauf a. d. Pegnitz, Stadt | IV\nLauingen (Donau), Stadt | II\nLenggries | III\nLichtenfels, Stadt | I\nLindau (Bodensee), Stadt | V\nLindenberg i. Allgäu, Stadt | III\nLohr am Main, Stadt | II\nMainburg, Stadt | III\nMaisach | VI\nManching, Markt | V\nMarkt Indersdorf, Markt | VI\nMarkt Schwaben, Markt | VII\nMarktheidenfeld, Stadt | II\nMarktoberdorf, Stadt | III\nMarktredwitz, Stadt | I\nMaxhütte-Haidhof, Stadt | II\nMeitingen, Markt | III\nMemmingen, Stadt | III\nMering, Markt | IV\nMiesbach, Stadt | IV\nMindelheim, Stadt | III\nMömbris, Markt | I\nMoosburg an der Isar, Stadt | VI\nMühldorf am Inn, Stadt | III\nMünchberg, Stadt | I\nMünchen | VII\nMurnau am Staffelsee, Markt | VI\nNeubiberg | VII\nNeuburg an der Donau, Stadt | IV\nNeufahrn bei Freising | VII\nNeumarkt i. d. Oberpfalz, Stadt | III\nNeusäß, Stadt | IV\nNeustadt an der Aisch, Stadt | II\nNeustadt an der Donau, Stadt | II\nNeustadt bei Coburg, Stadt | I\nNeutraubling, Stadt | IV\nNeu-Ulm, Stadt | V\nNördlingen, Stadt | II\nNürnberg, Stadt | V\nOberasbach, Stadt | IV\nOberhaching | VII\nOberschleißheim | VII\nOchsenfurt, Stadt | II\nOlching | VII\nOsterhofen, Stadt | I\nOttobrunn | VII\nPassau, Stadt | III\nPegnitz, Stadt | II\nPeißenberg, Markt | IV\nPeiting, Markt | III\nPenzberg, Stadt | IV\nPfaffenhofen a. d. Ilm, Stadt | IV\nPfarrkirchen, Stadt | II\nPlanegg | VII\nPlattling, Stadt | II\nPocking, Stadt | I\nPoing | VI\nPrien am Chiemsee, Markt | IV\nPuchheim | VII\nRaubling | III\nRegen, Stadt | I\nRegensburg, Stadt | V\nRegenstauf, Markt | II\nRoding, Stadt | I\nRödental, Stadt | I\nRöthenbach a. d. Pegnitz, Stadt | III\nRosenheim | V\nRoßtal, Markt | II\nRoth, Stadt | II\nRothenburg ob der Tauber, Stadt | I\nSchongau, Stadt | III\nSchrobenhausen, Stadt | II\nSchwabach, Stadt | III\nSchwabmünchen, Stadt | III\nSchwandorf, Stadt | II\nSchweinfurt, Stadt | II\nSelb, Stadt | I\nSenden, Stadt | IV\nSimbach a. Inn, Stadt | I\nSonthofen, Stadt | III\nStadtbergen, Markt | IV\nStarnberg, Stadt | VII\nStein, Stadt | IV\nStephanskirchen | IV\nStraubing, Stadt | II\nSulzbach-Rosenberg, Stadt | I\nTaufkirchen | II\nTaufkirchen (Vils) | V\nTraunreut, Stadt | III\nTraunstein, Stadt | III\nTreuchtlingen, Stadt | I\nTrostberg, Stadt | II\nUnterföhring | VII\nUnterhaching | VII\nUnterschleißheim | VII\nVaterstetten | VII\nVilsbiburg, Stadt | II\nVilshofen a. d. Donau, Stadt | I\nVöhringen, Stadt | IV\nWaldkirchen, Stadt | I\nWaldkraiburg, Stadt | II\nWasserburg am Inn, Stadt | IV\nWeiden i. d. Oberpfalz, Stadt | I\nWeilheim i. OB, Stadt | V\nWeißenburg i. Bayern, Stadt | I\nWeißenhorn, Stadt | III\nWendelstein, Markt | IV\nWerneck, Markt | I\nWolfratshausen, Stadt | VI\nWolnzach, Markt | III\nWürzburg, Stadt | IV\nZirndorf, Stadt | III\nKreis | Mietenstufe\nAichach-Friedberg | III\nAltötting | I\nAmberg-Sulzbach | I\nAnsbach | I\nAschaffenburg | II\nAugsburg | II\nBad Kissingen | I\nBad Tölz-Wolfratshausen | IV\nBamberg | I\nBayreuth | I\nBerchtesgadener Land | III\nCham | I\nCoburg | I\nDachau | V\nDeggendorf | I\nDillingen a. d. Donau | I\nDingolfing-Landau | I\nDonau-Ries | I\nEbersberg | VI\nEichstätt | III\nErding | IV\nErlangen-Höchstadt | III\nForchheim | I\nFreising | IV\nFreyung-Grafenau | I\nFürth | II\nFürstenfeldbruck | VI\nGarmisch-Partenkirchen | IV\nGünzburg | I\nHaßberge | I\nHof | I\nKelheim | I\nKitzingen | I\nKronach | I\nKulmbach | I\nLandsberg a. Lech | III\nLandshut | II\nLichtenfels | I\nLindau (Bodensee) | II\nMain-Spessart | I\nMiesbach | IV\nMiltenberg | I\nMühldorf a. Inn | I\nMünchen | VII\nNeuburg-Schrobenhausen | II\nNeumarkt i. d. Oberpfalz | I\nNeustadt/Aisch-Bad Windsheim | I\nNeustadt a. d. Waldnaab | I\nNeu-Ulm | III\nNürnberger Land | II\nOberallgäu | II\nOstallgäu | I\nPassau | I\nPfaffenhofen a. d. Ilm | III\nRegen | I\nRegensburg | II\nRhön-Grabfeld | I\nRosenheim | IV\nRoth | II\nRottal-Inn | I\nSchwandorf | I\nSchweinfurt | I\nStarnberg | V\nStraubing-Bogen | I\nTirschenreuth | I\nTraunstein | II\nUnterallgäu | I\nWeilheim-Schongau | III\nWeißenburg-Gunzenhausen | I\nWürzburg | II\nWunsiedel im Fichtelgebirge | I\nLand: Berlin\nGemeinde | Mietenstufe\nBerlin, Stadt | IV\nLand: Brandenburg\nGemeinde | Mietenstufe\nAhrensfelde-Blumberg | II\nAngermünde, Stadt | II\nBad Freienwalde (Oder), Stadt | I\nBeelitz, Stadt | II\nBad Belzig | II\nBernau bei Berlin, Stadt | III\nBlankenfelde-Mahlow | IV\nBrandenburg a. d. Havel, Stadt | II\nBrieselang | IV\nCottbus, Stadt | II\nDallgow-Döberitz | V\nEberswalde, Stadt | III\nEisenhüttenstadt, Stadt | II\nErkner, Stadt | IV\nFalkensee, Stadt | IV\nFinsterwalde, Stadt | II\nForst (Lausitz), Stadt | I\nFrankfurt (Oder), Stadt | II\nFredersdorf-Vogelsdorf | IV\nFürstenwalde/Spree, Stadt | II\nGlienicke/Nordbahn | VI\nGuben, Stadt | I\nHennigsdorf, Stadt | III\nHohen Neuendorf | IV\nHoppegarten | V\nJüterbog, Stadt | I\nKleinmachnow | V\nKloster Lehnin | III\nKönigs Wusterhausen, Stadt | III\nLauchhammer, Stadt | I\nLübben/Spreewald, Stadt | II\nLübbenau/Spreewald, Stadt | I\nLuckenwalde, Stadt | II\nLudwigsfelde, Stadt | III\nMichendorf | V\nMühlenbecker Land | III\nNauen, Stadt | III\nNeuenhagen bei Berlin | III\nNeuruppin, Stadt | II\nOberkrämer | III\nOranienburg, Stadt | III\nPanketal | IV\nPerleberg, Stadt | I\nPetershagen/Eggersdorf | III\nPotsdam, Stadt | IV\nPrenzlau, Stadt | II\nPritzwalk, Stadt | I\nRangsdorf | III\nRathenow, Stadt | I\nRüdersdorf bei Berlin | II\nSchöneiche bei Berlin | IV\nSchönefeld | IV\nSchorfheide | II\nSchwedt/Oder, Stadt | II\nSchwielowsee | IV\nSenftenberg, Stadt | II\nSpremberg, Stadt | II\nStahnsdorf | IV\nStrausberg, Stadt | II\nTeltow, Stadt | IV\nTemplin, Stadt | II\nVelten, Stadt | III\nWandlitz | IV\nWittstock/Dosse, Stadt | I\nWerder (Havel), Stadt | IV\nWildau | IV\nWittenberge, Stadt | I\nZehdenick, Stadt | I\nZeuthen | III\nZossen | II\nKreis | Mietenstufe\nBarnim | II\nDahme-Spreewald | II\nElbe-Elster | I\nHavelland | II\nMärkisch-Oderland | I\nOberhavel | I\nOberspreewald-Lausitz | I\nOder-Spree | III\nOstprignitz-Ruppin | I\nPotsdam-Mittelmark | II\nPrignitz | I\nSpree-Neiße | I\nTeltow-Fläming | I\nUckermark | I\nLand: Bremen\nGemeinde | Mietenstufe\nBremen, Stadt | IV\nBremerhaven | II\nLand: Hamburg\nGemeinde | Mietenstufe\nHamburg, Freie und Hansestadt | VI\nLand: Hessen\nGemeinde | Mietenstufe\nAlsfeld, Stadt | I\nAltenstadt | II\nArolsen, Stadt | I\nAsslar, Stadt | III\nBabenhausen, Stadt | III\nBad Camberg, Stadt | II\nBad Hersfeld, Kreisstadt | I\nBad Homburg v.d. Höhe, Stadt | VII\nBad Nauheim, Stadt | V\nBad Orb, Stadt | III\nBad Schwalbach, Kreisstadt | IV\nBad Soden am Taunus, Stadt | VI\nBad Soden-Salmünster, Stadt | II\nBad Vilbel, Stadt | VI\nBad Wildungen, Stadt | I\nBaunatal, Stadt | III\nBebra, Stadt | I\nBensheim, Stadt | IV\nBiedenkopf, Stadt | I\nBiebertal | III\nBischofsheim | IV\nBorken (Hessen), Stadt | I\nBraunfels, Stadt | III\nBruchköbel, Stadt | III\nBüdingen, Stadt | II\nBürstadt, Stadt | II\nBüttelborn | IV\nBuseck | II\nButzbach, Stadt | III\nDarmstadt, Stadt | VI\nDautphetal | I\nDieburg, Stadt | V\nDietzenbach, Stadt | VI\nDillenburg, Stadt | II\nDreieich, Stadt | VI\nEgelsbach | IV\nEichenzell | I\nEltville am Rhein, Stadt | V\nEppstein, Stadt | V\nErbach, Kreisstadt | III\nErlensee | IV\nEschborn, Stadt | VI\nEschwege, Kreisstadt | I\nFelsberg, Stadt | I\nFlörsheim am Main, Stadt | VI\nFrankenberg (Eder), Stadt | I\nFrankfurt am Main, Stadt | VI\nFreigericht | III\nFriedberg (Hessen), Stadt | IV\nFriedrichsdorf, Stadt | VI\nFritzlar, Stadt | I\nFürth | II\nFulda, Stadt | II\nFuldatal | I\nGeisenheim, Stadt | IV\nGelnhausen, Stadt | IV\nGernsheim | III\nGiessen, Universitätsstadt | V\nGinsheim-Gustavsburg | IV\nGladenbach, Stadt | II\nGriesheim, Stadt | V\nGroß-Gerau, Stadt | V\nGroß-Umstadt, Stadt | III\nGroß-Zimmern | IV\nGrünberg, Stadt | I\nGründau | II\nHadamar, Stadt | I\nHaiger, Stadt | I\nHainburg | III\nHanau, Stadt | V\nHattersheim am Main, Stadt | VI\nHeppenheim (Bergstr.), Stadt | III\nHerborn, Stadt | II\nHessisch Lichtenau, Stadt | I\nHeusenstamm, Stadt | VI\nHochheim am Main, Stadt | V\nHöchst i. Odenwald | III\nHofgeismar, Stadt | I\nHofheim am Taunus, Stadt | V\nHomberg (Efze), Stadt | I\nHünfeld, Stadt | I\nHünstetten | II\nHüttenberg | II\nHungen, Stadt | II\nIdstein, Stadt | III\nKarben, Stadt | IV\nKassel, Stadt | III\nKaufungen | II\nKelkheim (Taunus), Stadt | VI\nKelsterbach, Stadt | IV\nKirchhain, Stadt | I\nKönigstein im Taunus, Stadt | VII\nKorbach, Stadt | I\nKriftel | V\nKronberg im Taunus, Stadt | VI\nKünzell | II\nLampertheim, Stadt | III\nLangen (Hessen), Stadt | VI\nLangenselbold, Stadt | III\nLanggöns | II\nLauterbach (Hessen), Stadt | I\nLich, Stadt | II\nLimburg an der Lahn, Stadt | II\nLinden, Stadt | III\nLohfelden | II\nLollar | III\nLorsch, Stadt | III\nMaintal, Stadt | V\nMarburg, Stadt | V\nMelsungen, Stadt | I\nMichelstadt, Stadt | III\nMörfelden-Walldorf, Stadt | V\nMoerlenbach | II\nMühlheim am Main, Stadt | V\nMühltal | VI\nMünster | IV\nNauheim | IV\nNeu-Anspach | IV\nNeuhof | I\nNeu-Isenburg, Stadt | VI\nNeustadt | I\nNidda, Stadt | II\nNidderau, Stadt | III\nNiedernhausen | IV\nNiestetal | II\nOber-Ramstadt, Stadt | V\nObertshausen, Stadt | V\nOberursel (Taunus), Stadt | VI\nOberzent | I\nOestrich-Winkel, Stadt | IV\nOffenbach am Main, Stadt | VI\nPetersberg | II\nPfungstadt, Stadt | IV\nPohlheim, Stadt | II\nRaunheim, Stadt | VII\nReinheim, Stadt | IV\nReiskirchen | II\nRiedstadt | IV\nRodenbach | III\nRodgau, Stadt | V\nRödermark, Stadt | V\nRosbach v. d. Höhe, Stadt | IV\nRossdorf | V\nRotenburg a. d. Fulda, Stadt | I\nRüsselsheim, Stadt | V\nSchauenburg | I\nSchlüchtern, Stadt | II\nSchöneck | IV\nSchotten, Stadt | I\nSchwalbach am Taunus, Stadt | VI\nSchwalmstadt, Stadt | I\nSeeheim-Jugenheim | IV\nSeligenstadt, Stadt | III\nSolms, Stadt | I\nStadtallendorf, Stadt | II\nSteinau an der Straße, Stadt | II\nSteinbach (Taunus) | IV\nTaunusstein, Stadt | IV\nTrebur | V\nUsingen, Stadt | IV\nVellmar, Stadt | II\nViernheim, Stadt | III\nWächtersbach, Stadt | II\nWald-Michelbach | I\nWeilburg, Stadt | I\nWeiterstadt, Stadt | V\nWettenberg | III\nWetzlar, Stadt | III\nWiesbaden, Landeshaupstadt | VI\nWitzenhausen, Stadt | I\nWolfhagen, Stadt | I\nKreis | Mietenstufe\nBergstraße | II\nDarmstadt-Dieburg | IV\nFulda | I\nGiessen | II\nGroß-Gerau | IV\nHersfeld-Rotenburg | I\nHochtaunuskreis | IV\nKassel | I\nLahn-Dill-Kreis | I\nLimburg-Weilburg | I\nMain-Kinzig-Kreis | II\nMain-Taunus-Kreis | VII\nMarburg-Biedenkopf | I\nOdenwaldkreis | II\nOffenbach | III\nRheingau-Taunus-Kreis | III\nSchwalm-Eder-Kreis | I\nVogelsbergkreis | I\nWaldeck-Frankenberg | I\nWerra-Meißner-Kreis | I\nWetteraukreis | II\nLand: Mecklenburg-Vorpommern\nGemeinde | Mietenstufe\nAnklam, Stadt | II\nBad Doberan, Stadt | III\nBergen auf Rügen, Stadt | II\nBoizenburg/Elbe, Stadt | II\nDemmin, Stadt | I\nGreifswald, Stadt | III\nGrevesmühlen, Stadt | II\nGüstrow, Stadt | II\nHagenow, Stadt | I\nLudwigslust, Stadt | I\nNeubrandenburg, Stadt | II\nNeustrelitz, Stadt | II\nParchim, Stadt | II\nRibnitz-Damgarten, Stadt | II\nRostock, Hansestadt | III\nSchwerin, Landeshauptstadt | II\nStralsund, Stadt | II\nWaren (Müritz), Stadt | II\nWismar, Stadt | III\nWolgast, Stadt | II\nKreis | Mietenstufe\nMecklenburgische Seenplatte | I\nLandkreis Rostock | II\nVorpommern-Rügen | II\nNordwestmecklenburg | II\nVorpommern-Greifswald | I\nLudwigslust-Parchim | I\nLand: Niedersachsen\nGemeinde | Mietenstufe\nAchim, Stadt | III\nAdendorf | IV\nAerzen, Flecken | I\nAlfeld (Leine), Stadt | I\nApen | I\nAurich, Stadt | I\nBad Bentheim, Stadt | II\nBad Essen | I\nBad Fallingbostel, Stadt | I\nBad Harzburg, Stadt | II\nBad Iburg, Stadt | II\nBad Lauterberg im Harz, Stadt | I\nBad Münder am Deister, Stadt | I\nBad Nenndorf | II\nBad Pyrmont, Stadt | I\nBad Salzdetfurth, Stadt | II\nBad Zwischenahn | II\nBarsinghausen, Stadt | II\nBarßel | I\nBassum, Stadt | II\nBelm | II\nBergen, Stadt | I\nBeverstedt | I\nBissendorf | I\nBohmte | I\nBovenden, Flecken | III\nBrake (Unterweser), Stadt | II\nBramsche, Stadt | I\nBraunschweig, Stadt | IV\nBremervörde, Stadt | II\nBuchholz i. d. Nordheide, Stadt | VI\nBückeburg, Stadt | I\nBurgdorf, Stadt | III\nBurgwedel | III\nBuxtehude, Stadt | V\nCelle, Stadt | III\nClausthal-Zellerfeld | I\nCloppenburg, Stadt | II\nCremlingen | II\nCuxhaven, Stadt | II\nDamme, Stadt | I\nDelmenhorst, Stadt | III\nDiepholz, Stadt | I\nDinklage, Stadt | I\nDissen am Teutoburger Wald | II\nDrochtersen | II\nDuderstadt, Stadt | I\nEdemissen | II\nEdewecht | II\nEinbeck, Stadt | I\nEmden, Stadt | II\nEmsbueren | I\nEmstek | I\nFriedeburg | I\nFriedland | II\nFriesoythe, Stadt | I\nGanderkesee | II\nGarbsen, Stadt | IV\nGarrel | I\nGeeste | I\nGeestland, Stadt | II\nGehrden, Stadt | III\nGeorgsmarienhütte, Stadt | II\nGifhorn, Stadt | III\nGoslar, Stadt | II\nGöttingen, Stadt | IV\nGronau (Leine), Stadt | I\nGrossefehn | I\nGrossenkneten | II\nHagen im Bremischen | I\nHagen am Teutoburger Wald | I\nHambühren | I\nHameln, Stadt | II\nHannover, Landeshauptstadt | V\nHaren (Ems), Stadt | I\nHarsefeld, Flecken | III\nHarsum | II\nHasbergen | II\nHaselünne, Stadt | I\nHatten | II\nHelmstedt, Stadt | I\nHemmingen | IV\nHerzberg am Harz, Stadt | I\nHessisch Oldendorf, Stadt | I\nHildesheim, Stadt | III\nHilter am Teutoburger Wald | I\nHolzminden, Stadt | I\nHude (Oldenburg) | I\nIhlow | I\nIlsede | II\nIsernhagen | III\nJever, Stadt | I\nJork | IV\nKönigslutter am Elm, Stadt | II\nKrummhörn | I\nLaatzen, Stadt | IV\nLangelsheim, Stadt | I\nLangenhagen, Stadt | IV\nLangwedel, Flecken | II\nLeer (Ostfriesland), Stadt | II\nLehre | III\nLehrte, Stadt | III\nLengede | II\nLilienthal | III\nLingen (Ems), Stadt | I\nLohne (Oldenburg), Stadt | II\nLöningen, Stadt | I\nLoxstedt | I\nLüneburg, Stadt | IV\nMelle, Stadt | I\nMeppen, Stadt | I\nMoormerland | I\nHann. Münden, Stadt | I\nMunster, Stadt | II\nNeuenhaus, Stadt | I\nNeu Wulmstorf | VI\nNeustadt am Rübenberge, Stadt | II\nNienburg (Weser), Stadt | II\nNorden, Stadt | II\nNordenham, Stadt | II\nNordhorn, Stadt | II\nNordstemmen | II\nNortheim, Stadt | II\nOldenburg (Oldenburg), Stadt | IV\nOsnabrück, Stadt | IV\nOsterholz-Scharmbeck, Stadt | II\nOsterode am Harz, Stadt | I\nOstrhauderfehn | I\nOttersberg, Flecken | II\nOyten | III\nPapenburg, Stadt | I\nPattensen, Stadt | III\nPeine, Stadt | III\nQuakenbrück, Stadt | II\nRastede | II\nRehburg-Loccum, Stadt | I\nRhauderfehn | I\nRinteln, Stadt | I\nRitterhude | III\nRonnenberg, Stadt | IV\nRosdorf | III\nRosengarten | IV\nRotenburg (Wümme), Stadt | II\nSalzgitter, Stadt | II\nSarstedt, Stadt | II\nSassenburg | I\nSaterland | I\nScheeßel | I\nSchiffdorf | I\nSchneverdingen, Stadt | II\nSchöningen, Stadt | I\nSchortens | I\nSchüttorf, Stadt | I\nSchwanewede | II\nSeelze, Stadt | III\nSeesen, Stadt | I\nSeevetal | V\nSehnde, Stadt | III\nSoltau, Stadt | II\nSpringe, Stadt | II\nStade, Stadt | IV\nStadthagen, Stadt | II\nSteinfeld (Oldenburg) | I\nStelle | IV\nStuhr | II\nSüdbrookmerland | I\nSüdheide | I\nSulingen, Stadt | II\nSyke, Stadt | II\nTostedt | III\nTwistringen, Stadt | I\nUelzen, Stadt | II\nUetze | II\nUplengen | I\nUslar, Stadt | I\nVarel, Stadt | I\nVechelde | I\nVechta, Stadt | II\nVerden (Aller), Stadt | II\nWallenhorst | I\nWalsrode, Stadt | II\nWardenburg | II\nWedemark | III\nWeener, Stadt | I\nWendeburg | I\nWennigsen (Deister) | II\nWerlte | I\nWesterstede, Stadt | I\nWestoverledingen | I\nWeyhe | III\nWiefelstede | II\nWiesmoor | I\nWietmarschen | I\nWildeshausen, Stadt | II\nWilhelmshaven, Stadt | II\nWinsen (Aller) | II\nWinsen (Luhe), Stadt | IV\nWittingen, Stadt | I\nWittmund, Stadt | I\nWolfenbüttel, Stadt | III\nWurster Nordseeküste | I\nWolfsburg, Stadt | IV\nWunstorf, Stadt | III\nZetel | I\nZeven, Stadt | II\nKreis | Mietenstufe\nAurich | I\nCelle | I\nCloppenburg | I\nCuxhaven | I\nDiepholz | I\nEmsland | I\nFriesland | I\nGifhorn | I\nGöttingen | I\nGoslar | I\nGrafschaft Bentheim | I\nHameln-Pyrmont | I\nHarburg | III\nHelmstedt | I\nHildesheim | I\nHolzminden | I\nLeer | I\nLüchow-Dannenberg | I\nLüneburg | II\nNienburg (Weser) | I\nNortheim | I\nOldenburg | I\nOsnabrück | I\nOsterholz | I\nPeine | I\nRotenburg (Wümme) | I\nSchaumburg | I\nSoltau-Fallingbostel (Heidekreis) | I\nStade | II\nUelzen | I\nVechta | I\nVerden | I\nWesermarsch | I\nWittmund | I\nWolfenbüttel | I\nLand: Nordrhein-Westfalen\nGemeinde | Mietenstufe\nAachen, Stadt | IV\nAhaus, Stadt | II\nAhlen, Stadt | II\nAldenhoven | III\nAlfter | IV\nAlpen | III\nAlsdorf, Stadt | II\nAltena, Stadt | I\nAltenberge | II\nAnröchte | I\nArnsberg, Stadt | I\nAscheberg | II\nAttendorn, Stadt | II\nAugustdorf | I\nBad Berleburg, Stadt | I\nBad Driburg, Stadt | I\nBad Honnef, Stadt | IV\nBad Laasphe, Stadt | I\nBad Lippspringe, Stadt | II\nBad Münstereifel, Stadt | II\nBad Oeynhausen, Stadt | II\nBad Salzuflen, Stadt | II\nBad Sassendorf | II\nBad Wünnenberg, Stadt | I\nBaesweiler, Stadt | II\nBalve, Stadt | I\nBeckum, Stadt | II\nBedburg, Stadt | II\nBedburg-Hau | II\nBergheim, Stadt | III\nBergisch-Gladbach, Stadt | V\nBergkamen, Stadt | III\nBergneustadt, Stadt | II\nBestwig | I\nBeverungen, Stadt | I\nBielefeld, Stadt | III\nBillerbeck, Stadt | II\nBlomberg, Stadt | I\nBocholt, Stadt | III\nBochum, Stadt | III\nBönen | II\nBonn, Stadt | V\nBorchen | I\nBorken, Stadt | II\nBornheim, Stadt | IV\nBottrop, Stadt | III\nBrakel, Stadt | I\nBrilon, Stadt | I\nBrüggen | II\nBrühl, Stadt | V\nBünde, Stadt | I\nBüren, Stadt | I\nBurbach | II\nBurscheid, Stadt | IV\nCastrop-Rauxel, Stadt | III\nCoesfeld, Stadt | II\nDatteln, Stadt | II\nDelbrück, Stadt | II\nDetmold, Stadt | II\nDinslaken, Stadt | III\nDormagen, Stadt | IV\nDorsten, Stadt | II\nDortmund, Stadt | III\nDrensteinfurt, Stadt | II\nDrolshagen, Stadt | II\nDülmen, Stadt | II\nDüren, Stadt | II\nDüsseldorf, Stadt | VI\nDuisburg, Stadt | III\nEitorf | II\nElsdorf | III\nEmmerich am Rhein, Stadt | II\nEmsdetten, Stadt | II\nEngelskirchen | III\nEnger, Widukindstadt | I\nEnnepetal, Stadt | III\nEnnigerloh, Stadt | I\nEnse | I\nErftstadt, Stadt | III\nErkelenz, Stadt | II\nErkrath, Stadt | IV\nErwitte, Stadt | I\nEschweiler, Stadt | III\nEspelkamp, Stadt | II\nEssen, Stadt | III\nEuskirchen, Stadt | III\nExtertal | I\nFinnentrop | I\nFrechen, Stadt | IV\nFreudenberg, Stadt | II\nFröndenberg/Ruhr, Stadt | II\nGangelt | II\nGeilenkirchen, Stadt | II\nGeldern, Stadt | II\nGelsenkirchen, Stadt | II\nGescher, Stadt | II\nGeseke, Stadt | I\nGevelsberg, Stadt | II\nGladbeck, Stadt | II\nGoch, Stadt | II\nGrefrath, Sport- und Freizeitgemeinde | II\nGreven, Stadt | II\nGrevenbroich, Stadt | III\nGronau (Westfalen), Stadt | II\nGütersloh, Stadt | III\nGummersbach, Stadt | II\nHaan, Stadt | IV\nHagen, Stadt | II\nHalle (Westfalen), Stadt | II\nHaltern am See, Stadt | III\nHalver, Stadt | III\nHamm, Stadt | II\nHamminkeln, Stadt | II\nHarsewinkel, Stadt | II\nHattingen, Stadt | III\nHavixbeck | III\nHeiligenhaus, Stadt | IV\nHeinsberg, Stadt | II\nHemer, Stadt | II\nHennef (Sieg), Stadt | IV\nHerdecke, Stadt | III\nHerford, Stadt | II\nHerne, Stadt | II\nHerten, Stadt | II\nHerzebrock-Clarholz | II\nHerzogenrath, Stadt | III\nHiddenhausen | II\nHilchenbach, Stadt | II\nHilden, Stadt | V\nHille | I\nHörstel, Stadt | I\nHövelhof, Sennegemeinde | I\nHöxter, Stadt | I\nHolzwickede | III\nHorn-Bad Meinberg, Stadt | I\nHückelhoven, Stadt | II\nHückeswagen, Stadt | III\nHüllhorst | I\nHünxe | II\nHürth, Stadt | V\nIbbenbüren, Stadt | II\nIserlohn, Stadt | II\nIsselburg, Stadt | I\nIssum | II\nJüchen | III\nJülich, Stadt | II\nKaarst, Stadt | V\nKalkar, Stadt | II\nKall | II\nKalletal | I\nKamen, Stadt | III\nKamp-Lintfort, Stadt | III\nKempen, Stadt | III\nKerken | II\nKerpen, Kolpingstadt | IV\nKevelaer, Stadt | II\nKierspe, Stadt | II\nKirchhundem | I\nKirchlengern | I\nKleve, Stadt | III\nKöln, Stadt | VI\nKönigswinter, Stadt | IV\nKorschenbroich, Stadt | III\nKranenburg | II\nKrefeld, Stadt | IV\nKreuzau | II\nKreuztal, Stadt | II\nKürten | III\nLage, Stadt | I\nLangenfeld (Rheinland), Stadt | IV\nLangerwehe | I\nLeichlingen (Rheinland), Stadt | IV\nLemgo, Stadt | II\nLengerich, Stadt | II\nLennestadt, Stadt | II\nLeopoldshöhe | II\nLeverkusen, Stadt | IV\nLichtenau, Stadt | I\nLindlar | II\nLinnich, Stadt | II\nLippetal | I\nLippstadt, Stadt | II\nLöhne, Stadt | II\nLohmar, Stadt | IV\nLotte | II\nLübbecke, Stadt | I\nLüdenscheid, Stadt | III\nLüdinghausen, Stadt | II\nLünen, Stadt | III\nMarienheide | II\nMarl, Stadt | III\nMarsberg, Stadt | I\nMechernich, Stadt | II\nMeckenheim, Stadt | III\nMeerbusch, Stadt | V\nMeinerzhagen, Stadt | II\nMenden (Sauerland), Stadt | II\nMeschede, Stadt | I\nMettingen | I\nMettmann, Stadt | IV\nMinden, Stadt | II\nMöhnesee | I\nMönchengladbach, Stadt | III\nMoers, Stadt | III\nMonheim am Rhein, Stadt | VI\nMonschau, Stadt | II\nMorsbach | I\nMuch | III\nMülheim an der Ruhr, Stadt | IV\nMünster, Stadt | IV\nNetphen | II\nNettetal, Stadt | II\nNeuenkirchen | I\nNeuenrade, Stadt | II\nNeukirchen-Vluyn, Stadt | III\nNeunkirchen | II\nNeunkirchen-Seelscheid | III\nNeuss, Stadt | IV\nNideggen, Stadt | II\nNiederkassel, Stadt | IV\nNiederkrüchten | II\nNiederzier | II\nNordkirchen | I\nNörvenich | II\nNottuln | II\nNümbrecht | II\nOberhausen, Stadt | II\nOchtrup, Stadt | I\nOdenthal | III\nOelde, Stadt | I\nOer-Erkenschwick, Stadt | II\nOerlinghausen, Stadt | II\nOlfen, Stadt | II\nOlpe, Stadt | II\nOlsberg, Stadt | I\nOstbevern | II\nOverath | IV\nPaderborn, Stadt | II\nPetershagen, Stadt | I\nPlettenberg, Stadt | I\nPorta Westfalica, Stadt | I\nPreußisch Oldendorf, Stadt | I\nPulheim, Stadt | V\nRadevormwald, Stadt auf der Höhe | III\nRaesfeld | I\nRahden, Stadt | I\nRatingen, Stadt | V\nRecke | I\nRecklinghausen, Stadt | III\nRees, Stadt | II\nReichshof | I\nReken | I\nRemscheid, Stadt | III\nRheda-Wiedenbrück, Stadt | III\nRhede, Stadt | II\nRheinbach, Stadt | III\nRheinberg, Stadt | III\nRheine, Stadt | II\nRietberg, Stadt | I\nRösrath | V\nRommerskirchen | IV\nRosendahl | I\nRuppichteroth | II\nRüthen, Stadt | I\nSalzkotten, Stadt | I\nSankt Augustin, Stadt | IV\nSassenberg, Stadt | II\nSchalksmühle | II\nSchermbeck | II\nSchleiden, Stadt | I\nSchloß Holte-Stukenbrock | II\nSchmallenberg, Stadt | I\nSchwalmtal | II\nSchwelm, Stadt | III\nSchwerte, Hansestadt a. d. Ruhr | III\nSelfkant | II\nSelm, Stadt | II\nSenden | II\nSendenhorst, Stadt | II\nSiegburg, Stadt | IV\nSiegen, Universitätsstadt | III\nSimmerath | II\nSoest, Stadt | II\nSolingen, Klingenstadt | III\nSpenge, Stadt | I\nSprockhövel, Stadt | III\nStadtlohn, Stadt | II\nSteinfurt, Stadt | II\nSteinhagen | II\nSteinheim, Stadt | I\nStemwede | I\nStolberg (Rheinland), Kupferstadt | III\nStraelen, Stadt | II\nSundern (Sauerland), Stadt | I\nSwisttal | III\nTelgte, Stadt | III\nTönisvorst, Stadt | III\nTroisdorf, Stadt | IV\nÜbach-Palenberg, Stadt | II\nUnna, Stadt | III\nVelbert, Stadt | III\nVelen | I\nVerl | II\nVersmold, Stadt | I\nViersen, Stadt | III\nVlotho, Stadt | I\nVoerde (Niederrhein), Stadt | III\nVreden, Stadt | I\nWachtberg | IV\nWadersloh | I\nWaldbröl, Stadt | II\nWaltrop, Stadt | II\nWarburg, Hansestadt | I\nWarendorf, Stadt | II\nWarstein, Stadt | I\nWassenberg, Stadt | II\nWeeze | II\nWegberg, Stadt | II\nWeilerswist | III\nWelver | I\nWenden | I\nWerdohl, Stadt | I\nWerl, Stadt | II\nWermelskirchen, Stadt | III\nWerne, Stadt | II\nWerther (Westf.), Stadt | I\nWesel, Stadt | III\nWesseling, Stadt | IV\nWesterkappeln | I\nWetter (Ruhr), Stadt | III\nWickede (Ruhr) | II\nWiehl, Stadt | II\nWillich, Stadt | IV\nWilnsdorf | I\nWindeck | I\nWinterberg, Stadt | I\nWipperfürth, Stadt | II\nWitten, Stadt | III\nWülfrath, Stadt | III\nWürselen, Stadt | III\nWuppertal, Stadt | III\nXanten, Stadt | III\nZülpich, Stadt | II\nKreis | Mietenstufe\nStädteregion Aachen | II\nBorken | I\nDüren | II\nEnnepe-Ruhr-Kreis | II\nEuskirchen | I\nGütersloh | II\nHeinsberg | I\nHerford | I\nHochsauerlandkreis | I\nHöxter | I\nKleve | II\nLippe | I\nMärkischer Kreis | II\nPaderborn | I\nSiegen-Wittgenstein | I\nSteinfurt | I\nWarendorf | I\nWesel | II\nLand: Rheinland-Pfalz\nGemeinde | Mietenstufe\nAlzey, Stadt | III\nAndernach, Stadt | II\nBad Dürkheim, Stadt | III\nBad Kreuznach, Stadt | III\nBad Neuenahr-Ahrweiler, Stadt | III\nBendorf, Stadt | II\nBetzdorf, Stadt | I\nBingen am Rhein, Stadt | III\nBitburg, Stadt | II\nBobenheim-Roxheim | II\nBöhl-Iggelheim | III\nBoppard, Stadt | I\nDiez, Stadt | II\nFrankenthal (Pfalz), Stadt | III\nGermersheim, Stadt | III\nGrafschaft | II\nGrünstadt, Stadt | II\nHassloch | II\nHerxheim b. Landau/Pfalz | II\nIdar-Oberstein, Stadt | I\nIngelheim am Rhein, Stadt | IV\nKaiserslautern, Stadt | II\nKoblenz, Stadt | III\nKonz, Stadt | II\nLahnstein, Stadt | II\nLandau i. d. Pfalz, Stadt | III\nLimburgerhof | III\nLudwigshafen am Rhein, Stadt | IV\nMainz, Stadt | VI\nMayen, Stadt | II\nMontabaur, Stadt | II\nMorbach | I\nMülheim-Kärlich, Stadt | I\nMutterstadt | II\nNeustadt (a. d. Weinstr.), Stadt | III\nNeuwied, Stadt | II\nNieder-Olm, Stadt | IV\nPirmasens, Stadt | I\nRemagen, Stadt | III\nSchifferstadt, Stadt | III\nSinzig, Stadt | II\nSpeyer, Stadt | III\nTrier, Stadt | III\nWittlich, Stadt | II\nWörth am Rhein, Stadt | III\nWorms, Stadt | III\nZweibrücken, Stadt | I\nKreis | Mietenstufe\nAhrweiler | I\nAltenkirchen (Westerwald) | I\nAlzey-Worms | II\nBad Dürkheim | II\nBad Kreuznach | I\nBernkastel-Wittlich | I\nBirkenfeld | I\nBitburg-Prüm | I\nCochem-Zell | I\nVulkaneifel | I\nDonnersbergkreis | I\nGermersheim | II\nKaiserslautern | I\nKusel | I\nRhein-Pfalz-Kreis | III\nMainz-Bingen | III\nMayen-Koblenz | I\nNeuwied | I\nSüdwestpfalz | I\nRhein-Hunsrück-Kreis | I\nRhein-Lahn-Kreis | I\nSüdliche Weinstraße | II\nTrier-Saarburg | I\nWesterwaldkreis | I\nLand: Saarland\nGemeinde | Mietenstufe\nBeckingen | I\nBexbach, Stadt | I\nBlieskastel, Stadt | I\nDillingen/Saar, Stadt | II\nEppelborn | I\nHeusweiler | II\nHomburg, Stadt | II\nIllingen | I\nKirkel | II\nKleinblittersdorf | II\nLebach, Stadt | I\nLosheim am See | I\nMandelbachtal | I\nMerzig, Kreisstadt | II\nMettlach | I\nNeunkirchen, Stadt | I\nOttweiler, Stadt | I\nPüttlingen, Stadt | I\nQuierschied | I\nRehlingen-Siersburg | II\nRiegelsberg | II\nSaarbrücken, Landeshauptstadt | III\nSaarlouis, Stadt | II\nSaarwellingen | I\nSankt Ingbert, Stadt | II\nSankt Wendel, Stadt | I\nSchiffweiler | I\nSchmelz | I\nSchwalbach | II\nSpiesen-Elversberg | I\nSulzbach/Saar, Stadt | II\nTholey | I\nÜberherrn | II\nVölklingen, Stadt | II\nWadern, Stadt | I\nWadgassen | II\nKreis | Mietenstufe\nMerzig-Wadern | I\nNeunkirchen | I\nSaarlouis | I\nSaar-Pfalz-Kreis | I\nSankt Wendel | I\nRegionalverband Saarbrücken | I\nLand: Sachsen\nGemeinde | Mietenstufe\nAnnaberg-Buchholz, Stadt | I\nAue-Bad Schlema | I\nAuerbach/Vogtl., Stadt | I\nBannewitz | III\nBautzen, Stadt | I\nBischofswerda, Stadt | II\nBorna, Stadt | I\nBurgstädt, Stadt | I\nChemnitz, Stadt | I\nCoswig, Stadt | II\nCrimmitschau, Stadt | I\nDelitzsch, Stadt | II\nDippoldiswalde, Stadt | I\nDöbeln, Stadt | I\nDresden, Stadt | III\nEbersbach-Neugersdorf, Stadt | I\nEilenburg, Stadt | II\nFlöha, Stadt | I\nFrankenberg/Sachsen, Stadt | I\nFreiberg, Stadt | II\nFreital, Stadt | II\nFrohburg | I\nGlauchau, Stadt | II\nGörlitz, Stadt | I\nGrimma, Stadt | I\nGroßenhain, Stadt | I\nHeidenau, Stadt | II\nHohenstein-Ernstthal | I\nHoyerswerda, Stadt | I\nKamenz, Stadt | I\nKlipphausen | II\nLeipzig, Stadt | II\nLichtenstein/Sa., Stadt | I\nLimbach-Oberfrohna, Stadt | I\nLöbau, Stadt | I\nMarienberg, Stadt | I\nMarkkleeberg, Stadt | III\nMarkranstädt, Stadt | II\nMeerane, Stadt | I\nMeißen, Stadt | II\nMittweida, Stadt | I\nMülsen | I\nNeustadt i. Sa., Stadt | I\nNossen, Stadt | I\nOelsnitz/Vogtland, Stadt | I\nOelsnitz/Erzgeb., Stadt | I\nOlbernhau, Stadt | I\nOschatz, Stadt | II\nPirna, Stadt | II\nPlauen, Stadt | I\nRadeberg, Stadt | II\nRadebeul, Stadt | II\nReichenbach/Vogtl., Stadt | I\nRiesa, Stadt | I\nSchkeuditz, Stadt | II\nSchneeberg, Stadt | I\nSchwarzenberg/Erzgeb., Stadt | I\nStollberg/Erzgeb., Stadt | II\nTaucha, Stadt | III\nTorgau, Stadt | I\nWeinböhla | II\nWeißwasser/O.L., Stadt | I\nWerdau, Stadt | I\nWilsdruff, Stadt | II\nWurzen, Stadt | I\nZittau, Stadt | I\nZwickau, Stadt | I\nZwönitz, Stadt | I\nKreis | Mietenstufe\nErzgebirgskreis | I\nMittelsachsen | I\nVogtlandkreis | I\nZwickau | I\nBautzen | I\nGörlitz | I\nMeißen | I\nSächsische Schweiz - Osterzgebirge | I\nLeipzig | I\nNordsachsen | I\nLand: Sachsen-Anhalt\nGemeinde | Mietenstufe\nAschersleben, Stadt | II\nBad Dürrenberg, Stadt | III\nBernburg (Saale), Stadt | III\nBitterfeld-Wolfen, Stadt | III\nBlankenburg (Harz), Stadt | I\nBraunsbedra, Stadt | II\nBurg, Stadt | II\nCoswig (Anhalt), Stadt | I\nDessau-Roßlau, Stadt | III\nEisleben, Lutherstadt | III\nGardelegen, Hansestadt | II\nGenthin, Stadt | II\nGommern, Stadt | II\nGräfenhainichen, Stadt | II\nHalberstadt, Stadt | II\nHaldensleben, Stadt | III\nHalle (Saale), Stadt | III\nHettstedt, Stadt | III\nHohe Börde | II\nJessen (Elster), Stadt | II\nKöthen (Anhalt), Stadt | III\nLandsberg, Stadt | II\nLeuna, Stadt | III\nMagdeburg, Landeshauptstadt | III\nMerseburg, Stadt | III\nMöckern, Stadt | I\nMuldestausee | II\nNaumburg (Saale), Stadt | III\nOberharz am Brocken | II\nOebisfelde-Weferlingen | III\nOschersleben (Bode), Stadt | II\nOsterwieck, Stadt | I\nQuedlinburg, Stadt | II\nQuerfurt, Stadt | II\nSalzatal | II\nSalzwedel, Hansestadt | II\nSandersdorf-Brehna | III\nSangerhausen, Stadt | III\nSchkopau | III\nSchönebeck (Elbe), Stadt | III\nStaßfurt, Stadt | II\nStendal, Hansestadt | II\nSüdliches Anhalt, Stadt | II\nTangerhütte, Stadt | III\nTangermünde, Stadt | II\nTeutschenthal | II\nThale, Stadt | II\nWanzleben-Börde, Stadt | II\nWeißenfels, Stadt | III\nWernigerode, Stadt | III\nWittenberg, Lutherstadt | III\nWolmirstedt, Stadt | II\nZeitz, Stadt | II\nZerbst/Anhalt, Stadt | II\nKreis | Mietenstufe\nAnhalt-Bitterfeld | II\nSalzlandkreis | II\nWittenberg | II\nBurgenlandkreis | II\nMansfeld-Südharz | II\nSaalekreis | II\nBörde | II\nJerichower Land | II\nStendal | II\nHarz | I\nAltmarkkreis-Salzwedel | I\nLand: Schleswig-Holstein\nGemeinde | Mietenstufe\nAhrensburg, Stadt | VI\nAltenholz | IV\nBad Bramstedt, Stadt | III\nBad Oldesloe, Stadt | IV\nBad Schwartau, Stadt | IV\nBad Segeberg, Stadt | IV\nBargteheide, Stadt | VI\nBarmstedt | IV\nBarsbüttel | VI\nBrunsbüttel, Stadt | I\nBüdelsdorf | III\nEckernförde, Stadt | IV\nElmshorn, Stadt | IV\nEutin, Stadt | III\nFlensburg, Stadt | III\nFehmarn, Stadt | III\nGeesthacht, Stadt | V\nGlinde, Stadt | V\nGlückstadt, Stadt | II\nHalstenbek | VI\nHandewitt | II\nHarrislee | III\nHeide, Stadt | II\nHenstedt-Ulzburg | V\nHusum, Stadt | III\nItzehoe, Stadt | III\nKaltenkirchen, Stadt | IV\nKiel, Landeshauptstadt | V\nKronshagen | IV\nLauenburg/Elbe, Stadt | IV\nLübeck, Stadt | IV\nMalente | III\nMölln, Stadt | III\nNeumünster, Stadt | III\nNeustadt in Holstein, Stadt | III\nNiebüll | II\nNorderstedt, Stadt | VI\nPinneberg, Stadt | V\nPreetz, Stadt | IV\nQuickborn, Stadt | V\nRatekau | IV\nRatzeburg, Stadt | III\nReinbek, Stadt | VI\nRellingen | VI\nRendsburg, Stadt | III\nScharbeutz | IV\nSchenefeld, Stadt | VII\nSchleswig, Stadt | III\nSchwentinental | V\nSchwarzenbek, Stadt | IV\nStockelsdorf | IV\nSylt | V\nTornesch | V\nUetersen, Stadt | IV\nWedel, Stadt | VI\nWentorf bei Hamburg | VI\nKreis | Mietenstufe\nDithmarschen | I\nHerzogtum Lauenburg | II\nNordfriesland | I\nOstholstein | III\nPinneberg | IV\nPlön | III\nRendsburg-Eckernförde | II\nSchleswig-Flensburg | I\nSegeberg | II\nSteinburg | II\nStormarn | IV\nLand: Thüringen\nGemeinde | Mietenstufe\nAltenburg, Stadt | I\nApolda, Stadt | I\nArnstadt, Stadt | II\nBad Frankenhausen/Kyff | I\nBad Salzungen, Stadt | I\nBad Langensalza, Stadt | I\nBleicherode, Stadt | I\nEisenach, Stadt | II\nEisenberg, Stadt | I\nErfurt, Stadt | III\nGera, Stadt | I\nGotha, Stadt | II\nGreiz, Stadt | I\nHeilbad Heiligenstadt, Stadt | II\nHildburghausen, Stadt | I\nIlmenau, Stadt | II\nJena, Stadt | III\nLeinefelde-Worbis | I\nMeiningen, Stadt | II\nMühlhausen/Thüringen, Stadt | I\nNordhausen, Stadt | II\nPößneck, Stadt | II\nRudolstadt, Stadt | II\nSaalfeld/Saale, Stadt | II\nSchleusingen, Stadt | II\nSchmalkalden, Kurort, Stadt | I\nSchmölln, Stadt | I\nSömmerda, Stadt | II\nSondershausen, Stadt | II\nSonneberg, Stadt | I\nSuhl, Stadt | II\nWaltershausen, Stadt | I\nWeimar, Stadt | III\nZella-Mehlis, Stadt | II\nZeulenroda Triebes, Stadt | I\nKreis | Mietenstufe\nEichsfeld | I\nNordhausen | I\nWartburgkreis | I\nUnstrut-Hainich-Kreis | I\nKyffhäuserkreis | I\nSchmalkalden-Meiningen | I\nGotha | I\nSömmerda | I\nHildburghausen | I\nIlm-Kreis | I\nWeimarer Land | II\nSonneberg | I\nSaalfeld-Rudolstadt | I\nSaale-Holzland-Kreis | I\nSaale-Orla-Kreis | I\nGreiz | I\nAltenburger Land | I\nGemeinsame Mietenstufe: | Mietenstufe\nInseln ohne Festlandanschluss | V",
  "url": "https://www.gesetze-im-internet.de/wogv/"
 },
 {
  "id": "sgb1-60-abs1",
  "gesetz": "SGB I",
  "paragraph": "§ 60",
  "absatz": "Abs. 1",
  "titel": "Angabe von Tatsachen",
  "text": "(1) Wer Sozialleistungen beantragt oder erhält, hat\n1. alle Tatsachen anzugeben, die für die Leistung erheblich sind, und auf Verlangen des zuständigen Leistungsträgers der Erteilung der erforderlichen Auskünfte durch Dritte zuzustimmen,\n2. Änderungen in den Verhältnissen, die für die Leistung erheblich sind oder über die im Zusammenhang mit der Leistung Erklärungen abgegeben worden sind, unverzüglich mitzuteilen,\n3. Beweismittel zu bezeichnen und auf Verlangen des zuständigen Leistungsträgers Beweisurkunden vorzulegen oder ihrer Vorlage zuzustimmen.\nSatz 1 gilt entsprechend für denjenigen, der Leistungen zu erstatten hat.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__60.html"
 },
 {
  "id": "sgb1-60-abs2",
  "gesetz": "SGB I",
  "paragraph": "§ 60",
  "absatz": "Abs. 2",
  "titel": "Angabe von Tatsachen",
  "text": "(2) Soweit für die in Absatz 1 Satz 1 Nummer 1 und 2 genannten Angaben Vordrucke vorgesehen sind, sollen diese benutzt werden. Soweit diese Vordrucke als elektronische Formulare über öffentlich zugängliche Netze oder in einem Eingabegerät zur Verfügung stehen, sollen diese vorrangig benutzt werden.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__60.html"
 },
 {
  "id": "sgb1-61",
  "gesetz": "SGB I",
  "paragraph": "§ 61",
  "titel": "Persönliches Erscheinen",
  "text": "Wer Sozialleistungen beantragt oder erhält, soll auf Verlangen des zuständigen Leistungsträgers zur mündlichen Erörterung des Antrags oder zur Vornahme anderer für die Entscheidung über die Leistung notwendiger Maßnahmen persönlich erscheinen.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__61.html"
 },
 {
  "id": "sgb1-62",
  "gesetz": "SGB I",
  "paragraph": "§ 62",
  "titel": "Untersuchungen",
  "text": "Wer Sozialleistungen beantragt oder erhält, soll sich auf Verlangen des zuständigen Leistungsträgers ärztlichen und psychologischen Untersuchungsmaßnahmen unterziehen, soweit diese für die Entscheidung über die Leistung erforderlich sind.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__62.html"
 },
 {
  "id": "sgb1-63",
  "gesetz": "SGB I",
  "paragraph": "§ 63",
  "titel": "Heilbehandlung",
  "text": "Wer wegen Krankheit oder Behinderung Sozialleistungen beantragt oder erhält, soll sich auf Verlangen des zuständigen Leistungsträgers einer Heilbehandlung unterziehen, wenn zu erwarten ist, daß sie eine Besserung seines Gesundheitszustands herbeiführen oder eine Verschlechterung verhindern wird.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__63.html"
 },
 {
  "id": "sgb1-64",
  "gesetz": "SGB I",
  "paragraph": "§ 64",
  "titel": "Leistungen zur Teilhabe am Arbeitsleben",
  "text": "Wer wegen Minderung der Erwerbsfähigkeit, anerkannten Schädigungsfolgen oder wegen Arbeitslosigkeit Sozialleistungen beantragt oder erhält, soll auf Verlangen des zuständigen Leistungsträgers an Leistungen zur Teilhabe am Arbeitsleben teilnehmen, wenn bei angemessener Berücksichtigung seiner beruflichen Neigung und seiner Leistungsfähigkeit zu erwarten ist, daß sie seine Erwerbs- oder Vermittlungsfähigkeit auf Dauer fördern oder erhalten werden.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__64.html"
 },
 {
  "id": "sgb1-65-abs1",
  "gesetz": "SGB I",
  "paragraph": "§ 65",
  "absatz": "Abs. 1",
  "titel": "Grenzen der Mitwirkung",
  "text": "(1) Die Mitwirkungspflichten nach den §§ 60 bis 64 bestehen nicht, soweit\n1. ihre Erfüllung nicht in einem angemessenen Verhältnis zu der in Anspruch genommenen Sozialleistung oder ihrer Erstattung steht oder\n2. ihre Erfüllung dem Betroffenen aus einem wichtigen Grund nicht zugemutet werden kann oder\n3. der Leistungsträger sich durch einen geringeren Aufwand als der Antragsteller oder Leistungsberechtigte die erforderlichen Kenntnisse selbst beschaffen kann.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__65.html"
 },
 {
  "id": "sgb1-65-abs2",
  "gesetz": "SGB I",
  "paragraph": "§ 65",
  "absatz": "Abs. 2",
  "titel": "Grenzen der Mitwirkung",
  "text": "(2) Behandlungen und Untersuchungen,\n1. bei denen im Einzelfall ein Schaden für Leben oder Gesundheit nicht mit hoher Wahrscheinlichkeit ausgeschlossen werden kann,\n2. die mit erheblichen Schmerzen verbunden sind oder\n3. die einen erheblichen Eingriff in die körperliche Unversehrtheit bedeuten,\nkönnen abgelehnt werden.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__65.html"
 },
 {
  "id": "sgb1-65-abs3",
  "gesetz": "SGB I",
  "paragraph": "§ 65",
  "absatz": "Abs. 3",
  "titel": "Grenzen der Mitwirkung",
  "text": "(3) Angaben, die dem Antragsteller, dem Leistungsberechtigten oder ihnen nahestehende Personen (§ 383 Abs. 1 Nr. 1 bis 3 der Zivilprozeßordnung) die Gefahr zuziehen würde, wegen einer Straftat oder einer Ordnungswidrigkeit verfolgt zu werden, können verweigert werden.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__65.html"
 },
 {
  "id": "sgb1-65a-abs1",
  "gesetz": "SGB I",
  "paragraph": "§ 65a",
  "absatz": "Abs. 1",
  "titel": "Aufwendungsersatz",
  "text": "(1) Wer einem Verlangen des zuständigen Leistungsträgers nach den §§ 61 oder 62 nachkommt, kann auf Antrag Ersatz seiner notwendigen Auslagen und seines Verdienstausfalls in angemessenem Umfang erhalten. Bei einem Verlangen des zuständigen Leistungsträgers nach § 61 sollen Aufwendungen nur in Härtefällen ersetzt werden.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__65a.html"
 },
 {
  "id": "sgb1-65a-abs2",
  "gesetz": "SGB I",
  "paragraph": "§ 65a",
  "absatz": "Abs. 2",
  "titel": "Aufwendungsersatz",
  "text": "(2) Absatz 1 gilt auch, wenn der zuständige Leistungsträger ein persönliches Erscheinen oder eine Untersuchung nachträglich als notwendig anerkennt.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__65a.html"
 },
 {
  "id": "sgb1-66-abs1",
  "gesetz": "SGB I",
  "paragraph": "§ 66",
  "absatz": "Abs. 1",
  "titel": "Folgen fehlender Mitwirkung",
  "text": "(1) Kommt derjenige, der eine Sozialleistung beantragt oder erhält, seinen Mitwirkungspflichten nach § 60 Absatz 1, den §§ 61, 62 und 65 nicht nach und wird hierdurch die Aufklärung des Sachverhalts erheblich erschwert, kann der Leistungsträger ohne weitere Ermittlungen die Leistung bis zur Nachholung der Mitwirkung ganz oder teilweise versagen oder entziehen, soweit die Voraussetzungen der Leistung nicht nachgewiesen sind. Dies gilt entsprechend, wenn der Antragsteller oder Leistungsberechtigte in anderer Weise absichtlich die Aufklärung des Sachverhalts erheblich erschwert.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__66.html"
 },
 {
  "id": "sgb1-66-abs2",
  "gesetz": "SGB I",
  "paragraph": "§ 66",
  "absatz": "Abs. 2",
  "titel": "Folgen fehlender Mitwirkung",
  "text": "(2) Kommt derjenige, der eine Sozialleistung wegen Pflegebedürftigkeit, wegen Arbeitsunfähigkeit, wegen Gefährdung oder Minderung der Erwerbsfähigkeit, anerkannten Schädigungsfolgen oder wegen Arbeitslosigkeit beantragt oder erhält, seinen Mitwirkungspflichten nach den §§ 62 bis 65 nicht nach und ist unter Würdigung aller Umstände mit Wahrscheinlichkeit anzunehmen, daß deshalb die Fähigkeit zur selbständigen Lebensführung, die Arbeits-, Erwerbs- oder Vermittlungsfähigkeit beeinträchtigt oder nicht verbessert wird, kann der Leistungsträger die Leistung bis zur Nachholung der Mitwirkung ganz oder teilweise versagen oder entziehen.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__66.html"
 },
 {
  "id": "sgb1-66-abs3",
  "gesetz": "SGB I",
  "paragraph": "§ 66",
  "absatz": "Abs. 3",
  "titel": "Folgen fehlender Mitwirkung",
  "text": "(3) Sozialleistungen dürfen wegen fehlender Mitwirkung nur versagt oder entzogen werden, nachdem der Leistungsberechtigte auf diese Folge schriftlich hingewiesen worden ist und seiner Mitwirkungspflicht nicht innerhalb einer ihm gesetzten angemessenen Frist nachgekommen ist.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__66.html"
 },
 {
  "id": "sgb1-67",
  "gesetz": "SGB I",
  "paragraph": "§ 67",
  "titel": "Nachholung der Mitwirkung",
  "text": "Wird die Mitwirkung nachgeholt und liegen die Leistungsvoraussetzungen vor, kann der Leistungsträger Sozialleistungen, die er nach § 66 versagt oder entzogen hat, nachträglich ganz oder teilweise erbringen.",
  "url": "https://www.gesetze-im-internet.de/sgb_1/__67.html"
 }
];
