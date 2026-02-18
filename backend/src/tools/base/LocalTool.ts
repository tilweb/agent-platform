/**
 * Base class for local tools (file system, etc.)
 */

import { existsSync, mkdirSync } from 'fs';
import { join, normalize, sep, resolve } from 'path';
import type { Tool, ToolDefinition, ToolParameters, ToolContext, ToolMetadata } from '../types';

export interface LocalToolOptions {
  name: string;
  description: string;
  parameters: ToolParameters;
  category?: string;
  dataDir?: string;
}

export abstract class LocalTool implements Tool {
  readonly name: string;
  readonly type = 'local' as const;

  protected description: string;
  protected parameters: ToolParameters;
  protected category: string;
  protected dataDir: string;

  constructor(options: LocalToolOptions) {
    this.name = options.name;
    this.description = options.description;
    this.parameters = options.parameters;
    this.category = options.category || 'general';
    this.dataDir = options.dataDir || resolve(process.cwd(), '../data');
  }

  /**
   * Get the user-specific data directory
   */
  protected getUserDataDir(userId: string): string {
    if (!userId) {
      throw new Error('userId required for file operations');
    }
    return join(this.dataDir, 'users', userId);
  }

  /**
   * Validate and resolve path within user's sandbox directory
   * Prevents path traversal attacks and ensures user isolation
   */
  protected validateUserPath(filePath: string, userId: string): string {
    const userDir = this.getUserDataDir(userId);

    // Create user directory if it doesn't exist
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true });
    }

    // Handle absolute paths by treating them as relative to user dir
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    const normalized = normalize(join(userDir, cleanPath));

    // Strict check: Must be within userDir
    if (!normalized.startsWith(userDir + sep) && normalized !== userDir) {
      throw new Error('Zugriff verweigert: Pfad außerhalb Ihres Verzeichnisses');
    }

    return normalized;
  }

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  abstract execute(args: Record<string, any>, context?: ToolContext): Promise<string>;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      description: this.description,
      type: this.type,
      category: this.category,
    };
  }
}
