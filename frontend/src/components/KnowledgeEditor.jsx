/**
 * KnowledgeEditor Component
 *
 * Manage knowledge references for a skill:
 * - Collections: Agent searches intelligently with kb_search
 * - Files: Deterministically loaded when skill activates
 */

import { useState, useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';
import { BookIcon, DocumentIcon, TrashIcon } from './Icons';

const styles = {
  container: {},
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sectionHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  addForm: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
    marginBottom: theme.spacing.lg,
  },
  formGroup: {
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.lg,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: 'white',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    height: 'fit-content',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  itemCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  itemMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  removeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    opacity: 0.6,
    transition: `all ${theme.transitions.fast}`,
  },
  emptyState: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  loading: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

function KnowledgeEditor({ knowledge, onChange }) {
  const [collections, setCollections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedFileCollectionId, setSelectedFileCollectionId] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');

  // Load available KB collections
  const loadCollections = useCallback(async () => {
    try {
      const response = await apiGet('/knowledge/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Error loading collections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load documents for a specific collection
  const loadDocuments = useCallback(async (collectionId) => {
    if (!collectionId) {
      setDocuments([]);
      return;
    }
    try {
      const response = await apiGet(`/knowledge/collections/${collectionId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // When file collection changes, load its documents
  useEffect(() => {
    if (selectedFileCollectionId) {
      loadDocuments(selectedFileCollectionId);
    } else {
      setDocuments([]);
    }
  }, [selectedFileCollectionId, loadDocuments]);

  // Filter out already linked collections
  const linkedCollectionIds = new Set(knowledge.collections || []);
  const availableCollections = collections.filter(c => !linkedCollectionIds.has(c.id));

  // Filter out already linked files
  const linkedFileIds = new Set(knowledge.files || []);
  const availableDocuments = documents.filter(d => !linkedFileIds.has(d.id));

  const handleAddCollection = () => {
    if (!selectedCollectionId) return;

    onChange({
      ...knowledge,
      collections: [...(knowledge.collections || []), selectedCollectionId],
    });
    setSelectedCollectionId('');
  };

  const handleRemoveCollection = (collectionId) => {
    onChange({
      ...knowledge,
      collections: (knowledge.collections || []).filter(c => c !== collectionId),
    });
  };

  const handleAddFile = () => {
    if (!selectedDocumentId) return;

    onChange({
      ...knowledge,
      files: [...(knowledge.files || []), selectedDocumentId],
    });
    setSelectedDocumentId('');
  };

  const handleRemoveFile = (fileId) => {
    onChange({
      ...knowledge,
      files: (knowledge.files || []).filter(f => f !== fileId),
    });
  };

  // Get collection info by ID
  const getCollectionInfo = (collectionId) => {
    return collections.find(c => c.id === collectionId) || { id: collectionId, name: collectionId };
  };

  // Get document info by ID
  const getDocumentInfo = (documentId) => {
    return { id: documentId, name: documentId.split('/').pop() || documentId };
  };

  // Get document count - try different field names
  const getDocumentCount = (coll) => {
    return coll.documentCount ?? coll.document_count ?? coll.count ?? null;
  };

  if (loading) {
    return <div style={styles.loading}>Lade Knowledge Base...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Collections Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Collections</h3>
        <p style={styles.sectionHint}>
          Der Agent durchsucht diese Collections intelligent basierend auf der Aufgabe.
        </p>

        <div style={styles.addForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Collection hinzufuegen</label>
            <select
              style={styles.select}
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
            >
              <option value="">Collection waehlen...</option>
              {availableCollections.map((coll) => {
                const count = getDocumentCount(coll);
                return (
                  <option key={coll.id} value={coll.id}>
                    {coll.name}{count !== null ? ` (${count} Dokumente)` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            style={{
              ...styles.addButton,
              opacity: selectedCollectionId ? 1 : 0.5,
              cursor: selectedCollectionId ? 'pointer' : 'not-allowed',
            }}
            onClick={handleAddCollection}
            disabled={!selectedCollectionId}
          >
            Hinzufuegen
          </button>
        </div>

        {!knowledge.collections || knowledge.collections.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Collections verknuepft.
          </div>
        ) : (
          <div style={styles.itemsList}>
            {knowledge.collections.map((collectionId) => {
              const collInfo = getCollectionInfo(collectionId);
              const count = getDocumentCount(collInfo);
              return (
                <div key={collectionId} style={styles.itemCard}>
                  <div style={styles.itemInfo}>
                    <div style={{ ...styles.iconWrapper, backgroundColor: '#f9731615' }}>
                      <BookIcon size={20} color="#f97316" />
                    </div>
                    <div>
                      <div style={styles.itemName}>{collInfo.name}</div>
                      {count !== null && (
                        <div style={styles.itemMeta}>{count} Dokumente</div>
                      )}
                    </div>
                  </div>
                  <button
                    style={styles.removeButton}
                    onClick={() => handleRemoveCollection(collectionId)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = theme.colors.error;
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.opacity = '0.6';
                    }}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Direct Files Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Direkte Dateien</h3>
        <p style={styles.sectionHint}>
          Diese Dateien werden automatisch geladen wenn der Skill aktiviert wird.
        </p>

        <div style={styles.addForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Collection</label>
            <select
              style={styles.select}
              value={selectedFileCollectionId}
              onChange={(e) => {
                setSelectedFileCollectionId(e.target.value);
                setSelectedDocumentId('');
              }}
            >
              <option value="">Collection waehlen...</option>
              {collections.map((coll) => (
                <option key={coll.id} value={coll.id}>
                  {coll.name}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Dokument</label>
            <select
              style={styles.select}
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              disabled={!selectedFileCollectionId}
            >
              <option value="">
                {!selectedFileCollectionId ? 'Erst Collection waehlen...' : 'Dokument waehlen...'}
              </option>
              {availableDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || doc.name || doc.id}
                </option>
              ))}
            </select>
          </div>
          <button
            style={{
              ...styles.addButton,
              opacity: selectedDocumentId ? 1 : 0.5,
              cursor: selectedDocumentId ? 'pointer' : 'not-allowed',
            }}
            onClick={handleAddFile}
            disabled={!selectedDocumentId}
          >
            Hinzufuegen
          </button>
        </div>

        {!knowledge.files || knowledge.files.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Dateien verknuepft.
          </div>
        ) : (
          <div style={styles.itemsList}>
            {knowledge.files.map((fileId) => {
              const docInfo = getDocumentInfo(fileId);
              return (
                <div key={fileId} style={styles.itemCard}>
                  <div style={styles.itemInfo}>
                    <div style={{ ...styles.iconWrapper, backgroundColor: '#3b82f615' }}>
                      <DocumentIcon size={20} color="#3b82f6" />
                    </div>
                    <div>
                      <div style={styles.itemName}>{docInfo.name}</div>
                      <div style={styles.itemMeta}>{fileId}</div>
                    </div>
                  </div>
                  <button
                    style={styles.removeButton}
                    onClick={() => handleRemoveFile(fileId)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = theme.colors.error;
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.opacity = '0.6';
                    }}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgeEditor;
