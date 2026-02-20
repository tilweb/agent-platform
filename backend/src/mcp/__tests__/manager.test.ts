/**
 * Tests für backend/src/mcp/manager.ts
 *
 * McpManager ist ein High-Level-Manager für MCP-Server und Tool-Registrierung.
 * Alle externen Abhängigkeiten werden mit mock.module() gemockt — BEVOR
 * das Modul unter Test dynamisch importiert wird.
 *
 * Mocking-Strategie:
 *  - ../client      → mcpClient (connect, disconnect, disconnectAll, getConnection,
 *                                getServerStatuses, getAllTools, callTool,
 *                                refreshTools, warmCache)
 *  - ../config      → getMcpServers, getMcpServer, addMcpServer, updateMcpServer,
 *                    deleteMcpServer, getEnabledMcpServers, loadMcpConfig
 *  - ../tool        → McpToolWrapper, createMcpToolWrappers, getMcpToolName
 *  - ../../tools/registry → toolRegistry (register, unregister)
 *
 * Pfade sind relativ zur Position dieser Test-Datei in src/mcp/__tests__/.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { McpServerConfig, McpServerStatus, McpToolInfo } from "../types";

// ---------------------------------------------------------------------------
// Gemeinsamer veränderlicher Mock-Zustand
// Alle Mock-Closures lesen aus diesen Objekten, sodass Testmutationen
// sofort wirksam sind ohne Re-Import des Moduls.
// ---------------------------------------------------------------------------

/** Konfigurationsspeicher: simuliert die YAML-Konfigurationsdatei. */
const configStore: McpServerConfig[] = [];

/** Verbindungsspeicher: simuliert offene mcpClient-Verbindungen. */
const connectionStore = new Map<
  string,
  {
    status: "connected" | "connecting" | "disconnected" | "error";
    error: string | null;
    connectedAt: number | null;
    tools: McpToolInfo[];
  }
>();

/**
 * Optionale Tools, die connect() für einen bestimmten Server anlegen soll.
 * Nützlich für reconnect()-Tests, bei denen der connectionStore vorher
 * gelöscht wurde und die neue Verbindung trotzdem Tools haben soll.
 */
const connectToolsMap = new Map<string, McpToolInfo[]>();

/** Aufgezeichnete Aufrufe für Verifikations-Assertions. */
const calls = {
  connect: [] as McpServerConfig[],
  disconnect: [] as string[],
  disconnectAll: 0,
  register: [] as string[],
  unregister: [] as string[],
  warmCache: [] as McpServerConfig[],
  refreshTools: [] as string[],
  callTool: [] as { serverId: string; toolName: string; args: Record<string, any> }[],
};

/**
 * Server-IDs, für die mcpClient.connect() einen Fehler werfen soll.
 * Wird pro Test gesetzt und in resetState() geleert.
 */
const connectErrorIds = new Set<string>();

/** Fehler, der von mcpClient.callTool geworfen werden soll (null = kein Fehler). */
let callToolError: Error | null = null;
/** Rückgabewert von mcpClient.callTool. */
let callToolResult = "tool-result";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "test-server",
    name: "Test Server",
    command: "npx",
    args: ["-y", "some-mcp-package"],
    enabled: true,
    autoConnect: true,
    ...overrides,
  };
}

function makeToolInfo(overrides: Partial<McpToolInfo> = {}): McpToolInfo {
  return {
    name: "do_thing",
    description: "Does a thing",
    serverId: "test-server",
    serverName: "Test Server",
    inputSchema: {},
    ...overrides,
  };
}

/** Legt eine simulierte Verbindung im connectionStore an. */
function seedConnection(
  serverId: string,
  tools: McpToolInfo[] = [],
  status: "connected" | "disconnected" | "error" = "connected"
): void {
  connectionStore.set(serverId, {
    status,
    error: status === "error" ? "connection error" : null,
    connectedAt: status === "connected" ? Date.now() : null,
    tools,
  });
}

/** Setzt alle gemeinsamen Zustandsobjekte auf den Ausgangszustand zurück. */
function resetState(): void {
  configStore.length = 0;
  connectionStore.clear();
  connectToolsMap.clear();
  calls.connect.length = 0;
  calls.disconnect.length = 0;
  calls.disconnectAll = 0;
  calls.register.length = 0;
  calls.unregister.length = 0;
  calls.warmCache.length = 0;
  calls.refreshTools.length = 0;
  calls.callTool.length = 0;
  connectErrorIds.clear();
  callToolError = null;
  callToolResult = "tool-result";
}

// ---------------------------------------------------------------------------
// Module-Mocks — MÜSSEN vor dem dynamischen Import deklariert werden
// ---------------------------------------------------------------------------

mock.module("../client", () => ({
  mcpClient: {
    connect: async (config: McpServerConfig) => {
      calls.connect.push(config);
      if (connectErrorIds.has(config.id)) {
        throw new Error(`connect refused for ${config.id}`);
      }
      // Neue Verbindung anlegen wenn noch keine existiert.
      // Vorrang haben Tools aus connectToolsMap (für Reconnect-Tests).
      if (!connectionStore.has(config.id)) {
        const tools = connectToolsMap.get(config.id) ?? [];
        seedConnection(config.id, tools);
      }
    },
    disconnect: async (serverId: string) => {
      calls.disconnect.push(serverId);
      connectionStore.delete(serverId);
    },
    disconnectAll: async () => {
      calls.disconnectAll++;
      connectionStore.clear();
    },
    getConnection: (serverId: string) => {
      const conn = connectionStore.get(serverId);
      if (!conn) return undefined;
      return {
        status: conn.status,
        error: conn.error,
        connectedAt: conn.connectedAt,
        getTools: () => conn.tools,
      };
    },
    getServerStatuses: (): McpServerStatus[] => {
      return Array.from(connectionStore.entries()).map(([id, conn]) => ({
        id,
        name: `Server ${id}`,
        status: conn.status,
        error: conn.error ?? undefined,
        toolCount: conn.tools.length,
        connectedAt: conn.connectedAt ?? undefined,
      }));
    },
    getAllTools: (): McpToolInfo[] => {
      const tools: McpToolInfo[] = [];
      for (const conn of connectionStore.values()) {
        if (conn.status === "connected") {
          tools.push(...conn.tools);
        }
      }
      return tools;
    },
    callTool: async (
      serverId: string,
      toolName: string,
      args: Record<string, any>
    ): Promise<string> => {
      calls.callTool.push({ serverId, toolName, args });
      if (callToolError) throw callToolError;
      return callToolResult;
    },
    refreshTools: async (serverId: string): Promise<McpToolInfo[]> => {
      calls.refreshTools.push(serverId);
      const conn = connectionStore.get(serverId);
      return conn?.tools ?? [];
    },
    warmCache: async (config: McpServerConfig) => {
      calls.warmCache.push(config);
    },
  },
}));

