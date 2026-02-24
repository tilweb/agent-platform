/**
 * useCollectionIndexing
 *
 * Hook for live indexing status updates via SSE.
 * Connects to the indexing stream when a collection has pending/indexing documents,
 * merges updates into the documents array, and provides retry functionality.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiPost, API_URL } from '../utils/apiFetch';

/**
 * @param {string} collectionId - The collection ID to monitor
 * @param {Array} initialDocuments - Documents array from collection detail API
 * @returns {{ documents: Array, isIndexing: boolean, retryDocument: (docId: string) => Promise<void> }}
 */
export function useCollectionIndexing(collectionId, initialDocuments) {
  const [documentStatuses, setDocumentStatuses] = useState({});
  const eventSourceRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Check if any documents need indexing
  const hasNonReadyDocs = (initialDocuments || []).some(
    (doc) => doc.status && doc.status !== 'ready',
  );

  // Clean up overrides when server data already reflects the final state
  useEffect(() => {
    if (!initialDocuments?.length) return;
    setDocumentStatuses((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const doc of initialDocuments) {
        const override = next[doc.document_id];
        if (!override) continue;
        // If server says ready/error and override says the same (or is stale pending/indexing), drop it
        if (doc.status === 'ready' || doc.status === 'error') {
          delete next[doc.document_id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [initialDocuments]);

  // Merge statuses into documents
  const documents = (initialDocuments || []).map((doc) => {
    const override = documentStatuses[doc.document_id];
    if (override) {
      return { ...doc, ...override };
    }
    return doc;
  });

  const isIndexing = documents.some(
    (doc) => doc.status === 'pending' || doc.status === 'indexing',
  );

  // Connect SSE when there are pending/indexing docs
  useEffect(() => {
    if (!collectionId || !hasNonReadyDocs) return;

    const connectSSE = () => {
      const url = `${API_URL}/knowledge/collections/${collectionId}/indexing/stream`;

      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          const updates = {};
          for (const doc of data.documents || []) {
            updates[doc.documentId] = {
              status: doc.status,
              error: doc.error || undefined,
            };
          }
          setDocumentStatuses((prev) => ({ ...prev, ...updates }));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('document_indexing', (e) => {
        try {
          const data = JSON.parse(e.data);
          setDocumentStatuses((prev) => ({
            ...prev,
            [data.documentId]: { status: 'indexing' },
          }));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('document_ready', (e) => {
        try {
          const data = JSON.parse(e.data);
          setDocumentStatuses((prev) => ({
            ...prev,
            [data.documentId]: { status: 'ready' },
          }));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('document_error', (e) => {
        try {
          const data = JSON.parse(e.data);
          setDocumentStatuses((prev) => ({
            ...prev,
            [data.documentId]: {
              status: 'error',
              error: data.error || 'Unbekannter Fehler',
            },
          }));
        } catch {
          // ignore
        }
      });

      eventSource.onerror = () => {
        // SSE disconnected — fall back to polling
        eventSource.close();
        eventSourceRef.current = null;
        startPolling();
      };
    };

    const startPolling = () => {
      if (pollTimerRef.current) return;

      pollTimerRef.current = setInterval(async () => {
        try {
          // Re-check by trying to reconnect SSE
          // If all docs are ready, polling will stop on next effect cleanup
          connectSSE();
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        } catch {
          // ignore, keep polling
        }
      }, 5000);
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [collectionId, hasNonReadyDocs]);

  // Reset statuses when collection changes
  useEffect(() => {
    setDocumentStatuses({});
  }, [collectionId]);

  const retryDocument = useCallback(
    async (docId) => {
      try {
        const res = await apiPost(
          `/knowledge/collections/${collectionId}/documents/${docId}/retry`,
        );
        if (res.ok) {
          setDocumentStatuses((prev) => ({
            ...prev,
            [docId]: { status: 'pending', error: undefined },
          }));
        }
      } catch (err) {
        console.error('Retry failed:', err);
      }
    },
    [collectionId],
  );

  return { documents, isIndexing, retryDocument };
}
