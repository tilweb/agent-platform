/**
 * Tests fuer ExportDocumentTool (backend/src/tools/special/export-document.ts)
 *
 * Strategie:
 *  - mock.module() fuer '../../services/documentGenerator' damit generateDocument
 *    einen kontrollierten Buffer zurueckgibt und keine echten Generatoren laufen.
 *  - mock.module() fuer '../../utils/paths' damit EXPORTS_DIR auf /tmp zeigt.
 *  - mock.module() fuer 'fs/promises' (writeFile, mkdir) und 'fs' (existsSync)
 *    damit kein echter Dateisystemzugriff stattfindet.
 *
 * Wichtig: Alle mock.module()-Aufrufe muessen VOR dem dynamischen Import des
 * Moduls unter Test stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Pfade in mock.module() sind relativ zur Testdatei (nicht zum Modul unter Test).
 * Das Modul unter Test liegt in src/tools/special/, die Testdatei in
 * src/tools/special/__tests__/, daher zeigen die Pfade eine Ebene hoeher.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock-State fuer dokumentGenerator — mutable, damit beforeEach ihn zuruecksetzen kann
// ---------------------------------------------------------------------------

const generateDocMockState = {
  shouldThrow: false,
  throwMessage: "Generierungsfehler",
  buffer: Buffer.from("fake-document-content"),
  lastDocumentData: null as any,
  lastFormat: null as string | null,
};

mock.module("../../../services/documentGenerator", () => ({
  generateDocument: async (documentData: any, format: string) => {
    generateDocMockState.lastDocumentData = documentData;
    generateDocMockState.lastFormat = format;
    if (generateDocMockState.shouldThrow) {
      throw new Error(generateDocMockState.throwMessage);
    }
    return generateDocMockState.buffer;
  },
}));

// ---------------------------------------------------------------------------
// Mock: paths — EXPORTS_DIR auf /tmp setzen
// ---------------------------------------------------------------------------

mock.module("../../../utils/paths", () => ({
  EXPORTS_DIR: "/tmp/export-document-test-exports",
}));

// ---------------------------------------------------------------------------
// Mock-State fuer fs/promises (writeFile, mkdir)
// ---------------------------------------------------------------------------

const fsMockState = {
  writeFileCalled: false,
  writeFileArgs: null as { filepath: string; buffer: Buffer } | null,
  mkdirCalled: false,
  writeFileShouldThrow: false,
};

mock.module("fs/promises", () => ({
  writeFile: async (filepath: string, buffer: Buffer) => {
    fsMockState.writeFileCalled = true;
    fsMockState.writeFileArgs = { filepath, buffer };
    if (fsMockState.writeFileShouldThrow) {
      throw new Error("Schreibfehler");
    }
  },
  mkdir: async (_path: string, _opts?: any) => {
    fsMockState.mkdirCalled = true;
  },
}));

// ---------------------------------------------------------------------------
// Mock-State fuer fs (existsSync)
// ---------------------------------------------------------------------------

const fsExistsMockState = {
  dirExists: true,
};

mock.module("fs", () => ({
  existsSync: (_path: string) => fsExistsMockState.dirExists,
}));

// ---------------------------------------------------------------------------
// Import des Moduls unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { ExportDocumentTool } = await import("../export-document");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Erstellt eine minimale gueltige Section-Fixture. */
function makeSection(overrides: Partial<{ title: string; type: string; content: string }> = {}) {
  return {
    title: "Einleitung",
    type: "text",
    content: "Dieser Text beschreibt den Inhalt.",
    ...overrides,
  };
}

