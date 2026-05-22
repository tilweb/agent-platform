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

  // Scopes — defaults sind unsere bisherige Adacor-Konfig, koennen pro
  // Tenant ueberschrieben werden (z.B. wenn ein Customer-IdP `dwprofile`
  // oder `offline_access` nicht freigeschaltet hat → IdP wirft sonst
  // `invalid_scope`). Format in DOCUWARE_SCOPES: space- oder kommagetrennt.
  const scopesEnv = process.env.DOCUWARE_SCOPES?.trim();
  const scopes = scopesEnv
    ? scopesEnv.split(/[\s,]+/).filter(Boolean)
    : [
        'docuware.platform',
        'openid',
        'dwprofile',
        'offline_access',
      ];

  return {
    authorizationUrl,
    tokenUrl,
    clientId,
    clientSecret,
    // openid + dwprofile fuer User-Info, offline_access fuer Refresh-Token.
    // Refresh-Token ist Voraussetzung fuer die langlebige Connection — ohne
    // offline_access laeuft der Access-Token nach 60 Min ab und der User
    // muss neu einloggen.
    scopes,
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

/**
 * Get single-document endpoint
 */
export function getDocumentUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string | number,
): string {
  return `${getDocumentsUrl(apiDomain, cabinetId)}/${documentId}`;
}

/**
 * Get sections endpoint for a document. Sections gruppieren ein Doc in mehrere
 * Files (Original + Anhaenge); fuer den Viewer brauchen wir mindestens die
 * erste Section, manche Tenants verlangen Section-IDs sogar fuer Page-Images.
 */
export function getDocumentSectionsUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string | number,
): string {
  return `${getDocumentUrl(apiDomain, cabinetId, documentId)}/Sections`;
}

/**
 * Get the rendered-image-per-page endpoint. DocuWare kennt sowohl
 * Doc-Level-Images (`/Image?page=N`) als auch Section-Level-Images
 * (`/Sections/{sectionId}/Image?page=N`); welcher Pfad funktioniert ist
 * tenant-/version-spezifisch. Die Backend-Route probiert beides der Reihe
 * nach durch.
 */
export function getDocumentPageImageUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string | number,
  page: number,
  sectionId?: string,
): string {
  const base = sectionId
    ? `${getDocumentUrl(apiDomain, cabinetId, documentId)}/Sections/${encodeURIComponent(sectionId)}`
    : getDocumentUrl(apiDomain, cabinetId, documentId);
  return `${base}/Image?page=${page}`;
}

/**
 * Get the thumbnail endpoint. Wie beim Page-Image kann Tenant entweder den
 * Doc-Level- oder Section-Level-Pfad anbieten.
 */
export function getDocumentThumbnailUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string | number,
  sectionId?: string,
): string {
  const base = sectionId
    ? `${getDocumentUrl(apiDomain, cabinetId, documentId)}/Sections/${encodeURIComponent(sectionId)}`
    : getDocumentUrl(apiDomain, cabinetId, documentId);
  return `${base}/Thumbnail`;
}

/**
 * Get the original-file-download endpoint. Liefert das Original-Binary
 * (PDF/Word/Image/…) ohne Conversion — geeignet fuer Browser-iframe oder
 * pdf.js-Embedding.
 */
export function getDocumentFileDownloadUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  documentId: string | number,
): string {
  return `${getDocumentUrl(apiDomain, cabinetId, documentId)}/FileDownload`;
}

/**
 * Get the dialogs-list endpoint for a cabinet. Dialogs sind das
 * Schema-Pendant zu DocuWare-Suchen: jeder Search-Dialog hat eine eigene
 * Feldauswahl + Operatoren-Set.
 */
export function getCabinetDialogsUrl(
  apiDomain: string | undefined,
  cabinetId: string,
): string {
  return `${getFileCabinetsUrl(apiDomain)}/${cabinetId}/Dialogs`;
}

/**
 * Get a single dialog's detail endpoint. Der Detail liefert die Felder-
 * Liste mit DBFieldName, DlgLabel, DWFieldType, SelectList-Hinweisen.
 */
export function getDialogDetailUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  dialogId: string,
  dialogType: string = 'Search',
): string {
  return `${getCabinetDialogsUrl(apiDomain, cabinetId)}/${encodeURIComponent(dialogId)}?dialogType=${encodeURIComponent(dialogType)}`;
}

/**
 * Get the select-list endpoint fuer ein einzelnes Feld. DocuWare liefert
 * die erlaubten Werte eines „Keyword"-Feldes (z.B. ART_DES_DOKUMENTES,
 * MANDANT) ueber die SelectListExpression. Returnt `{ Value: [...] }`.
 */
export function getFieldSelectListUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  dialogId: string,
  fieldName: string,
): string {
  return `${getDocuwareApiUrl(apiDomain)}/FileCabinets/${cabinetId}/Query/SelectListExpression?dialogId=${encodeURIComponent(dialogId)}&fieldName=${encodeURIComponent(fieldName)}`;
}

/**
 * Get the dialog-expression search endpoint. Strukturierte Suche per
 * POST-Body mit Conditions. Liegt unter `/DocuWare/Search/...` statt
 * `/DocuWare/Platform/...` — also nicht ueber getDocuwareApiUrl ableitbar.
 */
export function getDialogExpressionSearchUrl(
  apiDomain: string | undefined,
  cabinetId: string,
  dialogId: string,
  count: number = 20,
): string {
  const base = apiDomain || getDocuwareOrgUrl();
  const baseUrl = base.startsWith('https://') ? base : `https://${base}`;
  return `${baseUrl.replace(/\/+$/, '')}/DocuWare/Search/FileCabinets/${cabinetId}/Documents/DialogExpression?dialogId=${encodeURIComponent(dialogId)}&count=${count}`;
}
