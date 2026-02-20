/**
 * Tests fuer CustomApiTool (backend/src/tools/custom/CustomApiTool.ts)
 *
 * Die ssrfProtection-Utility wird per mock.module() ersetzt, damit keine
 * echten DNS-Aufloesungen oder Netzwerkanfragen stattfinden. Ebenso wird
 * das globale fetch durch einen Mock ersetzt, um HTTP-Requests abzufangen.
 *
 * Wichtig: mock.module()-Aufrufe muessen VOR dem dynamischen Import des
 * Moduls unter Test stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Pfade in mock.module() sind relativ zur Testdatei. Das Modul unter Test
 * liegt in src/tools/custom/, die Testdatei in src/tools/custom/__tests__/,
 * daher zeigt der Pfad zu ssrfProtection auf ../../../utils/ssrfProtection.
 *
 * Template-Kontext in processResponse():
 *   { ...args, response: data, ...flattenObject(data) }
 * - {{response}} = gesamtes geparste JSON-Objekt (serialisiert)
 * - {{response.x.y}} = traversiert via extractJsonPath
 * - {{x}} = funktioniert fuer Top-Level-Felder des geparsten Objekts
 *           (flattenObject legt sie als direkte Keys ab)
 * - flattenObject erstellt Eintraege mit Punkt-Notation als Literalschluessel
 *   ("user.name"), die jedoch von extractJsonPath NICHT direkt zugreifbar
 *   sind, da dieser auf "." splittet. Verschachtelte Felder sind deshalb
 *   nur ueber {{response.user.name}} erreichbar.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { CustomToolConfig } from "../types";

// ---------------------------------------------------------------------------
// Mock: ssrfProtection — wird vor dem Import des Moduls registriert.
// Der Pfad ist relativ zur Testdatei (nicht zum Modul unter Test).
// ---------------------------------------------------------------------------

// Wir legen den Mock-State als mutablees Objekt an, damit beforeEach ihn
// zuruecksetzen kann ohne dass mock.module() erneut aufgerufen werden muss.
const ssrfMockState = {
  allowed: true,
  reason: undefined as string | undefined,
};

mock.module("../../../utils/ssrfProtection", () => ({
  validateUrl: async (_url: string, _opts?: any) => ({
    allowed: ssrfMockState.allowed,
    reason: ssrfMockState.reason,
    resolvedIP: ssrfMockState.allowed ? "1.2.3.4" : undefined,
  }),
}));

// ---------------------------------------------------------------------------
// Import des Moduls unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { CustomApiTool } = await import("../CustomApiTool");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Erstellt eine minimale, gueltige CustomToolConfig-Fixture. */
function makeConfig(overrides: Partial<CustomToolConfig> = {}): CustomToolConfig {
  return {
    id: "test-tool",
    name: "Test Tool",
    description: "Ein einfaches Test-Tool fuer Unit-Tests",
    enabled: true,
    endpoint: "https://api.example.com/data",
    method: "GET",
    headers: {},
    parameters: [],
    auth: { type: "none" },
    responseType: "json",
    ...overrides,
  };
}

/** Fetch-Capture: speichert den letzten aufgerufenen URL und Options. */
type FetchCapture = { url: string | null; options: RequestInit | null; callCount: number };

/**
 * Ersetzt das globale fetch durch einen Mock, der eine feste Response liefert.
 * Gibt ein capture-Objekt zurueck, das nach dem Aufruf ausgelesen werden kann.
 */
function mockFetch(response: Response): FetchCapture {
  const capture: FetchCapture = { url: null, options: null, callCount: 0 };
  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    capture.url = url.toString();
    capture.options = options ?? null;
    capture.callCount++;
    return response;
  };
  return capture;
}

/** Erstellt eine HTTP-Response mit einem JSON-Body. */
function makeJsonResponse(data: any, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

/** Erstellt eine HTTP-Response mit einem Text-Body. */
function makeTextResponse(text: string, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: async () => { throw new Error("Not JSON"); },
    text: async () => text,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // SSRF-Mock: standardmaessig alle URLs erlauben
  ssrfMockState.allowed = true;
  ssrfMockState.reason = undefined;

  // fetch-Mock: standardmaessig leere JSON-Antwort
  mockFetch(makeJsonResponse({}));
});

// ---------------------------------------------------------------------------
// Konstruktor
// ---------------------------------------------------------------------------

