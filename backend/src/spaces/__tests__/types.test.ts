/**
 * Tests for backend/src/spaces/types.ts and formatSpaceMemoryForPrompt from storage.ts
 *
 * types.ts exports are pure constants/factory functions with no side effects on import.
 * formatSpaceMemoryForPrompt is a pure function in storage.ts; heavy imports of storage.ts
 * are mocked at the module level so the top-level migration code does not execute.
 */

import { test, expect, describe, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing storage.ts
// The top-level migration code in storage.ts calls existsSync on LEGACY_PROJECTS_DIR
// and SPACES_BASE_DIR, both of which are derived from SPACES_DIR / DATA_DIR.
// Pointing them to /tmp prevents any accidental file operations during import.
// ---------------------------------------------------------------------------

mock.module("../utils/paths", () => ({
  DATA_DIR: "/tmp/spaces-test-data",
  SPACES_DIR: "/tmp/spaces-test-spaces",
  // Remaining exports are not used by storage.ts directly, but exported for completeness.
  AUTH_DIR: "/tmp/spaces-test-data/auth",
  USERS_DIR: "/tmp/spaces-test-data/auth/users",
  SESSIONS_DIR: "/tmp/spaces-test-data/auth/sessions",
  GROUPS_DIR: "/tmp/spaces-test-data/auth/groups",
  OAUTH_STATES_DIR: "/tmp/spaces-test-data/auth/oauth-states",
  CHATS_DIR: "/tmp/spaces-test-data/chats",
  CONVERSATIONS_DIR: "/tmp/spaces-test-data/conversations",
  CHAT_UPLOADS_DIR: "/tmp/spaces-test-data/chat-uploads",
  CHAT_FOLDERS_FILE: "/tmp/spaces-test-data/chats/chat-folders.yaml",
  CONFIG_DIR: "/tmp/spaces-test-data/config",
  PROVIDERS_DIR: "/tmp/spaces-test-data/providers",
  ACTIVE_SELECTION_FILE: "/tmp/spaces-test-data/providers/active.yaml",
  LEGACY_PROVIDERS_CONFIG: "/tmp/spaces-test-data/config/providers.yaml",
  AGENTS_CONFIG: "/tmp/spaces-test-data/config/agents.md",
  MCP_SERVERS_CONFIG: "/tmp/spaces-test-data/config/mcp-servers.yaml",
  AGENTS_DIR: "/tmp/spaces-test-data/agents",
  KB_BASE: "/tmp/spaces-test-data/knowledge-base",
  KB_COLLECTIONS_FILE: "/tmp/spaces-test-data/knowledge-base/collections.yaml",
  KB_INCOMING_DIR: "/tmp/spaces-test-data/knowledge-base/incoming",
  TASKS_DIR: "/tmp/spaces-test-data/tasks",
  GENERATED_IMAGES_DIR: "/tmp/spaces-test-data/generated-images",
  EXPORTS_DIR: "/tmp/spaces-test-data/exports",
  MEMORY_SESSIONS_DIR: "/tmp/spaces-test-data/memory/sessions",
  MEMORY_USERS_DIR: "/tmp/spaces-test-data/memory/users",
  TABLES_DIR: "/tmp/spaces-test-data/tables",
  CONNECTIONS_DIR: "/tmp/spaces-test-data/connections",
  CONNECTIONS_CONNECTORS_DIR: "/tmp/spaces-test-data/connections/connectors",
  CONNECTIONS_TOKENS_DIR: "/tmp/spaces-test-data/connections/tokens",
  CONNECTIONS_REGISTRY_FILE: "/tmp/spaces-test-data/connections/registry.yaml",
  SKILLS_DIR: "/tmp/spaces-test-data/skills",
  CUSTOM_TOOLS_DIR: "/tmp/spaces-test-data/tools/custom",
  APPS_DIR: "/tmp/spaces-test-data/apps",
  APPS_REGISTRY: "/tmp/spaces-test-data/apps/registry.yaml",
  USAGE_DIR: "/tmp/spaces-test-data/usage",
  AUDIT_DIR: "/tmp/spaces-test-data/audit",
  NOTIFICATIONS_DIR: "/tmp/spaces-test-data/notifications",
  TEMP_DIR: "/tmp/spaces-test-data/temp",
  MARKITDOWN_API_URL: "",
  MARKITDOWN_API_KEY: "",
}));

mock.module("../rbac/storage", () => ({
  initializeResourceAccess: async () => ({
    principalType: "user",
    principalId: "test",
    role: "owner",
    grantedAt: "",
    grantedBy: "test",
  }),
  deleteResourceAccess: async () => {},
  loadResourceAccess: async () => [],
  saveResourceAccess: async () => {},
  getResourceAccessEntry: async () => null,
  grantAccess: async () => null,
  updateAccessRole: async () => null,
  revokeAccess: async () => false,
  getUsersWithAccess: async () => [],
  getGroupsWithAccess: async () => [],
  getResourceOwner: async () => null,
  transferOwnership: async () => false,
  hasAccessEntries: async () => false,
}));

mock.module("../utils/id", () => ({
  generateId: (prefix: string) => `${prefix}_test_fixed`,
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  ROLE_PERMISSIONS,
  createDefaultSettings,
  createDefaultMemory,
  createDefaultKBLinks,
} from "../types";

const { formatSpaceMemoryForPrompt } = await import("../storage");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMemory(overrides: Partial<import("../types").SpaceMemory> = {}): import("../types").SpaceMemory {
  return {
    spaceId: "space_test",
    updatedAt: "",
    about: [],
    instructions: [],
    context: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: ROLE_PERMISSIONS
// ---------------------------------------------------------------------------

describe("ROLE_PERMISSIONS", () => {
  describe("owner", () => {
    test("hat alle Berechtigungen auf true", () => {
      const perms = ROLE_PERMISSIONS.owner;
      expect(perms.canEditSpace).toBe(true);
      expect(perms.canEditSettings).toBe(true);
      expect(perms.canWriteMemory).toBe(true);
      expect(perms.canViewChats).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canDeleteSpace).toBe(true);
    });
  });

  describe("admin", () => {
    test("hat canEditSpace=false", () => {
      expect(ROLE_PERMISSIONS.admin.canEditSpace).toBe(false);
    });

    test("hat canDeleteSpace=false", () => {
      expect(ROLE_PERMISSIONS.admin.canDeleteSpace).toBe(false);
    });

    test("hat canEditSettings=true", () => {
      expect(ROLE_PERMISSIONS.admin.canEditSettings).toBe(true);
    });

    test("hat canWriteMemory=true", () => {
      expect(ROLE_PERMISSIONS.admin.canWriteMemory).toBe(true);
    });

    test("hat canViewChats=true", () => {
      expect(ROLE_PERMISSIONS.admin.canViewChats).toBe(true);
    });

    test("hat canManageMembers=true", () => {
      expect(ROLE_PERMISSIONS.admin.canManageMembers).toBe(true);
    });
  });

  describe("editor", () => {
    test("hat canWriteMemory=true", () => {
      expect(ROLE_PERMISSIONS.editor.canWriteMemory).toBe(true);
    });

    test("hat canViewChats=true", () => {
      expect(ROLE_PERMISSIONS.editor.canViewChats).toBe(true);
    });

    test("hat canEditSpace=false", () => {
      expect(ROLE_PERMISSIONS.editor.canEditSpace).toBe(false);
    });

    test("hat canEditSettings=false", () => {
      expect(ROLE_PERMISSIONS.editor.canEditSettings).toBe(false);
    });

    test("hat canManageMembers=false", () => {
      expect(ROLE_PERMISSIONS.editor.canManageMembers).toBe(false);
    });

    test("hat canDeleteSpace=false", () => {
      expect(ROLE_PERMISSIONS.editor.canDeleteSpace).toBe(false);
    });
  });

  describe("viewer", () => {
    test("hat nur canViewChats=true", () => {
      expect(ROLE_PERMISSIONS.viewer.canViewChats).toBe(true);
    });

    test("hat canEditSpace=false", () => {
      expect(ROLE_PERMISSIONS.viewer.canEditSpace).toBe(false);
    });

    test("hat canEditSettings=false", () => {
      expect(ROLE_PERMISSIONS.viewer.canEditSettings).toBe(false);
    });

    test("hat canWriteMemory=false", () => {
      expect(ROLE_PERMISSIONS.viewer.canWriteMemory).toBe(false);
    });

    test("hat canManageMembers=false", () => {
      expect(ROLE_PERMISSIONS.viewer.canManageMembers).toBe(false);
    });

    test("hat canDeleteSpace=false", () => {
      expect(ROLE_PERMISSIONS.viewer.canDeleteSpace).toBe(false);
    });
  });

  test("enthält Einträge für alle vier Rollen", () => {
    const roles = Object.keys(ROLE_PERMISSIONS);
    expect(roles).toContain("owner");
    expect(roles).toContain("admin");
    expect(roles).toContain("editor");
    expect(roles).toContain("viewer");
    expect(roles).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: createDefaultSettings()
// ---------------------------------------------------------------------------

describe("createDefaultSettings()", () => {
  test("gibt ein neues Objekt bei jedem Aufruf zurück", () => {
    const a = createDefaultSettings();
    const b = createDefaultSettings();
    expect(a).not.toBe(b);
  });

  test("include_memory_in_prompt ist true", () => {
    expect(createDefaultSettings().include_memory_in_prompt).toBe(true);
  });

  test("include_kb_in_prompt ist true", () => {
    expect(createDefaultSettings().include_kb_in_prompt).toBe(true);
  });

  test("default_chat_visibility ist 'space'", () => {
    expect(createDefaultSettings().default_chat_visibility).toBe("space");
  });

  test("enthält genau die erwarteten Felder", () => {
    const settings = createDefaultSettings();
    expect(Object.keys(settings).sort()).toEqual(
      ["default_chat_visibility", "include_kb_in_prompt", "include_memory_in_prompt"].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createDefaultMemory()
// ---------------------------------------------------------------------------

describe("createDefaultMemory()", () => {
  test("setzt spaceId korrekt", () => {
    const mem = createDefaultMemory("space_abc");
    expect(mem.spaceId).toBe("space_abc");
  });

  test("updatedAt ist ein leerer String", () => {
    expect(createDefaultMemory("space_x").updatedAt).toBe("");
  });

  test("about ist ein leeres Array", () => {
    expect(createDefaultMemory("space_x").about).toEqual([]);
  });

  test("instructions ist ein leeres Array", () => {
    expect(createDefaultMemory("space_x").instructions).toEqual([]);
  });

  test("context ist ein leeres Array", () => {
    expect(createDefaultMemory("space_x").context).toEqual([]);
  });

  test("gibt ein neues Objekt bei jedem Aufruf zurück", () => {
    const a = createDefaultMemory("space_x");
    const b = createDefaultMemory("space_x");
    expect(a).not.toBe(b);
  });

  test("Arrays sind nicht referenzidentisch zwischen zwei Aufrufen", () => {
    const a = createDefaultMemory("space_x");
    const b = createDefaultMemory("space_x");
    expect(a.about).not.toBe(b.about);
    expect(a.instructions).not.toBe(b.instructions);
    expect(a.context).not.toBe(b.context);
  });
});

// ---------------------------------------------------------------------------
// Tests: createDefaultKBLinks()
// ---------------------------------------------------------------------------

describe("createDefaultKBLinks()", () => {
  test("setzt spaceId korrekt", () => {
    const links = createDefaultKBLinks("space_abc");
    expect(links.spaceId).toBe("space_abc");
  });

  test("updatedAt ist ein leerer String", () => {
    expect(createDefaultKBLinks("space_x").updatedAt).toBe("");
  });

  test("collections ist ein leeres Array", () => {
    expect(createDefaultKBLinks("space_x").collections).toEqual([]);
  });

  test("gibt ein neues Objekt bei jedem Aufruf zurück", () => {
    const a = createDefaultKBLinks("space_x");
    const b = createDefaultKBLinks("space_x");
    expect(a).not.toBe(b);
  });

  test("collections-Array ist nicht referenzidentisch zwischen zwei Aufrufen", () => {
    const a = createDefaultKBLinks("space_x");
    const b = createDefaultKBLinks("space_x");
    expect(a.collections).not.toBe(b.collections);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatSpaceMemoryForPrompt()
// ---------------------------------------------------------------------------

describe("formatSpaceMemoryForPrompt()", () => {
  // -------------------------------------------------------------------------
  // Leeres Memory
  // -------------------------------------------------------------------------

  describe("leeres Memory", () => {
    test("gibt leeren String zurück wenn alle Sektionen leer sind", () => {
      const result = formatSpaceMemoryForPrompt(makeMemory(), "Mein Space");
      expect(result).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------

  describe("Header", () => {
    test("enthält den Space-Namen im Header", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Etwas", added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Projekt Alpha");
      expect(result).toContain("# Space-Kontext: Projekt Alpha");
    });

    test("Header ist die erste Zeile des Ergebnisses", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Test", added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Test Space");
      expect(result.split("\n")[0]).toBe("# Space-Kontext: Test Space");
    });
  });

  // -------------------------------------------------------------------------
  // About-Sektion
  // -------------------------------------------------------------------------

  describe("About-Sektion", () => {
    test("listet About-Einträge auf", () => {
      const memory = makeMemory({
        about: [
          { id: "1", content: "Wir sind ein Startup", added_at: "", source: "manual" },
          { id: "2", content: "Fokus auf KI", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("## Ueber den Space");
      expect(result).toContain("- Wir sind ein Startup");
      expect(result).toContain("- Fokus auf KI");
    });

    test("Sektion fehlt wenn about leer ist", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Sei präzise", priority: "normal", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).not.toContain("## Ueber den Space");
    });

    test("einzelner About-Eintrag wird korrekt dargestellt", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Nur ein Eintrag", added_at: "", source: "agent" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- Nur ein Eintrag");
    });
  });

  // -------------------------------------------------------------------------
  // Instructions-Sektion
  // -------------------------------------------------------------------------

  describe("Instructions-Sektion", () => {
    test("listet Anweisungen auf", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Antworte auf Deutsch", priority: "normal", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("## Space-Anweisungen");
      expect(result).toContain("- Antworte auf Deutsch");
    });

    test("Sektion fehlt wenn instructions leer ist", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Info", added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).not.toContain("## Space-Anweisungen");
    });

    test("high-priority-Anweisung erhält [WICHTIG]-Präfix", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Sehr wichtig", priority: "high", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- [WICHTIG] Sehr wichtig");
    });

    test("normal-priority-Anweisung erhält keinen [WICHTIG]-Präfix", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Normale Anweisung", priority: "normal", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- Normale Anweisung");
      expect(result).not.toContain("[WICHTIG]");
    });

    test("high-priority-Anweisungen stehen vor normal-priority", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Zuerst normal", priority: "normal", added_at: "", source: "manual" },
          { id: "2", content: "Dann wichtig", priority: "high", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      const lines = result.split("\n");
      const normalIdx = lines.findIndex((l) => l.includes("Zuerst normal"));
      const highIdx = lines.findIndex((l) => l.includes("Dann wichtig"));
      expect(highIdx).toBeLessThan(normalIdx);
    });

    test("mehrere high-priority- und normal-priority-Anweisungen werden korrekt sortiert", () => {
      const memory = makeMemory({
        instructions: [
          { id: "1", content: "Normal 1", priority: "normal", added_at: "", source: "manual" },
          { id: "2", content: "High 1", priority: "high", added_at: "", source: "manual" },
          { id: "3", content: "Normal 2", priority: "normal", added_at: "", source: "manual" },
          { id: "4", content: "High 2", priority: "high", added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      const lines = result.split("\n").filter((l) => l.startsWith("- "));
      const instructionLines = lines.filter(
        (l) =>
          l.includes("Normal 1") ||
          l.includes("Normal 2") ||
          l.includes("High 1") ||
          l.includes("High 2")
      );
      // Both high-priority items should come before both normal items
      const high1Idx = instructionLines.findIndex((l) => l.includes("High 1"));
      const high2Idx = instructionLines.findIndex((l) => l.includes("High 2"));
      const normal1Idx = instructionLines.findIndex((l) => l.includes("Normal 1"));
      const normal2Idx = instructionLines.findIndex((l) => l.includes("Normal 2"));
      expect(high1Idx).toBeLessThan(normal1Idx);
      expect(high2Idx).toBeLessThan(normal1Idx);
      expect(high1Idx).toBeLessThan(normal2Idx);
      expect(high2Idx).toBeLessThan(normal2Idx);
    });

    test("Sortierung verändert das Original-Array nicht (keine Mutation)", () => {
      const instructions = [
        { id: "1", content: "Normal zuerst", priority: "normal" as const, added_at: "", source: "manual" as const },
        { id: "2", content: "High danach", priority: "high" as const, added_at: "", source: "manual" as const },
      ];
      const memory = makeMemory({ instructions });
      formatSpaceMemoryForPrompt(memory, "Space");
      // Original order unchanged
      expect(memory.instructions[0]!.content).toBe("Normal zuerst");
      expect(memory.instructions[1]!.content).toBe("High danach");
    });
  });

  // -------------------------------------------------------------------------
  // Context-Sektion
  // -------------------------------------------------------------------------

  describe("Context-Sektion (Aktuelle Phase)", () => {
    test("listet aktive Kontext-Einträge auf", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Sprint 3", active: true, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("## Aktuelle Phase");
      expect(result).toContain("- Sprint 3");
    });

    test("Sektion fehlt wenn context leer ist", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Info", added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).not.toContain("## Aktuelle Phase");
    });

    test("inaktive Kontext-Einträge werden nicht angezeigt", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Aktiv", active: true, added_at: "", source: "manual" },
          { id: "2", name: "Inaktiv", active: false, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- Aktiv");
      expect(result).not.toContain("Inaktiv");
    });

    test("Sektion fehlt wenn alle Kontext-Einträge inaktiv sind", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Nur inaktiv", active: false, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).not.toContain("## Aktuelle Phase");
    });

    test("Name wird fett dargestellt wenn eine Beschreibung vorhanden ist", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Sprint 3", description: "Fokus auf Backend", active: true, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- **Sprint 3**: Fokus auf Backend");
    });

    test("Name wird ohne Fettschrift dargestellt wenn keine Beschreibung vorhanden", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Nur Name", active: true, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- Nur Name");
      expect(result).not.toContain("**Nur Name**");
    });

    test("undefined-Beschreibung wird wie keine Beschreibung behandelt", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Kein Desc", description: undefined, active: true, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("- Kein Desc");
      expect(result).not.toContain("**Kein Desc**");
    });
  });

  // -------------------------------------------------------------------------
  // Kombinierte Sektionen
  // -------------------------------------------------------------------------

  describe("Kombinierte Sektionen", () => {
    test("alle drei Sektionen erscheinen in der richtigen Reihenfolge", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Wir sind ein Team", added_at: "", source: "manual" }],
        instructions: [{ id: "2", content: "Sei präzise", priority: "normal", added_at: "", source: "manual" }],
        context: [{ id: "3", name: "Phase Alpha", active: true, added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      const aboutIdx = result.indexOf("## Ueber den Space");
      const instrIdx = result.indexOf("## Space-Anweisungen");
      const ctxIdx = result.indexOf("## Aktuelle Phase");
      expect(aboutIdx).toBeLessThan(instrIdx);
      expect(instrIdx).toBeLessThan(ctxIdx);
    });

    test("gibt leeren String zurück wenn nur inaktive Context-Einträge vorhanden sind und der Rest leer", () => {
      const memory = makeMemory({
        context: [
          { id: "1", name: "Inaktiv", active: false, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toBe("");
    });

    test("vollständige Ausgabe enthält alle Inhalte korrekt", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Firmenkontext", added_at: "", source: "manual" }],
        instructions: [
          { id: "2", content: "Wichtige Regel", priority: "high", added_at: "", source: "manual" },
          { id: "3", content: "Normale Regel", priority: "normal", added_at: "", source: "manual" },
        ],
        context: [
          { id: "4", name: "Sprint 5", description: "Deployment vorbereiten", active: true, added_at: "", source: "manual" },
          { id: "5", name: "Archiviert", active: false, added_at: "", source: "manual" },
        ],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Mein Workspace");

      expect(result).toContain("# Space-Kontext: Mein Workspace");
      expect(result).toContain("## Ueber den Space");
      expect(result).toContain("- Firmenkontext");
      expect(result).toContain("## Space-Anweisungen");
      expect(result).toContain("- [WICHTIG] Wichtige Regel");
      expect(result).toContain("- Normale Regel");
      expect(result).toContain("## Aktuelle Phase");
      expect(result).toContain("- **Sprint 5**: Deployment vorbereiten");
      expect(result).not.toContain("Archiviert");
    });
  });

  // -------------------------------------------------------------------------
  // Rückgabewert-Format
  // -------------------------------------------------------------------------

  describe("Rückgabewert-Format", () => {
    test("Zeilen werden mit \\n verbunden", () => {
      const memory = makeMemory({
        about: [{ id: "1", content: "Test", added_at: "", source: "manual" }],
      });
      const result = formatSpaceMemoryForPrompt(memory, "Space");
      expect(result).toContain("\n");
      expect(result.split("\n").length).toBeGreaterThan(1);
    });

    test("gibt String zurück (kein null, kein undefined)", () => {
      const result = formatSpaceMemoryForPrompt(makeMemory(), "Space");
      expect(typeof result).toBe("string");
    });
  });
});
