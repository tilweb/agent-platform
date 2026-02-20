import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { ResourceAccess } from "../types";
import { RESOURCE_PERMISSIONS } from "../types";

// ---------------------------------------------------------------------------
// Mock state — reset in beforeEach
// ---------------------------------------------------------------------------

let mockGroups: any[] = [];
let mockUser: any = null;
/**
 * mockAccessEntries may optionally carry a `forResourceId` field.
 * When set, `getResourceAccessEntry` only returns the entry for that specific resourceId.
 * When absent, the entry matches any resourceId (useful for single-resource tests).
 */
let mockAccessEntries: any[] = [];

mock.module("../../auth/groups", () => ({
  getUserGroups: async () => mockGroups,
}));

mock.module("../../auth/storage", () => ({
  loadUser: async () => mockUser,
}));

mock.module("../storage", () => ({
  loadResourceAccess: async () => mockAccessEntries,
  getResourceAccessEntry: async (
    _type: string,
    resourceId: string,
    principalType: string,
    principalId: string
  ) => {
    return (
      mockAccessEntries.find(
        (e) =>
          e.principalType === principalType &&
          e.principalId === principalId &&
          (e.forResourceId === undefined || e.forResourceId === resourceId)
      ) || null
    );
  },
}));

// Import after mocks are registered
const {
  checkAccess,
  canView,
  canEdit,
  canDelete,
  canManageAccess,
  canTransferOwnership,
  getEffectiveRole,
  getUserResourcePermissions,
  hasAnyAccess,
  listAccessibleResources,
  getResourceAccessInfo,
} = await import("../accessControl");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  principalType: "user" | "group",
  principalId: string,
  role: ResourceAccess["role"],
  forResourceId?: string
): ResourceAccess & { forResourceId?: string } {
  return {
    principalType,
    principalId,
    role,
    grantedAt: "2025-01-01T00:00:00.000Z",
    grantedBy: "admin_user",
    ...(forResourceId !== undefined ? { forResourceId } : {}),
  };
}

