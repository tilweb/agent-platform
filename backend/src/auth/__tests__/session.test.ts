/**
 * Tests for Session Management (backend/src/auth/session.ts)
 *
 * yamlStorage and paths are mocked at module level so no real disk I/O occurs.
 * The module-level sessionCache is implicitly reset between test groups by
 * calling deleteSession / deleteUserSessions which remove entries from cache.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared in-memory store (replaces YAML file system)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, any>();

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../utils/yamlStorage", () => ({
  createYamlStore: () => ({
    save: async (id: string, data: any) => {
      memoryStore.set(id, structuredClone(data));
    },
    load: async (id: string) =>
      memoryStore.has(id) ? structuredClone(memoryStore.get(id)) : null,
    listIds: async () => Array.from(memoryStore.keys()),
    delete: async (id: string) => {
      const had = memoryStore.has(id);
      memoryStore.delete(id);
      return had;
    },
    ensureDir: async () => {},
    filePath: (id: string) => `/tmp/test/${id}.yaml`,
  }),
  loadYaml: async () => null,
  deleteYaml: async () => false,
}));

mock.module("../../utils/paths", () => ({
  SESSIONS_DIR: "/tmp/test-sessions",
  DATA_DIR: "/tmp/test-data",
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  createSession,
  getSession,
  validateSession,
  deleteSession,
  extendSession,
  deleteUserSessions,
  cleanupExpiredSessions,
  getUserSessions,
} = await import("../session");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeUser(id = "user_001"): import("../types").User {
  return {
    id,
    username: "testuser",
    email: "test@example.com",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$salt$hash",
    role: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };
}

/** Schreibt eine Session direkt in den Store mit einem vergangenen Ablaufdatum. */
function storeExpiredSession(id: string, userId: string): void {
  const past = new Date(Date.now() - 1000).toISOString();
  memoryStore.set(id, {
    id,
    userId,
    createdAt: new Date(Date.now() - 10_000).toISOString(),
    expiresAt: past,
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("createSession", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("gibt eine Session mit einer ID zurück", async () => {
    const session = await createSession(makeUser());
    expect(session.id).toBeDefined();
    expect(typeof session.id).toBe("string");
  });

  test("Session-ID ist ein 64-stelliger Hex-String", async () => {
    const session = await createSession(makeUser());
    expect(session.id).toMatch(/^[0-9a-f]{64}$/);
  });

  test("jede Session erhält eine eindeutige ID", async () => {
    const s1 = await createSession(makeUser());
    const s2 = await createSession(makeUser());
    expect(s1.id).not.toBe(s2.id);
  });

  test("setzt die userId des übergebenen Users", async () => {
    const user = makeUser("user_42");
    const session = await createSession(user);
    expect(session.userId).toBe("user_42");
  });

  test("setzt createdAt als validen ISO-Zeitstempel", async () => {
    const before = new Date().toISOString();
    const session = await createSession(makeUser());
    const after = new Date().toISOString();
    expect(session.createdAt >= before).toBe(true);
    expect(session.createdAt <= after).toBe(true);
  });

  test("setzt expiresAt in der Zukunft (mindestens 1 Sekunde nach jetzt)", async () => {
    const session = await createSession(makeUser());
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test("expiresAt liegt ca. 3 Tage nach createdAt", async () => {
    const session = await createSession(makeUser());
    const diff =
      new Date(session.expiresAt).getTime() -
      new Date(session.createdAt).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    // Toleranz: ± 1 Sekunde
    expect(Math.abs(diff - threeDaysMs)).toBeLessThan(1000);
  });

  test("speichert userAgent wenn übergeben", async () => {
    const session = await createSession(makeUser(), "Mozilla/5.0");
    expect(session.userAgent).toBe("Mozilla/5.0");
  });

  test("speichert ipAddress wenn übergeben", async () => {
    const session = await createSession(makeUser(), undefined, "192.168.1.1");
    expect(session.ipAddress).toBe("192.168.1.1");
  });

  test("speichert userAgent und ipAddress gleichzeitig", async () => {
    const session = await createSession(makeUser(), "TestAgent/1.0", "10.0.0.1");
    expect(session.userAgent).toBe("TestAgent/1.0");
    expect(session.ipAddress).toBe("10.0.0.1");
  });

  test("lässt userAgent und ipAddress undefined wenn nicht übergeben", async () => {
    const session = await createSession(makeUser());
    expect(session.userAgent).toBeUndefined();
    expect(session.ipAddress).toBeUndefined();
  });

  test("persistiert die Session im Store", async () => {
    const session = await createSession(makeUser());
    const stored = memoryStore.get(session.id);
    expect(stored).toBeDefined();
    expect(stored.userId).toBe(session.userId);
  });
});

// ---------------------------------------------------------------------------

describe("getSession", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("gibt eine vorhandene gültige Session zurück", async () => {
    const created = await createSession(makeUser("user_001"));
    const fetched = await getSession(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.userId).toBe("user_001");
  });

  test("gibt null zurück für eine nicht vorhandene Session-ID", async () => {
    const result = await getSession("nicht_existent_abc123");
    expect(result).toBeNull();
  });

  test("gibt null zurück und löscht eine abgelaufene Session aus dem Store", async () => {
    const expiredId = "expired_session_id";
    storeExpiredSession(expiredId, "user_001");

    const result = await getSession(expiredId);
    expect(result).toBeNull();
    expect(memoryStore.has(expiredId)).toBe(false);
  });

  test("gibt eine Session aus dem Cache zurück (ohne Store-Zugriff nach erstem Laden)", async () => {
    const created = await createSession(makeUser());
    // Store leeren — Session muss aus Cache kommen
    memoryStore.clear();
    const cached = await getSession(created.id);
    expect(cached).not.toBeNull();
    expect(cached!.id).toBe(created.id);
  });

  test("lädt eine Session aus dem Store wenn sie nicht im Cache ist", async () => {
    const created = await createSession(makeUser("user_store"));
    // Session aus Cache entfernen, aber im Store belassen
    await deleteSession(created.id);
    // Session manuell wieder in den Store schreiben
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    memoryStore.set(created.id, { ...created, expiresAt: future });

    const result = await getSession(created.id);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user_store");
  });
});

// ---------------------------------------------------------------------------

describe("validateSession", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("gibt die userId einer gültigen Session zurück", async () => {
    const session = await createSession(makeUser("user_validate"));
    const userId = await validateSession(session.id);
    expect(userId).toBe("user_validate");
  });

  test("gibt null zurück für eine nicht vorhandene Session-ID", async () => {
    const result = await validateSession("unbekannte_id");
    expect(result).toBeNull();
  });

  test("gibt null zurück für eine abgelaufene Session", async () => {
    const expiredId = "expired_validate_id";
    storeExpiredSession(expiredId, "user_abc");
    const result = await validateSession(expiredId);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("deleteSession", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("löscht eine vorhandene Session und gibt true zurück", async () => {
    const session = await createSession(makeUser());
    const result = await deleteSession(session.id);
    expect(result).toBe(true);
  });

  test("gibt false zurück wenn die Session nicht existiert", async () => {
    const result = await deleteSession("nicht_vorhanden_xyz");
    expect(result).toBe(false);
  });

  test("nach dem Löschen ist die Session nicht mehr abrufbar", async () => {
    const session = await createSession(makeUser());
    await deleteSession(session.id);
    const fetched = await getSession(session.id);
    expect(fetched).toBeNull();
  });

  test("entfernt die Session auch aus dem Store", async () => {
    const session = await createSession(makeUser());
    await deleteSession(session.id);
    expect(memoryStore.has(session.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("extendSession", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("aktualisiert expiresAt auf ca. 3 Tage ab jetzt", async () => {
    const session = await createSession(makeUser());
    const beforeExtend = Date.now();
    const extended = await extendSession(session.id);
    const afterExtend = Date.now();

    expect(extended).not.toBeNull();
    const newExpiry = new Date(extended!.expiresAt).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(newExpiry).toBeGreaterThanOrEqual(beforeExtend + threeDaysMs - 1000);
    expect(newExpiry).toBeLessThanOrEqual(afterExtend + threeDaysMs + 1000);
  });

  test("expiresAt der verlängerten Session liegt nach dem ursprünglichen Ablaufdatum", async () => {
    const session = await createSession(makeUser());
    const originalExpiry = session.expiresAt;
    const extended = await extendSession(session.id);
    expect(new Date(extended!.expiresAt).getTime()).toBeGreaterThanOrEqual(
      new Date(originalExpiry).getTime()
    );
  });

  test("gibt null zurück wenn die Session nicht existiert", async () => {
    const result = await extendSession("unbekannte_session_id");
    expect(result).toBeNull();
  });

  test("die verlängerte Session bleibt im Store gespeichert", async () => {
    const session = await createSession(makeUser());
    const extended = await extendSession(session.id);
    const stored = memoryStore.get(session.id);
    expect(stored).toBeDefined();
    expect(stored.expiresAt).toBe(extended!.expiresAt);
  });

  test("behält alle anderen Session-Felder unverändert", async () => {
    const user = makeUser("user_extend");
    const session = await createSession(user, "AgentX/2.0", "172.16.0.1");
    const extended = await extendSession(session.id);
    expect(extended!.id).toBe(session.id);
    expect(extended!.userId).toBe("user_extend");
    expect(extended!.userAgent).toBe("AgentX/2.0");
    expect(extended!.ipAddress).toBe("172.16.0.1");
    expect(extended!.createdAt).toBe(session.createdAt);
  });
});

// ---------------------------------------------------------------------------

describe("deleteUserSessions", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("löscht alle Sessions eines Benutzers und gibt die Anzahl zurück", async () => {
    const user = makeUser("user_del");
    await createSession(user);
    await createSession(user);
    await createSession(user);

    const count = await deleteUserSessions("user_del");
    expect(count).toBe(3);
  });

  test("löscht nur Sessions des angegebenen Benutzers", async () => {
    const userA = makeUser("user_a");
    const userB = makeUser("user_b");
    const sessionA = await createSession(userA);
    await createSession(userB);
    await createSession(userB);

    const count = await deleteUserSessions("user_a");
    expect(count).toBe(1);

    // Session von user_b muss noch vorhanden sein
    expect(memoryStore.size).toBe(2);
    expect(memoryStore.has(sessionA.id)).toBe(false);
  });

  test("gibt 0 zurück wenn der Benutzer keine Sessions hat", async () => {
    await createSession(makeUser("user_other"));
    const count = await deleteUserSessions("user_nobody");
    expect(count).toBe(0);
  });

  test("gibt 0 zurück wenn der Store leer ist", async () => {
    const count = await deleteUserSessions("user_empty");
    expect(count).toBe(0);
  });

  test("nach dem Löschen sind die Sessions nicht mehr abrufbar", async () => {
    const user = makeUser("user_gone");
    const s1 = await createSession(user);
    const s2 = await createSession(user);

    await deleteUserSessions("user_gone");

    expect(await getSession(s1.id)).toBeNull();
    expect(await getSession(s2.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("getUserSessions", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("gibt alle aktiven Sessions eines Benutzers zurück", async () => {
    const user = makeUser("user_list");
    await createSession(user);
    await createSession(user);

    const sessions = await getUserSessions("user_list");
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.userId === "user_list")).toBe(true);
  });

  test("schließt abgelaufene Sessions aus", async () => {
    const user = makeUser("user_mixed");
    const active = await createSession(user);
    const expiredId = "expired_list_id";
    storeExpiredSession(expiredId, "user_mixed");

    const sessions = await getUserSessions("user_mixed");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(active.id);
  });

  test("gibt nur Sessions des angegebenen Benutzers zurück", async () => {
    const userA = makeUser("user_aa");
    const userB = makeUser("user_bb");
    await createSession(userA);
    await createSession(userA);
    await createSession(userB);

    const sessions = await getUserSessions("user_aa");
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.userId === "user_aa")).toBe(true);
  });

  test("gibt eine leere Liste zurück wenn der Benutzer keine Sessions hat", async () => {
    await createSession(makeUser("user_other"));
    const sessions = await getUserSessions("user_nobody");
    expect(sessions).toEqual([]);
  });

  test("gibt eine leere Liste zurück wenn der Store leer ist", async () => {
    const sessions = await getUserSessions("user_empty");
    expect(sessions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("cleanupExpiredSessions", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  test("löscht alle abgelaufenen Sessions und gibt die Anzahl zurück", async () => {
    storeExpiredSession("exp_1", "user_x");
    storeExpiredSession("exp_2", "user_x");
    await createSession(makeUser("user_x")); // aktive Session

    const count = await cleanupExpiredSessions();
    expect(count).toBe(2);
  });

  test("lässt aktive Sessions unberührt", async () => {
    storeExpiredSession("exp_cleanup", "user_y");
    const active = await createSession(makeUser("user_y"));

    await cleanupExpiredSessions();

    expect(memoryStore.has("exp_cleanup")).toBe(false);
    expect(memoryStore.has(active.id)).toBe(true);
  });

  test("gibt 0 zurück wenn keine abgelaufenen Sessions vorhanden sind", async () => {
    await createSession(makeUser());
    await createSession(makeUser());

    const count = await cleanupExpiredSessions();
    expect(count).toBe(0);
  });

  test("gibt 0 zurück wenn der Store leer ist", async () => {
    const count = await cleanupExpiredSessions();
    expect(count).toBe(0);
  });

  test("bereinigt ausschließlich abgelaufene Sessions unabhängig vom Benutzer", async () => {
    storeExpiredSession("exp_a", "user_a");
    storeExpiredSession("exp_b", "user_b");
    const active1 = await createSession(makeUser("user_a"));
    const active2 = await createSession(makeUser("user_b"));

    const count = await cleanupExpiredSessions();
    expect(count).toBe(2);
    expect(memoryStore.has(active1.id)).toBe(true);
    expect(memoryStore.has(active2.id)).toBe(true);
  });
});
