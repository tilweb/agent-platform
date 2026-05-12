/**
 * Delegate to Agent Tool - Allows agents to delegate tasks to other agents
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';

// Handler type for delegation
export type DelegationHandler = (
  agentId: string,
  task: string,
  context?: string
) => Promise<string>;

export class DelegateToAgentTool implements Tool {
  readonly name = 'delegate_to_agent';
  readonly type = 'delegation' as const;

  private handler: DelegationHandler | null = null;
  private availableAgents: () => Promise<Array<{ id: string; name: string; description: string }>>;

  constructor(
    getAvailableAgents: () => Promise<Array<{ id: string; name: string; description: string }>>
  ) {
    this.availableAgents = getAvailableAgents;
  }

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Delegiere eine Aufgabe an einen spezialisierten Agenten. Nutze dies wenn ein anderer Agent die Aufgabe besser bearbeiten kann. Verfuegbare Agenten sind z.B. knowledge, writer, researcher, general, google-drive, google-mail, confluence, jira, pipedrive, docuware.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'ID des Ziel-Agenten (z.B. "knowledge", "writer", "researcher", "google-drive", "google-mail", "confluence")',
            },
            task: {
              type: 'string',
              description: 'Klare Beschreibung der zu delegierenden Aufgabe',
            },
            context: {
              type: 'string',
              description: 'Optionaler zusaetzlicher Kontext oder relevante Informationen fuer die Aufgabe',
            },
          },
          required: ['agent_id', 'task'],
        },
      },
    };
  }

  /**
   * Set the delegation handler
   */
  setHandler(handler: DelegationHandler | null): void {
    this.handler = handler;
  }

  /**
   * Get the current handler
   */
  getHandler(): DelegationHandler | null {
    return this.handler;
  }

  async execute(
    args: { agent_id: string; task: string; context?: string },
    context?: ToolContext
  ): Promise<string> {
    const { agent_id, task, context: taskContext } = args;

    if (!agent_id) {
      return 'Error: agent_id is required';
    }

    if (!task) {
      return 'Error: task is required';
    }

    if (!this.handler) {
      return 'Error: Delegation not available in current context';
    }

    // Prevent self-delegation
    if (context?.agentId && context.agentId === agent_id) {
      return `Error: Agent "${agent_id}" cannot delegate to itself. Complete the task directly or delegate to a different agent.`;
    }

    // Validate agent exists
    const agents = await this.availableAgents();
    const targetAgent = agents.find(a => a.id === agent_id);

    if (!targetAgent) {
      const available = agents.map(a => `${a.id} (${a.name})`).join(', ');
      return `Error: Agent "${agent_id}" not found. Available agents: ${available}`;
    }

    // Security: bei User-Agents pruefen, ob der originale User Zugriff hat.
    // Built-in Agents (system=true ODER internal=true — beides bedeutet
    // "ships with code") sind fuer alle eingeloggten User zugaenglich;
    // User-Agents brauchen explizite Berechtigung.
    // `availableAgents` liefert id/name/description — wir laden den vollen
    // Config-Eintrag fuer system/internal-Flags.
    try {
      const { loadAgent } = await import('../../services/agents');
      const targetFull = await loadAgent(agent_id);
      if (targetFull && !targetFull.system && !targetFull.internal) {
        const userId = context?.userId;
        if (!userId) {
          return `Error: Kein User-Kontext — Delegation an User-Agent "${agent_id}" verweigert.`;
        }
        const { canView } = await import('../../rbac/accessControl');
        const access = await canView(userId, 'agent', agent_id);
        if (!access.allowed) {
          return `Error: Zugriff auf Agent "${agent_id}" verweigert. Du darfst nur an Agents delegieren, fuer die du Berechtigung hast.`;
        }
      }
    } catch (e: any) {
      console.error('[delegate_to_agent] Permission check failed:', e?.message);
      return `Error: Berechtigungspruefung fuer Agent "${agent_id}" fehlgeschlagen.`;
    }

    // Execute delegation
    try {
      return await this.handler(agent_id, task, taskContext);
    } catch (error: any) {
      return `Error during delegation: ${error.message}`;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.handler !== null;
  }
}
