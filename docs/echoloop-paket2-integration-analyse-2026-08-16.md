# PAKET_2 (L-VAR v3.11) — Integrations-Analyse gegen die bestehende Echo-Loop-App

**Für:** Andi (→ Sebastian) · **Stand:** 2026-08-16
**Quelle:** `docs/Echo-Loop-App/PAKET_2/` (L-VAR-Vollfassung v1.0, Engine v3.11) + E-Mail Seb 08.08.
**Bezug:** aktuelle App `backend/src/apps/echoloop/` + `frontend/src/apps/echoloop/` (Stand-Doku `docs/echoloop-app-stand-und-roadmap-2026-08-06.md`)

---

## 0. Kurzfassung

Sebastian hat nicht ein Werkzeug geliefert, sondern **den kompletten Betriebsstand seines operativen Programms** — Engine, Werkzeuge/Gates, echtes Golden-Set, 8 Skills, Telemetrie, Regel-Backlog und die Vorfälle, aus denen jede Regel stammt. Drei Dinge verändern das Bild:

1. **L-VAR (Variablen-Explorer) ist ein neues, drittes Verfahren** neben unserem L-RGA (Reifegrad) und L-BAU (Bauanleitung). Es analysiert **Variablen, Prozesse, CONFIG-Excel und Namenskonvention** — das haben wir gar nicht.
2. **Der Zwei-Naturen-Standard** und die **Analyse-Tiefen (T-A/B/C)** erweitern die Methodik, die unsere App implementiert — sie ändern, *wie* benotet wird und *was* eine Bauanleitung enthält.
3. **Das Golden-Set + der Gold-Runner** füllen genau die Lücke, die ich in der Stand-Doku als offen markiert hatte (Golden-Data-Regressions-Gate / O-16).

Und: **unsere App ist eine TypeScript-Reimplementierung eines *früheren* Stands von Sebs `/rga`-Skill.** Sein Referenz-Stand ist heute deutlich reifer (PM-01…21 statt unserer ~9, koordinatenbasierte Extraktion, K1-HTML, Twin, Analyse-Tiefen, adversariale Prüfagenten). Daraus folgt die **eine große Architektur-Entscheidung** dieses Pakets (§3).

**Compliance zuerst (§8):** Das Golden-Set trägt **echte, unanonymisierte Heinzl-Daten**. Seb flaggt es selbst. Vor jeder Integration/Commit/Instanz-Ablage klären.

---

## 1. Das operative Programm — und wo unsere App darin steht

Sebs Programm besteht aus **8 Skills** (formalisierte Verfahren, `PAKET_2/50_Skills/`):

| Skill | Was es tut | Bezug zur App |
|---|---|---|
| `/rga` | Reifegrad-Analyse D1–D10 + K1-Kundenfassung + Bauanleitung | **= unsere App** (RGA-Review + Kundenfassung + Bauanleitung) — aber reifer |
| `/variablen` | **L-VAR** — Variablen-Explorer (3 Reiter) | **fehlt uns komplett** |
| `/prozess-start` | Fundament-Installation: Einbau-Tabelle, Typ MP/TP/SP, Kopfblock | fehlt (Kandidat für App-Feature) |
| `/umbau` | Familien-Umbenennung in Wellen W0–W5 unter Last | fehlt (Agent/Workflow-Verfahren) |
| `/wertfehler` | Wertfehler-Incident (Franks 6-Schritt-W-Verfahren) | fehlt (Kandidat) |
| `/zusagen` | Zusagen-Sweep über Transkripte | außerhalb App-Scope |
| `/uebergabe` | Session-Übergabe mit Memory | außerhalb App-Scope |
| `/angebot` | Kunden-Angebote (SSOT → Angebot → Checker) | außerhalb App-Scope |

**Kernbefund:** Unser echoloop-`RGA-Review` ist die Workplace-native Umsetzung von `/rga` — auf einem früheren Stand. `/variablen` (L-VAR) ist das große neue Stück. Die übrigen Skills sind überwiegend Agent-/Prozess-Verfahren, nicht App-Features (einige — `/prozess-start`, `/wertfehler` — könnten es werden).

---

## 2. Was L-VAR (Variablen-Explorer) technisch ist

Eine Python-Engine (`10_Engine/`, `ENGINE_VERSION=v3.11`), die **je Prozess-Familie ein selbsttragendes, interaktives HTML** erzeugt — drei Reiter in einem Artefakt:

