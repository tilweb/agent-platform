# Konzept: Document Processing als Produkt — Eingangsmodell, Dokumenten-Pipelines, Abrechnung (2026-10-09)

Status: Grundsatzentscheidungen getroffen (§7); **§6 Punkte 1–6 umgesetzt am 2026-10-09** (Spezifikation `docs/dp-produktmodell-umsetzung-spec-2026-10-09.md`).
Bezug: Strategien und Funktionen im Code (Stand 2026-10-08), Vertragsextraktion
(`docs/vertragsextraktion-messung-2026-10-08.md`), DP-Dienst-Konzept (`docs/konzept-document-processing-dienst-2026-09-25.md`).

---

## 1. Ausgangslage

- DP wird überwiegend **programmatisch über die API** genutzt. Die Oberfläche dient dem Einrichten, Anlernen und
  Testen von Profilen.
- Heute gibt es zwei Eingangswege: **mit Profil** (`extract`, `batch.create` mit `project_id`) und **ohne Profil**
  über den Posteingang (nur Oberfläche: Trennen → je Teil Profil zuordnen → je Profil ein Lauf).
- Der Posteingang behandelt jede Datei als **Stapel unabhängiger Dokumente**. Ein Test mit einem 7-seitigen
  Wartungsvertrag (Deckblatt, Paragraphen, Unterschriftsseite, Anlage, SEPA-Mandat) ergab 5 Teile, alle mit 95–100 %
  dem Vertragsprofil zugeordnet → 5 bruchstückhafte Vertragsauswertungen mit falschen Befunden („Unterschrift fehlt",
  „Anlage fehlt") zum fünffachen Aufwand. Ursache: Die Trennung schneidet an jedem funktionalen Seitenwechsel (ihr
  Prompt verlangt das für Anlagen und Unterschriftsblätter), und die Zuordnung kennt nur ganze Profile.

## 2. Leitgedanke: Der Vorgang ist der Normalfall

Was ankommt, ist in der Regel **ein Geschäftsvorfall in unbekannter Zusammensetzung**: ein Vertrag mit oder ohne
Anlagen und Mandat, ein Wohngeldantrag mit beliebigen Nachweisen, ein Lieferschein mit Folgeseiten. Die Zusammensetzung
zu verstehen ist Aufgabe der **Dokumenten-Pipeline** (des Profils), nicht des Eingangs.

| Begriff | Bedeutung |
|---|---|
| **Dokumenten-Pipeline** | Ein Profil für eine Art von Vorgang. Es weiß, welche Bestandteile vorkommen können, erkennt sie (Segmente, Seitenrollen) und wertet sie zusammen aus. Beispiele: Wohngeld-Eingang (Segmentprofil), Vertrag (`contract-structured`), Lieferschein. |
| **Vorgang** (Standard) | Ein Upload = ein Geschäftsvorfall → **ein** Ergebnis. Es wird nie in unabhängige Dokumente zerschnitten. |
| **Stapel** (nur ausdrücklich) | Ein Upload enthält mehrere unabhängige Vorgänge (zentrale Poststelle) → Trennen und je Teil eine Pipeline. |

## 3. Eingangsmodell der API

1. **Mit Pipeline** (`profil` gesetzt) — die Pipeline entscheidet alles; heutiger Hauptweg.
2. **Ohne Pipeline, Vorgang** (Standard): Zuordnung des **ganzen** Uploads zu einer Pipeline (anhand der ersten
   Seite(n)), keine Trennung.
3. **Ohne Pipeline, Stapel** (`modus: "stapel"`): Trennen, dann je Teil Zuordnung zu einer Pipeline.
4. **Keine passende Pipeline** (Sicherheit unter Schwelle): Auswertung mit dem eingebauten **Basisprofil
   „Allgemein"** — nie Zwangszuordnung zur wahrscheinlichsten Pipeline.

**Antwort immer als Umschlag je Upload** — eine ID, ein Webhook, ein Ergebnis, auch wenn intern mehrere Pipelines laufen:

```
{ upload_id, modus: "vorgang" | "stapel",
  teile: [ { seiten: "1–7", profil: "vertrag-end", zuordnung: { sicherheit: 0.97, kandidaten: [...] },
             status: "fertig" | "kein_profil" | "zu_pruefen", ergebnis: { ... } } ],
  seiten_gesamt, abrechnung: [ { produkt, seiten } ] }
```

