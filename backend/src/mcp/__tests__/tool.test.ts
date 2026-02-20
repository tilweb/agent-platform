/**
 * Tests for MCP Tool Wrapper (backend/src/mcp/tool.ts)
 *
 * Pure functions (getMcpToolName, parseMcpToolName) are tested directly.
 * McpToolWrapper and createMcpToolWrappers are tested with a mocked mcpClient.
 * mock.module() is declared BEFORE the dynamic import of the module under test.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { McpToolInfo } from "../types";

// ---------------------------------------------------------------------------
// Shared mutable mock state for mcpClient
// All closures inside mock.module() reference this object, so mutations
// in beforeEach / individual tests are picked up by subsequent calls.
// ---------------------------------------------------------------------------

const mockClientState = {
  callToolResult: "tool output",
  callToolError: null as Error | null,
  connectionStatus: "connected" as "connected" | "connecting" | "disconnected" | "error" | null,
  // Capture fields for argument-verification tests
  lastCallServerId: undefined as string | undefined,
  lastCallToolName: undefined as string | undefined,
  lastCallArgs: undefined as Record<string, any> | undefined,
};

// ---------------------------------------------------------------------------
// Mock ../client before the module under test is imported.
// The closures reference mockClientState so every mutation in tests is
// immediately visible to the mock without re-importing the module.
// ---------------------------------------------------------------------------

mock.module("../client", () => ({
  mcpClient: {
    callTool: async (
      serverId: string,
      toolName: string,
      args: Record<string, any>
    ): Promise<string> => {
      mockClientState.lastCallServerId = serverId;
      mockClientState.lastCallToolName = toolName;
      mockClientState.lastCallArgs = args;
      if (mockClientState.callToolError) {
        throw mockClientState.callToolError;
      }
      return mockClientState.callToolResult;
    },
    getConnection: (_serverId: string) => {
      if (mockClientState.connectionStatus === null) {
        return undefined;
      }
      return { status: mockClientState.connectionStatus };
    },
  },
}));

// Dynamic import AFTER mock.module()
const {
  getMcpToolName,
  parseMcpToolName,
  McpToolWrapper,
  createMcpToolWrappers,
} = await import("../tool");

// ---------------------------------------------------------------------------
// Helper: create a minimal McpToolInfo
// ---------------------------------------------------------------------------

function makeToolInfo(overrides: Partial<McpToolInfo> = {}): McpToolInfo {
  return {
    name: "do_thing",
    description: "Does a thing",
    serverId: "my-server",
    serverName: "My Server",
    inputSchema: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getMcpToolName
// ---------------------------------------------------------------------------

describe("getMcpToolName", () => {
  test("sollte den korrekten Namen im Format mcp_serverId_toolName erzeugen", () => {
    expect(getMcpToolName("my-server", "do_thing")).toBe("mcp_my-server_do_thing");
  });

  test("sollte mcp_server_tool für einfache Bezeichner erzeugen", () => {
    expect(getMcpToolName("server", "tool")).toBe("mcp_server_tool");
  });

  test("sollte Unterstriche im Tool-Namen unverändert lassen", () => {
    expect(getMcpToolName("srv", "get_user_profile")).toBe("mcp_srv_get_user_profile");
  });

  test("sollte mit Sonderzeichen im serverID-Teil umgehen", () => {
    expect(getMcpToolName("my.server-1", "tool_name")).toBe("mcp_my.server-1_tool_name");
  });

  test("sollte leere Strings zusammensetzen können", () => {
    expect(getMcpToolName("", "")).toBe("mcp__");
  });
});

// ---------------------------------------------------------------------------
// parseMcpToolName
// ---------------------------------------------------------------------------

describe("parseMcpToolName", () => {
  test("sollte einen gültigen Namen korrekt in serverId und toolName aufteilen", () => {
    const result = parseMcpToolName("mcp_my-server_do_thing");
    expect(result).not.toBeNull();
    expect(result!.serverId).toBe("my-server");
    expect(result!.toolName).toBe("do_thing");
  });

  test("sollte einfaches mcp_server_tool parsen", () => {
    const result = parseMcpToolName("mcp_server_tool");
    expect(result).not.toBeNull();
    expect(result!.serverId).toBe("server");
    expect(result!.toolName).toBe("tool");
  });

  test("sollte null zurückgeben wenn das Präfix fehlt", () => {
    expect(parseMcpToolName("do_thing")).toBeNull();
  });

  test("sollte null zurückgeben für einen leeren String", () => {
    expect(parseMcpToolName("")).toBeNull();
  });

  test("sollte null zurückgeben wenn nur mcp_ vorhanden ist", () => {
    expect(parseMcpToolName("mcp_")).toBeNull();
  });

  test("sollte null zurückgeben für mcp_server ohne toolName-Segment", () => {
    // "mcp_server" has only one segment after the prefix — no toolName
    expect(parseMcpToolName("mcp_server")).toBeNull();
  });

  test("sollte null zurückgeben bei einem anderen Präfix", () => {
    expect(parseMcpToolName("tool_server_name")).toBeNull();
  });

  test("sollte einen Tool-Namen mit mehreren Unterstrichen korrekt parsen", () => {
    // Regex captures: serverId = first non-underscore segment, toolName = everything after
    const result = parseMcpToolName("mcp_srv_get_user_profile");
    expect(result).not.toBeNull();
    expect(result!.serverId).toBe("srv");
    expect(result!.toolName).toBe("get_user_profile");
  });

  test("sollte getMcpToolName und parseMcpToolName als Inverse verifizieren", () => {
    const original = { serverId: "my-server", toolName: "do_thing" };
    const combined = getMcpToolName(original.serverId, original.toolName);
    const parsed = parseMcpToolName(combined);
    expect(parsed).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// McpToolWrapper
// ---------------------------------------------------------------------------

describe("McpToolWrapper", () => {
  beforeEach(() => {
    mockClientState.callToolResult = "tool output";
    mockClientState.callToolError = null;
    mockClientState.connectionStatus = "connected";
    mockClientState.lastCallServerId = undefined;
    mockClientState.lastCallToolName = undefined;
    mockClientState.lastCallArgs = undefined;
  });

  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("sollte den korrekten Tool-Namen mit mcp_-Präfix setzen", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(wrapper.name).toBe("mcp_my-server_do_thing");
    });

    test("sollte den Typ 'mcp' haben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(wrapper.type).toBe("mcp");
    });

    test("sollte die originale toolInfo speichern", () => {
      const info = makeToolInfo({ name: "list_files" });
      const wrapper = new McpToolWrapper(info);
      expect(wrapper.getMcpInfo()).toBe(info);
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("sollte eine ToolDefinition vom Typ 'function' zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      const def = wrapper.getDefinition();
      expect(def.type).toBe("function");
    });

    test("sollte den korrekten Tool-Namen in der Definition setzen", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      const def = wrapper.getDefinition();
      expect(def.function.name).toBe("mcp_my-server_do_thing");
    });

    test("sollte die Beschreibung mit [MCP: serverName] als Präfix versehen", () => {
      const wrapper = new McpToolWrapper(
        makeToolInfo({ serverName: "My Server", description: "Does a thing" })
      );
      const def = wrapper.getDefinition();
      expect(def.function.description).toBe("[MCP: My Server] Does a thing");
    });

    test("sollte Parameter vom leeren inputSchema als leeres object zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo({ inputSchema: {} }));
      const def = wrapper.getDefinition();
      expect(def.function.parameters.type).toBe("object");
      expect(def.function.parameters.properties).toEqual({});
      expect(def.function.parameters.required).toEqual([]);
    });

    test("sollte Eigenschaften aus dem inputSchema in Parameter konvertieren", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            query: { type: "string", description: "The search query" },
            limit: { type: "number", description: "Max results" },
          },
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.properties).toHaveProperty("query");
      expect(params.properties.query!.type).toBe("string");
      expect(params.properties.query!.description).toBe("The search query");
      expect(params.properties).toHaveProperty("limit");
      expect(params.properties.limit!.type).toBe("number");
    });

    test("sollte required-Felder aus dem inputSchema übernehmen", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            query: { type: "string", description: "Query" },
            format: { type: "string", description: "Output format" },
          },
          required: ["query"],
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.required).toContain("query");
      expect(params.required).not.toContain("format");
    });

    test("sollte enum-Werte aus dem inputSchema übernehmen", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            format: {
              type: "string",
              description: "Output format",
              enum: ["json", "text", "csv"],
            },
          },
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.properties.format!.enum).toEqual(["json", "text", "csv"]);
    });

    test("sollte keinen enum-Schlüssel setzen wenn keine enum-Werte vorhanden sind", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            query: { type: "string", description: "Query" },
          },
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.properties.query).not.toHaveProperty("enum");
    });

    test("sollte 'string' als Standard-Typ setzen wenn kein Typ angegeben ist", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            input: { description: "Some input" },
          },
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.properties.input!.type).toBe("string");
    });

    test("sollte leere Beschreibung als Standard setzen wenn keine Beschreibung angegeben ist", () => {
      const info = makeToolInfo({
        inputSchema: {
          properties: {
            input: { type: "string" },
          },
        },
      });
      const wrapper = new McpToolWrapper(info);
      const params = wrapper.getDefinition().function.parameters;
      expect(params.properties.input!.description).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // execute
  // -------------------------------------------------------------------------

  describe("execute()", () => {
    test("sollte mcpClient.callTool mit der serverId des Servers aufrufen", async () => {
      const wrapper = new McpToolWrapper(makeToolInfo({ serverId: "my-server" }));
      await wrapper.execute({ query: "hello" });
      expect(mockClientState.lastCallServerId).toBe("my-server");
    });

    test("sollte mcpClient.callTool mit dem originalen Tool-Namen (ohne Präfix) aufrufen", async () => {
      const wrapper = new McpToolWrapper(makeToolInfo({ name: "do_thing" }));
      await wrapper.execute({ query: "hello" });
      expect(mockClientState.lastCallToolName).toBe("do_thing");
    });

    test("sollte mcpClient.callTool mit den übergebenen Argumenten aufrufen", async () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      await wrapper.execute({ query: "hello", limit: 5 });
      expect(mockClientState.lastCallArgs).toEqual({ query: "hello", limit: 5 });
    });

    test("sollte das Ergebnis von mcpClient.callTool zurückgeben", async () => {
      mockClientState.callToolResult = "search results";
      const wrapper = new McpToolWrapper(makeToolInfo());
      const result = await wrapper.execute({ query: "test" });
      expect(result).toBe("search results");
    });

    test("sollte eine Fehlermeldung zurückgeben wenn callTool eine Exception wirft", async () => {
      mockClientState.callToolError = new Error("connection lost");
      const wrapper = new McpToolWrapper(makeToolInfo());
      const result = await wrapper.execute({});
      expect(result).toContain("Error calling MCP tool");
      expect(result).toContain("connection lost");
    });

    test("sollte keine Exception werfen wenn callTool fehlschlägt", async () => {
      mockClientState.callToolError = new Error("server error");
      const wrapper = new McpToolWrapper(makeToolInfo());
      await expect(wrapper.execute({})).resolves.toBeDefined();
    });

    test("sollte leere Argumente weitergeben", async () => {
      mockClientState.callToolResult = "empty args result";
      const wrapper = new McpToolWrapper(makeToolInfo());
      const result = await wrapper.execute({});
      expect(result).toBe("empty args result");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("sollte true zurückgeben wenn der Verbindungsstatus 'connected' ist", async () => {
      mockClientState.connectionStatus = "connected";
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(await wrapper.isAvailable()).toBe(true);
    });

    test("sollte false zurückgeben wenn der Verbindungsstatus 'disconnected' ist", async () => {
      mockClientState.connectionStatus = "disconnected";
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(await wrapper.isAvailable()).toBe(false);
    });

    test("sollte false zurückgeben wenn der Verbindungsstatus 'error' ist", async () => {
      mockClientState.connectionStatus = "error";
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(await wrapper.isAvailable()).toBe(false);
    });

    test("sollte false zurückgeben wenn der Verbindungsstatus 'connecting' ist", async () => {
      mockClientState.connectionStatus = "connecting";
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(await wrapper.isAvailable()).toBe(false);
    });

    test("sollte false zurückgeben wenn getConnection undefined zurückgibt", async () => {
      mockClientState.connectionStatus = null;
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(await wrapper.isAvailable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("sollte den korrekten Tool-Namen zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(wrapper.getMetadata().name).toBe("mcp_my-server_do_thing");
    });

    test("sollte die originale Beschreibung zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo({ description: "Does a thing" }));
      expect(wrapper.getMetadata().description).toBe("Does a thing");
    });

    test("sollte den Typ 'mcp' zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo());
      expect(wrapper.getMetadata().type).toBe("mcp");
    });

    test("sollte die Kategorie als mcp-{serverId} zurückgeben", () => {
      const wrapper = new McpToolWrapper(makeToolInfo({ serverId: "my-server" }));
      expect(wrapper.getMetadata().category).toBe("mcp-my-server");
    });
  });

  // -------------------------------------------------------------------------
  // getMcpInfo
  // -------------------------------------------------------------------------

  describe("getMcpInfo()", () => {
    test("sollte das originale McpToolInfo-Objekt zurückgeben", () => {
      const info = makeToolInfo({ name: "special_tool", serverId: "srv" });
      const wrapper = new McpToolWrapper(info);
      expect(wrapper.getMcpInfo()).toBe(info);
    });

    test("sollte alle Felder der originalen toolInfo unverändert enthalten", () => {
      const info: McpToolInfo = {
        name: "fetch_data",
        description: "Fetches data",
        serverId: "data-server",
        serverName: "Data Server",
        inputSchema: { properties: { url: { type: "string", description: "URL" } } },
      };
      const wrapper = new McpToolWrapper(info);
      const returned = wrapper.getMcpInfo();
      expect(returned.name).toBe("fetch_data");
      expect(returned.serverId).toBe("data-server");
      expect(returned.serverName).toBe("Data Server");
      expect(returned.inputSchema).toBe(info.inputSchema);
    });
  });
});

// ---------------------------------------------------------------------------
// createMcpToolWrappers
// ---------------------------------------------------------------------------

describe("createMcpToolWrappers()", () => {
  test("sollte ein Array von McpToolWrapper erstellen", () => {
    const tools = [makeToolInfo({ name: "tool_a" }), makeToolInfo({ name: "tool_b" })];
    const wrappers = createMcpToolWrappers(tools);
    expect(Array.isArray(wrappers)).toBe(true);
    expect(wrappers).toHaveLength(2);
  });

  test("sollte für jedes McpToolInfo einen Wrapper mit korrektem Namen erzeugen", () => {
    const tools = [
      makeToolInfo({ name: "tool_a", serverId: "srv" }),
      makeToolInfo({ name: "tool_b", serverId: "srv" }),
    ];
    const wrappers = createMcpToolWrappers(tools);
    expect(wrappers[0]!.name).toBe("mcp_srv_tool_a");
    expect(wrappers[1]!.name).toBe("mcp_srv_tool_b");
  });

  test("sollte McpToolWrapper-Instanzen zurückgeben", () => {
    const wrappers = createMcpToolWrappers([makeToolInfo()]);
    expect(wrappers[0]).toBeInstanceOf(McpToolWrapper);
  });

  test("sollte ein leeres Array zurückgeben wenn keine Tools übergeben werden", () => {
    const wrappers = createMcpToolWrappers([]);
    expect(wrappers).toHaveLength(0);
  });

  test("sollte die originale toolInfo in jedem Wrapper speichern", () => {
    const info = makeToolInfo({ name: "my_tool" });
    const wrappers = createMcpToolWrappers([info]);
    expect(wrappers[0]!.getMcpInfo()).toBe(info);
  });

  test("sollte mehrere Wrapper für Tools von verschiedenen Servern erzeugen", () => {
    const tools = [
      makeToolInfo({ name: "search", serverId: "server-a", serverName: "Server A" }),
      makeToolInfo({ name: "write", serverId: "server-b", serverName: "Server B" }),
    ];
    const wrappers = createMcpToolWrappers(tools);
    expect(wrappers[0]!.name).toBe("mcp_server-a_search");
    expect(wrappers[1]!.name).toBe("mcp_server-b_write");
  });
});
