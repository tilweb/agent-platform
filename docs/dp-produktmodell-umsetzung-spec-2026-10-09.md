# Spezifikation: Umsetzung DP-Produktmodell, Punkte 1–6 (2026-10-09)

Bezug: `docs/konzept-dp-produktmodell-2026-10-09.md` §6. Diese Spezifikation legt die technischen Entscheidungen fest.

## 1. Eingangsmodus statt „Trennen"-Häkchen

- `InboxProcessOptions`: `{ modus: 'vorgang' | 'stapel'; profilId?: string }`. **Standard `vorgang`.**
- Rückwärtskompatibel: Formularfeld `split=false` → `vorgang`, `split=true` → `stapel`; neues Feld `modus` hat Vorrang.
- **Mit `profilId`**: ein Teil über alle Seiten, keine Zuordnung, direkt in die Pipeline.
- **Vorgang**: nur Seite 1 rendern (150 dpi), Zuordnung gegen alle Pipelines (ohne „Allgemein"), **ein** Teil über alle
  Seiten. Kein Seitenlimit für die Trennung nötig.
- **Stapel**: wie bisher Trennen + Zuordnen je Teil.
- Sicherheit < Schwelle (0,8) → Teil geht an das Basisprofil „Allgemein", Teilstatus `kein_profil` (manuell umleitbar
  wie `unassigned`).

## 2. Umschlag-Ergebnis und öffentliche API

- Neue Funktionen `inbox.create` (ein Dokument base64, optional `project_id`, `modus`, `callback_url`; antwortet sofort mit
  `upload_id`) und `inbox.get` (`upload_id` → Umschlag). `extract`/`batch.*` bleiben unverändert.
- Umschlag (reine Funktion `baueUmschlag(upload, teile, dateien)`):
  `{ upload_id, modus, status: verarbeitung|fertig|fehler, seiten_gesamt, teile: [{ teil_id, seiten, profil,
  zuordnung: { sicherheit, kandidaten }, status: in_arbeit|fertig|zu_pruefen|kein_profil|fehler|nicht_zugeordnet,
  ergebnis? }], abrechnung: [{ produkt, seiten, kostenfaktor }], verbrauch }`.
- Zuordnung Teil ↔ Batch-Datei über den Dateinamen des Teils (eindeutig je Upload).
- **Webhook je Upload**: Nach jedem abgeschlossenen Batch-Lauf prüft `umschlagNachLauf(runId)`, ob alle Teile des
  Uploads fertig sind; genau eine Zustellung über eine bedingte DB-Aktualisierung (`webhook_status` von NULL auf
  `wird_zugestellt`). Signatur: Schlüssel der Pipeline, wenn der Upload genau eine Pipeline betrifft; sonst
  `EXTRACTION_WEBHOOK_SECRET`, falls gesetzt; sonst unsigniert.
- Migration `0049_eingang_umschlag.sql`: `inbox_uploads` + `modus`, `profil_id`, `callback_url`, `webhook_status`,
  `webhook_error`, `abrechnung` (jsonb), `quelle` (`oberflaeche`|`api`).

## 3. Basisprofil „Allgemein"

- Systemprofil `allgemein`, bei Bedarf angelegt (`stelleBasisprofilSicher()`), nicht löschbar, nicht Zuordnungskandidat.
- Felder: Dokumentart, Absender, Empfänger, Datum, Betreff, Referenznummern, Kurzinhalt.
- Neue Strategie `general-document`: Seiten über das Bild transkribieren (wie `contract-structured`), Gliederung,
  ein Aufruf für die Profilfelder. Ergebnis zusätzlich `volltext: { seiten: [{ seite, rolle, text }], gliederung }`
  → `extract()` → Batch-Detail → API.
- Gemeinsamer Lesekern `contract/lesen.ts` (Rendern, Transkription, digitale Signaturen, Strukturbaum) für beide
  Strategien.

## 4. Messung je Upload

- `extraction/produkte.ts`: Strategie → Produkt + Kostenfaktor (Formular 0,1 · Text 0,3 · Standard 1,0 · Vorgang 1,5 ·
  Vertrag 3,0 · Stapel-Trennung 1,0).
- `extract()` legt einen Token-Messbereich um die Auswertung (`mitTokenMessung`) → `audit.verbrauch` (Aufrufe,
  Prompt-/Completion-Tokens, je Modell) und `audit.abrechnung` (`{ produkt, seiten, kostenfaktor }`) — gilt für alle
  Wege (UI, API, Batch, Apps).
- Der Umschlag summiert Abrechnung und Verbrauch je Upload und speichert die Abrechnung beim Abschluss.

## 5. Robuste Stapel-Trennung

- Ein nicht beantwortetes Grenzurteil bricht den Upload nicht mehr ab: Die Grenze gilt als „kein Schnitt" (wie ein
  unklares Urteil), der Upload bekommt einen Hinweis „Grenze nach Seite n nicht geprüft".

## 6. Segmenttypen mit Verweis auf eine Pipeline

- `SegmentTypeDef.profil?: string`. Gesetzt → keine eigenen Felder; Felder und Anweisungen kommen aus der
  verwiesenen Pipeline.
- Auflösung beim Einfrieren des Profils (`captureSnapshot`) → Lauf ist reproduzierbar, Hash enthält die aufgelösten
  Felder. Verwiesene Pipeline darf selbst keine Segmente haben; kein Selbstverweis.
- Oberfläche: im Segment-Editor Auswahl „Felder aus Profil übernehmen".
