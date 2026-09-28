/**
 * Recht-Wissensbasis (C2) — kuratierter, statischer Rechts-Korpus.
 *
 * Bewusste Architektur-Entscheidung: KEIN Embedding-/KB-Infra-Umbau. Stattdessen
 * ein statischer, zitationsgenauer Korpus der für die Wohngeld-App OPERATIVEN
 * Paragraphen (WoGG/WoGV) als TS-Modul. Das ist dependency-frei, deterministisch
 * durchsuchbar (siehe retrieval.ts) und ohne DB testbar. Eine echte KB-/Embedding-
 * Integration ist ein späterer, optionaler Schritt.
 *
 * Textquelle: amtlicher Wortlaut von gesetze-im-internet.de (URL je Chunk).
 * Sehr lange Absätze (v. a. § 14 Abs. 2) sind INHALTSTREU leicht gekürzt — die
 * Kürzung ist mit „[…]" markiert; es wurde nichts umformuliert oder erfunden.
 *
 * Rechtsstand: WoGG i.d.F. nach Wohngeld-Plus-Reform (Fortschreibung 2024/2025).
 */

export interface RechtChunk {
  /** Stabile ID, z. B. 'wogg-14' oder 'wogg-14-abs2'. */
  id: string;
  gesetz: 'WoGG' | 'WoGV' | 'WoGVwV';
  /** '§ 14' */
  paragraph: string;
  /** 'Abs. 2' (nur bei Absatz-Chunks). */
  absatz?: string;
  /** Amtliche Überschrift, z. B. 'Jahreseinkommen'. */
  titel: string;
  /** Amtlicher Wortlaut (bei sehr langen Absätzen inhaltstreu gekürzt). */
  text: string;
  /** Suchbegriffe/Synonyme (alltagssprachlich) — treibt das Retrieval. */
  tags: string[];
  /** z. B. '2026-09 (nach Wohngeld-Plus-Reform)'. */
  rechtsstand: string;
  /** Quell-URL zur Verifizierung. */
  url: string;
}

export const RECHTSSTAND = '2026-09 (nach Wohngeld-Plus-Reform)';
const U = (n: number) => `https://www.gesetze-im-internet.de/wogg/__${n}.html`;
const U_WOGV = (n: number) => `https://www.gesetze-im-internet.de/wogv/__${n}.html`;

