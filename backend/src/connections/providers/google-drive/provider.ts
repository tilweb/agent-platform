/**
 * Google Drive Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getGoogleDriveConfig, GOOGLE_USERINFO_URL } from './config';
import { createListFilesTool } from './tools/list-files';
import { createReadFileTool } from './tools/read-file';
import { createSearchFilesTool } from './tools/search-files';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleDriveProvider extends OAuthProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';
  readonly description = 'Connect to Google Drive for file access and search';
  readonly icon = '📁';
  readonly setupGuide = `## Google Drive Setup

### 1. Google Cloud Console
1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes

### 2. Google Drive API aktivieren
1. Gehe zu "APIs & Services" → "Library"
2. Suche nach "Google Drive API"
3. Klicke auf "Enable"

### 3. OAuth konfigurieren (Google Auth Platform)
1. Gehe zu "APIs & Services" → "OAuth consent screen" (oder direkt "Google Auth Platform")
2. **Branding**: App-Name und Support-Email eintragen
3. **Zielgruppe**: "Extern" wählen (oder "Intern" für Workspace)
4. **Datenzugriff**: Klicke "Bereiche hinzufügen" und füge hinzu:
   - \`Google Drive API\` → \`.../auth/drive.readonly\`
   - \`Google Drive API\` → \`.../auth/userinfo.email\`
   - \`Google Drive API\` → \`.../auth/userinfo.profile\`

### 4. OAuth Client erstellen
1. Gehe zu **Clients** (im linken Menü)
2. Klicke "OAuth-Client erstellen"
3. Anwendungstyp: **Webanwendung**
4. Name: z.B. "Agent Platform"
5. **Autorisierte Weiterleitungs-URIs**:
   \`http://localhost:3001/api/connections/google-drive/callback\`
6. Klicke "Erstellen"
7. Kopiere **Client-ID** und **Clientschlüssel**

### 5. Umgebungsvariablen
Füge in \`.env\` hinzu:
\`\`\`
GOOGLE_CLIENT_ID=deine-client-id
GOOGLE_CLIENT_SECRET=dein-client-secret
\`\`\`

### 6. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Bei "Externen" Apps musst du dich selbst als Testnutzer hinzufügen (unter Zielgruppe → Testnutzer), solange die App nicht verifiziert ist.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getGoogleDriveConfig();
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
      // Get user info to validate the connection
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
   * Get Google Drive tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createListFilesTool(this.id),
        createReadFileTool(this.id),
        createSearchFilesTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const googleDriveProvider = new GoogleDriveProvider();