Im Vorgangsmodus hat der Umschlag genau einen Teil. Der Umschlag ist zugleich die Abrechnungseinheit (§5).

## 4. Basisprofil „Allgemein"

Eingebaut, nicht löschbar; fängt alles auf, wofür keine Pipeline passt.

- **Volltext als Markdown je Seite über das Bild** (Transkription aus `contract-structured`: Tabellen, Handschrift,
  Streichungen, Unterschriften, Stempel, Briefbogen getrennt) — Ersatz für Docling/Markitdown, auch für Scans.
- **Gliederung** (Überschriften/Abschnitte, Seitenrollen).
- **Universelle Kernwerte**: Dokumentart (frei), Absender, Empfänger, Datum, Betreff, Referenznummern.
- **Status `kein_profil`** mit den besten Kandidaten-Pipelines und ihrer Sicherheit.

Nutzen: sofort verwertbares Ergebnis (Archiv, Suche, manuelle Bearbeitung); die gesammelten `kein_profil`-Fälle zeigen,
welche Pipeline als Nächstes fehlt. Abgerechnet wird es wie „Standard".

## 5. Produktkatalog und Abrechnung

**Gezählt wird immer die Seite** (PDF-Seite bzw. Bild). Jedes Produkt hat einen eigenen **Preis je Seite**. Der
Aufwand je Produkt fließt intern als **Kostenfaktor** ein (Basis: eine Seite Bildauslese = 1,0) und dient der
Preisfindung — er wird dem Kunden nicht als Einheit gezeigt.

| Produkt (Kundensicht) | Inhalt | Strategie im Code | Kostenfaktor (intern) |
|---|---|---|---|
| Formular (digital) | feste Formulare mit Textlayer, ohne KI | `template-labelmap` | 0,1 |
| Text | digitale PDFs | `single-pass`, `long-text-chunked` | 0,3 |
| Standard | Scans, Fotos, Handschrift, gemischt; auch Basisprofil „Allgemein" | `hybrid`, `vision-per-page`, Allgemein | 1,0 |
| Vorgang (mehrteilig) | Bestandteile erkennen und je Bestandteil auslesen | Segmentprofil | 1,5 |
| Vertrag | Klauselstruktur, Katalog, Pflichten & Fristen, Befunde | `contract-structured` | 3,0 |
| Stapel-Trennung (Zusatz) | nur im Modus „Stapel": Trennen + Zuordnen je Teil | Posteingang | 1,0 |
| Transkript (Zusatz) | vollständiger Seitentext zu einem anderen Produkt (Profil-Schalter, §12) | Lesekern `contract/lesen.ts` | 1,0 |

- Die Zuordnung ohne Pipeline im Vorgangsmodus (ein Aufruf auf die ersten Seiten) ist im Preis enthalten.
- **Ohne Berechnung**: Profilpflege, Prüfoberfläche, Korrekturen übernehmen, Exporte, Status-Abfragen, Webhooks,
  Seitenvorschau.
- **Einmalig/Zusatz**: Profilentwurf aus Beispieldokument (Pauschale), Qualitätsmessung (Evaluation, reduzierter
  Seitenpreis), Profileinrichtung mit Begleitung (Dienstleistung).
- **Zählregeln**: Wiederholungen wegen eines Fehlers auf unserer Seite (Modell nicht erreichbar, Seite nicht lesbar)
  sind kostenfrei; vom Kunden ausgelöste Neuverarbeitung zählt erneut. Als Leerseite erkannte Seiten zählen nur für
  Trennen/Klassifizieren.

**Vorbehalt Kostenfaktoren:** Die Aufrufzahlen je Seite sind gemessen, der Tokenverbrauch nicht (der LLM-Adapter gibt
ihn heute nicht zurück). Insbesondere „Vertrag" (3,0) ist aus dem Aufrufmuster geschätzt. Vor der Preisfestlegung je
Produkt Tokens auf den Golden Datasets messen (Wohngeld, Verträge, Grundsteuer).

## 6. Was sich im Code ändern müsste (Reihenfolge nach Nutzen)

