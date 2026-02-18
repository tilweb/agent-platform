/**
 * Knowledge Base Tools
 *
 * Three tools for interacting with the file-based knowledge base:
 * - kb_search: Read collections, manifests, meta, content, index
 * - kb_index: Index new documents into the knowledge base
 * - kb_manage: Manage collections and documents
 */

import { readFile, readdir, stat, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');

function validateKbPath(requestedPath: string): string {
  const normalized = normalize(join(KB_BASE, requestedPath));
  if (!normalized.startsWith(KB_BASE)) {
    throw new Error('Path traversal not allowed');
  }
  return normalized;
}

async function readKbFile(relativePath: string): Promise<string> {
  const fullPath = validateKbPath(relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return readFile(fullPath, 'utf-8');
}

// ============================================
// Tool 1: kb_search
// ============================================

export class KbSearchTool extends LocalTool {
  constructor() {
    super({
      name: 'kb_search',
      description: 'Durchsucht die Knowledge Base. Liest collections.yaml, manifest.yaml, Dokument-Meta, Content oder Index zurück, damit du die relevanten Collections/Dokumente identifizieren kannst.',
      parameters: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['collections', 'manifest', 'meta', 'content', 'index'],
            description: 'Welche Ebene soll gelesen werden: collections (Übersicht), manifest (Collection-Manifest), meta (Dokument-Metadaten), content (Dokumentinhalt), index (Dokumentindex)',
          },
          collection_id: {
            type: 'string',
            description: 'Collection-ID (erforderlich für level=manifest)',
          },
          document_path: {
            type: 'string',
            description: 'Dokumentpfad relativ zu documents/ (erforderlich für level=meta/content/index)',
          },
        },
        required: ['level'],
      },
      category: 'knowledge',
    });
  }

  async execute(args: { level: string; collection_id?: string; document_path?: string }, context?: ToolContext): Promise<string> {
    const { level, collection_id, document_path } = args;

    try {
      switch (level) {
        case 'collections':
          return await readKbFile('collections.yaml');

        case 'manifest':
          if (!collection_id) {
            return 'Error: collection_id ist erforderlich für level=manifest';
          }
          return await readKbFile(`collections/${collection_id}/manifest.yaml`);

        case 'meta':
          if (!document_path || !collection_id) {
            return 'Error: document_path und collection_id sind erforderlich für level=meta';
          }
          return await readKbFile(`collections/${collection_id}/documents/${document_path}/DOCUMENT_META.md`);

        case 'content':
          if (!document_path || !collection_id) {
            return 'Error: document_path und collection_id sind erforderlich für level=content';
          }
          return await readKbFile(`collections/${collection_id}/documents/${document_path}/content.md`);

        case 'index':
          if (!document_path || !collection_id) {
            return 'Error: document_path und collection_id sind erforderlich für level=index';
          }
          return await readKbFile(`collections/${collection_id}/documents/${document_path}/INDEX.md`);

        default:
          return `Error: Unbekanntes Level "${level}". Erlaubt: collections, manifest, meta, content, index`;
      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
}

// ============================================
// Tool 2: kb_index
// ============================================

export class KbIndexTool extends LocalTool {
  constructor() {
    super({
      name: 'kb_index',
      description: 'Indiziert ein neues Dokument in die Knowledge Base. Konvertiert das Dokument zu Markdown, generiert Metadaten und ordnet es einer Collection zu.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Pfad zur Quelldatei (relativ zum incoming-Ordner)',
          },
          collection_id: {
            type: 'string',
            description: 'Ziel-Collection für das Dokument',
          },
          title: {
            type: 'string',
            description: 'Titel des Dokuments (optional, wird sonst aus dem Dateinamen abgeleitet)',
          },
          owner: {
            type: 'string',
            description: 'Verantwortliche Person/Abteilung (optional)',
          },
          confidentiality: {
            type: 'string',
            description: 'Vertraulichkeitsstufe: public, internal, confidential, secret (optional, default: internal)',
          },
        },
        required: ['file_path', 'collection_id'],
      },
      category: 'knowledge',
    });
  }

  async execute(
    args: {
      file_path: string;
      collection_id: string;
      title?: string;
      owner?: string;
      confidentiality?: string;
    },
    context?: ToolContext,
  ): Promise<string> {
    const { file_path, collection_id, title, owner, confidentiality } = args;

    try {
      // Lazy import to avoid circular dependencies
      const { indexerService } = await import('../../services/indexer');

      const result = await indexerService.indexDocument(file_path, collection_id, {
        title,
        owner,
        confidentiality: confidentiality || 'internal',
      });

      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      return `Error beim Indizieren: ${error.message}`;
    }
  }
}

// ============================================
// Tool 3: kb_manage
// ============================================

