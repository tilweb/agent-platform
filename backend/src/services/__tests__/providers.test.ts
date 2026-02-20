/**
 * Tests for the Provider Service (backend/src/services/providers.ts)
 *
 * Bun.file / Bun.write cannot be overridden on the Bun global, so we use a
 * real temporary directory for file I/O.  The PROVIDERS_CONFIG path is
 * redirected to /tmp/test-providers-<pid>.yaml via the paths mock, and
 * userPreferences is mocked to return controllable values.
 *
 * All mocks MUST be declared BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { parse, stringify } from "yaml";
import { join } from "path";

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------

const TEST_CONFIG_PATH = `/tmp/test-providers-${process.pid}.yaml`;

const mockState = {
  // Simulated user model preferences keyed as "userId/purpose"
  userPreferences: {} as Record<
    string,
    { provider_id: string; model_id: string } | null
  >,
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  PROVIDERS_CONFIG: TEST_CONFIG_PATH,
}));

mock.module("../userPreferences", () => ({
  getUserModelPreference: async (userId: string, purpose: string) => {
    const key = `${userId}/${purpose}`;
    return mockState.userPreferences[key] ?? null;
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  isCustomProvidersAllowed,
  loadProvidersConfig,
  saveProvidersConfig,
  clearConfigCache,
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  addModel,
  updateModel,
  deleteModel,
  getActiveSelection,
  setActiveModel,
  resolveActiveModel,
  getSystemDefaultModel,
  resolveModel,
  getModelsForType,
  getChatModels,
  getVisionModels,
  getImageGenModels,
  supportsImageToImage,
  getExtendedCapabilities,
  modelMeetsRequirements,
  filterModelsByRequirements,
  getModelsWithCapability,
  getToolCapableModels,
  getVisionCapableModels,
  getAgentModelRequirements,
  withProviderLock,
} = await import("../providers");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a config object as YAML to the test file and clear the cache. */
async function seedConfig(config: Record<string, unknown>): Promise<void> {
  await Bun.write(TEST_CONFIG_PATH, stringify(config, { indent: 2 }));
  clearConfigCache();
}

/** Delete the test config file so the service falls back to DEFAULT_CONFIG. */
async function removeConfigFile(): Promise<void> {
  try {
    const { unlink } = await import("fs/promises");
    await unlink(TEST_CONFIG_PATH);
  } catch {
    // File may not exist — that is fine
  }
  clearConfigCache();
}

/** Minimal valid ProvidersConfig. */
function makeConfig(
  overrides: Partial<{
    providers: unknown[];
    active: Record<string, unknown>;
  }> = {}
): Record<string, unknown> {
  return {
    providers: overrides.providers ?? [
      {
        id: "test-provider",
        name: "Test Provider",
        api_mode: "openai",
        base_url: "https://api.test.com/v1",
        api_key_env: "TEST_API_KEY",
        enabled: true,
        models: [
          {
            id: "test-model",
            name: "Test Model",
            type: "vllm",
            capabilities: ["chat", "function_calling"],
            context_length: 8192,
            default: true,
          },
        ],
      },
    ],
    active: overrides.active ?? {
      chat: { provider_id: "test-provider", model_id: "test-model" },
      vision: { provider_id: null, model_id: null },
      tts: { provider_id: null, model_id: null },
      stt: { provider_id: null, model_id: null },
      text_to_image: { provider_id: null, model_id: null },
      image_to_image: { provider_id: null, model_id: null },
    },
  };
}

const EMPTY_ACTIVE = {
  chat: { provider_id: null, model_id: null },
  vision: { provider_id: null, model_id: null },
  tts: { provider_id: null, model_id: null },
  stt: { provider_id: null, model_id: null },
  text_to_image: { provider_id: null, model_id: null },
  image_to_image: { provider_id: null, model_id: null },
};

// ---------------------------------------------------------------------------
// isCustomProvidersAllowed()
// ---------------------------------------------------------------------------

describe("isCustomProvidersAllowed()", () => {
  test("should return true when ALLOW_CUSTOM_PROVIDERS is not set", () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    expect(isCustomProvidersAllowed()).toBe(true);
  });

  test("should return true when ALLOW_CUSTOM_PROVIDERS is empty string", () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "";
    expect(isCustomProvidersAllowed()).toBe(true);
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
  });

  test("should return false when ALLOW_CUSTOM_PROVIDERS is 'false'", () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "false";
    expect(isCustomProvidersAllowed()).toBe(false);
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
  });

  test("should return false when ALLOW_CUSTOM_PROVIDERS is 'FALSE' (case-insensitive)", () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "FALSE";
    expect(isCustomProvidersAllowed()).toBe(false);
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
  });

  test("should return true when ALLOW_CUSTOM_PROVIDERS is 'true'", () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "true";
    expect(isCustomProvidersAllowed()).toBe(true);
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
  });

  test("should return true when ALLOW_CUSTOM_PROVIDERS is '1'", () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "1";
    expect(isCustomProvidersAllowed()).toBe(true);
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
  });
});

// ---------------------------------------------------------------------------
// loadProvidersConfig()
// ---------------------------------------------------------------------------