1. **Eingangsmodus statt „Trennen"-Häkchen**: Posteingang/API mit `modus` (Standard „vorgang"); im Vorgangsmodus
   ganze Datei einer Pipeline zuordnen, keine Trennung. Löst den Vertrags-Fall vollständig.
2. **Umschlag-Ergebnis** in der öffentlichen API: `extract` ohne `project_id` (Zuordnung), Antwort und Webhook je Upload.
3. **Basisprofil „Allgemein"** auf Basis der Vertrags-Transkription (P2 + Strukturbaum) plus Kernwerte.
4. **Messung je Upload** (Seiten × Produkt, Pipeline, Mandant) als Abrechnungsgrundlage; Tokenverbrauch aus dem Adapter.
5. **Robustheit Stapel-Trennung**: ein gescheitertes Grenzurteil bricht heute den ganzen Upload ab → Wiederholung bzw.
   Grenze als „unklar" zur Prüfung.
6. **Später: Segmenttypen, die auf bestehende Pipelines verweisen** („Wareneingang" = Lieferschein-Pipeline +
   Rechnungs-Pipeline), damit Kunden Pipelines einmal pflegen und als Bausteine kombinieren.

## 7. Entscheidungen (2026-10-08/09)

| Frage | Entscheidung |
|---|---|
| Hauptnutzung | API; Oberfläche zum Einrichten, Anlernen, Testen |
| Standard-Eingang ohne Profil | **Vorgang** (ein Upload = ein Geschäftsvorfall); Stapel nur ausdrücklich |
| Ausrichtung | spezifische Dokumenten-Pipelines, die unbekannte Zusammensetzung selbst verstehen (Verträge, Lieferscheine, Wohngeld) |
| Kein passendes Profil | Basisprofil „Allgemein" (Vollextrakt + Kernwerte + Kandidaten), abgerechnet wie Standard |
| Abrechnung | jede Seite zählt als Seite; Preis je Seite je Produkt; Multiplikator nur als interner Kostenfaktor |

## 8. Offen

- Preise je Produkt — Vorschlag mit Rabatten, Grundgebühr und Einmalleistungen in §11 (Grundlage §10/§10a).
- EUR-Preise je Produkt (nach Tokenmessung).
- Grundgebühr mit Inklusivseiten oder reine Nutzung; Abrechnung je Mandant/Instanz oder je Pipeline.
- Schwelle für die Zuordnung ohne Pipeline (heute 0,8) und Verhalten knapp darunter („zu_pruefen" vs. „Allgemein").

## 9. Erste Verbrauchsmessung (2026-10-09, E2E)

| Fall | Produkt | Seiten | Aufrufe | Prompt-Tokens | Completion-Tokens | je Seite (Prompt / Completion) |
|---|---|---|---|---|---|---|
| Wartungsvertrag | Vertrag | 7 | 12 | 51.334 | 15.499 | 7.300 / 2.200 |
| Zusatzvereinbarung | Vertrag | 2 | 6 | 18.564 | 6.044 | 9.300 / 3.000 |
| Bieterfragen (kein Profil) | Standard (Allgemein) | 3 | 4 | 19.418 | 3.578 | 6.500 / 1.200 |

Erster Befund: Vertrag liegt je Seite nur rund 1,4–1,9× über „Allgemein" (bei Completion-Tokens ×4 gewichtet), nicht
3×. Der geschätzte Kostenfaktor 3,0 ist vermutlich zu hoch. Vor der Preisfestlegung je Produkt auf den Golden Datasets
messen — die Messung liegt jetzt in jedem `audit.verbrauch`.

## 10. Marktvergleich Reducto und vorgeschlagene Preisrelationen (2026-10-09)

Quelle: öffentliche Preisseite reducto.ai/pricing (Stand 2026-10-09, Tarif „Standard", USD je 1.000 Seiten). Normiert auf
„Extract = 1,0" (entspricht unserem „Standard").

