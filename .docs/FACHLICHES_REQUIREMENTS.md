# KI PM-Assistent — Fachliches Requirements-Dokument

**Version:** 1.0
**Datum:** 15. Februar 2026
**Zweck:** Plattformunabhängige, rein fachliche Spezifikation aller Funktionen, Daten, Masken und Prozesse des KI PM-Assistenten. Dieses Dokument dient als Grundlage für eine Neuimplementierung in einem beliebigen Framework.

---

## 1. Produktvision & Kontext

### 1.1 Was ist der KI PM-Assistent?

Ein KI-gestütztes Werkzeug zur **strukturierten Erstellung, Prüfung und Analyse von Projektdokumenten** nach der Methodik der **RUHR PM Masterclass Projektmanagement 4.0**. Das Tool begleitet den Anwender durch den gesamten Projektmanagement-Lebenszyklus — von der Projektidee bis zum Projektabschluss — und nutzt LLM-basierte Analyse, um Qualität zu sichern und Erkenntnisse aus historischen Projekten einzubringen.

### 1.2 Übergeordneter Projektlebenszyklus

Das Tool bildet folgenden PM-Lebenszyklus ab. **Aktuell ist nur Modul 2 (Projektauftrag) implementiert.** Die anderen Module sind geplant.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PORTFOLIOMANAGEMENT (geplant)                     │
│  Projektübergreifende Sicht, Ressourcen, Priorisierung, Dashboards  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐│
│  │ MODUL 1  │───▶│   MODUL 2    │───▶│   MODUL 3    │───▶│MODUL 4 ││
│  │Projekt-  │    │Projektauftrag│    │ Status-      │    │Projekt-││
│  │idee      │    │ (umgesetzt)  │    │ berichte     │    │abschluss│
│  │(geplant) │    │              │    │ (geplant)    │    │(geplant)││
│  └──────────┘    └──────────────┘    └──────────────┘    └────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Methodischer Rahmen

Die fachliche Grundlage bildet die **RUHR PM Masterclass Projektmanagement 4.0** mit folgenden Kernkonzepten:

- **DIN 69901 / PMI PMBOK** Projektdefinitionen
- **Projektphasen:** Initialisierung → Definition → Planung → Umsetzung → Steuerung → Abschluss
- **SMART-Methode** für Ziele und Erfolgskriterien
- **Magisches Dreieck:** Scope, Zeit, Budget, Qualität
- **Tuckman-Phasenmodell** für Teamentwicklung (Forming → Storming → Norming → Performing)
- **DISG-Modell** für Persönlichkeitstypen
- **Stakeholder-Matrix** nach Einfluss/Interesse (Quadranten A–D)
- **Risikomanagement:** Bedrohungen (Vermeiden, Vermindern, Übertragen, Akzeptieren) und Chancen (Nutzen, Verstärken, Teilen, Akzeptieren)
- **Projektgrößen:** S, M, L, XL — bestimmen Formalisierungsgrad

### 1.4 KI-Hypothesen

Die Anwendung basiert auf folgenden fachlichen Hypothesen:

1. **Hypothese "Strukturierte Erfassung":** Ein geführter Wizard mit schrittweiser Erfassung erzeugt vollständigere Projektaufträge als Freitext-Dokumente.
2. **Hypothese "KI-Qualitätssicherung":** LLM-basierte Analyse jedes Eingabeschritts verbessert die Qualität der Eingaben, indem typische Fehler und Lücken sofort identifiziert werden.
3. **Hypothese "Lernen aus der Geschichte":** Der Abgleich mit historischen Projekten identifiziert Blind Spots (Risiken, die der Planer übersehen hat) und Chancen (Erfolgsmuster zum Replizieren).
4. **Hypothese "Wissenstransfer":** Eingebettetes PM-Fachwissen (Masterclass Knowledge Base) senkt die Einstiegshürde und standardisiert die Methodik organisationsweit.

---

## 2. Benutzerrollen

| Rolle | Beschreibung | Berechtigungen |
|-------|-------------|----------------|
| **Projektleiter** | Erstellt und pflegt Projektaufträge, führt Analysen durch | Alle Eingabe- und Analyse-Funktionen |
| **Auftraggeber** | Prüft und genehmigt Projektaufträge | Lesend, Kommentierung (zukünftig) |
| **PMO / Portfolio-Manager** | Überblick über alle Projekte, Priorisierung | Portfolio-Dashboards (zukünftig) |
| **Teammitglied** | Lesender Zugriff auf Projektauftrag und Statusberichte | Lesend (zukünftig) |

> **Hinweis:** In der aktuellen Implementierung gibt es kein Benutzer- oder Rechtesystem. Alle Funktionen stehen jedem Anwender zur Verfügung. Ein Rollen-/Rechtekonzept ist für zukünftige Module relevant.

---

## 3. Datenmodell

### 3.1 Entität: Projektauftrag (Kernentität)

Dies ist das zentrale Datenobjekt der Anwendung. Es wird schrittweise im Wizard befüllt.

```
Projektauftrag {
  // Basis-Informationen (Schritt 1)
  name:            String        — Projektname (required, aussagekräftig)
  id:              String        — Eindeutige Projekt-ID (required)
  project_type:    Enum          — Projektart (see 3.1.1)
  start:           Date          — Projektstart (YYYY-MM-DD, required)
  end:             Date          — Projektende (YYYY-MM-DD, required)
  projektleiter:   String        — Name des Projektleiters
  auftraggeber:    String        — Name des Auftraggebers

  // Ziele & Erfolgskriterien (Schritt 2)
  goals:           Text          — Projektziel (Freitext, beschreibt Zielzustand)
  criteria:        String[]      — Liste messbarer Erfolgskriterien (empfohlen: 5–7)

  // Inhalt & Umfang (Schritt 3)
  scope:           Text          — Verbale Beschreibung des Projektumfangs
  in_scope:        Text          — Was ist Teil des Projekts
  out_scope:       Text          — Was ist NICHT Teil des Projekts

  // Hauptaufgaben (Schritt 4)
  tasks:           Task[]        — Liste der Hauptaufgaben (see 3.1.2)

  // Meilensteine (Schritt 5)
  milestones:      Milestone[]   — Liste der Meilensteine (see 3.1.3)

  // Budget (Schritt 6)
  budget:          BudgetItem[]  — Liste der Budget-Positionen (see 3.1.4)

  // Risiken (Schritt 6)
  risks:           Risk[]        — Liste der Risiken und Chancen (see 3.1.5)

  // Organisation (Schritt 7)
  organization:    TeamMember[]  — Kernteam (see 3.1.6)
  stakeholders:    Stakeholder[] — Stakeholder-Liste (see 3.1.7)
}
```

#### 3.1.1 Enum: Projektart

Aktuell in der Anwendung hinterlegte Projektarten:
```
"Anlagen" | "Ausbildung" | "Beratung" | "Finanzen" | "Forschung" |
"IT- Software" | "IT-Infrastruktur" | "Organisation" | "Vertrieb"
```

Im JSON-Schema definiert (abweichend, da Schema separat gepflegt):
```
"IT" | "Software" | "Beratung" | "Forschung" | "Marketing"
```

> **Hinweis für Neuimplementierung:** Die Enum-Werte in der UI und im JSON-Schema sind aktuell nicht synchron. In der Neuimplementierung sollte eine einheitliche, erweiterbare Liste gepflegt werden. Die Projektart beeinflusst die Relevanzfilterung beim historischen Vergleich (IT vs. IT = hohe Relevanz, IT vs. Bau = niedrig).

#### 3.1.2 Sub-Entität: Task (Hauptaufgabe)

```
Task {
  name:        String    — Bezeichnung der Aufgabe (required)
  responsible: String    — Verantwortliche Person
  start_date:  Date      — Beginn der Aufgabe
  end_date:    Date      — Ende der Aufgabe
  effort:      Number    — Aufwand in Personentagen (PT), min: 0, step: 0.5
}
```

