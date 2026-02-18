/**
 * Storage service for Custom API Tools
 * Persists tool configurations to JSON files
 */

import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { CustomToolConfig } from './types';

const CUSTOM_TOOLS_DIR = resolve(process.cwd(), '../data/tools/custom');

// In-memory cache
let toolsCache: Map<string, CustomToolConfig> | null = null;

/**
 * Ensure the custom tools directory exists
 */
async function ensureDirectory(): Promise<void> {
  if (!existsSync(CUSTOM_TOOLS_DIR)) {
    await mkdir(CUSTOM_TOOLS_DIR, { recursive: true });
  }
}

/**
 * Get the file path for a tool
 */
function getToolPath(toolId: string): string {
  return join(CUSTOM_TOOLS_DIR, `${toolId}.json`);
}

/**
 * Load all custom tool configurations
 */
export async function loadCustomTools(): Promise<CustomToolConfig[]> {
  if (toolsCache) {
    return Array.from(toolsCache.values());
  }

  await ensureDirectory();

  const tools: CustomToolConfig[] = [];
  toolsCache = new Map();

  if (!existsSync(CUSTOM_TOOLS_DIR)) {
    return tools;
  }

  const files = await readdir(CUSTOM_TOOLS_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const content = await readFile(join(CUSTOM_TOOLS_DIR, file), 'utf-8');
      const config = JSON.parse(content) as CustomToolConfig;

      // Validate required fields
      if (config.id && config.name && config.endpoint) {
        tools.push(config);
        toolsCache.set(config.id, config);
      }
    } catch (error) {
      console.error(`Error loading custom tool from ${file}:`, error);
    }
  }

  console.log(`Loaded ${tools.length} custom API tools`);
  return tools;
}

/**
 * Get a single custom tool by ID
 */
export async function getCustomTool(toolId: string): Promise<CustomToolConfig | null> {
  if (toolsCache) {
    return toolsCache.get(toolId) || null;
  }

  const toolPath = getToolPath(toolId);
  if (!existsSync(toolPath)) {
    return null;
  }

  try {
    const content = await readFile(toolPath, 'utf-8');
    return JSON.parse(content) as CustomToolConfig;
  } catch (error) {
    console.error(`Error loading custom tool ${toolId}:`, error);
    return null;
  }
}

/**
 * Save a custom tool configuration
 */
export async function saveCustomTool(config: CustomToolConfig): Promise<CustomToolConfig> {
  await ensureDirectory();

  // Validate ID format
  if (!/^[a-z0-9_-]+$/.test(config.id)) {
    throw new Error('Tool ID must contain only lowercase letters, numbers, hyphens and underscores');
  }

  // Set timestamps
  const now = new Date().toISOString();
  if (!config.createdAt) {
    config.createdAt = now;
  }
  config.updatedAt = now;

  // Save to file
  const toolPath = getToolPath(config.id);
  await writeFile(toolPath, JSON.stringify(config, null, 2), 'utf-8');

  // Update cache
  if (toolsCache) {
    toolsCache.set(config.id, config);
  }

  return config;
}

/**
 * Create a new custom tool
 */
export async function createCustomTool(config: CustomToolConfig): Promise<CustomToolConfig> {
  // Check if tool already exists
  const existing = await getCustomTool(config.id);
  if (existing) {
    throw new Error(`Tool with ID "${config.id}" already exists`);
  }

  return saveCustomTool(config);
}

/**
 * Update an existing custom tool
 */
export async function updateCustomTool(
  toolId: string,
  updates: Partial<CustomToolConfig>
): Promise<CustomToolConfig> {
  const existing = await getCustomTool(toolId);
  if (!existing) {
    throw new Error(`Tool "${toolId}" not found`);
  }

  // Merge updates
  const updated: CustomToolConfig = {
    ...existing,
    ...updates,
    id: toolId, // Prevent ID change
    createdAt: existing.createdAt, // Preserve creation time
  };

  return saveCustomTool(updated);
}

/**
 * Delete a custom tool
 */
export async function deleteCustomTool(toolId: string): Promise<void> {
  const toolPath = getToolPath(toolId);

  if (!existsSync(toolPath)) {
    throw new Error(`Tool "${toolId}" not found`);
  }

  await rm(toolPath);

  // Update cache
  if (toolsCache) {
    toolsCache.delete(toolId);
  }
}

/**
 * Clear the tools cache
 */
export function clearCustomToolsCache(): void {
  toolsCache = null;
}

/**
 * Check if a tool exists
 */
export async function customToolExists(toolId: string): Promise<boolean> {
  if (toolsCache) {
    return toolsCache.has(toolId);
  }
  return existsSync(getToolPath(toolId));
}
