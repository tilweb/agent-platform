/**
 * Storage service for Custom API Tools — Postgres-backed (Drizzle).
 * Frueher JSON-Files unter data/tools/custom/, jetzt `custom_tools.tools`.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { customTools } from '../../db/schema/custom_tools';
import type { CustomToolConfig } from './types';

let toolsCache: Map<string, CustomToolConfig> | null = null;

function rowToConfig(row: typeof customTools.$inferSelect): CustomToolConfig {
  // Stammdaten in Spalten, Rest in `config`-jsonb.
  const cfg = (row.config ?? {}) as Partial<CustomToolConfig>;
  return {
    ...cfg,
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as CustomToolConfig;
}

export async function loadCustomTools(): Promise<CustomToolConfig[]> {
  if (toolsCache) return Array.from(toolsCache.values());
  const db = getDb();
  const rows = await db.select().from(customTools);
  toolsCache = new Map();
  const result: CustomToolConfig[] = [];
  for (const row of rows) {
    const cfg = rowToConfig(row);
    if (cfg.id && cfg.name && (cfg as { endpoint?: string }).endpoint) {
      result.push(cfg);
      toolsCache.set(cfg.id, cfg);
    }
  }
  console.log(`Loaded ${result.length} custom API tools`);
  return result;
}

export async function getCustomTool(toolId: string): Promise<CustomToolConfig | null> {
  if (toolsCache?.has(toolId)) return toolsCache.get(toolId) || null;
  const db = getDb();
  const rows = await db.select().from(customTools).where(eq(customTools.id, toolId)).limit(1);
  return rows[0] ? rowToConfig(rows[0]) : null;
}

export async function saveCustomTool(config: CustomToolConfig): Promise<CustomToolConfig> {
  if (!/^[a-z0-9_-]+$/.test(config.id)) {
    throw new Error('Tool ID must contain only lowercase letters, numbers, hyphens and underscores');
  }
  const now = new Date().toISOString();
  if (!config.createdAt) config.createdAt = now;
  config.updatedAt = now;

  const db = getDb();
  await db.insert(customTools).values({
    id: config.id,
    name: config.name,
    description: config.description,
    enabled: config.enabled ?? true,
    config: config as never,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }).onConflictDoUpdate({
    target: customTools.id,
    set: {
      name: config.name,
      description: config.description,
      enabled: config.enabled ?? true,
      config: config as never,
      updatedAt: config.updatedAt,
    },
  });

  if (toolsCache) toolsCache.set(config.id, config);
  return config;
}

export async function createCustomTool(config: CustomToolConfig): Promise<CustomToolConfig> {
  const existing = await getCustomTool(config.id);
  if (existing) throw new Error(`Tool with ID "${config.id}" already exists`);
  return saveCustomTool(config);
}

export async function updateCustomTool(
  toolId: string,
  updates: Partial<CustomToolConfig>,
): Promise<CustomToolConfig> {
  const existing = await getCustomTool(toolId);
  if (!existing) throw new Error(`Tool "${toolId}" not found`);
  const updated: CustomToolConfig = {
    ...existing,
    ...updates,
    id: toolId,
    createdAt: existing.createdAt,
  };
  return saveCustomTool(updated);
}

export async function deleteCustomTool(toolId: string): Promise<void> {
  const db = getDb();
  const res = await db.delete(customTools).where(eq(customTools.id, toolId)).returning({ id: customTools.id });
  if (res.length === 0) throw new Error(`Tool "${toolId}" not found`);
  if (toolsCache) toolsCache.delete(toolId);
}

export function clearCustomToolsCache(): void {
  toolsCache = null;
}

export async function customToolExists(toolId: string): Promise<boolean> {
  if (toolsCache) return toolsCache.has(toolId);
  const tool = await getCustomTool(toolId);
  return tool !== null;
}
