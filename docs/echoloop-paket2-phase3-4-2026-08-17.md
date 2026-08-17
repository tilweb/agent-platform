# Echo-Loop · PAKET_2-Integration — Phase 3 + 4 (+ Heinzl-Kalibrierung)

**Datum:** 2026-08-17 · **Referenz-Plan:** `echoloop-paket2-integrationsplan-2026-08-16.md` · **Baut auf:** Phase 0/1/2
**Rahmen:** native TS-Reimplementierung. Referenz = Sebs Python/Skills/Standards (portiert wird die Logik, nicht der Code). Kalibriert am fiktiven Übungsfall; echte Heinzl-Daten **nur lokal, nie im Repo**.

---

## 1. Kontext

Nach den beiden großen Verfahren (Phase 1 L-RGA, Phase 2 L-VAR) deckt Phase 3 die **weiteren Skills als App-Features** ab und Phase 4 den **Betrieb/Governance**. Zentrale Erkenntnis dieser Runde: **nicht jeder PAKET_2-Skill gehört in die Echo-Loop-App** — zwei operieren auf Gesprächen/Sessions statt auf EMMA-Prozessen und wurden bewusst nicht gebaut (Details §2.5). Abschließend wurde die Koordinaten-Extraktion **lokal gegen echte Heinzl-Ausleitungen** kalibriert (§4).

---

## 2. Phase 3 — weitere Verfahren (Skills → App-Features)