describe("loadProvidersConfig()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  test("should parse and return a valid YAML config from disk", async () => {
    await seedConfig(makeConfig());
    const config = await loadProvidersConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]!.id).toBe("test-provider");
  });

  test("should return DEFAULT_CONFIG and save it when the file does not exist", async () => {
    // File does not exist — default config expected
    const config = await loadProvidersConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]!.id).toBe("adacor");
    // Should have persisted the default
    const written = await Bun.file(TEST_CONFIG_PATH).text();
    expect(written).toContain("adacor");
  });

  test("should return the cached config on a second call without re-reading disk", async () => {
    await seedConfig(makeConfig());
    const first = await loadProvidersConfig();
    // Overwrite disk with different content — cache should mask this
    await Bun.write(
      TEST_CONFIG_PATH,
      stringify(makeConfig({ providers: [] }), { indent: 2 })
    );
    const second = await loadProvidersConfig();
    expect(second.providers).toHaveLength(first.providers.length);
  });
});

// ---------------------------------------------------------------------------
// saveProvidersConfig()
// ---------------------------------------------------------------------------

describe("saveProvidersConfig()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  test("should write YAML content to the config path", async () => {
    await saveProvidersConfig(makeConfig() as any);
    const written = await Bun.file(TEST_CONFIG_PATH).text();
    const parsed = parse(written);
    expect(parsed.providers[0].id).toBe("test-provider");
  });

  test("should update the in-memory cache after saving", async () => {
    await saveProvidersConfig(makeConfig() as any);
    // Cache is now primed — corrupt the file; load should still work from cache
    await Bun.write(TEST_CONFIG_PATH, "bad: yaml: [[[");
    const config = await loadProvidersConfig();
    expect(config.providers[0]!.id).toBe("test-provider");
  });
});

// ---------------------------------------------------------------------------
// clearConfigCache()
// ---------------------------------------------------------------------------

describe("clearConfigCache()", () => {
  test("should force a fresh read from disk on the next loadProvidersConfig() call", async () => {
    await seedConfig(makeConfig());
    await loadProvidersConfig(); // Populate cache

    // Swap disk content
    const newConfig = makeConfig({
      providers: [
        {
          id: "new-provider",
          name: "New Provider",
          api_mode: "openai",
          base_url: "https://new.example.com",
          api_key_env: null,
          enabled: true,
          models: [],
        },
      ],
    });
    await Bun.write(TEST_CONFIG_PATH, stringify(newConfig, { indent: 2 }));

    clearConfigCache();
    const config = await loadProvidersConfig();
    expect(config.providers[0]!.id).toBe("new-provider");
  });
});

// ---------------------------------------------------------------------------
// getProviders()
// ---------------------------------------------------------------------------

describe("getProviders()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should return all providers from the config", async () => {
    const providers = await getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]!.id).toBe("test-provider");
  });

  test("should return an empty array when providers list is empty", async () => {
    await seedConfig(makeConfig({ providers: [] }));
    const providers = await getProviders();
    expect(providers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getProvider()
// ---------------------------------------------------------------------------

describe("getProvider()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should return the matching provider by ID", async () => {
    const provider = await getProvider("test-provider");
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe("Test Provider");
  });

  test("should return null for an unknown provider ID", async () => {
    const provider = await getProvider("does-not-exist");
    expect(provider).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createProvider()
// ---------------------------------------------------------------------------

describe("createProvider()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig({ providers: [] }));
  });

  test("should add a new provider and persist the config", async () => {
    const newProvider = await createProvider({
      name: "My New Provider",
      api_mode: "openai",
      base_url: "https://new.provider.com/v1",
    });

    expect(newProvider.id).toBe("my-new-provider");
    expect(newProvider.name).toBe("My New Provider");
    expect(newProvider.enabled).toBe(false); // default

    clearConfigCache();
    const providers = await getProviders();
    expect(providers.some((p) => p.id === "my-new-provider")).toBe(true);
  });

  test("should set enabled=true when explicitly requested", async () => {
    const provider = await createProvider({
      name: "Enabled Provider",
      api_mode: "openai",
      base_url: "https://example.com/v1",
      enabled: true,
    });
    expect(provider.enabled).toBe(true);
  });

  test("should store the provided api_key_env", async () => {
    const provider = await createProvider({
      name: "Keyed Provider",
      api_mode: "openai",
      base_url: "https://example.com/v1",
      api_key_env: "MY_SECRET_KEY",
    });
    expect(provider.api_key_env).toBe("MY_SECRET_KEY");
  });

  test("should default api_key_env to null when not provided", async () => {
    const provider = await createProvider({
      name: "No Key Provider",
      api_mode: "openai",
      base_url: "https://example.com/v1",
    });
    expect(provider.api_key_env).toBeNull();
  });

  test("should include pre-supplied models", async () => {
    const provider = await createProvider({
      name: "Provider With Models",
      api_mode: "openai",
      base_url: "https://example.com/v1",
      models: [{ id: "model-a", name: "Model A", type: "llm", capabilities: ["chat"] }],
    });
    expect(provider.models).toHaveLength(1);
    expect(provider.models[0]!.id).toBe("model-a");
  });

  test("should throw when a provider with the same derived ID already exists", async () => {
    await createProvider({
      name: "Duplicate Provider",
      api_mode: "openai",
      base_url: "https://a.com/v1",
    });

    await expect(
      createProvider({
        name: "Duplicate Provider",
        api_mode: "openai",
        base_url: "https://b.com/v1",
      })
    ).rejects.toThrow("already exists");
  });

  test("should generate a slug ID replacing special characters with hyphens", async () => {
    const provider = await createProvider({
      name: "OpenAI / GPT Provider (v2)!",
      api_mode: "openai",
      base_url: "https://api.openai.com/v1",
    });
    expect(provider.id).toBe("openai-gpt-provider-v2");
  });

  test("should truncate the generated ID to 32 characters", async () => {
    const provider = await createProvider({
      name: "A Very Long Provider Name That Exceeds The Limit By Far In Practice",
      api_mode: "openai",
      base_url: "https://example.com/v1",
    });
    expect(provider.id.length).toBeLessThanOrEqual(32);
  });
});

// ---------------------------------------------------------------------------
// updateProvider()
// ---------------------------------------------------------------------------

describe("updateProvider()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should update the provider name", async () => {
    const updated = await updateProvider("test-provider", { name: "Renamed Provider" });
    expect(updated.name).toBe("Renamed Provider");
  });

  test("should keep the original ID unchanged when name changes", async () => {
    const updated = await updateProvider("test-provider", { name: "Different Name" });
    expect(updated.id).toBe("test-provider");
  });

  test("should preserve existing fields when only partial updates are given", async () => {
    const updated = await updateProvider("test-provider", { enabled: false });
    expect(updated.name).toBe("Test Provider");
    expect(updated.base_url).toBe("https://api.test.com/v1");
  });

  test("should persist the updated provider to disk", async () => {
    await updateProvider("test-provider", { base_url: "https://updated.com/v1" });
    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.base_url).toBe("https://updated.com/v1");
  });

  test("should set api_key_env to null when explicitly provided as null", async () => {
    const updated = await updateProvider("test-provider", { api_key_env: null });
    expect(updated.api_key_env).toBeNull();
  });

  test("should retain existing models (models are managed separately)", async () => {
    const updated = await updateProvider("test-provider", { name: "New Name" });
    expect(updated.models).toHaveLength(1);
    expect(updated.models[0]!.id).toBe("test-model");
  });

  test("should throw when the provider ID does not exist", async () => {
    await expect(
      updateProvider("no-such-provider", { name: "X" })
    ).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// deleteProvider()
// ---------------------------------------------------------------------------

describe("deleteProvider()", () => {
  beforeEach(async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "removable",
            name: "Removable Provider",
            api_mode: "openai",
            base_url: "https://removable.com/v1",
            api_key_env: null,
            enabled: true,
            models: [],
          },
          {
            id: "protected-sys",
            name: "System Provider",
            api_mode: "openai",
            base_url: "https://sys.com/v1",
            api_key_env: null,
            enabled: true,
            protected: true,
            models: [],
          },
        ],
        active: {
          chat: { provider_id: "removable", model_id: null },
          vision: { provider_id: null, model_id: null },
          tts: { provider_id: null, model_id: null },
          stt: { provider_id: null, model_id: null },
          text_to_image: { provider_id: null, model_id: null },
          image_to_image: { provider_id: null, model_id: null },
        },
      })
    );
  });

  test("should remove the provider from the config", async () => {
    await deleteProvider("removable");
    clearConfigCache();
    expect(await getProvider("removable")).toBeNull();
  });

  test("should persist the deletion to disk", async () => {
    await deleteProvider("removable");
    clearConfigCache();
    const providers = await getProviders();
    expect(providers.some((p) => p.id === "removable")).toBe(false);
  });

  test("should clear active selections that referenced the deleted provider", async () => {
    await deleteProvider("removable");
    clearConfigCache();
    const active = await getActiveSelection();
    expect(active.chat.provider_id).toBeNull();
    expect(active.chat.model_id).toBeNull();
  });

  test("should throw when the provider does not exist", async () => {
    await expect(deleteProvider("no-such-provider")).rejects.toThrow("not found");
  });

  test("should throw when attempting to delete a protected provider", async () => {
    await expect(deleteProvider("protected-sys")).rejects.toThrow("Systemanbieter");
  });
});

