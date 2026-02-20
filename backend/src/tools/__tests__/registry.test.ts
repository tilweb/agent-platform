/**
 * Tests for ToolRegistry (backend/src/tools/registry.ts)
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { ToolRegistry } from "../registry";
import type { Tool, ToolCall, ToolType } from "../types";
import type { ConnectionTool } from "../../connections/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTool(overrides: Partial<Tool> & { name?: string; type?: ToolType } = {}): Tool {
  const name = overrides.name ?? "test_tool";
  return {
    name,
    type: overrides.type ?? "local",
    getDefinition: () => ({
      type: "function",
      function: {
        name,
        description: "A test tool",
        parameters: { type: "object", properties: {}, required: [] },
      },
    }),
    execute: overrides.execute ?? (async () => "result"),
    ...(overrides.isAvailable ? { isAvailable: overrides.isAvailable } : {}),
  };
}

function makeConnectionTool(name: string, providerId: string): ConnectionTool {
  return {
    name,
    type: "connection",
    providerId,
    getDefinition: () => ({
      type: "function",
      function: {
        name,
        description: "A connection tool",
        parameters: { type: "object", properties: {}, required: [] },
      },
    }),
    execute: async () => "connection result",
  };
}

function makeToolCall(name: string, args: Record<string, any> = {}): ToolCall {
  return {
    id: "call-1",
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

// ---------------------------------------------------------------------------

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // -------------------------------------------------------------------------

  describe("register() und get()", () => {
    test("sollte ein registriertes Tool per Name abrufen", () => {
      const tool = makeTool({ name: "my_tool" });
      registry.register(tool);
      expect(registry.get("my_tool")).toBe(tool);
    });

    test("sollte undefined zurückgeben wenn das Tool nicht existiert", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    test("sollte ein Tool durch ein neues ersetzen wenn der Name bereits vergeben ist", () => {
      const original = makeTool({ name: "dupe" });
      const replacement = makeTool({ name: "dupe", execute: async () => "replaced" });
      registry.register(original);
      registry.register(replacement);
      expect(registry.get("dupe")).toBe(replacement);
    });
  });

  // -------------------------------------------------------------------------

  describe("registerAll()", () => {
    test("sollte mehrere Tools gleichzeitig registrieren", () => {
      const tools = [
        makeTool({ name: "tool_a" }),
        makeTool({ name: "tool_b" }),
        makeTool({ name: "tool_c" }),
      ];
      registry.registerAll(tools);
      expect(registry.has("tool_a")).toBe(true);
      expect(registry.has("tool_b")).toBe(true);
      expect(registry.has("tool_c")).toBe(true);
    });

    test("sollte bei einer leeren Liste nichts tun", () => {
      registry.registerAll([]);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("unregister()", () => {
    test("sollte ein vorhandenes Tool entfernen und true zurückgeben", () => {
      registry.register(makeTool({ name: "to_remove" }));
      const removed = registry.unregister("to_remove");
      expect(removed).toBe(true);
      expect(registry.has("to_remove")).toBe(false);
    });

    test("sollte false zurückgeben wenn das Tool nicht existiert", () => {
      expect(registry.unregister("ghost")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("has()", () => {
    test("sollte true zurückgeben wenn das Tool registriert ist", () => {
      registry.register(makeTool({ name: "exists" }));
      expect(registry.has("exists")).toBe(true);
    });

    test("sollte false zurückgeben wenn das Tool nicht registriert ist", () => {
      expect(registry.has("missing")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("getByType()", () => {
    test("sollte nur Tools des angegebenen Typs zurückgeben", () => {
      registry.register(makeTool({ name: "local_1", type: "local" }));
      registry.register(makeTool({ name: "local_2", type: "local" }));
      registry.register(makeTool({ name: "api_1", type: "api" }));

      const localTools = registry.getByType("local");
      expect(localTools).toHaveLength(2);
      expect(localTools.every((t) => t.type === "local")).toBe(true);
    });

    test("sollte eine leere Liste zurückgeben wenn kein Tool des Typs vorhanden ist", () => {
      registry.register(makeTool({ name: "local_1", type: "local" }));
      expect(registry.getByType("mcp")).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("getEnabled()", () => {
    test("sollte alle Tools zurückgeben wenn keine disabled/enabled-Liste konfiguriert ist", () => {
      registry.register(makeTool({ name: "tool_a" }));
      registry.register(makeTool({ name: "tool_b" }));
      expect(registry.getEnabled()).toHaveLength(2);
    });

    test("sollte Tools aus der disabled-Liste ausschließen", () => {
      const reg = new ToolRegistry({ disabled: ["tool_b"] });
      reg.register(makeTool({ name: "tool_a" }));
      reg.register(makeTool({ name: "tool_b" }));
      const enabled = reg.getEnabled();
      expect(enabled.map((t) => t.name)).toContain("tool_a");
      expect(enabled.map((t) => t.name)).not.toContain("tool_b");
    });

    test("sollte nur Tools aus der enabled-Liste zurückgeben wenn diese gesetzt ist", () => {
      const reg = new ToolRegistry({ enabled: ["tool_a"] });
      reg.register(makeTool({ name: "tool_a" }));
      reg.register(makeTool({ name: "tool_b" }));
      const enabled = reg.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe("tool_a");
    });

    test("sollte Connection-Tools eines deaktivierten Plugins ausschließen", () => {
      const connTool = makeConnectionTool("github_issues", "github");
      registry.register(connTool);
      registry.setPluginDisabled("github", true);
      expect(registry.getEnabled()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("getForAgent()", () => {
    test("sollte genau die angefragten Tools zurückgeben", () => {
      registry.register(makeTool({ name: "tool_a" }));
      registry.register(makeTool({ name: "tool_b" }));
      registry.register(makeTool({ name: "tool_c" }));

      const result = registry.getForAgent(["tool_a", "tool_c"]);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toEqual(["tool_a", "tool_c"]);
    });

    test("sollte nicht vorhandene Tool-Namen stillschweigend überspringen", () => {
      registry.register(makeTool({ name: "real_tool" }));
      const result = registry.getForAgent(["real_tool", "ghost_tool"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("real_tool");
    });

    test("sollte Tools eines deaktivierten Plugins herausfiltern", () => {
      const connTool = makeConnectionTool("jira_create", "jira");
      registry.register(connTool);
      registry.setPluginDisabled("jira", true);
      const result = registry.getForAgent(["jira_create"]);
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute()", () => {
    test("sollte das Tool ausführen und das Ergebnis zurückgeben", async () => {
      registry.register(makeTool({ name: "echo", execute: async (args) => args.text }));
      const result = await registry.execute(makeToolCall("echo", { text: "hello" }));
      expect(result).toBe("hello");
    });

    test("sollte einen Fehler-String zurückgeben wenn das Tool unbekannt ist", async () => {
      const result = await registry.execute(makeToolCall("unknown_tool"));
      expect(result).toContain("Error");
      expect(result).toContain("unknown_tool");
    });

    test("sollte einen Fehler-String zurückgeben bei ungültigem JSON in den Argumenten", async () => {
      registry.register(makeTool({ name: "my_tool" }));
      const call: ToolCall = {
        id: "call-bad",
        type: "function",
        function: { name: "my_tool", arguments: "{ not valid json" },
      };
      const result = await registry.execute(call);
      expect(result).toContain("Error");
      expect(result.toLowerCase()).toContain("json");
    });

    test("sollte einen Fehler-String zurückgeben wenn isAvailable() false ergibt", async () => {
      registry.register(
        makeTool({ name: "unavailable", isAvailable: async () => false })
      );
      const result = await registry.execute(makeToolCall("unavailable"));
      expect(result).toContain("Error");
      expect(result).toContain("unavailable");
    });

    test("sollte einen Fehler-String zurückgeben wenn das Tool eine Exception wirft", async () => {
      registry.register(
        makeTool({
          name: "broken",
          execute: async () => {
            throw new Error("something went wrong");
          },
        })
      );
      const result = await registry.execute(makeToolCall("broken"));
      expect(result).toContain("Error");
      expect(result).toContain("broken");
    });

    test("sollte einen Fehler-String zurückgeben für ein deaktiviertes Plugin-Tool", async () => {
      const connTool = makeConnectionTool("slack_post", "slack");
      registry.register(connTool);
      registry.setPluginDisabled("slack", true);
      const result = await registry.execute(makeToolCall("slack_post"));
      expect(result).toContain("Error");
      expect(result).toContain("slack_post");
    });
  });

  // -------------------------------------------------------------------------

  describe("setPluginDisabled()", () => {
    test("sollte ein Plugin aktivieren und deaktivieren können", () => {
      const connTool = makeConnectionTool("notion_read", "notion");
      registry.register(connTool);

      registry.setPluginDisabled("notion", true);
      expect(registry.getEnabled()).toHaveLength(0);

      registry.setPluginDisabled("notion", false);
      expect(registry.getEnabled()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------

  describe("getStats()", () => {
    test("sollte total=0 und ein leeres byType-Objekt zurückgeben wenn keine Tools registriert sind", () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });

    test("sollte die korrekte Anzahl pro Typ zählen", () => {
      registry.register(makeTool({ name: "local_1", type: "local" }));
      registry.register(makeTool({ name: "local_2", type: "local" }));
      registry.register(makeTool({ name: "api_1", type: "api" }));
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.local).toBe(2);
      expect(stats.byType.api).toBe(1);
    });
  });

  // -------------------------------------------------------------------------

  describe("clear()", () => {
    test("sollte alle registrierten Tools entfernen", () => {
      registry.register(makeTool({ name: "tool_a" }));
      registry.register(makeTool({ name: "tool_b" }));
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getNames()).toHaveLength(0);
    });
  });
});