export const RECHT_KORPUS: RechtChunk[] = [
  // ── § 3 WoGG — Wohngeldberechtigung ──────────────────────────────────────
  {
    id: 'wogg-3',
    gesetz: 'WoGG',
    paragraph: '§ 3',
    titel: 'Wohngeldberechtigung',
    text: `(1) Wohngeldberechtigte Person ist für den Mietzuschuss jede natürliche Person, die Wohnraum gemietet hat und diesen selbst nutzt. Ihr gleichgestellt sind 1. die nutzungsberechtigte Person des Wohnraums bei einem dem Mietverhältnis ähnlichen Nutzungsverhältnis (zur mietähnlichen Nutzung berechtigte Person), insbesondere die Person, die ein mietähnliches Dauerwohnrecht hat, 2. die Person, die Wohnraum im eigenen Haus, das mehr als zwei Wohnungen hat, bewohnt, und 3. die Person, die in einem Heim im Sinne des Heimgesetzes oder entsprechender Gesetze der Länder nicht nur vorübergehend aufgenommen ist.
(2) Wohngeldberechtigte Person ist für den Lastenzuschuss jede natürliche Person, die Eigentum an selbst genutztem Wohnraum hat. Ihr gleichgestellt sind 1. die erbbauberechtigte Person, 2. die Person, die ein eigentumsähnliches Dauerwohnrecht, ein Wohnungsrecht oder einen Nießbrauch innehat, und 3. die Person, die einen Anspruch auf Bestellung oder Übertragung des Eigentums, des Erbbaurechts, des eigentumsähnlichen Dauerwohnrechts, des Wohnungsrechts oder des Nießbrauchs hat. Die Sätze 1 und 2 gelten nicht im Fall des Absatzes 1 Satz 2 Nr. 2.
(3) Erfüllen mehrere Personen für denselben Wohnraum die Voraussetzungen des Absatzes 1 oder des Absatzes 2 und sind sie zugleich Haushaltsmitglieder (§ 5), ist nur eine dieser Personen wohngeldberechtigt. In diesem Fall bestimmen diese Personen die wohngeldberechtigte Person.
(4) Wohngeldberechtigt ist nach Maßgabe der Absätze 1 bis 3 auch, wer zwar nach den §§ 7 und 8 Abs. 1 vom Wohngeld ausgeschlossen ist, aber mit mindestens einem zu berücksichtigenden Haushaltsmitglied (§ 6) Wohnraum gemeinsam bewohnt.
(5) Ausländer im Sinne des § 2 Abs. 1 des Aufenthaltsgesetzes (ausländische Personen) sind nach Maßgabe der Absätze 1 bis 4 nur wohngeldberechtigt, wenn sie sich im Bundesgebiet tatsächlich aufhalten und 1. ein Aufenthaltsrecht nach dem Freizügigkeitsgesetz/EU haben, 2. einen Aufenthaltstitel oder eine Duldung nach dem Aufenthaltsgesetz haben, 3. ein Recht auf Aufenthalt nach einem völkerrechtlichen Abkommen haben, 4. eine Aufenthaltsgestattung nach dem Asylgesetz haben, 5. die Rechtsstellung eines heimatlosen Ausländers haben oder 6. auf Grund einer Rechtsverordnung vom Erfordernis eines Aufenthaltstitels befreit sind. [Ausnahmen für bestimmte Aufenthaltszwecke nach Satz 2 und 3.]`,
    tags: [
      'wohngeldberechtigung', 'wer bekommt wohngeld', 'anspruchsberechtigt', 'antragsberechtigt',
      'mietzuschuss', 'mieter', 'untermieter', 'lastenzuschuss', 'eigentümer', 'eigentum',
      'erbbaurecht', 'dauerwohnrecht', 'nießbrauch', 'heim', 'pflegeheim',
      'ausländer', 'aufenthaltstitel', 'aufenthaltsrecht', 'eu bürger', 'ewr', 'duldung',
      'staatsangehörigkeit', 'drittstaat', 'wohngeldberechtigte person',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(3),
  },

  // ── § 5 WoGG — Haushaltsmitglieder ───────────────────────────────────────
  {
    id: 'wogg-5',
    gesetz: 'WoGG',
    paragraph: '§ 5',
    titel: 'Haushaltsmitglieder',
    text: `(1) Haushaltsmitglied ist die wohngeldberechtigte Person, wenn der Wohnraum, für den sie Wohngeld beantragt, der Mittelpunkt ihrer Lebensbeziehungen ist. Haushaltsmitglied ist auch, wer 1. als Ehegatte eines Haushaltsmitgliedes von diesem nicht dauernd getrennt lebt, 2. als Lebenspartner oder Lebenspartnerin eines Haushaltsmitgliedes von diesem nicht dauernd getrennt lebt, 3. mit einem Haushaltsmitglied so zusammenlebt, dass nach verständiger Würdigung der wechselseitige Wille anzunehmen ist, Verantwortung füreinander zu tragen und füreinander einzustehen, 4. mit einem Haushaltsmitglied in gerader Linie oder zweiten oder dritten Grades in der Seitenlinie verwandt oder verschwägert ist, 5. ohne Rücksicht auf das Alter Pflegekind eines Haushaltsmitgliedes ist, 6. Pflegemutter oder Pflegevater eines Haushaltsmitgliedes ist und mit der wohngeldberechtigten Person den Wohnraum, für den Wohngeld beantragt wird, gemeinsam bewohnt, wenn dieser Wohnraum der jeweilige Mittelpunkt der Lebensbeziehungen ist.
(2) Ein wechselseitiger Wille, Verantwortung füreinander zu tragen und füreinander einzustehen, wird vermutet, wenn mindestens eine der Voraussetzungen nach den Nummern 1 bis 4 des § 7 Abs. 3a des Zweiten Buches Sozialgesetzbuch erfüllt ist.
(3) Ausländische Personen sind nur Haushaltsmitglieder nach Absatz 1 Satz 2, wenn sie die Voraussetzungen der Wohngeldberechtigung nach § 3 Abs. 5 erfüllen.
(4) Betreuen nicht nur vorübergehend getrennt lebende Eltern ein Kind oder mehrere Kinder zu annähernd gleichen Teilen, ist jedes dieser Kinder bei beiden Elternteilen Haushaltsmitglied. Gleiches gilt bei einer Aufteilung der Betreuung bis zu einem Verhältnis von mindestens einem Drittel zu zwei Dritteln je Kind. Betreuen die Eltern mindestens zwei dieser Kinder nicht in einem Verhältnis nach Satz 1 oder 2, ist bei dem Elternteil mit dem geringeren Betreuungsanteil nur das jüngste dieser Kinder Haushaltsmitglied. Für Pflegekinder und Pflegeeltern gelten die Sätze 1 bis 3 entsprechend.`,
    tags: [
      'haushaltsmitglied', 'haushalt', 'wer zählt zum haushalt', 'mittelpunkt der lebensbeziehungen',
      'lebensmittelpunkt', 'ehegatte', 'ehepartner', 'lebenspartner', 'partner',
      'verantwortungs und einstehensgemeinschaft', 'kind', 'kinder', 'pflegekind', 'pflegeeltern',
      'verwandt', 'verschwägert', 'getrennt lebend', 'wechselmodell', 'geteilte betreuung',
      'zweitwohnsitz', 'haft', 'krankenhaus',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(5),
  },

  // ── § 7 WoGG — Ausschluss vom Wohngeld ───────────────────────────────────
  {
    id: 'wogg-7-abs1',
    gesetz: 'WoGG',
    paragraph: '§ 7',
    absatz: 'Abs. 1',
    titel: 'Ausschluss vom Wohngeld',
    text: `(1) Vom Wohngeld ausgeschlossen sind Empfänger und Empfängerinnen von 1. Grundsicherungsgeld nach dem Zweiten Buch Sozialgesetzbuch (Bürgergeld/SGB II), auch in den Fällen des § 25 SGB II, 2. Leistungen für Auszubildende nach § 27 Absatz 3 SGB II, die als Zuschuss erbracht werden, 3. (weggefallen), 4. Verletztengeld in Höhe des Betrages des Grundsicherungsgeldes nach § 47 Abs. 2 SGB VII, 5. Grundsicherung im Alter und bei Erwerbsminderung nach dem Zwölften Buch Sozialgesetzbuch (SGB XII), 6. Hilfe zum Lebensunterhalt nach dem Zwölften Buch Sozialgesetzbuch, 7. Leistungen zum Lebensunterhalt oder anderen Leistungen in einer stationären Einrichtung nach dem Vierzehnten Buch Sozialgesetzbuch, 8. Leistungen in besonderen Fällen und Grundleistungen nach dem Asylbewerberleistungsgesetz oder 9. Leistungen nach dem Achten Buch Sozialgesetzbuch in Haushalten, zu denen ausschließlich Personen gehören, die diese Leistungen empfangen, wenn bei deren Berechnung Kosten der Unterkunft berücksichtigt worden sind (Leistungen). [...]
Der Ausschluss besteht nicht, wenn 1. die Leistungen ausschließlich als Darlehen gewährt werden oder 2. durch Wohngeld die Hilfebedürftigkeit vermieden oder beseitigt werden kann und a) die Leistungen während des Verwaltungsverfahrens noch nicht erbracht worden sind oder b) der zuständige Träger als nachrangig verpflichteter Leistungsträger erbringt.`,
    tags: [
      'ausschluss', 'ausgeschlossen', 'kein wohngeld', 'transferleistung', 'transferleistungen',
      'bürgergeld', 'grundsicherungsgeld', 'sgb ii', 'sgb 2', 'grundsicherung', 'sozialhilfe',
      'hilfe zum lebensunterhalt', 'sgb xii', 'sgb 12', 'asylbewerberleistungen', 'asylblg',
      'kosten der unterkunft', 'kdu', 'verletztengeld', 'stationäre einrichtung', 'heim',
      'darlehen', 'ausnahme', 'gleichzeitig wohngeld und bürgergeld',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(7),
  },
  {
    id: 'wogg-7-abs2',
    gesetz: 'WoGG',
    paragraph: '§ 7',
    absatz: 'Abs. 2',
    titel: 'Ausschluss vom Wohngeld (mitberücksichtigte Haushaltsmitglieder)',
    text: `(2) Ausgeschlossen sind auch Haushaltsmitglieder, die keine Empfänger der in Absatz 1 Satz 1 genannten Leistungen sind, deren Einkommen und Vermögen aber bei der Ermittlung der Leistung eines anderen Haushaltsmitglieds (nach Absatz 1 Satz 1 Nr. 1, 3, 4, 5, 6, 7 oder 8) berücksichtigt worden sind (u. a. § 7 Absatz 3 SGB II, § 43 Absatz 1 Satz 2 SGB XII, § 27 Absatz 2 SGB XII, § 93 SGB XIV, § 7 Absatz 1 AsylbLG). Der Ausschluss besteht nicht, wenn 1. die Leistungen ausschließlich als Darlehen gewährt werden oder 2. die Voraussetzungen des Absatzes 1 Satz 3 Nr. 2 vorliegen.`,
    tags: [
      'ausschluss', 'mitberücksichtigt', 'bedarfsgemeinschaft', 'einkommen berücksichtigt',
      'vermögen berücksichtigt', 'anderes haushaltsmitglied', 'transferleistung', 'bürgergeld',
      'kein wohngeld', 'ausgeschlossen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(7),
  },

  // ── § 8 WoGG — Dauer des Ausschlusses / Verzicht ─────────────────────────
  {
    id: 'wogg-8',
    gesetz: 'WoGG',
    paragraph: '§ 8',
    titel: 'Dauer des Ausschlusses vom Wohngeld und Verzicht auf Leistungen',
    text: `(1) Der Ausschluss vom Wohngeld besteht vorbehaltlich des § 7 Abs. 1 Satz 3 Nr. 2 und Abs. 2 Satz 2 Nr. 2 für die Dauer des Verwaltungsverfahrens zur Feststellung von Grund und Höhe der Leistungen nach § 7 Abs. 1. [Regelungen zu Beginn und Ende des Ausschlusszeitraums nach Antragstellung, Bewilligung bzw. Ablehnung.] Der Ausschluss gilt für den Zeitraum als nicht erfolgt, für den 1. der Antrag auf eine Leistung nach § 7 Absatz 1 zurückgenommen wird, 2. die Leistung nach § 7 Absatz 1 abgelehnt, versagt, entzogen oder ausschließlich als Darlehen gewährt wird, 3. der Bewilligungsbescheid zurückgenommen oder aufgehoben wird, 4. der Anspruch nachträglich ganz entfallen oder nachrangig ist oder 5. die Leistung nachträglich durch den Übergang eines Anspruchs in vollem Umfang erstattet wird.
(2) Verzichten Haushaltsmitglieder auf die Leistungen nach § 7 Abs. 1, um Wohngeld zu beantragen, gilt ihr Ausschluss vom Zeitpunkt der Wirkung des Verzichts an als nicht erfolgt; § 46 Abs. 2 des Ersten Buches Sozialgesetzbuch ist in diesem Fall nicht anzuwenden.`,
    tags: [
      'dauer ausschluss', 'verzicht', 'wahlrecht', 'günstigerprüfung', 'antrag zurückgenommen',
      'leistung abgelehnt', 'transferleistung ablehnung', 'ausschluss endet', 'ausschluss beginn',
      'bürgergeld verzicht', 'wohngeld statt bürgergeld',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(8),
  },

  // ── § 9 WoGG — Miete ─────────────────────────────────────────────────────
  {
    id: 'wogg-9',
    gesetz: 'WoGG',
    paragraph: '§ 9',
    titel: 'Miete',
    text: `(1) Miete ist das vereinbarte Entgelt für die Gebrauchsüberlassung von Wohnraum auf Grund von Mietverträgen oder ähnlichen Nutzungsverhältnissen einschließlich Umlagen, Zuschlägen und Vergütungen.
(2) Bei der Ermittlung der Miete nach Absatz 1 bleiben folgende Kosten und Vergütungen außer Betracht: 1. Heizkosten und Kosten für die Erwärmung von Wasser, 2. Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser, soweit sie den in Nummer 1 bezeichneten Kosten entsprechen, 3. die Kosten der Haushaltsenergie, soweit sie nicht von den Nummern 1 und 2 erfasst sind, 4. Vergütungen für die Überlassung einer Garage sowie eines Stellplatzes für Kraftfahrzeuge, 5. Vergütungen für Leistungen, die über die Gebrauchsüberlassung von Wohnraum hinausgehen, insbesondere für allgemeine Unterstützungsleistungen wie die Vermittlung von Pflege- oder Betreuungsleistungen, Leistungen der hauswirtschaftlichen Versorgung oder Notrufdienste. Ergeben sich diese Beträge nicht aus dem Mietvertrag oder entsprechenden Unterlagen, sind Pauschbeträge abzusetzen.
(3) Im Fall des § 3 Abs. 1 Satz 2 Nr. 2 ist als Miete der Mietwert des Wohnraums zu Grunde zu legen. Im Fall des § 3 Abs. 1 Satz 2 Nr. 3 ist als Miete die Summe aus dem Höchstbetrag nach § 12 Absatz 1 und der Klimakomponente nach § 12 Absatz 7 zu Grunde zu legen.`,
    tags: [
      'miete', 'bruttokaltmiete', 'kaltmiete', 'warmmiete', 'zuschussfähige miete', 'miethöhe',
      'heizkosten', 'warmwasser', 'nebenkosten', 'betriebskosten', 'haushaltsenergie', 'strom',
      'garage', 'stellplatz', 'außer betracht bleibende kosten', 'abziehbare kosten', 'pauschbetrag',
      'umlagen', 'mietvertrag', 'was zählt zur miete',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(9),
  },

  // ── § 13 WoGG — Gesamteinkommen ──────────────────────────────────────────
  {
    id: 'wogg-13',
    gesetz: 'WoGG',
    paragraph: '§ 13',
    titel: 'Gesamteinkommen',
    text: `(1) Das Gesamteinkommen ist die Summe der Jahreseinkommen (§ 14) der zu berücksichtigenden Haushaltsmitglieder abzüglich der Freibeträge (§§ 17 und 17a) und der Abzugsbeträge für Unterhaltsleistungen (§ 18).
(2) Das monatliche Gesamteinkommen ist ein Zwölftel des Gesamteinkommens.`,
    tags: [
      'gesamteinkommen', 'anrechenbares einkommen', 'monatliches einkommen', 'einkommen berechnen',
      'summe jahreseinkommen', 'herleitung', 'wie setzt sich das einkommen zusammen',
      'zwölftel', 'freibeträge', 'unterhaltsabzüge', 'einkommensberechnung',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(13),
  },

  // ── § 14 WoGG — Jahreseinkommen ──────────────────────────────────────────
  {
    id: 'wogg-14-abs1',
    gesetz: 'WoGG',
    paragraph: '§ 14',
    absatz: 'Abs. 1',
    titel: 'Jahreseinkommen (Grundlage: positive Einkünfte)',
    text: `(1) Das Jahreseinkommen eines zu berücksichtigenden Haushaltsmitgliedes ist vorbehaltlich des Absatzes 3 die Summe der positiven Einkünfte im Sinne des § 2 Abs. 1 und 2 des Einkommensteuergesetzes zuzüglich der Einnahmen nach Absatz 2 abzüglich der Abzugsbeträge für Steuern und Sozialversicherungsbeiträge (§ 16). Bei den Einkünften im Sinne des § 2 Abs. 1 Satz 1 Nr. 1 bis 3 EStG ist § 7g Abs. 1 bis 4 und 7 EStG nicht anzuwenden. Von den Einkünften aus nichtselbständiger Arbeit, die pauschal besteuert werden, zählen zum Jahreseinkommen nur 1. die nach § 37b EStG pauschal besteuerten Sachzuwendungen und 2. der nach § 40a EStG pauschal besteuerte Arbeitslohn und das pauschal besteuerte Arbeitsentgelt, jeweils abzüglich der Aufwendungen zu dessen Erwerbung, höchstens jedoch bis zur Höhe dieser Einnahmen. Ein Ausgleich mit negativen Einkünften aus anderen Einkunftsarten oder mit negativen Einkünften des zusammenveranlagten Ehegatten ist nicht zulässig.`,
    tags: [
      'jahreseinkommen', 'positive einkünfte', 'einkommensteuergesetz', 'estg',
      'einkünfte aus nichtselbständiger arbeit', 'lohn', 'gehalt', 'arbeitslohn',
      'selbständig', 'gewerbe', 'gewerbebetrieb', 'land und forstwirtschaft', 'freiberuflich',
      'kapitalvermögen', 'kapitalerträge', 'zinsen', 'dividenden',
      'vermietung', 'verpachtung', 'mieteinnahmen', 'verlustverrechnung', 'negative einkünfte',
      'pauschal besteuert', 'minijob', 'was zählt zum einkommen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(14),
  },
  {
    id: 'wogg-14-abs2',
    gesetz: 'WoGG',
    paragraph: '§ 14',
    absatz: 'Abs. 2',
    titel: 'Jahreseinkommen (steuerfreie Einnahmen / Hinzurechnungen, Nr. 1–31)',
    text: `(2) Zum Jahreseinkommen gehören (Auszug, inhaltstreu gekürzt): 1. der steuerfreie Betrag von Versorgungsbezügen (§ 19 Abs. 2, § 22 Nr. 4 EStG); 2. steuerfreie Versorgungsbezüge an Wehr-/Zivildienst-/Bundesfreiwilligendienst-Beschädigte und Hinterbliebene (§ 3 Nr. 6 EStG); 3. die den Ertragsanteil übersteigenden Teile von Leibrenten sowie der steuerfreie Rentenanteil aus dem Zuschlag für langjährige Versicherung (Grundrente); 4. steuerfreie Rentenabfindungen, Beitragserstattungen, Kapitalabfindungen, Ausgleichszahlungen (§ 3 Nr. 3 EStG); 5. steuerfreie Renten wegen Minderung der Erwerbsfähigkeit sowie Renten/Beihilfen an Hinterbliebene nach SGB VII; 6. die Lohn- und Einkommensersatzleistungen nach § 32b Abs. 1 Satz 1 Nr. 1 EStG (u. a. Arbeitslosengeld, Kurzarbeitergeld, Krankengeld, Mutterschaftsgeld, Elterngeld); § 10 BEEG (Elterngeld-Freibetrag) bleibt unberührt; 7. ausländische Einkünfte (§ 32b Abs. 1 Satz 1 Nr. 2–5 EStG); 8. die Hälfte bestimmter steuerfreier Unterhaltshilfen/Beihilfen (Lastenausgleichs-/Flüchtlingshilferecht); 9. steuerfreie Krankentagegelder (§ 3 Nr. 1a EStG); 10. die Hälfte steuerfreier Renten nach dem Anti-D-Hilfegesetz; 11. steuerfreie Zuschläge für Sonntags-, Feiertags- oder Nachtarbeit (§ 3b EStG); 12. steuerfreie Einnahmen nach § 3 Nr. 21 EStG; 13. (weggefallen); 14. steuerfreie Zuwendungen/Beiträge des Arbeitgebers zur betrieblichen Altersversorgung (§ 3 Nr. 56, 63 EStG); 15. der Sparer-Pauschbetrag (§ 20 Abs. 9 EStG), soweit die Kapitalerträge 100 Euro übersteigen; 16. bestimmte erhöhte Absetzungen/Sonderabschreibungen; 17. Produktionsaufgaberente/Ausgleichsgeld (Landwirtschaft); 18. steuerfreie Anpassungsgelder im Bergbau/Stahl; 19. der Empfängerin/dem Empfänger nicht zuzurechnende Bezüge Dritter (mit Ausnahmen: bis 6 540 Euro jährlich für Pflege; bis 480 Euro jährlich von nicht Unterhaltspflichtigen); 20. Unterhaltsleistungen des geschiedenen oder dauernd getrennt lebenden Ehegatten sowie Versorgungsleistungen aus Versorgungsausgleich; 21. die Leistungen nach dem Unterhaltsvorschussgesetz; 22. Leistungen Dritter (Nicht-Haushaltsmitglieder) zur Bezahlung der Miete/Belastung; 23. (weggefallen); 24./25. die Hälfte der Pflegegeld-Pauschalen für Vollzeitpflege (SGB VIII); 26. die Hälfte steuerfreier Einnahmen für Pflege-/Betreuungsleistungen; 27. die Hälfte als Zuschuss erbrachter Ausbildungsförderung (BAföG, Berufsausbildungsbeihilfe, Stipendien u. a.); 28. die als Zuschuss gewährte Graduiertenförderung; 29. die Hälfte steuerfreier Zuwendungen nach dem Fulbright-Abkommen; 30. die wiederkehrenden Leistungen nach § 7 Abs. 1 Satz 1 Nr. 1–9 (mit Ausnahmen, u. a. für darin enthaltene Kosten der Unterkunft); 31. der Mietwert selbst genutzten Wohnraums (§ 3 Abs. 1 Satz 2 Nr. 2).`,
    tags: [
      'steuerfreie einnahmen', 'hinzurechnung', 'zählt zum einkommen',
      'elterngeld', 'mutterschaftsgeld', 'krankengeld', 'krankentagegeld', 'arbeitslosengeld', 'alg',
      'kurzarbeitergeld', 'lohnersatzleistung', 'einkommensersatzleistung',
      'rente', 'leibrente', 'ertragsanteil', 'grundrente', 'erwerbsminderungsrente', 'unfallrente',
      'versorgungsbezüge', 'pension', 'kapitalerträge', 'sparer-pauschbetrag', 'zinsen', 'dividenden',
      'unterhalt erhalten', 'unterhaltsvorschuss', 'uvg', 'bafög', 'ausbildungsförderung', 'stipendium',
      'pflegegeld', 'nachtzuschlag', 'schichtzuschlag', 'ausländische einkünfte',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(14),
  },
  {
    id: 'wogg-14-abs3',
    gesetz: 'WoGG',
    paragraph: '§ 14',
    absatz: 'Abs. 3',
    titel: 'Jahreseinkommen (nicht anzurechnende Einnahmen)',
    text: `(3) Zum Jahreseinkommen gehören nicht: 1. Einkünfte aus Vermietung oder Verpachtung eines Teils des Wohnraums, für den Wohngeld beantragt wird; 2. das Entgelt, das eine den Wohnraum mitbewohnende Person im Sinne des § 11 Abs. 2 Nr. 3 hierfür zahlt; 3. Leistungen einer nach § 68 des Aufenthaltsgesetzes verpflichteten Person, soweit sie von § 11 Abs. 2 Nr. 5 erfasst sind.`,
    tags: [
      'nicht anzurechnen', 'zählt nicht zum einkommen', 'kein einkommen', 'untermiete',
      'mitbewohner', 'untermieter zahlung', 'verpflichtungserklärung', 'kindergeld',
      'ausnahme einkommen', 'einnahmen die nicht zählen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(14),
  },

  // ── § 15 WoGG — Ermittlung des Jahreseinkommens ──────────────────────────
  {
    id: 'wogg-15',
    gesetz: 'WoGG',
    paragraph: '§ 15',
    titel: 'Ermittlung des Jahreseinkommens',
    text: `(1) Bei der Ermittlung des Jahreseinkommens ist das Einkommen zu Grunde zu legen, das im Zeitpunkt der Antragstellung im Bewilligungszeitraum zu erwarten ist. Hierzu können die Verhältnisse vor dem Zeitpunkt der Antragstellung herangezogen werden; § 24 Abs. 2 bleibt unberührt.
(2) Einmaliges Einkommen, das für einen bestimmten Zeitraum bezogen wird, ist diesem Zeitraum zuzurechnen. Ist kein Zurechnungszeitraum festgelegt oder vereinbart, so ist das einmalige Einkommen zu einem Zwölftel in den zwölf Monaten nach dem Zuflussmonat zuzurechnen. Ist das einmalige Einkommen vor der Antragstellung zugeflossen, ist es nur dann zuzurechnen, wenn es innerhalb von einem Jahr vor der Antragstellung zugeflossen ist.
(3) Sonderzuwendungen, Gratifikationen und gleichartige Bezüge und Vorteile, die in größeren als monatlichen Abständen gewährt werden, sind den im Bewilligungszeitraum liegenden Monaten zu je einem Zwölftel zuzurechnen, wenn sie in den nächsten zwölf Monaten nach Beginn des Bewilligungszeitraums zufließen.
(4) Beträgt der Bewilligungszeitraum nicht zwölf Monate, ist als Einkommen das Zwölffache des im Bewilligungszeitraum zu erwartenden durchschnittlichen monatlichen Einkommens zu Grunde zu legen.`,
    tags: [
      'ermittlung einkommen', 'prognose', 'zu erwartendes einkommen', 'bewilligungszeitraum',
      'einmaliges einkommen', 'einmalzahlung', 'abfindung', 'sonderzahlung', 'weihnachtsgeld',
      'urlaubsgeld', 'gratifikation', 'bonus', 'zurechnung', 'zwölftel', 'welcher zeitraum einkommen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(15),
  },

  // ── § 16 WoGG — Abzugsbeträge Steuern/Sozialabgaben ──────────────────────
  {
    id: 'wogg-16',
    gesetz: 'WoGG',
    paragraph: '§ 16',
    titel: 'Abzugsbeträge für Steuern und Sozialversicherungsbeiträge',
    text: `Bei der Ermittlung des Jahreseinkommens sind von dem Betrag, der sich nach den §§ 14 und 15 ergibt, jeweils 10 Prozent abzuziehen, wenn zu erwarten ist, dass im Bewilligungszeitraum die folgenden Steuern und Pflichtbeiträge zu leisten sind: 1. Steuern vom Einkommen, 2. Pflichtbeiträge zur gesetzlichen Kranken- und Pflegeversicherung, 3. Pflichtbeiträge zur gesetzlichen Rentenversicherung. Satz 1 Nummer 2 und 3 gilt entsprechend, wenn keine Pflichtbeiträge, aber laufende Beiträge zu öffentlichen oder privaten Versicherungen gleicher Zweckbestimmung zu leisten sind. Satz 2 gilt auch, wenn die Beiträge zu Gunsten eines zu berücksichtigenden Haushaltsmitgliedes zu leisten sind. Die Sätze 2 und 3 gelten nicht, wenn eine im Wesentlichen beitragsfreie Sicherung besteht oder Beiträge von Dritten zu leisten sind. Die Sätze 1 und 2 gelten bei einmaligem Einkommen im Sinne des § 15 Absatz 2 in jedem Jahr der Zurechnung entsprechend.`,
    tags: [
      'abzugsbeträge', 'abzüge', 'pauschale', '10 prozent', 'pauschalabzug',
      'steuern', 'lohnsteuer', 'einkommensteuer', 'krankenversicherung', 'kv', 'pflegeversicherung', 'pv',
      'rentenversicherung', 'rv', 'pflichtbeiträge', 'sozialabgaben', 'sozialversicherung',
      'brutto netto', 'beitragsfrei', 'familienversichert', 'private versicherung',
      'was wird vom einkommen abgezogen', '30 prozent',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(16),
  },

  // ── § 17 WoGG — Freibeträge ──────────────────────────────────────────────
  {
    id: 'wogg-17',
    gesetz: 'WoGG',
    paragraph: '§ 17',
    titel: 'Freibeträge',
    text: `Bei der Ermittlung des Gesamteinkommens sind die folgenden jährlichen Freibeträge abzuziehen: 1. 1 800 Euro für jedes schwerbehinderte zu berücksichtigende Haushaltsmitglied mit einem Grad der Behinderung a) von 100 oder b) von unter 100 bei Pflegebedürftigkeit im Sinne des § 14 SGB XI und gleichzeitiger häuslicher oder teilstationärer Pflege oder Kurzzeitpflege; 2. 750 Euro für jedes zu berücksichtigende Haushaltsmitglied, das Opfer der nationalsozialistischen Verfolgung oder ihm im Sinne des Bundesentschädigungsgesetzes gleichgestellt ist; 3. 1 320 Euro, wenn a) ein zu berücksichtigendes Haushaltsmitglied ausschließlich mit einem Kind oder mehreren Kindern Wohnraum gemeinsam bewohnt und b) mindestens eines dieser Kinder noch nicht 18 Jahre alt ist und für dieses Kindergeld gewährt wird (Alleinerziehenden-Freibetrag); 4. ein Betrag in Höhe der eigenen Einnahmen aus Erwerbstätigkeit jedes Kindes eines Haushaltsmitgliedes, höchstens jedoch 1 200 Euro, wenn das Kind ein zu berücksichtigendes Haushaltsmitglied und noch nicht 25 Jahre alt ist.`,
    tags: [
      'freibetrag', 'freibeträge', 'schwerbehindert', 'schwerbehinderung', 'gdb', 'grad der behinderung',
      'behinderung', 'pflegebedürftig', 'pflegegrad', 'alleinerziehend', 'alleinerziehende',
      'kind einkommen', 'kinderfreibetrag', 'erwerbstätigkeit kind', 'ns-verfolgung',
      '1800 euro', '1320 euro', '1200 euro', '750 euro', 'was wird abgezogen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(17),
  },

  // ── § 18 WoGG — Abzugsbeträge für Unterhaltsleistungen ───────────────────
  {
    id: 'wogg-18',
    gesetz: 'WoGG',
    paragraph: '§ 18',
    titel: 'Abzugsbeträge für Unterhaltsleistungen',
    text: `Bei der Ermittlung des Gesamteinkommens sind die folgenden zu erwartenden Aufwendungen zur Erfüllung gesetzlicher Unterhaltsverpflichtungen abzuziehen: 1. bis zu 3 000 Euro jährlich für ein zu berücksichtigendes Haushaltsmitglied, das wegen Berufsausbildung auswärts wohnt, soweit es nicht von Nummer 2 erfasst ist; 2. bis zu 3 000 Euro jährlich für ein Kind, das Haushaltsmitglied nach § 5 Absatz 4 ist; dies gilt nur für Aufwendungen, die an das Kind als Haushaltsmitglied bei dem anderen Elternteil geleistet werden; 3. bis zu 6 000 Euro jährlich für einen früheren oder dauernd getrennt lebenden Ehegatten oder Lebenspartner oder eine frühere oder dauernd getrennt lebende Lebenspartnerin, der oder die kein Haushaltsmitglied ist; 4. bis zu 3 000 Euro jährlich für eine sonstige Person, die kein Haushaltsmitglied ist. Liegt in den Fällen des Satzes 1 eine notariell beurkundete Unterhaltsvereinbarung, ein Unterhaltstitel oder ein Bescheid vor, sind die jährlichen Aufwendungen bis zu dem darin festgelegten Betrag abzuziehen.`,
    tags: [
      'unterhalt gezahlt', 'unterhaltsleistungen', 'unterhaltsverpflichtung', 'unterhaltsabzug',
      'unterhaltszahlung', 'unterhalt kind', 'ehegattenunterhalt', 'geschiedener ehegatte',
      'unterhaltstitel', 'notarielle vereinbarung', 'auswärtige ausbildung',
      '3000 euro', '6000 euro', 'abzug unterhalt', 'unterhalt außerhalb haushalt',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(18),
  },

  // ── § 21 WoGG — Kein Wohngeld (Sonstige Gründe) ──────────────────────────
  {
    id: 'wogg-21',
    gesetz: 'WoGG',
    paragraph: '§ 21',
    titel: 'Kein Wohngeld (Sonstige Gründe)',
    text: `Ein Wohngeldanspruch besteht nicht, 1. wenn das Wohngeld weniger als 10 Euro monatlich betragen würde, 2. wenn alle Haushaltsmitglieder nach den §§ 7 und 8 Abs. 1 vom Wohngeld ausgeschlossen sind oder 3. soweit die Inanspruchnahme missbräuchlich wäre, insbesondere wegen erheblichen Vermögens.`,
    tags: [
      'kein anspruch', 'kein wohngeld', 'mindestbetrag', '10 euro', 'missbräuchlich', 'missbrauch',
      'vermögen', 'erhebliches vermögen', 'freigrenze', 'vermögensfreigrenze', '60000', '30000',
      'wann kein wohngeld', 'ablehnung', 'alle ausgeschlossen', 'sparbuch', 'ersparnisse',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(21),
  },

  // ── § 22 WoGG — Wohngeldantrag ───────────────────────────────────────────
  {
    id: 'wogg-22',
    gesetz: 'WoGG',
    paragraph: '§ 22',
    titel: 'Wohngeldantrag',
    text: `(1) Wohngeld wird nur auf Antrag der wohngeldberechtigten Person geleistet.
(2) Im Fall des § 3 Abs. 3 wird vermutet, dass die antragstellende Person von den anderen Haushaltsmitgliedern als wohngeldberechtigte Person bestimmt ist.
(3) Zieht die wohngeldberechtigte Person aus oder stirbt sie, kann der Antrag nach § 27 Abs. 1 auch von einem anderen Haushaltsmitglied gestellt werden, das die Voraussetzungen des § 3 Abs. 1 oder Abs. 2 erfüllt. § 3 Abs. 3 bis 5 gilt entsprechend.
(4) Wird ein Wohngeldantrag für die Zeit nach dem laufenden Bewilligungszeitraum früher als zwei Monate vor Ablauf dieses Zeitraums gestellt, gilt der Erste des zweiten Monats vor Ablauf dieses Zeitraums als Zeitpunkt der Antragstellung im Sinne des § 24 Abs. 2.
(5) § 65a des Ersten und § 115 des Zehnten Buches Sozialgesetzbuch sind nicht anzuwenden.`,
    tags: [
      'antrag', 'wohngeldantrag', 'antragstellung', 'nur auf antrag', 'antragsmonat', 'leistungsbeginn',
      'ab wann wohngeld', 'weiterleistungsantrag', 'folgeantrag', 'auszug', 'tod', 'antragsberechtigt',
      'unterschrift antrag',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(22),
  },

  // ── § 24 WoGG — Wohngeldbehörde und Entscheidung ─────────────────────────
  {
    id: 'wogg-24',
    gesetz: 'WoGG',
    paragraph: '§ 24',
    titel: 'Wohngeldbehörde und Entscheidung',
    text: `(1) Zuständig für die Durchführung dieses Gesetzes sind die nach Landesrecht zuständigen Stellen (Wohngeldbehörde). § 69 SGB I bleibt unberührt.
(2) Die Entscheidung über den Wohngeldantrag ist durch die Wohngeldbehörde schriftlich zu erlassen. Der Entscheidung sind die Verhältnisse im Bewilligungszeitraum, die im Zeitpunkt der Antragstellung zu erwarten sind, zu Grunde zu legen. Treten nach dem Zeitpunkt der Antragstellung bis zur Bekanntgabe des Wohngeldbescheides Änderungen der Verhältnisse ein, sind sie grundsätzlich nicht zu berücksichtigen; Änderungen im Sinne des § 27 Absatz 1 und 2 oder § 28 Absatz 1 bis 3 sollen berücksichtigt werden.
(3) Der Bewilligungsbescheid muss die in § 27 Abs. 3 Satz 1 Nr. 2 und 3 genannten Beträge ausweisen und einen Hinweis über die Mitteilungspflichten enthalten. [...]
(4) Erzielt mindestens eines der zu berücksichtigenden Haushaltsmitglieder Einkünfte aus selbständiger Arbeit, aus Gewerbebetrieb oder aus Land- und Forstwirtschaft, so kann der Bewilligungsbescheid mit der Auflage verbunden werden, dass die Einkommensteuerbescheide, die den Bewilligungszeitraum betreffen, unverzüglich der Wohngeldbehörde zur Prüfung vorzulegen sind.
(5) Wird infolge des Umzugs eine andere Wohngeldbehörde zuständig, bleibt die den Bescheid erlassende Wohngeldbehörde zuständig für Aufhebung, Rückforderung und Unterrichtung nach § 28 Absatz 5.`,
    tags: [
      'wohngeldbehörde', 'zuständigkeit', 'entscheidung', 'bescheid', 'wohngeldbescheid',
      'schriftlich', 'prognose', 'verhältnisse im bewilligungszeitraum', 'selbständige auflage',
      'einkommensteuerbescheid vorlegen', 'umzug', 'welche behörde', 'sachbearbeitung',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(24),
  },

  // ── § 25 WoGG — Bewilligungszeitraum ─────────────────────────────────────
  {
    id: 'wogg-25',
    gesetz: 'WoGG',
    paragraph: '§ 25',
    titel: 'Bewilligungszeitraum',
    text: `(1) Das Wohngeld soll für zwölf Monate bewilligt werden. Der Bewilligungszeitraum kann unter Berücksichtigung der zu erwartenden maßgeblichen Verhältnisse verkürzt, geteilt oder bei voraussichtlich gleichbleibenden Verhältnissen auf bis zu 24 Monate verlängert werden.
(2) Der Bewilligungszeitraum beginnt am Ersten des Monats, in dem der Wohngeldantrag gestellt worden ist. Treten die Voraussetzungen für die Bewilligung erst in einem späteren Monat ein, beginnt der Bewilligungszeitraum am Ersten dieses Monats.
(3) Der Bewilligungszeitraum beginnt am Ersten des Monats, von dem ab Leistungen im Sinne des § 7 Abs. 1 abgelehnt worden sind, wenn der Wohngeldantrag vor Ablauf des Kalendermonats gestellt wird, der auf die Kenntnis der Ablehnung folgt. [Absätze 4 und 5 regeln Sonderfälle bei Unwirksamkeit des Bescheides bzw. Miet-/Belastungserhöhung.]`,
    tags: [
      'bewilligungszeitraum', 'bwz', 'wie lange wohngeld', 'zwölf monate', '12 monate', '24 monate',
      'dauer', 'wie lange bewilligt', 'beginn bewilligungszeitraum', 'verlängerung', 'verkürzung',
      'ab wann gilt wohngeld', 'zeitraum',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(25),
  },

  // ── § 27 WoGG — Änderung des Wohngeldes ──────────────────────────────────
  {
    id: 'wogg-27',
    gesetz: 'WoGG',
    paragraph: '§ 27',
    titel: 'Änderung des Wohngeldes (Neubewilligung und Mitteilungspflicht)',
    text: `(1) Das Wohngeld ist auf Antrag neu zu bewilligen, wenn sich im laufenden Bewilligungszeitraum 1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder erhöht, 2. die zu berücksichtigende Miete oder Belastung um mehr als 10 Prozent erhöht oder 3. das Gesamteinkommen um mehr als 10 Prozent verringert und sich dadurch das Wohngeld erhöht.
(2) Über die Leistung des Wohngeldes ist von Amts wegen unter Aufhebung des Bewilligungsbescheides neu zu entscheiden, wenn sich im laufenden Bewilligungszeitraum nicht nur vorübergehend 1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder verringert, 2. die zu berücksichtigende Miete oder Belastung um mehr als 15 Prozent verringert oder 3. das Gesamteinkommen um mehr als 15 Prozent erhöht und dadurch das Wohngeld wegfällt oder sich verringert. [...]
(3) Die wohngeldberechtigte Person muss der Wohngeldbehörde unverzüglich mitteilen, wenn sich im laufenden Bewilligungszeitraum nicht nur vorübergehend 1. die Anzahl der zu berücksichtigenden Haushaltsmitglieder verringert oder die Anzahl der vom Wohngeld ausgeschlossenen Haushaltsmitglieder erhöht, 2. die monatliche Miete (§ 9) oder Belastung (§ 10) um mehr als 15 Prozent verringert oder 3. die Summe der monatlichen Einkünfte nach § 14 Abs. 1 und der Einnahmen nach § 14 Abs. 2 aller zu berücksichtigenden Haushaltsmitglieder um mehr als 15 Prozent erhöht. [...]`,
    tags: [
      'änderung', 'änderungsmitteilung', 'mitteilungspflicht', 'neubewilligung', 'erhöhungsantrag',
      'änderungsantrag', 'einkommen gestiegen', 'einkommen gesunken', 'miete geändert', 'mieterhöhung',
      '10 prozent', '15 prozent', 'haushaltsmitglied weggefallen', 'haushaltsmitglied hinzugekommen',
      'was muss ich melden', 'wann neu beantragen', 'von amts wegen',
    ],
    rechtsstand: RECHTSSTAND,
    url: U(27),
  },

  // ── § 6 WoGV — Außer Betracht bleibende Kosten und Vergütungen ───────────
  {
    id: 'wogv-6',
    gesetz: 'WoGV',
    paragraph: '§ 6',
    titel: 'Außer Betracht bleibende Kosten und Vergütungen',
    text: `(1) Kosten, die nach § 9 Absatz 2 Nummer 1 und 2 des Wohngeldgesetzes außer Betracht bleiben, sind: 1. Betriebskosten für Heizungs- und Brennstoffversorgungsanlagen sowie Warmwasserversorgungsanlagen im Sinne der Betriebskostenverordnung; 2. Kosten der eigenständig gewerblichen Lieferung von Wärme und Warmwasser.
(2) Kommt nur der Abzug eines Pauschbetrages von der Miete in Betracht, so beträgt dieser: 1. für Betriebskosten für zentrale Heizungs-/Brennstoffversorgung oder gewerbliche Wärmelieferung 1,25 Euro monatlich je Quadratmeter Wohnfläche; 2. für zentrale Warmwasserversorgung 9 Euro monatlich (eine Person), 17 Euro (zwei Personen), je weitere Person 3 Euro; 3. für die übrigen Kosten der Haushaltsenergie 41 Euro monatlich (eine Person), 74 Euro (zwei Personen), je weitere Person 15 Euro; 4. für die Überlassung einer Garage 36 Euro monatlich; für einen Stellplatz 25 Euro monatlich.
(3) Bei der Ermittlung des Mietwertes nach § 7 und der Untermiete sind die Absätze 1 und 2 entsprechend anzuwenden.`,
    tags: [
      'außer betracht bleibende kosten', 'abziehbare kosten', 'heizkosten', 'warmwasser', 'haushaltsenergie',
      'pauschbetrag', 'pauschale', 'garage', 'stellplatz', 'betriebskosten', 'nebenkosten',
      'strom', 'wärmelieferung', 'quadratmeter', 'was wird von der miete abgezogen', 'nicht zuschussfähig',
      'wogv',
    ],
    rechtsstand: RECHTSSTAND,
    url: U_WOGV(6),
  },
];

/** Schneller Zugriff per ID. */
export const RECHT_KORPUS_BY_ID: Map<string, RechtChunk> = new Map(
  RECHT_KORPUS.map((c) => [c.id, c]),
);

/** Anzeige-Label für einen Chunk, z. B. „§ 14 WoGG — Jahreseinkommen". */
export function chunkLabel(chunk: RechtChunk): string {
  const abs = chunk.absatz ? ` ${chunk.absatz}` : '';
  return `${chunk.paragraph}${abs} ${chunk.gesetz} — ${chunk.titel}`;
}
