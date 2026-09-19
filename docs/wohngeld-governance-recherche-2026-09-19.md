# Governance-Recherche: KI-gestützter Antragsassistent für die Wohngeld-Sachbearbeitung

**Datum:** 2026-09-19
**Kontext:** Regulatorische Governance-Anker für einen KI-Assistenten, der Sachbearbeiterinnen und Sachbearbeiter in kommunalen Wohngeldstellen unterstützt. Explizit **Assistenz, keine automatische Entscheidung** — Human-in-the-Loop, menschliche Letztentscheidung.
**Zweck:** Belastbare, zitierfähige Grundlage für eine Governance-Spec. Alle §§/Artikel mit Primärquellen-URLs.

> Hinweis: Diese Recherche ersetzt keine juristische Beratung. Aufbewahrungsfristen und DSFA-Muss-Listen sind teilweise landesrechtlich bzw. aufsichtsbehördlich geregelt und mit dem behördlichen Datenschutzbeauftragten (DSB) der jeweiligen Kommune final zu klären.

---

## Executive Summary

- **Wohngelddaten sind Sozialdaten.** Es gilt der bereichsspezifische Sozialdatenschutz (§ 35 SGB I, §§ 67–85a SGB X) **zusätzlich** zur DSGVO. Kern: Sozialgeheimnis, strenge Zweckbindung, Zugriff nur für Befugte, dokumentierte Übermittlung, Auftragsverarbeitung nur schriftlich geregelt.
- **DSGVO:** Rechtsgrundlage ist die öffentliche Aufgabe (Art. 6 Abs. 1 lit. e i.V.m. Abs. 3 + Fachrecht WoGG/SGB). Rechenschaftspflicht (Art. 5 Abs. 2), TOM (Art. 32), Verzeichnis (Art. 30), Betroffenenrechte (Art. 15–18, 21). Eine **Datenschutz-Folgenabschätzung (Art. 35)** ist hier mit hoher Wahrscheinlichkeit Pflicht.
- **Art. 22 DSGVO ist der Dreh- und Angelpunkt des „Assistenz"-Designs:** Solange ein Mensch die Entscheidung wirksam prüft und abändern kann (kein „Rubber-Stamping"), liegt **keine** ausschließlich automatisierte Einzelentscheidung vor — der strenge Verbotstatbestand des Art. 22 Abs. 1 wird gar nicht erst eröffnet.
- **EU AI Act:** Wohngeld-KI fällt grundsätzlich unter **Anhang III Nr. 5 lit. a** (Zugang zu / Inanspruchnahme von öffentlichen Unterstützungsleistungen) → **Hochrisiko** nach Art. 6 Abs. 2. Eine **echte Assistenz** kann über die **Ausnahme des Art. 6 Abs. 3** aus dem Hochrisiko-Regime herausfallen — aber nur mit dokumentierter Bewertung und **nie bei Profiling**. Selbst bei greifender Ausnahme sind Logging/Aufsicht faktisch weiterhin geboten.
- **Fristen AI Act:** Hochrisiko-Pflichten für eigenständige Anhang-III-Systeme wurden durch den **Digital Omnibus** (VO (EU) 2026/1744) verschoben — spätestens **2. Dezember 2027**.
- **Protokollierung** ist die verbindende Kernpflicht aus allen drei Regimen: revisionssicheres, manipulationssicheres Audit-Log inkl. **Lesezugriffen** auf Sozialdaten.

---

## 1. Sozialdatenschutz (SGB I / SGB X)

Wohngeld ist eine Sozialleistung (§ 68 Nr. 10 SGB I). Alle personenbezogenen Daten, die eine Wohngeldstelle im Rahmen ihrer Aufgabe erhebt/verarbeitet, sind **Sozialdaten** (§ 67 Abs. 2 SGB X). Der Sozialdatenschutz gilt **bereichsspezifisch und vorrangig**, soweit er die DSGVO zulässig konkretisiert; im Übrigen gilt die DSGVO direkt.

### § 35 SGB I — Sozialgeheimnis
- **Was gefordert wird:** Jeder hat Anspruch darauf, dass ihn betreffende Sozialdaten von den Leistungsträgern nicht unbefugt verarbeitet werden (Sozialgeheimnis). Die Wahrung umfasst ausdrücklich die Verpflichtung, sicherzustellen, dass Sozialdaten **innerhalb** des Leistungsträgers **nur Befugten zugänglich** sind oder nur an diese weitergegeben werden.
- **Relevanz fürs Tool:** Der Assistent muss ein striktes Rollen-/Berechtigungskonzept (Least Privilege) durchsetzen; nur der jeweils zuständige, befugte Sachbearbeiter darf Zugriff auf die Falldaten haben. Aus dem „nur Befugten zugänglich" folgt unmittelbar die Notwendigkeit von Zugriffskontrolle **und** deren Nachweisbarkeit → Protokollierung (siehe Abschnitt 6).
- **Quelle:** https://www.gesetze-im-internet.de/sgb_1/__35.html · https://dejure.org/gesetze/SGB_I/35.html

