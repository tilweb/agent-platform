/**
 * Pre-Splitter: zerlegt einen freitextlichen Tätigkeitsblock (z.B. aus dem
 * Handelsregister) in 1–3 distinkte gewerbliche Tätigkeiten. Jeder Teil wird
 * danach einzeln durch die WZ-Pipeline klassifiziert.
 *
 * Beispiel: "Baulicher Brandschutz, Trockenbau und Umzüge"
 *   → ["Baulicher Brandschutz", "Trockenbau", "Umzüge"]
 *
 * Eng verwandte Variationen ("Hochbau, Tiefbau") werden zu **einer** Tätigkeit
 * gebündelt. Bei Eindeutigkeit gibt der Splitter den Originaltext unverändert
 * als einziges Element zurück.
 */

import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import { appsModelOverride } from './classifier';

const MAX_ACTIVITIES = 3;

const SYSTEM_PROMPT = `Du zerlegst freitextliche Tätigkeitsbeschreibungen aus dem deutschen Handelsregister/Amtsgericht in distinkte gewerbliche Tätigkeiten.

Regeln:
- Liefere maximal ${MAX_ACTIVITIES} Tätigkeiten zurück.
- **Distinkt** heißt: deutlich unterschiedliche Tätigkeitsfelder, die in der WZ-Klassifikation in unterschiedlichen Bereichen liegen würden (z.B. "Brandschutz" vs. "Trockenbau" vs. "Umzüge").
- **Variationen einer Tätigkeit** werden zusammengefasst (z.B. "Hochbau, Tiefbau, Spezialtiefbau" → eine Tätigkeit "Hoch- und Tiefbau"; "Cloud-Architektur, Deployment, Monitoring" → eine Tätigkeit "Cloud-Engineering").
- Bei einzelner Tätigkeit gibst du sie unverändert als einziges Element zurück.
- Jede Tätigkeit ist ein kurzer, eigenständig klassifizierbarer deutscher Tätigkeitsbegriff (3-80 Zeichen). Keine Aufzählungen mit Komma innerhalb einer Tätigkeit.
- Allgemeine Floskeln wie "und alle damit verbundenen Tätigkeiten", "sowie Handel mit allen erlaubten Waren" werden ignoriert (nicht als eigene Tätigkeit zurückgegeben).`;

const SCHEMA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'split_activities',
    description: 'Zerlegt eine Tätigkeitsbeschreibung in 1–3 distinkte gewerbliche Tätigkeiten.',
    parameters: {
      type: 'object',
      properties: {
        activities: {
          type: 'array',
          description: `1 bis ${MAX_ACTIVITIES} distinkte Tätigkeiten.`,
          minItems: 1,
          maxItems: MAX_ACTIVITIES,
          items: { type: 'string', minLength: 3, maxLength: 80 },
        },
      },
      required: ['activities'],
    },
  },
};

export async function splitActivities(inputText: string): Promise<string[]> {
  const trimmed = inputText.trim();
  if (!trimmed) return [];

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Tätigkeitsbeschreibung:\n"""\n${trimmed}\n"""\n\nLiefere 1–${MAX_ACTIVITIES} distinkte Tätigkeiten.` },
  ];

  let activities: string[] = [];
  try {
    const response = await llmService.chat(
      messages,
      [SCHEMA],
      { source: 'wzbar-matcher', userId: 'user_default' },
      { toolChoice: { type: 'function', function: { name: 'split_activities' } }, ...(await appsModelOverride()) },
    );

    if (response.tool_calls && response.tool_calls.length > 0) {
      const args = response.tool_calls[0]!.function.arguments;
      const parsed = JSON.parse(args) as { activities?: unknown };
      if (Array.isArray(parsed.activities)) {
        activities = parsed.activities.map(a => String(a).trim()).filter(Boolean);
      }
    }
  } catch (error) {
    console.error('[wzbar-matcher/splitter] LLM-Fehler, Fallback zu Single-Activity:', error);
  }

  if (activities.length === 0) {
    return [trimmed];
  }

  // Dedupe (case-insensitive) und Hard-Cap
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const a of activities) {
    const key = a.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
    if (unique.length >= MAX_ACTIVITIES) break;
  }
  return unique;
}
