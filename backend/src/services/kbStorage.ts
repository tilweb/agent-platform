/**
 * Knowledge-Base Storage — Postgres-Metadata + Flow.swiss S3 (Content/Index).
 *
 * Frueher YAML+Markdown auf Disk:
 *   - data/knowledge-base/collections.yaml             (Top-Level-Index)
 *   - data/knowledge-base/collections/<id>/manifest.yaml
 *   - data/knowledge-base/collections/<id>/documents/<docPath>/{DOCUMENT_META.md, content.md, INDEX.md}
 *
 * Jetzt:
 *   - kb.collections        (Stammdaten + activate_when / never_activate_when als jsonb)
 *   - kb.documents          (Stammdaten + meta_md text, content/index als S3-Refs)
 *   - S3 unter `kb/<collection>/<docId>/{content.md,INDEX.md}`
 *
 * Re-Index-Pipeline (Markitdown + LLM-Meta) wird unveraendert von services/indexer.ts
 * orchestriert; nur die Persistenz wandert in diesen Layer.
 */

import { eq, and, desc } from 'drizzle-orm';
import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import * as yaml from 'yaml';
import { getDb } from '../db';
import { kbCollections, kbDocuments, kbIndexerState } from '../db/schema/kb';
import { putObject, getObject, deleteObject } from '../storage/s3';
import { s3Paths } from '../storage/paths';

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');

// ============================================
// Types
// ============================================