**Fachliche Regeln (aus Masterclass):**
- Arbeitspakete: Dauer >= 2 Tage, <= 5 Tage
- Aufwand: >= 5 PT, <= 10 PT pro Paket
- Kosten: >= 0,5 T€, <= 5 T€ pro Paket
- Ressourcen: >= 1, <= 3 Personen pro Paket
- PM-Aufgaben (Statusberichte, Meetings) müssen enthalten sein
- 10–15% Puffer für Unvorhergesehenes

#### 3.1.3 Sub-Entität: Milestone (Meilenstein)

```
Milestone {
  name: String   — Bezeichnung des Meilensteins (required)
  date: Date     — Termin (YYYY-MM-DD, required)
}
```

**Fachliche Regeln:**
- Automatische chronologische Sortierung nach Datum
- Anzeige des Zeitabstands (in Tagen) zwischen aufeinanderfolgenden Meilensteinen
- Faustregel: Anzahl Meilensteine (ohne Start/Ende) <= Projektdauer in Monaten
- Standard-Meilensteine: Projektstart, Auftragsfreigabe, Kick-Off, Go-Live, Projektabschluss
- PM-Meilensteine (Standard) und Fach-Meilensteine (projektspezifisch) unterscheiden

#### 3.1.4 Sub-Entität: BudgetItem (Budget-Position)

```
BudgetItem {
  item:     String   — Bezeichnung der Position (required)
  provider: String   — Anbieter/Firma
  amount:   Number   — Betrag in EUR (min: 0, step: 100)
}
```

**Fachliche Regeln (aus Masterclass):**
- Kostenkategorien: Interne Kosten (PT × Tagessatz), Externe Kosten (Beratung, Lizenzen, Hardware), Risikobudget (10–15%)
- Gesamtbudget wird automatisch summiert und angezeigt

#### 3.1.5 Sub-Entität: Risk (Risiko/Chance)

```
Risk {
  type:        Enum("threat", "opportunity") — Art des Risikos
  description: Text                          — Beschreibung (required)
  probability: Enum("NIEDRIG", "MITTEL", "HOCH")           — Eintrittswahrscheinlichkeit
  impact:      Enum("NIEDRIG", "MITTEL", "HOCH", "KRITISCH") — Auswirkung
  mitigation:  Text                          — Gegenmaßnahme (bei Bedrohung) / Maßnahme (bei Chance)
}
```

**Fachliche Regeln:**
- Bedrohungen und Chancen werden getrennt erfasst und angezeigt
- Farbcodierung nach Auswirkung: KRITISCH (rot), HOCH (orange), MITTEL (gelb), NIEDRIG (grün)
- Risikowert (RW) = Wahrscheinlichkeit × Auswirkung
- Strategien für Bedrohungen: Vermeiden, Vermindern, Übertragen, Akzeptieren
- Strategien für Chancen: Nutzen, Verstärken, Teilen, Akzeptieren

#### 3.1.6 Sub-Entität: TeamMember (Teammitglied)

```
TeamMember {
  name: String   — Name der Person (required)
  role: String   — Rolle im Projekt (required)
}
```

**Fachliche Regeln:**
- Kernteam max. 7 Personen (Kommunikationseffizienz)
- Rollen nach RUHR PM: Auftraggeber, Lenkungskreis, Projektleiter, Kernteam, Projektteam
- Agile Rollen: Product Owner, Scrum Master

#### 3.1.7 Sub-Entität: Stakeholder

```
Stakeholder {
  name: String   — Name/Gruppe des Stakeholders (required)
  role: String   — Funktion/Interesse
}
```

**Fachliche Regeln:**
- Bewertung nach Einfluss (1–9) und Interesse (1–9)
- Quadranten: A (hoch/hoch) = aktiv einbinden, B (hoch/niedrig) = informieren, C (niedrig/hoch) = regelmäßig informieren, D (niedrig/niedrig) = allgemein informieren
- Typische Stakeholder: Auftraggeber, Lenkungskreis, Fachabteilungen, IT, Betriebsrat, Endanwender, externe Partner, Kunden

### 3.2 Entität: Historisches Projekt (Pipeline-Format)

Historische Projekte liegen in einem internen Format vor, das für die LLM-Verarbeitung optimiert ist. Die `contents`-Felder enthalten **Tab-separierte Textdaten (TSV-Format)**, keine strukturierten Arrays. Dies ist beabsichtigt — LLMs verarbeiten diese Textrepräsentation direkt.

```
HistorischeProjekt {
  meta: {
    source_folder: String          — Projektname/Identifier (z.B. "01 DZE24 MGT")
    type:          "project"       — Immer "project"
    source_type:   Enum            — "xlsx_toolbox" | "projektauftrag"
    tags:          String[]        — Kategorisierung
  }
  contents: {
    head:       String   — Header-Infos (Name, ID, PL, AG, Start, Ende, Typ)
    goals:      String   — Ziele und Erfolgskriterien
    criteria:   String   — Anforderungen, Scope, Aufgaben
    milestones: String   — Meilenstein-Tabelle mit Status
    budget:     String   — Budget-Tabelle mit Positionen
    risks:      String   — Risiken-Tabelle mit Bewertungen
    entities:   String   — Organisation und Stakeholder
  }
  history: {                        — NUR bei abgeschlossenen Projekten
    logs:            String?        — Änderungshistorie (Datum + Anpassung)
    lessons_learned: String?        — SWOT-basierte Lessons Learned
    summary:         String?        — Ergebniszusammenfassung (Zeit, Scope, Qualität, Budget, Kommunikation)
  }
}
```

> **Wichtig:** Neue Projektaufträge (aus dem Wizard) werden über einen Konverter in dieses Format überführt, bevor sie in die Analyse-Pipeline gehen. Das `history`-Feld bleibt bei neuen Projekten leer.

### 3.3 Entität: Analyse-Ergebnis (ComparisonResult)

Das Ergebnis einer historischen Vergleichsanalyse.

```
ComparisonResult {
  target_project:     String       — Name des analysierten Projekts
  match_projects:     String[]     — Namen der Referenzprojekte
  match_count:        Number       — Anzahl Referenzprojekte
  executive_summary:  Text         — Zusammenfassung in 1–2 Sätzen
  total_blind_spots:  Number       — Anzahl identifizierter Bedrohungen
  total_opportunities: Number      — Anzahl identifizierter Chancen
  high_risk_phases:   Number       — Anzahl risikobehafteter Projektphasen

  // Domain-spezifische Ergebnisse (see 3.4)
  risks:       DomainInsights
  milestones:  DomainInsights
  people:      DomainInsights
  general:     DomainInsights
}
```

### 3.4 Sub-Entität: DomainInsights (Domain-Ergebnis)

Jede der vier Analyse-Domänen liefert ein strukturiertes Ergebnis mit UI-Bausteinen.

```
DomainInsights {
  domain:            Enum("people", "risks", "milestones", "general")
  summary:           String       — Einzeiler (< 100 Zeichen)
  executive_insight:  Text        — Kernerkenntnis (1–2 Sätze)
  aggregated:        Text         — Roher Aggregationstext
  structured:        Object       — Domain-spezifisches strukturiertes Ergebnis (see 3.4.1–3.4.4)
}
```

#### 3.4.1 RisksResult (Risiko-Analyse)

```
RisksResult {
  blind_spots:     RiskCard[]     — Bedrohungen aus historischen Projekten
  opportunities:   RiskCard[]     — Erfolgsmuster zum Replizieren
  risk_comparison: TableData?     — Geplant vs. historisch (Tabelle)
}

RiskCard {
  title:    String                — Risiko-/Chancen-Titel
  subtitle: String?               — z.B. "In 2/3 Projekten aufgetreten"
  body:     Text                  — Beschreibung und Auswirkung
  tags:     String[]?             — Kategorien (z.B. "Budget", "Ressourcen")
  severity: Enum("high", "medium", "low")
  source:   String                — Quell-Referenzprojekt(e)
}
```

