/**
 * Tests for ImageGenerationService (backend/src/services/imageGeneration.ts)
 *
 * All external dependencies — providers, adapters, and the ID generator — are
 * mocked at module level so no real HTTP calls or file I/O occur.
 * Mocks must be registered BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Controls what resolveActiveModel returns per capability key
  activeModels: {} as Record<string, any>,
  // Controls what resolveModel returns for a (providerId, modelId) pair
  resolvedModels: {} as Record<string, any>,
  // Tracks calls made to the Google adapter
  googleCalls: [] as any[],
  // When set, the Google adapter returns this value; when null it throws (if googleThrow is set)
  googleResult: null as any,
  // When set to a non-empty string, the Google adapter throws with this message
  googleThrow: "" as string,
  // Tracks calls made to the OpenAI adapter
  openaiCalls: [] as any[],
  openaiResult: null as any,
  // When set to a non-empty string, the OpenAI adapter throws with this message
  openaiThrow: "" as string,
  // Controls the next generated ID suffix
  idCounter: 0,
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any import of the module under test
// ---------------------------------------------------------------------------

mock.module("../providers", () => ({
  resolveActiveModel: async (capability: string) => {
    return mockState.activeModels[capability] ?? null;
  },
  resolveModel: async (providerId: string, modelId: string) => {
    return mockState.resolvedModels[`${providerId}/${modelId}`] ?? null;
  },
  getImageGenModels: async () => [],
}));

mock.module("../imageGeneration/adapters/google", () => ({
  generateWithGoogle: async (request: any, resolvedModel: any) => {
    mockState.googleCalls.push({ request, resolvedModel });
    if (mockState.googleThrow) {
      throw new Error(mockState.googleThrow);
    }
    return mockState.googleResult;
  },
}));

mock.module("../imageGeneration/adapters/openai", () => ({
  generateWithOpenAI: async (request: any, resolvedModel: any) => {
    mockState.openaiCalls.push({ request, resolvedModel });
    if (mockState.openaiThrow) {
      throw new Error(mockState.openaiThrow);
    }
    return mockState.openaiResult;
  },
}));

mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => {
    mockState.idCounter += 1;
    return `${prefix}_mock_${mockState.idCounter}`;
  },
}));

// ---------------------------------------------------------------------------
// Import the module AFTER mocks are registered
// ---------------------------------------------------------------------------

const { ImageGenerationService, imageGenerationService } = await import(
  "../imageGeneration"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ResolvedModel for a given api_mode. */
function makeResolvedModel(
  overrides: Partial<{
    apiMode: string;
    providerName: string;
    modelName: string;
    apiKey: string | null;
  }> = {}
): any {
  const {
    apiMode = "google_gemini",
    providerName = "Google",
    modelName = "imagen-3",
    apiKey = "test-api-key",
  } = overrides;

  return {
    provider: { id: "google", name: providerName, api_mode: apiMode },
    model: {
      id: "imagen-3-model-id",
      name: modelName,
      type: "image_gen",
      capabilities: ["text_to_image"],
      max_images_per_request: 4,
    },
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    api_key: apiKey,
    api_mode: apiMode,
  };
}

/** Successful Google adapter result with one image. */
function makeGoogleSuccess(revisedPrompt?: string): any {
  return {
    success: true,
    images: [{ base64Data: "base64_google_data", mimeType: "image/png" }],
    revisedPrompt,
  };
}

/** Successful OpenAI adapter result with one image. */
function makeOpenAISuccess(revisedPrompt?: string): any {
  return {
    success: true,
    images: [{ base64Data: "base64_openai_data", mimeType: "image/png" }],
    revisedPrompt,
  };
}

