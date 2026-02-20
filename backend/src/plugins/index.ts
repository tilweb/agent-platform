/**
 * Plugin System — Public API
 */

// Types
export type {
  PluginType,
  PluginManifest,
  ConfigField,
  PluginRegistryEntry,
  PluginSource,
  PluginInfo,
  ConnectorManifest,
  CredentialMode,
  ConnectorTransport,
  StoredPluginConfig,
} from './types';

// Registry
export { pluginRegistry, PluginRegistry } from './registry';

// Config Storage
export {
  savePluginConfig,
  loadPluginConfig,
  loadPluginConfigMasked,
  deletePluginConfig,
  isPluginConfigured,
  resolvePluginConfig,
} from './configStorage';

// OAuth Config Resolver
export { resolveOAuthConfig } from './resolveOAuthConfig';

// Loader
export { loadAllPlugins } from './loader';
