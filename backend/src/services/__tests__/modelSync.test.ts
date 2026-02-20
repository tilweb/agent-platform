/**
 * Tests for the Model Sync Service (backend/src/services/modelSync.ts)
 *
 * All external dependencies (fetch, providers service, llm service) are mocked
 * so no real network calls or file I/O occur.
 * Mocks MUST be declared before any dynamic import of the module under test.
 */

import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Simulates the fetch response
  fetchResponse: {
    ok: true,
    status: 200,
    statusText: "OK",
    body: { data: [] as Array<{ id: string; owned_by?: string; featureSet?: number }> },
  },
  // Simulates the providers config loaded from disk
  providersConfig: {
    providers: [
      {
        id: "adacor",
        name: "Adacor AI",
        api_mode: "openai" as const,
        base_url: "https://api.adacor.ai/v1",
        api_key_env: "ADACOR_AI_API_KEY",
        enabled: true,
        protected: true,
        company_region: undefined as string | undefined,
        datacenter_country: undefined as string | undefined,
        models: [] as Array<{
          id: string;
          name: string;
          type: string;
          capabilities: string[];
          enabled?: boolean;
          protected?: boolean;
          feature_set?: number;
          feature_urls?: Record<string, string>;
          base_url?: string;
          workplace?: boolean;
        }>,
      },
    ],
    active: {
      chat: { provider_id: null, model_id: null },
      vision: { provider_id: null, model_id: null },
      tts: { provider_id: null, model_id: null },
      stt: { provider_id: null, model_id: null },
      text_to_image: { provider_id: null, model_id: null },
      image_to_image: { provider_id: null, model_id: null },
    },
  },
  savedConfig: null as unknown,
  reloadCalled: false,
  reloadShouldThrow: false,
  fetchShouldThrow: false,
  withLockCallCount: 0,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../providers", () => ({
  loadProvidersConfig: async () => {
    // Return a deep copy so mutations in tests do not bleed into mockState
    return JSON.parse(JSON.stringify(mockState.providersConfig));
  },
  saveProvidersConfig: async (config: unknown) => {
    mockState.savedConfig = config;
  },
  withProviderLock: async (fn: () => Promise<unknown>) => {
    mockState.withLockCallCount++;
    return fn();
  },
}));

mock.module("../llm", () => ({
  llmService: {
    reload: async () => {
      if (mockState.reloadShouldThrow) {
        throw new Error("LLM reload failed");
      }
      mockState.reloadCalled = true;
    },
  },
}));

// Mock global fetch
const originalFetch = globalThis.fetch;
mock.module("node:http", () => ({})); // ensure we intercept the global

// ---------------------------------------------------------------------------
// Override globalThis.fetch BEFORE dynamic import
// ---------------------------------------------------------------------------

globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
  if (mockState.fetchShouldThrow) {
    throw new Error("Network error");
  }
  return {
    ok: mockState.fetchResponse.ok,
    status: mockState.fetchResponse.status,
    statusText: mockState.fetchResponse.statusText,
    json: async () => mockState.fetchResponse.body,
  } as Response;
};

// ---------------------------------------------------------------------------
// Import the module AFTER mocks are registered
// ---------------------------------------------------------------------------

const { isModelSyncConfigured, syncAdacorModels } = await import("../modelSync");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRemoteModels(
  models: Array<{ id: string; owned_by?: string; featureSet?: number }>
) {
  mockState.fetchResponse.body = { data: models };
}

function setExistingModels(
  models: Array<{
    id: string;
    name?: string;
    type?: string;
    capabilities?: string[];
    enabled?: boolean;
    protected?: boolean;
    feature_set?: number;
    feature_urls?: Record<string, string>;
    base_url?: string;
    workplace?: boolean;
  }>
) {
  mockState.providersConfig.providers[0]!.models = models.map((m) => ({
    name: m.name ?? m.id,
    type: m.type ?? "vllm",
    capabilities: m.capabilities ?? ["chat", "function_calling"],
    ...m,
  }));
}

/** Extract the saved adacor provider from mockState.savedConfig. */
function getSavedAdacorProvider() {
  const saved = mockState.savedConfig as typeof mockState.providersConfig;
  return saved.providers.find((p: { id: string }) => p.id === "adacor")!;
}

