/**
 * Tests fuer BraveSearchTool
 * (backend/src/tools/api/brave-search.ts)
 *
 * Das globale fetch wird in beforeEach durch einen Mock ersetzt und in
 * afterEach wiederhergestellt, damit kein Test echte Netzwerkanfragen stellt.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { BraveSearchTool, createBraveSearchTool } from "../brave-search";
import type { BraveSearchConfig } from "../brave-search";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

type FetchCapture = {
  url: string | null;
  options: RequestInit | null;
  callCount: number;
};

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  query: {
    original: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // Standard-Mock: leere Suchantwort
  mockFetch(makeSearchResponse([]));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Ersetzt globalThis.fetch durch einen Mock, der die uebergebene Response
 * liefert. Gibt ein capture-Objekt zurueck, das nach dem Aufruf ausgelesen
 * werden kann.
 */
function mockFetch(response: Response): FetchCapture {
  const capture: FetchCapture = { url: null, options: null, callCount: 0 };
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    capture.url = input.toString();
    capture.options = init ?? null;
    capture.callCount++;
    return response;
  };
  return capture;
}

/**
 * Erstellt eine BraveSearch-Response-Attrappe mit den angegebenen Ergebnissen.
 */
function makeSearchResponse(results: BraveSearchResult[], query = "test"): Response {
  const data: BraveSearchResponse = {
    query: { original: query },
    web: results.length > 0 ? { results } : undefined,
  };
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

/**
 * Erstellt eine BraveSearch-Response mit explizitem web-Objekt (auch bei leerer Liste).
 */
function makeSearchResponseWithEmptyWeb(query = "test"): Response {
  const data: BraveSearchResponse = {
    query: { original: query },
    web: { results: [] },
  };
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

/**
 * Erstellt eine Fehler-Response-Attrappe.
 */
function makeErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    statusText: "Error",
    json: async () => { throw new SyntaxError("Not JSON"); },
    text: async () => text,
  } as unknown as Response;
}

/**
 * Erstellt ein einzelnes Suchergebnis.
 */
function makeResult(
  title: string,
  description: string,
  url: string,
  age?: string
): BraveSearchResult {
  const result: BraveSearchResult = { title, description, url };
  if (age !== undefined) {
    result.age = age;
  }
  return result;
}

// ===========================================================================
// BraveSearchTool
// ===========================================================================

