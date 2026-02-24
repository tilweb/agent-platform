/**
 * Model Capability Resolver
 * Uses LLM + optional web search to determine capabilities for unknown model IDs.
 * Falls back gracefully: if LLM is unavailable or errors occur, returns null
 * so the caller can use pattern-matching instead.
 */

import { llmService } from './llm';
import type { Message } from './llm';
import type { ModelCapability, ModelType } from '../types/providers';

/** Result for a single model */
export interface ResolvedCapability {
  capabilities: ModelCapability[];
  type: ModelType;
}

const VALID_CAPABILITIES: Set<string> = new Set([
  'chat', 'function_calling', 'vision', 'speech',
  'transcription', 'text_to_image', 'embeddings',
]);

const VALID_TYPES: Set<string> = new Set([
  'llm', 'vllm', 'tts', 'stt', 'image_gen',
]);

const RESOLVE_TIMEOUT_MS = 30_000;

/**
 * Ask the LLM to determine capabilities for a list of model IDs.
 * Returns null if the LLM is unavailable or the call fails.
 */
export async function resolveModelCapabilities(
  modelIds: string[],
  apiMode: string,
): Promise<Map<string, ResolvedCapability> | null> {
  if (modelIds.length === 0) return new Map();

  // Check if LLM is available
  const currentModel = llmService.getCurrentModel();
  if (!currentModel) {
    console.log('[CapabilityResolver] No default LLM configured, skipping');
    return null;
  }

  try {
    return await withTimeout(resolveInternal(modelIds, apiMode), RESOLVE_TIMEOUT_MS);
  } catch (err) {
    console.error('[CapabilityResolver] Error resolving capabilities:', err);
    return null;
  }
}

async function resolveInternal(
  modelIds: string[],
  apiMode: string,
): Promise<Map<string, ResolvedCapability> | null> {
  // Step 1: Batch LLM call for all models
  const prompt = buildPrompt(modelIds, apiMode);
  const messages: Message[] = [
    { role: 'system', content: 'Du bist ein KI-Modell-Experte. Antworte ausschließlich in validem JSON.' },
    { role: 'user', content: prompt },
  ];

  const response = await llmService.chat(messages);
  if (!response.content) return null;

  const parsed = parseResponse(response.content, modelIds);
  if (!parsed) return null;

  const { resolved, unknownIds } = parsed;

  // Step 2: Web search for unknown models
  if (unknownIds.length > 0) {
    await enrichWithWebSearch(unknownIds, apiMode, resolved);
  }

  return resolved;
}

function buildPrompt(modelIds: string[], apiMode: string): string {
  const providerLabel =
    apiMode === 'openai' ? 'OpenAI-kompatibel' :
    apiMode === 'ollama' ? 'Ollama' :
    apiMode === 'google_gemini' ? 'Google Gemini' : apiMode;

  return `Bestimme die Capabilities für folgende Modelle vom Provider-Typ "${providerLabel}".

Modelle: ${JSON.stringify(modelIds)}

Erlaubte capabilities: chat, function_calling, vision, speech, transcription, text_to_image, embeddings
Erlaubte types: llm (Text-LLM), vllm (Vision-LLM), tts (Text-to-Speech), stt (Speech-to-Text), image_gen (Bildgenerierung)

Regeln:
- Jedes chat-fähige Modell mit Vision bekommt type "vllm", sonst "llm"
- TTS-Modelle: type "tts", capability ["speech"]
- STT-Modelle: type "stt", capability ["transcription"]
- Bildgenerierung: type "image_gen", capability ["text_to_image"]
- Embedding-Modelle: type "llm", capability ["embeddings"]
- Bei unbekannten Modellen setze "unknown": true

Antworte NUR als JSON-Array:
[
  { "id": "model-id", "type": "llm", "capabilities": ["chat", "function_calling"] },
  { "id": "unbekanntes-model", "unknown": true }
]`;
}

interface ParseResult {
  resolved: Map<string, ResolvedCapability>;
  unknownIds: string[];
}

function parseResponse(content: string, expectedIds: string[]): ParseResult | null {
  try {
    // Extract JSON array from response (may contain markdown fences)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const items = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      type?: string;
      capabilities?: string[];
      unknown?: boolean;
    }>;

    if (!Array.isArray(items)) return null;

    const resolved = new Map<string, ResolvedCapability>();
    const unknownIds: string[] = [];
    const expectedSet = new Set(expectedIds);

    for (const item of items) {
      if (!item.id || !expectedSet.has(item.id)) continue;

      if (item.unknown) {
        unknownIds.push(item.id);
        continue;
      }

      // Validate and filter capabilities
      const capabilities = (item.capabilities || [])
        .filter((c): c is ModelCapability => VALID_CAPABILITIES.has(c));
      const type = VALID_TYPES.has(item.type || '') ? item.type as ModelType : undefined;

      if (capabilities.length > 0 && type) {
        resolved.set(item.id, { capabilities, type });
      }
    }

    return { resolved, unknownIds };
  } catch {
    return null;
  }
}

/**
 * Search the web for unknown models and ask the LLM again with context.
 */
async function enrichWithWebSearch(
  unknownIds: string[],
  apiMode: string,
  resolved: Map<string, ResolvedCapability>,
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const { toolRegistry } = await import('../tools/registry');
    const searchTool = toolRegistry.get('web_search');

    if (!searchTool || !(await searchTool.isAvailable())) {
      console.log('[CapabilityResolver] Web search tool not available, skipping enrichment');
      return;
    }

    // Search for each unknown model (limit concurrency to 3)
    const searchResults = new Map<string, string>();
    const batches = chunk(unknownIds, 3);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (modelId) => {
          const result = await searchTool.execute(
            { query: `${modelId} LLM model capabilities features` },
            { userId: 'system', sessionId: 'capability-resolver' },
          );
          return { modelId, result };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.result && !r.value.result.startsWith('Error')) {
          searchResults.set(r.value.modelId, r.value.result);
        }
      }
    }

    if (searchResults.size === 0) return;

    // Build context from search results
    const contextParts: string[] = [];
    searchResults.forEach((result, modelId) => {
      contextParts.push(`### ${modelId}\n${result.slice(0, 1500)}`);
    });

    const followUpPrompt = `Basierend auf den folgenden Suchergebnissen, bestimme die Capabilities für diese Modelle (Provider-Typ: "${apiMode}").

${contextParts.join('\n\n')}

Erlaubte capabilities: chat, function_calling, vision, speech, transcription, text_to_image, embeddings
Erlaubte types: llm, vllm, tts, stt, image_gen

Antworte NUR als JSON-Array:
[{ "id": "model-id", "type": "llm", "capabilities": ["chat"] }]`;

    const messages: Message[] = [
      { role: 'system', content: 'Du bist ein KI-Modell-Experte. Antworte ausschließlich in validem JSON.' },
      { role: 'user', content: followUpPrompt },
    ];

    const response = await llmService.chat(messages);
    if (!response.content) return;

    const ids = Array.from(searchResults.keys());
    const parsed = parseResponse(response.content, ids);
    if (!parsed) return;

    // Merge results
    parsed.resolved.forEach((cap, id) => {
      resolved.set(id, cap);
    });
  } catch (err) {
    console.error('[CapabilityResolver] Web search enrichment failed:', err);
  }
}

/** Split array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
