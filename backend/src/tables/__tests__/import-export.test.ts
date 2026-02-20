/**
 * Tests für tables/import-export.ts
 *
 * Testet CSV-Hilffunktionen (parseCSV, toCSVValue, toCSV) sowie
 * exportTable, importData, replaceTableData und previewImport mit gemockten
 * Abhängigkeiten.
 */

import { test, expect, describe, mock } from "bun:test";

// ============================================
// Mocks müssen VOR dem Import des Moduls stehen
// ============================================

const mockStorage = {
  loadSchema: mock(async (_tableId: string) => null as any),
  loadData: mock(async (_tableId: string) => null as any),
  getRow: mock(async (_tableId: string, _rowId: string) => null as any),
  addRow: mock(async (_tableId: string, _rowData: Record<string, any>) => ({ _id: "row_new" }) as any),
  updateRow: mock(async (_tableId: string, _rowId: string, _data: Record<string, any>) => ({}) as any),
  replaceAllRows: mock(async (_tableId: string, _rows: any[]) => {}),
  exportTable: mock(async (_tableId: string) => null as any),
  importTable: mock(async (_payload: any, _overwrite: boolean) => ({}) as any),
  generateRowId: mock(() => "row_generated"),
};

const mockService = {
  normalizeRowData: mock((_schema: any, row: Record<string, any>) => ({ ...row })),
  validateRow: mock((_schema: any, _row: Record<string, any>) => ({ valid: true, errors: [] }) as any),
};

mock.module("../storage", () => mockStorage);
mock.module("../service", () => mockService);

const {
  exportTable,
  importData,
  replaceTableData,
  exportTableBackup,
  importTableBackup,
  previewImport,
} = await import("../import-export");

// ============================================
// Hilfsfunktionen für Tests
// ============================================

