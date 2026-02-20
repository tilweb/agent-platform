/**
 * ENV Credential Migration
 *
 * One-time, idempotent migration that reads OAuth credentials from
 * environment variables and stores them encrypted in plugin config storage.
 * After migration the ENV vars are no longer needed.
 */

import { isEncryptionConfigured } from '../connections/crypto';
import { savePluginConfig, isPluginConfigured } from './configStorage';
import { pluginRegistry } from './registry';
import type { ConfigField } from './types';

interface MigrationMapping {
  pluginId: string;
  envVars: Record<string, string>; // configField key → ENV variable name
}

const MIGRATIONS: MigrationMapping[] = [
  {
    pluginId: 'confluence',
    envVars: {
      clientId: 'CONFLUENCE_CLIENT_ID',
      clientSecret: 'CONFLUENCE_CLIENT_SECRET',
    },
  },
  {
    pluginId: 'google-drive',
    envVars: {
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET',
    },
  },
  {
    pluginId: 'pipedrive',
    envVars: {
      clientId: 'PIPEDRIVE_CLIENT_ID',
      clientSecret: 'PIPEDRIVE_CLIENT_SECRET',
    },
  },
];

/**
 * Migrate credentials from ENV to encrypted plugin config.
 * Skips plugins that are already configured.
 */
export async function migrateEnvCredentials(): Promise<void> {
  if (!isEncryptionConfigured()) return;

  for (const mapping of MIGRATIONS) {
    const manifest = pluginRegistry.getManifest(mapping.pluginId);
    if (!manifest?.configSchema) continue;

    // Skip if already configured
    const configured = await isPluginConfigured(mapping.pluginId, manifest.configSchema);
    if (configured) continue;

    // Collect values from ENV
    const values: Record<string, string> = {};
    let hasValues = false;

    for (const [configKey, envVar] of Object.entries(mapping.envVars)) {
      const value = process.env[envVar];
      if (value && !value.startsWith('your-')) {
        values[configKey] = value;
        hasValues = true;
      }
    }

    if (!hasValues) continue;

    // Check that all required fields have values
    const requiredKeys = manifest.configSchema
      .filter(f => f.required)
      .map(f => f.key);

    const allRequired = requiredKeys.every(key => values[key]);
    if (!allRequired) continue;

    try {
      await savePluginConfig(mapping.pluginId, manifest.configSchema, values, 'env-migration');
      await pluginRegistry.updateConfigured(mapping.pluginId, true, 'env-migration');
      console.log(`[Plugin Migration] Migrated ${mapping.pluginId} credentials from ENV to encrypted storage`);
    } catch (error: any) {
      console.warn(`[Plugin Migration] Failed to migrate ${mapping.pluginId}:`, error.message);
    }
  }
}
