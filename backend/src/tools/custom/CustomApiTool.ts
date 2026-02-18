/**
 * Custom API Tool - Executes REST API calls based on configuration
 */

import type { Tool, ToolDefinition, ToolContext, ToolParameters } from '../types';
import type { CustomToolConfig, CustomToolParameter } from './types';
import { validateUrl, type SSRFProtectionOptions } from '../../utils/ssrfProtection';

export class CustomApiTool implements Tool {
  readonly name: string;
  readonly type = 'api' as const;

  private config: CustomToolConfig;

  constructor(config: CustomToolConfig) {
    this.name = config.id;
    this.config = config;

    // Security warning for deprecated query parameter auth
    if (config.auth.type === 'api-key' && config.auth.location === 'query') {
      console.warn(
        `[SECURITY WARNING] Custom tool "${config.id}" uses API key in query parameters. ` +
        `This exposes the key in server logs, proxy logs, and browser history. ` +
        `Consider migrating to header-based authentication (location: 'header').`
      );
    }
  }

  getDefinition(): ToolDefinition {
    // Build parameters schema from config
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of this.config.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    const parameters: ToolParameters = {
      type: 'object',
      properties,
      required,
    };

    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.config.description,
        parameters,
      },
    };
  }

  async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
    try {
      // Build the request
      const { url, options } = this.buildRequest(args);

      // SSRF Protection: Validate URL before making request
      const ssrfOptions: SSRFProtectionOptions = {
        checkMalwareDomains: process.env.SSRF_CHECK_MALWARE === 'true',
        allowLocalhost: process.env.NODE_ENV === 'development' && process.env.SSRF_ALLOW_LOCALHOST === 'true',
      };

      const validation = await validateUrl(url, ssrfOptions);
      if (!validation.allowed) {
        console.warn(`SSRF Protection: Blocked request to ${url} - ${validation.reason}`);
        return `Error: Request blocked for security reasons. ${validation.reason}`;
      }

      // Execute the request
      const startTime = Date.now();
      const response = await this.executeRequest(url, options);
      const duration = Date.now() - startTime;

      console.log(`Custom tool "${this.name}" executed in ${duration}ms`);

      // Process the response
      return this.processResponse(response, args);
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Check if auth is configured
    if (this.config.auth.type !== 'none') {
      const secret = this.getAuthSecret();
      if (!secret) {
        return false;
      }
    }

    // SSRF Protection: Validate endpoint URL
    // Skip validation for URLs with template placeholders
    const endpoint = this.config.endpoint;
    if (!endpoint.includes('{{') && !endpoint.includes('{')) {
      const validation = await validateUrl(endpoint, {
        allowLocalhost: process.env.NODE_ENV === 'development',
      });
      if (!validation.allowed) {
        console.warn(`Custom tool "${this.name}" has blocked endpoint: ${validation.reason}`);
        return false;
      }
    }

    return true;
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.config.description,
      type: this.type,
      category: this.config.category || 'custom',
    };
  }

  /**
   * Get the full config (for editing)
   */
  getConfig(): CustomToolConfig {
    return this.config;
  }

  /**
   * Update the configuration
   */
  updateConfig(config: CustomToolConfig): void {
    this.config = config;
  }

  /**
   * Build the HTTP request from configuration and arguments
   */
  private buildRequest(args: Record<string, any>): { url: string; options: RequestInit } {
    let url = this.config.endpoint;
    const queryParams: Record<string, string> = {};
    const headers: Record<string, string> = {
      ...this.config.headers,
    };
    let body: string | undefined;

    // Process parameters
    for (const param of this.config.parameters) {
      const value = args[param.name] ?? param.default;

      if (value === undefined) {
        if (param.required) {
          throw new Error(`Missing required parameter: ${param.name}`);
        }
        continue;
      }

      const stringValue = String(value);

      switch (param.location) {
        case 'path':
          url = url.replace(`{{${param.name}}}`, encodeURIComponent(stringValue));
          url = url.replace(`{${param.name}}`, encodeURIComponent(stringValue));
          break;
        case 'query':
          queryParams[param.name] = stringValue;
          break;
        case 'header':
          headers[param.name] = stringValue;
          break;
        case 'body':
          // Body parameters are handled separately
          break;
      }
    }

    // Add query parameters to URL
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Build request body
    if (['POST', 'PUT', 'PATCH'].includes(this.config.method)) {
      if (this.config.bodyTemplate) {
        body = this.interpolateTemplate(this.config.bodyTemplate, args);
      } else {
        // Build body from body-located parameters
        const bodyParams: Record<string, any> = {};
        for (const param of this.config.parameters) {
          if (param.location === 'body' && args[param.name] !== undefined) {
            bodyParams[param.name] = args[param.name];
          }
        }
        if (Object.keys(bodyParams).length > 0) {
          body = JSON.stringify(bodyParams);
        }
      }

      // Set content type
      if (body) {
        headers['Content-Type'] = this.config.contentType || 'application/json';
      }
    }

    // Add authentication
    this.addAuth(headers, queryParams, url);

    // Rebuild URL if auth added query params
    if (this.config.auth.type === 'api-key' && this.config.auth.location === 'query') {
      const finalQueryString = new URLSearchParams(queryParams).toString();
      const baseUrl = url.split('?')[0] || url;
      url = finalQueryString ? `${baseUrl}?${finalQueryString}` : baseUrl;
    }

    const options: RequestInit = {
      method: this.config.method,
      headers,
    };

    if (body) {
      options.body = body;
    }

    return { url, options };
  }

  /**
   * Add authentication to the request
   */
  private addAuth(
    headers: Record<string, string>,
    queryParams: Record<string, string>,
    url: string
  ): void {
    const { auth } = this.config;

    if (auth.type === 'none') {
      return;
    }

    const secret = this.getAuthSecret();
    if (!secret) {
      throw new Error('Authentication secret not configured');
    }

    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${secret}`;
        break;

      case 'api-key':
        const keyName = auth.keyName || 'api_key';
        if (auth.location === 'query') {
          queryParams[keyName] = secret;
        } else {
          headers[keyName] = secret;
        }
        break;

      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`;
        break;
    }
  }

  /**
   * Get the authentication secret from environment or config
   */
  private getAuthSecret(): string | undefined {
    const { auth } = this.config;

    if (auth.envVar) {
      return process.env[auth.envVar];
    }

    return auth.value;
  }

  /**
   * Execute the HTTP request
   */
  private async executeRequest(url: string, options: RequestInit): Promise<Response> {
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Process the API response
   */
  private async processResponse(response: Response, args: Record<string, any>): Promise<string> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return `API Error (${response.status}): ${errorText}`;
    }

    let data: any;

    if (this.config.responseType === 'json') {
      try {
        data = await response.json();
      } catch (e) {
        return `Error parsing JSON response: ${e}`;
      }

      // Extract specific field if jsonPath is set
      if (this.config.jsonPath) {
        data = this.extractJsonPath(data, this.config.jsonPath);
      }
    } else {
      data = await response.text();
    }

    // Apply response template if set
    if (this.config.responseTemplate) {
      return this.interpolateTemplate(this.config.responseTemplate, {
        ...args,
        response: data,
        ...this.flattenObject(data),
      });
    }

    // Return formatted data
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }

    return String(data);
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.extractJsonPath(data, path.trim());
      if (value === undefined) {
        return match; // Keep original if not found
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }

  /**
   * Extract value from object using dot notation path
   */
  private extractJsonPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indexing
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
        current = current[arrayMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(arrayMatch[2])];
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Flatten an object for template interpolation
   */
  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};

    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return result;
    }

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }
}
