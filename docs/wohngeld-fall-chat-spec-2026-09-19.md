# Spec-Entwurf: Wohngeld Fall-Chat („Antworten aus dem Fall, nicht aus dem Bauch")

**Stand:** 2026-09-19 · **Status:** ENTWURF · **App:** `wohngeld` · **Bezug:** Screenshot 13.09.05,
Spec `docs/wohngeld-antragsassistent-spec-2026-09-18.md`, Regel-Katalog, Gap-Analyse.

> Leitprinzip: Der Chat gibt **nur belegte** Antworten — jede Aussage ist entweder durch den
> **konkreten Fall** (Vorgangsdaten/Nachweise) oder durch **Rechtsquellen** (WoGG/WoGV, mit
> Fundstelle) gedeckt. Ohne Beleg → kein Behaupten, sondern „nicht im Fall/Recht auffindbar".
> Die **Entscheidung bleibt immer beim Menschen** (keine verbindliche Rechtsauskunft).

---

## 1. Warum — wie es der Sachbearbeitung MAXIMAL hilft

Der Engpass ist nicht „rechnen", sondern **Suchen, Nachschlagen, Erklären, Formulieren** —
verteilt über Antrag, Nachweise, Gesetzestext und Verwaltungsvorschrift. Der Chat bündelt das
**im Fall**, ohne Kontextwechsel. Konkrete Zeitgewinne:

1. **Fall in Sekunden befragen** statt 11 PDF-Seiten durchblättern:
   „Welche Renten bezieht Frau Petermann und ab wann?" → Antwort mit Beleg-Chip auf den Rentenbescheid.
