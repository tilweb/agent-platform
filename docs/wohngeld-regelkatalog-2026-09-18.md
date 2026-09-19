# Wohngeld — Fachlicher Regel-Katalog für Vollständigkeits- und Plausibilitätsprüfung

**Stand:** 2026-09-18 · **Rechtsstand:** Wohngeldgesetz (WoGG) i.d.F. nach Wohngeld-Plus-Reform (Wohngeld-Plus-Gesetz zum 01.01.2023) und Fortschreibung 2024/2025
**Zweck:** Sachbearbeiter-Assistenz für die **Vollständigkeitsprüfung** (welche Nachweise fehlen?) und die **Plausibilitätsprüfung** (welche Angaben widersprechen den Nachweisen?) von Wohngeldanträgen bei kommunalen Wohngeldbehörden.
**Ausdrücklich NICHT im Scope:** die Berechnung der Wohngeldhöhe (§ 19 WoGG / Anlagen 1–3). Enthalten ist nur die **Aggregationslogik des Einkommens** (welche Positionen addiert/abgezogen werden), soweit sie für die Plausibilitätsprüfung von Einkommensangaben nötig ist.

> **Hinweis zur Implementierung:** Alle Regel-Listen sind so strukturiert, dass sie direkt in TypeScript-Regelobjekte überführt werden können. Konventionen:
> - `id`: kebab-case, stabil, eindeutig.
> - `trigger`: die Auslöse-Bedingung (Fallkonstellation / Personenmerkmal). In Prosa formuliert, aber als Boolesche Bedingung interpretierbar.
> - `scope`: `person` (betrifft eine konkrete Person) vs. `household` (haushaltsbezogen, einmal pro Antrag).
> - `severity`: `anforderung` (blockierend — Nachweis/Angabe muss vorliegen) vs. `hinweis` (nicht blockierend — Sachbearbeiter prüft manuell).
> - `legal`: Rechtsgrundlage (§ WoGG/WoGV) soweit einschlägig; Nachweispflichten selbst folgen aus der allgemeinen Mitwirkungspflicht §§ 60 ff. SGB I i.V.m. § 23 WoGG.

---

## 0. Grundbegriffe und Antragsarten

### 0.1 Wohngeldarten (§ 3 WoGG)

| Art | Empfänger | Rechtsgrundlage | Kern-Nachweis |
|-----|-----------|-----------------|---------------|
| **Mietzuschuss** | Mieter / Untermieter, die Wohnraum selbst nutzen | § 3 Abs. 1 WoGG | Mietvertrag + Vermieterbescheinigung |
| **Lastenzuschuss** | Eigentümer von selbstgenutztem Eigenheim / Eigentumswohnung; auch Erbbauberechtigte, bestimmte dingliche Wohnberechtigte | § 3 Abs. 2, 3 WoGG | Grundbuch/Eigentumsnachweis + Belastungsnachweise (Zins/Tilgung, Grundsteuer) |

Zentraler Anspruchsträger ist die **wohngeldberechtigte Person**; der Wohnraum muss der **Mittelpunkt der Lebensbeziehungen** sein (§ 5 Abs. 1 WoGG).

### 0.2 Antragsarten

| Antragsart | Beschreibung | Nachweisrelevanz |
|-----------|--------------|------------------|
| **Erstantrag** | Erstmalige Bewilligung / nach Unterbrechung | Volle Nachweislage aller Fallmerkmale erforderlich |
| **Weiterleistungsantrag** (Folgeantrag) | Anschlussbewilligung nach Ablauf des Bewilligungszeitraums | Grundsätzlich alle Nachweise erneut (aktuelle Werte); ggf. reduzierte Anforderung, wenn Verhältnisse unverändert und behördlich vermerkt |
| **Erhöhungs-/Änderungsantrag** | Während des Bewilligungszeitraums bei relevanter Änderung (z. B. Mieterhöhung, Einkommensminderung, Haushaltszuwachs) | Nachweis nur zur geänderten Tatsache; Bezug auf laufenden Bescheid |

Der **Bewilligungszeitraum** beträgt in der Regel 12 Monate (§ 25 WoGG). Wohngeld wird nur **auf Antrag** und grundsätzlich ab Antragsmonat gewährt (§ 22 WoGG). Alle einkommensbezogenen Nachweise beziehen sich auf das **zu erwartende Einkommen im Bewilligungszeitraum** bzw. die letzten 12 Monate als Prognosebasis (§ 24 WoGG i.V.m. §§ 14, 15 WoGG).

---

## 1. Erforderliche Nachweise je Fallkonstellation (Vollständigkeitsprüfung)

Regel-Liste. Jede Regel: `id`, Titel, `trigger` (Auslöse-Bedingung), `scope`, `severity`, `legal`.

### 1.1 Haushalts- und Identitätsnachweise (immer)

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `antrag-vollstaendig-unterschrieben` | Vollständig ausgefüllter, datierter und unterschriebener Antrag | immer | household | anforderung | § 22 WoGG; §§ 60 SGB I |
| `identitaet-jede-person` | Identitätsnachweis (Personalausweis/Reisepass, Kopie) für jedes Haushaltsmitglied | für jede Person im Haushalt | person | anforderung | § 5 WoGG; § 23 WoGG |
| `aufenthaltstitel-drittstaat` | Nachweis des Aufenthaltstitels/Aufenthaltsrechts | Person ist Drittstaatsangehörige/r (Nicht-EU/EWR) | person | anforderung | § 3 Abs. 5 WoGG |
| `aufenthaltsrecht-eu` | Kopie des Ausweisdokuments als Nachweis des Aufenthaltsrechts | Person ist EU-/EWR-Bürger/in | person | anforderung | § 3 Abs. 5 WoGG |
| `anlage-haushaltsmitglieder` | Anlage „Weitere Haushaltsmitglieder" | Haushalt hat mehr als die im Hauptformular vorgesehenen Personen (i. d. R. > 3) | household | anforderung | § 5 WoGG |
| `meldebestaetigung` | Melde-/Wohnsitznachweis (Mittelpunkt der Lebensbeziehungen) | bei Zweifeln am Lebensmittelpunkt / mehreren Wohnungen | person | hinweis | § 5 Abs. 1 WoGG |