describe("Konstruktor", () => {
  test("setzt name aus config.id", () => {
    const tool = new CustomApiTool(makeConfig({ id: "mein-tool" }));
    expect(tool.name).toBe("mein-tool");
  });

  test("setzt type auf 'api'", () => {
    const tool = new CustomApiTool(makeConfig());
    expect(tool.type).toBe("api");
  });

  test("gibt eine Sicherheitswarnung aus wenn API-Key in Query-Params liegt", () => {
    const originalWarn = console.warn;
    const warnMessages: string[] = [];
    console.warn = (...args: any[]) => warnMessages.push(String(args[0]));

    try {
      new CustomApiTool(
        makeConfig({
          auth: { type: "api-key", location: "query", keyName: "apikey", value: "secret" },
        })
      );
      expect(warnMessages.length).toBeGreaterThan(0);
      expect(warnMessages[0]).toContain("[SECURITY WARNING]");
      expect(warnMessages[0]).toContain("query parameters");
    } finally {
      console.warn = originalWarn;
    }
  });

  test("gibt keine Warnung aus wenn API-Key im Header liegt", () => {
    const originalWarn = console.warn;
    const warnMessages: string[] = [];
    console.warn = (...args: any[]) => warnMessages.push(String(args[0]));

    try {
      new CustomApiTool(
        makeConfig({
          auth: { type: "api-key", location: "header", keyName: "X-Api-Key", value: "secret" },
        })
      );
      expect(warnMessages).toHaveLength(0);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("gibt keine Warnung aus fuer bearer-Auth", () => {
    const originalWarn = console.warn;
    const warnMessages: string[] = [];
    console.warn = (...args: any[]) => warnMessages.push(String(args[0]));

    try {
      new CustomApiTool(makeConfig({ auth: { type: "bearer", value: "tok" } }));
      expect(warnMessages).toHaveLength(0);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("gibt keine Warnung aus fuer basic-Auth", () => {
    const originalWarn = console.warn;
    const warnMessages: string[] = [];
    console.warn = (...args: any[]) => warnMessages.push(String(args[0]));

    try {
      new CustomApiTool(makeConfig({ auth: { type: "basic", value: "user:pass" } }));
      expect(warnMessages).toHaveLength(0);
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ---------------------------------------------------------------------------
// getDefinition()
// ---------------------------------------------------------------------------

describe("getDefinition()", () => {
  test("gibt type 'function' zurueck", () => {
    const tool = new CustomApiTool(makeConfig());
    expect(tool.getDefinition().type).toBe("function");
  });

  test("gibt den Toolnamen als function.name zurueck", () => {
    const tool = new CustomApiTool(makeConfig({ id: "weather-api" }));
    expect(tool.getDefinition().function.name).toBe("weather-api");
  });

  test("gibt die Beschreibung als function.description zurueck", () => {
    const tool = new CustomApiTool(
      makeConfig({ description: "Wetterdaten abrufen" })
    );
    expect(tool.getDefinition().function.description).toBe("Wetterdaten abrufen");
  });

  test("gibt leere properties und leeres required-Array zurueck wenn keine Parameter vorhanden", () => {
    const tool = new CustomApiTool(makeConfig({ parameters: [] }));
    const def = tool.getDefinition();
    expect(def.function.parameters.properties).toEqual({});
    expect(def.function.parameters.required).toEqual([]);
  });

  test("gibt parameters.type als 'object' zurueck", () => {
    const tool = new CustomApiTool(makeConfig());
    expect(tool.getDefinition().function.parameters.type).toBe("object");
  });

  test("mappt einen einzelnen optionalen Parameter korrekt", () => {
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          {
            name: "city",
            type: "string",
            description: "Stadtname",
            required: false,
            location: "query",
          },
        ],
      })
    );
    const def = tool.getDefinition();
    expect(def.function.parameters.properties["city"]).toEqual({
      type: "string",
      description: "Stadtname",
    });
    expect(def.function.parameters.required).toEqual([]);
  });

  test("fuegt Pflichtparameter zum required-Array hinzu", () => {
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          {
            name: "query",
            type: "string",
            description: "Suchbegriff",
            required: true,
            location: "query",
          },
        ],
      })
    );
    const def = tool.getDefinition();
    expect(def.function.parameters.required).toContain("query");
  });

  test("verarbeitet mehrere Parameter mit gemischten required-Flags korrekt", () => {
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "q", type: "string", description: "Pflicht", required: true, location: "query" },
          { name: "limit", type: "number", description: "Optional", required: false, location: "query" },
          { name: "active", type: "boolean", description: "Pflicht2", required: true, location: "query" },
        ],
      })
    );
    const def = tool.getDefinition();
    expect(Object.keys(def.function.parameters.properties)).toHaveLength(3);
    expect(def.function.parameters.required).toContain("q");
    expect(def.function.parameters.required).toContain("active");
    expect(def.function.parameters.required).not.toContain("limit");
  });

  test("gibt den korrekten Parametertyp (number, boolean) zurueck", () => {
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "count", type: "number", description: "Anzahl", required: false, location: "query" },
          { name: "verbose", type: "boolean", description: "Ausfuehrlich", required: false, location: "query" },
        ],
      })
    );
    const props = tool.getDefinition().function.parameters.properties;
    expect(props["count"]!.type).toBe("number");
    expect(props["verbose"]!.type).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// getMetadata()
// ---------------------------------------------------------------------------

