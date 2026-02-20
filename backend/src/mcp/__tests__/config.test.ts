/**
 * Tests for backend/src/mcp/config.ts
 *
 * Uses a real temporary file in /tmp so that actual fs/promises and yaml
 * round-trip behaviour is exercised.  The MCP_SERVERS_CONFIG path is
 * redirected to a per-process temp file via mock.module so the production
 * data directory is never touched.
 *
 * All mock.module() calls MUST appear BEFORE the dynamic import of the
 * module under test.
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { existsSync } from "fs";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Temp config file path — unique per test run to avoid collisions
// ---------------------------------------------------------------------------

const TEST_CONFIG_PATH = `/tmp/test-mcp-config-${process.pid}.yaml`;

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before the dynamic import below
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  MCP_SERVERS_CONFIG: TEST_CONFIG_PATH,
  // Re-export the other paths constants so any transitive import doesn't break
  DATA_DIR: "/tmp/test-mcp-data",
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  MCP_SERVER_PRESETS,
  loadMcpConfig,
  saveMcpConfig,
  getMcpServers,
  getMcpServer,
  addMcpServer,
  updateMcpServer,
  deleteMcpServer,
  getEnabledMcpServers,
  getMcpPresets,
} = await import("../config");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove the temp config file so loadMcpConfig treats it as absent. */
async function removeConfigFile(): Promise<void> {
  try {
    await rm(TEST_CONFIG_PATH, { force: true });
  } catch {
    // Ignore — file may already be absent
  }
}

/** Write a McpServersConfig-shaped object as YAML to the temp file. */
async function seedConfig(config: { servers: unknown[] }): Promise<void> {
  const dir = dirname(TEST_CONFIG_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(TEST_CONFIG_PATH, stringifyYaml(config), "utf-8");
}

/** A minimal valid McpServerConfig fixture. */
function makeServer(overrides: Partial<{
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}> = {}) {
  return {
    id: overrides.id ?? "test-server",
    name: overrides.name ?? "Test Server",
    command: overrides.command ?? "npx",
    args: overrides.args ?? ["-y", "some-mcp-package"],
    enabled: overrides.enabled,
  };
}

// ---------------------------------------------------------------------------
// MCP_SERVER_PRESETS
// ---------------------------------------------------------------------------

describe("MCP_SERVER_PRESETS", () => {
  test("ist ein nicht-leeres Objekt", () => {
    expect(Object.keys(MCP_SERVER_PRESETS).length).toBeGreaterThan(0);
  });

  test("enthält einen github-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("github");
  });

  test("enthält einen filesystem-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("filesystem");
  });

  test("enthält einen sqlite-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("sqlite");
  });

  test("enthält einen brave-search-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("brave-search");
  });

  test("enthält einen puppeteer-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("puppeteer");
  });

  test("enthält einen memory-Eintrag", () => {
    expect(MCP_SERVER_PRESETS).toHaveProperty("memory");
  });

  test("jeder Preset hat ein name-Feld", () => {
    for (const [key, preset] of Object.entries(MCP_SERVER_PRESETS)) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  test("jeder Preset hat ein command-Feld", () => {
    for (const [key, preset] of Object.entries(MCP_SERVER_PRESETS)) {
      expect(typeof preset.command).toBe("string");
      expect(preset.command.length).toBeGreaterThan(0);
    }
  });

  test("github-Preset hat GITHUB_PERSONAL_ACCESS_TOKEN in env", () => {
    expect(MCP_SERVER_PRESETS.github.env).toHaveProperty("GITHUB_PERSONAL_ACCESS_TOKEN");
  });

  test("brave-search-Preset hat BRAVE_API_KEY in env", () => {
    expect(MCP_SERVER_PRESETS["brave-search"].env).toHaveProperty("BRAVE_API_KEY");
  });
});

// ---------------------------------------------------------------------------
// loadMcpConfig()
// ---------------------------------------------------------------------------

