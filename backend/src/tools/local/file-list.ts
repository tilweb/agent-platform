/**
 * File List Tool - List files in the user's data directory
 *
 * Security: Files are sandboxed to /data/users/{userId}/
 */

import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';

export class FileListTool extends LocalTool {
  constructor(dataDir?: string) {
    super({
      name: 'file_list',
      description: 'List files in your personal data directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to your data directory (e.g., "dokumente"). Use "." for root.',
          },
        },
        required: [],
      },
      category: 'filesystem',
      dataDir: dataDir || resolve(process.cwd(), '../data'),
    });
  }

  async execute(args: { path?: string }, context?: ToolContext): Promise<string> {
    const { path = '.' } = args;

    // userId is required for file operations
    if (!context?.userId) {
      return 'Fehler: Keine Benutzer-ID verfügbar';
    }

    try {
      const fullPath = this.validateUserPath(path, context.userId);

      if (!existsSync(fullPath)) {
        return `Fehler: Verzeichnis nicht gefunden: ${path}`;
      }

      const entries = await readdir(fullPath, { withFileTypes: true });
      const result = entries.map(e => {
        const type = e.isDirectory() ? '[DIR]' : '[FILE]';
        return `${type} ${e.name}`;
      });

      return result.length > 0 ? result.join('\n') : 'Verzeichnis ist leer';
    } catch (error: any) {
      return `Fehler beim Auflisten des Verzeichnisses: ${error.message}`;
    }
  }
}

// Export singleton instance
export const fileListTool = new FileListTool();