function makeSchema(overrides: Partial<any> = {}): any {
  return {
    id: "test_tabelle",
    name: "Testtabelle",
    description: "Eine Tabelle für Tests",
    columns: [
      { id: "name", name: "Name", type: "text", required: true },
      { id: "alter", name: "Alter", type: "number" },
      { id: "aktiv", name: "Aktiv", type: "boolean" },
    ],
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeData(rows: any[] = []): any {
  return {
    updated_at: "2024-01-01T00:00:00.000Z",
    row_count: rows.length,
    rows,
  };
}

function makeRow(id: string, data: Record<string, any> = {}): any {
  return { _id: id, ...data };
}

function resetMocks() {
  mockStorage.loadSchema.mockReset();
  mockStorage.loadData.mockReset();
  mockStorage.getRow.mockReset();
  mockStorage.addRow.mockReset();
  mockStorage.updateRow.mockReset();
  mockStorage.replaceAllRows.mockReset();
  mockStorage.exportTable.mockReset();
  mockStorage.importTable.mockReset();
  mockStorage.generateRowId.mockReset();
  mockService.normalizeRowData.mockReset();
  mockService.validateRow.mockReset();

  // Standardverhalten wiederherstellen
  mockStorage.addRow.mockImplementation(async () => ({ _id: "row_new" }));
  mockStorage.updateRow.mockImplementation(async () => ({}));
  mockStorage.replaceAllRows.mockImplementation(async () => {});
  mockStorage.generateRowId.mockImplementation(() => "row_generated");
  mockService.normalizeRowData.mockImplementation((_schema: any, row: Record<string, any>) => ({ ...row }));
  mockService.validateRow.mockImplementation(() => ({ valid: true, errors: [] }));
}

// ============================================
// Direkt-Zugriff auf interne Helferfunktionen
// via Re-Export durch einen Umweg: wir testen
// das Verhalten über die öffentlichen Funktionen.
// Die reinen Hilfsfunktionen sind nicht exportiert,
// daher testen wir sie indirekt über exportTable/importData.
// ============================================

// ============================================
// parseCSV – indirekt über importData (CSV-Format)
// ============================================

describe("parseCSV (via importData, CSV-Format)", () => {
  describe("Grundlegendes Parsen", () => {
    test("parst einfaches CSV mit Header und einer Datenzeile korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\nMax,30";
      await importData("test_tabelle", csvContent, { format: "csv" });

      expect(mockService.normalizeRowData).toHaveBeenCalledTimes(1);
      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max");
      expect(calledRow.alter).toBe("30");
    });

    test("parst CSV mit mehreren Datenzeilen korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\nMax,30\nAnna,25\nKlaus,45";
      await importData("test_tabelle", csvContent, { format: "csv" });

      expect(mockService.normalizeRowData).toHaveBeenCalledTimes(3);
    });

    test("gibt leeres Ergebnis zurück wenn CSV nur Header enthält", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter";
      const result = await importData("test_tabelle", csvContent, { format: "csv" });

      expect(result.imported).toBe(0);
      expect(mockService.normalizeRowData).not.toHaveBeenCalled();
    });

    test("gibt leeres Ergebnis zurück bei komplett leerem CSV-String", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const result = await importData("test_tabelle", "", { format: "csv" });

      expect(result.imported).toBe(0);
    });

    test("ignoriert Leerzeilen im CSV", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\n\nMax,30\n\nAnna,25\n";
      await importData("test_tabelle", csvContent, { format: "csv" });

      // Nur Zeilen mit Inhalt werden importiert
      expect(mockService.normalizeRowData).toHaveBeenCalledTimes(2);
    });
  });

  describe("Anführungszeichen-Behandlung", () => {
    test("parst Werte in Anführungszeichen korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = 'name,alter\n"Max Mustermann",30';
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max Mustermann");
    });

    test("parst Kommas innerhalb von Anführungszeichen korrekt (kein Spaltentrennzeichen)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = 'name,alter\n"Mustermann, Max",30';
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Mustermann, Max");
    });

    test("parst doppelte Anführungszeichen als Escape-Sequenz (\"\")", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = 'name,alter\n"Er sagte ""Hallo""",30';
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe('Er sagte "Hallo"');
    });

    test("parst Werte ohne Anführungszeichen normal", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\nKlaus,55";
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Klaus");
      expect(calledRow.alter).toBe("55");
    });
  });

  describe("Leere Zellen", () => {
    test("parst leere Zellen als leere Zeichenkette", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\nMax,";
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.alter).toBe("");
    });

    test("parst führende leere Zelle korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,alter\n,30";
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("");
      expect(calledRow.alter).toBe("30");
    });

    test("parst mehrere aufeinander folgende leere Zellen korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [
          { id: "a", name: "A", type: "text" },
          { id: "b", name: "B", type: "text" },
          { id: "c", name: "C", type: "text" },
        ],
      }));

      const csvContent = "a,b,c\n,,wert";
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.a).toBe("");
      expect(calledRow.b).toBe("");
      expect(calledRow.c).toBe("wert");
    });
  });

  describe("JSON-Werte in CSV", () => {
    test("parst JSON-Array in CSV-Zelle automatisch zu Array (korrekt gequotetes CSV)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [{ id: "tags", name: "Tags", type: "tags" }],
      }));

      // Korrekt gequotetes CSV: Wert in "" einschließen, innere " als "" escapen
      const csvContent = 'tags\n"[""tag1"",""tag2"",""tag3""]"';
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    test("parst JSON-Objekt in CSV-Zelle automatisch zu Objekt (korrekt gequotetes CSV)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [{ id: "meta", name: "Meta", type: "text" }],
      }));

      // Korrekt gequotetes CSV: {"key":"value"} -> "{""key"":""value""}"
      const csvContent = 'meta\n"{""key"":""value""}"';
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.meta).toEqual({ key: "value" });
    });

    test("behandelt ungültigen JSON-String als gewöhnlichen String", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [{ id: "wert", name: "Wert", type: "text" }],
      }));

      const csvContent = "wert\n[kein_gueltiges_json";
      await importData("test_tabelle", csvContent, { format: "csv" });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(typeof calledRow.wert).toBe("string");
    });
  });

  describe("Spalten-Mapping", () => {
    test("wendet column_mapping auf Header-Namen an", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "Vorname,Jahrgang\nMax,1994";
      await importData("test_tabelle", csvContent, {
        format: "csv",
        column_mapping: { Vorname: "name", Jahrgang: "alter" },
      });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max");
      expect(calledRow.alter).toBe("1994");
    });

    test("lässt nicht gemappte Spalten unter ihrem Original-Namen", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvContent = "name,extern_id\nMax,42";
      await importData("test_tabelle", csvContent, {
        format: "csv",
        column_mapping: { name: "name" },
      });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max");
      expect(calledRow.extern_id).toBe("42");
    });
  });
});

// ============================================
// toCSVValue – indirekt über exportTable
// ============================================

