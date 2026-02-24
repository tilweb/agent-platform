/**
 * Provider Service
 * Manages AI provider configuration, model selection, and resolution
 *
 * Storage: Per-provider directories under data/providers/
 *   providers/<id>/provider.yaml — Provider config (without Base64 logo)
 *   providers/<id>/logo.{png,svg,...} — Logo as real file
 *   providers/active.yaml — Active model selection
 *
 * Model resolution priority:
 * 1. Chat Session override (modelId passed directly)
 * 2. User Preference (from user's YAML file)
 * 3. System Default (from active.yaml)
 */

import { parse, stringify } from 'yaml';
import { join, extname } from 'path';
import { readdir, rm } from 'fs/promises';
import { PROVIDERS_DIR, ACTIVE_SELECTION_FILE, LEGACY_PROVIDERS_CONFIG } from '../utils/paths';
import { encryptData, decryptData, isEncryptionConfigured } from '../connections/crypto';

// Mutex for provider config read-modify-write operations
let providerLock: Promise<void> = Promise.resolve();

/**
 * Execute a function that modifies provider config under an exclusive lock.
 * Clears the cache before loading to ensure fresh data from disk.
 */
export async function withProviderLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = providerLock;
  providerLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    configCache = null; // Force fresh read from disk
    return await fn();
  } finally {
    release!();
  }
}
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

// ============== Path Helpers ==============

function providerDir(id: string): string {
  return join(PROVIDERS_DIR, id);
}

function providerConfigPath(id: string): string {
  return join(PROVIDERS_DIR, id, 'provider.yaml');
}

/** MIME type → file extension mapping for logos */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** Fallback SVGs for providers that used static path references (e.g. /logos/...) */
const FALLBACK_LOGOS: Record<string, string> = {
  'google-gemini-imagen': '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google Gemini</title><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" fill="currentColor"/></svg>',
};

/**
 * Extract a Base64 data URI and save it as a file in the provider directory.
 * Returns the filename (e.g. "logo.png").
 */
async function saveLogoFromDataUri(providerId: string, dataUri: string): Promise<string> {
  const match = dataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');

  const mimeType = match[1]!;
  const base64Data = match[2]!;
  const ext = MIME_TO_EXT[mimeType] || '.png';
  const filename = `logo${ext}`;

  const dir = providerDir(providerId);
  await Bun.write(join(dir, filename), Buffer.from(base64Data, 'base64'));
  return filename;
}

/**
 * Delete all logo files in a provider directory.
 */
async function deleteLogoFile(providerId: string): Promise<void> {
  const dir = providerDir(providerId);
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith('logo.')) {
        await rm(join(dir, entry), { force: true });
      }
    }
  } catch {
    // Directory may not exist
  }
}

/**
 * Find the logo file in a provider directory.
 * Returns the filename or null.
 */
