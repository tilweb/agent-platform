/**
 * Tests for skills/workflow.ts
 *
 * Covers:
 *  - createWorkflowState: Initialisierung aus Skill mit/ohne Workflow
 *  - getWorkflowContext: currentStep/nextStep/previousStep, Fortschrittsberechnung, Hints
 *  - advanceWorkflow: Schritt-Vorschub, completedSteps, isComplete-Markierung, No-op bei Abschluss
 *  - validateToolForStep: Übereinstimmung, Abweichung, Nicht-Tool-Schritte, fehlende Tool-Anforderung
 *  - buildWorkflowPromptSection: Fortschritt, Schrittstatus-Symbole, Beschreibungen, Hints, Abschlussmeldung
 *  - createStepEvent: Korrekte Form für 'start' und 'complete'
 *  - shouldAutoAdvance: Tool-Treffer, anderes Tool, Repeat-Flag, Abgeschlossen
 *  - getSuggestedTool: Tool-Schritt, Nicht-Tool-Schritt, Abgeschlossen
 */

import { test, expect, describe } from "bun:test";

import {
  createWorkflowState,
  getWorkflowContext,
  advanceWorkflow,
  validateToolForStep,
  buildWorkflowPromptSection,
  createStepEvent,
  shouldAutoAdvance,
  getSuggestedTool,
  type WorkflowState,
} from "../workflow";
import type { EnhancedSkill, SkillWorkflow, WorkflowStep } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(overrides: Partial<WorkflowStep> & { id: string }): WorkflowStep {
  return {
    id: overrides.id,
    action: overrides.action ?? "think",
    description: overrides.description ?? "Ein Schritt",
    tool: overrides.tool,
    condition: overrides.condition,
    repeat: overrides.repeat,
    queryTemplate: overrides.queryTemplate,
  };
}

function makeWorkflow(steps: WorkflowStep[]): SkillWorkflow {
  return { steps };
}

function makeSkill(overrides: Partial<EnhancedSkill> = {}): EnhancedSkill {
  return {
    id: overrides.id ?? "test-skill",
    name: overrides.name ?? "Test Skill",
    version: "1.0.0",
    description: overrides.description ?? "Ein Test-Skill",
    triggers: {},
    tools: {},
    instructions: "Folge den Schritten.",
    workflow: overrides.workflow,
    enabled: true,
    ...overrides,
  };
}

function makeState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    skillId: overrides.skillId ?? "test-skill",
    currentStepIndex: overrides.currentStepIndex ?? 0,
    completedSteps: overrides.completedSteps ?? [],
    startedAt: overrides.startedAt ?? Date.now(),
    lastStepAt: overrides.lastStepAt ?? null,
    isComplete: overrides.isComplete ?? false,
  };
}

// Drei Standard-Schritte für Tests die einen Mehrschrittigen Ablauf brauchen
const STEP_SEARCH = makeStep({ id: "s1", action: "tool", tool: "web_search", description: "Web durchsuchen" });
const STEP_THINK  = makeStep({ id: "s2", action: "think", description: "Ergebnisse analysieren" });
const STEP_RESPOND = makeStep({ id: "s3", action: "respond", description: "Antwort formulieren" });

// ---------------------------------------------------------------------------
// createWorkflowState
// ---------------------------------------------------------------------------

