/**
 * Chat Attachments Service
 *
 * Handles file uploads in chat, conversion via Markitdown API,
 * and temporary storage for agent processing.
 */

import { readFile, writeFile, mkdir, rm, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, extname, basename, normalize } from 'path';
import { validateUpload } from '../utils/fileTypeValidator';
import { $ } from 'bun';
import { randomUUID } from 'crypto';

const DATA_BASE = resolve(process.cwd(), '../data');
const UPLOADS_BASE = join(DATA_BASE, 'chat-uploads');

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB for documents/images
const MAX_FILE_SIZE_MB = 50;

export interface ChatAttachment {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  type: 'document' | 'image' | 'audio';
  storagePath: string;
  markdownContent?: string;  // For documents (after conversion)
  base64Data?: string;       // For images
  transcription?: string;    // For audio (after transcription)
  metadata: {
    size: number;
    pages?: number;
    duration?: number;       // For audio (in seconds)
    convertedAt?: string;
    originalPath: string;
  };
}

export interface AttachmentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  type: 'document' | 'image' | 'audio';
  size: number;
  pages?: number;
  duration?: number;
}

// MIME types for documents that can be converted
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/html',
];

// MIME types for images
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

// MIME types for audio
const AUDIO_MIME_TYPES = [
  'audio/mpeg',      // mp3
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',       // m4a
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'video/webm',      // MediaRecorder sometimes reports video/webm for audio-only
  'video/ogg',       // Some browsers report video/ogg for audio
];

// Formats that need conversion to MP3 before Whisper transcription
const FORMATS_NEEDING_CONVERSION = ['audio/webm', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];

class AttachmentsService {
  private markitdownUrl: string;
  private apiKey: string;