describe("toCSVValue (via exportTable, CSV-Format)", () => {
  describe("Null und Undefined", () => {
    test("gibt leeren String für null zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: null, alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      const lines = csv.split("\n");
      const dataLine = lines[1]!;
      // CSV-Header ist _id,name,alter,aktiv — null name ergibt leere zweite Zelle: "r1,,30,true"
      expect(dataLine.split(",")[1]).toBe("");
    });

    test("gibt leeren String für undefined zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      const lines = csv.split("\n");
      const dataLine = lines[1]!;
      // name ist undefined, sollte leere Zelle ergeben
      expect(dataLine).toContain(",");
    });
  });

  describe("Arrays", () => {
    test("serialisiert Arrays als JSON-String", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [{ id: "tags", name: "Tags", type: "tags" }],
      }));
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { tags: ["a", "b", "c"] })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain('["a","b","c"]');
    });
  });

  describe("Sonderzeichen-Escaping", () => {
    test("umschließt Werte mit Komma in Anführungszeichen", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Mustermann, Max", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain('"Mustermann, Max"');
    });

    test("umschließt Werte mit Anführungszeichen und escaped diese", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: 'Er sagte "Hallo"', alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain('"Er sagte ""Hallo"""');
    });

    test("umschließt Werte mit Zeilenumbruch in Anführungszeichen", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Zeile1\nZeile2", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain('"Zeile1\nZeile2"');
    });

    test("gibt einfache Werte ohne Anführungszeichen zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "MaxMustermann", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain("MaxMustermann");
      expect(csv).not.toContain('"MaxMustermann"');
    });

    test("gibt Zahlen ohne Anführungszeichen zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 42, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain(",42,");
    });

    test("gibt Booleans ohne Anführungszeichen zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(csv).toContain(",true");
    });
  });
});

// ============================================
// toCSV – indirekt über exportTable
// ============================================

describe("toCSV (via exportTable, CSV-Format)", () => {
  test("erste Zeile ist die Header-Zeile mit korrekten Spaltennamen", async () => {
    resetMocks();
    mockStorage.loadSchema.mockImplementation(async () => makeSchema());
    mockStorage.loadData.mockImplementation(async () => makeData([]));

    const csv = await exportTable("test_tabelle", { format: "csv" });
    const firstLine = csv.split("\n")[0]!;
    expect(firstLine).toBe("_id,name,alter,aktiv");
  });

  test("enthält alle Datenzeilen nach dem Header", async () => {
    resetMocks();
    mockStorage.loadSchema.mockImplementation(async () => makeSchema());
    mockStorage.loadData.mockImplementation(async () =>
      makeData([
        makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
        makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
      ])
    );

    const csv = await exportTable("test_tabelle", { format: "csv" });
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // Header + 2 Datenzeilen
  });

  test("enthält _id als erste Spalte in jeder Zeile", async () => {
    resetMocks();
    mockStorage.loadSchema.mockImplementation(async () => makeSchema());
    mockStorage.loadData.mockImplementation(async () =>
      makeData([makeRow("zeile_001", { name: "Max", alter: 30, aktiv: true })])
    );

    const csv = await exportTable("test_tabelle", { format: "csv" });
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine).toMatch(/^zeile_001,/);
  });

  test("gibt CSV mit nur Header zurück bei leerer Tabelle", async () => {
    resetMocks();
    mockStorage.loadSchema.mockImplementation(async () => makeSchema());
    mockStorage.loadData.mockImplementation(async () => makeData([]));

    const csv = await exportTable("test_tabelle", { format: "csv" });
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("_id,name,alter,aktiv");
  });

  test("trennt Spalten korrekt mit Komma", async () => {
    resetMocks();
    mockStorage.loadSchema.mockImplementation(async () => makeSchema());
    mockStorage.loadData.mockImplementation(async () =>
      makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
    );

    const csv = await exportTable("test_tabelle", { format: "csv" });
    const dataLine = csv.split("\n")[1]!;
    const cells = dataLine.split(",");
    expect(cells[0]).toBe("r1");
    expect(cells[1]).toBe("Max");
    expect(cells[2]).toBe("30");
    expect(cells[3]).toBe("true");
  });
});

// ============================================
// exportTable
// ============================================

