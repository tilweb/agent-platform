/**
 * Pipedrive OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Pipedrive OAuth configuration from environment
 */
export function getPipedriveConfig(): OAuth2Config {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Pipedrive OAuth credentials not configured. Set PIPEDRIVE_CLIENT_ID and PIPEDRIVE_CLIENT_SECRET environment variables.'
    );
  }

  return {
    authorizationUrl: 'https://oauth.pipedrive.com/oauth/authorize',
    tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
    clientId,
    clientSecret,
    scopes: [
      'base',
      'deals:read',
      'contacts:read',
      'activities:read',
      'organizations:read',
      'products:read',
      'users:read',
    ],
  };
}

/**
 * Build Pipedrive API URL for a user's domain
 * @param apiDomain - The user's API domain (e.g., "company-domain.pipedrive.com" or full URL)
 */
export function getPipedriveApiUrl(apiDomain: string): string {
  // Ensure we have a proper URL format
  if (apiDomain.startsWith('https://')) {
    return `${apiDomain}/api/v1`;
  }
  return `https://${apiDomain}/api/v1`;
}
