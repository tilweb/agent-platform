/**
 * Tests for User Storage (backend/src/auth/storage.ts)
 *
 * All YAML persistence, path resolution and password hashing are mocked so
 * no real disk I/O or expensive argon2 computation takes place.
 * Mocks MUST be declared before the module under test is imported.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared in-memory store
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, any>();
const allIds = () => Array.from(memoryStore.keys());

// ---------------------------------------------------------------------------
// Module mocks — declared before dynamic import of the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/yamlStorage", () => ({
  createYamlStore: () => ({
    save: async (id: string, data: any) => {
      memoryStore.set(id, structuredClone(data));
    },
    load: async (id: string) =>
      memoryStore.has(id) ? structuredClone(memoryStore.get(id)) : null,
    listIds: async () => allIds(),
    delete: async (id: string) => {
      const had = memoryStore.has(id);
      memoryStore.delete(id);
      return had;
    },
    ensureDir: async () => {},
    filePath: (id: string) => `/tmp/${id}.yaml`,
  }),
  listYamlIds: async () => allIds(),
}));

mock.module("../../utils/paths", () => ({
  USERS_DIR: "/tmp/test-users",
  DATA_DIR: "/tmp/test-data",
}));

mock.module("../password", () => ({
  hashPassword: async (pw: string) => `hashed_${pw}`,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  saveUser,
  loadUser,
  findUserByUsername,
  findUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  hasUsers,
} = await import("../storage");

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("User Storage", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  // -------------------------------------------------------------------------
  // createUser
  // -------------------------------------------------------------------------

  describe("createUser()", () => {
    test("erstellt einen Benutzer mit gehashetem Passwort", async () => {
      const user = await createUser({
        username: "alice",
        password: "geheim123",
        email: "alice@example.com",
      });

      expect(user.passwordHash).toBe("hashed_geheim123");
    });

    test("setzt displayName auf username wenn nicht angegeben", async () => {
      const user = await createUser({ username: "bob", password: "pw" });

      expect(user.displayName).toBe("bob");
    });

    test("übernimmt explizit angegebenen displayName", async () => {
      const user = await createUser({
        username: "charlie",
        password: "pw",
        displayName: "Charlie Brown",
      });

      expect(user.displayName).toBe("Charlie Brown");
    });

    test("erster Benutzer erhält automatisch die Rolle 'admin'", async () => {
      const user = await createUser({ username: "admin", password: "pw" });

      expect(user.role).toBe("admin");
    });

    test("zweiter Benutzer erhält automatisch die Rolle 'user'", async () => {
      await createUser({ username: "first", password: "pw1" });
      const second = await createUser({ username: "second", password: "pw2" });

      expect(second.role).toBe("user");
    });

    test("explizit übergebene Rolle 'admin' wird für nachfolgende Benutzer respektiert", async () => {
      await createUser({ username: "first", password: "pw1" });
      const second = await createUser({
        username: "second",
        password: "pw2",
        role: "admin",
      });

      expect(second.role).toBe("admin");
    });

    test("explizit übergebene Rolle 'user' wird für den ersten Benutzer respektiert", async () => {
      const user = await createUser({
        username: "first",
        password: "pw1",
        role: "user",
      });

      expect(user.role).toBe("user");
    });

    test("generiert eine eindeutige ID im erwarteten Format", async () => {
      const user = await createUser({ username: "alice", password: "pw" });

      expect(user.id).toMatch(/^user_\d+_[a-z0-9]+$/);
    });

    test("setzt isActive auf true", async () => {
      const user = await createUser({ username: "alice", password: "pw" });

      expect(user.isActive).toBe(true);
    });

    test("setzt createdAt und updatedAt auf gültige ISO-Datums-Strings", async () => {
      const before = new Date().toISOString();
      const user = await createUser({ username: "alice", password: "pw" });
      const after = new Date().toISOString();

      expect(user.createdAt >= before).toBe(true);
      expect(user.createdAt <= after).toBe(true);
      expect(user.updatedAt).toBe(user.createdAt);
    });

    test("speichert den Benutzer dauerhaft im Store", async () => {
      const user = await createUser({ username: "alice", password: "pw" });
      const loaded = await loadUser(user.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.username).toBe("alice");
    });
  });

  // -------------------------------------------------------------------------
  // loadUser
  // -------------------------------------------------------------------------

  describe("loadUser()", () => {
    test("gibt den gespeicherten Benutzer zurück", async () => {
      const created = await createUser({ username: "alice", password: "pw" });
      const loaded = await loadUser(created.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(created.id);
      expect(loaded!.username).toBe("alice");
    });

    test("gibt null zurück wenn Benutzer nicht existiert", async () => {
      const result = await loadUser("nonexistent-user-id");

      expect(result).toBeNull();
    });

    test("setzt fehlende Rolle auf den Standard 'user'", async () => {
      // Speichere direkt einen Benutzer ohne role-Feld (Legacy-Daten)
      const legacyUser: any = {
        id: "legacy_user_1",
        username: "legacy",
        passwordHash: "hashed_pw",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        isActive: true,
        // role fehlt absichtlich
      };
      memoryStore.set("legacy_user_1", structuredClone(legacyUser));

      const loaded = await loadUser("legacy_user_1");

      expect(loaded).not.toBeNull();
      expect(loaded!.role).toBe("user");
    });

    test("behält vorhandene Rolle bei", async () => {
      const created = await createUser({
        username: "admin",
        password: "pw",
        role: "admin",
      });
      const loaded = await loadUser(created.id);

      expect(loaded!.role).toBe("admin");
    });
  });

  // -------------------------------------------------------------------------
  // saveUser + loadUser (Round-Trip)
  // -------------------------------------------------------------------------

  describe("saveUser() + loadUser() Round-Trip", () => {
    test("gespeicherter Benutzer wird korrekt wieder geladen", async () => {
      const user = {
        id: "user_roundtrip_1",
        username: "roundtrip",
        email: "roundtrip@example.com",
        displayName: "Round Trip",
        passwordHash: "hashed_secret",
        role: "user" as const,
        createdAt: "2024-06-01T12:00:00.000Z",
        updatedAt: "2024-06-01T12:00:00.000Z",
        isActive: true,
      };

      await saveUser(user);
      const loaded = await loadUser(user.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(user.id);
      expect(loaded!.username).toBe(user.username);
      expect(loaded!.email).toBe(user.email);
      expect(loaded!.displayName).toBe(user.displayName);
      expect(loaded!.passwordHash).toBe(user.passwordHash);
      expect(loaded!.role).toBe(user.role);
      expect(loaded!.isActive).toBe(user.isActive);
    });

    test("Überschreiben eines vorhandenen Benutzers aktualisiert die Daten", async () => {
      const user = {
        id: "user_roundtrip_2",
        username: "original",
        passwordHash: "hashed_pw",
        role: "user" as const,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        isActive: true,
      };
      await saveUser(user);

      const updated = { ...user, username: "updated", isActive: false };
      await saveUser(updated);

      const loaded = await loadUser(user.id);
      expect(loaded!.username).toBe("updated");
      expect(loaded!.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // findUserByUsername
  // -------------------------------------------------------------------------

  describe("findUserByUsername()", () => {
    test("findet einen Benutzer anhand des Benutzernamens", async () => {
      const created = await createUser({ username: "alice", password: "pw" });
      const found = await findUserByUsername("alice");

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    test("Suche ist Groß-/Kleinschreibungs-unabhängig", async () => {
      await createUser({ username: "Alice", password: "pw" });

      const found = await findUserByUsername("alice");
      expect(found).not.toBeNull();
      expect(found!.username).toBe("Alice");
    });

    test("Suche mit Großbuchstaben findet Benutzer mit Kleinbuchstaben", async () => {
      await createUser({ username: "bob", password: "pw" });

      const found = await findUserByUsername("BOB");
      expect(found).not.toBeNull();
      expect(found!.username).toBe("bob");
    });

    test("gibt null zurück wenn kein Benutzer mit dem Namen existiert", async () => {
      await createUser({ username: "charlie", password: "pw" });

      const found = await findUserByUsername("diana");
      expect(found).toBeNull();
    });

    test("gibt null zurück wenn der Store leer ist", async () => {
      const found = await findUserByUsername("nobody");

      expect(found).toBeNull();
    });

    test("findet den richtigen Benutzer unter mehreren", async () => {
      await createUser({ username: "alpha", password: "pw1" });
      await createUser({ username: "beta", password: "pw2" });
      await createUser({ username: "gamma", password: "pw3" });

      const found = await findUserByUsername("beta");
      expect(found).not.toBeNull();
      expect(found!.username).toBe("beta");
    });
  });

  // -------------------------------------------------------------------------
  // findUserByEmail
  // -------------------------------------------------------------------------

  describe("findUserByEmail()", () => {
    test("findet einen Benutzer anhand der E-Mail-Adresse", async () => {
      const created = await createUser({
        username: "alice",
        password: "pw",
        email: "alice@example.com",
      });

      const found = await findUserByEmail("alice@example.com");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    test("Suche ist Groß-/Kleinschreibungs-unabhängig", async () => {
      await createUser({
        username: "alice",
        password: "pw",
        email: "Alice@Example.COM",
      });

      const found = await findUserByEmail("alice@example.com");
      expect(found).not.toBeNull();
      expect(found!.email).toBe("Alice@Example.COM");
    });

    test("gibt null zurück wenn keine E-Mail-Adresse übereinstimmt", async () => {
      await createUser({
        username: "alice",
        password: "pw",
        email: "alice@example.com",
      });

      const found = await findUserByEmail("unknown@example.com");
      expect(found).toBeNull();
    });

    test("gibt null zurück wenn kein Benutzer eine E-Mail hat", async () => {
      await createUser({ username: "noemail", password: "pw" });

      const found = await findUserByEmail("noemail@example.com");
      expect(found).toBeNull();
    });

    test("gibt null zurück wenn der Store leer ist", async () => {
      const found = await findUserByEmail("empty@example.com");

      expect(found).toBeNull();
    });

    test("überspringt Benutzer ohne E-Mail-Feld und findet trotzdem den richtigen", async () => {
      await createUser({ username: "noemail", password: "pw1" });
      const target = await createUser({
        username: "hasemail",
        password: "pw2",
        email: "target@example.com",
      });

      const found = await findUserByEmail("target@example.com");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(target.id);
    });
  });

  // -------------------------------------------------------------------------
  // updateUser
  // -------------------------------------------------------------------------

  describe("updateUser()", () => {
    test("führt Updates zusammen und gibt den aktualisierten Benutzer zurück", async () => {
      const created = await createUser({
        username: "alice",
        password: "pw",
        email: "alice@example.com",
      });

      const updated = await updateUser(created.id, {
        displayName: "Alice Wonderland",
        email: "new@example.com",
      });

      expect(updated).not.toBeNull();
      expect(updated!.displayName).toBe("Alice Wonderland");
      expect(updated!.email).toBe("new@example.com");
    });

    test("unveränderte Felder bleiben erhalten", async () => {
      const created = await createUser({
        username: "alice",
        password: "pw",
        email: "alice@example.com",
      });

      const updated = await updateUser(created.id, {
        displayName: "New Name",
      });

      expect(updated!.username).toBe("alice");
      expect(updated!.email).toBe("alice@example.com");
      expect(updated!.passwordHash).toBe(created.passwordHash);
    });

    test("aktualisiert den updatedAt-Zeitstempel", async () => {
      const created = await createUser({ username: "alice", password: "pw" });
      const originalUpdatedAt = created.updatedAt;

      // Kurze Pause, damit sich der Zeitstempel ändern kann
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updated = await updateUser(created.id, { displayName: "New" });

      expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
      expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
    });

    test("persistiert die Änderungen im Store", async () => {
      const created = await createUser({ username: "alice", password: "pw" });

      await updateUser(created.id, { displayName: "Updated Alice" });
      const loaded = await loadUser(created.id);

      expect(loaded!.displayName).toBe("Updated Alice");
    });

    test("gibt null zurück wenn der Benutzer nicht existiert", async () => {
      const result = await updateUser("nonexistent-id", {
        displayName: "Ghost",
      });

      expect(result).toBeNull();
    });

    test("isActive kann auf false gesetzt werden", async () => {
      const created = await createUser({ username: "alice", password: "pw" });

      const updated = await updateUser(created.id, { isActive: false });

      expect(updated!.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // deleteUser
  // -------------------------------------------------------------------------

  describe("deleteUser()", () => {
    test("löscht einen vorhandenen Benutzer und gibt true zurück", async () => {
      const created = await createUser({ username: "alice", password: "pw" });

      const result = await deleteUser(created.id);

      expect(result).toBe(true);
    });

    test("Benutzer ist nach dem Löschen nicht mehr ladbar", async () => {
      const created = await createUser({ username: "alice", password: "pw" });
      await deleteUser(created.id);

      const loaded = await loadUser(created.id);
      expect(loaded).toBeNull();
    });

    test("gibt false zurück wenn der Benutzer nicht existiert", async () => {
      const result = await deleteUser("nonexistent-id");

      expect(result).toBe(false);
    });

    test("löscht nur den Ziel-Benutzer, andere bleiben erhalten", async () => {
      const alice = await createUser({ username: "alice", password: "pw1" });
      const bob = await createUser({ username: "bob", password: "pw2" });

      await deleteUser(alice.id);

      const loadedBob = await loadUser(bob.id);
      expect(loadedBob).not.toBeNull();
      expect(loadedBob!.username).toBe("bob");
    });
  });

  // -------------------------------------------------------------------------
  // listUsers
  // -------------------------------------------------------------------------

  describe("listUsers()", () => {
    test("gibt alle gespeicherten Benutzer zurück", async () => {
      await createUser({ username: "alice", password: "pw1" });
      await createUser({ username: "bob", password: "pw2" });
      await createUser({ username: "charlie", password: "pw3" });

      const users = await listUsers();

      expect(users).toHaveLength(3);
      const usernames = users.map((u) => u.username);
      expect(usernames).toContain("alice");
      expect(usernames).toContain("bob");
      expect(usernames).toContain("charlie");
    });

    test("gibt eine leere Liste zurück wenn keine Benutzer existieren", async () => {
      const users = await listUsers();

      expect(users).toEqual([]);
    });

    test("gibt einen einzelnen Benutzer korrekt zurück", async () => {
      const created = await createUser({ username: "solo", password: "pw" });

      const users = await listUsers();

      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe(created.id);
    });

    test("wendet Standardrolle auf Legacy-Benutzer ohne Rolle an", async () => {
      const legacyUser: any = {
        id: "legacy_list_user",
        username: "legacy",
        passwordHash: "hashed_pw",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        isActive: true,
        // role fehlt absichtlich
      };
      memoryStore.set("legacy_list_user", structuredClone(legacyUser));

      const users = await listUsers();

      expect(users).toHaveLength(1);
      expect(users[0]!.role).toBe("user");
    });
  });

  // -------------------------------------------------------------------------
  // hasUsers
  // -------------------------------------------------------------------------

  describe("hasUsers()", () => {
    test("gibt true zurück wenn mindestens ein Benutzer existiert", async () => {
      await createUser({ username: "alice", password: "pw" });

      const result = await hasUsers();

      expect(result).toBe(true);
    });

    test("gibt false zurück wenn keine Benutzer existieren", async () => {
      const result = await hasUsers();

      expect(result).toBe(false);
    });

    test("gibt true zurück wenn mehrere Benutzer existieren", async () => {
      await createUser({ username: "alice", password: "pw1" });
      await createUser({ username: "bob", password: "pw2" });

      const result = await hasUsers();

      expect(result).toBe(true);
    });

    test("gibt false zurück nachdem alle Benutzer gelöscht wurden", async () => {
      const user = await createUser({ username: "alice", password: "pw" });
      await deleteUser(user.id);

      const result = await hasUsers();

      expect(result).toBe(false);
    });
  });
});
