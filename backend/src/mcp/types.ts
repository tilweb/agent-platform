/**
 * MCP Integration Types
 */

/**
 * Transport-Art eines MCP-Servers.
 * - `stdio`: lokaler Subprozess (command/args/env) — Default
 * - `http`:  Remote-Server via Streamable HTTP (z.B. offizieller Google Gmail MCP Server)
 * - `sse`:   Remote-Server via Server-Sent Events (Legacy-Remote-Transport)
 */
export type McpTransportType = 'stdio' | 'http' | 'sse';

/**
 * Auth-Modus eines Remote-MCP-Servers.
 * - `none` (Default): keine Auth oder statische Header (siehe `headers`)
 * - `oauth`: interaktiver OAuth-2.1-Flow pro User (Discovery + DCR + PKCE) via MCP-SDK.
 *   Token werden pro (User, Server) verschluesselt gespeichert. Nur fuer http/sse.
 */
export type McpAuthMode = 'none' | 'oauth';

/**
 * Per Dynamic Client Registration (RFC 7591) erhaltene Client-Credentials.
 * Gilt pro Server (nicht pro User) und wird nach dem ersten Connect persistiert,
 * damit nicht bei jedem User neu registriert wird.
 */
export interface McpOAuthClientInfo {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  /** Default 'stdio', wenn nicht gesetzt (Abwaertskompatibilitaet). */
  transport?: McpTransportType;
  // --- stdio (lokaler Prozess) ---
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // --- http / sse (Remote) ---
  /** Endpoint-URL fuer http/sse-Transport, z.B. https://gmailmcp.googleapis.com/... */
  url?: string;
  /** HTTP-Header fuer Remote-Transport. Werte koennen ${ENV_VAR} referenzieren (z.B. Authorization: Bearer ${GMAIL_TOKEN}). */
  headers?: Record<string, string>;
  /** Auth-Modus (Default 'none'). 'oauth' aktiviert den per-User-OAuth-Flow (nur http/sse). */
  auth?: McpAuthMode;
  /** Per DCR registrierte Client-Credentials (pro Server). Wird automatisch befuellt. */
  oauthClient?: McpOAuthClientInfo;
  enabled?: boolean;
  autoConnect?: boolean;
  timeout?: number;
}

export interface McpServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
  connectedAt?: number;
}

export interface McpToolInfo {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: Record<string, any>;
}

export interface McpServersConfig {
  servers: McpServerConfig[];
}

export interface McpCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
