/**
 * Knowledge Base Routes
 * REST API endpoints for collections management with RBAC
 */

import { Hono } from 'hono';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { authMiddleware, getCurrentUserId } from '../auth';
import { canView, canEdit, canDelete, canManageAccess, listAccessibleResources } from '../rbac/accessControl';
import { initializeResourceAccess, deleteResourceAccess, hasAccessEntries } from '../rbac/storage';

const knowledgeRoutes = new Hono();

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');
const COLLECTIONS_FILE = join(KB_BASE, 'collections.yaml');

// Ensure auth on all routes
knowledgeRoutes.use('/*', authMiddleware);

/**
 * Collection structure in YAML
 */
interface Collection {
  id: string;
  name: string;
  description: string;
  document_count: number;
  activate_when: string[];
  never_activate_when: string[];
}

interface CollectionsFile {
  collections: Collection[];
}

/**
 * Load collections.yaml
 */
async function loadCollections(): Promise<CollectionsFile> {
  if (!existsSync(COLLECTIONS_FILE)) {
    return { collections: [] };
  }
  const content = await readFile(COLLECTIONS_FILE, 'utf-8');
  return parseYaml(content) || { collections: [] };
}

/**
 * Save collections.yaml
 */
async function saveCollections(data: CollectionsFile): Promise<void> {
  const yaml = stringifyYaml(data);
  await writeFile(COLLECTIONS_FILE, yaml, 'utf-8');
}

/**
 * GET /api/knowledge/collections
 * List all collections the user has access to
 */
knowledgeRoutes.get('/collections', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const data = await loadCollections();

    // Get all collection IDs
    const collectionIds = data.collections.map((col) => col.id);

    // Filter by RBAC access
    const accessibleCollections = await listAccessibleResources(userId, 'collection', collectionIds);
    const accessibleIds = new Set(accessibleCollections.map((a) => a.resourceId));

    // Return only accessible collections with role info
    const collections = data.collections
      .filter((col) => accessibleIds.has(col.id))
      .map((col) => {
        const access = accessibleCollections.find((a) => a.resourceId === col.id);
        return {
          ...col,
          role: access?.role || 'viewer',
        };
      });

    return c.json({ collections });
  } catch (error: any) {
    console.error('List collections error:', error);
    return c.json({ error: 'Fehler beim Laden der Collections' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id
 * Get a single collection with manifest (documents)
 */
knowledgeRoutes.get('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Zugriff verweigert' }, 403);
    }

    // Read manifest file which contains documents
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    // Return manifest data (includes collection_id, collection_name, description, documents)
    return c.json({
      ...manifest,
      role: accessResult.effectiveRole,
    });
  } catch (error: any) {
    console.error('Get collection error:', error);
    return c.json({ error: 'Fehler beim Laden der Collection' }, 500);
  }
});

/**
 * POST /api/knowledge/collections
 * Create a new collection (creator becomes owner)
 */
knowledgeRoutes.post('/collections', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const body = await c.req.json();
    const { id, name, description, activate_when, never_activate_when } = body;

    if (!id || !name) {
      return c.json({ error: 'ID und Name sind erforderlich' }, 400);
    }

    // Validate ID format
    if (!/^[a-z0-9_-]+$/.test(id)) {
      return c.json({ error: 'ID darf nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche enthalten' }, 400);
    }

    // Check if collection already exists
    const data = await loadCollections();
    if (data.collections.find((col) => col.id === id)) {
      return c.json({ error: 'Collection mit dieser ID existiert bereits' }, 409);
    }

    // Create collection directory
    const collectionDir = join(KB_BASE, 'collections', id);
    if (!existsSync(collectionDir)) {
      await mkdir(collectionDir, { recursive: true });
    }

    // Create manifest
    const manifest = [
      `# Manifest für Collection: ${name}`,
      `collection_id: "${id}"`,
      `collection_name: "${name}"`,
      `description: "${description || ''}"`,
      `last_updated: "${new Date().toISOString()}"`,
      '',
      'documents: []',
    ].join('\n');
    await writeFile(join(collectionDir, 'manifest.yaml'), manifest, 'utf-8');

    // Add to collections.yaml
    const newCollection: Collection = {
      id,
      name,
      description: description || '',
      document_count: 0,
      activate_when: activate_when || [],
      never_activate_when: never_activate_when || [],
    };
    data.collections.push(newCollection);
    await saveCollections(data);

    // Initialize RBAC - creator becomes owner
    await initializeResourceAccess('collection', id, userId);

    return c.json({
      success: true,
      collection: newCollection,
    });
  } catch (error: any) {
    console.error('Create collection error:', error);
    return c.json({ error: 'Fehler beim Erstellen der Collection' }, 500);
  }
});

/**
 * PUT /api/knowledge/collections/:id
 * Update a collection
 */
