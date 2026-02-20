/**
 * Tests for RBAC API routes (backend/src/routes/rbac.ts)
 *
 * Covers:
 *   GET    /:type/:id/access               - list permissions
 *   GET    /:type/:id/access/permissions   - current-user permissions
 *   POST   /:type/:id/access              - grant access
 *   PUT    /:type/:id/access/:pt/:pid     - update role
 *   DELETE /:type/:id/access/:pt/:pid     - revoke access
 *   POST   /:type/:id/access/transfer     - transfer ownership
 *   GET    /:type/:id/access/available-users
 *   GET    /:type/:id/access/available-groups
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests override relevant fields
// ---------------------------------------------------------------------------

const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },
  checkAccessResult: { allowed: true, effectiveRole: "owner" as string } as any,
  accessInfoResult: { users: [] as any[], groups: [] as any[] },
  userPermissionsResult: {
    role: "owner",
    permissions: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canManageAccess: true,
      canTransferOwnership: true,
    },
    isGlobalAdmin: false,
  },
  loadUserResult: null as any,
  loadGroupResult: null as any,
  listGroupsResult: [] as any[],
  grantAccessResult: {} as any,
  updateAccessRoleResult: null as any,
  revokeAccessResult: false,
  resourceOwnerResult: null as any,
  transferOwnershipResult: false,
  loadResourceAccessResult: [] as any[],
  listUsersResult: [] as any[],
};

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before importing the module under test
// ---------------------------------------------------------------------------

mock.module("../../auth/middleware", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  getCurrentUserId: (c: any) => c.get("userId"),
}));

mock.module("../../auth/storage", () => ({
  loadUser: async (_id: string) => mockState.loadUserResult,
  listUsers: async () => mockState.listUsersResult,
}));

mock.module("../../auth/groups", () => ({
  loadGroup: async (_id: string) => mockState.loadGroupResult,
  listGroups: async () => mockState.listGroupsResult,
}));

mock.module("../../rbac/storage", () => ({
  loadResourceAccess: async () => mockState.loadResourceAccessResult,
  grantAccess: async (..._args: any[]) => mockState.grantAccessResult,
  updateAccessRole: async (..._args: any[]) => mockState.updateAccessRoleResult,
  revokeAccess: async (..._args: any[]) => mockState.revokeAccessResult,
  getResourceOwner: async () => mockState.resourceOwnerResult,
  transferOwnership: async (..._args: any[]) => mockState.transferOwnershipResult,
}));

mock.module("../../rbac/accessControl", () => ({
  checkAccess: async () => mockState.checkAccessResult,
  getResourceAccessInfo: async () => mockState.accessInfoResult,
  getUserResourcePermissions: async () => mockState.userPermissionsResult,
}));

mock.module("../../rbac/types", () => ({
  RESOURCE_PERMISSIONS: {},
  getAssignableRoles: (role: string) =>
    role === "owner" || role === "admin"
      ? ["admin", "editor", "viewer"]
      : [],
}));

mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------

const { rbacRoutes } = await import("../rbac");

const app = new Hono();
app.route("/api/resources", rbacRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser() {
  return { id: "user-1", username: "alice", role: "admin" };
}

function makeUserRecord(overrides: Partial<any> = {}): any {
  return {
    id: "user-1",
    username: "alice",
    displayName: "Alice",
    email: "alice@example.com",
    ...overrides,
  };
}

function makeGroupRecord(overrides: Partial<any> = {}): any {
  return {
    id: "group-1",
    name: "Editors",
    description: "The editor group",
    memberIds: ["user-1", "user-2"],
    ...overrides,
  };
}

function makeAccessEntry(overrides: Partial<any> = {}): any {
  return {
    principalType: "user",
    principalId: "user-1",
    role: "owner",
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantedBy: "user-1",
    ...overrides,
  };
}

function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putJson(path: string, body: unknown) {
  return app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(path: string) {
  return app.request(path, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Default per-test reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.currentUser = null;
  mockState.checkAccessResult = { allowed: true, effectiveRole: "owner" };
  mockState.accessInfoResult = { users: [], groups: [] };
  mockState.userPermissionsResult = {
    role: "owner",
    permissions: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canManageAccess: true,
      canTransferOwnership: true,
    },
    isGlobalAdmin: false,
  };
  mockState.loadUserResult = null;
  mockState.loadGroupResult = null;
  mockState.listGroupsResult = [];
  mockState.grantAccessResult = {};
  mockState.updateAccessRoleResult = null;
  mockState.revokeAccessResult = false;
  mockState.resourceOwnerResult = null;
  mockState.transferOwnershipResult = false;
  mockState.loadResourceAccessResult = [];
  mockState.listUsersResult = [];
});

// ===========================================================================
// 1. Auth & Access guards
// ===========================================================================

describe("Auth & Access", () => {
  test("should return 401 without an active session", async () => {
    // currentUser is null by default
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("should return 400 for an invalid resource type", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/resources/invalidtype/res-1/access");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Ressourcentyp");
  });

  test("should allow access for authenticated user with valid resource type", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(200);
  });

  test("should accept all valid resource types", async () => {
    mockState.currentUser = makeUser();
    const validTypes = ["space", "collection", "contract", "skill", "agent"];
    for (const type of validTypes) {
      const res = await app.request(`/api/resources/${type}/res-1/access`);
      expect(res.status).not.toBe(400);
    }
  });
});

// ===========================================================================
// 2. GET /:type/:id/access
// ===========================================================================

describe("GET /:type/:id/access", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
  });

  test("should return 200 with empty users and groups", async () => {
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
    expect(body.groups).toEqual([]);
  });

  test("should return 403 when user does not have view permission", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should include currentUser permissions in response", async () => {
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentUser).toHaveProperty("role");
    expect(body.currentUser).toHaveProperty("permissions");
    expect(body.currentUser).toHaveProperty("isGlobalAdmin");
    expect(body.currentUser).toHaveProperty("canManageAccess");
  });

  test("should enrich user access entries with displayName and username", async () => {
    mockState.accessInfoResult = {
      users: [{ principalId: "user-1", principalType: "user", role: "editor" }],
      groups: [],
    };
    mockState.loadUserResult = makeUserRecord({
      username: "alice",
      displayName: "Alice Smith",
    });

    const res = await app.request("/api/resources/space/res-1/access");
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].displayName).toBe("Alice Smith");
    expect(body.users[0].username).toBe("alice");
  });

  test("should fall back to 'Unbekannter Benutzer' when user record is missing", async () => {
    mockState.accessInfoResult = {
      users: [{ principalId: "ghost", principalType: "user", role: "viewer" }],
      groups: [],
    };
    mockState.loadUserResult = null;

    const res = await app.request("/api/resources/space/res-1/access");
    const body = await res.json();
    expect(body.users[0].displayName).toBe("Unbekannter Benutzer");
  });

  test("should enrich group access entries with name and memberCount", async () => {
    mockState.accessInfoResult = {
      users: [],
      groups: [{ principalId: "group-1", principalType: "group", role: "editor" }],
    };
    mockState.loadGroupResult = makeGroupRecord({
      name: "Editors",
      memberIds: ["u1", "u2", "u3"],
    });

    const res = await app.request("/api/resources/space/res-1/access");
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].name).toBe("Editors");
    expect(body.groups[0].memberCount).toBe(3);
  });

  test("should fall back to 'Unbekannte Gruppe' when group record is missing", async () => {
    mockState.accessInfoResult = {
      users: [],
      groups: [{ principalId: "ghost-group", principalType: "group", role: "viewer" }],
    };
    mockState.loadGroupResult = null;

    const res = await app.request("/api/resources/space/res-1/access");
    const body = await res.json();
    expect(body.groups[0].name).toBe("Unbekannte Gruppe");
    expect(body.groups[0].memberCount).toBe(0);
  });

  test("should set canManageAccess to true when isGlobalAdmin is true", async () => {
    mockState.userPermissionsResult = {
      role: "viewer",
      permissions: {
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        canTransferOwnership: false,
      },
      isGlobalAdmin: true,
    };

    const res = await app.request("/api/resources/space/res-1/access");
    const body = await res.json();
    expect(body.currentUser.canManageAccess).toBe(true);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/resources/space/res-1/access");
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 3. GET /:type/:id/access/permissions
// ===========================================================================

describe("GET /:type/:id/access/permissions", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
  });

  test("should return 200 with role and permissions", async () => {
    const res = await app.request("/api/resources/space/res-1/access/permissions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(body.permissions).toHaveProperty("canView");
    expect(body.permissions).toHaveProperty("canEdit");
    expect(body.permissions).toHaveProperty("canManageAccess");
    expect(body.isGlobalAdmin).toBe(false);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/resources/space/res-1/access/permissions");
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await app.request("/api/resources/badtype/res-1/access/permissions");
    expect(res.status).toBe(400);
  });

  test("should reflect viewer role when user has only view permission", async () => {
    mockState.userPermissionsResult = {
      role: "viewer",
      permissions: {
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        canTransferOwnership: false,
      },
      isGlobalAdmin: false,
    };

    const res = await app.request("/api/resources/agent/res-2/access/permissions");
    const body = await res.json();
    expect(body.role).toBe("viewer");
    expect(body.permissions.canEdit).toBe(false);
    expect(body.permissions.canManageAccess).toBe(false);
  });

  test("should include isGlobalAdmin flag in response", async () => {
    mockState.userPermissionsResult = {
      role: "viewer",
      permissions: {
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
        canTransferOwnership: false,
      },
      isGlobalAdmin: true,
    };

    const res = await app.request("/api/resources/skill/res-3/access/permissions");
    const body = await res.json();
    expect(body.isGlobalAdmin).toBe(true);
  });
});

// ===========================================================================
// 4. POST /:type/:id/access — grant access
// ===========================================================================

describe("POST /:type/:id/access", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.loadUserResult = makeUserRecord();
    mockState.grantAccessResult = makeAccessEntry({ role: "editor" });
  });

  test("should return 201 when access is granted successfully", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(201);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await postJson("/api/resources/badtype/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(400);
  });

  test("should return 403 when user lacks canManageAccess permission", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Berechtigung");
  });

  test("should return 400 when principalType is missing", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("erforderlich");
  });

  test("should return 400 when principalId is missing", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      role: "editor",
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when role is missing", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 for invalid principalType", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "robot",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Principal-Typ");
  });

  test("should return 400 for invalid role", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "superadmin",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Rolle");
  });

  test("should return 400 when trying to assign owner role", async () => {
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "owner",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Owner-Rolle");
  });

  test("should return 404 when target user does not exist", async () => {
    mockState.loadUserResult = null;
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "ghost",
      role: "editor",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Benutzer");
  });

  test("should return 404 when target group does not exist", async () => {
    mockState.loadGroupResult = null;
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "group",
      principalId: "ghost-group",
      role: "editor",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Gruppe");
  });

  test("should return 403 when assigner role cannot grant the requested role", async () => {
    // effectiveRole "editor" can grant nothing (getAssignableRoles returns [])
    mockState.checkAccessResult = { allowed: true, effectiveRole: "editor" };
    const res = await postJson("/api/resources/space/res-1/access", {
      principalType: "user",
      principalId: "user-2",
      role: "editor",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Rolle");
  });

  test("should succeed when granting access to a group", async () => {
    mockState.loadGroupResult = makeGroupRecord();
    const res = await postJson("/api/resources/agent/res-1/access", {
      principalType: "group",
      principalId: "group-1",
      role: "viewer",
    });
    expect(res.status).toBe(201);
  });
});

// ===========================================================================
// 5. PUT /:type/:id/access/:principalType/:principalId — update role
// ===========================================================================

describe("PUT /:type/:id/access/:principalType/:principalId", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.updateAccessRoleResult = makeAccessEntry({ role: "admin" });
  });

  test("should return 200 with updated access entry", async () => {
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "admin" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "admin" }
    );
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await putJson(
      "/api/resources/badtype/res-1/access/user/user-2",
      { role: "admin" }
    );
    expect(res.status).toBe(400);
  });

  test("should return 400 for invalid principalType in path", async () => {
    const res = await putJson(
      "/api/resources/space/res-1/access/machine/user-2",
      { role: "admin" }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Principal-Typ");
  });

  test("should return 403 when user lacks canManageAccess permission", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "editor" }
    );
    expect(res.status).toBe(403);
  });

  test("should return 400 when role is missing in body", async () => {
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      {}
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("role");
  });

  test("should return 400 for invalid role value", async () => {
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "superadmin" }
    );
    expect(res.status).toBe(400);
  });

  test("should return 400 when trying to change role to owner", async () => {
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "owner" }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Owner-Rolle");
  });

  test("should return 400 when trying to modify the owner's role", async () => {
    mockState.resourceOwnerResult = makeAccessEntry({
      principalType: "user",
      principalId: "user-2",
      role: "owner",
    });
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "admin" }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Eigentümers");
  });

  test("should return 400 when user tries to modify their own role", async () => {
    // currentUser.id === "user-1", principalId in path === "user-1"
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-1",
      { role: "editor" }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Eigene Rolle");
  });

  test("should return 404 when access entry does not exist", async () => {
    mockState.updateAccessRoleResult = null;
    const res = await putJson(
      "/api/resources/space/res-1/access/user/user-2",
      { role: "editor" }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nicht gefunden");
  });
});

// ===========================================================================
// 6. DELETE /:type/:id/access/:principalType/:principalId — revoke access
// ===========================================================================

describe("DELETE /:type/:id/access/:principalType/:principalId", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.revokeAccessResult = true;
  });

  test("should return 200 with success=true when access is revoked", async () => {
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-2");
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await deleteReq("/api/resources/badtype/res-1/access/user/user-2");
    expect(res.status).toBe(400);
  });

  test("should return 400 for invalid principalType in path", async () => {
    const res = await deleteReq("/api/resources/space/res-1/access/machine/user-2");
    expect(res.status).toBe(400);
  });

  test("should return 403 when user lacks canManageAccess permission", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-2");
    expect(res.status).toBe(403);
  });

  test("should return 400 when trying to remove the owner", async () => {
    mockState.resourceOwnerResult = makeAccessEntry({
      principalType: "user",
      principalId: "user-2",
      role: "owner",
    });
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-2");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Eigentümer");
  });

  test("should return 400 when user tries to remove their own access", async () => {
    // currentUser.id === "user-1", principalId in path === "user-1"
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-1");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Eigene");
  });

  test("should return 404 when access entry does not exist", async () => {
    mockState.revokeAccessResult = false;
    const res = await deleteReq("/api/resources/space/res-1/access/user/user-2");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nicht gefunden");
  });

  test("should allow removing group access", async () => {
    const res = await deleteReq("/api/resources/space/res-1/access/group/group-1");
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// 7. POST /:type/:id/access/transfer — transfer ownership
// ===========================================================================

describe("POST /:type/:id/access/transfer", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.checkAccessResult = { allowed: true, effectiveRole: "owner" };
    mockState.loadUserResult = makeUserRecord({ id: "user-2", username: "bob" });
    mockState.transferOwnershipResult = true;
  });

  test("should return 200 with success=true and newOwnerId", async () => {
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "user-2",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.newOwnerId).toBe("user-2");
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "user-2",
    });
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await postJson("/api/resources/badtype/res-1/access/transfer", {
      newOwnerId: "user-2",
    });
    expect(res.status).toBe(400);
  });

  test("should return 403 when user does not have canTransferOwnership", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: "admin" };
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "user-2",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Eigentümer");
  });

  test("should return 400 when newOwnerId is missing", async () => {
    const res = await postJson("/api/resources/space/res-1/access/transfer", {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("newOwnerId");
  });

  test("should return 404 when new owner user does not exist", async () => {
    mockState.loadUserResult = null;
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "ghost",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Eigentümer");
  });

  test("should return 400 when trying to transfer ownership to self", async () => {
    // currentUser.id === "user-1", newOwnerId === "user-1"
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "user-1",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("bereits der Eigentümer");
  });

  test("should return 500 when transferOwnership returns false", async () => {
    mockState.transferOwnershipResult = false;
    const res = await postJson("/api/resources/space/res-1/access/transfer", {
      newOwnerId: "user-2",
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ===========================================================================
// 8. GET /:type/:id/access/available-users
// ===========================================================================

describe("GET /:type/:id/access/available-users", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listUsersResult = [
      { id: "user-1", username: "alice", displayName: "Alice", email: "alice@example.com" },
      { id: "user-2", username: "bob", displayName: "Bob", email: "bob@example.com" },
      { id: "user-3", username: "charlie", displayName: "Charlie", email: "charlie@example.com" },
    ];
    // user-1 already has access
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalType: "user", principalId: "user-1" }),
    ];
  });

  test("should return 200 with available users list", async () => {
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
    expect(Array.isArray(body.users)).toBe(true);
  });

  test("should filter out users who already have access", async () => {
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    const body = await res.json();
    // user-1 already has access; only user-2 and user-3 should appear
    expect(body.users).toHaveLength(2);
    const ids = body.users.map((u: any) => u.id);
    expect(ids).not.toContain("user-1");
    expect(ids).toContain("user-2");
    expect(ids).toContain("user-3");
  });

  test("should return all users when none have access yet", async () => {
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    const body = await res.json();
    expect(body.users).toHaveLength(3);
  });

  test("should include id, username, displayName and email fields", async () => {
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    const body = await res.json();
    const user = body.users[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("displayName");
    expect(user).toHaveProperty("email");
  });

  test("should return empty users array when all users already have access", async () => {
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalId: "user-1" }),
      makeAccessEntry({ principalId: "user-2" }),
      makeAccessEntry({ principalId: "user-3" }),
    ];
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    const body = await res.json();
    expect(body.users).toHaveLength(0);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await app.request("/api/resources/badtype/res-1/access/available-users");
    expect(res.status).toBe(400);
  });

  test("should return 403 when user lacks canManageAccess", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    expect(res.status).toBe(403);
  });

  test("should not include group access entries in user filter", async () => {
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalType: "group", principalId: "user-2" }),
    ];
    const res = await app.request("/api/resources/space/res-1/access/available-users");
    const body = await res.json();
    // group entry should not filter out the user with same id
    const ids = body.users.map((u: any) => u.id);
    expect(ids).toContain("user-2");
  });
});

// ===========================================================================
// 9. GET /:type/:id/access/available-groups
// ===========================================================================

describe("GET /:type/:id/access/available-groups", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.listGroupsResult = [
      { id: "group-1", name: "Editors", description: "Editor group", memberIds: ["u1", "u2"] },
      { id: "group-2", name: "Viewers", description: "Viewer group", memberIds: ["u3"] },
      { id: "group-3", name: "Admins", description: "Admin group", memberIds: [] },
    ];
    // group-1 already has access
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalType: "group", principalId: "group-1" }),
    ];
  });

  test("should return 200 with available groups list", async () => {
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("groups");
    expect(Array.isArray(body.groups)).toBe(true);
  });

  test("should filter out groups that already have access", async () => {
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    expect(body.groups).toHaveLength(2);
    const ids = body.groups.map((g: any) => g.id);
    expect(ids).not.toContain("group-1");
    expect(ids).toContain("group-2");
    expect(ids).toContain("group-3");
  });

  test("should return all groups when none have access yet", async () => {
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    expect(body.groups).toHaveLength(3);
  });

  test("should include id, name, description and memberCount fields", async () => {
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    const group = body.groups[0];
    expect(group).toHaveProperty("id");
    expect(group).toHaveProperty("name");
    expect(group).toHaveProperty("description");
    expect(group).toHaveProperty("memberCount");
  });

  test("should return correct memberCount derived from memberIds", async () => {
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    const editorsGroup = body.groups.find((g: any) => g.id === "group-1");
    expect(editorsGroup.memberCount).toBe(2);
    const adminsGroup = body.groups.find((g: any) => g.id === "group-3");
    expect(adminsGroup.memberCount).toBe(0);
  });

  test("should return 0 memberCount when group has no memberIds", async () => {
    mockState.listGroupsResult = [
      { id: "group-x", name: "Empty", description: "", memberIds: undefined },
    ];
    mockState.loadResourceAccessResult = [];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    expect(body.groups[0].memberCount).toBe(0);
  });

  test("should return empty groups array when all groups already have access", async () => {
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalType: "group", principalId: "group-1" }),
      makeAccessEntry({ principalType: "group", principalId: "group-2" }),
      makeAccessEntry({ principalType: "group", principalId: "group-3" }),
    ];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    expect(body.groups).toHaveLength(0);
  });

  test("should return 401 without session", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    expect(res.status).toBe(401);
  });

  test("should return 400 for invalid resource type", async () => {
    const res = await app.request("/api/resources/badtype/res-1/access/available-groups");
    expect(res.status).toBe(400);
  });

  test("should return 403 when user lacks canManageAccess", async () => {
    mockState.checkAccessResult = { allowed: false, effectiveRole: null };
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    expect(res.status).toBe(403);
  });

  test("should not include user access entries in group filter", async () => {
    mockState.loadResourceAccessResult = [
      makeAccessEntry({ principalType: "user", principalId: "group-2" }),
    ];
    const res = await app.request("/api/resources/space/res-1/access/available-groups");
    const body = await res.json();
    // user entry with same id should not filter out group-2
    const ids = body.groups.map((g: any) => g.id);
    expect(ids).toContain("group-2");
  });
});
