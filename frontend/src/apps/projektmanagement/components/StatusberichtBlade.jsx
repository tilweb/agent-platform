/**
 * StatusberichtBlade
 * Left sidebar: List of Statusberichte with Ampel dots, selection, "New" button
 */

import { theme } from '../../../config/theme';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const styles = {
  container: {
    width: '200px',
    minWidth: '200px',
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  header: {
    padding: `${theme.spacing.lg} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.md}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  },
  itemActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  ampelDot: {
    width: '10px',
    height: '10px',
    borderRadius: theme.borderRadius.full,
    flexShrink: 0,
  },
  itemText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  itemTextActive: {
    color: theme.colors.primary,
  },
  itemDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  addButton: {
    margin: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    transition: `all ${theme.transitions.fast}`,
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.textMuted,
    flexShrink: 0,
  },
  deleteBtn: {
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'transparent',
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    transition: `all ${theme.transitions.fast}`,
  },
};

function StatusberichtBlade({ berichte, selectedId, onSelect, onCreate, isCreating, onDelete }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>Berichte</div>

      <div style={styles.list}>
        {berichte.map((sb) => {
          const isActive = sb.id === selectedId;
          return (
            <div
              key={sb.id}
              style={{
                ...styles.item,
                ...(isActive ? styles.itemActive : {}),
              }}
              onClick={() => onSelect(sb.id)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                }
                const delBtn = e.currentTarget.querySelector('[data-delete]');
                if (delBtn) delBtn.style.color = theme.colors.textMuted;
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
                const delBtn = e.currentTarget.querySelector('[data-delete]');
                if (delBtn) delBtn.style.color = 'transparent';
              }}
            >
              <div style={{
                ...styles.ampelDot,
                backgroundColor: AMPEL_COLORS[sb.ampel] || theme.colors.textMuted,
              }} />
              <div style={styles.itemInfo}>
                <span style={{
                  ...styles.itemText,
                  ...(isActive ? styles.itemTextActive : {}),
                }}>
                  SB #{sb.nummer}
                </span>
                <span style={styles.itemDate}>
                  {formatDate(sb.datum)}
                  {sb.status === 'draft' && ' (Entwurf)'}
                </span>
              </div>
              {sb.status === 'draft' && (
                <button
                  data-delete
                  style={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Statusbericht #${sb.nummer} wirklich löschen?`)) {
                      onDelete(sb.id);
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        style={styles.addButton}
        onClick={onCreate}
        disabled={isCreating}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.primary;
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.primaryLight;
          e.currentTarget.style.color = theme.colors.primary;
        }}
      >
        <PlusIcon />
        {isCreating ? 'Erstellen...' : 'Neuer Bericht'}
      </button>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default StatusberichtBlade;
