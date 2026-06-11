/**
 * Google Docs & Sheets OAuth Configuration
 *
 * Nutzt die ZENTRALE Adacor-Google-App (GOOGLE_CLIENT_ID/SECRET) — dieselbe wie
 * Google Drive/Mail. Scope ist bewusst `drive.file` (non-sensitive) → KEINE
 * Google-Verifizierung nötig, auch in Production. Damit kann der Agent eigene
 * Sheets/Docs anlegen und voll lesen+schreiben (sowie per Picker freigegebene
 * Dateien) — aber nicht beliebige bestehende Privatdateien.
 */

import type { OAuth2Config } from '../../types';

export function getGoogleWorkspaceConfig(): OAuth2Config {
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
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalAuthParams: {
      access_type: 'offline', // Refresh-Tokens
      prompt: 'consent',
    },
  };
}

export const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
export const DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
