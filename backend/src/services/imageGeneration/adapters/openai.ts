/**
 * OpenAI Images Adapter
 * Compatible with OpenAI-like APIs such as Nebius Flux.1
 */

import type { ResolvedModel } from '../../../types/providers';

export interface OpenAIImageRequest {
  prompt: string;
  size?: string;
  numberOfImages?: number;
}

export interface OpenAIImageResult {
  success: boolean;
  images: Array<{
    base64Data: string;
    mimeType: string;
  }>;
  error?: string;
  revisedPrompt?: string;
}

/**
 * Generate images using OpenAI-compatible images API (e.g., Nebius Flux.1)
 */
export async function generateWithOpenAI(
  request: OpenAIImageRequest,
  resolvedModel: ResolvedModel
): Promise<OpenAIImageResult> {
  const { prompt, size = '1024x1024', numberOfImages = 1 } = request;

  if (!resolvedModel.api_key) {
    return {
      success: false,
      images: [],
      error: 'API key not configured',
    };
  }

  try {
    // Build request body
    const requestBody = {
      model: resolvedModel.model.id,
      prompt,
      n: Math.min(numberOfImages, resolvedModel.model.max_images_per_request || 1),
      size,
      response_format: 'b64_json',
    };

    // Make API request
    const endpoint = `${resolvedModel.base_url}/images/generations`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedModel.api_key}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAIImageAdapter] API error:', errorText);
      return {
        success: false,
        images: [],
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Extract images from response
    const images: Array<{ base64Data: string; mimeType: string }> = [];
    let revisedPrompt: string | undefined;

    if (data.data && data.data.length > 0) {
      for (const item of data.data) {
        if (item.b64_json) {
          images.push({
            base64Data: item.b64_json,
            mimeType: 'image/png',
          });
        }
        if (item.revised_prompt) {
          revisedPrompt = item.revised_prompt;
        }
      }
    }

    if (images.length === 0) {
      return {
        success: false,
        images: [],
        error: 'No images generated in response',
      };
    }

    return {
      success: true,
      images,
      revisedPrompt,
    };
  } catch (error: any) {
    console.error('[OpenAIImageAdapter] Error:', error);
    return {
      success: false,
      images: [],
      error: error.message || 'Unknown error generating image',
    };
  }
}
