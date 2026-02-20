/**
 * Tests for notifications API routes (backend/src/routes/notifications.ts)
 *
 * All routes require auth middleware.
 * notificationService is mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests override values as needed
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  listResult: {
    notifications: [] as any[],
    total: 0,
    unread: 0,
  },
  unreadCount: 0,
  getResult: null as any,
  markAsReadResult: false,
  markAllAsReadResult: 0,
  deleteResult: false,
  addListenerCalled: false,
  removeListenerCalled: false,
};

// ---------------------------------------------------------------------------
// Module mocks — declared before importing the module under test
// ---------------------------------------------------------------------------

// Mock auth — injects mockState.currentUser into Hono context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) {
      const { HTTPException } = require("hono/http-exception");
      throw new HTTPException(401, { message: "Nicht authentifiziert" });
    }
    return userId;
  },
}));

// Mock errorHandler — return a minimal 500 JSON response
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) => {
    return c.json({ error: "Internal server error" }, 500);
  },
}));

// Mock parseIntSafe — delegate to the real implementation inline
mock.module("../../utils/parseIntSafe", () => ({
  parseIntSafe: (value: string | undefined | null, defaultValue: number): number => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  },
}));

// Mock notificationService
mock.module("../../services/notificationService", () => ({
  notificationService: {
    list: async (_userId: string, _opts: any) => mockState.listResult,
    getUnreadCount: async (_userId: string) => mockState.unreadCount,
    get: async (_id: string, _userId: string) => mockState.getResult,
    markAsRead: async (_id: string, _userId: string) => mockState.markAsReadResult,
    markAllAsRead: async (_userId: string) => mockState.markAllAsReadResult,
    delete: async (_id: string, _userId: string) => mockState.deleteResult,
    addListener: (_userId: string, _listener: any) => {
      mockState.addListenerCalled = true;
    },
    removeListener: (_userId: string, _listener: any) => {
      mockState.removeListenerCalled = true;
    },
  },
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are registered
// ---------------------------------------------------------------------------

const { notificationRoutes } = await import("../notifications");

const app = new Hono();
app.route("/api/notifications", notificationRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeNotification(overrides: Partial<any> = {}): any {
  return {
    id: "notif-1",
    userId: "user-1",
    type: "task_completed",
    title: "Task done",
    message: "Your task finished",
    read: false,
    createdAt: "2026-02-20T10:00:00.000Z",
    ...overrides,
  };
}

function resetMockState() {
  mockState.currentUser = null;
  mockState.listResult = { notifications: [], total: 0, unread: 0 };
  mockState.unreadCount = 0;
  mockState.getResult = null;
  mockState.markAsReadResult = false;
  mockState.markAllAsReadResult = 0;
  mockState.deleteResult = false;
  mockState.addListenerCalled = false;
  mockState.removeListenerCalled = false;
}

/** Yield to the microtask/event-loop queue for a given number of milliseconds. */
function yieldMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read from an SSE stream until the buffer contains the given marker string,
 * then cancel the reader and return the accumulated buffer.
 * Limits to maxChunks iterations to avoid hanging if the marker never arrives.
 */
async function readSSEUntil(
  body: ReadableStream<Uint8Array>,
  marker: string,
  maxChunks = 10
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (let i = 0; i < maxChunks; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes(marker)) break;
  }
  reader.cancel();
  return buffer;
}

// ---------------------------------------------------------------------------
// Auth guard tests
// ---------------------------------------------------------------------------

describe("Notification Routes — Auth guard", () => {
  beforeEach(resetMockState);

  test("should return 401 when no session is present", async () => {
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(401);
  });

  test("should allow access for authenticated user", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

describe("GET /api/notifications", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return empty list when user has no notifications", async () => {
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.unread).toBe(0);
  });

  test("should return notifications list with counts", async () => {
    const n1 = makeNotification({ id: "n1", read: false });
    const n2 = makeNotification({ id: "n2", read: true });
    mockState.listResult = { notifications: [n1, n2], total: 2, unread: 1 };

    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.unread).toBe(1);
  });

  test("should pass limit query param to service without error", async () => {
    const res = await app.request("/api/notifications?limit=10");
    expect(res.status).toBe(200);
  });

  test("should pass offset query param to service without error", async () => {
    const res = await app.request("/api/notifications?offset=5");
    expect(res.status).toBe(200);
  });

  test("should pass unread_only=true query param to service", async () => {
    const unread = makeNotification({ id: "n1", read: false });
    mockState.listResult = { notifications: [unread], total: 1, unread: 1 };

    const res = await app.request("/api/notifications?unread_only=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
  });

  test("should use default limit=50 when limit is absent", async () => {
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
  });

  test("should use default limit when non-numeric limit is provided", async () => {
    const res = await app.request("/api/notifications?limit=abc");
    expect(res.status).toBe(200);
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.list;
    notificationService.list = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications");
    expect(res.status).toBe(500);

    notificationService.list = original;
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/count
// ---------------------------------------------------------------------------

describe("GET /api/notifications/count", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return unread count of zero when no notifications exist", async () => {
    mockState.unreadCount = 0;
    const res = await app.request("/api/notifications/count");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unread).toBe(0);
  });

  test("should return correct unread count", async () => {
    mockState.unreadCount = 7;
    const res = await app.request("/api/notifications/count");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unread).toBe(7);
  });

  test("should return 401 when unauthenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/notifications/count");
    expect(res.status).toBe(401);
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.getUnreadCount;
    notificationService.getUnreadCount = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications/count");
    expect(res.status).toBe(500);

    notificationService.getUnreadCount = original;
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/:id
// ---------------------------------------------------------------------------