### 1.2 Wohnraum- / Mietnachweise (Mietzuschuss)

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `mietvertrag` | Aktueller Mietvertrag | Wohngeldart = Mietzuschuss | household | anforderung | § 3 Abs. 1 WoGG |
| `vermieterbescheinigung` | Vermieterbescheinigung / „Angaben des Vermieters zum Wohnraum" (Miethöhe, Wohnfläche, Bezugsdatum) | Wohngeldart = Mietzuschuss | household | anforderung | §§ 9, 11 WoGG |
| `mietzahlungsnachweis` | Nachweis der aktuellen Mietzahlung (Kontoauszug letzte Mietzahlung / letzte 3 Monate) | Wohngeldart = Mietzuschuss | household | anforderung | § 9 WoGG |
| `mietaenderung` | Letzte Mietänderungsmitteilung / aktuelle Mietbescheinigung | Miethöhe hat sich geändert oder Vertrag älter | household | hinweis | § 9 WoGG |
| `nebenkostenabrechnung` | Nebenkosten-/Betriebskostenaufstellung (zur Abgrenzung nicht zuschussfähiger Kosten, z. B. Heizung/Warmwasser) | immer bei Mietzuschuss | household | anforderung | § 9 WoGG; § 6 WoGV (außer Betracht bleibende Kosten) |
| `untermietvertrag` | Untermietvertrag + Nachweis der Untermietzahlung | Person wohnt zur Untermiete | household | anforderung | § 3 Abs. 1 WoGG |

### 1.3 Wohnraum- / Belastungsnachweise (Lastenzuschuss)

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `eigentumsnachweis` | Grundbuchauszug / Kaufvertrag / Eigentumsnachweis | Wohngeldart = Lastenzuschuss | household | anforderung | § 3 Abs. 2 WoGG |
| `kreditvertrag-fremdmittel` | Kreditverträge + Fremdmittelbescheinigung des Kreditgebers | Lastenzuschuss mit Finanzierung | household | anforderung | § 10 WoGG; § 11 WoGV |
| `jahreskontoauszug-darlehen` | Jahreskontoauszug des Darlehensgebers (Zins-/Tilgungsanteile) | Lastenzuschuss mit laufendem Darlehen | household | anforderung | § 10 WoGG |
| `belastungsermittlung` | Belastungsermittlung (Schuldzinsen, Tilgung, Grundsteuer, Erbbauzins, Instandhaltung/Bewirtschaftung nach WoGV) | Wohngeldart = Lastenzuschuss | household | anforderung | § 10 WoGG; §§ 11–13 WoGV |
| `grundsteuerbescheid` | Grundsteuerbescheid | Wohngeldart = Lastenzuschuss | household | anforderung | § 10 WoGG |
| `wohnflaechennachweis-eigentum` | Wohnflächenberechnung / Bauunterlagen | Wohngeldart = Lastenzuschuss | household | hinweis | § 10 WoGG |

### 1.4 Einkommensnachweise nach Erwerbs-/Einkommensstatus

Auslösendes Merkmal ist der **Einkommens-/Erwerbsstatus je Person**. Alle Nachweise sind personenbezogen und für jedes Haushaltsmitglied mit dem jeweiligen Status erforderlich.

| id | Titel | trigger (Status) | scope | severity | legal |
|----|-------|------------------|-------|----------|-------|
| `verdienstbescheinigung` | Verdienstbescheinigung des Arbeitgebers (Brutto, Sonderzahlungen) — Vordruck der Wohngeldstelle | Status = abhängig beschäftigt | person | anforderung | § 14 WoGG; § 15 WoGG |
| `gehaltsabrechnungen-12m` | Lohn-/Gehaltsabrechnungen der letzten 12 Monate | Status = abhängig beschäftigt | person | anforderung | § 15 WoGG |
| `arbeitsvertrag` | Arbeitsvertrag | Beschäftigung < 12 Monate / neu aufgenommen | person | anforderung | § 15 WoGG |
| `rentenbescheid` | Aktueller Rentenbescheid / Rentenanpassungsmitteilung | Status = Rente/Pension (gesetzl. Rente, Betriebsrente, Pension, Erwerbsminderungsrente) | person | anforderung | § 14 Abs. 2 WoGG |
| `rentenart-nachweis` | Nachweis der Rentenart (Alters-, Erwerbsminderungs-, Hinterbliebenenrente; Grundrentenzeiten) | Status = Rente | person | hinweis | § 14 Abs. 2 WoGG; § 17 WoGG (Freibeträge) |
| `selbststaendig-einkommen` | Einkommensteuerbescheid / BWA / Gewinnermittlung / Steuererklärung | Status = selbständig / gewerblich / freiberuflich | person | anforderung | § 14 Abs. 1 WoGG (§ 2 EStG) |
| `selbststaendig-prognose` | Voraussichtliche Einkommensprognose (Steuerberater / eigene) | Selbständig, kein aussagekräftiger Vorjahresbescheid | person | hinweis | § 24 WoGG |
| `alg1-bescheid` | Bescheid Arbeitslosengeld I (SGB III) | Status = Arbeitslosengeld I / Lohnersatzleistung | person | anforderung | § 14 Abs. 2 Nr. 6 WoGG |
| `krankengeld-nachweis` | Nachweis Krankengeld / Krankentagegeld | Bezug Krankengeld (§ 14 Abs. 2 Nr. 6/9) | person | anforderung | § 14 Abs. 2 WoGG |
| `elterngeld-nachweis` | Elterngeldbescheid | Bezug Elterngeld/Mutterschaftsgeld | person | anforderung | § 14 Abs. 2 WoGG |
| `kapitalertraege-nachweis` | Nachweise über Kapitalerträge (Zinsen, Dividenden), Erträgnisaufstellung/Steuerbescheinigung | Kapitalvermögen/Kapitalerträge vorhanden | person | anforderung | § 14 Abs. 1 WoGG; § 14 Abs. 2 Nr. 15 (Sparer-Pauschbetrag) |
| `mieteinnahmen-nachweis` | Nachweise über Einnahmen aus Vermietung/Verpachtung | Einkünfte aus V+V vorhanden | person | anforderung | § 14 Abs. 1 WoGG (§ 2 EStG) |
| `keine-einkuenfte-erklaerung` | Erklärung/Nachweis über Lebensunterhalt bei fehlendem Einkommen | Person gibt kein Einkommen an | person | anforderung | § 23 WoGG (Mitwirkung) |

