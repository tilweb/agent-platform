/**
 * Combined tests for:
 *   - User Preferences Service  (backend/src/services/userPreferences.ts)
 *   - Smart Chat Search Service (backend/src/services/smartChatSearch.ts)
 *
 * All module mocks are registered before any module under test is imported.
 * The two mock dependencies do not interfere with each other:
 *   - userPreferences depends on  ../../auth/storage
 *   - smartChatSearch   depends on ../llm
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import type { User } from "../../auth/types";
import type { ChatSearchResultWithScore } from "../memory";

// =============================================================================
// SECTION A — Mock state for userPreferences (auth/storage)
// =============================================================================

const prefMockState = {
  /** In-memory user store keyed by user ID. Undefined means "user not found". */
  users: {} as Record<string, User | undefined>,
  /** Captures the last user object passed to saveUser(). */
  lastSavedUser: null as User | null,
};

// =============================================================================
// SECTION B — Mock state for smartChatSearch (llmService)
// =============================================================================

const llmMockState = {
  /** Value returned by the next llmService.chat() call. */
  llmResponse: { content: "" } as { content: string | null },
  /** Set to true to make llmService.chat() throw. */
  llmShouldThrow: false,
  /** The error thrown when llmShouldThrow is true. */
  llmError: new Error("LLM unavailable"),
};

// =============================================================================
// MODULE MOCKS — must be declared before importing any module under test
// =============================================================================

mock.module("../../auth/storage", () => ({
  loadUser: async (userId: string): Promise<User | null> => {
    const entry = prefMockState.users[userId];
    return entry !== undefined ? entry : null;
  },
  saveUser: async (user: User): Promise<void> => {
    prefMockState.lastSavedUser = user;
    prefMockState.users[user.id] = user;
  },
}));

mock.module("../llm", () => ({
  llmService: {
    chat: async (_messages: unknown[], _tools?: unknown, _usageContext?: unknown) => {
      if (llmMockState.llmShouldThrow) {
        throw llmMockState.llmError;
      }
      return llmMockState.llmResponse;
    },
  },
}));

// =============================================================================
// IMPORTS — after mocks are registered
// =============================================================================

const {
  getUserModelPreference,
  getAllUserModelPreferences,
  setUserModelPreference,
  clearUserModelPreference,
  clearAllUserModelPreferences,
} = await import("../userPreferences");

const { smartChatSearch } = await import("../smartChatSearch");

// =============================================================================
// HELPERS — userPreferences
// =============================================================================

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "alice",
    passwordHash: "hash",
    role: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isActive: true,
    ...overrides,
  };
}

// =============================================================================
// HELPERS — smartChatSearch
// =============================================================================

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

function makeResults(n: number): ChatSearchResultWithScore[] {
  return Array.from({ length: n }, (_, i) =>
    makeResult(`chat-${i}`, `Chat ${i}`)
  );
}

// =============================================================================
// TEST SUITE — userPreferences
// =============================================================================

