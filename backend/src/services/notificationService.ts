/**
 * Notification Service — Postgres-backed.
 *
 * Frueher JSONL pro User, jetzt einzelne Rows in `notifications.notifications`.
 * Die hot-path-Felder (userId, kind, title, body, isRead, createdAt) sind
 * eigene Spalten — alles andere (icon, resourceType, resourceId, actionUrl,
 * readAt, metadata) lebt in der jsonb-`payload`-Spalte. Damit kann die
 * externe API stabil bleiben, ohne neue DB-Spalten zu brauchen.
 */

import { and, eq, desc, count, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { notifications as notifTable } from '../db/schema/notifications';
import type { Task } from './taskService';

export type NotificationType = 'task_completed' | 'task_failed' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
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

interface NotificationPayload {
  icon?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

function generateNotificationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `notif_${timestamp}_${random}`;
}

function rowToNotification(row: typeof notifTable.$inferSelect): Notification {
  const payload = (row.payload ?? {}) as NotificationPayload;
  return {
    id: row.id,
    userId: row.userId,
    type: row.kind as NotificationType,
    title: row.title,
    message: row.body ?? '',
    icon: payload.icon,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    actionUrl: payload.actionUrl,
    read: row.isRead,
    readAt: payload.readAt,
    createdAt: row.createdAt,
    metadata: payload.metadata,
  };
}

class NotificationService {
  private listeners: Map<string, Set<NotificationListener>> = new Map();

  async create(params: CreateNotificationParams): Promise<Notification> {
    const id = generateNotificationId();
    const createdAt = new Date().toISOString();
    const payload: NotificationPayload = {
      icon: params.icon,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      actionUrl: params.actionUrl,
      metadata: params.metadata,
    };

    const db = getDb();
    await db.insert(notifTable).values({
      id,
      userId: params.userId,
      kind: params.type,
      title: params.title,
      body: params.message,
      payload: payload as never,
      isRead: false,
      createdAt,
    });

    const notification: Notification = {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      icon: params.icon,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      actionUrl: params.actionUrl,
      read: false,
      createdAt,
      metadata: params.metadata,
    };
    this.broadcast(params.userId, notification);
    return notification;
  }

  async get(notificationId: string, userId: string): Promise<Notification | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(notifTable)
      .where(and(eq(notifTable.id, notificationId), eq(notifTable.userId, userId)))
      .limit(1);
    return rows[0] ? rowToNotification(rows[0]) : null;
  }

  async list(userId: string, options: ListNotificationsOptions = {}): Promise<ListNotificationsResult> {
    const { limit = 50, offset = 0, unreadOnly = false } = options;
    const db = getDb();

    const totalRow = await db
      .select({ n: count() })
      .from(notifTable)
      .where(eq(notifTable.userId, userId));
    const unreadRow = await db
      .select({ n: count() })
      .from(notifTable)
      .where(and(eq(notifTable.userId, userId), eq(notifTable.isRead, false)));

    const baseWhere = unreadOnly
      ? and(eq(notifTable.userId, userId), eq(notifTable.isRead, false))
      : eq(notifTable.userId, userId);

    const rows = await db
      .select()
      .from(notifTable)
      .where(baseWhere)
      .orderBy(desc(notifTable.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      notifications: rows.map(rowToNotification),
      total: totalRow[0]?.n ?? 0,
      unread: unreadRow[0]?.n ?? 0,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const db = getDb();
    const existing = await db
      .select()
      .from(notifTable)
      .where(and(eq(notifTable.id, notificationId), eq(notifTable.userId, userId)))
      .limit(1);
    if (!existing[0]) return false;
    if (existing[0].isRead) return true;

    const payload = (existing[0].payload ?? {}) as NotificationPayload;
    payload.readAt = new Date().toISOString();

    await db
      .update(notifTable)
      .set({ isRead: true, payload: payload as never })
      .where(and(eq(notifTable.id, notificationId), eq(notifTable.userId, userId)));
    return true;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select()
      .from(notifTable)
      .where(and(eq(notifTable.userId, userId), eq(notifTable.isRead, false)));
    const now = new Date().toISOString();
    let updated = 0;
    for (const row of rows) {
      const payload = (row.payload ?? {}) as NotificationPayload;
      payload.readAt = now;
      await db
        .update(notifTable)
        .set({ isRead: true, payload: payload as never })
        .where(eq(notifTable.id, row.id));
      updated++;
    }
    return updated;
  }

  async delete(notificationId: string, userId: string): Promise<boolean> {
    const db = getDb();
    const res = await db
      .delete(notifTable)
      .where(and(eq(notifTable.id, notificationId), eq(notifTable.userId, userId)))
      .returning({ id: notifTable.id });
    return res.length > 0;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ n: count() })
      .from(notifTable)
      .where(and(eq(notifTable.userId, userId), eq(notifTable.isRead, false)));
    return rows[0]?.n ?? 0;
  }

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

  addListener(userId: string, listener: NotificationListener): void {
    if (!this.listeners.has(userId)) this.listeners.set(userId, new Set());
    this.listeners.get(userId)!.add(listener);
  }

  removeListener(userId: string, listener: NotificationListener): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.delete(listener);
      if (userListeners.size === 0) this.listeners.delete(userId);
    }
  }

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

  async cleanupOldNotifications(userId: string, olderThanDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffIso = cutoff.toISOString();
    const db = getDb();
    const res = await db
      .delete(notifTable)
      .where(and(eq(notifTable.userId, userId), lt(notifTable.createdAt, cutoffIso)))
      .returning({ id: notifTable.id });
    return res.length;
  }
}

export const notificationService = new NotificationService();
