/**
 * Apps Registry Service
 * Manages app registration and activation
 */

import { parse, stringify } from 'yaml';
import type { AppsRegistry, AppConfig, AppInfo } from './types';
import { vertragsmanagementConfig } from './vertragsmanagement';
import { projektmanagementConfig } from './projektmanagement';
import { lieferantenmanagementConfig } from './lieferantenmanagement';
import { vsmConfig } from './vsm';
import { wzbarMatcherConfig } from './wzbar-matcher';

const REGISTRY_PATH = './data/apps/registry.yaml';

/**
 * All built-in apps bundled with the backend. On server startup,
 * `syncBuiltInApps()` ensures every entry here exists in the registry.
 * Existing entries are NOT overwritten — admin `enabled` state is preserved.
 */
const BUILT_IN_APPS: AppConfig[] = [
  vertragsmanagementConfig,
  projektmanagementConfig,
  lieferantenmanagementConfig,
  vsmConfig,
  wzbarMatcherConfig,
];

let registryCache: AppsRegistry | null = null;

/**
 * Get default registry with built-in apps
 */
function getDefaultRegistry(): AppsRegistry {
  return {
    apps: {
      vertragsmanagement: {
        id: 'vertragsmanagement',
        name: 'Vertragsmanagement',
        description: 'Verträge hochladen, analysieren und verwalten',
        icon: 'contract',
        version: '1.0.0',
        enabled: true,
        routes: [
          { path: '/apps/vertragsmanagement', component: 'ContractsPage' },
          { path: '/apps/vertragsmanagement/upload', component: 'UploadPage' },
          { path: '/apps/vertragsmanagement/:id', component: 'ContractDetail' },
        ],
      },
      projektmanagement: {
        id: 'projektmanagement',
        name: 'Projektmanagement',
        description: 'Projektaufträge erstellen, analysieren und verwalten',
        icon: 'briefcase',
        version: '1.0.0',
        enabled: true,
        routes: [
          { path: '/apps/projektmanagement', component: 'ProjektePage' },
          { path: '/apps/projektmanagement/neu', component: 'WizardPage' },
          { path: '/apps/projektmanagement/:id', component: 'WizardPage' },
        ],
      },
    },
  };
}

/**
 * Load apps registry from file
 */
export async function loadRegistry(): Promise<AppsRegistry> {
  if (registryCache) {
    return registryCache;
  }

  const file = Bun.file(REGISTRY_PATH);

  if (await file.exists()) {
    try {
      const content = await file.text();
      registryCache = parse(content) as AppsRegistry;
      return registryCache;
    } catch (error) {
      console.error('Error loading apps registry:', error);
    }
  }

  // Create default registry
  registryCache = getDefaultRegistry();
  await saveRegistry(registryCache);
  return registryCache;
}

/**
 * Save apps registry to file
 */
export async function saveRegistry(registry: AppsRegistry): Promise<void> {
  registryCache = registry;
  await Bun.write(REGISTRY_PATH, stringify(registry));
}

/**
 * Get all registered apps
 */
export async function getApps(): Promise<AppInfo[]> {
  const registry = await loadRegistry();
  return Object.values(registry.apps);
}

/**
 * Get enabled apps only
 */
export async function getEnabledApps(): Promise<AppInfo[]> {
  const apps = await getApps();
  return apps.filter(app => app.enabled);
}

/**
 * Get a specific app by ID
 */
export async function getApp(appId: string): Promise<AppInfo | null> {
  const registry = await loadRegistry();
  return registry.apps[appId] || null;
}

/**
 * Enable an app (admin only)
 */
export async function enableApp(appId: string): Promise<AppConfig | null> {
  const registry = await loadRegistry();

  if (!registry.apps[appId]) {
    return null;
  }

  registry.apps[appId].enabled = true;
  await saveRegistry(registry);
  return registry.apps[appId];
}

/**
 * Disable an app (admin only)
 */
export async function disableApp(appId: string): Promise<AppConfig | null> {
  const registry = await loadRegistry();

  if (!registry.apps[appId]) {
    return null;
  }

  registry.apps[appId].enabled = false;
  await saveRegistry(registry);
  return registry.apps[appId];
}

/**
 * Register a new app
 */
export async function registerApp(config: AppConfig): Promise<AppConfig> {
  const registry = await loadRegistry();

  if (registry.apps[config.id]) {
    throw new Error(`App with ID "${config.id}" already exists`);
  }

  registry.apps[config.id] = config;
  await saveRegistry(registry);
  return config;
}

/**
 * Unregister an app
 */
export async function unregisterApp(appId: string): Promise<boolean> {
  const registry = await loadRegistry();

  if (!registry.apps[appId]) {
    return false;
  }

  delete registry.apps[appId];
  await saveRegistry(registry);
  return true;
}

/**
 * Clear registry cache (for testing/reload)
 */
export function clearCache(): void {
  registryCache = null;
}

/**
 * Ensure every built-in app is present in the registry. Idempotent.
 * New built-in apps get added (with their default `enabled` state).
 * Existing entries keep their current `enabled` flag (admin choice).
 * Static fields (name, description, icon, routes, version) get refreshed
 * from code, so rename/icon changes in the codebase roll out automatically.
 *
 * This decouples app availability from Docker volume-sync quirks.
 */
export async function syncBuiltInApps(): Promise<{ added: string[]; updated: string[] }> {
  const registry = await loadRegistry();
  const added: string[] = [];
  const updated: string[] = [];

  for (const config of BUILT_IN_APPS) {
    const existing = registry.apps[config.id];
    if (!existing) {
      registry.apps[config.id] = { ...config };
      added.push(config.id);
      continue;
    }
    // Refresh static fields but preserve the admin-controlled `enabled` flag.
    const merged: AppConfig = {
      ...config,
      enabled: existing.enabled,
    };
    const changed = JSON.stringify(merged) !== JSON.stringify(existing);
    if (changed) {
      registry.apps[config.id] = merged;
      updated.push(config.id);
    }
  }

  if (added.length > 0 || updated.length > 0) {
    await saveRegistry(registry);
    console.log(`[apps] Built-in sync — added: [${added.join(', ')}], updated: [${updated.join(', ')}]`);
  }

  return { added, updated };
}
