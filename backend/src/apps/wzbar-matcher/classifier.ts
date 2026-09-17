/**
 * LLM Re-Ranking for WZ industry codes via forced function calling.
 */

import { llmService, type Message, type ToolDefinition } from '../../services/llm';
import { getPlatformModel } from '../../config/platformModels';
import type { CatalogEntry, MatchResult } from './types';

// Modell-Override fuer alle Matcher-LLM-Calls: das per ENV gepinnte
// Platform-Apps-Modell (PLATFORM_APPS_*), NICHT der globale Chat-Default.
// Sonst zeigt das Audit-Log das Apps-Modell an, waehrend die Calls tatsaechlich
// ueber active.chat laufen — Anzeige und Realitaet muessen identisch sein.
/**
 * Fail-fast-Budget fuer alle interaktiven Matcher-Calls: 30s-Timeout, max.
 * 1 Retry (Worst Case ~61s statt ~480s mit den Adapter-Defaults 120s x 3
 * Retries). Ein Sachbearbeiter wartet nicht 8 Minuten auf eine Stoerung.
 */
export const MATCHER_LLM_BUDGET = { timeoutMs: 30_000, maxRetries: 1 } as const;

export async function appsModelOverride(): Promise<{ modelOverride: { providerId: string; modelId: string } } | Record<string, never>> {
  try {
    const m = await getPlatformModel('apps');
    if (m) return { modelOverride: { providerId: m.provider.id, modelId: m.model.id } };
  } catch {
    /* ignore — Fallback auf Chat-Default */
  }
  return {};
}

const SYSTEM_PROMPT = `Du bist ein Experte für die deutsche Wirtschaftszweigklassifikation WZ 2025.
Deine Aufgabe: Aus einer freitextlichen Tätigkeitsbeschreibung (aus dem Handelsregister) wählst du den passendsten WZ-Schlüssel aus einer vorgegebenen Kandidatenliste aus und benennst bis zu 3 sinnvolle Alternativen.

Hierarchie der WZ-Codes:
- 4-stellig = Klasse
- 5-stellig = Unterklasse — die amtliche Verschlüsselungsebene
- 6-/7-stellig = nationale Detail-Unterklassen: benannte SPEZIALFÄLLE innerhalb einer Unterklasse, KEINE vollständige Aufteilung. Eine Unterklasse ist auch dann die richtige Wahl, wenn keiner ihrer benannten Spezialfälle zutrifft.

Regeln:
- Du darfst ausschliesslich Codes verwenden, die in der Kandidatenliste stehen. Keine Codes erfinden.
- **Ebenen-Wahl**: Wähle die 5-stellige Unterklasse, deren Beschreibung die Tätigkeit abdeckt. Einen 6-/7-stelligen Spezialfall nur, wenn die Tätigkeitsbeschreibung genau diese Spezialisierung ausdrücklich benennt — nicht, weil er thematisch verwandt klingt. Einen 4-stelligen Code nur, wenn keine passende Unterklasse in der Liste steht.
- **Wirtschaftsform beachten**: Herstellung, Reparatur, Einzelhandel, Großhandel und Handelsvermittlung sind in der WZ getrennte Zweige. Der gewählte Code muss zur Form der Tätigkeit passen — für eine Einzelhandels-Tätigkeit keinen Großhandels- oder Herstellungscode wählen, auch wenn das Produkt stimmt.
- Der primäre Code ist der wahrscheinlichste Match.
- Alternativen werden nur angegeben, wenn sie plausibel sind (confidence ≥ 0.2). Bei eindeutigem Match darf alternatives leer sein.
- Alternativen können auch tiefere oder flachere Ebenen desselben Themengebietes sein.
- confidence ist ein Wert zwischen 0 und 1.
- reasoning ist eine 1-2 Sätze kurze, deutsche Begründung, warum der Code passt — bei tieferen Ebenen kurz erwähnen, warum die feinere Ebene gerechtfertigt ist.
- Achte auf typische Umgangssprache und Schreibfehler in der Tätigkeitsbeschreibung.
- Wenn ein vollständiger Gegenstandstext als Kontext mitgegeben ist, nutze ihn für die Branchen- und Produktabgrenzung (welcher Rohstoff, welche Branche, welche Kundengruppe tatsächlich gemeint ist). Der Kontext ergänzt die Tätigkeitsbeschreibung, ersetzt sie aber nicht.

Beispiele für die Ebenen-Wahl:
- "Abbrucharbeiten" → 43110 (Unterklasse deckt die Tätigkeit ab), NICHT 431101 "Entkernung von Gebäuden" (Spezialfall, den die Beschreibung nicht nennt).
- "Reifendienst" → 953131 (die Beschreibung benennt exakt diesen Spezialfall).`;

