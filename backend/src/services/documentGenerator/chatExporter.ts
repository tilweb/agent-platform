/**
 * Chat Exporter Service
 * Converts ChatHistory to DocumentData for export in various formats
 */

import type { ChatHistory, ChatMaterial } from '../memory';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent } from './types';

// ============== Interfaces ==============

export interface ChatExportOptions {
  scope: 'full' | 'last_response' | 'materials_only';
  includeMetadata?: boolean;
  includeMaterials?: boolean;
}

// ============== Markdown Parsing Helpers ==============

/**
 * Extract markdown tables from content
 * Pattern: | Header | Header |
 *          |--------|--------|
 *          | Cell   | Cell   |
 */
export function extractTablesFromMarkdown(content: string): TableContent[] {
  const tables: TableContent[] = [];
  const lines = content.split('\n');

  let inTable = false;
  let currentTable: { headers: string[]; rows: string[][] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();

    // Check if line is a table row (starts and ends with |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .slice(1, -1) // Remove leading and trailing |
        .split('|')
        .map(cell => cell.trim());

      // Check if this is a separator row (|---|---|)
      const isSeparator = cells.every(cell => /^[-:]+$/.test(cell));

      if (isSeparator && currentTable) {
        // This confirms the previous row was headers
        inTable = true;
        continue;
      }

      if (!inTable && !currentTable) {
        // This might be a header row
        currentTable = { headers: cells, rows: [] };
      } else if (inTable && currentTable) {
        // This is a data row
        currentTable.rows.push(cells);
      }
    } else {
      // End of table
      if (inTable && currentTable && currentTable.rows.length > 0) {
        tables.push({
          headers: currentTable.headers,
          rows: currentTable.rows,
        });
      }
      inTable = false;
      currentTable = null;
    }
  }

  // Handle table at end of content
  if (inTable && currentTable && currentTable.rows.length > 0) {
    tables.push({
      headers: currentTable.headers,
      rows: currentTable.rows,
    });
  }

  return tables;
}

/**
 * Extract lists from markdown content
 * Supports both unordered (- item) and ordered (1. item) lists
 */
export function extractListsFromMarkdown(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list: - item or * item
    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      items.push(unorderedMatch[1] ?? '');
      continue;
    }

    // Ordered list: 1. item
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      items.push(orderedMatch[1] ?? '');
    }
  }

  return items;
}

/**
 * Extract code blocks from markdown
 * Returns array of { language, code } objects
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: (match[2] ?? '').trim(),
    });
  }

  return blocks;
}

/**
 * Remove markdown tables from content (to get clean text)
 */
function removeTablesFromContent(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inTable = false;
  let possibleHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      const isSeparator = cells.every(cell => /^[-:]+$/.test(cell));

      if (isSeparator) {
        inTable = true;
        // Remove the header line we might have added
        if (possibleHeader && result.length > 0) {
          result.pop();
        }
        possibleHeader = false;
        continue;
      }

      if (inTable) {
        continue;
      }

      possibleHeader = true;
      result.push(line);
    } else {
      inTable = false;
      possibleHeader = false;
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

/**
 * Remove code blocks from content
 */
function removeCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').trim();
}

// ============== Main Mapping Function ==============

/**
 * Maps a ChatHistory to DocumentData structure
 */
