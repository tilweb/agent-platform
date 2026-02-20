/**
 * Tests for the Image Storage Service (backend/src/services/imageStorage.ts)
 *
 * fs/promises (mkdir, readdir, unlink) is mocked via mock.module().
 * Bun.file and Bun.write are patched via direct assignment (they are
 * writable properties) before the module under test is imported.
 * All mocks are set up before the dynamic import.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const MOCK_IMAGES_DIR = "/tmp/test-generated-images";

const mockState = {
  /** Simulated file system: path -> content (string | Buffer) */
  files: {} as Record<string, string | Buffer>,
  /** Paths that unlink was called with */
  unlinkedPaths: [] as string[],
  /** Whether mkdir was called */
  mkdirCalled: false,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  GENERATED_IMAGES_DIR: MOCK_IMAGES_DIR,
}));

mock.module("fs/promises", () => ({
  mkdir: async (_path: string, _opts?: unknown) => {
    mockState.mkdirCalled = true;
  },
  readdir: async (_path: string): Promise<string[]> => {
    const prefix = MOCK_IMAGES_DIR + "/";
    return Object.keys(mockState.files)
      .filter((p) => p.startsWith(prefix))
      .map((p) => p.slice(prefix.length));
  },
  unlink: async (path: string): Promise<void> => {
    if (mockState.files[path] === undefined) {
      const err = Object.assign(new Error(`ENOENT: no such file '${path}'`), {
        code: "ENOENT",
      });
      throw err;
    }
    mockState.unlinkedPaths.push(path);
    delete mockState.files[path];
  },
}));

// ---------------------------------------------------------------------------
// Patch Bun.file and Bun.write
//
// Both properties are writable (configurable: false, writable: true) so direct
// assignment works. We save originals to allow restoration if ever needed.
// ---------------------------------------------------------------------------

function makeMockBunFile(path: string) {
  return {
    exists: async (): Promise<boolean> => mockState.files[path] !== undefined,
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const content = mockState.files[path];
      if (content === undefined) throw new Error(`File not found: ${path}`);
      const buf = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content as string);
      return buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      ) as ArrayBuffer;
    },
    text: async (): Promise<string> => {
      const content = mockState.files[path];
      if (content === undefined) throw new Error(`File not found: ${path}`);
      return Buffer.isBuffer(content)
        ? content.toString("utf-8")
        : (content as string);
    },
  };
}

const _originalBunFile = Bun.file;
const _originalBunWrite = Bun.write;

(Bun as any).file = (path: string) => makeMockBunFile(path);
(Bun as any).write = async (
  path: string,
  content: string | Buffer | ArrayBuffer,
): Promise<number> => {
  if (content instanceof ArrayBuffer) {
    mockState.files[path] = Buffer.from(content);
  } else if (Buffer.isBuffer(content)) {
    mockState.files[path] = content;
  } else {
    mockState.files[path] = content as string;
  }
  return 0;
};

// ---------------------------------------------------------------------------
// Import the service AFTER all mocks are registered
// ---------------------------------------------------------------------------

const {
  saveGeneratedImage,
  getGeneratedImage,
  getImageMetadata,
  getImageMimeType,
  listGeneratedImages,
  deleteGeneratedImage,
} = await import("../imageStorage");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute path for a file inside the mock images directory */
function imgPath(filename: string): string {
  return `${MOCK_IMAGES_DIR}/${filename}`;
}