#### 3.4.2 MilestonesResult (Meilenstein-Analyse)

```
MilestonesResult {
  high_risk_phases:        CardItem[]  — Phasen mit historischen Verzögerungen
  milestone_comparison:    TableData   — Plan vs. Realität Vergleich
  structural_observations: Text?       — Timeline-Dichteanalyse
}
```

#### 3.4.3 PeopleResult (Team-Analyse)

```
PeopleResult {
  sections: Section[]
  // Typische Sections:
  //   - "people_matches": Tabelle — Wer taucht in mehreren Projekten auf?
  //   - "people_roles": Cards — Rollenkontinuität
  //   - "people_experience": Cards — Erfahrungsträger
}
```

#### 3.4.4 GeneralResult (Allgemeine Analyse)

```
GeneralResult {
  heatmap:            CardItem[]   — Top 3 strukturelle Konfliktpunkte (max. 3)
  joker:              CardItem?    — Nicht-offensichtliche Parallele/Erkenntnis
  budget_scope_check: KeyValue[]   — Budget- und Scope-Realitätsprüfung
  graveyard:          CardItem[]   — Lessons Learned und verbindliche Ableitungen
}
```

### 3.5 UI-Bausteine (Wiederverwendbare Komponenten)

Die Analyse-Ergebnisse nutzen standardisierte UI-Bausteine:

```
Section {
  id:             String
  title:          String
  component_type: Enum("table", "cards", "key_value", "text", "alert", "metrics")
  collapsed:      Boolean (default: true)
  tooltip:        String?

  // Genau EINS der folgenden Felder ist befüllt (je nach component_type):
  table_data:   TableData?
  cards:        CardItem[]?
  key_values:   KeyValue[]?
  text_content: String?
  alert_level:  Enum("info", "warning", "error", "success")?
  metrics:      MetricItem[]?
}

TableData {
  columns: String[]
  rows:    Object[]       — Array von Zeilen-Objekten
}

CardItem {
  title:    String
  subtitle: String?
  body:     Text
  tags:     String[]?
  severity: Enum("high", "medium", "low")?
  source:   String?
}

KeyValue {
  key:     String
  value:   String
  tooltip: String?
}

MetricItem {
  label:       String
  value:       String
  delta:       String?      — Änderungsanzeige (z.B. "+15%")
  delta_color: Enum("normal", "inverse", "off")?
}
```

---

## 4. Modul 2: Projektauftrag (Umgesetzt)

Dies ist das aktuell implementierte Kernmodul. Es besteht aus einem mehrstufigen Wizard zur Erstellung eines Projektauftrags, einer KI-gestützten Analyse pro Schritt, einer Übersichtsseite und einer historischen Vergleichsanalyse.

### 4.1 Wizard-Struktur

Der Wizard besteht aus **9 Schritten** (in der aktuellen Implementierung; das TS-Refactoring-Dokument nannte 11 Schritte — die 9 Schritte sind der tatsächliche Stand):

| Schritt | Titel | Funktion | KI-Analyse |
|---------|-------|----------|------------|
| 1 | Basis-Informationen | Stammdaten erfassen + Import | Nein (nur Knowledge Base) |
| 2 | Ziele & Erfolgskriterien | Projektziel + Kriterien-Liste | Ja |
| 3 | Inhalt & Umfang | Scope, In-/Out-of-Scope | Ja |
| 4 | Hauptaufgaben | Aufgaben mit Verantwortlichen | Ja |
| 5 | Meilensteine | Zeitliche Meilensteine | Ja |
| 6 | Budget & Risiken | Kosten + Bedrohungen/Chancen | Ja |
| 7 | Organisation & Stakeholder | Team + Stakeholder | Ja |
| 8 | Übersicht | Read-only Zusammenfassung + KI-Bewertung + Export | Ja (Gesamtbewertung) |
| 9 | Historischer Vergleich | Vergleich mit Referenzprojekten + Chatbot | Ja (Pipeline) |

### 4.2 Maske: Schritt 1 — Basis-Informationen

**Zweck:** Grundlegende Projektdaten erfassen.

**Eingabefelder:**
- Projektname (Text, required)
- Projekt-ID (Text, required)
- Projekttyp (Dropdown/Select aus Enum)
- Projektstart (Datumsauswahl)
- Projektende (Datumsauswahl)
- Projektleiter (Text)
- Auftraggeber (Text)

**Import-Funktionalität:**
- Tab "Aus Vorlagen": Dropdown mit vordefinierten Beispielprojekten aus `data/projektauftraege/`, Vorschau, Laden-Button
- Tab "Datei hochladen": JSON-Datei-Upload mit Validierung, Import-Button

**Seitenleiste (KI-Bereich):**
- Anzeige der RUHR PM Masterclass Wissens-Inhalte für Schritt 1 (Kernkonzepte, Projektphasen, typische Fehler)

### 4.3 Maske: Schritt 2 — Ziele & Erfolgskriterien

**Zweck:** Projektziel definieren und messbare Erfolgskriterien festlegen.

**Eingabefelder:**
- Projektziel (Textarea, mehrzeilig)
- Erfolgskriterien (dynamische Liste):
  - Eingabefeld für neues Kriterium + Hinzufügen-Button
  - Anzeige aller Kriterien mit Löschen-Buttons

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Analyse-Ergebnis-Container (scrollbar)
- Knowledge Base: SMART-Methode, Golden Circle, Empfehlung 5–7 Kriterien

**KI-Analyse (Schritt 2):**
- Prüft Projektziel auf SMART-Kriterien
- Bewertet Erfolgskriterien auf Messbarkeit
- Identifiziert fehlende Aspekte
- Gibt Verbesserungsvorschläge

### 4.4 Maske: Schritt 3 — Inhalt & Umfang

**Zweck:** Projektumfang klar abgrenzen (Was gehört dazu? Was nicht?).

**Eingabefelder:**
- Projektumfang verbal (Textarea, mehrzeilig)
- In-Scope (Textarea, mehrzeilig) — Zweispaltig
- Out-of-Scope (Textarea, mehrzeilig) — Zweispaltig

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Knowledge Base: Magisches Dreieck, MVP-Definition, Scope-Creep-Vermeidung

**KI-Analyse (Schritt 3):**
- Prüft Vollständigkeit des Scopes
- Bewertet In-/Out-of-Scope auf Widerspruchsfreiheit
- Identifiziert potenzielle Scope-Creep-Risiken

### 4.5 Maske: Schritt 4 — Hauptaufgaben

**Zweck:** Arbeitspakete definieren mit Verantwortlichen und Aufwandsschätzung.

**Eingabefelder (pro Aufgabe):**
- Bezeichnung (Text)
- Verantwortlich (Text)
- Start (Datumsauswahl)
- Ende (Datumsauswahl)
- Aufwand in PT (Zahl, min: 0, step: 0.5)
- Hinzufügen-Button

**Anzeige:**
- Tabelle aller Aufgaben (5 Spalten + Löschen-Button)
- Gesamtaufwand summiert

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Knowledge Base: Projektstrukturplan, Arbeitspakete, Schätzverfahren

**KI-Analyse (Schritt 4):**
- Prüft semantische Abdeckung (nicht nur exakte Begriffe)
- Identifiziert fehlende Aufgabentypen (PM-Aktivitäten, QA, Tests)
- Bewertet Aufwandsschätzungen auf Realismus
- Prüft ob 10–15% Puffer eingeplant ist

### 4.6 Maske: Schritt 5 — Meilensteine

