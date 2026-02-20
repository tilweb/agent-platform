/**
 * Tests for skills/activator.ts
 *
 * Covers:
 *  - prepareSkillActivation: tool availability checks, canExecute flag, error messages
 *  - filterToolsForSkill: intersection filtering and passthrough when no restrictions
 *  - buildSkillPrompt: prompt structure, workflow hints, output template, tool list
 *  - extractSkillContext: /skillId prefix removal
 *  - formatSkillActivationEvent: output shape
 */

import { test, expect, describe, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock the toolRegistry so tests don't depend on the real tool setup
// ---------------------------------------------------------------------------

mock.module("../../tools", () => ({
  toolRegistry: {
    getAll: () => [
      { name: "web_search" },
      { name: "file_read" },
      { name: "kb_search" },
    ],
  },
}));

import {
  prepareSkillActivation,
  filterToolsForSkill,
  buildSkillPrompt,
  extractSkillContext,
  formatSkillActivationEvent,
} from "../activator";
import type { EnhancedSkill, SkillMatch, SkillActivationContext } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<EnhancedSkill> & { id?: string } = {}): EnhancedSkill {
  return {
    id: overrides.id ?? "test-skill",
    name: overrides.name ?? "Test Skill",
    version: "1.0.0",
    description: overrides.description ?? "Eine Test-Beschreibung",
    triggers: {},
    tools: overrides.tools ?? { required: [], optional: [] },
    instructions: overrides.instructions ?? "Folge diesen Anweisungen.",
    workflow: overrides.workflow,
    output: overrides.output,
    enabled: true,
    ...overrides,
  };
}

function makeMatch(skill: EnhancedSkill): SkillMatch {
  return {
    skill,
    confidence: 1,
    matchedBy: "explicit",
    matchedTrigger: `/${skill.id}`,
  };
}

function makeContext(
  skill: EnhancedSkill,
  overrides: Partial<SkillActivationContext> = {}
): SkillActivationContext {
  return {
    skill,
    availableTools: overrides.availableTools ?? [],
    missingTools: overrides.missingTools ?? [],
    canExecute: overrides.canExecute ?? true,
    error: overrides.error,
  };
}

// ---------------------------------------------------------------------------
// prepareSkillActivation
// ---------------------------------------------------------------------------

describe("prepareSkillActivation", () => {
  test("sollte canExecute=true zurückgeben wenn alle required tools vorhanden sind", () => {
    const skill = makeSkill({ tools: { required: ["web_search", "file_read"] } });
    const agentTools = ["web_search", "file_read", "kb_search"];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(true);
    expect(ctx.missingTools).toHaveLength(0);
    expect(ctx.error).toBeUndefined();
  });

  test("sollte canExecute=true und leere tools zurückgeben wenn keine tools definiert sind", () => {
    const skill = makeSkill({ tools: { required: [], optional: [] } });
    const agentTools = ["web_search"];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(true);
    expect(ctx.missingTools).toHaveLength(0);
    expect(ctx.availableTools).toHaveLength(0);
    expect(ctx.error).toBeUndefined();
  });

  test("sollte canExecute=false zurückgeben wenn ein required tool fehlt", () => {
    const skill = makeSkill({ tools: { required: ["web_search", "image_gen"] } });
    const agentTools = ["web_search"]; // image_gen fehlt beim Agenten

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(false);
    expect(ctx.missingTools).toContain("image_gen");
  });

  test("sollte die Fehlermeldung den Namen des fehlenden Tools enthalten", () => {
    const skill = makeSkill({ tools: { required: ["image_gen"] } });
    const agentTools: string[] = [];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.error).toBeDefined();
    expect(ctx.error).toContain("image_gen");
  });

  test("sollte auch Tools die nicht in der Registry sind als fehlend markieren", () => {
    // "file_read" ist in der Registry, aber "db_query" nicht
    const skill = makeSkill({ tools: { required: ["file_read", "db_query"] } });
    const agentTools = ["file_read", "db_query"];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(false);
    expect(ctx.missingTools).toContain("db_query");
  });

  test("sollte optional tools einschließen wenn sie verfügbar sind", () => {
    const skill = makeSkill({
      tools: { required: ["web_search"], optional: ["kb_search"] },
    });
    const agentTools = ["web_search", "kb_search"];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(true);
    expect(ctx.availableTools).toContain("web_search");
    expect(ctx.availableTools).toContain("kb_search");
  });

  test("sollte optional tools ignorieren wenn sie beim Agenten nicht vorhanden sind", () => {
    const skill = makeSkill({
      tools: { required: ["web_search"], optional: ["kb_search"] },
    });
    const agentTools = ["web_search"]; // kb_search nicht verfügbar

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(true);
    expect(ctx.availableTools).toContain("web_search");
    expect(ctx.availableTools).not.toContain("kb_search");
  });

  test("sollte optional tools ignorieren wenn sie nicht in der Registry sind", () => {
    const skill = makeSkill({
      tools: { required: [], optional: ["exotic_tool"] },
    });
    const agentTools = ["exotic_tool"]; // Agent hat es, aber Registry nicht

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.canExecute).toBe(true);
    expect(ctx.availableTools).not.toContain("exotic_tool");
  });

  test("sollte availableTools aus required und optional kombinieren", () => {
    const skill = makeSkill({
      tools: { required: ["web_search"], optional: ["file_read"] },
    });
    const agentTools = ["web_search", "file_read"];

    const ctx = prepareSkillActivation(makeMatch(skill), agentTools);

    expect(ctx.availableTools).toEqual(["web_search", "file_read"]);
  });

  test("sollte das skill-Objekt unverändert zurückgeben", () => {
    const skill = makeSkill({ tools: { required: [] } });
    const ctx = prepareSkillActivation(makeMatch(skill), []);
    expect(ctx.skill).toBe(skill);
  });
});

