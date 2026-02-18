/**
 * Platform Models Configuration
 *
 * Provider-locked models that are configured at deployment time via ENV.
 * These models cannot be changed by customers (admin or user).
 *
 * Used for:
 * - Apps (Chatbots, Assistants)
 * - Web Search
 * - Embeddings/RAG
 * - Reranking (optional)
 * - System Agents (Vision, Code, Research)
 */

import { resolveModel } from '../services/providers';
import type { ResolvedModel, ExtendedModelCapabilities } from '../types/providers';

/**
 * Platform model purposes
 */
export type PlatformPurpose = 'apps' | 'search' | 'embeddings' | 'rerank';

/**
 * System agent model purposes
 */
export type SystemAgentPurpose = 'vision' | 'code' | 'research' | 'supervisor';

/**
 * Platform model configuration from ENV
 */
export interface PlatformModelConfig {
  providerId: string;
  modelId: string;
}

/**
 * Cached platform models
 */
let platformModelsCache: Map<PlatformPurpose, ResolvedModel | null> | null = null;
let systemAgentModelsCache: Map<SystemAgentPurpose, ResolvedModel | null> | null = null;

/**
 * Load platform model configuration from ENV
 */
function loadPlatformModelConfig(purpose: PlatformPurpose): PlatformModelConfig | null {
  const prefix = `PLATFORM_${purpose.toUpperCase()}`;
  const providerId = process.env[`${prefix}_PROVIDER_ID`];
  const modelId = process.env[`${prefix}_MODEL_ID`];

  if (!providerId || !modelId) {
    return null;
  }

  return { providerId, modelId };
}

/**
 * Load system agent model configuration from ENV
 */
function loadSystemAgentModelConfig(purpose: SystemAgentPurpose): PlatformModelConfig | null {
  const prefix = `SYSTEM_${purpose.toUpperCase()}`;
  const providerId = process.env[`${prefix}_PROVIDER_ID`];
  const modelId = process.env[`${prefix}_MODEL_ID`];

  if (!providerId || !modelId) {
    return null;
  }

  return { providerId, modelId };
}

/**
 * Get the resolved platform model for a specific purpose
 * Returns null if not configured or invalid
 */
export async function getPlatformModel(purpose: PlatformPurpose): Promise<ResolvedModel | null> {
  // Check cache first
  if (platformModelsCache?.has(purpose)) {
    return platformModelsCache.get(purpose) || null;
  }

  // Initialize cache if needed
  if (!platformModelsCache) {
    platformModelsCache = new Map();
  }

  // Load and resolve
  const config = loadPlatformModelConfig(purpose);
  if (!config) {
    console.log(`[PlatformModels] No ENV config for platform purpose: ${purpose}`);
    platformModelsCache.set(purpose, null);
    return null;
  }

  const resolved = await resolveModel(config.providerId, config.modelId);
  if (!resolved) {
    console.warn(`[PlatformModels] Invalid platform model config for ${purpose}: ${config.providerId}/${config.modelId}`);
    platformModelsCache.set(purpose, null);
    return null;
  }

  // Validate provider is enabled
  if (!resolved.provider.enabled) {
    console.warn(`[PlatformModels] Provider for ${purpose} is disabled: ${config.providerId}`);
    platformModelsCache.set(purpose, null);
    return null;
  }

  console.log(`[PlatformModels] Resolved ${purpose}: ${resolved.provider.name}/${resolved.model.name}`);
  platformModelsCache.set(purpose, resolved);
  return resolved;
}

/**
 * Get the resolved system agent model for a specific purpose
 * Returns null if not configured or invalid
 */
