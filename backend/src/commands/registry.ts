/**
 * Command Registry
 * Central registry for all slash commands
 */

import type {
  Command,
  CommandOption,
  CommandRegistration,
  CommandResult,
} from './types';

class CommandRegistry {
  private commands: Map<string, CommandRegistration> = new Map();

  /**
   * Register a new command
   */
  register(registration: CommandRegistration): void {
    this.commands.set(registration.command.id, registration);
  }

  /**
   * Get all available commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values()).map((reg) => reg.command);
  }

  /**
   * Get a specific command
   */
  getCommand(id: string): Command | undefined {
    return this.commands.get(id)?.command;
  }

  /**
   * Get options for a command. userId fuer Permission-Filterung (Agents).
   */
  async getOptions(commandId: string, userId?: string): Promise<CommandOption[]> {
    const registration = this.commands.get(commandId);
    if (!registration || !registration.getOptions) {
      return [];
    }
    return registration.getOptions(userId);
  }

  /**
   * Execute a command. userId fuer Permission-Checks (Agent-Auswahl).
   */
  async execute(
    commandId: string,
    optionId?: string,
    args?: string,
    userId?: string,
  ): Promise<CommandResult> {
    const registration = this.commands.get(commandId);
    if (!registration) {
      return {
        success: false,
        message: `Unbekannter Befehl: /${commandId}`,
      };
    }
    return registration.execute(optionId, args, userId);
  }

  /**
   * Check if a command exists
   */
  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Clear all commands (for testing)
   */
  clear(): void {
    this.commands.clear();
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();
