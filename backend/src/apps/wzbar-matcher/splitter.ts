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
 *
 * Query-Expansion (M3, siehe docs/wzbar-matcher-ihk-feedback-massnahmen-*.md):
 * Pro Tätigkeit liefert derselbe LLM-Call zusätzlich 0–2 `searchVariants` in
 * amtlicher Fachsprache ("persönlich haftender Gesellschafter" →
 * "Komplementärgesellschaft"). Die Varianten werden beim Retrieval
 * mit-embedded und per Max-Similarity vereinigt — sie erweitern die
 * Kandidatensuche, ohne das Original zu ersetzen. Ein danebenliegendes
 * Variant kann das Ergebnis daher nie schlechter machen als ohne Expansion.
 */

import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import { appsModelOverride } from './classifier';

const MAX_ACTIVITIES = 3;
const MAX_VARIANTS = 2;

export interface SplitActivity {
  text: string;
  searchVariants: string[];
}

const SYSTEM_PROMPT = `Du zerlegst freitextliche Tätigkeitsbeschreibungen aus dem deutschen Handelsregister/Amtsgericht in distinkte gewerbliche Tätigkeiten.

Regeln:
- Liefere maximal ${MAX_ACTIVITIES} Tätigkeiten zurück.
- **Distinkt** heißt: deutlich unterschiedliche Tätigkeitsfelder, die in der WZ-Klassifikation in unterschiedlichen Bereichen liegen würden (z.B. "Brandschutz" vs. "Trockenbau" vs. "Umzüge").
- **Variationen einer Tätigkeit** werden zusammengefasst (z.B. "Hochbau, Tiefbau, Spezialtiefbau" → eine Tätigkeit "Hoch- und Tiefbau"; "Cloud-Architektur, Deployment, Monitoring" → eine Tätigkeit "Cloud-Engineering").
- Bei einzelner Tätigkeit gibst du sie unverändert als einziges Element zurück.
- Jede Tätigkeit ist ein kurzer, eigenständig klassifizierbarer deutscher Tätigkeitsbegriff (3-80 Zeichen). Keine Aufzählungen mit Komma innerhalb einer Tätigkeit.
- **Produkt + Handels-/Tätigkeitsform ist EINE Tätigkeit**: Formulierungen wie "X, Handelsvermittlung", "X, Großhandel", "X, Einzelhandel", "X, Herstellung", "X, Reparatur" bedeuten "Handelsvermittlung von X" usw. Niemals Produkt und Form in getrennte Tätigkeiten aufsplitten — formuliere sie als eine Tätigkeit aus (z.B. "Gemüsesalate, Handelsvermittlung" → "Handelsvermittlung von Gemüsesalaten").
- Allgemeine Floskeln wie "und alle damit verbundenen Tätigkeiten", "sowie Handel mit allen erlaubten Waren" werden ignoriert (nicht als eigene Tätigkeit zurückgegeben).

Zusätzlich lieferst du pro Tätigkeit 0–${MAX_VARIANTS} **Suchvarianten** (searchVariants):
- Umformulierungen in der amtlichen Fachsprache der WZ-Klassifikation bzw. des statistischen Stichwortverzeichnisses — so wie ein Sachbearbeiter den Begriff im Verzeichnis nachschlagen würde.
- Beispiele: "persönlich haftender Gesellschafter" → ["Komplementärgesellschaft"]; "Autos schicke machen" → ["Fahrzeugaufbereitung", "Lackieren von Kraftwagen"]; "Webseiten bauen" → ["Webdesign", "Erbringung von Dienstleistungen der Informationstechnologie"].
- Kurze Nominalphrasen (3-80 Zeichen). Keine Sätze, keine WZ-Codes, nichts erfinden.
- Suchvarianten behalten die Handels-/Tätigkeitsform des Originals bei (Einzelhandel bleibt Einzelhandel, Herstellung bleibt Herstellung) und bezeichnen dasselbe Produkt — nicht auf ein anderes oder allgemeineres Produkt ausweichen.
- Wenn die Tätigkeit bereits fachsprachlich formuliert ist, lasse searchVariants leer.`;

const SCHEMA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'split_activities',
    description: 'Zerlegt eine Tätigkeitsbeschreibung in 1–3 distinkte gewerbliche Tätigkeiten mit fachsprachlichen Suchvarianten.',
    parameters: {
      type: 'object',
      properties: {
        activities: {
          type: 'array',
          description: `1 bis ${MAX_ACTIVITIES} distinkte Tätigkeiten.`,
          minItems: 1,
          maxItems: MAX_ACTIVITIES,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', minLength: 3, maxLength: 80, description: 'Die Tätigkeit.' },
              searchVariants: {
                type: 'array',
                maxItems: MAX_VARIANTS,
                items: { type: 'string', minLength: 3, maxLength: 80 },
                description: '0-2 Umformulierungen in amtlicher Fachsprache (leer wenn Original schon fachsprachlich).',
              },
            },
            required: ['text', 'searchVariants'],
          },
        },
      },
      required: ['activities'],
    },
  },
};

export async function splitActivities(inputText: string): Promise<SplitActivity[]> {
  const trimmed = inputText.trim();
  if (!trimmed) return [];

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Tätigkeitsbeschreibung:\n"""\n${trimmed}\n"""\n\nLiefere 1–${MAX_ACTIVITIES} distinkte Tätigkeiten mit Suchvarianten.` },
  ];

  let activities: SplitActivity[] = [];
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
        activities = parsed.activities
          .map((a): SplitActivity => {
            // Robust gegen Alt-Format (reine Strings) und fehlende Felder
            if (typeof a === 'string') return { text: a.trim(), searchVariants: [] };
            const obj = a as { text?: unknown; searchVariants?: unknown };
            return {
              text: String(obj.text ?? '').trim(),
              searchVariants: Array.isArray(obj.searchVariants)
                ? obj.searchVariants.map(v => String(v).trim()).filter(Boolean).slice(0, MAX_VARIANTS)
                : [],
            };
          })
          .filter(a => a.text.length > 0);
      }
    }
  } catch (error) {
    console.error('[wzbar-matcher/splitter] LLM-Fehler, Fallback zu Single-Activity:', error);
  }

  if (activities.length === 0) {
    return [{ text: trimmed, searchVariants: [] }];
  }

  // Dedupe (case-insensitive) und Hard-Cap
  const seen = new Set<string>();
  const unique: SplitActivity[] = [];
  for (const a of activities) {
    const key = a.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
    if (unique.length >= MAX_ACTIVITIES) break;
  }
  return unique;
}