### §§ 67–85a SGB X — Schutz der Sozialdaten (Zweites Kapitel)
- **Was gefordert wird:** Verarbeitung von Sozialdaten ist nur unter den Voraussetzungen der §§ 67 ff. SGB X (bzw. bei direkter DSGVO-Anwendung nach dieser) zulässig. § 67a regelt die Erhebung, § 67c die Verarbeitung zu dem Zweck, zu dem sie erhoben wurden, §§ 68 ff. die Übermittlung, §§ 83 ff. Betroffenenrechte (Auskunft, Berichtigung, Löschung) im Sozialrecht.
- **Relevanz fürs Tool:** Der Assistent darf Sozialdaten nur für den Erhebungszweck „Bearbeitung des Wohngeldantrags" verarbeiten. Keine Zweckänderung (z.B. Nutzung zu Trainings-/Analysezwecken) ohne eigene Rechtsgrundlage.
- **Quelle (Kapitelübersicht):** https://www.buzer.de/gesetz/3086/b8504.htm · https://www.gesetze-im-internet.de/sgb_10/

### § 76 SGB X — Besonders schutzwürdige Sozialdaten
- **Was gefordert wird:** Sozialdaten, die einer besonderen Amts- oder Berufsgeheimnispflicht unterliegen und von einer solchen Stelle (z.B. Arzt) übermittelt wurden, dürfen nur eingeschränkt weiterübermittelt werden — grundsätzlich nur mit Einwilligung bzw. unter engen Voraussetzungen.
- **Relevanz fürs Tool:** Bei Wohngeld relevant, wo z.B. ärztliche Angaben zu Behinderung/Pflege für Freibeträge einfließen. Solche Daten benötigen erhöhten Schutz, besondere Zugriffsbeschränkung und dürfen nicht in Nebenprozesse (Logging-Klartext, LLM-Kontexte externer Provider) abfließen.
- **Quelle:** https://dejure.org/gesetze/SGB_X/76.html

### § 78 SGB X — Zweckbindung und Geheimhaltungspflicht eines Dritten
- **Was gefordert wird:** Werden Sozialdaten an einen Dritten (auch Privaten) übermittelt, dürfen diese vom Empfänger **nur zu dem Zweck** verarbeitet werden, zu dem sie übermittelt wurden; der Dritte ist zur Geheimhaltung im selben Umfang wie die übermittelnde Stelle (§ 35 SGB I) verpflichtet.
- **Relevanz fürs Tool:** Jeder externe Baustein (Cloud-LLM, Hosting, KI-Dienstleister) muss vertraglich auf denselben Zweck und dieselbe Geheimhaltung verpflichtet werden. Zweckbindung „wandert mit" den Daten.
- **Quelle:** https://dejure.org/gesetze/SGB_X/78.html

### § 80 SGB X — Verarbeitung von Sozialdaten im Auftrag (Auftragsverarbeitung)
- **Was gefordert wird:** Auftragsverarbeitung von Sozialdaten ist nur unter zusätzlichen Voraussetzungen zu Art. 28 DSGVO zulässig. Insbesondere gilt für die Auslagerung an **nicht-öffentliche Stellen** ein Erforderlichkeits-/Abwägungsvorbehalt; der Auftrag ist schriftlich (bzw. in dokumentierter Form) zu erteilen, mit strenger Zweckbindung und Löschpflicht. Bei besonderen Berufsgeheimnisträgern gelten weitere Schranken.
- **Relevanz fürs Tool:** Betreibt ein privater Anbieter (z.B. Adacor/Plattformbetreiber) den Assistenten, ist er **Auftragsverarbeiter nach Art. 28 DSGVO + § 80 SGB X**. Der AV-Vertrag muss die sozialdatenschutzrechtlichen Zusätze abbilden; die Kommune bleibt Verantwortliche. Cloud-Standort, Unterauftragsverarbeiter (Sub-LLM) und Weisungsbindung sind kritisch zu prüfen.
- **Quelle:** https://dejure.org/gesetze/SGB_X/80.html · https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/01_GRA_SGB/10_SGB_X/pp_0076_100/gra_sgb010_p_0080.html

