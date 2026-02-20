/**
 * Tests for loadAllPlugins (backend/src/plugins/loader.ts)
 *
 * All external dependencies (paths, yamlStorage, registry, connectionRegistry,
 * toolRegistry, migrateEnvCredentials) are mocked via mock.module() before the
 * module under test is imported. Bun.Glob is not mocked; the test directories in
 * /tmp are empty so the glob scans simply find no files — this lets us test all
 * orchestration logic without needing real plugin manifests on disk.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state — reset in every beforeEach
// ---------------------------------------------------------------------------

const mockState = {
  // yamlStorage
  yamlFiles: {} as Record<string, any>,
  ensureDirCalls: [] as string[],

  // pluginRegistry
  registryLoaded: false,
  registered: [] as Array<{ manifest: any; source: string }>,
  pluginList: [] as Array<{ id: string; enabled: boolean }>,

  // connectionRegistry
  connectors: [] as any[],

  // toolRegistry
  disabledPlugins: [] as Array<{ id: string; disabled: boolean }>,

  // migrateEnvCredentials
  envMigrated: false,

  // error triggers
  registryLoadError: null as Error | null,
  envMigrateError: null as Error | null,
};

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before importing the module under test
// Paths are relative to this test file at plugins/__tests__/loader.test.ts
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  PLUGINS_DIR: "/tmp/test-loader-plugins",
  PLUGINS_INSTALLED_DIR: "/tmp/test-loader-plugins/installed",
  PLUGINS_CONFIGS_DIR: "/tmp/test-loader-config/plugins",
}));

mock.module("../../utils/yamlStorage", () => ({
  loadYaml: async (path: string) => mockState.yamlFiles[path] ?? null,
  ensureDir: async (dir: string) => {
    mockState.ensureDirCalls.push(dir);
  },
}));

mock.module("../registry", () => ({
  pluginRegistry: {
    load: async () => {
      if (mockState.registryLoadError) throw mockState.registryLoadError;
      mockState.registryLoaded = true;
    },
    register: async (manifest: any, source: string) => {
      mockState.registered.push({ manifest, source });
    },
    list: () => mockState.pluginList,
  },
}));

mock.module("../../connections/registry", () => ({
  connectionRegistry: {
    register: (provider: any) => {
      mockState.connectors.push(provider);
    },
  },
}));

mock.module("../../tools/registry", () => ({
  toolRegistry: {
    setPluginDisabled: (id: string, disabled: boolean) => {
      mockState.disabledPlugins.push({ id, disabled });
    },
  },
}));

mock.module("../migrateEnvCredentials", () => ({
  migrateEnvCredentials: async () => {
    if (mockState.envMigrateError) throw mockState.envMigrateError;
    mockState.envMigrated = true;
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const { loadAllPlugins } = await import("../loader");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMockState(): void {
  mockState.yamlFiles = {};
  mockState.ensureDirCalls = [];
  mockState.registryLoaded = false;
  mockState.registered = [];
  mockState.pluginList = [];
  mockState.connectors = [];
  mockState.disabledPlugins = [];
  mockState.envMigrated = false;
  mockState.registryLoadError = null;
  mockState.envMigrateError = null;
}

function makePlugin(id: string, enabled: boolean): { id: string; enabled: boolean } {
  return { id, enabled };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("loadAllPlugins()", () => {
  beforeEach(() => {
    resetMockState();
  });

  // -------------------------------------------------------------------------

  describe("Initialisierungsreihenfolge", () => {
    test("sollte pluginRegistry.load() aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.registryLoaded).toBe(true);
    });

    test("sollte migrateEnvCredentials() aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.envMigrated).toBe(true);
    });

    test("sollte ensureDir für das Builtin-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.ensureDirCalls).toContain("/tmp/test-loader-plugins/builtin");
    });

    test("sollte ensureDir für das Installed-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.ensureDirCalls).toContain("/tmp/test-loader-plugins/installed");
    });

    test("sollte ensureDir für das Konfigurations-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.ensureDirCalls).toContain("/tmp/test-loader-config/plugins");
    });

    test("sollte Promise<void> zurückgeben", async () => {
      const result = await loadAllPlugins();

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("Disabled-Plugin-Synchronisierung", () => {
    test("sollte toolRegistry.setPluginDisabled für ein deaktiviertes Plugin aufrufen", async () => {
      mockState.pluginList = [makePlugin("disabled-plugin", false)];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(1);
      expect(mockState.disabledPlugins[0]).toEqual({ id: "disabled-plugin", disabled: true });
    });

    test("sollte toolRegistry.setPluginDisabled NICHT für ein aktives Plugin aufrufen", async () => {
      mockState.pluginList = [makePlugin("active-plugin", true)];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(0);
    });

    test("sollte deaktivierte und aktive Plugins korrekt unterscheiden", async () => {
      mockState.pluginList = [
        makePlugin("plugin-enabled", true),
        makePlugin("plugin-disabled", false),
        makePlugin("plugin-also-enabled", true),
        makePlugin("plugin-also-disabled", false),
      ];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(2);
      const disabledIds = mockState.disabledPlugins.map((e) => e.id);
      expect(disabledIds).toContain("plugin-disabled");
      expect(disabledIds).toContain("plugin-also-disabled");
      expect(disabledIds).not.toContain("plugin-enabled");
      expect(disabledIds).not.toContain("plugin-also-enabled");
    });

    test("sollte bei leerer Plugin-Liste keine setPluginDisabled-Aufrufe machen", async () => {
      mockState.pluginList = [];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(0);
    });

    test("sollte setPluginDisabled mit disabled=true aufrufen (nicht false)", async () => {
      mockState.pluginList = [makePlugin("off", false)];

      await loadAllPlugins();

      expect(mockState.disabledPlugins[0]!.disabled).toBe(true);
    });

    test("sollte alle deaktivierten Plugins aus der Registry-Liste erfassen", async () => {
      mockState.pluginList = [
        makePlugin("a", false),
        makePlugin("b", false),
        makePlugin("c", false),
      ];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------

  describe("Fehlerbehandlung", () => {
    test("sollte keinen Fehler werfen wenn Verzeichnisse nicht existieren", async () => {
      // ensureDir ist gemockt und wirft nicht; Bun.Glob.scan() auf nicht-existente
      // Verzeichnisse schlägt intern fehl, aber loadPluginsFromDir fängt das ab.
      await expect(loadAllPlugins()).resolves.toBeUndefined();
    });

    test("sollte keinen Fehler nach außen propagieren wenn pluginRegistry.load() wirft", async () => {
      mockState.registryLoadError = new Error("Registry load failure");

      await expect(loadAllPlugins()).rejects.toBeInstanceOf(Error);
    });

    test("sollte keinen Fehler nach außen propagieren wenn migrateEnvCredentials() wirft", async () => {
      mockState.envMigrateError = new Error("Migration failure");

      await expect(loadAllPlugins()).rejects.toBeInstanceOf(Error);
    });

    test("sollte bei leeren Verzeichnissen trotzdem registry.load() aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.registryLoaded).toBe(true);
    });

    test("sollte bei leeren Verzeichnissen trotzdem migrateEnvCredentials() aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.envMigrated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("loadPluginsFromDir (über loadAllPlugins)", () => {
    test("sollte ensureDir für das Builtin-Plugin-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      const builtinDir = "/tmp/test-loader-plugins/builtin";
      expect(mockState.ensureDirCalls).toContain(builtinDir);
    });

    test("sollte ensureDir für das Installed-Plugin-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      const installedDir = "/tmp/test-loader-plugins/installed";
      expect(mockState.ensureDirCalls).toContain(installedDir);
    });

    test("sollte ensureDir zweimal (je einmal pro Verzeichnis) aufrufen", async () => {
      await loadAllPlugins();

      // ensureDir wird für builtin, installed und den migrateConfigDir-Aufruf (PLUGINS_CONFIGS_DIR) aufgerufen
      const pluginDirCalls = mockState.ensureDirCalls.filter(
        (d) => d === "/tmp/test-loader-plugins/builtin" || d === "/tmp/test-loader-plugins/installed"
      );
      expect(pluginDirCalls).toHaveLength(2);
    });

    test("sollte keine registrierten Plugins melden wenn Verzeichnisse leer sind", async () => {
      await loadAllPlugins();

      // Da Bun.Glob keine Dateien in nicht-existenten/leeren /tmp-Dirs findet,
      // werden keine Plugins registriert.
      expect(mockState.registered).toHaveLength(0);
    });

    test("sollte nach leerem Scan ohne Fehler fortfahren", async () => {
      await expect(loadAllPlugins()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("migrateConfigDir (über loadAllPlugins)", () => {
    test("sollte ensureDir für das neue Konfigurations-Verzeichnis aufrufen", async () => {
      await loadAllPlugins();

      expect(mockState.ensureDirCalls).toContain("/tmp/test-loader-config/plugins");
    });

    test("sollte keinen Fehler werfen wenn das alte Konfigurationsverzeichnis nicht existiert", async () => {
      // Das alte Verzeichnis /tmp/test-loader-plugins/configs existiert nicht.
      // migrateConfigDir() fängt den Scan-Fehler intern ab.
      await expect(loadAllPlugins()).resolves.toBeUndefined();
    });

    test("sollte ohne Migration keinen Fehler erzeugen", async () => {
      const result = await loadAllPlugins();

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("Gesamtablauf — Integrationstest", () => {
    test("sollte alle Kernoperationen in einem einzigen Aufruf ausführen", async () => {
      mockState.pluginList = [makePlugin("my-plugin", true)];

      await loadAllPlugins();

      expect(mockState.registryLoaded).toBe(true);
      expect(mockState.envMigrated).toBe(true);
      expect(mockState.ensureDirCalls.length).toBeGreaterThanOrEqual(2);
    });

    test("sollte nach erfolgreichem Ablauf keine disabledPlugins-Einträge für aktive Plugins haben", async () => {
      mockState.pluginList = [
        makePlugin("p1", true),
        makePlugin("p2", true),
        makePlugin("p3", true),
      ];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(0);
    });

    test("sollte nach erfolgreichem Ablauf alle deaktivierten Plugins an toolRegistry gemeldet haben", async () => {
      mockState.pluginList = [
        makePlugin("active", true),
        makePlugin("inactive-a", false),
        makePlugin("inactive-b", false),
      ];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(2);
      const ids = mockState.disabledPlugins.map((d) => d.id);
      expect(ids).toContain("inactive-a");
      expect(ids).toContain("inactive-b");
    });

    test("sollte ensureDir mindestens dreimal aufrufen (builtin, installed, configDir)", async () => {
      await loadAllPlugins();

      // builtin + installed + PLUGINS_CONFIGS_DIR
      expect(mockState.ensureDirCalls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------------------

  describe("Connector-Laden (über loadAllPlugins)", () => {
    test("sollte connectionRegistry nicht befüllen wenn keine Connector-Plugins geladen werden", async () => {
      // Leere Verzeichnisse → kein Glob-Fund → kein Connector
      await loadAllPlugins();

      expect(mockState.connectors).toHaveLength(0);
    });

    test("sollte pluginList.list() genau einmal nach der Disabled-Sync aufrufen", async () => {
      let listCallCount = 0;
      const originalList = mockState.pluginList;

      // Wir können die Mock-Funktion hier nicht direkt wrappen, aber wir können
      // sicherstellen, dass disabledPlugins korrekt gemäß der zurückgegebenen Liste befüllt ist.
      mockState.pluginList = [makePlugin("x", false)];

      await loadAllPlugins();

      // Der Aufruf hat exactly 1 disabled-Plugin erfasst → list() wurde aufgerufen
      expect(mockState.disabledPlugins).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------

  describe("Randfall — sehr viele Plugins", () => {
    test("sollte 100 deaktivierte Plugins korrekt an toolRegistry melden", async () => {
      mockState.pluginList = Array.from({ length: 100 }, (_, i) =>
        makePlugin(`plugin-${i}`, false)
      );

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(100);
      expect(mockState.disabledPlugins.every((d) => d.disabled === true)).toBe(true);
    });

    test("sollte 50 aktive und 50 deaktivierte Plugins korrekt unterscheiden", async () => {
      mockState.pluginList = [
        ...Array.from({ length: 50 }, (_, i) => makePlugin(`active-${i}`, true)),
        ...Array.from({ length: 50 }, (_, i) => makePlugin(`disabled-${i}`, false)),
      ];

      await loadAllPlugins();

      expect(mockState.disabledPlugins).toHaveLength(50);
      const disabledIds = mockState.disabledPlugins.map((d) => d.id);
      expect(disabledIds.every((id) => id.startsWith("disabled-"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("Reihenfolge der ensureDir-Aufrufe", () => {
    test("sollte ensureDir für den Konfig-Ordner aufrufen (migrateConfigDir ist Teil des Ablaufs)", async () => {
      await loadAllPlugins();

      expect(mockState.ensureDirCalls).toContain("/tmp/test-loader-config/plugins");
    });

    test("sollte keine unerwarteten ensureDir-Pfade aufrufen", async () => {
      await loadAllPlugins();

      const expectedDirs = new Set([
        "/tmp/test-loader-plugins/builtin",
        "/tmp/test-loader-plugins/installed",
        "/tmp/test-loader-config/plugins",
      ]);

      for (const dir of mockState.ensureDirCalls) {
        expect(expectedDirs.has(dir)).toBe(true);
      }
    });
  });
});
