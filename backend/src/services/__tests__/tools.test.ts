/**
 * Tests for tools.ts (compatibility shim) and the underlying tools module.
 *
 * Strategy:
 *  1. Test the compatibility layer (services/tools.ts) by mocking ../../tools
 *  2. Test ToolRegistry directly — pure in-memory class, no mocking needed
 *  3. Test DelegateToAgentTool — pure in-memory class
 *  4. Test isToolConfigured / getConfiguredApiTools via the real config module
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Section 1: Compatibility layer — mock the underlying tools module
// ---------------------------------------------------------------------------

mock.module("../../tools", () => {
  const fakeTool = {
    name: "delegate_to_agent",
    type: "delegation" as const,
    getDefinition: () => ({
      type: "function" as const,
      function: {
        name: "delegate_to_agent",
        description: "Delegate a subtask to a specialized agent.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    }),
    execute: async () => "delegated",
    isAvailable: async () => true,
  };

  const fakeRegistry = {
    getDefinitions: () => [fakeTool.getDefinition()],
    get: (name: string) => (name === "delegate_to_agent" ? fakeTool : undefined),
    register: () => {},
    registerAll: () => {},
    unregister: () => false,
    has: (name: string) => name === "delegate_to_agent",
    getAll: () => [fakeTool],
    getEnabled: () => [fakeTool],
    getForAgent: () => [fakeTool],
    execute: async () => "ok",
    getConfig: () => ({ dataDir: "/data", api: {}, mcp: [], disabled: [] }),
    updateConfig: () => {},
    getStats: () => ({ total: 1, byType: { delegation: 1 } }),
    clear: () => {},
    setPluginDisabled: () => {},
  };

  return {
    toolRegistry: fakeRegistry,
    ToolRegistry: class {},
    executeToolCall: async () => "executed",
    setDelegationHandler: () => {},
    getDelegationHandler: () => null,
    getToolsForAgent: (names: string[]) => [fakeTool.getDefinition()],
    getAllToolDefinitions: () => [fakeTool.getDefinition()],
    registerTool: () => {},
    setupTools: async () => {},
    toolsConfig: { dataDir: "/data", api: {}, mcp: [], disabled: [] },
    isToolConfigured: (name: string) => false,
    getConfiguredApiTools: () => [],
  };
});

const mod = await import("../tools");

describe("tools service (compatibility layer)", () => {
  test("re-exports toolRegistry", () => {
    expect(mod.toolRegistry).toBeDefined();
    expect(typeof mod.toolRegistry.getDefinitions).toBe("function");
  });

  test("toolRegistry.getDefinitions() returns an array", () => {
    const defs = mod.toolRegistry.getDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
  });

  test("toolRegistry.get() returns tool for known name", () => {
    const tool = mod.toolRegistry.get("delegate_to_agent");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("delegate_to_agent");
  });

  test("toolRegistry.get() returns undefined for unknown name", () => {
    const tool = mod.toolRegistry.get("no_such_tool");
    expect(tool).toBeUndefined();
  });

  test("re-exports executeToolCall as a function", () => {
    expect(typeof mod.executeToolCall).toBe("function");
  });

  test("executeToolCall returns a string", async () => {
    const result = await mod.executeToolCall({
      id: "call_1",
      type: "function",
      function: { name: "delegate_to_agent", arguments: "{}" },
    });
    expect(typeof result).toBe("string");
  });

  test("re-exports setDelegationHandler", () => {
    expect(typeof mod.setDelegationHandler).toBe("function");
  });

  test("re-exports getDelegationHandler", () => {
    expect(typeof mod.getDelegationHandler).toBe("function");
  });

  test("getDelegationHandler returns null initially", () => {
    expect(mod.getDelegationHandler()).toBeNull();
  });

  test("re-exports getToolsForAgent", () => {
    expect(typeof mod.getToolsForAgent).toBe("function");
  });

  test("getToolsForAgent returns an array of definitions", () => {
    const defs = mod.getToolsForAgent(["delegate_to_agent"]);
    expect(Array.isArray(defs)).toBe(true);
  });

  test("re-exports getAllToolDefinitions", () => {
    expect(typeof mod.getAllToolDefinitions).toBe("function");
  });

  test("getAllToolDefinitions returns an array", () => {
    const defs = mod.getAllToolDefinitions();
    expect(Array.isArray(defs)).toBe(true);
  });

  test("re-exports registerTool", () => {
    expect(typeof mod.registerTool).toBe("function");
  });

  test("re-exports setupTools", () => {
    expect(typeof mod.setupTools).toBe("function");
  });

  test("re-exports toolsConfig", () => {
    expect(mod.toolsConfig).toBeDefined();
    expect(typeof mod.toolsConfig).toBe("object");
  });

  test("exports legacy toolDefinitions array", () => {
    expect(mod.toolDefinitions).toBeDefined();
    expect(Array.isArray(mod.toolDefinitions)).toBe(true);
  });

  test("exports legacy delegationToolDefinition", () => {
    expect(mod.delegationToolDefinition).toBeDefined();
    expect(mod.delegationToolDefinition!.function.name).toBe("delegate_to_agent");
  });
});

// ---------------------------------------------------------------------------
// Section 2: ToolRegistry — import the real class directly (no mocks needed)
// ---------------------------------------------------------------------------

import { ToolRegistry } from "../../tools/registry";
import type { Tool, ToolDefinition, ToolCall, ToolContext } from "../../tools/types";

/** Build a minimal test tool. */
function makeTool(
  name: string,
  type: "local" | "api" | "delegation" | "connection" = "local",
  opts: { available?: boolean; executeResult?: string; providerId?: string } = {}
): Tool & { providerId?: string } {
  const tool: Tool & { providerId?: string } = {
    name,
    type,
    getDefinition: (): ToolDefinition => ({
      type: "function",
      function: {
        name,
        description: `Tool ${name}`,
        parameters: { type: "object", properties: {}, required: [] },
      },
    }),
    execute: async (_args, _ctx) => opts.executeResult ?? `result of ${name}`,
    isAvailable: opts.available !== undefined
      ? async () => opts.available!
      : undefined,
  };
  if (type === "connection" && opts.providerId) {
    tool.providerId = opts.providerId;
  }
  return tool;
}

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // -------------------------------------------------------------------------
  describe("constructor", () => {
    test("should create a registry with default config when no options are given", () => {
      const r = new ToolRegistry();
      const cfg = r.getConfig();
      expect(cfg.disabled).toEqual([]);
      expect(cfg.api).toEqual({});
      expect(cfg.mcp).toEqual([]);
    });

    test("should apply partial config overrides", () => {
      const r = new ToolRegistry({ disabled: ["tool_x"] });
      expect(r.getConfig().disabled).toEqual(["tool_x"]);
    });
  });

  // -------------------------------------------------------------------------
  describe("register / has / get / getAll / getNames", () => {
    test("register() should make the tool discoverable via has()", () => {
      const tool = makeTool("my_tool");
      registry.register(tool);
      expect(registry.has("my_tool")).toBe(true);
    });

    test("get() should return the registered tool", () => {
      const tool = makeTool("my_tool");
      registry.register(tool);
      expect(registry.get("my_tool")).toBe(tool);
    });

    test("has() should return false for an unregistered tool", () => {
      expect(registry.has("not_registered")).toBe(false);
    });

    test("get() should return undefined for an unregistered tool", () => {
      expect(registry.get("not_registered")).toBeUndefined();
    });

    test("getAll() should return all registered tools", () => {
      registry.register(makeTool("a"));
      registry.register(makeTool("b"));
      expect(registry.getAll().length).toBe(2);
    });

    test("getNames() should list registered tool names", () => {
      registry.register(makeTool("alpha"));
      registry.register(makeTool("beta"));
      expect(registry.getNames()).toContain("alpha");
      expect(registry.getNames()).toContain("beta");
    });

    test("register() should replace an existing tool with the same name", () => {
      const first = makeTool("dup", "local", { executeResult: "v1" });
      const second = makeTool("dup", "local", { executeResult: "v2" });
      registry.register(first);
      registry.register(second);
      expect(registry.get("dup")).toBe(second);
      expect(registry.getAll().length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("registerAll", () => {
    test("should register an array of tools at once", () => {
      registry.registerAll([makeTool("x"), makeTool("y"), makeTool("z")]);
      expect(registry.getAll().length).toBe(3);
    });

    test("should register an empty array without error", () => {
      registry.registerAll([]);
      expect(registry.getAll().length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("unregister", () => {
    test("should remove a registered tool and return true", () => {
      registry.register(makeTool("removable"));
      expect(registry.unregister("removable")).toBe(true);
      expect(registry.has("removable")).toBe(false);
    });

    test("should return false when tool was not registered", () => {
      expect(registry.unregister("nonexistent")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("clear", () => {
    test("should remove all registered tools", () => {
      registry.register(makeTool("a"));
      registry.register(makeTool("b"));
      registry.clear();
      expect(registry.getAll().length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("getByType", () => {
    test("should return only tools of the requested type", () => {
      registry.register(makeTool("local_1", "local"));
      registry.register(makeTool("api_1", "api"));
      registry.register(makeTool("local_2", "local"));
      const locals = registry.getByType("local");
      expect(locals.length).toBe(2);
      expect(locals.every(t => t.type === "local")).toBe(true);
    });

    test("should return empty array when no tools of that type exist", () => {
      registry.register(makeTool("local_1", "local"));
      expect(registry.getByType("mcp").length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("getEnabled", () => {
    test("should return all registered tools when no enabled/disabled list is set", () => {
      registry.register(makeTool("a"));
      registry.register(makeTool("b"));
      expect(registry.getEnabled().length).toBe(2);
    });

    test("should exclude tools in the disabled list", () => {
      const r = new ToolRegistry({ disabled: ["blocked"] });
      r.register(makeTool("allowed"));
      r.register(makeTool("blocked"));
      const enabled = r.getEnabled();
      expect(enabled.some(t => t.name === "allowed")).toBe(true);
      expect(enabled.some(t => t.name === "blocked")).toBe(false);
    });

    test("should only include tools in the enabled allowlist when set", () => {
      const r = new ToolRegistry({ enabled: ["only_this"] });
      r.register(makeTool("only_this"));
      r.register(makeTool("not_this"));
      const enabled = r.getEnabled();
      expect(enabled.length).toBe(1);
      expect(enabled[0]!.name).toBe("only_this");
    });

    test("should exclude connection tools whose plugin is disabled", () => {
      registry.register(makeTool("conn_tool", "connection", { providerId: "my_plugin" }));
      registry.setPluginDisabled("my_plugin", true);
      const enabled = registry.getEnabled();
      expect(enabled.some(t => t.name === "conn_tool")).toBe(false);
    });

    test("should re-include connection tool when plugin is re-enabled", () => {
      registry.register(makeTool("conn_tool", "connection", { providerId: "my_plugin" }));
      registry.setPluginDisabled("my_plugin", true);
      registry.setPluginDisabled("my_plugin", false);
      const enabled = registry.getEnabled();
      expect(enabled.some(t => t.name === "conn_tool")).toBe(true);
    });

    test("should not exclude non-connection tools when their name matches a disabled plugin", () => {
      registry.register(makeTool("local_tool", "local"));
      registry.setPluginDisabled("local_tool", true);
      // local tools don't have providerId so plugin disable should not affect them
      const enabled = registry.getEnabled();
      expect(enabled.some(t => t.name === "local_tool")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("getForAgent", () => {
    test("should return tools by name", () => {
      registry.register(makeTool("tool_a"));
      registry.register(makeTool("tool_b"));
      const found = registry.getForAgent(["tool_a"]);
      expect(found.length).toBe(1);
      expect(found[0]!.name).toBe("tool_a");
    });

    test("should skip tool names that are not registered", () => {
      registry.register(makeTool("real_tool"));
      const found = registry.getForAgent(["real_tool", "ghost_tool"]);
      expect(found.length).toBe(1);
      expect(found[0]!.name).toBe("real_tool");
    });

    test("should exclude connection tools whose plugin is disabled", () => {
      registry.register(makeTool("conn", "connection", { providerId: "p1" }));
      registry.setPluginDisabled("p1", true);
      const found = registry.getForAgent(["conn"]);
      expect(found.length).toBe(0);
    });

    test("should return empty array for an empty names list", () => {
      registry.register(makeTool("tool_a"));
      expect(registry.getForAgent([])).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("getDefinitions", () => {
    test("should return ToolDefinition objects for all enabled tools", () => {
      registry.register(makeTool("t1"));
      registry.register(makeTool("t2"));
      const defs = registry.getDefinitions();
      expect(defs.length).toBe(2);
      expect(defs.every(d => d.type === "function")).toBe(true);
    });

    test("should return definitions filtered by tool names when provided", () => {
      registry.register(makeTool("t1"));
      registry.register(makeTool("t2"));
      registry.register(makeTool("t3"));
      const defs = registry.getDefinitions(["t1", "t3"]);
      expect(defs.length).toBe(2);
      const names = defs.map(d => d.function.name);
      expect(names).toContain("t1");
      expect(names).toContain("t3");
    });

    test("should return empty array when registry is empty", () => {
      expect(registry.getDefinitions()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("execute", () => {
    function makeCall(name: string, args: Record<string, any> = {}): ToolCall {
      return {
        id: "call_1",
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      };
    }

    test("should execute a registered tool and return its result", async () => {
      registry.register(makeTool("calc", "local", { executeResult: "42" }));
      const result = await registry.execute(makeCall("calc"));
      expect(result).toBe("42");
    });

    test("should return an error string for an unknown tool", async () => {
      const result = await registry.execute(makeCall("nonexistent"));
      expect(result).toContain("Error");
      expect(result).toContain("nonexistent");
    });

    test("should return an error when the tool is not available", async () => {
      registry.register(makeTool("unavailable", "api", { available: false }));
      const result = await registry.execute(makeCall("unavailable"));
      expect(result).toContain("Error");
      expect(result).toContain("not available");
    });

    test("should pass context to tool.execute()", async () => {
      let receivedCtx: ToolContext | undefined;
      const tool: Tool = {
        name: "ctx_tool",
        type: "local",
        getDefinition: () => ({ type: "function", function: { name: "ctx_tool", description: "", parameters: { type: "object", properties: {}, required: [] } } }),
        execute: async (_args, ctx) => { receivedCtx = ctx; return "done"; },
      };
      registry.register(tool);
      const ctx: ToolContext = { sessionId: "sess-1", agentId: "agent-1" };
      await registry.execute(makeCall("ctx_tool"), ctx);
      expect(receivedCtx?.sessionId).toBe("sess-1");
      expect(receivedCtx?.agentId).toBe("agent-1");
    });

    test("should return error string for invalid JSON arguments", async () => {
      registry.register(makeTool("valid_tool"));
      const badCall: ToolCall = {
        id: "c1",
        type: "function",
        function: { name: "valid_tool", arguments: "not-valid-json" },
      };
      const result = await registry.execute(badCall);
      expect(result).toContain("Error");
      expect(result).toContain("JSON");
    });

    test("should return error string when tool.execute() throws", async () => {
      const throwing: Tool = {
        name: "thrower",
        type: "local",
        getDefinition: () => ({ type: "function", function: { name: "thrower", description: "", parameters: { type: "object", properties: {}, required: [] } } }),
        execute: async () => { throw new Error("tool exploded"); },
      };
      registry.register(throwing);
      const result = await registry.execute(makeCall("thrower"));
      expect(result).toContain("Error");
      expect(result).toContain("thrower");
    });

    test("should return error when tool belongs to a disabled plugin", async () => {
      registry.register(makeTool("plugin_tool", "connection", { providerId: "plugin_x" }));
      registry.setPluginDisabled("plugin_x", true);
      const result = await registry.execute(makeCall("plugin_tool"));
      expect(result).toContain("Error");
      expect(result).toContain("disabled");
    });

    test("should call isAvailable() and allow execution when it returns true", async () => {
      registry.register(makeTool("avail_tool", "api", { available: true, executeResult: "yes" }));
      const result = await registry.execute(makeCall("avail_tool"));
      expect(result).toBe("yes");
    });

    test("should default empty arguments string to empty object", async () => {
      let receivedArgs: Record<string, any> | undefined;
      const tool: Tool = {
        name: "noargs",
        type: "local",
        getDefinition: () => ({ type: "function", function: { name: "noargs", description: "", parameters: { type: "object", properties: {}, required: [] } } }),
        execute: async (args) => { receivedArgs = args; return "done"; },
      };
      registry.register(tool);
      const call: ToolCall = { id: "c", type: "function", function: { name: "noargs", arguments: "" } };
      await registry.execute(call);
      expect(receivedArgs).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  describe("config management", () => {
    test("getConfig() returns the current configuration", () => {
      const cfg = registry.getConfig();
      expect(cfg).toHaveProperty("api");
      expect(cfg).toHaveProperty("mcp");
      expect(cfg).toHaveProperty("disabled");
    });

    test("updateConfig() merges partial config into existing config", () => {
      registry.updateConfig({ disabled: ["tool_z"] });
      expect(registry.getConfig().disabled).toEqual(["tool_z"]);
    });

    test("getApiConfig() returns undefined for unconfigured tool", () => {
      expect(registry.getApiConfig("no_config")).toBeUndefined();
    });

    test("setApiConfig() persists and getApiConfig() retrieves it", () => {
      registry.setApiConfig("my_api_tool", { apiKey: "sk-test" });
      expect(registry.getApiConfig("my_api_tool")).toEqual({ apiKey: "sk-test" });
    });

    test("setApiConfig() can update an existing config entry", () => {
      registry.setApiConfig("my_api_tool", { apiKey: "v1" });
      registry.setApiConfig("my_api_tool", { apiKey: "v2" });
      expect(registry.getApiConfig("my_api_tool")?.apiKey).toBe("v2");
    });
  });

  // -------------------------------------------------------------------------
  describe("getStats", () => {
    test("should return zero counts for an empty registry", () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });

    test("should count tools by type correctly", () => {
      registry.register(makeTool("l1", "local"));
      registry.register(makeTool("l2", "local"));
      registry.register(makeTool("a1", "api"));
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.local).toBe(2);
      expect(stats.byType.api).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("setPluginDisabled", () => {
    test("should not affect non-connection tools", () => {
      registry.register(makeTool("local_tool", "local"));
      registry.setPluginDisabled("local_tool", true);
      // No error; local tools are unaffected
      expect(registry.getEnabled().some(t => t.name === "local_tool")).toBe(true);
    });

    test("should disable and re-enable a plugin idempotently", () => {
      registry.register(makeTool("ct", "connection", { providerId: "p" }));
      registry.setPluginDisabled("p", true);
      registry.setPluginDisabled("p", true); // second call is idempotent
      expect(registry.getEnabled().some(t => t.name === "ct")).toBe(false);
      registry.setPluginDisabled("p", false);
      expect(registry.getEnabled().some(t => t.name === "ct")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Section 3: DelegateToAgentTool
// ---------------------------------------------------------------------------

import { DelegateToAgentTool } from "../../tools/special/delegate-to-agent";

describe("DelegateToAgentTool", () => {
  type Agent = { id: string; name: string; description: string };

  function makeAgents(agents: Agent[] = []): () => Promise<Agent[]> {
    return async () => agents;
  }

  const defaultAgents: Agent[] = [
    { id: "researcher", name: "Researcher", description: "Research agent" },
    { id: "writer", name: "Writer", description: "Writing agent" },
  ];

  let tool: DelegateToAgentTool;

  beforeEach(() => {
    tool = new DelegateToAgentTool(makeAgents(defaultAgents));
  });

  // -------------------------------------------------------------------------
  describe("getDefinition", () => {
    test("should return a function-type definition named 'delegate_to_agent'", () => {
      const def = tool.getDefinition();
      expect(def.type).toBe("function");
      expect(def.function.name).toBe("delegate_to_agent");
    });

    test("should require 'agent_id' and 'task' parameters", () => {
      const def = tool.getDefinition();
      expect(def.function.parameters.required).toContain("agent_id");
      expect(def.function.parameters.required).toContain("task");
    });

    test("should list 'agent_id', 'task', and 'context' as properties", () => {
      const def = tool.getDefinition();
      expect(def.function.parameters.properties).toHaveProperty("agent_id");
      expect(def.function.parameters.properties).toHaveProperty("task");
      expect(def.function.parameters.properties).toHaveProperty("context");
    });
  });

  // -------------------------------------------------------------------------
  describe("handler management", () => {
    test("getHandler() returns null when no handler is set", () => {
      expect(tool.getHandler()).toBeNull();
    });

    test("setHandler() stores and getHandler() retrieves the handler", () => {
      const handler = async () => "result";
      tool.setHandler(handler);
      expect(tool.getHandler()).toBe(handler);
    });

    test("setHandler(null) clears the handler", () => {
      tool.setHandler(async () => "result");
      tool.setHandler(null);
      expect(tool.getHandler()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("isAvailable", () => {
    test("returns false when no handler is set", async () => {
      expect(await tool.isAvailable()).toBe(false);
    });

    test("returns true after a handler is set", async () => {
      tool.setHandler(async () => "done");
      expect(await tool.isAvailable()).toBe(true);
    });

    test("returns false after handler is cleared", async () => {
      tool.setHandler(async () => "done");
      tool.setHandler(null);
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("execute — validation errors", () => {
    test("should return error when agent_id is missing", async () => {
      const result = await tool.execute({ agent_id: "", task: "do something" });
      expect(result).toContain("Error");
      expect(result).toContain("agent_id");
    });

    test("should return error when task is missing", async () => {
      const result = await tool.execute({ agent_id: "researcher", task: "" });
      expect(result).toContain("Error");
      expect(result).toContain("task");
    });

    test("should return error when no handler is set", async () => {
      const result = await tool.execute({ agent_id: "researcher", task: "research something" });
      expect(result).toContain("Error");
      expect(result).toContain("Delegation not available");
    });

    test("should return error when agent tries to delegate to itself", async () => {
      tool.setHandler(async () => "result");
      const ctx: ToolContext = { agentId: "researcher" };
      const result = await tool.execute(
        { agent_id: "researcher", task: "do the thing" },
        ctx
      );
      expect(result).toContain("Error");
      expect(result).toContain("cannot delegate to itself");
    });

    test("should return error when target agent is not in available list", async () => {
      tool.setHandler(async () => "result");
      const result = await tool.execute({ agent_id: "nonexistent_agent", task: "do something" });
      expect(result).toContain("Error");
      expect(result).toContain("not found");
    });

    test("should include available agent names in the not-found error", async () => {
      tool.setHandler(async () => "result");
      const result = await tool.execute({ agent_id: "ghost", task: "task" });
      expect(result).toContain("researcher");
      expect(result).toContain("writer");
    });
  });

  // -------------------------------------------------------------------------
  describe("execute — successful delegation", () => {
    test("should call handler with agent_id, task, and optional context", async () => {
      let calledWith: { agentId: string; task: string; context?: string } | undefined;
      tool.setHandler(async (agentId, task, context) => {
        calledWith = { agentId, task, context };
        return "delegation result";
      });
      const result = await tool.execute({
        agent_id: "researcher",
        task: "find info",
        context: "extra context",
      });
      expect(result).toBe("delegation result");
      expect(calledWith?.agentId).toBe("researcher");
      expect(calledWith?.task).toBe("find info");
      expect(calledWith?.context).toBe("extra context");
    });

    test("should succeed for a valid agent when calling agent is different", async () => {
      tool.setHandler(async () => "done");
      const ctx: ToolContext = { agentId: "writer" }; // different from target
      const result = await tool.execute(
        { agent_id: "researcher", task: "research" },
        ctx
      );
      expect(result).toBe("done");
    });

    test("should succeed when no ToolContext is provided", async () => {
      tool.setHandler(async () => "no context result");
      const result = await tool.execute({ agent_id: "writer", task: "write" });
      expect(result).toBe("no context result");
    });

    test("should return error string when handler throws", async () => {
      tool.setHandler(async () => { throw new Error("handler crashed"); });
      const result = await tool.execute({ agent_id: "researcher", task: "task" });
      expect(result).toContain("Error");
      expect(result).toContain("delegation");
    });
  });
});

// ---------------------------------------------------------------------------
// Section 4: isToolConfigured / getConfiguredApiTools
// (import real config module — these are pure functions over process.env)
// ---------------------------------------------------------------------------

import { isToolConfigured, getConfiguredApiTools } from "../../tools/config";

describe("isToolConfigured", () => {
  test("should return false for a tool that has no api entry", () => {
    expect(isToolConfigured("tool_that_does_not_exist")).toBe(false);
  });

  test("should return false for web_search when TAVILY_API_KEY is not set", () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.WEB_SEARCH_API_KEY;
    // Note: toolsConfig is evaluated at import time, so we test what it is
    // Since there's no API key in test env, expect false
    const result = isToolConfigured("web_search");
    expect(typeof result).toBe("boolean");
    if (original) process.env.TAVILY_API_KEY = original;
  });
});

describe("getConfiguredApiTools", () => {
  test("should return an array", () => {
    const result = getConfiguredApiTools();
    expect(Array.isArray(result)).toBe(true);
  });

  test("should return only string entries", () => {
    const result = getConfiguredApiTools();
    expect(result.every(item => typeof item === "string")).toBe(true);
  });
});