export function mapChatToDocument(
  chat: ChatHistory,
  options: ChatExportOptions = { scope: 'full' }
): DocumentData {
  const sections: DocumentSection[] = [];
  const { scope, includeMetadata = true, includeMaterials = true } = options;

  // Section: Conversation Details (Metadata)
  if (includeMetadata) {
    const metadata: { key: string; value: string }[] = [
      { key: 'Titel', value: chat.title || 'Unbenannt' },
      { key: 'Erstellt', value: formatDate(chat.createdAt) },
      { key: 'Aktualisiert', value: formatDate(chat.updatedAt) },
      { key: 'Nachrichten', value: String(chat.messages.length) },
    ];

    if (chat.summary) {
      metadata.push({ key: 'Zusammenfassung', value: chat.summary });
    }

    if (chat.keywords && chat.keywords.length > 0) {
      metadata.push({ key: 'Schlagworte', value: chat.keywords.join(', ') });
    }

    sections.push({
      title: 'Konversationsdetails',
      type: 'keyvalue',
      content: { items: metadata } as KeyValueContent,
    });
  }

  // Determine which messages to include
  let messagesToInclude = chat.messages;

  if (scope === 'last_response') {
    // Find the last assistant message and include it with the preceding user message
    const lastAssistantIndex = chat.messages.findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIndex >= 0) {
      const prevMsg = lastAssistantIndex > 0 ? chat.messages[lastAssistantIndex - 1] : undefined;
      const startIndex = prevMsg?.role === 'user'
        ? lastAssistantIndex - 1
        : lastAssistantIndex;
      messagesToInclude = chat.messages.slice(startIndex, lastAssistantIndex + 1);
    }
  } else if (scope === 'materials_only') {
    // Don't include messages, only materials
    messagesToInclude = [];
  }

  // Section: Messages
  if (messagesToInclude.length > 0) {
    for (let i = 0; i < messagesToInclude.length; i++) {
      const msg = messagesToInclude[i];
      if (!msg) continue;
      const roleLabel = msg.role === 'user' ? 'Benutzer' : 'Assistent';
      const content = msg.content || '';

      // Check for embedded tables in assistant messages
      if (msg.role === 'assistant') {
        const tables = extractTablesFromMarkdown(content);
        const cleanContent = removeTablesFromContent(content);
        const cleanerContent = removeCodeBlocks(cleanContent);

        // Add main text content first (if any)
        if (cleanerContent.trim()) {
          sections.push({
            title: `${roleLabel} (${i + 1})`,
            type: 'text',
            content: cleanerContent,
          });
        }

        // Add any tables found
        for (let j = 0; j < tables.length; j++) {
          sections.push({
            title: tables.length > 1 ? `Tabelle ${j + 1}` : 'Tabelle',
            type: 'table',
            content: tables[j],
          });
        }

        // Add code blocks as separate text sections
        const codeBlocks = extractCodeBlocks(content);
        for (const block of codeBlocks) {
          sections.push({
            title: `Code (${block.language})`,
            type: 'text',
            content: block.code,
          });
        }
      } else {
        // User messages as simple text
        sections.push({
          title: `${roleLabel} (${i + 1})`,
          type: 'text',
          content: content,
        });
      }
    }
  }

  // Section: Materials
  if (includeMaterials && chat.materials && chat.materials.length > 0) {
    sections.push({
      title: 'Materialien',
      type: 'text',
      content: `${chat.materials.length} Material(ien) in dieser Konversation gesammelt.`,
    });

    for (const material of chat.materials) {
      const materialSection = mapMaterialToSection(material);
      sections.push(materialSection);
    }
  }

  return {
    title: `Chat: ${chat.title || 'Unbenannte Konversation'}`,
    metadata: {
      Erstellt: formatDate(chat.createdAt),
      Exportiert: formatDate(new Date().toISOString()),
      Nachrichten: String(chat.messages.length),
    },
    sections,
  };
}

/**
 * Map a ChatMaterial to a DocumentSection
 */
function mapMaterialToSection(material: ChatMaterial): DocumentSection {
  const typeLabels: Record<string, string> = {
    upload: 'Hochgeladen',
    transcript: 'Transkription',
    skill_result: 'Skill-Ergebnis',
    user_marked: 'Markiert',
  };

  const typeLabel = typeLabels[material.type] || material.type;

  // Try to extract tables from material content
  const tables = extractTablesFromMarkdown(material.content);

  if (tables.length > 0) {
    // If material contains a table, use table format
    return {
      title: `${material.title} (${typeLabel})`,
      type: 'table',
      content: tables[0], // Use first table
    };
  }

  // Otherwise use text format
  return {
    title: `${material.title} (${typeLabel})`,
    type: 'text',
    content: material.content,
  };
}

// ============== Helper Functions ==============

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Create a safe filename from a chat title
 */
export function createSafeFilename(title: string, chatId: string): string {
  const safeTitle = title
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return `${safeTitle}_${chatId.slice(-8)}`;
}
