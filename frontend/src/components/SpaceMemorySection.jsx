/**
 * SpaceMemorySection Component
 *
 * Memory management for spaces (about, instructions, context).
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { useSpaceMemory } from '../hooks/useSpaces';
import { UserIcon, ClipboardIcon, TargetIcon } from './Icons';

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
    minWidth: '120px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: '#9333ea',
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionIcon: {
    color: '#9333ea',
    flexShrink: 0,
  },
  sectionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  itemCard: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  itemMeta: {
    display: 'flex',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    alignItems: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  badgeHigh: {
    backgroundColor: '#10b98120',
    color: '#10b981',
  },
  badgeNormal: {
    backgroundColor: '#9333ea20',
    color: '#9333ea',
  },
  badgeActive: {
    backgroundColor: '#10b98120',
    color: '#10b981',
  },
  badgeInactive: {
    backgroundColor: '#6b728020',
    color: '#6b7280',
  },
  deleteButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    opacity: 0.6,
  },
  addForm: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  input: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    outline: 'none',
  },
  select: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
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
  },
  contextName: {
    fontWeight: theme.typography.weights.medium,
  },
  contextDesc: {
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  toggleButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
  },
};

export default function SpaceMemorySection({ spaceId }) {
  const {
    memory,
    loading,
    error,
    stats,
    addAbout,
    addInstruction,
    addContext,
    setContextActive,
    deleteItem,
  } = useSpaceMemory(spaceId);

  const [newAbout, setNewAbout] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [newInstructionPriority, setNewInstructionPriority] = useState('normal');
  const [newContextName, setNewContextName] = useState('');
  const [newContextDesc, setNewContextDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddAbout = async () => {
    if (!newAbout.trim()) return;
    setIsAdding(true);
    try {
      await addAbout(newAbout.trim());
      setNewAbout('');
    } catch (err) {
      console.error('Failed to add:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddInstruction = async () => {
    if (!newInstruction.trim()) return;
    setIsAdding(true);
    try {
      await addInstruction(newInstruction.trim(), newInstructionPriority);
      setNewInstruction('');
      setNewInstructionPriority('normal');
    } catch (err) {
      console.error('Failed to add:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddContext = async () => {
    if (!newContextName.trim()) return;
    setIsAdding(true);
    try {
      await addContext(newContextName.trim(), newContextDesc.trim());
      setNewContextName('');
      setNewContextDesc('');
    } catch (err) {
      console.error('Failed to add:', err);
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Lade Memory-Daten...</div>;
  }

  if (error) {
    return <div style={styles.error}>Fehler: {error}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.about || 0}</div>
          <div style={styles.statLabel}>Fakten</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.instructions || 0}</div>
          <div style={styles.statLabel}>Anweisungen</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.activeContext || 0}</div>
          <div style={styles.statLabel}>Aktive Phasen</div>
        </div>
      </div>

      {/* About Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              <UserIcon size={20} style={styles.sectionIcon} />
              Ueber den Space
            </div>
            <div style={styles.sectionDescription}>
              Fakten zum Space: Zweck, Team, Kontext
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={styles.input}
              placeholder="z.B. 'Redesign der Firmen-Website'"
              value={newAbout}
              onChange={(e) => setNewAbout(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddAbout()}
            />
            <button
              style={styles.addButton}
              onClick={handleAddAbout}
              disabled={isAdding || !newAbout.trim()}
            >
              + Hinzufuegen
            </button>
          </div>

          {memory?.about?.length === 0 ? (
            <div style={styles.emptyState}>Keine Eintraege vorhanden.</div>
          ) : (
            <div style={styles.itemList}>
              {memory?.about?.map((item) => (
                <div key={item.id} style={styles.itemCard}>
                  <div style={styles.itemContent}>
                    <div style={styles.itemText}>{item.content}</div>
                    <div style={styles.itemMeta}>
                      <span>{new Date(item.added_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteItem('about', item.id)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              <ClipboardIcon size={20} style={styles.sectionIcon} />
              Anweisungen
            </div>
            <div style={styles.sectionDescription}>
              Wie der Assistent im Space-Kontext arbeiten soll
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={styles.input}
              placeholder="z.B. 'Verwende immer die Markensprache'"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddInstruction()}
            />
            <select
              style={styles.select}
              value={newInstructionPriority}
              onChange={(e) => setNewInstructionPriority(e.target.value)}
            >
              <option value="high">Wichtig</option>
              <option value="normal">Normal</option>
            </select>
            <button
              style={styles.addButton}
              onClick={handleAddInstruction}
              disabled={isAdding || !newInstruction.trim()}
            >
              + Hinzufuegen
            </button>
          </div>

          {memory?.instructions?.length === 0 ? (
            <div style={styles.emptyState}>Keine Anweisungen vorhanden.</div>
          ) : (
            <div style={styles.itemList}>
              {memory?.instructions?.map((item) => (
                <div key={item.id} style={styles.itemCard}>
                  <div style={styles.itemContent}>
                    <div style={styles.itemText}>{item.content}</div>
                    <div style={styles.itemMeta}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(item.priority === 'high' ? styles.badgeHigh : styles.badgeNormal),
                        }}
                      >
                        {item.priority === 'high' ? 'Wichtig' : 'Normal'}
                      </span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteItem('instructions', item.id)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Context Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              <TargetIcon size={20} style={styles.sectionIcon} />
              Aktuelle Phase
            </div>
            <div style={styles.sectionDescription}>
              Phasen und Aufgaben im Space
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={{ ...styles.input, flex: '0 0 200px' }}
              placeholder="Phasenname"
              value={newContextName}
              onChange={(e) => setNewContextName(e.target.value)}
            />
            <input
              type="text"
              style={styles.input}
              placeholder="Beschreibung (optional)"
              value={newContextDesc}
              onChange={(e) => setNewContextDesc(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddContext()}
            />
            <button
              style={styles.addButton}
              onClick={handleAddContext}
              disabled={isAdding || !newContextName.trim()}
            >
              + Hinzufuegen
            </button>
          </div>

          {memory?.context?.length === 0 ? (
            <div style={styles.emptyState}>Keine Phasen vorhanden.</div>
          ) : (
            <div style={styles.itemList}>
              {memory?.context?.map((item) => (
                <div key={item.id} style={styles.itemCard}>
                  <div style={styles.itemContent}>
                    <div style={styles.itemText}>
                      <span style={styles.contextName}>{item.name}</span>
                      {item.description && (
                        <span style={styles.contextDesc}>— {item.description}</span>
                      )}
                    </div>
                    <div style={styles.itemMeta}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(item.active ? styles.badgeActive : styles.badgeInactive),
                        }}
                      >
                        {item.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      <button
                        style={styles.toggleButton}
                        onClick={() => setContextActive(item.id, !item.active)}
                      >
                        {item.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </div>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteItem('context', item.id)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