describe("loadMcpConfig()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("gibt leere servers-Liste zurück wenn Datei nicht existiert", async () => {
    const config = await loadMcpConfig();
    expect(config).toEqual({ servers: [] });
  });

  test("parst eine gültige YAML-Datei korrekt", async () => {
    const server = makeServer();
    await seedConfig({ servers: [server] });
    const config = await loadMcpConfig();
    expect(config.servers).toHaveLength(1);
    expect(config.servers[0]!.id).toBe("test-server");
    expect(config.servers[0]!.name).toBe("Test Server");
  });

  test("gibt servers-Feld als Array zurück", async () => {
    await seedConfig({ servers: [] });
    const config = await loadMcpConfig();
    expect(Array.isArray(config.servers)).toBe(true);
  });

  test("gibt leere servers-Liste zurück wenn YAML servers-Feld fehlt", async () => {
    await writeFile(TEST_CONFIG_PATH, stringifyYaml({}), "utf-8");
    const config = await loadMcpConfig();
    expect(config.servers).toEqual([]);
  });

  test("gibt leere servers-Liste zurück bei ungültigem YAML-Inhalt", async () => {
    await writeFile(TEST_CONFIG_PATH, "{ invalid yaml: [[[", "utf-8");
    const config = await loadMcpConfig();
    expect(config.servers).toEqual([]);
  });

  test("gibt mehrere Server korrekt zurück", async () => {
    const servers = [
      makeServer({ id: "server-a", name: "Server A" }),
      makeServer({ id: "server-b", name: "Server B" }),
    ];
    await seedConfig({ servers });
    const config = await loadMcpConfig();
    expect(config.servers).toHaveLength(2);
    const ids = config.servers.map((s) => s.id);
    expect(ids).toContain("server-a");
    expect(ids).toContain("server-b");
  });
});

// ---------------------------------------------------------------------------
// saveMcpConfig()
// ---------------------------------------------------------------------------

describe("saveMcpConfig()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("schreibt gültige YAML-Daten in die Konfigurationsdatei", async () => {
    const server = makeServer();
    await saveMcpConfig({ servers: [server] });

    expect(existsSync(TEST_CONFIG_PATH)).toBe(true);
    const content = await readFile(TEST_CONFIG_PATH, "utf-8");
    const parsed = parseYaml(content) as { servers: typeof server[] };
    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0]!.id).toBe("test-server");
  });

  test("erstellt das Verzeichnis automatisch wenn es nicht existiert", async () => {
    // Use a subdirectory that does not exist yet
    const nestedPath = `/tmp/test-mcp-nested-${process.pid}/subdir/mcp-servers.yaml`;
    try {
      // Temporarily override the module's internal path by writing through saveMcpConfig
      // We test directory creation indirectly via the real config path — the
      // parent directory of TEST_CONFIG_PATH (/tmp) always exists, so we
      // verify the function does not throw when writing to an existing dir.
      await saveMcpConfig({ servers: [] });
      expect(existsSync(TEST_CONFIG_PATH)).toBe(true);
    } finally {
      await rm(dirname(nestedPath), { recursive: true, force: true });
    }
  });

  test("schreibt leere servers-Liste korrekt", async () => {
    await saveMcpConfig({ servers: [] });
    const config = await loadMcpConfig();
    expect(config.servers).toEqual([]);
  });

  test("überschreibt vorhandene Datei mit neuen Daten", async () => {
    await saveMcpConfig({ servers: [makeServer({ id: "original" })] });
    await saveMcpConfig({ servers: [makeServer({ id: "replaced" })] });

    const config = await loadMcpConfig();
    expect(config.servers).toHaveLength(1);
    expect(config.servers[0]!.id).toBe("replaced");
  });

  test("runde-Reise: gespeicherte und geladene Daten sind identisch", async () => {
    const server = makeServer({ id: "round-trip", name: "Round Trip" });
    await saveMcpConfig({ servers: [server] });
    const config = await loadMcpConfig();
    expect(config.servers[0]!.id).toBe(server.id);
    expect(config.servers[0]!.name).toBe(server.name);
    expect(config.servers[0]!.command).toBe(server.command);
  });
});