### 1.5 Familien-/Transfer-/Unterhaltsbezogene Nachweise

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `kindergeld-nachweis` | Kindergeldbescheid / Nachweis Kindergeldbezug | Kind im Haushalt / Kindergeldbezug | person | anforderung | § 5 WoGG; § 14/§ 17 WoGG |
| `unterhalt-erhalten` | Nachweis erhaltener Unterhaltsleistungen (Titel, Vereinbarung, Zahlungen) | Person erhält Unterhalt / Unterhaltsvorschuss | person | anforderung | § 14 Abs. 2 Nr. 19–22 WoGG |
| `unterhalt-gezahlt` | Nachweis gezahlten Unterhalts (Titel, notarielle Vereinbarung, Bescheid, Zahlungsbelege) | Person zahlt gesetzl. Unterhalt an Person außerhalb des Haushalts | person | anforderung | § 18 WoGG |
| `unterhaltsvorschuss-bescheid` | Bescheid Unterhaltsvorschuss (UVG) | Bezug Unterhaltsvorschuss | person | anforderung | § 14 Abs. 2 Nr. 21 WoGG |
| `bafoeg-nachweis` | BAföG-/Ausbildungsförderungsbescheid | Person in geförderter Ausbildung/Studium | person | anforderung | § 14 Abs. 2 Nr. 24–29 WoGG; § 20 WoGG |
| `ausbildungsnachweis` | Ausbildungs-/Immatrikulationsbescheinigung | Haushaltsmitglied in Ausbildung/Studium (auch für § 18 Abs. 1 Nr. 1) | person | anforderung | § 20 WoGG; § 18 WoGG |
| `transferleistung-bescheid` | Bescheid über Transferleistung (Bürgergeld, Grundsicherung, Sozialhilfe, AsylbLG etc.) | Haushaltsmitglied bezieht Transferleistung nach § 7 WoGG | person | anforderung | § 7 WoGG (siehe Abschnitt 5) |

### 1.6 Vermögen, Behinderung/Pflege, Versicherung

| id | Titel | trigger | scope | severity | legal |
|----|-------|---------|-------|----------|-------|
| `vermoegenserklaerung` | Erklärung/Fragebogen zu Vermögensverhältnissen (Konten, Sparbücher, Wertpapiere, Immobilien, Fahrzeuge, Bargeld, Lebensversicherungen) | immer (für jedes Haushaltsmitglied) | person | anforderung | § 21 Nr. 3 WoGG; § 23 WoGG |
| `vermoegensnachweise` | Belege zum Vermögen (Kontoauszüge, Depotauszüge, Versicherungswerte) | Vermögen vorhanden bzw. Nähe zur Freigrenze | person | anforderung | § 21 Nr. 3 WoGG |
| `kontoauszuege` | Aktuelle Kontoauszüge (i. d. R. letzte 3 Monate) | zur Plausibilisierung Einkommen/Miete/Vermögen | person | anforderung | § 23 WoGG |
| `schwerbehinderung-nachweis` | Schwerbehindertenausweis / Feststellungsbescheid (GdB) | Haushaltsmitglied ist schwerbehindert | person | anforderung | § 17 Nr. 1 WoGG (Freibetrag) |
| `pflegegrad-nachweis` | Nachweis Pflegebedürftigkeit / Pflegegrad, häusliche oder teilstationäre Pflege | Pflegebedürftigkeit + GdB < 100 | person | anforderung | § 17 Nr. 1 WoGG |
| `krankenversicherung-nachweis` | Nachweis Kranken-/Pflegeversicherung (Pflichtbeiträge / private Beiträge gleicher Zweckbestimmung) | immer (relevant für 10%-Pauschalabzug § 16) | person | anforderung | § 16 WoGG |
| `rentenversicherung-nachweis` | Nachweis Pflichtbeiträge zur Rentenversicherung | Person zahlt RV-Pflichtbeiträge | person | hinweis | § 16 WoGG |
| `alleinerziehend-nachweis` | Nachweis Alleinerziehung (Kind < 18, alleiniges Bewohnen mit Kind[ern]) | Haushaltsmitglied ist alleinerziehend | person | hinweis | § 17 Nr. 3 WoGG (Freibetrag) |

---

## 2. Plausibilitäts- / Widerspruchsregeln (Plausibilitätsprüfung)

Regel-Liste zur Erkennung von Widersprüchen zwischen **Antragsangaben** und **Nachweisen** bzw. innerer Inkonsistenz. Jede Regel: `id`, Beschreibung, verglichene Felder/Quellen, `severity`, Beispiel.

