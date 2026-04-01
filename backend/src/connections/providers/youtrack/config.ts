/**
 * YouTrack OAuth Configuration
 *
 * YouTrack Cloud uses Hub for OAuth2 authentication.
 * OAuth endpoints are instance-specific (require YOUTRACK_URL).
 */

import type { OAuth2Config } from '../../types';

/**
 * Get YouTrack OAuth configuration from environment
 */
export function getYouTrackConfig(): OAuth2Config {
  const clientId = process.env.YOUTRACK_CLIENT_ID;
  const clientSecret = process.env.YOUTRACK_CLIENT_SECRET;
  const baseUrl = getYouTrackBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error(
      'YouTrack OAuth credentials not configured. Set YOUTRACK_CLIENT_ID, YOUTRACK_CLIENT_SECRET, and YOUTRACK_URL environment variables.'
    );
  }

  return {
    authorizationUrl: `${baseUrl}/hub/api/rest/oauth2/auth`,
    tokenUrl: `${baseUrl}/hub/api/rest/oauth2/token`,
    clientId,
    clientSecret,
    scopes: process.env.YOUTRACK_SCOPE ? [process.env.YOUTRACK_SCOPE] : [],
    usePkce: true, // Hub requires PKCE for OAuth2 authorization code flow
    additionalAuthParams: {
      request_credentials: 'default', // Prevents Hub CSRF token issues in popup flows
    },
  };
}

/**
 * Get YouTrack base URL from environment
 */
export function getYouTrackBaseUrl(): string {
  const url = process.env.YOUTRACK_URL;
  if (!url) {
    throw new Error(
      'YOUTRACK_URL not configured. Set it to your YouTrack Cloud URL (e.g., https://firma.youtrack.cloud).'
    );
  }
  // Remove trailing slash
  return url.replace(/\/+$/, '');
}

/**
 * Get YouTrack REST API base URL
 */
export function getYouTrackApiUrl(): string {
  return `${getYouTrackBaseUrl()}/api`;
}