describe("createWorkflowState", () => {
  test("sollte einen initialisierten State zurückgeben wenn Workflow-Schritte vorhanden sind", () => {
    const skill = makeSkill({ workflow: makeWorkflow([STEP_SEARCH, STEP_THINK]) });

    const state = createWorkflowState(skill);

    expect(state).not.toBeNull();
    expect(state!.skillId).toBe("test-skill");
    expect(state!.currentStepIndex).toBe(0);
    expect(state!.completedSteps).toEqual([]);
    expect(state!.isComplete).toBe(false);
    expect(state!.lastStepAt).toBeNull();
    expect(typeof state!.startedAt).toBe("number");
  });

  test("sollte null zurückgeben wenn der Skill keinen Workflow hat", () => {
    const skill = makeSkill(); // kein workflow

    const state = createWorkflowState(skill);

    expect(state).toBeNull();
  });

  test("sollte null zurückgeben wenn der Workflow eine leere Schritt-Liste hat", () => {
    const skill = makeSkill({ workflow: makeWorkflow([]) });

    const state = createWorkflowState(skill);

    expect(state).toBeNull();
  });

  test("sollte die Skill-ID korrekt übernehmen", () => {
    const skill = makeSkill({ id: "mein-skill", workflow: makeWorkflow([STEP_THINK]) });

    const state = createWorkflowState(skill);

    expect(state!.skillId).toBe("mein-skill");
  });

  test("sollte startedAt auf einen aktuellen Zeitstempel setzen", () => {
    const before = Date.now();
    const skill = makeSkill({ workflow: makeWorkflow([STEP_THINK]) });

    const state = createWorkflowState(skill);
    const after = Date.now();

    expect(state!.startedAt).toBeGreaterThanOrEqual(before);
    expect(state!.startedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// getWorkflowContext
// ---------------------------------------------------------------------------

describe("getWorkflowContext", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const skill = makeSkill({ workflow: makeWorkflow(steps) });

  test("sollte den ersten Schritt als currentStep liefern", () => {
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.currentStep).toEqual(STEP_SEARCH);
  });

  test("sollte previousStep null sein beim ersten Schritt", () => {
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.previousStep).toBeNull();
  });

  test("sollte den zweiten Schritt als nextStep beim ersten Schritt liefern", () => {
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.nextStep).toEqual(STEP_THINK);
  });

  test("sollte previousStep korrekt beim mittleren Schritt setzen", () => {
    const state = makeState({ currentStepIndex: 1 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.previousStep).toEqual(STEP_SEARCH);
    expect(ctx.currentStep).toEqual(STEP_THINK);
    expect(ctx.nextStep).toEqual(STEP_RESPOND);
  });

  test("sollte nextStep null sein beim letzten Schritt", () => {
    const state = makeState({ currentStepIndex: 2 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.currentStep).toEqual(STEP_RESPOND);
    expect(ctx.nextStep).toBeNull();
  });

  test("sollte 0% Fortschritt zurückgeben wenn noch kein Schritt abgeschlossen ist", () => {
    const state = makeState({ completedSteps: [] });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.progress).toBe(0);
  });

  test("sollte 33% Fortschritt nach dem ersten abgeschlossenen Schritt zurückgeben", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.progress).toBe(33); // Math.round(1/3 * 100)
  });

  test("sollte 100% Fortschritt zurückgeben wenn alle Schritte abgeschlossen sind", () => {
    const state = makeState({ completedSteps: [0, 1, 2], isComplete: true });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.progress).toBe(100);
  });

  test("sollte stepsRemaining korrekt berechnen", () => {
    const state = makeState({ completedSteps: [0] });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.stepsRemaining).toBe(2); // 3 Schritte - 1 abgeschlossen
  });

  test("sollte einen Hint mit Schrittnummer und Beschreibung liefern", () => {
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.hints.some(h => h.includes("1/3"))).toBe(true);
    expect(ctx.hints.some(h => h.includes("Web durchsuchen"))).toBe(true);
  });

  test("sollte einen Tool-Hint liefern wenn der Schritt ein Tool erfordert", () => {
    const state = makeState({ currentStepIndex: 0 }); // STEP_SEARCH hat tool: "web_search"

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.hints.some(h => h.includes("web_search"))).toBe(true);
  });

  test("sollte keinen Tool-Hint liefern wenn der Schritt kein Tool erfordert", () => {
    const state = makeState({ currentStepIndex: 1 }); // STEP_THINK hat kein tool

    const ctx = getWorkflowContext(skill, state);

    const toolHints = ctx.hints.filter(h => h.toLowerCase().includes("tool"));
    expect(toolHints).toHaveLength(0);
  });

  test("sollte einen Bedingung-Hint liefern wenn der Schritt eine Bedingung hat", () => {
    const stepWithCondition = makeStep({ id: "c1", action: "tool", tool: "kb_search", description: "Suchen", condition: "Nur wenn Daten fehlen" });
    const skillWithCondition = makeSkill({ workflow: makeWorkflow([stepWithCondition]) });
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skillWithCondition, state);

    expect(ctx.hints.some(h => h.includes("Nur wenn Daten fehlen"))).toBe(true);
  });

  test("sollte einen Wiederhol-Hint liefern wenn der Schritt ein Repeat-Attribut hat", () => {
    const stepWithRepeat = makeStep({ id: "r1", action: "tool", tool: "web_search", description: "Mehrfach suchen", repeat: "2-3" });
    const skillWithRepeat = makeSkill({ workflow: makeWorkflow([stepWithRepeat]) });
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skillWithRepeat, state);

    expect(ctx.hints.some(h => h.includes("2-3"))).toBe(true);
  });

  test("sollte einen Hint für den nächsten Schritt liefern wenn ein nächster Schritt vorhanden ist", () => {
    const state = makeState({ currentStepIndex: 0 });

    const ctx = getWorkflowContext(skill, state);

    expect(ctx.hints.some(h => h.includes("Ergebnisse analysieren"))).toBe(true);
  });

  test("sollte keinen Nächster-Schritt-Hint liefern beim letzten Schritt", () => {
    const state = makeState({ currentStepIndex: 2 });

    const ctx = getWorkflowContext(skill, state);

    // Letzter Schritt hat keinen Nachfolger — "Antwort formulieren" darf nur im aktuellen Hint stehen
    const nextHints = ctx.hints.filter(h => h.includes("Nächster Schritt"));
    expect(nextHints).toHaveLength(0);
  });

  test("sollte 100% Fortschritt zurückgeben wenn der Skill keinen Workflow hat", () => {
    const skillWithoutWorkflow = makeSkill(); // kein workflow
    const state = makeState({ completedSteps: [] });

    const ctx = getWorkflowContext(skillWithoutWorkflow, state);

    expect(ctx.progress).toBe(100);
    expect(ctx.currentStep).toBeNull();
    expect(ctx.nextStep).toBeNull();
    expect(ctx.previousStep).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// advanceWorkflow
// ---------------------------------------------------------------------------

describe("advanceWorkflow", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const workflow = makeWorkflow(steps);

  test("sollte den currentStepIndex um eins erhöhen", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const next = advanceWorkflow(state, workflow);

    expect(next.currentStepIndex).toBe(1);
  });

  test("sollte den aktuellen Schritt-Index zu completedSteps hinzufügen", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const next = advanceWorkflow(state, workflow);

    expect(next.completedSteps).toContain(0);
  });

  test("sollte vorhandene completedSteps beibehalten", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const next = advanceWorkflow(state, workflow);

    expect(next.completedSteps).toContain(0);
    expect(next.completedSteps).toContain(1);
  });

  test("sollte isComplete=true setzen wenn der letzte Schritt abgeschlossen wird", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1] });

    const next = advanceWorkflow(state, workflow);

    expect(next.isComplete).toBe(true);
  });

  test("sollte den currentStepIndex nicht erhöhen wenn der Workflow abgeschlossen ist", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1] });

    const next = advanceWorkflow(state, workflow);

    // Nach dem Abschluss bleibt der Index auf dem letzten Schritt
    expect(next.currentStepIndex).toBe(2);
  });

  test("sollte den State unverändert zurückgeben wenn isComplete bereits true ist", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1, 2], isComplete: true });

    const next = advanceWorkflow(state, workflow);

    expect(next).toBe(state); // Identische Referenz — kein neues Objekt
  });

  test("sollte lastStepAt auf einen aktuellen Zeitstempel setzen", () => {
    const before = Date.now();
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const next = advanceWorkflow(state, workflow);
    const after = Date.now();

    expect(next.lastStepAt).not.toBeNull();
    expect(next.lastStepAt!).toBeGreaterThanOrEqual(before);
    expect(next.lastStepAt!).toBeLessThanOrEqual(after);
  });

  test("sollte den State unveränderbar lassen (original bleibt unberührt)", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    advanceWorkflow(state, workflow);

    expect(state.currentStepIndex).toBe(0);
    expect(state.completedSteps).toHaveLength(0);
  });

  test("sollte nach dem ersten Schritt von 3 isComplete=false behalten", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const next = advanceWorkflow(state, workflow);

    expect(next.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateToolForStep
// ---------------------------------------------------------------------------

describe("validateToolForStep", () => {
  test("sollte valid=true zurückgeben wenn das Tool mit dem Schritt übereinstimmt", () => {
    const step = makeStep({ id: "s1", action: "tool", tool: "web_search", description: "Suchen" });

    const result = validateToolForStep("web_search", step);

    expect(result.valid).toBe(true);
  });

  test("sollte valid=false zurückgeben wenn das Tool nicht übereinstimmt", () => {
    const step = makeStep({ id: "s1", action: "tool", tool: "web_search", description: "Suchen" });

    const result = validateToolForStep("file_read", step);

    expect(result.valid).toBe(false);
  });

  test("sollte eine Fehlermeldung bei Abweichung enthalten mit erwartetem und tatsächlichem Tool", () => {
    const step = makeStep({ id: "s1", action: "tool", tool: "web_search", description: "Suchen" });

    const result = validateToolForStep("file_read", step);

    expect(result.message).toBeDefined();
    expect(result.message).toContain("web_search");
    expect(result.message).toContain("file_read");
  });

  test("sollte valid=true für einen 'think'-Schritt zurückgeben unabhängig vom Tool-Namen", () => {
    const step = makeStep({ id: "s1", action: "think", description: "Analysieren" });

    const result = validateToolForStep("irgendwas", step);

    expect(result.valid).toBe(true);
  });

  test("sollte valid=true für einen 'respond'-Schritt zurückgeben", () => {
    const step = makeStep({ id: "s1", action: "respond", description: "Antworten" });

    const result = validateToolForStep("irgendwas", step);

    expect(result.valid).toBe(true);
  });

  test("sollte valid=true für einen 'delegate'-Schritt zurückgeben", () => {
    const step = makeStep({ id: "s1", action: "delegate", description: "Delegieren" });

    const result = validateToolForStep("irgendwas", step);

    expect(result.valid).toBe(true);
  });

  test("sollte valid=true zurückgeben wenn ein Tool-Schritt kein spezifisches Tool vorschreibt", () => {
    const step = makeStep({ id: "s1", action: "tool", description: "Beliebiges Tool verwenden" }); // kein tool

    const result = validateToolForStep("beliebiges_tool", step);

    expect(result.valid).toBe(true);
  });

  test("sollte eine Meldung liefern wenn der Schritt kein Tool erfordert", () => {
    const step = makeStep({ id: "s1", action: "think", description: "Denken" });

    const result = validateToolForStep("web_search", step);

    expect(result.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildWorkflowPromptSection
// ---------------------------------------------------------------------------

describe("buildWorkflowPromptSection", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const skill = makeSkill({ workflow: makeWorkflow(steps) });

  test("sollte den Fortschritt-Prozentsatz enthalten", () => {
    const state = makeState({ completedSteps: [0], currentStepIndex: 1 });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("33%"); // 1/3 abgeschlossen
  });

  test("sollte die Anzahl abgeschlossener Schritte und Gesamtschritte enthalten", () => {
    const state = makeState({ completedSteps: [0], currentStepIndex: 1 });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("1/3");
  });

  test("sollte abgeschlossene Schritte mit ✓ markieren", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("✓");
  });

  test("sollte den aktuellen Schritt mit ▶ markieren", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("▶");
  });

  test("sollte ausstehende Schritte mit ○ markieren", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("○");
  });

  test("sollte die Beschreibung jedes Schrittes enthalten", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("Web durchsuchen");
    expect(section).toContain("Ergebnisse analysieren");
    expect(section).toContain("Antwort formulieren");
  });

  test("sollte einen Hint-Abschnitt mit dem aktuellen Schritt enthalten", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("Aktueller Schritt");
  });

  test("sollte die Abschlussmeldung enthalten wenn isComplete=true", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1, 2], isComplete: true });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("Workflow abgeschlossen");
  });

  test("sollte keinen Aktueller-Schritt-Abschnitt enthalten wenn isComplete=true", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1, 2], isComplete: true });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).not.toContain("Aktueller Schritt:");
  });

  test("sollte eine leere Zeichenkette zurückgeben wenn der Skill keinen Workflow hat", () => {
    const skillWithoutWorkflow = makeSkill();
    const state = makeState();

    const section = buildWorkflowPromptSection(skillWithoutWorkflow, state);

    expect(section).toBe("");
  });

  test("sollte eine leere Zeichenkette zurückgeben wenn der Workflow keine Schritte hat", () => {
    const skillNoSteps = makeSkill({ workflow: makeWorkflow([]) });
    const state = makeState();

    const section = buildWorkflowPromptSection(skillNoSteps, state);

    expect(section).toBe("");
  });

  test("sollte die Tool-Namen für Tool-Schritte enthalten", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("web_search");
  });

  test("sollte die Bedingung des aktuellen Schritts anzeigen", () => {
    const stepWithCondition = makeStep({ id: "c1", action: "tool", tool: "kb_search", description: "Suchen", condition: "Nur wenn nötig" });
    const skillWithCondition = makeSkill({ workflow: makeWorkflow([stepWithCondition, STEP_RESPOND]) });
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skillWithCondition, state);

    expect(section).toContain("Nur wenn nötig");
  });

  test("sollte den Workflow-Status als Markdown-Überschrift einleiten", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const section = buildWorkflowPromptSection(skill, state);

    expect(section).toContain("## Workflow Status");
  });
});