/** Erstellt gueltige minimale Argumente fuer execute(). */
function makeArgs(overrides: Record<string, any> = {}) {
  return {
    title: "Quartalsbericht",
    format: "pdf" as const,
    sections: [makeSection()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // generateDocument-Mock zuruecksetzen
  generateDocMockState.shouldThrow = false;
  generateDocMockState.throwMessage = "Generierungsfehler";
  generateDocMockState.buffer = Buffer.from("fake-document-content");
  generateDocMockState.lastDocumentData = null;
  generateDocMockState.lastFormat = null;

  // fs/promises-Mock zuruecksetzen
  fsMockState.writeFileCalled = false;
  fsMockState.writeFileArgs = null;
  fsMockState.mkdirCalled = false;
  fsMockState.writeFileShouldThrow = false;

  // fs-Mock zuruecksetzen (Verzeichnis existiert standardmaessig)
  fsExistsMockState.dirExists = true;
});

// ---------------------------------------------------------------------------
// getDefinition()
// ---------------------------------------------------------------------------

describe("getDefinition()", () => {
  test("gibt type 'function' zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getDefinition().type).toBe("function");
  });

  test("gibt function.name als 'export_document' zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getDefinition().function.name).toBe("export_document");
  });

  test("gibt eine nicht-leere function.description zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getDefinition().function.description.length).toBeGreaterThan(0);
  });

  test("parameters.type ist 'object'", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getDefinition().function.parameters.type).toBe("object");
  });

  test("required enthaelt 'title', 'format' und 'sections'", () => {
    const tool = new ExportDocumentTool();
    const required = tool.getDefinition().function.parameters.required;
    expect(required).toContain("title");
    expect(required).toContain("format");
    expect(required).toContain("sections");
  });

  test("parameters.properties enthaelt 'title', 'format', 'sections' und 'metadata'", () => {
    const tool = new ExportDocumentTool();
    const props = tool.getDefinition().function.parameters.properties;
    expect(props).toHaveProperty("title");
    expect(props).toHaveProperty("format");
    expect(props).toHaveProperty("sections");
    expect(props).toHaveProperty("metadata");
  });

  test("format-Parameter hat enum mit 'xlsx', 'pdf', 'docx'", () => {
    const tool = new ExportDocumentTool();
    const formatProp = tool.getDefinition().function.parameters.properties["format"] as any;
    expect(formatProp.enum).toEqual(["xlsx", "pdf", "docx"]);
  });

  test("sections-items.required enthaelt 'title', 'type' und 'content'", () => {
    const tool = new ExportDocumentTool();
    const sectionsProp = tool.getDefinition().function.parameters.properties["sections"] as any;
    expect(sectionsProp.items.required).toContain("title");
    expect(sectionsProp.items.required).toContain("type");
    expect(sectionsProp.items.required).toContain("content");
  });
});

// ---------------------------------------------------------------------------
// getMetadata()
// ---------------------------------------------------------------------------

