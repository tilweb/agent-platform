# Spezifikation: DP-Qualitätssuite (2026-10-09)

Ziel: Bei jeder Änderung an Document Processing prüfbar machen, dass die Qualität gleich bleibt — formalisiert statt
je Thema eigener Messskripte. Entscheidungen (2026-10-09): Korpus in einem **eigenen lokalen Ordner** außerhalb des
Repos; **Annotation durch den Fachbereich** (über die Prüfoberfläche); Bewerbungsunterlagen werden **anonymisiert**;
**harte Schwelle vor jedem Kunden-Deploy**.

## 1. Drei Ebenen

| Ebene | Was | Wann | Modell |
|---|---|---|---|
| 1 Deterministisch | `bun test` (Parser, Konsolidierung, Zuordnung, Umschlag …) | jede Änderung | nein |
| 2 Golden-Suite | echte Auswertung des Korpus über `extract()` mit eingefrorenem Profil, Metriken, Vergleich mit Baseline | **vor jedem Kunden-Deploy** (hart), Smoke vor Demo-Pushes, bei Modellwechsel voll | ja |
| 3 Produkt | Champion/Challenger je Kundenprofil (besteht) | bei Regeländerungen | ja |

## 2. Korpus (lokal, nicht im Repo)

Pfad: `DP_KORPUS` (Standard `~/Documents/Development/AgentWork/dp-qualitaet-korpus`).

```
<korpus>/
  sets/<set-id>/
    set.json            { id, name, beschreibung, kritische_felder?, schwellen? }
    profil.json         eingefrorene Profildefinition (ExtractionProject) — die Suite misst genau diesen Stand
    faelle/<fall-id>/
      original.<ext>    Originaldokument
      fall.json         { id, split: dev|test, variante: digital|scan|foto, tags[], datenschutz, quelle, gruppe?, smoke?,
                          erwartet: { daten?, segmente?, vertrag? } }
  laeufe/<zeit>_<commit>/   lauf.json · ergebnisse/<set>/<fall>.json · metriken.json · bericht.md
  baseline.json             Metriken + Rauschband je Set (aus „--als-baseline")
```

- **`erwartet.daten`** im Format des Profilergebnisses (wie `corrected_extraction` der DP-Testbeispiele) → Export aus der
  Prüfoberfläche ohne Umwandlung.
- **`erwartet.segmente`** `[{ typ, von, bis }]` für Segmentprofile (Trennung/Typ).
- **`erwartet.vertrag`** für Vertragsprofile (Katalog, Unterschriften, Befunde, Kern-Pflichten — Format aus
  `scripts/vertrag-pilot/vergleich.ts`).
- **`split`**: `dev` = darf zum Nachschärfen genutzt werden; `test` = **nur messen, nie nachschärfen**. Bestehende Sets
  (Wohngeld synthetisch, 10 END-Verträge) wurden zum Nachschärfen genutzt → `dev`. Neu annotierte Dokumente → `test`.
- **Datenschutz** je Fall: `synthetisch` | `pseudonymisiert` | `anonymisiert` | `intern`. Bewerbungen nur `anonymisiert`.

## 3. Ablauf eines Laufs

`bun run scripts/dp-qualitaet/lauf.ts [--sets a,b] [--umfang smoke|voll] [--split test|dev|alle] [--parallel n]
[--als-baseline] [--wiederholungen n]`

1. Je Set `profil.json` laden, `captureSnapshot` (ohne Lernbeispiele — gemessen wird die Profildefinition).
2. Je Fall `extract()` mit dem Snapshot (echter Produktionspfad inkl. Segmentierung, Vertragsauswertung, Verbrauch).
3. Ergebnis je Fall speichern; Bewertung (§4); Bericht und Vergleich mit Baseline (§5).
4. `--als-baseline` schreibt `baseline.json`; mit `--wiederholungen 3` wird zusätzlich das **Rauschband** je Metrik
   bestimmt (Modell ist trotz Temperatur 0 nicht vollständig deterministisch).

Smoke: Fälle mit `smoke: true`, sonst die ersten 3 je Set.

## 4. Metriken

| Bereich | Metrik |
|---|---|
| Felder | Genauigkeit je Feld und gesamt (typ-normalisierter Vergleich aus `eval.ts`: Zahlen, Datum, Text, Listen als Multimenge); bei Segmentprofilen **je Abschnitts-Instanz und Feld**; Dokument vollständig richtig |
| Kritische Felder | wie oben, nur `kritische_felder` des Sets |
| Struktur | Schnitte gefunden / Fehlschnitte, Abschnitte exakt, Typ richtig (Segmentprofile) |
| Vertrag | Prüfungen aus `vergleich.ts` je Kategorie (Katalog, Unterschriften, Status, Befunde, Erweiterung, Inventar) |
| Kalibrierung | „sicher aber falsch": Felder mit Konfidenz ≥ Prüfschwelle, die falsch sind |
| Betrieb | Fehler/Ausfälle, Sekunden je Seite, Aufrufe und Tokens je Seite |

## 5. Vergleich und Schwelle

- Je Set und Metrik: Wert, Baseline, Delta, Rauschband.
- **Harter Fehler** (Exit-Code ≠ 0): Feldgenauigkeit oder Struktur-/Vertragsmetrik sinkt um mehr als
  `max(Rauschband, 1 Prozentpunkt)`; ein **kritisches Feld**, das in der Baseline richtig war, ist jetzt falsch;
  Ausfälle > 0.
- **Warnung**: Tokens oder Zeit je Seite +15 %; „sicher aber falsch" steigt.
- Schwellen je Set überschreibbar (`set.json → schwellen`).

## 6. Befüllen

- **Export aus der Prüfoberfläche**: `scripts/dp-qualitaet/export.ts --profil <id> --set <set> [--split test|dev]` —
  übernimmt die Testbeispiele (mit Original) eines DP-Profils als Fälle und friert die Profildefinition ein.
  Annotation = Dokument im Profil auswerten → im Prüfdialog korrigieren → als Testbeispiel speichern → exportieren.
- **Übernahme bestehender Sets**: Wohngeld (60 Testbeispiele + Seitenbereiche aus dem Golden Dataset), 10 END-Verträge
  (Erwartungswerte aus `tools/vertrag-golden`), Sanitätshaus-Rezepte.
- **Anonymisierung** (Bewerbungen): eigener Schritt vor der Aufnahme — Personenbezug im Transkript erkennen, betroffene
  Wortbereiche im Seitenbild schwärzen, anonymisiertes PDF als Original; Zuordnungstabelle nicht im Korpus. Umsetzung,
  sobald die Unterlagen vorliegen.

## 7. Umsetzungsschritte

1. Korpus-Format, Bewertungsbibliothek, Bericht mit Baseline-Vergleich (+ Tests).
2. Runner (`lauf.ts`).
3. Export aus DP-Profilen; Übernahme Wohngeld, Verträge, Rezepte.
4. Baseline + Rauschband messen.
5. Anonymisierung Bewerbungen (bei Vorliegen der Unterlagen).
