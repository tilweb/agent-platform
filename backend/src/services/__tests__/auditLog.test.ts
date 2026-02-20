/**
 * Tests for the Audit Log Service (backend/src/services/auditLog.ts)
 *
 * File system dependencies (fs/promises, fs), path utilities, and the ID
 * generator are mocked at the module level so no real disk I/O occurs.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  files: {} as Record<string, string>,
  auditDir: "/tmp/test-audit",
  /** Counts how many times mkdir was invoked */
  mkdirCallCount: 0,
  /** Arguments passed to each mkdir invocation */
  mkdirPaths: [] as string[],
  /** Captures console.log calls made by the module */
  consoleLogs: [] as Array<unknown[]>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string) => {
    mockState.files[path] = content;
  },
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
  },
  mkdir: async (path: string) => {
    mockState.mkdirCallCount++;
    mockState.mkdirPaths.push(path);
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    // The audit dir itself is considered to exist only when there is at least
    // one file inside it (i.e. after the first write).  We track whether the
    // directory "exists" via a dedicated sentinel key so that the existsSync
    // check for the dir can be controlled independently.
    return mockState.files[path] !== undefined;
  },
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => `${prefix}_test_123`,
}));

mock.module("../../utils/paths", () => ({
  AUDIT_DIR: mockState.auditDir,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  audit,
  auditLogin,
  auditLogout,
  auditUserAction,
  auditSecurityEvent,
  auditDataAccess,
  getAuditLogs,
  searchAuditLogs,
  AuditCategory,
  AuditAction,
} = await import("../auditLog");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function todayLogPath(): string {
  return `${mockState.auditDir}/audit_${todayStr()}.jsonl`;
}

/**
 * Read all JSONL entries that have been written to the today log file.
 */
function readWrittenEntries(): any[] {
  const raw = mockState.files[todayLogPath()];
  if (!raw) return [];
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Reset all tracked mock state between tests */
function resetMockState(): void {
  mockState.files = {};
  mockState.mkdirCallCount = 0;
  mockState.mkdirPaths = [];
  mockState.consoleLogs = [];
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("AuditCategory enum", () => {
  test("should contain auth", () => {
    expect(AuditCategory.AUTH).toBe("auth");
  });

  test("should contain user_management", () => {
    expect(AuditCategory.USER_MANAGEMENT).toBe("user_management");
  });

  test("should contain data_access", () => {
    expect(AuditCategory.DATA_ACCESS).toBe("data_access");
  });

  test("should contain data_modification", () => {
    expect(AuditCategory.DATA_MODIFICATION).toBe("data_modification");
  });

  test("should contain admin_action", () => {
    expect(AuditCategory.ADMIN_ACTION).toBe("admin_action");
  });

  test("should contain security", () => {
    expect(AuditCategory.SECURITY).toBe("security");
  });

  test("should contain system", () => {
    expect(AuditCategory.SYSTEM).toBe("system");
  });
});

// ---------------------------------------------------------------------------

describe("AuditAction enum", () => {
  test("should contain login_success", () => {
    expect(AuditAction.LOGIN_SUCCESS).toBe("login_success");
  });

  test("should contain login_failed", () => {
    expect(AuditAction.LOGIN_FAILED).toBe("login_failed");
  });

  test("should contain logout", () => {
    expect(AuditAction.LOGOUT).toBe("logout");
  });

  test("should contain session_expired", () => {
    expect(AuditAction.SESSION_EXPIRED).toBe("session_expired");
  });

  test("should contain user management actions", () => {
    expect(AuditAction.USER_CREATED).toBe("user_created");
    expect(AuditAction.USER_UPDATED).toBe("user_updated");
    expect(AuditAction.USER_DELETED).toBe("user_deleted");
    expect(AuditAction.PASSWORD_CHANGED).toBe("password_changed");
    expect(AuditAction.PASSWORD_RESET).toBe("password_reset");
  });

  test("should contain data access actions", () => {
    expect(AuditAction.CHAT_ACCESSED).toBe("chat_accessed");
    expect(AuditAction.CHAT_SHARED).toBe("chat_shared");
    expect(AuditAction.CHAT_SHARE_REVOKED).toBe("chat_share_revoked");
    expect(AuditAction.KNOWLEDGE_ACCESSED).toBe("knowledge_accessed");
    expect(AuditAction.CONNECTION_ACCESSED).toBe("connection_accessed");
  });

  test("should contain data modification actions", () => {
    expect(AuditAction.CHAT_CREATED).toBe("chat_created");
    expect(AuditAction.CHAT_DELETED).toBe("chat_deleted");
    expect(AuditAction.SPACE_CREATED).toBe("space_created");
    expect(AuditAction.SPACE_DELETED).toBe("space_deleted");
    expect(AuditAction.TOOL_CREATED).toBe("tool_created");
    expect(AuditAction.TOOL_DELETED).toBe("tool_deleted");
  });

  test("should contain admin actions", () => {
    expect(AuditAction.PROVIDER_CONFIGURED).toBe("provider_configured");
    expect(AuditAction.SETTINGS_CHANGED).toBe("settings_changed");
    expect(AuditAction.GROUP_CREATED).toBe("group_created");
    expect(AuditAction.GROUP_DELETED).toBe("group_deleted");
    expect(AuditAction.PERMISSION_CHANGED).toBe("permission_changed");
  });

  test("should contain security actions", () => {
    expect(AuditAction.RATE_LIMIT_EXCEEDED).toBe("rate_limit_exceeded");
    expect(AuditAction.CSRF_BLOCKED).toBe("csrf_blocked");
    expect(AuditAction.SSRF_BLOCKED).toBe("ssrf_blocked");
    expect(AuditAction.UNAUTHORIZED_ACCESS).toBe("unauthorized_access");
    expect(AuditAction.SUSPICIOUS_ACTIVITY).toBe("suspicious_activity");
  });

  test("should contain system actions", () => {
    expect(AuditAction.SERVICE_STARTED).toBe("service_started");
    expect(AuditAction.SERVICE_STOPPED).toBe("service_stopped");
    expect(AuditAction.ERROR_OCCURRED).toBe("error_occurred");
  });
});

// ---------------------------------------------------------------------------

describe("audit()", () => {
  beforeEach(resetMockState);

  test("should write a JSONL entry to the daily log file", async () => {
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS, {
      username: "alice",
    });

    const entries = readWrittenEntries();
    expect(entries).toHaveLength(1);
  });

  test("should include all mandatory fields in the written entry", async () => {
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS, {
      username: "alice",
    });

    const [entry] = readWrittenEntries();
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("timestamp");
    expect(entry.category).toBe("auth");
    expect(entry.action).toBe("login_success");
    expect(entry).toHaveProperty("success");
  });

  test("should use the mocked generateId with 'audit' prefix", async () => {
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS);

    const [entry] = readWrittenEntries();
    expect(entry.id).toBe("audit_test_123");
  });

  test("should default success to true when not specified", async () => {
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS);

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(true);
  });

  test("should write success=false when explicitly set to false", async () => {
    await audit(AuditCategory.SECURITY, AuditAction.UNAUTHORIZED_ACCESS, {
      success: false,
    });

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(false);
  });

  test("should include optional fields when provided", async () => {
    await audit(AuditCategory.DATA_ACCESS, AuditAction.CHAT_ACCESSED, {
      userId: "u1",
      username: "alice",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      resourceType: "chat",
      resourceId: "chat-42",
      details: { extra: "info" },
      errorMessage: "something went wrong",
    });

    const [entry] = readWrittenEntries();
    expect(entry.userId).toBe("u1");
    expect(entry.username).toBe("alice");
    expect(entry.ipAddress).toBe("127.0.0.1");
    expect(entry.userAgent).toBe("Mozilla/5.0");
    expect(entry.resourceType).toBe("chat");
    expect(entry.resourceId).toBe("chat-42");
    expect(entry.details).toEqual({ extra: "info" });
    expect(entry.errorMessage).toBe("something went wrong");
  });

  test("should append multiple entries to the same file", async () => {
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS, { username: "alice" });
    await audit(AuditCategory.AUTH, AuditAction.LOGOUT, { userId: "u1" });

    const entries = readWrittenEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("login_success");
    expect(entries[1].action).toBe("logout");
  });

  test("should write to a filename based on today's date", async () => {
    await audit(AuditCategory.SYSTEM, AuditAction.SERVICE_STARTED);

    const expectedPath = todayLogPath();
    expect(mockState.files[expectedPath]).toBeDefined();
  });

  test("should include a valid ISO timestamp", async () => {
    const before = new Date().toISOString();
    await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS);
    const after = new Date().toISOString();

    const [entry] = readWrittenEntries();
    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
  });

  test("should call mkdir when the audit directory does not exist", async () => {
    // files is empty so existsSync(auditDir) returns false — mkdir must be called
    expect(mockState.mkdirCallCount).toBe(0);
    await audit(AuditCategory.SYSTEM, AuditAction.SERVICE_STARTED);
    expect(mockState.mkdirCallCount).toBeGreaterThanOrEqual(1);
  });

  test("should not call mkdir when the audit directory already exists", async () => {
    // Seed a sentinel key so existsSync(auditDir) returns true
    mockState.files[mockState.auditDir] = "";
    await audit(AuditCategory.SYSTEM, AuditAction.SERVICE_STARTED);
    expect(mockState.mkdirCallCount).toBe(0);
  });

  test("should pass the audit dir path to mkdir", async () => {
    await audit(AuditCategory.SYSTEM, AuditAction.SERVICE_STARTED);
    expect(mockState.mkdirPaths).toContain(mockState.auditDir);
  });

  test("should log to console when NODE_ENV is development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const captured: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => captured.push(args);

    try {
      await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS, {
        username: "dev-user",
      });
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalEnv;
    }

    expect(captured.length).toBeGreaterThan(0);
    const logLine = captured[0]!.join(" ");
    expect(logLine).toContain("[AuditLog]");
    expect(logLine).toContain("login_success");
  });

  test("should not log to console when NODE_ENV is not development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const captured: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => captured.push(args);

    try {
      await audit(AuditCategory.AUTH, AuditAction.LOGIN_SUCCESS, {
        username: "prod-user",
      });
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalEnv;
    }

    expect(captured.length).toBe(0);
  });

  test("should include username in console log when available", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const captured: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => captured.push(args);

    try {
      await audit(AuditCategory.AUTH, AuditAction.LOGOUT, { username: "logged-user" });
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalEnv;
    }

    const logLine = captured[0]!.join(" ");
    expect(logLine).toContain("logged-user");
  });

  test("should fall back to userId in console log when username is absent", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const captured: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => captured.push(args);

    try {
      await audit(AuditCategory.AUTH, AuditAction.LOGOUT, { userId: "uid-fallback" });
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalEnv;
    }

    const logLine = captured[0]!.join(" ");
    expect(logLine).toContain("uid-fallback");
  });
});

