/**
 * Tests for Authentication Middleware (backend/src/auth/middleware.ts)
 *
 * hono/cookie, ./session, ./storage und ./types werden gemockt, sodass
 * kein echtes Dateisystem oder Netzwerk verwendet wird.
 * Mocks MÜSSEN vor dem dynamischen Import des Moduls registriert werden.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import { HTTPException } from "hono/http-exception";

// ---------------------------------------------------------------------------
// Mock-State — zwischen den Tests zurückgesetzt
// ---------------------------------------------------------------------------

let mockGetCookieReturn: string | undefined = undefined;
let mockGetSessionReturn: any = null;
let mockLoadUserReturn: any = null;
const mockExtendSession = mock(async (_id: string) => null);
const mockDeleteSession = mock(async (_id: string) => true);
const mockSetCookie = mock((_c: any, _name: string, _value: string, _opts?: any) => {});
const mockSanitizeUser = mock((user: any) => {
  const { passwordHash, ...safe } = user;
  return safe;
});

// ---------------------------------------------------------------------------
// Module-Mocks — vor dem dynamischen Import deklarieren
// ---------------------------------------------------------------------------

mock.module("hono/cookie", () => ({
  getCookie: (_c: any, _name: string) => mockGetCookieReturn,
  setCookie: mockSetCookie,
}));

mock.module("../session", () => ({
  getSession: async (_id: string) => mockGetSessionReturn,
  extendSession: mockExtendSession,
  deleteSession: mockDeleteSession,
}));

mock.module("../storage", () => ({
  loadUser: async (_id: string) => mockLoadUserReturn,
}));

mock.module("../types", () => ({
  SESSION_CONFIG: {
    cookieName: "session_id",
    expiresInMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    maxAbsoluteLifetimeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3 * 24 * 60 * 60 },
  },
  sanitizeUser: mockSanitizeUser,
}));

// ---------------------------------------------------------------------------
// Modul unter Test importieren — nach den Mocks
// ---------------------------------------------------------------------------

const {
  authMiddleware,
  optionalAuthMiddleware,
  isAuthenticated,
  getCurrentUser,
  getCurrentUserId,
  requireUserId,
} = await import("../middleware");

// ---------------------------------------------------------------------------
// Test-Hilfsfunktionen
// ---------------------------------------------------------------------------

function createMockContext(overrides?: any) {
  const vars = new Map<string, any>();
  return {
    get: (key: string) => vars.get(key),
    set: (key: string, value: any) => vars.set(key, value),
    json: mock((data: any, status?: number) => ({ data, status: status ?? 200, _isResponse: true })),
    req: { param: mock(() => undefined), ...overrides?.req },
    ...overrides,
  };
}

function makeUser(overrides?: Partial<{
  id: string;
  username: string;
  isActive: boolean;
  passwordHash: string;
  role: string;
}>) {
  return {
    id: "user_001",
    username: "testuser",
    email: "test@example.com",
    displayName: "Test User",
    passwordHash: "hashed_secret",
    role: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

/**
 * Erzeugt eine Session, die kürzlich verlängert wurde (kein Extend nötig).
 * expiresAt = now + expiresInMs → timeSinceLastExtend ≈ 0 → |diff| < 1h → kein Extend
 */