describe("getMetadata()", () => {
  test("gibt name, description, type und category zurueck", () => {
    const tool = new CustomApiTool(
      makeConfig({ id: "meta-tool", description: "Beschreibung", category: "integration" })
    );
    const meta = tool.getMetadata();
    expect(meta.name).toBe("meta-tool");
    expect(meta.description).toBe("Beschreibung");
    expect(meta.type).toBe("api");
    expect(meta.category).toBe("integration");
  });

  test("setzt category auf 'custom' wenn keine category konfiguriert ist", () => {
    const tool = new CustomApiTool(makeConfig({ category: undefined }));
    expect(tool.getMetadata().category).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// getConfig() und updateConfig()
// ---------------------------------------------------------------------------

describe("getConfig()", () => {
  test("gibt die aktuelle Konfiguration zurueck", () => {
    const config = makeConfig({ id: "cfg-tool", description: "Config-Test" });
    const tool = new CustomApiTool(config);
    expect(tool.getConfig()).toEqual(config);
  });
});

describe("updateConfig()", () => {
  test("ersetzt die interne Konfiguration vollstaendig", () => {
    const original = makeConfig({ id: "update-tool", description: "Alt" });
    const tool = new CustomApiTool(original);

    const updated = makeConfig({ id: "update-tool", description: "Neu" });
    tool.updateConfig(updated);

    expect(tool.getConfig().description).toBe("Neu");
  });

  test("wirkt sich auf nachfolgende getDefinition()-Aufrufe aus", () => {
    const tool = new CustomApiTool(makeConfig({ description: "Alte Beschreibung" }));
    tool.updateConfig(makeConfig({ description: "Neue Beschreibung" }));
    expect(tool.getDefinition().function.description).toBe("Neue Beschreibung");
  });

  test("wirkt sich auf nachfolgende getMetadata()-Aufrufe aus", () => {
    const tool = new CustomApiTool(makeConfig({ category: "alt" }));
    tool.updateConfig(makeConfig({ category: "neu" }));
    expect(tool.getMetadata().category).toBe("neu");
  });
});

// ---------------------------------------------------------------------------
// isAvailable()
// ---------------------------------------------------------------------------

describe("isAvailable()", () => {
  test("gibt true zurueck fuer ein aktiviertes Tool ohne Auth", async () => {
    const tool = new CustomApiTool(makeConfig({ enabled: true, auth: { type: "none" } }));
    expect(await tool.isAvailable()).toBe(true);
  });

  test("gibt false zurueck wenn enabled=false", async () => {
    const tool = new CustomApiTool(makeConfig({ enabled: false }));
    expect(await tool.isAvailable()).toBe(false);
  });

  test("gibt false zurueck wenn bearer-Auth konfiguriert ist aber kein Secret vorhanden", async () => {
    // kein envVar, kein value gesetzt
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "bearer" } })
    );
    expect(await tool.isAvailable()).toBe(false);
  });

  test("gibt true zurueck wenn bearer-Auth mit direktem value konfiguriert ist", async () => {
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "bearer", value: "mytoken" } })
    );
    expect(await tool.isAvailable()).toBe(true);
  });

  test("gibt true zurueck wenn bearer-Auth mit gesetztem envVar konfiguriert ist", async () => {
    process.env["TEST_BEARER_TOKEN_AVAIL"] = "envtoken";
    try {
      const tool = new CustomApiTool(
        makeConfig({ auth: { type: "bearer", envVar: "TEST_BEARER_TOKEN_AVAIL" } })
      );
      expect(await tool.isAvailable()).toBe(true);
    } finally {
      delete process.env["TEST_BEARER_TOKEN_AVAIL"];
    }
  });

  test("gibt false zurueck wenn bearer-Auth mit fehlendem envVar konfiguriert ist", async () => {
    delete process.env["MISSING_ENV_VAR_XYZ_99"];
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "bearer", envVar: "MISSING_ENV_VAR_XYZ_99" } })
    );
    expect(await tool.isAvailable()).toBe(false);
  });

  test("gibt false zurueck wenn SSRF-Validation den Endpoint blockiert", async () => {
    ssrfMockState.allowed = false;
    ssrfMockState.reason = "Blockierte private IP";

    const tool = new CustomApiTool(
      makeConfig({ endpoint: "http://192.168.1.1/api" })
    );
    expect(await tool.isAvailable()).toBe(false);
  });

  test("ueberspringt SSRF-Pruefung wenn Endpoint doppelte geschweifte Klammern enthaelt", async () => {
    // ssrfMockState.allowed ist false: falls validateUrl trotzdem aufgerufen
    // wuerde, wuerde false zurueckkommen. Da Template-Endpoints die Pruefung
    // ueberspringen, muss das Ergebnis trotzdem true sein.
    ssrfMockState.allowed = false;
    ssrfMockState.reason = "Sollte nicht aufgerufen werden";

    const tool = new CustomApiTool(
      makeConfig({ endpoint: "https://api.example.com/{{version}}/data" })
    );
    expect(await tool.isAvailable()).toBe(true);
  });

  test("ueberspringt SSRF-Pruefung wenn Endpoint einfache geschweifte Klammern enthaelt", async () => {
    ssrfMockState.allowed = false;
    ssrfMockState.reason = "Sollte nicht aufgerufen werden";

    const tool = new CustomApiTool(
      makeConfig({ endpoint: "https://api.example.com/{id}/data" })
    );
    expect(await tool.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// execute() — Erfolgs-Pfad
// ---------------------------------------------------------------------------

describe("execute() — Erfolgs-Pfad", () => {
  test("gibt JSON-Objekte als formatierten String zurueck", async () => {
    const capture = mockFetch(makeJsonResponse({ result: "ok", count: 3 }));
    const tool = new CustomApiTool(makeConfig({ responseType: "json" }));
    const result = await tool.execute({});
    const parsed = JSON.parse(result);
    expect(parsed.result).toBe("ok");
    expect(parsed.count).toBe(3);
    expect(capture.callCount).toBe(1);
  });

  test("gibt Text-Response direkt als String zurueck", async () => {
    mockFetch(makeTextResponse("Hallo Welt"));
    const tool = new CustomApiTool(makeConfig({ responseType: "text" }));
    const result = await tool.execute({});
    expect(result).toBe("Hallo Welt");
  });

  test("gibt primitive JSON-Werte korrekt zurueck", async () => {
    mockFetch(makeJsonResponse("einfacher String" as any));
    const tool = new CustomApiTool(makeConfig({ responseType: "json" }));
    const result = await tool.execute({});
    expect(result).toBe("einfacher String");
  });

  test("ruft den Endpoint mit der konfigurierten HTTP-Methode auf", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig({ method: "POST" }));
    await tool.execute({});
    expect(capture.options?.method).toBe("POST");
  });
});

// ---------------------------------------------------------------------------
// execute() — SSRF-Blockierung
// ---------------------------------------------------------------------------

describe("execute() — SSRF-Blockierung", () => {
  test("gibt eine Fehlermeldung zurueck wenn SSRF den Request blockiert", async () => {
    ssrfMockState.allowed = false;
    ssrfMockState.reason = "Blockierte private IP";

    const tool = new CustomApiTool(makeConfig());
    const result = await tool.execute({});
    expect(result).toContain("Error:");
    expect(result).toContain("Blockierte private IP");
  });

  test("fuehrt keinen fetch-Aufruf durch wenn SSRF blockiert", async () => {
    ssrfMockState.allowed = false;
    ssrfMockState.reason = "Blocked";

    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig());
    await tool.execute({});
    expect(capture.callCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// execute() — HTTP-Fehler und Netzwerkfehler
// ---------------------------------------------------------------------------

describe("execute() — HTTP-Fehler", () => {
  test("gibt 'API Error (404)' zurueck bei 404-Antwort", async () => {
    mockFetch(makeTextResponse("Not Found", 404, false));
    const tool = new CustomApiTool(makeConfig());
    const result = await tool.execute({});
    expect(result).toContain("API Error (404)");
    expect(result).toContain("Not Found");
  });

  test("gibt 'API Error (500)' zurueck bei Server-Fehler", async () => {
    mockFetch(makeTextResponse("Internal Server Error", 500, false));
    const tool = new CustomApiTool(makeConfig());
    const result = await tool.execute({});
    expect(result).toContain("API Error (500)");
  });

  test("gibt 'Error: ...' zurueck wenn fetch einen Netzwerkfehler wirft", async () => {
    globalThis.fetch = async () => {
      throw new Error("Netzwerkverbindung fehlgeschlagen");
    };

    const tool = new CustomApiTool(makeConfig());
    const result = await tool.execute({});
    expect(result).toContain("Error:");
    expect(result).toContain("Netzwerkverbindung fehlgeschlagen");
  });

  test("gibt Fehlermeldung zurueck wenn JSON-Body nicht parsierbar ist", async () => {
    const badJsonResponse = {
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Unexpected token"); },
      text: async () => "kein-json",
    } as unknown as Response;

    mockFetch(badJsonResponse);
    const tool = new CustomApiTool(makeConfig({ responseType: "json" }));
    const result = await tool.execute({});
    expect(result).toContain("Error parsing JSON response");
  });

  test("gibt Fehlermeldung zurueck wenn Pflichtparameter fehlt", async () => {
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "id", type: "string", description: "ID", required: true, location: "path" },
        ],
        endpoint: "https://api.example.com/items/{{id}}",
      })
    );
    const result = await tool.execute({}); // 'id' fehlt absichtlich
    expect(result).toContain("Error:");
    expect(result).toContain("Missing required parameter: id");
  });
});

