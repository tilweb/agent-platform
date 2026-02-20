/**
 * Tests for backend/src/spaces/permissions.ts
 *
 * Pure functions (getUserRole, isMember) are tested directly.
 * All async permission checks depend on loadSpace from ./storage,
 * which is mocked at the module level so no disk I/O occurs.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  spaceById: {} as Record<string, any>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../storage", () => ({
  loadSpace: async (spaceId: string) => {
    return mockState.spaceById[spaceId] ?? null;
  },
}));

// ---------------------------------------------------------------------------
// Import the module AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  getUserRole,
  isMember,
  canViewSpace,
  canEditSpace,
  canEditSettings,
  canWriteMemory,
  canViewChats,
  canManageMembers,
  canModifyMember,
  canDeleteSpace,
  canArchiveSpace,
  getUserPermissions,
} = await import("../permissions");

// ---------------------------------------------------------------------------
// Helper: build a minimal Space object
// ---------------------------------------------------------------------------

function createTestSpace(members: Array<{ userId: string; role: string }>): any {
  return {
    id: "space_test",
    name: "Test Space",
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      addedAt: "",
      addedBy: "",
    })),
    settings: {
      include_memory_in_prompt: true,
      include_kb_in_prompt: true,
      default_chat_visibility: "space",
    },
    archived: false,
    createdAt: "",
    updatedAt: "",
    createdBy: members[0]?.userId || "",
  };
}

/** Register a space in the mock store under its own ID */
function registerSpace(space: any): void {
  mockState.spaceById[space.id] = space;
}

