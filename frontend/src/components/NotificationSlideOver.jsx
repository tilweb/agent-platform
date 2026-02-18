/**
 * NotificationSlideOver Component
 *
 * Slide-over panel showing notification details.
 */

import { useEffect } from 'react';
import { theme } from '../config/theme';
import { XIcon, ArrowLeftIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon, TrashIcon } from './Icons';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1100,
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '400px',
    maxWidth: '100vw',
    backgroundColor: theme.colors.surface,
    boxShadow: theme.shadows.xl,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1101,
    animation: 'slideIn 200ms ease-out',
  },
  header: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    transition: `all ${theme.transitions.fast}`,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    overflowY: 'auto',
  },
  iconContainer: {
    width: '56px',
    height: '56px',
    borderRadius: theme.borderRadius.xl,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  iconError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  iconSystem: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
  },
  divider: {
    height: '1px',
    backgroundColor: theme.colors.border,
    margin: `${theme.spacing.lg} 0`,
  },
  detailsSection: {
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm} 0`,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  actions: {
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: theme.spacing.md,
  },
  primaryButton: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#ffffff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  dangerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  statusRead: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  statusUnread: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
};

// CSS animation for slide-in
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;
if (!document.head.querySelector('style[data-notification-slideover]')) {
  styleSheet.setAttribute('data-notification-slideover', 'true');
  document.head.appendChild(styleSheet);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotificationTypeLabel(type) {
  switch (type) {
    case 'task_completed':
      return 'Task abgeschlossen';
    case 'task_failed':
      return 'Task fehlgeschlagen';
    case 'system':
      return 'System';
    default:
      return 'Benachrichtigung';
  }
}

function getNotificationIcon(type) {
  switch (type) {
    case 'task_completed':
      return { Icon: CheckCircleIcon, style: styles.iconSuccess };
    case 'task_failed':
      return { Icon: AlertTriangleIcon, style: styles.iconError };
    default:
      return { Icon: ClockIcon, style: styles.iconSystem };
  }
}

export default function NotificationSlideOver({
  notification,
  onClose,
  onNavigate,
  onDelete,
}) {
  const { Icon, style: iconStyle } = getNotificationIcon(notification.type);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleNavigate = () => {
    if (notification.actionUrl) {
      onNavigate(notification.actionUrl);
    }
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <button
            style={styles.backButton}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeftIcon size={16} />
            Zurück
          </button>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div style={styles.content}>
          <div style={{ ...styles.iconContainer, ...iconStyle }}>
            <Icon size={28} />
          </div>

          <h2 style={styles.title}>{notification.title}</h2>
          <p style={styles.message}>{notification.message}</p>

          <div style={styles.divider} />

          <div style={styles.detailsSection}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Typ</span>
              <span style={styles.detailValue}>
                {getNotificationTypeLabel(notification.type)}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Erstellt</span>
              <span style={styles.detailValue}>
                {formatDate(notification.createdAt)}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Status</span>
              <span
                style={{
                  ...styles.statusBadge,
                  ...(notification.read ? styles.statusRead : styles.statusUnread),
                }}
              >
                {notification.read ? 'Gelesen' : 'Ungelesen'}
              </span>
            </div>
            {notification.readAt && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Gelesen am</span>
                <span style={styles.detailValue}>
                  {formatDate(notification.readAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={styles.actions}>
          {notification.actionUrl && (
            <button
              style={styles.primaryButton}
              onClick={handleNavigate}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
              }}
            >
              Zur Aufgabe
            </button>
          )}
          <button
            style={styles.dangerButton}
            onClick={() => onDelete(notification.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.errorLight;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Löschen"
          >
            <TrashIcon size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
