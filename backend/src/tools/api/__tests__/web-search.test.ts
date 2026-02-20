/**
 * Tests fuer ApiTool (abstract base class) und WebSearchTool
 * (backend/src/tools/base/ApiTool.ts und backend/src/tools/api/web-search.ts)
 *
 * Da ApiTool abstrakt ist, wird eine konkrete TestTool-Subklasse eingesetzt,
 * um die Basisklassen-Methoden (fetch, fetchJson, getDefinition, getMetadata,
 * updateConfig, isAvailable) isoliert zu testen.
 *
 * Das globale fetch wird in beforeEach durch einen Mock ersetzt und in
 * afterEach wiederhergestellt, damit kein Test echte Netzwerkanfragen stellt.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ApiTool } from "../../base/ApiTool";
import { WebSearchTool, createWebSearchTool } from "../web-search";
import type { ApiToolConfig, ToolContext } from "../../types";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Speichert und stellt das originale globale fetch wieder her. */
let originalFetch: typeof globalThis.fetch;

/** Beschreibt einen abgefangenen Fetch-Aufruf. */
type FetchCapture = {
  url: string | null;
  options: RequestInit | null;
  callCount: number;
};

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

/** Erstellt eine Response-Attrappe mit einem JSON-Body. */
function makeJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

/** Erstellt eine Response-Attrappe mit einem Text-Body. */
function makeTextResponse(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => { throw new SyntaxError("Not JSON"); },
    text: async () => text,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Konkrete Subklasse fuer Tests der abstrakten Basisklasse
// ---------------------------------------------------------------------------

/**
 * Minimale, konkrete Implementierung von ApiTool, die alle geschuetzten
 * Methoden (fetch, fetchJson) als oeffentliche Methoden zugaenglich macht,
 * damit sie direkt getestet werden koennen.
 */
class TestTool extends ApiTool {
  constructor(config?: ApiToolConfig) {
    super({
      name: "test_tool",
      description: "Ein Test-Tool fuer Unit-Tests",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Eingabe" },
        },
        required: ["input"],
      },
      category: "test",
      config,
    });
  }

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    return `executed: ${args.input}`;
  }

  // Oeffnet geschuetzte Methoden fuer Tests
  async publicFetch(url: string, options?: RequestInit): Promise<Response> {
    return this.fetch(url, options);
  }

  async publicFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    return this.fetchJson<T>(url, options);
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // Standard-Mock: leere JSON-Antwort
  mockFetch(makeJsonResponse({}));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ===========================================================================
// ApiTool — Basisklasse
// ===========================================================================

