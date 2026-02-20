import { test, expect, describe } from "bun:test";
import {
  RESOURCE_PERMISSIONS,
  ROLE_HIERARCHY,
  getHigherRole,
  roleHasPermission,
  getAssignableRoles,
} from "../types";

describe("RESOURCE_PERMISSIONS", () => {
  describe("owner", () => {
    test("kann Ressourcen anzeigen", () => {
      expect(RESOURCE_PERMISSIONS.owner.canView).toBe(true);
    });

    test("kann Ressourcen bearbeiten", () => {
      expect(RESOURCE_PERMISSIONS.owner.canEdit).toBe(true);
    });

    test("kann Ressourcen löschen", () => {
      expect(RESOURCE_PERMISSIONS.owner.canDelete).toBe(true);
    });

    test("kann Zugriff verwalten", () => {
      expect(RESOURCE_PERMISSIONS.owner.canManageAccess).toBe(true);
    });

    test("kann Eigentumsrechte übertragen", () => {
      expect(RESOURCE_PERMISSIONS.owner.canTransferOwnership).toBe(true);
    });
  });

  describe("admin", () => {
    test("kann Ressourcen anzeigen", () => {
      expect(RESOURCE_PERMISSIONS.admin.canView).toBe(true);
    });

    test("kann Ressourcen bearbeiten", () => {
      expect(RESOURCE_PERMISSIONS.admin.canEdit).toBe(true);
    });

    test("kann Ressourcen nicht löschen", () => {
      expect(RESOURCE_PERMISSIONS.admin.canDelete).toBe(false);
    });

    test("kann Zugriff verwalten", () => {
      expect(RESOURCE_PERMISSIONS.admin.canManageAccess).toBe(true);
    });

    test("kann Eigentumsrechte nicht übertragen", () => {
      expect(RESOURCE_PERMISSIONS.admin.canTransferOwnership).toBe(false);
    });
  });

  describe("editor", () => {
    test("kann Ressourcen anzeigen", () => {
      expect(RESOURCE_PERMISSIONS.editor.canView).toBe(true);
    });

    test("kann Ressourcen bearbeiten", () => {
      expect(RESOURCE_PERMISSIONS.editor.canEdit).toBe(true);
    });

    test("kann Ressourcen nicht löschen", () => {
      expect(RESOURCE_PERMISSIONS.editor.canDelete).toBe(false);
    });

    test("kann Zugriff nicht verwalten", () => {
      expect(RESOURCE_PERMISSIONS.editor.canManageAccess).toBe(false);
    });

    test("kann Eigentumsrechte nicht übertragen", () => {
      expect(RESOURCE_PERMISSIONS.editor.canTransferOwnership).toBe(false);
    });
  });

  describe("viewer", () => {
    test("kann Ressourcen anzeigen", () => {
      expect(RESOURCE_PERMISSIONS.viewer.canView).toBe(true);
    });

    test("kann Ressourcen nicht bearbeiten", () => {
      expect(RESOURCE_PERMISSIONS.viewer.canEdit).toBe(false);
    });

    test("kann Ressourcen nicht löschen", () => {
      expect(RESOURCE_PERMISSIONS.viewer.canDelete).toBe(false);
    });

    test("kann Zugriff nicht verwalten", () => {
      expect(RESOURCE_PERMISSIONS.viewer.canManageAccess).toBe(false);
    });

    test("kann Eigentumsrechte nicht übertragen", () => {
      expect(RESOURCE_PERMISSIONS.viewer.canTransferOwnership).toBe(false);
    });
  });
});

describe("ROLE_HIERARCHY", () => {
  test("enthält genau vier Rollen", () => {
    expect(ROLE_HIERARCHY).toHaveLength(4);
  });

  test("viewer steht an erster Stelle (niedrigste Berechtigung)", () => {
    expect(ROLE_HIERARCHY[0]).toBe("viewer");
  });

  test("editor steht an zweiter Stelle", () => {
    expect(ROLE_HIERARCHY[1]).toBe("editor");
  });

  test("admin steht an dritter Stelle", () => {
    expect(ROLE_HIERARCHY[2]).toBe("admin");
  });

  test("owner steht an letzter Stelle (höchste Berechtigung)", () => {
    expect(ROLE_HIERARCHY[3]).toBe("owner");
  });

  test("Reihenfolge entspricht aufsteigender Privilegienstufe", () => {
    expect(ROLE_HIERARCHY).toEqual(["viewer", "editor", "admin", "owner"]);
  });
});