### 2.1 Miet-/Wohnraum-Konsistenz

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-miethoehe-abweichung` | Im Antrag angegebene Miete weicht von Mietvertrag / Vermieterbescheinigung ab | Antrag.miete ↔ Mietvertrag.miete ↔ Vermieterbescheinigung.miete | anforderung | Antrag nennt 850 €, Mietvertrag 780 € → Klärung/Anforderung aktuelle Mietbescheinigung |
| `plausi-wohnflaeche-abweichung` | Wohnfläche im Antrag ≠ Mietvertrag/Vermieterbescheinigung | Antrag.wohnflaeche ↔ Mietvertrag.wohnflaeche | hinweis | Antrag 75 m², Vertrag 68 m² → Rückfrage |
| `plausi-kaltmiete-vs-nebenkosten` | Bruttomiete enthält nicht abziehbare Positionen (Heizung/Warmwasser) ungetrennt | Antrag.miete ↔ Nebenkostenaufstellung | anforderung | Heizkosten nicht herausgerechnet → § 9 WoGG, Aufschlüsselung anfordern |
| `plausi-mietzahlung-fehlt` | Angegebene Miete nicht durch Zahlungsnachweis belegt | Antrag.miete ↔ Kontoauszug (Mietabbuchung) | anforderung | Kein Mietabgang auf Kontoauszug sichtbar → Zahlungsnachweis anfordern |
| `plausi-mietvertrag-unsigniert` | Mietvertrag ohne Unterschrift der Parteien | Mietvertrag.unterschrift | anforderung | Vertrag nicht unterschrieben → wirksamer Nachweis fehlt |
| `plausi-personenzahl-wohnflaeche` | Zahl der Haushaltsmitglieder unplausibel zur Wohnungsgröße | Antrag.haushaltsmitglieder ↔ Mietvertrag.wohnflaeche | hinweis | 6 Personen auf 40 m² → Prüfung Lebensmittelpunkt |

### 2.2 Einkommens-Konsistenz

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-einkommen-abweichung` | Angegebenes Einkommen weicht von Nachweis ab | Antrag.einkommen ↔ Verdienstbescheinigung / Rentenbescheid / Steuerbescheid | anforderung | Antrag 1.400 € netto, Gehaltsabrechnung 2.100 € brutto → Neuberechnung/Klärung |
| `plausi-kontoauszug-unerklaerte-einkuenfte` | Kontoauszug zeigt regelmäßige Eingänge, die im Antrag nicht deklariert sind | Kontoauszug.eingaenge ↔ Antrag.einkommensarten | anforderung | Wiederkehrende Dividenden-/Zinsgutschriften nicht angegeben → § 14 Abs. 1/Abs. 2 Nr. 15, Nacherklärung |
| `plausi-kapitalertraege-nicht-deklariert` | Depot/Wertpapiere in Vermögenserklärung, aber keine Kapitalerträge im Einkommen | Vermögenserklärung.wertpapiere ↔ Antrag.kapitalertraege | hinweis | Depot vorhanden, 0 € Erträge angegeben → Erträgnisaufstellung anfordern |
| `plausi-rentenart-fehlt` | Rentenbezug angegeben, aber Rentenart / Grundrentenzeiten nicht belegt | Antrag.rente ↔ Rentenbescheid.rentenart | hinweis | Nur Betrag genannt, keine Rentenart → Bescheid anfordern (auch für Freibetragsprüfung) |
| `plausi-selbststaendig-ohne-nachweis` | Selbständigkeit angegeben, aber kein Steuerbescheid/Gewinnermittlung | Antrag.status=selbständig ↔ vorhandene Nachweise | anforderung | Kein Einkommensnachweis für Selbständige → Anforderung |
| `plausi-kein-einkommen-aber-miete` | Kein/sehr geringes Einkommen deklariert, aber laufende Miete + Lebensunterhalt | Antrag.einkommen ↔ Antrag.miete + Lebensunterhalt | anforderung | 0 € Einkommen, 900 € Miete, keine Transferleistung → Erklärung Lebensunterhalt (§ 23) |
| `plausi-transferleistung-und-einkommen` | Transferleistung + volles Erwerbseinkommen gleichzeitig unplausibel | Antrag.transferleistung ↔ Antrag.erwerbseinkommen | hinweis | Bürgergeld + Vollzeitgehalt → Klärung (Ausschluss § 7?) |

