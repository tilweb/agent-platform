/**
 * RBAC Migration Utilities
 *
 * Migrate existing data to the new RBAC system.
 */

import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { grantAccess, hasAccessEntries, initializeResourceAccess } from './storage';
import type { ResourceType, ResourceRole } from './types';
import { DATA_DIR } from '../utils/paths';

interface SpaceMember {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  addedAt: string;
  addedBy: string;
}

interface Space {
  id: string;
  name: string;
  createdBy: string;
  members: SpaceMember[];
}

/**
 * Migrate space members to RBAC access entries
 */
export async function migrateSpaceMembers(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const spacesDir = join(DATA_DIR, 'spaces');
  const result = { migrated: 0, skipped: 0, errors: [] as string[] };

  if (!existsSync(spacesDir)) {
    console.log('[RBAC Migration] No spaces directory found');
    return result;
  }

  // Read spaces index
  const indexPath = join(spacesDir, 'spaces.yaml');
  if (!existsSync(indexPath)) {
    console.log('[RBAC Migration] No spaces index found');
    return result;
  }

  try {
    const indexContent = await readFile(indexPath, 'utf-8');
    const index = yaml.parse(indexContent);

    if (!index?.spaces) {
      console.log('[RBAC Migration] Empty spaces index');
      return result;
    }

    for (const entry of index.spaces) {
      const spacePath = join(spacesDir, entry.id, 'space.yaml');

      if (!existsSync(spacePath)) {
        console.log(`[RBAC Migration] Space file not found: ${entry.id}`);
        continue;
      }

      try {
        // Check if already migrated
        if (await hasAccessEntries('space', entry.id)) {
          console.log(`[RBAC Migration] Space ${entry.id} already has RBAC entries, skipping`);
          result.skipped++;
          continue;
        }

        const spaceContent = await readFile(spacePath, 'utf-8');
        const space = yaml.parse(spaceContent) as Space;

        if (!space.members || space.members.length === 0) {
          // No members, just initialize with creator as owner
          if (space.createdBy) {
            await initializeResourceAccess('space', space.id, space.createdBy);
            console.log(`[RBAC Migration] Initialized access for space ${space.id} with creator ${space.createdBy}`);
            result.migrated++;
          }
          continue;
        }

        // Migrate each member
        for (const member of space.members) {
          await grantAccess(
            'space',
            space.id,
            'user',
            member.userId,
            member.role as ResourceRole,
            member.addedBy || space.createdBy
          );
        }

        console.log(`[RBAC Migration] Migrated ${space.members.length} members for space ${space.id}`);
        result.migrated++;
      } catch (error: any) {
        console.error(`[RBAC Migration] Error migrating space ${entry.id}:`, error);
        result.errors.push(`${entry.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('[RBAC Migration] Error reading spaces index:', error);
    result.errors.push(`Index: ${error.message}`);
  }

  return result;
}

/**
 * Initialize RBAC for all existing skills
 * Creator info might not be available, so we'll initialize with a default
 */
export async function migrateSkills(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const skillsDir = join(DATA_DIR, 'skills/public');
  const result = { migrated: 0, skipped: 0, errors: [] as string[] };

  if (!existsSync(skillsDir)) {
    console.log('[RBAC Migration] No skills directory found');
    return result;
  }

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillId = entry.name;

      try {
        // Check if already has access entries
        if (await hasAccessEntries('skill', skillId)) {
          console.log(`[RBAC Migration] Skill ${skillId} already has RBAC entries, skipping`);
          result.skipped++;
          continue;
        }

        // Skills don't have creator info stored, so we skip them for now
        // They will get RBAC entries when they're next edited
        console.log(`[RBAC Migration] Skill ${skillId} has no creator info, skipping`);
        result.skipped++;
      } catch (error: any) {
        console.error(`[RBAC Migration] Error processing skill ${skillId}:`, error);
        result.errors.push(`${skillId}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('[RBAC Migration] Error reading skills directory:', error);
    result.errors.push(`Skills: ${error.message}`);
  }

  return result;
}

/**
 * Initialize RBAC for all existing agents
 * Similar to skills, creator info might not be available
 */
export async function migrateAgents(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const agentsDir = join(DATA_DIR, 'agents');
  const result = { migrated: 0, skipped: 0, errors: [] as string[] };

  if (!existsSync(agentsDir)) {
    console.log('[RBAC Migration] No agents directory found');
    return result;
  }

  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const agentId = entry.name;

      // Skip internal agents
      if (agentId.startsWith('_')) {
        console.log(`[RBAC Migration] Skipping internal agent ${agentId}`);
        continue;
      }

      try {
        // Check if already has access entries
        if (await hasAccessEntries('agent', agentId)) {
          console.log(`[RBAC Migration] Agent ${agentId} already has RBAC entries, skipping`);
          result.skipped++;
          continue;
        }

        // Agents don't have creator info stored, so we skip them for now
        console.log(`[RBAC Migration] Agent ${agentId} has no creator info, skipping`);
        result.skipped++;
      } catch (error: any) {
        console.error(`[RBAC Migration] Error processing agent ${agentId}:`, error);
        result.errors.push(`${agentId}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('[RBAC Migration] Error reading agents directory:', error);
    result.errors.push(`Agents: ${error.message}`);
  }

  return result;
}

/**
 * Run all migrations
 */
export async function runAllMigrations(): Promise<{
  spaces: { migrated: number; skipped: number; errors: string[] };
  skills: { migrated: number; skipped: number; errors: string[] };
  agents: { migrated: number; skipped: number; errors: string[] };
}> {
  console.log('[RBAC Migration] Starting migrations...');

  const spaces = await migrateSpaceMembers();
  console.log(`[RBAC Migration] Spaces: ${spaces.migrated} migrated, ${spaces.skipped} skipped, ${spaces.errors.length} errors`);

  const skills = await migrateSkills();
  console.log(`[RBAC Migration] Skills: ${skills.migrated} migrated, ${skills.skipped} skipped, ${skills.errors.length} errors`);

  const agents = await migrateAgents();
  console.log(`[RBAC Migration] Agents: ${agents.migrated} migrated, ${agents.skipped} skipped, ${agents.errors.length} errors`);

  console.log('[RBAC Migration] Migrations complete');

  return { spaces, skills, agents };
}
