/**
 * Tests for agents API routes (backend/src/routes/agents.ts)
 *
 * All routes require auth middleware.
 * RBAC and service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  listAgentsResult: [] as any[],
  loadAgentResult: null as any,
  createAgentResult: null as any,
  updateAgentResult: null as any,
  canViewResult: { allowed: true, effectiveRole: "owner" } as any,
  canEditResult: { allowed: true, effectiveRole: "owner" } as any,
  canDeleteResult: { allowed: true, effectiveRole: "owner" } as any,
  listAccessibleResult: [] as any[],
};

// Mock auth — injects mockState.currentUser into context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

// Mock RBAC accessControl
mock.module("../../rbac/accessControl", () => ({
  canView: async () => mockState.canViewResult,
  canEdit: async () => mockState.canEditResult,
  canDelete: async () => mockState.canDeleteResult,
  canManageAccess: async () => ({ allowed: true }),
  listAccessibleResources: async () => mockState.listAccessibleResult,
}));

// Mock RBAC storage
mock.module("../../rbac/storage", () => ({
  initializeResourceAccess: async () => {},
  deleteResourceAccess: async () => {},
  hasAccessEntries: async () => false,
}));

// Mock agents service
mock.module("../../services/agents", () => ({
  listAgents: async () => mockState.listAgentsResult,
  loadAgent: async (_id: string) => mockState.loadAgentResult,
  createAgent: async (data: any) => mockState.createAgentResult || data,
  updateAgent: async (id: string, data: any) =>
    mockState.updateAgentResult || { id, ...data },
  deleteAgent: async (_id: string) => {},
  loadAllAgents: async () => new Map(),
}));

// Mock error handler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { agentRoutes } = await import("../agents");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/agents", agentRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser() {
  return { id: "user-1", username: "alice", role: "user" };
}

function makeSystemAgent(overrides: Partial<any> = {}): any {
  return {
    id: "sys-1",
    name: "System Agent",
    description: "Built-in agent",
    capabilities: [],
    tools: [],
    delegatable: true,
    internal: false,
    system: true,
    systemPrompt: "You are a system agent.",
    ...overrides,
  };
}

function makeUserAgent(overrides: Partial<any> = {}): any {
  return {
    id: "agent-1",
    name: "My Agent",
    description: "User created agent",
    capabilities: ["chat"],
    tools: ["file_read"],
    delegatable: true,
    internal: false,
    system: false,
    systemPrompt: "You are a helpful assistant.",
    ...overrides,
  };
}

function makeAccessEntry(resourceId: string, role: string = "owner"): any {
  return { resourceId, role };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Agents Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.listAgentsResult = [];
    mockState.loadAgentResult = null;
    mockState.createAgentResult = null;
    mockState.updateAgentResult = null;
    mockState.canViewResult = { allowed: true, effectiveRole: "owner" };
    mockState.canEditResult = { allowed: true, effectiveRole: "owner" };
    mockState.canDeleteResult = { allowed: true, effectiveRole: "owner" };
    mockState.listAccessibleResult = [];
  });

  test("should return 401 for GET /api/agents without session", async () => {
    const res = await app.request("/api/agents");
    expect(res.status).toBe(401);
  });

  test("should return 401 for GET /api/agents/:id without session", async () => {
    const res = await app.request("/api/agents/agent-1");
    expect(res.status).toBe(401);
  });

  test("should return 401 for POST /api/agents without session", async () => {
    const res = await app.request("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "new-agent", name: "New", systemPrompt: "Hi" }),
    });
    expect(res.status).toBe(401);
  });

  test("should return 401 for PUT /api/agents/:id without session", async () => {
    const res = await app.request("/api/agents/agent-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(401);
  });

  test("should return 401 for DELETE /api/agents/:id without session", async () => {
    const res = await app.request("/api/agents/agent-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/agents", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listAgentsResult = [];
    mockState.listAccessibleResult = [];
  });

  test("should return empty agents list when no agents exist", async () => {
    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("agents");
    expect(body.agents).toEqual([]);
  });

  test("should always include system agents regardless of RBAC", async () => {
    mockState.listAgentsResult = [makeSystemAgent()];
    mockState.listAccessibleResult = [];

    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].id).toBe("sys-1");
    expect(body.agents[0].isSystemAgent).toBe(true);
    expect(body.agents[0].role).toBeNull();
  });

  test("should include user agents that appear in accessible resources", async () => {
    const agent = makeUserAgent();
    mockState.listAgentsResult = [agent];
    mockState.listAccessibleResult = [makeAccessEntry("agent-1", "owner")];

    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].id).toBe("agent-1");
    expect(body.agents[0].isSystemAgent).toBe(false);
    expect(body.agents[0].role).toBe("owner");
  });

  test("should exclude user agents not in accessible resources", async () => {
    const agent = makeUserAgent();
    mockState.listAgentsResult = [agent];
    mockState.listAccessibleResult = [];

    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(0);
  });

  test("should include both system and accessible user agents", async () => {
    mockState.listAgentsResult = [makeSystemAgent(), makeUserAgent()];
    mockState.listAccessibleResult = [makeAccessEntry("agent-1", "editor")];

    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(2);

    const sys = body.agents.find((a: any) => a.id === "sys-1");
    expect(sys.isSystemAgent).toBe(true);
    expect(sys.role).toBeNull();

    const user = body.agents.find((a: any) => a.id === "agent-1");
    expect(user.isSystemAgent).toBe(false);
    expect(user.role).toBe("editor");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/agents/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadAgentResult = null;
    mockState.canViewResult = { allowed: true, effectiveRole: "owner" };
  });

  test("should return 404 when agent does not exist", async () => {
    mockState.loadAgentResult = null;
    const res = await app.request("/api/agents/nonexistent");
    expect(res.status).toBe(404);
  });

  test("should return system agent with isSystemAgent true and role null", async () => {
    mockState.loadAgentResult = makeSystemAgent();

    const res = await app.request("/api/agents/sys-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.id).toBe("sys-1");
    expect(body.isSystemAgent).toBe(true);
    expect(body.role).toBeNull();
  });

  test("should return user agent with effectiveRole when access is allowed", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.canViewResult = { allowed: true, effectiveRole: "editor" };

    const res = await app.request("/api/agents/agent-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.id).toBe("agent-1");
    expect(body.isSystemAgent).toBe(false);
    expect(body.role).toBe("editor");
  });

  test("should return 403 when user has no view permission on user agent", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.canViewResult = { allowed: false };

    const res = await app.request("/api/agents/agent-1");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/agents/:id/full", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadAgentResult = null;
    mockState.canViewResult = { allowed: true, effectiveRole: "owner" };
  });

  test("should return 404 when agent does not exist", async () => {
    const res = await app.request("/api/agents/nonexistent/full");
    expect(res.status).toBe(404);
  });

  test("should return full config for system agent without RBAC check", async () => {
    mockState.loadAgentResult = makeSystemAgent();
    mockState.canViewResult = { allowed: false };

    const res = await app.request("/api/agents/sys-1/full");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("sys-1");
    expect(body.systemPrompt).toBeDefined();
  });

  test("should return full config for user agent when view access is allowed", async () => {
    mockState.loadAgentResult = makeUserAgent();

    const res = await app.request("/api/agents/agent-1/full");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("agent-1");
    expect(body.systemPrompt).toBe("You are a helpful assistant.");
  });

  test("should return 403 for user agent when view access is denied", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.canViewResult = { allowed: false };

    const res = await app.request("/api/agents/agent-1/full");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/agents", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.createAgentResult = null;
  });

  test("should create agent and return success", async () => {
    const payload = {
      id: "new-agent",
      name: "New Agent",
      description: "A brand new agent",
      systemPrompt: "You are helpful.",
    };
    mockState.createAgentResult = { ...payload, system: false };

    const res = await app.request("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agent.id).toBe("new-agent");
  });

  test("should return 400 when id is missing", async () => {
    const res = await app.request("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No ID Agent", systemPrompt: "Hello" }),
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "no-name-agent", systemPrompt: "Hello" }),
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when systemPrompt is missing", async () => {
    const res = await app.request("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test-agent", name: "Test Agent" }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/agents/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadAgentResult = null;
    mockState.canEditResult = { allowed: true, effectiveRole: "owner" };
    mockState.updateAgentResult = null;
  });

  test("should return 404 when agent does not exist", async () => {
    const res = await app.request("/api/agents/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(404);
  });

  test("should return 403 for system agents", async () => {
    mockState.loadAgentResult = makeSystemAgent();
    const res = await app.request("/api/agents/sys-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(res.status).toBe(403);
  });

  test("should return 403 when user lacks edit permission", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.canEditResult = { allowed: false };

    const res = await app.request("/api/agents/agent-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(403);
  });

  test("should update and return agent when edit permission is granted", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.updateAgentResult = {
      id: "agent-1",
      name: "Updated Agent",
      system: false,
    };

    const res = await app.request("/api/agents/agent-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Agent" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agent.name).toBe("Updated Agent");
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/agents/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadAgentResult = null;
    mockState.canDeleteResult = { allowed: true, effectiveRole: "owner" };
  });

  test("should return 404 when agent does not exist", async () => {
    const res = await app.request("/api/agents/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  test("should return 403 for system agents", async () => {
    mockState.loadAgentResult = makeSystemAgent();
    const res = await app.request("/api/agents/sys-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("should return 403 when user lacks delete permission", async () => {
    mockState.loadAgentResult = makeUserAgent();
    mockState.canDeleteResult = { allowed: false };

    const res = await app.request("/api/agents/agent-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("should delete agent and return success when permission is granted", async () => {
    mockState.loadAgentResult = makeUserAgent();

    const res = await app.request("/api/agents/agent-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
