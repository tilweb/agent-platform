/**
 * Analyse-Pipeline-Route (Baustein a): Upload eines/mehrerer EMMA-Export-PDFs
 * (Prozess-Familie) → Checker → LLM-Vor-Benotung → Baustand-Entwurf.
 *
 * Antwortet als SSE-Stream: `progress`-Events je Phase (Extraktion, Checker,
 * KI-Vor-Benotung, Persistenz) + abschließendes `done` mit dem Baustand, damit
 * der lange LLM-Schritt im Frontend nicht als „hängt" wahrgenommen wird.
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getCurrentUserId } from '../../../auth/middleware';
import { getProzess } from '../storage';
import { analyseProzess, type UploadFile } from '../analysis';
import { denyIfNotAppEditor } from './_shared';

export const analyseRoutes = new Hono();

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

analyseRoutes.post('/prozesse/:id/analyse', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const prozessId = c.req.param('id');
  const prozess = await getProzess(prozessId);
  if (!prozess) return c.json({ error: 'Prozess nicht gefunden' }, 404);

  const form = await c.req.formData();
  const files: UploadFile[] = [];
  for (const entry of form.getAll('files')) {
    if (entry instanceof File) {
      const bytes = new Uint8Array(await entry.arrayBuffer());
      files.push({ filename: entry.name, bytes, mimeType: entry.type || 'application/pdf' });
    }
  }
  if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

  const total = files.reduce((s, f) => s + f.bytes.length, 0);
  if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);

  const userId = getCurrentUserId(c);

  return streamSSE(c, async (stream) => {
    try {
      const baustand = await analyseProzess({
        prozessId,
        files,
        userId,
        onProgress: async (type, data) => {
          await stream.writeSSE({ event: type, data: JSON.stringify(data) });
        },
      });
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ baustand }) });
    } catch (err) {
      console.error('[echoloop] Analyse fehlgeschlagen:', err);
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: err instanceof Error ? err.message : 'Analyse fehlgeschlagen' }) });
    }
  });
});
