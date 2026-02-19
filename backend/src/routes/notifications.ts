/**
 * Notifications API Routes
 *
 * REST endpoints for managing user notifications.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware, requireUserId } from '../auth';
import {
  notificationService,
  type Notification,
} from '../services/notificationService';

export const notificationRoutes = new Hono();

// Apply auth middleware to all routes
notificationRoutes.use('/*', authMiddleware);

// ============================================
// Notification Endpoints
// ============================================

// GET /api/notifications - List notifications
notificationRoutes.get('/', async (c) => {
  try {
    const userId = requireUserId(c);

    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const unreadOnly = c.req.query('unread_only') === 'true';

    const result = await notificationService.list(userId, {
      limit,
      offset,
      unreadOnly,
    });

    return c.json(result);
  } catch (error: any) {
    console.error('Error listing notifications:', error);
    return c.json({ error: 'Failed to list notifications' }, 500);
  }
});

// GET /api/notifications/count - Get unread count
notificationRoutes.get('/count', async (c) => {
  try {
    const userId = requireUserId(c);
    const unread = await notificationService.getUnreadCount(userId);
    return c.json({ unread });
  } catch (error: any) {
    console.error('Error getting notification count:', error);
    return c.json({ error: 'Failed to get notification count' }, 500);
  }
});

// GET /api/notifications/stream - SSE stream for real-time updates
notificationRoutes.get('/stream', async (c) => {
  const userId = requireUserId(c);

  return streamSSE(c, async (stream) => {
    // Send initial unread count
    const unread = await notificationService.getUnreadCount(userId);
    await stream.writeSSE({
      event: 'init',
      data: JSON.stringify({ unread }),
    });

    // Set up listener for new notifications
    const listener = async (notification: Notification) => {
      try {
        await stream.writeSSE({
          event: 'notification',
          data: JSON.stringify(notification),
        });
      } catch {
        // Stream closed
        notificationService.removeListener(userId, listener);
      }
    };

    notificationService.addListener(userId, listener);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: '' });
      } catch {
        clearInterval(heartbeat);
        notificationService.removeListener(userId, listener);
      }
    }, 15000);

    // Keep stream open for 2 hours max
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        clearInterval(heartbeat);
        notificationService.removeListener(userId, listener);
        resolve();
      }, 2 * 60 * 60 * 1000);
    });
  });
});

// GET /api/notifications/:id - Get single notification
notificationRoutes.get('/:id', async (c) => {
  try {
    const userId = requireUserId(c);
    const notificationId = c.req.param('id');
    const notification = await notificationService.get(notificationId, userId);

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    return c.json(notification);
  } catch (error: any) {
    console.error('Error getting notification:', error);
    return c.json({ error: 'Failed to get notification' }, 500);
  }
});

// POST /api/notifications/:id/read - Mark as read
notificationRoutes.post('/:id/read', async (c) => {
  try {
    const userId = requireUserId(c);
    const notificationId = c.req.param('id');
    const success = await notificationService.markAsRead(notificationId, userId);

    if (!success) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

// POST /api/notifications/read-all - Mark all as read
notificationRoutes.post('/read-all', async (c) => {
  try {
    const userId = requireUserId(c);
    const count = await notificationService.markAllAsRead(userId);
    return c.json({ success: true, count });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return c.json({ error: 'Failed to mark all notifications as read' }, 500);
  }
});

// DELETE /api/notifications/:id - Delete notification
notificationRoutes.delete('/:id', async (c) => {
  try {
    const userId = requireUserId(c);
    const notificationId = c.req.param('id');
    const success = await notificationService.delete(notificationId, userId);

    if (!success) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return c.json({ error: 'Failed to delete notification' }, 500);
  }
});
