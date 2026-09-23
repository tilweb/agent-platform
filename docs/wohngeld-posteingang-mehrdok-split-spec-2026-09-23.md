# Wohngeld — Mehrdokument-Split im Posteingang (Spec, 2026-09-23)

## Kontext

Scan-Stapel kommen oft als **eine** PDF: Antrag + Mietbescheinigung + Lohnnachweise
hintereinander. Bisher wurde so eine Datei als *ein* Dokument klassifiziert und
extrahiert — der Antrag „verschluckte" die Nachweise. Die Posteingang-Queue-Spec
(`wohngeld-posteingang-queue-spec-2026-09-23.md`, §13) hatte den Split als Folgeschritt
an der Naht markiert.

Die Plattform bringt die Bausteine schon mit (Document-Processing-Inbox, Welle 4):

| Baustein | Ort | Aufgabe |
|---|---|---|
| `judgeBoundaries` | `extraction/inbox/split.ts` | Vision-Urteil je Seitenübergang (erprobter Split-Prompt, konservativ) |
| `rangesFromBoundaries` | `extraction/inbox/split.ts` | Urteile → Seitenbereiche |
| `buildPartPdf` | `services/extraction/pdf-split.ts` | Teil-PDF via poppler (`pdfseparate`/`pdfunite`) |
| `renderPdfToImages` / `countPdfPages` | `services/extraction/pdf.ts` | Seiten rendern/zählen |

Wohngeld nutzt sie **wieder** — keine eigene Grenzerkennung, kein Plattform-Inbox-Store.

## Entscheidungen

1. **Wann:** in der manuellen Auswertung (`analysieren`), nicht im Intake. Der Intake
   speichert weiterhin nur (Spec-Prinzip „Intake ≠ Auswertung").
2. **Was entsteht:** jede erkannte Einheit wird eine eigene `PosteingangDatei` im
   Umschlag (eigene Bytes im Filestore, eigener Hash). Danach läuft die bestehende
   Klassifikation/Extraktion je Teil — der Rest der Kette (Match, Zuordnung,
   `verteileDokumente`) bleibt unverändert: jeder Teil wird ein eigenes Dokument im Vorgang.
3. **Original bleibt erhalten** (`teilVon` an jedem Teil): Nachvollziehbarkeit des
   Posteingangs, Grundlage für „Trennung korrigieren". Löschen des Eingangs entfernt
   Teile *und* Original.
4. **Konservativ:** Nur ein klares Urteil trennt. Ist ein Seitenübergang nicht sicher
   beurteilbar (Call-Fehler), poppler fehlt oder die PDF hat mehr als
   `WOHNGELD_SPLIT_MAX_SEITEN` (Default 40) Seiten → **keine** automatische Trennung,
   die Datei bleibt ein Dokument mit sichtbarem Hinweis. Die Fachkraft kann manuell trennen.
5. **Korrektur durch die Fachkraft** (Human-in-the-Loop, bewusst schlicht): „Neues
   Dokument beginnt auf Seite: 1, 4, 7" oder „Als ein Dokument behandeln". Neue Teile
   werden sofort ausgewertet, der Match-Vorschlag neu berechnet. Manuelle Entscheidungen
   werden bei „Neu auswerten" nicht wieder überschrieben.
6. **Kein Re-Split** bei „Neu auswerten": bereits getrennte Teile und als „ein Dokument"
   beurteilte Dateien werden nicht erneut beurteilt (spart Vision-Calls). Nur
   „unsicher" wird erneut versucht.
7. **Abschaltbar:** `WOHNGELD_SPLIT=false` (z. B. Instanz ohne Vision-Modell).
8. **Governance:** Audit `posteingang.getrennt` (automatisch/manuell, Seitenbereiche,
   Modell) bzw. `posteingang.trennung_aufgehoben`. Die Grenz-Urteile laufen auf dem
   festen Plattform-Extraktionsmodell (wie die Plattform-Inbox).

## Datenmodell (jsonb, keine Migration)

```ts
PosteingangDatei.teilVon?: {        // gesetzt an jedem Teil einer getrennten Datei
  dateiname, s3Key?, pfad?, hash, contentType, groesse,  // Original
  seitenGesamt, seiteVon, seiteBis, teilNr, teileGesamt,
  manuell?: boolean,
}
PosteingangDatei.trennung?: {       // an ungetrennten PDFs nach Prüfung
  status: 'ein_dokument' | 'unsicher' | 'nicht_moeglich',
  seitenGesamt?, hinweis?, manuell?: boolean,
}
```

## API

- `POST /posteingang/analysieren` — trennt vor der Klassifikation (s. o.).
- `POST /posteingang/:id/trennung` — `{ hash, startSeiten?: number[] }`. `hash` =
  Hash des Originals (bzw. der ungetrennten Datei). `startSeiten` leer oder `[1]` ⇒ als
  ein Dokument zusammenführen; sonst Seitenstarts (1 muss enthalten sein, aufsteigend,
  ≤ Seitenzahl). Erlaubt in `eingegangen`/`analysiert`/`fehler`. Wertet neue Dateien
  aus, wenn der Eingang bereits ausgewertet war.

## UI (PosteingangDetail)

- „Erkannte Dokumente": Teile einer Datei gruppiert unter einer Kopfzeile
  „scan.pdf · 12 Seiten · in 4 Dokumente getrennt" mit Seitenangabe je Teil (S. 3–5).
- Button „Trennung korrigieren" an der Gruppe bzw. „Manuell trennen" an ungetrennten
  mehrseitigen PDFs; Hinweis bei `unsicher`/`nicht_moeglich`.
- Korrektur-Formular inline: Eingabefeld Seitenstarts + „Übernehmen" / „Als ein Dokument".

## Nicht im Umfang

- Seiten-Thumbnails/Drag-&-Drop-Sortierung (bewusst: Eingabe der Seitenstarts reicht).
- Split von Nicht-PDF-Dateien (Bilder sind je Datei ein Dokument).
- Umsortieren von Seiten zwischen Dokumenten.