- **Reiter 1 · Variablen-Inventar** — alle Variablen-Vorkommen (Heinzl: 597 aus 46 Prozessen), je Vorkommen abhakbar/Status/Feedback (D-061), Facetten-Filter, **NK-Ampel G1–G7**, Cross-Prozess-**Namenskopplung** (EMMA koppelt über Namensgleichheit → Alt-Namen in *verschiedenen* Prozessen = Konsolidierung, im *selben* = Dublette).
- **Reiter 2 · Prozess-Steckbriefe** — je Prozess ein **Ist/Soll-Spaltenpaar** (Name · Typ §A9 MP/TP/SP · Kritikalität+Grund · Beschreibung · erwartetes Ergebnis) mit Kopier-Knopf je Feld; Soll-Kaskade `PROZESSE_SOLL_META > Twin(RGA) > Struktur-Ableitung`, immer als sichtbarer Vorschlag.
- **Reiter 3 · CFG-Generator** — die CONFIG-Excel als **Projektion** des Variablen-Inventars (ein Schlüssel je `C_`-Zielname), **7 Diff-Klassen** gegen Bestands-Excel, Modi ERSTANLAGE/ABGLEICH, Split je CONFIG-Prozess, Export als CSV + echte .xlsx (im Browser gebaut, offline).

