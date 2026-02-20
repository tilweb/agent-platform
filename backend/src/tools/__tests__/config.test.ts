/**
 * Tests für backend/src/tools/config.ts
 *
 * Da toolsConfig ein Modul-Level-Singleton ist, der process.env zum Import-Zeitpunkt
 * auswertet, manipulieren wir toolsConfig.api direkt, um verschiedene Konfigurationen
 * zu simulieren. afterEach stellt den ursprünglichen Zustand wieder her.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { toolsConfig, isToolConfigured, getConfiguredApiTools } from "../config";
import type { ApiToolConfig } from "../types";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Speichert den originalen api-Zustand und stellt ihn nach jedem Test wieder her. */
let originalApi: Record<string, ApiToolConfig>;

// ---------------------------------------------------------------------------

describe("tools/config", () => {
  beforeEach(() => {
    // Snapshot der originalen API-Konfiguration erstellen
    originalApi = { ...toolsConfig.api };
  });

  afterEach(() => {
    // Originalen Zustand wiederherstellen, damit Tests unabhängig bleiben
    toolsConfig.api = { ...originalApi };
  });

  // -------------------------------------------------------------------------

  describe("toolsConfig – Struktur", () => {
    test("sollte ein dataDir-Feld exportieren", () => {
      expect(toolsConfig.dataDir).toBeDefined();
      expect(typeof toolsConfig.dataDir).toBe("string");
      expect(toolsConfig.dataDir.length).toBeGreaterThan(0);
    });

    test("sollte ein api-Objekt exportieren", () => {
      expect(toolsConfig.api).toBeDefined();
      expect(typeof toolsConfig.api).toBe("object");
    });

    test("sollte ein mcp-Array exportieren", () => {
      expect(toolsConfig.mcp).toBeDefined();
      expect(Array.isArray(toolsConfig.mcp)).toBe(true);
    });

    test("sollte ein disabled-Array exportieren", () => {
      expect(toolsConfig.disabled).toBeDefined();
      expect(Array.isArray(toolsConfig.disabled)).toBe(true);
    });

    test("sollte web_search als bekannte API-Konfiguration enthalten", () => {
      expect(toolsConfig.api).toHaveProperty("web_search");
      expect(typeof toolsConfig.api.web_search).toBe("object");
    });

    test("sollte keinen enabled-Filter standardmäßig setzen (undefined)", () => {
      // enabled ist optional — standardmäßig sind alle Tools aktiviert
      expect(toolsConfig.enabled).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------

  describe("isToolConfigured()", () => {
    test("sollte true zurückgeben wenn der apiKey gesetzt ist", () => {
      toolsConfig.api["test_tool"] = { apiKey: "sk-test-key-123" };
      expect(isToolConfigured("test_tool")).toBe(true);
    });

    test("sollte false zurückgeben wenn das Tool gar nicht in api existiert", () => {
      delete toolsConfig.api["nonexistent_tool"];
      expect(isToolConfigured("nonexistent_tool")).toBe(false);
    });

    test("sollte false zurückgeben wenn apiKey undefined ist", () => {
      toolsConfig.api["test_tool"] = { apiKey: undefined };
      expect(isToolConfigured("test_tool")).toBe(false);
    });

    test("sollte false zurückgeben wenn apiKey ein leerer String ist", () => {
      toolsConfig.api["test_tool"] = { apiKey: "" };
      expect(isToolConfigured("test_tool")).toBe(false);
    });

    test("sollte true zurückgeben wenn nur apiKey gesetzt ist (ohne baseUrl)", () => {
      toolsConfig.api["search"] = { apiKey: "valid-key" };
      expect(isToolConfigured("search")).toBe(true);
    });

    test("sollte false zurückgeben wenn nur baseUrl ohne apiKey konfiguriert ist", () => {
      toolsConfig.api["open_api"] = { baseUrl: "https://example.com/api" };
      expect(isToolConfigured("open_api")).toBe(false);
    });

    test("sollte false zurückgeben bei leerem toolsConfig.api", () => {
      toolsConfig.api = {};
      expect(isToolConfigured("anything")).toBe(false);
    });

    test("sollte mehrere unabhängige Tools korrekt prüfen", () => {
      toolsConfig.api["configured_tool"] = { apiKey: "key-abc" };
      toolsConfig.api["unconfigured_tool"] = { apiKey: undefined };

      expect(isToolConfigured("configured_tool")).toBe(true);
      expect(isToolConfigured("unconfigured_tool")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("getConfiguredApiTools()", () => {
    test("sollte eine leere Liste zurückgeben wenn kein Tool einen apiKey hat", () => {
      toolsConfig.api = {};
      expect(getConfiguredApiTools()).toEqual([]);
    });

    test("sollte den Namen eines konfigurierten Tools zurückgeben", () => {
      toolsConfig.api = { weather: { apiKey: "weather-key-xyz" } };
      const result = getConfiguredApiTools();
      expect(result).toEqual(["weather"]);
    });

    test("sollte mehrere konfigurierte Tools zurückgeben", () => {
      toolsConfig.api = {
        web_search: { apiKey: "tavily-key" },
        translation: { apiKey: "deepl-key" },
      };
      const result = getConfiguredApiTools();
      expect(result).toHaveLength(2);
      expect(result).toContain("web_search");
      expect(result).toContain("translation");
    });

    test("sollte Tools ohne apiKey herausfiltern", () => {
      toolsConfig.api = {
        configured: { apiKey: "real-key" },
        unconfigured: { apiKey: undefined },
        empty_key: { apiKey: "" },
      };
      const result = getConfiguredApiTools();
      expect(result).toEqual(["configured"]);
    });

    test("sollte nur Tool-Namen (Strings) zurückgeben", () => {
      toolsConfig.api = {
        tool_a: { apiKey: "key-a" },
        tool_b: { apiKey: "key-b" },
      };
      const result = getConfiguredApiTools();
      result.forEach((name) => expect(typeof name).toBe("string"));
    });

    test("sollte eine leere Liste zurückgeben wenn alle Tools leere apiKeys haben", () => {
      toolsConfig.api = {
        tool_a: { apiKey: "" },
        tool_b: { apiKey: "" },
      };
      expect(getConfiguredApiTools()).toEqual([]);
    });

    test("sollte Tools mit zusätzlichen Feldern (baseUrl, timeout) korrekt einschließen", () => {
      toolsConfig.api = {
        full_config: {
          apiKey: "full-key",
          baseUrl: "https://api.example.com",
          timeout: 5000,
        },
      };
      const result = getConfiguredApiTools();
      expect(result).toContain("full_config");
    });
  });

  // -------------------------------------------------------------------------

  describe("Konsistenz zwischen isToolConfigured() und getConfiguredApiTools()", () => {
    test("sollte identische Ergebnisse für gemischte Konfiguration liefern", () => {
      toolsConfig.api = {
        active_tool: { apiKey: "some-key" },
        inactive_tool: { apiKey: undefined },
        partial_tool: { baseUrl: "https://example.com" },
      };

      const configuredList = getConfiguredApiTools();

      // Jedes Tool in der Liste sollte auch isToolConfigured() == true haben
      for (const name of configuredList) {
        expect(isToolConfigured(name)).toBe(true);
      }

      // Tools, die nicht in der Liste sind, sollten isToolConfigured() == false haben
      const allToolNames = Object.keys(toolsConfig.api);
      for (const name of allToolNames) {
        if (!configuredList.includes(name)) {
          expect(isToolConfigured(name)).toBe(false);
        }
      }
    });
  });
});
