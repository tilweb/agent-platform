/**
 * Google Mail OAuth Configuration
 */

import type { OAuth2Config } from '../../types';

/**
 * Get Google Mail OAuth configuration from environment
 */
export function getGoogleMailConfig(): OAuth2Config {
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
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  };
}

/**
 * Gmail API base URL
 */
export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Google User Info API URL
 */
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Get Gmail messages endpoint
 */
export function getMessagesUrl(): string {
  return `${GMAIL_API_BASE}/messages`;
}

/**
 * Get Gmail message by ID
 */
export function getMessageUrl(messageId: string): string {
  return `${GMAIL_API_BASE}/messages/${messageId}`;
}

/**
 * Get Gmail labels endpoint
 */
export function getLabelsUrl(): string {
  return `${GMAIL_API_BASE}/labels`;
}