describe("exportTable", () => {
  describe("Fehlerbehandlung", () => {
    test("wirft Fehler wenn Tabelle nicht existiert (schema null)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => null);

      await expect(
        exportTable("nicht_vorhanden", { format: "csv" })
      ).rejects.toThrow('Table "nicht_vorhanden" not found');
    });

    test("wirft Fehler wenn Daten nicht existieren (data null)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () => null);

      await expect(
        exportTable("test_tabelle", { format: "csv" })
      ).rejects.toThrow('Table "test_tabelle" not found');
    });

    test("wirft Fehler bei unbekanntem Exportformat", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () => makeData([]));

      await expect(
        exportTable("test_tabelle", { format: "xml" as any })
      ).rejects.toThrow("Unsupported export format: xml");
    });
  });

  describe("CSV-Export", () => {
    test("exportiert alle Spalten wenn keine columns-Einschränkung angegeben", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      const header = csv.split("\n")[0]!;
      expect(header).toContain("name");
      expect(header).toContain("alter");
      expect(header).toContain("aktiv");
    });

    test("exportiert nur angegebene Spalten wenn columns-Option gesetzt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", {
        format: "csv",
        columns: ["name"],
      });
      const header = csv.split("\n")[0]!;
      expect(header).toContain("name");
      expect(header).not.toContain("alter");
      expect(header).not.toContain("aktiv");
    });

    test("liefert gültigen CSV-String zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const csv = await exportTable("test_tabelle", { format: "csv" });
      expect(typeof csv).toBe("string");
      expect(csv.length).toBeGreaterThan(0);
    });
  });

  describe("JSON-Export", () => {
    test("liefert gültigen JSON-String zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const json = await exportTable("test_tabelle", { format: "json" });
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test("enthält alle Zeilen im JSON-Array", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", { format: "json" });
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    test("include_schema schließt Schema-Information ins JSON ein", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () => makeData([]));

      const json = await exportTable("test_tabelle", {
        format: "json",
        include_schema: true,
      });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty("schema");
      expect(parsed).toHaveProperty("rows");
      expect(parsed.schema.id).toBe("test_tabelle");
    });

    test("ohne include_schema enthält JSON nur Array von Zeilen", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const json = await exportTable("test_tabelle", { format: "json" });
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test("JSON enthält _id jeder Zeile", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("zeile_abc", { name: "Max", alter: 30, aktiv: true })])
      );

      const json = await exportTable("test_tabelle", { format: "json" });
      const parsed = JSON.parse(json);
      expect(parsed[0]._id).toBe("zeile_abc");
    });
  });

  describe("YAML-Export", () => {
    test("liefert gültigen YAML-String zurück", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([makeRow("r1", { name: "Max", alter: 30, aktiv: true })])
      );

      const yamlStr = await exportTable("test_tabelle", { format: "yaml" });
      expect(typeof yamlStr).toBe("string");
      const parsed = yamlModule.parse(yamlStr);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test("include_schema schließt Schema-Information ins YAML ein", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () => makeData([]));

      const yamlStr = await exportTable("test_tabelle", {
        format: "yaml",
        include_schema: true,
      });
      const parsed = yamlModule.parse(yamlStr);
      expect(parsed).toHaveProperty("schema");
      expect(parsed).toHaveProperty("rows");
    });
  });

  describe("Filter-Option", () => {
    test("filtert Zeilen mit eq-Operator korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
          makeRow("r3", { name: "Klaus", alter: 30, aktiv: true }),
        ])
      );

      const json = await exportTable("test_tabelle", {
        format: "json",
        filter: [{ column: "alter", operator: "eq", value: 30 }],
      });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed.every((r: any) => r.alter === 30)).toBe(true);
    });

    test("filtert Zeilen mit neq-Operator korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", {
        format: "json",
        filter: [{ column: "alter", operator: "neq", value: 30 }],
      });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Anna");
    });

    test("filtert Zeilen mit contains-Operator korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max Mustermann", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna Schmidt", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", {
        format: "json",
        filter: [{ column: "name", operator: "contains", value: "Mustermann" }],
      });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Max Mustermann");
    });

    test("gibt alle Zeilen zurück wenn kein Filter angegeben", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", { format: "json" });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
    });

    test("gibt alle Zeilen zurück wenn Filter leer ist", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", {
        format: "json",
        filter: [],
      });
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
    });

    test("unbekannter Filter-Operator gibt alle Zeilen zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.loadData.mockImplementation(async () =>
        makeData([
          makeRow("r1", { name: "Max", alter: 30, aktiv: true }),
          makeRow("r2", { name: "Anna", alter: 25, aktiv: false }),
        ])
      );

      const json = await exportTable("test_tabelle", {
        format: "json",
        filter: [{ column: "alter", operator: "gt" as any, value: 20 }],
      });
      const parsed = JSON.parse(json);
      // "gt" ist kein implementierter Operator, Default gibt true zurück
      expect(parsed).toHaveLength(2);
    });
  });
});

// ============================================
// importData
// ============================================