/** Store a metadata JSON object in the mock file system */
function seedMetadata(id: string, overrides: Record<string, unknown> = {}): void {
  const meta: Record<string, unknown> = {
    id,
    prompt: "a red dragon",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    provider: "openai",
    model: "dall-e-3",
    createdAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
  mockState.files[imgPath(`${id}.json`)] = JSON.stringify(meta, null, 2);
}

/** Store a fake image buffer in the mock file system */
function seedImage(id: string, ext: string, content = "fake-image-bytes"): void {
  mockState.files[imgPath(`${id}.${ext}`)] = Buffer.from(content);
}

/** Minimal valid input for saveGeneratedImage */
function makeSaveInput(
  overrides: Partial<Parameters<typeof saveGeneratedImage>[0]> = {},
) {
  return {
    id: "img-001",
    base64Data: Buffer.from("fake-png-data").toString("base64"),
    mimeType: "image/png" as string,
    width: 512,
    height: 512,
    prompt: "a blue whale",
    provider: "openai",
    model: "dall-e-3",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("saveGeneratedImage()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.unlinkedPaths = [];
    mockState.mkdirCalled = false;
  });

  test("should return the correct id, url, and path", async () => {
    const result = await saveGeneratedImage(makeSaveInput({ id: "img-abc" }));

    expect(result.id).toBe("img-abc");
    expect(result.url).toBe("/api/images/generated/img-abc");
    expect(result.path).toBe(imgPath("img-abc.png"));
  });

  test("should write the decoded image buffer to disk", async () => {
    const rawBytes = "raw-image-content";
    const input = makeSaveInput({
      id: "img-buf",
      base64Data: Buffer.from(rawBytes).toString("base64"),
      mimeType: "image/png",
    });

    await saveGeneratedImage(input);

    const stored = mockState.files[imgPath("img-buf.png")];
    expect(stored).toBeDefined();
    expect(Buffer.isBuffer(stored)).toBe(true);
    expect((stored as Buffer).toString()).toBe(rawBytes);
  });

  test("should write a JSON metadata file alongside the image", async () => {
    await saveGeneratedImage(makeSaveInput({ id: "img-meta" }));

    const raw = mockState.files[imgPath("img-meta.json")];
    expect(raw).toBeDefined();

    const meta = JSON.parse(raw as string);
    expect(meta.id).toBe("img-meta");
    expect(meta.prompt).toBe("a blue whale");
    expect(meta.provider).toBe("openai");
    expect(meta.model).toBe("dall-e-3");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.mimeType).toBe("image/png");
  });

  test("should persist optional sessionId and revisedPrompt in metadata", async () => {
    await saveGeneratedImage(
      makeSaveInput({
        id: "img-opt",
        sessionId: "sess-42",
        revisedPrompt: "a large blue whale in the ocean",
      }),
    );

    const meta = JSON.parse(
      mockState.files[imgPath("img-opt.json")] as string,
    );
    expect(meta.sessionId).toBe("sess-42");
    expect(meta.revisedPrompt).toBe("a large blue whale in the ocean");
  });

  test("should record a valid ISO createdAt timestamp", async () => {
    const before = new Date().toISOString();
    await saveGeneratedImage(makeSaveInput({ id: "img-ts" }));
    const after = new Date().toISOString();

    const meta = JSON.parse(
      mockState.files[imgPath("img-ts.json")] as string,
    );
    expect(meta.createdAt >= before).toBe(true);
    expect(meta.createdAt <= after).toBe(true);
  });

  test("should use .jpg extension for image/jpeg mime type", async () => {
    const result = await saveGeneratedImage(
      makeSaveInput({ id: "img-jpg", mimeType: "image/jpeg" }),
    );

    expect(result.path).toBe(imgPath("img-jpg.jpg"));
    expect(mockState.files[imgPath("img-jpg.jpg")]).toBeDefined();
  });

  test("should use .jpg extension for image/jpg mime type", async () => {
    const result = await saveGeneratedImage(
      makeSaveInput({ id: "img-jpg2", mimeType: "image/jpg" }),
    );

    expect(result.path).toBe(imgPath("img-jpg2.jpg"));
  });

  test("should use .webp extension for image/webp mime type", async () => {
    const result = await saveGeneratedImage(
      makeSaveInput({ id: "img-webp", mimeType: "image/webp" }),
    );

    expect(result.path).toBe(imgPath("img-webp.webp"));
  });

  test("should use .gif extension for image/gif mime type", async () => {
    const result = await saveGeneratedImage(
      makeSaveInput({ id: "img-gif", mimeType: "image/gif" }),
    );

    expect(result.path).toBe(imgPath("img-gif.gif"));
  });

  test("should fall back to .png extension for unknown mime type", async () => {
    const result = await saveGeneratedImage(
      makeSaveInput({ id: "img-unknown", mimeType: "image/tiff" }),
    );

    expect(result.path).toBe(imgPath("img-unknown.png"));
  });

  test("should call mkdir to ensure the images directory exists", async () => {
    await saveGeneratedImage(makeSaveInput({ id: "img-mkdir" }));

    expect(mockState.mkdirCalled).toBe(true);
  });

  test("should produce a URL of /api/images/generated/<id>", async () => {
    const result = await saveGeneratedImage(makeSaveInput({ id: "my-image-id" }));

    expect(result.url).toBe("/api/images/generated/my-image-id");
  });
});

