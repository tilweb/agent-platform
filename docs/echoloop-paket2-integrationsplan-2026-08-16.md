# Integrationsplan — PAKET_2 (L-VAR v3.11) vollständig nativ in die Echo-Loop-App

**Für:** Andi / ADACOR (Abstimmung mit Sebastian) · **Stand:** 2026-08-16
**Grundlage:** `docs/echoloop-paket2-integration-analyse-2026-08-16.md` (Analyse) + `PAKET_2/`
**Ziel-App:** `backend/src/apps/echoloop/` + `frontend/src/apps/echoloop/`

---

## 0. Ziel & Prinzip

**Auftrag (Seb via Andi):** Die Workplace-App wird um **alle Funktionen** von PAKET_2 erweitert. Sebs Skills, Python-Engine, Standards und Gates sind die **Spezifikation** — sie definieren *was* und *wie*. Sie werden **nativ in unsere TypeScript-App reimplementiert**, nicht als Fremd-Artefakt betrieben.

**Konsequenz (kehrt die frühere Empfehlung um):** Kein Python-Service, keine eingebetteten HTML-Fremdartefakte. L-VAR, die Prüfmuster, das NK-Gate, der CFG-Generator, die QA-Kette etc. werden zu App-Modulen im echoloop-Stil (Backend-Services + native React-UI + eigenes Datenmodell).

**Was wir mitnehmen, was wir übersetzen:**
- Sebs **Python = Referenz-Verhalten** (die Extraktions-Raster, die 7 Diff-Klassen, die G1–G7-Logik, die Prüfmuster) → wir portieren die *Logik*, nicht den Code.
- Sebs **Golden-Set = Regressions-Wahrheit** → wird zu unserem Test-Fixture (Übungsfall zuerst, Heinzl compliance-gated).
- Sebs **Vorfälle-Changelog (60_CHANGELOG_L-VAR) = die nicht-verhandelbaren Prinzipien** (§3) → werden als Querschnitts-Regeln in jedes Modul eingebaut, damit wir die teuren Lehren nicht neu erleiden.

---

## 1. Ziel-Architektur der gewachsenen App

Die App wächst von „ein Verfahren (L-RGA)" zu einem **Verfahrens-Verbund auf gemeinsamem Fundament**:

```
                         ┌─────────────────────────────────────────────┐
   VERFAHREN (Skills →   │  L-RGA   L-VAR   L-BAU   Prozess-Start   Umbau  Wertfehler │
   App-Flows)            └─────────────────────────────────────────────┘
                              │        │        │         │           │        │
   GEMEINSAMES FUNDAMENT  ┌───┴────────┴────────┴─────────┴───────────┴────────┴───┐
                          │ Koordinaten-Extraktion (Prozesse · Variablen · Schritte │
                          │   · Call-Graph · Kommentare · Pfade)                    │
                          │ Prozess-Familie-Datenmodell (Prozesse · Variablen · CFG │
                          │   · Baustände · Explorer · Register)                    │
                          │ Methodik-Kern (NK-Gate · Reifegrad · Zwei-Naturen ·     │
                          │   Analyse-Tiefen · Prüfmuster PM-01..21)                │
                          └─────────────────────────────────────────────────────────┘
                              │
   BETRIEBS-BACKBONE      ┌───┴──────────────────────────────────────────────┐
                          │ QA-Kette (E1–E5, selbstprüfend) · Gold-Runner      │
                          │ Governance PROD↔PROJ (Rollen) · Telemetrie         │
                          │ Register (Gold · Bauweg · Regel-Backlog) · Tresor  │
                          └────────────────────────────────────────────────────┘
```

Leitbild: **ein Datenmodell, viele Verfahren, ein Qualitäts-Backbone.** Die Verfahren verzahnen sich über den Baustand (L-VAR-Pfadbefunde → L-RGA D9/D10; NK-Zustand → RGA; RGA-Twin → L-VAR-Steckbriefe).

---

