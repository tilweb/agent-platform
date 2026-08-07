/**
 * OpenAI API Adapter
 * Handles chat completions for OpenAI-compatible APIs
 */

import type { Message, ToolDefinition, StreamChunk } from '../../llm';
import { safeLog } from '../../../utils/safeLogger';

export interface OpenAIAdapterOptions {
  baseUrl: string;
  apiKey: string | null;
  defaultModel?: string;
}

/**
 * Sanitize a string for safe JSON transmission to LLM APIs.
 * Removes control characters and lone surrogates that can break server-side JSON parsers.
 */
function sanitizeForJson(str: string): string {
  // Remove control characters except \t \n \r
  let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Remove lone surrogates
  clean = clean.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '');
  clean = clean.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  return clean;
}

/**
 * Deep-sanitize all string content in messages before sending to the API.
 */
function sanitizeMessages(messages: Message[]): Message[] {
  return messages.map(msg => {
    const sanitized = { ...msg };

    // Sanitize content
    if (typeof sanitized.content === 'string') {
      sanitized.content = sanitizeForJson(sanitized.content);
    }

    // Sanitize tool_calls arguments
    if (sanitized.tool_calls) {
      sanitized.tool_calls = sanitized.tool_calls.map(tc => ({
        ...tc,
        function: {
          ...tc.function,
          arguments: sanitizeForJson(tc.function.arguments),
        },
      }));
    }

    return sanitized;
  });
}

