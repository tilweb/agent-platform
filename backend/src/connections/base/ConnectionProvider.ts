/**
 * Abstract Base Class for Connection Providers
 */

import type {
  ConnectionProvider,
  AuthType,
  TokenSet,
  ConnectionStatus,
  ConnectionTool,
} from '../types';

/**
 * Base class implementing common functionality for connection providers
 */
export abstract class BaseConnectionProvider implements ConnectionProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly icon?: string;
  abstract readonly authType: AuthType;

  /**
   * Get the OAuth authorization URL
   * Override in OAuth providers
   */
  async getAuthUrl(state: string, redirectUri: string): Promise<string> {
    throw new Error(`${this.id} does not support OAuth authentication`);
  }

  /**
   * Exchange authorization code for tokens
   * Override in OAuth providers
   */
  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    throw new Error(`${this.id} does not support OAuth authentication`);
  }

  /**
   * Refresh an expired access token
   * Override in OAuth providers
   */
  async refreshToken(refreshToken: string): Promise<TokenSet> {
    throw new Error(`${this.id} does not support token refresh`);
  }

  /**
   * Validate that the connection is still working
   * Must be implemented by subclasses
   */
  abstract validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;

  /**
   * Get all tools provided by this connection
   * Must be implemented by subclasses
   */
  abstract getTools(): ConnectionTool[];

  /**
   * Helper to create a failed connection status
   */
  protected createErrorStatus(error: string): ConnectionStatus {
    return {
      status: 'error',
      lastChecked: new Date().toISOString(),
      error,
    };
  }

  /**
   * Helper to create a successful connection status
   */
  protected createConnectedStatus(userInfo?: ConnectionStatus['userInfo']): ConnectionStatus {
    return {
      status: 'connected',
      lastChecked: new Date().toISOString(),
      userInfo,
    };
  }

  /**
   * Helper to create an expired connection status
   */
  protected createExpiredStatus(): ConnectionStatus {
    return {
      status: 'expired',
      lastChecked: new Date().toISOString(),
      error: 'Token has expired',
    };
  }

  /**
   * Make an authenticated API request
   * Helper for subclasses to use
   */
  protected async authenticatedFetch(
    url: string,
    tokens: TokenSet,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `${tokens.tokenType} ${tokens.accessToken}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Make an authenticated JSON API request
   * Helper for subclasses to use
   */
  protected async authenticatedJsonFetch<T>(
    url: string,
    tokens: TokenSet,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    const response = await this.authenticatedFetch(url, tokens, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json() as Promise<T>;
  }
}
