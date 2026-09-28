# Muster: Antragsprüfungs-App

Verbindliche Vorlage für jede App, die einen Sozialleistungsantrag prüft (Wohngeld, Grundsicherung,
…). Referenz-Implementierungen sind Wohngeld (`apps/wohngeld/`) und Grundsicherung
(`apps/grundsicherung/`, nach diesem Muster als zweite App gebaut). Hintergrund und Entscheidungen:
`docs/antragspruefung-architektur-konzept-2026-09-27.md`; gemeinsamer Code: `apps/_antrag-kern/`
(`docs/antrag-kern-spec-2026-09-27.md`).

**Grundsatz:** Einheitlichkeit entsteht über dieses Muster, den Kern und Konformitätstests, nicht
über Konfiguration. Fachlichkeit (Recht, Regeln, Datenmodell, Texte) ist eigener Code je App und
darf frei abweichen. Was hier steht, ist dagegen für alle Apps gleich.

## 1. Auftrag und Grenzen

- Kernmehrwert: **Vollständigkeit und Plausibilität der Unterlagen prüfen und managen.**
- **Keine Zahlbetrag-Berechnung.** Die Berechnung macht das Fachverfahren. Überschlägige Werte
  nur, wo das Konzept es vorsieht (Vorrang-Einschätzung, erst mit Pilotkommune).
- **Mensch entscheidet.** Jede KI-Ausgabe ist ein Vorschlag mit Review-Gate; keine automatisierte
  Einzelentscheidung.
- **Deterministische Regeln sind Code**, getestet mit `bun test`. Das Sprachmodell liest nur
  Unterlagen aus und formuliert Texte. Einschätzungen über Ansprüche sind nie Modellausgabe.

## 2. Datenmodell (Grundgerüst)

Eigenes Postgres-Schema je App (`pgSchema('<app>')`), eigene Migrationen, Tabellen-Präfix
(Wohngeld: `wg`).

```
Akte ─┬─ Vorgang (= ein Antrag, eigene Vorgangsnummer ≠ Aktenzeichen des Fachverfahrens)
      │    ├─ Personen (Haushalt / Einstandsgemeinschaft — fachlich je App)
      │    ├─ Dokumente (Typ fachlich je App, Eingangsdatum = rechtliches Eingangsdatum)
      │    ├─ Prüfschritte
      │    ├─ Schreiben
      │    ├─ Feldstatus, Notizen          ← Kern
      │    └─ Audit-Log, KI-Verbrauch      ← Kern (ohne FK, überdauern Löschung)
Posteingang (Umschlag mit 1..n Dateien)   ← Kern
```

- Vorgangs-Status (Wohngeld): `posteingang → sachbearbeitung → warte_auf_rueckmeldung →
  entscheidung → abgeschlossen`. Neue Apps übernehmen diese Stufen und benennen nur um, wenn die
  Fachlichkeit es verlangt.
- Optimistic Locking über `version` (Kern: `concurrency.ts`).
- Aufbewahrung, Legal Hold, Einschränkung nach Art. 18 als Vorgangsfelder (Kern: `aufbewahrung.ts`).

## 3. Prüfschritte

Einheitliche Semantik in allen Apps:

| Feld | Werte | Bedeutung |
|---|---|---|
| `kategorie` | `vollstaendigkeit` · `plausibilitaet` | fehlt etwas · passt etwas nicht zusammen |
| `typ` | `anforderung` · `info` | muss vom Antragsteller nachgereicht werden · Hinweis für die Sachbearbeitung |
| `status` | `offen` · `erledigt` · `verworfen` | |
| `regelId` | stabile ID aus dem Regelkatalog | Idempotenz beim Neu-Prüfen |
| `automatisch` | true/false | von der Regel-Engine vs. manuell ergänzt |

- Neu-Prüfen ist idempotent: manuelle und erledigte Prüfschritte bleiben erhalten.
- Jede Regel hat eine Beschreibung (Auslöser, Nachweis, Rechtsgrundlage, Erledigung) im
  Regelkatalog der App; ein Wächter-Test stellt das sicher (Wohngeld: `checker/regeln.test.ts`).
  Bei Regeländerungen den Katalog-Stand hochzählen.
