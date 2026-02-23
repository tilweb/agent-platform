/**
 * Google Drive API URL Helpers
 */

export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function getDriveFilesUrl(): string {
  return `${GOOGLE_DRIVE_API_BASE}/files`;
}

export function getDriveFileUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_API_BASE}/files/${fileId}`;
}

export function getDriveExportUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_API_BASE}/files/${fileId}/export`;
}
