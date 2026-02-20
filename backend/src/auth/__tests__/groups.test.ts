/**
 * Tests for User Groups Storage (backend/src/auth/groups.ts)
 *
 * Real filesystem I/O is used but redirected to a stable /tmp subdirectory
 * via a mock of '../utils/paths'. The directory contents are wiped in
 * beforeEach/afterEach so every test starts with an empty store.
 *
 * IMPORTANT: mock.module() must be called BEFORE the module under test is
 * imported. Because the module captures GROUPS_DIR as a named import at
 * import time, the mock path must be fixed (not dynamic) and stable for the
 * entire test run.
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { readdir, unlink, mkdir } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Stable temp directory — fixed path set before import
// ---------------------------------------------------------------------------

const TEST_GROUPS_DIR = "/tmp/bun-test-groups";

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before dynamic import of the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  GROUPS_DIR: TEST_GROUPS_DIR,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  saveGroup,
  loadGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  addGroupMember,
  removeGroupMember,
  getUserGroups,
  isUserInGroup,
  isUserInAnyGroup,
} = await import("../groups");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid UserGroup for saveGroup round-trip tests. */
function makeGroup(overrides: Partial<import("../groups").UserGroup> = {}): import("../groups").UserGroup {
  return {
    id: "group_test_abc1234",
    name: "Test Group",
    memberIds: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Remove all .yaml (and other) files from the test directory. */
async function clearGroupsDir(): Promise<void> {
  await mkdir(TEST_GROUPS_DIR, { recursive: true });
  const files = await readdir(TEST_GROUPS_DIR);
  await Promise.all(files.map((f) => unlink(join(TEST_GROUPS_DIR, f))));
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearGroupsDir();
});

afterEach(async () => {
  await clearGroupsDir();
});

// ---------------------------------------------------------------------------
// saveGroup + loadGroup (Round-Trip)
// ---------------------------------------------------------------------------

describe("saveGroup() + loadGroup() Round-Trip", () => {
  test("speichert eine Gruppe und liest sie korrekt zurück", async () => {
    const group = makeGroup({ id: "group_roundtrip_1", name: "Round Trip" });

    await saveGroup(group);
    const loaded = await loadGroup("group_roundtrip_1");

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("group_roundtrip_1");
    expect(loaded!.name).toBe("Round Trip");
    expect(loaded!.memberIds).toEqual([]);
    expect(loaded!.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(loaded!.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  test("speichert alle optionalen Felder korrekt", async () => {
    const group = makeGroup({
      id: "group_opts_1",
      name: "Opts Group",
      description: "A description",
      color: "#ff0000",
      createdBy: "user_admin",
    });

    await saveGroup(group);
    const loaded = await loadGroup("group_opts_1");

    expect(loaded!.description).toBe("A description");
    expect(loaded!.color).toBe("#ff0000");
    expect(loaded!.createdBy).toBe("user_admin");
  });

  test("überschreiben einer vorhandenen Gruppe aktualisiert die Daten", async () => {
    const group = makeGroup({ id: "group_overwrite_1", name: "Original" });
    await saveGroup(group);

    const updated = { ...group, name: "Updated" };
    await saveGroup(updated);

    const loaded = await loadGroup("group_overwrite_1");
    expect(loaded!.name).toBe("Updated");
  });
});

// ---------------------------------------------------------------------------
// loadGroup
// ---------------------------------------------------------------------------

describe("loadGroup()", () => {
  test("gibt null zurück wenn Gruppe nicht existiert", async () => {
    const result = await loadGroup("nonexistent-group-id");

    expect(result).toBeNull();
  });

  test("parst memberIds korrekt als Array", async () => {
    const group = makeGroup({
      id: "group_members_1",
      memberIds: ["user_a", "user_b", "user_c"],
    });
    await saveGroup(group);

    const loaded = await loadGroup("group_members_1");

    expect(loaded!.memberIds).toEqual(["user_a", "user_b", "user_c"]);
  });
});

// ---------------------------------------------------------------------------
// createGroup
// ---------------------------------------------------------------------------

describe("createGroup()", () => {
  test("generiert eine ID im erwarteten Format", async () => {
    const group = await createGroup({ name: "Neue Gruppe" });

    expect(group.id).toMatch(/^group_\d+_[a-z0-9]+$/);
  });

  test("setzt createdAt und updatedAt auf gültige ISO-Zeitstempel", async () => {
    const before = new Date().toISOString();
    const group = await createGroup({ name: "Zeitstempel Gruppe" });
    const after = new Date().toISOString();

    expect(group.createdAt >= before).toBe(true);
    expect(group.createdAt <= after).toBe(true);
    expect(group.updatedAt).toBe(group.createdAt);
  });

  test("setzt name korrekt", async () => {
    const group = await createGroup({ name: "Meine Gruppe" });

    expect(group.name).toBe("Meine Gruppe");
  });

  test("setzt memberIds auf leeres Array wenn nicht angegeben", async () => {
    const group = await createGroup({ name: "Leere Gruppe" });

    expect(group.memberIds).toEqual([]);
  });

  test("übernimmt explizit angegebene memberIds", async () => {
    const group = await createGroup({
      name: "Gruppe mit Mitgliedern",
      memberIds: ["user_x", "user_y"],
    });

    expect(group.memberIds).toEqual(["user_x", "user_y"]);
  });

  test("übernimmt description und color", async () => {
    const group = await createGroup({
      name: "Farb-Gruppe",
      description: "Eine bunte Gruppe",
      color: "#0000ff",
    });

    expect(group.description).toBe("Eine bunte Gruppe");
    expect(group.color).toBe("#0000ff");
  });

  test("übernimmt createdBy wenn angegeben", async () => {
    const group = await createGroup({ name: "Admin-Gruppe" }, "user_admin_001");

    expect(group.createdBy).toBe("user_admin_001");
  });

  test("lässt createdBy undefined wenn nicht angegeben", async () => {
    const group = await createGroup({ name: "Anon-Gruppe" });

    expect(group.createdBy).toBeUndefined();
  });

  test("persistiert die Gruppe auf dem Dateisystem", async () => {
    const group = await createGroup({ name: "Persistenz-Gruppe" });

    const loaded = await loadGroup(group.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Persistenz-Gruppe");
  });

  test("jede Gruppe erhält eine eindeutige ID", async () => {
    const g1 = await createGroup({ name: "Gruppe 1" });
    const g2 = await createGroup({ name: "Gruppe 2" });

    expect(g1.id).not.toBe(g2.id);
  });
});

// ---------------------------------------------------------------------------
// updateGroup
// ---------------------------------------------------------------------------

describe("updateGroup()", () => {
  test("führt Updates zusammen und gibt die aktualisierte Gruppe zurück", async () => {
    const group = await createGroup({ name: "Original", description: "Alt" });

    const updated = await updateGroup(group.id, { name: "Aktualisiert", description: "Neu" });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Aktualisiert");
    expect(updated!.description).toBe("Neu");
  });

  test("unveränderte Felder bleiben erhalten", async () => {
    const group = await createGroup(
      { name: "Original", color: "#aabbcc", memberIds: ["user_1"] },
      "creator_1"
    );

    const updated = await updateGroup(group.id, { name: "Geändert" });

    expect(updated!.color).toBe("#aabbcc");
    expect(updated!.memberIds).toEqual(["user_1"]);
    expect(updated!.createdAt).toBe(group.createdAt);
    expect(updated!.createdBy).toBe("creator_1");
  });

  test("aktualisiert den updatedAt-Zeitstempel", async () => {
    const group = await createGroup({ name: "Test" });
    const originalUpdatedAt = group.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await updateGroup(group.id, { name: "Neuer Name" });

    expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test("verändert createdAt nicht", async () => {
    const group = await createGroup({ name: "Test" });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await updateGroup(group.id, { name: "Neuer Name" });

    expect(updated!.createdAt).toBe(group.createdAt);
  });

  test("persistiert die Änderungen", async () => {
    const group = await createGroup({ name: "Original" });

    await updateGroup(group.id, { name: "Gespeichert" });

    const loaded = await loadGroup(group.id);
    expect(loaded!.name).toBe("Gespeichert");
  });

  test("gibt null zurück wenn Gruppe nicht existiert", async () => {
    const result = await updateGroup("nonexistent-id", { name: "Ghost" });

    expect(result).toBeNull();
  });

  test("aktualisiert memberIds korrekt", async () => {
    const group = await createGroup({ name: "Gruppe" });

    const updated = await updateGroup(group.id, { memberIds: ["user_a", "user_b"] });

    expect(updated!.memberIds).toEqual(["user_a", "user_b"]);
  });
});

// ---------------------------------------------------------------------------
// deleteGroup
// ---------------------------------------------------------------------------

describe("deleteGroup()", () => {
  test("löscht eine vorhandene Gruppe und gibt true zurück", async () => {
    const group = await createGroup({ name: "Zu löschen" });

    const result = await deleteGroup(group.id);

    expect(result).toBe(true);
  });

  test("Gruppe ist nach dem Löschen nicht mehr ladbar", async () => {
    const group = await createGroup({ name: "Zu löschen" });
    await deleteGroup(group.id);

    const loaded = await loadGroup(group.id);
    expect(loaded).toBeNull();
  });

  test("gibt false zurück wenn Gruppe nicht existiert", async () => {
    const result = await deleteGroup("nonexistent-group-id");

    expect(result).toBe(false);
  });

  test("löscht nur die Ziel-Gruppe, andere bleiben erhalten", async () => {
    const g1 = await createGroup({ name: "Gruppe 1" });
    const g2 = await createGroup({ name: "Gruppe 2" });

    await deleteGroup(g1.id);

    const loaded = await loadGroup(g2.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Gruppe 2");
  });
});

// ---------------------------------------------------------------------------
// listGroups
// ---------------------------------------------------------------------------

describe("listGroups()", () => {
  test("gibt eine leere Liste zurück wenn keine Gruppen existieren", async () => {
    const groups = await listGroups();

    expect(groups).toEqual([]);
  });

  test("gibt alle vorhandenen Gruppen zurück", async () => {
    await createGroup({ name: "Alpha" });
    await createGroup({ name: "Beta" });
    await createGroup({ name: "Gamma" });

    const groups = await listGroups();

    expect(groups).toHaveLength(3);
    const names = groups.map((g) => g.name);
    expect(names).toContain("Alpha");
    expect(names).toContain("Beta");
    expect(names).toContain("Gamma");
  });

  test("gibt Gruppen alphabetisch nach Name sortiert zurück", async () => {
    await createGroup({ name: "Zebra" });
    await createGroup({ name: "Apfel" });
    await createGroup({ name: "Mitte" });

    const groups = await listGroups();

    expect(groups[0]!.name).toBe("Apfel");
    expect(groups[1]!.name).toBe("Mitte");
    expect(groups[2]!.name).toBe("Zebra");
  });

  test("gibt eine einzelne Gruppe korrekt zurück", async () => {
    const created = await createGroup({ name: "Solo" });

    const groups = await listGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(created.id);
  });

  test("ignoriert Nicht-YAML-Dateien im Verzeichnis", async () => {
    await createGroup({ name: "Echte Gruppe" });
    await Bun.write(join(TEST_GROUPS_DIR, "not-a-group.txt"), "ignore me");

    const groups = await listGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe("Echte Gruppe");
  });
});

// ---------------------------------------------------------------------------
// addGroupMember
// ---------------------------------------------------------------------------

describe("addGroupMember()", () => {
  test("fügt einen Benutzer zur Gruppe hinzu", async () => {
    const group = await createGroup({ name: "Gruppe" });

    const updated = await addGroupMember(group.id, "user_new");

    expect(updated).not.toBeNull();
    expect(updated!.memberIds).toContain("user_new");
  });

  test("fügt mehrere verschiedene Benutzer nacheinander hinzu", async () => {
    const group = await createGroup({ name: "Gruppe" });

    await addGroupMember(group.id, "user_a");
    const updated = await addGroupMember(group.id, "user_b");

    expect(updated!.memberIds).toContain("user_a");
    expect(updated!.memberIds).toContain("user_b");
    expect(updated!.memberIds).toHaveLength(2);
  });

  test("verhindert doppelte Einträge — kein Duplikat wenn Benutzer bereits Mitglied ist", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_existing"],
    });

    const updated = await addGroupMember(group.id, "user_existing");

    expect(updated!.memberIds).toHaveLength(1);
    expect(updated!.memberIds).toEqual(["user_existing"]);
  });

  test("aktualisiert updatedAt beim Hinzufügen eines neuen Mitglieds", async () => {
    const group = await createGroup({ name: "Gruppe" });
    const originalUpdatedAt = group.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await addGroupMember(group.id, "user_new");

    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test("aktualisiert updatedAt NICHT wenn Benutzer bereits Mitglied ist", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_existing"],
    });
    const originalUpdatedAt = group.updatedAt;

    const updated = await addGroupMember(group.id, "user_existing");

    expect(updated!.updatedAt).toBe(originalUpdatedAt);
  });

  test("persistiert das neue Mitglied", async () => {
    const group = await createGroup({ name: "Gruppe" });

    await addGroupMember(group.id, "user_persisted");

    const loaded = await loadGroup(group.id);
    expect(loaded!.memberIds).toContain("user_persisted");
  });

  test("gibt null zurück wenn Gruppe nicht existiert", async () => {
    const result = await addGroupMember("nonexistent-group", "user_x");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// removeGroupMember
// ---------------------------------------------------------------------------

describe("removeGroupMember()", () => {
  test("entfernt einen vorhandenen Benutzer aus der Gruppe", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_a", "user_b"],
    });

    const updated = await removeGroupMember(group.id, "user_a");

    expect(updated).not.toBeNull();
    expect(updated!.memberIds).not.toContain("user_a");
    expect(updated!.memberIds).toContain("user_b");
  });

  test("aktualisiert updatedAt beim Entfernen eines Mitglieds", async () => {
    const group = await createGroup({ name: "Gruppe", memberIds: ["user_a"] });
    const originalUpdatedAt = group.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await removeGroupMember(group.id, "user_a");

    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test("ändert updatedAt NICHT wenn Benutzer nicht in der Gruppe war", async () => {
    const group = await createGroup({ name: "Gruppe", memberIds: ["user_a"] });
    const originalUpdatedAt = group.updatedAt;

    const updated = await removeGroupMember(group.id, "user_not_member");

    expect(updated!.updatedAt).toBe(originalUpdatedAt);
  });

  test("lässt memberIds leer wenn letztes Mitglied entfernt wird", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_only"],
    });

    const updated = await removeGroupMember(group.id, "user_only");

    expect(updated!.memberIds).toEqual([]);
  });

  test("persistiert die Entfernung", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_a", "user_b"],
    });

    await removeGroupMember(group.id, "user_a");

    const loaded = await loadGroup(group.id);
    expect(loaded!.memberIds).not.toContain("user_a");
    expect(loaded!.memberIds).toContain("user_b");
  });

  test("gibt null zurück wenn Gruppe nicht existiert", async () => {
    const result = await removeGroupMember("nonexistent-group", "user_x");

    expect(result).toBeNull();
  });

  test("ignoriert das Entfernen eines nicht vorhandenen Benutzers und gibt die Gruppe zurück", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_a"],
    });

    const updated = await removeGroupMember(group.id, "user_not_member");

    expect(updated).not.toBeNull();
    expect(updated!.memberIds).toEqual(["user_a"]);
  });
});

