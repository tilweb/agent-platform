/**
 * Command Handlers
 * Implementation of all slash command handlers
 */

import { commandRegistry } from './registry';
import type { CommandOption, CommandResult } from './types';
import { listAgents } from '../services/agents';
import { loadSkills } from '../skills';
import { getProviders, getActiveSelection, setActiveModel, getImageGenModels } from '../services/providers';
import { llmService } from '../services/llm';
import { listTablesWithStats, queryRows, addRow, getTable } from '../tables';
import { imageGenerationService } from '../services/imageGeneration';

/**
 * Register all commands
 * Order: Chat-specific commands first, then administrative commands
 */
export function registerCommands(): void {
  // ============== Chat-spezifische Commands ==============

  // /agent - Switch agent
  commandRegistry.register({
    command: {
      id: 'agent',
      name: 'Agent',
      description: 'Agent wechseln',
      icon: 'robot',
      hasOptions: true,
      requiresArg: false,
    },
    getOptions: getAgentOptions,
    execute: executeAgentCommand,
  });

  // /skill - Start skill
  commandRegistry.register({
    command: {
      id: 'skill',
      name: 'Skill',
      description: 'Skill starten',
      icon: 'lightning',
      hasOptions: true,
      requiresArg: false,
    },
    getOptions: getSkillOptions,
    execute: executeSkillCommand,
  });

  // /task - Background task
  commandRegistry.register({
    command: {
      id: 'task',
      name: 'Task',
      description: 'Hintergrund-Task starten',
      icon: 'clipboard',
      hasOptions: false,
      requiresArg: true,
      argPlaceholder: 'Aufgabe beschreiben...',
    },
    execute: executeTaskCommand,
  });

  // /table - Table operations
  commandRegistry.register({
    command: {
      id: 'table',
      name: 'Tabelle',
      description: 'Tabellen anzeigen/durchsuchen',
      icon: 'table',
      hasOptions: true,
      requiresArg: false,
      argPlaceholder: 'Suche oder Aktion...',
    },
    getOptions: getTableOptions,
    execute: executeTableCommand,
  });

  // /image - Image generation
  commandRegistry.register({
    command: {
      id: 'image',
      name: 'Bild',
      description: 'Bild generieren oder Modell wechseln',
      icon: 'image',
      hasOptions: true,
      requiresArg: true,
      argPlaceholder: 'Bildbeschreibung...',
    },
    getOptions: getImageOptions,
    execute: executeImageCommand,
  });

  // ============== Administrative Commands ==============

  // /model - Switch model
  commandRegistry.register({
    command: {
      id: 'model',
      name: 'Modell',
      description: 'KI-Modell wechseln',
      icon: 'brain',
      hasOptions: true,
      requiresArg: false,
    },
    getOptions: getModelOptions,
    execute: executeModelCommand,
  });

  // /new - New conversation
  commandRegistry.register({
    command: {
      id: 'new',
      name: 'Neu',
      description: 'Neue Konversation',
      icon: 'sparkles',
      hasOptions: false,
      requiresArg: false,
    },
    execute: executeNewCommand,
  });

  // /clear - Clear chat
  commandRegistry.register({
    command: {
      id: 'clear',
      name: 'Leeren',
      description: 'Chat leeren',
      icon: 'trash',
      hasOptions: false,
      requiresArg: false,
    },
    execute: executeClearCommand,
  });

  // /help - Show help
  commandRegistry.register({
    command: {
      id: 'help',
      name: 'Hilfe',
      description: 'Hilfe anzeigen',
      icon: 'help',
      hasOptions: false,
      requiresArg: false,
    },
    execute: executeHelpCommand,
  });
}

// ============== Option Providers ==============

async function getAgentOptions(): Promise<CommandOption[]> {
  const agents = await listAgents();

  // Auto-routing option first
  const options: CommandOption[] = [
    {
      id: 'auto',
      name: 'Auto-Routing',
      description: 'Automatische Agent-Auswahl',
      icon: 'refresh',
      isActive: true, // Will be updated by frontend based on current selection
    },
  ];

  // Add all agents
  for (const agent of agents) {
    options.push({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      icon: getAgentIcon(agent.id),
      isActive: false,
    });
  }

  return options;
}

async function getModelOptions(): Promise<CommandOption[]> {
  try {
    const providers = await getProviders();
    const active = await getActiveSelection();
    const options: CommandOption[] = [];

    for (const provider of providers) {
      if (!provider.enabled) continue;

      for (const model of provider.models) {
        // Only show chat-capable models (exclude STT, TTS, image_gen)
        if (!model.capabilities?.includes('chat')) continue;

        const isActive =
          active.chat?.provider_id === provider.id &&
          active.chat?.model_id === model.id;

        options.push({
          id: `${provider.id}:${model.id}`,
          name: model.name,
          description: `${provider.name}`,
          icon: getModelIcon(provider.api_mode),
          isActive,
          meta: {
            providerId: provider.id,
            modelId: model.id,
            capabilities: model.capabilities,
          },
        });
      }
    }

    return options;
  } catch (error) {
    console.error('Error loading model options:', error);
    return [];
  }
}

