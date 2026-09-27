/**
 * Dokumentvorlagen (Word) — Verwaltung der Designvorlagen.
 *
 * Designvorlagen pflegen nur Admins; lesen (Liste, Testdokument) dürfen alle
 * angemeldeten Nutzer. Strukturvorlagen (auch nutzereigen) folgen in Phase 2.
 * Konzept: docs/word-vorlagen-2026-09-25.md
 */
import { Hono } from 'hono';
import { authMiddleware, adminMiddleware, getCurrentUserId } from '../auth';
import { contentDispositionHeader } from '../utils/contentDisposition';
import {
  listTemplates, getTemplate, createTemplate, updateTemplateMeta, setDefaultDesign, deleteTemplate,
  loadTemplateFile, renderWithDesign, toDto, TemplateError,
} from '../services/docTemplates';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;

/** Beispielinhalt mit allen Elementen, die das LLM typischerweise erzeugt. */
const SAMPLE_MARKDOWN = `Dieses Testdokument zeigt, wie Inhalte aus dem Chat mit dieser Vorlage aussehen.

## Überschrift Ebene 2
Fließtext mit **Fettung**, *Kursivschrift* und einem [Link](https://www.adacor.com). Lange Absätze laufen im Satzspiegel der Vorlage um, Schriftart und Farben kommen aus deren Formatvorlagen.

### Überschrift Ebene 3
- Aufzählungspunkt
  - Unterpunkt
- Zweiter Aufzählungspunkt

1. Erster Schritt
2. Zweiter Schritt

## Tabelle
| Meilenstein | Termin | Status |
|---|---|---|
| Konzept | 01.08. | erledigt |
| Umsetzung | 15.09. | in Arbeit |
| Go-Live | 30.10. | offen |

> Hinweis: Zitate und Hervorhebungen nutzen die Formatvorlage „Zitat“, sofern die Vorlage eine hat.`;

export const docTemplateRoutes = new Hono();

docTemplateRoutes.use('*', authMiddleware);

// GET /api/doc-templates?kind=design
docTemplateRoutes.get('/', async (c) => {
  const kind = c.req.query('kind') === 'structure' ? 'structure' : 'design';
  if (kind === 'structure') return c.json({ templates: [] }); // Phase 2
  const rows = await listTemplates('design');
  return c.json({ templates: rows.map(toDto) });
});

// POST /api/doc-templates — multipart: file, name, description?
docTemplateRoutes.post('/', adminMiddleware, async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ error: 'Keine Datei hochgeladen.' }, 400);
  if (!/\.(docx|dotx)$/i.test(file.name)) {
    return c.json({ error: 'Bitte eine Word-Datei (.docx oder .dotx) hochladen.' }, 400);
  }
  if (file.size > MAX_TEMPLATE_BYTES) return c.json({ error: 'Die Vorlage ist größer als 20 MB.' }, 400);
  const name = String(form.get('name') ?? '').trim() || file.name.replace(/\.(docx|dotx)$/i, '');
  const description = String(form.get('description') ?? '').trim() || null;

  try {
    const row = await createTemplate({
      kind: 'design',
      name: name.slice(0, 120),
      description,
      filename: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      ownerUserId: getCurrentUserId(c)!,
    });
    return c.json({ template: toDto(row) }, 201);
  } catch (err) {
    if (err instanceof TemplateError) return c.json({ error: err.message }, 400);
    console.error('[doc-templates] Upload fehlgeschlagen:', err);
    return c.json({ error: 'Die Vorlage konnte nicht gespeichert werden.' }, 500);
  }
});

// PATCH /api/doc-templates/:id — { name?, description? }
docTemplateRoutes.patch('/:id', adminMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({})) as { name?: unknown; description?: unknown };
  const patch: { name?: string; description?: string | null } = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.description === 'string') patch.description = body.description.trim() || null;
  const row = await updateTemplateMeta(c.req.param('id'), patch);
  if (!row) return c.json({ error: 'Vorlage nicht gefunden.' }, 404);
  return c.json({ template: toDto(row) });
});

// PUT /api/doc-templates/:id/default — als Standard-Design der Instanz setzen
docTemplateRoutes.put('/:id/default', adminMiddleware, async (c) => {
  const row = await getTemplate(c.req.param('id'));
  if (!row || row.kind !== 'design') return c.json({ error: 'Designvorlage nicht gefunden.' }, 404);
  await setDefaultDesign(row.id);
  return c.json({ success: true });
});

// DELETE /api/doc-templates/default — Standard entfernen (eingebautes Design greift)
docTemplateRoutes.delete('/default', adminMiddleware, async (c) => {
  await setDefaultDesign(null);
  return c.json({ success: true });
});

// DELETE /api/doc-templates/:id
docTemplateRoutes.delete('/:id', adminMiddleware, async (c) => {
  const ok = await deleteTemplate(c.req.param('id'));
  if (!ok) return c.json({ error: 'Vorlage nicht gefunden.' }, 404);
  return c.json({ success: true });
});

// GET /api/doc-templates/:id/file — Original herunterladen
docTemplateRoutes.get('/:id/file', adminMiddleware, async (c) => {
  const row = await getTemplate(c.req.param('id'));
  if (!row) return c.json({ error: 'Vorlage nicht gefunden.' }, 404);
  const data = await loadTemplateFile(row);
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': DOCX_MIME, 'Content-Disposition': contentDispositionHeader(row.filename, DOCX_MIME) },
  });
});

// GET /api/doc-templates/:id/preview — Testdokument mit Beispielinhalt
docTemplateRoutes.get('/:id/preview', async (c) => {
  const row = await getTemplate(c.req.param('id'));
  if (!row) return c.json({ error: 'Vorlage nicht gefunden.' }, 404);
  try {
    const out = await renderWithDesign(await loadTemplateFile(row), { title: `Testdokument – ${row.name}`, markdown: SAMPLE_MARKDOWN });
    const filename = `Testdokument ${row.name}.docx`;
    return new Response(new Uint8Array(out), {
      headers: { 'Content-Type': DOCX_MIME, 'Content-Disposition': contentDispositionHeader(filename, DOCX_MIME) },
    });
  } catch (err) {
    console.error('[doc-templates] Testdokument fehlgeschlagen:', err);
    return c.json({ error: err instanceof TemplateError ? err.message : 'Testdokument konnte nicht erzeugt werden.' }, 500);
  }
});
