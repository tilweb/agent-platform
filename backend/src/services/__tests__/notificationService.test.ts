/**
 * Tests for NotificationService (backend/src/services/notificationService.ts)
 *
 * All file system dependencies (fs/promises, fs, readline) are mocked so that
 * no real disk I/O occurs. The readline/createReadStream pipeline that
 * readUserNotifications() uses is simulated entirely in-memory using
 * Node's Readable.from() to produce a proper readable stream from the
 * in-memory file store.
 *
 * Module mocks are registered BEFORE the module under test is imported, as
 * required by bun:test's module-mock semantics.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** In-memory virtual file system: absolute path -> raw string content */
  files: {} as Record<string, string>,
  notificationsDir: "/tmp/test-notifications",
  /** Controls whether mkdir has been called */
  mkdirCalled: false,
  /** Counter for generateId calls, allows deterministic sequential IDs */
  idCounter: 0,
};

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before importing the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string) => {
    mockState.files[path] = content;
  },
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, open '${path}'`
    );
    err.code = "ENOENT";
    throw err;
  },
  appendFile: async (path: string, data: string) => {
    if (mockState.files[path] === undefined) {
      mockState.files[path] = "";
    }
    mockState.files[path] += data;
  },
  mkdir: async () => {
    mockState.mkdirCalled = true;
  },
}));

/**
 * The fs mock provides:
 * - existsSync: checked by ensureNotificationsDir and readUserNotifications
 * - createReadStream: must return a proper Readable stream compatible with
 *   readline.createInterface({ input: stream }). We use Readable.from() which
 *   produces a well-formed async-iterable-backed readable stream.
 */
mock.module("fs", () => ({
  existsSync: (path: string) => mockState.files[path] !== undefined,
  createReadStream: (path: string) => {
    const content = mockState.files[path] ?? "";
    return Readable.from([content]);
  },
}));

mock.module("path", () => ({
  resolve: (...parts: string[]) => {
    // Simple join without real resolution (sufficient for testing)
    const joined = parts.join("/").replace(/\/+/g, "/");
    return joined;
  },
  join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
}));

mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => {
    mockState.idCounter += 1;
    return `${prefix}_test_${mockState.idCounter}`;
  },
}));

mock.module("../../utils/paths", () => ({
  NOTIFICATIONS_DIR: mockState.notificationsDir,
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks are registered
// ---------------------------------------------------------------------------

const { notificationService } = await import("../notificationService");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical path for a user's JSONL notification file */
function userFilePath(userId: string): string {
  return `${mockState.notificationsDir}/${userId}.jsonl`;
}

/** Serialise an array of notification objects to JSONL content */
function toJsonl(notifications: any[]): string {
  if (notifications.length === 0) return "";
  return notifications.map((n) => JSON.stringify(n)).join("\n") + "\n";
}

/** Parse a JSONL string back into an array of objects */
function fromJsonl(content: string): any[] {
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Build a minimal valid Notification plain object for test fixtures */
function makeNotification(overrides: Record<string, unknown> = {}): any {
  return {
    id: "notif_existing_1",
    userId: "user-1",
    type: "task_completed",
    title: "Test notification",
    message: "Something happened",
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a minimal Task plain object (mirrors taskService.Task) */
function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Does things",
    type: "simple",
    priority: "normal",
    created_by: "user",
    trigger: "manual",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "completed",
    result_summary: "Completed successfully",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("NotificationService", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.mkdirCalled = false;
    mockState.idCounter = 0;
    // Remove all SSE listeners between tests
    (notificationService as any).listeners.clear();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe("create()", () => {
    test("should return a notification object with all provided fields", async () => {
      const result = await notificationService.create({
        userId: "user-1",
        type: "task_completed",
        title: "Task done",
        message: "Your task finished",
      });

      expect(result.userId).toBe("user-1");
      expect(result.type).toBe("task_completed");
      expect(result.title).toBe("Task done");
      expect(result.message).toBe("Your task finished");
    });

    test("should generate an ID with the 'notif' prefix", async () => {
      const result = await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "Hello",
        message: "World",
      });

      expect(result.id).toMatch(/^notif_/);
    });

    test("should set read=false on newly created notifications", async () => {
      const result = await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "Hi",
        message: "There",
      });

      expect(result.read).toBe(false);
    });

    test("should set createdAt to a valid ISO date string", async () => {
      const before = new Date().toISOString();
      const result = await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "Hi",
        message: "There",
      });
      const after = new Date().toISOString();

      expect(result.createdAt >= before).toBe(true);
      expect(result.createdAt <= after).toBe(true);
    });

    test("should persist the notification to the user JSONL file", async () => {
      await notificationService.create({
        userId: "user-1",
        type: "task_failed",
        title: "Oops",
        message: "It failed",
      });

      const filePath = userFilePath("user-1");
      expect(mockState.files[filePath]).toBeDefined();

      const entries = fromJsonl(mockState.files[filePath]!);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Oops");
    });

    test("should append to an existing file without overwriting previous entries", async () => {
      await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "First",
        message: "msg",
      });
      await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "Second",
        message: "msg",
      });

      const filePath = userFilePath("user-1");
      const entries = fromJsonl(mockState.files[filePath]!);
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe("First");
      expect(entries[1].title).toBe("Second");
    });

    test("should include optional fields when provided", async () => {
      const result = await notificationService.create({
        userId: "user-1",
        type: "task_completed",
        title: "Done",
        message: "msg",
        icon: "check",
        resourceType: "task",
        resourceId: "task-42",
        actionUrl: "/tasks?open=task-42",
        metadata: { foo: "bar" },
      });

      expect(result.icon).toBe("check");
      expect(result.resourceType).toBe("task");
      expect(result.resourceId).toBe("task-42");
      expect(result.actionUrl).toBe("/tasks?open=task-42");
      expect(result.metadata).toEqual({ foo: "bar" });
    });

    test("should broadcast the notification to registered listeners", async () => {
      const received: any[] = [];
      notificationService.addListener("user-1", (n) => received.push(n));

      await notificationService.create({
        userId: "user-1",
        type: "system",
        title: "Broadcast",
        message: "test",
      });

      expect(received).toHaveLength(1);
      expect(received[0].title).toBe("Broadcast");
    });

    test("should sanitize userId for the file path (replace disallowed characters)", async () => {
      // Path traversal attempt: '../evil' becomes '__.evil' after sanitization
      await notificationService.create({
        userId: "../evil",
        type: "system",
        title: "Traversal test",
        message: "msg",
      });

      // A sanitized path should have been used and written inside notifications dir
      const written = Object.keys(mockState.files).some((k) =>
        k.startsWith(mockState.notificationsDir)
      );
      expect(written).toBe(true);

      // The original traversal path must not exist in the file system
      const traversalPath = "/tmp/test-evil.jsonl";
      expect(mockState.files[traversalPath]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // get()
  // -------------------------------------------------------------------------

  describe("get()", () => {
    test("should return null when the user has no notification file", async () => {
      const result = await notificationService.get("notif-999", "user-1");
      expect(result).toBeNull();
    });

    test("should return null when the notification ID does not match", async () => {
      const n = makeNotification({ id: "notif-1", userId: "user-1" });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const result = await notificationService.get("notif-999", "user-1");
      expect(result).toBeNull();
    });

    test("should return the matching notification by ID", async () => {
      const n1 = makeNotification({ id: "notif-1", title: "First" });
      const n2 = makeNotification({ id: "notif-2", title: "Second" });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      const result = await notificationService.get("notif-2", "user-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("notif-2");
      expect(result!.title).toBe("Second");
    });

    test("should not return a notification belonging to a different user", async () => {
      const n = makeNotification({ id: "notif-1", userId: "user-2" });
      mockState.files[userFilePath("user-2")] = toJsonl([n]);

      // Querying for user-1 — their file does not exist
      const result = await notificationService.get("notif-1", "user-1");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe("list()", () => {
    test("should return empty result when user has no notifications file", async () => {
      const result = await notificationService.list("user-1");

      expect(result.notifications).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.unread).toBe(0);
    });

    test("should return all notifications with correct total and unread counts", async () => {
      const n1 = makeNotification({ id: "n1", read: false });
      const n2 = makeNotification({ id: "n2", read: true });
      const n3 = makeNotification({ id: "n3", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2, n3]);

      const result = await notificationService.list("user-1");

      expect(result.total).toBe(3);
      expect(result.unread).toBe(2);
      expect(result.notifications).toHaveLength(3);
    });

    test("should sort notifications by createdAt descending (newest first)", async () => {
      const older = makeNotification({
        id: "n-old",
        createdAt: "2026-01-01T10:00:00.000Z",
      });
      const newer = makeNotification({
        id: "n-new",
        createdAt: "2026-02-20T10:00:00.000Z",
      });
      const middle = makeNotification({
        id: "n-mid",
        createdAt: "2026-01-15T10:00:00.000Z",
      });
      mockState.files[userFilePath("user-1")] = toJsonl([older, newer, middle]);

      const result = await notificationService.list("user-1");

      expect(result.notifications[0].id).toBe("n-new");
      expect(result.notifications[1].id).toBe("n-mid");
      expect(result.notifications[2].id).toBe("n-old");
    });

    test("should filter to unread-only when unreadOnly=true", async () => {
      const unread = makeNotification({ id: "n-unread", read: false });
      const read = makeNotification({ id: "n-read", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([unread, read]);

      const result = await notificationService.list("user-1", {
        unreadOnly: true,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe("n-unread");
    });

    test("should reflect total count of ALL notifications even when unreadOnly=true", async () => {
      const unread = makeNotification({ id: "n1", read: false });
      const read = makeNotification({ id: "n2", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([unread, read]);

      const result = await notificationService.list("user-1", {
        unreadOnly: true,
      });

      // total reflects all (2), not just the filtered set
      expect(result.total).toBe(2);
      expect(result.unread).toBe(1);
      // but returned notifications are only the unread ones
      expect(result.notifications).toHaveLength(1);
    });

    test("should apply limit correctly", async () => {
      const notifications = Array.from({ length: 10 }, (_, i) =>
        makeNotification({
          id: `n-${i}`,
          createdAt: new Date(2026, 0, i + 1).toISOString(),
        })
      );
      mockState.files[userFilePath("user-1")] = toJsonl(notifications);

      const result = await notificationService.list("user-1", { limit: 3 });

      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(10);
    });

    test("should apply offset correctly", async () => {
      // 5 notifications sorted newest-first; offset=3 should skip the 3 newest
      const notifications = Array.from({ length: 5 }, (_, i) =>
        makeNotification({
          id: `n-${i}`,
          createdAt: new Date(2026, 0, i + 1).toISOString(),
        })
      );
      mockState.files[userFilePath("user-1")] = toJsonl(notifications);

      const result = await notificationService.list("user-1", { offset: 3 });

      expect(result.notifications).toHaveLength(2);
    });

    test("should default limit to 50 when not specified", async () => {
      // 60 entries — only 50 should be returned
      const notifications = Array.from({ length: 60 }, (_, i) =>
        makeNotification({
          id: `n-${i}`,
          createdAt: new Date(2026, 0, i + 1).toISOString(),
        })
      );
      mockState.files[userFilePath("user-1")] = toJsonl(notifications);

      const result = await notificationService.list("user-1");

      expect(result.notifications).toHaveLength(50);
    });
  });

  // -------------------------------------------------------------------------
  // markAsRead()
  // -------------------------------------------------------------------------

  describe("markAsRead()", () => {
    test("should return false when the notification does not exist", async () => {
      mockState.files[userFilePath("user-1")] = toJsonl([
        makeNotification({ id: "n-1" }),
      ]);

      const result = await notificationService.markAsRead("n-999", "user-1");

      expect(result).toBe(false);
    });

    test("should return true when the notification is successfully marked as read", async () => {
      const n = makeNotification({ id: "n-1", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const result = await notificationService.markAsRead("n-1", "user-1");

      expect(result).toBe(true);
    });

    test("should return true immediately when the notification is already read", async () => {
      const n = makeNotification({ id: "n-1", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const result = await notificationService.markAsRead("n-1", "user-1");

      expect(result).toBe(true);
    });

    test("should set read=true on the persisted notification", async () => {
      const n = makeNotification({ id: "n-1", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      await notificationService.markAsRead("n-1", "user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries[0].read).toBe(true);
    });

    test("should set readAt to a valid ISO timestamp", async () => {
      const n = makeNotification({ id: "n-1", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const before = new Date().toISOString();
      await notificationService.markAsRead("n-1", "user-1");
      const after = new Date().toISOString();

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries[0].readAt).toBeDefined();
      expect(entries[0].readAt >= before).toBe(true);
      expect(entries[0].readAt <= after).toBe(true);
    });

    test("should not mutate other notifications in the file", async () => {
      const n1 = makeNotification({ id: "n-1", read: false, title: "One" });
      const n2 = makeNotification({ id: "n-2", read: false, title: "Two" });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      await notificationService.markAsRead("n-1", "user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      const n2After = entries.find((e: any) => e.id === "n-2");
      expect(n2After.read).toBe(false);
    });

    test("should return false when user file does not exist", async () => {
      const result = await notificationService.markAsRead("n-1", "user-1");
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // markAllAsRead()
  // -------------------------------------------------------------------------

  describe("markAllAsRead()", () => {
    test("should return 0 when no notifications exist", async () => {
      const count = await notificationService.markAllAsRead("user-1");
      expect(count).toBe(0);
    });

    test("should return 0 when all notifications are already read", async () => {
      const n1 = makeNotification({ id: "n-1", read: true });
      const n2 = makeNotification({ id: "n-2", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      const count = await notificationService.markAllAsRead("user-1");

      expect(count).toBe(0);
    });

    test("should return the number of notifications that were marked as read", async () => {
      const n1 = makeNotification({ id: "n-1", read: false });
      const n2 = makeNotification({ id: "n-2", read: true });
      const n3 = makeNotification({ id: "n-3", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2, n3]);

      const count = await notificationService.markAllAsRead("user-1");

      expect(count).toBe(2);
    });

    test("should persist all notifications with read=true after calling markAllAsRead", async () => {
      const n1 = makeNotification({ id: "n-1", read: false });
      const n2 = makeNotification({ id: "n-2", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      await notificationService.markAllAsRead("user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries.every((e: any) => e.read === true)).toBe(true);
    });

    test("should set readAt on every newly-read notification", async () => {
      const n1 = makeNotification({ id: "n-1", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n1]);

      await notificationService.markAllAsRead("user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries[0].readAt).toBeDefined();
    });

    test("should not rewrite the file when no notifications needed updating", async () => {
      const n = makeNotification({ id: "n-1", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);
      const contentBefore = mockState.files[userFilePath("user-1")];

      await notificationService.markAllAsRead("user-1");

      // File should not have been touched (count was 0, no write occurs)
      expect(mockState.files[userFilePath("user-1")]).toBe(contentBefore);
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------

  describe("delete()", () => {
    test("should return false when the user has no notifications file", async () => {
      const result = await notificationService.delete("n-1", "user-1");
      expect(result).toBe(false);
    });

    test("should return false when the notification ID does not exist", async () => {
      const n = makeNotification({ id: "n-1" });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const result = await notificationService.delete("n-999", "user-1");

      expect(result).toBe(false);
    });

    test("should return true when the notification is successfully deleted", async () => {
      const n = makeNotification({ id: "n-1" });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      const result = await notificationService.delete("n-1", "user-1");

      expect(result).toBe(true);
    });

    test("should remove the notification from the persisted file", async () => {
      const n1 = makeNotification({ id: "n-1" });
      const n2 = makeNotification({ id: "n-2" });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      await notificationService.delete("n-1", "user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries.find((e: any) => e.id === "n-1")).toBeUndefined();
    });

    test("should leave other notifications intact after deletion", async () => {
      const n1 = makeNotification({ id: "n-1", title: "Keep me" });
      const n2 = makeNotification({ id: "n-2", title: "Delete me" });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      await notificationService.delete("n-2", "user-1");

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("n-1");
    });

    test("should result in an empty file when the last notification is deleted", async () => {
      const n = makeNotification({ id: "n-1" });
      mockState.files[userFilePath("user-1")] = toJsonl([n]);

      await notificationService.delete("n-1", "user-1");

      const content = mockState.files[userFilePath("user-1")] ?? "";
      expect(content.trim()).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // getUnreadCount()
  // -------------------------------------------------------------------------

  describe("getUnreadCount()", () => {
    test("should return 0 when the user has no notification file", async () => {
      const count = await notificationService.getUnreadCount("user-1");
      expect(count).toBe(0);
    });

    test("should return 0 when all notifications are read", async () => {
      const n1 = makeNotification({ id: "n-1", read: true });
      const n2 = makeNotification({ id: "n-2", read: true });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2]);

      const count = await notificationService.getUnreadCount("user-1");

      expect(count).toBe(0);
    });

    test("should return the correct unread count", async () => {
      const n1 = makeNotification({ id: "n-1", read: false });
      const n2 = makeNotification({ id: "n-2", read: true });
      const n3 = makeNotification({ id: "n-3", read: false });
      mockState.files[userFilePath("user-1")] = toJsonl([n1, n2, n3]);

      const count = await notificationService.getUnreadCount("user-1");

      expect(count).toBe(2);
    });

    test("should count all notifications as unread when all are unread", async () => {
      const notifications = Array.from({ length: 5 }, (_, i) =>
        makeNotification({ id: `n-${i}`, read: false })
      );
      mockState.files[userFilePath("user-1")] = toJsonl(notifications);

      const count = await notificationService.getUnreadCount("user-1");

      expect(count).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // notifyTaskCompleted()
  // -------------------------------------------------------------------------

  describe("notifyTaskCompleted()", () => {
    test("should create a notification with type=task_completed", async () => {
      const task = makeTask();
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.type).toBe("task_completed");
    });

    test("should use the task title as the notification message", async () => {
      const task = makeTask({ title: "My important task" });
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.message).toBe("My important task");
    });

    test("should set resourceType=task and resourceId to the task id", async () => {
      const task = makeTask({ id: "task-99" });
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.resourceType).toBe("task");
      expect(result.resourceId).toBe("task-99");
    });

    test("should set actionUrl pointing to the task", async () => {
      const task = makeTask({ id: "task-42" });
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.actionUrl).toBe("/tasks?open=task-42");
    });

    test("should include taskId, taskType, and resultSummary in metadata", async () => {
      const task = makeTask({
        id: "task-1",
        type: "simple",
        result_summary: "All done",
      });
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.metadata).toEqual({
        taskId: "task-1",
        taskType: "simple",
        resultSummary: "All done",
      });
    });

    test("should set icon=check", async () => {
      const task = makeTask();
      const result = await notificationService.notifyTaskCompleted(
        "user-1",
        task
      );

      expect(result.icon).toBe("check");
    });

    test("should persist the notification for the given userId", async () => {
      const task = makeTask();
      await notificationService.notifyTaskCompleted("user-42", task);

      const filePath = userFilePath("user-42");
      expect(mockState.files[filePath]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // notifyTaskFailed()
  // -------------------------------------------------------------------------

  describe("notifyTaskFailed()", () => {
    test("should create a notification with type=task_failed", async () => {
      const task = makeTask();
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "Timeout"
      );

      expect(result.type).toBe("task_failed");
    });

    test("should concatenate task title and error string in the message", async () => {
      const task = makeTask({ title: "Research task" });
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "Out of memory"
      );

      expect(result.message).toBe("Research task: Out of memory");
    });

    test("should set resourceType=task and resourceId to the task id", async () => {
      const task = makeTask({ id: "task-fail-1" });
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "err"
      );

      expect(result.resourceType).toBe("task");
      expect(result.resourceId).toBe("task-fail-1");
    });

    test("should set actionUrl pointing to the task", async () => {
      const task = makeTask({ id: "task-fail-2" });
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "err"
      );

      expect(result.actionUrl).toBe("/tasks?open=task-fail-2");
    });

    test("should include taskId, taskType, and error in metadata", async () => {
      const task = makeTask({ id: "task-1", type: "deep-research" });
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "timeout"
      );

      expect(result.metadata).toEqual({
        taskId: "task-1",
        taskType: "deep-research",
        error: "timeout",
      });
    });

    test("should set icon=alert", async () => {
      const task = makeTask();
      const result = await notificationService.notifyTaskFailed(
        "user-1",
        task,
        "err"
      );

      expect(result.icon).toBe("alert");
    });
  });

  // -------------------------------------------------------------------------
  // addListener() / removeListener() / broadcast()
  // -------------------------------------------------------------------------

  describe("SSE listener management", () => {
    describe("addListener()", () => {
      test("should call the listener when broadcast is called for the user", () => {
        const received: any[] = [];
        const listener = (n: any) => received.push(n);
        notificationService.addListener("user-1", listener);

        const notification = makeNotification({ id: "n-broadcast" });
        notificationService.broadcast("user-1", notification);

        expect(received).toHaveLength(1);
        expect(received[0].id).toBe("n-broadcast");
      });

      test("should support multiple listeners for the same user", () => {
        const results1: any[] = [];
        const results2: any[] = [];
        notificationService.addListener("user-1", (n) => results1.push(n));
        notificationService.addListener("user-1", (n) => results2.push(n));

        notificationService.broadcast("user-1", makeNotification());

        expect(results1).toHaveLength(1);
        expect(results2).toHaveLength(1);
      });

      test("should not call listeners registered for a different user", () => {
        const received: any[] = [];
        notificationService.addListener("user-2", (n) => received.push(n));

        notificationService.broadcast("user-1", makeNotification());

        expect(received).toHaveLength(0);
      });
    });

    describe("removeListener()", () => {
      test("should stop calling the listener after it is removed", () => {
        const received: any[] = [];
        const listener = (n: any) => received.push(n);

        notificationService.addListener("user-1", listener);
        notificationService.removeListener("user-1", listener);

        notificationService.broadcast("user-1", makeNotification());

        expect(received).toHaveLength(0);
      });

      test("should clean up the user entry when the last listener is removed", () => {
        const listener = () => {};
        notificationService.addListener("user-1", listener);
        notificationService.removeListener("user-1", listener);

        // After removal the user key should no longer exist in the listeners map
        const listenersMap: Map<string, Set<any>> = (notificationService as any)
          .listeners;
        expect(listenersMap.has("user-1")).toBe(false);
      });

      test("should be a no-op when called for a user that has no listeners", () => {
        // Should not throw
        expect(() =>
          notificationService.removeListener("nonexistent-user", () => {})
        ).not.toThrow();
      });
    });

    describe("broadcast()", () => {
      test("should be a no-op when no listeners are registered for the user", () => {
        // Should not throw even with no listeners
        expect(() =>
          notificationService.broadcast("user-1", makeNotification())
        ).not.toThrow();
      });

      test("should remove a listener that throws an error during broadcast", () => {
        let callCount = 0;
        const throwingListener = () => {
          callCount++;
          throw new Error("Listener crash");
        };
        notificationService.addListener("user-1", throwingListener);

        // First broadcast: listener throws and is removed
        notificationService.broadcast("user-1", makeNotification());

        // Second broadcast: listener should no longer be called
        notificationService.broadcast("user-1", makeNotification());

        expect(callCount).toBe(1);
      });

      test("should deliver the full notification object to the listener", () => {
        const received: any[] = [];
        notificationService.addListener("user-1", (n) => received.push(n));

        const n = makeNotification({
          id: "n-full",
          title: "Complete",
          metadata: { key: "value" },
        });
        notificationService.broadcast("user-1", n);

        expect(received[0].id).toBe("n-full");
        expect(received[0].title).toBe("Complete");
        expect(received[0].metadata).toEqual({ key: "value" });
      });
    });
  });

  // -------------------------------------------------------------------------
  // cleanupOldNotifications()
  // -------------------------------------------------------------------------

  describe("cleanupOldNotifications()", () => {
    test("should return 0 when the user has no notifications file", async () => {
      const count = await notificationService.cleanupOldNotifications(
        "user-1",
        30
      );
      expect(count).toBe(0);
    });

    test("should return 0 when all notifications are within the retention window", async () => {
      const recent = makeNotification({
        id: "n-1",
        createdAt: new Date().toISOString(),
      });
      mockState.files[userFilePath("user-1")] = toJsonl([recent]);

      const count = await notificationService.cleanupOldNotifications(
        "user-1",
        30
      );

      expect(count).toBe(0);
    });

    test("should delete notifications older than the specified days", async () => {
      const old = makeNotification({
        id: "n-old",
        createdAt: "2020-01-01T00:00:00.000Z",
      });
      mockState.files[userFilePath("user-1")] = toJsonl([old]);

      const count = await notificationService.cleanupOldNotifications(
        "user-1",
        30
      );

      expect(count).toBe(1);
    });

    test("should retain notifications that are within the retention window", async () => {
      const old = makeNotification({
        id: "n-old",
        createdAt: "2020-01-01T00:00:00.000Z",
      });
      const recent = makeNotification({
        id: "n-recent",
        createdAt: new Date().toISOString(),
      });
      mockState.files[userFilePath("user-1")] = toJsonl([old, recent]);

      await notificationService.cleanupOldNotifications("user-1", 30);

      const entries = fromJsonl(mockState.files[userFilePath("user-1")]!);
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("n-recent");
    });

    test("should return the correct count of deleted notifications", async () => {
      const notifications = [
        makeNotification({ id: "n-1", createdAt: "2020-01-01T00:00:00.000Z" }),
        makeNotification({ id: "n-2", createdAt: "2020-06-01T00:00:00.000Z" }),
        makeNotification({ id: "n-3", createdAt: new Date().toISOString() }),
      ];
      mockState.files[userFilePath("user-1")] = toJsonl(notifications);

      const count = await notificationService.cleanupOldNotifications(
        "user-1",
        30
      );

      expect(count).toBe(2);
    });

    test("should use a default retention of 30 days when olderThanDays is not provided", async () => {
      const old = makeNotification({
        id: "n-old",
        createdAt: "2020-01-01T00:00:00.000Z",
      });
      mockState.files[userFilePath("user-1")] = toJsonl([old]);

      // Call with no second argument — should default to 30 days
      const count = await notificationService.cleanupOldNotifications("user-1");

      expect(count).toBe(1);
    });

    test("should not rewrite the file when no notifications are removed", async () => {
      const recent = makeNotification({
        id: "n-1",
        createdAt: new Date().toISOString(),
      });
      mockState.files[userFilePath("user-1")] = toJsonl([recent]);
      const contentBefore = mockState.files[userFilePath("user-1")];

      await notificationService.cleanupOldNotifications("user-1", 30);

      // File must be unchanged (no write occurred)
      expect(mockState.files[userFilePath("user-1")]).toBe(contentBefore);
    });
  });
});
