/**
 * Adacor AI Model Sync Service
 *
 * Synchronizes models from the Adacor AI API (OpenAI-compatible /v1/models endpoint).
 * - New models from API → added with enabled: true
 * - Models no longer in API → set enabled: false (unless protected)
 * - Previously deactivated models reappearing → set enabled: true
 * - owned_by: "Adacor" → ensures provider has company_region: germany, datacenter_country: DE (Tier 1)
 */

import {
  loadProvidersConfig,
  saveProvidersConfig,
  withProviderLock,
} from './providers';
import { llmService } from './llm';
import type { ModelConfig, ModelCapability, ModelType, ModelSyncResult } from '../types/providers';

const ADACOR_PROVIDER_ID = 'adacor';

interface RemoteModel {
  id: string;
  owned_by?: string;
  created?: number;
  object?: string;
  featureSet?: number;
}

interface ModelsResponse {
  data: RemoteModel[];
  object?: string;
}

/**
 * Check if model sync is configured via environment variables
 */
export function isModelSyncConfigured(): boolean {
  // Support both new (BASE+PATH) and legacy (full URL) config
  return !!(process.env.ADACOR_AI_API_BASE && process.env.ADACOR_AI_MODELS_PATH)
    || !!process.env.ADACOR_AI_MODELS_URL;
}

/**
 * Fetch available models from the remote API
 */