describe("getHigherRole", () => {
  test("owner ist höher als admin", () => {
    expect(getHigherRole("owner", "admin")).toBe("owner");
  });

  test("admin ist höher als owner — Reihenfolge der Argumente vertauscht", () => {
    expect(getHigherRole("admin", "owner")).toBe("owner");
  });

  test("owner ist höher als editor", () => {
    expect(getHigherRole("owner", "editor")).toBe("owner");
  });

  test("owner ist höher als viewer", () => {
    expect(getHigherRole("owner", "viewer")).toBe("owner");
  });

  test("admin ist höher als editor", () => {
    expect(getHigherRole("admin", "editor")).toBe("admin");
  });

  test("admin ist höher als viewer", () => {
    expect(getHigherRole("admin", "viewer")).toBe("admin");
  });

  test("editor ist höher als viewer", () => {
    expect(getHigherRole("editor", "viewer")).toBe("editor");
  });

  test("gleiche Rollen — gibt die erste zurück", () => {
    expect(getHigherRole("editor", "editor")).toBe("editor");
  });

  test("null als erste Rolle gibt die zweite Rolle zurück", () => {
    expect(getHigherRole(null, "admin")).toBe("admin");
  });

  test("null als zweite Rolle gibt die erste Rolle zurück", () => {
    expect(getHigherRole("viewer", null)).toBe("viewer");
  });

  test("beide Argumente null gibt null zurück", () => {
    expect(getHigherRole(null, null)).toBeNull();
  });
});

describe("roleHasPermission", () => {
  test("owner hat canView", () => {
    expect(roleHasPermission("owner", "canView")).toBe(true);
  });

  test("owner hat canDelete", () => {
    expect(roleHasPermission("owner", "canDelete")).toBe(true);
  });

  test("owner hat canTransferOwnership", () => {
    expect(roleHasPermission("owner", "canTransferOwnership")).toBe(true);
  });

  test("admin hat canManageAccess", () => {
    expect(roleHasPermission("admin", "canManageAccess")).toBe(true);
  });

  test("admin hat kein canDelete", () => {
    expect(roleHasPermission("admin", "canDelete")).toBe(false);
  });

  test("admin hat kein canTransferOwnership", () => {
    expect(roleHasPermission("admin", "canTransferOwnership")).toBe(false);
  });

  test("editor hat canEdit", () => {
    expect(roleHasPermission("editor", "canEdit")).toBe(true);
  });

  test("editor hat kein canManageAccess", () => {
    expect(roleHasPermission("editor", "canManageAccess")).toBe(false);
  });

  test("viewer hat canView", () => {
    expect(roleHasPermission("viewer", "canView")).toBe(true);
  });

  test("viewer hat kein canEdit", () => {
    expect(roleHasPermission("viewer", "canEdit")).toBe(false);
  });

  test("viewer hat kein canDelete", () => {
    expect(roleHasPermission("viewer", "canDelete")).toBe(false);
  });
});

describe("getAssignableRoles", () => {
  test("owner kann genau drei Rollen vergeben", () => {
    expect(getAssignableRoles("owner")).toHaveLength(3);
  });

  test("owner kann admin, editor und viewer vergeben", () => {
    expect(getAssignableRoles("owner")).toEqual(["admin", "editor", "viewer"]);
  });

  test("owner kann sich selbst keine owner-Rolle vergeben", () => {
    expect(getAssignableRoles("owner")).not.toContain("owner");
  });

  test("admin kann genau drei Rollen vergeben", () => {
    expect(getAssignableRoles("admin")).toHaveLength(3);
  });

  test("admin kann admin, editor und viewer vergeben", () => {
    expect(getAssignableRoles("admin")).toEqual(["admin", "editor", "viewer"]);
  });

  test("admin kann keine owner-Rolle vergeben", () => {
    expect(getAssignableRoles("admin")).not.toContain("owner");
  });

  test("editor kann keine Rollen vergeben", () => {
    expect(getAssignableRoles("editor")).toEqual([]);
  });

  test("viewer kann keine Rollen vergeben", () => {
    expect(getAssignableRoles("viewer")).toEqual([]);
  });
});
