# WZ-Branchen-Matcher — Briefing zu euren Rückmeldungen

**An:** Leitung Stammdatenpflege
**Datum:** 17.09.2026
**Betreff:** Umgesetzte Verbesserungen und Rückfragen zu einem Sonderfall

---

## 1. Zusammenfassung

Eure beiden Rückmeldungen zum WZ-Branchen-Matcher haben wir zum Anlass für eine gründliche Überarbeitung genommen. Beide gemeldeten Punkte sind behoben; darüber hinaus haben wir die Treffgenauigkeit und die Bedienung spürbar verbessert. Die Änderungen sind fertiggestellt und werden mit dem nächsten Update auf eurer Umgebung eingespielt.

Ein von euch angesprochener Sonderfall — sehr ausführliche Unternehmensgegenstände wie das Geothermie-Beispiel — ist teilweise gelöst; hier stoßen wir an eine Grenze der amtlichen Systematik selbst und bitten dich um eine fachliche Einschätzung (Fragen in Abschnitt 5).

---

## 2. Eure Rückmeldungen — was sich ändert

### 2.1 Verschlüsselungstiefe („Abbruch" ergab 4311 statt 43110)

Der Matcher gibt jetzt **immer mindestens die amtliche Verschlüsselungsebene (5-stellige Unterklasse)** aus. Die Wahl zwischen einer Klasse und ihrer gleichnamigen Unterklasse (43.11 / 43.11.0) trifft das System nicht mehr fallweise, sondern regelhaft — 4-stellige Ausgaben dieser Art sind damit abgestellt.

