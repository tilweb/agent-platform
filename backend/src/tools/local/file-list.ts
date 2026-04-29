/**
 * File List Tool — S3-backed (Flow.swiss).
 *
 * Listet S3-Keys unter `users/<userId>/<path>/`. S3 hat kein Konzept von
 * "Ordnern", deshalb leiten wir Verzeichnisse aus den Praefixen ab.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { listObjectsByPrefix } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { sanitizeRelPath } from './sandbox';

export class FileListTool extends LocalTool {
  constructor() {
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
    });
  }

  async execute(args: { path?: string }, context?: ToolContext): Promise<string> {
    if (!context?.userId) return 'Fehler: Keine Benutzer-ID verfügbar';
    try {
      const rawPath = args.path ?? '.';
      const rel = rawPath === '.' || rawPath === '' ? '' : sanitizeRelPath(rawPath);
      // Trailing-Slash erzwingen, sonst matcht das Prefix auch Geschwister.
      const prefixRel = rel ? (rel.endsWith('/') ? rel : rel + '/') : '';
      const prefix = s3Paths.userFile(context.userId, prefixRel);
      const objects = await listObjectsByPrefix(prefix);

      // Direct-Children ableiten: alles, was nach `prefix` kommt, bis zum naechsten `/`.
      const files = new Set<string>();
      const dirs = new Set<string>();
      for (const obj of objects) {
        const tail = obj.key.slice(prefix.length);
        const slash = tail.indexOf('/');
        if (slash === -1) {
          if (tail) files.add(tail);
        } else {
          dirs.add(tail.slice(0, slash));
        }
      }
      const out: string[] = [];
      for (const d of [...dirs].sort()) out.push(`[DIR] ${d}`);
      for (const f of [...files].sort()) out.push(`[FILE] ${f}`);
      return out.length > 0 ? out.join('\n') : 'Verzeichnis ist leer';
    } catch (error: any) {
      return `Fehler beim Auflisten des Verzeichnisses: ${error.message}`;
    }
  }
}

export const fileListTool = new FileListTool();