// ---------------------------------------------------------------------------
// getUserGroups
// ---------------------------------------------------------------------------

describe("getUserGroups()", () => {
  test("gibt alle Gruppen zurück in denen der Benutzer Mitglied ist", async () => {
    const g1 = await createGroup({
      name: "Gruppe A",
      memberIds: ["user_target", "user_other"],
    });
    const g2 = await createGroup({ name: "Gruppe B", memberIds: ["user_target"] });
    await createGroup({ name: "Gruppe C", memberIds: ["user_other"] });

    const groups = await getUserGroups("user_target");

    expect(groups).toHaveLength(2);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain(g1.id);
    expect(ids).toContain(g2.id);
  });

  test("gibt eine leere Liste zurück wenn Benutzer in keiner Gruppe ist", async () => {
    await createGroup({ name: "Gruppe", memberIds: ["user_other"] });

    const groups = await getUserGroups("user_nobody");

    expect(groups).toEqual([]);
  });

  test("gibt eine leere Liste zurück wenn keine Gruppen existieren", async () => {
    const groups = await getUserGroups("user_x");

    expect(groups).toEqual([]);
  });

  test("gibt Gruppen alphabetisch nach Name sortiert zurück", async () => {
    await createGroup({ name: "Zeta", memberIds: ["user_target"] });
    await createGroup({ name: "Alpha", memberIds: ["user_target"] });

    const groups = await getUserGroups("user_target");

    expect(groups[0]!.name).toBe("Alpha");
    expect(groups[1]!.name).toBe("Zeta");
  });
});

