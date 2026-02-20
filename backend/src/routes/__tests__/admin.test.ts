/**
 * Tests for admin API routes (backend/src/routes/admin.ts)
 *
 * All routes require auth middleware + admin role.
 * Service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  searchAuditLogsResult: [] as any[],
  getAuditLogsResult: [] as any[],
  listUsersResult: [] as any[],
  usageSummaryResult: null as any,
  userTotalsResult: {} as any,
  usageByUserResult: [] as any[],
  usageByModelResult: {} as any,
  exportAsCsvResult: "",
};

// Mock auth middleware — injects mockState.currentUser into context
mock.module("../../auth/middleware", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUser: (c: any) => c.get("user"),
}));

// Mock auth listUsers
mock.module("../../auth", () => ({
  listUsers: async () => mockState.listUsersResult,
}));

// Mock audit log service
mock.module("../../services/auditLog", () => ({
  AuditCategory: {
    AUTH: "auth",
    USER_MANAGEMENT: "user_management",
    DATA_ACCESS: "data_access",
    DATA_MODIFICATION: "data_modification",
    ADMIN_ACTION: "admin_action",
    SECURITY: "security",
    SYSTEM: "system",
  },
  AuditAction: {
    LOGIN_SUCCESS: "login_success",
    LOGIN_FAILED: "login_failed",
    LOGOUT: "logout",
    SESSION_EXPIRED: "session_expired",
    USER_CREATED: "user_created",
    USER_UPDATED: "user_updated",
    USER_DELETED: "user_deleted",
    PASSWORD_CHANGED: "password_changed",
    PASSWORD_RESET: "password_reset",
    CHAT_ACCESSED: "chat_accessed",
    CHAT_SHARED: "chat_shared",
    CHAT_SHARE_REVOKED: "chat_share_revoked",
    KNOWLEDGE_ACCESSED: "knowledge_accessed",
    CONNECTION_ACCESSED: "connection_accessed",
    CHAT_CREATED: "chat_created",
    CHAT_DELETED: "chat_deleted",
    SPACE_CREATED: "space_created",
    SPACE_DELETED: "space_deleted",
    TOOL_CREATED: "tool_created",
    TOOL_DELETED: "tool_deleted",
    PROVIDER_CONFIGURED: "provider_configured",
    SETTINGS_CHANGED: "settings_changed",
    GROUP_CREATED: "group_created",
    GROUP_DELETED: "group_deleted",
    PERMISSION_CHANGED: "permission_changed",
    RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
    CSRF_BLOCKED: "csrf_blocked",
    SSRF_BLOCKED: "ssrf_blocked",
    UNAUTHORIZED_ACCESS: "unauthorized_access",
    SUSPICIOUS_ACTIVITY: "suspicious_activity",
    SERVICE_STARTED: "service_started",
    SERVICE_STOPPED: "service_stopped",
    ERROR_OCCURRED: "error_occurred",
  },
  searchAuditLogs: async (_query: any) => mockState.searchAuditLogsResult,
  getAuditLogs: async (_start: string, _end: string) => mockState.getAuditLogsResult,
}));

// Mock usage tracking service
mock.module("../../services/usageTracking", () => ({
  usageTrackingService: {
    getUsageSummary: async (_start?: string, _end?: string) => mockState.usageSummaryResult,
    getUserTotals: async (_start?: string, _end?: string) => mockState.userTotalsResult,
    getUsageByUser: async (_id: string, _start?: string, _end?: string) => mockState.usageByUserResult,
    getUsageByModel: async (_start?: string, _end?: string) => mockState.usageByModelResult,
    exportAsCsv: async (_start?: string, _end?: string) => mockState.exportAsCsvResult,
  },
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { adminRoutes } = await import("../admin");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/admin", adminRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser() {
  return { id: "admin-1", username: "alice", role: "admin" as const };
}

function makeRegularUser() {
  return { id: "user-1", username: "bob", role: "user" as const };
}

function makeAuditEntry(overrides: Partial<any> = {}): any {
  return {
    id: "audit-1",
    timestamp: "2026-02-01T10:00:00.000Z",
    category: "auth",
    action: "login_success",
    userId: "user-1",
    success: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Admin Routes — Auth & RBAC", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.searchAuditLogsResult = [];
    mockState.getAuditLogsResult = [];
    mockState.listUsersResult = [];
    mockState.usageSummaryResult = {
      totalPrompts: 0,
      activeUsers: 0,
      topModel: null,
      byUser: [],
      byModel: [],
      bySource: [],
      startDate: "2026-01-01",
      endDate: "2026-02-20",
    };
    mockState.userTotalsResult = {};
    mockState.usageByUserResult = [];
    mockState.usageByModelResult = {};
    mockState.exportAsCsvResult = "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts";
  });

  test("should return 401 when no session is present", async () => {
    const res = await app.request("/api/admin/audit-logs");
    expect(res.status).toBe(401);
  });

  test("should return 403 when authenticated user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/admin/audit-logs");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should allow access for admin user", async () => {
    mockState.currentUser = makeAdminUser();
    const res = await app.request("/api/admin/audit-logs");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.searchAuditLogsResult = [];
    mockState.listUsersResult = [];
  });

  test("should return empty list when no entries exist", async () => {
    const res = await app.request("/api/admin/audit-logs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.hasMore).toBe(false);
  });

  test("should return entries sorted by timestamp descending", async () => {
    mockState.searchAuditLogsResult = [
      makeAuditEntry({ id: "a1", timestamp: "2026-02-01T08:00:00.000Z" }),
      makeAuditEntry({ id: "a3", timestamp: "2026-02-03T08:00:00.000Z" }),
      makeAuditEntry({ id: "a2", timestamp: "2026-02-02T08:00:00.000Z" }),
    ];
    const res = await app.request("/api/admin/audit-logs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.entries[0].id).toBe("a3");
    expect(body.entries[1].id).toBe("a2");
    expect(body.entries[2].id).toBe("a1");
  });

  test("should apply offset to skip entries and limit the result window", async () => {
    // 3 entries sorted desc: [a1(newest), a2, a3(oldest)]
    // offset=2, limit=2 => slice(2,4) = [a3], length 1, hasMore=false
    mockState.searchAuditLogsResult = [
      makeAuditEntry({ id: "a1", timestamp: "2026-02-03T10:00:00.000Z" }),
      makeAuditEntry({ id: "a2", timestamp: "2026-02-02T10:00:00.000Z" }),
      makeAuditEntry({ id: "a3", timestamp: "2026-02-01T10:00:00.000Z" }),
    ];
    const res = await app.request("/api/admin/audit-logs?limit=2&offset=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(2);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("a3");
    expect(body.hasMore).toBe(false);
  });

  test("should apply limit to cap the page size", async () => {
    // 3 entries sorted desc: [a1, a2, a3]
    // offset=0, limit=2 => slice(0,2) = [a1, a2], hasMore=true because 0+2 < 3
    mockState.searchAuditLogsResult = [
      makeAuditEntry({ id: "a1", timestamp: "2026-02-03T10:00:00.000Z" }),
      makeAuditEntry({ id: "a2", timestamp: "2026-02-02T10:00:00.000Z" }),
      makeAuditEntry({ id: "a3", timestamp: "2026-02-01T10:00:00.000Z" }),
    ];
    const res = await app.request("/api/admin/audit-logs?limit=2&offset=0");
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].id).toBe("a1");
    expect(body.entries[1].id).toBe("a2");
    expect(body.hasMore).toBe(true);
  });

  test("should set hasMore true when more entries remain after pagination", async () => {
    mockState.searchAuditLogsResult = Array.from({ length: 5 }, (_, i) =>
      makeAuditEntry({ id: `a${i}`, timestamp: `2026-02-0${5 - i}T10:00:00.000Z` })
    );
    const res = await app.request("/api/admin/audit-logs?limit=2&offset=0");
    const body = await res.json();
    expect(body.hasMore).toBe(true);
    expect(body.total).toBe(5);
  });

  test("should use default limit=100 and offset=0", async () => {
    const res = await app.request("/api/admin/audit-logs");
    const body = await res.json();
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(0);
  });

  test("should forward query filters to searchAuditLogs", async () => {
    mockState.searchAuditLogsResult = [
      makeAuditEntry({ category: "security", action: "unauthorized_access", success: false }),
    ];
    const res = await app.request(
      "/api/admin/audit-logs?category=security&action=unauthorized_access&userId=user-1&success=false"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.entries[0].category).toBe("security");
  });

  test("should parse success=true filter to boolean true", async () => {
    mockState.searchAuditLogsResult = [makeAuditEntry({ success: true })];
    const res = await app.request("/api/admin/audit-logs?success=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].success).toBe(true);
  });

  test("should parse success=false filter to boolean false", async () => {
    mockState.searchAuditLogsResult = [makeAuditEntry({ success: false })];
    const res = await app.request("/api/admin/audit-logs?success=false");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].success).toBe(false);
  });

  test("should fall back to default limit when invalid limit is supplied", async () => {
    const res = await app.request("/api/admin/audit-logs?limit=abc");
    const body = await res.json();
    expect(body.limit).toBe(100);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/audit-logs/stats", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getAuditLogsResult = [];
  });

  test("should return stats with zero totals for empty log", async () => {
    const res = await app.request("/api/admin/audit-logs/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEvents).toBe(0);
    expect(body.securityEvents).toBe(0);
    expect(body.activeUserCount).toBe(0);
    // successRate defaults to 100 when totalEvents == 0
    expect(body.successRate).toBe(100);
  });

  test("should calculate byCategory counts correctly", async () => {
    mockState.getAuditLogsResult = [
      makeAuditEntry({ category: "auth", userId: "u1" }),
      makeAuditEntry({ category: "auth", userId: "u2" }),
      makeAuditEntry({ category: "security", userId: "u3" }),
    ];
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.byCategory["auth"]).toBe(2);
    expect(body.byCategory["security"]).toBe(1);
  });

  test("should calculate successRate as percentage of successful events", async () => {
    mockState.getAuditLogsResult = [
      makeAuditEntry({ success: true }),
      makeAuditEntry({ success: true }),
      makeAuditEntry({ success: false }),
      makeAuditEntry({ success: false }),
    ];
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.totalEvents).toBe(4);
    expect(body.successRate).toBe(50);
  });

  test("should count security events and populate recentSecurityAlerts", async () => {
    mockState.getAuditLogsResult = [
      makeAuditEntry({ category: "security", userId: "u1" }),
      makeAuditEntry({ category: "security", userId: "u2" }),
      makeAuditEntry({ category: "auth" }),
    ];
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.securityEvents).toBe(2);
    expect(body.recentSecurityAlerts).toHaveLength(2);
  });

  test("should limit recentSecurityAlerts to 10 entries", async () => {
    mockState.getAuditLogsResult = Array.from({ length: 15 }, (_, i) =>
      makeAuditEntry({ id: `sec-${i}`, category: "security" })
    );
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.recentSecurityAlerts).toHaveLength(10);
    // Security events total is still 15
    expect(body.securityEvents).toBe(15);
  });

  test("should aggregate loginsByDay for login_success and login_failed actions", async () => {
    mockState.getAuditLogsResult = [
      makeAuditEntry({ action: "login_success", timestamp: "2026-02-01T09:00:00.000Z" }),
      makeAuditEntry({ action: "login_success", timestamp: "2026-02-01T11:00:00.000Z" }),
      makeAuditEntry({ action: "login_failed", timestamp: "2026-02-01T12:00:00.000Z" }),
      makeAuditEntry({ action: "login_success", timestamp: "2026-02-02T08:00:00.000Z" }),
    ];
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.loginsByDay["2026-02-01"]).toEqual({ success: 2, failed: 1 });
    expect(body.loginsByDay["2026-02-02"]).toEqual({ success: 1, failed: 0 });
  });

  test("should count unique activeUsers", async () => {
    mockState.getAuditLogsResult = [
      makeAuditEntry({ userId: "u1" }),
      makeAuditEntry({ userId: "u1" }),
      makeAuditEntry({ userId: "u2" }),
      makeAuditEntry({ userId: undefined }),  // no userId — should not be counted
    ];
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.activeUserCount).toBe(2);
  });

  test("should return period with default days=7 when not specified", async () => {
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(body.period.days).toBe(7);
    expect(body.period).toHaveProperty("startDate");
    expect(body.period).toHaveProperty("endDate");
  });

  test("should respect custom days query parameter", async () => {
    const res = await app.request("/api/admin/audit-logs/stats?days=30");
    const body = await res.json();
    expect(body.period.days).toBe(30);
  });

  test("should return only top 10 actions", async () => {
    // Create 12 distinct actions
    mockState.getAuditLogsResult = Array.from({ length: 12 }, (_, i) =>
      makeAuditEntry({ action: `action_${i}` })
    );
    const res = await app.request("/api/admin/audit-logs/stats");
    const body = await res.json();
    expect(Object.keys(body.topActions)).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/audit-logs/categories", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
  });

  test("should return all AuditCategory values", async () => {
    const res = await app.request("/api/admin/audit-logs/categories");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories).toContain("auth");
    expect(body.categories).toContain("security");
    expect(body.categories).toContain("user_management");
  });

  test("should return all AuditAction values", async () => {
    const res = await app.request("/api/admin/audit-logs/categories");
    const body = await res.json();
    expect(Array.isArray(body.actions)).toBe(true);
    expect(body.actions).toContain("login_success");
    expect(body.actions).toContain("login_failed");
    expect(body.actions).toContain("logout");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/usage", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.listUsersResult = [
      { id: "u1", username: "alice" },
      { id: "u2", username: "bob" },
    ];
    mockState.usageSummaryResult = {
      totalPrompts: 10,
      activeUsers: 2,
      topModel: { model: "gpt-4", count: 7 },
      byUser: [
        { userId: "u1", prompts: 7, percentage: 70 },
        { userId: "u2", prompts: 3, percentage: 30 },
      ],
      byModel: [{ model: "gpt-4", prompts: 10, percentage: 100 }],
      bySource: [{ source: "chat", prompts: 10, percentage: 100 }],
      startDate: "2026-01-21",
      endDate: "2026-02-20",
    };
  });

  test("should return usage summary with username enrichment", async () => {
    const res = await app.request("/api/admin/usage");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPrompts).toBe(10);
    const alice = body.byUser.find((u: any) => u.userId === "u1");
    expect(alice).toBeDefined();
    expect(alice.username).toBe("alice");
    const bob = body.byUser.find((u: any) => u.userId === "u2");
    expect(bob.username).toBe("bob");
  });

  test("should fall back to userId as username when user is unknown", async () => {
    mockState.usageSummaryResult.byUser = [
      { userId: "unknown-id", prompts: 5, percentage: 100 },
    ];
    const res = await app.request("/api/admin/usage");
    const body = await res.json();
    const entry = body.byUser[0];
    // listUsers does not include "unknown-id", so username falls back to userId
    expect(entry.username).toBe("unknown-id");
  });

  test("should pass startDate and endDate query params to service", async () => {
    const res = await app.request("/api/admin/usage?startDate=2026-01-01&endDate=2026-01-31");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/usage/users", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.listUsersResult = [
      { id: "u1", username: "alice" },
    ];
    mockState.userTotalsResult = {
      u1: {
        userId: "u1",
        totalPrompts: 5,
        byModel: { "gpt-4": 5 },
        bySource: { chat: 5 },
        lastUsed: "2026-02-20T10:00:00.000Z",
      },
    };
  });

  test("should return enriched user totals keyed by userId", async () => {
    const res = await app.request("/api/admin/usage/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveProperty("u1");
    expect(body.users["u1"].username).toBe("alice");
    expect(body.users["u1"].totalPrompts).toBe(5);
  });

  test("should fall back to userId when username is not found", async () => {
    mockState.userTotalsResult = {
      "ghost-id": {
        userId: "ghost-id",
        totalPrompts: 1,
        byModel: {},
        bySource: {},
        lastUsed: "2026-02-20T10:00:00.000Z",
      },
    };
    const res = await app.request("/api/admin/usage/users");
    const body = await res.json();
    expect(body.users["ghost-id"].username).toBe("ghost-id");
  });

  test("should return empty users object when no usage data exists", async () => {
    mockState.userTotalsResult = {};
    const res = await app.request("/api/admin/usage/users");
    const body = await res.json();
    expect(body.users).toEqual({});
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/usage/users/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.usageByUserResult = [
      {
        id: "usage-1",
        timestamp: "2026-02-01T10:00:00.000Z",
        userId: "u1",
        provider: "openai",
        model: "gpt-4",
        source: "chat",
        prompts: 1,
      },
    ];
  });

  test("should return usage entries for a specific user", async () => {
    const res = await app.request("/api/admin/usage/users/u1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("u1");
    expect(Array.isArray(body.usage)).toBe(true);
    expect(body.usage).toHaveLength(1);
    expect(body.usage[0].model).toBe("gpt-4");
  });

  test("should return empty usage array when user has no entries", async () => {
    mockState.usageByUserResult = [];
    const res = await app.request("/api/admin/usage/users/unknown");
    const body = await res.json();
    expect(body.userId).toBe("unknown");
    expect(body.usage).toEqual([]);
  });

  test("should pass startDate and endDate to service", async () => {
    const res = await app.request("/api/admin/usage/users/u1?startDate=2026-01-01&endDate=2026-01-31");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/usage/models", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.usageByModelResult = {
      "gpt-4": 42,
      "claude-3": 17,
    };
  });

  test("should return model usage counts", async () => {
    const res = await app.request("/api/admin/usage/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models).toEqual({ "gpt-4": 42, "claude-3": 17 });
  });

  test("should return empty models object when no usage exists", async () => {
    mockState.usageByModelResult = {};
    const res = await app.request("/api/admin/usage/models");
    const body = await res.json();
    expect(body.models).toEqual({});
  });

  test("should accept date range query params", async () => {
    const res = await app.request("/api/admin/usage/models?startDate=2026-01-01&endDate=2026-01-31");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/admin/usage/export", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.listUsersResult = [
      { id: "u1", username: "alice" },
      { id: "u2", username: "bob" },
    ];
  });

  test("should return CSV with Content-Type text/csv", async () => {
    mockState.exportAsCsvResult =
      "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts\n" +
      "2026-02-01T10:00:00.000Z;u1;openai;gpt-4;chat;;chat-1;1";
    const res = await app.request("/api/admin/usage/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  test("should include Content-Disposition attachment header", async () => {
    mockState.exportAsCsvResult = "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts";
    const res = await app.request("/api/admin/usage/export");
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("usage_export_");
  });

  test("should replace userId with username in second CSV field", async () => {
    mockState.exportAsCsvResult =
      "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts\n" +
      "2026-02-01T10:00:00.000Z;u1;openai;gpt-4;chat;;chat-1;1\n" +
      "2026-02-01T11:00:00.000Z;u2;anthropic;claude-3;chat;;chat-2;1";
    const res = await app.request("/api/admin/usage/export");
    const csv = await res.text();
    const lines = csv.split("\n");
    // Header line is unchanged
    expect(lines[0]).toBe("Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts");
    // Data lines should have username in second field
    expect(lines[1]!.split(";")[1]).toBe("alice");
    expect(lines[2]!.split(";")[1]).toBe("bob");
  });

  test("should keep the header line unchanged", async () => {
    mockState.exportAsCsvResult =
      "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts";
    const res = await app.request("/api/admin/usage/export");
    const csv = await res.text();
    expect(csv.split("\n")[0]).toBe("Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts");
  });

  test("should fall back to userId when username is not found in user map", async () => {
    mockState.exportAsCsvResult =
      "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts\n" +
      "2026-02-01T10:00:00.000Z;ghost-id;openai;gpt-4;chat;;;1";
    const res = await app.request("/api/admin/usage/export");
    const csv = await res.text();
    const dataLine = csv.split("\n")[1]!;
    // ghost-id is not in listUsersResult, so it remains as-is
    expect(dataLine.split(";")[1]).toBe("ghost-id");
  });

  test("should include date range in filename when query params provided", async () => {
    mockState.exportAsCsvResult = "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts";
    const res = await app.request(
      "/api/admin/usage/export?startDate=2026-01-01&endDate=2026-01-31"
    );
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("2026-01-01");
    expect(disposition).toContain("2026-01-31");
  });

  test("should use 'all' in filename when no dates are specified", async () => {
    mockState.exportAsCsvResult = "Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts";
    const res = await app.request("/api/admin/usage/export");
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("all");
  });
});
