/**
 * YouTrack OAuth Configuration
 *
 * YouTrack Cloud uses built-in Hub which only supports the Implicit OAuth2 flow.
 * The client_id is the YouTrack service ID from Hub (not a separate service).
 * No client_secret is needed for the implicit flow.
 *
 * See: https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html
 */

import type { OAuth2Config } from '../../types';

/**
 * Get YouTrack OAuth configuration from environment
 */
export function getYouTrackConfig(): OAuth2Config {
  const baseUrl = getYouTrackBaseUrl();

  // For implicit flow, client_id is the YouTrack service ID in Hub
  const clientId = process.env.YOUTRACK_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'YOUTRACK_CLIENT_ID not configured. Set it to the YouTrack service ID from Hub (Services → YouTrack → Client-ID).'
    );
  }

  return {
    authorizationUrl: `${baseUrl}/hub/api/rest/oauth2/auth`,
    tokenUrl: '', // Not used in implicit flow
    clientId,
    clientSecret: '', // Not used in implicit flow
    scopes: ['YouTrack'], // Symbolic name per docs
    grantType: 'implicit',
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
