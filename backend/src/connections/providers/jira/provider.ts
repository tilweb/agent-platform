/**
 * Jira Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import {
  getJiraConfig,
  getAccessibleResourcesUrl,
} from './config';
import { createSearchIssuesTool } from './tools/search-issues';
import { createGetIssueTool } from './tools/get-issue';
import { createListProjectsTool } from './tools/list-projects';
import { createCreateIssueTool } from './tools/create-issue';

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

export class JiraProvider extends OAuthProvider {
  readonly id = 'jira';
  readonly name = 'Atlassian Jira';
  readonly description = 'Zugriff auf Jira — Issues suchen, lesen, erstellen und Projekte auflisten';
  readonly icon = '🎫';
  readonly setupGuide = `## Atlassian Jira Setup

### 1. Atlassian Developer Console
1. Gehe zu [developer.atlassian.com](https://developer.atlassian.com/console/myapps/)
2. Klicke "Create" → "OAuth 2.0 integration"

### 2. App konfigurieren
1. Name: z.B. "Agent Platform - Jira"
2. Gehe zu "Permissions" und füge hinzu:
   - User Identity API: \`read:me\`
   - Jira API: \`read:jira-work\`, \`read:jira-user\`, \`write:jira-work\`
3. Gehe zu "Authorization" → "Add" → "OAuth 2.0 (3LO)"
4. Callback URL: \`http://localhost:3001/api/connections/jira/callback\`

### 3. Credentials kopieren
1. Gehe zu "Settings"
2. Kopiere "Client ID" und "Secret"

### 4. Umgebungsvariablen
Füge in \`.env\` hinzu:
\`\`\`
JIRA_CLIENT_ID=deine-client-id
JIRA_CLIENT_SECRET=dein-client-secret
\`\`\`

### 5. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Jira verwendet separate Credentials von Confluence (auch wenn beides Atlassian ist). Der verbundene Benutzer muss Zugriff auf mindestens eine Jira-Instanz haben.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getJiraConfig();
  }

  /**
   * Override to handle Atlassian-specific token response
   */
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);
    return tokens;
  }

  /**
   * Get accessible Jira instances for the user
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
      const user = await this.getCurrentUser(tokens);
      const resources = await this.getAccessibleResources(tokens);

      // Find first Jira instance
      const jiraInstance = resources.find(r =>
        r.scopes.some(s => s.includes('jira'))
      );

      if (!jiraInstance) {
        return this.createErrorStatus('No Jira instance found. Please ensure you have Jira access.');
      }

      // Store cloud ID in tokens for later use
      tokens.cloudId = jiraInstance.id;

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
   * Get Jira tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchIssuesTool(this.id),
        createGetIssueTool(this.id),
        createListProjectsTool(this.id),
        createCreateIssueTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const jiraProvider = new JiraProvider();
