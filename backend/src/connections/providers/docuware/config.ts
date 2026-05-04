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

  // DocuWare hat OAuth seit ~2024 auf zentrale IdP-Endpoints unter
  // login-emea.docuware.cloud/<tenant-id>/... migriert. Der alte Org-Pfad
  // /DocuWare/Platform/Account/Authorize wird teils von der WAF mit
  // "Request blocked by DocuWare firewall" abgewiesen. URLs werden in der
  // App-Registrierung in DocuWare angezeigt — bitte exakt uebernehmen.
  const authorizationUrl =
    process.env.DOCUWARE_AUTHORIZATION_URL ||
    `${orgUrl}/DocuWare/Platform/Account/Authorize`;
  const tokenUrl =
    process.env.DOCUWARE_TOKEN_URL ||
    `${orgUrl}/DocuWare/Platform/Account/Token`;

  return {
    authorizationUrl,
    tokenUrl,
    clientId,
    clientSecret,
    // openid + dwprofile fuer User-Info, offline_access fuer Refresh-Token.
    // Refresh-Token ist Voraussetzung fuer die langlebige Connection — ohne
    // offline_access laeuft der Access-Token nach 60 Min ab und der User
    // muss neu einloggen.
    scopes: [
      'docuware.platform',
      'openid',
      'dwprofile',
      'offline_access',
    ],
    // Kein prompt=consent — der neue DocuWare-IdP redirectet danach auf
    // /<tenant-id>/consent, das aber 404t. Ohne den Param geht der Flow
    // direkt vom Login zum Callback.
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
