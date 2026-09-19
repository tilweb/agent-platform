# Spec-Entwurf: Wohngeld-Antragsassistent (Workplace-App)

**Stand:** 2026-09-18 · **Status:** FREIGEGEBEN — Umsetzung läuft · **App-ID:** `wohngeld`

> **Entscheidungen (2026-09-18):**
> 1. **Keine Betragsberechnung** (§19 WoGG). Umfang = Prüfung + Plausibilität +
>    Gesamteinkommen-Aggregation (§13), wie in den Screenshots.
> 2. **Regel-Katalog wird selbst recherchiert** (WoGG/WoGV + Praxis). Fachliche
>    Validierung erfolgt später gemeinsam mit einer Pilot-Kommune.

> Dieses Dokument ist der fachliche + technische Bauplan für eine neue native
> Workplace-App. Es dient als Referenz und als „Ground Truth" für den autonomen
> Bau-Loop (bauen → testen → korrigieren). Quellen siehe Abschnitt 12.

---

## 1. Zielbild & Problem

Wohngeldbehörden ersticken in unvollständigen Anträgen. Laut KISA-Leistungsbeschreibung
(OZG-16-P001-X, Machbarkeitsstudie SAKD/Komm24):

- **~80 %** aller Wohngeldanträge inkl. Anlagen erreichen die Behörde **unvollständig**.
- Sachbearbeiter müssen jeden Antrag händisch prüfen und fehlende Unterlagen nachfordern.
- Bearbeitungszeiten von **ca. 6 Monaten** sollen auf **ca. 2 Wochen** sinken.
- Größter Hebel: **Automatisierung der Vollständigkeitsprüfung** + fachliche **Plausibilitätsprüfung**.

**Die App ist ein Assistenz-Werkzeug für Sachbearbeiter** (Human-in-the-Loop),
kein Selbstbedienungs-Portal für Bürger und **kein automatischer Bescheid-Generator**.
Die Entscheidung bleibt immer beim Menschen.

### Kernnutzen (aus der Ausschreibung, §2.2)

1. Automatisiertes Einlesen von Papier- und Onlineanträgen inkl. Nachweise → **strukturierter Datensatz**
2. Automatisierte **Vollständigkeitsprüfung**
3. Individuelle Prüf-/Kontrollhinweise je Fallkonstellation → **Plausibilitätsprüfung** (u. a. Einkommen)
4. **Validierung bleibt bei der Sachbearbeitung** (Human in the Loop)
5. Automatisiertes **Nachforderungsmanagement** mit individuellen Dokumentenvorlagen
6. Logische Abfolge in der Bearbeitung
7. Automatische Erkennung + Einsortierung in die **E-Akte** (auch Ablage ohne E-Akte)

---

## 2. Abgrenzung / Nicht-Ziele (V1)

| Thema | In V1? | Anmerkung |
|---|---|---|
| Dokument-Klassifikation & Datenextraktion | ✅ | LLM + Regeln, mit Review |
| Vollständigkeitsprüfung (fehlende Nachweise) | ✅ | Regelbasiert, testbar |
| Plausibilitätsprüfung (Widersprüche) | ✅ | Regelbasiert + LLM-Hinweise |
| Gesamteinkommen §13 WoGG (Aggregation) | ✅ | Deterministisch, testbar |
| Nachforderungsschreiben (Generierung + Export) | ✅ | LLM-Text auf Basis offener Prüfschritte |
| Fall-Chat mit Rechtsquellen | ⚠️ optional V1.1 | KB/RAG über WoGG/WoGV |
| **Exakte Wohngeldhöhe (§19 WoGG-Formel)** | ❌ **out of scope** | Bewusste Entscheidung — nur Prüfung/Plausibilität |
| Anbindung an reales Fachverfahren (DiWo/E-Akte-System) | ❌ | Export-Schnittstelle statt Live-Integration |
| Bürger-Frontend / Online-Antrag | ❌ | — |

---

## 3. Rollen & Nutzer

- **Sachbearbeiter:in** (Primärnutzer): bearbeitet Vorgänge, prüft KI-Vorschläge, fordert nach, entscheidet.
- **Teamleitung / Verteiler:in**: Posteingang, Zuordnung zu Akte/Vorgang, Sachbearbeiter-Zuweisung.
- **App-Admin** (Workplace): aktiviert App, vergibt Gruppen-Berechtigungen (owner/editor/viewer).

