/**
 * Confluence OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Confluence OAuth configuration from environment
 */
export function getConfluenceConfig(): OAuth2Config {
  const clientId = process.env.CONFLUENCE_CLIENT_ID;
  const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Confluence OAuth credentials not configured. Set CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET environment variables.'
    );
  }

  return {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientId,
    clientSecret,
    scopes: [
      'read:me',
      // Classic scopes (needed for V1 CQL search)
      'read:confluence-content.all',
      'read:confluence-space.summary',
      // Granular scopes for V2 API (pages, spaces)
      'read:page:confluence',
      'read:space:confluence',
      'read:content:confluence',
      'read:content.metadata:confluence',
      'search:confluence',
      'offline_access', // For refresh tokens
    ],
    additionalAuthParams: {
      audience: 'api.atlassian.com',
      prompt: 'consent',
    },
  };
}

/**
 * Atlassian API base URL
 */
export const ATLASSIAN_API_BASE = 'https://api.atlassian.com';

/**
 * Get accessible resources URL (to find cloud ID)
 */
export function getAccessibleResourcesUrl(): string {
  return `${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`;
}

/**
 * Get Confluence API base URL for a cloud instance
 */
export function getConfluenceApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2`;
}

/**
 * Get Confluence REST API v1 URL (for some endpoints)
 */
export function getConfluenceRestApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/rest/api`;
}