const SCHEMA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'classify_wz_branche',
    description: 'Wählt den passendsten 4- bis 7-stelligen WZ-2025-Schlüssel aus einer Kandidatenliste und nennt Alternativen.',
    parameters: {
      type: 'object',
      properties: {
        primary: {
          type: 'object',
          description: 'Der wahrscheinlichste Match.',
          properties: {
            code: { type: 'string', description: '4- bis 7-stelliger WZ-Schlüssel aus der Kandidatenliste.' },
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

function levelLabel(code: string): string {
  if (code.length === 4) return 'Klasse';
  if (code.length === 5) return 'Unterklasse';
  return 'Spezialfall';
}

/**
 * G1 (Langtext-Analyse): Der Classifier bekommt den vollstaendigen
 * Originaltext als Kontext mit — die verdichtete Activity allein verliert
 * sonst genau die Details (Rohstoff, Branche), die bei Beinahe-Gleichstand
 * der Kandidaten entscheiden. Nur relevant, wenn der Originaltext deutlich
 * laenger ist als die Activity selbst.
 */
const CONTEXT_MAX_CHARS = 2000;
const CONTEXT_MIN_EXTRA_CHARS = 40;

function buildUserPrompt(inputText: string, candidates: CatalogEntry[], searchVariants: string[], originalContext?: string): string {
  const lines = candidates.map(c => `- ${c.code} (${levelLabel(c.code)}): ${c.kurztext}${c.langtext && c.langtext !== c.kurztext ? ` — ${c.langtext}` : ''}`);
  // Die fachsprachlichen Umformulierungen aus dem Splitter zaehlen bei der
  // Ebenen-Wahl als Teil der Beschreibung: benennt eine Variante einen
  // Spezialfall woertlich (z.B. "Komplementaergesellschaft"), darf er
  // gewaehlt werden, obwohl der Originaltext ihn nicht nennt.
  const variantBlock = searchVariants.length > 0
    ? `\nFachsprachliche Umformulierungen derselben Tätigkeit (gleichwertig zur Beschreibung):\n${searchVariants.map(v => `- ${v}`).join('\n')}\n`
    : '';
  const contextBlock = originalContext && originalContext.length > inputText.length + CONTEXT_MIN_EXTRA_CHARS
    ? `\nVollständiger Gegenstandstext (Kontext — die Tätigkeit ist ein Teil davon):\n"""\n${originalContext.slice(0, CONTEXT_MAX_CHARS)}\n"""\n`
    : '';
  return `Tätigkeitsbeschreibung:
"""
${inputText}
"""
${contextBlock}${variantBlock}
Kandidatenliste (gemischte Ebenen):
${lines.join('\n')}

Wähle den besten Code (Unterklasse, außer Beschreibung oder Umformulierung benennt ausdrücklich einen Spezialfall) und 0-3 Alternativen.`;
}

export async function classify(inputText: string, candidates: CatalogEntry[], searchVariants: string[] = [], originalContext?: string): Promise<MatchResult> {
  if (candidates.length === 0) {
    throw new Error('Keine Kandidaten für das LLM-Re-Ranking vorhanden.');
  }

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(inputText, candidates, searchVariants, originalContext) },
  ];

  const response = await llmService.chat(
    messages,
    [SCHEMA],
    { source: 'wzbar-matcher', userId: 'user_default' },
    // temperature 0: deterministisches Decoding — bei Beinahe-Gleichstand der
    // Kandidaten soll dieselbe Eingabe nicht mal so, mal so klassifiziert werden.
    { toolChoice: { type: 'function', function: { name: 'classify_wz_branche' } }, temperature: 0, ...MATCHER_LLM_BUDGET, ...(await appsModelOverride()) },
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
