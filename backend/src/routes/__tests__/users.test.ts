/**
 * Tests for users API routes (backend/src/routes/users.ts)
 *
 * All routes require auth middleware.
 * Service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUserId: null as null | string,
  listUsersResult: [] as any[],
  getAllUserModelPreferencesResult: null as any,
  setUserModelPreferenceError: null as null | Error,
  clearUserModelPreferenceError: null as null | Error,
  getProviderResult: null as any,
  getActiveSelectionResult: {} as any,
};

// Mock auth middleware — injects mockState.currentUserId into context
mock.module("../../auth/middleware", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUserId) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("userId", mockState.currentUserId);
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
}));

// Mock errorHandler — internalError just returns a 500 JSON response
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) =>
    c.json({ error: "Internal server error" }, 500),
}));

// Mock auth storage
mock.module("../../auth/storage", () => ({
  listUsers: async () => mockState.listUsersResult,
}));

// Mock userPreferences service
mock.module("../../services/userPreferences", () => ({
  getAllUserModelPreferences: async (_userId: string) =>
    mockState.getAllUserModelPreferencesResult,
  setUserModelPreference: async (
    _userId: string,
    _purpose: string,
    _providerId: string,
    _modelId: string
  ) => {
    if (mockState.setUserModelPreferenceError) {
      throw mockState.setUserModelPreferenceError;
    }
  },
  clearUserModelPreference: async (_userId: string, _purpose: string) => {
    if (mockState.clearUserModelPreferenceError) {
      throw mockState.clearUserModelPreferenceError;
    }
  },
}));

// Mock providers service
mock.module("../../services/providers", () => ({
  getProvider: async (_id: string) => mockState.getProviderResult,
  getActiveSelection: async () => mockState.getActiveSelectionResult,
  getSystemDefaultModel: async () => null,
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { usersRoutes } = await import("../users");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/users", usersRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: "user-1",
    username: "alice",
    displayName: "Alice Example",
    email: "alice@example.com",
    isActive: true,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<any> = {}): any {
  return {
    id: "openai",
    name: "OpenAI",
    enabled: true,
    models: [
      { id: "gpt-4", name: "GPT-4", capabilities: ["chat"] },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Users Routes — Auth Guard", () => {
  beforeEach(() => {
    mockState.currentUserId = null;
    mockState.listUsersResult = [];
    mockState.getAllUserModelPreferencesResult = null;
    mockState.setUserModelPreferenceError = null;
    mockState.clearUserModelPreferenceError = null;
    mockState.getProviderResult = null;
    mockState.getActiveSelectionResult = {};
  });

  test("should return 401 when no session is present on GET /", async () => {
    const res = await app.request("/api/users");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 401 when no session is present on GET /search", async () => {
    const res = await app.request("/api/users/search?q=alice");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present on GET /preferences/models", async () => {
    const res = await app.request("/api/users/preferences/models");
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present on PUT /preferences/models/:purpose", async () => {
    const res = await app.request("/api/users/preferences/models/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: "openai", model_id: "gpt-4" }),
    });
    expect(res.status).toBe(401);
  });

  test("should return 401 when no session is present on DELETE /preferences/models/:purpose", async () => {
    const res = await app.request("/api/users/preferences/models/chat", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("should allow authenticated user to access GET /", async () => {
    mockState.currentUserId = "user-1";
    mockState.listUsersResult = [];
    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/users", () => {
  beforeEach(() => {
    mockState.currentUserId = "user-1";
    mockState.listUsersResult = [];
  });

  test("should return empty list when no users exist", async () => {
    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
  });

  test("should return only active users", async () => {
    mockState.listUsersResult = [
      makeUser({ id: "u1", username: "alice", isActive: true }),
      makeUser({ id: "u2", username: "bob", isActive: false }),
    ];
    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].id).toBe("u1");
  });

  test("should return sanitized user fields only (id, username, displayName, email)", async () => {
    mockState.listUsersResult = [
      makeUser({
        id: "u1",
        username: "alice",
        displayName: "Alice Example",
        email: "alice@example.com",
        passwordHash: "secret-hash",
        isActive: true,
      }),
    ];
    const res = await app.request("/api/users");
    const body = await res.json();
    const user = body.users[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("displayName");
    expect(user).toHaveProperty("email");
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("isActive");
  });

  test("should fall back to username when displayName is absent", async () => {
    mockState.listUsersResult = [
      makeUser({ id: "u1", username: "alice", displayName: undefined, isActive: true }),
    ];
    const res = await app.request("/api/users");
    const body = await res.json();
    expect(body.users[0].displayName).toBe("alice");
  });

  test("should use displayName when it is set", async () => {
    mockState.listUsersResult = [
      makeUser({ id: "u1", username: "alice", displayName: "Alice Smith", isActive: true }),
    ];
    const res = await app.request("/api/users");
    const body = await res.json();
    expect(body.users[0].displayName).toBe("Alice Smith");
  });

  test("should return multiple active users", async () => {
    mockState.listUsersResult = [
      makeUser({ id: "u1", username: "alice", isActive: true }),
      makeUser({ id: "u2", username: "bob", isActive: true }),
    ];
    const res = await app.request("/api/users");
    const body = await res.json();
    expect(body.users).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/users/search", () => {
  beforeEach(() => {
    mockState.currentUserId = "user-1";
    mockState.listUsersResult = [
      makeUser({ id: "u1", username: "alice", displayName: "Alice Smith", email: "alice@example.com", isActive: true }),
      makeUser({ id: "u2", username: "bob", displayName: "Bob Jones", email: "bob@example.com", isActive: true }),
      makeUser({ id: "u3", username: "charlie", displayName: "Charlie Brown", email: "charlie@example.com", isActive: false }),
    ];
  });

  test("should return empty list when query is missing", async () => {
    const res = await app.request("/api/users/search");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
  });

  test("should return empty list when query is too short (less than 2 chars)", async () => {
    const res = await app.request("/api/users/search?q=a");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
  });

  test("should match by username (case-insensitive)", async () => {
    const res = await app.request("/api/users/search?q=ALICE");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].id).toBe("u1");
  });

  test("should match by displayName", async () => {
    const res = await app.request("/api/users/search?q=Jones");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].id).toBe("u2");
  });

  test("should match by email", async () => {
    const res = await app.request("/api/users/search?q=bob@example");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].id).toBe("u2");
  });

  test("should not return inactive users in search results", async () => {
    const res = await app.request("/api/users/search?q=charlie");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(0);
  });

  test("should limit results to 20 entries", async () => {
    mockState.listUsersResult = Array.from({ length: 25 }, (_, i) =>
      makeUser({ id: `u${i}`, username: `user${i}`, displayName: `User ${i}`, email: `user${i}@example.com`, isActive: true })
    );
    const res = await app.request("/api/users/search?q=user");
    const body = await res.json();
    expect(body.users.length).toBeLessThanOrEqual(20);
  });

  test("should return sanitized fields in search results", async () => {
    const res = await app.request("/api/users/search?q=alice");
    const body = await res.json();
    const user = body.users[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("displayName");
    expect(user).toHaveProperty("email");
    expect(user).not.toHaveProperty("passwordHash");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/users/preferences/models", () => {
  beforeEach(() => {
    mockState.currentUserId = "user-1";
    mockState.getAllUserModelPreferencesResult = null;
    mockState.getActiveSelectionResult = {
      chat: { provider_id: "openai", model_id: "gpt-4" },
    };
  });

  test("should return preferences and systemDefaults", async () => {
    const res = await app.request("/api/users/preferences/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("preferences");
    expect(body).toHaveProperty("systemDefaults");
  });

  test("should return empty preferences object when user has no preferences set", async () => {
    mockState.getAllUserModelPreferencesResult = null;
    const res = await app.request("/api/users/preferences/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toEqual({});
  });

  test("should return stored preferences when user has preferences", async () => {
    mockState.getAllUserModelPreferencesResult = {
      chat: { provider_id: "openai", model_id: "gpt-4" },
      vision: { provider_id: "anthropic", model_id: "claude-3" },
    };
    const res = await app.request("/api/users/preferences/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.chat).toEqual({ provider_id: "openai", model_id: "gpt-4" });
    expect(body.preferences.vision).toEqual({ provider_id: "anthropic", model_id: "claude-3" });
  });

  test("should include systemDefaults from getActiveSelection", async () => {
    mockState.getActiveSelectionResult = {
      chat: { provider_id: "openai", model_id: "gpt-3.5" },
    };
    const res = await app.request("/api/users/preferences/models");
    const body = await res.json();
    expect(body.systemDefaults).toEqual({
      chat: { provider_id: "openai", model_id: "gpt-3.5" },
    });
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/users/preferences/models/:purpose", () => {
  beforeEach(() => {
    mockState.currentUserId = "user-1";
    mockState.setUserModelPreferenceError = null;
    mockState.getProviderResult = makeProvider();
  });

  function putPreference(purpose: string, body: any) {
    return app.request(`/api/users/preferences/models/${purpose}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  test("should return 400 for an invalid purpose", async () => {
    const res = await putPreference("invalid_purpose", {
      provider_id: "openai",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should accept all valid purposes", async () => {
    const validPurposes = ["chat", "vision", "tts", "stt", "text_to_image", "image_to_image"];
    for (const purpose of validPurposes) {
      mockState.getProviderResult = makeProvider();
      const res = await putPreference(purpose, {
        provider_id: "openai",
        model_id: "gpt-4",
      });
      expect(res.status).toBe(200);
    }
  });

  test("should return 400 when provider_id is missing", async () => {
    const res = await putPreference("chat", { model_id: "gpt-4" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when model_id is missing", async () => {
    const res = await putPreference("chat", { provider_id: "openai" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 404 when provider does not exist", async () => {
    mockState.getProviderResult = null;
    const res = await putPreference("chat", {
      provider_id: "nonexistent",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 when provider is disabled", async () => {
    mockState.getProviderResult = makeProvider({ enabled: false });
    const res = await putPreference("chat", {
      provider_id: "openai",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 404 when model does not exist in provider", async () => {
    mockState.getProviderResult = makeProvider({
      models: [{ id: "gpt-3.5", name: "GPT-3.5" }],
    });
    const res = await putPreference("chat", {
      provider_id: "openai",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 200 with success and preference when valid", async () => {
    const res = await putPreference("chat", {
      provider_id: "openai",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.preference).toEqual({
      purpose: "chat",
      provider_id: "openai",
      model_id: "gpt-4",
    });
  });

  test("should return 500 when setUserModelPreference throws", async () => {
    mockState.setUserModelPreferenceError = new Error("Storage failure");
    const res = await putPreference("chat", {
      provider_id: "openai",
      model_id: "gpt-4",
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/users/preferences/models/:purpose", () => {
  beforeEach(() => {
    mockState.currentUserId = "user-1";
    mockState.clearUserModelPreferenceError = null;
  });

  function deletePreference(purpose: string) {
    return app.request(`/api/users/preferences/models/${purpose}`, {
      method: "DELETE",
    });
  }

  test("should return 400 for an invalid purpose", async () => {
    const res = await deletePreference("unknown_type");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 200 with success message for valid purpose", async () => {
    const res = await deletePreference("chat");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("message");
  });

  test("should include the purpose name in the success message", async () => {
    const res = await deletePreference("vision");
    const body = await res.json();
    expect(body.message).toContain("vision");
  });

  test("should accept all valid purposes", async () => {
    const validPurposes = ["chat", "vision", "tts", "stt", "text_to_image", "image_to_image"];
    for (const purpose of validPurposes) {
      const res = await deletePreference(purpose);
      expect(res.status).toBe(200);
    }
  });

  test("should return 500 when clearUserModelPreference throws", async () => {
    mockState.clearUserModelPreferenceError = new Error("Disk full");
    const res = await deletePreference("chat");
    expect(res.status).toBe(500);
  });
});
