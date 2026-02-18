/**
 * RBAC Migration Utilities
 *
 * Migrate existing data to the new RBAC system.
 */

import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import * as yaml from 'yaml';
import { grantAccess, hasAccessEntries, initializeResourceAccess } from './storage';
import type { ResourceType, ResourceRole } from './types';

// Use same path resolution as projects/storage.ts
const DATA_DIR = resolve(process.cwd(), '../data');

interface ProjectMember {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  addedAt: string;
  addedBy: string;
}

interface Project {
  id: string;
  name: string;
  createdBy: string;
  members: ProjectMember[];
}

/**
 * Migrate project members to RBAC access entries
 */
export async function migrateProjectMembers(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const projectsDir = join(DATA_DIR, 'projects');
  const result = { migrated: 0, skipped: 0, errors: [] as string[] };

  if (!existsSync(projectsDir)) {
    console.log('[RBAC Migration] No projects directory found');
    return result;
  }

  // Read projects index
  const indexPath = join(projectsDir, 'projects.yaml');
  if (!existsSync(indexPath)) {
    console.log('[RBAC Migration] No projects index found');
    return result;
  }

  try {
    const indexContent = await readFile(indexPath, 'utf-8');
    const index = yaml.parse(indexContent);

    if (!index?.projects) {
      console.log('[RBAC Migration] Empty projects index');
      return result;
    }

    for (const entry of index.projects) {
      const projectPath = join(projectsDir, entry.id, 'project.yaml');

      if (!existsSync(projectPath)) {
        console.log(`[RBAC Migration] Project file not found: ${entry.id}`);
        continue;
      }

      try {
        // Check if already migrated
        if (await hasAccessEntries('project', entry.id)) {
          console.log(`[RBAC Migration] Project ${entry.id} already has RBAC entries, skipping`);
          result.skipped++;
          continue;
        }

        const projectContent = await readFile(projectPath, 'utf-8');
        const project = yaml.parse(projectContent) as Project;

        if (!project.members || project.members.length === 0) {
          // No members, just initialize with creator as owner
          if (project.createdBy) {
            await initializeResourceAccess('project', project.id, project.createdBy);
            console.log(`[RBAC Migration] Initialized access for project ${project.id} with creator ${project.createdBy}`);
            result.migrated++;
          }
          continue;
        }

        // Migrate each member
        for (const member of project.members) {
          await grantAccess(
            'project',
            project.id,
            'user',
            member.userId,
            member.role as ResourceRole,
            member.addedBy || project.createdBy
          );
        }

        console.log(`[RBAC Migration] Migrated ${project.members.length} members for project ${project.id}`);
        result.migrated++;
      } catch (error: any) {
        console.error(`[RBAC Migration] Error migrating project ${entry.id}:`, error);
        result.errors.push(`${entry.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('[RBAC Migration] Error reading projects index:', error);
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
  projects: { migrated: number; skipped: number; errors: string[] };
  skills: { migrated: number; skipped: number; errors: string[] };
  agents: { migrated: number; skipped: number; errors: string[] };
}> {
  console.log('[RBAC Migration] Starting migrations...');

  const projects = await migrateProjectMembers();
  console.log(`[RBAC Migration] Projects: ${projects.migrated} migrated, ${projects.skipped} skipped, ${projects.errors.length} errors`);

  const skills = await migrateSkills();
  console.log(`[RBAC Migration] Skills: ${skills.migrated} migrated, ${skills.skipped} skipped, ${skills.errors.length} errors`);

  const agents = await migrateAgents();
  console.log(`[RBAC Migration] Agents: ${agents.migrated} migrated, ${agents.skipped} skipped, ${agents.errors.length} errors`);

  console.log('[RBAC Migration] Migrations complete');

  return { projects, skills, agents };
}
