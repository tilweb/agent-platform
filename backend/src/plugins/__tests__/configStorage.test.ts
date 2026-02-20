/**
 * Tests for PluginConfigStorage (backend/src/plugins/configStorage.ts)
 *
 * All external dependencies (yamlStorage, paths, crypto) are mocked via
 * mock.module() so no real disk I/O or encryption occurs. The in-memory
 * fileStore Map simulates YAML file persistence across calls.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const fileStore = new Map<string, any>();

let encryptionConfigured = true;

// Simulated encrypt: wraps value in { encrypted, iv, tag, version } envelope.
// The "encrypted" field holds "enc:" + JSON.stringify(value) for easy recovery
// in the mock decryptData.
function mockEncrypt(value: any) {
  return {
    encrypted: "enc:" + JSON.stringify(value),
    iv: "mockediv",
    tag: "mockedtag",
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test.
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  PLUGINS_CONFIGS_DIR: "/tmp/mock-plugin-configs",
}));

mock.module("../../utils/yamlStorage", () => ({
  loadYaml: async (path: string) => {
    return fileStore.has(path) ? fileStore.get(path) : null;
  },
  saveYaml: async (path: string, data: any) => {
    fileStore.set(path, data);
  },
  deleteYaml: async (path: string) => {
    if (fileStore.has(path)) {
      fileStore.delete(path);
      return true;
    }
    return false;
  },
  ensureDir: async (_dir: string) => {
    // no-op in tests
  },
}));

mock.module("../../connections/crypto", () => ({
  encryptData: async (value: any) => mockEncrypt(value),
  decryptData: async (encrypted: any, validate?: (parsed: unknown) => any) => {
    // Recover the original value from our mock envelope
    const inner = encrypted.encrypted as string;
    if (!inner.startsWith("enc:")) throw new Error("not a mock-encrypted value");
    const parsed = JSON.parse(inner.slice(4));
    if (validate) return validate(parsed);
    return parsed;
  },
  isEncryptionConfigured: () => encryptionConfigured,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  savePluginConfig,
  loadPluginConfig,
  loadPluginConfigMasked,
  deletePluginConfig,
  isPluginConfigured,
  resolvePluginConfig,
} = await import("../configStorage");

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

const testSchema = [
  { key: "clientId", label: "Client ID", type: "string" as const, required: true, secret: true },
  { key: "clientSecret", label: "Client Secret", type: "string" as const, required: true, secret: true },
  { key: "region", label: "Region", type: "string" as const, required: false, secret: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the file path used by configStorage for a given pluginId / userId */