function makeGroup(id: string) {
  return {
    id,
    name: `Gruppe ${id}`,
    memberIds: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

function makeUser(role: "admin" | "user" = "user") {
  return {
    id: "user_1",
    username: "testuser",
    passwordHash: "$argon2id$...",
    role,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// checkAccess
// ---------------------------------------------------------------------------

describe("checkAccess", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  describe("Direkter Benutzerzugriff", () => {
    test("erlaubt Zugriff wenn Benutzer die erforderliche Berechtigung direkt besitzt", async () => {
      mockAccessEntries = [makeEntry("user", "user_1", "editor")];

      const result = await checkAccess("user_1", "space", "resource_1", "canEdit");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("direct");
      expect(result.effectiveRole).toBe("editor");
    });

    test("verweigert Zugriff wenn direkte Rolle die erforderliche Berechtigung nicht hat", async () => {
      mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

      const result = await checkAccess("user_1", "space", "resource_1", "canEdit");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test("erlaubt canView für Benutzer mit viewer-Rolle", async () => {
      mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("direct");
      expect(result.effectiveRole).toBe("viewer");
    });

    test("erlaubt canDelete nur für Benutzer mit owner-Rolle", async () => {
      mockAccessEntries = [makeEntry("user", "user_1", "owner")];

      const result = await checkAccess("user_1", "space", "resource_1", "canDelete");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("direct");
      expect(result.effectiveRole).toBe("owner");
    });

    test("verweigert canDelete für Benutzer mit admin-Rolle (admin darf nicht löschen)", async () => {
      mockAccessEntries = [makeEntry("user", "user_1", "admin")];

      const result = await checkAccess("user_1", "space", "resource_1", "canDelete");

      expect(result.allowed).toBe(false);
    });
  });

  describe("Gruppenbasierter Zugriff", () => {
    test("erlaubt Zugriff über Gruppenmitgliedschaft", async () => {
      mockGroups = [makeGroup("group_1")];
      mockAccessEntries = [makeEntry("group", "group_1", "editor")];

      const result = await checkAccess("user_1", "space", "resource_1", "canEdit");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("group");
      expect(result.effectiveRole).toBe("editor");
    });

    test("verweigert Zugriff wenn Gruppenrolle die erforderliche Berechtigung nicht hat", async () => {
      mockGroups = [makeGroup("group_1")];
      mockAccessEntries = [makeEntry("group", "group_1", "viewer")];

      const result = await checkAccess("user_1", "space", "resource_1", "canEdit");

      expect(result.allowed).toBe(false);
    });

    test("wählt höchste Rolle wenn Benutzer Mitglied mehrerer Gruppen ist", async () => {
      mockGroups = [makeGroup("group_viewer"), makeGroup("group_owner")];
      mockAccessEntries = [
        makeEntry("group", "group_viewer", "viewer"),
        makeEntry("group", "group_owner", "owner"),
      ];

      const result = await checkAccess("user_1", "space", "resource_1", "canDelete");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("group");
      expect(result.effectiveRole).toBe("owner");
    });

    test("kombiniert Gruppen korrekt — höchste Rolle entscheidet über Berechtigung", async () => {
      mockGroups = [makeGroup("group_viewer"), makeGroup("group_editor")];
      mockAccessEntries = [
        makeEntry("group", "group_viewer", "viewer"),
        makeEntry("group", "group_editor", "editor"),
      ];

      const editResult = await checkAccess("user_1", "space", "resource_1", "canEdit");
      const deleteResult = await checkAccess("user_1", "space", "resource_1", "canDelete");

      expect(editResult.allowed).toBe(true);
      expect(editResult.effectiveRole).toBe("editor");
      expect(deleteResult.allowed).toBe(false);
    });

    test("ignoriert Gruppen ohne Zugriff auf die Ressource", async () => {
      mockGroups = [makeGroup("group_no_access")];
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(false);
    });
  });

  describe("Globaler Admin-Override", () => {
    test("erlaubt globalen Admins Zugriff ohne expliziten Ressourceneintrag", async () => {
      mockUser = makeUser("admin");
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("admin");
      expect(result.effectiveRole).toBe("admin");
    });

    test("globaler Admin erhält auch canDelete-Berechtigung", async () => {
      mockUser = makeUser("admin");
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "space", "resource_1", "canDelete");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("admin");
    });

    test("globaler Admin-Override greift auch wenn keine Gruppen vorhanden sind", async () => {
      mockUser = makeUser("admin");
      mockGroups = [];
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "agent", "agent_42", "canManageAccess");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("admin");
    });
  });

  describe("Kein Zugriff", () => {
    test("verweigert Zugriff wenn kein Eintrag vorhanden ist und kein Admin", async () => {
      mockUser = makeUser("user");
      mockGroups = [];
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toBeTruthy();
    });

    test("gibt keinen effectiveRole zurück wenn Zugriff verweigert wird", async () => {
      mockAccessEntries = [];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(false);
      expect(result.effectiveRole).toBeUndefined();
    });
  });

  describe("Reihenfolge der Prüfung", () => {
    test("direkter Zugriff hat Vorrang vor Gruppenzugriff", async () => {
      // Direkt: viewer, Gruppe: owner — direkte Prüfung kommt zuerst
      mockGroups = [makeGroup("group_1")];
      mockAccessEntries = [
        makeEntry("user", "user_1", "viewer"),
        makeEntry("group", "group_1", "owner"),
      ];

      const result = await checkAccess("user_1", "space", "resource_1", "canView");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("direct");
      expect(result.effectiveRole).toBe("viewer");
    });

    test("direkter Zugriff mit unzureichender Rolle fällt auf Gruppenprüfung zurück", async () => {
      // Direkt: viewer (kann nicht bearbeiten), Gruppe: editor (kann bearbeiten)
      mockGroups = [makeGroup("group_1")];
      mockAccessEntries = [
        makeEntry("user", "user_1", "viewer"),
        makeEntry("group", "group_1", "editor"),
      ];

      const result = await checkAccess("user_1", "space", "resource_1", "canEdit");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("group");
      expect(result.effectiveRole).toBe("editor");
    });
  });
});

// ---------------------------------------------------------------------------
// Convenience-Wrapper
// ---------------------------------------------------------------------------

describe("canView", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt allowed=true zurück wenn Benutzer viewer-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

    const result = await canView("user_1", "space", "resource_1");

    expect(result.allowed).toBe(true);
  });

  test("gibt allowed=false zurück wenn kein Zugriff vorhanden ist", async () => {
    const result = await canView("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });
});

describe("canEdit", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt allowed=true zurück wenn Benutzer editor-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const result = await canEdit("user_1", "space", "resource_1");

    expect(result.allowed).toBe(true);
  });

  test("gibt allowed=false zurück wenn Benutzer nur viewer-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

    const result = await canEdit("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });
});

describe("canDelete", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt allowed=true zurück wenn Benutzer owner-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "owner")];

    const result = await canDelete("user_1", "space", "resource_1");

    expect(result.allowed).toBe(true);
  });

  test("gibt allowed=false zurück wenn Benutzer admin-Rolle hat (admin darf nicht löschen)", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "admin")];

    const result = await canDelete("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });

  test("gibt allowed=false zurück wenn Benutzer editor-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const result = await canDelete("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });
});