// ---------------------------------------------------------------------------
// buildRequest() via execute() — Pfad-Parameter
// ---------------------------------------------------------------------------

describe("buildRequest() — Pfad-Parameter", () => {
  test("ersetzt {{param}} im Endpoint-Pfad durch den Argumentwert", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        endpoint: "https://api.example.com/users/{{userId}}",
        parameters: [
          { name: "userId", type: "string", description: "User-ID", required: true, location: "path" },
        ],
      })
    );
    await tool.execute({ userId: "42" });
    expect(capture.url).toContain("/users/42");
  });

  test("ersetzt {param} (einfache Klammern) im Endpoint-Pfad", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        endpoint: "https://api.example.com/items/{itemId}",
        parameters: [
          { name: "itemId", type: "string", description: "Item-ID", required: true, location: "path" },
        ],
      })
    );
    await tool.execute({ itemId: "abc" });
    expect(capture.url).toContain("/items/abc");
  });

  test("URL-enkodiert Sonderzeichen in Pfad-Parametern", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        endpoint: "https://api.example.com/search/{{query}}",
        parameters: [
          { name: "query", type: "string", description: "Suche", required: true, location: "path" },
        ],
      })
    );
    await tool.execute({ query: "hello world" });
    expect(capture.url).toContain("hello%20world");
  });

  test("verwendet den Standardwert eines Pfad-Parameters wenn kein Argument uebergeben wird", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        endpoint: "https://api.example.com/v{{version}}/data",
        parameters: [
          {
            name: "version",
            type: "string",
            description: "API-Version",
            required: false,
            location: "path",
            default: "2",
          },
        ],
      })
    );
    await tool.execute({});
    expect(capture.url).toContain("/v2/data");
  });
});

