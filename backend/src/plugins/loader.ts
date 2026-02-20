/**
 * Plugin Loader
 *
 * Scans and loads plugins from data/plugins/ directories.
 * All plugins (builtin + installed) live under data/plugins/.
 * Connector plugins with transport=inprocess are dynamically imported
 * and registered in the connection registry.
 * Called during backend initialization.
 */

import { join, normalize, resolve, sep } from 'path';
import { PLUGINS_DIR, PLUGINS_INSTALLED_DIR, PLUGINS_CONFIGS_DIR } from '../utils/paths';
import { loadYaml, ensureDir } from '../utils/yamlStorage';
import { pluginRegistry } from './registry';
import { connectionRegistry } from '../connections/registry';
import { toolRegistry } from '../tools/registry';
import { migrateEnvCredentials } from './migrateEnvCredentials';
import type { PluginManifest } from './types';

const PLUGINS_BUILTIN_DIR = join(PLUGINS_DIR, 'builtin');
const OLD_PLUGINS_CONFIGS_DIR = join(PLUGINS_DIR, 'configs');

/**
 * Load all plugins (builtin + installed).
 * Called once during backend startup.
 */
export async function loadAllPlugins(): Promise<void> {
  // Load persisted registry state first
  await pluginRegistry.load();

  // Migrate config files from old location if needed
  await migrateConfigDir();

  // Load builtin plugins from data/plugins/builtin/
  await loadPluginsFromDir(PLUGINS_BUILTIN_DIR, 'builtin');

  // Load installed plugins from data/plugins/installed/
  await loadPluginsFromDir(PLUGINS_INSTALLED_DIR, 'installed');

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
 * Migrate config files from old location (data/plugins/configs/)
 * to new location (data/config/plugins/).
 */
async function migrateConfigDir(): Promise<void> {
  try {
    const oldDir = Bun.file(OLD_PLUGINS_CONFIGS_DIR);
    // Check if old directory has files
    const glob = new Bun.Glob('*.yaml');
    let migrated = 0;

    await ensureDir(PLUGINS_CONFIGS_DIR);

    for await (const path of glob.scan(OLD_PLUGINS_CONFIGS_DIR)) {
      const oldPath = join(OLD_PLUGINS_CONFIGS_DIR, path);
      const newPath = join(PLUGINS_CONFIGS_DIR, path);

      // Only migrate if target doesn't exist yet
      const newFile = Bun.file(newPath);
      if (await newFile.exists()) continue;

      const oldFile = Bun.file(oldPath);
      if (await oldFile.exists()) {
        const content = await oldFile.text();
        await Bun.write(newPath, content);
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`Migrated ${migrated} plugin config(s) from data/plugins/configs/ to data/config/plugins/`);
    }
  } catch {
    // Old directory doesn't exist or scan failed — nothing to migrate
  }
}
