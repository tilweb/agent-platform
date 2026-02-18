/**
 * CreateCollectionModal
 *
 * Modal for creating a new KB collection from selected search items.
 * Uses SSE for progress tracking during indexing.
 */

import { useState, useMemo, useCallback } from 'react';
import { theme } from '../config/theme';
import { getContentTypeIcon } from './Icons';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  input: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  textarea: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  itemsSection: {
    marginTop: theme.spacing.lg,
  },
  itemsSectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
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
  createButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  // Progress view styles
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
  },
};

const sourceLabels = {
  chats: 'Chats',
  knowledge: 'Knowledge Base',
  confluence: 'Confluence',
  gdrive: 'Google Drive',
};

// sourceIcons now uses getContentTypeIcon from Icons.jsx

function CreateCollectionModal({ isOpen, onClose, selectedItems, onSuccess }) {
  const [collectionId, setCollectionId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    items: {},
    collectionStep: 'pending',
  });
  const [result, setResult] = useState(null);

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

  // Auto-generate collection ID from name
  const handleNameChange = useCallback((value) => {
    setName(value);
    if (!collectionId || collectionId === generateId(name)) {
      setCollectionId(generateId(value));
    }
  }, [collectionId, name]);

  function generateId(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
  }

  const handleCreate = async () => {
    if (!collectionId.trim() || !name.trim()) {
      setError('Collection-ID und Name sind erforderlich');
      return;
    }

    setIsCreating(true);
    setError(null);
    setProgress({
      current: 0,
      total: selectedItems.length + 1,
      items: {},
      collectionStep: 'in_progress',
    });

    try {
      const response = await fetch(`${API_URL}/knowledge/collections/batch/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          collection_id: collectionId,
          name,
          description,
          items: selectedItems,
        }),
      });

      if (!response.ok) {
        // Try to parse JSON error, fall back to text or generic message
        let errorMessage = 'Fehler beim Erstellen der Collection';
        const contentType = response.headers.get('content-type') || '';

        try {
          const text = await response.text();

          // Only try to parse as JSON if Content-Type indicates JSON
          if (contentType.includes('application/json')) {
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || errorMessage;
            } catch {
              // JSON parse failed, use text
              if (text && text.length < 200) {
                errorMessage = text;
              }
            }
          } else if (text && text.length < 200) {
            // Not JSON, use text directly
            errorMessage = text;
          }
        } catch {
          // Couldn't read response body
        }
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
          if (line.startsWith('event: ')) {
            // Skip event type lines, we handle the data
            continue;
          }
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
      setIsCreating(false);
    }
  };

  const handleProgressEvent = (data) => {
    if (data.step === 'create_collection') {
      setProgress((prev) => ({
        ...prev,
        collectionStep: data.status,
        current: data.status === 'complete' ? 1 : 0,
      }));
    } else if (data.step === 'index') {
      setProgress((prev) => ({
        ...prev,
        current: 1 + (data.current || 0),
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
      setIsCreating(false);
    } else if (data.error) {
      setError(data.error);
      setIsCreating(false);
    }
  };

  const handleViewCollection = () => {
    onSuccess?.(result?.collectionId || collectionId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div style={styles.header}>
          <h2 style={styles.title}>
            {isComplete ? 'Collection erstellt' : isCreating ? 'Collection wird erstellt...' : 'Collection erstellen'}
          </h2>
          {!isCreating && (
            <button onClick={onClose} style={styles.closeButton}>
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
                Collection "{result?.collectionName || name}" wurde erstellt!
              </div>
              <div style={styles.completeStats}>
                {result?.successCount || 0} von {result?.totalItems || selectedItems.length} Dokumenten indiziert
                {result?.errorCount > 0 && (
                  <span style={{ color: '#dc2626' }}> ({result.errorCount} Fehler)</span>
                )}
              </div>
              <button onClick={handleViewCollection} style={styles.viewButton}>
                Collection öffnen
              </button>
            </div>
          ) : isCreating ? (
            <div style={styles.progressContainer}>
              <div style={styles.progressHeader}>
                <div style={styles.progressTitle}>
                  {progress.collectionStep !== 'complete'
                    ? 'Collection wird erstellt...'
                    : `Dokumente werden indiziert (${progress.current - 1}/${selectedItems.length})`}
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
                {/* Collection step */}
                <div style={styles.progressItem}>
                  <div style={styles.progressItemIcon}>
                    {progress.collectionStep === 'in_progress' ? (
                      <div style={styles.progressItemSpinner} />
                    ) : progress.collectionStep === 'complete' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    ) : progress.collectionStep === 'error' ? (
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
                  <span style={styles.progressItemTitle}>Collection "{name}" erstellen</span>
                </div>

                {/* Document items */}
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

              <div style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="z.B. Projektwissen, IT-Dokumentation"
                    style={styles.input}
                    autoFocus
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Collection-ID</label>
                  <input
                    type="text"
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    placeholder="automatisch generiert"
                    style={styles.input}
                  />
                  <span style={styles.hint}>
                    Eindeutiger Identifier (nur Kleinbuchstaben, Zahlen, Bindestriche)
                  </span>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Beschreibung</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Wofür ist diese Collection gedacht?"
                    style={styles.textarea}
                  />
                </div>
              </div>

              <div style={styles.itemsSection}>
                <div style={styles.itemsSectionTitle}>
                  Zu indizierende Dokumente ({selectedItems.length})
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

        {!isCreating && !isComplete && (
          <div style={styles.footer}>
            <button onClick={onClose} style={styles.cancelButton}>
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              style={{
                ...styles.createButton,
                opacity: !collectionId.trim() || !name.trim() ? 0.5 : 1,
                cursor: !collectionId.trim() || !name.trim() ? 'not-allowed' : 'pointer',
              }}
              disabled={!collectionId.trim() || !name.trim()}
            >
              Collection erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateCollectionModal;
