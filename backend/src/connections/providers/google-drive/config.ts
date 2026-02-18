/**
 * Google Drive OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Google Drive OAuth configuration from environment
 */
export function getGoogleDriveConfig(): OAuth2Config {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
    );
  }

  return {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId,
    clientSecret,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalAuthParams: {
      access_type: 'offline', // For refresh tokens
      prompt: 'consent',
    },
  };
}

/**
 * Google Drive API base URL
 */
export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Google User Info API URL
 */
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Get Drive files endpoint
 */
export function getDriveFilesUrl(): string {
  return `${GOOGLE_DRIVE_API_BASE}/files`;
}

/**
 * Get Drive file content URL
 */
export function getDriveFileUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_API_BASE}/files/${fileId}`;
}

/**
 * Get Drive file export URL (for Google Docs)
 */
export function getDriveExportUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_API_BASE}/files/${fileId}/export`;
}
