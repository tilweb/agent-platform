/**
 * Jira OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Jira OAuth configuration from environment
 */
export function getJiraConfig(): OAuth2Config {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Jira OAuth credentials not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables.'
    );
  }

  return {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientId,
    clientSecret,
    scopes: [
      'read:me',
      'read:jira-work',
      'read:jira-user',
      'offline_access',
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
 * Get Jira API base URL for a cloud instance
 */
export function getJiraApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3`;
}
