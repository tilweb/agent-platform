# Konzept: Document Processing als Produkt — Eingangsmodell, Dokumenten-Pipelines, Abrechnung (2026-10-09)

Status: Konzept, Grundsatzentscheidungen getroffen (§7), **nicht umgesetzt**.
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

- EUR-Preise je Produkt (nach Tokenmessung).
- Grundgebühr mit Inklusivseiten oder reine Nutzung; Abrechnung je Mandant/Instanz oder je Pipeline.
- Schwelle für die Zuordnung ohne Pipeline (heute 0,8) und Verhalten knapp darunter („zu_pruefen" vs. „Allgemein").
