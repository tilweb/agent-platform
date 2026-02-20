/**
 * Tests for spaces API routes (backend/src/routes/spaces.ts)
 *
 * All routes require auth middleware.
 * All space service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUserId: null as null | string,

  // Service function results — default to success
  listUserSpacesResult: { success: true, data: [] } as any,
  createSpaceResult: { success: true, data: {} } as any,
  getSpaceResult: { success: true, data: {} } as any,
  updateSpaceResult: { success: true, data: {} } as any,
  deleteSpaceResult: { success: true } as any,
  archiveSpaceResult: { success: true, data: {} } as any,
  getMembersResult: { success: true, data: [] } as any,
  addMemberResult: { success: true, data: {} } as any,
  updateMemberRoleResult: { success: true } as any,
  removeMemberResult: { success: true } as any,
  updateSettingsResult: { success: true, data: {} } as any,
  getMemoryResult: { success: true, data: {} } as any,
  addAboutResult: { success: true, data: {} } as any,
  addInstructionResult: { success: true, data: {} } as any,
  addContextResult: { success: true, data: {} } as any,
  deleteMemoryItemResult: { success: true } as any,
  setContextActiveResult: { success: true } as any,
  getKBLinksResult: { success: true, data: {} } as any,
  linkKBCollectionResult: { success: true, data: {} } as any,
  unlinkKBCollectionResult: { success: true } as any,
  listChatsResult: { success: true, data: [] } as any,
  getChatResult: { success: true, data: {} } as any,
  deleteChatResult: { success: true } as any,
  getSpaceContextResult: { success: true, data: {} } as any,
};

// Mock auth middleware — injects mockState.currentUserId into context
mock.module("../../auth/middleware", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUserId) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("userId", mockState.currentUserId);
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
}));

// Mock internalError utility
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) => {
    return c.json({ error: "Ein interner Fehler ist aufgetreten" }, 500);
  },
}));

// Mock spaces service
mock.module("../../spaces", () => ({
  createSpace: async (_userId: string, _name: string, _opts: any) =>
    mockState.createSpaceResult,
  getSpace: async (_spaceId: string, _userId: string) =>
    mockState.getSpaceResult,
  updateSpace: async (_spaceId: string, _userId: string, _updates: any) =>
    mockState.updateSpaceResult,
  archiveSpace: async (_spaceId: string, _userId: string, _archived: boolean) =>
    mockState.archiveSpaceResult,
  deleteSpace: async (_spaceId: string, _userId: string) =>
    mockState.deleteSpaceResult,
  listUserSpaces: async (_userId: string, _includeArchived: boolean) =>
    mockState.listUserSpacesResult,
  getMembers: async (_spaceId: string, _userId: string) =>
    mockState.getMembersResult,
  addMember: async (
    _spaceId: string,
    _userId: string,
    _targetUserId: string,
    _role: string
  ) => mockState.addMemberResult,
  updateMemberRole: async (
    _spaceId: string,
    _currentUserId: string,
    _targetUserId: string,
    _role: string
  ) => mockState.updateMemberRoleResult,
  removeMember: async (
    _spaceId: string,
    _currentUserId: string,
    _targetUserId: string
  ) => mockState.removeMemberResult,
  updateSettings: async (_spaceId: string, _userId: string, _settings: any) =>
    mockState.updateSettingsResult,
  getMemory: async (_spaceId: string, _userId: string) =>
    mockState.getMemoryResult,
  addAbout: async (
    _spaceId: string,
    _userId: string,
    _content: string,
    _source: string
  ) => mockState.addAboutResult,
  addInstruction: async (
    _spaceId: string,
    _userId: string,
    _content: string,
    _priority: string,
    _source: string
  ) => mockState.addInstructionResult,
  addContext: async (
    _spaceId: string,
    _userId: string,
    _name: string,
    _description: string | undefined,
    _active: boolean,
    _source: string
  ) => mockState.addContextResult,
  deleteMemoryItem: async (
    _spaceId: string,
    _userId: string,
    _section: string,
    _itemId: string
  ) => mockState.deleteMemoryItemResult,
  setContextActive: async (
    _spaceId: string,
    _userId: string,
    _itemId: string,
    _active: boolean
  ) => mockState.setContextActiveResult,
  getKBLinks: async (_spaceId: string, _userId: string) =>
    mockState.getKBLinksResult,
  linkKBCollection: async (
    _spaceId: string,
    _userId: string,
    _collectionId: string
  ) => mockState.linkKBCollectionResult,
  unlinkKBCollection: async (
    _spaceId: string,
    _userId: string,
    _collectionId: string
  ) => mockState.unlinkKBCollectionResult,
  listChats: async (_spaceId: string, _userId: string) =>
    mockState.listChatsResult,
  getChat: async (_spaceId: string, _userId: string, _chatId: string) =>
    mockState.getChatResult,
  deleteChat: async (_spaceId: string, _userId: string, _chatId: string) =>
    mockState.deleteChatResult,
  getSpaceContext: async (_spaceId: string, _userId: string) =>
    mockState.getSpaceContextResult,
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { spaceRoutes } = await import("../spaces");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/spaces", spaceRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpace(overrides: Partial<any> = {}): any {
  return {
    id: "space-1",
    name: "Test Space",
    description: "A test space",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    createdBy: "user-1",
    members: [],
    settings: {
      include_memory_in_prompt: true,
      include_kb_in_prompt: true,
      default_chat_visibility: "space",
    },
    archived: false,
    ...overrides,
  };
}

function makeMember(overrides: Partial<any> = {}): any {
  return {
    userId: "user-2",
    role: "editor",
    addedAt: "2026-02-01T10:00:00.000Z",
    addedBy: "user-1",
    ...overrides,
  };
}

function makeMemory(): any {
  return {
    spaceId: "space-1",
    updatedAt: "2026-02-01T10:00:00.000Z",
    about: [],
    instructions: [],
    context: [],
  };
}

function makeAboutItem(overrides: Partial<any> = {}): any {
  return {
    id: "about-1",
    content: "This space is for testing",
    added_at: "2026-02-01T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function makeInstructionItem(overrides: Partial<any> = {}): any {
  return {
    id: "instr-1",
    content: "Always be concise",
    priority: "normal",
    added_at: "2026-02-01T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function makeContextItem(overrides: Partial<any> = {}): any {
  return {
    id: "ctx-1",
    name: "Project Alpha",
    description: "Main project context",
    active: true,
    added_at: "2026-02-01T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function makeChat(overrides: Partial<any> = {}): any {
  return {
    id: "chat-1",
    spaceId: "space-1",
    userId: "user-1",
    title: "Test Chat",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    messages: [],
    ...overrides,
  };
}

function resetState() {
  mockState.currentUserId = null;
  mockState.listUserSpacesResult = { success: true, data: [] };
  mockState.createSpaceResult = { success: true, data: makeSpace() };
  mockState.getSpaceResult = { success: true, data: makeSpace() };
  mockState.updateSpaceResult = { success: true, data: makeSpace() };
  mockState.deleteSpaceResult = { success: true };
  mockState.archiveSpaceResult = { success: true, data: makeSpace() };
  mockState.getMembersResult = { success: true, data: [] };
  mockState.addMemberResult = { success: true, data: makeMember() };
  mockState.updateMemberRoleResult = { success: true };
  mockState.removeMemberResult = { success: true };
  mockState.updateSettingsResult = {
    success: true,
    data: makeSpace().settings,
  };
  mockState.getMemoryResult = { success: true, data: makeMemory() };
  mockState.addAboutResult = { success: true, data: makeAboutItem() };
  mockState.addInstructionResult = {
    success: true,
    data: makeInstructionItem(),
  };
  mockState.addContextResult = { success: true, data: makeContextItem() };
  mockState.deleteMemoryItemResult = { success: true };
  mockState.setContextActiveResult = { success: true };
  mockState.getKBLinksResult = {
    success: true,
    data: { collections: [] },
  };
  mockState.linkKBCollectionResult = {
    success: true,
    data: { collectionId: "col-1", linkedAt: "2026-02-01T10:00:00.000Z", linkedBy: "user-1" },
  };
  mockState.unlinkKBCollectionResult = { success: true };
  mockState.listChatsResult = { success: true, data: [] };
  mockState.getChatResult = { success: true, data: makeChat() };
  mockState.deleteChatResult = { success: true };
  mockState.getSpaceContextResult = {
    success: true,
    data: { memory: makeMemory(), kbCollections: [] },
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Space Routes — Authentication", () => {
  beforeEach(() => {
    resetState();
  });

  test("should return 401 when no session is present for GET /", async () => {
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session for GET /:id", async () => {
    const res = await app.request("/api/spaces/space-1");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session for POST /", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Space" }),
    });
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session for DELETE /:id", async () => {
    const res = await app.request("/api/spaces/space-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("should allow authenticated user to access spaces", async () => {
    mockState.currentUserId = "user-1";
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces — list spaces", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return empty spaces list when user has no spaces", async () => {
    mockState.listUserSpacesResult = { success: true, data: [] };
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spaces).toEqual([]);
  });

  test("should return spaces for the authenticated user", async () => {
    const spaces = [makeSpace({ id: "s1" }), makeSpace({ id: "s2" })];
    mockState.listUserSpacesResult = { success: true, data: spaces };
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spaces).toHaveLength(2);
    expect(body.spaces[0].id).toBe("s1");
    expect(body.spaces[1].id).toBe("s2");
  });

  test("should pass includeArchived=false by default", async () => {
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(200);
  });

  test("should pass includeArchived=true when query param is set", async () => {
    const archived = makeSpace({ id: "archived-1", archived: true });
    mockState.listUserSpacesResult = { success: true, data: [archived] };
    const res = await app.request("/api/spaces?includeArchived=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spaces[0].archived).toBe(true);
  });

  test("should return 500 when service fails", async () => {
    mockState.listUserSpacesResult = {
      success: false,
      error: "Storage error",
    };
    const res = await app.request("/api/spaces");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces — create space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should create space and return 201", async () => {
    const space = makeSpace({ name: "My Project" });
    mockState.createSpaceResult = { success: true, data: space };
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Project" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("My Project");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No name provided" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name");
  });

  test("should return 400 when name exceeds 100 characters", async () => {
    const longName = "a".repeat(101);
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: longName }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("100");
  });

  test("should return 400 when description exceeds 1000 characters", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid Name",
        description: "d".repeat(1001),
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("1000");
  });

  test("should accept description of exactly 1000 characters", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid Name",
        description: "d".repeat(1000),
      }),
    });
    expect(res.status).toBe(201);
  });

  test("should accept name of exactly 100 characters", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a".repeat(100) }),
    });
    expect(res.status).toBe(201);
  });

  test("should pass icon and color to service", async () => {
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Design Space",
        icon: "palette",
        color: "#ff6b6b",
      }),
    });
    expect(res.status).toBe(201);
  });

  test("should return 400 when service fails", async () => {
    mockState.createSpaceResult = {
      success: false,
      error: "Space already exists",
    };
    const res = await app.request("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Duplicate" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Space already exists");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id — get space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return space details for a member", async () => {
    const space = makeSpace({ id: "space-1", name: "Work Hub" });
    mockState.getSpaceResult = { success: true, data: space };
    const res = await app.request("/api/spaces/space-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Work Hub");
  });

  test("should return 404 when space does not exist", async () => {
    mockState.getSpaceResult = {
      success: false,
      error: "Space nicht gefunden",
    };
    const res = await app.request("/api/spaces/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 403 when user is not a member", async () => {
    mockState.getSpaceResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/spaces/:id — update space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should update space and return updated data", async () => {
    const updated = makeSpace({ name: "Updated Name" });
    mockState.updateSpaceResult = { success: true, data: updated };
    const res = await app.request("/api/spaces/space-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated Name");
  });

  test("should return 400 when name exceeds 100 characters", async () => {
    const res = await app.request("/api/spaces/space-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "n".repeat(101) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("100");
  });

  test("should return 400 when description exceeds 1000 characters", async () => {
    const res = await app.request("/api/spaces/space-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid",
        description: "x".repeat(1001),
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("1000");
  });

  test("should return 404 when space does not exist", async () => {
    mockState.updateSpaceResult = {
      success: false,
      error: "Space nicht gefunden",
    };
    const res = await app.request("/api/spaces/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(404);
  });

  test("should return 403 when user lacks permission", async () => {
    mockState.updateSpaceResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(403);
  });

  test("should allow updating only icon and color without name", async () => {
    const res = await app.request("/api/spaces/space-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon: "rocket", color: "#3498db" }),
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/spaces/:id — delete space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should delete space and return success", async () => {
    mockState.deleteSpaceResult = { success: true };
    const res = await app.request("/api/spaces/space-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when space does not exist", async () => {
    mockState.deleteSpaceResult = {
      success: false,
      error: "Space nicht gefunden",
    };
    const res = await app.request("/api/spaces/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("should return 403 when user is not the owner", async () => {
    mockState.deleteSpaceResult = {
      success: false,
      error: "Nur der Owner darf den Space löschen",
    };
    const res = await app.request("/api/spaces/space-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/archive — archive space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should archive space and return updated space", async () => {
    const archived = makeSpace({ archived: true });
    mockState.archiveSpaceResult = { success: true, data: archived };
    const res = await app.request("/api/spaces/space-1/archive", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toBe(true);
  });

  test("should return 404 when space does not exist", async () => {
    mockState.archiveSpaceResult = {
      success: false,
      error: "Space nicht gefunden",
    };
    const res = await app.request("/api/spaces/nonexistent/archive", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("should return 403 when user lacks permission to archive", async () => {
    mockState.archiveSpaceResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1/archive", {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/unarchive — unarchive space", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should unarchive space and return updated space", async () => {
    const active = makeSpace({ archived: false });
    mockState.archiveSpaceResult = { success: true, data: active };
    const res = await app.request("/api/spaces/space-1/unarchive", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toBe(false);
  });

  test("should return 404 when space does not exist", async () => {
    mockState.archiveSpaceResult = {
      success: false,
      error: "Space nicht gefunden",
    };
    const res = await app.request("/api/spaces/nonexistent/unarchive", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/members — list members", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return member list for a space", async () => {
    const members = [
      makeMember({ userId: "user-1", role: "owner" }),
      makeMember({ userId: "user-2", role: "editor" }),
    ];
    mockState.getMembersResult = { success: true, data: members };
    const res = await app.request("/api/spaces/space-1/members");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].role).toBe("owner");
  });

  test("should return empty members list", async () => {
    mockState.getMembersResult = { success: true, data: [] };
    const res = await app.request("/api/spaces/space-1/members");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toEqual([]);
  });

  test("should return 403 when user lacks access", async () => {
    mockState.getMembersResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1/members");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/members — add member", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should add member and return 201", async () => {
    const member = makeMember({ userId: "user-2", role: "editor" });
    mockState.addMemberResult = { success: true, data: member };
    const res = await app.request("/api/spaces/space-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", role: "editor" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("user-2");
    expect(body.role).toBe("editor");
  });

  test("should return 400 when userId is missing", async () => {
    const res = await app.request("/api/spaces/space-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("userId");
  });

  test("should return 400 when role is missing", async () => {
    const res = await app.request("/api/spaces/space-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("role");
  });

  test("should return 400 when role is invalid", async () => {
    const res = await app.request("/api/spaces/space-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", role: "superuser" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Ungültige Rolle");
  });

  test("should accept all valid roles: admin, editor, viewer", async () => {
    for (const role of ["admin", "editor", "viewer"]) {
      const res = await app.request("/api/spaces/space-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-2", role }),
      });
      expect(res.status).toBe(201);
    }
  });

  test("should return 403 when user lacks permission to add members", async () => {
    mockState.addMemberResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-3", role: "viewer" }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/spaces/:id/members/:userId — update member role", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should update member role and return success", async () => {
    mockState.updateMemberRoleResult = { success: true };
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 400 when role is missing", async () => {
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("role");
  });

  test("should return 400 when role is invalid", async () => {
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "moderator" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Ungültige Rolle");
  });

  test("should return 403 when user lacks permission", async () => {
    mockState.updateMemberRoleResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "viewer" }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/spaces/:id/members/:userId — remove member", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should remove member and return success", async () => {
    mockState.removeMemberResult = { success: true };
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 403 when user lacks permission to remove members", async () => {
    mockState.removeMemberResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1/members/user-2", {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/spaces/:id/settings — update settings", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should update settings and return updated data", async () => {
    const newSettings = {
      include_memory_in_prompt: false,
      include_kb_in_prompt: true,
      default_chat_visibility: "private",
    };
    mockState.updateSettingsResult = { success: true, data: newSettings };
    const res = await app.request("/api/spaces/space-1/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.include_memory_in_prompt).toBe(false);
    expect(body.default_chat_visibility).toBe("private");
  });

  test("should return 403 when user lacks permission to change settings", async () => {
    mockState.updateSettingsResult = {
      success: false,
      error: "Keine Berechtigung",
    };
    const res = await app.request("/api/spaces/space-1/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ include_memory_in_prompt: false }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/memory — get memory", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return space memory", async () => {
    const memory = makeMemory();
    mockState.getMemoryResult = { success: true, data: memory };
    const res = await app.request("/api/spaces/space-1/memory");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spaceId).toBe("space-1");
    expect(Array.isArray(body.about)).toBe(true);
    expect(Array.isArray(body.instructions)).toBe(true);
    expect(Array.isArray(body.context)).toBe(true);
  });

  test("should return 403 when user lacks access", async () => {
    mockState.getMemoryResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1/memory");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/memory/about — add about item", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should add about item and return 201", async () => {
    const item = makeAboutItem({ content: "This team handles backend services" });
    mockState.addAboutResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "This team handles backend services" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("This team handles backend services");
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/spaces/space-1/memory/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content");
  });

  test("should use default source=manual when not specified", async () => {
    const res = await app.request("/api/spaces/space-1/memory/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Some info" }),
    });
    expect(res.status).toBe(201);
  });

  test("should accept source=agent", async () => {
    const res = await app.request("/api/spaces/space-1/memory/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Agent-extracted info", source: "agent" }),
    });
    expect(res.status).toBe(201);
  });

  test("should return 400 when service fails", async () => {
    mockState.addAboutResult = { success: false, error: "Max items reached" };
    const res = await app.request("/api/spaces/space-1/memory/about", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Too many items" }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/memory/instructions — add instruction", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should add instruction with default priority=normal and return 201", async () => {
    const item = makeInstructionItem();
    mockState.addInstructionResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Always be concise" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("Always be concise");
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/spaces/space-1/memory/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "high" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content");
  });

  test("should accept priority=high", async () => {
    const item = makeInstructionItem({ priority: "high" });
    mockState.addInstructionResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Critical rule", priority: "high" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe("high");
  });

  test("should return 400 when priority is invalid", async () => {
    const res = await app.request("/api/spaces/space-1/memory/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Some rule", priority: "critical" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Priorität");
  });

  test("should return 400 when service fails", async () => {
    mockState.addInstructionResult = {
      success: false,
      error: "Permission denied",
    };
    const res = await app.request("/api/spaces/space-1/memory/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Forbidden instruction" }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/memory/context — add context item", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should add context item and return 201", async () => {
    const item = makeContextItem({ name: "Sprint 42" });
    mockState.addContextResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sprint 42", description: "Current sprint" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Sprint 42");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/spaces/space-1/memory/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No name" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  test("should default active=true when not specified", async () => {
    const item = makeContextItem({ active: true });
    mockState.addContextResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Context" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(true);
  });

  test("should accept active=false", async () => {
    const item = makeContextItem({ active: false });
    mockState.addContextResult = { success: true, data: item };
    const res = await app.request("/api/spaces/space-1/memory/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Inactive Context", active: false }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  test("should return 400 when service fails", async () => {
    mockState.addContextResult = { success: false, error: "Permission denied" };
    const res = await app.request("/api/spaces/space-1/memory/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blocked Context" }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/spaces/:id/memory/:section/:itemId — delete memory item", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should delete about item and return success", async () => {
    mockState.deleteMemoryItemResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/memory/about/about-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should delete instructions item and return success", async () => {
    mockState.deleteMemoryItemResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/memory/instructions/instr-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(200);
  });

  test("should delete context item and return success", async () => {
    mockState.deleteMemoryItemResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/memory/context/ctx-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(200);
  });

  test("should return 400 when section is invalid", async () => {
    const res = await app.request(
      "/api/spaces/space-1/memory/unknown-section/item-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Section");
  });

  test("should return 404 when item is not found", async () => {
    mockState.deleteMemoryItemResult = {
      success: false,
      error: "Item not found",
    };
    const res = await app.request(
      "/api/spaces/space-1/memory/about/nonexistent",
      { method: "DELETE" }
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/spaces/:id/memory/context/:itemId/active — toggle context active", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should activate context item and return success", async () => {
    mockState.setContextActiveResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/memory/context/ctx-1/active",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should deactivate context item and return success", async () => {
    mockState.setContextActiveResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/memory/context/ctx-1/active",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }
    );
    expect(res.status).toBe(200);
  });

  test("should return 400 when active is not a boolean", async () => {
    const res = await app.request(
      "/api/spaces/space-1/memory/context/ctx-1/active",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: "yes" }),
      }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("boolean");
  });

  test("should return 400 when active is missing", async () => {
    const res = await app.request(
      "/api/spaces/space-1/memory/context/ctx-1/active",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(res.status).toBe(400);
  });

  test("should return 404 when context item is not found", async () => {
    mockState.setContextActiveResult = {
      success: false,
      error: "Context item not found",
    };
    const res = await app.request(
      "/api/spaces/space-1/memory/context/nonexistent/active",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/collections — get KB collections", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return KB links for the space", async () => {
    const links = {
      spaceId: "space-1",
      updatedAt: "2026-02-01T10:00:00.000Z",
      collections: [
        { collectionId: "col-1", linkedAt: "2026-02-01T10:00:00.000Z", linkedBy: "user-1" },
      ],
    };
    mockState.getKBLinksResult = { success: true, data: links };
    const res = await app.request("/api/spaces/space-1/collections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].collectionId).toBe("col-1");
  });

  test("should return 403 when user lacks access", async () => {
    mockState.getKBLinksResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1/collections");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/spaces/:id/collections — link KB collection", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should link collection and return 201", async () => {
    const link = {
      collectionId: "col-1",
      linkedAt: "2026-02-01T10:00:00.000Z",
      linkedBy: "user-1",
    };
    mockState.linkKBCollectionResult = { success: true, data: link };
    const res = await app.request("/api/spaces/space-1/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: "col-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.collectionId).toBe("col-1");
  });

  test("should return 400 when collectionId is missing", async () => {
    const res = await app.request("/api/spaces/space-1/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("collectionId");
  });

  test("should return 400 when service fails (e.g. already linked)", async () => {
    mockState.linkKBCollectionResult = {
      success: false,
      error: "Collection already linked",
    };
    const res = await app.request("/api/spaces/space-1/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: "col-1" }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/spaces/:id/collections/:collId — unlink KB collection", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should unlink collection and return success", async () => {
    mockState.unlinkKBCollectionResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/collections/col-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when collection is not linked", async () => {
    mockState.unlinkKBCollectionResult = {
      success: false,
      error: "Collection not linked",
    };
    const res = await app.request(
      "/api/spaces/space-1/collections/nonexistent",
      { method: "DELETE" }
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/chats — list space chats", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return empty chats list", async () => {
    mockState.listChatsResult = { success: true, data: [] };
    const res = await app.request("/api/spaces/space-1/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toEqual([]);
  });

  test("should return chats for the space", async () => {
    const chats = [makeChat({ id: "chat-1" }), makeChat({ id: "chat-2" })];
    mockState.listChatsResult = { success: true, data: chats };
    const res = await app.request("/api/spaces/space-1/chats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toHaveLength(2);
    expect(body.chats[0].id).toBe("chat-1");
  });

  test("should return 403 when user lacks access", async () => {
    mockState.listChatsResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1/chats");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/chats/:chatId — get single chat", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return chat details", async () => {
    const chat = makeChat({ id: "chat-1", title: "Planning Session" });
    mockState.getChatResult = { success: true, data: chat };
    const res = await app.request("/api/spaces/space-1/chats/chat-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("chat-1");
    expect(body.title).toBe("Planning Session");
  });

  test("should return 404 when chat is not found", async () => {
    mockState.getChatResult = {
      success: false,
      error: "Chat nicht gefunden",
    };
    const res = await app.request("/api/spaces/space-1/chats/nonexistent");
    expect(res.status).toBe(404);
  });

  test("should return 403 when user lacks access to the chat", async () => {
    mockState.getChatResult = {
      success: false,
      error: "Access denied",
    };
    const res = await app.request("/api/spaces/space-1/chats/chat-1");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/spaces/:id/chats/:chatId — delete space chat", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should delete chat and return success", async () => {
    mockState.deleteChatResult = { success: true };
    const res = await app.request(
      "/api/spaces/space-1/chats/chat-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when chat is not found", async () => {
    mockState.deleteChatResult = {
      success: false,
      error: "Chat nicht gefunden",
    };
    const res = await app.request(
      "/api/spaces/space-1/chats/nonexistent",
      { method: "DELETE" }
    );
    expect(res.status).toBe(404);
  });

  test("should return 403 when user lacks permission to delete chat", async () => {
    mockState.deleteChatResult = {
      success: false,
      error: "Access denied",
    };
    const res = await app.request(
      "/api/spaces/space-1/chats/chat-1",
      { method: "DELETE" }
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/spaces/:id/context — get space context for chat", () => {
  beforeEach(() => {
    resetState();
    mockState.currentUserId = "user-1";
  });

  test("should return space context", async () => {
    const context = {
      memory: makeMemory(),
      kbCollections: ["col-1", "col-2"],
    };
    mockState.getSpaceContextResult = { success: true, data: context };
    const res = await app.request("/api/spaces/space-1/context");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memory).toBeDefined();
    expect(Array.isArray(body.kbCollections)).toBe(true);
    expect(body.kbCollections).toHaveLength(2);
  });

  test("should return 403 when user lacks access", async () => {
    mockState.getSpaceContextResult = {
      success: false,
      error: "Zugriff verweigert",
    };
    const res = await app.request("/api/spaces/space-1/context");
    expect(res.status).toBe(403);
  });

  test("should return empty context when space has no memory or collections", async () => {
    const context = {
      memory: makeMemory(),
      kbCollections: [],
    };
    mockState.getSpaceContextResult = { success: true, data: context };
    const res = await app.request("/api/spaces/space-1/context");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kbCollections).toEqual([]);
  });
});
