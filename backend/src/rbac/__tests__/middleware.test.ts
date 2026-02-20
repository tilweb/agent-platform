/**
 * Tests for RBAC Middleware (backend/src/rbac/middleware.ts)
 *
 * Tests requireResourceAccess, convenience wrappers (requireViewAccess,
 * requireEditAccess, requireDeleteAccess, requireManageAccess, requireOwnership),
 * checkResourceAccess, and the context helper functions.
 *
 * Dependencies are fully mocked via mock.module() before the module import.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { AccessCheckResult } from "../accessControl";

// ---------------------------------------------------------------------------
// Mock state — reset in beforeEach
// ---------------------------------------------------------------------------

let mockCurrentUserId: string | undefined = undefined;
let mockCheckAccessResult: AccessCheckResult = { allowed: false };

mock.module("../../auth/middleware", () => ({
  getCurrentUserId: (c: any) => mockCurrentUserId,
}));

mock.module("../accessControl", () => ({
  checkAccess: async (
    _userId: string,
    _resourceType: string,
    _resourceId: string,
    _permission: string
  ): Promise<AccessCheckResult> => mockCheckAccessResult,
  hasAnyAccess: async (
    _userId: string,
    _resourceType: string,
    _resourceId: string
  ): Promise<boolean> => mockCheckAccessResult.allowed,
}));

// Import after mocks are registered
const {
  requireResourceAccess,
  requireViewAccess,
  requireEditAccess,
  requireDeleteAccess,
  requireManageAccess,
  requireOwnership,
  checkResourceAccess,
  getEffectiveRoleFromContext,
  getAccessSourceFromContext,
  hasAccessFromContext,
} = await import("../middleware");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Hono Context.
 * - userId in vars simulates what authMiddleware sets.
 * - resourceId is returned by c.req.param('id').
 */
function createMockContext(userId?: string, resourceId?: string) {
  const vars = new Map<string, any>();
  if (userId) vars.set("userId", userId);
  return {
    get: (key: string) => vars.get(key),
    set: (key: string, value: any) => vars.set(key, value),
    json: mock((data: any, status?: number) => ({
      data,
      status: status ?? 200,
      _isResponse: true,
    })),
    req: {
      param: mock((name: string) => (name === "id" ? resourceId : undefined)),
    },
  };
}

/** Convenience: returns a next function that tracks whether it was called. */
function createNext() {
  let called = false;
  const fn = async () => {
    called = true;
  };
  return { fn, wasCalled: () => called };
}

// ---------------------------------------------------------------------------
// requireResourceAccess
// ---------------------------------------------------------------------------

