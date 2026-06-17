/**
 * Podcast-Repurposing — REST API.
 * Mounted at `/api/apps/podcast-repurposing` (siehe `backend/src/routes/apps.ts`).
 */

import { Hono } from 'hono';
import { requireAppAccess } from '../permissions-middleware';
import { getCurrentUserId } from '../../auth/middleware';
import {
  createEpisode,
  getEpisode,
  getEpisodeDetail,
  listEpisodesForUser,
  updateEpisode,
  getOutput,
  updateOutput,
  getVisual,
  listFormats,
  getFormat,
  updateFormat,
} from './service';
import { saveEpisodeVideo } from './storage';
import { runPipeline, regenerateOutput, regenerateVisual } from './pipeline';
import { getPodigeeStatus, setPodigeeConfig, publishEpisodeToPodigee } from './publishing/podigee';

const router = new Hono();

router.use('*', requireAppAccess('podcast-repurposing'));

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB (v1)
const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
];

/* ----------------------------- Episodes ----------------------------- */

// POST /episodes — Video hochladen, Episode anlegen, Pipeline starten.
router.post('/episodes', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) return c.json({ error: 'Nicht authentifiziert' }, 401);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Ungültiger Upload (multipart erwartet)' }, 400);
  }
  const file = formData.get('file');
  const title = (formData.get('title') as string) || 'Untitled Episode';

  if (!(file instanceof File)) {
    return c.json({ error: 'Keine Video-Datei angegeben' }, 400);
  }
  const mime = (file.type.split(';')[0] || '').trim();
  if (!ALLOWED_VIDEO_MIME.includes(mime)) {
    return c.json({ error: `Nicht unterstütztes Video-Format: ${mime || 'unbekannt'}` }, 400);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return c.json({ error: `Datei zu groß (max. ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB)` }, 400);
  }

  const episode = await createEpisode(userId, title);
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const videoS3Key = await saveEpisodeVideo(episode.id, ext, buf, mime);
    await updateEpisode(episode.id, {
      videoS3Key,
      videoFilename: file.name,
      videoSizeBytes: file.size,
    });
  } catch (err: any) {
    await updateEpisode(episode.id, { status: 'failed', error: `Upload fehlgeschlagen: ${err?.message || err}` });
    return c.json({ error: 'Upload fehlgeschlagen' }, 500);
  }

  // Pipeline fire-and-forget — Antwort kommt sofort, Frontend pollt den Fortschritt.
  void runPipeline(episode.id).catch((err) =>
    console.error('[podcast-repurposing] runPipeline error:', err),
  );

  return c.json({ id: episode.id });
});

// GET /episodes — Liste des Nutzers.
router.get('/episodes', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) return c.json({ error: 'Nicht authentifiziert' }, 401);
  const episodes = await listEpisodesForUser(userId);
  return c.json({ episodes });
});

// GET /episodes/:id — Detail inkl. Outputs + Visuals.
router.get('/episodes/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const detail = await getEpisodeDetail(id);
  if (!detail) return c.json({ error: 'Episode nicht gefunden' }, 404);
  if (detail.episode.userId !== userId) return c.json({ error: 'Kein Zugriff' }, 403);
  return c.json(detail);
});

/* ----------------------------- Outputs ------------------------------ */

async function assertOutputOwner(outputId: string, userId: string | undefined) {
  const output = await getOutput(outputId);
  if (!output) return { error: 'Output nicht gefunden', status: 404 as const, output: null };
  const episode = await getEpisode(output.episodeId);
  if (!episode || episode.userId !== userId) return { error: 'Kein Zugriff', status: 403 as const, output: null };
  return { error: null, status: 200 as const, output };
}

// PATCH /outputs/:id — Inhalt editieren.
router.patch('/outputs/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const own = await assertOutputOwner(id, userId);
  if (own.error) return c.json({ error: own.error }, own.status);

  const body = await c.req.json().catch(() => ({}));
  const updated = await updateOutput(id, {
    ...(typeof body.content === 'string' ? { content: body.content } : {}),
    ...(typeof body.title === 'string' ? { title: body.title } : {}),
    ...(body.fields !== undefined ? { fields: body.fields } : {}),
    edited: true,
    status: 'edited',
  });
  return c.json({ output: updated });
});

// POST /outputs/:id/regenerate
router.post('/outputs/:id/regenerate', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const own = await assertOutputOwner(id, userId);
  if (own.error) return c.json({ error: own.error }, own.status);

  const ok = await regenerateOutput(id);
  if (!ok) return c.json({ error: 'Neu-Generierung nicht möglich (Transkript fehlt?)' }, 400);
  const output = await getOutput(id);
  return c.json({ output });
});

/* ----------------------------- Visuals ------------------------------ */

// POST /visuals/:id/regenerate
router.post('/visuals/:id/regenerate', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const visual = await getVisual(id);
  if (!visual) return c.json({ error: 'Visual nicht gefunden' }, 404);
  const episode = await getEpisode(visual.episodeId);
  if (!episode || episode.userId !== userId) return c.json({ error: 'Kein Zugriff' }, 403);

  const ok = await regenerateVisual(id);
  if (!ok) return c.json({ error: 'Neu-Generierung nicht möglich (Transkript/Bildmodell?)' }, 400);
  const updated = await getVisual(id);
  return c.json({ visual: updated });
});

/* ---------------------------- Publishing ---------------------------- */

// GET /settings/publishing — Status der Marken-Provider (ohne Token-Klartext).
router.get('/settings/publishing', async (c) => {
  const podigee = await getPodigeeStatus();
  return c.json({ podigee });
});

// PUT /settings/publishing/podigee — Podigee-Token + podcast_id hinterlegen.
router.put('/settings/publishing/podigee', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.apiToken || !body.podcastId) {
    return c.json({ error: 'apiToken und podcastId erforderlich' }, 400);
  }
  await setPodigeeConfig({ apiToken: String(body.apiToken), podcastId: String(body.podcastId) });
  const podigee = await getPodigeeStatus();
  return c.json({ podigee });
});

// POST /episodes/:id/publish/podigee — Episode als Entwurf auf Podigee veröffentlichen.
router.post('/episodes/:id/publish/podigee', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const episode = await getEpisode(id);
  if (!episode) return c.json({ error: 'Episode nicht gefunden' }, 404);
  if (episode.userId !== userId) return c.json({ error: 'Kein Zugriff' }, 403);
  if (episode.status !== 'done') return c.json({ error: 'Episode ist noch nicht fertig generiert' }, 400);

  try {
    const result = await publishEpisodeToPodigee(id);
    if (!result.ok) return c.json({ error: result.error || 'Veröffentlichung fehlgeschlagen' }, 502);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: String(err?.message || err) }, 502);
  }
});

/* ----------------------------- Settings ----------------------------- */

// GET /settings/formats — alle Format-Vorlagen.
router.get('/settings/formats', async (c) => {
  const formats = await listFormats();
  return c.json({ formats });
});

// PATCH /settings/formats/:id — Vorlage bearbeiten.
router.patch('/settings/formats/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await getFormat(id);
  if (!existing) return c.json({ error: 'Format nicht gefunden' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const updated = await updateFormat(id, {
    ...(typeof body.label === 'string' ? { label: body.label } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(typeof body.variants === 'number' ? { variants: body.variants } : {}),
    ...(typeof body.systemPrompt === 'string' ? { systemPrompt: body.systemPrompt } : {}),
    ...(typeof body.userPromptTemplate === 'string' ? { userPromptTemplate: body.userPromptTemplate } : {}),
  });
  return c.json({ format: updated });
});

export { router as podcastRepurposingRoutes };
