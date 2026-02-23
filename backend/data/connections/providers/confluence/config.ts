/**
 * Confluence API URL Helpers
 */

export const ATLASSIAN_API_BASE = 'https://api.atlassian.com';

export function getAccessibleResourcesUrl(): string {
  return `${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`;
}

export function getConfluenceApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2`;
}

export function getConfluenceRestApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/rest/api`;
}
