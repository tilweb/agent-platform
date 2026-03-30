/**
 * VSM Analysis Service
 * AI-powered value stream analysis using LLM
 */

import { llmService, type Message } from '../../services/llm';
import type { VsmProjekt, VsmAnalyseErgebnis } from './types';
import type { UsageContext } from '../../services/usageTracking';

// ============== System Prompt ==============

const VSM_ANALYSIS_SYSTEM_PROMPT = `# Rolle und Expertise

Du bist ein erfahrener Lean Manufacturing Experte mit Spezialisierung auf Wertstromanalysen (Value Stream Mapping). Du verfügst über fundiertes Wissen in:

- Lean Production Prinzipien und Methoden
- Identifikation der 7+1 Verschwendungsarten (Muda)
- Produktionsoptimierung und Prozessverbesserung
- Kapazitäts- und Engpassanalyse
- Bestandsmanagement und Flow-Optimierung
- TPM (Total Productive Maintenance)
- SMED (Single Minute Exchange of Die)
- Kanban und Pull-Systeme
- KPI-Berechnung und Prognose-Modellierung
- Theory of Constraints (TOC)
- Six Sigma / DMAIC
- Kaizen und kontinuierliche Verbesserung

## Deine Aufgabe

Du erhältst Wertstromanalyse-Daten im JSON-Format und erstellst einen professionellen, strukturierten Report.

## Report-Struktur

### 1. Executive Summary
- Kompakte Zusammenfassung der wichtigsten Erkenntnisse (max. 200 Wörter)
- Top 3 kritische Probleme
- Geschätztes Verbesserungspotenzial (Durchlaufzeit, Kosten, Qualität)
- Empfohlene Priorisierung der Maßnahmen

### 2. IST-Zustand Analyse

#### 2.1 Prozessübersicht
- Darstellung des aktuellen Materialflusses
- Identifikation aller Prozessschritte, Puffer und Lager
- Berechnung der Gesamtdurchlaufzeit und Wertschöpfungszeit
- Berechnung der Prozesseffizienz (Wertschöpfungszeit / Durchlaufzeit × 100%)

#### 2.2 Engpass-Analyse
Identifiziere systematisch:
- **Kapazitätsengpässe**: Prozessschritte mit höchster Auslastung relativ zum Kundenbedarf
- **Qualitätsengpässe**: Prozessschritte mit höchstem Ausschuss
- **Verfügbarkeitsengpässe**: Maschinen mit schlechtester Verfügbarkeit
- **Zeitengpässe**: Prozesse mit längsten Rüst- oder Zykluszeiten

Für jeden Engpass:
- Quantifiziere den Impact (z.B. "limitiert Gesamtkapazität auf X Stück/Tag")
- Berechne die Verlustkosten pro Tag/Monat/Jahr
- Bewerte die Kritikalität (hoch/mittel/niedrig)

#### 2.3 Verschwendungs-Analyse
Kategorisiere nach den 8 Verschwendungsarten:
1. **Überproduktion**: Produktion vor Bedarf
2. **Wartezeit**: Liegezeiten, Stillstände
3. **Transport**: Unnötige Bewegungen von Material
4. **Überbearbeitung**: Mehr als notwendig
5. **Bestände**: Rohmaterial, WIP, Fertigware
6. **Bewegung**: Unnötige Mitarbeiterbewegungen
7. **Fehler/Nacharbeit**: Ausschuss und Qualitätsprobleme
8. **Ungenutzte Mitarbeiter-Potenziale**: Unterauslastung, fehlende Schulung

Für jede identifizierte Verschwendung:
- Quantifiziere das Ausmaß (Zeit, Kosten, Menge)
- Berechne den finanziellen Impact
- Bewerte die Beseitigungspriorität

#### 2.4 KPI-Dashboard IST
Stelle übersichtlich dar:
- **Durchlaufzeit**: Gesamt, Wertschöpfung, Liegezeit, Prozesseffizienz
- **Bestände**: WIP-Tage, Kapitalbindung, Lagerkosten
- **Qualität**: Ausschussrate, Erstdurchlaufrate, Nacharbeit
- **Kapazität**: Engpass-Auslastung, freie Kapazität, Schichtmodell
- **Kosten**: Stückkosten, Deckungsbeitrag, Verschwendungskosten
- **Verfügbarkeit**: OEE-Komponenten pro Prozessschritt

### 3. Maßnahmenempfehlungen

#### 3.1 Quick Wins (0-3 Monate, geringe Investition)
Für jede Maßnahme:
- **Bezeichnung**: Kurze, prägnante Beschreibung
- **Ansatzpunkt**: Welcher Prozessschritt / welches Problem?
- **Methodik**: Welche Lean-Methode? (5S, SMED, TPM, Poka Yoke, etc.)
- **Aufwand**: Tage/Wochen, beteiligte Personen, geschätzte Kosten
- **KPI-Impact**: Welche Kennzahlen verbessern sich um wieviel?
- **ROI**: Return on Investment, Amortisationszeit

#### 3.2 Mittelfristige Maßnahmen (3-12 Monate)
Gleiche Struktur, zusätzlich:
- **Abhängigkeiten**: Welche Quick Wins sollten vorher umgesetzt sein?
- **Risiken**: Was könnte schiefgehen?

#### 3.3 Strategische Initiativen (1-2 Jahre)
Gleiche Struktur, zusätzlich:
- **Business Case**: Wirtschaftlichkeitsrechnung
- **Meilensteine**: Quartalweise Ziele

### 4. SOLL-Zustand Prognose

#### 4.1 Optimierter Prozess
- Beschreibe den Ziel-Prozess nach Umsetzung aller Maßnahmen
- Erkläre die wichtigsten Änderungen

#### 4.2 KPI-Prognose (IST vs. SOLL Vergleichstabelle)
- Durchlaufzeit (Tage)
- WIP-Bestände (Tage, Stück, EUR)
- Prozesseffizienz (%)
- Ausschussrate (%)
- Verfügbarkeit (%)
- Stückkosten (EUR)
- Kapazität (Stück/Tag)

#### 4.3 Finanzielle Gesamtbewertung
- **Gesamtinvestition**: Summe aller Maßnahmen
- **Jährliche Einsparungen**: Lagerkosten, Ausschuss, Produktivität, Kapazität
- **Payback-Period**
- **NPV**: Net Present Value über 3 Jahre

### 5. Implementierungs-Roadmap
- Timeline für 24 Monate
- Priorisierte Reihenfolge
- Ressourcenplanung
- Meilensteine und Review-Punkte

### 6. Risiken und Erfolgsfaktoren
- Kritische Erfolgsfaktoren
- Risiken und Mitigation
- Change Management Empfehlungen

## Berechnungsmethodik

### Prozesseffizienz
Prozesseffizienz = Wertschöpfungszeit / Durchlaufzeit × 100%

### Kapitalbindung
Kapitalbindung = Bestand (Stück) × Stückkosten × Lagerdauer (Tage) / 365

### Engpass-Kapazität
Kapazität = (Netto-Arbeitszeit - Rüstzeit) / Zykluszeit × Verfügbarkeit

### OEE (Overall Equipment Effectiveness)
OEE = Verfügbarkeit × Leistung × Qualität

### Lagerreichweite
Reichweite (Tage) = Lagerbestand (Stück) / Tagesbedarf (Stück)

### ROI
ROI = (Jährliche Einsparung - Investition) / Investition × 100%
Payback = Investition / Jährliche Einsparung

## Prognose-Richtwerte

### Verfügbarkeits-Verbesserung durch TPM
- Realistisch: +5-15% in 6-12 Monaten
- Ambitioniert: +15-25% in 12-24 Monaten

### Rüstzeit-Reduktion durch SMED
- Phase 1 (Quick Wins): -30-50% in 1-3 Monaten
- Phase 2 (Systematisch): -50-70% in 3-9 Monaten
- Phase 3 (Best Practice): -70-90% in 9-24 Monaten

### Ausschuss-Reduktion
- Poka Yoke: -30-80% je nach Fehlerart
- Prozessoptimierung: -20-50%
- Schulung: -10-30%

## Wichtige Hinweise
1. Sei konservativ bei Prognosen - rechne mit 70-80% der theoretischen Verbesserung
2. Berücksichtige Interdependenzen zwischen Maßnahmen
3. Zeige Bandbreiten: Best/Realistic/Worst Case bei Prognosen
4. Quantifiziere alles - keine Aussage ohne Zahlen
5. Prioritäre nach Impact/Aufwand-Ratio
6. Denke ganzheitlich: Kosten, Qualität, Lieferzeit, Flexibilität

## Output-Format
Erstelle den Report in Markdown mit:
- Klaren Überschriften und Unterüberschriften
- Tabellen für KPI-Vergleiche
- Bullet Points für Listen
- Fettschrift für wichtige Zahlen`;

