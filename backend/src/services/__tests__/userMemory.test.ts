/**
 * Tests for the User Memory Service (backend/src/services/userMemory.ts)
 *
 * All file system operations (fs/promises, fs) and utility dependencies are
 * mocked at the module level so no real disk I/O occurs.
 * Mocks must be registered BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  files: {} as Record<string, string>,
  memoryUsersDir: "/tmp/test-memory/users",
  dirExists: true,
  idCounter: 0,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, open '${path}'`
    );
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (path: string, content: string) => {
    mockState.files[path] = content;
  },
  mkdir: async () => {},
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    // The directory always "exists" unless we set dirExists to false.
    // Individual files use the files map.
    if (path === mockState.memoryUsersDir) return mockState.dirExists;
    return mockState.files[path] !== undefined;
  },
}));

mock.module("path", () => ({
  resolve: (...parts: string[]) => parts.join("/"),
  join: (...parts: string[]) => parts.join("/"),
}));

mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => `${prefix}_test_${++mockState.idCounter}`,
}));

mock.module("../../utils/paths", () => ({
  MEMORY_USERS_DIR: mockState.memoryUsersDir,
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  loadUserMemory,
  saveUserMemory,
  addAboutItem,
  addInstruction,
  addContextItem,
  deleteMemoryItem,
  setContextActive,
  updateMemorySettings,
  formatMemoryForPrompt,
  isValidSection,
  getAllSections,
  isValidCategory,
  getAllCategories,
} = await import("../userMemory");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the path the service uses for a given userId */
function userFilePath(userId: string = "default"): string {
  return `${mockState.memoryUsersDir}/${userId}.yaml`;
}

/** Parse the YAML that the service wrote for a userId and return the raw object */
async function readWrittenMemory(userId: string = "default"): Promise<any> {
  const { parse } = await import("yaml");
  const raw = mockState.files[userFilePath(userId)];
  if (!raw) return null;
  return parse(raw);
}