mock.module("../config", () => ({
  loadMcpConfig: async () => ({ servers: [...configStore] }),
  getMcpServers: async () => [...configStore],
  getMcpServer: async (id: string) => configStore.find((s) => s.id === id) ?? null,
  addMcpServer: async (config: McpServerConfig) => {
    configStore.push(config);
    return config;
  },
  updateMcpServer: async (id: string, updates: Partial<McpServerConfig>) => {
    const idx = configStore.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Server "${id}" not found`);
    const updated = { ...configStore[idx]!, ...updates, id };
    configStore[idx] = updated;
    return updated;
  },
  deleteMcpServer: async (id: string) => {
    const idx = configStore.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Server "${id}" not found`);
    configStore.splice(idx, 1);
  },
  getEnabledMcpServers: async () => configStore.filter((s) => s.enabled !== false),
}));

mock.module("../tool", () => ({
  getMcpToolName: (serverId: string, toolName: string) => `mcp_${serverId}_${toolName}`,
  createMcpToolWrappers: (tools: McpToolInfo[]) =>
    tools.map((t) => ({
      name: `mcp_${t.serverId}_${t.name}`,
      type: "mcp" as const,
    })),
  McpToolWrapper: class MockMcpToolWrapper {
    name: string;
    type = "mcp" as const;
    constructor(info: McpToolInfo) {
      this.name = `mcp_${info.serverId}_${info.name}`;
    }
  },
}));

// Pfad relativ zur Test-Datei in src/mcp/__tests__/:
// manager.ts importiert '../tools/registry' (von src/mcp/ → src/tools/registry)
// Test-Datei liegt in src/mcp/__tests__/ → relativer Pfad = ../../tools/registry
mock.module("../../tools/registry", () => ({
  toolRegistry: {
    register: (tool: { name: string }) => {
      calls.register.push(tool.name);
    },
    unregister: (name: string) => {
      calls.unregister.push(name);
    },
  },
}));

// ---------------------------------------------------------------------------
// Dynamischer Import NACH den Mocks
// ---------------------------------------------------------------------------

const { mcpManager } = await import("../manager");

// ---------------------------------------------------------------------------
// Manager-Reset: Singleton-Zustand zwischen Tests zurücksetzen.
// shutdown() setzt initialized=false und leert registeredTools intern.
// ---------------------------------------------------------------------------

async function resetManager(): Promise<void> {
  try {
    await mcpManager.shutdown();
  } catch {
    // Fehler beim Shutdown ignorieren
  }
  resetState();
}

// ---------------------------------------------------------------------------
// initialize()
// ---------------------------------------------------------------------------

describe("McpManager.initialize()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("verbindet sich mit allen aktivierten Servern die autoConnect=true haben", async () => {
    configStore.push(makeConfig({ id: "srv-1", autoConnect: true }));
    configStore.push(makeConfig({ id: "srv-2", autoConnect: true }));

    await mcpManager.initialize();

    const connectedIds = calls.connect.map((c) => c.id);
    expect(connectedIds).toContain("srv-1");
    expect(connectedIds).toContain("srv-2");
  });

  test("überspringt Server mit autoConnect=false", async () => {
    configStore.push(makeConfig({ id: "no-auto", autoConnect: false }));
    configStore.push(makeConfig({ id: "with-auto", autoConnect: true }));

    await mcpManager.initialize();

    const connectedIds = calls.connect.map((c) => c.id);
    expect(connectedIds).not.toContain("no-auto");
    expect(connectedIds).toContain("with-auto");
  });

  test("überspringt deaktivierte Server (enabled=false)", async () => {
    configStore.push(makeConfig({ id: "disabled-srv", enabled: false }));
    configStore.push(makeConfig({ id: "enabled-srv", enabled: true }));

    await mcpManager.initialize();

    const connectedIds = calls.connect.map((c) => c.id);
    expect(connectedIds).not.toContain("disabled-srv");
    expect(connectedIds).toContain("enabled-srv");
  });

  test("ist idempotent — zweiter Aufruf löst keine weiteren connect-Aufrufe aus", async () => {
    configStore.push(makeConfig({ id: "test-server" }));

    await mcpManager.initialize();
    const connectCountAfterFirst = calls.connect.length;

    await mcpManager.initialize();
    expect(calls.connect.length).toBe(connectCountAfterFirst);
  });

  test("fährt fort wenn ein Server einen Verbindungsfehler wirft", async () => {
    configStore.push(makeConfig({ id: "failing-server" }));
    configStore.push(makeConfig({ id: "ok-server" }));
    connectErrorIds.add("failing-server");

    await expect(mcpManager.initialize()).resolves.toBeUndefined();

    // ok-server sollte trotzdem verbunden worden sein
    const connectedIds = calls.connect.map((c) => c.id);
    expect(connectedIds).toContain("ok-server");
    expect(connectedIds).toContain("failing-server");
  });

  test("initialisiert auch dann wenn keine Server konfiguriert sind", async () => {
    await expect(mcpManager.initialize()).resolves.toBeUndefined();
  });

  test("verbindet enabled-Server ohne autoConnect-Angabe (autoConnect=undefined gilt als true)", async () => {
    const cfg = makeConfig({ id: "implicit-auto" });
    delete (cfg as any).autoConnect; // autoConnect entfernen → undefined
    configStore.push(cfg);

    await mcpManager.initialize();

    const connectedIds = calls.connect.map((c) => c.id);
    expect(connectedIds).toContain("implicit-auto");
  });
});