describe("BraveSearchTool", () => {

  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("setzt name auf 'brave_search'", () => {
      const tool = new BraveSearchTool();
      expect(tool.name).toBe("brave_search");
    });

    test("setzt type auf 'api'", () => {
      const tool = new BraveSearchTool();
      expect(tool.type).toBe("api");
    });

    test("setzt baseUrl auf 'https://api.search.brave.com'", async () => {
      const config: BraveSearchConfig = { apiKey: "test-key" };
      const tool = new BraveSearchTool(config);
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      await tool.execute({ query: "test" });
      expect(capture.url).toMatch(/^https:\/\/api\.search\.brave\.com/);
    });

    test("akzeptiert eine benutzerdefinierte apiKey-Konfiguration", async () => {
      const tool = new BraveSearchTool({ apiKey: "my-brave-key-123" });
      expect(await tool.isAvailable()).toBe(true);
    });

    test("kann ohne Argumente erstellt werden", () => {
      const tool = new BraveSearchTool();
      expect(tool).toBeInstanceOf(BraveSearchTool);
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new BraveSearchTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt 'brave_search' als function.name zurueck", () => {
      const tool = new BraveSearchTool();
      expect(tool.getDefinition().function.name).toBe("brave_search");
    });

    test("listet 'query' als Pflichtparameter", () => {
      const tool = new BraveSearchTool();
      expect(tool.getDefinition().function.parameters.required).toContain("query");
    });

    test("listet 'count' als optionalen Parameter", () => {
      const tool = new BraveSearchTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.properties["count"]).toBeDefined();
      expect(params.required).not.toContain("count");
    });

    test("listet 'language' als optionalen Parameter", () => {
      const tool = new BraveSearchTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.properties["language"]).toBeDefined();
      expect(params.required).not.toContain("language");
    });

    test("enthält eine sinnvolle Beschreibung", () => {
      const tool = new BraveSearchTool();
      const desc = tool.getDefinition().function.description;
      expect(desc.length).toBeGreaterThan(10);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'brave_search' zurueck", () => {
      const tool = new BraveSearchTool();
      expect(tool.getMetadata().name).toBe("brave_search");
    });

    test("gibt type 'api' zurueck", () => {
      const tool = new BraveSearchTool();
      expect(tool.getMetadata().type).toBe("api");
    });

    test("gibt category 'search' zurueck", () => {
      const tool = new BraveSearchTool();
      expect(tool.getMetadata().category).toBe("search");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt true zurueck wenn ein API-Key konfiguriert ist", async () => {
      const tool = new BraveSearchTool({ apiKey: "valid-key" });
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt false zurueck wenn kein API-Key konfiguriert ist", async () => {
      const tool = new BraveSearchTool();
      expect(await tool.isAvailable()).toBe(false);
    });

    test("gibt false zurueck wenn apiKey ein leerer String ist", async () => {
      const tool = new BraveSearchTool({ apiKey: "" });
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("gibt Fehlermeldung zurueck wenn query ein leerer String ist", async () => {
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "" });
      expect(result).toContain("Error");
      expect(result.toLowerCase()).toContain("query");
    });

    test("gibt Fehlermeldung mit BRAVE_API_KEY-Hinweis zurueck wenn kein API-Key konfiguriert ist", async () => {
      const tool = new BraveSearchTool();
      const result = await tool.execute({ query: "TypeScript" });
      expect(result).toContain("Error");
      expect(result).toContain("BRAVE_API_KEY");
    });

    test("gibt Fehlermeldung zurueck wenn query null ist", async () => {
      const tool = new BraveSearchTool({ apiKey: "key" });
      // null wird als falsy behandelt, daher sollte die Validierung anschlagen
      const result = await tool.execute({ query: null as unknown as string });
      expect(result).toContain("Error");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — API-Aufruf
  // -------------------------------------------------------------------------

  describe("execute() — API-Aufruf", () => {
    test("ruft den korrekten URL-Pfad /res/v1/web/search auf", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Bun Runtime" });
      expect(capture.url).toContain("/res/v1/web/search");
    });

    test("sendet X-Subscription-Token-Header mit dem API-Key", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "mein-brave-key" });
      await tool.execute({ query: "Test" });
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["X-Subscription-Token"]).toBe("mein-brave-key");
    });

    test("sendet Accept: application/json-Header", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test" });
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
    });

    test("sendet count=5 als Standard wenn count nicht angegeben wird", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test" });
      expect(capture.url).toContain("count=5");
    });

    test("sendet benutzerdefinierten count-Wert in den Parametern", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test", count: "8" });
      expect(capture.url).toContain("count=8");
    });

    test("begrenzt count auf maximal 20", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test", count: "99" });
      expect(capture.url).toContain("count=20");
    });

    test("sendet search_lang='de' als Standard wenn language nicht angegeben wird", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test" });
      expect(capture.url).toContain("search_lang=de");
    });

    test("sendet benutzerdefinierte language als search_lang durch", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test", language: "en" });
      expect(capture.url).toContain("search_lang=en");
    });

    test("sendet text_decorations=false in den URL-Parametern", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Test" });
      expect(capture.url).toContain("text_decorations=false");
    });

    test("sendet die Suchanfrage als q-Parameter in der URL", async () => {
      const capture = mockFetch(makeSearchResponse([makeResult("T", "D", "https://example.com")]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      await tool.execute({ query: "Hono Framework" });
      expect(capture.url).toContain("q=Hono+Framework");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Ergebnisformatierung
  // -------------------------------------------------------------------------

  describe("execute() — Ergebnisformatierung", () => {
    test("formatiert Ergebnisse mit nummerierter Liste", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Ergebnis Eins", "Beschreibung 1", "https://eins.example.com"),
        makeResult("Ergebnis Zwei", "Beschreibung 2", "https://zwei.example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("1. Ergebnis Eins");
      expect(result).toContain("2. Ergebnis Zwei");
    });

    test("enthält Titel des Ergebnisses", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Wichtiger Artikel", "Kurze Beschreibung", "https://example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("Wichtiger Artikel");
    });

    test("enthält Beschreibung des Ergebnisses", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel", "Eine detaillierte Beschreibung des Inhalts", "https://example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("Eine detaillierte Beschreibung des Inhalts");
    });

    test("enthält URL des Ergebnisses", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel", "Beschreibung", "https://meine-seite.example.com/pfad"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("URL: https://meine-seite.example.com/pfad");
    });

    test("enthält age in Klammern wenn vorhanden", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel", "Beschreibung", "https://example.com", "2 Stunden"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("(2 Stunden)");
    });

    test("laesst age weg wenn nicht vorhanden", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel", "Beschreibung", "https://example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      // Kein Muster "(..." ohne echten age-Wert
      expect(result).not.toMatch(/\(\s*\)/);
    });

    test("trennt mehrere Ergebnisse durch doppelten Zeilenumbruch", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel A", "Beschreibung A", "https://a.example.com"),
        makeResult("Titel B", "Beschreibung B", "https://b.example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      // Zwei aufeinander folgende Zeilenumbrueche zwischen Ergebnissen
      expect(result).toContain("\n\n");
    });

    test("beginnt mit 'Search results for \"<query>\":'", async () => {
      mockFetch(makeSearchResponse([
        makeResult("Titel", "Beschreibung", "https://example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "meine Suche" });
      expect(result).toMatch(/^Search results for "meine Suche":/);
    });

    test("gibt 'No results found'-Meldung zurueck wenn keine Ergebnisse vorhanden sind", async () => {
      mockFetch(makeSearchResponse([]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "unbekannte anfrage xyz" });
      expect(result).toContain("No results found");
    });

    test("gibt 'No results found'-Meldung zurueck wenn web.results leer ist", async () => {
      mockFetch(makeSearchResponseWithEmptyWeb("test"));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("No results found");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("gibt Fehlermeldung mit HTTP-Statuscode zurueck bei API-Fehlerantwort", async () => {
      mockFetch(makeErrorResponse(401, "Unauthorized"));
      const tool = new BraveSearchTool({ apiKey: "ungueltig" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Error");
      expect(result).toContain("401");
    });

    test("gibt 'Error: Brave Search API returned {status}' bei HTTP-Fehler zurueck", async () => {
      mockFetch(makeErrorResponse(429, "Too Many Requests"));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toBe("Error: Brave Search API returned 429: Too Many Requests");
    });

    test("gibt 'Error searching: {message}' bei Netzwerkfehler zurueck", async () => {
      globalThis.fetch = async () => { throw new Error("Verbindung verweigert"); };
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toBe("Error searching: Verbindung verweigert");
    });

    test("gibt 'No results found' zurueck wenn web in der Antwort fehlt", async () => {
      const dataWithoutWeb = {
        query: { original: "test" },
        // web ist absichtlich nicht vorhanden
      };
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => dataWithoutWeb,
        text: async () => JSON.stringify(dataWithoutWeb),
      } as unknown as Response);
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test" });
      expect(result).toContain("No results found");
    });

    test("slice respektiert den numResults-Wert und gibt nicht mehr Ergebnisse zurueck", async () => {
      // API liefert 5 Ergebnisse, wir fragen nur 2 an
      mockFetch(makeSearchResponse([
        makeResult("Titel 1", "Beschreibung 1", "https://1.example.com"),
        makeResult("Titel 2", "Beschreibung 2", "https://2.example.com"),
        makeResult("Titel 3", "Beschreibung 3", "https://3.example.com"),
        makeResult("Titel 4", "Beschreibung 4", "https://4.example.com"),
        makeResult("Titel 5", "Beschreibung 5", "https://5.example.com"),
      ]));
      const tool = new BraveSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "test", count: "2" });
      expect(result).toContain("Titel 1");
      expect(result).toContain("Titel 2");
      expect(result).not.toContain("Titel 3");
    });
  });

  // -------------------------------------------------------------------------
  // createBraveSearchTool() — Factory-Funktion
  // -------------------------------------------------------------------------

  describe("createBraveSearchTool()", () => {
    test("erstellt eine BraveSearchTool-Instanz", () => {
      const tool = createBraveSearchTool();
      expect(tool).toBeInstanceOf(BraveSearchTool);
    });

    test("erstellt eine Instanz mit konfiguriertem API-Key", async () => {
      const tool = createBraveSearchTool({ apiKey: "factory-key" });
      expect(await tool.isAvailable()).toBe(true);
    });

    test("erstellt eine Instanz ohne API-Key wenn keine Konfiguration angegeben wird", async () => {
      const tool = createBraveSearchTool();
      expect(await tool.isAvailable()).toBe(false);
    });
  });
});
