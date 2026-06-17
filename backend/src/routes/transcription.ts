/**
 * Transcription Routes
 * Handles Speech-to-Text via Whisper API
 */

import { Hono } from 'hono';
import { loadProvidersConfig, getProvider } from '../services/providers';
import { transcribeAudioFile } from '../services/transcriptionService';
import { uploadRateLimit } from '../middleware/rateLimit';
import { internalError, validationError, serviceError } from '../utils/errorHandler';
import { $ } from 'bun';
import { randomUUID } from 'crypto';
import { unlink, mkdir } from 'fs/promises';
import path from 'path';

const transcriptionRoutes = new Hono();

// Audio file size limit (in bytes)
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_AUDIO_SIZE_MB = 25;

// Temp directory for audio conversion
const TEMP_DIR = '/tmp/agent-platform-audio';

// Formats that need conversion (not natively supported by all Whisper implementations)
const FORMATS_NEEDING_CONVERSION = ['audio/webm', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];

/**
 * Convert audio file to MP3 using ffmpeg
 * @param inputBuffer - The input audio data
 * @param inputMimeType - The MIME type of the input
 * @returns The converted MP3 file as a File object
 */
async function convertToMp3(inputBuffer: ArrayBuffer, inputMimeType: string): Promise<File> {
  // Ensure temp directory exists
  await mkdir(TEMP_DIR, { recursive: true });

  const fileId = randomUUID();

  // Determine input extension from MIME type
  let inputExt = 'webm';
  if (inputMimeType.includes('ogg')) inputExt = 'ogg';
  else if (inputMimeType.includes('mp4') || inputMimeType.includes('m4a')) inputExt = 'm4a';
  else if (inputMimeType.includes('webm')) inputExt = 'webm';

  const inputPath = path.join(TEMP_DIR, `${fileId}.${inputExt}`);
  const outputPath = path.join(TEMP_DIR, `${fileId}.mp3`);

  try {
    // Write input file
    await Bun.write(inputPath, inputBuffer);

    // Convert using ffmpeg
    console.log(`[Transcription] Converting ${inputMimeType} to MP3...`);
    const result = await $`ffmpeg -y -i ${inputPath} -vn -ar 16000 -ac 1 -b:a 128k ${outputPath}`.quiet();

    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg conversion failed: ${result.stderr.toString()}`);
    }

    // Read output file
    const outputFile = Bun.file(outputPath);
    const outputBuffer = await outputFile.arrayBuffer();

    console.log(`[Transcription] Conversion complete: ${outputBuffer.byteLength} bytes`);

    // Create File object
    return new File([outputBuffer], `audio-${fileId}.mp3`, { type: 'audio/mpeg' });
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
    } catch { /* ignore */ }
    try {
      await unlink(outputPath);
    } catch { /* ignore */ }
  }
}

/**
 * POST /api/transcribe - Transcribes an audio file
 */
transcriptionRoutes.post('/', uploadRateLimit, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return validationError(c, 'Keine Audiodatei angegeben');
    }

    // Check file size limit
    if (file.size > MAX_AUDIO_SIZE) {
      return validationError(c, `Audiodatei zu groß. Maximum: ${MAX_AUDIO_SIZE_MB} MB`);
    }

    // Validate file type (normalize to remove codec parameters like ";codecs=opus")
    const validAudioTypes = [
      'audio/mpeg',      // mp3
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',       // m4a
      'audio/x-m4a',     // m4a (alternative)
      'audio/m4a',       // m4a (alternative)
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'video/webm',      // MediaRecorder sometimes reports video/webm for audio-only
      'video/ogg',       // Some browsers report video/ogg for audio
    ];

    const normalizedMimeType = (file.type.split(';')[0] || '').trim();
    console.log(`[Transcription] Received: "${file.type}" -> normalized: "${normalizedMimeType}"`);
    if (!validAudioTypes.includes(normalizedMimeType)) {
      console.log(`[Transcription] REJECTED - valid types:`, validAudioTypes);
      return validationError(c, 'Nicht unterstütztes Audioformat');
    }

    // Get optional language parameter (default: German)
    const language = (formData.get('language') as string) || 'de';

    // Convert audio to MP3 if needed (browser formats like WebM/OGG/M4A often not recognized by Whisper)
    let fileToSend: File = file;
    if (FORMATS_NEEDING_CONVERSION.includes(normalizedMimeType)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileToSend = await convertToMp3(arrayBuffer, normalizedMimeType);
        console.log(`[Transcription] Converted ${normalizedMimeType} to MP3`);
      } catch (conversionError) {
        console.error('[Transcription] Conversion failed:', conversionError);
        return serviceError(c, conversionError as Error, 'Audio conversion');
      }
    }

    // Whisper-Aufruf über den geteilten Service (Provider-Config, URL-Bau, POST).
    try {
      const text = await transcribeAudioFile(fileToSend, language);
      return c.json({ text });
    } catch (sttError) {
      console.error('[Transcription] STT error:', sttError);
      return serviceError(c, sttError as Error, 'Whisper API');
    }
  } catch (error) {
    // Log full error details server-side only
    console.error('[Transcription] Error:', error);
    return internalError(c, error, { operation: 'transcription' });
  }
});

/**
 * GET /api/transcribe/status - Check if STT is configured and available
 */
transcriptionRoutes.get('/status', async (c) => {
  try {
    const config = await loadProvidersConfig();
    const active = config.active.stt;

    if (!active?.provider_id || !active?.model_id) {
      return c.json({
        available: false,
        reason: 'No STT model configured',
      });
    }

    const provider = await getProvider(active.provider_id);
    if (!provider) {
      return c.json({
        available: false,
        reason: 'Provider not found',
      });
    }

    if (!provider.enabled) {
      return c.json({
        available: false,
        reason: 'Provider is disabled',
      });
    }

    const model = provider.models?.find(m => m.id === active.model_id);
    if (!model) {
      return c.json({
        available: false,
        reason: 'Model not found',
      });
    }

    // Check if API key is configured
    const apiKey = provider.api_key_env ? process.env[provider.api_key_env] : null;
    if (!apiKey) {
      return c.json({
        available: false,
        reason: 'API key not configured',
      });
    }

    return c.json({
      available: true,
      provider: provider.name,
      model: model.name,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return c.json({
      available: false,
      reason: 'Error checking status',
    });
  }
});

export { transcriptionRoutes };
