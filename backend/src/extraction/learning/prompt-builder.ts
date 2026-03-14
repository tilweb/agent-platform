/**
 * Prompt Builder - 4-Layer prompt construction for learning extraction
 *
 * Layers:
 * 1. Base: Expert role + general rules
 * 2. Field definitions: From project.fields
 * 3. Learned guidelines: From project.guidelines (auto-generated)
 * 4. Few-shot examples: Best corrected examples
 */

import type { ToolDefinition } from '../../services/llm';
import type { ExtractionProject, TrainingExample, ProjectField } from './types';

/**
 * Map field types to JSON Schema types
 */
function fieldTypeToJsonSchema(field: ProjectField): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  switch (field.type) {
    case 'text':
      schema.type = 'string';
      break;
    case 'number':
      schema.type = 'number';
      break;
    case 'date':
      schema.type = 'string';
      schema.format = 'date';
      break;
    case 'boolean':
      schema.type = 'boolean';
      break;
    default:
      schema.type = 'string';
  }

  // Build description
  const parts: string[] = [];
  if (field.label) parts.push(field.label);
  if (field.description) parts.push(field.description);
  if (field.type === 'date') parts.push('Format: YYYY-MM-DD');
  if (parts.length > 0) {
    schema.description = parts.join('. ');
  }

  return schema;
}

/**
 * Build flat function schema for forced function calling
 */
export function buildFunctionSchema(project: ExtractionProject): ToolDefinition {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [fieldId, field] of Object.entries(project.fields)) {
    properties[fieldId] = fieldTypeToJsonSchema(field);
    if (field.required) {
      required.push(fieldId);
    }
  }

  const functionName = `extract_${project.id.replace(/[^a-z0-9_]/g, '_')}`;

  return {
    type: 'function',
    function: {
      name: functionName,
      description: `Extrahiere Daten: ${project.description || project.name}`,
      parameters: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    },
  };
}

/**
 * Build tool_choice for forced function calling
 */
export function buildToolChoice(project: ExtractionProject): Record<string, unknown> {
  const functionName = `extract_${project.id.replace(/[^a-z0-9_]/g, '_')}`;
  return {
    type: 'function',
    function: { name: functionName },
  };
}

/**
 * Build the 4-layer system prompt
 */
export function buildSystemPrompt(
  project: ExtractionProject,
  fewShotExamples: TrainingExample[]
): string {
  const parts: string[] = [];

  // Layer 1: Base
  parts.push(
    'Du bist ein Dokumenten-Extraktions-Experte. Deine Aufgabe ist es, strukturierte Daten aus dem gegebenen Dokumenttext zu extrahieren.',
    '',
    'Allgemeine Regeln:',
    '- Datumsangaben immer im Format YYYY-MM-DD',
    '- Fehlende Werte als null setzen, NICHT erfinden',
    '- Zahlen als numerische Werte (nicht als String)',
    '- Text exakt aus dem Dokument uebernehmen',
  );

  // Layer 2: Field definitions
  parts.push('', 'Zu extrahierende Felder:');
  for (const [fieldId, field] of Object.entries(project.fields)) {
    const req = field.required ? '(Pflicht)' : '(Optional)';
    const desc = field.description ? ` — ${field.description}` : '';
    parts.push(`- ${field.label || fieldId} [${field.type}] ${req}${desc}`);
  }

  // Layer 3: Learned guidelines
  if (project.guidelines && project.guidelines.trim()) {
    parts.push(
      '',
      'Gelernte Extraktionsregeln (aus bisherigen Korrekturen):',
      project.guidelines,
    );
  }

  // Layer 4: Few-shot examples
  if (fewShotExamples.length > 0) {
    parts.push('', 'Beispiele aus bisherigen Extraktionen:');

    for (const example of fewShotExamples) {
      const docSnippet = example.document_text.substring(0, 500);
      const correctData = JSON.stringify(example.corrected_extraction, null, 2);

      parts.push('');
      parts.push(`Dokument (Auszug): "${docSnippet}${example.document_text.length > 500 ? '...' : ''}"`);
      parts.push(`Korrekte Extraktion: ${correctData}`);

      if (example.corrections.length > 0) {
        parts.push('Anmerkungen zu Korrekturen:');
        for (const c of example.corrections) {
          parts.push(`  - Feld "${c.field}": "${c.was}" war falsch, korrekt ist "${c.corrected_to}"`);
        }
      }
    }
  }

  return parts.join('\n');
}
