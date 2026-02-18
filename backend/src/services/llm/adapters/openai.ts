/**
 * OpenAI API Adapter
 * Handles chat completions for OpenAI-compatible APIs
 */

import type { Message, ToolDefinition, StreamChunk } from '../../llm';

export interface OpenAIAdapterOptions {
  baseUrl: string;
  apiKey: string | null;
  defaultModel?: string;
}

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
   * Stream chat completions
   */
  async *streamChat(
    messages: Message[],
    model?: string,
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages,
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
      console.log(`[OpenAI Adapter] Streaming request with ${tools.length} tools to ${this.baseUrl}`);
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
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
            console.log(`[OpenAI Adapter] ✅ Received native tool_calls:`, JSON.stringify(json.choices[0].delta.tool_calls).slice(0, 300));
            loggedToolCall = true;
          }
          // Debug: Log first content chunk that might contain text-based tool calls
          if (!loggedContent && json.choices?.[0]?.delta?.content) {
            const content = json.choices[0].delta.content;
            if (content.includes('[TOOL_CALLS]') || content.includes('"name"') || content.includes('"agent_id"')) {
              console.log(`[OpenAI Adapter] ⚠️ Text-based tool call detected in content:`, content.slice(0, 200));
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
    tools?: ToolDefinition[]
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
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
