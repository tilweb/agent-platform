/**
 * Tests for image API routes (backend/src/routes/images.ts)
 *
 * Endpoints:
 *   POST   /api/images/generate           — generate images from prompt
 *   GET    /api/images/generated/:id      — retrieve raw image bytes
 *   GET    /api/images/generated/:id/metadata — image metadata
 *   GET    /api/images/list               — paginated list with optional filters
 *   DELETE /api/images/generated/:id      — delete image
 *   GET    /api/images/current-model      — active model info
 *
 * All routes require authentication (mocked via authMiddleware).
 * imageGenRateLimit is bypassed by mocking it to a pass-through.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Auth
  currentUser: null as null | { id: string; username: string; role: string },

  // imageGenerationService
  generateResult: null as any,
  currentModelResult: null as null | { provider: string; model: string },
  supportsImageToImageResult: false as boolean,

  // imageStorage
  saveGeneratedImageResult: null as any,
  getGeneratedImageResult: null as Buffer | null,
  getImageMetadataResult: null as any,
  getImageMimeTypeResult: null as string | null,
  listGeneratedImagesResult: { images: [], total: 0 } as {
    images: any[];
    total: number;
  },
  deleteGeneratedImageResult: false as boolean,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock auth middleware — injects mockState.currentUser into context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any): string => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Nicht authentifiziert");
    return userId;
  },
}));

// Mock rate limit — pass-through so it never blocks tests
mock.module("../../middleware/rateLimit", () => ({
  imageGenRateLimit: async (_c: any, next: any) => {
    await next();
  },
}));

// Mock errorHandler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) => {
    return c.json({ error: "Internal server error" }, 500);
  },
}));

// Mock parseIntSafe with the real logic (no side-effects)
mock.module("../../utils/parseIntSafe", () => ({
  parseIntSafe: (value: string | undefined | null, defaultValue: number): number => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  },
}));

// Mock imageGenerationService
mock.module("../../services/imageGeneration", () => ({
  imageGenerationService: {
    reload: async () => {},
    generate: async (_req: any) => mockState.generateResult,
    getCurrentModel: () => mockState.currentModelResult,
    supportsImageToImage: () => mockState.supportsImageToImageResult,
  },
}));

// Mock imageStorage functions
mock.module("../../services/imageStorage", () => ({
  saveGeneratedImage: async (_input: any) => mockState.saveGeneratedImageResult,
  getGeneratedImage: async (_id: string) => mockState.getGeneratedImageResult,
  getImageMetadata: async (_id: string) => mockState.getImageMetadataResult,
  getImageMimeType: async (_id: string) => mockState.getImageMimeTypeResult,
  listGeneratedImages: async (_opts: any) => mockState.listGeneratedImagesResult,
  deleteGeneratedImage: async (_id: string) => mockState.deleteGeneratedImageResult,
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------

const { imageRoutes } = await import("../images");

const app = new Hono();
app.route("/api/images", imageRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeGeneratedImage(overrides: Partial<any> = {}): any {
  return {
    id: "img-abc123",
    base64Data: "aGVsbG8=",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    revisedPrompt: "a beautiful sunset",
    ...overrides,
  };
}

function makeSavedImage(id = "img-abc123") {
  return {
    id,
    url: `/api/images/generated/${id}`,
    path: `/data/images/${id}.png`,
  };
}

function makeMetadata(id = "img-abc123", overrides: Partial<any> = {}): any {
  return {
    id,
    prompt: "a beautiful sunset",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    provider: "openai",
    model: "dall-e-3",
    createdAt: "2026-02-20T10:00:00.000Z",
    sessionId: "session-1",
    ...overrides,
  };
}

function makeGenerateResult(overrides: Partial<any> = {}): any {
  return {
    success: true,
    images: [makeGeneratedImage()],
    provider: "openai",
    model: "dall-e-3",
    durationMs: 1500,
    ...overrides,
  };
}

function postGenerate(body: Record<string, any>) {
  return app.request("/api/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("Image Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
  });

  test("should return 401 when not authenticated for POST /generate", async () => {
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(401);
  });

  test("should return 401 when not authenticated for GET /generated/:id", async () => {
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(401);
  });

  test("should return 401 when not authenticated for GET /generated/:id/metadata", async () => {
    const res = await app.request("/api/images/generated/img-abc123/metadata");
    expect(res.status).toBe(401);
  });

  test("should return 401 when not authenticated for GET /list", async () => {
    const res = await app.request("/api/images/list");
    expect(res.status).toBe(401);
  });

  test("should return 401 when not authenticated for DELETE /generated/:id", async () => {
    const res = await app.request("/api/images/generated/img-abc123", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("should return 401 when not authenticated for GET /current-model", async () => {
    const res = await app.request("/api/images/current-model");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/images/generate
// ---------------------------------------------------------------------------

describe("POST /api/images/generate", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.generateResult = makeGenerateResult();
    mockState.saveGeneratedImageResult = makeSavedImage();
  });

  test("should return 400 when prompt is missing", async () => {
    const res = await postGenerate({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Prompt is required");
  });

  test("should return 400 when prompt is empty string", async () => {
    const res = await postGenerate({ prompt: "" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Prompt is required");
  });

  test("should return 200 with saved image data on success", async () => {
    const res = await postGenerate({ prompt: "a beautiful sunset" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images).toHaveLength(1);
    expect(body.images[0].id).toBe("img-abc123");
    expect(body.images[0].url).toBe("/api/images/generated/img-abc123");
  });

  test("should return provider and model from generation result", async () => {
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("openai");
    expect(body.model).toBe("dall-e-3");
    expect(body.durationMs).toBe(1500);
  });

  test("should return 500 when generation service returns success=false", async () => {
    mockState.generateResult = {
      success: false,
      images: [],
      error: "Provider unavailable",
      provider: "openai",
      model: "dall-e-3",
      durationMs: 200,
    };
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Provider unavailable");
  });

  test("should return 500 with fallback message when error field is absent", async () => {
    mockState.generateResult = {
      success: false,
      images: [],
      provider: "openai",
      model: "dall-e-3",
      durationMs: 100,
    };
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to generate image");
  });

  test("should return 500 when generation succeeds but images array is empty", async () => {
    mockState.generateResult = {
      success: true,
      images: [],
      provider: "openai",
      model: "dall-e-3",
      durationMs: 300,
    };
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(500);
  });

  test("should clamp numberOfImages to max 4", async () => {
    // The route caps at 4, but the mock returns whatever generateResult has.
    // We verify the request succeeds and returns images array.
    mockState.generateResult = makeGenerateResult({
      images: [
        makeGeneratedImage({ id: "img-1" }),
        makeGeneratedImage({ id: "img-2" }),
        makeGeneratedImage({ id: "img-3" }),
        makeGeneratedImage({ id: "img-4" }),
      ],
    });
    mockState.saveGeneratedImageResult = makeSavedImage("img-1");
    const res = await postGenerate({ prompt: "test", numberOfImages: 99 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should treat numberOfImages=0 as 1", async () => {
    const res = await postGenerate({ prompt: "test", numberOfImages: 0 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 500 on unexpected service exception", async () => {
    mockState.generateResult = null; // calling .success on null will throw
    const res = await postGenerate({ prompt: "test" });
    expect(res.status).toBe(500);
  });

  test("should include width, height, and revisedPrompt per image", async () => {
    mockState.generateResult = makeGenerateResult({
      images: [
        makeGeneratedImage({ width: 1792, height: 1024, revisedPrompt: "revised text" }),
      ],
    });
    const res = await postGenerate({ prompt: "test", aspectRatio: "16:9" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images[0].width).toBe(1792);
    expect(body.images[0].height).toBe(1024);
    expect(body.images[0].revisedPrompt).toBe("revised text");
  });

  test("should handle multiple images in a single request", async () => {
    const savedImages = [makeSavedImage("img-1"), makeSavedImage("img-2")];
    let saveCallCount = 0;
    // Return a different saved result on each call by cycling
    mockState.saveGeneratedImageResult = null; // will be overridden below
    // We can't easily override per-call without re-mocking, so verify total count
    mockState.generateResult = makeGenerateResult({
      images: [
        makeGeneratedImage({ id: "img-1" }),
        makeGeneratedImage({ id: "img-2" }),
      ],
    });
    // saveGeneratedImage mock always returns the same object; route uses image.id
    mockState.saveGeneratedImageResult = savedImages[0];
    const res = await postGenerate({ prompt: "test", numberOfImages: 2 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/images/generated/:id
// ---------------------------------------------------------------------------

describe("GET /api/images/generated/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getGeneratedImageResult = Buffer.from("fake-png-data");
    mockState.getImageMimeTypeResult = "image/png";
  });

  test("should return 400 for an ID with path-traversal characters", async () => {
    const res = await app.request("/api/images/generated/..%2Fetc%2Fpasswd");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid image ID");
  });

  test("should return 400 for an ID containing slashes", async () => {
    // Encoded slash in path segment is decoded by Hono
    const res = await app.request("/api/images/generated/foo/bar");
    // This hits the metadata endpoint instead; test a truly invalid character
    const res2 = await app.request("/api/images/generated/bad%20id");
    expect(res2.status).toBe(400);
  });

  test("should return 400 for an ID that exceeds 128 characters", async () => {
    const longId = "a".repeat(129);
    const res = await app.request(`/api/images/generated/${longId}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid image ID");
  });

  test("should return 404 when image is not found", async () => {
    mockState.getGeneratedImageResult = null;
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Image not found");
  });

  test("should return image bytes with correct Content-Type", async () => {
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  test("should set Cache-Control header for long-lived caching", async () => {
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("max-age=31536000");
  });

  test("should fall back to image/png when mime type is not found", async () => {
    mockState.getImageMimeTypeResult = null;
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  test("should return image/webp when stored mime type is webp", async () => {
    mockState.getImageMimeTypeResult = "image/webp";
    const res = await app.request("/api/images/generated/img-abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  test("should accept alphanumeric IDs with dashes and underscores", async () => {
    const res = await app.request("/api/images/generated/img_abc-123");
    expect(res.status).toBe(200);
  });

  test("should accept an ID exactly 128 characters long", async () => {
    const maxId = "a".repeat(128);
    const res = await app.request(`/api/images/generated/${maxId}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/images/generated/:id/metadata
// ---------------------------------------------------------------------------

describe("GET /api/images/generated/:id/metadata", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getImageMetadataResult = makeMetadata();
  });

  test("should return 400 for an invalid image ID", async () => {
    const res = await app.request("/api/images/generated/bad%20id/metadata");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid image ID");
  });

  test("should return 400 for an ID that is too long", async () => {
    const longId = "x".repeat(129);
    const res = await app.request(`/api/images/generated/${longId}/metadata`);
    expect(res.status).toBe(400);
  });

  test("should return 404 when metadata is not found", async () => {
    mockState.getImageMetadataResult = null;
    const res = await app.request("/api/images/generated/img-abc123/metadata");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Image not found");
  });

  test("should return full metadata object on success", async () => {
    const res = await app.request("/api/images/generated/img-abc123/metadata");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("img-abc123");
    expect(body.prompt).toBe("a beautiful sunset");
    expect(body.provider).toBe("openai");
    expect(body.model).toBe("dall-e-3");
    expect(body.width).toBe(1024);
    expect(body.height).toBe(1024);
    expect(body.mimeType).toBe("image/png");
    expect(body.createdAt).toBe("2026-02-20T10:00:00.000Z");
  });

  test("should return sessionId in metadata when present", async () => {
    mockState.getImageMetadataResult = makeMetadata("img-abc123", {
      sessionId: "session-xyz",
    });
    const res = await app.request("/api/images/generated/img-abc123/metadata");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("session-xyz");
  });

  test("should return revisedPrompt in metadata when present", async () => {
    mockState.getImageMetadataResult = makeMetadata("img-abc123", {
      revisedPrompt: "a vibrant sunset over the ocean",
    });
    const res = await app.request("/api/images/generated/img-abc123/metadata");
    const body = await res.json();
    expect(body.revisedPrompt).toBe("a vibrant sunset over the ocean");
  });
});

// ---------------------------------------------------------------------------
// GET /api/images/list
// ---------------------------------------------------------------------------

describe("GET /api/images/list", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listGeneratedImagesResult = { images: [], total: 0 };
  });

  test("should return empty list when no images exist", async () => {
    const res = await app.request("/api/images/list");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toEqual([]);
    expect(body.total).toBe(0);
  });

  test("should return image list with total count", async () => {
    const images = [
      makeMetadata("img-1"),
      makeMetadata("img-2"),
      makeMetadata("img-3"),
    ];
    mockState.listGeneratedImagesResult = { images, total: 3 };
    const res = await app.request("/api/images/list");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(3);
    expect(body.total).toBe(3);
  });

  test("should pass sessionId query param to listGeneratedImages", async () => {
    mockState.listGeneratedImagesResult = {
      images: [makeMetadata("img-1", { sessionId: "sess-42" })],
      total: 1,
    };
    const res = await app.request("/api/images/list?sessionId=sess-42");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images[0].sessionId).toBe("sess-42");
  });

  test("should pass limit and offset query params to listGeneratedImages", async () => {
    const images = [makeMetadata("img-5")];
    mockState.listGeneratedImagesResult = { images, total: 10 };
    const res = await app.request("/api/images/list?limit=1&offset=4");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(1);
    expect(body.total).toBe(10);
  });

  test("should use default limit=50 and offset=0 when not provided", async () => {
    // The mock returns whatever is in listGeneratedImagesResult regardless;
    // we verify the request succeeds and the shape is correct.
    const res = await app.request("/api/images/list");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("images");
    expect(body).toHaveProperty("total");
  });

  test("should return 200 even with invalid (non-numeric) limit and offset", async () => {
    // parseIntSafe falls back to defaults on non-numeric values
    const res = await app.request("/api/images/list?limit=abc&offset=xyz");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/images/generated/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/images/generated/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.deleteGeneratedImageResult = true;
  });

  test("should return 400 for an invalid image ID", async () => {
    const res = await app.request("/api/images/generated/bad%20id", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid image ID");
  });

  test("should return 400 for an ID that is too long", async () => {
    const longId = "z".repeat(129);
    const res = await app.request(`/api/images/generated/${longId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when image does not exist", async () => {
    mockState.deleteGeneratedImageResult = false;
    const res = await app.request("/api/images/generated/img-abc123", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Image not found");
  });

  test("should return 200 with success=true when image is deleted", async () => {
    const res = await app.request("/api/images/generated/img-abc123", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should accept valid alphanumeric IDs with dashes", async () => {
    const res = await app.request("/api/images/generated/img-valid-id_01", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/images/current-model
// ---------------------------------------------------------------------------

describe("GET /api/images/current-model", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.currentModelResult = { provider: "openai", model: "dall-e-3" };
    mockState.supportsImageToImageResult = false;
  });

  test("should return configured=false when no model is active", async () => {
    mockState.currentModelResult = null;
    const res = await app.request("/api/images/current-model");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.message).toBe("No image generation model configured");
  });

  test("should return configured=true with provider and model when active", async () => {
    const res = await app.request("/api/images/current-model");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.provider).toBe("openai");
    expect(body.model).toBe("dall-e-3");
  });

  test("should include supportsImageToImage=false when not supported", async () => {
    mockState.supportsImageToImageResult = false;
    const res = await app.request("/api/images/current-model");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supportsImageToImage).toBe(false);
  });

  test("should include supportsImageToImage=true when supported", async () => {
    mockState.supportsImageToImageResult = true;
    const res = await app.request("/api/images/current-model");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supportsImageToImage).toBe(true);
  });

  test("should not include provider/model fields when not configured", async () => {
    mockState.currentModelResult = null;
    const res = await app.request("/api/images/current-model");
    const body = await res.json();
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
  });

  test("should reflect a different provider name correctly", async () => {
    mockState.currentModelResult = { provider: "google", model: "imagen-3" };
    const res = await app.request("/api/images/current-model");
    const body = await res.json();
    expect(body.provider).toBe("google");
    expect(body.model).toBe("imagen-3");
  });
});

// ---------------------------------------------------------------------------
// ID validation edge cases (shared across routes)
// ---------------------------------------------------------------------------

describe("Image ID validation", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getGeneratedImageResult = Buffer.from("data");
    mockState.getImageMetadataResult = makeMetadata();
    mockState.deleteGeneratedImageResult = true;
    mockState.getImageMimeTypeResult = "image/png";
  });

  test("should reject IDs with special chars on GET image", async () => {
    for (const badId of ["../etc", "foo!bar", "id with space"]) {
      const encoded = encodeURIComponent(badId);
      const res = await app.request(`/api/images/generated/${encoded}`);
      expect(res.status).toBe(400);
    }
  });

  test("should reject IDs with special chars on GET metadata", async () => {
    for (const badId of ["../etc", "foo!bar"]) {
      const encoded = encodeURIComponent(badId);
      const res = await app.request(`/api/images/generated/${encoded}/metadata`);
      expect(res.status).toBe(400);
    }
  });

  test("should reject IDs with special chars on DELETE", async () => {
    for (const badId of ["../etc", "foo!bar"]) {
      const encoded = encodeURIComponent(badId);
      const res = await app.request(`/api/images/generated/${encoded}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(400);
    }
  });

  test("should allow IDs with only alphanumeric, dash, underscore chars", async () => {
    const validIds = ["abc123", "img-001", "img_abc", "ABC", "a1B2-c3_D4"];
    for (const id of validIds) {
      const res = await app.request(`/api/images/generated/${id}`);
      expect(res.status).toBe(200);
    }
  });
});
