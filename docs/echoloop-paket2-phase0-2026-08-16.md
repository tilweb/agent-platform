# Echo-Loop · PAKET_2-Integration — Phase 0 (Fundament & Weichen)

**Datum:** 2026-08-16 · **Status:** abgeschlossen · **Referenz-Plan:** `echoloop-paket2-integrationsplan-2026-08-16.md`
**Rahmen:** native TS-Reimplementierung von Sebastians PAKET_2 (L-VAR Engine v3.11). Sebs Python/Skills/Standards
sind **Spezifikation** (was & wie), nicht auszuführende Artefakte.

---

## 1. Kontext & Ziel

PAKET_2 liefert das vollständige L-VAR-Verfahren (Variablen-Explorer) samt Golden-Sets, Standards und 8 Skills.
Sebs Wunsch: unsere Workplace-App wird **um die Funktionen dieses Pakets erweitert** — als native App-Module
(Backend-Services + React-UI + eigenes Datenmodell), nicht als eingebetteter Python-Service.

Phase 0 ist die **Voraussetzung für alles Weitere**: die koordinatenbasierte Extraktion (trägt L-VAR *und* die
bessere L-RGA-Evidenz), das erweiterte Datenmodell, und das Qualitäts-Backbone (Gold-Runner + Tresor + Telemetrie),
das ab sofort jede Änderung reproduzierbar prüfbar macht.

**Compliance-Leitplanke (in Kraft):** entwickelt und getestet ausschließlich gegen den **fiktiven Übungsfall**
(5 Prozesse, 30 Variablenzeilen, compliance-sicher). Echte Heinzl-Golden-Daten (`GOLD_HZL-REPA`) bleiben bis zur
O-14-/Zweckbindungs-Klärung außerhalb von Repo und UI und werden dann als 🔒 Backend-Fixture behandelt.

---

## 2. Was gebaut wurde

### 2.1 Koordinaten-Extraktion (`backend/src/apps/echoloop/extract/`)

| Datei | Inhalt |
|---|---|
| `bbox.ts` | `pdftotext -bbox` via `Bun.spawn` → Wörter mit Bounding-Box je Seite; `zeilen()` gruppiert nach y-Toleranz. Poppler ist bereits Systemabhängigkeit — **kein Python**. |
| `emma.ts` | EMMA-Prozess-Extraktion: Variablen-Tabelle via Spalten-Raster (SP_ID=120/NAME=235/TYP=305/INIT=420), Schritt-Tabelle, Call-Graph, `{CV:}`-Fundstellen, Ausgänge, Zeitstände. |
| `persist.ts` | Persistenz-Brücke Extract → DB (`prozess_items` + `variablen`), Telemetrie-Helfer, Familien-Reader. |
| `emma.test.ts` | Gold-Fixture-Harness (37 Fälle) gegen `_varliste_demo_daten.json`. |

**Gelöste Extraktions-Feinheiten (jede genau einmal im Übungsfall ausgelöst):**

1. **Umbruch-Klebung** — mehrzeilige Name-/Init-Werte werden an die letzte Variable geklebt; Trennzeichen am
   Zeilenende → ohne Leerzeichen. Geklebte Felder tragen `umbruch: true` → gehen als ❓ durch, **nie als Befund**
   (Prinzip §3.4: Graph ≠ Text).
2. **Schritt-Erkennung über x-Position** statt über eine Typ-Whitelist: eine Schritt-Zeile ist eine führende
   kleine Ganzzahl ganz links (x < 60); Variablen-IDs stehen bei x ≈ 95. Robust gegen fremde Schritt-Vokabeln
   (der Übungsfall nutzt „Öffnen"/„Speichern", die in keiner festen Liste stünden). Kein Auffangzweig (§3.1).