**Zweck:** Zeitliche Meilensteine definieren.

**Eingabefelder (pro Meilenstein):**
- Bezeichnung (Text)
- Termin (Datumsauswahl)
- Hinzufügen-Button

**Anzeige:**
- Chronologisch sortierte Liste (3 Spalten + Löschen-Button)
- Zeitabstand in Tagen zwischen aufeinanderfolgenden Meilensteinen

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Knowledge Base: Faustregel Anzahl, PM- vs. Fach-Meilensteine, Abhängigkeiten

**KI-Analyse (Schritt 5):**
- Prüft semantische Abdeckung der Meilenstein-Typen
- Bewertet Zeitabstände auf Realismus
- Prüft ob Standard-Meilensteine vorhanden sind (Start, Freigabe, Kick-Off, Go-Live, Abschluss)

### 4.7 Maske: Schritt 6 — Budget & Risiken

**Zweck:** Kostenplanung und Risikomanagement.

**Budget-Eingabefelder (pro Position):**
- Bezeichnung (Text)
- Anbieter (Text)
- Betrag in EUR (Zahl, min: 0, step: 100)
- Hinzufügen-Button

**Budget-Anzeige:**
- Tabelle (4 Spalten + Löschen-Button)
- Gesamtbudget summiert

**Risiko-Eingabefelder (pro Risiko):**
- Art (Radio: "Bedrohung" / "Chance")
- Beschreibung (Textarea) — Label ändert sich je nach Art
- Gegenmaßnahme / Maßnahme (Textarea) — Label ändert sich je nach Art
- Eintrittswahrscheinlichkeit (Dropdown: NIEDRIG, MITTEL, HOCH)
- Auswirkung (Dropdown: NIEDRIG, MITTEL, HOCH, KRITISCH)
- Hinzufügen-Button

**Risiko-Anzeige:**
- Bedrohungen und Chancen getrennt angezeigt
- Farbcodierung nach Auswirkung (rot, orange, gelb, grün)
- Löschen-Buttons

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Knowledge Base: Kostenkategorien, Risikobewertung, Strategien

**KI-Analyse (Schritt 6):**
- Prüft ob alle Kostenkategorien abgedeckt sind
- Identifiziert ob Risikobudget (10–15%) vorhanden ist
- Bewertet Risiken auf Vollständigkeit
- Prüft ob Maßnahmen definiert sind

### 4.8 Maske: Schritt 7 — Organisation & Stakeholder

**Zweck:** Projektteam und Stakeholder definieren.

**Organisation-Eingabefelder (pro Person):**
- Name (Text)
- Rolle (Text)
- Hinzufügen-Button

**Stakeholder-Eingabefelder (pro Stakeholder):**
- Name (Text)
- Funktion/Interesse (Text)
- Hinzufügen-Button

**Anzeige:**
- Dynamische Listen mit Löschen-Buttons

**Seitenleiste (KI-Bereich):**
- Button "KI-Analyse starten"
- Knowledge Base: Rollen, Kernteam max. 7, Stakeholder-Quadranten, Tuckman-Modell

**KI-Analyse (Schritt 7):**
- Prüft ob wesentliche Rollen besetzt sind
- Bewertet Teamgröße (max. 7 Kernteam)
- Identifiziert fehlende Stakeholder-Gruppen
- Prüft Interessenkonflikte (z.B. PL = AG)

### 4.9 Maske: Schritt 8 — Übersicht

**Zweck:** Read-only Zusammenfassung des Projektauftrags mit KI-Bewertung und Export.

**Oberer Bereich — KPI-Cards (5 Stück):**
1. Laufzeit (berechnet aus Start/Ende)
2. Gesamtaufwand (Summe aller Tasks in PT)
3. Gesamtbudget (Summe aller Budget-Positionen in EUR)
4. Teamgröße (Anzahl Organisation-Mitglieder)
5. Risiken (Anzahl aller Risiken)

**Stammdaten-Bereich:**
- Projektname, Projekt-ID, Projekttyp
- Startdatum, Enddatum, Laufzeit
- Projektleiter, Auftraggeber

**Tab-Navigation (5 Tabs):**

| Tab | Inhalt |
|-----|--------|
| Übersicht | Stammdaten-Grid, Projektziel, Erfolgskriterien-Liste, Team-Tabelle |
| Aufgaben | Aufgaben-Tabelle (alle Spalten) + Gesamtaufwand |
| Meilensteine | Meilenstein-Tabelle |
| Budget | Budget-Tabelle + Gesamtbudget (hervorgehoben) |
| Risiken | Farbcodierte Bedrohungs-Cards + Chancen-Cards |

**Rechte Seitenleiste — KI-Bewertung:**
- Button "Projektauftrag analysieren"
- **Risk Score:** Numerischer Wert (groß dargestellt)
- **Risk Label:** Textuelle Einordnung
- **Stärken:** Liste mit ✅ (grüne Box)
- **Empfehlungen:** Liste mit 💡 (blaue Box)

**Export-Bereich:**
- JSON exportieren (Download als .json)
- CSV exportieren (Download als .csv, Semikolon-getrennt, sektionsweise)
- Word exportieren (Download als .docx, formatiert mit Tabellen und Farbcodierung)

### 4.10 Maske: Schritt 9 — Historischer Vergleich

> **⚠️ KONZEPT-REVIEW EMPFOHLEN:** Diese Funktion basiert auf einer mehrstufigen LLM-Pipeline (36+ API-Calls pro Analyse) und dauert entsprechend lange. Das Konzept des historischen Abgleichs sollte hinsichtlich Kosten-Nutzen-Verhältnis, Laufzeit und Ergebnisqualität in der Neuimplementierung grundsätzlich reviewt werden. Mögliche Überarbeitungsansätze: Reduzierung der Pipeline-Phasen, Caching-Strategien, inkrementelle Analyse, Vorberechnung von Projekt-Embeddings.

**Zweck:** Das aktuelle Projekt mit historischen Referenzprojekten vergleichen, um Blind Spots, Chancen und Lessons Learned zu identifizieren.

**Oberer Bereich — Konfiguration:**
- Multiselect: Referenzprojekte auswählen (max. 5, aus `data/projects/`)
- Button "Vergleich starten"
- Datei-Upload für gespeicherte Analysen (JSON)

**Ergebnis-Anzeige — KPI-Cards (4 Stück):**
1. Blind Spots (Anzahl identifizierter Bedrohungen)
2. Chancen (Anzahl identifizierter Erfolgsmuster)
3. Risikophasen (Anzahl zeitkritischer Phasen)
4. Referenzen (Anzahl analysierter Referenzprojekte)

**Executive Summary:** Info-Box mit Zusammenfassung

**Tab-Navigation (5 Tabs):**

| Tab | Inhalt |
|-----|--------|
| Übersicht | Executive Summary, Gesamtübersicht |
| Risiken | Blind Spots (farbcodierte Cards), Chancen (grüne Cards) |
| Meilensteine | Risikophasen (Cards), Plan-vs-Realität-Tabelle, Strukturbeobachtungen |
| Team | Personen-Matches (Tabelle/Cards), Erfahrungsträger |
| Allgemein | Heatmap, Joker, Budget/Scope-Check, Lessons Learned |

**Aktions-Buttons:**
- "Analyse speichern" (Download als JSON)
- "Neue Analyse starten" (Reset)

**Rechte Seitenleiste — KI-Projektberater (Chatbot):**
- Streaming Chat-Interface
- Kontext: Aktuelles Projekt + Analyse-Ergebnisse + Referenzprojekte + Masterclass-Wissen
- Regeln: Deutsch, präzise, praxisorientiert, max. 300 Wörter (außer bei expliziter Nachfrage)
- Chat-Historie pro Session
- "Chat leeren"-Button

### 4.11 Navigation & UX

