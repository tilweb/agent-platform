/**
 * Base class for OAuth2 Client-Credentials providers.
 *
 * Im Gegensatz zu OAuthProvider (Authorization-Code mit User-Login) holt der
 * Provider hier seine Tokens ueber einen Service-zu-Service-Flow:
 *   POST <tokenUrl> grant_type=client_credentials & client_id & client_secret [+ scope]
 * Der zurueckgegebene Bearer-Token hat eine TTL (typisch 24h) und wird beim
 * Ablauf via getValidAccessToken() automatisch neu geholt.
 *
 * Provider-Spezifika (Personio braucht zusaetzlich einen v1-Recruiting-
 * Access-Token + Company-ID) werden ueber die abstract `connect()`-Methode
 * abgebildet — Subklassen entscheiden welche Felder vom User abgefragt werden
 * und wie das TokenSet aussieht.
 */

import { BaseConnectionProvider } from './ConnectionProvider';
import type { TokenSet, CredentialFieldSpec } from '../types';

export interface ClientCredentialsConfig {
  tokenUrl: string;
  /**
   * Default-Scopes die wir mit dem Token-Request senden. Provider darf das
   * pro Connect-Call ueberschreiben (z.B. wenn der User bestimmte Scopes
   * abwaehlt).
   */
  defaultScopes?: string[];
}

export abstract class ClientCredentialsProvider extends BaseConnectionProvider {
  abstract override readonly id: string;
  abstract override readonly name: string;
  abstract override readonly description: string;
  override readonly icon?: string;
  readonly authType = 'client-credentials' as const;

  /** Subklasse liefert die fuer den Token-Request noetigen URLs/Scopes. */
  protected abstract getClientCredentialsConfig(): ClientCredentialsConfig;

  /** Felder die der User im Setup-Modal ausfuellt. */
  abstract override getCredentialFields(): CredentialFieldSpec[];

  /**
   * Default-Implementation: nimmt die vom User eingegebenen Felder, ruft den
   * Token-Endpoint auf und gibt ein TokenSet zurueck. Subklasse darf das
   * ueberschreiben um zusaetzliche Felder zu mappen (z.B. Personio: v1-Token
   * + Company-ID in TokenSet packen).
   */
  override async connect(input: Record<string, string>): Promise<TokenSet> {
    const clientId = input.client_id?.trim();
    const clientSecret = input.client_secret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('client_id und client_secret sind erforderlich.');
    }
    const tokens = await this.fetchAccessToken(clientId, clientSecret);
    tokens.clientId = clientId;
    tokens.clientSecret = clientSecret;
    return tokens;
  }

  /**
   * Bei abgelaufenem Token einen frischen via Client-Credentials holen.
   * Wird von der Connection-Storage aufgerufen wenn validate/api-call ein
   * 401 sieht.
   */
  override async refreshToken(_refreshToken: string): Promise<TokenSet> {
    throw new Error(
      `${this.id}: refreshToken via refresh_token ist nicht implementiert. ` +
        `Bei Client-Credentials-Providern wird stattdessen refreshAccessToken() benutzt.`,
    );
  }

  /**
   * Holt einen frischen Access-Token mit den (gecacheten) Client-Credentials.
   * Erhaelt secondaryAccessToken/companyId aus dem alten TokenSet.
   */
  async refreshAccessToken(existing: TokenSet): Promise<TokenSet> {
    if (!existing.clientId || !existing.clientSecret) {
      throw new Error(
        `${this.id}: Client-Credentials fehlen im Token-Storage — neue Connection herstellen.`,
      );
    }
    const fresh = await this.fetchAccessToken(existing.clientId, existing.clientSecret);
    // ClientID/Secret + provider-spezifische Felder aus Existing uebernehmen.
    fresh.clientId = existing.clientId;
    fresh.clientSecret = existing.clientSecret;
    if (existing.secondaryAccessToken) fresh.secondaryAccessToken = existing.secondaryAccessToken;
    if (existing.companyId) fresh.companyId = existing.companyId;
    return fresh;
  }

  /**
   * POST <tokenUrl> grant_type=client_credentials & client_id & client_secret.
   * Subklasse kann das ueberschreiben fuer Provider-spezifische Body-Variationen.
   */
  protected async fetchAccessToken(clientId: string, clientSecret: string): Promise<TokenSet> {
    const config = this.getClientCredentialsConfig();
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    if (config.defaultScopes && config.defaultScopes.length > 0) {
      params.set('scope', config.defaultScopes.join(' '));
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Token request failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data = (await response.json()) as Record<string, any>;
    const expiresAt = data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
      : undefined;

    return {
      accessToken: data.access_token,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }
}