describe("getMetadata()", () => {
  test("gibt name als 'export_document' zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getMetadata().name).toBe("export_document");
  });

  test("gibt type als 'local' zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getMetadata().type).toBe("local");
  });

  test("gibt category als 'documents' zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getMetadata().category).toBe("documents");
  });

  test("gibt eine nicht-leere description zurueck", () => {
    const tool = new ExportDocumentTool();
    expect(tool.getMetadata().description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// isAvailable()
// ---------------------------------------------------------------------------

describe("isAvailable()", () => {
  test("gibt immer true zurueck", async () => {
    const tool = new ExportDocumentTool();
    expect(await tool.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// execute() — Validierung: Titel
// ---------------------------------------------------------------------------

describe("execute() — Validierung: Titel", () => {
  test("gibt Fehler zurueck wenn title leer ist", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "" }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
    expect(parsed.error.length).toBeGreaterThan(0);
  });

  test("gibt Fehler zurueck wenn title nur Leerzeichen enthaelt", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "   " }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("ruft generateDocument nicht auf wenn Titel fehlt", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs({ title: "" }));
    expect(generateDocMockState.lastFormat).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// execute() — Validierung: Format
// ---------------------------------------------------------------------------

describe("execute() — Validierung: Format", () => {
  test("gibt Fehler zurueck fuer unbekanntes Format", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ format: "rtf" as any }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("xlsx");
    expect(parsed.error).toContain("pdf");
    expect(parsed.error).toContain("docx");
  });

  test("gibt Fehler zurueck fuer leeren Format-String", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ format: "" as any }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt Fehler zurueck fuer Format 'html' (nicht unterstuetzt)", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ format: "html" as any }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("ruft generateDocument nicht auf wenn Format ungueltig ist", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs({ format: "txt" as any }));
    expect(generateDocMockState.lastFormat).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// execute() — Validierung: Sections
// ---------------------------------------------------------------------------

describe("execute() — Validierung: Sections", () => {
  test("gibt Fehler zurueck wenn sections ein leeres Array ist", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ sections: [] }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("gibt Fehler zurueck wenn sections fehlt (undefined)", async () => {
    const tool = new ExportDocumentTool();
    const args = makeArgs();
    delete (args as any).sections;
    const result = await tool.execute(args as any);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt Fehler zurueck wenn sections kein Array ist", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ sections: "kein array" as any }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt Fehler zurueck wenn eine Section keinen title hat", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(
      makeArgs({ sections: [makeSection({ title: "" })] })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("title");
  });

  test("gibt Fehler zurueck wenn eine Section keinen type hat", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(
      makeArgs({ sections: [makeSection({ type: "" })] })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt Fehler zurueck wenn eine Section keinen content hat (undefined)", async () => {
    const tool = new ExportDocumentTool();
    const section = { title: "Test", type: "text" }; // content fehlt absichtlich
    const result = await tool.execute(makeArgs({ sections: [section] as any }));
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("content");
  });

  test("gibt Fehler zurueck fuer ungueltigen Section-Typ 'image'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(
      makeArgs({ sections: [makeSection({ type: "image" })] })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("image");
  });

  test("gibt Fehler zurueck fuer ungueltigen Section-Typ 'chart'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(
      makeArgs({ sections: [makeSection({ type: "chart" })] })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("erlaubt alle gueltigen Section-Typen: text, table, list, keyvalue", async () => {
    const tool = new ExportDocumentTool();
    for (const type of ["text", "table", "list", "keyvalue"]) {
      const result = await tool.execute(
        makeArgs({ sections: [makeSection({ type })] })
      );
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    }
  });

  test("gibt Fehler zurueck wenn eine von mehreren Sections einen ungueltigen Typ hat", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(
      makeArgs({
        sections: [
          makeSection({ type: "text" }),
          makeSection({ type: "ungueltig" }),
        ],
      })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// execute() — Erfolgs-Pfad
// ---------------------------------------------------------------------------

describe("execute() — Erfolgs-Pfad", () => {
  test("gibt success:true zurueck bei gueltigen Argumenten", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  test("gibt type 'exported_document' zurueck", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe("exported_document");
  });

  test("gibt den getrimten Titel im Ergebnis zurueck", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "  Bericht  " }));
    const parsed = JSON.parse(result);
    expect(parsed.title).toBe("Bericht");
  });

  test("gibt das verwendete Format im Ergebnis zurueck", async () => {
    const tool = new ExportDocumentTool();
    for (const format of ["xlsx", "pdf", "docx"] as const) {
      const result = await tool.execute(makeArgs({ format }));
      const parsed = JSON.parse(result);
      expect(parsed.format).toBe(format);
    }
  });

  test("downloadUrl beginnt mit '/api/exports/download/'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.downloadUrl).toStartWith("/api/exports/download/");
  });

  test("filename enthaelt den slugifizierten Titel", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Mein Bericht" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("mein-bericht");
  });

  test("filename enthaelt einen Timestamp (lange Zahlenfolge vor der Extension)", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    // Filename-Format: {slug}_{timestamp}.{ext} — Timestamp ist mindestens 10 Ziffern
    expect(parsed.filename).toMatch(/_\d{10,}\./);
  });

  test("filename endet mit der korrekten Dateiendung fuer das Format", async () => {
    const tool = new ExportDocumentTool();
    for (const format of ["xlsx", "pdf", "docx"] as const) {
      const result = await tool.execute(makeArgs({ format }));
      const parsed = JSON.parse(result);
      expect(parsed.filename).toEndWith(`.${format}`);
    }
  });

  test("filename stimmt mit dem Dateinamen in der downloadUrl ueberein", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.downloadUrl).toEndWith(parsed.filename);
  });

  test("ruft generateDocument mit dem korrekten Format auf", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs({ format: "xlsx" }));
    expect(generateDocMockState.lastFormat).toBe("xlsx");
  });

  test("ruft generateDocument mit dem korrekten Titel auf", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs({ title: "Jahresbericht 2025" }));
    expect(generateDocMockState.lastDocumentData.title).toBe("Jahresbericht 2025");
  });

  test("ruft generateDocument mit den uebergebenen Sections auf", async () => {
    const tool = new ExportDocumentTool();
    const sections = [
      makeSection({ title: "Abschnitt 1", type: "text", content: "Inhalt 1" }),
      makeSection({ title: "Abschnitt 2", type: "list", content: "Inhalt 2" }),
    ];
    await tool.execute(makeArgs({ sections }));
    expect(generateDocMockState.lastDocumentData.sections).toHaveLength(2);
    expect(generateDocMockState.lastDocumentData.sections[0].title).toBe("Abschnitt 1");
    expect(generateDocMockState.lastDocumentData.sections[1].title).toBe("Abschnitt 2");
  });

  test("DocumentData.metadata enthaelt 'Erstellt'-Feld", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs());
    expect(generateDocMockState.lastDocumentData.metadata).toHaveProperty("Erstellt");
  });

  test("optionale metadata-Argumente werden in DocumentData.metadata uebernommen", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs({ metadata: { Autor: "Max Muster", Abteilung: "IT" } }));
    expect(generateDocMockState.lastDocumentData.metadata.Autor).toBe("Max Muster");
    expect(generateDocMockState.lastDocumentData.metadata.Abteilung).toBe("IT");
  });

  test("schreibt den Buffer in eine Datei (writeFile wird aufgerufen)", async () => {
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs());
    expect(fsMockState.writeFileCalled).toBe(true);
  });

  test("schreibt den Buffer aus generateDocument in die Datei", async () => {
    generateDocMockState.buffer = Buffer.from("custom-buffer-content");
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs());
    expect(fsMockState.writeFileArgs?.buffer).toEqual(Buffer.from("custom-buffer-content"));
  });

  test("erstellt das Exports-Verzeichnis wenn es nicht existiert", async () => {
    fsExistsMockState.dirExists = false;
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs());
    expect(fsMockState.mkdirCalled).toBe(true);
  });

  test("erstellt das Exports-Verzeichnis nicht wenn es bereits existiert", async () => {
    fsExistsMockState.dirExists = true;
    const tool = new ExportDocumentTool();
    await tool.execute(makeArgs());
    expect(fsMockState.mkdirCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// execute() — slugify: Deutsche Umlaute
// ---------------------------------------------------------------------------

describe("execute() — slugify: Deutsche Umlaute", () => {
  test("konvertiert 'ae' fuer 'ä'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Bärenmarkt" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("baerenmarkt");
  });

  test("konvertiert 'oe' fuer 'ö'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Börse" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("boerse");
  });

  test("konvertiert 'ue' fuer 'ü'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Übersicht" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("uebersicht");
  });

  test("konvertiert 'ss' fuer 'ß'", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Straße" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("strasse");
  });

  test("konvertiert alle Umlaute kombiniert (Größenübersicht)", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Größenübersicht" }));
    const parsed = JSON.parse(result);
    // ö→oe, ß→ss, ü→ue
    expect(parsed.filename).toContain("groessenuebers");
  });
});