// ---------------------------------------------------------------------------
// createStepEvent
// ---------------------------------------------------------------------------

describe("createStepEvent", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const workflow = makeWorkflow(steps);

  test("sollte type='workflow_step_start' zurückgeben wenn type='start' übergeben wird", () => {
    const state = makeState({ skillId: "my-skill", currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.type).toBe("workflow_step_start");
  });

  test("sollte type='workflow_step_complete' zurückgeben wenn type='complete' übergeben wird", () => {
    const state = makeState({ skillId: "my-skill", currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "complete");

    expect(event.type).toBe("workflow_step_complete");
  });

  test("sollte die skillId korrekt aus dem State übernehmen", () => {
    const state = makeState({ skillId: "recherche", currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.skillId).toBe("recherche");
  });

  test("sollte den stepIndex korrekt setzen", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepIndex).toBe(1);
  });

  test("sollte die stepId des aktuellen Schritts liefern", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepId).toBe("s1");
  });

  test("sollte die stepAction des aktuellen Schritts liefern", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepAction).toBe("tool");
  });

  test("sollte die stepDescription des aktuellen Schritts liefern", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepDescription).toBe("Web durchsuchen");
  });

  test("sollte die Gesamtschrittanzahl korrekt liefern", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.totalSteps).toBe(3);
  });

  test("sollte den Fortschritt als 0 liefern wenn noch kein Schritt abgeschlossen ist", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [] });

    const event = createStepEvent(state, workflow, "start");

    expect(event.progress).toBe(0);
  });

  test("sollte den Fortschritt korrekt berechnen nach abgeschlossenen Schritten", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0] });

    const event = createStepEvent(state, workflow, "complete");

    expect(event.progress).toBe(33); // Math.round(1/3 * 100)
  });

  test("sollte einen Fallback-stepId generieren wenn kein Schritt am aktuellen Index vorhanden ist", () => {
    const state = makeState({ currentStepIndex: 99, completedSteps: [] }); // ungültiger Index

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepId).toBe("step_99");
  });

  test("sollte stepAction='unknown' liefern wenn kein Schritt am aktuellen Index vorhanden ist", () => {
    const state = makeState({ currentStepIndex: 99, completedSteps: [] }); // ungültiger Index

    const event = createStepEvent(state, workflow, "start");

    expect(event.stepAction).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// shouldAutoAdvance
// ---------------------------------------------------------------------------

describe("shouldAutoAdvance", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const workflow = makeWorkflow(steps);

  test("sollte true zurückgeben wenn das abgeschlossene Tool mit dem Schritt übereinstimmt", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [], isComplete: false });

    const result = shouldAutoAdvance(state, workflow, "web_search");

    expect(result).toBe(true);
  });

  test("sollte false zurückgeben wenn ein anderes Tool abgeschlossen wurde", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [], isComplete: false });

    const result = shouldAutoAdvance(state, workflow, "file_read");

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn der Workflow bereits abgeschlossen ist", () => {
    const state = makeState({ currentStepIndex: 2, completedSteps: [0, 1, 2], isComplete: true });

    const result = shouldAutoAdvance(state, workflow, "web_search");

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn kein Tool-Name übergeben wird", () => {
    const state = makeState({ currentStepIndex: 0, completedSteps: [], isComplete: false });

    const result = shouldAutoAdvance(state, workflow);

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn der aktuelle Schritt kein Tool-Schritt ist", () => {
    const state = makeState({ currentStepIndex: 1, completedSteps: [0], isComplete: false }); // STEP_THINK

    const result = shouldAutoAdvance(state, workflow, "web_search");

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn der Schritt ein Repeat-Attribut hat", () => {
    const stepWithRepeat = makeStep({ id: "r1", action: "tool", tool: "web_search", description: "Mehrfach suchen", repeat: "2-3" });
    const workflowWithRepeat = makeWorkflow([stepWithRepeat, STEP_RESPOND]);
    const state = makeState({ currentStepIndex: 0, completedSteps: [], isComplete: false });

    const result = shouldAutoAdvance(state, workflowWithRepeat, "web_search");

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn kein Schritt am aktuellen Index vorhanden ist", () => {
    const state = makeState({ currentStepIndex: 99, completedSteps: [], isComplete: false }); // ungültiger Index

    const result = shouldAutoAdvance(state, workflow, "web_search");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSuggestedTool
// ---------------------------------------------------------------------------

describe("getSuggestedTool", () => {
  const steps = [STEP_SEARCH, STEP_THINK, STEP_RESPOND];
  const workflow = makeWorkflow(steps);

  test("sollte den Tool-Namen für einen Tool-Schritt zurückgeben", () => {
    const state = makeState({ currentStepIndex: 0, isComplete: false }); // STEP_SEARCH

    const tool = getSuggestedTool(state, workflow);

    expect(tool).toBe("web_search");
  });

  test("sollte null zurückgeben wenn der aktuelle Schritt kein Tool-Schritt ist", () => {
    const state = makeState({ currentStepIndex: 1, isComplete: false }); // STEP_THINK

    const tool = getSuggestedTool(state, workflow);

    expect(tool).toBeNull();
  });

  test("sollte null zurückgeben wenn der aktuelle Schritt ein 'respond'-Schritt ist", () => {
    const state = makeState({ currentStepIndex: 2, isComplete: false }); // STEP_RESPOND

    const tool = getSuggestedTool(state, workflow);

    expect(tool).toBeNull();
  });

  test("sollte null zurückgeben wenn der Workflow abgeschlossen ist", () => {
    const state = makeState({ currentStepIndex: 0, isComplete: true });

    const tool = getSuggestedTool(state, workflow);

    expect(tool).toBeNull();
  });

  test("sollte null zurückgeben wenn ein Tool-Schritt kein spezifisches Tool definiert", () => {
    const stepNoTool = makeStep({ id: "nt1", action: "tool", description: "Beliebiges Tool" }); // kein tool-Feld
    const workflowNoTool = makeWorkflow([stepNoTool]);
    const state = makeState({ currentStepIndex: 0, isComplete: false });

    const tool = getSuggestedTool(state, workflowNoTool);

    expect(tool).toBeNull();
  });

  test("sollte null zurückgeben wenn kein Schritt am aktuellen Index vorhanden ist", () => {
    const state = makeState({ currentStepIndex: 99, isComplete: false }); // ungültiger Index

    const tool = getSuggestedTool(state, workflow);

    expect(tool).toBeNull();
  });
});