describe("canManageAccess", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt allowed=true zurück wenn Benutzer admin-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "admin")];

    const result = await canManageAccess("user_1", "space", "resource_1");

    expect(result.allowed).toBe(true);
  });

  test("gibt allowed=false zurück wenn Benutzer editor-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const result = await canManageAccess("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });
});

describe("canTransferOwnership", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt allowed=true zurück wenn Benutzer owner-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "owner")];

    const result = await canTransferOwnership("user_1", "space", "resource_1");

    expect(result.allowed).toBe(true);
  });

  test("gibt allowed=false zurück wenn Benutzer admin-Rolle hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "admin")];

    const result = await canTransferOwnership("user_1", "space", "resource_1");

    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveRole
// ---------------------------------------------------------------------------

describe("getEffectiveRole", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt null zurück wenn kein Zugriffseintrag existiert", async () => {
    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBeNull();
  });

  test("gibt direkte Benutzerrolle zurück", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBe("editor");
  });

  test("gibt Gruppenrolle zurück wenn kein direkter Eintrag vorhanden", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [makeEntry("group", "group_1", "viewer")];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBe("viewer");
  });

  test("kombiniert direkte und Gruppenrollen — gibt höchste Rolle zurück", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [
      makeEntry("user", "user_1", "viewer"),
      makeEntry("group", "group_1", "admin"),
    ];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBe("admin");
  });

  test("wählt die höchste Rolle aus mehreren Gruppen", async () => {
    mockGroups = [makeGroup("group_editor"), makeGroup("group_owner")];
    mockAccessEntries = [
      makeEntry("group", "group_editor", "editor"),
      makeEntry("group", "group_owner", "owner"),
    ];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBe("owner");
  });

  test("behält direkte Rolle bei wenn sie höher als Gruppenrollen ist", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [
      makeEntry("user", "user_1", "owner"),
      makeEntry("group", "group_1", "viewer"),
    ];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBe("owner");
  });

  test("berücksichtigt keinen globalen Admin-Status", async () => {
    // getEffectiveRole schaut nur auf explizite Einträge, nicht auf globale Adminrolle
    mockUser = makeUser("admin");
    mockAccessEntries = [];

    const role = await getEffectiveRole("user_1", "space", "resource_1");

    expect(role).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUserResourcePermissions
// ---------------------------------------------------------------------------

describe("getUserResourcePermissions", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt role und permissions zurück wenn Benutzer Zugriff hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBe("editor");
    expect(result.permissions).toEqual(RESOURCE_PERMISSIONS["editor"]);
    expect(result.isGlobalAdmin).toBe(false);
  });

  test("gibt owner-Permissions zurück für owner-Rolle", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "owner")];

    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBe("owner");
    expect(result.permissions?.canDelete).toBe(true);
    expect(result.permissions?.canTransferOwnership).toBe(true);
  });

  test("gibt role=null und permissions=null zurück wenn kein Zugriff vorhanden und kein Admin", async () => {
    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBeNull();
    expect(result.permissions).toBeNull();
    expect(result.isGlobalAdmin).toBe(false);
  });

  test("gibt admin-Permissions zurück wenn Benutzer globaler Admin ohne expliziten Eintrag ist", async () => {
    mockUser = makeUser("admin");
    mockAccessEntries = [];

    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBeNull();
    expect(result.permissions).toEqual(RESOURCE_PERMISSIONS["admin"]);
    expect(result.isGlobalAdmin).toBe(true);
  });

  test("gibt isGlobalAdmin=true zurück wenn Benutzer globaler Admin und explizite Rolle hat", async () => {
    mockUser = makeUser("admin");
    mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBe("viewer");
    expect(result.isGlobalAdmin).toBe(true);
  });

  test("kombiniert direkte und Gruppenrollen für die effektive Rolle", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [
      makeEntry("user", "user_1", "viewer"),
      makeEntry("group", "group_1", "editor"),
    ];

    const result = await getUserResourcePermissions("user_1", "space", "resource_1");

    expect(result.role).toBe("editor");
    expect(result.permissions?.canEdit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasAnyAccess
// ---------------------------------------------------------------------------

describe("hasAnyAccess", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt true zurück wenn Benutzer viewer-Zugriff hat", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "viewer")];

    const result = await hasAnyAccess("user_1", "space", "resource_1");

    expect(result).toBe(true);
  });

  test("gibt true zurück wenn Benutzer Zugriff über Gruppe hat", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [makeEntry("group", "group_1", "viewer")];

    const result = await hasAnyAccess("user_1", "space", "resource_1");

    expect(result).toBe(true);
  });

  test("gibt true zurück wenn Benutzer globaler Admin ist", async () => {
    mockUser = makeUser("admin");

    const result = await hasAnyAccess("user_1", "space", "resource_1");

    expect(result).toBe(true);
  });

  test("gibt false zurück wenn kein Zugriff vorhanden und kein Admin", async () => {
    const result = await hasAnyAccess("user_1", "space", "resource_1");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listAccessibleResources
// ---------------------------------------------------------------------------

describe("listAccessibleResources", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt leeres Array zurück wenn keine Ressource zugänglich ist", async () => {
    const result = await listAccessibleResources("user_1", "space", ["res_1", "res_2"]);

    expect(result).toEqual([]);
  });

  test("gibt zugängliche Ressource mit direktem Zugriff zurück", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "editor")];

    const result = await listAccessibleResources("user_1", "space", ["res_1"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ resourceId: "res_1", role: "editor" });
  });

  test("gibt zugängliche Ressource mit Gruppenzugriff zurück", async () => {
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [makeEntry("group", "group_1", "viewer")];

    const result = await listAccessibleResources("user_1", "space", ["res_1"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ resourceId: "res_1", role: "viewer" });
  });

  test("gibt alle Ressourcen mit admin-Rolle zurück wenn Benutzer globaler Admin ist", async () => {
    mockUser = makeUser("admin");

    const result = await listAccessibleResources("user_1", "space", ["res_1", "res_2", "res_3"]);

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.role === "admin")).toBe(true);
  });

  test("filtert nicht zugängliche Ressourcen heraus", async () => {
    // user_1 hat nur Zugriff auf res_1, nicht auf res_2
    // forResourceId steuert, für welche Ressource der Eintrag gilt
    mockAccessEntries = [makeEntry("user", "user_1", "owner", "res_1")];

    const result = await listAccessibleResources("user_1", "space", ["res_1", "res_2"]);

    const ids = result.map((r) => r.resourceId);
    expect(ids).toContain("res_1");
    expect(ids).not.toContain("res_2");
    expect(result).toHaveLength(1);
  });

  test("bevorzugt direkten Zugriff gegenüber Gruppenzugriff für die Rolle", async () => {
    // Direkt: viewer, Gruppe: owner — direkter Eintrag wird zuerst geprüft und gibt viewer zurück
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [
      makeEntry("user", "user_1", "viewer"),
      makeEntry("group", "group_1", "owner"),
    ];

    const result = await listAccessibleResources("user_1", "space", ["res_1"]);

    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("viewer");
  });

  test("globaler Admin erhält admin-Rolle wenn kein direkter oder Gruppeneintrag vorhanden", async () => {
    mockUser = makeUser("admin");
    mockAccessEntries = [];

    const result = await listAccessibleResources("user_1", "space", ["res_1"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ resourceId: "res_1", role: "admin" });
  });

  test("verarbeitet leeres resourceIds-Array korrekt", async () => {
    const result = await listAccessibleResources("user_1", "space", []);

    expect(result).toEqual([]);
  });

  test("gibt mehrere zugängliche Ressourcen mit korrekten Rollen zurück", async () => {
    // res_a: user_1 direkt als editor, res_b: über Gruppe als viewer
    mockGroups = [makeGroup("group_1")];
    mockAccessEntries = [
      makeEntry("user", "user_1", "editor", "res_a"),
      makeEntry("group", "group_1", "viewer", "res_b"),
    ];

    const result = await listAccessibleResources("user_1", "space", ["res_a", "res_b", "res_c"]);

    expect(result).toHaveLength(2);
    const byId = Object.fromEntries(result.map((r) => [r.resourceId, r.role]));
    expect(byId["res_a"]).toBe("editor");
    expect(byId["res_b"]).toBe("viewer");
  });
});

