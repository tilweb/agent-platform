/**
 * Indexer Service
 *
 * Handles document conversion (via Adacor Markitdown API),
 * metadata generation (via LLM), and knowledge base indexing.
 */

import { readFile, writeFile, mkdir, copyFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { $ } from 'bun';
import { randomUUID } from 'crypto';
import { llmService, type Message, createImageContent } from './llm';
import type { UsageContext } from './usageTracking';
import { KB_BASE, KB_INCOMING_DIR as INCOMING_DIR, MARKITDOWN_API_URL, MARKITDOWN_API_KEY } from '../utils/paths';

/** Image extensions that should be analyzed via Vision LLM instead of Markitdown */
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg',
]);

/** Audio extensions that should be transcribed via STT */
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac', '.aac', '.wma',
]);

const AUDIO_MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.flac': 'audio/flac',
  '.aac': 'audio/aac', '.wma': 'audio/x-ms-wma',
};

/** Audio formats that need conversion to MP3 before Whisper transcription */
const FORMATS_NEEDING_CONVERSION = new Set(['.m4a', '.webm', '.ogg', '.aac', '.wma', '.flac']);

export interface IndexResult {
  success: boolean;
  document_id: string;
  document_path: string;
  collection_id: string;
  title: string;
  message: string;
}

interface IndexMetadata {
  title?: string;
  owner?: string;
  confidentiality?: string;
}

class IndexerService {
  private markitdownUrl: string;
  private apiKey: string;

  constructor() {
    this.markitdownUrl = MARKITDOWN_API_URL;
    this.apiKey = MARKITDOWN_API_KEY;
  }

