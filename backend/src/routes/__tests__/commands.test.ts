/**
 * Tests for commands API routes (backend/src/routes/commands.ts)
 *
 * All routes require auth middleware.
 * The commandRegistry singleton and auth/rateLimit middleware are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  getCommandsResult: [] as any[],
  getCommandResult: undefined as any,
  hasCommandResult: false,
  getOptionsResult: [] as any[],
  executeResult: { success: true, message: "OK" } as any,
};

// Mock auth barrel — re-exports authMiddleware from ./middleware
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
}));

// Mock rate limit middleware — pass-through so it never blocks tests
mock.module("../../middleware/rateLimit", () => ({
  uploadRateLimit: async (_c: any, next: any) => next(),
}));

// Mock error handler — delegate to real implementation for simplicity
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// Mock the command registry singleton
mock.module("../../commands/registry", () => ({
  commandRegistry: {
    getCommands: () => mockState.getCommandsResult,
    getCommand: (_id: string) => mockState.getCommandResult,
    has: (_id: string) => mockState.hasCommandResult,
    getOptions: async (_id: string) => mockState.getOptionsResult,
    execute: async (_command: string, _optionId?: string, _args?: string) =>
      mockState.executeResult,
  },
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { commandRoutes } = await import("../commands");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/commands", commandRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser() {
  return { id: "user-1", username: "alice", role: "user" as const };
}

function makeCommand(overrides: Partial<any> = {}): any {
  return {
    id: "agent",
    name: "Agent",
    description: "Switch to a different agent",
    icon: "🤖",
    hasOptions: true,
    requiresArg: false,
    ...overrides,
  };
}

function makeOption(overrides: Partial<any> = {}): any {
  return {
    id: "researcher",
    name: "Researcher",
    description: "Research agent",
    isActive: false,
    ...overrides,
  };
}

function jsonPost(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Commands Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.getCommandsResult = [];
  });

  test("should return 401 when no session is present on GET /", async () => {
    const res = await app.request("/api/commands");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 401 when no session is present on GET /:id", async () => {
    const res = await app.request("/api/commands/agent");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present on GET /:id/options", async () => {
    const res = await app.request("/api/commands/agent/options");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present on POST /execute", async () => {
    const res = await jsonPost("/api/commands/execute", { command: "agent" });
    expect(res.status).toBe(401);
  });

  test("should allow access for authenticated user", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/commands");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/commands", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getCommandsResult = [];
  });

  test("should return empty commands array when registry is empty", async () => {
    const res = await app.request("/api/commands");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("commands");
    expect(body.commands).toEqual([]);
  });

  test("should return all registered commands", async () => {
    mockState.getCommandsResult = [
      makeCommand({ id: "agent" }),
      makeCommand({ id: "model", name: "Model", description: "Switch model" }),
    ];
    const res = await app.request("/api/commands");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commands).toHaveLength(2);
    expect(body.commands[0].id).toBe("agent");
    expect(body.commands[1].id).toBe("model");
  });

  test("should include all command fields in the response", async () => {
    mockState.getCommandsResult = [
      makeCommand({ id: "clear", name: "Clear", hasOptions: false, requiresArg: false }),
    ];
    const res = await app.request("/api/commands");
    const body = await res.json();
    const cmd = body.commands[0];
    expect(cmd.id).toBe("clear");
    expect(cmd.name).toBe("Clear");
    expect(cmd).toHaveProperty("description");
    expect(cmd).toHaveProperty("hasOptions");
    expect(cmd).toHaveProperty("requiresArg");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/commands/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.getCommandResult = undefined;
  });

  test("should return 404 when command does not exist", async () => {
    mockState.getCommandResult = undefined;
    const res = await app.request("/api/commands/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBe("Command not found");
  });

  test("should return the command when it exists", async () => {
    mockState.getCommandResult = makeCommand({ id: "agent" });
    const res = await app.request("/api/commands/agent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("command");
    expect(body.command.id).toBe("agent");
  });

  test("should include all command fields for the returned command", async () => {
    mockState.getCommandResult = makeCommand({
      id: "model",
      name: "Model",
      description: "Switch model",
      icon: "🧠",
      hasOptions: true,
      requiresArg: false,
    });
    const res = await app.request("/api/commands/model");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.command.name).toBe("Model");
    expect(body.command.icon).toBe("🧠");
    expect(body.command.hasOptions).toBe(true);
  });

  test("should use the path parameter as the command ID lookup key", async () => {
    mockState.getCommandResult = makeCommand({ id: "skill" });
    const res = await app.request("/api/commands/skill");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.command.id).toBe("skill");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/commands/:id/options", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.hasCommandResult = false;
    mockState.getOptionsResult = [];
  });

  test("should return 404 when command does not exist", async () => {
    mockState.hasCommandResult = false;
    const res = await app.request("/api/commands/unknown/options");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Command not found");
  });

  test("should return empty options array when command has no options", async () => {
    mockState.hasCommandResult = true;
    mockState.getOptionsResult = [];
    const res = await app.request("/api/commands/clear/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("options");
    expect(body.options).toEqual([]);
  });

  test("should return all options for a command", async () => {
    mockState.hasCommandResult = true;
    mockState.getOptionsResult = [
      makeOption({ id: "researcher", name: "Researcher" }),
      makeOption({ id: "coder", name: "Coder" }),
    ];
    const res = await app.request("/api/commands/agent/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options).toHaveLength(2);
    expect(body.options[0].id).toBe("researcher");
    expect(body.options[1].id).toBe("coder");
  });

  test("should include option fields in the response", async () => {
    mockState.hasCommandResult = true;
    mockState.getOptionsResult = [
      makeOption({ id: "gpt-4o", name: "GPT-4o", description: "OpenAI GPT-4o", isActive: true }),
    ];
    const res = await app.request("/api/commands/model/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    const opt = body.options[0];
    expect(opt.id).toBe("gpt-4o");
    expect(opt.name).toBe("GPT-4o");
    expect(opt.description).toBe("OpenAI GPT-4o");
    expect(opt.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/commands/execute", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.executeResult = { success: true, message: "Befehl ausgeführt" };
  });

  test("should return 400 when command field is missing", async () => {
    const res = await jsonPost("/api/commands/execute", { optionId: "researcher" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBe("Command is required");
  });

  test("should return 400 when command field is empty string", async () => {
    const res = await jsonPost("/api/commands/execute", { command: "" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Command is required");
  });

  test("should return the execution result on success", async () => {
    mockState.executeResult = {
      success: true,
      message: "Agent gewechselt",
      action: { type: "agent_changed", payload: { agentId: "researcher" } },
    };
    const res = await jsonPost("/api/commands/execute", {
      command: "agent",
      optionId: "researcher",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Agent gewechselt");
    expect(body.action.type).toBe("agent_changed");
  });

  test("should return failed execution result when command is unknown", async () => {
    mockState.executeResult = {
      success: false,
      message: "Unbekannter Befehl: /bogus",
    };
    const res = await jsonPost("/api/commands/execute", { command: "bogus" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("bogus");
  });

  test("should pass optionId and args to execute", async () => {
    mockState.executeResult = {
      success: true,
      message: "Modell gewechselt",
      action: { type: "model_changed", payload: { model: "gpt-4o" } },
    };
    const res = await jsonPost("/api/commands/execute", {
      command: "model",
      optionId: "gpt-4o",
      args: "extra arg",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action.payload.model).toBe("gpt-4o");
  });

  test("should work when only command is provided with no optionId or args", async () => {
    mockState.executeResult = { success: true, message: "Chat geleert" };
    const res = await jsonPost("/api/commands/execute", { command: "clear" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return action payload in result when present", async () => {
    mockState.executeResult = {
      success: true,
      message: "Neuer Chat",
      action: { type: "new_chat", payload: null },
    };
    const res = await jsonPost("/api/commands/execute", { command: "new" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("action");
    expect(body.action.type).toBe("new_chat");
  });
});