Zugleich haben wir die **Gegenrichtung** korrigiert, die in euren bisherigen Anfragen sogar häufiger vorkam: Das System wählte bei allgemeinen Angaben teils zu spezifische nationale Feinschlüssel (z. B. „Abbrucharbeiten" → 43.11.02 „Demontage von Industrieanlagen"). Feinschlüssel werden jetzt nur noch vergeben, wenn die Tätigkeitsbeschreibung die Spezialisierung ausdrücklich benennt (z. B. „Reifendienst" → 95.31.31); andernfalls bleibt es bei der Unterklasse.

### 2.2 Begriffserkennung („persönlich haftender Gesellschafter" ≠ „Komplementär")

Wir haben das **amtliche Stichwortverzeichnis zur WZ 2025** (über 36.000 Zuordnungen des Statistischen Bundesamts) in die Suche integriert. Umschreibungen, Rechtsbegriffe und produktspezifische Formulierungen finden ihren Schlüssel damit auch dann, wenn der Wortlaut vom Klassifikationstext abweicht — der gemeldete Fall funktioniert jetzt.

Fachlicher Hinweis dazu aus dem Stichwortverzeichnis, der für eure Pflegepraxis interessant sein dürfte: Das Statistische Bundesamt unterscheidet bei Komplementärgesellschaften nach Funktion — reine Haftungsfunktion → **69.10.3**, mit Verwaltung und Führung des Unternehmens → **70.10.4**. Der Matcher akzeptiert beide Lesarten und begründet seine Wahl.

---

## 3. Weitere Verbesserungen im Überblick

- **Treffgenauigkeit:** Wir messen die Qualität jetzt laufend gegen eine Prüfmenge aus amtlichen Stichwörtern. Nach der Überarbeitung steht der zutreffende Schlüssel in rund **9 von 10 Fällen unter den angezeigten Vorschlägen** (vorher rund 6 von 10); auch der erstgenannte Vorschlag trifft deutlich häufiger exakt die richtige Unterklasse.
- **Handelsformen:** Einzelhandel, Großhandel, Handelsvermittlung und Herstellung werden strikter auseinandergehalten — eine Einzelhandelstätigkeit erhält keinen Großhandelsschlüssel mehr, nur weil die Ware übereinstimmt.
- **Mehrere Wirtschaftsformen, mehrere Schlüssel:** „Produktion von Spielwaren und Handel mit Spielwaren" wird jetzt als zwei getrennte Tätigkeiten erkannt und einzeln verschlüsselt — vorher wurde das zu einer Tätigkeit zusammengefasst.
- **Verlässlichkeit:** Dieselbe Eingabe liefert jetzt garantiert dasselbe Ergebnis. Wiederholte Anfragen zu einem bereits geprüften Text werden ohne Wartezeit beantwortet und als **„aus früherem Lauf"** gekennzeichnet.
- **Neu ermitteln:** Sollte ein gespeichertes Ergebnis einmal nicht überzeugen, kann der Sachbearbeiter es direkt neben dieser Kennzeichnung per Klick **neu ermitteln lassen** — das neue Ergebnis ersetzt dann das gespeicherte. Ein einmal danebengegangener Vorschlag bleibt also nicht „festgefroren".
- **Bedienung bei längeren Texten:** Bei ausführlichen Gegenstandstexten zeigt der Matcher die erkannten Tätigkeiten sofort an, während die Schlüsselermittlung noch läuft — du siehst nach etwa zwei Sekunden, wie das System den Text gegliedert hat. Störungen der Verarbeitung führen nicht mehr zu minutenlangen Wartezeiten, sondern zu einer schnellen Fehlermeldung.

---

## 4. Der Sonderfall: sehr ausführliche Gegenstandstexte (Geothermie-Beispiel)

**Der Fall:** Ein Unternehmensgegenstand beschreibt auf ca. 1.500 Zeichen die „Planung, Koordination, Beauftragung, Durchführung und Verwaltung von Maßnahmen zur Erkundung und Aufsuchung geothermischer Ressourcen, insbesondere im Bereich der Tiefengeothermie", gefolgt von acht Unterpunkten (bergrechtliche Berechtigungen, Betriebsplanverfahren, geologische/seismische Untersuchungen, Fördermittel, Datenverwertung, Grundstücksrechte, Kooperationen).

**Was der Matcher heute daraus macht:** Er erkennt inzwischen zuverlässig, dass es sich um **eine** Haupttätigkeit handelt (Erkundung geothermischer Ressourcen) und dass die Unterpunkte rechtliche Facetten davon sind — das war ein Teil eurer Beobachtung und ist gelöst. Bei der Schlüsselwahl schlägt er jedoch **09.10.0 „Erbringung von Dienstleistungen für die Gewinnung von Erdöl und Erdgas"** vor: die richtige Tätigkeitsart (Aufsuchungsdienstleistung), aber der falsche Rohstoff.

**Warum das kein einfacher Fehler ist:** Die amtliche Systematik weist für die Aufsuchung geothermischer Ressourcen keinen eindeutigen Schlüssel aus. Das einzige amtliche Stichwort mit Geothermie-Bezug („Bohrarbeiten für Geothermieanlagen") verweist auf **42.21.0** (Bautätigkeit). Fachlich vertretbar erscheinen uns je nach Lesart:

| Schlüssel | Lesart |
|---|---|
| 43.13.0 Test- und Suchbohrung | die konkrete Erkundungstätigkeit |
| 09.90.0 DL für den sonstigen Bergbau | Aufsuchungsdienstleistung außerhalb Erdöl/Erdgas |
| 42.21.0 Rohrleitungstiefbau/Brunnenbau | per amtlichem Stichwort für Geothermie-Bohrungen |
| 35.30.0 Wärme- und Kälteversorgung | im Hinblick auf die spätere Energiegewinnung |

Wir können den Matcher auf jede dieser Lesarten ausrichten — aber die Entscheidung, welche für eure Stammdatenpflege die richtige ist, ist eine fachliche, keine technische.

---

## 5. Unsere Fragen an dich

1. **Geothermie-Fall konkret:** Welchen Schlüssel vergibt eure Stammdatenpflege für den beschriebenen Fall (Erkundung/Aufsuchung geothermischer Ressourcen, noch keine Gewinnung)?
2. **Grundsatz Haupt- und Nebentätigkeit:** Sollen bei ausführlichen Gegenstandstexten mit rechtlichen Nebenpunkten (Rechteverwaltung, Fördermittelabwicklung, Kooperationen) ausschließlich die wirtschaftliche Haupttätigkeit verschlüsselt werden — oder wünscht ihr Nebenpunkte als separate Schlüssel?
3. **Anzahl der Vorschläge:** Der Matcher liefert heute bis zu drei Tätigkeiten je Eingabe mit jeweils einem Hauptvorschlag und Alternativen. Passt dieser Zuschnitt zu eurem Pflegeprozess?
4. **Prüffälle:** Könntet ihr uns 10–20 typische Fälle aus eurer Praxis mit dem von euch vergebenen Soll-Schlüssel bereitstellen? Damit können wir die Qualität künftig direkt an eurem Maßstab messen statt nur an der amtlichen Stichwortliste.
5. **Rückmelde-Funktion:** Uns fällt auf, dass eure Sachbearbeiter dem Matcher häufig den erwarteten Schlüssel bereits mitgeben („43110 Abbrucharbeiten, …"). Wäre eine Funktion hilfreich, mit der der vorgeschlagene Schlüssel direkt bestätigt oder korrigiert werden kann? Eure Korrekturen würden die Trefferqualität dann fortlaufend verbessern.
6. **Herstellung mit Vertrieb:** Nach WZ-Grundsatz gehört der Vertrieb *eigener* Erzeugnisse zur Herstellung; nur der Handel mit Fremdware ist ein eigener Zweig — dem Gegenstandstext ist das aber meist nicht anzusehen. Der Matcher weist bei „Herstellung und Handel mit X" deshalb bewusst beide Tätigkeiten aus und überlässt die Entscheidung eurer Sachbearbeitung. Passt das so, oder wünscht ihr eine andere Behandlung (z. B. Handel nur bei erkennbarem Fremdwarenhandel)?

---

## 6. Nächste Schritte

Die beschriebenen Verbesserungen spielen wir mit dem nächsten Update ein und gleichen die Wirkung anschließend anhand der tatsächlichen Nutzung mit euch ab. Für den Geothermie-Fall und die Grundsatzfragen freuen wir uns über deine Einschätzung — gern auch in einem kurzen gemeinsamen Termin.