// ---------------------------------------------------------------------------
// filterToolsForSkill
// ---------------------------------------------------------------------------

describe("filterToolsForSkill", () => {
  test("sollte alle Agent-Tools zurückgeben wenn der Skill keine Tool-Einschränkungen hat", () => {
    const skill = makeSkill({ tools: { required: [], optional: [] } });
    const agentTools = ["web_search", "file_read", "kb_search", "image_gen"];

    const result = filterToolsForSkill(agentTools, skill);

    expect(result).toEqual(agentTools);
  });

  test("sollte auf die Schnittmenge von Agent-Tools und Skill-Tools filtern", () => {
    const skill = makeSkill({ tools: { required: ["web_search", "kb_search"] } });
    const agentTools = ["web_search", "file_read", "kb_search", "image_gen"];

    const result = filterToolsForSkill(agentTools, skill);

    expect(result).toContain("web_search");
    expect(result).toContain("kb_search");
    expect(result).not.toContain("file_read");
    expect(result).not.toContain("image_gen");
  });

  test("sollte optional tools in die Filterung einschließen", () => {
    const skill = makeSkill({
      tools: { required: ["web_search"], optional: ["file_read"] },
    });
    const agentTools = ["web_search", "file_read", "kb_search"];

    const result = filterToolsForSkill(agentTools, skill);

    expect(result).toContain("web_search");
    expect(result).toContain("file_read");
    expect(result).not.toContain("kb_search");
  });

  test("sollte eine leere Liste zurückgeben wenn kein Agent-Tool zu den Skill-Tools passt", () => {
    const skill = makeSkill({ tools: { required: ["image_gen"] } });
    const agentTools = ["web_search", "file_read"];

    const result = filterToolsForSkill(agentTools, skill);

    expect(result).toHaveLength(0);
  });

  test("sollte eine leere Liste filtern ohne Fehler", () => {
    const skill = makeSkill({ tools: { required: ["web_search"] } });

    const result = filterToolsForSkill([], skill);

    expect(result).toHaveLength(0);
  });

  test("sollte alle Agent-Tools zurückgeben wenn tools-Objekt keine Felder enthält", () => {
    const skill = makeSkill({ tools: {} }); // required und optional undefined
    const agentTools = ["web_search", "file_read"];

    const result = filterToolsForSkill(agentTools, skill);

    expect(result).toEqual(agentTools);
  });
});

// ---------------------------------------------------------------------------
// buildSkillPrompt
// ---------------------------------------------------------------------------

