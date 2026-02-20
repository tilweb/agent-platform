/**
 * Plugin SDK — Public API for Plugin Code
 *
 * Plugins import exclusively from '@platform/sdk'.
 * This barrel file re-exports everything a plugin needs.
 */

// Base classes
export { OAuthProvider } from '../connections/base/OAuthProvider';
export { BaseConnectionProvider } from '../connections/base/ConnectionProvider';

// Connection types
export type {
  TokenSet,
  ConnectionStatus,
  ConnectionStatusType,
  ConnectionTool,
  ConnectionProvider,
  OAuth2Config,
  AuthType,
} from '../connections/types';

// Tool types
export type {
  Tool,
  ToolDefinition,
  ToolContext,
  ToolType,
  ToolParameters,
  ToolParameter,
  ToolMetadata,
} from '../tools/types';

// Registries
export { connectionRegistry } from '../connections/registry';
export { pluginRegistry } from './registry';

// Config
export { resolvePluginConfig } from './configStorage';

// OAuth config resolver
export { resolveOAuthConfig } from './resolveOAuthConfig';
