/**
 * Transcription Routes
 * Handles Speech-to-Text via Whisper API
 */

import { Hono } from 'hono';
import { loadProvidersConfig, getProvider, resolveFeatureUrl } from '../services/providers';
import { uploadRateLimit } from '../middleware/rateLimit';
import { internalError, validationError, serviceError, errorResponse, ErrorCode } from '../utils/errorHandler';
import { authMiddleware } from '../auth';
import { $ } from 'bun';
import { randomUUID } from 'crypto';
import { unlink, mkdir } from 'fs/promises';
import path from 'path';

const transcriptionRoutes = new Hono();

// Require authentication for all transcription operations
transcriptionRoutes.use('/*', authMiddleware);

// Audio file size limit (in bytes)
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_AUDIO_SIZE_MB = 25;

// Temp directory for audio conversion
const TEMP_DIR = '/tmp/adacor-workplace-audio';

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
    const fileEntry = formData.get('file');
    const file = fileEntry instanceof File ? fileEntry : null;

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

    const normalizedMimeType = (file.type.split(';')[0] ?? '').trim();
    console.log(`[Transcription] Received: "${file.type}" -> normalized: "${normalizedMimeType}"`);
    if (!validAudioTypes.includes(normalizedMimeType)) {
      console.log(`[Transcription] REJECTED - valid types:`, validAudioTypes);
      return validationError(c, 'Nicht unterstütztes Audioformat');
    }

    // Get active STT configuration
    const config = await loadProvidersConfig();
    const active = config.active.stt;

    if (!active?.provider_id || !active?.model_id) {
      return errorResponse(c, { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Spracherkennung nicht konfiguriert' });
    }

    const provider = await getProvider(active.provider_id);
    if (!provider || !provider.enabled) {
      return errorResponse(c, { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Spracherkennung nicht verfügbar' });
    }

    // Get model (for model-specific base_url)
    const model = provider.models?.find(m => m.id === active.model_id);
    if (!model) {
      return errorResponse(c, { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Sprachmodell nicht verfügbar' });
    }

    // Get API key from environment
    const apiKey = provider.api_key_env ? process.env[provider.api_key_env] : null;
    if (!apiKey) {
      return errorResponse(c, { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Spracherkennung nicht konfiguriert' });
    }

    // Determine transcription URL
    // If model has feature_set with bit 64 (Audio/Whisper), use feature-specific URL
    let transcriptionUrl: string;
    const featureUrl = model.feature_set != null
      ? resolveFeatureUrl(model.id, model.feature_set, 64, '/transcriptions')
      : null;

    if (featureUrl) {
      // Feature URL is the full transcription endpoint path
      transcriptionUrl = featureUrl;
    } else {
      // Fallback: model or provider base_url
      const baseUrl = model.base_url || provider.base_url;
      transcriptionUrl = baseUrl.includes('/transcriptions')
        ? baseUrl
        : `${baseUrl}/transcriptions`;
    }

    // Get optional language parameter (default: German)
    const rawLang = formData.get('language');
    const language = typeof rawLang === 'string' ? rawLang : 'de';

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

    const whisperForm = new FormData();
    whisperForm.append('file', fileToSend);

    // Always send model parameter - Adacor Whisper API requires it
    whisperForm.append('model', active.model_id);
    // Set language for transcription
    whisperForm.append('language', language);

    // Debug: Log what we're sending
    const formEntries: string[] = [];
    whisperForm.forEach((value, key) => {
      if (value instanceof File) {
        formEntries.push(`${key}: File(${value.name}, ${value.type}, ${value.size} bytes)`);
      } else {
        formEntries.push(`${key}: ${value}`);
      }
    });
    console.log(`[Transcription] URL: ${transcriptionUrl}`);
    console.log(`[Transcription] FormData: ${formEntries.join(', ')}`);

    // Call Whisper API
    const response = await fetch(transcriptionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log full error details server-side only
      console.error('[Transcription] API error:', response.status, errorText);
      return serviceError(c, new Error(errorText), 'Whisper API');
    }

    const result = await response.json();
    console.log('[Transcription] API response:', JSON.stringify(result));
    return c.json({ text: result.text });
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
