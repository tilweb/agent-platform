/**
 * Plugin Loader
 *
 * Scans and loads plugins from data/connections/connectors/.
 * Connector plugins with transport=inprocess are dynamically imported
 * and registered in the connection registry.
 * Called during backend initialization.
 */

import { join, normalize, resolve, sep, dirname } from 'path';
import { CONNECTIONS_DIR, CONNECTIONS_CONNECTORS_DIR, CONNECTIONS_TOKENS_DIR, CONNECTIONS_REGISTRY_FILE } from '../utils/paths';
import { loadYaml, ensureDir } from '../utils/yamlStorage';
import { pluginRegistry } from './registry';
import { connectionRegistry } from '../connections/registry';
import { toolRegistry } from '../tools/registry';
import { migrateEnvCredentials } from './migrateEnvCredentials';
import type { PluginManifest } from './types';

// Legacy paths for migrations
const LEGACY_PLUGINS_DIR = join(dirname(CONNECTIONS_DIR), 'plugins');
const LEGACY_PLUGINS_REGISTRY_FILE = join(LEGACY_PLUGINS_DIR, 'registry.yaml');
// Credentials were stored in two old locations before consolidation:
const LEGACY_CREDENTIAL_DIRS = [
  join(LEGACY_PLUGINS_DIR, 'configs'),       // oldest: data/plugins/configs/
  join(dirname(CONNECTIONS_DIR), 'config', 'plugins'), // intermediate: data/config/plugins/
];

/**
 * Load all plugins (builtin + installed).
 * Called once during backend startup.
 */
export async function loadAllPlugins(): Promise<void> {
  // Load persisted registry state first
  await pluginRegistry.load();

  // Run legacy migrations (all idempotent)
  await migratePluginCredentials();   // Legacy 1: data/plugins/configs/ + data/config/plugins/ → credentials.yaml
  await migrateRegistryFile();        // Legacy 2: data/plugins/registry.yaml → data/connections/registry.yaml
  await migrateTokensDir();           // Legacy 3: data/connections/{userId}/ → data/connections/tokens/{userId}/

  // Load plugins from data/connections/connectors/
  await loadPluginsFromDir(CONNECTIONS_CONNECTORS_DIR, 'builtin');

  // Run ENV credential migration (idempotent)
  await migrateEnvCredentials();

  // Sync disabled state to tool registry
  for (const plugin of pluginRegistry.list()) {
    if (!plugin.enabled) {
      toolRegistry.setPluginDisabled(plugin.id, true);
      console.log(`Plugin disabled at startup: ${plugin.id}`);
    }
  }

  const plugins = pluginRegistry.list();
  console.log(`Plugin system: ${plugins.length} plugin(s) loaded`);
}

/**
 * Scan a directory for plugin manifests, register them,
 * and dynamically load connector providers.
 */
async function loadPluginsFromDir(dir: string, source: 'builtin' | 'installed'): Promise<void> {
  await ensureDir(dir);

  const glob = new Bun.Glob('*/manifest.yaml');
  let count = 0;

  try {
    for await (const path of glob.scan(dir)) {
      const fullPath = join(dir, path);
      const pluginDir = join(dir, path.replace('/manifest.yaml', ''));
      try {
        const manifest = await loadYaml<PluginManifest>(fullPath);
        if (manifest?.id && manifest?.type) {
          await pluginRegistry.register(manifest, source);
          count++;

          // Dynamically load connector providers
          if (manifest.type === 'connector' &&
              manifest.connector?.transport === 'inprocess' &&
              manifest.connector?.entryPoint) {
            await loadConnectorProvider(pluginDir, manifest);
          }
        }
      } catch (error: any) {
        console.warn(`Failed to load ${source} plugin: ${path}`, error.message);
      }
    }
  } catch {
    // Directory scan failed
  }

  if (count > 0) {
    console.log(`Loaded ${count} ${source} plugin(s)`);
  }
}

/**
 * Dynamically import a connector's provider.ts and register it
 * in the connection registry.
 */
