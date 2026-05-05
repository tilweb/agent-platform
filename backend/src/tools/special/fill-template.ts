/**
 * fill_template_to_docx — vorlagen-getriebener Document-Builder.
 *
 * Holt ein Markdown-Template aus der Knowledge-Base (DB+S3), substituiert
 * `{{KEY}}`-Platzhalter durch die uebergebenen Variablen, rendert das
 * Resultat als .docx und legt es im Export-Bucket ab.
 *
 * Statt das LLM ein komplettes Tool-Schema mit nested sections befuellen
 * zu lassen (fragil, drift-anfaellig) muss es hier nur Variablen liefern
 * — der gesamte Rendering-Pfad ist deterministisch.
 *
 * Args:
 *   template_slug: Slug des Templates (z.B. "template-unbefristet-vollzeit").
 *                  Sucht in allen KB-Collections nach `doc-<slug>-<timestamp>`.
 *   variables:     Object mit Werten fuer die {{KEY}}-Platzhalter im Template.
 *                  Keys sollten matchen — case-insensitive.
 *   filename:      Optional, Default `template_<slug>_<timestamp>.docx`.
 */

import type { Tool, ToolContext, ToolDefinition } from '../types';
import { listCollections, listDocuments, getDocumentContent } from '../../services/kbStorage';
import { renderMarkdownToDocx } from '../../services/markdownDocx';
import { putObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { getDb } from '../../db';
import { exports as exportsTable } from '../../db/schema/generated';

interface FillTemplateArgs {
  template_slug: string;
  variables: Record<string, string | number | boolean>;
  filename?: string;
}

export class FillTemplateTool implements Tool {
  readonly name = 'fill_template_to_docx';
  readonly type = 'local' as const;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'fill_template_to_docx',
        description:
          'Erzeugt ein Word-Dokument aus einem Markdown-Template. Holt das Template aus der Knowledge-Base anhand des Slugs, ersetzt alle {{KEY}}-Platzhalter durch die uebergebenen Variablen und gibt eine fertige .docx mit Download-Link zurueck. Verwende dieses Tool fuer alle vorlagen-basierten Dokumente (Arbeitsvertrag, Nachweisschreiben, Offer-Letter etc.) statt eigene Klauseln zu formulieren.',
        parameters: {
          type: 'object',
          properties: {
            template_slug: {
              type: 'string',
              description:
                'Slug des Templates ohne `doc-` Praefix und ohne Timestamp. Beispiel: "template-unbefristet-vollzeit" findet die KB-Document-ID "doc-template-unbefristet-vollzeit-<timestamp>".',
            },
            variables: {
              type: 'object',
              description:
                'Objekt mit Schluessel-Wert-Paaren fuer die {{KEY}}-Platzhalter. Beispiel: { "VORNAME": "Markus", "NACHNAME": "Müller", "EINTRITTSDATUM": "01.07.2026" }. Schluessel ohne {{}}.',
              additionalProperties: { type: ['string', 'number', 'boolean'] },
            },
            filename: {
              type: 'string',
              description:
                'Optional. Output-Dateiname inkl. .docx-Endung. Default: aus Template-Slug + Timestamp generiert.',
            },
          },
          required: ['template_slug', 'variables'],
        },
      },
    };
  }

  async execute(args: FillTemplateArgs, context?: ToolContext): Promise<string> {
    const { template_slug, variables } = args;
    let { filename } = args;

    if (!template_slug || typeof template_slug !== 'string') {
      return JSON.stringify({ success: false, error: 'template_slug ist erforderlich.' });
    }
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      return JSON.stringify({ success: false, error: 'variables muss ein Objekt mit Key-Value-Paaren sein.' });
    }

    // 1. Template aus KB resolven
    let templateMd: string | null = null;
    try {
      const collections = await listCollections();
      for (const col of collections) {
        const docs = await listDocuments(col.id);
        const match = docs.find((d) => d.id.startsWith(`doc-${template_slug}-`));
        if (match) {
          templateMd = await getDocumentContent(col.id, match.id);
          if (templateMd) break;
        }
      }
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: `Template-Lookup fehlgeschlagen: ${err.message}`,
      });
    }

    if (!templateMd) {
      return JSON.stringify({
        success: false,
        error: `Template "${template_slug}" wurde in keiner Knowledge-Base-Collection gefunden. Pruefe ob es als Document mit ID "doc-${template_slug}-<timestamp>" existiert.`,
      });
    }

    // 2. Platzhalter ersetzen — case-insensitive Match auf {{KEY}}
    const filledMd = substitutePlaceholders(templateMd, variables);

    // 3. Markdown → docx
    let buffer: Buffer;
    try {
      buffer = await renderMarkdownToDocx(filledMd);
    } catch (err: any) {
      console.error('[fill_template_to_docx] render error:', err);
      return JSON.stringify({
        success: false,
        error: `Konvertierung Markdown→docx fehlgeschlagen: ${err.message}`,
      });
    }

    // 4. In S3 ablegen + DB-Eintrag (gleicher Pfad wie ExportDocumentTool)
    const timestamp = Date.now();
    const slug = (template_slug + '_' + timestamp).replace(/[^a-z0-9_-]/gi, '_');
    const safeFilename = (filename && /\.docx$/i.test(filename)) ? filename : `${slug}.docx`;
    const exportId = safeFilename;
    const s3Key = s3Paths.exportFile(slug, 'docx');

    try {
      await putObject(s3Key, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } catch (err: any) {
      console.error('[fill_template_to_docx] S3 putObject error:', err);
      return JSON.stringify({
        success: false,
        error: `Speichern fehlgeschlagen: ${err.message}`,
      });
    }

    const userId = (context as { userId?: string } | undefined)?.userId ?? null;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const db = getDb();
      await db.insert(exportsTable).values({
        id: exportId,
        userId,
        kind: 'docx',
        filename: safeFilename,
        s3Key,
        expiresAt,
        metadata: { template_slug, variables: variables as Record<string, unknown> } as never,
      });
    } catch (err: any) {
      console.warn('[fill_template_to_docx] DB insert failed (download still works):', err.message);
    }

    const downloadUrl = `/api/exports/download/${safeFilename}`;
    return JSON.stringify({
      type: 'exported_document',
      success: true,
      title: `Dokument aus Template ${template_slug}`,
      downloadUrl,
      filename: safeFilename,
      format: 'docx',
      template_slug,
    });
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Ersetzt `{{KEY}}` im Markdown durch variables[KEY] (case-insensitive
 * Lookup). Unbekannte Platzhalter bleiben als `{{KEY}}` stehen — der
 * Empfaenger sieht sie dann gelb hinterlegt im Word-Output (durch den
 * markdownDocx-Renderer).
 */
function substitutePlaceholders(md: string, variables: Record<string, any>): string {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(variables)) {
    if (v === null || v === undefined) continue;
    lookup.set(k.toUpperCase(), String(v));
  }
  return md.replace(/\{\{([A-ZÄÖÜ_0-9]+)\}\}/g, (full, key: string) => {
    const value = lookup.get(key.toUpperCase());
    return value !== undefined ? value : full;
  });
}
