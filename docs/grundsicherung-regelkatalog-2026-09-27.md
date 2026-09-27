# Grundsicherung im Alter und bei Erwerbsminderung — Fachlicher Regel-Katalog für Vollständigkeits- und Plausibilitätsprüfung

**Stand:** 2026-09-27 · **Rechtsstand:** SGB XII, SGB I, WoGG in der am 2026-09-27 auf gesetze-im-internet.de abrufbaren Fassung (Einzelnormen am 2026-09-27 geladen). Regelbedarfe laut Anlage zu § 28 SGB XII, Zeile „ab 1.1.2026". Rentenanpassung zum 01.07.2026 laut Deutscher Rentenversicherung.
**Zweck:** Sachbearbeiter-Assistenz für die **Vollständigkeitsprüfung** (welche Nachweise fehlen?) und die **Plausibilitätsprüfung** (welche Angaben widersprechen den Nachweisen?) von Anträgen auf Grundsicherung im Alter und bei Erwerbsminderung (SGB XII, 4. Kapitel, §§ 41–46b) bei kommunalen Sozialämtern.
**Ausdrücklich NICHT im Scope:** die Berechnung des Zahlbetrags (§ 43a SGB XII: Gesamtbedarf minus einzusetzendes Einkommen/Vermögen). Das macht das Fachverfahren. Regelbedarf, Mehrbedarfe, Unterkunftskosten, Einkommen und Vermögen kommen hier nur so weit vor, wie sie **Nachweisanforderungen auslösen** oder **Widersprüche erkennbar machen**. Vorrang-Hinweise zu Wohngeld sind qualitativ und rechnen nicht (Abschnitt 5).

> **Hinweis zur Implementierung:** Konventionen wie im Wohngeld-Katalog (`docs/wohngeld-regelkatalog-2026-09-18.md`), damit die Regeln direkt in TypeScript-Regelobjekte (`checker/regeln.ts`) überführt werden können:
> - `id`: kebab-case, stabil, eindeutig. Präfixe: ohne Präfix = Vollständigkeit, `plausi-` = Plausibilität, `vorrang-` = Vorrang-Hinweis Wohngeld/Grundsicherung.
> - `trigger`: Auslöse-Bedingung (Fallkonstellation / Personenmerkmal), in Prosa, aber als Boolesche Bedingung interpretierbar.
> - `scope`: `person` (betrifft eine konkrete Person der Einsatzgemeinschaft) vs. `household` (einmal pro Antrag).
> - `severity`: `anforderung` (Nachweis/Angabe muss vorliegen, führt zu Nachforderung) vs. `hinweis` (nicht blockierend, Sachbearbeitung prüft). In der App: `anforderung` → Prüfschritt-`typ` `anforderung`, `hinweis` → `info` (siehe `docs/antragspruefung-muster.md` Abschnitt 3).
> - `legal`: Rechtsgrundlage. Nachweispflichten selbst folgen aus der Mitwirkungspflicht **§ 60 Abs. 1 SGB I** (Tatsachen angeben, Beweismittel bezeichnen, Beweisurkunden auf Verlangen vorlegen); sie wird bei den Regeln nicht jedes Mal wiederholt.
> - Markierung **(nicht verifiziert)**: Aussage stammt aus Sekundärquelle, Verwaltungspraxis oder eigener Ableitung und wurde nicht an der Primärquelle geprüft. Solche Regeln vor Produktivnutzung mit der Pilotkommune abstimmen.

---

## 0. Grundbegriffe und Antragsarten

### 0.1 Leistungsberechtigung (§ 41 SGB XII)

Leistungsberechtigt sind Personen mit **gewöhnlichem Aufenthalt im Inland**, die ihren notwendigen Lebensunterhalt nicht oder nicht ausreichend aus Einkommen und Vermögen nach § 43 bestreiten können, **und** die eine der folgenden Voraussetzungen erfüllen (§ 41 Abs. 1):

| Anspruchsgrund | Voraussetzung | Rechtsgrundlage | Kern-Nachweis |
|---|---|---|---|
| **Alter** | Altersgrenze erreicht (Tabelle 0.2) | § 41 Abs. 2 | Ausweis (Geburtsdatum) |
| **Dauerhafte volle Erwerbsminderung** | 18. Lebensjahr vollendet, voll erwerbsgemindert i. S. d. § 43 Abs. 2 SGB VI **unabhängig von der jeweiligen Arbeitsmarktlage**, Behebung unwahrscheinlich | § 41 Abs. 3 | Bescheid des RV-Trägers (unbefristete EM-Rente) oder Ergebnis des Ersuchens nach § 45 oder WfbM-Nachweis |
| **Werkstatt-Eingangsverfahren / Berufsbildungsbereich / Budget für Ausbildung** | ab 18 Jahren, für die Dauer der Maßnahme | § 41 Abs. 3a | Bescheinigung der Werkstatt / des Leistungsträgers |

**Volle Erwerbsminderung (SGB VI):** voll erwerbsgemindert ist, wer wegen Krankheit oder Behinderung auf nicht absehbare Zeit außerstande ist, unter den üblichen Bedingungen des allgemeinen Arbeitsmarktes mindestens **drei Stunden täglich** erwerbstätig zu sein (§ 43 Abs. 2 Satz 2 SGB VI). Erwerbsminderungsrenten werden grundsätzlich **befristet** geleistet (§ 102 Abs. 2 Satz 1 SGB VI, längstens drei Jahre je Befristung). Renten, auf die ein Anspruch **unabhängig von der Arbeitsmarktlage** besteht, werden **unbefristet** geleistet, wenn die Behebung unwahrscheinlich ist; davon ist nach einer Gesamtdauer der Befristung von neun Jahren auszugehen (§ 102 Abs. 2 Satz 5 SGB VI).

> **Für die Prüfung entscheidend:** Eine *befristete* EM-Rente oder eine EM-Rente, die nur wegen des verschlossenen Teilzeitarbeitsmarkts gezahlt wird (arbeitsmarktbedingt), belegt die Voraussetzung „dauerhaft" bzw. „unabhängig von der Arbeitsmarktlage" **nicht**. Die Rentenart und der Befristungsvermerk im Rentenbescheid sind deshalb Pflichtfelder der Extraktion.

**Ersuchen an den Rentenversicherungsträger (§ 45 SGB XII):** Erscheint die dauerhafte volle Erwerbsminderung nach den Angaben und Nachweisen wahrscheinlich und reicht Einkommen/Vermögen nicht aus, ersucht der Sozialhilfeträger den RV-Träger um Prüfung der medizinischen Voraussetzungen; dessen Entscheidung ist **bindend**. Das Ersuchen **unterbleibt**, wenn
1. der RV-Träger die Voraussetzungen bereits im Rentenverfahren festgestellt hat,
2. bereits eine gutachterliche Stellungnahme nach § 109a Abs. 2 und 3 SGB VI vorliegt,
3. die Person in einer Werkstatt für behinderte Menschen tätig ist oder das Eingangsverfahren durchläuft,
4. der Fachausschuss einer Werkstatt festgestellt hat, dass ein Mindestmaß wirtschaftlich verwertbarer Arbeitsleistung nicht vorliegt (bei Teilhabe-/Gesamtplanverfahren ersetzt eine entsprechende Feststellung diese Stellungnahme).

**Ausschluss (§ 41 Abs. 4):** Keinen Anspruch hat, wer in den **letzten zehn Jahren** die Hilfebedürftigkeit **vorsätzlich oder grob fahrlässig** herbeigeführt hat.

**Auslandsaufenthalt (§ 41a):** Wer sich länger als **vier Wochen ununterbrochen** im Ausland aufhält, erhält nach Ablauf der vierten Woche bis zur nachgewiesenen Rückkehr keine Leistungen.

**Ausländerinnen und Ausländer (§ 23):** Ausschlüsse u. a. in den ersten drei Monaten des Aufenthalts (sofern weder Arbeitnehmer/Selbständige noch freizügigkeitsberechtigt), bei fehlendem Aufenthaltsrecht oder Aufenthaltsrecht allein zur Arbeitsuche, sowie für Leistungsberechtigte nach dem AsylbLG (§ 23 Abs. 2, 3). Wie § 23 Abs. 1 das 4. Kapitel für Ausländer einbezieht, wurde im Wortlaut nicht geprüft **(nicht verifiziert)**.

**Nachrang (§ 2 SGB XII) und Verhältnis zum 3. Kapitel:** Sozialhilfe erhält nicht, wer sich selbst helfen kann oder die Leistung von anderen erhält (§ 2 Abs. 1). Grundsicherung im Alter und bei Erwerbsminderung geht der Hilfe zum Lebensunterhalt (3. Kapitel) vor (§ 19 Abs. 2 Satz 2).

### 0.2 Altersgrenze (§ 41 Abs. 2 SGB XII)

| Geburtsjahrgang | Altersgrenze |
|---|---|
| vor 1947 | 65 Jahre |
| 1947–1957 | 65 Jahre + 1 bis 11 Monate (je Jahrgang ein Monat mehr) |
| 1958 | 66 Jahre |
| 1959–1963 | 66 Jahre + 2 bis 10 Monate (je Jahrgang zwei Monate mehr) |
| ab 1964 | 67 Jahre |

Quelle: § 41 Abs. 2 SGB XII (Tabelle im Gesetz). Die App berechnet aus Geburtsdatum + Tabelle das Datum des Erreichens der Altersgrenze; das ist eine Datumsrechnung, keine Leistungsberechnung. Für Antragsteller:innen im Jahr 2026 ist praktisch nur noch die Zeile „1959–1963" und „ab 1964" relevant.

### 0.3 Einsatzgemeinschaft und Personenrollen

| Rolle | Wirkung | Rechtsgrundlage |
|---|---|---|
| **Antragsteller:in** (leistungsberechtigte Person) | eigene Anspruchsprüfung | § 41 |
| **Nicht getrennt lebende:r Ehegatt:in / eingetragene:r Lebenspartner:in** | Einkommen und Vermögen werden berücksichtigt, soweit sie den eigenen notwendigen Lebensunterhalt übersteigen; kann selbst leistungsberechtigt sein | § 43 Abs. 1 Satz 2; § 27 Abs. 2 |
| **Partner:in einer eheähnlichen / lebenspartnerschaftsähnlichen Gemeinschaft** | nicht besser zu stellen als Ehegatten → wie Ehegatt:in behandeln | § 20; § 43 Abs. 1 Satz 2 |
| **Weitere Haushaltsangehörige** (Kinder, Eltern, Geschwister, Bekannte) | **keine** Einsatzgemeinschaft; die Vermutung der Bedarfsdeckung durch Haushaltsangehörige (§ 39 Satz 1) gilt im 4. Kapitel **nicht** (§ 43 Abs. 5); relevant nur für Aufteilung der Unterkunftskosten (§ 42a Abs. 3, 4) | § 43 Abs. 5; § 42a |
| **Unterhaltspflichtige Kinder/Eltern außerhalb des Haushalts** | Unterhaltsansprüche bleiben unberücksichtigt, außer jährliches Gesamteinkommen > 100.000 € (§ 94 Abs. 1a) | § 94 Abs. 1a |
| **Getrennt lebende / geschiedene Ehegatt:innen** | Unterhaltsansprüche sind zu verfolgen (keine 100.000-€-Privilegierung) | § 2; § 94 Abs. 1 |
| **Gesetzliche Betreuung / Bevollmächtigte** | Vertretung; Bestellungsurkunde bzw. Vollmacht nötig | §§ 60 ff. SGB I; Betreuungsrecht BGB (nicht verifiziert) |

**Unterschied zum Wohngeld:** Wohngeld rechnet mit dem **Haushalt** (§ 5 WoGG, alle Haushaltsmitglieder). Die Grundsicherung rechnet mit der **Einsatzgemeinschaft** (Paar). Erwachsene Kinder oder Eltern in derselben Wohnung sind *nicht* Teil der Einsatzgemeinschaft; ihr Einkommen wird nicht angerechnet. Das Datenmodell braucht deshalb je Person die Rolle `einsatzgemeinschaft` vs. `haushaltsangehoerig`.

### 0.4 Antragsarten und Leistungszeitraum

