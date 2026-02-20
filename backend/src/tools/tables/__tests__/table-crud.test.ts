/**
 * Tests fuer TableDeleteTool, TableUpdateTool und TableListTool
 *
 * Die Module '../../tables' und '../../tables/relations' (relativ zur Quelldatei,
 * d.h. src/tools/tables/) werden per mock.module() ersetzt, damit keine echten
 * Dateisystem-Operationen stattfinden.
 *
 * Wichtig: mock.module()-Aufrufe muessen VOR dem dynamischen Import des Moduls
 * unter Test stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Die Pfade in mock.module() sind relativ zur Testdatei. Die Module unter Test
 * liegen in src/tools/tables/, die Testdatei in src/tools/tables/__tests__/,
 * daher zeigt der Pfad auf ../../../tables bzw. ../../../tables/relations.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { TableSchema, RowData, QueryResult } from "../../../tables/types";

// ---------------------------------------------------------------------------
// Mock-State: gemeinsames mutablees Objekt fuer alle Mock-Implementierungen
// ---------------------------------------------------------------------------

const mockState = {
  // Rueckgabewerte
  getTableResult: null as TableSchema | null,
  getRowResult: null as RowData | null,
  queryRowsResult: null as QueryResult | null,
  deleteRowResult: undefined as undefined,
  updateRowResult: null as RowData | null,
  listTablesWithStatsResult: [] as Array<TableSchema & { row_count: number }>,
  getRowReferencesResult: [] as Array<{ table: string; column: string; count: number }>,
  deleteRowWithCascadeResult: { deleted: 1, nullified: 0 } as { deleted: number; nullified: number },

  // Fehler-Simulierung
  getTableThrows: false as boolean,
  getTableError: null as Error | null,
  getRowThrows: false as boolean,
  getRowError: null as Error | null,
  queryRowsThrows: false as boolean,
  queryRowsError: null as Error | null,
  deleteRowThrows: false as boolean,
  deleteRowError: null as Error | null,
  updateRowThrows: false as boolean,
  updateRowError: null as Error | null,
  listTablesThrows: false as boolean,
  listTablesError: null as Error | null,
  getRowReferencesThrows: false as boolean,
  getRowReferencesError: null as Error | null,
  deleteRowWithCascadeThrows: false as boolean,
  deleteRowWithCascadeError: null as Error | null,

  // Aufruf-Argumente zur Verifikation
  deleteRowCalledWith: null as any,
  updateRowCalledWith: null as any,
  deleteRowWithCascadeCalledWith: null as any,
};

// ---------------------------------------------------------------------------
// Mock-Registrierung fuer ../../../tables VOR dem Import des Moduls unter Test
// ---------------------------------------------------------------------------

mock.module("../../../tables", () => ({
  getTable: async (_tableId: string) => {
    if (mockState.getTableThrows) {
      throw mockState.getTableError ?? new Error("getTable Fehler");
    }
    return mockState.getTableResult;
  },

  getRow: async (_tableId: string, _rowId: string) => {
    if (mockState.getRowThrows) {
      throw mockState.getRowError ?? new Error("getRow Fehler");
    }
    return mockState.getRowResult;
  },

  queryRows: async (_tableId: string, _options: any) => {
    if (mockState.queryRowsThrows) {
      throw mockState.queryRowsError ?? new Error("queryRows Fehler");
    }
    return mockState.queryRowsResult;
  },

  deleteRow: async (tableId: string, rowId: string) => {
    mockState.deleteRowCalledWith = { tableId, rowId };
    if (mockState.deleteRowThrows) {
      throw mockState.deleteRowError ?? new Error("deleteRow Fehler");
    }
    return mockState.deleteRowResult;
  },

  updateRow: async (tableId: string, params: any) => {
    mockState.updateRowCalledWith = { tableId, params };
    if (mockState.updateRowThrows) {
      throw mockState.updateRowError ?? new Error("updateRow Fehler");
    }
    return mockState.updateRowResult;
  },

  listTablesWithStats: async () => {
    if (mockState.listTablesThrows) {
      throw mockState.listTablesError ?? new Error("listTablesWithStats Fehler");
    }
    return mockState.listTablesWithStatsResult;
  },
}));

// ---------------------------------------------------------------------------
// Mock-Registrierung fuer ../../../tables/relations VOR dem Import
// ---------------------------------------------------------------------------

mock.module("../../../tables/relations", () => ({
  getRowReferences: async (_tableId: string, _rowId: string) => {
    if (mockState.getRowReferencesThrows) {
      throw mockState.getRowReferencesError ?? new Error("getRowReferences Fehler");
    }
    return mockState.getRowReferencesResult;
  },

  deleteRowWithCascade: async (tableId: string, rowId: string, options: any) => {
    mockState.deleteRowWithCascadeCalledWith = { tableId, rowId, options };
    if (mockState.deleteRowWithCascadeThrows) {
      throw mockState.deleteRowWithCascadeError ?? new Error("deleteRowWithCascade Fehler");
    }
    return mockState.deleteRowWithCascadeResult;
  },
}));

// ---------------------------------------------------------------------------
// Import der Module unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { TableDeleteTool } = await import("../table-delete");
const { TableUpdateTool } = await import("../table-update");
const { TableListTool } = await import("../table-list");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "kontakte",
    name: "Kontakte",
    description: "Kontaktliste",
    icon: "👤",
    columns: [
      { id: "name", name: "Name", type: "text", required: true },
      { id: "email", name: "E-Mail", type: "email" },
      { id: "firma", name: "Firma", type: "text" },
    ],
    views: [
      { id: "aktive", name: "Aktive Kontakte", filter: "status = 'aktiv'" },
    ],
    settings: {
      primary_column: "name",
    },
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRow(overrides: Partial<RowData> = {}): RowData {
  return {
    _id: "row-1",
    _created_at: "2024-06-01T10:00:00.000Z",
    name: "Max Mustermann",
    email: "max@example.com",
    firma: "Muster GmbH",
    ...overrides,
  };
}

function makeQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    rows: [makeRow()],
    total: 1,
    offset: 0,
    limit: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset vor jedem Test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.getTableResult = null;
  mockState.getRowResult = null;
  mockState.queryRowsResult = null;
  mockState.deleteRowResult = undefined;
  mockState.updateRowResult = null;
  mockState.listTablesWithStatsResult = [];
  mockState.getRowReferencesResult = [];
  mockState.deleteRowWithCascadeResult = { deleted: 1, nullified: 0 };

  mockState.getTableThrows = false;
  mockState.getTableError = null;
  mockState.getRowThrows = false;
  mockState.getRowError = null;
  mockState.queryRowsThrows = false;
  mockState.queryRowsError = null;
  mockState.deleteRowThrows = false;
  mockState.deleteRowError = null;
  mockState.updateRowThrows = false;
  mockState.updateRowError = null;
  mockState.listTablesThrows = false;
  mockState.listTablesError = null;
  mockState.getRowReferencesThrows = false;
  mockState.getRowReferencesError = null;
  mockState.deleteRowWithCascadeThrows = false;
  mockState.deleteRowWithCascadeError = null;

  mockState.deleteRowCalledWith = null;
  mockState.updateRowCalledWith = null;
  mockState.deleteRowWithCascadeCalledWith = null;
});

// ===========================================================================
// TableDeleteTool
// ===========================================================================

describe("TableDeleteTool", () => {

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TableDeleteTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen 'table_delete' zurueck", () => {
      const tool = new TableDeleteTool();
      expect(tool.getDefinition().function.name).toBe("table_delete");
    });

    test("hat 'table_id' als einziges Pflichtfeld", () => {
      const tool = new TableDeleteTool();
      const { required } = tool.getDefinition().function.parameters;
      expect(required).toEqual(["table_id"]);
    });

    test("parameters.type ist 'object'", () => {
      const tool = new TableDeleteTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });

    test("enthaelt die Property 'row_id'", () => {
      const tool = new TableDeleteTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("row_id");
    });

    test("enthaelt die Property 'find_by'", () => {
      const tool = new TableDeleteTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("find_by");
    });

    test("enthaelt die Property 'cascade'", () => {
      const tool = new TableDeleteTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("cascade");
    });

    test("'find_by' hat additionalProperties: true", () => {
      const tool = new TableDeleteTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties["find_by"]!.additionalProperties).toBe(true);
    });

    test("'cascade' ist vom Typ boolean", () => {
      const tool = new TableDeleteTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties["cascade"]!.type).toBe("boolean");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'table_delete' zurueck", () => {
      const tool = new TableDeleteTool();
      expect(tool.getMetadata().name).toBe("table_delete");
    });

    test("gibt type 'local' zurueck", () => {
      const tool = new TableDeleteTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt category 'tables' zurueck", () => {
      const tool = new TableDeleteTool();
      expect(tool.getMetadata().category).toBe("tables");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new TableDeleteTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — mit row_id
  // -------------------------------------------------------------------------

  describe("execute() — mit row_id", () => {
    test("gibt Fehler-JSON zurueck wenn Tabelle nicht gefunden", async () => {
      mockState.getTableResult = null;
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "unbekannt", row_id: "row-1" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("unbekannt");
    });

    test("gibt Fehler-JSON zurueck wenn Zeile nicht gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = null;
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "nichtvorhanden" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("nichtvorhanden");
    });

    test("loescht Zeile erfolgreich und gibt success: true zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.success).toBe(true);
      expect(result.row_id).toBe("row-1");
    });

    test("Erfolgsmeldung enthaelt Anzeigename aus primary_column", async () => {
      mockState.getTableResult = makeTable({ settings: { primary_column: "name" } });
      mockState.getRowResult = makeRow({ name: "Anna Schmidt" });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.message).toContain("Anna Schmidt");
    });

    test("Erfolgsmeldung faellt auf _id zurueck wenn primary_column-Wert fehlt", async () => {
      mockState.getTableResult = makeTable({ settings: { primary_column: "nichtvorhanden" } });
      mockState.getRowResult = makeRow({ _id: "fallback-id" });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "fallback-id" })
      );
      expect(result.message).toContain("fallback-id");
    });

    test("verwendet ersten Spaltenwert wenn settings fehlen und keine primary_column gesetzt", async () => {
      mockState.getTableResult = makeTable({ settings: undefined });
      mockState.getRowResult = makeRow({ name: "ErsterSpaltenWert" });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.message).toContain("ErsterSpaltenWert");
    });

    test("ruft deleteRow mit korrekten Argumenten auf", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      const tool = new TableDeleteTool();
      await tool.execute({ table_id: "kontakte", row_id: "row-1" });
      expect(mockState.deleteRowCalledWith.tableId).toBe("kontakte");
      expect(mockState.deleteRowCalledWith.rowId).toBe("row-1");
    });

    test("Erfolgsmeldung enthaelt Tabellenname", async () => {
      mockState.getTableResult = makeTable({ name: "Kontaktliste" });
      mockState.getRowResult = makeRow();
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.message).toContain("Kontaktliste");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — mit find_by
  // -------------------------------------------------------------------------

  describe("execute() — mit find_by", () => {
    test("gibt Fehler-JSON zurueck wenn keine Treffer gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({ rows: [], total: 0 });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", find_by: { name: "Unbekannt" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Keine Zeile");
      expect(result.search_criteria).toEqual({ name: "Unbekannt" });
    });

    test("gibt Fehler-JSON mit Trefferanzahl zurueck wenn mehrere Zeilen gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [makeRow({ _id: "row-1" }), makeRow({ _id: "row-2" })],
        total: 2,
      });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", find_by: { name: "Max" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Mehrere Zeilen");
      expect(result.found).toBe(2);
    });

    test("gibt matches-Array bei mehreren Treffern zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [
          makeRow({ _id: "row-1", name: "Max A" }),
          makeRow({ _id: "row-2", name: "Max B" }),
        ],
        total: 2,
      });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", find_by: { name: "Max" } })
      );
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0]._id).toBe("row-1");
      expect(result.matches[1]._id).toBe("row-2");
    });

    test("loescht Zeile erfolgreich wenn genau ein Treffer gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({ rows: [makeRow({ _id: "row-42" })], total: 1 });
      mockState.getRowResult = makeRow({ _id: "row-42" });
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", find_by: { name: "Max Mustermann" } })
      );
      expect(result.success).toBe(true);
      expect(result.row_id).toBe("row-42");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — ohne row_id und find_by
  // -------------------------------------------------------------------------

  describe("execute() — ohne row_id und find_by", () => {
    test("gibt Fehler-JSON zurueck wenn weder row_id noch find_by angegeben", async () => {
      mockState.getTableResult = makeTable();
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("row_id");
      expect(result.error).toContain("find_by");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Referenz-Pruefung (kein Cascade)
  // -------------------------------------------------------------------------

  describe("execute() — Referenzpruefung ohne Cascade", () => {
    test("blockiert Loeschung wenn Referenzen existieren und cascade=false", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [
        { table: "aufgaben", column: "kontakt_id", count: 3 },
      ];
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("referenziert");
    });

    test("gibt Referenzdetails mit table, column und count zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [
        { table: "aufgaben", column: "kontakt_id", count: 5 },
        { table: "projekte", column: "haupt_kontakt", count: 2 },
      ];
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.references).toHaveLength(2);
      expect(result.references[0].table).toBe("aufgaben");
      expect(result.references[0].column).toBe("kontakt_id");
      expect(result.references[0].count).toBe(5);
    });

    test("gibt hint mit Hinweis auf cascade=true zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [{ table: "t", column: "c", count: 1 }];
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.hint).toContain("cascade=true");
    });

    test("loescht direkt ohne Cascade-Pruefung wenn keine Referenzen vorhanden", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [];
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.success).toBe(true);
      expect(mockState.deleteRowCalledWith).not.toBeNull();
      expect(mockState.deleteRowWithCascadeCalledWith).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Cascade-Loeschung
  // -------------------------------------------------------------------------

  describe("execute() — Cascade-Loeschung", () => {
    test("ruft deleteRowWithCascade mit nullifyReferences: true auf", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [{ table: "aufgaben", column: "kontakt_id", count: 2 }];
      mockState.deleteRowWithCascadeResult = { deleted: 1, nullified: 2 };
      const tool = new TableDeleteTool();
      await tool.execute({ table_id: "kontakte", row_id: "row-1", cascade: true });
      expect(mockState.deleteRowWithCascadeCalledWith.options).toEqual({ nullifyReferences: true });
    });

    test("gibt nullified_references aus dem Cascade-Ergebnis zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [{ table: "aufgaben", column: "kontakt_id", count: 2 }];
      mockState.deleteRowWithCascadeResult = { deleted: 1, nullified: 4 };
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", cascade: true })
      );
      expect(result.success).toBe(true);
      expect(result.nullified_references).toBe(4);
    });

    test("ruft deleteRowWithCascade mit korrekten table_id und row_id auf", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow({ _id: "row-99" });
      mockState.getRowReferencesResult = [{ table: "a", column: "b", count: 1 }];
      const tool = new TableDeleteTool();
      await tool.execute({ table_id: "kontakte", row_id: "row-99", cascade: true });
      expect(mockState.deleteRowWithCascadeCalledWith.tableId).toBe("kontakte");
      expect(mockState.deleteRowWithCascadeCalledWith.rowId).toBe("row-99");
    });

    test("loescht direkt per deleteRow wenn cascade=true aber keine Referenzen vorhanden", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.getRowReferencesResult = [];
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", cascade: true })
      );
      expect(result.success).toBe(true);
      expect(mockState.deleteRowCalledWith).not.toBeNull();
      expect(mockState.deleteRowWithCascadeCalledWith).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung (catch-Block)
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehler-JSON zurueck wenn ein unerwarteter Fehler auftritt", async () => {
      mockState.getTableThrows = true;
      mockState.getTableError = new Error("Unerwarteter Datenbankfehler");
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unerwarteter Datenbankfehler");
    });

    test("gibt Fehler-JSON zurueck wenn deleteRow einen Fehler wirft", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.deleteRowThrows = true;
      mockState.deleteRowError = new Error("Schreibfehler beim Loeschen");
      const tool = new TableDeleteTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Schreibfehler beim Loeschen");
    });
  });
});

// ===========================================================================
// TableUpdateTool
// ===========================================================================

describe("TableUpdateTool", () => {

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TableUpdateTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen 'table_update' zurueck", () => {
      const tool = new TableUpdateTool();
      expect(tool.getDefinition().function.name).toBe("table_update");
    });

    test("hat 'table_id' und 'data' als Pflichtfelder", () => {
      const tool = new TableUpdateTool();
      const { required } = tool.getDefinition().function.parameters;
      expect(required).toContain("table_id");
      expect(required).toContain("data");
    });

    test("required-Array enthaelt genau zwei Eintraege", () => {
      const tool = new TableUpdateTool();
      expect(tool.getDefinition().function.parameters.required).toHaveLength(2);
    });

    test("parameters.type ist 'object'", () => {
      const tool = new TableUpdateTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });

    test("enthaelt die Property 'row_id'", () => {
      const tool = new TableUpdateTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("row_id");
    });

    test("enthaelt die Property 'find_by'", () => {
      const tool = new TableUpdateTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("find_by");
    });

    test("'data' hat additionalProperties: true", () => {
      const tool = new TableUpdateTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties["data"]!.additionalProperties).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'table_update' zurueck", () => {
      const tool = new TableUpdateTool();
      expect(tool.getMetadata().name).toBe("table_update");
    });

    test("gibt type 'local' zurueck", () => {
      const tool = new TableUpdateTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt category 'tables' zurueck", () => {
      const tool = new TableUpdateTool();
      expect(tool.getMetadata().category).toBe("tables");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new TableUpdateTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — mit row_id
  // -------------------------------------------------------------------------

  describe("execute() — mit row_id", () => {
    test("gibt Fehler-JSON zurueck wenn Tabelle nicht gefunden", async () => {
      mockState.getTableResult = null;
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "unbekannt", row_id: "row-1", data: { name: "Test" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("unbekannt");
    });

    test("gibt Fehler-JSON zurueck wenn Zeile nicht gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = null;
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "nichtvorhanden", data: { name: "X" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("nichtvorhanden");
    });

    test("aktualisiert Zeile erfolgreich und gibt success: true zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = makeRow({ name: "Aktualisiert" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "Aktualisiert" } })
      );
      expect(result.success).toBe(true);
    });

    test("gibt updated_fields-Array mit den aktualisierten Feldnamen zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = makeRow({ name: "Neu", email: "neu@example.com" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({
          table_id: "kontakte",
          row_id: "row-1",
          data: { name: "Neu", email: "neu@example.com" },
        })
      );
      expect(result.updated_fields).toContain("name");
      expect(result.updated_fields).toContain("email");
    });

    test("gibt die vollstaendigen aktualisierten Zeilendaten in data zurueck", async () => {
      const updatedRow = makeRow({ name: "Neu", email: "neu@example.com" });
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = updatedRow;
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "Neu" } })
      );
      expect(result.data).toEqual(updatedRow);
    });

    test("gibt row_id in der Antwort zurueck", async () => {
      const updatedRow = makeRow({ _id: "row-77" });
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow({ _id: "row-77" });
      mockState.updateRowResult = updatedRow;
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-77", data: { name: "Test" } })
      );
      expect(result.row_id).toBe("row-77");
    });

    test("ruft updateRow mit row_id und data auf", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = makeRow();
      const tool = new TableUpdateTool();
      await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { firma: "Neue GmbH" } });
      expect(mockState.updateRowCalledWith.tableId).toBe("kontakte");
      expect(mockState.updateRowCalledWith.params).toEqual({
        row_id: "row-1",
        data: { firma: "Neue GmbH" },
      });
    });
  });

  // -------------------------------------------------------------------------
  // execute() — mit find_by
  // -------------------------------------------------------------------------

  describe("execute() — mit find_by", () => {
    test("gibt Fehler-JSON zurueck wenn keine Treffer gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({ rows: [], total: 0 });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({
          table_id: "kontakte",
          find_by: { name: "Unbekannt" },
          data: { email: "x@y.de" },
        })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Keine Zeile");
      expect(result.search_criteria).toEqual({ name: "Unbekannt" });
    });

    test("gibt Fehler-JSON zurueck wenn mehrere Zeilen gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [makeRow({ _id: "r1" }), makeRow({ _id: "r2" })],
        total: 2,
      });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({
          table_id: "kontakte",
          find_by: { name: "Max" },
          data: { email: "x@y.de" },
        })
      );
      expect(result.success).toBe(false);
      expect(result.found).toBe(2);
      expect(result.error).toContain("Mehrere Zeilen");
    });

    test("gibt matches-Array bei mehreren Treffern zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [makeRow({ _id: "r1" }), makeRow({ _id: "r2" })],
        total: 2,
      });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({
          table_id: "kontakte",
          find_by: { name: "Max" },
          data: { email: "x@y.de" },
        })
      );
      expect(result.matches).toHaveLength(2);
    });

    test("aktualisiert Zeile erfolgreich wenn genau ein Treffer gefunden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({ rows: [makeRow({ _id: "row-55" })], total: 1 });
      mockState.getRowResult = makeRow({ _id: "row-55" });
      mockState.updateRowResult = makeRow({ _id: "row-55", name: "Aktualisiert" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({
          table_id: "kontakte",
          find_by: { name: "Max Mustermann" },
          data: { name: "Aktualisiert" },
        })
      );
      expect(result.success).toBe(true);
      expect(result.row_id).toBe("row-55");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — ohne row_id und find_by
  // -------------------------------------------------------------------------

  describe("execute() — ohne row_id und find_by", () => {
    test("gibt Fehler-JSON zurueck wenn weder row_id noch find_by angegeben", async () => {
      mockState.getTableResult = makeTable();
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Test" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("row_id");
      expect(result.error).toContain("find_by");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — updateRow gibt null zurueck
  // -------------------------------------------------------------------------

  describe("execute() — updateRow gibt null zurueck", () => {
    test("gibt Fehler 'Update fehlgeschlagen' zurueck wenn updateRow null liefert", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = null;
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "X" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Update fehlgeschlagen");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Anzeigename (primary_column)
  // -------------------------------------------------------------------------

  describe("execute() — Anzeigename in Erfolgsmeldung", () => {
    test("verwendet primary_column aus settings als Anzeigename", async () => {
      mockState.getTableResult = makeTable({ settings: { primary_column: "email" } });
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = makeRow({ email: "anzeigewert@example.com" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { email: "x@x.de" } })
      );
      expect(result.message).toContain("anzeigewert@example.com");
    });

    test("verwendet ersten Spaltenwert wenn settings fehlen", async () => {
      mockState.getTableResult = makeTable({ settings: undefined });
      mockState.getRowResult = makeRow();
      mockState.updateRowResult = makeRow({ name: "ErsteSpalte" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "ErsteSpalte" } })
      );
      expect(result.message).toContain("ErsteSpalte");
    });

    test("faellt auf _id zurueck wenn primary_column-Wert im aktualisierten Datensatz fehlt", async () => {
      mockState.getTableResult = makeTable({ settings: { primary_column: "nichtvorhanden" } });
      mockState.getRowResult = makeRow({ _id: "id-fallback" });
      mockState.updateRowResult = makeRow({ _id: "id-fallback" });
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "id-fallback", data: { firma: "X" } })
      );
      expect(result.message).toContain("id-fallback");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehler-JSON mit hint bei Validierungsfehler zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowThrows = true;
      mockState.updateRowError = new Error("Validation failed: email hat falsches Format");
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { email: "kein-email" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
      expect(result.hint).toContain("Datentypen");
    });

    test("gibt Fehler-JSON ohne hint bei allgemeinem Fehler zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowThrows = true;
      mockState.updateRowError = new Error("Allgemeiner Speicherfehler");
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "X" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Allgemeiner Speicherfehler");
      expect(result.hint).toBeUndefined();
    });

    test("gibt den urspruenglichen Fehlernamen unveraendert zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.getRowResult = makeRow();
      mockState.updateRowThrows = true;
      mockState.updateRowError = new Error("Eindeutige Fehlermeldung XYZ");
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "X" } })
      );
      expect(result.error).toBe("Eindeutige Fehlermeldung XYZ");
    });

    test("gibt Fehler-JSON zurueck wenn getTable einen Fehler wirft", async () => {
      mockState.getTableThrows = true;
      mockState.getTableError = new Error("Datenbankfehler in getTable");
      const tool = new TableUpdateTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", row_id: "row-1", data: { name: "X" } })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Datenbankfehler in getTable");
    });
  });
});

// ===========================================================================
// TableListTool
// ===========================================================================

describe("TableListTool", () => {

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TableListTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen 'table_list' zurueck", () => {
      const tool = new TableListTool();
      expect(tool.getDefinition().function.name).toBe("table_list");
    });

    test("hat ein leeres required-Array", () => {
      const tool = new TableListTool();
      const { required } = tool.getDefinition().function.parameters;
      expect(required).toEqual([]);
    });

    test("hat ein leeres properties-Objekt", () => {
      const tool = new TableListTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toEqual({});
    });

    test("parameters.type ist 'object'", () => {
      const tool = new TableListTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'table_list' zurueck", () => {
      const tool = new TableListTool();
      expect(tool.getMetadata().name).toBe("table_list");
    });

    test("gibt type 'local' zurueck", () => {
      const tool = new TableListTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt category 'tables' zurueck", () => {
      const tool = new TableListTool();
      expect(tool.getMetadata().category).toBe("tables");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new TableListTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — leere Tabellenliste
  // -------------------------------------------------------------------------

  describe("execute() — keine Tabellen vorhanden", () => {
    test("gibt success: true und leeres tables-Array zurueck", async () => {
      mockState.listTablesWithStatsResult = [];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.success).toBe(true);
      expect(result.tables).toEqual([]);
    });

    test("gibt hint mit Hinweis auf Tabellenerstellung zurueck", async () => {
      mockState.listTablesWithStatsResult = [];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.hint).toBeDefined();
      expect(result.hint.length).toBeGreaterThan(0);
    });

    test("gibt eine Meldung 'Keine Tabellen vorhanden' zurueck", async () => {
      mockState.listTablesWithStatsResult = [];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.message).toContain("Keine Tabellen");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — mehrere Tabellen
  // -------------------------------------------------------------------------

  describe("execute() — mehrere Tabellen vorhanden", () => {
    test("gibt korrekten count zurueck", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ id: "t1", name: "Tabelle 1" }), row_count: 5 },
        { ...makeTable({ id: "t2", name: "Tabelle 2" }), row_count: 10 },
        { ...makeTable({ id: "t3", name: "Tabelle 3" }), row_count: 0 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.tables).toHaveLength(3);
    });

    test("jede Tabelle enthaelt id, name, description und icon", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ id: "tk", name: "Kontakte", description: "Kontaktliste", icon: "👤" }), row_count: 7 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      const table = result.tables[0];
      expect(table.id).toBe("tk");
      expect(table.name).toBe("Kontakte");
      expect(table.description).toBe("Kontaktliste");
      expect(table.icon).toBe("👤");
    });

    test("jede Tabelle enthaelt row_count", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ id: "t1" }), row_count: 42 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.tables[0].row_count).toBe(42);
    });

    test("columns-Array enthaelt id, name, type und required pro Spalte", async () => {
      mockState.listTablesWithStatsResult = [
        {
          ...makeTable({
            columns: [
              { id: "name", name: "Name", type: "text", required: true },
              { id: "email", name: "E-Mail", type: "email" },
            ],
          }),
          row_count: 1,
        },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      const cols = result.tables[0].columns;
      expect(cols).toHaveLength(2);
      expect(cols[0]).toEqual({ id: "name", name: "Name", type: "text", required: true });
      expect(cols[1]).toEqual({ id: "email", name: "E-Mail", type: "email", required: false });
    });

    test("required faellt auf false zurueck wenn nicht gesetzt", async () => {
      mockState.listTablesWithStatsResult = [
        {
          ...makeTable({
            columns: [{ id: "feld", name: "Feld", type: "text" }],
          }),
          row_count: 0,
        },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.tables[0].columns[0].required).toBe(false);
    });

    test("views-Array enthaelt id und name jeder View", async () => {
      mockState.listTablesWithStatsResult = [
        {
          ...makeTable({
            views: [
              { id: "aktive", name: "Aktive Kontakte", filter: "status = 'aktiv'" },
              { id: "archiviert", name: "Archiviert", filter: "status = 'archiv'" },
            ],
          }),
          row_count: 3,
        },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      const views = result.tables[0].views;
      expect(views).toHaveLength(2);
      expect(views[0]).toEqual({ id: "aktive", name: "Aktive Kontakte" });
      expect(views[1]).toEqual({ id: "archiviert", name: "Archiviert" });
    });

    test("views ist leeres Array wenn Tabelle keine Views hat", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ views: undefined }), row_count: 0 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.tables[0].views).toEqual([]);
    });

    test("description faellt auf leeren String zurueck wenn nicht gesetzt", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ description: undefined }), row_count: 0 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.tables[0].description).toBe("");
    });

    test("icon faellt auf leeren String zurueck wenn nicht gesetzt", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable({ icon: undefined }), row_count: 0 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.tables[0].icon).toBe("");
    });

    test("gibt keine hint-Property zurueck bei vorhandenen Tabellen", async () => {
      mockState.listTablesWithStatsResult = [
        { ...makeTable(), row_count: 1 },
      ];
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result).not.toHaveProperty("hint");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehler-JSON zurueck wenn listTablesWithStats einen Fehler wirft", async () => {
      mockState.listTablesThrows = true;
      mockState.listTablesError = new Error("Dateisystemfehler");
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.success).toBe(false);
      expect(result.error).toContain("Dateisystemfehler");
    });

    test("gibt die urspruengliche Fehlermeldung unveraendert zurueck", async () => {
      mockState.listTablesThrows = true;
      mockState.listTablesError = new Error("Eindeutiger Fehlertext ABCDE");
      const tool = new TableListTool();
      const result = JSON.parse(await tool.execute({}));
      expect(result.error).toBe("Eindeutiger Fehlertext ABCDE");
    });
  });
});
