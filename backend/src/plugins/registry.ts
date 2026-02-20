/**
 * Plugin Registry
 *
 * In-memory registry of all plugins (builtin + installed).
 * Persists enabled/configured status to data/plugins/registry.yaml.
 */

import { PLUGINS_REGISTRY_FILE } from '../utils/paths';
import { loadYaml, saveYaml } from '../utils/yamlStorage';
import { isPluginConfigured } from './configStorage';
import type { PluginManifest, PluginRegistryEntry, PluginSource, PluginType, PluginInfo } from './types';

interface PersistedRegistry {
  plugins: Record<string, PluginRegistryEntry>;
}

class PluginRegistry {
  private manifests = new Map<string, PluginManifest>();
  private entries = new Map<string, PluginRegistryEntry>();
  private loaded = false;

  /**
   * Load persisted state from disk.
   */
  async load(): Promise<void> {
    const data = await loadYaml<PersistedRegistry>(PLUGINS_REGISTRY_FILE);
    if (data?.plugins) {
      for (const [id, entry] of Object.entries(data.plugins)) {
        this.entries.set(id, entry);
      }
    }
    this.loaded = true;
  }

  /**
   * Persist current state to disk.
   */
  private async save(): Promise<void> {
    const plugins: Record<string, PluginRegistryEntry> = {};
    for (const [id, entry] of this.entries) {
      plugins[id] = entry;
    }
    await saveYaml(PLUGINS_REGISTRY_FILE, { plugins });
  }

  /**
   * Register a plugin manifest.
   */
  async register(manifest: PluginManifest, source: PluginSource): Promise<void> {
    this.manifests.set(manifest.id, manifest);

    // Merge with any persisted state
    const existing = this.entries.get(manifest.id);
    const configured = await isPluginConfigured(manifest.id, manifest.configSchema || []);

    const entry: PluginRegistryEntry = {
      id: manifest.id,
      type: manifest.type,
      source,
      enabled: existing?.enabled ?? true,
      configured,
      installedAt: existing?.installedAt ?? (source === 'installed' ? new Date().toISOString() : undefined),
      configuredAt: existing?.configuredAt,
      configuredBy: existing?.configuredBy,
    };

    this.entries.set(manifest.id, entry);
    await this.save();
  }

  /**
   * Unregister a plugin.
   */
  async unregister(pluginId: string): Promise<boolean> {
    const deleted = this.manifests.delete(pluginId) || this.entries.delete(pluginId);
    if (deleted) {
      this.entries.delete(pluginId);
      await this.save();
    }
    return deleted;
  }

  /**
   * Get a manifest by ID.
   */
  getManifest(pluginId: string): PluginManifest | undefined {
    return this.manifests.get(pluginId);
  }

  /**
   * Get a registry entry by ID.
   */
  getEntry(pluginId: string): PluginRegistryEntry | undefined {
    return this.entries.get(pluginId);
  }

  /**
   * Get plugin info for frontend (manifest + registry status combined).
   */
  getInfo(pluginId: string): PluginInfo | undefined {
    const manifest = this.manifests.get(pluginId);
    const entry = this.entries.get(pluginId);
    if (!manifest || !entry) return undefined;

    return {
      id: manifest.id,
      type: manifest.type,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      author: manifest.author,
      icon: manifest.icon,
      source: entry.source,
      enabled: entry.enabled,
      configured: entry.configured,
      configSchema: manifest.configSchema,
      setupGuide: manifest.setupGuide,
      connector: manifest.connector,
      configuredAt: entry.configuredAt,
    };
  }

  /**
   * List all plugins, optionally filtered.
   */
  list(filter?: { type?: PluginType; source?: PluginSource; enabled?: boolean }): PluginInfo[] {
    const results: PluginInfo[] = [];

    for (const [id] of this.manifests) {
      const info = this.getInfo(id);
      if (!info) continue;

      if (filter?.type && info.type !== filter.type) continue;
      if (filter?.source && info.source !== filter.source) continue;
      if (filter?.enabled !== undefined && info.enabled !== filter.enabled) continue;

      results.push(info);
    }

    return results;
  }

  /**
   * Set enabled status for a plugin.
   */
  async setEnabled(pluginId: string, enabled: boolean): Promise<boolean> {
    const entry = this.entries.get(pluginId);
    if (!entry) return false;

    entry.enabled = enabled;
    await this.save();
    return true;
  }

  /**
   * Update configured status (called after config save/delete).
   */
  async updateConfigured(pluginId: string, configured: boolean, configuredBy?: string): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) return;

    entry.configured = configured;
    entry.configuredAt = configured ? new Date().toISOString() : undefined;
    entry.configuredBy = configured ? configuredBy : undefined;
    await this.save();
  }

  /**
   * Check if plugin is configured.
   */
  isConfigured(pluginId: string): boolean {
    return this.entries.get(pluginId)?.configured ?? false;
  }

  /**
   * Check if plugin is enabled.
   */
  isEnabled(pluginId: string): boolean {
    return this.entries.get(pluginId)?.enabled ?? false;
  }

  /**
   * Get all registered IDs.
   */
  getIds(): string[] {
    return Array.from(this.manifests.keys());
  }

  /**
   * Clear all registrations (for testing).
   */
  clear(): void {
    this.manifests.clear();
    this.entries.clear();
  }
}

// Singleton
export const pluginRegistry = new PluginRegistry();
export { PluginRegistry };