// ---------------------------------------------------------------------------
// addModel()
// ---------------------------------------------------------------------------

describe("addModel()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should add a new model and persist", async () => {
    const model = await addModel("test-provider", {
      id: "new-model",
      name: "New Model",
      type: "llm",
      capabilities: ["chat"],
    });

    expect(model.id).toBe("new-model");

    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.models.some((m) => m.id === "new-model")).toBe(true);
  });

  test("should persist the new model so subsequent reads see it", async () => {
    await addModel("test-provider", {
      id: "persisted-model",
      name: "Persisted Model",
      type: "llm",
      capabilities: ["chat"],
    });
    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.models).toHaveLength(2);
  });

  test("should throw when the provider does not exist", async () => {
    await expect(
      addModel("no-such-provider", {
        id: "x",
        name: "X",
        type: "llm",
        capabilities: [],
      })
    ).rejects.toThrow("not found");
  });

  test("should throw when a model with the same ID already exists", async () => {
    await expect(
      addModel("test-provider", {
        id: "test-model", // duplicate
        name: "Dupe",
        type: "llm",
        capabilities: [],
      })
    ).rejects.toThrow("already exists");
  });
});

// ---------------------------------------------------------------------------
// updateModel()
// ---------------------------------------------------------------------------

describe("updateModel()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should update the model name", async () => {
    const updated = await updateModel("test-provider", "test-model", {
      name: "Updated Model Name",
    });
    expect(updated.name).toBe("Updated Model Name");
  });

  test("should keep the original model ID unchanged", async () => {
    const updated = await updateModel("test-provider", "test-model", {
      name: "New Name",
    });
    expect(updated.id).toBe("test-model");
  });

  test("should persist the update to disk", async () => {
    await updateModel("test-provider", "test-model", { context_length: 32000 });
    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.models[0]!.context_length).toBe(32000);
  });

  test("should clear default flag on sibling models when setting a new default", async () => {
    await addModel("test-provider", {
      id: "second-model",
      name: "Second Model",
      type: "llm",
      capabilities: ["chat"],
      default: true,
    });

    // Explicitly set test-model as default
    await updateModel("test-provider", "test-model", { default: true });

    clearConfigCache();
    const provider = await getProvider("test-provider");
    const secondModel = provider!.models.find((m) => m.id === "second-model");
    expect(secondModel!.default).toBe(false);
  });

  test("should throw when the provider does not exist", async () => {
    await expect(
      updateModel("no-such-provider", "test-model", { name: "X" })
    ).rejects.toThrow("not found");
  });

  test("should throw when the model does not exist in the provider", async () => {
    await expect(
      updateModel("test-provider", "no-such-model", { name: "X" })
    ).rejects.toThrow("not found");
  });

  test("should throw when trying to manually re-enable a sync-deactivated model", async () => {
    await addModel("test-provider", {
      id: "disabled-model",
      name: "Disabled Model",
      type: "llm",
      capabilities: ["chat"],
      enabled: false,
    });

    await expect(
      updateModel("test-provider", "disabled-model", { enabled: true })
    ).rejects.toThrow("Deaktivierte Modelle");
  });

  test("should preserve the enabled field from the existing model after an unrelated update", async () => {
    await addModel("test-provider", {
      id: "enabled-model",
      name: "Enabled Model",
      type: "llm",
      capabilities: ["chat"],
      enabled: true,
    });

    const updated = await updateModel("test-provider", "enabled-model", {
      name: "Renamed",
    });
    expect(updated.enabled).toBe(true);
  });

  test("should preserve the protected flag from the existing model", async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "sys-provider",
            name: "Sys Provider",
            api_mode: "openai",
            base_url: "https://sys.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              {
                id: "sys-model",
                name: "Sys Model",
                type: "vllm",
                capabilities: ["chat"],
                protected: true,
              },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );

    const updated = await updateModel("sys-provider", "sys-model", {
      name: "Sys Model Renamed",
    });
    expect(updated.protected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteModel()
// ---------------------------------------------------------------------------

describe("deleteModel()", () => {
  beforeEach(async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "test-provider",
            name: "Test Provider",
            api_mode: "openai",
            base_url: "https://api.test.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              {
                id: "removable-model",
                name: "Removable Model",
                type: "vllm",
                capabilities: ["chat"],
              },
              {
                id: "protected-model",
                name: "Protected Model",
                type: "vllm",
                capabilities: ["chat"],
                protected: true,
              },
            ],
          },
        ],
        active: {
          chat: { provider_id: "test-provider", model_id: "removable-model" },
          vision: { provider_id: null, model_id: null },
          tts: { provider_id: null, model_id: null },
          stt: { provider_id: null, model_id: null },
          text_to_image: { provider_id: null, model_id: null },
          image_to_image: { provider_id: null, model_id: null },
        },
      })
    );
  });

  test("should remove the model from its provider", async () => {
    await deleteModel("test-provider", "removable-model");
    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.models.some((m) => m.id === "removable-model")).toBe(false);
  });

  test("should leave other models intact", async () => {
    await deleteModel("test-provider", "removable-model");
    clearConfigCache();
    const provider = await getProvider("test-provider");
    expect(provider!.models).toHaveLength(1);
    expect(provider!.models[0]!.id).toBe("protected-model");
  });

  test("should clear active selections that referenced the deleted model", async () => {
    await deleteModel("test-provider", "removable-model");
    clearConfigCache();
    const active = await getActiveSelection();
    expect(active.chat.provider_id).toBeNull();
    expect(active.chat.model_id).toBeNull();
  });

  test("should throw when the provider does not exist", async () => {
    await expect(
      deleteModel("no-such-provider", "removable-model")
    ).rejects.toThrow("not found");
  });

  test("should throw when the model does not exist", async () => {
    await expect(
      deleteModel("test-provider", "no-such-model")
    ).rejects.toThrow("not found");
  });

  test("should throw when attempting to delete a protected model", async () => {
    await expect(
      deleteModel("test-provider", "protected-model")
    ).rejects.toThrow("Systemmodell");
  });
});

