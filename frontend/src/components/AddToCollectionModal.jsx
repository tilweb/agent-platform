/**
 * AddToCollectionModal
 *
 * Modal for adding selected search items to an existing KB collection.
 * Uses SSE for progress tracking during indexing.
 */

import { useState, useEffect, useMemo } from 'react';
import { theme } from '../config/theme';
import { getContentTypeIcon } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.xl,
    width: '90%',
    maxWidth: '600px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  collectionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  collectionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    border: `2px solid transparent`,
    transition: `all ${theme.transitions.fast}`,
  },
  collectionItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  collectionRadio: {
    width: '18px',
    height: '18px',
    accentColor: theme.colors.primary,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  collectionDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  collectionCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
  },
  emptyCollections: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  loadingCollections: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  itemsSection: {
    marginTop: theme.spacing.lg,
  },
  itemsGroup: {
    marginBottom: theme.spacing.md,
  },
  itemsGroupTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  item: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  // Progress styles
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  progressHeader: {
    textAlign: 'center',
  },
  progressTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  progressSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  progressBar: {
    height: '8px',
    backgroundColor: theme.colors.border,
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    transition: 'width 0.3s ease',
  },
  progressItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  progressItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
  progressItemIcon: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressItemSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTopColor: theme.colors.primary,
    borderRightColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  progressItemTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressItemStatus: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  // Complete view
  completeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
    textAlign: 'center',
  },
  completeIcon: {
    width: '64px',
    height: '64px',
    backgroundColor: '#dcfce7',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  completeStats: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  viewButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  errorMessage: {
    padding: theme.spacing.md,
    backgroundColor: '#fef2f2',
    border: `1px solid #fecaca`,
    borderRadius: theme.borderRadius.md,
    color: '#dc2626',
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
};

const sourceLabels = {
  chats: 'Chats',
  chat: 'Chat',
  knowledge: 'Knowledge Base',
  confluence: 'Confluence',
  gdrive: 'Google Drive',
  contract: 'Vertragsmanagement',
};

// sourceIcons now uses getContentTypeIcon from Icons.jsx

function AddToCollectionModal({ isOpen, onClose, selectedItems, onSuccess }) {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    items: {},
  });
  const [result, setResult] = useState(null);

  // Load collections on mount
  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await fetch(`${API_URL}/knowledge/collections`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Collections');
      }
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCollections(false);
    }
  };

  // Group items by type
  const groupedItems = useMemo(() => {
    return (selectedItems || []).reduce((acc, item) => {
      const type = item.type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {});
  }, [selectedItems]);

  const handleAdd = async () => {
    if (!selectedCollection) {
      setError('Bitte wähle eine Collection aus');
      return;
    }

    setIsAdding(true);
    setError(null);
    setProgress({
      current: 0,
      total: selectedItems.length,
      items: {},
    });

    try {
      const response = await fetch(`${API_URL}/knowledge/collections/${selectedCollection.id}/add/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: selectedItems,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Fehler beim Hinzufügen der Dokumente';
        try {
          const text = await response.text();
          if (text && text.length < 200) {
            errorMessage = text;
          }
        } catch { /* ignore */ }
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleProgressEvent(data);
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setIsAdding(false);
    }
  };

  const handleProgressEvent = (data) => {
    if (data.step === 'index') {
      setProgress((prev) => ({
        ...prev,
        current: data.current || prev.current,
        items: {
          ...prev.items,
          [data.itemId]: {
            status: data.status,
            title: data.title,
            error: data.error,
            documentId: data.documentId,
          },
        },
      }));
    } else if (data.collectionId) {
      // Done event
      setResult(data);
      setIsComplete(true);
      setIsAdding(false);
    } else if (data.error) {
      setError(data.error);
      setIsAdding(false);
    }
  };

  const handleViewCollection = () => {
    onSuccess?.(result?.collectionId || selectedCollection?.id);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setSelectedCollection(null);
    setIsAdding(false);
    setIsComplete(false);
    setError(null);
    setProgress({ current: 0, total: 0, items: {} });
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div style={styles.header}>
          <h2 style={styles.title}>
            {isComplete ? 'Dokumente hinzugefügt' : isAdding ? 'Dokumente werden hinzugefügt...' : 'Zu Collection hinzufügen'}
          </h2>
          {!isAdding && (
            <button onClick={handleClose} style={styles.closeButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div style={styles.content}>
          {isComplete ? (
            <div style={styles.completeContainer}>
              <div style={styles.completeIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div style={styles.completeTitle}>
                Dokumente zu "{selectedCollection?.name}" hinzugefügt!
              </div>
              <div style={styles.completeStats}>
                {result?.successCount || 0} von {result?.totalItems || selectedItems.length} Dokumenten hinzugefügt
                {result?.errorCount > 0 && (
                  <span style={{ color: '#dc2626' }}> ({result.errorCount} Fehler)</span>
                )}
              </div>
              <button onClick={handleViewCollection} style={styles.viewButton}>
                Collection öffnen
              </button>
            </div>
          ) : isAdding ? (
            <div style={styles.progressContainer}>
              <div style={styles.progressHeader}>
                <div style={styles.progressTitle}>
                  Dokumente werden hinzugefügt ({progress.current}/{selectedItems.length})
                </div>
                <div style={styles.progressSubtitle}>
                  Bitte warte, bis alle Dokumente verarbeitet wurden.
                </div>
              </div>

              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>

              <div style={styles.progressItems}>
                {selectedItems.map((item) => {
                  const itemProgress = progress.items[item.id];
                  return (
                    <div key={`${item.type}-${item.id}`} style={styles.progressItem}>
                      <div style={styles.progressItemIcon}>
                        {itemProgress?.status === 'in_progress' ? (
                          <div style={styles.progressItemSpinner} />
                        ) : itemProgress?.status === 'complete' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        ) : itemProgress?.status === 'error' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        )}
                      </div>
                      <span style={styles.progressItemTitle}>{item.title}</span>
                      <span style={styles.progressItemStatus}>
                        {sourceLabels[item.type] || item.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {error && <div style={styles.errorMessage}>{error}</div>}

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Collection auswählen</div>

                {loadingCollections ? (
                  <div style={styles.loadingCollections}>Lade Collections...</div>
                ) : collections.length === 0 ? (
                  <div style={styles.emptyCollections}>
                    Keine Collections vorhanden. Erstelle zuerst eine Collection.
                  </div>
                ) : (
                  <div style={styles.collectionsGrid}>
                    {collections.map((collection) => (
                      <div
                        key={collection.id}
                        style={{
                          ...styles.collectionItem,
                          ...(selectedCollection?.id === collection.id ? styles.collectionItemSelected : {}),
                        }}
                        onClick={() => setSelectedCollection(collection)}
                      >
                        <input
                          type="radio"
                          name="collection"
                          checked={selectedCollection?.id === collection.id}
                          onChange={() => setSelectedCollection(collection)}
                          style={styles.collectionRadio}
                        />
                        <div style={styles.collectionInfo}>
                          <div style={styles.collectionName}>{collection.name}</div>
                          {collection.description && (
                            <div style={styles.collectionDescription}>{collection.description}</div>
                          )}
                        </div>
                        <span style={styles.collectionCount}>
                          {collection.document_count || 0} Dok.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.itemsSection}>
                <div style={styles.sectionTitle}>
                  Hinzuzufügende Dokumente ({selectedItems.length})
                </div>

                {Object.entries(groupedItems).map(([type, items]) => (
                  <div key={type} style={styles.itemsGroup}>
                    <div style={styles.itemsGroupTitle}>
                      {getContentTypeIcon(type, { size: 16 })}
                      <span>{sourceLabels[type] || type} ({items.length})</span>
                    </div>
                    <div style={styles.itemsList}>
                      {items.map((item) => (
                        <div key={item.id} style={styles.item}>
                          {item.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!isAdding && !isComplete && (
          <div style={styles.footer}>
            <button onClick={handleClose} style={styles.cancelButton}>
              Abbrechen
            </button>
            <button
              onClick={handleAdd}
              style={{
                ...styles.addButton,
                opacity: !selectedCollection ? 0.5 : 1,
                cursor: !selectedCollection ? 'not-allowed' : 'pointer',
              }}
              disabled={!selectedCollection}
            >
              Hinzufügen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddToCollectionModal;
