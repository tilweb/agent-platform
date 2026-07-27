/**
 * Guideline Generator
 *
 * Analyzes training examples with corrections and derives extraction rules
 * using an LLM call. Updates project.guidelines.
 */

import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import type { ExtractionProject, TrainingExample } from './types';

/**
 * Generate extraction guidelines from training examples
 *
 * Triggered when: new correction saved AND total_examples >= 3
 */
export async function generateGuidelines(
  project: ExtractionProject,
  examples: TrainingExample[],
  userId?: string
): Promise<string> {
  // Filter examples with corrections (most informative)
  const correctedExamples = examples.filter(e => e.corrections.length > 0);
  const confirmedExamples = examples.filter(e => e.confirmed_correct);

  // Build field reference
  const fieldLines: string[] = [];
  for (const [fieldId, field] of Object.entries(project.fields)) {
    if (field.type === 'list') {
      const cols = Object.entries(field.item_fields ?? {})
        .map(([iid, itf]) => `${iid} (${itf.label}): Typ=${itf.type}`)
        .join(', ');
      fieldLines.push(`- ${fieldId} (${field.label}): Typ=Liste mit Spalten: ${cols}`);
      continue;
    }
    fieldLines.push(`- ${fieldId} (${field.label}): Typ=${field.type}, ${field.required ? 'Pflicht' : 'Optional'}`);
  }

  const systemPrompt = `Du bist ein Experte fuer Dokumentenanalyse. Analysiere die folgenden Trainingsbeispiele und leite daraus praezise Extraktionsregeln ab.

Projekt: ${project.name}
Beschreibung: ${project.description}

Felder:
${fieldLines.join('\n')}

Deine Aufgabe:
1. Analysiere die Korrekturen — was hat das System falsch gemacht und warum?
2. Leite klare, konkrete Regeln pro Feld ab
3. Erkenne uebergreifende Muster (z.B. "Lieferantenname steht immer im Absender, nicht im Empfaenger")
4. Formuliere die Regeln als kurze, aktionsfaehige Anweisungen
5. Bei Listen-Feldern: pruefe fehlende oder ueberzaehlige Positionen und falsch zugeordnete Spaltenwerte; formuliere Regeln zur Zeilen-Erkennung (z.B. was ist KEINE Position: Zwischensummen, Rabatte, Versandkosten)

Format der Antwort:
- Pro Feld eine Regel (nur wenn noetig)
- Uebergreifende Regeln am Ende
- Keine Einleitung, keine Erklaerung, NUR die Regeln
- Deutsch`;

  const exampleParts: string[] = [];

  for (const example of correctedExamples) {
    exampleParts.push(`\n--- Beispiel (${example.source_filename}) ---`);
    exampleParts.push(`Dokumentauszug: "${example.document_text.substring(0, 800)}"`);
    exampleParts.push(`System-Extraktion: ${JSON.stringify(example.initial_extraction)}`);
    exampleParts.push(`Korrekte Werte: ${JSON.stringify(example.corrected_extraction)}`);
    exampleParts.push('Korrekturen:');
    for (const c of example.corrections) {
      // Listen/Objekte als JSON rendern (statt "[object Object]").
      const fmt = (v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : `"${String(v)}"`);
      exampleParts.push(`  - ${c.field}: ${fmt(c.was)} → ${fmt(c.corrected_to)}`);
    }
  }

  if (confirmedExamples.length > 0) {
    exampleParts.push('\n--- Korrekt extrahierte Beispiele ---');
    for (const example of confirmedExamples.slice(0, 3)) {
      exampleParts.push(`Dokument: "${example.document_text.substring(0, 300)}..."`);
      exampleParts.push(`Extraktion: ${JSON.stringify(example.corrected_extraction)}`);
    }
  }

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: exampleParts.join('\n') },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'generate_guidelines',
  };

  const response = await llmService.chat(messages, undefined, usageContext, { userId });

  if (!response.content) {
    throw new Error('LLM hat keine Regeln generiert');
  }

  console.log(`[Extraction] Generated guidelines for project ${project.id} (${response.content.length} chars)`);
  return response.content.trim();
}
