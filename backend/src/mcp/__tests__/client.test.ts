/**
 * Tests for backend/src/mcp/client.ts
 *
 * McpClient verwaltet Verbindungen zu MCP-Servern im Dual-Mode:
 *   - Lokal (kein MCP_RUNNER_URL): erstellt McpConnection
 *   - Remote (MCP_RUNNER_URL gesetzt): erstellt RemoteMcpConnection
 *
 * Strategie: Mock-Klassen für McpConnection und RemoteMcpConnection, die
 * IMcpConnection implementieren.  Alle mock.module()-Aufrufe MÜSSEN vor dem
 * dynamischen Import des Moduls unter Test stehen.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { McpServerConfig, McpToolInfo, McpCallResult, IMcpConnection } from "../types";

// ---------------------------------------------------------------------------
// Gemeinsamer veränderbarer Zustand für die Mock-Verbindungen
// ---------------------------------------------------------------------------

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

interface MockConnectionState {
  status: ConnectionStatus;
  serverId: string;
  serverName: string;
  error: string | null;
  connectedAt: number | null;
  tools: McpToolInfo[];
  connectError: Error | null;
  disconnectError: Error | null;
  callToolResult: McpCallResult | null;
  callToolError: Error | null;
  refreshToolsResult: McpToolInfo[];
  // Aufzeichnung aufgerufener Konstruktor-Argumente
  localInstances: Array<{ config: McpServerConfig }>;
  remoteInstances: Array<{ config: McpServerConfig; runnerUrl: string; secret: string }>;
  // Aufzeichnung aufgerufener Methoden
  connectCalls: number;
  disconnectCalls: number;
}

const mockState: MockConnectionState = {
  status: "connected",
  serverId: "test-server",
  serverName: "Test Server",
  error: null,
  connectedAt: 1700000000000,
  tools: [],
  connectError: null,
  disconnectError: null,
  callToolResult: null,
  callToolError: null,
  refreshToolsResult: [],
  localInstances: [],
  remoteInstances: [],
  connectCalls: 0,
  disconnectCalls: 0,
};

function resetMockState(): void {
  mockState.status = "connected";
  mockState.serverId = "test-server";
  mockState.serverName = "Test Server";
  mockState.error = null;
  mockState.connectedAt = 1700000000000;
  mockState.tools = [];
  mockState.connectError = null;
  mockState.disconnectError = null;
  mockState.callToolResult = null;
  mockState.callToolError = null;
  mockState.refreshToolsResult = [];
  mockState.localInstances = [];
  mockState.remoteInstances = [];
  mockState.connectCalls = 0;
  mockState.disconnectCalls = 0;
}

// ---------------------------------------------------------------------------
// Mock-Klasse: gemeinsame Verbindungslogik
// ---------------------------------------------------------------------------

function makeMockConnection(config: McpServerConfig): IMcpConnection {
  const conn: IMcpConnection = {
    get serverId() {
      return mockState.serverId;
    },
    get serverName() {
      return mockState.serverName;
    },
    get status() {
      return mockState.status;
    },
    get error() {
      return mockState.error;
    },
    get connectedAt() {
      return mockState.connectedAt;
    },
    async connect() {
      mockState.connectCalls++;
      if (mockState.connectError) throw mockState.connectError;
      mockState.status = "connected";
    },
    async disconnect() {
      mockState.disconnectCalls++;
      if (mockState.disconnectError) throw mockState.disconnectError;
      mockState.status = "disconnected";
    },
    getTools() {
      return mockState.tools;
    },
    async refreshTools() {
      return mockState.refreshToolsResult;
    },
    async callTool(_toolName: string, _args: Record<string, any>) {
      if (mockState.callToolError) throw mockState.callToolError;
      return mockState.callToolResult!;
    },
    getInfo() {
      return {
        id: config.id,
        name: config.name,
        status: mockState.status,
        error: mockState.error,
        toolCount: mockState.tools.length,
        connectedAt: mockState.connectedAt,
      };
    },
  };
  return conn;
}

// ---------------------------------------------------------------------------
// mock.module() — MUSS vor dem dynamischen Import stehen
// ---------------------------------------------------------------------------

mock.module("../connection", () => ({
  McpConnection: class MockMcpConnection {
    private conn: IMcpConnection;
    constructor(config: McpServerConfig) {
      mockState.localInstances.push({ config });
      this.conn = makeMockConnection(config);
    }
    get serverId() { return this.conn.serverId; }
    get serverName() { return this.conn.serverName; }
    get status() { return this.conn.status; }
    get error() { return this.conn.error; }
    get connectedAt() { return this.conn.connectedAt; }
    connect() { return this.conn.connect(); }
    disconnect() { return this.conn.disconnect(); }
    getTools() { return this.conn.getTools(); }
    refreshTools() { return this.conn.refreshTools(); }
    callTool(toolName: string, args: Record<string, any>) {
      return this.conn.callTool(toolName, args);
    }
    getInfo() { return this.conn.getInfo(); }
  },
}));

mock.module("../remote-connection", () => ({
  RemoteMcpConnection: class MockRemoteMcpConnection {
    private conn: IMcpConnection;
    constructor(config: McpServerConfig, runnerUrl: string, secret: string) {
      mockState.remoteInstances.push({ config, runnerUrl, secret });
      this.conn = makeMockConnection(config);
    }
    get serverId() { return this.conn.serverId; }
    get serverName() { return this.conn.serverName; }
    get status() { return this.conn.status; }
    get error() { return this.conn.error; }
    get connectedAt() { return this.conn.connectedAt; }
    connect() { return this.conn.connect(); }
    disconnect() { return this.conn.disconnect(); }
    getTools() { return this.conn.getTools(); }
    refreshTools() { return this.conn.refreshTools(); }
    callTool(toolName: string, args: Record<string, any>) {
      return this.conn.callTool(toolName, args);
    }
    getInfo() { return this.conn.getInfo(); }
  },
}));

// ---------------------------------------------------------------------------
// Dynamischer Import NACH mock.module()
// ---------------------------------------------------------------------------

const { McpClient } = await import("../client");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "test-server",
    name: "Test Server",
    command: "npx",
    args: ["-y", "some-mcp-package"],
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

/** Setzt MCP_RUNNER_URL in process.env und gibt eine Bereinigungsfunktion zurück. */
function withRunnerUrl(url: string): () => void {
  const original = process.env.MCP_RUNNER_URL;
  process.env.MCP_RUNNER_URL = url;
  return () => {
    if (original === undefined) {
      delete process.env.MCP_RUNNER_URL;
    } else {
      process.env.MCP_RUNNER_URL = original;
    }
  };
}