// ---------------------------------------------------------------------------
// getResourceAccessInfo
// ---------------------------------------------------------------------------

describe("getResourceAccessInfo", () => {
  beforeEach(() => {
    mockGroups = [];
    mockUser = makeUser("user");
    mockAccessEntries = [];
  });

  test("gibt leere users- und groups-Arrays zurück wenn keine Einträge vorhanden", async () => {
    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.users).toEqual([]);
    expect(result.groups).toEqual([]);
  });

  test("trennt Benutzer- und Gruppeneinträge korrekt", async () => {
    mockAccessEntries = [
      makeEntry("user", "user_1", "owner"),
      makeEntry("user", "user_2", "editor"),
      makeEntry("group", "group_1", "viewer"),
    ];

    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.users).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
  });

  test("setzt type='user' für alle Benutzereinträge", async () => {
    mockAccessEntries = [makeEntry("user", "user_1", "owner")];

    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.users[0]!.type).toBe("user");
  });

  test("setzt type='group' für alle Gruppeneinträge", async () => {
    mockAccessEntries = [makeEntry("group", "group_1", "editor")];

    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.groups[0]!.type).toBe("group");
  });

  test("Benutzereinträge enthalten alle ResourceAccess-Felder plus type", async () => {
    const entry = makeEntry("user", "user_42", "admin");
    mockAccessEntries = [entry];

    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.users[0]).toMatchObject({
      principalType: "user",
      principalId: "user_42",
      role: "admin",
      grantedAt: entry.grantedAt,
      grantedBy: entry.grantedBy,
      type: "user",
    });
  });

  test("Gruppeneinträge enthalten alle ResourceAccess-Felder plus type", async () => {
    const entry = makeEntry("group", "group_99", "viewer");
    mockAccessEntries = [entry];

    const result = await getResourceAccessInfo("space", "resource_1");

    expect(result.groups[0]).toMatchObject({
      principalType: "group",
      principalId: "group_99",
      role: "viewer",
      type: "group",
    });
  });

  test("gibt nur Benutzereinträge zurück wenn ausschließlich Benutzer Zugriff haben", async () => {
    mockAccessEntries = [
      makeEntry("user", "user_1", "owner"),
      makeEntry("user", "user_2", "viewer"),
    ];

    const result = await getResourceAccessInfo("agent", "agent_1");

    expect(result.users).toHaveLength(2);
    expect(result.groups).toHaveLength(0);
  });

  test("gibt nur Gruppeneinträge zurück wenn ausschließlich Gruppen Zugriff haben", async () => {
    mockAccessEntries = [
      makeEntry("group", "group_a", "editor"),
      makeEntry("group", "group_b", "admin"),
    ];

    const result = await getResourceAccessInfo("skill", "skill_1");

    expect(result.users).toHaveLength(0);
    expect(result.groups).toHaveLength(2);
  });
});
