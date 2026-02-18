/**
 * Create Task Tool
 *
 * Allows the supervisor agent to create background tasks that run independently.
 * Tasks are queued and executed asynchronously, allowing long-running operations
 * without blocking the chat conversation.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import {
  createTask,
  enqueueTask,
  getTask,
  type CreateTaskParams,
  type TaskPriority,
} from '../../services/taskService';

interface CreateTaskArgs {
  title: string;
  description: string;
  priority?: TaskPriority;
  assigned_agent?: string;
  context?: string;
  enqueue?: boolean;
}

export class CreateTaskTool implements Tool {
  readonly name = 'create_task';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Erstellt einen Background-Task, der unabhaengig vom Chat ausgefuehrt wird.

Nutze dieses Tool fuer:
- Langwierige Recherchen oder Analysen
- Aufgaben, die der Benutzer spaeter abrufen moechte
- Wiederkehrende oder geplante Aufgaben
- Komplexe Multi-Step-Operationen

Der Task wird in eine Queue eingereiht und automatisch ausgefuehrt.
Der Benutzer kann den Fortschritt auf der Tasks-Seite verfolgen.

Beispiele:
- "Recherchiere ausfuehrlich zum Thema X" -> Hintergrund-Task erstellen
- "Analysiere diese Daten und erstelle einen Bericht" -> Hintergrund-Task erstellen
- "Fuehre diese Aufgabe spaeter aus" -> Hintergrund-Task erstellen`,
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Kurzer, beschreibender Titel des Tasks (max 100 Zeichen)',
            },
            description: {
              type: 'string',
              description: 'Detaillierte Beschreibung der Aufgabe. Enthaelt alle notwendigen Informationen fuer die Ausfuehrung.',
            },
            priority: {
              type: 'string',
              description: 'Prioritaet des Tasks',
              enum: ['low', 'normal', 'high', 'urgent'],
            },
            assigned_agent: {
              type: 'string',
              description: 'ID des Agenten, der den Task ausfuehren soll (optional, Standard: supervisor)',
            },
            context: {
              type: 'string',
              description: 'Zusaetzlicher Kontext aus der aktuellen Konversation',
            },
            enqueue: {
              type: 'boolean',
              description: 'Ob der Task sofort in die Queue eingereiht werden soll (Standard: true)',
            },
          },
          required: ['title', 'description'],
        },
      },
    };
  }

  async execute(args: CreateTaskArgs, context?: ToolContext): Promise<string> {
    const {
      title,
      description,
      priority = 'normal',
      assigned_agent,
      context: taskContext,
      enqueue = true,
    } = args;

    // Validate title
    if (!title || title.trim().length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Titel ist erforderlich.',
      });
    }

    if (title.length > 100) {
      return JSON.stringify({
        success: false,
        error: 'Titel darf maximal 100 Zeichen haben.',
      });
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Beschreibung ist erforderlich.',
      });
    }

    try {
      // Build full description with context
      let fullDescription = description;
      if (taskContext) {
        fullDescription = `${description}\n\nKontext: ${taskContext}`;
      }

      // Create task params
      const params: CreateTaskParams = {
        title: title.trim(),
        description: fullDescription,
        type: 'simple',
        priority,
        trigger: 'chat',
        assigned_agent: assigned_agent || 'supervisor',
        created_by: 'supervisor',
        source_session_id: context?.sessionId,  // Chat-Session verknüpfen
        config: {
          context: taskContext,
        },
      };

      // Create the task
      const task = await createTask(params);

      // Enqueue if requested
      if (enqueue) {
        await enqueueTask(task.id, priority);
      }

      // Get updated task
      const updatedTask = await getTask(task.id);

      return JSON.stringify({
        success: true,
        message: `Task "${title}" wurde erstellt und ${enqueue ? 'in die Queue eingereiht' : 'gespeichert'}.`,
        task: {
          id: updatedTask?.id || task.id,
          title: updatedTask?.title || task.title,
          status: updatedTask?.status || task.status,
          priority: updatedTask?.priority || task.priority,
        },
        info: enqueue
          ? 'Der Task wird automatisch im Hintergrund ausgefuehrt. Der Fortschritt kann auf der Tasks-Seite verfolgt werden.'
          : 'Der Task wurde gespeichert, aber noch nicht gestartet.',
      });
    } catch (error: any) {
      console.error('Create task tool error:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getMetadata() {
    return {
      name: this.name,
      description: 'Erstellt Background-Tasks fuer asynchrone Ausfuehrung',
      type: this.type,
      category: 'tasks',
    };
  }
}
