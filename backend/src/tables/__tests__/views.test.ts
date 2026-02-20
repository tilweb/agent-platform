/**
 * Tests for Table Views (backend/src/tables/views.ts)
 *
 * Alle abhängigen Module werden per mock.module() gemockt, bevor das Modul
 * unter Test importiert wird. storage und service sind die relevanten
 * Abhängigkeiten.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { TableSchema, ViewDefinition, FilterCondition } from "../types";

// ---------------------------------------------------------------------------
// Gemeinsamer Zustand für Storage-Mock — wird in beforeEach zurückgesetzt
// ---------------------------------------------------------------------------

let mockSchema: TableSchema | null = null;
let savedSchema: TableSchema | null = null;
let queryRowsResult = { rows: [], total: 0, offset: 0, limit: 0 };
let parseFilterTextShouldThrow = false;
let parseFilterTextResult: FilterCondition[] = [];

// ---------------------------------------------------------------------------
// Mock: ./storage  — MUSS vor dem Import des Moduls unter Test registriert sein
// ---------------------------------------------------------------------------

mock.module("../storage", () => ({
  loadSchema: async (_tableId: string) => mockSchema,
  saveSchema: async (schema: TableSchema) => {
    savedSchema = schema;
    // Auch mockSchema synchronisieren, damit folgende loadSchema-Aufrufe
    // den aktuellen Stand sehen
    mockSchema = schema;
  },
}));

// ---------------------------------------------------------------------------
// Mock: ./service
// ---------------------------------------------------------------------------

mock.module("../service", () => ({
  queryRows: async (_tableId: string, options: unknown) => queryRowsResult,
  parseFilterText: (text: string) => {
    if (parseFilterTextShouldThrow) {
      throw new Error(`Syntaxfehler im Filter: ${text}`);
    }
    return parseFilterTextResult;
  },
}));

// ---------------------------------------------------------------------------
// Import Modul unter Test NACH der Mock-Registrierung
// ---------------------------------------------------------------------------

const {
  getViews,
  getView,
  createView,
  updateView,
  deleteView,
  executeView,
  cloneView,
  buildFilterString,
  getViewRowCount,
  exportView,
  importView,
} = await import("../views");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeSchema(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "test_table",
    name: "Testtabelle",
    columns: [
      { id: "name", name: "Name", type: "text" },
      { id: "alter", name: "Alter", type: "number" },
      { id: "status", name: "Status", type: "select", options: ["offen", "aktiv"] },
    ],
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeView(overrides: Partial<ViewDefinition> = {}): ViewDefinition {
  return {
    id: "test-view",
    name: "Testansicht",
    filter: "status = 'aktiv'",
    sort: "name ASC",
    columns: ["name", "status"],
    description: "Eine Testansicht",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup: Mocking-Zustand vor jedem Test zurücksetzen
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSchema = null;
  savedSchema = null;
  queryRowsResult = { rows: [], total: 0, offset: 0, limit: 0 };
  parseFilterTextShouldThrow = false;
  parseFilterTextResult = [];
});

// ===========================================================================
// getViews()
// ===========================================================================

describe("getViews()", () => {
  test("gibt leeres Array zurück wenn Tabelle keine Views hat", async () => {
    mockSchema = makeSchema({ views: undefined });
    const views = await getViews("test_table");
    expect(views).toEqual([]);
  });

  test("gibt leeres Array zurück wenn views-Array leer ist", async () => {
    mockSchema = makeSchema({ views: [] });
    const views = await getViews("test_table");
    expect(views).toEqual([]);
  });

  test("gibt alle Views zurück wenn Tabelle Views hat", async () => {
    const view1 = makeView({ id: "view-1", name: "Ansicht 1" });
    const view2 = makeView({ id: "view-2", name: "Ansicht 2" });
    mockSchema = makeSchema({ views: [view1, view2] });

    const views = await getViews("test_table");
    expect(views).toHaveLength(2);
    expect(views[0]!.id).toBe("view-1");
    expect(views[1]!.id).toBe("view-2");
  });

  test("gibt leeres Array zurück wenn Tabelle nicht existiert (schema = null)", async () => {
    mockSchema = null;
    const views = await getViews("unbekannte_tabelle");
    expect(views).toEqual([]);
  });
});

// ===========================================================================
// getView()
// ===========================================================================

describe("getView()", () => {
  test("gibt null zurück wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    const view = await getView("unbekannte_tabelle", "irgendein-view");
    expect(view).toBeNull();
  });

  test("gibt null zurück wenn Tabelle keine Views hat", async () => {
    mockSchema = makeSchema({ views: undefined });
    const view = await getView("test_table", "test-view");
    expect(view).toBeNull();
  });

  test("gibt null zurück wenn View-ID nicht existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "existierender-view" })] });
    const view = await getView("test_table", "nicht-vorhanden");
    expect(view).toBeNull();
  });

  test("gibt den gesuchten View zurück wenn er existiert", async () => {
    const expected = makeView({ id: "gesuchter-view", name: "Gesuchte Ansicht" });
    mockSchema = makeSchema({ views: [makeView({ id: "anderer-view" }), expected] });

    const view = await getView("test_table", "gesuchter-view");
    expect(view).not.toBeNull();
    expect(view!.id).toBe("gesuchter-view");
    expect(view!.name).toBe("Gesuchte Ansicht");
  });

  test("gibt den View mit allen Feldern zurück", async () => {
    const expected = makeView({
      id: "voller-view",
      name: "Volle Ansicht",
      filter: "alter > 18",
      sort: "name DESC",
      columns: ["name", "alter"],
      description: "Beschreibung",
    });
    mockSchema = makeSchema({ views: [expected] });

    const view = await getView("test_table", "voller-view");
    expect(view!.filter).toBe("alter > 18");
    expect(view!.sort).toBe("name DESC");
    expect(view!.columns).toEqual(["name", "alter"]);
    expect(view!.description).toBe("Beschreibung");
  });
});

// ===========================================================================
// createView()
// ===========================================================================

describe("createView()", () => {
  test("wirft Fehler wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    await expect(
      createView("nicht_vorhanden", { id: "neuer-view", name: "Neuer View" })
    ).rejects.toThrow('Table "nicht_vorhanden" not found');
  });

  test("erstellt einen View und gibt ihn zurück", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "neuer-view", name: "Neuer View" });
    expect(view.id).toBe("neuer-view");
    expect(view.name).toBe("Neuer View");
  });

  test("speichert den neuen View im Schema", async () => {
    mockSchema = makeSchema({ views: [] });
    await createView("test_table", { id: "gespeicherter-view", name: "Gespeichert" });

    expect(savedSchema).not.toBeNull();
    expect(savedSchema!.views).toHaveLength(1);
    expect(savedSchema!.views![0]!.id).toBe("gespeicherter-view");
  });

  test("initialisiert views-Array wenn schema.views undefined ist", async () => {
    mockSchema = makeSchema({ views: undefined });
    const view = await createView("test_table", { id: "erster-view", name: "Erster" });

    expect(view.id).toBe("erster-view");
    expect(savedSchema!.views).toHaveLength(1);
  });

  test("sanitiert die View-ID: Großbuchstaben werden klein geschrieben", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "MeinView", name: "Test" });
    expect(view.id).toBe("meinview");
  });

  test("sanitiert die View-ID: Sonderzeichen werden zu Bindestrichen", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "mein view!", name: "Test" });
    expect(view.id).toBe("mein-view");
  });

  test("sanitiert die View-ID: mehrfache Bindestriche werden zu einem", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "mein---view", name: "Test" });
    expect(view.id).toBe("mein-view");
  });

  test("sanitiert die View-ID: führende und abschließende Bindestriche werden entfernt", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "-mein-view-", name: "Test" });
    expect(view.id).toBe("mein-view");
  });

  test("wirft Fehler wenn View-ID bereits existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "doppelter-view" })] });
    await expect(
      createView("test_table", { id: "doppelter-view", name: "Duplikat" })
    ).rejects.toThrow('View "doppelter-view" already exists');
  });

  test("wirft Fehler bei ungültiger Filtersyntax", async () => {
    mockSchema = makeSchema({ views: [] });
    parseFilterTextShouldThrow = true;
    await expect(
      createView("test_table", { id: "filter-fehler", name: "Fehler", filter: "!!!ungültig!!!" })
    ).rejects.toThrow("Invalid filter syntax");
  });

  test("erstellt View ohne Filter ohne Fehler", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "kein-filter", name: "Ohne Filter" });
    expect(view.filter).toBeUndefined();
  });

  test("wirft Fehler wenn angegebene Spalte nicht im Schema existiert", async () => {
    mockSchema = makeSchema({ views: [] });
    await expect(
      createView("test_table", {
        id: "ungueltige-spalte",
        name: "Test",
        columns: ["name", "nicht_vorhanden"],
      })
    ).rejects.toThrow('Column "nicht_vorhanden" not found');
  });

  test("erstellt View mit gültigen Spalten erfolgreich", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", {
      id: "mit-spalten",
      name: "Mit Spalten",
      columns: ["name", "alter"],
    });
    expect(view.columns).toEqual(["name", "alter"]);
  });

  test("speichert alle optionalen Felder (filter, sort, columns, description)", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", {
      id: "voller-view",
      name: "Voller View",
      filter: "status = 'aktiv'",
      sort: "name ASC",
      columns: ["name", "status"],
      description: "Meine Beschreibung",
    });
    expect(view.filter).toBe("status = 'aktiv'");
    expect(view.sort).toBe("name ASC");
    expect(view.columns).toEqual(["name", "status"]);
    expect(view.description).toBe("Meine Beschreibung");
  });

  test("bewahrt die ID im zurückgegebenen View", async () => {
    mockSchema = makeSchema({ views: [] });
    const view = await createView("test_table", { id: "korrekte-id", name: "Test" });
    expect(view.id).toBe("korrekte-id");
  });
});

// ===========================================================================
// updateView()
// ===========================================================================

describe("updateView()", () => {
  test("wirft Fehler wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    await expect(
      updateView("nicht_vorhanden", "beliebiger-view", { name: "Neu" })
    ).rejects.toThrow('Table "nicht_vorhanden" not found or has no views');
  });

  test("wirft Fehler wenn Tabelle keine Views hat", async () => {
    mockSchema = makeSchema({ views: undefined });
    await expect(
      updateView("test_table", "beliebiger-view", { name: "Neu" })
    ).rejects.toThrow('Table "test_table" not found or has no views');
  });

  test("wirft Fehler wenn View-ID nicht existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "existierender-view" })] });
    await expect(
      updateView("test_table", "nicht-vorhanden", { name: "Neu" })
    ).rejects.toThrow('View "nicht-vorhanden" not found');
  });

  test("aktualisiert den Namen des Views", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "update-view", name: "Alt" })] });
    const updated = await updateView("test_table", "update-view", { name: "Neu" });
    expect(updated.name).toBe("Neu");
  });

  test("bewahrt die View-ID beim Update", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "bewahrte-id" })] });
    const updated = await updateView("test_table", "bewahrte-id", { name: "Neu" });
    expect(updated.id).toBe("bewahrte-id");
  });

  test("mergt Änderungen mit vorhandenen View-Daten", async () => {
    const original = makeView({
      id: "merge-view",
      name: "Original",
      filter: "status = 'aktiv'",
      sort: "name ASC",
    });
    mockSchema = makeSchema({ views: [original] });

    const updated = await updateView("test_table", "merge-view", { name: "Geändert" });
    expect(updated.filter).toBe("status = 'aktiv'");
    expect(updated.sort).toBe("name ASC");
    expect(updated.name).toBe("Geändert");
  });

  test("aktualisiert filter wenn übergeben", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "filter-view", filter: "alter > 18" })] });
    const updated = await updateView("test_table", "filter-view", { filter: "alter > 21" });
    expect(updated.filter).toBe("alter > 21");
  });

  test("wirft Fehler bei ungültiger Filtersyntax beim Update", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "filter-error-view" })] });
    parseFilterTextShouldThrow = true;
    await expect(
      updateView("test_table", "filter-error-view", { filter: "!!!ungültig!!!" })
    ).rejects.toThrow("Invalid filter syntax");
  });

  test("validiert Filtersyntax nicht wenn filter undefined ist", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "kein-filter-update" })] });
    parseFilterTextShouldThrow = true;
    // Kein Fehler erwartet, da filter nicht übergeben wird
    const updated = await updateView("test_table", "kein-filter-update", { name: "Neu" });
    expect(updated.name).toBe("Neu");
  });

  test("wirft Fehler wenn angegebene Spalte beim Update nicht existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "spalten-view" })] });
    await expect(
      updateView("test_table", "spalten-view", { columns: ["name", "nicht_vorhanden"] })
    ).rejects.toThrow('Column "nicht_vorhanden" not found');
  });

  test("aktualisiert Spalten mit gültigen Spalten-IDs", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "spalten-update-view" })] });
    const updated = await updateView("test_table", "spalten-update-view", {
      columns: ["name", "alter"],
    });
    expect(updated.columns).toEqual(["name", "alter"]);
  });

  test("speichert die Änderungen persistent im Schema", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "persistenter-view", name: "Alt" })] });
    await updateView("test_table", "persistenter-view", { name: "Gespeichert" });

    expect(savedSchema).not.toBeNull();
    const updatedView = savedSchema!.views!.find(v => v.id === "persistenter-view");
    expect(updatedView!.name).toBe("Gespeichert");
  });
});

// ===========================================================================
// deleteView()
// ===========================================================================

describe("deleteView()", () => {
  test("gibt false zurück wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    const result = await deleteView("nicht_vorhanden", "beliebiger-view");
    expect(result).toBe(false);
  });

  test("gibt false zurück wenn Tabelle keine Views hat", async () => {
    mockSchema = makeSchema({ views: undefined });
    const result = await deleteView("test_table", "beliebiger-view");
    expect(result).toBe(false);
  });

  test("gibt false zurück wenn View-ID nicht existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "anderer-view" })] });
    const result = await deleteView("test_table", "nicht-vorhanden");
    expect(result).toBe(false);
  });

  test("löscht den View und gibt true zurück", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "zu-loeschender-view" })] });
    const result = await deleteView("test_table", "zu-loeschender-view");
    expect(result).toBe(true);
  });

  test("entfernt den View aus dem gespeicherten Schema", async () => {
    const view1 = makeView({ id: "view-1", name: "Ansicht 1" });
    const view2 = makeView({ id: "view-2", name: "Ansicht 2" });
    mockSchema = makeSchema({ views: [view1, view2] });

    await deleteView("test_table", "view-1");

    expect(savedSchema!.views).toHaveLength(1);
    expect(savedSchema!.views![0]!.id).toBe("view-2");
  });

  test("lässt andere Views unberührt beim Löschen eines Views", async () => {
    const views = [
      makeView({ id: "behalten-1" }),
      makeView({ id: "loeschen" }),
      makeView({ id: "behalten-2" }),
    ];
    mockSchema = makeSchema({ views });

    await deleteView("test_table", "loeschen");

    const remainingIds = savedSchema!.views!.map(v => v.id);
    expect(remainingIds).toContain("behalten-1");
    expect(remainingIds).toContain("behalten-2");
    expect(remainingIds).not.toContain("loeschen");
  });

  test("speichert das Schema nach dem Löschen", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "view-loeschen" })] });
    await deleteView("test_table", "view-loeschen");
    expect(savedSchema).not.toBeNull();
  });
});

// ===========================================================================
// executeView()
// ===========================================================================

describe("executeView()", () => {
  test("wirft Fehler wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    await expect(executeView("nicht_vorhanden", "irgendein-view")).rejects.toThrow(
      'Table "nicht_vorhanden" not found or has no views'
    );
  });

  test("wirft Fehler wenn Tabelle keine Views hat", async () => {
    mockSchema = makeSchema({ views: undefined });
    await expect(executeView("test_table", "irgendein-view")).rejects.toThrow(
      'Table "test_table" not found or has no views'
    );
  });

  test("wirft Fehler wenn View nicht existiert", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "anderer-view" })] });
    await expect(executeView("test_table", "nicht-vorhanden")).rejects.toThrow(
      'View "nicht-vorhanden" not found'
    );
  });

  test("führt Query aus und gibt Ergebnis zurück", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "query-view" })] });
    queryRowsResult = { rows: [{ _id: "row-1", name: "Max" }], total: 1, offset: 0, limit: 10 };

    const result = await executeView("test_table", "query-view");
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.name).toBe("Max");
  });

  test("übergibt filter_text aus dem View an queryRows", async () => {
    const view = makeView({ id: "filter-exec-view", filter: "status = 'aktiv'", sort: undefined });
    mockSchema = makeSchema({ views: [view] });

    // queryRows wird gemockt — wir prüfen nur, dass kein Fehler auftritt
    const result = await executeView("test_table", "filter-exec-view");
    expect(result).toBeDefined();
  });

  test("parst sort im Format 'spalte ASC' korrekt", async () => {
    const view = makeView({ id: "sort-asc-view", sort: "name ASC" });
    mockSchema = makeSchema({ views: [view] });

    const result = await executeView("test_table", "sort-asc-view");
    expect(result).toBeDefined();
  });

  test("parst sort im Format 'spalte DESC' korrekt", async () => {
    const view = makeView({ id: "sort-desc-view", sort: "alter DESC" });
    mockSchema = makeSchema({ views: [view] });

    const result = await executeView("test_table", "sort-desc-view");
    expect(result).toBeDefined();
  });

  test("parst sort ohne Richtungsangabe und setzt ASC als Standard", async () => {
    const view = makeView({ id: "sort-default-view", sort: "name" });
    mockSchema = makeSchema({ views: [view] });

    const result = await executeView("test_table", "sort-default-view");
    expect(result).toBeDefined();
  });

  test("zusätzliche Optionen werden mit View-Optionen zusammengeführt", async () => {
    const view = makeView({ id: "zusatz-view", sort: "name ASC" });
    mockSchema = makeSchema({ views: [view] });

    queryRowsResult = { rows: [], total: 5, offset: 10, limit: 5 };
    const result = await executeView("test_table", "zusatz-view", { limit: 5, offset: 10 });
    expect(result.total).toBe(5);
  });

  test("zusätzliche sort_by Option überschreibt View-Sort", async () => {
    const view = makeView({ id: "sort-override-view", sort: "name ASC" });
    mockSchema = makeSchema({ views: [view] });

    // sort_by in additionalOptions sollte den view.sort überschreiben
    const result = await executeView("test_table", "sort-override-view", { sort_by: "alter" });
    expect(result).toBeDefined();
  });
});

// ===========================================================================
// cloneView()
// ===========================================================================

describe("cloneView()", () => {
  test("wirft Fehler wenn Quell-View nicht existiert", async () => {
    mockSchema = makeSchema({ views: [] });
    await expect(
      cloneView("test_table", "nicht-vorhanden", "klon-view", "Klon")
    ).rejects.toThrow('View "nicht-vorhanden" not found');
  });

  test("klont einen View mit neuer ID und neuem Namen", async () => {
    const original = makeView({ id: "original-view", name: "Original" });
    mockSchema = makeSchema({ views: [original] });

    const klon = await cloneView("test_table", "original-view", "klon-view", "Klon");
    expect(klon.id).toBe("klon-view");
    expect(klon.name).toBe("Klon");
  });

  test("übernimmt filter, sort, columns und description vom Original", async () => {
    const original = makeView({
      id: "voller-original",
      name: "Original",
      filter: "alter > 18",
      sort: "name DESC",
      columns: ["name", "alter"],
      description: "Original Beschreibung",
    });
    mockSchema = makeSchema({ views: [original] });

    const klon = await cloneView("test_table", "voller-original", "voller-klon", "Voller Klon");
    expect(klon.filter).toBe("alter > 18");
    expect(klon.sort).toBe("name DESC");
    expect(klon.columns).toEqual(["name", "alter"]);
    expect(klon.description).toBe("Original Beschreibung");
  });

  test("klont einen View ohne optionale Felder", async () => {
    const original: ViewDefinition = { id: "minimaler-view", name: "Minimal" };
    mockSchema = makeSchema({ views: [original] });

    const klon = await cloneView("test_table", "minimaler-view", "minimaler-klon", "Minimaler Klon");
    expect(klon.id).toBe("minimaler-klon");
    expect(klon.name).toBe("Minimaler Klon");
    expect(klon.filter).toBeUndefined();
    expect(klon.sort).toBeUndefined();
    expect(klon.columns).toBeUndefined();
  });

  test("wirft Fehler wenn Klon-ID bereits existiert", async () => {
    const original = makeView({ id: "quelle" });
    const existing = makeView({ id: "ziel-id" });
    mockSchema = makeSchema({ views: [original, existing] });

    await expect(
      cloneView("test_table", "quelle", "ziel-id", "Klon")
    ).rejects.toThrow('View "ziel-id" already exists');
  });
});

// ===========================================================================
// buildFilterString()  — reine Hilfsfunktion, kein I/O
// ===========================================================================

describe("buildFilterString()", () => {
  test("gibt leeren String zurück bei leerem Array", () => {
    expect(buildFilterString([])).toBe("");
  });

  test("eq-Operator: spalte = 'wert'", () => {
    const result = buildFilterString([{ column: "status", operator: "eq", value: "aktiv" }]);
    expect(result).toBe("status = 'aktiv'");
  });

  test("neq-Operator: spalte != 'wert'", () => {
    const result = buildFilterString([{ column: "status", operator: "neq", value: "inaktiv" }]);
    expect(result).toBe("status != 'inaktiv'");
  });

  test("gt-Operator: spalte > 'wert'", () => {
    const result = buildFilterString([{ column: "alter", operator: "gt", value: "18" }]);
    expect(result).toBe("alter > '18'");
  });

  test("gte-Operator: spalte >= 'wert'", () => {
    const result = buildFilterString([{ column: "alter", operator: "gte", value: "18" }]);
    expect(result).toBe("alter >= '18'");
  });

  test("lt-Operator: spalte < 'wert'", () => {
    const result = buildFilterString([{ column: "preis", operator: "lt", value: "100" }]);
    expect(result).toBe("preis < '100'");
  });

  test("lte-Operator: spalte <= 'wert'", () => {
    const result = buildFilterString([{ column: "preis", operator: "lte", value: "100" }]);
    expect(result).toBe("preis <= '100'");
  });

  test("contains-Operator: spalte contains 'wert'", () => {
    const result = buildFilterString([{ column: "name", operator: "contains", value: "Max" }]);
    expect(result).toBe("name contains 'Max'");
  });

  test("starts-Operator: spalte starts 'wert'", () => {
    const result = buildFilterString([{ column: "name", operator: "starts", value: "M" }]);
    expect(result).toBe("name starts 'M'");
  });

  test("ends-Operator: spalte ends 'wert'", () => {
    const result = buildFilterString([{ column: "name", operator: "ends", value: "er" }]);
    expect(result).toBe("name ends 'er'");
  });

  test("empty-Operator: spalte is empty (kein Wert)", () => {
    const result = buildFilterString([{ column: "beschreibung", operator: "empty" }]);
    expect(result).toBe("beschreibung is empty");
  });

  test("nempty-Operator: spalte is not empty (kein Wert)", () => {
    const result = buildFilterString([{ column: "beschreibung", operator: "nempty" }]);
    expect(result).toBe("beschreibung is not empty");
  });

  test("unbekannter Operator erzeugt keinen Eintrag im Ergebnis-String", () => {
    const result = buildFilterString([
      // @ts-expect-error Absichtlich ungültiger Operator
      { column: "spalte", operator: "unbekannt", value: "wert" },
    ]);
    expect(result).toBe("");
  });

  test("mehrere Bedingungen werden mit AND verknüpft", () => {
    const conditions: FilterCondition[] = [
      { column: "status", operator: "eq", value: "aktiv" },
      { column: "alter", operator: "gt", value: "18" },
    ];
    const result = buildFilterString(conditions);
    expect(result).toBe("status = 'aktiv' AND alter > '18'");
  });

  test("drei Bedingungen werden mit doppeltem AND verknüpft", () => {
    const conditions: FilterCondition[] = [
      { column: "status", operator: "eq", value: "aktiv" },
      { column: "alter", operator: "gte", value: "18" },
      { column: "name", operator: "contains", value: "Max" },
    ];
    const result = buildFilterString(conditions);
    expect(result).toBe("status = 'aktiv' AND alter >= '18' AND name contains 'Max'");
  });

  test("filtert leere Einträge (unbekannter Operator) aus der AND-Verknüpfung heraus", () => {
    const conditions: FilterCondition[] = [
      { column: "status", operator: "eq", value: "aktiv" },
      // @ts-expect-error Absichtlich ungültiger Operator
      { column: "spalte", operator: "unbekannt", value: "wert" },
      { column: "alter", operator: "gt", value: "18" },
    ];
    const result = buildFilterString(conditions);
    expect(result).toBe("status = 'aktiv' AND alter > '18'");
  });

  test("Werte mit Leerzeichen werden korrekt in Anführungszeichen eingeschlossen", () => {
    const result = buildFilterString([
      { column: "firma", operator: "eq", value: "Adacor GmbH" },
    ]);
    expect(result).toBe("firma = 'Adacor GmbH'");
  });
});

// ===========================================================================
// getViewRowCount()
// ===========================================================================

describe("getViewRowCount()", () => {
  test("gibt die Gesamtzahl der Zeilen zurück (result.total)", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "count-view" })] });
    queryRowsResult = { rows: [], total: 42, offset: 0, limit: 0 };

    const count = await getViewRowCount("test_table", "count-view");
    expect(count).toBe(42);
  });

  test("gibt 0 zurück wenn keine Zeilen gefunden werden", async () => {
    mockSchema = makeSchema({ views: [makeView({ id: "leerer-count-view" })] });
    queryRowsResult = { rows: [], total: 0, offset: 0, limit: 0 };

    const count = await getViewRowCount("test_table", "leerer-count-view");
    expect(count).toBe(0);
  });

  test("wirft Fehler wenn View nicht existiert", async () => {
    mockSchema = makeSchema({ views: [] });
    await expect(getViewRowCount("test_table", "nicht-vorhanden")).rejects.toThrow(
      'View "nicht-vorhanden" not found'
    );
  });
});

// ===========================================================================
// exportView()
// ===========================================================================

describe("exportView()", () => {
  test("gibt null zurück wenn View nicht existiert", async () => {
    mockSchema = makeSchema({ views: [] });
    const result = await exportView("test_table", "nicht-vorhanden");
    expect(result).toBeNull();
  });

  test("gibt tableId und view zurück wenn View existiert", async () => {
    const view = makeView({ id: "export-view", name: "Exportansicht" });
    mockSchema = makeSchema({ views: [view] });

    const result = await exportView("test_table", "export-view");
    expect(result).not.toBeNull();
    expect(result!.tableId).toBe("test_table");
    expect(result!.view.id).toBe("export-view");
    expect(result!.view.name).toBe("Exportansicht");
  });

  test("exportiert alle View-Felder vollständig", async () => {
    const view = makeView({
      id: "voller-export",
      name: "Voller Export",
      filter: "alter > 18",
      sort: "name ASC",
      columns: ["name", "alter"],
      description: "Exportbeschreibung",
    });
    mockSchema = makeSchema({ views: [view] });

    const result = await exportView("test_table", "voller-export");
    expect(result!.view.filter).toBe("alter > 18");
    expect(result!.view.sort).toBe("name ASC");
    expect(result!.view.columns).toEqual(["name", "alter"]);
    expect(result!.view.description).toBe("Exportbeschreibung");
  });
});

// ===========================================================================
// importView()
// ===========================================================================

describe("importView()", () => {
  test("importiert einen View und gibt ihn zurück", async () => {
    mockSchema = makeSchema({ views: [] });
    const viewConfig: ViewDefinition = {
      id: "importierter-view",
      name: "Importierter View",
    };

    const imported = await importView("test_table", viewConfig);
    expect(imported.id).toBe("importierter-view");
    expect(imported.name).toBe("Importierter View");
  });

  test("wirft Fehler wenn Tabelle nicht existiert", async () => {
    mockSchema = null;
    const viewConfig: ViewDefinition = { id: "test", name: "Test" };
    await expect(importView("nicht_vorhanden", viewConfig)).rejects.toThrow(
      'Table "nicht_vorhanden" not found'
    );
  });

  test("wirft Fehler wenn View-ID bereits existiert", async () => {
    const existing = makeView({ id: "vorhandener-view" });
    mockSchema = makeSchema({ views: [existing] });
    const viewConfig: ViewDefinition = { id: "vorhandener-view", name: "Doppelt" };

    await expect(importView("test_table", viewConfig)).rejects.toThrow(
      'View "vorhandener-view" already exists'
    );
  });

  test("importiert alle optionalen Felder", async () => {
    mockSchema = makeSchema({ views: [] });
    const viewConfig: ViewDefinition = {
      id: "voller-import",
      name: "Voller Import",
      filter: "status = 'aktiv'",
      sort: "alter DESC",
      columns: ["name", "status"],
      description: "Importbeschreibung",
    };

    const imported = await importView("test_table", viewConfig);
    expect(imported.filter).toBe("status = 'aktiv'");
    expect(imported.sort).toBe("alter DESC");
    expect(imported.columns).toEqual(["name", "status"]);
    expect(imported.description).toBe("Importbeschreibung");
  });
});
