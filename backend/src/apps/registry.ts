/**
 * Apps Registry Service
 * Manages app registration and activation
 */

import { parse, stringify } from 'yaml';
import type { AppsRegistry, AppConfig, AppInfo } from './types';
import { APPS_REGISTRY } from '../utils/paths';

const REGISTRY_PATH = APPS_REGISTRY;

let registryCache: AppsRegistry | null = null;

// Mutex for registry read-modify-write
let registryLock: Promise<void> = Promise.resolve();

async function withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = registryLock;
  registryLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    registryCache = null;
    return await fn();
  } finally {
    release!();
  }
}

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
    appOrder: ['vertragsmanagement', 'projektmanagement'],
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
      const registry = parse(content) as AppsRegistry;

      // Initialize appOrder from existing keys if missing
      if (!registry.appOrder) {
        registry.appOrder = Object.keys(registry.apps);
      }

      registryCache = registry;
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
  const apps = Object.values(registry.apps);

  if (registry.appOrder) {
    const orderMap = new Map(registry.appOrder.map((id, i) => [id, i]));
    apps.sort((a, b) => {
      const ia = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }

  return apps;
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
  return withRegistryLock(async () => {
    const registry = await loadRegistry();

    if (!registry.apps[appId]) {
      return null;
    }

    registry.apps[appId].enabled = true;
    await saveRegistry(registry);
    return registry.apps[appId];
  });
}

/**
 * Disable an app (admin only)
 */
export async function disableApp(appId: string): Promise<AppConfig | null> {
  return withRegistryLock(async () => {
    const registry = await loadRegistry();

    if (!registry.apps[appId]) {
      return null;
    }

    registry.apps[appId].enabled = false;
    await saveRegistry(registry);
    return registry.apps[appId];
  });
}

/**
 * Reorder apps (admin only)
 */
export async function reorderApps(appIds: string[]): Promise<AppInfo[]> {
  return withRegistryLock(async () => {
    const registry = await loadRegistry();
    const existingIds = new Set(Object.keys(registry.apps));

    // Build ordered list: provided IDs first, then any remaining
    const ordered: string[] = [];
    for (const id of appIds) {
      if (existingIds.has(id)) {
        ordered.push(id);
        existingIds.delete(id);
      }
    }
    for (const id of existingIds) {
      ordered.push(id);
    }

    registry.appOrder = ordered;
    await saveRegistry(registry);

    // Return sorted apps
    const orderMap = new Map(ordered.map((id, i) => [id, i]));
    return Object.values(registry.apps).sort((a, b) => {
      const ia = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  });
}

/**
 * Register a new app
 */
export async function registerApp(config: AppConfig): Promise<AppConfig> {
  return withRegistryLock(async () => {
    const registry = await loadRegistry();

    if (registry.apps[config.id]) {
      throw new Error(`App with ID "${config.id}" already exists`);
    }

    registry.apps[config.id] = config;
    if (!registry.appOrder) {
      registry.appOrder = Object.keys(registry.apps);
    } else {
      registry.appOrder.push(config.id);
    }
    await saveRegistry(registry);
    return config;
  });
}

/**
 * Unregister an app
 */
export async function unregisterApp(appId: string): Promise<boolean> {
  return withRegistryLock(async () => {
    const registry = await loadRegistry();

    if (!registry.apps[appId]) {
      return false;
    }

    delete registry.apps[appId];
    if (registry.appOrder) {
      registry.appOrder = registry.appOrder.filter(id => id !== appId);
    }
    await saveRegistry(registry);
    return true;
  });
}

/**
 * Clear registry cache (for testing/reload)
 */
export function clearCache(): void {
  registryCache = null;
}
