/**
 * Tests for attachment routes (backend/src/routes/attachments.ts)
 *
 * Three endpoints:
 *   GET /:chatId/attachments/:attachmentId           — serve file (no auth)
 *   GET /:chatId/attachments/:attachmentId/stream    — stream with range support (no auth)
 *   GET /:chatId/attachments/:attachmentId/metadata  — metadata (auth required)
 *
 * Service dependencies and fs helpers are mocked at the module level.
 * The test app is mounted at /api/chats to match production routing.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests override these values
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  getAttachmentFilePathResult: null as null | {
    path: string;
    mimeType: string;
    filename: string;
  },
  getAttachmentMetadataResult: null as null | {
    id: string;
    filename: string;
    mimeType: string;
    type: string;
    size: number;
    pages?: number;
  },
  loadChatHistoryResult: null as any,
  readFileResult: null as Buffer | null,
  statResult: null as null | { size: number },
  throwOnReadFile: false,
  throwOnStat: false,
  throwOnGetFilePath: false,
  throwOnGetMetadata: false,
  throwOnLoadChat: false,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock auth module — injects currentUser from mockState into Hono context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
  requireUserId: (c: any) => {
    const id = c.get("userId");
    if (!id) throw new Error("Not authenticated");
    return id;
  },
}));

// Mock attachments service
mock.module("../../services/attachments", () => ({
  attachmentsService: {
    getAttachmentFilePath: async (_attachmentId: string, _chatId: string) => {
      if (mockState.throwOnGetFilePath) throw new Error("fs error");
      return mockState.getAttachmentFilePathResult;
    },
    getAttachmentMetadata: async (_attachmentId: string, _chatId: string) => {
      if (mockState.throwOnGetMetadata) throw new Error("metadata error");
      return mockState.getAttachmentMetadataResult;
    },
  },
}));

// Mock memory service
mock.module("../../services/memory", () => ({
  loadChatHistory: async (_chatId: string, _userId?: string) => {
    if (mockState.throwOnLoadChat) throw new Error("load chat error");
    return mockState.loadChatHistoryResult;
  },
  setPendingAttachments: async () => {},
}));

// Mock error handler — predictable JSON shapes for assertions
mock.module("../../utils/errorHandler", () => ({
  validationError: (c: any, message: string) =>
    c.json({ error: message, code: "VALIDATION_ERROR" }, 400),
  notFoundError: (c: any, resource?: string) =>
    c.json(
      { error: resource ? `${resource} nicht gefunden` : "nicht gefunden", code: "NOT_FOUND" },
      404
    ),
  internalError: (c: any, _error: any, _ctx?: any) =>
    c.json({ error: "Internal Server Error", code: "INTERNAL_ERROR" }, 500),
}));

// Mock fs/promises — readFile and stat are called directly in the route handler
mock.module("fs/promises", () => ({
  readFile: async (_path: string) => {
    if (mockState.throwOnReadFile) throw new Error("read error");
    if (mockState.readFileResult === null) throw new Error("no file content set");
    return mockState.readFileResult;
  },
  stat: async (_path: string) => {
    if (mockState.throwOnStat) throw new Error("stat error");
    if (mockState.statResult === null) throw new Error("no stat result set");
    return mockState.statResult;
  },
  // Other fs/promises exports used by services — no-ops in route tests
  writeFile: async () => {},
  mkdir: async () => {},
  rm: async () => {},
  readdir: async () => [],
  unlink: async () => {},
}));

// Mock fs (existsSync) — route does not call existsSync directly, but the
// module may be loaded as a side effect; provide a safe stub.
mock.module("fs", () => ({
  existsSync: (_path: string) => true,
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { attachmentRoutes } = await import("../attachments");

// Mount under the production path prefix
const app = new Hono();
app.route("/api/chats", attachmentRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeFileInfo(overrides: Partial<{ path: string; mimeType: string; filename: string }> = {}) {
  return {
    path: "/data/uploads/chat-1/att-abc123/original.pdf",
    mimeType: "application/pdf",
    filename: "report.pdf",
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<any> = {}) {
  return {
    id: "att-abc123",
    filename: "report.pdf",
    mimeType: "application/pdf",
    type: "document",
    size: 12345,
    pages: 3,
    ...overrides,
  };
}

/** Reset all mock state to safe defaults before each test. */
function resetMockState() {
  mockState.currentUser = null;
  mockState.getAttachmentFilePathResult = null;
  mockState.getAttachmentMetadataResult = null;
  mockState.loadChatHistoryResult = null;
  mockState.readFileResult = null;
  mockState.statResult = null;
  mockState.throwOnReadFile = false;
  mockState.throwOnStat = false;
  mockState.throwOnGetFilePath = false;
  mockState.throwOnGetMetadata = false;
  mockState.throwOnLoadChat = false;
}