**Hauptnavigation:**
- Logo-Header
- Reset-Button (setzt alle Daten zurück)
- Fortschrittsanzeige ("Schritt X von 9")
- 9 Step-Buttons (direkte Navigation zu jedem Schritt)
- Zurück-/Weiter-Buttons am unteren Rand
- Schritt 7 → "Zur Übersicht" statt "Weiter"
- Schritt 8 → "Zum Vergleich" statt "Weiter"

**Session-Management:**
- Alle Daten im Session State (nicht persistent)
- Analyse-Caching: Bereits durchgeführte Step-Analysen werden gecacht und bei Eingabeänderung als "veraltet" markiert
- Toast-Benachrichtigungen für Benutzeraktionen

---

## 5. Analyse-Pipeline (Kern-Engine)

### 5.1 Übersicht

Die Analyse-Pipeline ist das Herzstück des historischen Vergleichs. Sie verarbeitet einen neuen Projektauftrag gegen N Referenzprojekte in **4 Analyse-Domänen** mit jeweils **4 Phasen**.

```
                          ┌─────────────────────┐
                          │   Projektauftrag     │
                          │   (Wizard-Daten)     │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    Konvertierung     │
                          │  PA → Pipeline-Format│
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
    │  Referenzprojekt 1 │ │  Referenzprojekt 2 │ │  Referenzprojekt N │
    └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
          ┌─────────▼──┐   ┌────────▼───┐   ┌───────▼──────┐
          │   People   │   │   Risks    │   │  Milestones  │  ...
          │  (Parallel) │   │ (Parallel) │   │  (Parallel)  │
          └─────────┬──┘   └────────┬───┘   └───────┬──────┘
                    │                │                │
                    ▼                ▼                ▼
           ┌──────────────────────────────────┐
           │     Pro Domain: 4 Phasen         │
           │  EXTRACT → COMPARE → AGGREGATE   │
           │          → STRUCTURE              │
           └──────────────────────────────────┘
```

### 5.2 Vier Phasen der Pipeline

#### Phase 1: EXTRACT (Extraktion)

**Zweck:** Relevante domain-spezifische Informationen aus Rohdaten standardisiert extrahieren.

**Input:** Projekt-JSON (Ziel oder Referenz)
**Output:** Strukturierter Text mit domain-spezifischen Informationen

**Besonderheit:** Die Domain "general" überspringt die Extraktion und arbeitet direkt mit Rohdaten.

**Parallelisierung:** Alle Extraktionen (Ziel + N Referenzen) laufen parallel.

#### Phase 2: COMPARE (Vergleich)

**Zweck:** 1:1 Vergleich zwischen Zielprojekt und jedem einzelnen Referenzprojekt.

**Input:** Extrahierte Daten (Ziel) + Extrahierte Daten (Referenz)
**Output:** Vergleichsbericht mit identifizierten Mustern, Lücken, Übereinstimmungen

**Parallelisierung:** Alle N Vergleiche (Ziel vs. Referenz 1, Ziel vs. Referenz 2, ...) laufen parallel.

**Kritisches Filterprinzip (besonders für Risiken):**
Das "Signal-Rausch-Verhältnis" ist das Kernprinzip. Der Vergleich ist ein **Filter, kein Scanner**:

1. **Standardannahme:** Referenzprojekt ist IRRELEVANT, bis Gegenteil bewiesen
2. **Domänen-Match:** Nur bei ähnlichem Projekttyp sind technische Risiken relevant
3. **Situations-Match:** Nur bei vergleichbaren Rahmenbedingungen
4. **Lücken-Analyse:** Nur Punkte melden, die das Zielprojekt ignoriert

#### Phase 3: AGGREGATE (Aggregation)

**Zweck:** Synthese aller N Vergleichsberichte zu einem priorisierten Gesamtbericht.

**Input:** N Vergleichsberichte (alle mit Quell-Labels)
**Output:** Priorisierter Gesamtbericht mit Häufigkeits- und Schweregrad-Ranking

**Logik:**
1. Wiederkehrende Muster über alle Referenzprojekte identifizieren
2. Priorisieren nach: (a) Häufigkeit des Auftretens, (b) Schwere der Auswirkung
3. Duplikate und schwache Signale entfernen
4. Quellenangaben beibehalten

#### Phase 4: STRUCTURE (Strukturierung)

**Zweck:** Umwandlung des aggregierten Textberichts in strukturiertes JSON gemäß Pydantic-Schema.

**Input:** Aggregierter Text + Ziel-Schema
**Output:** Validiertes, typsicheres JSON für die UI-Darstellung

**Besonderheit:** Nutzt Schema-basierte LLM-Antworten (response_format) mit strikter Validierung.

### 5.3 Domänen im Detail

#### 5.3.1 Domain: People (Team-Analyse)

**Was wird analysiert:**
- Namentliche Personen-Übereinstimmungen zwischen Projekten
- Rollenkontinuität (gleiche Person, andere Rolle)
- Erfahrungsträger (wer hat an ähnlichen Projekten gearbeitet)

**Vergleichslogik:** Einfaches Matching — taucht Person X in mehreren Projekten auf?

**Ergebnis-Struktur:** Tabellen (People Matches), Cards (Erfahrungsträger)

#### 5.3.2 Domain: Risks (Risiko-Analyse)

**Was wird analysiert:**
- A-priori-Risiken (geplante Risiken des Zielprojekts)
- A-posteriori-Risiken (tatsächlich eingetretene Probleme bei Referenzprojekten)
- Chancen (Erfolgsmuster aus der Geschichte)

**Vergleichslogik:** Aggressivstes Filtering aller Domänen:
1. Domänen-Relevanz (IT vs. IT = hoch, IT vs. Bau = niedrig)
2. Situationsvergleich (nur bei vergleichbaren Bedingungen)
3. Lückenanalyse (nur was das Zielprojekt ignoriert)
4. Schwache Treffer eliminieren (keine generischen Risiken)

**Ergebnis-Struktur:** Blind Spots (Cards mit Severity), Opportunities (Cards), Risk Comparison (Tabelle)

#### 5.3.3 Domain: Milestones (Zeitplan-Analyse)

**Was wird analysiert:**
- Planungsannahmen vs. historische Realität
- Tatsächliche Verhältnisse (geplant X Wochen, tatsächlich Y Wochen)
- Ursachen für Verzögerungen
- Management-Muster (Lieferantenverzögerungen etc.)

**Vergleichslogik:** Realitätsorientiert
- **Kernregel: "Versuche NICHT die Zukunft vorherzusagen"**
- Vergleiche nur Planungsannahmen mit historischer Realität
- Extrahiere Verhältnisse: "Geplant 2 Wochen, tatsächlich 8 Wochen = Faktor 4"
- Melde wenn Zielprojekt gleiche optimistische Annahmen verwendet

**Ergebnis-Struktur:** High-Risk Phases (Cards), Milestone Comparison (Tabelle mit Plan/Actual/Gap), Structural Observations (Text)

#### 5.3.4 Domain: General (Allgemeine Analyse)

**Was wird analysiert:**
- Gesamtprojekt-Charakteristiken
- Budget- und Ressourcenplanung
- Timing und Interdependenzen
- Lessons Learned Übertragung

**Vergleichslogik:** Beobachtungsbasiert
- **Kernregel: "Beobachten, nicht beraten"**
- Keine Empfehlungen, nur Beobachtungen
- Kontrastiere spezifische Attribute
- Identifiziere wo Zielprojekt historische Realität widerspricht

**Ergebnis-Struktur:** Heatmap (max. 3 Cards), Joker (1 Card), Budget/Scope Check (Key-Values), Graveyard (Cards)

### 5.4 LLM-Aufruf-Kalkulation

