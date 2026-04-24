/**
 * API-Key service — creation, verification, revocation.
 *
 * Key raw format: `apk_<prefix8>.<secret22>` where
 *   - prefix8 is 8 base64url chars (6 random bytes) used for O(1) lookup
 *   - secret22 is 22 base64url chars (16 random bytes) hashed via Argon2id
 *
 * Only the hashed concatenation is persisted; raw is returned exactly once.
 */

import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../auth/password';
import { loadKeyById, loadKeyByPrefix, saveKey, listKeys } from './storage';
import type { ApiKey, ApiKeyRateLimit, ApiKeyScope } from '../types';

export interface CreateKeyParams {
  label: string;
  scope: ApiKeyScope;
  permissions: string[];
  rateLimit?: ApiKeyRateLimit;
  createdBy: string;
  expiresAt?: string | null;
}

export interface CreateKeyResult {
  key: ApiKey;
  rawKey: string;
}

const DEFAULT_RATE_LIMIT: ApiKeyRateLimit = { requests: 60, windowSec: 60 };

function generateId(): string {
  return `apk_${randomBytes(9).toString('base64url').replace(/[_-]/g, '').slice(0, 12)}`;
}

function generatePrefix(): string {
  return randomBytes(6).toString('base64url').replace(/[_-]/g, '').slice(0, 8);
}

function generateSecret(): string {
  return randomBytes(16).toString('base64url').replace(/[_-]/g, '').slice(0, 22);
}

export function composeRawKey(prefix: string, secret: string): string {
  return `apk_${prefix}.${secret}`;
}

export function parseRawKey(raw: string): { prefix: string; secret: string } | null {
  if (!raw.startsWith('apk_')) return null;
  const body = raw.slice(4);
  const dot = body.indexOf('.');
  if (dot < 1 || dot === body.length - 1) return null;
  return { prefix: body.slice(0, dot), secret: body.slice(dot + 1) };
}

export async function createKey(params: CreateKeyParams): Promise<CreateKeyResult> {
  const id = generateId();
  const prefix = generatePrefix();
  const secret = generateSecret();
  const rawKey = composeRawKey(prefix, secret);
  const hashedKey = await hashPassword(`${prefix}.${secret}`);

  const key: ApiKey = {
    id,
    label: params.label,
    hashedKey,
    prefix,
    scope: params.scope,
    permissions: params.permissions,
    rateLimit: params.rateLimit ?? DEFAULT_RATE_LIMIT,
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy,
    lastUsedAt: null,
    expiresAt: params.expiresAt ?? null,
    isActive: true,
    revokedAt: null,
  };

  await saveKey(key);
  return { key, rawKey };
}

export async function verifyRawKey(raw: string): Promise<ApiKey | null> {
  const parsed = parseRawKey(raw);
  if (!parsed) return null;
  const key = await loadKeyByPrefix(parsed.prefix);
  if (!key) return null;
  if (!key.isActive || key.revokedAt) return null;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;
  const ok = await verifyPassword(`${parsed.prefix}.${parsed.secret}`, key.hashedKey);
  if (!ok) return null;
  return key;
}

export async function revokeKey(id: string): Promise<ApiKey | null> {
  const key = await loadKeyById(id);
  if (!key) return null;
  key.isActive = false;
  key.revokedAt = new Date().toISOString();
  await saveKey(key);
  return key;
}

const lastUsedWriteCache = new Map<string, number>();
const LAST_USED_DEBOUNCE_MS = 60 * 1000;

export async function touchLastUsed(id: string): Promise<void> {
  const now = Date.now();
  const lastWritten = lastUsedWriteCache.get(id) ?? 0;
  if (now - lastWritten < LAST_USED_DEBOUNCE_MS) return;
  lastUsedWriteCache.set(id, now);

  const key = await loadKeyById(id);
  if (!key) return;
  key.lastUsedAt = new Date().toISOString();
  await saveKey(key);
}

export { listKeys };