// ---------------------------------------------------------------------------

describe("getGeneratedImage()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.unlinkedPaths = [];
  });

  test("should return a Buffer when a .png file exists", async () => {
    seedImage("img-get", "png", "png-bytes");

    const result = await getGeneratedImage("img-get");

    expect(result).not.toBeNull();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result!.toString()).toBe("png-bytes");
  });

  test("should find a .jpg file", async () => {
    seedImage("img-get-jpg", "jpg", "jpg-bytes");

    const result = await getGeneratedImage("img-get-jpg");

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe("jpg-bytes");
  });

  test("should find a .jpeg file", async () => {
    seedImage("img-get-jpeg", "jpeg", "jpeg-bytes");

    const result = await getGeneratedImage("img-get-jpeg");

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe("jpeg-bytes");
  });

  test("should find a .webp file", async () => {
    seedImage("img-get-webp", "webp", "webp-bytes");

    const result = await getGeneratedImage("img-get-webp");

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe("webp-bytes");
  });

  test("should find a .gif file", async () => {
    seedImage("img-get-gif", "gif", "gif-bytes");

    const result = await getGeneratedImage("img-get-gif");

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe("gif-bytes");
  });

  test("should return null when no image file exists for the given id", async () => {
    const result = await getGeneratedImage("nonexistent-id");

    expect(result).toBeNull();
  });

  test("should return null when only the metadata JSON exists (no image file)", async () => {
    seedMetadata("meta-only");

    const result = await getGeneratedImage("meta-only");

    expect(result).toBeNull();
  });

  test("should return .png content when both .png and .jpg exist (png checked first)", async () => {
    seedImage("img-multi", "png", "png-content");
    seedImage("img-multi", "jpg", "jpg-content");

    const result = await getGeneratedImage("img-multi");

    expect(result).not.toBeNull();
    expect(result!.toString()).toBe("png-content");
  });
});

// ---------------------------------------------------------------------------