// ---------------------------------------------------------------------------
// shutdown()
// ---------------------------------------------------------------------------

describe("McpManager.shutdown()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("ruft mcpClient.disconnectAll() auf", async () => {
    await mcpManager.shutdown();
    expect(calls.disconnectAll).toBeGreaterThan(0);
  });

  test("setzt initialized-Flag zurück sodass initialize() erneut ausgeführt werden kann", async () => {
    configStore.push(makeConfig({ id: "srv-reinit" }));
    await mcpManager.initialize();

    await mcpManager.shutdown();
    resetState();

    configStore.push(makeConfig({ id: "srv-reinit" }));
    await mcpManager.initialize();

    expect(calls.connect.some((c) => c.id === "srv-reinit")).toBe(true);
  });

  test("de-registriert alle vorher registrierten Tools", async () => {
    seedConnection("shutdown-srv", [makeToolInfo({ serverId: "shutdown-srv", name: "my_tool" })]);
    await mcpManager.registerToolsFromServer("shutdown-srv");
    calls.unregister.length = 0;

    await mcpManager.shutdown();

    expect(calls.unregister).toContain("mcp_shutdown-srv_my_tool");
  });

  test("kann auch aufgerufen werden wenn kein Tool registriert ist", async () => {
    await expect(mcpManager.shutdown()).resolves.toBeUndefined();
  });

  test("de-registriert Tools aller registrierten Server", async () => {
    seedConnection("s1", [makeToolInfo({ serverId: "s1", name: "t1" })]);
    seedConnection("s2", [makeToolInfo({ serverId: "s2", name: "t2" })]);
    await mcpManager.registerToolsFromServer("s1");
    await mcpManager.registerToolsFromServer("s2");
    calls.unregister.length = 0;

    await mcpManager.shutdown();

    expect(calls.unregister).toContain("mcp_s1_t1");
    expect(calls.unregister).toContain("mcp_s2_t2");
  });
});

// ---------------------------------------------------------------------------
// connectServer()
// ---------------------------------------------------------------------------

describe("McpManager.connectServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("wirft einen Fehler wenn der Server nicht konfiguriert ist", async () => {
    await expect(mcpManager.connectServer("unknown-id")).rejects.toThrow("unknown-id");
  });

  test("ruft mcpClient.connect() mit der Server-Konfiguration auf", async () => {
    configStore.push(makeConfig({ id: "my-server" }));

    await mcpManager.connectServer("my-server");

    expect(calls.connect.some((c) => c.id === "my-server")).toBe(true);
  });

  test("registriert Tools nach erfolgreichem Verbinden", async () => {
    configStore.push(makeConfig({ id: "tool-server" }));
    seedConnection("tool-server", [makeToolInfo({ serverId: "tool-server", name: "my_tool" })]);

    await mcpManager.connectServer("tool-server");

    expect(calls.register).toContain("mcp_tool-server_my_tool");
  });

  test("registriert keine Tools wenn der Server nach dem connect nicht 'connected' ist", async () => {
    configStore.push(makeConfig({ id: "error-server" }));
    // Verbindung mit Status 'error' anlegen; connect() legt KEINE neue Verbindung
    // an, weil connectionStore.has("error-server") bereits true ist
    seedConnection("error-server", [makeToolInfo()], "error");

    await mcpManager.connectServer("error-server");

    // Der Status ist 'error', also werden keine Tools registriert
    expect(calls.register).toHaveLength(0);
  });

  test("übergibt die korrekte Server-Konfiguration an mcpClient.connect()", async () => {
    const cfg = makeConfig({ id: "cfg-check-srv", name: "Config Check", command: "bunx" });
    configStore.push(cfg);

    await mcpManager.connectServer("cfg-check-srv");

    const connectCall = calls.connect.find((c) => c.id === "cfg-check-srv");
    expect(connectCall).toBeDefined();
    expect(connectCall!.name).toBe("Config Check");
    expect(connectCall!.command).toBe("bunx");
  });
});

// ---------------------------------------------------------------------------
// disconnectServer()
// ---------------------------------------------------------------------------

describe("McpManager.disconnectServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("ruft mcpClient.disconnect() mit der Server-ID auf", async () => {
    await mcpManager.disconnectServer("any-server");
    expect(calls.disconnect).toContain("any-server");
  });

  test("de-registriert vorher registrierte Tools des Servers", async () => {
    seedConnection("srv-a", [makeToolInfo({ serverId: "srv-a", name: "tool_x" })]);
    await mcpManager.registerToolsFromServer("srv-a");
    calls.unregister.length = 0;

    await mcpManager.disconnectServer("srv-a");

    expect(calls.unregister).toContain("mcp_srv-a_tool_x");
  });

  test("ist idempotent — mehrfacher Aufruf wirft keinen Fehler", async () => {
    await expect(mcpManager.disconnectServer("not-connected")).resolves.toBeUndefined();
    await expect(mcpManager.disconnectServer("not-connected")).resolves.toBeUndefined();
  });

  test("de-registriert alle Tools des Servers, nicht nur einzelne", async () => {
    seedConnection("multi-tool-srv", [
      makeToolInfo({ serverId: "multi-tool-srv", name: "alpha" }),
      makeToolInfo({ serverId: "multi-tool-srv", name: "beta" }),
    ]);
    await mcpManager.registerToolsFromServer("multi-tool-srv");
    calls.unregister.length = 0;

    await mcpManager.disconnectServer("multi-tool-srv");

    expect(calls.unregister).toContain("mcp_multi-tool-srv_alpha");
    expect(calls.unregister).toContain("mcp_multi-tool-srv_beta");
  });
});