**Technisch relevant für uns:**
- **Extraktion koordinatenbasiert via PyMuPDF/fitz** (`page.get_text("words")` + Spalten-Raster `SP_ID=120/NAME=235/TYP=305/INIT=420`) — **präziser als unser text-basierter `pdftotext`-Parser**. Für die Variablen-Tabelle (typisierte Zeilen: id/name/typ/init/schnittstelle) ist das nötig; unser Text-Parser reicht dafür nicht.
- **Zeilen-Kleben mit `umbruch`-Markierung** (der „`EMMA- Prozesse`"-Phantompfad-Bug) — geratene Felder gehen als ❓ durch, nie als Befund.
- **Pfad-Wiederholungs-Analyse** (`cfg_generator.pfad_befunde`: „der Stamm erscheint N× in der Datei") — **speist die RGA-Dimensionen D9/D10** zurück. Das ist eine echte Verzahnung L-VAR → L-RGA.
- **Selbstprüfendes Artefakt (v3.11):** Jeder Bau endet mit dem vollen Vertrag (E1–E5, ~70 Prüfungen) *am erzeugten HTML* + Browser-Selbstvermessung (Geometrie, Pflicht-Elemente, Handler, hell/dunkel); **FAIL bricht den Lauf ab** — kein ungeprüftes Ergebnis.
- **Betriebsmodell „3 Anschlüsse, sonst nichts":** Dateiablage je Kunde · Telemetrie-Senke (append-only) · Ausgabekanal für HTML. **Kein Server, kein Netz zur Laufzeit.** Genau darauf ist die Engine ausgelegt.

---

## 3. Die große Entscheidung: L-VAR reimplementieren vs. Sebs Engine betreiben

Das ist der Kern der Integration. Zwei Wege:

**A) Sebs Python-Engine im Workplace betreiben** (die „3 Anschlüsse" bedienen)
- ✅ Sofort auf v3.11-Reife, selbstprüfend, gepinnt gegen das Golden-Set; Engine-Bumps kommen allen zugute (kein Klon-Drift).
- ✅ Respektiert Sebs Governance (PROD schreibt Engine, PROJ wendet an) — im Workplace eine Rollen-/Rechte-Frage.
- ⚠️ Neue Laufzeit-Abhängigkeit: **Python + PyMuPDF** im Container (bisher nur poppler/ffmpeg/tesseract). Machbar (wie tesseract), aber ein Novum.
- ⚠️ Das Deliverable ist ein **externes, selbsttragendes HTML** — es müsste in die App-UI eingebettet werden (iframe/Artefakt-Speicher), nicht nativ gerendert. Der Baustand-Datenfluss (unsere `dimensionen`/`befunde`) bekäme das HTML als Artefakt, nicht als strukturierte Daten (es sei denn, wir lesen `window.DATA`/`_NK-STAND_*.json` zurück — die Engine liefert die JSONs).
- ⚠️ **R1 Pfad-Entkopplung** ist Voraussetzung (die Engine leitet 5 Fundorte aus der Ordnertiefe ab; `engine.config.json` kommt erst nach Sebs Kundenumbau).

**B) L-VAR in TypeScript reimplementieren** (wie wir es mit `/rga` gemacht haben)
- ✅ Native Integration in die App (Daten im Baustand, UI in unserem Stil, keine Python-Abhängigkeit).
- ❌ **Sehr großer Aufwand**: koordinatenbasierte fitz-Extraktion, 3 Reiter, 7-Klassen-CFG-Diff, In-Browser-xlsx, NK-Messung G1–G7 — plus die Nachpflege bei jedem Engine-Bump (Klon-Drift, genau das, was Sebs Governance vermeidet).
- ❌ Wir müssten die Vorfälle-Lehren (60_CHANGELOG_L-VAR) neu erleiden oder mühsam nachbauen.

**Empfehlung:** **Hybrid, Weg A für L-VAR.** L-VAR als Engine betreiben (Python-Service, 3 Anschlüsse), das HTML als Baustand-Artefakt speichern **und** die von der Engine erzeugten JSONs (`_varliste_*_daten.json`, `_NK-STAND_*.json`, `pfad_befunde`) strukturiert zurücklesen — daraus D6/D6b/D9/D10-Belege + den NK-Zustand in die RGA speisen. Unser **L-RGA bleibt TypeScript** (native, bereits gebaut), wird aber gegen den Referenz-Stand nachgezogen (§4). So bekommen wir L-VAR schnell + reif, ohne Klon-Drift, und behalten die native RGA-Erfahrung. Diese Entscheidung gehört mit Seb abgestimmt (§9).

---

## 4. Feature-für-Feature: neu / überlappt / ändert unsere Implementierung

| Thema | PAKET_2 | Unsere App heute | Konsequenz |
|---|---|---|---|
| **SE-Formel / RG*/RGQ** | `SE=Σr·min(Ist,Soll)/Σr·Soll`, RG*=min relevant, RGQ=Σ/50 | **identisch** (`scoring.ts`) | ✅ deckungsgleich — keine Änderung nötig |
| **Prüfmuster** | PM-01…21 (+ beobachtende PM-16…21, PM-RX; Referenz `_pruefmuster_check.py` bis PM-21) | PM-01/02/03/04/04b/09/10/13/14 (~9) | ⏫ **wir sind hinten** — PM-15…21 + Varianten nachziehen (oder Referenz-Checker nutzen) |
| **PDF-Extraktion** | koordinatenbasiert (fitz, Spalten-Raster) | text-basiert (`pdftotext -layout`) | für L-VAR nötig; für L-RGA-Befunde reicht unser Parser, wäre aber präziser |
| **Zwei-Naturen-Standard** | L1–L3 Robustheit (gebaut) vs. L4–L5 Skalierung (vereinbart); **Vereinbarungs-Gates** an D6-L3/D7-L4/D9-L4/D10-L2 mit Doppel-Nachweis (Statik + gelebt) | Scoring kennt nur ein Level je Dim, kein Gate-Konzept | 🆕 **erweitert unser Scoring**: Level-Klassen + Gate-Bausteine + T-A/T-B/T-C-Doppelnachweis. SE-B/SE-W ist ein **Konzept** (noch keine Formeländerung) |
| **Analyse-Tiefen (AT-1)** | jede RGA deklariert T-A (nur Exporte) / T-B (+Betriebsdaten) / T-C (vollständig) auf Seite 1; T-B braucht Logs/Archive | wir deklarieren keine Tiefe; wir lesen keine Betriebsdaten | 🆕 **neue Anforderung** + neue Datenklasse (Betriebsdaten-Ingest für T-B) |
| **Namenskonvention (NK-1)** | Kanon `C_/H_/T_`/Fachwert/`A_Ergebnis`; Struktur `<NS>_<Familie>_<Funktion>[_Rolle]`; §A9 MP/TP/SP; Frische-Kontrakt; G1–G7-Gate (soft default, hart nur bei Kanon-Verstoß) | kein NK-Check | 🆕 **neues Gate** (kommt mit L-VAR / `nk_messung`) |
| **Bauanleitung (Fundament-Welle R4)** | jede Bauanleitung startet mit „Fundament ohne Umbau": Config-Bootstrap · Erfolgs-Semantik (EINE `A_Ergebnis`-Variable OK/NICHTS-ZU-TUN/GESTOPPT) · Prozess-Kopfblock | unsere Bauanleitung ordnet nach ❓→Kundenfehler→Blocker→Härtung, **ohne** Fundament-Welle | 🆕 **erweitert unsere Bauanleitungs-Generierung** (R4 als erste Welle) |
| **Prüf-Ebenen / PA-Prüfagenten** | 3 Stufen: (1) deterministischer Checker, (2) **PA-F1…F4 Fan-out** (adversarial, Refutation, je Fixture), (3) Betriebsdaten-Gegencheck T-B | (1) Checker + (2) **eine** LLM-Vor-Benotung | 🔀 unsere LLM-Stufe ist simpler; die PA-Fan-out-Idee (mehrere adversariale Prüfer je Fixture) wäre ein Reife-Sprung |
| **Golden-Data / Gold-Runner** | `GOLD_HZL-REPA` (gepinnt 46/597/256) + fiktiver Übungsfall; `_gold_runner.py` (DRIFT vs. REGRESSION) | nur Unit-Tests, kein Regressions-Gate | 🆕 **füllt die O-16-Lücke** — als Backend-Regressions-Suite einbinden |
| **Telemetrie / Governance** | append-only `_SKILL-NUTZUNG.md`; PROD schreibt Engine ↔ PROJ wendet an | keine Telemetrie; Rollen = App-Permissions | 🆕 im Workplace eine Rollen-/Rechte- + Audit-Frage |

---

## 5. Wo es sich verzahnt (nicht nur nebeneinander)

- **L-VAR → L-RGA:** `pfad_befunde` (Pfad-Wiederholung) speist **D9/D10**; der NK-Zustand (`_NK-STAND_*.json`) speist die RGA-Dimensionen D6/D9/D10 + den „Zustand der Namenskonvention"-Einseiter; `twin_import.py` zieht umgekehrt RGA-Wissen (`window.DATA`) in den Explorer (Reiter-2-Soll-Kaskade). → In der App: **derselbe Baustand** sollte L-RGA- und L-VAR-Ergebnisse tragen und querverdrahten.
- **Zwei-Naturen → Scoring + Bauanleitung + Kundenfassung:** Level-Klassen (Robustheit/Skalierung) + Vereinbarungs-Gates ändern die Benotung; die Fundament-Welle ändert die Bauanleitung; die Zwei-Naturen-Sprache gehört in die Kundenfassung (R6).
- **Analyse-Tiefen → alles:** Die deklarierte Tiefe (T-A/B/C) bestimmt, was der Baustand verspricht — und T-B/T-C brauchen Betriebsdaten-Ingest, den wir noch nicht haben.

---

## 6. Was direkt übernehmbar ist (geringes Risiko, hoher Wert)

1. **Golden-Data-Regressions-Gate** — `_gold_runner.py`-Prinzip + der Übungsfall als Backend-Test-Fixture (der Übungsfall ist **fiktiv** → compliance-unkritisch; er läuft *zuerst*, das echte Set erst nach Compliance-Klärung).
2. **Fundament-Welle (R4)** in unsere Bauanleitungs-Generierung — kleiner Prompt-/Struktur-Zusatz, sofort Wert.
3. **Analyse-Tiefe deklarieren** (T-A/B/C) auf dem Baustand + in der Kundenfassung — ein Feld + ein Textbaustein.
4. **Prüfmuster nachziehen** (PM-15…21) — additiv im Checker (§4 der Stand-Doku beschreibt den Andockpunkt).
5. **Zwei-Naturen-Sprache** in die Kundenfassung (R6) — Prompt-Erweiterung.

---

## 7. Was Klärung/Entscheid braucht, bevor gebaut wird

- **L-VAR: Engine betreiben vs. reimplementieren** (§3) — die Grundsatzentscheidung.
- **Governance im Workplace:** Sebs PROD↔PROJ-Trennung („nie beides gleichzeitig") — wie bilden wir das ab? (Rollen/Rechte je Instanz; die App als PROJ-Anwender, die Engine-/Standard-Pflege als PROD-Rolle.)
- **Zwei-Naturen in WB44/Scoring:** die Gate-Ergänzungen an WB44 §3b sind laut Standard „offen — Review-Termin" (WB-Dateien nur im Review). Unser Scoring sollte dem folgen, nicht vorauseilen.
- **SE-B/SE-W:** Konzept, nicht Formel. Erst umsetzen, wenn Seb es als Formel entscheidet.
- **Betriebsdaten-Ingest (T-B):** neue Datenklasse (Logs/Archive/Result-Excels als Zeitreihe) — Umfang klären.

---

## 8. ⚠️ Compliance & IP — vor Integration

1. **Heinzl-Golden-Set = echte, unanonymisierte Kundendaten.** Sebs O-Ton: *„Heinzl weiß, dass wir seine Prozesse für Produktentwicklung nutzen — aber nicht in welchem Umfang."* AVV deckt die *Verarbeitung*, nicht zwingend die Nutzung als **geteilter Referenz-Datensatz in gemeinsamer Produktentwicklung**. → **Vor** Ablage in Repo/App/Instanz: Zweckbindung + Einwilligungsumfang schriftlich klären. In der App: als **🔒-Datensatz** behandeln (Zugriffsschutz, kein kundenübergreifender Zugriff, nur Backend-Fixture, **nicht** in der UI). Der **fiktive Übungsfall** ist der compliance-sichere Einstieg für Tests.
2. **O-14 Layer-Besitz wird dringlicher, nicht erledigt** — Seb: „wir geben den kompletten Produktkern heraus." Die 8 Skills = das formalisierte Kern-IP (vorher bewusst draußen). Speicher-/Export-Hoheit + Löschbarkeit vertraglich fixieren, bevor das in Kunden-Instanzen wandert.
3. **Tresor-Regel:** Sebs Paket-Bau hat einen Tresor-Sweep (Passwörter/Token/Keys brechen ab). Übernehmen wir das für App-Uploads/Artefakte (kein Klartext-Secret in Baustand/Artefakt/Export).

---

## 9. Empfohlene Reihenfolge

1. **Compliance-Klärung** (Heinzl-Datennutzung, O-14) — Voraussetzung für alles mit echten Daten. Parallel: mit dem **fiktiven Übungsfall** arbeiten.
2. **Grundsatzentscheid L-VAR** (Engine betreiben, Empfehlung §3) mit Seb.
3. **Golden-Data-Gate** (Übungsfall zuerst) als Backend-Regressions-Suite — schließt O-16, unabhängig vom L-VAR-Weg.
4. **Kleine, additive Reife-Sprünge in L-RGA/L-BAU:** Fundament-Welle (R4), Analyse-Tiefe-Deklaration, Zwei-Naturen-Sprache in der Kundenfassung, Prüfmuster PM-15…21.
5. **L-VAR-Anbindung** nach Entscheid §3 (Engine-Service + JSON-Rücklesen + HTML-Artefakt im Baustand; NK-Zustand → RGA D6/D9/D10; `pfad_befunde` → D9/D10).
6. **Betriebsdaten-Ingest (T-B)** — wenn die Tiefe T-B/T-C in den Kunden-Fällen gebraucht wird.
7. **Governance-Rollen** (PROD↔PROJ) als Rechte-Modell, wenn L-VAR in mehreren Instanzen läuft.

---

## 10. Offene Fragen an Seb

1. **L-VAR: Engine betreiben (unsere Empfehlung) oder reimplementieren?** Wenn Engine: Python+PyMuPDF im Container ok? R1-Pfad-Entkopplung (`engine.config.json`) — Zeitfenster?
2. **Governance PROD↔PROJ im Workplace** — wie strikt trennen (eigene Instanz für Engine-/Standard-Pflege)?
3. **Zwei-Naturen in WB44/Scoring** — greifen wir die R2-Gates schon auf, oder warten wir auf euren Review-Termin?
4. **Golden-Set-Compliance** — dürfen die echten Heinzl-Daten ins Repo/eine Instanz, oder bleibt es beim Übungsfall + Heinzl nur lokal/gesperrt?
5. **Welche Skills sollen App-Features werden** (`/prozess-start` Einbau-Tabelle, `/wertfehler`) vs. Agent-Verfahren bleiben?
6. **Basis-Bausteine** (K-68, familienübergreifende Prozesse) — sollen wir die Erkennung (Aufrufer aus ≥2 Familien) schon in unseren Call-Graph aufnehmen?

---

*Grundlagen: `PAKET_2/00_LIESMICH_ADACOR.md` · `10_Engine/README_Variablen-Explorer.md` · `40_Standards-und-Methoden/{STANDARD_Namenskonvention_v2.1, STANDARD_Zwei-Naturen-der-Reife_v1, STANDARD_Input-Anforderungskatalog_Analyse-Tiefen, PA-PRUEFAGENTEN_Manifest_v1, SOLL-PROFIL_METHODE, PRUEFMUSTER-KATALOG}.md` · `50_Skills/*` · `60_CHANGELOG_L-VAR.md` · `70_Register-und-Historie/*` · `80_Roadmap-und-offene-Punkte/*`.*