  constructor() {
    this.markitdownUrl = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
    this.apiKey = process.env.ADACOR_AI_API_KEY || '';

    // Warn if using default URL (should be configured in production)
    if (!process.env.MARKITDOWN_API_URL) {
      console.warn('[Attachments] MARKITDOWN_API_URL not set, using default. Configure in .env for production.');
    }
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   * - Uses basename to strip directory components
   * - Removes null bytes and other dangerous characters
   * - Normalizes path separators
   */
  private sanitizeFilename(filename: string): string {
    // First, get only the base name (removes any directory components)
    let sanitized = basename(normalize(filename));

    // Remove null bytes (used in some path traversal attacks)
    sanitized = sanitized.replace(/\0/g, '');

    // Remove any remaining path separators that might slip through
    sanitized = sanitized.replace(/[\/\\]/g, '_');

    // Remove other potentially dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

    // Ensure it's not empty after sanitization
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Sanitize extension to prevent injection
   */
  private sanitizeExtension(filename: string): string {
    const ext = extname(this.sanitizeFilename(filename)).toLowerCase();
    // Only allow alphanumeric extensions
    if (/^\.[a-z0-9]+$/i.test(ext)) {
      return ext;
    }
    return '';
  }

  /**
   * Generate a unique attachment ID
   */
  private generateAttachmentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `att-${timestamp}-${random}`;
  }

  /**
   * Determine file type from MIME type
   */
  private getFileType(mimeType: string): 'document' | 'image' | 'audio' | null {
    // Normalize MIME type by removing parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseMimeType = mimeType.split(';')[0]!.trim();

    if (DOCUMENT_MIME_TYPES.includes(baseMimeType)) return 'document';
    if (IMAGE_MIME_TYPES.includes(baseMimeType)) return 'image';
    if (AUDIO_MIME_TYPES.includes(baseMimeType)) return 'audio';
    return null;
  }

  /**
   * Convert a document to Markdown via Markitdown API
   */
  private async convertToMarkdown(filePath: string, filename: string): Promise<string> {
    const ext = extname(filename).toLowerCase();

    // Already markdown/text - just read it
    if (['.md', '.txt'].includes(ext)) {
      return await readFile(filePath, 'utf-8');
    }

    // Call Markitdown API for conversion
    const file = Bun.file(filePath);
    const formData = new FormData();
    formData.append('document', file, filename);

    const response = await fetch(this.markitdownUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markitdown API error ${response.status}: ${errorText}`);
    }

    return await response.text();
  }

  /**
   * Convert image to base64
   */
  private async imageToBase64(filePath: string, mimeType: string): Promise<string> {
    const buffer = await readFile(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Convert audio file to MP3 using ffmpeg (for formats Whisper doesn't support well)
   */
  private async convertToMp3(inputPath: string, mimeType: string): Promise<string> {
    const fileId = randomUUID();
    const outputPath = join(UPLOADS_BASE, `temp-${fileId}.mp3`);

    try {
      console.log(`[Attachments] Converting ${mimeType} to MP3...`);
      const result = await $`ffmpeg -y -i ${inputPath} -vn -ar 16000 -ac 1 -b:a 128k ${outputPath}`.quiet();

      if (result.exitCode !== 0) {
        throw new Error(`ffmpeg conversion failed: ${result.stderr.toString()}`);
      }

      console.log(`[Attachments] Conversion complete: ${outputPath}`);
      return outputPath;
    } catch (error) {
      // Cleanup on error
      try { await unlink(outputPath); } catch { /* ignore */ }
      throw error;
    }
  }

  /**
   * Transcribe audio via STT API
   */
  private async transcribeAudio(filePath: string, filename: string, mimeType: string): Promise<string> {
    // Load providers config to get STT settings
    const { loadProvidersConfig, getProvider } = await import('./providers');
    const config = await loadProvidersConfig();
    const active = config.active.stt;

    if (!active?.provider_id || !active?.model_id) {
      throw new Error('Spracherkennung nicht konfiguriert');
    }

    const provider = await getProvider(active.provider_id);
    if (!provider || !provider.enabled) {
      throw new Error('Spracherkennung nicht verfügbar');
    }

    const model = provider.models?.find(m => m.id === active.model_id);
    if (!model) {
      throw new Error('Sprachmodell nicht verfügbar');
    }

    const apiKey = provider.api_key_env ? process.env[provider.api_key_env] : null;
    if (!apiKey) {
      throw new Error('API-Key für Spracherkennung nicht konfiguriert');
    }

    const baseUrl = model.base_url || provider.base_url;

    // Normalize MIME type
    const normalizedMimeType = mimeType.split(';')[0]!.trim();

    // Convert to MP3 if needed (browser formats like WebM/OGG/M4A often not recognized by Whisper)
    let audioFilePath = filePath;
    let audioFilename = filename;
    let audioMimeType = normalizedMimeType;
    let tempMp3Path: string | null = null;

    if (FORMATS_NEEDING_CONVERSION.includes(normalizedMimeType)) {
      try {
        tempMp3Path = await this.convertToMp3(filePath, normalizedMimeType);
        audioFilePath = tempMp3Path;
        audioFilename = filename.replace(/\.[^.]+$/, '.mp3');
        audioMimeType = 'audio/mpeg';
        console.log(`[Attachments] Using converted MP3 for transcription`);
      } catch (conversionError: any) {
        console.error(`[Attachments] Conversion failed, trying original: ${conversionError.message}`);
        // Fall back to original file
      }
    }

    try {
      // Read audio file and create FormData
      const audioBuffer = await readFile(audioFilePath);
      const blob = new Blob([audioBuffer], { type: audioMimeType });
      const file = new File([blob], audioFilename, { type: audioMimeType });

      // Build URL - don't append /transcriptions if already in base_url
      const transcriptionUrl = baseUrl.includes('/transcriptions')
        ? baseUrl
        : `${baseUrl}/transcriptions`;

      // Build multipart form data for Whisper API
      const whisperForm = new FormData();
      whisperForm.append('file', file);

      // Always send model parameter - Adacor Whisper API requires it
      whisperForm.append('model', active.model_id);
      // Set language to German for correct transcription
      whisperForm.append('language', 'de');

      console.log(`[Attachments] Transcribing audio: ${audioFilename} (${audioMimeType}) via ${provider.name}`);

      const response = await fetch(transcriptionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: whisperForm,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.text || '';
    } finally {
      // Cleanup temp MP3 file
      if (tempMp3Path) {
        try { await unlink(tempMp3Path); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Process an uploaded file
   */
  async processUpload(sessionId: string, file: File): Promise<ChatAttachment> {
    // Check file size limit
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Datei zu groß. Maximum: ${MAX_FILE_SIZE_MB} MB`);
    }

    const attachmentId = this.generateAttachmentId();

    // Sanitize filename to prevent path traversal
    const safeFilename = this.sanitizeFilename(file.name);
    const safeExtension = this.sanitizeExtension(file.name);

    // Read file content for validation
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file type using magic bytes (not just client MIME type)
    const validation = validateUpload(buffer, file.type, safeFilename);
    if (!validation.isValid) {
      throw new Error(validation.error || `Ungültiger Dateityp: ${file.type}`);
    }

    // Use detected MIME type instead of client-provided
    // Normalize by removing parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const rawMimeType = validation.detectedMimeType || file.type;
    const actualMimeType = rawMimeType.split(';')[0]!.trim();
    const fileType = this.getFileType(actualMimeType);

    if (!fileType) {
      throw new Error(`Nicht unterstützter Dateityp: ${actualMimeType}`);
    }

    // Log if there was a mismatch
    if (validation.mismatch) {
      console.warn(`[Attachments] MIME mismatch for ${safeFilename}: claimed=${file.type}, detected=${actualMimeType}`);
    }

    // Validate sessionId to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error('Ungültige Session-ID');
    }

