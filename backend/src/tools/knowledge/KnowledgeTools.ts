/**
 * Knowledge Base Tools
 *
 * Three tools for interacting with the file-based knowledge base:
 * - kb_search: Read collections, manifests, meta, content, index
 * - kb_index: Index new documents into the knowledge base
 * - kb_manage: Manage collections and documents
 */

import { LocalTool } from '../base/LocalTool';
import type { ToolContext } from '../types';
import * as kb from '../../services/kbStorage';
import { canView, listAccessibleResources } from '../../rbac/accessControl';
import * as yaml from 'yaml';

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

    // Security: ohne userId-Kontext duerfen wir KB-Inhalte nicht ausliefern.
    // Tool wird ueblicherweise aus einem Agent-Loop gerufen, der die userId
    // aus der HTTP-Session uebernimmt.
    const userId = context?.userId;
    if (!userId) {
      return 'Error: Kein User-Kontext — Knowledge-Base-Zugriff verweigert.';
    }

    try {
      switch (level) {
        case 'collections': {
          // Nur Collections, die der User sehen darf (Platform-Admin sieht alle).
          const all = await kb.listCollections();
          const accessible = await listAccessibleResources(
            userId,
            'collection',
            all.map(c => c.id),
          );
          const allowedIds = new Set(accessible.map(a => a.resourceId));
          const filtered = all.filter(c => allowedIds.has(c.id));
          return yaml.stringify({
            collections: filtered.map(c => ({
              id: c.id,
              name: c.name,
              description: c.description ?? '',
              activate_when: c.activate_when ?? [],
              never_activate_when: c.never_activate_when ?? [],
            })),
          }, { lineWidth: 0 });
        }

        case 'manifest': {
          if (!collection_id) return 'Error: collection_id ist erforderlich für level=manifest';
          const access = await canView(userId, 'collection', collection_id);
          if (!access.allowed) return `Error: Zugriff auf Collection "${collection_id}" verweigert.`;
          return await kb.manifestAsYaml(collection_id);
        }

        case 'meta': {
          if (!document_path || !collection_id) return 'Error: document_path und collection_id sind erforderlich für level=meta';
          const access = await canView(userId, 'collection', collection_id);
          if (!access.allowed) return `Error: Zugriff auf Collection "${collection_id}" verweigert.`;
          const doc = await kb.getDocument(collection_id, document_path);
          if (!doc) return `Error: Dokument "${collection_id}/${document_path}" nicht gefunden`;
          return doc.metaMd ?? `# DOCUMENT_META\n(Keine Metadaten verfügbar)\n`;
        }

        case 'content': {
          if (!document_path || !collection_id) return 'Error: document_path und collection_id sind erforderlich für level=content';
          const access = await canView(userId, 'collection', collection_id);
          if (!access.allowed) return `Error: Zugriff auf Collection "${collection_id}" verweigert.`;
          const content = await kb.getDocumentContent(collection_id, document_path);
          if (content === null) return `Error: Content für "${collection_id}/${document_path}" nicht gefunden`;
          return content;
        }

        case 'index': {
          if (!document_path || !collection_id) return 'Error: document_path und collection_id sind erforderlich für level=index';
          const access = await canView(userId, 'collection', collection_id);
          if (!access.allowed) return `Error: Zugriff auf Collection "${collection_id}" verweigert.`;
          const idx = await kb.getDocumentIndex(collection_id, document_path);
          if (idx === null) return `Error: Kein Index für "${collection_id}/${document_path}" verfügbar`;
          return idx;
        }

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
    // Security: ohne userId-Kontext kein Zugriff.
    const userId = context?.userId;
    if (!userId) {
      return 'Error: Kein User-Kontext — Knowledge-Base-Zugriff verweigert.';
    }

    try {
      switch (args.action) {
        case 'create_collection':
          return await this.createCollection(args);
        case 'list_collections':
          return await this.listCollections(userId);
        case 'collection_stats':
          return await this.collectionStats(userId, args.collection_id);
        case 'list_documents':
          return await this.listDocuments(userId, args.collection_id);
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
    if (!collection_id || !name) return 'Error: collection_id und name sind erforderlich';
    const existing = await kb.getCollection(collection_id);
    if (existing) return `Error: Collection "${collection_id}" existiert bereits`;
    const activateList = activate_when ? activate_when.split(',').map(s => s.trim()).filter(Boolean) : [];
    const neverActivateList = never_activate_when ? never_activate_when.split(',').map(s => s.trim()).filter(Boolean) : [];
    await kb.createCollection({
      id: collection_id,
      name,
      description,
      activate_when: activateList,
      never_activate_when: neverActivateList,
    });
    return JSON.stringify({
      success: true,
      message: `Collection "${name}" (${collection_id}) wurde erstellt`,
      path: `collections/${collection_id}`,
    });
  }

  private async listCollections(userId: string): Promise<string> {
    const all = await kb.listCollections();
    const accessible = await listAccessibleResources(
      userId,
      'collection',
      all.map(c => c.id),
    );
    const allowedIds = new Set(accessible.map(a => a.resourceId));
    const filtered = all.filter(c => allowedIds.has(c.id));
    return yaml.stringify({
      collections: filtered.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description ?? '',
        activate_when: c.activate_when ?? [],
        never_activate_when: c.never_activate_when ?? [],
      })),
    }, { lineWidth: 0 });
  }

  private async collectionStats(userId: string, collectionId?: string): Promise<string> {
    if (!collectionId) return 'Error: collection_id ist erforderlich';
    const access = await canView(userId, 'collection', collectionId);
    if (!access.allowed) return `Error: Zugriff auf Collection "${collectionId}" verweigert.`;
    const collection = await kb.getCollection(collectionId);
    if (!collection) return `Error: Collection "${collectionId}" nicht gefunden`;
    const docs = await kb.listDocuments(collectionId);
    return JSON.stringify({
      collection_id: collectionId,
      document_count: docs.length,
      manifest_preview: (await kb.manifestAsYaml(collectionId)).substring(0, 500),
    });
  }

  private async listDocuments(userId: string, collectionId?: string): Promise<string> {
    if (!collectionId) return 'Error: collection_id ist erforderlich';
    const access = await canView(userId, 'collection', collectionId);
    if (!access.allowed) return `Error: Zugriff auf Collection "${collectionId}" verweigert.`;
    const collection = await kb.getCollection(collectionId);
    if (!collection) return `Error: Collection "${collectionId}" nicht gefunden`;
    return kb.manifestAsYaml(collectionId);
  }
}