describe("getImageMetadata()", () => {
  beforeEach(() => {
    mockState.files = {};
  });

  test("should return the parsed metadata object when the JSON file exists", async () => {
    seedMetadata("img-m1", {
      prompt: "a sunset",
      mimeType: "image/jpeg",
      width: 800,
      height: 600,
    });

    const meta = await getImageMetadata("img-m1");

    expect(meta).not.toBeNull();
    expect(meta!.id).toBe("img-m1");
    expect(meta!.prompt).toBe("a sunset");
    expect(meta!.mimeType).toBe("image/jpeg");
    expect(meta!.width).toBe(800);
    expect(meta!.height).toBe(600);
  });

  test("should return all required SavedImageMetadata fields", async () => {
    seedMetadata("img-m-fields");

    const meta = await getImageMetadata("img-m-fields");

    expect(meta).not.toBeNull();
    expect(typeof meta!.id).toBe("string");
    expect(typeof meta!.prompt).toBe("string");
    expect(typeof meta!.mimeType).toBe("string");
    expect(typeof meta!.width).toBe("number");
    expect(typeof meta!.height).toBe("number");
    expect(typeof meta!.provider).toBe("string");
    expect(typeof meta!.model).toBe("string");
    expect(typeof meta!.createdAt).toBe("string");
  });

  test("should return null when no metadata file exists", async () => {
    const meta = await getImageMetadata("no-such-id");

    expect(meta).toBeNull();
  });

  test("should return optional fields when present in the JSON", async () => {
    seedMetadata("img-m2", {
      sessionId: "sess-99",
      revisedPrompt: "a vibrant sunset over the ocean",
    });

    const meta = await getImageMetadata("img-m2");

    expect(meta!.sessionId).toBe("sess-99");
    expect(meta!.revisedPrompt).toBe("a vibrant sunset over the ocean");
  });

  test("should return undefined for optional fields when they are absent", async () => {
    seedMetadata("img-m3");

    const meta = await getImageMetadata("img-m3");

    expect(meta!.sessionId).toBeUndefined();
    expect(meta!.revisedPrompt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("getImageMimeType()", () => {
  beforeEach(() => {
    mockState.files = {};
  });

  test("should return the mimeType from metadata when the image exists", async () => {
    seedMetadata("img-mime1", { mimeType: "image/webp" });

    const result = await getImageMimeType("img-mime1");

    expect(result).toBe("image/webp");
  });

  test("should return null when no metadata file exists", async () => {
    const result = await getImageMimeType("no-such-id");

    expect(result).toBeNull();
  });

  test("should return image/png for png metadata", async () => {
    seedMetadata("img-mime2", { mimeType: "image/png" });

    const result = await getImageMimeType("img-mime2");

    expect(result).toBe("image/png");
  });

  test("should return image/jpeg for jpeg metadata", async () => {
    seedMetadata("img-mime3", { mimeType: "image/jpeg" });

    const result = await getImageMimeType("img-mime3");

    expect(result).toBe("image/jpeg");
  });

  test("should return image/gif for gif metadata", async () => {
    seedMetadata("img-mime4", { mimeType: "image/gif" });

    const result = await getImageMimeType("img-mime4");

    expect(result).toBe("image/gif");
  });
});

// ---------------------------------------------------------------------------

describe("listGeneratedImages()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.unlinkedPaths = [];
  });

  test("should return empty images array and total 0 when no files exist", async () => {
    const result = await listGeneratedImages();

    expect(result.images).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("should return all images when no filters are applied", async () => {
    seedMetadata("img-list-1", { createdAt: "2026-01-10T08:00:00.000Z" });
    seedMetadata("img-list-2", { createdAt: "2026-01-11T08:00:00.000Z" });
    seedMetadata("img-list-3", { createdAt: "2026-01-12T08:00:00.000Z" });

    const result = await listGeneratedImages();

    expect(result.total).toBe(3);
    expect(result.images).toHaveLength(3);
  });

  test("should ignore non-JSON files in the directory", async () => {
    seedMetadata("img-list-json", { createdAt: "2026-01-10T08:00:00.000Z" });
    seedImage("img-list-png-only", "png");

    const result = await listGeneratedImages();

    expect(result.total).toBe(1);
    expect(result.images[0]!.id).toBe("img-list-json");
  });

  test("should sort images by createdAt descending (newest first)", async () => {
    seedMetadata("img-old", { createdAt: "2026-01-01T00:00:00.000Z" });
    seedMetadata("img-mid", { createdAt: "2026-01-15T00:00:00.000Z" });
    seedMetadata("img-new", { createdAt: "2026-02-01T00:00:00.000Z" });

    const result = await listGeneratedImages();

    expect(result.images[0]!.id).toBe("img-new");
    expect(result.images[1]!.id).toBe("img-mid");
    expect(result.images[2]!.id).toBe("img-old");
  });

  test("should filter by sessionId when provided", async () => {
    seedMetadata("img-s1", {
      sessionId: "session-A",
      createdAt: "2026-01-10T00:00:00.000Z",
    });
    seedMetadata("img-s2", {
      sessionId: "session-B",
      createdAt: "2026-01-11T00:00:00.000Z",
    });
    seedMetadata("img-s3", {
      sessionId: "session-A",
      createdAt: "2026-01-12T00:00:00.000Z",
    });

    const result = await listGeneratedImages({ sessionId: "session-A" });

    expect(result.total).toBe(2);
    expect(result.images.every((i) => i.sessionId === "session-A")).toBe(true);
  });

  test("should return empty array when sessionId filter matches nothing", async () => {
    seedMetadata("img-filter-none", { sessionId: "session-X" });

    const result = await listGeneratedImages({ sessionId: "session-Z" });

    expect(result.images).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("should apply limit correctly", async () => {
    seedMetadata("img-pg1", { createdAt: "2026-01-01T00:00:00.000Z" });
    seedMetadata("img-pg2", { createdAt: "2026-01-02T00:00:00.000Z" });
    seedMetadata("img-pg3", { createdAt: "2026-01-03T00:00:00.000Z" });
    seedMetadata("img-pg4", { createdAt: "2026-01-04T00:00:00.000Z" });
    seedMetadata("img-pg5", { createdAt: "2026-01-05T00:00:00.000Z" });

    const result = await listGeneratedImages({ limit: 2 });

    expect(result.total).toBe(5);
    expect(result.images).toHaveLength(2);
  });

  test("should apply offset correctly", async () => {
    seedMetadata("img-off1", { createdAt: "2026-01-03T00:00:00.000Z" });
    seedMetadata("img-off2", { createdAt: "2026-01-02T00:00:00.000Z" });
    seedMetadata("img-off3", { createdAt: "2026-01-01T00:00:00.000Z" });

    // Descending sort: off1, off2, off3 — skip first 1
    const result = await listGeneratedImages({ offset: 1 });

    expect(result.total).toBe(3);
    expect(result.images).toHaveLength(2);
    expect(result.images[0]!.id).toBe("img-off2");
  });

  test("should apply both limit and offset together", async () => {
    for (let i = 1; i <= 6; i++) {
      seedMetadata(`img-combo-${i}`, {
        createdAt: `2026-01-${String(i).padStart(2, "0")}T00:00:00.000Z`,
      });
    }

    // Descending sort: combo-6, combo-5, combo-4, combo-3, combo-2, combo-1
    const result = await listGeneratedImages({ offset: 2, limit: 2 });

    expect(result.total).toBe(6);
    expect(result.images).toHaveLength(2);
    expect(result.images[0]!.id).toBe("img-combo-4");
    expect(result.images[1]!.id).toBe("img-combo-3");
  });

  test("should default to limit 50 when not specified", async () => {
    for (let i = 1; i <= 55; i++) {
      seedMetadata(`img-def-${String(i).padStart(3, "0")}`, {
        createdAt: `2026-01-01T${String(i % 24).padStart(2, "0")}:${String(i).padStart(2, "0")}:00.000Z`,
      });
    }

    const result = await listGeneratedImages();

    expect(result.total).toBe(55);
    expect(result.images).toHaveLength(50);
  });

  test("should skip corrupted metadata files without throwing", async () => {
    seedMetadata("img-valid", { createdAt: "2026-01-10T00:00:00.000Z" });
    mockState.files[imgPath("corrupt.json")] = "NOT_VALID_JSON";

    const result = await listGeneratedImages();

    expect(result.total).toBe(1);
    expect(result.images[0]!.id).toBe("img-valid");
  });

  test("total reflects unfiltered count before pagination", async () => {
    seedMetadata("img-tot1", { createdAt: "2026-01-01T00:00:00.000Z" });
    seedMetadata("img-tot2", { createdAt: "2026-01-02T00:00:00.000Z" });
    seedMetadata("img-tot3", { createdAt: "2026-01-03T00:00:00.000Z" });

    const result = await listGeneratedImages({ limit: 1 });

    expect(result.total).toBe(3);
    expect(result.images).toHaveLength(1);
  });

  test("should return images with all expected metadata fields", async () => {
    seedMetadata("img-fields", {
      prompt: "a castle",
      mimeType: "image/png",
      width: 1024,
      height: 768,
      provider: "anthropic",
      model: "claude-imagine",
      createdAt: "2026-01-20T10:00:00.000Z",
    });

    const result = await listGeneratedImages();

    const img = result.images[0]!;
    expect(img.id).toBe("img-fields");
    expect(img.prompt).toBe("a castle");
    expect(img.mimeType).toBe("image/png");
    expect(img.width).toBe(1024);
    expect(img.height).toBe(768);
    expect(img.provider).toBe("anthropic");
    expect(img.model).toBe("claude-imagine");
    expect(img.createdAt).toBe("2026-01-20T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------

describe("deleteGeneratedImage()", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.unlinkedPaths = [];
  });

  test("should return true when both the image and metadata are deleted", async () => {
    seedImage("img-del", "png");
    seedMetadata("img-del");

    const result = await deleteGeneratedImage("img-del");

    expect(result).toBe(true);
  });

  test("should remove the image file from the mock file system", async () => {
    seedImage("img-del-fs", "png");
    seedMetadata("img-del-fs");

    await deleteGeneratedImage("img-del-fs");

    expect(mockState.files[imgPath("img-del-fs.png")]).toBeUndefined();
  });

  test("should remove the metadata JSON file from the mock file system", async () => {
    seedImage("img-del-meta", "png");
    seedMetadata("img-del-meta");

    await deleteGeneratedImage("img-del-meta");

    expect(mockState.files[imgPath("img-del-meta.json")]).toBeUndefined();
  });

  test("should return true when only the metadata JSON exists (no image file)", async () => {
    seedMetadata("img-del-metaonly");

    const result = await deleteGeneratedImage("img-del-metaonly");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-metaonly.json")]).toBeUndefined();
  });

  test("should return false when neither image file nor metadata exists", async () => {
    const result = await deleteGeneratedImage("nonexistent-id");

    expect(result).toBe(false);
  });

  test("should find and delete a .jpg image file", async () => {
    seedImage("img-del-jpg", "jpg");
    seedMetadata("img-del-jpg");

    const result = await deleteGeneratedImage("img-del-jpg");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-jpg.jpg")]).toBeUndefined();
  });

  test("should find and delete a .webp image file", async () => {
    seedImage("img-del-webp", "webp");
    seedMetadata("img-del-webp");

    const result = await deleteGeneratedImage("img-del-webp");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-webp.webp")]).toBeUndefined();
  });

  test("should find and delete a .gif image file", async () => {
    seedImage("img-del-gif", "gif");
    seedMetadata("img-del-gif");

    const result = await deleteGeneratedImage("img-del-gif");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-gif.gif")]).toBeUndefined();
  });

  test("should return true when only the image file exists (no metadata)", async () => {
    seedImage("img-del-nomet", "png");

    const result = await deleteGeneratedImage("img-del-nomet");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-nomet.png")]).toBeUndefined();
  });

  test("should leave no files behind after a complete deletion", async () => {
    seedImage("img-del-clean", "png");
    seedMetadata("img-del-clean");

    await deleteGeneratedImage("img-del-clean");

    const remaining = Object.keys(mockState.files).filter((p) =>
      p.includes("img-del-clean"),
    );
    expect(remaining).toHaveLength(0);
  });

  test("should find and delete a .jpeg image file", async () => {
    seedImage("img-del-jpeg", "jpeg");
    seedMetadata("img-del-jpeg");

    const result = await deleteGeneratedImage("img-del-jpeg");

    expect(result).toBe(true);
    expect(mockState.files[imgPath("img-del-jpeg.jpeg")]).toBeUndefined();
  });
});