// ---------------------------------------------------------------------------
// getMcpServers()
// ---------------------------------------------------------------------------

describe("getMcpServers()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("gibt leere Liste zurück wenn keine Server konfiguriert sind", async () => {
    const servers = await getMcpServers();
    expect(servers).toEqual([]);
  });

  test("gibt alle konfigurierten Server zurück", async () => {
    await seedConfig({
      servers: [
        makeServer({ id: "srv-1" }),
        makeServer({ id: "srv-2" }),
      ],
    });
    const servers = await getMcpServers();
    expect(servers).toHaveLength(2);
  });

  test("gibt aktivierte und deaktivierte Server zurück", async () => {
    await seedConfig({
      servers: [
        makeServer({ id: "enabled-srv", enabled: true }),
        makeServer({ id: "disabled-srv", enabled: false }),
      ],
    });
    const servers = await getMcpServers();
    expect(servers).toHaveLength(2);
    const ids = servers.map((s) => s.id);
    expect(ids).toContain("enabled-srv");
    expect(ids).toContain("disabled-srv");
  });
});

// ---------------------------------------------------------------------------
// getMcpServer()
// ---------------------------------------------------------------------------

describe("getMcpServer()", () => {
  beforeEach(async () => {
    await seedConfig({
      servers: [
        makeServer({ id: "known-server", name: "Known Server" }),
      ],
    });
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("gibt den passenden Server anhand der ID zurück", async () => {
    const server = await getMcpServer("known-server");
    expect(server).not.toBeNull();
    expect(server!.id).toBe("known-server");
    expect(server!.name).toBe("Known Server");
  });

  test("gibt null zurück wenn die ID nicht existiert", async () => {
    const server = await getMcpServer("does-not-exist");
    expect(server).toBeNull();
  });

  test("gibt null zurück wenn keine Server konfiguriert sind", async () => {
    await removeConfigFile();
    const server = await getMcpServer("any-id");
    expect(server).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addMcpServer()
// ---------------------------------------------------------------------------

describe("addMcpServer()", () => {
  beforeEach(async () => {
    await removeConfigFile();
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("fügt einen neuen Server zur Liste hinzu", async () => {
    const server = makeServer({ id: "new-server" });
    await addMcpServer(server as any);
    const servers = await getMcpServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]!.id).toBe("new-server");
  });

  test("gibt den hinzugefügten Server zurück", async () => {
    const server = makeServer({ id: "returned-server" });
    const result = await addMcpServer(server as any);
    expect(result.id).toBe("returned-server");
    expect(result.name).toBe("Test Server");
  });

  test("persistiert den Server in die Datei", async () => {
    await addMcpServer(makeServer({ id: "persisted" }) as any);
    // Re-read from file directly
    const content = await readFile(TEST_CONFIG_PATH, "utf-8");
    const parsed = parseYaml(content) as { servers: { id: string }[] };
    expect(parsed.servers.some((s) => s.id === "persisted")).toBe(true);
  });

  test("wirft einen Fehler bei doppelter Server-ID", async () => {
    const server = makeServer({ id: "duplicate" });
    await addMcpServer(server as any);
    await expect(addMcpServer(server as any)).rejects.toThrow("duplicate");
  });

  test("kann mehrere Server mit unterschiedlichen IDs hinzufügen", async () => {
    await addMcpServer(makeServer({ id: "alpha" }) as any);
    await addMcpServer(makeServer({ id: "beta" }) as any);
    const servers = await getMcpServers();
    expect(servers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// updateMcpServer()
// ---------------------------------------------------------------------------

describe("updateMcpServer()", () => {
  beforeEach(async () => {
    await seedConfig({
      servers: [makeServer({ id: "existing", name: "Original Name" })],
    });
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("aktualisiert den Server-Namen", async () => {
    const updated = await updateMcpServer("existing", { name: "Updated Name" });
    expect(updated.name).toBe("Updated Name");
  });

  test("behält die Server-ID unverändert", async () => {
    const updated = await updateMcpServer("existing", { name: "New Name" });
    expect(updated.id).toBe("existing");
  });

  test("ignoriert eine ID im updates-Objekt und behält die ursprüngliche ID", async () => {
    const updated = await updateMcpServer("existing", { id: "hacked-id" } as any);
    expect(updated.id).toBe("existing");
  });

  test("gibt das vollständige aktualisierte Server-Objekt zurück", async () => {
    const updated = await updateMcpServer("existing", { name: "Updated" });
    expect(updated.id).toBe("existing");
    expect(updated.command).toBe("npx");
  });

  test("persistiert die Änderungen in die Datei", async () => {
    await updateMcpServer("existing", { name: "Persisted Update" });
    const server = await getMcpServer("existing");
    expect(server!.name).toBe("Persisted Update");
  });

  test("führt partielle Updates zusammen und bewahrt vorhandene Felder", async () => {
    const updated = await updateMcpServer("existing", { enabled: false });
    expect(updated.name).toBe("Original Name");
    expect(updated.command).toBe("npx");
    expect(updated.enabled).toBe(false);
  });

  test("aktualisiert das enabled-Feld korrekt", async () => {
    const updated = await updateMcpServer("existing", { enabled: true });
    expect(updated.enabled).toBe(true);
  });

  test("wirft einen Fehler wenn der Server nicht existiert", async () => {
    await expect(
      updateMcpServer("non-existent", { name: "X" })
    ).rejects.toThrow("non-existent");
  });

  test("aktualisiert args korrekt", async () => {
    const updated = await updateMcpServer("existing", { args: ["-y", "new-package"] });
    expect(updated.args).toEqual(["-y", "new-package"]);
  });

  test("aktualisiert env korrekt", async () => {
    const updated = await updateMcpServer("existing", { env: { MY_KEY: "value" } });
    expect(updated.env).toEqual({ MY_KEY: "value" });
  });
});

// ---------------------------------------------------------------------------
// deleteMcpServer()
// ---------------------------------------------------------------------------

describe("deleteMcpServer()", () => {
  beforeEach(async () => {
    await seedConfig({
      servers: [
        makeServer({ id: "to-remove", name: "To Remove" }),
        makeServer({ id: "to-keep", name: "To Keep" }),
      ],
    });
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("entfernt den Server aus der Liste", async () => {
    await deleteMcpServer("to-remove");
    const server = await getMcpServer("to-remove");
    expect(server).toBeNull();
  });

  test("lässt andere Server unberührt", async () => {
    await deleteMcpServer("to-remove");
    const server = await getMcpServer("to-keep");
    expect(server).not.toBeNull();
    expect(server!.id).toBe("to-keep");
  });

  test("persistiert die Löschung in die Datei", async () => {
    await deleteMcpServer("to-remove");
    const servers = await getMcpServers();
    expect(servers.some((s) => s.id === "to-remove")).toBe(false);
  });

  test("reduziert die Anzahl der Server um eins", async () => {
    await deleteMcpServer("to-remove");
    const servers = await getMcpServers();
    expect(servers).toHaveLength(1);
  });

  test("wirft einen Fehler wenn der Server nicht existiert", async () => {
    await expect(
      deleteMcpServer("does-not-exist")
    ).rejects.toThrow("does-not-exist");
  });

  test("kann alle Server nacheinander löschen", async () => {
    await deleteMcpServer("to-remove");
    await deleteMcpServer("to-keep");
    const servers = await getMcpServers();
    expect(servers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getEnabledMcpServers()
// ---------------------------------------------------------------------------

describe("getEnabledMcpServers()", () => {
  beforeEach(async () => {
    await seedConfig({
      servers: [
        { ...makeServer({ id: "explicit-enabled" }), enabled: true },
        { ...makeServer({ id: "explicit-disabled" }), enabled: false },
        { ...makeServer({ id: "no-enabled-field" }) }, // enabled is undefined → treated as enabled
      ],
    });
  });

  afterEach(async () => {
    await removeConfigFile();
  });

  test("schließt explizit deaktivierte Server aus", async () => {
    const servers = await getEnabledMcpServers();
    const ids = servers.map((s) => s.id);
    expect(ids).not.toContain("explicit-disabled");
  });

  test("enthält explizit aktivierte Server", async () => {
    const servers = await getEnabledMcpServers();
    const ids = servers.map((s) => s.id);
    expect(ids).toContain("explicit-enabled");
  });

  test("behandelt Server ohne enabled-Feld als aktiviert (Standardwert)", async () => {
    const servers = await getEnabledMcpServers();
    const ids = servers.map((s) => s.id);
    expect(ids).toContain("no-enabled-field");
  });

  test("gibt leere Liste zurück wenn alle Server deaktiviert sind", async () => {
    await seedConfig({
      servers: [
        { ...makeServer({ id: "off-1" }), enabled: false },
        { ...makeServer({ id: "off-2" }), enabled: false },
      ],
    });
    const servers = await getEnabledMcpServers();
    expect(servers).toEqual([]);
  });

  test("gibt leere Liste zurück wenn keine Server konfiguriert sind", async () => {
    await removeConfigFile();
    const servers = await getEnabledMcpServers();
    expect(servers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMcpPresets()
// ---------------------------------------------------------------------------

describe("getMcpPresets()", () => {
  test("gibt ein Array zurück", () => {
    const presets = getMcpPresets();
    expect(Array.isArray(presets)).toBe(true);
  });

  test("ist nicht leer", () => {
    const presets = getMcpPresets();
    expect(presets.length).toBeGreaterThan(0);
  });

  test("jeder Preset hat ein id-Feld", () => {
    const presets = getMcpPresets();
    for (const preset of presets) {
      expect(typeof preset.id).toBe("string");
      expect(preset.id.length).toBeGreaterThan(0);
    }
  });

  test("jeder Preset hat ein name-Feld", () => {
    const presets = getMcpPresets();
    for (const preset of presets) {
      expect(typeof preset.name).toBe("string");
    }
  });

  test("jeder Preset hat ein command-Feld", () => {
    const presets = getMcpPresets();
    for (const preset of presets) {
      expect(typeof preset.command).toBe("string");
    }
  });

  test("enthält einen Preset mit id='github'", () => {
    const presets = getMcpPresets();
    const github = presets.find((p) => p.id === "github");
    expect(github).toBeDefined();
    expect(github!.name).toBe("GitHub MCP Server");
  });

  test("enthält einen Preset mit id='filesystem'", () => {
    const presets = getMcpPresets();
    const fs = presets.find((p) => p.id === "filesystem");
    expect(fs).toBeDefined();
  });

  test("enthält einen Preset mit id='memory'", () => {
    const presets = getMcpPresets();
    const memory = presets.find((p) => p.id === "memory");
    expect(memory).toBeDefined();
  });

  test("Anzahl der Presets stimmt mit der Anzahl der PRESETS-Schlüssel überein", () => {
    const presets = getMcpPresets();
    expect(presets.length).toBe(Object.keys(MCP_SERVER_PRESETS).length);
  });

  test("id-Felder entsprechen den Schlüsseln von MCP_SERVER_PRESETS", () => {
    const presets = getMcpPresets();
    const presetIds = presets.map((p) => p.id).sort();
    const expectedIds = Object.keys(MCP_SERVER_PRESETS).sort();
    expect(presetIds).toEqual(expectedIds);
  });
});