export interface KbCollection {
  id: string;
  name: string;
  description?: string;
  activate_when?: string[];
  never_activate_when?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface KbDocument {
  id: string;
  collectionId: string;
  filename: string;
  title?: string;
  contentType?: string;
  sizeBytes?: number;
  metaMd?: string;
  hasIndex: boolean;
  keywords?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Collections CRUD
// ============================================

function rowToCollection(row: typeof kbCollections.$inferSelect): KbCollection {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    activate_when: (row.activateWhen as string[] | null) ?? undefined,
    never_activate_when: (row.neverActivateWhen as string[] | null) ?? undefined,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listCollections(): Promise<KbCollection[]> {
  const db = getDb();
  const rows = await db.select().from(kbCollections).orderBy(kbCollections.name);
  return rows.map(rowToCollection);
}

export async function getCollection(id: string): Promise<KbCollection | null> {
  const db = getDb();
  const rows = await db.select().from(kbCollections).where(eq(kbCollections.id, id)).limit(1);
  return rows[0] ? rowToCollection(rows[0]) : null;
}

export async function createCollection(input: {
  id: string;
  name: string;
  description?: string;
  activate_when?: string[];
  never_activate_when?: string[];
}): Promise<KbCollection> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(kbCollections).values({
    id: input.id,
    name: input.name,
    description: input.description ?? null,
    activateWhen: (input.activate_when ?? []) as never,
    neverActivateWhen: (input.never_activate_when ?? []) as never,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: kbCollections.id,
    set: {
      name: input.name,
      description: input.description ?? null,
      activateWhen: (input.activate_when ?? []) as never,
      neverActivateWhen: (input.never_activate_when ?? []) as never,
      updatedAt: now,
    },
  });
  const created = await getCollection(input.id);
  return created!;
}

export async function deleteCollection(id: string): Promise<boolean> {
  // Vorher S3-Objekte aller zugehoerigen Dokumente loeschen.
  const docs = await listDocuments(id);
  for (const doc of docs) {
    try { await deleteObject(s3Paths.kbContent(id, doc.id)); } catch { /* ignore */ }
    try { await deleteObject(s3Paths.kbIndex(id, doc.id)); } catch { /* ignore */ }
  }
  const db = getDb();
  // Cascading FK loescht kbDocuments-Rows.
  const res = await db.delete(kbCollections).where(eq(kbCollections.id, id)).returning({ id: kbCollections.id });
  return res.length > 0;
}

// ============================================
// Documents CRUD
// ============================================

function rowToDocument(row: typeof kbDocuments.$inferSelect): KbDocument {
  return {
    id: row.id,
    collectionId: row.collectionId,
    filename: row.filename,
    title: row.title ?? undefined,
    contentType: row.contentType ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    metaMd: row.metaMd ?? undefined,
    hasIndex: !!row.s3KeyIndex,
    keywords: (row.keywords as string[] | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listDocuments(collectionId: string): Promise<KbDocument[]> {
  const db = getDb();
  const rows = await db.select().from(kbDocuments)
    .where(eq(kbDocuments.collectionId, collectionId))
    .orderBy(desc(kbDocuments.createdAt));
  return rows.map(rowToDocument);
}

export async function getDocument(collectionId: string, docId: string): Promise<KbDocument | null> {
  const db = getDb();
  const rows = await db.select().from(kbDocuments)
    .where(and(eq(kbDocuments.collectionId, collectionId), eq(kbDocuments.id, docId)))
    .limit(1);
  return rows[0] ? rowToDocument(rows[0]) : null;
}

export async function getDocumentContent(collectionId: string, docId: string): Promise<string | null> {
  const doc = await getDocument(collectionId, docId);
  if (!doc) return null;
  try {
    const buf = await getObject(s3Paths.kbContent(collectionId, docId));
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

export async function getDocumentIndex(collectionId: string, docId: string): Promise<string | null> {
  const doc = await getDocument(collectionId, docId);
  if (!doc?.hasIndex) return null;
  try {
    const buf = await getObject(s3Paths.kbIndex(collectionId, docId));
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

export async function saveDocument(input: {
  id: string;
  collectionId: string;
  filename: string;
  title?: string;
  contentType?: string;
  content: string;
  metaMd?: string;
  indexMd?: string | null;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}): Promise<KbDocument> {
  const db = getDb();
  const now = new Date().toISOString();
  const contentBuf = Buffer.from(input.content, 'utf-8');
  const s3KeyContent = s3Paths.kbContent(input.collectionId, input.id);
  await putObject(s3KeyContent, contentBuf, 'text/markdown; charset=utf-8');

  let s3KeyIndex: string | null = null;
  if (input.indexMd) {
    s3KeyIndex = s3Paths.kbIndex(input.collectionId, input.id);
    await putObject(s3KeyIndex, Buffer.from(input.indexMd, 'utf-8'), 'text/markdown; charset=utf-8');
  }

  await db.insert(kbDocuments).values({
    id: input.id,
    collectionId: input.collectionId,
    filename: input.filename,
    title: input.title ?? null,
    contentType: input.contentType ?? null,
    sizeBytes: contentBuf.length,
    s3KeyContent,
    s3KeyIndex,
    metaMd: input.metaMd ?? null,
    keywords: (input.keywords ?? []) as never,
    metadata: (input.metadata ?? {}) as never,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: kbDocuments.id,
    set: {
      filename: input.filename,
      title: input.title ?? null,
      contentType: input.contentType ?? null,
      sizeBytes: contentBuf.length,
      s3KeyContent,
      s3KeyIndex,
      metaMd: input.metaMd ?? null,
      keywords: (input.keywords ?? []) as never,
      metadata: (input.metadata ?? {}) as never,
      updatedAt: now,
    },
  });

  const saved = await getDocument(input.collectionId, input.id);
  return saved!;
}

export async function deleteDocument(collectionId: string, docId: string): Promise<boolean> {
  try { await deleteObject(s3Paths.kbContent(collectionId, docId)); } catch { /* ignore */ }
  try { await deleteObject(s3Paths.kbIndex(collectionId, docId)); } catch { /* ignore */ }
  const db = getDb();
  const res = await db.delete(kbDocuments)
    .where(and(eq(kbDocuments.collectionId, collectionId), eq(kbDocuments.id, docId)))
    .returning({ id: kbDocuments.id });
  return res.length > 0;
}

// ============================================
// YAML-Compat (KB-Tools erwarten YAML-Strings)
// ============================================

export async function collectionsAsYaml(): Promise<string> {
  const collections = await listCollections();
  return yaml.stringify({
    collections: collections.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      activate_when: c.activate_when ?? [],
      never_activate_when: c.never_activate_when ?? [],
    })),
  }, { lineWidth: 0 });
}

export async function manifestAsYaml(collectionId: string): Promise<string> {
  const collection = await getCollection(collectionId);
  if (!collection) throw new Error(`Collection "${collectionId}" not found`);
  const docs = await listDocuments(collectionId);
  return yaml.stringify({
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
  }, { lineWidth: 0 });
}

// ============================================
// Indexer-State
// ============================================

export async function setIndexerState(input: {
  id: string;
  status: 'queued' | 'converting' | 'analyzing' | 'done' | 'failed';
  collectionId?: string;
  filename?: string;
  progress?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(kbIndexerState).values({
    id: input.id,
    status: input.status,
    collectionId: input.collectionId ?? null,
    filename: input.filename ?? null,
    progress: input.progress ?? 0,
    error: input.error ?? null,
    metadata: (input.metadata ?? {}) as never,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: kbIndexerState.id,
    set: {
      status: input.status,
      progress: input.progress ?? 0,
      error: input.error ?? null,
      metadata: (input.metadata ?? {}) as never,
      updatedAt: now,
    },
  });
}

export async function getIndexerState(id: string) {
  const db = getDb();
  const rows = await db.select().from(kbIndexerState).where(eq(kbIndexerState.id, id)).limit(1);
  return rows[0] ?? null;
}

// ============================================
// Disk-Migration
// ============================================

interface ParsedManifest {
  collection_id?: string;
  collection_name?: string;
  description?: string;
  documents?: Array<{
    document_id?: string;
    title?: string;
    source_file?: string;
    path?: string;
    indexed_date?: string;
    summary?: string;
  }>;
}

interface ParsedCollectionsList {
  collections?: Array<{
    id?: string;
    name?: string;
    description?: string;
    activate_when?: string[];
    never_activate_when?: string[];
  }>;
}

export async function seedKbFromDisk(): Promise<{ collectionsIngested: string[]; docsIngested: number; skipped: number }> {
  const collectionsIngested: string[] = [];
  let docsIngested = 0;
  let skipped = 0;
  if (!existsSync(KB_BASE)) return { collectionsIngested, docsIngested, skipped };

  // 1. Collections-Index lesen
  const collectionsListFile = join(KB_BASE, 'collections.yaml');
  let collectionsList: ParsedCollectionsList = {};
  if (existsSync(collectionsListFile)) {
    try {
      const content = await readFile(collectionsListFile, 'utf-8');
      collectionsList = yaml.parse(content) as ParsedCollectionsList;
    } catch (err) {
      console.warn('[kb] Failed to parse collections.yaml:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Pro Collection-Verzeichnis: manifest + Dokumente.
  const collectionsDir = join(KB_BASE, 'collections');
  if (!existsSync(collectionsDir)) return { collectionsIngested, docsIngested, skipped };
  const collDirs = await readdir(collectionsDir, { withFileTypes: true });
  for (const collDir of collDirs) {
    if (!collDir.isDirectory()) continue;
    const collId = collDir.name;
    const existing = await getCollection(collId);
    const manifestFile = join(collectionsDir, collId, 'manifest.yaml');
    if (!existsSync(manifestFile)) continue;

    let manifest: ParsedManifest = {};
    try {
      manifest = yaml.parse(await readFile(manifestFile, 'utf-8')) as ParsedManifest;
    } catch {
      continue;
    }

    if (!existing) {
      // Aus collections.yaml die activate_when-Felder rausfischen, wenn vorhanden.
      const meta = (collectionsList.collections ?? []).find(c => c.id === collId);
      await createCollection({
        id: collId,
        name: manifest.collection_name ?? collId,
        description: manifest.description ?? meta?.description,
        activate_when: meta?.activate_when ?? [],
        never_activate_when: meta?.never_activate_when ?? [],
      });
      collectionsIngested.push(collId);
    }

    // Dokumente
    const docsDir = join(collectionsDir, collId, 'documents');
    if (!existsSync(docsDir)) continue;
    const docDirs = await readdir(docsDir, { withFileTypes: true });
    for (const docEntry of docDirs) {
      if (!docEntry.isDirectory()) continue;
      const docId = docEntry.name;
      const existingDoc = await getDocument(collId, docId);
      if (existingDoc) {
        skipped++;
        continue;
      }

      const docDir = join(docsDir, docId);
      const contentFile = join(docDir, 'content.md');
      if (!existsSync(contentFile)) continue;

      try {
        const content = await readFile(contentFile, 'utf-8');
        const metaFile = join(docDir, 'DOCUMENT_META.md');
        const metaMd = existsSync(metaFile) ? await readFile(metaFile, 'utf-8') : undefined;
        const indexFile = join(docDir, 'INDEX.md');
        const indexMd = existsSync(indexFile) ? await readFile(indexFile, 'utf-8') : null;
        const manifestEntry = (manifest.documents ?? []).find(d => d.document_id === docId || d.path === docId);
        await saveDocument({
          id: docId,
          collectionId: collId,
          filename: manifestEntry?.source_file ?? `${docId}.md`,
          title: manifestEntry?.title,
          contentType: 'text/markdown',
          content,
          metaMd,
          indexMd,
          metadata: manifestEntry ? { indexed_date: manifestEntry.indexed_date, summary: manifestEntry.summary } : undefined,
        });
        docsIngested++;
      } catch (err) {
        console.warn(`[kb] Failed to ingest ${collId}/${docId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  if (collectionsIngested.length > 0 || docsIngested > 0) {
    console.log(`[kb] Seeded ${collectionsIngested.length} collections, ${docsIngested} documents (${skipped} docs skipped)`);
  }
  return { collectionsIngested, docsIngested, skipped };
}
