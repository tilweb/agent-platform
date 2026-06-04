/**
 * Connections Types and Interfaces
 */

import type { Tool } from '../tools/types';

/**
 * Authentication type for a provider
 */
export type AuthType = 'oauth2' | 'api-key' | 'client-credentials';

/**
 * OAuth2 Token Set
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType: string;
  scope?: string;
  // Atlassian-specific
  cloudId?: string;
  // Pipedrive-specific (user's company API domain)
  apiDomain?: string;
  // OIDC ID-Token-Claims (sub/name/email) — bei Providern mit openid-Scope
  // direkt aus dem id_token extrahiert, damit validateConnection ohne extra
  // API-Call den User anzeigen kann.
  userId?: string;
  userName?: string;
  userEmail?: string;
  // OIDC issuer aus dem id_token. Wird gebraucht um den userinfo-Endpoint
  // abzuleiten wenn der Provider Profile-Claims nicht im id_token mitschickt.
  oidcIssuer?: string;
  // Client-Credentials-Provider: gespeicherte Client-Credentials, um neue
  // Access-Tokens beim Ablauf zu holen. Liegt verschluesselt im Storage.
  clientId?: string;
  clientSecret?: string;
  // Personio (und ggf. andere Recruiting-APIs): zweiter, langlebiger
  // Bearer-Token fuer eine andere API-Version. Personio v1 (POST applications)
  // braucht einen separaten Recruiting-Access-Token aus den Personio-Settings.
  secondaryAccessToken?: string;
  // Personio (und ggf. andere): Company-ID die als Header bei API-Calls
  // mitgeschickt werden muss (z.B. X-Company-ID).
  companyId?: string;
}

/**
 * Encrypted token storage format
 */
export interface EncryptedTokenSet {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

/**
 * Connection status
 */
export type ConnectionStatusType = 'connected' | 'disconnected' | 'error' | 'expired';

export interface ConnectionStatus {
  status: ConnectionStatusType;
  lastChecked: string;
  expiresAt?: string;
  error?: string;
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

/**
 * Stored connection data
 */
export interface StoredConnection {
  providerId: string;
  userId: string;
  tokens: EncryptedTokenSet;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  // Optional: for providers that need additional params
  additionalAuthParams?: Record<string, string>;
  additionalTokenParams?: Record<string, string>;
  // Enable PKCE (Proof Key for Code Exchange) - required by some providers (e.g. YouTrack Hub)
  usePkce?: boolean;
  // Grant type: 'authorization_code' (default) or 'implicit' (token returned in URL fragment)
  grantType?: 'authorization_code' | 'implicit';
}

/**
 * Tool definition for connection providers
 */
export interface ConnectionTool extends Tool {
  // Connection tools have a special type
  readonly type: 'connection';
  // Reference to the provider
  readonly providerId: string;
}

/**
 * Specification fuer ein Setup-Feld bei Non-OAuth-Providern. Frontend
 * rendert die Felder im Connection-Setup-Modal anhand dieser Liste.
 */
export interface CredentialFieldSpec {
  /** Eindeutiger Schluessel — wird als Key beim connect()-Aufruf benutzt. */
  key: string;
  /** UI-Label (z.B. "Client ID"). */
  label: string;
  /** Hilfetext unterhalb des Feldes (Markdown nicht unterstuetzt — plain text). */
  helperText?: string;
  /** input type. `password` maskiert die Eingabe. */
  type: 'text' | 'password';
  /** Optional, ob das Feld im UI als optional markiert wird. */
  required?: boolean;
  /** Placeholder-Text. */
  placeholder?: string;
}

/**
 * Connection Provider Interface
 */
export interface ConnectionProvider {
  /** Unique provider identifier (e.g., 'confluence') */
  readonly id: string;

  /** Display name (e.g., 'Atlassian Confluence') */
  readonly name: string;

  /** Description of the provider */
  readonly description: string;

  /** Optional icon URL or data URI */
  readonly icon?: string;

  /** Authentication type */
  readonly authType: AuthType;

  /** Setup instructions (markdown) */
  readonly setupGuide?: string;

  // OAuth2 methods (required for oauth2 authType)

  /** Get the OAuth authorization URL (returns URL string or object with PKCE verifier) */
  getAuthUrl(state: string, redirectUri: string): string | { url: string; codeVerifier: string };

  /** Exchange authorization code for tokens */
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet>;

  /** Refresh an expired access token */
  refreshToken(refreshToken: string): Promise<TokenSet>;

  // Client-Credentials methods (required for client-credentials authType)

  /**
   * Beschreibung der Felder die der User im Setup-Modal ausfuellt
   * (Frontend rendert das dynamisch). Reihenfolge im Array = Reihenfolge im UI.
   */
  getCredentialFields?(): CredentialFieldSpec[];

  /**
   * Anhand der vom User eingegebenen Felder die Connection herstellen
   * (Token holen, validieren, TokenSet zum Speichern zurueckgeben).
   */
  connect?(input: Record<string, string>): Promise<TokenSet>;

  // Connection validation

  /** Validate that the connection is still working */
  validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;

  // Tools

  /** Get all tools provided by this connection */
  getTools(): ConnectionTool[];
}

/**
 * Provider registration info for the frontend
 */
export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  authType: AuthType;
  status?: ConnectionStatus;
  setupGuide?: string;
  /** Nur bei client-credentials-Providern: Felder fuer den Setup-Wizard. */
  credentialFields?: CredentialFieldSpec[];
  /** Global vom Admin fuer User freigeschaltet (steuert Sichtbarkeit im User-View). */
  enabledForUsers?: boolean;
  /** Provider ist einsatzbereit (OAuth-App/ENV vorhanden). Aktuell immer true. */
  configured?: boolean;
}

/**
 * OAuth state storage
 */
export interface OAuthState {
  providerId: string;
  userId: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
  // PKCE code verifier (stored when provider requires PKCE)
  codeVerifier?: string;
}
