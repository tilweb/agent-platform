/**
 * Cryptography utilities for secure token storage
 * Uses AES-256-GCM encryption
 */

import type { TokenSet, EncryptedTokenSet } from './types';

// Current encryption version for future-proofing
const ENCRYPTION_VERSION = 1;

// Get encryption key from environment
function getEncryptionKey(): Uint8Array {
  const keyHex = process.env.CONNECTION_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'CONNECTION_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      'CONNECTION_ENCRYPTION_KEY must be a 64-character hex string (256 bits). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Convert hex to Uint8Array
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = parseInt(keyHex.substr(i * 2, 2), 16);
  }

  return key;
}

/**
 * Encrypt a TokenSet using AES-256-GCM
 */
export async function encryptTokens(tokens: TokenSet): Promise<EncryptedTokenSet> {
  const key = getEncryptionKey();

  // Generate random IV (12 bytes for GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encode tokens as JSON
  const plaintext = new TextEncoder().encode(JSON.stringify(tokens));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    cryptoKey,
    plaintext
  );

  // GCM appends the tag to the ciphertext
  const ctArray = new Uint8Array(ciphertext);
  const encryptedData = ctArray.slice(0, -16);
  const tag = ctArray.slice(-16);

  return {
    encrypted: bufferToHex(encryptedData),
    iv: bufferToHex(iv),
    tag: bufferToHex(tag),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Decrypt an EncryptedTokenSet using AES-256-GCM
 */
export async function decryptTokens(encrypted: EncryptedTokenSet): Promise<TokenSet> {
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  const key = getEncryptionKey();

  // Parse hex strings back to Uint8Arrays
  const iv = hexToBuffer(encrypted.iv);
  const ciphertext = hexToBuffer(encrypted.encrypted);
  const tag = hexToBuffer(encrypted.tag);

  // Combine ciphertext and tag (GCM expects them together)
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
      tagLength: 128,
    },
    cryptoKey,
    combined
  );

  // Parse JSON
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as TokenSet;
}

/**
 * Convert Uint8Array to hex string
 */
function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new encryption key (for setup instructions)
 */
export function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes);
}