export class KbManageTool extends LocalTool {
  constructor() {
    super({
      name: 'kb_manage',
      description: 'Verwaltet Collections und Dokumente in der Knowledge Base. Kann Collections erstellen, auflisten und Statistiken anzeigen.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create_collection', 'list_collections', 'collection_stats', 'list_documents'],
            description: 'Verwaltungsaktion',
          },
          collection_id: {
            type: 'string',
            description: 'Collection-ID (für create_collection, collection_stats, list_documents)',
          },
          name: {
            type: 'string',
            description: 'Collection-Name (für create_collection)',
          },
          description: {
            type: 'string',
            description: 'Collection-Beschreibung (für create_collection)',
          },
          activate_when: {
            type: 'string',
            description: 'Komma-getrennte Liste: Bei welchen Themen ist diese Collection relevant (für create_collection)',
          },
          never_activate_when: {
            type: 'string',
            description: 'Komma-getrennte Liste: Bei welchen Themen ist diese Collection NICHT relevant (für create_collection)',
          },
        },
        required: ['action'],
      },
      category: 'knowledge',
    });
  }

  async execute(
    args: {
      action: string;
      collection_id?: string;
      name?: string;
      description?: string;
      activate_when?: string;
      never_activate_when?: string;
    },
    context?: ToolContext,
  ): Promise<string> {
    try {
      switch (args.action) {
        case 'create_collection':
          return await this.createCollection(args);
        case 'list_collections':
          return await this.listCollections();
        case 'collection_stats':
          return await this.collectionStats(args.collection_id);
        case 'list_documents':
          return await this.listDocuments(args.collection_id);
        default:
          return `Error: Unbekannte Aktion "${args.action}"`;
      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  private async createCollection(args: {
    collection_id?: string;
    name?: string;
    description?: string;
    activate_when?: string;
    never_activate_when?: string;
  }): Promise<string> {
    const { collection_id, name, description, activate_when, never_activate_when } = args;

    if (!collection_id || !name) {
      return 'Error: collection_id und name sind erforderlich';
    }

    const collectionDir = validateKbPath(`collections/${collection_id}`);
    if (existsSync(collectionDir)) {
      return `Error: Collection "${collection_id}" existiert bereits`;
    }

    await mkdir(collectionDir, { recursive: true });

    const activateList = activate_when
      ? activate_when.split(',').map((s) => s.trim())
      : [];
    const neverActivateList = never_activate_when
      ? never_activate_when.split(',').map((s) => s.trim())
      : [];

    const manifest = [
      `# Manifest für Collection: ${name}`,
      `collection_id: "${collection_id}"`,
      `collection_name: "${name}"`,
      `description: "${description || ''}"`,
      `last_updated: "${new Date().toISOString()}"`,
      '',
      'documents: []',
    ].join('\n');

    await writeFile(join(collectionDir, 'manifest.yaml'), manifest, 'utf-8');

    // Update collections.yaml
    const collectionsPath = validateKbPath('collections.yaml');
    const collectionsContent = await readFile(collectionsPath, 'utf-8');

    const newEntry = [
      `  - id: "${collection_id}"`,
      `    name: "${name}"`,
      `    description: "${description || ''}"`,
      `    document_count: 0`,
      `    activate_when:`,
      ...activateList.map((a) => `      - "${a}"`),
      ...(neverActivateList.length > 0
        ? [`    never_activate_when:`, ...neverActivateList.map((a) => `      - "${a}"`)]
        : [`    never_activate_when: []`]),
    ].join('\n');

    // Replace empty collections array or append
    let updatedCollections: string;
    if (collectionsContent.includes('collections: []')) {
      updatedCollections = collectionsContent.replace(
        'collections: []',
        `collections:\n${newEntry}`,
      );
    } else {
      updatedCollections = collectionsContent.trimEnd() + '\n' + newEntry + '\n';
    }

    await writeFile(collectionsPath, updatedCollections, 'utf-8');

    return JSON.stringify({
      success: true,
      message: `Collection "${name}" (${collection_id}) wurde erstellt`,
      path: `collections/${collection_id}`,
    });
  }

  private async listCollections(): Promise<string> {
    const content = await readKbFile('collections.yaml');
    return content;
  }

  private async collectionStats(collectionId?: string): Promise<string> {
    if (!collectionId) {
      return 'Error: collection_id ist erforderlich';
    }

    try {
      const manifest = await readKbFile(`collections/${collectionId}/manifest.yaml`);

      // Count documents by parsing manifest
      const docMatches = manifest.match(/document_id:/g);
      const docCount = docMatches ? docMatches.length : 0;

      return JSON.stringify({
        collection_id: collectionId,
        document_count: docCount,
        manifest_preview: manifest.substring(0, 500),
      });
    } catch {
      return `Error: Collection "${collectionId}" nicht gefunden`;
    }
  }

  private async listDocuments(collectionId?: string): Promise<string> {
    if (!collectionId) {
      return 'Error: collection_id ist erforderlich';
    }

    try {
      const manifest = await readKbFile(`collections/${collectionId}/manifest.yaml`);
      return manifest;
    } catch {
      return `Error: Collection "${collectionId}" nicht gefunden`;
    }
  }
}