async function loadConnectorProvider(pluginDir: string, manifest: PluginManifest): Promise<void> {
  const entryPoint = resolve(pluginDir, manifest.connector!.entryPoint!);
  const normalizedDir = resolve(pluginDir) + sep;

  // Prevent path traversal — entryPoint must stay within pluginDir
  if (!entryPoint.startsWith(normalizedDir)) {
    console.error(`Blocked connector ${manifest.id}: entryPoint '${manifest.connector!.entryPoint}' resolves outside plugin directory`);
    return;
  }

  // Resolve symlinks and verify the real path is still within pluginDir
  try {
    const { realpath } = await import('fs/promises');
    const realEntryPoint = await realpath(entryPoint);
    const realPluginDir = await realpath(pluginDir);
    if (!realEntryPoint.startsWith(realPluginDir + sep)) {
      console.error(`Blocked connector ${manifest.id}: entryPoint symlink resolves outside plugin directory`);
      return;
    }
  } catch {
    // realpath fails if file doesn't exist yet — let import() handle the error
  }

  try {
    const module = await import(entryPoint);
    const provider = module.default;
    if (provider && typeof provider.id === 'string') {
      connectionRegistry.register(provider);
      console.log(`Loaded connector: ${manifest.id} from ${manifest.connector!.entryPoint}`);
    } else {
      console.warn(`Connector ${manifest.id}: no valid default export in ${entryPoint}`);
    }
  } catch (error: any) {
    console.error(`Failed to load connector ${manifest.id}:`, error.message);
  }
}

/**
 * Legacy migration 1: Migrate credentials from old locations to per-connector credentials.yaml.
 * Scans both data/plugins/configs/ and data/config/plugins/ for {id}.yaml files.
 */
async function migratePluginCredentials(): Promise<void> {
  let migrated = 0;

  for (const legacyDir of LEGACY_CREDENTIAL_DIRS) {
    try {
      const glob = new Bun.Glob('*.yaml');

      for await (const path of glob.scan(legacyDir)) {
        const oldPath = join(legacyDir, path);
        const pluginId = path.replace('.yaml', '');
        const newPath = join(CONNECTIONS_CONNECTORS_DIR, pluginId, 'credentials.yaml');

        const newFile = Bun.file(newPath);
        if (await newFile.exists()) continue;

        const oldFile = Bun.file(oldPath);
        if (await oldFile.exists()) {
          await ensureDir(join(CONNECTIONS_CONNECTORS_DIR, pluginId));
          const content = await oldFile.text();
          await Bun.write(newPath, content);
          migrated++;
        }
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} plugin credential(s) to per-connector credentials.yaml`);
  }
}

/**
 * Legacy migration 2: data/plugins/registry.yaml → data/connections/registry.yaml
 */
async function migrateRegistryFile(): Promise<void> {
  try {
    const newFile = Bun.file(CONNECTIONS_REGISTRY_FILE);
    if (await newFile.exists()) return;

    const oldFile = Bun.file(LEGACY_PLUGINS_REGISTRY_FILE);
    if (await oldFile.exists()) {
      const content = await oldFile.text();
      await ensureDir(CONNECTIONS_DIR);
      await Bun.write(CONNECTIONS_REGISTRY_FILE, content);
      console.log('Migrated registry to data/connections/registry.yaml');
    }
  } catch {
    // Nothing to migrate
  }
}

/**
 * Legacy migration 3: data/connections/{userId}/ → data/connections/tokens/{userId}/
 * Only runs if tokens/ doesn't exist yet to avoid confusing user dirs with connector dirs.
 */
async function migrateTokensDir(): Promise<void> {
  try {
    const tokensDir = Bun.file(CONNECTIONS_TOKENS_DIR);
    // If tokens/ already exists, migration was already done
    const { existsSync } = await import('fs');
    if (existsSync(CONNECTIONS_TOKENS_DIR)) return;

    const { readdir, stat } = await import('fs/promises');
    let entries: string[];
    try {
      entries = await readdir(CONNECTIONS_DIR);
    } catch {
      return; // connections dir doesn't exist yet
    }

    let migrated = 0;
    await ensureDir(CONNECTIONS_TOKENS_DIR);

    for (const entry of entries) {
      // Skip known non-user dirs
      if (entry === 'connectors' || entry === 'tokens' || entry === 'registry.yaml') continue;

      const entryPath = join(CONNECTIONS_DIR, entry);
      const entryStat = await stat(entryPath);
      if (!entryStat.isDirectory()) continue;

      // This looks like a userId directory — move its contents
      const glob = new Bun.Glob('*.yaml');
      const newUserDir = join(CONNECTIONS_TOKENS_DIR, entry);
      await ensureDir(newUserDir);

      for await (const yamlFile of glob.scan(entryPath)) {
        const oldPath = join(entryPath, yamlFile);
        const newPath = join(newUserDir, yamlFile);

        const newFile = Bun.file(newPath);
        if (await newFile.exists()) continue;

        const oldFile = Bun.file(oldPath);
        if (await oldFile.exists()) {
          const content = await oldFile.text();
          await Bun.write(newPath, content);
          migrated++;
        }
      }
    }

    if (migrated > 0) {
      console.log(`Migrated ${migrated} connection(s) to data/connections/tokens/`);
    }
  } catch {
    // Nothing to migrate
  }
}