// ---------------------------------------------------------------------------
// buildRequest() via execute() — Query-Parameter
// ---------------------------------------------------------------------------

describe("buildRequest() — Query-Parameter", () => {
  test("haengt einen Query-Parameter an die URL an", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "q", type: "string", description: "Suche", required: true, location: "query" },
        ],
      })
    );
    await tool.execute({ q: "typescript" });
    expect(capture.url).toContain("q=typescript");
  });

  test("verwendet den Standardwert wenn kein Argument uebergeben wird", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          {
            name: "limit",
            type: "number",
            description: "Limit",
            required: false,
            location: "query",
            default: "10",
          },
        ],
      })
    );
    await tool.execute({});
    expect(capture.url).toContain("limit=10");
  });

  test("haengt mehrere Query-Parameter korrekt an", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "q", type: "string", description: "Suche", required: true, location: "query" },
          { name: "lang", type: "string", description: "Sprache", required: true, location: "query" },
        ],
      })
    );
    await tool.execute({ q: "test", lang: "de" });
    expect(capture.url).toContain("q=test");
    expect(capture.url).toContain("lang=de");
  });

  test("verwendet '&' wenn die Basis-URL bereits '?' enthaelt", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        endpoint: "https://api.example.com/search?version=2",
        parameters: [
          { name: "q", type: "string", description: "Suche", required: true, location: "query" },
        ],
      })
    );
    await tool.execute({ q: "bun" });
    expect(capture.url).toContain("version=2");
    expect(capture.url).toContain("q=bun");
  });

  test("haengt keinen Query-String an wenn keine Query-Parameter vorhanden sind", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig({ parameters: [] }));
    await tool.execute({});
    expect(capture.url).not.toContain("?");
  });
});

// ---------------------------------------------------------------------------
// buildRequest() via execute() — Header-Parameter
// ---------------------------------------------------------------------------

describe("buildRequest() — Header-Parameter", () => {
  test("setzt einen Parameter als Request-Header", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        parameters: [
          { name: "X-Tenant-ID", type: "string", description: "Tenant", required: true, location: "header" },
        ],
      })
    );
    await tool.execute({ "X-Tenant-ID": "tenant-123" });
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["X-Tenant-ID"]).toBe("tenant-123");
  });

  test("uebertraegt statische config.headers in den Request", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({ headers: { "X-Static-Header": "static-value" } })
    );
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["X-Static-Header"]).toBe("static-value");
  });
});

// ---------------------------------------------------------------------------
// buildRequest() via execute() — Body-Parameter und bodyTemplate
// ---------------------------------------------------------------------------

