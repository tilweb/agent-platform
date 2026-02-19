/**
 * File Write Tool - Write files to the user's data directory
 *
 * Security: Files are sandboxed to /data/users/{userId}/
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';

export class FileWriteTool extends LocalTool {
  constructor(dataDir?: string) {
    super({
      name: 'file_write',
      description: 'Write content to a file in your personal data directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to your data directory (e.g., "notizen/todo.txt")',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
      category: 'filesystem',
      dataDir,
    });
  }

  async execute(args: { path: string; content: string }, context?: ToolContext): Promise<string> {
    const { path, content } = args;

    // userId is required for file operations
    if (!context?.userId) {
      return 'Fehler: Keine Benutzer-ID verfügbar';
    }

    if (!path) {
      return 'Fehler: Pfad ist erforderlich';
    }

    if (content === undefined || content === null) {
      return 'Fehler: Inhalt ist erforderlich';
    }

    try {
      const fullPath = this.validateUserPath(path, context.userId);
      const dir = dirname(fullPath);

      // Create directory if it doesn't exist
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(fullPath, content, 'utf-8');
      return `Datei gespeichert: ${path}`;
    } catch (error: any) {
      return `Fehler beim Schreiben der Datei: ${error.message}`;
    }
  }
}

// Export singleton instance
export const fileWriteTool = new FileWriteTool();
