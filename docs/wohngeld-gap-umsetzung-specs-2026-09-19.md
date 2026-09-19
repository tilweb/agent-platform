# Wohngeld — Umsetzungs-Specs für die Gap-Analyse (pragmatisch)

**Stand:** 2026-09-19 · **Bezug:** `docs/wohngeld-screenshot-gap-analyse-2026-09-19.md`
**Leitlinie:** Sicht einer *pragmatischen Kommune / Sachbearbeitung* — **intuitive UX, klare
Abläufe, bewusst nicht overengineered**. Jede WP nennt explizit **Nicht-Ziele** (was wir
absichtlich weglassen), damit Umfang schlank bleibt.

Umsetzung in Wellen; je WP: Backend rein/testbar wo möglich, `bun test`/Build grün, Checkpoint-Commit.

---

## WP1 — §13-Einkommensansicht sichtbar machen (Gap D) · Welle 1

**Sachbearbeiter-Nutzen:** „Wie hoch ist das anrechenbare Einkommen und wie kommt es zustande?"
auf einen Blick — heute rechnet die Engine korrekt, zeigt es aber nirgends.

**UX/Ablauf:** In der Übersicht-Sektion „Einkommen & Abzugsbeträge" eine **Ergebniszeile**
„Anrechenbares Gesamteinkommen (§13 WoGG)" mit monatlich/jährlich. Ein **aufklappbares
„Herleitung anzeigen"** (Auge) zeigt pro Person: Summe Jahreseinkommen (§14) − §16-Abzug
(mit angesetzten Kategorien) − §17-Freibeträge; darunter Haushalts-Summe − §18. Read-only.

