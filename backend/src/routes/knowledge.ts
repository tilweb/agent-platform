/**
 * Knowledge Base Routes
 * REST API endpoints for collections management with RBAC
 */

import { Hono } from 'hono';
import { internalError, validationError, forbiddenError, notFoundError, conflictError } from '../utils/errorHandler';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { authMiddleware, requireUserId } from '../auth';
import { canView, canEdit, canDelete, canManageAccess, listAccessibleResources } from '../rbac/accessControl';
import { initializeResourceAccess, deleteResourceAccess, hasAccessEntries } from '../rbac/storage';
import { KB_BASE, KB_COLLECTIONS_FILE } from '../utils/paths';
import { indexerService } from '../services/indexer';
import archiver from 'archiver';

const knowledgeRoutes = new Hono();

const COLLECTIONS_FILE = KB_COLLECTIONS_FILE;

// Mutex for collections.yaml read-modify-write operations
let collectionsLock: Promise<void> = Promise.resolve();

async function withCollectionsLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = collectionsLock;
  collectionsLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

// Validate resource IDs to prevent path traversal attacks
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function isValidId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 128;
}

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
 * Atomically read-modify-write collections.yaml under lock.
 */
async function modifyCollections<T>(fn: (data: CollectionsFile) => Promise<T>): Promise<T> {
  return withCollectionsLock(async () => {
    const data = await loadCollections();
    const result = await fn(data);
    await saveCollections(data);
    return result;
  });
}

/**
 * GET /api/knowledge/collections
 * List all collections the user has access to
 */
knowledgeRoutes.get('/collections', async (c) => {
  try {
    const userId = requireUserId(c);
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
    return internalError(c, error);
  }
});

/**
 * GET /api/knowledge/collections/:id
 * Get a single collection with manifest (documents)
 */
knowledgeRoutes.get('/collections/:id', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    // Read manifest file which contains documents
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
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
    return internalError(c, error);
  }
});

/**
 * POST /api/knowledge/collections
 * Create a new collection (creator becomes owner)
 */
