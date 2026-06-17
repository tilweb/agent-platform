/**
 * Podigee-Publishing — Config (verschlüsselter Token) + Veröffentlichungs-Flow.
 *
 * Geteilte Marken-Identität: ein Podigee-API-Token + podcast_id (die Show),
 * vom Admin einmal hinterlegt, AES-GCM-verschlüsselt via CONNECTION_ENCRYPTION_KEY.
 *
 * Flow (Entwurf/Review): uploads -> PUT audio -> episodes -> productions ->
 * start?publish_episode=false (encodiert, aber NICHT automatisch live).
 */

import { encryptTokens, decryptTokens } from '../../../connections/crypto';
import { extractAudioToMp3 } from '../../../services/audioExtraction';
import { getEpisode, getEpisodeDetail, getBrandSettings, saveBrandSettings, insertPublication, updatePublication } from '../service';
import { getEpisodeVideo } from '../storage';

const PODIGEE_BASE = 'https://app.podigee.com/api/v1';

interface PodigeeConfig {
  podcastId: string;
  apiToken: string;
}

/* ------------------------------ Config ------------------------------ */

export async function setPodigeeConfig(cfg: PodigeeConfig): Promise<void> {
  const settings = await getBrandSettings();
  const token = await encryptTokens({ accessToken: cfg.apiToken, tokenType: 'Token' } as never);
  settings.podigee = { podcastId: cfg.podcastId, token };
  await saveBrandSettings(settings);
}

export async function getPodigeeConfig(): Promise<PodigeeConfig | null> {
  const settings = await getBrandSettings();
  const p = settings.podigee;
  if (!p?.podcastId || !p?.token) return null;
  try {
    const dec = (await decryptTokens(p.token)) as { accessToken?: string };
    if (!dec.accessToken) return null;
    return { podcastId: String(p.podcastId), apiToken: dec.accessToken };
  } catch {
    return null;
  }
}

/** Status ohne Token-Klartext (fürs UI). */
export async function getPodigeeStatus(): Promise<{ configured: boolean; podcastId: string | null }> {
  const settings = await getBrandSettings();
  const p = settings.podigee;
  return { configured: Boolean(p?.podcastId && p?.token), podcastId: p?.podcastId ?? null };
}

/* ------------------------------ Helpers ----------------------------- */

function sanitizeFilename(title: string): string {
  return (title || 'episode').replace(/[^a-zA-Z0-9._ -]/g, '').trim().slice(0, 80) || 'episode';
}

async function pdg(token: string, method: string, pathWithQuery: string, jsonBody?: unknown): Promise<any> {
  const res = await fetch(`${PODIGEE_BASE}${pathWithQuery}`, {
    method,
    headers: {
      Token: token,
      ...(jsonBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Podigee ${method} ${pathWithQuery} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/* ------------------------------ Publish ----------------------------- */

export async function publishEpisodeToPodigee(episodeId: string): Promise<{ ok: boolean; publicationId: string; error?: string }> {
  const cfg = await getPodigeeConfig();
  if (!cfg) throw new Error('Podigee ist nicht konfiguriert (Token/Podcast-ID fehlen).');

  const episode = await getEpisode(episodeId);
  if (!episode || !episode.videoS3Key) throw new Error('Episode oder Video nicht gefunden.');

  const pub = await insertPublication({ episodeId, platform: 'podigee', status: 'processing' });

  try {
    // 1. Publish-taugliches Audio extrahieren (44,1 kHz stereo).
    const ext = (episode.videoFilename?.split('.').pop() || 'mp4').toLowerCase();
    const videoBuf = await getEpisodeVideo(episode.videoS3Key);
    const audio = await extractAudioToMp3(videoBuf, ext, { hq: true });

    // 2. Upload-URL holen + Audio per PUT hochladen.
    const filename = `${sanitizeFilename(episode.title)}.mp3`;
    const upload = await pdg(cfg.apiToken, 'POST', `/uploads?filename=${encodeURIComponent(filename)}`);
    const putRes = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': upload.content_type || 'audio/mpeg' },
      body: new Uint8Array(audio),
    });
    if (!putRes.ok) throw new Error(`Podigee-Audio-Upload fehlgeschlagen: ${putRes.status}`);

    // 3. Episode anlegen (Beschreibung = Blogpost-Text falls vorhanden).
    const detail = await getEpisodeDetail(episodeId);
    const blog = detail?.outputs.find((o) => o.kind === 'blog');
    const description = blog?.content || `Podcast-Folge: ${episode.title}`;
    const ep = await pdg(cfg.apiToken, 'POST', '/episodes', {
      title: episode.title,
      podcast_id: cfg.podcastId,
      description,
    });
    const externalId = String(ep.id ?? ep.episode?.id ?? '');

    // 4. Production anlegen + encodieren (NICHT auto-veröffentlichen → Entwurf/Review).
    const prod = await pdg(cfg.apiToken, 'POST', '/productions', {
      episode_id: externalId,
      files: [{ url: upload.file_url }],
    });
    const productionId = String(prod.id ?? prod.production?.id ?? '');
    if (productionId) {
      await pdg(cfg.apiToken, 'POST', `/productions/${productionId}/start?publish_episode=false`);
    }

    const externalUrl = externalId
      ? `https://app.podigee.com/podcasts/${cfg.podcastId}/episodes/${externalId}`
      : null;
    await updatePublication(pub.id, { status: 'draft', externalId, externalUrl, error: null });
    return { ok: true, publicationId: pub.id };
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('[podcast-repurposing] Podigee publish failed:', msg);
    await updatePublication(pub.id, { status: 'failed', error: msg });
    return { ok: false, publicationId: pub.id, error: msg };
  }
}