describe("GET /api/notifications/:id", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return 404 when notification does not exist", async () => {
    mockState.getResult = null;
    const res = await app.request("/api/notifications/notif-999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return the notification when it exists", async () => {
    mockState.getResult = makeNotification({ id: "notif-42" });
    const res = await app.request("/api/notifications/notif-42");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("notif-42");
    expect(body.type).toBe("task_completed");
  });

  test("should include all expected fields in the response", async () => {
    mockState.getResult = makeNotification({
      id: "notif-1",
      title: "Done",
      message: "Task finished",
      read: false,
    });
    const res = await app.request("/api/notifications/notif-1");
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("read");
    expect(body).toHaveProperty("createdAt");
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.get;
    notificationService.get = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications/notif-1");
    expect(res.status).toBe(500);

    notificationService.get = original;
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/read
// ---------------------------------------------------------------------------

describe("POST /api/notifications/:id/read", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return 404 when notification does not exist", async () => {
    mockState.markAsReadResult = false;
    const res = await app.request("/api/notifications/notif-999/read", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return success when notification is marked as read", async () => {
    mockState.markAsReadResult = true;
    const res = await app.request("/api/notifications/notif-1/read", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 401 when unauthenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/notifications/notif-1/read", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.markAsRead;
    notificationService.markAsRead = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications/notif-1/read", {
      method: "POST",
    });
    expect(res.status).toBe(500);

    notificationService.markAsRead = original;
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/read-all
// ---------------------------------------------------------------------------

describe("POST /api/notifications/read-all", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return success with count=0 when no unread notifications exist", async () => {
    mockState.markAllAsReadResult = 0;
    const res = await app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
  });

  test("should return the number of notifications marked as read", async () => {
    mockState.markAllAsReadResult = 5;
    const res = await app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(5);
  });

  test("should return 401 when unauthenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.markAllAsRead;
    notificationService.markAllAsRead = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications/read-all", {
      method: "POST",
    });
    expect(res.status).toBe(500);

    notificationService.markAllAsRead = original;
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/notifications/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/notifications/:id", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return 404 when notification does not exist", async () => {
    mockState.deleteResult = false;
    const res = await app.request("/api/notifications/notif-999", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return success when notification is deleted", async () => {
    mockState.deleteResult = true;
    const res = await app.request("/api/notifications/notif-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 401 when unauthenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/notifications/notif-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("should return 500 when service throws", async () => {
    const { notificationService } = await import("../../services/notificationService" as any);
    const original = notificationService.delete;
    notificationService.delete = async () => {
      throw new Error("Storage failure");
    };

    const res = await app.request("/api/notifications/notif-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(500);

    notificationService.delete = original;
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/stream
// ---------------------------------------------------------------------------

describe("GET /api/notifications/stream", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    mockState.unreadCount = 3;
  });

  test("should return 401 when unauthenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/notifications/stream");
    expect(res.status).toBe(401);
  });

  test("should return a streaming SSE response with text/event-stream content type", async () => {
    const res = await app.request("/api/notifications/stream");
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");
    // Cancel the stream body so the test does not hang
    await res.body?.cancel();
  });

  test("should send init event with unread count as first SSE message", async () => {
    mockState.unreadCount = 4;
    const res = await app.request("/api/notifications/stream");
    // Read until we see the init event, then cancel to avoid blocking on heartbeat
    const buffer = await readSSEUntil(res.body!, "init");

    expect(buffer).toContain("event: init");
    expect(buffer).toContain('"unread":4');
  });

  test("should register a listener for the authenticated user after sending init event", async () => {
    // The SSE handler calls addListener synchronously right after writeSSE(init).
    // We read until "init" appears (proving writeSSE returned), then yield a few
    // event-loop ticks to let the handler's continuation (addListener) execute.
    const res = await app.request("/api/notifications/stream");
    await readSSEUntil(res.body!, "init");

    // Drain the microtask/event queue so the SSE handler advances past writeSSE
    // to the addListener call before we check the flag.
    await yieldMs(20);

    expect(mockState.addListenerCalled).toBe(true);
  });
});
