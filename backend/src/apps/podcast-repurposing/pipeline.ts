/**
 * Podcast-Repurposing — Generierungs-Pipeline (app-eigener, async Runner).
 *
 * Fire-and-forget aus der Upload-Route gestartet. Schritte:
 *   1. Audio extrahieren (ffmpeg)
 *   2. Transkribieren (Whisper, mit Chunking > 24 MB)
 *   3. Texte generieren (LLM je Format-Vorlage)
 *   4. Visuals generieren (Bild-Prompt via LLM -> generate_image)
 *
 * Jeder Schritt schreibt status + pipelineSteps in die Episode (Frontend pollt).
 * Fail-soft: ein fehlgeschlagener Schritt/Record bricht nicht die ganze Episode ab;
 * Teil-Ergebnisse bleiben sichtbar.
 */

import { llmService } from '../../services/llm';
import { imageGenerationService } from '../../services/imageGeneration';
import { saveGeneratedImage } from '../../services/imageStorage';
import { extractAudioToMp3, chunkAudioBySize } from '../../services/audioExtraction';
import { transcribeAudioFile } from '../../services/transcriptionService';
import { PIPELINE_STEPS, type PipelineStep } from './types';
import {
  getEpisode,
  updateEpisode,
  listFormats,
  insertOutput,
  insertVisual,
  getOutput,
  updateOutput,
  getVisual,
  updateVisual,
  getFormat,
  type EpisodeRow,
  type FormatRow,
} from './service';
import { getEpisodeVideo, saveEpisodeAudio } from './storage';

const TRANSCRIPT_MAX_CHARS = 8000; // begrenzt Token-Verbrauch pro Generierungs-Call

/* ----------------------------- Helpers ------------------------------ */

function truncate(text: string, max = TRANSCRIPT_MAX_CHARS): string {
  return text.length > max ? text.slice(0, max) + '\n…[gekürzt]' : text;
}

function renderTemplate(tpl: string, vars: { transcript: string; title: string }): string {
  return tpl
    .replace(/\{\{\s*transcript\s*\}\}/g, vars.transcript)
    .replace(/\{\{\s*title\s*\}\}/g, vars.title);
}

/** Toleranter JSON-Parser: entfernt ```-Fences; bei Fehler -> ganze Antwort als content. */
function parseJson(raw: string | null): Record<string, any> {
  const text = (raw ?? '').trim();
  if (!text) return {};
  let candidate = text;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) candidate = fence[1].trim();
  else {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first >= 0 && last > first) candidate = candidate.slice(first, last + 1);
  }
  try {
    return JSON.parse(candidate);
  } catch {
    return { content: text };
  }
}

async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  userId: string,
): Promise<{ content: string | null; model?: string }> {
  const result = await llmService.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ] as any,
    undefined,
    undefined,
    { userId },
  );
  return { content: result.content };
}

/* ------------------------- Single-record gen ------------------------ */

/** Generiert einen Text-Output aus einem Format; gibt die Felder zurück (ohne DB-Insert). */
async function generateTextFields(
  episode: EpisodeRow,
  transcript: string,
  format: FormatRow,
): Promise<{
  title: string | null;
  content: string;
  fields: Record<string, any> | null;
  modelUsed: string | null;
}> {
  const userPrompt = renderTemplate(format.userPromptTemplate, {
    transcript: truncate(transcript),
    title: episode.title,
  });
  const { content } = await callLlm(format.systemPrompt, userPrompt, episode.userId);
  const parsed = parseJson(content);

  const fields: Record<string, any> = {};
  if (Array.isArray(parsed.hashtags)) fields.hashtags = parsed.hashtags;
  if (typeof parsed.cta === 'string') fields.cta = parsed.cta;
  if (typeof parsed.subject === 'string') fields.subject = parsed.subject;

  return {
    title: typeof parsed.title === 'string' ? parsed.title : null,
    content: typeof parsed.content === 'string' ? parsed.content : (content ?? ''),
    fields: Object.keys(fields).length ? fields : null,
    modelUsed: null,
  };
}

/** Erzeugt einen Bild-Prompt (LLM) + generiert das Bild; gibt imageId/prompt/error zurück. */
async function generateVisualImage(
  episode: EpisodeRow,
  transcript: string,
  format: FormatRow,
): Promise<{ imageId: string | null; prompt: string | null; error: string | null }> {
  // 1. Bild-Prompt via LLM ableiten.
  const userPrompt = renderTemplate(format.userPromptTemplate, {
    transcript: truncate(transcript, 3000),
    title: episode.title,
  });
  let imagePrompt = episode.title;
  try {
    const { content } = await callLlm(format.systemPrompt, userPrompt, episode.userId);
    const parsed = parseJson(content);
    if (typeof parsed.prompt === 'string' && parsed.prompt.trim()) imagePrompt = parsed.prompt.trim();
  } catch {
    /* Fallback auf Titel-basierten Prompt */
  }

  // 2. Bild generieren.
  await imageGenerationService.reload();
  if (!imageGenerationService.getCurrentModel()) {
    return { imageId: null, prompt: imagePrompt, error: 'Kein Bildmodell konfiguriert' };
  }
  const result = await imageGenerationService.generate({
    prompt: imagePrompt,
    aspectRatio: format.aspectRatio ?? '1:1',
    numberOfImages: 1,
  });
  if (!result.success || result.images.length === 0) {
    return { imageId: null, prompt: imagePrompt, error: result.error || 'Bildgenerierung fehlgeschlagen' };
  }
  const image = result.images[0]!;
  const saved = await saveGeneratedImage({
    id: image.id,
    base64Data: image.base64Data,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    prompt: imagePrompt,
    provider: result.provider,
    model: result.model,
    revisedPrompt: image.revisedPrompt,
  });
  return { imageId: saved.id, prompt: imagePrompt, error: null };
}

