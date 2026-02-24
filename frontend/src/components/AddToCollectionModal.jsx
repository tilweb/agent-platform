/**
 * AddToCollectionModal
 *
 * Modal for adding selected search items to an existing or new KB collection.
 * Documents are enqueued for async background indexing — the modal closes immediately.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, API_URL } from '../utils/apiFetch';
import { getContentTypeIcon } from './Icons';
import ItemThumbnail from './ItemThumbnail';
import DocumentThumbnail from './DocumentThumbnail';
import { useToast } from './Toast';

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
  loadingCollections: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  createNewForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} 0 0 ${theme.spacing.xl}`,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  formLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  formInput: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  formTextarea: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
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
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  itemTitle: {
    flex: 1,
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
  errorMessage: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.error,
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

function generateCollectionId(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function AddToCollectionModal({ isOpen, onClose, selectedItems, onSuccess }) {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [createNew, setCreateNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await apiGet('/knowledge/collections');
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

  const handleNewNameChange = useCallback((value) => {
    setNewName(value);
  }, []);

  const selectCreateNew = useCallback(() => {
    setCreateNew(true);
    setSelectedCollection(null);
  }, []);

  const selectExisting = useCallback((collection) => {
    setCreateNew(false);
    setSelectedCollection(collection);
  }, []);

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

  const canSubmit = createNew ? newName.trim().length > 0 : selectedCollection !== null;

  const handleAdd = async () => {
    if (!canSubmit) {
      setError(createNew ? 'Bitte gib einen Namen ein' : 'Bitte wähle eine Collection aus');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let collectionId;
      let collectionName;

      if (createNew) {
        collectionId = generateCollectionId(newName);
        collectionName = newName.trim();

        const response = await apiPost('/knowledge/collections/batch/stream', {
          collection_id: collectionId,
          name: collectionName,
          description: newDescription.trim(),
          items: selectedItems,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Fehler (Status: ${response.status})`);
        }
      } else {
        collectionId = selectedCollection.id;
        collectionName = selectedCollection.name;

        const response = await apiPost(`/knowledge/collections/${collectionId}/add/stream`, {
          items: selectedItems,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Fehler (Status: ${response.status})`);
        }
      }

      // Success — show toast and close modal
      const count = selectedItems.length;
      toast.success(
        'Dokumente werden indiziert',
        `${count} ${count === 1 ? 'Dokument wird' : 'Dokumente werden'} im Hintergrund zu "${collectionName}" hinzugefügt.`,
      );

      onSuccess?.(collectionId);
      handleClose();
    } catch (err) {
      setError(err.message);
      toast.error('Fehler', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedCollection(null);
    setCreateNew(false);
    setNewName('');
    setNewDescription('');
    setIsSubmitting(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Zu Collection hinzufügen</h2>
          <button onClick={handleClose} style={styles.closeButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={styles.content}>
          {error && <div style={styles.errorMessage}>{error}</div>}

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Collection auswählen</div>

            {loadingCollections ? (
              <div style={styles.loadingCollections}>Lade Collections...</div>
            ) : (
              <div style={styles.collectionsGrid}>
                {/* Create new collection option */}
                <div
                  style={{
                    ...styles.collectionItem,
                    ...(createNew ? styles.collectionItemSelected : {}),
                  }}
                  onClick={selectCreateNew}
                >
                  <input
                    type="radio"
                    name="collection"
                    checked={createNew}
                    onChange={selectCreateNew}
                    style={styles.collectionRadio}
                  />
                  <div style={styles.collectionInfo}>
                    <div style={styles.collectionName}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Neue Collection erstellen
                    </div>
                  </div>
                </div>

                {/* Inline form when creating new */}
                {createNew && (
                  <div style={styles.createNewForm}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Name *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => handleNewNameChange(e.target.value)}
                        placeholder="z.B. Projektwissen, IT-Dokumentation"
                        style={styles.formInput}
                        autoFocus
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Beschreibung</label>
                      <textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Wofür ist diese Collection gedacht?"
                        style={styles.formTextarea}
                      />
                    </div>
                  </div>
                )}

                {/* Existing collections */}
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    style={{
                      ...styles.collectionItem,
                      ...(!createNew && selectedCollection?.id === collection.id ? styles.collectionItemSelected : {}),
                    }}
                    onClick={() => selectExisting(collection)}
                  >
                    <input
                      type="radio"
                      name="collection"
                      checked={!createNew && selectedCollection?.id === collection.id}
                      onChange={() => selectExisting(collection)}
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

            <div style={styles.itemsList}>
              {selectedItems.map((item) => {
                const hasAttachment = item.metadata?.attachmentId && item.metadata?.chatId;
                const attachmentUrl = hasAttachment
                  ? `${API_URL}/chats/${item.metadata.chatId}/attachments/${item.metadata.attachmentId}`
                  : undefined;
                const imageUrl = attachmentUrl || item.metadata?.thumbnailLink || item.metadata?.url;
                const isImage = item.metadata?.mimeType?.startsWith('image/') ||
                  item.metadata?.materialType === 'generated_image';

                return (
                  <div key={item.id} style={styles.item}>
                    {imageUrl && isImage ? (
                      <DocumentThumbnail
                        size={32}
                        filename={item.metadata?.source_file || item.metadata?.filename || item.title}
                        mimeType={item.metadata?.mimeType}
                        url={imageUrl}
                      />
                    ) : attachmentUrl ? (
                      <DocumentThumbnail
                        size={32}
                        filename={item.metadata?.source_file || item.metadata?.filename || item.title}
                        mimeType={item.metadata?.mimeType}
                        url={attachmentUrl}
                      />
                    ) : (
                      <ItemThumbnail item={item} size={32} />
                    )}
                    <span style={styles.itemTitle}>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={handleClose} style={styles.cancelButton}>
            Abbrechen
          </button>
          <button
            onClick={handleAdd}
            style={{
              ...styles.addButton,
              opacity: !canSubmit || isSubmitting ? 0.5 : 1,
              cursor: !canSubmit || isSubmitting ? 'not-allowed' : 'pointer',
            }}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Wird hinzugefügt...' : createNew ? 'Erstellen & hinzufügen' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddToCollectionModal;