### 2.1 /prozess-start (`lvar/prozessstart.ts`)
Die **8-Spalten-Einbau-Tabelle** je Prozess (Kern-Deliverable, „Sprechzettel am Panel"): Nr+Ist · Namens-Vorschlag (§A2) · Typ MP/TP/SP + 1-Satz-Begründung · **Kopfblock** (§A8: `Name · vX.Y · Zweck · Owner · Takt · Typ · NK`) · Beschreibung · **C_ProzessTyp** · **Frische-Kontrakt** (nur SP: T_LetzterLauf/T_StandDatum, Verstoß wenn beide fehlen; Schwelle als ❓ Fachbereichs-Entscheid) · **Umbenenn-Risiko** (Aufrufer aus Call-Graph, Wirkung = `[Panel]`-❓, nie statisch verneint). Baut auf den Steckbriefen auf. Als **4. Reiter** im L-VAR-Explorer.

### 2.2 /wertfehler (`checker/patterns.ts` PM-W-a + `checker/wertfehler.ts`)
Die teuerste, **stille** Fehlerklasse („Prozess läuft weiter, Wert ist falsch/leer"). **PM-W-a** (Key-basiertes Tippen, Keybased:True verliert Umschalt-/Doppelzeichen) neu portiert — inkl. Parser-Erweiterung für `Keybased`/`Text`/`_NoModificationText`. Damit sind **alle drei statischen W-Muster** (PM-W-a/b/c) nativ. Die **Wertketten-Analyse** strukturiert die W-Befunde entlang der **6-Stationen-Herkunftskette** (Ursprung→Aufnahme→Ablage→Umformung→Übertragung→Ziel) und führt W2/W3 (Prüf-Entscheidung, Sentinel/Altwert) als stehende ❓-Panel-Fragen. Als **Wertfehler-Kette-Sektion** im K1-Report. **Befund:** über PM-W-a hinaus gibt es kein neues statisches Muster — W2/W3 sind prinzipiell nur am Panel entscheidbar (→ PA-F1).

### 2.3 /verbrauch (`verbrauch.ts`)
Token-/Kosten-Messung: **4-Felder-Kostenformel** (`in·in_preis + out·out_preis + cr·cache_read + cw·cache_write`) mit Preistabelle je Modell (Opus/Fable/Sonnet/Haiku + `_default`), Aggregation (Züge, je Modell, Kontext-Wiederholungs-Anteil, Züge >600k), **Budget-Ampel** (🟡50/🟠80/🔴100 %, Default 150 USD) und **Kontext-Wächter** (400/600/800k je Zug). Token-Zahlen exakt, USD Schätzung bis geeicht. Dockt an die append-only Telemetrie-Senke (`el_telemetrie`, verfahren='verbrauch') an.

### 2.4 Artefakt-QA-Gate (`report-qa.ts`) — Übergabe Gate B
Die fachlich passende Hälfte von „/uebergabe": die **Selbstprüfung des Artefakts vor Freigabe** (§3.3 „das Ergebnis prüft sich selbst"). Prüft Pflicht-Elemente (Kennzahlen · vollständiges Profil · Evidenz-Disziplin: maskiert nur mit Begründung) + weiche Prüfungen (Analyse-Tiefe deklariert, Kundenfassung bei Freigabe). **Verdikt VOLL/TEIL/FAIL** — „ein Teil-Vertrag ist kein PASS". In die **Freigabe-Route** verdrahtet: FAIL blockt (HTTP 422 + Verstoßliste, `force`-Override), Frontend zeigt die Verstöße.

### 2.5 Domänen-Befund: bewusst NICHT gebaut
- **`/zusagen`** ist ein **Gesprächs-Intake** (durchforstet Transkripte/VTTs nach Aufgaben, 5-Klassen-Raster, routet an GESPRAECHSSPEICHER/Aufgaben-Board/Cockpit/DECISIONS) — operiert auf Meetings, nicht auf EMMA-Prozessen.
- **`/uebergabe`-Gate-A** ist die **Session-Übergabe an einen neuen Chat** (Staffelstab-Register mit DoR-Haken/Session-Tags) — allgemeiner Agent-Workflow.
- Beide gehören in den Workplace/Zwilling, nicht in die Echo-Loop-App. Gebaut wurden die zwei Echo-Loop-relevanten Teile (/verbrauch + Artefakt-QA).

---

## 3. Phase 4 — Betrieb, Härtung, Governance (`betrieb/`)

### 3.1 Register-Workflows (`betrieb/register.ts`)
- **Regel-Backlog** als Zustandsmaschine: `kandidat → beobachtend → im_review → standard | verworfen`. Der einzige Weg zu „standard" führt durchs Review („Standards ändern wir nur konsolidiert im Review, nie nebenbei"). `istScharf` = nur promotete Muster eskalieren hart. **Dies ist der Promotions-Weg für die „beobachtend bis 0 FP"-Muster aus Phase 1–3** (PM-12/17/W-a/b/c, PA-Befunde).
- **Gold-Registry** mit **supersede-not-overwrite**: ein neu gepinnter Wert löst den alten ab (Historie bleibt, jede Änderung erklärbar), nie überschrieben.
- **Bauweg-Register** (Variante + `kippt_wenn`).

### 3.2 Lagebild (`betrieb/lagebild.ts`)
Session-Start-Überblick aus der Telemetrie-Senke: Ereignisse je Verfahren/Event, Verbrauch (Züge · Tokens · USD-Schätzung + Budget-Ampel via `verbrauch.ts`), jüngster Gold-Lauf (PASS/FAIL), Tresor-Funde; als Ein-Zeilen-Lage + Struktur.

### 3.3 Governance PROD ↔ PROJ (`betrieb/governance.ts`)
Rollen-Modell je Instanz (ENV `ECHOLOOP_ROLLE`, Default PROJ): **nur PROD** schaltet scharf (Standard-Promotion + Standard-Änderung), **PROJ** wendet an + meldet Kandidaten — nie beides (der Grund, warum vier Instanzen dieselbe Qualität liefern). `pruefeGovernance` gated die Regel-Backlog-Promotion.

