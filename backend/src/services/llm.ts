/**
 * LLM Service
 * Multi-provider chat completion service with streaming support
 */

import { resolveActiveModel, resolveModel, clearConfigCache } from './providers';
import type { ResolvedModel } from '../types/providers';
import { OpenAIAdapter } from './llm/adapters/openai';
import { OllamaAdapter } from './llm/adapters/ollama';
import { usageTrackingService, type UsageContext } from './usageTracking';

/**
 * Options for per-request model override
 */
export interface ChatOptions {
  /** Override the default model with a specific provider/model combination */
  modelOverride?: { providerId: string; modelId: string };
  /** User ID for resolving user-specific model preferences */
  userId?: string;
  /** Override tool_choice (default: 'auto'). Use object for forced function calling. */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

// Content part types for multimodal messages (text + images)
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';  // OpenAI format
  image_url: {
    url: string;  // Can be data:image/png;base64,... or https://...
    detail?: 'low' | 'high' | 'auto';
  };
}

export type ContentPart = TextContentPart | ImageContentPart;

// Message content can be string (text-only) or array (multimodal with images)
export type MessageContent = string | ContentPart[] | null;

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// Helper to create image content part from base64 data
export function createImageContent(base64Data: string, mimeType: string): ImageContentPart {
  // If base64Data already includes the data: prefix, use it directly
  const url = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType};base64,${base64Data}`;

  return {
    type: 'image_url',
    image_url: {
      url,
      detail: 'auto',
    },
  };
}

// Helper to create multimodal message with text and images
export function createMultimodalContent(text: string, images: Array<{ base64: string; mimeType: string }>): ContentPart[] {
  const parts: ContentPart[] = [];

  // Add text first
  if (text) {
    parts.push({ type: 'text', text });
  }

  // Add images
  for (const img of images) {
    parts.push(createImageContent(img.base64, img.mimeType));
  }

  return parts;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      // Reasoning content from thinking models (e.g., Qwen3-thinking, DeepSeek-R1)
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export class LLMService {
  private resolvedModel: ResolvedModel | null = null;
  private openaiAdapter: OpenAIAdapter | null = null;
  private ollamaAdapter: OllamaAdapter | null = null;

  constructor() {
    // Initialization is deferred to first use
  }

  /**
   * Initialize the service with the active chat model
   */
  async initialize(): Promise<void> {
    this.resolvedModel = await resolveActiveModel('chat');

    if (!this.resolvedModel) {
      // Fallback to environment variables for backwards compatibility
      const apiUrl = process.env.ADACOR_AI_API_URL || 'https://api.adacor.cloud/v1';
      const apiKey = process.env.ADACOR_AI_API_KEY || '';
      const model = process.env.ADACOR_AI_MODEL || 'gpt-4o-mini';

      if (!apiKey) {
        console.warn('Warning: No active chat model configured and ADACOR_AI_API_KEY not set');
      }

      this.openaiAdapter = new OpenAIAdapter({
        baseUrl: apiUrl,
        apiKey: apiKey || null,
        defaultModel: model,
      });

      console.log(`LLM Service initialized with fallback: ${apiUrl} (${model})`);
      return;
    }

    this.createAdapter();
    console.log(
      `LLM Service initialized: ${this.resolvedModel.provider.name} - ${this.resolvedModel.model.name}`
    );
  }

  /**
   * Create the appropriate adapter based on the resolved model
   */
  private createAdapter(): void {
    if (!this.resolvedModel) return;

    const { base_url, api_key, api_mode, model } = this.resolvedModel;

    if (api_mode === 'openai') {
      this.openaiAdapter = new OpenAIAdapter({
        baseUrl: base_url,
        apiKey: api_key,
        defaultModel: model.id,
      });
      this.ollamaAdapter = null;
    } else if (api_mode === 'ollama') {
      this.ollamaAdapter = new OllamaAdapter({
        baseUrl: base_url,
        defaultModel: model.id,
      });
      this.openaiAdapter = null;
    }
  }

  /**
   * Reload configuration and reinitialize
   */
  async reload(): Promise<void> {
    clearConfigCache();
    this.resolvedModel = null;
    this.openaiAdapter = null;
    this.ollamaAdapter = null;
    await this.initialize();
  }

  /**
   * Get the current model information
   */
  getCurrentModel(): {
    provider: string;
    model: string;
    api_mode: string;
  } | null {
    if (!this.resolvedModel) {
      return null;
    }

    return {
      provider: this.resolvedModel.provider.name,
      model: this.resolvedModel.model.name,
      api_mode: this.resolvedModel.api_mode,
    };
  }

  /**
   * Resolve model for a request based on priority:
   * 1. modelOverride (per-chat override)
   * 2. userId (user preference)
   * 3. System default
   */
  private async resolveRequestModel(options?: ChatOptions): Promise<{
    resolved: ResolvedModel;
    openaiAdapter: OpenAIAdapter | null;
    ollamaAdapter: OllamaAdapter | null;
  }> {
    // Priority 1: Per-request model override
    if (options?.modelOverride) {
      const overrideResolved = await resolveModel(
        options.modelOverride.providerId,
        options.modelOverride.modelId
      );
      if (overrideResolved && overrideResolved.provider.enabled) {
        console.log(`[LLM] Using model override: ${overrideResolved.provider.name}/${overrideResolved.model.name}`);
        return this.createAdapterForModel(overrideResolved);
      }
      console.log(`[LLM] Model override invalid, falling back`);
    }

    // Priority 2/3: User preference or system default (handled in resolveActiveModel)
    const resolved = await resolveActiveModel('chat', options?.userId);
    if (resolved) {
      return this.createAdapterForModel(resolved);
    }

    // Fallback to current default adapter
    if (this.resolvedModel) {
      return {
        resolved: this.resolvedModel,
        openaiAdapter: this.openaiAdapter,
        ollamaAdapter: this.ollamaAdapter,
      };
    }

    throw new Error('No LLM model available');
  }

  /**
   * Create adapter for a specific resolved model
   */
  private createAdapterForModel(resolved: ResolvedModel): {
    resolved: ResolvedModel;
    openaiAdapter: OpenAIAdapter | null;
    ollamaAdapter: OllamaAdapter | null;
  } {
    const { base_url, api_key, api_mode, model } = resolved;

    if (api_mode === 'openai') {
      return {
        resolved,
        openaiAdapter: new OpenAIAdapter({
          baseUrl: base_url,
          apiKey: api_key,
          defaultModel: model.id,
        }),
        ollamaAdapter: null,
      };
    } else if (api_mode === 'ollama') {
      return {
        resolved,
        openaiAdapter: null,
        ollamaAdapter: new OllamaAdapter({
          baseUrl: base_url,
          defaultModel: model.id,
        }),
      };
    }

    throw new Error(`Unknown API mode: ${api_mode}`);
  }

  /**
   * Stream chat completions
   *
   * @param messages - Chat messages
   * @param tools - Available tools
   * @param usageContext - Usage tracking context
   * @param options - Per-request options (modelOverride, userId)
   */
  async *streamChat(
    messages: Message[],
    tools?: ToolDefinition[],
    usageContext?: UsageContext,
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    // Ensure initialized with default model
    if (!this.openaiAdapter && !this.ollamaAdapter) {
      await this.initialize();
    }

    // Resolve the model to use for this request
    let requestOpenai: OpenAIAdapter | null;
    let requestOllama: OllamaAdapter | null;
    let requestResolved: ResolvedModel;

    // Check if we need a per-request model
    if (options?.modelOverride || options?.userId) {
      const requestModel = await this.resolveRequestModel(options);
      requestOpenai = requestModel.openaiAdapter;
      requestOllama = requestModel.ollamaAdapter;
      requestResolved = requestModel.resolved;
    } else {
      // Use default cached adapters
      requestOpenai = this.openaiAdapter;
      requestOllama = this.ollamaAdapter;
      requestResolved = this.resolvedModel!;
    }

    let hasTracked = false;
    const trackUsage = async () => {
      if (!hasTracked && usageContext) {
        hasTracked = true;
        const provider = requestResolved?.provider.id || 'unknown';
        const model = requestResolved?.model.id || 'unknown';
        await usageTrackingService.track(usageContext, provider, model);
      }
    };

    // Use OpenAI adapter (default or explicit)
    if (requestOpenai) {
      const modelId = requestResolved?.model.id;
      console.log(`[LLM Service] Calling OpenAI adapter with ${tools?.length || 0} tools, model: ${modelId}`);
      for await (const chunk of requestOpenai.streamChat(messages, modelId, tools)) {
        // Track on first chunk with content
        if (!hasTracked && chunk?.choices?.[0]?.delta?.content) {
          await trackUsage();
        }
        yield chunk;
      }
      // Track even if no content chunks (e.g., tool calls only)
      await trackUsage();
      return;
    }

    // Use Ollama adapter
    if (requestOllama) {
      const modelId = requestResolved?.model.id;
      // Note: Ollama has limited tool support, so we pass tools but they may be ignored
      for await (const chunk of requestOllama.streamChat(messages, modelId, tools)) {
        if (!hasTracked && chunk?.choices?.[0]?.delta?.content) {
          await trackUsage();
        }
        yield chunk;
      }
      await trackUsage();
      return;
    }

    throw new Error('No LLM adapter available');
  }

  /**
   * Non-streaming chat completion
   *
   * @param messages - Chat messages
   * @param tools - Available tools
   * @param usageContext - Usage tracking context
   * @param options - Per-request options (modelOverride, userId)
   */
  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    usageContext?: UsageContext,
    options?: ChatOptions
  ): Promise<{
    content: string | null;
    tool_calls?: ToolCall[];
    finish_reason: string;
  }> {
    // Ensure initialized
    if (!this.openaiAdapter && !this.ollamaAdapter) {
      await this.initialize();
    }

    // Resolve the model to use for this request
    let requestOpenai: OpenAIAdapter | null;
    let requestOllama: OllamaAdapter | null;
    let requestResolved: ResolvedModel;

    // Check if we need a per-request model
    if (options?.modelOverride || options?.userId) {
      const requestModel = await this.resolveRequestModel(options);
      requestOpenai = requestModel.openaiAdapter;
      requestOllama = requestModel.ollamaAdapter;
      requestResolved = requestModel.resolved;
    } else {
      // Use default cached adapters
      requestOpenai = this.openaiAdapter;
      requestOllama = this.ollamaAdapter;
      requestResolved = this.resolvedModel!;
    }

    // Track usage after successful response
    const trackUsage = async () => {
      if (usageContext) {
        const provider = requestResolved?.provider.id || 'unknown';
        const model = requestResolved?.model.id || 'unknown';
        await usageTrackingService.track(usageContext, provider, model);
      }
    };

    if (requestOpenai) {
      const modelId = requestResolved?.model.id;
      const result = await requestOpenai.chat(messages, modelId, tools, options?.toolChoice);
      await trackUsage();
      return {
        content: result.content,
        tool_calls: result.tool_calls,
        finish_reason: result.finish_reason,
      };
    }

    if (requestOllama) {
      const modelId = requestResolved?.model.id;
      const result = await requestOllama.chat(messages, modelId);
      await trackUsage();
      return {
        content: result.content,
        finish_reason: result.finish_reason,
      };
    }

    throw new Error('No LLM adapter available');
  }

  /**
   * Test the current connection
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency_ms?: number;
    models_found?: number;
  }> {
    // Ensure initialized
    if (!this.openaiAdapter && !this.ollamaAdapter) {
      await this.initialize();
    }

    if (this.openaiAdapter) {
      return this.openaiAdapter.testConnection();
    }

    if (this.ollamaAdapter) {
      return this.ollamaAdapter.testConnection();
    }

    return {
      success: false,
      message: 'No LLM adapter available',
    };
  }
}

// Singleton instance
export const llmService = new LLMService();
