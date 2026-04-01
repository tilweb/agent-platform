/**
 * Abstract Base Class for OAuth2 Connection Providers
 */

import { randomBytes, createHash } from 'node:crypto';
import type { TokenSet, OAuth2Config, ConnectionStatus, ConnectionTool } from '../types';
import { BaseConnectionProvider } from './ConnectionProvider';

/**
 * Generate PKCE code verifier and challenge (RFC 7636)
 */
function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  // Generate 32 random bytes → 43-char base64url string
  const codeVerifier = randomBytes(32)
    .toString('base64url');

  // SHA-256 hash of verifier, base64url-encoded
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Base class for OAuth2-based connection providers
 */
export abstract class OAuthProvider extends BaseConnectionProvider {
  readonly authType = 'oauth2' as const;

  /**
   * Get OAuth2 configuration
   * Must be implemented by subclasses
   */
  protected abstract getOAuthConfig(): OAuth2Config;

  /**
   * Process token response (for provider-specific handling)
   * Override in subclasses if needed
   */
  protected processTokenResponse(data: any): TokenSet {
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Get the OAuth authorization URL
   * Returns a string for standard OAuth, or { url, codeVerifier } when PKCE is enabled
   */
  override getAuthUrl(state: string, redirectUri: string): string | { url: string; codeVerifier: string } {
    const config = this.getOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      ...config.additionalAuthParams,
    });

    // Add PKCE parameters if required
    if (config.usePkce) {
      const { codeVerifier, codeChallenge } = generatePkce();
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');

      return {
        url: `${config.authorizationUrl}?${params.toString()}`,
        codeVerifier,
      };
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  override async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet> {
    const config = this.getOAuthConfig();

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      ...config.additionalTokenParams,
    });

    // Include PKCE code verifier if present
    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    return this.processTokenResponse(data);
  }

  /**
   * Refresh an expired access token
   */
  override async refreshToken(refreshToken: string): Promise<TokenSet> {
    const config = this.getOAuthConfig();

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    const tokens = this.processTokenResponse(data);

    // Preserve refresh token if not returned
    if (!tokens.refreshToken) {
      tokens.refreshToken = refreshToken;
    }

    return tokens;
  }

  /**
   * Validate that the connection is still working
   * Must be implemented by subclasses
   */
  abstract override validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;

  /**
   * Get all tools provided by this connection
   * Must be implemented by subclasses
   */
  abstract override getTools(): ConnectionTool[];
}