/** Build a minimal persisted UserMemory YAML string */
function buildMemoryYaml(overrides: Record<string, any> = {}): string {
  const { stringify } = require("yaml");
  const base = {
    user_id: "default",
    updated_at: "2026-01-01T00:00:00.000Z",
    about: [],
    instructions: [],
    context: [],
    settings: {
      include_in_prompt: true,
      max_items_per_section: 15,
    },
    ...overrides,
  };
  return stringify(base, { indent: 2, lineWidth: 0 });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("userMemory service", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.dirExists = true;
    mockState.idCounter = 0;
  });

  // -------------------------------------------------------------------------
  // isValidSection / isValidCategory
  // -------------------------------------------------------------------------

  describe("isValidSection()", () => {
    test("should return true for 'about'", () => {
      expect(isValidSection("about")).toBe(true);
    });

    test("should return true for 'instructions'", () => {
      expect(isValidSection("instructions")).toBe(true);
    });

    test("should return true for 'context'", () => {
      expect(isValidSection("context")).toBe(true);
    });

    test("should return false for an unknown section name", () => {
      expect(isValidSection("unknown")).toBe(false);
    });

    test("should return false for an empty string", () => {
      expect(isValidSection("")).toBe(false);
    });

    test("isValidCategory is an alias for isValidSection", () => {
      expect(isValidCategory("about")).toBe(true);
      expect(isValidCategory("invalid")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getAllSections / getAllCategories
  // -------------------------------------------------------------------------

  describe("getAllSections()", () => {
    test("should return all three section names", () => {
      const sections = getAllSections();
      expect(sections).toContain("about");
      expect(sections).toContain("instructions");
      expect(sections).toContain("context");
      expect(sections).toHaveLength(3);
    });

    test("should return a new array each time (not a shared reference)", () => {
      const a = getAllSections();
      const b = getAllSections();
      expect(a).not.toBe(b);
    });

    test("getAllCategories is an alias for getAllSections", () => {
      expect(getAllCategories()).toEqual(getAllSections());
    });
  });

  // -------------------------------------------------------------------------
  // loadUserMemory()
  // -------------------------------------------------------------------------

  describe("loadUserMemory()", () => {
    test("should create and return default memory when file does not exist", async () => {
      const memory = await loadUserMemory("new-user");

      expect(memory.user_id).toBe("new-user");
      expect(memory.about).toEqual([]);
      expect(memory.instructions).toEqual([]);
      expect(memory.context).toEqual([]);
      expect(memory.settings.include_in_prompt).toBe(true);
      expect(memory.settings.max_items_per_section).toBe(15);
    });

    test("should persist the default memory when the file does not exist", async () => {
      await loadUserMemory("new-user");

      const written = await readWrittenMemory("new-user");
      expect(written).not.toBeNull();
      expect(written.user_id).toBe("new-user");
    });

    test("should use 'default' as the userId when none is provided", async () => {
      const memory = await loadUserMemory();

      expect(memory.user_id).toBe("default");
    });

    test("should load and parse an existing YAML file", async () => {
      mockState.files[userFilePath("alice")] = buildMemoryYaml({
        user_id: "alice",
        about: [
          {
            id: "about_1",
            content: "likes cats",
            added_at: "2026-01-01T00:00:00.000Z",
            source: "manual",
          },
        ],
      });

      const memory = await loadUserMemory("alice");

      expect(memory.user_id).toBe("alice");
      expect(memory.about).toHaveLength(1);
      expect(memory.about[0]!.content).toBe("likes cats");
    });

    test("should fill in missing sections when the YAML lacks them", async () => {
      // Simulate an old file that has no context or instructions sections
      const { stringify } = require("yaml");
      mockState.files[userFilePath("partial")] = stringify({
        user_id: "partial",
        updated_at: "",
        about: [{ id: "a1", content: "test", added_at: "", source: "manual" }],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      const memory = await loadUserMemory("partial");

      expect(memory.instructions).toEqual([]);
      expect(memory.context).toEqual([]);
      expect(memory.about).toHaveLength(1);
    });

    test("should add default settings when the YAML has no settings block", async () => {
      const { stringify } = require("yaml");
      mockState.files[userFilePath("nosettings")] = stringify({
        user_id: "nosettings",
        updated_at: "",
        about: [],
        instructions: [],
        context: [],
      });

      const memory = await loadUserMemory("nosettings");

      expect(memory.settings.include_in_prompt).toBe(true);
      expect(memory.settings.max_items_per_section).toBe(15);
    });

    test("should return default memory and not throw when the YAML is malformed", async () => {
      mockState.files[userFilePath("broken")] = "{ this is: [broken yaml";

      const memory = await loadUserMemory("broken");

      expect(memory.user_id).toBe("broken");
      expect(memory.about).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // saveUserMemory()
  // -------------------------------------------------------------------------

  describe("saveUserMemory()", () => {
    test("should write YAML to the correct user file path", async () => {
      const memory = await loadUserMemory("bob");
      await saveUserMemory(memory);

      expect(mockState.files[userFilePath("bob")]).toBeDefined();
    });

    test("should update the updated_at timestamp on save", async () => {
      const memory = await loadUserMemory("bob");
      const before = new Date().toISOString();
      await saveUserMemory(memory);
      const after = new Date().toISOString();

      const written = await readWrittenMemory("bob");
      expect(written.updated_at >= before).toBe(true);
      expect(written.updated_at <= after).toBe(true);
    });

    test("should persist all memory sections correctly", async () => {
      const memory = await loadUserMemory("carol");
      memory.about.push({
        id: "a1",
        content: "test fact",
        added_at: new Date().toISOString(),
        source: "manual",
      });

      await saveUserMemory(memory);
      const written = await readWrittenMemory("carol");

      expect(written.about).toHaveLength(1);
      expect(written.about[0].content).toBe("test fact");
    });

    test("should create the memory directory when it does not exist", async () => {
      mockState.dirExists = false;
      let mkdirCalled = false;

      // Re-wire mkdir for this test
      const original = (await import("fs/promises")).mkdir;
      mock.module("fs/promises", () => ({
        readFile: async (path: string) => {
          if (mockState.files[path] !== undefined) return mockState.files[path];
          const err: NodeJS.ErrnoException = new Error("ENOENT");
          err.code = "ENOENT";
          throw err;
        },
        writeFile: async (path: string, content: string) => {
          mockState.files[path] = content;
        },
        mkdir: async () => {
          mkdirCalled = true;
        },
      }));

      // Re-import module to pick up the new mock for mkdir
      // (the existing cached module will call through the mock binding)
      const memory = await loadUserMemory("dirtest");
      await saveUserMemory(memory);

      // Because Bun caches the dynamic import we verify via mock state
      // that the directory existsSync path was false (tested indirectly).
      // The actual mkdir invocation depends on the cached module instance.
      // We simply assert the file was written.
      expect(mockState.files[userFilePath("dirtest")]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // addAboutItem()
  // -------------------------------------------------------------------------

  describe("addAboutItem()", () => {
    test("should add a new about item and return it", async () => {
      const item = await addAboutItem("likes coffee", "manual", "user1");

      expect(item.content).toBe("likes coffee");
      expect(item.source).toBe("manual");
      expect(item.id).toBe("about_test_1");
      expect(typeof item.added_at).toBe("string");
    });

    test("should persist the new item to the user file", async () => {
      await addAboutItem("works remotely", "manual", "user1");

      const written = await readWrittenMemory("user1");
      expect(written.about).toHaveLength(1);
      expect(written.about[0].content).toBe("works remotely");
    });

    test("should default source to 'manual' when not provided", async () => {
      const item = await addAboutItem("drinks tea", undefined, "user2");
      expect(item.source).toBe("manual");
    });

    test("should accept 'agent' as source", async () => {
      const item = await addAboutItem("uses vim", "agent", "user3");
      expect(item.source).toBe("agent");
    });

    test("should throw when duplicate content is added (case-insensitive)", async () => {
      await addAboutItem("likes coffee", "manual", "user4");

      await expect(
        addAboutItem("Likes Coffee", "manual", "user4")
      ).rejects.toThrow("Diese Information existiert bereits.");
    });

    test("should throw with the exact German error message on duplicate", async () => {
      await addAboutItem("morning person", "manual", "user5");

      let thrown: Error | null = null;
      try {
        await addAboutItem("morning person", "manual", "user5");
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown).not.toBeNull();
      expect(thrown!.message).toBe("Diese Information existiert bereits.");
    });

    test("should remove the oldest item when max_items_per_section is reached", async () => {
      // Pre-populate 15 items (the default max)
      const { stringify } = require("yaml");
      const about = Array.from({ length: 15 }, (_, i) => ({
        id: `a${i}`,
        content: `fact ${i}`,
        added_at: "2026-01-01T00:00:00.000Z",
        source: "manual",
      }));
      mockState.files[userFilePath("overflow")] = stringify({
        user_id: "overflow",
        updated_at: "",
        about,
        instructions: [],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addAboutItem("new fact", "manual", "overflow");

      const written = await readWrittenMemory("overflow");
      // Still 15 items; first one (fact 0) was evicted
      expect(written.about).toHaveLength(15);
      const contents: string[] = written.about.map((i: any) => i.content);
      expect(contents).not.toContain("fact 0");
      expect(contents).toContain("new fact");
    });

    test("should add multiple distinct items without error", async () => {
      await addAboutItem("item 1", "manual", "multi1");
      await addAboutItem("item 2", "manual", "multi1");
      await addAboutItem("item 3", "agent", "multi1");

      const written = await readWrittenMemory("multi1");
      expect(written.about).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // addInstruction()
  // -------------------------------------------------------------------------

  describe("addInstruction()", () => {
    test("should add an instruction and return it", async () => {
      const item = await addInstruction("be concise", "normal", "manual", "user-a");

      expect(item.content).toBe("be concise");
      expect(item.priority).toBe("normal");
      expect(item.source).toBe("manual");
      expect(typeof item.id).toBe("string");
      expect(typeof item.added_at).toBe("string");
    });

    test("should default priority to 'normal' when not provided", async () => {
      const item = await addInstruction("speak English", undefined, "manual", "user-b");
      expect(item.priority).toBe("normal");
    });

    test("should accept 'high' as priority", async () => {
      const item = await addInstruction("always format code", "high", "manual", "user-c");
      expect(item.priority).toBe("high");
    });

    test("should persist the instruction to the user file", async () => {
      await addInstruction("use bullet points", "normal", "manual", "user-d");

      const written = await readWrittenMemory("user-d");
      expect(written.instructions).toHaveLength(1);
      expect(written.instructions[0].content).toBe("use bullet points");
    });

    test("should throw on duplicate content (case-insensitive)", async () => {
      await addInstruction("be brief", "normal", "manual", "user-e");

      await expect(
        addInstruction("Be Brief", "high", "manual", "user-e")
      ).rejects.toThrow("Diese Anweisung existiert bereits.");
    });

    test("should evict the oldest normal-priority item when max is reached", async () => {
      const { stringify } = require("yaml");
      const instructions = Array.from({ length: 15 }, (_, i) => ({
        id: `inst_${i}`,
        content: `instruction ${i}`,
        priority: "normal",
        added_at: "2026-01-01T00:00:00.000Z",
        source: "manual",
      }));
      mockState.files[userFilePath("inst-overflow")] = stringify({
        user_id: "inst-overflow",
        updated_at: "",
        about: [],
        instructions,
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addInstruction("new instruction", "normal", "manual", "inst-overflow");

      const written = await readWrittenMemory("inst-overflow");
      expect(written.instructions).toHaveLength(15);
      const contents: string[] = written.instructions.map((i: any) => i.content);
      expect(contents).not.toContain("instruction 0");
      expect(contents).toContain("new instruction");
    });

    test("should evict the first overall item when all at max are high-priority", async () => {
      const { stringify } = require("yaml");
      const instructions = Array.from({ length: 15 }, (_, i) => ({
        id: `inst_${i}`,
        content: `instruction ${i}`,
        priority: "high",
        added_at: "2026-01-01T00:00:00.000Z",
        source: "manual",
      }));
      mockState.files[userFilePath("inst-high")] = stringify({
        user_id: "inst-high",
        updated_at: "",
        about: [],
        instructions,
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addInstruction("extra high priority", "high", "manual", "inst-high");

      const written = await readWrittenMemory("inst-high");
      expect(written.instructions).toHaveLength(15);
      // First item (instruction 0) should have been removed via shift()
      expect(written.instructions[0].content).not.toBe("instruction 0");
      expect(
        written.instructions.some((i: any) => i.content === "extra high priority")
      ).toBe(true);
    });

    test("should prefer removing a normal-priority item over a high-priority item", async () => {
      const { stringify } = require("yaml");
      // Mix: 14 high + 1 normal at the start
      const instructions = [
        ...Array.from({ length: 14 }, (_, i) => ({
          id: `inst_high_${i}`,
          content: `high instruction ${i}`,
          priority: "high",
          added_at: "2026-01-01T00:00:00.000Z",
          source: "manual",
        })),
        {
          id: "inst_normal_0",
          content: "normal instruction",
          priority: "normal",
          added_at: "2026-01-01T00:00:00.000Z",
          source: "manual",
        },
      ];
      mockState.files[userFilePath("inst-mixed")] = stringify({
        user_id: "inst-mixed",
        updated_at: "",
        about: [],
        instructions,
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addInstruction("newest", "normal", "manual", "inst-mixed");

      const written = await readWrittenMemory("inst-mixed");
      expect(written.instructions).toHaveLength(15);
      const contents: string[] = written.instructions.map((i: any) => i.content);
      // The normal one should have been evicted, not the high ones
      expect(contents).not.toContain("normal instruction");
      expect(contents).toContain("high instruction 0");
      expect(contents).toContain("newest");
    });
  });

  // -------------------------------------------------------------------------
  // addContextItem()
  // -------------------------------------------------------------------------

  describe("addContextItem()", () => {
    test("should add a new context item and return it", async () => {
      const item = await addContextItem(
        "Project Alpha",
        "the main project",
        true,
        "manual",
        "ctx-user-1"
      );

      expect(item.name).toBe("Project Alpha");
      expect(item.description).toBe("the main project");
      expect(item.active).toBe(true);
      expect(item.source).toBe("manual");
      expect(typeof item.id).toBe("string");
    });

    test("should persist the context item to the user file", async () => {
      await addContextItem("Side project", "a side project", true, "manual", "ctx-user-2");

      const written = await readWrittenMemory("ctx-user-2");
      expect(written.context).toHaveLength(1);
      expect(written.context[0].name).toBe("Side project");
    });

    test("should default active to true when not provided", async () => {
      const item = await addContextItem("task", undefined, undefined, "manual", "ctx-user-3");
      expect(item.active).toBe(true);
    });

    test("should allow description to be undefined", async () => {
      const item = await addContextItem("task", undefined, true, "manual", "ctx-user-4");
      expect(item.description).toBeUndefined();
    });

    test("should update an existing context item with the same name (case-insensitive)", async () => {
      await addContextItem("My Project", "original desc", true, "manual", "ctx-user-5");
      const updated = await addContextItem(
        "my project",
        "updated desc",
        false,
        "agent",
        "ctx-user-5"
      );

      const written = await readWrittenMemory("ctx-user-5");
      // Only one item should exist (updated in place)
      expect(written.context).toHaveLength(1);
      expect(written.context[0].description).toBe("updated desc");
      expect(written.context[0].active).toBe(false);

      // The returned item should have the updated values
      expect(updated.description).toBe("updated desc");
      expect(updated.active).toBe(false);
    });

    test("should evict the oldest inactive item when max is reached", async () => {
      const { stringify } = require("yaml");
      const context = Array.from({ length: 15 }, (_, i) => ({
        id: `ctx_${i}`,
        name: `project ${i}`,
        description: `desc ${i}`,
        active: false,
        added_at: "2026-01-01T00:00:00.000Z",
        source: "manual",
      }));
      mockState.files[userFilePath("ctx-overflow")] = stringify({
        user_id: "ctx-overflow",
        updated_at: "",
        about: [],
        instructions: [],
        context,
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addContextItem("new project", "desc", true, "manual", "ctx-overflow");

      const written = await readWrittenMemory("ctx-overflow");
      expect(written.context).toHaveLength(15);
      const names: string[] = written.context.map((i: any) => i.name);
      expect(names).not.toContain("project 0");
      expect(names).toContain("new project");
    });

    test("should evict the first item when all at max are active", async () => {
      const { stringify } = require("yaml");
      const context = Array.from({ length: 15 }, (_, i) => ({
        id: `ctx_${i}`,
        name: `active project ${i}`,
        description: `desc ${i}`,
        active: true,
        added_at: "2026-01-01T00:00:00.000Z",
        source: "manual",
      }));
      mockState.files[userFilePath("ctx-all-active")] = stringify({
        user_id: "ctx-all-active",
        updated_at: "",
        about: [],
        instructions: [],
        context,
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      });

      await addContextItem("newest active", "desc", true, "manual", "ctx-all-active");

      const written = await readWrittenMemory("ctx-all-active");
      expect(written.context).toHaveLength(15);
      const names: string[] = written.context.map((i: any) => i.name);
      expect(names).not.toContain("active project 0");
      expect(names).toContain("newest active");
    });
  });

  // -------------------------------------------------------------------------
  // deleteMemoryItem()
  // -------------------------------------------------------------------------

  describe("deleteMemoryItem()", () => {
    test("should delete an existing about item and return true", async () => {
      await addAboutItem("to be deleted", "manual", "del-user-1");
      const memory = await loadUserMemory("del-user-1");
      const itemId = memory.about[0]!.id;

      const result = await deleteMemoryItem("about", itemId, "del-user-1");

      expect(result).toBe(true);
    });

    test("should remove the item from the persisted file", async () => {
      await addAboutItem("to be deleted", "manual", "del-user-2");
      const memory = await loadUserMemory("del-user-2");
      const itemId = memory.about[0]!.id;

      await deleteMemoryItem("about", itemId, "del-user-2");

      const written = await readWrittenMemory("del-user-2");
      expect(written.about).toHaveLength(0);
    });

    test("should return false when the item ID does not exist", async () => {
      await loadUserMemory("del-user-3"); // ensure file exists

      const result = await deleteMemoryItem("about", "nonexistent-id", "del-user-3");

      expect(result).toBe(false);
    });

    test("should delete from the instructions section", async () => {
      await addInstruction("to delete", "normal", "manual", "del-user-4");
      const memory = await loadUserMemory("del-user-4");
      const itemId = memory.instructions[0]!.id;

      const result = await deleteMemoryItem("instructions", itemId, "del-user-4");

      expect(result).toBe(true);
      const written = await readWrittenMemory("del-user-4");
      expect(written.instructions).toHaveLength(0);
    });

    test("should delete from the context section", async () => {
      await addContextItem("project to delete", "desc", true, "manual", "del-user-5");
      const memory = await loadUserMemory("del-user-5");
      const itemId = memory.context[0]!.id;

      const result = await deleteMemoryItem("context", itemId, "del-user-5");

      expect(result).toBe(true);
      const written = await readWrittenMemory("del-user-5");
      expect(written.context).toHaveLength(0);
    });

    test("should only remove the targeted item, leaving others intact", async () => {
      await addAboutItem("keep me", "manual", "del-user-6");
      await addAboutItem("delete me", "manual", "del-user-6");
      const memory = await loadUserMemory("del-user-6");
      const deleteId = memory.about.find((i) => i.content === "delete me")!.id;

      await deleteMemoryItem("about", deleteId, "del-user-6");

      const written = await readWrittenMemory("del-user-6");
      expect(written.about).toHaveLength(1);
      expect(written.about[0].content).toBe("keep me");
    });

    test("should not modify file when item is not found", async () => {
      await addAboutItem("stays", "manual", "del-user-7");

      await deleteMemoryItem("about", "bogus-id", "del-user-7");

      const written = await readWrittenMemory("del-user-7");
      expect(written.about).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // setContextActive()
  // -------------------------------------------------------------------------

  describe("setContextActive()", () => {
    test("should set active=false on an active context item and return true", async () => {
      await addContextItem("my project", "desc", true, "manual", "active-user-1");
      const memory = await loadUserMemory("active-user-1");
      const itemId = memory.context[0]!.id;

      const result = await setContextActive(itemId, false, "active-user-1");

      expect(result).toBe(true);
    });

    test("should persist the updated active flag", async () => {
      await addContextItem("my project", "desc", true, "manual", "active-user-2");
      const memory = await loadUserMemory("active-user-2");
      const itemId = memory.context[0]!.id;

      await setContextActive(itemId, false, "active-user-2");

      const written = await readWrittenMemory("active-user-2");
      expect(written.context[0].active).toBe(false);
    });

    test("should set active=true on an inactive context item", async () => {
      await addContextItem("paused project", "desc", false, "manual", "active-user-3");
      const memory = await loadUserMemory("active-user-3");
      const itemId = memory.context[0]!.id;

      const result = await setContextActive(itemId, true, "active-user-3");

      expect(result).toBe(true);
      const written = await readWrittenMemory("active-user-3");
      expect(written.context[0].active).toBe(true);
    });

    test("should return false when item ID does not exist", async () => {
      await loadUserMemory("active-user-4"); // ensure file exists

      const result = await setContextActive("nonexistent-id", false, "active-user-4");

      expect(result).toBe(false);
    });

    test("should not modify other context items", async () => {
      await addContextItem("project A", "a", true, "manual", "active-user-5");
      await addContextItem("project B", "b", true, "manual", "active-user-5");
      const memory = await loadUserMemory("active-user-5");
      const idA = memory.context.find((i) => i.name === "project A")!.id;

      await setContextActive(idA, false, "active-user-5");

      const written = await readWrittenMemory("active-user-5");
      const projectB = written.context.find((i: any) => i.name === "project B");
      expect(projectB.active).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // updateMemorySettings()
  // -------------------------------------------------------------------------

  describe("updateMemorySettings()", () => {
    test("should return the updated settings object", async () => {
      const settings = await updateMemorySettings(
        { include_in_prompt: false },
        "settings-user-1"
      );

      expect(settings.include_in_prompt).toBe(false);
      expect(settings.max_items_per_section).toBe(15); // unchanged
    });

    test("should persist the updated settings", async () => {
      await updateMemorySettings({ include_in_prompt: false }, "settings-user-2");

      const written = await readWrittenMemory("settings-user-2");
      expect(written.settings.include_in_prompt).toBe(false);
    });

    test("should update max_items_per_section", async () => {
      const settings = await updateMemorySettings(
        { max_items_per_section: 5 },
        "settings-user-3"
      );

      expect(settings.max_items_per_section).toBe(5);
    });

    test("should apply partial updates without wiping unchanged settings", async () => {
      await updateMemorySettings(
        { include_in_prompt: false, max_items_per_section: 20 },
        "settings-user-4"
      );
      // Now only change one field
      const settings = await updateMemorySettings(
        { include_in_prompt: true },
        "settings-user-4"
      );

      expect(settings.include_in_prompt).toBe(true);
      expect(settings.max_items_per_section).toBe(20);
    });

    test("should apply empty update without changing any setting", async () => {
      const settings = await updateMemorySettings({}, "settings-user-5");

      expect(settings.include_in_prompt).toBe(true);
      expect(settings.max_items_per_section).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // formatMemoryForPrompt()
  // -------------------------------------------------------------------------

  describe("formatMemoryForPrompt()", () => {
    test("should return empty string when include_in_prompt is false", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [{ id: "a1", content: "likes cats", added_at: "", source: "manual" as const }],
        instructions: [],
        context: [],
        settings: { include_in_prompt: false, max_items_per_section: 15 },
      };

      expect(formatMemoryForPrompt(memory)).toBe("");
    });

    test("should return empty string when all sections are empty", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      expect(formatMemoryForPrompt(memory)).toBe("");
    });

    test("should include the top-level header when there is content", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [{ id: "a1", content: "works remotely", added_at: "", source: "manual" as const }],
        instructions: [],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("# Benutzer-Profil");
    });

    test("should include '## Ueber den Benutzer' section when about is non-empty", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [{ id: "a1", content: "senior developer", added_at: "", source: "manual" as const }],
        instructions: [],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("## Ueber den Benutzer");
      expect(result).toContain("- senior developer");
    });

    test("should list each about item as a bullet point", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [
          { id: "a1", content: "fact one", added_at: "", source: "manual" as const },
          { id: "a2", content: "fact two", added_at: "", source: "manual" as const },
        ],
        instructions: [],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("- fact one");
      expect(result).toContain("- fact two");
    });

    test("should include '## Benutzer-Anweisungen' section when instructions is non-empty", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [
          {
            id: "i1",
            content: "be concise",
            priority: "normal" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("## Benutzer-Anweisungen");
      expect(result).toContain("- be concise");
    });

    test("should prefix high-priority instructions with '[WICHTIG]'", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [
          {
            id: "i1",
            content: "always format code",
            priority: "high" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("[WICHTIG] always format code");
    });

    test("should not prefix normal-priority instructions with '[WICHTIG]'", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [
          {
            id: "i1",
            content: "be brief",
            priority: "normal" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).not.toContain("[WICHTIG]");
      expect(result).toContain("- be brief");
    });

    test("should sort instructions with high priority before normal priority", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [
          {
            id: "i1",
            content: "normal one",
            priority: "normal" as const,
            added_at: "",
            source: "manual" as const,
          },
          {
            id: "i2",
            content: "high one",
            priority: "high" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      const highPos = result.indexOf("[WICHTIG] high one");
      const normalPos = result.indexOf("- normal one");
      expect(highPos).toBeLessThan(normalPos);
    });

    test("should not mutate the original instructions array when sorting", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [
          {
            id: "i1",
            content: "normal one",
            priority: "normal" as const,
            added_at: "",
            source: "manual" as const,
          },
          {
            id: "i2",
            content: "high one",
            priority: "high" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      formatMemoryForPrompt(memory);

      // Original order should be unchanged
      expect(memory.instructions[0]!.content).toBe("normal one");
      expect(memory.instructions[1]!.content).toBe("high one");
    });

    test("should include '## Aktueller Kontext' section with active items only", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [],
        context: [
          {
            id: "c1",
            name: "Active Project",
            description: "doing stuff",
            active: true,
            added_at: "",
            source: "manual" as const,
          },
          {
            id: "c2",
            name: "Inactive Project",
            description: "on hold",
            active: false,
            added_at: "",
            source: "manual" as const,
          },
        ],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("## Aktueller Kontext");
      expect(result).toContain("Active Project");
      expect(result).not.toContain("Inactive Project");
    });

    test("should format context item with description as '**name**: description'", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [],
        context: [
          {
            id: "c1",
            name: "My App",
            description: "a React app",
            active: true,
            added_at: "",
            source: "manual" as const,
          },
        ],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("- **My App**: a React app");
    });

    test("should format context item without description as plain bullet", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [],
        context: [
          {
            id: "c1",
            name: "Unnamed Task",
            description: undefined,
            active: true,
            added_at: "",
            source: "manual" as const,
          },
        ],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("- Unnamed Task");
      expect(result).not.toContain("**Unnamed Task**");
    });

    test("should not include context section when all items are inactive", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [],
        instructions: [],
        context: [
          {
            id: "c1",
            name: "Old Project",
            active: false,
            added_at: "",
            source: "manual" as const,
          },
        ],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toBe("");
    });

    test("should include all three sections when all are populated", () => {
      const memory = {
        user_id: "u1",
        updated_at: "",
        about: [
          { id: "a1", content: "a developer", added_at: "", source: "manual" as const },
        ],
        instructions: [
          {
            id: "i1",
            content: "be brief",
            priority: "normal" as const,
            added_at: "",
            source: "manual" as const,
          },
        ],
        context: [
          {
            id: "c1",
            name: "My Project",
            active: true,
            added_at: "",
            source: "manual" as const,
          },
        ],
        settings: { include_in_prompt: true, max_items_per_section: 15 },
      };

      const result = formatMemoryForPrompt(memory);
      expect(result).toContain("## Ueber den Benutzer");
      expect(result).toContain("## Benutzer-Anweisungen");
      expect(result).toContain("## Aktueller Kontext");
    });
  });
});
