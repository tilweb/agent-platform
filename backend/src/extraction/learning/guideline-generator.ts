import { extractionChat } from '../../services/extraction/runtime';
import { segmentExamples } from '../segmentation/corrections';
import { boundedExampleContexts } from './example-context';
/**
 * Guideline Generator
 *
 * Analyzes training examples with corrections and derives extraction rules
 * using an LLM call. Updates project.guidelines.
 */

import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { extractionModelOverride } from '../model';
import type { ExtractionProject, TrainingExample } from './types';
import { EXTRACTION_SAMPLING } from '../../services/extraction/extract-call';

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
  if (project.segments) examples = Object.keys(project.segments).flatMap(type => segmentExamples(project, type, examples).map(example => ({ ...example, document_text: `Abschnittstyp: ${type}\n${example.document_text}` })));
  // Filter examples with corrections (most informative)
  const correctedExamples = examples.filter(e => e.dataset?.purpose !== 'test' && e.corrections.length > 0);
  const confirmedExamples = examples.filter(e => e.dataset?.purpose !== 'test' && e.confirmed_correct);

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

  for (const [id, def] of Object.entries(project.segments ?? {})) fieldLines.push(`Segment ${id}: ${JSON.stringify(def.fields ?? {})}. Regeln immer mit dem Segmenttyp kennzeichnen.`);

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

  const exampleText = boundedExampleContexts([...correctedExamples, ...confirmedExamples], 24000);
  if (!exampleText && examples.some(e => e.dataset?.visual?.length)) return project.guidelines;
  if (!exampleText) throw new Error('Keine belegten Quellausschnitte für die Regelableitung vorhanden. Bitte ein Beispiel mit lesbarem Dokumenttext speichern.');

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: exampleText },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'generate_guidelines',
  };

  // Auf demselben Modell wie die Extraktion — die Regeln beschreiben deren
  // Verhalten und sollen nicht von der Session-Modellwahl abhaengen.
  const response = await extractionChat(messages, undefined, usageContext, {
    userId,
    modelOverride: project.extraction?.model_override
      ? { providerId: project.extraction.model_override.provider_id, modelId: project.extraction.model_override.model_id }
      : extractionModelOverride(),
    ...EXTRACTION_SAMPLING,
  });

  if (!response.content) {
    throw new Error('LLM hat keine Regeln generiert');
  }

  console.log(`[Extraction] Generated guidelines for project ${project.id} (${response.content.length} chars)`);
  return response.content.trim();
}