// ---------------------------------------------------------------------------
// execute() — slugify: Sonderzeichen und Leerzeichen
// ---------------------------------------------------------------------------

describe("execute() — slugify: Sonderzeichen und Leerzeichen", () => {
  test("entfernt Sonderzeichen aus dem Dateinamen", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Bericht (2025)!" }));
    const parsed = JSON.parse(result);
    // Klammern und Ausrufezeichen sollen nicht im Dateinamen erscheinen
    expect(parsed.filename).not.toContain("(");
    expect(parsed.filename).not.toContain(")");
    expect(parsed.filename).not.toContain("!");
  });

  test("ersetzt Leerzeichen durch Bindestriche", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Mein Jahres Bericht" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("mein-jahres-bericht");
  });

  test("kollabiert mehrere Leerzeichen zu einem Bindestrich", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Bericht  2025" }));
    const parsed = JSON.parse(result);
    // Doppeltes Leerzeichen wird zu einem Bindestrich
    expect(parsed.filename).toContain("bericht-2025");
    expect(parsed.filename).not.toContain("--");
  });

  test("entfernt Sonderzeichen wie @, #, $, %", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Bericht@2025#Final" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).not.toContain("@");
    expect(parsed.filename).not.toContain("#");
  });

  test("konvertiert Titel zu Kleinbuchstaben", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "GROSSBUCHSTABEN" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("grossbuchstaben");
  });
});