describe("requireResourceAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  describe("Fehlende Authentifizierung", () => {
    test("gibt 401 zurück wenn keine userId im Kontext vorhanden ist", async () => {
      const c = createMockContext(undefined, "res_1");
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
      expect(next.wasCalled()).toBe(false);
    });

    test("ruft next nicht auf wenn Authentifizierung fehlt", async () => {
      const c = createMockContext(undefined, "res_1");
      const next = createNext();
      mockCurrentUserId = undefined;

      const middleware = requireResourceAccess({
        resourceType: "agent",
        permission: "canEdit",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(next.wasCalled()).toBe(false);
    });
  });

  describe("Fehlende Ressourcen-ID", () => {
    test("gibt 400 zurück wenn keine Ressourcen-ID ermittelt werden kann", async () => {
      const c = createMockContext("user_1", undefined);
      mockCurrentUserId = "user_1";
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.json).toHaveBeenCalledWith({ error: "Resource ID required" }, 400);
      expect(next.wasCalled()).toBe(false);
    });

    test("ruft next nicht auf wenn Ressourcen-ID fehlt", async () => {
      const c = createMockContext("user_1", undefined);
      mockCurrentUserId = "user_1";
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canDelete",
        getResourceId: () => undefined,
      });

      await middleware(c as any, next.fn);

      expect(next.wasCalled()).toBe(false);
    });
  });

  describe("Zugriff verweigert", () => {
    test("gibt 403 zurück wenn checkAccess den Zugriff verweigert", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = { allowed: false, reason: "Keine Berechtigung" };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canEdit",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.json).toHaveBeenCalledWith(
        { error: "Keine Berechtigung" },
        403
      );
      expect(next.wasCalled()).toBe(false);
    });

    test("verwendet die Standard-Fehlermeldung 'Zugriff verweigert' wenn kein reason vorhanden", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = { allowed: false };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.json).toHaveBeenCalledWith({ error: "Zugriff verweigert" }, 403);
    });

    test("verwendet den benutzerdefinierten errorMessage wenn angegeben und Zugriff verweigert", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = { allowed: false, reason: "Intern" };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "agent",
        permission: "canDelete",
        getResourceId: (ctx: any) => ctx.req.param("id"),
        errorMessage: "Benutzerdefinierte Fehlermeldung",
      });

      await middleware(c as any, next.fn);

      expect(c.json).toHaveBeenCalledWith(
        { error: "Benutzerdefinierte Fehlermeldung" },
        403
      );
    });

    test("ruft next nicht auf wenn Zugriff verweigert wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = { allowed: false };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(next.wasCalled()).toBe(false);
    });
  });

  describe("Zugriff erlaubt", () => {
    test("ruft next auf wenn Zugriff gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "editor",
        source: "direct",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canEdit",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(next.wasCalled()).toBe(true);
    });

    test("setzt effectiveRole im Kontext wenn Zugriff gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "owner",
        source: "direct",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canDelete",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.get("effectiveRole")).toBe("owner");
    });

    test("setzt accessSource im Kontext wenn Zugriff über direkten Eintrag gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "editor",
        source: "direct",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canEdit",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.get("accessSource")).toBe("direct");
    });

    test("setzt accessSource='group' wenn Zugriff über Gruppe gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "viewer",
        source: "group",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "collection",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.get("accessSource")).toBe("group");
    });

    test("setzt accessSource='admin' wenn Zugriff über globalen Admin gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "admin",
        source: "admin",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canView",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.get("accessSource")).toBe("admin");
    });

    test("gibt kein json zurück wenn Zugriff gewährt wird", async () => {
      const c = createMockContext("user_1", "res_1");
      mockCurrentUserId = "user_1";
      mockCheckAccessResult = {
        allowed: true,
        effectiveRole: "editor",
        source: "direct",
      };
      const next = createNext();

      const middleware = requireResourceAccess({
        resourceType: "space",
        permission: "canEdit",
        getResourceId: (ctx: any) => ctx.req.param("id"),
      });

      await middleware(c as any, next.fn);

      expect(c.json).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// requireViewAccess
// ---------------------------------------------------------------------------

describe("requireViewAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("gibt 401 zurück wenn nicht authentifiziert", async () => {
    const c = createMockContext(undefined, "res_1");
    const next = createNext();

    const middleware = requireViewAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  test("gibt Fehlermeldung 'Keine Leseberechtigung' bei verweigerntem Zugriff zurück", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = requireViewAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Keine Leseberechtigung" }, 403);
  });

  test("ruft next auf wenn Lesezugriff gewährt wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "viewer", source: "direct" };
    const next = createNext();

    const middleware = requireViewAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });

  test("setzt effectiveRole und accessSource im Kontext bei Erfolg", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "viewer", source: "group" };
    const next = createNext();

    const middleware = requireViewAccess("agent", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.get("effectiveRole")).toBe("viewer");
    expect(c.get("accessSource")).toBe("group");
  });
});

// ---------------------------------------------------------------------------
// requireEditAccess
// ---------------------------------------------------------------------------

