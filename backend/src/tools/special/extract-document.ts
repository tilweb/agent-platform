/**
 * Extract Document Tool
 *
 * Allows agents to extract structured data from documents
 * using the extraction pipeline with configurable profiles.
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import { extract, getAllProjects } from '../../extraction/learning';
import type { ExtractionSource } from '../../extraction/types';

export class ExtractDocumentTool extends LocalTool {
  constructor() {
    super({
      name: 'extract_document',
      description: 'Extrahiert strukturierte Daten aus einem Dokument (Lieferschein, Rechnung, Vertrag etc.) anhand eines Extraktionsprofils. Gibt validiertes JSON zurueck. Quellen: Chat-Attachment (attachment_id), Dateipfad oder Rohtext.',
      parameters: {
        type: 'object',
        properties: {
          source_type: {
            type: 'string',
            enum: ['attachment', 'text', 'file'],
            description: 'Art der Quelle: "attachment" (Chat-Upload), "text" (Rohtext), "file" (Dateipfad)',
          },
          attachment_id: {
            type: 'string',
            description: 'ID des Chat-Attachments (wenn source_type="attachment")',
          },
          text: {
            type: 'string',
            description: 'Rohtext des Dokuments (wenn source_type="text")',
          },
          file_path: {
            type: 'string',
            description: 'Pfad zur Datei (wenn source_type="file")',
          },
          project_id: {
            type: 'string',
            description: 'ID des Extraktionsprojekts. Pflichtangabe.',
          },
        },
        required: ['source_type'],
      },
      category: 'extraction',
    });
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    const { source_type, attachment_id, text, file_path, project_id } = args;

    if (!source_type) {
      return JSON.stringify({ success: false, error: 'source_type ist erforderlich' });
    }

    if (!project_id) {
      const projects = await getAllProjects();
      const projectList = projects.map(p => `- ${p.id}: ${p.name}`).join('\n');
      return JSON.stringify({
        success: false,
        error: 'project_id ist erforderlich',
        available_projects: projectList,
      });
    }

    // Build source
    let source: ExtractionSource;
    switch (source_type) {
      case 'attachment':
        if (!attachment_id) {
          return JSON.stringify({ success: false, error: 'attachment_id ist erforderlich fuer source_type="attachment"' });
        }
        source = {
          type: 'attachment',
          attachment_id,
          session_id: context?.parentSessionId || context?.sessionId,
        };
        break;

      case 'text':
        if (!text) {
          return JSON.stringify({ success: false, error: 'text ist erforderlich fuer source_type="text"' });
        }
        source = { type: 'text', content: text };
        break;

      case 'file':
        if (!file_path) {
          return JSON.stringify({ success: false, error: 'file_path ist erforderlich fuer source_type="file"' });
        }
        source = { type: 'file', path: file_path, filename: file_path.split('/').pop() || 'document' };
        break;

      default:
        return JSON.stringify({
          success: false,
          error: `Ungueltiger source_type: "${source_type}". Erlaubt: attachment, text, file`,
        });
    }

    try {
      const result = await extract(project_id, source, context?.userId);
      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Extraktion fehlgeschlagen',
      });
    }
  }
}