  /**
   * Convert a document to Markdown.
   * - Text/Markdown: read directly
   * - Images: analyze via Vision LLM
   * - Other (PDF, Word, etc.): convert via Markitdown API
   */
  async convertDocument(filePath: string, triggeringUserId?: string): Promise<string> {
    const fullPath = join(INCOMING_DIR, filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Datei nicht gefunden: ${filePath}`);
    }

    const fileName = basename(filePath);
    const ext = extname(filePath).toLowerCase();

    // Text/Markdown: read directly
    if (['.md', '.txt'].includes(ext)) {
      return await readFile(fullPath, 'utf-8');
    }

    // Images: analyze via Vision LLM
    if (IMAGE_EXTENSIONS.has(ext)) {
      return await this.analyzeImageWithVision(fullPath, fileName, triggeringUserId);
    }

    // Audio: transcribe via STT
    if (AUDIO_EXTENSIONS.has(ext)) {
      return await this.transcribeAudio(fullPath, fileName, ext);
    }

    // Everything else: Markitdown API
    const file = Bun.file(fullPath);
    const formData = new FormData();
    formData.append('document', file, fileName);

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
   * Analyze an image via Vision LLM and produce structured markdown content,
   * equivalent to what Markitdown produces for documents.
   */
  private async analyzeImageWithVision(
    fullPath: string,
    fileName: string,
    triggeringUserId?: string,
  ): Promise<string> {
    const imageBuffer = await readFile(fullPath);
    const base64 = imageBuffer.toString('base64');

    // Detect MIME type from extension
    const ext = extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.tiff': 'image/tiff', '.tif': 'image/tiff', '.svg': 'image/svg+xml',
    };
    const mimeType = mimeMap[ext] || 'image/png';

    const messages: Message[] = [
      {
        role: 'system',
        content: `Du bist ein Bildanalyst für eine Wissensdatenbank. Analysiere das Bild und erstelle eine strukturierte Markdown-Beschreibung.

Erstelle eine ausführliche Beschreibung im folgenden Format:

# [Beschreibender Titel des Bildes]

## Beschreibung
[Detaillierte Beschreibung des Bildinhalts in 3-5 Sätzen]

## Erkannte Inhalte
[Liste aller erkennbaren Elemente: Text, Logos, Personen, Diagramme, Tabellen, etc.]

## Text im Bild
[Falls Text im Bild erkennbar ist, transkribiere ihn hier. Falls kein Text vorhanden: "Kein Text erkannt."]

## Kontext
[Einordnung: Worum handelt es sich? Präsentation, Screenshot, Foto, Diagramm, Infografik, etc.]

Wichtig: Beschreibe NUR was du siehst. Keine Spekulationen.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analysiere dieses Bild (Dateiname: ${fileName}):` },
          createImageContent(base64, mimeType),
        ],
      },
    ];

    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'indexer',
      operation: 'kb_image_analysis',
    };

    let result = '';
    for await (const chunk of llmService.streamChat(messages, [], usageContext)) {
      if (!chunk?.choices?.[0]) continue;
      const choice = chunk.choices[0];
      if (choice?.delta?.content) {
        result += choice.delta.content;
      }
    }

    if (!result.trim()) {
      throw new Error('Vision-Modell hat keine Analyse zurückgegeben');
    }

    console.log(`[Indexer] Vision analysis complete for: ${fileName} (${result.length} chars)`);
    return result;
  }

  /**
   * Convert audio file to MP3 using ffmpeg (for formats Whisper doesn't support well).
   */
  private async convertToMp3(inputPath: string): Promise<string> {
    const outputPath = join(process.env.TMPDIR || '/tmp', `indexer-${randomUUID()}.mp3`);

    try {
      console.log(`[Indexer] Converting audio to MP3...`);
      const result = await $`ffmpeg -y -i ${inputPath} -vn -ar 16000 -ac 1 -b:a 128k ${outputPath}`.quiet();

      if (result.exitCode !== 0) {
        throw new Error(`ffmpeg conversion failed: ${result.stderr.toString()}`);
      }

      console.log(`[Indexer] Conversion complete: ${outputPath}`);
      return outputPath;
    } catch (error) {
      try { await unlink(outputPath); } catch { /* ignore */ }
      throw error;
    }
  }

  /**
   * Transcribe an audio file via the configured STT provider and format as markdown.
   */
  private async transcribeAudio(fullPath: string, fileName: string, ext: string): Promise<string> {
    const { loadProvidersConfig, getProvider, resolveApiKey } = await import('./providers');
    const config = await loadProvidersConfig();
    const active = config.active.stt;

    if (!active?.provider_id || !active?.model_id) {
      throw new Error('Spracherkennung (STT) nicht konfiguriert');
    }

    const provider = await getProvider(active.provider_id);
    if (!provider || !provider.enabled) {
      throw new Error('STT-Provider nicht verfügbar');
    }

    const model = provider.models?.find((m: any) => m.id === active.model_id);
    if (!model) {
      throw new Error('STT-Modell nicht verfügbar');
    }

    const apiKey = await resolveApiKey(provider);
    if (!apiKey) {
      throw new Error('API-Key für STT nicht konfiguriert');
    }

    const baseUrl = model.base_url || provider.base_url;
    const transcriptionUrl = baseUrl.includes('/transcriptions')
      ? baseUrl
      : `${baseUrl}/transcriptions`;

    // Convert to MP3 if format needs it (M4A, WebM, OGG, etc.)
    let audioPath = fullPath;
    let audioFileName = fileName;
    let mimeType = AUDIO_MIME_MAP[ext] || 'audio/mpeg';
    let tempMp3Path: string | null = null;

    if (FORMATS_NEEDING_CONVERSION.has(ext)) {
      try {
        tempMp3Path = await this.convertToMp3(fullPath);
        audioPath = tempMp3Path;
        audioFileName = fileName.replace(/\.[^.]+$/, '.mp3');
        mimeType = 'audio/mpeg';
        console.log(`[Indexer] Using converted MP3 for transcription`);
      } catch (conversionError: any) {
        console.error(`[Indexer] MP3 conversion failed, trying original: ${conversionError.message}`);
        // Fall back to original file
      }
    }

    try {
      const audioBuffer = await readFile(audioPath);
      const blob = new Blob([audioBuffer], { type: mimeType });
      const file = new File([blob], audioFileName, { type: mimeType });

      const form = new FormData();
      form.append('file', file);
      form.append('model', active.model_id);
      form.append('language', 'de');

      console.log(`[Indexer] Transcribing audio: ${audioFileName} via ${provider.name}`);

      const response = await fetch(transcriptionUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`STT API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const transcription = result.text || '';

      if (!transcription.trim()) {
        throw new Error('Transkription ist leer — keine Sprache erkannt');
      }

      // Format as markdown document
      const lines = [
        `# Transkription: ${fileName}`,
        '',
        `> Audio-Transkription vom ${new Date().toLocaleDateString('de-DE')}`,
        '',
        `**Quelldatei:** ${fileName}`,
        `**Modell:** ${active.model_id}`,
        '',
        '---',
        '',
        '## Transkription',
        '',
        transcription,
        '',
      ];

      console.log(`[Indexer] Transcription complete for: ${fileName} (${transcription.length} chars)`);
      return lines.join('\n');
    } finally {
      // Cleanup temp MP3
      if (tempMp3Path) {
        try { await unlink(tempMp3Path); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Get audio duration via ffprobe, formatted as M:SS.
   */
  private async getAudioDuration(filePath: string): Promise<string | null> {
    try {
      const result = await $`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`.quiet();
      const seconds = parseFloat(result.stdout.toString().trim());
      if (isNaN(seconds)) return null;
      const min = Math.floor(seconds / 60);
      const sec = Math.round(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
    } catch {
      return null;
    }
  }

  /**
   * Generate DOCUMENT_META.md via LLM
   */
  async generateMeta(
    content: string,
    metadata: IndexMetadata,
    sourceFile: string,
    documentId: string,
    collectionId: string,
    triggeringUserId?: string,
  ): Promise<string> {
    const contentPreview = content.substring(0, 8000);

    const messages: Message[] = [
      {
        role: 'system',
        content: `Du bist ein Metadaten-Generator für eine Wissensdatenbank. Analysiere den Dokumentinhalt und erstelle strukturierte Metadaten.

Antworte NUR im folgenden Format (DOCUMENT_META.md):

# DOCUMENT_META

## Basisdaten
- **Titel:** [Erkannter oder übergebener Titel]
- **Dokument-ID:** ${documentId}
- **Typ:** [vertrag|richtlinie|handbuch|spezifikation|bericht|sonstige]
- **Erstellt:** [Datum wenn erkennbar, sonst "unbekannt"]
- **Indiziert:** ${new Date().toISOString().split('T')[0]}
- **Quelle:** ${sourceFile}
- **Seitenanzahl:** [geschätzt basierend auf Textlänge]
- **Sprache:** [de|en|andere]

## Klassifizierung
- **Collection:** ${collectionId}
- **Vertraulichkeit:** ${metadata.confidentiality || 'internal'}
- **Owner:** ${metadata.owner || 'unbekannt'}

## Inhaltsbeschreibung
[2-3 Sätze die den Inhalt zusammenfassen]

## Keywords
[Komma-getrennte Liste von 5-15 relevanten Keywords]

## Beantwortet Fragen zu
[Liste von 3-8 Fragen die dieses Dokument beantworten kann, eine pro Zeile mit Bindestrich]`,
      },
      {
        role: 'user',
        content: `Titel (wenn bekannt): ${metadata.title || 'Aus Inhalt ableiten'}

Dokumentinhalt (Vorschau):
${contentPreview}`,
      },
    ];

    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'indexer',
      operation: 'kb_manifest',
      resourceId: collectionId,
    };

    let result = '';
    for await (const chunk of llmService.streamChat(messages, [], usageContext)) {
      if (!chunk?.choices?.[0]) continue;
      const choice = chunk.choices[0];
      if (choice?.delta?.content) {
        result += choice.delta.content;
      }
    }

    return result;
  }

  /**
   * Generate INDEX.md for large documents
   */
  async generateIndex(content: string, triggeringUserId?: string, collectionId?: string): Promise<string | null> {
    // Only generate index for large documents (>20000 chars)
    if (content.length < 20000) {
      return null;
    }

    const messages: Message[] = [
      {
        role: 'system',
        content: `Du bist ein Index-Generator. Erstelle ein Inhaltsverzeichnis für das folgende Dokument.

Format:
# INDEX

## Kapitelübersicht

| Nr | Kapitel | Beschreibung | Zeichenposition |
|----|---------|-------------|-----------------|
| 1  | [Name]  | [Kurzbeschreibung] | [ungefähre Position] |

## Zusammenfassung je Kapitel

### Kapitel 1: [Name]
[2-3 Sätze Zusammenfassung]

...`,
      },
      {
        role: 'user',
        content: content.substring(0, 30000),
      },
    ];

    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'indexer',
      operation: 'kb_index',
      resourceId: collectionId,
    };

    let result = '';
    for await (const chunk of llmService.streamChat(messages, [], usageContext)) {
      if (!chunk?.choices?.[0]) continue;
      const choice = chunk.choices[0];
      if (choice?.delta?.content) {
        result += choice.delta.content;
      }
    }

    return result;
  }

  /**
   * Main indexing orchestration
   */
  async indexDocument(
    filePath: string,
    collectionId: string,
    metadata: IndexMetadata,
    triggeringUserId?: string,
    options?: { preAllocatedDocumentId?: string; skipManifestEntry?: boolean },
  ): Promise<IndexResult> {
    // Validate collection exists
    const collectionDir = join(KB_BASE, 'collections', collectionId);
    if (!existsSync(collectionDir)) {
      throw new Error(`Collection "${collectionId}" existiert nicht. Erstelle sie zuerst mit kb_manage.`);
    }

    // Generate or use pre-allocated document ID
    let documentId: string;
    if (options?.preAllocatedDocumentId) {
      documentId = options.preAllocatedDocumentId;
    } else {
      const timestamp = Date.now();
      const baseName = basename(filePath, extname(filePath))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      documentId = `doc-${baseName}-${timestamp}`;
    }
    const documentPath = documentId;

    // Create document directory inside collection
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', documentPath);
    await mkdir(docDir, { recursive: true });

    // Step 1: Convert document to markdown
    console.log(`[Indexer] Converting document: ${filePath}`);
    const content = await this.convertDocument(filePath, triggeringUserId);

    // Step 2: Save content.md
    await writeFile(join(docDir, 'content.md'), content, 'utf-8');

    // Step 2b: Copy original file into document directory (for preview/download)
    const ext = extname(filePath).toLowerCase();
    if (!['.md', '.txt'].includes(ext)) {
      const originalSrc = join(INCOMING_DIR, filePath);
      if (existsSync(originalSrc)) {
        await copyFile(originalSrc, join(docDir, basename(filePath)));
      }
    }

    // Step 3: Generate and save DOCUMENT_META.md
    console.log(`[Indexer] Generating metadata for: ${filePath}`);
    let meta = await this.generateMeta(content, metadata, filePath, documentId, collectionId, triggeringUserId);

    // Step 3b: For audio files, extract duration and insert into metadata
    if (AUDIO_EXTENSIONS.has(ext)) {
      const duration = await this.getAudioDuration(join(INCOMING_DIR, filePath));
      if (duration) {
        meta = meta.replace(
          /(- \*\*Seitenanzahl:\*\*.+)/,
          `$1\n- **Dauer:** ${duration}`
        );
      }
    }

    await writeFile(join(docDir, 'DOCUMENT_META.md'), meta, 'utf-8');

    // Step 4: Generate INDEX.md for large documents
    const index = await this.generateIndex(content, triggeringUserId, collectionId);
    if (index) {
      console.log(`[Indexer] Generated index for large document: ${filePath}`);
      await writeFile(join(docDir, 'INDEX.md'), index, 'utf-8');
    }

    // Step 5: Update collection manifest (skip if placeholder already exists)
    if (!options?.skipManifestEntry) {
      const fileBaseName = basename(filePath, extname(filePath))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await this.updateManifest(collectionId, {
        document_id: documentId,
        title: metadata.title || fileBaseName,
        path: documentPath,
        source_file: basename(filePath),
        summary: meta.substring(0, 200),
        indexed_date: new Date().toISOString().split('T')[0] ?? '',
      });

      // Step 6: Update collections.yaml document count
      await this.updateCollectionCount(collectionId);
    } else {
      // Update the placeholder's source_file field in the manifest
      await this.updateManifestSourceFile(collectionId, documentId, basename(filePath));
    }

    const fileBaseName2 = basename(filePath, extname(filePath))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const title = metadata.title || fileBaseName2;
    console.log(`[Indexer] Successfully indexed: ${title} → ${collectionId}/${documentId}`);

    return {
      success: true,
      document_id: documentId,
      document_path: documentPath,
      collection_id: collectionId,
      title,
      message: `Dokument "${title}" erfolgreich indiziert in Collection "${collectionId}"`,
    };
  }

  private async updateManifest(
    collectionId: string,
    doc: {
      document_id: string;
      title: string;
      path: string;
      source_file: string;
      summary: string;
      indexed_date: string;
    },
  ): Promise<void> {
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    let manifest = await readFile(manifestPath, 'utf-8');

    const newEntry = [
      `  - document_id: "${doc.document_id}"`,
      `    title: "${doc.title}"`,
      `    source_file: "${doc.source_file}"`,
      `    path: "${doc.path}"`,
      `    indexed_date: "${doc.indexed_date}"`,
      `    status: "ready"`,
      `    error: ""`,
    ].join('\n');

    if (manifest.includes('documents: []')) {
      manifest = manifest.replace('documents: []', `documents:\n${newEntry}`);
    } else {
      manifest = manifest.trimEnd() + '\n' + newEntry + '\n';
    }

    // Update last_updated
    manifest = manifest.replace(
      /last_updated: ".*"/,
      `last_updated: "${new Date().toISOString()}"`,
    );

    await writeFile(manifestPath, manifest, 'utf-8');
  }

  private async updateManifestSourceFile(collectionId: string, documentId: string, sourceFile: string): Promise<void> {
    const manifestPath = join(KB_BASE, 'collections', collectionId, 'manifest.yaml');
    let manifest = await readFile(manifestPath, 'utf-8');

    // Update source_file for the placeholder entry
    const pattern = new RegExp(
      `(- document_id: "${documentId}"[\\s\\S]*?)source_file: "[^"]*"`,
    );
    if (pattern.test(manifest)) {
      manifest = manifest.replace(pattern, `$1source_file: "${sourceFile}"`);
      await writeFile(manifestPath, manifest, 'utf-8');
    }
  }

  /** Public access for fast-path importers (e.g. generated images) */
  async updateManifestPublic(collectionId: string, doc: {
    document_id: string; title: string; path: string;
    source_file: string; indexed_date: string;
  }) {
    await this.updateManifest(collectionId, { ...doc, summary: '' });
  }

  async updateCollectionCountPublic(collectionId: string) {
    await this.updateCollectionCount(collectionId);
  }

  async updateManifestSourceFilePublic(collectionId: string, documentId: string, sourceFile: string) {
    await this.updateManifestSourceFile(collectionId, documentId, sourceFile);
  }

  /**
   * Backfill audio duration into DOCUMENT_META.md for documents indexed
   * before duration extraction was added. Returns the (possibly updated) meta.
   */
  async backfillAudioDuration(meta: string, sourceFile: string, docDir: string): Promise<string> {
    const ext = extname(sourceFile).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) return meta;
    if (meta.includes('**Dauer:**')) return meta;

    const audioPath = join(docDir, sourceFile);
    if (!existsSync(audioPath)) return meta;

    const duration = await this.getAudioDuration(audioPath);
    if (!duration) return meta;

    const patched = meta.replace(
      /(- \*\*Seitenanzahl:\*\*.+)/,
      `$1\n- **Dauer:** ${duration}`
    );

    if (patched !== meta) {
      const metaPath = join(docDir, 'DOCUMENT_META.md');
      await writeFile(metaPath, patched, 'utf-8');
      console.log(`[Indexer] Backfilled audio duration for ${sourceFile}: ${duration}`);
    }
    return patched;
  }

  private async updateCollectionCount(collectionId: string): Promise<void> {
    const collectionsPath = join(KB_BASE, 'collections.yaml');
    let content = await readFile(collectionsPath, 'utf-8');

    // Simple regex approach to increment document_count for the collection
    const regex = new RegExp(
      `(- id: "${collectionId}"[\\s\\S]*?document_count: )(\\d+)`,
    );
    const match = content.match(regex);
    if (match) {
      const currentCount = parseInt(match[2] ?? '0', 10);
      content = content.replace(regex, `$1${currentCount + 1}`);
      await writeFile(collectionsPath, content, 'utf-8');
    }
  }
}

export const indexerService = new IndexerService();