### Protokollierungspflichten aus dem Sozialdatenschutz
- Eine ausdrückliche „Log-Paragraf"-Norm wie im Polizei-/Justizbereich (vgl. § 76 BDSG) existiert im SGB X nicht als Selbstzweck. Die Protokollierungspflicht folgt jedoch **zwingend abgeleitet** aus:
  - **§ 35 SGB I** („nur Befugten zugänglich") — Zugriffsbeschränkung ist nur nachweisbar/durchsetzbar mit Zugriffsprotokollierung.
  - **Zweckbindung §§ 67c, 78 SGB X** — die zweckkonforme Verwendung muss nachweisbar sein.
  - **Rechenschaftspflicht Art. 5 Abs. 2 DSGVO + TOM Art. 32 DSGVO** (siehe Abschnitt 2/6).
- **Fazit:** Für Sozialdaten ist ein **Zugriffsprotokoll inkl. Lesezugriffen** faktisch Pflicht (nachweisen können, wer wann welchen Fall eingesehen hat), plus Protokollierung von Übermittlungen.

---

## 2. DSGVO

### Art. 5 — Grundsätze / Rechenschaftspflicht
- **Was gefordert wird:** Rechtmäßigkeit, Zweckbindung, Datenminimierung, Richtigkeit, Speicherbegrenzung, Integrität/Vertraulichkeit — und Abs. 2: die **Nachweispflicht** (Accountability), dass die Grundsätze eingehalten werden.
- **Relevanz fürs Tool:** Governance-Spec muss Nachweise organisieren: Verarbeitungsdokumentation, Logs, DSFA, TOM-Konzept.
- **Quelle:** https://dsgvo-gesetz.de/art-5-dsgvo/

### Art. 6 Abs. 1 lit. e / Abs. 3 — Öffentliche Aufgabe
- **Was gefordert wird:** Verarbeitung ist rechtmäßig, wenn sie zur Wahrnehmung einer im öffentlichen Interesse liegenden Aufgabe / in Ausübung öffentlicher Gewalt erforderlich ist (lit. e). Diese Grundlage muss nach Abs. 3 im **Unionsrecht oder mitgliedstaatlichen Recht** festgelegt sein — hier: **WoGG + SGB I/X**.
- **Relevanz fürs Tool:** Es braucht **keine Einwilligung** der Antragsteller; Rechtsgrundlage ist das Fachrecht. Der Assistent muss innerhalb dieses gesetzlichen Auftrags bleiben.
- **Quelle:** https://dsgvo-gesetz.de/art-6-dsgvo/

### Art. 9 — Besondere Kategorien personenbezogener Daten
- **Was gefordert wird:** Verarbeitung von Gesundheitsdaten u.ä. ist grundsätzlich verboten, außer ein Ausnahmetatbestand (Abs. 2) greift — z.B. lit. b (Sozialrecht) oder lit. g (erhebliches öffentliches Interesse auf gesetzlicher Grundlage).
- **Relevanz fürs Tool:** Bei Wohngeld fallen **Gesundheits-/Behinderungs-/Pflegedaten** an (Freibeträge nach §§ 17 WoGG, Schwerbehinderung/Pflegebedürftigkeit). Diese Art-9-Daten erfordern erhöhte TOM, strikte Zugriffsbeschränkung, und dürfen nicht unnötig in KI-Kontexte/Prompts/Logs gelangen. Verbindung zu § 76 SGB X.
- **Quelle:** https://dsgvo-gesetz.de/art-9-dsgvo/

### Art. 22 — Automatisierte Entscheidungen im Einzelfall (Kernnorm für „Assistenz")
- **Was gefordert wird:** Betroffene haben das Recht, **nicht** einer **ausschließlich** auf automatisierter Verarbeitung (inkl. Profiling) beruhenden Entscheidung unterworfen zu werden, die rechtliche Wirkung entfaltet oder ähnlich erheblich beeinträchtigt. Ein Wohngeldbescheid ist eine solche Entscheidung mit Rechtswirkung.
- **Einordnung „Assistenz statt Entscheidung":** Der Verbotstatbestand greift nur bei **ausschließlich** automatisierter Entscheidung. Wer organisatorisch/technisch sicherstellt, dass ein Mensch **an entscheidender Stelle tatsächlich prüfend eingreift** und das Ergebnis ändern kann, überschreitet die Schwelle des Art. 22 Abs. 1 gar nicht. **Bloßes „Abnicken" (Rubber-Stamping) genügt nicht** — die menschliche Prüfung muss real, kompetent und ergebnisoffen sein.
- **Relevanz fürs Tool (Design-Anforderungen):**
  1. Der Assistent erstellt **Vorschläge/Entwürfe**, kein automatisch wirksamer Bescheid.
  2. Der Sachbearbeiter muss die zugrundeliegenden Daten/Begründung sehen und verändern können (Nachvollziehbarkeit, keine Blackbox).
  3. Es muss **verhindert** werden, dass die menschliche Rolle zum reinen Bestätigungsklick verkümmert (z.B. Pflicht-Review-Schritte, Anzeige der maßgeblichen Berechnungsgrundlagen, Vier-Augen wo sinnvoll).
  4. Diese Ausgestaltung ist zugleich das Argument gegen die AI-Act-Hochrisiko-Einstufung (Abschnitt 3, Art. 6 Abs. 3).
- **Quelle:** https://dsgvo-gesetz.de/art-22-dsgvo/ · https://dejure.org/gesetze/DSGVO/22.html

### Art. 30 — Verzeichnis von Verarbeitungstätigkeiten
- **Was gefordert wird:** Verantwortliche führen ein Verzeichnis aller Verarbeitungstätigkeiten (Zwecke, Kategorien, Empfänger, Löschfristen, TOM-Beschreibung).
- **Relevanz fürs Tool:** Die Verarbeitung durch den KI-Assistenten ist als eigener Eintrag (bzw. Ergänzung des Wohngeld-Verfahrenseintrags) zu dokumentieren; der Auftragsverarbeiter führt sein eigenes Verzeichnis nach Art. 30 Abs. 2.
- **Quelle:** https://dsgvo-gesetz.de/art-30-dsgvo/

### Art. 32 — Sicherheit der Verarbeitung (TOM)
- **Was gefordert wird:** Dem Risiko angemessene technische und organisatorische Maßnahmen — u.a. Verschlüsselung, Pseudonymisierung, Vertraulichkeit/Integrität/Verfügbarkeit/Belastbarkeit, Wiederherstellbarkeit, regelmäßige Überprüfung.
- **Relevanz fürs Tool:** Verschlüsselung (at rest / in transit), Mandanten-/Fall-Trennung, Zugriffskontrolle, Logging, Backup/Recovery. Referenzrahmen: **BSI IT-Grundschutz** (Abschnitt 5).
- **Quelle:** https://dsgvo-gesetz.de/art-32-dsgvo/

### Art. 35 — Datenschutz-Folgenabschätzung (DSFA)
- **Was gefordert wird:** Bei voraussichtlich **hohem Risiko** für Rechte und Freiheiten (v.a. neue Technologien) ist vorab eine DSFA durchzuführen. Pflicht insbesondere bei umfangreicher Verarbeitung besonderer Kategorien (Art. 9) und bei systematischer umfangreicher Bewertung persönlicher Aspekte.
- **Einordnung — hier voraussichtlich Pflicht, weil:** (1) besondere Kategorien (Gesundheit/Behinderung), (2) Verarbeitung durch eine **öffentliche Stelle** hoheitlich, (3) **neue Technologie (KI)**, (4) potenziell erhebliche Auswirkungen (Existenzsicherung). Verwaltungsverfahren zur Bearbeitung von Sozialleistungsanträgen werden in aufsichtsbehördlichen „Muss-Listen" ausdrücklich genannt.
- **Relevanz fürs Tool:** DSFA vor Inbetriebnahme; die aufsichtsbehördliche **Muss-Liste des jeweiligen Landes** (Art. 35 Abs. 4) ist heranzuziehen. Die DSFA ist auch ein starker Baustein für die AI-Act-Konformität.
- **Quelle:** https://dsgvo-gesetz.de/art-35-dsgvo/ · BfDI-Übersicht: https://www.bfdi.bund.de/DE/Fachthemen/Inhalte/Technik/Datenschutz-Folgenabschaetzungen.html · Beispiel Muss-Liste (öffentl. Bereich): https://www.lfd.niedersachsen.de/dsgvo/liste_von_verarbeitungsvorgangen_nach_art_35_abs_4_ds_gvo/muss-listen-zur-datenschutz-folgenabschatzung-179663.html

### Art. 15–18, 21 — Betroffenenrechte
- **Was gefordert wird:** Auskunft (15), Berichtigung (16), Löschung (17), Einschränkung (18), Widerspruch (21). Im Sozialrecht konkretisiert durch §§ 83 ff. SGB X.
- **Relevanz fürs Tool:** Der Assistent muss Betroffenenanfragen unterstützen können: welche Daten wurden verarbeitet, Korrekturmechanismus, Einschränkung. **Achtung Löschung:** Innerhalb der Aufbewahrungsfristen (Abschnitt 4) besteht i.d.R. **kein** Löschanspruch nach Art. 17 (Art. 17 Abs. 3 lit. b: rechtliche Aufbewahrungspflicht).
- **Quelle:** https://dsgvo-gesetz.de/art-15-dsgvo/ (Folgeartikel entsprechend art-16…art-21)

---

## 3. EU AI Act (VO (EU) 2024/1689)

### Einstufung: Anhang III Nr. 5 lit. a → Hochrisiko (Art. 6 Abs. 2)
- **Was gefordert wird:** Anhang III listet eigenständige Hochrisiko-Anwendungsbereiche. **Nr. 5 „Zugang zu und Inanspruchnahme grundlegender privater und öffentlicher Dienste und Leistungen"**, **lit. a:** KI-Systeme, die von Behörden oder in deren Auftrag genutzt werden, um zu **beurteilen, ob natürliche Personen Anspruch auf öffentliche Unterstützungsleistungen** haben, bzw. um solche Leistungen zu **gewähren, zu kürzen, zu widerrufen oder zurückzufordern**.
- **Einordnung:** Ein Wohngeld-Anspruchs-/Berechnungsassistent fällt seiner Funktion nach **grundsätzlich in genau diesen Bereich** → Hochrisiko-Verdacht.
- **Quelle:** https://ai-act-law.eu/de/anhang/3/ · https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3 · https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6

### Ausnahme Art. 6 Abs. 3 — die zentrale Weiche für „reine Assistenz"
- **Was gefordert wird:** Ein Anhang-III-System gilt **nicht** als Hochrisiko, wenn es **kein erhebliches Risiko** für Gesundheit, Sicherheit oder Grundrechte darstellt und das **Entscheidungsergebnis nicht wesentlich beeinflusst**. Konkret greift die Ausnahme, wenn das System (a) eine eng umgrenzte Verfahrensaufgabe erfüllt, (b) das Ergebnis einer bereits abgeschlossenen menschlichen Tätigkeit verbessert, (c) Entscheidungsmuster/Abweichungen erkennt, **ohne** die menschliche Bewertung zu ersetzen, oder (d) eine vorbereitende Aufgabe für eine Bewertung erfüllt.
- **Harte Grenze:** Die Ausnahme gilt **nie**, wenn das System **Profiling** natürlicher Personen vornimmt.
- **Nachweispflicht:** Wer sich auf die Ausnahme beruft, muss **vor Inbetriebnahme eine dokumentierte Bewertung** erstellen und diese der Marktaufsicht auf Verlangen vorlegen; das System ist zudem in der EU-Datenbank zu registrieren.
- **Einordnung fürs Tool:** Ein **echter Assistent** (schlägt vor, prüft Vollständigkeit, bereitet Berechnung vor; Mensch entscheidet und trägt Verantwortung, kein Profiling) hat gute Argumente für Art. 6 Abs. 3 lit. c/d. **Aber:** Sobald der Assistent faktisch die Entscheidung determiniert (Sachbearbeiter „nickt nur ab") oder Profiling betreibt, kippt die Einordnung zurück auf Hochrisiko. Die Ausnahme ist also **an dasselbe Human-in-the-Loop-Design gekoppelt wie Art. 22 DSGVO** — beide Regime belohnen dieselbe Governance.
- **Empfehlung:** Governance-Spec sollte die dokumentierte Art-6-Abs-3-Bewertung als Pflicht-Artefakt vorsehen — und die Hochrisiko-Pflichten (unten) **freiwillig/vorsorglich als Best Practice** übernehmen, da die Grenze im Einzelfall streitig sein kann.
- **Quelle:** https://datenschutz-grundverordnung.eu/ai-act/artikel-6-einstufungsvorschriften-fuer-hochrisiko-ki-systeme/ · https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6

### Pflichten bei Hochrisiko (Art. 8–15) — relevanteste im Überblick
- **Art. 9 Risikomanagement:** kontinuierlicher, dokumentierter Risikomanagement-Prozess über den Lebenszyklus. → Für die Spec: Risikoregister, Bewertung von Fehlklassifikations-/Diskriminierungsrisiken.
- **Art. 10 Daten-Governance:** Trainings-/Validierungs-/Testdaten müssen relevant, repräsentativ, möglichst fehlerfrei sein; Bias-Prüfung. → Relevant, wenn eigene Modelle/Regeln trainiert werden; bei reiner Regel-/Retrieval-Assistenz reduziert.
- **Art. 11 Technische Dokumentation:** vollständige technische Doku (Anhang IV) vor Inbetriebnahme. → Systembeschreibung, Zweck, Grenzen, Architektur.
- **Art. 12 Protokollierung/Logging:** automatische Aufzeichnung von Ereignissen über die Lebensdauer; Rückverfolgbarkeit sicherstellen. → **Deckt sich mit den Log-Pflichten aus DSGVO/SGB** (Abschnitt 6). Für Deployer besonders relevant.
- **Art. 13 Transparenz/Bereitstellung von Informationen an Betreiber:** hinreichend transparent, mit Gebrauchsanweisung, damit der Betreiber Ergebnisse interpretieren und angemessen nutzen kann. → Der Sachbearbeiter muss verstehen, wie Vorschläge zustande kommen.
- **Art. 14 Menschliche Aufsicht:** Hochrisiko-Systeme müssen so gestaltet sein, dass **wirksame menschliche Aufsicht** möglich ist (verstehen, überwachen, Ergebnis übergehen/„override", Stopp). → **Kern-Designprinzip**; identisch zur Human-in-the-Loop-Anforderung.
- **Art. 15 Genauigkeit, Robustheit, Cybersicherheit:** angemessenes Genauigkeitsniveau (deklariert), Robustheit, Schutz gegen Manipulation. → Metriken definieren, Monitoring, Absicherung gegen Prompt-/Dateneingriffe.
- **Quelle (Gesamttext):** https://ai-act-law.eu/de/ · Übersicht Hochrisiko-Pflichten: https://consulting.tuv.com/aktuelles/ki-im-fokus/hochrisiko-ki-anhang-iii

### Rollen: Anbieter vs. Betreiber (Deployer)
- Die **Kommune** ist i.d.R. **Betreiber (Deployer)**, der Plattform-/Toolanbieter ist **Anbieter (Provider)**. Betreiberpflichten (u.a. Art. 26) umfassen: Nutzung gemäß Gebrauchsanweisung, Sicherstellung menschlicher Aufsicht, Überwachung des Betriebs, Aufbewahrung der automatisch erzeugten Logs (Art. 26 Abs. 6). Für **Behörden als Betreiber** ist zusätzlich eine **Grundrechte-Folgenabschätzung (Art. 27)** vorgesehen.
- **Relevanz:** Die Governance-Spec muss Anbieter- und Betreiberpflichten sauber trennen und im Vertrag zuordnen (Schnittstelle zu § 80 SGB X / Art. 28 DSGVO).

### Geltungsbeginn / Fristen
- Grundverordnung in Kraft seit 1. August 2024; gestaffelte Anwendung (Art. 113): verbotene Praktiken + KI-Kompetenz seit Feb 2025, GPAI + Governance seit Aug 2025.
- **Wichtig:** Durch den **Digital Omnibus** (Kommissionsvorschlag 19.11.2025; als **VO (EU) 2026/1744** in Kraft) wurde der Geltungsbeginn der **Hochrisiko-Pflichten für eigenständige Anhang-III-Systeme** verschoben — an die Verfügbarkeit harmonisierter Normen gekoppelt, **spätestens 2. Dezember 2027** (Anhang I / in Produkte eingebettet: bis 2. August 2028). Transparenzpflichten (Art. 50) greifen unabhängig davon ab 2. August 2026.
- **Relevanz:** Es besteht ein **Umsetzungsfenster bis Ende 2027** — dieses jetzt für „Compliance by Design" nutzen; die Human-Oversight-/Logging-Anforderungen sind ohnehin schon aus DSGVO/SGB verbindlich.
- **Quelle:** https://consulting.tuv.com/aktuelles/ki-im-fokus/digital-omnibus-ki-verordnung-fristen · https://www.haufe.de/finance/steuern-finanzen/digital-omnibus-was-aendert-sich-an-der-ki-verordnung_190_691870.html · Fristenübersicht: https://www.provimedia.de/blog/eu-ai-act-fristen-2026-2027

> Hinweis: Der Digital-Omnibus-Fristenrahmen war 2026 in Bewegung; der finale Wortlaut/Zeitpunkt ist vor Produktivsetzung mit dem DSB und ggf. der zuständigen Marktaufsicht gegenzuprüfen.

---

## 4. Aufbewahrung / Löschung von Wohngeldakten

- **Was gefordert wird (Regelfall):** Wohngeldakten werden i.d.R. **10 Jahre** aufbewahrt, um Entscheidungen über rückwirkende Änderungen / bei Rechtswidrigkeit zu ermöglichen. Grundlage sind u.a. **§ 27 Abs. 4 S. 3 WoGG**, **§ 33 Abs. 2 S. 2 WoGG** und **§ 45 Abs. 3 S. 4 SGB X**. Der Fristlauf beginnt typischerweise am 1. Januar des Jahres, das auf die letzte Wohngeldbuchung folgt.
- **Sonderfall abgelehnte Anträge (ohne vorherigen Bezug):** häufig **2 Jahre**.
- **Löschung:** Innerhalb der Aufbewahrungsfristen besteht **kein Löschanspruch** nach Art. 17 DSGVO (rechtliche Aufbewahrungspflicht). Nach Ablauf: Löschung/Vernichtung bzw. Anbietung ans Archiv nach Landesrecht.
- **Landesrecht-Vorbehalt:** Die konkreten Fristen und das Verfahren richten sich nach der **Wohngeld-Verwaltungsvorschrift (WoGVwV)** und **landesrechtlichen Durchführungsvorschriften** (Beispiel Sachsen: VwV Durchführung Wohngeldverfahren). **→ Mit der jeweiligen Kommune / dem Land final zu klären.**
- **Relevanz fürs Tool:** Der Assistent (bzw. das umgebende Fachverfahren) muss Speicherfristen und automatisierte Lösch-/Sperrroutinen abbilden; KI-Nebenartefakte (Zwischenergebnisse, Prompts, Embeddings, Caches) unterliegen denselben Fristen bzw. sind früher zu löschen (Datenminimierung).
- **Quelle:** WoGVwV (Bund): https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_28062017_SWII4.htm · Beispiel Landes-VwV Sachsen: https://www.revosax.sachsen.de/vorschrift/10405-VwV-Durchfuehrung-Wohngeldverfahren · Datenschutzhinweise Berlin (10-Jahres-Praxis): https://www.berlin.de/ba-tempelhof-schoeneberg/politik-und-verwaltung/aemter/amt-fuer-buergerdienste/wohnungsamt/artikel.990045.php

---

## 5. Verwaltungsspezifische Governance-Anker

### OZG / Registermodernisierung
- **Was:** Das **Onlinezugangsgesetz (OZG 2.0)** (OZG-Änderungsgesetz, in Kraft 24.07.2024) treibt die Digitalisierung von Verwaltungsleistungen voran und verzahnt sie mit **Registermodernisierung** und digitalen Identitäten. Wohngeld ist eine OZG-Leistung.
- **Relevanz:** Der Assistent sollte anschlussfähig an OZG-Antragsstrecken/Fachverfahren sein; Datenaustausch mit Registern folgt dem Prinzip der Erforderlichkeit und dem Once-Only-Gedanken unter Beachtung des Sozialdatenschutzes.
- **Quelle:** https://www.digitale-verwaltung.de/Webs/DV/DE/onlinezugangsgesetz/das-gesetz/ozg-aenderungsgesetz/ozg-aenderungsgesetz-node.html

### IT-Grundschutz (BSI) als TOM-Referenz
- **Was:** Der **BSI IT-Grundschutz** ist der etablierte Referenzrahmen für TOM in der öffentlichen Verwaltung (konkretisiert Art. 32 DSGVO). Relevant u.a. Baustein **OPS.1.1.5 Protokollierung** und **DER.1 Detektion**; für Bundesbehörden gilt der **BSI-Mindeststandard zur Protokollierung und Detektion**.
- **Relevanz:** Die Sicherheits-/Logging-Architektur des Assistenten sollte sich an IT-Grundschutz-Bausteinen orientieren (nachweisbar, prüfbar).
- **Quelle:** OPS.1.1.5: https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2022/04_OPS_Betrieb/OPS_1_1_5_Protokollierung_Edition_2022.pdf · Mindeststandard Protokollierung: https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Mindeststandards/Mindeststandard_BSI_Protokollierung_und_Detektion_Version_2_0.pdf

### Barrierefreiheit (BITV 2.0 / EN 301549)
- **Was:** Öffentliche Stellen müssen digitale Angebote **barrierefrei** gestalten — **BITV 2.0** (auf Basis BGG), Konformität mit **EN 301549**.
- **Relevanz:** Die Sachbearbeiter-Oberfläche des Assistenten (und ggf. bürgerseitige Komponenten) müssen barrierefrei sein — ein Governance-/Beschaffungskriterium, kein reines UX-Thema.
- **Quelle:** https://www.gesetze-im-internet.de/bitv_2_0/BJNR184300011.html

---

## 6. Protokollierung konkret — revisionssicheres Verwaltungs-Audit-Log

Die Protokollierung ist die **Schnittmenge aller drei Regime**: § 35 SGB I (Zugriff nur Befugte, nachweisbar), Art. 5 Abs. 2 / Art. 32 DSGVO (Rechenschaft/Sicherheit), Art. 12 AI Act (automatische Aufzeichnung), BSI OPS.1.1.5.

### Mindestinhalt je Ereignis (Wer / Was / Wann / Woran / Vorher-Nachher)
- **Wer:** eindeutige Nutzeridentität (kein Sammel-/Funktionsaccount für fachliche Zugriffe), ggf. Rolle.
- **Was:** Aktionstyp (Lesen, Anlegen, Ändern, Löschen, Übermitteln, KI-Vorschlag erzeugt, Vorschlag übernommen/verworfen/geändert = „Override").
- **Wann:** manipulationssicherer Zeitstempel (synchronisierte Zeitquelle).
- **Woran:** betroffener Fall/Datensatz (Aktenzeichen / Betroffenen-ID), Datenkategorie.
- **Vorher-Nachher:** bei Änderungen der alte und neue Wert (Änderungshistorie), bei KI-Nutzung: welcher Vorschlag, welche Eingabedaten/Version, wurde er übernommen oder verändert (Beleg für Human-in-the-Loop / Art. 22 / Art. 14 AI Act).

### Zugriffsprotokolle auf Sozialdaten — auch Lesezugriffe
- **Ja:** Bei Sozialdaten sind **auch reine Lesezugriffe** zu protokollieren. Das folgt aus § 35 SGB I (Nachweis, dass nur Befugte zugegriffen haben) und der Rechenschaftspflicht. Das Protokoll muss nachträgliche Kontrolle unbefugter Einsichtnahme ermöglichen.

### Manipulationssicherheit / Revisionssicherheit
- Append-only / unveränderbare Speicherung (z.B. WORM, Hash-Verkettung/Signaturen), getrennte Rechte (Log-Admin ≠ Fachanwender), Schutz gegen Löschen/Nachträgliches Ändern.
- **Zweckbindung der Protokolldaten:** Logs dürfen nur zu Datenschutz-/Sicherheits-/Nachweiszwecken genutzt werden — **keine Leistungs-/Verhaltenskontrolle** der Beschäftigten (arbeits-/personalvertretungsrechtlich relevant; Personalrat einbinden).
- **Aufbewahrung/Löschung der Logs:** eigene, begrenzte Speicherfrist definieren (Erforderlichkeit vs. Datenminimierung), dann automatisiert löschen.
- **Quelle:** BSI OPS.1.1.5: https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2022/04_OPS_Betrieb/OPS_1_1_5_Protokollierung_Edition_2022.pdf · Protokollierungskonzept (Muster/Einführung): https://ztg-nrw.de/wp-content/uploads/2021/04/protokollierungskonzept_2020.pdf

---

## Konsolidierte Kernpflichten (Checkliste für die Governance-Spec)

1. **Rechtsgrundlage:** Verarbeitung auf Art. 6 Abs. 1 lit. e + WoGG/SGB stützen (keine Einwilligung nötig); Art-9-Daten über Art. 9 Abs. 2 lit. b/g + § 76 SGB X absichern.
2. **Keine automatisierte Entscheidung:** wirksame, ergebnisoffene menschliche Prüfung erzwingen (Art. 22 DSGVO, Art. 14 AI Act); Rubber-Stamping technisch/organisatorisch verhindern.
3. **AI-Act-Einordnung dokumentieren:** Art-6-Abs-3-Bewertung als Pflicht-Artefakt; **kein Profiling**; Hochrisiko-Pflichten (Art. 9–15) vorsorglich als Best Practice umsetzen; Umsetzungsfenster bis spätestens 02.12.2027.
4. **DSFA (Art. 35)** vor Produktivsetzung, Muss-Liste des Landes prüfen; ggf. Grundrechte-Folgenabschätzung (Art. 27 AI Act) als Behörde.
5. **Auftragsverarbeitung:** AV-Vertrag Art. 28 DSGVO **+ § 80 SGB X**-Zusätze; Zweckbindung „wandert mit" (§ 78 SGB X); Sub-Prozessoren/LLM-Provider streng prüfen; keine Art-9-Daten in externe Klartext-Kontexte.
6. **Zugriff/Least Privilege:** nur Befugte (§ 35 SGB I), rollenbasiert, Mandanten-/Falltrennung.
7. **Revisionssicheres Audit-Log:** Wer/Was/Wann/Woran/Vorher-Nachher, **inkl. Lesezugriffen**, manipulationssicher, zweckgebunden (keine Mitarbeiterkontrolle).
8. **TOM nach Art. 32 / BSI IT-Grundschutz** (OPS.1.1.5, DER.1); Verschlüsselung, Detektion.
9. **Aufbewahrung/Löschung:** Wohngeldakten regelmäßig 10 Jahre (abgelehnt ohne Bezug ~2 Jahre); kein Art-17-Löschanspruch während der Frist; KI-Nebenartefakte minimieren/früh löschen — **finale Fristen mit Kommune/Land klären**.
10. **Transparenz & Betroffenenrechte:** Art. 13 AI Act (Gebrauchsanweisung/Erklärbarkeit für Sachbearbeiter), Art. 15–18/21 DSGVO / §§ 83 ff. SGB X unterstützen.
11. **Barrierefreiheit:** BITV 2.0 / EN 301549 für alle Oberflächen.

## Wichtigste Primärquellen
- SGB I § 35: https://www.gesetze-im-internet.de/sgb_1/__35.html
- SGB X §§ 76 / 78 / 80: https://dejure.org/gesetze/SGB_X/76.html · https://dejure.org/gesetze/SGB_X/78.html · https://dejure.org/gesetze/SGB_X/80.html
- DSGVO Art. 5 / 6 / 9 / 22 / 30 / 32 / 35: https://dsgvo-gesetz.de/ (Artikel-Slugs art-5…art-35)
- AI Act Art. 6 + Anhang III: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6 · https://ai-act-law.eu/de/anhang/3/
- Digital Omnibus (Fristen): https://consulting.tuv.com/aktuelles/ki-im-fokus/digital-omnibus-ki-verordnung-fristen
- WoGVwV (Aufbewahrung): https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_28062017_SWII4.htm
- BSI OPS.1.1.5 Protokollierung: https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2022/04_OPS_Betrieb/OPS_1_1_5_Protokollierung_Edition_2022.pdf
- BITV 2.0: https://www.gesetze-im-internet.de/bitv_2_0/BJNR184300011.html

*Abrufdatum aller Quellen: 2026-09-19.*
