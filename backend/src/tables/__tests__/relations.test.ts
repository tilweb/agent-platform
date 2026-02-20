/**
 * Tests for Table Relations (backend/src/tables/relations.ts)
 *
 * The storage module is fully mocked so that no filesystem I/O is needed.
 * The mock must be registered BEFORE the dynamic import of the module under test.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { TableSchema, TableData, RowData } from "../types";

// ---------------------------------------------------------------------------
// In-memory state for the mocked storage
// ---------------------------------------------------------------------------

type SchemaStore = Record<string, TableSchema>;
type DataStore = Record<string, TableData>;

let schemas: SchemaStore = {};
let tableData: DataStore = {};

function makeSchema(
  id: string,
  columns: TableSchema["columns"] = [],
  settings?: TableSchema["settings"]
): TableSchema {
  return {
    id,
    name: id,
    columns,
    settings,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  };
}

function makeData(rows: RowData[]): TableData {
  return {
    updated_at: "2024-01-01T00:00:00.000Z",
    row_count: rows.length,
    rows,
  };
}

function makeRow(id: string, extra: Record<string, any> = {}): RowData {
  return { _id: id, ...extra };
}

// ---------------------------------------------------------------------------
// Module mock — declared BEFORE dynamic import
// ---------------------------------------------------------------------------

mock.module("../storage", () => ({
  loadSchema: async (tableId: string) => schemas[tableId] ?? null,
  loadData: async (tableId: string) => tableData[tableId] ?? null,
  listTables: async () => Object.values(schemas),
  getRow: async (tableId: string, rowId: string) => {
    const data = tableData[tableId];
    if (!data) return null;
    return data.rows.find((r) => r._id === rowId) ?? null;
  },
  updateRow: async (
    tableId: string,
    rowId: string,
    updates: Record<string, any>
  ) => {
    const data = tableData[tableId];
    if (!data) throw new Error(`Table "${tableId}" not found`);
    const idx = data.rows.findIndex((r) => r._id === rowId);
    if (idx === -1) return null;
    data.rows[idx] = { ...data.rows[idx], ...updates };
    return data.rows[idx];
  },
  deleteRow: async (tableId: string, rowId: string) => {
    const data = tableData[tableId];
    if (!data) throw new Error(`Table "${tableId}" not found`);
    const before = data.rows.length;
    data.rows = data.rows.filter((r) => r._id !== rowId);
    return data.rows.length < before;
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  getTableRelations,
  getReverseRelations,
  getAllRelations,
  resolveRelation,
  resolveRowRelations,
  resolveRowsRelations,
  getRelationOptions,
  getRowReferences,
  hasIncomingReferences,
  validateRelationIntegrity,
  fixBrokenRelations,
  deleteRowWithCascade,
} = await import("../relations");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStores() {
  schemas = {};
  tableData = {};
}

function registerTable(
  id: string,
  columns: TableSchema["columns"] = [],
  rows: RowData[] = [],
  settings?: TableSchema["settings"]
) {
  schemas[id] = makeSchema(id, columns, settings);
  tableData[id] = makeData(rows);
}

function relationCol(
  id: string,
  relTable: string,
  displayCol?: string
): TableSchema["columns"][number] {
  return {
    id,
    name: id,
    type: "relation",
    relation_table: relTable,
    relation_display_column: displayCol,
  };
}

function textCol(id: string): TableSchema["columns"][number] {
  return { id, name: id, type: "text" };
}

// ============================================================================
// getTableRelations
// ============================================================================

describe("getTableRelations", () => {
  beforeEach(resetStores);

  describe("Grundlegende Relationen-Erkennung", () => {
    test("gibt leeres Array zurück wenn Tabelle nicht existiert", async () => {
      const result = await getTableRelations("unbekannt");
      expect(result).toEqual([]);
    });

    test("gibt leeres Array zurück wenn Tabelle keine Relationsspalten hat", async () => {
      registerTable("kunden", [textCol("name"), textCol("email")]);
      const result = await getTableRelations("kunden");
      expect(result).toEqual([]);
    });

    test("gibt eine Relation zurück wenn eine Relationsspalte vorhanden ist", async () => {
      registerTable("auftraege", [
        textCol("titel"),
        relationCol("kunde_id", "kunden"),
      ]);
      const result = await getTableRelations("auftraege");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        source_table: "auftraege",
        source_column: "kunde_id",
        target_table: "kunden",
      });
    });

    test("gibt mehrere Relationen zurück wenn mehrere Relationsspalten existieren", async () => {
      registerTable("auftraege", [
        relationCol("kunde_id", "kunden"),
        relationCol("projekt_id", "projekte"),
        relationCol("mitarbeiter_id", "mitarbeiter"),
      ]);
      const result = await getTableRelations("auftraege");
      expect(result).toHaveLength(3);
      const targets = result.map((r) => r.target_table);
      expect(targets).toContain("kunden");
      expect(targets).toContain("projekte");
      expect(targets).toContain("mitarbeiter");
    });

    test("übergibt display_column korrekt wenn angegeben", async () => {
      registerTable("auftraege", [
        relationCol("kunde_id", "kunden", "firmenname"),
      ]);
      const result = await getTableRelations("auftraege");
      expect(result[0]!.display_column).toBe("firmenname");
    });

    test("display_column ist undefined wenn nicht angegeben", async () => {
      registerTable("auftraege", [relationCol("kunde_id", "kunden")]);
      const result = await getTableRelations("auftraege");
      expect(result[0]!.display_column).toBeUndefined();
    });

    test("ignoriert Nicht-Relationsspalten", async () => {
      registerTable("auftraege", [
        textCol("titel"),
        { id: "wert", name: "Wert", type: "number" },
        relationCol("kunde_id", "kunden"),
      ]);
      const result = await getTableRelations("auftraege");
      expect(result).toHaveLength(1);
      expect(result[0]!.source_column).toBe("kunde_id");
    });

    test("ignoriert Relationsspalten ohne relation_table", async () => {
      registerTable("auftraege", [
        // Spalte vom Typ relation, aber ohne relation_table
        { id: "ref", name: "Ref", type: "relation" },
      ]);
      const result = await getTableRelations("auftraege");
      expect(result).toHaveLength(0);
    });
  });
});

// ============================================================================
// getReverseRelations
// ============================================================================

describe("getReverseRelations", () => {
  beforeEach(resetStores);

  test("gibt leeres Array zurück wenn keine Tabelle auf die Zieltabelle zeigt", async () => {
    registerTable("kunden", [textCol("name")]);
    const result = await getReverseRelations("kunden");
    expect(result).toEqual([]);
  });

  test("findet eine eingehende Relation", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("auftraege", [
      textCol("titel"),
      relationCol("kunde_id", "kunden"),
    ]);
    const result = await getReverseRelations("kunden");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source_table: "auftraege",
      source_column: "kunde_id",
      target_table: "kunden",
    });
  });

  test("findet mehrere eingehende Relationen aus verschiedenen Tabellen", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("auftraege", [relationCol("kunde_id", "kunden")]);
    registerTable("rechnungen", [relationCol("kunde_ref", "kunden")]);
    const result = await getReverseRelations("kunden");
    expect(result).toHaveLength(2);
    const sourceTables = result.map((r) => r.source_table);
    expect(sourceTables).toContain("auftraege");
    expect(sourceTables).toContain("rechnungen");
  });

  test("gibt leeres Array zurück wenn keine Tabellen existieren", async () => {
    const result = await getReverseRelations("irgendwas");
    expect(result).toEqual([]);
  });

  test("findet nur Relationen die auf die angegebene Tabelle zeigen (kein false positive)", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("projekte", [textCol("titel")]);
    registerTable("auftraege", [
      relationCol("kunde_id", "kunden"),
      relationCol("projekt_id", "projekte"),
    ]);
    const result = await getReverseRelations("projekte");
    expect(result).toHaveLength(1);
    expect(result[0]!.source_column).toBe("projekt_id");
    expect(result[0]!.target_table).toBe("projekte");
  });
});

// ============================================================================
// getAllRelations
// ============================================================================

describe("getAllRelations", () => {
  beforeEach(resetStores);

  test("gibt leeres Array zurück wenn keine Tabellen existieren", async () => {
    const result = await getAllRelations();
    expect(result).toEqual([]);
  });

  test("gibt leeres Array zurück wenn keine Tabelle Relationsspalten hat", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("projekte", [textCol("titel")]);
    const result = await getAllRelations();
    expect(result).toEqual([]);
  });

  test("gibt alle Relationen aus allen Tabellen zurück", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("auftraege", [
      relationCol("kunde_id", "kunden"),
      relationCol("projekt_id", "projekte"),
    ]);
    registerTable("projekte", [textCol("titel")]);
    const result = await getAllRelations();
    expect(result).toHaveLength(2);
  });

  test("RelationInfo-Objekte haben die korrekten Felder", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("auftraege", [
      relationCol("kunde_id", "kunden", "firmenname"),
    ]);
    const result = await getAllRelations();
    expect(result[0]).toMatchObject({
      source_table: "auftraege",
      source_column: "kunde_id",
      target_table: "kunden",
      display_column: "firmenname",
    });
  });
});

// ============================================================================
// resolveRelation
// ============================================================================

describe("resolveRelation", () => {
  beforeEach(resetStores);

  test("gibt null zurück wenn die Zieltabelle nicht existiert", async () => {
    const result = await resolveRelation("unbekannt", "row_1");
    expect(result).toBeNull();
  });

  test("gibt null zurück wenn die Zeile nicht existiert", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("row_1", { name: "Mustermann GmbH" })]);
    const result = await resolveRelation("kunden", "row_999");
    expect(result).toBeNull();
  });

  test("gibt den Wert der display_column zurück wenn angegeben", async () => {
    registerTable(
      "kunden",
      [textCol("firmenname"), textCol("email")],
      [makeRow("row_1", { firmenname: "Mustermann GmbH", email: "info@mustermann.de" })]
    );
    const result = await resolveRelation("kunden", "row_1", "firmenname");
    expect(result).toBe("Mustermann GmbH");
  });

  test("fällt auf _id zurück wenn display_column undefiniert ist und kein Schema existiert", async () => {
    // Tabelle ohne Schema-Eintrag, nur Daten
    tableData["kunden"] = makeData([makeRow("row_1", { name: "Test" })]);
    const result = await resolveRelation("kunden", "row_1");
    expect(result).toBe("row_1");
  });

  test("gibt Wert der ersten Spalte zurück wenn keine display_column angegeben", async () => {
    registerTable(
      "kunden",
      [textCol("firmenname"), textCol("email")],
      [makeRow("row_1", { firmenname: "Schmidt AG", email: "info@schmidt.de" })]
    );
    const result = await resolveRelation("kunden", "row_1");
    expect(result).toBe("Schmidt AG");
  });

  test("gibt _id zurück wenn display_column-Wert null/undefined ist", async () => {
    registerTable(
      "kunden",
      [textCol("firmenname")],
      [makeRow("row_1")]
    );
    const result = await resolveRelation("kunden", "row_1", "firmenname");
    expect(result).toBe("row_1");
  });
});

// ============================================================================
// resolveRowRelations
// ============================================================================

describe("resolveRowRelations", () => {
  beforeEach(resetStores);

  test("gibt unveränderte Zeile zurück wenn keine Relationsspalten vorhanden sind", async () => {
    const schema = makeSchema("auftraege", [textCol("titel")]);
    const row = makeRow("row_1", { titel: "Auftrag 1" });
    const result = await resolveRowRelations(schema, row);
    expect(result).toEqual(row);
  });

  test("fügt _display-Feld hinzu wenn Relation aufgelöst wird", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Mustermann GmbH" })]
    );
    const schema = makeSchema("auftraege", [
      textCol("titel"),
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("row_1", { titel: "Auftrag A", kunde_id: "k1" });
    const result = await resolveRowRelations(schema, row);
    expect(result.kunde_id_display).toBe("Mustermann GmbH");
  });

  test("lässt Originalfelder der Zeile unverändert", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Mustermann GmbH" })]
    );
    const schema = makeSchema("auftraege", [
      textCol("titel"),
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("row_1", { titel: "Auftrag A", kunde_id: "k1" });
    const result = await resolveRowRelations(schema, row);
    expect(result._id).toBe("row_1");
    expect(result.titel).toBe("Auftrag A");
    expect(result.kunde_id).toBe("k1");
  });

  test("fügt kein _display-Feld hinzu wenn Relationsspalte leer ist", async () => {
    registerTable("kunden", [textCol("name")], []);
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("row_1", {});
    const result = await resolveRowRelations(schema, row);
    expect(result).not.toHaveProperty("kunde_id_display");
  });

  test("fügt kein _display-Feld hinzu wenn Relation nicht aufgelöst werden kann", async () => {
    registerTable("kunden", [textCol("name")], []);
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("row_1", { kunde_id: "existiert_nicht" });
    const result = await resolveRowRelations(schema, row);
    expect(result).not.toHaveProperty("kunde_id_display");
  });

  test("löst mehrere Relationsspalten gleichzeitig auf", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Meier AG" })]
    );
    registerTable(
      "projekte",
      [textCol("titel")],
      [makeRow("p1", { titel: "Webseite" })]
    );
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
      relationCol("projekt_id", "projekte"),
    ]);
    const row = makeRow("row_1", { kunde_id: "k1", projekt_id: "p1" });
    const result = await resolveRowRelations(schema, row);
    expect(result.kunde_id_display).toBe("Meier AG");
    expect(result.projekt_id_display).toBe("Webseite");
  });
});

// ============================================================================
// resolveRowsRelations
// ============================================================================

describe("resolveRowsRelations", () => {
  beforeEach(resetStores);

  test("gibt unveränderte Zeilen zurück wenn keine Relationsspalten vorhanden sind", async () => {
    const schema = makeSchema("auftraege", [textCol("titel")]);
    const rows = [makeRow("r1", { titel: "A" }), makeRow("r2", { titel: "B" })];
    const result = await resolveRowsRelations(schema, rows);
    expect(result).toEqual(rows);
  });

  test("gibt leeres Array zurück bei leerem Input", async () => {
    const schema = makeSchema("auftraege", [textCol("titel")]);
    const result = await resolveRowsRelations(schema, []);
    expect(result).toEqual([]);
  });

  test("löst Relationen für mehrere Zeilen auf", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [
        makeRow("k1", { name: "Firma A" }),
        makeRow("k2", { name: "Firma B" }),
      ]
    );
    const schema = makeSchema("auftraege", [
      textCol("titel"),
      relationCol("kunde_id", "kunden"),
    ]);
    const rows = [
      makeRow("r1", { titel: "Auftrag 1", kunde_id: "k1" }),
      makeRow("r2", { titel: "Auftrag 2", kunde_id: "k2" }),
    ];
    const result = await resolveRowsRelations(schema, rows);
    expect(result[0]!.kunde_id_display).toBe("Firma A");
    expect(result[1]!.kunde_id_display).toBe("Firma B");
  });

  test("nutzt primary_column aus Settings als Anzeige-Spalte wenn kein displayColumn angegeben", async () => {
    registerTable(
      "kunden",
      [textCol("intern"), textCol("firmenname")],
      [makeRow("k1", { intern: "X001", firmenname: "Acme Corp" })],
      { primary_column: "firmenname" }
    );
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const rows = [makeRow("r1", { kunde_id: "k1" })];
    const result = await resolveRowsRelations(schema, rows);
    expect(result[0]!.kunde_id_display).toBe("Acme Corp");
  });

  test("löst mehrere Zeilen zur gleichen Zieltabelle korrekt auf", async () => {
    // Zwei Zeilen zeigen auf die gleiche Kunden-Tabelle
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "A" }), makeRow("k2", { name: "B" })]
    );
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const rows = [
      makeRow("r1", { kunde_id: "k1" }),
      makeRow("r2", { kunde_id: "k2" }),
    ];
    const result = await resolveRowsRelations(schema, rows);
    expect(result[0]!.kunde_id_display).toBe("A");
    expect(result[1]!.kunde_id_display).toBe("B");
  });

  test("überspringt Zeilen bei denen Relation nicht gefunden wird", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Bekannt" })]
    );
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const rows = [
      makeRow("r1", { kunde_id: "k1" }),
      makeRow("r2", { kunde_id: "existiert_nicht" }),
    ];
    const result = await resolveRowsRelations(schema, rows);
    expect(result[0]!.kunde_id_display).toBe("Bekannt");
    expect(result[1]).not.toHaveProperty("kunde_id_display");
  });
});

// ============================================================================
// getRelationOptions
// ============================================================================

describe("getRelationOptions", () => {
  beforeEach(resetStores);

  test("gibt leeres Array zurück wenn die Tabelle nicht existiert", async () => {
    const result = await getRelationOptions("unbekannt");
    expect(result).toEqual([]);
  });

  test("gibt leeres Array zurück wenn Tabelle keine Zeilen hat", async () => {
    registerTable("kunden", [textCol("name")], []);
    const result = await getRelationOptions("kunden");
    expect(result).toEqual([]);
  });

  test("gibt id und label für jede Zeile zurück", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [
        makeRow("k1", { name: "Firma A" }),
        makeRow("k2", { name: "Firma B" }),
      ]
    );
    const result = await getRelationOptions("kunden");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "k1", label: "Firma A" });
    expect(result[1]).toMatchObject({ id: "k2", label: "Firma B" });
  });

  test("nutzt angegebene displayColumn für das Label", async () => {
    registerTable(
      "kunden",
      [textCol("code"), textCol("firmenname")],
      [makeRow("k1", { code: "A001", firmenname: "Meier GmbH" })]
    );
    const result = await getRelationOptions("kunden", "firmenname");
    expect(result[0]!.label).toBe("Meier GmbH");
  });

  test("nutzt primary_column aus Settings wenn kein displayColumn angegeben", async () => {
    registerTable(
      "kunden",
      [textCol("code"), textCol("firmenname")],
      [makeRow("k1", { code: "A001", firmenname: "Mustermann AG" })],
      { primary_column: "firmenname" }
    );
    const result = await getRelationOptions("kunden");
    expect(result[0]!.label).toBe("Mustermann AG");
  });

  test("filtert nach searchTerm und ignoriert Gross-/Kleinschreibung", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [
        makeRow("k1", { name: "Adacor GmbH" }),
        makeRow("k2", { name: "Schmidt AG" }),
        makeRow("k3", { name: "ADACOR Holding" }),
      ]
    );
    // "adacor" trifft auf "Adacor GmbH" und "ADACOR Holding"
    const result = await getRelationOptions("kunden", "name", "adacor");
    expect(result).toHaveLength(2);
    const labels = result.map((r) => r.label);
    expect(labels).toContain("Adacor GmbH");
    expect(labels).toContain("ADACOR Holding");
  });

  test("schließt Zeilen aus die den searchTerm nicht enthalten", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [
        makeRow("k1", { name: "Adacor GmbH" }),
        makeRow("k2", { name: "Schmidt AG" }),
      ]
    );
    const result = await getRelationOptions("kunden", "name", "adacor");
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Adacor GmbH");
  });

  test("gibt alle Zeilen zurück wenn searchTerm nicht angegeben", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "A" }), makeRow("k2", { name: "B" }), makeRow("k3", { name: "C" })]
    );
    const result = await getRelationOptions("kunden");
    expect(result).toHaveLength(3);
  });

  test("begrenzt Ergebnisse auf limit (Standard 50)", async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      makeRow(`k${i}`, { name: `Kunde ${i}` })
    );
    registerTable("kunden", [textCol("name")], rows);
    const result = await getRelationOptions("kunden");
    expect(result).toHaveLength(50);
  });

  test("begrenzt Ergebnisse auf benutzerdefinierten limit-Wert", async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow(`k${i}`, { name: `Kunde ${i}` })
    );
    registerTable("kunden", [textCol("name")], rows);
    const result = await getRelationOptions("kunden", undefined, undefined, 5);
    expect(result).toHaveLength(5);
  });

  test("fällt auf _id zurück wenn kein Anzeige-Spaltenwert vorhanden", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1")]
    );
    const result = await getRelationOptions("kunden");
    expect(result[0]!.label).toBe("k1");
  });
});

// ============================================================================
// getRowReferences
// ============================================================================

describe("getRowReferences", () => {
  beforeEach(resetStores);

  test("gibt leeres Array zurück wenn keine andere Tabelle auf die Zeile zeigt", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1", { name: "Test" })]);
    const result = await getRowReferences("kunden", "k1");
    expect(result).toEqual([]);
  });

  test("gibt leeres Array zurück wenn keine Tabellen auf die Quelltabelle zeigen", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable("auftraege", [textCol("titel")], []);
    const result = await getRowReferences("kunden", "k1");
    expect(result).toEqual([]);
  });

  test("findet Referenzen einer einzelnen Zeile in einer anderen Tabelle", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { titel: "A", kunde_id: "k1" }),
        makeRow("r2", { titel: "B", kunde_id: "k1" }),
      ]
    );
    const result = await getRowReferences("kunden", "k1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      table: "auftraege",
      column: "kunde_id",
      count: 2,
    });
  });

  test("zählt nur Referenzen auf die angegebene rowId (nicht andere Zeilen)", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1"), makeRow("k2")]);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { kunde_id: "k1" }),
        makeRow("r2", { kunde_id: "k2" }),
        makeRow("r3", { kunde_id: "k1" }),
      ]
    );
    const result = await getRowReferences("kunden", "k1");
    expect(result[0]!.count).toBe(2);
  });

  test("findet Referenzen aus mehreren Tabellen", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [makeRow("r1", { kunde_id: "k1" })]
    );
    registerTable(
      "rechnungen",
      [relationCol("kunde_ref", "kunden")],
      [makeRow("re1", { kunde_ref: "k1" })]
    );
    const result = await getRowReferences("kunden", "k1");
    expect(result).toHaveLength(2);
    const tables = result.map((r) => r.table);
    expect(tables).toContain("auftraege");
    expect(tables).toContain("rechnungen");
  });

  test("enthält Tabellen mit Nullverweisen nicht im Ergebnis (count = 0)", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1"), makeRow("k2")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [makeRow("r1", { kunde_id: "k2" })]
    );
    // k1 wird von niemandem referenziert
    const result = await getRowReferences("kunden", "k1");
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// hasIncomingReferences
// ============================================================================

describe("hasIncomingReferences", () => {
  beforeEach(resetStores);

  test("gibt false zurück wenn keine Tabelle auf die Zieltabelle zeigt", async () => {
    registerTable("kunden", [textCol("name")]);
    const result = await hasIncomingReferences("kunden");
    expect(result).toBe(false);
  });

  test("gibt true zurück wenn mindestens eine Tabelle auf die Zieltabelle zeigt", async () => {
    registerTable("kunden", [textCol("name")]);
    registerTable("auftraege", [relationCol("kunde_id", "kunden")]);
    const result = await hasIncomingReferences("kunden");
    expect(result).toBe(true);
  });

  test("gibt false zurück wenn keine Tabellen existieren", async () => {
    const result = await hasIncomingReferences("irgendwas");
    expect(result).toBe(false);
  });
});

// ============================================================================
// validateRelationIntegrity
// ============================================================================

describe("validateRelationIntegrity", () => {
  beforeEach(resetStores);

  test("gibt leeres Array zurück wenn keine Relationsspalten vorhanden sind", async () => {
    const schema = makeSchema("auftraege", [textCol("titel")]);
    const row = makeRow("r1", { titel: "Test" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toEqual([]);
  });

  test("gibt leeres Array zurück wenn Relationswert fehlt (kein Wert)", async () => {
    registerTable("kunden", [textCol("name")], []);
    const schema = makeSchema("auftraege", [
      textCol("titel"),
      relationCol("kunde_id", "kunden"),
    ]);
    // Zeile hat keinen Wert für kunde_id
    const row = makeRow("r1", { titel: "Test" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toEqual([]);
  });

  test("gibt kein Problem zurück wenn referenzierte Zeile existiert", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Huber" })]
    );
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("r1", { kunde_id: "k1" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toHaveLength(0);
  });

  test("meldet fehlende Zieltabellen-Zeile als Integritätsproblem", async () => {
    registerTable("kunden", [textCol("name")], []);
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
    ]);
    const row = makeRow("r1", { kunde_id: "existiert_nicht" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      column: "kunde_id",
      targetTable: "kunden",
      missingId: "existiert_nicht",
    });
  });

  test("meldet mehrere Integritätsprobleme bei mehreren defekten Relationen", async () => {
    registerTable("kunden", [textCol("name")], []);
    registerTable("projekte", [textCol("titel")], []);
    const schema = makeSchema("auftraege", [
      relationCol("kunde_id", "kunden"),
      relationCol("projekt_id", "projekte"),
    ]);
    const row = makeRow("r1", { kunde_id: "k_fehlt", projekt_id: "p_fehlt" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toHaveLength(2);
  });

  test("überspringt Relationsspalten ohne relation_table", async () => {
    const schema = makeSchema("auftraege", [
      { id: "ref", name: "Ref", type: "relation" },
    ]);
    const row = makeRow("r1", { ref: "irgendwas" });
    const result = await validateRelationIntegrity(schema, row);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// fixBrokenRelations
// ============================================================================

describe("fixBrokenRelations", () => {
  beforeEach(resetStores);

  test("gibt Fehler zurück wenn Tabelle nicht existiert", async () => {
    const result = await fixBrokenRelations("unbekannt");
    expect(result.fixed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("unbekannt");
  });

  test("gibt fixed=0 zurück wenn keine Zeilen defekte Relationen haben", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Huber" })]
    );
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [makeRow("r1", { titel: "A", kunde_id: "k1" })]
    );
    const result = await fixBrokenRelations("auftraege");
    expect(result.fixed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test("setzt defekte Relation auf null und zählt fixed=1", async () => {
    registerTable("kunden", [textCol("name")], []);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [makeRow("r1", { titel: "A", kunde_id: "existiert_nicht" })]
    );
    const result = await fixBrokenRelations("auftraege");
    expect(result.fixed).toBe(1);
    expect(result.errors).toHaveLength(0);
    // Prüfe dass der Wert auf null gesetzt wurde
    const row = tableData["auftraege"]!.rows[0]!;
    expect(row.kunde_id).toBeNull();
  });

  test("repariert mehrere defekte Relationen in einer Tabelle", async () => {
    registerTable("kunden", [textCol("name")], []);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { titel: "A", kunde_id: "k_fehlt_1" }),
        makeRow("r2", { titel: "B", kunde_id: "k_fehlt_2" }),
      ]
    );
    const result = await fixBrokenRelations("auftraege");
    expect(result.fixed).toBe(2);
  });

  test("gibt fixed=0 zurück bei leerer Tabelle", async () => {
    registerTable("auftraege", [relationCol("kunde_id", "kunden")], []);
    registerTable("kunden", [textCol("name")], []);
    const result = await fixBrokenRelations("auftraege");
    expect(result.fixed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// deleteRowWithCascade
// ============================================================================

describe("deleteRowWithCascade", () => {
  beforeEach(resetStores);

  test("löscht die Zeile wenn keine Referenzen vorhanden sind", async () => {
    registerTable(
      "kunden",
      [textCol("name")],
      [makeRow("k1", { name: "Huber" })]
    );
    const result = await deleteRowWithCascade("kunden", "k1");
    expect(result.deleted).toBe(1);
    expect(result.nullified).toBe(0);
    expect(tableData["kunden"]!.rows).toHaveLength(0);
  });

  test("wirft Fehler wenn Referenzen existieren und keine Option angegeben ist", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [makeRow("r1", { kunde_id: "k1" })]
    );
    await expect(
      deleteRowWithCascade("kunden", "k1")
    ).rejects.toThrow();
  });

  test("wirft Fehler mit Hinweis auf cascade/nullifyReferences", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [makeRow("r1", { kunde_id: "k1" })]
    );
    await expect(
      deleteRowWithCascade("kunden", "k1")
    ).rejects.toThrow(/cascade|nullifyReferences/);
  });

  test("löscht referenzierende Zeilen bei cascade=true", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { kunde_id: "k1" }),
        makeRow("r2", { kunde_id: "k1" }),
      ]
    );
    const result = await deleteRowWithCascade("kunden", "k1", { cascade: true });
    // 2 referenzierende + 1 die Zeile selbst
    expect(result.deleted).toBe(3);
    expect(result.nullified).toBe(0);
    expect(tableData["auftraege"]!.rows).toHaveLength(0);
    expect(tableData["kunden"]!.rows).toHaveLength(0);
  });

  test("setzt Referenzen auf null bei nullifyReferences=true", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { titel: "A", kunde_id: "k1" }),
        makeRow("r2", { titel: "B", kunde_id: "k1" }),
      ]
    );
    const result = await deleteRowWithCascade("kunden", "k1", {
      nullifyReferences: true,
    });
    expect(result.nullified).toBe(2);
    expect(result.deleted).toBe(1); // nur die Zeile selbst
    // Referenzierte Felder müssen null sein
    expect(tableData["auftraege"]!.rows[0]!.kunde_id).toBeNull();
    expect(tableData["auftraege"]!.rows[1]!.kunde_id).toBeNull();
    // Kunden-Tabelle ist leer
    expect(tableData["kunden"]!.rows).toHaveLength(0);
  });

  test("löscht nur referenzierende Zeilen bei cascade, nicht andere Zeilen", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1"), makeRow("k2")]);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { titel: "A", kunde_id: "k1" }),
        makeRow("r2", { titel: "B", kunde_id: "k2" }),
      ]
    );
    await deleteRowWithCascade("kunden", "k1", { cascade: true });
    // r2 zeigt auf k2 — sollte bestehen bleiben
    expect(tableData["auftraege"]!.rows).toHaveLength(1);
    expect(tableData["auftraege"]!.rows[0]!._id).toBe("r2");
  });

  test("nullifiziert nur Referenzen auf die gelöschte Zeile bei nullifyReferences", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1"), makeRow("k2")]);
    registerTable(
      "auftraege",
      [textCol("titel"), relationCol("kunde_id", "kunden")],
      [
        makeRow("r1", { titel: "A", kunde_id: "k1" }),
        makeRow("r2", { titel: "B", kunde_id: "k2" }),
      ]
    );
    await deleteRowWithCascade("kunden", "k1", { nullifyReferences: true });
    expect(tableData["auftraege"]!.rows[0]!.kunde_id).toBeNull();
    expect(tableData["auftraege"]!.rows[1]!.kunde_id).toBe("k2");
  });

  test("cascade mit Referenzen aus mehreren Tabellen löscht alle Referenzzeilen", async () => {
    registerTable("kunden", [textCol("name")], [makeRow("k1")]);
    registerTable(
      "auftraege",
      [relationCol("kunde_id", "kunden")],
      [makeRow("r1", { kunde_id: "k1" })]
    );
    registerTable(
      "rechnungen",
      [relationCol("kunde_ref", "kunden")],
      [makeRow("re1", { kunde_ref: "k1" })]
    );
    const result = await deleteRowWithCascade("kunden", "k1", { cascade: true });
    // 1 aus auftraege + 1 aus rechnungen + 1 Zeile selbst
    expect(result.deleted).toBe(3);
    expect(tableData["auftraege"]!.rows).toHaveLength(0);
    expect(tableData["rechnungen"]!.rows).toHaveLength(0);
    expect(tableData["kunden"]!.rows).toHaveLength(0);
  });
});
