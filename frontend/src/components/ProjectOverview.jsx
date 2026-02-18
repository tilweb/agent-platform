/**
 * ProjectOverview Component
 *
 * Overview tab content for project detail page.
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { UserIcon, ChatIcon, BookIcon, ClipboardIcon } from './Icons';

const styles = {
  container: {},
  statsRow: {
    display: 'flex',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    minWidth: '140px',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {},
  statValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
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
    marginBottom: theme.spacing.lg,
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
  saveButton: {
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
  infoRow: {
    display: 'flex',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  infoItem: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    marginRight: theme.spacing.xs,
  },
};

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectOverview({ project, onUpdate, onRefresh }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = name !== project.name || description !== (project.description || '');

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onUpdate({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const memberCount = project.members?.length || 1;

  return (
    <div style={styles.container}>
      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: '#3b82f615' }}>
            <UserIcon size={20} color="#3b82f6" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{memberCount}</div>
            <div style={styles.statLabel}>{memberCount === 1 ? 'Mitglied' : 'Mitglieder'}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: '#14b8a615' }}>
            <ChatIcon size={20} color="#14b8a6" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>-</div>
            <div style={styles.statLabel}>Chats</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: '#f9731615' }}>
            <BookIcon size={20} color="#f97316" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>-</div>
            <div style={styles.statLabel}>KB Collections</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, backgroundColor: '#ec489915' }}>
            <ClipboardIcon size={20} color="#ec4899" />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>-</div>
            <div style={styles.statLabel}>Memory Items</div>
          </div>
        </div>
      </div>

      {/* Edit Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Space-Details</h3>

        <div style={styles.formGroup}>
          <label style={styles.label}>Name</label>
          <input
            type="text"
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Beschreibung</label>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Worum geht es in diesem Space?"
          />
        </div>

        {hasChanges && (
          <button
            style={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c22ce'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
          </button>
        )}

        <div style={styles.infoRow}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Erstellt:</span>
            {formatDate(project.createdAt)}
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Aktualisiert:</span>
            {formatDate(project.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