// ---------------------------------------------------------------------------
// getActiveSelection()
// ---------------------------------------------------------------------------

describe("getActiveSelection()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should return the active selection from the config", async () => {
    const active = await getActiveSelection();
    expect(active.chat.provider_id).toBe("test-provider");
    expect(active.chat.model_id).toBe("test-model");
  });

  test("should return null provider_id for unconfigured purposes", async () => {
    const active = await getActiveSelection();
    expect(active.vision.provider_id).toBeNull();
    expect(active.tts.provider_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setActiveModel()
// ---------------------------------------------------------------------------

describe("setActiveModel()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should update and persist the active model for the given purpose", async () => {
    await setActiveModel("chat", "test-provider", "test-model");
    clearConfigCache();
    const active = await getActiveSelection();
    expect(active.chat.provider_id).toBe("test-provider");
    expect(active.chat.model_id).toBe("test-model");
  });

  test("should allow clearing the active model by passing null values", async () => {
    await setActiveModel("chat", null, null);
    clearConfigCache();
    const active = await getActiveSelection();
    expect(active.chat.provider_id).toBeNull();
    expect(active.chat.model_id).toBeNull();
  });

  test("should persist changes to disk", async () => {
    await setActiveModel("vision", "test-provider", "test-model");
    clearConfigCache();
    const active = await getActiveSelection();
    expect(active.vision.provider_id).toBe("test-provider");
  });

  test("should throw when the provider does not exist", async () => {
    await expect(
      setActiveModel("chat", "no-such-provider", "test-model")
    ).rejects.toThrow("not found");
  });

  test("should throw when the provider is disabled", async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "disabled-provider",
            name: "Disabled Provider",
            api_mode: "openai",
            base_url: "https://disabled.com/v1",
            api_key_env: null,
            enabled: false,
            models: [
              { id: "some-model", name: "Some Model", type: "llm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );

    await expect(
      setActiveModel("chat", "disabled-provider", "some-model")
    ).rejects.toThrow("disabled");
  });

  test("should throw when the model does not exist within the provider", async () => {
    await expect(
      setActiveModel("chat", "test-provider", "no-such-model")
    ).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// resolveModel()
// ---------------------------------------------------------------------------

describe("resolveModel()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should resolve a valid provider/model combination", async () => {
    const result = await resolveModel("test-provider", "test-model");
    expect(result).not.toBeNull();
    expect(result!.provider.id).toBe("test-provider");
    expect(result!.model.id).toBe("test-model");
    expect(result!.api_mode).toBe("openai");
  });

  test("should use provider base_url when the model has no URL override", async () => {
    const result = await resolveModel("test-provider", "test-model");
    expect(result!.base_url).toBe("https://api.test.com/v1");
  });

  test("should use model-level base_url override when set", async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "multi-url-provider",
            name: "Multi URL Provider",
            api_mode: "openai",
            base_url: "https://provider.default.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              {
                id: "model-with-override",
                name: "Override Model",
                type: "llm",
                capabilities: ["chat"],
                base_url: "https://model.specific.com/v1",
              },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );

    const result = await resolveModel("multi-url-provider", "model-with-override");
    expect(result!.base_url).toBe("https://model.specific.com/v1");
  });

  test("should populate api_key from the named environment variable", async () => {
    process.env.TEST_API_KEY = "secret-key-abc";
    try {
      const result = await resolveModel("test-provider", "test-model");
      expect(result!.api_key).toBe("secret-key-abc");
    } finally {
      delete process.env.TEST_API_KEY;
    }
  });

  test("should return null api_key when the env var is not set", async () => {
    delete process.env.TEST_API_KEY;
    const result = await resolveModel("test-provider", "test-model");
    expect(result!.api_key).toBeNull();
  });

  test("should return null for an unknown provider", async () => {
    const result = await resolveModel("no-such-provider", "test-model");
    expect(result).toBeNull();
  });

  test("should return null for an unknown model within a known provider", async () => {
    const result = await resolveModel("test-provider", "no-such-model");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveActiveModel()
// ---------------------------------------------------------------------------

describe("resolveActiveModel()", () => {
  beforeEach(async () => {
    mockState.userPreferences = {};
    await seedConfig(makeConfig());
  });

  test("should return the system default when no userId is provided", async () => {
    const result = await resolveActiveModel("chat");
    expect(result).not.toBeNull();
    expect(result!.model.id).toBe("test-model");
  });

  test("should return null when the active selection has no provider/model set", async () => {
    const result = await resolveActiveModel("tts");
    expect(result).toBeNull();
  });

  test("should use the user preference when it resolves to a valid enabled provider", async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "test-provider",
            name: "Test Provider",
            api_mode: "openai",
            base_url: "https://api.test.com/v1",
            api_key_env: null,
            enabled: true,
            models: [{ id: "test-model", name: "Test Model", type: "vllm", capabilities: ["chat"] }],
          },
          {
            id: "user-pref-provider",
            name: "User Pref Provider",
            api_mode: "openai",
            base_url: "https://userpref.com/v1",
            api_key_env: null,
            enabled: true,
            models: [{ id: "user-pref-model", name: "User Pref Model", type: "llm", capabilities: ["chat"] }],
          },
        ],
        active: {
          chat: { provider_id: "test-provider", model_id: "test-model" },
          ...Object.fromEntries(
            ["vision", "tts", "stt", "text_to_image", "image_to_image"].map((k) => [
              k,
              { provider_id: null, model_id: null },
            ])
          ),
        },
      })
    );

    mockState.userPreferences["alice/chat"] = {
      provider_id: "user-pref-provider",
      model_id: "user-pref-model",
    };

    const result = await resolveActiveModel("chat", "alice");
    expect(result!.provider.id).toBe("user-pref-provider");
    expect(result!.model.id).toBe("user-pref-model");
  });

  test("should fall back to system default when user preference points to a disabled provider", async () => {
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "test-provider",
            name: "Test Provider",
            api_mode: "openai",
            base_url: "https://api.test.com/v1",
            api_key_env: null,
            enabled: true,
            models: [{ id: "test-model", name: "Test Model", type: "vllm", capabilities: ["chat"] }],
          },
          {
            id: "disabled-pref-provider",
            name: "Disabled Pref Provider",
            api_mode: "openai",
            base_url: "https://disabled.com/v1",
            api_key_env: null,
            enabled: false,
            models: [{ id: "disabled-model", name: "Disabled Model", type: "llm", capabilities: ["chat"] }],
          },
        ],
        active: {
          chat: { provider_id: "test-provider", model_id: "test-model" },
          vision: { provider_id: null, model_id: null },
          tts: { provider_id: null, model_id: null },
          stt: { provider_id: null, model_id: null },
          text_to_image: { provider_id: null, model_id: null },
          image_to_image: { provider_id: null, model_id: null },
        },
      })
    );

    mockState.userPreferences["bob/chat"] = {
      provider_id: "disabled-pref-provider",
      model_id: "disabled-model",
    };

    const result = await resolveActiveModel("chat", "bob");
    expect(result!.provider.id).toBe("test-provider");
    expect(result!.model.id).toBe("test-model");
  });

  test("should use system default when user has no preference set", async () => {
    const result = await resolveActiveModel("chat", "user-with-no-prefs");
    expect(result!.model.id).toBe("test-model");
  });
});