// ---------------------------------------------------------------------------
// execute() — slugify: Laengenbegrenzung und Sonderfaelle
// ---------------------------------------------------------------------------

describe("execute() — slugify: Laengenbegrenzung und Sonderfaelle", () => {
  test("kuerzt den Slug auf maximal 50 Zeichen (ohne Timestamp und Extension)", async () => {
    const tool = new ExportDocumentTool();
    const longTitle = "a".repeat(100);
    const result = await tool.execute(makeArgs({ title: longTitle }));
    const parsed = JSON.parse(result);
    // filename = slug + "_" + timestamp + "." + format
    // Der Slug-Anteil (vor dem ersten "_") darf max 50 Zeichen lang sein
    const slugPart = parsed.filename.split("_")[0] as string;
    expect(slugPart.length).toBeLessThanOrEqual(50);
  });

  test("entfernt abschliessenden Bindestrich nach dem Trunkieren", async () => {
    const tool = new ExportDocumentTool();
    // 49 'a' + Leerzeichen + 'b' => nach Trunkierung auf 50 wuerde '-b' abgeschnitten
    // und '-' am Ende wuerde dann entfernt
    const title = "a".repeat(49) + " b extra";
    const result = await tool.execute(makeArgs({ title }));
    const parsed = JSON.parse(result);
    const slugPart = parsed.filename.split("_")[0] as string;
    expect(slugPart).not.toEndWith("-");
  });

  test("verwendet 'dokument' als Fallback-Slug wenn der Titel keine erlaubten Zeichen hat", async () => {
    const tool = new ExportDocumentTool();
    // Titel nur aus Sonderzeichen — slug() liefert leeren String
    const result = await tool.execute(makeArgs({ title: "!!!" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).toContain("dokument");
  });

  test("filename enthaelt keine Leerzeichen", async () => {
    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs({ title: "Bericht Mit Leerzeichen" }));
    const parsed = JSON.parse(result);
    expect(parsed.filename).not.toContain(" ");
  });
});

// ---------------------------------------------------------------------------
// execute() — Fehlerbehandlung
// ---------------------------------------------------------------------------

describe("execute() — Fehlerbehandlung", () => {
  test("gibt success:false zurueck wenn generateDocument einen Fehler wirft", async () => {
    generateDocMockState.shouldThrow = true;
    generateDocMockState.throwMessage = "PDF-Rendering fehlgeschlagen";

    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt die Fehlermeldung von generateDocument im error-Feld zurueck", async () => {
    generateDocMockState.shouldThrow = true;
    generateDocMockState.throwMessage = "Speicher voll";

    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("Speicher voll");
  });

  test("gibt Fallback-Fehlermeldung zurueck wenn geworfener Fehler keine message hat", async () => {
    generateDocMockState.shouldThrow = true;
    // Ueberschreibe generateDocument mit einem Fehler ohne message
    mock.module("../../../services/documentGenerator", () => ({
      generateDocument: async () => {
        throw "Kein Error-Objekt";
      },
    }));

    const { ExportDocumentTool: FreshTool } = await import("../export-document");
    const tool = new FreshTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
    expect(parsed.error.length).toBeGreaterThan(0);
  });

  test("gibt success:false zurueck wenn writeFile einen Fehler wirft", async () => {
    fsMockState.writeFileShouldThrow = true;

    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test("gibt type und downloadUrl nicht zurueck im Fehlerfall", async () => {
    generateDocMockState.shouldThrow = true;
    generateDocMockState.throwMessage = "Fehler";

    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    const parsed = JSON.parse(result);
    expect(parsed.type).toBeUndefined();
    expect(parsed.downloadUrl).toBeUndefined();
  });

  test("gibt gueltiges JSON zurueck auch wenn generateDocument wirft", async () => {
    generateDocMockState.shouldThrow = true;
    generateDocMockState.throwMessage = "Fehler";

    const tool = new ExportDocumentTool();
    const result = await tool.execute(makeArgs());
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// name und type Properties
// ---------------------------------------------------------------------------

describe("name und type Properties", () => {
  test("tool.name ist 'export_document'", () => {
    const tool = new ExportDocumentTool();
    expect(tool.name).toBe("export_document");
  });

  test("tool.type ist 'local'", () => {
    const tool = new ExportDocumentTool();
    expect(tool.type).toBe("local");
  });
});
