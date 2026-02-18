/**
 * Google Gemini Imagen Adapter
 * Supports text-to-image and image-to-image generation using Gemini 2.0 Flash
 */

import type { ResolvedModel } from '../../../types/providers';

export interface GoogleImageRequest {
  prompt: string;
  sourceImage?: {
    base64: string;
    mimeType: string;
  };
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface GoogleImageResult {
  success: boolean;
  images: Array<{
    base64Data: string;
    mimeType: string;
  }>;
  error?: string;
  revisedPrompt?: string;
}

/**
 * Generate images using Google Gemini API
 */
export async function generateWithGoogle(
  request: GoogleImageRequest,
  resolvedModel: ResolvedModel
): Promise<GoogleImageResult> {
  const { prompt, sourceImage, numberOfImages = 1 } = request;

  if (!resolvedModel.api_key) {
    return {
      success: false,
      images: [],
      error: 'Google AI API key not configured',
    };
  }

  try {
    // Build the content parts
    const parts: any[] = [];

    // Add image first if this is image-to-image
    if (sourceImage) {
      parts.push({
        inline_data: {
          mime_type: sourceImage.mimeType,
          data: sourceImage.base64,
        },
      });
    }

    // Add the text prompt
    parts.push({ text: prompt });

    // Build request body
    const requestBody = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    // Make API request
    const endpoint = `${resolvedModel.base_url}/models/${resolvedModel.model.id}:generateContent`;
    console.log('[GoogleImageAdapter] Calling endpoint:', endpoint);
    console.log('[GoogleImageAdapter] Model ID:', resolvedModel.model.id);
    console.log('[GoogleImageAdapter] Is image-to-image:', !!sourceImage);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': resolvedModel.api_key,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GoogleImageAdapter] API error:', errorText);
      return {
        success: false,
        images: [],
        error: `Google API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Extract images from response
    const images: Array<{ base64Data: string; mimeType: string }> = [];
    let revisedPrompt: string | undefined;

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inline_data) {
            images.push({
              base64Data: part.inline_data.data,
              mimeType: part.inline_data.mime_type || 'image/png',
            });
          }
          if (part.text) {
            revisedPrompt = part.text;
          }
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
    console.error('[GoogleImageAdapter] Error:', error);
    return {
      success: false,
      images: [],
      error: error.message || 'Unknown error generating image',
    };
  }
}