    // Create storage directory
    const sessionDir = join(UPLOADS_BASE, sessionId);
    const attachmentDir = join(sessionDir, attachmentId);
    await mkdir(attachmentDir, { recursive: true });

    // Save original file with sanitized extension
    const originalPath = join(attachmentDir, `original${safeExtension}`);
    await writeFile(originalPath, buffer);

    // Process based on type
    let markdownContent: string | undefined;
    let base64Data: string | undefined;
    let transcription: string | undefined;

    if (fileType === 'document') {
      console.log(`[Attachments] Converting document: ${safeFilename}`);
      try {
        markdownContent = await this.convertToMarkdown(originalPath, safeFilename);
        // Save converted content
        await writeFile(join(attachmentDir, 'content.md'), markdownContent, 'utf-8');
      } catch (error: any) {
        console.error(`[Attachments] Conversion failed for ${safeFilename}:`, error.message);
        // Fallback: try to read as text
        try {
          markdownContent = await readFile(originalPath, 'utf-8');
        } catch {
          markdownContent = `[Fehler bei der Konvertierung: ${error.message}]`;
        }
      }
    } else if (fileType === 'image') {
      console.log(`[Attachments] Processing image: ${safeFilename}`);
      base64Data = await this.imageToBase64(originalPath, actualMimeType);
    } else if (fileType === 'audio') {
      console.log(`[Attachments] Transcribing audio: ${safeFilename}`);
      try {
        transcription = await this.transcribeAudio(originalPath, safeFilename, actualMimeType);
        // Save transcription
        await writeFile(join(attachmentDir, 'transcription.txt'), transcription, 'utf-8');
        console.log(`[Attachments] Transcription complete: ${transcription.length} characters`);
      } catch (error: any) {
        console.error(`[Attachments] Transcription failed for ${safeFilename}:`, error.message);
        transcription = `[Fehler bei der Transkription: ${error.message}]`;
      }
    }

    // Estimate page count for documents
    let pages: number | undefined;
    if (markdownContent) {
      // Rough estimate: ~3000 characters per page
      pages = Math.max(1, Math.ceil(markdownContent.length / 3000));
    }

    // Create attachment object (use validated MIME type and sanitized filename)
    const attachment: ChatAttachment = {
      id: attachmentId,
      sessionId,
      filename: safeFilename,
      mimeType: actualMimeType,
      type: fileType,
      storagePath: attachmentDir,
      markdownContent,
      base64Data,
      transcription,
      metadata: {
        size: file.size,
        pages,
        convertedAt: new Date().toISOString(),
        originalPath,
      },
    };

    // Save metadata
    await writeFile(
      join(attachmentDir, 'metadata.json'),
      JSON.stringify(attachment, null, 2),
      'utf-8'
    );

