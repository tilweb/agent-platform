/**
 * Export Document Tool
 *
 * Allows agents to create documents (Excel, PDF, Word) from structured data.
 * Documents are saved to a temporary location and a download URL is returned.
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import {
  generateDocument,
  type DocumentData,
  type DocumentSection,
  type DocumentFormat,
} from '../../services/documentGenerator';
import { putObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { getDb } from '../../db';
import { exports as exportsTable } from '../../db/schema/generated';
import { renderMarkdownDocx, sectionsToMarkdown, resolveDesignTemplate } from '../../services/docTemplates';

interface ExportDocumentArgs {
  title: string;
  format: DocumentFormat;
  sections?: DocumentSection[];
  content_markdown?: string;
  design_template_id?: string;
  metadata?: Record<string, string>;
}

function mimeForFormat(format: DocumentFormat): string {
  switch (format) {
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'pdf':  return 'application/pdf';
    default:     return 'application/octet-stream';
  }
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

Word (docx): Schreibe den Inhalt als Markdown in content_markdown (## Ueberschriften,
Absaetze, - Aufzaehlungen, 1. Nummerierungen, | Tabellen |, **fett**, *kursiv*, [Links](https://...)).
Das Layout (Schriften, Farben, Logo, Kopf-/Fusszeile) kommt automatisch aus der
Designvorlage der Organisation — gestalte NICHT selbst. Beispiel:
{"title": "Projektstatus Q3", "format": "docx", "content_markdown": "## Zusammenfassung\nLaeuft nach Plan.\n\n## Risiken\n| Risiko | Massnahme |\n|---|---|\n| Verzug | Puffer |"}

Excel (xlsx) und PDF: Strukturiere den Inhalt in sections mit verschiedenen Typen:
- text: Fliesstext
- table: Tabellen, content = {"headers": [...], "rows": [[...], ...]}
- list: Aufzaehlungen, content = {"items": [...]}
- keyvalue: Schluessel-Wert-Paare, content = {"items": [{"key": "...", "value": "..."}]}`,
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
            content_markdown: {
              type: 'string',
              description: 'Nur Word (docx): gesamter Inhalt als Markdown. Bevorzugt fuer Word-Dokumente.',
            },
            design_template_id: {
              type: 'string',
              description: 'Optional, nur Word: ID einer bestimmten Designvorlage. Weglassen = Standard-Design der Organisation.',
            },
            sections: {
              type: 'array',
              description: 'Inhaltssektionen des Dokuments (fuer xlsx/pdf; bei docx alternativ zu content_markdown)',
              items: {
                type: 'object',
                description: 'Eine Sektion des Dokuments',
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
                    description: 'Inhalt der Sektion: Text bei text; bei table/list/keyvalue das JSON-Objekt aus der Tool-Beschreibung',
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
              },
            },
          },
          required: ['title', 'format'],
        },
      },
    };
  }

  async execute(args: ExportDocumentArgs, context?: ToolContext): Promise<string> {
    const { title, format, metadata = {} } = args;
    let sections: any = args.sections;
    const markdown = typeof args.content_markdown === 'string' ? args.content_markdown.trim() : '';

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

    // Defensive: manche LLMs serialisieren nested objects als JSON-String
    // statt als Array. Wir parsen das einmal nach bevor wir validieren.
    if (typeof sections === 'string') {
      try {
        sections = JSON.parse(sections);
      } catch {
        return JSON.stringify({
          success: false,
          error: 'sections konnte nicht als JSON geparsed werden — bitte als Array von Objekten uebergeben.',
        });
      }
    }

    const hasSections = Array.isArray(sections) && sections.length > 0;
    if (!hasSections && !(format === 'docx' && markdown)) {
      return JSON.stringify({
        success: false,
        error: format === 'docx'
          ? 'Inhalt fehlt: bitte content_markdown (Markdown-Text) oder sections uebergeben.'
          : 'Mindestens eine Section ist erforderlich (content_markdown gibt es nur fuer docx).',
      });
    }

    if (hasSections) {
      const validTypes = ['text', 'table', 'list', 'keyvalue'];
      for (const section of sections) {
        if (!section.title || !section.type || section.content === undefined) {
          return JSON.stringify({
            success: false,
            error: 'Jede Section benoetigt title, type und content.',
          });
        }
        if (!validTypes.includes(section.type)) {
          return JSON.stringify({
            success: false,
            error: `Ungueltiger Section-Typ "${section.type}". Erlaubt: ${validTypes.join(', ')}`,
          });
        }
        // Frueheres Schema beschrieb content fuer table/list/keyvalue als JSON-String —
        // ohne Parse kamen diese Sections still leer im Dokument an.
        if (section.type !== 'text' && typeof section.content === 'string') {
          try {
            section.content = JSON.parse(section.content);
          } catch {
            return JSON.stringify({
              success: false,
              error: `Section "${section.title}": content fuer Typ ${section.type} muss ein Objekt sein (siehe Tool-Beschreibung).`,
            });
          }
        }
      }
    }

    try {
      let buffer: Buffer;
      let designTemplate: string | null = null;

      // Word mit Markdown oder aktiver Designvorlage → Vorlagen-Renderer (CD der Organisation).
      // Ohne beides bleibt es beim bisherigen eingebauten Word-Generator.
      const design = format === 'docx' ? await resolveDesignTemplate(args.design_template_id) : null;
      if (format === 'docx' && (markdown || design)) {
        const body = markdown || sectionsToMarkdown(sections as DocumentSection[], metadata);
        const result = await renderMarkdownDocx({ title: title.trim(), markdown: body, designTemplateId: design?.id });
        buffer = Buffer.from(result.buffer);
        designTemplate = result.templateName;
      } else {
        const documentData: DocumentData = {
          title: title.trim(),
          metadata: {
            Erstellt: new Date().toLocaleDateString('de-DE'),
            ...metadata,
          },
          sections: sections as DocumentSection[],
        };
        buffer = await generateDocument(documentData, format);
      }

      const timestamp = Date.now();
      const slug = slugify(title) || 'dokument';
      const filename = `${slug}_${timestamp}.${format}`;
      const exportId = filename;
      const s3Key = s3Paths.exportFile(`${slug}_${timestamp}`, format);

      await putObject(s3Key, buffer, mimeForFormat(format));

      const userId = (context as { userId?: string } | undefined)?.userId ?? null;
      // 7-Tage-TTL — passt zum bisherigen "temp"-Charakter der Exports.
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const db = getDb();
      await db.insert(exportsTable).values({
        id: exportId,
        userId,
        kind: format,
        filename,
        s3Key,
        expiresAt,
        metadata: { title: title.trim() } as never,
      });

      const downloadUrl = `/api/exports/download/${filename}`;
      return JSON.stringify({
        type: 'exported_document',
        success: true,
        title: title.trim(),
        downloadUrl,
        filename,
        format,
        ...(designTemplate ? { designTemplate } : {}),
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
