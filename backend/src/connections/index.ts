/**
 * Connections Module - Public API
 */

// Types
export type {
  AuthType,
  TokenSet,
  EncryptedTokenSet,
  ConnectionStatus,
  ConnectionStatusType,
  StoredConnection,
  OAuth2Config,
  ConnectionTool,
  ConnectionProvider,
  ProviderInfo,
  OAuthState,
} from './types';

// Crypto utilities
export { encryptTokens, decryptTokens, isEncryptionConfigured, generateEncryptionKey } from './crypto';

// Storage
export {
  saveConnection,
  loadConnection,
  updateConnectionStatus,
  updateConnectionTokens,
  deleteConnection,
  listUserConnections,
  hasConnection,
  saveOAuthState,
  loadOAuthState,
  deleteOAuthState,
  cleanupExpiredOAuthStates,
  getProviderEnabledMap,
  setProviderEnabled,
} from './storage';

// Registry
export { connectionRegistry, ConnectionRegistry } from './registry';

// Base classes
export { BaseConnectionProvider } from './base/ConnectionProvider';
export { OAuthProvider } from './base/OAuthProvider';
