/**
 * Tests fuer UserMemoryTool (backend/src/tools/special/user-memory.ts)
 *
 * Alle Aufrufe an den userMemory-Service werden per mock.module() abgefangen,
 * damit kein echter Dateisystemzugriff stattfindet.
 * mock.module()-Aufrufe muessen VOR dem dynamischen Import des Moduls stehen
 * (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Pfade in mock.module() sind relativ zur Testdatei. Der Service liegt in
 * src/services/userMemory, die Testdatei in src/tools/special/__tests__/,
 * daher zeigt der Pfad auf ../../../services/userMemory.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Stored data returned by loadUserMemory
  memory: {
    about: [{ id: "about_1", content: "Entwickler bei TechCorp", added_at: "2026-01-01T00:00:00.000Z", source: "manual" }],
    instructions: [{ id: "inst_1", content: "Immer auf Deutsch antworten", priority: "high", added_at: "2026-01-01T00:00:00.000Z", source: "manual" }],
    context: [{ id: "ctx_1", name: "Agent Platform", description: "Multi-Agent System", active: true, added_at: "2026-01-01T00:00:00.000Z", source: "agent" }],
  } as Record<string, any>,

  // Control which functions succeed or throw
  loadError: null as Error | null,
  addAboutItemResult: { id: "about_new", content: "neuer Inhalt", added_at: "2026-01-01T00:00:00.000Z", source: "agent" } as any,
  addAboutItemError: null as Error | null,
  addInstructionResult: { id: "inst_new", content: "neue Anweisung", priority: "normal", added_at: "2026-01-01T00:00:00.000Z", source: "agent" } as any,
  addInstructionError: null as Error | null,
  addContextItemResult: { id: "ctx_new", name: "Neues Projekt", description: "Beschreibung", active: true, added_at: "2026-01-01T00:00:00.000Z", source: "agent" } as any,
  addContextItemError: null as Error | null,
  deleteMemoryItemResult: true as boolean,
  deleteMemoryItemError: null as Error | null,
  setContextActiveResult: true as boolean,
  setContextActiveError: null as Error | null,
  isValidSectionResult: true as boolean,
  getAllSectionsResult: ["about", "instructions", "context"] as string[],

  // Capture arguments for verification
  lastAddAboutArgs: null as any,
  lastAddInstructionArgs: null as any,
  lastAddContextArgs: null as any,
  lastDeleteArgs: null as any,
  lastSetContextActiveArgs: null as any,
  lastIsValidSectionArg: null as string | null,
};

// ---------------------------------------------------------------------------
// Module mock — must be declared BEFORE importing the module under test.
// Path is relative to THIS test file.
// ---------------------------------------------------------------------------

mock.module("../../../services/userMemory", () => ({
  loadUserMemory: async (_userId?: string) => {
    if (mockState.loadError) throw mockState.loadError;
    return mockState.memory;
  },
  addAboutItem: async (content: string, source: string, _userId?: string) => {
    mockState.lastAddAboutArgs = { content, source };
    if (mockState.addAboutItemError) throw mockState.addAboutItemError;
    return mockState.addAboutItemResult;
  },
  addInstruction: async (content: string, priority: string, source: string, _userId?: string) => {
    mockState.lastAddInstructionArgs = { content, priority, source };
    if (mockState.addInstructionError) throw mockState.addInstructionError;
    return mockState.addInstructionResult;
  },
  addContextItem: async (name: string, description: string | undefined, active: boolean, source: string, _userId?: string) => {
    mockState.lastAddContextArgs = { name, description, active, source };
    if (mockState.addContextItemError) throw mockState.addContextItemError;
    return mockState.addContextItemResult;
  },
  deleteMemoryItem: async (section: string, itemId: string, _userId?: string) => {
    mockState.lastDeleteArgs = { section, itemId };
    if (mockState.deleteMemoryItemError) throw mockState.deleteMemoryItemError;
    return mockState.deleteMemoryItemResult;
  },
  setContextActive: async (itemId: string, active: boolean, _userId?: string) => {
    mockState.lastSetContextActiveArgs = { itemId, active };
    if (mockState.setContextActiveError) throw mockState.setContextActiveError;
    return mockState.setContextActiveResult;
  },
  isValidSection: (section: string) => {
    mockState.lastIsValidSectionArg = section;
    return mockState.isValidSectionResult;
  },
  getAllSections: () => {
    return mockState.getAllSectionsResult;
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { UserMemoryTool } = await import("../user-memory");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset memory data
  mockState.memory = {
    about: [{ id: "about_1", content: "Entwickler bei TechCorp", added_at: "2026-01-01T00:00:00.000Z", source: "manual" }],
    instructions: [{ id: "inst_1", content: "Immer auf Deutsch antworten", priority: "high", added_at: "2026-01-01T00:00:00.000Z", source: "manual" }],
    context: [{ id: "ctx_1", name: "Agent Platform", description: "Multi-Agent System", active: true, added_at: "2026-01-01T00:00:00.000Z", source: "agent" }],
  };

  // Reset error states
  mockState.loadError = null;
  mockState.addAboutItemError = null;
  mockState.addInstructionError = null;
  mockState.addContextItemError = null;
  mockState.deleteMemoryItemError = null;
  mockState.setContextActiveError = null;

  // Reset result states
  mockState.addAboutItemResult = { id: "about_new", content: "neuer Inhalt", added_at: "2026-01-01T00:00:00.000Z", source: "agent" };
  mockState.addInstructionResult = { id: "inst_new", content: "neue Anweisung", priority: "normal", added_at: "2026-01-01T00:00:00.000Z", source: "agent" };
  mockState.addContextItemResult = { id: "ctx_new", name: "Neues Projekt", description: "Beschreibung", active: true, added_at: "2026-01-01T00:00:00.000Z", source: "agent" };
  mockState.deleteMemoryItemResult = true;
  mockState.setContextActiveResult = true;
  mockState.isValidSectionResult = true;
  mockState.getAllSectionsResult = ["about", "instructions", "context"];

  // Reset captured argument state
  mockState.lastAddAboutArgs = null;
  mockState.lastAddInstructionArgs = null;
  mockState.lastAddContextArgs = null;
  mockState.lastDeleteArgs = null;
  mockState.lastSetContextActiveArgs = null;
  mockState.lastIsValidSectionArg = null;
});

// ---------------------------------------------------------------------------
// getDefinition()
// ---------------------------------------------------------------------------

describe("UserMemoryTool", () => {
  describe("getDefinition()", () => {
    test("gibt einen Funktionstyp mit dem Namen 'user_memory' zurueck", () => {
      const tool = new UserMemoryTool();
      const def = tool.getDefinition();

      expect(def.type).toBe("function");
      expect(def.function.name).toBe("user_memory");
    });

    test("enthaelt eine nicht-leere Beschreibung", () => {
      const tool = new UserMemoryTool();
      const def = tool.getDefinition();

      expect(typeof def.function.description).toBe("string");
      expect(def.function.description.length).toBeGreaterThan(0);
    });

    test("definiert den Parameter 'action' als Enum mit save, get, delete", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("action");
      expect(params.properties["action"]!.enum).toEqual(["save", "get", "delete"]);
    });

    test("definiert den Parameter 'section' als Enum mit about, instructions, context", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("section");
      expect(params.properties["section"]!.enum).toEqual(["about", "instructions", "context"]);
    });

    test("definiert den Parameter 'content'", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("content");
      expect(params.properties["content"]!.type).toBe("string");
    });

    test("definiert den Parameter 'priority' als Enum mit high, normal", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("priority");
      expect(params.properties["priority"]!.enum).toEqual(["high", "normal"]);
    });

    test("definiert den Parameter 'name'", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("name");
      expect(params.properties["name"]!.type).toBe("string");
    });

    test("definiert den Parameter 'description'", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("description");
      expect(params.properties["description"]!.type).toBe("string");
    });

    test("definiert den Parameter 'active' als boolean", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("active");
      expect(params.properties["active"]!.type).toBe("boolean");
    });

    test("definiert den Parameter 'item_id'", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.properties).toHaveProperty("item_id");
      expect(params.properties["item_id"]!.type).toBe("string");
    });

    test("deklariert 'action' und 'section' als Pflichtfelder", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.required).toContain("action");
      expect(params.required).toContain("section");
    });

    test("gibt parameters.type als 'object' zurueck", () => {
      const tool = new UserMemoryTool();
      const params = tool.getDefinition().function.parameters;

      expect(params.type).toBe("object");
    });
  });

  // ---------------------------------------------------------------------------
  // getMetadata()
  // ---------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt den Namen 'user_memory' zurueck", () => {
      const tool = new UserMemoryTool();
      expect(tool.getMetadata().name).toBe("user_memory");
    });

    test("gibt den Typ 'local' zurueck", () => {
      const tool = new UserMemoryTool();
      expect(tool.getMetadata().type).toBe("local");
    });

    test("gibt die Kategorie 'memory' zurueck", () => {
      const tool = new UserMemoryTool();
      expect(tool.getMetadata().category).toBe("memory");
    });

    test("enthaelt eine nicht-leere Beschreibung", () => {
      const tool = new UserMemoryTool();
      expect(typeof tool.getMetadata().description).toBe("string");
      expect(tool.getMetadata().description.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // isAvailable()
  // ---------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new UserMemoryTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — action='get'
  // ---------------------------------------------------------------------------

  describe("execute() — action='get'", () => {
    test("ruft loadUserMemory auf und gibt die Sektion als JSON zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({ action: "get", section: "about" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed).toHaveProperty("about");
    });

    test("gibt die 'about'-Sektion mit ihren Eintraegen zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({ action: "get", section: "about" });
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed.about)).toBe(true);
      expect(parsed.about[0].content).toBe("Entwickler bei TechCorp");
    });

    test("gibt die 'instructions'-Sektion zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({ action: "get", section: "instructions" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed).toHaveProperty("instructions");
      expect(parsed.instructions[0].content).toBe("Immer auf Deutsch antworten");
    });

    test("gibt die 'context'-Sektion zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({ action: "get", section: "context" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed).toHaveProperty("context");
      expect(parsed.context[0].name).toBe("Agent Platform");
    });

    test("gibt success=false und eine Fehlermeldung zurueck wenn loadUserMemory wirft", async () => {
      mockState.loadError = new Error("Datei nicht lesbar");

      const tool = new UserMemoryTool();
      const result = await tool.execute({ action: "get", section: "about" });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Datei nicht lesbar");
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — action='save', section='about'
  // ---------------------------------------------------------------------------

  describe("execute() — action='save', section='about'", () => {
    test("ruft addAboutItem auf und gibt success=true zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "about",
        content: "Arbeitet als AI Consultant",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    test("uebergibt den content-Wert an addAboutItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "about",
        content: "Arbeitet als AI Consultant",
      });

      expect(mockState.lastAddAboutArgs).not.toBeNull();
      expect(mockState.lastAddAboutArgs.content).toBe("Arbeitet als AI Consultant");
    });

    test("uebergibt 'agent' als source an addAboutItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "about",
        content: "Senior Developer",
      });

      expect(mockState.lastAddAboutArgs.source).toBe("agent");
    });

    test("gibt die gespeicherte Item-Instanz im Ergebnis zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "about",
        content: "Neues Wissen",
      });
      const parsed = JSON.parse(result);

      expect(parsed.item).toBeDefined();
      expect(parsed.item.id).toBe("about_new");
    });

    test("gibt success=false zurueck wenn content fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "about",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(typeof parsed.error).toBe("string");
    });

    test("enthaelt 'content' in der Fehlermeldung wenn content fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "about",
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("content");
    });

    test("gibt success=false zurueck wenn addAboutItem eine Exception wirft", async () => {
      mockState.addAboutItemError = new Error("Duplikat gefunden");

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "about",
        content: "Doppelter Eintrag",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Duplikat gefunden");
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — action='save', section='instructions'
  // ---------------------------------------------------------------------------

  describe("execute() — action='save', section='instructions'", () => {
    test("ruft addInstruction auf und gibt success=true zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "instructions",
        content: "Antworte immer in Stichpunkten",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    test("uebergibt den content-Wert an addInstruction", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "instructions",
        content: "Antworte immer in Stichpunkten",
      });

      expect(mockState.lastAddInstructionArgs.content).toBe("Antworte immer in Stichpunkten");
    });

    test("uebergibt die priority 'high' an addInstruction", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "instructions",
        content: "Wichtige Regel",
        priority: "high",
      });

      expect(mockState.lastAddInstructionArgs.priority).toBe("high");
    });

    test("uebergibt die priority 'normal' wenn keine priority angegeben wird", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "instructions",
        content: "Normale Regel",
      });

      expect(mockState.lastAddInstructionArgs.priority).toBe("normal");
    });

    test("uebergibt 'agent' als source an addInstruction", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "instructions",
        content: "Stil-Vorgabe",
      });

      expect(mockState.lastAddInstructionArgs.source).toBe("agent");
    });

    test("gibt die gespeicherte Item-Instanz im Ergebnis zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "instructions",
        content: "Neue Anweisung",
      });
      const parsed = JSON.parse(result);

      expect(parsed.item).toBeDefined();
      expect(parsed.item.id).toBe("inst_new");
    });

    test("gibt success=false zurueck wenn content fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "instructions",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("content");
    });

    test("gibt success=false zurueck wenn addInstruction eine Exception wirft", async () => {
      mockState.addInstructionError = new Error("Speicherfehler");

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "instructions",
        content: "Fehlgeschlagene Anweisung",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Speicherfehler");
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — action='save', section='context'
  // ---------------------------------------------------------------------------

  describe("execute() — action='save', section='context'", () => {
    test("ruft addContextItem auf und gibt success=true zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "context",
        name: "Neues Projekt",
        description: "Ein spannendes Vorhaben",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    test("uebergibt den name-Wert an addContextItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "context",
        name: "Backend Refactoring",
      });

      expect(mockState.lastAddContextArgs.name).toBe("Backend Refactoring");
    });

    test("uebergibt die description an addContextItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "context",
        name: "Mein Projekt",
        description: "Detaillierte Beschreibung",
      });

      expect(mockState.lastAddContextArgs.description).toBe("Detaillierte Beschreibung");
    });

    test("uebergibt active=true als Standard an addContextItem wenn nicht angegeben", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "context",
        name: "Automatisch aktiv",
      });

      expect(mockState.lastAddContextArgs.active).toBe(true);
    });

    test("uebergibt active=false an addContextItem wenn explizit angegeben", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "context",
        name: "Inaktives Projekt",
        active: false,
      });

      expect(mockState.lastAddContextArgs.active).toBe(false);
    });

    test("uebergibt 'agent' als source an addContextItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "save",
        section: "context",
        name: "Agent-Kontext",
      });

      expect(mockState.lastAddContextArgs.source).toBe("agent");
    });

    test("gibt die gespeicherte Item-Instanz im Ergebnis zurueck", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "context",
        name: "Gespeichertes Projekt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.item).toBeDefined();
      expect(parsed.item.id).toBe("ctx_new");
    });

    test("gibt success=false zurueck wenn name fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "context",
        description: "Beschreibung ohne Name",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("name");
    });

    test("gibt success=false zurueck wenn addContextItem eine Exception wirft", async () => {
      mockState.addContextItemError = new Error("Kontext-Fehler");

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "save",
        section: "context",
        name: "Fehler-Projekt",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Kontext-Fehler");
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — action='delete'
  // ---------------------------------------------------------------------------

  describe("execute() — action='delete'", () => {
    test("ruft deleteMemoryItem auf und gibt success=true zurueck wenn das Item existiert", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
        item_id: "about_1",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    test("uebergibt section und item_id an deleteMemoryItem", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "delete",
        section: "instructions",
        item_id: "inst_1",
      });

      expect(mockState.lastDeleteArgs.section).toBe("instructions");
      expect(mockState.lastDeleteArgs.itemId).toBe("inst_1");
    });

    test("gibt eine Erfolgsmeldung zurueck wenn das Item geloescht wurde", async () => {
      mockState.deleteMemoryItemResult = true;

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
        item_id: "about_1",
      });
      const parsed = JSON.parse(result);

      expect(parsed.message).toBeDefined();
    });

    test("gibt success=false zurueck wenn das Item nicht gefunden wurde", async () => {
      mockState.deleteMemoryItemResult = false;

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
        item_id: "nonexistent_id",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });

    test("gibt success=false zurueck wenn item_id fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });

    test("enthaelt 'item_id' in der Fehlermeldung wenn item_id fehlt", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("item_id");
    });

    test("gibt success=false zurueck wenn deleteMemoryItem eine Exception wirft", async () => {
      mockState.deleteMemoryItemError = new Error("Loeschfehler");

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "delete",
        section: "about",
        item_id: "about_1",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Loeschfehler");
    });
  });

  // ---------------------------------------------------------------------------
  // execute() — Validierung
  // ---------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("gibt success=false zurueck fuer eine ungueltige Aktion", async () => {
      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "update" as any,
        section: "about",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(typeof parsed.error).toBe("string");
    });

    test("gibt success=false zurueck fuer eine ungueltige Sektion", async () => {
      mockState.isValidSectionResult = false;

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "get",
        section: "unknown" as any,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
    });

    test("prueft die Sektion mit isValidSection", async () => {
      mockState.isValidSectionResult = false;

      const tool = new UserMemoryTool();
      await tool.execute({
        action: "get",
        section: "invalid_section" as any,
      });

      expect(mockState.lastIsValidSectionArg).toBe("invalid_section");
    });

    test("gibt in der Fehlermeldung die gueltigen Sektionen aus wenn isValidSection false ergibt", async () => {
      mockState.isValidSectionResult = false;
      mockState.getAllSectionsResult = ["about", "instructions", "context"];

      const tool = new UserMemoryTool();
      const result = await tool.execute({
        action: "get",
        section: "wrong" as any,
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("about");
      expect(parsed.error).toContain("instructions");
      expect(parsed.error).toContain("context");
    });

    test("fuehrt keine Service-Aktion aus bei ungueltiger Aktion", async () => {
      const tool = new UserMemoryTool();
      await tool.execute({
        action: "bad_action" as any,
        section: "about",
      });

      // loadUserMemory should not have been called (no state mutation)
      expect(mockState.lastAddAboutArgs).toBeNull();
      expect(mockState.lastDeleteArgs).toBeNull();
    });
  });
});
