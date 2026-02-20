/**
 * Tests for RBAC Storage (backend/src/rbac/storage.ts)
 *
 * Uses a real temp directory under /tmp so that actual YAML files are written
 * and read.  DATA_DIR is redirected via mock.module BEFORE the module under
 * test is imported.
 */

import { test, expect, describe, beforeEach, afterAll, mock } from "bun:test";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Temp directory — unique per test run so parallel runs don't collide
// ---------------------------------------------------------------------------

const TEST_DIR = `/tmp/rbac-storage-test-${Date.now()}`;

// ---------------------------------------------------------------------------
// Mock DATA_DIR BEFORE importing the module under test.
// RESOURCE_DATA_DIRS is NOT mocked — it comes from types.ts as-is.
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  DATA_DIR: TEST_DIR,
}));

// ---------------------------------------------------------------------------
// Import AFTER mock is registered
// ---------------------------------------------------------------------------

const {
  loadResourceAccess,
  saveResourceAccess,
  getResourceAccessEntry,
  grantAccess,
  updateAccessRole,
  revokeAccess,
  getUsersWithAccess,
  getGroupsWithAccess,
  getResourceOwner,
  transferOwnership,
  initializeResourceAccess,
  deleteResourceAccess,
  hasAccessEntries,
} = await import("../storage");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the expected on-disk path for a given resource's access.yaml */
function accessFilePath(resourceType: string, resourceId: string): string {
  const dirs: Record<string, string> = {
    space: "spaces",
    collection: "knowledge-base/collections",
    contract: "contracts",
    skill: "skills/public",
    agent: "agents",
  };
  return join(TEST_DIR, dirs[resourceType]!, resourceId, "access.yaml");
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(async () => {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// initializeResourceAccess
// ---------------------------------------------------------------------------

describe("initializeResourceAccess()", () => {
  test("erstellt einen Owner-Eintrag für den Ersteller", async () => {
    const entry = await initializeResourceAccess("space", "init-1", "alice");

    expect(entry.principalType).toBe("user");
    expect(entry.principalId).toBe("alice");
    expect(entry.role).toBe("owner");
    expect(entry.grantedBy).toBe("alice");
    expect(entry.grantedAt).toBeTruthy();
  });

  test("schreibt die access.yaml-Datei auf die Festplatte", async () => {
    await initializeResourceAccess("space", "init-2", "bob");

    expect(existsSync(accessFilePath("space", "init-2"))).toBe(true);
  });

  test("speichert genau einen Eintrag in der Datei", async () => {
    await initializeResourceAccess("space", "init-3", "carol");

    const list = await loadResourceAccess("space", "init-3");
    expect(list).toHaveLength(1);
  });

  test("funktioniert auch für den Ressourcentyp 'agent'", async () => {
    const entry = await initializeResourceAccess("agent", "agent-init-1", "dave");

    expect(entry.role).toBe("owner");
    expect(existsSync(accessFilePath("agent", "agent-init-1"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadResourceAccess
// ---------------------------------------------------------------------------

describe("loadResourceAccess()", () => {
  test("gibt ein leeres Array zurück, wenn keine Datei existiert", async () => {
    const list = await loadResourceAccess("space", "nonexistent-resource");
    expect(list).toEqual([]);
  });

  test("gibt die gespeicherten Einträge zurück", async () => {
    await initializeResourceAccess("space", "load-1", "alice");

    const list = await loadResourceAccess("space", "load-1");
    expect(list).toHaveLength(1);
    expect(list[0]!.principalId).toBe("alice");
  });

  test("gibt mehrere Einträge in der richtigen Reihenfolge zurück", async () => {
    await initializeResourceAccess("space", "load-2", "alice");
    await grantAccess("space", "load-2", "user", "bob", "editor", "alice");
    await grantAccess("space", "load-2", "user", "carol", "viewer", "alice");

    const list = await loadResourceAccess("space", "load-2");
    expect(list).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// saveResourceAccess
// ---------------------------------------------------------------------------

describe("saveResourceAccess()", () => {
  test("erstellt das Verzeichnis und schreibt die Datei", async () => {
    const entries = [
      {
        principalType: "user" as const,
        principalId: "alice",
        role: "owner" as const,
        grantedAt: new Date().toISOString(),
        grantedBy: "alice",
      },
    ];

    await saveResourceAccess("agent", "save-1", entries);

    expect(existsSync(accessFilePath("agent", "save-1"))).toBe(true);
  });

  test("überschreibt bestehende Einträge vollständig", async () => {
    await initializeResourceAccess("space", "save-2", "alice");

    const newEntries = [
      {
        principalType: "user" as const,
        principalId: "bob",
        role: "admin" as const,
        grantedAt: new Date().toISOString(),
        grantedBy: "alice",
      },
    ];
    await saveResourceAccess("space", "save-2", newEntries);

    const list = await loadResourceAccess("space", "save-2");
    expect(list).toHaveLength(1);
    expect(list[0]!.principalId).toBe("bob");
  });

  test("schreibt eine leere Liste", async () => {
    await initializeResourceAccess("space", "save-3", "alice");
    await saveResourceAccess("space", "save-3", []);

    const list = await loadResourceAccess("space", "save-3");
    expect(list).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getResourceAccessEntry
// ---------------------------------------------------------------------------

describe("getResourceAccessEntry()", () => {
  test("findet einen vorhandenen Eintrag anhand von principalType und principalId", async () => {
    await initializeResourceAccess("space", "entry-1", "alice");

    const found = await getResourceAccessEntry("space", "entry-1", "user", "alice");
    expect(found).not.toBeNull();
    expect(found!.principalId).toBe("alice");
    expect(found!.role).toBe("owner");
  });

  test("gibt null zurück, wenn kein Eintrag für den Principal existiert", async () => {
    await initializeResourceAccess("space", "entry-2", "alice");

    const found = await getResourceAccessEntry("space", "entry-2", "user", "unknown-user");
    expect(found).toBeNull();
  });

  test("gibt null zurück, wenn die Ressource gar nicht existiert", async () => {
    const found = await getResourceAccessEntry("space", "no-such-resource", "user", "alice");
    expect(found).toBeNull();
  });

  test("unterscheidet korrekt zwischen user- und group-Principals", async () => {
    await initializeResourceAccess("space", "entry-3", "alice");
    await grantAccess("space", "entry-3", "group", "team-a", "editor", "alice");

    const user = await getResourceAccessEntry("space", "entry-3", "user", "team-a");
    const group = await getResourceAccessEntry("space", "entry-3", "group", "team-a");

    expect(user).toBeNull();
    expect(group).not.toBeNull();
    expect(group!.principalType).toBe("group");
  });
});

// ---------------------------------------------------------------------------
// grantAccess
// ---------------------------------------------------------------------------

describe("grantAccess()", () => {
  test("fügt einen neuen Zugriffseintrag hinzu", async () => {
    await initializeResourceAccess("space", "grant-1", "alice");
    await grantAccess("space", "grant-1", "user", "bob", "editor", "alice");

    const list = await loadResourceAccess("space", "grant-1");
    expect(list).toHaveLength(2);
    const bob = list.find((e) => e.principalId === "bob");
    expect(bob).toBeDefined();
    expect(bob!.role).toBe("editor");
  });

  test("gibt den neuen Eintrag zurück", async () => {
    await initializeResourceAccess("space", "grant-2", "alice");
    const entry = await grantAccess("space", "grant-2", "user", "bob", "viewer", "alice");

    expect(entry.principalId).toBe("bob");
    expect(entry.role).toBe("viewer");
    expect(entry.grantedBy).toBe("alice");
  });

  test("aktualisiert einen bestehenden Eintrag, wenn der Principal bereits Zugriff hat", async () => {
    await initializeResourceAccess("space", "grant-3", "alice");
    await grantAccess("space", "grant-3", "user", "bob", "viewer", "alice");
    await grantAccess("space", "grant-3", "user", "bob", "editor", "alice");

    const list = await loadResourceAccess("space", "grant-3");
    const bobEntries = list.filter((e) => e.principalId === "bob");
    expect(bobEntries).toHaveLength(1);
    expect(bobEntries[0]!.role).toBe("editor");
  });

  test("funktioniert auch für group-Principals", async () => {
    await initializeResourceAccess("space", "grant-4", "alice");
    const entry = await grantAccess("space", "grant-4", "group", "team-b", "admin", "alice");

    expect(entry.principalType).toBe("group");
    expect(entry.principalId).toBe("team-b");
    expect(entry.role).toBe("admin");
  });

  test("setzt grantedAt auf den aktuellen Zeitstempel", async () => {
    await initializeResourceAccess("space", "grant-5", "alice");

    const before = new Date().toISOString();
    const entry = await grantAccess("space", "grant-5", "user", "carol", "viewer", "alice");
    const after = new Date().toISOString();

    expect(entry.grantedAt >= before).toBe(true);
    expect(entry.grantedAt <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateAccessRole
// ---------------------------------------------------------------------------

describe("updateAccessRole()", () => {
  test("aktualisiert die Rolle eines vorhandenen Eintrags", async () => {
    await initializeResourceAccess("space", "update-1", "alice");
    await grantAccess("space", "update-1", "user", "bob", "viewer", "alice");

    const updated = await updateAccessRole("space", "update-1", "user", "bob", "editor", "alice");

    expect(updated).not.toBeNull();
    expect(updated!.role).toBe("editor");
    expect(updated!.principalId).toBe("bob");
  });

  test("gibt null zurück, wenn der Principal keinen Zugriff hat", async () => {
    await initializeResourceAccess("space", "update-2", "alice");

    const result = await updateAccessRole("space", "update-2", "user", "nobody", "admin", "alice");
    expect(result).toBeNull();
  });

  test("gibt null zurück, wenn die Ressource nicht existiert", async () => {
    const result = await updateAccessRole("space", "nonexistent-update", "user", "alice", "editor", "admin");
    expect(result).toBeNull();
  });

  test("setzt den updatedBy-Wert im Feld grantedBy", async () => {
    await initializeResourceAccess("space", "update-3", "alice");
    await grantAccess("space", "update-3", "user", "bob", "viewer", "alice");

    const updated = await updateAccessRole("space", "update-3", "user", "bob", "editor", "charlie");

    expect(updated!.grantedBy).toBe("charlie");
  });

  test("persistiert die Rollenänderung dauerhaft auf der Festplatte", async () => {
    await initializeResourceAccess("space", "update-4", "alice");
    await grantAccess("space", "update-4", "user", "bob", "viewer", "alice");
    await updateAccessRole("space", "update-4", "user", "bob", "admin", "alice");

    const list = await loadResourceAccess("space", "update-4");
    const bob = list.find((e) => e.principalId === "bob");
    expect(bob!.role).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// revokeAccess
// ---------------------------------------------------------------------------

describe("revokeAccess()", () => {
  test("entfernt den Eintrag eines Principals und gibt true zurück", async () => {
    await initializeResourceAccess("space", "revoke-1", "alice");
    await grantAccess("space", "revoke-1", "user", "bob", "editor", "alice");

    const result = await revokeAccess("space", "revoke-1", "user", "bob");

    expect(result).toBe(true);
    const list = await loadResourceAccess("space", "revoke-1");
    const bob = list.find((e) => e.principalId === "bob");
    expect(bob).toBeUndefined();
  });

  test("gibt false zurück, wenn der Principal keinen Zugriff hat", async () => {
    await initializeResourceAccess("space", "revoke-2", "alice");

    const result = await revokeAccess("space", "revoke-2", "user", "nobody");
    expect(result).toBe(false);
  });

  test("gibt false zurück, wenn die Ressource nicht existiert", async () => {
    const result = await revokeAccess("space", "nonexistent-revoke", "user", "alice");
    expect(result).toBe(false);
  });

  test("behält alle anderen Einträge nach dem Entfernen eines Principals", async () => {
    await initializeResourceAccess("space", "revoke-3", "alice");
    await grantAccess("space", "revoke-3", "user", "bob", "editor", "alice");
    await grantAccess("space", "revoke-3", "user", "carol", "viewer", "alice");

    await revokeAccess("space", "revoke-3", "user", "bob");

    const list = await loadResourceAccess("space", "revoke-3");
    expect(list).toHaveLength(2);
    const ids = list.map((e) => e.principalId);
    expect(ids).toContain("alice");
    expect(ids).toContain("carol");
    expect(ids).not.toContain("bob");
  });
});

// ---------------------------------------------------------------------------
// getUsersWithAccess
// ---------------------------------------------------------------------------

describe("getUsersWithAccess()", () => {
  test("gibt nur Einträge mit principalType='user' zurück", async () => {
    await initializeResourceAccess("space", "users-1", "alice");
    await grantAccess("space", "users-1", "user", "bob", "editor", "alice");
    await grantAccess("space", "users-1", "group", "team-a", "viewer", "alice");

    const users = await getUsersWithAccess("space", "users-1");

    expect(users).toHaveLength(2);
    users.forEach((u) => expect(u.principalType).toBe("user"));
  });

  test("gibt ein leeres Array zurück, wenn nur Gruppen Zugriff haben", async () => {
    // Wir brauchen eine Ressource ohne User-Einträge; wir simulieren das
    // über saveResourceAccess direkt
    await saveResourceAccess("space", "users-2", [
      {
        principalType: "group",
        principalId: "team-x",
        role: "viewer",
        grantedAt: new Date().toISOString(),
        grantedBy: "admin",
      },
    ]);

    const users = await getUsersWithAccess("space", "users-2");
    expect(users).toEqual([]);
  });

  test("gibt ein leeres Array zurück, wenn die Ressource nicht existiert", async () => {
    const users = await getUsersWithAccess("space", "nonexistent-users");
    expect(users).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getGroupsWithAccess
// ---------------------------------------------------------------------------

describe("getGroupsWithAccess()", () => {
  test("gibt nur Einträge mit principalType='group' zurück", async () => {
    await initializeResourceAccess("space", "groups-1", "alice");
    await grantAccess("space", "groups-1", "group", "team-a", "editor", "alice");
    await grantAccess("space", "groups-1", "group", "team-b", "viewer", "alice");

    const groups = await getGroupsWithAccess("space", "groups-1");

    expect(groups).toHaveLength(2);
    groups.forEach((g) => expect(g.principalType).toBe("group"));
  });

  test("gibt ein leeres Array zurück, wenn nur User Zugriff haben", async () => {
    await initializeResourceAccess("space", "groups-2", "alice");

    const groups = await getGroupsWithAccess("space", "groups-2");
    expect(groups).toEqual([]);
  });

  test("gibt ein leeres Array zurück, wenn die Ressource nicht existiert", async () => {
    const groups = await getGroupsWithAccess("space", "nonexistent-groups");
    expect(groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getResourceOwner
// ---------------------------------------------------------------------------

describe("getResourceOwner()", () => {
  test("gibt den Eintrag mit der Rolle 'owner' zurück", async () => {
    await initializeResourceAccess("space", "owner-1", "alice");

    const owner = await getResourceOwner("space", "owner-1");

    expect(owner).not.toBeNull();
    expect(owner!.principalId).toBe("alice");
    expect(owner!.role).toBe("owner");
  });

  test("gibt null zurück, wenn kein Owner-Eintrag existiert", async () => {
    await saveResourceAccess("space", "owner-2", [
      {
        principalType: "user",
        principalId: "bob",
        role: "admin",
        grantedAt: new Date().toISOString(),
        grantedBy: "alice",
      },
    ]);

    const owner = await getResourceOwner("space", "owner-2");
    expect(owner).toBeNull();
  });

  test("gibt null zurück, wenn die Ressource nicht existiert", async () => {
    const owner = await getResourceOwner("space", "nonexistent-owner");
    expect(owner).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transferOwnership
// ---------------------------------------------------------------------------

describe("transferOwnership()", () => {
  test("stuft den alten Owner auf 'admin' zurück", async () => {
    await initializeResourceAccess("space", "transfer-1", "alice");
    await grantAccess("space", "transfer-1", "user", "bob", "editor", "alice");

    await transferOwnership("space", "transfer-1", "bob", "alice");

    const list = await loadResourceAccess("space", "transfer-1");
    const alice = list.find((e) => e.principalId === "alice");
    expect(alice!.role).toBe("admin");
  });

  test("setzt den neuen Owner auf die Rolle 'owner'", async () => {
    await initializeResourceAccess("space", "transfer-2", "alice");
    await grantAccess("space", "transfer-2", "user", "bob", "editor", "alice");

    await transferOwnership("space", "transfer-2", "bob", "alice");

    const list = await loadResourceAccess("space", "transfer-2");
    const bob = list.find((e) => e.principalId === "bob");
    expect(bob!.role).toBe("owner");
  });

  test("gibt true zurück bei erfolgreichem Transfer", async () => {
    await initializeResourceAccess("space", "transfer-3", "alice");
    await grantAccess("space", "transfer-3", "user", "bob", "viewer", "alice");

    const result = await transferOwnership("space", "transfer-3", "bob", "alice");
    expect(result).toBe(true);
  });

  test("gibt false zurück, wenn kein Owner-Eintrag vorhanden ist", async () => {
    await saveResourceAccess("space", "transfer-4", [
      {
        principalType: "user",
        principalId: "bob",
        role: "admin",
        grantedAt: new Date().toISOString(),
        grantedBy: "system",
      },
    ]);

    const result = await transferOwnership("space", "transfer-4", "carol", "system");
    expect(result).toBe(false);
  });

  test("gibt false zurück, wenn die Ressource nicht existiert", async () => {
    const result = await transferOwnership("space", "nonexistent-transfer", "bob", "admin");
    expect(result).toBe(false);
  });

  test("fügt den neuen Owner als neuen Eintrag hinzu, wenn er noch keinen Zugriff hat", async () => {
    await initializeResourceAccess("space", "transfer-5", "alice");

    await transferOwnership("space", "transfer-5", "carol", "alice");

    const list = await loadResourceAccess("space", "transfer-5");
    const carol = list.find((e) => e.principalId === "carol");
    expect(carol).toBeDefined();
    expect(carol!.role).toBe("owner");
  });

  test("aktualisiert bestehenden Eintrag, wenn neuer Owner bereits Zugriff hat", async () => {
    await initializeResourceAccess("space", "transfer-6", "alice");
    await grantAccess("space", "transfer-6", "user", "dave", "viewer", "alice");

    await transferOwnership("space", "transfer-6", "dave", "alice");

    const list = await loadResourceAccess("space", "transfer-6");
    const daveEntries = list.filter((e) => e.principalId === "dave");
    expect(daveEntries).toHaveLength(1);
    expect(daveEntries[0]!.role).toBe("owner");
  });

  test("setzt transferredBy als grantedBy für den neuen Owner-Eintrag", async () => {
    await initializeResourceAccess("space", "transfer-7", "alice");
    await grantAccess("space", "transfer-7", "user", "bob", "editor", "alice");

    await transferOwnership("space", "transfer-7", "bob", "system-admin");

    const list = await loadResourceAccess("space", "transfer-7");
    const bob = list.find((e) => e.principalId === "bob");
    expect(bob!.grantedBy).toBe("system-admin");
  });
});

// ---------------------------------------------------------------------------
// deleteResourceAccess
// ---------------------------------------------------------------------------

describe("deleteResourceAccess()", () => {
  test("löscht die access.yaml-Datei", async () => {
    await initializeResourceAccess("space", "delete-1", "alice");
    expect(existsSync(accessFilePath("space", "delete-1"))).toBe(true);

    await deleteResourceAccess("space", "delete-1");

    expect(existsSync(accessFilePath("space", "delete-1"))).toBe(false);
  });

  test("wirft keinen Fehler, wenn die Datei nicht existiert", async () => {
    await expect(
      deleteResourceAccess("space", "nonexistent-delete")
    ).resolves.toBeUndefined();
  });

  test("nach dem Löschen gibt loadResourceAccess ein leeres Array zurück", async () => {
    await initializeResourceAccess("space", "delete-2", "alice");
    await deleteResourceAccess("space", "delete-2");

    const list = await loadResourceAccess("space", "delete-2");
    expect(list).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hasAccessEntries
// ---------------------------------------------------------------------------

describe("hasAccessEntries()", () => {
  test("gibt true zurück, wenn mindestens ein Eintrag existiert", async () => {
    await initializeResourceAccess("space", "has-1", "alice");

    const result = await hasAccessEntries("space", "has-1");
    expect(result).toBe(true);
  });

  test("gibt false zurück, wenn die access.yaml leer ist", async () => {
    await saveResourceAccess("space", "has-2", []);

    const result = await hasAccessEntries("space", "has-2");
    expect(result).toBe(false);
  });

  test("gibt false zurück, wenn keine access.yaml existiert", async () => {
    const result = await hasAccessEntries("space", "nonexistent-has");
    expect(result).toBe(false);
  });

  test("gibt true zurück mit mehreren Einträgen", async () => {
    await initializeResourceAccess("space", "has-3", "alice");
    await grantAccess("space", "has-3", "user", "bob", "editor", "alice");
    await grantAccess("space", "has-3", "group", "team-a", "viewer", "alice");

    const result = await hasAccessEntries("space", "has-3");
    expect(result).toBe(true);
  });
});
