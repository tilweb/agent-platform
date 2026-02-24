/**
 * Multi-Provider LLM System Types
 */

export type ApiMode = 'openai' | 'ollama' | 'google_gemini' | 'openai_images';
export type ModelType = 'llm' | 'vllm' | 'tts' | 'stt' | 'image_gen';
export type ModelCapability = 'chat' | 'function_calling' | 'vision' | 'speech' | 'transcription' | 'text_to_image' | 'image_to_image' | 'embeddings';

/**
 * Extended Model Capabilities for capability-based filtering
 * Used to determine which models are suitable for specific agents/skills
 */
export interface ExtendedModelCapabilities {
  /** Supports function/tool calling - required for agents with tools */
  tool_use: boolean;
  /** Supports vision/image understanding */
  vision: boolean;
  /** Context window size in tokens */
  context_window: number;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports JSON mode/structured output */
  json_mode?: boolean;
  /** Maximum output tokens */
  max_output_tokens?: number;
}

/**
 * Model Requirements for agent/skill capability matching
 */
export interface ModelRequirements {
  /** Requires tool calling support */
  tool_use?: boolean;
  /** Requires vision support */
  vision?: boolean;
  /** Minimum context window size */
  min_context_window?: number;
  /** Requires streaming support */
  streaming?: boolean;
  /** Requires JSON mode support */
  json_mode?: boolean;
}
export type CompanyRegion = 'germany' | 'eu' | 'world';

/**
 * Data Security Tiers for GDPR compliance
 *
 * Tier 1: German provider + German datacenter (highest security)
 * Tier 2: EU provider + EU datacenter
 * Tier 3: Global provider + EU datacenter (EU data residency)
 * Tier 4: Global provider + non-EU datacenter (lowest security)
 */
export type DataSecurityTier = 1 | 2 | 3 | 4;

// EU country codes for datacenter location check
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA countries
  'IS', 'LI', 'NO',
  // Adequate countries (GDPR Art. 45)
  'CH', 'GB'
];

/**
 * Calculate data security tier based on company region and datacenter location
 */
export function calculateSecurityTier(
  companyRegion: CompanyRegion | undefined,
  datacenterCountry: string | undefined
): DataSecurityTier {
  const isGermanCompany = companyRegion === 'germany';
  const isEuCompany = companyRegion === 'eu' || isGermanCompany;
  const isGermanDC = datacenterCountry === 'DE';
  const isEuDC = datacenterCountry ? EU_COUNTRIES.includes(datacenterCountry) : false;

  // Tier 1: German company + German DC
  if (isGermanCompany && isGermanDC) return 1;

  // Tier 2: EU company + EU DC
  if (isEuCompany && isEuDC) return 2;

  // Tier 3: Global company but EU DC (data residency)
  if (!isEuCompany && isEuDC) return 3;

  // Tier 4: Everything else
  return 4;
}

/**
 * Encrypted API key storage format (same shape as EncryptedTokenSet)
 */
export interface EncryptedApiKey {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  capabilities: ModelCapability[];
  default?: boolean;
  protected?: boolean;  // System models cannot be deleted
  enabled?: boolean;    // false = deactivated by sync, only re-enabled by sync
  workplace?: boolean;  // false = listed in provider management but not available for use in workplace (bit 256)
  feature_set?: number; // Bitcode from Adacor API featureSet (1=Chat, 2=Vision, 4=Tools, 32=Embed, 64=Audio, 128=Tokenize, 256=Workplace)
  feature_urls?: Record<string, string>; // Resolved endpoint URLs per adapter suffix (e.g. "/chat/completions" → full URL)
  base_url?: string;  // Override provider base_url
  context_length?: number;
  max_tokens?: number;
  // Image generation specific
  supported_sizes?: string[];      // ["1024x1024", "1792x1024"]
  supported_aspects?: string[];    // ["1:1", "16:9", "9:16"]
  max_images_per_request?: number;
  // Extended capabilities for agent model filtering
  extended_capabilities?: ExtendedModelCapabilities;
}

/**
 * Custom connection test configuration for providers with non-standard APIs.
 * If omitted, the test uses the default adapter for the provider's api_mode.
 */
export interface ProviderTestConfig {
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST';
  /** Path appended to base_url (default: /models) */
  path?: string;
  /** Auth header name (default: Authorization) */
  auth_header?: string;
  /** Auth value prefix (default: "Bearer "). Set to empty string for raw key. */
  auth_prefix?: string;
  /** Extra headers to send (e.g. { "anthropic-version": "2023-06-01" }) */
  headers?: Record<string, string>;
  /** JSON body for POST requests. Supports {{model}} placeholder for default model ID. */
  body?: Record<string, unknown>;
}

export interface ProviderConfig {
  id: string;
  name: string;
  api_mode: ApiMode;
  base_url: string;
  api_key_env: string | null;           // Env-var name (for protected providers + backward compat)
  encrypted_api_key?: EncryptedApiKey;  // Encrypted API key (for custom providers)
  enabled: boolean;
  protected?: boolean;  // System providers cannot be deleted
  company_region?: CompanyRegion;  // Company headquarters region
  datacenter_country?: string;  // ISO country code of datacenter location
  icon_url?: string;  // URL to provider logo (e.g. /logos/openai.svg)
  models: ModelConfig[];
  test?: ProviderTestConfig;  // Custom connection test config
}

export interface ActiveSelection {
  provider_id: string | null;
  model_id: string | null;
}

export interface ProvidersConfig {
  providers: ProviderConfig[];
  active: {
    chat: ActiveSelection;
    vision: ActiveSelection;
    tts: ActiveSelection;
    stt: ActiveSelection;
    text_to_image: ActiveSelection;
    image_to_image: ActiveSelection;
  };
}

export interface ResolvedModel {
  provider: ProviderConfig;
  model: ModelConfig;
  base_url: string;
  api_key: string | null;
  api_mode: ApiMode;
}

// API Request/Response types
export interface CreateProviderRequest {
  name: string;
  api_mode: ApiMode;
  base_url: string;
  api_key_env?: string | null;
  api_key?: string;  // Plaintext key from UI (never persisted, encrypted before storage)
  enabled?: boolean;
  company_region?: CompanyRegion;
  datacenter_country?: string;
  icon_url?: string;
  models?: ModelConfig[];
  test?: ProviderTestConfig;
}

export interface UpdateProviderRequest {
  name?: string;
  api_mode?: ApiMode;
  base_url?: string;
  api_key_env?: string | null;
  api_key?: string | null;  // null=remove, string=update, undefined=no change
  enabled?: boolean;
  company_region?: CompanyRegion;
  datacenter_country?: string;
  icon_url?: string;
  test?: ProviderTestConfig | null;  // null=remove, object=set, undefined=no change
}

export interface SetActiveModelRequest {
  provider_id: string;
  model_id: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  models_found?: number;
}

export interface ModelSyncResult {
  added: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  unchanged: number;
  timestamp: string;
}