describe("requireEditAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("gibt 401 zurück wenn nicht authentifiziert", async () => {
    const c = createMockContext(undefined, "res_1");
    const next = createNext();

    const middleware = requireEditAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  test("gibt Fehlermeldung 'Keine Bearbeitungsberechtigung' bei verweigerndem Zugriff zurück", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = requireEditAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Keine Bearbeitungsberechtigung" }, 403);
  });

  test("ruft next auf wenn Bearbeitungszugriff gewährt wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "editor", source: "direct" };
    const next = createNext();

    const middleware = requireEditAccess("collection", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireDeleteAccess
// ---------------------------------------------------------------------------

describe("requireDeleteAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("gibt 401 zurück wenn nicht authentifiziert", async () => {
    const c = createMockContext(undefined, "res_1");
    const next = createNext();

    const middleware = requireDeleteAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  test("gibt Fehlermeldung 'Keine Löschberechtigung' bei verweigerndem Zugriff zurück", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = requireDeleteAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Keine Löschberechtigung" }, 403);
  });

  test("ruft next auf wenn Löschzugriff gewährt wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "owner", source: "direct" };
    const next = createNext();

    const middleware = requireDeleteAccess("agent", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireManageAccess
// ---------------------------------------------------------------------------

describe("requireManageAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("gibt 401 zurück wenn nicht authentifiziert", async () => {
    const c = createMockContext(undefined, "res_1");
    const next = createNext();

    const middleware = requireManageAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  test("gibt Fehlermeldung 'Keine Berechtigung zur Zugriffsverwaltung' bei verweigerndem Zugriff zurück", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = requireManageAccess("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith(
      { error: "Keine Berechtigung zur Zugriffsverwaltung" },
      403
    );
  });

  test("ruft next auf wenn Zugriffsverwaltung gewährt wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "admin", source: "direct" };
    const next = createNext();

    const middleware = requireManageAccess("skill", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireOwnership
// ---------------------------------------------------------------------------

describe("requireOwnership", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("gibt 401 zurück wenn nicht authentifiziert", async () => {
    const c = createMockContext(undefined, "res_1");
    const next = createNext();

    const middleware = requireOwnership("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  test("gibt Fehlermeldung 'Nur der Eigentümer kann diese Aktion durchführen' zurück", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = requireOwnership("space", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(c.json).toHaveBeenCalledWith(
      { error: "Nur der Eigentümer kann diese Aktion durchführen" },
      403
    );
  });

  test("ruft next auf wenn Eigentumsnachweis erbracht wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "owner", source: "direct" };
    const next = createNext();

    const middleware = requireOwnership("agent", (ctx: any) => ctx.req.param("id"));
    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkResourceAccess (non-blocking)
// ---------------------------------------------------------------------------

describe("checkResourceAccess", () => {
  beforeEach(() => {
    mockCurrentUserId = undefined;
    mockCheckAccessResult = { allowed: false };
  });

  test("ruft next immer auf — auch wenn Zugriff verweigert wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });

  test("ruft next auf wenn Zugriff erlaubt ist", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "editor", source: "direct" };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canEdit",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(next.wasCalled()).toBe(true);
  });

  test("setzt hasAccess=true wenn Zugriff erlaubt ist", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "owner", source: "direct" };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canDelete",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(c.get("hasAccess")).toBe(true);
  });

  test("setzt hasAccess=false wenn Zugriff verweigert wird", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(c.get("hasAccess")).toBe(false);
  });

  test("setzt effectiveRole und accessSource im Kontext wenn Zugriff erlaubt ist", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: true, effectiveRole: "editor", source: "group" };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "collection",
      permission: "canEdit",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(c.get("effectiveRole")).toBe("editor");
    expect(c.get("accessSource")).toBe("group");
  });

  test("setzt hasAccess=false wenn keine userId im Kontext vorhanden ist", async () => {
    const c = createMockContext(undefined, "res_1");
    mockCurrentUserId = undefined;
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(c.get("hasAccess")).toBe(false);
    expect(next.wasCalled()).toBe(true);
  });

  test("setzt hasAccess=false wenn keine Ressourcen-ID vorhanden ist", async () => {
    const c = createMockContext("user_1", undefined);
    mockCurrentUserId = "user_1";
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: () => undefined,
    });

    await middleware(c as any, next.fn);

    expect(c.get("hasAccess")).toBe(false);
    expect(next.wasCalled()).toBe(true);
  });

  test("setzt effectiveRole=undefined wenn userId oder Ressourcen-ID fehlt", async () => {
    const c = createMockContext(undefined, undefined);
    mockCurrentUserId = undefined;
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: () => undefined,
    });

    await middleware(c as any, next.fn);

    expect(c.get("effectiveRole")).toBeUndefined();
    expect(c.get("accessSource")).toBeUndefined();
  });

  test("gibt niemals eine json-Fehlerantwort zurück — auch nicht bei fehlendem Zugriff", async () => {
    const c = createMockContext("user_1", "res_1");
    mockCurrentUserId = "user_1";
    mockCheckAccessResult = { allowed: false };
    const next = createNext();

    const middleware = checkResourceAccess({
      resourceType: "space",
      permission: "canView",
      getResourceId: (ctx: any) => ctx.req.param("id"),
    });

    await middleware(c as any, next.fn);

    expect(c.json).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Context-Hilfsfunktionen
// ---------------------------------------------------------------------------

describe("getEffectiveRoleFromContext", () => {
  test("gibt die effectiveRole aus dem Kontext zurück", () => {
    const c = createMockContext("user_1", "res_1");
    c.set("effectiveRole", "editor");

    expect(getEffectiveRoleFromContext(c as any)).toBe("editor");
  });

  test("gibt undefined zurück wenn keine effectiveRole im Kontext gesetzt ist", () => {
    const c = createMockContext("user_1", "res_1");

    expect(getEffectiveRoleFromContext(c as any)).toBeUndefined();
  });

  test("gibt owner-Rolle korrekt zurück", () => {
    const c = createMockContext();
    c.set("effectiveRole", "owner");

    expect(getEffectiveRoleFromContext(c as any)).toBe("owner");
  });

  test("gibt admin-Rolle korrekt zurück", () => {
    const c = createMockContext();
    c.set("effectiveRole", "admin");

    expect(getEffectiveRoleFromContext(c as any)).toBe("admin");
  });
});

describe("getAccessSourceFromContext", () => {
  test("gibt 'direct' zurück wenn Quelle auf 'direct' gesetzt ist", () => {
    const c = createMockContext();
    c.set("accessSource", "direct");

    expect(getAccessSourceFromContext(c as any)).toBe("direct");
  });

  test("gibt 'group' zurück wenn Quelle auf 'group' gesetzt ist", () => {
    const c = createMockContext();
    c.set("accessSource", "group");

    expect(getAccessSourceFromContext(c as any)).toBe("group");
  });

  test("gibt 'admin' zurück wenn Quelle auf 'admin' gesetzt ist", () => {
    const c = createMockContext();
    c.set("accessSource", "admin");

    expect(getAccessSourceFromContext(c as any)).toBe("admin");
  });

  test("gibt undefined zurück wenn keine accessSource im Kontext gesetzt ist", () => {
    const c = createMockContext();

    expect(getAccessSourceFromContext(c as any)).toBeUndefined();
  });
});

describe("hasAccessFromContext", () => {
  test("gibt true zurück wenn hasAccess auf true gesetzt ist", () => {
    const c = createMockContext();
    c.set("hasAccess", true);

    expect(hasAccessFromContext(c as any)).toBe(true);
  });

  test("gibt false zurück wenn hasAccess auf false gesetzt ist", () => {
    const c = createMockContext();
    c.set("hasAccess", false);

    expect(hasAccessFromContext(c as any)).toBe(false);
  });

  test("gibt false zurück wenn hasAccess nicht im Kontext gesetzt ist", () => {
    const c = createMockContext();

    expect(hasAccessFromContext(c as any)).toBe(false);
  });

  test("gibt false zurück wenn hasAccess auf einen nicht-booleschen Wert gesetzt ist", () => {
    const c = createMockContext();
    c.set("hasAccess", undefined);

    expect(hasAccessFromContext(c as any)).toBe(false);
  });
});
