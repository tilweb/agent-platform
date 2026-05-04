/**
 * User Memory Tool (v2)
 *
 * Allows agents to store and retrieve information about the user.
 * Three sections:
 * - about: Facts about the user (bio, background, role)
 * - instructions: How the assistant should behave
 * - context: Current projects and tasks
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import {
  loadUserMemory,
  addAboutItem,
  addInstruction,
  addContextItem,
  deleteMemoryItem,
  setContextActive,
  isValidSection,
  getAllSections,
  type MemorySection,
  type Priority,
} from '../../services/userMemory';

type MemoryAction = 'save' | 'get' | 'delete';

interface UserMemoryArgs {
  action: MemoryAction;
  section: MemorySection;
  content?: string;
  // For instructions
  priority?: Priority;
  // For context
  name?: string;
  description?: string;
  active?: boolean;
  // For delete
  item_id?: string;
}

export class UserMemoryTool implements Tool {
  readonly name = 'user_memory';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Speichert oder liest Informationen ueber den Benutzer. Nutze dieses Tool, wenn du wichtige Informationen ueber den Benutzer erfaehrst.

Sektionen:
- about: Fakten ueber den Benutzer (Beruf, Firma, Hintergrund, Faehigkeiten)
- instructions: Wie du antworten sollst (Sprache, Stil, Format, Regeln)
- context: Aktuelle Projekte und Aufgaben des Benutzers

Beispiele:
- "Ich bin AI Consultant bei TechCorp" -> section: about, content: "AI Consultant bei TechCorp"
- "Antworte immer auf Deutsch" -> section: instructions, content: "Auf Deutsch antworten", priority: high
- "Ich arbeite gerade an einer Agent Platform" -> section: context, name: "Agent Platform", description: "Multi-Agent System"`,
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Die Aktion: "save" zum Speichern, "get" zum Abrufen, "delete" zum Loeschen',
              enum: ['save', 'get', 'delete'],
            },
            section: {
              type: 'string',
              description: 'Die Sektion der Information',
              enum: ['about', 'instructions', 'context'],
            },
            content: {
              type: 'string',
              description: 'Der zu speichernde Inhalt (fuer about und instructions)',
            },
            priority: {
              type: 'string',
              description: 'Prioritaet fuer instructions: high oder normal (Standard: normal)',
              enum: ['high', 'normal'],
            },
            name: {
              type: 'string',
              description: 'Name des Projekts/Kontexts (nur fuer section: context)',
            },
            description: {
              type: 'string',
              description: 'Beschreibung des Projekts/Kontexts (optional, nur fuer section: context)',
            },
            active: {
              type: 'boolean',
              description: 'Ob der Kontext aktiv ist (Standard: true)',
            },
            item_id: {
              type: 'string',
              description: 'ID des zu loeschenden Items (nur fuer action: delete)',
            },
          },
          required: ['action', 'section'],
        },
      },
    };
  }

  async execute(args: UserMemoryArgs, context?: ToolContext): Promise<string> {
    const { action, section, content, priority = 'normal', name, description, active = true, item_id } = args;

    // Memory ist pro User. Ohne userId verweigern wir die Operation, statt
    // die alte Default-Logik zu nutzen — sonst wuerden alle User auf dem
    // gemeinsamen `default`-Row landen und Erinnerungen leaken.
    const userId = context?.userId;
    if (!userId) {
      return JSON.stringify({
        success: false,
        error: 'User-Kontext fehlt — Memory-Operation nicht moeglich.',
      });
    }

    // Validate action
    if (!['save', 'get', 'delete'].includes(action)) {
      return JSON.stringify({
        success: false,
        error: 'Ungueltige Aktion. Verwende "save", "get" oder "delete".',
      });
    }

    // Validate section
    if (!isValidSection(section)) {
      return JSON.stringify({
        success: false,
        error: `Ungueltige Sektion. Gueltige Sektionen: ${getAllSections().join(', ')}`,
      });
    }

    try {
      // GET action
      if (action === 'get') {
        const memory = await loadUserMemory(userId);

        return JSON.stringify({
          success: true,
          [section]: memory[section],
        });
      }

      // DELETE action
      if (action === 'delete') {
        if (!item_id) {
          return JSON.stringify({
            success: false,
            error: 'item_id ist erforderlich fuer delete.',
          });
        }

        const deleted = await deleteMemoryItem(section, item_id, userId);
        return JSON.stringify({
          success: deleted,
          message: deleted ? 'Item geloescht.' : 'Item nicht gefunden.',
        });
      }

      // SAVE action
      if (section === 'about') {
        if (!content) {
          return JSON.stringify({
            success: false,
            error: 'content ist erforderlich fuer about.',
          });
        }

        const item = await addAboutItem(content, 'agent', userId);
        return JSON.stringify({
          success: true,
          message: `Gespeichert: "${content}"`,
          item,
        });
      }

      if (section === 'instructions') {
        if (!content) {
          return JSON.stringify({
            success: false,
            error: 'content ist erforderlich fuer instructions.',
          });
        }

        const item = await addInstruction(content, priority, 'agent', userId);
        return JSON.stringify({
          success: true,
          message: `Anweisung gespeichert: "${content}" (${priority})`,
          item,
        });
      }

      if (section === 'context') {
        if (!name) {
          return JSON.stringify({
            success: false,
            error: 'name ist erforderlich fuer context.',
          });
        }

        const item = await addContextItem(name, description, active, 'agent', userId);
        return JSON.stringify({
          success: true,
          message: `Kontext gespeichert: "${name}"`,
          item,
        });
      }

      return JSON.stringify({
        success: false,
        error: 'Unbekannte Sektion.',
      });
    } catch (error: any) {
      console.error('User memory tool error:', error);
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
      description: 'Speichert und liest Benutzerinformationen',
      type: this.type,
      category: 'memory',
    };
  }
}
