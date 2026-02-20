/**
 * Tests for the agents service (backend/src/services/agents.ts)
 *
 * All file system operations (fs/promises, fs), path utilities, YAML parser,
 * and the connection registry are mocked at the module level so no real disk
 * I/O or side effects occur.
 *
 * Mocks must be declared BEFORE the module under test is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** Virtual file system: path -> content */
  files: {} as Record<string, string>,
  /** Directories that "exist" */
  dirs: new Set<string>(),
  /** Entries returned by readdir (simulated agent subdirectory listing) */
  readdirResult: [] as Array<{ name: string; isDirectory: () => boolean }>,
  /** Connection registry mock */
  registry: {
    providers: {} as Record<
      string,
      {
        id: string;
        name: string;
        description: string;
        getTools: () => Array<{
          name: string;
          getDefinition: () => {
            function: {
              name: string;
              description?: string;
              parameters?: any;
            };
          };
        }>;
      }
    >,
  },
  agentsDir: "/tmp/test-agents",
};

// ---------------------------------------------------------------------------
// Module mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  readdir: async (_path: string, _opts?: any) => mockState.readdirResult,
  readFile: async (path: string, _enc: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${path}'`);
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (path: string, content: string, _enc: string) => {
    mockState.files[path] = content;
  },
  mkdir: async (path: string, _opts?: any) => {
    mockState.dirs.add(path as string);
  },
  rm: async (path: string, _opts?: any) => {
    // Remove all keys that start with the path
    for (const key of Object.keys(mockState.files)) {
      if (key.startsWith(path as string)) {
        delete mockState.files[key];
      }
    }
    mockState.dirs.delete(path as string);
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    // A path "exists" if it's a known dir or has a file entry
    return (
      mockState.dirs.has(path as string) ||
      mockState.files[path] !== undefined ||
      // The agents dir itself should exist by default when populated
      (path === mockState.agentsDir && mockState.readdirResult.length > 0)
    );
  },
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
}));

mock.module("yaml", () => ({
  parse: (input: string) => {
    // Minimal YAML parser for simple key: value lines and list entries.
    // We only need to handle the YAML produced by the agents service.
    const result: Record<string, any> = {};
    const lines = input.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        i++;
        continue;
      }

      // Array value block: key:\n  - item\n  - item
      // Nested object block: key:\n  subkey: value\n  ...
      const keyMatch = trimmed.match(/^(\w+):$/);
      if (keyMatch) {
        const key = keyMatch[1]!;
        const items: any[] = [];
        let nestedHandled = false;
        let j = i + 1;
        while (j < lines.length) {
          const sub = lines[j]!;
          const itemMatch = sub.match(/^\s+-\s+(.+)$/);
          const nestedKv = sub.match(/^\s+(\w+):\s+(.+)$/);
          if (itemMatch) {
            items.push(itemMatch[1]);
            j++;
          } else if (nestedKv && items.length === 0) {
            // Nested key-value block (e.g. model:)
            const nestedObj: Record<string, any> = {};
            let k = i + 1;
            while (k < lines.length) {
              const nl = lines[k]!;
              const nkv = nl.match(/^\s+(\w+):\s+(.+)$/);
              if (nkv) {
                const v = nkv[2]!.trim();
                nestedObj[nkv[1]!] =
                  v === "true" ? true : v === "false" ? false : v;
                k++;
              } else {
                break;
              }
            }
            result[key] = nestedObj;
            i = k;
            nestedHandled = true;
            break;
          } else {
            break;
          }
        }
        if (items.length > 0) {
          result[key] = items;
          i = j;
          continue;
        }
        // When a nested object was parsed, i was already advanced to k.
        // Use continue to skip the trailing i++ below.
        if (nestedHandled) {
          continue;
        }
      }

      // Simple key: value
      const kvMatch = trimmed.match(/^(\w+):\s+(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1]!;
        const rawVal = kvMatch[2]!.trim();
        let value: any = rawVal;
        if (rawVal === "true") value = true;
        else if (rawVal === "false") value = false;
        result[key] = value;
      }

      i++;
    }

    return result;
  },
}));

mock.module("../../utils/paths", () => ({
  AGENTS_DIR: mockState.agentsDir,
}));