| Reducto-Leistung | $ / 1.000 S. | relativ |
|---|---|---|
| Parse (Text + Layout) | 10 | 0,5 |
| Extract (Felder, Parse inklusive) | 20 | 1,0 |
| Deep Extract | 40 | 2,0 |
| Split (Parse inklusive) / Deep Split | 20 / 40 | 1,0 / 2,0 |
| Classify (nur die ersten 5 Seiten zählen) | 7,50 | 0,375 je Seite, faktisch je Dokument |
| Edit (Formulare ausfüllen) / vorbefüllt | 60 / 15 | 3,0 / 0,75 |
| Add-ons: OCR-Daten / eigene Regionen | 2 / 5 | 0,1 / 0,25 |
| Batch-Verarbeitung | −20 % auf Parse und Extract | |

| Unser Produkt | Kostenfaktor (intern) | Reducto-Pendant | Reducto-Relation | Einordnung |
|---|---|---|---|---|
| Formular (digital, ohne KI) | 0,1 | – (Parse 0,5 als Untergrenze) | – | günstiger als alles bei Reducto — Alleinstellung |
| Text (digitale PDFs) | 0,3 | Extract (keine Unterscheidung digital/Scan) | 1,0 | wir geben den Kostenvorteil weiter |
| Standard (Scan, Bildauslese) | 1,0 | Extract | 1,0 | deckungsgleich |
| Basisprofil „Allgemein" | 1,0 (abgerechnet) | Parse | 0,5 | wir wären doppelt so teuer |
| Vorgang (Segmente) | 1,5 | Classify + Extract ≈ 1,4 bzw. Split + Extract = 2,0 | 1,4–2,0 | passt |
| Vertrag | 3,0 (gemessen ~1,5–1,9) | Deep Extract | 2,0 | Schätzung zu hoch |
| Stapel-Trennung | 1,0 | Split | 1,0 | deckungsgleich |
| Zuordnung im Vorgangsmodus | inklusive | Classify (je Dokument) | 0,375 | wir schließen sie ein |

