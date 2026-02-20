/**
 * Tests for connections/registry.ts
 *
 * ConnectionRegistry: zentrales Management fuer ConnectionProvider.
 * Alle externen Abhaengigkeiten (storage, toolRegistry, pluginRegistry)
 * werden per mock.module() ersetzt — die Mocks muessen VOR dem Import
 * des Moduls deklariert sein.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { ConnectionProvider, ConnectionTool, TokenSet, ConnectionStatus } from "../types";

// ---------------------------------------------------------------------------
// Gemeinsamer Mock-Zustand
// ---------------------------------------------------------------------------

const mockState = {
  // storage: loadConnection(userId, providerId) => null | { connection, tokens }
  loadConnectionResult: null as null | { connection: any; tokens: TokenSet },

  // storage: listUserConnections(userId) => StoredConnection[]
  listUserConnectionsResult: [] as any[],

  // storage: saveConnection => StoredConnection (unused in den aktuellen Tests)
  saveConnectionResult: null as any,

  // storage: updateConnectionTokens => boolean
  updateConnectionTokensResult: true as boolean,

  // pluginRegistry.isEnabled(providerId) => boolean
  pluginEnabledMap: {} as Record<string, boolean>,

  // toolRegistry: gesammelte Aufrufe
  registeredTools: [] as string[],
  unregisteredTools: [] as string[],
};

// ---------------------------------------------------------------------------
// Mocks — VOR dem Import des Moduls unter Test deklarieren
// ---------------------------------------------------------------------------

mock.module("../storage", () => ({
  loadConnection: async (_userId: string, _providerId: string) =>
    mockState.loadConnectionResult,
  listUserConnections: async (_userId: string) =>
    mockState.listUserConnectionsResult,
  saveConnection: async (..._args: any[]) => mockState.saveConnectionResult,
  updateConnectionTokens: async (_userId: string, _providerId: string, _tokens: TokenSet) => {
    mockState.updateConnectionTokensResult;
    return mockState.updateConnectionTokensResult;
  },
}));

mock.module("../../tools/registry", () => ({
  toolRegistry: {
    register: (tool: { name: string }) => {
      mockState.registeredTools.push(tool.name);
    },
    unregister: (name: string) => {
      mockState.unregisteredTools.push(name);
      return true;
    },
  },
}));

mock.module("../../plugins/registry", () => ({
  pluginRegistry: {
    isEnabled: (pluginId: string) =>
      mockState.pluginEnabledMap[pluginId] ?? false,
  },
}));

// ---------------------------------------------------------------------------
// Import NACH den Mocks
// ---------------------------------------------------------------------------

const { ConnectionRegistry } = await import("../registry");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function createMockProvider(id: string, authType: string = "oauth2"): ConnectionProvider {
  return {
    id,
    name: `Provider ${id}`,
    description: `Test provider ${id}`,
    authType: authType as "oauth2" | "api-key",
    getTools: () => [
      {
        name: `${id}_tool`,
        type: "connection",
        providerId: id,
      } as unknown as ConnectionTool,
    ],
    getAuthUrl: mock(async () => "https://auth.example.com"),
    exchangeCode: mock(async () => ({ accessToken: "tok", tokenType: "Bearer" })),
    refreshToken: mock(async () => ({ accessToken: "new-tok", tokenType: "Bearer" })),
    validateConnection: mock(async () => ({
      status: "connected" as const,
      lastChecked: new Date().toISOString(),
    })),
  };
}

function makeTokens(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: "access-token",
    tokenType: "Bearer",
    ...overrides,
  };
}

function makeConnectionResult(tokens: TokenSet, statusOverride: Partial<ConnectionStatus> = {}) {
  return {
    connection: {
      providerId: "p1",
      userId: "u1",
      tokens: {},
      status: {
        status: "connected" as const,
        lastChecked: new Date().toISOString(),
        ...statusOverride,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    tokens,
  };
}

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe("ConnectionRegistry", () => {
  describe("register()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.registeredTools = [];
      mockState.unregisteredTools = [];
    });

    test("speichert den Provider in der internen Map", () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      expect(registry.has("github")).toBe(true);
    });

    test("registriert die Tools des Providers im toolRegistry", () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      expect(mockState.registeredTools).toContain("github_tool");
    });

    test("registriert alle Tools wenn getTools mehrere Tools zurueckgibt", () => {
      const provider: ConnectionProvider = {
        ...createMockProvider("multi"),
        getTools: () => [
          { name: "multi_tool_a", type: "connection", providerId: "multi" } as unknown as ConnectionTool,
          { name: "multi_tool_b", type: "connection", providerId: "multi" } as unknown as ConnectionTool,
        ],
      };
      registry.register(provider);
      expect(mockState.registeredTools).toContain("multi_tool_a");
      expect(mockState.registeredTools).toContain("multi_tool_b");
    });

    test("ersetzt einen bereits registrierten Provider bei Duplikat", () => {
      const first = createMockProvider("slack");
      const second = createMockProvider("slack");
      registry.register(first);
      registry.register(second);
      // Der zweite Provider sollte gespeichert sein (get liefert second)
      expect(registry.get("slack")).toBe(second);
    });

    test("registriert Tools des neuen Providers auch beim Ersetzen", () => {
      const first = createMockProvider("slack");
      registry.register(first);
      const countAfterFirst = mockState.registeredTools.length;

      const second = createMockProvider("slack");
      registry.register(second);
      // tool wurde erneut registriert
      expect(mockState.registeredTools.length).toBe(countAfterFirst + 1);
    });
  });

  // ---------------------------------------------------------------------------
  // unregister()
  // ---------------------------------------------------------------------------

  describe("unregister()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.registeredTools = [];
      mockState.unregisteredTools = [];
    });

    test("entfernt einen vorhandenen Provider und gibt true zurueck", () => {
      const provider = createMockProvider("jira");
      registry.register(provider);
      const result = registry.unregister("jira");
      expect(result).toBe(true);
      expect(registry.has("jira")).toBe(false);
    });

    test("meldet die Tools des Providers beim toolRegistry ab", () => {
      const provider = createMockProvider("jira");
      registry.register(provider);
      registry.unregister("jira");
      expect(mockState.unregisteredTools).toContain("jira_tool");
    });

    test("gibt false zurueck wenn der Provider nicht existiert", () => {
      const result = registry.unregister("does-not-exist");
      expect(result).toBe(false);
    });

    test("meldet keine Tools ab wenn der Provider nicht existiert", () => {
      registry.unregister("ghost");
      expect(mockState.unregisteredTools).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // get(), has(), getAll(), getIds()
  // ---------------------------------------------------------------------------

  describe("get()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
    });

    test("gibt den Provider zurueck wenn er existiert", () => {
      const provider = createMockProvider("confluence");
      registry.register(provider);
      expect(registry.get("confluence")).toBe(provider);
    });

    test("gibt undefined zurueck fuer unbekannte ID", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });
  });

  describe("has()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
    });

    test("gibt true zurueck wenn Provider registriert ist", () => {
      registry.register(createMockProvider("notion"));
      expect(registry.has("notion")).toBe(true);
    });

    test("gibt false zurueck wenn Provider nicht registriert ist", () => {
      expect(registry.has("notion")).toBe(false);
    });
  });

  describe("getAll()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
    });

    test("gibt leeres Array zurueck wenn keine Provider registriert sind", () => {
      expect(registry.getAll()).toEqual([]);
    });

    test("gibt alle registrierten Provider zurueck", () => {
      const p1 = createMockProvider("p1");
      const p2 = createMockProvider("p2");
      registry.register(p1);
      registry.register(p2);
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(p1);
      expect(all).toContain(p2);
    });
  });

  describe("getIds()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
    });

    test("gibt leeres Array zurueck wenn keine Provider vorhanden", () => {
      expect(registry.getIds()).toEqual([]);
    });

    test("gibt alle registrierten IDs zurueck", () => {
      registry.register(createMockProvider("a"));
      registry.register(createMockProvider("b"));
      const ids = registry.getIds();
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getProviderInfos()
  // ---------------------------------------------------------------------------

  describe("getProviderInfos()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.loadConnectionResult = null;
    });

    test("gibt leeres Array zurueck wenn keine Provider registriert sind", async () => {
      const infos = await registry.getProviderInfos();
      expect(infos).toEqual([]);
    });

    test("gibt ProviderInfo ohne Status zurueck wenn kein userId angegeben", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      const infos = await registry.getProviderInfos();
      expect(infos).toHaveLength(1);
      expect(infos[0]).toMatchObject({
        id: "github",
        name: "Provider github",
        description: "Test provider github",
        authType: "oauth2",
      });
      expect(infos[0].status).toBeUndefined();
    });

    test("beinhaltet Verbindungsstatus wenn userId angegeben und Verbindung existiert", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.loadConnectionResult = makeConnectionResult(makeTokens(), {
        status: "connected",
      });
      const infos = await registry.getProviderInfos("user-123");
      expect(infos[0].status).toBeDefined();
      expect(infos[0].status?.status).toBe("connected");
    });

    test("Status bleibt undefined wenn userId angegeben aber keine Verbindung gespeichert", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.loadConnectionResult = null;
      const infos = await registry.getProviderInfos("user-123");
      expect(infos[0].status).toBeUndefined();
    });

    test("gibt Infos fuer alle registrierten Provider zurueck", async () => {
      registry.register(createMockProvider("p1"));
      registry.register(createMockProvider("p2"));
      const infos = await registry.getProviderInfos();
      expect(infos).toHaveLength(2);
      const ids = infos.map((i) => i.id);
      expect(ids).toContain("p1");
      expect(ids).toContain("p2");
    });

    test("beinhaltet authType api-key korrekt", async () => {
      registry.register(createMockProvider("apikey-provider", "api-key"));
      const infos = await registry.getProviderInfos();
      expect(infos[0].authType).toBe("api-key");
    });
  });

  // ---------------------------------------------------------------------------
  // getTokens()
  // ---------------------------------------------------------------------------

  describe("getTokens()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.loadConnectionResult = null;
      mockState.pluginEnabledMap = {};
      mockState.updateConnectionTokensResult = true;
    });

    test("gibt null zurueck wenn Provider nicht registriert ist", async () => {
      const result = await registry.getTokens("user-1", "unknown-provider");
      expect(result).toBeNull();
    });

    test("gibt null zurueck wenn Plugin deaktiviert ist", async () => {
      registry.register(createMockProvider("github"));
      mockState.pluginEnabledMap["github"] = false;
      mockState.loadConnectionResult = makeConnectionResult(makeTokens());
      const result = await registry.getTokens("user-1", "github");
      expect(result).toBeNull();
    });

    test("gibt null zurueck wenn keine gespeicherte Verbindung vorhanden ist", async () => {
      registry.register(createMockProvider("github"));
      mockState.pluginEnabledMap["github"] = true;
      mockState.loadConnectionResult = null;
      const result = await registry.getTokens("user-1", "github");
      expect(result).toBeNull();
    });

    test("gibt Tokens zurueck wenn Plugin aktiviert und Verbindung vorhanden", async () => {
      registry.register(createMockProvider("github"));
      mockState.pluginEnabledMap["github"] = true;
      const tokens = makeTokens({ accessToken: "my-access-token" });
      mockState.loadConnectionResult = makeConnectionResult(tokens);
      const result = await registry.getTokens("user-1", "github");
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("my-access-token");
    });

    test("gibt nicht-abgelaufene Tokens direkt zurueck ohne Refresh", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
      const tokens = makeTokens({ expiresAt: futureDate, refreshToken: "refresh-tok" });
      mockState.loadConnectionResult = makeConnectionResult(tokens);
      const result = await registry.getTokens("user-1", "github");
      expect(result!.accessToken).toBe("access-token");
      // refreshToken des Providers sollte nicht aufgerufen worden sein
      expect(provider.refreshToken).not.toHaveBeenCalled();
    });

    test("aktualisiert abgelaufene Tokens automatisch", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      const expiredTokens = makeTokens({
        expiresAt: pastDate,
        refreshToken: "old-refresh",
      });
      mockState.loadConnectionResult = makeConnectionResult(expiredTokens);
      const result = await registry.getTokens("user-1", "github");
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("new-tok");
      expect(provider.refreshToken).toHaveBeenCalledWith("old-refresh");
    });

    test("gibt null zurueck wenn Token abgelaufen und kein refreshToken vorhanden", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      const expiredTokens = makeTokens({ expiresAt: pastDate }); // kein refreshToken
      mockState.loadConnectionResult = makeConnectionResult(expiredTokens);
      const result = await registry.getTokens("user-1", "github");
      expect(result).toBeNull();
    });

    test("gibt null zurueck wenn Refresh fehlschlaegt", async () => {
      const provider: ConnectionProvider = {
        ...createMockProvider("github"),
        refreshToken: mock(async () => {
          throw new Error("Refresh fehlgeschlagen");
        }),
      };
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      const expiredTokens = makeTokens({
        expiresAt: pastDate,
        refreshToken: "broken-refresh",
      });
      mockState.loadConnectionResult = makeConnectionResult(expiredTokens);
      const result = await registry.getTokens("user-1", "github");
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // validateConnection()
  // ---------------------------------------------------------------------------

  describe("validateConnection()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.loadConnectionResult = null;
      mockState.pluginEnabledMap = {};
    });

    test("gibt null zurueck wenn Provider nicht registriert ist", async () => {
      const result = await registry.validateConnection("user-1", "unknown");
      expect(result).toBeNull();
    });

    test("gibt Status 'expired' zurueck wenn keine Tokens verfuegbar sind", async () => {
      registry.register(createMockProvider("github"));
      mockState.pluginEnabledMap["github"] = false; // Plugin deaktiviert => getTokens => null
      const result = await registry.validateConnection("user-1", "github");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("expired");
      expect(result!.error).toContain("Token");
    });

    test("gibt den Status des Providers zurueck wenn Verbindung aktiv ist", async () => {
      const provider = createMockProvider("github");
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      const tokens = makeTokens();
      mockState.loadConnectionResult = makeConnectionResult(tokens);
      const result = await registry.validateConnection("user-1", "github");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("connected");
      expect(provider.validateConnection).toHaveBeenCalledWith(tokens);
    });

    test("gibt Status 'error' zurueck wenn validateConnection des Providers wirft", async () => {
      const provider: ConnectionProvider = {
        ...createMockProvider("github"),
        validateConnection: mock(async () => {
          throw new Error("API nicht erreichbar");
        }),
      };
      registry.register(provider);
      mockState.pluginEnabledMap["github"] = true;
      mockState.loadConnectionResult = makeConnectionResult(makeTokens());
      const result = await registry.validateConnection("user-1", "github");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("error");
      expect(result!.error).toBe("API nicht erreichbar");
    });

    test("Status 'expired' beinhaltet lastChecked Zeitstempel", async () => {
      registry.register(createMockProvider("github"));
      mockState.loadConnectionResult = null;
      const result = await registry.validateConnection("user-1", "github");
      expect(result!.lastChecked).toBeDefined();
      // Muss ein gueltiges ISO-Datum sein
      expect(() => new Date(result!.lastChecked)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getStats()
  // ---------------------------------------------------------------------------

  describe("getStats()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
    });

    test("gibt total=0 und leeres byAuthType zurueck wenn keine Provider registriert", () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byAuthType).toEqual({});
    });

    test("zaehlt die Gesamtzahl der Provider korrekt", () => {
      registry.register(createMockProvider("p1"));
      registry.register(createMockProvider("p2"));
      registry.register(createMockProvider("p3"));
      expect(registry.getStats().total).toBe(3);
    });

    test("gruppiert Provider nach authType", () => {
      registry.register(createMockProvider("oauth-p1", "oauth2"));
      registry.register(createMockProvider("oauth-p2", "oauth2"));
      registry.register(createMockProvider("apikey-p1", "api-key"));
      const stats = registry.getStats();
      expect(stats.byAuthType["oauth2"]).toBe(2);
      expect(stats.byAuthType["api-key"]).toBe(1);
    });

    test("zaehlt einen einzelnen Provider pro authType korrekt", () => {
      registry.register(createMockProvider("solo", "oauth2"));
      const stats = registry.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byAuthType["oauth2"]).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // clear()
  // ---------------------------------------------------------------------------

  describe("clear()", () => {
    let registry: InstanceType<typeof ConnectionRegistry>;

    beforeEach(() => {
      registry = new ConnectionRegistry();
      mockState.registeredTools = [];
      mockState.unregisteredTools = [];
    });

    test("entfernt alle registrierten Provider", () => {
      registry.register(createMockProvider("p1"));
      registry.register(createMockProvider("p2"));
      registry.clear();
      expect(registry.getAll()).toEqual([]);
    });

    test("meldet alle Tools aller Provider beim toolRegistry ab", () => {
      registry.register(createMockProvider("p1"));
      registry.register(createMockProvider("p2"));
      registry.clear();
      expect(mockState.unregisteredTools).toContain("p1_tool");
      expect(mockState.unregisteredTools).toContain("p2_tool");
    });

    test("has() gibt false fuer alle frueheren Provider zurueck nach clear()", () => {
      registry.register(createMockProvider("github"));
      registry.clear();
      expect(registry.has("github")).toBe(false);
    });

    test("getStats() gibt total=0 zurueck nach clear()", () => {
      registry.register(createMockProvider("p1"));
      registry.clear();
      expect(registry.getStats().total).toBe(0);
    });

    test("clear() auf leerem Registry wirft keinen Fehler", () => {
      expect(() => registry.clear()).not.toThrow();
    });
  });
});
