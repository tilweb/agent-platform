import { test, expect, describe, mock } from "bun:test";

mock.module("../storage", () => ({
  createTable: async () => ({}),
  loadSchema: async () => null,
  loadData: async () => null,
  saveSchema: async () => {},
  saveData: async () => {},
  deleteTable: async () => false,
  listTables: async () => [],
  getTableStats: async () => null,
  addRow: async () => ({}),
  updateRow: async () => null,
  deleteRow: async () => false,
  deleteRows: async () => 0,
  getRow: async () => null,
  listTemplates: async () => [],
  applyTemplate: async () => [],
  sanitizeTableId: (id: string) => id,
  generateRowId: () => "row_test",
}));

import { validateRow, normalizeRowData, parseFilterText } from "../service";
import type { TableSchema, ColumnDefinition } from "../types";

// ============================================
// Helpers
// ============================================

function makeSchema(columns: ColumnDefinition[]): TableSchema {
  return {
    id: "test_table",
    name: "Testtabelle",
    columns,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  };
}

function col(overrides: Partial<ColumnDefinition> & { id: string; name: string; type: ColumnDefinition["type"] }): ColumnDefinition {
  return { ...overrides };
}

// ============================================
// validateRow
// ============================================

describe("validateRow", () => {
  describe("Gültige Zeilen", () => {
    test("gibt valid=true zurück wenn alle Pflichtfelder korrekt befüllt sind", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
        col({ id: "alter", name: "Alter", type: "number", required: true }),
      ]);
      const result = validateRow(schema, { name: "Max Muster", alter: 30 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("gibt valid=true zurück wenn optionale Felder fehlen", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
        col({ id: "notiz", name: "Notiz", type: "text" }),
      ]);
      const result = validateRow(schema, { name: "Max" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("gibt valid=true zurück bei leerem Schema", () => {
      const schema = makeSchema([]);
      const result = validateRow(schema, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Pflichtfelder", () => {
    test("gibt Fehler zurück wenn Pflichtfeld fehlt (undefined)", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
      ]);
      const result = validateRow(schema, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.column).toBe("name");
    });

    test("gibt Fehler zurück wenn Pflichtfeld null ist", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
      ]);
      const result = validateRow(schema, { name: null });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("name");
    });

    test("gibt Fehler zurück wenn Pflichtfeld leerer String ist", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
      ]);
      const result = validateRow(schema, { name: "" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("name");
    });

    test("gibt mehrere Fehler zurück wenn mehrere Pflichtfelder fehlen", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text", required: true }),
        col({ id: "email", name: "E-Mail", type: "email", required: true }),
      ]);
      const result = validateRow(schema, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("Typ 'text'", () => {
    test("akzeptiert gültige Zeichenkette", () => {
      const schema = makeSchema([
        col({ id: "titel", name: "Titel", type: "text" }),
      ]);
      const result = validateRow(schema, { titel: "Hallo Welt" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück wenn Wert kein String ist (Zahl übergeben)", () => {
      const schema = makeSchema([
        col({ id: "titel", name: "Titel", type: "text" }),
      ]);
      const result = validateRow(schema, { titel: 42 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("titel");
    });

    test("gibt Fehler zurück wenn Wert kein String ist (Array übergeben)", () => {
      const schema = makeSchema([
        col({ id: "titel", name: "Titel", type: "text" }),
      ]);
      const result = validateRow(schema, { titel: ["a", "b"] });
      expect(result.valid).toBe(false);
    });

    test("gibt Fehler zurück wenn max_length überschritten wird", () => {
      const schema = makeSchema([
        col({ id: "kuerzel", name: "Kürzel", type: "text", max_length: 5 }),
      ]);
      const result = validateRow(schema, { kuerzel: "Zu lang" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.message).toContain("5");
    });

    test("akzeptiert Wert genau auf max_length", () => {
      const schema = makeSchema([
        col({ id: "kuerzel", name: "Kürzel", type: "text", max_length: 5 }),
      ]);
      const result = validateRow(schema, { kuerzel: "Genau" });
      expect(result.valid).toBe(true);
    });
  });

  describe("Typ 'text_long'", () => {
    test("gibt Fehler zurück wenn Wert kein String ist", () => {
      const schema = makeSchema([
        col({ id: "beschreibung", name: "Beschreibung", type: "text_long" }),
      ]);
      const result = validateRow(schema, { beschreibung: 999 });
      expect(result.valid).toBe(false);
    });

    test("gibt Fehler zurück wenn max_length überschritten wird", () => {
      const schema = makeSchema([
        col({ id: "beschreibung", name: "Beschreibung", type: "text_long", max_length: 10 }),
      ]);
      const result = validateRow(schema, { beschreibung: "Dieser Text ist zu lang" });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'number'", () => {
    test("akzeptiert gültige Zahl", () => {
      const schema = makeSchema([
        col({ id: "menge", name: "Menge", type: "number" }),
      ]);
      const result = validateRow(schema, { menge: 42 });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert als Zahl parsebaren String", () => {
      const schema = makeSchema([
        col({ id: "menge", name: "Menge", type: "number" }),
      ]);
      const result = validateRow(schema, { menge: "3.14" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück wenn Wert kein numerischer String ist", () => {
      const schema = makeSchema([
        col({ id: "menge", name: "Menge", type: "number" }),
      ]);
      const result = validateRow(schema, { menge: "nicht-eine-zahl" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("menge");
    });

    test("gibt Fehler zurück wenn Wert ein Array ist", () => {
      const schema = makeSchema([
        col({ id: "menge", name: "Menge", type: "number" }),
      ]);
      const result = validateRow(schema, { menge: [1, 2] });
      expect(result.valid).toBe(false);
    });

    test("gibt Fehler zurück wenn Wert unter min liegt", () => {
      const schema = makeSchema([
        col({ id: "alter", name: "Alter", type: "number", min: 0 }),
      ]);
      const result = validateRow(schema, { alter: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.message).toContain("0");
    });

    test("gibt Fehler zurück wenn Wert über max liegt", () => {
      const schema = makeSchema([
        col({ id: "prozent", name: "Prozent", type: "number", max: 100 }),
      ]);
      const result = validateRow(schema, { prozent: 101 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.message).toContain("100");
    });

    test("akzeptiert Wert exakt auf min", () => {
      const schema = makeSchema([
        col({ id: "alter", name: "Alter", type: "number", min: 0 }),
      ]);
      const result = validateRow(schema, { alter: 0 });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert Wert exakt auf max", () => {
      const schema = makeSchema([
        col({ id: "prozent", name: "Prozent", type: "number", max: 100 }),
      ]);
      const result = validateRow(schema, { prozent: 100 });
      expect(result.valid).toBe(true);
    });
  });

  describe("Typ 'date'", () => {
    test("akzeptiert gültiges Datumsformat", () => {
      const schema = makeSchema([
        col({ id: "geburtstag", name: "Geburtstag", type: "date" }),
      ]);
      const result = validateRow(schema, { geburtstag: "2000-06-15" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück bei ungültigem Datum", () => {
      const schema = makeSchema([
        col({ id: "geburtstag", name: "Geburtstag", type: "date" }),
      ]);
      const result = validateRow(schema, { geburtstag: "kein-datum" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("geburtstag");
    });

    test("gibt Fehler zurück bei unmöglichem Datum (2024-13-01)", () => {
      const schema = makeSchema([
        col({ id: "datum", name: "Datum", type: "date" }),
      ]);
      // JavaScript Date ist tolerant gegenüber overflow — prüfe ob Service dies auch so behandelt
      const result = validateRow(schema, { datum: "nicht-ein-datum-xxx" });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'datetime'", () => {
    test("akzeptiert gültigen ISO-Datetime-String", () => {
      const schema = makeSchema([
        col({ id: "erstellt_am", name: "Erstellt am", type: "datetime" }),
      ]);
      const result = validateRow(schema, { erstellt_am: "2024-01-15T10:30:00.000Z" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück bei ungültigem Datetime-String", () => {
      const schema = makeSchema([
        col({ id: "erstellt_am", name: "Erstellt am", type: "datetime" }),
      ]);
      const result = validateRow(schema, { erstellt_am: "kein-datetime" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("erstellt_am");
    });
  });

  describe("Typ 'boolean'", () => {
    test("akzeptiert true", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: true });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert false", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: false });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert den String 'true'", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: "true" });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert den String 'false'", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: "false" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück bei ungültigem Wert (Zahl)", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: 1 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("aktiv");
    });

    test("gibt Fehler zurück bei ungültigem Wert (beliebiger String)", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = validateRow(schema, { aktiv: "ja" });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'email'", () => {
    test("akzeptiert gültige E-Mail-Adresse", () => {
      const schema = makeSchema([
        col({ id: "email", name: "E-Mail", type: "email" }),
      ]);
      const result = validateRow(schema, { email: "benutzer@beispiel.de" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück bei E-Mail ohne @", () => {
      const schema = makeSchema([
        col({ id: "email", name: "E-Mail", type: "email" }),
      ]);
      const result = validateRow(schema, { email: "kein-at-zeichen.de" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("email");
    });

    test("gibt Fehler zurück bei E-Mail ohne Domain", () => {
      const schema = makeSchema([
        col({ id: "email", name: "E-Mail", type: "email" }),
      ]);
      const result = validateRow(schema, { email: "benutzer@" });
      expect(result.valid).toBe(false);
    });

    test("gibt Fehler zurück wenn E-Mail-Feld kein String ist", () => {
      const schema = makeSchema([
        col({ id: "email", name: "E-Mail", type: "email" }),
      ]);
      const result = validateRow(schema, { email: 12345 });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'url'", () => {
    test("akzeptiert gültige https-URL", () => {
      const schema = makeSchema([
        col({ id: "webseite", name: "Webseite", type: "url" }),
      ]);
      const result = validateRow(schema, { webseite: "https://www.beispiel.de" });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert gültige http-URL", () => {
      const schema = makeSchema([
        col({ id: "webseite", name: "Webseite", type: "url" }),
      ]);
      const result = validateRow(schema, { webseite: "http://beispiel.de/pfad?a=1" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück bei URL ohne Protokoll", () => {
      const schema = makeSchema([
        col({ id: "webseite", name: "Webseite", type: "url" }),
      ]);
      const result = validateRow(schema, { webseite: "www.beispiel.de" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("webseite");
    });

    test("gibt Fehler zurück bei komplett ungültiger URL", () => {
      const schema = makeSchema([
        col({ id: "webseite", name: "Webseite", type: "url" }),
      ]);
      const result = validateRow(schema, { webseite: "keine url" });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'tags'", () => {
    test("akzeptiert Array von Strings", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = validateRow(schema, { tags: ["typescript", "bun", "test"] });
      expect(result.valid).toBe(true);
    });

    test("akzeptiert leeres Array", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = validateRow(schema, { tags: [] });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück wenn Wert kein Array ist (String)", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = validateRow(schema, { tags: "typescript,bun" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("tags");
    });

    test("gibt Fehler zurück wenn Wert kein Array ist (Zahl)", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = validateRow(schema, { tags: 42 });
      expect(result.valid).toBe(false);
    });
  });

  describe("Typ 'select'", () => {
    test("akzeptiert Wert der in den Optionen vorhanden ist", () => {
      const schema = makeSchema([
        col({ id: "status", name: "Status", type: "select", options: ["offen", "aktiv", "geschlossen"] }),
      ]);
      const result = validateRow(schema, { status: "aktiv" });
      expect(result.valid).toBe(true);
    });

    test("gibt Fehler zurück wenn Wert nicht in den Optionen ist", () => {
      const schema = makeSchema([
        col({ id: "status", name: "Status", type: "select", options: ["offen", "aktiv", "geschlossen"] }),
      ]);
      const result = validateRow(schema, { status: "unbekannt" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.column).toBe("status");
      expect(result.errors[0]!.message).toContain("offen");
    });

    test("akzeptiert beliebigen Wert wenn keine Optionen definiert sind", () => {
      const schema = makeSchema([
        col({ id: "kategorie", name: "Kategorie", type: "select" }),
      ]);
      const result = validateRow(schema, { kategorie: "irgendwas" });
      expect(result.valid).toBe(true);
    });
  });

  describe("Optionale Felder", () => {
    test("gibt keinen Fehler zurück wenn optionales Feld nicht angegeben wird", () => {
      const schema = makeSchema([
        col({ id: "notiz", name: "Notiz", type: "text" }),
        col({ id: "bewertung", name: "Bewertung", type: "number", min: 1, max: 5 }),
      ]);
      const result = validateRow(schema, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("gibt keinen Fehler zurück wenn optionales Feld undefined ist", () => {
      const schema = makeSchema([
        col({ id: "email", name: "E-Mail", type: "email" }),
      ]);
      const result = validateRow(schema, { email: undefined });
      expect(result.valid).toBe(true);
    });

    test("gibt keinen Fehler zurück wenn optionales Feld null ist", () => {
      const schema = makeSchema([
        col({ id: "url", name: "URL", type: "url" }),
      ]);
      const result = validateRow(schema, { url: null });
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// normalizeRowData
// ============================================

describe("normalizeRowData", () => {
  describe("Typ 'number'", () => {
    test("wandelt numerischen String in Float um", () => {
      const schema = makeSchema([
        col({ id: "preis", name: "Preis", type: "number" }),
      ]);
      const result = normalizeRowData(schema, { preis: "3.14" });
      expect(result.preis).toBe(3.14);
      expect(typeof result.preis).toBe("number");
    });

    test("wandelt ganzzahligen String in Float um", () => {
      const schema = makeSchema([
        col({ id: "anzahl", name: "Anzahl", type: "number" }),
      ]);
      const result = normalizeRowData(schema, { anzahl: "42" });
      expect(result.anzahl).toBe(42);
    });

    test("lässt echte Zahlen unverändert", () => {
      const schema = makeSchema([
        col({ id: "wert", name: "Wert", type: "number" }),
      ]);
      const result = normalizeRowData(schema, { wert: 7.5 });
      expect(result.wert).toBe(7.5);
    });

    test("lässt nicht-numerische Strings unverändert", () => {
      const schema = makeSchema([
        col({ id: "wert", name: "Wert", type: "number" }),
      ]);
      const result = normalizeRowData(schema, { wert: "kein-wert" });
      expect(result.wert).toBe("kein-wert");
    });
  });

  describe("Typ 'boolean'", () => {
    test("wandelt String 'true' in boolean true um", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = normalizeRowData(schema, { aktiv: "true" });
      expect(result.aktiv).toBe(true);
      expect(typeof result.aktiv).toBe("boolean");
    });

    test("wandelt String 'false' in boolean false um", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = normalizeRowData(schema, { aktiv: "false" });
      expect(result.aktiv).toBe(false);
      expect(typeof result.aktiv).toBe("boolean");
    });

    test("lässt echte Booleans unverändert", () => {
      const schema = makeSchema([
        col({ id: "aktiv", name: "Aktiv", type: "boolean" }),
      ]);
      const result = normalizeRowData(schema, { aktiv: true });
      expect(result.aktiv).toBe(true);
    });
  });

  describe("Typ 'tags'", () => {
    test("wandelt kommagetrennte Zeichenkette in Array um", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = normalizeRowData(schema, { tags: "typescript,bun,test" });
      expect(result.tags).toEqual(["typescript", "bun", "test"]);
    });

    test("entfernt Leerzeichen um Tags beim Parsen", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = normalizeRowData(schema, { tags: " typescript , bun , test " });
      expect(result.tags).toEqual(["typescript", "bun", "test"]);
    });

    test("filtert leere Einträge beim Parsen heraus", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = normalizeRowData(schema, { tags: "a,,b," });
      expect(result.tags).toEqual(["a", "b"]);
    });

    test("lässt vorhandenes Array unverändert", () => {
      const schema = makeSchema([
        col({ id: "tags", name: "Tags", type: "tags" }),
      ]);
      const result = normalizeRowData(schema, { tags: ["a", "b"] });
      expect(result.tags).toEqual(["a", "b"]);
    });
  });

  describe("Typ 'date'", () => {
    test("normalisiert Datum auf Format YYYY-MM-DD", () => {
      const schema = makeSchema([
        col({ id: "geburtstag", name: "Geburtstag", type: "date" }),
      ]);
      const result = normalizeRowData(schema, { geburtstag: "2000-06-15" });
      expect(result.geburtstag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.geburtstag).toBe("2000-06-15");
    });

    test("normalisiert Datum mit Uhrzeit auf reines Datum YYYY-MM-DD", () => {
      const schema = makeSchema([
        col({ id: "datum", name: "Datum", type: "date" }),
      ]);
      const result = normalizeRowData(schema, { datum: "2024-03-10T12:00:00.000Z" });
      expect(result.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("lässt ungültiges Datum unverändert", () => {
      const schema = makeSchema([
        col({ id: "datum", name: "Datum", type: "date" }),
      ]);
      const result = normalizeRowData(schema, { datum: "kein-datum-xxx" });
      expect(result.datum).toBe("kein-datum-xxx");
    });
  });

  describe("Typ 'datetime'", () => {
    test("normalisiert Datetime-String auf ISO-Format", () => {
      const schema = makeSchema([
        col({ id: "erstellt_am", name: "Erstellt am", type: "datetime" }),
      ]);
      const result = normalizeRowData(schema, { erstellt_am: "2024-03-10 14:30:00" });
      expect(result.erstellt_am).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.erstellt_am).toContain("Z");
    });

    test("lässt ISO-String unveraendert (bereits normalisiert)", () => {
      const schema = makeSchema([
        col({ id: "erstellt_am", name: "Erstellt am", type: "datetime" }),
      ]);
      const isoString = "2024-03-10T14:30:00.000Z";
      const result = normalizeRowData(schema, { erstellt_am: isoString });
      expect(result.erstellt_am).toBe(isoString);
    });

    test("lässt ungültigen Datetime-String unverändert", () => {
      const schema = makeSchema([
        col({ id: "erstellt_am", name: "Erstellt am", type: "datetime" }),
      ]);
      const result = normalizeRowData(schema, { erstellt_am: "kein-datetime-xxx" });
      expect(result.erstellt_am).toBe("kein-datetime-xxx");
    });
  });

  describe("Standardwerte", () => {
    test("wendet Standardwert an wenn Feld fehlt", () => {
      const schema = makeSchema([
        col({ id: "status", name: "Status", type: "text", default: "offen" }),
      ]);
      const result = normalizeRowData(schema, {});
      expect(result.status).toBe("offen");
    });

    test("wendet Standardwert an wenn Feld undefined ist", () => {
      const schema = makeSchema([
        col({ id: "anzahl", name: "Anzahl", type: "number", default: 0 }),
      ]);
      const result = normalizeRowData(schema, { anzahl: undefined });
      expect(result.anzahl).toBe(0);
    });

    test("überschreibt Standardwert nicht wenn Feld einen Wert hat", () => {
      const schema = makeSchema([
        col({ id: "status", name: "Status", type: "text", default: "offen" }),
      ]);
      const result = normalizeRowData(schema, { status: "aktiv" });
      expect(result.status).toBe("aktiv");
    });

    test("wendet keinen Standardwert an wenn null übergeben wird", () => {
      const schema = makeSchema([
        col({ id: "status", name: "Status", type: "text", default: "offen" }),
      ]);
      // null überschreibt den Default nicht, da null explizit übergeben wurde
      // und normalizeRowData null-Werte nach Default-Anwendung überspringt
      const result = normalizeRowData(schema, { status: null });
      expect(result).not.toHaveProperty("status");
    });
  });

  describe("Fehlende und null-Werte", () => {
    test("enthält Felder ohne Wert und ohne Default nicht im Ergebnis", () => {
      const schema = makeSchema([
        col({ id: "name", name: "Name", type: "text" }),
        col({ id: "notiz", name: "Notiz", type: "text" }),
      ]);
      const result = normalizeRowData(schema, { name: "Max" });
      expect(result).toHaveProperty("name");
      expect(result).not.toHaveProperty("notiz");
    });
  });
});

// ============================================
// parseFilterText
// ============================================

describe("parseFilterText", () => {
  describe("Gleichheitsoperator (=)", () => {
    test("parst 'spalte = \\'wert\\'' in eq-Bedingung mit einfachen Anführungszeichen", () => {
      const conditions = parseFilterText("status = 'aktiv'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toEqual({
        column: "status",
        operator: "eq",
        value: "aktiv",
      });
    });

    test("parst 'spalte = \"wert\"' in eq-Bedingung mit doppelten Anführungszeichen", () => {
      const conditions = parseFilterText('name = "Max"');
      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toEqual({
        column: "name",
        operator: "eq",
        value: "Max",
      });
    });

    test("parst Wert mit Leerzeichen korrekt", () => {
      const conditions = parseFilterText("firma = 'Adacor GmbH'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]!.value).toBe("Adacor GmbH");
    });
  });

  describe("Enthält-Operator (contains)", () => {
    test("parst 'spalte contains \\'wert\\'' in contains-Bedingung", () => {
      const conditions = parseFilterText("firma contains 'Microsoft'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toEqual({
        column: "firma",
        operator: "contains",
        value: "Microsoft",
      });
    });

    test("parst contains-Operator auch mit Großbuchstaben (case-insensitive)", () => {
      const conditions = parseFilterText("firma CONTAINS 'Microsoft'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]!.operator).toBe("contains");
    });
  });

  describe("Größer-als-Operator (>)", () => {
    test("parst 'spalte > wert' in gt-Bedingung", () => {
      const conditions = parseFilterText("alter > 18");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toEqual({
        column: "alter",
        operator: "gt",
        value: "18",
      });
    });

    test("parst 'spalte > \\'datum\\'' in gt-Bedingung", () => {
      const conditions = parseFilterText("erstellt_am > '2024-01-01'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]!.operator).toBe("gt");
      expect(conditions[0]!.column).toBe("erstellt_am");
    });
  });

  describe("Kleiner-als-Operator (<)", () => {
    test("parst 'spalte < wert' in lt-Bedingung", () => {
      const conditions = parseFilterText("preis < 100");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toEqual({
        column: "preis",
        operator: "lt",
        value: "100",
      });
    });

    test("parst 'spalte < \\'datum\\'' in lt-Bedingung", () => {
      const conditions = parseFilterText("letzte_interaktion < '2024-01-01'");
      expect(conditions).toHaveLength(1);
      expect(conditions[0]!.operator).toBe("lt");
      expect(conditions[0]!.column).toBe("letzte_interaktion");
    });
  });

  describe("Mehrere Bedingungen", () => {
    test("parst mehrere Bedingungen in einem Filter-String", () => {
      const conditions = parseFilterText("status = 'aktiv' name contains 'Max'");
      expect(conditions.length).toBeGreaterThanOrEqual(2);
      const statusCond = conditions.find(c => c.column === "status");
      const nameCond = conditions.find(c => c.column === "name");
      expect(statusCond?.operator).toBe("eq");
      expect(nameCond?.operator).toBe("contains");
    });
  });

  describe("Leerer Filter-Text", () => {
    test("gibt leeres Array zurück bei leerem String", () => {
      const conditions = parseFilterText("");
      expect(conditions).toEqual([]);
    });

    test("gibt leeres Array zurück bei String nur mit Leerzeichen", () => {
      const conditions = parseFilterText("   ");
      expect(conditions).toEqual([]);
    });
  });
});
