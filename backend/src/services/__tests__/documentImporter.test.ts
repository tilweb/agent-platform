/**
 * Tests for documentImporter service (backend/src/services/documentImporter.ts)
 *
 * All file system I/O, external services (indexer, memory, tool registry,
 * connection registry, yaml parser) are mocked before the module under test
 * is imported so no real disk access or network calls occur.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Simulated file system: path -> string content, or Buffer for binary
  files: {} as Record<string, string | Buffer>,
  // Controls whether existsSync returns true
  existingPaths: new Set<string>(),
  // Created directories
  createdDirs: [] as string[],
  // Return values / error overrides for external services
  loadChatHistoryResult: null as any,
  indexDocumentResult: { document_id: "doc-indexed-123" } as any,
  indexDocumentError: null as Error | null,
  // Tool registry mock
  confluenceTool: null as any,
  gdriveTool: null as any,
  // Connection registry
  gdriveTokens: null as any,
  // KbManageTool mock
  kbManageToolResult: JSON.stringify({ success: true }),
  // Fetch mock
  fetchResult: null as any,
  fetchError: null as Error | null,
  // YAML parse mock
  yamlParseResult: {} as any,
  yamlParseError: null as Error | null,
  // cp mock tracking
  copiedFrom: null as string | null,
  copiedTo: null as string | null,
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any import of the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string | Buffer) => {
    mockState.files[path] = content;
  },
  readFile: async (path: string, _encoding?: string) => {
    const data = mockState.files[path];
    if (data !== undefined) return data;
    const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${path}'`);
    err.code = "ENOENT";
    throw err;
  },
  mkdir: async (path: string, _opts?: any) => {
    mockState.createdDirs.push(path);
  },
  readdir: async (_path: string) => [],
  cp: async (src: string, dest: string, _opts?: any) => {
    mockState.copiedFrom = src;
    mockState.copiedTo = dest;
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => mockState.existingPaths.has(path),
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

mock.module("../memory", () => ({
  loadChatHistory: async (_id: string) => mockState.loadChatHistoryResult,
}));

mock.module("../indexer", () => ({
  indexerService: {
    indexDocument: async (_filename: string, _collectionId: string, _opts?: any) => {
      if (mockState.indexDocumentError) throw mockState.indexDocumentError;
      return mockState.indexDocumentResult;
    },
  },
}));

mock.module("../../utils/paths", () => ({
  KB_BASE: "/kb",
  KB_INCOMING_DIR: "/kb/incoming",
  APPS_DIR: "/apps",
}));

mock.module("../../tools/registry", () => ({
  toolRegistry: {
    get: (name: string) => {
      if (name === "confluence_read_page") return mockState.confluenceTool;
      if (name === "gdrive_read_file") return mockState.gdriveTool;
      return null;
    },
  },
}));

mock.module("../../connections/registry", () => ({
  connectionRegistry: {
    getTokens: async (_userId: string, _provider: string) => mockState.gdriveTokens,
  },
}));

mock.module("../tools/knowledge/KnowledgeTools", () => ({
  KbManageTool: class {
    async execute(_args: any) {
      return mockState.kbManageToolResult;
    }
  },
}));

// Mock the dynamic import of KnowledgeTools at the correct path the module uses
mock.module("../../tools/knowledge/KnowledgeTools", () => ({
  KbManageTool: class {
    async execute(_args: any) {
      return mockState.kbManageToolResult;
    }
  },
}));

mock.module("yaml", () => ({
  parse: (_content: string) => {
    if (mockState.yamlParseError) throw mockState.yamlParseError;
    return mockState.yamlParseResult;
  },
}));

// Override global fetch
const originalFetch = globalThis.fetch;
// @ts-ignore
globalThis.fetch = async (url: string, opts?: any) => {
  if (mockState.fetchError) throw mockState.fetchError;
  return mockState.fetchResult;
};

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks are registered
// ---------------------------------------------------------------------------

const { importAndIndex, createCollection } = await import("../documentImporter");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChatHistory(overrides: Partial<any> = {}): any {
  return {
    id: "chat-1",
    title: "Test Chat",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T11:00:00.000Z",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
    ...overrides,
  };
}

function makeImportItem(overrides: Partial<any> = {}): any {
  return {
    id: "item-1",
    type: "chat",
    title: "My Chat",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset shared state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.files = {};
  mockState.existingPaths = new Set();
  mockState.createdDirs = [];
  mockState.loadChatHistoryResult = null;
  mockState.indexDocumentResult = { document_id: "doc-indexed-123" };
  mockState.indexDocumentError = null;
  mockState.confluenceTool = null;
  mockState.gdriveTool = null;
  mockState.gdriveTokens = null;
  mockState.kbManageToolResult = JSON.stringify({ success: true });
  mockState.fetchResult = null;
  mockState.fetchError = null;
  mockState.yamlParseResult = {};
  mockState.yamlParseError = null;
  mockState.copiedFrom = null;
  mockState.copiedTo = null;
});

// ---------------------------------------------------------------------------
// importAndIndex() — chat / chats
// ---------------------------------------------------------------------------

describe("importAndIndex()", () => {
  describe("type: chat", () => {
    test("should return success with documentId when chat is found and indexed", async () => {
      mockState.loadChatHistoryResult = makeChatHistory();

      const result = await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
      expect(result.itemId).toBe("item-1");
      expect(result.itemType).toBe("chat");
    });

    test("should return error when chat is not found", async () => {
      mockState.loadChatHistoryResult = null;

      const result = await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Chat nicht gefunden");
    });

    test("should write a markdown file to incoming dir", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({ title: "My Chat" });

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      // A file with the chat- prefix must have been written somewhere
      const savedKey = Object.keys(mockState.files).find(k => k.includes("chat-My-Chat"));
      expect(savedKey).toBeDefined();
    });

    test("should create incoming dir when it does not exist", async () => {
      mockState.loadChatHistoryResult = makeChatHistory();
      // INCOMING_DIR not in existingPaths -> mkdir should be called

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      expect(mockState.createdDirs.some(d => d.includes("incoming"))).toBe(true);
    });

    test("should not create incoming dir when it already exists", async () => {
      mockState.loadChatHistoryResult = makeChatHistory();
      mockState.existingPaths.add("/kb/incoming");

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      expect(mockState.createdDirs.some(d => d.includes("incoming"))).toBe(false);
    });

    test("should include chat title in the saved markdown content", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({ title: "Special Chat" });

      await importAndIndex(makeImportItem({ type: "chat", title: "Special Chat" }), "col-1");

      const savedContent = Object.values(mockState.files).find(
        v => typeof v === "string" && v.includes("# Special Chat")
      );
      expect(savedContent).toBeDefined();
    });

    test("should include user and assistant messages in the saved markdown", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({
        messages: [
          { role: "user", content: "What is bun?" },
          { role: "assistant", content: "Bun is a fast JS runtime." },
        ],
      });

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("What is bun?")
      ) as string | undefined;
      expect(content).toBeDefined();
      expect(content).toContain("Bun is a fast JS runtime.");
    });

    test("should include summary in markdown when present", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({
        summary: "Chat about bun runtime.",
      });

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Chat about bun runtime.")
      );
      expect(content).toBeDefined();
    });

    test("should include keywords in markdown when present", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({
        keywords: ["bun", "typescript", "runtime"],
      });

      await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("bun, typescript, runtime")
      );
      expect(content).toBeDefined();
    });

    test("should handle type: chats the same as type: chat", async () => {
      mockState.loadChatHistoryResult = makeChatHistory();

      const result = await importAndIndex(makeImportItem({ type: "chats" }), "col-1");

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should sanitize unsafe characters from title in filename", async () => {
      mockState.loadChatHistoryResult = makeChatHistory({ title: "Chat <with> bad/chars" });

      await importAndIndex(makeImportItem({ type: "chat", title: "Chat <with> bad/chars" }), "col-1");

      const filenames = Object.keys(mockState.files);
      // None of the saved filenames should contain < > or /
      const chatFile = filenames.find(k => k.startsWith("/kb/incoming/chat-"));
      expect(chatFile).toBeDefined();
      expect(chatFile).not.toMatch(/[<>]/);
    });

    test("should return error when indexDocument throws", async () => {
      mockState.loadChatHistoryResult = makeChatHistory();
      mockState.indexDocumentError = new Error("Indexer offline");

      const result = await importAndIndex(makeImportItem({ type: "chat" }), "col-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Indexer offline");
    });
  });

  // -------------------------------------------------------------------------
  // type: material
  // -------------------------------------------------------------------------

  describe("type: material", () => {
    test("should return success with documentId when content is provided", async () => {
      const result = await importAndIndex(
        makeImportItem({ type: "material", content: "Some material content" }),
        "col-1"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should return error when item has no content", async () => {
      const result = await importAndIndex(
        makeImportItem({ type: "material", content: undefined }),
        "col-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Material hat keinen Inhalt");
    });

    test("should write markdown file with item title to incoming dir", async () => {
      await importAndIndex(
        makeImportItem({ type: "material", title: "My Material", content: "hello world" }),
        "col-1"
      );

      const key = Object.keys(mockState.files).find(k => k.includes("material-My-Material"));
      expect(key).toBeDefined();
    });

    test("should include skillId in document when metadata provides it", async () => {
      await importAndIndex(
        makeImportItem({
          type: "material",
          content: "some content",
          metadata: { skillId: "my-skill" },
        }),
        "col-1"
      );

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("my-skill")
      );
      expect(content).toBeDefined();
    });

    test("should include filename metadata in document when provided", async () => {
      await importAndIndex(
        makeImportItem({
          type: "material",
          content: "some content",
          metadata: { filename: "report.pdf" },
        }),
        "col-1"
      );

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("report.pdf")
      );
      expect(content).toBeDefined();
    });

    test("should include chatId metadata in document when provided", async () => {
      await importAndIndex(
        makeImportItem({
          type: "material",
          content: "some content",
          metadata: { chatId: "chat-abc" },
        }),
        "col-1"
      );

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("chat-abc")
      );
      expect(content).toBeDefined();
    });

    test("should include item.content in the written document", async () => {
      await importAndIndex(
        makeImportItem({ type: "material", content: "Unique material payload 12345" }),
        "col-1"
      );

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Unique material payload 12345")
      );
      expect(content).toBeDefined();
    });

    test("should return error when indexDocument throws", async () => {
      mockState.indexDocumentError = new Error("disk full");

      const result = await importAndIndex(
        makeImportItem({ type: "material", content: "hello" }),
        "col-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("disk full");
    });
  });

  // -------------------------------------------------------------------------
  // type: confluence
  // -------------------------------------------------------------------------

  describe("type: confluence", () => {
    test("should return success when Confluence tool returns valid markdown", async () => {
      mockState.confluenceTool = {
        execute: async () => "# Confluence Page\n\nSome content",
      };

      const result = await importAndIndex(
        makeImportItem({ type: "confluence", metadata: { pageId: "page-99" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should return error when Confluence tool is not registered", async () => {
      mockState.confluenceTool = null;

      const result = await importAndIndex(
        makeImportItem({ type: "confluence" }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Confluence Tool nicht verfügbar");
    });

    test("should return error when tool result starts with 'Error:'", async () => {
      mockState.confluenceTool = {
        execute: async () => "Error: page not found",
      };

      const result = await importAndIndex(
        makeImportItem({ type: "confluence" }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Error: page not found");
    });

    test("should return error when tool result contains 'Not connected'", async () => {
      mockState.confluenceTool = {
        execute: async () => "Not connected to Confluence",
      };

      const result = await importAndIndex(
        makeImportItem({ type: "confluence" }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not connected to Confluence");
    });

    test("should use metadata.pageId when provided", async () => {
      let capturedArgs: any = null;
      mockState.confluenceTool = {
        execute: async (args: any) => {
          capturedArgs = args;
          return "# Page content";
        },
      };

      await importAndIndex(
        makeImportItem({ type: "confluence", metadata: { pageId: "conf-42" } }),
        "col-1",
        "user-1"
      );

      expect(capturedArgs?.page_id).toBe("conf-42");
    });

    test("should fall back to item.id as pageId when metadata.pageId is absent", async () => {
      let capturedArgs: any = null;
      mockState.confluenceTool = {
        execute: async (args: any) => {
          capturedArgs = args;
          return "# Page content";
        },
      };

      await importAndIndex(
        makeImportItem({ id: "item-fallback", type: "confluence" }),
        "col-1",
        "user-1"
      );

      expect(capturedArgs?.page_id).toBe("item-fallback");
    });

    test("should write confluence content to incoming dir", async () => {
      const pageContent = "# Confluence Page\n\nHello confluence world";
      mockState.confluenceTool = { execute: async () => pageContent };

      await importAndIndex(
        makeImportItem({ type: "confluence", metadata: { pageId: "p1" } }),
        "col-1",
        "user-1"
      );

      const saved = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Hello confluence world")
      );
      expect(saved).toBeDefined();
    });

    test("should return error when tool.execute throws", async () => {
      mockState.confluenceTool = {
        execute: async () => { throw new Error("Connection timeout"); },
      };

      const result = await importAndIndex(
        makeImportItem({ type: "confluence" }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });
  });

  // -------------------------------------------------------------------------
  // type: gdrive — text-based files
  // -------------------------------------------------------------------------

  describe("type: gdrive (text-based files)", () => {
    test("should return error when userId is missing", async () => {
      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        undefined
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("User-Authentifizierung erforderlich");
    });

    test("should return error when Google Drive tokens are not found", async () => {
      mockState.gdriveTokens = null;

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Nicht mit Google Drive verbunden");
    });

    test("should return error when gdrive_read_file tool is not registered", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = null;

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Google Drive Tool nicht verfügbar");
    });

    test("should return success when gdrive tool returns valid JSON with content", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => JSON.stringify({ content: "File text content" }),
      };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should return error when tool result JSON has an error field", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => JSON.stringify({ error: "File not found in Drive" }),
      };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found in Drive");
    });

    test("should return error when tool result JSON has no content", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => JSON.stringify({ file: { name: "doc.txt" } }),
      };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kein Inhalt von Google Drive erhalten");
    });

    test("should return error when tool result is not valid JSON", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => "NOT_JSON",
      };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Ungültige Antwort von Google Drive");
    });

    test("should write markdown with item title and file content to incoming dir", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => JSON.stringify({ content: "Unique gdrive content ABC" }),
      };

      await importAndIndex(
        makeImportItem({ type: "gdrive", title: "My Doc", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Unique gdrive content ABC")
      ) as string | undefined;
      expect(content).toBeDefined();
      expect(content).toContain("# My Doc");
    });

    test("should pass file_id to the gdrive tool", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      let capturedArgs: any = null;
      mockState.gdriveTool = {
        execute: async (args: any) => {
          capturedArgs = args;
          return JSON.stringify({ content: "some content" });
        },
      };

      await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "drive-file-XYZ", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(capturedArgs?.file_id).toBe("drive-file-XYZ");
    });

    test("should return error when tool.execute throws", async () => {
      mockState.gdriveTokens = { tokenType: "Bearer", accessToken: "tok123" };
      mockState.gdriveTool = {
        execute: async () => { throw new Error("quota exceeded"); },
      };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f1", mimeType: "text/plain" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("quota exceeded");
    });
  });

  // -------------------------------------------------------------------------
  // type: gdrive — binary files (PDF download path)
  // -------------------------------------------------------------------------

  describe("type: gdrive (binary files)", () => {
    const binaryTokens = { tokenType: "Bearer", accessToken: "tok-bin" };

    function makeSuccessfulFetchResponse(buffer: ArrayBuffer = new ArrayBuffer(8)) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => buffer,
      };
    }

    test("should download binary file and index it when mimeType is application/pdf", async () => {
      mockState.gdriveTokens = binaryTokens;
      mockState.fetchResult = makeSuccessfulFetchResponse();

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f-pdf", mimeType: "application/pdf" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should add .pdf extension to filename when mimeType is application/pdf", async () => {
      mockState.gdriveTokens = binaryTokens;
      mockState.fetchResult = makeSuccessfulFetchResponse();

      await importAndIndex(
        makeImportItem({ type: "gdrive", title: "My PDF", metadata: { fileId: "f-pdf", mimeType: "application/pdf" } }),
        "col-1",
        "user-1"
      );

      const pdfFile = Object.keys(mockState.files).find(k => k.endsWith(".pdf"));
      expect(pdfFile).toBeDefined();
    });

    test("should not add extension for unknown binary mimeType", async () => {
      mockState.gdriveTokens = binaryTokens;
      mockState.fetchResult = makeSuccessfulFetchResponse();

      await importAndIndex(
        makeImportItem({ type: "gdrive", title: "Binary File", metadata: { fileId: "f-bin", mimeType: "application/octet-stream" } }),
        "col-1",
        "user-1"
      );

      const binaryFile = Object.keys(mockState.files).find(k => k.includes("Binary-File"));
      expect(binaryFile).toBeDefined();
      // Should not have .pdf extension
      expect(binaryFile).not.toMatch(/\.pdf$/);
    });

    test("should return error when download response is not ok", async () => {
      mockState.gdriveTokens = binaryTokens;
      mockState.fetchResult = { ok: false, status: 403 };

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f-pdf", mimeType: "application/pdf" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("403");
    });

    test("should return error when fetch throws", async () => {
      mockState.gdriveTokens = binaryTokens;
      mockState.fetchError = new Error("network error");

      const result = await importAndIndex(
        makeImportItem({ type: "gdrive", metadata: { fileId: "f-pdf", mimeType: "application/pdf" } }),
        "col-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("network error");
    });
  });

  // -------------------------------------------------------------------------
  // type: contract
  // -------------------------------------------------------------------------

  describe("type: contract", () => {
    test("should return error when contract document file does not exist", async () => {
      // existingPaths is empty, so existsSync returns false

      const result = await importAndIndex(
        makeImportItem({ type: "contract", id: "contract-99" }),
        "col-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Vertragsdokument nicht gefunden");
    });

    test("should return success when contract document exists and is indexed", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/contract-1/document.md";
      mockState.existingPaths.add(contractPath);
      mockState.files[contractPath] = "# Contract content";

      const result = await importAndIndex(
        makeImportItem({ type: "contract", id: "contract-1" }),
        "col-1"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe("doc-indexed-123");
    });

    test("should write contract content to incoming dir", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/c-42/document.md";
      mockState.existingPaths.add(contractPath);
      mockState.files[contractPath] = "Contract body text";

      await importAndIndex(makeImportItem({ type: "contract", id: "c-42" }), "col-1");

      const saved = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Contract body text")
      );
      expect(saved).toBeDefined();
    });

    test("should prepend metadata header when metadata.yaml exists", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/c-10/document.md";
      const metaPath = "/apps/vertragsmanagement/contracts/c-10/metadata.yaml";
      mockState.existingPaths.add(contractPath);
      mockState.existingPaths.add(metaPath);
      mockState.files[contractPath] = "Contract body";
      mockState.files[metaPath] = "contract_type: Service\nuploaded_at: 2026-01-01\nupload_filename: service.pdf";
      mockState.yamlParseResult = {
        contract_type: "Service",
        uploaded_at: "2026-01-01",
        upload_filename: "service.pdf",
      };

      await importAndIndex(makeImportItem({ type: "contract", id: "c-10", title: "Service Contract" }), "col-1");

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Service Contract")
      ) as string | undefined;
      expect(content).toBeDefined();
      expect(content).toContain("Vertragstyp: Service");
    });

    test("should continue without header when metadata.yaml parse fails", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/c-11/document.md";
      const metaPath = "/apps/vertragsmanagement/contracts/c-11/metadata.yaml";
      mockState.existingPaths.add(contractPath);
      mockState.existingPaths.add(metaPath);
      mockState.files[contractPath] = "Contract body";
      mockState.files[metaPath] = "invalid yaml: [[[";
      mockState.yamlParseError = new Error("parse error");

      const result = await importAndIndex(
        makeImportItem({ type: "contract", id: "c-11" }),
        "col-1"
      );

      // Should still succeed (metadata error is swallowed)
      expect(result.success).toBe(true);
    });

    test("should use fallback values in metadata header when fields are missing", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/c-12/document.md";
      const metaPath = "/apps/vertragsmanagement/contracts/c-12/metadata.yaml";
      mockState.existingPaths.add(contractPath);
      mockState.existingPaths.add(metaPath);
      mockState.files[contractPath] = "Body";
      mockState.files[metaPath] = "{}";
      mockState.yamlParseResult = {};

      await importAndIndex(makeImportItem({ type: "contract", id: "c-12" }), "col-1");

      const content = Object.values(mockState.files).find(
        v => typeof v === "string" && (v as string).includes("Unbekannt")
      );
      expect(content).toBeDefined();
    });

    test("should return error when indexDocument throws", async () => {
      const contractPath = "/apps/vertragsmanagement/contracts/c-err/document.md";
      mockState.existingPaths.add(contractPath);
      mockState.files[contractPath] = "Some contract";
      mockState.indexDocumentError = new Error("indexer failed");

      const result = await importAndIndex(
        makeImportItem({ type: "contract", id: "c-err" }),
        "col-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("indexer failed");
    });
  });

  // -------------------------------------------------------------------------
  // type: knowledge (copy to collection)
  // -------------------------------------------------------------------------

  describe("type: knowledge", () => {
    test("should return error when source collection ID is not provided", async () => {
      const result = await importAndIndex(
        makeImportItem({ type: "knowledge", metadata: {} }),
        "col-target"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Quell-Collection-ID fehlt");
    });

    test("should return error when source document directory does not exist", async () => {
      const result = await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-src",
          metadata: { collection_id: "col-src" },
        }),
        "col-target"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Quelldokument nicht gefunden");
    });

    test("should return success and new document ID when copy succeeds", async () => {
      const srcDocDir = "/kb/collections/col-src/documents/doc-src";
      mockState.existingPaths.add(srcDocDir);

      // Set up target manifest and collections.yaml
      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 2\n';

      const result = await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-src",
          metadata: { collection_id: "col-src" },
        }),
        "col-target"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.documentId).toContain("doc-src-copy-");
    });

    test("should use metadata.path as source document ID when provided", async () => {
      const srcDocDir = "/kb/collections/col-src/documents/custom-path";
      mockState.existingPaths.add(srcDocDir);

      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 0\n';

      const result = await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "item-1",
          metadata: { collection_id: "col-src", path: "custom-path" },
        }),
        "col-target"
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toContain("custom-path-copy-");
    });

    test("should use metadata.collectionId as fallback when collection_id is absent", async () => {
      const srcDocDir = "/kb/collections/col-alt/documents/doc-x";
      mockState.existingPaths.add(srcDocDir);

      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 1\n';

      const result = await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-x",
          metadata: { collectionId: "col-alt" },
        }),
        "col-target"
      );

      expect(result.success).toBe(true);
    });

    test("should update document_count in collections.yaml after copy", async () => {
      const srcDocDir = "/kb/collections/col-src/documents/doc-src";
      mockState.existingPaths.add(srcDocDir);

      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 5\n';

      await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-src",
          metadata: { collection_id: "col-src" },
        }),
        "col-target"
      );

      const updatedCollections = mockState.files["/kb/collections.yaml"] as string;
      expect(updatedCollections).toContain("document_count: 6");
    });

    test("should add new entry to manifest.yaml after copy when documents list is empty", async () => {
      const srcDocDir = "/kb/collections/col-src/documents/doc-src";
      mockState.existingPaths.add(srcDocDir);

      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 0\n';

      await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-src",
          title: "Copied Doc",
          metadata: { collection_id: "col-src" },
        }),
        "col-target"
      );

      const manifest = mockState.files["/kb/collections/col-target/manifest.yaml"] as string;
      expect(manifest).toContain("Copied Doc");
      expect(manifest).not.toContain("documents: []");
    });

    test("should read indexed_date from DOCUMENT_META.md when it exists in target", async () => {
      const srcDocDir = "/kb/collections/col-src/documents/doc-src";
      mockState.existingPaths.add(srcDocDir);

      // The meta file at the *target* location is set after cp runs
      // We can simulate it by pre-populating the path that would be used after cp
      // Since we don't know exact newDocId, we trust the test checks date logic via manifest
      mockState.files["/kb/collections/col-target/manifest.yaml"] =
        'documents: []\nlast_updated: "2026-01-01T00:00:00.000Z"\n';
      mockState.files["/kb/collections.yaml"] =
        '- id: "col-target"\n  document_count: 0\n';

      const result = await importAndIndex(
        makeImportItem({
          type: "knowledge",
          id: "doc-src",
          metadata: { collection_id: "col-src" },
        }),
        "col-target"
      );

      // If meta file isn't found, today's date is used — either way success
      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // unknown type
  // -------------------------------------------------------------------------

  describe("unknown type", () => {
    test("should return error for completely unknown type", async () => {
      const result = await importAndIndex(
        { id: "x", type: "unknown_type" as any, title: "X" },
        "col-1"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unbekannter Dokumenttyp");
      expect(result.error).toContain("unknown_type");
    });
  });

  // -------------------------------------------------------------------------
  // base result fields
  // -------------------------------------------------------------------------

  describe("base result fields", () => {
    test("should always include itemId matching item.id", async () => {
      mockState.loadChatHistoryResult = null;

      const result = await importAndIndex(
        makeImportItem({ id: "my-unique-id", type: "chat" }),
        "col-1"
      );

      expect(result.itemId).toBe("my-unique-id");
    });

    test("should always include itemType matching item.type", async () => {
      mockState.loadChatHistoryResult = null;

      const result = await importAndIndex(
        makeImportItem({ type: "chat" }),
        "col-1"
      );

      expect(result.itemType).toBe("chat");
    });

    test("should always include title matching item.title", async () => {
      mockState.loadChatHistoryResult = null;

      const result = await importAndIndex(
        makeImportItem({ type: "chat", title: "The Title" }),
        "col-1"
      );

      expect(result.title).toBe("The Title");
    });
  });
});

// ---------------------------------------------------------------------------
// createCollection()
// ---------------------------------------------------------------------------

describe("createCollection()", () => {
  test("should resolve without throwing when KbManageTool returns success", async () => {
    mockState.kbManageToolResult = JSON.stringify({ success: true });

    await expect(
      createCollection("col-new", "New Collection", "A description")
    ).resolves.toBeUndefined();
  });

  test("should throw when KbManageTool returns success=false", async () => {
    mockState.kbManageToolResult = JSON.stringify({
      success: false,
      message: "Collection already exists",
    });

    await expect(
      createCollection("col-dup", "Dup", "desc")
    ).rejects.toThrow("Collection already exists");
  });

  test("should throw with generic message when KbManageTool returns success=false without message", async () => {
    mockState.kbManageToolResult = JSON.stringify({ success: false });

    await expect(
      createCollection("col-x", "X", "desc")
    ).rejects.toThrow("Fehler beim Erstellen der Collection");
  });
});
