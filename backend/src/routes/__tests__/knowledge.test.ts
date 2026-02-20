/**
 * Tests for knowledge base API routes (backend/src/routes/knowledge.ts)
 *
 * Routes require auth middleware. RBAC checks are mocked.
 * File system (fs/promises, existsSync) and yaml are mocked at module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — tests override per scenario
// ---------------------------------------------------------------------------

const mockState = {
  // Auth
  currentUser: null as null | { id: string; username: string; role: string },

  // fs/promises
  files: {} as Record<string, string>,   // path → raw file content (as stringified YAML)
  existingPaths: new Set<string>(),       // paths that "exist" (existsSync returns true)
  mkdirCalled: [] as string[],
  writtenFiles: {} as Record<string, string>,
  removedPaths: [] as string[],

  // RBAC
  canViewResult: { allowed: true, effectiveRole: "owner" } as { allowed: boolean; effectiveRole?: string },
  canEditResult: { allowed: true, effectiveRole: "owner" } as { allowed: boolean; effectiveRole?: string },
  canDeleteResult: { allowed: true, effectiveRole: "owner" } as { allowed: boolean; effectiveRole?: string },
  listAccessibleResult: [] as Array<{ resourceId: string; role: string }>,
  initializeResourceAccessCalled: [] as Array<{ type: string; id: string; userId: string }>,
  deleteResourceAccessCalled: [] as Array<{ type: string; id: string }>,
  hasAccessEntriesResult: false as boolean,
};

// ---------------------------------------------------------------------------
// Module mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

// Mock auth middleware — injects currentUser from mockState
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
    const id = c.get("userId");
    if (!id) throw new Error("Nicht authentifiziert");
    return id;
  },
}));

// Mock RBAC accessControl
mock.module("../../rbac/accessControl", () => ({
  canView: async (_userId: string, _type: string, _id: string) => mockState.canViewResult,
  canEdit: async (_userId: string, _type: string, _id: string) => mockState.canEditResult,
  canDelete: async (_userId: string, _type: string, _id: string) => mockState.canDeleteResult,
  canManageAccess: async (_userId: string, _type: string, _id: string) => ({ allowed: true }),
  listAccessibleResources: async (_userId: string, _type: string, _ids: string[]) =>
    mockState.listAccessibleResult,
}));

// Mock RBAC storage
mock.module("../../rbac/storage", () => ({
  initializeResourceAccess: async (type: string, id: string, userId: string) => {
    mockState.initializeResourceAccessCalled.push({ type, id, userId });
    return { principalType: "user", principalId: userId, role: "owner" };
  },
  deleteResourceAccess: async (type: string, id: string) => {
    mockState.deleteResourceAccessCalled.push({ type, id });
  },
  hasAccessEntries: async (_type: string, _id: string) => mockState.hasAccessEntriesResult,
}));

// Mock utils/paths so KB_BASE and KB_COLLECTIONS_FILE are predictable
mock.module("../../utils/paths", () => ({
  KB_BASE: "/mock/kb",
  KB_COLLECTIONS_FILE: "/mock/kb/collections.yaml",
}));

// Mock fs/promises
mock.module("fs/promises", () => ({
  readFile: async (path: string, _enc: string) => {
    const content = mockState.files[path];
    if (content === undefined) throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    return content;
  },
  writeFile: async (path: string, content: string, _enc: string) => {
    mockState.writtenFiles[path] = content;
    mockState.files[path] = content;
    mockState.existingPaths.add(path);
  },
  mkdir: async (path: string, _opts?: any) => {
    mockState.mkdirCalled.push(path);
    mockState.existingPaths.add(path);
  },
  rm: async (path: string, _opts?: any) => {
    mockState.removedPaths.push(path);
    mockState.existingPaths.delete(path);
  },
  readdir: async (_path: string) => [],
}));

// Mock fs (synchronous existsSync)
mock.module("fs", () => ({
  existsSync: (path: string) => mockState.existingPaths.has(path),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are in place
// ---------------------------------------------------------------------------
const { knowledgeRoutes, migrateExistingCollections } = await import("../knowledge");

const app = new Hono();
app.route("/api/knowledge", knowledgeRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

/** Produce a YAML string for our mock readFile */
function makeCollectionsYaml(collections: any[]): string {
  const { stringify } = require("yaml");
  return stringify({ collections });
}