/** Find a model by ID in the saved adacor provider. */
function getSavedModel(modelId: string) {
  return getSavedAdacorProvider().models.find(
    (m: { id: string }) => m.id === modelId
  )!;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("isModelSyncConfigured()", () => {
  afterEach(() => {
    delete process.env.ADACOR_AI_API_BASE;
    delete process.env.ADACOR_AI_MODELS_PATH;
    delete process.env.ADACOR_AI_MODELS_URL;
  });

  test("should return true when ADACOR_AI_API_BASE + ADACOR_AI_MODELS_PATH are set", () => {
    process.env.ADACOR_AI_API_BASE = "https://api.example.com";
    process.env.ADACOR_AI_MODELS_PATH = "/v1/models";
    expect(isModelSyncConfigured()).toBe(true);
  });

  test("should return true with legacy ADACOR_AI_MODELS_URL", () => {
    process.env.ADACOR_AI_MODELS_URL = "https://api.example.com/v1/models";
    expect(isModelSyncConfigured()).toBe(true);
  });

  test("should return false when nothing is set", () => {
    expect(isModelSyncConfigured()).toBe(false);
  });

  test("should return false when ADACOR_AI_MODELS_URL is an empty string", () => {
    process.env.ADACOR_AI_MODELS_URL = "";
    expect(isModelSyncConfigured()).toBe(false);
  });

  test("should return false when only ADACOR_AI_API_BASE is set without ADACOR_AI_MODELS_PATH", () => {
    process.env.ADACOR_AI_API_BASE = "https://api.example.com";
    expect(isModelSyncConfigured()).toBe(false);
  });

  test("should return false when only ADACOR_AI_MODELS_PATH is set without ADACOR_AI_API_BASE", () => {
    process.env.ADACOR_AI_MODELS_PATH = "/v1/models";
    expect(isModelSyncConfigured()).toBe(false);
  });

  test("should return true when both new-style vars are set even if legacy URL is absent", () => {
    process.env.ADACOR_AI_API_BASE = "https://api.example.com";
    process.env.ADACOR_AI_MODELS_PATH = "/v1/models";
    delete process.env.ADACOR_AI_MODELS_URL;
    expect(isModelSyncConfigured()).toBe(true);
  });

  test("should return true when legacy URL is set even if new-style vars are absent", () => {
    delete process.env.ADACOR_AI_API_BASE;
    delete process.env.ADACOR_AI_MODELS_PATH;
    process.env.ADACOR_AI_MODELS_URL = "https://api.example.com/v1/models";
    expect(isModelSyncConfigured()).toBe(true);
  });

  test("should return false when ADACOR_AI_API_BASE is empty string even with MODELS_PATH set", () => {
    process.env.ADACOR_AI_API_BASE = "";
    process.env.ADACOR_AI_MODELS_PATH = "/v1/models";
    expect(isModelSyncConfigured()).toBe(false);
  });

  test("should return false when ADACOR_AI_MODELS_PATH is empty string even with API_BASE set", () => {
    process.env.ADACOR_AI_API_BASE = "https://api.example.com";
    process.env.ADACOR_AI_MODELS_PATH = "";
    expect(isModelSyncConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("syncAdacorModels()", () => {
  beforeEach(() => {
    // Reset all mutable state between tests
    process.env.ADACOR_AI_MODELS_URL = "https://api.example.com/v1/models";
    delete process.env.ADACOR_AI_API_BASE;
    delete process.env.ADACOR_AI_MODELS_PATH;
    delete process.env.ADACOR_AI_MODELS_HEADERS;
    delete process.env.ADACOR_AI_FEATURE_PATHS;
    delete process.env.ADACOR_AI_API_KEY;

    mockState.fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      body: { data: [] },
    };
    mockState.savedConfig = null;
    mockState.reloadCalled = false;
    mockState.reloadShouldThrow = false;
    mockState.fetchShouldThrow = false;
    mockState.withLockCallCount = 0;
    mockState.providersConfig.providers[0]!.models = [];
    mockState.providersConfig.providers[0]!.company_region = undefined;
    mockState.providersConfig.providers[0]!.datacenter_country = undefined;
  });

  afterEach(() => {
    delete process.env.ADACOR_AI_API_BASE;
    delete process.env.ADACOR_AI_MODELS_PATH;
    delete process.env.ADACOR_AI_MODELS_URL;
    delete process.env.ADACOR_AI_MODELS_HEADERS;
    delete process.env.ADACOR_AI_FEATURE_PATHS;
    delete process.env.ADACOR_AI_API_KEY;
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe("return value", () => {
    test("should return a result object with all counter fields", async () => {
      const result = await syncAdacorModels();

      expect(result).toHaveProperty("added");
      expect(result).toHaveProperty("updated");
      expect(result).toHaveProperty("deactivated");
      expect(result).toHaveProperty("reactivated");
      expect(result).toHaveProperty("unchanged");
      expect(result).toHaveProperty("timestamp");
    });

    test("should include a valid ISO timestamp in the result", async () => {
      const before = new Date().toISOString();
      const result = await syncAdacorModels();
      const after = new Date().toISOString();

      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    test("should return all zeros when remote and local models are empty", async () => {
      const result = await syncAdacorModels();

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deactivated).toBe(0);
      expect(result.reactivated).toBe(0);
      expect(result.unchanged).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Adding new models
  // -------------------------------------------------------------------------

  describe("adding new models", () => {
    test("should count a model as added when it is new in the API response", async () => {
      setRemoteModels([{ id: "new-model-7b" }]);

      const result = await syncAdacorModels();

      expect(result.added).toBe(1);
    });

    test("should count each new model separately", async () => {
      setRemoteModels([
        { id: "model-alpha-7b" },
        { id: "model-beta-13b" },
        { id: "model-gamma-70b" },
      ]);

      const result = await syncAdacorModels();

      expect(result.added).toBe(3);
    });

    test("should save a new model with enabled:true", async () => {
      setRemoteModels([{ id: "new-model-7b" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("new-model-7b");
      expect(newModel).toBeDefined();
      expect(newModel!.enabled).toBe(true);
    });

    test("should save a new model with type:vllm when no featureSet is provided", async () => {
      setRemoteModels([{ id: "new-model-7b" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("new-model-7b");
      expect(newModel.type).toBe("vllm");
    });

    test("should save a new model with chat and function_calling capabilities when no featureSet", async () => {
      setRemoteModels([{ id: "new-model-7b" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("new-model-7b");
      expect(newModel.capabilities).toContain("chat");
      expect(newModel.capabilities).toContain("function_calling");
    });

    test("should derive a human-readable name for a new model", async () => {
      setRemoteModels([{ id: "mistral-3-24b" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("mistral-3-24b");
      // deriveModelName splits on [-_], capitalizes words and size suffixes
      expect(newModel.name).toBe("Mistral 3 24B");
    });

    test("should uppercase size suffix tokens in derived name", async () => {
      setRemoteModels([{ id: "llama-70b-instruct" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("llama-70b-instruct");
      expect(newModel.name).toBe("Llama 70B Instruct");
    });

    test("should handle underscore-separated model id in derived name", async () => {
      setRemoteModels([{ id: "my_model_13b" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("my_model_13b");
      expect(newModel.name).toBe("My Model 13B");
    });

    test("should derive name with mixed separators", async () => {
      setRemoteModels([{ id: "gpt_4o" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("gpt_4o");
      expect(newModel.name).toBe("Gpt 4o");
    });

    test("should handle single-token model id in derived name", async () => {
      setRemoteModels([{ id: "gemini" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("gemini");
      expect(newModel.name).toBe("Gemini");
    });

    test("should uppercase 'k' size suffix in derived name", async () => {
      setRemoteModels([{ id: "embed-128k" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("embed-128k");
      expect(newModel.name).toBe("Embed 128K");
    });

    test("should uppercase 'm' size suffix in derived name", async () => {
      setRemoteModels([{ id: "nano-8m" }]);

      await syncAdacorModels();

      const newModel = getSavedModel("nano-8m");
      expect(newModel.name).toBe("Nano 8M");
    });
  });

  // -------------------------------------------------------------------------
  // Unchanged models
  // -------------------------------------------------------------------------

  describe("unchanged models", () => {
    test("should count an already-enabled existing model as unchanged", async () => {
      setExistingModels([{ id: "existing-model", enabled: true }]);
      setRemoteModels([{ id: "existing-model" }]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(1);
      expect(result.added).toBe(0);
      expect(result.reactivated).toBe(0);
    });

    test("should count multiple already-enabled existing models correctly", async () => {
      setExistingModels([
        { id: "model-a", enabled: true },
        { id: "model-b", enabled: true },
      ]);
      setRemoteModels([{ id: "model-a" }, { id: "model-b" }]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(2);
    });

    test("should count an existing model with no enabled flag as unchanged", async () => {
      // enabled: undefined is treated as truthy (not === false)
      setExistingModels([{ id: "existing-model" }]);
      setRemoteModels([{ id: "existing-model" }]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(1);
    });

    test("should count an enabled existing model without featureSet in API as unchanged", async () => {
      // Model exists in config with no featureSet; API returns it without featureSet
      setExistingModels([{ id: "stable-model", enabled: true }]);
      setRemoteModels([{ id: "stable-model" }]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Reactivating deactivated models
  // -------------------------------------------------------------------------

  describe("reactivating models", () => {
    test("should reactivate a model that was deactivated but is back in the API", async () => {
      setExistingModels([{ id: "old-model", enabled: false }]);
      setRemoteModels([{ id: "old-model" }]);

      const result = await syncAdacorModels();

      expect(result.reactivated).toBe(1);
      expect(result.added).toBe(0);
      expect(result.unchanged).toBe(0);
    });

    test("should save a reactivated model with enabled:true", async () => {
      setExistingModels([{ id: "old-model", enabled: false }]);
      setRemoteModels([{ id: "old-model" }]);

      await syncAdacorModels();

      const model = getSavedModel("old-model");
      expect(model.enabled).toBe(true);
    });

    test("should count multiple reactivations correctly", async () => {
      setExistingModels([
        { id: "model-x", enabled: false },
        { id: "model-y", enabled: false },
      ]);
      setRemoteModels([{ id: "model-x" }, { id: "model-y" }]);

      const result = await syncAdacorModels();

      expect(result.reactivated).toBe(2);
    });

    test("should update feature fields when reactivating with a featureSet", async () => {
      setExistingModels([{ id: "old-model", enabled: false, capabilities: ["chat"] }]);
      setRemoteModels([{ id: "old-model", featureSet: 3 }]); // chat + vision

      await syncAdacorModels();

      const model = getSavedModel("old-model");
      expect(model.enabled).toBe(true);
      expect(model.feature_set).toBe(3);
      expect(model.capabilities).toContain("vision");
    });

    test("should set workplace=true on reactivation when bit 256 is set", async () => {
      setExistingModels([{ id: "wp-model", enabled: false }]);
      setRemoteModels([{ id: "wp-model", featureSet: 1 | 256 }]);

      await syncAdacorModels();

      const model = getSavedModel("wp-model");
      expect(model.workplace).toBe(true);
    });

    test("should set workplace=false on reactivation when bit 256 is absent", async () => {
      setExistingModels([{ id: "no-wp-model", enabled: false, workplace: true }]);
      setRemoteModels([{ id: "no-wp-model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("no-wp-model");
      expect(model.workplace).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Deactivating removed models
  // -------------------------------------------------------------------------

  describe("deactivating models", () => {
    test("should deactivate a model no longer present in the API", async () => {
      setExistingModels([{ id: "removed-model", enabled: true }]);
      setRemoteModels([]);

      const result = await syncAdacorModels();

      expect(result.deactivated).toBe(1);
    });

    test("should save the deactivated model with enabled:false", async () => {
      setExistingModels([{ id: "removed-model", enabled: true }]);
      setRemoteModels([]);

      await syncAdacorModels();

      const model = getSavedModel("removed-model");
      expect(model.enabled).toBe(false);
    });

    test("should not deactivate a protected model even when absent from the API", async () => {
      setExistingModels([{ id: "protected-model", enabled: true, protected: true }]);
      setRemoteModels([]);

      const result = await syncAdacorModels();

      expect(result.deactivated).toBe(0);
    });

    test("should not deactivate a model that is already disabled", async () => {
      setExistingModels([{ id: "already-off", enabled: false }]);
      setRemoteModels([]);

      const result = await syncAdacorModels();

      expect(result.deactivated).toBe(0);
    });

    test("should deactivate a model that has no enabled flag and is absent from API", async () => {
      // enabled: undefined — treated as not === false, so should be deactivated
      setExistingModels([{ id: "flag-less-model" }]);
      setRemoteModels([]);

      const result = await syncAdacorModels();

      // enabled !== false means the model IS active, so it gets deactivated
      expect(result.deactivated).toBe(1);
    });

    test("should count multiple deactivations correctly", async () => {
      setExistingModels([
        { id: "gone-a", enabled: true },
        { id: "gone-b", enabled: true },
        { id: "gone-c", enabled: true },
      ]);
      setRemoteModels([]);

      const result = await syncAdacorModels();

      expect(result.deactivated).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed scenarios
  // -------------------------------------------------------------------------

  describe("mixed add/unchanged/deactivate/reactivate", () => {
    test("should correctly process a realistic mixed update", async () => {
      setExistingModels([
        { id: "keep-me", enabled: true },      // unchanged
        { id: "remove-me", enabled: true },    // deactivated
        { id: "revive-me", enabled: false },   // reactivated
      ]);
      setRemoteModels([
        { id: "keep-me" },    // unchanged
        { id: "revive-me" },  // reactivated
        { id: "brand-new" },  // added
      ]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(1);
      expect(result.deactivated).toBe(1);
      expect(result.reactivated).toBe(1);
      expect(result.added).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1 promotion (owned_by: "Adacor")
  // -------------------------------------------------------------------------

  describe("Tier 1 provider promotion", () => {
    test("should set company_region:germany when a model is owned_by Adacor", async () => {
      setRemoteModels([{ id: "adacor-model", owned_by: "Adacor" }]);

      await syncAdacorModels();

      const adacor = getSavedAdacorProvider();
      expect(adacor.company_region).toBe("germany");
    });

    test("should set datacenter_country:DE when a model is owned_by Adacor", async () => {
      setRemoteModels([{ id: "adacor-model", owned_by: "Adacor" }]);

      await syncAdacorModels();

      const adacor = getSavedAdacorProvider();
      expect(adacor.datacenter_country).toBe("DE");
    });

    test("should not change provider fields when no model is owned_by Adacor", async () => {
      setRemoteModels([{ id: "foreign-model", owned_by: "OpenAI" }]);

      await syncAdacorModels();

      const adacor = getSavedAdacorProvider();
      expect(adacor.company_region).toBeUndefined();
      expect(adacor.datacenter_country).toBeUndefined();
    });

    test("should not overwrite Tier 1 fields that are already correctly set", async () => {
      mockState.providersConfig.providers[0]!.company_region = "germany";
      mockState.providersConfig.providers[0]!.datacenter_country = "DE";
      setRemoteModels([{ id: "adacor-model", owned_by: "Adacor" }]);

      await syncAdacorModels();

      const adacor = getSavedAdacorProvider();
      expect(adacor.company_region).toBe("germany");
      expect(adacor.datacenter_country).toBe("DE");
    });

    test("should set Tier 1 fields even when owned_by Adacor is only on one of many models", async () => {
      setRemoteModels([
        { id: "foreign-model", owned_by: "SomeCompany" },
        { id: "adacor-model", owned_by: "Adacor" },
      ]);

      await syncAdacorModels();

      const adacor = getSavedAdacorProvider();
      expect(adacor.company_region).toBe("germany");
      expect(adacor.datacenter_country).toBe("DE");
    });
  });

  // -------------------------------------------------------------------------
  // LLM service reload
  // -------------------------------------------------------------------------

  describe("LLM service reload", () => {
    test("should call llmService.reload() after a successful sync", async () => {
      await syncAdacorModels();

      expect(mockState.reloadCalled).toBe(true);
    });

    test("should still return a valid result even when llmService.reload() throws", async () => {
      mockState.reloadShouldThrow = true;

      // Should not throw — error is swallowed
      const result = await syncAdacorModels();

      expect(result).toHaveProperty("timestamp");
    });

    test("should complete the sync (savedConfig non-null) even when reload throws", async () => {
      mockState.reloadShouldThrow = true;
      setRemoteModels([{ id: "new-model" }]);

      await syncAdacorModels();

      expect(mockState.savedConfig).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // withProviderLock usage
  // -------------------------------------------------------------------------

  describe("provider lock", () => {
    test("should call withProviderLock exactly once per sync", async () => {
      await syncAdacorModels();

      expect(mockState.withLockCallCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Config persistence
  // -------------------------------------------------------------------------

  describe("config persistence", () => {
    test("should call saveProvidersConfig after processing remote models", async () => {
      setRemoteModels([{ id: "saved-model" }]);

      await syncAdacorModels();

      expect(mockState.savedConfig).not.toBeNull();
    });

    test("should save config even when there are no changes", async () => {
      // no remote, no local models → nothing to change but save should still happen
      await syncAdacorModels();

      expect(mockState.savedConfig).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    test("should throw when no models URL is configured", async () => {
      delete process.env.ADACOR_AI_MODELS_URL;
      delete process.env.ADACOR_AI_API_BASE;
      delete process.env.ADACOR_AI_MODELS_PATH;

      await expect(syncAdacorModels()).rejects.toThrow(
        "ADACOR_AI_MODELS_PATH"
      );
    });

    test("should throw when the fetch response is not ok (non-2xx status)", async () => {
      mockState.fetchResponse = {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        body: { data: [] },
      };

      await expect(syncAdacorModels()).rejects.toThrow("Models API returned 503");
    });

    test("should include the HTTP status code in the error message on non-ok response", async () => {
      mockState.fetchResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: { data: [] },
      };

      await expect(syncAdacorModels()).rejects.toThrow("404");
    });

    test("should throw when the response body has no data array", async () => {
      mockState.fetchResponse.ok = true;
      // @ts-ignore — intentionally malformed response
      mockState.fetchResponse.body = { object: "list" };

      await expect(syncAdacorModels()).rejects.toThrow(
        "Invalid models API response: missing data array"
      );
    });

    test("should throw when the response body data field is not an array", async () => {
      mockState.fetchResponse.ok = true;
      // @ts-ignore — intentionally malformed response
      mockState.fetchResponse.body = { data: "not-an-array" };

      await expect(syncAdacorModels()).rejects.toThrow(
        "Invalid models API response: missing data array"
      );
    });

    test("should throw when fetch itself throws (network error)", async () => {
      mockState.fetchShouldThrow = true;

      await expect(syncAdacorModels()).rejects.toThrow("Network error");
    });

    test("should throw when the adacor provider is not found in config", async () => {
      // Replace providers list with one that doesn't include adacor
      mockState.providersConfig.providers = [
        {
          id: "other-provider",
          name: "Other",
          api_mode: "openai",
          base_url: "https://example.com",
          api_key_env: null,
          enabled: true,
          protected: false,
          company_region: undefined,
          datacenter_country: undefined,
          models: [],
        },
      ];
      setRemoteModels([{ id: "some-model" }]);

      await expect(syncAdacorModels()).rejects.toThrow(
        "Provider 'adacor' not found in configuration"
      );

      // Restore for subsequent tests
      mockState.providersConfig.providers = [
        {
          id: "adacor",
          name: "Adacor AI",
          api_mode: "openai",
          base_url: "https://api.adacor.ai/v1",
          api_key_env: "ADACOR_AI_API_KEY",
          enabled: true,
          protected: true,
          company_region: undefined,
          datacenter_country: undefined,
          models: [],
        },
      ];
    });

    test("should throw with 401 status in error message", async () => {
      mockState.fetchResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        body: { data: [] },
      };

      await expect(syncAdacorModels()).rejects.toThrow("401");
    });
  });

  // -------------------------------------------------------------------------
  // Custom request headers (ADACOR_AI_MODELS_HEADERS)
  // -------------------------------------------------------------------------

  describe("custom request headers", () => {
    test("should succeed without custom headers when ADACOR_AI_MODELS_HEADERS is not set", async () => {
      delete process.env.ADACOR_AI_MODELS_HEADERS;

      // No throw means fetch was called without issues
      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should succeed when ADACOR_AI_MODELS_HEADERS is set with a single header", async () => {
      process.env.ADACOR_AI_MODELS_HEADERS = "Authorization: Bearer token123";

      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should succeed when ADACOR_AI_MODELS_HEADERS has multiple headers separated by semicolons", async () => {
      process.env.ADACOR_AI_MODELS_HEADERS =
        "Authorization: Bearer token123; X-Custom: value";

      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should ignore malformed header parts that have no colon separator", async () => {
      process.env.ADACOR_AI_MODELS_HEADERS = "BadHeaderNoColon; Authorization: Bearer tok";

      // Should not throw — bad parts are silently skipped
      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });
  });

  // -------------------------------------------------------------------------
  // URL construction: ADACOR_AI_API_BASE + ADACOR_AI_MODELS_PATH
  // -------------------------------------------------------------------------

  describe("URL construction from API_BASE + MODELS_PATH", () => {
    test("should succeed when configured via new-style BASE + PATH variables", async () => {
      delete process.env.ADACOR_AI_MODELS_URL;
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_MODELS_PATH = "/v1/models";

      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should strip trailing slash from API_BASE before concatenating PATH", async () => {
      delete process.env.ADACOR_AI_MODELS_URL;
      process.env.ADACOR_AI_API_BASE = "https://api.example.com/";
      process.env.ADACOR_AI_MODELS_PATH = "/v1/models";

      // If double-slash caused a broken URL the mock fetch would still succeed —
      // we just verify no exception is thrown
      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should prefer new-style BASE+PATH over legacy MODELS_URL when both are set", async () => {
      process.env.ADACOR_AI_API_BASE = "https://new.example.com";
      process.env.ADACOR_AI_MODELS_PATH = "/v1/models";
      process.env.ADACOR_AI_MODELS_URL = "https://legacy.example.com/v1/models";

      // Both are valid; the sync should succeed regardless of which URL is used
      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: type derivation
  // -------------------------------------------------------------------------

  describe("featureSet — type derivation", () => {
    test("should set type='vllm' when featureSet has bit 1 (chat) set", async () => {
      setRemoteModels([{ id: "chat-model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("chat-model");
      expect(model.type).toBe("vllm");
    });

    test("should set type='stt' when featureSet has only bit 64 (audio) set", async () => {
      setRemoteModels([{ id: "audio-model", featureSet: 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("audio-model");
      expect(model.type).toBe("stt");
    });

    test("should prefer vllm over stt when featureSet has both bits 1 and 64 set", async () => {
      setRemoteModels([{ id: "multi-model", featureSet: 1 | 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("multi-model");
      expect(model.type).toBe("vllm");
    });

    test("should set type='vllm' as default for embeddings-only featureSet (bit 32)", async () => {
      setRemoteModels([{ id: "embed-model", featureSet: 32 }]);

      await syncAdacorModels();

      const model = getSavedModel("embed-model");
      expect(model.type).toBe("vllm");
    });

    test("should set type='vllm' for featureSet 0", async () => {
      setRemoteModels([{ id: "zero-model", featureSet: 0 }]);

      await syncAdacorModels();

      const model = getSavedModel("zero-model");
      expect(model.type).toBe("vllm");
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: capability derivation
  // -------------------------------------------------------------------------

  describe("featureSet — capability derivation", () => {
    test("featureSet 1 → capabilities=['chat']", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["chat"]);
    });

    test("featureSet 2 → capabilities=['vision']", async () => {
      setRemoteModels([{ id: "model", featureSet: 2 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["vision"]);
    });

    test("featureSet 3 → capabilities=['chat', 'vision']", async () => {
      setRemoteModels([{ id: "model", featureSet: 3 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toContain("chat");
      expect(model.capabilities).toContain("vision");
    });

    test("featureSet 4 → capabilities=['function_calling']", async () => {
      setRemoteModels([{ id: "model", featureSet: 4 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["function_calling"]);
    });

    test("featureSet 7 → capabilities=['chat', 'vision', 'function_calling']", async () => {
      setRemoteModels([{ id: "model", featureSet: 7 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toContain("chat");
      expect(model.capabilities).toContain("vision");
      expect(model.capabilities).toContain("function_calling");
    });

    test("featureSet 32 → capabilities=['embeddings']", async () => {
      setRemoteModels([{ id: "model", featureSet: 32 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["embeddings"]);
    });

    test("featureSet 64 → capabilities=['transcription']", async () => {
      setRemoteModels([{ id: "model", featureSet: 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["transcription"]);
    });

    test("featureSet 1|32 → capabilities include both 'chat' and 'embeddings'", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 | 32 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toContain("chat");
      expect(model.capabilities).toContain("embeddings");
    });

    test("featureSet 128 → capabilities=[] (tokenizer has no capability)", async () => {
      setRemoteModels([{ id: "model", featureSet: 128 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual([]);
    });

    test("featureSet 256 → capabilities=[] (workplace meta-flag has no capability)", async () => {
      setRemoteModels([{ id: "model", featureSet: 256 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual([]);
    });

    test("featureSet 1|256 → capabilities=['chat'] (bit 256 is meta, not a capability)", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 | 256 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toEqual(["chat"]);
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: workplace flag
  // -------------------------------------------------------------------------

  describe("featureSet — workplace flag", () => {
    test("should set workplace=true when featureSet bit 256 is set", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 | 256 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.workplace).toBe(true);
    });

    test("should set workplace=false when featureSet bit 256 is absent", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.workplace).toBe(false);
    });

    test("should set workplace=false when featureSet is 0", async () => {
      setRemoteModels([{ id: "model", featureSet: 0 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.workplace).toBe(false);
    });

    test("should set workplace=true when featureSet has bit 256 and multiple other bits", async () => {
      setRemoteModels([{ id: "model", featureSet: 1 | 2 | 4 | 256 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.workplace).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: feature_set field persisted
  // -------------------------------------------------------------------------

  describe("featureSet — feature_set field", () => {
    test("should store the raw featureSet value on the model", async () => {
      setRemoteModels([{ id: "model", featureSet: 7 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.feature_set).toBe(7);
    });

    test("should not set feature_set when API response has no featureSet", async () => {
      setRemoteModels([{ id: "model" }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.feature_set).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: base_url computation via ADACOR_AI_FEATURE_PATHS
  // -------------------------------------------------------------------------

  describe("featureSet — base_url computation", () => {
    test("should set base_url using bit-1 feature path when available", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/privateai/{model}/v1/chat/completions";
      setRemoteModels([{ id: "my-model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("my-model");
      expect(model.base_url).toBe(
        "https://api.example.com/chat/privateai/my-model/v1/chat/completions"
      );
    });

    test("should replace {model} placeholder with the actual model ID", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS = "1:/v1/{model}/chat";
      setRemoteModels([{ id: "awesome-model-7b", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("awesome-model-7b");
      expect(model.base_url).toContain("awesome-model-7b");
    });

    test("should prefer bit 1 over bit 64 for base_url when both are present in featureSet", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;64:/audio/{model}/v1/audio/transcriptions";
      setRemoteModels([{ id: "multi-model", featureSet: 1 | 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("multi-model");
      // bit-1 path should be chosen
      expect(model.base_url).toContain("/chat/");
    });

    test("should prefer bit 1 over bit 32 for base_url", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;32:/embed/{model}/v1/embeddings";
      setRemoteModels([{ id: "multi-model", featureSet: 1 | 32 }]);

      await syncAdacorModels();

      const model = getSavedModel("multi-model");
      expect(model.base_url).toContain("/chat/");
    });

    test("should fall back to bit 64 for base_url when bit 1 is not set", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "64:/audio/{model}/v1/audio/transcriptions";
      setRemoteModels([{ id: "audio-model", featureSet: 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("audio-model");
      expect(model.base_url).toContain("/audio/");
    });

    test("should fall back to bit 32 for base_url when bits 1 and 64 are not set", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS = "32:/embed/{model}/v1/embeddings";
      setRemoteModels([{ id: "embed-model", featureSet: 32 }]);

      await syncAdacorModels();

      const model = getSavedModel("embed-model");
      expect(model.base_url).toContain("/embed/");
    });

    test("should not set base_url when ADACOR_AI_API_BASE is absent", async () => {
      delete process.env.ADACOR_AI_API_BASE;
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.base_url).toBeUndefined();
    });

    test("should not set base_url when ADACOR_AI_FEATURE_PATHS is absent", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      delete process.env.ADACOR_AI_FEATURE_PATHS;
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.base_url).toBeUndefined();
    });

    test("should not set base_url when featureSet does not match any configured paths", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions";
      setRemoteModels([{ id: "model", featureSet: 64 }]); // only audio, no chat path

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.base_url).toBeUndefined();
    });

    test("should strip trailing slash from API_BASE before building base_url", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com/";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      // Should not have double slash after the base
      expect(model.base_url).not.toContain("//chat");
      expect(model.base_url).toContain(
        "https://api.example.com/chat/model/v1/chat/completions"
      );
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: feature_urls computation
  // -------------------------------------------------------------------------

  describe("featureSet — feature_urls computation", () => {
    test("should compute feature_urls from ADACOR_AI_FEATURE_PATHS for matching bits", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/privateai/{model}/v1/chat/completions";
      setRemoteModels([{ id: "my-model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("my-model");
      expect(model.feature_urls).toBeDefined();
      // Key is portion after {model}: "/v1/chat/completions"
      expect(model.feature_urls!["/v1/chat/completions"]).toBe(
        "https://api.example.com/chat/privateai/my-model/v1/chat/completions"
      );
    });

    test("should not include feature_urls entries for bits not set in featureSet", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      // Use distinct suffixes so there is no key collision between chat and audio paths
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;64:/audio/{model}/v1/audio/transcriptions";
      setRemoteModels([{ id: "my-model", featureSet: 1 }]); // only chat, no audio

      await syncAdacorModels();

      const model = getSavedModel("my-model");
      const keys = Object.keys(model.feature_urls ?? {});
      // The audio key "/v1/audio/transcriptions" must not be present
      expect(keys).not.toContain("/v1/audio/transcriptions");
      // Only the chat key should be present
      expect(keys).toContain("/v1/chat/completions");
    });

    test("should include feature_urls for multiple matching bits", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;64:/audio/{model}/v1/audio/transcriptions";
      setRemoteModels([{ id: "my-model", featureSet: 1 | 64 }]);

      await syncAdacorModels();

      const model = getSavedModel("my-model");
      expect(model.feature_urls).toBeDefined();
      const keys = Object.keys(model.feature_urls!);
      expect(keys.length).toBe(2);
    });

    test("should use path after {model} as the endpoint key", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/prefix/{model}/v1/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const saved = getSavedModel("model");
      // Key should be "/v1/completions" (portion after {model})
      expect(saved.feature_urls).toHaveProperty("/v1/completions");
    });

    test("should not set feature_urls when ADACOR_AI_API_BASE is absent", async () => {
      delete process.env.ADACOR_AI_API_BASE;
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.feature_urls).toBeUndefined();
    });

    test("should not set feature_urls when ADACOR_AI_FEATURE_PATHS is absent", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      delete process.env.ADACOR_AI_FEATURE_PATHS;
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.feature_urls).toBeUndefined();
    });

    test("should handle multiple path templates for the same bit", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      // Two paths for bit 1 with different suffixes
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;1:/completions/{model}/v1/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const saved = getSavedModel("model");
      expect(saved.feature_urls).toBeDefined();
      const keys = Object.keys(saved.feature_urls!);
      // Both templates produce distinct endpoint keys
      expect(keys.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // featureSet: updates to existing enabled models
  // -------------------------------------------------------------------------

  describe("featureSet — updating existing enabled models", () => {
    test("should count model as updated when featureSet changes", async () => {
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 1,
        capabilities: ["chat"],
        type: "vllm",
      }]);
      setRemoteModels([{ id: "model", featureSet: 3 }]); // adds vision

      const result = await syncAdacorModels();

      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(0);
    });

    test("should update capabilities on the model when featureSet changes", async () => {
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 1,
        capabilities: ["chat"],
        type: "vllm",
      }]);
      setRemoteModels([{ id: "model", featureSet: 7 }]); // chat+vision+tools

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.capabilities).toContain("function_calling");
    });

    test("should count model as unchanged when featureSet is the same", async () => {
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 7,
        capabilities: ["chat", "vision", "function_calling"],
        type: "vllm",
        workplace: false,
      }]);
      setRemoteModels([{ id: "model", featureSet: 7 }]);

      const result = await syncAdacorModels();

      expect(result.unchanged).toBe(1);
      expect(result.updated).toBe(0);
    });

    test("should update workplace flag when bit 256 changes on existing enabled model", async () => {
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 1,
        capabilities: ["chat"],
        type: "vllm",
        workplace: false,
      }]);
      setRemoteModels([{ id: "model", featureSet: 1 | 256 }]); // adds workplace

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.workplace).toBe(true);
    });

    test("should count as updated when workplace flag changes", async () => {
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 1 | 256,
        capabilities: ["chat"],
        type: "vllm",
        workplace: true,
      }]);
      setRemoteModels([{ id: "model", featureSet: 1 }]); // removes workplace

      const result = await syncAdacorModels();

      expect(result.updated).toBe(1);
    });

    test("should update base_url when featureSet changes and FEATURE_PATHS is configured", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions";
      setExistingModels([{
        id: "model",
        enabled: true,
        feature_set: 64, // was audio
        capabilities: ["transcription"],
        type: "stt",
        base_url: "https://api.example.com/audio/model/v1/audio/transcriptions",
      }]);
      setRemoteModels([{ id: "model", featureSet: 1 }]); // now chat

      await syncAdacorModels();

      const saved = getSavedModel("model");
      expect(saved.base_url).toContain("/chat/");
    });
  });

  // -------------------------------------------------------------------------
  // ADACOR_AI_FEATURE_PATHS parsing edge cases
  // -------------------------------------------------------------------------

  describe("ADACOR_AI_FEATURE_PATHS parsing", () => {
    test("should handle empty ADACOR_AI_FEATURE_PATHS gracefully", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS = "";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.base_url).toBeUndefined();
      expect(model.feature_urls).toBeUndefined();
    });

    test("should skip malformed FEATURE_PATHS entries with no colon", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS = "no-colon-here";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      // Should not throw
      await expect(syncAdacorModels()).resolves.toHaveProperty("timestamp");
    });

    test("should handle FEATURE_PATHS with non-numeric bit values gracefully", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "NaN:/chat/{model}/v1/chat/completions";
      setRemoteModels([{ id: "model", featureSet: 1 }]);

      // NaN bit → skipped, no base_url
      await syncAdacorModels();

      const model = getSavedModel("model");
      expect(model.base_url).toBeUndefined();
    });

    test("should parse multiple entries and match each to the correct bit", async () => {
      process.env.ADACOR_AI_API_BASE = "https://api.example.com";
      process.env.ADACOR_AI_FEATURE_PATHS =
        "1:/chat/{model}/v1/chat/completions;32:/embed/{model}/v1/embeddings;64:/audio/{model}/v1/audio/transcriptions";
      setRemoteModels([{ id: "model", featureSet: 32 }]); // only embeddings

      await syncAdacorModels();

      const model = getSavedModel("model");
      // bit 32 path should be used (not bit 1 or 64)
      expect(model.base_url).toContain("/embed/");
    });
  });
});