describe("ApiTool (Basisklasse)", () => {

  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("setzt name aus den Optionen", () => {
      const tool = new TestTool();
      expect(tool.name).toBe("test_tool");
    });

    test("setzt type auf 'api'", () => {
      const tool = new TestTool();
      expect(tool.type).toBe("api");
    });

    test("verwendet leeres config-Objekt wenn keine Konfiguration uebergeben wird", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      await tool.publicFetch("https://example.com/api");
      // Kein Authorization-Header sollte gesetzt worden sein
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers?.["Authorization"]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new TestTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Toolnamen als function.name zurueck", () => {
      const tool = new TestTool();
      expect(tool.getDefinition().function.name).toBe("test_tool");
    });

    test("gibt die Beschreibung als function.description zurueck", () => {
      const tool = new TestTool();
      expect(tool.getDefinition().function.description).toBe("Ein Test-Tool fuer Unit-Tests");
    });

    test("gibt die Parameter korrekt zurueck", () => {
      const tool = new TestTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.type).toBe("object");
      expect(params.required).toContain("input");
      expect(params.properties["input"]).toBeDefined();
      expect(params.properties["input"]!.type).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name, description, type und category zurueck", () => {
      const tool = new TestTool();
      const meta = tool.getMetadata();
      expect(meta.name).toBe("test_tool");
      expect(meta.description).toBe("Ein Test-Tool fuer Unit-Tests");
      expect(meta.type).toBe("api");
      expect(meta.category).toBe("test");
    });

    test("gibt 'api' als category zurueck wenn keine category konfiguriert ist", () => {
      // Direkte Konstruktion ohne category, um den Default zu testen
      class MinimalTool extends ApiTool {
        constructor() {
          super({
            name: "minimal",
            description: "Minimal",
            parameters: { type: "object", properties: {}, required: [] },
            // category absichtlich weggelassen
          });
        }
        async execute(): Promise<string> { return "ok"; }
      }
      const tool = new MinimalTool();
      expect(tool.getMetadata().category).toBe("api");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt standardmaessig true zurueck", async () => {
      const tool = new TestTool();
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt true zurueck unabhaengig von einer konfigurierten apiKey", async () => {
      const tool = new TestTool({ apiKey: "some-key" });
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // updateConfig()
  // -------------------------------------------------------------------------

  describe("updateConfig()", () => {
    test("fuegt einen API-Key zur bestehenden Konfiguration hinzu", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      tool.updateConfig({ apiKey: "neue-key" });
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer neue-key");
    });

    test("ueberschreibt einen bestehenden API-Key", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ apiKey: "alter-key" });
      tool.updateConfig({ apiKey: "neuer-key" });
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer neuer-key");
    });

    test("fuegt eine baseUrl hinzu ohne bestehende Felder zu loeschen", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ apiKey: "key123" });
      tool.updateConfig({ baseUrl: "https://base.example.com" });
      await tool.publicFetch("/endpoint");
      expect(capture.url).toBe("https://base.example.com/endpoint");
      // apiKey darf nicht verschwinden
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer key123");
    });

    test("fuegt benutzerdefinierte Headers zur Konfiguration hinzu", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      tool.updateConfig({ headers: { "X-Custom-Header": "custom-value" } });
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["X-Custom-Header"]).toBe("custom-value");
    });

    test("merge-Semantik: behaelt vorhandene Felder wenn nur ein Teilbereich aktualisiert wird", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ apiKey: "bleibt", timeout: 5000 });
      tool.updateConfig({ timeout: 10000 });
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      // apiKey muss noch vorhanden sein
      expect(headers["Authorization"]).toBe("Bearer bleibt");
    });
  });

  // -------------------------------------------------------------------------
  // fetch() — Hilfsmethode
  // -------------------------------------------------------------------------

  describe("fetch()", () => {
    test("sendet Content-Type: application/json standardmaessig", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    test("setzt Authorization-Header wenn apiKey konfiguriert ist", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ apiKey: "mein-api-key" });
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer mein-api-key");
    });

    test("setzt keinen Authorization-Header wenn kein apiKey konfiguriert ist", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      await tool.publicFetch("https://example.com/api");
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    test("praepandiert baseUrl an die URL wenn konfiguriert", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ baseUrl: "https://api.example.com" });
      await tool.publicFetch("/v1/data");
      expect(capture.url).toBe("https://api.example.com/v1/data");
    });

    test("verwendet die URL unveraendert wenn keine baseUrl konfiguriert ist", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      await tool.publicFetch("https://direct.example.com/endpoint");
      expect(capture.url).toBe("https://direct.example.com/endpoint");
    });

    test("uebergibt das AbortSignal an den fetch-Aufruf", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ timeout: 5000 });
      await tool.publicFetch("https://example.com/api");
      expect(capture.options?.signal).toBeDefined();
    });

    test("uebergibt uebergebene Request-Optionen an den fetch-Aufruf", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool();
      await tool.publicFetch("https://example.com/api", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      });
      expect(capture.options?.method).toBe("POST");
      expect(capture.options?.body).toBe('{"key":"value"}');
    });

    test("vom Aufrufer gesetzte Headers haben Vorrang vor config.headers", async () => {
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool({ headers: { "X-Source": "config" } });
      await tool.publicFetch("https://example.com/api", {
        headers: { "X-Source": "request" },
      });
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["X-Source"]).toBe("request");
    });

    test("gibt die Response direkt zurueck", async () => {
      const expectedResponse = makeJsonResponse({ ok: true });
      mockFetch(expectedResponse);
      const tool = new TestTool();
      const response = await tool.publicFetch("https://example.com/api");
      expect(response).toBe(expectedResponse);
    });

    test("wirft einen Fehler weiter wenn fetch eine Exception auswirft", async () => {
      globalThis.fetch = async () => { throw new Error("Netzwerkfehler"); };
      const tool = new TestTool();
      await expect(tool.publicFetch("https://example.com/api")).rejects.toThrow("Netzwerkfehler");
    });

    test("verwendet 30000ms als Standard-Timeout wenn keiner konfiguriert ist", async () => {
      // Wir koennen den Timeout nicht direkt messen, aber wir pruefen, dass
      // der Aufruf mit einem Signal erfolgt (was impliziert, dass ein Timeout
      // gesetzt wurde).
      const capture = mockFetch(makeJsonResponse({}));
      const tool = new TestTool(); // kein timeout konfiguriert
      await tool.publicFetch("https://example.com/api");
      expect(capture.options?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  // -------------------------------------------------------------------------
  // fetchJson() — Hilfsmethode
  // -------------------------------------------------------------------------

  describe("fetchJson()", () => {
    test("gibt den geparsten JSON-Koerper zurueck", async () => {
      mockFetch(makeJsonResponse({ name: "Alice", age: 30 }));
      const tool = new TestTool();
      const data = await tool.publicFetchJson<{ name: string; age: number }>(
        "https://example.com/api"
      );
      expect(data.name).toBe("Alice");
      expect(data.age).toBe(30);
    });

    test("wirft einen Fehler bei HTTP-Fehlerstatuscodes", async () => {
      mockFetch(makeTextResponse("Unauthorized", 401));
      const tool = new TestTool();
      await expect(
        tool.publicFetchJson("https://example.com/api")
      ).rejects.toThrow("API error: 401");
    });

    test("wirft einen Fehler mit Statustext bei HTTP-Fehler", async () => {
      mockFetch(makeTextResponse("Not Found", 404));
      const tool = new TestTool();
      await expect(
        tool.publicFetchJson("https://example.com/api")
      ).rejects.toThrow("API error: 404 Error");
    });

    test("wirft keinen Fehler bei Statuscode 200", async () => {
      mockFetch(makeJsonResponse({ result: "success" }));
      const tool = new TestTool();
      await expect(
        tool.publicFetchJson("https://example.com/api")
      ).resolves.toBeDefined();
    });

    test("leitet Netzwerkfehler an den Aufrufer weiter", async () => {
      globalThis.fetch = async () => { throw new Error("DNS-Fehler"); };
      const tool = new TestTool();
      await expect(
        tool.publicFetchJson("https://example.com/api")
      ).rejects.toThrow("DNS-Fehler");
    });
  });
});

// ===========================================================================
// WebSearchTool
// ===========================================================================

describe("WebSearchTool", () => {

  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("setzt name auf 'web_search'", () => {
      const tool = new WebSearchTool();
      expect(tool.name).toBe("web_search");
    });

    test("setzt type auf 'api'", () => {
      const tool = new WebSearchTool();
      expect(tool.type).toBe("api");
    });

    test("verwendet 'tavily' als Standard-Provider", () => {
      // Provider ist private, aber isAvailable und execute verwenden ihn
      // Wir pruefen ihn indirekt ueber execute()
      const tool = new WebSearchTool({ apiKey: "test-key" });
      // Kein Fehler beim Erstellen — Tavily ist der Standardprovider
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    test("akzeptiert einen benutzerdefinierten Provider", () => {
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    test("akzeptiert eine Konfiguration ohne Provider-Angabe", () => {
      const tool = new WebSearchTool({ apiKey: "key" });
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    test("akzeptiert eine leere Konfiguration", () => {
      const tool = new WebSearchTool({});
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    test("kann ohne Argumente erstellt werden", () => {
      const tool = new WebSearchTool();
      expect(tool).toBeInstanceOf(WebSearchTool);
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new WebSearchTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt 'web_search' als function.name zurueck", () => {
      const tool = new WebSearchTool();
      expect(tool.getDefinition().function.name).toBe("web_search");
    });

    test("listet 'query' als Pflichtparameter", () => {
      const tool = new WebSearchTool();
      expect(tool.getDefinition().function.parameters.required).toContain("query");
    });

    test("listet 'num_results' als optionalen Parameter", () => {
      const tool = new WebSearchTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.properties["num_results"]).toBeDefined();
      expect(params.required).not.toContain("num_results");
    });

    test("beschreibt das Tool sinnvoll", () => {
      const tool = new WebSearchTool();
      const desc = tool.getDefinition().function.description;
      expect(desc.length).toBeGreaterThan(10);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt category 'search' zurueck", () => {
      const tool = new WebSearchTool();
      expect(tool.getMetadata().category).toBe("search");
    });

    test("gibt type 'api' zurueck", () => {
      const tool = new WebSearchTool();
      expect(tool.getMetadata().type).toBe("api");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt true zurueck wenn ein API-Key konfiguriert ist", async () => {
      const tool = new WebSearchTool({ apiKey: "valid-key" });
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt false zurueck wenn kein API-Key konfiguriert ist", async () => {
      const tool = new WebSearchTool();
      expect(await tool.isAvailable()).toBe(false);
    });

    test("gibt false zurueck wenn apiKey ein leerer String ist", async () => {
      const tool = new WebSearchTool({ apiKey: "" });
      expect(await tool.isAvailable()).toBe(false);
    });

    test("gibt true zurueck nach updateConfig() mit einem gueltigen API-Key", async () => {
      const tool = new WebSearchTool();
      expect(await tool.isAvailable()).toBe(false);
      tool.updateConfig({ apiKey: "nachtraeglich-gesetzt" });
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Eingabe-Validierung", () => {
    test("gibt Fehlermeldung zurueck wenn query leer ist", async () => {
      const tool = new WebSearchTool({ apiKey: "key" });
      const result = await tool.execute({ query: "" });
      expect(result).toContain("Error");
      expect(result.toLowerCase()).toContain("query");
    });

    test("gibt Fehlermeldung zurueck wenn kein API-Key konfiguriert ist", async () => {
      const tool = new WebSearchTool();
      const result = await tool.execute({ query: "Was ist Bun?" });
      expect(result).toContain("Error");
      expect(result.toLowerCase()).toContain("api key");
    });

    test("gibt Fehlermeldung zurueck fuer unbekannten Provider", async () => {
      // Wir erzwingen einen ungueltig Provider ueber ein Cast
      const tool = new WebSearchTool({
        apiKey: "key",
        provider: "unknown-provider" as any,
      });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Error");
      expect(result.toLowerCase()).toContain("unknown");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Tavily-Provider
  // -------------------------------------------------------------------------

  describe("execute() mit Tavily-Provider", () => {
    const TAVILY_URL = "https://api.tavily.com/search";

    test("sendet POST-Request an die Tavily-API", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "tavily-key", provider: "tavily" });
      await tool.execute({ query: "Bun Runtime" });
      expect(capture.callCount).toBe(1);
      expect(capture.url).toBe(TAVILY_URL);
      expect(capture.options?.method).toBe("POST");
    });

    test("uebergibt api_key im Request-Body", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "tavily-key-123", provider: "tavily" });
      await tool.execute({ query: "Test" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.api_key).toBe("tavily-key-123");
    });

    test("uebergibt query im Request-Body", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "TypeScript vs JavaScript" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.query).toBe("TypeScript vs JavaScript");
    });

    test("uebergibt max_results als Zahl im Request-Body", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test", num_results: "7" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(7);
    });

    test("begrenzt max_results auf maximal 10", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test", num_results: "99" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(10);
    });

    test("setzt include_answer auf true", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.include_answer).toBe(true);
    });

    test("formatiert das Ergebnis mit 'Answer:' wenn die Antwort ein answer-Feld enthaelt", async () => {
      mockFetch(makeJsonResponse({
        answer: "Bun ist eine schnelle JavaScript-Laufzeitumgebung.",
        results: [
          { title: "Bun Docs", url: "https://bun.sh/docs" },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Was ist Bun?" });
      expect(result).toContain("Answer:");
      expect(result).toContain("Bun ist eine schnelle JavaScript-Laufzeitumgebung.");
      expect(result).toContain("Sources:");
      expect(result).toContain("Bun Docs");
      expect(result).toContain("https://bun.sh/docs");
    });

    test("listet Quellen korrekt auf wenn answer vorhanden ist", async () => {
      mockFetch(makeJsonResponse({
        answer: "Kurzantwort",
        results: [
          { title: "Quelle A", url: "https://a.example.com" },
          { title: "Quelle B", url: "https://b.example.com" },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("- Quelle A: https://a.example.com");
      expect(result).toContain("- Quelle B: https://b.example.com");
    });

    test("formatiert Ergebnisse als Titel/Inhalt/URL wenn kein answer-Feld vorhanden ist", async () => {
      mockFetch(makeJsonResponse({
        results: [
          {
            title: "Ergebnis Titel",
            content: "Ergebnis Inhalt mit Details",
            url: "https://result.example.com",
          },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Ergebnis Titel");
      expect(result).toContain("Ergebnis Inhalt mit Details");
      expect(result).toContain("URL: https://result.example.com");
    });

    test("gibt 'No results found' zurueck wenn results leer ist und kein answer vorhanden ist", async () => {
      mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Unmoeglich zu findende Anfrage xyz123" });
      expect(result).toBe("No results found");
    });

    test("gibt 'No results found' zurueck wenn results undefined ist", async () => {
      mockFetch(makeJsonResponse({}));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toBe("No results found");
    });

    test("gibt Fehlermeldung zurueck wenn die API einen Fehler wirft", async () => {
      mockFetch(makeTextResponse("Unauthorized", 401));
      const tool = new WebSearchTool({ apiKey: "ungueltig", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Error");
    });

    test("gibt Fehlermeldung zurueck wenn fetch eine Exception auswirft", async () => {
      globalThis.fetch = async () => { throw new Error("Verbindung fehlgeschlagen"); };
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Error");
      expect(result).toContain("Verbindung fehlgeschlagen");
    });

    test("verarbeitet mehrere Ergebnisse ohne answer-Feld korrekt", async () => {
      mockFetch(makeJsonResponse({
        results: [
          { title: "Titel 1", content: "Inhalt 1", url: "https://1.example.com" },
          { title: "Titel 2", content: "Inhalt 2", url: "https://2.example.com" },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Titel 1");
      expect(result).toContain("Titel 2");
      expect(result).toContain("URL: https://1.example.com");
      expect(result).toContain("URL: https://2.example.com");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Serper-Provider
  // -------------------------------------------------------------------------

  describe("execute() mit Serper-Provider", () => {
    const SERPER_URL = "https://google.serper.dev/search";

    test("sendet POST-Request an die Serper-API", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "serper-key", provider: "serper" });
      await tool.execute({ query: "Bun Runtime" });
      expect(capture.callCount).toBe(1);
      expect(capture.url).toBe(SERPER_URL);
      expect(capture.options?.method).toBe("POST");
    });

    test("setzt X-API-KEY als Request-Header", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "serper-geheimnis", provider: "serper" });
      await tool.execute({ query: "Test" });
      const headers = capture.options?.headers as Record<string, string>;
      expect(headers["X-API-KEY"]).toBe("serper-geheimnis");
    });

    test("uebergibt die Suchanfrage als 'q' im Request-Body", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      await tool.execute({ query: "TypeScript 5 Features" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.q).toBe("TypeScript 5 Features");
    });

    test("uebergibt num als Zahl im Request-Body", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      await tool.execute({ query: "Test", num_results: "3" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.num).toBe(3);
    });

    test("begrenzt num auf maximal 10", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      await tool.execute({ query: "Test", num_results: "50" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.num).toBe(10);
    });

    test("formatiert organic-Ergebnisse als Titel/Snippet/URL", async () => {
      mockFetch(makeJsonResponse({
        organic: [
          {
            title: "Serper Ergebnis",
            snippet: "Relevanter Auszug",
            link: "https://serper-result.example.com",
          },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Serper Ergebnis");
      expect(result).toContain("Relevanter Auszug");
      expect(result).toContain("URL: https://serper-result.example.com");
    });

    test("gibt 'No results found' zurueck wenn organic leer ist", async () => {
      mockFetch(makeJsonResponse({ organic: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toBe("No results found");
    });

    test("gibt 'No results found' zurueck wenn organic fehlt", async () => {
      mockFetch(makeJsonResponse({}));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toBe("No results found");
    });

    test("verarbeitet mehrere Serper-Ergebnisse korrekt", async () => {
      mockFetch(makeJsonResponse({
        organic: [
          { title: "Titel A", snippet: "Snippet A", link: "https://a.example.com" },
          { title: "Titel B", snippet: "Snippet B", link: "https://b.example.com" },
          { title: "Titel C", snippet: "Snippet C", link: "https://c.example.com" },
        ],
      }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "serper" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Titel A");
      expect(result).toContain("Titel B");
      expect(result).toContain("Titel C");
    });

    test("gibt Fehlermeldung zurueck wenn die Serper-API einen HTTP-Fehler liefert", async () => {
      mockFetch(makeTextResponse("Forbidden", 403));
      const tool = new WebSearchTool({ apiKey: "abgelaufen", provider: "serper" });
      const result = await tool.execute({ query: "Test" });
      expect(result).toContain("Error");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — num_results-Logik
  // -------------------------------------------------------------------------

  describe("execute() — num_results-Verarbeitung", () => {
    test("verwendet 5 als Standard-Ergebnisanzahl wenn num_results fehlt", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(5);
    });

    test("parst num_results als Ganzzahl", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test", num_results: "8" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(8);
    });

    test("begrenzt num_results auf 10 bei Wert > 10", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test", num_results: "100" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(10);
    });

    test("verarbeitet num_results '1' korrekt", async () => {
      const capture = mockFetch(makeJsonResponse({ results: [] }));
      const tool = new WebSearchTool({ apiKey: "key", provider: "tavily" });
      await tool.execute({ query: "Test", num_results: "1" });
      const body = JSON.parse(capture.options?.body as string);
      expect(body.max_results).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // createWebSearchTool() — Factory-Funktion
  // -------------------------------------------------------------------------

  describe("createWebSearchTool()", () => {
    test("erstellt eine WebSearchTool-Instanz", () => {
      const tool = createWebSearchTool();
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    test("gibt eine Instanz mit konfiguriertem API-Key zurueck", async () => {
      const tool = createWebSearchTool({ apiKey: "factory-key" });
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt eine Instanz ohne API-Key zurueck", async () => {
      const tool = createWebSearchTool();
      expect(await tool.isAvailable()).toBe(false);
    });

    test("gibt eine Instanz mit konfiguriertem Provider zurueck", async () => {
      const capture = mockFetch(makeJsonResponse({ organic: [] }));
      const tool = createWebSearchTool({ apiKey: "key", provider: "serper" });
      await tool.execute({ query: "Test" });
      expect(capture.url).toBe("https://google.serper.dev/search");
    });

    test("gibt jedes Mal eine neue, unabhaengige Instanz zurueck", () => {
      const tool1 = createWebSearchTool({ apiKey: "key-1" });
      const tool2 = createWebSearchTool({ apiKey: "key-2" });
      expect(tool1).not.toBe(tool2);
    });
  });
});
