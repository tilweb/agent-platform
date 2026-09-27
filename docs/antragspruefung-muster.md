# Muster: Antragsprüfungs-App

Verbindliche Vorlage für jede App, die einen Sozialleistungsantrag prüft (Wohngeld, Grundsicherung,
…). Referenz-Implementierung ist Wohngeld (`apps/wohngeld/`). Hintergrund und Entscheidungen:
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
- Vorrang-Hinweise zwischen Leistungen sind Prüfschritte vom Typ `info`.

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
- Kern bleibt fachfrei (Wächter-Test `_antrag-kern/fachfrei.test.ts`). Änderungen am Kern
  wirken in allen Apps. Eine UX-Änderung, die nur in einer App passiert, im Changelog als
  „Muster-Änderung" markieren und bewusst entscheiden: Kern, alle Apps nachziehen, oder
  fachliche Abweichung.

## 8. Konformitätstests je App (Ziel)

- Jede Route mit Schreibzugriff ruft `audit` auf.
- Jeder LLM-Aufruf der App läuft durch `messeKiVerbrauch`.
- Jede Prüfregel hat eine Katalog-Beschreibung.
- Goldfälle als Abnahmetest der Regel-Engine.