export async function getSystemAgentModel(purpose: SystemAgentPurpose): Promise<ResolvedModel | null> {
  // Check cache first
  if (systemAgentModelsCache?.has(purpose)) {
    return systemAgentModelsCache.get(purpose) || null;
  }

  // Initialize cache if needed
  if (!systemAgentModelsCache) {
    systemAgentModelsCache = new Map();
  }

  // Load and resolve
  const config = loadSystemAgentModelConfig(purpose);
  if (!config) {
    console.log(`[PlatformModels] No ENV config for system agent: ${purpose}`);
    systemAgentModelsCache.set(purpose, null);
    return null;
  }

  const resolved = await resolveModel(config.providerId, config.modelId);
  if (!resolved) {
    console.warn(`[PlatformModels] Invalid system agent model config for ${purpose}: ${config.providerId}/${config.modelId}`);
    systemAgentModelsCache.set(purpose, null);
    return null;
  }

  // Validate provider is enabled
  if (!resolved.provider.enabled) {
    console.warn(`[PlatformModels] Provider for system agent ${purpose} is disabled: ${config.providerId}`);
    systemAgentModelsCache.set(purpose, null);
    return null;
  }

  // Validate capabilities for specific purposes
  const capabilities = getExtendedCapabilities(resolved);
  if (purpose === 'vision' && !capabilities.vision) {
    console.warn(`[PlatformModels] System vision agent model does not support vision: ${resolved.model.id}`);
  }

  console.log(`[PlatformModels] Resolved system agent ${purpose}: ${resolved.provider.name}/${resolved.model.name}`);
  systemAgentModelsCache.set(purpose, resolved);
  return resolved;
}

/**
 * Get extended capabilities for a resolved model
 * Falls back to deriving from basic capabilities if extended_capabilities not set
 */
export function getExtendedCapabilities(resolved: ResolvedModel): ExtendedModelCapabilities {
  // Use extended_capabilities if available
  if (resolved.model.extended_capabilities) {
    return resolved.model.extended_capabilities;
  }

  // Derive from basic capabilities
  const caps = resolved.model.capabilities || [];
  return {
    tool_use: caps.includes('function_calling'),
    vision: caps.includes('vision'),
    context_window: resolved.model.context_length || 4096,
    streaming: true, // Assume all models support streaming
    json_mode: false,
    max_output_tokens: resolved.model.max_tokens,
  };
}

/**
 * Check if a model meets the specified requirements
 */
export function modelMeetsRequirements(
  resolved: ResolvedModel,
  requirements: {
    tool_use?: boolean;
    vision?: boolean;
    min_context_window?: number;
    streaming?: boolean;
  }
): boolean {
  const caps = getExtendedCapabilities(resolved);

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

  return true;
}

/**
 * Clear the platform models cache
 * Should be called when provider configuration changes
 */
export function clearPlatformModelsCache(): void {
  platformModelsCache = null;
  systemAgentModelsCache = null;
}

/**
 * Get all configured platform models (for status/debugging)
 */
export async function getAllPlatformModels(): Promise<{
  platform: Record<PlatformPurpose, ResolvedModel | null>;
  systemAgents: Record<SystemAgentPurpose, ResolvedModel | null>;
}> {
  const platformPurposes: PlatformPurpose[] = ['apps', 'search', 'embeddings', 'rerank'];
  const systemAgentPurposes: SystemAgentPurpose[] = ['vision', 'code', 'research', 'supervisor'];

  const platform: Record<string, ResolvedModel | null> = {};
  const systemAgents: Record<string, ResolvedModel | null> = {};

  for (const purpose of platformPurposes) {
    platform[purpose] = await getPlatformModel(purpose);
  }

  for (const purpose of systemAgentPurposes) {
    systemAgents[purpose] = await getSystemAgentModel(purpose);
  }

  return {
    platform: platform as Record<PlatformPurpose, ResolvedModel | null>,
    systemAgents: systemAgents as Record<SystemAgentPurpose, ResolvedModel | null>,
  };
}

/**
 * Validate all platform models on startup
 */
export async function validatePlatformModels(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check required platform models
  const requiredPlatform: PlatformPurpose[] = ['apps'];
  for (const purpose of requiredPlatform) {
    const config = loadPlatformModelConfig(purpose);
    if (config) {
      const resolved = await getPlatformModel(purpose);
      if (!resolved) {
        errors.push(`Platform model for '${purpose}' is configured but invalid`);
      }
    }
  }

  // Check system agent models if configured
  const systemAgentPurposes: SystemAgentPurpose[] = ['vision', 'code', 'research', 'supervisor'];
  for (const purpose of systemAgentPurposes) {
    const config = loadSystemAgentModelConfig(purpose);
    if (config) {
      const resolved = await getSystemAgentModel(purpose);
      if (!resolved) {
        errors.push(`System agent model for '${purpose}' is configured but invalid`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
