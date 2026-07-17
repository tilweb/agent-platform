# User-Report über alle Scalingo-Instanzen

**Datum:** 2026-07-17
**Zweck:** Monatliche Abfrage der User-Anzahl über alle Scalingo-Workplace-Instanzen
(Demo wie Kunde), abrechnungsrelevant ist die Zahl der **aktiven** User pro Instanz
(Kunden zahlen pro User). Dynamisch — neue Instanzen werden automatisch erfasst.

## Kontext & Entscheidungen

- **User-Quelle:** In Produktion liegen User ausschließlich in Postgres, Tabelle
  `auth.users` (Single Source of Truth). Gezählt werden `total`, `active`
  (`is_active = true`, **Abrechnungszahl**) und `admins` (`role = 'admin'`).
- **Discovery:** dynamisch über `scalingo apps`, gefiltert auf `workplace-*`. Kein
  Hardcoding von Instanzen — künftige Apps erscheinen automatisch.
- **Zugriffsweg — warum detached One-off:** Es gibt in dieser Umgebung
  - keine registrierten SSH-Keys → `scalingo db-tunnel` und attached `scalingo run`
    scheiden aus (SSH-Auth schlägt fehl; SSH-Key ist eine Account-Änderung);
  - kein PTY für gespawnte Prozesse → attached `scalingo run` bricht mit
    „make stdin raw" ab.
  - **Direkter externer DB-Zugriff** auf die Instanz-Postgres ist bei dieser Infra
    bekanntlich fragil.
  → Tragfähig und rein **API-basiert** (nur der `scalingo`-API-Token nötig) ist
  **`scalingo run --detached`**: den One-off submitten, die `one-off-<id>` aus der
  Ausgabe parsen, dann die App-Logs nach einer Sentinel-Zeile pollen.
- **Read-only:** Der Zähl-Lauf macht nur ein `SELECT` und läuft in einem separaten
  One-off-Container — der Web-Container der Kunden-Instanz wird nicht berührt.

## Bausteine

### 1. `backend/scripts/report-users.ts` (deployed, läuft je Instanz)
Standalone Bun-Skript. Öffnet die DB via `getSql()` (`SCALINGO_POSTGRES`, im Container
vom Buildpack gesetzt), zählt `auth.users` und gibt **genau eine** Sentinel-Zeile aus:

```
##USERREPORT## {"title":"Workplace IHK Leipzig","total":3,"active":3,"admins":1}
```

`title` kommt aus `PLATFORM_TITLE`. Danach `process.exit(0)`.

### 2. `tools/instance-user-report.ts` (lokal, Orchestrator)
Enumeriert die Apps, submittet je laufender Instanz einen detached One-off
(`bun run backend/scripts/report-users.ts`), pollt die Logs nach `##USERREPORT##`
und rendert eine Tabelle mit **SUMME**. Fehlertolerant pro Instanz (nicht laufend,
Skript fehlt, Timeout ⇒ `n/a`, Report bricht nie ab).

## Aufruf

```sh
/Users/andreasbachmann/.bun/bin/bun run tools/instance-user-report.ts
# Optionen:
#   --json            maschinenlesbar (JSON-Array)
#   --concurrency 6   parallele Instanzen (Default 6)
#   --timeout 120     Sekunden je Instanz auf das Ergebnis warten
#   --prefix foo      anderer Namens-Präfix (Default workplace-)
```

Beispielausgabe:

```
INSTANZ                    TITLE                    AKTIV   TOTAL   ADMIN  HINWEIS
workplace-demo             Workplace Demo              11      12       2
workplace-ihk-darmstadt    Workplace IHK Darmstadt      5       5       1
workplace-ihk-leipzig      Workplace IHK Leipzig        3       3       1
...
SUMME (N/N Instanzen)                                   xx      xx      xx
```

## Grenzen / Betrieb

- **Deploy-Abhängigkeit:** Das Zähl-Skript muss im Image der Instanz liegen. Instanzen
  mit `--auto-deploy` auf `main` bekommen es beim nächsten Merge automatisch. Instanzen
  auf altem Stand erscheinen bis zu ihrem nächsten Deploy als `n/a` („Skript fehlt/Deploy alt?").
- **Demo-Instanzen** enthalten Seed-User (`demo1..`, `marketing1..`) — für die Abrechnung
  irrelevant; Kunden-Instanzen laufen mit `SEED_DEMO_DATA=false`, dort zählen nur echte Nutzer.
- **Laufzeit:** je Instanz ein One-off-Container-Boot (~20–40 s), parallelisiert (Default 6).
- **Gegencheck** einer Instanz: `GET /api/users` (aktive User) plausibilisieren.
