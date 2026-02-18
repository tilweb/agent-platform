/**
 * ProjectKBLinks Component
 *
 * Manage KB collection links for a project.
 */

import { useState, useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { useProjectKBLinks } from '../hooks/useProjects';
import { apiGet } from '../utils/apiFetch';
import { BookIcon, LinkIcon, TrashIcon } from './Icons';

const styles = {
  container: {},
  infoCard: {
    backgroundColor: '#9333ea10',
    borderRadius: theme.borderRadius.lg,
    border: `1px solid #9333ea30`,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  addSection: {
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
    marginBottom: theme.spacing.lg,
  },
  addForm: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
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
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: '#9333ea',
    color: 'white',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    height: 'fit-content',
  },
  linksSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  linksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  linkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#f9731615',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  linkName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  linkMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  removeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: '#ef444420',
    color: '#ef4444',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
};

export default function ProjectKBLinks({ projectId }) {
  const { links, loading, error, linkCollection, unlinkCollection } = useProjectKBLinks(projectId);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Load available KB collections
  const loadCollections = useCallback(async () => {
    try {
      setCollectionsLoading(true);
      const response = await apiGet('/knowledge/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Error loading collections:', err);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Filter out already linked collections
  const linkedIds = new Set((links.collections || []).map(l => l.collectionId));
  const availableCollections = collections.filter(c => !linkedIds.has(c.id));

  const handleLinkCollection = async () => {
    if (!selectedCollectionId) return;

    setIsLinking(true);
    setActionError(null);
    try {
      await linkCollection(selectedCollectionId);
      setSelectedCollectionId('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkCollection = async (collectionId) => {
    if (!confirm('Verkuepfung wirklich aufheben?')) return;

    setActionError(null);
    try {
      await unlinkCollection(collectionId);
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Get collection info
  const getCollectionInfo = (collectionId) => {
    return collections.find(c => c.id === collectionId) || { id: collectionId, name: collectionId };
  };

  if (loading || collectionsLoading) {
    return <div style={styles.loading}>Lade Knowledge Base Verknuepfungen...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.infoCard}>
        <strong>Knowledge Base Verknuepfung</strong><br />
        Verknuepfte Collections werden automatisch bei RAG-Suchen im Space-Chat priorisiert.
        Der Assistent kann auf diese Wissensbasis zugreifen.
      </div>

      {actionError && (
        <div style={styles.error}>{actionError}</div>
      )}

      {/* Add Collection Section */}
      <div style={styles.addSection}>
        <h3 style={styles.sectionTitle}>Collection verknuepfen</h3>
        <div style={styles.addForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Knowledge Base Collection</label>
            <select
              style={styles.select}
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
            >
              <option value="">Collection waehlen...</option>
              {availableCollections.map((coll) => (
                <option key={coll.id} value={coll.id}>
                  {coll.name} ({coll.documentCount || 0} Dokumente)
                </option>
              ))}
            </select>
          </div>
          <button
            style={styles.addButton}
            onClick={handleLinkCollection}
            disabled={isLinking || !selectedCollectionId}
          >
            {isLinking ? 'Verknuepfe...' : '+ Verknuepfen'}
          </button>
        </div>
      </div>

      {/* Linked Collections */}
      <div style={styles.linksSection}>
        <h3 style={styles.sectionTitle}>Verknuepfte Collections ({links.collections?.length || 0})</h3>

        {!links.collections || links.collections.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Collections verknuepft. Verknuepfe eine Knowledge Base Collection,
            um dem Assistenten Space-Wissen zur Verfuegung zu stellen.
          </div>
        ) : (
          <div style={styles.linksList}>
            {links.collections.map((link) => {
              const collInfo = getCollectionInfo(link.collectionId);
              return (
                <div key={link.collectionId} style={styles.linkCard}>
                  <div style={styles.linkInfo}>
                    <div style={styles.iconWrapper}>
                      <BookIcon size={20} color="#f97316" />
                    </div>
                    <div>
                      <div style={styles.linkName}>{collInfo.name}</div>
                      <div style={styles.linkMeta}>
                        {collInfo.documentCount !== undefined && `${collInfo.documentCount} Dokumente`}
                        {link.linkedAt && ` • Verknuepft am ${new Date(link.linkedAt).toLocaleDateString('de-DE')}`}
                      </div>
                    </div>
                  </div>
                  <button
                    style={styles.removeButton}
                    onClick={() => handleUnlinkCollection(link.collectionId)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#ef4444';
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