## 2. Datenmodell-Erweiterung (`pgSchema('echoloop')`)

Heute: `kunden → prozesse → baustaende (+artefakte)`. Ein „Prozess" hält bisher mehrere Export-PDFs = faktisch eine **Familie**. PAKET_2 unterscheidet **Familie** vs. **Einzelprozess** vs. **Variable** vs. **CFG-Schlüssel**. Reconciliation:

| Ebene | heute | Ziel | Felder (neu) |
|---|---|---|---|
| Kunde | `kunden` | unverändert | Namensraum-Kürzel (`<KD>_`, KR-1) |
| **Familie** | `prozesse` (umgewidmet) | die Analyse-Einheit | `familienkuerzel`, `namenskonvention` (Kanon/Regime), Session/`token_prefix` |
| **Einzelprozess** | (nur in Baustand-Daten) | **neue Tabelle** `el_prozess_items` | Nr · Export-Name · Typ MP/TP/SP · Kritikalität+Grund · Kopfblock · Frische-Kontrakt · Aufrufer/Call-Graph · Fingerprint |
| **Variable** | — | **neue Tabelle/JSONB** `el_variablen` | p · id · name · typ · init · schnittstelle · rolle(C/H/T/…) · neu(Ziel) · umbruch · fundstellen · NK-Befunde G1–G7 |
| **CFG-Schlüssel** | — | **neue Tabelle/JSONB** `el_cfg` | schlüssel · wert · wert_quelle · produzent/konsument · diff-klasse(7) · herkunft |
| Baustand (L-RGA) | `baustaende` | erweitert | `analyseTiefe`(T-A/B/C) · `levelKlassen`(Robust/Skal) · `vereinbarungsGates` · unverändert: dimensionen/kennzahlen/SE |
| Explorer (L-VAR) | — | am Baustand oder eigene Entität | Reiter-1/2/3-Zustand (D-061 append-only Tokens) |
| **Register** | — | Backend-Tabellen | Gold-Registry · Bauweg-Register · Regel-Backlog · Telemetrie (append-only) |

**Migrationen** additiv (neue Tabellen/Spalten), Bestandsdaten unberührt. Der Baustand bleibt das querverdrahtende Objekt.

> **Entscheidungspunkt D-A:** Prozess-Familie = umgewidmete `prozesse`-Tabelle + neue `prozess_items`-Tabelle, oder eigene `familien`-Tabelle. Empfehlung: `prozesse` → Familie umwidmen (spart Migration der bestehenden Akten), Einzelprozesse als Kind-Tabelle.

---

## 3. Querschnitts-Prinzipien (die nicht-verhandelbaren Lehren — in JEDES Modul)

Aus `60_CHANGELOG_L-VAR.md` + den Manifesten. Diese Prinzipien sind der eigentliche Wert des Pakets und werden als Code-Konventionen + Tests verankert:

