/**
 * Pipedrive API URL Helpers
 */

export function getPipedriveApiUrl(apiDomain: string): string {
  if (apiDomain.startsWith('https://')) {
    return `${apiDomain}/api/v1`;
  }
  return `https://${apiDomain}/api/v1`;
}
