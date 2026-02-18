/**
 * Notification Context
 *
 * Provides notification state and real-time updates via SSE.
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost, API_URL } from '../utils/apiFetch';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef(null);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiGet('/notifications?limit=50');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // SSE Connection for real-time updates
  useEffect(() => {
    if (!isAuthenticated) {
      // Close existing connection if not authenticated
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Create SSE connection
    const eventSource = new EventSource(`${API_URL}/notifications/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener('notification', (event) => {
      try {
        const notification = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch (e) {
        console.error('Error parsing notification:', e);
      }
    });

    eventSource.addEventListener('init', (event) => {
      try {
        const data = JSON.parse(event.data);
        setUnreadCount(data.unread);
      } catch (e) {
        console.error('Error parsing init event:', e);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Connection will auto-reconnect
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await apiPost(`/notifications/${notificationId}/read`);
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        return true;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
    return false;
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiPost('/notifications/read-all');
      if (response.ok) {
        const now = new Date().toISOString();
        setNotifications((prev) =>
          prev.map((n) => (n.read ? n : { ...n, read: true, readAt: now }))
        );
        setUnreadCount(0);
        return true;
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
    return false;
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await apiGet(`/notifications/${notificationId}`);
      const notification = response.ok ? await response.json() : null;

      const deleteResponse = await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (deleteResponse.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        return true;
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
    return false;
  }, []);

  // Refresh notifications
  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
