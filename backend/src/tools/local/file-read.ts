/**
 * File Read Tool - Read files from the user's data directory
 *
 * Security: Files are sandboxed to /data/users/{userId}/
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';

export class FileReadTool extends LocalTool {
  constructor(dataDir?: string) {
    super({
      name: 'file_read',
      description: 'Read the contents of a file from your personal data directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to your data directory (e.g., "dokumente/notizen.md")',
          },
        },
        required: ['path'],
      },
      category: 'filesystem',
      dataDir,
    });
  }

  async execute(args: { path: string }, context?: ToolContext): Promise<string> {
    const { path } = args;

    // userId is required for file operations
    if (!context?.userId) {
      return 'Fehler: Keine Benutzer-ID verfügbar';
    }

    if (!path) {
      return 'Fehler: Pfad ist erforderlich';
    }

    try {
      const fullPath = this.validateUserPath(path, context.userId);

      if (!existsSync(fullPath)) {
        return `Fehler: Datei nicht gefunden: ${path}`;
      }

      const content = await readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `Fehler beim Lesen der Datei: ${error.message}`;
    }
  }
}

// Export singleton instance
export const fileReadTool = new FileReadTool();