### 2.3 Beiträge, Abzüge, Freibeträge

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-kv-pv-nicht-belegt` | Kranken-/Pflegeversicherungsbeiträge (für 10%-Pauschale § 16) nicht belegt | Antrag.kv_pv ↔ Versicherungsnachweis | anforderung | Keine Beleglage → Pauschalabzug § 16 nicht ansetzbar |
| `plausi-abzug-ohne-beitrag` | 10%-Pauschale beansprucht, obwohl beitragsfreie Sicherung / Beitragszahlung durch Dritte | § 16-Voraussetzung ↔ Versicherungsstatus | hinweis | Familienversichert ohne eigene Pflichtbeiträge → Pauschale prüfen |
| `plausi-schwerbehinderung-freibetrag` | Freibetrag Schwerbehinderung ohne GdB-Nachweis | Antrag.schwerbehindert ↔ Ausweis/Feststellungsbescheid | anforderung | GdB behauptet, kein Nachweis → Freibetrag § 17 nicht ansetzbar |
| `plausi-unterhalt-abzug-ohne-nachweis` | Unterhaltsabzug (§ 18) ohne Titel/Vereinbarung/Zahlungsbeleg | Antrag.unterhalt_gezahlt ↔ Nachweise | anforderung | Abzug beansprucht, kein Zahlungsnachweis → nur bis gesetzl. Höchstbetrag ohne Beleg |

### 2.4 Formale / Vollständigkeits-Widersprüche

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-antrag-ohne-unterschrift` | Antrag ohne Unterschrift der wohngeldberechtigten Person | Antrag.unterschrift | anforderung | Nicht unterschrieben → kein wirksamer Antrag |
| `plausi-antrag-ohne-datum` | Antrag ohne Datum (Antragsmonat für Leistungsbeginn unklar) | Antrag.datum | anforderung | Kein Datum → Antragsmonat/Leistungsbeginn nicht bestimmbar (§ 22 WoGG) |
| `plausi-haushaltsmitglieder-inkonsistenz` | Haushaltsmitglieder im Hauptformular ≠ Anlage / Meldedaten / Einkommensanlagen | Antrag.haushaltsmitglieder ↔ Anlage ↔ Meldebestätigung | anforderung | 4 Personen genannt, nur 3 Ausweise/Einkommensbögen → Klärung |
| `plausi-kindergeld-ohne-kind` | Kindergeld angegeben, aber kein Kind als Haushaltsmitglied geführt | Antrag.kindergeld ↔ Antrag.haushaltsmitglieder | hinweis | Kind lebt beim anderen Elternteil → Zuordnung § 5 Abs. 4 klären |
| `plausi-lebensmittelpunkt-zweifel` | Mehrere Wohnungen / Zweitwohnsitz → Lebensmittelpunkt fraglich | Meldedaten ↔ Antrag.wohnung | hinweis | Zweitwohnsitz gemeldet → § 5 Abs. 1 (Mittelpunkt Lebensbeziehungen) |
| `plausi-nachweise-veraltet` | Eingereichte Nachweise beziehen sich nicht auf den aktuellen/prognostizierten Zeitraum | Nachweis.datum ↔ Bewilligungszeitraum | hinweis | Gehaltsabrechnung 2 Jahre alt → aktuelle anfordern (§ 24) |

### 2.5 Ausschluss-Plausibilität (siehe Abschnitt 5)

| id | Beschreibung | verglichene Quellen | severity | Beispiel |
|----|--------------|---------------------|----------|----------|
| `plausi-ausschluss-transferleistung` | Haushalt bezieht ausschließlich Transferleistungen mit enthaltenen Unterkunftskosten → Ausschluss | Antrag.transferleistungen ↔ § 7 WoGG | anforderung | Alle Mitglieder beziehen Bürgergeld inkl. KdU → § 7 Abs. 1 / § 21 Nr. 2 |
| `plausi-vermoegen-ueber-freigrenze` | Vermögen überschreitet Freigrenze (60.000 € + 30.000 € je weiteres Mitglied) | Vermögenserklärung ↔ Freigrenze | anforderung | 2-Personen-Haushalt mit 120.000 € → missbräuchliche Inanspruchnahme § 21 Nr. 3 prüfen |
| `plausi-wohngeld-unter-mindestbetrag` | Rechnerischer Anspruch < 10 €/Monat | Berechnungs-Vorprüfung | hinweis | Kein Anspruch nach § 21 Nr. 1 (nur informativ, keine Betragsberechnung im Scope) |

---

## 3. § 13 WoGG — Gesamteinkommen: Struktur der Aggregationslogik

Nur die **Struktur** (welche Positionen addiert/abgezogen werden), keine Wohngeld-Betragsberechnung. Die Kette ist:

```
Gesamteinkommen (§ 13)
  = Σ Jahreseinkommen je Haushaltsmitglied (§ 14)
      wobei Jahreseinkommen = positive Einkünfte i.S.d. § 2 Abs. 1,2 EStG (§ 14 Abs. 1)
                              + steuerfreie Einnahmen / Zuschläge (§ 14 Abs. 2, Nrn. 1–31)
                              − Abzugsbeträge Steuern/Sozialabgaben (§ 16, Pauschale 10%)
  − Freibeträge (§§ 17, 17a)
  − Abzugsbeträge für Unterhaltsleistungen (§ 18)

Monatliches Gesamteinkommen = Gesamteinkommen / 12   (§ 13 Abs. 2)
```

### 3.1 Bestandteile des Jahreseinkommens (§ 14 WoGG)

**§ 14 Abs. 1 — Grundlage:** Summe der **positiven** Einkünfte i.S.d. § 2 Abs. 1 u. 2 EStG:
- Einkünfte aus nichtselbständiger Arbeit
- Einkünfte aus selbständiger Arbeit / Gewerbebetrieb / Land- und Forstwirtschaft
- Einkünfte aus Kapitalvermögen
- Einkünfte aus Vermietung und Verpachtung
- sonstige Einkünfte i.S.d. § 22 EStG (u. a. steuerpflichtige Rentenanteile)
- pauschal besteuerte Sachzuwendungen (§ 37b EStG), pauschal besteuerter Arbeitslohn (§ 40a EStG)

> **Wichtig für Plausibilität:** Ein Ausgleich mit **negativen** Einkünften anderer Einkunftsarten (Verlustverrechnung) ist **nicht** zulässig (§ 14 Abs. 1). Verluste aus V+V dürfen z. B. Erwerbseinkommen nicht mindern.