- Auto-Prüfung nach jeder fachlichen Änderung; Zustand „nicht geprüft" sichtbar.
- Vorrang-Hinweise zwischen Leistungen sind Prüfschritte vom Typ `info` (Abschnitt 9).

## 4. Posteingang

Ablauf (Kern-Routen, fachliche Hooks je App):

1. **Einliefern** (Upload, Scan, E-Mail, Import, später Weiterleitung) — nur speichern, Dedupe über
   Hash. Programmatisch über `einliefern()`.
2. **Auswerten** (manuell angestoßen, im Hintergrund mit Fortschritt): Mehrdokument-Trennung,
   Erkennung über das DP-Profil der App, Extraktion.
3. **Zuordnen** zu neuem oder bestehendem Vorgang (Nachreichung) mit Match-Vorschlag; oder
   **verwerfen**. KI-Verbrauch geht bei Zuordnung an den Vorgang.
4. Trennung korrigieren jederzeit vor der Zuordnung.

Upload direkt am Vorgang läuft durch dieselbe Erkennung.

**Korrekturen beim Zuordnen zusammenführen, nie ersetzen.** Das Detail-Formular des Posteingangs
zeigt nur einen Teil der erkannten Antragsdaten (Name, Anschrift, Aktenzeichen …). Schickt es
Korrekturen mit (`stammdaten` im Zuordnen-Body), werden sie feldweise über die erkannten Daten
gelegt (`korrigiereStammdaten(erkannt, korrektur)` in `stammdaten-uebernahme.ts`); was das Formular
nicht zeigt (Haushalt/Personenliste, Wohngeldnummer, IBAN …), bleibt erhalten. Ein Ersetzen des
ganzen Stammdaten-Objekts hat in beiden Apps Haushalt und Nummern verloren — die Fehlerklasse ist
in jeder App mit einem Test abzusichern (beide Referenz-Apps: `stammdaten-korrektur.test.ts`).

## 5. Oberfläche

**Einstieg** `/apps/<app>` mit Ansichten: Vorgänge · Akten · Aufgaben (Fristen/Wiedervorlage) ·
Prüfregeln · Löschfällig (nur Owner). Header-Button „Posteingang".

**Posteingang** `/apps/<app>/posteingang` (Liste) und `/posteingang/:id` (Detail: Stammdaten,
erkannte Dokumente mit Seitenvorschau, Match-Vorschlag, Verteilung, KI-Verbrauch).

**Vorgangsseite** `/apps/<app>/vorgang/:id`, zwei Bereiche:

- Hauptbereich mit Reitern — fest: **Übersicht** (erster Reiter), **Schreiben**, **Protokoll**,
  **KI-Verbrauch** (letzte zwei am Ende); dazwischen fachliche Reiter der App (Wohngeld:
  Plausibilitätsprüfung, Einkommensprognose, Verfügung).
- Rechte Seitenleiste (einklappbar) mit Reitern **Details · Prüfschritte · Dokumente**.
  Details enthält u. a. Allgemein, Aufbewahrung & Schutz, Todos, Labels, KI-Nutzung.
- Übersicht: Abschnitte als `SektionCard`, Bearbeiten **pro Block**, KI-Vorschläge auf
  Feldebene mit Bestätigen/Verwerfen (`FeldStatusMark`), Notizen je Abschnitt.
- Fall-Chat als schwebendes Panel (Modi „Frage zum Fall" und „Gesetz nachschlagen").

**Gestaltung:** Bausteine aus `frontend/src/apps/_antrag-kern/components/`, App-API über
`AntragKernProvider` (je App eine `<App>KernProvider`-Hülle um jede Seite), Inline-Styles mit
`theme.js`, Akzentfarbe `ACCENT` aus dem Kern. Siehe `frontend/CLAUDE.md` (u. a. keine farbigen
Akzentrahmen an Karten, Eingabefelder auf `theme.colors.surface`). UI-Texte ohne interne Verweise.

