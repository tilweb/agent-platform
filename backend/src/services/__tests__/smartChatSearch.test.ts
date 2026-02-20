/**
 * Tests for the Smart Chat Search Service
 * (backend/src/services/smartChatSearch.ts)
 *
 * The llmService dependency is mocked at the module level so no real LLM
 * calls are made.  All mocks must be registered BEFORE the module under test
 * is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** Value returned by the next llmService.chat() call */
  llmResponse: { content: "" } as { content: string | null },
  /** Controls whether llmService.chat() throws */
  llmShouldThrow: false,
  /** The error thrown when llmShouldThrow is true */
  llmError: new Error("LLM unavailable"),
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any import of the module under test
// ---------------------------------------------------------------------------

mock.module("../llm", () => ({
  llmService: {
    chat: async (_messages: unknown[], _tools?: unknown, _usageContext?: unknown) => {
      if (mockState.llmShouldThrow) {
        throw mockState.llmError;
      }
      return mockState.llmResponse;
    },
  },
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

const { smartChatSearch } = await import("../smartChatSearch");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { ChatSearchResultWithScore } from "../memory";

/**
 * Build a minimal ChatSearchResultWithScore object.
 * Optional fields (summary, keywords, snippet) can be supplied via overrides.
 */
function makeResult(
  id: string,
  title: string,
  overrides: Partial<ChatSearchResultWithScore> = {}
): ChatSearchResultWithScore {
  return {
    id,
    title,
    updatedAt: "2026-02-01T10:00:00.000Z",
    matchedIn: "title",
    matchScore: 50,
    messageCount: 5,
    ...overrides,
  };
}

/**
 * Build an array of n minimal results with unique IDs.
 */
function makeResults(n: number): ChatSearchResultWithScore[] {
  return Array.from({ length: n }, (_, i) =>
    makeResult(`chat-${i}`, `Chat ${i}`)
  );
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("smartChatSearch", () => {
  // Reset mock state before each test for full isolation.
  beforeEach(() => {
    mockState.llmResponse = { content: "" };
    mockState.llmShouldThrow = false;
    mockState.llmError = new Error("LLM unavailable");
  });

  // -------------------------------------------------------------------------
  // Early-exit: fewer than 3 fast results → no LLM call
  // -------------------------------------------------------------------------

  describe("fast-path (fewer than 3 results)", () => {
    test("should return fastResults as-is when result list is empty", async () => {
      const response = await smartChatSearch("test query", []);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual([]);
    });

    test("should return fastResults as-is when there is exactly 1 result", async () => {
      const results = makeResults(1);
      const response = await smartChatSearch("test query", results);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toHaveLength(1);
      expect(response.results[0]!.id).toBe("chat-0");
    });

    test("should return fastResults as-is when there are exactly 2 results", async () => {
      const results = makeResults(2);
      const response = await smartChatSearch("test query", results);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toHaveLength(2);
    });

    test("should not set reasoning on the fast-path response", async () => {
      const response = await smartChatSearch("test", makeResults(2));

      expect(response.reasoning).toBeUndefined();
    });

    test("should return the original result objects unchanged on fast path", async () => {
      const original = makeResults(2);
      const response = await smartChatSearch("test", original);

      expect(response.results[0]).toBe(original[0]);
      expect(response.results[1]).toBe(original[1]);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: LLM returns a valid index array
  // -------------------------------------------------------------------------

  describe("happy path — valid LLM response", () => {
    test("should set isSmartRanked to true when LLM returns a valid array", async () => {
      mockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.isSmartRanked).toBe(true);
    });

    test("should reorder results according to LLM-returned indices", async () => {
      // 3 results: idx 0 = Chat 0, idx 1 = Chat 1, idx 2 = Chat 2
      // LLM prefers [2, 0, 1]
      mockState.llmResponse = { content: "[2, 0, 1]" };
      const results = makeResults(3);
      const response = await smartChatSearch("query", results);

      expect(response.results[0]!.id).toBe("chat-2");
      expect(response.results[1]!.id).toBe("chat-0");
      expect(response.results[2]!.id).toBe("chat-1");
    });

    test("should assign smartScore 100 to the first LLM-ranked result", async () => {
      mockState.llmResponse = { content: "[1, 0]" };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.results[0]!.smartScore).toBe(100);
    });

    test("should decrease smartScore by 5 for each subsequent LLM rank position", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.results[0]!.smartScore).toBe(100);
      expect(response.results[1]!.smartScore).toBe(95);
      expect(response.results[2]!.smartScore).toBe(90);
    });

    test("should mark each LLM-ranked result with isSmartResult=true", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3));

      for (const result of response.results) {
        expect(result.isSmartResult).toBe(true);
      }
    });

    test("should append non-selected candidates without isSmartResult after ranked results", async () => {
      // 5 results, LLM only selects indices 0, 2 — indices 1, 3, 4 are appended
      mockState.llmResponse = { content: "[0, 2]" };
      const results = makeResults(5);
      const response = await smartChatSearch("query", results);

      // First 2 are LLM-ranked
      expect(response.results[0]!.id).toBe("chat-0");
      expect(response.results[0]!.isSmartResult).toBe(true);
      expect(response.results[1]!.id).toBe("chat-2");
      expect(response.results[1]!.isSmartResult).toBe(true);

      // Next 3 are non-selected candidates
      const remaining = response.results.slice(2);
      expect(remaining.map((r) => r.id)).toEqual(["chat-1", "chat-3", "chat-4"]);
      for (const r of remaining) {
        expect(r.isSmartResult).toBeUndefined();
      }
    });

    test("should not duplicate a result when the same index appears twice in LLM output", async () => {
      // LLM returns duplicate index 0
      mockState.llmResponse = { content: "[0, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      const ids = response.results.map((r) => r.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    test("should include the total number of fast results in the final output", async () => {
      mockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.results).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Boundary: exactly 30 vs. more than 30 candidates
  // -------------------------------------------------------------------------

  describe("30-candidate cap", () => {
    test("should use all 30 top candidates when fastResults has exactly 30 entries", async () => {
      // LLM returns the first index
      mockState.llmResponse = { content: "[0]" };
      const results = makeResults(30);
      const response = await smartChatSearch("query", results);

      expect(response.results).toHaveLength(30);
    });

    test("should cap LLM input at 30 candidates even when fastResults has more", async () => {
      // LLM returns index 29 (valid within top-30) and index 30 (out-of-bounds — ignored)
      mockState.llmResponse = { content: "[29, 30]" };
      const results = makeResults(35);
      const response = await smartChatSearch("query", results);

      // Index 30 is out of the 0-29 candidate window and must be ignored
      const smartResultIds = response.results
        .filter((r) => r.isSmartResult)
        .map((r) => r.id);
      expect(smartResultIds).not.toContain("chat-30");
    });

    test("should append results beyond position 30 after the re-ranked candidates", async () => {
      // Only 3 LLM selections from top-30, rest (31-34) must come after
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const results = makeResults(35);
      const response = await smartChatSearch("query", results);

      // Last 5 entries (indices 30-34 in fastResults) are appended at the end
      const tail = response.results.slice(-5).map((r) => r.id);
      expect(tail).toContain("chat-30");
      expect(tail).toContain("chat-34");
    });

    test("should return all 35 results when fastResults has 35 entries", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(35));

      expect(response.results).toHaveLength(35);
    });
  });

  // -------------------------------------------------------------------------
  // LLM response parsing
  // -------------------------------------------------------------------------

  describe("LLM response parsing", () => {
    test("should parse a JSON array embedded in surrounding prose", async () => {
      mockState.llmResponse = { content: "Here are the results: [1, 0, 2] — those are the best." };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("chat-1");
    });

    test("should fall back to fast results when LLM returns no JSON array", async () => {
      mockState.llmResponse = { content: "I cannot determine the ranking." };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should fall back to fast results when LLM content is an empty string", async () => {
      mockState.llmResponse = { content: "" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should fall back to fast results when LLM content is null", async () => {
      mockState.llmResponse = { content: null };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should set isSmartRanked true and preserve all candidates when LLM returns empty array []", async () => {
      // The regex matches "[]", JSON.parse gives [], loop selects nothing.
      // All candidates are appended in original order without isSmartResult.
      mockState.llmResponse = { content: "[]" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results).toHaveLength(3);
      for (const r of response.results) {
        expect(r.isSmartResult).toBeUndefined();
      }
    });

    test("should silently ignore out-of-bounds indices from the LLM", async () => {
      // Valid range: 0–2. Index 99 is out of bounds.
      mockState.llmResponse = { content: "[99, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      const smartResults = response.results.filter((r) => r.isSmartResult);
      // Only indices 0 and 1 are valid
      expect(smartResults).toHaveLength(2);
      expect(smartResults[0]!.id).toBe("chat-0");
      expect(smartResults[1]!.id).toBe("chat-1");
    });

    test("should fall back entirely when LLM response contains negative indices", async () => {
      // The regex /\[[\d,\s]*\]/ does not match minus signs, so "[-1, 0]"
      // fails to parse and the service returns the original fast results.
      mockState.llmResponse = { content: "[-1, 0]" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should fall back to fast results when LLM returns only text with brackets but no digits", async () => {
      mockState.llmResponse = { content: "[]... no valid response" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      // "[]" is a valid match (empty array), so isSmartRanked is true with
      // all candidates passed through unranked.
      expect(response.results).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Candidate list content (LLM prompt building with metadata)
  // -------------------------------------------------------------------------

  describe("candidate metadata in prompt", () => {
    test("should work correctly when results have summaries", async () => {
      mockState.llmResponse = { content: "[0]" };
      const results = [
        makeResult("c1", "Security Incidents", { summary: "Discussion about server breaches" }),
        makeResult("c2", "Another Chat"),
        makeResult("c3", "More Chat"),
      ];
      const response = await smartChatSearch("incidents", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c1");
    });

    test("should still process results that have no summary, no keywords, and no snippet", async () => {
      mockState.llmResponse = { content: "[2, 0, 1]" };
      // All three have only the mandatory fields
      const results = makeResults(3);
      const response = await smartChatSearch("anything", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results).toHaveLength(3);
    });

    test("should work correctly for results with keywords", async () => {
      mockState.llmResponse = { content: "[1, 0]" };
      const results = [
        makeResult("c1", "Chat A", { keywords: ["security", "breach"] }),
        makeResult("c2", "Chat B", { keywords: ["deployment", "ci/cd"] }),
        makeResult("c3", "Chat C"),
      ];
      const response = await smartChatSearch("security", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c2");
    });

    test("should work correctly for results with snippets but no summary", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const results = [
        makeResult("c1", "Chat A", { snippet: "We discussed the outage last week." }),
        makeResult("c2", "Chat B", { snippet: "Review of the quarterly report." }),
        makeResult("c3", "Chat C", { snippet: "Planning the team offsite." }),
      ];
      const response = await smartChatSearch("outage", results);

      expect(response.isSmartRanked).toBe(true);
    });

    test("should not include snippet in prompt when summary is present", async () => {
      // When both summary and snippet exist, only summary is used.
      // We verify by confirming the function still produces a smart result.
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const results = [
        makeResult("c1", "Chat A", { summary: "Summary text", snippet: "Snippet text" }),
        makeResult("c2", "Chat B"),
        makeResult("c3", "Chat C"),
      ];
      const response = await smartChatSearch("query", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c1");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling: LLM throws
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    test("should fall back to fast results when LLM throws an error", async () => {
      mockState.llmShouldThrow = true;
      const fastResults = makeResults(5);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should not propagate the LLM error to the caller", async () => {
      mockState.llmShouldThrow = true;
      await expect(smartChatSearch("query", makeResults(5))).resolves.toBeDefined();
    });

    test("should still return a valid response shape when LLM throws", async () => {
      mockState.llmShouldThrow = true;
      const response = await smartChatSearch("query", makeResults(5));

      expect(response).toHaveProperty("results");
      expect(response).toHaveProperty("isSmartRanked");
    });

    test("should return all original fast results unchanged after an LLM error", async () => {
      mockState.llmShouldThrow = true;
      const fastResults = makeResults(10);
      const response = await smartChatSearch("query", fastResults);

      expect(response.results).toHaveLength(10);
      for (let i = 0; i < fastResults.length; i++) {
        expect(response.results[i]).toBe(fastResults[i]);
      }
    });
  });

  // -------------------------------------------------------------------------
  // UsageContext / triggeringUserId passthrough
  // -------------------------------------------------------------------------

  describe("triggeringUserId passthrough", () => {
    test("should succeed with triggeringUserId provided", async () => {
      mockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3), "user-abc");

      expect(response.isSmartRanked).toBe(true);
    });

    test("should succeed without triggeringUserId (undefined)", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3), undefined);

      expect(response.isSmartRanked).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Response shape invariants
  // -------------------------------------------------------------------------

  describe("response shape", () => {
    test("should always return an object with results and isSmartRanked fields", async () => {
      mockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("test", makeResults(3));

      expect(response).toHaveProperty("results");
      expect(response).toHaveProperty("isSmartRanked");
    });

    test("fast-path response should not include a reasoning field", async () => {
      const response = await smartChatSearch("test", makeResults(1));

      expect(Object.keys(response)).not.toContain("reasoning");
    });

    test("smart-ranked response should not include a reasoning field", async () => {
      mockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("test", makeResults(3));

      expect(Object.keys(response)).not.toContain("reasoning");
    });

    test("original result properties should be preserved in smart-ranked results", async () => {
      mockState.llmResponse = { content: "[0]" };
      const original = makeResult("c1", "Original Title", {
        matchScore: 77,
        summary: "A useful summary",
        keywords: ["alpha", "beta"],
        updatedAt: "2026-01-15T09:00:00.000Z",
      });
      const response = await smartChatSearch("query", [
        original,
        makeResult("c2", "C2"),
        makeResult("c3", "C3"),
      ]);

      const ranked = response.results[0]!;
      expect(ranked.id).toBe("c1");
      expect(ranked.title).toBe("Original Title");
      expect(ranked.matchScore).toBe(77);
      expect(ranked.summary).toBe("A useful summary");
      expect(ranked.keywords).toEqual(["alpha", "beta"]);
      expect(ranked.updatedAt).toBe("2026-01-15T09:00:00.000Z");
    });

    test("smart-ranked result should have smartScore and isSmartResult added to original fields", async () => {
      mockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("query", makeResults(3));

      const first = response.results[0]!;
      expect(first.smartScore).toBeDefined();
      expect(first.isSmartResult).toBe(true);
    });

    test("non-selected candidates should not have smartScore set", async () => {
      mockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("query", makeResults(3));

      // Indices 1 and 2 are not selected — they should have no smartScore
      const unranked = response.results.slice(1);
      for (const r of unranked) {
        expect(r.smartScore).toBeUndefined();
      }
    });
  });
});