describe("importData", () => {
  describe("Fehlerbehandlung", () => {
    test("wirft Fehler wenn Tabelle nicht existiert", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => null);

      await expect(
        importData("nicht_vorhanden", "name\nMax", { format: "csv" })
      ).rejects.toThrow('Table "nicht_vorhanden" not found');
    });

    test("wirft Fehler bei unbekanntem Importformat", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      await expect(
        importData("test_tabelle", "daten", { format: "xml" as any })
      ).rejects.toThrow("Unsupported import format: xml");
    });

    test("wirft Fehler bei ungültigem JSON", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      await expect(
        importData("test_tabelle", "{ kein gültiges json", { format: "json" })
      ).rejects.toThrow();
    });
  });

  describe("CSV-Import", () => {
    test("importiert Zeilen und gibt korrektes ImportResult zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.addRow.mockImplementation(async () => ({ _id: "row_new" }));

      const csv = "name,alter\nMax,30\nAnna,25";
      const result = await importData("test_tabelle", csv, { format: "csv" });

      expect(result.imported).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test("ruft addRow für jede neue Zeile auf", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter\nMax,30\nAnna,25\nKlaus,45";
      await importData("test_tabelle", csv, { format: "csv" });

      expect(mockStorage.addRow).toHaveBeenCalledTimes(3);
    });
  });

  describe("JSON-Import", () => {
    test("importiert JSON-Array korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify([
        { name: "Max", alter: 30 },
        { name: "Anna", alter: 25 },
      ]);
      const result = await importData("test_tabelle", json, { format: "json" });

      expect(result.imported).toBe(2);
    });

    test("importiert JSON-Objekt mit rows-Eigenschaft korrekt", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify({
        schema: { id: "test" },
        rows: [
          { name: "Max", alter: 30 },
          { name: "Anna", alter: 25 },
        ],
      });
      const result = await importData("test_tabelle", json, { format: "json" });

      expect(result.imported).toBe(2);
    });

    test("gibt 0 importierte Zeilen zurück für leeres JSON-Array", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const result = await importData("test_tabelle", "[]", { format: "json" });
      expect(result.imported).toBe(0);
    });

    test("wendet JSON column_mapping an", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify([{ Vorname: "Max", Jahrgang: 1994 }]);
      await importData("test_tabelle", json, {
        format: "json",
        column_mapping: { Vorname: "name", Jahrgang: "alter" },
      });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max");
      expect(calledRow.alter).toBe(1994);
    });
  });

  describe("YAML-Import", () => {
    test("importiert YAML-Array korrekt", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const yamlContent = yamlModule.stringify([
        { name: "Max", alter: 30 },
        { name: "Anna", alter: 25 },
      ]);
      const result = await importData("test_tabelle", yamlContent, { format: "yaml" });

      expect(result.imported).toBe(2);
    });

    test("importiert YAML-Objekt mit rows-Eigenschaft korrekt", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const yamlContent = yamlModule.stringify({
        rows: [{ name: "Max", alter: 30 }],
      });
      const result = await importData("test_tabelle", yamlContent, { format: "yaml" });

      expect(result.imported).toBe(1);
    });

    test("wendet YAML column_mapping an", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const yamlContent = yamlModule.stringify([{ Vorname: "Max" }]);
      await importData("test_tabelle", yamlContent, {
        format: "yaml",
        column_mapping: { Vorname: "name" },
      });

      const calledRow = mockService.normalizeRowData.mock.calls[0]![1];
      expect(calledRow.name).toBe("Max");
    });
  });

  describe("update_existing-Option", () => {
    test("aktualisiert vorhandene Zeile wenn _id existiert und update_existing=true", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.getRow.mockImplementation(async () => makeRow("r1", { name: "Alt" }));

      const json = JSON.stringify([{ _id: "r1", name: "Neu", alter: 30 }]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        update_existing: true,
      });

      expect(mockStorage.updateRow).toHaveBeenCalledWith("test_tabelle", "r1", expect.any(Object));
      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);
    });

    test("erstellt neue Zeile wenn _id nicht gefunden wird, aber update_existing=true", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.getRow.mockImplementation(async () => null);

      const json = JSON.stringify([{ _id: "r999", name: "Neu", alter: 30 }]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        update_existing: true,
      });

      expect(mockStorage.addRow).toHaveBeenCalledTimes(1);
      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
    });

    test("erstellt immer neue Zeilen wenn update_existing=false", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify([{ _id: "r1", name: "Max", alter: 30 }]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        update_existing: false,
      });

      expect(mockStorage.updateRow).not.toHaveBeenCalled();
      expect(result.imported).toBe(1);
    });
  });

  describe("skip_invalid-Option", () => {
    test("überspringt ungültige Zeilen wenn skip_invalid=true", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockService.validateRow
        .mockImplementationOnce(() => ({ valid: false, errors: [{ column: "name", message: "Name ist erforderlich" }] }))
        .mockImplementation(() => ({ valid: true, errors: [] }));

      const json = JSON.stringify([
        { name: "", alter: 30 },
        { name: "Anna", alter: 25 },
      ]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        skip_invalid: true,
      });

      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.row).toBe(1);
    });

    test("wirft Fehler bei ungültiger Zeile wenn skip_invalid=false", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockService.validateRow.mockImplementation(() => ({
        valid: false,
        errors: [{ column: "name", message: "Name ist erforderlich" }],
      }));

      const json = JSON.stringify([{ name: "", alter: 30 }]);

      await expect(
        importData("test_tabelle", json, {
          format: "json",
          skip_invalid: false,
        })
      ).rejects.toThrow("Name ist erforderlich");
    });

    test("Fehlermeldung enthält Zeilennummer", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockService.validateRow
        .mockImplementationOnce(() => ({ valid: true, errors: [] }))
        .mockImplementationOnce(() => ({
          valid: false,
          errors: [{ column: "name", message: "Pflichtfeld leer" }],
        }));

      const json = JSON.stringify([
        { name: "Max", alter: 30 },
        { name: "", alter: 25 },
      ]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        skip_invalid: true,
      });

      expect(result.errors[0]!.row).toBe(2);
    });

    test("Fehler-Objekt enthält die fehlerhaften Rohdaten", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockService.validateRow.mockImplementation(() => ({
        valid: false,
        errors: [{ column: "name", message: "Pflichtfeld leer" }],
      }));

      const fehlerhafteZeile = { name: "", alter: 30 };
      const json = JSON.stringify([fehlerhafteZeile]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        skip_invalid: true,
      });

      expect(result.errors[0]!.data).toEqual(fehlerhafteZeile);
    });

    test("behandelt Ausnahmen beim Hinzufügen einer Zeile wie Validierungsfehler", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.addRow.mockImplementation(async () => {
        throw new Error("Speicherfehler");
      });

      const json = JSON.stringify([{ name: "Max", alter: 30 }]);
      const result = await importData("test_tabelle", json, {
        format: "json",
        skip_invalid: true,
      });

      expect(result.skipped).toBe(1);
      expect(result.errors[0]!.message).toContain("Speicherfehler");
    });
  });
});