// Transient errors that should be retried (e.g. vLLM "Already borrowed")
const RETRYABLE_PATTERNS = ['Already borrowed', 'overloaded', 'temporarily unavailable'];
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export class OpenAIAdapter {
  private baseUrl: string;
  private apiKey: string | null;
  private defaultModel: string;

  constructor(options: OpenAIAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel || 'gpt-4o-mini';
  }

  /**
   * Check if an error response is retryable
   */
  private isRetryable(status: number, body: string): boolean {
    if (status === 429 || status === 503) return true;
    if (status === 400) {
      return RETRYABLE_PATTERNS.some(p => body.includes(p));
    }
    return false;
  }

  /**
   * Stream chat completions
   */
  async *streamChat(
    messages: Message[],
    model?: string,
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages: sanitizeMessages(messages),
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Debug logging for tool calling
    if (tools && tools.length > 0) {
      safeLog.info(`[OpenAI Adapter] Streaming request with ${tools.length} tools`, { baseUrl: this.baseUrl });
    }

    const bodyJson = JSON.stringify(body);

    // Retry loop for transient errors
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: bodyJson,
      });

      if (response.ok) break;

      const error = await response.text();

      if (attempt < MAX_RETRIES && this.isRetryable(response.status, error)) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        safeLog.warn(`[OpenAI Adapter] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          errorPreview: error.substring(0, 100),
          delayMs: delay,
        });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Non-retryable or max retries exceeded
      if (response.status === 400) {
        safeLog.error(`[OpenAI Adapter] 400 error`, {
          bodySize: bodyJson.length,
          messageCount: messages.length,
          model: model || this.defaultModel,
        });
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const contentLen = typeof msg.content === 'string' ? msg.content.length : JSON.stringify(msg.content)?.length || 0;
          safeLog.error(`  msg[${i}]`, {
            role: msg.role,
            contentChars: contentLen,
            toolCalls: msg.tool_calls?.length,
            name: msg.name,
          });
        }
      }
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    let loggedToolCall = false;
    let loggedContent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          // Debug: Log first chunk with native tool_calls
          if (!loggedToolCall && json.choices?.[0]?.delta?.tool_calls) {
            safeLog.info(`[OpenAI Adapter] Received native tool_calls`, {
              preview: JSON.stringify(json.choices[0].delta.tool_calls).slice(0, 300),
            });
            loggedToolCall = true;
          }
          // Debug: Log first content chunk that might contain text-based tool calls
          if (!loggedContent && json.choices?.[0]?.delta?.content) {
            const content = json.choices[0].delta.content;
            if (content.includes('[TOOL_CALLS]') || content.includes('"name"') || content.includes('"agent_id"')) {
              safeLog.warn(`[OpenAI Adapter] Text-based tool call detected in content`, {
                preview: content.slice(0, 200),
              });
              loggedContent = true;
            }
          }
          yield json as StreamChunk;
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          yield json as StreamChunk;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    messages: Message[],
    model?: string,
    tools?: ToolDefinition[],
    toolChoice?: unknown,
    params?: {
      /** Sampling-Temperatur. Extraktion setzt 0 (deterministisch); ohne Angabe gilt der Server-Default. */
      temperature?: number;
      /** Obergrenze fuer die Antwortlaenge (Schutz gegen Runaway-Antworten). */
      maxTokens?: number;
      /** Zusaetzliche Body-Felder (z.B. vLLM guided_json). Werte hier ueberschreiben nichts Bestehendes. */
      extraBody?: Record<string, unknown>;
      /** Harter Request-Timeout (AbortSignal). Default 120s — vorher gab es KEINEN Client-Timeout (W9). */
      timeoutMs?: number;
    }
  ): Promise<{
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    finish_reason: string;
  }> {
    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages,
      stream: false,
      ...(params?.extraBody ?? {}),
    };
    if (params?.temperature !== undefined) body.temperature = params.temperature;
    if (params?.maxTokens !== undefined) body.max_tokens = params.maxTokens;

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = toolChoice || 'auto';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const bodyJson = JSON.stringify(body);

    // Retry loop for transient errors. Der AbortSignal-Timeout gilt JE
    // Versuch — ein haengender Endpoint blockiert damit nie laenger als
    // timeoutMs, und der Retry bekommt einen frischen Request. Der
    // Streaming-Pfad bleibt bewusst ohne Abort (lange Chats).
    const timeoutMs = params?.timeoutMs ?? 120_000;
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: bodyJson,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const e = error as { name?: string };
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
          if (attempt < MAX_RETRIES) {
            safeLog.warn(`[OpenAI Adapter] Request-Timeout nach ${Math.round(timeoutMs / 1000)}s (Versuch ${attempt + 1}/${MAX_RETRIES + 1}) — neuer Versuch.`);
            continue;
          }
          throw new Error(`LLM-Request-Timeout nach ${Math.round(timeoutMs / 1000)}s`);
        }
        throw error;
      }

      if (response.ok) break;

      const error = await response.text();

      if (attempt < MAX_RETRIES && this.isRetryable(response.status, error)) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        safeLog.warn(`[OpenAI Adapter] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          errorPreview: error.substring(0, 100),
          delayMs: delay,
        });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    interface ChatResponse {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
    }
    const json = await response.json() as ChatResponse;
    const choice = json.choices[0];

    if (!choice) {
      throw new Error('No response choice returned from API');
    }

    return {
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
      finish_reason: choice.finish_reason,
    };
  }

  /**
   * Generate an embedding vector for a single text via OpenAI-compatible /embeddings endpoint.
   */
  async embed(text: string, model?: string): Promise<number[]> {
    const body = JSON.stringify({
      model: model || this.defaultModel,
      input: text,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers,
        body,
      });
      if (response.ok) break;
      const error = await response.text();
      if (attempt < MAX_RETRIES && this.isRetryable(response.status, error)) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        safeLog.warn(`[OpenAI Adapter] Embed retryable error (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          errorPreview: error.substring(0, 100),
          delayMs: delay,
        });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`OpenAI Embeddings error: ${response.status} - ${error}`);
    }

    interface EmbedResponse {
      data: Array<{ embedding: number[] }>;
      model?: string;
    }
    const json = await response!.json() as EmbedResponse;
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec)) {
      throw new Error('Embeddings response enthält keinen Vektor');
    }
    return vec;
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency_ms?: number;
    models_found?: number;
  }> {
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Try to list models
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers,
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        // Try a simple chat completion instead
        const chatResponse = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.defaultModel,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
          }),
        });

        if (!chatResponse.ok) {
          const error = await chatResponse.text();
          return {
            success: false,
            message: `API error: ${chatResponse.status} - ${error}`,
            latency_ms: latency,
          };
        }

        return {
          success: true,
          message: 'Connection successful (chat endpoint)',
          latency_ms: Date.now() - startTime,
        };
      }

      const json = await response.json() as { data?: unknown[] };
      const modelsCount = json.data?.length || 0;

      return {
        success: true,
        message: `Connection successful`,
        latency_ms: latency,
        models_found: modelsCount,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json() as { data?: Array<{ id: string }> };
      return (json.data || []).map((m) => m.id);
    } catch {
      return [];
    }
  }
}
