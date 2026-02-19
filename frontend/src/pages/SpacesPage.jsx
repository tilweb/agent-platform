/**
 * SpacesPage
 *
 * Overview page for all spaces (projects, initiatives, teams) the user has access to.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useSpaces } from '../hooks/useSpaces';
import SpaceCard from '../components/SpaceCard';
import { BriefcaseIcon, SparklesIcon, ArchiveIcon } from '../components/Icons';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing['2xl'],
  },
  headerLeft: {},
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  titleIcon: {
    color: '#9333ea',
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: '#9333ea',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.xl,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'center',
  },
  emptyIcon: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    maxWidth: '400px',
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
  },
  // Modal styles
  modalOverlay: {
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
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: '500px',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
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
  submitButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

export default function SpacesPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { spaces, loading, error, createSpace } = useSpaces(showArchived);

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    setIsCreating(true);
    try {
      const space = await createSpace(newSpaceName.trim(), {
        description: newSpaceDescription.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewSpaceName('');
      setNewSpaceDescription('');
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      console.error('Failed to create space:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSpaceClick = (spaceId) => {
    navigate(`/spaces/${spaceId}`);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Spaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Fehler: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>
            <BriefcaseIcon size={28} style={styles.titleIcon} />
            Spaces
          </h1>
          <p style={styles.subtitle}>
            Arbeite mit Kollegen in gemeinsamen Spaces - für Projekte, Initiativen oder Teams
          </p>
        </div>
        <button
          style={styles.createButton}
          onClick={() => setShowCreateModal(true)}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c22ce'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
        >
          <SparklesIcon size={16} />
          Neuer Space
        </button>
      </div>

      <div style={styles.toggleRow}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <ArchiveIcon size={16} />
          Archivierte anzeigen
        </label>
      </div>

      {spaces.length === 0 ? (
        <div style={styles.emptyState}>
          <BriefcaseIcon size={48} style={styles.emptyIcon} />
          <div style={styles.emptyTitle}>Keine Spaces vorhanden</div>
          <p style={styles.emptyText}>
            Erstelle deinen ersten Space, um mit deinem Team zusammenzuarbeiten.
            Spaces ermöglichen gemeinsame Chats, Memory und Knowledge Base.
          </p>
          <button
            style={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            <SparklesIcon size={16} />
            Ersten Space erstellen
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              onClick={() => handleSpaceClick(space.id)}
            />
          ))}
        </div>
      )}

      {/* Create Space Modal */}
      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={styles.modalTitle}>Neuen Space erstellen</h2>
            <form onSubmit={handleCreateSpace}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="z.B. Marketing Team, Projekt Alpha, Initiative 2024"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Beschreibung (optional)</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Worum geht es in diesem Space?"
                  value={newSpaceDescription}
                  onChange={(e) => setNewSpaceDescription(e.target.value)}
                />
              </div>
              <div style={styles.modalButtons}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowCreateModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  style={styles.submitButton}
                  disabled={isCreating || !newSpaceName.trim()}
                >
                  {isCreating ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