3. **`{CV:nnn - Name}`-Verknüpfung über den NAMEN, nicht über nnn.** Der Übungsfall enthält bewusst einen
   Wertfehler (`{CV:3 - Lieferantenname}`, wobei Position 3 „Rechnungsbetrag" ist). Die Referenz-Engine verknüpft
   über den Namen; nnn ist nur Fallback. Damit ist der Wertfehler-Fall korrekt abgebildet.
4. **Zwei Zeitstände:** Prozess-Stand steht im Kopf `Prozess N: … (DD.MM.YYYY HH:MM:SS)`, Druck-Stand ist die
   freistehende Seiten-Kopf-Zeile (auf jeder Seite → häufigste). DD.MM.YYYY → ISO. Robust auch für 1-seitige PDFs
   (wo eine reine Häufigkeits-Heuristik unentschieden wäre).

**Ergebnis — Volltreffer gegen die Golden-Referenz:**

```
Variablen 30/30 · fund 30/30 · aufrufe 5/5 · cvrefs 5/5 · ausgaenge 5/5 · zeitstempel 5/5
GOLD PASS · 5 Prozesse · 30 Variablen · 175 Felder geprüft
```

### 2.2 Datenmodell-Erweiterung (`backend/src/db/schema/echoloop.ts` · Migration `0034_echoloop_lvar.sql`)

Entscheidungspunkt **D-A** umgesetzt: `prozesse` wird zur **Familie** umgewidmet (Zusatzfelder `familienkuerzel`/
`namenskonvention`/`token_prefix` leben in `prozesse.data` → **keine** Spalten-Migration an Bestandstabellen).
Additive neue Tabellen im Schema `echoloop`:

| Tabelle | Zweck | Kern-Felder |
|---|---|---|
| `prozess_items` | Einzelprozess-Steckbrief je Extraktionslauf | `nr`, `name_export`, `typ` (MP/TP/SP), `data`={kopf, stände, aufrufe, cvrefs, ausgaenge, fingerprint} |
| `variablen` | Variablen-Zeilen (familienweit abfragbar) | `p`, `var_id`, `name`, `typ`, `schnitt`, `rolle`, `data`={init, pos, fund, umbruch, nkBefunde G1–G7} |
| `cfg` | Konfigurations-Schlüssel einer Familie | `schluessel`, `data`={wert, wertQuelle, produzent/konsument, diffKlasse(7), herkunft} |
| `telemetrie` | append-only Audit-/Verbrauchs-Senke (ohne FK) | `verfahren`, `event`, `data` |

Migration additiv + idempotent (`IF NOT EXISTS`), Bestandsdaten unberührt. Journal-Eintrag idx 34.
Domänen-Typen in `types.ts` (`ProzessItem`, `Variable`, `CfgKey`, `NkBefunde`, `VarRolle`).

**Bewusst noch nicht gebaut** (in ihre konsumierende Phase verschoben, um leere Tabellen zu vermeiden — Prinzip §3.6):
separate Register-Tabellen (Gold-Registry / Bauweg-Register / Regel-Backlog). Die Telemetrie-Senke trägt vorerst
die Lauf-Historie; die Register folgen mit ihren Konsumenten in Phase 1–4.

### 2.3 QA-/Gold-Backbone (`backend/src/apps/echoloop/qa/`)

- **`gold-runner.ts`** (+ CLI `backend/scripts/echoloop-gold.ts`): aufrufbarer Läufer über ein Fixture-Verzeichnis,
  vergleicht Feld für Feld gegen die Golden-Referenz und meldet jeden Abweicher. **Semantik §3.5/§3.6:** jede
  Abweichung ist zunächst REGRESSION — kein „≥"-Schwellwert. DRIFT (gewollt → Golden neu pinnen) vs. REGRESSION
  (Fehler → Code fixen) entscheidet der Mensch; der Runner klassifiziert nicht selbst. Exit-Code 0/1 für CI/Betrieb.
- **`tresor.ts`**: „kein Secret in Baustand/Artefakt/Export". Zwei Modi —
  · `redactVariablen` (nicht-blockierend, VOR Persist): EMMA-`password`-Variablen mit Init + secret-verdächtige
  Werte werden geschwärzt (`🔒 [Tresor]`), Fund als Telemetrie notiert; die Analyse läuft weiter.
  · `assertTresorClean` (harter Gate, VOR Export/Paket-Bau): wirft `TresorError` bei jedem Fund.
  In `persist.saveProzessItem` verdrahtet → kein Klartext-Credential erreicht `variablen`.

### 2.4 Querschnitts-Prinzipien (verankert)

Aus `60_CHANGELOG_L-VAR` — als Code-Konventionen + Tests eingebaut: **kein Auffangzweig** (erschöpfende
Diskriminanten), **Graph ≠ Text / ❓-Disziplin** (`umbruch`→❓), **das Ergebnis prüft sich selbst** (Gold-Runner/
Tresor als Gates), **kalibrieren vor bauen** (Übungsfall zuerst), **Provenienz & Tresor**. Prinzip §3.7
(append-only D-061-Tokens) und §3.2 (weich-als-Default NK-Gate) greifen erst mit dem NK-Gate in Phase 2.

---

## 3. Verifikation

```
bun test src/apps/echoloop/     → 78 pass · 0 fail · 8 Dateien
bun scripts/echoloop-gold.ts    → GOLD PASS · 5 Prozesse · 30 Variablen · 175 Felder · exit 0
tsc --noEmit                    → keine echoloop-Fehler
```

Der Übungsfall-Gold-Run ist zudem **tresor-sauber** (die compliance-sichere Fixture enthält keine Credentials) —
ein Regressions-Wächter, falls je eine Fixture mit Klartext-Secret hereinkäme.

**Nicht lokal ausführbar:** DB-schreibender Pfad (`persist.ts`) — lokal ist `SCALINGO_POSTGRES` nicht gesetzt,
Migrationen no-op-en beim Boot (`migrate.ts`). Getestet ist die reine Logik (Extraktion, Tresor, Gold-Runner);
die DB-Brücke ist typgeprüft und folgt dem bestehenden `storage.ts`-Muster.

---

## 4. Nächste Schritte

Kritischer Pfad erledigt (Extraktion + Datenmodell + Gold-Gate). Danach laufen **Phase 1** (L-RGA/L-BAU auf
Referenz-Reife) und **Phase 2** (L-VAR nativ: NK-Gate G1–G7, CFG-Generator, 3-Reiter-Explorer, Pfad-Befunde →
D9/D10) weitgehend parallel.

**Offene Abstimmungspunkte mit Seb** (aus dem Integrationsplan, keine Blocker für Phase 0):
- **O-14 / Zweckbindung** für die echten Heinzl-Golden-Daten — bis dahin nur Übungsfall.
- **R1** (Engine-Pfad-Entkopplung via `engine.config.json`) — betrifft die 5 ordnertiefen-abgeleiteten Fundorte;
  in unserer nativen Reimplementierung ohnehin gegenstandslos, aber relevant für den Abgleich mit Sebs Läufen.
- **D-A** (Familie = umgewidmete `prozesse` + Kind-Tabelle) — hier bereits so umgesetzt; Bestätigung erbeten.