// ---------------------------------------------------------------------------
// reconnectServer()
// ---------------------------------------------------------------------------

describe("McpManager.reconnectServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("wirft einen Fehler wenn der Server nicht konfiguriert ist", async () => {
    await expect(mcpManager.reconnectServer("ghost-server")).rejects.toThrow("ghost-server");
  });

  test("trennt die Verbindung zuerst und verbindet dann neu", async () => {
    configStore.push(makeConfig({ id: "restart-server" }));
    seedConnection("restart-server", []);

    await mcpManager.reconnectServer("restart-server");

    expect(calls.disconnect).toContain("restart-server");
    expect(calls.connect.some((c) => c.id === "restart-server")).toBe(true);
  });

  test("registriert Tools nach dem Neuverbinden", async () => {
    // connectToolsMap stellt sicher, dass die NEUE (nach disconnect angelegte)
    // Verbindung die erwarteten Tools enthält — weil connect() den Store leert.
    const tools = [makeToolInfo({ serverId: "reconnect-srv", name: "reload_tool" })];
    configStore.push(makeConfig({ id: "reconnect-srv" }));
    connectToolsMap.set("reconnect-srv", tools);

    await mcpManager.reconnectServer("reconnect-srv");

    expect(calls.register).toContain("mcp_reconnect-srv_reload_tool");
  });

  test("de-registriert alte Tools vor dem Neuverbinden", async () => {
    configStore.push(makeConfig({ id: "rc-old-srv" }));
    seedConnection("rc-old-srv", [makeToolInfo({ serverId: "rc-old-srv", name: "old_tool" })]);
    await mcpManager.registerToolsFromServer("rc-old-srv");
    calls.unregister.length = 0;

    await mcpManager.reconnectServer("rc-old-srv");

    expect(calls.unregister).toContain("mcp_rc-old-srv_old_tool");
  });
});

// ---------------------------------------------------------------------------
// registerToolsFromServer()
// ---------------------------------------------------------------------------

describe("McpManager.registerToolsFromServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("tut nichts wenn keine Verbindung existiert", async () => {
    await mcpManager.registerToolsFromServer("missing-server");
    expect(calls.register).toHaveLength(0);
  });

  test("tut nichts wenn die Verbindung nicht 'connected' ist", async () => {
    seedConnection("disco-server", [makeToolInfo()], "disconnected");
    await mcpManager.registerToolsFromServer("disco-server");
    expect(calls.register).toHaveLength(0);
  });

  test("registriert alle Tools des Servers im toolRegistry", async () => {
    seedConnection("reg-server", [
      makeToolInfo({ serverId: "reg-server", name: "tool_a" }),
      makeToolInfo({ serverId: "reg-server", name: "tool_b" }),
    ]);

    await mcpManager.registerToolsFromServer("reg-server");

    expect(calls.register).toContain("mcp_reg-server_tool_a");
    expect(calls.register).toContain("mcp_reg-server_tool_b");
  });

  test("merkt sich die registrierten Tool-Namen je Server für spätere De-Registrierung", async () => {
    seedConnection("mem-server", [makeToolInfo({ serverId: "mem-server", name: "noted_tool" })]);

    await mcpManager.registerToolsFromServer("mem-server");
    calls.unregister.length = 0;

    // Beim späteren Disconnect müssen genau diese Tools de-registriert werden
    await mcpManager.disconnectServer("mem-server");
    expect(calls.unregister).toContain("mcp_mem-server_noted_tool");
  });

  test("registriert kein Tool wenn der Server keine Tools hat", async () => {
    seedConnection("empty-server", []);
    await mcpManager.registerToolsFromServer("empty-server");
    expect(calls.register).toHaveLength(0);
  });

  test("tut nichts wenn die Verbindung den Status 'error' hat", async () => {
    seedConnection("error-server", [makeToolInfo()], "error");
    await mcpManager.registerToolsFromServer("error-server");
    expect(calls.register).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// unregisterToolsFromServer()
// ---------------------------------------------------------------------------

describe("McpManager.unregisterToolsFromServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("tut nichts wenn für den Server keine Tools registriert sind", async () => {
    await mcpManager.unregisterToolsFromServer("no-tools-server");
    expect(calls.unregister).toHaveLength(0);
  });

  test("de-registriert alle Tools eines Servers", async () => {
    seedConnection("unreg-server", [
      makeToolInfo({ serverId: "unreg-server", name: "alpha" }),
      makeToolInfo({ serverId: "unreg-server", name: "beta" }),
    ]);
    await mcpManager.registerToolsFromServer("unreg-server");
    calls.unregister.length = 0;

    await mcpManager.unregisterToolsFromServer("unreg-server");

    expect(calls.unregister).toContain("mcp_unreg-server_alpha");
    expect(calls.unregister).toContain("mcp_unreg-server_beta");
  });

  test("entfernt den Server-Eintrag aus der internen Tracking-Map sodass kein zweiter Aufruf unregister erzeugt", async () => {
    seedConnection("track-server", [makeToolInfo({ serverId: "track-server", name: "tracked" })]);
    await mcpManager.registerToolsFromServer("track-server");

    await mcpManager.unregisterToolsFromServer("track-server");

    calls.unregister.length = 0;
    await mcpManager.unregisterToolsFromServer("track-server");
    expect(calls.unregister).toHaveLength(0);
  });

  test("de-registriert nur Tools des angegebenen Servers, nicht anderer Server", async () => {
    seedConnection("srv-keep", [makeToolInfo({ serverId: "srv-keep", name: "keep_tool" })]);
    seedConnection("srv-remove", [makeToolInfo({ serverId: "srv-remove", name: "rm_tool" })]);
    await mcpManager.registerToolsFromServer("srv-keep");
    await mcpManager.registerToolsFromServer("srv-remove");
    calls.unregister.length = 0;

    await mcpManager.unregisterToolsFromServer("srv-remove");

    expect(calls.unregister).toContain("mcp_srv-remove_rm_tool");
    expect(calls.unregister).not.toContain("mcp_srv-keep_keep_tool");
  });
});

