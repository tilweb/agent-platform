/**
 * Indexing Queue Service
 *
 * Lightweight in-memory queue for background document indexing.
 * Supports controlled concurrency, SSE broadcasting, manifest placeholder
 * registration, and crash recovery via import-job.json files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { importAndIndex, type ImportItem } from './documentImporter';
import { KB_BASE } from '../utils/paths';

// ==========================================
// Types
// ==========================================

export interface IndexingJob {
  id: string;
  collectionId: string;
  item: ImportItem;
  userId?: string;
  documentId: string;
  status: 'pending' | 'indexing' | 'ready' | 'error';
  error?: string;
}

export interface IndexingEvent {
  type: 'document_indexing' | 'document_ready' | 'document_error';
  documentId: string;
  title: string;
  error?: string;
}

type SSEListener = (event: IndexingEvent) => void;

// ==========================================
// Queue Service
// ==========================================

const MAX_CONCURRENT = 2;

class IndexingQueueService {
  private queue: IndexingJob[] = [];
  private activeCount = 0;
  private listeners = new Map<string, Set<SSEListener>>();

  /**
   * Register placeholder documents in manifest and enqueue indexing jobs.
   * Returns immediately with job metadata.
   */
  async enqueueBatch(
    collectionId: string,
    items: ImportItem[],
    userId?: string,
  ): Promise<{ collectionId: string; jobs: Array<{ documentId: string; title: string; status: string }> }> {
    const jobs: IndexingJob[] = [];

    for (const item of items) {
      // For 'knowledge' type (copy), we don't pre-allocate — it uses its own ID logic
      const isKnowledgeCopy = item.type === 'knowledge';
      const documentId = isKnowledgeCopy
        ? `copy-${item.id}-${Date.now()}`
        : this.generateDocumentId(item);

      const job: IndexingJob = {
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        collectionId,
        item,
        userId,
        documentId,
        status: 'pending',
      };

      jobs.push(job);

      // Register placeholder in manifest (except for knowledge copies which handle their own manifest)
      if (!isKnowledgeCopy) {
        await this.registerPlaceholder(collectionId, job);
      }

      // Save import-job.json for crash recovery
      if (!isKnowledgeCopy) {
        await this.saveImportJob(collectionId, job);
      }
    }

    // Add all jobs to queue
    this.queue.push(...jobs);

    // Trigger processing (non-blocking)
    this.processNext();

    return {
      collectionId,
      jobs: jobs.map((j) => ({
        documentId: j.documentId,
        title: j.item.title,
        status: j.status,
      })),
    };
  }

  /**
   * Retry a failed document
   */
  async retryJob(collectionId: string, documentId: string): Promise<boolean> {
    // Try to load import-job.json
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', documentId);
    const jobPath = join(docDir, 'import-job.json');

    if (!existsSync(jobPath)) {
      return false;
    }

    try {
      const jobData = JSON.parse(await readFile(jobPath, 'utf-8'));

      // Reset status in manifest
      await this.updateDocumentStatus(collectionId, documentId, 'pending');

      const job: IndexingJob = {
        id: `job-retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        collectionId,
        item: jobData.item,
        userId: jobData.userId,
        documentId,
        status: 'pending',
      };

      this.queue.push(job);
      this.processNext();
      return true;
    } catch (error) {
      console.error('[IndexingQueue] Failed to retry job:', error);
      return false;
    }
  }

  /**
   * Recover interrupted jobs after server restart.
   * Scans all collection manifests for pending/indexing documents.
   */
  async recoverInterruptedJobs(): Promise<number> {
    let recovered = 0;
    const collectionsDir = join(KB_BASE, 'collections');

    if (!existsSync(collectionsDir)) return 0;

    try {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(collectionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const collectionId = entry.name;
        const manifestPath = join(collectionsDir, collectionId, 'manifest.yaml');

        if (!existsSync(manifestPath)) continue;

        const manifest = await readFile(manifestPath, 'utf-8');

        // Find documents with pending or indexing status
        const statusRegex = /document_id: "([^"]+)"[\s\S]*?status: "(pending|indexing)"/g;
        let match;

        while ((match = statusRegex.exec(manifest)) !== null) {
          const documentId = match[1]!;
          const docDir = join(collectionsDir, collectionId, 'documents', documentId);
          const jobPath = join(docDir, 'import-job.json');

          if (!existsSync(jobPath)) {
            // No recovery data — mark as error
            await this.updateDocumentStatus(collectionId, documentId, 'error', 'Wiederherstellung fehlgeschlagen: Keine Job-Daten');
            continue;
          }

          try {
            const jobData = JSON.parse(await readFile(jobPath, 'utf-8'));

            // Reset to pending
            await this.updateDocumentStatus(collectionId, documentId, 'pending');

            const job: IndexingJob = {
              id: `job-recover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              collectionId,
              item: jobData.item,
              userId: jobData.userId,
              documentId,
              status: 'pending',
            };

            this.queue.push(job);
            recovered++;
          } catch (error) {
            console.error(`[IndexingQueue] Failed to recover job ${documentId}:`, error);
            await this.updateDocumentStatus(collectionId, documentId, 'error', 'Wiederherstellung fehlgeschlagen');
          }
        }
      }

      if (recovered > 0) {
        console.log(`[IndexingQueue] Recovered ${recovered} interrupted indexing jobs`);
        this.processNext();
      }
    } catch (error) {
      console.error('[IndexingQueue] Recovery scan failed:', error);
    }

    return recovered;
  }

  /**
   * Register an SSE listener for a collection
   */
  addListener(collectionId: string, listener: SSEListener): void {
    if (!this.listeners.has(collectionId)) {
      this.listeners.set(collectionId, new Set());
    }
    this.listeners.get(collectionId)!.add(listener);
  }

  /**
   * Remove an SSE listener
   */
  removeListener(collectionId: string, listener: SSEListener): void {
    this.listeners.get(collectionId)?.delete(listener);
    if (this.listeners.get(collectionId)?.size === 0) {
      this.listeners.delete(collectionId);
    }
  }

  /**
   * Get current status of all non-ready documents for a collection
   */
  getActiveJobs(collectionId: string): Array<{ documentId: string; title: string; status: string; error?: string }> {
    return this.queue
      .filter((j) => j.collectionId === collectionId)
      .map((j) => ({
        documentId: j.documentId,
        title: j.item.title,
        status: j.status,
        error: j.error,
      }));
  }

  // ==========================================
  // Internal
  // ==========================================

  private async processNext(): Promise<void> {
    if (this.activeCount >= MAX_CONCURRENT) return;

    const nextJob = this.queue.find((j) => j.status === 'pending');
    if (!nextJob) return;

    this.activeCount++;
    nextJob.status = 'indexing';

    // Update manifest status
    await this.updateDocumentStatus(nextJob.collectionId, nextJob.documentId, 'indexing');

    // Broadcast
    this.broadcast(nextJob.collectionId, {
      type: 'document_indexing',
      documentId: nextJob.documentId,
      title: nextJob.item.title,
    });

    try {
      const isKnowledgeCopy = nextJob.item.type === 'knowledge';

      const result = await importAndIndex(
        nextJob.item,
        nextJob.collectionId,
        nextJob.userId,
        isKnowledgeCopy ? undefined : { preAllocatedDocumentId: nextJob.documentId, skipManifestEntry: true },
      );

      if (result.success) {
        nextJob.status = 'ready';

        if (isKnowledgeCopy) {
          // Knowledge copies manage their own manifest entry; no status to update
          // But we should update document_count since registerPlaceholder wasn't called
        } else {
          await this.updateDocumentStatus(nextJob.collectionId, nextJob.documentId, 'ready');
          // Clean up import-job.json on success
          this.cleanupImportJob(nextJob.collectionId, nextJob.documentId);
        }

        this.broadcast(nextJob.collectionId, {
          type: 'document_ready',
          documentId: isKnowledgeCopy ? (result.documentId || nextJob.documentId) : nextJob.documentId,
          title: nextJob.item.title,
        });
      } else {
        nextJob.status = 'error';
        nextJob.error = result.error || 'Unbekannter Fehler';

        if (!isKnowledgeCopy) {
          await this.updateDocumentStatus(nextJob.collectionId, nextJob.documentId, 'error', nextJob.error);
        }

        this.broadcast(nextJob.collectionId, {
          type: 'document_error',
          documentId: nextJob.documentId,
          title: nextJob.item.title,
          error: nextJob.error,
        });
      }
    } catch (error: any) {
      nextJob.status = 'error';
      nextJob.error = error.message || 'Verarbeitung fehlgeschlagen';

      const isKnowledgeCopy = nextJob.item.type === 'knowledge';
      if (!isKnowledgeCopy) {
        await this.updateDocumentStatus(nextJob.collectionId, nextJob.documentId, 'error', nextJob.error);
      }

      this.broadcast(nextJob.collectionId, {
        type: 'document_error',
        documentId: nextJob.documentId,
        title: nextJob.item.title,
        error: nextJob.error,
      });
    }

    this.activeCount--;

    // Remove completed/errored jobs from queue after a delay (keep for status queries)
    setTimeout(() => {
      this.queue = this.queue.filter((j) => j.id !== nextJob.id);
    }, 60_000);

    // Process next
    this.processNext();
  }

  private broadcast(collectionId: string, event: IndexingEvent): void {
    const listeners = this.listeners.get(collectionId);
    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[IndexingQueue] Listener error:', error);
      }
    }
  }

  private generateDocumentId(item: ImportItem): string {
    const timestamp = Date.now();
    const title = item.title || item.metadata?.filename || 'document';
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `doc-${safeTitle}-${timestamp}`;
  }

  private async registerPlaceholder(collectionId: string, job: IndexingJob): Promise<void> {
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');

    if (!existsSync(manifestPath)) return;

    let manifest = await readFile(manifestPath, 'utf-8');

    // Clean title: use filename for uploads, strip markdown for images, fallback to title
    const cleanTitle = (job.item.metadata?.filename || job.item.title || 'Dokument')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')  // strip markdown image syntax
      .replace(/"/g, '\\"')                   // escape quotes for YAML
      .trim() || 'Dokument';

    const newEntry = [
      `  - document_id: "${job.documentId}"`,
      `    title: "${cleanTitle}"`,
      `    source_file: ""`,
      `    path: "${job.documentId}"`,
      `    indexed_date: "${new Date().toISOString().split('T')[0]}"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join('\n');

    if (manifest.includes('documents: []')) {
      manifest = manifest.replace('documents: []', `documents:\n${newEntry}`);
    } else {
      manifest = manifest.trimEnd() + '\n' + newEntry + '\n';
    }

    // Update last_updated
    manifest = manifest.replace(
      /last_updated: ".*"/,
      `last_updated: "${new Date().toISOString()}"`,
    );

    await writeFile(manifestPath, manifest, 'utf-8');

    // Create document directory
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', job.documentId);
    await mkdir(docDir, { recursive: true });

    // Update document count in collections.yaml
    await this.updateCollectionCount(collectionId, 1);
  }

  private async saveImportJob(collectionId: string, job: IndexingJob): Promise<void> {
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', job.documentId);
    if (!existsSync(docDir)) {
      await mkdir(docDir, { recursive: true });
    }

    const jobData = {
      item: job.item,
      userId: job.userId,
      createdAt: new Date().toISOString(),
    };

    await writeFile(join(docDir, 'import-job.json'), JSON.stringify(jobData, null, 2), 'utf-8');
  }

  private async cleanupImportJob(collectionId: string, documentId: string): Promise<void> {
    try {
      const jobPath = join(KB_BASE, 'collections', collectionId, 'documents', documentId, 'import-job.json');
      if (existsSync(jobPath)) {
        const { unlink } = await import('fs/promises');
        await unlink(jobPath);
      }
    } catch {
      // Non-critical, ignore
    }
  }

  async updateDocumentStatus(
    collectionId: string,
    documentId: string,
    status: 'pending' | 'indexing' | 'ready' | 'error',
    error?: string,
  ): Promise<void> {
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');

    if (!existsSync(manifestPath)) return;

    let manifest = await readFile(manifestPath, 'utf-8');

    // Find the document entry and update its status
    // Use (?:(?!- document_id)[\s\S]) to stay within this entry (non-greedy, stops at next entry)
    const docPattern = new RegExp(
      `(- document_id: "${documentId}"(?:(?!- document_id)[\\s\\S])*?)status: "(?:[^"\\\\]|\\\\.)*"`,
    );

    if (docPattern.test(manifest)) {
      manifest = manifest.replace(docPattern, `$1status: "${status}"`);
    }

    // Update error field if present
    if (error !== undefined) {
      const errorPattern = new RegExp(
        `(- document_id: "${documentId}"(?:(?!- document_id)[\\s\\S])*?)error: "(?:[^"\\\\]|\\\\.)*"`,
      );
      if (errorPattern.test(manifest)) {
        // Strip quotes from error to avoid YAML corruption
        const safeError = error.replace(/"/g, "'");
        manifest = manifest.replace(errorPattern, `$1error: "${safeError}"`);
      }
    } else if (status === 'ready') {
      // Clear error on success
      const errorPattern = new RegExp(
        `(- document_id: "${documentId}"(?:(?!- document_id)[\\s\\S])*?)error: "(?:[^"\\\\]|\\\\.)*"`,
      );
      if (errorPattern.test(manifest)) {
        manifest = manifest.replace(errorPattern, `$1error: ""`);
      }
    }

    await writeFile(manifestPath, manifest, 'utf-8');
  }

  private async updateCollectionCount(collectionId: string, delta: number): Promise<void> {
    const collectionsPath = join(KB_BASE, 'collections.yaml');

    if (!existsSync(collectionsPath)) return;

    let content = await readFile(collectionsPath, 'utf-8');

    const regex = new RegExp(
      `(- id: "${collectionId}"[\\s\\S]*?document_count: )(\\d+)`,
    );
    const match = content.match(regex);
    if (match) {
      const currentCount = parseInt(match[2] ?? '0', 10);
      content = content.replace(regex, `$1${currentCount + delta}`);
      await writeFile(collectionsPath, content, 'utf-8');
    }
  }
}

export const indexingQueue = new IndexingQueueService();
