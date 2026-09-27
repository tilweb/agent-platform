/**
 * Word-Vorlagen: Design- und Strukturvorlagen für Dokument-Exporte.
 * Konzept und Spike-Befunde: docs/word-vorlagen-2026-09-25.md
 */
export { renderWithDesign, inspectTemplate, getBuiltinShell, TemplateError, CONTENT_MARKER, STANDARD_FIELDS } from './render';
export type { TemplateInspection, DesignRenderInput } from './render';
export { sectionsToMarkdown } from './sections';
export {
  listTemplates, getTemplate, createTemplate, updateTemplateMeta, setDefaultDesign, deleteTemplate,
  loadTemplateFile, resolveDesignTemplate, toDto,
} from './store';
export type { TemplateKind, DocTemplateRow } from './store';

import { renderWithDesign, getBuiltinShell } from './render';
import { resolveDesignTemplate, loadTemplateFile } from './store';

/**
 * Word-Export aus Markdown: explizite oder Standard-Designvorlage, sonst eingebaute
 * schlichte Hülle. Liefert zusätzlich den Namen der verwendeten Vorlage.
 */
export async function renderMarkdownDocx(input: { title: string; markdown: string; designTemplateId?: string | null }): Promise<{ buffer: Uint8Array; templateName: string | null }> {
  const design = await resolveDesignTemplate(input.designTemplateId);
  const shell = design ? await loadTemplateFile(design) : await getBuiltinShell();
  const buffer = await renderWithDesign(shell, { title: input.title, markdown: input.markdown });
  return { buffer, templateName: design?.name ?? null };
}