// ---------------------------------------------------------------------------
// Reset all state before each test so tests are fully independent
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.activeModels = {};
  mockState.resolvedModels = {};
  mockState.googleCalls = [];
  mockState.googleResult = null;
  mockState.googleThrow = "";
  mockState.openaiCalls = [];
  mockState.openaiResult = null;
  mockState.openaiThrow = "";
  mockState.idCounter = 0;
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("ImageGenerationService", () => {
  // -------------------------------------------------------------------------
  // reload()
  // -------------------------------------------------------------------------

  describe("reload()", () => {
    test("should set textToImageModel when text_to_image active model is configured", async () => {
      const model = makeResolvedModel();
      mockState.activeModels["text_to_image"] = model;

      const service = new ImageGenerationService();
      await service.reload();

      const info = service.getCurrentModel();
      expect(info).not.toBeNull();
      expect(info!.provider).toBe("Google");
      expect(info!.model).toBe("imagen-3");
    });

    test("should set imageToImageModel when image_to_image active model is configured", async () => {
      const model = makeResolvedModel({ modelName: "gemini-flash-edit" });
      mockState.activeModels["image_to_image"] = model;

      const service = new ImageGenerationService();
      await service.reload();

      const info = service.getImageToImageModel();
      expect(info).not.toBeNull();
      expect(info!.model).toBe("gemini-flash-edit");
    });

    test("should leave getCurrentModel() null when no text_to_image model is configured", async () => {
      const service = new ImageGenerationService();
      await service.reload();

      expect(service.getCurrentModel()).toBeNull();
    });

    test("should leave getImageToImageModel() null when no image_to_image model is configured", async () => {
      const service = new ImageGenerationService();
      await service.reload();

      expect(service.getImageToImageModel()).toBeNull();
    });

    test("should overwrite previously loaded models on repeated reload()", async () => {
      const model1 = makeResolvedModel({ modelName: "first-model" });
      mockState.activeModels["text_to_image"] = model1;

      const service = new ImageGenerationService();
      await service.reload();
      expect(service.getCurrentModel()!.model).toBe("first-model");

      const model2 = makeResolvedModel({ modelName: "second-model" });
      mockState.activeModels["text_to_image"] = model2;
      await service.reload();
      expect(service.getCurrentModel()!.model).toBe("second-model");
    });

    test("should load both text-to-image and image-to-image models simultaneously", async () => {
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        modelName: "text-model",
        providerName: "Google",
      });
      mockState.activeModels["image_to_image"] = makeResolvedModel({
        modelName: "i2i-model",
        providerName: "Google",
      });

      const service = new ImageGenerationService();
      await service.reload();

      expect(service.getCurrentModel()!.model).toBe("text-model");
      expect(service.getImageToImageModel()!.model).toBe("i2i-model");
      expect(service.supportsImageToImage()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentModel()
  // -------------------------------------------------------------------------

  describe("getCurrentModel()", () => {
    test("should return null before any model is loaded", () => {
      const service = new ImageGenerationService();
      expect(service.getCurrentModel()).toBeNull();
    });

    test("should return provider and model name after reload with a configured model", async () => {
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        providerName: "Nebius",
        modelName: "flux-schnell",
      });
      const service = new ImageGenerationService();
      await service.reload();

      const info = service.getCurrentModel();
      expect(info).toEqual({ provider: "Nebius", model: "flux-schnell" });
    });
  });

  // -------------------------------------------------------------------------
  // getImageToImageModel()
  // -------------------------------------------------------------------------

  describe("getImageToImageModel()", () => {
    test("should return null before any model is loaded", () => {
      const service = new ImageGenerationService();
      expect(service.getImageToImageModel()).toBeNull();
    });

    test("should return provider and model name after reload with a configured model", async () => {
      mockState.activeModels["image_to_image"] = makeResolvedModel({
        providerName: "Google",
        modelName: "gemini-2-flash",
      });
      const service = new ImageGenerationService();
      await service.reload();

      const info = service.getImageToImageModel();
      expect(info).toEqual({ provider: "Google", model: "gemini-2-flash" });
    });
  });

  // -------------------------------------------------------------------------
  // supportsImageToImage()
  // -------------------------------------------------------------------------

  describe("supportsImageToImage()", () => {
    test("should return false when no image-to-image model is loaded", () => {
      const service = new ImageGenerationService();
      expect(service.supportsImageToImage()).toBe(false);
    });

    test("should return true after reload finds an image_to_image model", async () => {
      mockState.activeModels["image_to_image"] = makeResolvedModel({
        modelName: "flux-fill",
      });
      const service = new ImageGenerationService();
      await service.reload();

      expect(service.supportsImageToImage()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // generate() — model resolution
  // -------------------------------------------------------------------------

  describe("generate() — model resolution", () => {
    test("should call reload() when no models are loaded and attempt generation", async () => {
      // Provide a model so that after the internal reload, generation proceeds.
      const model = makeResolvedModel();
      mockState.activeModels["text_to_image"] = model;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      // Do NOT call reload() explicitly — generate() should trigger it.
      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(true);
    });

    test("should return failure when no text-to-image model is configured for a text request", async () => {
      const service = new ImageGenerationService();
      // Force a reload so the service knows there are no models.
      await service.reload();

      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("text-to-image");
      expect(result.images).toEqual([]);
    });

    test("should return failure when no image-to-image model is configured for a sourceImage request", async () => {
      // Provide text-to-image but not image-to-image
      mockState.activeModels["text_to_image"] = makeResolvedModel();

      const service = new ImageGenerationService();
      await service.reload();

      const result = await service.generate({
        prompt: "edit this",
        sourceImage: { base64: "abc123", mimeType: "image/jpeg" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("image-to-image");
    });

    test("should use text-to-image model for requests without sourceImage", async () => {
      const textModel = makeResolvedModel({
        providerName: "Google",
        modelName: "imagen-3",
        apiMode: "google_gemini",
      });
      mockState.activeModels["text_to_image"] = textModel;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload();
      await service.generate({ prompt: "a cat" });

      expect(mockState.googleCalls).toHaveLength(1);
    });

    test("should use image-to-image model for requests with sourceImage", async () => {
      const i2iModel = makeResolvedModel({
        providerName: "Google",
        modelName: "gemini-flash-edit",
        apiMode: "google_gemini",
      });
      mockState.activeModels["image_to_image"] = i2iModel;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload();
      await service.generate({
        prompt: "make it blue",
        sourceImage: { base64: "abc123", mimeType: "image/jpeg" },
      });

      expect(mockState.googleCalls).toHaveLength(1);
      expect(mockState.googleCalls[0]!.resolvedModel.model.name).toBe(
        "gemini-flash-edit"
      );
    });

    test("should return failure after auto-reload finds no configured model", async () => {
      // No active models configured — reload() will find nothing
      const service = new ImageGenerationService();
      // Do NOT call reload() explicitly; generate() will call it but still
      // find no model and must return an error rather than looping endlessly.
      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("text-to-image");
    });
  });

  // -------------------------------------------------------------------------
  // generate() — Google Gemini path
  // -------------------------------------------------------------------------

  describe("generate() — google_gemini adapter", () => {
    let service: InstanceType<typeof ImageGenerationService>;

    beforeEach(async () => {
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        apiMode: "google_gemini",
        providerName: "Google",
        modelName: "imagen-3",
      });
      service = new ImageGenerationService();
      await service.reload();
    });

    test("should call generateWithGoogle with the prompt", async () => {
      mockState.googleResult = makeGoogleSuccess();

      await service.generate({ prompt: "a sunset over the sea" });

      expect(mockState.googleCalls).toHaveLength(1);
      expect(mockState.googleCalls[0]!.request.prompt).toBe(
        "a sunset over the sea"
      );
    });

    test("should pass aspectRatio to the Google adapter", async () => {
      mockState.googleResult = makeGoogleSuccess();

      await service.generate({ prompt: "x", aspectRatio: "16:9" });

      expect(mockState.googleCalls[0]!.request.aspectRatio).toBe("16:9");
    });

    test("should pass numberOfImages to the Google adapter", async () => {
      mockState.googleResult = makeGoogleSuccess();

      await service.generate({ prompt: "x", numberOfImages: 3 });

      expect(mockState.googleCalls[0]!.request.numberOfImages).toBe(3);
    });

    test("should pass sourceImage to the Google adapter for image-to-image", async () => {
      mockState.activeModels["image_to_image"] = makeResolvedModel({
        apiMode: "google_gemini",
      });
      await service.reload();
      mockState.googleResult = makeGoogleSuccess();

      const sourceImage = { base64: "imgdata", mimeType: "image/png" };
      await service.generate({
        prompt: "change colors",
        sourceImage,
      });

      expect(mockState.googleCalls[0]!.request.sourceImage).toEqual(
        sourceImage
      );
    });

    test("should return success=true and mapped images on a successful Google result", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images[0]!.base64Data).toBe("base64_google_data");
      expect(result.images[0]!.mimeType).toBe("image/png");
    });

    test("should assign unique IDs to each generated image", async () => {
      mockState.googleResult = {
        success: true,
        images: [
          { base64Data: "data1", mimeType: "image/png" },
          { base64Data: "data2", mimeType: "image/png" },
        ],
      };

      const result = await service.generate({ prompt: "two images" });

      expect(result.images).toHaveLength(2);
      const ids = result.images.map((img: any) => img.id);
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[0]).toMatch(/^img_mock_/);
    });

    test("should include revisedPrompt from the Google result on each image", async () => {
      mockState.googleResult = makeGoogleSuccess("A beautiful sunset");

      const result = await service.generate({ prompt: "sunset" });

      expect(result.images[0]!.revisedPrompt).toBe("A beautiful sunset");
    });

    test("should set revisedPrompt to undefined when adapter result has no revisedPrompt", async () => {
      mockState.googleResult = {
        success: true,
        images: [{ base64Data: "data", mimeType: "image/png" }],
        // no revisedPrompt field
      };

      const result = await service.generate({ prompt: "no revised" });

      expect(result.images[0]!.revisedPrompt).toBeUndefined();
    });

    test("should use default 1024x1024 dimensions when neither size nor aspectRatio is given", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({ prompt: "a cat" });

      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1024);
    });

    test("should parse dimensions from the size string", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({
        prompt: "wide",
        size: "1792x1024",
      });

      expect(result.images[0]!.width).toBe(1792);
      expect(result.images[0]!.height).toBe(1024);
    });

    test("should derive dimensions from aspectRatio when no size is given", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({
        prompt: "portrait",
        aspectRatio: "9:16",
      });

      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1792);
    });

    test("should prefer explicit size over aspectRatio for dimension calculation", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({
        prompt: "x",
        size: "512x512",
        aspectRatio: "16:9",
      });

      // size wins over aspectRatio
      expect(result.images[0]!.width).toBe(512);
      expect(result.images[0]!.height).toBe(512);
    });

    test("should include provider and model name in the result", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({ prompt: "x" });

      expect(result.provider).toBe("Google");
      expect(result.model).toBe("imagen-3");
    });

    test("should include a non-negative durationMs in the result", async () => {
      mockState.googleResult = makeGoogleSuccess();

      const result = await service.generate({ prompt: "x" });

      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should return failure with error message when the adapter returns success=false", async () => {
      mockState.googleResult = {
        success: false,
        images: [],
        error: "Google rate limit exceeded",
      };

      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Google rate limit exceeded");
      expect(result.images).toEqual([]);
    });

    test("should return fallback error message when adapter returns failure without an error field", async () => {
      mockState.googleResult = { success: false, images: [] };

      const result = await service.generate({ prompt: "a cat" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to generate image");
    });

    test("should catch a thrown error from the adapter and return success=false", async () => {
      mockState.googleThrow = "Network timeout";

      const result = await service.generate({ prompt: "x" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });

    test("should include provider and model in the result even when adapter throws", async () => {
      mockState.googleThrow = "Connection refused";

      const result = await service.generate({ prompt: "x" });

      expect(result.provider).toBe("Google");
      expect(result.model).toBe("imagen-3");
    });
  });

  // -------------------------------------------------------------------------
  // generate() — OpenAI images path
  // -------------------------------------------------------------------------

  describe("generate() — openai_images adapter", () => {
    let service: InstanceType<typeof ImageGenerationService>;

    beforeEach(async () => {
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        apiMode: "openai_images",
        providerName: "Nebius",
        modelName: "flux-schnell",
      });
      service = new ImageGenerationService();
      await service.reload();
    });

    test("should call generateWithOpenAI with the prompt", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "a robot" });

      expect(mockState.openaiCalls).toHaveLength(1);
      expect(mockState.openaiCalls[0]!.request.prompt).toBe("a robot");
    });

    test("should pass an explicit size to the OpenAI adapter", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "x", size: "512x512" });

      expect(mockState.openaiCalls[0]!.request.size).toBe("512x512");
    });

    test("should convert aspectRatio to a size string when no explicit size is given", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "x", aspectRatio: "16:9" });

      // 16:9 maps to 1792x1024
      expect(mockState.openaiCalls[0]!.request.size).toBe("1792x1024");
    });

    test("should default to 1024x1024 size when neither size nor aspectRatio is given", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "x" });

      expect(mockState.openaiCalls[0]!.request.size).toBe("1024x1024");
    });

    test("should pass numberOfImages to the OpenAI adapter", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "x", numberOfImages: 2 });

      expect(mockState.openaiCalls[0]!.request.numberOfImages).toBe(2);
    });

    test("should return success=true and mapped images on a successful OpenAI result", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      const result = await service.generate({ prompt: "a robot" });

      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images[0]!.base64Data).toBe("base64_openai_data");
      expect(result.images[0]!.mimeType).toBe("image/png");
    });

    test("should include revisedPrompt from the OpenAI result", async () => {
      mockState.openaiResult = makeOpenAISuccess("A sleek robot");

      const result = await service.generate({ prompt: "robot" });

      expect(result.images[0]!.revisedPrompt).toBe("A sleek robot");
    });

    test("should return failure when the OpenAI adapter returns success=false", async () => {
      mockState.openaiResult = {
        success: false,
        images: [],
        error: "Invalid API key",
      };

      const result = await service.generate({ prompt: "a robot" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    test("should catch a thrown error from the OpenAI adapter and return success=false", async () => {
      mockState.openaiThrow = "OpenAI service unavailable";

      const result = await service.generate({ prompt: "x" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("OpenAI service unavailable");
    });

    test("should include provider and model name in the result", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      const result = await service.generate({ prompt: "x" });

      expect(result.provider).toBe("Nebius");
      expect(result.model).toBe("flux-schnell");
    });

    test("should include a non-negative durationMs in the result", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      const result = await service.generate({ prompt: "x" });

      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should prefer explicit size over aspectRatio for OpenAI dimension calculation", async () => {
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({ prompt: "x", size: "512x512", aspectRatio: "16:9" });

      // explicit size must win; 16:9 would give 1792x1024 but size overrides it
      expect(mockState.openaiCalls[0]!.request.size).toBe("512x512");
    });

    test("should not forward sourceImage field to the OpenAI adapter request", async () => {
      // OpenAI images adapter only accepts text-to-image; sourceImage must not
      // be forwarded into the adapter request object.
      mockState.activeModels["image_to_image"] = makeResolvedModel({
        apiMode: "openai_images",
        providerName: "Nebius",
        modelName: "flux-fill",
      });
      await service.reload();
      mockState.openaiResult = makeOpenAISuccess();

      await service.generate({
        prompt: "fill background",
        sourceImage: { base64: "data", mimeType: "image/png" },
      });

      // The request forwarded to generateWithOpenAI must not contain sourceImage
      expect(mockState.openaiCalls[0]!.request.sourceImage).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // generate() — unsupported api_mode
  // -------------------------------------------------------------------------

  describe("generate() — unsupported api_mode", () => {
    test("should return failure for an unknown api_mode", async () => {
      const model = makeResolvedModel({ apiMode: "ollama" as any });
      mockState.activeModels["text_to_image"] = model;

      const service = new ImageGenerationService();
      await service.reload();

      const result = await service.generate({ prompt: "x" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported API mode");
      expect(result.error).toContain("ollama");
    });

    test("should include provider and model name even on unsupported api_mode failure", async () => {
      const model = makeResolvedModel({
        apiMode: "ollama" as any,
        providerName: "Local",
        modelName: "sdxl",
      });
      mockState.activeModels["text_to_image"] = model;

      const service = new ImageGenerationService();
      await service.reload();

      const result = await service.generate({ prompt: "x" });

      expect(result.provider).toBe("Local");
      expect(result.model).toBe("sdxl");
    });
  });

  // -------------------------------------------------------------------------
  // generateWithModel()
  // -------------------------------------------------------------------------

  describe("generateWithModel()", () => {
    test("should return failure when the specified model is not found", async () => {
      const service = new ImageGenerationService();

      const result = await service.generateWithModel(
        "unknown-provider",
        "unknown-model",
        { prompt: "x" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Model unknown-provider/unknown-model not found"
      );
      expect(result.provider).toBe("unknown-provider");
      expect(result.model).toBe("unknown-model");
    });

    test("should generate with the given providerId/modelId when found", async () => {
      const resolved = makeResolvedModel({
        apiMode: "google_gemini",
        providerName: "Google",
        modelName: "imagen-3",
      });
      mockState.resolvedModels["google/imagen-3"] = resolved;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      // Pre-load a different model as the default text-to-image model
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        modelName: "default-model",
      });
      await service.reload();

      const result = await service.generateWithModel("google", "imagen-3", {
        prompt: "a landscape",
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("Google");
      expect(result.model).toBe("imagen-3");
    });

    test("should restore the previous text-to-image model after generation", async () => {
      const defaultModel = makeResolvedModel({ modelName: "default-model" });
      mockState.activeModels["text_to_image"] = defaultModel;

      const overrideModel = makeResolvedModel({
        apiMode: "google_gemini",
        modelName: "override-model",
      });
      mockState.resolvedModels["google/override-model"] = overrideModel;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload();

      await service.generateWithModel("google", "override-model", {
        prompt: "x",
      });

      // After generateWithModel, the service should have restored the original model
      expect(service.getCurrentModel()!.model).toBe("default-model");
    });

    test("should restore the previous image-to-image model after generation", async () => {
      const defaultI2I = makeResolvedModel({ modelName: "default-i2i-model" });
      mockState.activeModels["image_to_image"] = defaultI2I;

      const overrideModel = makeResolvedModel({
        apiMode: "google_gemini",
        modelName: "override-i2i-model",
      });
      mockState.resolvedModels["google/override-i2i"] = overrideModel;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload();

      // Pass a sourceImage so the image-to-image model is used
      await service.generateWithModel("google", "override-i2i", {
        prompt: "x",
        sourceImage: { base64: "data", mimeType: "image/png" },
      });

      expect(service.getImageToImageModel()!.model).toBe("default-i2i-model");
    });

    test("should include durationMs in the result", async () => {
      const resolved = makeResolvedModel({ apiMode: "google_gemini" });
      mockState.resolvedModels["google/imagen-3"] = resolved;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();

      const result = await service.generateWithModel("google", "imagen-3", {
        prompt: "x",
      });

      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should include a non-negative durationMs even when model is not found", async () => {
      const service = new ImageGenerationService();

      const result = await service.generateWithModel("nope", "nope", {
        prompt: "x",
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should restore null text-to-image model when it was null before the call", async () => {
      // No text-to-image model loaded — previousModel will be null
      const resolved = makeResolvedModel({
        apiMode: "google_gemini",
        modelName: "temporary-model",
      });
      mockState.resolvedModels["google/temporary-model"] = resolved;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload(); // text-to-image stays null

      expect(service.getCurrentModel()).toBeNull();

      await service.generateWithModel("google", "temporary-model", {
        prompt: "x",
      });

      // Must be restored to null, not left pointing at the temporary model
      expect(service.getCurrentModel()).toBeNull();
    });

    test("should restore null image-to-image model when it was null before the call", async () => {
      // No image-to-image model loaded — previousModel will be null
      const resolved = makeResolvedModel({
        apiMode: "google_gemini",
        modelName: "temp-i2i-model",
      });
      mockState.resolvedModels["google/temp-i2i"] = resolved;
      mockState.googleResult = makeGoogleSuccess();

      const service = new ImageGenerationService();
      await service.reload(); // image-to-image stays null

      expect(service.supportsImageToImage()).toBe(false);

      await service.generateWithModel("google", "temp-i2i", {
        prompt: "x",
        sourceImage: { base64: "data", mimeType: "image/png" },
      });

      // Must be restored to null
      expect(service.supportsImageToImage()).toBe(false);
    });

    test("should use openai_images adapter path when generateWithModel resolves an OpenAI model", async () => {
      const resolved = makeResolvedModel({
        apiMode: "openai_images",
        providerName: "Nebius",
        modelName: "flux-dev",
      });
      mockState.resolvedModels["nebius/flux-dev"] = resolved;
      mockState.openaiResult = makeOpenAISuccess();

      const service = new ImageGenerationService();

      const result = await service.generateWithModel("nebius", "flux-dev", {
        prompt: "futuristic city",
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("Nebius");
      expect(result.model).toBe("flux-dev");
      expect(mockState.openaiCalls).toHaveLength(1);
      expect(mockState.openaiCalls[0]!.request.prompt).toBe("futuristic city");
    });
  });

  // -------------------------------------------------------------------------
  // Aspect ratio mapping
  // -------------------------------------------------------------------------

  describe("aspect ratio to dimensions mapping", () => {
    let service: InstanceType<typeof ImageGenerationService>;

    beforeEach(async () => {
      mockState.activeModels["text_to_image"] = makeResolvedModel({
        apiMode: "google_gemini",
      });
      service = new ImageGenerationService();
      await service.reload();
      mockState.googleResult = makeGoogleSuccess();
    });

    test("1:1 aspect ratio should produce 1024x1024", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "1:1",
      });
      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1024);
    });

    test("16:9 aspect ratio should produce 1792x1024", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "16:9",
      });
      expect(result.images[0]!.width).toBe(1792);
      expect(result.images[0]!.height).toBe(1024);
    });

    test("9:16 aspect ratio should produce 1024x1792", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "9:16",
      });
      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1792);
    });

    test("4:3 aspect ratio should produce 1366x1024", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "4:3",
      });
      expect(result.images[0]!.width).toBe(1366);
      expect(result.images[0]!.height).toBe(1024);
    });

    test("3:4 aspect ratio should produce 1024x1366", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "3:4",
      });
      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1366);
    });

    test("unknown aspect ratio should fall back to 1024x1024", async () => {
      const result = await service.generate({
        prompt: "x",
        aspectRatio: "2:3",
      });
      expect(result.images[0]!.width).toBe(1024);
      expect(result.images[0]!.height).toBe(1024);
    });
  });

  // -------------------------------------------------------------------------
  // Singleton instance export
  // -------------------------------------------------------------------------

  describe("imageGenerationService singleton", () => {
    test("should be an instance of ImageGenerationService", () => {
      expect(imageGenerationService).toBeInstanceOf(ImageGenerationService);
    });

    test("should expose getCurrentModel() returning null or a valid model object", () => {
      const result = imageGenerationService.getCurrentModel();
      // Before any reload the singleton has no model loaded.
      expect(
        result === null ||
          (typeof result === "object" && "provider" in result! && "model" in result!)
      ).toBe(true);
    });

    test("should expose supportsImageToImage() as a boolean", () => {
      expect(typeof imageGenerationService.supportsImageToImage()).toBe(
        "boolean"
      );
    });

    test("should expose generate() as a function", () => {
      expect(typeof imageGenerationService.generate).toBe("function");
    });

    test("should expose generateWithModel() as a function", () => {
      expect(typeof imageGenerationService.generateWithModel).toBe("function");
    });
  });
});