// ---------------------------------------------------------------------------
// refreshServerTools()
// ---------------------------------------------------------------------------

describe("McpManager.refreshServerTools()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("ruft mcpClient.refreshTools() für den angegebenen Server auf", async () => {
    seedConnection("refresh-server", []);
    await mcpManager.refreshServerTools("refresh-server");
    expect(calls.refreshTools).toContain("refresh-server");
  });

  test("de-registriert bestehende Tools vor dem Refresh", async () => {
    seedConnection("stale-server", [makeToolInfo({ serverId: "stale-server", name: "old_tool" })]);
    await mcpManager.registerToolsFromServer("stale-server");
    calls.unregister.length = 0;

    await mcpManager.refreshServerTools("stale-server");

    expect(calls.unregister).toContain("mcp_stale-server_old_tool");
  });

  test("registriert Tools nach dem Refresh neu", async () => {
    seedConnection("fresh-server", [makeToolInfo({ serverId: "fresh-server", name: "new_tool" })]);

    await mcpManager.refreshServerTools("fresh-server");

    expect(calls.register).toContain("mcp_fresh-server_new_tool");
  });

  test("gibt die Tool-Liste des Servers als Array zurück", async () => {
    const tools = [makeToolInfo({ serverId: "ret-server", name: "ret_tool" })];
    seedConnection("ret-server", tools);

    const result = await mcpManager.refreshServerTools("ret-server");

    expect(Array.isArray(result)).toBe(true);
  });

  test("runde-Reise: unregister dann register ohne Unterbrechung", async () => {
    seedConnection("rr-server", [makeToolInfo({ serverId: "rr-server", name: "rr_tool" })]);
    await mcpManager.registerToolsFromServer("rr-server");
    const unregBefore = calls.unregister.length;
    const regBefore = calls.register.length;

    await mcpManager.refreshServerTools("rr-server");

    expect(calls.unregister.length).toBeGreaterThan(unregBefore);
    expect(calls.register.length).toBeGreaterThan(regBefore);
  });
});

// ---------------------------------------------------------------------------
// getServers()
// ---------------------------------------------------------------------------

describe("McpManager.getServers()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt ein leeres Array zurück wenn keine Server konfiguriert sind", async () => {
    const servers = await mcpManager.getServers();
    expect(servers).toHaveLength(0);
  });

  test("gibt alle konfigurierten Server zurück", async () => {
    configStore.push(makeConfig({ id: "sv-1" }));
    configStore.push(makeConfig({ id: "sv-2" }));

    const servers = await mcpManager.getServers();
    expect(servers).toHaveLength(2);
    const ids = servers.map((s) => s.id);
    expect(ids).toContain("sv-1");
    expect(ids).toContain("sv-2");
  });

  test("setzt status='disconnected' für Server ohne aktive Verbindung", async () => {
    configStore.push(makeConfig({ id: "offline-srv" }));

    const servers = await mcpManager.getServers();
    expect(servers[0]!.status).toBe("disconnected");
  });

  test("setzt status='connected' für Server mit aktiver Verbindung", async () => {
    configStore.push(makeConfig({ id: "online-srv" }));
    seedConnection("online-srv", []);

    const servers = await mcpManager.getServers();
    const srv = servers.find((s) => s.id === "online-srv")!;
    expect(srv.status).toBe("connected");
  });

  test("setzt toolCount=0 für Server ohne aktive Verbindung", async () => {
    configStore.push(makeConfig({ id: "notool-srv" }));

    const servers = await mcpManager.getServers();
    expect(servers[0]!.toolCount).toBe(0);
  });

  test("setzt toolCount auf Anzahl der verfügbaren Tools eines verbundenen Servers", async () => {
    configStore.push(makeConfig({ id: "counted-srv" }));
    seedConnection("counted-srv", [
      makeToolInfo({ serverId: "counted-srv", name: "t1" }),
      makeToolInfo({ serverId: "counted-srv", name: "t2" }),
    ]);

    const servers = await mcpManager.getServers();
    const srv = servers.find((s) => s.id === "counted-srv")!;
    expect(srv.toolCount).toBe(2);
  });

  test("gibt die Konfigurationsdaten (name, command, args) unverändert zurück", async () => {
    configStore.push(makeConfig({ id: "cfg-srv", name: "My Server", command: "npx" }));

    const servers = await mcpManager.getServers();
    const srv = servers[0]!;
    expect(srv.name).toBe("My Server");
    expect(srv.command).toBe("npx");
  });

  test("gibt sowohl aktivierte als auch deaktivierte Server zurück", async () => {
    configStore.push(makeConfig({ id: "on-srv", enabled: true }));
    configStore.push(makeConfig({ id: "off-srv", enabled: false }));

    const servers = await mcpManager.getServers();
    const ids = servers.map((s) => s.id);
    expect(ids).toContain("on-srv");
    expect(ids).toContain("off-srv");
  });
});

// ---------------------------------------------------------------------------
// getServer()
// ---------------------------------------------------------------------------

