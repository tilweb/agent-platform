/**
 * Connections Types and Interfaces
 */

import type { Tool } from '../tools/types';

/**
 * Authentication type for a provider
 */
export type AuthType = 'oauth2' | 'api-key';

/**
 * OAuth2 Token Set
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType: string;
  scope?: string;
  // Atlassian-specific
  cloudId?: string;
  // Pipedrive-specific (user's company API domain)
  apiDomain?: string;
}

/**
 * Encrypted token storage format
 */
export interface EncryptedTokenSet {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

/**
 * Connection status
 */
export type ConnectionStatusType = 'connected' | 'disconnected' | 'error' | 'expired';

export interface ConnectionStatus {
  status: ConnectionStatusType;
  lastChecked: string;
  expiresAt?: string;
  error?: string;
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

/**
 * Stored connection data
 */
export interface StoredConnection {
  providerId: string;
  userId: string;
  tokens: EncryptedTokenSet;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  // Optional: for providers that need additional params
  additionalAuthParams?: Record<string, string>;
  additionalTokenParams?: Record<string, string>;
}

/**
 * Tool definition for connection providers
 */
export interface ConnectionTool extends Tool {
  // Connection tools have a special type
  readonly type: 'connection';
  // Reference to the provider
  readonly providerId: string;
}

/**
 * Connection Provider Interface
 */
export interface ConnectionProvider {
  /** Unique provider identifier (e.g., 'confluence') */
  readonly id: string;

  /** Display name (e.g., 'Atlassian Confluence') */
  readonly name: string;

  /** Description of the provider */
  readonly description: string;

  /** Optional icon URL or data URI */
  readonly icon?: string;

  /** Authentication type */
  readonly authType: AuthType;

  /** Setup instructions (markdown) */
  readonly setupGuide?: string;

  // OAuth2 methods (required for oauth2 authType)

  /** Get the OAuth authorization URL */
  getAuthUrl(state: string, redirectUri: string): Promise<string>;

  /** Exchange authorization code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;

  /** Refresh an expired access token */
  refreshToken(refreshToken: string): Promise<TokenSet>;

  // Connection validation

  /** Validate that the connection is still working */
  validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;

  // Tools

  /** Get all tools provided by this connection */
  getTools(): ConnectionTool[];
}

/**
 * Provider registration info for the frontend
 */
export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  authType: AuthType;
  status?: ConnectionStatus;
  setupGuide?: string;
}

/**
 * OAuth state storage
 */
export interface OAuthState {
  providerId: string;
  userId: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
}
