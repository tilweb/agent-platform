/**
 * Confluence Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import {
  getConfluenceConfig,
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
  readonly description = 'Zugriff auf Confluence — Seiten suchen, lesen und Spaces auflisten';
  readonly icon = '📄';
  readonly setupGuide = `## Atlassian Confluence Setup

### 1. Atlassian Developer Console
1. Gehe zu [developer.atlassian.com](https://developer.atlassian.com/console/myapps/)
2. Klicke "Create" → "OAuth 2.0 integration"

### 2. App konfigurieren
1. Name: z.B. "Agent Platform"
2. Gehe zu "Permissions" und füge hinzu:
   - User Identity API: \`read:me\`
   - Confluence API (granular): \`read:page:confluence\`, \`read:space:confluence\`, \`search:confluence\`
3. Gehe zu "Authorization" → "Add" → "OAuth 2.0 (3LO)"
4. Callback URL: \`http://localhost:3001/api/connections/confluence/callback\`

### 3. Credentials kopieren
1. Gehe zu "Settings"
2. Kopiere "Client ID" und "Secret"

### 4. Umgebungsvariablen
Füge in \`.env\` hinzu:
\`\`\`
CONFLUENCE_CLIENT_ID=deine-client-id
CONFLUENCE_CLIENT_SECRET=dein-client-secret
\`\`\`

### 5. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Der verbundene Benutzer muss Zugriff auf mindestens eine Confluence-Instanz haben.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getConfluenceConfig();
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
      console.error('[Confluence] validateConnection error:', error.message);
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

// Export singleton instance
export const confluenceProvider = new ConfluenceProvider();