## 6. Governance-Pflichten (Konformität)

| Pflicht | Umsetzung |
|---|---|
| Jede Schreib-Aktion, jeder Lesezugriff auf einen Fall, jeder Export wird protokolliert | `audit(c, …)` aus dem Kern-Adapter der App |
| Jede LLM-Aktion wird gemessen | in `messeKiVerbrauch(aktion, bezug, fn)`; Aktion + Label in der App |
| Jeder LLM-Aufruf trägt Governance-Metadaten | `usageContext` mit Modell, Prompt-Stand, Fallbezug |
| Rollen | Editor-Gate für Schreibrouten, Owner für Protokoll-Export/Löschfällig, Vier-Augen opt-in (`<APP>_VIERAUGEN`) |
| Einschränkung Art. 18 | eingeschränkte Vorgänge sind schreibgeschützt |
| Betroffenenauskunft Art. 15 | Export je Person (fachliche Inhalte je App) |
| Aufbewahrung | `aufbewahrungBis` automatisch, Legal Hold, Löschfällig-Sicht |
| Transparenz | Textbaustein „KI-Transparenzhinweis" als Seed |

## 7. Konventionen

- Backend `backend/src/apps/<app>/`: `types.ts`, `storage.ts`, `routes/*`, `checker/`
  (Regeln + `regeln.ts`-Katalog), `extraction-schema.ts`, `dp-erkennung.ts` (Adapter auf das
  DP-Profil `<app>-eingang`), `recht/` (Korpus), `ki-governance.ts`, `ki-verbrauch.ts`,
  `audit.ts` (Adapter), `seed-demo.ts`.
- Frontend `frontend/src/apps/<app>/`: `<App>Page`, `VorgangDetail`, `PosteingangPage`,
  `PosteingangDetail`, `api.js`, `<App>KernProvider.jsx`.
