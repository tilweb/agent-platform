/**
 * YouTrack Connection Provider
 *
 * Uses Hub OAuth2 for authentication (instance-specific endpoints).
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
  readonly setupGuide = `## JetBrains YouTrack Setup

### 1. Hub-Service oeffnen
1. Gehe zu deiner YouTrack-Instanz (z.B. \`https://firma.youtrack.cloud\`)
2. Oeffne Hub: Klicke oben rechts auf dein Profil → "Hub" oder gehe zu \`/hub\`

### 2. OAuth2-App registrieren
1. Gehe zu "Services" → dein YouTrack-Service → "Auth Modules" → "New Module" → "OAuth2"
   - **Oder**: "Resources" → "Auth Modules" → "New Module" → "OAuth2"
2. Name: z.B. "Agent Platform"
3. Redirect URI: \`http://localhost:3001/api/connections/youtrack/callback\`
4. Kopiere "Client ID" und "Client Secret"

### 3. Berechtigungen
Die App erhaelt automatisch Zugriff auf die Services, fuer die sie registriert ist.
Stelle sicher, dass YouTrack als Service zugewiesen ist.

### 4. Umgebungsvariablen
Fuege in \`.env\` hinzu:
\`\`\`
YOUTRACK_URL=https://firma.youtrack.cloud
YOUTRACK_CLIENT_ID=deine-client-id
YOUTRACK_CLIENT_SECRET=dein-client-secret
YOUTRACK_SCOPE=optional-service-id
\`\`\`

### 5. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Die YOUTRACK_URL muss die vollstaendige URL eurer YouTrack-Cloud-Instanz sein. YOUTRACK_SCOPE ist optional — wenn leer, werden die Hub-App-Berechtigungen verwendet.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getYouTrackConfig();
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
      tokens
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