2. **Rechtsfragen sofort mit Fundstelle** („Bekommt man Wohngeld in Haft?", „Zählt Elterngeld zum
   Einkommen?") — statt Kommentar/WoGVwV wälzen. Mit Quellen-Chips (§, Fundstelle).
3. **Prüfschritte erklären**: „Warum wird der Rentenbescheid nachgefordert?" → verweist auf die
   Regel + den Beleg im Fall. Beschleunigt Einarbeitung neuer Kolleg:innen enorm.
4. **Einkommen nachvollziehen**: „Wie setzt sich das anrechenbare Gesamteinkommen zusammen?"
   → §13-Herleitung aus der Rechen-Engine, Schritt für Schritt.
5. **Formulierungshilfe**: „Formuliere den Nachforderungspunkt zur Miethöhe höflich und konkret."
   → Textvorschlag, direkt ins Anforderungsschreiben übernehmbar.
6. **Nächste sinnvolle Schritte**: „Was fehlt noch, damit ich entscheiden kann?" → Zusammenfassung
   der offenen Anforderungen priorisiert.
7. **Konsistenz & Rechtssicherheit**: gleiche Fragen → gleiche, belegte Antworten; reduziert
   uneinheitliche Einzelfallpraxis und Rückfragen bei Kolleg:innen.

Kurz: der Chat macht **implizites Fach-/Aktenwissen sofort abrufbar** und **nachvollziehbar** —
das ist der Hebel für die angestrebte Verkürzung der Bearbeitungszeit.

---

## 2. Fähigkeiten (Capability-Stufen)

| Stufe | Fähigkeit | Grounding-Quelle |
|---|---|---|
| **A · Fall-Q&A** | Fragen zu Personen, Einkommen, Wohnung/Miete, Dokumenten, Prüfschritten des Vorgangs | Vorgang-Snapshot + extrahierte Dokumenttexte |
| **B · Recht-Q&A** | Fragen zu WoGG/WoGV/WoGVwV mit Fundstelle | Rechts-Wissensbasis (RAG) |
| **C · Erklären** | „Warum diese Nachforderung/Plausibilitätswarnung?" | Regel-Katalog + Prüfschritt + Beleg |
| **D · Einkommen erklären** | §13-Herleitung, „was zählt, was wird abgezogen" | `einkommen.ts` + § 14/16/17 (KB) |
| **E · Formulieren** | Textvorschläge (Anschreiben-Punkt, Aktenvermerk, Begründung) | Fall + Regel + Textbausteine |
| **F · Nächste Schritte** | Priorisierte To-dos, „was fehlt zur Entscheidung" | offene Prüfschritte |
| **G · Aktionen (perspektivisch)** | Vorschlag „Prüfung neu ausführen", „Anschreiben generieren", „Prüfschritt erledigen" — **nur mit expliziter Bestätigung** | App-Aktionen |

Stufe G ist bewusst **vorschlagend, nie ausführend ohne Klick** (Human-in-the-Loop).

---

## 3. Grounding & Wissensquellen

Der Chat kombiniert drei Quellen und **muss** jede Aussage einer davon zuordnen:

1. **Fall-Kontext (Snapshot):** Vorgang, Personen (inkl. Einkommenspositionen, Vermögen, Merkmale),
   Wohnung/Miete, Dokumente (Typ, Flags, **extrahierter Text**, `analyse`-Felder), Prüfschritte,
   berechnetes Gesamteinkommen (§13). Wird pro Anfrage frisch geladen (kein veralteter Kontext).
2. **Rechts-Wissensbasis (RAG):** eigene KB-Collection `wohngeld-recht` mit **paragraphengenau
   gechunktem** WoGG, WoGV, WoGVwV (+ optional Länder-Merkblätter). Nutzt das bestehende
   KB-/Retrieval-System (`kb_search`, Collections, Indexer). Jeder Chunk trägt Metadaten
   (Gesetz, §, Absatz, Rechtsstand) für saubere Zitate.
3. **Regel-Katalog:** `docs/wohngeld-regelkatalog-2026-09-18.md` als strukturierte Erklärbasis
   für Prüfschritte (Regel-ID → Titel, Trigger, Recht) — als zusätzliche KB-Quelle indexierbar.

**Retrieval-Strategie:** je Nutzerfrage
(a) Fall-Kontext immer als kompakter, strukturierter System-Kontext (nur relevante Felder, gekürzt);
(b) bei Recht-/Erklär-Fragen zusätzlich Top-k Chunks aus `wohngeld-recht` (semantische Suche);
(c) Prüfschritt-/Regel-Bezug wenn die Frage einen Prüfschritt betrifft.

**Rechtsstand-Pflege:** die KB-Chunks tragen ein `rechtsstand`-Datum; Antworten weisen bei
rechtlichen Aussagen den Stand aus. Aktualisierung = KB neu indexieren (kein Code-Deploy).

---

## 4. Antwort- & Zitationsregeln (Guardrails im Prompt)

- **Zitatpflicht:** Jede fachliche/rechtliche Aussage nennt ihre Quelle — Fall-Quelle als
  **Dokument-Chip** (klickbar → Dokument/Seite) bzw. Feld, Rechtsquelle als **§-Chip**
  (Gesetz + Paragraph/Absatz, Fundstelle). Screenshot: „⚖ 5 Quellen".
- **Kein Beleg → keine Behauptung:** Findet sich nichts im Fall/Recht, sagt der Chat das explizit
  und schlägt vor, welche Unterlage/Prüfung Klarheit bringt.
- **Keine verbindliche Rechtsauskunft / keine Entscheidung:** Formulierungen als Einordnung/Vorschlag;
  Hinweis „Die Entscheidung im Einzelfall treffen Sie."
- **Keine Erfindung von Fall-Daten:** nur wiedergeben/schlussfolgern, was im Snapshot steht.
- **Transparenz bei Berechnungen:** §13-Herleitung zeigt die Zwischenschritte aus der Engine.
- **Sprache:** Deutsch, sachlich, knapp; auf Wunsch ausführlicher.

---

## 5. UI-/Interaktionskonzept

- **Verortung:** Fall-gebundenes Chat-Panel im Vorgang-Detail (schwebendes Fenster wie im
  Screenshot „Vorgang <antragsId>", min/max/close), zusätzlich als eigener Tab-/Seitenleisten-Modus.
  Titel = Antrags-ID. Der Chat kennt **immer den aktuell offenen Vorgang**.
- **Streaming:** Antworten streamen (SSE, wie bestehender Chat), inkl. sichtbarem „denke/suche"-
  Zustand („Ich blättere für dich durch die Gesetze.").
- **Quellen:** unter jeder Antwort **Quellen-Chips** (Fall-Dokumente + §-Fundstellen); Klick öffnet
  Beleg (Dokument/Seite bzw. Gesetzestext-Auszug).
- **Vorschlags-Prompts (Chips):** kontextuelle Startfragen, z. B. „Was fehlt noch?",
  „Ist die Miethöhe plausibel?", „Wie hoch ist das anrechenbare Einkommen?".
- **Aktion-Vorschläge:** bei Stufe G erscheint ein Button („Anschreiben generieren",
  „Prüfung aktualisieren") — führt erst auf Klick eine bestehende App-Aktion aus.
- **Verlauf:** Chat-Verlauf **pro Vorgang** gespeichert (Nachvollziehbarkeit, Vertretung).
- **Vertraulichkeitshinweis** (aus Screenshot): „Nachrichten werden vertraulich behandelt und nicht
  weitergegeben." — plus Datenschutz-Hinweis (s. §7).

---

## 6. Datenmodell (Ergänzung zum bestehenden `wohngeld`-Schema)

| Tabelle | Zweck | Felder (neben Konvention) |
|---|---|---|
| `chat_sessions` | Chat je Vorgang | vorgang_id (FK), titel, ersteller |
| `chat_messages` | Nachrichten (append-only) | session_id (FK), rolle (user/assistant), content, `sources` jsonb (`[{art:'dokument'|'recht', ref, label, seite?, paragraph?}]`), model, tokens |

Alternativ: bestehende Chat-Persistenz der Plattform wiederverwenden, falls sie mandanten-/
kontextgebunden nutzbar ist (prüfen). Sonst obiges app-eigenes Schema (Migration 0040).

---

## 7. Backend-Architektur

- **Endpoint (SSE):** `POST /apps/wohngeld/vorgaenge/:id/chat` (streamt Antwort + Quellen-Events),
  `GET .../chat` (Verlauf laden). App-Access-Gate greift (viewer darf fragen; keine Schreibaktion).
- **Kontext-Assemblierung (`chat-context.ts`, rein/testbar):** baut aus dem Snapshot einen
  kompakten, strukturierten Kontext-Block (Personen/Einkommen/Miete/offene Prüfschritte +
  §13-Ergebnis), längenbegrenzt.
- **Retrieval (`chat-retrieval.ts`):** semantische Suche in Collection `wohngeld-recht`
  (bestehendes KB-System), Top-k Chunks mit Zitat-Metadaten.
- **LLM:** `llmService.streamChat([...])` mit System-Prompt (Rolle, Zitatpflicht, Guardrails),
  Fall-Kontext, Retrieval-Kontext, Verlauf, Nutzerfrage. Modell per ENV
  `WOHNGELD_CHAT_MODEL` (Thinking-fähig für Herleitungen), Fallback wie App-Default.
- **Quellen-Extraktion:** das Modell markiert genutzte Quellen (strukturiert, z. B. Zitat-Tags),
  Backend mappt sie auf klickbare Refs (Dokument-ID/Seite bzw. §-Fundstelle).
- **Optional Tool-/Function-Calling (Stufe G):** definierte, sichere App-Funktionen
  (Prüfung ausführen, Schreiben generieren) als vorgeschlagene Aktionen — Ausführung nur nach
  UI-Bestätigung, mit Aktivitäts-Log.
- **Audit:** jede Chat-Nutzung als `aktivitaet` (Nachvollziehbarkeit), Usage-Tracking wie sonst.

---

## 8. Datenschutz / Guardrails (Behördenkontext)

- **Mandantentrennung & Vertraulichkeit:** Fall-Daten verlassen den Mandanten nicht; keine
  Weitergabe/kein Training auf Falldaten (Hinweis im UI). Zugriff nur mit App-Berechtigung.
- **Zweckbindung:** Chat nur zur Bearbeitung des jeweiligen Vorgangs.
- **Halluzinationsschutz:** Grounding + Zitatpflicht + „kein Beleg → keine Aussage".
- **Menschliche Letztentscheidung:** klar gekennzeichnet; keine automatischen Bescheide.
- **Protokollierung:** Chat-Verlauf + Aktionen auditierbar; Löschkonzept gemäß Betriebsvorgaben.

---

## 9. Beispiel-Dialoge (Abnahme-Anker)

- **Recht:** „Bekommt man Wohngeld in Haft?" → Einordnung mit §-Fundstellen (Lebensmittelpunkt
  § 5, Ausschlüsse § 7), „⚖ N Quellen"; Hinweis auf Einzelfall.
- **Fall:** „Welche Nachweise fehlen für Herrn Petermann?" → Liste der offenen `anforderung`-
  Prüfschritte mit Beleg-Chips.
- **Erklären:** „Warum wird die Miethöhe hinterfragt?" → Regel `plausi-miethoehe-abweichung` +
  Werte (704 € Antrag ↔ 690 € Mietvertrag) + Dokument-Chip.
- **Einkommen:** „Wie hoch ist das anrechenbare Gesamteinkommen und wie kommt es zustande?"
  → §13-Herleitung aus der Engine (Summe § 14 − § 16 − § 17), pro Person.
- **Formulieren:** „Schreib mir dazu einen höflichen Nachforderungssatz." → Textvorschlag +
  Button „In Anforderungsschreiben übernehmen".

---

## 10. Umsetzungsphasen

- **C1 — Fall-Q&A (grounded, ohne Recht-KB):** Kontext-Assemblierung + streamendes Chat-Panel +
  Verlauf + Fall-Quellen-Chips. Sofort nützlich (Stufen A, C-teilweise, F).
- **C2 — Recht-RAG + Zitate:** Collection `wohngeld-recht` (WoGG/WoGV/WoGVwV + Regel-Katalog)
  seeden/indexieren, Retrieval, §-Quellen-Chips (Stufen B, D vollständig).
- **C3 — Formulieren + Übernahme:** Textvorschläge → Anforderungsschreiben/Aktenvermerk (Stufe E),
  Kopplung an Textbausteine (Gap G).
- **C4 — Aktions-Vorschläge (Function-Calling):** sichere App-Aktionen mit Bestätigung (Stufe G).

---

## 11. Offene Punkte

1. **Rechts-KB-Quelle & Pflege:** Volltexte WoGG/WoGV/WoGVwV importieren (gesetze-im-internet.de);
   Chunking je Paragraph/Absatz; Rechtsstand-Feld; Update-Prozess (wer pflegt Novellen?).
2. **Modellwahl:** Thinking-Modell für Herleitungen vs. schnelles Instruct für Kurzfragen;
   ENV-getrennt (`WOHNGELD_CHAT_MODEL`).
3. **Chat-Persistenz:** app-eigenes Schema vs. Wiederverwendung der Plattform-Chat-Persistenz.
4. **Umfang Stufe G** (welche Aktionen), Rechte (viewer vs. editor).
5. **Kosten-/Nutzungstracking** je Mandant.
