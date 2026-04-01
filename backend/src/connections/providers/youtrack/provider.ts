/**
 * YouTrack Connection Provider
 *
 * Uses Hub's Implicit OAuth2 flow (the only flow supported by YouTrack Cloud's built-in Hub).
 * The token is returned directly in the URL fragment, no code exchange needed.
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getYouTrackConfig, getYouTrackApiUrl } from './config';
import { createSearchIssuesTool } from './tools/search-issues';
import { createGetIssueTool } from './tools/get-issue';
import { createCreateIssueTool } from './tools/create-issue';
import { createListProjectsTool } from './tools/list-projects';

interface YouTrackUser {
  id: string;
  login: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
}

export class YouTrackProvider extends OAuthProvider {
  readonly id = 'youtrack';
  readonly name = 'JetBrains YouTrack';
  readonly description = 'Zugriff auf YouTrack — Issues suchen, lesen, erstellen und Projekte auflisten';
  readonly icon = '🎯';
  readonly setupGuide = `## JetBrains YouTrack Cloud Setup

### 1. Umgebungsvariablen
Fuege in \`.env\` hinzu:
\`\`\`
YOUTRACK_URL=https://firma.youtrack.cloud
YOUTRACK_CLIENT_ID=<YouTrack Service-ID aus Hub>
\`\`\`

Die Service-ID findest du unter: Hub → Services → YouTrack → Client-ID

### 2. Redirect-URI registrieren
1. Gehe zu \`https://firma.youtrack.cloud/hub/services\`
2. Oeffne den **YouTrack**-Service
3. Fuege bei **Umleitungs-URIs** hinzu:
   \`http://localhost:3001/api/connections/youtrack/callback\`

### 3. Backend neu starten

### Hinweis
YouTrack Cloud nutzt den Implicit OAuth2 Flow. Kein Client-Secret noetig.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getYouTrackConfig();
  }

  /**
   * Override getAuthUrl for implicit flow: response_type=token instead of code
   */
  override getAuthUrl(state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();

    const params = new URLSearchParams({
      response_type: 'token',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Validate connection and get user info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const user = await this.getCurrentUser(tokens);

      return this.createConnectedStatus({
        id: user.id,
        name: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } catch (error: any) {
      console.error('[YouTrack] validateConnection error:', error.message);
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  /**
   * Get current user info from YouTrack
   */
  private async getCurrentUser(tokens: TokenSet): Promise<YouTrackUser> {
    const apiUrl = getYouTrackApiUrl();
    const fields = 'id,login,fullName,email,avatarUrl';

    const response = await this.authenticatedFetch(
      `${apiUrl}/users/me?fields=${encodeURIComponent(fields)}`,
      tokens,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }

    return response.json() as Promise<YouTrackUser>;
  }

  /**
   * Get YouTrack tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchIssuesTool(this.id),
        createGetIssueTool(this.id),
        createCreateIssueTool(this.id),
        createListProjectsTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const youtrackProvider = new YouTrackProvider();