async function getImageOptions(): Promise<CommandOption[]> {
  try {
    const imageModels = await getImageGenModels();
    const active = await getActiveSelection();
    const options: CommandOption[] = [];

    for (const { provider, model } of imageModels) {
      const isActive =
        active.text_to_image?.provider_id === provider.id &&
        active.text_to_image?.model_id === model.id;

      options.push({
        id: `${provider.id}:${model.id}`,
        name: model.name,
        description: provider.name,
        icon: 'sparkles',
        isActive,
        meta: {
          providerId: provider.id,
          modelId: model.id,
          capabilities: model.capabilities,
          supportsImageToImage: model.capabilities.includes('image_to_image'),
        },
      });
    }

    return options;
  } catch (error) {
    console.error('Error loading image model options:', error);
    return [];
  }
}

async function getSkillOptions(): Promise<CommandOption[]> {
  const skills = await loadSkills();
  const options: CommandOption[] = [];

  for (const skill of skills) {
    if (skill.enabled === false) continue;

    options.push({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: 'lightning',
    });
  }

  return options;
}

// ============== Command Executors ==============

async function executeAgentCommand(
  optionId?: string,
  _args?: string
): Promise<CommandResult> {
  if (!optionId) {
    return {
      success: false,
      message: 'Bitte einen Agent auswählen',
    };
  }

  if (optionId === 'auto') {
    return {
      success: true,
      message: 'Auto-Routing aktiviert',
      action: {
        type: 'agent_changed',
        payload: { agentId: null, autoRoute: true },
      },
    };
  }

  // Verify agent exists
  const agents = await listAgents();
  const agent = agents.find((a) => a.id === optionId);

  if (!agent) {
    return {
      success: false,
      message: `Agent "${optionId}" nicht gefunden`,
    };
  }

  return {
    success: true,
    message: '', // Context pill shows the selection
    action: {
      type: 'agent_changed',
      payload: { agentId: agent.id, agentName: agent.name, autoRoute: false },
    },
  };
}

