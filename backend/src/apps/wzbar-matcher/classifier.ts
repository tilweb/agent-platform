/**
 * LLM Re-Ranking for WZ industry codes via forced function calling.
 */

import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import type { CatalogEntry, MatchResult } from './types';

const SYSTEM_PROMPT = `Du bist ein Experte für die deutsche Wirtschaftszweigklassifikation WZ 2008.
Deine Aufgabe: Aus einer freitextlichen Tätigkeitsbeschreibung (aus dem Handelsregister) wählst du den passendsten 4-stelligen WZ-Schlüssel aus einer vorgegebenen Kandidatenliste aus und benennst bis zu 3 sinnvolle Alternativen.

Regeln:
- Du darfst ausschliesslich Codes verwenden, die in der Kandidatenliste stehen. Keine Codes erfinden.
- Der primäre Code ist der wahrscheinlichste Match.
- Alternativen werden nur angegeben, wenn sie plausibel sind (confidence ≥ 0.2). Bei eindeutigem Match darf alternatives leer sein.
- confidence ist ein Wert zwischen 0 und 1.
- reasoning ist eine 1-2 Sätze kurze, deutsche Begründung, warum der Code passt.
- Achte auf typische Umgangssprache und Schreibfehler in der Tätigkeitsbeschreibung.`;

const SCHEMA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'classify_wz_branche',
    description: 'Wählt den passendsten 4-stelligen WZ-2008-Schlüssel aus einer Kandidatenliste und nennt Alternativen.',
    parameters: {
      type: 'object',
      properties: {
        primary: {
          type: 'object',
          description: 'Der wahrscheinlichste Match.',
          properties: {
            code: { type: 'string', description: '4-stelliger WZ-Schlüssel aus der Kandidatenliste.' },
            confidence: { type: 'number', description: 'Konfidenz zwischen 0 und 1.' },
            reasoning: { type: 'string', description: '1-2 Sätze deutsche Begründung.' },
          },
          required: ['code', 'confidence', 'reasoning'],
        },
        alternatives: {
          type: 'array',
          description: 'Bis zu 3 sinnvolle Alternativen (kann leer sein).',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              confidence: { type: 'number' },
              reasoning: { type: 'string' },
            },
            required: ['code', 'confidence', 'reasoning'],
          },
        },
      },
      required: ['primary', 'alternatives'],
    },
  },
};

function buildUserPrompt(inputText: string, candidates: CatalogEntry[]): string {
  const lines = candidates.map(c => `- ${c.code}: ${c.kurztext}${c.langtext && c.langtext !== c.kurztext ? ` — ${c.langtext}` : ''}`);
  return `Tätigkeitsbeschreibung:
"""
${inputText}
"""

Kandidatenliste (4-stellige WZ-Schlüssel):
${lines.join('\n')}

Wähle den besten Code und 0-3 Alternativen.`;
}

export async function classify(inputText: string, candidates: CatalogEntry[]): Promise<MatchResult> {
  if (candidates.length === 0) {
    throw new Error('Keine Kandidaten für das LLM-Re-Ranking vorhanden.');
  }

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(inputText, candidates) },
  ];

  const response = await llmService.chat(
    messages,
    [SCHEMA],
    { source: 'wzbar-matcher', userId: 'user_default' },
    { toolChoice: { type: 'function', function: { name: 'classify_wz_branche' } } },
  );

  if (response.tool_calls && response.tool_calls.length > 0) {
    const args = response.tool_calls[0]!.function.arguments;
    try {
      return JSON.parse(args) as MatchResult;
    } catch {
      throw new Error(`Ungültiges JSON in Function-Call-Antwort: ${args.substring(0, 200)}`);
    }
  }

  // Fallback: JSON aus Content extrahieren
  if (typeof response.content === 'string') {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as MatchResult;
      } catch {
        /* fall through */
      }
    }
  }

  throw new Error('LLM hat keine strukturierten Daten zurückgegeben.');
}
