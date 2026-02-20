/**
 * Tests for Table Storage (backend/src/tables/storage.ts)
 *
 * Pure helper functions are tested directly. Storage operations use a real
 * temporary directory in /tmp so no additional fs mocking is required.
 * The TABLES_DIR path is redirected via a mock of ../../utils/paths so that
 * all file I/O happens under TEST_DIR and never touches the real data directory.
 * The mock must be registered BEFORE the module under test is imported.
 */

import { test, expect, describe, beforeEach, afterAll, mock } from "bun:test";
import { rm, mkdir } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Test directory — unique per test run to avoid cross-run collisions
// ---------------------------------------------------------------------------

const TEST_DIR = `/tmp/tables-storage-test-${Date.now()}`;

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE the dynamic import of the module under test.
//
// We redirect only TABLES_DIR (and DATA_DIR as a safety fallback). All other
// path operations (fs/promises, path, etc.) run against the real filesystem
// because the task explicitly requests real I/O in /tmp.
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  TABLES_DIR: TEST_DIR,
  DATA_DIR: TEST_DIR,
}));

// Provide a deterministic generateId so row IDs are predictable in tests.
let idCounter = 0;
mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => `${prefix}_test_${String(++idCounter).padStart(4, "0")}`,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  sanitizeTableId,
  generateRowId,
  createTable,
  loadSchema,
  saveSchema,
  loadData,
  saveData,
  tableExists,
  deleteTable,
  addRow,
  updateRow,
  deleteRow,
  getRow,
  listTables,
} = await import("../storage");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal CreateTableParams fixture */
function makeTableParams(id: string, name: string = id) {
  return {
    id,
    name,
    columns: [
      { id: "title", name: "Titel", type: "text" as const },
      { id: "value", name: "Wert", type: "number" as const },
    ],
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Reset the ID counter so each test group starts from a known state
  idCounter = 0;
  // Wipe test directory and recreate it fresh before each test
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// sanitizeTableId()
// ---------------------------------------------------------------------------

describe("sanitizeTableId()", () => {
  test("wandelt Großbuchstaben in Kleinbuchstaben um", () => {
    expect(sanitizeTableId("MyTable")).toBe("mytable");
  });

  test("ersetzt Leerzeichen durch Bindestriche", () => {
    expect(sanitizeTableId("meine tabelle")).toBe("meine-tabelle");
  });

  test("ersetzt Sonderzeichen durch Bindestriche und entfernt abschließende Bindestriche", () => {
    // "@" between letters → hyphen, "!" at end → hyphen → trimmed
    expect(sanitizeTableId("table@name!")).toBe("table-name");
  });

  test("belässt Ziffern und Unterstriche unverändert", () => {
    expect(sanitizeTableId("table_01")).toBe("table_01");
  });

  test("kollabiert mehrfache aufeinanderfolgende Bindestriche zu einem", () => {
    expect(sanitizeTableId("a---b")).toBe("a-b");
  });

  test("entfernt führende Bindestriche", () => {
    expect(sanitizeTableId("---foo")).toBe("foo");
  });

  test("entfernt abschließende Bindestriche", () => {
    expect(sanitizeTableId("foo---")).toBe("foo");
  });

  test("verarbeitet gemischte Sonderzeichen korrekt", () => {
    // "Meine Tabelle (2024)!" → lowercase → special chars to hyphens → collapse → trim
    expect(sanitizeTableId("Meine Tabelle (2024)!")).toBe("meine-tabelle-2024");
  });

  test("gibt leeren String zurück wenn die Eingabe nur Sonderzeichen enthält", () => {
    expect(sanitizeTableId("!@#$%")).toBe("");
  });

  test("lässt bereits gültige IDs unverändert", () => {
    expect(sanitizeTableId("my-valid-table_01")).toBe("my-valid-table_01");
  });
});

// ---------------------------------------------------------------------------
// generateRowId()
// ---------------------------------------------------------------------------

describe("generateRowId()", () => {
  test("gibt einen String zurück", () => {
    const id = generateRowId();
    expect(typeof id).toBe("string");
  });

  test("beginnt mit dem Präfix 'row_'", () => {
    const id = generateRowId();
    expect(id.startsWith("row_")).toBe(true);
  });

  test("gibt bei aufeinanderfolgenden Aufrufen unterschiedliche IDs zurück", () => {
    // Reset counter to ensure clean state
    idCounter = 100;
    const id1 = generateRowId();
    const id2 = generateRowId();
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// tableExists()
// ---------------------------------------------------------------------------

describe("tableExists()", () => {
  test("gibt false zurück wenn die Tabelle nicht existiert", async () => {
    const exists = await tableExists("nonexistent-table");
    expect(exists).toBe(false);
  });

  test("gibt true zurück nachdem eine Tabelle erstellt wurde", async () => {
    await createTable(makeTableParams("exists-check"));
    const exists = await tableExists("exists-check");
    expect(exists).toBe(true);
  });

  test("gibt false zurück nachdem die Tabelle gelöscht wurde", async () => {
    await createTable(makeTableParams("to-be-deleted"));
    await deleteTable("to-be-deleted");
    const exists = await tableExists("to-be-deleted");
    expect(exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTable() + loadSchema()
// ---------------------------------------------------------------------------

describe("createTable() + loadSchema()", () => {
  test("erstellt eine Tabelle und gibt das Schema zurück", async () => {
    const schema = await createTable(makeTableParams("new-table", "Neue Tabelle"));
    expect(schema.id).toBe("new-table");
    expect(schema.name).toBe("Neue Tabelle");
  });

  test("Schema-Roundtrip: gespeichertes Schema kann wieder geladen werden", async () => {
    const created = await createTable(makeTableParams("round-trip", "Roundtrip Tabelle"));
    const loaded = await loadSchema("round-trip");

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(created.id);
    expect(loaded!.name).toBe(created.name);
    expect(loaded!.columns).toHaveLength(2);
    expect(loaded!.columns[0]!.id).toBe("title");
    expect(loaded!.columns[1]!.id).toBe("value");
  });

  test("setzt created_at und updated_at auf gültige ISO-Zeitstempel", async () => {
    const before = new Date().toISOString();
    const schema = await createTable(makeTableParams("timestamps-table"));
    const after = new Date().toISOString();

    expect(schema.created_at >= before).toBe(true);
    expect(schema.created_at <= after).toBe(true);
    expect(schema.updated_at >= before).toBe(true);
    expect(schema.updated_at <= after).toBe(true);
  });

  test("initialisiert eine leere Datendatei beim Erstellen der Tabelle", async () => {
    await createTable(makeTableParams("with-data-file"));
    const data = await loadData("with-data-file");

    expect(data).not.toBeNull();
    expect(data!.rows).toEqual([]);
    expect(data!.row_count).toBe(0);
  });

  test("wirft einen Fehler wenn eine Tabelle mit derselben ID bereits existiert", async () => {
    await createTable(makeTableParams("duplicate-table"));
    await expect(createTable(makeTableParams("duplicate-table"))).rejects.toThrow(
      'Table "duplicate-table" already exists'
    );
  });

  test("sanitiert die Tabellen-ID beim Erstellen", async () => {
    // "My Table!" → "my-table" after sanitization (trailing hyphen from "!" is trimmed)
    const schema = await createTable(makeTableParams("My Table!"));
    expect(schema.id).toBe("my-table");
    expect(schema.id).not.toContain(" ");
    expect(schema.id).not.toContain("!");
  });

  test("verwendet die erste Spalte als primary_column wenn keine settings angegeben", async () => {
    const schema = await createTable(makeTableParams("default-settings"));
    expect(schema.settings?.primary_column).toBe("title");
    expect(schema.settings?.default_sort).toBe("title");
    expect(schema.settings?.default_sort_direction).toBe("ASC");
  });

  test("loadSchema gibt null zurück wenn die Tabelle nicht existiert", async () => {
    const result = await loadSchema("does-not-exist");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveSchema()
// ---------------------------------------------------------------------------

describe("saveSchema()", () => {
  test("aktualisiert updated_at beim Speichern", async () => {
    const schema = await createTable(makeTableParams("update-schema-table"));
    const originalUpdatedAt = schema.updated_at;

    // Small delay to ensure timestamp differs
    await new Promise(resolve => setTimeout(resolve, 5));

    await saveSchema({ ...schema, name: "Geänderter Name" });
    const reloaded = await loadSchema("update-schema-table");

    expect(reloaded!.name).toBe("Geänderter Name");
    expect(reloaded!.updated_at >= originalUpdatedAt).toBe(true);
  });

  test("persistiert Änderungen am Schema dauerhaft", async () => {
    const schema = await createTable(makeTableParams("persist-schema"));
    schema.description = "Eine Beschreibung";

    await saveSchema(schema);
    const loaded = await loadSchema("persist-schema");

    expect(loaded!.description).toBe("Eine Beschreibung");
  });
});

// ---------------------------------------------------------------------------
// loadData() + saveData()
// ---------------------------------------------------------------------------

describe("loadData() + saveData()", () => {
  test("gibt null zurück wenn keine Datendatei existiert", async () => {
    const result = await loadData("nonexistent-data-table");
    expect(result).toBeNull();
  });

  test("Daten-Roundtrip: gespeicherte Daten können wieder geladen werden", async () => {
    await createTable(makeTableParams("data-roundtrip"));

    const testData = {
      updated_at: new Date().toISOString(),
      row_count: 1,
      rows: [
        { _id: "row_test_0001", _created_at: new Date().toISOString(), title: "Test" },
      ],
    };

    await saveData("data-roundtrip", testData);
    const loaded = await loadData("data-roundtrip");

    expect(loaded).not.toBeNull();
    expect(loaded!.rows).toHaveLength(1);
    expect(loaded!.rows[0]!._id).toBe("row_test_0001");
    expect(loaded!.rows[0]!.title).toBe("Test");
  });

  test("saveData aktualisiert row_count automatisch", async () => {
    await createTable(makeTableParams("row-count-table"));

    const data = {
      updated_at: new Date().toISOString(),
      row_count: 0,
      rows: [
        { _id: "row_1", title: "A" },
        { _id: "row_2", title: "B" },
        { _id: "row_3", title: "C" },
      ],
    };

    await saveData("row-count-table", data);
    const loaded = await loadData("row-count-table");

    expect(loaded!.row_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// addRow() + getRow()
// ---------------------------------------------------------------------------

describe("addRow() + getRow()", () => {
  test("fügt eine Zeile hinzu und gibt sie mit generierter ID zurück", async () => {
    await createTable(makeTableParams("add-row-table"));
    const row = await addRow("add-row-table", { title: "Test-Eintrag", value: 42 });

    expect(row._id).toBeDefined();
    expect(row._id.startsWith("row_")).toBe(true);
    expect(row.title).toBe("Test-Eintrag");
    expect(row.value).toBe(42);
  });

  test("fügt _created_at und _updated_at Zeitstempel hinzu", async () => {
    await createTable(makeTableParams("timestamps-row-table"));
    const before = new Date().toISOString();
    const row = await addRow("timestamps-row-table", { title: "Mit Zeitstempel" });
    const after = new Date().toISOString();

    expect(row._created_at).toBeDefined();
    expect(row._updated_at).toBeDefined();
    expect(row._created_at! >= before).toBe(true);
    expect(row._created_at! <= after).toBe(true);
    expect(row._updated_at! >= before).toBe(true);
  });

  test("getRow findet eine hinzugefügte Zeile anhand ihrer ID", async () => {
    await createTable(makeTableParams("get-row-table"));
    const added = await addRow("get-row-table", { title: "Findbar" });

    const found = await getRow("get-row-table", added._id);

    expect(found).not.toBeNull();
    expect(found!._id).toBe(added._id);
    expect(found!.title).toBe("Findbar");
  });

  test("getRow gibt null zurück wenn die Zeilen-ID nicht existiert", async () => {
    await createTable(makeTableParams("get-row-missing"));
    const result = await getRow("get-row-missing", "nonexistent-row-id");
    expect(result).toBeNull();
  });

  test("getRow gibt null zurück wenn die Tabelle keine Datendatei hat", async () => {
    // No table created — loadData will return null and getRow propagates null
    const result = await getRow("totally-missing-table", "any-row-id");
    expect(result).toBeNull();
  });

  test("mehrere Zeilen können unabhängig hinzugefügt und abgerufen werden", async () => {
    await createTable(makeTableParams("multi-row-table"));
    const row1 = await addRow("multi-row-table", { title: "Zeile 1" });
    const row2 = await addRow("multi-row-table", { title: "Zeile 2" });
    const row3 = await addRow("multi-row-table", { title: "Zeile 3" });

    const found1 = await getRow("multi-row-table", row1._id);
    const found2 = await getRow("multi-row-table", row2._id);
    const found3 = await getRow("multi-row-table", row3._id);

    expect(found1!.title).toBe("Zeile 1");
    expect(found2!.title).toBe("Zeile 2");
    expect(found3!.title).toBe("Zeile 3");
  });

  test("wirft einen Fehler wenn die Tabelle keine Datendatei hat", async () => {
    // Create schema only, no data file — addRow must throw
    const schema = {
      id: "schema-only-table",
      name: "Nur Schema",
      columns: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveSchema(schema);
    await expect(addRow("schema-only-table", { title: "x" })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateRow()
// ---------------------------------------------------------------------------

describe("updateRow()", () => {
  test("aktualisiert Felder einer vorhandenen Zeile", async () => {
    await createTable(makeTableParams("update-row-table"));
    const row = await addRow("update-row-table", { title: "Original", value: 1 });

    const updated = await updateRow("update-row-table", row._id, { title: "Geändert", value: 99 });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Geändert");
    expect(updated!.value).toBe(99);
  });

  test("bewahrt die ursprüngliche _id beim Update", async () => {
    await createTable(makeTableParams("preserve-id-table"));
    const row = await addRow("preserve-id-table", { title: "Test" });

    const updated = await updateRow("preserve-id-table", row._id, { title: "Neu" });

    expect(updated!._id).toBe(row._id);
  });

  test("aktualisiert _updated_at beim Update", async () => {
    await createTable(makeTableParams("updated-at-table"));
    const row = await addRow("updated-at-table", { title: "Vor Update" });
    const originalUpdatedAt = row._updated_at;

    await new Promise(resolve => setTimeout(resolve, 5));
    const updated = await updateRow("updated-at-table", row._id, { title: "Nach Update" });

    expect(updated!._updated_at! >= originalUpdatedAt!).toBe(true);
  });

  test("gibt null zurück wenn die Zeilen-ID nicht existiert", async () => {
    await createTable(makeTableParams("update-missing-row"));
    const result = await updateRow("update-missing-row", "nonexistent-row-id", { title: "x" });
    expect(result).toBeNull();
  });

  test("führt Update-Felder mit vorhandenen Feldern zusammen (Merge)", async () => {
    await createTable(makeTableParams("merge-update-table"));
    const row = await addRow("merge-update-table", { title: "Behalten", value: 100 });

    const updated = await updateRow("merge-update-table", row._id, { value: 200 });

    expect(updated!.title).toBe("Behalten");
    expect(updated!.value).toBe(200);
  });

  test("Update wird dauerhaft in der Datendatei gespeichert", async () => {
    await createTable(makeTableParams("persist-update-table"));
    const row = await addRow("persist-update-table", { title: "Vor Persist" });

    await updateRow("persist-update-table", row._id, { title: "Nach Persist" });

    const reloaded = await getRow("persist-update-table", row._id);
    expect(reloaded!.title).toBe("Nach Persist");
  });
});

// ---------------------------------------------------------------------------
// deleteRow()
// ---------------------------------------------------------------------------

describe("deleteRow()", () => {
  test("löscht eine vorhandene Zeile und gibt true zurück", async () => {
    await createTable(makeTableParams("delete-row-table"));
    const row = await addRow("delete-row-table", { title: "Zu löschen" });

    const result = await deleteRow("delete-row-table", row._id);
    expect(result).toBe(true);
  });

  test("Zeile ist nach dem Löschen nicht mehr abrufbar", async () => {
    await createTable(makeTableParams("deleted-row-gone-table"));
    const row = await addRow("deleted-row-gone-table", { title: "Weg" });

    await deleteRow("deleted-row-gone-table", row._id);

    const found = await getRow("deleted-row-gone-table", row._id);
    expect(found).toBeNull();
  });

  test("gibt false zurück wenn die Zeilen-ID nicht existiert", async () => {
    await createTable(makeTableParams("delete-missing-row-table"));
    const result = await deleteRow("delete-missing-row-table", "nonexistent-row-id");
    expect(result).toBe(false);
  });

  test("löscht nur die Ziel-Zeile, andere Zeilen bleiben erhalten", async () => {
    await createTable(makeTableParams("selective-delete-table"));
    const row1 = await addRow("selective-delete-table", { title: "Behalten" });
    const row2 = await addRow("selective-delete-table", { title: "Löschen" });
    const row3 = await addRow("selective-delete-table", { title: "Auch behalten" });

    await deleteRow("selective-delete-table", row2._id);

    expect(await getRow("selective-delete-table", row1._id)).not.toBeNull();
    expect(await getRow("selective-delete-table", row2._id)).toBeNull();
    expect(await getRow("selective-delete-table", row3._id)).not.toBeNull();
  });

  test("aktualisiert row_count in der Datendatei nach dem Löschen", async () => {
    await createTable(makeTableParams("row-count-delete-table"));
    const row1 = await addRow("row-count-delete-table", { title: "A" });
    await addRow("row-count-delete-table", { title: "B" });

    await deleteRow("row-count-delete-table", row1._id);
    const data = await loadData("row-count-delete-table");

    expect(data!.row_count).toBe(1);
    expect(data!.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deleteTable()
// ---------------------------------------------------------------------------

describe("deleteTable()", () => {
  test("löscht eine vorhandene Tabelle und gibt true zurück", async () => {
    await createTable(makeTableParams("to-delete-table"));
    const result = await deleteTable("to-delete-table");
    expect(result).toBe(true);
  });

  test("Tabelle ist nach dem Löschen nicht mehr auffindbar", async () => {
    await createTable(makeTableParams("deleted-table-check"));
    await deleteTable("deleted-table-check");
    expect(await tableExists("deleted-table-check")).toBe(false);
  });

  test("Schema und Daten sind nach dem Löschen nicht mehr ladbar", async () => {
    await createTable(makeTableParams("deleted-schema-data-table"));
    await deleteTable("deleted-schema-data-table");

    expect(await loadSchema("deleted-schema-data-table")).toBeNull();
    expect(await loadData("deleted-schema-data-table")).toBeNull();
  });

  test("gibt false zurück wenn die Tabelle nicht existiert", async () => {
    const result = await deleteTable("nonexistent-delete-table");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listTables()
// ---------------------------------------------------------------------------

describe("listTables()", () => {
  test("gibt eine leere Liste zurück wenn keine Tabellen vorhanden sind", async () => {
    const tables = await listTables();
    expect(tables).toEqual([]);
  });

  test("listet eine erstellte Tabelle auf", async () => {
    await createTable(makeTableParams("single-table", "Einzel-Tabelle"));
    const tables = await listTables();

    expect(tables).toHaveLength(1);
    expect(tables[0]!.id).toBe("single-table");
    expect(tables[0]!.name).toBe("Einzel-Tabelle");
  });

  test("listet mehrere erstellte Tabellen auf", async () => {
    await createTable(makeTableParams("table-alpha", "Alpha"));
    await createTable(makeTableParams("table-beta", "Beta"));
    await createTable(makeTableParams("table-gamma", "Gamma"));

    const tables = await listTables();
    expect(tables).toHaveLength(3);
  });

  test("sortiert Tabellen alphabetisch nach Name", async () => {
    await createTable(makeTableParams("t-z", "Zebra"));
    await createTable(makeTableParams("t-a", "Apfel"));
    await createTable(makeTableParams("t-m", "Mango"));

    const tables = await listTables();

    expect(tables[0]!.name).toBe("Apfel");
    expect(tables[1]!.name).toBe("Mango");
    expect(tables[2]!.name).toBe("Zebra");
  });

  test("enthält eine gelöschte Tabelle nicht mehr in der Liste", async () => {
    await createTable(makeTableParams("keep-me", "Behalten"));
    await createTable(makeTableParams("delete-me", "Löschen"));

    await deleteTable("delete-me");
    const tables = await listTables();

    expect(tables).toHaveLength(1);
    expect(tables[0]!.id).toBe("keep-me");
  });

  test("überspringt Verzeichnisse die mit '_' beginnen (z.B. _templates)", async () => {
    await mkdir(join(TEST_DIR, "_templates"), { recursive: true });
    await createTable(makeTableParams("real-table", "Echte Tabelle"));

    const tables = await listTables();

    expect(tables).toHaveLength(1);
    expect(tables[0]!.id).toBe("real-table");
  });

  test("überspringt Verzeichnisse die mit '.' beginnen (versteckte Ordner)", async () => {
    await mkdir(join(TEST_DIR, ".hidden"), { recursive: true });
    await createTable(makeTableParams("visible-table", "Sichtbare Tabelle"));

    const tables = await listTables();

    expect(tables).toHaveLength(1);
    expect(tables[0]!.id).toBe("visible-table");
  });

  test("gibt vollständige Schemata mit allen Feldern zurück", async () => {
    await createTable({
      ...makeTableParams("full-schema-table", "Vollständiges Schema"),
      description: "Eine Beschreibung",
      icon: "📋",
    });

    const tables = await listTables();
    const schema = tables[0]!;

    expect(schema.id).toBe("full-schema-table");
    expect(schema.name).toBe("Vollständiges Schema");
    expect(schema.description).toBe("Eine Beschreibung");
    expect(schema.columns).toHaveLength(2);
    expect(schema.created_at).toBeDefined();
    expect(schema.updated_at).toBeDefined();
  });
});
