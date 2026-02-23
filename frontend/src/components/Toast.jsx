/**
 * Toast Notification Component
 *
 * Provides toast notifications for task events and other feedback.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { theme } from '../config/theme';

const styles = {
  container: {
    position: 'fixed',
    top: `calc(${theme.layout.headerHeight} + ${theme.spacing.md})`,
    right: theme.spacing.xl,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    maxWidth: '400px',
  },
  toast: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    animation: 'slideIn 0.3s ease',
    cursor: 'pointer',
    transition: `opacity ${theme.transitions.fast}`,
  },
  icon: {
    width: '20px',
    height: '20px',
    flexShrink: 0,
    marginTop: '2px',
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.xs,
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    opacity: 0.9,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.6,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '3px',
    borderRadius: '0 0 8px 8px',
    transition: 'width 0.1s linear',
  },
};

const toastTypes = {
  success: {
    bg: '#d1fae5',
    text: '#065f46',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  error: {
    bg: '#fee2e2',
    text: '#991b1b',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  warning: {
    bg: '#fef3c7',
    text: '#92400e',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: '#dbeafe',
    text: '#1e40af',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  task: {
    bg: '#ede9fe',
    text: '#5b21b6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
};

// Toast Context
const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type: 'info',
      duration: 5000,
      ...options,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto remove
    if (toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }, [removeToast]);

  // Convenience methods
  const success = useCallback((title, message) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title, message) => addToast({ type: 'error', title, message, duration: 8000 }), [addToast]);
  const warning = useCallback((title, message) => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((title, message) => addToast({ type: 'info', title, message }), [addToast]);
  const task = useCallback((title, message) => addToast({ type: 'task', title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info, task }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={styles.container}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
        ))}
      </div>
    </>
  );
}

function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);
  const typeConfig = toastTypes[toast.type] || toastTypes.info;

  useEffect(() => {
    if (toast.duration <= 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [toast.duration]);

  return (
    <div
      style={{
        ...styles.toast,
        backgroundColor: typeConfig.bg,
        color: typeConfig.text,
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onClose}
    >
      <div style={styles.icon}>{typeConfig.icon}</div>
      <div style={styles.content}>
        {toast.title && <div style={styles.title}>{toast.title}</div>}
        {toast.message && <div style={styles.message}>{toast.message}</div>}
      </div>
      <button style={{ ...styles.closeButton, color: typeConfig.text }} onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {toast.duration > 0 && (
        <div
          style={{
            ...styles.progress,
            width: `${progress}%`,
            backgroundColor: typeConfig.text,
            opacity: 0.3,
          }}
        />
      )}
    </div>
  );
}

// Browser Notification helper
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  return new Notification(title, {
    icon: '/vite.svg',
    badge: '/vite.svg',
    ...options,
  });
}
