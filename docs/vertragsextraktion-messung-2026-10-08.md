# Vertragsextraktion `contract-structured` — Umsetzung und Messung (2026-10-08)

Bezug: Konzept `docs/konzept-vertragsextraktion-2026-10-08.md`, Spezifikation
`docs/vertragsextraktion-strategie-spec-2026-10-08.md`. Testkorpus: 10 Verträge Ladeinfrastruktur (V1–V10, 146 Seiten,
überwiegend Scans; Kunden anonymisiert, Originale und Erwartungswerte nur lokal unter `tools/vertrag-golden/`).

## 1. Was umgesetzt ist

| Baustein | Datei | Kern |
|---|---|---|
| Transkription (P2) | `services/extraction/contract/transkription.ts` | Seite für Seite über das Bild (Qwen 3.5, 200 dpi), Textlayer nur als Hilfe; Auszeichnung für Überschriften, Streichungen, Ankreuzfelder, Handschrift, Unterschrift/leeres Feld, Stempel; Briefbogen-Fußzeile getrennt; Seitenrolle |
| Digitale Signaturen | `contract/signatur.ts` | PDF-Signaturfelder (`/Type /Sig`, `/M`) → Marker auf der Unterschriftsseite |
| Strukturbaum (P3) | `contract/struktur.ts` | deterministisch, seitenübergreifend; § / Ziffer / „3." / Artikel / Dezimal / Anlage; implizite Absatznummern; Rubrum, Präambel, Unterschriftsblock, nicht bindende Seiten als eigene Wurzeln |
| Auswertung (P4) | `contract/auswertung.ts` | Katalog (2 Aufrufe, Freitext-JSON mit Skelett), Inventar (Gruppen ≤ 7.000 Zeichen, erzwungenes JSON, Halbierung bei unlesbarer Antwort), Erweiterung (Profilfelder) |
| Konsolidierung (P5) | `contract/konsolidierung.ts` | Fundstellen normalisieren, Querverweise (Gesetze ausgenommen), fehlende Anlagen, Unterschriften inkl. Plausibilität, Platzhalter, Gültigkeit, Dubletten, Fristinformation (ohne Berechnung) |
| Strategie | `strategies/contract-structured.ts` | `StrategyResult.contract`; Profilfelder in `extracted`; gescheiterte Schritte → `processingIssues` (erzwingen „Zu prüfen") |
| Durchreichung | `learning/service.ts`, `batch-runs.ts`, `batch-service.ts`, `public-functions.ts` | `vertrag` in `extract()`, Batch-Detail (`detail.vertrag`, keine Migration), API `extract` und `batch.get`; Befunde als `validations` (`vertrag-*`) |
| Oberfläche | `frontend/src/components/VertragPane.jsx` | Strategie wählbar; Prüfdialog mit Überblick, Pflichten & Fristen, Klauseln (Suche), Befunde; Fundstelle → Wortlaut + Seitensprung |
| Messung | `backend/scripts/vertrag-pilot/` | `messung.ts` (Cache je Seite), `vergleich.ts`, `e2e.ts` (echter `extract()`-Pfad mit temporärem Projekt) |

Tests: 30 Unit-Tests (`contract/*.test.ts`, `scripts/vertrag-pilot/vergleich.test.ts`). E2E über `extract()`: 12/12.

## 2. Ergebnis

Abgleich gegen lokal annotierte Erwartungswerte (185 Prüfungen):

| Kategorie | Lauf 1 | Endstand |
|---|---|---|
| Katalog (Parteien, Beginn, Laufzeit, Verlängerung, Kündigungsfrist, Verknüpfung) | 47/47 | 47/47 |
| Unterschriften je Partei | 14/20 | 20/20 |
| Status (geregelt / nicht geregelt / geerbt) | 39/40 | 40/40 |
| Befunde (fehlende Anlagen, fehlende Unterschrift, Platzhalter, Auffälligkeiten) | 25/25 | 25/25 |
| Erweiterung (Ladepunkte aus Anlage, Entgelt je LP, Rückvergütung) | 8/8 | 8/8 |
| Inventar (44 Kern-Pflichten/-Fristen per Stichwort) | 39/44 | 44/44 |
| Gültigkeit (Streichungen) | 0/1 | 1/1 |
| **gesamt** | **172/185 (93 %)** | **185/185 (100 %)** |

Je Vertrag (Endstand):

| V | Seiten | Klauseln (Abschnitte) | seitenübergreifend | Inventar | Fristregeln | Verweise (offen) | Befunde | Auswertung | Aufrufe |
|---|---|---|---|---|---|---|---|---|---|
| V1 Wartung | 7 | 44 (15) | 2 | 44 | 15 | 4 (0) | 2 | 72 s | 5 |
| V2 „Betreiber" = Wartung | 6 | 40 (12) | 0 | 40 | 16 | 3 (1) | 7 | 68 s | 5 |
| V3 Rückvergütung | 2 | 14 (5) | 0 | 12 | 3 | 0 (0) | 3 | 47 s | 4 |
| V4 Betreiber | 6 | 66 (13) | 4 | 72 | 20 | 5 (1) | 3 | 105 s | 6 |
| V5 Betreiber (dig. signiert) | 8 | 61 (14) | 1 | 72 | 25 | 5 (1) | 6 | 130 s | 6 |
| V6 Betreiber (Streichungen) | 7 | 65 (13) | 1 | 80 | 18 | 4 (0) | 5 | 125 s | 6 |
| V7 Rahmen (Anlagen fehlen) | 5 | 27 (13) | 3 | 46 | 12 | 8 (7) | 7 | 97 s | 5 |
| V8 Endkunde (Handyfoto) | 4 | 39 (12) | 1 | 52 | 16 | 3 (0) | 3 | 77 s | 5 |
| V9 Endkunde v2 | 6 | 47 (16) | 0 | 60 | 18 | 3 (0) | 4 | 78 s | 6 |
| V10 Rahmen 89 S. | 89 | 428 (87) | 50 | 502 | 98 | 139 (3) | 13 | 404 s | 35 |

Transkription zusätzlich ~3–4 s je Seite (4 parallel; V10: 195 s). Ein 6-Seiten-Vertrag dauert damit rund 1,5–2,5 min,
der 89-Seiten-Rahmenvertrag rund 10 min.

Beispiele echter Befunde: abweichende PLZ derselben Partei (V1), Ansprechpartner-E-Mail noch bei der Vorgängerfirma (V1),
Platzhalter „XXX" (V2), fehlende Gegenzeichnung (V2, V3, V5, V8, V9), Anlagen 1–4 fehlen (V7), Vertragsbeginn vor
Unterschrift (V2, V7), Name handschriftlich korrigiert (V9), durchgestrichene Preispositionen (V6).

## 3. Was zwischen Lauf 1 und Endstand geändert wurde (und warum)

1. **Inventar-Antworten abgeschnitten** (4 Gruppen unlesbar): ganze Betreiberverträge (16.000 Zeichen) lagen in einer
   Gruppe, die Antwort lief über 8.192 Token. → Gruppen ≤ 7.000 Zeichen, 12.000 Token, bei unlesbarer Antwort Gruppe
   halbieren (bis 2 Stufen).
2. **Erzwungenes JSON entgleist bei großen Schemata** (Katalog): Guided Decoding produzierte nach einigen Feldern
   endlos Leerzeichen bis zum Tokenlimit — auch mit `disable_any_whitespace` (Endpunkt akzeptiert die Option, die
   Schleife steckt dann in Strings). → Katalog als Freitext-JSON mit aus dem Schema erzeugtem Skelett, in 2 Teilen;
   allgemein: unlesbare erzwungene Antwort → ein Freitext-Versuch.
3. **Dezimal-Unterpunkte als Überschrift** („## 2.4. Für jeden Hotelstandort …", V10) wurden Abschnitte → 19 falsche
   „Verweis ins Leere". → `##` + Dezimalnummer ist Unterpunkt.
4. **Nummerierte Überschriften** („3. Stromversorgung") vom Modell teils zu „§ 3" gemacht, Fortsetzungsseiten mit
   wiederholter Überschrift. → Transkriptionsregel „Nummer wie im Dokument", Parser: `## 3. Titel` = Ziffer, gleicher Kopf
   am Seitenanfang = Fortsetzung.
5. **Unterschriften**: leeres Feld vs. Unterschrift ohne lesbaren Namen war mehrdeutig. → `{{unterschrift: …}}` /
   `{{keine unterschrift}}`; digitale PDF-Signaturen aus dem Signaturfeld; Plausibilität „mehr Parteien unterschrieben
   als Markierungen" → Befund (trifft im Korpus genau den einen Fehlfall, keine Fehlalarme).
6. **Geerbte Laufzeit** (Zusatzvereinbarung) → Katalog-Hinweis „an anderen Vertrag gekoppelt = geerbt".
7. **Ausfall des Modell-Endpunkts** während eines Laufs lieferte leere, aber „erfolgreiche" Auswertungen. → gescheiterte
   Katalog-/Inventar-/Erweiterungsaufrufe sind `processingIssues` mit Schwere `error` (erzwingen „Zu prüfen").

## 4. Grenzen dieser Messung

- **Kein unabhängiger Testbestand**: Die Erwartungswerte stammen aus denselben 10 Verträgen, an denen nachgeschärft
  wurde. Zwei Erwartungswerte wurden als falsch erkannt und korrigiert (Begriff „BNetzA" steht nicht im Vertrag;
  Parteiname „END" vs. „EMobility …"). Neue Verträge (andere Aussteller, andere Vorlagen) sind der nächste Prüfstein.
- **Inventar nur stichprobenartig gemessen** (44 Kern-Stichworte), nicht als vollständige Annotation. Ob 502 Einträge
  im Rahmenvertrag für „Pflichten, Risiken, Abweichungen" handhabbar sind oder verdichtet werden müssen, ist offen.
- **Modellstreuung**: Transkriptionen schwanken zwischen Läufen (z. B. dünne Streichungen einmal 11, einmal 2 erkannt;
  nach Prompt-Schärfung wieder vollständig). Temperatur 0 macht den Endpunkt nicht vollständig deterministisch.
- **Oberfläche nicht im Browser geprüft** (lokale Instanz erfordert Anmeldung) — lint-sauber, nach den Mustern des
  Prüfdialogs gebaut.
- DP-Projekte verlangen mindestens ein eigenes Feld; für Verträge in der Praxis unkritisch.

## 5. Nächste Schritte (Vorschlag)

1. Weitere Verträge anderer Aussteller als unabhängiger Testbestand (5–10), inkl. vollständig annotiertem Inventar für
   2–3 Verträge.
2. Vertrags-App an die Ergebnisse anbinden (Fristenradar liest `fristen` + Katalog `beginn/laufzeit/verlaengerung/
   kuendigung`; „Ask the contract" auf `klauseln`).
3. Sichtprüfung der Vertragsansicht im Prüfdialog mit echten Batch-Läufen.
4. Vorlagenabgleich, sobald END Vorlagen bereitstellt.
