/**
 * Tests for chat API routes (backend/src/routes/chat.ts)
 *
 * Covers the non-streaming endpoints exported by chat.ts:
 *   - chatHistoryRoutes  → mounted at /api/chats
 *   - sharedChatRoutes   → mounted at /api/shared
 *
 * SSE streaming endpoints (POST /api/chat, GET /api/chat/:id/stream) are
 * intentionally skipped as they require special SSE handling.
 *
 * All dependencies are mocked so no file-system or network access occurs.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests override fields in beforeEach
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },

  // memory service
  listChatHistoriesResult: { chats: [] as any[], total: 0, hasMore: false } as any,
  loadChatHistoryResult: null as any,
  deleteChatHistoryResult: false,
  searchChatHistoriesResult: [] as any[],
  createShareLinkResult: { success: false, error: "Not found" } as any,
  revokeShareLinkResult: false,
  loadChatByShareTokenResult: null as any,
  getShareInfoResult: null as any,
  loadChatFoldersResult: [] as any[],
  createChatFolderResult: null as any,
  deleteChatFolderResult: false,
  updateChatFoldersResult: false,
  getChatFolderIdsResult: [] as string[],
  listChatsInFolderResult: [] as any[],
  getFolderChatCountsResult: {} as Record<string, number>,
  addChatMaterialResult: false,
  removeChatMaterialResult: false,
  updateChatMaterialsResult: false,
  regenerateAllMissingSummariesResult: { updated: 0, errors: [] as string[] },
};

// ---------------------------------------------------------------------------
// Module mocks — must be registered BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  optionalAuthMiddleware: async (c: any, next: any) => {
    if (mockState.currentUser) {
      c.set("user", mockState.currentUser);
      c.set("userId", mockState.currentUser.id);
    }
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
  getCurrentUser: (c: any) => c.get("user"),
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

mock.module("../../middleware/rateLimit", () => ({
  chatRateLimit: async (_c: any, next: any) => { await next(); },
  uploadRateLimit: async (_c: any, next: any) => { await next(); },
}));

mock.module("../../services/memory", () => ({
  generateSessionId: () => "session-test-123",
  saveConversation: async () => {},
  saveChatHistory: async () => {},
  listChatHistories: async (_limit: number, _offset: number, _userId?: string) =>
    mockState.listChatHistoriesResult,
  loadChatHistory: async (_id: string, _userId?: string) =>
    mockState.loadChatHistoryResult,
  deleteChatHistory: async (_id: string, _userId?: string) =>
    mockState.deleteChatHistoryResult,
  searchChatHistories: async (_query: string) =>
    mockState.searchChatHistoriesResult,
  regenerateChatSummary: async () => {},
  regenerateAllMissingSummaries: async () =>
    mockState.regenerateAllMissingSummariesResult,
  createShareLink: async (_chatId: string, _userId?: string) =>
    mockState.createShareLinkResult,
  revokeShareLink: async (_chatId: string, _userId?: string) =>
    mockState.revokeShareLinkResult,
  loadChatByShareToken: async (_token: string) =>
    mockState.loadChatByShareTokenResult,
  getShareInfo: async (_chatId: string, _userId?: string) =>
    mockState.getShareInfoResult,
  loadChatFolders: async (_userId?: string) =>
    mockState.loadChatFoldersResult,
  createChatFolder: async (_name: string, _userId?: string, _color?: string) =>
    mockState.createChatFolderResult,
  deleteChatFolder: async (_id: string, _userId?: string) =>
    mockState.deleteChatFolderResult,
  updateChatFolders: async (_chatId: string, _folderIds: string[], _userId?: string) =>
    mockState.updateChatFoldersResult,
  getChatFolderIds: async (_chatId: string, _userId?: string) =>
    mockState.getChatFolderIdsResult,
  listChatsInFolder: async (_folderId: string, _userId?: string) =>
    mockState.listChatsInFolderResult,
  getFolderChatCounts: async (_userId?: string) =>
    mockState.getFolderChatCountsResult,
  addChatMaterial: async (_chatId: string, _userId: string, _material: any) =>
    mockState.addChatMaterialResult,
  removeChatMaterial: async (_chatId: string, _userId: string, _materialId: string) =>
    mockState.removeChatMaterialResult,
  updateChatMaterials: async (_chatId: string, _userId: string, _materials: any[]) =>
    mockState.updateChatMaterialsResult,
}));

mock.module("../../services/agents", () => ({
  listAgents: async () => [],
  loadAgent: async () => null,
  createAgent: async () => null,
  updateAgent: async () => null,
  deleteAgent: async () => false,
}));

mock.module("../../agents/loop", () => ({
  runAgentLoop: async function* () {},
}));

mock.module("../../services/attachments", () => ({
  attachmentsService: {
    processUpload: async () => ({
      id: "att-1",
      filename: "test.txt",
      mimeType: "text/plain",
      type: "document",
      metadata: { size: 100 },
    }),
  },
}));

mock.module("../../services/documentFetcher", () => ({
  fetchAllDocuments: async () => [],
  buildReaderContextSection: () => "",
  prepareReaderContexts: async (_sessionId: string, _readers: any[], _userId?: string) => ({
    documents: [],
    sessionId: _sessionId,
  }),
  getCachedReaderContexts: (_sessionId: string) => null,
  clearCachedReaderContexts: (_sessionId: string) => {},
}));

mock.module("../../services/documentImporter", () => ({
  createCollection: async () => {},
  importAndIndex: async () => {},
}));

mock.module("../../services/documentGenerator", () => ({
  generateDocument: async () => Buffer.from(""),
  getMimeType: (_format: string) => "application/octet-stream",
  mapChatToDocument: () => ({}),
  createSafeFilename: (_title: string) => "export.docx",
}));

mock.module("../../skills", () => ({
  loadSkills: async () => [],
  getSkillById: async () => null,
  reloadSkills: async () => [],
  createSkill: async () => null,
  updateSkill: async () => null,
  deleteSkill: async () => false,
}));

mock.module("../../tools", () => ({
  toolRegistry: {
    getAll: () => [],
    get: () => null,
    getStats: () => ({ total: 0, enabled: 0, disabled: 0 }),
  },
  toolsConfig: {},
  loadCustomTools: async () => [],
  getCustomTool: async () => null,
  createCustomTool: async () => null,
  updateCustomTool: async () => null,
  deleteCustomTool: async () => false,
  registerCustomTool: async () => {},
  unregisterCustomTool: async () => {},
  testCustomTool: async () => ({}),
  CustomApiTool: class {},
}));

mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _err: any) => c.json({ error: "Internal server error" }, 500),
}));

mock.module("../../mcp", () => ({
  mcpManager: {
    getServers: async () => [],
    addServer: async () => ({}),
    getServer: async () => null,
    getServerTools: () => [],
    updateServer: async () => ({}),
    deleteServer: async () => {},
    connectServer: async () => {},
    disconnectServer: async () => {},
    refreshServer: async () => {},
    getAllTools: () => [],
  },
  getMcpPresets: () => [],
}));

mock.module("../../utils/paths", () => ({
  EXPORTS_DIR: "/tmp/exports",
  KB_BASE: "/tmp/kb",
  DATA_DIR: "/tmp/data",
}));

// ---------------------------------------------------------------------------
// Import routes AFTER all mocks are registered
// ---------------------------------------------------------------------------

const { chatHistoryRoutes, sharedChatRoutes } = await import("../chat");

// Mount routes on dedicated test apps
const chatsApp = new Hono();
chatsApp.route("/api/chats", chatHistoryRoutes);

const sharedApp = new Hono();
sharedApp.route("/api/shared", sharedChatRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeChat(overrides: Partial<any> = {}): any {
  return {
    id: "chat-1",
    title: "Test Chat",
    messages: [],
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T11:00:00.000Z",
    userId: "user-1",
    ...overrides,
  };
}

function makeFolder(overrides: Partial<any> = {}): any {
  return {
    id: "folder-1",
    name: "My Folder",
    userId: "user-1",
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Chat History Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
  });

  test("should return 401 for unauthenticated GET /api/chats", async () => {
    const res = await chatsApp.request("/api/chats");
    expect(res.status).toBe(401);
  });

  test("should return 401 for unauthenticated GET /api/chats/chat-1", async () => {
    const res = await chatsApp.request("/api/chats/chat-1");
    expect(res.status).toBe(401);
  });

  test("should return 401 for unauthenticated DELETE /api/chats/chat-1", async () => {
    const res = await chatsApp.request("/api/chats/chat-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("should return 401 for unauthenticated GET /api/chats/folders", async () => {
    const res = await chatsApp.request("/api/chats/folders");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats — list chat histories", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listChatHistoriesResult = { chats: [], total: 0, hasMore: false };
  });

  test("should return empty list when no chats exist", async () => {
    const res = await chatsApp.request("/api/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.hasMore).toBe(false);
  });

  test("should return chats list when chats exist", async () => {
    mockState.listChatHistoriesResult = {
      chats: [makeChat({ id: "chat-1" }), makeChat({ id: "chat-2" })],
      total: 2,
      hasMore: false,
    };
    const res = await chatsApp.request("/api/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  test("should pass limit and offset query params through", async () => {
    mockState.listChatHistoriesResult = { chats: [], total: 5, hasMore: true };
    const res = await chatsApp.request("/api/chats?limit=10&offset=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasMore).toBe(true);
  });

  test("should use default limit 50 when not specified", async () => {
    const res = await chatsApp.request("/api/chats");
    expect(res.status).toBe(200);
  });

  test("should handle invalid limit gracefully (fallback to default)", async () => {
    const res = await chatsApp.request("/api/chats?limit=abc");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/:id — load specific chat", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = null;
  });

  test("should return 404 when chat does not exist", async () => {
    const res = await chatsApp.request("/api/chats/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return chat data when chat exists", async () => {
    mockState.loadChatHistoryResult = makeChat({ id: "chat-1", title: "Hello World" });
    const res = await chatsApp.request("/api/chats/chat-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("chat-1");
    expect(body.title).toBe("Hello World");
  });

  test("should return messages array on chat response", async () => {
    mockState.loadChatHistoryResult = makeChat({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });
    const res = await chatsApp.request("/api/chats/chat-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/chats/:id — delete chat", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.deleteChatHistoryResult = false;
  });

  test("should return 404 when chat does not exist", async () => {
    mockState.deleteChatHistoryResult = false;
    const res = await chatsApp.request("/api/chats/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 200 with success:true when chat is deleted", async () => {
    mockState.deleteChatHistoryResult = true;
    const res = await chatsApp.request("/api/chats/chat-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/search — search chats", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.searchChatHistoriesResult = [];
  });

  test("should return empty results for empty query", async () => {
    const res = await chatsApp.request("/api/chats/search?q=");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  test("should return empty results when query is shorter than 2 characters", async () => {
    const res = await chatsApp.request("/api/chats/search?q=a");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.message).toContain("2 characters");
  });

  test("should return search results for valid query", async () => {
    mockState.searchChatHistoriesResult = [makeChat({ id: "chat-1", title: "Hello World" })];
    const res = await chatsApp.request("/api/chats/search?q=Hello");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Hello World");
  });

  test("should return empty results when no matches found", async () => {
    mockState.searchChatHistoriesResult = [];
    const res = await chatsApp.request("/api/chats/search?q=xyznotfound");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/chats/:id/share — create share link", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.createShareLinkResult = { success: false, error: "Chat not found" };
  });

  test("should return 404 when chat is not found", async () => {
    mockState.createShareLinkResult = { success: false, error: "Chat not found" };
    const res = await chatsApp.request("/api/chats/nonexistent/share", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 403 when access is denied", async () => {
    mockState.createShareLinkResult = { success: false, error: "Access denied" };
    const res = await chatsApp.request("/api/chats/chat-1/share", { method: "POST" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Access denied");
  });

  test("should return shareToken and shareUrl on success", async () => {
    mockState.createShareLinkResult = {
      success: true,
      shareToken: "abc123",
      shareUrl: "/shared/abc123",
    };
    const res = await chatsApp.request("/api/chats/chat-1/share", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.shareToken).toBe("abc123");
    expect(body.shareUrl).toBe("/shared/abc123");
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/chats/:id/share — revoke share link", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.revokeShareLinkResult = false;
  });

  test("should return 404 when chat is not found or access denied", async () => {
    mockState.revokeShareLinkResult = false;
    const res = await chatsApp.request("/api/chats/nonexistent/share", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return success:true when share is revoked", async () => {
    mockState.revokeShareLinkResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/share", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/:id/share — get share info", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getShareInfoResult = null;
  });

  test("should return shared:false when chat is not shared", async () => {
    mockState.getShareInfoResult = null;
    const res = await chatsApp.request("/api/chats/chat-1/share");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shared).toBe(false);
  });

  test("should return share details when chat is shared", async () => {
    mockState.getShareInfoResult = {
      shareToken: "tok-xyz",
      sharedAt: "2026-02-01T10:00:00.000Z",
    };
    const res = await chatsApp.request("/api/chats/chat-1/share");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shared).toBe(true);
    expect(body.shareToken).toBe("tok-xyz");
    expect(body.shareUrl).toBe("/shared/tok-xyz");
    expect(body.sharedAt).toBe("2026-02-01T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/shared/:token — load shared chat (public)", () => {
  beforeEach(() => {
    // No auth required for shared routes
    mockState.currentUser = null;
    mockState.loadChatByShareTokenResult = null;
  });

  test("should return 404 when token is invalid", async () => {
    mockState.loadChatByShareTokenResult = null;
    const res = await sharedApp.request("/api/shared/invalid-token");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return chat data for valid share token", async () => {
    mockState.loadChatByShareTokenResult = makeChat({ id: "chat-1", title: "Shared Chat" });
    const res = await sharedApp.request("/api/shared/valid-token-abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("chat-1");
    expect(body.title).toBe("Shared Chat");
  });

  test("should be publicly accessible without authentication", async () => {
    mockState.currentUser = null;
    mockState.loadChatByShareTokenResult = makeChat({ id: "chat-1" });
    const res = await sharedApp.request("/api/shared/some-token");
    // Should NOT return 401 even without a logged-in user
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/chats/:id/materials — update all materials", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.updateChatMaterialsResult = false;
  });

  test("should return 400 when materials is not an array", async () => {
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials: "not-an-array" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("array");
  });

  test("should return 404 when chat is not found or access denied", async () => {
    mockState.updateChatMaterialsResult = false;
    const res = await chatsApp.request("/api/chats/nonexistent/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials: [] }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return success with materials when update succeeds", async () => {
    mockState.updateChatMaterialsResult = true;
    const materials = [
      { id: "mat-1", type: "user_marked", title: "Note", content: "Some content" },
    ];
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.materials).toEqual(materials);
  });

  test("should accept empty materials array", async () => {
    mockState.updateChatMaterialsResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.materials).toEqual([]);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials: [] }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/chats/:id/materials — add a material", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.addChatMaterialResult = false;
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Note", content: "content" }),
    });
    expect(res.status).toBe(401);
  });

  test("should return 404 when chat is not found or access denied", async () => {
    mockState.addChatMaterialResult = false;
    const res = await chatsApp.request("/api/chats/nonexistent/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Note", content: "content" }),
    });
    expect(res.status).toBe(404);
  });

  test("should return success with material when added", async () => {
    mockState.addChatMaterialResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "mat-1", title: "My Note", content: "text" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.material).toHaveProperty("title", "My Note");
    expect(body.material).toHaveProperty("content", "text");
  });

  test("should generate a material id when none is provided", async () => {
    mockState.addChatMaterialResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Auto ID", content: "data" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.material.id).toBe("string");
    expect(body.material.id.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/chats/:id/materials/:materialId — remove a material", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.removeChatMaterialResult = false;
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/chat-1/materials/mat-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("should return 404 when chat or material is not found", async () => {
    mockState.removeChatMaterialResult = false;
    const res = await chatsApp.request("/api/chats/chat-1/materials/mat-99", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("should return success:true when material is removed", async () => {
    mockState.removeChatMaterialResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/materials/mat-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/folders — list folders", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadChatFoldersResult = [];
    mockState.getFolderChatCountsResult = {};
  });

  test("should return empty folders list when none exist", async () => {
    const res = await chatsApp.request("/api/chats/folders");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folders).toEqual([]);
  });

  test("should include chatCount for each folder", async () => {
    mockState.loadChatFoldersResult = [
      makeFolder({ id: "folder-1", name: "Work" }),
      makeFolder({ id: "folder-2", name: "Personal" }),
    ];
    mockState.getFolderChatCountsResult = { "folder-1": 3, "folder-2": 7 };

    const res = await chatsApp.request("/api/chats/folders");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folders).toHaveLength(2);
    const work = body.folders.find((f: any) => f.id === "folder-1");
    const personal = body.folders.find((f: any) => f.id === "folder-2");
    expect(work.chatCount).toBe(3);
    expect(personal.chatCount).toBe(7);
  });

  test("should default chatCount to 0 when folder has no chats", async () => {
    mockState.loadChatFoldersResult = [makeFolder({ id: "folder-1" })];
    mockState.getFolderChatCountsResult = {};

    const res = await chatsApp.request("/api/chats/folders");
    const body = await res.json();
    expect(body.folders[0].chatCount).toBe(0);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/folders");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/chats/folders — create folder", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.createChatFolderResult = makeFolder({ id: "folder-new", name: "My Folder" });
  });

  test("should return 400 when name is missing", async () => {
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name");
  });

  test("should return 400 when name is empty string", async () => {
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name");
  });

  test("should return 400 when name is not a string", async () => {
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 42 }),
    });
    expect(res.status).toBe(400);
  });

  test("should return 201 with folder data on success", async () => {
    mockState.createChatFolderResult = makeFolder({ id: "folder-new", name: "My Folder" });
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Folder" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("folder-new");
    expect(body.name).toBe("My Folder");
  });

  test("should accept optional color parameter", async () => {
    mockState.createChatFolderResult = makeFolder({ id: "folder-colored", name: "Blue", color: "#0000ff" });
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blue", color: "#0000ff" }),
    });
    expect(res.status).toBe(201);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/chats/folders/:id — delete folder", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.deleteChatFolderResult = false;
  });

  test("should return 404 when folder does not exist or access denied", async () => {
    mockState.deleteChatFolderResult = false;
    const res = await chatsApp.request("/api/chats/folders/folder-99", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return success:true when folder is deleted", async () => {
    mockState.deleteChatFolderResult = true;
    const res = await chatsApp.request("/api/chats/folders/folder-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/folders/folder-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/folders/:id/chats — list chats in folder", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listChatsInFolderResult = [];
  });

  test("should return empty list when folder has no chats", async () => {
    const res = await chatsApp.request("/api/chats/folders/folder-1/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toEqual([]);
  });

  test("should return chats when folder has chats", async () => {
    mockState.listChatsInFolderResult = [
      makeChat({ id: "chat-1" }),
      makeChat({ id: "chat-2" }),
    ];
    const res = await chatsApp.request("/api/chats/folders/folder-1/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toHaveLength(2);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/folders/folder-1/chats");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/chats/:id/folders — update folder assignments", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.updateChatFoldersResult = false;
  });

  test("should return 400 when folderIds is not an array", async () => {
    const res = await chatsApp.request("/api/chats/chat-1/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: "not-array" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("array");
  });

  test("should return 404 when chat not found or access denied", async () => {
    mockState.updateChatFoldersResult = false;
    const res = await chatsApp.request("/api/chats/nonexistent/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: ["folder-1"] }),
    });
    expect(res.status).toBe(404);
  });

  test("should return success with folderIds when update succeeds", async () => {
    mockState.updateChatFoldersResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: ["folder-1", "folder-2"] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.folderIds).toEqual(["folder-1", "folder-2"]);
  });

  test("should accept empty folderIds array to remove from all folders", async () => {
    mockState.updateChatFoldersResult = true;
    const res = await chatsApp.request("/api/chats/chat-1/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folderIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/:id/folders — get folder IDs for a chat", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getChatFolderIdsResult = [];
  });

  test("should return empty folderIds when chat is in no folders", async () => {
    const res = await chatsApp.request("/api/chats/chat-1/folders");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folderIds).toEqual([]);
  });

  test("should return folder IDs when chat belongs to folders", async () => {
    mockState.getChatFolderIdsResult = ["folder-1", "folder-2"];
    const res = await chatsApp.request("/api/chats/chat-1/folders");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folderIds).toEqual(["folder-1", "folder-2"]);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/chats/regenerate-all-summaries", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.regenerateAllMissingSummariesResult = { updated: 0, errors: [] };
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await chatsApp.request("/api/chats/regenerate-all-summaries", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("should return success with updated count", async () => {
    mockState.regenerateAllMissingSummariesResult = { updated: 5, errors: [] };
    const res = await chatsApp.request("/api/chats/regenerate-all-summaries", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(5);
    expect(body.errors).toEqual([]);
  });

  test("should report errors when some summaries fail", async () => {
    mockState.regenerateAllMissingSummariesResult = {
      updated: 2,
      errors: ["chat-a: LLM error", "chat-b: timeout"],
    };
    const res = await chatsApp.request("/api/chats/regenerate-all-summaries", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/chats/:id/download — download chat as markdown", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadChatHistoryResult = null;
  });

  test("should return 404 when chat does not exist", async () => {
    const res = await chatsApp.request("/api/chats/nonexistent/download");
    expect(res.status).toBe(404);
  });

  test("should return markdown with Content-Disposition attachment header", async () => {
    mockState.loadChatHistoryResult = makeChat({
      id: "chat-1",
      title: "My Chat",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ],
    });
    const res = await chatsApp.request("/api/chats/chat-1/download");
    expect(res.status).toBe(200);
    // The download endpoint serves text/markdown
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toContain("text/markdown");
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("My Chat");
  });

  test("should include all messages in the downloaded markdown", async () => {
    mockState.loadChatHistoryResult = makeChat({
      messages: [
        { role: "user", content: "What is 2+2?" },
        { role: "assistant", content: "It is 4." },
      ],
    });
    const res = await chatsApp.request("/api/chats/chat-1/download");
    const text = await res.text();
    expect(text).toContain("What is 2+2?");
    expect(text).toContain("It is 4.");
  });

  test("should include the chat title as a markdown heading", async () => {
    mockState.loadChatHistoryResult = makeChat({ title: "Unique Title Here" });
    const res = await chatsApp.request("/api/chats/chat-1/download");
    const text = await res.text();
    expect(text).toContain("# Unique Title Here");
  });
});