**§ 14 Abs. 2 — Hinzurechnungen (steuerfreie / nicht als Einkünfte erfasste Einnahmen, Nrn. 1–31)**, u. a.:
- Nr. 1: steuerfreie Versorgungsbezüge
- Nr. 2: Einkommen behinderter Menschen aus öffentlichen Mitteln
- Nr. 3: steuerfreie (Ertrags-)Anteile von Leibrenten
- Nr. 4: Rentenabfindungen, Beitragserstattungen
- Nr. 5: Unfallrenten
- Nr. 6: Lohn-/Einkommensersatzleistungen (Arbeitslosengeld I, Kurzarbeitergeld, Krankengeld, Elterngeld über Sockelbetrag etc.)
- Nr. 7: ausländische Einkünfte
- Nr. 8: hälftige Berücksichtigung bestimmter Unterstützungsleistungen
- Nr. 9: Krankentagegelder
- Nr. 11: steuerfreie Zuschläge (z. B. Nachtarbeit) — soweit erfasst
- Nr. 14: bestimmte Altersvorsorgezuwendungen
- Nr. 15: Kapitalerträge oberhalb des Sparer-Pauschbetrags (ab 100 €)
- Nr. 19–22: erhaltene Unterhaltsleistungen, Unterhalt geschiedener/getrennt lebender Ehegatten, Unterhaltsvorschuss, Miet-/Wohnleistungen Dritter
- Nr. 24–29: hälftige Berücksichtigung von Ausbildungsförderung/Stipendien (BAföG etc.)
- Nr. 30: wiederkehrende Leistungen (mit Ausnahmen)
- Nr. 31: Mietwert selbstgenutzten Wohnraums (soweit einschlägig)

**§ 14 Abs. 3 — Nicht anzurechnen** (Auswahl):
- Einnahmen aus Mitbewohner-/Untermietzahlungen für den betreffenden Wohnraum
- bestimmte Leistungen nach dem Aufenthaltsgesetz
- (Kindergeld ist grds. **nicht** Einkommen i.S.d. § 14, wirkt aber über Freibetragslogik/§ 17)

### 3.2 Abzugsbeträge Steuern/Sozialabgaben (§ 16 WoGG)

Pauschaler Abzug vom Betrag nach §§ 14, 15, gestaffelt nach tatsächlich zu erwartenden Zahlungen:
- **je 10 %** für jede der drei Kategorien, wenn im Bewilligungszeitraum voraussichtlich zu zahlen:
  1. **Steuern vom Einkommen** (Einkommen-/Lohnsteuer)
  2. **Pflichtbeiträge zur gesetzlichen Kranken- und Pflegeversicherung**
  3. **Pflichtbeiträge zur gesetzlichen Rentenversicherung**
- Kumulierbar: 0 % / 10 % / 20 % / **max. 30 %** je Haushaltsmitglied, je nachdem welche Kategorien zutreffen.
- Gleichgestellt: laufende Beiträge zu **privaten** Versicherungen gleicher Zweckbestimmung (auch für andere Haushaltsmitglieder gezahlt).
- **Kein** Abzug bei im Wesentlichen **beitragsfreier** Sicherung oder wenn Beiträge von Dritten getragen werden.

> **Korrektur/Präzisierung:** Die kurze Kennzahl „10 %" bezieht sich auf **eine einzelne Kategorie**. Durch Kombination der drei Kategorien ergeben sich die Stufen 10 / 20 / 30 %. Der Nachweis der jeweiligen Beitrags-/Steuerpflicht (siehe `krankenversicherung-nachweis`, `rentenversicherung-nachweis`) ist Voraussetzung.

### 3.3 Freibeträge (§ 17 WoGG)

Vom Gesamteinkommen abgezogene Jahresfreibeträge:
- **1.800 €** je schwerbehindertem Haushaltsmitglied mit GdB 100 — oder GdB < 100 bei häuslicher/teilstationärer Pflegebedürftigkeit (§ 17 Nr. 1)
- **750 €** je Haushaltsmitglied, das Opfer nationalsozialistischer Verfolgung ist / gleichgestellt (§ 17 Nr. 2)
- **1.320 €** für Alleinerziehende (ausschließliches Bewohnen mit Kind[ern], mind. ein Kind < 18 mit Kindergeldbezug) (§ 17 Nr. 3)
- **bis 1.200 €** je Kind (Haushaltsmitglied, unter 25 Jahre) in Höhe seines **eigenen Erwerbseinkommens**, max. 1.200 € (§ 17 Nr. 4)
- (§ 17a: zusätzlicher Freibetrag für bestimmte Fälle nach Landesrecht/Übergangsregelungen, soweit anwendbar)

### 3.4 Abzugsbeträge Unterhaltsleistungen (§ 18 WoGG)

Für **gesetzliche** Unterhaltsverpflichtungen gegenüber Personen **außerhalb** des Haushalts:
- Nr. 1: **bis 3.000 €**/Jahr für Haushaltsmitglied in auswärtiger Berufsausbildung
- Nr. 2: **bis 3.000 €**/Jahr für Kind (§ 5 Abs. 4) an den anderen Elternteil
- Nr. 3: **bis 6.000 €**/Jahr für früheren/getrennt lebenden Ehegatten/Lebenspartner
- Nr. 4: **bis 3.000 €**/Jahr für sonstige Personen
- Liegt ein **Titel, eine notariell beurkundete Unterhaltsvereinbarung oder ein Bescheid** vor: Abzug bis zur **tatsächlichen Höhe** (über die Pauschalgrenzen hinaus).

---

## 4. Wohngeldarten & Antragsarten — nachweisrelevante Unterschiede

| Dimension | Mietzuschuss | Lastenzuschuss |
|-----------|--------------|----------------|
| Anspruchsträger | Mieter/Untermieter (§ 3 Abs. 1) | Eigentümer selbstgenutzten Wohnraums, Erbbauberechtigte, best. dingl. Berechtigte (§ 3 Abs. 2, 3) |
| Kern-Wohnraumnachweis | Mietvertrag + Vermieterbescheinigung + Mietzahlung | Grundbuch/Eigentum + Belastungsermittlung + Kreditverträge + Grundsteuer |
| Belastungsberechnung | Bruttokaltmiete (ohne nicht zuschussfähige Kosten, § 6 WoGV) | Zins/Tilgung, Grundsteuer, Erbbauzins, Instandhaltungs-/Bewirtschaftungspauschalen (§§ 11–13 WoGV) |
| Besonderer Nachweis | Nebenkostenaufstellung (Heizung/WW abgrenzen) | Fremdmittelbescheinigung, Jahreskontoauszug Darlehen |

