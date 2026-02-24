/**
 * Tests for backend/src/services/modelCapabilityResolver.ts
 *
 * All external dependencies (llmService, tools/registry) are mocked so no
 * real network calls or file I/O occur.  Mocks MUST be declared before the
 * dynamic import of the module under test.
 *
 * IMPORTANT: Do NOT call mock.module() anywhere except at the top level.
 * Re-mocking mid-test corrupts already-imported singleton references and
 * breaks subsequent tests in the same file.
 *
 * Path note: mock.module() paths are resolved relative to the test file.
 * - "../llm"           → src/services/llm   (matches source's './llm')
 * - "../../tools/registry" → src/tools/registry (matches source's '../tools/registry')
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Return value of llmService.getCurrentModel()
  currentModel: null as { provider: string; model: string; api_mode: string } | null,

  // Controls how llmService.chat() responds.
  // - When chatResponseQueue has items, each call pops from the front.
  // - When the queue is empty and chatFallbackContent is set, that is returned.
  // - When chatShouldThrow is true the call throws chatError.
  chatResponseQueue: [] as Array<string | null>,
  chatFallbackContent: null as string | null,
  chatShouldThrow: false,
  chatError: new Error("LLM error"),

  // Messages captured by each llmService.chat() invocation
  capturedMessagesList: [] as Array<Array<{ role: string; content: string }>>,

  // Web search tool mock state
  searchToolAvailable: false,
  searchResults: {} as Record<string, string>,

  // Capture queries sent to web search
  searchQueries: [] as string[],
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE the dynamic import
// ---------------------------------------------------------------------------

mock.module("../llm", () => ({
  llmService: {
    getCurrentModel: () => mockState.currentModel,
    chat: async (messages: Array<{ role: string; content: string }>) => {
      mockState.capturedMessagesList.push(messages);
      if (mockState.chatShouldThrow) throw mockState.chatError;
      // Dequeue the next response if available, else fall back
      const content =
        mockState.chatResponseQueue.length > 0
          ? mockState.chatResponseQueue.shift()!
          : mockState.chatFallbackContent;
      return { content };
    },
  },
}));

// The source imports this as '../tools/registry' from src/services/modelCapabilityResolver.ts,
// which resolves to src/tools/registry.  From the test at src/services/__tests__/ the
// equivalent relative path is ../../tools/registry.
mock.module("../../tools/registry", () => ({
  toolRegistry: {
    get: (name: string) => {
      if (name !== "web_search") return undefined;
      return {
        isAvailable: async () => mockState.searchToolAvailable,
        execute: async (args: { query: string }) => {
          mockState.searchQueries.push(args.query);
          // Derive the model ID from the query: search query format is
          // "<modelId> LLM model capabilities features"
          const modelId = args.query.split(" ")[0];
          const result = mockState.searchResults[modelId];
          return result ?? "Error: no results";
        },
      };
    },
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const { resolveModelCapabilities } = await import("../modelCapabilityResolver");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMockState() {
  mockState.currentModel = null;
  mockState.chatResponseQueue = [];
  mockState.chatFallbackContent = null;
  mockState.chatShouldThrow = false;
  mockState.chatError = new Error("LLM error");
  mockState.capturedMessagesList = [];
  mockState.searchToolAvailable = false;
  mockState.searchResults = {};
  mockState.searchQueries = [];
}

/** Encode items as a JSON string the way the LLM would return them */
function jsonResponse(
  items: Array<{
    id: string;
    type?: string;
    capabilities?: string[];
    unknown?: boolean;
  }>,
): string {
  return JSON.stringify(items);
}

/** Get the last set of messages captured by the chat mock */
function lastCapturedMessages() {
  return mockState.capturedMessagesList[mockState.capturedMessagesList.length - 1] ?? [];
}

