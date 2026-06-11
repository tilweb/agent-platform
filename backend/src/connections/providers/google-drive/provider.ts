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
  readonly description = 'Zugriff auf Google Drive — Dateien suchen, auflisten und lesen';
  readonly icon = '📁';
  readonly setupGuide = `## Google Drive Setup (zentrale Adacor-App)

> **Einmal von Adacor (Betreiber) einzurichten — gilt für ALLE Workplace-Instanzen.**
> Es wird **eine** zentrale Google-OAuth-App verwendet, **nicht** eine pro Kunde/Instanz.
> **Endnutzer** richten in Google **nichts** ein — sie klicken nur „Verbinden".

### Rollen
- **Adacor (Betreiber/Admin):** legt die zentrale Google-App **einmal** an und pflegt die Redirect-URIs.
- **Endnutzer (Mitarbeiter eines Kunden):** klickt „Google verbinden" → Google-Consent → fertig. Eigenes Konto, eigener Token. **Keine Google Console.**

### 1. Zentrale Google-Cloud-App (einmalig, NICHT pro Instanz)
1. [Google Cloud Console](https://console.cloud.google.com/) → **ein** Adacor-Projekt (z. B. "Adacor Workplace"). Für alle Instanzen dasselbe.
2. "APIs & Services" → "Library" → **Google Drive API** aktivieren. (Für Docs/Sheets später zusätzlich Google Docs/Sheets API.)

### 2. OAuth Consent Screen (einmal)
1. "APIs & Services" → "OAuth consent screen" / "Google Auth Platform".
2. **Branding:** App-Name "Adacor Workplace" + Support-Mail.
3. **Zielgruppe:** "Extern".
4. **Scopes** hinzufügen:
   - \`.../auth/drive.readonly\`
   - \`.../auth/userinfo.email\`
   - \`.../auth/userinfo.profile\`

### 3. EIN OAuth-Client für alle Instanzen
1. "Clients" → "OAuth-Client erstellen" → Typ **Webanwendung**, Name "Adacor Workplace".
2. **Autorisierte Weiterleitungs-URIs** — je Instanz **eine** Zeile, alle in **diesen einen** Client, in **Production-Form**:
\`\`\`
https://<instanz-domain>/api/connections/google-drive/callback
https://demo.workplace-lab.adacor.dev/api/connections/google-drive/callback
http://localhost:3001/api/connections/google-drive/callback   (nur Dev)
\`\`\`
   Google erlaubt viele Redirect-URIs pro Client — alle Instanzen teilen sich diesen einen Client.
3. **Client-ID** + **Clientschlüssel** kopieren.

### 4. Auf JEDER Instanz dieselben Credentials
\`\`\`
GOOGLE_CLIENT_ID=<zentrale-client-id>
GOOGLE_CLIENT_SECRET=<zentrales-secret>
\`\`\`
Auf allen Workplace-Instanzen **identisch** setzen, dann Backend neu starten.

### 5. Neue Instanz dazu? Nur EIN Handgriff (Adacor)
Trage **nur** deren Callback-URL (\`https://<neue-instanz>/api/connections/google-drive/callback\`) in **denselben** OAuth-Client ein. Kein neues Projekt, keine neue App, **nichts beim Kunden**.

### Freigabe-Status
- **Workshop/Pilot:** "Testing"-Modus → unter "Zielgruppe → Testnutzer" die Teilnehmer-Mails eintragen. Keine Google-Verifizierung nötig.
- **Produktion (viele/externe Nutzer):** die zentrale App **einmal** von Google verifizieren lassen (sensible Scopes). **Einmal für Adacor**, nicht pro Kunde — wie es Notion/Langdock auch einmal gemacht haben.

### Was NICHT nötig ist
- ❌ Kein eigenes Google-Projekt pro Kunde/Instanz.
- ❌ Endnutzer machen **nichts** in der Google Console — ein Klick „Verbinden" genügt.`;

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
