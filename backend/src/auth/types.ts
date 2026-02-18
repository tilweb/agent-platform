/**
 * Authentication Types and Interfaces
 */

export type UserRole = 'admin' | 'user';

/**
 * User model preference for a specific purpose (chat, vision, etc.)
 */
export interface UserModelPreference {
  provider_id: string;
  model_id: string;
}

/**
 * User preferences stored in user YAML file
 */
export interface UserPreferences {
  models?: {
    chat?: UserModelPreference;
    vision?: UserModelPreference;
    tts?: UserModelPreference;
    stt?: UserModelPreference;
    text_to_image?: UserModelPreference;
    image_to_image?: UserModelPreference;
  };
}

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface UserWithoutPassword {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserWithoutPassword;
  session?: Session;
  error?: string;
}

// Session configuration
export const SESSION_CONFIG = {
  // Session expires after 3 days of inactivity (sliding session)
  // Session is extended on each authenticated request
  expiresInMs: 3 * 24 * 60 * 60 * 1000, // 3 days
  // Maximum absolute session lifetime (even with activity)
  maxAbsoluteLifetimeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  // Cookie name
  cookieName: 'session_id',
  // Cookie options
  cookieOptions: {
    httpOnly: true,
    // Always use Secure flag - modern browsers (Chrome, Firefox, Edge) treat
    // localhost as a "Secure Context" even over HTTP, so this works in development.
    // Note: Safari may require actual HTTPS - use mkcert for local HTTPS if needed.
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 3 * 24 * 60 * 60, // 3 days in seconds
  },
};

/**
 * Remove password hash from user object
 */
export function sanitizeUser(user: User): UserWithoutPassword {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
