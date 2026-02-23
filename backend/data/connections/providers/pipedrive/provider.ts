/**
 * Pipedrive Connection Provider
 */

import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { getPipedriveApiUrl } from './config';
import { createSearchDealsTool } from './tools/search-deals';
import { createSearchContactsTool } from './tools/search-contacts';
import { createSearchActivitiesTool } from './tools/search-activities';
import { createGetDealTool } from './tools/get-deal';

interface PipedriveUser {
  id: number;
  name: string;
  email: string;
  icon_url?: string;
  company_id: number;
  company_name: string;
  company_domain: string;
}

export class PipedriveProvider extends OAuthProvider {
  readonly id = 'pipedrive';
  readonly name = 'Pipedrive CRM';
  readonly description = 'Pipedrive Deals, Kontakte und Aktivitäten durchsuchen';
  readonly icon = 'pipedrive';

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  /**
   * Override to handle Pipedrive-specific token response
   * Pipedrive returns api_domain in the token response
   */
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    // Pipedrive includes the API domain in token response
    if (data.api_domain) {
      tokens.apiDomain = data.api_domain;
    }

    return tokens;
  }

  /**
   * Override token exchange to use Basic Auth header (Pipedrive requirement)
   */
  override async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const config = await this.getOAuthConfig();

    // Pipedrive requires Basic Auth header with base64(client_id:client_secret)
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
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
   * Override token refresh to use Basic Auth header (Pipedrive requirement)
   */
  override async refreshToken(refreshToken: string): Promise<TokenSet> {
    const config = await this.getOAuthConfig();

    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
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
   * Get current user info from Pipedrive
   */
  private async getCurrentUser(tokens: TokenSet): Promise<PipedriveUser> {
    if (!tokens.apiDomain) {
      throw new Error('API domain not available in tokens');
    }

    const apiUrl = getPipedriveApiUrl(tokens.apiDomain);
    const response = await fetch(`${apiUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }

    const result = await response.json() as { success: boolean; error?: string; data?: any };
    if (!result.success) {
      throw new Error(result.error || 'Failed to get user info');
    }

    const data = result.data;
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      icon_url: data.icon_url,
      company_id: data.company_id,
      company_name: data.company_name,
      company_domain: data.company_domain,
    };
  }

  /**
   * Validate connection and get user info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      if (!tokens.apiDomain) {
        return this.createErrorStatus('API domain not available. Please reconnect.');
      }

      const user = await this.getCurrentUser(tokens);

      return this.createConnectedStatus({
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.icon_url,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  /**
   * Get Pipedrive tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchDealsTool(this.id),
        createSearchContactsTool(this.id),
        createSearchActivitiesTool(this.id),
        createGetDealTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Default export for dynamic loader
export default new PipedriveProvider();
