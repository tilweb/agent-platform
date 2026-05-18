/**
 * StatusberichtBlade
 *
 * Linker Sidebar mit Statusbericht-Liste. Layout-Pattern an LessonsLearnedView
 * angepasst: 260px breit, Item = Titel + Meta-Row (Ampel-Badge + Status +
 * Datum). Loeschen passiert nicht mehr inline — der „Loeschen"-Button lebt
 * in der Detail-Toolbar neben Export (siehe WizardPage.jsx sbTabs).
 */

import { theme } from '../../../config/theme';

const AMPEL_STYLE = {
  gruen: { bg: theme.colors.successLight, fg: theme.colors.success, label: 'Grün' },
  gelb: { bg: theme.colors.warningLight, fg: theme.colors.warning, label: 'Gelb' },
  rot: { bg: theme.colors.errorLight, fg: theme.colors.error, label: 'Rot' },
};

const styles = {
  container: {
    width: '260px',
    minWidth: '260px',
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  header: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  headerAddBtn: {
    border: 'none',
    background: theme.colors.primary,
    color: '#fff',
    borderRadius: theme.borderRadius.md,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  listItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    cursor: 'pointer',
    transition: `background ${theme.transitions.fast}`,
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  listItemActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  listItemTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  ampelBadge: {
    fontSize: '10px',
    fontWeight: theme.typography.weights.semibold,
    padding: `2px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.full,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  emptyList: {
    padding: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
};

function ampelBadge(value) {
  return AMPEL_STYLE[value] || { bg: theme.colors.surfaceHover, fg: theme.colors.textMuted, label: '—' };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function StatusberichtBlade({ berichte, selectedId, onSelect, onCreate, isCreating }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Berichte</span>
        <button
          type="button"
          style={styles.headerAddBtn}
          onClick={onCreate}
          disabled={isCreating}
        >
          {isCreating ? '…' : '+ Neu'}
        </button>
      </div>

      <div style={styles.list}>
        {berichte.length === 0 ? (
          <div style={styles.emptyList}>Noch keine Statusberichte.</div>
        ) : (
          berichte.map((sb) => {
            const isActive = sb.id === selectedId;
            const ampel = ampelBadge(sb.ampel);
            const statusLabel = sb.status === 'draft' ? 'Entwurf' : 'Final';
            return (
              <button
                key={sb.id}
                type="button"
                style={{
                  ...styles.listItem,
                  ...(isActive ? styles.listItemActive : {}),
                }}
                onClick={() => onSelect(sb.id)}
              >
                <div style={styles.listItemTitle}>SB #{sb.nummer}</div>
                <div style={styles.listItemMeta}>
                  <span style={{ ...styles.ampelBadge, backgroundColor: ampel.bg, color: ampel.fg }}>
                    {ampel.label}
                  </span>
                  <span>{statusLabel}</span>
                  {sb.datum && <span>· {formatDate(sb.datum)}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default StatusberichtBlade;