// ---------------------------------------------------------------------------

describe("auditLogin()", () => {
  beforeEach(resetMockState);

  test("should write an auth/login_success entry on success=true", async () => {
    await auditLogin(true, "alice", "1.2.3.4", "TestAgent/1.0");

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("auth");
    expect(entry.action).toBe("login_success");
    expect(entry.success).toBe(true);
  });

  test("should write an auth/login_failed entry on success=false", async () => {
    await auditLogin(false, "alice", "1.2.3.4", "TestAgent/1.0", "wrong password");

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("auth");
    expect(entry.action).toBe("login_failed");
    expect(entry.success).toBe(false);
  });

  test("should persist the username in the entry", async () => {
    await auditLogin(true, "bob");

    const [entry] = readWrittenEntries();
    expect(entry.username).toBe("bob");
  });

  test("should include ipAddress when provided", async () => {
    await auditLogin(true, "alice", "192.168.1.1");

    const [entry] = readWrittenEntries();
    expect(entry.ipAddress).toBe("192.168.1.1");
  });

  test("should include userAgent when provided", async () => {
    await auditLogin(true, "alice", undefined, "Firefox/120");

    const [entry] = readWrittenEntries();
    expect(entry.userAgent).toBe("Firefox/120");
  });

  test("should include errorMessage on failed login", async () => {
    await auditLogin(false, "eve", "10.0.0.1", undefined, "account locked");

    const [entry] = readWrittenEntries();
    expect(entry.errorMessage).toBe("account locked");
  });

  test("should not include errorMessage when not provided", async () => {
    await auditLogin(true, "alice");

    const [entry] = readWrittenEntries();
    // errorMessage may be undefined or absent — either way it should not be "something"
    expect(entry.errorMessage).toBeUndefined();
  });

  test("should not set userId on a login entry (only username is used)", async () => {
    await auditLogin(true, "alice");

    const [entry] = readWrittenEntries();
    // auditLogin passes username but not userId
    expect(entry.userId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("auditLogout()", () => {
  beforeEach(resetMockState);

  test("should write an auth/logout entry", async () => {
    await auditLogout("u1", "alice", "1.2.3.4");

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("auth");
    expect(entry.action).toBe("logout");
  });

  test("should include the userId", async () => {
    await auditLogout("u42", "alice");

    const [entry] = readWrittenEntries();
    expect(entry.userId).toBe("u42");
  });

  test("should include the username when provided", async () => {
    await auditLogout("u1", "charlie");

    const [entry] = readWrittenEntries();
    expect(entry.username).toBe("charlie");
  });

  test("should include ipAddress when provided", async () => {
    await auditLogout("u1", "alice", "10.0.0.2");

    const [entry] = readWrittenEntries();
    expect(entry.ipAddress).toBe("10.0.0.2");
  });

  test("should default success to true", async () => {
    await auditLogout("u1");

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(true);
  });

  test("should work when username is not provided", async () => {
    await auditLogout("u-no-name");

    const [entry] = readWrittenEntries();
    expect(entry.userId).toBe("u-no-name");
    expect(entry.username).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("auditUserAction()", () => {
  beforeEach(resetMockState);

  test("should write a user_management category entry", async () => {
    await auditUserAction(
      AuditAction.USER_CREATED,
      { userId: "admin-1", username: "admin" },
      "new-user-id"
    );

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("user_management");
  });

  test("should record the performedBy userId", async () => {
    await auditUserAction(
      AuditAction.USER_DELETED,
      { userId: "admin-1", username: "admin" },
      "target-user-id"
    );

    const [entry] = readWrittenEntries();
    expect(entry.userId).toBe("admin-1");
  });

  test("should record the performedBy username", async () => {
    await auditUserAction(
      AuditAction.USER_UPDATED,
      { userId: "admin-1", username: "superadmin" },
      "target-user-id"
    );

    const [entry] = readWrittenEntries();
    expect(entry.username).toBe("superadmin");
  });

  test("should set resourceType to 'user'", async () => {
    await auditUserAction(
      AuditAction.PASSWORD_CHANGED,
      { userId: "admin-1" },
      "target-user-id"
    );

    const [entry] = readWrittenEntries();
    expect(entry.resourceType).toBe("user");
  });

  test("should set resourceId to the target user ID", async () => {
    await auditUserAction(
      AuditAction.USER_CREATED,
      { userId: "admin-1" },
      "target-abc"
    );

    const [entry] = readWrittenEntries();
    expect(entry.resourceId).toBe("target-abc");
  });

  test("should include optional details when provided", async () => {
    await auditUserAction(
      AuditAction.USER_UPDATED,
      { userId: "admin-1" },
      "target-id",
      { changedFields: ["email"] }
    );

    const [entry] = readWrittenEntries();
    expect(entry.details).toEqual({ changedFields: ["email"] });
  });

  test("should default success to true", async () => {
    await auditUserAction(
      AuditAction.USER_CREATED,
      { userId: "admin-1" },
      "new-user"
    );

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(true);
  });

  test("should work with password_reset action", async () => {
    await auditUserAction(
      AuditAction.PASSWORD_RESET,
      { userId: "admin-2", username: "admin2" },
      "reset-target-id"
    );

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("password_reset");
    expect(entry.category).toBe("user_management");
  });
});

// ---------------------------------------------------------------------------

describe("auditSecurityEvent()", () => {
  beforeEach(resetMockState);

  test("should write a security category entry", async () => {
    await auditSecurityEvent(AuditAction.UNAUTHORIZED_ACCESS, "5.6.7.8");

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("security");
  });

  test("should always write success=false", async () => {
    await auditSecurityEvent(AuditAction.CSRF_BLOCKED);

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(false);
  });

  test("should record the given action", async () => {
    await auditSecurityEvent(AuditAction.RATE_LIMIT_EXCEEDED);

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("rate_limit_exceeded");
  });

  test("should include ipAddress when provided", async () => {
    await auditSecurityEvent(AuditAction.SSRF_BLOCKED, "203.0.113.5");

    const [entry] = readWrittenEntries();
    expect(entry.ipAddress).toBe("203.0.113.5");
  });

  test("should include details when provided", async () => {
    await auditSecurityEvent(AuditAction.SUSPICIOUS_ACTIVITY, undefined, {
      reason: "too many requests",
    });

    const [entry] = readWrittenEntries();
    expect(entry.details).toEqual({ reason: "too many requests" });
  });

  test("should not include details when not provided", async () => {
    await auditSecurityEvent(AuditAction.UNAUTHORIZED_ACCESS);

    const [entry] = readWrittenEntries();
    expect(entry.details).toBeUndefined();
  });

  test("should work without ipAddress and details", async () => {
    await auditSecurityEvent(AuditAction.CSRF_BLOCKED);

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("security");
    expect(entry.success).toBe(false);
    expect(entry.ipAddress).toBeUndefined();
  });

  test("should record suspicious_activity action", async () => {
    await auditSecurityEvent(AuditAction.SUSPICIOUS_ACTIVITY, "1.2.3.4");

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("suspicious_activity");
  });
});

// ---------------------------------------------------------------------------

describe("auditDataAccess()", () => {
  beforeEach(resetMockState);

  test("should write a data_access category entry", async () => {
    await auditDataAccess("u1", "chat", "chat-99");

    const [entry] = readWrittenEntries();
    expect(entry.category).toBe("data_access");
  });

  test("should default action to chat_accessed", async () => {
    await auditDataAccess("u1", "chat", "chat-99");

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("chat_accessed");
  });

  test("should accept an explicit action parameter", async () => {
    await auditDataAccess("u1", "knowledge", "kb-1", AuditAction.KNOWLEDGE_ACCESSED);

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("knowledge_accessed");
  });

  test("should record the userId", async () => {
    await auditDataAccess("user-xyz", "chat", "chat-1");

    const [entry] = readWrittenEntries();
    expect(entry.userId).toBe("user-xyz");
  });

  test("should set resourceType", async () => {
    await auditDataAccess("u1", "connection", "conn-5");

    const [entry] = readWrittenEntries();
    expect(entry.resourceType).toBe("connection");
  });

  test("should set resourceId", async () => {
    await auditDataAccess("u1", "chat", "chat-42");

    const [entry] = readWrittenEntries();
    expect(entry.resourceId).toBe("chat-42");
  });

  test("should default success to true", async () => {
    await auditDataAccess("u1", "chat", "chat-1");

    const [entry] = readWrittenEntries();
    expect(entry.success).toBe(true);
  });

  test("should accept connection_accessed action", async () => {
    await auditDataAccess("u2", "connection", "conn-1", AuditAction.CONNECTION_ACCESSED);

    const [entry] = readWrittenEntries();
    expect(entry.action).toBe("connection_accessed");
    expect(entry.resourceType).toBe("connection");
  });
});

// ---------------------------------------------------------------------------

describe("getAuditLogs()", () => {
  beforeEach(resetMockState);

  test("should return an empty array when no log files exist", async () => {
    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result).toEqual([]);
  });

  test("should parse JSONL entries from a single day file", async () => {
    const entry1 = {
      id: "a1",
      timestamp: "2026-02-01T10:00:00.000Z",
      category: "auth",
      action: "login_success",
      userId: "u1",
      success: true,
    };
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      JSON.stringify(entry1) + "\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a1");
    expect(result[0]!.action).toBe("login_success");
  });

  test("should return entries from multiple days within the range", async () => {
    const entry1 = {
      id: "a1",
      timestamp: "2026-02-01T10:00:00.000Z",
      category: "auth",
      action: "login_success",
      userId: "u1",
      success: true,
    };
    const entry2 = {
      id: "a2",
      timestamp: "2026-02-02T10:00:00.000Z",
      category: "security",
      action: "unauthorized_access",
      userId: "u2",
      success: false,
    };
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      JSON.stringify(entry1) + "\n";
    mockState.files[`${mockState.auditDir}/audit_2026-02-02.jsonl`] =
      JSON.stringify(entry2) + "\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-02");
    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.id);
    expect(ids).toContain("a1");
    expect(ids).toContain("a2");
  });

  test("should silently skip days where no file exists", async () => {
    mockState.files[`${mockState.auditDir}/audit_2026-02-03.jsonl`] =
      JSON.stringify({ id: "a3", timestamp: "2026-02-03T10:00:00.000Z", category: "auth", action: "logout", success: true }) + "\n";

    // 2026-02-01 and 2026-02-02 have no files
    const result = await getAuditLogs("2026-02-01", "2026-02-03");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a3");
  });

  test("should handle multiple entries in a single JSONL file", async () => {
    const e1 = { id: "e1", timestamp: "2026-02-01T08:00:00.000Z", category: "auth", action: "login_success", success: true };
    const e2 = { id: "e2", timestamp: "2026-02-01T09:00:00.000Z", category: "auth", action: "logout", success: true };
    const e3 = { id: "e3", timestamp: "2026-02-01T10:00:00.000Z", category: "security", action: "csrf_blocked", success: false };
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      [e1, e2, e3].map((e) => JSON.stringify(e)).join("\n") + "\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result).toHaveLength(3);
  });

  test("should skip malformed JSONL lines without throwing", async () => {
    const valid = JSON.stringify({ id: "ok", timestamp: "2026-02-01T10:00:00.000Z", category: "auth", action: "login_success", success: true });
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      valid + "\n" + "NOT_VALID_JSON\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("ok");
  });

  test("should return an empty array for an empty file", async () => {
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] = "";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result).toEqual([]);
  });

  test("should include today's entries when date range spans today", async () => {
    const today = todayStr();
    mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`] =
      JSON.stringify({ id: "today-1", timestamp: new Date().toISOString(), category: "auth", action: "login_success", success: true }) + "\n";

    const result = await getAuditLogs(today, today);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("today-1");
  });

  test("should preserve all entry fields when reading back", async () => {
    const entry = {
      id: "full-entry",
      timestamp: "2026-02-01T12:00:00.000Z",
      category: "data_access",
      action: "chat_accessed",
      userId: "u-full",
      username: "full-user",
      ipAddress: "10.0.0.1",
      userAgent: "Safari/17",
      resourceType: "chat",
      resourceId: "chat-full",
      details: { key: "value" },
      success: true,
      errorMessage: undefined,
    };
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      JSON.stringify(entry) + "\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result[0]!.userId).toBe("u-full");
    expect(result[0]!.username).toBe("full-user");
    expect(result[0]!.ipAddress).toBe("10.0.0.1");
    expect(result[0]!.resourceType).toBe("chat");
    expect(result[0]!.details).toEqual({ key: "value" });
  });

  test("should return entries in file order (chronological within a day)", async () => {
    const entries = [
      { id: "first", timestamp: "2026-02-01T08:00:00.000Z", category: "auth", action: "login_success", success: true },
      { id: "second", timestamp: "2026-02-01T09:00:00.000Z", category: "auth", action: "logout", success: true },
      { id: "third", timestamp: "2026-02-01T10:00:00.000Z", category: "security", action: "csrf_blocked", success: false },
    ];
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    const result = await getAuditLogs("2026-02-01", "2026-02-01");
    expect(result[0]!.id).toBe("first");
    expect(result[1]!.id).toBe("second");
    expect(result[2]!.id).toBe("third");
  });

  test("should return only the exact end date when range is a single day", async () => {
    // Entries for 2026-02-10 only, range is 2026-02-10 to 2026-02-10
    mockState.files[`${mockState.auditDir}/audit_2026-02-10.jsonl`] =
      JSON.stringify({ id: "single-day", timestamp: "2026-02-10T08:00:00.000Z", category: "auth", action: "login_success", success: true }) + "\n";
    mockState.files[`${mockState.auditDir}/audit_2026-02-09.jsonl`] =
      JSON.stringify({ id: "before-range", timestamp: "2026-02-09T08:00:00.000Z", category: "auth", action: "logout", success: true }) + "\n";

    const result = await getAuditLogs("2026-02-10", "2026-02-10");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("single-day");
  });
});

// ---------------------------------------------------------------------------

describe("searchAuditLogs()", () => {
  beforeEach(() => {
    resetMockState();

    // Pre-populate today's log with two entries of different category/user/success
    const today = todayStr();
    const entries = [
      {
        id: "a1",
        timestamp: new Date().toISOString(),
        category: "auth",
        action: "login_success",
        userId: "u1",
        success: true,
      },
      {
        id: "a2",
        timestamp: new Date().toISOString(),
        category: "security",
        action: "unauthorized_access",
        userId: "u2",
        success: false,
      },
    ];
    mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`] =
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  });

  test("should return all entries when no filters are specified", async () => {
    const result = await searchAuditLogs({});
    expect(result).toHaveLength(2);
  });

  test("should filter by userId", async () => {
    const result = await searchAuditLogs({ userId: "u1" });
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe("u1");
  });

  test("should return empty array when userId does not match any entry", async () => {
    const result = await searchAuditLogs({ userId: "u-nobody" });
    expect(result).toEqual([]);
  });

  test("should filter by action", async () => {
    const result = await searchAuditLogs({ action: AuditAction.LOGIN_SUCCESS });
    expect(result).toHaveLength(1);
    expect(result[0]!.action).toBe("login_success");
  });

  test("should filter by category", async () => {
    const result = await searchAuditLogs({ category: AuditCategory.SECURITY });
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe("security");
  });

  test("should filter by success=true", async () => {
    const result = await searchAuditLogs({ success: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.success).toBe(true);
  });

  test("should filter by success=false", async () => {
    const result = await searchAuditLogs({ success: false });
    expect(result).toHaveLength(1);
    expect(result[0]!.success).toBe(false);
  });

  test("should combine multiple filters (AND semantics)", async () => {
    const result = await searchAuditLogs({
      category: AuditCategory.AUTH,
      success: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a1");
  });

  test("should return empty array when combined filters match nothing", async () => {
    const result = await searchAuditLogs({
      category: AuditCategory.AUTH,
      success: false,
    });
    expect(result).toEqual([]);
  });

  test("should use a default date range of last 7 days when startDate is not specified", async () => {
    // The today file is populated in beforeEach; entries should be returned
    const result = await searchAuditLogs({});
    expect(result.length).toBeGreaterThan(0);
  });

  test("should respect an explicit startDate and endDate", async () => {
    const today = todayStr();
    const result = await searchAuditLogs({ startDate: today, endDate: today });
    expect(result).toHaveLength(2);
  });

  test("should return empty array when explicit date range has no files", async () => {
    // No file exists for the distant past
    const result = await searchAuditLogs({
      startDate: "2000-01-01",
      endDate: "2000-01-02",
    });
    expect(result).toEqual([]);
  });

  test("should filter by action=logout across multiple entries", async () => {
    const today = todayStr();
    // Add a third entry with LOGOUT action
    const existing = mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`]!;
    const logoutEntry = {
      id: "a3",
      timestamp: new Date().toISOString(),
      category: "auth",
      action: "logout",
      userId: "u1",
      success: true,
    };
    mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`] =
      existing + JSON.stringify(logoutEntry) + "\n";

    const result = await searchAuditLogs({ action: AuditAction.LOGOUT });
    expect(result).toHaveLength(1);
    expect(result[0]!.action).toBe("logout");
  });

  test("should return entries from multiple days when searching a wider range", async () => {
    const e = {
      id: "old-entry",
      timestamp: "2026-02-01T10:00:00.000Z",
      category: "auth",
      action: "login_success",
      userId: "u-old",
      success: true,
    };
    mockState.files[`${mockState.auditDir}/audit_2026-02-01.jsonl`] =
      JSON.stringify(e) + "\n";

    const result = await searchAuditLogs({
      startDate: "2026-02-01",
      endDate: todayStr(),
      userId: "u-old",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("old-entry");
  });

  test("should filter by category=data_access", async () => {
    const today = todayStr();
    const dataEntry = {
      id: "data-a1",
      timestamp: new Date().toISOString(),
      category: "data_access",
      action: "chat_accessed",
      userId: "u3",
      success: true,
    };
    const existing = mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`]!;
    mockState.files[`${mockState.auditDir}/audit_${today}.jsonl`] =
      existing + JSON.stringify(dataEntry) + "\n";

    const result = await searchAuditLogs({ category: AuditCategory.DATA_ACCESS });
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe("data_access");
  });
});
