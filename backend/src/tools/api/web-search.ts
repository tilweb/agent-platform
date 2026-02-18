/**
 * Web Search Tool - Search the web using an API
 *
 * This is an example API tool. To use it, you need to:
 * 1. Get an API key from a search provider (e.g., Tavily, Serper, SerpAPI)
 * 2. Configure the API key in tools.config.ts
 *
 * Example providers:
 * - Tavily: https://tavily.com (recommended for AI applications)
 * - Serper: https://serper.dev
 * - SerpAPI: https://serpapi.com
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext, ApiToolConfig } from '../types';

export interface WebSearchConfig extends ApiToolConfig {
  provider?: 'tavily' | 'serper' | 'serpapi';
}

export class WebSearchTool extends ApiTool {
  private provider: string;

  constructor(config?: WebSearchConfig) {
    super({
      name: 'web_search',
      description: 'Search the web for current information. Use this when you need up-to-date information that may not be in your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          num_results: {
            type: 'string',
            description: 'Number of results to return (default: 5, max: 10)',
          },
        },
        required: ['query'],
      },
      category: 'search',
      config,
    });

    this.provider = config?.provider || 'tavily';
  }

  async execute(
    args: { query: string; num_results?: string },
    context?: ToolContext
  ): Promise<string> {
    const { query, num_results } = args;
    const limit = Math.min(parseInt(num_results || '5'), 10);

    if (!query) {
      return 'Error: query is required';
    }

    if (!this.config.apiKey) {
      return 'Error: Web search is not configured. Please add an API key for a search provider.';
    }

    try {
      switch (this.provider) {
        case 'tavily':
          return await this.searchTavily(query, limit);
        case 'serper':
          return await this.searchSerper(query, limit);
        default:
          return `Error: Unknown search provider: ${this.provider}`;
      }
    } catch (error: any) {
      return `Error searching: ${error.message}`;
    }
  }

  private async searchTavily(query: string, limit: number): Promise<string> {
    const response = await this.fetchJson<any>('https://api.tavily.com/search', {
      method: 'POST',
      body: JSON.stringify({
        api_key: this.config.apiKey,
        query,
        max_results: limit,
        include_answer: true,
      }),
    });

    if (response.answer) {
      let result = `Answer: ${response.answer}\n\nSources:\n`;
      for (const r of response.results || []) {
        result += `- ${r.title}: ${r.url}\n`;
      }
      return result;
    }

    return response.results
      ?.map((r: any) => `${r.title}\n${r.content}\nURL: ${r.url}`)
      .join('\n\n') || 'No results found';
  }

  private async searchSerper(query: string, limit: number): Promise<string> {
    const response = await this.fetchJson<any>('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.config.apiKey!,
      },
      body: JSON.stringify({
        q: query,
        num: limit,
      }),
    });

    const results = response.organic || [];
    return results
      .map((r: any) => `${r.title}\n${r.snippet}\nURL: ${r.link}`)
      .join('\n\n') || 'No results found';
  }

  override async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }
}

// Export factory function for easy instantiation with config
export const createWebSearchTool = (config?: WebSearchConfig) => new WebSearchTool(config);
