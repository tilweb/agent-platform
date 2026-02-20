/**
 * Tests for CreateTaskTool (backend/src/tools/special/create-task.ts)
 *
 * Service dependencies are mocked at the module level via mock.module().
 * Shared mutable mockState is reset in beforeEach to ensure test isolation.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  createTaskResult: null as any,
  createTaskError: null as Error | null,
  enqueueTaskError: null as Error | null,
  getTaskResult: null as any,
  createTaskCallArgs: null as any,
  enqueueTaskCallArgs: null as { taskId: string; priority?: string } | null,
  getTaskCallArgs: null as string | null,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test.
// Path is relative to THIS test file; create-task.ts imports the same
// module via "../../services/taskService" which resolves to the same
// absolute path as "../../../services/taskService" from here.
// ---------------------------------------------------------------------------

mock.module("../../../services/taskService", () => ({
  createTask: async (params: any) => {
    mockState.createTaskCallArgs = params;
    if (mockState.createTaskError) {
      throw mockState.createTaskError;
    }
    return mockState.createTaskResult;
  },
  enqueueTask: async (taskId: string, priority?: string) => {
    mockState.enqueueTaskCallArgs = { taskId, priority };
    if (mockState.enqueueTaskError) {
      throw mockState.enqueueTaskError;
    }
  },
  getTask: async (taskId: string) => {
    mockState.getTaskCallArgs = taskId;
    return mockState.getTaskResult;
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { CreateTaskTool } = await import("../create-task");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<any> = {}): any {
  return {
    id: "task-abc-123",
    title: "Testaufgabe",
    description: "Beschreibung der Testaufgabe",
    type: "simple",
    priority: "normal",
    status: "pending",
    trigger: "chat",
    assigned_agent: "supervisor",
    created_by: "supervisor",
    created_at: "2026-02-20T10:00:00.000Z",
    updated_at: "2026-02-20T10:00:00.000Z",
    progress: 0,
    current_step: 0,
    total_steps: 0,
    steps: [],
    config: {},
    ...overrides,
  };
}

function resetMockState() {
  mockState.createTaskResult = makeTask();
  mockState.createTaskError = null;
  mockState.enqueueTaskError = null;
  mockState.getTaskResult = makeTask();
  mockState.createTaskCallArgs = null;
  mockState.enqueueTaskCallArgs = null;
  mockState.getTaskCallArgs = null;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("CreateTaskTool", () => {
  let tool: InstanceType<typeof CreateTaskTool>;

  beforeEach(() => {
    resetMockState();
    tool = new CreateTaskTool();
  });

  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("sollte den korrekten Funktionsnamen 'create_task' zurückgeben", () => {
      const def = tool.getDefinition();
      expect(def.type).toBe("function");
      expect(def.function.name).toBe("create_task");
    });

    test("sollte eine Beschreibung enthalten", () => {
      const def = tool.getDefinition();
      expect(typeof def.function.description).toBe("string");
      expect(def.function.description.length).toBeGreaterThan(0);
    });

    test("sollte 'title' und 'description' als required-Felder definieren", () => {
      const def = tool.getDefinition();
      const required = def.function.parameters.required;
      expect(required).toContain("title");
      expect(required).toContain("description");
    });

    test("sollte die properties title, description, priority, assigned_agent, context und enqueue enthalten", () => {
      const def = tool.getDefinition();
      const props = def.function.parameters.properties;
      expect(props).toHaveProperty("title");
      expect(props).toHaveProperty("description");
      expect(props).toHaveProperty("priority");
      expect(props).toHaveProperty("assigned_agent");
      expect(props).toHaveProperty("context");
      expect(props).toHaveProperty("enqueue");
    });

    test("sollte priority als enum mit den Werten low, normal, high, urgent definieren", () => {
      const def = tool.getDefinition();
      const priorityEnum = def.function.parameters.properties.priority.enum;
      expect(priorityEnum).toContain("low");
      expect(priorityEnum).toContain("normal");
      expect(priorityEnum).toContain("high");
      expect(priorityEnum).toContain("urgent");
    });

    test("sollte den parameters-type als 'object' definieren", () => {
      const def = tool.getDefinition();
      expect(def.function.parameters.type).toBe("object");
    });
  });

  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("sollte den Namen 'create_task' zurückgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.name).toBe("create_task");
    });

    test("sollte den Typ 'local' zurückgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.type).toBe("local");
    });

    test("sollte die Kategorie 'tasks' zurückgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.category).toBe("tasks");
    });

    test("sollte eine Beschreibung enthalten", () => {
      const meta = tool.getMetadata();
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("sollte immer true zurückgeben", async () => {
      const result = await tool.isAvailable();
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("sollte einen Fehler zurückgeben, wenn title fehlt", async () => {
      const result = await tool.execute({ title: "", description: "Eine Beschreibung" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    test("sollte einen Fehler zurückgeben, wenn title nur aus Leerzeichen besteht", async () => {
      const result = await tool.execute({ title: "   ", description: "Eine Beschreibung" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Titel");
    });

    test("sollte einen Fehler zurückgeben, wenn title mehr als 100 Zeichen hat", async () => {
      const longTitle = "A".repeat(101);
      const result = await tool.execute({ title: longTitle, description: "Eine Beschreibung" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(body.error).toContain("100");
    });

    test("sollte keinen Fehler zurückgeben, wenn title exakt 100 Zeichen hat", async () => {
      const exactTitle = "A".repeat(100);
      const result = await tool.execute({ title: exactTitle, description: "Eine Beschreibung" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
    });

    test("sollte einen Fehler zurückgeben, wenn description fehlt", async () => {
      const result = await tool.execute({ title: "Gültiger Titel", description: "" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    test("sollte einen Fehler zurückgeben, wenn description nur aus Leerzeichen besteht", async () => {
      const result = await tool.execute({ title: "Gültiger Titel", description: "   " });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Beschreibung");
    });

    test("sollte keinen createTask-Aufruf machen, wenn Validierung fehlschlägt", async () => {
      await tool.execute({ title: "", description: "Beschreibung" });
      expect(mockState.createTaskCallArgs).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Erfolgspfade", () => {
    test("sollte Task mit Standardwerten erstellen, wenn nur title und description übergeben werden", async () => {
      const result = await tool.execute({
        title: "Mein Task",
        description: "Aufgabenbeschreibung",
      });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);

      const params = mockState.createTaskCallArgs;
      expect(params.title).toBe("Mein Task");
      expect(params.description).toBe("Aufgabenbeschreibung");
      expect(params.priority).toBe("normal");
      expect(params.trigger).toBe("chat");
      expect(params.assigned_agent).toBe("supervisor");
    });

    test("sollte 'high' als priority an createTask weitergeben, wenn priority='high' übergeben wird", async () => {
      await tool.execute({
        title: "Dringender Task",
        description: "Sehr wichtig",
        priority: "high",
      });
      expect(mockState.createTaskCallArgs.priority).toBe("high");
    });

    test("sollte 'low' als priority an createTask weitergeben, wenn priority='low' übergeben wird", async () => {
      await tool.execute({
        title: "Niedrig-Priorität Task",
        description: "Nicht eilig",
        priority: "low",
      });
      expect(mockState.createTaskCallArgs.priority).toBe("low");
    });

    test("sollte assigned_agent='researcher' an createTask weitergeben", async () => {
      await tool.execute({
        title: "Recherche-Task",
        description: "Bitte recherchieren",
        assigned_agent: "researcher",
      });
      expect(mockState.createTaskCallArgs.assigned_agent).toBe("researcher");
    });

    test("sollte 'supervisor' als assigned_agent verwenden, wenn keiner angegeben wird", async () => {
      await tool.execute({
        title: "Standard-Task",
        description: "Standard-Beschreibung",
      });
      expect(mockState.createTaskCallArgs.assigned_agent).toBe("supervisor");
    });

    test("sollte context mit 'Kontext:'-Präfix an description anhängen", async () => {
      await tool.execute({
        title: "Kontext-Task",
        description: "Eigentliche Beschreibung",
        context: "Wichtiger Konversationskontext",
      });
      const fullDescription = mockState.createTaskCallArgs.description;
      expect(fullDescription).toContain("Eigentliche Beschreibung");
      expect(fullDescription).toContain("Kontext:");
      expect(fullDescription).toContain("Wichtiger Konversationskontext");
    });

    test("sollte description nicht modifizieren, wenn kein context übergeben wird", async () => {
      await tool.execute({
        title: "Einfacher Task",
        description: "Nur diese Beschreibung",
      });
      expect(mockState.createTaskCallArgs.description).toBe("Nur diese Beschreibung");
    });

    test("sollte enqueueTask aufrufen, wenn enqueue=true (Standard)", async () => {
      const task = makeTask({ id: "task-xyz" });
      mockState.createTaskResult = task;
      mockState.getTaskResult = task;

      await tool.execute({
        title: "Einzureihender Task",
        description: "Wird in Queue gesteckt",
      });

      expect(mockState.enqueueTaskCallArgs).not.toBeNull();
      expect(mockState.enqueueTaskCallArgs!.taskId).toBe("task-xyz");
    });

    test("sollte enqueueTask aufrufen, wenn enqueue explizit auf true gesetzt ist", async () => {
      await tool.execute({
        title: "Explizit einzureihender Task",
        description: "Direkt in Queue",
        enqueue: true,
      });
      expect(mockState.enqueueTaskCallArgs).not.toBeNull();
    });

    test("sollte enqueueTask NICHT aufrufen, wenn enqueue=false", async () => {
      await tool.execute({
        title: "Nicht einzureihender Task",
        description: "Nur speichern",
        enqueue: false,
      });
      expect(mockState.enqueueTaskCallArgs).toBeNull();
    });

    test("sollte 'gespeichert' in der Nachricht erwähnen, wenn enqueue=false", async () => {
      const result = await tool.execute({
        title: "Gespeicherter Task",
        description: "Nur speichern",
        enqueue: false,
      });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.message).toContain("gespeichert");
    });

    test("sollte 'in die Queue eingereiht' in der Nachricht erwähnen, wenn enqueue=true", async () => {
      const result = await tool.execute({
        title: "Queue-Task",
        description: "Wird eingereiht",
        enqueue: true,
      });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.message).toContain("Queue");
    });

    test("sollte die task-ID aus dem erstellten Task in der Antwort zurückgeben", async () => {
      const task = makeTask({ id: "returned-id-456", title: "Task-Titel" });
      mockState.createTaskResult = task;
      mockState.getTaskResult = task;

      const result = await tool.execute({
        title: "Task-Titel",
        description: "Beschreibung",
      });
      const body = JSON.parse(result);
      expect(body.task.id).toBe("returned-id-456");
    });

    test("sollte task-Felder aus getTask priorisieren, wenn getTask ein Ergebnis zurückgibt", async () => {
      const created = makeTask({ id: "task-001", status: "pending", priority: "normal" });
      const updated = makeTask({ id: "task-001", status: "queued", priority: "high" });
      mockState.createTaskResult = created;
      mockState.getTaskResult = updated;

      const result = await tool.execute({
        title: "Aktualisierter Task",
        description: "Beschreibung",
      });
      const body = JSON.parse(result);
      expect(body.task.status).toBe("queued");
      expect(body.task.priority).toBe("high");
    });

    test("sollte task-Felder aus createTask verwenden, wenn getTask null zurückgibt", async () => {
      const task = makeTask({ id: "task-002", status: "pending", priority: "normal" });
      mockState.createTaskResult = task;
      mockState.getTaskResult = null;

      const result = await tool.execute({
        title: "Fallback Task",
        description: "Beschreibung",
      });
      const body = JSON.parse(result);
      expect(body.task.id).toBe("task-002");
      expect(body.task.status).toBe("pending");
    });

    test("sollte context?.sessionId als source_session_id an createTask weitergeben", async () => {
      const toolContext = { sessionId: "session-abc-789" };

      await tool.execute(
        { title: "Session-Task", description: "Mit Session-ID" },
        toolContext
      );

      expect(mockState.createTaskCallArgs.source_session_id).toBe("session-abc-789");
    });

    test("sollte source_session_id undefined lassen, wenn kein context übergeben wird", async () => {
      await tool.execute({ title: "Kein-Context-Task", description: "Ohne Context" });
      expect(mockState.createTaskCallArgs.source_session_id).toBeUndefined();
    });

    test("sollte source_session_id undefined lassen, wenn context keine sessionId hat", async () => {
      await tool.execute(
        { title: "Context-Ohne-Session", description: "Context ohne sessionId" },
        { agentId: "agent-1" }
      );
      expect(mockState.createTaskCallArgs.source_session_id).toBeUndefined();
    });

    test("sollte title trimmen, bevor er an createTask übergeben wird", async () => {
      await tool.execute({
        title: "  Task mit Leerzeichen  ",
        description: "Beschreibung",
      });
      expect(mockState.createTaskCallArgs.title).toBe("Task mit Leerzeichen");
    });

    test("sollte eine success:true-Antwort als gültiges JSON zurückgeben", async () => {
      const result = await tool.execute({
        title: "JSON-Test",
        description: "Prüfung der JSON-Struktur",
      });
      expect(() => JSON.parse(result)).not.toThrow();
      const body = JSON.parse(result);
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("task");
      expect(body).toHaveProperty("info");
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("sollte success:false zurückgeben, wenn createTask einen Fehler wirft", async () => {
      mockState.createTaskError = new Error("Datenbankfehler");

      const result = await tool.execute({
        title: "Fehlerhafter Task",
        description: "Dieser wird fehlschlagen",
      });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Datenbankfehler");
    });

    test("sollte die Fehlermeldung aus dem geworfenen Fehler übernehmen", async () => {
      mockState.createTaskError = new Error("Ungültige Task-Konfiguration");

      const result = await tool.execute({
        title: "Ungültiger Task",
        description: "Schlägt fehl",
      });
      const body = JSON.parse(result);
      expect(body.error).toContain("Ungültige Task-Konfiguration");
    });

    test("sollte bei createTask-Fehler ein gültiges JSON zurückgeben", async () => {
      mockState.createTaskError = new Error("Irgendein Fehler");

      const result = await tool.execute({
        title: "Fehler-Task",
        description: "Schlägt sicher fehl",
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test("sollte enqueueTask nicht aufrufen, wenn createTask fehlschlägt", async () => {
      mockState.createTaskError = new Error("Fehler beim Erstellen");

      await tool.execute({
        title: "Kein Enqueue",
        description: "Erstellen schlägt fehl",
        enqueue: true,
      });
      expect(mockState.enqueueTaskCallArgs).toBeNull();
    });
  });
});