| Antragsart | Nachweis-Delta |
|-----------|----------------|
| **Erstantrag** | Vollständige Nachweislage (Abschnitt 1) |
| **Weiterleistungs-/Folgeantrag** | Aktualisierte Einkommens- und Mietnachweise; Identitäts-/Eigentumsnachweise nur bei Änderung; Verweis auf Vorakte möglich |
| **Erhöhungs-/Änderungsantrag** | Nur Nachweis zur geänderten Tatsache (z. B. Mieterhöhungsschreiben, neuer Rentenbescheid, Nachweis Einkommensminderung); Bezug zum laufenden Bescheid |

**Änderungsmitteilungspflicht:** Während des Bewilligungszeitraums müssen relevante Änderungen (Einkommen +15 %, Miete −15 %, Reduktion der Haushaltsmitglieder, Wegfall/Ausschluss) angezeigt werden (§ 27 WoGG). Für die Plausibilitätsprüfung von Folgeanträgen relevant: Abgleich mit Vorbescheid.

---

## 5. Ausschlussgründe (§§ 7, 8, 21 WoGG) — als Prüfregeln

### 5.1 Ausschluss wegen Transferleistungsbezug (§ 7 WoGG)

Vom Wohngeld **ausgeschlossen** sind Personen, bei denen Unterkunftskosten in folgenden Transferleistungen bereits berücksichtigt werden (§ 7 Abs. 1 Nr. 1–9):

| id | Ausschluss-Tatbestand (§ 7 Abs. 1) | Nr. |
|----|-----------------------------------|-----|
| `ausschluss-buergergeld` | Bürgergeld / Leistungen zur Sicherung des Lebensunterhalts nach SGB II (wenn KdU nach § 19 Abs. 1 S. 1 SGB II enthalten) | Nr. 1 |
| `ausschluss-azubi-sgb2` | Zuschüsse für Auszubildende nach SGB II | Nr. 2 |
| `ausschluss-verletztengeld` | Verletztengeld in Höhe best. Leistungen nach SGB VII | Nr. 4 |
| `ausschluss-grundsicherung-alter` | Grundsicherung im Alter und bei Erwerbsminderung nach SGB XII (4. Kapitel) | Nr. 5 |
| `ausschluss-hilfe-lebensunterhalt` | Hilfe zum Lebensunterhalt nach SGB XII (3. Kapitel) | Nr. 6 |
| `ausschluss-sgb14` | Leistungen zum Lebensunterhalt / in stationären Einrichtungen nach SGB XIV (Soziale Entschädigung) | Nr. 7 |
| `ausschluss-asylblg` | Leistungen in besonderen Fällen / Grundleistungen nach AsylbLG | Nr. 8 |
| `ausschluss-sgb8` | Leistungen nach SGB VIII in Haushalten, deren Mitglieder ausschließlich diese beziehen | Nr. 9 |

**Prüfregeln:**
- `ausschluss-person-transferbezug` (severity: anforderung): Wenn ein Haushaltsmitglied eine Leistung nach § 7 Abs. 1 mit enthaltenen Unterkunftskosten bezieht → dieses Mitglied ist ausgeschlossen; sein Einkommen/Bedarf bleibt bei der Wohngeldberechnung außer Betracht.
- `ausschluss-mitglied-beruecksichtigt` (§ 7 Abs. 2): Auch Haushaltsmitglieder **ohne** eigene Transferleistung sind ausgeschlossen, wenn ihr Einkommen/Vermögen bei der Berechnung der Transferleistung eines **anderen** Haushaltsmitglieds berücksichtigt wurde.
- **Ausnahmen** (kein Ausschluss): Leistung wird ausschließlich als **Darlehen** gewährt; oder Wohngeld würde die Hilfebedürftigkeit **beseitigen/vermeiden** und die Leistung wird deshalb nicht bezogen (§ 7 Abs. 1 Hs. 2).

### 5.2 Dauer des Ausschlusses / Verzicht (§ 8 WoGG)

- Der Ausschluss gilt **als nicht erfolgt**, wenn der Transferleistungsantrag zurückgenommen oder die Leistung abgelehnt wird.
- **Verzicht:** Verzichten Haushaltsmitglieder auf Leistungen nach § 7 Abs. 1, um Wohngeld zu beantragen, gilt der Ausschluss ab Wirkung des Verzichts als nicht erfolgt (Wahlrecht zwischen Transferleistung und Wohngeld, § 8).
- Prüfregel `ausschluss-verzicht-pruefen` (hinweis): Bei grenzwertigem Fall auf mögliche Günstigerprüfung/Verzichtserklärung hinweisen.

### 5.3 Kein Wohngeldanspruch (§ 21 WoGG)

| id | Tatbestand | § 21 |
|----|-----------|------|
| `kein-anspruch-mindestbetrag` | Wohngeld würde weniger als **10 €/Monat** betragen | Nr. 1 |
| `kein-anspruch-alle-ausgeschlossen` | **Alle** Haushaltsmitglieder sind nach §§ 7, 8 Abs. 1 ausgeschlossen | Nr. 2 |
| `kein-anspruch-missbrauch-vermoegen` | Inanspruchnahme wäre **missbräuchlich**, insbesondere wegen **erheblichen Vermögens** | Nr. 3 |

