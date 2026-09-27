# Wohngeld — Token-Verbrauch je Antrag (Spec, 2026-09-27)

## Kontext

Offener Punkt aus GOV-3 („Token-Zählung bewusst offen"). Für jeden Antrag soll sichtbar
sein, wie viele Tokens die KI-Assistenz verbraucht hat: **initial** (Ersterfassung im
Posteingang) und **im Verlauf** (Nachreichungen, Fall-Chat, Gesetz nachschlagen),
aufgeschlüsselt nach Aktion und als Summe.

Ist-Zustand: `audit.usage_log` hat Token-Spalten, sie werden aber nie befüllt
(`usageTrackingService.track` zählt nur Aufrufe). Außerdem laufen die meisten
Wohngeld-LLM-Aufrufe über Plattform-Bausteine (DP-Segmentprofil, `runPipeline`,
Split-Urteile), die keinen Fallbezug kennen — ein Posteingang hat zum Zeitpunkt der
Auswertung noch gar keinen Vorgang.

## Entscheidungen

1. **Messen an der Quelle, zuordnen an der Aktion.** Ein Messbereich
   (`services/llm/token-meter.ts`, AsyncLocalStorage) wird um eine fachliche Aktion
   gelegt. Die LLM-Adapter (OpenAI-kompatibel + Ollama, Chat + Stream) melden jede
   Antwort mit `usage` in alle offenen Messbereiche. Dadurch werden auch tief
   verschachtelte Plattform-Aufrufe (Vision je Seite, Segmentierung, Split) erfasst,
   ohne dass die Pipelines einen Fallbezug durchreichen müssen.
2. **Ein Datensatz je Aktion**, nicht je LLM-Aufruf: neue Tabelle
   `wohngeld.ki_verbrauch` (Aufrufe, Eingabe-/Ausgabe-Tokens, Aufrufe ohne
   Token-Angabe, Aufschlüsselung je Modell, Dauer). Leere Messungen (kein LLM-Aufruf)
   werden nicht gespeichert.
3. **Initial vs. Verlauf** über `phase`:
   - `ersterfassung` — Posteingang-Auswertung eines Eingangs, der einen **neuen**
     Vorgang begründet.
   - `bearbeitung` — alles am bestehenden Vorgang: Nachreichung (Posteingang an
     bestehenden Vorgang oder Upload am Vorgang), Fall-Chat, Gesetz nachschlagen.
   Posteingang-Datensätze tragen zunächst nur `posteingang_id`; bei **Zuordnung**
   werden sie dem Vorgang zugeschrieben (`vorgang_id` + endgültige Phase).
4. **Streaming:** `stream_options.include_usage` wird nur gesetzt, wenn ein Messbereich
   offen ist. Das reine Usage-Schluss-Chunk (leere `choices`) wird im Adapter
   verbraucht und nicht weitergereicht, damit bestehende Verbraucher (Agent-Loop greift
   ungeschützt auf `choices[0]` zu) unberührt bleiben.
5. **Ehrlich bei fehlenden Angaben:** Liefert ein Anbieter keine `usage`, wird der
   Aufruf als „ohne Token-Angabe" gezählt — keine Schätzung.
6. **Kein FK** auf Vorgang/Posteingang (wie `audit_log`); keine personenbezogenen
   Inhalte, nur Akteur-ID + Zahlen.

## Aktionen

| Schlüssel | Anzeige | Phase |
|---|---|---|
| `posteingang_auswertung` | Posteingang: Erkennung & Auslesen | ersterfassung / bearbeitung (bei Nachreichung) |
| `posteingang_trennung` | Posteingang: Neuauswertung nach Trennungskorrektur | wie oben |
| `dokument_upload` | Nachreichung am Vorgang: Erkennung & Auslesen | bearbeitung |
| `fall_chat` | Assistent: Frage zum Fall | bearbeitung |
| `gesetz_nachschlagen` | Assistent: Gesetz nachschlagen | bearbeitung |

Der alte Einzel-Wizard (`POST /posteingang/upload`) wird nicht gemessen — er ist durch die
Queue ersetzt.

## API

- `GET /vorgaenge/:id/ki-verbrauch` → `{ summe, jePhase, jeAktion, eintraege }`
- `GET /posteingang/:id/ki-verbrauch` → gleiche Form, nur Einträge des Eingangs

## UI

- Vorgang: neuer Reiter **„KI-Verbrauch"** — Kennzahlen (Gesamt / Ersterfassung /
  Bearbeitung), Tabelle je Aktion (Anzahl, Aufrufe, Eingabe, Ausgabe, Gesamt) und Verlauf
  (neueste zuerst, mit Modell und Dauer). In der Seitenleiste „KI-Nutzung" eine Summenzeile
  mit Sprung in den Reiter.
- Posteingang-Detail: Summenzeile „KI-Verbrauch dieses Eingangs".

## Nicht-Ziele

- Kosten in Euro (Preise je Modell sind instanzabhängig; Folgeschritt).
- Befüllen der Token-Spalten in `audit.usage_log` (plattformweit; Folgeschritt).
- Budgets/Limits.
