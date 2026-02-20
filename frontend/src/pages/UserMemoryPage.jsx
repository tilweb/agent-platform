/**
 * UserMemoryPage (v2)
 *
 * UI for viewing and managing user memory data.
 * Three sections: About, Instructions, Context
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { useUserMemory } from '../hooks/useUserMemory';
import { UserIcon, ClipboardIcon, TargetIcon } from '../components/Icons';
import Select from '../components/Select';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    width: '100%',
  },
  header: {
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
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
    color: theme.colors.primary,
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
    backgroundColor: `${theme.colors.primary}20`,
    color: theme.colors.primary,
  },
  badgeActive: {
    backgroundColor: '#10b98120',
    color: '#10b981',
  },
  badgeInactive: {
    backgroundColor: '#6b728020',
    color: '#6b7280',
  },
  badgeSource: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textSecondary,
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
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
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
    textAlign: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
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
  settingsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} 0`,
  },
  settingLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: theme.colors.primary,
  },
};

function UserMemoryPage() {
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
    updateSettings,
  } = useUserMemory();

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
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Memory-Daten...</div>
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

  const settings = memory?.settings || {};

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Benutzer-Memory</h1>
        <p style={styles.subtitle}>
          Was der Assistent ueber dich weiss und wie er sich verhalten soll.
        </p>
      </div>

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
          <div style={styles.statLabel}>Aktive Projekte</div>
        </div>
      </div>

      {/* Settings */}
      <div style={styles.settingsCard}>
        <div style={styles.settingRow}>
          <span style={styles.settingLabel}>Memory in Prompts einbinden</span>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={settings.include_in_prompt || false}
            onChange={(e) => updateSettings({ include_in_prompt: e.target.checked })}
          />
        </div>
      </div>

      {/* About Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              <UserIcon size={20} style={styles.sectionIcon} />
              Ueber dich
            </div>
            <div style={styles.sectionDescription}>
              Fakten ueber dich: Beruf, Firma, Hintergrund, Faehigkeiten
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={styles.input}
              placeholder="z.B. 'AI Consultant bei TechCorp'"
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
                      <span style={{ ...styles.badge, ...styles.badgeSource }}>
                        {item.source === 'agent' ? 'Agent' : 'Manuell'}
                      </span>
                      <span>{new Date(item.added_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteItem('about', item.id)}
                  >
                    ✕
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
              Wie der Assistent antworten soll: Sprache, Stil, Format, Regeln
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={styles.input}
              placeholder="z.B. 'Antworte kurz und technisch'"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddInstruction()}
            />
            <Select
              value={newInstructionPriority}
              onChange={(e) => setNewInstructionPriority(e.target.value)}
              style={{ width: 'auto' }}
              options={[
                { value: 'high', label: 'Wichtig' },
                { value: 'normal', label: 'Normal' },
              ]}
            />
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
                      <span style={{ ...styles.badge, ...styles.badgeSource }}>
                        {item.source === 'agent' ? 'Agent' : 'Manuell'}
                      </span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteItem('instructions', item.id)}
                  >
                    ✕
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
              Aktueller Kontext
            </div>
            <div style={styles.sectionDescription}>
              Projekte und Aufgaben, an denen du gerade arbeitest
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.addForm}>
            <input
              type="text"
              style={{ ...styles.input, flex: '0 0 200px' }}
              placeholder="Projektname"
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
            <div style={styles.emptyState}>Keine Projekte vorhanden.</div>
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
                    ✕
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

export default UserMemoryPage;