Pro Vergleichsanalyse mit N Referenzprojekten:
- **Extract:** (N+1) Aufrufe pro Domain × 3 Domains (People, Risks, Milestones; General überspringt) = 3×(N+1)
- **Compare:** N Aufrufe pro Domain × 4 Domains = 4×N
- **Aggregate:** 1 Aufruf pro Domain × 4 = 4
- **Structure:** 1 Aufruf pro Domain × 4 = 4

**Gesamt bei N=3 Referenzen:** 3×4 + 4×3 + 4 + 4 = 12 + 12 + 4 + 4 = **32 LLM-Aufrufe**
**Bei N=5 Referenzen:** 3×6 + 4×5 + 4 + 4 = 18 + 20 + 4 + 4 = **46 LLM-Aufrufe**

### 5.5 Fortschrittsanzeige

Während der Analyse wird dem Benutzer der Fortschritt angezeigt:
- Aktuelle Domain (z.B. "Risiken & Chancen")
- Aktuelle Phase (z.B. "Vergleich")
- Prozentuale Fortschrittsanzeige
- Status pro Domain (ausstehend, aktiv, abgeschlossen)

---

## 6. KI-Analyse pro Wizard-Schritt

### 6.1 Funktionsweise

Jeder Wizard-Schritt (2–7) bietet eine optionale KI-Analyse, die die aktuellen Eingaben gegen die Prüfkriterien der RUHR PM Masterclass prüft.

**Ablauf:**
1. Benutzer klickt "KI-Analyse starten"
2. System übergibt aktuelle Eingaben + Masterclass-Wissenskontext an LLM
3. LLM prüft gegen Prüfkriterien und gibt strukturiertes Feedback
4. Ergebnis wird gecacht (bei unveränderter Eingabe kein erneuter Aufruf)
5. Bei Eingabeänderung wird Hinweis "Eingaben geändert — erneute Analyse empfohlen" angezeigt

### 6.2 Analyse-Kontext pro Schritt

| Schritt | Prüfgegenstand | Wissensbasis |
|---------|----------------|--------------|
| 2 | Ziele auf SMART, Erfolgskriterien auf Messbarkeit | SMART-Methode, Golden Circle |
| 3 | Scope-Vollständigkeit, In-/Out-Scope-Konsistenz | Magisches Dreieck, MVP |
| 4 | Aufgabenabdeckung (semantisch), Aufwandsrealismus | PSP, Arbeitspakete, Schätzverfahren |
| 5 | Meilenstein-Typen, Zeitabstände, Vollständigkeit | Faustregel, Abhängigkeiten |
| 6 | Kostenkategorien, Risikobudget, Risikovollständigkeit | Risikomanagement, Strategien |
| 7 | Rollenbesetzung, Teamgröße, Stakeholder-Abdeckung | Projektorganisation, Quadranten |

### 6.3 Schritt 8: Gesamtbewertung

Die Übersichtsseite bietet eine **Gesamtbewertung** des Projektauftrags:
- **Risk Score:** Numerischer Wert mit Einordnung
- **Stärken:** Was ist gut gemacht?
- **Empfehlungen:** Was sollte verbessert werden?

---

## 7. Chatbot (PM-Assistent)

### 7.1 Sidebar-Chatbot (Schritte 1–7)

In der aktuellen Implementierung gibt es keinen separaten Chatbot in den Wizard-Schritten. Die KI-Assistenz erfolgt über die Step-Analyse-Buttons und die Knowledge-Base-Anzeige.

### 7.2 Projektberater-Chatbot (Schritt 9)

**Kontext:**
- Aktueller Projektauftrag (strukturiert)
- Analyse-Ergebnisse (alle 4 Domänen)
- Referenzprojekt-Namen
- Masterclass-Wissen (Zusammenfassung)

**Regeln:**
- Sprache: Deutsch
- Stil: Präzise, praxisorientiert
- Bezugnahme auf konkrete Projektdaten
- Maximale Antwortlänge: 300 Wörter (sofern nicht explizit mehr angefordert)

**Features:**
- Streaming-Antworten
- Chat-Historie pro Session
- "Chat leeren"-Button

---

## 8. Knowledge Base (Masterclass-Integration)

### 8.1 Struktur

Die Knowledge Base besteht aus **7 YAML-Dateien** (eine pro Wizard-Schritt 1–7), die aus der RUHR PM Masterclass Projektmanagement 4.0 abgeleitet sind.

**Jede YAML-Datei enthält:**

```
meta:
  step:         Number    — Schrittnummer
  title:        String    — Titel des Schritts
  description:  String    — Beschreibung

kernkonzepte:              — Fachliche Konzepte als verschachtelte Objekte
pruefkriterien:            — Prüfkriterien als Key-Value mit String-Listen
typische_fehler:           — Liste typischer Fehler (String[])
verbesserungsvorschlaege:  — Schwach/Besser/Optimal Beispiele
```

### 8.2 PM-Handbuch

Zusätzliche Kontextdateien:
- `handbuch.txt` (~65KB, ~16k Tokens) — Hauptkontext für PM-Chatbot
- `masterclass_projektmanagement.txt` (~180KB) — Umfangreiches Trainingsmaterial

### 8.3 Verwendung in der Neuimplementierung

**Diese Dateien werden 1:1 ins neue Projekt übernommen:**
- `data/knowledge/step_01_basis_informationen.yaml` bis `step_07_organisation_stakeholder.yaml`
- `data/handbuch.txt`
- `data/masterclass_projektmanagement.txt`

---

## 9. Export-Funktionen

### 9.1 JSON-Export

**Inhalt:** Kompletter Projektauftrag als strukturiertes JSON
**Format:** Pretty-printed, 2-Space Indent, UTF-8, ensure_ascii=false
**Dateiname:** `{projekt_id}.json`

### 9.2 CSV-Export

**Format:** Semikolon-getrennt (deutsche Konvention), UTF-8
**Dateiname:** `{projekt_name}.csv`
**Struktur:** Sektionsweise mit Headers:

| Sektion | Spalten |
|---------|---------|
| Basis-Informationen | Feld, Wert |
| Ziele und Erfolgskriterien | Nr, Kriterium |
| Projektumfang | Kategorie, Beschreibung |
| Hauptaufgaben | Aufgabe, Verantwortlich, Start, Ende, Aufwand (PT) |
| Meilensteine | Nr, Name, Datum |
| Budget | Position, Anbieter, Betrag (EUR) + Gesamtsumme |
| Bedrohungen | Beschreibung, Wahrscheinlichkeit, Auswirkung, Gegenmaßnahme |
| Chancen | Beschreibung, Wahrscheinlichkeit, Auswirkung, Maßnahme |
| Projekt-Organisation | Name, Rolle |
| Stakeholder | Name, Funktion/Interesse |

### 9.3 Word-Export (DOCX)

**Inhalt:** Professionell formatiertes Dokument mit:
- Titelseite (Projektname, Metadaten)
- KPI-Übersichtstabelle (5 Spalten, blauer Header)
- Stammdaten-Tabelle
- Nummerierte Abschnitte (1–10)
- Formatierte Tabellen für alle Sektionen
- Farbcodierte Risiko-Zellen (Rot/Orange/Gelb/Grün)
- Aufzählungszeichen für In-Scope/Out-Scope/Kriterien
- Rechtsbündige Summenzeilen für Aufwand und Budget
- Fußzeile mit Erstellungszeitstempel

### 9.4 Analyse-Export/Import

**Speichern:** ComparisonResult als JSON-Download
**Laden:** JSON-Upload in Schritt 9, Deserialisierung und Anzeige
**Zweck:** Teure Analysen können gespeichert und ohne erneute LLM-Aufrufe geladen werden

---

## 10. Statische Daten (1:1 zu übernehmen)

Die folgenden Dateien enthalten wertvolle Inhalte und werden in die neue Implementierung übernommen:

### 10.1 Historische Projektdaten

