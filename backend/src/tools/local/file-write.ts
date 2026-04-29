/**
 * File Write Tool — S3-backed (Flow.swiss).
 *
 * Files leben unter `users/<userId>/<path>` im Bucket. Append liest die
 * existierende Datei aus S3, ergaenzt um den neuen Inhalt und schreibt zurueck.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { getObject, putObject, objectExists } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { sanitizeRelPath } from './sandbox';

export class FileWriteTool extends LocalTool {
  constructor() {
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
          append: {
            type: 'boolean',
            description: 'If true, append content to the end of the file instead of overwriting. Default: false',
          },
        },
        required: ['path', 'content'],
      },
      category: 'filesystem',
    });
  }

  async execute(args: { path: string; content: string; append?: boolean }, context?: ToolContext): Promise<string> {
    if (!context?.userId) return 'Fehler: Keine Benutzer-ID verfügbar';
    if (!args.path) return 'Fehler: Pfad ist erforderlich';
    if (args.content === undefined || args.content === null) return 'Fehler: Inhalt ist erforderlich';
    try {
      const rel = sanitizeRelPath(args.path);
      const key = s3Paths.userFile(context.userId, rel);
      let body = args.content;
      if (args.append && (await objectExists(key))) {
        const existing = (await getObject(key)).toString('utf-8');
        body = existing + '\n' + args.content;
      }
      await putObject(key, body, 'text/plain; charset=utf-8');
      return args.append ? `Datei ergänzt: ${args.path}` : `Datei gespeichert: ${args.path}`;
    } catch (error: any) {
      return `Fehler beim Schreiben der Datei: ${error.message}`;
    }
  }
}

export const fileWriteTool = new FileWriteTool();
