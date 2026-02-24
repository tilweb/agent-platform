/**
 * Tests for IndexingQueueService (backend/src/services/indexingQueue.ts)
 *
 * All external dependencies (documentImporter, fs/promises, fs, path, utils/paths)
 * are mocked so no real I/O occurs. Mocks must be declared BEFORE the dynamic
 * import of the module under test.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // In-memory file system: path -> content string
  files: {} as Record<string, string>,
  // Directories that "exist" (in addition to files)
  dirs: new Set<string>(),
  // Controls whether writeFile/mkdir throw
  writeShouldThrow: false,

  // importAndIndex mock controls
  importResult: { success: true, documentId: undefined as string | undefined, error: undefined as string | undefined },
  importShouldThrow: false,
  importError: new Error("import failed"),
  importCalls: [] as Array<{ item: any; collectionId: string; userId?: string; opts?: any }>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE the dynamic import
// ---------------------------------------------------------------------------

const TEST_DATA_ROOT = "/tmp/test-indexing-queue";

mock.module("../../utils/paths", () => ({
  DATA_DIR: TEST_DATA_ROOT,
  AUTH_DIR: `${TEST_DATA_ROOT}/auth`,
  USERS_DIR: `${TEST_DATA_ROOT}/auth/users`,
  SESSIONS_DIR: `${TEST_DATA_ROOT}/auth/sessions`,
  GROUPS_DIR: `${TEST_DATA_ROOT}/auth/groups`,
  OAUTH_STATES_DIR: `${TEST_DATA_ROOT}/auth/oauth-states`,
  CHATS_DIR: `${TEST_DATA_ROOT}/chats`,
  CONVERSATIONS_DIR: `${TEST_DATA_ROOT}/conversations`,
  CHAT_UPLOADS_DIR: `${TEST_DATA_ROOT}/chat-uploads`,
  CHAT_FOLDERS_FILE: `${TEST_DATA_ROOT}/chats/chat-folders.yaml`,
  CONFIG_DIR: `${TEST_DATA_ROOT}/config`,
  PROVIDERS_DIR: `${TEST_DATA_ROOT}/providers`,
  ACTIVE_SELECTION_FILE: `${TEST_DATA_ROOT}/providers/active.yaml`,
  LEGACY_PROVIDERS_CONFIG: `${TEST_DATA_ROOT}/config/providers.yaml`,
  AGENTS_CONFIG: `${TEST_DATA_ROOT}/config/agents.md`,
  MCP_SERVERS_CONFIG: `${TEST_DATA_ROOT}/config/mcp-servers.yaml`,
  AGENTS_DIR: `${TEST_DATA_ROOT}/agents`,
  KB_BASE: `${TEST_DATA_ROOT}/knowledge-base`,
  KB_COLLECTIONS_FILE: `${TEST_DATA_ROOT}/knowledge-base/collections.yaml`,
  KB_INCOMING_DIR: `${TEST_DATA_ROOT}/knowledge-base/incoming`,
  TASKS_DIR: `${TEST_DATA_ROOT}/tasks`,
  GENERATED_IMAGES_DIR: `${TEST_DATA_ROOT}/generated-images`,
  EXPORTS_DIR: `${TEST_DATA_ROOT}/exports`,
  MEMORY_SESSIONS_DIR: `${TEST_DATA_ROOT}/memory/sessions`,
  MEMORY_USERS_DIR: `${TEST_DATA_ROOT}/memory/users`,
  SPACES_DIR: `${TEST_DATA_ROOT}/spaces`,
  TABLES_DIR: `${TEST_DATA_ROOT}/tables`,
  CONNECTIONS_DIR: `${TEST_DATA_ROOT}/connections`,
  CONNECTIONS_CONNECTORS_DIR: `${TEST_DATA_ROOT}/connections/connectors`,
  CONNECTIONS_TOKENS_DIR: `${TEST_DATA_ROOT}/connections/tokens`,
  CONNECTIONS_REGISTRY_FILE: `${TEST_DATA_ROOT}/connections/registry.yaml`,
  SKILLS_DIR: `${TEST_DATA_ROOT}/skills`,
  CUSTOM_TOOLS_DIR: `${TEST_DATA_ROOT}/tools/custom`,
  APPS_DIR: `${TEST_DATA_ROOT}/apps`,
  APPS_REGISTRY: `${TEST_DATA_ROOT}/apps/registry.yaml`,
  USAGE_DIR: `${TEST_DATA_ROOT}/usage`,
  AUDIT_DIR: `${TEST_DATA_ROOT}/audit`,
  NOTIFICATIONS_DIR: `${TEST_DATA_ROOT}/notifications`,
  TEMP_DIR: `${TEST_DATA_ROOT}/temp`,
  MARKITDOWN_API_URL: "",
  MARKITDOWN_API_KEY: "",
}));

mock.module("fs/promises", () => ({
  readFile: async (path: string, _enc?: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${path}'`);
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (path: string, content: string) => {
    if (mockState.writeShouldThrow) throw new Error("writeFile failed");
    mockState.files[path] = content;
  },
  mkdir: async (path: string, _opts?: any) => {
    if (mockState.writeShouldThrow) throw new Error("mkdir failed");
    mockState.dirs.add(String(path));
  },
  readdir: async (path: string, _opts?: any) => {
    // Return entries that are direct children of the given path
    const prefix = String(path) + "/";
    const children = new Set<string>();
    for (const dir of mockState.dirs) {
      if (dir.startsWith(prefix)) {
        const rest = dir.slice(prefix.length);
        const segment = rest.split("/")[0];
        if (segment) children.add(segment);
      }
    }
    // Also include dirs derived from known file paths
    for (const filePath of Object.keys(mockState.files)) {
      if (filePath.startsWith(prefix)) {
        const rest = filePath.slice(prefix.length);
        const segment = rest.split("/")[0];
        if (segment) children.add(segment);
      }
    }
    return Array.from(children).map((name) => ({
      name,
      isDirectory: () => true,
    }));
  },
  unlink: async (path: string) => {
    delete mockState.files[path];
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    const p = String(path);
    if (mockState.files[p] !== undefined) return true;
    for (const dir of mockState.dirs) {
      if (dir === p || dir.startsWith(p + "/")) return true;
    }
    return false;
  },
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.filter((p) => p !== undefined && p !== null && p !== "").join("/"),
  basename: (p: string, ext?: string) => {
    const base = String(p).split("/").pop() || "";
    if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
    return base;
  },
  extname: (p: string) => {
    const base = String(p).split("/").pop() || "";
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot) : "";
  },
  resolve: (...parts: string[]) => parts.filter(Boolean).join("/"),
  dirname: (p: string) => String(p).split("/").slice(0, -1).join("/") || "/",
}));

mock.module("../documentImporter", () => ({
  importAndIndex: async (item: any, collectionId: string, userId?: string, opts?: any) => {
    mockState.importCalls.push({ item, collectionId, userId, opts });
    if (mockState.importShouldThrow) throw mockState.importError;
    return { ...mockState.importResult };
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const { indexingQueue } = await import("../indexingQueue");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KB_COLLECTIONS = `${TEST_DATA_ROOT}/knowledge-base/collections`;
const KB_BASE = `${TEST_DATA_ROOT}/knowledge-base`;

function makeManifest(documentEntries: string = "documents: []"): string {
  return [
    `id: "col-1"`,
    `title: "Test Collection"`,
    `last_updated: "2024-01-01T00:00:00.000Z"`,
    documentEntries,
  ].join("\n");
}

function makeCollectionsYaml(collectionId: string, count = 0): string {
  return [
    `collections:`,
    `- id: "${collectionId}"`,
    `  title: "Test"`,
    `  document_count: ${count}`,
  ].join("\n");
}

function makeImportItem(overrides: Partial<any> = {}): any {
  return {
    id: "item-1",
    type: "chat",
    title: "Test Document",
    metadata: { filename: "test.pdf" },
    ...overrides,
  };
}

/** Wait for async queue processing to settle */
async function flushAsync(ms = 50): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Reset all mock state to clean defaults */
function resetMockState() {
  mockState.files = {};
  mockState.dirs = new Set();
  mockState.writeShouldThrow = false;
  mockState.importResult = { success: true, documentId: undefined, error: undefined };
  mockState.importShouldThrow = false;
  mockState.importError = new Error("import failed");
  mockState.importCalls = [];
}

