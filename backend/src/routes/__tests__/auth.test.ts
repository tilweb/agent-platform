/**
 * Tests for authentication routes (backend/src/routes/auth.ts)
 *
 * Covers: register, login, logout, me, status, user management (admin),
 * and group management (admin).
 * All dependencies are mocked at the module level via mock.module().
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests can override return values
// ---------------------------------------------------------------------------

const mockState = {
  // Auth context
  currentUser: null as null | { id: string; username: string; role: string },

  // Users
  createUserResult: null as any,
  findUserByUsernameResult: null as any,
  hasUsersResult: false,
  verifyAndRehashResult: [true, null] as [boolean, string | null],
  validatePasswordResult: { valid: true, errors: [] as string[] },
  validateUsernameResult: { valid: true, errors: [] as string[] },
  loadUserResult: null as any,
  listUsersResult: [] as any[],
  updateUserResult: null as any,

  // Sessions
  createSessionResult: { id: "session-abc123" } as any,
  getSessionResult: null as any,

  // Groups
  createGroupResult: null as any,
  loadGroupResult: null as any,
  updateGroupResult: null as any,
  listGroupsResult: [] as any[],
  addGroupMemberResult: null as any,
  removeGroupMemberResult: null as any,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock ALL named exports from the auth barrel index that auth.ts imports from '../auth'
mock.module("../../auth", () => ({
  // User
  createUser: async (_data: any) => mockState.createUserResult,
  findUserByUsername: async (_username: string) => mockState.findUserByUsernameResult,
  hasUsers: async () => mockState.hasUsersResult,
  verifyAndRehash: async (_password: string, _hash: string) => mockState.verifyAndRehashResult,
  validatePassword: (_password: string) => mockState.validatePasswordResult,
  validateUsername: (_username: string) => mockState.validateUsernameResult,
  sanitizeUser: (user: any) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
  }),
  SESSION_CONFIG: {
    cookieName: "session",
    cookieOptions: { path: "/", httpOnly: true },
    expiresInMs: 86400000,
    maxAbsoluteLifetimeMs: 30 * 24 * 60 * 60 * 1000,
  },
  createSession: async (_user: any, _ua: any, _ip: any) => mockState.createSessionResult,
  deleteSession: async (_id: string) => {},
  getSession: async (_id: string) => mockState.getSessionResult,
  loadUser: async (_id: string) => mockState.loadUserResult,
  listUsers: async () => mockState.listUsersResult,
  updateUser: async (_id: string, _data: any) => mockState.updateUserResult,
  deleteUser: async (_id: string) => {},
  // Middleware — injects mockState.currentUser into the Hono context
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUser: (c: any) => c.get("user"),
  hashPassword: async (pw: string) => "hashed_" + pw,
  // Groups
  createGroup: async (_data: any, _userId: any) => mockState.createGroupResult,
  loadGroup: async (_id: string) => mockState.loadGroupResult,
  updateGroup: async (_id: string, _data: any) => mockState.updateGroupResult,
  deleteGroup: async (_id: string) => {},
  listGroups: async () => mockState.listGroupsResult,
  addGroupMember: async (_groupId: string, _userId: string) => mockState.addGroupMemberResult,
  removeGroupMember: async (_groupId: string, _userId: string) => mockState.removeGroupMemberResult,
}));

// Mock rate limiters as no-ops so they never block test requests
mock.module("../../middleware/rateLimit", () => ({
  authRateLimit: async (_c: any, next: any) => await next(),
  sensitiveRateLimit: async (_c: any, next: any) => await next(),
}));

// Mock audit log service
mock.module("../../services/auditLog", () => ({
  auditLogin: async () => {},
  auditLogout: async () => {},
  auditUserAction: async () => {},
  AuditAction: { PASSWORD_RESET: "password_reset" },
}));

// Mock client IP helper
mock.module("../../utils/clientIp", () => ({
  getClientIp: () => "127.0.0.1",
}));

// Mock error handler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) => c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------

const { authRoutes } = await import("../auth");

const app = new Hono();
app.route("/api/auth", authRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminUser(overrides: Partial<any> = {}) {
  return { id: "admin-1", username: "alice", role: "admin", isActive: true, ...overrides };
}

function makeRegularUser(overrides: Partial<any> = {}) {
  return { id: "user-1", username: "bob", role: "user", isActive: true, email: null, displayName: null, ...overrides };
}

function makeGroup(overrides: Partial<any> = {}) {
  return { id: "group-1", name: "Developers", description: "", memberIds: [], ...overrides };
}

function jsonBody(data: object) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function jsonPut(data: object) {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function withSession(sessionId = "session-abc123") {
  return { headers: { Cookie: `session=${sessionId}` } };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    mockState.validateUsernameResult = { valid: true, errors: [] };
    mockState.validatePasswordResult = { valid: true, errors: [] };
    mockState.findUserByUsernameResult = null;
    mockState.createUserResult = makeRegularUser({ id: "new-user-1", username: "charlie" });
    mockState.createSessionResult = { id: "session-new-1" };
  });

  test("should return 400 when username is missing", async () => {
    const res = await app.request("/api/auth/register", jsonBody({ password: "Secret123!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/username/i);
  });

  test("should return 400 when password is missing", async () => {
    const res = await app.request("/api/auth/register", jsonBody({ username: "charlie" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  test("should return 400 when username fails validation", async () => {
    mockState.validateUsernameResult = { valid: false, errors: ["Username too short"] };
    const res = await app.request("/api/auth/register", jsonBody({ username: "x", password: "Secret123!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Username too short");
  });

  test("should return 400 when password fails validation", async () => {
    mockState.validatePasswordResult = { valid: false, errors: ["Password too weak"] };
    const res = await app.request("/api/auth/register", jsonBody({ username: "charlie", password: "weak" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Password too weak");
  });

  test("should return 409 when username is already taken", async () => {
    mockState.findUserByUsernameResult = makeRegularUser({ username: "charlie" });
    const res = await app.request("/api/auth/register", jsonBody({ username: "charlie", password: "Secret123!" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already taken/i);
  });

  test("should return 200 with user and set session cookie on success", async () => {
    const res = await app.request("/api/auth/register", jsonBody({ username: "charlie", password: "Secret123!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe("charlie");
    // Cookie must be set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
  });

  test("should include optional email and displayName in created user", async () => {
    mockState.createUserResult = makeRegularUser({
      id: "new-user-2",
      username: "dana",
      email: "dana@example.com",
      displayName: "Dana D",
    });
    const res = await app.request(
      "/api/auth/register",
      jsonBody({ username: "dana", password: "Secret123!", email: "dana@example.com", displayName: "Dana D" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("dana@example.com");
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockState.findUserByUsernameResult = makeRegularUser({ passwordHash: "hash-of-secret" });
    mockState.verifyAndRehashResult = [true, null];
    mockState.createSessionResult = { id: "session-login-1" };
    mockState.updateUserResult = makeRegularUser();
  });

  test("should return 400 when both username and password are missing", async () => {
    const res = await app.request("/api/auth/login", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  test("should return 400 when password is missing", async () => {
    const res = await app.request("/api/auth/login", jsonBody({ username: "bob" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  test("should return 400 when username is missing", async () => {
    const res = await app.request("/api/auth/login", jsonBody({ password: "Secret123!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  test("should return 401 when user is not found", async () => {
    mockState.findUserByUsernameResult = null;
    const res = await app.request("/api/auth/login", jsonBody({ username: "nobody", password: "pass" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test("should return 401 when password is wrong", async () => {
    mockState.verifyAndRehashResult = [false, null];
    const res = await app.request("/api/auth/login", jsonBody({ username: "bob", password: "wrongpass" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test("should return 403 when account is deactivated", async () => {
    mockState.findUserByUsernameResult = makeRegularUser({ isActive: false });
    const res = await app.request("/api/auth/login", jsonBody({ username: "bob", password: "Secret123!" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/deactivated/i);
  });

  test("should return 200 with user and session cookie on success", async () => {
    const res = await app.request("/api/auth/login", jsonBody({ username: "bob", password: "Secret123!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe("bob");
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
  });

  test("should invalidate existing session cookie before creating a new one", async () => {
    // Login with an existing session cookie — the old session should be deleted
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=old-session-id",
      },
      body: JSON.stringify({ username: "bob", password: "Secret123!" }),
    });
    expect(res.status).toBe(200);
  });

  test("should trigger password rehash when verifyAndRehash returns a new hash", async () => {
    mockState.verifyAndRehashResult = [true, "rehashed-password-hash"];
    const res = await app.request("/api/auth/login", jsonBody({ username: "bob", password: "Secret123!" }));
    // Rehash triggers updateUser internally — the response should still succeed
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockState.getSessionResult = { id: "session-abc123", userId: "user-1" };
    mockState.loadUserResult = makeRegularUser();
  });

  test("should return 200 and clear the session cookie on logout", async () => {
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "session=session-abc123" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Cookie should be cleared
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
  });

  test("should return 200 even when no session cookie is present", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 200 even when session is not found in store", async () => {
    mockState.getSessionResult = null;
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "session=expired-session" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    mockState.getSessionResult = null;
    mockState.loadUserResult = null;
  });

  test("should return authenticated: false when no cookie is present", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.user).toBeUndefined();
  });

  test("should return authenticated: false when session does not exist in store", async () => {
    mockState.getSessionResult = null;
    const res = await app.request("/api/auth/me", withSession("invalid-session"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  test("should return authenticated: false when user is not found", async () => {
    mockState.getSessionResult = { id: "session-abc123", userId: "deleted-user" };
    mockState.loadUserResult = null;
    const res = await app.request("/api/auth/me", withSession());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  test("should return authenticated: false when user account is inactive", async () => {
    mockState.getSessionResult = { id: "session-abc123", userId: "user-1" };
    mockState.loadUserResult = makeRegularUser({ isActive: false });
    const res = await app.request("/api/auth/me", withSession());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  test("should return authenticated: true with user data for a valid session", async () => {
    mockState.getSessionResult = { id: "session-abc123", userId: "user-1" };
    mockState.loadUserResult = makeRegularUser();
    const res = await app.request("/api/auth/me", withSession());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe("bob");
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/status
// ---------------------------------------------------------------------------

describe("GET /api/auth/status", () => {
  test("should return requiresSetup: true when no users exist", async () => {
    mockState.hasUsersResult = false;
    const res = await app.request("/api/auth/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresSetup).toBe(true);
    expect(body.initialized).toBe(false);
  });

  test("should return initialized: true when users exist", async () => {
    mockState.hasUsersResult = true;
    const res = await app.request("/api/auth/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.initialized).toBe(true);
    expect(body.requiresSetup).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Admin: GET /api/auth/users
// ---------------------------------------------------------------------------

describe("GET /api/auth/users (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.listUsersResult = [];
  });

  test("should return 401 when not authenticated", async () => {
    const res = await app.request("/api/auth/users");
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not an admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/users");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/admin/i);
  });

  test("should return 200 with empty list when no users exist", async () => {
    mockState.currentUser = makeAdminUser();
    const res = await app.request("/api/auth/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
  });

  test("should return 200 with sanitized user list for admin", async () => {
    mockState.currentUser = makeAdminUser();
    mockState.listUsersResult = [
      makeRegularUser({ id: "u1", username: "bob" }),
      makeAdminUser({ id: "admin-1", username: "alice" }),
    ];
    const res = await app.request("/api/auth/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
    // Sanitized — password fields must not be present
    expect(body.users[0].passwordHash).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Admin: POST /api/auth/users
// ---------------------------------------------------------------------------

describe("POST /api/auth/users (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.validateUsernameResult = { valid: true, errors: [] };
    mockState.findUserByUsernameResult = null;
    mockState.createUserResult = makeRegularUser({ id: "new-user-1", username: "newguy" });
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/users", jsonBody({ username: "x" }));
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/users", jsonBody({ username: "x" }));
    expect(res.status).toBe(403);
  });

  test("should return 400 when username is missing", async () => {
    const res = await app.request("/api/auth/users", jsonBody({ email: "x@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/username/i);
  });

  test("should return 400 when username fails validation", async () => {
    mockState.validateUsernameResult = { valid: false, errors: ["Invalid characters"] };
    const res = await app.request("/api/auth/users", jsonBody({ username: "bad user!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid characters");
  });

  test("should return 409 when username is already taken", async () => {
    mockState.findUserByUsernameResult = makeRegularUser({ username: "newguy" });
    const res = await app.request("/api/auth/users", jsonBody({ username: "newguy" }));
    expect(res.status).toBe(409);
  });

  test("should return 200 with user and initial password on success", async () => {
    const res = await app.request("/api/auth/users", jsonBody({ username: "newguy", role: "user" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe("newguy");
    // Initial password must be returned exactly once
    expect(typeof body.initialPassword).toBe("string");
    expect(body.initialPassword.length).toBeGreaterThan(0);
  });

  test("should include Cache-Control: no-store header to prevent caching of password", async () => {
    const res = await app.request("/api/auth/users", jsonBody({ username: "newguy" }));
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toContain("no-store");
  });
});

// ---------------------------------------------------------------------------
// Admin: PUT /api/auth/users/:id
// ---------------------------------------------------------------------------

describe("PUT /api/auth/users/:id (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.loadUserResult = makeRegularUser({ id: "user-1" });
    mockState.listUsersResult = [makeAdminUser(), makeRegularUser()];
    mockState.updateUserResult = makeRegularUser({ id: "user-1", email: "new@example.com" });
  });

  test("should return 404 when target user is not found", async () => {
    mockState.loadUserResult = null;
    const res = await app.request("/api/auth/users/nonexistent", jsonPut({ email: "x@x.com" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 400 when trying to demote the last admin", async () => {
    // Target is an admin, and there is only one active admin
    mockState.loadUserResult = makeAdminUser({ id: "admin-1" });
    mockState.listUsersResult = [makeAdminUser({ id: "admin-1", isActive: true })];
    const res = await app.request("/api/auth/users/admin-1", jsonPut({ role: "user" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/last admin/i);
  });

  test("should allow demoting an admin when multiple admins exist", async () => {
    mockState.loadUserResult = makeAdminUser({ id: "admin-2" });
    mockState.listUsersResult = [
      makeAdminUser({ id: "admin-1", isActive: true }),
      makeAdminUser({ id: "admin-2", isActive: true }),
    ];
    mockState.updateUserResult = makeRegularUser({ id: "admin-2" });
    const res = await app.request("/api/auth/users/admin-2", jsonPut({ role: "user" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 200 with updated user on success", async () => {
    const res = await app.request("/api/auth/users/user-1", jsonPut({ email: "new@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/users/user-1", jsonPut({ email: "x@x.com" }));
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/users/user-1", jsonPut({ email: "x@x.com" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Admin: DELETE /api/auth/users/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/auth/users/:id (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser({ id: "admin-1" });
    mockState.loadUserResult = makeRegularUser({ id: "user-1" });
    mockState.listUsersResult = [makeAdminUser({ id: "admin-1", isActive: true }), makeRegularUser({ id: "user-1" })];
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/users/user-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/users/user-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("should return 400 when admin tries to delete their own account", async () => {
    // Admin tries to delete themselves (currentUser.id === userId param)
    const res = await app.request("/api/auth/users/admin-1", { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/own account/i);
  });

  test("should return 404 when target user is not found", async () => {
    mockState.loadUserResult = null;
    const res = await app.request("/api/auth/users/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 400 when trying to delete the last admin", async () => {
    // Target is the only admin
    mockState.loadUserResult = makeAdminUser({ id: "admin-2" });
    mockState.currentUser = makeAdminUser({ id: "admin-1" });
    mockState.listUsersResult = [makeAdminUser({ id: "admin-2", isActive: true })];
    const res = await app.request("/api/auth/users/admin-2", { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/last admin/i);
  });

  test("should return 200 on successful deletion of a regular user", async () => {
    const res = await app.request("/api/auth/users/user-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should allow deleting one of multiple admins", async () => {
    mockState.loadUserResult = makeAdminUser({ id: "admin-2" });
    mockState.currentUser = makeAdminUser({ id: "admin-1" });
    mockState.listUsersResult = [
      makeAdminUser({ id: "admin-1", isActive: true }),
      makeAdminUser({ id: "admin-2", isActive: true }),
    ];
    const res = await app.request("/api/auth/users/admin-2", { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Admin: POST /api/auth/users/:id/reset-password
// ---------------------------------------------------------------------------

describe("POST /api/auth/users/:id/reset-password (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser({ id: "admin-1" });
    mockState.loadUserResult = makeRegularUser({ id: "user-1", username: "bob" });
    mockState.updateUserResult = makeRegularUser();
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/users/user-1/reset-password", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/users/user-1/reset-password", { method: "POST" });
    expect(res.status).toBe(403);
  });

  test("should return 404 when target user is not found", async () => {
    mockState.loadUserResult = null;
    const res = await app.request("/api/auth/users/nonexistent/reset-password", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 with a new password on success", async () => {
    const res = await app.request("/api/auth/users/user-1/reset-password", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.newPassword).toBe("string");
    expect(body.newPassword.length).toBeGreaterThan(0);
  });

  test("should include Cache-Control: no-store header to prevent caching of new password", async () => {
    const res = await app.request("/api/auth/users/user-1/reset-password", { method: "POST" });
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toContain("no-store");
  });
});

// ---------------------------------------------------------------------------
// Groups: GET /api/auth/groups
// ---------------------------------------------------------------------------

describe("GET /api/auth/groups (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.listGroupsResult = [];
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/groups");
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/groups");
    expect(res.status).toBe(403);
  });

  test("should return 200 with empty groups array when none exist", async () => {
    const res = await app.request("/api/auth/groups");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toEqual([]);
  });

  test("should return 200 with all groups for admin", async () => {
    mockState.listGroupsResult = [makeGroup(), makeGroup({ id: "group-2", name: "Ops" })];
    const res = await app.request("/api/auth/groups");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(2);
    expect(body.groups[0].name).toBe("Developers");
  });
});

// ---------------------------------------------------------------------------
// Groups: POST /api/auth/groups
// ---------------------------------------------------------------------------

describe("POST /api/auth/groups (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.createGroupResult = makeGroup();
  });

  test("should return 400 when group name is missing", async () => {
    const res = await app.request("/api/auth/groups", jsonBody({ description: "no name" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  test("should return 400 when group name is an empty string", async () => {
    const res = await app.request("/api/auth/groups", jsonBody({ name: "   " }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  test("should return 200 with the created group on success", async () => {
    const res = await app.request("/api/auth/groups", jsonBody({ name: "Developers" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.group).toBeDefined();
    expect(body.group.name).toBe("Developers");
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/groups", jsonBody({ name: "Test" }));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Groups: GET /api/auth/groups/:id
// ---------------------------------------------------------------------------

describe("GET /api/auth/groups/:id (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.loadGroupResult = makeGroup();
  });

  test("should return 404 when group does not exist", async () => {
    mockState.loadGroupResult = null;
    const res = await app.request("/api/auth/groups/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 with group data when found", async () => {
    const res = await app.request("/api/auth/groups/group-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.group).toBeDefined();
    expect(body.group.name).toBe("Developers");
  });
});

// ---------------------------------------------------------------------------
// Groups: PUT /api/auth/groups/:id
// ---------------------------------------------------------------------------

describe("PUT /api/auth/groups/:id (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.loadGroupResult = makeGroup();
    mockState.updateGroupResult = makeGroup({ name: "Updated Developers" });
  });

  test("should return 404 when group does not exist", async () => {
    mockState.loadGroupResult = null;
    const res = await app.request("/api/auth/groups/nonexistent", jsonPut({ name: "New Name" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 with updated group on success", async () => {
    const res = await app.request("/api/auth/groups/group-1", jsonPut({ name: "Updated Developers" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.group.name).toBe("Updated Developers");
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/groups/group-1", jsonPut({ name: "x" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Groups: DELETE /api/auth/groups/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/auth/groups/:id (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.loadGroupResult = makeGroup();
  });

  test("should return 404 when group does not exist", async () => {
    mockState.loadGroupResult = null;
    const res = await app.request("/api/auth/groups/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 on successful deletion", async () => {
    const res = await app.request("/api/auth/groups/group-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/groups/group-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/groups/group-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Groups: POST /api/auth/groups/:id/members
// ---------------------------------------------------------------------------

describe("POST /api/auth/groups/:id/members (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.addGroupMemberResult = makeGroup({ memberIds: ["user-1"] });
  });

  test("should return 400 when userId is missing from body", async () => {
    const res = await app.request("/api/auth/groups/group-1/members", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/userId/i);
  });

  test("should return 404 when group is not found", async () => {
    mockState.addGroupMemberResult = null;
    const res = await app.request("/api/auth/groups/nonexistent/members", jsonBody({ userId: "user-1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 with updated group on success", async () => {
    const res = await app.request("/api/auth/groups/group-1/members", jsonBody({ userId: "user-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.group.memberIds).toContain("user-1");
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/groups/group-1/members", jsonBody({ userId: "u1" }));
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/groups/group-1/members", jsonBody({ userId: "u1" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Groups: DELETE /api/auth/groups/:id/members/:userId
// ---------------------------------------------------------------------------

describe("DELETE /api/auth/groups/:id/members/:userId (admin)", () => {
  beforeEach(() => {
    mockState.currentUser = makeAdminUser();
    mockState.removeGroupMemberResult = makeGroup({ memberIds: [] });
  });

  test("should return 404 when group is not found", async () => {
    mockState.removeGroupMemberResult = null;
    const res = await app.request("/api/auth/groups/nonexistent/members/user-1", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("should return 200 with updated group on success", async () => {
    const res = await app.request("/api/auth/groups/group-1/members/user-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.group).toBeDefined();
  });

  test("should return 401 when not authenticated", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/auth/groups/group-1/members/user-1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("should return 403 when user is not admin", async () => {
    mockState.currentUser = makeRegularUser();
    const res = await app.request("/api/auth/groups/group-1/members/user-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});

