# Wohngeld — Gap-Analyse aus den Screenshots (Stand 2026-09-19)

Systematische Auswertung der Screenshots in `docs/wohngeld/` (Referenzprodukt „forml"):
welche Funktionen/Affordances sind sichtbar (auch eingeklappt/nur als Icon angedeutet),
die unsere aktuelle V1 **noch nicht** hat. Priorisiert nach Nutzen für die Sachbearbeitung.

Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt

---

## A. Human-in-the-Loop auf FELD-Ebene (größter Hebel) ❌

Die Screenshots zeigen die eigentliche Kernmechanik von „forml": nicht nur Prüfschritte,
sondern **jeder extrahierte Wert ist ein KI-Vorschlag, den die Sachbearbeitung bestätigt/verwirft**.

- **Lila Punkt** an Feldern/Positionen = „vom KI-Vorschlag, noch nicht bestätigt / geändert".
- **✓ / ✗** je Feld bzw. je Einkommensposition = bestätigen / verwerfen.
- **✗ (x)** am Feld = Wert löschen/zurücksetzen.
- **Auge-Icon** an Beträgen = Herleitung/Quelle des Werts einblenden.
- **„Speichern 0"**-Zähler in der Bearbeitungsmodus-Leiste = Anzahl offener, unbestätigter Änderungen.

Status heute: Bestätigung nur auf **Prüfschritt**-Ebene (offen/erledigt/verworfen), nicht pro Feld.
→ **Empfehlung:** Feld-Provenienz-Modell (`quelle: 'llm'|'mensch'`, `bestaetigt: bool`, `quellDokumentId`, `confidence`) einführen; UI-Indikatoren + Bestätigen/Verwerfen. Das ist der Unterschied zwischen „sieht aus wie forml" und „ist forml".

## B. Kommentare / Anmerkungen je Sektion & Feld ❌

Sprechblasen-Icon an jeder Sektion (Allgemein, Personen, Wohnung & Miete, Einkommen) und an
Personen. → interne Notizen/Kommentare (Sachbearbeitung, ggf. threaded) pro Sektion/Feld.
Status: ❌. Nützlich für Vertretung/4-Augen-Prinzip.

## C. Sektions-Status & Navigation Prüfschritt ↔ Feld 🟡

- Jede Übersicht-Sektion zeigt einen **eigenen Status** („2 offen"/„5 offen" bzw. grüner Haken).
- Sektionen sind **einklappbar** (Chevron).
- Prüfschritte sind an Sektionen/Felder **verankert**; ein Prüfschritt referenziert das Quell-
  Dokument als **Chip** (z. B. „🏠 Mietvertrag · Siegfried Petermann") — Klick springt zum Dokument.
Status: grobe Ampel-Heuristik ✅; echte Sektion-Verankerung + Doku-Chip-Navigation ❌.

## D. Einkommensberechnung-Ansicht (§13) ❌ — Engine da, UI fehlt

- Person-Detail: „**Zur Einkommensberechnung wechseln →**" = eigene Ansicht mit Positionen
  (monatlich/jährlich), „**+ Position hinzufügen**", ✓/✗ je Position, **„Anrechenbares
  Gesamteinkommen §13 WoGG"** als berechnete Summe (mit Auge = Herleitung).
- Wir haben die **Rechenlogik** (`einkommen.ts`: §14/§16/§17) bereits getestet, aber **zeigen sie
  nirgends an**. → größter „quick win": das Ergebnis + Herleitung sichtbar machen.
Status: Engine ✅, UI/Endpoint ❌.

## E. Bewilligungszeiträume + KI-Vorschlag ❌

- **Mehrere** Bewilligungszeiträume als Liste (Start/Ende), ✓/✗ je Zeitraum, „+".
- Prüfschritt „**BWZ-Vorschlag prüfen**" → das System **schlägt** einen Bewilligungszeitraum vor
  (12 Monate ab Antragsmonat, § 25/§ 22 WoGG).
Status: heute nur einzelnes `bwz_start/ende`-Feld. → Liste + Vorschlagslogik.

## F. Strukturierte Listen je Person ❌/🟡

Add-bare Listen (mit „+") im Person-Detail: **Transferleistungen**, **Vermögen** (mehrere
Positionen, nicht nur eine Zahl), **Unterhaltsverpflichtungen** (§18), **Unterhaltsansprüche**.
Diese treiben Regeln (§7 Ausschluss, §18 Abzug, §21 Freigrenze) — heute nur rudimentär abgebildet.

## G. Anforderungsschreiben — deutlich mächtiger 🟡

Vorhanden: generieren, editieren, PDF/Word/Text-Export.
Fehlt:
- **Textbausteine** (kategorisierte, durchsuchbare Snippet-Bibliothek; im Screenshot: „Pflege­beispiel/
  Personeneigenschaften", „Grundsteuernachweis/Miete", „Miete anfordern"…) — pro Instanz pflegbar.
- **Rich-Text-Editor** mit Toolbar (Fett, Undo/Redo) statt Plain-Textarea.
- **Provenienz je Textbaustein-Punkt** (ⓘ = „warum wird das gefordert" → Link zum Prüfschritt/Beleg).
- **Regenerieren** (↻) nach Änderungen; **Gliederung nach Themen** (Abzugsbeträge, Allgemeine
  Angaben, Einkommen, Miete) statt nur nach Person.
- **Schreiben-Arten-Workflow**: Erst-/Zweit-/Erinnerung inkl. **Fristsetzung**.

## H. Fristen / Wiedervorlage / Status-Automatik ❌

- Status „**Warte auf Rückmeldung**" (Uhr-Icon) — sollte automatisch nach Versand einer
  Anforderung gesetzt werden; **Frist** wird überwacht; bei Ablauf → Wiedervorlage/Erinnerung.
- **Kalender-Modul** (Icon in der linken Leiste) = Fristen-/Terminübersicht.
Status: ❌. Für „6 Monate → 2 Wochen" (Ausschreibungsziel) zentral.

## I. Aufgaben/Todos ❌ und Labels 🟡

- Details-Tab: **Todos (1)**, **Labels (1)**, **Aktivitäten (1)** — einklappbare Zähler-Listen.
- Todos je Vorgang (❌), Labels-Verwaltung-UI (🟡 Feld vorhanden), Aktivitäten-Timeline (🟡 Basis da).

## J. Modul-Navigation links (eigene Ansichten) ❌

Icon-Leiste deutet mehrere Top-Level-Bereiche an:
- **Akten-Browser** (Ordner) — Akte → Vorgänge, personen-/adressbezogen.
- **Aufgaben** (Checkliste) — arbeitsplatzübergreifende To-do-/Wiedervorlage-Liste.
- **Posteingang** (Brief) ✅.
- **Verteilung/Relationen** (Verzweigung) — Zuordnung/Zusammenhänge.
- **Fristen-Kalender** (Kalender).
Status: nur Vorgangsliste + Posteingang. Akten-Browser/Aufgaben/Kalender ❌.

## K. Dokumente-Tab & Dateivorschau 🟡

- Suche, Filter „Eingänge", **Alle herunterladen**, Gruppierung nach Eingangsdatum/Uhrzeit,
  **Flags als hervorgehobene Chips** („Ohne Datum unterschrieben", „14 € unter Antrag",
  „Mit KV-Zuschuss", „Stand 01.07.2023"), **Originaldateien** (einklappbar), **Seitenzahl**.
- **Echte Dateivorschau** (PDF-Rendering mit Seitennavigation/Zoom) — heute nur Text-Auszug.
- **Sync/Ablage ins Fachverfahren** (E-Akte) — „Nicht abgelegt"-Status + Aktion.
Status: Liste + Flags 🟡; Preview/Download-all/Gruppierung/Ablage ❌.

## L. Verfügung ❌ (bewusst Platzhalter)

Tab „Verfügung ⤓" = Erzeugung des Entscheidungs-/Verfügungsdokuments (Endartefakt). Heute Platzhalter.

## M. Fall-Chat ❌ → eigene Spec: `docs/wohngeld-fall-chat-spec-2026-09-19.md`

„Antworten aus dem Fall, nicht aus dem Bauch" — Chat zu Vorgang + Rechtsgrundlagen mit Quellen.

## N. Kleinere Affordances

- **In-Fall-Suche** (Lupe in der Bearbeitungsleiste). ❌
- **Bearbeitungsmodus** mit Verwerfen + Änderungszähler. 🟡 (Edit-Toggle da, Zähler/Verwerfen ❌).
- **Kopier-Button** für Antrags-ID. ❌ (trivial)
- **„Essenzielle Angaben im Antrag"**-Meta-Prüfschritt (Kernfelder vollständig?). ❌ (deterministisch nachrüstbar)
- **Feedback**-Kanal (Megafon-Icon). ❌
- **Rechte Seitenleiste ein-/ausklappen**. 🟡

---

## Priorisierungs-Vorschlag (Nutzen ÷ Aufwand)

**Sofort-Mehrwert, kleiner Aufwand:**
1. **D** Einkommensberechnung sichtbar machen (Engine ist fertig) — Endpoint + Panel „Gesamteinkommen §13" mit Herleitung.
2. **N** „Essenzielle Angaben"-Prüfschritt + Antrags-ID-Kopierbutton + Sektions-Chevrons.
3. **C** Prüfschritt→Dokument-Chip mit Sprung.

**Hoher Nutzen, mittlerer Aufwand:**
4. **M** Fall-Chat (separate Spec) — direkter Zeitgewinn im Alltag.
5. **H** Fristen/Wiedervorlage + Status-Automatik „Warte auf Rückmeldung" (Ausschreibungsziel Bearbeitungszeit).
6. **G** Textbausteine + Provenienz im Anforderungsschreiben.

**Strukturell größer:**
7. **A** Feld-Ebene-Bestätigung (KI-Vorschlag pro Feld) — das eigentliche „forml"-Kernmodell.
8. **E/F** Bewilligungszeitraum-Vorschlag + strukturierte Listen (Vermögen/Unterhalt/Transfer).
9. **J** Akten-Browser / Aufgaben / Kalender als eigene Module.
10. **K/L** Dateivorschau + E-Akte-Ablage + Verfügung.
