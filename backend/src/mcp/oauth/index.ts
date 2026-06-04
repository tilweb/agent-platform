/**
 * MCP OAuth — High-Level-Helfer fuer den per-User-OAuth-Flow.
 *
 * Kapselt den SDK-`auth()`-Orchestrator (Discovery → DCR → PKCE → Token) hinter
 * zwei Funktionen, die von den /oauth/connect- und /oauth/callback-Routes
 * benutzt werden.
 */

import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { getMcpServer } from '../config';
import { loadOAuthState, deleteOAuthState } from '../../connections';
import { McpOAuthClientProvider, mcpConnectionProviderId } from './provider';

function resolveBaseUrl(): string {
  return (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export interface StartResult {
  status: 'redirect' | 'already_connected';
  authUrl?: string;
}

/**
 * Startet den OAuth-Flow fuer (userId, serverId). Ergebnis ist entweder eine
 * Authorization-URL (Frontend oeffnet sie im Popup) oder `already_connected`,
 * wenn schon gueltige Token vorliegen.
 */
export async function startMcpOAuth(userId: string, serverId: string): Promise<StartResult> {
  const server = await getMcpServer(serverId);
  if (!server) throw new Error(`MCP-Server "${serverId}" nicht gefunden`);
  if (server.auth !== 'oauth') throw new Error(`MCP-Server "${serverId}" nutzt kein OAuth`);
  if (!server.url) throw new Error(`MCP-Server "${serverId}" hat keine URL`);

  const provider = new McpOAuthClientProvider({ userId, serverId, baseUrl: resolveBaseUrl() });
  const result = await auth(provider, { serverUrl: server.url });

  if (result === 'AUTHORIZED') {
    return { status: 'already_connected' };
  }
  if (!provider.authorizationUrl) {
    throw new Error('OAuth-Flow lieferte keine Authorization-URL');
  }
  return { status: 'redirect', authUrl: provider.authorizationUrl.toString() };
}

export interface FinishResult {
  userId: string;
  serverId: string;
}

/**
 * Schliesst den OAuth-Flow im Callback ab: validiert den State, tauscht den Code
 * gegen Token und speichert sie pro User. Gibt die userId zurueck.
 */
export async function finishMcpOAuth(
  serverId: string,
  state: string,
  code: string,
): Promise<FinishResult> {
  const oauthState = await loadOAuthState(state);
  if (!oauthState) throw new Error('Ungueltiger oder abgelaufener State');
  if (oauthState.providerId !== mcpConnectionProviderId(serverId)) {
    throw new Error('Server-Mismatch im OAuth-State');
  }

  const server = await getMcpServer(serverId);
  if (!server?.url) throw new Error(`MCP-Server "${serverId}" nicht gefunden oder ohne URL`);

  const provider = new McpOAuthClientProvider({
    userId: oauthState.userId,
    serverId,
    baseUrl: resolveBaseUrl(),
    seededCodeVerifier: oauthState.codeVerifier,
  });

  const result = await auth(provider, { serverUrl: server.url, authorizationCode: code });
  if (result !== 'AUTHORIZED') {
    throw new Error(`OAuth-Abschluss unerwartet: ${result}`);
  }

  // State ist Einmal-Gebrauch.
  await deleteOAuthState(state);

  return { userId: oauthState.userId, serverId };
}

export { McpOAuthClientProvider, mcpConnectionProviderId } from './provider';
