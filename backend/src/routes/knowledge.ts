/**
 * Knowledge Base Routes — REST API mit RBAC.
 * Persistenz wandert ueber `services/kbStorage.ts` in Postgres + S3.
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth';
import { canView, canEdit, canDelete, listAccessibleResources, getResourceOwnerInfo } from '../rbac/accessControl';
import { initializeResourceAccess, deleteResourceAccess, hasAccessEntries } from '../rbac/storage';
import * as kb from '../services/kbStorage';

const knowledgeRoutes = new Hono();

knowledgeRoutes.use('/*', authMiddleware);

/**
 * GET /api/knowledge/collections
 */
knowledgeRoutes.get('/collections', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const all = await kb.listCollections();
    const collectionIds = all.map(col => col.id);
    const accessibleCollections = await listAccessibleResources(userId, 'collection', collectionIds);
    const accessibleMap = new Map(accessibleCollections.map(a => [a.resourceId, a.role]));

    // ALLE Collections werden zurueckgegeben — auch nicht-berechtigte. Frontend
    // rendert sie ausgegraut mit Owner-Hinweis "Zugriff anfragen bei …", damit
    // User wissen was es gibt. Doc-Count + Inhalts-Felder bleiben fuer
    // nicht-berechtigte leer (kein Information-Leak).
    const collections = await Promise.all(
      all.map(async col => {
        const role = accessibleMap.get(col.id) ?? null;
        const accessible = role !== null;
        const owner = accessible ? null : await getResourceOwnerInfo('collection', col.id);
        const document_count = accessible ? (await kb.listDocuments(col.id)).length : 0;
        return {
          ...col,
          activate_when: col.activate_when ?? [],
          never_activate_when: col.never_activate_when ?? [],
          document_count,
          role,
          accessible,
          owner,
        };
      }),
    );
    return c.json({ collections });
  } catch (error: any) {
    console.error('List collections error:', error);
    return c.json({ error: 'Fehler beim Laden der Collections' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id
 */
knowledgeRoutes.get('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Zugriff verweigert' }, 403);

    const collection = await kb.getCollection(collectionId);
    if (!collection) return c.json({ error: 'Collection nicht gefunden' }, 404);
    const docs = await kb.listDocuments(collectionId);

    return c.json({
      collection_id: collection.id,
      collection_name: collection.name,
      description: collection.description ?? '',
      last_updated: collection.updated_at,
      documents: docs.map(d => ({
        document_id: d.id,
        title: d.title ?? d.filename,
        source_file: d.filename,
        path: d.id,
        indexed_date: (d.createdAt ?? '').split('T')[0],
      })),
      role: accessResult.effectiveRole,
    });
  } catch (error: any) {
    console.error('Get collection error:', error);
    return c.json({ error: 'Fehler beim Laden der Collection' }, 500);
  }
});

/**
 * POST /api/knowledge/collections
 */
knowledgeRoutes.post('/collections', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const body = await c.req.json();
    const { id, name, description, activate_when, never_activate_when } = body;

    if (!id || !name) return c.json({ error: 'ID und Name sind erforderlich' }, 400);
    if (!/^[a-z0-9_-]+$/.test(id)) {
      return c.json({ error: 'ID darf nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche enthalten' }, 400);
    }
    if (await kb.getCollection(id)) {
      return c.json({ error: 'Collection mit dieser ID existiert bereits' }, 409);
    }

    const created = await kb.createCollection({
      id,
      name,
      description,
      activate_when: activate_when ?? [],
      never_activate_when: never_activate_when ?? [],
    });
    await initializeResourceAccess('collection', id, userId);
    return c.json({ success: true, collection: created });
  } catch (error: any) {
    console.error('Create collection error:', error);
    return c.json({ error: 'Fehler beim Erstellen der Collection' }, 500);
  }
});

/**
 * PUT /api/knowledge/collections/:id
 */
knowledgeRoutes.put('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Keine Berechtigung zum Bearbeiten' }, 403);

    const body = await c.req.json();
    const existing = await kb.getCollection(collectionId);
    if (!existing) return c.json({ error: 'Collection nicht gefunden' }, 404);

    const merged = await kb.createCollection({
      id: collectionId,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      activate_when: body.activate_when ?? existing.activate_when ?? [],
      never_activate_when: body.never_activate_when ?? existing.never_activate_when ?? [],
    });
    return c.json({ success: true, collection: merged });
  } catch (error: any) {
    console.error('Update collection error:', error);
    return c.json({ error: 'Fehler beim Aktualisieren der Collection' }, 500);
  }
});

/**
 * DELETE /api/knowledge/collections/:id
 */
knowledgeRoutes.delete('/collections/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const accessResult = await canDelete(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Keine Berechtigung zum Löschen' }, 403);

    const ok = await kb.deleteCollection(collectionId);
    if (!ok) return c.json({ error: 'Collection nicht gefunden' }, 404);
    await deleteResourceAccess('collection', collectionId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete collection error:', error);
    return c.json({ error: 'Fehler beim Löschen der Collection' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents
 */
knowledgeRoutes.get('/collections/:id/documents', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Zugriff verweigert' }, 403);

    const collection = await kb.getCollection(collectionId);
    if (!collection) return c.json({ error: 'Collection nicht gefunden' }, 404);
    const docs = await kb.listDocuments(collectionId);
    return c.json({
      collection_id: collectionId,
      documents: docs.map(d => ({
        document_id: d.id,
        title: d.title ?? d.filename,
        source_file: d.filename,
        path: d.id,
        indexed_date: (d.createdAt ?? '').split('T')[0],
      })),
    });
  } catch (error: any) {
    console.error('List documents error:', error);
    return c.json({ error: 'Fehler beim Laden der Dokumente' }, 500);
  }
});

/**
 * GET /api/knowledge/collections/:id/documents/:docId
 */
knowledgeRoutes.get('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');
    const accessResult = await canView(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Zugriff verweigert' }, 403);

    const doc = await kb.getDocument(collectionId, docId);
    if (!doc) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    const content = await kb.getDocumentContent(collectionId, docId);
    return c.json({
      document: {
        document_id: doc.id,
        title: doc.title ?? doc.filename,
        source_file: doc.filename,
        path: doc.id,
        indexed_date: (doc.createdAt ?? '').split('T')[0],
      },
      meta: doc.metaMd,
      content,
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    return c.json({ error: 'Fehler beim Laden des Dokuments' }, 500);
  }
});

/**
 * DELETE /api/knowledge/collections/:id/documents/:docId
 */
knowledgeRoutes.delete('/collections/:id/documents/:docId', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const collectionId = c.req.param('id');
    const docId = c.req.param('docId');
    const accessResult = await canEdit(userId, 'collection', collectionId);
    if (!accessResult.allowed) return c.json({ error: 'Keine Berechtigung zum Bearbeiten' }, 403);

    const ok = await kb.deleteDocument(collectionId, docId);
    if (!ok) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return c.json({ error: 'Fehler beim Löschen des Dokuments' }, 500);
  }
});

/**
 * RBAC-Migration fuer bestehende Collections — falls noch keine Access-Eintraege
 * existieren, wird der defaultOwnerId zum Owner.
 */
export async function migrateExistingCollections(defaultOwnerId: string): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;
  try {
    const collections = await kb.listCollections();
    for (const col of collections) {
      const hasAccess = await hasAccessEntries('collection', col.id);
      if (!hasAccess) {
        await initializeResourceAccess('collection', col.id, defaultOwnerId);
        migrated++;
        console.log(`[RBAC Migration] Collection "${col.id}" - Owner zugewiesen`);
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