// ---------------------------------------------------------------------------
// getSystemDefaultModel()
// ---------------------------------------------------------------------------

describe("getSystemDefaultModel()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should return the system default for a configured purpose", async () => {
    const result = await getSystemDefaultModel("chat");
    expect(result).not.toBeNull();
    expect(result!.model.id).toBe("test-model");
  });

  test("should return null for an unconfigured purpose", async () => {
    const result = await getSystemDefaultModel("tts");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getModelsForType()
// ---------------------------------------------------------------------------

describe("getModelsForType()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "enabled-provider",
            name: "Enabled Provider",
            api_mode: "openai",
            base_url: "https://enabled.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "vllm-model", name: "VLLM", type: "vllm", capabilities: ["chat"] },
              { id: "llm-model", name: "LLM", type: "llm", capabilities: ["chat"] },
              { id: "tts-model", name: "TTS", type: "tts", capabilities: ["speech"] },
              {
                id: "disabled-vllm",
                name: "Disabled VLLM",
                type: "vllm",
                capabilities: ["chat"],
                enabled: false,
              },
            ],
          },
          {
            id: "disabled-provider",
            name: "Disabled Provider",
            api_mode: "openai",
            base_url: "https://disabled.com/v1",
            api_key_env: null,
            enabled: false,
            models: [
              { id: "unreachable", name: "Unreachable", type: "vllm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return vllm models when type is 'vllm'", async () => {
    const results = await getModelsForType("vllm");
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("vllm-model");
    expect(ids).not.toContain("llm-model");
    expect(ids).not.toContain("tts-model");
  });

  test("should include vllm models when type is 'llm' (alias)", async () => {
    const results = await getModelsForType("llm");
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("vllm-model");
    expect(ids).toContain("llm-model");
  });

  test("should return tts models when type is 'tts'", async () => {
    const results = await getModelsForType("tts");
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("tts-model");
  });

  test("should exclude models with enabled=false", async () => {
    const results = await getModelsForType("vllm");
    const ids = results.map((r) => r.model.id);
    expect(ids).not.toContain("disabled-vllm");
  });

  test("should exclude models from disabled providers", async () => {
    const results = await getModelsForType("vllm");
    const ids = results.map((r) => r.model.id);
    expect(ids).not.toContain("unreachable");
  });

  test("should exclude non-protected providers when ALLOW_CUSTOM_PROVIDERS is false", async () => {
    process.env.ALLOW_CUSTOM_PROVIDERS = "false";
    try {
      const results = await getModelsForType("vllm");
      expect(results).toHaveLength(0);
    } finally {
      delete process.env.ALLOW_CUSTOM_PROVIDERS;
    }
  });
});

// ---------------------------------------------------------------------------
// getChatModels()
// ---------------------------------------------------------------------------

describe("getChatModels()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "chat-provider",
            name: "Chat Provider",
            api_mode: "openai",
            base_url: "https://chat.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "chat-llm", name: "Chat LLM", type: "llm", capabilities: ["chat", "function_calling"] },
              { id: "no-chat-cap", name: "No Chat Cap", type: "llm", capabilities: ["function_calling"] },
              { id: "image-model", name: "Image Model", type: "image_gen", capabilities: ["text_to_image"] },
              { id: "chat-vllm", name: "Chat VLLM", type: "vllm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return llm and vllm models that have 'chat' capability", async () => {
    const results = await getChatModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("chat-llm");
    expect(ids).toContain("chat-vllm");
  });

  test("should exclude llm models without chat capability", async () => {
    const results = await getChatModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).not.toContain("no-chat-cap");
  });

  test("should exclude image_gen models", async () => {
    const results = await getChatModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).not.toContain("image-model");
  });
});

