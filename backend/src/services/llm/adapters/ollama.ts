/**
 * Ollama API Adapter
 * Handles chat completions for Ollama's native API
 * Converts Ollama format to OpenAI-compatible format for consistency
 */

import type { Message, ToolDefinition, StreamChunk } from '../../llm';

export interface OllamaAdapterOptions {
  baseUrl: string;
  defaultModel?: string;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaAdapter {
  private baseUrl: string;
  private defaultModel: string;

  constructor(options: OllamaAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.defaultModel = options.defaultModel || 'llama3.2';
  }

  /**
   * Convert OpenAI-style messages to Ollama format
   */
  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages
      .filter((m) => m.role !== 'tool') // Ollama doesn't support tool messages
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : '';
        return {
          role: m.role === 'tool' ? 'assistant' : m.role,
          content,
        } as OllamaMessage;
      });
  }

  /**
   * Convert Ollama stream chunk to OpenAI format
   */
  private convertChunk(
    chunk: OllamaStreamChunk,
    index: number
  ): StreamChunk {
    return {
      id: `chatcmpl-ollama-${index}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: chunk.model,
      choices: [
        {
          index: 0,
          delta: {
            role: index === 0 ? 'assistant' : undefined,
            content: chunk.message.content || null,
          },
          finish_reason: chunk.done ? (chunk.done_reason || 'stop') : null,
        },
      ],
    };
  }

  /**
   * Stream chat completions
   */
  async *streamChat(
    messages: Message[],
    model?: string,
    _tools?: ToolDefinition[] // Ollama has limited tool support
  ): AsyncGenerator<StreamChunk> {
    const ollamaMessages = this.convertMessages(messages);

    const body = {
      model: model || this.defaultModel,
      messages: ollamaMessages,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let chunkIndex = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const json = JSON.parse(trimmed) as OllamaStreamChunk;
          yield this.convertChunk(json, chunkIndex++);
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim()) as OllamaStreamChunk;
        yield this.convertChunk(json, chunkIndex);
      } catch {
        // Skip invalid JSON
      }
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    messages: Message[],
    model?: string
  ): Promise<{
    content: string | null;
    finish_reason: string;
  }> {
    const ollamaMessages = this.convertMessages(messages);

    const body = {
      model: model || this.defaultModel,
      messages: ollamaMessages,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const json = await response.json() as { message?: { content?: string }; done_reason?: string };

    return {
      content: json.message?.content || null,
      finish_reason: json.done_reason || 'stop',
    };
  }

  /**
   * Test connection to Ollama
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency_ms?: number;
    models_found?: number;
  }> {
    const startTime = Date.now();

    try {
      // Try to list models
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          message: `Ollama API error: ${response.status}`,
          latency_ms: latency,
        };
      }

      const json = await response.json() as { models?: unknown[] };
      const modelsCount = json.models?.length || 0;

      return {
        success: true,
        message: modelsCount > 0
          ? `Connected (${modelsCount} model${modelsCount > 1 ? 's' : ''} available)`
          : 'Connected (no models installed)',
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
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const json = await response.json() as { models?: Array<{ name: string }> };
      return (json.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Pull a model from Ollama library
   */
  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to pull model: ${error}`);
    }

    // Wait for the pull to complete (streaming response)
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  }

  /**
   * Generate embeddings
   */
  async embed(
    text: string,
    model?: string
  ): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embeddings error: ${error}`);
    }

    const json = await response.json() as { embedding: number[] };
    return json.embedding;
  }
}