/* ----------------------------- Main run ----------------------------- */

export async function runPipeline(episodeId: string): Promise<void> {
  const steps: PipelineStep[] = PIPELINE_STEPS.map((s) => ({ id: s.id, name: s.name, status: 'pending' }));

  const setStep = async (
    stepId: string,
    status: PipelineStep['status'],
    episodeStatus?: EpisodeRow['status'],
    error?: string,
  ) => {
    const step = steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      if (error) step.error = error;
    }
    await updateEpisode(episodeId, {
      pipelineSteps: steps as never,
      ...(episodeStatus ? { status: episodeStatus } : {}),
    });
  };

  try {
    const episode = await getEpisode(episodeId);
    if (!episode || !episode.videoS3Key) {
      throw new Error('Episode oder Video nicht gefunden.');
    }
    const ext = (episode.videoFilename?.split('.').pop() || 'mp4').toLowerCase();

    // 1. Audio extrahieren
    await setStep('extract', 'running', 'extracting_audio');
    const videoBuf = await getEpisodeVideo(episode.videoS3Key);
    const mp3 = await extractAudioToMp3(videoBuf, ext);
    const audioS3Key = await saveEpisodeAudio(episodeId, mp3);
    await updateEpisode(episodeId, { audioS3Key });
    await setStep('extract', 'done');

    // 2. Transkribieren (mit Chunking)
    await setStep('transcribe', 'running', 'transcribing');
    const chunks = await chunkAudioBySize(mp3);
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const file = new File([new Uint8Array(chunk)], `chunk-${i}.mp3`, { type: 'audio/mpeg' });
      parts.push(await transcribeAudioFile(file, 'de'));
    }
    const transcript = parts.join('\n').trim();
    await updateEpisode(episodeId, {
      transcript,
      transcriptMeta: { chunks: chunks.length, language: 'de' } as never,
    });
    await setStep('transcribe', 'done');

    if (!transcript) throw new Error('Transkript ist leer.');

    const freshEpisode = (await getEpisode(episodeId))!;
    const formats = await listFormats({ enabledOnly: true });

    // 3. Texte generieren
    await setStep('generate_text', 'running', 'generating');
    const textFormats = formats.filter((f) => f.kind === 'social' || f.kind === 'blog' || f.kind === 'email');
    for (const format of textFormats) {
      const variants = Math.max(1, format.variants);
      for (let v = 0; v < variants; v++) {
        try {
          const gen = await generateTextFields(freshEpisode, transcript, format);
          await insertOutput({
            episodeId,
            kind: format.kind,
            platform: format.platform,
            variant: v,
            formatId: format.id,
            title: gen.title,
            content: gen.content,
            fields: gen.fields,
            status: 'generated',
            modelUsed: gen.modelUsed,
          });
        } catch (err: any) {
          await insertOutput({
            episodeId,
            kind: format.kind,
            platform: format.platform,
            variant: v,
            formatId: format.id,
            content: '',
            status: 'failed',
            error: String(err?.message || err),
          });
        }
      }
    }
    await setStep('generate_text', 'done');

    // 4. Visuals generieren
    await setStep('generate_visuals', 'running');
    const visualFormats = formats.filter((f) => f.kind === 'visual');
    for (const format of visualFormats) {
      try {
        const vis = await generateVisualImage(freshEpisode, transcript, format);
        await insertVisual({
          episodeId,
          role: format.id,
          aspectRatio: format.aspectRatio ?? '1:1',
          imageId: vis.imageId,
          prompt: vis.prompt,
          status: vis.imageId ? 'generated' : 'failed',
          error: vis.error,
        });
      } catch (err: any) {
        await insertVisual({
          episodeId,
          role: format.id,
          aspectRatio: format.aspectRatio ?? '1:1',
          status: 'failed',
          error: String(err?.message || err),
        });
      }
    }
    await setStep('generate_visuals', 'done');

    await updateEpisode(episodeId, { status: 'done', pipelineSteps: steps as never });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error(`[podcast-repurposing] pipeline failed for ${episodeId}:`, msg);
    const running = steps.find((s) => s.status === 'running');
    if (running) {
      running.status = 'failed';
      running.error = msg;
    }
    await updateEpisode(episodeId, { status: 'failed', error: msg, pipelineSteps: steps as never });
  }
}

/* --------------------------- Regeneration --------------------------- */

export async function regenerateOutput(outputId: string): Promise<boolean> {
  const output = await getOutput(outputId);
  if (!output) return false;
  const episode = await getEpisode(output.episodeId);
  const format = await getFormat(output.formatId);
  if (!episode || !format || !episode.transcript) return false;

  const gen = await generateTextFields(episode, episode.transcript, format);
  await updateOutput(outputId, {
    title: gen.title,
    content: gen.content,
    fields: gen.fields as never,
    status: 'generated',
    edited: false,
    error: null,
    modelUsed: gen.modelUsed,
  });
  return true;
}

export async function regenerateVisual(visualId: string): Promise<boolean> {
  const visual = await getVisual(visualId);
  if (!visual) return false;
  const episode = await getEpisode(visual.episodeId);
  const format = await getFormat(visual.role);
  if (!episode || !format || !episode.transcript) return false;

  const vis = await generateVisualImage(episode, episode.transcript, format);
  await updateVisual(visualId, {
    imageId: vis.imageId,
    prompt: vis.prompt,
    status: vis.imageId ? 'generated' : 'failed',
    error: vis.error,
  });
  return true;
}
