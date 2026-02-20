/**
 * Tests for the pure helper functions in backend/src/config/platformModels.ts
 *
 * Only getExtendedCapabilities(), modelMeetsRequirements(), and
 * clearPlatformModelsCache() are tested here — they are synchronous and
 * do not require provider resolution.
 *
 * The ../services/providers module is mocked to prevent loading real
 * YAML config from disk.
 *
 * All mocks MUST be declared BEFORE the module under test is imported.
 */

import { test, expect, describe, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../services/providers", () => ({
  resolveModel: async () => null,
  getProviders: async () => [],
  getChatModels: async () => [],
  getActiveSelection: async () => ({}),
  setActiveModel: async () => {},
  getImageGenModels: async () => [],
  resolveFeatureUrl: () => null,
  loadProvidersConfig: async () => ({ providers: [] }),
  isCustomProvidersAllowed: () => true,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  getExtendedCapabilities,
  modelMeetsRequirements,
  clearPlatformModelsCache,
} = await import("../platformModels");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ResolvedModel suitable for the pure functions under test.
 * Use `overrides.model` / `overrides.provider` to customise individual fields.
 */
function createResolvedModel(overrides?: any): any {
  return {
    provider: {
      id: "test",
      name: "Test Provider",
      enabled: true,
      api_mode: "openai",
      ...overrides?.provider,
    },
    model: {
      id: "test-model",
      name: "Test Model",
      capabilities: ["chat", "function_calling"],
      context_length: 128000,
      max_tokens: 4096,
      ...overrides?.model,
    },
    base_url: "https://api.test.com/v1",
    api_key: null,
    api_mode: "openai",
  };
}

// ---------------------------------------------------------------------------
// getExtendedCapabilities()
// ---------------------------------------------------------------------------

describe("getExtendedCapabilities()", () => {
  test("gibt extended_capabilities direkt zurück, wenn am Modell gesetzt", () => {
    const resolved = createResolvedModel({
      model: {
        id: "explicit-caps",
        name: "Explicit Caps",
        capabilities: [],
        extended_capabilities: {
          tool_use: true,
          vision: true,
          context_window: 32000,
          streaming: false,
          json_mode: true,
          max_output_tokens: 8192,
        },
      },
    });

    const caps = getExtendedCapabilities(resolved);

    expect(caps.tool_use).toBe(true);
    expect(caps.vision).toBe(true);
    expect(caps.context_window).toBe(32000);
    expect(caps.streaming).toBe(false);
    expect(caps.json_mode).toBe(true);
    expect(caps.max_output_tokens).toBe(8192);
  });

  test("leitet tool_use=true aus der 'function_calling'-Capability ab", () => {
    const resolved = createResolvedModel({
      model: {
        capabilities: ["chat", "function_calling"],
        context_length: 8192,
      },
    });

    expect(getExtendedCapabilities(resolved).tool_use).toBe(true);
  });

  test("setzt tool_use=false, wenn 'function_calling' fehlt", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat"], context_length: 8192 },
    });

    expect(getExtendedCapabilities(resolved).tool_use).toBe(false);
  });

  test("erkennt vision-Fähigkeit aus der 'vision'-Capability", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat", "vision"], context_length: 8192 },
    });

    expect(getExtendedCapabilities(resolved).vision).toBe(true);
  });

  test("setzt vision=false, wenn 'vision' in capabilities fehlt", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat"], context_length: 8192 },
    });

    expect(getExtendedCapabilities(resolved).vision).toBe(false);
  });

  test("verwendet context_length des Modells als context_window", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [], context_length: 128000 },
    });

    expect(getExtendedCapabilities(resolved).context_window).toBe(128000);
  });

  test("fällt auf context_window=4096 zurück, wenn context_length nicht gesetzt ist", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [], context_length: undefined },
    });
    // context_length is absent — delete it to be sure
    delete resolved.model.context_length;

    expect(getExtendedCapabilities(resolved).context_window).toBe(4096);
  });

  test("setzt streaming=true als Standard", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [] },
    });

    expect(getExtendedCapabilities(resolved).streaming).toBe(true);
  });

  test("setzt json_mode=false als Standard", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [] },
    });

    expect(getExtendedCapabilities(resolved).json_mode).toBe(false);
  });

  test("übernimmt max_tokens als max_output_tokens", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [], max_tokens: 4096 },
    });

    expect(getExtendedCapabilities(resolved).max_output_tokens).toBe(4096);
  });

  test("max_output_tokens ist undefined, wenn max_tokens nicht gesetzt ist", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [] },
    });
    delete resolved.model.max_tokens;

    expect(getExtendedCapabilities(resolved).max_output_tokens).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// modelMeetsRequirements()
