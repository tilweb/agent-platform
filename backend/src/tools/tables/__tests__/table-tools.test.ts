/**
 * Tests fuer TableQueryTool und TableAddTool
 *
 * Das '../../tables'-Modul (Index-Modul, das queryRows, getTable, queryView,
 * addRow exportiert) wird per mock.module() ersetzt, damit keine echten
 * Dateisystem-Operationen stattfinden.
 *
 * Wichtig: mock.module()-Aufrufe muessen VOR dem dynamischen Import des Moduls
 * unter Test stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Die Pfade in mock.module() sind relativ zur Testdatei. Die Module unter Test
 * liegen in src/tools/tables/, die Testdatei in src/tools/tables/__tests__/,
 * daher zeigt der Pfad auf ../../../tables.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { TableSchema, QueryResult, RowData } from "../../../tables/types";

// ---------------------------------------------------------------------------
// Mock-State: gemeinsames mutablees Objekt fuer alle Mock-Implementierungen
// ---------------------------------------------------------------------------

const mockState = {
  getTableResult: null as TableSchema | null,
  queryRowsResult: null as QueryResult | null,
  queryViewResult: null as QueryResult | null,
  queryViewThrows: false as boolean,
  queryViewError: null as Error | null,
  addRowResult: null as RowData | null,
  addRowThrows: false as boolean,
  addRowError: null as Error | null,

  // Aufruf-Argumente zur Verifikation
  queryRowsCalledWith: null as any,
  queryViewCalledWith: null as any,
  addRowCalledWith: null as any,
};

// ---------------------------------------------------------------------------
// Mock-Registrierung VOR dem Import des Moduls unter Test
// ---------------------------------------------------------------------------

mock.module("../../../tables", () => ({
  getTable: async (_tableId: string) => mockState.getTableResult,

  queryRows: async (tableId: string, options: any) => {
    mockState.queryRowsCalledWith = { tableId, options };
    return mockState.queryRowsResult;
  },

  queryView: async (tableId: string, viewId: string, options: any) => {
    mockState.queryViewCalledWith = { tableId, viewId, options };
    if (mockState.queryViewThrows) {
      throw mockState.queryViewError ?? new Error("View nicht gefunden");
    }
    return mockState.queryViewResult;
  },

  addRow: async (tableId: string, params: any) => {
    mockState.addRowCalledWith = { tableId, params };
    if (mockState.addRowThrows) {
      throw mockState.addRowError ?? new Error("Unbekannter Fehler");
    }
    return mockState.addRowResult;
  },
}));

// ---------------------------------------------------------------------------
// Import der Module unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { TableQueryTool } = await import("../table-query");
const { TableAddTool } = await import("../table-add");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "kontakte",
    name: "Kontakte",
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

function makeQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    rows: [
      { _id: "row-1", name: "Max Mustermann", email: "max@example.com" },
      { _id: "row-2", name: "Erika Muster", email: "erika@example.com" },
    ],
    total: 2,
    offset: 0,
    limit: 50,
    ...overrides,
  };
}

function makeRow(overrides: Partial<RowData> = {}): RowData {
  return {
    _id: "row-neu-1",
    _created_at: "2024-06-01T10:00:00.000Z",
    name: "Neuer Kontakt",
    email: "neu@example.com",
    firma: "Neue GmbH",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset vor jedem Test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.getTableResult = null;
  mockState.queryRowsResult = null;
  mockState.queryViewResult = null;
  mockState.queryViewThrows = false;
  mockState.queryViewError = null;
  mockState.addRowResult = null;
  mockState.addRowThrows = false;
  mockState.addRowError = null;
  mockState.queryRowsCalledWith = null;
  mockState.queryViewCalledWith = null;
  mockState.addRowCalledWith = null;
});

// ===========================================================================
// TableQueryTool
// ===========================================================================

describe("TableQueryTool", () => {

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TableQueryTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen 'table_query' zurueck", () => {
      const tool = new TableQueryTool();
      expect(tool.getDefinition().function.name).toBe("table_query");
    });

    test("hat 'table_id' als einziges Pflichtfeld", () => {
      const tool = new TableQueryTool();
      const { required } = tool.getDefinition().function.parameters;
      expect(required).toEqual(["table_id"]);
    });

    test("enthaelt alle erwarteten Parameter-Properties", () => {
      const tool = new TableQueryTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties).toHaveProperty("table_id");
      expect(properties).toHaveProperty("filter");
      expect(properties).toHaveProperty("sort_by");
      expect(properties).toHaveProperty("sort_direction");
      expect(properties).toHaveProperty("limit");
      expect(properties).toHaveProperty("offset");
      expect(properties).toHaveProperty("view_id");
      expect(properties).toHaveProperty("columns");
    });

    test("sort_direction hat die korrekten Enum-Werte", () => {
      const tool = new TableQueryTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties["sort_direction"]!.enum).toEqual(["ASC", "DESC"]);
    });

    test("parameters.type ist 'object'", () => {
      const tool = new TableQueryTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'table_query' zurueck", () => {
      const tool = new TableQueryTool();
      expect(tool.getMetadata().name).toBe("table_query");
    });

    test("gibt type 'local' zurueck", () => {
      const tool = new TableQueryTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt category 'tables' zurueck", () => {
      const tool = new TableQueryTool();
      expect(tool.getMetadata().category).toBe("tables");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new TableQueryTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerfall: Tabelle nicht gefunden
  // -------------------------------------------------------------------------

  describe("execute() — Tabelle nicht gefunden", () => {
    test("gibt Fehler-JSON mit Hinweis zurueck wenn Tabelle nicht existiert", async () => {
      mockState.getTableResult = null;
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "unbekannt" }));

      expect(result.success).toBe(false);
      expect(result.error).toContain("unbekannt");
      expect(result.hint).toContain("table_list");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Basisabfrage
  // -------------------------------------------------------------------------

  describe("execute() — Basisabfrage", () => {
    test("ruft queryRows mit korrekten Standardoptionen auf und gibt Zeilen zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte" }));

      expect(result.success).toBe(true);
      expect(result.table).toBe("kontakte");
      expect(result.rows).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.showing).toBe(2);
    });

    test("uebergibt limit=50 und offset=0 als Standardwerte an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte" });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.limit).toBe(50);
      expect(options.offset).toBe(0);
    });

    test("uebergibt resolve_relations: true an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte" });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.resolve_relations).toBe(true);
    });

    test("hint ist null wenn alle Zeilen zurueckgegeben werden", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({ rows: [{ _id: "r1" }], total: 1 });
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte" }));

      expect(result.hint).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Filter, Sortierung, Pagination
  // -------------------------------------------------------------------------

  describe("execute() — Filter, Sortierung und Pagination", () => {
    test("uebergibt filter als filter_text an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte", filter: "status = 'aktiv'" });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.filter_text).toBe("status = 'aktiv'");
    });

    test("uebergibt sort_by und sort_direction an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({
        table_id: "kontakte",
        sort_by: "name",
        sort_direction: "DESC",
      });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.sort_by).toBe("name");
      expect(options.sort_direction).toBe("DESC");
    });

    test("uebergibt benutzerdefiniertes limit und offset an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte", limit: 10, offset: 20 });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.limit).toBe(10);
      expect(options.offset).toBe(20);
    });

    test("uebergibt columns-Filter an queryRows", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte", columns: ["name", "email"] });

      const { options } = mockState.queryRowsCalledWith;
      expect(options.columns).toEqual(["name", "email"]);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Paginierungs-Hinweis
  // -------------------------------------------------------------------------

  describe("execute() — Paginierungs-Hinweis", () => {
    test("gibt Paginierungshinweis mit korrektem offset zurueck wenn weitere Zeilen vorhanden sind", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [{ _id: "r1" }, { _id: "r2" }],
        total: 10,
        offset: 0,
        limit: 2,
      });
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte", limit: 2 }));

      expect(result.hint).toContain("8 weitere Zeilen");
      expect(result.hint).toContain("offset=2");
    });

    test("Paginierungshinweis berechnet offset korrekt wenn offset > 0 war", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryRowsResult = makeQueryResult({
        rows: [{ _id: "r3" }, { _id: "r4" }],
        total: 10,
        offset: 2,
        limit: 2,
      });
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte", limit: 2, offset: 2 }));

      expect(result.hint).toContain("offset=4");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — View-Abfrage
  // -------------------------------------------------------------------------

  describe("execute() — Abfrage mit view_id", () => {
    test("ruft queryView statt queryRows auf wenn view_id angegeben wird", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryViewResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte", view_id: "aktive" });

      expect(mockState.queryViewCalledWith).not.toBeNull();
      expect(mockState.queryRowsCalledWith).toBeNull();
    });

    test("uebergibt table_id und view_id korrekt an queryView", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryViewResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({ table_id: "kontakte", view_id: "aktive" });

      expect(mockState.queryViewCalledWith.tableId).toBe("kontakte");
      expect(mockState.queryViewCalledWith.viewId).toBe("aktive");
    });

    test("uebergibt limit, offset und columns an queryView", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryViewResult = makeQueryResult();
      const tool = new TableQueryTool();
      await tool.execute({
        table_id: "kontakte",
        view_id: "aktive",
        limit: 5,
        offset: 10,
        columns: ["name"],
      });

      const { options } = mockState.queryViewCalledWith;
      expect(options.limit).toBe(5);
      expect(options.offset).toBe(10);
      expect(options.columns).toEqual(["name"]);
    });

    test("gibt Erfolgs-JSON mit view_id als filter_applied zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryViewResult = makeQueryResult();
      const tool = new TableQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte", view_id: "aktive" }));

      expect(result.success).toBe(true);
      expect(result.filter_applied).toBe("aktive");
    });

    test("gibt Fehler mit available_views zurueck wenn View nicht gefunden wird", async () => {
      mockState.getTableResult = makeTable();
      mockState.queryViewThrows = true;
      mockState.queryViewError = new Error("View nicht gefunden");
      const tool = new TableQueryTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", view_id: "unbekannter-view" })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("unbekannter-view");
      expect(result.available_views).toEqual(["aktive"]);
    });

    test("available_views ist leeres Array wenn Tabelle keine Views hat", async () => {
      mockState.getTableResult = makeTable({ views: undefined });
      mockState.queryViewThrows = true;
      mockState.queryViewError = new Error("View nicht gefunden");
      const tool = new TableQueryTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", view_id: "ghost" })
      );

      expect(result.available_views).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehler-JSON zurueck wenn queryRows eine Exception wirft", async () => {
      mockState.getTableResult = makeTable();
      // queryRows wird direkt durch eine fehlerhafte Implementierung ersetzt
      // indem getTable valide ist, aber queryRowsResult null ist und dann
      // stattdessen ein Modul-Level-Fehler simuliert werden soll.
      // Wir ueberschreiben den Mock gezielt fuer diesen Test:
      mock.module("../../../tables", () => ({
        getTable: async () => makeTable(),
        queryRows: async () => {
          throw new Error("Datenbankfehler");
        },
        queryView: async (_tid: string, _vid: string) => {
          throw new Error("View nicht gefunden");
        },
        addRow: async () => makeRow(),
      }));

      const { TableQueryTool: FreshQueryTool } = await import("../table-query");
      const tool = new FreshQueryTool();
      const result = JSON.parse(await tool.execute({ table_id: "kontakte" }));

      expect(result.success).toBe(false);
      expect(result.error).toContain("Datenbankfehler");
    });
  });
});

// ===========================================================================
// TableAddTool
// ===========================================================================

describe("TableAddTool", () => {

  // -------------------------------------------------------------------------
  // Restore mocks nach dem TableQueryTool-Fehlertest
  // -------------------------------------------------------------------------

  beforeEach(() => {
    mock.module("../../../tables", () => ({
      getTable: async (_tableId: string) => mockState.getTableResult,
      queryRows: async (tableId: string, options: any) => {
        mockState.queryRowsCalledWith = { tableId, options };
        return mockState.queryRowsResult;
      },
      queryView: async (tableId: string, viewId: string, options: any) => {
        mockState.queryViewCalledWith = { tableId, viewId, options };
        if (mockState.queryViewThrows) {
          throw mockState.queryViewError ?? new Error("View nicht gefunden");
        }
        return mockState.queryViewResult;
      },
      addRow: async (tableId: string, params: any) => {
        mockState.addRowCalledWith = { tableId, params };
        if (mockState.addRowThrows) {
          throw mockState.addRowError ?? new Error("Unbekannter Fehler");
        }
        return mockState.addRowResult;
      },
    }));
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TableAddTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen 'table_add' zurueck", () => {
      const tool = new TableAddTool();
      expect(tool.getDefinition().function.name).toBe("table_add");
    });

    test("hat 'table_id' und 'data' als Pflichtfelder", () => {
      const tool = new TableAddTool();
      const { required } = tool.getDefinition().function.parameters;
      expect(required).toContain("table_id");
      expect(required).toContain("data");
    });

    test("required-Array enthaelt genau zwei Eintraege", () => {
      const tool = new TableAddTool();
      expect(tool.getDefinition().function.parameters.required).toHaveLength(2);
    });

    test("parameters.type ist 'object'", () => {
      const tool = new TableAddTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });

    test("data-Parameter erlaubt additionalProperties", () => {
      const tool = new TableAddTool();
      const { properties } = tool.getDefinition().function.parameters;
      expect(properties["data"]!.additionalProperties).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'table_add' zurueck", () => {
      const tool = new TableAddTool();
      expect(tool.getMetadata().name).toBe("table_add");
    });

    test("gibt type 'local' zurueck", () => {
      const tool = new TableAddTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt category 'tables' zurueck", () => {
      const tool = new TableAddTool();
      expect(tool.getMetadata().category).toBe("tables");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new TableAddTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Tabelle nicht gefunden
  // -------------------------------------------------------------------------

  describe("execute() — Tabelle nicht gefunden", () => {
    test("gibt Fehler-JSON mit Hinweis zurueck wenn Tabelle nicht existiert", async () => {
      mockState.getTableResult = null;
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "unbekannt", data: { name: "Test" } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("unbekannt");
      expect(result.hint).toContain("table_list");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Pflichtfeld-Validierung
  // -------------------------------------------------------------------------

  describe("execute() — fehlende Pflichtfelder", () => {
    test("gibt Fehler-JSON zurueck wenn ein Pflichtfeld fehlt", async () => {
      mockState.getTableResult = makeTable();
      const tool = new TableAddTool();
      // 'name' ist required, aber nicht in data angegeben
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { email: "x@y.de" } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pflichtfelder fehlen");
      expect(result.error).toContain("Name");
    });

    test("listet alle fehlenden Pflichtfelder in required_fields auf", async () => {
      mockState.getTableResult = makeTable({
        columns: [
          { id: "name", name: "Name", type: "text", required: true },
          { id: "email", name: "E-Mail", type: "email", required: true },
          { id: "firma", name: "Firma", type: "text" },
        ],
      });
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: {} })
      );

      expect(result.success).toBe(false);
      expect(result.required_fields).toHaveLength(2);
      expect(result.required_fields.map((f: any) => f.id)).toContain("name");
      expect(result.required_fields.map((f: any) => f.id)).toContain("email");
    });

    test("required_fields enthaelt id, name und type jedes Pflichtfelds", async () => {
      mockState.getTableResult = makeTable();
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: {} })
      );

      expect(result.required_fields[0]).toHaveProperty("id");
      expect(result.required_fields[0]).toHaveProperty("name");
      expect(result.required_fields[0]).toHaveProperty("type");
    });

    test("fuegt Zeile ein wenn alle Pflichtfelder vorhanden sind", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowResult = makeRow();
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Max" } })
      );

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Erfolgreicher Einfuegevorgang
  // -------------------------------------------------------------------------

  describe("execute() — Erfolgreicher Einfuegevorgang", () => {
    test("ruft addRow mit table_id und data-Wrapper auf", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowResult = makeRow();
      const tool = new TableAddTool();
      await tool.execute({ table_id: "kontakte", data: { name: "Max" } });

      expect(mockState.addRowCalledWith.tableId).toBe("kontakte");
      expect(mockState.addRowCalledWith.params).toEqual({ data: { name: "Max" } });
    });

    test("gibt row_id der neu erstellten Zeile zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowResult = makeRow({ _id: "row-42" });
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Max" } })
      );

      expect(result.success).toBe(true);
      expect(result.row_id).toBe("row-42");
    });

    test("gibt die vollstaendigen Zeilendaten in data zurueck", async () => {
      const row = makeRow({ name: "Anna", email: "anna@test.de" });
      mockState.getTableResult = makeTable();
      mockState.addRowResult = row;
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Anna" } })
      );

      expect(result.data).toEqual(row);
    });

    test("verwendet primary_column aus settings als Anzeigename in der Erfolgsmeldung", async () => {
      mockState.getTableResult = makeTable({
        settings: { primary_column: "name" },
      });
      mockState.addRowResult = makeRow({ _id: "r1", name: "Primärwert" });
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Primärwert" } })
      );

      expect(result.message).toContain("Primärwert");
      expect(result.message).toContain("Kontakte");
    });

    test("faellt auf _id zurueck als Anzeigename wenn primary_column-Wert fehlt", async () => {
      mockState.getTableResult = makeTable({
        settings: { primary_column: "nichtvorhanden" },
      });
      mockState.addRowResult = makeRow({ _id: "fallback-id" });
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Test" } })
      );

      expect(result.message).toContain("fallback-id");
    });

    test("verwendet erste Spalten-ID als primary_column wenn settings fehlen", async () => {
      mockState.getTableResult = makeTable({ settings: undefined });
      mockState.addRowResult = makeRow({ _id: "r1", name: "ErsteSpalte" });
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "ErsteSpalte" } })
      );

      expect(result.message).toContain("ErsteSpalte");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehler-JSON mit Hinweis zurueck bei Validierungsfehler", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowThrows = true;
      mockState.addRowError = new Error("Validation failed: email hat falsches Format");
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Test" } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
      expect(result.hint).toContain("Datentypen");
    });

    test("gibt Fehler-JSON ohne hint zurueck bei allgemeinem Fehler", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowThrows = true;
      mockState.addRowError = new Error("Speicherfehler");
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Test" } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Speicherfehler");
      expect(result.hint).toBeUndefined();
    });

    test("gibt Fehler-JSON mit der urspruenglichen Fehlermeldung zurueck", async () => {
      mockState.getTableResult = makeTable();
      mockState.addRowThrows = true;
      mockState.addRowError = new Error("Eindeutiger Fehlerschluessel");
      const tool = new TableAddTool();
      const result = JSON.parse(
        await tool.execute({ table_id: "kontakte", data: { name: "Test" } })
      );

      expect(result.error).toBe("Eindeutiger Fehlerschluessel");
    });
  });
});