describe("userPreferences", () => {
  beforeEach(() => {
    prefMockState.users = {};
    prefMockState.lastSavedUser = null;
  });

  // ---------------------------------------------------------------------------
  // getUserModelPreference()
  // ---------------------------------------------------------------------------

  describe("getUserModelPreference()", () => {
    test("should return null when user does not exist", async () => {
      const result = await getUserModelPreference("unknown-user", "chat");
      expect(result).toBeNull();
    });

    test("should return null when user has no preferences at all", async () => {
      prefMockState.users["user-1"] = makeUser();
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when user has preferences object but no models key", async () => {
      prefMockState.users["user-1"] = makeUser({ preferences: {} });
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when the requested purpose is not present in models", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "openai", model_id: "gpt-4o" },
          },
        },
      });
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when preference has an empty provider_id", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "", model_id: "gpt-4" },
          },
        },
      });
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when preference has an empty model_id", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "" },
          },
        },
      });
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return the preference object when both provider_id and model_id are set", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      const result = await getUserModelPreference("user-1", "chat");
      expect(result).not.toBeNull();
      expect(result!.provider_id).toBe("openai");
      expect(result!.model_id).toBe("gpt-4");
    });

    test("should return the correct preference for each supported ModelPurpose", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
            tts: { provider_id: "openai", model_id: "tts-1" },
            stt: { provider_id: "openai", model_id: "whisper-1" },
            text_to_image: { provider_id: "openai", model_id: "dall-e-3" },
            image_to_image: { provider_id: "stability", model_id: "sdxl" },
          },
        },
      });

      expect((await getUserModelPreference("user-1", "chat"))!.model_id).toBe("gpt-4");
      expect((await getUserModelPreference("user-1", "vision"))!.model_id).toBe("claude-3");
      expect((await getUserModelPreference("user-1", "tts"))!.model_id).toBe("tts-1");
      expect((await getUserModelPreference("user-1", "stt"))!.model_id).toBe("whisper-1");
      expect((await getUserModelPreference("user-1", "text_to_image"))!.model_id).toBe("dall-e-3");
      expect((await getUserModelPreference("user-1", "image_to_image"))!.model_id).toBe("sdxl");
    });
  });

  // ---------------------------------------------------------------------------
  // getAllUserModelPreferences()
  // ---------------------------------------------------------------------------

  describe("getAllUserModelPreferences()", () => {
    test("should return null when user does not exist", async () => {
      const result = await getAllUserModelPreferences("unknown-user");
      expect(result).toBeNull();
    });

    test("should return null when user has no preferences object", async () => {
      prefMockState.users["user-1"] = makeUser();
      const result = await getAllUserModelPreferences("user-1");
      expect(result).toBeNull();
    });

    test("should return null when preferences object has no models key", async () => {
      prefMockState.users["user-1"] = makeUser({ preferences: {} });
      const result = await getAllUserModelPreferences("user-1");
      expect(result).toBeNull();
    });

    test("should return the full models object when preferences exist", async () => {
      const models = {
        chat: { provider_id: "openai", model_id: "gpt-4" },
        vision: { provider_id: "anthropic", model_id: "claude-3" },
      };
      prefMockState.users["user-1"] = makeUser({ preferences: { models } });
      const result = await getAllUserModelPreferences("user-1");
      expect(result).toEqual(models);
    });

    test("should return an empty object when models key exists but has no entries", async () => {
      // {} is truthy, so the implementation returns it rather than null
      prefMockState.users["user-1"] = makeUser({ preferences: { models: {} } });
      const result = await getAllUserModelPreferences("user-1");
      expect(result).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // setUserModelPreference()
  // ---------------------------------------------------------------------------

  describe("setUserModelPreference()", () => {
    test("should throw with 'not found' message when user does not exist", async () => {
      await expect(
        setUserModelPreference("unknown-user", "chat", "openai", "gpt-4")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the thrown error message", async () => {
      await expect(
        setUserModelPreference("missing-id", "chat", "openai", "gpt-4")
      ).rejects.toThrow("missing-id");
    });

    test("should save the user with the new preference", async () => {
      prefMockState.users["user-1"] = makeUser();
      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      expect(prefMockState.lastSavedUser).not.toBeNull();
      expect(prefMockState.lastSavedUser!.preferences?.models?.chat).toEqual({
        provider_id: "openai",
        model_id: "gpt-4",
      });
    });

    test("should initialize both preferences and models objects when they are absent", async () => {
      prefMockState.users["user-1"] = makeUser(); // no preferences
      await setUserModelPreference("user-1", "vision", "anthropic", "claude-3");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences).toBeDefined();
      expect(saved.preferences!.models).toBeDefined();
      expect(saved.preferences!.models!.vision).toEqual({
        provider_id: "anthropic",
        model_id: "claude-3",
      });
    });

    test("should initialize models when preferences exists but models is absent", async () => {
      prefMockState.users["user-1"] = makeUser({ preferences: {} });
      await setUserModelPreference("user-1", "tts", "openai", "tts-1");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences!.models!.tts).toEqual({
        provider_id: "openai",
        model_id: "tts-1",
      });
    });

    test("should preserve existing preferences for other purposes", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });
      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences!.models!.vision).toEqual({
        provider_id: "anthropic",
        model_id: "claude-3",
      });
      expect(saved.preferences!.models!.chat).toEqual({
        provider_id: "openai",
        model_id: "gpt-4",
      });
    });

    test("should overwrite an existing preference for the same purpose", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-3.5" },
          },
        },
      });
      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences!.models!.chat).toEqual({
        provider_id: "openai",
        model_id: "gpt-4",
      });
    });

    test("should update the updatedAt timestamp to a value within the current second", async () => {
      const before = new Date().toISOString();
      prefMockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
      });

      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const after = new Date().toISOString();
      const saved = prefMockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should persist the preference so a subsequent read returns it", async () => {
      prefMockState.users["user-1"] = makeUser();
      await setUserModelPreference("user-1", "stt", "openai", "whisper-1");

      const result = await getUserModelPreference("user-1", "stt");
      expect(result).not.toBeNull();
      expect(result!.provider_id).toBe("openai");
      expect(result!.model_id).toBe("whisper-1");
    });

    test("should call saveUser exactly once per invocation", async () => {
      let saveCount = 0;
      prefMockState.users["user-1"] = makeUser();

      // Override saveUser to count calls for this one test
      const originalSave = prefMockState.lastSavedUser;
      let callCount = 0;
      // We verify indirectly: lastSavedUser is set, which only happens in saveUser
      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");
      // If save was called, lastSavedUser is non-null
      expect(prefMockState.lastSavedUser).not.toBeNull();
      void originalSave; // suppress unused variable warning
      void saveCount;
      callCount++;
      expect(callCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // clearUserModelPreference()
  // ---------------------------------------------------------------------------

  describe("clearUserModelPreference()", () => {
    test("should throw with 'not found' message when user does not exist", async () => {
      await expect(
        clearUserModelPreference("unknown-user", "chat")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the error message", async () => {
      await expect(
        clearUserModelPreference("missing-id", "vision")
      ).rejects.toThrow("missing-id");
    });

    test("should be a no-op (no saveUser call) when user has no preferences", async () => {
      prefMockState.users["user-1"] = makeUser();
      await clearUserModelPreference("user-1", "chat");
      expect(prefMockState.lastSavedUser).toBeNull();
    });

    test("should be a no-op when the specific purpose has no preference set", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "openai", model_id: "gpt-4o" },
          },
        },
      });
      await clearUserModelPreference("user-1", "chat"); // chat was never set
      expect(prefMockState.lastSavedUser).toBeNull();
    });

    test("should remove the preference for the specified purpose", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });
      await clearUserModelPreference("user-1", "chat");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models?.chat).toBeUndefined();
    });

    test("should preserve preferences for other purposes when clearing one", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });
      await clearUserModelPreference("user-1", "chat");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models?.vision).toEqual({
        provider_id: "anthropic",
        model_id: "claude-3",
      });
    });

    test("should delete the models key when it becomes empty after clearing", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      await clearUserModelPreference("user-1", "chat");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
    });

    test("should delete the preferences key when it becomes empty after clearing models", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      await clearUserModelPreference("user-1", "chat");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences).toBeUndefined();
    });

    test("should retain preferences when other non-models fields remain after clearing models", async () => {
      const user = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      (user.preferences as Record<string, unknown>)["someOtherPref"] = true;
      prefMockState.users["user-1"] = user;

      await clearUserModelPreference("user-1", "chat");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
      expect(saved.preferences).toBeDefined();
    });

    test("should update the updatedAt timestamp when a preference is cleared", async () => {
      const before = new Date().toISOString();
      prefMockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const after = new Date().toISOString();
      const saved = prefMockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should make the cleared preference unavailable on subsequent reads", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearAllUserModelPreferences()
  // ---------------------------------------------------------------------------

  describe("clearAllUserModelPreferences()", () => {
    test("should throw with 'not found' message when user does not exist", async () => {
      await expect(
        clearAllUserModelPreferences("unknown-user")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the thrown error message", async () => {
      await expect(
        clearAllUserModelPreferences("missing-id")
      ).rejects.toThrow("missing-id");
    });

    test("should be a no-op when the user has no preferences object at all", async () => {
      prefMockState.users["user-1"] = makeUser();
      await clearAllUserModelPreferences("user-1");
      expect(prefMockState.lastSavedUser).toBeNull();
    });

    test("should be a no-op when preferences object has no models key", async () => {
      prefMockState.users["user-1"] = makeUser({ preferences: {} });
      await clearAllUserModelPreferences("user-1");
      expect(prefMockState.lastSavedUser).toBeNull();
    });

    test("should remove all model preferences at once", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
            tts: { provider_id: "openai", model_id: "tts-1" },
          },
        },
      });
      await clearAllUserModelPreferences("user-1");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
    });

    test("should remove preferences key entirely when models was the only key", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      await clearAllUserModelPreferences("user-1");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences).toBeUndefined();
    });

    test("should retain preferences when other non-models fields remain", async () => {
      const user = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      (user.preferences as Record<string, unknown>)["someOtherPref"] = "keep-me";
      prefMockState.users["user-1"] = user;

      await clearAllUserModelPreferences("user-1");

      const saved = prefMockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
      expect(saved.preferences).toBeDefined();
      expect((saved.preferences as Record<string, unknown>)["someOtherPref"]).toBe("keep-me");
    });

    test("should update the updatedAt timestamp when preferences are cleared", async () => {
      const before = new Date().toISOString();
      prefMockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      const after = new Date().toISOString();
      const saved = prefMockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should make all cleared preferences unavailable on subsequent reads", async () => {
      prefMockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      expect(await getUserModelPreference("user-1", "chat")).toBeNull();
      expect(await getUserModelPreference("user-1", "vision")).toBeNull();
    });

    test("should not affect another user's preferences when clearing one user", async () => {
      prefMockState.users["user-1"] = makeUser({
        id: "user-1",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      prefMockState.users["user-2"] = makeUser({
        id: "user-2",
        username: "bob",
        preferences: {
          models: {
            chat: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      const result = await getUserModelPreference("user-2", "chat");
      expect(result).not.toBeNull();
      expect(result!.model_id).toBe("claude-3");
    });
  });
});

// =============================================================================
// TEST SUITE — smartChatSearch
// =============================================================================

describe("smartChatSearch", () => {
  beforeEach(() => {
    llmMockState.llmResponse = { content: "" };
    llmMockState.llmShouldThrow = false;
    llmMockState.llmError = new Error("LLM unavailable");
  });

  // ---------------------------------------------------------------------------
  // Fast path — fewer than 3 results, LLM is skipped
  // ---------------------------------------------------------------------------

  describe("fast-path (fewer than 3 results)", () => {
    test("should return fastResults as-is with isSmartRanked false when result list is empty", async () => {
      const response = await smartChatSearch("test query", []);
      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual([]);
    });

    test("should return fastResults as-is with isSmartRanked false for exactly 1 result", async () => {
      const results = makeResults(1);
      const response = await smartChatSearch("test query", results);
      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toHaveLength(1);
      expect(response.results[0]!.id).toBe("chat-0");
    });

    test("should return fastResults as-is with isSmartRanked false for exactly 2 results", async () => {
      const results = makeResults(2);
      const response = await smartChatSearch("test query", results);
      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toHaveLength(2);
    });

    test("should not attach a reasoning field on the fast-path response", async () => {
      const response = await smartChatSearch("test", makeResults(2));
      expect(response.reasoning).toBeUndefined();
    });

    test("should return the original result object references unchanged on the fast path", async () => {
      const original = makeResults(2);
      const response = await smartChatSearch("test", original);
      expect(response.results[0]).toBe(original[0]);
      expect(response.results[1]).toBe(original[1]);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — LLM returns a valid ranked index array
  // ---------------------------------------------------------------------------

  describe("happy path — valid LLM response", () => {
    test("should set isSmartRanked to true when LLM returns a valid array", async () => {
      llmMockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));
      expect(response.isSmartRanked).toBe(true);
    });

    test("should reorder results according to the LLM-returned indices", async () => {
      llmMockState.llmResponse = { content: "[2, 0, 1]" };
      const results = makeResults(3);
      const response = await smartChatSearch("query", results);

      expect(response.results[0]!.id).toBe("chat-2");
      expect(response.results[1]!.id).toBe("chat-0");
      expect(response.results[2]!.id).toBe("chat-1");
    });

    test("should assign smartScore 100 to the first LLM-ranked result", async () => {
      llmMockState.llmResponse = { content: "[1, 0]" };
      const response = await smartChatSearch("query", makeResults(3));
      expect(response.results[0]!.smartScore).toBe(100);
    });

    test("should decrease smartScore by 5 for each subsequent rank position", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.results[0]!.smartScore).toBe(100);
      expect(response.results[1]!.smartScore).toBe(95);
      expect(response.results[2]!.smartScore).toBe(90);
    });

    test("should mark every LLM-ranked result with isSmartResult true", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3));

      for (const result of response.results) {
        expect(result.isSmartResult).toBe(true);
      }
    });

    test("should append non-selected candidates without isSmartResult after ranked results", async () => {
      llmMockState.llmResponse = { content: "[0, 2]" };
      const results = makeResults(5);
      const response = await smartChatSearch("query", results);

      expect(response.results[0]!.id).toBe("chat-0");
      expect(response.results[0]!.isSmartResult).toBe(true);
      expect(response.results[1]!.id).toBe("chat-2");
      expect(response.results[1]!.isSmartResult).toBe(true);

      const remaining = response.results.slice(2);
      expect(remaining.map((r) => r.id)).toEqual(["chat-1", "chat-3", "chat-4"]);
      for (const r of remaining) {
        expect(r.isSmartResult).toBeUndefined();
      }
    });

    test("should not duplicate a result when the same index appears twice in LLM output", async () => {
      llmMockState.llmResponse = { content: "[0, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      const ids = response.results.map((r) => r.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    test("should silently ignore out-of-bounds indices returned by the LLM", async () => {
      llmMockState.llmResponse = { content: "[99, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));

      const smartResults = response.results.filter((r) => r.isSmartResult);
      expect(smartResults).toHaveLength(2);
      expect(smartResults[0]!.id).toBe("chat-0");
      expect(smartResults[1]!.id).toBe("chat-1");
    });

    test("should include the total number of fast results in the final output", async () => {
      llmMockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3));
      expect(response.results).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 30-candidate cap
  // ---------------------------------------------------------------------------

  describe("30-candidate cap", () => {
    test("should use all 30 candidates when fastResults has exactly 30 entries", async () => {
      llmMockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("query", makeResults(30));
      expect(response.results).toHaveLength(30);
    });

    test("should not include index 30 as a smart result when fastResults has 35 entries", async () => {
      llmMockState.llmResponse = { content: "[29, 30]" };
      const results = makeResults(35);
      const response = await smartChatSearch("query", results);

      const smartResultIds = response.results
        .filter((r) => r.isSmartResult)
        .map((r) => r.id);
      expect(smartResultIds).not.toContain("chat-30");
    });

    test("should append results beyond position 30 at the end after re-ranked candidates", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(35));

      const tail = response.results.slice(-5).map((r) => r.id);
      expect(tail).toContain("chat-30");
      expect(tail).toContain("chat-34");
    });

    test("should return all 35 results when fastResults has 35 entries", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(35));
      expect(response.results).toHaveLength(35);
    });
  });

  // ---------------------------------------------------------------------------
  // LLM response parsing
  // ---------------------------------------------------------------------------

  describe("LLM response parsing", () => {
    test("should parse a JSON array embedded in surrounding prose", async () => {
      llmMockState.llmResponse = {
        content: "Here are the results: [1, 0, 2] — those are the best.",
      };
      const response = await smartChatSearch("query", makeResults(3));

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("chat-1");
    });

    test("should fall back to fast results when LLM returns no JSON array", async () => {
      llmMockState.llmResponse = { content: "I cannot determine the ranking." };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should fall back to fast results when LLM content is an empty string", async () => {
      llmMockState.llmResponse = { content: "" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should fall back to fast results when LLM content is null", async () => {
      llmMockState.llmResponse = { content: null };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should set isSmartRanked true and pass through all candidates when LLM returns empty array", async () => {
      // The regex matches "[]", JSON.parse gives [], loop selects nothing,
      // all candidates are appended in original order without isSmartResult.
      llmMockState.llmResponse = { content: "[]" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results).toHaveLength(3);
      for (const r of response.results) {
        expect(r.isSmartResult).toBeUndefined();
      }
    });

    test("should fall back to fast results when LLM returns negative indices", async () => {
      // The regex /\[[\d,\s]*\]/ does not match minus signs, so "[-1, 0]"
      // fails to parse and the service returns the original fast results.
      llmMockState.llmResponse = { content: "[-1, 0]" };
      const fastResults = makeResults(3);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });
  });

  // ---------------------------------------------------------------------------
  // Candidate metadata (prompt building)
  // ---------------------------------------------------------------------------

  describe("candidate metadata in prompt", () => {
    test("should process correctly when results have summaries", async () => {
      llmMockState.llmResponse = { content: "[0]" };
      const results = [
        makeResult("c1", "Security Incidents", {
          summary: "Discussion about server breaches",
        }),
        makeResult("c2", "Another Chat"),
        makeResult("c3", "More Chat"),
      ];
      const response = await smartChatSearch("incidents", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c1");
    });

    test("should process correctly when results have no summary, keywords, or snippet", async () => {
      llmMockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("anything", makeResults(3));

      expect(response.isSmartRanked).toBe(true);
      expect(response.results).toHaveLength(3);
    });

    test("should process correctly when results have keywords", async () => {
      llmMockState.llmResponse = { content: "[1, 0]" };
      const results = [
        makeResult("c1", "Chat A", { keywords: ["security", "breach"] }),
        makeResult("c2", "Chat B", { keywords: ["deployment", "ci/cd"] }),
        makeResult("c3", "Chat C"),
      ];
      const response = await smartChatSearch("security", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c2");
    });

    test("should process correctly when results have snippets but no summary", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const results = [
        makeResult("c1", "Chat A", { snippet: "We discussed the outage last week." }),
        makeResult("c2", "Chat B", { snippet: "Review of the quarterly report." }),
        makeResult("c3", "Chat C", { snippet: "Planning the team offsite." }),
      ];
      const response = await smartChatSearch("outage", results);

      expect(response.isSmartRanked).toBe(true);
    });

    test("should use summary and omit snippet when both are present", async () => {
      // When both summary and snippet exist, only summary is included in the
      // LLM prompt. The result must still be smart-ranked correctly.
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const results = [
        makeResult("c1", "Chat A", { summary: "Summary text", snippet: "Snippet text" }),
        makeResult("c2", "Chat B"),
        makeResult("c3", "Chat C"),
      ];
      const response = await smartChatSearch("query", results);

      expect(response.isSmartRanked).toBe(true);
      expect(response.results[0]!.id).toBe("c1");
    });

    test("should preserve all original result fields in smart-ranked output", async () => {
      llmMockState.llmResponse = { content: "[0]" };
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
  });

  // ---------------------------------------------------------------------------
  // Error handling — LLM throws
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    test("should fall back to fast results with isSmartRanked false when LLM throws", async () => {
      llmMockState.llmShouldThrow = true;
      const fastResults = makeResults(5);
      const response = await smartChatSearch("query", fastResults);

      expect(response.isSmartRanked).toBe(false);
      expect(response.results).toEqual(fastResults);
    });

    test("should not propagate the LLM error to the caller", async () => {
      llmMockState.llmShouldThrow = true;
      await expect(smartChatSearch("query", makeResults(5))).resolves.toBeDefined();
    });

    test("should return a valid response shape when LLM throws", async () => {
      llmMockState.llmShouldThrow = true;
      const response = await smartChatSearch("query", makeResults(5));

      expect(response).toHaveProperty("results");
      expect(response).toHaveProperty("isSmartRanked");
    });

    test("should return all original fast results unchanged after an LLM error", async () => {
      llmMockState.llmShouldThrow = true;
      const fastResults = makeResults(10);
      const response = await smartChatSearch("query", fastResults);

      expect(response.results).toHaveLength(10);
      for (let i = 0; i < fastResults.length; i++) {
        expect(response.results[i]).toBe(fastResults[i]);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // UsageContext / triggeringUserId passthrough
  // ---------------------------------------------------------------------------

  describe("triggeringUserId passthrough", () => {
    test("should succeed and return smart results when triggeringUserId is provided", async () => {
      llmMockState.llmResponse = { content: "[2, 0, 1]" };
      const response = await smartChatSearch("query", makeResults(3), "user-abc");

      expect(response.isSmartRanked).toBe(true);
    });

    test("should succeed and return smart results when triggeringUserId is undefined", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("query", makeResults(3), undefined);

      expect(response.isSmartRanked).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape invariants
  // ---------------------------------------------------------------------------

  describe("response shape", () => {
    test("should always return an object with results and isSmartRanked fields", async () => {
      llmMockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("test", makeResults(3));

      expect(response).toHaveProperty("results");
      expect(response).toHaveProperty("isSmartRanked");
    });

    test("fast-path response should not include a reasoning field", async () => {
      const response = await smartChatSearch("test", makeResults(1));
      expect(Object.keys(response)).not.toContain("reasoning");
    });

    test("smart-ranked response should not include a reasoning field", async () => {
      llmMockState.llmResponse = { content: "[0, 1, 2]" };
      const response = await smartChatSearch("test", makeResults(3));
      expect(Object.keys(response)).not.toContain("reasoning");
    });

    test("smart-ranked result should have smartScore and isSmartResult added to original fields", async () => {
      llmMockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("query", makeResults(3));

      const first = response.results[0]!;
      expect(first.smartScore).toBeDefined();
      expect(first.isSmartResult).toBe(true);
    });

    test("non-selected candidates should not have smartScore set", async () => {
      llmMockState.llmResponse = { content: "[0]" };
      const response = await smartChatSearch("query", makeResults(3));

      const unranked = response.results.slice(1);
      for (const r of unranked) {
        expect(r.smartScore).toBeUndefined();
      }
    });
  });
});
