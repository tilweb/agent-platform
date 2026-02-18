/**
 * Provider Service
 * Manages AI provider configuration, model selection, and resolution
 *
 * Model resolution priority:
 * 1. Chat Session override (modelId passed directly)
 * 2. User Preference (from user's YAML file)
 * 3. System Default (from providers.yaml)
 */

import { parse, stringify } from 'yaml';
import { resolve } from 'path';
import type {
  ProvidersConfig,
  ProviderConfig,
  ModelConfig,
  ResolvedModel,
  ActiveSelection,
  CreateProviderRequest,
  UpdateProviderRequest,
  ExtendedModelCapabilities,
  ModelRequirements,
} from '../types/providers';
import { getUserModelPreference, type ModelPurpose } from './userPreferences';

const CONFIG_PATH = resolve(process.cwd(), '../data/config/providers.yaml');

// Default configuration if file doesn't exist
const DEFAULT_CONFIG: ProvidersConfig = {
  providers: [
    {
      id: 'adacor',
      name: 'Adacor AI',
      api_mode: 'openai',
      base_url: 'https://api.adacor.ai/chat/privateai/v1',
      api_key_env: 'ADACOR_AI_API_KEY',
      enabled: true,
      protected: true,  // System provider - cannot be deleted
      models: [
        {
          id: 'mistral-3-24b-128k',
          name: 'Mistral 3 24B (128K)',
          type: 'vllm',
          capabilities: ['chat', 'function_calling', 'vision'],
          context_length: 128000,
          default: true,
          protected: true,  // System model - cannot be deleted
        },
      ],
    },
  ],
  active: {
    chat: { provider_id: 'adacor', model_id: 'mistral-3-24b-128k' },
    vision: { provider_id: 'adacor', model_id: 'mistral-3-24b-128k' },
    tts: { provider_id: null, model_id: null },
    stt: { provider_id: null, model_id: null },
    text_to_image: { provider_id: null, model_id: null },
    image_to_image: { provider_id: null, model_id: null },
  },
};

// In-memory cache
let configCache: ProvidersConfig | null = null;

/**
 * Generate a unique ID for a new provider
 */
function generateProviderId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 32);
}

/**
 * Load providers configuration from YAML file
 */
export async function loadProvidersConfig(): Promise<ProvidersConfig> {
  if (configCache) {
    return configCache;
  }

  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      const content = await file.text();
      configCache = parse(content) as ProvidersConfig;
      return configCache;
    }
  } catch (error) {
    console.error('Error loading providers config:', error);
  }

  // Return default config if file doesn't exist or has errors
  configCache = DEFAULT_CONFIG;
  await saveProvidersConfig(configCache);
  return configCache;
}

/**
 * Save providers configuration to YAML file
 */
export async function saveProvidersConfig(config: ProvidersConfig): Promise<void> {
  try {
    const yamlContent = stringify(config, {
      indent: 2,
      lineWidth: 120,
    });
    await Bun.write(CONFIG_PATH, yamlContent);
    configCache = config;
  } catch (error) {
    console.error('Error saving providers config:', error);
    throw new Error('Failed to save providers configuration');
  }
}

/**
 * Clear the configuration cache (useful for testing or reloading)
 */
export function clearConfigCache(): void {
  configCache = null;
}

// ============== Provider CRUD ==============

/**
 * Get all providers
 */
export async function getProviders(): Promise<ProviderConfig[]> {
  const config = await loadProvidersConfig();
  return config.providers;
}

/**
 * Get a single provider by ID
 */
export async function getProvider(id: string): Promise<ProviderConfig | null> {
  const config = await loadProvidersConfig();
  return config.providers.find((p) => p.id === id) || null;
}

/**
 * Create a new provider
 */
export async function createProvider(
  request: CreateProviderRequest
): Promise<ProviderConfig> {
  const config = await loadProvidersConfig();

  const id = generateProviderId(request.name);

  // Check for duplicate ID
  if (config.providers.some((p) => p.id === id)) {
    throw new Error(`Provider with ID '${id}' already exists`);
  }

  const newProvider: ProviderConfig = {
    id,
    name: request.name,
    api_mode: request.api_mode,
    base_url: request.base_url,
    api_key_env: request.api_key_env ?? null,
    enabled: request.enabled ?? false,
    company_region: request.company_region,
    datacenter_country: request.datacenter_country,
    models: request.models ?? [],
  };

  config.providers.push(newProvider);
  await saveProvidersConfig(config);

  return newProvider;
}