function makeFreshSession(userId = "user_001") {
  const expiresInMs = 3 * 24 * 60 * 60 * 1000;
  return {
    id: "session_abc123",
    userId,
    createdAt: new Date(Date.now() - 60 * 1000).toISOString(), // 1 Minute alt
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

/**
 * Erzeugt eine Session, deren letzte Verlängerung mehr als 1 Stunde zurückliegt.
 * expiresAt = now + expiresInMs - 2h → timeSinceLastExtend = -2h → |diff| > 1h → Extend
 */
function makeOldSession(userId = "user_001") {
  const expiresInMs = 3 * 24 * 60 * 60 * 1000;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return {
    id: "session_old456",
    userId,
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 Stunden alt
    expiresAt: new Date(Date.now() + expiresInMs - twoHoursMs).toISOString(),
  };
}

/**
 * Erzeugt eine Session, die älter als maxAbsoluteLifetimeMs (30 Tage) ist.
 */
function makeExpiredAbsoluteSession(userId = "user_001") {
  const expiresInMs = 3 * 24 * 60 * 60 * 1000;
  const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
  return {
    id: "session_expired789",
    userId,
    createdAt: new Date(Date.now() - thirtyOneDaysMs).toISOString(),
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

const mockNext = mock(async () => {});

// ---------------------------------------------------------------------------
// Test-Suiten
// ---------------------------------------------------------------------------

describe("authMiddleware", () => {
  beforeEach(() => {
    mockGetCookieReturn = undefined;
    mockGetSessionReturn = null;
    mockLoadUserReturn = null;
    mockExtendSession.mockClear();
    mockDeleteSession.mockClear();
    mockSetCookie.mockClear();
    mockSanitizeUser.mockClear();
    mockNext.mockClear();
  });

  describe("kein Cookie vorhanden", () => {
    test("gibt 401 zurück wenn kein Session-Cookie gesetzt ist", async () => {
      mockGetCookieReturn = undefined;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(1);
      expect(c.json.mock.calls[0]![1]).toBe(401);
      expect(c.json.mock.calls[0]![0]).toMatchObject({ error: "Authentication required" });
    });

    test("ruft next() nicht auf wenn kein Cookie vorhanden ist", async () => {
      mockGetCookieReturn = undefined;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockNext.mock.calls.length).toBe(0);
    });
  });

  describe("ungültige oder abgelaufene Session", () => {
    test("gibt 401 zurück wenn die Session nicht gefunden wird", async () => {
      mockGetCookieReturn = "some_session_id";
      mockGetSessionReturn = null;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(1);
      expect(c.json.mock.calls[0]![1]).toBe(401);
      expect(c.json.mock.calls[0]![0]).toMatchObject({ error: "Invalid or expired session" });
    });

    test("ruft next() nicht auf wenn die Session ungültig ist", async () => {
      mockGetCookieReturn = "invalid_session";
      mockGetSessionReturn = null;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockNext.mock.calls.length).toBe(0);
    });

    test("gibt 401 zurück wenn die maximale absolute Lebensdauer überschritten ist", async () => {
      mockGetCookieReturn = "old_session_id";
      mockGetSessionReturn = makeExpiredAbsoluteSession();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(1);
      expect(c.json.mock.calls[0]![1]).toBe(401);
      expect(c.json.mock.calls[0]![0]).toMatchObject({ error: "Session expired. Please login again." });
    });

    test("löscht die Session wenn die maximale absolute Lebensdauer überschritten ist", async () => {
      mockGetCookieReturn = "old_session_id";
      mockGetSessionReturn = makeExpiredAbsoluteSession();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockDeleteSession.mock.calls.length).toBe(1);
      expect(mockDeleteSession.mock.calls[0]![0]).toBe("old_session_id");
    });

    test("ruft next() nicht auf wenn die Session abgelaufen ist", async () => {
      mockGetCookieReturn = "old_session_id";
      mockGetSessionReturn = makeExpiredAbsoluteSession();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockNext.mock.calls.length).toBe(0);
    });
  });

  describe("Benutzer nicht gefunden oder inaktiv", () => {
    test("gibt 401 zurück wenn der Benutzer nicht gefunden wird", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = null;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(1);
      expect(c.json.mock.calls[0]![1]).toBe(401);
      expect(c.json.mock.calls[0]![0]).toMatchObject({ error: "User not found or inactive" });
    });

    test("gibt 401 zurück wenn der Benutzer inaktiv ist", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser({ isActive: false });
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(1);
      expect(c.json.mock.calls[0]![1]).toBe(401);
      expect(c.json.mock.calls[0]![0]).toMatchObject({ error: "User not found or inactive" });
    });

    test("ruft next() nicht auf wenn der Benutzer nicht gefunden wird", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = null;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockNext.mock.calls.length).toBe(0);
    });
  });

  describe("erfolgreiche Authentifizierung", () => {
    test("setzt userId im Context nach erfolgreicher Authentifizierung", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession("user_001");
      mockLoadUserReturn = makeUser({ id: "user_001" });
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.get("userId")).toBe("user_001");
    });

    test("setzt user im Context nach erfolgreicher Authentifizierung", async () => {
      mockGetCookieReturn = "valid_session";
      const session = makeFreshSession("user_001");
      mockGetSessionReturn = session;
      const user = makeUser({ id: "user_001" });
      mockLoadUserReturn = user;
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.get("user")).toBeDefined();
      expect(c.get("user").id).toBe("user_001");
    });

    test("ruft sanitizeUser auf um das Passwort-Hash zu entfernen", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockSanitizeUser.mock.calls.length).toBe(1);
    });

    test("ruft next() auf nach erfolgreicher Authentifizierung", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockNext.mock.calls.length).toBe(1);
    });

    test("gibt keine json-Antwort zurück bei erfolgreicher Authentifizierung", async () => {
      mockGetCookieReturn = "valid_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(c.json.mock.calls.length).toBe(0);
    });
  });

  describe("Sliding Session — Session-Verlängerung", () => {
    test("verlängert die Session wenn sie mehr als 1 Stunde alt ist", async () => {
      mockGetCookieReturn = "old_session";
      mockGetSessionReturn = makeOldSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockExtendSession.mock.calls.length).toBe(1);
      expect(mockExtendSession.mock.calls[0]![0]).toBe("old_session");
    });

    test("aktualisiert den Cookie nach der Session-Verlängerung", async () => {
      mockGetCookieReturn = "old_session";
      mockGetSessionReturn = makeOldSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockSetCookie.mock.calls.length).toBe(1);
      expect(mockSetCookie.mock.calls[0]![2]).toBe("old_session");
    });

    test("verlängert die Session NICHT wenn sie weniger als 1 Stunde alt ist", async () => {
      mockGetCookieReturn = "fresh_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockExtendSession.mock.calls.length).toBe(0);
    });

    test("setzt den Cookie NICHT wenn die Session nicht verlängert wird", async () => {
      mockGetCookieReturn = "fresh_session";
      mockGetSessionReturn = makeFreshSession();
      mockLoadUserReturn = makeUser();
      const c = createMockContext();

      await authMiddleware(c as any, mockNext);

      expect(mockSetCookie.mock.calls.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------

describe("optionalAuthMiddleware", () => {
  beforeEach(() => {
    mockGetCookieReturn = undefined;
    mockGetSessionReturn = null;
    mockLoadUserReturn = null;
    mockExtendSession.mockClear();
    mockSanitizeUser.mockClear();
    mockNext.mockClear();
  });

  test("ruft immer next() auf, auch ohne Cookie", async () => {
    mockGetCookieReturn = undefined;
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(mockNext.mock.calls.length).toBe(1);
  });

  test("ruft next() auf wenn eine gültige Session existiert", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession("user_001");
    mockLoadUserReturn = makeUser({ id: "user_001" });
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(mockNext.mock.calls.length).toBe(1);
  });

  test("ruft next() auf wenn die Session ungültig ist", async () => {
    mockGetCookieReturn = "invalid_session";
    mockGetSessionReturn = null;
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(mockNext.mock.calls.length).toBe(1);
  });

  test("setzt userId und user im Context wenn eine gültige Session existiert", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession("user_001");
    mockLoadUserReturn = makeUser({ id: "user_001" });
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(c.get("userId")).toBe("user_001");
    expect(c.get("user")).toBeDefined();
  });

  test("setzt userId und user NICHT wenn kein Cookie vorhanden ist", async () => {
    mockGetCookieReturn = undefined;
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(c.get("userId")).toBeUndefined();
    expect(c.get("user")).toBeUndefined();
  });

  test("setzt userId und user NICHT wenn die Session ungültig ist", async () => {
    mockGetCookieReturn = "bad_session";
    mockGetSessionReturn = null;
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(c.get("userId")).toBeUndefined();
    expect(c.get("user")).toBeUndefined();
  });

  test("setzt userId und user NICHT wenn der Benutzer inaktiv ist", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession("user_inactive");
    mockLoadUserReturn = makeUser({ id: "user_inactive", isActive: false });
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(c.get("userId")).toBeUndefined();
    expect(c.get("user")).toBeUndefined();
  });

  test("setzt userId und user NICHT wenn der Benutzer nicht gefunden wird", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession("user_ghost");
    mockLoadUserReturn = null;
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(c.get("userId")).toBeUndefined();
    expect(c.get("user")).toBeUndefined();
  });

  test("ruft sanitizeUser auf wenn der Benutzer gefunden und aktiv ist", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession();
    mockLoadUserReturn = makeUser();
    const c = createMockContext();

    await optionalAuthMiddleware(c as any, mockNext);

    expect(mockSanitizeUser.mock.calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("isAuthenticated", () => {
  beforeEach(() => {
    mockGetCookieReturn = undefined;
    mockGetSessionReturn = null;
    mockLoadUserReturn = null;
  });

  test("gibt false zurück wenn kein Cookie vorhanden ist", async () => {
    mockGetCookieReturn = undefined;
    const c = createMockContext();

    const result = await isAuthenticated(c as any);

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn die Session ungültig ist", async () => {
    mockGetCookieReturn = "bad_session";
    mockGetSessionReturn = null;
    const c = createMockContext();

    const result = await isAuthenticated(c as any);

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn der Benutzer nicht gefunden wird", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession();
    mockLoadUserReturn = null;
    const c = createMockContext();

    const result = await isAuthenticated(c as any);

    expect(result).toBe(false);
  });

  test("gibt false zurück wenn der Benutzer inaktiv ist", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession();
    mockLoadUserReturn = makeUser({ isActive: false });
    const c = createMockContext();

    const result = await isAuthenticated(c as any);

    expect(result).toBe(false);
  });

  test("gibt true zurück für eine gültige Session mit aktivem Benutzer", async () => {
    mockGetCookieReturn = "valid_session";
    mockGetSessionReturn = makeFreshSession("user_001");
    mockLoadUserReturn = makeUser({ id: "user_001", isActive: true });
    const c = createMockContext();

    const result = await isAuthenticated(c as any);

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("getCurrentUser", () => {
  test("gibt den Benutzer aus dem Context zurück", () => {
    const c = createMockContext();
    const user = makeUser();
    c.set("user", user);

    const result = getCurrentUser(c as any);

    expect(result).toBe(user);
  });

  test("gibt undefined zurück wenn kein Benutzer im Context ist", () => {
    const c = createMockContext();

    const result = getCurrentUser(c as any);

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("getCurrentUserId", () => {
  test("gibt die userId aus dem Context zurück", () => {
    const c = createMockContext();
    c.set("userId", "user_abc");

    const result = getCurrentUserId(c as any);

    expect(result).toBe("user_abc");
  });

  test("gibt undefined zurück wenn keine userId im Context ist", () => {
    const c = createMockContext();

    const result = getCurrentUserId(c as any);

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("requireUserId", () => {
  test("gibt die userId zurück wenn sie im Context gesetzt ist", () => {
    const c = createMockContext();
    c.set("userId", "user_xyz");

    const result = requireUserId(c as any);

    expect(result).toBe("user_xyz");
  });

  test("wirft HTTPException mit Status 401 wenn keine userId im Context ist", () => {
    const c = createMockContext();

    expect(() => requireUserId(c as any)).toThrow(HTTPException);
  });

  test("wirft eine Exception mit Status 401 wenn userId nicht gesetzt ist", () => {
    const c = createMockContext();

    let thrown: unknown;
    try {
      requireUserId(c as any);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(HTTPException);
    expect((thrown as HTTPException).status).toBe(401);
  });

  test("wirft KEINE Exception wenn userId gesetzt ist", () => {
    const c = createMockContext();
    c.set("userId", "user_ok");

    expect(() => requireUserId(c as any)).not.toThrow();
  });
});