function pluginPath(pluginId: string, userId?: string): string {
  if (userId) {
    return `/tmp/mock-plugin-configs/${pluginId}/${userId}.yaml`;
  }
  return `/tmp/mock-plugin-configs/${pluginId}.yaml`;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("configStorage", () => {
  beforeEach(() => {
    fileStore.clear();
    encryptionConfigured = true;
  });

  // -------------------------------------------------------------------------

  describe("savePluginConfig()", () => {
    test("sollte Secret-Felder verschluesseln und speichern", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "secret-abc",
        region: "eu-west-1",
      });

      const stored = fileStore.get(pluginPath("my-plugin"));
      expect(stored).toBeDefined();
      // clientId is secret — must be an encrypted envelope
      expect(stored.values.clientId).toMatchObject({
        encrypted: expect.stringContaining("enc:"),
        iv: "mockediv",
        tag: "mockedtag",
        version: 1,
      });
      // clientSecret is secret too
      expect(stored.values.clientSecret).toMatchObject({ encrypted: expect.stringContaining("enc:") });
      // region is not secret — stored as plain string
      expect(stored.values.region).toBe("eu-west-1");
    });

    test("sollte nicht-geheime Felder im Klartext speichern", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "sec",
        region: "us-east-1",
      });

      const stored = fileStore.get(pluginPath("my-plugin"));
      expect(typeof stored.values.region).toBe("string");
      expect(stored.values.region).toBe("us-east-1");
    });

    test("sollte leere Werte ueberspringen", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "",
        region: "",
      });

      const stored = fileStore.get(pluginPath("my-plugin"));
      expect(stored.values.clientSecret).toBeUndefined();
      expect(stored.values.region).toBeUndefined();
    });

    test("sollte null-Werte ueberspringen", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: null,
        region: null,
      });

      const stored = fileStore.get(pluginPath("my-plugin"));
      expect(stored.values.clientSecret).toBeUndefined();
      expect(stored.values.region).toBeUndefined();
    });

    test("sollte maskierte Werte (••••••••) fuer Secret-Felder ueberspringen", async () => {
      // First save so there is an existing value to preserve
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "original-id",
        clientSecret: "original-secret",
      });

      const firstStored = fileStore.get(pluginPath("my-plugin"));
      const originalEncrypted = firstStored.values.clientSecret;

      // Re-save with masked value — existing encrypted value must be kept
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "new-id",
        clientSecret: "••••••••",
      });

      const updated = fileStore.get(pluginPath("my-plugin"));
      expect(updated.values.clientSecret).toEqual(originalEncrypted);
    });

    test("sollte vorhandene Secrets beibehalten wenn Feld nicht uebergeben wird", async () => {
      // Save initial config with both secrets
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "secret-abc",
      });

      const firstStored = fileStore.get(pluginPath("my-plugin"));
      const originalClientSecret = firstStored.values.clientSecret;

      // Update only region — existing secrets must survive
      await savePluginConfig("my-plugin", testSchema, {
        region: "ap-southeast-1",
      });

      const updated = fileStore.get(pluginPath("my-plugin"));
      expect(updated.values.clientSecret).toEqual(originalClientSecret);
    });

    test("sollte pluginId und configuredAt im gespeicherten Objekt setzen", async () => {
      const before = new Date().toISOString();

      await savePluginConfig("my-plugin", testSchema, { clientId: "x", clientSecret: "y" });

      const after = new Date().toISOString();
      const stored = fileStore.get(pluginPath("my-plugin"));

      expect(stored.pluginId).toBe("my-plugin");
      expect(stored.configuredAt).toBeDefined();
      expect(stored.configuredAt >= before).toBe(true);
      expect(stored.configuredAt <= after).toBe(true);
    });

    test("sollte configuredBy speichern wenn angegeben", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "x" }, "admin-user");

      const stored = fileStore.get(pluginPath("my-plugin"));
      expect(stored.configuredBy).toBe("admin-user");
    });

    test("sollte pro userId in eigenem Pfad speichern", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "user-id" }, undefined, "user-42");

      expect(fileStore.has(pluginPath("my-plugin", "user-42"))).toBe(true);
      expect(fileStore.has(pluginPath("my-plugin"))).toBe(false);
    });

    test("sollte einen Fehler werfen wenn Verschluesselung nicht konfiguriert ist", async () => {
      encryptionConfigured = false;

      await expect(
        savePluginConfig("my-plugin", testSchema, { clientId: "x" })
      ).rejects.toThrow("Encryption not configured");
    });
  });

  // -------------------------------------------------------------------------

  describe("loadPluginConfig()", () => {
    test("sollte null zurueckgeben wenn keine Konfiguration gespeichert ist", async () => {
      const result = await loadPluginConfig("nonexistent-plugin", testSchema);
      expect(result).toBeNull();
    });

    test("sollte Secret-Felder entschluesseln", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "secret-abc",
        region: "eu-west-1",
      });

      const result = await loadPluginConfig("my-plugin", testSchema);

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("id-123");
      expect(result!.clientSecret).toBe("secret-abc");
    });

    test("sollte nicht-geheime Felder unveraendert zurueckgeben", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "sec",
        region: "eu-central-1",
      });

      const result = await loadPluginConfig("my-plugin", testSchema);

      expect(result!.region).toBe("eu-central-1");
    });

    test("sollte Konfiguration fuer bestimmten userId laden", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "user-id" }, undefined, "user-99");

      const result = await loadPluginConfig("my-plugin", testSchema, "user-99");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("user-id");
    });

    test("sollte null zurueckgeben wenn userId-spezifische Konfig fehlt", async () => {
      // Only company config saved
      await savePluginConfig("my-plugin", testSchema, { clientId: "company-id" });

      const result = await loadPluginConfig("my-plugin", testSchema, "user-99");

      expect(result).toBeNull();
    });

    test("sollte plain Wert behalten wenn Feld kein verschluesseltes Objekt ist", async () => {
      // Manually store a config where a secret field is stored as plain text
      fileStore.set(pluginPath("my-plugin"), {
        pluginId: "my-plugin",
        values: { clientId: "plain-not-encrypted", region: "eu-west-1" },
        configuredAt: new Date().toISOString(),
      });

      const result = await loadPluginConfig("my-plugin", testSchema);

      // clientId is in secretKeys but not an encrypted object — returned as-is
      expect(result!.clientId).toBe("plain-not-encrypted");
    });
  });

  // -------------------------------------------------------------------------

  describe("loadPluginConfigMasked()", () => {
    test("sollte null zurueckgeben wenn keine Konfiguration gespeichert ist", async () => {
      const result = await loadPluginConfigMasked("nonexistent-plugin", testSchema);
      expect(result).toBeNull();
    });

    test("sollte Secret-Felder durch •••••••• ersetzen", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "secret-abc",
        region: "eu-west-1",
      });

      const result = await loadPluginConfigMasked("my-plugin", testSchema);

      expect(result).not.toBeNull();
      expect(result!.values.clientId).toBe("••••••••");
      expect(result!.values.clientSecret).toBe("••••••••");
    });

    test("sollte nicht-geheime Felder im Klartext zurueckgeben", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "sec",
        region: "us-west-2",
      });

      const result = await loadPluginConfigMasked("my-plugin", testSchema);

      expect(result!.values.region).toBe("us-west-2");
    });

    test("sollte configuredAt und configuredBy im Ergebnis enthalten", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "x" }, "admin");

      const result = await loadPluginConfigMasked("my-plugin", testSchema);

      expect(result!.configuredAt).toBeDefined();
      expect(result!.configuredBy).toBe("admin");
    });

    test("sollte configuredBy als undefined enthalten wenn nicht angegeben", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "x" });

      const result = await loadPluginConfigMasked("my-plugin", testSchema);

      expect(result!.configuredBy).toBeUndefined();
    });

    test("sollte pro userId maskierte Konfiguration laden", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "uid" }, "user", "user-7");

      const result = await loadPluginConfigMasked("my-plugin", testSchema, "user-7");

      expect(result!.values.clientId).toBe("••••••••");
    });
  });

  // -------------------------------------------------------------------------

  describe("deletePluginConfig()", () => {
    test("sollte gespeicherte Konfiguration loeschen und true zurueckgeben", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "x", clientSecret: "y" });
      expect(fileStore.has(pluginPath("my-plugin"))).toBe(true);

      const result = await deletePluginConfig("my-plugin");

      expect(result).toBe(true);
      expect(fileStore.has(pluginPath("my-plugin"))).toBe(false);
    });

    test("sollte false zurueckgeben wenn keine Konfiguration vorhanden ist", async () => {
      const result = await deletePluginConfig("nonexistent-plugin");
      expect(result).toBe(false);
    });

    test("sollte userId-spezifische Konfiguration loeschen", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "x" }, undefined, "user-5");
      expect(fileStore.has(pluginPath("my-plugin", "user-5"))).toBe(true);

      const result = await deletePluginConfig("my-plugin", "user-5");

      expect(result).toBe(true);
      expect(fileStore.has(pluginPath("my-plugin", "user-5"))).toBe(false);
    });

    test("sollte nur die angegebene userId-Konfiguration loeschen", async () => {
      await savePluginConfig("my-plugin", testSchema, { clientId: "company" });
      await savePluginConfig("my-plugin", testSchema, { clientId: "user" }, undefined, "user-5");

      await deletePluginConfig("my-plugin", "user-5");

      expect(fileStore.has(pluginPath("my-plugin"))).toBe(true);
      expect(fileStore.has(pluginPath("my-plugin", "user-5"))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("isPluginConfigured()", () => {
    test("sollte true zurueckgeben wenn alle Pflichtfelder vorhanden sind", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "id-123",
        clientSecret: "secret-abc",
      });

      const result = await isPluginConfigured("my-plugin", testSchema);
      expect(result).toBe(true);
    });

    test("sollte false zurueckgeben wenn ein Pflichtfeld fehlt", async () => {
      // Only clientId saved, clientSecret is required but missing
      await savePluginConfig("my-plugin", testSchema, { clientId: "id-123" });

      const result = await isPluginConfigured("my-plugin", testSchema);
      expect(result).toBe(false);
    });

    test("sollte false zurueckgeben wenn keine Konfiguration gespeichert ist", async () => {
      const result = await isPluginConfigured("nonexistent-plugin", testSchema);
      expect(result).toBe(false);
    });

    test("sollte true zurueckgeben wenn configSchema leer ist", async () => {
      const result = await isPluginConfigured("my-plugin", []);
      expect(result).toBe(true);
    });

    test("sollte true zurueckgeben wenn configSchema keine Pflichtfelder hat", async () => {
      const optionalOnlySchema = [
        { key: "region", label: "Region", type: "string" as const, required: false, secret: false },
      ];

      const result = await isPluginConfigured("my-plugin", optionalOnlySchema);
      expect(result).toBe(true);
    });

    test("sollte userId-spezifische Konfiguration pruefen", async () => {
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "uid",
        clientSecret: "usec",
      }, undefined, "user-3");

      const resultUser = await isPluginConfigured("my-plugin", testSchema, "user-3");
      const resultCompany = await isPluginConfigured("my-plugin", testSchema);

      expect(resultUser).toBe(true);
      expect(resultCompany).toBe(false);
    });

    test("sollte false zurueckgeben wenn Pflichtfeld leer ist", async () => {
      // Manually set an empty required field in the file store
      fileStore.set(pluginPath("my-plugin"), {
        pluginId: "my-plugin",
        values: { clientId: "", clientSecret: "sec" },
        configuredAt: new Date().toISOString(),
      });

      const result = await isPluginConfigured("my-plugin", testSchema);
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("resolvePluginConfig()", () => {
    beforeEach(async () => {
      // Set up company-level config
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "company-id",
        clientSecret: "company-secret",
        region: "eu-central-1",
      });

      // Set up user-level config
      await savePluginConfig("my-plugin", testSchema, {
        clientId: "user-id",
        clientSecret: "user-secret",
        region: "us-west-2",
      }, undefined, "user-10");
    });

    test("sollte User-Konfiguration laden wenn credentialMode=user", async () => {
      const result = await resolvePluginConfig("my-plugin", testSchema, "user-10", "user");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("user-id");
      expect(result!.region).toBe("us-west-2");
    });

    test("sollte Unternehmenskonfiguration laden wenn credentialMode=company", async () => {
      const result = await resolvePluginConfig("my-plugin", testSchema, "user-10", "company");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("company-id");
      expect(result!.region).toBe("eu-central-1");
    });

    test("sollte Unternehmenskonfiguration laden wenn kein credentialMode angegeben", async () => {
      const result = await resolvePluginConfig("my-plugin", testSchema, "user-10");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("company-id");
    });

    test("sollte beim Modus both zuerst User-Konfiguration versuchen", async () => {
      const result = await resolvePluginConfig("my-plugin", testSchema, "user-10", "both");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("user-id");
    });

    test("sollte beim Modus both auf Unternehmenskonfiguration zurueckfallen wenn User-Konfig fehlt", async () => {
      const result = await resolvePluginConfig("my-plugin", testSchema, "unknown-user", "both");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("company-id");
    });

    test("sollte null zurueckgeben wenn credentialMode=user aber kein userId angegeben", async () => {
      // Without userId, user mode should fall through to company lookup
      const result = await resolvePluginConfig("my-plugin", testSchema, undefined, "user");

      // No userId — falls back to company config (which loadPluginConfig uses without userId)
      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("company-id");
    });

    test("sollte null zurueckgeben wenn weder User- noch Unternehmenskonfiguration existiert", async () => {
      const result = await resolvePluginConfig("nonexistent-plugin", testSchema, "user-10", "both");
      expect(result).toBeNull();
    });
  });
});