    console.log(`[Attachments] Processed ${fileType}: ${safeFilename} → ${attachmentId}`);
    return attachment;
  }

  /**
   * Get a single attachment by ID
   */
  async getAttachment(attachmentId: string, sessionId?: string): Promise<ChatAttachment | null> {
    // Search in all sessions if sessionId not provided
    if (!sessionId) {
      if (!existsSync(UPLOADS_BASE)) return null;

      const sessions = await readdir(UPLOADS_BASE);
      for (const session of sessions) {
        const attachmentDir = join(UPLOADS_BASE, session, attachmentId);
        if (existsSync(attachmentDir)) {
          sessionId = session;
          break;
        }
      }

      if (!sessionId) return null;
    }

    const attachmentDir = join(UPLOADS_BASE, sessionId, attachmentId);
    const metadataPath = join(attachmentDir, 'metadata.json');

    if (!existsSync(metadataPath)) return null;

    try {
      const metadataRaw = await readFile(metadataPath, 'utf-8');
      const attachment = JSON.parse(metadataRaw) as ChatAttachment;

      // Re-load content if needed (in case it was large and not saved in metadata)
      if (attachment.type === 'document' && !attachment.markdownContent) {
        const contentPath = join(attachmentDir, 'content.md');
        if (existsSync(contentPath)) {
          attachment.markdownContent = await readFile(contentPath, 'utf-8');
        }
      }

      // Re-load transcription for audio
      if (attachment.type === 'audio' && !attachment.transcription) {
        const transcriptionPath = join(attachmentDir, 'transcription.txt');
        if (existsSync(transcriptionPath)) {
          attachment.transcription = await readFile(transcriptionPath, 'utf-8');
        }
      }

      return attachment;
    } catch (error) {
      console.error(`[Attachments] Error loading attachment ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Get all attachments for a session
   */
  async getSessionAttachments(sessionId: string): Promise<ChatAttachment[]> {
    const sessionDir = join(UPLOADS_BASE, sessionId);

    if (!existsSync(sessionDir)) return [];

    const attachmentIds = await readdir(sessionDir);
    const attachments: ChatAttachment[] = [];

    for (const attachmentId of attachmentIds) {
      const attachment = await this.getAttachment(attachmentId, sessionId);
      if (attachment) {
        attachments.push(attachment);
      }
    }

    return attachments;
  }

  /**
   * Get attachment metadata only (for supervisor context)
   */
  async getAttachmentMetadata(attachmentId: string, sessionId?: string): Promise<AttachmentMetadata | null> {
    const attachment = await this.getAttachment(attachmentId, sessionId);
    if (!attachment) return null;

    return {
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      type: attachment.type,
      size: attachment.metadata.size,
      pages: attachment.metadata.pages,
    };
  }

  /**
   * Get metadata for all session attachments (for supervisor context)
   */
  async getSessionAttachmentMetadata(sessionId: string): Promise<AttachmentMetadata[]> {
    const attachments = await this.getSessionAttachments(sessionId);
    return attachments.map(att => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      type: att.type,
      size: att.metadata.size,
      pages: att.metadata.pages,
    }));
  }

  /**
   * Clean up all attachments for a session
   */
  async cleanupSessionAttachments(sessionId: string): Promise<void> {
    const sessionDir = join(UPLOADS_BASE, sessionId);

    if (existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true });
      console.log(`[Attachments] Cleaned up session: ${sessionId}`);
    }
  }

  /**
   * Get the original file path for an attachment (for streaming/download)
   */
  async getAttachmentFilePath(attachmentId: string, sessionId?: string): Promise<{ path: string; mimeType: string; filename: string } | null> {
    const attachment = await this.getAttachment(attachmentId, sessionId);
    if (!attachment) return null;

    const originalPath = attachment.metadata.originalPath;
    if (!originalPath || !existsSync(originalPath)) {
      return null;
    }

    return {
      path: originalPath,
      mimeType: attachment.mimeType,
      filename: attachment.filename,
    };
  }

  /**
   * Generate a URL for accessing an attachment
   * This URL can be used in chat history for persistent access
   */
  generateAttachmentUrl(chatId: string, attachmentId: string): string {
    return `/api/chats/${chatId}/attachments/${attachmentId}`;
  }

  /**
   * Clean up old attachments (older than maxAge hours)
   */
  async cleanupOldAttachments(maxAgeHours: number = 24): Promise<number> {
    if (!existsSync(UPLOADS_BASE)) return 0;

    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    const sessions = await readdir(UPLOADS_BASE);
    for (const sessionId of sessions) {
      const sessionDir = join(UPLOADS_BASE, sessionId);
      const attachmentIds = await readdir(sessionDir);

      for (const attachmentId of attachmentIds) {
        const metadataPath = join(sessionDir, attachmentId, 'metadata.json');

        if (existsSync(metadataPath)) {
          try {
            const metadataRaw = await readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataRaw);
            const convertedAt = new Date(metadata.metadata?.convertedAt || 0).getTime();

            if (now - convertedAt > maxAgeMs) {
              await rm(join(sessionDir, attachmentId), { recursive: true, force: true });
              cleanedCount++;
            }
          } catch {
            // If metadata is corrupted, clean it up
            await rm(join(sessionDir, attachmentId), { recursive: true, force: true });
            cleanedCount++;
          }
        }
      }

      // Remove empty session directories
      const remaining = await readdir(sessionDir);
      if (remaining.length === 0) {
        await rm(sessionDir, { recursive: true, force: true });
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Attachments] Cleaned up ${cleanedCount} old attachments`);
    }

    return cleanedCount;
  }
}

export const attachmentsService = new AttachmentsService();
