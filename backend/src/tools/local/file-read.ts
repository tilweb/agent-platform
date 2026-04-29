/**
 * File Read Tool — S3-backed (Flow.swiss).
 *
 * Files leben unter `users/<userId>/<path>` im Bucket. Sandbox-Check stellt
 * sicher, dass der relative Pfad keinen `../`-Traversal-Versuch enthaelt.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { getObject, objectExists } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { sanitizeRelPath } from './sandbox';

export class FileReadTool extends LocalTool {
  constructor() {
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
    });
  }

  async execute(args: { path: string }, context?: ToolContext): Promise<string> {
    if (!context?.userId) return 'Fehler: Keine Benutzer-ID verfügbar';
    if (!args.path) return 'Fehler: Pfad ist erforderlich';
    try {
      const rel = sanitizeRelPath(args.path);
      const key = s3Paths.userFile(context.userId, rel);
      if (!(await objectExists(key))) return `Fehler: Datei nicht gefunden: ${args.path}`;
      const buf = await getObject(key);
      return buf.toString('utf-8');
    } catch (error: any) {
      return `Fehler beim Lesen der Datei: ${error.message}`;
    }
  }
}

export const fileReadTool = new FileReadTool();