async function executeModelCommand(
  optionId?: string,
  _args?: string
): Promise<CommandResult> {
  if (!optionId) {
    return {
      success: false,
      message: 'Bitte ein Modell auswählen',
    };
  }

  // Parse provider:model format
  const [providerId, modelId] = optionId.split(':');

  if (!providerId || !modelId) {
    return {
      success: false,
      message: 'Ungültiges Modell-Format',
    };
  }

  try {
    await setActiveModel('chat', providerId, modelId);
    await llmService.reload();

    const providers = await getProviders();
    const provider = providers.find((p) => p.id === providerId);
    const model = provider?.models.find((m) => m.id === modelId);

    return {
      success: true,
      message: '', // Context pill shows the selection
      action: {
        type: 'model_changed',
        payload: { providerId, modelId, modelName: model?.name },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Fehler beim Modellwechsel: ${(error as Error).message}`,
    };
  }
}

async function executeSkillCommand(
  optionId?: string,
  args?: string
): Promise<CommandResult> {
  if (!optionId) {
    return {
      success: false,
      message: 'Bitte einen Skill auswählen',
    };
  }

  const skills = await loadSkills();
  const skill = skills.find((s) => s.id === optionId);

  if (!skill) {
    return {
      success: false,
      message: `Skill "${optionId}" nicht gefunden`,
    };
  }

  return {
    success: true,
    message: `Skill "${skill.name}" wird gestartet`,
    action: {
      type: 'skill_started',
      payload: { skillId: skill.id, skillName: skill.name, args },
    },
  };
}

async function executeTaskCommand(
  _optionId?: string,
  args?: string
): Promise<CommandResult> {
  if (!args || !args.trim()) {
    return {
      success: false,
      message: 'Bitte eine Aufgabe beschreiben',
    };
  }

  return {
    success: true,
    message: 'Task wird im Hintergrund gestartet',
    action: {
      type: 'task_started',
      payload: { prompt: args.trim() },
    },
  };
}

async function executeImageCommand(
  optionId?: string,
  args?: string
): Promise<CommandResult> {
  // If optionId contains ":", it's a model selection (provider:model format)
  if (optionId && optionId.includes(':')) {
    const [providerId, modelId] = optionId.split(':');

    if (providerId && modelId) {
      try {
        await setActiveModel('text_to_image', providerId, modelId);
        await imageGenerationService.reload();

        const imageModels = await getImageGenModels();
        const selected = imageModels.find(
          (m) => m.provider.id === providerId && m.model.id === modelId
        );

        return {
          success: true,
          message: '', // Context pill shows the selection
          action: {
            type: 'image_model_changed',
            payload: {
              providerId,
              modelId,
              modelName: selected?.model.name,
              providerName: selected?.provider.name,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          message: `Fehler beim Modellwechsel: ${(error as Error).message}`,
        };
      }
    }
  }

  // If args is provided, trigger image generation
  if (args && args.trim()) {
    return {
      success: true,
      message: 'Bild wird generiert...',
      action: {
        type: 'generate_image',
        payload: { prompt: args.trim() },
      },
    };
  }

  // No args - show current model info
  await imageGenerationService.reload();
  const currentModel = imageGenerationService.getCurrentModel();

  if (!currentModel) {
    return {
      success: false,
      message: 'Kein Bildgenerierungs-Modell konfiguriert. Bitte unter Einstellungen ein Modell aktivieren.',
    };
  }

  return {
    success: true,
    message: `Aktuelles Modell: ${currentModel.model} (${currentModel.provider})\n\nVerwendung: /image [Beschreibung] oder /image [Modell auswählen]`,
    action: {
      type: 'image_info',
      payload: currentModel,
    },
  };
}

async function executeNewCommand(): Promise<CommandResult> {
  return {
    success: true,
    message: 'Neue Konversation gestartet',
    action: {
      type: 'new_chat',
    },
  };
}

async function executeClearCommand(): Promise<CommandResult> {
  return {
    success: true,
    message: 'Chat geleert',
    action: {
      type: 'chat_cleared',
    },
  };
}

async function executeHelpCommand(): Promise<CommandResult> {
  const commands = commandRegistry.getCommands();
  const helpText = commands
    .map((cmd) => `/${cmd.id} - ${cmd.description}`)
    .join('\n');

  return {
    success: true,
    message: `Verfügbare Befehle:\n${helpText}`,
    action: {
      type: 'help_shown',
      payload: { commands },
    },
  };
}

async function getTableOptions(): Promise<CommandOption[]> {
  try {
    const tables = await listTablesWithStats();
    const options: CommandOption[] = [];

    // Add "show all" option first
    options.push({
      id: '_list',
      name: 'Alle Tabellen',
      description: 'Übersicht aller Tabellen anzeigen',
      icon: 'list',
    });

    // Add each table as an option
    for (const table of tables) {
      options.push({
        id: table.id,
        name: table.name,
        description: `${table.row_count || 0} Zeilen • ${table.columns?.length || 0} Spalten`,
        icon: table.icon || 'table',
        meta: {
          tableId: table.id,
          rowCount: table.row_count,
          columnCount: table.columns?.length,
        },
      });
    }

    return options;
  } catch (error) {
    console.error('Error loading table options:', error);
    return [];
  }
}

async function executeTableCommand(
  optionId?: string,
  args?: string
): Promise<CommandResult> {
  // No option selected - show table list
  if (!optionId || optionId === '_list') {
    try {
      const tables = await listTablesWithStats();

      if (tables.length === 0) {
        return {
          success: true,
          message: 'Keine Tabellen vorhanden. Erstelle eine neue Tabelle unter /tables.',
          action: {
            type: 'table_list_shown',
            payload: { tables: [] },
          },
        };
      }

      const tableList = tables
        .map((t) => `• **${t.name}** (${t.row_count || 0} Zeilen)`)
        .join('\n');

      return {
        success: true,
        message: `**Verfügbare Tabellen:**\n${tableList}\n\nVerwende \`/table [name]\` um eine Tabelle zu öffnen.`,
        action: {
          type: 'table_list_shown',
          payload: { tables },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Fehler beim Laden der Tabellen: ${(error as Error).message}`,
      };
    }
  }

  // Check if args contains a subcommand
  const subcommand = args?.trim().split(' ')[0]?.toLowerCase();
  const subArgs = args?.trim().split(' ').slice(1).join(' ');

  // Handle subcommands
  if (subcommand === 'query' || subcommand === 'suche') {
    return executeTableQuery(optionId, subArgs);
  }

  if (subcommand === 'add' || subcommand === 'neu') {
    return executeTableAdd(optionId, subArgs);
  }

  // Default: open table (query without filter)
  try {
    const table = await getTable(optionId);

    if (!table) {
      return {
        success: false,
        message: `Tabelle "${optionId}" nicht gefunden`,
      };
    }

    // If there are additional args, treat them as a search query
    if (args?.trim()) {
      return executeTableQuery(optionId, args);
    }

    // Just open the table
    const result = await queryRows(optionId, { limit: 10 });

    const primaryCol = table.settings?.primary_column || table.columns[0]?.id || '_id';
    const preview = result.rows.slice(0, 5).map((row) => {
      return `• ${row[primaryCol] || row._id}`;
    }).join('\n');

    return {
      success: true,
      message: '', // Context pill shows the selection
      action: {
        type: 'table_opened',
        payload: {
          tableId: optionId,
          tableName: table.name,
          table,
          rows: result.rows,
          total: result.total,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Fehler: ${(error as Error).message}`,
    };
  }
}

async function executeTableQuery(
  tableId: string,
  searchText?: string
): Promise<CommandResult> {
  try {
    const table = await getTable(tableId);
    if (!table) {
      return {
        success: false,
        message: `Tabelle "${tableId}" nicht gefunden`,
      };
    }

    const result = await queryRows(tableId, {
      filter_text: searchText,
      limit: 10,
    });

    if (result.rows.length === 0) {
      return {
        success: true,
        message: `Keine Ergebnisse in "${table.name}" für "${searchText}"`,
        action: {
          type: 'table_query_result',
          payload: { tableId, query: searchText, rows: [], total: 0 },
        },
      };
    }

    const primaryCol = table.settings?.primary_column || table.columns[0]?.id || '_id';
    const preview = result.rows.map((row) => {
      const primary = row[primaryCol] || row._id;
      // Show a few key fields
      const extras = table.columns
        .slice(0, 3)
        .filter((c) => c.id !== primaryCol)
        .map((c) => row[c.id])
        .filter(Boolean)
        .join(' | ');
      return `• **${primary}**${extras ? ` - ${extras}` : ''}`;
    }).join('\n');

    return {
      success: true,
      message: `**Suchergebnisse in ${table.name}** (${result.total} Treffer):\n${preview}${result.total > 10 ? '\n\n_Weitere Ergebnisse verfügbar..._' : ''}`,
      action: {
        type: 'table_query_result',
        payload: {
          tableId,
          tableName: table.name,
          query: searchText,
          rows: result.rows,
          total: result.total,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Fehler bei der Suche: ${(error as Error).message}`,
    };
  }
}

async function executeTableAdd(
  tableId: string,
  dataText?: string
): Promise<CommandResult> {
  if (!dataText?.trim()) {
    return {
      success: false,
      message: 'Bitte Daten angeben, z.B. `/table kontakte add Name: Max, Email: max@example.com`',
    };
  }

  try {
    const table = await getTable(tableId);
    if (!table) {
      return {
        success: false,
        message: `Tabelle "${tableId}" nicht gefunden`,
      };
    }

    // Parse simple key:value format
    // Supports: "Name: Max, Email: test@example.com" or "Max Müller" (goes to primary column)
    const data: Record<string, any> = {};

    if (dataText.includes(':')) {
      // Parse key:value pairs
      const pairs = dataText.split(',').map((s) => s.trim());
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split(':');
        if (!key) continue;
        const value = valueParts.join(':').trim();

        // Find matching column (case-insensitive)
        const column = table.columns.find(
          (c) => c.id.toLowerCase() === key.trim().toLowerCase() ||
                 c.name.toLowerCase() === key.trim().toLowerCase()
        );

        if (column) {
          data[column.id] = value;
        }
      }
    } else {
      // Single value goes to primary column
      const primaryCol = table.settings?.primary_column || table.columns[0]?.id || '_id';
      data[primaryCol] = dataText.trim();
    }

    if (Object.keys(data).length === 0) {
      return {
        success: false,
        message: 'Keine gültigen Daten erkannt. Format: `Name: Wert, Feld: Wert`',
      };
    }

    const newRow = await addRow(tableId, { data });
    const primaryColForDisplay = table.settings?.primary_column || table.columns[0]?.id || '_id';

    return {
      success: true,
      message: `Neuer Eintrag in "${table.name}" erstellt: **${newRow[primaryColForDisplay] || newRow._id}**`,
      action: {
        type: 'table_row_added',
        payload: {
          tableId,
          tableName: table.name,
          row: newRow,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Fehler beim Hinzufügen: ${(error as Error).message}`,
    };
  }
}

// ============== Helper Functions ==============

function getAgentIcon(agentId: string): string {
  const icons: Record<string, string> = {
    general: 'robot',
    researcher: 'search',
    writer: 'pen',
    coder: 'code',
    analyst: 'chart',
    supervisor: 'briefcase',
  };
  return icons[agentId] || 'robot';
}

function getModelIcon(_apiMode: string): string {
  // All models use brain icon for consistency
  return 'brain';
}
