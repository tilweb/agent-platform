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
import { createGetAttachmentTool } from './tools/get-attachment';

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
  readonly setupGuide = `## Google Mail Setup (zentrale Adacor-App)

> Nutzt **dieselbe** zentrale Adacor-Google-App wie Google Drive (siehe Google-Drive-Anleitung).
> **Eine** App für alle Workplace-Instanzen, **kein** Setup pro Kunde. **Endnutzer** klicken nur „Verbinden".

### 1. Gmail API aktivieren (im zentralen Projekt)
"APIs & Services" → "Library" → **Gmail API** → "Enable" — im **selben** Adacor-Projekt wie Drive.

### 2. Scope ergänzen (an der zentralen App)
"OAuth consent screen" / "Google Auth Platform" → "Datenzugriff" → Scope \`.../auth/gmail.modify\` hinzufügen.

### 3. Redirect-URIs je Instanz (im selben OAuth-Client)
Pro Instanz **eine** Zeile in **denselben** Client (den von Google Drive):
\`\`\`
https://<instanz-domain>/api/connections/google-mail/callback
http://localhost:3001/api/connections/google-mail/callback   (nur Dev)
\`\`\`

### 4. Credentials
Dieselben \`GOOGLE_CLIENT_ID\` / \`GOOGLE_CLIENT_SECRET\` wie Google Drive — nichts Zusätzliches.

### Hinweis
Eine zentrale App, von **Adacor einmal** eingerichtet. Endnutzer richten in Google **nichts** ein — ein Klick „Verbinden" genügt, eigenes Konto, eigener Token.`;

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
        createGetAttachmentTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const googleMailProvider = new GoogleMailProvider();