// ============================================
// replaceTableData
// ============================================

describe("replaceTableData", () => {
  describe("Fehlerbehandlung", () => {
    test("wirft Fehler wenn Tabelle nicht existiert", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => null);

      await expect(
        replaceTableData("nicht_vorhanden", "[]", "json")
      ).rejects.toThrow('Table "nicht_vorhanden" not found');
    });

    test("wirft Fehler bei unbekanntem Format", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      await expect(
        replaceTableData("test_tabelle", "daten", "xml" as any)
      ).rejects.toThrow("Unsupported format: xml");
    });
  });

  describe("Erfolgsfälle", () => {
    test("ersetzt alle Tabellenzeilen durch neue Daten (JSON)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.generateRowId.mockImplementation(() => "id_gen");

      const json = JSON.stringify([
        { name: "Max", alter: 30 },
        { name: "Anna", alter: 25 },
      ]);
      const result = await replaceTableData("test_tabelle", json, "json");

      expect(mockStorage.replaceAllRows).toHaveBeenCalledWith(
        "test_tabelle",
        expect.any(Array)
      );
      expect(result.count).toBe(2);
    });

    test("ersetzt alle Tabellenzeilen durch neue Daten (CSV)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter\nMax,30\nAnna,25";
      const result = await replaceTableData("test_tabelle", csv, "csv");

      expect(result.count).toBe(2);
      expect(mockStorage.replaceAllRows).toHaveBeenCalledTimes(1);
    });

    test("ersetzt alle Tabellenzeilen durch neue Daten (YAML)", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const yamlContent = yamlModule.stringify([
        { name: "Max", alter: 30 },
        { name: "Anna", alter: 25 },
      ]);
      const result = await replaceTableData("test_tabelle", yamlContent, "yaml");

      expect(result.count).toBe(2);
    });

    test("behält _id aus den Daten wenn vorhanden", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify([{ _id: "bekannte_id", name: "Max", alter: 30 }]);
      await replaceTableData("test_tabelle", json, "json");

      const calledRows = mockStorage.replaceAllRows.mock.calls[0]![1];
      expect(calledRows[0]._id).toBe("bekannte_id");
    });

    test("generiert neue _id wenn keine vorhanden", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());
      mockStorage.generateRowId.mockImplementation(() => "gen_id_123");

      const json = JSON.stringify([{ name: "Max", alter: 30 }]);
      await replaceTableData("test_tabelle", json, "json");

      const calledRows = mockStorage.replaceAllRows.mock.calls[0]![1];
      expect(calledRows[0]._id).toBe("gen_id_123");
    });

    test("gibt count 0 zurück bei leeren Daten", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const result = await replaceTableData("test_tabelle", "[]", "json");
      expect(result.count).toBe(0);
    });
  });
});