**Pfad:** `data/projects/`
**Dateien:** `sample_01.json` bis `sample_12.json` (12 Projekte)
**Format:** Pipeline-Format (see Abschnitt 3.2)
**Verwendung:** Referenzprojekte für historischen Vergleich

### 10.2 Beispiel-Projektaufträge

**Pfad:** `data/projektauftraege/`
**Dateien:**
- `01_digitale_zeiterfassung.json` — Digitale Zeiterfassung
- `02_digitale_zeiterfassung_v2.json` — Überarbeitete Version
- `03_website_relaunch.json` — Website Relaunch
- `04_website_relaunch_v2.json` — Überarbeitete Version
- `05_kernsystem_insurance.json` — Insurance Kernsystem
- `06_gps_rasenmaeher_app.json` — GPS Rasenmäher App
- `07_ppm_prototyp.json` — PPM Prototyp
- `08_projekt_orange.json` — Projekt Orange
- `09_masterclass_videos.json` — Masterclass Videos

**Format:** Projektauftrag-Format (see Abschnitt 3.1)
**Verwendung:** Vorlagen zum Import in Schritt 1

### 10.3 Knowledge Base

**Pfad:** `data/knowledge/`
**Dateien:** 7 YAML-Dateien (see Abschnitt 8)
**Verwendung:** KI-Analyse-Kontext und Wissensbasis-Anzeige

### 10.4 PM-Handbuch und Masterclass-Material

**Pfad:** `data/`
- `handbuch.txt` (~65KB) — PM-Chatbot-Kontext
- `masterclass_projektmanagement.txt` (~180KB) — Trainingsmaterial

### 10.5 Prompt-Templates

**Pfad (im aktuellen Projekt):** `pmassistant/prompts_de.py` (aktive Version)
**Alternative:** `aux/eval/prompts/versions/v003/` (YAML-Format)
**Struktur:** 4 Domains × 4 Phasen = 16 Prompts
**Verwendung:** LLM-Anweisungen für die Analyse-Pipeline

> **Empfehlung:** Die v003-Prompts im YAML-Format als Basis verwenden, da sie einfacher zu pflegen und zu versionieren sind als eingebettete Python-Strings.

---

## 11. Modul 1: Projektidee (Geplant)

> **Status: Geplant — noch nicht umgesetzt**

### 11.1 Fachlicher Zweck

Die Projektidee ist der erste Schritt im PM-Lebenszyklus (Phase "Initialisierung" nach RUHR PM). Hier wird eine Projektidee grob beschrieben und bewertet, bevor der formale Projektauftrag erstellt wird.

### 11.2 Vorgesehene Dateninhalte

```
Projektidee {
  titel:              String     — Arbeitstitel der Idee
  beschreibung:       Text       — Verbale Beschreibung der Idee
  anlass:             Text       — Was hat die Idee ausgelöst?
  erwarteter_nutzen:  Text       — Welchen Nutzen erhoffen wir uns?
  grobe_aufwandsschaetzung: Text — Erste Einschätzung (S/M/L/XL)
  initiator:          String     — Wer hat die Idee eingebracht?
  datum:              Date       — Wann wurde die Idee erfasst?
  status:             Enum       — "Eingereicht" | "In Bewertung" | "Genehmigt" | "Abgelehnt" | "Zurückgestellt"
  bewertung:          Text?      — Ergebnis der Bewertung
}
```

### 11.3 Vorgesehener Prozess

1. Initiator erfasst Projektidee im Kurzformat
2. KI-Assistent gibt erste Einschätzung (Vollständigkeit, Klarheit, Risiken)
3. PMO/Auftraggeber bewertet die Idee
4. Bei Genehmigung: Übernahme in Projektauftrag (Modul 2) mit vorausgefüllten Feldern

### 11.4 Übergang zu Modul 2

Genehmigte Projektideen fließen als Vorausfüllung in den Projektauftrag-Wizard:
- `Projektidee.titel` → `Projektauftrag.name`
- `Projektidee.beschreibung` → `Projektauftrag.goals`
- `Projektidee.initiator` → `Projektauftrag.auftraggeber`

---

## 12. Modul 3: Statusberichte (Geplant)

> **Status: Geplant — noch nicht umgesetzt**

### 12.1 Fachlicher Zweck

Statusberichte dokumentieren den Projektfortschritt auf Basis des genehmigten Projektauftrags (Modul 2). Sie bilden die Phase "Steuerung" nach RUHR PM ab.

### 12.2 Vorgesehene Dateninhalte

```
Statusbericht {
  projektauftrag_ref: String   — Referenz auf den zugrunde liegenden Projektauftrag
  berichtsnummer:     Number   — Laufende Nummer
  berichtsdatum:      Date     — Datum des Berichts
  berichtszeitraum:   String   — z.B. "KW 05–08 2026"

  // Ampelstatus (Kernmetriken)
  status_gesamt:      Enum("GRÜN", "GELB", "ROT")
  status_zeit:        Enum("GRÜN", "GELB", "ROT")
  status_budget:      Enum("GRÜN", "GELB", "ROT")
  status_scope:       Enum("GRÜN", "GELB", "ROT")
  status_qualitaet:   Enum("GRÜN", "GELB", "ROT")

  // Soll-Ist-Vergleich
  meilenstein_status: MeilensteinStatus[]   — Fortschritt pro Meilenstein
  budget_ist:         Number                — Tatsächlich verbrauchtes Budget
  aufwand_ist:        Number                — Tatsächlich geleistete PT

  // Freitext
  zusammenfassung:    Text     — Was wurde im Berichtszeitraum erreicht?
  probleme:           Text     — Aktuelle Probleme und Blocker
  naechste_schritte:  Text     — Geplante Aktivitäten
  entscheidungsbedarf: Text    — Offene Entscheidungen für Auftraggeber/Lenkungskreis
  risiko_update:      Text     — Aktualisierte Risikobewertung

  // Neue Risiken / Änderungen
  neue_risiken:       Risk[]?   — Im Berichtszeitraum erkannte Risiken
  aenderungsantraege: Aenderungsantrag[]?  — Change Requests
}

MeilensteinStatus {
  meilenstein_ref: String    — Referenz auf Meilenstein im Projektauftrag
  plan_datum:      Date      — Geplanter Termin (aus Projektauftrag)
  prognose_datum:  Date?     — Aktuelle Prognose
  status:          Enum("Offen", "In Bearbeitung", "Erreicht", "Gefährdet", "Verschoben")
  kommentar:       String?
}
```

### 12.3 Vorgesehener Prozess

1. Projektleiter erstellt Statusbericht auf Basis des Projektauftrags
2. System zeigt Soll-Ist-Vergleich (Meilensteine, Budget, Aufwand) automatisch
3. KI-Assistent analysiert den Bericht und identifiziert:
   - Abweichungen vom Plan
   - Trendentwicklung über mehrere Berichte
   - Empfehlungen zur Gegensteuerung
4. Auftraggeber erhält Bericht zur Kenntnisnahme
5. Bei ROT-Status: Automatischer Hinweis auf Eskalationsbedarf

### 12.4 KI-Funktionalität

- Automatischer Soll-Ist-Abgleich gegen Projektauftrag
- Trendanalyse über Berichtsserie (Ampel-Verlauf)
- Prognose-Unterstützung für Meilensteine
- Textvorschläge für Zusammenfassung und nächste Schritte

---

## 13. Modul 4: Projektabschluss (Geplant)

> **Status: Geplant — noch nicht umgesetzt**

### 13.1 Fachlicher Zweck

Der Projektabschluss dokumentiert die formale Beendigung des Projekts und die gewonnenen Erkenntnisse (Lessons Learned). Er bildet die Phase "Abschluss" nach RUHR PM ab.

### 13.2 Vorgesehene Dateninhalte

