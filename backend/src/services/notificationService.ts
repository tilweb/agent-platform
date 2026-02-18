/**
 * Notification Service
 *
 * Manages user notifications with JSONL storage per user.
 * Supports real-time updates via SSE.
 */

import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';
import type { Task } from './taskService';

// ============================================
// Types
// ============================================

export type NotificationType = 'task_completed' | 'task_failed' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;

  // Content
  title: string;
  message: string;
  icon?: string;

  // Linking
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;

  // Status
  read: boolean;
  readAt?: string;
  createdAt: string;

  // Additional data
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ListNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface ListNotificationsResult {
  notifications: Notification[];
  total: number;
  unread: number;
}

export type NotificationListener = (notification: Notification) => void;

// ============================================
// Constants
// ============================================

const NOTIFICATIONS_DIR = resolve(process.cwd(), '../data/notifications');

// ============================================
// Helper Functions
// ============================================

function generateNotificationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `notif_${timestamp}_${random}`;
}

function getUserFilePath(userId: string): string {
  // Sanitize userId to prevent path traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return resolve(NOTIFICATIONS_DIR, `${safeUserId}.jsonl`);
}

async function ensureNotificationsDir(): Promise<void> {
  if (!existsSync(NOTIFICATIONS_DIR)) {
    await mkdir(NOTIFICATIONS_DIR, { recursive: true });
  }
}

/**
 * Read all notifications from a user's JSONL file
 */
async function readUserNotifications(userId: string): Promise<Notification[]> {
  const filePath = getUserFilePath(userId);

  if (!existsSync(filePath)) {
    return [];
  }

  const notifications: Notification[] = [];

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        try {
          notifications.push(JSON.parse(line));
        } catch (e) {
          console.warn('Failed to parse notification line:', e);
        }
      }
    });

    rl.on('close', () => {
      resolve(notifications);
    });

    rl.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Write all notifications back to the file (used for updates)
 */
async function writeUserNotifications(userId: string, notifications: Notification[]): Promise<void> {
  await ensureNotificationsDir();
  const filePath = getUserFilePath(userId);
  const content = notifications.map((n) => JSON.stringify(n)).join('\n') + (notifications.length > 0 ? '\n' : '');
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Append a single notification to the file
 */
async function appendNotification(userId: string, notification: Notification): Promise<void> {
  await ensureNotificationsDir();
  const filePath = getUserFilePath(userId);
  await appendFile(filePath, JSON.stringify(notification) + '\n', 'utf-8');
}

// ============================================
// Notification Service Class
// ============================================

class NotificationService {
  private listeners: Map<string, Set<NotificationListener>> = new Map();

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new notification
   */
  async create(params: CreateNotificationParams): Promise<Notification> {
    const notification: Notification = {
      id: generateNotificationId(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      icon: params.icon,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      actionUrl: params.actionUrl,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: params.metadata,
    };

    await appendNotification(params.userId, notification);

    // Broadcast to listeners
    this.broadcast(params.userId, notification);

    return notification;
  }

  /**
   * Get a single notification by ID
   */
  async get(notificationId: string, userId: string): Promise<Notification | null> {
    const notifications = await readUserNotifications(userId);
    return notifications.find((n) => n.id === notificationId) || null;
  }

  /**
   * List notifications for a user
   */
  async list(userId: string, options: ListNotificationsOptions = {}): Promise<ListNotificationsResult> {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    let notifications = await readUserNotifications(userId);

    // Sort by createdAt descending (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = notifications.length;
    const unread = notifications.filter((n) => !n.read).length;

    // Filter unread only if requested
    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    // Apply pagination
    const paginated = notifications.slice(offset, offset + limit);

    return {
      notifications: paginated,
      total,
      unread,
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notifications = await readUserNotifications(userId);
    const notification = notifications.find((n) => n.id === notificationId);

    if (!notification) {
      return false;
    }

    if (notification.read) {
      return true; // Already read
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    await writeUserNotifications(userId, notifications);
    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const notifications = await readUserNotifications(userId);
    let count = 0;
    const now = new Date().toISOString();

    for (const notification of notifications) {
      if (!notification.read) {
        notification.read = true;
        notification.readAt = now;
        count++;
      }
    }

    if (count > 0) {
      await writeUserNotifications(userId, notifications);
    }

    return count;
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string): Promise<boolean> {
    const notifications = await readUserNotifications(userId);
    const index = notifications.findIndex((n) => n.id === notificationId);

    if (index === -1) {
      return false;
    }

    notifications.splice(index, 1);
    await writeUserNotifications(userId, notifications);
    return true;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await readUserNotifications(userId);
    return notifications.filter((n) => !n.read).length;
  }

  // ----------------------------------------
  // Task Integration
  // ----------------------------------------

  /**
   * Create notification for completed task
   */
  async notifyTaskCompleted(userId: string, task: Task): Promise<Notification> {
    return this.create({
      userId,
      type: 'task_completed',
      title: 'Task abgeschlossen',
      message: task.title,
      icon: 'check',
      resourceType: 'task',
      resourceId: task.id,
      actionUrl: `/tasks?open=${task.id}`,
      metadata: {
        taskId: task.id,
        taskType: task.type,
        resultSummary: task.result_summary,
      },
    });
  }

  /**
   * Create notification for failed task
   */
  async notifyTaskFailed(userId: string, task: Task, error: string): Promise<Notification> {
    return this.create({
      userId,
      type: 'task_failed',
      title: 'Task fehlgeschlagen',
      message: `${task.title}: ${error}`,
      icon: 'alert',
      resourceType: 'task',
      resourceId: task.id,
      actionUrl: `/tasks?open=${task.id}`,
      metadata: {
        taskId: task.id,
        taskType: task.type,
        error,
      },
    });
  }

  // ----------------------------------------
  // Real-time (SSE)
  // ----------------------------------------

  /**
   * Add a listener for notifications
   */
  addListener(userId: string, listener: NotificationListener): void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(userId: string, listener: NotificationListener): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.delete(listener);
      if (userListeners.size === 0) {
        this.listeners.delete(userId);
      }
    }
  }

  /**
   * Broadcast notification to all listeners for a user
   */
  broadcast(userId: string, notification: Notification): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      for (const listener of userListeners) {
        try {
          listener(notification);
        } catch (e) {
          console.error('Error in notification listener:', e);
          userListeners.delete(listener);
        }
      }
    }
  }

  // ----------------------------------------
  // Cleanup
  // ----------------------------------------

  /**
   * Delete old notifications (older than specified days)
   */
  async cleanupOldNotifications(userId: string, olderThanDays: number = 30): Promise<number> {
    const notifications = await readUserNotifications(userId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const filtered = notifications.filter((n) => new Date(n.createdAt) >= cutoff);
    const deleted = notifications.length - filtered.length;

    if (deleted > 0) {
      await writeUserNotifications(userId, filtered);
    }

    return deleted;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
