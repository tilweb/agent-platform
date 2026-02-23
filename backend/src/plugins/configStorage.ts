/**
 * Plugin Config Storage
 *
 * Encrypted storage for plugin configuration (OAuth credentials, API keys, etc.).
 * Secret fields are individually AES-256-GCM encrypted, non-secret fields stored as plain YAML.
 */

import { join, dirname } from 'path';
import { CONNECTIONS_CONNECTORS_DIR } from '../utils/paths';
import { encryptData, decryptData, isEncryptionConfigured } from '../connections/crypto';
import { loadYaml, saveYaml, deleteYaml, ensureDir } from '../utils/yamlStorage';
import type { ConfigField, StoredPluginConfig, EncryptedConfigField } from './types';

const MASK = '••••••••';

// Per-plugin file locks to prevent concurrent read-modify-write races
const configLocks = new Map<string, Promise<void>>();

async function withConfigLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = configLocks.get(lockKey) || Promise.resolve();
  const myLock = new Promise<void>((resolve) => { release = resolve; });
  configLocks.set(lockKey, myLock);
  await prev;
  try {
    return await fn();
  } finally {
    release!();
    if (configLocks.get(lockKey) === myLock) {
      configLocks.delete(lockKey);
    }
  }
}

function configPath(pluginId: string, userId?: string): string {
  const baseDir = join(CONNECTIONS_CONNECTORS_DIR, pluginId);
  if (userId) {
    return join(baseDir, `${userId}.yaml`);
  }
  return join(baseDir, 'credentials.yaml');
}

/**
 * Save plugin configuration. Secret fields are encrypted with AES-256-GCM.
 */
export async function savePluginConfig(
  pluginId: string,
  configSchema: ConfigField[],
  values: Record<string, any>,
  configuredBy?: string,
  userId?: string
): Promise<void> {
  const path = configPath(pluginId, userId);
  return withConfigLock(path, async () => {
    if (!isEncryptionConfigured()) {
      throw new Error('Encryption not configured. Set CONNECTION_ENCRYPTION_KEY.');
    }

    const secretKeys = new Set(
      configSchema.filter(f => f.secret).map(f => f.key)
    );

    // Build stored values — encrypt secrets individually
    const storedValues: Record<string, any> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === '') continue;

      // Skip masked values (means "keep existing")
      if (secretKeys.has(key) && value === MASK) continue;

      if (secretKeys.has(key)) {
        storedValues[key] = await encryptData(value);
      } else {
        storedValues[key] = value;
      }
    }

    // Merge with existing config to preserve unchanged secret values
    const existing = await loadRawConfig(pluginId, userId);
    if (existing) {
      for (const key of secretKeys) {
        if (!(key in storedValues) && existing.values[key]) {
          storedValues[key] = existing.values[key];
        }
      }
    }

    const config: StoredPluginConfig = {
      pluginId,
      values: storedValues,
      configuredAt: new Date().toISOString(),
      configuredBy,
    };

    await ensureDir(dirname(path));
    await saveYaml(path, config);
  });
}

/**
 * Load plugin config with secrets decrypted (for internal use / OAuth flows).
 */
export async function loadPluginConfig(
  pluginId: string,
  configSchema: ConfigField[],
  userId?: string
): Promise<Record<string, any> | null> {
  const raw = await loadRawConfig(pluginId, userId);
  if (!raw) return null;

  const secretKeys = new Set(
    configSchema.filter(f => f.secret).map(f => f.key)
  );

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw.values)) {
    if (secretKeys.has(key) && isEncryptedField(value)) {
      try {
        result[key] = await decryptData<string>(value as EncryptedConfigField, (parsed) => {
          if (typeof parsed !== 'string') throw new Error(`Expected string, got ${typeof parsed}`);
          return parsed;
        });
      } catch {
        console.error(`Failed to decrypt config field "${key}" for plugin "${pluginId}"`);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Load plugin config with secrets masked (for API responses).
 */
export async function loadPluginConfigMasked(
  pluginId: string,
  configSchema: ConfigField[],
  userId?: string
): Promise<{ values: Record<string, any>; configuredAt?: string; configuredBy?: string } | null> {
  const raw = await loadRawConfig(pluginId, userId);
  if (!raw) return null;

  const secretKeys = new Set(
    configSchema.filter(f => f.secret).map(f => f.key)
  );

  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw.values)) {
    if (secretKeys.has(key)) {
      masked[key] = MASK;
    } else {
      masked[key] = value;
    }
  }

  return {
    values: masked,
    configuredAt: raw.configuredAt,
    configuredBy: raw.configuredBy,
  };
}

/**
 * Delete plugin config.
 */
export async function deletePluginConfig(pluginId: string, userId?: string): Promise<boolean> {
  return deleteYaml(configPath(pluginId, userId));
}

/**
 * Check if a plugin has all required fields configured.
 */
export async function isPluginConfigured(
  pluginId: string,
  configSchema: ConfigField[],
  userId?: string
): Promise<boolean> {
  if (!configSchema || configSchema.length === 0) return true;

  const requiredKeys = configSchema.filter(f => f.required).map(f => f.key);
  if (requiredKeys.length === 0) return true;

  const raw = await loadRawConfig(pluginId, userId);
  if (!raw) return false;

  return requiredKeys.every(key => {
    const val = raw.values[key];
    return val !== undefined && val !== null && val !== '';
  });
}

/**
 * Resolve config with credential-mode fallback: user → company.
 */
export async function resolvePluginConfig(
  pluginId: string,
  configSchema: ConfigField[],
  userId?: string,
  credentialMode?: string
): Promise<Record<string, any> | null> {
  if (credentialMode === 'user' && userId) {
    return loadPluginConfig(pluginId, configSchema, userId);
  }
  if (credentialMode === 'both' && userId) {
    const userConfig = await loadPluginConfig(pluginId, configSchema, userId);
    if (userConfig) return userConfig;
  }
  return loadPluginConfig(pluginId, configSchema);
}

// ── Internal helpers ────────────────────────────────────────────────

async function loadRawConfig(pluginId: string, userId?: string): Promise<StoredPluginConfig | null> {
  return loadYaml<StoredPluginConfig>(configPath(pluginId, userId));
}

function isEncryptedField(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.encrypted === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.version === 'number'
  );
}
