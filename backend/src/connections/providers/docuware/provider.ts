/**
 * Docuware Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getDocuwareConfig, getDocuwareApiUrl, getDocuwareOrgUrl } from './config';
import { createSearchDocumentsTool } from './tools/search-documents';
import { createGetDocumentTool } from './tools/get-document';
import { createListCabinetsTool } from './tools/list-cabinets';

interface DocuwareUser {
  Id?: string;
  Name?: string;
  EMail?: string;
  DBName?: string;
}

export class DocuwareProvider extends OAuthProvider {
  readonly id = 'docuware';
  readonly name = 'Docuware';
  readonly description = 'Zugriff auf Docuware — Dokumente suchen und Akten verwalten';
  readonly icon = '🗄️';
  readonly setupGuide = `## Docuware Setup

### 1. Docuware Administration
1. Melde dich als Administrator in deiner Docuware-Organisation an
2. Gehe zu den OAuth-/API-Einstellungen

### 2. OAuth App erstellen
1. Erstelle eine neue OAuth-App/Integration
2. Name: z.B. "Agent Platform"
3. Callback URL: \`http://localhost:3001/api/connections/docuware/callback\`
4. Berechtigungen: Lesezugriff auf Dokumente und Ablagestrukturen

### 3. Credentials kopieren
1. Kopiere "Client ID" und "Client Secret"

### 4. Umgebungsvariablen
Füge in \`.env\` hinzu:
\`\`\`
DOCUWARE_CLIENT_ID=deine-client-id
DOCUWARE_CLIENT_SECRET=dein-client-secret
DOCUWARE_ORG_URL=https://deine-org.docuware.cloud
\`\`\`

### 5. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweis
Die DOCUWARE_ORG_URL muss die vollständige URL deiner Docuware-Organisation sein (z.B. \`https://meinefirma.docuware.cloud\`). Die OAuth-Endpoints sind organisationsspezifisch.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getDocuwareConfig();
  }

  /**
   * Override to store apiDomain from org URL
   */
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    // Store the org URL as apiDomain for API calls
    tokens.apiDomain = getDocuwareOrgUrl();

    return tokens;
  }

  /**
   * Validate connection by checking organization info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const apiUrl = getDocuwareApiUrl(tokens.apiDomain);

      // Try to get organization info or current user
      const response = await this.authenticatedFetch(
        `${apiUrl}/Organization`,
        tokens
      );

      if (!response.ok) {
        // Fallback: try FileCabinets endpoint as validation
        const fallbackResponse = await this.authenticatedFetch(
          `${apiUrl}/FileCabinets`,
          tokens
        );

        if (!fallbackResponse.ok) {
          const text = await fallbackResponse.text();
          if (fallbackResponse.status === 401 || fallbackResponse.status === 403) {
            return this.createExpiredStatus();
          }
          throw new Error(`Validation failed: ${fallbackResponse.status} - ${text}`);
        }

        return this.createConnectedStatus({
          id: 'docuware-user',
          name: 'Docuware User',
          email: '',
        });
      }

      const orgData = await response.json() as any;

      return this.createConnectedStatus({
        id: orgData.Id || orgData.Name || 'docuware-user',
        name: orgData.Name || 'Docuware',
        email: orgData.EMail || '',
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  /**
   * Get Docuware tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchDocumentsTool(this.id),
        createGetDocumentTool(this.id),
        createListCabinetsTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const docuwareProvider = new DocuwareProvider();