// ---------------------------------------------------------------------------
// isUserInGroup
// ---------------------------------------------------------------------------

describe("isUserInGroup()", () => {
  test("gibt true zurück wenn Benutzer Mitglied der Gruppe ist", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_member"],
    });

    const result = await isUserInGroup("user_member", group.id);

    expect(result).toBe(true);
  });

  test("gibt false zurück wenn Benutzer nicht Mitglied der Gruppe ist", async () => {
    const group = await createGroup({
      name: "Gruppe",
      memberIds: ["user_other"],
    });

    const result = await isUserInGroup("user_notmember", group.id);

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn Gruppe nicht existiert", async () => {
    const result = await isUserInGroup("user_x", "nonexistent-group-id");

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn Gruppe keine Mitglieder hat", async () => {
    const group = await createGroup({ name: "Leere Gruppe" });

    const result = await isUserInGroup("user_x", group.id);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isUserInAnyGroup
// ---------------------------------------------------------------------------

describe("isUserInAnyGroup()", () => {
  test("gibt true zurück wenn Benutzer in mindestens einer der angegebenen Gruppen ist", async () => {
    const g1 = await createGroup({ name: "Gruppe 1", memberIds: ["user_a"] });
    const g2 = await createGroup({ name: "Gruppe 2", memberIds: ["user_b"] });

    const result = await isUserInAnyGroup("user_a", [g1.id, g2.id]);

    expect(result).toBe(true);
  });

  test("gibt true zurück wenn Benutzer in der letzten der angegebenen Gruppen ist", async () => {
    const g1 = await createGroup({ name: "Gruppe 1", memberIds: ["user_other"] });
    const g2 = await createGroup({ name: "Gruppe 2", memberIds: ["user_target"] });

    const result = await isUserInAnyGroup("user_target", [g1.id, g2.id]);

    expect(result).toBe(true);
  });

  test("gibt false zurück wenn Benutzer in keiner der angegebenen Gruppen ist", async () => {
    const g1 = await createGroup({ name: "Gruppe 1", memberIds: ["user_other"] });
    const g2 = await createGroup({ name: "Gruppe 2", memberIds: ["user_other2"] });

    const result = await isUserInAnyGroup("user_nobody", [g1.id, g2.id]);

    expect(result).toBe(false);
  });

  test("gibt false zurück bei leerer Gruppen-ID-Liste", async () => {
    const result = await isUserInAnyGroup("user_x", []);

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn alle angegebenen Gruppen nicht existieren", async () => {
    const result = await isUserInAnyGroup("user_x", [
      "nonexistent-1",
      "nonexistent-2",
    ]);

    expect(result).toBe(false);
  });

  test("gibt true zurück wenn Benutzer in allen angegebenen Gruppen ist", async () => {
    const g1 = await createGroup({
      name: "Gruppe 1",
      memberIds: ["user_multi"],
    });
    const g2 = await createGroup({
      name: "Gruppe 2",
      memberIds: ["user_multi"],
    });

    const result = await isUserInAnyGroup("user_multi", [g1.id, g2.id]);

    expect(result).toBe(true);
  });
});
