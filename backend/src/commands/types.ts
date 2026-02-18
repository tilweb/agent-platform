/**
 * Slash Command System Types
 * Discovery-first command system for the chat interface
 */

/**
 * Command Definition
 * Represents a top-level slash command
 */
export interface Command {
  id: string;              // "agent", "model", "skill"
  name: string;            // Display name
  description: string;     // Short description
  icon?: string;           // Emoji or icon name
  hasOptions: boolean;     // Has sub-options?
  requiresArg: boolean;    // Requires argument?
  argPlaceholder?: string; // e.g. "Prompt eingeben..."
}

/**
 * Dynamic Option (Agent, Model, Skill)
 * Represents a selectable option within a command
 */
export interface CommandOption {
  id: string;              // "researcher", "gpt-4o"
  name: string;            // Display name
  description?: string;    // Optional description
  isActive?: boolean;      // Currently selected?
  icon?: string;           // Emoji or icon name
  meta?: Record<string, any>; // Additional metadata
}

/**
 * Execute Command Request
 * Sent when user executes a command
 */
export interface ExecuteCommandRequest {
  command: string;         // "agent"
  optionId?: string;       // "researcher"
  args?: string;           // Additional arguments
}

/**
 * Command Execution Result
 */
export interface CommandResult {
  success: boolean;
  message: string;         // Confirmation text
  action?: CommandAction;
}

/**
 * Action types for frontend handling
 */
export interface CommandAction {
  type:
    | 'agent_changed'
    | 'model_changed'
    | 'skill_started'
    | 'chat_cleared'
    | 'new_chat'
    | 'help_shown'
    | 'task_started'
    | 'table_opened'
    | 'table_list_shown'
    | 'table_query_result'
    | 'table_row_added'
    | 'image_model_changed'
    | 'generate_image'
    | 'image_info';
  payload?: any;
}

/**
 * Options Provider Function
 * Returns dynamic options for a command
 */
export type OptionsProvider = () => Promise<CommandOption[]>;

/**
 * Command Handler Function
 * Executes a command and returns result
 */
export type CommandHandler = (optionId?: string, args?: string) => Promise<CommandResult>;

/**
 * Full Command Registration
 * Used internally by the registry
 */
export interface CommandRegistration {
  command: Command;
  getOptions?: OptionsProvider;
  execute: CommandHandler;
}