const SPACE_ID = "space_test";

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("permissions", () => {
  beforeEach(() => {
    mockState.spaceById = {};
  });

  // -------------------------------------------------------------------------
  // getUserRole()
  // -------------------------------------------------------------------------

  describe("getUserRole()", () => {
    test("gibt 'owner' zurück wenn der Benutzer Owner ist", () => {
      const space = createTestSpace([{ userId: "alice", role: "owner" }]);
      expect(getUserRole(space, "alice")).toBe("owner");
    });

    test("gibt 'admin' zurück wenn der Benutzer Admin ist", () => {
      const space = createTestSpace([{ userId: "bob", role: "admin" }]);
      expect(getUserRole(space, "bob")).toBe("admin");
    });

    test("gibt 'editor' zurück wenn der Benutzer Editor ist", () => {
      const space = createTestSpace([{ userId: "carol", role: "editor" }]);
      expect(getUserRole(space, "carol")).toBe("editor");
    });

    test("gibt 'viewer' zurück wenn der Benutzer Viewer ist", () => {
      const space = createTestSpace([{ userId: "dave", role: "viewer" }]);
      expect(getUserRole(space, "dave")).toBe("viewer");
    });

    test("gibt null zurück wenn der Benutzer kein Mitglied ist", () => {
      const space = createTestSpace([{ userId: "alice", role: "owner" }]);
      expect(getUserRole(space, "unknown")).toBeNull();
    });

    test("gibt null zurück bei leerem members-Array", () => {
      const space = createTestSpace([]);
      expect(getUserRole(space, "alice")).toBeNull();
    });

    test("findet das korrekte Mitglied wenn mehrere vorhanden sind", () => {
      const space = createTestSpace([
        { userId: "alice", role: "owner" },
        { userId: "bob", role: "admin" },
        { userId: "carol", role: "viewer" },
      ]);
      expect(getUserRole(space, "bob")).toBe("admin");
      expect(getUserRole(space, "carol")).toBe("viewer");
    });
  });

  // -------------------------------------------------------------------------
  // isMember()
  // -------------------------------------------------------------------------

  describe("isMember()", () => {
    test("gibt true zurück wenn der Benutzer Mitglied ist", () => {
      const space = createTestSpace([{ userId: "alice", role: "owner" }]);
      expect(isMember(space, "alice")).toBe(true);
    });

    test("gibt false zurück wenn der Benutzer kein Mitglied ist", () => {
      const space = createTestSpace([{ userId: "alice", role: "owner" }]);
      expect(isMember(space, "unknown")).toBe(false);
    });

    test("gibt false zurück bei leerem members-Array", () => {
      const space = createTestSpace([]);
      expect(isMember(space, "alice")).toBe(false);
    });

    test("gibt true für alle Rollen zurück (owner, admin, editor, viewer)", () => {
      const space = createTestSpace([
        { userId: "owner_user", role: "owner" },
        { userId: "admin_user", role: "admin" },
        { userId: "editor_user", role: "editor" },
        { userId: "viewer_user", role: "viewer" },
      ]);
      expect(isMember(space, "owner_user")).toBe(true);
      expect(isMember(space, "admin_user")).toBe(true);
      expect(isMember(space, "editor_user")).toBe(true);
      expect(isMember(space, "viewer_user")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // canViewSpace()
  // -------------------------------------------------------------------------

  describe("canViewSpace()", () => {
    test("Owner darf den Space ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canViewSpace(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("owner");
    });

    test("Admin darf den Space ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canViewSpace(SPACE_ID, "bob");
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("admin");
    });

    test("Editor darf den Space ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canViewSpace(SPACE_ID, "carol");
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("editor");
    });

    test("Viewer darf den Space ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canViewSpace(SPACE_ID, "dave");
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("viewer");
    });

    test("Kein Mitglied darf den Space nicht ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canViewSpace(SPACE_ID, "stranger");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canViewSpace("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // canEditSpace()
  // -------------------------------------------------------------------------

  describe("canEditSpace()", () => {
    test("Owner darf den Space bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canEditSpace(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf den Space NICHT bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canEditSpace(SPACE_ID, "bob");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("admin");
    });

    test("Editor darf den Space NICHT bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canEditSpace(SPACE_ID, "carol");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("editor");
    });

    test("Viewer darf den Space NICHT bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canEditSpace(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("viewer");
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canEditSpace("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });

    test("gibt allowed=false zurück wenn der Benutzer kein Mitglied ist", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canEditSpace(SPACE_ID, "stranger");
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canEditSettings()
  // -------------------------------------------------------------------------

  describe("canEditSettings()", () => {
    test("Owner darf Einstellungen bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canEditSettings(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf Einstellungen bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canEditSettings(SPACE_ID, "bob");
      expect(result.allowed).toBe(true);
    });

    test("Editor darf Einstellungen NICHT bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canEditSettings(SPACE_ID, "carol");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("editor");
    });

    test("Viewer darf Einstellungen NICHT bearbeiten", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canEditSettings(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("viewer");
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canEditSettings("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // canWriteMemory()
  // -------------------------------------------------------------------------

  describe("canWriteMemory()", () => {
    test("Owner darf Memory schreiben", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canWriteMemory(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf Memory schreiben", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canWriteMemory(SPACE_ID, "bob");
      expect(result.allowed).toBe(true);
    });

    test("Editor darf Memory schreiben", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canWriteMemory(SPACE_ID, "carol");
      expect(result.allowed).toBe(true);
    });

    test("Viewer darf Memory NICHT schreiben", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canWriteMemory(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("viewer");
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canWriteMemory("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // canViewChats()
  // -------------------------------------------------------------------------

  describe("canViewChats()", () => {
    test("Owner darf Chats ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canViewChats(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf Chats ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canViewChats(SPACE_ID, "bob");
      expect(result.allowed).toBe(true);
    });

    test("Editor darf Chats ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canViewChats(SPACE_ID, "carol");
      expect(result.allowed).toBe(true);
    });

    test("Viewer darf Chats ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canViewChats(SPACE_ID, "dave");
      expect(result.allowed).toBe(true);
    });

    test("Kein Mitglied darf keine Chats ansehen", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canViewChats(SPACE_ID, "stranger");
      expect(result.allowed).toBe(false);
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canViewChats("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // canManageMembers()
  // -------------------------------------------------------------------------

  describe("canManageMembers()", () => {
    test("Owner darf Mitglieder verwalten", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canManageMembers(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf Mitglieder verwalten", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canManageMembers(SPACE_ID, "bob");
      expect(result.allowed).toBe(true);
    });

    test("Editor darf Mitglieder NICHT verwalten", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canManageMembers(SPACE_ID, "carol");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("editor");
    });

    test("Viewer darf Mitglieder NICHT verwalten", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canManageMembers(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("viewer");
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canManageMembers("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // canModifyMember()
  // -------------------------------------------------------------------------

  describe("canModifyMember()", () => {
    test("Owner kann einen Admin-Benutzer modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "alice", "bob");
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("owner");
    });

    test("Owner kann einen Editor-Benutzer modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "carol", role: "editor" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "alice", "carol");
      expect(result.allowed).toBe(true);
    });

    test("Admin kann einen Editor-Benutzer modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
          { userId: "carol", role: "editor" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "bob", "carol");
      expect(result.allowed).toBe(true);
    });

    test("Admin kann einen Viewer-Benutzer modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
          { userId: "dave", role: "viewer" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "bob", "dave");
      expect(result.allowed).toBe(true);
    });

    test("Admin kann Owner NICHT modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "bob", "alice");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("admin");
      expect(result.reason).toBeDefined();
    });

    test("Benutzer kann eigene Rolle NICHT ändern (Owner)", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canModifyMember(SPACE_ID, "alice", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test("Benutzer kann eigene Rolle NICHT ändern (Admin)", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "bob", "bob");
      expect(result.allowed).toBe(false);
    });

    test("Editor darf keine Mitglieder modifizieren (kein canManageMembers)", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "carol", role: "editor" },
          { userId: "dave", role: "viewer" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "carol", "dave");
      expect(result.allowed).toBe(false);
    });

    test("Viewer darf keine Mitglieder modifizieren", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "dave", role: "viewer" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "dave", "alice");
      expect(result.allowed).toBe(false);
    });

    test("Owner kann ein Nicht-Mitglied als Ziel setzen (Hinzufügen möglich)", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canModifyMember(SPACE_ID, "alice", "new_user");
      expect(result.allowed).toBe(true);
    });

    test("Admin kann ein Nicht-Mitglied als Ziel setzen (Hinzufügen möglich)", async () => {
      registerSpace(
        createTestSpace([
          { userId: "alice", role: "owner" },
          { userId: "bob", role: "admin" },
        ])
      );
      const result = await canModifyMember(SPACE_ID, "bob", "new_user");
      expect(result.allowed).toBe(true);
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canModifyMember("nonexistent_space", "alice", "bob");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });

    test("gibt allowed=false zurück wenn der handelnde Benutzer kein Mitglied ist", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canModifyMember(SPACE_ID, "stranger", "alice");
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canDeleteSpace()
  // -------------------------------------------------------------------------

  describe("canDeleteSpace()", () => {
    test("Owner darf den Space löschen", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canDeleteSpace(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf den Space NICHT löschen", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canDeleteSpace(SPACE_ID, "bob");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("admin");
    });

    test("Editor darf den Space NICHT löschen", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canDeleteSpace(SPACE_ID, "carol");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("editor");
    });

    test("Viewer darf den Space NICHT löschen", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canDeleteSpace(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("viewer");
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canDeleteSpace("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });

    test("gibt allowed=false zurück wenn der Benutzer kein Mitglied ist", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canDeleteSpace(SPACE_ID, "stranger");
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // canArchiveSpace()
  // -------------------------------------------------------------------------

  describe("canArchiveSpace()", () => {
    test("Owner darf den Space archivieren", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await canArchiveSpace(SPACE_ID, "alice");
      expect(result.allowed).toBe(true);
    });

    test("Admin darf den Space NICHT archivieren (entspricht canEditSpace)", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await canArchiveSpace(SPACE_ID, "bob");
      expect(result.allowed).toBe(false);
      expect(result.role).toBe("admin");
    });

    test("Editor darf den Space NICHT archivieren", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await canArchiveSpace(SPACE_ID, "carol");
      expect(result.allowed).toBe(false);
    });

    test("Viewer darf den Space NICHT archivieren", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await canArchiveSpace(SPACE_ID, "dave");
      expect(result.allowed).toBe(false);
    });

    test("Ergebnis entspricht canEditSpace (gleiches Verhalten)", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const archiveResult = await canArchiveSpace(SPACE_ID, "alice");
      const editResult = await canEditSpace(SPACE_ID, "alice");
      expect(archiveResult.allowed).toBe(editResult.allowed);
    });

    test("gibt allowed=false zurück wenn der Space nicht existiert", async () => {
      const result = await canArchiveSpace("nonexistent_space", "alice");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Space nicht gefunden");
    });
  });

  // -------------------------------------------------------------------------
  // getUserPermissions()
  // -------------------------------------------------------------------------

  describe("getUserPermissions()", () => {
    test("gibt null zurück wenn der Space nicht existiert", async () => {
      const result = await getUserPermissions("nonexistent_space", "alice");
      expect(result.role).toBeNull();
      expect(result.permissions).toBeNull();
    });

    test("gibt null zurück wenn der Benutzer kein Mitglied ist", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await getUserPermissions(SPACE_ID, "stranger");
      expect(result.role).toBeNull();
      expect(result.permissions).toBeNull();
    });

    test("gibt korrekte Rolle und Berechtigungen für Owner zurück", async () => {
      registerSpace(createTestSpace([{ userId: "alice", role: "owner" }]));
      const result = await getUserPermissions(SPACE_ID, "alice");
      expect(result.role).toBe("owner");
      expect(result.permissions).not.toBeNull();
      expect(result.permissions!.canEditSpace).toBe(true);
      expect(result.permissions!.canEditSettings).toBe(true);
      expect(result.permissions!.canWriteMemory).toBe(true);
      expect(result.permissions!.canViewChats).toBe(true);
      expect(result.permissions!.canManageMembers).toBe(true);
      expect(result.permissions!.canDeleteSpace).toBe(true);
    });

    test("gibt korrekte Rolle und Berechtigungen für Admin zurück", async () => {
      registerSpace(createTestSpace([{ userId: "bob", role: "admin" }]));
      const result = await getUserPermissions(SPACE_ID, "bob");
      expect(result.role).toBe("admin");
      expect(result.permissions).not.toBeNull();
      expect(result.permissions!.canEditSpace).toBe(false);
      expect(result.permissions!.canEditSettings).toBe(true);
      expect(result.permissions!.canWriteMemory).toBe(true);
      expect(result.permissions!.canViewChats).toBe(true);
      expect(result.permissions!.canManageMembers).toBe(true);
      expect(result.permissions!.canDeleteSpace).toBe(false);
    });

    test("gibt korrekte Rolle und Berechtigungen für Editor zurück", async () => {
      registerSpace(createTestSpace([{ userId: "carol", role: "editor" }]));
      const result = await getUserPermissions(SPACE_ID, "carol");
      expect(result.role).toBe("editor");
      expect(result.permissions).not.toBeNull();
      expect(result.permissions!.canEditSpace).toBe(false);
      expect(result.permissions!.canEditSettings).toBe(false);
      expect(result.permissions!.canWriteMemory).toBe(true);
      expect(result.permissions!.canViewChats).toBe(true);
      expect(result.permissions!.canManageMembers).toBe(false);
      expect(result.permissions!.canDeleteSpace).toBe(false);
    });

    test("gibt korrekte Rolle und Berechtigungen für Viewer zurück", async () => {
      registerSpace(createTestSpace([{ userId: "dave", role: "viewer" }]));
      const result = await getUserPermissions(SPACE_ID, "dave");
      expect(result.role).toBe("viewer");
      expect(result.permissions).not.toBeNull();
      expect(result.permissions!.canEditSpace).toBe(false);
      expect(result.permissions!.canEditSettings).toBe(false);
      expect(result.permissions!.canWriteMemory).toBe(false);
      expect(result.permissions!.canViewChats).toBe(true);
      expect(result.permissions!.canManageMembers).toBe(false);
      expect(result.permissions!.canDeleteSpace).toBe(false);
    });
  });
});