async function fetchRemoteModels(): Promise<RemoteModel[]> {
  // Build URL: prefer ADACOR_AI_API_BASE + ADACOR_AI_MODELS_PATH, fall back to legacy ADACOR_AI_MODELS_URL
  const apiBase = process.env.ADACOR_AI_API_BASE;
  const modelsPath = process.env.ADACOR_AI_MODELS_PATH;
  const legacyUrl = process.env.ADACOR_AI_MODELS_URL;

  const url = (apiBase && modelsPath)
    ? `${apiBase.replace(/\/+$/, '')}${modelsPath}`
    : legacyUrl;

  if (!url) {
    throw new Error('ADACOR_AI_MODELS_PATH (or legacy ADACOR_AI_MODELS_URL) is not configured');
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Add API key from provider config (ADACOR_AI_API_KEY)
  const apiKey = process.env.ADACOR_AI_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Add custom headers if configured (format: "Name: Value; Name2: Value2")
  const headersStr = process.env.ADACOR_AI_MODELS_HEADERS;
  if (headersStr) {
    for (const part of headersStr.split(';')) {
      const colonIndex = part.indexOf(':');
      if (colonIndex > 0) {
        const name = part.slice(0, colonIndex).trim();
        const value = part.slice(colonIndex + 1).trim();
        if (name && value) {
          headers[name] = value;
        }
      }
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Models API returned ${response.status}: ${response.statusText}`);
  }

  const body = (await response.json()) as ModelsResponse;
  if (!body.data || !Array.isArray(body.data)) {
    throw new Error('Invalid models API response: missing data array');
  }

  return body.data;
}

/**
 * Derive a human-readable display name from a model ID
 * e.g. "mistral-3-24b" → "Mistral 3 24B"
 */
function deriveModelName(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => {
      // Capitalize size suffixes (e.g. 24b → 24B)
      if (/^\d+[bBkKmM]$/.test(part)) {
        return part.toUpperCase();
      }
      // Capitalize first letter of words
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

/**
 * Parse ADACOR_AI_FEATURE_PATHS env variable into a Map<bitValue, fullPathTemplates[]>
 * Format: "1:/chat/privateai/{model}/v1/chat/completions;1:/completions/privateai/{model}/completions;..."
 * Each bit can have multiple full path templates (semicolon-separated).
 */
function parseFeaturePaths(): Map<number, string[]> {
  const paths = new Map<number, string[]>();
  const raw = process.env.ADACOR_AI_FEATURE_PATHS;
  if (!raw) return paths;

  for (const part of raw.split(';')) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const bit = parseInt(part.slice(0, colonIndex).trim(), 10);
      const pathTemplate = part.slice(colonIndex + 1).trim();
      if (!isNaN(bit) && pathTemplate) {
        const existing = paths.get(bit) || [];
        existing.push(pathTemplate);
        paths.set(bit, existing);
      }
    }
  }
  return paths;
}

/**
 * Derive ModelType from featureSet bitcode
 *
 * Bit 1 = Chat, Bit 2 = Vision, Bit 64 = Audio/Whisper
 * vllm only if both Chat (1) AND Vision (2) are set.
 */
function deriveTypeFromFeatureSet(featureSet: number): ModelType {
  if (featureSet & 64) return 'stt';        // Audio/Whisper → stt
  if ((featureSet & 1) && (featureSet & 2)) return 'vllm'; // Chat + Vision → vllm
  if (featureSet & 1) return 'llm';         // Chat only → llm
  return 'llm';                             // Embeddings or Tokenize only → llm
}

/**
 * Derive capabilities from featureSet bitcode
 *
 * Bit mapping (from API meta.features):
 *   1 = LLM-OpenAPI (Chat)    2 = ImageBase64 (Vision)
 *   4 = Tool Calling           32 = Embedding
 *  64 = Whisper (Audio)       128 = Tokenizer
 * 256 = List in Workplace (meta flag, no capability)
 */
function deriveCapabilitiesFromFeatureSet(featureSet: number): ModelCapability[] {
  const caps: ModelCapability[] = [];
  if (featureSet & 1) {
    caps.push('chat');
  }
  if (featureSet & 2) {
    caps.push('vision');
  }
  if (featureSet & 4) {
    caps.push('function_calling');
  }
  if (featureSet & 32) {
    caps.push('embeddings');
  }
  if (featureSet & 64) {
    caps.push('transcription');
  }
  // bit 128 (Tokenize) has no standard capability — exposed via feature_set field
  // bit 256 (List in Workplace) is a meta flag — not a model capability
  return caps;
}

/**
 * Derive the endpoint key from a full path template.
 * Extracts the portion after {model} as the key.
 * e.g. "/chat/privateai/{model}/v1/chat/completions" → "/v1/chat/completions"
 */
function deriveEndpointKey(pathTemplate: string): string {
  const marker = '{model}';
  const markerIndex = pathTemplate.indexOf(marker);
  if (markerIndex === -1) return pathTemplate;
  return pathTemplate.substring(markerIndex + marker.length) || pathTemplate;
}

/**
 * Compute the model-specific base_url from ADACOR_AI_API_BASE + first feature path.
 * Priority: bit 1 (Chat) > bit 2 (Vision) > bit 64 (Audio) > bit 32 (Embeddings) > bit 128 (Tokenize)
 */
function computeModelBaseUrl(modelId: string, featureSet: number): string | undefined {
  const apiBase = process.env.ADACOR_AI_API_BASE;
  if (!apiBase) return undefined;

  const featurePaths = parseFeaturePaths();
  if (featurePaths.size === 0) return undefined;

  const base = apiBase.replace(/\/+$/, '');

  // Pick primary feature path by priority
  const priorities = [1, 2, 64, 32, 128];
  for (const bit of priorities) {
    if ((featureSet & bit)) {
      const paths = featurePaths.get(bit);
      const primary = paths?.[0];
      if (primary) {
        const resolvedPath = primary.replace('{model}', modelId);
        return `${base}${resolvedPath}`;
      }
    }
  }

  return undefined;
}

/**
 * Compute all resolved endpoint URLs for a model based on its featureSet.
 * Full paths come from ADACOR_AI_FEATURE_PATHS env variable.
 * Returns a record mapping the endpoint suffix (portion after {model}) to its full URL.
 */
function computeFeatureUrls(modelId: string, featureSet: number): Record<string, string> | undefined {
  const apiBase = process.env.ADACOR_AI_API_BASE;
  if (!apiBase) return undefined;

  const featurePaths = parseFeaturePaths();
  if (featurePaths.size === 0) return undefined;

  const base = apiBase.replace(/\/+$/, '');
  const urls: Record<string, string> = {};

  for (const [bit, templates] of featurePaths) {
    if (!(featureSet & bit)) continue;
    for (const template of templates) {
      const key = deriveEndpointKey(template);
      const resolvedPath = template.replace('{model}', modelId);
      urls[key] = `${base}${resolvedPath}`;
    }
  }

  return Object.keys(urls).length > 0 ? urls : undefined;
}

/**
 * Synchronize Adacor models from the remote API
 *
 * Logic:
 * 1. Fetch models from API
 * 2. Under provider lock:
 *    - New models → add with enabled: true
 *    - Existing models still in API → ensure enabled: true (reactivate if needed)
 *    - Existing models NOT in API → set enabled: false (unless protected)
 *    - owned_by: "Adacor" → ensure provider has Tier 1 fields
 * 3. Save config and reload LLM service
 */
export async function syncAdacorModels(): Promise<ModelSyncResult> {
  const remoteModels = await fetchRemoteModels();

  const result: ModelSyncResult = {
    added: 0,
    updated: 0,
    deactivated: 0,
    reactivated: 0,
    unchanged: 0,
    timestamp: new Date().toISOString(),
  };

  await withProviderLock(async () => {
    const config = await loadProvidersConfig();

    const provider = config.providers.find((p) => p.id === ADACOR_PROVIDER_ID);
    if (!provider) {
      throw new Error(`Provider '${ADACOR_PROVIDER_ID}' not found in configuration`);
    }

    // Build set of remote model IDs for fast lookup
    const remoteModelIds = new Set(remoteModels.map((m) => m.id));

    // Check if any remote model is owned_by Adacor → set Tier 1 on provider
    const hasAdacorOwned = remoteModels.some((m) => m.owned_by === 'Adacor');
    if (hasAdacorOwned) {
      if (provider.company_region !== 'germany' || provider.datacenter_country !== 'DE') {
        provider.company_region = 'germany';
        provider.datacenter_country = 'DE';
      }
    }

    // Build map of existing models by ID
    const existingModels = new Map<string, ModelConfig>();
    for (const model of provider.models) {
      existingModels.set(model.id, model);
    }

    // Process remote models: add new or reactivate existing
    for (const remote of remoteModels) {
      const existing = existingModels.get(remote.id);

      if (!existing) {
        // New model from API
        const newModel: ModelConfig = {
          id: remote.id,
          name: deriveModelName(remote.id),
          type: remote.featureSet != null ? deriveTypeFromFeatureSet(remote.featureSet) : 'vllm',
          capabilities: remote.featureSet != null ? deriveCapabilitiesFromFeatureSet(remote.featureSet) : ['chat', 'function_calling'],
          enabled: true,
        };
        if (remote.featureSet != null) {
          newModel.feature_set = remote.featureSet;
          newModel.workplace = !!(remote.featureSet & 256);
          const baseUrl = computeModelBaseUrl(remote.id, remote.featureSet);
          if (baseUrl) newModel.base_url = baseUrl;
          const featureUrls = computeFeatureUrls(remote.id, remote.featureSet);
          if (featureUrls) newModel.feature_urls = featureUrls;
        }
        provider.models.push(newModel);
        result.added++;
      } else if (existing.enabled === false) {
        // Previously deactivated → reactivate
        existing.enabled = true;
        // Update feature fields on reactivation
        if (remote.featureSet != null) {
          existing.feature_set = remote.featureSet;
          existing.workplace = !!(remote.featureSet & 256);
          existing.type = deriveTypeFromFeatureSet(remote.featureSet);
          existing.capabilities = deriveCapabilitiesFromFeatureSet(remote.featureSet);
          const baseUrl = computeModelBaseUrl(remote.id, remote.featureSet);
          if (baseUrl) existing.base_url = baseUrl;
          const featureUrls = computeFeatureUrls(remote.id, remote.featureSet);
          existing.feature_urls = featureUrls;
        }
        result.reactivated++;
      } else {
        // Already exists and is enabled → update feature fields if changed
        if (remote.featureSet != null) {
          const newType = deriveTypeFromFeatureSet(remote.featureSet);
          const newCaps = deriveCapabilitiesFromFeatureSet(remote.featureSet);
          const newBaseUrl = computeModelBaseUrl(remote.id, remote.featureSet);
          const newFeatureUrls = computeFeatureUrls(remote.id, remote.featureSet);
          const newWorkplace = !!(remote.featureSet & 256);
          const capsChanged = JSON.stringify(existing.capabilities) !== JSON.stringify(newCaps);
          const urlsChanged = JSON.stringify(existing.feature_urls) !== JSON.stringify(newFeatureUrls);
          const changed = existing.feature_set !== remote.featureSet
            || existing.type !== newType
            || capsChanged
            || urlsChanged
            || existing.workplace !== newWorkplace
            || (newBaseUrl && existing.base_url !== newBaseUrl);

          if (changed) {
            existing.feature_set = remote.featureSet;
            existing.workplace = newWorkplace;
            existing.type = newType;
            existing.capabilities = newCaps;
            if (newBaseUrl) existing.base_url = newBaseUrl;
            existing.feature_urls = newFeatureUrls;
            result.updated++;
          } else {
            result.unchanged++;
          }
        } else {
          result.unchanged++;
        }
      }
    }

    // Deactivate models no longer in API (unless protected)
    for (const model of provider.models) {
      if (!remoteModelIds.has(model.id) && model.enabled !== false && !model.protected) {
        model.enabled = false;
        result.deactivated++;
      }
    }

    await saveProvidersConfig(config);
  });

  // Reload LLM service to pick up changes
  try {
    await llmService.reload();
  } catch (error) {
    console.error('[ModelSync] Failed to reload LLM service:', error);
  }

  return result;
}