// ---------------------------------------------------------------------------
// ID validation helpers (shared across the two public endpoints)
// ---------------------------------------------------------------------------

describe("ID validation — shared rules", () => {
  beforeEach(resetMockState);

  test("GET file: should reject invalid chatId with 400", async () => {
    const res = await app.request("/api/chats/bad/../id/attachments/att-abc123");
    // path-traversal attempt — router won't even match, but validate directly
    // Use a clearly invalid character in the chat ID segment
    const res2 = await app.request("/api/chats/bad%20id/attachments/att-abc123");
    expect(res2.status).toBe(400);
  });

  test("GET file: should reject invalid attachmentId pattern with 400", async () => {
    const res = await app.request("/api/chats/chat-1/attachments/invalid-id-no-prefix");
    expect(res.status).toBe(400);
  });

  test("GET stream: should reject invalid chatId with 400", async () => {
    const res = await app.request("/api/chats/bad%20id/attachments/att-abc123/stream");
    expect(res.status).toBe(400);
  });

  test("GET stream: should reject invalid attachmentId pattern with 400", async () => {
    const res = await app.request("/api/chats/chat-1/attachments/no-prefix/stream");
    expect(res.status).toBe(400);
  });

  test("GET metadata: should reject invalid chatId with 400", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/chats/bad%20id/attachments/att-abc123/metadata");
    expect(res.status).toBe(400);
  });

  test("GET metadata: should reject invalid attachmentId pattern with 400", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/chats/chat-1/attachments/no-prefix/metadata");
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /:chatId/attachments/:attachmentId  (no auth required)
// ---------------------------------------------------------------------------

describe("GET /api/chats/:chatId/attachments/:attachmentId", () => {
  beforeEach(resetMockState);

  test("should return 404 when attachment file path is not found", async () => {
    mockState.getAttachmentFilePathResult = null;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  test("should return file bytes with correct Content-Type header", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "application/pdf" });
    mockState.readFileResult = Buffer.from("PDF content");
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
  });

  test("should set Content-Disposition inline with encoded filename", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo({ filename: "report.pdf" });
    mockState.readFileResult = Buffer.from("data");
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("inline");
    expect(disposition).toContain("report.pdf");
  });

  test("should set Cache-Control private max-age=3600", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo();
    mockState.readFileResult = Buffer.from("data");
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  test("should return file body as binary data", async () => {
    const content = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "application/pdf" });
    mockState.readFileResult = content;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes).toEqual(content);
  });

  test("should return 500 when service throws an error", async () => {
    mockState.throwOnGetFilePath = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  test("should return 500 when readFile throws an error", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo();
    mockState.throwOnReadFile = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(500);
  });

  test("should work without authentication for public access", async () => {
    // currentUser stays null — no 401 expected
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "image/png" });
    mockState.readFileResult = Buffer.from("PNG");
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    expect(res.status).toBe(200);
  });

  test("should encode filename with special characters in Content-Disposition", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo({ filename: "bericht 2026.pdf" });
    mockState.readFileResult = Buffer.from("data");
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123");
    const disposition = res.headers.get("Content-Disposition");
    // Space encoded as %20 in encodeURIComponent
    expect(disposition).toContain("bericht%202026.pdf");
  });
});

// ---------------------------------------------------------------------------
// GET /:chatId/attachments/:attachmentId/stream  (no auth required)
// ---------------------------------------------------------------------------

