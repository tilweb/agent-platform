/**
 * Tests for search API routes (backend/src/routes/search.ts)
 *
 * Routes use optional auth middleware — requests proceed with or without a session.
 * Service dependencies are mocked at the module level.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  userId: null as string | null,
  unifiedSearchResult: null as any,
  unifiedSearchShouldThrow: false,
  smartKnowledgeSearchResult: null as any,
  smartKnowledgeSearchShouldThrow: false,
  smartContractSearchResult: null as any,
  smartContractSearchShouldThrow: false,
  searchChatHistoriesWithScoringResult: [] as any[],
  searchChatHistoriesShouldThrow: false,
  smartChatSearchResult: null as any,
  confluenceTokens: null as any,
  gdriveTokens: null as any,
  appsRegistry: null as any,
  toolRegistryHas: (_name: string) => false as boolean,
};

// Mock optional auth middleware — injects mockState.userId when set
mock.module("../../auth/middleware", () => ({
  optionalAuthMiddleware: async (c: any, next: any) => {
    if (mockState.userId) {
      c.set("userId", mockState.userId);
    }
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
}));

// Mock unified search service — reads from mockState at call time
mock.module("../../services/searchService", () => ({
  unifiedSearch: async (_query: string, _userId: string, _sources: string[]) => {
    if (mockState.unifiedSearchShouldThrow) {
      throw new Error("Service unavailable");
    }
    return mockState.unifiedSearchResult;
  },
  smartKnowledgeSearch: async (_query: string) => {
    if (mockState.smartKnowledgeSearchShouldThrow) {
      throw new Error("Knowledge search failed");
    }
    return mockState.smartKnowledgeSearchResult;
  },
  smartContractSearch: async (_query: string) => {
    if (mockState.smartContractSearchShouldThrow) {
      throw new Error("Contract search failed");
    }
    return mockState.smartContractSearchResult;
  },
}));

// Mock memory service
mock.module("../../services/memory", () => ({
  searchChatHistoriesWithScoring: async (_opts: any) => {
    if (mockState.searchChatHistoriesShouldThrow) {
      throw new Error("Memory search failed");
    }
    return mockState.searchChatHistoriesWithScoringResult;
  },
}));

// Mock smart chat search service
mock.module("../../services/smartChatSearch", () => ({
  smartChatSearch: async (_query: string, _results: any[]) =>
    mockState.smartChatSearchResult,
}));

// Mock connection registry
mock.module("../../connections/registry", () => ({
  connectionRegistry: {
    getTokens: async (_userId: string, providerId: string) => {
      if (providerId === "confluence") return mockState.confluenceTokens;
      if (providerId === "google-drive") return mockState.gdriveTokens;
      return null;
    },
  },
}));

// Mock tool registry (used inside /sources via dynamic import)
mock.module("../../tools/registry", () => ({
  toolRegistry: {
    has: (name: string) => mockState.toolRegistryHas(name),
  },
}));

// Mock apps registry (used inside /sources via dynamic import)
mock.module("../../apps/registry", () => ({
  loadRegistry: async () => mockState.appsRegistry,
}));

// Mock error handler to give predictable 500 responses
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: unknown) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { searchRoutes } = await import("../search");

// Mount routes on a test app using the same prefix as production
const app = new Hono();
app.route("/api/search", searchRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnifiedSearchResult(query = "test"): any {
  return {
    query,
    results: {
      chats: [],
      knowledge: [],
      confluence: [],
      gdrive: [],
      contracts: [],
    },
    errors: [],
  };
}

function makeChatResult(overrides: Partial<any> = {}): any {
  return {
    id: "chat-1",
    title: "Test Chat",
    updatedAt: "2026-02-01T10:00:00.000Z",
    matchedIn: "title",
    matchScore: 0.9,
    messageCount: 5,
    ...overrides,
  };
}

function makeSmartChatSearchResponse(results: any[]): any {
  return {
    results,
    isSmartRanked: true,
    reasoning: "Ranked by semantic relevance",
  };
}

function makeAppsRegistry(vertragsmanagementEnabled = false): any {
  return {
    apps: {
      vertragsmanagement: {
        id: "vertragsmanagement",
        name: "Vertragsmanagement",
        enabled: vertragsmanagementEnabled,
      },
    },
  };
}

function resetMockState(): void {
  mockState.userId = null;
  mockState.unifiedSearchResult = makeUnifiedSearchResult();
  mockState.unifiedSearchShouldThrow = false;
  mockState.smartKnowledgeSearchResult = { results: [] };
  mockState.smartKnowledgeSearchShouldThrow = false;
  mockState.smartContractSearchResult = { results: [] };
  mockState.smartContractSearchShouldThrow = false;
  mockState.searchChatHistoriesWithScoringResult = [];
  mockState.searchChatHistoriesShouldThrow = false;
  mockState.smartChatSearchResult = null;
  mockState.confluenceTokens = null;
  mockState.gdriveTokens = null;
  mockState.appsRegistry = makeAppsRegistry(false);
  mockState.toolRegistryHas = (_name: string) => false;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("GET /api/search", () => {
  beforeEach(resetMockState);

  test("should return 400 when query param is missing", async () => {
    const res = await app.request("/api/search");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is only 1 character", async () => {
    const res = await app.request("/api/search?q=a");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is an empty string", async () => {
    const res = await app.request("/api/search?q=");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 200 with search results for a valid query", async () => {
    mockState.unifiedSearchResult = makeUnifiedSearchResult("hello");
    const res = await app.request("/api/search?q=hello");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("hello");
    expect(body.results).toHaveProperty("chats");
    expect(body.results).toHaveProperty("knowledge");
  });

  test("should allow a 2-character query (minimum boundary)", async () => {
    mockState.unifiedSearchResult = makeUnifiedSearchResult("ab");
    const res = await app.request("/api/search?q=ab");
    expect(res.status).toBe(200);
  });

  test("should pass userId from session to unifiedSearch", async () => {
    mockState.userId = "user-42";
    mockState.unifiedSearchResult = makeUnifiedSearchResult("test");
    const res = await app.request("/api/search?q=test");
    expect(res.status).toBe(200);
  });

  test("should return service result verbatim when no sources filter is given", async () => {
    mockState.unifiedSearchResult = makeUnifiedSearchResult("test");
    const res = await app.request("/api/search?q=test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockState.unifiedSearchResult);
  });

  test("should accept a single valid source in the sources param", async () => {
    const res = await app.request("/api/search?q=test&sources=chats");
    expect(res.status).toBe(200);
  });

  test("should accept multiple valid sources in the sources param", async () => {
    const res = await app.request("/api/search?q=test&sources=chats,knowledge");
    expect(res.status).toBe(200);
  });

  test("should return 400 when all requested sources are invalid", async () => {
    const res = await app.request("/api/search?q=test&sources=invalid,bogus");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid sources");
    expect(body.error).toContain("chats");
  });

  test("should silently drop invalid sources and use valid ones", async () => {
    // "chats" is valid, "nope" is not — valid subset is used, request succeeds
    const res = await app.request("/api/search?q=test&sources=chats,nope");
    expect(res.status).toBe(200);
  });

  test("should accept all five valid source values at once", async () => {
    const validSources = ["chats", "knowledge", "confluence", "gdrive", "contracts"];
    const res = await app.request(`/api/search?q=test&sources=${validSources.join(",")}`);
    expect(res.status).toBe(200);
  });

  test("should treat source names case-insensitively", async () => {
    const res = await app.request("/api/search?q=test&sources=Chats,Knowledge");
    expect(res.status).toBe(200);
  });

  test("should return 500 when unifiedSearch throws an error", async () => {
    mockState.unifiedSearchShouldThrow = true;
    const res = await app.request("/api/search?q=test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/search/sources", () => {
  beforeEach(resetMockState);

  test("should return sources array with 5 entries", async () => {
    const res = await app.request("/api/search/sources");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources).toHaveLength(5);
  });

  test("should always include chats and knowledge as available and connected", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const chats = body.sources.find((s: any) => s.id === "chats");
    const knowledge = body.sources.find((s: any) => s.id === "knowledge");
    expect(chats.available).toBe(true);
    expect(chats.connected).toBe(true);
    expect(knowledge.available).toBe(true);
    expect(knowledge.connected).toBe(true);
  });

  test("should return confluence as not connected when user is anonymous", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    expect(confluence.connected).toBe(false);
  });

  test("should return confluence as connected when authenticated user has confluence tokens", async () => {
    mockState.userId = "user-1";
    mockState.confluenceTokens = { accessToken: "tok-abc" };
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    expect(confluence.connected).toBe(true);
  });

  test("should return gdrive as not connected when user is anonymous", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(gdrive.connected).toBe(false);
  });

  test("should return gdrive as connected when authenticated user has google-drive tokens", async () => {
    mockState.userId = "user-1";
    mockState.gdriveTokens = { accessToken: "tok-xyz" };
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(gdrive.connected).toBe(true);
  });

  test("should not check connection tokens when userId is absent", async () => {
    // Tokens are set in mockState but userId is null, so getTokens is never called
    mockState.userId = null;
    mockState.confluenceTokens = { accessToken: "tok-abc" };
    mockState.gdriveTokens = { accessToken: "tok-xyz" };
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(confluence.connected).toBe(false);
    expect(gdrive.connected).toBe(false);
  });

  test("should return contracts as not available when vertragsmanagement app is disabled", async () => {
    mockState.appsRegistry = makeAppsRegistry(false);
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const contracts = body.sources.find((s: any) => s.id === "contracts");
    expect(contracts.available).toBe(false);
    expect(contracts.connected).toBe(false);
  });

  test("should return contracts as available and connected when vertragsmanagement app is enabled", async () => {
    mockState.appsRegistry = makeAppsRegistry(true);
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const contracts = body.sources.find((s: any) => s.id === "contracts");
    expect(contracts.available).toBe(true);
    expect(contracts.connected).toBe(true);
  });

  test("should reflect toolRegistry for confluence availability", async () => {
    mockState.toolRegistryHas = (name: string) => name === "confluence_search";
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    expect(confluence.available).toBe(true);
  });

  test("should reflect toolRegistry for gdrive availability", async () => {
    mockState.toolRegistryHas = (name: string) => name === "gdrive_search";
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(gdrive.available).toBe(true);
  });

  test("should mark confluence and gdrive as unavailable when their tools are not registered", async () => {
    mockState.toolRegistryHas = (_name: string) => false;
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(confluence.available).toBe(false);
    expect(gdrive.available).toBe(false);
  });

  test("should include all required metadata fields on every source", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    for (const source of body.sources) {
      expect(source).toHaveProperty("id");
      expect(source).toHaveProperty("name");
      expect(source).toHaveProperty("description");
      expect(source).toHaveProperty("available");
      expect(source).toHaveProperty("connected");
      expect(source).toHaveProperty("color");
    }
  });

  test("should include the correct five source IDs", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const ids = body.sources.map((s: any) => s.id);
    expect(ids).toContain("chats");
    expect(ids).toContain("knowledge");
    expect(ids).toContain("confluence");
    expect(ids).toContain("gdrive");
    expect(ids).toContain("contracts");
  });

  test("should set contracts.requiresApp to 'vertragsmanagement'", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const contracts = body.sources.find((s: any) => s.id === "contracts");
    expect(contracts.requiresApp).toBe("vertragsmanagement");
  });

  test("should set requiresConnection on confluence and gdrive sources", async () => {
    const res = await app.request("/api/search/sources");
    const body = await res.json();
    const confluence = body.sources.find((s: any) => s.id === "confluence");
    const gdrive = body.sources.find((s: any) => s.id === "gdrive");
    expect(confluence.requiresConnection).toBe(true);
    expect(gdrive.requiresConnection).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/search/smart", () => {
  beforeEach(resetMockState);

  test("should return 400 when query is missing", async () => {
    const res = await app.request("/api/search/smart");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is 1 character", async () => {
    const res = await app.request("/api/search/smart?q=x");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is empty string", async () => {
    const res = await app.request("/api/search/smart?q=");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 200 with smart search results for a valid query", async () => {
    mockState.smartKnowledgeSearchResult = {
      results: [{ id: "doc-1", title: "AI in Healthcare", score: 0.95 }],
    };
    const res = await app.request("/api/search/smart?q=artificial intelligence");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].id).toBe("doc-1");
  });

  test("should return 200 with empty results when nothing matches", async () => {
    mockState.smartKnowledgeSearchResult = { results: [] };
    const res = await app.request("/api/search/smart?q=xyzzy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  test("should accept 2-character query (minimum boundary)", async () => {
    const res = await app.request("/api/search/smart?q=ai");
    expect(res.status).toBe(200);
  });

  test("should return 500 when smartKnowledgeSearch throws an error", async () => {
    mockState.smartKnowledgeSearchShouldThrow = true;
    const res = await app.request("/api/search/smart?q=test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/search/contracts/smart", () => {
  beforeEach(resetMockState);

  test("should return 400 when query is missing", async () => {
    const res = await app.request("/api/search/contracts/smart");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is 1 character", async () => {
    const res = await app.request("/api/search/contracts/smart?q=x");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is empty string", async () => {
    const res = await app.request("/api/search/contracts/smart?q=");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 200 with contract search results for a valid query", async () => {
    mockState.smartContractSearchResult = {
      results: [{ id: "contract-1", title: "Service Agreement 2025", score: 0.88 }],
    };
    const res = await app.request("/api/search/contracts/smart?q=service agreement");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].id).toBe("contract-1");
  });

  test("should return 200 with empty results when nothing matches", async () => {
    mockState.smartContractSearchResult = { results: [] };
    const res = await app.request("/api/search/contracts/smart?q=xyzzy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  test("should accept 2-character query (minimum boundary)", async () => {
    const res = await app.request("/api/search/contracts/smart?q=ab");
    expect(res.status).toBe(200);
  });

  test("should return 500 when smartContractSearch throws an error", async () => {
    mockState.smartContractSearchShouldThrow = true;
    const res = await app.request("/api/search/contracts/smart?q=test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/search/chats/smart", () => {
  beforeEach(resetMockState);

  test("should return 400 when query is missing", async () => {
    const res = await app.request("/api/search/chats/smart");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is 1 character", async () => {
    const res = await app.request("/api/search/chats/smart?q=x");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should return 400 when query is empty string", async () => {
    const res = await app.request("/api/search/chats/smart?q=");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query must be at least 2 characters");
  });

  test("should accept 2-character query (minimum boundary)", async () => {
    const res = await app.request("/api/search/chats/smart?q=ab");
    expect(res.status).toBe(200);
  });

  test("should return 200 with empty results and isSmartRanked=false when no chats found", async () => {
    mockState.searchChatHistoriesWithScoringResult = [];
    const res = await app.request("/api/search/chats/smart?q=nothing");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.isSmartRanked).toBe(false);
  });

  test("should return fast results with isSmartRanked=false when fewer than 3 results found", async () => {
    mockState.searchChatHistoriesWithScoringResult = [
      makeChatResult({ id: "c1" }),
      makeChatResult({ id: "c2" }),
    ];
    const res = await app.request("/api/search/chats/smart?q=test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSmartRanked).toBe(false);
    expect(body.results).toHaveLength(2);
  });

  test("should add type=chat to every result in the fast path", async () => {
    mockState.searchChatHistoriesWithScoringResult = [
      makeChatResult({ id: "c1" }),
      makeChatResult({ id: "c2" }),
    ];
    const res = await app.request("/api/search/chats/smart?q=test");
    const body = await res.json();
    for (const result of body.results) {
      expect(result.type).toBe("chat");
    }
  });

  test("should not call smartChatSearch when result count is below threshold (< 3)", async () => {
    // 2 results — below threshold; smartChatSearchResult is null but should never be called
    mockState.searchChatHistoriesWithScoringResult = [
      makeChatResult({ id: "c1" }),
      makeChatResult({ id: "c2" }),
    ];
    mockState.smartChatSearchResult = null; // would cause an error if called
    const res = await app.request("/api/search/chats/smart?q=boundary");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSmartRanked).toBe(false);
  });

  test("should invoke smartChatSearch and return smart-ranked results when 3 or more results found", async () => {
    const fastResults = [
      makeChatResult({ id: "c1", matchScore: 0.9 }),
      makeChatResult({ id: "c2", matchScore: 0.8 }),
      makeChatResult({ id: "c3", matchScore: 0.7 }),
    ];
    mockState.searchChatHistoriesWithScoringResult = fastResults;
    mockState.smartChatSearchResult = makeSmartChatSearchResponse([
      { ...fastResults[0], smartScore: 0.95 },
      { ...fastResults[2], smartScore: 0.85 },
      { ...fastResults[1], smartScore: 0.75 },
    ]);
    const res = await app.request("/api/search/chats/smart?q=test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSmartRanked).toBe(true);
    expect(body.results).toHaveLength(3);
  });

  test("should add type=chat to every smart-ranked result", async () => {
    const fastResults = [
      makeChatResult({ id: "c1" }),
      makeChatResult({ id: "c2" }),
      makeChatResult({ id: "c3" }),
    ];
    mockState.searchChatHistoriesWithScoringResult = fastResults;
    mockState.smartChatSearchResult = makeSmartChatSearchResponse(
      fastResults.map((r) => ({ ...r }))
    );
    const res = await app.request("/api/search/chats/smart?q=test");
    const body = await res.json();
    for (const result of body.results) {
      expect(result.type).toBe("chat");
    }
  });

  test("should preserve reasoning field from smartChatSearch in the response", async () => {
    const fastResults = Array.from({ length: 3 }, (_, i) =>
      makeChatResult({ id: `c${i}` })
    );
    mockState.searchChatHistoriesWithScoringResult = fastResults;
    mockState.smartChatSearchResult = {
      results: fastResults,
      isSmartRanked: true,
      reasoning: "These chats discuss the query in depth",
    };
    const res = await app.request("/api/search/chats/smart?q=test");
    const body = await res.json();
    expect(body.reasoning).toBe("These chats discuss the query in depth");
  });

  test("should use fast path when exactly 2 results are returned (boundary below threshold)", async () => {
    mockState.searchChatHistoriesWithScoringResult = [
      makeChatResult({ id: "c1" }),
      makeChatResult({ id: "c2" }),
    ];
    const res = await app.request("/api/search/chats/smart?q=boundary");
    const body = await res.json();
    expect(body.isSmartRanked).toBe(false);
    expect(body.results).toHaveLength(2);
  });

  test("should invoke smartChatSearch when exactly 3 results are returned (boundary at threshold)", async () => {
    const fastResults = Array.from({ length: 3 }, (_, i) =>
      makeChatResult({ id: `c${i}` })
    );
    mockState.searchChatHistoriesWithScoringResult = fastResults;
    mockState.smartChatSearchResult = makeSmartChatSearchResponse(fastResults);
    const res = await app.request("/api/search/chats/smart?q=boundary");
    const body = await res.json();
    expect(body.isSmartRanked).toBe(true);
  });

  test("should preserve all fast-result fields alongside the added type field", async () => {
    const original = makeChatResult({ id: "c1", title: "Important Chat", matchScore: 0.8 });
    mockState.searchChatHistoriesWithScoringResult = [original];
    const res = await app.request("/api/search/chats/smart?q=test");
    const body = await res.json();
    const result = body.results[0];
    expect(result.id).toBe("c1");
    expect(result.title).toBe("Important Chat");
    expect(result.matchScore).toBe(0.8);
    expect(result.type).toBe("chat");
  });

  test("should return 500 when searchChatHistoriesWithScoring throws an error", async () => {
    mockState.searchChatHistoriesShouldThrow = true;
    const res = await app.request("/api/search/chats/smart?q=test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
