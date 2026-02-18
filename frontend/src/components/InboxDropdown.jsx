/**
 * InboxDropdown Component
 *
 * Bell icon with badge and dropdown for notifications.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useNotifications } from '../context/NotificationContext';
import { BellIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon } from './Icons';
import NotificationSlideOver from './NotificationSlideOver';

const styles = {
  container: {
    position: 'relative',
  },
  button: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.borderRadius.lg,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: theme.colors.textSecondary,
    transition: `all ${theme.transitions.fast}`,
  },
  badge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    minWidth: '18px',
    height: '18px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error,
    color: '#ffffff',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '380px',
    maxHeight: '480px',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    zIndex: 1000,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  markAllButton: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontWeight: theme.typography.weights.medium,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    transition: `all ${theme.transitions.fast}`,
  },
  list: {
    maxHeight: '360px',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  itemUnread: {
    backgroundColor: theme.colors.primaryLight + '30',
  },
  itemIcon: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  itemIconError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  itemIconSystem: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: '2px',
  },
  itemMessage: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemTime: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: theme.colors.primary,
    flexShrink: 0,
    marginTop: '6px',
  },
  empty: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  footer: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    textAlign: 'center',
  },
  footerLink: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
};

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE');
}

function getNotificationIcon(type) {
  switch (type) {
    case 'task_completed':
      return { Icon: CheckCircleIcon, style: styles.itemIconSuccess };
    case 'task_failed':
      return { Icon: AlertTriangleIcon, style: styles.itemIconError };
    default:
      return { Icon: ClockIcon, style: styles.itemIconSystem };
  }
}

export default function InboxDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification) => {
    setIsOpen(false);
    setSelectedNotification(notification);
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  const handleSlideOverClose = () => {
    setSelectedNotification(null);
  };

  const handleNavigate = (url) => {
    setSelectedNotification(null);
    if (url) {
      navigate(url);
    }
  };

  const handleDelete = async (notificationId) => {
    await deleteNotification(notificationId);
    setSelectedNotification(null);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <>
      <div style={styles.container} ref={dropdownRef}>
        <button
          style={{
            ...styles.button,
            backgroundColor: isOpen ? theme.colors.surfaceHover : 'transparent',
          }}
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <BellIcon size={20} />
          {unreadCount > 0 && (
            <span style={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div style={styles.dropdown}>
            <div style={styles.header}>
              <span style={styles.headerTitle}>Benachrichtigungen</span>
              {unreadCount > 0 && (
                <button
                  style={styles.markAllButton}
                  onClick={handleMarkAllAsRead}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.primaryLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Alle gelesen
                </button>
              )}
            </div>

            <div style={styles.list}>
              {notifications.length === 0 ? (
                <div style={styles.empty}>
                  Keine Benachrichtigungen
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => {
                  const { Icon, style: iconStyle } = getNotificationIcon(notification.type);
                  const isHovered = hoveredItem === notification.id;

                  return (
                    <div
                      key={notification.id}
                      style={{
                        ...styles.item,
                        ...(!notification.read ? styles.itemUnread : {}),
                        backgroundColor: isHovered
                          ? theme.colors.surfaceHover
                          : (!notification.read ? styles.itemUnread.backgroundColor : 'transparent'),
                      }}
                      onClick={() => handleNotificationClick(notification)}
                      onMouseEnter={() => setHoveredItem(notification.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <div style={{ ...styles.itemIcon, ...iconStyle }}>
                        <Icon size={18} />
                      </div>
                      <div style={styles.itemContent}>
                        <div style={styles.itemTitle}>{notification.title}</div>
                        <div style={styles.itemMessage}>{notification.message}</div>
                        <div style={styles.itemTime}>
                          {formatTimeAgo(notification.createdAt)}
                        </div>
                      </div>
                      {!notification.read && <div style={styles.unreadDot} />}
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 10 && (
              <div style={styles.footer}>
                <button
                  style={styles.footerLink}
                  onClick={() => {
                    setIsOpen(false);
                    // Could navigate to a full notifications page in the future
                  }}
                >
                  Alle Benachrichtigungen anzeigen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedNotification && (
        <NotificationSlideOver
          notification={selectedNotification}
          onClose={handleSlideOverClose}
          onNavigate={handleNavigate}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
