/**
 * Docuware OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Docuware OAuth configuration from environment
 */
export function getDocuwareConfig(): OAuth2Config {
  const clientId = process.env.DOCUWARE_CLIENT_ID;
  const clientSecret = process.env.DOCUWARE_CLIENT_SECRET;
  const orgUrl = getDocuwareOrgUrl();

  if (!clientId || !clientSecret) {
    throw new Error(
      'Docuware OAuth credentials not configured. Set DOCUWARE_CLIENT_ID and DOCUWARE_CLIENT_SECRET environment variables.'
    );
  }

  if (!orgUrl) {
    throw new Error(
      'Docuware organization URL not configured. Set DOCUWARE_ORG_URL environment variable (e.g., https://myorg.docuware.cloud).'
    );
  }

  return {
    authorizationUrl: `${orgUrl}/DocuWare/Platform/Account/Authorize`,
    tokenUrl: `${orgUrl}/DocuWare/Platform/Account/Token`,
    clientId,
    clientSecret,
    scopes: [
      'docuware.platform',
    ],
    additionalAuthParams: {
      prompt: 'consent',
    },
  };
}

/**
 * Get Docuware organization URL from environment
 */
export function getDocuwareOrgUrl(): string {
  const orgUrl = process.env.DOCUWARE_ORG_URL || '';
  // Remove trailing slash
  return orgUrl.replace(/\/+$/, '');
}

/**
 * Get Docuware API base URL
 */
export function getDocuwareApiUrl(apiDomain?: string): string {
  const baseUrl = apiDomain || getDocuwareOrgUrl();
  if (!baseUrl) {
    throw new Error('Docuware API URL not available');
  }
  const url = baseUrl.startsWith('https://') ? baseUrl : `https://${baseUrl}`;
  return `${url.replace(/\/+$/, '')}/DocuWare/Platform`;
}

/**
 * Get file cabinets endpoint
 */
export function getFileCabinetsUrl(apiDomain?: string): string {
  return `${getDocuwareApiUrl(apiDomain)}/FileCabinets`;
}

/**
 * Get documents endpoint for a cabinet
 */
export function getDocumentsUrl(apiDomain: string | undefined, cabinetId: string): string {
  return `${getFileCabinetsUrl(apiDomain)}/${cabinetId}/Documents`;
}
