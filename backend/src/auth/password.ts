/**
 * Password Hashing with Bun's native Argon2 implementation
 */

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

/**
 * Check if a password hash needs to be rehashed
 * (e.g., if algorithm parameters have changed or using older algorithm)
 *
 * Current target: argon2id with m=65536, t=3
 */
export function needsRehash(hash: string): boolean {
  // Check if using argon2id
  if (!hash.startsWith('$argon2id$')) {
    return true;
  }

  // Parse argon2 parameters: $argon2id$v=19$m=65536,t=3,p=1$...
  const match = hash.match(/\$m=(\d+),t=(\d+),p=(\d+)\$/);
  if (!match || !match[1] || !match[2]) {
    return true;
  }

  const memoryCost = parseInt(match[1], 10);
  const timeCost = parseInt(match[2], 10);

  // Check if parameters match current settings
  // Allow minor variations (e.g., memoryCost within 10%)
  const targetMemoryCost = 65536;
  const targetTimeCost = 3;

  if (memoryCost < targetMemoryCost * 0.9 || timeCost < targetTimeCost) {
    return true;
  }

  return false;
}

/**
 * Verify password and return new hash if rehash is needed
 * Returns [isValid, newHashOrNull]
 */
export async function verifyAndRehash(password: string, hash: string): Promise<[boolean, string | null]> {
  const isValid = await verifyPassword(password, hash);

  if (!isValid) {
    return [false, null];
  }

  // Check if rehash is needed
  if (needsRehash(hash)) {
    const newHash = await hashPassword(password);
    return [true, newHash];
  }

  return [true, null];
}

/**
 * Common weak passwords that should be rejected
 */
const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty', 'qwertyui', 'qwerty123', 'letmein', 'welcome',
  'admin', 'admin123', 'root', 'toor', 'pass', 'test',
  'guest', 'master', 'changeme', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'sunshine', 'princess', 'football',
  'monkey', 'shadow', 'superman', 'michael', 'jennifer',
];

/**
 * Check if a password meets minimum requirements
 *
 * Requirements:
 * - 8-128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - Not a common weak password
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Length checks
  if (password.length < 8) {
    errors.push('Passwort muss mindestens 8 Zeichen lang sein');
  }

  if (password.length > 128) {
    errors.push('Passwort darf maximal 128 Zeichen lang sein');
  }

  // Complexity checks (only if length is valid to avoid confusing messages)
  if (password.length >= 8) {
    if (!/[a-z]/.test(password)) {
      errors.push('Passwort muss mindestens einen Kleinbuchstaben enthalten');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Passwort muss mindestens einen Großbuchstaben enthalten');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Passwort muss mindestens eine Zahl enthalten');
    }
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Dieses Passwort ist zu häufig und unsicher');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 32) {
    errors.push('Username must be at most 32 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
