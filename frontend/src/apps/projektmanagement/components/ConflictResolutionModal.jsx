/**
 * ConflictResolutionModal — Reagiert auf 409 von Idee/Auftrag/Statusbericht-Updates.
 *
 * Zeigt dem User die Server-Version (die Version die jemand anderes inzwischen
 * gespeichert hat) und gibt zwei Auswege:
 *  1. "Aktuelle Version laden" — eigene Aenderungen verwerfen, Server-Version
 *     ins Wizard laden
 *  2. "Meine Version trotzdem speichern" — Force-Overwrite, fremde Aenderungen
 *     gehen verloren (gefaehrlich-orange markiert)
 *
 * Generisch fuer alle drei Entitaeten — Caller liefert nur entityLabel,
 * currentServerData und Callback-Funktionen.
 */

import { theme } from '../../../config/theme';

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
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '560px',
    width: '90%',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  body: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
  },
  serverInfoBox: {
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
  },
  serverInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  serverInfoLabel: {
    color: theme.colors.textMuted,
  },
  serverInfoValue: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  buttonReload: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  buttonForce: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.warning,
    border: `1px solid ${theme.colors.warning}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  buttonCancel: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
  },
};

export default function ConflictResolutionModal({
  entityLabel = 'Datensatz',
  serverData,
  onReload,
  onForce,
  onCancel,
}) {
  if (!serverData) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.warningIcon}>
          <WarningIcon />
        </div>
        <h2 style={styles.title}>Konflikt: {entityLabel} wurde inzwischen geändert</h2>
        <p style={styles.body}>
          Während du an dieser {entityLabel.toLowerCase()} gearbeitet hast,
          hat eine andere Person ebenfalls Änderungen gespeichert. Du musst
          dich entscheiden, wie du fortfahren möchtest.
        </p>

        <div style={styles.serverInfoBox}>
          <div style={styles.serverInfoRow}>
            <span style={styles.serverInfoLabel}>Aktuelle Server-Version</span>
            <span style={styles.serverInfoValue}>v{serverData.version ?? '?'}</span>
          </div>
          {serverData.name && (
            <div style={styles.serverInfoRow}>
              <span style={styles.serverInfoLabel}>Name</span>
              <span style={styles.serverInfoValue}>{serverData.name}</span>
            </div>
          )}
          {serverData.updated_at && (
            <div style={styles.serverInfoRow}>
              <span style={styles.serverInfoLabel}>Zuletzt geändert</span>
              <span style={styles.serverInfoValue}>
                {new Date(serverData.updated_at).toLocaleString('de-DE')}
              </span>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.buttonReload}
            onClick={onReload}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
          >
            Aktuelle Version laden (meine Änderungen verwerfen)
          </button>
          <button
            type="button"
            style={styles.buttonForce}
            onClick={onForce}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.warningLight;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Meine Version trotzdem speichern (fremde Änderungen verwerfen)
          </button>
          {onCancel && (
            <button
              type="button"
              style={styles.buttonCancel}
              onClick={onCancel}
            >
              Abbrechen — später entscheiden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
