/**
 * Tests for tables API routes (backend/src/routes/tables.ts)
 *
 * All routes require auth middleware.
 * Service dependencies (tableService, views, relations, importExport) are
 * mocked at the module level so tests remain fast and deterministic.
 *
 * BUG NOTE 1: The route `POST /import/backup` (line 748 in tables.ts) is
 * unreachable because `POST /:id/backup` (line 730) is registered first and
 * Hono matches `:id=import` for the path /import/backup. The tests for that
 * describe block document the actual (broken) behavior to make the bug
 * visible. Fix: register POST /import/backup before POST /:id/backup.
 *
 * BUG NOTE 2: The route `PUT /:id/columns/order` (line 281 in tables.ts) is
 * unreachable because `PUT /:id/columns/:columnId` (line 243) is registered
 * first and Hono matches `columnId=order`. Fix: register
 * PUT /:id/columns/order before PUT /:id/columns/:columnId.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Shared mutable mock state so individual tests can override return values
const mockState = {
  currentUser: null as null | { id: string; username: string; role: string },

  // tableService mocks
  listTablesResult: [] as any[],
  listTablesWithStatsResult: [] as any[],
  listTemplatesResult: [] as any[],
  applyTemplateResult: [] as any[],
  getTableResult: null as any,
  getTableWithDataResult: null as any,
  createTableResult: null as any,
  updateTableResult: null as any,
  deleteTableResult: true,
  addColumnResult: null as any,
  updateColumnResult: null as any,
  deleteColumnResult: null as any,
  reorderColumnsResult: null as any,
  queryRowsResult: { rows: [], total: 0, offset: 0, limit: 50 } as any,
  addRowResult: null as any,
  getRowResult: null as any,
  updateRowResult: null as any,
  deleteRowResult: true,
  deleteRowsResult: 0,

  // views mocks
  getViewsResult: [] as any[],
  createViewResult: null as any,
  getViewResult: null as any,
  updateViewResult: null as any,
  deleteViewResult: true,
  executeViewResult: { rows: [], total: 0, offset: 0, limit: 50 } as any,

  // relations mocks
  hasIncomingReferencesResult: false,
  getTableRelationsResult: [] as any[],
  getReverseRelationsResult: [] as any[],
  getRelationOptionsResult: [] as any[],
  deleteRowWithCascadeResult: { deletedCount: 1, updatedCount: 0 } as any,

  // importExport mocks
  exportTableResult: "exported content",
  importDataResult: { imported: 1, updated: 0, skipped: 0, errors: [] } as any,
  previewImportResult: { headers: [], rows: [] } as any,
  exportTableBackupResult: "backup content",
  importTableBackupResult: null as any,

  // error triggers
  tableServiceError: null as Error | null,
  viewsError: null as Error | null,
  relationsError: null as Error | null,
  importExportError: null as Error | null,
};

// Mock auth — injects mockState.currentUser into context
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

// Mock tables module
mock.module("../../tables", () => ({
  tableService: {
    listTables: async () => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.listTablesResult;
    },
    listTablesWithStats: async () => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.listTablesWithStatsResult;
    },
    listTemplates: async () => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.listTemplatesResult;
    },
    applyTemplate: async (_id: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.applyTemplateResult;
    },
    getTable: async (_id: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.getTableResult;
    },
    getTableWithData: async (_id: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.getTableWithDataResult;
    },
    createTable: async (_params: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.createTableResult;
    },
    updateTable: async (_id: string, _params: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.updateTableResult;
    },
    deleteTable: async (_id: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.deleteTableResult;
    },
    addColumn: async (_tableId: string, _column: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.addColumnResult;
    },
    updateColumn: async (_tableId: string, _columnId: string, _updates: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.updateColumnResult;
    },
    deleteColumn: async (_tableId: string, _columnId: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.deleteColumnResult;
    },
    reorderColumns: async (_tableId: string, _columnIds: string[]) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.reorderColumnsResult;
    },
    queryRows: async (_tableId: string, _options: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.queryRowsResult;
    },
    addRow: async (_tableId: string, _params: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.addRowResult;
    },
    getRow: async (_tableId: string, _rowId: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.getRowResult;
    },
    updateRow: async (_tableId: string, _params: any) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.updateRowResult;
    },
    deleteRow: async (_tableId: string, _rowId: string) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.deleteRowResult;
    },
    deleteRows: async (_tableId: string, _rowIds: string[]) => {
      if (mockState.tableServiceError) throw mockState.tableServiceError;
      return mockState.deleteRowsResult;
    },
  },
  views: {
    getViews: async (_tableId: string) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.getViewsResult;
    },
    createView: async (_tableId: string, _params: any) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.createViewResult;
    },
    getView: async (_tableId: string, _viewId: string) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.getViewResult;
    },
    updateView: async (_tableId: string, _viewId: string, _params: any) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.updateViewResult;
    },
    deleteView: async (_tableId: string, _viewId: string) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.deleteViewResult;
    },
    executeView: async (_tableId: string, _viewId: string, _options: any) => {
      if (mockState.viewsError) throw mockState.viewsError;
      return mockState.executeViewResult;
    },
  },
  relations: {
    hasIncomingReferences: async (_tableId: string) => {
      if (mockState.relationsError) throw mockState.relationsError;
      return mockState.hasIncomingReferencesResult;
    },
    getTableRelations: async (_tableId: string) => {
      if (mockState.relationsError) throw mockState.relationsError;
      return mockState.getTableRelationsResult;
    },
    getReverseRelations: async (_tableId: string) => {
      if (mockState.relationsError) throw mockState.relationsError;
      return mockState.getReverseRelationsResult;
    },
    getRelationOptions: async (_table: string, _displayCol: any, _search: any, _limit: number) => {
      if (mockState.relationsError) throw mockState.relationsError;
      return mockState.getRelationOptionsResult;
    },
    deleteRowWithCascade: async (_tableId: string, _rowId: string, _opts: any) => {
      if (mockState.relationsError) throw mockState.relationsError;
      return mockState.deleteRowWithCascadeResult;
    },
  },
  importExport: {
    exportTable: async (_tableId: string, _options: any) => {
      if (mockState.importExportError) throw mockState.importExportError;
      return mockState.exportTableResult;
    },
    importData: async (_tableId: string, _content: string, _options: any) => {
      if (mockState.importExportError) throw mockState.importExportError;
      return mockState.importDataResult;
    },
    previewImport: async (_tableId: string, _content: string, _format: string, _limit: number) => {
      if (mockState.importExportError) throw mockState.importExportError;
      return mockState.previewImportResult;
    },
    exportTableBackup: async (_tableId: string) => {
      if (mockState.importExportError) throw mockState.importExportError;
      return mockState.exportTableBackupResult;
    },
    importTableBackup: async (_content: string, _overwrite: boolean) => {
      if (mockState.importExportError) throw mockState.importExportError;
      return mockState.importTableBackupResult;
    },
  },
  storage: {},
}));

// Mock error handler
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _error: any) =>
    c.json({ error: "Internal Server Error" }, 500),
}));

// Mock parseIntSafe (use the real implementation — it has no side effects)
mock.module("../../utils/parseIntSafe", () => ({
  parseIntSafe: (value: string | undefined | null, defaultValue: number): number => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  },
}));

// ---------------------------------------------------------------------------
// Import routes AFTER mocks are registered
// ---------------------------------------------------------------------------
const { tablesRoutes } = await import("../tables");

const app = new Hono();
app.route("/api/tables", tablesRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; username: string; role: string }> = {}) {
  return { id: "user-1", username: "alice", role: "user", ...overrides };
}

function makeTable(overrides: Partial<any> = {}): any {
  return {
    id: "tbl-1",
    name: "Test Table",
    columns: [
      { id: "col-1", name: "Name", type: "text" },
    ],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRow(overrides: Partial<any> = {}): any {
  return {
    _id: "row-1",
    _created_at: "2026-01-01T00:00:00.000Z",
    _updated_at: "2026-01-01T00:00:00.000Z",
    name: "Alice",
    ...overrides,
  };
}

function makeView(overrides: Partial<any> = {}): any {
  return {
    id: "view-1",
    name: "Active Items",
    filter: "name contains Alice",
    ...overrides,
  };
}

function jsonBody(obj: any): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function putBody(obj: any): RequestInit {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function deleteBody(obj: any): RequestInit {
  return {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

// Reset all mock state before each test
function resetMockState() {
  mockState.currentUser = makeUser();
  mockState.listTablesResult = [];
  mockState.listTablesWithStatsResult = [];
  mockState.listTemplatesResult = [];
  mockState.applyTemplateResult = [];
  mockState.getTableResult = null;
  mockState.getTableWithDataResult = null;
  mockState.createTableResult = null;
  mockState.updateTableResult = null;
  mockState.deleteTableResult = true;
  mockState.addColumnResult = null;
  mockState.updateColumnResult = null;
  mockState.deleteColumnResult = null;
  mockState.reorderColumnsResult = null;
  mockState.queryRowsResult = { rows: [], total: 0, offset: 0, limit: 50 };
  mockState.addRowResult = null;
  mockState.getRowResult = null;
  mockState.updateRowResult = null;
  mockState.deleteRowResult = true;
  mockState.deleteRowsResult = 0;
  mockState.getViewsResult = [];
  mockState.createViewResult = null;
  mockState.getViewResult = null;
  mockState.updateViewResult = null;
  mockState.deleteViewResult = true;
  mockState.executeViewResult = { rows: [], total: 0, offset: 0, limit: 50 };
  mockState.hasIncomingReferencesResult = false;
  mockState.getTableRelationsResult = [];
  mockState.getReverseRelationsResult = [];
  mockState.getRelationOptionsResult = [];
  mockState.deleteRowWithCascadeResult = { deletedCount: 1, updatedCount: 0 };
  mockState.exportTableResult = "exported content";
  mockState.importDataResult = { imported: 1, updated: 0, skipped: 0, errors: [] };
  mockState.previewImportResult = { headers: [], rows: [] };
  mockState.exportTableBackupResult = "backup yaml content";
  mockState.importTableBackupResult = null;
  mockState.tableServiceError = null;
  mockState.viewsError = null;
  mockState.relationsError = null;
  mockState.importExportError = null;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Tables Routes — Auth", () => {
  beforeEach(resetMockState);

  test("should return 401 when no session is present", async () => {
    mockState.currentUser = null;
    const res = await app.request("/api/tables");
    expect(res.status).toBe(401);
  });

  test("should allow access for authenticated user", async () => {
    mockState.listTablesResult = [];
    const res = await app.request("/api/tables");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables — list tables", () => {
  beforeEach(resetMockState);

  test("should return empty list when no tables exist", async () => {
    const res = await app.request("/api/tables");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toEqual([]);
    expect(body.count).toBe(0);
  });

  test("should return list of tables with count", async () => {
    mockState.listTablesResult = [makeTable(), makeTable({ id: "tbl-2", name: "Second" })];
    const res = await app.request("/api/tables");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  test("should call listTablesWithStats when stats=true", async () => {
    mockState.listTablesWithStatsResult = [
      { ...makeTable(), row_count: 5, last_modified: "2026-01-01T00:00:00.000Z" },
    ];
    const res = await app.request("/api/tables?stats=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(1);
    expect(body.tables[0]).toHaveProperty("row_count");
  });

  test("should call regular listTables when stats is not set", async () => {
    mockState.listTablesResult = [makeTable()];
    mockState.listTablesWithStatsResult = [{ ...makeTable(), row_count: 99 }];
    const res = await app.request("/api/tables");
    const body = await res.json();
    // Regular list — no row_count property from stats endpoint
    expect(body.tables[0]).not.toHaveProperty("row_count");
  });

  test("should return 500 when service throws", async () => {
    mockState.tableServiceError = new Error("disk failure");
    const res = await app.request("/api/tables");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables — create table", () => {
  beforeEach(resetMockState);

  test("should create a table and return 201", async () => {
    mockState.createTableResult = makeTable();
    const res = await app.request("/api/tables", jsonBody({
      id: "tbl-1",
      name: "Test Table",
      columns: [{ id: "col-1", name: "Name", type: "text" }],
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("tbl-1");
    expect(body.name).toBe("Test Table");
  });

  test("should return 400 when id is missing", async () => {
    const res = await app.request("/api/tables", jsonBody({
      name: "No ID Table",
      columns: [{ id: "c1", name: "Col", type: "text" }],
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id and name are required");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/tables", jsonBody({
      id: "tbl-x",
      columns: [{ id: "c1", name: "Col", type: "text" }],
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id and name are required");
  });

  test("should return 400 when columns array is empty", async () => {
    const res = await app.request("/api/tables", jsonBody({
      id: "tbl-1",
      name: "Empty Cols",
      columns: [],
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one column");
  });

  test("should return 400 when columns is not an array", async () => {
    const res = await app.request("/api/tables", jsonBody({
      id: "tbl-1",
      name: "Bad Cols",
      columns: "not-an-array",
    }));
    expect(res.status).toBe(400);
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("should return 409 when table already exists", async () => {
    mockState.tableServiceError = new Error("Table already exists");
    const res = await app.request("/api/tables", jsonBody({
      id: "existing",
      name: "Existing Table",
      columns: [{ id: "c1", name: "Col", type: "text" }],
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Eintrag existiert bereits");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.tableServiceError = new Error("unexpected");
    const res = await app.request("/api/tables", jsonBody({
      id: "tbl-1",
      name: "Table",
      columns: [{ id: "c1", name: "Col", type: "text" }],
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/templates — list templates", () => {
  beforeEach(resetMockState);

  test("should return list of templates", async () => {
    mockState.listTemplatesResult = [
      { id: "crm", name: "CRM", description: "Customer relation management", tables: [] },
    ];
    const res = await app.request("/api/tables/templates");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].id).toBe("crm");
  });

  test("should return empty templates list when none exist", async () => {
    const res = await app.request("/api/tables/templates");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toEqual([]);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("templates load failure");
    const res = await app.request("/api/tables/templates");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/templates/:id/apply — apply template", () => {
  beforeEach(resetMockState);

  test("should apply template and return created tables", async () => {
    mockState.applyTemplateResult = [makeTable({ id: "contacts" }), makeTable({ id: "deals" })];
    const res = await app.request("/api/tables/templates/crm/apply", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tables).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("apply failed");
    const res = await app.request("/api/tables/templates/crm/apply", { method: "POST" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id — get table schema", () => {
  beforeEach(resetMockState);

  test("should return table schema", async () => {
    mockState.getTableResult = makeTable();
    const res = await app.request("/api/tables/tbl-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("tbl-1");
    expect(body.name).toBe("Test Table");
  });

  test("should return 404 when table does not exist", async () => {
    mockState.getTableResult = null;
    const res = await app.request("/api/tables/unknown");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return table with data when data=true", async () => {
    mockState.getTableWithDataResult = {
      ...makeTable(),
      data: { updated_at: "2026-01-01T00:00:00.000Z", row_count: 2, rows: [makeRow()] },
    };
    const res = await app.request("/api/tables/tbl-1?data=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body.data.rows).toHaveLength(1);
  });

  test("should return 404 for data=true when table does not exist", async () => {
    mockState.getTableWithDataResult = null;
    const res = await app.request("/api/tables/missing?data=true");
    expect(res.status).toBe(404);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("disk error");
    const res = await app.request("/api/tables/tbl-1");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/tables/:id — update table", () => {
  beforeEach(resetMockState);

  test("should update table and return updated schema", async () => {
    mockState.updateTableResult = makeTable({ name: "Renamed Table" });
    const res = await app.request("/api/tables/tbl-1", putBody({ name: "Renamed Table" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Renamed Table");
  });

  test("should return 404 when table does not exist", async () => {
    mockState.updateTableResult = null;
    const res = await app.request("/api/tables/unknown", putBody({ name: "New Name" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("string body"),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("write error");
    const res = await app.request("/api/tables/tbl-1", putBody({ name: "Updated" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/tables/:id — delete table", () => {
  beforeEach(resetMockState);

  test("should delete table and return success", async () => {
    mockState.hasIncomingReferencesResult = false;
    mockState.deleteTableResult = true;
    const res = await app.request("/api/tables/tbl-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when table does not exist", async () => {
    mockState.hasIncomingReferencesResult = false;
    mockState.deleteTableResult = false;
    const res = await app.request("/api/tables/missing", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return 409 when table has incoming references and force is not set", async () => {
    mockState.hasIncomingReferencesResult = true;
    const res = await app.request("/api/tables/tbl-1", { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("incoming references");
    expect(body.hint).toContain("force=true");
  });

  test("should delete despite references when force=true", async () => {
    mockState.hasIncomingReferencesResult = true;
    mockState.deleteTableResult = true;
    const res = await app.request("/api/tables/tbl-1?force=true", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 500 on service error", async () => {
    mockState.hasIncomingReferencesResult = false;
    mockState.tableServiceError = new Error("delete error");
    const res = await app.request("/api/tables/tbl-1", { method: "DELETE" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/columns — add column", () => {
  beforeEach(resetMockState);

  test("should add column and return updated table", async () => {
    const updatedTable = makeTable({
      columns: [
        { id: "col-1", name: "Name", type: "text" },
        { id: "col-2", name: "Age", type: "number" },
      ],
    });
    mockState.addColumnResult = updatedTable;
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      id: "col-2",
      name: "Age",
      type: "number",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.columns).toHaveLength(2);
  });

  test("should return 400 when id is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      name: "Missing ID",
      type: "text",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id, name, and type are required");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      id: "col-x",
      type: "text",
    }));
    expect(res.status).toBe(400);
  });

  test("should return 400 when type is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      id: "col-x",
      name: "No Type",
    }));
    expect(res.status).toBe(400);
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when table does not exist", async () => {
    mockState.addColumnResult = null;
    const res = await app.request("/api/tables/missing/columns", jsonBody({
      id: "col-1",
      name: "Name",
      type: "text",
    }));
    expect(res.status).toBe(404);
  });

  test("should return 409 when column already exists", async () => {
    mockState.tableServiceError = new Error("Column already exists");
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      id: "col-1",
      name: "Name",
      type: "text",
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Eintrag existiert bereits");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.tableServiceError = new Error("unexpected");
    const res = await app.request("/api/tables/tbl-1/columns", jsonBody({
      id: "col-new",
      name: "New Col",
      type: "text",
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/tables/:id/columns/:columnId — update column", () => {
  beforeEach(resetMockState);

  test("should update column and return updated table", async () => {
    const updatedTable = makeTable({
      columns: [{ id: "col-1", name: "Full Name", type: "text" }],
    });
    mockState.updateColumnResult = updatedTable;
    const res = await app.request("/api/tables/tbl-1/columns/col-1", putBody({ name: "Full Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.columns[0].name).toBe("Full Name");
  });

  test("should return 404 when table does not exist", async () => {
    mockState.updateColumnResult = null;
    const res = await app.request("/api/tables/missing/columns/col-1", putBody({ name: "X" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/columns/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("write error");
    const res = await app.request("/api/tables/tbl-1/columns/col-1", putBody({ name: "X" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/tables/:id/columns/:columnId — delete column", () => {
  beforeEach(resetMockState);

  test("should delete column and return updated table", async () => {
    mockState.deleteColumnResult = makeTable({ columns: [] });
    const res = await app.request("/api/tables/tbl-1/columns/col-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.columns).toHaveLength(0);
  });

  test("should return 404 when table does not exist", async () => {
    mockState.deleteColumnResult = null;
    const res = await app.request("/api/tables/missing/columns/col-1", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("delete error");
    const res = await app.request("/api/tables/tbl-1/columns/col-1", { method: "DELETE" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// BUG: PUT /api/tables/:id/columns/order is shadowed by PUT /:id/columns/:columnId
//
// The route `PUT /:id/columns/order` (tables.ts line 281) is registered after
// `PUT /:id/columns/:columnId` (line 243). Hono matches /:id/columns/:columnId
// first, capturing columnId="order". The reorderColumns handler is therefore
// dead code and never runs.
//
// Fix required: register PUT /:id/columns/order before PUT /:id/columns/:columnId
// in tables.ts.
//
// The tests below document the ACTUAL (broken) behavior. When the fix is applied
// these must be updated to assert the intended 200/400/404 responses from
// reorderColumns.
// ---------------------------------------------------------------------------

describe("PUT /api/tables/:id/columns/order — reorder columns (BUG: shadowed by /:id/columns/:columnId)", () => {
  beforeEach(resetMockState);

  test("is shadowed: request reaches updateColumn(columnId=order) instead of reorderColumns", async () => {
    // PUT /:id/columns/:columnId is matched with columnId="order".
    // updateColumnResult defaults to null, so the response is 404.
    const res = await app.request("/api/tables/tbl-1/columns/order", putBody({
      columnIds: ["col-2", "col-1"],
    }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("is shadowed: body object with columnIds is accepted by updateColumn (no 400 for missing columnIds)", async () => {
    // updateColumn does not validate the presence of columnIds — it accepts any object body.
    // Returns 404 because updateColumnResult is null.
    const res = await app.request("/api/tables/tbl-1/columns/order", putBody({}));
    expect(res.status).toBe(404);
  });

  test("is shadowed: non-object body still returns 400 (requireObject check fires before routing difference)", async () => {
    // The updateColumn handler also calls requireObject, so null/array bodies still return 400.
    const res = await app.request("/api/tables/tbl-1/columns/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("is shadowed: service error surfaces as 500 via updateColumn path", async () => {
    mockState.tableServiceError = new Error("reorder error");
    const res = await app.request("/api/tables/tbl-1/columns/order", putBody({
      columnIds: ["col-1"],
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/rows — query rows", () => {
  beforeEach(resetMockState);

  test("should return empty result when no rows exist", async () => {
    const res = await app.request("/api/tables/tbl-1/rows");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(50);
  });

  test("should return rows with pagination metadata", async () => {
    mockState.queryRowsResult = {
      rows: [makeRow(), makeRow({ _id: "row-2", name: "Bob" })],
      total: 2,
      offset: 0,
      limit: 50,
    };
    const res = await app.request("/api/tables/tbl-1/rows");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  test("should pass offset and limit query params to service", async () => {
    mockState.queryRowsResult = { rows: [], total: 100, offset: 20, limit: 10 };
    const res = await app.request("/api/tables/tbl-1/rows?offset=20&limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offset).toBe(20);
    expect(body.limit).toBe(10);
  });

  test("should use default offset=0 and limit=50 for invalid values", async () => {
    mockState.queryRowsResult = { rows: [], total: 0, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/rows?offset=abc&limit=xyz");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(50);
  });

  test("should pass filter text via filter query param", async () => {
    mockState.queryRowsResult = {
      rows: [makeRow()],
      total: 1,
      offset: 0,
      limit: 50,
    };
    const res = await app.request("/api/tables/tbl-1/rows?filter=Alice");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
  });

  test("should accept sort_by and sort_direction=ASC", async () => {
    mockState.queryRowsResult = { rows: [makeRow()], total: 1, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/rows?sort_by=name&sort_direction=ASC");
    expect(res.status).toBe(200);
  });

  test("should accept sort_direction=DESC", async () => {
    mockState.queryRowsResult = { rows: [makeRow()], total: 1, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/rows?sort_by=name&sort_direction=DESC");
    expect(res.status).toBe(200);
  });

  test("should ignore invalid sort_direction values", async () => {
    // Only ASC/DESC are valid; 'INVALID' should be ignored (undefined passed to service)
    mockState.queryRowsResult = { rows: [], total: 0, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/rows?sort_direction=INVALID");
    expect(res.status).toBe(200);
  });

  test("should accept resolve_relations=true", async () => {
    mockState.queryRowsResult = { rows: [makeRow()], total: 1, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/rows?resolve_relations=true");
    expect(res.status).toBe(200);
  });

  test("should return 404 when table is not found", async () => {
    mockState.tableServiceError = new Error("Table not found");
    const res = await app.request("/api/tables/missing/rows");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Nicht gefunden");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.tableServiceError = new Error("disk crash");
    const res = await app.request("/api/tables/tbl-1/rows");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/rows — add row", () => {
  beforeEach(resetMockState);

  test("should create a row and return 201", async () => {
    mockState.addRowResult = makeRow();
    const res = await app.request("/api/tables/tbl-1/rows", jsonBody({ name: "Alice" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body._id).toBe("row-1");
    expect(body.name).toBe("Alice");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when table is not found", async () => {
    mockState.tableServiceError = new Error("Table not found");
    const res = await app.request("/api/tables/missing/rows", jsonBody({ name: "X" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Nicht gefunden");
  });

  test("should return 400 on validation failure", async () => {
    mockState.tableServiceError = new Error("Validation failed: name is required");
    const res = await app.request("/api/tables/tbl-1/rows", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validierungsfehler");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.tableServiceError = new Error("unexpected");
    const res = await app.request("/api/tables/tbl-1/rows", jsonBody({ name: "X" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/rows/query — advanced query", () => {
  beforeEach(resetMockState);

  test("should execute advanced query and return result", async () => {
    mockState.queryRowsResult = {
      rows: [makeRow()],
      total: 1,
      offset: 0,
      limit: 20,
    };
    const res = await app.request("/api/tables/tbl-1/rows/query", jsonBody({
      filter_text: "Alice",
      sort_by: "name",
      sort_direction: "ASC",
      limit: 20,
      offset: 0,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/rows/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("invalid"),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("query failed");
    const res = await app.request("/api/tables/tbl-1/rows/query", jsonBody({}));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/rows/:rowId — get single row", () => {
  beforeEach(resetMockState);

  test("should return the row", async () => {
    mockState.getRowResult = makeRow();
    const res = await app.request("/api/tables/tbl-1/rows/row-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe("row-1");
    expect(body.name).toBe("Alice");
  });

  test("should return 404 when row does not exist", async () => {
    mockState.getRowResult = null;
    const res = await app.request("/api/tables/tbl-1/rows/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Row not found");
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("read error");
    const res = await app.request("/api/tables/tbl-1/rows/row-1");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/tables/:id/rows/:rowId — update row", () => {
  beforeEach(resetMockState);

  test("should update row and return updated row", async () => {
    mockState.updateRowResult = makeRow({ name: "Bob" });
    const res = await app.request("/api/tables/tbl-1/rows/row-1", putBody({ name: "Bob" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Bob");
  });

  test("should return 404 when row does not exist", async () => {
    mockState.updateRowResult = null;
    const res = await app.request("/api/tables/tbl-1/rows/missing", putBody({ name: "X" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Row not found");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/rows/row-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 on validation failure", async () => {
    mockState.tableServiceError = new Error("Validation failed: email is invalid");
    const res = await app.request("/api/tables/tbl-1/rows/row-1", putBody({ email: "bad" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validierungsfehler");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.tableServiceError = new Error("write error");
    const res = await app.request("/api/tables/tbl-1/rows/row-1", putBody({ name: "X" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/tables/:id/rows/:rowId — delete single row", () => {
  beforeEach(resetMockState);

  test("should delete row and return success", async () => {
    mockState.deleteRowResult = true;
    const res = await app.request("/api/tables/tbl-1/rows/row-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when row does not exist", async () => {
    mockState.deleteRowResult = false;
    const res = await app.request("/api/tables/tbl-1/rows/missing", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Row not found");
  });

  test("should use cascade delete when cascade=true", async () => {
    mockState.deleteRowWithCascadeResult = { deletedCount: 3, updatedCount: 0 };
    const res = await app.request("/api/tables/tbl-1/rows/row-1?cascade=true", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(3);
  });

  test("should use nullify when nullify=true", async () => {
    mockState.deleteRowWithCascadeResult = { deletedCount: 1, updatedCount: 2 };
    const res = await app.request("/api/tables/tbl-1/rows/row-1?nullify=true", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updatedCount).toBe(2);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("delete error");
    const res = await app.request("/api/tables/tbl-1/rows/row-1", { method: "DELETE" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/tables/:id/rows — delete multiple rows", () => {
  beforeEach(resetMockState);

  test("should delete multiple rows and return count", async () => {
    mockState.deleteRowsResult = 3;
    const res = await app.request("/api/tables/tbl-1/rows", deleteBody({
      rowIds: ["row-1", "row-2", "row-3"],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(3);
  });

  test("should return 400 when rowIds is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/rows", deleteBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("rowIds array is required");
  });

  test("should return 400 when rowIds is not an array", async () => {
    const res = await app.request("/api/tables/tbl-1/rows", deleteBody({
      rowIds: "row-1",
    }));
    expect(res.status).toBe(400);
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/rows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.tableServiceError = new Error("bulk delete error");
    const res = await app.request("/api/tables/tbl-1/rows", deleteBody({
      rowIds: ["row-1"],
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/views — list views", () => {
  beforeEach(resetMockState);

  test("should return empty list when no views exist", async () => {
    const res = await app.request("/api/tables/tbl-1/views");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.views).toEqual([]);
  });

  test("should return list of views", async () => {
    mockState.getViewsResult = [makeView(), makeView({ id: "view-2", name: "Filtered" })];
    const res = await app.request("/api/tables/tbl-1/views");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.views).toHaveLength(2);
  });

  test("should return 500 on service error", async () => {
    mockState.viewsError = new Error("views load error");
    const res = await app.request("/api/tables/tbl-1/views");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/views — create view", () => {
  beforeEach(resetMockState);

  test("should create view and return 201", async () => {
    mockState.createViewResult = makeView();
    const res = await app.request("/api/tables/tbl-1/views", jsonBody({
      id: "view-1",
      name: "Active Items",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("view-1");
  });

  test("should return 400 when id is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/views", jsonBody({ name: "No ID" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id and name are required");
  });

  test("should return 400 when name is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/views", jsonBody({ id: "v-1" }));
    expect(res.status).toBe(400);
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);
  });

  test("should return 409 when view already exists", async () => {
    mockState.viewsError = new Error("View already exists");
    const res = await app.request("/api/tables/tbl-1/views", jsonBody({
      id: "view-1",
      name: "Duplicate",
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Eintrag existiert bereits");
  });

  test("should return 500 on unexpected error", async () => {
    mockState.viewsError = new Error("create failed");
    const res = await app.request("/api/tables/tbl-1/views", jsonBody({
      id: "v-new",
      name: "New View",
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/views/:viewId — get view", () => {
  beforeEach(resetMockState);

  test("should return the view", async () => {
    mockState.getViewResult = makeView();
    const res = await app.request("/api/tables/tbl-1/views/view-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("view-1");
  });

  test("should return 404 when view does not exist", async () => {
    mockState.getViewResult = null;
    const res = await app.request("/api/tables/tbl-1/views/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("View not found");
  });

  test("should return 500 on service error", async () => {
    mockState.viewsError = new Error("read error");
    const res = await app.request("/api/tables/tbl-1/views/view-1");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("PUT /api/tables/:id/views/:viewId — update view", () => {
  beforeEach(resetMockState);

  test("should update view and return updated view", async () => {
    mockState.updateViewResult = makeView({ name: "Renamed View" });
    const res = await app.request("/api/tables/tbl-1/views/view-1", putBody({ name: "Renamed View" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Renamed View");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/views/view-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.viewsError = new Error("update error");
    const res = await app.request("/api/tables/tbl-1/views/view-1", putBody({ name: "X" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/tables/:id/views/:viewId — delete view", () => {
  beforeEach(resetMockState);

  test("should delete view and return success", async () => {
    mockState.deleteViewResult = true;
    const res = await app.request("/api/tables/tbl-1/views/view-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("should return 404 when view does not exist", async () => {
    mockState.deleteViewResult = false;
    const res = await app.request("/api/tables/tbl-1/views/missing", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("View not found");
  });

  test("should return 500 on service error", async () => {
    mockState.viewsError = new Error("delete error");
    const res = await app.request("/api/tables/tbl-1/views/view-1", { method: "DELETE" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/views/:viewId/rows — execute view", () => {
  beforeEach(resetMockState);

  test("should execute view and return rows", async () => {
    mockState.executeViewResult = {
      rows: [makeRow(), makeRow({ _id: "row-2", name: "Bob" })],
      total: 2,
      offset: 0,
      limit: 50,
    };
    const res = await app.request("/api/tables/tbl-1/views/view-1/rows");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
  });

  test("should pass offset and limit query params", async () => {
    mockState.executeViewResult = { rows: [], total: 0, offset: 10, limit: 5 };
    const res = await app.request("/api/tables/tbl-1/views/view-1/rows?offset=10&limit=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offset).toBe(10);
    expect(body.limit).toBe(5);
  });

  test("should use default offset=0 and limit=50 when not provided", async () => {
    mockState.executeViewResult = { rows: [], total: 0, offset: 0, limit: 50 };
    const res = await app.request("/api/tables/tbl-1/views/view-1/rows");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(50);
  });

  test("should return 500 on service error", async () => {
    mockState.viewsError = new Error("execute error");
    const res = await app.request("/api/tables/tbl-1/views/view-1/rows");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/relations — get table relations", () => {
  beforeEach(resetMockState);

  test("should return outgoing and incoming relations", async () => {
    mockState.getTableRelationsResult = [
      { source_table: "tbl-1", source_column: "col-rel", target_table: "tbl-2" },
    ];
    mockState.getReverseRelationsResult = [
      { source_table: "tbl-3", source_column: "col-ref", target_table: "tbl-1" },
    ];
    const res = await app.request("/api/tables/tbl-1/relations");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outgoing).toHaveLength(1);
    expect(body.incoming).toHaveLength(1);
  });

  test("should return empty outgoing and incoming when no relations exist", async () => {
    const res = await app.request("/api/tables/tbl-1/relations");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outgoing).toEqual([]);
    expect(body.incoming).toEqual([]);
  });

  test("should return 500 on service error", async () => {
    mockState.relationsError = new Error("relations error");
    const res = await app.request("/api/tables/tbl-1/relations");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/tables/:id/columns/:columnId/options — get relation options", () => {
  beforeEach(resetMockState);

  test("should return options for a relation column", async () => {
    mockState.getTableResult = makeTable({
      columns: [
        { id: "col-rel", name: "Company", type: "relation", relation_table: "tbl-companies", relation_display_column: "name" },
      ],
    });
    mockState.getRelationOptionsResult = [
      { _id: "comp-1", label: "Acme Corp" },
      { _id: "comp-2", label: "Globex" },
    ];
    const res = await app.request("/api/tables/tbl-1/columns/col-rel/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options).toHaveLength(2);
  });

  test("should return 404 when table does not exist", async () => {
    mockState.getTableResult = null;
    const res = await app.request("/api/tables/missing/columns/col-rel/options");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Table not found");
  });

  test("should return 404 when column does not exist", async () => {
    mockState.getTableResult = makeTable({
      columns: [{ id: "col-1", name: "Name", type: "text" }],
    });
    const res = await app.request("/api/tables/tbl-1/columns/nonexistent/options");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Column not found");
  });

  test("should return 400 when column is not a relation type", async () => {
    mockState.getTableResult = makeTable({
      columns: [{ id: "col-text", name: "Name", type: "text" }],
    });
    const res = await app.request("/api/tables/tbl-1/columns/col-text/options");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Column is not a relation");
  });

  test("should return 400 when relation column has no relation_table", async () => {
    mockState.getTableResult = makeTable({
      columns: [{ id: "col-rel", name: "Ref", type: "relation" }],
    });
    const res = await app.request("/api/tables/tbl-1/columns/col-rel/options");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Column is not a relation");
  });

  test("should accept search and limit query params", async () => {
    mockState.getTableResult = makeTable({
      columns: [
        { id: "col-rel", name: "Company", type: "relation", relation_table: "tbl-companies" },
      ],
    });
    mockState.getRelationOptionsResult = [{ _id: "comp-1", label: "Acme" }];
    const res = await app.request("/api/tables/tbl-1/columns/col-rel/options?search=Acme&limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options).toHaveLength(1);
  });

  test("should return 500 on service error", async () => {
    mockState.getTableResult = makeTable({
      columns: [
        { id: "col-rel", name: "Company", type: "relation", relation_table: "tbl-companies" },
      ],
    });
    mockState.relationsError = new Error("relations lookup failed");
    const res = await app.request("/api/tables/tbl-1/columns/col-rel/options");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/export — export table data", () => {
  beforeEach(resetMockState);

  test("should export as CSV with correct content type", async () => {
    mockState.exportTableResult = "id,name\nrow-1,Alice";
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "csv" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  test("should export as JSON with correct content type", async () => {
    mockState.exportTableResult = '[{"_id":"row-1","name":"Alice"}]';
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "json" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  test("should export as YAML with correct content type", async () => {
    mockState.exportTableResult = "- _id: row-1\n  name: Alice";
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "yaml" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/yaml");
  });

  test("should include Content-Disposition attachment header with table ID and format", async () => {
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "csv" }));
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("tbl-1.csv");
  });

  test("should return 400 when format is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("format is required");
  });

  test("should return 400 when format is invalid", async () => {
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "xml" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("format is required");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should return 500 on service error", async () => {
    mockState.importExportError = new Error("export failed");
    const res = await app.request("/api/tables/tbl-1/export", jsonBody({ format: "csv" }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/import — import data", () => {
  beforeEach(resetMockState);

  test("should import data and return result", async () => {
    mockState.importDataResult = { imported: 3, updated: 0, skipped: 0, errors: [] };
    const res = await app.request("/api/tables/tbl-1/import", jsonBody({
      content: "id,name\n1,Alice\n2,Bob\n3,Carol",
      format: "csv",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(3);
    expect(body.errors).toEqual([]);
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/import", jsonBody({ format: "csv" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content and format are required");
  });

  test("should return 400 when format is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/import", jsonBody({
      content: "id,name\n1,Alice",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content and format are required");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);
  });

  test("should pass column_mapping option to service", async () => {
    mockState.importDataResult = { imported: 1, updated: 0, skipped: 0, errors: [] };
    const res = await app.request("/api/tables/tbl-1/import", jsonBody({
      content: "Name\nAlice",
      format: "csv",
      column_mapping: { Name: "name" },
    }));
    expect(res.status).toBe(200);
  });

  test("should return 500 on service error", async () => {
    mockState.importExportError = new Error("import failed");
    const res = await app.request("/api/tables/tbl-1/import", jsonBody({
      content: "id,name\n1,X",
      format: "csv",
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/import/preview — preview import", () => {
  beforeEach(resetMockState);

  test("should preview import and return preview data", async () => {
    mockState.previewImportResult = {
      headers: ["id", "name"],
      rows: [{ id: "1", name: "Alice" }],
    };
    const res = await app.request("/api/tables/tbl-1/import/preview", jsonBody({
      content: "id,name\n1,Alice",
      format: "csv",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headers).toEqual(["id", "name"]);
    expect(body.rows).toHaveLength(1);
  });

  test("should return 400 when content is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/import/preview", jsonBody({ format: "csv" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content and format are required");
  });

  test("should return 400 when format is missing", async () => {
    const res = await app.request("/api/tables/tbl-1/import/preview", jsonBody({
      content: "id,name\n1,Alice",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("content and format are required");
  });

  test("should return 400 when body is not an object", async () => {
    const res = await app.request("/api/tables/tbl-1/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });
    expect(res.status).toBe(400);
  });

  test("should use default limit of 10 when not specified", async () => {
    mockState.previewImportResult = { headers: [], rows: [] };
    const res = await app.request("/api/tables/tbl-1/import/preview", jsonBody({
      content: "id,name\n1,Alice",
      format: "csv",
    }));
    expect(res.status).toBe(200);
  });

  test("should return 500 on service error", async () => {
    mockState.importExportError = new Error("preview failed");
    const res = await app.request("/api/tables/tbl-1/import/preview", jsonBody({
      content: "id,name\n1,Alice",
      format: "csv",
    }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/tables/:id/backup — create backup", () => {
  beforeEach(resetMockState);

  test("should return YAML backup with correct content type", async () => {
    mockState.exportTableBackupResult = "id: tbl-1\nname: Test Table\nrows: []";
    const res = await app.request("/api/tables/tbl-1/backup", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/yaml");
  });

  test("should include Content-Disposition with table ID and -backup.yaml suffix", async () => {
    const res = await app.request("/api/tables/tbl-1/backup", { method: "POST" });
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("tbl-1-backup.yaml");
  });

  test("should return exported backup content in body", async () => {
    mockState.exportTableBackupResult = "yaml-backup-content";
    const res = await app.request("/api/tables/tbl-1/backup", { method: "POST" });
    const text = await res.text();
    expect(text).toBe("yaml-backup-content");
  });

  test("should return 500 on service error", async () => {
    mockState.importExportError = new Error("backup failed");
    const res = await app.request("/api/tables/tbl-1/backup", { method: "POST" });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// BUG: POST /api/tables/import/backup is shadowed by POST /api/tables/:id/backup
//
// The route `POST /import/backup` (tables.ts line 748) is registered after
// `POST /:id/backup` (line 730). Hono matches /:id/backup first, capturing
// id="import" and treating the path as a backup export for a table named
// "import". The /import/backup handler is therefore dead code and never runs.
//
// Fix required: move `POST /import/backup` above `POST /:id/backup` in tables.ts.
//
// The tests below document the ACTUAL (broken) behavior so that the bug is
// clearly visible in CI. When the fix is applied these tests must be updated
// to assert the intended 201/400/409 responses from importTableBackup.
// ---------------------------------------------------------------------------

describe("POST /api/tables/import/backup — import from backup (BUG: shadowed by /:id/backup)", () => {
  beforeEach(resetMockState);

  test("is shadowed: request reaches /:id/backup with id=import, not the importTableBackup handler", async () => {
    // Because /:id/backup is registered first, this request hits exportTableBackup("import")
    // rather than importTableBackup. The backup export returns 200 with YAML content.
    mockState.exportTableBackupResult = "backup content for table 'import'";
    const res = await app.request("/api/tables/import/backup", jsonBody({
      content: "yaml-backup-content",
    }));
    // The /:id/backup handler ignores the JSON body and calls exportTableBackup("import")
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/yaml");
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("import-backup.yaml");
  });

  test("is shadowed: exportTableBackup error surfaces as 500 (not importTableBackup logic)", async () => {
    mockState.importExportError = new Error("backup error");
    const res = await app.request("/api/tables/import/backup", jsonBody({
      content: "yaml-backup-content",
    }));
    // Still routed to /:id/backup which calls exportTableBackup and throws
    expect(res.status).toBe(500);
  });
});