**Backend:** Endpoint `GET /vorgaenge/:id/einkommen` → nutzt bestehendes `gesamteinkommen(...)`
(einkommen.ts). §16-Kategorien pragmatisch aus vorhandenen Merkmalen ableiten (KV/PV-Nachweis
vorhanden → kvPv; Erwerbseinkommen → steuern; RV-Pflicht → rv) — als transparente Annahme
kennzeichnen („angenommene Abzugskategorien, prüfen").

**Nicht-Ziele:** keine Wohngeldbetrag-Berechnung (§19), keine editierbare Neuberechnung im UI.

## WP2 — „Essenzielle Angaben"-Prüfschritt + kleine Übersicht-UX (Gaps N, C) · Welle 1

**Nutzen:** schnelle Orientierung; Standard-Affordances, die man erwartet.

**Umfang:**
- Deterministischer Prüfschritt `essenzielle-angaben` (Vollständigkeit, household): fehlt eine
  Kernangabe (Antragsteller-Name, Antragsdatum, Adresse, Miete bei Mietzuschuss, ≥1 Person) →
  offener Anforderungs-Prüfschritt. In `checker/` ergänzen + Test.
- **Einklappbare Übersicht-Sektionen** (Chevron), Zustand pro Sektion.
- **Prüfschritt → Dokument-Sprung:** Klick auf den Beleg-Chip eines Prüfschritts wechselt in den
  Dokumente-Tab und hebt das Dokument hervor.
- **Antrags-ID-Kopierbutton** und **rechte Seitenleiste ein-/ausklappen**.

**Nicht-Ziele:** keine feldgenaue Verankerung (kommt konzeptionell mit WP3), kein Deep-Linking per URL.

## WP3 — KI-Vorschlag-Bestätigung auf Feldebene + Bearbeitungsmodus-Zähler (Gaps A, N) · Welle 2

**Nutzen (Kernmodell):** Jeder aus Dokumenten extrahierte Wert ist ein **Vorschlag**, den die
Sachbearbeitung bestätigt/verwirft — Nachvollziehbarkeit + Haftungssicherheit.

**Datenmodell (schlank):** Feld-Provenienz als eigene, generische Tabelle statt Umbau jedes Feldes:
`feld_status(vorgang_id, ziel_typ 'vorgang'|'person', ziel_id, feld_pfad, quelle 'llm'|'mensch',
bestaetigt bool, quell_dokument_id?, confidence?)`. Beim Extrahieren/Verteilen (Posteingang) werden
für befüllte Felder `quelle='llm', bestaetigt=false` gesetzt.

**UX:** Unbestätigte KI-Felder tragen einen dezenten **Punkt** + Icons **✓ (bestätigen) / ✗
(verwerfen→leeren)**. Kopf der Sektion: „**Alle bestätigen**". Bearbeitungsmodus-Leiste zeigt
**Anzahl offener Bestätigungen/Änderungen** + „Verwerfen"/„Speichern".

**Nicht-Ziele:** keine Feld-Historie/Versionsdiff, kein Confidence-Balken je Feld (nur intern),
keine Pflicht-Bestätigung als Blocker.

## WP4 — Kommentare je Sektion (Gap B) · Welle 2

**Nutzen:** interne Notizen für Vertretung/4-Augen.

**Umfang:** einfache **Notizen je Sektion** (Allgemein, Personen, Wohnung, Einkommen) und je Person.
Tabelle `notizen(vorgang_id, anker, autor, text, created_at)` (append-only), Sprechblasen-Icon mit
Zähler, Popover mit Liste + Eingabe.

**Nicht-Ziele:** kein Threading, keine @-Mentions, kein Feld-genauer Kommentar.

## WP5 — Strukturierte Listen + Bewilligungszeitraum-Vorschlag (Gaps F, E) · Welle 3

**Nutzen:** korrekte Erfassung der Positionen, die Regeln/§13 treiben.

**Umfang:**
- Person-Detail: **Vermögen** (Liste statt Einzelzahl: Art + Betrag), **Unterhaltsverpflichtungen**
  (§18: Empfänger-Kategorie + Betrag + Titel ja/nein), **Unterhaltsansprüche**, **Transferleistungen**
  (Art + Bescheid vorhanden) — je als „+"-Liste. In `person.data` als Arrays (kein neues Schema nötig).
- **Bewilligungszeiträume** als Liste (Start/Ende); **Vorschlag** „12 Monate ab Antragsmonat"
  (§22/§25) als Prüfschritt `bwz-vorschlag-pruefen` + 1-Klick-Übernahme.
- §16-Ableitung (WP1) + §18-Abzug + §21-Freigrenze nutzen diese Daten (Engine erweitern + Tests).

**Nicht-Ziele:** keine taggenaue Teil-BWZ-Logik, keine automatische Mehrfach-BWZ-Splittung.

## WP6 — Anforderungsschreiben aufwerten (Gap G) · Welle 3

**Nutzen:** schneller, einheitlicher, nachvollziehbarer Schriftverkehr.

**Umfang:**
- **Textbausteine**: pro Instanz pflegbare, kategorisierte Snippets (Tabelle
  `textbausteine(kategorie, titel, text)`), durchsuchbar, per Klick in den Brief einfügen.
- **Regenerieren** (aus aktuellen offenen Prüfschritten neu erzeugen, Vorwarnung bei Überschreiben).
- **Provenienz je Punkt** (ⓘ → zugehöriger Prüfschritt/Beleg) — soweit Generator die Zuordnung kennt.
- **Gliederung nach Thema** optional zusätzlich zur Person.

**Nicht-Ziele:** kein WYSIWYG-Rich-Text-Editor (Markdown-Textarea bleibt), keine Serienbrief-Funktion.

## WP7 — Fristen, Wiedervorlage & Status-Automatik (Gap H) · Welle 4

**Nutzen:** der Hebel für kürzere Bearbeitungszeit; nichts geht „verloren".

**Umfang:**
- Beim Erzeugen/„Versenden" eines Anforderungsschreibens: Vorgang-Status automatisch
  **`warte_auf_rueckmeldung`**, **Frist** + **Wiedervorlagedatum** setzen.
- **Wiedervorlage-Liste** (eigene Ansicht): offene Fristen, überfällige hervorgehoben, je Zeile
  Sprung zum Vorgang. Berechnung rein/testbar (überfällig = Frist < heute).

**Nicht-Ziele:** kein voller Kalender mit Terminen, keine automatischen E-Mails, keine Eskalationsstufen.

## WP8 — Todos & Labels (Gap I) · Welle 4

**Umfang:** **Todos** je Vorgang (Text, erledigt-Flag) in `vorgang.data.todos` + Details-Tab-Liste;
**Labels**-Verwaltung im Details-Tab (Chips hinzufügen/entfernen, `vorgang.labels`).
**Nicht-Ziele:** keine Zuweisung/Fälligkeit je Todo, keine globale Label-Taxonomie-Verwaltung.

## WP9 — Module: Akten-Browser + Aufgaben/Fristen-Übersicht (Gap J) · Welle 5

**Umfang:** Übersichtsseiten (nutzen bestehende Endpunkte):
- **Akten-Browser**: Akten-Liste → Vorgänge je Akte (Adresse/Antragsteller).
- **Aufgaben/Wiedervorlage**: aggregierte Liste offener Todos + fälliger Fristen (aus WP7/WP8)
  über alle Vorgänge des Sachbearbeiters.
Als zusätzliche Routen/Sidebar-Einträge der App (keine neue Top-Level-Icon-Leiste nötig).
**Nicht-Ziele:** kein eigenständiges Kalender-Modul, keine arbeitsplatzübergreifende Rechteverwaltung darüber.

## WP10 — Dokumente-Tab & Ablage (Gap K) · Welle 5

**Umfang:** Dokumente **nach Eingangsdatum gruppieren**, **Flags** als hervorgehobene Chips,
**„Alle herunterladen"**, **Originaldateien** separat; **Dateivorschau** über native Browser-
Anzeige (Backend liefert die Datei mit korrektem Content-Type → `<iframe>`/Link, **keine PDF-Lib**);
**Ablage-Status** je Dokument (`abgelegt` bool) + Aktion „ins Fachverfahren abgelegt".
**Nicht-Ziele:** keine echte Fachverfahren-Schnittstelle (nur Status/Export), kein Annotations-Viewer.

## WP11 — Verfügung erzeugen (Gap L) · Welle 5

**Umfang:** Tab „Verfügung": erzeugt ein **Entscheidungs-/Verfügungsdokument** (PDF/Word via
vorhandenen `documentGenerator`) aus Vorgangsdaten + Ergebnis (Zusammenfassung Personen/Einkommen/
Miete/erledigte Prüfschritte + Entscheidungsfeld/Bemerkung der Sachbearbeitung). Status → `entscheidung`.
**Nicht-Ziele:** keine rechtsverbindliche Bescheid-Vorlage, keine Betragsfestsetzung (§19 bleibt out of scope).

---

## Wellen-Reihenfolge (Nutzen ÷ Aufwand)

1. **Welle 1:** WP1 (§13-Ansicht) + WP2 (Essenzielle Angaben, Sektions-UX, Doku-Sprung, Kopier/Collapse).
2. **Welle 2:** WP3 (Feld-Bestätigung) + WP4 (Kommentare).
3. **Welle 3:** WP5 (strukturierte Listen + BWZ) + WP6 (Schreiben/Textbausteine).
4. **Welle 4:** WP7 (Fristen/Wiedervorlage) + WP8 (Todos/Labels).
5. **Welle 5:** WP9 (Module) + WP10 (Dokumente/Ablage) + WP11 (Verfügung).

Nach jeder Welle: Verifikation (Tests/Build) + Checkpoint-Commit + Changelog.
