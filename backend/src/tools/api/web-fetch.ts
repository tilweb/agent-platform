/**
 * Web Fetch Tool - Fetch and read web pages
 *
 * Fetches a URL, converts HTML to readable text, and returns
 * the content truncated to a configurable length.
 * Includes SSRF protection to prevent access to internal networks.
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext } from '../types';
import { validateUrl } from '../../utils/ssrfProtection';

const DEFAULT_MAX_LENGTH = 15000;
const ABSOLUTE_MAX_LENGTH = 30000;
const FETCH_TIMEOUT = 15000;

/**
 * Decode common HTML entities
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Convert HTML to readable plain text
 */
function htmlToText(html: string): string {
  let text = html;

  // Remove script, style, nav, footer, header blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // Convert links: <a href="url">text</a> → [text](url)
  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Convert paragraphs and block elements to newlines
  text = text.replace(/<\/?(p|div|article|section|main|blockquote|pre|ul|ol|dl|table|tr)[^>]*>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(td|th)[^>]*>/gi, ' | ');

  // Bold and italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeEntities(text);

  // Remove control characters (keep \t \n \r)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove lone surrogates (invalid Unicode that breaks JSON parsers)
  text = text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '');
  text = text.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');           // collapse horizontal whitespace
  text = text.replace(/\n[ \t]+/g, '\n');         // trim line starts
  text = text.replace(/[ \t]+\n/g, '\n');         // trim line ends
  text = text.replace(/\n{3,}/g, '\n\n');         // max 2 consecutive newlines
  text = text.trim();

  return text;
}

export class WebFetchTool extends ApiTool {
  constructor() {
    super({
      name: 'web_fetch',
      description: 'Fetch a web page and return its content as readable text. Use this to read the full content of a URL found via web_search.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the web page to fetch',
          },
          max_length: {
            type: 'number',
            description: `Maximum character length of returned content (default: ${DEFAULT_MAX_LENGTH}, max: ${ABSOLUTE_MAX_LENGTH})`,
          },
        },
        required: ['url'],
      },
      category: 'search',
    });
  }

  async execute(
    args: { url: string; max_length?: number },
    context?: ToolContext
  ): Promise<string> {
    const { url } = args;
    const maxLength = Math.min(
      Math.max(args.max_length || DEFAULT_MAX_LENGTH, 1000),
      ABSOLUTE_MAX_LENGTH
    );

    if (!url) {
      return 'Error: url is required';
    }

    // SSRF protection
    const validation = await validateUrl(url);
    if (!validation.allowed) {
      return `Error: URL blocked - ${validation.reason}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentPlatform/1.0; +https://github.com)',
          'Accept': 'text/html,application/xhtml+xml,text/plain,application/json',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';

      // Reject binary content
      if (contentType.match(/^(image|audio|video|application\/octet-stream|application\/pdf|application\/zip)/i)) {
        return `Error: Cannot read binary content (${contentType})`;
      }

      const rawText = await response.text();

      // Convert HTML to text, or return as-is for plain text / JSON
      let content: string;
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        content = htmlToText(rawText);
      } else if (contentType.includes('application/json')) {
        // Pretty-print JSON for readability
        try {
          content = JSON.stringify(JSON.parse(rawText), null, 2);
        } catch {
          content = rawText;
        }
      } else {
        content = rawText;
      }

      // Truncate if needed
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n[... Content truncated at ' + maxLength + ' characters]';
      }

      const header = `Source: ${url}\nLength: ${content.length} characters\n\n`;
      return header + content;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return `Error: Request timed out after ${FETCH_TIMEOUT / 1000}s`;
      }
      return `Error fetching URL: ${error.message}`;
    }
  }

  override async isAvailable(): Promise<boolean> {
    return true;
  }
}

export const createWebFetchTool = () => new WebFetchTool();