### 3.4 Offen (Infra, nicht Kernlogik)
- **T-B Betriebsdaten-Ingest**: Upload-Route + Storage für Logs/Archive/Result-Excels als Zeitreihe → hebt Analyse-Tiefe T-A→T-B. Das Regelwerk (Analyse-Tiefen I2→T-B) steht; der Datei-Ingest fehlt.
- **White-Label/Mandant**: weitgehend über Plattform-`PLATFORM_TITLE` erledigt (keine absoluten Pfade mehr).

---

## 4. Heinzl-Kalibrierung (lokal, Compliance-konform)

Lokaler Kalibrier-Runner (im Scratchpad, **nichts ins Repo**) gegen die echten Heinzl-Ausleitungen (46 Prozesse · 597 Variablen). Nur Aggregat-Kennzahlen, keine Kundendaten.

**Kernbefund — die Extraktion hält auf echten Daten:** Variablen-Präsenz 97,8 % · name **99,5 %** · typ **100 %** · init **99,8 %** · schnitt **99,8 %** · fund 97,9 % · ausgaenge 100 %. Damit ist validiert, was der Übungsfall laut LIESMICH nicht beweisen konnte: das synthetisch kalibrierte Spalten-Raster transferiert auf echte EMMA-Exporte.

**Optimiert:** **Zeitstempel 0 % → 89,1 %** — der Prozess-Stand steht in **Klammern** `(DD.MM.YYYY HH:MM:SS)`, bei echten Exporten im Body (nicht in der `Prozess N:`-Kopfzeile). Erkennung umgestellt (`extract/emma.ts`), deckt beide Fälle; Übungsfall-Gold-Runner bleibt 5/5.

**Verbleibende Realdaten-Edge-Cases (kein Bug):**
- **aufrufe 82,6 % · cvrefs 76,1 %** — die `{CV:nnn}`-**Slot-Semantik** (löst EMMA über Nummer oder Namen auf?) ist Franks ausdrücklich offene Frage; der Übungsfall entschärft den Fall bewusst. Härtung erst nach Klärung, sonst raten.
- **13 nicht gematchte Variablen (2,2 %)** — vereinzelte Umbruch-/Raster-Kanten.

---

## 5. Verifikation

```
bun test src/apps/echoloop/   → 227 pass · 0 fail · 26 Dateien
tsc --noEmit                  → keine echoloop-Fehler
Frontend-Build                → grün, eslint 0 Errors
Heinzl-Extraktion (lokal)     → Variablen-Felder 99,5–100 %, Zeitstempel 89,1 %
```

Commits Phase 3/4/Kalibrierung: `e47d5e6` /prozess-start · `9170ce2` /wertfehler · `a94beff` /verbrauch+QA · `d2b66db` Phase-4 betrieb · `d9a5e90` Zeitstempel-Fix. Alle auf `origin/main` gepusht (Stand 2026-08-17).

---

## 6. Offene Punkte (Gesamt)

| # | Punkt | Art | Nächster Schritt |
|---|---|---|---|
| 1 | O-14 / Zweckbindung (Vertrag) | Entscheidung (du/Seb) | Layer-Besitz + Speicher-/Export-Hoheit vertraglich klären |
| 2 | A-1 (WB44-§3b normativ) | Seb-Review | Papier-Level-Wirkung aufs Ist im Review festlegen |
| 3 | A-PM (PM-13/14-Nummern) | Seb-Review | umnummerieren oder umbenennen, dann Sebs PM-13/14 portieren |
| 4 | `{CV:nnn}`-Slot-Semantik | Frage an Frank | dann cvrefs/aufrufe härten |
| 5 | T-B Betriebsdaten-Ingest | Infra | Upload-Route + Storage |
| 6 | NK-Gate/CFG-Heinzl-Kalibrierung | optional | `_varliste_hzl_namen.py`-MAP parsen, lokal fahren |
| 7 | /zusagen · /uebergabe-Gate-A | out of domain | nur als separate Workplace-Features |

**Durchgehalten:** portiert statt erfunden · deterministisch vs. Mensch · Golden-first · Heinzl-Daten nie im Repo (verifiziert).