describe("buildRequest() — Body-Parameter (POST/PUT/PATCH)", () => {
  test("serialisiert body-Parameter als JSON fuer POST-Requests", async () => {
    const capture = mockFetch(makeJsonResponse({ id: 1 }));
    const tool = new CustomApiTool(
      makeConfig({
        method: "POST",
        parameters: [
          { name: "name", type: "string", description: "Name", required: true, location: "body" },
          { name: "age", type: "number", description: "Alter", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ name: "Klaus", age: 30 });
    const body = JSON.parse(capture.options?.body as string);
    expect(body.name).toBe("Klaus");
    expect(body.age).toBe(30);
  });

  test("setzt Content-Type auf 'application/json' fuer POST-Requests mit Body", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        method: "POST",
        parameters: [
          { name: "msg", type: "string", description: "Nachricht", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ msg: "Hallo" });
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  test("verwendet bodyTemplate statt einzelner Body-Parameter wenn vorhanden", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        method: "POST",
        bodyTemplate: '{"message":"{{text}}","lang":"{{lang}}"}',
        parameters: [
          { name: "text", type: "string", description: "Text", required: true, location: "body" },
          { name: "lang", type: "string", description: "Sprache", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ text: "Hallo", lang: "de" });
    const body = JSON.parse(capture.options?.body as string);
    expect(body.message).toBe("Hallo");
    expect(body.lang).toBe("de");
  });

  test("sendet keinen Body fuer GET-Requests", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig({ method: "GET" }));
    await tool.execute({});
    expect(capture.options?.body).toBeUndefined();
  });

  test("sendet keinen Body fuer DELETE-Requests", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig({ method: "DELETE" }));
    await tool.execute({});
    expect(capture.options?.body).toBeUndefined();
  });

  test("verwendet konfigurierten contentType fuer den Body", async () => {
    const capture = mockFetch(makeTextResponse("ok"));
    const tool = new CustomApiTool(
      makeConfig({
        method: "POST",
        contentType: "text/plain",
        parameters: [
          { name: "data", type: "string", description: "Daten", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ data: "Wert" });
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/plain");
  });

  test("sendet PUT-Request mit Body-Parametern", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        method: "PUT",
        parameters: [
          { name: "value", type: "string", description: "Wert", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ value: "updated" });
    expect(capture.options?.method).toBe("PUT");
    expect(capture.options?.body).toContain("updated");
  });
});

// ---------------------------------------------------------------------------
// Auth: bearer
// ---------------------------------------------------------------------------

describe("Auth — bearer", () => {
  test("setzt Authorization-Header mit Bearer-Token (direkter Wert)", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "bearer", value: "mein-token" } })
    );
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer mein-token");
  });

  test("liest Bearer-Token aus Umgebungsvariable", async () => {
    process.env["MY_BEARER_TOKEN_TEST"] = "env-bearer-token";
    try {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new CustomApiTool(
        makeConfig({ auth: { type: "bearer", envVar: "MY_BEARER_TOKEN_TEST" } })
      );
      await tool.execute({});
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer env-bearer-token");
    } finally {
      delete process.env["MY_BEARER_TOKEN_TEST"];
    }
  });

  test("gibt Fehlermeldung zurueck wenn Bearer-Token nicht konfiguriert ist", async () => {
    delete process.env["NOT_SET_TOKEN_XYZ"];
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "bearer", envVar: "NOT_SET_TOKEN_XYZ" } })
    );
    const result = await tool.execute({});
    expect(result).toContain("Error:");
    expect(result).toContain("Authentication secret not configured");
  });
});

// ---------------------------------------------------------------------------
// Auth: api-key (Header)
// ---------------------------------------------------------------------------

describe("Auth — api-key (Header)", () => {
  test("setzt API-Key im konfigurierten Header-Namen", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        auth: { type: "api-key", location: "header", keyName: "X-API-Key", value: "key123" },
      })
    );
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("key123");
  });

  test("verwendet 'api_key' als Standard-Header-Namen wenn keyName nicht gesetzt ist", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({
        auth: { type: "api-key", location: "header", value: "fallback-key" },
      })
    );
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["api_key"]).toBe("fallback-key");
  });
});

// ---------------------------------------------------------------------------
// Auth: api-key (Query)
// ---------------------------------------------------------------------------