describe("buildSkillPrompt", () => {
  test("sollte den Basis-Prompt einschließen", () => {
    const skill = makeSkill({ name: "Recherche", instructions: "Recherchiere gründlich." });
    const result = buildSkillPrompt("Du bist ein Assistent.", skill, []);
    expect(result).toContain("Du bist ein Assistent.");
  });

  test("sollte den Skill-Header mit dem Skill-Namen einschließen", () => {
    const skill = makeSkill({ name: "Recherche Skill" });
    const result = buildSkillPrompt("Basis-Prompt", skill, []);
    expect(result).toContain("Recherche Skill");
    expect(result).toContain("Aktiver Skill");
  });

  test("sollte die Skill-Beschreibung einschließen", () => {
    const skill = makeSkill({ description: "Dieser Skill hilft bei der Recherche." });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).toContain("Dieser Skill hilft bei der Recherche.");
  });

  test("sollte die Anweisungen einschließen", () => {
    const skill = makeSkill({ instructions: "Schritt 1: Recherchiere. Schritt 2: Schreibe." });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).toContain("Schritt 1: Recherchiere. Schritt 2: Schreibe.");
    expect(result).toContain("Anweisungen");
  });

  test("sollte die verfügbaren Tools auflisten wenn vorhanden", () => {
    const skill = makeSkill();
    const result = buildSkillPrompt("Basis", skill, ["web_search", "file_read"]);
    expect(result).toContain("web_search");
    expect(result).toContain("file_read");
    expect(result).toContain("Verfügbare Tools");
  });

  test("sollte keinen Tool-Abschnitt hinzufügen wenn keine Tools verfügbar sind", () => {
    const skill = makeSkill();
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).not.toContain("Verfügbare Tools");
  });

  test("sollte Workflow-Hinweise einschließen wenn workflow-Schritte vorhanden sind", () => {
    const skill = makeSkill({
      workflow: {
        steps: [
          { id: "s1", action: "think", description: "Problem analysieren" },
          { id: "s2", action: "respond", description: "Antwort formulieren" },
        ],
      },
    });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).toContain("Empfohlener Ablauf");
    expect(result).toContain("Problem analysieren");
    expect(result).toContain("Antwort formulieren");
  });

  test("sollte keine Workflow-Sektion ausgeben wenn keine Schritte definiert sind", () => {
    const skill = makeSkill({ workflow: { steps: [] } });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).not.toContain("Empfohlener Ablauf");
  });

  test("sollte das Ausgabe-Template einschließen wenn vorhanden", () => {
    const skill = makeSkill({
      output: { format: "markdown", template: "## Ergebnis\n{{content}}" },
    });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).toContain("Ausgabeformat");
    expect(result).toContain("## Ergebnis\n{{content}}");
  });

  test("sollte keinen Ausgabeformat-Abschnitt hinzufügen wenn kein Template vorhanden", () => {
    const skill = makeSkill({ output: { format: "markdown" } }); // kein template
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).not.toContain("Ausgabeformat");
  });

  test("sollte einen Tool-Schritt als verfügbar markieren wenn das Tool vorhanden ist", () => {
    const skill = makeSkill({
      workflow: {
        steps: [
          { id: "s1", action: "tool", tool: "web_search", description: "Web durchsuchen" },
        ],
      },
    });
    const result = buildSkillPrompt("Basis", skill, ["web_search"]);
    expect(result).toContain("web_search");
    expect(result).not.toContain("nicht verfügbar");
  });

  test("sollte einen Tool-Schritt als nicht verfügbar markieren wenn das Tool fehlt", () => {
    const skill = makeSkill({
      workflow: {
        steps: [
          { id: "s1", action: "tool", tool: "image_gen", description: "Bild erstellen" },
        ],
      },
    });
    const result = buildSkillPrompt("Basis", skill, []);
    expect(result).toContain("nicht verfügbar");
  });
});

// ---------------------------------------------------------------------------
// extractSkillContext
// ---------------------------------------------------------------------------

