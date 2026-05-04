/**
 * Personio Connection Configuration
 *
 * Personio hat zwei Recruiting-API-Versionen mit unterschiedlicher Auth:
 * - v2 (modern, Beta): Client-Credentials → Bearer-Token via /v2/auth/token,
 *   Scopes wie `personio:recruiting:read`. Lesender Zugriff auf Bewerbungen.
 * - v1 (klassisch, write-only): fester Access-Token aus Personio-Settings,
 *   Header `X-Company-ID`. Anlegen von Bewerbungen, Document-Upload.
 *
 * Wir kombinieren beides in einer Connection: v2-Token wird beim ersten
 * connect() ueber Client-Credentials geholt (auto-refresh bei Ablauf), v1-Token
 * + Company-ID werden statisch im TokenSet gespeichert.
 */

import type { ClientCredentialsConfig } from '../../base/ClientCredentialsProvider';

export const PERSONIO_API_BASE = 'https://api.personio.de';
export const PERSONIO_TOKEN_URL = `${PERSONIO_API_BASE}/v2/auth/token`;

export const PERSONIO_DEFAULT_SCOPES = ['personio:recruiting:read'];

export function getPersonioClientCredentialsConfig(): ClientCredentialsConfig {
  return {
    tokenUrl: PERSONIO_TOKEN_URL,
    defaultScopes: PERSONIO_DEFAULT_SCOPES,
  };
}