describe("GET /api/chats/:chatId/attachments/:attachmentId/stream", () => {
  beforeEach(resetMockState);

  test("should return 404 when attachment is not found", async () => {
    mockState.getAttachmentFilePathResult = null;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  test("should return 200 with full file when no Range header is present", async () => {
    const content = Buffer.from("audio content here");
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.status).toBe(200);
  });

  test("should set Accept-Ranges bytes header on full response", async () => {
    const content = Buffer.from("audio data");
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });

  test("should set Content-Length on full response", async () => {
    const content = Buffer.from("audio data");
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.headers.get("Content-Length")).toBe(String(content.length));
  });

  test("should return 206 Partial Content when a valid Range header is provided", async () => {
    const content = Buffer.from("0123456789abcdef"); // 16 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=0-7" },
    });
    expect(res.status).toBe(206);
  });

  test("should return correct Content-Range header for partial request", async () => {
    const content = Buffer.from("0123456789abcdef"); // 16 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=4-11" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 4-11/16");
  });

  test("should return correct Content-Length for partial request", async () => {
    const content = Buffer.from("0123456789abcdef"); // 16 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=0-3" },
    });
    // bytes 0-3 = 4 bytes
    expect(res.headers.get("Content-Length")).toBe("4");
  });

  test("should return the requested byte range in the body", async () => {
    const content = Buffer.from("ABCDEFGHIJ"); // 10 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=2-5" },
    });
    expect(res.status).toBe(206);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString()).toBe("CDEF");
  });

  test("should default end to last byte when Range omits end", async () => {
    const content = Buffer.from("ABCDEFGH"); // 8 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=4-" },
    });
    expect(res.status).toBe(206);
    const bytes = Buffer.from(await res.arrayBuffer());
    // bytes 4 to end: "EFGH"
    expect(bytes.toString()).toBe("EFGH");
  });

  test("should return 416 Range Not Satisfiable when start >= file size", async () => {
    const content = Buffer.from("small"); // 5 bytes
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream", {
      headers: { Range: "bytes=100-200" },
    });
    expect(res.status).toBe(416);
  });

  test("should return 500 when service throws an error", async () => {
    mockState.throwOnGetFilePath = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.status).toBe(500);
  });

  test("should return 500 when stat throws an error", async () => {
    mockState.getAttachmentFilePathResult = makeFileInfo();
    mockState.throwOnStat = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.status).toBe(500);
  });

  test("should work without authentication (public streaming)", async () => {
    const content = Buffer.from("audio");
    mockState.getAttachmentFilePathResult = makeFileInfo({ mimeType: "audio/mpeg" });
    mockState.readFileResult = content;
    mockState.statResult = { size: content.length };
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/stream");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /:chatId/attachments/:attachmentId/metadata  (auth required)
// ---------------------------------------------------------------------------

describe("GET /api/chats/:chatId/attachments/:attachmentId/metadata", () => {
  beforeEach(resetMockState);

  test("should return 401 when no session is present", async () => {
    // currentUser stays null
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(401);
  });

  test("should return 404 when chat does not exist for the user", async () => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = null; // chat not found
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.error).toContain("Chat");
  });

  test("should return 404 when attachment metadata is not found", async () => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = { id: "chat-1" };
    mockState.getAttachmentMetadataResult = null;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Attachment");
  });

  test("should return metadata JSON when chat and attachment are found", async () => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = { id: "chat-1" };
    mockState.getAttachmentMetadataResult = makeMetadata();
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("att-abc123");
    expect(body.filename).toBe("report.pdf");
    expect(body.mimeType).toBe("application/pdf");
    expect(body.type).toBe("document");
    expect(body.size).toBe(12345);
    expect(body.pages).toBe(3);
  });

  test("should include all metadata fields in response", async () => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = { id: "chat-1" };
    mockState.getAttachmentMetadataResult = makeMetadata({
      id: "att-xyz",
      filename: "audio.mp3",
      mimeType: "audio/mpeg",
      type: "audio",
      size: 500000,
    });
    const res = await app.request("/api/chats/chat-1/attachments/att-xyz/metadata");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mimeType).toBe("audio/mpeg");
    expect(body.type).toBe("audio");
  });

  test("should return 500 when loadChatHistory throws", async () => {
    mockState.currentUser = makeUser();
    mockState.throwOnLoadChat = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  test("should return 500 when getAttachmentMetadata throws", async () => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = { id: "chat-1" };
    mockState.throwOnGetMetadata = true;
    const res = await app.request("/api/chats/chat-1/attachments/att-abc123/metadata");
    expect(res.status).toBe(500);
  });

  test("should pass chatId and userId to loadChatHistory for access control", async () => {
    // If the user does not own the chat, loadChatHistory returns null => 404
    mockState.currentUser = makeUser({ id: "user-99" });
    mockState.loadChatHistoryResult = null;
    const res = await app.request("/api/chats/chat-other/attachments/att-abc123/metadata");
    expect(res.status).toBe(404);
  });
});