describe("McpManager.getServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt null zurück wenn der Server nicht konfiguriert ist", async () => {
    const result = await mcpManager.getServer("ghost");
    expect(result).toBeNull();
  });

  test("gibt das kombinierte Objekt aus Konfiguration und Status zurück", async () => {
    configStore.push(makeConfig({ id: "combo-srv", name: "Combo Server" }));
    seedConnection("combo-srv", []);

    const result = await mcpManager.getServer("combo-srv");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("combo-srv");
    expect(result!.name).toBe("Combo Server");
    expect(result!.status).toBe("connected");
  });

  test("setzt status='disconnected' wenn keine Verbindung vorhanden ist", async () => {
    configStore.push(makeConfig({ id: "no-conn-srv" }));

    const result = await mcpManager.getServer("no-conn-srv");

    expect(result!.status).toBe("disconnected");
  });

  test("setzt toolCount auf die Anzahl der Tools der Verbindung", async () => {
    configStore.push(makeConfig({ id: "tc-srv" }));
    seedConnection("tc-srv", [
      makeToolInfo({ serverId: "tc-srv", name: "a" }),
      makeToolInfo({ serverId: "tc-srv", name: "b" }),
      makeToolInfo({ serverId: "tc-srv", name: "c" }),
    ]);

    const result = await mcpManager.getServer("tc-srv");
    expect(result!.toolCount).toBe(3);
  });

  test("setzt toolCount=0 wenn keine Verbindung vorhanden ist", async () => {
    configStore.push(makeConfig({ id: "zero-srv" }));

    const result = await mcpManager.getServer("zero-srv");
    expect(result!.toolCount).toBe(0);
  });

  test("setzt connectedAt wenn die Verbindung verbunden ist", async () => {
    configStore.push(makeConfig({ id: "time-srv" }));
    const ts = Date.now();
    connectionStore.set("time-srv", {
      status: "connected",
      error: null,
      connectedAt: ts,
      tools: [],
    });

    const result = await mcpManager.getServer("time-srv");
    expect(result!.connectedAt).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// addServer()
// ---------------------------------------------------------------------------

describe("McpManager.addServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt die gespeicherte Server-Konfiguration zurück", async () => {
    const cfg = makeConfig({ id: "new-srv" });
    const result = await mcpManager.addServer(cfg);
    expect(result.id).toBe("new-srv");
  });

  test("persistiert den Server in den Config-Speicher", async () => {
    await mcpManager.addServer(makeConfig({ id: "persist-srv" }));
    expect(configStore.some((s) => s.id === "persist-srv")).toBe(true);
  });

  test("verbindet sich automatisch wenn enabled=true und autoConnect=true", async () => {
    const cfg = makeConfig({ id: "auto-conn-srv", enabled: true, autoConnect: true });

    await mcpManager.addServer(cfg);

    expect(calls.connect.some((c) => c.id === "auto-conn-srv")).toBe(true);
  });

  test("verbindet sich NICHT automatisch wenn autoConnect=false", async () => {
    const cfg = makeConfig({ id: "no-auto-srv", enabled: true, autoConnect: false });

    await mcpManager.addServer(cfg);

    expect(calls.connect.some((c) => c.id === "no-auto-srv")).toBe(false);
  });

  test("verbindet sich NICHT automatisch wenn enabled=false", async () => {
    const cfg = makeConfig({ id: "disabled-add-srv", enabled: false, autoConnect: true });

    await mcpManager.addServer(cfg);

    expect(calls.connect.some((c) => c.id === "disabled-add-srv")).toBe(false);
  });

  test("ruft warmCache() auf wenn autoConnect=false", async () => {
    const cfg = makeConfig({ id: "warm-srv", enabled: true, autoConnect: false });

    await mcpManager.addServer(cfg);

    expect(calls.warmCache.some((c) => c.id === "warm-srv")).toBe(true);
  });

  test("ruft warmCache() auf wenn enabled=false", async () => {
    const cfg = makeConfig({ id: "warm-dis-srv", enabled: false, autoConnect: true });

    await mcpManager.addServer(cfg);

    expect(calls.warmCache.some((c) => c.id === "warm-dis-srv")).toBe(true);
  });

  test("wirft keinen Fehler wenn auto-connect fehlschlägt", async () => {
    const cfg = makeConfig({ id: "fail-auto-srv", enabled: true, autoConnect: true });
    connectErrorIds.add("fail-auto-srv");

    await expect(mcpManager.addServer(cfg)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updateServer()
// ---------------------------------------------------------------------------

describe("McpManager.updateServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt die aktualisierte Konfiguration zurück", async () => {
    configStore.push(makeConfig({ id: "upd-srv", name: "Old Name" }));

    const result = await mcpManager.updateServer("upd-srv", { name: "New Name" });

    expect(result.name).toBe("New Name");
    expect(result.id).toBe("upd-srv");
  });

  test("trennt die Verbindung wenn der Server verbunden war", async () => {
    configStore.push(makeConfig({ id: "conn-upd-srv" }));
    seedConnection("conn-upd-srv", []);

    await mcpManager.updateServer("conn-upd-srv", { name: "Updated" });

    expect(calls.disconnect).toContain("conn-upd-srv");
  });

  test("verbindet nach dem Update neu wenn der Server vorher verbunden war und enabled=true", async () => {
    configStore.push(makeConfig({ id: "reconnect-upd-srv", enabled: true }));
    seedConnection("reconnect-upd-srv", []);

    await mcpManager.updateServer("reconnect-upd-srv", { name: "Updated" });

    expect(calls.connect.some((c) => c.id === "reconnect-upd-srv")).toBe(true);
  });

  test("verbindet NICHT neu wenn der Server nicht verbunden war", async () => {
    configStore.push(makeConfig({ id: "idle-upd-srv" }));

    await mcpManager.updateServer("idle-upd-srv", { name: "Changed" });

    expect(calls.connect.some((c) => c.id === "idle-upd-srv")).toBe(false);
  });

  test("verbindet NICHT neu wenn updated.enabled=false gesetzt wird", async () => {
    configStore.push(makeConfig({ id: "disable-upd-srv", enabled: true }));
    seedConnection("disable-upd-srv", []);

    await mcpManager.updateServer("disable-upd-srv", { enabled: false });

    expect(calls.connect.some((c) => c.id === "disable-upd-srv")).toBe(false);
  });

  test("ruft warmCache() auf wenn der Server nicht verbunden war", async () => {
    configStore.push(makeConfig({ id: "warm-upd-srv" }));

    await mcpManager.updateServer("warm-upd-srv", { name: "Warmed" });

    expect(calls.warmCache.some((c) => c.id === "warm-upd-srv")).toBe(true);
  });

  test("wirft keinen Fehler wenn Reconnect fehlschlägt", async () => {
    configStore.push(makeConfig({ id: "fail-reconnect-srv", enabled: true }));
    seedConnection("fail-reconnect-srv", []);
    connectErrorIds.add("fail-reconnect-srv");

    await expect(
      mcpManager.updateServer("fail-reconnect-srv", { name: "Updated" })
    ).resolves.toBeDefined();
  });

  test("aktualisiert den Config-Speicher mit dem neuen Namen", async () => {
    configStore.push(makeConfig({ id: "name-upd-srv", name: "Original" }));

    await mcpManager.updateServer("name-upd-srv", { name: "Updated" });

    const cfg = configStore.find((s) => s.id === "name-upd-srv");
    expect(cfg!.name).toBe("Updated");
  });
});

// ---------------------------------------------------------------------------
// deleteServer()
// ---------------------------------------------------------------------------

describe("McpManager.deleteServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("entfernt den Server aus dem Config-Speicher", async () => {
    configStore.push(makeConfig({ id: "del-srv" }));

    await mcpManager.deleteServer("del-srv");

    expect(configStore.some((s) => s.id === "del-srv")).toBe(false);
  });

  test("trennt zuerst die Verbindung bevor der Server gelöscht wird", async () => {
    configStore.push(makeConfig({ id: "dc-del-srv" }));
    seedConnection("dc-del-srv", []);

    await mcpManager.deleteServer("dc-del-srv");

    expect(calls.disconnect).toContain("dc-del-srv");
  });

  test("de-registriert Tools des Servers beim Löschen", async () => {
    configStore.push(makeConfig({ id: "tool-del-srv" }));
    seedConnection("tool-del-srv", [
      makeToolInfo({ serverId: "tool-del-srv", name: "del_tool" }),
    ]);
    await mcpManager.registerToolsFromServer("tool-del-srv");
    calls.unregister.length = 0;

    await mcpManager.deleteServer("tool-del-srv");

    expect(calls.unregister).toContain("mcp_tool-del-srv_del_tool");
  });

  test("wirft einen Fehler wenn der Server nicht existiert", async () => {
    await expect(mcpManager.deleteServer("nonexistent")).rejects.toThrow();
  });

  test("lässt andere Server unberührt", async () => {
    configStore.push(makeConfig({ id: "del-me" }));
    configStore.push(makeConfig({ id: "keep-me" }));

    await mcpManager.deleteServer("del-me");

    expect(configStore.some((s) => s.id === "keep-me")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleServer()
// ---------------------------------------------------------------------------

describe("McpManager.toggleServer()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("setzt enabled=true und verbindet dann den Server", async () => {
    configStore.push(makeConfig({ id: "toggle-on-srv", enabled: false }));

    await mcpManager.toggleServer("toggle-on-srv", true);

    const cfg = configStore.find((s) => s.id === "toggle-on-srv")!;
    expect(cfg.enabled).toBe(true);
    expect(calls.connect.some((c) => c.id === "toggle-on-srv")).toBe(true);
  });

  test("setzt enabled=false und trennt dann die Verbindung", async () => {
    configStore.push(makeConfig({ id: "toggle-off-srv", enabled: true }));
    seedConnection("toggle-off-srv", []);

    await mcpManager.toggleServer("toggle-off-srv", false);

    const cfg = configStore.find((s) => s.id === "toggle-off-srv")!;
    expect(cfg.enabled).toBe(false);
    expect(calls.disconnect).toContain("toggle-off-srv");
  });

  test("delegiert das Update an updateServer()", async () => {
    configStore.push(makeConfig({ id: "toggle-delegate-srv", enabled: true }));
    seedConnection("toggle-delegate-srv", []);

    await mcpManager.toggleServer("toggle-delegate-srv", false);

    // updateServer() wird im toggleServer() aufgerufen — das zeigt sich darin,
    // dass der configStore aktualisiert wurde
    const cfg = configStore.find((s) => s.id === "toggle-delegate-srv")!;
    expect(cfg.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAllTools()
// ---------------------------------------------------------------------------

describe("McpManager.getAllTools()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt ein leeres Array zurück wenn keine Verbindungen existieren", () => {
    const tools = mcpManager.getAllTools();
    expect(tools).toHaveLength(0);
  });

  test("gibt Tools aller verbundenen Server zurück", () => {
    seedConnection("all-tools-a", [makeToolInfo({ serverId: "all-tools-a", name: "t1" })]);
    seedConnection("all-tools-b", [makeToolInfo({ serverId: "all-tools-b", name: "t2" })]);

    const tools = mcpManager.getAllTools();
    expect(tools.some((t) => t.name === "t1")).toBe(true);
    expect(tools.some((t) => t.name === "t2")).toBe(true);
  });

  test("schließt Tools von nicht verbundenen Servern aus", () => {
    seedConnection("vis-srv", [makeToolInfo({ serverId: "vis-srv", name: "visible" })]);
    // Disconnected-Server mit Tool manuell anlegen
    connectionStore.set("hidden-srv", {
      status: "disconnected",
      error: null,
      connectedAt: null,
      tools: [makeToolInfo({ serverId: "hidden-srv", name: "hidden" })],
    });

    const tools = mcpManager.getAllTools();
    expect(tools.some((t) => t.name === "visible")).toBe(true);
    expect(tools.some((t) => t.name === "hidden")).toBe(false);
  });

  test("gibt alle Tools von mehreren verbundenen Servern zusammen zurück", () => {
    seedConnection("src1", [
      makeToolInfo({ serverId: "src1", name: "a" }),
      makeToolInfo({ serverId: "src1", name: "b" }),
    ]);
    seedConnection("src2", [
      makeToolInfo({ serverId: "src2", name: "c" }),
    ]);

    const tools = mcpManager.getAllTools();
    expect(tools.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getServerTools()
// ---------------------------------------------------------------------------

describe("McpManager.getServerTools()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt ein leeres Array zurück wenn keine Verbindung existiert", () => {
    const tools = mcpManager.getServerTools("missing");
    expect(tools).toHaveLength(0);
  });

  test("gibt die Tools des angegebenen Servers zurück", () => {
    seedConnection("tool-srv-a", [
      makeToolInfo({ serverId: "tool-srv-a", name: "tool1" }),
      makeToolInfo({ serverId: "tool-srv-a", name: "tool2" }),
    ]);

    const tools = mcpManager.getServerTools("tool-srv-a");
    expect(tools).toHaveLength(2);
    expect(tools.some((t) => t.name === "tool1")).toBe(true);
    expect(tools.some((t) => t.name === "tool2")).toBe(true);
  });

  test("gibt nur Tools des angegebenen Servers zurück, nicht anderer Server", () => {
    seedConnection("srv-x", [makeToolInfo({ serverId: "srv-x", name: "x_tool" })]);
    seedConnection("srv-y", [makeToolInfo({ serverId: "srv-y", name: "y_tool" })]);

    const tools = mcpManager.getServerTools("srv-x");
    expect(tools.some((t) => t.name === "y_tool")).toBe(false);
  });

  test("gibt auch Tools von nicht verbundenen Servern zurück wenn die Verbindung existiert", () => {
    connectionStore.set("dc-tool-srv", {
      status: "disconnected",
      error: null,
      connectedAt: null,
      tools: [makeToolInfo({ serverId: "dc-tool-srv", name: "dc_tool" })],
    });

    const tools = mcpManager.getServerTools("dc-tool-srv");
    expect(tools.some((t) => t.name === "dc_tool")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// testTool()
// ---------------------------------------------------------------------------

describe("McpManager.testTool()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("gibt success=true und das Ergebnis zurück wenn callTool erfolgreich ist", async () => {
    callToolResult = "hello from tool";

    const result = await mcpManager.testTool("any-server", "my_tool", { input: "x" });

    expect(result.success).toBe(true);
    expect(result.result).toBe("hello from tool");
    expect(result.error).toBeUndefined();
  });

  test("gibt success=false und die Fehlermeldung zurück wenn callTool einen Fehler wirft", async () => {
    callToolError = new Error("tool exploded");

    const result = await mcpManager.testTool("any-server", "bad_tool", {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("tool exploded");
    expect(result.result).toBeUndefined();
  });

  test("misst die Ausführungsdauer und gibt sie als duration zurück", async () => {
    const result = await mcpManager.testTool("any-server", "timed_tool", {});

    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test("gibt duration auch bei Fehler zurück", async () => {
    callToolError = new Error("oops");

    const result = await mcpManager.testTool("any-server", "err_tool", {});

    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test("übergibt serverId, toolName und args an mcpClient.callTool", async () => {
    await mcpManager.testTool("my-srv", "my_fn", { key: "value" });

    const lastCall = calls.callTool[calls.callTool.length - 1]!;
    expect(lastCall.serverId).toBe("my-srv");
    expect(lastCall.toolName).toBe("my_fn");
    expect(lastCall.args).toEqual({ key: "value" });
  });

  test("wirft selbst keinen Fehler auch wenn callTool fehlschlägt", async () => {
    callToolError = new Error("internal error");

    await expect(mcpManager.testTool("srv", "t", {})).resolves.toBeDefined();
  });

  test("duration ist eine nicht-negative Zahl (Millisekunden)", async () => {
    const result = await mcpManager.testTool("srv", "tool", {});

    expect(result.duration >= 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// callTool()
// ---------------------------------------------------------------------------

describe("McpManager.callTool()", () => {
  beforeEach(async () => {
    await resetManager();
  });

  test("delegiert den Aufruf an mcpClient.callTool und gibt das Ergebnis zurück", async () => {
    callToolResult = "direct result";

    const result = await mcpManager.callTool("my-server", "my_tool", { a: 1 });

    expect(result).toBe("direct result");
  });

  test("wirft den Fehler weiter wenn mcpClient.callTool fehlschlägt", async () => {
    callToolError = new Error("call failed");

    await expect(mcpManager.callTool("srv", "tool", {})).rejects.toThrow("call failed");
  });

  test("übergibt alle Argumente korrekt an mcpClient.callTool", async () => {
    await mcpManager.callTool("target-srv", "target_fn", { x: 42, y: "hello" });

    const lastCall = calls.callTool[calls.callTool.length - 1]!;
    expect(lastCall.serverId).toBe("target-srv");
    expect(lastCall.toolName).toBe("target_fn");
    expect(lastCall.args).toEqual({ x: 42, y: "hello" });
  });

  test("übergibt leere Argumente korrekt", async () => {
    await mcpManager.callTool("srv", "fn", {});

    const lastCall = calls.callTool[calls.callTool.length - 1]!;
    expect(lastCall.args).toEqual({});
  });
});