/** Return a reasonable capability list for a given type (for parametric tests) */
function capsForType(type: string): string[] {
  switch (type) {
    case "tts": return ["speech"];
    case "stt": return ["transcription"];
    case "image_gen": return ["text_to_image"];
    case "vllm": return ["chat", "vision"];
    default: return ["chat"];
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("resolveModelCapabilities()", () => {
  beforeEach(() => {
    resetMockState();
  });

  // -------------------------------------------------------------------------
  describe("when LLM service has no current model", () => {
    test("should return null when no default LLM is configured", async () => {
      mockState.currentModel = null;
      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null regardless of how many model IDs are given", async () => {
      mockState.currentModel = null;
      const result = await resolveModelCapabilities(["model-a", "model-b", "model-c"], "openai");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("empty modelIds input", () => {
    test("should return an empty Map without calling the LLM when no model is configured", async () => {
      mockState.currentModel = null;
      const result = await resolveModelCapabilities([], "openai");
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Map);
      expect(result!.size).toBe(0);
      expect(mockState.capturedMessagesList).toHaveLength(0);
    });

    test("should return an empty Map even when a model is configured", async () => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
      const result = await resolveModelCapabilities([], "openai");
      expect(result).toBeInstanceOf(Map);
      expect(result!.size).toBe(0);
      expect(mockState.capturedMessagesList).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("successful LLM response parsing", () => {
    beforeEach(() => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
    });

    test("should return a Map entry for a valid LLM response", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "vllm", capabilities: ["chat", "vision", "function_calling"] },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");

      expect(result).toBeInstanceOf(Map);
      expect(result!.has("gpt-4o")).toBe(true);
      const cap = result!.get("gpt-4o")!;
      expect(cap.type).toBe("vllm");
      expect(cap.capabilities).toContain("chat");
      expect(cap.capabilities).toContain("vision");
      expect(cap.capabilities).toContain("function_calling");
    });

    test("should resolve multiple model IDs in a single chat call", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "vllm", capabilities: ["chat", "vision"] },
        { id: "whisper-1", type: "stt", capabilities: ["transcription"] },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o", "whisper-1"], "openai");

      expect(result!.size).toBe(2);
      expect(result!.get("gpt-4o")!.type).toBe("vllm");
      expect(result!.get("whisper-1")!.type).toBe("stt");
      // Only one chat call should have been made
      expect(mockState.capturedMessagesList).toHaveLength(1);
    });

    test("should filter out capabilities not in the allowed set", async () => {
      mockState.chatFallbackContent = jsonResponse([
        {
          id: "gpt-4o",
          type: "llm",
          capabilities: ["chat", "function_calling", "invalid_cap", "also_wrong"],
        },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      const cap = result!.get("gpt-4o")!;
      expect(cap.capabilities).toContain("chat");
      expect(cap.capabilities).toContain("function_calling");
      expect(cap.capabilities).not.toContain("invalid_cap");
      expect(cap.capabilities).not.toContain("also_wrong");
    });

    test("should exclude a model when its type is not in the allowed set", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "badtype", capabilities: ["chat"] },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(false);
      expect(result!.size).toBe(0);
    });

    test("should exclude a model when it has no valid capabilities after filtering", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "llm", capabilities: ["not_valid", "also_not_valid"] },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(false);
    });

    test("should exclude model IDs returned by LLM that were not in the requested list", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "llm", capabilities: ["chat"] },
        { id: "some-other-model", type: "llm", capabilities: ["chat"] },
      ]);

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(true);
      expect(result!.has("some-other-model")).toBe(false);
    });

    test("should handle all valid ModelType values", async () => {
      const validTypes = ["llm", "vllm", "tts", "stt", "image_gen"] as const;
      const models = validTypes.map((type) => ({
        id: `model-${type}`,
        type,
        capabilities: capsForType(type),
      }));

      mockState.chatFallbackContent = jsonResponse(models);

      const ids = validTypes.map((t) => `model-${t}`);
      const result = await resolveModelCapabilities(ids, "openai");

      for (const type of validTypes) {
        expect(result!.has(`model-${type}`)).toBe(true);
        expect(result!.get(`model-${type}`)!.type).toBe(type);
      }
    });

    test("should handle all valid ModelCapability values", async () => {
      const allCaps = [
        "chat", "function_calling", "vision", "speech",
        "transcription", "text_to_image", "embeddings",
      ];
      mockState.chatFallbackContent = jsonResponse([
        { id: "super-model", type: "llm", capabilities: allCaps },
      ]);

      const result = await resolveModelCapabilities(["super-model"], "openai");
      const cap = result!.get("super-model")!;
      for (const c of allCaps) {
        expect(cap.capabilities).toContain(c);
      }
    });

    test("should return an empty Map (not null) when LLM returns valid JSON with no matching IDs", async () => {
      mockState.chatFallbackContent = "[]";

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeInstanceOf(Map);
      expect(result!.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("unknown model handling", () => {
    beforeEach(() => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
    });

    test("should not include an unknown model in the result when web search is unavailable", async () => {
      mockState.chatFallbackContent = jsonResponse([{ id: "mystery-model", unknown: true }]);
      mockState.searchToolAvailable = false;

      const result = await resolveModelCapabilities(["mystery-model"], "openai");
      expect(result!.has("mystery-model")).toBe(false);
    });

    test("should attempt web search for each unknown model when the tool is available", async () => {
      // First chat call: marks models as unknown
      // Second chat call: returns resolved data after enrichment
      mockState.chatResponseQueue = [
        jsonResponse([
          { id: "mystery-model", unknown: true },
          { id: "another-unknown", unknown: true },
        ]),
        jsonResponse([
          { id: "mystery-model", type: "llm", capabilities: ["chat"] },
          { id: "another-unknown", type: "llm", capabilities: ["chat"] },
        ]),
      ];
      mockState.searchToolAvailable = true;
      mockState.searchResults["mystery-model"] = "Mystery Model is a powerful LLM for text generation.";
      mockState.searchResults["another-unknown"] = "Another Unknown is a chat model.";

      await resolveModelCapabilities(["mystery-model", "another-unknown"], "openai");

      expect(mockState.searchQueries.some((q) => q.includes("mystery-model"))).toBe(true);
      expect(mockState.searchQueries.some((q) => q.includes("another-unknown"))).toBe(true);
    });

    test("should merge web-search-resolved capabilities into the result Map", async () => {
      mockState.chatResponseQueue = [
        jsonResponse([{ id: "unknown-m", unknown: true }]),
        jsonResponse([{ id: "unknown-m", type: "tts", capabilities: ["speech"] }]),
      ];
      mockState.searchToolAvailable = true;
      mockState.searchResults["unknown-m"] = "Unknown-M is a text-to-speech model by Acme Corp.";

      const result = await resolveModelCapabilities(["unknown-m"], "openai");

      expect(result!.has("unknown-m")).toBe(true);
      expect(result!.get("unknown-m")!.type).toBe("tts");
      expect(result!.get("unknown-m")!.capabilities).toContain("speech");
    });

    test("should still return known models even when some are marked unknown", async () => {
      mockState.chatResponseQueue = [
        jsonResponse([
          { id: "known-model", type: "llm", capabilities: ["chat"] },
          { id: "unknown-m", unknown: true },
        ]),
        // Second call for enrichment returns nothing useful — unknown-m search returns Error
        "[]",
      ];
      mockState.searchToolAvailable = true;
      mockState.searchResults["unknown-m"] = "Error: not found";

      const result = await resolveModelCapabilities(["known-model", "unknown-m"], "openai");

      expect(result!.has("known-model")).toBe(true);
      expect(result!.get("known-model")!.type).toBe("llm");
    });

    test("should not call web search when no models are marked unknown", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "llm", capabilities: ["chat", "function_calling"] },
      ]);
      mockState.searchToolAvailable = true; // tool is available but should not be called

      await resolveModelCapabilities(["gpt-4o"], "openai");

      expect(mockState.searchQueries).toHaveLength(0);
    });

    test("should make only one LLM call when no unknown models are returned", async () => {
      mockState.chatFallbackContent = jsonResponse([
        { id: "gpt-4o", type: "llm", capabilities: ["chat"] },
      ]);

      await resolveModelCapabilities(["gpt-4o"], "openai");

      expect(mockState.capturedMessagesList).toHaveLength(1);
    });

    test("should make two LLM calls when unknown models are enriched via web search", async () => {
      mockState.chatResponseQueue = [
        jsonResponse([{ id: "mystery-model", unknown: true }]),
        jsonResponse([{ id: "mystery-model", type: "llm", capabilities: ["chat"] }]),
      ];
      mockState.searchToolAvailable = true;
      mockState.searchResults["mystery-model"] = "Mystery Model docs: it supports chat.";

      await resolveModelCapabilities(["mystery-model"], "openai");

      expect(mockState.capturedMessagesList).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  describe("error and fallback handling", () => {
    beforeEach(() => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
    });

    test("should return null when llmService.chat() throws", async () => {
      mockState.chatShouldThrow = true;
      mockState.chatError = new Error("LLM unavailable");

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null when llmService.chat() returns null content", async () => {
      mockState.chatFallbackContent = null;

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null when the LLM response contains no JSON array", async () => {
      mockState.chatFallbackContent = "This is not JSON at all, just plain text.";

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null when the LLM response JSON is an object, not an array", async () => {
      // An object literal has no [...] brackets so the array regex finds no match
      mockState.chatFallbackContent = '{"id": "gpt-4o", "type": "llm"}';

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null when the LLM throws with a timeout-like error message", async () => {
      mockState.chatShouldThrow = true;
      mockState.chatError = new Error("Timeout after 30000ms");

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should not throw — always returns null or a Map", async () => {
      mockState.chatShouldThrow = true;
      mockState.chatError = new Error("Catastrophic failure");

      await expect(resolveModelCapabilities(["gpt-4o"], "openai")).resolves.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("markdown-fenced JSON handling", () => {
    beforeEach(() => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
    });

    test("should parse JSON wrapped in ```json markdown fences", async () => {
      const fenced =
        "```json\n" +
        jsonResponse([{ id: "gpt-4o", type: "llm", capabilities: ["chat", "function_calling"] }]) +
        "\n```";
      mockState.chatFallbackContent = fenced;

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(true);
      expect(result!.get("gpt-4o")!.type).toBe("llm");
    });

    test("should parse JSON wrapped in plain triple-backtick fences", async () => {
      const fenced =
        "```\n" +
        jsonResponse([{ id: "gpt-4o", type: "llm", capabilities: ["chat"] }]) +
        "\n```";
      mockState.chatFallbackContent = fenced;

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(true);
    });

    test("should parse JSON embedded in surrounding prose text", async () => {
      const prose =
        "Here is my analysis:\n" +
        jsonResponse([{ id: "gpt-4o", type: "vllm", capabilities: ["chat", "vision"] }]) +
        "\nHope this helps!";
      mockState.chatFallbackContent = prose;

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result!.has("gpt-4o")).toBe(true);
      expect(result!.get("gpt-4o")!.type).toBe("vllm");
    });

    test("should return null when fences wrap malformed JSON", async () => {
      const fenced = "```json\n[{broken json here\n```";
      mockState.chatFallbackContent = fenced;

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });

    test("should return null when the response is only whitespace", async () => {
      mockState.chatFallbackContent = "   \n\t  ";

      const result = await resolveModelCapabilities(["gpt-4o"], "openai");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("buildPrompt — provider label injection", () => {
    beforeEach(() => {
      mockState.currentModel = { provider: "OpenAI", model: "gpt-4o", api_mode: "openai" };
      // Return a valid empty response so the function completes without error
      mockState.chatFallbackContent = "[]";
    });

    test("should include 'OpenAI-kompatibel' in the prompt for openai apiMode", async () => {
      await resolveModelCapabilities(["some-model"], "openai");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(typeof userMsg?.content).toBe("string");
      expect(userMsg!.content).toContain("OpenAI-kompatibel");
    });

    test("should include 'Ollama' in the prompt for ollama apiMode", async () => {
      await resolveModelCapabilities(["some-model"], "ollama");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("Ollama");
    });

    test("should include 'Google Gemini' in the prompt for google_gemini apiMode", async () => {
      await resolveModelCapabilities(["some-model"], "google_gemini");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("Google Gemini");
    });

    test("should include the raw apiMode string in the prompt for an unknown api mode", async () => {
      await resolveModelCapabilities(["some-model"], "custom_provider");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("custom_provider");
    });

    test("should include all requested model IDs in the prompt", async () => {
      await resolveModelCapabilities(["model-alpha", "model-beta"], "openai");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("model-alpha");
      expect(userMsg!.content).toContain("model-beta");
    });

    test("should include a system message that instructs JSON-only output", async () => {
      await resolveModelCapabilities(["some-model"], "openai");
      const sysMsg = lastCapturedMessages().find((m) => m.role === "system");
      expect(sysMsg).toBeDefined();
      expect(sysMsg!.content.toLowerCase()).toContain("json");
    });

    test("should list allowed capability values in the prompt", async () => {
      await resolveModelCapabilities(["some-model"], "openai");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("function_calling");
      expect(userMsg!.content).toContain("text_to_image");
      expect(userMsg!.content).toContain("embeddings");
    });

    test("should list allowed type values in the prompt", async () => {
      await resolveModelCapabilities(["some-model"], "openai");
      const userMsg = lastCapturedMessages().find((m) => m.role === "user");
      expect(userMsg!.content).toContain("image_gen");
      expect(userMsg!.content).toContain("vllm");
    });
  });
});
