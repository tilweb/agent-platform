/**
 * Docuware Connection Provider
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getDocuwareConfig, getDocuwareApiUrl, getDocuwareOrgUrl } from './config';
import { createSearchDocumentsTool } from './tools/search-documents';
import { createGetDocumentTool } from './tools/get-document';
import { createListCabinetsTool } from './tools/list-cabinets';

/**
 * Decode JWT payload (middle segment) without signature verification.
 * Safe weil id_token direkt vom Token-Endpoint via TLS kommt — wir nutzen
 * den Inhalt nur fuer UI-Anzeige, nicht fuer Authorization-Entscheidungen.
 */
function decodeJwtPayload(idToken: string): Record<string, any> | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

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

### 4. OAuth-Endpoints kopieren
In der App-Registrierung zeigt DocuWare zwei Endpoints unter den Redirect-URIs an:
- \`Authorization Endpoint\` (z.B. \`https://login-emea.docuware.cloud/<tenant-id>/oauth2/authorize\`)
- \`Token Endpoint\` (z.B. \`https://login-emea.docuware.cloud/<tenant-id>/oauth2/token\`)

Beide vollstaendig kopieren — sind tenant-spezifisch und nicht aus der Org-URL ableitbar.

### 5. Umgebungsvariablen
Füge in \`.env\` hinzu:
\`\`\`
DOCUWARE_CLIENT_ID=deine-client-id
DOCUWARE_CLIENT_SECRET=dein-client-secret
DOCUWARE_ORG_URL=https://deine-org.docuware.cloud
DOCUWARE_AUTHORIZATION_URL=https://login-emea.docuware.cloud/<tenant-id>/oauth2/authorize
DOCUWARE_TOKEN_URL=https://login-emea.docuware.cloud/<tenant-id>/oauth2/token
\`\`\`

### 6. Backend neu starten
Nach dem Setzen der Umgebungsvariablen das Backend neu starten.

### Hinweise
- \`DOCUWARE_ORG_URL\` ist die vollstaendige URL deiner Docuware-Organisation (z.B. \`https://meinefirma.docuware.cloud\`) und wird fuer Platform-API-Calls nach erfolgreichem Login verwendet.
- \`DOCUWARE_AUTHORIZATION_URL\` und \`DOCUWARE_TOKEN_URL\` sind die tenant-spezifischen OAuth-Endpoints, die DocuWare in der App-Registrierung anzeigt. Wenn diese ENVs nicht gesetzt sind, fallen wir auf den alten Org-Pfad zurueck — der wird seit der OAuth-Migration teils von der DocuWare-WAF blockiert ("Request blocked by DocuWare firewall").
- Allowed Redirect-URIs in der App-Registrierung muessen die vollen Callback-URLs aller Umgebungen enthalten (Local + Production), exakt wie das Backend sie schickt.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getDocuwareConfig();
  }

  /**
   * Override to store apiDomain from org URL and extract user info from id_token
   */
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    // Store the org URL as apiDomain for API calls
    tokens.apiDomain = getDocuwareOrgUrl();

    // OIDC: id_token kommt mit dem `openid`-Scope. Daraus User-Info extrahieren
    // — kein extra API-Call noetig, und es zeigt den eingeloggten User statt
    // nur den Org-Namen.
    if (typeof data.id_token === 'string') {
      const claims = decodeJwtPayload(data.id_token);
      if (claims) {
        tokens.userId = claims.sub || claims.name_id || undefined;
        tokens.userName =
          claims.name ||
          claims.preferred_username ||
          claims.given_name ||
          undefined;
        tokens.userEmail = claims.email || undefined;
        // iss merken — daraus leiten wir den userinfo-Endpoint in
        // validateConnection ab, falls Profile-Claims im id_token fehlen
        // (DocuWare schickt nur `sub`, Profile kommt ueber userinfo).
        if (typeof claims.iss === 'string') {
          tokens.oidcIssuer = claims.iss;
        }
      }
    }

    return tokens;
  }

  /**
   * Validate connection by checking organization info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const apiUrl = getDocuwareApiUrl(tokens.apiDomain);

      // DocuWare Platform-API liefert ohne Accept-Header XML/SOAP — fuer JSON
      // muss der Header explizit gesetzt werden.
      const jsonHeaders = { Accept: 'application/json' };

      // Wenn id_token User-Info geliefert hat, validieren wir ueber FileCabinets
      // (cheap call) und zeigen den User aus dem Token statt der Org. Macht die
      // Card-Anzeige "Connected as: <Username>" konsistent mit anderen Providern.
      if (tokens.userId || tokens.userName) {
        const probe = await this.authenticatedFetch(
          `${apiUrl}/FileCabinets`,
          tokens,
          { headers: jsonHeaders },
        );
        if (probe.status === 401 || probe.status === 403) {
          return this.createExpiredStatus();
        }
        if (!probe.ok) {
          const text = await probe.text();
          throw new Error(`Validation failed: ${probe.status} - ${text}`);
        }

        // Profile-Claims fehlen oft im id_token — userinfo-Endpoint nachladen.
        // IdentityServer-Standardpfad ist <issuer>/connect/userinfo.
        let displayName = tokens.userName;
        let displayEmail = tokens.userEmail;
        if (!displayName && tokens.oidcIssuer) {
          const userinfoUrl =
            process.env.DOCUWARE_USERINFO_URL ||
            `${tokens.oidcIssuer.replace(/\/+$/, '')}/connect/userinfo`;
          try {
            const uiRes = await fetch(userinfoUrl, {
              headers: {
                Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
                Accept: 'application/json',
              },
            });
            if (uiRes.ok) {
              const info = (await uiRes.json()) as Record<string, any>;
              displayName =
                info.name ||
                info.preferred_username ||
                info.given_name ||
                info.email ||
                displayName;
              displayEmail = info.email || displayEmail;
            }
          } catch {
            // best-effort — ohne userinfo nehmen wir den Default
          }
        }

        return this.createConnectedStatus({
          id: tokens.userId || 'docuware-user',
          name: displayName || 'Docuware User',
          email: displayEmail || '',
        });
      }

      // Fallback (kein OIDC id_token): klassisch /Organization holen.
      const response = await this.authenticatedFetch(
        `${apiUrl}/Organization`,
        tokens,
        { headers: jsonHeaders },
      );

      if (!response.ok) {
        // Fallback: try FileCabinets endpoint as validation
        const fallbackResponse = await this.authenticatedFetch(
          `${apiUrl}/FileCabinets`,
          tokens,
          { headers: jsonHeaders },
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
