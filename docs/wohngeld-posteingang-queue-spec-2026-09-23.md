# Wohngeld — Posteingang als persistente, multi-antragsfähige Warteschlange

**Datum:** 2026-09-23
**Status:** Spec (zur Freigabe) — Umsetzung danach in Scheiben
**Betrifft:** `backend/src/apps/wohngeld/` (routes/posteingang, storage, types, db/schema, filestore, extraction, audit, retention, fristen) · `frontend/src/apps/wohngeld/PosteingangPage.jsx` (+ neue Queue-/Detail-Ansicht)

---

## 1. Kontext & Ist-Zustand

Der heutige „Posteingang" ist **kein Posteingang, sondern ein Einzel-Erfassungs-Assistent**:

- `POST /posteingang/upload` speichert die rohen Bytes (`storeUpload` → Filestore/S3) **und** klassifiziert/extrahiert **sofort synchron** (`klassifiziereUndExtrahiere`). Das Ergebnis (Previews) wird an den Browser zurückgegeben und lebt **nur im React-State**.
- Danach: `POST /posteingang/match` (Vorschlag) → `POST /posteingang/verteilen` (Akte/Vorgang anlegen bzw. anhängen, Dokumente + Feld-Provenienz schreiben, optional prüfen) → Navigation zur Vorgangsseite.
- Implizite Annahme im gesamten Flow: **ein Batch = genau ein Antrag** (Antrag + zugehörige Nachweise).

**Konsequenzen des Ist-Zustands:**
- Es gibt **keine persistente Eingangs-Entität**. `posteingang` ist bisher nur ein *Status eines Vorgangs* (`vorgang.status = 'posteingang'`) sowie eine Dokument-`quelle`, **keine Warteschlange**.
- Seite neu laden = alles weg; bereits gespeicherte Bytes wären verwaist (kein Rückbezug).
- Extraktion läuft **immer automatisch** beim Upload — nicht steuerbar, LLM-Kosten pro Upload.
- Kein Weg, Eingänge **ohne Browser** einzuliefern (Scan-Pipeline nicht anschließbar).

## 2. Zielbild

1. **Persistente Warteschlange, multi-antragsfähig:** Viele unabhängige Eingänge liegen nebeneinander. Jeder Eingang ist ein **Umschlag/Batch** (1..n Dateien). Ein Eingang kann ein *neuer Antrag* ODER eine *Nachreichung zu einem bestehenden Vorgang* sein — jeder wird einzeln geroutet.
2. **Intake ≠ Auswertung (entkoppelt):** Einliefern/Hinzufügen **speichert nur** (Dateien + Eingangsdatum + Quelle). Die **Auswertung (Klassifikation/Extraktion/Match) startet der Sachbearbeiter manuell** — pro Eingang oder als Sammelaktion.
3. **Headless-Naht für die Scan-Pipeline:** Intake funktioniert ohne Browser. Manuelles Hinzufügen und Scan-Einlieferung sind intern **derselbe** Weg (`ingest`). Die eigentliche Scanner-Anbindung ist ein späterer Schritt an dieser Naht.

**Nicht-Ziele (bewusst später / außen vor):**
- Die konkrete Scanner-/Poststellen-Integration (nur die `ingest`-Naht wird jetzt gebaut).
- Mehrdok-Split (ein Scan-PDF, das Antrag + mehrere Nachweise in einer Datei enthält, automatisch trennen) — bekannter Folgeschritt an der Naht.
- E-Mail-Eingangskanal (Kanal-Enum sieht ihn vor, Anbindung später).

## 3. Datenmodell

Neue Tabelle im wohngeld-pgSchema, nächste freie Migration (**`0045_wohngeld_posteingang.sql`**, idempotent `IF NOT EXISTS`).