```
Projektabschluss {
  projektauftrag_ref: String   — Referenz auf den Projektauftrag
  abschlussdatum:     Date     — Datum des formalen Abschlusses

  // Ergebnisbewertung
  zielerreichung:     Text     — Wurden die Projektziele erreicht?
  erfolgskriterien_bewertung: ErfolgskriteriumBewertung[]

  // Soll-Ist Endstand
  budget_plan:        Number   — Geplantes Budget (aus Projektauftrag)
  budget_ist:         Number   — Tatsächliches Budget
  aufwand_plan:       Number   — Geplanter Aufwand (PT)
  aufwand_ist:        Number   — Tatsächlicher Aufwand (PT)
  termin_plan:        Date     — Geplantes Ende
  termin_ist:         Date     — Tatsächliches Ende

  // Lessons Learned (SWOT-basiert)
  staerken:           String[] — Was lief besonders gut?
  schwaechen:         String[] — Was lief nicht gut?
  chancen:            String[] — Was hätte man besser nutzen können?
  bedrohungen_eingetreten: String[] — Welche Risiken sind eingetreten?

  // Zusammenfassung
  gesamtbewertung:    Text     — Gesamteinschätzung des Projekterfolgs
  empfehlungen:       Text     — Empfehlungen für zukünftige Projekte
  offene_punkte:      Text     — Was muss nach Projektende noch erledigt werden?

  // Formaler Abschluss
  abnahme_erteilt:    Boolean  — Wurde die Abnahme durch den AG erteilt?
  abnahme_datum:      Date?
  abnahme_kommentar:  Text?
}

ErfolgskriteriumBewertung {
  kriterium:    String   — Text des Erfolgskriteriums (aus Projektauftrag)
  erreicht:     Enum("Ja", "Teilweise", "Nein")
  kommentar:    String?
}
```

### 13.3 Vorgesehener Prozess

1. Projektleiter erstellt Abschlussbericht auf Basis von Projektauftrag + Statusberichten
2. System füllt Soll-Ist-Daten automatisch vor (aus Projektauftrag)
3. KI-Assistent unterstützt bei:
   - Bewertung der Erfolgskriterien
   - Generierung von Lessons Learned Vorschlägen
   - Identifikation wiederkehrender Muster aus Statusberichten
4. Auftraggeber erteilt formale Abnahme

### 13.4 Rückfluss in historische Daten

**Zentraler Mehrwert:** Die Lessons Learned aus dem Projektabschluss fließen zurück in die historische Projektdatenbank und stehen für zukünftige Vergleichsanalysen (Modul 2, Schritt 9) zur Verfügung.

```
Projektabschluss.lessons_learned → HistorischesProjekt.history.lessons_learned
Projektabschluss.gesamtbewertung → HistorischesProjekt.history.summary
Statusberichte                   → HistorischesProjekt.history.logs
```

---

## 14. Portfoliomanagement (Geplant)

> **Status: Geplant — noch nicht umgesetzt**

### 14.1 Fachlicher Zweck

Das Portfoliomanagement bietet eine projektübergreifende Sicht und ermöglicht Priorisierung, Ressourcenplanung und strategische Steuerung aller Projekte.

### 14.2 Vorgesehene Funktionen

**Dashboard:**
- Übersicht aller aktiven Projekte mit Ampelstatus
- Gesamtbudget-Auslastung
- Ressourcen-Heatmap (wer arbeitet an welchen Projekten)
- Meilenstein-Kalender (projektübergreifend)

**Priorisierung:**
- Bewertung von Projektideen nach strategischem Fit
- Kapazitätsabgleich (verfügbare vs. benötigte Ressourcen)
- Abhängigkeiten zwischen Projekten

**Reporting:**
- Aggregierte Statusberichte
- Portfolio-KPIs (Erfolgsquote, Budget-Einhaltung, Termintreue)
- Trendanalysen über das gesamte Portfolio

### 14.3 Datenmodell-Erweiterung

```
Portfolio {
  name:       String
  projekte:   ProjektRef[]    — Referenzen auf Projekte (alle Module)

  ProjektRef {
    projektauftrag_id:  String
    status:             Enum("Idee", "Auftrag", "Laufend", "Abgeschlossen", "Abgebrochen")
    prioritaet:         Enum("Hoch", "Mittel", "Niedrig")
    strategischer_fit:  Number (1-10)?
  }
}
```

---

## 15. Zusammenfassung der Modulstatus

| Modul | Status | Beschreibung |
|-------|--------|-------------|
| **Modul 1: Projektidee** | 🔮 Geplant | Erfassung und Bewertung von Projektideen |
| **Modul 2: Projektauftrag** | ✅ Umgesetzt | 9-Schritt-Wizard mit KI-Analyse und historischem Vergleich |
| **Modul 3: Statusberichte** | 🔮 Geplant | Regelmäßige Fortschrittsdokumentation mit Soll-Ist-Vergleich |
| **Modul 4: Projektabschluss** | 🔮 Geplant | Lessons Learned und formaler Abschluss |
| **Portfoliomanagement** | 🔮 Geplant | Projektübergreifende Sicht und Steuerung |
| **Historischer Vergleich** | ⚠️ Konzept-Review | Funktioniert, aber Kosten/Nutzen und Performance zu prüfen |

---

## 16. LLM-Konfiguration

### 16.1 Aktuelle Konfiguration

Die Anwendung nutzt eine OpenAI-kompatible API:

```
API-Konfiguration {
  base_url:     String    — API-Endpunkt (OpenAI-kompatibel)
  api_key:      String    — API-Schlüssel
  model:        String    — Modellbezeichnung (aktuell: "mistral-3-24b-128k")
  temperature:  Number    — 0 für Pipeline (deterministisch), 0.2 für Chatbot
}

Chatbot-Konfiguration (optional separater Endpunkt) {
  base_url:     String?
  api_key:      String?
  model:        String?
  temperature:  0.2
}

Threading {
  max_workers:  Number    — Maximale parallele LLM-Aufrufe (aktuell: 5)
}
```

### 16.2 Konfigurationspriorität

1. Environment Variables (höchste Priorität)
2. Plattform-Secrets (z.B. Streamlit Secrets)
3. Konfigurationsdatei (config.yaml)

---

## 17. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Projektauftrag (PA)** | Formales Dokument, das ein Projekt definiert und zur Freigabe dient |
| **Projektidee** | Erste, grobe Beschreibung eines möglichen Projekts |
| **Statusbericht** | Regelmäßiger Bericht über Projektfortschritt |
| **Lessons Learned** | Erkenntnisse aus abgeschlossenen Projekten |
| **Portfolio** | Gesamtheit aller Projekte einer Organisation |
| **Blind Spot** | Risiko, das im Projektauftrag fehlt, aber in historischen Projekten aufgetreten ist |
| **Pipeline** | Mehrstufiger Analyse-Prozess (Extract → Compare → Aggregate → Structure) |
| **Domain** | Thematische Analyse-Dimension (People, Risks, Milestones, General) |
| **Masterclass** | RUHR PM Masterclass Projektmanagement 4.0 — die fachliche Grundlage |
| **Faustregel** | Methodische Daumenregel aus der Masterclass (z.B. "max. Meilensteine = Monate") |
| **SMART** | Spezifisch, Messbar, Attraktiv, Realistisch, Terminiert |
| **Magisches Dreieck** | Scope, Zeit, Budget (+ Qualität) müssen balanciert sein |
| **PMO** | Project Management Office — organisationsweite PM-Instanz |
| **PT** | Personentag — Aufwandseinheit |
| **RW** | Risikowert = Wahrscheinlichkeit × Auswirkung |
| **Signal-Rausch-Verhältnis** | Kernprinzip der Risiko-Vergleichsanalyse: nur relevante Treffer melden |

---

**Ende des Dokuments**
