/**
 * Personio Connection Provider
 *
 * Auth-Modell: Client-Credentials fuer v2 (Lesen) + statischer Bearer-Token
 * fuer v1 (Anlegen). Siehe ./config.ts fuer Hintergrund.
 */

import { ClientCredentialsProvider, type ClientCredentialsConfig } from '../../base/ClientCredentialsProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, CredentialFieldSpec } from '../../types';
import {
  PERSONIO_API_BASE,
  PERSONIO_DEFAULT_SCOPES,
  getPersonioClientCredentialsConfig,
} from './config';
import { createListApplicationsTool } from './tools/list-applications';
import { createCreateApplicationTool } from './tools/create-application';

export class PersonioProvider extends ClientCredentialsProvider {
  readonly id = 'personio';
  readonly name = 'Personio';
  readonly description =
    'Personio Recruiting — Bewerbungen lesen (v2) und neue Bewerbungen anlegen (v1)';
  readonly icon = '👥';
  readonly setupGuide = `## Personio Setup

Personio hat zwei separate Recruiting-API-Pfade. Diese Connection deckt beide ab — du brauchst zwei Sets von Credentials.

### 1. v2 API-Credentials fuer Lesen (Client-Credentials)
1. In Personio: **Einstellungen → Integrationen → API-Credentials → Neue Credentials**.
2. Berechtigung: \`personio:recruiting:read\` (\`Bewerbungen lesen\`) auswaehlen.
3. Personio zeigt **Client ID** und **Client Secret** — beide kopieren.

### 2. v1 Recruiting-Access-Token fuer Anlegen
1. In Personio: **Einstellungen → API → Access Data → Recruiting API Access Token**.
2. Token kopieren.
3. Daneben siehst du die **Company ID** — auch kopieren.

### 3. In dieser App eintragen
Trage die vier Werte in den Connection-Setup-Dialog ein. Die App holt damit:
- v2-Bearer-Token (wird beim Ablauf automatisch erneuert)
- v1-Token wird statisch gespeichert und bei POST-Calls ueber den \`Authorization\`-Header geschickt
- Company ID landet im \`X-Company-ID\`-Header bei v1-Calls

Wenn du nur **lesen** willst, lass v1-Token + Company-ID leer — nur das \`personio_create_application\`-Tool funktioniert dann nicht.`;

  private tools: ConnectionTool[] | null = null;

  protected getClientCredentialsConfig(): ClientCredentialsConfig {
    return getPersonioClientCredentialsConfig();
  }

  override getCredentialFields(): CredentialFieldSpec[] {
    return [
      {
        key: 'client_id',
        label: 'v2 Client ID',
        type: 'text',
        required: true,
        helperText: 'Aus Personio: Einstellungen → Integrationen → API-Credentials.',
      },
      {
        key: 'client_secret',
        label: 'v2 Client Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'recruiting_token',
        label: 'v1 Recruiting Access Token (optional)',
        type: 'password',
        required: false,
        helperText: 'Nur noetig wenn du Bewerbungen anlegen willst. Aus Personio: Einstellungen → API → Access Data.',
      },
      {
        key: 'company_id',
        label: 'Company ID (optional)',
        type: 'text',
        required: false,
        helperText: 'Numerische Personio-Company-ID. Pflicht wenn v1-Token gesetzt ist.',
      },
    ];
  }

  /**
   * Erweitere connect() der Base-Klasse um die Personio-spezifischen Felder
   * (v1-Token + Company-ID).
   */
  override async connect(input: Record<string, string>): Promise<TokenSet> {
    const tokens = await super.connect(input);
    const v1Token = input.recruiting_token?.trim();
    const companyId = input.company_id?.trim();
    if (v1Token) tokens.secondaryAccessToken = v1Token;
    if (companyId) tokens.companyId = companyId;

    if (v1Token && !companyId) {
      throw new Error(
        'Wenn der v1-Recruiting-Token gesetzt ist, muss auch die Company-ID angegeben werden.',
      );
    }
    return tokens;
  }

  /**
   * Validate via v2 GET /recruiting/applications (cheap call, Beta-Header noetig).
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const response = await fetch(`${PERSONIO_API_BASE}/v2/recruiting/applications?limit=1`, {
        headers: {
          Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
          Accept: 'application/json',
          Beta: 'true',
        },
      });

      if (response.status === 401 || response.status === 403) {
        return this.createExpiredStatus();
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Validation failed: ${response.status} - ${text}`);
      }

      // Personio v2 hat keinen "current user"-Endpoint im Recruiting-Scope.
      // Wir zeigen die Company-ID (falls gesetzt) bzw. den Scope an.
      const userLabel = tokens.companyId
        ? `Personio Company ${tokens.companyId}`
        : 'Personio Recruiting';

      return this.createConnectedStatus({
        id: tokens.companyId || 'personio',
        name: userLabel,
        email: '',
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createListApplicationsTool(this.id),
        createCreateApplicationTool(this.id),
      ];
    }
    return this.tools;
  }
}

export const personioProvider = new PersonioProvider();

// Re-exports fuer Tools
export { PERSONIO_API_BASE, PERSONIO_DEFAULT_SCOPES };
