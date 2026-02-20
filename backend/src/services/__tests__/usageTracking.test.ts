/**
 * Tests for UsageTrackingService (backend/src/services/usageTracking.ts)
 *
 * File system operations are mocked so no real I/O occurs.
 * All mocks must be registered BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  files: {} as Record<string, string>, // Simulated file system (path -> content)
  usageDir: "/tmp/test-usage",
  mkdirCalled: false,
  consoleLogCalls: [] as string[],
};

// ---------------------------------------------------------------------------
// Module mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string) => {
    mockState.files[path] = content;
  },
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${path}'`);
    err.code = "ENOENT";
    throw err;
  },
  mkdir: async () => {
    mockState.mkdirCalled = true;
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    // The usage dir itself is treated as existent only when at least one file
    // inside it has been written; this lets us test directory creation.
    if (path === mockState.usageDir) {
      return Object.keys(mockState.files).some(f => f.startsWith(mockState.usageDir + "/"));
    }
    return mockState.files[path] !== undefined;
  },
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

let idCounter = 0;
mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => `${prefix}_test_${++idCounter}`,
}));

mock.module("../../utils/paths", () => ({
  USAGE_DIR: mockState.usageDir,
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

const { usageTrackingService } = await import("../usageTracking");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal UsageEntry as a plain object (not typed to avoid import cycle) */
function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "u1",
    timestamp: "2026-02-10T10:00:00.000Z",
    userId: "alice",
    triggeringUserId: undefined,
    provider: "openai",
    model: "gpt-4",
    source: "chat",
    operation: undefined,
    resourceId: undefined,
    prompts: 1,
    ...overrides,
  };
}

/** Serialise an array of entry objects to JSONL content */
function toJsonl(entries: Record<string, unknown>[]): string {
  return entries.map(e => JSON.stringify(e)).join("\n");
}

/** Path of the monthly log file that the service uses for a given year/month */
function logFilePath(year: number, month: number): string {
  const monthStr = String(month).padStart(2, "0");
  return `${mockState.usageDir}/usage_${year}-${monthStr}.jsonl`;
}

