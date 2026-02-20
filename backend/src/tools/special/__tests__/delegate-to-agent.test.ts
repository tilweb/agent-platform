/**
 * Tests fuer DelegateToAgentTool (backend/src/tools/special/delegate-to-agent.ts)
 *
 * Rein unit-basiert — keine mock.module()-Aufrufe noetig, da alle Abhaengigkeiten
 * per Konstruktor/setHandler injiziert werden.
 * Shared mutable mockState wird in beforeEach zurueckgesetzt, um Testisolation
 * sicherzustellen.
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { DelegateToAgentTool } from "../delegate-to-agent";
import type { DelegationHandler } from "../delegate-to-agent";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

type AgentEntry = { id: string; name: string; description: string };

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  agents: [
    { id: "researcher", name: "Researcher", description: "Recherchiert Themen" },
    { id: "writer", name: "Writer", description: "Schreibt Texte" },
  ] as AgentEntry[],
  agentsError: null as Error | null,
  handlerResult: "Delegation erfolgreich abgeschlossen" as string,
  handlerError: null as Error | null,
  lastHandlerArgs: null as { agentId: string; task: string; context: string | undefined } | null,
};

// ---------------------------------------------------------------------------
// Mock-Hilfsfunktionen (neu erstellt je Test, greift auf mockState zu)
// ---------------------------------------------------------------------------

function makeGetAvailableAgents(): () => Promise<AgentEntry[]> {
  return async () => {
    if (mockState.agentsError) throw mockState.agentsError;
    return mockState.agents;
  };
}

function makeHandler(): DelegationHandler {
  return async (agentId: string, task: string, context?: string) => {
    mockState.lastHandlerArgs = { agentId, task, context };
    if (mockState.handlerError) throw mockState.handlerError;
    return mockState.handlerResult;
  };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function resetMockState() {
  mockState.agents = [
    { id: "researcher", name: "Researcher", description: "Recherchiert Themen" },
    { id: "writer", name: "Writer", description: "Schreibt Texte" },
  ];
  mockState.agentsError = null;
  mockState.handlerResult = "Delegation erfolgreich abgeschlossen";
  mockState.handlerError = null;
  mockState.lastHandlerArgs = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DelegateToAgentTool", () => {
  let tool: DelegateToAgentTool;

  beforeEach(() => {
    resetMockState();
    tool = new DelegateToAgentTool(makeGetAvailableAgents());
  });

  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("sollte den Namen 'delegate_to_agent' setzen", () => {
      expect(tool.name).toBe("delegate_to_agent");
    });

    test("sollte den Typ 'delegation' setzen", () => {
      expect(tool.type).toBe("delegation");
    });

    test("sollte die uebergebene availableAgents-Callback-Funktion speichern und aufrufbar machen", async () => {
      let called = false;
      const customAgents = async () => {
        called = true;
        return [{ id: "custom-agent", name: "Custom", description: "Test-Agent" }];
      };
      const customTool = new DelegateToAgentTool(customAgents);
      // Trigger agent lookup via execute (with handler set)
      customTool.setHandler(makeHandler());
      await customTool.execute({ agent_id: "custom-agent", task: "Eine Aufgabe" });
      expect(called).toBe(true);
    });
  });

  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("sollte den Typ 'function' zurueckgeben", () => {
      const def = tool.getDefinition();
      expect(def.type).toBe("function");
    });

    test("sollte den Funktionsnamen 'delegate_to_agent' zurueckgeben", () => {
      const def = tool.getDefinition();
      expect(def.function.name).toBe("delegate_to_agent");
    });

    test("sollte 'agent_id' und 'task' als required-Felder definieren", () => {
      const def = tool.getDefinition();
      const required = def.function.parameters.required;
      expect(required).toContain("agent_id");
      expect(required).toContain("task");
    });

    test("sollte eine optionale 'context'-Property enthalten", () => {
      const def = tool.getDefinition();
      const props = def.function.parameters.properties;
      expect(props).toHaveProperty("context");
      expect(props["context"]!.type).toBe("string");
    });

    test("sollte eine nicht-leere Beschreibung enthalten", () => {
      const def = tool.getDefinition();
      expect(typeof def.function.description).toBe("string");
      expect(def.function.description.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("setHandler() / getHandler()", () => {
    test("sollte initial null zurueckgeben", () => {
      expect(tool.getHandler()).toBeNull();
    });

    test("sollte den gesetzten Handler zurueckgeben", () => {
      const handler = makeHandler();
      tool.setHandler(handler);
      expect(tool.getHandler()).toBe(handler);
    });

    test("sollte null zurueckgeben, nachdem Handler auf null gesetzt wurde", () => {
      tool.setHandler(makeHandler());
      tool.setHandler(null);
      expect(tool.getHandler()).toBeNull();
    });

    test("sollte dieselbe Referenz zurueckgeben, die gesetzt wurde", () => {
      const handler = makeHandler();
      tool.setHandler(handler);
      const retrieved = tool.getHandler();
      expect(retrieved).toBe(handler);
    });
  });

  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("sollte false zurueckgeben, wenn kein Handler gesetzt ist", async () => {
      expect(await tool.isAvailable()).toBe(false);
    });

    test("sollte true zurueckgeben, wenn ein Handler gesetzt ist", async () => {
      tool.setHandler(makeHandler());
      expect(await tool.isAvailable()).toBe(true);
    });

    test("sollte false zurueckgeben, nachdem Handler auf null gesetzt wurde", async () => {
      tool.setHandler(makeHandler());
      tool.setHandler(null);
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("sollte Fehler-String zurueckgeben, wenn agent_id fehlt", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "", task: "Eine Aufgabe" });
      expect(result).toBe("Error: agent_id is required");
    });

    test("sollte Fehler-String zurueckgeben, wenn agent_id ein leerer String ist", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "", task: "Eine Aufgabe" });
      expect(result).toContain("agent_id");
    });

    test("sollte Fehler-String zurueckgeben, wenn task fehlt", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "researcher", task: "" });
      expect(result).toBe("Error: task is required");
    });

    test("sollte Fehler-String zurueckgeben, wenn task ein leerer String ist", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "researcher", task: "" });
      expect(result).toContain("task");
    });

    test("sollte 'Delegation not available' zurueckgeben, wenn kein Handler gesetzt ist", async () => {
      // Kein setHandler-Aufruf
      const result = await tool.execute({ agent_id: "researcher", task: "Aufgabe" });
      expect(result).toBe("Error: Delegation not available in current context");
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Selbst-Delegation", () => {
    test("sollte Selbst-Delegation blockieren, wenn context.agentId === agent_id", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute(
        { agent_id: "researcher", task: "Selbst-Aufgabe" },
        { agentId: "researcher" }
      );
      expect(result).toContain("Error");
      expect(result).toContain("researcher");
    });

    test("sollte die Fehlermeldung den Agent-Namen nennen und andere Agenten empfehlen", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute(
        { agent_id: "writer", task: "Selbst-Aufgabe" },
        { agentId: "writer" }
      );
      expect(result).toContain("writer");
      expect(result.toLowerCase()).toContain("delegate");
    });

    test("sollte Delegation erlauben, wenn context.agentId eine andere ID hat", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute(
        { agent_id: "researcher", task: "Recherche-Aufgabe" },
        { agentId: "writer" }
      );
      expect(result).toBe(mockState.handlerResult);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Agent-Validierung", () => {
    test("sollte Fehler zurueckgeben, wenn agent_id nicht in der Agentenliste vorkommt", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "unbekannter-agent", task: "Eine Aufgabe" });
      expect(result).toContain("Error");
      expect(result).toContain("unbekannter-agent");
    });

    test("sollte die verfuegbaren Agenten mit id und Name im Fehler auflisten", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "nicht-vorhanden", task: "Aufgabe" });
      expect(result).toContain("researcher");
      expect(result).toContain("Researcher");
      expect(result).toContain("writer");
      expect(result).toContain("Writer");
    });

    test("sollte availableAgents() waehrend der Validierung aufrufen", async () => {
      let agentsCalled = false;
      const trackingTool = new DelegateToAgentTool(async () => {
        agentsCalled = true;
        return mockState.agents;
      });
      trackingTool.setHandler(makeHandler());
      await trackingTool.execute({ agent_id: "researcher", task: "Test" });
      expect(agentsCalled).toBe(true);
    });

    test("sollte Delegation fortsetzen, wenn die agent_id gueltig ist", async () => {
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "writer", task: "Schreibe einen Text" });
      expect(result).toBe(mockState.handlerResult);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Erfolgreiche Delegation", () => {
    test("sollte den Handler mit agent_id, task und context aufrufen", async () => {
      tool.setHandler(makeHandler());
      await tool.execute({ agent_id: "researcher", task: "Recherchiere KI", context: "Kontext: AI-Trends 2026" });
      expect(mockState.lastHandlerArgs).not.toBeNull();
      expect(mockState.lastHandlerArgs!.agentId).toBe("researcher");
      expect(mockState.lastHandlerArgs!.task).toBe("Recherchiere KI");
      expect(mockState.lastHandlerArgs!.context).toBe("Kontext: AI-Trends 2026");
    });

    test("sollte das Ergebnis des Handlers direkt zurueckgeben", async () => {
      mockState.handlerResult = "Spezifisches Handler-Ergebnis";
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "researcher", task: "Aufgabe" });
      expect(result).toBe("Spezifisches Handler-Ergebnis");
    });

    test("sollte context als undefined an den Handler uebergeben, wenn kein context angegeben wurde", async () => {
      tool.setHandler(makeHandler());
      await tool.execute({ agent_id: "researcher", task: "Aufgabe ohne Kontext" });
      expect(mockState.lastHandlerArgs).not.toBeNull();
      expect(mockState.lastHandlerArgs!.context).toBeUndefined();
    });

    test("sollte den context-String korrekt an den Handler uebergeben", async () => {
      tool.setHandler(makeHandler());
      await tool.execute({
        agent_id: "writer",
        task: "Schreibe Zusammenfassung",
        context: "Konversationskontext aus dem Chat",
      });
      expect(mockState.lastHandlerArgs!.context).toBe("Konversationskontext aus dem Chat");
    });

    test("sollte mit verschiedenen agent_ids korrekt funktionieren", async () => {
      tool.setHandler(makeHandler());

      const resultResearcher = await tool.execute({ agent_id: "researcher", task: "Aufgabe A" });
      expect(resultResearcher).toBe(mockState.handlerResult);

      const resultWriter = await tool.execute({ agent_id: "writer", task: "Aufgabe B" });
      expect(resultWriter).toBe(mockState.handlerResult);
    });
  });

  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("sollte 'Error during delegation: {message}' zurueckgeben, wenn der Handler wirft", async () => {
      mockState.handlerError = new Error("Netzwerkfehler beim Agenten");
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "researcher", task: "Fehlgeschlagene Aufgabe" });
      expect(result).toBe("Error during delegation: Netzwerkfehler beim Agenten");
    });

    test("sollte den Fehler korrekt verarbeiten, wenn der Handler mit einem generischen Fehler wirft", async () => {
      mockState.handlerError = new Error("Unbekannter Fehler");
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "writer", task: "Aufgabe" });
      expect(result).toContain("Error during delegation:");
      expect(result).toContain("Unbekannter Fehler");
    });

    test("sollte netzwerkaehnliche Fehlermeldungen unveraendert weitergeben", async () => {
      mockState.handlerError = new Error("Connection refused: 127.0.0.1:8080");
      tool.setHandler(makeHandler());
      const result = await tool.execute({ agent_id: "researcher", task: "Netzwerk-Test" });
      expect(result).toBe("Error during delegation: Connection refused: 127.0.0.1:8080");
    });
  });
});
