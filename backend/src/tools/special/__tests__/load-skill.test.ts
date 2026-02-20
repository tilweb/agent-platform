/**
 * Tests fuer LoadSkillTool (backend/src/tools/special/load-skill.ts)
 *
 * Alle Aufrufe an den skills/loader-Service werden per mock.module() abgefangen,
 * damit kein echter Dateisystemzugriff stattfindet.
 * mock.module()-Aufrufe muessen VOR dem dynamischen Import des Moduls stehen
 * (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Pfade in mock.module() sind relativ zur Testdatei. Der Loader liegt in
 * src/skills/loader, die Testdatei in src/tools/special/__tests__/,
 * daher zeigt der Pfad auf ../../../skills/loader.
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  skill: null as any,
  summaries: [] as any[],
  knowledgeResult: { files: [], errors: [] } as {
    files: { path: string; content: string }[];
    errors: string[];
  },

  // Capture call arguments for verification
  lastGetSkillByIdArg: null as string | null,
  getSkillSummariesCalled: false,
  lastLoadKnowledgeSkill: null as any,
};

// ---------------------------------------------------------------------------
// Module mock — must be declared BEFORE importing the module under test.
// Path is relative to THIS test file.
// ---------------------------------------------------------------------------

mock.module("../../../skills/loader", () => ({
  getSkillById: async (id: string) => {
    mockState.lastGetSkillByIdArg = id;
    return mockState.skill;
  },
  getSkillSummaries: async () => {
    mockState.getSkillSummariesCalled = true;
    return mockState.summaries;
  },
  loadSkillKnowledgeFiles: async (skill: any) => {
    mockState.lastLoadKnowledgeSkill = skill;
    return mockState.knowledgeResult;
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { LoadSkillTool } = await import("../load-skill");

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<any> = {}): any {
  return {
    id: "deep-research",
    name: "Deep Research",
    version: "1.0",
    description: "Gruendliche Recherche zu einem Thema",
    instructions: "Recherchiere systematisch das angegebene Thema.",
    triggers: { keywords: ["recherche", "suche"] },
    tools: { required: [], optional: [] },
    enabled: true,
    ...overrides,
  };
}

function makeHandler(overrides: Partial<any> = {}): any {
  const addedToolsArg: string[][] = [];
  const loadedSkills: string[] = overrides._loadedSkills ?? [];
  const isAllowed: boolean = overrides._isAllowed !== false;

  return {
    _addedToolsArg: addedToolsArg,
    addTemporaryTools: (tools: string[]) => {
      addedToolsArg.push(tools);
    },
    getLoadedSkills: () => loadedSkills,
    isSkillAllowed: (_skillId: string) => isAllowed,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.skill = null;
  mockState.summaries = [];
  mockState.knowledgeResult = { files: [], errors: [] };
  mockState.lastGetSkillByIdArg = null;
  mockState.getSkillSummariesCalled = false;
  mockState.lastLoadKnowledgeSkill = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoadSkillTool", () => {
  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt den Typ 'function' zurueck", () => {
      const tool = new LoadSkillTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt den Namen 'load_skill' zurueck", () => {
      const tool = new LoadSkillTool();
      expect(tool.getDefinition().function.name).toBe("load_skill");
    });

    test("deklariert 'skill_id' als Pflichtfeld", () => {
      const tool = new LoadSkillTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.required).toContain("skill_id");
    });

    test("enthaelt eine nicht-leere Beschreibung", () => {
      const tool = new LoadSkillTool();
      const desc = tool.getDefinition().function.description;
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // setHandler / getHandler
  // -------------------------------------------------------------------------

  describe("setHandler() / getHandler()", () => {
    test("getHandler() gibt initial null zurueck", () => {
      const tool = new LoadSkillTool();
      expect(tool.getHandler()).toBeNull();
    });

    test("getHandler() gibt den gesetzten Handler zurueck", () => {
      const tool = new LoadSkillTool();
      const handler = makeHandler();
      tool.setHandler(handler);
      expect(tool.getHandler()).toBe(handler);
    });

    test("setHandler(null) setzt den Handler zurueck auf null", () => {
      const tool = new LoadSkillTool();
      const handler = makeHandler();
      tool.setHandler(handler);
      tool.setHandler(null);
      expect(tool.getHandler()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt immer true zurueck", async () => {
      const tool = new LoadSkillTool();
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Validierung der Eingabe
  // -------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("gibt success=false zurueck wenn skill_id fehlt", async () => {
      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    test("gibt eine Fehlermeldung zurueck wenn skill_id ein leerer String ist", async () => {
      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "" });
      const parsed = JSON.parse(result);
      expect(typeof parsed.error).toBe("string");
      expect(parsed.error.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Skill nicht gefunden
  // -------------------------------------------------------------------------

  describe("execute() — Skill nicht gefunden", () => {
    test("gibt success=false zurueck wenn getSkillById null liefert", async () => {
      mockState.skill = null;
      mockState.summaries = [{ id: "web-research", name: "Web Research", description: "" }];

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "unbekannter-skill" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    test("ruft getSkillSummaries auf um verfuegbare IDs anzuzeigen", async () => {
      mockState.skill = null;
      mockState.summaries = [
        { id: "skill-a", name: "Skill A", description: "" },
        { id: "skill-b", name: "Skill B", description: "" },
      ];

      const tool = new LoadSkillTool();
      await tool.execute({ skill_id: "nicht-vorhanden" });
      expect(mockState.getSkillSummariesCalled).toBe(true);
    });

    test("Fehlermeldung enthaelt die angeforderte skill_id", async () => {
      mockState.skill = null;
      mockState.summaries = [{ id: "code-review", name: "Code Review", description: "" }];

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "gesuchter-skill" });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("gesuchter-skill");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Skill deaktiviert
  // -------------------------------------------------------------------------

  describe("execute() — Skill deaktiviert", () => {
    test("gibt success=false zurueck wenn enabled=false", async () => {
      mockState.skill = makeSkill({ enabled: false });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    test("Fehlermeldung enthaelt die skill_id des deaktivierten Skills", async () => {
      mockState.skill = makeSkill({ id: "deaktivierter-skill", enabled: false });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deaktivierter-skill" });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("deaktivierter-skill");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Berechtigungspruefung
  // -------------------------------------------------------------------------

  describe("execute() — Berechtigung", () => {
    test("gibt success=false zurueck wenn isSkillAllowed false liefert", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _isAllowed: false });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });

    test("kein Fehler wenn isSkillAllowed true liefert", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _isAllowed: true });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Skill bereits geladen
  // -------------------------------------------------------------------------

  describe("execute() — Skill bereits geladen", () => {
    test("gibt success=true zurueck wenn der Skill bereits in getLoadedSkills enthalten ist", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _loadedSkills: ["deep-research"] });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    test("instructions enthaelt 'bereits geladen' wenn Skill schon aktiv ist", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _loadedSkills: ["deep-research"] });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("bereits geladen");
    });

    test("addedTools ist ein leeres Array wenn der Skill bereits geladen ist", async () => {
      mockState.skill = makeSkill({ allowed_tools: ["web_search", "kb_search"] });

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _loadedSkills: ["deep-research"] });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.addedTools).toEqual([]);
    });

    test("loadedFiles ist ein leeres Array wenn der Skill bereits geladen ist", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["methodology.md"] },
      });

      const tool = new LoadSkillTool();
      const handler = makeHandler({ _loadedSkills: ["deep-research"] });
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.loadedFiles).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Erfolgreich laden
  // -------------------------------------------------------------------------

  describe("execute() — Erfolgreich laden", () => {
    test("gibt success=true zurueck", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    test("gibt die Skill-ID im Ergebnis zurueck", async () => {
      mockState.skill = makeSkill({ id: "deep-research" });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.skill.id).toBe("deep-research");
    });

    test("gibt den Skill-Namen im Ergebnis zurueck", async () => {
      mockState.skill = makeSkill({ name: "Deep Research" });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.skill.name).toBe("Deep Research");
    });

    test("instructions enthaelt den Skill-Namen", async () => {
      mockState.skill = makeSkill({ name: "Deep Research" });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Deep Research");
    });

    test("addedTools enthaelt die allowed_tools des Skills", async () => {
      mockState.skill = makeSkill({ allowed_tools: ["web_search", "kb_search"] });

      const tool = new LoadSkillTool();
      const handler = makeHandler();
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.addedTools).toEqual(["web_search", "kb_search"]);
    });

    test("ruft addTemporaryTools mit den allowed_tools auf", async () => {
      mockState.skill = makeSkill({ allowed_tools: ["web_search", "kb_search"] });

      const tool = new LoadSkillTool();
      const handler = makeHandler();
      tool.setHandler(handler);

      await tool.execute({ skill_id: "deep-research" });
      expect(handler._addedToolsArg.length).toBeGreaterThan(0);
      expect(handler._addedToolsArg[0]).toEqual(["web_search", "kb_search"]);
    });

    test("loadedFiles enthaelt Pfade aus geladenen Knowledge-Dateien", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["methodology.md"] },
      });
      mockState.knowledgeResult = {
        files: [{ path: "methodology.md", content: "Inhalt der Datei" }],
        errors: [],
      };

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.loadedFiles).toContain("methodology.md");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Knowledge-Dateien
  // -------------------------------------------------------------------------

  describe("execute() — Knowledge-Dateien", () => {
    test("laedt Knowledge-Dateien wenn knowledge.files vorhanden ist", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["guide.md"] },
      });
      mockState.knowledgeResult = {
        files: [{ path: "guide.md", content: "Anleitung" }],
        errors: [],
      };

      const tool = new LoadSkillTool();
      await tool.execute({ skill_id: "deep-research" });
      expect(mockState.lastLoadKnowledgeSkill).not.toBeNull();
    });

    test("Dateiinhalt wird in den instructions abgebildet", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["guide.md"] },
      });
      mockState.knowledgeResult = {
        files: [{ path: "guide.md", content: "Dieser Text ist wichtig" }],
        errors: [],
      };

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Dieser Text ist wichtig");
    });

    test("Ladefehler bei Knowledge-Dateien verhindern kein erfolgreiches Ergebnis", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["fehlende-datei.md"] },
      });
      mockState.knowledgeResult = {
        files: [],
        errors: ["Knowledge file not found: fehlende-datei.md"],
      };

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Ohne Handler
  // -------------------------------------------------------------------------

  describe("execute() — Ohne Handler", () => {
    test("funktioniert ohne Handler (kein isSkillAllowed-Check)", async () => {
      mockState.skill = makeSkill();

      const tool = new LoadSkillTool();
      // kein setHandler — handler bleibt null

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    test("ruft addTemporaryTools nicht auf wenn kein Handler gesetzt ist", async () => {
      mockState.skill = makeSkill({ allowed_tools: ["web_search"] });

      const tool = new LoadSkillTool();
      // kein Handler — addTemporaryTools darf nicht aufgerufen werden
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);

      // addedTools muss leer sein, da der Handler fehlt
      expect(parsed.addedTools).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // buildSkillInstructions (via execute)
  // -------------------------------------------------------------------------

  describe("buildSkillInstructions (via execute())", () => {
    test("instructions enthalten den '## Skill geladen:'-Header", async () => {
      mockState.skill = makeSkill({ name: "Mein Skill" });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("## Skill geladen:");
    });

    test("instructions enthalten die Beschreibung des Skills", async () => {
      mockState.skill = makeSkill({
        description: "Eine ausfuehrliche Beschreibung",
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Eine ausfuehrliche Beschreibung");
    });

    test("instructions enthalten die Anweisungen des Skills", async () => {
      mockState.skill = makeSkill({
        instructions: "Folge diesen Schritten genau.",
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Folge diesen Schritten genau.");
    });

    test("instructions enthalten Workflow-Schritte mit 'tool'-Aktion", async () => {
      mockState.skill = makeSkill({
        workflow: {
          steps: [
            {
              id: "step-1",
              action: "tool",
              tool: "web_search",
              description: "Im Web suchen",
            },
          ],
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("web_search");
    });

    test("instructions enthalten Workflow-Schritte mit 'think'-Aktion", async () => {
      mockState.skill = makeSkill({
        workflow: {
          steps: [
            {
              id: "step-2",
              action: "think",
              description: "Ergebnisse auswerten",
            },
          ],
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Analysieren");
    });

    test("instructions enthalten Workflow-Schritte mit 'respond'-Aktion", async () => {
      mockState.skill = makeSkill({
        workflow: {
          steps: [
            {
              id: "step-3",
              action: "respond",
              description: "Antwort vorbereiten",
            },
          ],
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Antwort formulieren");
    });

    test("instructions enthalten Workflow-Schritte mit 'delegate'-Aktion", async () => {
      mockState.skill = makeSkill({
        workflow: {
          steps: [
            {
              id: "step-4",
              action: "delegate",
              description: "An Spezialisten weitergeben",
            },
          ],
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("delegieren");
    });

    test("instructions enthalten die Bedingung eines Workflow-Schritts", async () => {
      mockState.skill = makeSkill({
        workflow: {
          steps: [
            {
              id: "step-5",
              action: "tool",
              tool: "kb_search",
              description: "Wissensbasis durchsuchen",
              condition: "falls Thema komplex ist",
            },
          ],
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("falls Thema komplex ist");
    });

    test("instructions enthalten den Abschnitt fuer zusaetzliche Tools", async () => {
      mockState.skill = makeSkill({ allowed_tools: ["web_search"] });

      const tool = new LoadSkillTool();
      const handler = makeHandler();
      tool.setHandler(handler);

      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("web_search");
    });

    test("instructions enthalten Knowledge-Inhalte wenn Dateien geladen wurden", async () => {
      mockState.skill = makeSkill({
        knowledge: { files: ["reference.md"] },
      });
      mockState.knowledgeResult = {
        files: [{ path: "reference.md", content: "Referenzinhalt" }],
        errors: [],
      };

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("Referenzinhalt");
    });

    test("instructions enthalten das output-Template in einem Code-Block", async () => {
      mockState.skill = makeSkill({
        output: {
          format: "markdown",
          template: "## Ergebnis\n{{content}}",
        },
      });

      const tool = new LoadSkillTool();
      const result = await tool.execute({ skill_id: "deep-research" });
      const parsed = JSON.parse(result);
      expect(parsed.instructions).toContain("```");
      expect(parsed.instructions).toContain("## Ergebnis");
    });
  });
});