// ---------------------------------------------------------------------------
// getVisionModels()
// ---------------------------------------------------------------------------

describe("getVisionModels()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "vision-provider",
            name: "Vision Provider",
            api_mode: "openai",
            base_url: "https://vision.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "vision-model", name: "Vision Model", type: "llm", capabilities: ["chat", "vision"] },
              { id: "text-only", name: "Text Only", type: "llm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return only models with 'vision' capability", async () => {
    const results = await getVisionModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("vision-model");
    expect(ids).not.toContain("text-only");
  });
});

// ---------------------------------------------------------------------------
// getImageGenModels()
// ---------------------------------------------------------------------------

describe("getImageGenModels()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "img-provider",
            name: "Image Provider",
            api_mode: "openai_images",
            base_url: "https://images.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "dalle-3", name: "DALL-E 3", type: "image_gen", capabilities: ["text_to_image"] },
              { id: "chat-model", name: "Chat Model", type: "llm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return only models with type image_gen", async () => {
    const results = await getImageGenModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("dalle-3");
    expect(ids).not.toContain("chat-model");
  });
});

// ---------------------------------------------------------------------------
// supportsImageToImage()
// ---------------------------------------------------------------------------

describe("supportsImageToImage()", () => {
  test("should return true when model has image_to_image capability", () => {
    const model: any = {
      id: "img2img",
      name: "Img2Img",
      type: "image_gen",
      capabilities: ["text_to_image", "image_to_image"],
    };
    expect(supportsImageToImage(model)).toBe(true);
  });

  test("should return false when model lacks image_to_image capability", () => {
    const model: any = {
      id: "text2img",
      name: "Text2Img",
      type: "image_gen",
      capabilities: ["text_to_image"],
    };
    expect(supportsImageToImage(model)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getExtendedCapabilities()
// ---------------------------------------------------------------------------

describe("getExtendedCapabilities()", () => {
  test("should return extended_capabilities directly when set on the model", () => {
    const model: any = {
      id: "m",
      name: "M",
      type: "llm",
      capabilities: [],
      extended_capabilities: {
        tool_use: true,
        vision: false,
        context_window: 16000,
        streaming: true,
        json_mode: true,
      },
    };
    const caps = getExtendedCapabilities(model);
    expect(caps.tool_use).toBe(true);
    expect(caps.json_mode).toBe(true);
    expect(caps.context_window).toBe(16000);
  });

  test("should derive tool_use=true from 'function_calling' capability", () => {
    const model: any = {
      id: "m",
      name: "M",
      type: "llm",
      capabilities: ["chat", "function_calling"],
    };
    expect(getExtendedCapabilities(model).tool_use).toBe(true);
  });

  test("should set tool_use=false when function_calling is absent", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: ["chat"] };
    expect(getExtendedCapabilities(model).tool_use).toBe(false);
  });

  test("should derive vision=true from 'vision' capability", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: ["chat", "vision"] };
    expect(getExtendedCapabilities(model).vision).toBe(true);
  });

  test("should fall back to context_window of 4096 when context_length is unset", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: [] };
    expect(getExtendedCapabilities(model).context_window).toBe(4096);
  });

  test("should use the model's context_length as context_window when set", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: [], context_length: 128000 };
    expect(getExtendedCapabilities(model).context_window).toBe(128000);
  });

  test("should default streaming to true", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: [] };
    expect(getExtendedCapabilities(model).streaming).toBe(true);
  });

  test("should default json_mode to false", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: [] };
    expect(getExtendedCapabilities(model).json_mode).toBe(false);
  });

  test("should carry max_tokens as max_output_tokens when set on the model", () => {
    const model: any = { id: "m", name: "M", type: "llm", capabilities: [], max_tokens: 4096 };
    expect(getExtendedCapabilities(model).max_output_tokens).toBe(4096);
  });
});

