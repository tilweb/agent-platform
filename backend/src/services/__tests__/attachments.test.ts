/**
 * Tests for AttachmentsService (backend/src/services/attachments.ts)
 *
 * All file system operations (fs/promises, fs), global fetch, and the
 * providers service are mocked at the module level so no real disk I/O,
 * network calls, or process spawning occurs. The private `convertToMp3`
 * method is patched directly on the singleton after import.
 *
 * Pattern:
 *  1. Declare shared `mockState` object
 *  2. Register mock.module() calls BEFORE the dynamic import
 *  3. Import the module under test with `await import()`
 *  4. Reset `mockState` in beforeEach for test isolation
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const UPLOADS_BASE = "/tmp/test-uploads";
const MOCK_BUCKET = "2026/02"; // Must match the dateBucket mock

const mockState = {
  // Virtual file system: path -> Buffer | string
  files: {} as Record<string, Buffer | string>,

  // Directories that "exist" (checked via existsSync)
  dirs: new Set<string>(),

  // Controlled readdir results
  sessionDirs: [] as string[],
  attachmentDirs: [] as string[],

  // After any rm call, readdir for session/attachment dirs returns this
  attachmentDirsAfterRm: [] as string[],
  rmCallCount: 0,

  // Fetch control
  fetchStatus: 200,
  fetchBody: "# Converted markdown",
  fetchShouldThrow: false,

  // Provider config for STT transcription
  providersConfig: null as any,
  provider: null as any,

  // Recorded calls for assertions
  writtenFiles: {} as Record<string, Buffer | string>,
  mkdirCalls: [] as string[],
  rmCalls: [] as string[],
  unlinkCalls: [] as string[],

  // File type validation control
  fileTypeIsValid: true,
  fileTypeDetectedMime: null as string | null, // null = use claimed MIME
  fileTypeMismatch: false,
  fileTypeError: undefined as string | undefined,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  readFile: async (path: string, encoding?: string) => {
    const content = mockState.files[path];
    if (content === undefined) {
      const err = Object.assign(
        new Error(`ENOENT: no such file: ${path}`),
        { code: "ENOENT" }
      );
      throw err;
    }
    if (encoding === "utf-8" || encoding === "utf8") {
      return typeof content === "string" ? content : (content as Buffer).toString("utf-8");
    }
    return typeof content === "string" ? Buffer.from(content) : content;
  },

  writeFile: async (path: string, content: Buffer | string) => {
    mockState.files[path] = content;
    mockState.writtenFiles[path] = content;
  },

  mkdir: async (path: string, _options?: any) => {
    mockState.dirs.add(path);
    mockState.mkdirCalls.push(path);
  },

  // Accept optional options arg (the service calls rm(path, { recursive: true, force: true }))
  rm: async (path: string, _options?: any) => {
    mockState.rmCallCount++;
    mockState.rmCalls.push(path);
    for (const key of Object.keys(mockState.files)) {
      if (key.startsWith(path + "/") || key === path) {
        delete mockState.files[key];
      }
    }
    mockState.dirs.delete(path);
  },

  readdir: async (path: string) => {
    if (path === UPLOADS_BASE) return mockState.sessionDirs;
    // After any rm call, subsequent readdir for attachment-level dirs returns
    // the "after-rm" list so empty-dir removal behaviour can be tested.
    if (mockState.rmCallCount > 0) return mockState.attachmentDirsAfterRm;
    return mockState.attachmentDirs;
  },

  unlink: async (path: string) => {
    mockState.unlinkCalls.push(path);
    delete mockState.files[path];
  },
}));

mock.module("fs", () => ({
  // existsSync returns true if the path itself is in the virtual files or dirs,
  // OR if any child path (file inside directory) exists — simulating directory
  // existence based on whether it has any children.
  existsSync: (path: string) =>
    path in mockState.files ||
    mockState.dirs.has(path) ||
    Object.keys(mockState.files).some((k) => k.startsWith(path + "/")),
}));

// Mock ../utils/paths — fixed uploads base and API settings.
// Register both relative specifiers that resolve to the same module from
// different directory depths (test at services/__tests__, service at services/).
const pathsMock = () => ({
  CHAT_UPLOADS_DIR: UPLOADS_BASE,
  MARKITDOWN_API_URL: "https://mock-markitdown.example/convert",
  MARKITDOWN_API_KEY: "test-api-key",
});
mock.module("../utils/paths", pathsMock);
mock.module("../../utils/paths", pathsMock);

// Mock dateBucket module — deterministic bucket for all test IDs.
const dateBucketMock = () => ({
  dateBucketFromId: (_id: string) => null, // test IDs don't have valid timestamps
  currentDateBucket: () => MOCK_BUCKET,
  dateBucketFromFilename: (_f: string) => null,
});
mock.module("../utils/dateBucket", dateBucketMock);
mock.module("../../utils/dateBucket", dateBucketMock);

// Mock the file type validator — uses mockState for per-test control.
// Register both specifiers for the same reason as paths above.
const fileTypeValidatorMock = () => ({
  validateUpload: (_buffer: Buffer, claimedMimeType: string, _filename: string) => ({
    isValid: mockState.fileTypeIsValid,
    detectedMimeType: mockState.fileTypeDetectedMime ?? claimedMimeType.split(";")[0]!.trim(),
    mismatch: mockState.fileTypeMismatch,
    error: mockState.fileTypeError,
  }),
});
mock.module("../utils/fileTypeValidator", fileTypeValidatorMock);
mock.module("../../utils/fileTypeValidator", fileTypeValidatorMock);

// Mock the providers service used by transcribeAudio.
// Register both specifiers: from test file (../providers) and from the
// service itself (./providers) — Bun resolves them identically.
const providersMock = () => ({
  loadProvidersConfig: async () => mockState.providersConfig,
  getProvider: async (_id: string) => mockState.provider,
  resolveApiKey: async (_provider: any) => process.env["OPENAI_API_KEY"] || null,
});
mock.module("./providers", providersMock);
mock.module("../providers", providersMock);

// Override global fetch before module import so the service picks up the mock
globalThis.fetch = async (_url: string, _options?: RequestInit): Promise<Response> => {
  if (mockState.fetchShouldThrow) throw new Error("fetch failed");
  return {
    ok: mockState.fetchStatus >= 200 && mockState.fetchStatus < 300,
    status: mockState.fetchStatus,
    text: async () => mockState.fetchBody,
    json: async () => ({ text: mockState.fetchBody }),
  } as unknown as Response;
};

// Mock Bun.file — must return a real Blob so FormData.append works
if ((globalThis as any).Bun) {
  (globalThis as any).Bun.file = (path: string) => {
    // Return the Buffer stored at this path as a Blob, or an empty Blob
    const content = mockState.files[path];
    const data = content instanceof Buffer ? content : Buffer.from(content ?? "");
    return new Blob([data], { type: "application/octet-stream" });
  };
}

// Mock Bun.Glob — async generator that scans mockState.files
if ((globalThis as any).Bun) {
  (globalThis as any).Bun.Glob = class MockGlob {
    private pattern: string;
    constructor(pattern: string) {
      this.pattern = pattern;
    }
    async *scan(dir: string) {
      const prefix = dir.endsWith("/") ? dir : dir + "/";
      for (const fullPath of Object.keys(mockState.files)) {
        if (!fullPath.startsWith(prefix)) continue;
        const relPath = fullPath.slice(prefix.length);
        // Match **/metadata.json pattern (only pattern used in the service)
        if (this.pattern === "**/metadata.json" && relPath.endsWith("metadata.json")) {
          yield relPath;
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Import the service AFTER mocks
// ---------------------------------------------------------------------------

const { attachmentsService } = await import("../attachments");

// Patch the private convertToMp3 method on the singleton so no real ffmpeg
// is invoked. Cast to any to access the private method.
(attachmentsService as any).convertToMp3 = async (
  _inputPath: string,
  _mimeType: string
): Promise<string> => {
  const outPath = `${UPLOADS_BASE}/temp-converted.mp3`;
  mockState.files[outPath] = Buffer.from("fake-mp3-data");
  return outPath;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a File backed by the given Buffer. */
function makeFile(name: string, mimeType: string, content: Buffer = Buffer.from("hello")): File {
  return new File([new Blob([content], { type: mimeType })], name, { type: mimeType });
}

/** PDF magic bytes (%PDF-1.4) */
function pdfBuffer(): Buffer {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
}

/** PNG magic bytes */
function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
}

/** MP3 ID3 header bytes */
function mp3Buffer(): Buffer {
  return Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
}

/** WebM / Matroska magic bytes */
function webmBuffer(): Buffer {
  return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * Serialise a ChatAttachment-like object to JSON so it can be stored as a
 * fake metadata.json entry. `metadata` sub-key is merged separately.
 */
function makeMetadataJson(overrides: Record<string, any> = {}): string {
  const { metadata: metaOverride, ...rest } = overrides;
  const defaultMeta = {
    size: 1024,
    pages: 1,
    convertedAt: new Date().toISOString(),
    originalPath: `${UPLOADS_BASE}/session-abc/att-123/original.pdf`,
  };
  return JSON.stringify({
    id: "att-123",
    sessionId: "session-abc",
    filename: "test.pdf",
    mimeType: "application/pdf",
    type: "document",
    storagePath: `${UPLOADS_BASE}/session-abc/att-123`,
    markdownContent: "# Test",
    metadata: { ...defaultMeta, ...(metaOverride ?? {}) },
    ...rest,
  });
}

/** Reset all mock state to clean defaults before each test. */
function resetMockState() {
  mockState.files = {};
  mockState.dirs = new Set();
  mockState.sessionDirs = [];
  mockState.attachmentDirs = [];
  mockState.attachmentDirsAfterRm = [];
  mockState.rmCallCount = 0;
  mockState.fetchStatus = 200;
  mockState.fetchBody = "# Converted markdown";
  mockState.fetchShouldThrow = false;
  mockState.writtenFiles = {};
  mockState.mkdirCalls = [];
  mockState.rmCalls = [];
  mockState.unlinkCalls = [];
  mockState.providersConfig = {
    active: { stt: { provider_id: "openai", model_id: "whisper-1" } },
  };
  mockState.provider = {
    id: "openai",
    name: "OpenAI",
    enabled: true,
    api_key_env: "OPENAI_API_KEY",
    base_url: "https://api.openai.com/v1/audio",
    models: [{ id: "whisper-1", base_url: "https://api.openai.com/v1/audio" }],
  };
  mockState.fileTypeIsValid = true;
  mockState.fileTypeDetectedMime = null;
  mockState.fileTypeMismatch = false;
  mockState.fileTypeError = undefined;
  process.env["OPENAI_API_KEY"] = "test-key-123";
}

// ===========================================================================
// Test suites
// ===========================================================================

describe("AttachmentsService", () => {

  // -------------------------------------------------------------------------
  // generateAttachmentUrl()
  // -------------------------------------------------------------------------

  describe("generateAttachmentUrl()", () => {
    test("should return the expected URL template", () => {
      const url = attachmentsService.generateAttachmentUrl("chat-1", "att-abc");
      expect(url).toBe("/api/chats/chat-1/attachments/att-abc");
    });

    test("should embed both chatId and attachmentId", () => {
      const url = attachmentsService.generateAttachmentUrl("chat-XYZ", "att-999");
      expect(url).toContain("chat-XYZ");
      expect(url).toContain("att-999");
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - size guard
  // -------------------------------------------------------------------------

  describe("processUpload() - size validation", () => {
    beforeEach(resetMockState);

    test("should throw 'Datei zu gro' when file exceeds MAX_FILE_SIZE (50 MB)", async () => {
      const largeFile = {
        name: "big.pdf",
        type: "application/pdf",
        size: 51 * 1024 * 1024,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as File;

      await expect(
        attachmentsService.processUpload("session-1", largeFile)
      ).rejects.toThrow("Datei zu gro");
    });

    test("should not throw 'Datei zu gro' for a file at exactly 50 MB", async () => {
      const file = {
        name: "ok.pdf",
        type: "application/pdf",
        size: 50 * 1024 * 1024,
        arrayBuffer: async () => pdfBuffer().buffer,
      } as unknown as File;

      try {
        await attachmentsService.processUpload("session-1", file);
      } catch (err: any) {
        expect(err.message).not.toContain("Datei zu gro");
      }
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - sessionId validation
  // -------------------------------------------------------------------------

  describe("processUpload() - sessionId validation", () => {
    beforeEach(resetMockState);

    test("should throw 'Ungültige Session-ID' for a path-traversal sessionId", async () => {
      await expect(
        attachmentsService.processUpload("../etc/passwd", makeFile("doc.pdf", "application/pdf", pdfBuffer()))
      ).rejects.toThrow("Ungültige Session-ID");
    });

    test("should throw 'Ungültige Session-ID' for a sessionId with spaces", async () => {
      await expect(
        attachmentsService.processUpload("session with spaces", makeFile("doc.pdf", "application/pdf", pdfBuffer()))
      ).rejects.toThrow("Ungültige Session-ID");
    });

    test("should throw 'Ungültige Session-ID' for a sessionId with semicolon", async () => {
      await expect(
        attachmentsService.processUpload("session;rm -rf /", makeFile("doc.pdf", "application/pdf", pdfBuffer()))
      ).rejects.toThrow("Ungültige Session-ID");
    });

    test("should accept a valid sessionId composed of alphanum, dashes, and underscores", async () => {
      const file = makeFile("notes.txt", "text/plain", Buffer.from("hello world"));
      const result = await attachmentsService.processUpload("session-abc_123", file);
      expect(result.sessionId).toBe("session-abc_123");
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - file type validation (uses re-registered mocks)
  // -------------------------------------------------------------------------

  describe("processUpload() - file type validation", () => {
    beforeEach(resetMockState);

    test("should throw when validateUpload returns isValid=false", async () => {
      mockState.fileTypeIsValid = false;
      mockState.fileTypeError = "Unbekannter Dateityp";
      mockState.fileTypeMismatch = true;
      const file = makeFile("hack.exe", "application/octet-stream", Buffer.from([0x4d, 0x5a]));
      await expect(attachmentsService.processUpload("session-1", file)).rejects.toThrow("Unbekannter Dateityp");
    });

    test("should throw 'Nicht unterstützter Dateityp' when detected MIME is not a supported category", async () => {
      mockState.fileTypeDetectedMime = "application/octet-stream";
      const file = makeFile("binary.bin", "application/octet-stream", Buffer.from("random-data"));
      await expect(attachmentsService.processUpload("session-1", file)).rejects.toThrow(
        "Nicht unterstützter Dateityp"
      );
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - document path
  // -------------------------------------------------------------------------

  describe("processUpload() - document", () => {
    beforeEach(() => {
      resetMockState();
      // Restore the default permissive validator after any previous override
      mock.module("../../utils/fileTypeValidator", () => ({
        validateUpload: (_buf: Buffer, claimedMimeType: string) => ({
          isValid: true,
          detectedMimeType: claimedMimeType.split(";")[0]!.trim(),
          mismatch: false,
        }),
      }));
    });

    test("should return type 'document' for a PDF", async () => {
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("report.pdf", "application/pdf", pdfBuffer())
      );
      expect(result.type).toBe("document");
    });

    test("should call Markitdown API and populate markdownContent", async () => {
      mockState.fetchBody = "# Converted\nContent here.";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("report.pdf", "application/pdf", pdfBuffer())
      );
      expect(result.markdownContent).toBe("# Converted\nContent here.");
    });

    test("should read .txt files directly without API call", async () => {
      const content = "Plain text content";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("notes.txt", "text/plain", Buffer.from(content))
      );
      expect(result.type).toBe("document");
      expect(result.markdownContent).toBe(content);
    });

    test("should read .md files directly without API call", async () => {
      const content = "# Markdown header";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("readme.md", "text/markdown", Buffer.from(content))
      );
      expect(result.markdownContent).toBe(content);
    });

    test("should save content.md next to the original file", async () => {
      mockState.fetchBody = "# Doc";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      const mdKey = Object.keys(mockState.writtenFiles).find((k) => k.endsWith("content.md"));
      expect(mdKey).toBeDefined();
      expect(mockState.writtenFiles[mdKey!]).toBe("# Doc");
    });

    test("should save metadata.json with correct top-level fields", async () => {
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      const metaKey = Object.keys(mockState.writtenFiles).find((k) =>
        k.endsWith("metadata.json")
      );
      expect(metaKey).toBeDefined();
      const saved = JSON.parse(mockState.writtenFiles[metaKey!] as string);
      expect(saved.id).toBe(result.id);
      expect(saved.sessionId).toBe("session-1");
      expect(saved.filename).toBe("doc.pdf");
      expect(saved.mimeType).toBe("application/pdf");
      expect(saved.type).toBe("document");
    });

    test("should estimate page count (~3000 chars/page)", async () => {
      mockState.fetchBody = "x".repeat(6100);
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("long.pdf", "application/pdf", pdfBuffer())
      );
      // ceil(6100/3000) = 3
      expect(result.metadata.pages).toBe(3);
    });

    test("should set pages to 1 for content shorter than 3000 chars", async () => {
      mockState.fetchBody = "Short content";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("short.pdf", "application/pdf", pdfBuffer())
      );
      expect(result.metadata.pages).toBe(1);
    });

    test("should fall back gracefully when Markitdown API returns non-OK", async () => {
      mockState.fetchStatus = 500;
      mockState.fetchBody = "Internal Server Error";
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      // Falls back to reading the original file as text
      expect(result.type).toBe("document");
      expect(result.markdownContent).toBeDefined();
    });

    test("should include metadata.size equal to the original file.size", async () => {
      const buf = pdfBuffer();
      const file = makeFile("doc.pdf", "application/pdf", buf);
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload("session-1", file);
      expect(result.metadata.size).toBe(file.size);
    });

    test("should strip directory components from filename (path traversal protection)", async () => {
      const file = makeFile("../../etc/passwd.pdf", "application/pdf", pdfBuffer());
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload("session-1", file);
      expect(result.filename).not.toContain("..");
      expect(result.filename).not.toContain("/");
    });

    test("should create the attachment directory inside the session dir", async () => {
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      const created = mockState.mkdirCalls.some((p) => p.includes("session-1"));
      expect(created).toBe(true);
    });

    test("should return an id string prefixed with 'att-'", async () => {
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      expect(result.id).toMatch(/^att-/);
    });

    test("should set convertedAt to a current ISO timestamp", async () => {
      const before = new Date().toISOString();
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      const after = new Date().toISOString();
      expect(result.metadata.convertedAt! >= before).toBe(true);
      expect(result.metadata.convertedAt! <= after).toBe(true);
    });

    test("should strip codec parameters from MIME type (normalisation)", async () => {
      mock.module("../../utils/fileTypeValidator", () => ({
        validateUpload: () => ({
          isValid: true,
          detectedMimeType: "application/pdf; charset=utf-8",
          mismatch: false,
        }),
      }));
      const { attachmentsService: svcDoc } = await import("../attachments");
      (svcDoc as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcDoc.processUpload(
        "session-1",
        makeFile("doc.pdf", "application/pdf", pdfBuffer())
      );
      expect(result.mimeType).toBe("application/pdf");
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - image path
  // -------------------------------------------------------------------------

  describe("processUpload() - image", () => {
    beforeEach(() => {
      resetMockState();
      mock.module("../../utils/fileTypeValidator", () => ({
        validateUpload: (_buf: Buffer, claimedMimeType: string) => ({
          isValid: true,
          detectedMimeType: claimedMimeType.split(";")[0]!.trim(),
          mismatch: false,
        }),
      }));
    });

    test("should return type 'image' for a PNG file", async () => {
      const { attachmentsService: svcImg } = await import("../attachments");
      const result = await svcImg.processUpload(
        "session-1",
        makeFile("photo.png", "image/png", pngBuffer())
      );
      expect(result.type).toBe("image");
    });

    test("should populate base64Data with 'data:image/png;base64,' prefix", async () => {
      const { attachmentsService: svcImg } = await import("../attachments");
      const result = await svcImg.processUpload(
        "session-1",
        makeFile("photo.png", "image/png", pngBuffer())
      );
      expect(result.base64Data).toBeDefined();
      expect(result.base64Data!.startsWith("data:image/png;base64,")).toBe(true);
    });

    test("should not populate markdownContent for images", async () => {
      const { attachmentsService: svcImg } = await import("../attachments");
      const result = await svcImg.processUpload(
        "session-1",
        makeFile("photo.png", "image/png", pngBuffer())
      );
      expect(result.markdownContent).toBeUndefined();
    });

    test("should not populate transcription for images", async () => {
      const { attachmentsService: svcImg } = await import("../attachments");
      const result = await svcImg.processUpload(
        "session-1",
        makeFile("photo.png", "image/png", pngBuffer())
      );
      expect(result.transcription).toBeUndefined();
    });

    test("should embed the correct MIME type in the base64 data URI for JPEG", async () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
      const { attachmentsService: svcImg } = await import("../attachments");
      const result = await svcImg.processUpload(
        "session-1",
        makeFile("shot.jpg", "image/jpeg", jpegBuf)
      );
      expect(result.base64Data).toContain("data:image/jpeg;base64,");
    });

    test("should save metadata.json without markdownContent key", async () => {
      const { attachmentsService: svcImg } = await import("../attachments");
      await svcImg.processUpload(
        "session-1",
        makeFile("img.png", "image/png", pngBuffer())
      );
      const metaKey = Object.keys(mockState.writtenFiles).find((k) =>
        k.endsWith("metadata.json")
      );
      const saved = JSON.parse(mockState.writtenFiles[metaKey!] as string);
      expect(saved.markdownContent).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - audio path
  // -------------------------------------------------------------------------

  describe("processUpload() - audio", () => {
    beforeEach(() => {
      resetMockState();
      mock.module("../../utils/fileTypeValidator", () => ({
        validateUpload: (_buf: Buffer, claimedMimeType: string) => ({
          isValid: true,
          detectedMimeType: claimedMimeType.split(";")[0]!.trim(),
          mismatch: false,
        }),
      }));
    });

    test("should return type 'audio' for an MP3 file", async () => {
      mockState.fetchBody = "Transcription text";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.type).toBe("audio");
    });

    test("should populate transcription from the STT API response", async () => {
      mockState.fetchBody = "Hello world transcription";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toBe("Hello world transcription");
    });

    test("should save transcription.txt alongside the original file", async () => {
      mockState.fetchBody = "Transcribed!";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      const txKey = Object.keys(mockState.writtenFiles).find((k) =>
        k.endsWith("transcription.txt")
      );
      expect(txKey).toBeDefined();
    });

    test("should store error message in transcription when STT API returns non-OK", async () => {
      mockState.fetchStatus = 503;
      mockState.fetchBody = "Service Unavailable";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toContain("Fehler");
    });

    test("should store error message when no STT provider is configured", async () => {
      mockState.providersConfig = { active: { stt: null } };
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toContain("Fehler");
    });

    test("should store error message when STT provider is disabled", async () => {
      mockState.provider = { ...mockState.provider, enabled: false };
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toContain("Fehler");
    });

    test("should store error message when API key env variable is not set", async () => {
      delete process.env["OPENAI_API_KEY"];
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toContain("Fehler");
      process.env["OPENAI_API_KEY"] = "test-key-123";
    });

    test("should not populate markdownContent for audio", async () => {
      mockState.fetchBody = "Transcription";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("clip.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.markdownContent).toBeUndefined();
    });

    test("should not populate base64Data for audio", async () => {
      mockState.fetchBody = "Transcription";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("clip.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.base64Data).toBeUndefined();
    });

    test("should trigger convertToMp3 and still transcribe WebM audio", async () => {
      mockState.fetchBody = "Transcribed WebM content";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("recording.webm", "audio/webm", webmBuffer())
      );
      expect(result.type).toBe("audio");
      expect(result.transcription).toBe("Transcribed WebM content");
    });

    test("should build transcription URL without duplicating /transcriptions", async () => {
      mockState.provider.models[0].base_url =
        "https://api.openai.com/v1/audio/transcriptions";
      mockState.fetchBody = "Transcription from correct URL";
      const { attachmentsService: svcAud } = await import("../attachments");
      (svcAud as any).convertToMp3 = (attachmentsService as any).convertToMp3;
      const result = await svcAud.processUpload(
        "session-1",
        makeFile("audio.mp3", "audio/mpeg", mp3Buffer())
      );
      expect(result.transcription).toBe("Transcription from correct URL");
    });
  });

  // -------------------------------------------------------------------------
  // processUpload() - MIME mismatch
  // -------------------------------------------------------------------------

  describe("processUpload() - MIME mismatch handling", () => {
    beforeEach(resetMockState);

    test.todo("should use the detected MIME type, not the client-provided one");
  });

  // -------------------------------------------------------------------------
  // getAttachment()
  // The getAttachment tests use the top-level singleton since they do only
  // reads - no mock re-registration needed.
  // -------------------------------------------------------------------------

  describe("getAttachment()", () => {
    beforeEach(resetMockState);

    test("should return null when UPLOADS_BASE does not exist and no sessionId given", async () => {
      const result = await attachmentsService.getAttachment("att-123");
      expect(result).toBeNull();
    });

    test("should return null when metadata.json is absent for the given sessionId", async () => {
      // Add the attachment dir to dirs so existsSync passes for the dir but
      // metadata.json is NOT in files
      mockState.dirs.add(`${UPLOADS_BASE}/session-1/att-123`);
      const result = await attachmentsService.getAttachment("att-123", "session-1");
      expect(result).toBeNull();
    });

    test("should return the parsed attachment when metadata.json exists", async () => {
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson({
        id: "att-123",
        sessionId: "session-1",
      });
      const result = await attachmentsService.getAttachment("att-123", "session-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("att-123");
      expect(result!.filename).toBe("test.pdf");
    });

    test("should re-load content.md when markdownContent is absent in stored metadata", async () => {
      mockState.files[`${UPLOADS_BASE}/s/att-456/metadata.json`] = makeMetadataJson({
        id: "att-456",
        type: "document",
        markdownContent: undefined,
      });
      mockState.files[`${UPLOADS_BASE}/s/att-456/content.md`] = "# Reloaded";
      const result = await attachmentsService.getAttachment("att-456", "s");
      expect(result!.markdownContent).toBe("# Reloaded");
    });

    test("should re-load transcription.txt when transcription is absent in stored metadata", async () => {
      mockState.files[`${UPLOADS_BASE}/s/att-789/metadata.json`] = makeMetadataJson({
        id: "att-789",
        type: "audio",
        transcription: undefined,
        markdownContent: undefined,
      });
      mockState.files[`${UPLOADS_BASE}/s/att-789/transcription.txt`] = "Reloaded transcription";
      const result = await attachmentsService.getAttachment("att-789", "s");
      expect(result!.transcription).toBe("Reloaded transcription");
    });

    test("should search all sessions when no sessionId is provided", async () => {
      // A file inside session-B/att-found makes existsSync(UPLOADS_BASE) return
      // true via the child-path check, and also makes existsSync(attachmentDir)
      // return true.
      mockState.sessionDirs = ["session-A", "session-B"];
      mockState.files[`${UPLOADS_BASE}/session-B/att-found/metadata.json`] = makeMetadataJson({
        id: "att-found",
      });

      const result = await attachmentsService.getAttachment("att-found");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("att-found");
    });

    test("should return null when attachment is not found in any session", async () => {
      // A file inside UPLOADS_BASE so existsSync(UPLOADS_BASE) returns true
      mockState.files[`${UPLOADS_BASE}/session-A/some-file`] = "";
      mockState.sessionDirs = ["session-A"];
      const result = await attachmentsService.getAttachment("att-missing");
      expect(result).toBeNull();
    });

    test("should return null when metadata.json contains invalid JSON", async () => {
      mockState.files[`${UPLOADS_BASE}/s/att-bad/metadata.json`] = "NOT_VALID{{{{";
      const result = await attachmentsService.getAttachment("att-bad", "s");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getSessionAttachments()
  // -------------------------------------------------------------------------

  describe("getSessionAttachments()", () => {
    beforeEach(resetMockState);

    test("should return empty array when session directory does not exist", async () => {
      const result = await attachmentsService.getSessionAttachments("no-session");
      expect(result).toEqual([]);
    });

    test("should return all valid attachments for the session", async () => {
      mockState.dirs.add(`${UPLOADS_BASE}/session-1`);
      mockState.attachmentDirs = ["att-A", "att-B"];
      mockState.files[`${UPLOADS_BASE}/session-1/att-A/metadata.json`] = makeMetadataJson({
        id: "att-A",
      });
      mockState.files[`${UPLOADS_BASE}/session-1/att-B/metadata.json`] = makeMetadataJson({
        id: "att-B",
      });

      const result = await attachmentsService.getSessionAttachments("session-1");
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toContain("att-A");
      expect(result.map((a) => a.id)).toContain("att-B");
    });

    test("should skip attachments whose metadata.json is missing", async () => {
      mockState.dirs.add(`${UPLOADS_BASE}/session-1`);
      mockState.attachmentDirs = ["att-good", "att-missing"];
      mockState.files[`${UPLOADS_BASE}/session-1/att-good/metadata.json`] = makeMetadataJson({
        id: "att-good",
      });
      // att-missing has no metadata.json entry

      const result = await attachmentsService.getSessionAttachments("session-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("att-good");
    });
  });

  // -------------------------------------------------------------------------
  // getAttachmentMetadata()
  // -------------------------------------------------------------------------

  describe("getAttachmentMetadata()", () => {
    beforeEach(resetMockState);

    test("should return null when attachment does not exist", async () => {
      const result = await attachmentsService.getAttachmentMetadata("att-xyz", "session-1");
      expect(result).toBeNull();
    });

    test("should return size and pages from the metadata sub-object", async () => {
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson({
        metadata: { size: 2048, pages: 2 },
      });
      const result = await attachmentsService.getAttachmentMetadata("att-123", "session-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("att-123");
      expect(result!.size).toBe(2048);
      expect(result!.pages).toBe(2);
    });

    test("should include filename, mimeType, and type", async () => {
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson();
      const result = await attachmentsService.getAttachmentMetadata("att-123", "session-1");
      expect(result!.filename).toBe("test.pdf");
      expect(result!.mimeType).toBe("application/pdf");
      expect(result!.type).toBe("document");
    });

    test("should not expose markdownContent or base64Data", async () => {
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson();
      const result = await attachmentsService.getAttachmentMetadata("att-123", "session-1");
      expect((result as any).markdownContent).toBeUndefined();
      expect((result as any).base64Data).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getSessionAttachmentMetadata()
  // -------------------------------------------------------------------------

  describe("getSessionAttachmentMetadata()", () => {
    beforeEach(resetMockState);

    test("should return empty array for a missing session", async () => {
      const result = await attachmentsService.getSessionAttachmentMetadata("no-session");
      expect(result).toEqual([]);
    });

    test("should return one AttachmentMetadata per attachment", async () => {
      mockState.dirs.add(`${UPLOADS_BASE}/session-1`);
      mockState.attachmentDirs = ["att-1", "att-2"];
      mockState.files[`${UPLOADS_BASE}/session-1/att-1/metadata.json`] = makeMetadataJson({
        id: "att-1",
      });
      mockState.files[`${UPLOADS_BASE}/session-1/att-2/metadata.json`] = makeMetadataJson({
        id: "att-2",
      });

      const result = await attachmentsService.getSessionAttachmentMetadata("session-1");
      expect(result).toHaveLength(2);
    });

    test("should not expose full attachment content in returned metadata", async () => {
      mockState.dirs.add(`${UPLOADS_BASE}/session-1`);
      mockState.attachmentDirs = ["att-1"];
      mockState.files[`${UPLOADS_BASE}/session-1/att-1/metadata.json`] = makeMetadataJson({
        id: "att-1",
      });

      const result = await attachmentsService.getSessionAttachmentMetadata("session-1");
      expect(result).toHaveLength(1);
      const [meta] = result;
      expect((meta as any).markdownContent).toBeUndefined();
      expect((meta as any).base64Data).toBeUndefined();
      expect((meta as any).storagePath).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // cleanupSessionAttachments()
  // -------------------------------------------------------------------------

  describe("cleanupSessionAttachments()", () => {
    beforeEach(resetMockState);

    test("should do nothing when the session directory does not exist", async () => {
      await attachmentsService.cleanupSessionAttachments("ghost-session");
      expect(mockState.rmCalls).toHaveLength(0);
    });

    test("should call rm on the flat session directory when it exists", async () => {
      const sessionDir = `${UPLOADS_BASE}/session-to-clean`;
      mockState.dirs.add(sessionDir);
      await attachmentsService.cleanupSessionAttachments("session-to-clean");
      expect(mockState.rmCalls).toContain(sessionDir);
    });

    test("should call rm on the bucketed session directory when it exists", async () => {
      const bucketDir = `${UPLOADS_BASE}/${MOCK_BUCKET}/session-to-clean`;
      mockState.dirs.add(bucketDir);
      await attachmentsService.cleanupSessionAttachments("session-to-clean");
      expect(mockState.rmCalls).toContain(bucketDir);
    });

    test("should clean up both bucketed and flat paths when both exist", async () => {
      const bucketDir = `${UPLOADS_BASE}/${MOCK_BUCKET}/session-both`;
      const flatDir = `${UPLOADS_BASE}/session-both`;
      mockState.dirs.add(bucketDir);
      mockState.dirs.add(flatDir);
      await attachmentsService.cleanupSessionAttachments("session-both");
      expect(mockState.rmCalls).toContain(bucketDir);
      expect(mockState.rmCalls).toContain(flatDir);
    });
  });

  // -------------------------------------------------------------------------
  // getAttachmentFilePath()
  // -------------------------------------------------------------------------

  describe("getAttachmentFilePath()", () => {
    beforeEach(resetMockState);

    test("should return null when the attachment record does not exist", async () => {
      const result = await attachmentsService.getAttachmentFilePath("att-xyz", "session-1");
      expect(result).toBeNull();
    });

    test("should fall back to searching for original.* when stored originalPath is stale", async () => {
      // Metadata has a stale originalPath that doesn't exist, but original.pdf exists in resolved dir
      const attDir = `${UPLOADS_BASE}/session-1/att-123`;
      mockState.files[`${attDir}/metadata.json`] = makeMetadataJson({
        sessionId: "session-1",
        metadata: { size: 1024, originalPath: "/nonexistent/path/original.pdf" },
      });
      mockState.files[`${attDir}/original.pdf`] = pdfBuffer();
      mockState.attachmentDirs = ["original.pdf", "metadata.json"]; // readdir returns these

      const result = await attachmentsService.getAttachmentFilePath("att-123", "session-1");
      expect(result).not.toBeNull();
      expect(result!.path).toBe(`${attDir}/original.pdf`);
      expect(result!.mimeType).toBe("application/pdf");
    });

    test("should return null when originalPath and fallback both fail", async () => {
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson({
        sessionId: "session-1",
        metadata: { size: 1024, originalPath: "/nonexistent/path/original.pdf" },
      });
      mockState.attachmentDirs = ["metadata.json"]; // no original.* file
      const result = await attachmentsService.getAttachmentFilePath("att-123", "session-1");
      expect(result).toBeNull();
    });

    test("should return path, mimeType, and filename when originalPath exists", async () => {
      const originalPath = `${UPLOADS_BASE}/session-1/att-123/original.pdf`;
      mockState.files[originalPath] = pdfBuffer();
      mockState.files[`${UPLOADS_BASE}/session-1/att-123/metadata.json`] = makeMetadataJson({
        metadata: { size: 1024, originalPath },
      });

      const result = await attachmentsService.getAttachmentFilePath("att-123", "session-1");
      expect(result).not.toBeNull();
      expect(result!.path).toBe(originalPath);
      expect(result!.mimeType).toBe("application/pdf");
      expect(result!.filename).toBe("test.pdf");
    });
  });

  // -------------------------------------------------------------------------
  // cleanupOldAttachments()
  // -------------------------------------------------------------------------

  describe("cleanupOldAttachments()", () => {
    beforeEach(resetMockState);

    test("should return 0 when UPLOADS_BASE does not exist", async () => {
      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(0);
    });

    test("should not remove attachments newer than maxAge", async () => {
      // A file inside session-1 makes existsSync(UPLOADS_BASE) return true
      mockState.sessionDirs = ["session-1"];
      mockState.attachmentDirs = ["att-new"];
      mockState.files[`${UPLOADS_BASE}/session-1/att-new/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: new Date().toISOString() },
      });

      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(0);
    });

    test("should remove and count attachments older than maxAge", async () => {
      mockState.sessionDirs = ["session-old"];
      mockState.attachmentDirs = ["att-stale"];
      mockState.dirs.add(`${UPLOADS_BASE}/session-old`);
      mockState.attachmentDirsAfterRm = [];

      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      mockState.files[`${UPLOADS_BASE}/session-old/att-stale/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: oldDate },
      });

      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(1);
      expect(mockState.rmCalls.length).toBeGreaterThan(0);
    });

    test("should count and remove attachments with corrupted metadata", async () => {
      mockState.sessionDirs = ["session-corrupt"];
      mockState.attachmentDirs = ["att-corrupt"];
      mockState.dirs.add(`${UPLOADS_BASE}/session-corrupt`);
      mockState.attachmentDirsAfterRm = [];

      mockState.files[`${UPLOADS_BASE}/session-corrupt/att-corrupt/metadata.json`] =
        "INVALID JSON{{{{";

      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(1);
    });

    test("should remove empty session directories after attachment cleanup", async () => {
      mockState.sessionDirs = ["session-empty"];
      mockState.attachmentDirs = ["att-old"];
      mockState.dirs.add(`${UPLOADS_BASE}/session-empty`);
      mockState.attachmentDirsAfterRm = []; // empty after rm

      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      mockState.files[`${UPLOADS_BASE}/session-empty/att-old/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: oldDate },
      });

      await attachmentsService.cleanupOldAttachments(24);

      const sessionDirRemoved = mockState.rmCalls.some((p) => p.endsWith("session-empty"));
      expect(sessionDirRemoved).toBe(true);
    });

    test("should keep non-empty session directories after partial cleanup", async () => {
      mockState.sessionDirs = ["mixed-session"];
      mockState.attachmentDirs = ["att-old", "att-new"];
      mockState.dirs.add(`${UPLOADS_BASE}/mixed-session`);
      mockState.attachmentDirsAfterRm = ["att-new"]; // one remains

      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const recentDate = new Date().toISOString();

      mockState.files[`${UPLOADS_BASE}/mixed-session/att-old/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: oldDate },
      });
      mockState.files[`${UPLOADS_BASE}/mixed-session/att-new/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: recentDate },
      });

      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(1);

      const sessionDirRemoved = mockState.rmCalls.some(
        (p) => p === `${UPLOADS_BASE}/mixed-session`
      );
      expect(sessionDirRemoved).toBe(false);
    });

    test("should respect a custom maxAge parameter (1 hour)", async () => {
      mockState.sessionDirs = ["session-1"];
      mockState.attachmentDirs = ["att-1"];
      mockState.dirs.add(`${UPLOADS_BASE}/session-1`);
      mockState.attachmentDirsAfterRm = [];

      // 2 hours old - beyond a 1-hour limit, within a 24-hour limit
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      mockState.files[`${UPLOADS_BASE}/session-1/att-1/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: twoHoursAgo },
      });

      const count = await attachmentsService.cleanupOldAttachments(1);
      expect(count).toBe(1);
    });

    test("should find and clean up attachments in bucketed YYYY/MM paths", async () => {
      const bucketDir = `${UPLOADS_BASE}/${MOCK_BUCKET}/session-bucketed`;
      mockState.dirs.add(bucketDir);

      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      mockState.files[`${bucketDir}/att-old/metadata.json`] = JSON.stringify({
        metadata: { convertedAt: oldDate },
      });

      const count = await attachmentsService.cleanupOldAttachments(24);
      expect(count).toBe(1);
      expect(mockState.rmCalls.some((p) => p.includes("att-old"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Date-bucketed sharding (integration)
  // -------------------------------------------------------------------------

  describe("date-bucketed sharding", () => {
    beforeEach(resetMockState);

    test("processUpload should write to YYYY/MM bucketed path", async () => {
      mock.module("../../utils/fileTypeValidator", () => ({
        validateUpload: (_buf: Buffer, claimedMimeType: string) => ({
          isValid: true,
          detectedMimeType: claimedMimeType.split(";")[0]!.trim(),
          mismatch: false,
        }),
      }));
      const { attachmentsService: svc } = await import("../attachments");
      (svc as any).convertToMp3 = (attachmentsService as any).convertToMp3;

      const result = await svc.processUpload(
        "session-1",
        makeFile("doc.txt", "text/plain", Buffer.from("hello"))
      );

      // The storage path should contain the YYYY/MM bucket
      expect(result.storagePath).toContain(MOCK_BUCKET);
      expect(result.storagePath).toContain("session-1");
    });

    test("getAttachment should resolve from flat path via fallback", async () => {
      // Flat path (pre-migration)
      mockState.files[`${UPLOADS_BASE}/session-flat/att-flat/metadata.json`] = makeMetadataJson({
        id: "att-flat",
        sessionId: "session-flat",
      });

      const result = await attachmentsService.getAttachment("att-flat", "session-flat");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("att-flat");
    });

    test("getAttachment should prefer bucketed path over flat", async () => {
      const bucketDir = `${UPLOADS_BASE}/${MOCK_BUCKET}/session-both`;
      const flatDir = `${UPLOADS_BASE}/session-both`;

      // Both paths have metadata — bucketed should win
      mockState.files[`${bucketDir}/att-both/metadata.json`] = makeMetadataJson({
        id: "att-both",
        sessionId: "session-both",
        filename: "bucketed.pdf",
      });
      mockState.files[`${flatDir}/att-both/metadata.json`] = makeMetadataJson({
        id: "att-both",
        sessionId: "session-both",
        filename: "flat.pdf",
      });

      const result = await attachmentsService.getAttachment("att-both", "session-both");
      expect(result).not.toBeNull();
      expect(result!.filename).toBe("bucketed.pdf");
    });

    test("getSessionAttachments should resolve from flat path via fallback", async () => {
      mockState.dirs.add(`${UPLOADS_BASE}/session-flat`);
      mockState.attachmentDirs = ["att-1"];
      mockState.files[`${UPLOADS_BASE}/session-flat/att-1/metadata.json`] = makeMetadataJson({
        id: "att-1",
        sessionId: "session-flat",
      });

      const result = await attachmentsService.getSessionAttachments("session-flat");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("att-1");
    });
  });
});