/**
 * Update an existing provider
 */
export async function updateProvider(
  id: string,
  updates: UpdateProviderRequest
): Promise<ProviderConfig> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Provider '${id}' not found`);
  }

  const index = config.providers.indexOf(provider);
  const updatedProvider: ProviderConfig = {
    id: provider.id, // ID cannot be changed
    name: updates.name ?? provider.name,
    api_mode: updates.api_mode ?? provider.api_mode,
    base_url: updates.base_url ?? provider.base_url,
    api_key_env: updates.api_key_env !== undefined ? updates.api_key_env : provider.api_key_env,
    enabled: updates.enabled ?? provider.enabled,
    company_region: updates.company_region !== undefined ? updates.company_region : provider.company_region,
    datacenter_country: updates.datacenter_country !== undefined ? updates.datacenter_country : provider.datacenter_country,
    models: provider.models, // Models are managed separately
  };

  config.providers[index] = updatedProvider;
  await saveProvidersConfig(config);

  return updatedProvider;
}

/**
 * Delete a provider
 */
export async function deleteProvider(id: string): Promise<void> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Provider '${id}' not found`);
  }

  // Prevent deletion of protected providers
  if (provider.protected) {
    throw new Error(`Provider '${provider.name}' ist ein Systemanbieter und kann nicht gelöscht werden`);
  }

  const index = config.providers.indexOf(provider);

  // Clear active selections if they reference this provider
  const purposes: Array<keyof typeof config.active> = ['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'];
  for (const purpose of purposes) {
    if (config.active[purpose].provider_id === id) {
      config.active[purpose] = { provider_id: null, model_id: null };
    }
  }

  config.providers.splice(index, 1);
  await saveProvidersConfig(config);
}

// ============== Model CRUD ==============

/**
 * Add a model to a provider
 */
export async function addModel(
  providerId: string,
  model: ModelConfig
): Promise<ModelConfig> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider '${providerId}' not found`);
  }

  // Check for duplicate model ID
  if (provider.models.some((m) => m.id === model.id)) {
    throw new Error(`Model '${model.id}' already exists in provider '${providerId}'`);
  }

  provider.models.push(model);
  await saveProvidersConfig(config);

  return model;
}

/**
 * Update a model
 */
export async function updateModel(
  providerId: string,
  modelId: string,
  updates: Partial<ModelConfig>
): Promise<ModelConfig> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider '${providerId}' not found`);
  }

  const existingModel = provider.models.find((m) => m.id === modelId);
  if (!existingModel) {
    throw new Error(`Model '${modelId}' not found in provider '${providerId}'`);
  }

  const modelIndex = provider.models.indexOf(existingModel);
  const updatedModel: ModelConfig = {
    id: existingModel.id, // ID cannot be changed
    name: updates.name ?? existingModel.name,
    type: updates.type ?? existingModel.type,
    capabilities: updates.capabilities ?? existingModel.capabilities,
    default: updates.default ?? existingModel.default,
    base_url: updates.base_url ?? existingModel.base_url,
    context_length: updates.context_length ?? existingModel.context_length,
    max_tokens: updates.max_tokens ?? existingModel.max_tokens,
  };

  provider.models[modelIndex] = updatedModel;
  await saveProvidersConfig(config);

  return updatedModel;
}

/**
 * Delete a model
 */
export async function deleteModel(providerId: string, modelId: string): Promise<void> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider '${providerId}' not found`);
  }

  const model = provider.models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model '${modelId}' not found in provider '${providerId}'`);
  }

  // Prevent deletion of protected models
  if (model.protected) {
    throw new Error(`Modell '${model.name}' ist ein Systemmodell und kann nicht gelöscht werden`);
  }

  const modelIndex = provider.models.indexOf(model);

  // Clear active selections if they reference this model
  const purposes: Array<keyof typeof config.active> = ['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'];
  for (const purpose of purposes) {
    if (
      config.active[purpose].provider_id === providerId &&
      config.active[purpose].model_id === modelId
    ) {
      config.active[purpose] = { provider_id: null, model_id: null };
    }
  }

  provider.models.splice(modelIndex, 1);
  await saveProvidersConfig(config);
}

// ============== Active Selection ==============

/**
 * Get current active model selection
 */
export async function getActiveSelection(): Promise<ProvidersConfig['active']> {
  const config = await loadProvidersConfig();
  return config.active;
}

/**
 * Set active model for a specific purpose
 */
