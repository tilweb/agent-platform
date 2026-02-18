/**
 * Brave Search Tool - Search the web using Brave Search API
 *
 * Get your API key at: https://brave.com/search/api/
 * Free tier: 2,000 queries/month
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext, ApiToolConfig } from '../types';

export interface BraveSearchConfig extends ApiToolConfig {
  apiKey?: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  query: {
    original: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
}

export class BraveSearchTool extends ApiTool {
  constructor(config?: BraveSearchConfig) {
    super({
      name: 'brave_search',
      description: 'Search the web using Brave Search. Use this tool to find current information from the internet that may not be in your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          count: {
            type: 'string',
            description: 'Number of results to return (default: 5, max: 20)',
          },
          language: {
            type: 'string',
            description: 'Language code for search results (e.g., "de", "en"). Default: "de"',
          },
        },
        required: ['query'],
      },
      category: 'search',
      config: {
        ...config,
        baseUrl: 'https://api.search.brave.com',
        timeout: 10000,
      },
    });
  }

  async execute(
    args: { query: string; count?: string; language?: string },
    context?: ToolContext
  ): Promise<string> {
    const { query, count, language } = args;
    const numResults = Math.min(parseInt(count || '5'), 20);
    const searchLang = language || 'de';

    if (!query) {
      return 'Error: query is required';
    }

    if (!this.config.apiKey) {
      return 'Error: Brave Search is not configured. Please set the BRAVE_API_KEY environment variable.';
    }

    try {
      const params = new URLSearchParams({
        q: query,
        count: String(numResults),
        search_lang: searchLang,
        text_decorations: 'false',
      });

      const response = await this.fetch(`/res/v1/web/search?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `Error: Brave Search API returned ${response.status}: ${errorText}`;
      }

      const data = await response.json() as BraveSearchResponse;

      if (!data.web?.results || data.web.results.length === 0) {
        return `No results found for "${query}"`;
      }

      // Format results for the LLM
      const results = data.web.results.slice(0, numResults);
      const formatted = results.map((r, i) => {
        let entry = `${i + 1}. ${r.title}\n   ${r.description}`;
        if (r.age) {
          entry += ` (${r.age})`;
        }
        entry += `\n   URL: ${r.url}`;
        return entry;
      }).join('\n\n');

      return `Search results for "${query}":\n\n${formatted}`;
    } catch (error: any) {
      return `Error searching: ${error.message}`;
    }
  }

  override async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }
}

// Export factory function
export const createBraveSearchTool = (config?: BraveSearchConfig) => new BraveSearchTool(config);