// ---------------------------------------------------------------------------
// modelMeetsRequirements()
// ---------------------------------------------------------------------------

describe("modelMeetsRequirements()", () => {
  const baseModel: any = {
    id: "m",
    name: "M",
    type: "llm",
    capabilities: ["chat", "function_calling", "vision"],
    context_length: 32000,
  };

  test("should return true when requirements object is empty", () => {
    expect(modelMeetsRequirements(baseModel, {})).toBe(true);
  });

  test("should return true when model has tool_use and it is required", () => {
    expect(modelMeetsRequirements(baseModel, { tool_use: true })).toBe(true);
  });

  test("should return false when model lacks tool_use but it is required", () => {
    const noTools: any = { ...baseModel, capabilities: ["chat"] };
    expect(modelMeetsRequirements(noTools, { tool_use: true })).toBe(false);
  });

  test("should return true when model has vision and it is required", () => {
    expect(modelMeetsRequirements(baseModel, { vision: true })).toBe(true);
  });

  test("should return false when model lacks vision but it is required", () => {
    const noVision: any = { ...baseModel, capabilities: ["chat"] };
    expect(modelMeetsRequirements(noVision, { vision: true })).toBe(false);
  });

  test("should return true when context_window meets the minimum", () => {
    expect(modelMeetsRequirements(baseModel, { min_context_window: 16000 })).toBe(true);
  });

  test("should return false when context_window is below the minimum", () => {
    expect(modelMeetsRequirements(baseModel, { min_context_window: 64000 })).toBe(false);
  });

  test("should return false when streaming is required but model says streaming=false", () => {
    const noStream: any = {
      ...baseModel,
      extended_capabilities: {
        tool_use: true,
        vision: true,
        context_window: 32000,
        streaming: false,
        json_mode: false,
      },
    };
    expect(modelMeetsRequirements(noStream, { streaming: true })).toBe(false);
  });

  test("should return false when json_mode is required but model does not support it", () => {
    expect(modelMeetsRequirements(baseModel, { json_mode: true })).toBe(false);
  });

  test("should return false when multiple requirements exist and one fails", () => {
    // vision passes, json_mode fails
    expect(
      modelMeetsRequirements(baseModel, { vision: true, json_mode: true })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterModelsByRequirements()
// ---------------------------------------------------------------------------

describe("filterModelsByRequirements()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "capable-provider",
            name: "Capable Provider",
            api_mode: "openai",
            base_url: "https://capable.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              {
                id: "full-model",
                name: "Full Model",
                type: "vllm",
                capabilities: ["chat", "function_calling", "vision"],
                context_length: 64000,
              },
              {
                id: "chat-only",
                name: "Chat Only",
                type: "llm",
                capabilities: ["chat"],
                context_length: 4096,
              },
              {
                id: "img-model",
                name: "Image Model",
                type: "image_gen",
                capabilities: ["text_to_image"],
              },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return all chat-capable (llm/vllm) models when no requirements given", async () => {
    const results = await filterModelsByRequirements({});
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("full-model");
    expect(ids).toContain("chat-only");
    expect(ids).not.toContain("img-model");
  });

  test("should filter to models meeting tool_use requirement", async () => {
    const results = await filterModelsByRequirements({ tool_use: true });
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("full-model");
    expect(ids).not.toContain("chat-only");
  });

  test("should filter to models meeting vision requirement", async () => {
    const results = await filterModelsByRequirements({ vision: true });
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("full-model");
    expect(ids).not.toContain("chat-only");
  });

  test("should filter by minimum context window", async () => {
    const results = await filterModelsByRequirements({ min_context_window: 32000 });
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("full-model");
    expect(ids).not.toContain("chat-only");
  });
});

// ---------------------------------------------------------------------------
// getModelsWithCapability()
// ---------------------------------------------------------------------------

describe("getModelsWithCapability()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "mixed-provider",
            name: "Mixed Provider",
            api_mode: "openai",
            base_url: "https://mixed.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              {
                id: "tool-model",
                name: "Tool Model",
                type: "llm",
                capabilities: ["chat", "function_calling"],
                context_length: 8192,
              },
              {
                id: "plain-model",
                name: "Plain Model",
                type: "vllm",
                capabilities: ["chat"],
                context_length: 4096,
              },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return models where boolean capability matches the requested value", async () => {
    const results = await getModelsWithCapability("tool_use", true);
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("tool-model");
    expect(ids).not.toContain("plain-model");
  });

  test("should include all llm/vllm models when no value filter is provided", async () => {
    const results = await getModelsWithCapability("tool_use");
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  test("should return models with context_window >= a numeric threshold", async () => {
    const results = await getModelsWithCapability("context_window", 8192);
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("tool-model");
    expect(ids).not.toContain("plain-model");
  });
});