/** Path of the current-month log file (mirrors the service's internal logic) */
function currentMonthFilePath(): string {
  const now = new Date();
  return logFilePath(now.getFullYear(), now.getMonth() + 1);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("UsageTrackingService", () => {
  // Reset mock file system before each test so tests are independent.
  beforeEach(() => {
    mockState.files = {};
    mockState.mkdirCalled = false;
    mockState.consoleLogCalls = [];
    idCounter = 0;
  });

  // -------------------------------------------------------------------------
  // track()
  // -------------------------------------------------------------------------

  describe("track()", () => {
    test("should write a JSONL entry to the current-month log file", async () => {
      await usageTrackingService.track(
        { userId: "alice", source: "chat" },
        "openai",
        "gpt-4"
      );

      const filePath = currentMonthFilePath();
      expect(mockState.files[filePath]).toBeDefined();

      const line = mockState.files[filePath]!.trim();
      const entry = JSON.parse(line);

      expect(entry.userId).toBe("alice");
      expect(entry.provider).toBe("openai");
      expect(entry.model).toBe("gpt-4");
      expect(entry.source).toBe("chat");
      expect(entry.prompts).toBe(1);
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.timestamp).toBe("string");
    });

    test("should append to an existing log file rather than overwriting it", async () => {
      const filePath = currentMonthFilePath();
      const existing = JSON.stringify(makeEntry({ id: "existing" })) + "\n";
      mockState.files[filePath] = existing;

      await usageTrackingService.track(
        { userId: "bob", source: "chat" },
        "anthropic",
        "claude-3"
      );

      const content = mockState.files[filePath]!;
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]!);
      const second = JSON.parse(lines[1]!);
      expect(first.id).toBe("existing");
      expect(second.userId).toBe("bob");
    });

    test("should store triggeringUserId when provided", async () => {
      await usageTrackingService.track(
        { triggeringUserId: "charlie", source: "delegation" },
        "openai",
        "gpt-4"
      );

      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.triggeringUserId).toBe("charlie");
    });

    test("should store operation and resourceId when provided", async () => {
      await usageTrackingService.track(
        { userId: "alice", source: "indexer", operation: "kb_index", resourceId: "col-1" },
        "openai",
        "gpt-4"
      );

      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.operation).toBe("kb_index");
      expect(entry.resourceId).toBe("col-1");
    });

    test("should set prompts to 1 for every call", async () => {
      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");
      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.prompts).toBe(1);
    });

    test("should generate an id with 'usage' prefix via generateId", async () => {
      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");
      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      // The mock generateId returns `${prefix}_test_${counter}`
      expect(entry.id).toMatch(/^usage_test_/);
    });

    test("should store a valid ISO 8601 timestamp", async () => {
      const before = new Date().toISOString();
      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");
      const after = new Date().toISOString();

      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());

      expect(entry.timestamp >= before).toBe(true);
      expect(entry.timestamp <= after).toBe(true);
    });

    test("should create the usage directory when it does not exist", async () => {
      // At this point no files exist so existsSync(usageDir) returns false
      expect(mockState.mkdirCalled).toBe(false);

      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");

      expect(mockState.mkdirCalled).toBe(true);
    });

    test("should not call mkdir when directory already exists", async () => {
      // Pre-populate a file so that the dir is considered to exist
      const filePath = currentMonthFilePath();
      mockState.files[filePath] = "";

      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");

      expect(mockState.mkdirCalled).toBe(false);
    });

    test("should log to console in development mode", async () => {
      const original = process.env.NODE_ENV;
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        process.env.NODE_ENV = "development";
        await usageTrackingService.track({ userId: "dev-user", source: "chat" }, "openai", "gpt-4");
        expect(logs.some(l => l.includes("dev-user") && l.includes("gpt-4"))).toBe(true);
      } finally {
        process.env.NODE_ENV = original;
        console.log = originalLog;
      }
    });

    test("should not log to console in non-development mode", async () => {
      const original = process.env.NODE_ENV;
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        process.env.NODE_ENV = "production";
        await usageTrackingService.track({ userId: "prod-user", source: "chat" }, "openai", "gpt-4");
        expect(logs.filter(l => l.includes("[UsageTracking]"))).toHaveLength(0);
      } finally {
        process.env.NODE_ENV = original;
        console.log = originalLog;
      }
    });

    test("should track delegation source correctly", async () => {
      await usageTrackingService.track(
        { userId: "alice", triggeringUserId: "agent-1", source: "delegation" },
        "anthropic",
        "claude-3"
      );
      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.source).toBe("delegation");
      expect(entry.userId).toBe("alice");
      expect(entry.triggeringUserId).toBe("agent-1");
    });

    test("should track indexer source with operation", async () => {
      await usageTrackingService.track(
        { source: "indexer", operation: "kb_index", resourceId: "kb-123" },
        "openai",
        "text-embedding-3"
      );
      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.source).toBe("indexer");
      expect(entry.operation).toBe("kb_index");
      expect(entry.resourceId).toBe("kb-123");
    });

    test("should track search source with smart_search operation", async () => {
      await usageTrackingService.track(
        { userId: "alice", source: "search", operation: "smart_search" },
        "openai",
        "gpt-4"
      );
      const filePath = currentMonthFilePath();
      const entry = JSON.parse(mockState.files[filePath]!.trim());
      expect(entry.source).toBe("search");
      expect(entry.operation).toBe("smart_search");
    });

    test("should write multiple entries as separate calls accumulate in the file", async () => {
      await usageTrackingService.track({ userId: "alice", source: "chat" }, "openai", "gpt-4");
      await usageTrackingService.track({ userId: "bob", source: "chat" }, "openai", "gpt-4");
      await usageTrackingService.track({ userId: "charlie", source: "delegation" }, "anthropic", "claude-3");

      const filePath = currentMonthFilePath();
      const lines = mockState.files[filePath]!.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // getUsageSummary()
  // -------------------------------------------------------------------------

  describe("getUsageSummary()", () => {
    test("should return zero totals and empty arrays when no entries exist", async () => {
      const summary = await usageTrackingService.getUsageSummary(
        "2026-02-01",
        "2026-02-28"
      );

      expect(summary.totalPrompts).toBe(0);
      expect(summary.activeUsers).toBe(0);
      expect(summary.topModel).toBeNull();
      expect(summary.byUser).toEqual([]);
      expect(summary.byModel).toEqual([]);
      expect(summary.bySource).toEqual([]);
    });

    test("should calculate total prompts correctly", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", model: "gpt-4", source: "chat", prompts: 1 }),
        makeEntry({ id: "u2", userId: "alice", model: "gpt-4", source: "chat", prompts: 1 }),
        makeEntry({ id: "u3", userId: "bob", model: "claude-3", source: "chat", prompts: 1 }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(3);
    });

    test("should count unique active users", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "alice" }),
        makeEntry({ id: "u3", userId: "bob" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.activeUsers).toBe(2);
    });

    test("should identify the top model correctly", async () => {
      const entries = [
        makeEntry({ id: "u1", model: "gpt-4" }),
        makeEntry({ id: "u2", model: "gpt-4" }),
        makeEntry({ id: "u3", model: "gpt-4" }),
        makeEntry({ id: "u4", model: "claude-3" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.topModel).not.toBeNull();
      expect(summary.topModel!.model).toBe("gpt-4");
      expect(summary.topModel!.count).toBe(3);
    });

    test("should calculate percentages for byUser, byModel, bySource", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", model: "gpt-4", source: "chat" }),
        makeEntry({ id: "u2", userId: "alice", model: "gpt-4", source: "chat" }),
        makeEntry({ id: "u3", userId: "bob", model: "gpt-4", source: "delegation" }),
        makeEntry({ id: "u4", userId: "bob", model: "claude-3", source: "delegation" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      const aliceEntry = summary.byUser.find(u => u.userId === "alice");
      expect(aliceEntry).toBeDefined();
      expect(aliceEntry!.prompts).toBe(2);
      expect(aliceEntry!.percentage).toBe(50);

      const chatSource = summary.bySource.find(s => s.source === "chat");
      expect(chatSource!.percentage).toBe(50);

      const gpt4 = summary.byModel.find(m => m.model === "gpt-4");
      expect(gpt4!.percentage).toBe(75);
    });

    test("should sort byUser descending by prompt count", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "bob" }),
        makeEntry({ id: "u3", userId: "bob" }),
        makeEntry({ id: "u4", userId: "bob" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.byUser[0]!.userId).toBe("bob");
      expect(summary.byUser[1]!.userId).toBe("alice");
    });

    test("should sort byModel descending by prompt count", async () => {
      const entries = [
        makeEntry({ id: "u1", model: "alpha" }),
        makeEntry({ id: "u2", model: "beta" }),
        makeEntry({ id: "u3", model: "beta" }),
        makeEntry({ id: "u4", model: "gamma" }),
        makeEntry({ id: "u5", model: "gamma" }),
        makeEntry({ id: "u6", model: "gamma" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.byModel[0]!.model).toBe("gamma");
      expect(summary.byModel[1]!.model).toBe("beta");
      expect(summary.byModel[2]!.model).toBe("alpha");
    });

    test("should sort bySource descending by prompt count", async () => {
      const entries = [
        makeEntry({ id: "u1", source: "search" }),
        makeEntry({ id: "u2", source: "chat" }),
        makeEntry({ id: "u3", source: "chat" }),
        makeEntry({ id: "u4", source: "chat" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.bySource[0]!.source).toBe("chat");
      expect(summary.bySource[1]!.source).toBe("search");
    });

    test("should filter entries by the supplied date range", async () => {
      // Entry inside the range
      const inside = makeEntry({
        id: "u1",
        userId: "alice",
        timestamp: "2026-02-15T10:00:00.000Z",
      });
      // Entry outside the range (before start)
      const before = makeEntry({
        id: "u2",
        userId: "bob",
        timestamp: "2026-01-31T23:59:59.000Z",
      });
      mockState.files[logFilePath(2026, 2)] = toJsonl([inside]);
      mockState.files[logFilePath(2026, 1)] = toJsonl([before]);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(1);
      expect(summary.byUser[0]!.userId).toBe("alice");
    });

    test("should include the explicit startDate and endDate in the returned summary", async () => {
      const summary = await usageTrackingService.getUsageSummary("2026-01-01", "2026-01-31");

      expect(summary.startDate).toBe("2026-01-01");
      expect(summary.endDate).toBe("2026-01-31");
    });

    test("should return startDate and endDate as date-only strings when no args given", async () => {
      const summary = await usageTrackingService.getUsageSummary();

      // Both should be YYYY-MM-DD strings (no time component)
      expect(summary.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(summary.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("should use triggeringUserId as the user key when userId is absent", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: undefined, triggeringUserId: "agent-runner" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.activeUsers).toBe(1);
      expect(summary.byUser[0]!.userId).toBe("agent-runner");
    });

    test("should use 'system' as user key when both userId and triggeringUserId are absent", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: undefined, triggeringUserId: undefined }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.byUser[0]!.userId).toBe("system");
    });

    test("should skip malformed JSONL lines without throwing", async () => {
      const content =
        JSON.stringify(makeEntry({ id: "u1" })) + "\n" +
        "NOT_VALID_JSON\n" +
        JSON.stringify(makeEntry({ id: "u2" })) + "\n";
      mockState.files[logFilePath(2026, 2)] = content;

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(2);
    });

    test("should read entries spanning multiple months", async () => {
      mockState.files[logFilePath(2026, 1)] = toJsonl([
        makeEntry({ id: "jan", userId: "alice", timestamp: "2026-01-15T10:00:00.000Z" }),
      ]);
      mockState.files[logFilePath(2026, 2)] = toJsonl([
        makeEntry({ id: "feb", userId: "bob", timestamp: "2026-02-10T10:00:00.000Z" }),
      ]);

      const summary = await usageTrackingService.getUsageSummary("2026-01-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(2);
      expect(summary.activeUsers).toBe(2);
    });

    test("should handle a cross-year date range (December to January)", async () => {
      mockState.files[logFilePath(2025, 12)] = toJsonl([
        makeEntry({ id: "dec", userId: "alice", timestamp: "2025-12-20T10:00:00.000Z" }),
      ]);
      mockState.files[logFilePath(2026, 1)] = toJsonl([
        makeEntry({ id: "jan", userId: "bob", timestamp: "2026-01-10T10:00:00.000Z" }),
      ]);

      const summary = await usageTrackingService.getUsageSummary("2025-12-01", "2026-01-31");

      expect(summary.totalPrompts).toBe(2);
    });

    test("should return percentage 0 for all entries when totalPrompts is 0 (empty data)", async () => {
      // When there are no entries all arrays are empty, so no item has percentage.
      // This covers the Math.round(0 / 0) guard: percentage should be 0 for
      // items if they existed with 0-prompt entries (edge: prompts field = 0).
      const entries = [makeEntry({ id: "u1", prompts: 0, model: "gpt-4", userId: "alice", source: "chat" })];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      // totalPrompts = 0, so percentage guard (totalPrompts > 0) kicks in
      if (summary.byUser.length > 0) {
        expect(summary.byUser[0]!.percentage).toBe(0);
      }
      if (summary.byModel.length > 0) {
        expect(summary.byModel[0]!.percentage).toBe(0);
      }
      if (summary.bySource.length > 0) {
        expect(summary.bySource[0]!.percentage).toBe(0);
      }
    });

    test("should handle empty JSONL file without throwing", async () => {
      mockState.files[logFilePath(2026, 2)] = "";

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(0);
    });

    test("should handle whitespace-only JSONL file without throwing", async () => {
      mockState.files[logFilePath(2026, 2)] = "   \n   \n";

      const summary = await usageTrackingService.getUsageSummary("2026-02-01", "2026-02-28");

      expect(summary.totalPrompts).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getUserTotals()
  // -------------------------------------------------------------------------

  describe("getUserTotals()", () => {
    test("should return empty object when no entries exist", async () => {
      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");
      expect(totals).toEqual({});
    });

    test("should aggregate totalPrompts per user", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "alice" }),
        makeEntry({ id: "u3", userId: "bob" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]!.totalPrompts).toBe(2);
      expect(totals["bob"]!.totalPrompts).toBe(1);
    });

    test("should group model counts per user in byModel", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", model: "gpt-4" }),
        makeEntry({ id: "u2", userId: "alice", model: "gpt-4" }),
        makeEntry({ id: "u3", userId: "alice", model: "claude-3" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]!.byModel["gpt-4"]).toBe(2);
      expect(totals["alice"]!.byModel["claude-3"]).toBe(1);
    });

    test("should group source counts per user in bySource", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", source: "chat" }),
        makeEntry({ id: "u2", userId: "alice", source: "delegation" }),
        makeEntry({ id: "u3", userId: "alice", source: "chat" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]!.bySource["chat"]).toBe(2);
      expect(totals["alice"]!.bySource["delegation"]).toBe(1);
    });

    test("should track lastUsed as the most recent timestamp for a user", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", timestamp: "2026-02-05T08:00:00.000Z" }),
        makeEntry({ id: "u2", userId: "alice", timestamp: "2026-02-10T12:00:00.000Z" }),
        makeEntry({ id: "u3", userId: "alice", timestamp: "2026-02-03T06:00:00.000Z" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]!.lastUsed).toBe("2026-02-10T12:00:00.000Z");
    });

    test("should fall back to triggeringUserId when userId is absent", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: undefined, triggeringUserId: "agent-runner" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["agent-runner"]).toBeDefined();
      expect(totals["agent-runner"]!.totalPrompts).toBe(1);
    });

    test("should use 'system' as key when both userId and triggeringUserId are absent", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: undefined, triggeringUserId: undefined }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["system"]).toBeDefined();
      expect(totals["system"]!.totalPrompts).toBe(1);
    });

    test("should return separate totals for each distinct user", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "bob" }),
        makeEntry({ id: "u3", userId: "charlie" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(Object.keys(totals)).toHaveLength(3);
      expect(totals["alice"]).toBeDefined();
      expect(totals["bob"]).toBeDefined();
      expect(totals["charlie"]).toBeDefined();
    });

    test("should respect date range and exclude out-of-range entries", async () => {
      mockState.files[logFilePath(2026, 2)] = toJsonl([
        makeEntry({ id: "feb", userId: "alice", timestamp: "2026-02-10T10:00:00.000Z" }),
      ]);
      mockState.files[logFilePath(2026, 1)] = toJsonl([
        makeEntry({ id: "jan", userId: "bob", timestamp: "2026-01-10T10:00:00.000Z" }),
      ]);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]).toBeDefined();
      expect(totals["bob"]).toBeUndefined();
    });

    test("should initialise lastUsed from the first seen entry for a user", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", timestamp: "2026-02-10T10:00:00.000Z" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const totals = await usageTrackingService.getUserTotals("2026-02-01", "2026-02-28");

      expect(totals["alice"]!.lastUsed).toBe("2026-02-10T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // getUsageByUser()
  // -------------------------------------------------------------------------

  describe("getUsageByUser()", () => {
    test("should return only entries where userId matches", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "bob" }),
        makeEntry({ id: "u3", userId: "alice" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      expect(result).toHaveLength(2);
      expect(result.every(e => e.userId === "alice")).toBe(true);
    });

    test("should also return entries where triggeringUserId matches", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: undefined, triggeringUserId: "alice" }),
        makeEntry({ id: "u2", userId: "alice" }),
        makeEntry({ id: "u3", userId: "bob" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      expect(result).toHaveLength(2);
      const ids = result.map(e => e.id);
      expect(ids).toContain("u1");
      expect(ids).toContain("u2");
    });

    test("should return empty array when user has no matching entries", async () => {
      const entries = [makeEntry({ id: "u1", userId: "bob" })];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      expect(result).toEqual([]);
    });

    test("should respect the date range filter", async () => {
      mockState.files[logFilePath(2026, 2)] = toJsonl([
        makeEntry({ id: "feb", userId: "alice", timestamp: "2026-02-10T10:00:00.000Z" }),
      ]);
      mockState.files[logFilePath(2026, 1)] = toJsonl([
        makeEntry({ id: "jan", userId: "alice", timestamp: "2026-01-10T10:00:00.000Z" }),
      ]);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("feb");
    });

    test("should return an entry matched by userId even when triggeringUserId is set to a different value", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice", triggeringUserId: "other-agent" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("u1");
    });

    test("should not return the same entry twice when both userId and triggeringUserId match", async () => {
      // An entry where userId === triggeringUserId === targetUser should appear once.
      const entries = [
        makeEntry({ id: "u1", userId: "alice", triggeringUserId: "alice" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByUser("alice", "2026-02-01", "2026-02-28");

      // filter() with OR condition naturally returns each entry at most once
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getUsageByModel()
  // -------------------------------------------------------------------------

  describe("getUsageByModel()", () => {
    test("should return empty object when no entries exist", async () => {
      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");
      expect(result).toEqual({});
    });

    test("should aggregate prompt counts by model name", async () => {
      const entries = [
        makeEntry({ id: "u1", model: "gpt-4" }),
        makeEntry({ id: "u2", model: "gpt-4" }),
        makeEntry({ id: "u3", model: "claude-3" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");

      expect(result["gpt-4"]).toBe(2);
      expect(result["claude-3"]).toBe(1);
    });

    test("should accumulate prompts > 1 correctly (though service always writes 1)", async () => {
      const entries = [
        makeEntry({ id: "u1", model: "gpt-4", prompts: 3 }),
        makeEntry({ id: "u2", model: "gpt-4", prompts: 2 }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");

      expect(result["gpt-4"]).toBe(5);
    });

    test("should contain exactly one key per distinct model", async () => {
      const entries = [
        makeEntry({ id: "u1", model: "alpha" }),
        makeEntry({ id: "u2", model: "beta" }),
        makeEntry({ id: "u3", model: "gamma" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");

      expect(Object.keys(result)).toHaveLength(3);
    });

    test("should exclude entries outside the date range", async () => {
      mockState.files[logFilePath(2026, 2)] = toJsonl([
        makeEntry({ id: "in", model: "gpt-4", timestamp: "2026-02-15T10:00:00.000Z" }),
      ]);
      mockState.files[logFilePath(2026, 1)] = toJsonl([
        makeEntry({ id: "out", model: "claude-3", timestamp: "2026-01-10T10:00:00.000Z" }),
      ]);

      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");

      expect(result["gpt-4"]).toBe(1);
      expect(result["claude-3"]).toBeUndefined();
    });

    test("should return record with numeric values (not strings)", async () => {
      const entries = [makeEntry({ id: "u1", model: "gpt-4" })];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const result = await usageTrackingService.getUsageByModel("2026-02-01", "2026-02-28");

      expect(typeof result["gpt-4"]).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // exportAsCsv()
  // -------------------------------------------------------------------------

  describe("exportAsCsv()", () => {
    test("should return only the header row when there are no entries", async () => {
      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      expect(csv).toBe("Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts");
    });

    test("should include the correct semicolon-separated header columns", async () => {
      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const header = csv.split("\n")[0];
      expect(header).toBe("Timestamp;User;Provider;Model;Source;Operation;ResourceId;Prompts");
    });

    test("should produce one data row per entry", async () => {
      const entries = [
        makeEntry({ id: "u1", userId: "alice" }),
        makeEntry({ id: "u2", userId: "bob" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const lines = csv.split("\n");

      // Header + 2 data rows
      expect(lines).toHaveLength(3);
    });

    test("should use semicolons as field separators in data rows", async () => {
      const entries = [makeEntry({ id: "u1", userId: "alice" })];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const dataLine = csv.split("\n")[1]!;

      // 8 fields => 7 semicolons
      expect(dataLine.split(";")).toHaveLength(8);
    });

    test("should place the correct values in each column", async () => {
      const entry = makeEntry({
        id: "u1",
        timestamp: "2026-02-10T10:00:00.000Z",
        userId: "alice",
        provider: "openai",
        model: "gpt-4",
        source: "chat",
        operation: "kb_index",
        resourceId: "col-1",
        prompts: 1,
      });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      expect(fields[0]).toBe("2026-02-10T10:00:00.000Z"); // Timestamp
      expect(fields[1]).toBe("alice");                    // User
      expect(fields[2]).toBe("openai");                   // Provider
      expect(fields[3]).toBe("gpt-4");                    // Model
      expect(fields[4]).toBe("chat");                     // Source
      expect(fields[5]).toBe("kb_index");                 // Operation
      expect(fields[6]).toBe("col-1");                    // ResourceId
      expect(fields[7]).toBe("1");                        // Prompts
    });

    test("should use empty string for optional fields that are absent", async () => {
      const entry = makeEntry({
        id: "u1",
        operation: undefined,
        resourceId: undefined,
      });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      expect(fields[5]).toBe(""); // Operation
      expect(fields[6]).toBe(""); // ResourceId
    });

    test("should fall back to triggeringUserId in User column when userId is absent", async () => {
      const entry = makeEntry({ id: "u1", userId: undefined, triggeringUserId: "agent-runner" });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      expect(fields[1]).toBe("agent-runner");
    });

    test("should use 'system' in User column when both userId and triggeringUserId are absent", async () => {
      const entry = makeEntry({ id: "u1", userId: undefined, triggeringUserId: undefined });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      expect(fields[1]).toBe("system");
    });

    test("should use userId over triggeringUserId in User column when both are present", async () => {
      const entry = makeEntry({ id: "u1", userId: "direct-user", triggeringUserId: "trigger-user" });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      expect(fields[1]).toBe("direct-user");
    });

    test("should stringify the prompts field as a string in the CSV", async () => {
      const entry = makeEntry({ id: "u1", prompts: 1 });
      mockState.files[logFilePath(2026, 2)] = toJsonl([entry]);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const fields = csv.split("\n")[1]!.split(";");

      // The prompts column is the last (index 7)
      expect(fields[7]).toBe("1");
      expect(typeof fields[7]).toBe("string");
    });

    test("should produce rows in the order entries were written to the file", async () => {
      const entries = [
        makeEntry({ id: "first", userId: "alice", timestamp: "2026-02-10T08:00:00.000Z" }),
        makeEntry({ id: "second", userId: "bob", timestamp: "2026-02-10T09:00:00.000Z" }),
        makeEntry({ id: "third", userId: "charlie", timestamp: "2026-02-10T10:00:00.000Z" }),
      ];
      mockState.files[logFilePath(2026, 2)] = toJsonl(entries);

      const csv = await usageTrackingService.exportAsCsv("2026-02-01", "2026-02-28");
      const lines = csv.split("\n");

      expect(lines[1]!.split(";")[1]).toBe("alice");
      expect(lines[2]!.split(";")[1]).toBe("bob");
      expect(lines[3]!.split(";")[1]).toBe("charlie");
    });
  });
});