Zugriff über das bestehende Workplace-App-Permission-Modell (gruppenbasiert, keine Auto-Admin-Rechte).

---

## 4. Domänenmodell (Kernbegriffe)

```
Akte (E-Akte, personen-/adressbezogen)
 └─ Vorgang (= "Antrag", eigene Antrags-ID; Prüf-/Plausibilisierungs-Einheit)
     ├─ Personen[]            (Antragsteller + Haushaltsmitglieder)
     │   └─ Einkommenspositionen[], Vermögen, Transferleistungen,
     │      Unterhalt, Pflege/Behinderung, Sonstiges
     ├─ Wohnung & Miete        (Adresse, Wohnfläche, Miete, Heiz-/Warmwasserkosten)
     ├─ Bewilligungszeitraum   (Start/Ende), Zahlung (IBAN)
     ├─ Dokumente[]            (Eingänge, klassifiziert; Nachweise; Originaldateien)
     ├─ Prüfschritte[]         (Vollständigkeit + Plausibilität; Status, Typ, Belegtext)
     ├─ Schreiben[]            (Anforderungsschreiben / Nachforderungen)
     └─ Meta                   (Sachbearbeiter, Priorität, Labels, Todos, Aktivitäten/Verlauf)
```

Wichtig laut Ausschreibung: **pro Vorgang genau eine Antrags-ID** (Abrechnungseinheit).
Ein Vorgang bezieht sich auf **eine Person / Bedarfsgemeinschaft**.

### Wohngeldarten & Antragsarten (aus Screenshots)
- Wohngeldart: **Mietzuschuss** (V1-Fokus) / Lastenzuschuss (später)
- Antragsart: **Erstantrag**, (Weiterleistungs-/Erhöhungsantrag später)

---

## 5. Feature-Umfang nach Screenshots

### A. Posteingang
- Upload/Eingang von Dokumenten (PDF, Scans, Onlineantrag).
- **Automatische Klassifikation** der Nachweise (z. B. Wohngeld-Antrag, Rentenbescheid,
  Kontoauszug, Mietvertrag).
- **Stammdaten-Extraktion** in strukturierte Felder: Aktenzeichen, Antragsdatum,
  Vor-/Nachname, Geburtsdatum, Straße/Nr., PLZ/Ort, Antragsart.
- **Dateivorschau** (Split-View: Formular links / Dokument rechts).
- Trennung **Nachweise** vs. **Originaldateien**.

### B. Verteilung / Vorgangserstellung
- Zwei-Schritt: **1. Akte wählen → 2. Vorgang wählen**.
- Bestehende Akte anzeigen (Person + Adresse), vorhandene Vorgänge listen
  (Antragsdatum, Art, Status, Sachbearbeiter).
- **Neuen Vorgang erstellen** + Sachbearbeiter zuweisen.

### C. Vorgang-Detail — Haupt-Arbeitsfläche
Kopf: `Vorgänge > <Antrags-ID>`, Status-Badge (z. B. „Sachbearbeitung" / „Warte auf Rückmeldung").
Tabs: **Übersicht · Schreiben · Plausibilitätsprüfung · Einkommensprognose · Verfügung**.