// ---------------------------------------------------------------------------
// getToolCapableModels()
// ---------------------------------------------------------------------------

describe("getToolCapableModels()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "provider",
            name: "Provider",
            api_mode: "openai",
            base_url: "https://p.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "with-tools", name: "With Tools", type: "llm", capabilities: ["chat", "function_calling"] },
              { id: "no-tools", name: "No Tools", type: "llm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return only models with tool_use capability", async () => {
    const results = await getToolCapableModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("with-tools");
    expect(ids).not.toContain("no-tools");
  });
});

// ---------------------------------------------------------------------------
// getVisionCapableModels()
// ---------------------------------------------------------------------------

describe("getVisionCapableModels()", () => {
  beforeEach(async () => {
    delete process.env.ALLOW_CUSTOM_PROVIDERS;
    await seedConfig(
      makeConfig({
        providers: [
          {
            id: "provider",
            name: "Provider",
            api_mode: "openai",
            base_url: "https://p.com/v1",
            api_key_env: null,
            enabled: true,
            models: [
              { id: "with-vision", name: "With Vision", type: "llm", capabilities: ["chat", "vision"] },
              { id: "no-vision", name: "No Vision", type: "llm", capabilities: ["chat"] },
            ],
          },
        ],
        active: EMPTY_ACTIVE,
      })
    );
  });

  test("should return only models with vision capability", async () => {
    const results = await getVisionCapableModels();
    const ids = results.map((r) => r.model.id);
    expect(ids).toContain("with-vision");
    expect(ids).not.toContain("no-vision");
  });
});

// ---------------------------------------------------------------------------
// getAgentModelRequirements()
// ---------------------------------------------------------------------------

describe("getAgentModelRequirements()", () => {
  test("should return empty requirements for an agent with no tools and no capabilities", () => {
    const req = getAgentModelRequirements({ id: "my-agent" });
    expect(req).toEqual({});
  });

  test("should require tool_use when the agent has tools", () => {
    const req = getAgentModelRequirements({
      id: "my-agent",
      tools: ["web_search", "file_read"],
    });
    expect(req.tool_use).toBe(true);
  });

  test("should require tool_use for the supervisor agent even without tools", () => {
    const req = getAgentModelRequirements({ id: "supervisor" });
    expect(req.tool_use).toBe(true);
  });

  test("should require vision when the agent capabilities include 'vision'", () => {
    const req = getAgentModelRequirements({
      id: "vision-agent",
      capabilities: ["vision"],
    });
    expect(req.vision).toBe(true);
  });

  test("should not require vision when capabilities array is empty", () => {
    const req = getAgentModelRequirements({ id: "plain-agent", capabilities: [] });
    expect(req.vision).toBeUndefined();
  });

  test("should combine tool_use and vision requirements when both conditions are met", () => {
    const req = getAgentModelRequirements({
      id: "full-agent",
      tools: ["file_read"],
      capabilities: ["vision"],
    });
    expect(req.tool_use).toBe(true);
    expect(req.vision).toBe(true);
  });

  test("should not require tool_use when tools array is empty", () => {
    const req = getAgentModelRequirements({ id: "my-agent", tools: [] });
    expect(req.tool_use).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// withProviderLock()
// ---------------------------------------------------------------------------

describe("withProviderLock()", () => {
  beforeEach(async () => {
    await seedConfig(makeConfig());
  });

  test("should execute the provided function and return its result", async () => {
    const result = await withProviderLock(async () => "hello");
    expect(result).toBe("hello");
  });

  test("should re-throw errors from the wrapped function", async () => {
    await expect(
      withProviderLock(async () => {
        throw new Error("inside lock");
      })
    ).rejects.toThrow("inside lock");
  });

  test("should release the lock even when the wrapped function throws", async () => {
    // First call fails
    await expect(
      withProviderLock(async () => {
        throw new Error("oops");
      })
    ).rejects.toThrow("oops");

    // Second call must succeed — proves the lock was released
    const result = await withProviderLock(async () => "recovered");
    expect(result).toBe("recovered");
  });

  test("should clear the cache before executing the wrapped function", async () => {
    // Load something into the cache first
    await loadProvidersConfig();

    // Replace disk content before withProviderLock runs
    await Bun.write(
      TEST_CONFIG_PATH,
      stringify(
        makeConfig({
          providers: [
            {
              id: "fresh-provider",
              name: "Fresh Provider",
              api_mode: "openai",
              base_url: "https://fresh.com/v1",
              api_key_env: null,
              enabled: true,
              models: [],
            },
          ],
        }),
        { indent: 2 }
      )
    );

    // withProviderLock clears the cache before calling fn()
    const config = await withProviderLock(() => loadProvidersConfig());
    expect(config.providers[0]!.id).toBe("fresh-provider");
  });
});
