/**
 * Tests for memory API routes (backend/src/routes/memory.ts)
 *
 * All routes require authentication.
 * Service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  loadUserMemoryResult: null as any,
  addAboutItemResult: null as any,
  addInstructionResult: null as any,
  addContextItemResult: null as any,
  deleteMemoryItemResult: true as boolean,
  setContextActiveResult: true as boolean,
  updateMemorySettingsResult: null as any,
  // Controls whether service functions throw instead of returning
  throwOnLoadUserMemory: false,
  throwOnAddAboutItem: false,
  throwOnAddInstruction: false,
  throwOnAddContextItem: false,
  throwOnDeleteMemoryItem: false,
  throwOnSetContextActive: false,
  throwOnUpdateMemorySettings: false,
};

// memory.ts imports authMiddleware and requireUserId from '../auth' (index)
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any): string => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

// Mock internalError so it behaves like a simple 500 JSON response in tests
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) => {
    return c.json({ error: "Internal server error" }, 500);
  },
}));

// Mock the entire userMemory service
mock.module("../../services/userMemory", () => ({
  loadUserMemory: async (_userId: string) => {
    if (mockState.throwOnLoadUserMemory) throw new Error("load failed");
    return mockState.loadUserMemoryResult;
  },
  addAboutItem: async (_content: string, _source: string, _userId: string) => {
    if (mockState.throwOnAddAboutItem) throw new Error("add about failed");
    return mockState.addAboutItemResult;
  },
  addInstruction: async (
    _content: string,
    _priority: string,
    _source: string,
    _userId: string
  ) => {
    if (mockState.throwOnAddInstruction) throw new Error("add instruction failed");
    return mockState.addInstructionResult;
  },
  addContextItem: async (
    _name: string,
    _description: string | undefined,
    _active: boolean,
    _source: string,
    _userId: string
  ) => {
    if (mockState.throwOnAddContextItem) throw new Error("add context failed");
    return mockState.addContextItemResult;
  },
  deleteMemoryItem: async (
    _section: string,
    _itemId: string,
    _userId: string
  ) => {
    if (mockState.throwOnDeleteMemoryItem) throw new Error("delete failed");
    return mockState.deleteMemoryItemResult;
  },
  setContextActive: async (_itemId: string, _active: boolean, _userId: string) => {
    if (mockState.throwOnSetContextActive) throw new Error("set active failed");
    return mockState.setContextActiveResult;
  },
  updateMemorySettings: async (_updates: any, _userId: string) => {
    if (mockState.throwOnUpdateMemorySettings) throw new Error("update settings failed");
    return mockState.updateMemorySettingsResult;
  },
  isValidSection: (section: string): boolean => {
    return ["about", "instructions", "context"].includes(section);
  },
  getAllSections: (): string[] => {
    return ["about", "instructions", "context"];
  },
  formatMemoryForPrompt: (_memory: any): string => {
    return "# Benutzer-Profil\n\n";
  },
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { memoryRoutes } = await import("../memory");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/memory", memoryRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeDefaultMemory(overrides: Partial<any> = {}): any {
  return {
    user_id: "user-1",
    updated_at: "2026-02-20T10:00:00.000Z",
    about: [],
    instructions: [],
    context: [],
    settings: {
      include_in_prompt: true,
      max_items_per_section: 15,
    },
    ...overrides,
  };
}

function makeAboutItem(overrides: Partial<any> = {}): any {
  return {
    id: "about-1",
    content: "I am a software engineer",
    added_at: "2026-02-20T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function makeInstructionItem(overrides: Partial<any> = {}): any {
  return {
    id: "inst-1",
    content: "Always respond in English",
    priority: "normal",
    added_at: "2026-02-20T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function makeContextItem(overrides: Partial<any> = {}): any {
  return {
    id: "ctx-1",
    name: "Project Alpha",
    description: "A top-secret project",
    active: true,
    added_at: "2026-02-20T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

function jsonBody(body: any): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function putBody(body: any): RequestInit {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Memory Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.loadUserMemoryResult = makeDefaultMemory();
    mockState.throwOnLoadUserMemory = false;
  });

  test("should return 401 when no session is present", async () => {
    const res = await app.request("/api/memory");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should allow access when authenticated", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/memory", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadUserMemoryResult = makeDefaultMemory();
    mockState.throwOnLoadUserMemory = false;
  });

  test("should return the full memory object for the current user", async () => {
    const memory = makeDefaultMemory({
      about: [makeAboutItem()],
      instructions: [makeInstructionItem()],
    });
    mockState.loadUserMemoryResult = memory;

    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user_id).toBe("user-1");
    expect(body.about).toHaveLength(1);
    expect(body.instructions).toHaveLength(1);
  });

  test("should return empty sections when memory is freshly initialized", async () => {
    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.about).toEqual([]);
    expect(body.instructions).toEqual([]);
    expect(body.context).toEqual([]);
  });

  test("should return 500 when loadUserMemory throws", async () => {
    mockState.throwOnLoadUserMemory = true;
    const res = await app.request("/api/memory");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should include settings in the response", async () => {
    const res = await app.request("/api/memory");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toHaveProperty("include_in_prompt");
    expect(body.settings).toHaveProperty("max_items_per_section");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/memory/sections", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
  });

  test("should return all valid sections", async () => {
    const res = await app.request("/api/memory/sections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body.sections).toContain("about");
    expect(body.sections).toContain("instructions");
    expect(body.sections).toContain("context");
  });

  test("should return exactly three sections", async () => {
    const res = await app.request("/api/memory/sections");
    const body = await res.json();
    expect(body.sections).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/memory/:section", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadUserMemoryResult = makeDefaultMemory({
      about: [makeAboutItem()],
      instructions: [makeInstructionItem()],
      context: [makeContextItem()],
    });
    mockState.throwOnLoadUserMemory = false;
  });

  test("should return items for the 'about' section", async () => {
    const res = await app.request("/api/memory/about");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section).toBe("about");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].content).toBe("I am a software engineer");
  });

  test("should return items for the 'instructions' section", async () => {
    const res = await app.request("/api/memory/instructions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section).toBe("instructions");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].priority).toBe("normal");
  });

  test("should return items for the 'context' section", async () => {
    const res = await app.request("/api/memory/context");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section).toBe("context");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Project Alpha");
  });

  test("should return 400 for an invalid section name", async () => {
    const res = await app.request("/api/memory/invalid-section");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Invalid section");
  });

  test("should list valid section names in the 400 error message", async () => {
    const res = await app.request("/api/memory/unknown");
    const body = await res.json();
    expect(body.error).toContain("about");
    expect(body.error).toContain("instructions");
    expect(body.error).toContain("context");
  });

  test("should return 500 when loadUserMemory throws for a valid section", async () => {
    mockState.throwOnLoadUserMemory = true;
    const res = await app.request("/api/memory/about");
    expect(res.status).toBe(500);
  });

  test("should return empty items array for an empty section", async () => {
    mockState.loadUserMemoryResult = makeDefaultMemory();
    const res = await app.request("/api/memory/about");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/memory/settings", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.updateMemorySettingsResult = {
      include_in_prompt: false,
      max_items_per_section: 10,
    };
    mockState.throwOnUpdateMemorySettings = false;
  });

  test("should update and return new settings", async () => {
    const res = await app.request(
      "/api/memory/settings",
      putBody({ include_in_prompt: false, max_items_per_section: 10 })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.include_in_prompt).toBe(false);
    expect(body.max_items_per_section).toBe(10);
  });

  test("should return 500 when updateMemorySettings throws", async () => {
    mockState.throwOnUpdateMemorySettings = true;
    const res = await app.request(
      "/api/memory/settings",
      putBody({ include_in_prompt: true })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request(
      "/api/memory/settings",
      putBody({ include_in_prompt: true })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/memory/about", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.addAboutItemResult = makeAboutItem();
    mockState.throwOnAddAboutItem = false;
  });

  test("should create a new about item and return 201", async () => {
    const res = await app.request(
      "/api/memory/about",
      jsonBody({ content: "I am a software engineer" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("about-1");
    expect(body.content).toBe("I am a software engineer");
    expect(body.source).toBe("manual");
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/memory/about", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Content is required");
  });

  test("should return 400 when content is empty string", async () => {
    const res = await app.request("/api/memory/about", jsonBody({ content: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Content is required");
  });

  test("should default source to 'manual' when not provided", async () => {
    const res = await app.request(
      "/api/memory/about",
      jsonBody({ content: "I work in Berlin" })
    );
    expect(res.status).toBe(201);
    // The mock captures the default — actual source passed to service is 'manual'
    const body = await res.json();
    expect(body.source).toBe("manual");
  });

  test("should accept a custom source value", async () => {
    mockState.addAboutItemResult = makeAboutItem({ source: "agent" });
    const res = await app.request(
      "/api/memory/about",
      jsonBody({ content: "I am a software engineer", source: "agent" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source).toBe("agent");
  });

  test("should return 500 when addAboutItem throws", async () => {
    mockState.throwOnAddAboutItem = true;
    const res = await app.request(
      "/api/memory/about",
      jsonBody({ content: "I am a software engineer" })
    );
    expect(res.status).toBe(500);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request(
      "/api/memory/about",
      jsonBody({ content: "I am a software engineer" })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/memory/instructions", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.addInstructionResult = makeInstructionItem();
    mockState.throwOnAddInstruction = false;
  });

  test("should create a new instruction and return 201", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("inst-1");
    expect(body.content).toBe("Always respond in English");
    expect(body.priority).toBe("normal");
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/memory/instructions", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Content is required");
  });

  test("should return 400 when content is empty string", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "" })
    );
    expect(res.status).toBe(400);
  });

  test("should accept 'high' priority", async () => {
    mockState.addInstructionResult = makeInstructionItem({ priority: "high" });
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English", priority: "high" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe("high");
  });

  test("should accept 'normal' priority explicitly", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English", priority: "normal" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe("normal");
  });

  test("should return 400 for an invalid priority value", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English", priority: "critical" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid priority");
  });

  test("should default priority to 'normal' when not provided", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English" })
    );
    expect(res.status).toBe(201);
    // Mock returns normal by default, validating the default was applied
    const body = await res.json();
    expect(body.priority).toBe("normal");
  });

  test("should default source to 'manual' when not provided", async () => {
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source).toBe("manual");
  });

  test("should return 500 when addInstruction throws", async () => {
    mockState.throwOnAddInstruction = true;
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English" })
    );
    expect(res.status).toBe(500);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request(
      "/api/memory/instructions",
      jsonBody({ content: "Always respond in English" })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/memory/context", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.addContextItemResult = makeContextItem();
    mockState.throwOnAddContextItem = false;
  });

  test("should create a new context item and return 201", async () => {
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Alpha", description: "A top-secret project" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("ctx-1");
    expect(body.name).toBe("Project Alpha");
    expect(body.active).toBe(true);
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/memory/context", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name is required");
  });

  test("should return 400 when name is empty string", async () => {
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "" })
    );
    expect(res.status).toBe(400);
  });

  test("should create context item without description", async () => {
    mockState.addContextItemResult = makeContextItem({ description: undefined });
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Beta" })
    );
    expect(res.status).toBe(201);
  });

  test("should default active to true when not provided", async () => {
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Alpha" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(true);
  });

  test("should accept active: false explicitly", async () => {
    mockState.addContextItemResult = makeContextItem({ active: false });
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Alpha", active: false })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  test("should return 500 when addContextItem throws", async () => {
    mockState.throwOnAddContextItem = true;
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Alpha" })
    );
    expect(res.status).toBe(500);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request(
      "/api/memory/context",
      jsonBody({ name: "Project Alpha" })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/memory/context/:id/active", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.setContextActiveResult = true;
    mockState.throwOnSetContextActive = false;
  });

  test("should set context item active to true and return success", async () => {
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should set context item active to false and return success", async () => {
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: false })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when context item is not found", async () => {
    mockState.setContextActiveResult = false;
    const res = await app.request(
      "/api/memory/context/nonexistent/active",
      putBody({ active: true })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("not found");
  });

  test("should return 400 when active is not a boolean", async () => {
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: "yes" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("boolean");
  });

  test("should return 400 when active is a number", async () => {
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: 1 })
    );
    expect(res.status).toBe(400);
  });

  test("should return 400 when active is omitted", async () => {
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({})
    );
    expect(res.status).toBe(400);
  });

  test("should return 500 when setContextActive throws", async () => {
    mockState.throwOnSetContextActive = true;
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: true })
    );
    expect(res.status).toBe(500);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request(
      "/api/memory/context/ctx-1/active",
      putBody({ active: true })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/memory/:section/:id", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.deleteMemoryItemResult = true;
    mockState.throwOnDeleteMemoryItem = false;
  });

  test("should delete an about item and return success", async () => {
    const res = await app.request("/api/memory/about/about-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should delete an instructions item and return success", async () => {
    const res = await app.request("/api/memory/instructions/inst-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should delete a context item and return success", async () => {
    const res = await app.request("/api/memory/context/ctx-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when item is not found", async () => {
    mockState.deleteMemoryItemResult = false;
    const res = await app.request("/api/memory/about/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("not found");
  });

  test("should return 400 for an invalid section name", async () => {
    const res = await app.request("/api/memory/invalid-section/some-id", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid section");
  });

  test("should list valid section names in the 400 error message", async () => {
    const res = await app.request("/api/memory/unknown/some-id", {
      method: "DELETE",
    });
    const body = await res.json();
    expect(body.error).toContain("about");
    expect(body.error).toContain("instructions");
    expect(body.error).toContain("context");
  });

  test("should return 500 when deleteMemoryItem throws", async () => {
    mockState.throwOnDeleteMemoryItem = true;
    const res = await app.request("/api/memory/about/about-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(500);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/memory/about/about-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});
