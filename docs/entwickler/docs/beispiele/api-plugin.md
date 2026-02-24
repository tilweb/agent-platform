# Beispiel: API-Key-Plugin (Pipedrive)

Ein Beispiel für ein Plugin mit Sonderbehandlung beim Token Exchange. Pipedrive erwartet Basic Auth statt Client Credentials im Body.

## Besonderheit

Manche OAuth2-Dienste weichen vom Standard ab. Bei Pipedrive:

- **Token Exchange**: Basic Auth Header statt `client_id`/`client_secret` im Body
- **Token Refresh**: Ebenfalls Basic Auth Header
- **API Domain**: Wird in der Token-Response zurückgegeben und muss gespeichert werden

## manifest.yaml

```yaml
id: pipedrive
type: connector
name: "Pipedrive"
description: "Pipedrive CRM — Deals, Kontakte und Aktivitäten"
version: "1.0.0"
author: "KI-Workplace"

configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true

setupGuide: |
  ## Pipedrive einrichten
  1. Gehe zu developers.pipedrive.com
  2. Erstelle eine neue App
  3. Callback URL: `{API_BASE_URL}/api/connections/pipedrive/callback`
  4. Benötigte Scopes: `deals:read`, `contacts:read`, `activities:read`

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://oauth.pipedrive.com/oauth/authorize"
    tokenUrl: "https://oauth.pipedrive.com/oauth/token"
    scopes:
      - "deals:read"
      - "contacts:read"
      - "activities:read"
```

## provider.ts — mit überschriebenem Token Exchange

```typescript
import { OAuthProvider, resolveOAuthConfig } from "@platform/sdk";
import type {
  TokenSet,
  ConnectionStatus,
  ConnectionTool,
  OAuth2Config,
} from "@platform/sdk";

export class PipedriveProvider extends OAuthProvider {
  readonly id = "pipedrive";
  readonly name = "Pipedrive";
  readonly description = "Pipedrive CRM — Deals, Kontakte und Aktivitäten";
  readonly icon = "💼";

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  // ─── Sonderfall: Basic Auth für Token Exchange ──────────
  override async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<TokenSet> {
    const config = await this.getOAuthConfig();

    const basicAuth = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64");

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return this.processTokenResponse(data);
  }

  // ─── Sonderfall: API Domain aus Token-Response ──────────
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    if (data.api_domain) {
      (tokens as any).apiDomain = data.api_domain;
    }

    return tokens;
  }

  override async validateConnection(
    tokens: TokenSet,
  ): Promise<ConnectionStatus> {
    try {
      const apiDomain = (tokens as any).apiDomain || "api.pipedrive.com";
      const response = await this.authenticatedFetch(
        `https://${apiDomain}/v1/users/me`,
        tokens,
      );

      if (!response.ok) {
        throw new Error(`${response.status}`);
      }

      const data = (await response.json()) as any;
      const user = data.data;

      return this.createConnectedStatus({
        id: String(user.id),
        name: user.name,
        email: user.email,
      });
    } catch (error: any) {
      if (error.message?.includes("401") || error.message?.includes("403")) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        // createSearchDealsTool(this.id),
        // createSearchContactsTool(this.id),
        // ... weitere Tools
      ];
    }
    return this.tools;
  }
}

export default new PipedriveProvider();
```

## Wann muss ich exchangeCode überschreiben?

| Dienst       | Standard-Flow? | Grund für Override           |
| ------------ | -------------- | ---------------------------- |
| Confluence   | Ja             | —                            |
| Google Drive | Ja             | —                            |
| Pipedrive    | Nein           | Basic Auth Header statt Body |
| Slack        | Nein           | Anderes Token-Format         |

> [!warning] Token Refresh
> Wenn `exchangeCode()` überschrieben wird, muss in der Regel auch `refreshToken()` analog überschrieben werden, da derselbe Auth-Mechanismus verwendet wird.

## Fehlerbehebung

| Symptom                      | Ursache                                       | Lösung                                    |
| ---------------------------- | --------------------------------------------- | ----------------------------------------- |
| "Token exchange failed: 401" | Basic Auth erwartet aber Body-Params gesendet | `exchangeCode()` überschreiben            |
| "Token exchange failed: 400" | Falsches `grant_type`                         | Parameter prüfen                          |
| `apiDomain` ist undefined    | `processTokenResponse()` fehlt                | Override hinzufügen                       |
| Token-Refresh schlägt fehl   | `refreshToken()` nicht überschrieben          | Analog zu `exchangeCode()` implementieren |
