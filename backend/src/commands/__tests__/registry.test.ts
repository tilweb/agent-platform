/**
 * Tests for CommandRegistry (backend/src/commands/registry.ts)
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { commandRegistry } from "../../commands/registry";
import type { Command, CommandOption, CommandRegistration } from "../../commands/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: overrides.id ?? "test-cmd",
    name: overrides.name ?? "Test Command",
    description: overrides.description ?? "A test command",
    hasOptions: overrides.hasOptions ?? false,
    requiresArg: overrides.requiresArg ?? false,
    ...overrides,
  };
}

function makeRegistration(
  commandOverrides: Partial<Command> = {},
  opts?: {
    getOptions?: () => Promise<CommandOption[]>;
    execute?: (optionId?: string, args?: string) => Promise<{ success: boolean; message: string }>;
  }
): CommandRegistration {
  return {
    command: makeCommand(commandOverrides),
    getOptions: opts?.getOptions,
    execute:
      opts?.execute ??
      (async (optionId, args) => ({
        success: true,
        message: `executed: ${commandOverrides.id ?? "test-cmd"} optionId=${optionId} args=${args}`,
      })),
  };
}

// ---------------------------------------------------------------------------

describe("CommandRegistry", () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  // -------------------------------------------------------------------------

  describe("register() und getCommands()", () => {
    test("sollte einen registrierten Befehl in getCommands() zurückgeben", () => {
      const registration = makeRegistration({ id: "help", name: "Hilfe" });
      commandRegistry.register(registration);

      const commands = commandRegistry.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].id).toBe("help");
      expect(commands[0].name).toBe("Hilfe");
    });

    test("sollte mehrere Befehle unabhängig voneinander registrieren", () => {
      commandRegistry.register(makeRegistration({ id: "cmd-a" }));
      commandRegistry.register(makeRegistration({ id: "cmd-b" }));
      commandRegistry.register(makeRegistration({ id: "cmd-c" }));

      const commands = commandRegistry.getCommands();
      expect(commands).toHaveLength(3);
      const ids = commands.map((c) => c.id);
      expect(ids).toContain("cmd-a");
      expect(ids).toContain("cmd-b");
      expect(ids).toContain("cmd-c");
    });

    test("sollte einen Befehl mit gleichem ID überschreiben", () => {
      commandRegistry.register(makeRegistration({ id: "dupe", name: "Original" }));
      commandRegistry.register(makeRegistration({ id: "dupe", name: "Ersatz" }));

      const commands = commandRegistry.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("Ersatz");
    });

    test("sollte eine leere Liste zurückgeben wenn keine Befehle registriert sind", () => {
      expect(commandRegistry.getCommands()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("getCommand()", () => {
    test("sollte den Befehl per ID zurückgeben", () => {
      commandRegistry.register(makeRegistration({ id: "agent", name: "Agent wechseln" }));

      const cmd = commandRegistry.getCommand("agent");
      expect(cmd).toBeDefined();
      expect(cmd!.id).toBe("agent");
      expect(cmd!.name).toBe("Agent wechseln");
    });

    test("sollte undefined zurückgeben wenn die ID nicht existiert", () => {
      commandRegistry.register(makeRegistration({ id: "existing" }));
      expect(commandRegistry.getCommand("nonexistent")).toBeUndefined();
    });

    test("sollte undefined zurückgeben wenn keine Befehle registriert sind", () => {
      expect(commandRegistry.getCommand("any")).toBeUndefined();
    });

    test("sollte alle Command-Felder korrekt zurückgeben", () => {
      const registration = makeRegistration({
        id: "model",
        name: "Modell wechseln",
        description: "Wechselt das aktive Sprachmodell",
        hasOptions: true,
        requiresArg: false,
        argPlaceholder: "Modell auswählen...",
        icon: "🤖",
      });
      commandRegistry.register(registration);

      const cmd = commandRegistry.getCommand("model");
      expect(cmd!.hasOptions).toBe(true);
      expect(cmd!.requiresArg).toBe(false);
      expect(cmd!.argPlaceholder).toBe("Modell auswählen...");
      expect(cmd!.icon).toBe("🤖");
    });
  });

  // -------------------------------------------------------------------------

  describe("getOptions()", () => {
    test("sollte Optionen vom Provider zurückgeben", async () => {
      const options: CommandOption[] = [
        { id: "opt-1", name: "Option 1", description: "Erste Option" },
        { id: "opt-2", name: "Option 2", isActive: true },
      ];
      commandRegistry.register(
        makeRegistration({ id: "choose" }, { getOptions: async () => options })
      );

      const result = await commandRegistry.getOptions("choose");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("opt-1");
      expect(result[1].isActive).toBe(true);
    });

    test("sollte eine leere Liste zurückgeben wenn kein getOptions-Provider registriert ist", async () => {
      commandRegistry.register(makeRegistration({ id: "no-options" }));
      const result = await commandRegistry.getOptions("no-options");
      expect(result).toEqual([]);
    });

    test("sollte eine leere Liste zurückgeben für unbekannte Befehl-ID", async () => {
      const result = await commandRegistry.getOptions("unknown-id");
      expect(result).toEqual([]);
    });

    test("sollte Optionen mit meta-Feldern korrekt durchreichen", async () => {
      const options: CommandOption[] = [
        { id: "gpt-4o", name: "GPT-4o", meta: { provider: "openai", context: 128000 } },
      ];
      commandRegistry.register(
        makeRegistration({ id: "model" }, { getOptions: async () => options })
      );

      const result = await commandRegistry.getOptions("model");
      expect(result[0].meta?.provider).toBe("openai");
      expect(result[0].meta?.context).toBe(128000);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute()", () => {
    test("sollte den Handler mit optionId und args aufrufen und das Ergebnis zurückgeben", async () => {
      const received: { optionId?: string; args?: string }[] = [];
      commandRegistry.register(
        makeRegistration(
          { id: "run" },
          {
            execute: async (optionId, args) => {
              received.push({ optionId, args });
              return { success: true, message: "ok" };
            },
          }
        )
      );

      const result = await commandRegistry.execute("run", "opt-abc", "extra text");
      expect(result.success).toBe(true);
      expect(result.message).toBe("ok");
      expect(received).toHaveLength(1);
      expect(received[0].optionId).toBe("opt-abc");
      expect(received[0].args).toBe("extra text");
    });

    test("sollte den Handler ohne optionId und args aufrufen können", async () => {
      const received: { optionId?: string; args?: string }[] = [];
      commandRegistry.register(
        makeRegistration(
          { id: "bare" },
          {
            execute: async (optionId, args) => {
              received.push({ optionId, args });
              return { success: true, message: "bare executed" };
            },
          }
        )
      );

      await commandRegistry.execute("bare");
      expect(received[0].optionId).toBeUndefined();
      expect(received[0].args).toBeUndefined();
    });

    test("sollte einen Fehler zurückgeben für unbekannte Befehl-ID", async () => {
      const result = await commandRegistry.execute("ghost-cmd");
      expect(result.success).toBe(false);
      expect(result.message).toContain("ghost-cmd");
      expect(result.message).toContain("Unbekannter Befehl");
    });

    test("sollte eine action im Ergebnis durchreichen können", async () => {
      commandRegistry.register(
        makeRegistration(
          { id: "switch" },
          {
            execute: async () => ({
              success: true,
              message: "Agent gewechselt",
              action: { type: "agent_changed" as const, payload: { agentId: "researcher" } },
            }),
          }
        )
      );

      const result = await commandRegistry.execute("switch", "researcher");
      expect(result.success).toBe(true);
      expect(result.action?.type).toBe("agent_changed");
      expect(result.action?.payload?.agentId).toBe("researcher");
    });

    test("sollte einen Fehlschlag des Handlers unverändert zurückgeben", async () => {
      commandRegistry.register(
        makeRegistration(
          { id: "fail-cmd" },
          {
            execute: async () => ({ success: false, message: "Aktion nicht erlaubt" }),
          }
        )
      );

      const result = await commandRegistry.execute("fail-cmd");
      expect(result.success).toBe(false);
      expect(result.message).toBe("Aktion nicht erlaubt");
    });
  });

  // -------------------------------------------------------------------------

  describe("has()", () => {
    test("sollte true zurückgeben wenn der Befehl registriert ist", () => {
      commandRegistry.register(makeRegistration({ id: "exists" }));
      expect(commandRegistry.has("exists")).toBe(true);
    });

    test("sollte false zurückgeben wenn der Befehl nicht registriert ist", () => {
      expect(commandRegistry.has("missing")).toBe(false);
    });

    test("sollte false zurückgeben wenn das Registry leer ist", () => {
      expect(commandRegistry.has("anything")).toBe(false);
    });

    test("sollte nach Überschreiben weiterhin true zurückgeben", () => {
      commandRegistry.register(makeRegistration({ id: "overwrite-me", name: "v1" }));
      commandRegistry.register(makeRegistration({ id: "overwrite-me", name: "v2" }));
      expect(commandRegistry.has("overwrite-me")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("clear()", () => {
    test("sollte alle registrierten Befehle entfernen", () => {
      commandRegistry.register(makeRegistration({ id: "cmd-1" }));
      commandRegistry.register(makeRegistration({ id: "cmd-2" }));
      commandRegistry.register(makeRegistration({ id: "cmd-3" }));

      commandRegistry.clear();

      expect(commandRegistry.getCommands()).toHaveLength(0);
      expect(commandRegistry.has("cmd-1")).toBe(false);
      expect(commandRegistry.has("cmd-2")).toBe(false);
      expect(commandRegistry.has("cmd-3")).toBe(false);
    });

    test("sollte nach clear() neue Befehle wieder annehmen", () => {
      commandRegistry.register(makeRegistration({ id: "old-cmd" }));
      commandRegistry.clear();
      commandRegistry.register(makeRegistration({ id: "new-cmd" }));

      expect(commandRegistry.getCommands()).toHaveLength(1);
      expect(commandRegistry.has("new-cmd")).toBe(true);
      expect(commandRegistry.has("old-cmd")).toBe(false);
    });

    test("sollte auf einem leeren Registry keine Fehler werfen", () => {
      expect(() => commandRegistry.clear()).not.toThrow();
      expect(commandRegistry.getCommands()).toHaveLength(0);
    });
  });
});
