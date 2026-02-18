/**
 * Types for Custom API Tools
 */

export interface CustomToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  location: 'path' | 'query' | 'header' | 'body';
  default?: string;
}

export interface CustomToolAuth {
  type: 'none' | 'bearer' | 'api-key' | 'basic';
  /**
   * Location for API key authentication.
   * - 'header': Recommended - API key in HTTP header (secure)
   * - 'query': DEPRECATED - API key in URL query parameter (insecure!)
   *
   * WARNING: Using 'query' exposes API keys in:
   * - Server logs
   * - Proxy logs
   * - Browser history
   * - Referer headers
   *
   * Only use 'query' if the external API absolutely requires it.
   * @default 'header'
   */
  location?: 'header' | 'query';
  keyName?: string;      // Header/query param name for api-key
  envVar?: string;       // Environment variable name for the secret
  value?: string;        // Direct value (not recommended, use envVar)
}

export interface CustomToolConfig {
  id: string;
  name: string;
  description: string;
  category?: string;
  enabled: boolean;

  // API Configuration
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;

  // Parameters
  parameters: CustomToolParameter[];

  // Request body template (for POST/PUT/PATCH)
  bodyTemplate?: string;
  contentType?: 'application/json' | 'application/x-www-form-urlencoded' | 'text/plain';

  // Authentication
  auth: CustomToolAuth;

  // Response handling
  responseType: 'json' | 'text';
  responseTemplate?: string;
  jsonPath?: string;  // Extract specific field from JSON response

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomToolTestRequest {
  toolId: string;
  parameters: Record<string, any>;
}

export interface CustomToolTestResponse {
  success: boolean;
  statusCode?: number;
  response?: any;
  formattedResponse?: string;
  error?: string;
  duration?: number;
}
