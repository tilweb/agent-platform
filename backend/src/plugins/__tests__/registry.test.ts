/**
 * Tests for PluginRegistry (backend/src/plugins/registry.ts)
 *
 * All external dependencies (yamlStorage, paths, configStorage) are mocked
 * via mock.module() so no real disk I/O occurs. A fresh PluginRegistry
 * instance is created in each describe block using beforeEach.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  loadYamlResult: null as any | null,
  savedData: null as any | null,
  isPluginConfiguredResult: false as boolean,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test.
// Paths are relative to this test file's location.
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  PLUGINS_REGISTRY_FILE: "/tmp/test-plugins-registry.yaml",
}));

mock.module("../../utils/yamlStorage", () => ({
  loadYaml: async (_path: string) => mockState.loadYamlResult,
  saveYaml: async (_path: string, data: any) => {
    mockState.savedData = data;
  },
}));

mock.module("../configStorage", () => ({
  isPluginConfigured: async (_pluginId: string, _configSchema: any[]) =>
    mockState.isPluginConfiguredResult,
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const { PluginRegistry } = await import("../registry");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManifest(id: string, type = "connector"): any {
  return {
    id,
    type,
    name: `Plugin ${id}`,
    description: `Test ${id}`,
    version: "1.0",
    configSchema: [],
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("PluginRegistry", () => {
  let registry: InstanceType<typeof PluginRegistry>;

  beforeEach(() => {
    registry = new PluginRegistry();
    mockState.loadYamlResult = null;
    mockState.savedData = null;
    mockState.isPluginConfiguredResult = false;
  });

  // -------------------------------------------------------------------------

  describe("load()", () => {
    test("sollte Einträge aus der YAML-Datei laden", async () => {
      mockState.loadYamlResult = {
        plugins: {
          "plugin-a": {
            id: "plugin-a",
            type: "connector",
            source: "builtin",
            enabled: true,
            configured: false,
          },
          "plugin-b": {
            id: "plugin-b",
            type: "agent",
            source: "installed",
            enabled: false,
            configured: true,
          },
        },
      };

      await registry.load();

      expect(registry.getEntry("plugin-a")).toBeDefined();
      expect(registry.getEntry("plugin-a")!.enabled).toBe(true);
      expect(registry.getEntry("plugin-b")).toBeDefined();
      expect(registry.getEntry("plugin-b")!.enabled).toBe(false);
    });

    test("sollte bei null-Ergebnis von loadYaml keine Einträge anlegen", async () => {
      mockState.loadYamlResult = null;

      await registry.load();

      expect(registry.getIds()).toHaveLength(0);
    });

    test("sollte bei fehlenden plugins-Daten keine Einträge anlegen", async () => {
      mockState.loadYamlResult = {};

      await registry.load();

      expect(registry.getIds()).toHaveLength(0);
    });

    test("sollte mehrere Einträge korrekt laden", async () => {
      mockState.loadYamlResult = {
        plugins: {
          "p1": { id: "p1", type: "connector", source: "builtin", enabled: true, configured: false },
          "p2": { id: "p2", type: "skill", source: "installed", enabled: true, configured: true },
          "p3": { id: "p3", type: "agent", source: "builtin", enabled: false, configured: false },
        },
      };

      await registry.load();

      expect(registry.getEntry("p1")).toBeDefined();
      expect(registry.getEntry("p2")).toBeDefined();
      expect(registry.getEntry("p3")).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("register()", () => {
    test("sollte Manifest und Eintrag speichern", async () => {
      const manifest = createManifest("my-plugin");

      await registry.register(manifest, "builtin");

      expect(registry.getManifest("my-plugin")).toBeDefined();
      expect(registry.getEntry("my-plugin")).toBeDefined();
    });

    test("sollte isPluginConfigured aufrufen und Ergebnis im Eintrag speichern", async () => {
      mockState.isPluginConfiguredResult = true;
      const manifest = createManifest("configured-plugin");

      await registry.register(manifest, "builtin");

      expect(registry.getEntry("configured-plugin")!.configured).toBe(true);
    });

    test("sollte configured=false setzen wenn isPluginConfigured false liefert", async () => {
      mockState.isPluginConfiguredResult = false;
      const manifest = createManifest("unconfigured-plugin");

      await registry.register(manifest, "builtin");

      expect(registry.getEntry("unconfigured-plugin")!.configured).toBe(false);
    });

    test("sollte enabled=true standardmäßig setzen wenn kein vorheriger Eintrag vorhanden", async () => {
      const manifest = createManifest("new-plugin");

      await registry.register(manifest, "builtin");

      expect(registry.getEntry("new-plugin")!.enabled).toBe(true);
    });

    test("sollte enabled-Status aus vorherigem Eintrag übernehmen", async () => {
      // Zuerst einen Eintrag per load() mit enabled=false persistent laden
      mockState.loadYamlResult = {
        plugins: {
          "existing-plugin": {
            id: "existing-plugin",
            type: "connector",
            source: "builtin",
            enabled: false,
            configured: false,
          },
        },
      };
      await registry.load();

      // Jetzt das gleiche Plugin neu registrieren
      const manifest = createManifest("existing-plugin");
      await registry.register(manifest, "builtin");

      expect(registry.getEntry("existing-plugin")!.enabled).toBe(false);
    });

    test("sollte source im Eintrag korrekt setzen", async () => {
      const manifest = createManifest("installed-plugin");

      await registry.register(manifest, "installed");

      expect(registry.getEntry("installed-plugin")!.source).toBe("installed");
    });

    test("sollte installedAt nur für installierte Plugins setzen", async () => {
      const manifestInstalled = createManifest("installed");
      const manifestBuiltin = createManifest("builtin-only");

      await registry.register(manifestInstalled, "installed");
      await registry.register(manifestBuiltin, "builtin");

      expect(registry.getEntry("installed")!.installedAt).toBeDefined();
      expect(registry.getEntry("builtin-only")!.installedAt).toBeUndefined();
    });

    test("sollte vorhandenes installedAt erhalten wenn bereits gesetzt", async () => {
      const existingInstalledAt = "2026-01-01T00:00:00.000Z";
      mockState.loadYamlResult = {
        plugins: {
          "preinstalled": {
            id: "preinstalled",
            type: "connector",
            source: "installed",
            enabled: true,
            configured: false,
            installedAt: existingInstalledAt,
          },
        },
      };
      await registry.load();

      const manifest = createManifest("preinstalled");
      await registry.register(manifest, "installed");

      expect(registry.getEntry("preinstalled")!.installedAt).toBe(existingInstalledAt);
    });

    test("sollte saveYaml aufrufen", async () => {
      mockState.savedData = null;
      const manifest = createManifest("save-test");

      await registry.register(manifest, "builtin");

      expect(mockState.savedData).not.toBeNull();
      expect(mockState.savedData).toHaveProperty("plugins");
    });

    test("sollte Manifest-Typ im Eintrag übernehmen", async () => {
      const manifest = createManifest("agent-plugin", "agent");

      await registry.register(manifest, "builtin");

      expect(registry.getEntry("agent-plugin")!.type).toBe("agent");
    });
  });

  // -------------------------------------------------------------------------

  describe("unregister()", () => {
    test("sollte einen registrierten Plugin entfernen und true zurückgeben", async () => {
      await registry.register(createManifest("to-remove"), "builtin");

      const result = await registry.unregister("to-remove");

      expect(result).toBe(true);
      expect(registry.getManifest("to-remove")).toBeUndefined();
      expect(registry.getEntry("to-remove")).toBeUndefined();
    });

    test("sollte false zurückgeben wenn Plugin nicht existiert", async () => {
      const result = await registry.unregister("nonexistent");

      expect(result).toBe(false);
    });

    test("sollte saveYaml aufrufen wenn Plugin entfernt wird", async () => {
      await registry.register(createManifest("save-on-unregister"), "builtin");
      mockState.savedData = null;

      await registry.unregister("save-on-unregister");

      expect(mockState.savedData).not.toBeNull();
    });

    test("sollte saveYaml nicht aufrufen wenn Plugin nicht existiert", async () => {
      mockState.savedData = null;

      await registry.unregister("ghost-plugin");

      expect(mockState.savedData).toBeNull();
    });

    test("sollte Plugin aus getIds() entfernen", async () => {
      await registry.register(createManifest("removable"), "builtin");
      await registry.unregister("removable");

      expect(registry.getIds()).not.toContain("removable");
    });
  });

  // -------------------------------------------------------------------------

  describe("getManifest()", () => {
    test("sollte das gespeicherte Manifest zurückgeben", async () => {
      const manifest = createManifest("manifest-test");
      await registry.register(manifest, "builtin");

      const result = registry.getManifest("manifest-test");

      expect(result).toBeDefined();
      expect(result!.id).toBe("manifest-test");
      expect(result!.name).toBe("Plugin manifest-test");
    });

    test("sollte undefined zurückgeben wenn Plugin nicht existiert", () => {
      expect(registry.getManifest("unknown")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("getEntry()", () => {
    test("sollte den gespeicherten Eintrag zurückgeben", async () => {
      await registry.register(createManifest("entry-test"), "builtin");

      const entry = registry.getEntry("entry-test");

      expect(entry).toBeDefined();
      expect(entry!.id).toBe("entry-test");
      expect(entry!.source).toBe("builtin");
    });

    test("sollte undefined zurückgeben wenn Plugin nicht existiert", () => {
      expect(registry.getEntry("unknown")).toBeUndefined();
    });

    test("sollte Eintrag aus load() zurückgeben", async () => {
      mockState.loadYamlResult = {
        plugins: {
          "loaded-entry": {
            id: "loaded-entry",
            type: "connector",
            source: "installed",
            enabled: true,
            configured: true,
            configuredAt: "2026-01-15T10:00:00.000Z",
          },
        },
      };
      await registry.load();

      const entry = registry.getEntry("loaded-entry");

      expect(entry).toBeDefined();
      expect(entry!.configuredAt).toBe("2026-01-15T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------

  describe("getInfo()", () => {
    test("sollte Manifest und Eintrag kombiniert zurückgeben", async () => {
      mockState.isPluginConfiguredResult = true;
      const manifest = createManifest("info-plugin", "connector");
      await registry.register(manifest, "installed");

      const info = registry.getInfo("info-plugin");

      expect(info).toBeDefined();
      expect(info!.id).toBe("info-plugin");
      expect(info!.name).toBe("Plugin info-plugin");
      expect(info!.type).toBe("connector");
      expect(info!.source).toBe("installed");
      expect(info!.configured).toBe(true);
      expect(info!.enabled).toBe(true);
      expect(info!.version).toBe("1.0");
      expect(info!.description).toBe("Test info-plugin");
    });

    test("sollte undefined zurückgeben wenn kein Manifest vorhanden ist", () => {
      expect(registry.getInfo("no-manifest")).toBeUndefined();
    });

    test("sollte undefined zurückgeben wenn weder Manifest noch Eintrag vorhanden", () => {
      expect(registry.getInfo("completely-missing")).toBeUndefined();
    });

    test("sollte configSchema aus dem Manifest enthalten", async () => {
      const manifest = {
        ...createManifest("schema-plugin"),
        configSchema: [{ key: "apiKey", label: "API Key", type: "string", required: true, secret: true }],
      };
      await registry.register(manifest, "builtin");

      const info = registry.getInfo("schema-plugin");

      expect(info!.configSchema).toHaveLength(1);
      expect(info!.configSchema![0].key).toBe("apiKey");
    });
  });

  // -------------------------------------------------------------------------

  describe("list()", () => {
    beforeEach(async () => {
      // Drei verschiedene Plugins registrieren
      await registry.register(createManifest("connector-1", "connector"), "builtin");
      await registry.register(createManifest("connector-2", "connector"), "installed");
      await registry.register(createManifest("agent-1", "agent"), "builtin");
    });

    test("sollte alle Plugins ohne Filter zurückgeben", () => {
      const results = registry.list();

      expect(results).toHaveLength(3);
    });

    test("sollte nach type filtern", () => {
      const results = registry.list({ type: "connector" });

      expect(results).toHaveLength(2);
      expect(results.every((p) => p.type === "connector")).toBe(true);
    });

    test("sollte nach source filtern", () => {
      const results = registry.list({ source: "installed" });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("connector-2");
    });

    test("sollte nach enabled filtern", async () => {
      await registry.setEnabled("connector-2", false);

      const enabled = registry.list({ enabled: true });
      const disabled = registry.list({ enabled: false });

      expect(enabled.every((p) => p.enabled)).toBe(true);
      expect(disabled.every((p) => !p.enabled)).toBe(true);
    });

    test("sollte mehrere Filter kombinieren (type + source)", () => {
      const results = registry.list({ type: "connector", source: "builtin" });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("connector-1");
    });

    test("sollte eine leere Liste zurückgeben wenn kein Plugin dem Filter entspricht", () => {
      const results = registry.list({ type: "bundle" });

      expect(results).toHaveLength(0);
    });

    test("sollte eine leere Liste zurückgeben wenn keine Plugins registriert sind", async () => {
      registry.clear();
      const results = registry.list();

      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("setEnabled()", () => {
    test("sollte enabled-Status auf true setzen und true zurückgeben", async () => {
      await registry.register(createManifest("toggleable"), "builtin");
      await registry.setEnabled("toggleable", false);

      const result = await registry.setEnabled("toggleable", true);

      expect(result).toBe(true);
      expect(registry.getEntry("toggleable")!.enabled).toBe(true);
    });

    test("sollte enabled-Status auf false setzen", async () => {
      await registry.register(createManifest("disable-me"), "builtin");

      await registry.setEnabled("disable-me", false);

      expect(registry.isEnabled("disable-me")).toBe(false);
    });

    test("sollte false zurückgeben wenn Plugin nicht existiert", async () => {
      const result = await registry.setEnabled("nonexistent", true);

      expect(result).toBe(false);
    });

    test("sollte saveYaml aufrufen", async () => {
      await registry.register(createManifest("save-enabled"), "builtin");
      mockState.savedData = null;

      await registry.setEnabled("save-enabled", false);

      expect(mockState.savedData).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe("updateConfigured()", () => {
    test("sollte configured=true setzen und configuredAt füllen", async () => {
      await registry.register(createManifest("config-update"), "builtin");
      const before = new Date().toISOString();

      await registry.updateConfigured("config-update", true, "admin");

      const after = new Date().toISOString();
      const entry = registry.getEntry("config-update")!;
      expect(entry.configured).toBe(true);
      expect(entry.configuredAt).toBeDefined();
      expect(entry.configuredAt! >= before).toBe(true);
      expect(entry.configuredAt! <= after).toBe(true);
    });

    test("sollte configuredBy speichern wenn angegeben", async () => {
      await registry.register(createManifest("by-user"), "builtin");

      await registry.updateConfigured("by-user", true, "user-123");

      expect(registry.getEntry("by-user")!.configuredBy).toBe("user-123");
    });

    test("sollte configured=false setzen und configuredAt sowie configuredBy löschen", async () => {
      await registry.register(createManifest("unconfigure"), "builtin");
      await registry.updateConfigured("unconfigure", true, "admin");

      await registry.updateConfigured("unconfigure", false);

      const entry = registry.getEntry("unconfigure")!;
      expect(entry.configured).toBe(false);
      expect(entry.configuredAt).toBeUndefined();
      expect(entry.configuredBy).toBeUndefined();
    });

    test("sollte nichts tun wenn Plugin nicht existiert", async () => {
      // Kein Fehler erwarten
      await expect(
        registry.updateConfigured("nonexistent", true)
      ).resolves.toBeUndefined();
    });

    test("sollte saveYaml aufrufen", async () => {
      await registry.register(createManifest("save-configured"), "builtin");
      mockState.savedData = null;

      await registry.updateConfigured("save-configured", true);

      expect(mockState.savedData).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe("isConfigured()", () => {
    test("sollte true zurückgeben wenn Plugin konfiguriert ist", async () => {
      mockState.isPluginConfiguredResult = true;
      await registry.register(createManifest("configured"), "builtin");

      expect(registry.isConfigured("configured")).toBe(true);
    });

    test("sollte false zurückgeben wenn Plugin nicht konfiguriert ist", async () => {
      mockState.isPluginConfiguredResult = false;
      await registry.register(createManifest("not-configured"), "builtin");

      expect(registry.isConfigured("not-configured")).toBe(false);
    });

    test("sollte false zurückgeben wenn Plugin nicht existiert", () => {
      expect(registry.isConfigured("unknown-plugin")).toBe(false);
    });

    test("sollte nach updateConfigured() den aktualisierten Wert zurückgeben", async () => {
      mockState.isPluginConfiguredResult = false;
      await registry.register(createManifest("update-test"), "builtin");

      await registry.updateConfigured("update-test", true);

      expect(registry.isConfigured("update-test")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("isEnabled()", () => {
    test("sollte true zurückgeben wenn Plugin aktiviert ist", async () => {
      await registry.register(createManifest("enabled-plugin"), "builtin");

      expect(registry.isEnabled("enabled-plugin")).toBe(true);
    });

    test("sollte false zurückgeben wenn Plugin deaktiviert ist", async () => {
      await registry.register(createManifest("disabled-plugin"), "builtin");
      await registry.setEnabled("disabled-plugin", false);

      expect(registry.isEnabled("disabled-plugin")).toBe(false);
    });

    test("sollte false zurückgeben wenn Plugin nicht existiert", () => {
      expect(registry.isEnabled("unknown-plugin")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("getIds()", () => {
    test("sollte alle registrierten IDs zurückgeben", async () => {
      await registry.register(createManifest("id-1"), "builtin");
      await registry.register(createManifest("id-2"), "installed");
      await registry.register(createManifest("id-3"), "builtin");

      const ids = registry.getIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain("id-1");
      expect(ids).toContain("id-2");
      expect(ids).toContain("id-3");
    });

    test("sollte eine leere Liste zurückgeben wenn keine Plugins registriert sind", () => {
      expect(registry.getIds()).toHaveLength(0);
    });

    test("sollte nach clear() eine leere Liste zurückgeben", async () => {
      await registry.register(createManifest("will-be-cleared"), "builtin");
      registry.clear();

      expect(registry.getIds()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("clear()", () => {
    test("sollte alle Manifeste und Einträge entfernen", async () => {
      await registry.register(createManifest("c1"), "builtin");
      await registry.register(createManifest("c2"), "installed");

      registry.clear();

      expect(registry.getManifest("c1")).toBeUndefined();
      expect(registry.getManifest("c2")).toBeUndefined();
      expect(registry.getEntry("c1")).toBeUndefined();
      expect(registry.getEntry("c2")).toBeUndefined();
    });

    test("sollte getIds() leere Liste nach clear() zurückgeben", async () => {
      await registry.register(createManifest("clear-test"), "builtin");

      registry.clear();

      expect(registry.getIds()).toHaveLength(0);
    });

    test("sollte list() leere Liste nach clear() zurückgeben", async () => {
      await registry.register(createManifest("list-clear"), "builtin");

      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });

    test("sollte nach clear() neue Registrierungen wieder erlauben", async () => {
      await registry.register(createManifest("old"), "builtin");
      registry.clear();

      await registry.register(createManifest("new"), "builtin");

      expect(registry.getIds()).toEqual(["new"]);
    });

    test("sollte auf leerem Registry keinen Fehler werfen", () => {
      expect(() => registry.clear()).not.toThrow();
    });
  });
});
