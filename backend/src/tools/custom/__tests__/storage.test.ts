/**
 * Tests for Custom Tool Storage (backend/src/tools/custom/storage.ts)
 *
 * Das Dateisystem-I/O laeuft gegen ein echtes temporaeres Verzeichnis unter
 * /tmp. CUSTOM_TOOLS_DIR wird per mock.module() auf dieses Verzeichnis
 * umgeleitet. Der Mock muss VOR dem Import des Moduls registriert sein.
 *
 * clearCustomToolsCache() wird in beforeEach aufgerufen, damit der In-Memory-
 * Cache zwischen den Tests zurueckgesetzt wird und jeder Test von einem
 * sauberen Zustand ausgeht.
 */

import { test, expect, describe, beforeEach, afterAll, mock } from "bun:test";
import { rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { CustomToolConfig } from "../types";

// ---------------------------------------------------------------------------
// Testverzeichnis — eindeutig pro Testlauf (kein Konflikt mit parallelen Laeufen)
// ---------------------------------------------------------------------------

const TEST_DIR = `/tmp/custom-tools-test-${process.pid}`;

// ---------------------------------------------------------------------------
// Modul-Mock — VOR dem Import des Moduls unter Test registrieren.
// Nur CUSTOM_TOOLS_DIR wird umgeleitet; alle anderen Pfade bleiben real.
// ---------------------------------------------------------------------------

mock.module("../../../utils/paths", () => ({
  CUSTOM_TOOLS_DIR: TEST_DIR,
  DATA_DIR: TEST_DIR,
}));

// ---------------------------------------------------------------------------
// Import des Moduls unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const {
  loadCustomTools,
  getCustomTool,
  saveCustomTool,
  createCustomTool,
  updateCustomTool,
  deleteCustomTool,
  clearCustomToolsCache,
  customToolExists,
} = await import("../storage");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Erstellt eine minimale, gueltige CustomToolConfig-Fixture. */
function makeTool(overrides: Partial<CustomToolConfig> = {}): CustomToolConfig {
  return {
    id: "test-tool",
    name: "Test Tool",
    description: "Ein einfaches Test-Tool",
    enabled: true,
    endpoint: "https://api.example.com/test",
    method: "GET",
    parameters: [],
    auth: { type: "none" },
    responseType: "json",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Cache leeren, damit jeder Test mit einem leeren In-Memory-Zustand startet
  clearCustomToolsCache();
  // Testverzeichnis komplett leeren und neu erstellen
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// clearCustomToolsCache()
// ---------------------------------------------------------------------------

describe("clearCustomToolsCache()", () => {
  test("zwingt den naechsten loadCustomTools-Aufruf, vom Dateisystem zu lesen", async () => {
    // Erst laden (fuellt den Cache)
    await loadCustomTools();

    // Neue Datei schreiben, waehrend Cache noch besteht
    const tool = makeTool({ id: "new-after-cache" });
    await writeFile(
      join(TEST_DIR, "new-after-cache.json"),
      JSON.stringify(tool),
      "utf-8"
    );

    // Ohne Cache-Reset wuerde das Tool nicht erscheinen
    clearCustomToolsCache();

    const tools = await loadCustomTools();
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("new-after-cache");
  });

  test("kann mehrfach hintereinander aufgerufen werden ohne Fehler", () => {
    expect(() => {
      clearCustomToolsCache();
      clearCustomToolsCache();
      clearCustomToolsCache();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadCustomTools()
// ---------------------------------------------------------------------------

describe("loadCustomTools()", () => {
  test("gibt ein leeres Array zurueck wenn das Verzeichnis leer ist", async () => {
    const tools = await loadCustomTools();
    expect(tools).toEqual([]);
  });

  test("laedt eine einzelne gespeicherte Tool-Datei", async () => {
    const tool = makeTool({ id: "single-tool" });
    await writeFile(
      join(TEST_DIR, "single-tool.json"),
      JSON.stringify(tool),
      "utf-8"
    );

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.id).toBe("single-tool");
  });

  test("laedt mehrere Tool-Dateien", async () => {
    for (const id of ["tool-alpha", "tool-beta", "tool-gamma"]) {
      const t = makeTool({ id, name: id });
      await writeFile(join(TEST_DIR, `${id}.json`), JSON.stringify(t), "utf-8");
    }

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(3);
    const ids = tools.map((t) => t.id).sort();
    expect(ids).toEqual(["tool-alpha", "tool-beta", "tool-gamma"]);
  });

  test("ueberspringt Dateien die nicht auf .json enden", async () => {
    const tool = makeTool({ id: "real-tool" });
    await writeFile(join(TEST_DIR, "real-tool.json"), JSON.stringify(tool), "utf-8");
    await writeFile(join(TEST_DIR, "ignore-me.yaml"), "id: ignored", "utf-8");
    await writeFile(join(TEST_DIR, "ignore-me.txt"), "plain text", "utf-8");

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.id).toBe("real-tool");
  });

  test("ueberspringt JSON-Dateien ohne Pflichtfeld 'id'", async () => {
    await writeFile(
      join(TEST_DIR, "missing-id.json"),
      JSON.stringify({ name: "Kein ID", endpoint: "https://x.com", enabled: true }),
      "utf-8"
    );

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(0);
  });

  test("ueberspringt JSON-Dateien ohne Pflichtfeld 'name'", async () => {
    await writeFile(
      join(TEST_DIR, "missing-name.json"),
      JSON.stringify({ id: "no-name", endpoint: "https://x.com", enabled: true }),
      "utf-8"
    );

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(0);
  });

  test("ueberspringt JSON-Dateien ohne Pflichtfeld 'endpoint'", async () => {
    await writeFile(
      join(TEST_DIR, "missing-endpoint.json"),
      JSON.stringify({ id: "no-endpoint", name: "Kein Endpoint", enabled: true }),
      "utf-8"
    );

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(0);
  });

  test("ueberspringt ungueltige JSON-Dateien ohne Fehler zu werfen", async () => {
    const validTool = makeTool({ id: "valid-tool" });
    await writeFile(join(TEST_DIR, "valid-tool.json"), JSON.stringify(validTool), "utf-8");
    await writeFile(join(TEST_DIR, "broken.json"), "{ dies ist kein gueltiges json", "utf-8");

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.id).toBe("valid-tool");
  });

  test("gibt gecachte Daten beim zweiten Aufruf zurueck ohne Dateisystem zu lesen", async () => {
    const tool = makeTool({ id: "cached-tool" });
    await writeFile(join(TEST_DIR, "cached-tool.json"), JSON.stringify(tool), "utf-8");

    // Erster Aufruf befuellt den Cache
    const first = await loadCustomTools();
    expect(first).toHaveLength(1);

    // Eine weitere Datei zum Verzeichnis hinzufuegen
    const extra = makeTool({ id: "extra-tool" });
    await writeFile(join(TEST_DIR, "extra-tool.json"), JSON.stringify(extra), "utf-8");

    // Zweiter Aufruf liefert noch den Cache-Stand (nur 1 Tool)
    const second = await loadCustomTools();
    expect(second).toHaveLength(1);
  });

  test("laedt alle Felder eines Tools korrekt", async () => {
    const tool = makeTool({
      id: "full-tool",
      name: "Vollstaendiges Tool",
      description: "Alle Felder gesetzt",
      category: "integration",
      enabled: false,
      endpoint: "https://api.example.com/v2",
      method: "POST",
      headers: { "X-Custom": "value" },
      timeout: 5000,
      parameters: [
        {
          name: "query",
          type: "string",
          description: "Suchanfrage",
          required: true,
          location: "query",
        },
      ],
      auth: { type: "bearer", envVar: "MY_API_KEY" },
      responseType: "text",
      jsonPath: "$.data",
    });
    await writeFile(join(TEST_DIR, "full-tool.json"), JSON.stringify(tool), "utf-8");

    const tools = await loadCustomTools();
    const loaded = tools[0]!;

    expect(loaded.id).toBe("full-tool");
    expect(loaded.name).toBe("Vollstaendiges Tool");
    expect(loaded.category).toBe("integration");
    expect(loaded.enabled).toBe(false);
    expect(loaded.method).toBe("POST");
    expect(loaded.timeout).toBe(5000);
    expect(loaded.parameters).toHaveLength(1);
    expect(loaded.auth.type).toBe("bearer");
    expect(loaded.responseType).toBe("text");
    expect(loaded.jsonPath).toBe("$.data");
  });
});

// ---------------------------------------------------------------------------
// getCustomTool()
// ---------------------------------------------------------------------------

describe("getCustomTool()", () => {
  test("gibt null zurueck wenn das Tool nicht existiert", async () => {
    const result = await getCustomTool("nonexistent-tool");
    expect(result).toBeNull();
  });

  test("laedt ein vorhandenes Tool vom Dateisystem wenn kein Cache vorhanden", async () => {
    const tool = makeTool({ id: "get-test-tool" });
    await writeFile(join(TEST_DIR, "get-test-tool.json"), JSON.stringify(tool), "utf-8");

    const result = await getCustomTool("get-test-tool");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("get-test-tool");
    expect(result!.name).toBe("Test Tool");
  });

  test("liest aus dem Cache wenn er besteht", async () => {
    // Cache befuellen via loadCustomTools
    const tool = makeTool({ id: "cached-get-tool" });
    await writeFile(join(TEST_DIR, "cached-get-tool.json"), JSON.stringify(tool), "utf-8");
    await loadCustomTools();

    // Datei loeschen — Tool muss trotzdem aus dem Cache kommen
    await rm(join(TEST_DIR, "cached-get-tool.json"));

    const result = await getCustomTool("cached-get-tool");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cached-get-tool");
  });

  test("gibt null zurueck fuer eine unbekannte ID im Cache", async () => {
    // Cache befuellen
    await loadCustomTools();

    const result = await getCustomTool("totally-unknown");
    expect(result).toBeNull();
  });

  test("gibt alle Felder des Tools vollstaendig zurueck", async () => {
    const tool = makeTool({
      id: "detail-tool",
      endpoint: "https://detail.example.com",
      method: "DELETE",
      auth: { type: "api-key", keyName: "X-API-KEY", envVar: "DETAIL_KEY" },
    });
    await writeFile(join(TEST_DIR, "detail-tool.json"), JSON.stringify(tool), "utf-8");

    const result = await getCustomTool("detail-tool");
    expect(result!.endpoint).toBe("https://detail.example.com");
    expect(result!.method).toBe("DELETE");
    expect(result!.auth.type).toBe("api-key");
    expect(result!.auth.keyName).toBe("X-API-KEY");
  });
});

// ---------------------------------------------------------------------------
// saveCustomTool()
// ---------------------------------------------------------------------------

describe("saveCustomTool()", () => {
  test("speichert ein neues Tool auf dem Dateisystem", async () => {
    const tool = makeTool({ id: "save-new-tool" });
    await saveCustomTool(tool);

    const { existsSync } = await import("fs");
    expect(existsSync(join(TEST_DIR, "save-new-tool.json"))).toBe(true);
  });

  test("gibt das gespeicherte Tool zurueck", async () => {
    const tool = makeTool({ id: "return-check-tool" });
    const result = await saveCustomTool(tool);

    expect(result.id).toBe("return-check-tool");
    expect(result.name).toBe("Test Tool");
  });

  test("setzt createdAt wenn es nicht vorhanden ist", async () => {
    const tool = makeTool({ id: "created-at-tool" });
    const before = new Date().toISOString();
    const result = await saveCustomTool(tool);
    const after = new Date().toISOString();

    expect(result.createdAt).toBeDefined();
    expect(result.createdAt! >= before).toBe(true);
    expect(result.createdAt! <= after).toBe(true);
  });

  test("bewahrt vorhandenes createdAt", async () => {
    const fixedDate = "2024-01-01T10:00:00.000Z";
    const tool = makeTool({ id: "preserve-created-tool", createdAt: fixedDate });

    const result = await saveCustomTool(tool);
    expect(result.createdAt).toBe(fixedDate);
  });

  test("aktualisiert immer updatedAt auf den aktuellen Zeitstempel", async () => {
    const tool = makeTool({ id: "updated-at-tool", updatedAt: "2020-01-01T00:00:00.000Z" });
    const before = new Date().toISOString();
    const result = await saveCustomTool(tool);
    const after = new Date().toISOString();

    expect(result.updatedAt >= before).toBe(true);
    expect(result.updatedAt <= after).toBe(true);
  });

  test("ueberschreibt ein vorhandenes Tool", async () => {
    const tool = makeTool({ id: "overwrite-tool", name: "Original" });
    await saveCustomTool(tool);

    const updated = { ...tool, name: "Ueberschrieben" };
    const result = await saveCustomTool(updated);
    expect(result.name).toBe("Ueberschrieben");
  });

  test("persistiert die Daten so dass sie erneut geladen werden koennen", async () => {
    const tool = makeTool({ id: "persist-tool" });
    await saveCustomTool(tool);

    // Cache zuruecksetzen und neu laden
    clearCustomToolsCache();
    const loaded = await getCustomTool("persist-tool");

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("persist-tool");
  });

  test("aktualisiert den Cache wenn er bereits existiert", async () => {
    // Cache befuellen
    await loadCustomTools();

    // Neues Tool speichern — sollte Cache aktualisieren
    const tool = makeTool({ id: "cache-update-tool" });
    await saveCustomTool(tool);

    // Aus Cache lesen (ohne Cache-Reset)
    const result = await getCustomTool("cache-update-tool");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cache-update-tool");
  });

  test("wirft einen Fehler fuer eine ID mit Grossbuchstaben", async () => {
    const tool = makeTool({ id: "Invalid-ID" });
    await expect(saveCustomTool(tool)).rejects.toThrow(
      "Tool ID must contain only lowercase letters, numbers, hyphens and underscores"
    );
  });

  test("wirft einen Fehler fuer eine ID mit Leerzeichen", async () => {
    const tool = makeTool({ id: "invalid id" });
    await expect(saveCustomTool(tool)).rejects.toThrow();
  });

  test("wirft einen Fehler fuer eine ID mit Sonderzeichen", async () => {
    const tool = makeTool({ id: "invalid@tool!" });
    await expect(saveCustomTool(tool)).rejects.toThrow();
  });

  test("akzeptiert gueltige IDs mit Kleinbuchstaben, Ziffern, Bindestrichen und Unterstrichen", async () => {
    const ids = ["my-tool", "tool_v2", "tool123", "a", "my-tool_v2-3"];
    for (const id of ids) {
      const tool = makeTool({ id });
      await expect(saveCustomTool(tool)).resolves.toBeDefined();
      // Cache zuruecksetzen fuer naechste Iteration
      clearCustomToolsCache();
      await rm(join(TEST_DIR, `${id}.json`), { force: true });
    }
  });

  test("schreibt gueltiges JSON in die Datei", async () => {
    const tool = makeTool({ id: "json-check-tool" });
    await saveCustomTool(tool);

    const content = await Bun.file(join(TEST_DIR, "json-check-tool.json")).text();
    const parsed = JSON.parse(content);
    expect(parsed.id).toBe("json-check-tool");
    expect(parsed.name).toBe("Test Tool");
  });
});

// ---------------------------------------------------------------------------
// createCustomTool()
// ---------------------------------------------------------------------------

describe("createCustomTool()", () => {
  test("erstellt ein neues Tool und gibt es zurueck", async () => {
    const tool = makeTool({ id: "create-new" });
    const result = await createCustomTool(tool);

    expect(result.id).toBe("create-new");
    expect(result.name).toBe("Test Tool");
  });

  test("setzt createdAt und updatedAt automatisch", async () => {
    const tool = makeTool({ id: "create-timestamps" });
    const before = new Date().toISOString();
    const result = await createCustomTool(tool);
    const after = new Date().toISOString();

    expect(result.createdAt! >= before).toBe(true);
    expect(result.createdAt! <= after).toBe(true);
    expect(result.updatedAt >= before).toBe(true);
    expect(result.updatedAt <= after).toBe(true);
  });

  test("wirft einen Fehler wenn ein Tool mit dieser ID bereits existiert", async () => {
    const tool = makeTool({ id: "duplicate-create" });
    await createCustomTool(tool);

    await expect(createCustomTool(tool)).rejects.toThrow(
      'Tool with ID "duplicate-create" already exists'
    );
  });

  test("das erstellte Tool kann anschliessend geladen werden", async () => {
    const tool = makeTool({ id: "create-and-load" });
    await createCustomTool(tool);

    clearCustomToolsCache();
    const loaded = await getCustomTool("create-and-load");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("create-and-load");
  });

  test("mehrere verschiedene Tools koennen erstellt werden", async () => {
    await createCustomTool(makeTool({ id: "tool-a" }));
    await createCustomTool(makeTool({ id: "tool-b" }));
    await createCustomTool(makeTool({ id: "tool-c" }));

    clearCustomToolsCache();
    const tools = await loadCustomTools();
    expect(tools).toHaveLength(3);
  });

  test("wirft einen Fehler fuer ungueltige Tool-ID", async () => {
    const tool = makeTool({ id: "Invalid" });
    await expect(createCustomTool(tool)).rejects.toThrow();
  });

  test("speichert alle optionalen Felder korrekt", async () => {
    const tool = makeTool({
      id: "full-create",
      category: "utils",
      headers: { Authorization: "Bearer token" },
      timeout: 3000,
      bodyTemplate: '{"key":"$value"}',
      contentType: "application/json",
      responseTemplate: "Ergebnis: $result",
      jsonPath: "$.result",
    });

    const result = await createCustomTool(tool);
    expect(result.category).toBe("utils");
    expect(result.timeout).toBe(3000);
    expect(result.jsonPath).toBe("$.result");
  });
});

// ---------------------------------------------------------------------------
// updateCustomTool()
// ---------------------------------------------------------------------------

describe("updateCustomTool()", () => {
  test("aktualisiert den Namen eines vorhandenen Tools", async () => {
    await createCustomTool(makeTool({ id: "update-name-tool", name: "Original" }));

    const result = await updateCustomTool("update-name-tool", { name: "Aktualisiert" });
    expect(result.name).toBe("Aktualisiert");
  });

  test("bewahrt unveraenderte Felder beim Update", async () => {
    const original = makeTool({
      id: "preserve-fields-tool",
      description: "Original Beschreibung",
      endpoint: "https://original.example.com",
    });
    await createCustomTool(original);

    const result = await updateCustomTool("preserve-fields-tool", { name: "Neuer Name" });

    expect(result.description).toBe("Original Beschreibung");
    expect(result.endpoint).toBe("https://original.example.com");
  });

  test("verhindert eine Aenderung der ID", async () => {
    await createCustomTool(makeTool({ id: "immutable-id-tool" }));

    const result = await updateCustomTool("immutable-id-tool", {
      id: "new-id-attempt" as any,
    } as Partial<CustomToolConfig>);

    expect(result.id).toBe("immutable-id-tool");
  });

  test("bewahrt createdAt beim Update", async () => {
    const tool = await createCustomTool(makeTool({ id: "preserve-created-at-tool" }));
    const originalCreatedAt = tool.createdAt;

    const result = await updateCustomTool("preserve-created-at-tool", {
      name: "Geaendert",
    });

    expect(result.createdAt).toBe(originalCreatedAt);
  });

  test("aktualisiert updatedAt beim Update", async () => {
    const tool = await createCustomTool(makeTool({ id: "update-updated-at-tool" }));
    const originalUpdatedAt = tool.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await updateCustomTool("update-updated-at-tool", {
      name: "Geaendert",
    });

    expect(result.updatedAt >= originalUpdatedAt).toBe(true);
  });

  test("wirft einen Fehler wenn das Tool nicht existiert", async () => {
    await expect(
      updateCustomTool("nonexistent-tool", { name: "Geist" })
    ).rejects.toThrow('Tool "nonexistent-tool" not found');
  });

  test("persistiert die Aenderungen dauerhaft", async () => {
    await createCustomTool(makeTool({ id: "persist-update-tool", name: "Vor Update" }));

    await updateCustomTool("persist-update-tool", { name: "Nach Update" });

    clearCustomToolsCache();
    const loaded = await getCustomTool("persist-update-tool");
    expect(loaded!.name).toBe("Nach Update");
  });

  test("mehrere Felder koennen in einem Aufruf aktualisiert werden", async () => {
    await createCustomTool(
      makeTool({
        id: "multi-field-update-tool",
        name: "Original",
        description: "Original Beschreibung",
        enabled: true,
      })
    );

    const result = await updateCustomTool("multi-field-update-tool", {
      name: "Neu",
      description: "Neue Beschreibung",
      enabled: false,
    });

    expect(result.name).toBe("Neu");
    expect(result.description).toBe("Neue Beschreibung");
    expect(result.enabled).toBe(false);
  });

  test("aktualisiert den Cache wenn er besteht", async () => {
    await createCustomTool(makeTool({ id: "cache-update-check-tool", name: "Alt" }));
    // Cache befuellen
    await loadCustomTools();

    await updateCustomTool("cache-update-check-tool", { name: "Neu" });

    // Aus Cache abrufen (ohne clearCustomToolsCache)
    const fromCache = await getCustomTool("cache-update-check-tool");
    expect(fromCache!.name).toBe("Neu");
  });

  test("kann den endpoint aktualisieren", async () => {
    await createCustomTool(
      makeTool({ id: "endpoint-update-tool", endpoint: "https://old.example.com" })
    );

    const result = await updateCustomTool("endpoint-update-tool", {
      endpoint: "https://new.example.com",
    });

    expect(result.endpoint).toBe("https://new.example.com");
  });

  test("kann die auth-Konfiguration aktualisieren", async () => {
    await createCustomTool(makeTool({ id: "auth-update-tool", auth: { type: "none" } }));

    const result = await updateCustomTool("auth-update-tool", {
      auth: { type: "bearer", envVar: "MY_TOKEN" },
    });

    expect(result.auth.type).toBe("bearer");
    expect(result.auth.envVar).toBe("MY_TOKEN");
  });
});

// ---------------------------------------------------------------------------
// deleteCustomTool()
// ---------------------------------------------------------------------------

describe("deleteCustomTool()", () => {
  test("loescht ein vorhandenes Tool ohne Fehler", async () => {
    await createCustomTool(makeTool({ id: "delete-existing-tool" }));
    await expect(deleteCustomTool("delete-existing-tool")).resolves.toBeUndefined();
  });

  test("wirft einen Fehler wenn das Tool nicht existiert", async () => {
    await expect(deleteCustomTool("nonexistent-tool")).rejects.toThrow(
      'Tool "nonexistent-tool" not found'
    );
  });

  test("das Tool ist nach dem Loeschen nicht mehr abrufbar", async () => {
    await createCustomTool(makeTool({ id: "delete-then-get-tool" }));
    await deleteCustomTool("delete-then-get-tool");

    clearCustomToolsCache();
    const result = await getCustomTool("delete-then-get-tool");
    expect(result).toBeNull();
  });

  test("entfernt die JSON-Datei vom Dateisystem", async () => {
    await createCustomTool(makeTool({ id: "delete-file-check-tool" }));
    await deleteCustomTool("delete-file-check-tool");

    const exists = await Bun.file(join(TEST_DIR, "delete-file-check-tool.json")).exists();
    expect(exists).toBe(false);
  });

  test("loescht nur das angegebene Tool, andere bleiben erhalten", async () => {
    await createCustomTool(makeTool({ id: "keep-me-tool" }));
    await createCustomTool(makeTool({ id: "delete-me-tool" }));

    await deleteCustomTool("delete-me-tool");

    clearCustomToolsCache();
    expect(await getCustomTool("keep-me-tool")).not.toBeNull();
    expect(await getCustomTool("delete-me-tool")).toBeNull();
  });

  test("entfernt das Tool aus dem Cache", async () => {
    await createCustomTool(makeTool({ id: "cache-remove-tool" }));
    // Cache befuellen
    await loadCustomTools();

    await deleteCustomTool("cache-remove-tool");

    // Ohne clearCustomToolsCache soll das Tool nicht mehr im Cache sein
    const result = await getCustomTool("cache-remove-tool");
    expect(result).toBeNull();
  });

  test("customToolExists gibt false zurueck nach dem Loeschen", async () => {
    await createCustomTool(makeTool({ id: "exists-after-delete-tool" }));
    await deleteCustomTool("exists-after-delete-tool");

    clearCustomToolsCache();
    const exists = await customToolExists("exists-after-delete-tool");
    expect(exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// customToolExists()
// ---------------------------------------------------------------------------

describe("customToolExists()", () => {
  test("gibt false zurueck wenn das Tool nicht existiert (kein Cache, keine Datei)", async () => {
    const result = await customToolExists("totally-missing");
    expect(result).toBe(false);
  });

  test("gibt true zurueck wenn das Tool auf dem Dateisystem existiert", async () => {
    const tool = makeTool({ id: "exists-on-disk" });
    await writeFile(join(TEST_DIR, "exists-on-disk.json"), JSON.stringify(tool), "utf-8");

    const result = await customToolExists("exists-on-disk");
    expect(result).toBe(true);
  });

  test("gibt true zurueck wenn das Tool im Cache ist", async () => {
    await createCustomTool(makeTool({ id: "exists-in-cache" }));
    // Cache befuellen
    await loadCustomTools();

    const result = await customToolExists("exists-in-cache");
    expect(result).toBe(true);
  });

  test("gibt false zurueck fuer ein Tool das nicht im Cache ist", async () => {
    // Cache befuellen (leeres Verzeichnis)
    await loadCustomTools();

    const result = await customToolExists("still-not-there");
    expect(result).toBe(false);
  });

  test("gibt true zurueck nach dem Erstellen ohne Cache-Reset", async () => {
    await createCustomTool(makeTool({ id: "freshly-created" }));

    const result = await customToolExists("freshly-created");
    expect(result).toBe(true);
  });

  test("gibt false zurueck nach dem Loeschen via deleteCustomTool", async () => {
    await createCustomTool(makeTool({ id: "to-be-deleted-exists" }));
    await deleteCustomTool("to-be-deleted-exists");

    const result = await customToolExists("to-be-deleted-exists");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Persistenz-Roundtrip
// ---------------------------------------------------------------------------

describe("Persistenz-Roundtrip", () => {
  test("saveCustomTool → clearCache → loadCustomTools gibt das Tool zurueck", async () => {
    const tool = makeTool({ id: "roundtrip-tool", name: "Roundtrip" });
    await saveCustomTool(tool);
    clearCustomToolsCache();

    const tools = await loadCustomTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.id).toBe("roundtrip-tool");
    expect(tools[0]!.name).toBe("Roundtrip");
  });

  test("createCustomTool → clearCache → getCustomTool gibt das Tool zurueck", async () => {
    const tool = makeTool({ id: "create-get-roundtrip" });
    await createCustomTool(tool);
    clearCustomToolsCache();

    const loaded = await getCustomTool("create-get-roundtrip");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("create-get-roundtrip");
  });

  test("updateCustomTool → clearCache → getCustomTool gibt aktualisierte Daten zurueck", async () => {
    await createCustomTool(makeTool({ id: "update-roundtrip", name: "Vor" }));
    await updateCustomTool("update-roundtrip", { name: "Nach" });
    clearCustomToolsCache();

    const loaded = await getCustomTool("update-roundtrip");
    expect(loaded!.name).toBe("Nach");
  });

  test("Zeitstempel werden beim Persistieren korrekt gesetzt und gespeichert", async () => {
    const before = new Date().toISOString();
    const tool = await createCustomTool(makeTool({ id: "timestamps-roundtrip" }));
    const after = new Date().toISOString();

    clearCustomToolsCache();
    const loaded = await getCustomTool("timestamps-roundtrip");

    expect(loaded!.createdAt! >= before).toBe(true);
    expect(loaded!.createdAt! <= after).toBe(true);
    expect(loaded!.updatedAt >= before).toBe(true);
    expect(loaded!.updatedAt <= after).toBe(true);
    // Beim Erstellen sollten createdAt und updatedAt gleich sein
    expect(loaded!.createdAt).toBe(tool.createdAt);
  });

  test("Parameter-Array wird vollstaendig persistiert und geladen", async () => {
    const tool = makeTool({
      id: "params-roundtrip",
      parameters: [
        {
          name: "city",
          type: "string",
          description: "Stadtname",
          required: true,
          location: "query",
        },
        {
          name: "limit",
          type: "number",
          description: "Ergebnislimit",
          required: false,
          location: "query",
          default: "10",
        },
      ],
    });
    await createCustomTool(tool);
    clearCustomToolsCache();

    const loaded = await getCustomTool("params-roundtrip");
    expect(loaded!.parameters).toHaveLength(2);
    expect(loaded!.parameters[0]!.name).toBe("city");
    expect(loaded!.parameters[1]!.name).toBe("limit");
    expect(loaded!.parameters[1]!.default).toBe("10");
  });
});

// ---------------------------------------------------------------------------
// Cache-Verhalten
// ---------------------------------------------------------------------------

describe("Cache-Verhalten", () => {
  test("loadCustomTools befuellt den Cache so dass getCustomTool daraus liest", async () => {
    const tool = makeTool({ id: "cache-fill-tool" });
    await writeFile(join(TEST_DIR, "cache-fill-tool.json"), JSON.stringify(tool), "utf-8");

    await loadCustomTools();

    // Datei loeschen — Tool muss dennoch aus Cache kommen
    await rm(join(TEST_DIR, "cache-fill-tool.json"));

    const result = await getCustomTool("cache-fill-tool");
    expect(result).not.toBeNull();
  });

  test("saveCustomTool aktualisiert den Cache sofort ohne Reload", async () => {
    // Cache befuellen (leer)
    await loadCustomTools();

    const tool = makeTool({ id: "save-updates-cache" });
    await saveCustomTool(tool);

    // Direkt aus Cache lesen
    const result = await getCustomTool("save-updates-cache");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("save-updates-cache");
  });

  test("deleteCustomTool entfernt das Tool sofort aus dem Cache", async () => {
    await createCustomTool(makeTool({ id: "delete-from-cache" }));
    // Cache befuellen
    await loadCustomTools();

    await deleteCustomTool("delete-from-cache");

    // customToolExists prueft den Cache — muss false zurueckgeben
    const exists = await customToolExists("delete-from-cache");
    expect(exists).toBe(false);
  });

  test("nach clearCustomToolsCache wird der Cache neu vom Dateisystem befuellt", async () => {
    // Ersten Zustand laden
    await createCustomTool(makeTool({ id: "before-clear" }));
    await loadCustomTools();

    // Cache leeren
    clearCustomToolsCache();

    // Zweite Datei direkt schreiben
    const extra = makeTool({ id: "after-clear" });
    await writeFile(join(TEST_DIR, "after-clear.json"), JSON.stringify(extra), "utf-8");

    // Neu laden — beide Tools muessen sichtbar sein
    const tools = await loadCustomTools();
    const ids = tools.map((t) => t.id).sort();
    expect(ids).toContain("before-clear");
    expect(ids).toContain("after-clear");
  });

  test("customToolExists prueft bei leerem Cache das Dateisystem direkt", async () => {
    // Datei manuell erstellen, ohne saveCustomTool (kein Cache)
    const tool = makeTool({ id: "fs-check-tool" });
    await writeFile(join(TEST_DIR, "fs-check-tool.json"), JSON.stringify(tool), "utf-8");

    // Cache ist leer (clearCustomToolsCache wurde in beforeEach aufgerufen)
    const exists = await customToolExists("fs-check-tool");
    expect(exists).toBe(true);
  });

  test("customToolExists gibt false zurueck wenn Datei nicht existiert und kein Cache", async () => {
    // Cache ist leer, Datei existiert nicht
    const exists = await customToolExists("no-file-no-cache");
    expect(exists).toBe(false);
  });
});
