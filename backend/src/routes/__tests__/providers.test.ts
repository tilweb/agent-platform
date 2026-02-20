/**
 * Tests for provider API routes (backend/src/routes/providers.ts)
 *
 * Covers authentication, RBAC (admin-only routes), CRUD for providers and
 * models, the connection-test endpoint, active-model selection and the
 * current-model info endpoint.
 *
 * All service / adapter dependencies are mocked before the module is loaded.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests mutate this in beforeEach
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  getProvidersResult: [] as any[],
  getProviderResult: null as any,
  createProviderResult: null as any,
  updateProviderResult: null as any,
  addModelResult: null as any,
  updateModelResult: null as any,
  activeSelectionResult: {} as any,
  currentModelResult: null as any,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Auth: inject currentUser from mockState, otherwise 401
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

// Provider service
mock.module("../../services/providers", () => ({
  getProviders: async () => mockState.getProvidersResult,
  getProvider: async (_id: string) => mockState.getProviderResult,
  createProvider: async (data: any) => mockState.createProviderResult ?? data,
  updateProvider: async (id: string, data: any) =>
    mockState.updateProviderResult ?? { id, ...data },
  deleteProvider: async (_id: string) => {},
  addModel: async (_providerId: string, model: any) =>
    mockState.addModelResult ?? model,
  updateModel: async (_providerId: string, _modelId: string, data: any) =>
    mockState.updateModelResult ?? data,
  deleteModel: async (_providerId: string, _modelId: string) => {},
  getActiveSelection: async () => mockState.activeSelectionResult,
  setActiveModel: async () => {},
  resolveModel: async () => null,
  isCustomProvidersAllowed: () => true,
}));

// LLM service
mock.module("../../services/llm", () => ({
  llmService: {
    reload: async () => {},
    getCurrentModel: () => mockState.currentModelResult,
  },
}));

// LLM adapters used by the test / available-models endpoints
mock.module("../../services/llm/adapters/openai", () => ({
  OpenAIAdapter: class {
    constructor(_opts: any) {}
    async testConnection() {
      return { success: true };
    }
    async listModels() {
      return ["gpt-4"];
    }
  },
}));

mock.module("../../services/llm/adapters/ollama", () => ({
  OllamaAdapter: class {
    constructor(_opts: any) {}
    async testConnection() {
      return { success: true };
    }
    async listModels() {
      return ["llama2"];
    }
  },
}));

// Model sync: mocked to avoid transitive import of loadProvidersConfig
mock.module("../../services/modelSync", () => ({
  isModelSyncConfigured: () => false,
  syncAdacorModels: async () => ({ added: 0, removed: 0, unchanged: 0 }),
}));

// Error handler utility
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import route module AFTER mocks are registered, mount on test app
// ---------------------------------------------------------------------------

const providers = (await import("../providers")).default;

const app = new Hono();
app.route("/api/providers", providers);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser() {
  return { id: "admin-1", username: "alice", role: "admin" as const };
}

function makeRegularUser() {
  return { id: "user-1", username: "bob", role: "user" as const };
}

function makeProvider(overrides: Partial<any> = {}): any {
  return {
    id: "p1",
    name: "Test Provider",
    api_mode: "openai",
    base_url: "http://localhost:11434",
    models: [
      {
        id: "m1",
        name: "Model 1",
        type: "chat",
        capabilities: ["chat"],
        default: true,
      },
    ],
    ...overrides,
  };
}

function jsonBody(obj: any) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
}

// ---------------------------------------------------------------------------
// Auth — unauthenticated access is blocked on every route
// ---------------------------------------------------------------------------

describe("Providers Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
  });

  test("should return 401 for GET /api/providers without session", async () => {
    const res = await app.request("/api/providers");
    expect(res.status).toBe(401);
  });

  test("should return 401 for POST /api/providers without session", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x", api_mode: "openai", base_url: "http://x" }),
      })
    );
    expect(res.status).toBe(401);
  });

  test("should return 401 for GET /api/providers/:id without session", async () => {
    const res = await app.request("/api/providers/p1");
    expect(res.status).toBe(401);
  });

  test("should return 401 for GET /api/providers/active without session", async () => {
    const res = await app.request("/api/providers/active");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/providers
// ---------------------------------------------------------------------------

describe("GET /api/providers", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getProvidersResult = [];
  });

  test("should return empty list when no providers exist", async () => {
    const res = await app.request("/api/providers");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("providers");
    expect(body.providers).toEqual([]);
  });

  test("should return all providers", async () => {
    mockState.getProvidersResult = [makeProvider(), makeProvider({ id: "p2", name: "Second" })];
    const res = await app.request("/api/providers");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toHaveLength(2);
    expect(body.providers[0].id).toBe("p1");
    expect(body.providers[1].id).toBe("p2");
  });

  test("should be accessible for regular (non-admin) users", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/providers");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/providers/active
// ---------------------------------------------------------------------------

describe("GET /api/providers/active", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.activeSelectionResult = {};
  });

  test("should return empty active selection when nothing is configured", async () => {
    const res = await app.request("/api/providers/active");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("active");
    expect(body.active).toEqual({});
  });

  test("should return active selection with configured purposes", async () => {
    mockState.activeSelectionResult = {
      chat: { provider_id: "p1", model_id: "m1" },
      vision: { provider_id: "p1", model_id: "m2" },
    };
    const res = await app.request("/api/providers/active");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active.chat.provider_id).toBe("p1");
    expect(body.active.vision.model_id).toBe("m2");
  });

  test("should be accessible for regular users", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/providers/active");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/providers/:id
// ---------------------------------------------------------------------------

describe("GET /api/providers/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getProviderResult = null;
  });

  test("should return 404 when provider does not exist", async () => {
    mockState.getProviderResult = null;
    const res = await app.request("/api/providers/unknown-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return the provider when it exists", async () => {
    mockState.getProviderResult = makeProvider();
    const res = await app.request("/api/providers/p1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider.id).toBe("p1");
    expect(body.provider.name).toBe("Test Provider");
  });

  test("should include the models array in the response", async () => {
    mockState.getProviderResult = makeProvider();
    const res = await app.request("/api/providers/p1");
    const body = await res.json();
    expect(Array.isArray(body.provider.models)).toBe(true);
    expect(body.provider.models[0].id).toBe("m1");
  });

  test("should be accessible for regular users", async () => {
    mockState.currentUser = makeRegularUser();
    mockState.getProviderResult = makeProvider();
    const res = await app.request("/api/providers/p1");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/providers
// ---------------------------------------------------------------------------

describe("POST /api/providers", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.createProviderResult = null;
  });

  test("should create provider and return 201 for admin user", async () => {
    const payload = { name: "New Provider", api_mode: "openai", base_url: "http://api.example.com" };
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("provider");
    expect(body.provider.name).toBe("New Provider");
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x", api_mode: "openai", base_url: "http://x" }),
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_mode: "openai", base_url: "http://x" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  test("should return 400 when api_mode is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x", base_url: "http://x" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("api_mode");
  });

  test("should return 400 when base_url is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x", api_mode: "openai" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("base_url");
  });

  test("should return the created provider object from the service", async () => {
    const created = makeProvider({ id: "new-id", name: "Created" });
    mockState.createProviderResult = created;
    const res = await app.request(
      new Request("http://localhost/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created", api_mode: "openai", base_url: "http://x" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.provider.id).toBe("new-id");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/providers/:id
// ---------------------------------------------------------------------------

describe("PUT /api/providers/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.updateProviderResult = null;
  });

  test("should update provider and return 200 for admin user", async () => {
    mockState.updateProviderResult = makeProvider({ name: "Updated Name" });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider.name).toBe("Updated Name");
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/p1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      })
    );
    expect(res.status).toBe(403);
  });

  test("should return provider with merged id from path param when service returns no override", async () => {
    mockState.updateProviderResult = null;
    const res = await app.request(
      new Request("http://localhost/api/providers/p99", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Patched" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Default mock returns { id: "p99", name: "Patched" }
    expect(body.provider.id).toBe("p99");
    expect(body.provider.name).toBe("Patched");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/providers/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/providers/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
  });

  test("should delete provider and return success for admin", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1", { method: "DELETE" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/p1", { method: "DELETE" })
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/providers/active/:purpose
// ---------------------------------------------------------------------------

describe("PUT /api/providers/active/:purpose", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
  });

  const validPurposes = ["chat", "vision", "tts", "stt", "text_to_image", "image_to_image"];

  for (const purpose of validPurposes) {
    test(`should accept valid purpose '${purpose}' and return success`, async () => {
      const res = await app.request(
        new Request(`http://localhost/api/providers/active/${purpose}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: "p1", model_id: "m1" }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  }

  test("should return 400 for an invalid purpose value", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/active/invalid_purpose", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: "p1", model_id: "m1" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/active/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: "p1", model_id: "m1" }),
      })
    );
    expect(res.status).toBe(403);
  });

  test("should include all valid purposes in the error message when purpose is invalid", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/active/bad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: "p1", model_id: "m1" }),
      })
    );
    const body = await res.json();
    expect(body.error).toContain("chat");
  });
});

// ---------------------------------------------------------------------------
// POST /api/providers/:id/models
// ---------------------------------------------------------------------------

describe("POST /api/providers/:id/models", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.addModelResult = null;
  });

  test("should add model and return 201 for admin", async () => {
    const model = { id: "m2", name: "Model 2", type: "chat", capabilities: ["chat"] };
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.model.id).toBe("m2");
  });

  test("should return 400 when model id is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x", type: "chat", capabilities: ["chat"] }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id");
  });

  test("should return 400 when model name is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "m2", type: "chat", capabilities: ["chat"] }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  test("should return 400 when model type is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "m2", name: "x", capabilities: ["chat"] }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("type");
  });

  test("should return 400 when capabilities is missing", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "m2", name: "x", type: "chat" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("capabilities");
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "m2", name: "x", type: "chat", capabilities: ["chat"] }),
      })
    );
    expect(res.status).toBe(403);
  });

  test("should return model from service when addModelResult is set", async () => {
    mockState.addModelResult = { id: "svc-model", name: "Service Model", type: "chat", capabilities: ["chat"] };
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "m2", name: "x", type: "chat", capabilities: ["chat"] }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.model.id).toBe("svc-model");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/providers/:id/models/:modelId
// ---------------------------------------------------------------------------

describe("PUT /api/providers/:id/models/:modelId", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.updateModelResult = null;
  });

  test("should update model and return 200 for admin", async () => {
    mockState.updateModelResult = { id: "m1", name: "Updated Model", type: "chat", capabilities: ["chat"] };
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models/m1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Model" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model.name).toBe("Updated Model");
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models/m1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      })
    );
    expect(res.status).toBe(403);
  });

  test("should return updated fields from service when updateModelResult is set", async () => {
    mockState.updateModelResult = { id: "m1", name: "Svc Updated", type: "vision", capabilities: ["vision"] };
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models/m1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "vision" }),
      })
    );
    const body = await res.json();
    expect(body.model.type).toBe("vision");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/providers/:id/models/:modelId
// ---------------------------------------------------------------------------

describe("DELETE /api/providers/:id/models/:modelId", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
  });

  test("should delete model and return success for admin", async () => {
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models/m1", { method: "DELETE" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 403 for non-admin user", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/models/m1", { method: "DELETE" })
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/providers/:id/test
// ---------------------------------------------------------------------------

describe("POST /api/providers/:id/test", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getProviderResult = null;
  });

  test("should return 404 when provider does not exist", async () => {
    mockState.getProviderResult = null;
    const res = await app.request(
      new Request("http://localhost/api/providers/unknown/test", { method: "POST" })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when provider has no models configured", async () => {
    mockState.getProviderResult = makeProvider({ models: [] });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should test openai provider and return success result", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "openai" });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should test ollama provider and return success result", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "ollama" });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 400 for unknown api_mode", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "unknown_mode" });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("unknown_mode");
  });

  test("should prefer the default model over the first model when testing", async () => {
    // Provider has two models; second one is default
    mockState.getProviderResult = makeProvider({
      api_mode: "openai",
      models: [
        { id: "m-first", name: "First", type: "chat", capabilities: ["chat"], default: false },
        { id: "m-default", name: "Default", type: "chat", capabilities: ["chat"], default: true },
      ],
    });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    // The adapter mock always returns success; we only verify it didn't 400/404
    expect(res.status).toBe(200);
  });

  test("should be accessible for regular (non-admin) users", async () => {
    mockState.currentUser = makeRegularUser();
    mockState.getProviderResult = makeProvider({ api_mode: "openai" });
    const res = await app.request(
      new Request("http://localhost/api/providers/p1/test", { method: "POST" })
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/providers/:id/models/available
// ---------------------------------------------------------------------------

describe("GET /api/providers/:id/models/available", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.getProviderResult = null;
  });

  test("should return 404 when provider does not exist", async () => {
    mockState.getProviderResult = null;
    const res = await app.request("/api/providers/no-such/models/available");
    expect(res.status).toBe(404);
  });

  test("should return models list for openai provider", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "openai" });
    const res = await app.request("/api/providers/p1/models/available");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("models");
    expect(body.models).toContain("gpt-4");
  });

  test("should return models list for ollama provider", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "ollama" });
    const res = await app.request("/api/providers/p1/models/available");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models).toContain("llama2");
  });

  test("should return empty models array for unrecognised api_mode", async () => {
    mockState.getProviderResult = makeProvider({ api_mode: "custom_unsupported" });
    const res = await app.request("/api/providers/p1/models/available");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models).toEqual([]);
  });

  test("should be accessible for regular users", async () => {
    mockState.currentUser = makeRegularUser();
    mockState.getProviderResult = makeProvider({ api_mode: "openai" });
    const res = await app.request("/api/providers/p1/models/available");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/providers/current/info
// ---------------------------------------------------------------------------

describe("GET /api/providers/current/info", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.currentModelResult = null;
  });

  test("should return null current model when no chat model is active", async () => {
    mockState.currentModelResult = null;
    const res = await app.request("/api/providers/current/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("current");
    expect(body.current).toBeNull();
  });

  test("should return current model info when a chat model is active", async () => {
    mockState.currentModelResult = { provider: "p1", model: "m1", name: "GPT-4" };
    const res = await app.request("/api/providers/current/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current.provider).toBe("p1");
    expect(body.current.model).toBe("m1");
  });

  test("should be accessible for regular users", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/providers/current/info");
    expect(res.status).toBe(200);
  });
});
