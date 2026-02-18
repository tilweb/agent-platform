/**
 * Base class for API-based tools
 */

import type { Tool, ToolDefinition, ToolParameters, ToolContext, ToolMetadata, ApiToolConfig } from '../types';

export interface ApiToolOptions {
  name: string;
  description: string;
  parameters: ToolParameters;
  category?: string;
  config?: ApiToolConfig;
}

export abstract class ApiTool implements Tool {
  readonly name: string;
  readonly type = 'api' as const;

  protected description: string;
  protected parameters: ToolParameters;
  protected category: string;
  protected config: ApiToolConfig;

  constructor(options: ApiToolOptions) {
    this.name = options.name;
    this.description = options.description;
    this.parameters = options.parameters;
    this.category = options.category || 'api';
    this.config = options.config || {};
  }

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  abstract execute(args: Record<string, any>, context?: ToolContext): Promise<string>;

  async isAvailable(): Promise<boolean> {
    // Override in subclass to check API key, connectivity, etc.
    return true;
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      description: this.description,
      type: this.type,
      category: this.category,
    };
  }

  /**
   * Update tool configuration (e.g., API key)
   */
  updateConfig(config: Partial<ApiToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Helper method for making HTTP requests
   */
  protected async fetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...(options.headers as Record<string, string>),
    };

    // Add API key if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const fullUrl = this.config.baseUrl
      ? `${this.config.baseUrl}${url}`
      : url;

    const controller = new AbortController();
    const timeout = this.config.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Helper method for JSON API calls
   */
  protected async fetchJson<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await this.fetch(url, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
