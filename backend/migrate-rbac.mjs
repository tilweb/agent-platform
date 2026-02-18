/**
 * RBAC Migration Script
 *
 * Standalone migration script that doesn't require bun.
 * Run with: node migrate-rbac.mjs
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import * as yaml from 'yaml';

const DATA_DIR = resolve(process.cwd(), '../data');

// Resource data directories
const RESOURCE_DATA_DIRS = {
  project: 'projects',
  collection: 'knowledge-base/collections',
  contract: 'contracts',
  skill: 'skills/public',
  agent: 'agents',
};

/**
 * Get the directory path for a resource
 */
function getResourceDir(resourceType, resourceId) {
  const baseDir = RESOURCE_DATA_DIRS[resourceType];
  return join(DATA_DIR, baseDir, resourceId);
}

/**
 * Get the access file path for a resource
 */
function getAccessFilePath(resourceType, resourceId) {
  return join(getResourceDir(resourceType, resourceId), 'access.yaml');
}

/**
 * Ensure the resource directory exists
 */
async function ensureResourceDir(resourceType, resourceId) {
  const dir = getResourceDir(resourceType, resourceId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load all access entries for a resource
 */
async function loadResourceAccess(resourceType, resourceId) {
  const filePath = getAccessFilePath(resourceType, resourceId);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = yaml.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading access for ${resourceType}/${resourceId}:`, error);
    return [];
  }
}

/**
 * Save all access entries for a resource
 */
async function saveResourceAccess(resourceType, resourceId, accessList) {
  await ensureResourceDir(resourceType, resourceId);
  const filePath = getAccessFilePath(resourceType, resourceId);
  const yamlContent = yaml.stringify(accessList);
  await writeFile(filePath, yamlContent, 'utf-8');
}

/**
 * Check if a resource has any access entries
 */
async function hasAccessEntries(resourceType, resourceId) {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.length > 0;
}

/**
 * Grant access to a resource
 */
async function grantAccess(resourceType, resourceId, principalType, principalId, role, grantedBy) {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  // Check if entry already exists
  const existingIndex = accessList.findIndex(
    (a) => a.principalType === principalType && a.principalId === principalId
  );

  const now = new Date().toISOString();
  const newEntry = {
    principalType,
    principalId,
    role,
    grantedAt: now,
    grantedBy,
  };

  if (existingIndex >= 0) {
    accessList[existingIndex] = newEntry;
  } else {
    accessList.push(newEntry);
  }

  await saveResourceAccess(resourceType, resourceId, accessList);
  return newEntry;
}

/**
 * Initialize access for a new resource (sets creator as owner)
 */
async function initializeResourceAccess(resourceType, resourceId, creatorId) {
  const now = new Date().toISOString();
  const ownerEntry = {
    principalType: 'user',
    principalId: creatorId,
    role: 'owner',
    grantedAt: now,
    grantedBy: creatorId,
  };

  await saveResourceAccess(resourceType, resourceId, [ownerEntry]);
  return ownerEntry;
}

/**
 * Migrate project members to RBAC access entries
 */
async function migrateProjectMembers() {
  const projectsDir = join(DATA_DIR, 'projects');
  const result = { migrated: 0, skipped: 0, errors: [] };

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
        const project = yaml.parse(projectContent);

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
            member.role,
            member.addedBy || project.createdBy
          );
          console.log(`[RBAC Migration] Granted ${member.role} access to user ${member.userId} for project ${project.id}`);
        }

        console.log(`[RBAC Migration] Migrated ${project.members.length} members for project ${project.id}`);
        result.migrated++;
      } catch (error) {
        console.error(`[RBAC Migration] Error migrating project ${entry.id}:`, error);
        result.errors.push(`${entry.id}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('[RBAC Migration] Error reading projects index:', error);
    result.errors.push(`Index: ${error.message}`);
  }

  return result;
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('RBAC Migration - Migriere bestehende Project Members');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log('');

  const result = await migrateProjectMembers();

  console.log('');
  console.log('='.repeat(60));
  console.log('Migration abgeschlossen');
  console.log('='.repeat(60));
  console.log(`Migriert: ${result.migrated}`);
  console.log(`Übersprungen: ${result.skipped}`);
  console.log(`Fehler: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('');
    console.log('Fehlerdetails:');
    result.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  console.log('');
}

main().catch((error) => {
  console.error('Migration fehlgeschlagen:', error);
  process.exit(1);
});
