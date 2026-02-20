/**
 * Tests for documentFetcher service
 * (backend/src/services/documentFetcher.ts)
 *
 * All external dependencies (fs/promises, fs, path, memory service, MCP
 * manager, connection registry, tool registry, and fetch) are mocked so no
 * real disk I/O or network calls occur.
 *
 * Note: Bun.file is called in the binary-conversion path only to build a
 * FormData payload; since we mock fetch end-to-end, we do not need to replace
 * Bun.file (which is non-configurable in Bun 1.x).
 *
 * Mocks MUST be declared before the dynamic import of the module under test.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Simulated file system (absolute path -> string content)
  files: {} as Record<string, string>,

  // Controls what loadChatHistory returns
  chatHistory: null as Record<string, any> | null,

  // Controls what mcpManager.getServers() returns
  mcpServers: [] as Array<{ id: string; name: string; status: string }>,

  // Controls what mcpManager.callTool() returns
  mcpToolResult: null as any,

  // Whether mcpManager.callTool() should throw
  mcpToolThrow: null as Error | null,

  // Controls what connectionRegistry.getTokens() returns
  connectionTokens: null as { accessToken: string; tokenType: string } | null,

  // Queue of fetch responses consumed in FIFO order
  fetchResponses: [] as Array<{
    ok: boolean;
    status?: number;
    text?: string;
    arrayBuffer?: ArrayBuffer;
  }>,

  // Controls what toolRegistry.get() returns (tool object or undefined)
  toolResult: null as { execute: (...args: any[]) => Promise<string> } | null,

  // Track file-system side effects
  writtenFiles: {} as Record<string, any>,
  removedFiles: [] as string[],
  mkdirCalls: [] as string[],
};

// ---------------------------------------------------------------------------
// Module mocks — must appear BEFORE dynamic import of module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  readFile: async (path: string, _encoding?: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: any = new Error(
      `ENOENT: no such file or directory, open '${path}'`
    );
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (path: string, data: any) => {
    mockState.writtenFiles[path] = data;
  },
  mkdir: async (path: string) => {
    mockState.mkdirCalls.push(path);
  },
  rm: async (path: string) => {
    mockState.removedFiles.push(path);
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => mockState.files[path] !== undefined,
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

mock.module("../memory", () => ({
  loadChatHistory: async (_id: string) => mockState.chatHistory,
}));

mock.module("../../utils/paths", () => ({
  KB_BASE: "/mock/kb",
  TEMP_DIR: "/mock/temp",
  APPS_DIR: "/mock/apps",
  MARKITDOWN_API_URL: "http://mock-markitdown/convert",
  MARKITDOWN_API_KEY: "mock-api-key",
}));

mock.module("../../mcp", () => ({
  mcpManager: {
    getServers: async () => mockState.mcpServers,
    callTool: async (_serverId: string, _toolName: string, _params: any) => {
      if (mockState.mcpToolThrow) throw mockState.mcpToolThrow;
      return mockState.mcpToolResult;
    },
  },
}));

mock.module("../../connections/registry", () => ({
  connectionRegistry: {
    getTokens: async (_userId: string, _providerId: string) =>
      mockState.connectionTokens,
  },
}));

mock.module("../../tools/registry", () => ({
  toolRegistry: {
    get: (_name: string) => mockState.toolResult,
  },
}));

// ---------------------------------------------------------------------------
// Mock globalThis.fetch — queue-based, consumed in FIFO order
// ---------------------------------------------------------------------------

const mockFetch = mock(async (url: string, _opts?: RequestInit) => {
  const response = mockState.fetchResponses.shift();
  if (!response) {
    throw new Error(`Unexpected fetch call to ${url}: no queued response`);
  }
  const { ok, status = ok ? 200 : 500, text: textBody = "", arrayBuffer: ab } =
    response;
  return {
    ok,
    status,
    text: async () => textBody,
    arrayBuffer: async () => ab ?? new ArrayBuffer(0),
  };
});
(globalThis as unknown as Record<string, unknown>).fetch = mockFetch;

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  fetchAllDocuments,
  prepareReaderContexts,
  getCachedReaderContexts,
  clearCachedReaderContexts,
  cleanupExpiredCaches,
  buildReaderContextSection,
} = await import("../documentFetcher");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChat(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: "chat-1",
    title: "Test Chat",
    createdAt: "2026-01-01T10:00:00.000Z",
    messages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchAllDocuments()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.chatHistory = null;
    mockState.mcpServers = [];
    mockState.mcpToolResult = null;
    mockState.mcpToolThrow = null;
    mockState.connectionTokens = null;
    mockState.fetchResponses = [];
    mockState.toolResult = null;
    mockState.writtenFiles = {};
    mockState.removedFiles = [];
    mockState.mkdirCalls = [];
    mockFetch.mockClear();
  });

  // -------------------------------------------------------------------------
  // Empty / null input
  // -------------------------------------------------------------------------

  describe("empty input", () => {
    test("should return empty array for null items", async () => {
      const result = await fetchAllDocuments(null as any);
      expect(result).toEqual([]);
    });

    test("should return empty array for empty array", async () => {
      const result = await fetchAllDocuments([]);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // type: 'chat' / 'chats'
  // -------------------------------------------------------------------------

  describe("type 'chat'", () => {
    test("should return error when chat is not found", async () => {
      mockState.chatHistory = null;

      const [result] = await fetchAllDocuments([
        { id: "missing-chat", type: "chat", title: "Missing" },
      ]);

      expect(result!.error).toBe("Chat nicht gefunden");
      expect(result!.source).toBe("Chat");
    });

    test("should return formatted content when chat exists", async () => {
      mockState.chatHistory = makeChat({
        title: "My Chat",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      });

      const [result] = await fetchAllDocuments([
        { id: "chat-1", type: "chat", title: "My Chat" },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.source).toBe("Chat");
      expect(result!.content).toContain("My Chat");
      expect(result!.content).toContain("Hello");
      expect(result!.content).toContain("Hi there");
    });

    test("should label user messages as 'Benutzer'", async () => {
      mockState.chatHistory = makeChat({
        messages: [{ role: "user", content: "Question" }],
      });

      const [result] = await fetchAllDocuments([
        { id: "chat-1", type: "chat", title: "T" },
      ]);

      expect(result!.content).toContain("Benutzer");
    });

    test("should label assistant messages as 'Assistent'", async () => {
      mockState.chatHistory = makeChat({
        messages: [{ role: "assistant", content: "Answer" }],
      });

      const [result] = await fetchAllDocuments([
        { id: "chat-1", type: "chat", title: "T" },
      ]);

      expect(result!.content).toContain("Assistent");
    });

    test("should include summary section when chat has a summary", async () => {
      mockState.chatHistory = makeChat({
        summary: "This is the summary",
        messages: [],
      });

      const [result] = await fetchAllDocuments([
        { id: "chat-1", type: "chat", title: "T" },
      ]);

      expect(result!.content).toContain("Zusammenfassung");
      expect(result!.content).toContain("This is the summary");
    });

    test("should work with type 'chats' the same as 'chat'", async () => {
      mockState.chatHistory = makeChat({
        title: "Chats type test",
        messages: [],
      });

      const [result] = await fetchAllDocuments([
        { id: "chat-1", type: "chats", title: "Chats type test" },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.source).toBe("Chat");
    });
  });

  // -------------------------------------------------------------------------
  // type: 'knowledge'
  // -------------------------------------------------------------------------

  describe("type 'knowledge'", () => {
    test("should return error when collection_id is missing from metadata", async () => {
      const [result] = await fetchAllDocuments([
        { id: "doc-1", type: "knowledge", title: "Doc", metadata: {} },
      ]);

      expect(result!.error).toBe("Collection-ID fehlt");
      expect(result!.source).toBe("Knowledge Base");
    });

    test("should return error when metadata is absent", async () => {
      const [result] = await fetchAllDocuments([
        { id: "doc-1", type: "knowledge", title: "Doc" },
      ]);

      expect(result!.error).toBe("Collection-ID fehlt");
    });

    test("should return error when content file does not exist on disk", async () => {
      const [result] = await fetchAllDocuments([
        {
          id: "doc-1",
          type: "knowledge",
          title: "Doc",
          metadata: { collection_id: "col-1" },
        },
      ]);

      expect(result!.error).toBe("Dokument nicht gefunden");
      expect(result!.source).toBe("Knowledge Base");
    });

    test("should return content when file exists using metadata.path", async () => {
      const contentPath =
        "/mock/kb/collections/col-1/documents/my-doc/content.md";
      mockState.files[contentPath] = "# Hello Knowledge";

      const [result] = await fetchAllDocuments([
        {
          id: "doc-1",
          type: "knowledge",
          title: "Doc",
          metadata: { collection_id: "col-1", path: "my-doc" },
        },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("# Hello Knowledge");
      expect(result!.source).toBe("Knowledge Base");
    });

    test("should fall back to item.id as path when metadata.path is absent", async () => {
      const contentPath =
        "/mock/kb/collections/col-1/documents/doc-1/content.md";
      mockState.files[contentPath] = "Fallback content";

      const [result] = await fetchAllDocuments([
        {
          id: "doc-1",
          type: "knowledge",
          title: "Doc",
          metadata: { collection_id: "col-1" },
        },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("Fallback content");
    });

    test("should accept metadata.collectionId as fallback for collection_id", async () => {
      const contentPath =
        "/mock/kb/collections/alt-col/documents/doc-2/content.md";
      mockState.files[contentPath] = "Alt collection content";

      const [result] = await fetchAllDocuments([
        {
          id: "doc-2",
          type: "knowledge",
          title: "Doc",
          metadata: { collectionId: "alt-col" },
        },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("Alt collection content");
    });
  });

  // -------------------------------------------------------------------------
  // type: 'confluence'
  // -------------------------------------------------------------------------

  describe("type 'confluence'", () => {
    test("should return error when no MCP servers are registered", async () => {
      mockState.mcpServers = [];

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.error).toBe("Confluence nicht verbunden");
      expect(result!.source).toBe("Confluence");
    });

    test("should return error when no server name contains 'confluence'", async () => {
      mockState.mcpServers = [
        { id: "s1", name: "jira-server", status: "connected" },
      ];

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.error).toBe("Confluence nicht verbunden");
    });

    test("should return error when confluence server is not connected", async () => {
      mockState.mcpServers = [
        { id: "s1", name: "confluence-cloud", status: "disconnected" },
      ];

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.error).toBe("Confluence nicht verbunden");
    });

    test("should return string content from callTool when server is connected", async () => {
      mockState.mcpServers = [
        { id: "server-1", name: "confluence-cloud", status: "connected" },
      ];
      mockState.mcpToolResult = "# Page content from Confluence";

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("# Page content from Confluence");
      expect(result!.source).toBe("Confluence");
    });

    test("should JSON-stringify non-string tool results", async () => {
      mockState.mcpServers = [
        { id: "server-1", name: "confluence-cloud", status: "connected" },
      ];
      mockState.mcpToolResult = { body: "wiki content" };

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.content).toBe(JSON.stringify({ body: "wiki content" }));
    });

    test("should prefer metadata.pageId over item.id when calling the tool", async () => {
      mockState.mcpServers = [
        { id: "server-1", name: "my-confluence", status: "connected" },
      ];
      mockState.mcpToolResult = "page via metadata pageId";

      const [result] = await fetchAllDocuments([
        {
          id: "item-id",
          type: "confluence",
          title: "Page",
          metadata: { pageId: "override-page-id" },
        },
      ]);

      expect(result!.content).toBe("page via metadata pageId");
    });

    test("should return error with the thrown message when callTool throws", async () => {
      mockState.mcpServers = [
        { id: "server-1", name: "confluence", status: "connected" },
      ];
      mockState.mcpToolThrow = new Error("Tool execution failed");

      const [result] = await fetchAllDocuments([
        { id: "page-1", type: "confluence", title: "Page" },
      ]);

      expect(result!.error).toBe("Tool execution failed");
      expect(result!.source).toBe("Confluence");
    });
  });

  // -------------------------------------------------------------------------
  // type: 'gdrive' — text files via toolRegistry
  // -------------------------------------------------------------------------

  describe("type 'gdrive' (text file via toolRegistry)", () => {
    test("should return error when userId is not provided", async () => {
      const [result] = await fetchAllDocuments([
        { id: "file-1", type: "gdrive", title: "File" },
      ]);

      expect(result!.error).toBe("User-Authentifizierung erforderlich");
      expect(result!.source).toBe("Google Drive");
    });

    test("should return error when tokens are not available", async () => {
      mockState.connectionTokens = null;

      const [result] = await fetchAllDocuments(
        [{ id: "file-1", type: "gdrive", title: "File" }],
        "user-1"
      );

      expect(result!.error).toBe("Nicht mit Google Drive verbunden");
      expect(result!.source).toBe("Google Drive");
    });

    test("should return error when gdrive tool is not in the registry", async () => {
      mockState.connectionTokens = { accessToken: "tok", tokenType: "Bearer" };
      mockState.toolResult = null;

      const [result] = await fetchAllDocuments(
        [
          {
            id: "file-1",
            type: "gdrive",
            title: "File",
            metadata: { mimeType: "text/plain" },
          },
        ],
        "user-1"
      );

      expect(result!.error).toBe("Google Drive Tool nicht verfügbar");
    });

    test("should return content when tool JSON result has a content field", async () => {
      mockState.connectionTokens = { accessToken: "tok", tokenType: "Bearer" };
      mockState.toolResult = {
        execute: async () => JSON.stringify({ content: "Hello from Drive" }),
      };

      const [result] = await fetchAllDocuments(
        [
          {
            id: "file-1",
            type: "gdrive",
            title: "File",
            metadata: { mimeType: "text/plain" },
          },
        ],
        "user-1"
      );

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("Hello from Drive");
      expect(result!.source).toBe("Google Drive");
    });

    test("should return raw string when tool result is not valid JSON", async () => {
      mockState.connectionTokens = { accessToken: "tok", tokenType: "Bearer" };
      mockState.toolResult = {
        execute: async () => "plain text content from gdrive",
      };

      const [result] = await fetchAllDocuments(
        [
          {
            id: "file-1",
            type: "gdrive",
            title: "File",
            metadata: { mimeType: "text/plain" },
          },
        ],
        "user-1"
      );

      expect(result!.content).toBe("plain text content from gdrive");
    });

    test("should return error when JSON has error field but no file.type for Markitdown fallback", async () => {
      mockState.connectionTokens = { accessToken: "tok", tokenType: "Bearer" };
      mockState.toolResult = {
        execute: async () =>
          JSON.stringify({ error: "Cannot read this file" }),
      };

      const [result] = await fetchAllDocuments(
        [
          {
            id: "file-1",
            type: "gdrive",
            title: "File",
            metadata: { mimeType: "text/plain" },
          },
        ],
        "user-1"
      );

      expect(result!.error).toBe("Cannot read this file");
    });

    test("should return error when content field is absent in tool JSON response", async () => {
      mockState.connectionTokens = { accessToken: "tok", tokenType: "Bearer" };
      mockState.toolResult = {
        execute: async () => JSON.stringify({}),
      };

      const [result] = await fetchAllDocuments(
        [
          {
            id: "file-1",
            type: "gdrive",
            title: "File",
            metadata: { mimeType: "text/plain" },
          },
        ],
        "user-1"
      );

      expect(result!.error).toBe("Kein Inhalt von Google Drive erhalten");
    });
  });

  // -------------------------------------------------------------------------
  // type: 'gdrive' — binary files downloaded and converted via Markitdown
  // -------------------------------------------------------------------------

  describe("type 'gdrive' (binary file via Markitdown)", () => {
    const PDF_MIME = "application/pdf";

    beforeEach(() => {
      mockState.connectionTokens = {
        accessToken: "access-token",
        tokenType: "Bearer",
      };
      // Mark temp dir as existing so the mkdir branch is not taken
      mockState.files["/mock/temp"] = "";
    });

    test("should download PDF and convert via Markitdown on success", async () => {
      // 1st fetch: download binary from Google Drive
      mockState.fetchResponses.push({
        ok: true,
        arrayBuffer: new ArrayBuffer(8),
      });
      // 2nd fetch: Markitdown API
      mockState.fetchResponses.push({
        ok: true,
        text: "# Converted PDF content",
      });

      const [result] = await fetchAllDocuments(
        [
          {
            id: "pdf-1",
            type: "gdrive",
            title: "Report.pdf",
            metadata: { fileId: "gdrive-file-id", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("# Converted PDF content");
      expect(result!.source).toBe("Google Drive");
    });

    test("should return error when the Google Drive download fails", async () => {
      mockState.fetchResponses.push({ ok: false, status: 403, text: "Forbidden" });

      const [result] = await fetchAllDocuments(
        [
          {
            id: "pdf-1",
            type: "gdrive",
            title: "Report.pdf",
            metadata: { fileId: "gdrive-file-id", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(result!.error).toContain("Download fehlgeschlagen");
      expect(result!.error).toContain("403");
    });

    test("should return error when Markitdown API responds with a non-ok status", async () => {
      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({
        ok: false,
        status: 500,
        text: "Internal Server Error",
      });

      const [result] = await fetchAllDocuments(
        [
          {
            id: "pdf-1",
            type: "gdrive",
            title: "Report.pdf",
            metadata: { fileId: "gdrive-file-id", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(result!.error).toContain("Markitdown Konvertierung fehlgeschlagen");
      expect(result!.error).toContain("500");
    });

    test("should clean up the temp file after successful conversion", async () => {
      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({ ok: true, text: "Converted content" });

      await fetchAllDocuments(
        [
          {
            id: "pdf-1",
            type: "gdrive",
            title: "Report.pdf",
            metadata: { fileId: "gdrive-file-id", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(mockState.removedFiles.length).toBeGreaterThan(0);
      expect(mockState.removedFiles[0]).toContain("gdrive-file-id");
    });

    test("should clean up the temp file even when Markitdown fails", async () => {
      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({
        ok: false,
        status: 503,
        text: "Service Unavailable",
      });

      await fetchAllDocuments(
        [
          {
            id: "pdf-1",
            type: "gdrive",
            title: "Report.pdf",
            metadata: { fileId: "gdrive-file-id", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(mockState.removedFiles.length).toBeGreaterThan(0);
    });

    test("should use .pdf extension in the temp filename for PDF mime type", async () => {
      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({ ok: true, text: "Converted" });

      await fetchAllDocuments(
        [
          {
            id: "my-pdf",
            type: "gdrive",
            title: "Test",
            metadata: { fileId: "my-pdf", mimeType: "application/pdf" },
          },
        ],
        "user-1"
      );

      const tempPath = mockState.removedFiles[0] ?? "";
      expect(tempPath).toContain(".pdf");
    });

    test("should use .docx extension in the temp filename for DOCX mime type", async () => {
      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({ ok: true, text: "Converted" });

      await fetchAllDocuments(
        [
          {
            id: "my-docx",
            type: "gdrive",
            title: "Test",
            metadata: {
              fileId: "my-docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          },
        ],
        "user-1"
      );

      const tempPath = mockState.removedFiles[0] ?? "";
      expect(tempPath).toContain(".docx");
    });

    test("should create temp dir when it does not exist before writing", async () => {
      // Remove the marker so existsSync returns false for TEMP_DIR
      delete mockState.files["/mock/temp"];

      mockState.fetchResponses.push({ ok: true, arrayBuffer: new ArrayBuffer(4) });
      mockState.fetchResponses.push({ ok: true, text: "Converted" });

      await fetchAllDocuments(
        [
          {
            id: "pdf-2",
            type: "gdrive",
            title: "Doc",
            metadata: { fileId: "pdf-2", mimeType: PDF_MIME },
          },
        ],
        "user-1"
      );

      expect(mockState.mkdirCalls).toContain("/mock/temp");
    });
  });

  // -------------------------------------------------------------------------
  // type: 'contract'
  // -------------------------------------------------------------------------

  describe("type 'contract'", () => {
    test("should return error when contract document file does not exist", async () => {
      const [result] = await fetchAllDocuments([
        { id: "contract-1", type: "contract", title: "Contract" },
      ]);

      expect(result!.error).toBe("Vertragsdokument nicht gefunden");
      expect(result!.source).toBe("Vertragsmanagement");
    });

    test("should return content when contract document file exists", async () => {
      const contractPath =
        "/mock/apps/vertragsmanagement/contracts/contract-1/document.md";
      mockState.files[contractPath] =
        "# Servicevertrag\n\nInhalt des Vertrags";

      const [result] = await fetchAllDocuments([
        { id: "contract-1", type: "contract", title: "Contract" },
      ]);

      expect(result!.error).toBeUndefined();
      expect(result!.content).toBe("# Servicevertrag\n\nInhalt des Vertrags");
      expect(result!.source).toBe("Vertragsmanagement");
    });

    test("should use item.id as the contract ID in the file path", async () => {
      const contractPath =
        "/mock/apps/vertragsmanagement/contracts/contract-abc/document.md";
      mockState.files[contractPath] = "Contract ABC content";

      const [result] = await fetchAllDocuments([
        { id: "contract-abc", type: "contract", title: "Contract ABC" },
      ]);

      expect(result!.content).toBe("Contract ABC content");
    });
  });

  // -------------------------------------------------------------------------
  // Unknown type
  // -------------------------------------------------------------------------

  describe("unknown document type", () => {
    test("should return error for an unrecognised type", async () => {
      const [result] = await fetchAllDocuments([
        { id: "x", type: "unknown-type" as any, title: "X" },
      ]);

      expect(result!.error).toContain("Unbekannter Dokumenttyp");
      expect(result!.error).toContain("unknown-type");
      expect(result!.source).toBe("Unbekannt");
    });
  });

  // -------------------------------------------------------------------------
  // Parallel fetching / result ordering
  // -------------------------------------------------------------------------

  describe("parallel fetching", () => {
    test("should return one result per item, preserving input order", async () => {
      const kbPath1 =
        "/mock/kb/collections/col-1/documents/doc-a/content.md";
      const kbPath2 =
        "/mock/kb/collections/col-2/documents/doc-b/content.md";
      mockState.files[kbPath1] = "Content A";
      mockState.files[kbPath2] = "Content B";

      const results = await fetchAllDocuments([
        {
          id: "doc-a",
          type: "knowledge",
          title: "A",
          metadata: { collection_id: "col-1", path: "doc-a" },
        },
        {
          id: "doc-b",
          type: "knowledge",
          title: "B",
          metadata: { collection_id: "col-2", path: "doc-b" },
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.content).toBe("Content A");
      expect(results[1]!.content).toBe("Content B");
    });

    test("should include results for both successful and failed items", async () => {
      const kbPath =
        "/mock/kb/collections/col-1/documents/good/content.md";
      mockState.files[kbPath] = "Good content";

      const results = await fetchAllDocuments([
        {
          id: "good",
          type: "knowledge",
          title: "Good",
          metadata: { collection_id: "col-1", path: "good" },
        },
        { id: "bad", type: "contract", title: "Missing contract" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.error).toBeUndefined();
      expect(results[1]!.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // DocumentContext shape
  // -------------------------------------------------------------------------

  describe("DocumentContext structure", () => {
    test("should copy id, type, and title from the ReaderItem", async () => {
      const kbPath =
        "/mock/kb/collections/col-1/documents/doc-1/content.md";
      mockState.files[kbPath] = "content";

      const [result] = await fetchAllDocuments([
        {
          id: "doc-1",
          type: "knowledge",
          title: "My Doc",
          metadata: { collection_id: "col-1" },
        },
      ]);

      expect(result!.id).toBe("doc-1");
      expect(result!.type).toBe("knowledge");
      expect(result!.title).toBe("My Doc");
    });
  });
});

// ---------------------------------------------------------------------------
// prepareReaderContexts()
// ---------------------------------------------------------------------------

describe("prepareReaderContexts()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.chatHistory = null;
    mockState.toolResult = null;
    mockState.connectionTokens = null;
    mockState.fetchResponses = [];
  });

  test("should return empty documents and cached=false for empty items", async () => {
    const result = await prepareReaderContexts("session-empty", []);
    expect(result.documents).toEqual([]);
    expect(result.cached).toBe(false);
  });

  test("should return cached=true and the fetched documents on success", async () => {
    const kbPath =
      "/mock/kb/collections/col-1/documents/doc-1/content.md";
    mockState.files[kbPath] = "Some knowledge";

    const result = await prepareReaderContexts("session-prepare-1", [
      {
        id: "doc-1",
        type: "knowledge",
        title: "Doc",
        metadata: { collection_id: "col-1" },
      },
    ]);

    expect(result.cached).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]!.content).toBe("Some knowledge");
  });

  test("should store results so getCachedReaderContexts returns them", async () => {
    const kbPath =
      "/mock/kb/collections/col-1/documents/doc-x/content.md";
    mockState.files[kbPath] = "Cached content";

    await prepareReaderContexts("session-cache-check", [
      {
        id: "doc-x",
        type: "knowledge",
        title: "Cached Doc",
        metadata: { collection_id: "col-1" },
      },
    ]);

    const cached = getCachedReaderContexts("session-cache-check");
    expect(cached).not.toBeNull();
    expect(cached!.length).toBe(1);
    expect(cached![0]!.content).toBe("Cached content");
  });

  test("should cache even documents that returned an error", async () => {
    const result = await prepareReaderContexts("session-errors", [
      { id: "missing-contract", type: "contract", title: "Bad" },
    ]);

    expect(result.cached).toBe(true);
    expect(result.documents[0]!.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getCachedReaderContexts()
// ---------------------------------------------------------------------------

describe("getCachedReaderContexts()", () => {
  test("should return null for an unknown session ID", () => {
    const result = getCachedReaderContexts("completely-unknown-session-xyz");
    expect(result).toBeNull();
  });

  test("should return an array of documents for a session prepared earlier", async () => {
    await prepareReaderContexts("get-cached-test-xyz", [
      { id: "c1", type: "chat", title: "Chat" },
    ]);

    const result = getCachedReaderContexts("get-cached-test-xyz");
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearCachedReaderContexts()
// ---------------------------------------------------------------------------

describe("clearCachedReaderContexts()", () => {
  test("should not throw when called for a non-existent session", () => {
    expect(() =>
      clearCachedReaderContexts("does-not-exist-ever")
    ).not.toThrow();
  });

  test("should remove cached data so a subsequent get returns null", async () => {
    await prepareReaderContexts("session-to-clear-xyz", [
      { id: "c1", type: "chat", title: "Chat" },
    ]);

    clearCachedReaderContexts("session-to-clear-xyz");

    const result = getCachedReaderContexts("session-to-clear-xyz");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cleanupExpiredCaches()
// ---------------------------------------------------------------------------

describe("cleanupExpiredCaches()", () => {
  test("should return 0 when only fresh (non-expired) entries exist", async () => {
    const sessionId = "fresh-session-for-cleanup-xyz";
    await prepareReaderContexts(sessionId, [
      { id: "c1", type: "chat", title: "Chat" },
    ]);

    const cleaned = cleanupExpiredCaches();

    // The freshly-inserted entry must NOT have been removed
    expect(getCachedReaderContexts(sessionId)).not.toBeNull();
    expect(cleaned).toBe(0);

    clearCachedReaderContexts(sessionId);
  });

  test("should return a non-negative integer", () => {
    const count = cleanupExpiredCaches();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// buildReaderContextSection()
// ---------------------------------------------------------------------------

describe("buildReaderContextSection()", () => {
  test("should return empty string for null input", () => {
    expect(buildReaderContextSection(null as any)).toBe("");
  });

  test("should return empty string for empty array", () => {
    expect(buildReaderContextSection([])).toBe("");
  });

  test("should include the document title in the output", () => {
    const result = buildReaderContextSection([
      {
        id: "d1",
        type: "knowledge",
        title: "My Document",
        content: "Content here",
        source: "KB",
      },
    ]);

    expect(result).toContain("My Document");
  });

  test("should include the document source in the output", () => {
    const result = buildReaderContextSection([
      {
        id: "d1",
        type: "knowledge",
        title: "Doc",
        content: "Content",
        source: "Knowledge Base",
      },
    ]);

    expect(result).toContain("Knowledge Base");
  });

  test("should include the document content in the output", () => {
    const result = buildReaderContextSection([
      {
        id: "d1",
        type: "knowledge",
        title: "Doc",
        content: "Important content here",
        source: "KB",
      },
    ]);

    expect(result).toContain("Important content here");
  });

  test("should show FEHLER marker and error message for errored documents", () => {
    const result = buildReaderContextSection([
      {
        id: "d1",
        type: "knowledge",
        title: "Failed Doc",
        content: "",
        source: "KB",
        error: "File not found",
      },
    ]);

    expect(result).toContain("FEHLER");
    expect(result).toContain("File not found");
  });

  test("should not render document content for errored documents", () => {
    const result = buildReaderContextSection([
      {
        id: "d1",
        type: "knowledge",
        title: "Bad",
        content: "SHOULD_NOT_APPEAR",
        source: "KB",
        error: "Something went wrong",
      },
    ]);

    expect(result).not.toContain("SHOULD_NOT_APPEAR");
  });

  test("should number documents starting from 1", () => {
    const result = buildReaderContextSection([
      { id: "d1", type: "chat", title: "First", content: "C1", source: "Chat" },
      { id: "d2", type: "chat", title: "Second", content: "C2", source: "Chat" },
    ]);

    expect(result).toContain("1.");
    expect(result).toContain("2.");
  });

  test("should include the section header about loaded context documents", () => {
    const result = buildReaderContextSection([
      { id: "d1", type: "chat", title: "Doc", content: "Content", source: "Chat" },
    ]);

    expect(result).toContain("Geladene Kontext-Dokumente");
  });

  test("should truncate content longer than 15000 characters", () => {
    const longContent = "x".repeat(20000);
    const result = buildReaderContextSection([
      { id: "d1", type: "knowledge", title: "Big Doc", content: longContent, source: "KB" },
    ]);

    expect(result).toContain("gekürzt");
    expect(result).not.toContain("x".repeat(20000));
  });

  test("should not truncate content at exactly 15000 characters", () => {
    const exactContent = "y".repeat(15000);
    const result = buildReaderContextSection([
      { id: "d1", type: "knowledge", title: "Exact Doc", content: exactContent, source: "KB" },
    ]);

    expect(result).not.toContain("gekürzt");
    expect(result).toContain("y".repeat(15000));
  });

  test("should not truncate content shorter than 15000 characters", () => {
    const result = buildReaderContextSection([
      { id: "d1", type: "knowledge", title: "Short Doc", content: "Short content", source: "KB" },
    ]);

    expect(result).not.toContain("gekürzt");
  });

  test("should handle multiple documents mixing success and error entries", () => {
    const docs = [
      { id: "d1", type: "chat", title: "Alpha", content: "Alpha content", source: "Chat" },
      { id: "d2", type: "knowledge", title: "Beta", content: "Beta content", source: "KB" },
      {
        id: "d3",
        type: "contract",
        title: "Gamma",
        content: "",
        source: "Vertragsmanagement",
        error: "Missing document",
      },
    ];

    const result = buildReaderContextSection(docs);

    expect(result).toContain("Alpha");
    expect(result).toContain("Beta");
    expect(result).toContain("Gamma");
    expect(result).toContain("FEHLER");
    expect(result).toContain("Missing document");
  });

  test("should include the prioritisation section in the output", () => {
    const result = buildReaderContextSection([
      { id: "d1", type: "chat", title: "Doc", content: "Content", source: "Chat" },
    ]);

    expect(result).toContain("PRIORISIERUNG");
  });
});
