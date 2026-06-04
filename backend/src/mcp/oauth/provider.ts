/**
 * McpOAuthClientProvider
 *
 * Bridge zwischen dem MCP-SDK-OAuth-Flow (`OAuthClientProvider`) und dem
 * bestehenden Connections-Storage. Das SDK uebernimmt Discovery, Dynamic Client
 * Registration (RFC 7591), PKCE und Token-Rotation; dieser Adapter haengt die
 * Persistenz an die schon vorhandenen, in beiden Worktrees implementierten
 * Storage-Funktionen (Postgres bzw. YAML):
 *
 *   - DCR-Client-Info (pro Server) → McpServerConfig.oauthClient via updateMcpServer
 *   - Access/Refresh-Token (pro User) → connections-Storage als provider "mcp:<id>"
 *   - State + PKCE-Verifier (pro Flow) → oauth_states via save/loadOAuthState
 *
 * Eine Instanz ist an genau ein (userId, serverId)-Paar gebunden.
 */

import { randomBytes } from 'node:crypto';
import type {
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { getMcpServer, updateMcpServer } from '../config';
import {
  saveConnection,
  loadConnection,
  saveOAuthState,
  loadOAuthState,
} from '../../connections';
import type { TokenSet, ConnectionStatus, OAuthState } from '../../connections/types';

/** Provider-ID, unter der MCP-OAuth-Token im Connections-Storage liegen. */
export function mcpConnectionProviderId(serverId: string): string {
  return `mcp:${serverId}`;
}

const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

/** Sekunden bis zum Ablauf eines ISO-Timestamps (>= 0), oder undefined. */
function secondsUntil(expiresAt?: string): number | undefined {
  if (!expiresAt) return undefined;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

/** SDK-OAuthTokens → connections-TokenSet (fuer die Persistenz). */
function toTokenSet(tokens: OAuthTokens): TokenSet {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || 'Bearer',
    scope: tokens.scope,
    expiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
  };
}

/** connections-TokenSet → SDK-OAuthTokens (beim Laden). */
function toOAuthTokens(ts: TokenSet): OAuthTokens {
  return {
    access_token: ts.accessToken,
    token_type: ts.tokenType || 'Bearer',
    refresh_token: ts.refreshToken,
    scope: ts.scope,
    expires_in: secondsUntil(ts.expiresAt),
  };
}

function connectedStatus(): ConnectionStatus {
  return { status: 'connected', lastChecked: new Date().toISOString() };
}

export interface McpOAuthProviderOptions {
  userId: string;
  serverId: string;
  /** Basis-URL des Backends fuer die Callback-Redirect-URI. */
  baseUrl: string;
  /** Im Callback: der zuvor gespeicherte PKCE-Verifier. */
  seededCodeVerifier?: string;
}

export class McpOAuthClientProvider implements OAuthClientProvider {
  private readonly userId: string;
  private readonly serverId: string;
  private readonly baseUrl: string;
  private _codeVerifier?: string;
  private _state?: string;
  /** Wird von redirectToAuthorization() gesetzt und von der /connect-Route gelesen. */
  authorizationUrl?: URL;

  constructor(opts: McpOAuthProviderOptions) {
    this.userId = opts.userId;
    this.serverId = opts.serverId;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this._codeVerifier = opts.seededCodeVerifier;
  }

  get redirectUrl(): string {
    return `${this.baseUrl}/api/mcp/servers/${this.serverId}/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Agent Platform',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  /** Erzeugt + persistiert den OAuth-State (ohne Verifier — der kommt via saveCodeVerifier). */
  async state(): Promise<string> {
    const state = randomBytes(32).toString('hex');
    this._state = state;
    const now = new Date();
    const oauthState: OAuthState = {
      providerId: mcpConnectionProviderId(this.serverId),
      userId: this.userId,
      redirectUri: this.redirectUrl,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_EXPIRY_MS).toISOString(),
    };
    await saveOAuthState(state, oauthState);
    return state;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const server = await getMcpServer(this.serverId);
    return server?.oauthClient;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    // DCR-Ergebnis pro Server ablegen (nicht pro User), damit nicht jeder User neu registriert.
    await updateMcpServer(this.serverId, {
      oauthClient: {
        client_id: info.client_id,
        client_secret: (info as { client_secret?: string }).client_secret,
        client_id_issued_at: (info as { client_id_issued_at?: number }).client_id_issued_at,
        client_secret_expires_at: (info as { client_secret_expires_at?: number }).client_secret_expires_at,
      },
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const conn = await loadConnection(this.userId, mcpConnectionProviderId(this.serverId));
    if (!conn) return undefined;
    return toOAuthTokens(conn.tokens);
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await saveConnection(
      this.userId,
      mcpConnectionProviderId(this.serverId),
      toTokenSet(tokens),
      connectedStatus(),
    );
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Server-seitiger Flow: URL merken, die /connect-Route gibt sie ans Frontend.
    this.authorizationUrl = authorizationUrl;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
    if (!this._state) return;
    // State-Row um den Verifier ergaenzen (onConflictDoUpdate im Storage).
    const now = new Date();
    await saveOAuthState(this._state, {
      providerId: mcpConnectionProviderId(this.serverId),
      userId: this.userId,
      redirectUri: this.redirectUrl,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_EXPIRY_MS).toISOString(),
      codeVerifier,
    });
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      throw new Error('Kein PKCE codeVerifier vorhanden (State abgelaufen oder ungueltig)');
    }
    return this._codeVerifier;
  }
}

export { loadOAuthState };