### `posteingang` (Eingang = Umschlag/Batch)

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `id` | uuid PK | |
| `quelle` | text | Kanal: `manuell` \| `scan` \| `email` \| `import` (Enum in `types.ts`) |
| `eingegangenAm` | timestamptz | **Eingangsdatum** — rechtlich relevant (fristauslösend, siehe §7). Bei `manuell` = Uploadzeit (überschreibbar); bei `scan` = Scan-/Stempeldatum aus Metadaten. |
| `betreff` | text null | Freitext/abgeleiteter Titel (nach Analyse z. B. „Müller, Anna — Erstantrag"). Vor Analyse optional Dateiname. |
| `status` | text | `eingegangen` \| `in_analyse` \| `analysiert` \| `fehler` \| `zugeordnet` \| `verworfen` (default `eingegangen`) |
| `dateien` | jsonb | Array je Datei (s. u.) — der Umschlag-Inhalt. |
| `matchVorschlag` | jsonb null | Ergebnis der Match-Ermittlung auf Umschlag-Ebene (Kandidatenliste inkl. Level + Vergleichstabelle). |
| `zugeordneterVorgangId` | uuid null | Nach Zuordnung gesetzt. |
| `zugeordneteAkteId` | uuid null | Nach Zuordnung gesetzt. |
| `bearbeiterId` | text null | Wer zuletzt eine Aktion ausgeführt hat. |
| `verworfenGrund` | text null | Bei `verworfen`. |
| `hash` | text null | Umschlag-Hash (Summe der Datei-Hashes) → **Dedupe** gegen Doppel-Scans. |
| `data` | jsonb | Erweiterungen (z. B. `demo:true` für Seed, Idempotency-Key des Scan-Kanals). |
| `erstelltAm` / `aktualisiertAm` | timestamptz | |

**`dateien[]`-Element (JSON, kein eigenes Table):**
```
{
  dateiname: string,
  s3Key?: string, pfad?: string,     // Storage-Ref (filestore)
  contentType: string, groesse: number,
  hash: string,                       // Datei-Hash (Dedupe/Idempotenz)
  // nach Analyse befüllt:
  typ?: DokumentTyp,                  // Klassifikation (überschreibbar)
  analyse?: DokumentAnalyse,          // extrahierte Felder / Stammdaten / Identität
  fieldConfidences?: Record<string,number>,
  extrahierterTextGekuerzt?: string,
  analyseFehler?: string,
}
```
> **Warum JSON statt Kind-Tabelle:** Dateien werden nie *quer über Umschläge* abgefragt; sie gehören immer zu genau einem Eingang und werden gemeinsam gelesen/geschrieben. Das passt zum file-/JSON-leichten Stil der Plattform und spart einen Join. Falls später doch Datei-übergreifende Queries nötig werden (z. B. „alle unerkannten Scans"), ist eine Kind-Tabelle `posteingang_datei` der Migrationspfad.

Rohe Bytes liegen weiterhin im **Filestore** (`storeUpload`/`resolveStorageRef`), referenziert per `s3Key`/`pfad` je Datei. Die DB hält nur Metadaten + Analyseergebnisse.

## 4. Zustandsautomat

```
              ingest (manuell/scan)
                     │
                     ▼
              ┌─────────────┐   analysieren     ┌──────────────┐
              │ eingegangen │ ───────────────▶  │  in_analyse  │
              └─────────────┘                    └──────┬───────┘
                     │                                  │ Erfolg / Fehler
                     │ verwerfen                        ▼
                     ▼                    ┌──────────────┴───────────┐
              ┌─────────────┐            ▼                          ▼
              │  verworfen  │◀──────  analysiert  ──── zuordnen ──▶ zugeordnet
              └─────────────┘        (re-analysierbar)             (terminal)
```

- `eingegangen → in_analyse → analysiert`: manuelle Auswertung (einzeln/Sammel). `in_analyse` ist transient; bei Ausnahme → `fehler` (mit `analyseFehler`), erneut auswertbar.
- `analysiert → zugeordnet`: Zuordnung zu neuem/bestehendem Vorgang (terminal für den Eingang).
- `* → verworfen`: aus jedem nicht-terminalen Zustand (Spam/Dublette/Fehleinlieferung), mit Grund.
- `analysiert → analysiert`: „Neu auswerten" erlaubt (überschreibt `analyse`/`matchVorschlag`).
- **Jeder Übergang** schreibt einen `audit_log`-Eintrag (Governance GOV-1: jede Sachbearbeiter-Aktion geloggt).

## 5. Endpoints

Alle unter `…/apps/wohngeld/posteingang`. Schreibaktionen **editor-gated** (Funktionstrennung GOV-2). Lesen: App-Berechtigung.

| Methode | Pfad | Zweck |
|---------|------|-------|
| `POST` | `/posteingang/ingest` | **Nur speichern.** 1..n Dateien (multipart) + optional `quelle`, `eingegangenAm`, `betreff`. Legt einen Eingang `status=eingegangen` an. Dedupe per `hash`. **Dieselbe Naht für Browser (manuell) und Scan-Pipeline.** |
| `GET` | `/posteingang` | Liste/Queue (Filter: Status, Quelle; Sortierung: Eingangsdatum). |
| `GET` | `/posteingang/:id` | Detail inkl. Dateien + Analyse + Match-Vorschlag. |
| `GET` | `/posteingang/:id/datei/:idx` | Datei-Download/-Vorschau (Bytes per Ref). |
| `POST` | `/posteingang/analysieren` | Auswertung starten für `{ ids: [...] }` (einzeln oder Sammel). Pro Datei `klassifiziereUndExtrahiere`, danach Umschlag-Match. Setzt `analysiert`/`fehler`. |
| `POST` | `/posteingang/:id/zuordnen` | Zuordnung: `{ neueAkte|akteId, vorgangId?, ... }`. Nutzt die **bestehende `verteilen`-Logik**, liest Bytes per Ref (kein Re-Upload). Setzt `zugeordnet`. |
| `POST` | `/posteingang/:id/verwerfen` | `{ grund }`. Setzt `verworfen`. |
| `PATCH` | `/posteingang/:id` | Kleinkorrekturen vor Zuordnung (Datei-`typ` überschreiben, `betreff`, `eingegangenAm`). |
| `DELETE` | `/posteingang/:id` | Endgültig löschen inkl. Bytes (Retention/DSGVO, s. §8). |

**Wiederverwendung statt Neubau:** Die heutigen `/posteingang/match` und `/posteingang/verteilen` werden zu **internen Bausteinen** von `analysieren` bzw. `zuordnen`. `POST /posteingang/upload` (auto-extract) entfällt als UI-Pfad — Intake ist jetzt `ingest` (ohne Extraktion). Der Direkt-Upload am Vorgang (`/vorgaenge/:id/dokumente/upload`) bleibt unverändert.

## 6. Auswertung (manuell)

Bei `analysieren`:
1. Je Datei im Umschlag: `klassifiziereUndExtrahiere(bytes, contentType)` → `typ`, `analyse`, `fieldConfidences`, gekürzter Text. Ergebnisse in `dateien[i]` schreiben.
2. Umschlag-Match: identifizierendes Signal aggregieren (wie heute `buildMatchInput`: Antrag-Stammdaten + erste Nachweis-Identität über alle Dateien) → `/match`-Logik → `matchVorschlag` (Kandidaten mit Level hoch/mittel/gering + Transparenz-Vergleichstabelle).
3. `betreff` ableiten (Antragstellername/Antragsart), Status `analysiert`.

Sammelaktion = Schleife über `ids` (sequenziell, um LLM-Last zu begrenzen; Teilfehler pro Eingang isoliert → `fehler`, Rest läuft weiter).

## 7. Zuordnung & Eingangsdatum

- **Zuordnung** ruft die vorhandene `verteilen`-Kernlogik: Akte auflösen/anlegen → Vorgang auflösen/anlegen **oder an bestehenden anhängen** (Nachreichung!) → `createDokument` je Datei (mit `s3Key`/Ref, `typ`, `analyse`) → Feld-Provenienz (`feld_status`, `bestaetigt=false`, Confidence) → optional `pruefen`. Danach Eingang `zugeordnet` + `zugeordneterVorgangId`/`zugeordneteAkteId`.
- **Transparenz bei Nachreichung:** Vor dem Anhängen an einen bestehenden Vorgang wird die schon gebaute Vergleichstabelle (Nachreichung ↔ Vorgang, je Feld gleich/abweichung/fehlt) gezeigt — damit **nichts beim falschen Vorgang landet**. Bestätigung erforderlich; Zuordnung per bestätigtem System-Vorschlag wird gesondert protokolliert.
- **Eingangsdatum ist rechtlich relevant:** `eingegangenAm` des Umschlags ist das fristauslösende Datum. Beim Anlegen/Anhängen des Vorgangs speist es die Fristen-/Wiedervorlage-Logik (`fristen.ts`) — nicht die (spätere) Verarbeitungszeit. Für `scan` kommt es aus den Scan-Metadaten, für `manuell` ist es vorbelegt (Uploadzeit) und korrigierbar.

## 8. Governance & Retention

- **Audit (GOV-1):** `ingest`, `analysieren`, `zuordnen`, `verwerfen`, `löschen`, `patch` → je ein `audit_log`-Eintrag (wer/wann/was, Vorher/Nachher wo sinnvoll).
- **DSGVO/Retention:** Ein unzugeordneter Eingang ist **personenbezogene Daten**. Regeln:
  - `verworfen` → Bytes + Row nach kurzer Karenz löschbar (bzw. sofortiges `DELETE` mit Protokoll).
  - `eingegangen`/`analysiert` ohne Zuordnung: Aufbewahrungsfrist (analog `retention.ts`), „löschfällig"-Sicht erweiterbar.
  - `zugeordnet`: die Daten leben ab dann im Vorgang/Dokument (dortige Retention greift); der Eingang selbst kann als erledigt archiviert oder nach Karenz entfernt werden.

## 9. UX

**Posteingang wird eine Queue-Ansicht** (ersetzt den heutigen Einzel-Wizard als Einstieg):

- **Liste** (nutzt die geteilten `components/overview/`-Bausteine, sofern passend): Spalten *Quelle · Eingang (Datum) · Betreff/Dateien · Status · erkannter Typ · Match-Vorschlag · Aktionen*. Statusfilter-Tabs. Mehrfachauswahl mit Sammelaktionen **„Auswertung starten"** und **„Zuordnen"**.
- **Hinzufügen:** Dropzone/Upload legt einen Eingang an (`ingest`, Status `eingegangen`) — **ohne** sofortige Analyse.
- **Detail/Verarbeitung** (`/apps/wohngeld/posteingang/:id`): **recycelt die bestehenden Panels** aus der heutigen `PosteingangPage` — Stammdaten des Antrags, erkannte Nachweise (Typ-Override, Entfernen), Dateivorschau (extrahierter Text), Zuordnungs-Vorschlag + Vergleichstabelle, Verteilung (neue/bestehende Akte, neuer/bestehender Vorgang). Buttons: „Auswertung starten" (wenn `eingegangen`), „Neu auswerten", „Zuordnen", „Verwerfen".
- Der bereits ergänzte Header-Button „Posteingang" in der Übersicht führt hierher.

## 10. Scan-Pipeline-Naht (Vorbereitung, nicht Vollausbau)

`POST /posteingang/ingest` ist die Naht:
- Akzeptiert multipart (1..n Dateien) + Metadaten (`quelle=scan`, `eingegangenAm`, optionaler `idempotencyKey`).
- **Dedupe/Idempotenz:** über `hash` bzw. `idempotencyKey` — erneuter Scan derselben Sendung legt keinen Doppel-Eingang an.
- **Service-Auth (später):** Token-basierter Zugang für die Pipeline (heute: Session/Editor). Als offener Punkt markiert.
- Keine Analyse im Intake → Pipeline liefert nur ab, die Fachkraft wertet aus.

## 11. Migration & Kompatibilität

- Neue Migration `0045_wohngeld_posteingang.sql` (handgeschrieben, idempotent) + `_journal.json`-Eintrag.
- Bestehende Endpoints `match`/`verteilen` bleiben als interne Bausteine erhalten (kein Bruch der Vorgangsseite/Direkt-Upload).
- Der bisherige stateless Upload-Auto-Extract-Pfad der `PosteingangPage` wird durch Queue + `ingest` + manuelle `analysieren` ersetzt.
- Demo-Seed (`seed-demo.ts`) um einige Beispiel-Eingänge in verschiedenen Status erweitern (Governance-konform, `data.demo=true`).

## 12. Umsetzung in Scheiben

- **S1 — Persistente Queue + Intake:** Tabelle/Migration, `types.ts`, `storage.ts`, `ingest` + `list` + `get` + Datei-Download, Queue-UI (Liste + manuelles Hinzufügen), Status `eingegangen`. *Noch keine Analyse* — der Kasten wird sichtbar/persistent.
- **S2 — Manuelle Auswertung:** `analysieren` (einzeln + Sammel), Detail-/Verarbeitungsansicht mit recycelten Panels + Vorschau, Status `analysiert`/`fehler`.
- **S3 — Zuordnung + Governance/Retention:** `zuordnen` aus Refs (neuer/bestehender Vorgang, Vergleichstabelle), `verwerfen`, `DELETE`/Retention, Audit für alle Aktionen; Demo-Seed-Erweiterung.
- **S4 — Scan-Naht härten (später):** Service-Auth, Dedupe/Idempotenz, Scan-Metadaten (Eingangsdatum); danach eigenständig: **Mehrdok-Split**.

## 13. Offene Punkte / Risiken

- **Service-Auth** für die Scan-Pipeline (Token/mTLS) — Entscheidung offen.
- **Mehrdok-Split**: ein Umschlag = eine PDF mit mehreren Dokumenten — braucht Seiten-Segmentierung; separater Ausbau.
- **Retention-Fristen** für unzugeordnete Eingänge: konkrete Dauer fachlich (mit Kommune/DSB) festzulegen.
- **LLM-Last** bei großen Sammel-Auswertungen: sequenziell + Fortschrittsanzeige; ggf. Begrenzung/Queueing.
- **`overview/`-Bausteine**: prüfen, ob sie 1:1 passen oder die Queue eine eigene Tabelle braucht.