export async function findLogoFile(providerId: string): Promise<string | null> {
  const dir = providerDir(providerId);
  try {
    const entries = await readdir(dir);
    return entries.find(e => e.startsWith('logo.')) ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if custom (non-protected) providers are allowed.
 * When false, only protected providers (Adacor) are visible and usable.
 */
export function isCustomProvidersAllowed(): boolean {
  const value = process.env.ALLOW_CUSTOM_PROVIDERS;
  // Default to true if not set
  if (value === undefined || value === '') return true;
  return value.toLowerCase() !== 'false';
}

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
 * Load providers configuration from per-provider directories.
 * Falls back to legacy single-file format with automatic migration.
 */
export async function loadProvidersConfig(): Promise<ProvidersConfig> {
  if (configCache) {
    return configCache;
  }

  try {
    // New format: per-provider directories
    const activeFile = Bun.file(ACTIVE_SELECTION_FILE);
    if (await activeFile.exists()) {
      const providers: ProviderConfig[] = [];
      const entries = await readdir(PROVIDERS_DIR, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const configFile = Bun.file(join(PROVIDERS_DIR, entry.name, 'provider.yaml'));
        if (await configFile.exists()) {
          const content = await configFile.text();
          const provider = parse(content) as ProviderConfig;
          providers.push(provider);
        }
      }

      const activeContent = await activeFile.text();
      const active = parse(activeContent) as ProvidersConfig['active'];

      configCache = { providers, active };
      return configCache;
    }

    // Legacy format: single providers.yaml
    const legacyFile = Bun.file(LEGACY_PROVIDERS_CONFIG);
    if (await legacyFile.exists()) {
      console.log('[Provider] Legacy providers.yaml found, migrating to per-provider directories...');
      const content = await legacyFile.text();
      const legacyConfig = parse(content) as ProvidersConfig;
      await migrateFromLegacy(legacyConfig);
      configCache = legacyConfig;
      return configCache;
    }
  } catch (error) {
    console.error('Error loading providers config:', error);
  }

  // Return default config if nothing exists
  configCache = DEFAULT_CONFIG;
  await saveProvidersConfig(configCache);
  return configCache;
}

/**
 * Save providers configuration to per-provider directories.
 */
export async function saveProvidersConfig(config: ProvidersConfig): Promise<void> {
  try {
    // Ensure base directory exists
    await Bun.write(join(PROVIDERS_DIR, '.keep'), '');

    // Write each provider to its own directory
    for (const provider of config.providers) {
      const dir = providerDir(provider.id);
      const providerYaml = stringify(provider, { indent: 2, lineWidth: 120 });
      await Bun.write(join(dir, 'provider.yaml'), providerYaml);
    }

    // Write active selection
    const activeYaml = stringify(config.active, { indent: 2, lineWidth: 120 });
    await Bun.write(ACTIVE_SELECTION_FILE, activeYaml);

    configCache = config;
  } catch (error) {
    console.error('Error saving providers config:', error);
    throw new Error('Failed to save providers configuration');
  }
}

/**
 * Save a single provider's config to its directory.
 */
async function saveProvider(provider: ProviderConfig): Promise<void> {
  const providerYaml = stringify(provider, { indent: 2, lineWidth: 120 });
  await Bun.write(providerConfigPath(provider.id), providerYaml);
}

/**
 * Save the active selection separately.
 */
async function saveActiveSelection(active: ProvidersConfig['active']): Promise<void> {
  const activeYaml = stringify(active, { indent: 2, lineWidth: 120 });
  await Bun.write(ACTIVE_SELECTION_FILE, activeYaml);
}

/**
 * Migrate from legacy single-file format to per-provider directories.
 * Extracts Base64 logos into real files and replaces the Adacor logo with the new one.
 */
async function migrateFromLegacy(config: ProvidersConfig): Promise<void> {
  // Ensure base directory exists
  await Bun.write(join(PROVIDERS_DIR, '.keep'), '');

  for (const provider of config.providers) {
    const dir = providerDir(provider.id);

    // Extract Base64 logo to file
    if (provider.icon_url?.startsWith('data:')) {
      try {
        const filename = await saveLogoFromDataUri(provider.id, provider.icon_url);
        provider.icon_url = filename;
      } catch (err) {
        console.error(`[Provider] Failed to extract logo for ${provider.id}:`, err);
      }
    } else if (provider.icon_url && !provider.icon_url.startsWith('http')) {
      // Non-data-URI, non-HTTP path (e.g. "/logos/google-gemini.svg") — resolve to embedded SVG
      const fallbackSvg = FALLBACK_LOGOS[provider.id];
      if (fallbackSvg) {
        await Bun.write(join(dir, 'logo.svg'), fallbackSvg);
        provider.icon_url = 'logo.svg';
      } else {
        // Unknown static path — clear it
        console.warn(`[Provider] Unknown icon_url path for ${provider.id}: ${provider.icon_url}, clearing`);
        provider.icon_url = undefined;
      }
    }

    // Write provider config
    const providerYaml = stringify(provider, { indent: 2, lineWidth: 120 });
    await Bun.write(join(dir, 'provider.yaml'), providerYaml);
  }

  // Replace Adacor logo with new logo file
  try {
    const newLogoPath = '/Users/pfend/ADACOR/Logos/global.logo.png';
    const newLogoFile = Bun.file(newLogoPath);
    if (await newLogoFile.exists()) {
      const adacorDir = providerDir('adacor');
      await deleteLogoFile('adacor');
      const logoData = await newLogoFile.arrayBuffer();
      await Bun.write(join(adacorDir, 'logo.png'), logoData);
      // Update the provider config to reference the file
      const adacorProvider = config.providers.find(p => p.id === 'adacor');
      if (adacorProvider) {
        adacorProvider.icon_url = 'logo.png';
        await saveProvider(adacorProvider);
      }
      console.log('[Provider] Adacor logo replaced with new logo');
    }
  } catch (err) {
    console.error('[Provider] Failed to replace Adacor logo:', err);
  }

  // Write active selection
  const activeYaml = stringify(config.active, { indent: 2, lineWidth: 120 });
  await Bun.write(ACTIVE_SELECTION_FILE, activeYaml);

  // Delete legacy file
  try {
    await rm(LEGACY_PROVIDERS_CONFIG, { force: true });
    console.log('[Provider] Legacy providers.yaml deleted');
  } catch {
    // May not exist
  }

  console.log('[Provider] Migration complete');
}

/**
 * Clear the configuration cache (useful for testing or reloading)
 */
export function clearConfigCache(): void {
  configCache = null;
}

// ============== API Key Resolution ==============

/**
 * Resolve the API key for a provider.
 * Priority: 1) encrypted_api_key (custom providers), 2) api_key_env (env var fallback + protected)
 */
export async function resolveApiKey(provider: ProviderConfig): Promise<string | null> {
  // Priority 1: Encrypted key (only for non-protected providers)
  if (!provider.protected && provider.encrypted_api_key && isEncryptionConfigured()) {
    try {
      return await decryptData<string>(provider.encrypted_api_key);
    } catch (err) {
      console.error(`[Provider] Decrypt failed for ${provider.id}:`, err);
    }
  }
  // Priority 2: Environment variable (fallback + protected providers)
  if (provider.api_key_env) {
    return process.env[provider.api_key_env] || null;
  }
  return null;
}

/**
 * Sanitize a provider for API responses (strip encrypted_api_key, add has_api_key flag,
 * transform logo filename to API URL)
 */
export function sanitizeProvider(provider: ProviderConfig) {
  const { encrypted_api_key, ...rest } = provider;
  let icon_url = rest.icon_url;

  // Transform local filename (e.g. "logo.png") to API URL
  if (icon_url && !icon_url.startsWith('data:') && !icon_url.startsWith('http') && !icon_url.startsWith('/')) {
    icon_url = `/api/providers/${provider.id}/logo`;
  }

  return { ...rest, icon_url, has_api_key: !!encrypted_api_key };
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
  return withProviderLock(async () => {
    const config = await loadProvidersConfig();

    const id = generateProviderId(request.name);

    // Check for duplicate ID
    if (config.providers.some((p) => p.id === id)) {
      throw new Error(`Provider with ID '${id}' already exists`);
    }

    let iconUrl = request.icon_url;

    const newProvider: ProviderConfig = {
      id,
      name: request.name,
      api_mode: request.api_mode,
      base_url: request.base_url,
      api_key_env: request.api_key_env ?? null,
      enabled: request.enabled ?? false,
      company_region: request.company_region,
      datacenter_country: request.datacenter_country,
      icon_url: iconUrl,
      models: request.models ?? [],
      test: request.test,
    };

    // Encrypt API key if provided
    if (request.api_key && isEncryptionConfigured()) {
      newProvider.encrypted_api_key = await encryptData(request.api_key);
      newProvider.api_key_env = null;
    }

    // Extract logo from data URI to file
    if (iconUrl?.startsWith('data:')) {
      try {
        // Ensure provider directory exists by writing a placeholder first
        await Bun.write(providerConfigPath(id), '');
        const filename = await saveLogoFromDataUri(id, iconUrl);
        newProvider.icon_url = filename;
      } catch (err) {
        console.error(`[Provider] Failed to save logo for ${id}:`, err);
      }
    }

    config.providers.push(newProvider);
    await saveProvidersConfig(config);

    return newProvider;
  });
}

/**
 * Update an existing provider
 */
export async function updateProvider(
  id: string,
  updates: UpdateProviderRequest
): Promise<ProviderConfig> {
  return withProviderLock(async () => {
    const config = await loadProvidersConfig();

    const provider = config.providers.find((p) => p.id === id);
    if (!provider) {
      throw new Error(`Provider '${id}' not found`);
    }

    const index = config.providers.indexOf(provider);

    // Handle icon_url updates
    let resolvedIconUrl: string | undefined;
    if (updates.icon_url !== undefined) {
      if (!updates.icon_url) {
        // Empty string or null → remove logo
        await deleteLogoFile(id);
        resolvedIconUrl = undefined;
      } else if (updates.icon_url.startsWith('data:')) {
        // New data URI → save as file, delete old
        await deleteLogoFile(id);
        try {
          const filename = await saveLogoFromDataUri(id, updates.icon_url);
          resolvedIconUrl = filename;
        } catch (err) {
          console.error(`[Provider] Failed to save logo for ${id}:`, err);
          resolvedIconUrl = provider.icon_url;
        }
      } else if (updates.icon_url.startsWith('/api/providers/')) {
        // Frontend sent back the API URL → keep existing file reference
        resolvedIconUrl = provider.icon_url;
      } else {
        // External URL or other value → pass through
        resolvedIconUrl = updates.icon_url;
      }
    } else {
      resolvedIconUrl = provider.icon_url;
    }

    const updatedProvider: ProviderConfig = {
      id: provider.id, // ID cannot be changed
      name: updates.name ?? provider.name,
      api_mode: updates.api_mode ?? provider.api_mode,
      base_url: updates.base_url ?? provider.base_url,
      api_key_env: updates.api_key_env !== undefined ? updates.api_key_env : provider.api_key_env,
      enabled: updates.enabled ?? provider.enabled,
      company_region: updates.company_region !== undefined ? updates.company_region : provider.company_region,
      datacenter_country: updates.datacenter_country !== undefined ? updates.datacenter_country : provider.datacenter_country,
      icon_url: resolvedIconUrl,
      models: provider.models, // Models are managed separately
      test: updates.test !== undefined ? (updates.test || undefined) : provider.test,
    };

    // Carry over existing encrypted key
    if (provider.encrypted_api_key) {
      updatedProvider.encrypted_api_key = provider.encrypted_api_key;
    }

    // Encrypt new key or remove existing
    if (updates.api_key !== undefined) {
      if (!updates.api_key) {
        delete updatedProvider.encrypted_api_key;
      } else if (isEncryptionConfigured()) {
        updatedProvider.encrypted_api_key = await encryptData(updates.api_key);
        updatedProvider.api_key_env = null;
      }
    }

    config.providers[index] = updatedProvider;
    await saveProvidersConfig(config);

    return updatedProvider;
  });
}

/**
 * Delete a provider
 */
export async function deleteProvider(id: string): Promise<void> {
  return withProviderLock(async () => {
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

    // Remove the provider directory
    try {
      await rm(providerDir(id), { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });
}

// ============== Model CRUD ==============

/**
 * Add a model to a provider
 */
export async function addModel(
  providerId: string,
  model: ModelConfig
): Promise<ModelConfig> {
  return withProviderLock(async () => {
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
  });
}

/**
 * Update a model
 */
export async function updateModel(
  providerId: string,
  modelId: string,
  updates: Partial<ModelConfig>
): Promise<ModelConfig> {
  return withProviderLock(async () => {
    const config = await loadProvidersConfig();

    const provider = config.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }

    const existingModel = provider.models.find((m) => m.id === modelId);
    if (!existingModel) {
      throw new Error(`Model '${modelId}' not found in provider '${providerId}'`);
    }

    // Block manual re-enabling of sync-deactivated models (only those with feature_set)
    if (existingModel.enabled === false && updates.enabled === true && existingModel.feature_set != null) {
      throw new Error('Sync-deaktivierte Modelle können nur durch API-Synchronisierung reaktiviert werden');
    }

    // Block setting default on listed-only models (workplace: false)
    if (updates.default === true && existingModel.workplace === false) {
      throw new Error('Nur-gelistete Modelle (ohne Workplace-Freigabe) können nicht als Standard gesetzt werden');
    }

    // Block name changes on synced models (have feature_set from API)
    if (updates.name && updates.name !== existingModel.name && existingModel.feature_set != null) {
      throw new Error('Der Name synchronisierter Modelle kann nicht manuell geändert werden');
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

    // Preserve sync-managed fields — enabled can be overridden via updates
    if (updates.enabled !== undefined) updatedModel.enabled = updates.enabled;
    else if (existingModel.enabled !== undefined) updatedModel.enabled = existingModel.enabled;
    if (existingModel.workplace !== undefined) updatedModel.workplace = existingModel.workplace;
    if (existingModel.protected) updatedModel.protected = existingModel.protected;
    if (existingModel.feature_set !== undefined) updatedModel.feature_set = existingModel.feature_set;
    if (existingModel.feature_urls) updatedModel.feature_urls = existingModel.feature_urls;

    // If setting as default, clear default on all other models of this provider
    if (updatedModel.default) {
      for (const model of provider.models) {
        if (model.id !== modelId) {
          model.default = false;
        }
      }
    }

    provider.models[modelIndex] = updatedModel;
    await saveProvidersConfig(config);

    return updatedModel;
  });
}

/**
 * Delete a model
 */
export async function deleteModel(providerId: string, modelId: string): Promise<void> {
  return withProviderLock(async () => {
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
  });
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
  return withProviderLock(async () => {
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
  });
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

  // Resolve API key (encrypted or env var)
  const apiKey = await resolveApiKey(provider);

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
 * Check if a provider should be included in model listings
 * Respects ALLOW_CUSTOM_PROVIDERS setting
 */
function isProviderAvailable(provider: ProviderConfig): boolean {
  if (!provider.enabled) return false;
  if (!isCustomProvidersAllowed() && !provider.protected) return false;
  return true;
}

/**
 * Check if a model is usable in the workplace.
 * Excludes disabled models and models with workplace: false (listed-only).
 */
function isModelUsable(model: ModelConfig): boolean {
  if (model.enabled === false) return false;
  if (model.workplace === false) return false;
  return true;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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

// ============== Standard Endpoint Templates ==============

/**
 * Standard API endpoints per api_mode, mapped by capability.
 * Used to compute feature_urls for non-Adacor providers during sync.
 */
const STANDARD_ENDPOINTS: Record<string, Array<{ label: string; path: string; capability: string }>> = {
  openai: [
    { label: '/v1/chat/completions', path: '/v1/chat/completions', capability: 'chat' },
    { label: '/v1/embeddings', path: '/v1/embeddings', capability: 'embeddings' },
    { label: '/v1/audio/transcriptions', path: '/v1/audio/transcriptions', capability: 'transcription' },
    { label: '/v1/audio/speech', path: '/v1/audio/speech', capability: 'speech' },
    { label: '/v1/images/generations', path: '/v1/images/generations', capability: 'text_to_image' },
  ],
  ollama: [
    { label: '/api/chat', path: '/api/chat', capability: 'chat' },
    { label: '/api/embeddings', path: '/api/embeddings', capability: 'embeddings' },
  ],
  google_gemini: [
    { label: ':generateContent', path: '/models/{model}:generateContent', capability: 'chat' },
    { label: ':embedContent', path: '/models/{model}:embedContent', capability: 'embeddings' },
  ],
};

/**
 * Compute feature_urls for a model based on the provider's api_mode and the model's capabilities.
 * Returns a map of label → full URL, or undefined if no endpoints match.
 */
export function computeStandardFeatureUrls(
  provider: ProviderConfig,
  model: { id: string; capabilities: string[] }
): Record<string, string> | undefined {
  const templates = STANDARD_ENDPOINTS[provider.api_mode];
  if (!templates || !provider.base_url) return undefined;

  const baseUrl = provider.base_url.replace(/\/+$/, '');
  const urls: Record<string, string> = {};

  for (const t of templates) {
    if (model.capabilities.includes(t.capability)) {
      const resolvedPath = t.path.replace('{model}', model.id);
      urls[t.label] = `${baseUrl}${resolvedPath}`;
    }
  }

  return Object.keys(urls).length > 0 ? urls : undefined;
}

/**
 * Derive default capabilities for a model ID based on the provider's api_mode.
 */
export function deriveCapabilitiesForApiMode(apiMode: string, modelId: string): string[] {
  const id = modelId.toLowerCase();

  if (apiMode === 'openai') {
    const caps: string[] = ['chat', 'function_calling'];
    // Vision models
    if (/vision|gpt-4o|gpt-4-turbo/.test(id)) caps.push('vision');
    // TTS models
    if (/tts/.test(id)) return ['speech'];
    // Whisper models
    if (/whisper/.test(id)) return ['transcription'];
    // Embedding models
    if (/embed/.test(id)) return ['embeddings'];
    // DALL-E models
    if (/dall-?e/.test(id)) return ['text_to_image'];
    return caps;
  }

  if (apiMode === 'ollama') {
    const caps: string[] = ['chat'];
    if (/llava|vision|llama3\.2-vision|moondream|bakllava/.test(id)) caps.push('vision');
    return caps;
  }

  if (apiMode === 'google_gemini') {
    const caps: string[] = ['chat', 'vision', 'function_calling'];
    if (/embed/.test(id)) return ['embeddings'];
    return caps;
  }

  return ['chat'];
}

// ============== Feature URL Resolution ==============

/**
 * Resolve the full URL for a specific feature bit of an Adacor model.
 * Uses ADACOR_AI_API_BASE + ADACOR_AI_FEATURE_PATHS to build the URL.
 * ADACOR_AI_FEATURE_PATHS contains complete paths (including endpoint suffix).
 *
 * @param modelId - The model ID (e.g. "whisper-v3-large")
 * @param featureSet - The model's featureSet bitcode
 * @param featureBit - The specific feature bit to resolve (1, 32, 64, 128)
 * @param suffix - Optional suffix filter: only return a path ending with this string
 *                 (e.g. "/transcriptions" to find the transcription endpoint for bit 64)
 * @returns Full URL or null if not configured or feature bit not set
 */
export function resolveFeatureUrl(modelId: string, featureSet: number, featureBit: number, suffix?: string): string | null {
  if (!(featureSet & featureBit)) return null;

  const apiBase = process.env.ADACOR_AI_API_BASE;
  if (!apiBase) return null;

  const raw = process.env.ADACOR_AI_FEATURE_PATHS;
  if (!raw) return null;

  const base = apiBase.replace(/\/+$/, '');

  // Parse feature paths for the requested bit
  for (const part of raw.split(';')) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const bit = parseInt(part.slice(0, colonIndex).trim(), 10);
      if (bit === featureBit) {
        const pathTemplate = part.slice(colonIndex + 1).trim();
        // If suffix filter given, only match paths ending with it
        if (suffix && !pathTemplate.endsWith(suffix)) continue;
        const resolvedPath = pathTemplate.replace('{model}', modelId);
        return `${base}${resolvedPath}`;
      }
    }
  }

  return null;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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
    if (!isProviderAvailable(provider)) continue;

    for (const model of provider.models) {
      if (!isModelUsable(model)) continue;
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