export async function setActiveModel(
  purpose: 'chat' | 'vision' | 'tts' | 'stt' | 'text_to_image' | 'image_to_image',
  providerId: string | null,
  modelId: string | null
): Promise<void> {
  const config = await loadProvidersConfig();

  // Validate provider and model if specified
  if (providerId && modelId) {
    const provider = config.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }
    if (!provider.enabled) {
      throw new Error(`Provider '${providerId}' is disabled`);
    }
    const model = provider.models.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model '${modelId}' not found in provider '${providerId}'`);
    }
  }

  config.active[purpose] = {
    provider_id: providerId,
    model_id: modelId,
  };

  await saveProvidersConfig(config);
}

// ============== Model Resolution ==============

/**
 * Resolve the active model for a specific purpose
 *
 * Resolution priority:
 * 1. User Preference (if userId provided and user has a preference)
 * 2. System Default (from providers.yaml)
 *
 * @param purpose - The model purpose (chat, vision, etc.)
 * @param userId - Optional user ID to check for user-specific preferences
 * @returns The resolved model or null if not configured
 */
export async function resolveActiveModel(
  purpose: 'chat' | 'vision' | 'tts' | 'stt' | 'text_to_image' | 'image_to_image',
  userId?: string
): Promise<ResolvedModel | null> {
  const config = await loadProvidersConfig();

  // Priority 1: Check user preference (if userId provided)
  if (userId) {
    const userPreference = await getUserModelPreference(userId, purpose as ModelPurpose);
    if (userPreference?.provider_id && userPreference?.model_id) {
      // Validate the user's preferred model exists and provider is enabled
      const resolved = await resolveModel(userPreference.provider_id, userPreference.model_id);
      if (resolved && resolved.provider.enabled) {
        console.log(`[Provider] Using user preference for ${purpose}: ${userPreference.provider_id}/${userPreference.model_id}`);
        return resolved;
      }
      // User preference is invalid (provider disabled or model deleted), fall through to system default
      console.log(`[Provider] User preference for ${purpose} invalid, falling back to system default`);
    }
  }

  // Priority 2: System default
  const active = config.active[purpose];
  if (!active.provider_id || !active.model_id) {
    return null;
  }

  return resolveModel(active.provider_id, active.model_id);
}

/**
 * Get the system default model selection (ignoring user preferences)
 */
export async function getSystemDefaultModel(
  purpose: 'chat' | 'vision' | 'tts' | 'stt' | 'text_to_image' | 'image_to_image'
): Promise<ResolvedModel | null> {
  const config = await loadProvidersConfig();
  const active = config.active[purpose];

  if (!active.provider_id || !active.model_id) {
    return null;
  }

  return resolveModel(active.provider_id, active.model_id);
}

/**
 * Resolve a specific provider and model combination
 */
export async function resolveModel(
  providerId: string,
  modelId: string
): Promise<ResolvedModel | null> {
  const config = await loadProvidersConfig();

  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    return null;
  }

  const model = provider.models.find((m) => m.id === modelId);
  if (!model) {
    return null;
  }

  // Get API key from environment
  let apiKey: string | null = null;
  if (provider.api_key_env) {
    apiKey = process.env[provider.api_key_env] || null;
  }

  // Determine effective base URL (model can override provider)
  const baseUrl = model.base_url || provider.base_url;

  return {
    provider,
    model,
    base_url: baseUrl,
    api_key: apiKey,
    api_mode: provider.api_mode,
  };
}

/**
 * Get all enabled providers with their models filtered by type
 */
export async function getModelsForType(
  type: 'llm' | 'vllm' | 'tts' | 'stt' | 'image_gen'
): Promise<Array<{ provider: ProviderConfig; model: ModelConfig }>> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      if (model.type === type || (type === 'llm' && model.type === 'vllm')) {
        results.push({ provider, model });
      }
    }
  }

  return results;
}

/**
 * Get models suitable for chat (llm and vllm types)
 */
export async function getChatModels(): Promise<
  Array<{ provider: ProviderConfig; model: ModelConfig }>
> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      if (model.type === 'llm' || model.type === 'vllm') {
        if (model.capabilities.includes('chat')) {
          results.push({ provider, model });
        }
      }
    }
  }

  return results;
}

/**
 * Get models with vision capability
 */
export async function getVisionModels(): Promise<
  Array<{ provider: ProviderConfig; model: ModelConfig }>
> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      if (model.capabilities.includes('vision')) {
        results.push({ provider, model });
      }
    }
  }

  return results;
}

/**
 * Get models with image generation capability
 */
export async function getImageGenModels(): Promise<
  Array<{ provider: ProviderConfig; model: ModelConfig }>
> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      if (model.type === 'image_gen') {
        results.push({ provider, model });
      }
    }
  }

  return results;
}

/**
 * Check if a model supports image-to-image editing
 */
export function supportsImageToImage(model: ModelConfig): boolean {
  return model.capabilities.includes('image_to_image');
}

// ============== Capability-based Model Filtering ==============

/**
 * Get extended capabilities for a model
 * Falls back to deriving from basic capabilities if extended_capabilities not set
 */
export function getExtendedCapabilities(model: ModelConfig): ExtendedModelCapabilities {
  // Use extended_capabilities if available
  if (model.extended_capabilities) {
    return model.extended_capabilities;
  }

  // Derive from basic capabilities
  const caps = model.capabilities || [];
  return {
    tool_use: caps.includes('function_calling'),
    vision: caps.includes('vision'),
    context_window: model.context_length || 4096,
    streaming: true, // Assume all models support streaming
    json_mode: false,
    max_output_tokens: model.max_tokens,
  };
}

/**
 * Check if a model meets the specified requirements
 */
export function modelMeetsRequirements(
  model: ModelConfig,
  requirements: ModelRequirements
): boolean {
  const caps = getExtendedCapabilities(model);

  if (requirements.tool_use && !caps.tool_use) {
    return false;
  }
  if (requirements.vision && !caps.vision) {
    return false;
  }
  if (requirements.min_context_window && caps.context_window < requirements.min_context_window) {
    return false;
  }
  if (requirements.streaming && !caps.streaming) {
    return false;
  }
  if (requirements.json_mode && !caps.json_mode) {
    return false;
  }

  return true;
}

/**
 * Filter models by requirements
 * Returns only models from enabled providers that meet all requirements
 */
export async function filterModelsByRequirements(
  requirements: ModelRequirements
): Promise<Array<{ provider: ProviderConfig; model: ModelConfig }>> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      // Only include chat-capable models (llm/vllm)
      if (model.type !== 'llm' && model.type !== 'vllm') continue;

      if (modelMeetsRequirements(model, requirements)) {
        results.push({ provider, model });
      }
    }
  }

  return results;
}

/**
 * Get all models with a specific capability
 */
export async function getModelsWithCapability(
  capability: keyof ExtendedModelCapabilities,
  value?: boolean | number
): Promise<Array<{ provider: ProviderConfig; model: ModelConfig }>> {
  const config = await loadProvidersConfig();
  const results: Array<{ provider: ProviderConfig; model: ModelConfig }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    for (const model of provider.models) {
      // Only include chat-capable models (llm/vllm)
      if (model.type !== 'llm' && model.type !== 'vllm') continue;

      const caps = getExtendedCapabilities(model);
      const capValue = caps[capability];

      // Boolean capability check
      if (typeof capValue === 'boolean') {
        if (value === undefined || value === capValue) {
          results.push({ provider, model });
        }
      }
      // Numeric capability check (e.g., context_window >= value)
      else if (typeof capValue === 'number' && typeof value === 'number') {
        if (capValue >= value) {
          results.push({ provider, model });
        }
      }
    }
  }

  return results;
}

/**
 * Get models suitable for agents with tools (requires tool_use capability)
 */
export async function getToolCapableModels(): Promise<
  Array<{ provider: ProviderConfig; model: ModelConfig }>
> {
  return filterModelsByRequirements({ tool_use: true });
}

/**
 * Get models suitable for vision agents (requires vision capability)
 */
export async function getVisionCapableModels(): Promise<
  Array<{ provider: ProviderConfig; model: ModelConfig }>
> {
  return filterModelsByRequirements({ vision: true });
}

/**
 * Determine model requirements for an agent based on its configuration
 */
export function getAgentModelRequirements(agentConfig: {
  id: string;
  tools?: string[];
  capabilities?: string[];
}): ModelRequirements {
  const requirements: ModelRequirements = {};

  // Agent has tools -> needs tool_use
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    requirements.tool_use = true;
  }

  // Agent is supervisor -> needs tool_use for delegation
  if (agentConfig.id === 'supervisor') {
    requirements.tool_use = true;
  }

  // Agent needs vision -> check capabilities array
  if (Array.isArray(agentConfig.capabilities) && agentConfig.capabilities.includes('vision')) {
    requirements.vision = true;
  }

  return requirements;
}