// ============================================
// exportTableBackup
// ============================================

describe("exportTableBackup", () => {
  test("wirft Fehler wenn Tabelle nicht existiert", async () => {
    resetMocks();
    mockStorage.exportTable.mockImplementation(async () => null);

    await expect(exportTableBackup("nicht_vorhanden")).rejects.toThrow(
      'Table "nicht_vorhanden" not found'
    );
  });

  test("gibt validen YAML-String zurück", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    mockStorage.exportTable.mockImplementation(async () => ({
      schema: makeSchema(),
      data: makeData([makeRow("r1", { name: "Max", alter: 30 })]),
    }));

    const yaml = await exportTableBackup("test_tabelle");
    expect(typeof yaml).toBe("string");
    const parsed = yamlModule.parse(yaml);
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("exported_at");
    expect(parsed).toHaveProperty("table");
    expect(parsed).toHaveProperty("data");
  });

  test("enthält Versionsfeld '1.0'", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    mockStorage.exportTable.mockImplementation(async () => ({
      schema: makeSchema(),
      data: makeData([]),
    }));

    const yaml = await exportTableBackup("test_tabelle");
    const parsed = yamlModule.parse(yaml);
    expect(parsed.version).toBe("1.0");
  });

  test("enthält ISO-Zeitstempel im exported_at-Feld", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    mockStorage.exportTable.mockImplementation(async () => ({
      schema: makeSchema(),
      data: makeData([]),
    }));

    const yaml = await exportTableBackup("test_tabelle");
    const parsed = yamlModule.parse(yaml);
    expect(parsed.exported_at).toBeTruthy();
  });
});

// ============================================
// importTableBackup
// ============================================

describe("importTableBackup", () => {
  test("wirft Fehler bei fehlendem table-Feld im Backup", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    const invalidBackup = yamlModule.stringify({ version: "1.0", data: [] });

    await expect(importTableBackup(invalidBackup)).rejects.toThrow(
      "Invalid backup format: missing table or data"
    );
  });

  test("wirft Fehler bei fehlendem data-Feld im Backup", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    const invalidBackup = yamlModule.stringify({ version: "1.0", table: makeSchema() });

    await expect(importTableBackup(invalidBackup)).rejects.toThrow(
      "Invalid backup format: missing table or data"
    );
  });

  test("ruft storage.importTable mit korrekten Daten auf", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    const schema = makeSchema();
    mockStorage.importTable.mockImplementation(async () => schema);

    const backup = yamlModule.stringify({
      version: "1.0",
      exported_at: new Date().toISOString(),
      table: schema,
      data: makeData([]),
    });

    await importTableBackup(backup);

    expect(mockStorage.importTable).toHaveBeenCalledWith(
      { schema, data: expect.any(Object) },
      false
    );
  });

  test("übergibt overwrite=true an storage.importTable", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    const schema = makeSchema();
    mockStorage.importTable.mockImplementation(async () => schema);

    const backup = yamlModule.stringify({
      version: "1.0",
      exported_at: new Date().toISOString(),
      table: schema,
      data: makeData([]),
    });

    await importTableBackup(backup, true);

    expect(mockStorage.importTable).toHaveBeenCalledWith(
      expect.any(Object),
      true
    );
  });

  test("gibt das importierte Schema zurück", async () => {
    resetMocks();
    const yamlModule = await import("yaml");
    const schema = makeSchema();
    mockStorage.importTable.mockImplementation(async () => schema);

    const backup = yamlModule.stringify({
      version: "1.0",
      exported_at: new Date().toISOString(),
      table: schema,
      data: makeData([]),
    });

    const result = await importTableBackup(backup);
    expect(result).toEqual(schema);
  });
});

