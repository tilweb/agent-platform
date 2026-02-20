/**
 * Tests for IndexerService (backend/src/services/indexer.ts)
 *
 * All file system, fetch, Bun.file, and LLM dependencies are mocked so no
 * real I/O or network calls occur. Mocks must be registered BEFORE the module
 * under test is imported (bun:test executes top-level mock.module() calls
 * before the module graph is resolved).
 *
 * globalThis.fetch is intercepted with spyOn so that Bun's readonly global
 * does not need to be reassigned. Bun.file is handled equivalently.
 *
 * Path notes:
 *   - This file is at  src/services/__tests__/indexer.test.ts
 *   - indexer.ts is at src/services/indexer.ts  → mock specifier "../indexer"
 *   - llm.ts is at     src/services/llm.ts      → mock specifier "../llm"
 *   - paths.ts is at   src/utils/paths.ts       → mock specifier "../../utils/paths"
 */

import { test, expect, describe, mock, beforeEach, spyOn } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  files: {} as Record<string, string>,
  existingDirs: new Set<string>(),
  createdDirs: [] as string[],
  fetchResponse: {
    ok: true,
    status: 200,
    text: "# Converted Markdown",
    errorText: "",
  },
  llmChunks: [] as Array<{ choices: Array<{ delta: { content?: string } }> }>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE dynamic import of the module under test
// ---------------------------------------------------------------------------

