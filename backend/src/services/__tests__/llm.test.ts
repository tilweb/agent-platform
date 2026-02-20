/**
 * Tests for LLMService (backend/src/services/llm.ts)
 *
 * All external dependencies — providers, adapters, and usage tracking — are
 * mocked at the module level so no real network calls or file I/O occur.
 * Mocks are declared BEFORE the module under test is dynamically imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // resolveActiveModel return value (null = no configured model)
  resolvedModel: null as Record<string, unknown> | null,
  // resolveModel return value for per-request override
  resolvedOverrideModel: null as Record<string, unknown> | null,
  // Whether resolvedOverrideModel.provider.enabled is true
  overrideProviderEnabled: true,

  // Tracks clearConfigCache calls
  clearConfigCacheCalled: false,

  // OpenAI adapter mock controls
  openaiStreamChunks: [] as Record<string, unknown>[],
  openaiChatResult: null as Record<string, unknown> | null,
  openaiChatError: null as Error | null,
  openaiTestConnectionResult: { success: true, message: "ok", latency_ms: 5, models_found: 3 },

  // Ollama adapter mock controls
  ollamaStreamChunks: [] as Record<string, unknown>[],
  ollamaChatResult: null as Record<string, unknown> | null,
  ollamaChatError: null as Error | null,
  ollamaTestConnectionResult: { success: true, message: "ok", latency_ms: 8, models_found: 2 },

  // Usage tracking
  trackedCalls: [] as Array<{ context: Record<string, unknown>; provider: string; model: string }>,

  // Environment variable overrides for fallback path
  envApiUrl: undefined as string | undefined,
  envApiKey: undefined as string | undefined,
  envModel: undefined as string | undefined,
};

// ---------------------------------------------------------------------------
// Helpers to build minimal ResolvedModel-shaped objects
// ---------------------------------------------------------------------------

function makeResolvedModel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: { id: "test-provider", name: "Test Provider", enabled: true },
    model: { id: "test-model", name: "Test Model" },
    base_url: "https://api.example.com",
    api_key: "sk-test",
    api_mode: "openai",
    ...overrides,
  };
}

function makeStreamChunk(content: string): Record<string, unknown> {
  return {
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1700000000,
    model: "test-model",
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  };
}

function makeFinalChunk(): Record<string, unknown> {
  return {
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1700000000,
    model: "test-model",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mock OpenAI and Ollama adapter classes
// ---------------------------------------------------------------------------

// These are constructed by LLMService; we capture the last constructed
// instance to verify parameters and control stream/chat behavior.
let lastOpenAIAdapterOptions: Record<string, unknown> | null = null;
let lastOllamaAdapterOptions: Record<string, unknown> | null = null;

mock.module("../llm/adapters/openai", () => ({
  OpenAIAdapter: class MockOpenAIAdapter {
    constructor(options: Record<string, unknown>) {
      lastOpenAIAdapterOptions = options;
    }

    async *streamChat(_messages: unknown, _model: unknown, _tools: unknown) {
      for (const chunk of mockState.openaiStreamChunks) {
        yield chunk;
      }
    }

    async chat(_messages: unknown, _model: unknown, _tools: unknown) {
      if (mockState.openaiChatError) {
        throw mockState.openaiChatError;
      }
      return mockState.openaiChatResult;
    }

    async testConnection() {
      return mockState.openaiTestConnectionResult;
    }
  },
}));

mock.module("../llm/adapters/ollama", () => ({
  OllamaAdapter: class MockOllamaAdapter {
    constructor(options: Record<string, unknown>) {
      lastOllamaAdapterOptions = options;
    }

    async *streamChat(_messages: unknown, _model: unknown, _tools: unknown) {
      for (const chunk of mockState.ollamaStreamChunks) {
        yield chunk;
      }
    }

    async chat(_messages: unknown, _model: unknown) {
      if (mockState.ollamaChatError) {
        throw mockState.ollamaChatError;
      }
      return mockState.ollamaChatResult;
    }

    async testConnection() {
      return mockState.ollamaTestConnectionResult;
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock provider resolution
// ---------------------------------------------------------------------------

mock.module("../providers", () => ({
  resolveActiveModel: async (_purpose: string, _userId?: string) => {
    return mockState.resolvedModel;
  },
  resolveModel: async (_providerId: string, _modelId: string) => {
    return mockState.resolvedOverrideModel;
  },
  clearConfigCache: () => {
    mockState.clearConfigCacheCalled = true;
  },
}));

// ---------------------------------------------------------------------------
// Mock usage tracking
// ---------------------------------------------------------------------------

mock.module("../usageTracking", () => ({
  usageTrackingService: {
    track: async (context: Record<string, unknown>, provider: string, model: string) => {
      mockState.trackedCalls.push({ context, provider, model });
    },
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

const {
  LLMService,
  llmService,
  createImageContent,
  createMultimodalContent,
} = await import("../llm");

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("createImageContent()", () => {
  test("should wrap plain base64 data with data URI prefix", () => {
    const result = createImageContent("abc123", "image/png");
    expect(result.type).toBe("image_url");
    expect(result.image_url.url).toBe("data:image/png;base64,abc123");
    expect(result.image_url.detail).toBe("auto");
  });

  test("should pass through a string that already starts with 'data:'", () => {
    const dataUri = "data:image/jpeg;base64,/9j/4AA";
    const result = createImageContent(dataUri, "image/jpeg");
    expect(result.image_url.url).toBe(dataUri);
  });

  test("should use the supplied mimeType when constructing the URI", () => {
    const result = createImageContent("data", "image/webp");
    expect(result.image_url.url).toBe("data:image/webp;base64,data");
  });

  test("should always set detail to 'auto'", () => {
    const result = createImageContent("x", "image/gif");
    expect(result.image_url.detail).toBe("auto");
  });
});

// ---------------------------------------------------------------------------

describe("createMultimodalContent()", () => {
  test("should include a text part when text is non-empty", () => {
    const parts = createMultimodalContent("Hello", []);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "Hello" });
  });

  test("should not include a text part when text is empty string", () => {
    const parts = createMultimodalContent("", [
      { base64: "abc", mimeType: "image/png" },
    ]);
    // Only the image part
    expect(parts.some((p) => p.type === "text")).toBe(false);
  });

  test("should include one image part per supplied image", () => {
    const parts = createMultimodalContent("Caption", [
      { base64: "img1", mimeType: "image/png" },
      { base64: "img2", mimeType: "image/jpeg" },
    ]);
    const imageParts = parts.filter((p) => p.type === "image_url");
    expect(imageParts).toHaveLength(2);
  });

  test("should place the text part before the image parts", () => {
    const parts = createMultimodalContent("first", [
      { base64: "b64", mimeType: "image/png" },
    ]);
    expect(parts[0]!.type).toBe("text");
    expect(parts[1]!.type).toBe("image_url");
  });

  test("should return an empty array when text is empty and no images are supplied", () => {
    const parts = createMultimodalContent("", []);
    expect(parts).toHaveLength(0);
  });

  test("should embed the image URL correctly inside each image part", () => {
    const parts = createMultimodalContent("t", [
      { base64: "mydata", mimeType: "image/gif" },
    ]);
    const img = parts.find((p) => p.type === "image_url") as { type: "image_url"; image_url: { url: string } };
    expect(img.image_url.url).toBe("data:image/gif;base64,mydata");
  });
});

// ---------------------------------------------------------------------------

describe("LLMService", () => {
  // Reset all mock state before each test
  beforeEach(() => {
    mockState.resolvedModel = null;
    mockState.resolvedOverrideModel = null;
    mockState.overrideProviderEnabled = true;
    mockState.clearConfigCacheCalled = false;
    mockState.openaiStreamChunks = [];
    mockState.openaiChatResult = null;
    mockState.openaiChatError = null;
    mockState.openaiTestConnectionResult = { success: true, message: "ok", latency_ms: 5, models_found: 3 };
    mockState.ollamaStreamChunks = [];
    mockState.ollamaChatResult = null;
    mockState.ollamaChatError = null;
    mockState.ollamaTestConnectionResult = { success: true, message: "ok", latency_ms: 8, models_found: 2 };
    mockState.trackedCalls = [];
    mockState.envApiUrl = undefined;
    mockState.envApiKey = undefined;
    mockState.envModel = undefined;
    lastOpenAIAdapterOptions = null;
    lastOllamaAdapterOptions = null;
  });

  // -------------------------------------------------------------------------
  // initialize()
  // -------------------------------------------------------------------------

  describe("initialize()", () => {
    test("should create an OpenAI adapter when resolved model uses openai api_mode", async () => {
      mockState.resolvedModel = makeResolvedModel({
        api_mode: "openai",
        base_url: "https://openai.example.com",
        api_key: "sk-openai",
      });
      mockState.resolvedModel.model = { id: "gpt-4o", name: "GPT-4o" };

      const service = new LLMService();
      await service.initialize();

      expect(lastOpenAIAdapterOptions).not.toBeNull();
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).baseUrl).toBe("https://openai.example.com");
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).apiKey).toBe("sk-openai");
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).defaultModel).toBe("gpt-4o");
    });

    test("should create an Ollama adapter when resolved model uses ollama api_mode", async () => {
      mockState.resolvedModel = makeResolvedModel({
        api_mode: "ollama",
        base_url: "http://localhost:11434",
        api_key: null,
      });
      (mockState.resolvedModel.model as Record<string, unknown>) = { id: "llama3.2", name: "LLaMA 3.2" };

      const service = new LLMService();
      await service.initialize();

      expect(lastOllamaAdapterOptions).not.toBeNull();
      expect((lastOllamaAdapterOptions as Record<string, unknown>).baseUrl).toBe("http://localhost:11434");
      expect((lastOllamaAdapterOptions as Record<string, unknown>).defaultModel).toBe("llama3.2");
    });

    test("should do nothing when no model is configured and no env vars are set", async () => {
      mockState.resolvedModel = null;
      // Ensure env vars are absent
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;
      delete process.env.ADACOR_AI_MODEL;

      const service = new LLMService();
      await service.initialize(); // Should not throw

      expect(service.getCurrentModel()).toBeNull();
    });

    test("should fall back to env vars when no model is configured", async () => {
      mockState.resolvedModel = null;
      process.env.ADACOR_AI_API_URL = "https://env.example.com";
      process.env.ADACOR_AI_API_KEY = "env-key";
      process.env.ADACOR_AI_MODEL = "env-model";

      const service = new LLMService();
      await service.initialize();

      expect(lastOpenAIAdapterOptions).not.toBeNull();
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).baseUrl).toBe("https://env.example.com");
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).apiKey).toBe("env-key");
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).defaultModel).toBe("env-model");

      // Cleanup
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;
      delete process.env.ADACOR_AI_MODEL;
    });

    test("should use 'gpt-4o-mini' as fallback model when ADACOR_AI_MODEL is not set", async () => {
      mockState.resolvedModel = null;
      process.env.ADACOR_AI_API_URL = "https://env.example.com";
      process.env.ADACOR_AI_API_KEY = "env-key";
      delete process.env.ADACOR_AI_MODEL;

      const service = new LLMService();
      await service.initialize();

      expect((lastOpenAIAdapterOptions as Record<string, unknown>).defaultModel).toBe("gpt-4o-mini");

      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentModel()
  // -------------------------------------------------------------------------

  describe("getCurrentModel()", () => {
    test("should return null before initialization", () => {
      const service = new LLMService();
      expect(service.getCurrentModel()).toBeNull();
    });

    test("should return provider, model, and api_mode after initialize()", async () => {
      mockState.resolvedModel = makeResolvedModel({
        api_mode: "openai",
      });

      const service = new LLMService();
      await service.initialize();

      const info = service.getCurrentModel();
      expect(info).not.toBeNull();
      expect(info!.provider).toBe("Test Provider");
      expect(info!.model).toBe("Test Model");
      expect(info!.api_mode).toBe("openai");
    });

    test("should return null when resolved model is null", async () => {
      mockState.resolvedModel = null;
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;

      const service = new LLMService();
      await service.initialize();

      expect(service.getCurrentModel()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // reload()
  // -------------------------------------------------------------------------

  describe("reload()", () => {
    test("should call clearConfigCache", async () => {
      mockState.resolvedModel = makeResolvedModel();
      const service = new LLMService();
      await service.initialize();

      mockState.clearConfigCacheCalled = false;
      await service.reload();

      expect(mockState.clearConfigCacheCalled).toBe(true);
    });

    test("should re-initialize with the new resolved model after reload", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      const service = new LLMService();
      await service.initialize();

      // Change the resolved model for the next initialize call
      mockState.resolvedModel = makeResolvedModel({
        api_mode: "ollama",
        base_url: "http://new-ollama:11434",
        api_key: null,
      });
      (mockState.resolvedModel.model as Record<string, unknown>) = { id: "mistral", name: "Mistral" };

      await service.reload();

      expect(lastOllamaAdapterOptions).not.toBeNull();
      expect((lastOllamaAdapterOptions as Record<string, unknown>).baseUrl).toBe("http://new-ollama:11434");
    });

    test("should reset to null model state when reload finds no configured model", async () => {
      mockState.resolvedModel = makeResolvedModel();
      const service = new LLMService();
      await service.initialize();

      mockState.resolvedModel = null;
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;

      await service.reload();

      expect(service.getCurrentModel()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // chat() — OpenAI adapter
  // -------------------------------------------------------------------------

  describe("chat() via OpenAI adapter", () => {
    test("should return content, tool_calls, and finish_reason from the adapter", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatResult = {
        content: "Hello, world!",
        tool_calls: [],
        finish_reason: "stop",
      };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat([{ role: "user", content: "Hi" }]);

      expect(result.content).toBe("Hello, world!");
      expect(result.finish_reason).toBe("stop");
    });

    test("should pass tool_calls through when the adapter returns them", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatResult = {
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "my_tool", arguments: '{"x":1}' },
          },
        ],
        finish_reason: "tool_calls",
      };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat([{ role: "user", content: "run tool" }]);

      expect(result.content).toBeNull();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0]!.function.name).toBe("my_tool");
      expect(result.finish_reason).toBe("tool_calls");
    });

    test("should throw when the adapter throws", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatError = new Error("OpenAI API error: 429 - rate limited");

      const service = new LLMService();
      await service.initialize();

      await expect(
        service.chat([{ role: "user", content: "Hi" }])
      ).rejects.toThrow("OpenAI API error: 429 - rate limited");
    });

    test("should track usage after a successful chat call", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatResult = { content: "ok", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      await service.chat(
        [{ role: "user", content: "track me" }],
        undefined,
        { userId: "alice", source: "chat" }
      );

      expect(mockState.trackedCalls).toHaveLength(1);
      expect(mockState.trackedCalls[0]!.context.userId).toBe("alice");
      expect(mockState.trackedCalls[0]!.provider).toBe("test-provider");
      expect(mockState.trackedCalls[0]!.model).toBe("test-model");
    });

    test("should not track usage when no usageContext is provided", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatResult = { content: "ok", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      await service.chat([{ role: "user", content: "no track" }]);

      expect(mockState.trackedCalls).toHaveLength(0);
    });

    test("should auto-initialize when neither adapter is set", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiChatResult = { content: "auto init", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      // Do NOT call initialize() — chat() should call it lazily
      const result = await service.chat([{ role: "user", content: "test" }]);

      expect(result.content).toBe("auto init");
    });
  });

  // -------------------------------------------------------------------------
  // chat() — Ollama adapter
  // -------------------------------------------------------------------------

  describe("chat() via Ollama adapter", () => {
    test("should return content and finish_reason from Ollama adapter", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaChatResult = { content: "Ollama reply", finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat([{ role: "user", content: "hello" }]);

      expect(result.content).toBe("Ollama reply");
      expect(result.finish_reason).toBe("stop");
    });

    test("should not include tool_calls in Ollama response", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaChatResult = { content: "hi", finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat([{ role: "user", content: "hi" }]);

      expect(result.tool_calls).toBeUndefined();
    });

    test("should track usage after a successful Ollama chat call", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaChatResult = { content: "ok", finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      await service.chat(
        [{ role: "user", content: "ollama usage" }],
        undefined,
        { userId: "bob", source: "chat" }
      );

      expect(mockState.trackedCalls).toHaveLength(1);
      expect(mockState.trackedCalls[0]!.context.userId).toBe("bob");
    });

    test("should throw when Ollama adapter throws", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaChatError = new Error("Ollama API error: 500 - internal error");

      const service = new LLMService();
      await service.initialize();

      await expect(
        service.chat([{ role: "user", content: "fail" }])
      ).rejects.toThrow("Ollama API error: 500 - internal error");
    });
  });

  // -------------------------------------------------------------------------
  // chat() — no adapter
  // -------------------------------------------------------------------------

  describe("chat() with no adapter available", () => {
    test("should throw 'No LLM adapter available' when neither adapter initialises", async () => {
      mockState.resolvedModel = null;
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;

      const service = new LLMService();
      await service.initialize();

      await expect(
        service.chat([{ role: "user", content: "fail" }])
      ).rejects.toThrow("No LLM adapter available");
    });
  });

  // -------------------------------------------------------------------------
  // chat() — modelOverride
  // -------------------------------------------------------------------------

  describe("chat() with modelOverride option", () => {
    test("should use the override model when it resolves and its provider is enabled", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.resolvedOverrideModel = makeResolvedModel({
        api_mode: "openai",
        base_url: "https://override.example.com",
        api_key: "sk-override",
        provider: { id: "override-provider", name: "Override Provider", enabled: true },
        model: { id: "override-model", name: "Override Model" },
      });
      mockState.openaiChatResult = { content: "override result", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat(
        [{ role: "user", content: "hi" }],
        undefined,
        undefined,
        { modelOverride: { providerId: "override-provider", modelId: "override-model" } }
      );

      expect(result.content).toBe("override result");
      // The last created OpenAI adapter should use the override URL
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).baseUrl).toBe("https://override.example.com");
    });

    test("should fall back to the default model when the override resolves to a disabled provider", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.resolvedOverrideModel = makeResolvedModel({
        provider: { id: "disabled-provider", name: "Disabled", enabled: false },
      });
      mockState.openaiChatResult = { content: "default result", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat(
        [{ role: "user", content: "hi" }],
        undefined,
        undefined,
        { modelOverride: { providerId: "disabled-provider", modelId: "some-model" } }
      );

      expect(result.content).toBe("default result");
    });

    test("should fall back when override resolves to null", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.resolvedOverrideModel = null;
      mockState.openaiChatResult = { content: "fallback result", tool_calls: [], finish_reason: "stop" };

      const service = new LLMService();
      await service.initialize();

      const result = await service.chat(
        [{ role: "user", content: "hi" }],
        undefined,
        undefined,
        { modelOverride: { providerId: "ghost", modelId: "ghost-model" } }
      );

      expect(result.content).toBe("fallback result");
    });
  });

  // -------------------------------------------------------------------------
  // streamChat() — OpenAI adapter
  // -------------------------------------------------------------------------

  describe("streamChat() via OpenAI adapter", () => {
    test("should yield all chunks from the OpenAI adapter", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiStreamChunks = [
        makeStreamChunk("Hello"),
        makeStreamChunk(", world"),
        makeFinalChunk(),
      ];

      const service = new LLMService();
      await service.initialize();

      const chunks: unknown[] = [];
      for await (const chunk of service.streamChat([{ role: "user", content: "hi" }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect((chunks[0] as Record<string, unknown[]>).choices[0]).toMatchObject({
        delta: { content: "Hello" },
      });
      expect((chunks[1] as Record<string, unknown[]>).choices[0]).toMatchObject({
        delta: { content: ", world" },
      });
    });

    test("should track usage on first chunk that has content", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiStreamChunks = [
        makeStreamChunk("chunk1"),
        makeStreamChunk("chunk2"),
        makeFinalChunk(),
      ];

      const service = new LLMService();
      await service.initialize();

      for await (const _chunk of service.streamChat(
        [{ role: "user", content: "hi" }],
        undefined,
        { userId: "alice", source: "chat" }
      )) {
        // consume generator
      }

      expect(mockState.trackedCalls).toHaveLength(1);
      expect(mockState.trackedCalls[0]!.context.userId).toBe("alice");
    });

    test("should not track usage more than once per streamChat call", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiStreamChunks = [
        makeStreamChunk("a"),
        makeStreamChunk("b"),
        makeStreamChunk("c"),
        makeFinalChunk(),
      ];

      const service = new LLMService();
      await service.initialize();

      for await (const _chunk of service.streamChat(
        [{ role: "user", content: "hi" }],
        undefined,
        { userId: "alice", source: "chat" }
      )) {
        // consume
      }

      expect(mockState.trackedCalls).toHaveLength(1);
    });

    test("should track usage even when no content chunks are yielded (tool-calls-only response)", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      // Chunk with no content (tool call response)
      mockState.openaiStreamChunks = [
        {
          id: "chatcmpl-tc",
          object: "chat.completion.chunk",
          created: 1700000000,
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "fn", arguments: "" } }] },
              finish_reason: null,
            },
          ],
        },
        makeFinalChunk(),
      ];

      const service = new LLMService();
      await service.initialize();

      for await (const _chunk of service.streamChat(
        [{ role: "user", content: "call tool" }],
        undefined,
        { userId: "alice", source: "chat" }
      )) {
        // consume
      }

      expect(mockState.trackedCalls).toHaveLength(1);
    });

    test("should not track usage when no usageContext is provided", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiStreamChunks = [makeStreamChunk("hi"), makeFinalChunk()];

      const service = new LLMService();
      await service.initialize();

      for await (const _chunk of service.streamChat(
        [{ role: "user", content: "hi" }]
      )) {
        // consume, no usageContext
      }

      expect(mockState.trackedCalls).toHaveLength(0);
    });

    test("should auto-initialize lazily when called without prior initialize()", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiStreamChunks = [makeStreamChunk("lazy"), makeFinalChunk()];

      const service = new LLMService();
      // No explicit initialize() call
      const chunks: unknown[] = [];
      for await (const chunk of service.streamChat([{ role: "user", content: "lazy" }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // streamChat() — Ollama adapter
  // -------------------------------------------------------------------------

  describe("streamChat() via Ollama adapter", () => {
    test("should yield all chunks from the Ollama adapter", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaStreamChunks = [
        makeStreamChunk("Ollama chunk 1"),
        makeStreamChunk("Ollama chunk 2"),
        makeFinalChunk(),
      ];

      const service = new LLMService();
      await service.initialize();

      const chunks: unknown[] = [];
      for await (const chunk of service.streamChat([{ role: "user", content: "hi" }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
    });

    test("should track usage for Ollama streaming", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaStreamChunks = [makeStreamChunk("ollama content"), makeFinalChunk()];

      const service = new LLMService();
      await service.initialize();

      for await (const _chunk of service.streamChat(
        [{ role: "user", content: "hi" }],
        undefined,
        { userId: "bob", source: "chat" }
      )) {
        // consume
      }

      expect(mockState.trackedCalls).toHaveLength(1);
      expect(mockState.trackedCalls[0]!.context.userId).toBe("bob");
    });
  });

  // -------------------------------------------------------------------------
  // streamChat() — no adapter
  // -------------------------------------------------------------------------

  describe("streamChat() with no adapter available", () => {
    test("should throw 'No LLM adapter available'", async () => {
      mockState.resolvedModel = null;
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;

      const service = new LLMService();
      await service.initialize();

      await expect(async () => {
        for await (const _chunk of service.streamChat([{ role: "user", content: "fail" }])) {
          // nothing
        }
      }).toThrow("No LLM adapter available");
    });
  });

  // -------------------------------------------------------------------------
  // streamChat() — modelOverride
  // -------------------------------------------------------------------------

  describe("streamChat() with modelOverride option", () => {
    test("should use the override model when it resolves and its provider is enabled", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.resolvedOverrideModel = makeResolvedModel({
        api_mode: "openai",
        base_url: "https://stream-override.example.com",
        api_key: "sk-stream-override",
        provider: { id: "override-p", name: "Override", enabled: true },
        model: { id: "override-stream-model", name: "Override Stream Model" },
      });
      mockState.openaiStreamChunks = [makeStreamChunk("override stream"), makeFinalChunk()];

      const service = new LLMService();
      await service.initialize();

      const chunks: unknown[] = [];
      for await (const chunk of service.streamChat(
        [{ role: "user", content: "hi" }],
        undefined,
        undefined,
        { modelOverride: { providerId: "override-p", modelId: "override-stream-model" } }
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect((lastOpenAIAdapterOptions as Record<string, unknown>).baseUrl).toBe("https://stream-override.example.com");
    });
  });

  // -------------------------------------------------------------------------
  // testConnection()
  // -------------------------------------------------------------------------

  describe("testConnection()", () => {
    test("should return OpenAI adapter result when openai adapter is active", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiTestConnectionResult = {
        success: true,
        message: "Connection successful",
        latency_ms: 42,
        models_found: 5,
      };

      const service = new LLMService();
      await service.initialize();

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connection successful");
      expect(result.latency_ms).toBe(42);
      expect(result.models_found).toBe(5);
    });

    test("should return Ollama adapter result when ollama adapter is active", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "ollama", api_key: null });
      mockState.ollamaTestConnectionResult = {
        success: true,
        message: "Connected (3 models available)",
        latency_ms: 10,
        models_found: 3,
      };

      const service = new LLMService();
      await service.initialize();

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connected (3 models available)");
      expect(result.models_found).toBe(3);
    });

    test("should return failure message when no adapter is available", async () => {
      mockState.resolvedModel = null;
      delete process.env.ADACOR_AI_API_URL;
      delete process.env.ADACOR_AI_API_KEY;

      const service = new LLMService();
      await service.initialize();

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe("No LLM adapter available");
    });

    test("should auto-initialize on first testConnection call", async () => {
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      mockState.openaiTestConnectionResult = { success: true, message: "ok", latency_ms: 1 };

      const service = new LLMService();
      // No explicit initialize()
      const result = await service.testConnection();

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // chat() — createAdapterForModel throws on unknown api_mode
  // -------------------------------------------------------------------------

  describe("createAdapterForModel() with unknown api_mode", () => {
    test("should throw 'Unknown API mode' for an unsupported api_mode in override", async () => {
      // Set up a default working model so initialize passes
      mockState.resolvedModel = makeResolvedModel({ api_mode: "openai" });
      // Provide an override with an unknown api_mode
      mockState.resolvedOverrideModel = makeResolvedModel({
        api_mode: "google_gemini", // not handled in createAdapterForModel
        provider: { id: "google", name: "Google", enabled: true },
        model: { id: "gemini-pro", name: "Gemini Pro" },
      });

      const service = new LLMService();
      await service.initialize();

      await expect(
        service.chat(
          [{ role: "user", content: "hi" }],
          undefined,
          undefined,
          { modelOverride: { providerId: "google", modelId: "gemini-pro" } }
        )
      ).rejects.toThrow("Unknown API mode: google_gemini");
    });
  });

  // -------------------------------------------------------------------------
  // Singleton export
  // -------------------------------------------------------------------------

  describe("llmService singleton", () => {
    test("should export a shared LLMService instance", () => {
      expect(llmService).toBeInstanceOf(LLMService);
    });

    test("should be the same object on repeated imports", async () => {
      const { llmService: llmService2 } = await import("../llm");
      expect(llmService2).toBe(llmService);
    });
  });
});
