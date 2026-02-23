/**
 * Confluence Connection Provider
 */

import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import {
  getAccessibleResourcesUrl,
  getConfluenceApiUrl,
} from './config';
import { createSearchTool } from './tools/search';
import { createReadPageTool } from './tools/read-page';
import { createListSpacesTool } from './tools/list-spaces';

interface AtlassianResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
}

interface AtlassianUser {
  account_id: string;
  email: string;
  name: string;
  picture?: string;
}

export class ConfluenceProvider extends OAuthProvider {
  readonly id = 'confluence';
  readonly name = 'Atlassian Confluence';
  readonly description = 'Confluence-Seiten durchsuchen und lesen';
  readonly icon = 'confluence';

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  /**
   * Override to handle Atlassian-specific token response
   */
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    // Atlassian tokens don't include cloud ID in the response
    // We'll fetch it during validation
    return tokens;
  }

  /**
   * Get accessible Confluence instances for the user
   */
  private async getAccessibleResources(tokens: TokenSet): Promise<AtlassianResource[]> {
    const response = await this.authenticatedFetch(
      getAccessibleResourcesUrl(),
      tokens
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get accessible resources: ${response.status} - ${text}`);
    }

    return response.json() as Promise<AtlassianResource[]>;
  }

  /**
   * Get current user info
   */
  private async getCurrentUser(tokens: TokenSet): Promise<AtlassianUser> {
    const response = await this.authenticatedFetch(
      'https://api.atlassian.com/me',
      tokens
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }

    return response.json() as Promise<AtlassianUser>;
  }

  /**
   * Validate connection and get user info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      // Get user info
      const user = await this.getCurrentUser(tokens);

      // Get accessible Confluence instances
      const resources = await this.getAccessibleResources(tokens);

      // Find first Confluence instance
      const confluenceInstance = resources.find(r =>
        r.scopes.some(s => s.includes('confluence'))
      );

      if (!confluenceInstance) {
        return this.createErrorStatus('No Confluence instance found. Please ensure you have Confluence access.');
      }

      // Store cloud ID in tokens for later use
      tokens.cloudId = confluenceInstance.id;

      return this.createConnectedStatus({
        id: user.account_id,
        name: user.name,
        email: user.email,
        avatarUrl: user.picture,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  /**
   * Get Confluence tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchTool(this.id),
        createReadPageTool(this.id),
        createListSpacesTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Default export for dynamic loader
export default new ConfluenceProvider();