| Antragsart | Beschreibung | Nachweisrelevanz |
|---|---|---|
| **Erstantrag** | erstmalige Bewilligung oder nach Unterbrechung | volle Nachweislage (Abschnitt 1) |
| **Weiterbewilligungsantrag** (Folgeantrag) | Anschluss an einen abgelaufenen Bewilligungszeitraum | aktuelle Einkommens-, Vermögens-, KdU- und KV-Nachweise; Identität und Anspruchsgrund nur bei Änderung. Der Deutsche Verein stellt dafür ein eigenes Formular bereit („Weitergewährung von Leistungen der Grundsicherung …") |
| **Änderungsmitteilung** | während des Bewilligungszeitraums (Mieterhöhung, Rentenanpassung, Umzug, Tod/Trennung des Partners, Auslandsaufenthalt) | Nachweis nur zur geänderten Tatsache (§ 60 Abs. 1 Nr. 2 SGB I) |
| **Gesondert zu beantragende Leistungen** | Bedarfe nach § 42 Nr. 2 i. V. m. §§ 31, 33 (u. a. Erstausstattungen, Altersvorsorge-Beiträge), § 42 Nr. 3 i. V. m. § 34 Abs. 5 (Lernförderung) und § 42 Nr. 5 (Darlehen) | eigener Antrag nötig (§ 44 Abs. 1 Satz 2); nicht vom Grundantrag umfasst |

- **Antragserfordernis:** Leistungen werden **auf Antrag** erbracht (§ 44 Abs. 1 Satz 1).
- **Rückwirkung auf den Monatsersten:** Der Antrag wirkt auf den **Ersten des Kalendermonats** zurück, in dem er gestellt wird, **wenn die Voraussetzungen des § 41 innerhalb dieses Kalendermonats erfüllt werden**. Für Zeiten davor werden keine Leistungen erbracht (§ 44 Abs. 2).
- **Bewilligungszeitraum:** in der Regel **zwölf Kalendermonate** (§ 44 Abs. 3 Satz 1); bei vorläufiger Entscheidung nach § 44a soll er auf höchstens **sechs Monate** verkürzt werden (§ 44 Abs. 3 Satz 2).
- **Übergang aus dem SGB II:** Endet der Bezug von Grundsicherungsgeld nach dem SGB II mit Erreichen der Altersgrenze nach § 7a SGB II, beginnt der Bewilligungszeitraum erst mit dem Ersten des Folgemonats (§ 44 Abs. 3 Satz 3).
- **Zahlung:** monatlich im Voraus (§ 44 Abs. 4).
- **Vorläufige Entscheidung (§ 44a):** möglich, wenn zur Feststellung weiterer Voraussetzungen längere Zeit nötig ist oder der Anspruch dem Grunde nach besteht, aber die Höhe noch nicht feststeht. **Keine** vorläufige Entscheidung, wenn die leistungsberechtigte Person die Verzögerung zu vertreten hat (§ 44a Abs. 2). Für die App relevant: fehlende Nachweise, die der Antragsteller zu liefern hat, blockieren auch eine vorläufige Bewilligung.
- **Antragsdatum bei Weiterleitung:** Ein Antrag bei einem unzuständigen Leistungsträger oder einer unzuständigen Gemeinde gilt als zu dem Zeitpunkt gestellt, an dem er dort eingegangen ist; er ist unverzüglich weiterzuleiten (§ 16 Abs. 2 SGB I).
- **Darlehen bei erstmaligem Zufluss am Monatsende (§ 37a, § 42 Nr. 5):** Kann eine Person im Monat des ersten Rentenzuflusses ihren Lebensunterhalt bis zum Zufluss nicht decken, ist auf Antrag ein Darlehen zu gewähren (Rückzahlung durch Aufrechnung nach § 44b). Wortlaut § 37a nicht direkt geladen; Inhalt aus den Hinweisen zum DV-Musterantrag **(nicht verifiziert an der Norm)**.

### 0.5 Bedarfe (§ 42 SGB XII) — nur als Nachweis-Landkarte

Der Gesamtbedarf (§ 43a Abs. 1) setzt sich aus § 42 Nr. 1–4 zusammen. Die App ermittelt **keine Beträge**, sondern nur, *welche Bedarfsbestandteile im Fall vorkommen* und ob deren Nachweise vorliegen.

| § 42 Nr. | Bedarf | Nachweis-Auslöser | Abschnitt |
|---|---|---|---|
| 1 | Regelsatz nach Regelbedarfsstufe (Anlage zu § 28) | Zuordnung der Regelbedarfsstufe aus Wohnsituation und Partnerschaft | 0.6 |
| 2 | zusätzliche Bedarfe (2. Abschnitt 3. Kapitel: u. a. Mehrbedarfe § 30, KV/PV § 32, Vorsorge § 33) sowie Mehrbedarfe § 42b | Schwerbehinderung (Merkzeichen G), Ernährung, Schwangerschaft, Alleinerziehung, dezentrales Warmwasser, WfbM-Mittagessen, KV/PV-Beiträge | 1.6, 1.7 |
| 3 | Bildung und Teilhabe (3. Abschnitt 3. Kapitel) | nur bei Schüler:innen (selten, z. B. voll erwerbsgeminderte junge Erwachsene) | – |
| 4 | Unterkunft und Heizung (§ 42a, §§ 35 ff.) | Mietvertrag, Heizkosten, Eigentum, besondere Wohnform | 1.3–1.5 |
| 5 | ergänzende Darlehen (§ 37 Abs. 1, § 37a) | gesonderter Antrag | 0.4 |

### 0.6 Regelbedarfsstufen — Zuordnung (Anlage zu § 28 SGB XII)

| Stufe | Personenkreis (Anlage zu § 28) | Typischer Fall in der Grundsicherung | Betrag ab 1.1.2026 |
|---|---|---|---|
| **1** | jede erwachsene Person, die in einer Wohnung nach § 42a Abs. 2 Satz 2 lebt und für die nicht Stufe 2 gilt | alleinstehend; auch erwachsene Person bei Eltern/Kind/in WG | 563 € |
| **2** | erwachsene Person, die mit Ehegatt:in/Lebenspartner:in/Partner:in in einer Wohnung zusammenlebt; außerdem Erwachsene in bestimmten Wohnformen mit Gemeinschaftsräumen (persönlicher Wohnraum nach § 42a Abs. 2 Satz 1 Nr. 2) | Paar in gemeinsamer Wohnung; besondere Wohnform der Eingliederungshilfe | 506 € |
| **3** | erwachsene Person, deren notwendiger Lebensunterhalt sich nach § 27b bestimmt | stationäre Einrichtung (z. B. Pflegeheim) | 451 € |
| 4 | Jugendliche 15 bis unter 18 | kommt im 4. Kapitel praktisch nicht als Leistungsberechtigte:r vor | 471 € |
| 5 | Kind 7 bis unter 14 | dito | 390 € |
| 6 | Kind bis unter 6 | dito | 357 € |

Quelle Beträge: Tabelle der Anlage zu § 28 SGB XII auf gesetze-im-internet.de, Zeile „1.1.2026" (identisch mit 1.1.2024 und 1.1.2025, also Nullrunde 2025 und 2026). Die Definition von Stufe 2 ist hier sinngemäß wiedergegeben; die Definitionen von Stufe 1, 3–6 sind wörtlich geprüft. **Die App braucht die Beträge nicht**, nur die Stufe als Plausibilitätsmerkmal (z. B. Stufe 2 angegeben, aber kein Partner im Antrag). Abweichende Regelsatzfestsetzung (§ 27a Abs. 4) bei für mehr als einen Monat anderweitig gedecktem oder unausweichlich höherem Bedarf ist nur ein Hinweis.

---

## 1. Erforderliche Nachweise je Fallkonstellation (Vollständigkeitsprüfung)

Regel-Liste. Jede Regel: `id`, Titel, `trigger`, `scope`, `severity`, `legal`.

### 1.1 Antrag, Identität, Aufenthalt, Vertretung (immer bzw. fallbezogen)

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `antrag-vollstaendig-unterschrieben` | Vollständig ausgefüllter, datierter und unterschriebener Antrag (jede volljährige Person der Einsatzgemeinschaft oder deren Vertretung) | immer | household | anforderung | § 44 Abs. 1; § 60 Abs. 1, 2 SGB I |
| `identitaet-jede-person` | Identitätsnachweis (Personalausweis/Reisepass) mit Geburtsdatum | für jede Person der Einsatzgemeinschaft | person | anforderung | § 41 Abs. 1, 2; § 60 SGB I |
| `meldebescheinigung` | Melde-/Wohnsitznachweis (gewöhnlicher Aufenthalt, örtliche Zuständigkeit) | Ausweisadresse ≠ Antragsadresse, Zuzug, Wohnungslosigkeit oder Zweifel am gewöhnlichen Aufenthalt | person | hinweis | § 41 Abs. 1; § 46b |
| `aufenthaltstitel-drittstaat` | Aufenthaltstitel / Nachweis des Aufenthaltsrechts | Staatsangehörigkeit außerhalb EU/EWR/Schweiz | person | anforderung | § 23 Abs. 3 |
| `freizuegigkeit-eu` | Nachweis Freizügigkeit/Aufenthaltsrecht, Einreisedatum | EU-/EWR-Staatsangehörigkeit, Einreise < 5 Jahre (Schwelle nicht verifiziert) | person | hinweis | § 23 Abs. 3 |
| `verpflichtungserklaerung` | Kopie der Verpflichtungserklärung nach § 68 AufenthG, Datum | Antrag gibt Verpflichtungserklärung an | person | anforderung | § 2 Abs. 1 (vorrangige Hilfe Dritter); § 68 AufenthG (nicht verifiziert) |
| `betreuung-bestellungsurkunde` | Betreuerausweis / Bestellungsurkunde (Aufgabenkreise) | gesetzliche Betreuung angegeben | person | anforderung | § 60 SGB I |
| `vollmacht-bevollmaechtigte` | Vollmacht der vertretenen Person | Antrag von Dritten gestellt/unterschrieben, keine Betreuung | person | anforderung | § 60 SGB I; § 13 SGB X (nicht verifiziert) |
| `bankverbindung` | Kontoverbindung (IBAN, Kontoinhaber; Angabe P-Konto) | immer | household | anforderung | § 60 SGB I |
| `vorbezug-sozialleistung` | Angaben/Bescheid zu früherem Bezug (SGB II/SGB XII, von wem, von–bis) | Antrag gibt Vorbezug an oder Umzug aus anderer Kommune | household | hinweis | § 35 Abs. 1 Satz 6 (Karenzzeit), § 44 Abs. 3 Satz 3 |

### 1.2 Anspruchsgrund Alter / Erwerbsminderung

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `anspruchsgrund-alter-nachweis` | Geburtsdatum belegt (Ausweis) und Altersgrenze erreicht | Anspruchsgrund = Alter | person | anforderung | § 41 Abs. 2 |
| `em-rentenbescheid-unbefristet` | Rentenbescheid über Rente wegen **voller** Erwerbsminderung mit Rentenart, Befristung und Angabe „unabhängig von der Arbeitsmarktlage" | Anspruchsgrund = Erwerbsminderung, EM-Rente bezogen | person | anforderung | § 41 Abs. 3; § 45 Satz 3 Nr. 1; § 102 Abs. 2 SGB VI |
| `em-feststellung-rv` | Feststellung des RV-Trägers zur dauerhaften vollen Erwerbsminderung (Ergebnis Ersuchen nach § 45 oder Stellungnahme nach § 109a Abs. 2, 3 SGB VI) | Anspruchsgrund = Erwerbsminderung, **keine** unbefristete volle EM-Rente | person | anforderung | § 45 Satz 1, 2 |
| `em-ersuchen-vorbereiten` | Unterlagen für das Ersuchen an den RV-Träger (ärztliche Befunde, Entlassberichte, Schwerbehinderten-Feststellung, RV-Nummer) | Anspruchsgrund = Erwerbsminderung und Tatbestand nach § 45 Satz 3 liegt nicht vor | person | anforderung | § 45 Satz 1 |
| `em-wfbm-nachweis` | Bescheinigung der Werkstatt / des anderen Leistungsanbieters (Arbeitsbereich, Eingangsverfahren, Berufsbildungsbereich) bzw. Feststellung des Fachausschusses | Person in WfbM, bei anderem Leistungsanbieter (§ 60 SGB IX) oder im Budget für Ausbildung | person | anforderung | § 41 Abs. 3a; § 45 Satz 3 Nr. 3, 4 |
| `rentenantrag-gestellt` | Nachweis über gestellten, noch nicht beschiedenen Rentenantrag (Datum, Träger, Rentenart) | Antrag gibt laufenden Rentenantrag an | person | hinweis | § 2 Abs. 1 (vorrangige Leistung); § 44a (vorläufige Entscheidung) |
| `rv-versicherungsnummer` | Rentenversicherungsnummer | Anspruchsgrund = Erwerbsminderung oder Rentenbezug | person | hinweis | § 45; § 60 SGB I |

### 1.3 Unterkunft und Heizung — Mietwohnung

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `mietvertrag` | Mietvertrag (alle Seiten, unterschrieben) | Wohnsituation = Hauptmieter:in | household | anforderung | § 42 Nr. 4; § 42a Abs. 1; § 35 Abs. 1 |
| `mietbescheinigung-aktuell` | Aktuelle Miethöhe, aufgeteilt in Grundmiete, kalte Nebenkosten, Heizkosten (Vermieterbescheinigung oder letzte Mietänderung) | Mietvertrag älter als 12 Monate oder Aufteilung im Vertrag fehlt | household | anforderung | § 35 Abs. 1; § 117 Abs. 5 (Auskunftspflicht Vermieter) |
| `nebenkostenabrechnung` | Letzte Betriebskostenabrechnung | Wohnsituation = Miete | household | anforderung | § 35 Abs. 1 |
| `heizkosten-nachweis` | Nachweis der Heizkosten: Abschlagsplan und letzte Jahresabrechnung des Versorgers oder Heizkostenanteil in der Nebenkostenabrechnung; Energieart | immer bei eigener Wohnung | household | anforderung | § 35 Abs. 1 Satz 1; § 42a Abs. 1 |
| `warmwasser-erzeugung` | Angabe zentrale/dezentrale Warmwasserbereitung (bei dezentral: Mehrbedarf-Prüfung, Abschnitt 1.6) | immer bei eigener Wohnung | household | anforderung | § 30 Abs. 7 |
| `mietzahlungsnachweis` | Nachweis tatsächlicher Mietzahlung (Kontoauszug) | Wohnsituation = Miete | household | anforderung | § 35 Abs. 1 (tatsächliche Aufwendungen) |
| `untermietvertrag` | Untermietvertrag + Name/Anschrift Hauptmieter | Wohnsituation = Untermiete | household | anforderung | § 42a Abs. 4 |
| `wg-kostenaufteilung` | Aufstellung der Gesamtkosten der Wohnung und der Zahl der Bewohner; vertragliche Verpflichtung zur Mietzahlung | Wohngemeinschaft oder Wohnung mit Personen außerhalb der Einsatzgemeinschaft | household | anforderung | § 42a Abs. 4 |
| `mehrpersonenhaushalt-angehoerige` | Gesamtkosten der Wohnung der Angehörigen (Mietvertrag/Eigentumskosten der Eltern, Geschwister oder des volljährigen Kindes) und Zahl der Bewohner | Person lebt bei Eltern / volljährigem Geschwisterkind / volljährigem Kind, die Mieter/Eigentümer der gesamten Wohnung sind, **ohne** eigene vertragliche Mietzahlung | household | anforderung | § 42a Abs. 3 (Differenzmethode) |
| `mietrueckstaende` | Nachweis Miet-/Energierückstände (Mahnung, Kündigung) | Antrag nennt Rückstände | household | hinweis | § 35a Abs. 3 (Direktzahlung); § 36 (Schuldenübernahme, nicht verifiziert) |
| `umzug-zusicherung` | Zusicherung / Angaben zum geplanten Umzug und neuem Mietangebot | Antrag nennt geplanten Umzug oder neuen Mietvertrag nach Antrag | household | hinweis | § 35a Abs. 2 |
| `direktzahlung-vermieter` | Antrag auf Direktzahlung + Vermieter-Kontoverbindung | Antragsteller wünscht Zahlung an Vermieter | household | hinweis | § 35a Abs. 3; § 43a Abs. 3 |

### 1.4 Unterkunft — selbst genutztes Wohneigentum

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `eigentum-kostenaufstellung` | Aufstellung der Kosten und Belastungen (Schuldzinsen, Grundsteuer, Gebäudeversicherung, Nebenkosten, Heizung) mit Belegen | Wohnsituation = Eigentum | household | anforderung | § 35 Abs. 1; DV-Musterantrag Ziff. 4.3 |
| `eigentum-darlehen` | Darlehensvertrag + aktueller Kontoauszug des Darlehens (Zins-/Tilgungsanteil) | Eigentum mit laufender Finanzierung | household | anforderung | § 35 Abs. 1 |
| `eigentum-grundsteuer` | Grundsteuerbescheid, Abgabenbescheid | Wohnsituation = Eigentum | household | anforderung | § 35 Abs. 1 |
| `eigentum-wert-groesse` | Grundbuchauszug, Wohn- und Grundstücksfläche, Verkehrswert (für Schonvermögen § 90 Abs. 2 Nr. 8) | Wohnsituation = Eigentum | household | anforderung | § 90 Abs. 2 Nr. 8 |
| `eigentum-instandhaltung` | Kostenvoranschlag/Rechnung für unabweisbare Instandhaltung/Reparatur | Antrag nennt Reparaturbedarf | household | hinweis | § 35a Abs. 1 |
| `wohnrecht-niessbrauch` | Übergabe-/Überlassungsvertrag mit Wohnrecht, Nießbrauch, Altenteil | Wohnsituation = freies Wohnrecht / Nießbrauch | household | anforderung | § 42a; § 82 Abs. 1 (Geldeswert) |

### 1.5 Besondere Wohnform / stationäre Einrichtung

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `besondere-wohnform-vertrag` | Wohn- und Betreuungsvertrag mit Aufschlüsselung Grundmiete, Zuschläge (Möblierung, Wohnnebenkosten, Haushaltsstrom, Kommunikation) | Person lebt in besonderer Wohnform (ehem. stationäre Eingliederungshilfe) | person | anforderung | § 42a Abs. 2 Satz 1 Nr. 2, Abs. 5 |
| `einrichtung-heimvertrag` | Heimvertrag / Kostenaufstellung der Einrichtung, früherer gewöhnlicher Aufenthalt | Person lebt in stationärer Einrichtung (Pflegeheim) | person | anforderung | § 42 Nr. 4 Buchst. b; § 46b Abs. 3 (Zuständigkeit) |

> Stationäre Pflege und Eingliederungshilfe sind fachlich eigene Welten (Hilfe zur Pflege, 7. Kapitel; SGB IX). **Empfehlung:** im Pilot nur die Wohnungsfälle prüfen und Einrichtungsfälle als „außerhalb des Prüfumfangs" markieren (offene Fachfrage 8.9).

### 1.6 Mehrbedarfe

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `schwerbehindertenausweis-g` | Schwerbehindertenausweis (Vorder- und Rückseite, Gültigkeit) oder Feststellungsbescheid mit Merkzeichen **G** | Antrag gibt Schwerbehinderung mit Merkzeichen G/aG an **und** (Altersgrenze erreicht **oder** voll erwerbsgemindert nach SGB VI) | person | anforderung | § 30 Abs. 1 (Nachweis durch Bescheid nach § 152 Abs. 4 SGB IX oder Ausweis nach § 152 Abs. 5 SGB IX) |
| `schwerbehinderung-beantragt` | Nachweis über den gestellten Feststellungsantrag (Datum) | Antrag gibt „beantragt am" an | person | hinweis | § 30 Abs. 1 (Mehrbedarf erst ab Nachweis) |
| `ernaehrung-aerztliche-bescheinigung` | Ärztliche Bescheinigung über Erkrankung und medizinisch notwendige, kostenaufwändigere Ernährung | Antrag nennt kostenaufwändige Ernährung | person | anforderung | § 30 Abs. 5 |
| `schwangerschaft-mutterpass` | Nachweis Schwangerschaft ab 12. Woche, voraussichtlicher Entbindungstermin | Antrag nennt Schwangerschaft | person | anforderung | § 30 Abs. 2 |
| `alleinerziehend-nachweis` | Nachweis: lebt mit minderjährigen Kindern zusammen und sorgt allein für Pflege und Erziehung (Geburtsurkunden/Meldebescheinigung der Kinder) | Antrag nennt Alleinerziehung | person | anforderung | § 30 Abs. 3 |
| `warmwasser-dezentral-nachweis` | Nachweis dezentraler Warmwasserbereitung (Boiler/Durchlauferhitzer), ggf. separate Messung | Warmwasser = dezentral | household | hinweis | § 30 Abs. 7 |
| `wfbm-mittagessen-vertrag` | Vertrag/Bescheinigung über gemeinschaftliche Mittagsverpflegung in WfbM / bei anderem Leistungsanbieter / tagesstrukturierendem Angebot, Arbeitstage pro Woche | Person nimmt am Mittagessen der Werkstatt teil | person | anforderung | § 42b Abs. 2 |
| `bildung-eingliederungshilfe` | Bescheid über Leistungen zur Teilhabe an Bildung nach § 112 Abs. 1 Nr. 1, 2 SGB IX | Antrag nennt solche Leistungen | person | anforderung | § 42b Abs. 3 |

### 1.7 Kranken- und Pflegeversicherung

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `kv-pv-nachweis` | Mitgliedsbescheinigung Krankenkasse/Pflegekasse mit Versicherungsart (Pflicht, familienversichert, freiwillig, privat) | immer, für jede Person der Einsatzgemeinschaft | person | anforderung | § 32 Abs. 1, 2; § 42 Nr. 2 |
| `kv-beitragsbescheid-freiwillig` | Beitragsbescheid (Beitrag, Zusatzbeitrag, ggf. Beitragszuschlag) | Versicherungsart = freiwillig gesetzlich | person | anforderung | § 32 Abs. 2, 3, 3a |
| `pkv-beitrag-leistungsumfang` | Versicherungsschein/Beitragsmitteilung der privaten KV/PV mit Tarif (Basistarif/Standardtarif) und Leistungsumfang | Versicherungsart = privat | person | anforderung | § 32 Abs. 4, 5 |
| `kv-auslaendisch` | Nachweis ausländischer Krankenversicherung | Antrag nennt ausländische KV | person | anforderung | § 32 |
| `kv-fehlt-letzte-versicherung` | Angaben zur letzten Versicherung (Kasse, von–bis) | aktuell keine Krankenversicherung angegeben | person | anforderung | § 32; § 264 SGB V (laut DV-Hinweisen; nicht verifiziert) |

### 1.8 Einkommensnachweise (nach Einkommensart, je Person der Einsatzgemeinschaft)

Grundsatz: Einkommen sind alle Einkünfte in Geld oder Geldeswert (§ 82 Abs. 1). Der DV-Musterantrag fordert Einkommensnachweise der **letzten 12 Monate** (Ziff. 5).

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `rentenbescheid` | Aktueller Rentenbescheid der gesetzlichen RV (Rentenart, Brutto, KV/PV-Beitrag, Zahlbetrag, Rentenbeginn, Befristung) | Bezug gesetzlicher Rente (Alters-, EM-, Hinterbliebenenrente) | person | anforderung | § 82 Abs. 1 |
| `rentenanpassungsmitteilung` | Rentenanpassungsmitteilung zum **01.07.2026** | Bezug gesetzlicher Rente und Bewilligungszeitraum umfasst Monate ab Juli 2026, vorhandener Bescheid datiert vor dem 01.07.2026 | person | anforderung | § 82 Abs. 1, Abs. 7 (Zuflussmonat) |
| `grundrentenzuschlag-nachweis` | Nachweis über Grundrentenzuschlag bzw. mindestens **33 Jahre Grundrentenzeiten** (oder vergleichbare Zeiten) | Antrag nennt Grundrentenzuschlag oder ≥ 33 Jahre Grundrentenzeiten | person | anforderung | § 82a Abs. 1, 2 |
| `betriebsrente-nachweis` | Leistungsmitteilung Betriebs-/Werksrente, Zusatzversorgung (VBL o. ä.), Pension | Bezug Betriebsrente/Pension | person | anforderung | § 82 Abs. 1; § 82 Abs. 4, 5 (Freibetrag zusätzliche Altersvorsorge) |
| `private-altersvorsorge-auszahlung` | Leistungsmitteilung private Rente (Riester, Rürup, private Rentenversicherung, Leibrente) | Bezug privater Rente | person | anforderung | § 82 Abs. 1, Abs. 4, 5 |
| `auslandsrente-nachweis` | Bescheid des ausländischen Rententrägers, Zahlbetrag und Währung | Auslandsrente / Beschäftigungszeiten im Ausland | person | anforderung | § 82 Abs. 1 |
| `auslandszeiten-rentenantrag` | Nachweis, dass Rente aus ausländischen Beitragszeiten beantragt ist | Auslandsbeschäftigung mit Beiträgen, aber keine Auslandsrente | person | hinweis | § 2 Abs. 1 (vorrangige Ansprüche) |
| `erwerbseinkommen-nachweis` | Gehaltsabrechnungen (12 Monate) / Arbeitsvertrag / Minijob-Nachweis | Person erwerbstätig (auch Minijob, Ehrenamtspauschale) | person | anforderung | § 82 Abs. 1, 2, 3 |
| `wfbm-entgelt` | Entgeltnachweis der Werkstatt | Person in WfbM | person | anforderung | § 82 Abs. 3 (abweichender Freibetrag Werkstatt) |
| `selbststaendig-einkommen` | Einkommensteuerbescheid, Gewinnermittlung/BWA, Prognose | Person selbständig/gewerblich/Land- und Forstwirtschaft | person | anforderung | § 82 Abs. 1, 2 |
| `vermietung-einnahmen` | Nachweise Einnahmen aus Vermietung/Untervermietung/Verpachtung | Antrag nennt Miet-/Untermieteinnahmen | person | anforderung | § 82 Abs. 1 |
| `kapitalertraege-nachweis` | Zinsbescheinigung / Erträgnisaufstellung / Jahressteuerbescheinigung | Konten, Depots oder Kapitalerträge vorhanden | person | anforderung | § 82 Abs. 1; § 43 Abs. 2 (Kapitalerträge bis 26 €/Jahr bleiben frei) |
| `wohngeldbescheid` | Wohngeld- oder Lastenzuschussbescheid | Antrag nennt Wohngeld/Lastenzuschuss oder Wohngeld-Antrag gestellt | household | anforderung | § 82 Abs. 1; § 7 WoGG (siehe Abschnitt 5) |
| `sgb2-bescheid` | Bescheid über Grundsicherungsgeld nach SGB II (Bewilligung/Einstellung) | laufender oder vorheriger SGB-II-Bezug | person | anforderung | § 44 Abs. 3 Satz 3; § 2 |
| `sgb3-leistung` | Bescheid Arbeitslosengeld / andere SGB-III-Leistung | Bezug angegeben | person | anforderung | § 82 Abs. 1 |
| `krankengeld-nachweis` | Krankengeld-/Übergangsgeldbescheinigung | Bezug angegeben | person | anforderung | § 82 Abs. 1 |
| `unterhalt-erhalten` | Nachweis erhaltener Unterhaltszahlungen (Titel, Vereinbarung, Zahlungseingänge) | Person erhält Unterhalt | person | anforderung | § 82 Abs. 1 |
| `kindergeld-nachweis` | Kindergeldbescheid und Angabe, ob Kindergeld weitergeleitet wird | Person bezieht Kindergeld (z. B. Eltern für EM-berechtigtes erwachsenes Kind, oder Antragsteller:in für eigenes Kind) | person | anforderung | § 82 Abs. 1 Satz 3 (Zurechnung bei Minderjährigen) |
| `bvg-lag-oeg-leistung` | Bescheid über Leistungen nach BVG/SGB XIV, Lastenausgleich, OEG | Bezug oder Antrag angegeben | person | anforderung | § 82 Abs. 1 (Ausnahmen in Abs. 1 Satz 1 prüfen) |
| `sachbezuege-privatrecht` | Vertrag über Wohnrecht, Kost, Taschengeld, Leibrente, Altenteil | Antrag nennt privatrechtliche geldwerte Ansprüche | person | anforderung | § 82 Abs. 1 (Geldeswert) |
| `absetzbetraege-nachweis` | Belege zu absetzbaren Beträgen (Steuern, Haftpflicht-, Hausrat-, Kfz-Haftpflicht-, Sterbegeldversicherung, Arbeitsmittel, Fahrkosten) | Antrag beansprucht Absetzungen (DV-Ziff. 6) | person | anforderung | § 82 Abs. 2 |
| `kein-einkommen-erklaerung` | Erklärung, wovon der Lebensunterhalt bisher bestritten wurde | Person gibt kein Einkommen und keinen Vorbezug an | person | anforderung | § 60 Abs. 1 SGB I |

### 1.9 Vermögensnachweise

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `vermoegenserklaerung` | Vollständige Vermögensangaben (Bargeld, Giro-/Spar-/Online-Konten inkl. PayPal, Wertpapiere, Schmuck/Edelmetalle, Kfz, Immobilien, Forderungen, Erbansprüche, Versicherungen) im In- und Ausland | immer, für jede Person der Einsatzgemeinschaft | person | anforderung | § 90 Abs. 1; § 43 Abs. 1 Satz 1 |
| `kontoauszuege` | Lückenlose Kontoauszüge aller Konten (Zeitraum nach kommunaler Praxis, oft 3 Monate; **nicht verifiziert**, siehe 8.3) | für jedes angegebene Konto | person | anforderung | § 60 Abs. 1 SGB I; § 90 Abs. 1 |
| `sparbuecher-depot` | Sparbuch (aktueller Stand), Depotauszug, Bausparvertrag | Spar-/Depot-/Bausparguthaben angegeben | person | anforderung | § 90 Abs. 1 |
| `lebensversicherung-rueckkaufswert` | Aktuelle Bescheinigung Rückkaufswert Kapital-/Lebensversicherung | Lebensversicherung angegeben | person | anforderung | § 90 Abs. 1, Abs. 3 |
| `riester-ruerup-nachweis` | Nachweis staatlich geförderter Altersvorsorge (Zertifizierung, Stand) | Riester/Rürup angegeben | person | anforderung | § 90 Abs. 2 Nr. 2 (geschützt, wenn nach § 10a / Abschnitt XI EStG gefördert) |
| `bestattungsvorsorge-vertrag` | Bestattungsvorsorgevertrag / Treuhandvertrag / Sterbegeldversicherung mit Leistungsverzeichnis und Betrag | Bestattungsvorsorge angegeben | person | anforderung | § 90 Abs. 3 (Härte; siehe 3.3) |
| `kfz-nachweis` | Fahrzeugschein, Baujahr, Kilometerstand, Wertangabe | Kfz angegeben | person | anforderung | § 90 Abs. 2 Nr. 10 |
| `immobilie-nicht-selbstgenutzt` | Grundbuchauszug, Wert, Größe, Lage; Miet-/Pachterträge | sonstiger Grundbesitz angegeben | person | anforderung | § 90 Abs. 1 |
| `forderungen-erbschaft` | Unterlagen zu Forderungen gegen Dritte, Erbschaften, Pflichtteilsansprüchen | Antrag nennt Forderungen/Erbansprüche | person | anforderung | § 90 Abs. 1 |
| `vermoegensuebertragung-10j` | Schenkungs-/Übergabeverträge, Löschung von Wohnrecht/Nießbrauch, Höhe und Datum | Vermögensübertragung in den letzten 10 Jahren angegeben | person | anforderung | § 41 Abs. 4; § 528, § 529 Abs. 1 BGB (Rückforderung, 10-Jahres-Grenze) |

### 1.10 Unterhalt

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `angaben-kinder-eltern` | Angaben zu Eltern und Kindern (Namen, Berufe) und Einschätzung, ob eine Person jährlich ≥ 100.000 € Gesamteinkommen hat | immer (Pflichtfeld im Antrag, dient der Vermutungsprüfung) | person | anforderung | § 94 Abs. 1a Satz 3, 4 |
| `unterhalt-ex-partner` | Angaben zu getrennt lebenden/geschiedenen Ehegatt:innen (Name, Anschrift, Einkommen); Titel/Urkunde/Scheidungsurteil, Verzichtserklärung | Familienstand = getrennt lebend / geschieden | person | anforderung | § 2 Abs. 1; § 94 Abs. 1 |
| `unterhaltstitel` | Vollstreckbarer Titel oder notarielle Urkunde | Antrag gibt „Unterhalt tituliert" an | person | anforderung | § 94 Abs. 1 |

---

## 2. Plausibilitäts- und Widerspruchsregeln (Plausibilitätsprüfung)

Regel-Liste zur Erkennung von Widersprüchen zwischen **Antragsangaben** und **Nachweisen** bzw. innerer Inkonsistenz. Jede Regel: `id`, Beschreibung, verglichene Quellen, `severity`, Beispiel.

### 2.1 Anspruchsvoraussetzungen

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-altersgrenze-nicht-erreicht` | Anspruchsgrund Alter, aber Altersgrenze laut Geburtsdatum im Antragsmonat noch nicht erreicht | Ausweis.geburtsdatum + Tabelle § 41 Abs. 2 ↔ Antrag.datum | anforderung | geb. 03.1960, Altersgrenze 66 J. 4 Mon. = 07.2026; Antrag 05.2026 → Anspruchsgrund Alter nicht gegeben; EM prüfen oder SGB II |
| `plausi-altersgrenze-folgemonat` | Altersgrenze wird erst nach dem Antragsmonat erreicht → Rückwirkung auf den Monatsersten des Antragsmonats nicht möglich | Altersgrenze-Datum ↔ Antragsmonat | hinweis | Antrag 20.08., Altersgrenze erreicht 05.09. → Leistungsbeginn frühestens September (§ 44 Abs. 2) |
| `plausi-geburtsdatum-abweichung` | Geburtsdatum im Antrag ≠ Ausweis ≠ Rentenbescheid | Antrag ↔ Ausweis ↔ Rentenbescheid | anforderung | Tippfehler Jahrgang → Altersgrenze falsch |
| `plausi-em-rente-befristet` | EM-Rente laut Bescheid **befristet** → Dauerhaftigkeit nicht belegt | Rentenbescheid.befristet_bis | anforderung | befristet bis 31.12.2027 → Ersuchen nach § 45 prüfen; bis dahin ggf. SGB II / 3. Kapitel |
| `plausi-em-rente-teilweise-oder-arbeitsmarkt` | EM-Rente wegen **teilweiser** Erwerbsminderung oder volle EM-Rente nur wegen verschlossenem Arbeitsmarkt → § 41 Abs. 3 nicht belegt | Rentenbescheid.rentenart / Begründung | anforderung | „Rente wegen voller Erwerbsminderung … aufgrund der Arbeitsmarktlage" → keine Feststellung i. S. d. § 41 Abs. 3 |
| `plausi-em-ersuchen-entbehrlich` | Ersuchen an RV-Träger ist nicht nötig, weil ein Tatbestand nach § 45 Satz 3 vorliegt | Rentenbescheid (unbefristet, voll, arbeitsmarktunabhängig) / WfbM-Nachweis / § 109a-Stellungnahme | hinweis | Person arbeitet im Arbeitsbereich einer WfbM → kein Ersuchen (§ 45 Satz 3 Nr. 3) |
| `plausi-em-alter-unter-18` | Anspruchsgrund Erwerbsminderung, Person noch nicht 18 | Ausweis.geburtsdatum | anforderung | 17-Jährige → kein Anspruch nach 4. Kapitel |
| `plausi-auslandsaufenthalt` | Geplanter oder laufender Auslandsaufenthalt ≥ 4 Wochen | Antrag.auslandsaufenthalt ↔ Kontoauszug (Auslandsumsätze) | hinweis | 6 Wochen Reise angegeben → Leistungen ab 5. Woche entfallen (§ 41a) |
| `plausi-aufenthalt-ausschluss` | Aufenthaltsstatus fällt unter Ausschluss nach § 23 Abs. 3 oder AsylbLG | Antrag.aufenthaltsstatus ↔ Aufenthaltstitel | anforderung | Aufenthaltsgestattung → AsylbLG, nicht SGB XII |
| `plausi-beduerftigkeit-herbeigefuehrt` | Anhaltspunkte, dass Hilfebedürftigkeit in den letzten 10 Jahren vorsätzlich oder grob fahrlässig herbeigeführt wurde (Schenkung, Verzicht auf Wohnrecht, Kapitalauszahlung ohne Verbleib) | Antrag Ziff. Vermögensübertragungen ↔ Kontoauszüge (große Abgänge) ↔ Verträge | hinweis | 60.000 € 2021 an Enkel geschenkt → § 41 Abs. 4 und Rückforderung § 528 BGB prüfen (Sachbearbeitung entscheidet) |
| `plausi-sgb2-uebergang` | Laufender SGB-II-Bezug und Altersgrenze wird erreicht → Anschluss-Bewilligungszeitraum nach § 44 Abs. 3 Satz 3 | SGB-II-Bescheid ↔ Altersgrenze-Datum | hinweis | SGB II endet 31.10. → Grundsicherung ab 01.11. |

### 2.2 Einsatzgemeinschaft und Haushalt

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-partner-fehlt` | Familienstand „verheiratet" (nicht getrennt lebend) oder weitere erwachsene Person gleichen Nachnamens/Geburtsjahrgangs in der Wohnung, aber keine 2. Person in der Einsatzgemeinschaft | Antrag.familienstand ↔ Antrag.personen ↔ Meldebescheinigung / Mietvertrag (Mieter) | anforderung | verheiratet, Ehefrau als Mitmieterin im Mietvertrag, aber nicht im Antrag → Einkommen/Vermögen der Ehefrau fehlen |
| `plausi-getrennt-lebend-gemeinsame-wohnung` | „getrennt lebend" angegeben, aber gleiche Wohnung | Antrag.familienstand ↔ Antrag.anschrift beider | hinweis | Trennung in der Wohnung → Sachbearbeitung klärt (Einstehensgemeinschaft?) |
| `plausi-ehe-aehnliche-gemeinschaft` | Nicht verwandte Person gleichen Alters lebt in der Wohnung; Mietvertrag gemeinsam; gemeinsames Konto | Antrag.haushaltsangehoerige ↔ Mietvertrag ↔ Kontoauszug | hinweis | Mitbewohner seit 8 Jahren, gemeinsames Konto → § 20 prüfen |
| `plausi-regelbedarfsstufe-inkonsistent` | Angegebene/übernommene Regelbedarfsstufe passt nicht zur Wohnsituation | Einsatzgemeinschaft ↔ Wohnform | hinweis | Stufe 2 ohne Partner in der Wohnung; Stufe 3 bei eigener Wohnung |
| `plausi-haushaltsangehoerige-unterstuetzung` | Haushaltsangehörige (z. B. erwachsene Kinder) leben mit; keine Anrechnung vermuteter Unterstützung, aber tatsächliche regelmäßige Zahlungen auf dem Kontoauszug | Kontoauszug.eingaenge ↔ Antrag.einkommen | hinweis | monatlich 200 € „Sohn" → als Einkommen/Zuwendung (§ 82, § 84) klären; keine Vermutung nach § 39 (§ 43 Abs. 5) |
| `plausi-personenzahl-wohnung` | Zahl der Personen in der Wohnung laut Antrag ≠ Mietvertrag/Meldebescheinigung/Nebenkostenabrechnung | Antrag.personen_wohnung ↔ Nachweise | anforderung | Antrag „1 Person", Nebenkostenabrechnung nach 2 Personen umgelegt → Kopfteil § 42a Abs. 4 klären |

### 2.3 Unterkunft und Heizung

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-miete-abweichung` | Kaltmiete / kalte Nebenkosten im Antrag ≠ Mietvertrag / Mietbescheinigung / Kontoauszug | Antrag.kaltmiete, .nebenkosten ↔ Mietvertrag ↔ Kontoauszug.miete | anforderung | Antrag 520 €, Abbuchung 575 € → aktuelle Mietänderung anfordern |
| `plausi-miete-nicht-gezahlt` | Keine Mietzahlung auf den Kontoauszügen erkennbar | Kontoauszug ↔ Antrag.miete | anforderung | Miete bar oder durch Dritte? → Nachweis (§ 35 Abs. 1: tatsächliche Aufwendungen) |
| `plausi-heizung-in-miete-unklar` | Heizkosten nicht getrennt ausgewiesen (Warmmiete-Pauschale ohne Aufschlüsselung) | Mietvertrag ↔ Antrag.heizkosten | anforderung | „Miete inkl. aller NK 700 €" → Aufteilung anfordern (Heizung eigenständiger Bedarf, Karenzzeit gilt nur für Unterkunft) |
| `plausi-haushaltsstrom-in-miete` | In der Miete enthaltene Kosten, die aus dem Regelsatz zu decken sind (Haushaltsstrom, Warmwasser-Anteile, Kabel, Möblierung) | Antrag DV-Ziff. 4.1 ↔ Mietvertrag | hinweis | Strompauschale 40 € in Miete → Sachbearbeitung: nicht KdU |
| `plausi-kdu-ueber-richtwert` | Kaltmiete + kalte NK liegen über dem kommunalen Richtwert (Angemessenheit) | Antrag.bruttokaltmiete ↔ kommunaler Richtwert (Konfiguration) | hinweis | Hinweis nur für die Mitteilung nach § 35 Abs. 2 Satz 2; in der Karenzzeit werden die tatsächlichen Unterkunftskosten anerkannt (§ 35 Abs. 1 Satz 2, 3) |
| `plausi-heizkosten-ueber-richtwert` | Heizkosten über kommunalem/bundesweitem Vergleichswert | Antrag.heizkosten ↔ Konfiguration | hinweis | Karenzzeit gilt nach dem Wortlaut von § 35 Abs. 1 Satz 2 nur für **Unterkunft**, nicht für Heizung |
| `plausi-karenzzeit-vorbezug` | Vorbezug SGB II/SGB XII innerhalb der letzten 3 Jahre → keine neue Karenzzeit | Antrag.vorbezug ↔ Datum | hinweis | SGB-II-Bezug bis vor 2 Jahren → Karenzzeit läuft nicht neu (§ 35 Abs. 1 Satz 6) |
| `plausi-mietvertrag-unsigniert` | Mietvertrag ohne Unterschriften oder mit abweichenden Mietparteien | Mietvertrag.unterschriften / .mieter | anforderung | Mieter ist Tochter, Antragsteller wohnt ohne eigenen Vertrag → § 42a Abs. 3 statt eigener Miete |
| `plausi-mietvertrag-angehoerige` | Mietvertrag mit nahen Angehörigen (gleicher Nachname Vermieter/Mieter) | Mietvertrag.vermieter ↔ Antragsteller.name | hinweis | Vertrag mit Sohn → Ernsthaftigkeit/tatsächliche Zahlung prüfen |
| `plausi-umzug-ohne-zusicherung` | Neuer Mietvertrag während/unmittelbar vor Antrag mit höheren Kosten, keine Zusicherung | Mietvertrag.beginn ↔ Antrag.datum ↔ Zusicherung | hinweis | Umzug während Leistungsbezug in teurere Wohnung → nur angemessene Kosten (§ 35a Abs. 2) |
| `plausi-nk-nachzahlung-guthaben` | Nebenkosten-/Heizkostenabrechnung weist Nachzahlung oder Guthaben aus | Abrechnung.saldo ↔ Antrag | hinweis | Guthaben 180 € → Sachbearbeitung: Anrechnung; Nachzahlung → Bedarf im Fälligkeitsmonat (Behandlung nicht an der Norm verifiziert) |
| `plausi-wohnflaeche-personen` | Wohnfläche im Antrag ≠ Mietvertrag | Antrag.wohnflaeche ↔ Mietvertrag.wohnflaeche | hinweis | 65 m² vs. 58 m² → Rückfrage |

### 2.4 Einkommen

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-rente-abweichung` | Rentenbetrag im Antrag ≠ Rentenbescheid / Anpassungsmitteilung / Kontoauszug | Antrag.rente ↔ Bescheid.zahlbetrag ↔ Kontoauszug.eingang | anforderung | Antrag 890 €, Konto 927 € → aktuelle Anpassungsmitteilung anfordern |
| `plausi-rentenanpassung-fehlt` | Nur Rentenbescheid vor dem 01.07.2026 vorhanden, Bewilligungszeitraum umfasst Monate ab Juli 2026 | Bescheid.datum ↔ Bewilligungszeitraum | anforderung | Bescheid 2024 → Anpassung 2026 (+4,24 %) fehlt |
| `plausi-rentenanpassung-unplausibel` | Rentenzahlbetrag ab 07/2026 weicht deutlich von Vorbetrag × 1,0424 ab (Toleranz wegen KV/PV-Beitragsänderungen) | Anpassungsmitteilung ↔ Vorbescheid | hinweis | nur Plausibilitätsband, keine Berechnung |
| `plausi-kontoauszug-unerklaerte-eingaenge` | Regelmäßige Eingänge auf dem Konto, die im Antrag nicht als Einkommen erscheinen (Betriebsrente, Auslandsrente, Unterhalt, Miete, Zuwendungen) | Kontoauszug.eingaenge ↔ Antrag.einkommensarten | anforderung | monatlich 112 € „VBL" → Betriebsrente nicht angegeben |
| `plausi-betriebsrente-freibetrag-ohne-nachweis` | Freibetrag zusätzliche Altersvorsorge beansprucht, Art der Rente (freiwillig/zusätzlich) nicht belegt | Antrag ↔ Leistungsmitteilung | hinweis | § 82 Abs. 4, 5: Freibetrag nur für zusätzliche Altersvorsorge |
| `plausi-grundrente-freibetrag-ohne-nachweis` | Freibetrag § 82a beansprucht, aber 33 Jahre Grundrentenzeiten nicht belegt | Antrag.grundrentenzeiten ↔ Rentenbescheid/DRV-Mitteilung | anforderung | „Ich habe 33 Jahre" ohne Beleg |
| `plausi-grundrente-nicht-beansprucht` | Rentenbescheid weist Grundrentenzuschlag aus, Antrag verneint 33 Jahre Grundrentenzeiten | Rentenbescheid.grundrentenzuschlag ↔ Antrag | hinweis | Zuschlag vorhanden → Freibetrag § 82a wahrscheinlich; Sachbearbeitung prüft (zugunsten des Antragstellers) |
| `plausi-wohngeld-als-einkommen` | Wohngeldbescheid liegt vor, Wohngeld im Antrag nicht als Einkommen angegeben | Wohngeldbescheid ↔ Antrag.einkommen | anforderung | siehe auch Abschnitt 5 |
| `plausi-ex-partner-unterhalt-fehlt` | Geschieden/getrennt lebend, kein Unterhalt angegeben, kein Verzicht/Nachweis | Antrag.familienstand ↔ Antrag.unterhalt | hinweis | Unterhaltsanspruch gegen Ex-Ehegatten zu verfolgen (§ 2, § 94) |
| `plausi-erwerbseinkommen-abweichung` | Erwerbseinkommen im Antrag ≠ Gehaltsabrechnung | Antrag ↔ Abrechnung | anforderung | Minijob 520 € vs. Abrechnung 603 € |
| `plausi-kein-einkommen-aber-ausgaben` | Kein Einkommen angegeben, aber laufende Miete/Kosten wurden bezahlt | Antrag.einkommen ↔ Kontoauszug.ausgaben | anforderung | Erklärung, wovon bisher gelebt wurde (§ 60 SGB I) |
| `plausi-zufluss-einmalig` | Einmalige größere Gutschrift (Nachzahlung, Erbe, Auszahlung Versicherung) im Prüfzeitraum | Kontoauszug.eingaenge | hinweis | Rentennachzahlung 3.000 € → Einkommen im Zuflussmonat, ggf. Aufteilung auf 6 Monate (§ 82 Abs. 7); danach Vermögen |

### 2.5 Vermögen

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-vermoegen-ueber-schonbetrag` | Summe verwertbares Barvermögen (Konten, Bargeld, Rückkaufswerte, Wertpapiere) über dem Barbetrag (10.000 € je volljährige Person der Einsatzgemeinschaft + 500 € je überwiegend unterhaltene Person) | Vermögensangaben ↔ Kontoauszug.saldo ↔ Depot ↔ Versicherung | hinweis | Alleinstehend, Sparbuch 14.200 € → Sachbearbeitung prüft Einsatz/Härte (§ 90 Abs. 2 Nr. 9, Abs. 3); **keine** automatische Ablehnung |
| `plausi-kontostand-abweichung` | Kontostand laut Kontoauszug ≠ Vermögensangabe im Antrag | Antrag.vermoegen ↔ Kontoauszug.saldo | anforderung | Antrag 2.000 €, Auszug 7.300 € |
| `plausi-konto-nicht-angegeben` | Überweisungen auf/von einem Konto, das im Antrag nicht genannt ist | Kontoauszug.gegenkonto (eigene IBAN) ↔ Antrag.konten | anforderung | Sparplan-Überweisung auf eigenes Tagesgeldkonto |
| `plausi-grosse-abgaenge` | Größere Abbuchungen / Barabhebungen ohne erkennbaren Zweck im Prüfzeitraum | Kontoauszug.ausgaenge | hinweis | 5.000 € Barabhebung → Verbleib klären (§ 41 Abs. 4, § 90) |
| `plausi-wertpapiere-ohne-ertraege` | Depot vorhanden, keine Kapitalerträge angegeben | Vermögen.wertpapiere ↔ Einkommen.kapitalertraege | hinweis | Erträgnisaufstellung anfordern (Freigrenze 26 €/Jahr, § 43 Abs. 2) |
| `plausi-lebensversicherung-ohne-wert` | Lebensversicherung angegeben, Rückkaufswert fehlt | Vermögen.versicherungen | anforderung | Rückkaufswert-Bescheinigung anfordern |
| `plausi-bestattungsvorsorge-hoehe` | Bestattungsvorsorge über einem kommunalen Orientierungswert oder mit nicht bestattungsbezogenen Positionen (Grabpflege über Jahre, Bewirtung) | Vertrag.leistungsverzeichnis ↔ Konfiguration | hinweis | Angemessenheit ist Einzelfallentscheidung (§ 90 Abs. 3; siehe 3.3) |
| `plausi-kfz-wert` | Kfz mit hohem Zeitwert (Baujahr, Modell) | Kfz-Angaben ↔ Konfiguration | hinweis | Angemessenheit § 90 Abs. 2 Nr. 10; kein gesetzlicher Betrag im SGB XII gefunden |
| `plausi-immobilie-nicht-angegeben` | Grundsteuer-/Versicherungsabbuchungen für ein anderes Objekt, Mieteinnahmen, aber kein Grundbesitz angegeben | Kontoauszug ↔ Antrag.vermoegen | anforderung | „Grundsteuer Gemeinde X" ohne Immobilie im Antrag |
| `plausi-eigenheim-angemessenheit` | Selbstgenutztes Eigentum mit großer Wohn-/Grundstücksfläche für 1–2 Personen | Eigentum.flaeche ↔ Personenzahl | hinweis | Angemessenheit nach § 90 Abs. 2 Nr. 8 (Bewohnerzahl, Wohnbedarf, Größe, Wert) — Sachbearbeitung |

### 2.6 Mehrbedarfe und Versicherung

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-merkzeichen-g-ohne-nachweis` | Merkzeichen G im Antrag angegeben, kein Ausweis/Bescheid oder Ausweis ohne G | Antrag.merkzeichen ↔ Ausweis.merkzeichen | anforderung | Mehrbedarf § 30 Abs. 1 erst ab Nachweis |
| `plausi-merkzeichen-g-nicht-beantragt` | Ausweis mit Merkzeichen G liegt bei, Mehrbedarf im Antrag nicht angekreuzt | Ausweis ↔ Antrag Ziff. 4.5 | hinweis | Mehrbedarf zugunsten prüfen |
| `plausi-ausweis-abgelaufen` | Schwerbehindertenausweis vor Beginn oder während des Bewilligungszeitraums abgelaufen | Ausweis.gueltig_bis ↔ Bewilligungszeitraum | anforderung | Verlängerung / neuer Bescheid |
| `plausi-merkzeichen-g-em-befristet` | Merkzeichen G, Person unter Altersgrenze, aber nicht voll erwerbsgemindert nach SGB VI | Ausweis ↔ Anspruchsgrund | hinweis | § 30 Abs. 1 Nr. 2 verlangt volle Erwerbsminderung |
| `plausi-ernaehrung-ohne-diagnose` | Ernährungsmehrbedarf beansprucht, ärztliche Bescheinigung ohne Diagnose oder veraltet | Bescheinigung.datum/.diagnose | anforderung | aktuelle Bescheinigung anfordern |
| `plausi-kv-beitrag-abweichung` | KV/PV-Beitrag im Antrag ≠ Beitragsbescheid / Rentenbescheid (bei Rentnern wird der Beitrag i. d. R. von der Rente einbehalten) | Antrag.kv_beitrag ↔ Nachweise | hinweis | Beitrag doppelt als Bedarf und als Abzug angegeben |
| `plausi-pkv-kein-basistarif` | Private KV mit Beitrag über dem halbierten Basistarif | PKV-Bescheinigung.tarif/.beitrag | hinweis | Angemessenheit § 32 Abs. 4 — Sachbearbeitung |
| `plausi-keine-kv` | Keine Krankenversicherung angegeben | Antrag Ziff. 4.6 | anforderung | Klärung Versicherungsstatus |

### 2.7 Formale und zeitliche Widersprüche

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-antrag-ohne-unterschrift` | Antrag nicht unterschrieben (Antragsteller:in oder Partner:in) | Antrag.unterschriften | anforderung | fehlende Unterschrift Partner |
| `plausi-antrag-ohne-datum` | Antragsdatum fehlt → Leistungsbeginn (§ 44 Abs. 2) unklar | Antrag.datum ↔ Posteingang.eingangsdatum | anforderung | Eingangsstempel maßgeblich; bei Weiterleitung Eingang bei erster Stelle (§ 16 Abs. 2 SGB I) |
| `plausi-nachweise-veraltet` | Nachweise beziehen sich nicht auf den aktuellen Zeitraum | Nachweis.datum ↔ Antragsdatum | hinweis | Kontoauszug älter als 3 Monate (Schwelle kommunal) |
| `plausi-name-abweichung` | Name/Anschrift auf Nachweisen ≠ Antrag | Nachweis.name ↔ Antrag.name | hinweis | Nachweis gehört zu anderer Person / Geburtsname |
| `plausi-gesonderter-antrag-noetig` | Antrag nennt Bedarfe, die gesondert zu beantragen sind (Erstausstattung, Darlehen, Schuldenübernahme) | Antrag Ziff. 11 / Freitext | hinweis | Erstausstattung nach § 31 → gesonderter Antrag (§ 44 Abs. 1 Satz 2) |

---

## 3. Einkommens- und Vermögenslogik (nur Struktur, keine Berechnung)

### 3.1 Einkommen (§§ 82–84 SGB XII, § 43 SGB XII)

```
Einzusetzendes Einkommen (Struktur, je Monat)
  = Einkünfte in Geld oder Geldeswert (§ 82 Abs. 1)       ← Rente, Betriebsrente, Wohngeld, Unterhalt, Erwerb, Kapital …
      ohne die in § 82 Abs. 1 ausgenommenen Leistungen      ← u. a. Leistungen nach dem SGB XII selbst
  − Absetzungen (§ 82 Abs. 2)                              ← Steuern, Pflichtbeiträge Sozialversicherung,
                                                            angemessene Versicherungen, Werbungskosten
  − Freibetrag Erwerbstätigkeit (§ 82 Abs. 3)              ← 30 % des Erwerbseinkommens, höchstens 50 % RBS 1 (WfbM abweichend)
  − Freibetrag zusätzliche Altersvorsorge (§ 82 Abs. 4, 5) ← 100 € + 30 % des übersteigenden Betrags, höchstens 50 % RBS 1
  − Freibetrag Grundrentenzeiten (§ 82a)                   ← 100 € + 30 % der übersteigenden gesetzlichen Rente, höchstens 50 % RBS 1,
                                                            nur bei ≥ 33 Jahren Grundrentenzeiten/vergleichbaren Zeiten
  − Kapitalerträge bis 26 €/Kalenderjahr (§ 43 Abs. 2)
  Einkommen des Partners: nur soweit es dessen eigenen notwendigen Lebensunterhalt übersteigt (§ 43 Abs. 1 Satz 2)
```

**Plausibilitätsrelevante Eigenschaften:**
- **Zuflussprinzip:** Einnahmen zählen im Monat des Zuflusses; Nachzahlungen können auf sechs Monate aufgeteilt werden (§ 82 Abs. 7). → Kontoauszüge sind die zentrale Plausibilitätsquelle für Rentenzahlbeträge.
- **Rentenanpassung 2026:** Renten steigen zum **01.07.2026 um 4,24 %**; aktueller Rentenwert von 40,79 € auf 42,52 €. Die Rentenanpassungsmitteilungen wurden voraussichtlich zwischen dem 13.06. und dem 24.07.2026 versandt (Deutsche Rentenversicherung, Meldung zum Bundesratsbeschluss). → Regel `rentenanpassungsmitteilung`.
- **Zuwendungen** der freien Wohlfahrtspflege und freiwillige Zuwendungen Dritter bleiben in der Regel außer Betracht (§ 84 Abs. 1, 2), außer sie verbessern die Lage so, dass daneben Sozialhilfe ungerechtfertigt wäre. → Regelmäßige Zahlungen von Angehörigen sind ein Hinweis, keine Anforderung.
- **Wohngeld** ist Einkommen im Sinne von § 82 Abs. 1 (im DV-Musterantrag unter „Andere Einkommensarten" abgefragt); eine ausdrückliche Ausnahme in § 82 Abs. 1 wurde nicht gefunden.
- **Kindergeld** für minderjährige Kinder wird dem Kind zugerechnet, soweit es dort zur Deckung des notwendigen Lebensunterhalts benötigt wird (§ 82 Abs. 1).

### 3.2 Vermögen (§ 90 SGB XII, Barbetragsverordnung)

Einzusetzen ist das gesamte **verwertbare** Vermögen (§ 90 Abs. 1). **Nicht** einzusetzen (§ 90 Abs. 2, Auswahl mit Nachweisrelevanz):

| Nr. | Schonvermögen | Nachweis-/Plausibilitätsbezug |
|---|---|---|
| 2 | nach § 10a / Abschnitt XI EStG gefördertes Altersvorsorgevermögen (Riester), inkl. monatlicher Auszahlung | Zertifizierung/Förderung belegen (`riester-ruerup-nachweis`). Rürup (Basisrente) ist in Nr. 2 nicht genannt; Einordnung **nicht verifiziert** |
| 4 | angemessener Hausrat | keine Nachweise |
| 8 | angemessenes Hausgrundstück (Bewohnerzahl, Wohnbedarf, Grundstücks- und Hausgröße, Zuschnitt, Ausstattung, Wert) | `eigentum-wert-groesse`; Hinweis `plausi-eigenheim-angemessenheit` |
| 9 | kleinere Barbeträge oder sonstige Geldwerte | Barbetragsverordnung (s. u.) |
| 10 | angemessenes Kraftfahrzeug | `kfz-nachweis`; kein Betrag im Gesetz |
| Abs. 3 | Härtefall (u. a. Bestattungsvorsorge) | Einzelfall |

**Barbetrag (Verordnung zur Durchführung des § 90 Abs. 2 Nr. 9 SGB XII, § 1):** **10.000 €** für jede in § 19 Abs. 3, § 27 Abs. 1 und 2, § 41 und § 43 Abs. 1 Satz 2 genannte volljährige Person sowie jede alleinstehende minderjährige Person; **500 €** für jede Person, die von diesen überwiegend unterhalten wird. Erhöhung bei besonderer Notlage (§ 2 Abs. 1 der VO), Herabsetzung bei Voraussetzungen der §§ 103, 94 (§ 2 Abs. 2 der VO). Stand: zuletzt geändert durch Art. 9 G v. 16.12.2022 (BGBl. I S. 2328). → Paar in der Grundsicherung: in der Regel 20.000 €.

**Bestattungsvorsorge:** Ein Bestattungsvorsorgevertrag fällt nicht unter § 90 Abs. 2, kann aber über die **Härteregelung § 90 Abs. 3** geschützt sein, soweit er angemessen ist (einfache, würdige Bestattung; Verhältnis zu den bisherigen Lebensverhältnissen). Grundsatzentscheidung laut Sekundärquellen: BSG, Urteil vom 18.03.2008, B 8/9b SO 9/06 R **(Aktenzeichen und Inhalt aus Sekundärquellen, Urteil nicht im Volltext geprüft)**. Einen gesetzlichen Höchstbetrag gibt es nicht; kommunale Orientierungswerte sind Verwaltungspraxis (offene Fachfrage 8.5).

**Vermögensübertragungen:** Schenkungen in den letzten zehn Jahren können einen Rückforderungsanspruch wegen Verarmung des Schenkers begründen (§ 528 BGB; ausgeschlossen nach Ablauf von zehn Jahren seit der Leistung, § 529 Abs. 1 BGB) und damit verwertbares Vermögen sein; zugleich ist § 41 Abs. 4 zu prüfen. Überleitung solcher Ansprüche auf den Träger nach § 93 SGB XII **(nicht verifiziert)**.

### 3.3 Unterhaltsrückgriff (§ 94 Abs. 1a SGB XII) — Fundstellen-Korrektur

- **Grundsatz:** Unterhaltsansprüche der Leistungsberechtigten gegenüber ihren **Kindern und Eltern** sind **nicht** zu berücksichtigen, es sei denn, deren jährliches Gesamteinkommen im Sinne des § 16 SGB IV beträgt **jeweils mehr als 100.000 €** (Jahreseinkommensgrenze) — § 94 Abs. 1a **Satz 1**. Der Anspruchsübergang ist insoweit ausgeschlossen (Satz 2).
- **Vermutung:** Es wird vermutet, dass das Einkommen der Unterhaltsverpflichteten die Grenze nicht überschreitet — § 94 Abs. 1a **Satz 3**.
- **Widerlegung:** Der Träger kann von den Leistungsberechtigten Angaben verlangen, die Rückschlüsse auf die Einkommensverhältnisse der Unterhaltspflichtigen zulassen (Satz 4); bei hinreichenden Anhaltspunkten gilt die Auskunftspflicht nach § 117 (Satz 5).
- Die Sätze 1–5 gelten nicht bei Leistungen nach dem 3. Kapitel an minderjährige Kinder (Satz 6) — für das 4. Kapitel also anwendbar.
- **Fundstellen-Korrektur zum Auftrag:** Die Vermutungsregel steht **nicht (mehr) in § 43 Abs. 5 SGB XII**. Der aktuelle § 43 Abs. 5 lautet nur: „§ 39 Satz 1 ist nicht anzuwenden." (Keine Vermutung der Bedarfsdeckung durch Haushaltsangehörige.) Die 100.000-€-Regel mit Vermutung steht in **§ 94 Abs. 1a Satz 1–5**. Die frühere Fassung von § 43 (mit Leistungsausschluss bei widerlegter Vermutung) wird in Kommentaren noch als „Abs. 5 Satz 3" zitiert; die Verschiebung erfolgte vermutlich durch das Angehörigen-Entlastungsgesetz zum 01.01.2020 **(Datum und Gesetz nicht verifiziert)**. Nach aktuellem Wortlaut enthält § 43 **keinen** Leistungsausschluss mehr; Folge einer widerlegten Vermutung ist der Anspruchsübergang nach § 94 (eigene Ableitung aus dem Wortlaut, **nicht an Kommentar verifiziert**).
- **Prüf-Folge für die App:** nur Angaben erheben (`angaben-kinder-eltern`); Einkommensnachweise der Kinder werden **nicht** angefordert, solange keine Anhaltspunkte bestehen. Anhaltspunkt (z. B. Beruf „Chefarzt", „Geschäftsführer", Antrag kreuzt „ja, kann über 100.000 € liegen") → Hinweis an Sachbearbeitung.
- **Eltern volljähriger behinderter Kinder:** Übergang wegen Leistungen nach dem 3. und 4. Kapitel nur bis **20 € monatlich** (§ 94 Abs. 2 Satz 1) — relevant für EM-berechtigte junge Erwachsene.
- **Getrennt lebende/geschiedene Ehegatten:** keine 100.000-€-Privilegierung; Ansprüche sind zu verfolgen (DV-Hinweise zu Ziff. 3).

---

## 4. Mitwirkung, Nachforderung, Fristen (§§ 60 ff. SGB I)

| Thema | Regel | Rechtsgrundlage | Bedeutung für die App |
|---|---|---|---|
| Angaben und Beweismittel | alle leistungserheblichen Tatsachen angeben, Änderungen unverzüglich mitteilen, Beweismittel bezeichnen und Urkunden auf Verlangen vorlegen | § 60 Abs. 1 SGB I | Grundlage jeder `anforderung` |
| Vordrucke | vorgesehene Vordrucke sollen benutzt werden | § 60 Abs. 2 SGB I | Antragsformular als eigener Dokumenttyp |
| Grenzen | keine Pflicht bei Unverhältnismäßigkeit, Unzumutbarkeit oder wenn der Träger sich die Kenntnis mit geringerem Aufwand selbst beschaffen kann | § 65 Abs. 1 SGB I | Anforderungen verwerfbar machen (Status `verworfen` mit Begründung), z. B. wenn Datenabgleich möglich |
| Folgen | Versagung/Entziehung bei fehlender Mitwirkung, **nur nach schriftlichem Hinweis und angemessener Frist** | § 66 Abs. 1, 3 SGB I | Nachforderungsschreiben müssen Frist und Rechtsfolgenbelehrung enthalten (Textbaustein); Wiedervorlage über Kern-Fristen |
| Hinwirkungspflicht | Träger wirkt darauf hin, dass unvollständige Angaben ergänzt werden | § 16 Abs. 3 SGB I | fachliche Legitimation der Vollständigkeitsprüfung |
| Auskunft Dritter | Unterhaltspflichtige, Arbeitgeber, Vermieter, Kontoführer sind auskunftspflichtig | § 117 SGB XII | Alternative zur Nachforderung beim Antragsteller (Hinweis) |
| Vorläufige Entscheidung | nicht, wenn Verzögerung vom Antragsteller zu vertreten | § 44a Abs. 2 | offene `anforderung` blockiert Vorläufigkeit |

---

## 5. Vorrang-Hinweise Wohngeld ↔ Grundsicherung

### 5.1 Rechtslage (kurz)

- **Nachrang der Sozialhilfe:** Sozialhilfe erhält nicht, wer die erforderliche Leistung von Trägern anderer Sozialleistungen erhält (§ 2 Abs. 1 SGB XII).
- **Ausschluss vom Wohngeld:** Empfänger:innen von Grundsicherung im Alter und bei Erwerbsminderung sind vom Wohngeld ausgeschlossen (§ 7 Abs. 1 Satz 1 Nr. 5 WoGG).
- **Ausnahme:** Der Ausschluss besteht nicht, wenn durch Wohngeld die Hilfebedürftigkeit i. S. d. § 19 Abs. 1 und 2 SGB XII **vermieden oder beseitigt** werden kann **und** (a) die Grundsicherung während des Verwaltungsverfahrens noch nicht erbracht wurde oder (b) der Träger sie als nachrangig verpflichteter Leistungsträger nach § 104 SGB X erbringt (§ 7 Abs. 1 **Satz 3** Nr. 2 WoGG). Ebenfalls kein Ausschluss bei Leistung ausschließlich als Darlehen (Satz 3 Nr. 1).
- **Verzicht:** Nach § 8 WoGG kann auf Transferleistungen verzichtet werden, um Wohngeld zu beziehen (laut Wohngeld-Katalog Abschnitt 5.2; hier nicht erneut geprüft).
- **Antragsdatum:** Ein bei der unzuständigen Stelle (z. B. Wohngeldstelle) gestellter Antrag gilt als zu dem Zeitpunkt gestellt, zu dem er dort eingegangen ist, und ist unverzüglich weiterzuleiten (§ 16 Abs. 2 SGB I). Da Grundsicherung auf den Monatsersten zurückwirkt (§ 44 Abs. 2), entscheidet das Eingangsdatum bei der ersten Stelle über den Leistungsbeginn.
- **Wohngeld als Einkommen:** Solange Wohngeld bezogen wird, ist es Einkommen im Sinne des § 82 Abs. 1 SGB XII.

### 5.2 Qualitative Regeln (alle `severity: hinweis`, keine Berechnung)

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `vorrang-wohngeldbescheid-liegt-vor` | Laufender Wohngeldbescheid liegt vor → Wohngeld als Einkommen erfassen; bei Bewilligung der Grundsicherung entfällt Wohngeld (Ausschluss § 7 WoGG) → Wohngeldstelle informieren | Dokument `wohngeldbescheid` mit Bewilligungszeitraum, der den Antragsmonat überschneidet | household | hinweis | § 82 Abs. 1 SGB XII; § 7 Abs. 1 Satz 1 Nr. 5 WoGG |
| `vorrang-wohngeld-antrag-parallel` | Wohngeldantrag gestellt, noch nicht beschieden → Vorrangfrage offen; Sachbearbeitung stimmt sich mit Wohngeldstelle ab (ggf. vorläufige Entscheidung) | Antrag nennt laufenden Wohngeldantrag | household | hinweis | § 2 Abs. 1 SGB XII; § 7 Abs. 1 Satz 3 WoGG; § 44a |
| `vorrang-einkommen-deutlich-ueber-bedarf` | Einkommen der Einsatzgemeinschaft liegt **offensichtlich** weit über dem Bedarfsniveau → Grundsicherung unwahrscheinlich, Wohngeld mitprüfen | Summe Nettoeinkommen > konfigurierbarer Faktor × (Regelbedarf nach Stufe + Bruttowarmmiete) — **grobe Schwelle, keine Bedarfsberechnung**; Faktor mit Pilotkommune festlegen | household | hinweis | § 41 Abs. 1; § 2 Abs. 1 SGB XII |
| `vorrang-wohngeld-koennte-beduerftigkeit-beseitigen` | Einkommen knapp unter dem Bedarfsniveau, eigene Rente/Einkünfte vorhanden, Wohnkosten hoch → Wohngeld könnte Hilfebedürftigkeit beseitigen; Wohngeld-Vorprüfung anregen | Einkommen vorhanden und Abstand zum Bedarfsniveau innerhalb eines konfigurierbaren Bands | household | hinweis | § 7 Abs. 1 Satz 3 Nr. 2 WoGG; § 2 Abs. 1 SGB XII |
| `vorrang-vermoegen-ueber-schonbetrag` | Vermögen über Barbetrag, aber unter Wohngeld-Freigrenze → Grundsicherung (vorerst) ausgeschlossen, Wohngeld möglich | Vermögen > 10.000 € je Person, < 60.000 € + 30.000 € je weiteres Haushaltsmitglied | household | hinweis | § 90 Abs. 2 Nr. 9 SGB XII; § 21 Nr. 3 WoGG (Freigrenze laut Wohngeld-Katalog) |
| `vorrang-weiterleitung-antragsdatum` | Antrag ist zuerst bei einer anderen Stelle eingegangen (Wohngeldstelle, Rentenversicherung, andere Gemeinde) → deren Eingangsdatum als Antragsdatum übernehmen und dokumentieren | Dokument trägt fremden Eingangsstempel / Weiterleitungsschreiben / Posteingang-Metadatum „weitergeleitet von" | household | hinweis | § 16 Abs. 2 SGB I; § 44 Abs. 2 SGB XII |
| `vorrang-rentenantrag-offen` | Rentenantrag gestellt, noch nicht beschieden → vorrangige Leistung, ggf. Erstattungsanspruch des Trägers | `rentenantrag-gestellt` | person | hinweis | § 2 Abs. 1 SGB XII; § 104 SGB X (nicht verifiziert) |
| `vorrang-sgb2-statt-sgb12` | Unter Altersgrenze, erwerbsfähig bzw. EM nicht dauerhaft/arbeitsmarktbedingt → Zuständigkeit Jobcenter (SGB II) prüfen; Antrag ggf. weiterleiten | `plausi-em-rente-befristet` oder `plausi-em-rente-teilweise-oder-arbeitsmarkt` | person | hinweis | § 41 Abs. 3; § 16 Abs. 2 SGB I |
| `vorrang-grundsicherungsbescheid-bei-wohngeld` | (Spiegelregel für die Wohngeld-App) Grundsicherungsbescheid liegt im Wohngeldantrag bei → Wohngeld ausgeschlossen, außer Ausnahme § 7 Abs. 1 Satz 3 | Dokument Grundsicherungsbescheid im Wohngeld-Vorgang | household | hinweis | § 7 Abs. 1 Satz 1 Nr. 5, Satz 3 WoGG |
| `vorrang-grundsicherung-mitpruefen` | (Spiegelregel für die Wohngeld-App) Altersgrenze erreicht oder dauerhafte volle EM, geringe Rente als einziges Einkommen, Vermögen unter Barbetrag → Grundsicherung mitprüfen | Merkmale aus Wohngeld-Vorgang | household | hinweis | § 41 SGB XII; § 2 Abs. 1 SGB XII |

> Die beiden Spiegelregeln gehören in den Wohngeld-Katalog; sie stehen hier, damit beide Seiten mit denselben IDs arbeiten.

### 5.3 Grunddaten für eine spätere Vorrang-Einschätzung

Diese Felder braucht die spätere deterministische Einschätzung (Pilot) — siehe Architektur-Konzept, „Grunddaten-Vertrag". Spalte „Wohngeld-Katalog" zeigt, ob der Wohngeld-Katalog/-App das Merkmal bereits erfasst.

| Grunddatum | Inhalt | Grundsicherung-Katalog | Wohngeld-Katalog |
|---|---|---|---|
| **Haushalt** | Personen mit Geburtsdatum, Rolle (Antragsteller, Partner, haushaltsangehörig), Verwandtschaft | ja (Einsatzgemeinschaft + Haushaltsangehörige, 0.3) | ja, aber als **Haushalt** nach § 5 WoGG ohne Einsatzgemeinschafts-Rolle → Rolle muss ergänzt werden |
| **Partnerschaft** | verheiratet / Lebenspartnerschaft / eheähnlich / getrennt lebend | ja | teilweise (Haushaltsmitglieder, keine eheähnliche Einstufung) |
| **Einkommen nach Art** | je Person: gesetzliche Rente (brutto/zahlbetrag, Rentenart), Betriebs-/Privatrente, Erwerb, Kapital, Unterhalt, Wohngeld, sonstige; Frequenz | ja (1.8) | ja (§ 14 WoGG-Arten, Rentenart als Hinweis) — Kategorien angleichen |
| **Abzüge** | KV/PV-Beiträge (eigene Zahlung vs. von Rente einbehalten), Steuern | ja (1.7, 1.8) | ja (§ 16 WoGG-Pauschalen) |
| **Wohnkosten aufgeteilt** | Kaltmiete, kalte Nebenkosten, Heizkosten, Warmwasser (zentral/dezentral), Haushaltsstrom-Anteil, Wohnfläche, Zahl der Bewohner, Eigentum ja/nein | ja (1.3, 1.4) | ja (Bruttokaltmiete, Heizkosten, Warmwasser, Wohnfläche); **Kaltmiete und kalte NK nicht getrennt** → ergänzen |
| **Vermögen** | je Person Positionen mit Art und Betrag, Schonvermögen-Kennzeichen (Riester, Bestattungsvorsorge, Eigenheim, Kfz) | ja (1.9) | ja (Positionen für § 21 Nr. 3), ohne Schonvermögen-Kennzeichen |
| **Alter / Erwerbsminderung** | Geburtsdatum, Altersgrenze erreicht (Datum), EM: voll/teilweise, befristet/unbefristet, arbeitsmarktabhängig | ja (0.1, 1.2) | Geburtsdatum ja; EM nur indirekt über Rentenart → ergänzen |
| **Schwerbehinderung** | GdB, Merkzeichen, Gültigkeit | ja (Merkzeichen G) | ja (GdB für § 17 WoGG), Merkzeichen nicht |
| **Laufende Transferleistungen** | Wohngeld, Grundsicherung, SGB II mit Bewilligungszeitraum | ja | ja (§ 7 WoGG-Ausschlussgründe) |
| **Eingangsdatum / Weiterleitung** | Datum Ersteingang, erste Stelle | ja (Posteingang) | ja (Posteingang, Kern) |

---

## 6. Dokumenttypen für die Dokumenterkennung

Vorschlag für den `DokumentTyp`-Union der Grundsicherungs-App (analog `backend/src/apps/wohngeld/types.ts`) und das DP-Profil `grundsicherung-eingang`. Felder = was die Extraktion für die Regeln aus Abschnitt 1, 2 und 5 liefern muss.

| typ | Dokument | Felder für Plausibilität | genutzt von (Auswahl) |
|---|---|---|---|
| `grundsicherungsantrag` | Antrag (Erst- oder Weiterbewilligung; DV-Muster oder kommunal) | Antragsart, Datum, Unterschriften je Person, Personen mit Rolle/Familienstand/Staatsangehörigkeit/Geburtsdatum, Anspruchsgrund, Wohnsituation, Kaltmiete/NK/Heizkosten, Warmwasser zentral/dezentral, Einkommensarten + Beträge, Vermögensarten + Beträge, KV-Art, Mehrbedarfe, Unterhalt Kinder/Eltern (100.000-€-Frage), Ex-Partner, Vermögensübertragung 10 J., Auslandsaufenthalt, Vorbezug, Betreuung, Bankverbindung | fast alle |
| `personalausweis` | Personalausweis / Reisepass | Name, Geburtsname, Geburtsdatum, Anschrift, Staatsangehörigkeit, Gültigkeit | `identitaet-jede-person`, `plausi-altersgrenze-*`, `plausi-geburtsdatum-abweichung` |
| `aufenthaltstitel` | Aufenthaltstitel / Freizügigkeitsnachweis / Verpflichtungserklärung | Art des Titels, Gültigkeit, Auflagen, Datum Verpflichtungserklärung | `aufenthaltstitel-drittstaat`, `plausi-aufenthalt-ausschluss` |
| `meldebescheinigung` | Meldebescheinigung | Anschrift, Einzugsdatum, weitere gemeldete Personen, Haupt-/Nebenwohnsitz | `meldebescheinigung`, `plausi-partner-fehlt`, `plausi-personenzahl-wohnung` |
| `betreuerausweis` | Betreuerausweis / Bestellungsurkunde / Vollmacht | Betreuer:in, Aufgabenkreise, Gültigkeit | `betreuung-bestellungsurkunde` |
| `rentenbescheid` | Rentenbescheid gesetzliche RV | Rentenart (Alter / volle EM / teilweise EM / Hinterbliebene), befristet bis, arbeitsmarktabhängig, Rentenbeginn, Bruttorente, KV/PV-Beiträge, Zahlbetrag, Grundrentenzuschlag, Bescheiddatum, RV-Nummer | `em-rentenbescheid-unbefristet`, `plausi-em-*`, `plausi-rente-abweichung`, `grundrentenzuschlag-nachweis` |
| `rentenanpassungsmitteilung` | Rentenanpassungsmitteilung | Stichtag (01.07.2026), Zahlbetrag alt/neu, KV/PV neu | `rentenanpassungsmitteilung`, `plausi-rentenanpassung-*` |
| `em_feststellung_rv` | Bescheid/Stellungnahme des RV-Trägers zur Erwerbsminderung (Ersuchen § 45, § 109a SGB VI) | Ergebnis (dauerhaft voll erwerbsgemindert ja/nein), Datum, Träger | `em-feststellung-rv`, `plausi-em-ersuchen-entbehrlich` |
| `wfbm_bescheinigung` | Werkstattbescheinigung / Fachausschuss-Stellungnahme / Mittagessen-Vertrag | Bereich (Eingangsverfahren, Berufsbildung, Arbeitsbereich), Arbeitstage/Woche, Entgelt, Mittagessen | `em-wfbm-nachweis`, `wfbm-mittagessen-vertrag`, `wfbm-entgelt` |
| `betriebsrente_mitteilung` | Leistungsmitteilung Betriebsrente / Zusatzversorgung / Pension / private Rente | Träger, Art (betrieblich/privat/Riester), monatlicher Betrag, Beginn | `betriebsrente-nachweis`, `plausi-betriebsrente-freibetrag-ohne-nachweis` |
| `kontoauszug` | Kontoauszug (Giro, Spar, Tagesgeld, Online) | Kontoinhaber, IBAN, Zeitraum, Anfangs-/Endsaldo, wiederkehrende Eingänge (Rente, Betriebsrente, Unterhalt, Wohngeld), Mietzahlung, Energie-/Heizkostenabschlag, KV-Beitrag, große Abgänge/Barabhebungen, Auslandsumsätze, Überweisungen an eigene Konten | `kontoauszuege`, `plausi-kontoauszug-unerklaerte-eingaenge`, `plausi-miete-nicht-gezahlt`, `plausi-kontostand-abweichung`, `plausi-grosse-abgaenge` |
| `mietvertrag` | Mietvertrag / Untermietvertrag | Mieter, Vermieter, Beginn, Wohnfläche, Grundmiete, Nebenkosten-Vorauszahlung, Heizkosten-Vorauszahlung, Pauschalen (Strom, Möblierung), Unterschriften | `mietvertrag`, `plausi-miete-abweichung`, `plausi-mietvertrag-*` |
| `vermieterbescheinigung` | Mietbescheinigung / Mieterhöhung | aktuelle Grundmiete, kalte NK, Heizkosten, gültig ab, Bewohnerzahl | `mietbescheinigung-aktuell` |
| `nebenkostenabrechnung` | Betriebs-/Heizkostenabrechnung des Vermieters | Abrechnungszeitraum, Umlage-Personenzahl, Heizkostenanteil, Nachzahlung/Guthaben, neue Vorauszahlung | `nebenkostenabrechnung`, `plausi-nk-nachzahlung-guthaben`, `plausi-personenzahl-wohnung` |
| `energieabrechnung` | Gas-/Fernwärme-/Heizöl-/Stromabrechnung, Abschlagsplan | Energieart, Jahresbetrag, Abschlag, Warmwasser dezentral (Strom) | `heizkosten-nachweis`, `plausi-heizkosten-ueber-richtwert` |
| `eigentum_nachweis` | Grundbuchauszug, Kaufvertrag, Darlehensvertrag/-kontoauszug, Grundsteuerbescheid | Eigentümer, Fläche, Wert, Zinsen/Tilgung, Grundsteuer | `eigentum-*` |
| `vermoegensnachweis` | Sparbuch, Depotauszug, Bausparvertrag, Rückkaufswert-Bescheinigung, Riester-Bescheinigung | Art, Inhaber, Stand, Stichtag, Rückkaufswert, Förderung | `vermoegenserklaerung`, `plausi-vermoegen-ueber-schonbetrag` |
| `bestattungsvorsorge` | Bestattungsvorsorge-/Treuhandvertrag, Sterbegeldversicherung | Betrag, Leistungsverzeichnis, Abschlussdatum, Treuhänder | `bestattungsvorsorge-vertrag`, `plausi-bestattungsvorsorge-hoehe` |
| `kfz_nachweis` | Fahrzeugschein / Zulassungsbescheinigung | Halter, Modell, Erstzulassung | `kfz-nachweis`, `plausi-kfz-wert` |
| `schenkungsvertrag` | Schenkungs-/Übergabe-/Überlassungsvertrag, Löschungsbewilligung | Datum, Gegenstand, Wert, Empfänger, vorbehaltene Rechte | `vermoegensuebertragung-10j`, `plausi-beduerftigkeit-herbeigefuehrt` |
| `kv_pv_nachweis` | Mitgliedsbescheinigung, Beitragsbescheid, PKV-Versicherungsschein | Kasse, Versicherungsart, Beitrag, Zusatzbeitrag, Tarif (Basistarif) | `kv-pv-nachweis`, `plausi-kv-*`, `plausi-pkv-kein-basistarif` |
| `schwerbehindertenausweis` | Schwerbehindertenausweis / Feststellungsbescheid | GdB, Merkzeichen (G, aG, …), gültig bis, Bescheiddatum | `schwerbehindertenausweis-g`, `plausi-merkzeichen-*`, `plausi-ausweis-abgelaufen` |
| `aerztliche_bescheinigung` | Ärztliche Bescheinigung (Ernährung, Befunde für EM-Ersuchen) | Diagnose, empfohlene Kostform, Datum, Arzt | `ernaehrung-aerztliche-bescheinigung`, `em-ersuchen-vorbereiten` |
| `wohngeldbescheid` | Wohngeld-/Lastenzuschussbescheid | Betrag, Bewilligungszeitraum, Haushaltsmitglieder, Bescheiddatum | `wohngeldbescheid`, `vorrang-wohngeldbescheid-liegt-vor`, `plausi-wohngeld-als-einkommen` |
| `transferleistungsbescheid` | Bescheid SGB II / SGB III / Krankengeld / BVG / LAG | Leistung, Betrag, Zeitraum, Einstellung | `sgb2-bescheid`, `plausi-sgb2-uebergang` |
| `unterhaltsnachweis` | Unterhaltstitel, Scheidungsurteil, Vereinbarung, Verzicht | Verpflichtete:r, Betrag, Titel ja/nein | `unterhalt-ex-partner`, `unterhaltstitel` |
| `gehaltsabrechnung` | Lohn-/Gehaltsabrechnung, Arbeitsvertrag | Brutto, Netto, Monat, Arbeitgeber | `erwerbseinkommen-nachweis` |
| `grundsicherungsbescheid` | (für die Wohngeld-App und Weiterbewilligung) Bescheid Grundsicherung | Bewilligungszeitraum, Leistungsberechtigte | Spiegelregel `vorrang-grundsicherungsbescheid-bei-wohngeld` |
| `sonstiges` | nicht klassifizierbar | — | manuelle Zuordnung |

---

## 7. Wesentliche Unterschiede zum Wohngeld-Katalog

| Dimension | Wohngeld | Grundsicherung |
|---|---|---|
| Prüflogik | Einkommen gegen Tabellenwerte (§ 19 WoGG), Bedarf spielt keine Rolle | **Bedarfsprüfung**: Bedarf (Regelsatz, Mehrbedarfe, KdU, KV) gegen Einkommen/Vermögen |
| Personenkreis | Haushalt (§ 5 WoGG) | Einsatzgemeinschaft (Paar); Haushaltsangehörige nur für KdU-Aufteilung |
| Anspruchsgrund | Wohnkostenbelastung | Alter (Altersgrenze) **oder** dauerhafte volle EM mit RV-Feststellung (§ 45) |
| Vermögen | Freigrenze 60.000 € + 30.000 € (§ 21 Nr. 3) | Barbetrag 10.000 € je Erwachsene:n + Schonvermögen-Katalog § 90 Abs. 2, Härte § 90 Abs. 3 |
| Einkommen | Jahreseinkommen-Prognose, Pauschalabzüge § 16 WoGG | monatliches Zuflussprinzip (§ 82 Abs. 7), konkrete Absetzungen, Freibeträge § 82 Abs. 3–6, § 82a |
| Wohnkosten | Bruttokaltmiete, Heizung außer Betracht | Kaltmiete **und** Heizung als Bedarf; Angemessenheit nach kommunalen Richtwerten; Karenzzeit 1 Jahr (nur Unterkunft) |
| Neue Themen | — | Unterhaltsrückgriff § 94 Abs. 1a, Ausschluss § 41 Abs. 4, Vermögensübertragungen/§ 528 BGB, Auslandsaufenthalt § 41a, Mehrbedarfe, KV/PV-Bedarf, besondere Wohnformen |
| Leistungsbeginn | ab Antragsmonat (§ 22 WoGG laut Wohngeld-Katalog) | Rückwirkung auf den Monatsersten, wenn Voraussetzungen im Antragsmonat erfüllt (§ 44 Abs. 2) |

---

## 8. Offene Fachfragen für die Pilotkommune

1. **KdU-Richtwerte und Heizkosten-Vergleichswerte:** Welches schlüssige Konzept / welche Richtwerttabelle gilt (Bruttokaltmiete je Personenzahl, ggf. Wohnflächen), Stand? Soll die App die Karenzzeit (§ 35 Abs. 1) selbst mitführen oder aus dem Fachverfahren übernehmen?
2. **Antragsformular:** Wird das DV-Muster (Stand 27.04.2023, spricht noch von „Bürgergeld") oder ein eigenes Formular verwendet? Davon hängen Extraktionsschema und Feldnamen ab. Gibt es ein eigenes Weiterbewilligungsformular?
3. **Nachweiszeiträume:** Wie viele Monate Kontoauszüge (3, 6, 12?) und Einkommensnachweise (DV-Muster: 12 Monate) werden verlangt, für welche Konten, und wie wird mit Schwärzungen umgegangen?
4. **Barbetrag/Notlage:** Gibt es interne Richtlinien zur Erhöhung des Barbetrags bei besonderer Notlage (§ 2 Abs. 1 der VO)?
5. **Bestattungsvorsorge und Kfz:** Kommunaler Orientierungswert für angemessene Bestattungsvorsorge und angemessenes Kfz?
6. **Ernährungsmehrbedarf:** Werden die Empfehlungen des Deutschen Vereins angewandt, und welche Bescheinigung (Vordruck) wird verlangt?
7. **Ersuchen § 45:** Wer bereitet das Ersuchen vor, welche Unterlagen gehören ins Paket, und soll die App den Stand des Ersuchens (gestellt/Ergebnis) führen?
8. **Unterhalt 100.000 €:** Welche Anhaltspunkte lösen in der Praxis eine Nachfrage aus (Berufsangaben)? Werden Ex-Ehegatten stets angeschrieben?
9. **Einrichtungen / besondere Wohnformen:** Im Pilot ausklammern oder mitprüfen (Zuständigkeit § 46b, Durchschnittswarmmiete § 45a)?
10. **Organisation Wohngeld/Grundsicherung:** Gleiche Behörde oder getrennte Stellen? Wie läuft heute die Weiterleitung (§ 16 Abs. 2 SGB I) und wird das Ersteingangsdatum dokumentiert? Datenübermittlung zwischen den Stellen (§ 69 SGB X laut Architektur-Konzept) im VVT abgebildet?
11. **Vorrang-Schwellen:** Welche Faktoren/Bänder für `vorrang-einkommen-deutlich-ueber-bedarf` und `vorrang-wohngeld-koennte-beduerftigkeit-beseitigen` hält die Sachbearbeitung für nützlich, ohne dass daraus eine Scheinberechnung wird?
12. **Datenabgleich / Kontenabruf:** Welche Nachweise ersetzt die Kommune durch eigene Abrufe (Kontenabruf § 93 Abs. 8 AO laut DV-Formular, Datenabgleich § 118 SGB XII)? Diese Anforderungen sollten dann auf `hinweis` herabgestuft werden (§ 65 Abs. 1 Nr. 3 SGB I).
13. **Fachverfahren:** Welches Fachverfahren wird genutzt, und welche Felder (Aktenzeichen, Regelbedarfsstufe, Karenzzeit-Beginn) können übernommen werden?
14. **SGB-II-Begriff:** Seit wann heißt die SGB-II-Leistung im Kommunaljargon/Formular „Grundsicherungsgeld" (in § 44 Abs. 3 SGB XII und § 7 WoGG bereits so)? Relevant für Dokumenterkennung alter und neuer Bescheide.

---

## 9. Nicht verifiziert / Grenzen dieser Recherche

- § 23 Abs. 1 SGB XII: genaue Einbeziehung des 4. Kapitels für Ausländer:innen.
- § 37a SGB XII (Darlehen bei Zufluss am Monatsende): Inhalt nur aus DV-Hinweisen.
- § 93 SGB XII (Überleitung von Ansprüchen, z. B. Schenkungsrückforderung), § 36 SGB XII (Schuldenübernahme), § 104 SGB X, § 68 AufenthG, § 13 SGB X, § 264 SGB V: nicht an der Norm geprüft.
- Herkunft der Verschiebung der 100.000-€-Regel aus § 43 in § 94 Abs. 1a (Angehörigen-Entlastungsgesetz, 01.01.2020) und die Aussage, dass es keinen Leistungsausschluss mehr gibt: Ableitung aus dem aktuellen Wortlaut, nicht an Kommentar/Gesetzesmaterialien geprüft.
- BSG 18.03.2008, B 8/9b SO 9/06 R (Bestattungsvorsorge): nur Sekundärquellen.
- Behandlung von Nebenkosten-Nachzahlungen/-Guthaben im SGB XII (Bedarf im Fälligkeitsmonat / Anrechnung): nicht an einer Norm geprüft.
- Einordnung der Rürup-Rente (Basisrente) beim Schonvermögen § 90 Abs. 2 Nr. 2.
- Regelbedarfsstufe 2: Definition nur sinngemäß wiedergegeben.
- § 30 Abs. 1 nennt nur Merkzeichen **G**; das DV-Formular fragt „G oder aG". Ob „aG" in der Praxis G einschließt, wurde nicht geprüft.
- § 30 Abs. 7 (Prozentsätze dezentrales Warmwasser): nur zusammengefasst geladen; Beträge bewusst nicht übernommen.
- Schwelle „EU-Einreise < 5 Jahre" in `freizuegigkeit-eu`: Platzhalter, fachlich nicht belegt.

---

## 10. Quellen

**Primärquellen (Gesetz/Verordnung, gesetze-im-internet.de, abgerufen 2026-09-27):**
- SGB XII, Gesamtübersicht: https://www.gesetze-im-internet.de/sgb_12/BJNR302300003.html · Inhaltsverzeichnis: https://www.gesetze-im-internet.de/sgb_12/index.html
- § 2 SGB XII (Nachrang): https://www.gesetze-im-internet.de/sgb_12/__2.html
- § 19 SGB XII (Leistungsberechtigte, Vorrang 4. vor 3. Kapitel): https://www.gesetze-im-internet.de/sgb_12/__19.html
- § 20 SGB XII (eheähnliche Gemeinschaft): https://www.gesetze-im-internet.de/sgb_12/__20.html
- § 23 SGB XII (Ausländer): https://www.gesetze-im-internet.de/sgb_12/__23.html
- § 27 SGB XII (Einsatzgemeinschaft): https://www.gesetze-im-internet.de/sgb_12/__27.html
- § 27a SGB XII (Regelbedarf, abweichende Festsetzung): https://www.gesetze-im-internet.de/sgb_12/__27a.html
- Anlage zu § 28 SGB XII (Regelbedarfsstufen, Beträge bis 1.1.2026): https://www.gesetze-im-internet.de/sgb_12/anlage.html
- § 30 SGB XII (Mehrbedarf): https://www.gesetze-im-internet.de/sgb_12/__30.html
- § 32 SGB XII (Kranken-/Pflegeversicherung): https://www.gesetze-im-internet.de/sgb_12/__32.html
- § 35 SGB XII (Unterkunft und Heizung, Karenzzeit): https://www.gesetze-im-internet.de/sgb_12/__35.html
- § 35a SGB XII (Instandhaltung, Umzug/Zusicherung, Direktzahlung): https://www.gesetze-im-internet.de/sgb_12/__35a.html
- § 41 SGB XII (Leistungsberechtigte, Altersgrenze, EM, Ausschluss Abs. 4): https://www.gesetze-im-internet.de/sgb_12/__41.html
- § 41a SGB XII (Auslandsaufenthalt): https://www.gesetze-im-internet.de/sgb_12/__41a.html
- § 42 SGB XII (Bedarfe): https://www.gesetze-im-internet.de/sgb_12/__42.html
- § 42a SGB XII (Unterkunft und Heizung im 4. Kapitel): https://www.gesetze-im-internet.de/sgb_12/__42a.html
- § 42b SGB XII (Mehrbedarfe): https://www.gesetze-im-internet.de/sgb_12/__42b.html
- § 43 SGB XII (Einsatz von Einkommen und Vermögen): https://www.gesetze-im-internet.de/sgb_12/__43.html
- § 43a SGB XII (Gesamtbedarf, Zahlungsanspruch, Direktzahlung): https://www.gesetze-im-internet.de/sgb_12/__43a.html
- § 44 SGB XII (Antrag, Bewilligungszeitraum): https://www.gesetze-im-internet.de/sgb_12/__44.html
- § 44a SGB XII (vorläufige Entscheidung): https://www.gesetze-im-internet.de/sgb_12/__44a.html
- § 45 SGB XII (Feststellung der dauerhaften vollen Erwerbsminderung): https://www.gesetze-im-internet.de/sgb_12/__45.html
- § 46b SGB XII (Zuständigkeit): https://www.gesetze-im-internet.de/sgb_12/__46b.html
- § 82 SGB XII (Einkommensbegriff, Absetzungen, Freibeträge): https://www.gesetze-im-internet.de/sgb_12/__82.html
- § 82a SGB XII (Freibetrag Grundrentenzeiten): https://www.gesetze-im-internet.de/sgb_12/__82a.html
- § 84 SGB XII (Zuwendungen): https://www.gesetze-im-internet.de/sgb_12/__84.html
- § 90 SGB XII (Vermögen): https://www.gesetze-im-internet.de/sgb_12/__90.html
- § 94 SGB XII (Unterhaltsübergang, 100.000-€-Grenze Abs. 1a): https://www.gesetze-im-internet.de/sgb_12/__94.html
- § 117 SGB XII (Auskunftspflicht): https://www.gesetze-im-internet.de/sgb_12/__117.html
- Verordnung zur Durchführung des § 90 Abs. 2 Nr. 9 SGB XII (Barbeträge): https://www.gesetze-im-internet.de/bshg_88abs2dv_1988/BJNR001500988.html
- § 16 SGB I (Antragstellung, Weiterleitung): https://www.gesetze-im-internet.de/sgb_1/__16.html
- § 60 SGB I (Angabe von Tatsachen): https://www.gesetze-im-internet.de/sgb_1/__60.html
- § 65 SGB I (Grenzen der Mitwirkung): https://www.gesetze-im-internet.de/sgb_1/__65.html
- § 66 SGB I (Folgen fehlender Mitwirkung): https://www.gesetze-im-internet.de/sgb_1/__66.html
- § 7 WoGG (Ausschluss vom Wohngeld): https://www.gesetze-im-internet.de/wogg/__7.html
- § 528 BGB (Rückforderung wegen Verarmung des Schenkers): https://www.gesetze-im-internet.de/bgb/__528.html (§ 529 Abs. 1 BGB nur über Suchergebnis-Auszug)

**Weitere Normtexte (Sekundär-Hosting, Wortlaut geladen):**
- § 43 SGB VI (Rente wegen Erwerbsminderung): https://dejure.org/gesetze/SGB_VI/43.html
- § 102 SGB VI (Befristung): https://dejure.org/gesetze/SGB_VI/102.html

**Behörden / Träger / Formulare:**
- Deutsche Rentenversicherung — Bundesrat billigt Rentenanpassung 2026 (4,24 %, Rentenwert 42,52 €, Versand Anpassungsmitteilungen): https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260612-rentenanpassung-2026-bundesrat.html
- Deutscher Verein — Antragsformulare Grundsicherung: https://www.deutscher-verein.de/themen-des-deutschen-vereins/themenunterseite/grundsicherung-im-alter-und-bei-erwerbsminderung/
- Deutscher Verein — Musterantrag Erstantrag (Stand 27.04.2023, inkl. Hinweise): https://www.deutscher-verein.de/fileadmin/user_upload/dv/pdfs/Antraege/antragsformular_iv_kapitel_sgb_xii.pdf
- Deutscher Verein — Musterantrag Weitergewährung: https://www.deutscher-verein.de/fileadmin/user_upload/dv/pdfs/Antraege/wba_sgb_xii_grundsicherung.pdf (nur verlinkt, Inhalt nicht ausgewertet)
- Service Berlin — Grundsicherung beantragen (Unterlagenliste): https://service.berlin.de/dienstleistung/324394/

**Sekundär (nur für ausdrücklich als nicht verifiziert markierte Aussagen):**
- Bestattungsvorsorge als Schonvermögen (BSG B 8/9b SO 9/06): https://rechtsanwalt-und-sozialrecht.de/bestattungsvorsorge-schonvermoegen/ · https://bestatterdeutschland.de/fileadmin/Resources_rti/Public/Bestatter_Deutschland/Downloads/Urteile/Grundsatzurteil-Bestattungsvorsorge-BSG.pdf
- Haufe, Jung, SGB XII § 43 (alte Kommentierung „Abs. 5 Satz 3"): https://haufe.de/oeffentlicher-dienst/tvoed-office-professional/jung-sgb-xii-43-einsatz-von-einkommen-und-vermoegen-b-27-leistungsausschuss-bei-widerlegter-vermutung-abs5-satz3_idesk_PI13994_HI10890221.html

---

**Regel-Übersicht (Stand dieses Katalogs):** Vollständigkeit 75 Regeln (1.1: 10 · 1.2: 7 · 1.3: 12 · 1.4: 6 · 1.5: 2 · 1.6: 8 · 1.7: 5 · 1.8: 22 · 1.9: 10 · 1.10: 3) · Plausibilität 62 Regeln (2.1: 11 · 2.2: 6 · 2.3: 12 · 2.4: 12 · 2.5: 10 · 2.6: 8 · 2.7: 5) · Vorrang-Hinweise 10 Regeln (davon 2 Spiegelregeln für die Wohngeld-App) · 29 Dokumenttypen.

*Hinweis: Beträge und Grenzen entsprechen dem Rechtsstand vom 2026-09-27. Kommunale Richtwerte (KdU, Heizkosten, Bestattungsvorsorge, Kfz) und Nachweiszeiträume sind Verwaltungspraxis und müssen je Kommune konfiguriert werden. Die App trifft keine Leistungsentscheidung; alle `hinweis`-Regeln sind Vorschläge für die Sachbearbeitung.*
