import { theme } from '../config/theme';

/**
 * Wiederverwendbares Bestaetigungs-Modal — Ersatz fuer browser-natives confirm().
 *
 * Props:
 * - open: boolean — sichtbar nur wenn true
 * - title: string
 * - message: string | ReactNode (Body-Text/JSX)
 * - confirmLabel: default "Bestaetigen"
 * - cancelLabel: default "Abbrechen"
 * - destructive: boolean — wenn true, Confirm-Button als Danger-Variant
 * - busy: boolean — disabled Confirm-Button + Loading-Label
 * - onConfirm: () => void | Promise<void>
 * - onCancel: () => void
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-modal-title" style={styles.title}>
          {title}
        </h2>
        <div style={styles.message}>{message}</div>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{
              ...styles.confirmButton,
              ...(destructive ? styles.confirmDestructive : styles.confirmDefault),
              ...(busy ? styles.confirmBusy : {}),
            }}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    width: '90%',
    maxWidth: '440px',
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  title: {
    margin: 0,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
  },
  cancelButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  confirmButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  confirmDefault: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  confirmDestructive: {
    backgroundColor: theme.colors.error,
    color: '#fff',
  },
  confirmBusy: {
    opacity: 0.6,
    cursor: 'default',
  },
};