describe("extractSkillContext", () => {
  test("sollte den /skillId-Prefix entfernen", () => {
    const result = extractSkillContext("/recherche Bitte recherchiere KI.", "recherche");
    expect(result).toBe("Bitte recherchiere KI.");
  });

  test("sollte die vollständige Nachricht zurückgeben wenn kein Prefix vorhanden ist", () => {
    const result = extractSkillContext("Einfache Nachricht ohne Prefix", "recherche");
    expect(result).toBe("Einfache Nachricht ohne Prefix");
  });

  test("sollte mehrere führende Slashes korrekt entfernen", () => {
    const result = extractSkillContext("///recherche Aufgabe ausführen", "recherche");
    expect(result).toBe("Aufgabe ausführen");
  });

  test("sollte führende und nachfolgende Leerzeichen trimmen", () => {
    const result = extractSkillContext("  /recherche   Aufgabe  ", "recherche");
    expect(result).toBe("Aufgabe");
  });

  test("sollte eine leere Zeichenkette zurückgeben wenn nur der Befehl vorhanden ist", () => {
    const result = extractSkillContext("/recherche", "recherche");
    expect(result).toBe("");
  });

  test("sollte Groß- und Kleinschreibung des Prefix ignorieren", () => {
    const result = extractSkillContext("/RECHERCHE Aufgabe", "recherche");
    expect(result).toBe("Aufgabe");
  });

  test("sollte den Inhalt unangetastet lassen wenn der Skill-ID nicht am Anfang steht", () => {
    const result = extractSkillContext("Bitte /recherche ausführen", "recherche");
    expect(result).toBe("Bitte /recherche ausführen");
  });

  test("sollte mit Skill-IDs die Bindestriche enthalten umgehen", () => {
    const result = extractSkillContext("/code-review Prüfe meinen Code", "code-review");
    expect(result).toBe("Prüfe meinen Code");
  });
});

// ---------------------------------------------------------------------------
// formatSkillActivationEvent
// ---------------------------------------------------------------------------

describe("formatSkillActivationEvent", () => {
  test("sollte ein Objekt mit der korrekten Form zurückgeben", () => {
    const skill = makeSkill({ id: "recherche", name: "Recherche Skill" });
    const ctx = makeContext(skill, {
      availableTools: ["web_search"],
      canExecute: true,
    });

    const event = formatSkillActivationEvent(ctx);

    expect(event.skillId).toBe("recherche");
    expect(event.skillName).toBe("Recherche Skill");
    expect(event.tools).toEqual(["web_search"]);
    expect(event.canExecute).toBe(true);
    expect(event.error).toBeUndefined();
  });

  test("sollte die Fehlermeldung weitergeben wenn canExecute false ist", () => {
    const skill = makeSkill({ id: "analyse", name: "Analyse Skill" });
    const ctx = makeContext(skill, {
      availableTools: [],
      canExecute: false,
      error: "Fehlende Tools: image_gen",
    });

    const event = formatSkillActivationEvent(ctx);

    expect(event.canExecute).toBe(false);
    expect(event.error).toBe("Fehlende Tools: image_gen");
  });

  test("sollte eine leere tools-Liste zurückgeben wenn keine Tools verfügbar sind", () => {
    const skill = makeSkill();
    const ctx = makeContext(skill, { availableTools: [], canExecute: true });

    const event = formatSkillActivationEvent(ctx);

    expect(event.tools).toEqual([]);
  });

  test("sollte genau die Eigenschaften skillId, skillName, tools, canExecute und error enthalten", () => {
    const skill = makeSkill({ id: "sk1", name: "Skill One" });
    const ctx = makeContext(skill, { availableTools: ["web_search"], canExecute: true });

    const event = formatSkillActivationEvent(ctx);

    expect(Object.keys(event).sort()).toEqual(
      ["canExecute", "error", "skillId", "skillName", "tools"].sort()
    );
  });

  test("sollte skill.id und skill.name korrekt aus dem Kontext lesen", () => {
    const skill = makeSkill({ id: "data-extract", name: "Datenextraktion" });
    const ctx = makeContext(skill, { availableTools: ["file_read"], canExecute: true });

    const event = formatSkillActivationEvent(ctx);

    expect(event.skillId).toBe("data-extract");
    expect(event.skillName).toBe("Datenextraktion");
  });
});