/** Setzt MCP_RUNNER_SECRET in process.env und gibt eine Bereinigungsfunktion zurück. */
function withRunnerSecret(secret: string): () => void {
  const original = process.env.MCP_RUNNER_SECRET;
  process.env.MCP_RUNNER_SECRET = secret;
  return () => {
    if (original === undefined) {
      delete process.env.MCP_RUNNER_SECRET;
    } else {
      process.env.MCP_RUNNER_SECRET = original;
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("McpClient", () => {
  beforeEach(() => {
    resetMockState();
    // Stelle sicher, dass kein MCP_RUNNER_URL gesetzt ist (lokaler Modus)
    delete process.env.MCP_RUNNER_URL;
    delete process.env.MCP_RUNNER_SECRET;
  });

  // -------------------------------------------------------------------------
  // Verbindungstyp-Auswahl
  // -------------------------------------------------------------------------

  describe("Verbindungstyp-Auswahl", () => {
    test("erstellt McpConnection im lokalen Modus (ohne MCP_RUNNER_URL)", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      expect(mockState.localInstances).toHaveLength(1);
      expect(mockState.remoteInstances).toHaveLength(0);
    });

    test("erstellt RemoteMcpConnection wenn MCP_RUNNER_URL gesetzt ist", async () => {
      const cleanup = withRunnerUrl("http://localhost:8080");
      try {
        const client = new McpClient();
        await client.connect(makeConfig());
        expect(mockState.remoteInstances).toHaveLength(1);
        expect(mockState.localInstances).toHaveLength(0);
      } finally {
        cleanup();
      }
    });

    test("übergibt runnerUrl korrekt an RemoteMcpConnection", async () => {
      const cleanup = withRunnerUrl("http://runner.example.com:9000");
      try {
        const client = new McpClient();
        await client.connect(makeConfig());
        expect(mockState.remoteInstances[0]!.runnerUrl).toBe("http://runner.example.com:9000");
      } finally {
        cleanup();
      }
    });

    test("übergibt runnerSecret korrekt an RemoteMcpConnection", async () => {
      const cleanupUrl = withRunnerUrl("http://localhost:8080");
      const cleanupSecret = withRunnerSecret("supersecret");
      try {
        const client = new McpClient();
        await client.connect(makeConfig());
        expect(mockState.remoteInstances[0]!.secret).toBe("supersecret");
      } finally {
        cleanupUrl();
        cleanupSecret();
      }
    });

    test("übergibt leeren String als secret wenn MCP_RUNNER_SECRET nicht gesetzt ist", async () => {
      const cleanup = withRunnerUrl("http://localhost:8080");
      delete process.env.MCP_RUNNER_SECRET;
      try {
        const client = new McpClient();
        await client.connect(makeConfig());
        expect(mockState.remoteInstances[0]!.secret).toBe("");
      } finally {
        cleanup();
      }
    });

    test("übergibt die korrekte ServerConfig an McpConnection", async () => {
      const client = new McpClient();
      const config = makeConfig({ id: "my-srv", name: "My Server" });
      await client.connect(config);
      expect(mockState.localInstances[0]!.config.id).toBe("my-srv");
      expect(mockState.localInstances[0]!.config.name).toBe("My Server");
    });
  });

  // -------------------------------------------------------------------------
  // connect()
  // -------------------------------------------------------------------------

  describe("connect()", () => {
    test("ruft connect() auf der Verbindung auf", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      expect(mockState.connectCalls).toBe(1);
    });

    test("gibt die Verbindung zurück", async () => {
      const client = new McpClient();
      const conn = await client.connect(makeConfig());
      expect(conn).toBeDefined();
      expect(conn.serverId).toBe("test-server");
    });

    test("speichert die Verbindung intern", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      const conn = client.getConnection("test-server");
      expect(conn).toBeDefined();
    });

    test("gibt vorhandene Verbindung zurück ohne erneut connect() aufzurufen wenn bereits verbunden", async () => {
      mockState.status = "connected";
      const client = new McpClient();
      await client.connect(makeConfig());
      const firstCalls = mockState.connectCalls;
      // Zweiter Aufruf mit demselben Server
      await client.connect(makeConfig());
      expect(mockState.connectCalls).toBe(firstCalls); // kein weiterer connect()-Aufruf
    });

    test("erstellt neue Verbindung wenn Zustand nicht 'connected' ist", async () => {
      mockState.status = "disconnected";
      const client = new McpClient();
      await client.connect(makeConfig());
      // Da der Status 'disconnected' ist, wird eine neue Verbindung erstellt
      expect(mockState.localInstances.length).toBeGreaterThanOrEqual(1);
    });

    test("wirft wenn connect() der Verbindung einen Fehler wirft", async () => {
      mockState.connectError = new Error("Verbindung fehlgeschlagen");
      const client = new McpClient();
      await expect(client.connect(makeConfig())).rejects.toThrow("Verbindung fehlgeschlagen");
    });

    test("kann mehrere Server mit unterschiedlichen IDs verbinden", async () => {
      const client = new McpClient();
      mockState.serverId = "server-a";
      await client.connect(makeConfig({ id: "server-a" }));
      mockState.serverId = "server-b";
      await client.connect(makeConfig({ id: "server-b" }));
      expect(client.getAllConnections()).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // disconnect()
  // -------------------------------------------------------------------------

  describe("disconnect()", () => {
    test("ruft disconnect() auf der Verbindung auf", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      await client.disconnect("test-server");
      expect(mockState.disconnectCalls).toBe(1);
    });

    test("entfernt die Verbindung nach dem Trennen", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      await client.disconnect("test-server");
      expect(client.getConnection("test-server")).toBeUndefined();
    });

    test("tut nichts wenn die Server-ID nicht existiert", async () => {
      const client = new McpClient();
      // Kein connect() vorher — sollte nicht werfen
      await expect(client.disconnect("nicht-vorhanden")).resolves.toBeUndefined();
      expect(mockState.disconnectCalls).toBe(0);
    });

    test("lässt andere Verbindungen unberührt", async () => {
      const client = new McpClient();
      mockState.serverId = "server-a";
      await client.connect(makeConfig({ id: "server-a" }));
      mockState.serverId = "server-b";
      await client.connect(makeConfig({ id: "server-b" }));
      // Trenne nur server-a
      await client.disconnect("server-a");
      expect(client.getConnection("server-b")).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // reconnect()
  // -------------------------------------------------------------------------

  describe("reconnect()", () => {
    test("trennt und verbindet den Server neu", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      const initialConnectCalls = mockState.connectCalls;
      mockState.status = "disconnected"; // nach disconnect ist Status disconnected
      await client.reconnect(makeConfig());
      // disconnect() + connect() = jeweils mindestens 1 Aufruf mehr
      expect(mockState.disconnectCalls).toBe(1);
      expect(mockState.connectCalls).toBeGreaterThan(initialConnectCalls);
    });

    test("gibt eine neue Verbindung zurück", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      mockState.status = "disconnected";
      const conn = await client.reconnect(makeConfig());
      expect(conn).toBeDefined();
    });

    test("kann reconnect() ohne vorherige Verbindung aufrufen", async () => {
      const client = new McpClient();
      mockState.status = "disconnected";
      const conn = await client.reconnect(makeConfig());
      expect(conn).toBeDefined();
      expect(mockState.connectCalls).toBe(1);
    });

    test("wirft wenn connect() beim Reconnect fehlschlägt", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      mockState.status = "disconnected";
      mockState.connectError = new Error("Reconnect fehlgeschlagen");
      await expect(client.reconnect(makeConfig())).rejects.toThrow("Reconnect fehlgeschlagen");
    });
  });

  // -------------------------------------------------------------------------
  // disconnectAll()
  // -------------------------------------------------------------------------

  describe("disconnectAll()", () => {
    test("trennt alle verbundenen Server", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      mockState.serverId = "srv-b";
      await client.connect(makeConfig({ id: "srv-b" }));
      await client.disconnectAll();
      expect(client.getAllConnections()).toHaveLength(0);
    });

    test("ruft disconnect() für jeden Server auf", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      mockState.serverId = "srv-b";
      await client.connect(makeConfig({ id: "srv-b" }));
      await client.disconnectAll();
      expect(mockState.disconnectCalls).toBe(2);
    });

    test("tut nichts wenn keine Verbindungen vorhanden sind", async () => {
      const client = new McpClient();
      await expect(client.disconnectAll()).resolves.toBeUndefined();
      expect(mockState.disconnectCalls).toBe(0);
    });

    test("lässt den Client nach disconnectAll() wieder verwendbar", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      await client.disconnectAll();
      mockState.status = "connected";
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      expect(client.getAllConnections()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getConnection()
  // -------------------------------------------------------------------------

  describe("getConnection()", () => {
    test("gibt die Verbindung anhand der Server-ID zurück", async () => {
      const client = new McpClient();
      await client.connect(makeConfig({ id: "my-server" }));
      const conn = client.getConnection("my-server");
      expect(conn).toBeDefined();
    });

    test("gibt undefined zurück wenn die Server-ID nicht existiert", () => {
      const client = new McpClient();
      expect(client.getConnection("nicht-vorhanden")).toBeUndefined();
    });

    test("gibt undefined zurück nach dem Trennen der Verbindung", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      await client.disconnect("test-server");
      expect(client.getConnection("test-server")).toBeUndefined();
    });

    test("gibt nur die angefragte Verbindung zurück", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      mockState.serverId = "srv-b";
      await client.connect(makeConfig({ id: "srv-b" }));
      const conn = client.getConnection("srv-b");
      expect(conn).toBeDefined();
      expect(conn!.serverId).toBe("srv-b");
    });
  });

  // -------------------------------------------------------------------------
  // getAllConnections()
  // -------------------------------------------------------------------------

  describe("getAllConnections()", () => {
    test("gibt leere Liste zurück wenn keine Verbindungen vorhanden sind", () => {
      const client = new McpClient();
      expect(client.getAllConnections()).toEqual([]);
    });

    test("gibt alle verbundenen Server zurück", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      mockState.serverId = "srv-b";
      await client.connect(makeConfig({ id: "srv-b" }));
      expect(client.getAllConnections()).toHaveLength(2);
    });

    test("gibt ein Array zurück", () => {
      const client = new McpClient();
      expect(Array.isArray(client.getAllConnections())).toBe(true);
    });

    test("spiegelt Änderungen nach disconnect() wider", async () => {
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      await client.disconnect("srv-a");
      expect(client.getAllConnections()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getServerStatuses()
  // -------------------------------------------------------------------------

  describe("getServerStatuses()", () => {
    test("gibt leere Liste zurück wenn keine Verbindungen vorhanden sind", () => {
      const client = new McpClient();
      expect(client.getServerStatuses()).toEqual([]);
    });

    test("gibt Status-Objekte für alle Verbindungen zurück", async () => {
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses).toHaveLength(1);
    });

    test("Status-Objekt enthält id-Feld", async () => {
      mockState.serverId = "status-srv";
      const client = new McpClient();
      await client.connect(makeConfig({ id: "status-srv" }));
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.id).toBe("status-srv");
    });

    test("Status-Objekt enthält name-Feld", async () => {
      mockState.serverName = "Status Server";
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.name).toBe("Status Server");
    });

    test("Status-Objekt enthält status-Feld", async () => {
      mockState.status = "connected";
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.status).toBe("connected");
    });

    test("Status-Objekt enthält toolCount-Feld", async () => {
      mockState.tools = [makeToolInfo(), makeToolInfo({ name: "other_tool" })];
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.toolCount).toBe(2);
    });

    test("toolCount ist 0 wenn keine Tools vorhanden sind", async () => {
      mockState.tools = [];
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.toolCount).toBe(0);
    });

    test("Status-Objekt enthält connectedAt wenn gesetzt", async () => {
      mockState.connectedAt = 1700000000000;
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.connectedAt).toBe(1700000000000);
    });

    test("connectedAt ist undefined wenn null", async () => {
      mockState.connectedAt = null;
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.connectedAt).toBeUndefined();
    });

    test("Status-Objekt enthält error-Feld wenn Fehler vorhanden", async () => {
      mockState.error = "Verbindungsfehler";
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.error).toBe("Verbindungsfehler");
    });

    test("error ist undefined wenn null", async () => {
      mockState.error = null;
      const client = new McpClient();
      await client.connect(makeConfig());
      const statuses = client.getServerStatuses();
      expect(statuses[0]!.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getAllTools()
  // -------------------------------------------------------------------------

  describe("getAllTools()", () => {
    test("gibt leere Liste zurück wenn keine Verbindungen vorhanden sind", () => {
      const client = new McpClient();
      expect(client.getAllTools()).toEqual([]);
    });

    test("gibt Tools von verbundenen Servern zurück", async () => {
      const tool = makeToolInfo({ name: "mein_tool" });
      mockState.tools = [tool];
      mockState.status = "connected";
      const client = new McpClient();
      await client.connect(makeConfig());
      const tools = client.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]!.name).toBe("mein_tool");
    });

    test("gibt keine Tools von Servern im error-Zustand zurück", async () => {
      mockState.tools = [makeToolInfo()];
      const client = new McpClient();
      await client.connect(makeConfig());
      // Setze Status auf 'error' nach dem Verbinden (simuliert Verbindungsabbruch)
      mockState.status = "error";
      const tools = client.getAllTools();
      expect(tools).toHaveLength(0);
    });

    test("schließt Tools von Servern im disconnected-Zustand aus", async () => {
      mockState.tools = [makeToolInfo()];
      const client = new McpClient();
      await client.connect(makeConfig());
      // Setze Status nach dem Verbinden auf 'disconnected' (simuliert Verbindungsverlust)
      mockState.status = "disconnected";
      expect(client.getAllTools()).toHaveLength(0);
    });

    test("schließt Tools von Servern im connecting-Zustand aus", async () => {
      mockState.tools = [makeToolInfo()];
      const client = new McpClient();
      await client.connect(makeConfig());
      // Setze Status nach dem Verbinden auf 'connecting' (simuliert erneuten Verbindungsaufbau)
      mockState.status = "connecting";
      expect(client.getAllTools()).toHaveLength(0);
    });

    test("gibt leere Liste zurück wenn keine Tools vorhanden aber Server verbunden ist", async () => {
      mockState.tools = [];
      mockState.status = "connected";
      const client = new McpClient();
      await client.connect(makeConfig());
      expect(client.getAllTools()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // callTool()
  // -------------------------------------------------------------------------

  describe("callTool()", () => {
    test("wirft wenn die Server-ID nicht gefunden wird", async () => {
      const client = new McpClient();
      await expect(
        client.callTool("nicht-vorhanden", "mein_tool", {})
      ).rejects.toThrow('MCP server "nicht-vorhanden" not found');
    });

    test("gibt Text-Ergebnis als String zurück", async () => {
      mockState.callToolResult = {
        content: [{ type: "text", text: "Ergebnis-Text" }],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "mein_tool", {});
      expect(result).toBe("Ergebnis-Text");
    });

    test("verbindet mehrere Text-Inhalte mit Zeilenumbruch", async () => {
      mockState.callToolResult = {
        content: [
          { type: "text", text: "Zeile 1" },
          { type: "text", text: "Zeile 2" },
        ],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "tool", {});
      expect(result).toBe("Zeile 1\nZeile 2");
    });

    test("formatiert Bild-Inhalte als [Image: mimeType]", async () => {
      mockState.callToolResult = {
        content: [{ type: "image", mimeType: "image/png" }],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "screenshottool", {});
      expect(result).toBe("[Image: image/png]");
    });

    test("formatiert Resource-Inhalte als [Resource: text]", async () => {
      mockState.callToolResult = {
        content: [{ type: "resource", text: "Ressource-Inhalt" }],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "read_resource", {});
      expect(result).toBe("[Resource: Ressource-Inhalt]");
    });

    test("serialisiert unbekannte Inhaltstypen als JSON", async () => {
      mockState.callToolResult = {
        content: [{ type: "custom_type", data: "some-data" } as any],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "tool", {});
      expect(result).toContain("custom_type");
    });

    test("wirft wenn isError true und Text vorhanden ist", async () => {
      mockState.callToolResult = {
        content: [{ type: "text", text: "MCP-Fehlertext" }],
        isError: true,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      await expect(
        client.callTool("test-server", "fehler_tool", {})
      ).rejects.toThrow("MCP-Fehlertext");
    });

    test("wirft mit 'Unknown MCP error' wenn isError true aber kein Text vorhanden", async () => {
      mockState.callToolResult = {
        content: [{ type: "image", mimeType: "image/png" }],
        isError: true,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      await expect(
        client.callTool("test-server", "fehler_tool", {})
      ).rejects.toThrow("Unknown MCP error");
    });

    test("wirft den Fehler der Verbindung durch wenn callTool() wirft", async () => {
      mockState.callToolError = new Error("Verbindungsabbruch");
      const client = new McpClient();
      await client.connect(makeConfig());
      await expect(
        client.callTool("test-server", "mein_tool", {})
      ).rejects.toThrow("Verbindungsabbruch");
    });

    test("gibt kombinierten Inhalt aus Text und Bild zurück", async () => {
      mockState.callToolResult = {
        content: [
          { type: "text", text: "Beschreibung" },
          { type: "image", mimeType: "image/jpeg" },
        ],
        isError: false,
      };
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.callTool("test-server", "tool", {});
      expect(result).toBe("Beschreibung\n[Image: image/jpeg]");
    });

    test("übergibt Argumente korrekt an die Verbindung und gibt Ergebnis zurück", async () => {
      mockState.callToolResult = { content: [{ type: "text", text: "ok" }], isError: false };
      const client = new McpClient();
      await client.connect(makeConfig());
      await expect(
        client.callTool("test-server", "mein_tool", { query: "test", limit: 10 })
      ).resolves.toBe("ok");
    });
  });

  // -------------------------------------------------------------------------
  // refreshTools()
  // -------------------------------------------------------------------------

  describe("refreshTools()", () => {
    test("wirft wenn die Server-ID nicht gefunden wird", async () => {
      const client = new McpClient();
      await expect(
        client.refreshTools("nicht-vorhanden")
      ).rejects.toThrow('MCP server "nicht-vorhanden" not found');
    });

    test("delegiert an refreshTools() der Verbindung", async () => {
      const tools = [makeToolInfo({ name: "frisches_tool" })];
      mockState.refreshToolsResult = tools;
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.refreshTools("test-server");
      expect(result).toEqual(tools);
    });

    test("gibt leere Liste zurück wenn keine Tools vorhanden sind", async () => {
      mockState.refreshToolsResult = [];
      const client = new McpClient();
      await client.connect(makeConfig());
      const result = await client.refreshTools("test-server");
      expect(result).toEqual([]);
    });

    test("gibt die richtigen Tools für den angegebenen Server zurück", async () => {
      const toolA = makeToolInfo({ name: "tool_a", serverId: "srv-a" });
      const client = new McpClient();
      mockState.serverId = "srv-a";
      await client.connect(makeConfig({ id: "srv-a" }));
      mockState.refreshToolsResult = [toolA];
      const result = await client.refreshTools("srv-a");
      expect(result[0]!.name).toBe("tool_a");
    });
  });

  // -------------------------------------------------------------------------
  // warmCache()
  // -------------------------------------------------------------------------

  describe("warmCache()", () => {
    test("ist im lokalen Modus ein No-op (kein fetch-Aufruf)", async () => {
      delete process.env.MCP_RUNNER_URL;
      // Überschreibe globales fetch, um Aufrufe zu erkennen
      const originalFetch = global.fetch;
      let fetchCalled = false;
      (global as any).fetch = async (..._args: any[]) => {
        fetchCalled = true;
        return new Response(JSON.stringify({}), { status: 200 });
      };
      try {
        const client = new McpClient();
        await client.warmCache(makeConfig());
        expect(fetchCalled).toBe(false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("sendet POST-Anfrage an /api/warm im Remote-Modus", async () => {
      const cleanup = withRunnerUrl("http://runner.local:8080");
      let capturedUrl = "";
      let capturedMethod = "";
      const originalFetch = global.fetch;
      (global as any).fetch = async (url: string, opts: RequestInit) => {
        capturedUrl = url;
        capturedMethod = opts.method as string;
        return new Response(JSON.stringify({}), { status: 200 });
      };
      try {
        const client = new McpClient();
        await client.warmCache(makeConfig());
        expect(capturedUrl).toBe("http://runner.local:8080/api/warm");
        expect(capturedMethod).toBe("POST");
      } finally {
        global.fetch = originalFetch;
        cleanup();
      }
    });

    test("sendet command und args im Request-Body", async () => {
      const cleanup = withRunnerUrl("http://runner.local:8080");
      let capturedBody: any;
      const originalFetch = global.fetch;
      (global as any).fetch = async (_url: string, opts: RequestInit) => {
        capturedBody = JSON.parse(opts.body as string);
        return new Response(JSON.stringify({}), { status: 200 });
      };
      try {
        const config = makeConfig({ command: "npx", args: ["-y", "mein-paket"] });
        const client = new McpClient();
        await client.warmCache(config);
        expect(capturedBody.command).toBe("npx");
        expect(capturedBody.args).toEqual(["-y", "mein-paket"]);
      } finally {
        global.fetch = originalFetch;
        cleanup();
      }
    });

    test("setzt Authorization-Header wenn runnerSecret gesetzt ist", async () => {
      const cleanupUrl = withRunnerUrl("http://runner.local:8080");
      const cleanupSecret = withRunnerSecret("geheimnis");
      let capturedHeaders: Record<string, string> = {};
      const originalFetch = global.fetch;
      (global as any).fetch = async (_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return new Response(JSON.stringify({}), { status: 200 });
      };
      try {
        const client = new McpClient();
        await client.warmCache(makeConfig());
        expect(capturedHeaders["Authorization"]).toBe("Bearer geheimnis");
      } finally {
        global.fetch = originalFetch;
        cleanupUrl();
        cleanupSecret();
      }
    });

    test("setzt keinen Authorization-Header wenn runnerSecret leer ist", async () => {
      const cleanupUrl = withRunnerUrl("http://runner.local:8080");
      delete process.env.MCP_RUNNER_SECRET;
      let capturedHeaders: Record<string, string> = {};
      const originalFetch = global.fetch;
      (global as any).fetch = async (_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return new Response(JSON.stringify({}), { status: 200 });
      };
      try {
        const client = new McpClient();
        await client.warmCache(makeConfig());
        expect(capturedHeaders["Authorization"]).toBeUndefined();
      } finally {
        global.fetch = originalFetch;
        cleanupUrl();
      }
    });

    test("wirft keinen Fehler wenn der Runner-Request fehlschlägt", async () => {
      const cleanup = withRunnerUrl("http://runner.local:8080");
      const originalFetch = global.fetch;
      (global as any).fetch = async () => {
        return new Response(JSON.stringify({ error: "Server nicht erreichbar" }), { status: 500 });
      };
      try {
        const client = new McpClient();
        // Sollte nicht werfen — fire-and-forget
        await expect(client.warmCache(makeConfig())).resolves.toBeUndefined();
      } finally {
        global.fetch = originalFetch;
        cleanup();
      }
    });

    test("wirft keinen Fehler wenn fetch() eine Exception wirft", async () => {
      const cleanup = withRunnerUrl("http://runner.local:8080");
      const originalFetch = global.fetch;
      (global as any).fetch = async () => {
        throw new Error("Netzwerkfehler");
      };
      try {
        const client = new McpClient();
        await expect(client.warmCache(makeConfig())).resolves.toBeUndefined();
      } finally {
        global.fetch = originalFetch;
        cleanup();
      }
    });

    test("gibt undefined zurück im lokalen Modus", async () => {
      delete process.env.MCP_RUNNER_URL;
      const client = new McpClient();
      const result = await client.warmCache(makeConfig());
      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Singleton-Export
  // -------------------------------------------------------------------------

  describe("mcpClient Singleton", () => {
    test("mcpClient ist eine McpClient-Instanz", async () => {
      const { mcpClient } = await import("../client");
      expect(mcpClient).toBeInstanceOf(McpClient);
    });

    test("mcpClient hat getAllConnections()-Methode", async () => {
      const { mcpClient } = await import("../client");
      expect(typeof mcpClient.getAllConnections).toBe("function");
    });

    test("mcpClient hat connect()-Methode", async () => {
      const { mcpClient } = await import("../client");
      expect(typeof mcpClient.connect).toBe("function");
    });

    test("mcpClient hat callTool()-Methode", async () => {
      const { mcpClient } = await import("../client");
      expect(typeof mcpClient.callTool).toBe("function");
    });
  });
});