const fspFactory = () => ({
  readFile: async (path: string, _encoding?: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, open '${path}'`,
    );
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (path: string, content: string, _encoding?: string) => {
    mockState.files[path] = content;
  },
  mkdir: async (path: string, _opts?: unknown) => {
    mockState.createdDirs.push(path as string);
  },
});
mock.module("fs/promises", fspFactory);
mock.module("node:fs/promises", fspFactory);

const fsFactory = () => ({
  existsSync: (path: string) =>
    mockState.existingDirs.has(path) || mockState.files[path] !== undefined,
});
mock.module("fs", fsFactory);
mock.module("node:fs", fsFactory);

// Provide all path helpers used by the indexer AND by paths.ts (which imports resolve).
const pathMockObj = {
  join: (...parts: string[]) => parts.join("/"),
  resolve: (...parts: string[]) => parts.join("/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
  basename: (p: string, ext?: string) => {
    const base = p.split("/").pop() ?? p;
    if (ext && base.endsWith(ext)) {
      return base.slice(0, base.length - ext.length);
    }
    return base;
  },
  extname: (p: string) => {
    const match = p.match(/(\.[^.]+)$/);
    return match ? match[1]! : "";
  },
  sep: "/",
  delimiter: ":",
  default: undefined as any,
};
pathMockObj.default = pathMockObj;

mock.module("path", () => pathMockObj);
mock.module("node:path", () => pathMockObj);

// paths.ts lives at src/utils/paths.ts.
// From src/services/__tests__/ the correct relative specifier is "../../utils/paths".
mock.module("../../utils/paths", () => ({
  KB_BASE: "/kb",
  KB_INCOMING_DIR: "/incoming",
  MARKITDOWN_API_URL: "https://markitdown.example.com/convert",
  MARKITDOWN_API_KEY: "test-api-key",
}));

// Mock the LLM service — llm.ts is at src/services/llm.ts → specifier "../llm".
mock.module("../llm", () => ({
  llmService: {
    streamChat: async function* (
      _messages: unknown,
      _tools: unknown,
      _ctx: unknown,
    ) {
      for (const chunk of mockState.llmChunks) {
        yield chunk;
      }
    },
  },
}));

// ---------------------------------------------------------------------------
// Spy on globalThis.fetch so we can intercept Markitdown API calls without
// reassigning the readonly global property.
// ---------------------------------------------------------------------------

const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
  async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    if (!mockState.fetchResponse.ok) {
      return {
        ok: false,
        status: mockState.fetchResponse.status,
        text: async () => mockState.fetchResponse.errorText,
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      text: async () => mockState.fetchResponse.text,
    } as unknown as Response;
  },
);

// Spy on Bun.file to intercept multipart payload construction without
// reassigning the readonly Bun global.
const bunFileSpy = spyOn(Bun, "file").mockImplementation((_path: string) => {
  return new Blob(["fake file content"], {
    type: "application/octet-stream",
  }) as BunFile;
});

// ---------------------------------------------------------------------------
// Import the service AFTER all mocks are registered
// ---------------------------------------------------------------------------

const { indexerService } = await import("../indexer");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Set up a minimal single-chunk LLM response */
function setLlmResponse(text: string) {
  mockState.llmChunks = [{ choices: [{ delta: { content: text } }] }];
}

/** Pre-populate the collection directory so existsSync returns true */
function createCollection(collectionId: string) {
  mockState.existingDirs.add(`/kb/collections/${collectionId}`);
}

/** Pre-populate the incoming directory with a simulated file entry */
function createIncomingFile(fileName: string, content: string) {
  mockState.existingDirs.add(`/incoming/${fileName}`);
  mockState.files[`/incoming/${fileName}`] = content;
}

/** Write a manifest.yaml for a collection into the mock file system */
function createManifest(collectionId: string, body: string) {
  mockState.files[`/kb/collections/${collectionId}/manifest.yaml`] = body;
}

/** Write a collections.yaml into the mock file system */
function createCollectionsYaml(body: string) {
  mockState.files["/kb/collections.yaml"] = body;
}

/** Fully wire up all prerequisites for a successful indexDocument() call */
function setupSuccessfulIndex(
  fileName: string,
  content: string,
  collectionId: string,
) {
  createCollection(collectionId);
  createIncomingFile(fileName, content);
  createManifest(
    collectionId,
    `documents: []\nlast_updated: "2026-01-01"\n`,
  );
  createCollectionsYaml(
    `- id: "${collectionId}"\n  document_count: 0\n`,
  );
  setLlmResponse("# DOCUMENT_META\n- **Titel:** Test\n");
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("IndexerService", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.existingDirs = new Set();
    mockState.createdDirs = [];
    mockState.fetchResponse = {
      ok: true,
      status: 200,
      text: "# Converted Markdown",
      errorText: "",
    };
    mockState.llmChunks = [];
    fetchSpy.mockClear();
    bunFileSpy.mockClear();
  });

  // =========================================================================
  // convertDocument()
  // =========================================================================

  describe("convertDocument()", () => {
    test("should throw when the file does not exist in the incoming directory", async () => {
      await expect(
        indexerService.convertDocument("missing.pdf"),
      ).rejects.toThrow("Datei nicht gefunden: missing.pdf");
    });

    test("should read .md file directly without calling the Markitdown API", async () => {
      createIncomingFile("doc.md", "# Hello World");

      const result = await indexerService.convertDocument("doc.md");

      expect(result).toBe("# Hello World");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("should read .txt file directly without calling the Markitdown API", async () => {
      createIncomingFile("notes.txt", "plain text content");

      const result = await indexerService.convertDocument("notes.txt");

      expect(result).toBe("plain text content");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("should call the Markitdown API for non-markdown files and return its output", async () => {
      createIncomingFile("report.pdf", "binary");
      mockState.fetchResponse.text = "# PDF Converted";

      const result = await indexerService.convertDocument("report.pdf");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe("# PDF Converted");
    });

    test("should call the Markitdown API with PUT method and correct Authorization header", async () => {
      createIncomingFile("file.docx", "binary");

      await indexerService.convertDocument("file.docx");

      const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("PUT");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer test-api-key",
      );
    });

    test("should call the Markitdown API with the configured URL", async () => {
      createIncomingFile("slide.pptx", "binary");

      await indexerService.convertDocument("slide.pptx");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://markitdown.example.com/convert");
    });

    test("should throw a descriptive error when the Markitdown API returns a non-ok status", async () => {
      createIncomingFile("bad.xlsx", "binary");
      mockState.fetchResponse.ok = false;
      mockState.fetchResponse.status = 422;
      mockState.fetchResponse.errorText = "Unsupported file type";

      await expect(
        indexerService.convertDocument("bad.xlsx"),
      ).rejects.toThrow("Markitdown API error 422: Unsupported file type");
    });

    test("should use Bun.file() to build the multipart payload for non-text files", async () => {
      createIncomingFile("image.jpg", "binary");

      await indexerService.convertDocument("image.jpg");

      expect(bunFileSpy).toHaveBeenCalledTimes(1);
      const calledPath = (bunFileSpy.mock.calls[0] as [string])[0];
      expect(calledPath).toContain("image.jpg");
    });

    test("should not use Bun.file() for .md files (direct read instead)", async () => {
      createIncomingFile("readme.md", "# README");

      await indexerService.convertDocument("readme.md");

      expect(bunFileSpy).not.toHaveBeenCalled();
    });

    test("should not use Bun.file() for .txt files (direct read instead)", async () => {
      createIncomingFile("log.txt", "log line");

      await indexerService.convertDocument("log.txt");

      expect(bunFileSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // generateMeta()
  // =========================================================================

  describe("generateMeta()", () => {
    test("should return the concatenated LLM stream output as a string", async () => {
      setLlmResponse("# DOCUMENT_META\n\n## Basisdaten\n- **Titel:** Test\n");

      const result = await indexerService.generateMeta(
        "some content",
        { title: "Test Doc" },
        "test.pdf",
        "doc-test-123",
        "col-1",
      );

      expect(result).toBe(
        "# DOCUMENT_META\n\n## Basisdaten\n- **Titel:** Test\n",
      );
    });

    test("should concatenate multiple LLM stream chunks in order", async () => {
      mockState.llmChunks = [
        { choices: [{ delta: { content: "Part1 " } }] },
        { choices: [{ delta: { content: "Part2 " } }] },
        { choices: [{ delta: { content: "Part3" } }] },
      ];

      const result = await indexerService.generateMeta(
        "content",
        {},
        "src.txt",
        "doc-id",
        "col-id",
      );

      expect(result).toBe("Part1 Part2 Part3");
    });

    test("should return empty string when the LLM produces no content fields", async () => {
      mockState.llmChunks = [
        { choices: [{ delta: {} }] }, // delta has no content property
      ];

      const result = await indexerService.generateMeta(
        "content",
        {},
        "src.txt",
        "doc-id",
        "col-id",
      );

      expect(result).toBe("");
    });

    test("should skip chunks with an empty choices array", async () => {
      mockState.llmChunks = [
        { choices: [] },
        { choices: [{ delta: { content: "valid" } }] },
      ];

      const result = await indexerService.generateMeta(
        "content",
        {},
        "src.txt",
        "doc-id",
        "col-id",
      );

      expect(result).toBe("valid");
    });

    test("should complete without error for very long content (preview capped at 8000 chars)", async () => {
      const longContent = "x".repeat(20000);
      setLlmResponse("meta output");

      const result = await indexerService.generateMeta(
        longContent,
        {},
        "big.txt",
        "doc-big",
        "col-1",
      );

      expect(result).toBe("meta output");
    });

    test("should accept optional triggeringUserId without error", async () => {
      setLlmResponse("meta");

      const result = await indexerService.generateMeta(
        "content",
        { owner: "alice", confidentiality: "confidential" },
        "src.pdf",
        "doc-1",
        "col-1",
        "user-99",
      );

      expect(result).toBe("meta");
    });
  });

  // =========================================================================
  // generateIndex()
  // =========================================================================

  describe("generateIndex()", () => {
    test("should return null for documents shorter than 20000 characters", async () => {
      const result = await indexerService.generateIndex("short content");

      expect(result).toBeNull();
    });

    test("should return null for content exactly 19999 characters long", async () => {
      const content = "x".repeat(19999);
      const result = await indexerService.generateIndex(content);

      expect(result).toBeNull();
    });

    test("should call the LLM and return content for documents with exactly 20000 chars", async () => {
      const largeContent = "y".repeat(20000);
      setLlmResponse("# INDEX\n## Kapiteluebersicht\n");

      const result = await indexerService.generateIndex(largeContent);

      expect(result).toBe("# INDEX\n## Kapiteluebersicht\n");
    });

    test("should concatenate multiple LLM chunks for large documents", async () => {
      const largeContent = "z".repeat(25000);
      mockState.llmChunks = [
        { choices: [{ delta: { content: "chunk-a " } }] },
        { choices: [{ delta: { content: "chunk-b" } }] },
      ];

      const result = await indexerService.generateIndex(largeContent);

      expect(result).toBe("chunk-a chunk-b");
    });

    test("should not invoke the LLM for short documents", async () => {
      // Set chunks so we can verify they are never consumed
      mockState.llmChunks = [
        { choices: [{ delta: { content: "should not appear" } }] },
      ];

      const result = await indexerService.generateIndex("short");

      // null means the LLM path was skipped entirely
      expect(result).toBeNull();
    });

    test("should accept optional triggeringUserId and collectionId without error", async () => {
      const largeContent = "a".repeat(20000);
      setLlmResponse("index content");

      const result = await indexerService.generateIndex(
        largeContent,
        "user-42",
        "col-xyz",
      );

      expect(result).toBe("index content");
    });
  });

  // =========================================================================
  // indexDocument() - full orchestration
  // =========================================================================

  describe("indexDocument()", () => {
    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    test("should return a successful IndexResult with all required fields", async () => {
      setupSuccessfulIndex("report.md", "# Report Content", "col-1");

      const result = await indexerService.indexDocument(
        "report.md",
        "col-1",
        { title: "My Report" },
      );

      expect(result.success).toBe(true);
      expect(result.collection_id).toBe("col-1");
      expect(result.title).toBe("My Report");
      expect(result.document_id).toMatch(/^doc-report-\d+$/);
      expect(result.document_path).toBe(result.document_id);
      expect(result.message).toContain("My Report");
      expect(result.message).toContain("col-1");
    });

    test("should use the file baseName as title when no title is provided in metadata", async () => {
      setupSuccessfulIndex("my-document.md", "content", "col-2");

      const result = await indexerService.indexDocument(
        "my-document.md",
        "col-2",
        {},
      );

      expect(result.title).toBe("my-document");
    });

    test("should create the document directory inside the collection", async () => {
      setupSuccessfulIndex("doc.md", "content", "col-3");

      const result = await indexerService.indexDocument(
        "doc.md",
        "col-3",
        { title: "Doc" },
      );

      const expectedDir = `/kb/collections/col-3/documents/${result.document_id}`;
      expect(mockState.createdDirs).toContain(expectedDir);
    });

    test("should write content.md with the converted document content", async () => {
      setupSuccessfulIndex("notes.md", "# Notes", "col-4");

      const result = await indexerService.indexDocument(
        "notes.md",
        "col-4",
        {},
      );

      const contentPath = `/kb/collections/col-4/documents/${result.document_id}/content.md`;
      expect(mockState.files[contentPath]).toBe("# Notes");
    });

    test("should write DOCUMENT_META.md with the LLM-generated metadata", async () => {
      setupSuccessfulIndex("spec.md", "spec content", "col-5");
      setLlmResponse("# META DATA\n- **Titel:** Spec\n");

      const result = await indexerService.indexDocument(
        "spec.md",
        "col-5",
        {},
      );

      const metaPath = `/kb/collections/col-5/documents/${result.document_id}/DOCUMENT_META.md`;
      expect(mockState.files[metaPath]).toBe(
        "# META DATA\n- **Titel:** Spec\n",
      );
    });

    test("should not write INDEX.md for documents shorter than 20000 characters", async () => {
      setupSuccessfulIndex("small.md", "short content", "col-6");

      const result = await indexerService.indexDocument(
        "small.md",
        "col-6",
        {},
      );

      const indexPath = `/kb/collections/col-6/documents/${result.document_id}/INDEX.md`;
      expect(mockState.files[indexPath]).toBeUndefined();
    });

    test("should write INDEX.md for documents with 20000 or more characters", async () => {
      const largeContent = "x".repeat(20000);
      createCollection("col-7");
      createIncomingFile("large.md", largeContent);
      createManifest("col-7", `documents: []\nlast_updated: "2026-01-01"\n`);
      createCollectionsYaml(`- id: "col-7"\n  document_count: 0\n`);

      // Provide two distinct LLM responses: first for generateMeta, second for generateIndex.
      let callCount = 0;
      const { llmService } = await import("../llm");
      const origStreamChat = llmService.streamChat;
      llmService.streamChat = async function* () {
        callCount++;
        yield {
          choices: [
            {
              delta: {
                content: callCount === 1 ? "# META\n" : "# INDEX\n",
              },
            },
          ],
        };
      };

      const result = await indexerService.indexDocument(
        "large.md",
        "col-7",
        {},
      );

      llmService.streamChat = origStreamChat;

      const indexPath = `/kb/collections/col-7/documents/${result.document_id}/INDEX.md`;
      expect(mockState.files[indexPath]).toBe("# INDEX\n");
    });

    test("should update manifest.yaml adding the new document entry", async () => {
      setupSuccessfulIndex("contract.md", "contract text", "col-8");

      const result = await indexerService.indexDocument(
        "contract.md",
        "col-8",
        { title: "Contract" },
      );

      const manifestContent =
        mockState.files["/kb/collections/col-8/manifest.yaml"]!;
      expect(manifestContent).toContain(result.document_id);
      expect(manifestContent).toContain("Contract");
    });

    test("should replace 'documents: []' in manifest with the first document entry", async () => {
      createCollection("col-9");
      createIncomingFile("item.md", "item content");
      createManifest("col-9", `documents: []\nlast_updated: "2025-01-01"\n`);
      createCollectionsYaml(`- id: "col-9"\n  document_count: 2\n`);
      setLlmResponse("meta");

      await indexerService.indexDocument("item.md", "col-9", { title: "Item" });

      const manifestContent =
        mockState.files["/kb/collections/col-9/manifest.yaml"]!;
      expect(manifestContent).not.toContain("documents: []");
      expect(manifestContent).toContain("documents:");
    });

    test("should append to a manifest that already contains documents", async () => {
      const existingManifest =
        `documents:\n  - document_id: "doc-existing-111"\n    title: "Existing"\n` +
        `last_updated: "2025-01-01"\n`;
      createCollection("col-10");
      createIncomingFile("new.md", "new content");
      createManifest("col-10", existingManifest);
      createCollectionsYaml(`- id: "col-10"\n  document_count: 1\n`);
      setLlmResponse("meta");

      const result = await indexerService.indexDocument(
        "new.md",
        "col-10",
        { title: "New Doc" },
      );

      const manifestContent =
        mockState.files["/kb/collections/col-10/manifest.yaml"]!;
      expect(manifestContent).toContain("doc-existing-111");
      expect(manifestContent).toContain(result.document_id);
    });

    test("should update last_updated in manifest and not keep the original placeholder", async () => {
      setupSuccessfulIndex("doc.md", "content", "col-11");

      await indexerService.indexDocument("doc.md", "col-11", {});

      const manifestContent =
        mockState.files["/kb/collections/col-11/manifest.yaml"]!;
      expect(manifestContent).toContain("last_updated:");
      expect(manifestContent).not.toContain(`last_updated: "2026-01-01"`);
    });

    test("should increment document_count in collections.yaml by 1", async () => {
      createCollection("col-12");
      createIncomingFile("doc.md", "content");
      createManifest("col-12", `documents: []\nlast_updated: "2026-01-01"\n`);
      createCollectionsYaml(`- id: "col-12"\n  document_count: 5\n`);
      setLlmResponse("meta");

      await indexerService.indexDocument("doc.md", "col-12", {});

      const collectionsContent = mockState.files["/kb/collections.yaml"]!;
      expect(collectionsContent).toContain("document_count: 6");
    });

    test("should complete successfully even when the collection is absent from collections.yaml", async () => {
      createCollection("col-13");
      createIncomingFile("doc.md", "content");
      createManifest("col-13", `documents: []\nlast_updated: "2026-01-01"\n`);
      createCollectionsYaml(`- id: "other-col"\n  document_count: 0\n`);
      setLlmResponse("meta");

      const result = await indexerService.indexDocument(
        "doc.md",
        "col-13",
        {},
      );

      expect(result.success).toBe(true);
    });

    test("should sanitise the file baseName to produce a slug-style document ID", async () => {
      setupSuccessfulIndex("My Report 2026 FINAL.md", "content", "col-14");

      const result = await indexerService.indexDocument(
        "My Report 2026 FINAL.md",
        "col-14",
        {},
      );

      // Non-alphanumeric chars are replaced with hyphens; leading/trailing hyphens stripped
      expect(result.document_id).toMatch(/^doc-my-report-2026-final-\d+$/);
    });

    test("should accept an optional triggeringUserId and still succeed", async () => {
      setupSuccessfulIndex("doc.md", "content", "col-15");

      const result = await indexerService.indexDocument(
        "doc.md",
        "col-15",
        {},
        "user-trigger-99",
      );

      expect(result.success).toBe(true);
    });

    test("should index a .txt file without calling the Markitdown API", async () => {
      setupSuccessfulIndex("readme.txt", "Plain text content", "col-16");

      const result = await indexerService.indexDocument(
        "readme.txt",
        "col-16",
        { title: "Readme" },
      );

      expect(result.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      const contentPath = `/kb/collections/col-16/documents/${result.document_id}/content.md`;
      expect(mockState.files[contentPath]).toBe("Plain text content");
    });

    test("should convert a non-text file via the Markitdown API and store the result as content.md", async () => {
      createCollection("col-pdf");
      createIncomingFile("report.pdf", "binary-data");
      createManifest("col-pdf", `documents: []\nlast_updated: "2026-01-01"\n`);
      createCollectionsYaml(`- id: "col-pdf"\n  document_count: 0\n`);
      mockState.fetchResponse.text = "# Converted PDF Content";
      setLlmResponse("# META\n");

      const result = await indexerService.indexDocument(
        "report.pdf",
        "col-pdf",
        { title: "PDF Report" },
      );

      expect(result.success).toBe(true);
      const contentPath = `/kb/collections/col-pdf/documents/${result.document_id}/content.md`;
      expect(mockState.files[contentPath]).toBe("# Converted PDF Content");
    });

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------

    test("should throw when the collection directory does not exist", async () => {
      // Collection dir is not in existingDirs, so existsSync returns false
      await expect(
        indexerService.indexDocument("doc.md", "nonexistent-col", {}),
      ).rejects.toThrow(
        'Collection "nonexistent-col" existiert nicht. Erstelle sie zuerst mit kb_manage.',
      );
    });

    test("should propagate errors from convertDocument when the incoming file is missing", async () => {
      createCollection("col-err");
      // Incoming file is NOT registered - convertDocument will throw

      await expect(
        indexerService.indexDocument("missing.pdf", "col-err", {}),
      ).rejects.toThrow("Datei nicht gefunden: missing.pdf");
    });

    test("should propagate Markitdown API errors that occur during document conversion", async () => {
      createCollection("col-api-err");
      createIncomingFile("bad.docx", "binary");
      mockState.fetchResponse.ok = false;
      mockState.fetchResponse.status = 500;
      mockState.fetchResponse.errorText = "Internal Server Error";

      await expect(
        indexerService.indexDocument("bad.docx", "col-api-err", {}),
      ).rejects.toThrow("Markitdown API error 500: Internal Server Error");
    });
  });
});
