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
export { encryptTokens, decryptTokens, encryptData, decryptData, isEncryptionConfigured, generateEncryptionKey } from './crypto';

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
} from './storage';

// Registry
export { connectionRegistry, ConnectionRegistry } from './registry';

// Base classes
export { BaseConnectionProvider } from './base/ConnectionProvider';
export { OAuthProvider } from './base/OAuthProvider';