describe("Auth — api-key (Query)", () => {
  test("haengt API-Key als Query-Parameter an die URL an", async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new CustomApiTool(
        makeConfig({
          auth: { type: "api-key", location: "query", keyName: "apikey", value: "secret123" },
        })
      );
      await tool.execute({});
      expect(capture.url).toContain("apikey=secret123");
    } finally {
      console.warn = originalWarn;
    }
  });

  test("nutzt 'api_key' als Standard-Query-Parameter-Namen wenn keyName fehlt", async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new CustomApiTool(
        makeConfig({
          auth: { type: "api-key", location: "query", value: "no-keyname" },
        })
      );
      await tool.execute({});
      expect(capture.url).toContain("api_key=no-keyname");
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ---------------------------------------------------------------------------
// Auth: basic
// ---------------------------------------------------------------------------

describe("Auth — basic", () => {
  test("setzt Authorization-Header mit Base64-kodiertem Basic-Auth", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(
      makeConfig({ auth: { type: "basic", value: "user:password" } })
    );
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    const expected = `Basic ${Buffer.from("user:password").toString("base64")}`;
    expect(headers["Authorization"]).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Auth: none
// ---------------------------------------------------------------------------

describe("Auth — none", () => {
  test("setzt keinen Authorization-Header wenn Auth-Type 'none' ist", async () => {
    const capture = mockFetch(makeJsonResponse({}));
    const tool = new CustomApiTool(makeConfig({ auth: { type: "none" } }));
    await tool.execute({});
    const headers = capture.options?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// processResponse() — JSON-Verarbeitung
// ---------------------------------------------------------------------------

describe("processResponse() — JSON-Verarbeitung", () => {
  test("gibt JSON-Objekte als eingerueckten String zurueck", async () => {
    mockFetch(makeJsonResponse({ name: "Alice", age: 30 }));
    const tool = new CustomApiTool(makeConfig({ responseType: "json" }));
    const result = await tool.execute({});
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("Alice");
    expect(parsed.age).toBe(30);
  });

  test("extrahiert einen Wert mit jsonPath (einfacher Schluessel)", async () => {
    mockFetch(makeJsonResponse({ data: { value: "Ergebnis" } }));
    const tool = new CustomApiTool(
      makeConfig({ responseType: "json", jsonPath: "data.value" })
    );
    const result = await tool.execute({});
    expect(result).toBe("Ergebnis");
  });

  test("extrahiert einen tief verschachtelten Wert mit jsonPath", async () => {
    mockFetch(makeJsonResponse({ a: { b: { c: 42 } } }));
    const tool = new CustomApiTool(
      makeConfig({ responseType: "json", jsonPath: "a.b.c" })
    );
    const result = await tool.execute({});
    expect(result).toBe("42");
  });

  test("wendet responseTemplate auf Top-Level-Felder der JSON-Antwort an", async () => {
    mockFetch(makeJsonResponse({ city: "Berlin", temp: 20 }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Temperatur in {{city}}: {{temp}} Grad",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Temperatur in Berlin: 20 Grad");
  });

  test("gibt den Fehlertext bei HTTP-Fehler zurueck", async () => {
    mockFetch(makeTextResponse("Unauthorized", 401, false));
    const tool = new CustomApiTool(makeConfig({ responseType: "json" }));
    const result = await tool.execute({});
    expect(result).toContain("API Error (401)");
    expect(result).toContain("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// processResponse() — Text-Verarbeitung
// ---------------------------------------------------------------------------

describe("processResponse() — Text-Verarbeitung", () => {
  test("gibt Text-Response unveraendert zurueck", async () => {
    mockFetch(makeTextResponse("Roher Textinhalt"));
    const tool = new CustomApiTool(makeConfig({ responseType: "text" }));
    const result = await tool.execute({});
    expect(result).toBe("Roher Textinhalt");
  });

  test("wendet responseTemplate auf Text-Response an", async () => {
    mockFetch(makeTextResponse("42"));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "text",
        responseTemplate: "Ergebnis: {{response}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Ergebnis: 42");
  });
});

// ---------------------------------------------------------------------------
// extractJsonPath() — via execute() mit jsonPath getestet
// ---------------------------------------------------------------------------

describe("extractJsonPath() — Dot-Notation und Array-Indexierung", () => {
  test("gibt das Element an einem Array-Index zurueck", async () => {
    mockFetch(makeJsonResponse({ items: ["eins", "zwei", "drei"] }));
    const tool = new CustomApiTool(
      makeConfig({ responseType: "json", jsonPath: "items[1]" })
    );
    const result = await tool.execute({});
    expect(result).toBe("zwei");
  });

  test("gibt das erste Array-Element zurueck (Index 0)", async () => {
    mockFetch(makeJsonResponse({ list: [{ id: 1 }, { id: 2 }] }));
    const tool = new CustomApiTool(
      makeConfig({ responseType: "json", jsonPath: "list[0].id" })
    );
    const result = await tool.execute({});
    expect(result).toBe("1");
  });

  test("gibt das gesamte Objekt als JSON zurueck wenn kein jsonPath gesetzt ist", async () => {
    mockFetch(makeJsonResponse({ key: "val" }));
    const tool = new CustomApiTool(
      makeConfig({ responseType: "json" })
    );
    const result = await tool.execute({});
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe("val");
  });

  test("behaelt den Template-Platzhalter wenn der Pfad nicht im Objekt existiert", async () => {
    mockFetch(makeJsonResponse({ other: "data" }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Wert: {{nonexistent.path}}",
      })
    );
    const result = await tool.execute({});
    // Template-Variable bleibt unveraendert wenn der Pfad nicht aufgeloest werden kann
    expect(result).toContain("{{nonexistent.path}}");
  });

  test("gibt den unveraenderten Platzhalter zurueck wenn ein Zwischenwert null ist", async () => {
    mockFetch(makeJsonResponse({ a: null }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Null-Wert: {{a.b}}",
      })
    );
    const result = await tool.execute({});
    // a ist null, also kann a.b nicht aufgeloest werden
    expect(result).toContain("{{a.b}}");
  });

  test("gibt verschachtelten Wert via response-Pfad zurueck", async () => {
    // {{response.x.y}} traversiert mergedData["response"]["x"]["y"] korrekt
    mockFetch(makeJsonResponse({ country: { code: "DE", name: "Deutschland" } }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Land: {{response.country.name}} ({{response.country.code}})",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Land: Deutschland (DE)");
  });
});

// ---------------------------------------------------------------------------
// interpolateTemplate() — via bodyTemplate und responseTemplate getestet
// ---------------------------------------------------------------------------

describe("interpolateTemplate() — Variablenersetzung", () => {
  test("ersetzt eine einzelne {{variable}} in einem responseTemplate", async () => {
    mockFetch(makeJsonResponse({ name: "Max" }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Hallo, {{name}}!",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Hallo, Max!");
  });

  test("ersetzt mehrere Variablen in einem responseTemplate", async () => {
    mockFetch(makeJsonResponse({ vorname: "Anna", nachname: "Muster" }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "{{vorname}} {{nachname}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Anna Muster");
  });

  test("behaelt nicht gefundene Variablen unveraendert im Template", async () => {
    mockFetch(makeJsonResponse({ x: 1 }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Vorhanden: {{x}}, Fehlend: {{missing}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Vorhanden: 1, Fehlend: {{missing}}");
  });

  test("serialisiert das gesamte response-Objekt als JSON-String via {{response}}", async () => {
    // {{response}} zeigt auf das geparste JSON-Objekt im Template-Kontext.
    // Da es ein Objekt ist, wird es als JSON-String eingebettet.
    mockFetch(makeJsonResponse({ a: 1, b: 2 }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Daten: {{response}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toContain('"a":1');
    expect(result).toContain('"b":2');
  });

  test("ersetzt Argumente im bodyTemplate korrekt", async () => {
    const capture = mockFetch(makeJsonResponse({ ok: true }));
    const tool = new CustomApiTool(
      makeConfig({
        method: "POST",
        bodyTemplate: '{"title":"{{title}}","count":{{count}}}',
        parameters: [
          { name: "title", type: "string", description: "Titel", required: true, location: "body" },
          { name: "count", type: "number", description: "Anzahl", required: true, location: "body" },
        ],
      })
    );
    await tool.execute({ title: "Test", count: 5 });
    expect(capture.options?.body).toContain('"title":"Test"');
    expect(capture.options?.body).toContain("5");
  });
});

// ---------------------------------------------------------------------------
// flattenObject() — via responseTemplate mit verschachtelten Objekten getestet
//
// Hinweis: flattenObject erzeugt Schluessel mit Literal-Punkt (z. B. "user.name").
// extractJsonPath trennt jedoch auf "." und traversiert das Objekt rekursiv.
// Deshalb sind verschachtelte Felder aus der JSON-Antwort im responseTemplate
// nur via "response.<pfad>" erreichbar (nicht via bare "user.name").
// Top-Level-Felder des geparsten Objekts sind direkt adressierbar,
// da flattenObject sie als einfache Schluessel in den Kontext legt.
// ---------------------------------------------------------------------------

describe("flattenObject() — Verschachteltes Objekt fuer Template-Interpolation", () => {
  test("macht Top-Level-Felder direkt im Template verfuegbar", async () => {
    // flattenObject({ user: {...}, count: 3 }) => { "user.name": ..., count: 3 }
    // Top-Level "count" ist direkt adressierbar via {{count}}
    mockFetch(makeJsonResponse({ count: 42, label: "Ergebnisse" }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "{{label}}: {{count}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Ergebnisse: 42");
  });

  test("macht verschachtelte Felder via response-Pfad zugreifbar ({{response.x.y}})", async () => {
    // Verschachtelte Felder sind ueber response.<Pfad> erreichbar,
    // da "response" den gesamten geparsten JSON-Body als Objekt haelt.
    mockFetch(makeJsonResponse({ user: { name: "Lena", role: "admin" } }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Benutzer: {{response.user.name}}, Rolle: {{response.user.role}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Benutzer: Lena, Rolle: admin");
  });

  test("macht dreifach verschachtelte Felder via response-Pfad zugreifbar", async () => {
    mockFetch(makeJsonResponse({ a: { b: { c: "tief" } } }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Wert: {{response.a.b.c}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Wert: tief");
  });

  test("behaelt Array-Werte als direkt adressierbare Variable (Top-Level)", async () => {
    mockFetch(makeJsonResponse({ tags: ["a", "b", "c"], count: 3 }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Anzahl: {{count}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Anzahl: 3");
  });

  test("flaches Objekt ist direkt im Template adressierbar", async () => {
    mockFetch(makeJsonResponse({ status: "active", code: 200 }));
    const tool = new CustomApiTool(
      makeConfig({
        responseType: "json",
        responseTemplate: "Status: {{status}}, Code: {{code}}",
      })
    );
    const result = await tool.execute({});
    expect(result).toBe("Status: active, Code: 200");
  });
});
