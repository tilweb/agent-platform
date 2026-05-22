/**
 * Vorgangsmappe — LLM-NLU
 *
 * Uebersetzt freitextliche Suchanfragen ("alle Ausgangsrechnungen Mai an Kunde
 * XY") in DocuWare-DialogExpression-Filter-JSON. Pipeline:
 *
 *   1. Fast-Path: Input matched AB-Pattern → direkter REFERENCE-Filter ohne
 *      LLM-Roundtrip.
 *   2. Schema laden: `resolveSearchDialog` → Felder mit allowFiltering=true.
 *   3. Forced Function Call via llmService — Tool-Schema `build_filter`.
 *   4. Validation: passiert spaeter implizit in executeStructuredSearch
 *      (buildConditions wirft bei unbekannten Feldern).
 */

import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import { resolveSearchDialog, type DocuwareFieldDescriptor } from '../../connections/providers/docuware/dialogs';
import type { NluInterpretation } from './types';
import { isReferencePattern, normalizeReferenceNumber } from './reference-utils';

const SYSTEM_PROMPT = `Du bist ein Such-Assistent fuer ein deutsches Dokumenten-Archiv (DocuWare).
Deine Aufgabe: User-Anfragen in strukturierte Filter umwandeln, die direkt
gegen DocuWares DialogExpression-API laufen.

Regeln:
- Nutze ausschliesslich Felder aus der Feldliste (DBFieldName). Erfinde keine.
- Bevorzuge Wildcards (*) fuer Text-Werte ("Rechnung" → "*Rechnung*"), weil die
  Doku-Werte in DocuWare oft praezise gepflegt sein muessen. So matchen
  Variationen wie "Rechnung Ausgang" auch.
- Datums-Werte als ISO YYYY-MM-DD. Fuer Date-Felder zwei Werte als Range
  ["start", "end"] uebergeben.
- Wenn der User keine Werte fuer ein Feld nennt, lass es weg — nicht raten.
- Mehrere Filter werden mit "And" verknuepft (Default).
- "interpretation" ist 1-2 Saetze deutsch — was du verstanden hast.
- Wenn die Anfrage zu unklar ist, gib dennoch deinen besten Versuch zurueck
  und beschreibe in "interpretation" die Unsicherheit.`;

const SCHEMA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'build_filter',
    description: 'Wandelt eine freitextliche Suchanfrage in DocuWare-Filter um.',
    parameters: {
      type: 'object',
      properties: {
        filters: {
          type: 'array',
          description: 'Liste der Feld-Filter. Jeder Filter wirkt auf ein einziges DBFieldName.',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'DBFieldName aus der Feldliste.' },
              values: {
                type: 'array',
                description: 'Werte. 1 Wert = exact match oder Wildcard (mit *). 2 Werte fuer Date/Numeric = Range [start, end]. Mehrere Text-Werte = OR.',
                items: { type: 'string' },
              },
            },
            required: ['field', 'values'],
          },
        },
        operation: {
          type: 'string',
          enum: ['And', 'Or'],
          description: 'Default: And.',
        },
        interpretation: {
          type: 'string',
          description: '1-2 Saetze deutsch — was wurde verstanden.',
        },
      },
      required: ['filters', 'operation', 'interpretation'],
    },
  },
};

function buildFieldsList(fields: DocuwareFieldDescriptor[]): string {
  return fields
    .filter((f) => f.allowFiltering && f.visible)
    .map((f) => {
      const parts = [`- ${f.dbFieldName} (${f.label}, ${f.type}`];
      if (f.length > 0) parts.push(`, max ${f.length}`);
      if (f.hasSelectList) parts.push(', SelectList');
      parts.push(')');
      return parts.join('');
    })
    .join('\n');
}

function buildUserPrompt(query: string, fields: DocuwareFieldDescriptor[], today: string): string {
  return `Heutiges Datum: ${today}

Verfuegbare Felder:
${buildFieldsList(fields)}

User-Anfrage:
"""
${query}
"""

Erzeuge build_filter mit den passenden Filtern.`;
}

interface NluRunInput {
  query: string;
  apiDomain: string | undefined;
  accessToken: string;
  cabinetId: string;
  userId: string;
}

export async function interpretQuery(input: NluRunInput): Promise<NluInterpretation> {
  const trimmed = input.query.trim();
  if (!trimmed) {
    throw new Error('Suchanfrage ist leer.');
  }

  // Fast-Path: AB-Pattern
  if (isReferencePattern(trimmed)) {
    const normalized = normalizeReferenceNumber(trimmed);
    return {
      filters: [{ field: 'REFERENCE', values: [normalized] }],
      operation: 'And',
      interpretation: `AB-Nummer ${normalized} erkannt — direkter Drilldown.`,
      used_llm: false,
    };
  }

  // Schema laden
  const dialog = await resolveSearchDialog(input.apiDomain, input.cabinetId, input.accessToken);
  const today = new Date().toISOString().slice(0, 10);

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(trimmed, dialog.fields, today) },
  ];

  const response = await llmService.chat(
    messages,
    [SCHEMA],
    { source: 'vorgangsmappe-nlu', userId: input.userId },
    { toolChoice: { type: 'function', function: { name: 'build_filter' } } },
  );

  // Erwarteter Output: ein Tool-Call
  if (response.tool_calls && response.tool_calls.length > 0) {
    const args = response.tool_calls[0]!.function.arguments;
    try {
      const parsed = JSON.parse(args);
      const filters = Array.isArray(parsed.filters)
        ? parsed.filters
            .filter((f: any) => f && typeof f.field === 'string' && Array.isArray(f.values))
            .map((f: any) => ({
              field: f.field,
              values: f.values.map((v: any) => String(v)),
            }))
        : [];
      const operation = parsed.operation === 'Or' ? 'Or' : 'And';
      const interpretation = typeof parsed.interpretation === 'string'
        ? parsed.interpretation
        : '';
      return { filters, operation, interpretation, used_llm: true };
    } catch (err) {
      throw new Error(`LLM-Antwort konnte nicht geparst werden: ${args.substring(0, 200)}`);
    }
  }

  // Fallback: JSON aus content extrahieren
  if (typeof response.content === 'string') {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          filters: Array.isArray(parsed.filters) ? parsed.filters : [],
          operation: parsed.operation === 'Or' ? 'Or' : 'And',
          interpretation: typeof parsed.interpretation === 'string' ? parsed.interpretation : '',
          used_llm: true,
        };
      } catch {
        /* fall through */
      }
    }
  }

  throw new Error('LLM hat keine strukturierten Filter zurueckgegeben.');
}