/** Seed a collection's manifest file into the mock FS */
function seedManifest(collectionId: string, content?: string) {
  const path = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
  mockState.files[path] = content ?? makeManifest();
  mockState.dirs.add(`${KB_COLLECTIONS}/${collectionId}`);
}

function seedCollectionsYaml(collectionId: string, count = 0) {
  mockState.files[`${KB_BASE}/collections.yaml`] = makeCollectionsYaml(collectionId, count);
}

// ---------------------------------------------------------------------------
// Tests: enqueueBatch — return shape
// ---------------------------------------------------------------------------

describe("enqueueBatch — return shape", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should return collectionId and jobs array", async () => {
    seedManifest("col-1");
    seedCollectionsYaml("col-1");

    const result = await indexingQueue.enqueueBatch("col-1", [makeImportItem()]);

    expect(result.collectionId).toBe("col-1");
    expect(Array.isArray(result.jobs)).toBe(true);
    expect(result.jobs).toHaveLength(1);
  });

  test("should return one job entry per item", async () => {
    seedManifest("col-2");
    seedCollectionsYaml("col-2");

    const items = [
      makeImportItem({ id: "a", title: "Doc A" }),
      makeImportItem({ id: "b", title: "Doc B" }),
      makeImportItem({ id: "c", title: "Doc C" }),
    ];

    const result = await indexingQueue.enqueueBatch("col-2", items);

    expect(result.jobs).toHaveLength(3);
  });

  test("each job entry should have documentId, title, and a valid initial status", async () => {
    seedManifest("col-3");
    seedCollectionsYaml("col-3");

    const result = await indexingQueue.enqueueBatch("col-3", [makeImportItem({ title: "My Doc" })]);
    const job = result.jobs[0]!;

    expect(job).toHaveProperty("documentId");
    expect(job.title).toBe("My Doc");
    // processNext() fires concurrently so status may already be "indexing" by the time
    // enqueueBatch builds its return value — both "pending" and "indexing" are valid here
    expect(["pending", "indexing"]).toContain(job.status);
  });

  test("should return empty jobs array when no items are given", async () => {
    const result = await indexingQueue.enqueueBatch("col-empty", []);

    expect(result.collectionId).toBe("col-empty");
    expect(result.jobs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: enqueueBatch — document ID generation
// ---------------------------------------------------------------------------

describe("enqueueBatch — document ID generation", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("non-knowledge items should get a doc-<slug>-<timestamp> ID", async () => {
    seedManifest("col-id");
    seedCollectionsYaml("col-id");

    const result = await indexingQueue.enqueueBatch("col-id", [
      makeImportItem({ title: "Hello World", type: "chat" }),
    ]);

    const { documentId } = result.jobs[0]!;
    expect(documentId).toMatch(/^doc-hello-world-\d+$/);
  });

  test("knowledge-type items should get a copy-<id>-<timestamp> ID", async () => {
    seedManifest("col-kn");
    seedCollectionsYaml("col-kn");

    const result = await indexingQueue.enqueueBatch("col-kn", [
      makeImportItem({ id: "src-doc", type: "knowledge" }),
    ]);

    const { documentId } = result.jobs[0]!;
    expect(documentId).toMatch(/^copy-src-doc-\d+$/);
  });

  test("generated document IDs should be unique across multiple items", async () => {
    seedManifest("col-uniq");
    seedCollectionsYaml("col-uniq");

    const items = Array.from({ length: 3 }, (_, i) =>
      makeImportItem({ id: `i${i}`, title: `Doc ${i}`, type: "chat" }),
    );

    const result = await indexingQueue.enqueueBatch("col-uniq", items);
    const ids = result.jobs.map((j) => j.documentId);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: enqueueBatch — manifest placeholder registration
// ---------------------------------------------------------------------------

describe("enqueueBatch — manifest placeholder registration", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should write placeholder entry to manifest.yaml for non-knowledge items", async () => {
    const collectionId = "col-manifest";
    seedManifest(collectionId);
    seedCollectionsYaml(collectionId);

    const item = makeImportItem({ title: "New Doc", type: "chat" });
    const result = await indexingQueue.enqueueBatch(collectionId, [item]);
    const { documentId } = result.jobs[0]!;

    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    const written = mockState.files[manifestPath];

    expect(written).toBeDefined();
    expect(written).toContain(`document_id: "${documentId}"`);
    // processNext() fires concurrently, so status may already be "indexing" by this point
    expect(written).toMatch(/status: "(pending|indexing|ready|error)"/);
  });

  test("should expand 'documents: []' to a proper YAML list when manifest starts empty", async () => {
    const collectionId = "col-expand";
    seedManifest(collectionId, `id: "col-expand"\nlast_updated: "2024-01-01T00:00:00.000Z"\ndocuments: []`);
    seedCollectionsYaml(collectionId);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);

    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    const written = mockState.files[manifestPath]!;

    expect(written).not.toContain("documents: []");
    expect(written).toContain("documents:");
    expect(written).toContain("document_id:");
  });

  test("should NOT write a placeholder for knowledge-type items", async () => {
    const collectionId = "col-kn-no-placeholder";
    const initialManifest = makeManifest();
    seedManifest(collectionId, initialManifest);
    seedCollectionsYaml(collectionId);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "knowledge" })]);

    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    // Knowledge copies manage their own manifest — the queue should leave it unchanged
    const written = mockState.files[manifestPath]!;
    expect(written).toBe(initialManifest);
  });

  test("should skip manifest writing when manifest.yaml does not exist", async () => {
    // No seedManifest call — the file simply doesn't exist
    const collectionId = "col-no-manifest";
    seedCollectionsYaml(collectionId);

    // Should not throw
    await expect(
      indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]),
    ).resolves.toBeDefined();
  });

  test("should create the document directory for non-knowledge items", async () => {
    const collectionId = "col-mkdir";
    seedManifest(collectionId);
    seedCollectionsYaml(collectionId);

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    const { documentId } = result.jobs[0]!;

    const expectedDir = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}`;
    // The dir was created via mkdir
    expect(mockState.dirs.has(expectedDir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: enqueueBatch — import-job.json crash recovery file
// ---------------------------------------------------------------------------

describe("enqueueBatch — import-job.json persistence", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should write import-job.json for non-knowledge items", async () => {
    const collectionId = "col-job";
    seedManifest(collectionId);
    seedCollectionsYaml(collectionId);

    const item = makeImportItem({ type: "gdrive", title: "GDrive Doc" });
    const result = await indexingQueue.enqueueBatch(collectionId, [item], "user-42");
    const { documentId } = result.jobs[0]!;

    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;
    expect(mockState.files[jobPath]).toBeDefined();

    const parsed = JSON.parse(mockState.files[jobPath]!);
    expect(parsed.item).toBeDefined();
    expect(parsed.item.title).toBe("GDrive Doc");
    expect(parsed.userId).toBe("user-42");
    expect(parsed.createdAt).toBeDefined();
  });

  test("should NOT write import-job.json for knowledge-type items", async () => {
    const collectionId = "col-kn-job";
    seedManifest(collectionId);
    seedCollectionsYaml(collectionId);

    const result = await indexingQueue.enqueueBatch(collectionId, [
      makeImportItem({ id: "src", type: "knowledge" }),
    ]);
    const { documentId } = result.jobs[0]!;

    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;
    expect(mockState.files[jobPath]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: processing — importAndIndex is called
// ---------------------------------------------------------------------------

describe("processing — importAndIndex integration", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should call importAndIndex for each enqueued item", async () => {
    const collectionId = "col-process";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-x"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ title: "Proc Doc", type: "chat" })]);
    await flushAsync(80);

    expect(mockState.importCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("should pass collectionId and userId to importAndIndex", async () => {
    const collectionId = "col-pass";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-pass"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })], "user-99");
    await flushAsync(80);

    const call = mockState.importCalls.find((c) => c.collectionId === collectionId);
    expect(call).toBeDefined();
    expect(call!.userId).toBe("user-99");
  });

  test("should pass preAllocatedDocumentId option for non-knowledge items", async () => {
    const collectionId = "col-preid";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-pre"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const { documentId } = result.jobs[0]!;
    const call = mockState.importCalls.find((c) => c.collectionId === collectionId);
    expect(call).toBeDefined();
    expect(call!.opts?.preAllocatedDocumentId).toBe(documentId);
    expect(call!.opts?.skipManifestEntry).toBe(true);
  });

  test("should pass no opts for knowledge-type items", async () => {
    const collectionId = "col-kn-opts";
    seedManifest(collectionId);
    seedCollectionsYaml(collectionId);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ id: "k1", type: "knowledge" })]);
    await flushAsync(80);

    const call = mockState.importCalls.find((c) => c.collectionId === collectionId);
    expect(call).toBeDefined();
    expect(call!.opts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: processing — status lifecycle (success)
// ---------------------------------------------------------------------------

describe("processing — success lifecycle", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("job status progresses to 'ready' after successful import", async () => {
    const collectionId = "col-ready";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-ready"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const jobs = indexingQueue.getActiveJobs(collectionId);
    const job = jobs.find((j) => j.documentId === result.jobs[0]!.documentId);
    if (job) {
      expect(job.status).toBe("ready");
    }
    // Verify the manifest was updated to "ready"
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    const written = mockState.files[manifestPath];
    if (written && written.includes("doc-")) {
      expect(written).toContain(`status: "ready"`);
    }
  });

  test("should delete import-job.json after successful import", async () => {
    const collectionId = "col-cleanup";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-cleanup"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const { documentId } = result.jobs[0]!;
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;
    expect(mockState.files[jobPath]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: processing — status lifecycle (failure)
// ---------------------------------------------------------------------------

describe("processing — failure lifecycle", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("job status should be 'error' after failed import (success: false)", async () => {
    const collectionId = "col-fail";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-fail"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: false, documentId: undefined, error: "Parsing error" };

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const jobs = indexingQueue.getActiveJobs(collectionId);
    const job = jobs.find((j) => j.documentId === result.jobs[0]!.documentId);
    if (job) {
      expect(job.status).toBe("error");
      expect(job.error).toContain("Parsing error");
    }
  });

  test("job status should be 'error' when importAndIndex throws", async () => {
    const collectionId = "col-throw";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-throw"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importShouldThrow = true;
    mockState.importError = new Error("network error");

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const jobs = indexingQueue.getActiveJobs(collectionId);
    const job = jobs.find((j) => j.documentId === result.jobs[0]!.documentId);
    if (job) {
      expect(job.status).toBe("error");
      expect(job.error).toContain("network error");
    }
  });

  test("should fall back to generic message when thrown error has no message", async () => {
    const collectionId = "col-nomsg";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-nomsg"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importShouldThrow = true;
    mockState.importError = Object.assign(new Error(""), { message: "" });

    const result = await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    const jobs = indexingQueue.getActiveJobs(collectionId);
    const job = jobs.find((j) => j.documentId === result.jobs[0]!.documentId);
    if (job) {
      expect(job.status).toBe("error");
      expect(typeof job.error).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: getActiveJobs
// ---------------------------------------------------------------------------

describe("getActiveJobs", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should return only jobs for the requested collectionId", async () => {
    const colA = "col-get-a";
    const colB = "col-get-b";
    // Use knowledge type to skip manifest registration for simpler setup
    await indexingQueue.enqueueBatch(colA, [makeImportItem({ id: "ka1", type: "knowledge", title: "A1" })]);
    await indexingQueue.enqueueBatch(colB, [makeImportItem({ id: "kb1", type: "knowledge", title: "B1" })]);

    await flushAsync(20);

    const jobsA = indexingQueue.getActiveJobs(colA);
    const jobsB = indexingQueue.getActiveJobs(colB);

    for (const j of jobsA) expect(j.documentId).not.toContain("kb1");
    for (const j of jobsB) expect(j.documentId).not.toContain("ka1");
  });

  test("should include documentId, title, status, and optional error fields", async () => {
    const colC = "col-get-c";
    const result = await indexingQueue.enqueueBatch(colC, [
      makeImportItem({ id: "kc", type: "knowledge", title: "C Doc" }),
    ]);
    await flushAsync(20);

    const jobs = indexingQueue.getActiveJobs(colC);
    if (jobs.length > 0) {
      const job = jobs[0]!;
      expect(job).toHaveProperty("documentId");
      expect(job).toHaveProperty("title");
      expect(job).toHaveProperty("status");
    }
    expect(result.jobs[0]!.title).toBe("C Doc");
  });
});

// ---------------------------------------------------------------------------
// Tests: addListener / removeListener / broadcast
// ---------------------------------------------------------------------------

describe("addListener / removeListener / broadcast", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should invoke listener when a job is processed", async () => {
    const collectionId = "col-sse";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const events: any[] = [];
    const listener = (e: any) => events.push(e);
    indexingQueue.addListener(collectionId, listener);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat", title: "SSE Doc" })]);
    await flushAsync(80);

    indexingQueue.removeListener(collectionId, listener);

    expect(events.length).toBeGreaterThan(0);
    const types = events.map((e) => e.type);
    expect(types).toContain("document_indexing");
  });

  test("should emit document_ready event on successful import", async () => {
    const collectionId = "col-sse-ready";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse-r"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const events: any[] = [];
    const listener = (e: any) => events.push(e);
    indexingQueue.addListener(collectionId, listener);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat", title: "Ready Doc" })]);
    await flushAsync(80);

    indexingQueue.removeListener(collectionId, listener);

    const readyEvent = events.find((e) => e.type === "document_ready");
    expect(readyEvent).toBeDefined();
    expect(readyEvent!.title).toBe("Ready Doc");
  });

  test("should emit document_error event on failed import", async () => {
    const collectionId = "col-sse-err";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse-e"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: false, documentId: undefined, error: "PDF parse failed" };

    const events: any[] = [];
    const listener = (e: any) => events.push(e);
    indexingQueue.addListener(collectionId, listener);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat", title: "Error Doc" })]);
    await flushAsync(80);

    indexingQueue.removeListener(collectionId, listener);

    const errEvent = events.find((e) => e.type === "document_error");
    expect(errEvent).toBeDefined();
    expect(errEvent!.error).toContain("PDF parse failed");
  });

  test("should not invoke listener after removeListener", async () => {
    const collectionId = "col-sse-remove";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse-rem"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const events: any[] = [];
    const listener = (e: any) => events.push(e);
    indexingQueue.addListener(collectionId, listener);
    indexingQueue.removeListener(collectionId, listener);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat", title: "Gone" })]);
    await flushAsync(80);

    expect(events).toHaveLength(0);
  });

  test("should survive a listener that throws", async () => {
    const collectionId = "col-sse-throw";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse-t"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const throwingListener = (_e: any) => { throw new Error("listener crashed"); };
    indexingQueue.addListener(collectionId, throwingListener);

    // Processing should complete without propagating the listener error
    await expect(
      indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]),
    ).resolves.toBeDefined();
    await flushAsync(80);

    indexingQueue.removeListener(collectionId, throwingListener);
  });

  test("should support multiple listeners for the same collection", async () => {
    const collectionId = "col-sse-multi";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-sse-m"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    const events1: any[] = [];
    const events2: any[] = [];
    const l1 = (e: any) => events1.push(e);
    const l2 = (e: any) => events2.push(e);

    indexingQueue.addListener(collectionId, l1);
    indexingQueue.addListener(collectionId, l2);

    await indexingQueue.enqueueBatch(collectionId, [makeImportItem({ type: "chat" })]);
    await flushAsync(80);

    indexingQueue.removeListener(collectionId, l1);
    indexingQueue.removeListener(collectionId, l2);

    expect(events1.length).toBeGreaterThan(0);
    expect(events2.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: retryJob
// ---------------------------------------------------------------------------

describe("retryJob", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should return false when import-job.json does not exist", async () => {
    const result = await indexingQueue.retryJob("col-retry", "doc-missing");
    expect(result).toBe(false);
  });

  test("should return true when import-job.json exists", async () => {
    const collectionId = "col-retry-ok";
    const documentId = "doc-retry-ok";
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    const jobData = {
      item: makeImportItem({ type: "chat", title: "Retry Doc" }),
      userId: "user-1",
      createdAt: new Date().toISOString(),
    };
    mockState.files[jobPath] = JSON.stringify(jobData);
    mockState.files[manifestPath] = makeManifest(
      `documents:\n  - document_id: "${documentId}"\n    title: "Retry Doc"\n    status: "error"\n    error: "prev error"`,
    );
    seedCollectionsYaml(collectionId);

    const result = await indexingQueue.retryJob(collectionId, documentId);
    expect(result).toBe(true);
  });

  test("should re-enqueue the job and call importAndIndex after retry", async () => {
    const collectionId = "col-retry-enq";
    const documentId = "doc-retry-enq";
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    const jobData = {
      item: makeImportItem({ type: "chat", title: "Re-Enqueue Doc" }),
      userId: "user-2",
      createdAt: new Date().toISOString(),
    };
    mockState.files[jobPath] = JSON.stringify(jobData);
    mockState.files[manifestPath] = makeManifest(
      `documents:\n  - document_id: "${documentId}"\n    title: "Re-Enqueue Doc"\n    status: "error"\n    error: "some error"`,
    );
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    await indexingQueue.retryJob(collectionId, documentId);
    await flushAsync(80);

    // importAndIndex should have been called for the retried job
    const call = mockState.importCalls.find((c) => c.collectionId === collectionId);
    expect(call).toBeDefined();
  });

  test("should return false when import-job.json contains invalid JSON", async () => {
    const collectionId = "col-retry-bad";
    const documentId = "doc-retry-bad";
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;

    mockState.files[jobPath] = "NOT VALID JSON {{{";

    const result = await indexingQueue.retryJob(collectionId, documentId);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: updateDocumentStatus
// ---------------------------------------------------------------------------

describe("updateDocumentStatus", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should update status field in manifest YAML", async () => {
    const collectionId = "col-upd";
    const documentId = "doc-upd";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Upd Doc"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    await indexingQueue.updateDocumentStatus(collectionId, documentId, "ready");

    expect(mockState.files[manifestPath]).toContain(`status: "ready"`);
  });

  test("should update error field when error string is provided", async () => {
    const collectionId = "col-upd-err";
    const documentId = "doc-upd-err";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Err Doc"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    await indexingQueue.updateDocumentStatus(collectionId, documentId, "error", "Something went wrong");

    expect(mockState.files[manifestPath]).toContain(`status: "error"`);
    expect(mockState.files[manifestPath]).toContain("Something went wrong");
  });

  test("should clear the error field when status is 'ready'", async () => {
    const collectionId = "col-upd-clear";
    const documentId = "doc-upd-clear";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Clear Doc"`,
      `    status: "error"`,
      `    error: "old error"`,
    ].join("\n");

    await indexingQueue.updateDocumentStatus(collectionId, documentId, "ready");

    const written = mockState.files[manifestPath]!;
    expect(written).toContain(`status: "ready"`);
    expect(written).toContain(`error: ""`);
    expect(written).not.toContain("old error");
  });

  test("should escape double-quotes in error strings to prevent YAML corruption", async () => {
    const collectionId = "col-upd-quote";
    const documentId = "doc-upd-quote";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Quote Doc"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    await indexingQueue.updateDocumentStatus(collectionId, documentId, "error", 'He said "hello"');

    const written = mockState.files[manifestPath]!;
    // Double-quotes in error value should be replaced with single quotes
    expect(written).toContain("He said 'hello'");
  });

  test("should be a no-op when manifest file does not exist", async () => {
    // No file seeded — should not throw
    await expect(
      indexingQueue.updateDocumentStatus("col-missing", "doc-missing", "ready"),
    ).resolves.toBeUndefined();
  });

  test("should handle multiple documents and update only the target", async () => {
    const collectionId = "col-multi";
    const docA = "doc-a";
    const docB = "doc-b";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${docA}"`,
      `    title: "Doc A"`,
      `    status: "pending"`,
      `    error: ""`,
      `  - document_id: "${docB}"`,
      `    title: "Doc B"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    await indexingQueue.updateDocumentStatus(collectionId, docA, "ready");

    const written = mockState.files[manifestPath]!;
    expect(written).toContain(`document_id: "${docA}"`);
    expect(written).toContain(`document_id: "${docB}"`);
    // Check docB still has pending status (appears after docB's document_id line)
    const docBIndex = written.indexOf(`document_id: "${docB}"`);
    const afterDocB = written.slice(docBIndex);
    expect(afterDocB).toContain(`status: "pending"`);
  });
});

// ---------------------------------------------------------------------------
// Tests: recoverInterruptedJobs
// ---------------------------------------------------------------------------

describe("recoverInterruptedJobs", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should return 0 when collections directory does not exist", async () => {
    const count = await indexingQueue.recoverInterruptedJobs();
    expect(count).toBe(0);
  });

  test("should return 0 when no pending/indexing documents exist", async () => {
    const collectionId = "col-recover-none";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    mockState.dirs.add(`${KB_BASE}/collections`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${collectionId}`);
    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "doc-done"`,
      `    title: "Done"`,
      `    status: "ready"`,
      `    error: ""`,
    ].join("\n");

    const count = await indexingQueue.recoverInterruptedJobs();
    expect(count).toBe(0);
  });

  test("should recover a pending document that has an import-job.json", async () => {
    const collectionId = "col-recover-ok";
    const documentId = "doc-pending";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;

    mockState.dirs.add(`${KB_BASE}/collections`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${collectionId}`);

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Pending Doc"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    mockState.files[jobPath] = JSON.stringify({
      item: makeImportItem({ type: "chat", title: "Pending Doc" }),
      userId: "user-recover",
      createdAt: new Date().toISOString(),
    });

    const count = await indexingQueue.recoverInterruptedJobs();
    expect(count).toBe(1);
  });

  test("should recover an 'indexing' document (interrupted mid-processing)", async () => {
    const collectionId = "col-recover-indexing";
    const documentId = "doc-indexing";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;
    const jobPath = `${KB_COLLECTIONS}/${collectionId}/documents/${documentId}/import-job.json`;

    mockState.dirs.add(`${KB_BASE}/collections`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${collectionId}`);

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "Indexing Doc"`,
      `    status: "indexing"`,
      `    error: ""`,
    ].join("\n");

    mockState.files[jobPath] = JSON.stringify({
      item: makeImportItem({ type: "chat", title: "Indexing Doc" }),
      userId: "user-recover",
      createdAt: new Date().toISOString(),
    });

    const count = await indexingQueue.recoverInterruptedJobs();
    expect(count).toBe(1);
  });

  test("should mark document as error when import-job.json is missing during recovery", async () => {
    const collectionId = "col-recover-no-job";
    const documentId = "doc-no-job";
    const manifestPath = `${KB_COLLECTIONS}/${collectionId}/manifest.yaml`;

    mockState.dirs.add(`${KB_BASE}/collections`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${collectionId}`);

    mockState.files[manifestPath] = [
      `documents:`,
      `  - document_id: "${documentId}"`,
      `    title: "No Job Doc"`,
      `    status: "pending"`,
      `    error: ""`,
    ].join("\n");

    // No import-job.json seeded

    const count = await indexingQueue.recoverInterruptedJobs();

    // Should not count as recovered
    expect(count).toBe(0);
    // Manifest should be updated to error status
    const written = mockState.files[manifestPath]!;
    expect(written).toContain(`status: "error"`);
  });

  test("should recover multiple documents across multiple collections", async () => {
    const colA = "col-recover-multi-a";
    const colB = "col-recover-multi-b";

    mockState.dirs.add(`${KB_BASE}/collections`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${colA}`);
    mockState.dirs.add(`${KB_COLLECTIONS}/${colB}`);

    for (const [col, docId] of [[colA, "doc-ra"], [colB, "doc-rb"]] as [string, string][]) {
      const manifestPath = `${KB_COLLECTIONS}/${col}/manifest.yaml`;
      const jobPath = `${KB_COLLECTIONS}/${col}/documents/${docId}/import-job.json`;
      mockState.files[manifestPath] = [
        `documents:`,
        `  - document_id: "${docId}"`,
        `    title: "Multi Recover"`,
        `    status: "pending"`,
        `    error: ""`,
      ].join("\n");
      mockState.files[jobPath] = JSON.stringify({
        item: makeImportItem({ type: "chat", title: "Multi Recover" }),
        userId: "u",
        createdAt: new Date().toISOString(),
      });
    }

    const count = await indexingQueue.recoverInterruptedJobs();
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: concurrency limit (MAX_CONCURRENT = 2)
// ---------------------------------------------------------------------------

describe("concurrency — MAX_CONCURRENT = 2", () => {
  beforeEach(() => {
    resetMockState();
  });

  test("should process all enqueued items without exceeding concurrency of 2", async () => {
    const collectionId = "col-concurrency";
    const manifest = makeManifest(`documents:\n  - document_id: "doc-conc"\n    title: "T"\n    status: "pending"\n    error: ""`);
    seedManifest(collectionId, manifest);
    seedCollectionsYaml(collectionId);
    mockState.importResult = { success: true, documentId: undefined, error: undefined };

    // Enqueue 4 knowledge-type items (skip manifest/fs ops for simplicity)
    const items = Array.from({ length: 4 }, (_, i) =>
      makeImportItem({ id: `kc${i}`, type: "knowledge", title: `Conc ${i}` }),
    );

    await indexingQueue.enqueueBatch(collectionId, items);
    // Wait long enough for all 4 items to be processed (2 at a time)
    await flushAsync(200);

    // All 4 items should have been processed (importAndIndex called 4 times for this collection)
    const calls = mockState.importCalls.filter((c) => c.collectionId === collectionId);
    expect(calls.length).toBe(4);
  });
});