knowledgeRoutes.put('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');

    // Check edit permission
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Keine Berechtigung zum Bearbeiten' }, 403);
    }

    const body = await c.req.json();
    const { name, description, activate_when, never_activate_when } = body;

    const data = await loadCollections();
    const index = data.collections.findIndex((col) => col.id === collectionId);

    if (index < 0) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    // Update collection
    const existing = data.collections[index];
    if (existing) {
      data.collections[index] = {
        ...existing,
        name: name ?? existing.name,
        description: description ?? existing.description,
        activate_when: activate_when ?? existing.activate_when,
        never_activate_when: never_activate_when ?? existing.never_activate_when,
      };
    }

    await saveCollections(data);

    // Update manifest as well
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (existsSync(manifestPath)) {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = parseYaml(manifestContent) || {};
      manifest.collection_name = name ?? manifest.collection_name;
      manifest.description = description ?? manifest.description;
      manifest.last_updated = new Date().toISOString();
      await writeFile(manifestPath, stringifyYaml(manifest), 'utf-8');
    }

    return c.json({
      success: true,
      collection: data.collections[index],
    });
  } catch (error: any) {
    console.error('Update collection error:', error);
    return c.json({ error: 'Fehler beim Aktualisieren der Collection' }, 500);
  }
});

/**
 * DELETE /api/knowledge/collections/:id
 * Delete a collection
 */
knowledgeRoutes.delete('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');

    // Check delete permission
    const accessResult = await canDelete(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Keine Berechtigung zum Löschen' }, 403);
    }

    const data = await loadCollections();
    const index = data.collections.findIndex((col) => col.id === collectionId);

    if (index < 0) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    // Remove from collections.yaml
    data.collections.splice(index, 1);
    await saveCollections(data);

    // Delete collection directory
    const collectionDir = join(KB_BASE, 'collections', collectionId);
    if (existsSync(collectionDir)) {
      await rm(collectionDir, { recursive: true });
    }

    // Delete RBAC entries
    await deleteResourceAccess('collection', collectionId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete collection error:', error);
    return c.json({ error: 'Fehler beim Löschen der Collection' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents
 * List documents in a collection
 */
knowledgeRoutes.get('/collections/:id/documents', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Zugriff verweigert' }, 403);
    }

    // Read manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    return c.json({
      collection_id: collectionId,
      documents: manifest.documents || [],
    });
  } catch (error: any) {
    console.error('List documents error:', error);
    return c.json({ error: 'Fehler beim Laden der Dokumente' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents/:docId
 * Get a specific document's metadata and content
 */
knowledgeRoutes.get('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Zugriff verweigert' }, 403);
    }

    // Find document path in manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    const doc = manifest.documents?.find((d: any) => d.document_id === docId);
    if (!doc) {
      return c.json({ error: 'Dokument nicht gefunden' }, 404);
    }

    // Read document meta and content
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', doc.path);

    let meta = null;
    let content = null;

    const metaPath = join(docDir, 'DOCUMENT_META.md');
    if (existsSync(metaPath)) {
      meta = await readFile(metaPath, 'utf-8');
    }

    const contentPath = join(docDir, 'content.md');
    if (existsSync(contentPath)) {
      content = await readFile(contentPath, 'utf-8');
    }

    return c.json({
      document: doc,
      meta,
      content,
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    return c.json({ error: 'Fehler beim Laden des Dokuments' }, 500);
  }
});

/**
 * DELETE /api/knowledge/collections/:id/documents/:docId
 * Delete a document from a collection
 */
knowledgeRoutes.delete('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');

    // Check edit permission
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Keine Berechtigung zum Bearbeiten' }, 403);
    }

    // Find document path in manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return c.json({ error: 'Collection nicht gefunden' }, 404);
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    const docIndex = manifest.documents?.findIndex((d: any) => d.document_id === docId);
    if (docIndex < 0) {
      return c.json({ error: 'Dokument nicht gefunden' }, 404);
    }

    const doc = manifest.documents[docIndex];

    // Delete document directory
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', doc.path);
    if (existsSync(docDir)) {
      await rm(docDir, { recursive: true });
    }

    // Update manifest
    manifest.documents.splice(docIndex, 1);
    manifest.last_updated = new Date().toISOString();
    await writeFile(manifestPath, stringifyYaml(manifest), 'utf-8');

    // Update document count in collections.yaml
    const data = await loadCollections();
    const collection = data.collections.find((col) => col.id === collectionId);
    if (collection) {
      collection.document_count = manifest.documents.length;
      await saveCollections(data);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return c.json({ error: 'Fehler beim Löschen des Dokuments' }, 500);
  }
});

/**
 * Migration: Initialize RBAC for existing collections
 * Checks each collection and creates owner access for collections without any access entries
 */
export async function migrateExistingCollections(defaultOwnerId: string): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;

  try {
    const data = await loadCollections();

    for (const collection of data.collections) {
      const hasAccess = await hasAccessEntries('collection', collection.id);

      if (!hasAccess) {
        await initializeResourceAccess('collection', collection.id, defaultOwnerId);
        migrated++;
        console.log(`[RBAC Migration] Collection "${collection.id}" - Owner zugewiesen`);
      } else {
        skipped++;
      }
    }
  } catch (error) {
    console.error('Error migrating collections:', error);
  }

  return { migrated, skipped };
}

export { knowledgeRoutes };
