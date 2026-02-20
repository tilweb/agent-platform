/**
 * Export Document Tool
 *
 * Allows agents to create documents (Excel, PDF, Word) from structured data.
 * Documents are saved to a temporary location and a download URL is returned.
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Tool, ToolDefinition, ToolContext } from '../types';
import {
  generateDocument,
  type DocumentData,
  type DocumentSection,
  type DocumentFormat,
} from '../../services/documentGenerator';
import { EXPORTS_DIR } from '../../utils/paths';

interface ExportDocumentArgs {
  title: string;
  format: DocumentFormat;
  sections: DocumentSection[];
  metadata?: Record<string, string>;
}

/**
 * Slugify a string for safe filenames
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] || c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-$/, '');
}

export class ExportDocumentTool implements Tool {
  readonly name = 'export_document';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `Erstellt ein Dokument (Excel, PDF, Word) aus strukturierten Daten.

Nutze dieses Tool um:
- Recherche-Ergebnisse als Bericht zu exportieren
- Tabellen und Daten in Excel zu speichern
- Zusammenfassungen als PDF zu erstellen
- Strukturierte Informationen als Word-Dokument zu formatieren

Das Tool gibt eine Download-URL zurueck, die dem Benutzer angezeigt werden kann.

Wichtig: Strukturiere den Inhalt in Sections mit verschiedenen Typen:
- text: Fliesstext oder formatierter Text
- table: Tabellen mit headers und rows
- list: Aufzaehlungen
- keyvalue: Schluessel-Wert-Paare (z.B. fuer Metadaten)`,
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Titel des Dokuments (wird als Ueberschrift und im Dateinamen verwendet)',
            },
            format: {
              type: 'string',
              enum: ['xlsx', 'pdf', 'docx'],
              description: 'Ausgabeformat: xlsx (Excel), pdf (PDF), docx (Word)',
            },
            sections: {
              type: 'array',
              description: 'Inhaltssektionen des Dokuments',
              items: {
                type: 'object',
                description: 'Eine Inhaltssektion des Dokuments',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Titel/Ueberschrift der Sektion',
                  },
                  type: {
                    type: 'string',
                    enum: ['text', 'table', 'list', 'keyvalue'],
                    description: 'Art des Inhalts',
                  },
                  content: {
                    type: 'string',
                    description: 'Inhalt der Sektion (abhaengig vom Typ)',
                  },
                },
                required: ['title', 'type', 'content'],
              },
            },
            metadata: {
              type: 'object',
              description: 'Optionale Metadaten (z.B. Autor, Datum) als Schluessel-Wert-Paare',
              additionalProperties: {
                type: 'string',
                description: 'Metadaten-Wert',
              },
            },
          },
          required: ['title', 'format', 'sections'],
        },
      },
    };
  }

  async execute(args: ExportDocumentArgs, context?: ToolContext): Promise<string> {
    const { title, format, sections, metadata = {} } = args;

    // Validate title
    if (!title || title.trim().length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Titel ist erforderlich.',
      });
    }

    // Validate format
    const validFormats: DocumentFormat[] = ['xlsx', 'pdf', 'docx'];
    if (!validFormats.includes(format)) {
      return JSON.stringify({
        success: false,
        error: `Ungueltiges Format. Unterstuetzt: ${validFormats.join(', ')}`,
      });
    }

    // Validate sections
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Mindestens eine Section ist erforderlich.',
      });
    }

    // Validate section structure
    for (const section of sections) {
      if (!section.title || !section.type || section.content === undefined) {
        return JSON.stringify({
          success: false,
          error: 'Jede Section benoetigt title, type und content.',
        });
      }

      const validTypes = ['text', 'table', 'list', 'keyvalue'];
      if (!validTypes.includes(section.type)) {
        return JSON.stringify({
          success: false,
          error: `Ungueltiger Section-Typ "${section.type}". Erlaubt: ${validTypes.join(', ')}`,
        });
      }
    }

    try {
      // Ensure exports directory exists
      if (!existsSync(EXPORTS_DIR)) {
        await mkdir(EXPORTS_DIR, { recursive: true });
      }

      // Build document data
      const documentData: DocumentData = {
        title: title.trim(),
        metadata: {
          Erstellt: new Date().toLocaleDateString('de-DE'),
          ...metadata,
        },
        sections: sections as DocumentSection[],
      };

      // Generate document
      const buffer = await generateDocument(documentData, format);

      // Create filename with timestamp
      const timestamp = Date.now();
      const slug = slugify(title) || 'dokument';
      const filename = `${slug}_${timestamp}.${format}`;
      const filepath = join(EXPORTS_DIR, filename);

      // Save to file
      await writeFile(filepath, buffer);

      // Build download URL
      const downloadUrl = `/api/exports/download/${filename}`;

      return JSON.stringify({
        type: 'exported_document',
        success: true,
        title: title.trim(),
        downloadUrl,
        filename,
        format,
      });
    } catch (error: any) {
      console.error('[ExportDocument] Error generating document:', error);
      return JSON.stringify({
        success: false,
        error: error.message || 'Fehler beim Erstellen des Dokuments',
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getMetadata() {
    return {
      name: this.name,
      description: 'Erstellt Dokumente (Excel, PDF, Word) aus strukturierten Daten',
      type: this.type,
      category: 'documents',
    };
  }
}