knowledgeRoutes.post('/collections', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();
    const { id, name, description, activate_when, never_activate_when } = body;

    if (!id || !name) {
      return validationError(c, 'ID und Name sind erforderlich');
    }

    // Validate ID format
    if (!/^[a-z0-9_-]+$/.test(id)) {
      return validationError(c, 'ID darf nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche enthalten');
    }

    // Lock collections for read-modify-write
    const newCollection = await modifyCollections(async (data) => {
      if (data.collections.find((col) => col.id === id)) {
        throw Object.assign(new Error('Collection mit dieser ID existiert bereits'), { status: 409 });
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
      const col: Collection = {
        id,
        name,
        description: description || '',
        document_count: 0,
        activate_when: activate_when || [],
        never_activate_when: never_activate_when || [],
      };
      data.collections.push(col);
      return col;
    });

    // Initialize RBAC - creator becomes owner
    await initializeResourceAccess('collection', id, userId);

    return c.json({
      success: true,
      collection: newCollection,
    });
  } catch (error: any) {
    if (error?.status === 409) {
      return conflictError(c, error.message);
    }
    console.error('Create collection error:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/knowledge/collections/:id
 * Update a collection
 */
knowledgeRoutes.put('/collections/:id', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    // Check edit permission
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Keine Berechtigung zum Bearbeiten');
    }

    const body = await c.req.json();
    const { name, description, activate_when, never_activate_when } = body;

    const updated = await modifyCollections(async (data) => {
      const index = data.collections.findIndex((col) => col.id === collectionId);
      if (index < 0) return null;

      const existing = data.collections[index];
      if (!existing) return null;
      const updated: Collection = {
        ...existing,
        name: name ?? existing.name,
        description: description ?? existing.description,
        activate_when: activate_when ?? existing.activate_when,
        never_activate_when: never_activate_when ?? existing.never_activate_when,
      };
      data.collections[index] = updated;

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

      return updated;
    });

    if (!updated) {
      return notFoundError(c, 'Collection');
    }

    return c.json({
      success: true,
      collection: updated,
    });
  } catch (error: any) {
    console.error('Update collection error:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/knowledge/collections/:id
 * Delete a collection
 */
knowledgeRoutes.delete('/collections/:id', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    // Check delete permission
    const accessResult = await canDelete(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Keine Berechtigung zum Löschen');
    }

    const found = await modifyCollections(async (data) => {
      const index = data.collections.findIndex((col) => col.id === collectionId);
      if (index < 0) return false;

      data.collections.splice(index, 1);
      return true;
    });

    if (!found) {
      return notFoundError(c, 'Collection');
    }

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
    return internalError(c, error);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents
 * List documents in a collection
 */
knowledgeRoutes.get('/collections/:id/documents', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    // Read manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    return c.json({
      collection_id: collectionId,
      documents: manifest.documents || [],
    });
  } catch (error: any) {
    console.error('List documents error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents/:docId
 * Get a specific document's metadata and content
 */
knowledgeRoutes.get('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');

    if (!isValidId(collectionId) || !isValidId(docId)) {
      return validationError(c, 'Ungültige ID');
    }

    // Check access
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    // Find document path in manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    const doc = manifest.documents?.find((d: any) => d.document_id === docId);
    if (!doc) {
      return notFoundError(c, 'Dokument');
    }

    // Read document meta and content
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', doc.path);

    let meta = null;
    let content = null;

    const metaPath = join(docDir, 'DOCUMENT_META.md');
    if (existsSync(metaPath)) {
      meta = await readFile(metaPath, 'utf-8');

      // Backfill audio duration for existing documents that were indexed before this feature
      if (doc.source_file && meta && !meta.includes('**Dauer:**')) {
        meta = await indexerService.backfillAudioDuration(meta, doc.source_file, docDir);
      }
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
    return internalError(c, error);
  }
});

/**
 * DELETE /api/knowledge/collections/:id/documents/:docId
 * Delete a document from a collection
 */
knowledgeRoutes.delete('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');

    if (!isValidId(collectionId) || !isValidId(docId)) {
      return validationError(c, 'Ungültige ID');
    }

    // Check edit permission
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Keine Berechtigung zum Bearbeiten');
    }

    // Find document path in manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(manifestContent);

    const docIndex = manifest.documents?.findIndex((d: any) => d.document_id === docId);
    if (docIndex < 0) {
      return notFoundError(c, 'Dokument');
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

    // Update document count in collections.yaml (under lock)
    await modifyCollections(async (data) => {
      const collection = data.collections.find((col) => col.id === collectionId);
      if (collection) {
        collection.document_count = manifest.documents.length;
      }
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return internalError(c, error);
  }
});

// ==========================================
// Download Helpers & Endpoints
// ==========================================

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
};

/**
 * Find the original uploaded file in a document directory.
 * Filters out content.md, DOCUMENT_META.md, INDEX.md and returns the first remaining file.
 * Falls back to content.md if no original file is found.
 */
async function findOriginalFile(docDir: string): Promise<{ filename: string; filepath: string } | null> {
  if (!existsSync(docDir)) return null;

  const entries = await readdir(docDir);
  const skipFiles = new Set(['content.md', 'document_meta.md', 'index.md']);
  const original = entries.find(f => !skipFiles.has(f.toLowerCase()));

  if (original) {
    return { filename: original, filepath: join(docDir, original) };
  }

  // Fallback to content.md
  const contentPath = join(docDir, 'content.md');
  if (existsSync(contentPath)) {
    return { filename: 'content.md', filepath: contentPath };
  }

  return null;
}

/**
 * GET /api/knowledge/collections/:id/documents/:docId/download
 * Download a single document's original file
 */
knowledgeRoutes.get('/collections/:id/documents/:docId/download', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');

    if (!isValidId(collectionId) || !isValidId(docId)) {
      return validationError(c, 'Ungültige ID');
    }

    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    // Find document in manifest
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifest = parseYaml(await readFile(manifestPath, 'utf-8'));
    const doc = manifest.documents?.find((d: any) => d.document_id === docId);
    if (!doc) {
      return notFoundError(c, 'Dokument');
    }

    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', doc.path);
    const original = await findOriginalFile(docDir);
    if (!original) {
      return notFoundError(c, 'Originaldatei');
    }

    const file = Bun.file(original.filepath);
    const ext = extname(original.filename).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    c.header('Content-Type', mimeType);
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(original.filename)}"`);
    return c.body(await file.arrayBuffer());
  } catch (error: any) {
    console.error('Download document error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/knowledge/collections/:id/download
 * Download entire collection as ZIP
 */
knowledgeRoutes.get('/collections/:id/download', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifest = parseYaml(await readFile(manifestPath, 'utf-8'));
    const documents = manifest.documents || [];
    const collectionName = manifest.collection_name || collectionId;

    return streamZipResponse(c, collectionId, documents, collectionName);
  } catch (error: any) {
    console.error('Download collection ZIP error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/knowledge/collections/:id/download
 * Download selected documents as ZIP
 */
knowledgeRoutes.post('/collections/:id/download', async (c) => {
  try {
    const userId = requireUserId(c);
    const collectionId = c.req.param('id');

    if (!isValidId(collectionId)) {
      return validationError(c, 'Ungültige Collection-ID');
    }

    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) {
      return forbiddenError(c, 'Zugriff verweigert');
    }

    const body = await c.req.json();
    const { documentIds } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return validationError(c, 'documentIds Array erforderlich');
    }

    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return notFoundError(c, 'Collection');
    }

    const manifest = parseYaml(await readFile(manifestPath, 'utf-8'));
    const idSet = new Set(documentIds);
    const documents = (manifest.documents || []).filter((d: any) => idSet.has(d.document_id));
    const collectionName = manifest.collection_name || collectionId;

    return streamZipResponse(c, collectionId, documents, collectionName);
  } catch (error: any) {
    console.error('Download selected documents ZIP error:', error);
    return internalError(c, error);
  }
});

/**
 * Helper: Stream a ZIP response containing the given documents
 */
async function streamZipResponse(c: any, collectionId: string, documents: any[], collectionName: string) {
  const archive = archiver('zip', { zlib: { level: 5 } });
  const usedNames = new Map<string, number>();

  for (const doc of documents) {
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', doc.path);
    const original = await findOriginalFile(docDir);
    if (!original) continue;

    // Deduplicate filenames in ZIP
    let zipName = original.filename;
    const count = usedNames.get(zipName.toLowerCase()) || 0;
    if (count > 0) {
      const ext = extname(zipName);
      const base = zipName.slice(0, -ext.length || undefined);
      zipName = `${base} (${count})${ext}`;
    }
    usedNames.set(original.filename.toLowerCase(), count + 1);

    archive.file(original.filepath, { name: zipName });
  }

  // Collect ZIP into buffer (archiver uses Node streams, not Web streams)
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });

  archive.finalize();
  const zipBuffer = await done;

  c.header('Content-Type', 'application/zip');
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(collectionName)}.zip"`);
  return c.body(zipBuffer);
}

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
