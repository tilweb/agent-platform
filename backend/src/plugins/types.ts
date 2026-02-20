/**
 * Plugin System Types
 *
 * Shared type definitions for the plugin system covering
 * connectors, agents, skills, and bundles.
 */

// ── Plugin Manifest ─────────────────────────────────────────────────

export type PluginType = 'connector' | 'agent' | 'skill' | 'bundle';
export type CredentialMode = 'company' | 'user' | 'both';
export type ConnectorTransport = 'inprocess' | 'mcp';

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'url';
  required: boolean;
  secret?: boolean;
  description?: string;
  placeholder?: string;
  options?: string[];
  default?: any;
}

export interface ConnectorManifest {
  authType: 'oauth2' | 'api-key';
  credentialMode?: CredentialMode;
  transport?: ConnectorTransport;
  entryPoint?: string;
  mcpCommand?: string;
  mcpArgs?: string[];
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    additionalAuthParams?: Record<string, string>;
    additionalTokenParams?: Record<string, string>;
  };
}

export interface PluginManifest {
  id: string;
  type: PluginType;
  name: string;
  description: string;
  version: string;
  author?: string;
  icon?: string;
  minPlatformVersion?: string;
  configSchema?: ConfigField[];
  setupGuide?: string;

  // Type-specific sections
  connector?: ConnectorManifest;
  agent?: {
    systemPrompt?: string;
    tools?: string[];
    capabilities?: string[];
    model?: { inherit?: boolean; providerId?: string; modelId?: string };
  };
  skill?: {
    instructions?: string;
    allowed_tools?: string[];
    workflow?: boolean;
  };
  bundle?: {
    contains: Array<{ type: PluginType; path: string }>;
  };
}

// ── Plugin Registry ─────────────────────────────────────────────────

export type PluginSource = 'builtin' | 'installed';

export interface PluginRegistryEntry {
  id: string;
  type: PluginType;
  source: PluginSource;
  enabled: boolean;
  configured: boolean;
  installedAt?: string;
  configuredAt?: string;
  configuredBy?: string;
}

// ── Plugin Config Storage ───────────────────────────────────────────

export interface EncryptedConfigField {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

export interface StoredPluginConfig {
  pluginId: string;
  values: Record<string, any>;
  configuredAt: string;
  configuredBy?: string;
}

// ── API Responses ───────────────────────────────────────────────────

export interface PluginInfo {
  id: string;
  type: PluginType;
  name: string;
  description: string;
  version: string;
  author?: string;
  icon?: string;
  source: PluginSource;
  enabled: boolean;
  configured: boolean;
  configSchema?: ConfigField[];
  setupGuide?: string;
  connector?: ConnectorManifest;
  configuredAt?: string;
}