1. **Kein Auffangzweig.** Jede Klassifikation kommt aus einer Prüfung, nie aus `else`/Default. („`else: deckungsgleich`" = Lüge mit Standardwert; 24 Karten falsch.) → In TS: erschöpfende Diskriminanten, `assert`/throw bei unklassifizierter Zeile.
2. **Weich als Default, hart nur wo der Standard absolut ist.** Ein Gate, das an einem vom Standard vorgeschriebenen Namen stoppt, hat die Latte falsch (Belegfall 07.08. 11:25). → NK-Gate: hart nur bei Kanon-Verstoß + selbstvergebenen Namen; alles andere sichtbar, nicht sperrend.
3. **Das Ergebnis prüft sich selbst.** Jeder Bau endet mit dem vollen Vertrag *am erzeugten Artefakt* + Selbstvermessung; **FAIL bricht ab** — kein ungeprüftes Ergebnis. Ein **Teil-Vertrag ist kein PASS** (eigener Exit-Code). → QA-Kette als Pflicht-Gate vor „freigegeben".
4. **Graph ≠ Text / ❓-Disziplin.** Bindung/Verzweigung/Schleifen-Topologie stehen nicht im Export → nie aus der Statik bestätigen/verneinen, sondern `❓ am Panel/Graph prüfen`. Geratene Felder (`umbruch`) gehen als ❓ durch, nie als Befund.
5. **Kalibrieren vor Bauen (Gate 0).** Erster Lauf zählt, baut nicht; Zählwerte gegen unabhängige Quelle prüfen, dann pinnen. Eine „≥"-Schwelle ist verboten.
6. **Refutation statt Bestätigung.** Prüfagenten versuchen zu *widerlegen*; ein leeres Ergebnis des eigenen Werkzeugs ist ein Verdacht, kein Befund. Neue Muster laufen **beobachtend**, bis 0 Fehlalarme auf Fixtures.
7. **Append-only Tokens.** D-061-Tokens (`-ok/-st/-fb`) werden nie umbenannt/umnummeriert — sonst verlieren gespeicherte Stände ihre Häkchen.
8. **Provenienz & Zwei-Register.** Jede Aussage mit Beleg-Ebene (`[G Text]/[Graph]/[Panel]`); Kunden- vs. YNEO-interne Evidenz getrennt; 🔒 respektieren.
9. **Zustimmung ≠ Zeile.** Was der Export nicht hergibt, bleibt Eingabefeld — nie erfunden.

---

## 4. Die Phasen

Jede Phase liefert etwas Nutzbares, respektiert Abhängigkeiten, ist gegen Fixtures testbar.

### Phase 0 · Fundament & Weichen (Voraussetzung für alles)

| Baustein | Inhalt | Andockpunkt |
|---|---|---|
| **Koordinaten-Extraktion** | Umstieg von `pdftotext -layout` (Text) auf **`pdftotext -bbox`/`-tsv`** (Wort-Koordinaten) → Spalten-Raster-Bucketing (ID/Name/Typ/Init/Schnittstelle) nativ in TS. Zeilen-Kleben mit `umbruch`-Markierung. Zwei Zeitstempel + Nummern-Guard. Poppler ist schon da — **kein Python**. | ersetzt/erweitert `checker/parse.ts` → gemeinsamer `extract/`-Layer |
| **Datenmodell** | §2-Erweiterung (Familie/Prozess-Item/Variable/CFG/Register), additive Migration | `db/schema/echoloop.ts` + `0029_echoloop_*.sql` |
| **QA-/Gold-Backbone** | Gold-Runner-Prinzip (DRIFT vs. REGRESSION) + Fixture-Harness; **Übungsfall** als erstes Fixture (fiktiv, compliance-sicher) | neues `qa/`-Modul + `bun test`-Integration |
| **Governance & Sicherheit** | Rollen PROD/PROJ (App-Permissions), **Tresor-Sweep** (kein Secret in Baustand/Artefakt/Export), Telemetrie-Senke (append-only) | `permissions` + `qa/tresor.ts` + `telemetrie`-Tabelle |
| **Compliance-Gate** | Heinzl-Golden-Set erst nach O-14-/Zweckbindungs-Klärung; bis dahin nur Übungsfall | Prozess/Doku, nicht Code |

**DoD Phase 0:** Koordinaten-Extraktion liefert typisierte Variablen-Zeilen auf dem Übungsfall in gepinnter Zahl (Gate-0-Kalibrierung grün); Gold-Runner läuft gegen den Übungsfall.

### Phase 1 · L-RGA / L-BAU auf Referenz-Reife (additiv auf Vorhandenem)

| Baustein | Inhalt | Andockpunkt |
|---|---|---|
| **Prüfmuster PM-15…21 + PM-12** | die fehlenden Muster (Referenz `_pruefmuster_check.py` bis PM-21), inkl. beobachtender Muster (laufen still bis 0 FP) | `checker/patterns.ts` + `runChecker` |
| **Analyse-Tiefen T-A/B/C** | Deklaration je Baustand (Seite-1-Prinzip) + Klassen-Scan-Pflicht (Muster über den ganzen Export-Satz, nicht Einzelfund) + Vollständigkeits-Regel (Panel-Pflichtliste) | Baustand-Feld + `analysis.ts` + Panel-UI |
| **Zwei-Naturen im Scoring** | Level-Klassen L1–L3 (Robustheit) / L4–L5 (Skalierung); **Vereinbarungs-Gates** an D6-L3/D7-L4/D9-L4/D10-L2 mit **Doppel-Nachweis** (T-A Statik + T-B/T-C gelebt); Zwei-Naturen-Sprache in der Kundenfassung (R6) | `scoring.ts` + `narrative.ts` |
| **Bauanleitung Fundament-Welle (R4)** | jede Bauanleitung startet mit „Fundament ohne Umbau": Config-Bootstrap · Erfolgs-Semantik (`A_Ergebnis` OK/NICHTS-ZU-TUN/GESTOPPT) · Prozess-Kopfblock | `bauanleitung.ts`-Prompt/Struktur |
| **PA-Prüfagenten-Fan-out** | statt einer LLM-Vor-Benotung: PA-F1 Wertfehler-Ketten · PA-F2 Schleifen/Timing · PA-F3 Melde-Vollständigkeit · PA-F4 Wiederanlauf — je adversarial (Refutation) mit eigener Fixture; deterministischer Checker gewinnt bei Determinismus, Agent bei Kontext | `analysis.ts` → neues `pruefagenten/`-Modul (Fan-out via mehrere `llmService.chat`) |
| **K1-Report-Export** | Kundenfassung + Bauanleitung + Kennzahlen → YNEO-branded HTML/PDF (Design-System, Living-Styleguide) | neue Route `GET /baustaende/:id/report.(html|pdf)` |

**DoD Phase 1:** RGA gegen das (fiktive) Golden-Fixture reproduziert die gepinnten Kennzahlen; PA-Fan-out 0 FP auf Fixtures; QA-Kette blockt bei Vertrags-Fehlschlag.

> **Abstimmungspunkt mit Seb (A-1):** Die WB44-§3b-Gate-Ergänzungen sind laut Zwei-Naturen-Standard „offen — Review-Termin" (WB-Dateien nur im Review). Wir bauen die **Darstellung + Prüfung** der Vereinbarungs-Gates; die **normative** WB44-Änderung ziehen wir mit Sebs Review nach, laufen nicht voraus.

### Phase 2 · L-VAR (Variablen-Explorer) nativ — das große neue Verfahren

Als neuer Tab/Bereich der Prozess-Familie, drei Reiter (native React statt Fremd-HTML):

| Reiter | Inhalt | Andockpunkt |
|---|---|---|
| **1 · Variablen-Inventar** | typisierte Variablen-Zeilen (aus Phase-0-Extraktion) · **NK-Gate G1–G7** (Kanon `C_/H_/T_`/Fachwert/`A_Ergebnis`, Grammatik, Synonyme, Mehrfach, Entscheidungsquote, Vokabular, Format) · **Namenskopplung** (verschiedene Prozesse = Konsolidierung, selber = Dublette) · Umbenennen-Cockpit (D-061 abhaken/Status/Feedback) · Facetten-Filter | neues `lvar/`-Backend + `frontend/apps/echoloop/lvar/` |
| **2 · Prozess-Steckbriefe** | je Prozess Ist/Soll-Paar (Name · Typ §A9 MP/TP/SP · Kritikalität+Grund · Beschreibung · erwartetes Ergebnis) · Kopier-Knöpfe · Soll-Kaskade `Entschieden > Twin(RGA) > Struktur-Ableitung` | `lvar/steckbriefe.ts` |
| **3 · CFG-Generator** | CONFIG-Excel als Projektion (ein Schlüssel je `C_`-Zielname) · **7 Diff-Klassen** (gleich/abweichend/unklar/nur_excel/nur_panel/fehlend/nicht_verglichen) · Modi ERSTANLAGE/ABGLEICH (selbsterkennend) · Split je CONFIG-Prozess · Export CSV + .xlsx (nativ, offline) | `lvar/cfg.ts` + xlsx-Writer |
| **Verzahnung** | **Pfad-Wiederholungs-Analyse** (`pfad_befunde`) → RGA D9/D10 · **NK-Zustand** → RGA D6/D9/D10 + Einseiter · **Twin-Import** (RGA `window.DATA`) → Reiter-2-Soll · Kalibrier-Gate (Gate 0) · Fingerprints (Recheck) | Baustand-Querverdrahtung |

**DoD Phase 2:** L-VAR auf dem Übungsfall trifft die gepinnten Zahlen (5 Prozesse · 30 Variablen · 24→21 Namen · 1 CFG); auf Heinzl (nach Compliance) 46/597/256; die 7-Klassen-Diff reproduziert Sebs „aus 70-Zeilen-Falschalarm → 0 Falschbefunde".

### Phase 3 · Weitere Verfahren (Skills → App-Features)

| Skill | Wird | Inhalt |
|---|---|---|
| `/prozess-start` | **App-Feature** | Einbau-Tabelle (Nr · NK-Vorschlag · Typ MP/TP/SP · Kopfblock-Text · Beschreibung · `C_ProzessTyp` · Frische-Kontrakt · Umbenenn-Risiko) + interaktive PS-1-Karten |
| `/umbau` | **App-Workflow** | Umbenennung in Wellen W0–W5 (Vorflug/Kalibrierung → `H_` → `C_`+CONFIG → Fachwerte → Tippen → Prozessnamen), je Welle Gate + Rückläufer-Reconcile |
| `/wertfehler` | **App-Feature** | Incident-Flow nach Franks 6-Schritt-W-Verfahren (sporadisch/konstant → Ursprungs-Kette → letzter belegter Punkt → Weglassprobe → Umgebung → Fix), Fixture-Rückfluss |
| **Basis-Bausteine** (K-68) | Erkennung im Call-Graph | familienübergreifende Prozesse (Aufrufer aus ≥2 Familien, allgemeingültige Präfixe, kein familieneigener Datenzugriff) → namensraumfreier Namensvorschlag |

**Out-of-Scope für die echoloop-App (Empfehlung, Abstimmungspunkt A-2):** `/zusagen` (Transkript-Sweep), `/uebergabe` (Session-Übergabe), `/angebot` (Vertrieb) sind **Agent-/Plattform-Verfahren**, kein Prozess-Analyse-Feature — sie gehören eher an die Plattform-Ebene (Assistants/Session-Ops) bzw. eine eigene Angebots-App, nicht in echoloop. → mit Seb bestätigen, ob „komplette Integration" diese drei einschließt.

### Phase 4 · Betrieb, Härtung, Mandant

| Baustein | Inhalt |
|---|---|
| **T-B Betriebsdaten-Ingest** | neue Datenklasse (Logs/Archive/Result-Excels als Zeitreihe) → hebt Analyse-Tiefe T-A→T-B (stille Langzeitfehler sichtbar) |
| **Register-Workflows** | Gold-Registry (supersede-not-overwrite) · Bauweg-Register (Variante + „kippt_wenn") · **Regel-Backlog** (Kandidat → Review → Standard) als App-Workflow — „Standards ändern wir nur im Review, nie nebenbei" |
| **Telemetrie & Lagebild** | append-only Skill-Nutzung + Session-Start-Lagebild; Verbrauchs-Gates (Kontext/Modell) als Betriebs-Guardrails |
| **Governance-Durchsetzung** | PROD (Standards/Prüfer/Engine-Logik) ↔ PROJ (Anwendung + Kandidaten) als Rechte-Modell je Instanz |
| **White-Label / Mandant** | Branding je Instanz (R1-Pfad-Entkopplung ist in unserer nativen App keine Frage mehr — kein absoluter Pfad; das erledigt sich beim Neubau) |

---

## 5. Reihenfolge, Aufwand, Risiko (Überblick)

| Phase | Kern-Nutzen | Aufwand | Risiko | Abhängig von |
|---|---|---|---|---|
| **0 Fundament** | Koordinaten-Extraktion + Datenmodell + Gold-Gate | mittel–groß | mittel (Extraktions-Raster kalibrieren) | Compliance-Klärung für echte Daten |
| **1 L-RGA-Reife** | additive Sprünge, sofort Produkt-Wert | mittel | gering (additiv) | Phase 0 (Extraktion), A-1 (WB44-Review) |
| **2 L-VAR** | das große neue Verfahren | **groß** | mittel (7-Klassen-Diff, NK-Gate, xlsx) | Phase 0 |
| **3 weitere Verfahren** | Prozess-Start/Umbau/Wertfehler | mittel | gering | Phase 1+2 |
| **4 Betrieb** | T-B, Register, Governance, Mandant | mittel | gering | alle |

**Kritischer Pfad:** Phase 0 (Extraktion + Datenmodell) → dann laufen Phase 1 und 2 weitgehend parallel. Empfohlener Start: **Phase 0**, und darin zuerst die **Koordinaten-Extraktion** (sie trägt L-VAR *und* die bessere L-RGA-Evidenz) + das **Gold-Gate mit dem Übungsfall** (compliance-frei, macht ab sofort jede Änderung reproduzierbar prüfbar).

---

## 6. Compliance & IP (Gates, nicht optional)

- **Heinzl-Golden-Set** = echte, unanonymisierte Kundendaten → **nicht** ins Repo/UI, bis O-14 + Zweckbindung/Einwilligungsumfang schriftlich geklärt sind. Entwicklung + Tests laufen bis dahin auf dem **fiktiven Übungsfall**; das echte Set nur lokal/gesperrt als Backend-Fixture (🔒), nie kundenübergreifend.
- **O-14 Layer-Besitz** wird durch die Vollfassung dringlicher (kompletter Produktkern) — Speicher-/Export-Hoheit + Löschbarkeit vertraglich.
- **Tresor-Regel** in der App: kein Klartext-Secret in Baustand/Artefakt/Export (Sweep bricht ab) — Teil des Backbones (Phase 0).

---

## 7. Abstimmungspunkte mit Seb (Entscheidungen, keine Blocker)

- **A-1 · WB44/Zwei-Naturen:** Wir bauen Darstellung + Prüfung der Vereinbarungs-Gates; die normative WB44-Änderung + der endgültige Level-Klassen-Text kommen aus eurem Review — wir laufen nicht voraus.
- **A-2 · Skill-Scope:** Sind `/zusagen`, `/uebergabe`, `/angebot` Teil der „kompletten Integration" (dann Plattform-/eigene-App-Ebene) oder bleiben sie Agent-Verfahren außerhalb echoloop?
- **A-3 · Golden-Set-Compliance:** Dürfen die echten Heinzl-Daten überhaupt in eine Instanz, oder dauerhaft nur Übungsfall + Heinzl gesperrt-lokal?
- **A-4 · NK-Varianten (❓F5):** Rollen-Suffix (`_MASTER`) vs. Leipzig-Typ-Präfix (`MP-`) — ist das entschieden, oder bauen wir „je Familie eine, konsequent"?
- **A-5 · SE-B/SE-W:** bleibt Konzept, oder wollt ihr die Formel-Aufspaltung — dann brauchen wir eure normative Definition.
- **A-6 · Regel-Governance:** Übernehmen wir den Regel-Backlog als App-Workflow (Kandidat→Review→Standard), und wer ist PROD-Owner im Workplace?

---

*Dieser Plan ersetzt die frühere „Engine-betreiben"-Empfehlung aus `…integration-analyse-2026-08-16.md` §3 bewusst: Auftrag ist die native Reimplementierung. Die Analyse-Doku bleibt als Detail-Referenz (was PAKET_2 enthält) gültig.*