**Vermögens-Freigrenze (§ 21 Nr. 3 WoGG i.V.m. WoGVwV / Verwaltungspraxis):**
- **60.000 €** für das erste (= ein) zu berücksichtigende Haushaltsmitglied
- **+ 30.000 €** für **jedes weitere** Haushaltsmitglied
- Es handelt sich um eine **Freigrenze**, nicht um einen Freibetrag: Bei Überschreitung entfällt der Anspruch grundsätzlich vollständig (Missbrauchsvermutung).
- **Nicht** zum verwertbaren Vermögen zählen u. a.: selbstgenutztes angemessenes Wohneigentum, gefördertes Altersvorsorgevermögen (Riester), Vermögen zur baldigen Beschaffung/Erhaltung angemessenen Wohnraums bzw. für nachvollziehbare Zwecke (Schuldentilgung, Altersvorsorge, Pflege) — dann keine Missbräuchlichkeit.
- Prüfregel `vermoegen-freigrenze-berechnen` (anforderung): Freigrenze = 60.000 + 30.000 × (Anzahl HH-Mitglieder − 1). Bei Überschreitung → Vermögensnachweise + Zweckerklärung anfordern, dann Einzelfallbewertung.

---

## 6. Quellen

**Primärquellen (Gesetz/Verordnung):**
- Wohngeldgesetz (WoGG), Gesamttext: https://www.gesetze-im-internet.de/wogg/BJNR185610008.html (PDF: https://www.gesetze-im-internet.de/wogg/WoGG.pdf)
- § 3 WoGG (Wohngeldberechtigung): https://www.gesetze-im-internet.de/wogg/__3.html
- § 5 WoGG (Haushaltsmitglieder): https://www.gesetze-im-internet.de/wogg/__5.html · https://dejure.org/gesetze/WoGG/5.html
- § 7 WoGG (Ausschluss vom Wohngeld): https://www.gesetze-im-internet.de/wogg/__7.html
- § 8 WoGG (Dauer des Ausschlusses): https://www.gesetze-im-internet.de/wogg/__8.html
- § 13 WoGG (Gesamteinkommen): https://www.gesetze-im-internet.de/wogg/__13.html
- § 14 WoGG (Jahreseinkommen): https://www.gesetze-im-internet.de/wogg/__14.html
- § 16 WoGG (Abzugsbeträge Steuern/Sozialabgaben): https://www.gesetze-im-internet.de/wogg/__16.html
- § 17 WoGG (Freibeträge): https://www.gesetze-im-internet.de/wogg/__17.html
- § 18 WoGG (Abzugsbeträge Unterhaltsleistungen): https://www.gesetze-im-internet.de/wogg/__18.html
- § 21 WoGG (Kein Wohngeldanspruch / erhebliches Vermögen): https://www.gesetze-im-internet.de/wogg/__21.html
- Wohngeldverordnung (WoGV): https://www.gesetze-im-internet.de/wogv/ (u. a. § 6 WoGV außer Betracht bleibende Kosten)
- Wohngeld-Verwaltungsvorschrift (WoGVwV): https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_28062017_SWII4.htm

**Merkblätter / Antragsformulare / Behörden (Nachweislisten, Stand 2023–2025):**
- MHKBD NRW — Wohngeld-Themenportal & Formulare (Mietzuschuss/Lastenzuschuss): https://www.mhkbd.nrw/themenportal/wohngeld
- Antrag Mietzuschuss NRW (Merkblatt/Anlage): https://recht.nrw.de/system/files/VA/13650-18884-mbl32-4anlage1.pdf
- Stadt Stuttgart — Wohngeldantrag Mietzuschuss mit Hinweisblatt (Stand 2025): https://www.stuttgart.de/medien/ibs/antrag-mz-mit-hinweisblatt-und-dsgvo-2025-01-02.pdf
- Bayern (StMB) — Antrag Lastenzuschuss: https://www.stmb.bayern.de/assets/stmi/wohnen/wohngeld/35_lz_antrag_bildschirm.pdf
- Stadt Frankfurt — Unterlagen-Checkliste Wohngeld: https://frankfurt.de/themen/planen-bauen-und-wohnen/wohnen/wohngeld/wohngeld_checklisteunterlagen
- Stadt Wiesbaden — Merkblatt benötigte Unterlagen: https://www.wiesbaden.de/vv/medien/merk/51/wohnen/Wohngeld-Merkblatt_benoetigte_Unterlagen_zur_Antragsstellung_2023.pdf
- Freistaat Sachsen — Hinweisblatt benötigte Unterlagen: https://www.bauen-wohnen.sachsen.de/download/Hinweisblatt_Benoetigte_Unterlagen_Wohngeldantrag_barrierefrei.pdf
- Stadt Wuppertal — benötigte Unterlagen: https://www.wuppertal.de/vv/produkte/105/105.31_Wohngeld_Miet-_und_Lastenzuschuss.php.media/470895/Welche-Unterlagen-werden-fuer-den-Wohngeldantrag-benoetigt.pdf
- antrag-digital.de — Wohngeld-Unterlagen (Miet-/Lastenzuschuss): https://www.antrag-digital.de/wohngeld/wohngeld-unterlagen/

**Sekundär / Erläuterung (Vermögensfreigrenze, Einordnung):**
- wohngeld.org — Vermögen (Freigrenze 60.000/30.000 €): https://www.wohngeld.org/vermoegen/
- Finanztip — Wohngeld (Überblick, Stand 2026): https://www.finanztip.de/wohngeld/
- Verbraucherzentrale — Wohngeld beantragen: https://www.verbraucherzentrale.de/wissen/geld-versicherungen/kredit-schulden-insolvenz/wohngeld-wer-es-bekommt-und-wie-sie-es-beantragen-78141

---

*Hinweis: Beträge und Freigrenzen entsprechen dem Rechtsstand nach der Wohngeld-Plus-Reform. Landesspezifische Merkblätter können bei den Nachweisanforderungen im Detail variieren (z. B. Anzahl einzureichender Kontoauszüge/Gehaltsabrechnungen). Die Rechtsgrundlagen der Nachweispflicht folgen aus der allgemeinen Mitwirkungspflicht §§ 60 ff. SGB I i.V.m. § 23 WoGG.*