// ---------------------------------------------------------------------------

describe("modelMeetsRequirements()", () => {
  test("leeres Anforderungsobjekt wird immer erfüllt", () => {
    const resolved = createResolvedModel();
    expect(modelMeetsRequirements(resolved, {})).toBe(true);
  });

  test("Modell mit allen Fähigkeiten erfüllt alle Anforderungen gleichzeitig", () => {
    const resolved = createResolvedModel({
      model: {
        capabilities: ["chat", "function_calling", "vision"],
        context_length: 128000,
      },
    });

    expect(
      modelMeetsRequirements(resolved, {
        tool_use: true,
        vision: true,
        min_context_window: 64000,
        streaming: true,
      })
    ).toBe(true);
  });

  test("Modell ohne tool_use schlägt fehl, wenn tool_use gefordert ist", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat"], context_length: 128000 },
    });

    expect(modelMeetsRequirements(resolved, { tool_use: true })).toBe(false);
  });

  test("Modell ohne vision schlägt fehl, wenn vision gefordert ist", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat", "function_calling"], context_length: 128000 },
    });

    expect(modelMeetsRequirements(resolved, { vision: true })).toBe(false);
  });

  test("Modell mit kleinem Kontextfenster schlägt fehl bei min_context_window", () => {
    const resolved = createResolvedModel({
      model: {
        capabilities: ["chat", "function_calling", "vision"],
        context_length: 4096,
      },
    });

    expect(modelMeetsRequirements(resolved, { min_context_window: 32000 })).toBe(false);
  });

  test("Modell erfüllt min_context_window, wenn Kontext exakt gleich ist", () => {
    const resolved = createResolvedModel({
      model: { capabilities: [], context_length: 32000 },
    });

    expect(modelMeetsRequirements(resolved, { min_context_window: 32000 })).toBe(true);
  });

  test("Modell ohne Streaming schlägt fehl, wenn streaming gefordert ist", () => {
    const resolved = createResolvedModel({
      model: {
        capabilities: ["chat"],
        extended_capabilities: {
          tool_use: false,
          vision: false,
          context_window: 8192,
          streaming: false,
          json_mode: false,
        },
      },
    });

    expect(modelMeetsRequirements(resolved, { streaming: true })).toBe(false);
  });

  test("Streaming-Anforderung wird erfüllt, wenn Standardwert (true) greift", () => {
    // Default derived capabilities always set streaming=true
    const resolved = createResolvedModel({
      model: { capabilities: ["chat"] },
    });

    expect(modelMeetsRequirements(resolved, { streaming: true })).toBe(true);
  });

  test("false-Anforderungen werden ignoriert (tool_use:false bedeutet keine Forderung)", () => {
    const resolved = createResolvedModel({
      model: { capabilities: ["chat"] }, // no function_calling → tool_use=false
    });

    // Passing tool_use: false should not disqualify any model
    expect(modelMeetsRequirements(resolved, { tool_use: false })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearPlatformModelsCache()
// ---------------------------------------------------------------------------

describe("clearPlatformModelsCache()", () => {
  test("wirft keine Exception", () => {
    expect(() => clearPlatformModelsCache()).not.toThrow();
  });

  test("kann mehrfach hintereinander aufgerufen werden ohne Fehler", () => {
    expect(() => {
      clearPlatformModelsCache();
      clearPlatformModelsCache();
      clearPlatformModelsCache();
    }).not.toThrow();
  });
});
