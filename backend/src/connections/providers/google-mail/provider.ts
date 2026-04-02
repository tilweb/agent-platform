/**
 * Google Mail Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getGoogleMailConfig, GOOGLE_USERINFO_URL } from './config';
import { createSearchEmailsTool } from './tools/search-emails';
import { createReadEmailTool } from './tools/read-email';
import { createListLabelsTool } from './tools/list-labels';
import { createSetLabelsTool } from './tools/set-labels';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleMailProvider extends OAuthProvider {
  readonly id = 'google-mail';
  readonly name = 'Google Mail';
  readonly description = 'Zugriff auf Gmail — E-Mails suchen, lesen und Labels verwalten';
  readonly icon = '📧';
  readonly setupGuide = `## Google Mail Setup

### 1. Google Cloud Console
1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Verwende dasselbe Projekt wie für Google Drive (oder erstelle ein neues)

### 2. Gmail API aktivieren
1. Gehe zu "APIs & Services" → "Library"
2. Suche nach "Gmail API"
3. Klicke auf "Enable"

### 3. OAuth Scopes erweitern
Falls du bereits einen OAuth-Client für Google Drive hast:
1. Gehe zu "APIs & Services" → "Google Auth Platform" → "Datenzugriff"
2. Füge den Scope \`.../auth/gmail.modify\` hinzu

### 4. OAuth Client
Du kannst dieselbe Client-ID und dasselbe Client-Secret wie für Google Drive verwenden.
Falls noch kein Client existiert:
1. Gehe zu **Clients** → "OAuth-Client erstellen"
2. Anwendungstyp: **Webanwendung**
3. **Autorisierte Weiterleitungs-URIs**:
   \`http://localhost:3001/api/connections/google-mail/callback\`
4. Kopiere **Client-ID** und **Clientschlüssel**

### 5. Umgebungsvariablen
Füge in \`.env\` hinzu (falls nicht bereits vorhanden):
\`\`\`
GOOGLE_CLIENT_ID=deine-client-id
GOOGLE_CLIENT_SECRET=dein-client-secret
\`\`\`

### 6. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Google Mail nutzt dieselben Credentials wie Google Drive. Du musst lediglich die Gmail API im selben Projekt aktivieren und den Callback-URI hinzufügen.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getGoogleMailConfig();
  }

  /**
   * Get current user info from Google
   */
  private async getCurrentUser(tokens: TokenSet): Promise<GoogleUserInfo> {
    const response = await this.authenticatedFetch(
      GOOGLE_USERINFO_URL,
      tokens
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }

    return response.json() as Promise<GoogleUserInfo>;
  }

  /**
   * Validate connection and get user info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const user = await this.getCurrentUser(tokens);

      return this.createConnectedStatus({
        id: user.id,
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
   * Get Google Mail tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchEmailsTool(this.id),
        createReadEmailTool(this.id),
        createListLabelsTool(this.id),
        createSetLabelsTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const googleMailProvider = new GoogleMailProvider();
