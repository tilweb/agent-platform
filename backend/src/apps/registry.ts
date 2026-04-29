/**
 * Apps Registry Service
 * Manages app registration and activation — Postgres-backed (Drizzle).
 *
 * Built-in App-Configs (vertragsmanagement, ..., wzbar-matcher) sind im Code
 * definiert und werden via syncBuiltInApps() idempotent in `apps.registry`
 * eingespielt. Die admin-kontrollierte enabled-Flag wird in der DB persistiert.
 * Die ENABLED_APPS-ENV-Whitelist wirkt zusaetzlich zur Laufzeit (clamp on read).
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { appsRegistry } from '../db/schema/apps';
import type { AppsRegistry, AppConfig, AppInfo } from './types';
import { vertragsmanagementConfig } from './vertragsmanagement';
import { projektmanagementConfig } from './projektmanagement';
import { lieferantenmanagementConfig } from './lieferantenmanagement';
import { vsmConfig } from './vsm';
import { wzbarMatcherConfig } from './wzbar-matcher';

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
const CACHE_TTL_MS = 30_000;
let cacheLoadedAt = 0;

function rowToConfig(row: typeof appsRegistry.$inferSelect): AppConfig {
  // Built-in configs werden ueber BUILT_IN_APPS angereichert (publicFunctions
  // sind funktion-handler-Referenzen und kommen NICHT aus der DB). Die DB
  // liefert nur den admin-state (enabled) und Stammdaten.
  const builtin = BUILT_IN_APPS.find(a => a.id === row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    icon: row.icon ?? '',
    version: row.version ?? '1.0.0',
    enabled: row.enabled,
    routes: (row.routes ?? []) as AppConfig['routes'],
    publicFunctions: builtin?.publicFunctions,
  };
}

/**
 * Load registry from DB. Cached fuer CACHE_TTL_MS — Reads sind Hot-Path
 * (Sidebar, Apps-Launcher), DB-Roundtrip auf jedem Request waere overkill.
 */
export async function loadRegistry(): Promise<AppsRegistry> {
  if (registryCache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return registryCache;
  }
  const db = getDb();
  const rows = await db.select().from(appsRegistry);
  const apps: Record<string, AppConfig> = {};
  for (const row of rows) apps[row.id] = rowToConfig(row);
  registryCache = { apps };
  cacheLoadedAt = Date.now();
  return registryCache;
}

/**
 * Save full registry (rare path — admin-edit). Idempotent.
 */
export async function saveRegistry(registry: AppsRegistry): Promise<void> {
  const db = getDb();
  for (const cfg of Object.values(registry.apps)) {
    const now = new Date().toISOString();
    await db.insert(appsRegistry).values({
      id: cfg.id,
      name: cfg.name,
      description: cfg.description ?? null,
      icon: cfg.icon ?? null,
      version: cfg.version ?? null,
      enabled: cfg.enabled,
      routes: cfg.routes as never,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: appsRegistry.id,
      set: {
        name: cfg.name,
        description: cfg.description ?? null,
        icon: cfg.icon ?? null,
        version: cfg.version ?? null,
        enabled: cfg.enabled,
        routes: cfg.routes as never,
        updatedAt: now,
      },
    });
  }
  registryCache = registry;
  cacheLoadedAt = Date.now();
}

function invalidateCache(): void {
  cacheLoadedAt = 0;
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
 * Returntype `AppConfig` (incl. publicFunctions) — der Caller soll publicFunctions
 * fuer das Public-API-Permission-Catalog erreichen koennen.
 */
export async function getApps(): Promise<AppConfig[]> {
  const registry = await loadRegistry();
  return Object.values(registry.apps).map(applyEnvFilter);
}

/**
 * Get enabled apps only — bereits ENV-gefiltert.
 */
export async function getEnabledApps(): Promise<AppConfig[]> {
  const apps = await getApps();
  return apps.filter(app => app.enabled);
}

/**
 * Get a specific app by ID — runtime ENV-Filter angewendet.
 */
export async function getApp(appId: string): Promise<AppConfig | null> {
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
  const db = getDb();
  const res = await db.delete(appsRegistry).where(eq(appsRegistry.id, appId)).returning({ id: appsRegistry.id });
  invalidateCache();
  return res.length > 0;
}

/**
 * Clear registry cache (for testing/reload)
 */
export function clearCache(): void {
  registryCache = null;
  cacheLoadedAt = 0;
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
