/**
 * AgentFavoritesModal
 *
 * Auswahl der Favoriten-Agenten für die Chat-Sidebar. Bewusst als kompakte
 * Checkbox-Liste (statt Kacheln): schneller scanbar bei vielen Agenten,
 * Mehrfachauswahl ist das natürliche Checkbox-Pattern, Suchfeld skaliert.
 */

import { useState, useMemo } from 'react';
import { theme } from '../config/theme';
import { AgentGlyph } from './AgentAvatar';
import { SearchIcon } from './Icons';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    maxWidth: '480px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing.xl} ${theme.spacing.md}`,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  searchContainer: {
    position: 'relative',
    margin: `${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.sm}`,
  },
  searchInput: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    paddingLeft: '32px',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    outline: 'none',
    boxSizing: 'border-box',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.textMuted,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: `0 ${theme.spacing.md} ${theme.spacing.md}`,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
  checkbox: {
    flexShrink: 0,
    cursor: 'pointer',
  },
  rowIcon: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '1px',
  },
  empty: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  footerCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  footerButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  saveButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  error: {
    margin: `0 ${theme.spacing.xl} ${theme.spacing.md}`,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
  },
};

function AgentFavoritesModal({ agents, selectedIds, onSave, onClose }) {
  const [selection, setSelection] = useState(() => new Set(selectedIds));
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      a.name?.toLowerCase().includes(q) ||
      (typeof a.description === 'string' && a.description.toLowerCase().includes(q)));
  }, [agents, search]);

  const toggle = (agentId) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Reihenfolge der Agentenliste beibehalten (stabil, nicht Klick-Reihenfolge)
      await onSave(agents.filter((a) => selection.has(a.id)).map((a) => a.id));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>Favoriten-Agenten</div>
          <div style={styles.subtitle}>
            Wähle Agenten aus, die in der Chat-Übersicht für den Schnellstart angezeigt werden.
          </div>
        </div>

        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}><SearchIcon size={14} /></span>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Agenten durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.list}>
          {filteredAgents.length === 0 ? (
            <div style={styles.empty}>Keine Agenten gefunden</div>
          ) : (
            filteredAgents.map((agent) => {
              const checked = selection.has(agent.id);
              const isHovered = hoveredId === agent.id;
              return (
                <label
                  key={agent.id}
                  style={{
                    ...styles.row,
                    ...(isHovered ? { backgroundColor: theme.colors.surfaceHover } : {}),
                  }}
                  onMouseEnter={() => setHoveredId(agent.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={checked}
                    onChange={() => toggle(agent.id)}
                  />
                  <span style={styles.rowIcon}>
                    <AgentGlyph icon={agent.icon} color={agent.color} size={18} />
                  </span>
                  <span style={styles.rowInfo}>
                    <span style={{ ...styles.rowName, display: 'block' }}>{agent.name}</span>
                    {typeof agent.description === 'string' && agent.description && (
                      <span style={{ ...styles.rowDescription, display: 'block' }}>{agent.description}</span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div style={styles.footer}>
          <span style={styles.footerCount}>
            {selection.size} {selection.size === 1 ? 'Agent' : 'Agenten'} ausgewählt
          </span>
          <div style={styles.footerButtons}>
            <button type="button" style={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              Abbrechen
            </button>
            <button type="button" style={styles.saveButton} onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentFavoritesModal;