// ============================================
// previewImport
// ============================================

describe("previewImport", () => {
  describe("Fehlerbehandlung", () => {
    test("wirft Fehler wenn Tabelle nicht existiert", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => null);

      await expect(
        previewImport("nicht_vorhanden", "name\nMax", "csv")
      ).rejects.toThrow('Table "nicht_vorhanden" not found');
    });

    test("wirft Fehler bei unbekanntem Format", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      await expect(
        previewImport("test_tabelle", "daten", "xml" as any)
      ).rejects.toThrow("Unsupported format: xml");
    });
  });

  describe("Vorschau-Ergebnis", () => {
    test("gibt columns, rows, total und warnings zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter\nMax,30\nAnna,25";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result).toHaveProperty("columns");
      expect(result).toHaveProperty("rows");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("warnings");
    });

    test("columns enthält die Schema-Spalten-IDs", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter\nMax,30";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.columns).toContain("name");
      expect(result.columns).toContain("alter");
      expect(result.columns).toContain("aktiv");
    });

    test("total gibt Gesamtanzahl der importierten Zeilen an", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter\nMax,30\nAnna,25\nKlaus,45";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.total).toBe(3);
    });

    test("begrenzt zurückgegebene Zeilen auf limit", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvLines = ["name,alter"];
      for (let i = 0; i < 20; i++) {
        csvLines.push(`Person${i},${20 + i}`);
      }
      const csv = csvLines.join("\n");

      const result = await previewImport("test_tabelle", csv, "csv", 5);

      expect(result.rows).toHaveLength(5);
      expect(result.total).toBe(20);
    });

    test("gibt standardmäßig maximal 10 Vorschau-Zeilen zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csvLines = ["name,alter"];
      for (let i = 0; i < 15; i++) {
        csvLines.push(`Person${i},${20 + i}`);
      }
      const csv = csvLines.join("\n");

      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.rows).toHaveLength(10);
      expect(result.total).toBe(15);
    });
  });

  describe("Warnungen", () => {
    test("warnt bei unbekannten Spalten die nicht im Schema vorhanden sind", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter,unbekannte_spalte\nMax,30,wert";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.warnings.some(w => w.includes("unbekannte_spalte"))).toBe(true);
    });

    test("warnt bei fehlenden Pflichtfeldern im Import", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema({
        columns: [
          { id: "name", name: "Name", type: "text", required: true },
          { id: "alter", name: "Alter", type: "number" },
        ],
      }));

      // Nur 'alter' im CSV, 'name' (Pflichtfeld) fehlt
      const csv = "alter\n30";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.warnings.some(w => w.includes("Name"))).toBe(true);
    });

    test("gibt keine Warnungen bei perfekt passendem Import zurück", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter,aktiv\nMax,30,true";
      const result = await previewImport("test_tabelle", csv, "csv");

      expect(result.warnings).toHaveLength(0);
    });

    test("gibt keine Warnungen zurück wenn Importdaten leer sind", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const result = await previewImport("test_tabelle", "name,alter", "csv");

      expect(result.warnings).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Vorschau-Zeilen-Normalisierung", () => {
    test("Vorschau-Zeilen enthalten nur Schema-Spalten (keine unbekannten Felder)", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name,alter,unbekannte_spalte\nMax,30,extra";
      const result = await previewImport("test_tabelle", csv, "csv");

      const row = result.rows[0]!;
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("alter");
      expect(row).not.toHaveProperty("unbekannte_spalte");
    });

    test("Vorschau-Zeilen haben null für fehlende Schema-Spalten", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const csv = "name\nMax";
      const result = await previewImport("test_tabelle", csv, "csv");

      const row = result.rows[0]!;
      expect(row.alter).toBeNull();
      expect(row.aktiv).toBeNull();
    });

    test("funktioniert auch mit JSON-Format", async () => {
      resetMocks();
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const json = JSON.stringify([{ name: "Max", alter: 30 }]);
      const result = await previewImport("test_tabelle", json, "json");

      expect(result.total).toBe(1);
      expect(result.columns).toContain("name");
    });

    test("funktioniert auch mit YAML-Format", async () => {
      resetMocks();
      const yamlModule = await import("yaml");
      mockStorage.loadSchema.mockImplementation(async () => makeSchema());

      const yamlContent = yamlModule.stringify([{ name: "Max", alter: 30 }]);
      const result = await previewImport("test_tabelle", yamlContent, "yaml");

      expect(result.total).toBe(1);
      expect(result.columns).toContain("name");
    });
  });
});
