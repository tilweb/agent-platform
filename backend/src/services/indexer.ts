/**
 * Indexer Service
 *
 * Handles document conversion (via Adacor Markitdown API),
 * metadata generation (via LLM), and knowledge base indexing.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, basename, extname } from 'path';
import { llmService, type Message } from './llm';
import type { UsageContext } from './usageTracking';

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');
const INCOMING_DIR = join(KB_BASE, 'incoming');

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
    this.markitdownUrl = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
    this.apiKey = process.env.ADACOR_AI_API_KEY || '';
  }

  /**
   * Convert a document to Markdown via Adacor Markitdown API
   */
  async convertDocument(filePath: string): Promise<string> {
    const fullPath = join(INCOMING_DIR, filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Datei nicht gefunden: ${filePath}`);
    }

    const fileName = basename(filePath);

    // Check if it's already markdown/text
    const ext = extname(filePath).toLowerCase();
    if (['.md', '.txt'].includes(ext)) {
      const content = await readFile(fullPath, 'utf-8');
      return content;
    }

    // Call Markitdown API for conversion
    // Bun.file() doesn't recognize uppercase extensions (.PDF → application/octet-stream),
    // so we read the file as a Blob with explicit MIME type based on extension.
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.csv': 'text/csv',
      '.rtf': 'application/rtf',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const fileData = await readFile(fullPath);
    const blob = new Blob([fileData], { type: mimeType });
    const formData = new FormData();
    formData.append('document', blob, fileName);

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

    const markdown = await response.text();
    return markdown;
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
  ): Promise<IndexResult> {
    // Validate collection exists
    const collectionDir = join(KB_BASE, 'collections', collectionId);
    if (!existsSync(collectionDir)) {
      throw new Error(`Collection "${collectionId}" existiert nicht. Erstelle sie zuerst mit kb_manage.`);
    }

    // Generate document ID
    const timestamp = Date.now();
    const baseName = basename(filePath, extname(filePath))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const documentId = `doc-${baseName}-${timestamp}`;
    const documentPath = documentId;

    // Create document directory inside collection
    const docDir = join(KB_BASE, 'collections', collectionId, 'documents', documentPath);
    await mkdir(docDir, { recursive: true });

    // Step 1: Convert document to markdown
    console.log(`[Indexer] Converting document: ${filePath}`);
    const content = await this.convertDocument(filePath);

    // Step 2: Save content.md
    await writeFile(join(docDir, 'content.md'), content, 'utf-8');

    // Step 3: Generate and save DOCUMENT_META.md
    console.log(`[Indexer] Generating metadata for: ${filePath}`);
    const meta = await this.generateMeta(content, metadata, filePath, documentId, collectionId, triggeringUserId);
    await writeFile(join(docDir, 'DOCUMENT_META.md'), meta, 'utf-8');

    // Step 4: Generate INDEX.md for large documents
    const index = await this.generateIndex(content, triggeringUserId, collectionId);
    if (index) {
      console.log(`[Indexer] Generated index for large document: ${filePath}`);
      await writeFile(join(docDir, 'INDEX.md'), index, 'utf-8');
    }

    // Step 5: Update collection manifest
    await this.updateManifest(collectionId, {
      document_id: documentId,
      title: metadata.title || baseName,
      path: documentPath,
      source_file: basename(filePath),
      summary: meta.substring(0, 200),
      indexed_date: new Date().toISOString().split('T')[0] ?? '',
    });

    const title = metadata.title || baseName;
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

}

export const indexerService = new IndexerService();