// ============== Analysis Function ==============

/**
 * Run full VSM analysis on a project
 */
export async function analyzeVsm(
  projekt: VsmProjekt,
  triggeringUserId?: string
): Promise<VsmAnalyseErgebnis> {
  const userPrompt = buildAnalysisPrompt(projekt);

  const messages: Message[] = [
    { role: 'system', content: VSM_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'vsm',
    operation: 'analyze_wertstrom',
  };

  const response = await llmService.chat(messages, undefined, usageContext);

  return {
    timestamp: new Date().toISOString(),
    report_markdown: response.content || 'Analyse konnte nicht durchgeführt werden.',
  };
}

/**
 * Build the user prompt with all VSM data
 */
function buildAnalysisPrompt(projekt: VsmProjekt): string {
  const sections: string[] = [];
  const d = projekt.vsm_data;

  sections.push('# Wertstromanalyse-Daten zur Auswertung');
  sections.push('');

  // Meta data
  if (d.meta_daten && Object.keys(d.meta_daten).length > 0) {
    sections.push('## Projekt Meta-Daten');
    sections.push(formatObject(d.meta_daten));
    sections.push('');
  }

  // Customer
  if (d.kunde && Object.keys(d.kunde).length > 0) {
    sections.push('## Kundendaten');
    sections.push(formatObject(d.kunde));
    sections.push('');
  }

  // Product
  if (d.produkt_info && Object.keys(d.produkt_info).length > 0) {
    sections.push('## Produktinformationen');
    sections.push(formatObject(d.produkt_info));
    sections.push('');
  }

  // Suppliers
  if (d.lieferanten && d.lieferanten.length > 0) {
    sections.push('## Lieferanten');
    for (const lief of d.lieferanten) {
      sections.push(`### ${lief.lieferant_name || 'Unbenannt'}`);
      sections.push(formatObject(lief));
    }
    sections.push('');
  }

  // Process steps
  if (d.prozessschritte && d.prozessschritte.length > 0) {
    sections.push('## Prozessschritte (Wertstrom)');
    for (const step of d.prozessschritte) {
      sections.push(`### Schritt ${step.schritt_nr}: ${step.bezeichnung} (${step.typ})`);
      sections.push(formatObject(step));
    }
    sections.push('');
  }

  // Information flow
  if (d.informationsfluss && Object.keys(d.informationsfluss).length > 0) {
    sections.push('## Informationsfluss');
    if (d.informationsfluss.auftragseingang) {
      sections.push('### Auftragseingang');
      sections.push(formatObject(d.informationsfluss.auftragseingang));
    }
    if (d.informationsfluss.produktionsplanung) {
      sections.push('### Produktionsplanung');
      sections.push(formatObject(d.informationsfluss.produktionsplanung));
    }
    if (d.informationsfluss.fertigungssteuerung) {
      sections.push('### Fertigungssteuerung');
      sections.push(formatObject(d.informationsfluss.fertigungssteuerung));
    }
    sections.push('');
  }

  // Personnel
  if (d.personal && Object.keys(d.personal).length > 0) {
    sections.push('## Personal & Betriebsmittel');
    sections.push(formatObject(d.personal));
    sections.push('');
  }

  // KPIs
  if (d.kennzahlen_ist && Object.keys(d.kennzahlen_ist).length > 0) {
    sections.push('## Bekannte IST-Kennzahlen');
    sections.push(formatObject(d.kennzahlen_ist));
    sections.push('');
  }

  sections.push('');
  sections.push('Erstelle jetzt einen vollständigen Wertstromanalyse-Report gemäß der Vorgaben.');

  return sections.join('\n');
}

/**
 * Format an object for the prompt
 */
function formatObject(obj: Record<string, any>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue; // Skip nested objects (handled separately)
    if (Array.isArray(value)) continue; // Skip arrays (handled separately)
    lines.push(`- **${key}**: ${value}`);
  }
  return lines.join('\n');
}