function makeManifestYaml(data: any): string {
  const { stringify } = require("yaml");
  return stringify(data);
}

function makeCollection(overrides: Partial<any> = {}): any {
  return {
    id: "col-1",
    name: "Test Collection",
    description: "A test collection",
    document_count: 0,
    activate_when: [],
    never_activate_when: [],
    ...overrides,
  };
}

function makeDocument(overrides: Partial<any> = {}): any {
  return {
    document_id: "doc-1",
    title: "Test Doc",
    path: "test-doc",
    ...overrides,
  };
}

function resetMockState() {
  mockState.currentUser = null;
  mockState.files = {};
  mockState.existingPaths = new Set();
  mockState.mkdirCalled = [];
  mockState.writtenFiles = {};
  mockState.removedPaths = [];
  mockState.canViewResult = { allowed: true, effectiveRole: "owner" };
  mockState.canEditResult = { allowed: true, effectiveRole: "owner" };
  mockState.canDeleteResult = { allowed: true, effectiveRole: "owner" };
  mockState.listAccessibleResult = [];
  mockState.initializeResourceAccessCalled = [];
  mockState.deleteResourceAccessCalled = [];
  mockState.hasAccessEntriesResult = false;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("Knowledge Routes — Auth guard", () => {
  beforeEach(resetMockState);

  test("should return 401 when no session exists", async () => {
    const res = await app.request("/api/knowledge/collections");
    expect(res.status).toBe(401);
  });

  test("should proceed when user is authenticated", async () => {
    mockState.currentUser = makeUser();
    mockState.listAccessibleResult = [];
    // collections.yaml doesn't exist — route returns empty list
    const res = await app.request("/api/knowledge/collections");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/knowledge/collections
// ---------------------------------------------------------------------------

describe("GET /api/knowledge/collections", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return empty list when collections.yaml does not exist", async () => {
    mockState.listAccessibleResult = [];
    const res = await app.request("/api/knowledge/collections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections).toEqual([]);
  });

  test("should return only collections accessible to the user", async () => {
    const col1 = makeCollection({ id: "col-1", name: "One" });
    const col2 = makeCollection({ id: "col-2", name: "Two" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col1, col2]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    // Only col-1 is accessible
    mockState.listAccessibleResult = [{ resourceId: "col-1", role: "owner" }];

    const res = await app.request("/api/knowledge/collections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].id).toBe("col-1");
  });

  test("should attach role from RBAC to each returned collection", async () => {
    const col = makeCollection({ id: "col-1" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.listAccessibleResult = [{ resourceId: "col-1", role: "viewer" }];

    const res = await app.request("/api/knowledge/collections");
    const body = await res.json();
    expect(body.collections[0].role).toBe("viewer");
  });

  test("should return all accessible collections when multiple exist", async () => {
    const cols = [
      makeCollection({ id: "col-1", name: "A" }),
      makeCollection({ id: "col-2", name: "B" }),
      makeCollection({ id: "col-3", name: "C" }),
    ];
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml(cols);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.listAccessibleResult = [
      { resourceId: "col-1", role: "owner" },
      { resourceId: "col-3", role: "editor" },
    ];

    const res = await app.request("/api/knowledge/collections");
    const body = await res.json();
    expect(body.collections).toHaveLength(2);
    const ids = body.collections.map((c: any) => c.id);
    expect(ids).toContain("col-1");
    expect(ids).toContain("col-3");
    expect(ids).not.toContain("col-2");
  });

  test("should return empty list when user has access to none of the collections", async () => {
    const col = makeCollection({ id: "col-1" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.listAccessibleResult = []; // no access

    const res = await app.request("/api/knowledge/collections");
    const body = await res.json();
    expect(body.collections).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/knowledge/collections/:id
// ---------------------------------------------------------------------------

describe("GET /api/knowledge/collections/:id", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
  });

  test("should return 400 for invalid collection ID containing a dot", async () => {
    // The isValidId pattern ^[a-zA-Z0-9_-]+$ rejects dots.
    // Hono will URL-decode %2E to a dot and pass it to the handler.
    const res = await app.request("/api/knowledge/collections/col%2E1");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 400 for collection ID with space (percent-encoded)", async () => {
    const res = await app.request("/api/knowledge/collections/col%201");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 403 when user lacks view permission", async () => {
    mockState.canViewResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 404 when manifest file does not exist", async () => {
    mockState.canViewResult = { allowed: true, effectiveRole: "viewer" };
    // manifest path not in existingPaths
    const res = await app.request("/api/knowledge/collections/col-1");
    expect(res.status).toBe(404);
  });

  test("should return manifest data with role when collection exists", async () => {
    mockState.canViewResult = { allowed: true, effectiveRole: "owner" };
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const manifestData = {
      collection_id: "col-1",
      collection_name: "Test Collection",
      description: "Desc",
      documents: [],
    };
    mockState.files[manifestPath] = makeManifestYaml(manifestData);
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection_id).toBe("col-1");
    expect(body.collection_name).toBe("Test Collection");
    expect(body.role).toBe("owner");
  });

  test("should include documents array from manifest", async () => {
    mockState.canViewResult = { allowed: true, effectiveRole: "viewer" };
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument();
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      collection_name: "C",
      description: "",
      documents: [doc],
    });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1");
    const body = await res.json();
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].document_id).toBe("doc-1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/knowledge/collections
// ---------------------------------------------------------------------------

describe("POST /api/knowledge/collections", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    // collections.yaml exists and is empty initially
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
  });

  test("should return 400 when id is missing", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test-col" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 400 when ID contains uppercase letters", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "TestCol", name: "Test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("ID");
  });

  test("should return 400 when ID contains spaces", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "my col", name: "Test" }),
    });
    expect(res.status).toBe(400);
  });

  test("should create collection and return success", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "new-col",
        name: "New Collection",
        description: "A description",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.collection.id).toBe("new-col");
    expect(body.collection.name).toBe("New Collection");
    expect(body.collection.description).toBe("A description");
    expect(body.collection.document_count).toBe(0);
  });

  test("should initialize RBAC for the creator", async () => {
    await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "new-col", name: "New" }),
    });
    expect(mockState.initializeResourceAccessCalled).toHaveLength(1);
    expect(mockState.initializeResourceAccessCalled[0]).toMatchObject({
      type: "collection",
      id: "new-col",
      userId: "user-1",
    });
  });

  test("should write manifest.yaml for the new collection", async () => {
    await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "new-col", name: "New Collection" }),
    });
    const manifestPath = "/mock/kb/collections/new-col/manifest.yaml";
    expect(mockState.writtenFiles[manifestPath]).toBeDefined();
    expect(mockState.writtenFiles[manifestPath]).toContain("new-col");
  });

  test("should return 409 when collection with same ID already exists", async () => {
    const existing = makeCollection({ id: "existing-col" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([existing]);

    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "existing-col", name: "Duplicate" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should store activate_when and never_activate_when arrays", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "smart-col",
        name: "Smart Collection",
        activate_when: ["topic1"],
        never_activate_when: ["topic2"],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.activate_when).toEqual(["topic1"]);
    expect(body.collection.never_activate_when).toEqual(["topic2"]);
  });

  test("should default activate_when and never_activate_when to empty arrays", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "plain-col", name: "Plain" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.activate_when).toEqual([]);
    expect(body.collection.never_activate_when).toEqual([]);
  });

  test("should default description to empty string when not provided", async () => {
    const res = await app.request("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "nodesc-col", name: "No Desc" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.description).toBe("");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/knowledge/collections/:id
// ---------------------------------------------------------------------------

describe("PUT /api/knowledge/collections/:id", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    const col = makeCollection({ id: "col-1", name: "Original Name" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
  });

  test("should return 400 for invalid collection ID containing a dot", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col%2E1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(400);
  });

  test("should return 403 when user cannot edit", async () => {
    mockState.canEditResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 404 when collection is not in collections.yaml", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(404);
  });

  test("should update collection name and return success", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.collection.name).toBe("Updated Name");
    expect(body.collection.id).toBe("col-1");
  });

  test("should update description when provided", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "New description" }),
    });
    const body = await res.json();
    expect(body.collection.description).toBe("New description");
  });

  test("should preserve existing fields when only partial update is provided", async () => {
    mockState.canEditResult = { allowed: true };
    const col = makeCollection({ id: "col-1", name: "Preserved", activate_when: ["topic-a"] });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);

    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Only desc updated" }),
    });
    const body = await res.json();
    expect(body.collection.name).toBe("Preserved");
    expect(body.collection.activate_when).toEqual(["topic-a"]);
  });

  test("should update manifest.yaml when it exists", async () => {
    mockState.canEditResult = { allowed: true };
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      collection_name: "Original",
      description: "",
      documents: [],
    });
    mockState.existingPaths.add(manifestPath);

    await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });

    expect(mockState.writtenFiles[manifestPath]).toBeDefined();
    expect(mockState.writtenFiles[manifestPath]).toContain("Updated Name");
  });

  test("should update activate_when array", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate_when: ["new-topic"] }),
    });
    const body = await res.json();
    expect(body.collection.activate_when).toEqual(["new-topic"]);
  });

  test("should not update manifest when manifest does not exist", async () => {
    mockState.canEditResult = { allowed: true };
    // No manifest in existingPaths
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });
    // Should succeed without touching the manifest
    expect(res.status).toBe(200);
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    expect(mockState.writtenFiles[manifestPath]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/knowledge/collections/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/knowledge/collections/:id", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    const col = makeCollection({ id: "col-1" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
  });

  test("should return 400 for invalid collection ID containing a dot", async () => {
    mockState.canDeleteResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col%2E1", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("should return 403 when user cannot delete", async () => {
    mockState.canDeleteResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 404 when collection is not in collections.yaml", async () => {
    mockState.canDeleteResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("should delete collection and return success", async () => {
    mockState.canDeleteResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should remove the collection directory when it exists", async () => {
    mockState.canDeleteResult = { allowed: true };
    const collectionDir = "/mock/kb/collections/col-1";
    mockState.existingPaths.add(collectionDir);

    await app.request("/api/knowledge/collections/col-1", { method: "DELETE" });

    expect(mockState.removedPaths).toContain(collectionDir);
  });

  test("should not attempt to remove collection directory when it does not exist", async () => {
    mockState.canDeleteResult = { allowed: true };
    // collectionDir not in existingPaths
    await app.request("/api/knowledge/collections/col-1", { method: "DELETE" });
    expect(mockState.removedPaths).toHaveLength(0);
  });

  test("should delete RBAC access entries after removal", async () => {
    mockState.canDeleteResult = { allowed: true };
    await app.request("/api/knowledge/collections/col-1", { method: "DELETE" });
    expect(mockState.deleteResourceAccessCalled).toHaveLength(1);
    expect(mockState.deleteResourceAccessCalled[0]).toMatchObject({
      type: "collection",
      id: "col-1",
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/knowledge/collections/:id/documents
// ---------------------------------------------------------------------------

describe("GET /api/knowledge/collections/:id/documents", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    mockState.canViewResult = { allowed: true, effectiveRole: "viewer" };
  });

  test("should return 403 when user cannot view collection", async () => {
    mockState.canViewResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1/documents");
    expect(res.status).toBe(403);
  });

  test("should return 400 for invalid collection ID", async () => {
    mockState.canViewResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col%2E1/documents");
    expect(res.status).toBe(400);
  });

  test("should return 404 when manifest does not exist", async () => {
    const res = await app.request("/api/knowledge/collections/col-1/documents");
    expect(res.status).toBe(404);
  });

  test("should return empty documents array when manifest has no documents", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      documents: [],
    });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection_id).toBe("col-1");
    expect(body.documents).toEqual([]);
  });

  test("should return documents list from manifest", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc1 = makeDocument({ document_id: "doc-1", title: "Doc One" });
    const doc2 = makeDocument({ document_id: "doc-2", title: "Doc Two" });
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      documents: [doc1, doc2],
    });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toHaveLength(2);
    expect(body.documents[0].document_id).toBe("doc-1");
    expect(body.documents[1].document_id).toBe("doc-2");
  });

  test("should return documents as empty array when manifest.documents is absent", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    mockState.files[manifestPath] = makeManifestYaml({ collection_id: "col-1" });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents");
    const body = await res.json();
    expect(body.documents).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/knowledge/collections/:id/documents/:docId
// ---------------------------------------------------------------------------

describe("GET /api/knowledge/collections/:id/documents/:docId", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    mockState.canViewResult = { allowed: true, effectiveRole: "viewer" };
  });

  test("should return 403 when user cannot view collection", async () => {
    mockState.canViewResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    expect(res.status).toBe(403);
  });

  test("should return 400 for invalid document ID", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    mockState.files[manifestPath] = makeManifestYaml({ collection_id: "col-1", documents: [] });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc%2E1");
    expect(res.status).toBe(400);
  });

  test("should return 404 when manifest does not exist", async () => {
    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    expect(res.status).toBe(404);
  });

  test("should return 404 when document is not found in manifest", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      documents: [makeDocument({ document_id: "other-doc" })],
    });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return document metadata and content when both files exist", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument({ document_id: "doc-1", path: "my-doc" });
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      documents: [doc],
    });
    mockState.existingPaths.add(manifestPath);

    const metaPath = "/mock/kb/collections/col-1/documents/my-doc/DOCUMENT_META.md";
    const contentPath = "/mock/kb/collections/col-1/documents/my-doc/content.md";
    mockState.files[metaPath] = "# Meta\nsome meta";
    mockState.files[contentPath] = "# Content\nsome content";
    mockState.existingPaths.add(metaPath);
    mockState.existingPaths.add(contentPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document.document_id).toBe("doc-1");
    expect(body.meta).toContain("Meta");
    expect(body.content).toContain("Content");
  });

  test("should return null meta and content when document files do not exist", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument({ document_id: "doc-1", path: "my-doc" });
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      documents: [doc],
    });
    mockState.existingPaths.add(manifestPath);
    // no meta or content files in existingPaths

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toBeNull();
    expect(body.content).toBeNull();
  });

  test("should return meta but null content when only DOCUMENT_META.md exists", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument({ document_id: "doc-1", path: "my-doc" });
    mockState.files[manifestPath] = makeManifestYaml({ collection_id: "col-1", documents: [doc] });
    mockState.existingPaths.add(manifestPath);

    const metaPath = "/mock/kb/collections/col-1/documents/my-doc/DOCUMENT_META.md";
    mockState.files[metaPath] = "# Meta only";
    mockState.existingPaths.add(metaPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    const body = await res.json();
    expect(body.meta).toContain("Meta only");
    expect(body.content).toBeNull();
  });

  test("should return document object matching the manifest entry", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument({ document_id: "doc-1", title: "My Document", path: "my-doc" });
    mockState.files[manifestPath] = makeManifestYaml({ collection_id: "col-1", documents: [doc] });
    mockState.existingPaths.add(manifestPath);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1");
    const body = await res.json();
    expect(body.document.title).toBe("My Document");
    expect(body.document.path).toBe("my-doc");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/knowledge/collections/:id/documents/:docId
// ---------------------------------------------------------------------------

describe("DELETE /api/knowledge/collections/:id/documents/:docId", () => {
  beforeEach(() => {
    resetMockState();
    mockState.currentUser = makeUser();
    mockState.canEditResult = { allowed: true, effectiveRole: "owner" };

    // Set up a manifest with one document
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    const doc = makeDocument({ document_id: "doc-1", path: "my-doc" });
    mockState.files[manifestPath] = makeManifestYaml({
      collection_id: "col-1",
      collection_name: "Col One",
      description: "",
      last_updated: "2026-01-01T00:00:00.000Z",
      documents: [doc],
    });
    mockState.existingPaths.add(manifestPath);

    // Also set up collections.yaml so modifyCollections can update the count
    const col = makeCollection({ id: "col-1", document_count: 1 });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
  });

  test("should return 403 when user cannot edit collection", async () => {
    mockState.canEditResult = { allowed: false };
    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });

  test("should return 400 for invalid document ID containing a dot", async () => {
    mockState.canEditResult = { allowed: true };
    const res = await app.request("/api/knowledge/collections/col-1/documents/doc%2E1", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when manifest does not exist", async () => {
    mockState.canEditResult = { allowed: true };
    // Remove the manifest from state
    mockState.existingPaths.delete("/mock/kb/collections/col-1/manifest.yaml");
    delete mockState.files["/mock/kb/collections/col-1/manifest.yaml"];

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 when document is not in manifest", async () => {
    const res = await app.request("/api/knowledge/collections/col-1/documents/nonexistent-doc", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should delete document directory when it exists and return success", async () => {
    const docDir = "/mock/kb/collections/col-1/documents/my-doc";
    mockState.existingPaths.add(docDir);

    const res = await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockState.removedPaths).toContain(docDir);
  });

  test("should update manifest file after document deletion", async () => {
    const manifestPath = "/mock/kb/collections/col-1/manifest.yaml";
    await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    // Manifest should have been rewritten
    expect(mockState.writtenFiles[manifestPath]).toBeDefined();
    // The rewritten manifest should not contain doc-1 anymore
    const { parse } = require("yaml");
    const written = parse(mockState.writtenFiles[manifestPath]);
    const docIds = (written.documents || []).map((d: any) => d.document_id);
    expect(docIds).not.toContain("doc-1");
  });

  test("should not attempt to remove document directory when it does not exist", async () => {
    // docDir is not in existingPaths
    await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    expect(mockState.removedPaths).toHaveLength(0);
  });

  test("should update document_count in collections.yaml after deletion", async () => {
    await app.request("/api/knowledge/collections/col-1/documents/doc-1", {
      method: "DELETE",
    });
    // After deleting the only document, collections.yaml should be rewritten
    expect(mockState.writtenFiles["/mock/kb/collections.yaml"]).toBeDefined();
    const { parse } = require("yaml");
    const written = parse(mockState.writtenFiles["/mock/kb/collections.yaml"]);
    const col = written.collections.find((c: any) => c.id === "col-1");
    expect(col.document_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// migrateExistingCollections (exported function)
// ---------------------------------------------------------------------------

describe("migrateExistingCollections", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should return 0 migrated and 0 skipped when no collections exist", async () => {
    // collections.yaml not present — loadCollections returns { collections: [] }
    const result = await migrateExistingCollections("admin-1");
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  test("should migrate collections that have no access entries", async () => {
    const col1 = makeCollection({ id: "col-1" });
    const col2 = makeCollection({ id: "col-2" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col1, col2]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.hasAccessEntriesResult = false;

    const result = await migrateExistingCollections("admin-1");
    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(mockState.initializeResourceAccessCalled).toHaveLength(2);
    expect(mockState.initializeResourceAccessCalled[0].userId).toBe("admin-1");
  });

  test("should skip collections that already have access entries", async () => {
    const col = makeCollection({ id: "col-1" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.hasAccessEntriesResult = true;

    const result = await migrateExistingCollections("admin-1");
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockState.initializeResourceAccessCalled).toHaveLength(0);
  });

  test("should migrate all collections when none have access entries", async () => {
    const cols = [
      makeCollection({ id: "col-1" }),
      makeCollection({ id: "col-2" }),
      makeCollection({ id: "col-3" }),
    ];
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml(cols);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.hasAccessEntriesResult = false;

    const result = await migrateExistingCollections("admin-user");
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(0);
    expect(mockState.initializeResourceAccessCalled).toHaveLength(3);
    const migratedIds = mockState.initializeResourceAccessCalled.map((c) => c.id);
    expect(migratedIds).toContain("col-1");
    expect(migratedIds).toContain("col-2");
    expect(migratedIds).toContain("col-3");
  });

  test("should skip all collections when all have access entries", async () => {
    const cols = [
      makeCollection({ id: "col-1" }),
      makeCollection({ id: "col-2" }),
    ];
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml(cols);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.hasAccessEntriesResult = true;

    const result = await migrateExistingCollections("admin-1");
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(2);
  });

  test("should use the provided defaultOwnerId when initializing access", async () => {
    const col = makeCollection({ id: "col-1" });
    mockState.files["/mock/kb/collections.yaml"] = makeCollectionsYaml([col]);
    mockState.existingPaths.add("/mock/kb/collections.yaml");
    mockState.hasAccessEntriesResult = false;

    await migrateExistingCollections("specific-owner-id");
    expect(mockState.initializeResourceAccessCalled[0].userId).toBe("specific-owner-id");
  });

  test("should not throw when collections.yaml is absent", async () => {
    // No files set — loadCollections returns { collections: [] }
    const result = await migrateExistingCollections("admin-1");
    expect(result).toEqual({ migrated: 0, skipped: 0 });
  });
});