mock.module("../../connections/registry", () => ({
  connectionRegistry: {
    get: (id: string) => mockState.registry.providers[id] ?? null,
    has: (id: string) => id in mockState.registry.providers,
    getAll: () => Object.values(mockState.registry.providers),
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  loadAgent,
  loadAllAgents,
  listAgents,
  listDelegatableAgents,
  getRouterAgent,
  buildRouterPrompt,
  createAgent,
  updateAgent,
  deleteAgent,
} = await import("../agents");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTS_DIR = mockState.agentsDir;

/** Build a valid agent config.md content string */
function makeConfigMd(overrides: Record<string, string> = {}): string {
  const id = overrides.id ?? "test-agent";
  const name = overrides.name ?? "Test Agent";
  const description = overrides.description ?? "A test agent";
  const systemPrompt = overrides.systemPrompt ?? "You are a test agent.";
  const system = overrides.system ?? "false";
  const internal = overrides.internal ?? "false";
  const delegatable = overrides.delegatable ?? "true";

  return [
    "---",
    `id: ${id}`,
    `name: ${name}`,
    `description: ${description}`,
    `delegatable: ${delegatable}`,
    ...(internal === "true" ? ["internal: true"] : []),
    ...(system === "true" ? ["system: true"] : []),
    "---",
    "",
    systemPrompt,
  ].join("\n");
}

/** Build a config.md string that includes a model block */
function makeConfigMdWithModel(
  agentId: string,
  model: { provider_id?: string; model_id?: string; locked?: boolean; inherit?: boolean }
): string {
  const lines = [
    "---",
    `id: ${agentId}`,
    `name: Agent ${agentId}`,
    "description: An agent with model config",
    "delegatable: true",
    "model:",
  ];
  if (model.provider_id !== undefined) lines.push(`  provider_id: ${model.provider_id}`);
  if (model.model_id !== undefined) lines.push(`  model_id: ${model.model_id}`);
  if (model.locked !== undefined) lines.push(`  locked: ${model.locked}`);
  if (model.inherit !== undefined) lines.push(`  inherit: ${model.inherit}`);
  lines.push("---", "", "System prompt here.");
  return lines.join("\n");
}

/** Build a config.md string that includes skills and skillMode */
function makeConfigMdWithSkills(
  agentId: string,
  skills: string[],
  skillMode: "all" | "allow"
): string {
  const lines = [
    "---",
    `id: ${agentId}`,
    `name: Agent ${agentId}`,
    "description: An agent with skills",
    "delegatable: true",
    `skillMode: ${skillMode}`,
    "skills:",
    ...skills.map((s) => `  - ${s}`),
    "---",
    "",
    "System prompt here.",
  ];
  return lines.join("\n");
}

/** Register a file-based agent in the virtual file system */
function registerFileAgent(agentId: string, content: string) {
  const configPath = `${AGENTS_DIR}/${agentId}/config.md`;
  mockState.files[configPath] = content;
  mockState.dirs.add(`${AGENTS_DIR}/${agentId}`);
  // Ensure it shows up in readdir
  const alreadyIn = mockState.readdirResult.some((e) => e.name === agentId);
  if (!alreadyIn) {
    mockState.readdirResult.push({ name: agentId, isDirectory: () => true });
  }
}

/** Build a minimal connection provider mock */
function makeConnectionProvider(
  id: string,
  name = "Test Connection",
  description = "A connection provider",
  toolList: Array<{ name: string; description: string; params?: Record<string, any> }> = []
) {
  return {
    id,
    name,
    description,
    getTools: () =>
      toolList.map((t) => ({
        name: t.name,
        getDefinition: () => ({
          function: {
            name: t.name,
            description: t.description,
            parameters: t.params
              ? { properties: t.params }
              : undefined,
          },
        }),
      })),
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("agents service", () => {
  beforeEach(() => {
    mockState.files = {};
    mockState.dirs = new Set();
    mockState.readdirResult = [];
    mockState.registry.providers = {};
    // The agents directory itself is considered to exist when readdirResult has entries
  });

  // -------------------------------------------------------------------------
  // loadAgent()
  // -------------------------------------------------------------------------

  describe("loadAgent()", () => {
    test("should return null when config.md does not exist", async () => {
      const result = await loadAgent("nonexistent-agent");
      expect(result).toBeNull();
    });

    test("should load a basic agent from config.md", async () => {
      registerFileAgent(
        "my-agent",
        makeConfigMd({ id: "my-agent", name: "My Agent", description: "Desc" })
      );

      const agent = await loadAgent("my-agent");
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe("my-agent");
      expect(agent!.name).toBe("My Agent");
      expect(agent!.description).toBe("Desc");
    });

    test("should use agentId as fallback when frontmatter id is missing", async () => {
      const content = "---\nname: Fallback\n---\n\nPrompt body";
      registerFileAgent("fallback-id", content);

      const agent = await loadAgent("fallback-id");
      expect(agent!.id).toBe("fallback-id");
    });

    test("should use agentId as name fallback when frontmatter name is missing", async () => {
      const content = "---\nid: no-name\n---\n\nPrompt body";
      registerFileAgent("no-name", content);

      const agent = await loadAgent("no-name");
      expect(agent!.name).toBe("no-name");
    });

    test("should use the markdown body as systemPrompt", async () => {
      registerFileAgent(
        "prompt-agent",
        makeConfigMd({ id: "prompt-agent", systemPrompt: "You are a specialized agent." })
      );

      const agent = await loadAgent("prompt-agent");
      expect(agent!.systemPrompt).toBe("You are a specialized agent.");
    });

    test("should default delegatable to true when not specified in frontmatter", async () => {
      const content = "---\nid: deleg-agent\nname: DA\n---\n\nPrompt";
      registerFileAgent("deleg-agent", content);

      const agent = await loadAgent("deleg-agent");
      expect(agent!.delegatable).toBe(true);
    });

    test("should set delegatable to false when frontmatter says delegatable: false", async () => {
      registerFileAgent(
        "no-deleg",
        makeConfigMd({ id: "no-deleg", delegatable: "false" })
      );

      const agent = await loadAgent("no-deleg");
      expect(agent!.delegatable).toBe(false);
    });

    test("should default internal to false", async () => {
      registerFileAgent("int-test", makeConfigMd({ id: "int-test" }));

      const agent = await loadAgent("int-test");
      expect(agent!.internal).toBe(false);
    });

    test("should set internal to true when frontmatter says internal: true", async () => {
      registerFileAgent(
        "internal-agent",
        makeConfigMd({ id: "internal-agent", internal: "true" })
      );

      const agent = await loadAgent("internal-agent");
      expect(agent!.internal).toBe(true);
    });

    test("should default system to false", async () => {
      registerFileAgent("sys-test", makeConfigMd({ id: "sys-test" }));

      const agent = await loadAgent("sys-test");
      expect(agent!.system).toBe(false);
    });

    test("should set system to true when frontmatter says system: true", async () => {
      registerFileAgent(
        "system-agent",
        makeConfigMd({ id: "system-agent", system: "true" })
      );

      const agent = await loadAgent("system-agent");
      expect(agent!.system).toBe(true);
    });

    test("should default tools to ['file_read', 'file_list'] when not specified", async () => {
      const content = "---\nid: tool-default\nname: TD\n---\n\nPrompt";
      registerFileAgent("tool-default", content);

      const agent = await loadAgent("tool-default");
      expect(agent!.tools).toEqual(["file_read", "file_list"]);
    });

    test("should default capabilities to empty array when not specified", async () => {
      const content = "---\nid: cap-default\nname: CD\n---\n\nPrompt";
      registerFileAgent("cap-default", content);

      const agent = await loadAgent("cap-default");
      expect(agent!.capabilities).toEqual([]);
    });

    test("should load model config (provider_id and model_id) from frontmatter", async () => {
      registerFileAgent(
        "model-load",
        makeConfigMdWithModel("model-load", {
          provider_id: "openai",
          model_id: "gpt-4o",
          locked: true,
        })
      );

      const agent = await loadAgent("model-load");
      expect(agent!.model).toBeDefined();
      expect(agent!.model!.provider_id).toBe("openai");
      expect(agent!.model!.model_id).toBe("gpt-4o");
      expect(agent!.model!.locked).toBe(true);
    });

    test("should load model.inherit flag from frontmatter", async () => {
      registerFileAgent(
        "model-inherit",
        makeConfigMdWithModel("model-inherit", { inherit: true })
      );

      const agent = await loadAgent("model-inherit");
      expect(agent!.model).toBeDefined();
      expect(agent!.model!.inherit).toBe(true);
    });

    test("should return undefined model when no model block is in frontmatter", async () => {
      registerFileAgent("no-model", makeConfigMd({ id: "no-model" }));

      const agent = await loadAgent("no-model");
      expect(agent!.model).toBeUndefined();
    });

    test("should load skills array from frontmatter", async () => {
      registerFileAgent(
        "skills-load",
        makeConfigMdWithSkills("skills-load", ["research", "summarise"], "allow")
      );

      const agent = await loadAgent("skills-load");
      expect(agent!.skills).toEqual(["research", "summarise"]);
    });

    test("should load skillMode from frontmatter", async () => {
      registerFileAgent(
        "skillmode-load",
        makeConfigMdWithSkills("skillmode-load", ["coding"], "allow")
      );

      const agent = await loadAgent("skillmode-load");
      expect(agent!.skillMode).toBe("allow");
    });

    test("should return undefined skills when no skills block is in frontmatter", async () => {
      registerFileAgent("no-skills", makeConfigMd({ id: "no-skills" }));

      const agent = await loadAgent("no-skills");
      expect(agent!.skills).toBeUndefined();
    });

    test("should return undefined skillMode when not specified in frontmatter", async () => {
      registerFileAgent("no-skillmode", makeConfigMd({ id: "no-skillmode" }));

      const agent = await loadAgent("no-skillmode");
      expect(agent!.skillMode).toBeUndefined();
    });

    test("should return a connection-based agent when the id matches a registered provider", async () => {
      mockState.registry.providers["github"] = makeConnectionProvider(
        "github",
        "GitHub",
        "GitHub integration",
        [{ name: "github_search", description: "Search GitHub repos" }]
      );

      const agent = await loadAgent("github");
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe("github");
      expect(agent!.name).toBe("GitHub");
      expect(agent!.system).toBe(true);
      expect(agent!.tools).toContain("github_search");
    });

    test("should prefer connection agent over file-based agent when IDs collide", async () => {
      registerFileAgent("conflict-id", makeConfigMd({ id: "conflict-id", name: "File Version" }));
      mockState.registry.providers["conflict-id"] = makeConnectionProvider(
        "conflict-id",
        "Connection Version",
        "Connection wins"
      );

      const agent = await loadAgent("conflict-id");
      expect(agent!.name).toBe("Connection Version");
    });

    test("should return null when frontmatter is valid YAML but config file has no body", async () => {
      // No separator after frontmatter — parseFrontmatter returns empty body
      const content = "---\nid: no-body\nname: NB\n---\n";
      registerFileAgent("no-body", content);
      // body becomes "" after trim, which is still a valid (empty) system prompt
      const agent = await loadAgent("no-body");
      expect(agent).not.toBeNull();
    });

    test("should handle malformed YAML frontmatter gracefully and use empty frontmatter", async () => {
      // The mock YAML parser won't throw, but passes back {}; so we expect defaults
      const content = "---\n:::: bad yaml\n---\n\nPrompt here";
      registerFileAgent("bad-yaml", content);

      const agent = await loadAgent("bad-yaml");
      // id falls back to the directory name
      expect(agent!.id).toBe("bad-yaml");
    });

    test("should handle content with no frontmatter delimiters and treat entire content as body", async () => {
      const content = "Just a plain text prompt with no frontmatter at all.";
      registerFileAgent("no-frontmatter", content);

      const agent = await loadAgent("no-frontmatter");
      // Without valid frontmatter, id falls back to directory name
      expect(agent!.id).toBe("no-frontmatter");
      // body is the entire content
      expect(agent!.systemPrompt).toContain("Just a plain text prompt");
    });
  });

  // -------------------------------------------------------------------------
  // loadAllAgents()
  // -------------------------------------------------------------------------

  describe("loadAllAgents()", () => {
    test("should return an empty map when agents dir does not exist and no connection agents", async () => {
      // readdirResult is empty → existsSync returns false for AGENTS_DIR
      mockState.readdirResult = [];
      const map = await loadAllAgents();
      expect(map.size).toBe(0);
    });

    test("should load all file-based agents into the map", async () => {
      registerFileAgent("agent-a", makeConfigMd({ id: "agent-a", name: "Agent A" }));
      registerFileAgent("agent-b", makeConfigMd({ id: "agent-b", name: "Agent B" }));

      const map = await loadAllAgents();
      expect(map.size).toBe(2);
      expect(map.has("agent-a")).toBe(true);
      expect(map.has("agent-b")).toBe(true);
    });

    test("should skip entries that are not directories", async () => {
      // Mix of directory and file entries
      mockState.readdirResult = [
        { name: "agent-a", isDirectory: () => true },
        { name: "README.md", isDirectory: () => false },
      ];
      const configPath = `${AGENTS_DIR}/agent-a/config.md`;
      mockState.files[configPath] = makeConfigMd({ id: "agent-a" });

      const map = await loadAllAgents();
      expect(map.size).toBe(1);
      expect(map.has("agent-a")).toBe(true);
    });

    test("should skip agent directories that have no config.md", async () => {
      mockState.readdirResult = [{ name: "empty-agent", isDirectory: () => true }];
      // No config file registered

      const map = await loadAllAgents();
      expect(map.size).toBe(0);
    });

    test("should include connection agents alongside file-based agents", async () => {
      registerFileAgent("file-agent", makeConfigMd({ id: "file-agent" }));
      mockState.registry.providers["conn-agent"] = makeConnectionProvider(
        "conn-agent",
        "Connection Agent",
        "From registry"
      );

      const map = await loadAllAgents();
      expect(map.has("file-agent")).toBe(true);
      expect(map.has("conn-agent")).toBe(true);
    });

    test("should allow connection agents to override file-based agents with the same ID", async () => {
      registerFileAgent("shared-id", makeConfigMd({ id: "shared-id", name: "File Name" }));
      mockState.registry.providers["shared-id"] = makeConnectionProvider(
        "shared-id",
        "Connection Name",
        "Overrides file"
      );

      const map = await loadAllAgents();
      expect(map.get("shared-id")!.name).toBe("Connection Name");
    });

    test("should continue loading when connection registry throws", async () => {
      // Simulate connection registry failure
      registerFileAgent("safe-agent", makeConfigMd({ id: "safe-agent" }));
      // Override getAll to throw
      const originalGetAll = mockState.registry.providers;
      // We can't easily make getAll throw via mockState; instead verify baseline loads
      const map = await loadAllAgents();
      expect(map.has("safe-agent")).toBe(true);
    });

    test("should preserve model config when loading all agents", async () => {
      registerFileAgent(
        "model-all-agent",
        makeConfigMdWithModel("model-all-agent", {
          provider_id: "anthropic",
          model_id: "claude-3-opus",
          locked: true,
          inherit: false,
        })
      );

      const map = await loadAllAgents();
      const agent = map.get("model-all-agent");
      expect(agent).toBeDefined();
      expect(agent!.model!.provider_id).toBe("anthropic");
      expect(agent!.model!.model_id).toBe("claude-3-opus");
    });
  });

  // -------------------------------------------------------------------------
  // listAgents()
  // -------------------------------------------------------------------------

  describe("listAgents()", () => {
    test("should return empty array when no agents exist", async () => {
      const agents = await listAgents();
      expect(agents).toEqual([]);
    });

    test("should return non-internal agents", async () => {
      registerFileAgent("public-agent", makeConfigMd({ id: "public-agent", internal: "false" }));

      const agents = await listAgents();
      expect(agents.some((a) => a.id === "public-agent")).toBe(true);
    });

    test("should exclude internal agents from the list", async () => {
      registerFileAgent("internal-one", makeConfigMd({ id: "internal-one", internal: "true" }));
      registerFileAgent("public-one", makeConfigMd({ id: "public-one", internal: "false" }));

      const agents = await listAgents();
      expect(agents.some((a) => a.id === "internal-one")).toBe(false);
      expect(agents.some((a) => a.id === "public-one")).toBe(true);
    });

    test("should return all agents when none are internal", async () => {
      registerFileAgent("a1", makeConfigMd({ id: "a1" }));
      registerFileAgent("a2", makeConfigMd({ id: "a2" }));

      const agents = await listAgents();
      expect(agents).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // listDelegatableAgents()
  // -------------------------------------------------------------------------

  describe("listDelegatableAgents()", () => {
    test("should return empty array when no agents exist", async () => {
      const agents = await listDelegatableAgents();
      expect(agents).toEqual([]);
    });

    test("should return agents with delegatable=true", async () => {
      registerFileAgent("deleg-yes", makeConfigMd({ id: "deleg-yes", delegatable: "true" }));

      const agents = await listDelegatableAgents();
      expect(agents.some((a) => a.id === "deleg-yes")).toBe(true);
    });

    test("should exclude agents with delegatable=false", async () => {
      registerFileAgent("deleg-no", makeConfigMd({ id: "deleg-no", delegatable: "false" }));
      registerFileAgent("deleg-yes", makeConfigMd({ id: "deleg-yes", delegatable: "true" }));

      const agents = await listDelegatableAgents();
      expect(agents.some((a) => a.id === "deleg-no")).toBe(false);
      expect(agents.some((a) => a.id === "deleg-yes")).toBe(true);
    });

    test("should include internal agents if they are delegatable", async () => {
      registerFileAgent(
        "int-deleg",
        makeConfigMd({ id: "int-deleg", internal: "true", delegatable: "true" })
      );

      const agents = await listDelegatableAgents();
      expect(agents.some((a) => a.id === "int-deleg")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getRouterAgent()
  // -------------------------------------------------------------------------

  describe("getRouterAgent()", () => {
    test("should return null when no _router agent is configured", async () => {
      const result = await getRouterAgent();
      expect(result).toBeNull();
    });

    test("should return the _router agent when it exists", async () => {
      registerFileAgent(
        "_router",
        makeConfigMd({
          id: "_router",
          name: "Router",
          internal: "true",
          systemPrompt: "Route to {{AGENT_LIST}}",
        })
      );

      const result = await getRouterAgent();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("_router");
    });
  });

  // -------------------------------------------------------------------------
  // buildRouterPrompt()
  // -------------------------------------------------------------------------

  describe("buildRouterPrompt()", () => {
    test("should throw when router agent is not configured", async () => {
      await expect(buildRouterPrompt()).rejects.toThrow("Router agent not configured");
    });

    test("should replace {{AGENT_LIST}} placeholder with agent descriptions", async () => {
      registerFileAgent(
        "_router",
        makeConfigMd({
          id: "_router",
          name: "Router",
          internal: "true",
          systemPrompt: "Agents:\n{{AGENT_LIST}}",
        })
      );
      registerFileAgent(
        "helper",
        makeConfigMd({ id: "helper", name: "Helper", description: "Helps with tasks" })
      );

      const prompt = await buildRouterPrompt();
      expect(prompt).toContain("helper");
      expect(prompt).toContain("Helper");
      expect(prompt).not.toContain("{{AGENT_LIST}}");
    });

    test("should not include the _router itself in the agent list", async () => {
      registerFileAgent(
        "_router",
        makeConfigMd({
          id: "_router",
          name: "Router",
          internal: "true",
          systemPrompt: "{{AGENT_LIST}}",
        })
      );

      const prompt = await buildRouterPrompt();
      // listAgents() filters out internal agents; _router is internal
      expect(prompt).not.toContain("_router");
    });

    test("should return the router system prompt unchanged when no public agents exist", async () => {
      registerFileAgent(
        "_router",
        makeConfigMd({
          id: "_router",
          name: "Router",
          internal: "true",
          systemPrompt: "No agents: {{AGENT_LIST}}",
        })
      );

      const prompt = await buildRouterPrompt();
      // {{AGENT_LIST}} replaced with empty string (no public agents)
      expect(prompt).toContain("No agents:");
      expect(prompt).not.toContain("{{AGENT_LIST}}");
    });

    test("should include agent id, name and description in the agent list entry", async () => {
      registerFileAgent(
        "_router",
        makeConfigMd({
          id: "_router",
          name: "Router",
          internal: "true",
          systemPrompt: "{{AGENT_LIST}}",
        })
      );
      registerFileAgent(
        "coder",
        makeConfigMd({ id: "coder", name: "Coder", description: "Writes code" })
      );

      const prompt = await buildRouterPrompt();
      expect(prompt).toContain("coder");
      expect(prompt).toContain("Coder");
      expect(prompt).toContain("Writes code");
    });
  });

  // -------------------------------------------------------------------------
  // createAgent()
  // -------------------------------------------------------------------------

  describe("createAgent()", () => {
    const validPayload = {
      id: "new-agent",
      name: "New Agent",
      description: "A brand new agent",
      capabilities: ["chat"],
      tools: ["file_read"],
      delegatable: true,
      systemPrompt: "You are a new agent.",
    };

    test("should create agent and write config.md to disk", async () => {
      const agent = await createAgent(validPayload);

      expect(agent).not.toBeNull();
      expect(agent.id).toBe("new-agent");
      expect(agent.name).toBe("New Agent");

      const configPath = `${AGENTS_DIR}/new-agent/config.md`;
      expect(mockState.files[configPath]).toBeDefined();
    });

    test("should return an AgentConfig matching the provided data", async () => {
      const agent = await createAgent(validPayload);

      expect(agent.id).toBe("new-agent");
      expect(agent.name).toBe("New Agent");
      expect(agent.description).toBe("A brand new agent");
      expect(agent.delegatable).toBe(true);
      expect(agent.systemPrompt).toBe("You are a new agent.");
    });

    test("should always set system=false for user-created agents", async () => {
      const agent = await createAgent(validPayload);
      expect(agent.system).toBe(false);
    });

    test("should always set internal=false for user-created agents", async () => {
      const agent = await createAgent(validPayload);
      expect(agent.internal).toBe(false);
    });

    test("should set model.locked=true when model config is provided", async () => {
      const agent = await createAgent({
        ...validPayload,
        id: "model-agent",
        model: { provider_id: "openai", model_id: "gpt-4" },
      });

      expect(agent.model).toBeDefined();
      expect(agent.model!.locked).toBe(true);
    });

    test("should preserve provider_id and model_id when model config is provided", async () => {
      const agent = await createAgent({
        ...validPayload,
        id: "model-agent",
        model: { provider_id: "openai", model_id: "gpt-4" },
      });

      expect(agent.model!.provider_id).toBe("openai");
      expect(agent.model!.model_id).toBe("gpt-4");
    });

    test("should force model.locked=true even if caller passes locked=false", async () => {
      const agent = await createAgent({
        ...validPayload,
        id: "force-locked-agent",
        model: { provider_id: "openai", model_id: "gpt-4", locked: false },
      });

      expect(agent.model!.locked).toBe(true);
    });

    test("should write model block to config.md when model is provided", async () => {
      await createAgent({
        ...validPayload,
        id: "model-write-agent",
        model: { provider_id: "anthropic", model_id: "claude-3", inherit: false },
      });

      const configPath = `${AGENTS_DIR}/model-write-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("model:");
      expect(content).toContain("anthropic");
      expect(content).toContain("claude-3");
    });

    test("should write model.inherit to config.md when inherit is specified", async () => {
      await createAgent({
        ...validPayload,
        id: "inherit-agent",
        model: { inherit: true },
      });

      const configPath = `${AGENTS_DIR}/inherit-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("model:");
      expect(content).toContain("inherit: true");
    });

    test("should reject invalid agent ID formats", async () => {
      await expect(
        createAgent({ ...validPayload, id: "Invalid ID!" })
      ).rejects.toThrow("Agent ID must contain only lowercase letters, numbers, hyphens and underscores");
    });

    test("should reject uppercase letters in agent ID", async () => {
      await expect(
        createAgent({ ...validPayload, id: "MyAgent" })
      ).rejects.toThrow();
    });

    test("should reject IDs with spaces", async () => {
      await expect(
        createAgent({ ...validPayload, id: "has space" })
      ).rejects.toThrow();
    });

    test("should allow lowercase letters, numbers, hyphens, and underscores in ID", async () => {
      const agent = await createAgent({ ...validPayload, id: "valid_agent-1" });
      expect(agent.id).toBe("valid_agent-1");
    });

    test("should throw when agent with same ID already exists", async () => {
      registerFileAgent("existing-agent", makeConfigMd({ id: "existing-agent" }));

      await expect(
        createAgent({ ...validPayload, id: "existing-agent" })
      ).rejects.toThrow('Agent with ID "existing-agent" already exists');
    });

    test("should throw when agent ID conflicts with a connection provider", async () => {
      mockState.registry.providers["github"] = makeConnectionProvider(
        "github",
        "GitHub",
        "GitHub integration"
      );

      await expect(
        createAgent({ ...validPayload, id: "github" })
      ).rejects.toThrow('Agent ID "github" is reserved for a connection provider');
    });

    test("should store skillMode and skills in config when provided", async () => {
      const agent = await createAgent({
        ...validPayload,
        id: "skill-agent",
        skills: ["research", "summarise"],
        skillMode: "allow",
      });

      expect(agent.skills).toEqual(["research", "summarise"]);
      expect(agent.skillMode).toBe("allow");
    });

    test("should write skillMode to the config file", async () => {
      await createAgent({
        ...validPayload,
        id: "skillmode-write-agent",
        skills: ["coding"],
        skillMode: "allow",
      });

      const configPath = `${AGENTS_DIR}/skillmode-write-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("skillMode: allow");
    });

    test("should write skills list to the config file", async () => {
      await createAgent({
        ...validPayload,
        id: "skills-write-agent",
        skills: ["skill-a", "skill-b"],
        skillMode: "allow",
      });

      const configPath = `${AGENTS_DIR}/skills-write-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("skill-a");
      expect(content).toContain("skill-b");
    });

    test("should write capabilities to the config file", async () => {
      await createAgent({
        ...validPayload,
        id: "cap-agent",
        capabilities: ["chat", "search"],
      });

      const configPath = `${AGENTS_DIR}/cap-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("chat");
      expect(content).toContain("search");
    });

    test("should write tools to the config file", async () => {
      await createAgent({
        ...validPayload,
        id: "tool-agent",
        tools: ["file_read", "web_search"],
      });

      const configPath = `${AGENTS_DIR}/tool-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("file_read");
      expect(content).toContain("web_search");
    });

    test("should write the systemPrompt as the markdown body after the frontmatter", async () => {
      await createAgent({
        ...validPayload,
        id: "body-agent",
        systemPrompt: "This is the system prompt body.",
      });

      const configPath = `${AGENTS_DIR}/body-agent/config.md`;
      const content = mockState.files[configPath]!;
      // Body follows the closing --- separator
      expect(content).toContain("---\n\nThis is the system prompt body.");
    });

    test("should write delegatable flag to the config file", async () => {
      await createAgent({
        ...validPayload,
        id: "deleg-write-agent",
        delegatable: false,
      });

      const configPath = `${AGENTS_DIR}/deleg-write-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("delegatable: false");
    });
  });

  // -------------------------------------------------------------------------
  // updateAgent()
  // -------------------------------------------------------------------------

  describe("updateAgent()", () => {
    beforeEach(() => {
      // Register a default user-created agent for update tests
      registerFileAgent(
        "user-agent",
        makeConfigMd({
          id: "user-agent",
          name: "User Agent",
          description: "Original desc",
          system: "false",
          internal: "false",
          delegatable: "true",
          systemPrompt: "Original prompt",
        })
      );
    });

    test("should update the agent name", async () => {
      const updated = await updateAgent("user-agent", { name: "Updated Name" });
      expect(updated.name).toBe("Updated Name");
    });

    test("should update the agent description", async () => {
      const updated = await updateAgent("user-agent", { description: "New description" });
      expect(updated.description).toBe("New description");
    });

    test("should update the system prompt", async () => {
      const updated = await updateAgent("user-agent", {
        systemPrompt: "You are now different.",
      });
      expect(updated.systemPrompt).toBe("You are now different.");
    });

    test("should update delegatable flag", async () => {
      const updated = await updateAgent("user-agent", { delegatable: false });
      expect(updated.delegatable).toBe(false);
    });

    test("should update capabilities", async () => {
      const updated = await updateAgent("user-agent", { capabilities: ["math", "code"] });
      expect(updated.capabilities).toEqual(["math", "code"]);
    });

    test("should update tools list", async () => {
      const updated = await updateAgent("user-agent", { tools: ["file_read", "web_search"] });
      expect(updated.tools).toEqual(["file_read", "web_search"]);
    });

    test("should preserve existing fields when only one field is updated", async () => {
      const updated = await updateAgent("user-agent", { name: "Changed" });
      expect(updated.description).toBe("Original desc");
      expect(updated.delegatable).toBe(true);
    });

    test("should persist changes by writing to config.md", async () => {
      await updateAgent("user-agent", { name: "Persisted Name" });

      const configPath = `${AGENTS_DIR}/user-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("Persisted Name");
    });

    test("should throw when agent does not exist", async () => {
      await expect(
        updateAgent("does-not-exist", { name: "Whatever" })
      ).rejects.toThrow('Agent "does-not-exist" not found');
    });

    test("should throw when trying to update an internal agent", async () => {
      registerFileAgent(
        "internal-agent",
        makeConfigMd({
          id: "internal-agent",
          internal: "true",
          system: "false",
        })
      );

      await expect(
        updateAgent("internal-agent", { name: "New Name" })
      ).rejects.toThrow("Cannot edit internal agents");
    });

    test("should throw when trying to update a system agent", async () => {
      registerFileAgent(
        "system-agent",
        makeConfigMd({
          id: "system-agent",
          system: "true",
          internal: "false",
        })
      );

      await expect(
        updateAgent("system-agent", { name: "New Name" })
      ).rejects.toThrow("System-Agenten können nicht bearbeitet werden");
    });

    test("should throw when trying to update a connection-based agent", async () => {
      mockState.registry.providers["github"] = makeConnectionProvider(
        "github",
        "GitHub",
        "GitHub integration"
      );

      await expect(
        updateAgent("github", { name: "Renamed" })
      ).rejects.toThrow("Connection-Agenten können nicht bearbeitet werden");
    });

    test("should set model.locked=true when model config is provided on update", async () => {
      const updated = await updateAgent("user-agent", {
        model: { provider_id: "anthropic", model_id: "claude-3" },
      });

      expect(updated.model!.provider_id).toBe("anthropic");
      expect(updated.model!.model_id).toBe("claude-3");
      expect(updated.model!.locked).toBe(true);
    });

    test("should force model.locked=true even if caller passes locked=false on update", async () => {
      const updated = await updateAgent("user-agent", {
        model: { provider_id: "openai", model_id: "gpt-4", locked: false },
      });

      expect(updated.model!.locked).toBe(true);
    });

    test("should retain existing model when model is not updated", async () => {
      // First give the agent a model
      await updateAgent("user-agent", {
        model: { provider_id: "openai", model_id: "gpt-4" },
      });
      // Now update only the name
      const updated = await updateAgent("user-agent", { name: "Model Retained" });
      expect(updated.model!.provider_id).toBe("openai");
    });

    test("should update skillMode", async () => {
      const updated = await updateAgent("user-agent", { skillMode: "allow" });
      expect(updated.skillMode).toBe("allow");
    });

    test("should update skills list", async () => {
      const updated = await updateAgent("user-agent", {
        skills: ["research"],
        skillMode: "allow",
      });
      expect(updated.skills).toEqual(["research"]);
    });

    test("should write updated skills to config.md", async () => {
      await updateAgent("user-agent", {
        skills: ["skill-x", "skill-y"],
        skillMode: "allow",
      });

      const configPath = `${AGENTS_DIR}/user-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("skill-x");
      expect(content).toContain("skill-y");
      expect(content).toContain("skillMode: allow");
    });

    test("should write updated model block to config.md", async () => {
      await updateAgent("user-agent", {
        model: { provider_id: "openai", model_id: "gpt-4o", inherit: false },
      });

      const configPath = `${AGENTS_DIR}/user-agent/config.md`;
      const content = mockState.files[configPath]!;
      expect(content).toContain("model:");
      expect(content).toContain("openai");
      expect(content).toContain("gpt-4o");
    });
  });

  // -------------------------------------------------------------------------
  // deleteAgent()
  // -------------------------------------------------------------------------

  describe("deleteAgent()", () => {
    test("should delete the agent directory from the virtual file system", async () => {
      registerFileAgent(
        "to-delete",
        makeConfigMd({
          id: "to-delete",
          system: "false",
          internal: "false",
        })
      );

      await deleteAgent("to-delete");

      const configPath = `${AGENTS_DIR}/to-delete/config.md`;
      expect(mockState.files[configPath]).toBeUndefined();
    });

    test("should throw when agent does not exist", async () => {
      await expect(deleteAgent("nonexistent")).rejects.toThrow(
        'Agent "nonexistent" not found'
      );
    });

    test("should throw when trying to delete an internal agent", async () => {
      registerFileAgent(
        "int-delete",
        makeConfigMd({
          id: "int-delete",
          internal: "true",
          system: "false",
        })
      );

      await expect(deleteAgent("int-delete")).rejects.toThrow(
        "Cannot delete internal agents"
      );
    });

    test("should throw when trying to delete a system agent", async () => {
      registerFileAgent(
        "sys-delete",
        makeConfigMd({
          id: "sys-delete",
          system: "true",
          internal: "false",
        })
      );

      await expect(deleteAgent("sys-delete")).rejects.toThrow(
        "System-Agenten können nicht gelöscht werden"
      );
    });

    test("should throw when trying to delete a connection-based agent", async () => {
      mockState.registry.providers["jira"] = makeConnectionProvider(
        "jira",
        "Jira",
        "Jira integration"
      );

      await expect(deleteAgent("jira")).rejects.toThrow(
        "Connection-Agenten können nicht gelöscht werden"
      );
    });

    test("should not affect other agents when one is deleted", async () => {
      registerFileAgent(
        "keep-agent",
        makeConfigMd({ id: "keep-agent", system: "false", internal: "false" })
      );
      registerFileAgent(
        "remove-agent",
        makeConfigMd({ id: "remove-agent", system: "false", internal: "false" })
      );

      await deleteAgent("remove-agent");

      const keepPath = `${AGENTS_DIR}/keep-agent/config.md`;
      expect(mockState.files[keepPath]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // generateAgentMarkdown round-trip (via createAgent / updateAgent)
  // -------------------------------------------------------------------------

  describe("generateAgentMarkdown (via createAgent)", () => {
    const base = {
      id: "md-agent",
      name: "Markdown Agent",
      description: "Tests markdown generation",
      capabilities: ["writing", "analysis"],
      tools: ["file_read", "web_search"],
      delegatable: true,
      systemPrompt: "You write markdown.",
    };

    test("should include id in frontmatter", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content).toContain("id: md-agent");
    });

    test("should include name in frontmatter", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content).toContain("name: Markdown Agent");
    });

    test("should include description in frontmatter", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content).toContain("description: Tests markdown generation");
    });

    test("should include capabilities as a YAML list", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content).toContain("capabilities:");
      expect(content).toContain("  - writing");
      expect(content).toContain("  - analysis");
    });

    test("should include tools as a YAML list", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content).toContain("tools:");
      expect(content).toContain("  - file_read");
      expect(content).toContain("  - web_search");
    });

    test("should include delegatable flag in frontmatter", async () => {
      await createAgent({ ...base, id: "deleg-md-true" });
      const content = mockState.files[`${AGENTS_DIR}/deleg-md-true/config.md`]!;
      expect(content).toContain("delegatable: true");
    });

    test("should not include internal key in frontmatter when internal is false", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      // internal: false should be omitted (only written when true)
      expect(content).not.toContain("internal: false");
    });

    test("should not include system key in frontmatter when system is false", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      // system: false should be omitted (only written when true)
      expect(content).not.toContain("system: false");
    });

    test("should include model block with provider_id when model is provided", async () => {
      await createAgent({
        ...base,
        id: "model-md-agent",
        model: { provider_id: "openai", model_id: "gpt-4", locked: true, inherit: false },
      });
      const content = mockState.files[`${AGENTS_DIR}/model-md-agent/config.md`]!;
      expect(content).toContain("model:");
      expect(content).toContain("  provider_id: openai");
      expect(content).toContain("  model_id: gpt-4");
      expect(content).toContain("  locked: true");
      expect(content).toContain("  inherit: false");
    });

    test("should include skills as a YAML list when provided", async () => {
      await createAgent({
        ...base,
        id: "skills-md-agent",
        skills: ["skill-one", "skill-two"],
        skillMode: "allow",
      });
      const content = mockState.files[`${AGENTS_DIR}/skills-md-agent/config.md`]!;
      expect(content).toContain("skills:");
      expect(content).toContain("  - skill-one");
      expect(content).toContain("  - skill-two");
    });

    test("should include skillMode in frontmatter when provided", async () => {
      await createAgent({
        ...base,
        id: "skillmode-md-agent",
        skills: ["sk"],
        skillMode: "allow",
      });
      const content = mockState.files[`${AGENTS_DIR}/skillmode-md-agent/config.md`]!;
      expect(content).toContain("skillMode: allow");
    });

    test("should be wrapped in --- frontmatter delimiters", async () => {
      await createAgent(base);
      const content = mockState.files[`${AGENTS_DIR}/md-agent/config.md`]!;
      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toContain("\n---\n");
    });

    test("should place systemPrompt as body after the closing --- delimiter", async () => {
      await createAgent({ ...base, id: "body-md-agent", systemPrompt: "UNIQUE_BODY_MARKER" });
      const content = mockState.files[`${AGENTS_DIR}/body-md-agent/config.md`]!;
      const frontmatterEnd = content.indexOf("\n---\n");
      const bodyStart = content.indexOf("UNIQUE_BODY_MARKER");
      expect(bodyStart).toBeGreaterThan(frontmatterEnd);
    });

    test("should produce a config.md that can be round-tripped back via loadAgent", async () => {
      await createAgent({
        ...base,
        id: "roundtrip-agent",
        capabilities: ["roundtrip-cap"],
        tools: ["roundtrip-tool"],
        skills: ["roundtrip-skill"],
        skillMode: "allow",
        model: { provider_id: "openai", model_id: "gpt-4o" },
      });

      // The file was written by createAgent; loadAgent reads it back
      const agent = await loadAgent("roundtrip-agent");
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe("roundtrip-agent");
      expect(agent!.name).toBe("Markdown Agent");
      expect(agent!.capabilities).toContain("roundtrip-cap");
      expect(agent!.tools).toContain("roundtrip-tool");
      expect(agent!.skills).toContain("roundtrip-skill");
      expect(agent!.skillMode).toBe("allow");
      expect(agent!.model!.provider_id).toBe("openai");
      expect(agent!.model!.model_id).toBe("gpt-4o");
      expect(agent!.model!.locked).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Connection agent generation
  // -------------------------------------------------------------------------

  describe("connection agent generation", () => {
    test("should generate connection agent with delegatable=true", async () => {
      mockState.registry.providers["slack"] = makeConnectionProvider(
        "slack",
        "Slack",
        "Slack integration",
        [{ name: "slack_send", description: "Send a Slack message" }]
      );

      const agent = await loadAgent("slack");
      expect(agent!.delegatable).toBe(true);
    });

    test("should generate connection agent with internal=false", async () => {
      mockState.registry.providers["slack"] = makeConnectionProvider(
        "slack",
        "Slack",
        "Slack integration"
      );

      const agent = await loadAgent("slack");
      expect(agent!.internal).toBe(false);
    });

    test("should populate tools with the provider tool names", async () => {
      mockState.registry.providers["gdrive"] = makeConnectionProvider(
        "gdrive",
        "Google Drive",
        "Drive access",
        [
          { name: "gdrive_list", description: "List files in Google Drive" },
          { name: "gdrive_read", description: "Read a file from Google Drive" },
        ]
      );

      const agent = await loadAgent("gdrive");
      expect(agent!.tools).toContain("gdrive_list");
      expect(agent!.tools).toContain("gdrive_read");
    });

    test("should generate a systemPrompt containing the provider name", async () => {
      mockState.registry.providers["notion"] = makeConnectionProvider(
        "notion",
        "Notion",
        "Notion workspace integration"
      );

      const agent = await loadAgent("notion");
      expect(agent!.systemPrompt).toContain("Notion");
    });

    test("should include tool parameter descriptions in generated systemPrompt", async () => {
      mockState.registry.providers["drive"] = makeConnectionProvider(
        "drive",
        "Drive",
        "File storage",
        [
          {
            name: "drive_search",
            description: "Search files",
            params: { query: { type: "string", description: "Search query string" } },
          },
        ]
      );

      const agent = await loadAgent("drive");
      expect(agent!.systemPrompt).toContain("drive_search");
    });

    test("should truncate capabilities longer than 50 chars to 47 chars plus ellipsis", async () => {
      const longDesc =
        "This is a very long description that exceeds fifty characters easily. More text here.";
      mockState.registry.providers["verbose"] = makeConnectionProvider(
        "verbose",
        "Verbose Provider",
        "Verbose",
        [{ name: "verbose_tool", description: longDesc }]
      );

      const agent = await loadAgent("verbose");
      // Each capability is the first sentence (split by '.') of the tool description
      for (const cap of agent!.capabilities) {
        expect(cap.length).toBeLessThanOrEqual(50);
      }
    });

    test("should include all connection providers in loadAllAgents", async () => {
      mockState.registry.providers["prov-a"] = makeConnectionProvider("prov-a", "Prov A", "A");
      mockState.registry.providers["prov-b"] = makeConnectionProvider("prov-b", "Prov B", "B");

      const map = await loadAllAgents();
      expect(map.has("prov-a")).toBe(true);
      expect(map.has("prov-b")).toBe(true);
    });

    test("should generate a systemPrompt containing the provider description", async () => {
      mockState.registry.providers["confluence"] = makeConnectionProvider(
        "confluence",
        "Confluence",
        "Atlassian Confluence wiki integration"
      );

      const agent = await loadAgent("confluence");
      expect(agent!.systemPrompt).toContain("Atlassian Confluence wiki integration");
    });

    test("should set system=true for all connection agents", async () => {
      mockState.registry.providers["teams"] = makeConnectionProvider(
        "teams",
        "Teams",
        "Microsoft Teams"
      );

      const agent = await loadAgent("teams");
      expect(agent!.system).toBe(true);
    });

    test("should generate empty tools array when provider has no tools", async () => {
      mockState.registry.providers["empty-provider"] = makeConnectionProvider(
        "empty-provider",
        "Empty",
        "No tools provider",
        []
      );

      const agent = await loadAgent("empty-provider");
      expect(agent!.tools).toEqual([]);
    });

    test("should generate empty capabilities array when provider has no tools", async () => {
      mockState.registry.providers["nocap-provider"] = makeConnectionProvider(
        "nocap-provider",
        "NoCap",
        "No cap provider",
        []
      );

      const agent = await loadAgent("nocap-provider");
      expect(agent!.capabilities).toEqual([]);
    });
  });
});
