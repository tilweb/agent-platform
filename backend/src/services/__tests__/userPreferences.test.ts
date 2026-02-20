/**
 * Tests for the User Preferences Service
 * (backend/src/services/userPreferences.ts)
 *
 * The auth/storage module is mocked so no real file I/O occurs.
 * Mocks are registered BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import type { User } from "../../auth/types";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** In-memory user store keyed by user ID. null means "user does not exist". */
  users: {} as Record<string, User | null>,
  /** Captures the last user object passed to saveUser(). */
  lastSavedUser: null as User | null,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../auth/storage", () => ({
  loadUser: async (userId: string): Promise<User | null> => {
    const entry = mockState.users[userId];
    if (entry === undefined) return null; // not found
    return entry;
  },
  saveUser: async (user: User): Promise<void> => {
    mockState.lastSavedUser = user;
    mockState.users[user.id] = user;
  },
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  getUserModelPreference,
  getAllUserModelPreferences,
  setUserModelPreference,
  clearUserModelPreference,
  clearAllUserModelPreferences,
} = await import("../userPreferences");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("userPreferences", () => {
  // Reset mock state before each test so tests are fully independent.
  beforeEach(() => {
    mockState.users = {};
    mockState.lastSavedUser = null;
  });

  // -------------------------------------------------------------------------
  // getUserModelPreference()
  // -------------------------------------------------------------------------

  describe("getUserModelPreference()", () => {
    test("should return null when user does not exist", async () => {
      const result = await getUserModelPreference("unknown-user", "chat");
      expect(result).toBeNull();
    });

    test("should return null when user has no preferences at all", async () => {
      mockState.users["user-1"] = makeUser();

      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when user has preferences but no models", async () => {
      mockState.users["user-1"] = makeUser({ preferences: {} });

      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when the requested purpose has no preference set", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "openai", model_id: "gpt-4o" },
          },
        },
      });

      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when preference exists but provider_id is missing", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "", model_id: "gpt-4" },
          },
        },
      });

      const result = await getUserModelPreference("user-1", "chat");
      expect(result).toBeNull();
    });

    test("should return null when preference exists but model_id is missing", async () => {
      mockState.users["user-1"] = makeUser({
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
      mockState.users["user-1"] = makeUser({
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

    test("should return correct preference for each supported purpose", async () => {
      mockState.users["user-1"] = makeUser({
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

  // -------------------------------------------------------------------------
  // getAllUserModelPreferences()
  // -------------------------------------------------------------------------

  describe("getAllUserModelPreferences()", () => {
    test("should return null when user does not exist", async () => {
      const result = await getAllUserModelPreferences("unknown-user");
      expect(result).toBeNull();
    });

    test("should return null when user has no preferences", async () => {
      mockState.users["user-1"] = makeUser();

      const result = await getAllUserModelPreferences("user-1");
      expect(result).toBeNull();
    });

    test("should return null when user preferences object has no models", async () => {
      mockState.users["user-1"] = makeUser({ preferences: {} });

      const result = await getAllUserModelPreferences("user-1");
      expect(result).toBeNull();
    });

    test("should return the full models object when preferences exist", async () => {
      const models = {
        chat: { provider_id: "openai", model_id: "gpt-4" },
        vision: { provider_id: "anthropic", model_id: "claude-3" },
      };
      mockState.users["user-1"] = makeUser({ preferences: { models } });

      const result = await getAllUserModelPreferences("user-1");
      expect(result).toEqual(models);
    });

    test("should return an empty models object when models key exists but is empty", async () => {
      mockState.users["user-1"] = makeUser({ preferences: { models: {} } });

      const result = await getAllUserModelPreferences("user-1");
      // models: {} is falsy in JS? No — {} is truthy; the service returns it.
      // The implementation returns `user.preferences?.models || null`,
      // so an empty object {} is truthy and should be returned as-is.
      expect(result).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // setUserModelPreference()
  // -------------------------------------------------------------------------

  describe("setUserModelPreference()", () => {
    test("should throw when user does not exist", async () => {
      await expect(
        setUserModelPreference("unknown-user", "chat", "openai", "gpt-4")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the thrown error message", async () => {
      await expect(
        setUserModelPreference("missing-id", "chat", "openai", "gpt-4")
      ).rejects.toThrow("missing-id");
    });

    test("should save the user with the new preference when user exists", async () => {
      mockState.users["user-1"] = makeUser();

      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      expect(mockState.lastSavedUser).not.toBeNull();
      expect(mockState.lastSavedUser!.preferences?.models?.chat).toEqual({
        provider_id: "openai",
        model_id: "gpt-4",
      });
    });

    test("should initialize preferences and models objects when they are absent", async () => {
      mockState.users["user-1"] = makeUser(); // no preferences at all

      await setUserModelPreference("user-1", "vision", "anthropic", "claude-3");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences).toBeDefined();
      expect(saved.preferences!.models).toBeDefined();
      expect(saved.preferences!.models!.vision).toEqual({
        provider_id: "anthropic",
        model_id: "claude-3",
      });
    });

    test("should initialize models when preferences exists but models is absent", async () => {
      mockState.users["user-1"] = makeUser({ preferences: {} });

      await setUserModelPreference("user-1", "tts", "openai", "tts-1");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences!.models!.tts).toEqual({
        provider_id: "openai",
        model_id: "tts-1",
      });
    });

    test("should preserve existing preferences for other purposes", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const saved = mockState.lastSavedUser!;
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
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-3.5" },
          },
        },
      });

      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences!.models!.chat).toEqual({
        provider_id: "openai",
        model_id: "gpt-4",
      });
    });

    test("should update the updatedAt timestamp", async () => {
      const before = new Date().toISOString();
      mockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
      });

      await setUserModelPreference("user-1", "chat", "openai", "gpt-4");

      const after = new Date().toISOString();
      const saved = mockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should persist the preference so subsequent reads return it", async () => {
      mockState.users["user-1"] = makeUser();

      await setUserModelPreference("user-1", "stt", "openai", "whisper-1");

      const result = await getUserModelPreference("user-1", "stt");
      expect(result).not.toBeNull();
      expect(result!.provider_id).toBe("openai");
      expect(result!.model_id).toBe("whisper-1");
    });
  });

  // -------------------------------------------------------------------------
  // clearUserModelPreference()
  // -------------------------------------------------------------------------

  describe("clearUserModelPreference()", () => {
    test("should throw when user does not exist", async () => {
      await expect(
        clearUserModelPreference("unknown-user", "chat")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the thrown error message", async () => {
      await expect(
        clearUserModelPreference("missing-id", "vision")
      ).rejects.toThrow("missing-id");
    });

    test("should do nothing (and not call saveUser) when no preferences exist", async () => {
      mockState.users["user-1"] = makeUser(); // no preferences

      await clearUserModelPreference("user-1", "chat");

      // saveUser should not have been called since there was nothing to clear
      expect(mockState.lastSavedUser).toBeNull();
    });

    test("should do nothing when the specific purpose has no preference set", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            vision: { provider_id: "openai", model_id: "gpt-4o" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat"); // chat was never set

      expect(mockState.lastSavedUser).toBeNull();
    });

    test("should remove the preference for the given purpose", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences?.models?.chat).toBeUndefined();
    });

    test("should preserve preferences for other purposes when one is cleared", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences?.models?.vision).toEqual({
        provider_id: "anthropic",
        model_id: "claude-3",
      });
    });

    test("should remove models key from preferences when it becomes empty", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
    });

    test("should remove preferences key entirely when it becomes empty after clearing models", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences).toBeUndefined();
    });

    test("should NOT remove preferences key when other non-models fields remain", async () => {
      // The preferences object may contain fields beyond models in the future.
      // The implementation only deletes preferences if Object.keys(user.preferences).length === 0.
      // We simulate this by treating preferences as a plain record with extra keys.
      const user = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      // Inject an extra key to simulate non-empty preferences after models is removed
      (user.preferences as Record<string, unknown>)["someOtherPref"] = true;
      mockState.users["user-1"] = user;

      await clearUserModelPreference("user-1", "chat");

      const saved = mockState.lastSavedUser!;
      // models should be gone, but preferences should remain because it's non-empty
      expect(saved.preferences?.models).toBeUndefined();
      expect(saved.preferences).toBeDefined();
    });

    test("should update the updatedAt timestamp when a preference is cleared", async () => {
      const before = new Date().toISOString();
      mockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearUserModelPreference("user-1", "chat");

      const after = new Date().toISOString();
      const saved = mockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should make cleared preference unavailable on subsequent reads", async () => {
      mockState.users["user-1"] = makeUser({
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

  // -------------------------------------------------------------------------
  // clearAllUserModelPreferences()
  // -------------------------------------------------------------------------

  describe("clearAllUserModelPreferences()", () => {
    test("should throw when user does not exist", async () => {
      await expect(
        clearAllUserModelPreferences("unknown-user")
      ).rejects.toThrow("User 'unknown-user' not found");
    });

    test("should include the user ID in the thrown error message", async () => {
      await expect(
        clearAllUserModelPreferences("missing-id")
      ).rejects.toThrow("missing-id");
    });

    test("should do nothing (and not call saveUser) when user has no preferences", async () => {
      mockState.users["user-1"] = makeUser(); // no preferences

      await clearAllUserModelPreferences("user-1");

      expect(mockState.lastSavedUser).toBeNull();
    });

    test("should do nothing (and not call saveUser) when preferences has no models key", async () => {
      mockState.users["user-1"] = makeUser({ preferences: {} });

      await clearAllUserModelPreferences("user-1");

      expect(mockState.lastSavedUser).toBeNull();
    });

    test("should remove all model preferences at once", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
            vision: { provider_id: "anthropic", model_id: "claude-3" },
            tts: { provider_id: "openai", model_id: "tts-1" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
    });

    test("should remove preferences key entirely when models was the only key", async () => {
      mockState.users["user-1"] = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences).toBeUndefined();
    });

    test("should NOT remove preferences key when other non-models fields remain", async () => {
      const user = makeUser({
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      (user.preferences as Record<string, unknown>)["someOtherPref"] = "keep-me";
      mockState.users["user-1"] = user;

      await clearAllUserModelPreferences("user-1");

      const saved = mockState.lastSavedUser!;
      expect(saved.preferences?.models).toBeUndefined();
      expect(saved.preferences).toBeDefined();
      expect((saved.preferences as Record<string, unknown>)["someOtherPref"]).toBe("keep-me");
    });

    test("should update the updatedAt timestamp when preferences are cleared", async () => {
      const before = new Date().toISOString();
      mockState.users["user-1"] = makeUser({
        updatedAt: "2020-01-01T00:00:00.000Z",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      const after = new Date().toISOString();
      const saved = mockState.lastSavedUser!;
      expect(saved.updatedAt >= before).toBe(true);
      expect(saved.updatedAt <= after).toBe(true);
    });

    test("should make all preferences unavailable on subsequent reads", async () => {
      mockState.users["user-1"] = makeUser({
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

    test("should not affect other users when clearing one user's preferences", async () => {
      mockState.users["user-1"] = makeUser({
        id: "user-1",
        preferences: {
          models: {
            chat: { provider_id: "openai", model_id: "gpt-4" },
          },
        },
      });
      mockState.users["user-2"] = makeUser({
        id: "user-2",
        username: "bob",
        preferences: {
          models: {
            chat: { provider_id: "anthropic", model_id: "claude-3" },
          },
        },
      });

      await clearAllUserModelPreferences("user-1");

      // user-2's preferences should remain intact
      const result = await getUserModelPreference("user-2", "chat");
      expect(result).not.toBeNull();
      expect(result!.model_id).toBe("claude-3");
    });
  });
});
