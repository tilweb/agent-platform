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
 * Save apps registry to file. publicFunctions enthalten Handler-Funktionen
 * (kommen aus den Code-Modulen, nicht aus YAML) — die koennen nicht
 * serialisiert werden. Wir strippen sie vor dem Schreiben; beim Naechsten
 * Read ueber syncBuiltInApps werden sie wieder injiziert.
 */
export async function saveRegistry(registry: AppsRegistry): Promise<void> {
  registryCache = registry;
  const serializable: AppsRegistry = {
    apps: Object.fromEntries(
      Object.entries(registry.apps).map(([id, app]) => {
        const { publicFunctions: _ignore, ...rest } = app;
        void _ignore;
        return [id, rest as AppConfig];
      })
    ),
  };
  await Bun.write(REGISTRY_PATH, stringify(serializable));
}

/**
 * Apply runtime ENV-Whitelist filter — clamps `enabled` to false for apps
 * not in ENABLED_APPS (without persisting that into the registry file).
 * Admin-intent (the persisted enabled flag) bleibt erhalten.
 */
function applyEnvFilter<T extends AppInfo>(app: T): T {
  if (isAppEnvAllowed(app.id)) return app;
  return { ...app, enabled: false };
}

/**
 * Get all registered apps (runtime ENV-Filter angewendet).
 */
export async function getApps(): Promise<AppInfo[]> {
  const registry = await loadRegistry();
  return Object.values(registry.apps).map(applyEnvFilter);
}

/**
 * Get enabled apps only — bereits ENV-gefiltert.
 */
export async function getEnabledApps(): Promise<AppInfo[]> {
  const apps = await getApps();
  return apps.filter(app => app.enabled);
}

/**
 * Get a specific app by ID — runtime ENV-Filter angewendet.
 */
export async function getApp(appId: string): Promise<AppInfo | null> {
  const registry = await loadRegistry();
  const app = registry.apps[appId];
  return app ? applyEnvFilter(app) : null;
}

/**
 * Returns true if the app is allowed by the current ENABLED_APPS ENV-Whitelist
 * (or if no whitelist is set). Useful for UI-Hints und Permission-Checks.
 */
export function isAppEnvAllowed(appId: string): boolean {
  const whitelist = parseEnabledApps(process.env.ENABLED_APPS);
  return whitelist === null || whitelist.has(appId);
}

/**
 * Enable an app (admin only). Refuses if blocked by ENABLED_APPS ENV-Whitelist.
 * Returns the app on success, null when not found, or `'env-blocked'` when
 * the ENV does not permit enabling this app.
 */
export async function enableApp(appId: string): Promise<AppConfig | null | 'env-blocked'> {
  if (!isAppEnvAllowed(appId)) {
    return 'env-blocked';
  }
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
 * Parse the ENABLED_APPS ENV-Variable.
 * Returns a Set of app-ids when the variable is set (comma-separated list),
 * or null when not set. `null` means "no whitelist active — defer to per-app
 * `enabled` flag" (legacy behavior). Empty string is treated as "nothing
 * allowed" — all apps are forced disabled.
 */
function parseEnabledApps(raw: string | undefined): Set<string> | null {
  if (raw === undefined) return null;
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  return new Set(ids);
}

/**
 * Returns the set of app-ids allowed by the current ENABLED_APPS ENV (or null
 * for "no filter"). Exposed so other modules (UI, Public-API) can show a
 * "via ENV deaktiviert" hint or short-circuit checks.
 */
export function getEnvEnabledAppIds(): Set<string> | null {
  return parseEnabledApps(process.env.ENABLED_APPS);
}

/**
 * Ensure every built-in app is present in the registry. Idempotent.
 *
 * Behavior:
 * - Persisted `enabled`-Flag = Admin-Intent — wird NICHT vom ENV-Filter
 *   beeinflusst. Damit bleibt der Admin-Wunsch zwischen Deploys stabil.
 * - ENV-Whitelist (`ENABLED_APPS=app1,app2`) wirkt nur zur Laufzeit
 *   (siehe `applyEnvFilter` / `isAppEnvAllowed`) — clamped enabled auf
 *   false fuer nicht-whitelisted Apps, ohne die persistierte Konfiguration
 *   zu veraendern.
 * - Statische Felder (name, description, icon, routes, version) werden
 *   aus dem Code refreshed.
 */
export async function syncBuiltInApps(): Promise<{ added: string[]; updated: string[] }> {
  const registry = await loadRegistry();
  const envWhitelist = parseEnabledApps(process.env.ENABLED_APPS);
  const added: string[] = [];
  const updated: string[] = [];

  for (const config of BUILT_IN_APPS) {
    const existing = registry.apps[config.id];

    if (!existing) {
      registry.apps[config.id] = { ...config };
      added.push(config.id);
      continue;
    }
    // Refresh static fields, preserve admin-controlled `enabled` flag.
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
  }

  const filter = envWhitelist === null
    ? '(no ENV filter)'
    : `(ENV filter: ${[...envWhitelist].join(', ') || 'NONE'})`;
  if (added.length > 0 || updated.length > 0) {
    console.log(`[apps] Built-in sync ${filter} — added: [${added.join(', ')}], updated: [${updated.join(', ')}]`);
  } else if (envWhitelist !== null) {
    console.log(`[apps] Built-in sync ${filter} — no persisted changes`);
  }

  return { added, updated };
}