**Erkenntnisse**
1. Reducto bepreist **Funktionen** (Parse/Extract/Split/Classify) mit einer Aufpreis-Stufe („Deep" = ×2); wir bepreisen
   **Pipelines** (fachliche Ergebnisse). Beides ist verständlich, solange es wenige Stufen gibt.
2. **Kostenfaktor ≠ Preisrelation**: Reducto verlangt für Extract das Doppelte von Parse, obwohl der Rechenaufwand kaum
   abweicht — der Preis folgt dem Nutzen. Unsere internen Faktoren bleiben Kosten; die Kundenpreise orientieren sich, wo
   sinnvoll, am Markt.
3. **Classify je Dokument** (erste 5 Seiten) ist ein sinnvolles Modell, falls die Zuordnung einmal berechnet werden soll.
4. **Batch-Rabatt** (−20 % für asynchrone Verarbeitung) passt zu unserem Modell — Batch und Posteingang laufen in der
   Warteschlange und sind lastarm planbar.

**Vorgeschlagene Preisrelationen (Kundensicht, Standard = 1,0)** — Entscheidung offen:

| Produkt | Preisrelation | bisher |
|---|---|---|
| Formular (digital) | 0,1–0,25 | 0,1 |
| Text (digital) | 0,5 | 0,3 |
| Basisprofil „Allgemein" | **0,5** | 1,0 |
| Standard | 1,0 | 1,0 |
| Vorgang (mehrteilig) | 1,5 | 1,5 |
| Vertrag | **2,0** | 3,0 |
| Stapel-Trennung | 1,0 | 1,0 |
| Batch/asynchron | optional −20 % | – |

Fünf Preisstufen (0,1 / 0,5 / 1,0 / 1,5 / 2,0) decken den Katalog ab. Interne Kostenfaktoren unverändert, außer
„Vertrag": auf den gemessenen Bereich (~1,5–1,9) senken, sobald weitere Verträge gemessen sind.

**Vorbehalte**: Preisseite automatisiert gelesen; Absolutpreise (Reducto Extract 0,02 $/Seite) erst vergleichbar,
wenn der Adacor-Tokenpreis feststeht — Tokens je Seite stehen jetzt in jedem `audit.verbrauch`
(Vertrag ~7.300 Prompt / ~2.200 Completion je Seite).

### 10a. Erweiterter Marktvergleich: Azure Document Intelligence und Mistral OCR (2026-10-09)

USD je 1.000 Seiten, Standardpreise ohne Commitment-Rabatte. **Azure-Werte aus Microsoft-Q&A-Antworten** (die
offizielle Preisseite lädt die Preise dynamisch und war automatisiert nicht lesbar) — vor Verwendung im Azure-
Preisrechner prüfen. Unser Modellaufwand zum eigenen API-Preis Qwen 3.5 (0,21 € In / 0,85 € Out je 1 Mio. Tokens),
ohne Compute.

| Funktion | Reducto | Azure Document Intelligence | Mistral | Unser Modellaufwand (€/1.000 S.) |
|---|---|---|---|---|
| OCR / Volltext | Parse 10 | Read 1,50; Layout (Tabellen, Kästchen) 10 | OCR 4: 4 (Batch 2); OCR 3: 2 (Batch 1) | Allgemein 2,40 (inkl. Kernwerte, gemessen) |
| Fertige Feldauslese (Rechnung, Ausweis …) | Extract 20 | Prebuilt 10 | Document AI 5 | Standard ~1,50 (geschätzt) |
| Eigene Felder (eigenes Schema) | Extract 20 / Deep 40 | Custom Extraction 30 (braucht Trainingsdokumente) | Document AI 5 (JSON-Schema, ohne Training) | Standard ~1,50 (geschätzt) |
| Klassifikation / Zuordnung | Classify 7,50 (erste 5 Seiten) | Custom Classification (Preis nicht verifiziert) | – | inklusive |
| Stapel trennen | Split 20 / Deep 40 | über den Klassifikator | – | ~1,10 (geschätzt) |
| Vertrag | Deep Extract 40 | Prebuilt „Contract" 10 (Parteien, Daten, Gerichtsstand — keine Pflichten) | Document AI 5 (nur Schema) | 3,40–4,50 (gemessen) |
| Batch-Rabatt | −20 % | eigene Batch-Preise | −50 % | – |

**Einordnung**
1. **Drei Preisbänder**: Commodity-OCR 1,50–4 $ (Azure Read, Mistral OCR) · Extraktion mit Schema 5–30 $ (Mistral
   Document AI unten, Azure Prebuilt/Custom Mitte, Reducto Extract oben) · Premium/„Deep" ~40 $ (Reducto).
2. **Mistral setzt die Untergrenze** — OCR + eigenes JSON-Schema für 5 $ liegt nahe am Modellpreis. Unser Modellaufwand
   für Standard/Allgemein (1,50–2,40 €) liegt im selben Band: Als reine **Bausteine** (Volltext, einfache Felder) sind
   kaum mehr als 5–10 $ durchsetzbar.
3. **Azure verlangt für Anpassung das Dreifache** (Prebuilt 10 → Custom 30 $) und braucht dafür Trainingsdokumente; wir
   decken das mit Profilen und Lern-Loop ohne Training ab — Argument für uns.
4. **Azure „Contract" ist der direkteste Vergleich zum Vertragskatalog** — aber nur Stammdaten. Pflichten, Fristen mit
   Fundstelle, Gültigkeit und Befunde bieten weder Azure noch Mistral; preislich nah ist nur Reducto Deep (40 $).
5. **Positionierung**: Bausteine (Volltext, Standardfelder, Trennen) müssen gegen Mistral/Azure (5–20 $) bestehen —
   Vorteile Datensouveränität (Adacor, EU, keine Weitergabe an Dritte), deutsche Dokumente, Prüfoberfläche. Pipelines
   mit fachlicher Substanz (Vertrag, Vorgänge wie Wohngeld) haben keinen direkten Funktions-Wettbewerber; Bezugspunkt
   Reducto Deep (40 $) oder darüber. Marge in beiden Fällen groß (Modellaufwand 1,10–4,50 €/1.000 Seiten).
6. **Batch-Rabatt** ist Marktstandard (Mistral −50 %, Reducto −20 %) und passt zur Warteschlange.

Die Benennung der Produkte bleibt bewusst breit (kein Eingrenzen auf Branchen); konkrete Anwendungsbeispiele gehören ins
Marketing. Die Preisbänder sind Einordnung, keine Entscheidung.

**Quellen**: reducto.ai/pricing · azure.microsoft.com/en-us/pricing/details/document-intelligence/ · Microsoft-Q&A-Antworten
zu Document-Intelligence-Preisen (learn.microsoft.com/en-us/answers/…) · mistral.ai/news/ocr-4/ · mistral.ai/news/mistral-ocr-3/ ·
mistral.ai/pricing/api/ (abgerufen 2026-10-09).

**Korrektur zu §9**: Der Vergleich „Vertrag ~1,4–1,9×" bezog sich auf „Allgemein", nicht auf „Standard". In Euro
(Out-Tokens 4× teurer) liegt Vertrag bei ~2,3–3,0× Standard, „Allgemein" bei ~1,6× — der Kostenfaktor 3,0 für Vertrag
ist damit plausibel.

## 11. Preisvorschlag (Vorschlag, nicht entschieden — 2026-10-09)

Listenpreise in Euro netto je 1.000 Seiten, interaktive Verarbeitung. Verankert an den Marktbändern (§10/§10a), mit
Sicherheitsabstand zum gemessenen bzw. geschätzten Modellaufwand (eigener API-Preis Qwen 3.5), fünf bis sechs Stufen.

| Produkt | € / 1.000 S. | € je Seite | Marktvergleich | Modellaufwand € / 1.000 S. | Marge vor Compute |
|---|---|---|---|---|---|
| Formular (digital) | **4** | 0,004 | Azure Read 1,50 $ (nur Text, keine Felder) | ~0 | ~95 % |
| Text (digitale PDFs) | **8** | 0,008 | Mistral Document AI 5 $, Azure Prebuilt 10 $ | ~0,50 (geschätzt) | ~90 % |
| Allgemein (Volltext + Kernwerte) | **8** | 0,008 | Mistral OCR 4 $, Azure Layout / Reducto Parse 10 $ | 2,40 (gemessen) | ~70 % |
| Standard (Scans, eigene Felder) | **15** | 0,015 | Azure Prebuilt 10 $ – Custom 30 $, Reducto 20 $ | ~1,50 (geschätzt) | ~90 % |
| Vorgang (mehrteilig) | **25** | 0,025 | Reducto Classify + Extract ~27,50 $ | ~2,40 (geschätzt) | ~90 % |
| Vertrag | **50** | 0,05 | Reducto Deep Extract 40 $ (ohne vergleichbare Ausgabe) | 3,40–4,50 (gemessen) | ~91 % |
| Stapel-Trennung (Zusatz) | **10** | 0,01 | Reducto Split 20 $ | ~1,10 (geschätzt) | ~89 % |
| Transkript (Zusatz, §12) | **6** | 0,006 | Mistral OCR 4 $, Azure Read 1,50 $ (nur Text) | ~2 (geschätzt, Transkriptionsanteil von „Allgemein") | ~65 % |
| Zuordnung im Vorgangsmodus | inklusive | – | Reducto Classify 7,50 $ | gering | – |

Relationen zu Standard: 0,27 / 0,53 / 0,53 / 1 / 1,67 / 3,33 / 0,67 / 0,4.

**Begründung**
- **Bausteine** (Allgemein, Text, Standard) liegen auf oder knapp unter etablierten Angeboten — hier werden wir verglichen;
  das Argument ist Datensouveränität (Adacor, EU, keine Weitergabe an Dritte), nicht der Preis.
- **Vertrag** mit 50 € leicht über Reducto Deep, weil Pflichten, Fristen mit Fundstelle und Befunde mehr liefern. Je
  Vertrag bleibt das sehr wenig (7 Seiten ≈ 0,35 €, 89 Seiten ≈ 4,45 €) — hier ist am ehesten Spielraum nach oben; mit
  Pilotkunden testen statt festlegen.
- **Allgemein** hat die kleinste Marge (Volltext erzeugt viel Ausgabe); 8 € deckt Compute, nicht niedriger ansetzen.

**Rabatte**
- **Batch / asynchron** (`batch.create`, `inbox.create`, Posteingang): **−30 %** (zwischen Reducto −20 % und Mistral −50 %).
- **Volumenstaffel je Monat** (Seiten über alle Produkte): bis 100.000 Listenpreis · 100.000–1 Mio. −20 % · über 1 Mio.
  individuell.

**Grundgebühr und Einmalleistungen**
- **Workplace-Kunden**: DP in der Workplace-Lizenz mit Inklusivvolumen, z. B. 1.000 Standard-Seiten je Monat.
- **Reine API-Kunden**: Plattformgebühr, z. B. 49 €/Monat inkl. 2.000 Standard-Seiten (Profilpflege, Prüfoberfläche,
  Speicherung, Schlüssel, Webhooks).
- **Profilentwurf aus Beispieldokument**: kostenlos (1–2 Modellaufrufe; Vertriebseinstieg).
- **Qualitätsmessung (Evaluation)**: 50 % des Seitenpreises.
- **Profileinrichtung mit Begleitung**: Pauschale je Pipeline, z. B. 1.500–3.000 € je nach Komplexität (Vertrag und
  mehrteilige Vorgänge oben), alternativ Tagessatz.

**Zählregeln** unverändert (§5): jede Seite zählt, mindestens 1 Seite je Dokument; Leerseiten nur für Trennen/
Klassifizieren; Wiederholungen wegen unserer Fehler kostenfrei, vom Kunden ausgelöste Neuverarbeitung zählt erneut.

**Vor der Festlegung zu prüfen**
1. Tokens je Produkt auf den Golden Datasets messen — Standard, Vorgang und Text sind noch geschätzt (Messung liegt in
   `audit.verbrauch`, je Produkt ein Lauf genügt).
2. Compute je Seite auf der Demo-Instanz messen (Erwartung deutlich unter 1 € je 1.000 Seiten, ungemessen).
3. Vertragspreis mit 2–3 Pilotkunden testen (50 € als Anker, Spielraum nach oben).
4. Marktpreise im endgültigen Preisblatt zum aktuellen Wechselkurs umrechnen (Vergleich hier grob 1 € ≈ 1 $).

## 12. Transkript als Zusatz (2026-10-11)

**Ausgangslage:** Ein vollständiges Seitentranskript lieferten nur „Vertrag" und „Allgemein", denn beide lesen über das
Seitenbild. Die übrigen Strategien ziehen Felder direkt aus dem Bild und schreiben den Text nicht mit. Ihr
`document_text` stammt aus dem Konverter und ist bei Scans leer oder unbrauchbar. Über den asynchronen Weg
(`batch.get`, `inbox.get`, Webhook) kam zudem gar kein `document_text`.

**Entscheidung (User, 2026-10-11):**
1. `document_text` wird auch asynchron ausgeliefert (`batch.get` je Datei, Umschlag je Teil unter `ergebnis`).
2. Neuer Profil-Schalter **„Transkript liefern"** (`extraction.transkript`): transkribiert parallel zur Extraktion mit dem
   Lesekern der Vertragsauswertung (ein Bildaufruf je Seite) und liefert `volltext` (Seiten + Gliederung) sowie ein
   vollständiges `document_text`. Gilt für alle Strategien und Segmentprofile. Bei „Vertrag" und „Allgemein" entfällt
   der Schalter, weil sie ohnehin transkribieren.

**Abrechnung:** Zusatzposten `transkript` je Seite, zusätzlich zum Produkt der Auswertung (`audit.zusatz`, im Umschlag
unter `abrechnung`). Kostenfaktor 1,0 (ein Bildaufruf je Seite wie bei Standard). Preisvorschlag 6 € je 1.000 Seiten
(§11), also unter „Allgemein" (8 €), das Transkript und Kernwerte zusammen liefert. Noch nicht gemessen.

**Fehlerverhalten:** Scheitert das Transkript ganz oder für einzelne Seiten, bleibt die Extraktion gültig. Es entsteht
der Hinweis `transkript` (warn), zum Beispiel „Transkript unvollständig — Seite 3 nicht lesbar".

**Nachtrag (2026-10-12):** „Vertrag" liefert jetzt ebenfalls immer `volltext` (Seiten + Gliederung), zusätzlich zu
`vertrag`. Damit liefern Vertrag, „Allgemein" und jedes Profil mit Schalter dieselbe Struktur. `document_text` ist dort
überall der Seitentext. Die Klauseln mit IDs stehen weiter unter `vertrag.klauseln`.