- Env-Variablen mit App-Präfix (`WOHNGELD_…`, `GRUNDSICHERUNG_…`).
- Specs unter `docs/<app>-<thema>-spec-<datum>.md`, Changelog-Eintrag je Feature.
- **DokumentAnalyse-Vertrag** in `types.ts`: je Dokumenttyp die Felder, die die Regel-Engine liest
  (`DokumentAnalyseJeTyp`, Zugriff über `analyseVon(dok, typ)`). Er ist die Schnittstelle zwischen
  Extraktion und Regeln — Regeln lesen nur diese Felder, die Extraktion bildet genau darauf ab.
  Konvention: alle Felder optional; **nicht erkannt ⇒ Feld weglassen, nie raten** (`false`/`0`
  heißt „geprüft und nicht vorhanden" und löst Befunde aus). Datumsangaben ISO `YYYY-MM-DD`,
  Beträge als Zahl in Euro. Referenz: `apps/grundsicherung/types.ts`.
- **Neue App startet `enabled: false`** (`index.ts`); der Admin schaltet sie frei, sobald sie
  abnahmefähig ist. Das gepflegte `enabled` bleibt beim Registry-Abgleich erhalten.
- **Apps importieren einander nicht.** Gemeinsames aller Antrags-Apps liegt im Kern (fachfrei),
  Gemeinsames zwischen genau bestimmten Apps in einem eigenen Geschwister-Ordner (Abschnitt 9).
- Kern bleibt fachfrei (Wächter-Test `_antrag-kern/fachfrei.test.ts`). Änderungen am Kern
  wirken in allen Apps. Eine UX-Änderung, die nur in einer App passiert, im Changelog als
  „Muster-Änderung" markieren und bewusst entscheiden: Kern, alle Apps nachziehen, oder
  fachliche Abweichung.

## 8. Konformitätstests je App

Statisch über den Quelltext, ohne Laufzeit und Datenbank: Helfer in
`_antrag-kern/konformitaet.ts`, je App `apps/<app>/konformitaet.test.ts` (Konfiguration + begründete
Ausnahmen), Kern-Fabriken in `_antrag-kern/konformitaet.test.ts`.

| Prüfung | Regel |
|---|---|
| Audit | Jede direkt in `routes/*.ts` registrierte Schreibroute (`post/put/patch/delete`) ruft `audit`/`auditUpdate` — direkt oder über eine Funktion derselben Datei, die das nachweislich tut. Routen aus Kern-Fabriken auditieren selbst (im Kern geprüft). |
| KI-Verbrauch | Jede Route, die einen LLM-Einstieg erreicht (`llmService.chat/streamChat`, `runPipeline`, DP-`extract`, `judgeBoundaries`, `pruefeUndTrenne`, die deklarierten LLM-Funktionen der App und lokale Hüllen wie `erkenneMitProfil`), ruft im selben Handler `messeKiVerbrauch` (oder eine deklarierte Mess-Hülle). LLM-Einstiege außerhalb der Routen nur in deklarierten LLM-Modulen (`llmModule`); ein neues Modul muss bewusst eingetragen werden. Der Kern ruft die Hooks `analysiere`/`werteNeueDateienAus` nur innerhalb von `messeKiVerbrauch`. |
| Regelkatalog | Jede Prüfregel hat eine Katalog-Beschreibung (`checker/regeln.test.ts`); Goldfälle als Abnahmetest der Regel-Engine (Wohngeld `checker/checker.test.ts`, Grundsicherung `checker/goldfaelle.test.ts`). |
| Einschränkung | Jede vorgangsbezogene Schreibroute (`:vorgangId`, `/vorgaenge/:id…`, `/dokumente|personen|pruefschritte|schreiben|notizen/:id`) prüft `denyIfEingeschraenkt`/`denyIfVorgangEingeschraenkt`. Ausnahmen: die Einschränkung selbst, Legal Hold, Aufbewahrung (Owner/DSB). |
| Abgrenzung | Die App importiert keine andere Fach-App. |

Ausnahmen stehen mit Begründung in der Testdatei der App. Echte Abweichungen, die noch offen
sind, stehen getrennt davon als `OFFENE_VERSTOESSE` — der Test schlägt an, sobald eine behoben ist
(dann streichen) oder eine neue dazukommt. Eine neue App übernimmt die Testdatei einer
Referenz-App und passt nur die Konfiguration an.

## 9. Vorrang zwischen Leistungen

Wohngeld und Grundsicherung schließen einander weitgehend aus; welche Leistung vorgeht, entscheidet
die Sachbearbeitung. Die Apps liefern dafür nur Hinweise (Prüfschritte `info`), keine Berechnung.

- **`apps/_vorrang/`** enthält die Fachlogik, die genau diese Apps teilen — nicht im Kern (der
  bleibt fachfrei), nicht in einer der Apps (die importieren einander nicht):
  - `grunddaten.ts` — **Grunddaten-Vertrag**: beide Apps liefern über
    `grunddatenFuerVorrangpruefung(snapshot)` (je App `vorrang-grunddaten.ts`) dieselbe Datenform
    (`VorrangGrunddaten`, Versionsstand `VORRANG_GRUNDDATEN_VERSION`), dazu `vollstaendigkeit()`.
    Grundsatz „unbekannt statt geraten": fehlende Werte bleiben leer, nichts wird erschlossen.
  - `arten.ts` — gemeinsame Arten-Listen (Einkommen, Vermögen, Transfer) und Abbildung aus dem
    Vokabular beider Apps; Unbekanntes → `sonstiges`, Originalwert bleibt erhalten.
  - `altersgrenze.ts` — Altersgrenze nach § 41 Abs. 2 SGB XII (Anspruchsgrund Alter in der
    Grundsicherung, Vorrang-Hinweis in Wohngeld).
- `vertrag.test.ts` prüft, dass beide Apps für einen vergleichbaren Fall dieselbe Form liefern —
  der einzige Ort, an dem beide Apps gemeinsam importiert werden.
- Eine spätere deterministische Vorrang-Einschätzung hängt nur am Vertrag, nicht an den
  Fachmodellen. Formänderung ⇒ Version hochzählen und beide Apps nachziehen.