**Tab „Übersicht"** — Sektionen mit Vollständigkeits-Ampel (`n offen` / erledigt ✓):
- **Allgemein**: Antragsdatum, Wohngeldart, Antragsart; Antragsteller (Name, Telefon, E-Mail).
- **Personen**: Liste mit Rolle (Antragsteller/Ehegatte…), Erwerbsstatus, Alter, Jahreseinkommen.
  - **Personen-Detail (aufgeklappt)**:
    - *Persönliches*: Nachname, Vorname, Geburtsname, Titel, Geburtsdatum, Geburtsort,
      Geschlecht, Familienstand, Telefon, E-Mail, Erwerbsstatus, Bemerkung.
    - *Pflege & Behinderung*: Schwerbehinderungsgrad, Pflegegrad, Pflegebedürftig.
    - *Sonstiges*: Erhält Kindergeld, Werbungskosten, Aufforderung Wohngeld, EU/EWR, Staatsangehörigkeit.
    - *Einkommen* (Verweis „Zur Einkommensberechnung wechseln"), *Transferleistungen*,
      *Vermögen* (z. B. Bankguthaben), *Unterhaltsverpflichtungen*, *Unterhaltsansprüche*.
- **Wohnung & Miete**: Straße, Hausnummer, PLZ, Ort, Wohnfläche (m²), Miete, Heizkosten, Warmwasser.
- **Einkommen & Abzugsbeträge**: je Person Einkommenspositionen (Betrag monatlich / jährlich),
  Summenzeilen, **„Anrechenbares Gesamteinkommen §13 WoGG"**.
- **Bewilligungszeiträume**: Start/Ende; **Zahlung**: IBAN.
- **Bearbeitungsmodus** (unten schwebend): Suche, Verwerfen, Speichern.

### D. Rechte Seitenleiste — Tab „Prüfschritte"
- Filter (Alle / …) + **„+ Anforderung"** (manuell ergänzen).
- Prüfschritte gruppiert je Person + fallübergreifend.
- Je Prüfschritt: **Titel**, **Status** (offen ✗ / erledigt ✓), **Typ-Badge** (`Anforderung` / `Info`),
  aufklappbarer **Belegtext** mit Begründung und Quell-Dokument-Referenz.
  - Beispiele: „Personalausweis", „Miethöhe" (mit Widerspruchstext „Mietvertrag 690 €
    vs. Antrag 704 € — Differenz 14 € klären"), „Mietzahlung", „Grundrentenzeiten",
    „Kranken-/Pflegeversicherung", „Rente", „Essenzielle Angaben im Antrag".

### E. Rechte Seitenleiste — Tab „Dokumente"
- Suchfeld + Filter (Eingänge …).
- Eingänge gruppiert nach Datum/Person, mit Dokument-Typ und **Flags/Hinweisen**
  (z. B. „Ohne Datum unterschrieben", „14 € unter Antrag", Seitenzahl).
- Bereich **Originaldateien**.

### F. Rechte Seitenleiste — Tab „Details"
- Sachbearbeiter:in, Priorität, Ablage-Status, letzte Änderung.
- **Labels**, **Todos**, **Aktivitäten** (Verlauf).

### G. Tab „Schreiben" — Nachforderungsmanagement
- **Anforderungsschreiben** automatisch generiert aus offenen Prüfschritten.
- Felder: Betreff, Art des Schreibens (Erstanforderung / …), **Frist für Unterlagen**.
- Editierbarer Rich-Text, gegliedert **je Person**, mit konkreten, begründeten Nachforderungen.
- Export: **„Als Word-Datei herunterladen"** (und/oder PDF).

### H. Tab „Plausibilitätsprüfung"
- Aggregierte Sicht der Plausibilitäts-Findings (Widersprüche zwischen Antrag ↔ Nachweisen).

### I. Tab „Einkommensprognose"
- Prognose/Fortschreibung der Einkommen über den Bewilligungszeitraum
  (z. B. erwartete Renten-/Gehaltsentwicklung). *Detailregeln offen.*

### J. Tab „Verfügung"
- Erzeugung/Download des Entscheidungs-/Verfügungsdokuments (Ergebnis der Sachbearbeitung).

### K. Fall-Chat-Assistent (optional V1.1)
- Beantwortet Fragen **zum Vorgang** und **zu Rechtsgrundlagen** **mit Quellenbezug**
  („Ich blättere für dich durch die Gesetze"), Anzeige der genutzten Quellen.

---

## 6. Deterministisch vs. LLM (Architektur-Prinzip)

Nach Echo-Loop-Vorbild: **Regeln = Code (testbar), LLM = Interpretation, Review-Gate am Ergebnis.**

| Baustein | Deterministisch (Code, `bun test`) | LLM |
|---|---|---|
| Dokument-Klassifikation | — | ✅ (Typ-Erkennung) |
| Feld-/Stammdaten-Extraktion | Nachbearbeitung/Normalisierung | ✅ (Rohextraktion) |
| Vollständigkeitsprüfung | ✅ Regel-Engine (welche Nachweise nötig je Fallkonstellation) | Hinweis-Formulierung |
| Plausibilitätsprüfung | ✅ Vergleichsregeln (Antrag ↔ Nachweis) | ✅ (unstrukturierte Widersprüche) |
| Gesamteinkommen §13 WoGG | ✅ reine Rechenfunktion | — |
| Anforderungsschreiben | Struktur/Fristen | ✅ (Textausformulierung) |
| Fall-Chat | Quellenauswahl (RAG) | ✅ (Antwort) |

**Jedes KI-Ergebnis ist ein Vorschlag mit Status `offen` und wird von der Sachbearbeitung bestätigt.**
Belegtext + Quell-Dokument-Referenz sind Pflicht (Nachvollziehbarkeit).

---

## 7. Technische Architektur (Mapping auf das Workplace-App-Framework)

Referenz-Apps: `echoloop` (Dokumente + Checks + LLM-Review) und `projektmanagement` (Board/CRUD).

**Backend** `backend/src/apps/wohngeld/`
- `index.ts` → `wohngeldConfig: AppConfig` + `export { wohngeldRoutes }`
- `types.ts`, `storage.ts` (Drizzle-CRUD, Optimistic-Locking via `version`)
- `routes.ts` (Aggregator, `use('*', requireAppAccess('wohngeld'))`) + `routes/*`:
  `akten.ts`, `vorgaenge.ts`, `personen.ts`, `dokumente.ts`, `pruefschritte.ts`, `schreiben.ts`, `posteingang.ts`
- `checker/` — Regel-Engine (Vollständigkeit + Plausibilität), rein & getestet
- `einkommen.ts` — §13-Aggregation, rein & getestet
- `extraction.ts` — LLM-Dokumentextraktion (poppler `pdftotext -layout` wie echoloop)

**DB** `backend/src/db/schema/wohngeld.ts` (eigenes `pgSchema('wohngeld')`) + Migration `backend/drizzle/00XX_wohngeld.sql`
- Konvention: Identitäts-/Filter-Spalten + `data` jsonb + `permissions` + `version`.

**Registrierung** (4 Nähte): `apps/registry.ts` (BUILT_IN_APPS), `routes/apps.ts` (mount),
`index.ts` (`syncBuiltInApps`), Frontend `App.jsx` (Routen + `RequireAppPermission`).

**Frontend** `frontend/src/apps/wohngeld/`
- `PosteingangPage.jsx`, `VorgaengePage.jsx` (Liste), `VorgangDetail.jsx` (Tabs), `components/`
- Styles nur aus `theme.js`; SVG-Icons; Sidebar-Icon + `navIconColors`.

---

## 8. Datenmodell-Entwurf (Tabellen, erste Skizze)

| Tabelle | Zweck | Wichtige Felder (neben data jsonb, permissions, version) |
|---|---|---|
| `akten` | E-Akte | name, antragsteller_name, adresse, plz, ort |
| `vorgaenge` | Antrag/Vorgang | akte_id (FK), antrags_id (unique), wohngeldart, antragsart, status, sachbearbeiter, prioritaet, bwz_start, bwz_ende, iban |
| `personen` | Haushaltsmitglieder | vorgang_id (FK), rolle, nachname, vorname, geburtsdatum, erwerbsstatus |
| `dokumente` | Eingänge/Nachweise | vorgang_id (FK), typ, quelle, seiten, flags, s3_key/pfad, ist_original |
| `pruefschritte` | Vollständigkeit+Plausibilität | vorgang_id (FK), person_id?, kategorie, typ (anforderung/info), status, titel, belegtext, quell_dokument_id |
| `schreiben` | Nachforderungen | vorgang_id (FK), art, betreff, frist, body, export_pfad |
| `aktivitaeten` | Verlauf/Audit | vorgang_id (FK), typ, akteur, zeit, payload |

Status-Modell Vorgang (Vorschlag): `posteingang → sachbearbeitung → warte_auf_rueckmeldung → entscheidung → abgeschlossen`.
Prüfschritt-Status: `offen → erledigt` (+ `verworfen`). Dokumente/Prüfschritte **append-only** wo sinnvoll (Nachvollziehbarkeit).

---

## 9. Rechtsgrundlagen (Referenz für Prüf-/Rechenregeln)

- **WoGG** (Wohngeldgesetz), insb. §§ 13–18 (Gesamteinkommen, Jahreseinkommen, Abzüge, Freibeträge),
  § 9 (zu berücksichtigende Miete), Höchstbeträge/Mietenstufen (§ 12 + Anlage), § 19 (Höhe — nur falls in Scope).
- **WoGV** (Wohngeldverordnung).
- Stand: **Wohngeld-Plus / Wohngeld-Novelle 2024** und ggf. Anpassung 2025 — *zu verifizieren*.

> Für V1 werden vor allem die **Nachweis-Anforderungsregeln** (welche Unterlagen je
> Fallkonstellation) und **Plausibilitätsregeln** benötigt — die exakte Betragsberechnung
> ist optional (Abschnitt 11).

---

## 10. Bau-Reihenfolge (autonomer Loop, Phasen)

Innerhalb einer Phase laufe ich autonom (bauen → `bun test` → korrigieren);
am Phasenende: Commit + Kurzbericht + Kontrollpunkt.

- **Phase 0 — Fundament (dieser Spec + Goldfälle):** Datenmodell finalisieren, 1. Goldfall
  aus Screenshot-Beispiel „Petermann" als Fixture, Regel-Katalog (Nachweise/Plausibilität) festschreiben.
- **Phase 1 — Regel- & Rechenkern:** `checker/` (Vollständigkeit + Plausibilität) und
  `einkommen.ts` (§13) als reine, getestete Funktionen (TDD gegen Goldfälle).
- **Phase 2 — App-Gerüst:** DB-Schema + Migration, Backend-Routes, 4 Registrierungs-Nähte,
  Frontend-Grundgerüst (Liste + Detail-Tabs), Permission-Gate.
- **Phase 3 — Geführte UI:** Übersicht-Sektionen, Personen-Detail, Prüfschritte-/Dokumente-/Details-Seitenleiste,
  Bearbeitungsmodus, Theme-konform.
- **Phase 4 — Posteingang + Extraktion:** Upload, LLM-Klassifikation/Extraktion, Verteilung/Vorgangserstellung.
- **Phase 5 — Schreiben + Export:** Anforderungsschreiben-Generierung, Fristen, Word/PDF-Export.
- **Phase 6 (optional) — Chat + Einkommensprognose + Verfügung.**

Der **Goldfall** (durchgerechnetes/erwartetes Ergebnis je Prüfschritt) ist der Motor:
Er erlaubt mir, Phase 1 ohne Rückfragen grün zu bekommen.

---

## 11. Entscheidungen & verbleibende Annahmen

**Entschieden (2026-09-18):**
1. **Keine §19-Betragsberechnung.** Nur Prüfung/Plausibilität + Gesamteinkommen (§13).
2. **Regel-Katalog selbst recherchiert** (WoGG/WoGV + Praxis); Validierung später mit Pilot-Kommune.

**Arbeitsannahmen (bis zur Kommunen-Validierung):**
3. **Dokument-Extraktion:** Baue zunächst gegen den „Petermann"-Beispielfall aus den Screenshots
   (Goldfall-Fixture). Reale (anonymisierte) PDFs später.
4. **E-Akte/Export:** PDF + Attributverzeichnis (Ausschreibung §2.7) als Zielformat.
5. **Fall-Chat (RAG über WoGG):** V1.1 (nach Kern-Prüflogik + UI).

---

## 12. Quellen

- `docs/wohngeld/03_Leistungsbeschreibung_KI_Antragsassistent Wohngeld.pdf` (KISA 110-6837, v1.0, 2026-08-21)
- `docs/wohngeld/Bildschirmfoto 2026-09-18 um 13.06.53–13.09.24.png` (9 Screenshots, Referenzprodukt „forml")
- Workplace-App-Muster: `backend/src/apps/echoloop/`, `backend/src/apps/projektmanagement/`,
  `docs/echoloop-app-fundament-2026-07-30.md`

> Hinweis: Die Screenshots stammen vom Fremdprodukt „forml" und dienen ausschließlich als
> UX-/Umfangs-Referenz. Wir nehmen an der KISA-Ausschreibung **nicht** teil.
