/**
 * fal.ai Image Generation Adapter
 * Supports text-to-image and image-to-image via fal.run REST API
 */

import type { ResolvedModel } from '../../../types/providers';

export interface FalImageRequest {
  prompt: string;
  sourceImage?: {
    base64: string;
    mimeType: string;
  };
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface FalImageResult {
  success: boolean;
  images: Array<{
    base64Data: string;
    mimeType: string;
  }>;
  error?: string;
  revisedPrompt?: string;
}

/**
 * Generate images using fal.ai REST API
 */
export async function generateWithFal(
  request: FalImageRequest,
  resolvedModel: ResolvedModel
): Promise<FalImageResult> {
  const { prompt, sourceImage, aspectRatio = '1:1', numberOfImages = 1 } = request;

  if (!resolvedModel.api_key) {
    return {
      success: false,
      images: [],
      error: 'fal.ai API key not configured',
    };
  }

  try {
    // Build request body
    const requestBody: Record<string, any> = {
      prompt,
      num_images: numberOfImages,
      aspect_ratio: aspectRatio,
      output_format: 'png',
      sync_mode: true,
    };

    // Add source image for image-to-image (edit endpoint)
    if (sourceImage) {
      const dataUri = `data:${sourceImage.mimeType};base64,${sourceImage.base64}`;
      requestBody.image_urls = [dataUri];
    }

    // Build endpoint: base_url contains https://fal.run, model.id contains the path
    const endpoint = `${resolvedModel.base_url}/${resolvedModel.model.id}`;
    console.log('[FalImageAdapter] Calling endpoint:', endpoint);
    console.log('[FalImageAdapter] Is image-to-image:', !!sourceImage);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${resolvedModel.api_key}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FalImageAdapter] API error:', errorText);
      return {
        success: false,
        images: [],
        error: `fal.ai API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json() as any;

    // Extract images from response
    const images: Array<{ base64Data: string; mimeType: string }> = [];
    let revisedPrompt: string | undefined;

    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        if (img.url) {
          let base64Data: string;
          const mimeType = img.content_type || 'image/png';

          if (img.url.startsWith('data:')) {
            // data URI from sync_mode — extract base64 part
            const match = img.url.match(/^data:[^;]+;base64,(.+)$/);
            base64Data = match ? match[1] : img.url;
          } else {
            // URL — fetch and convert to base64
            const imgResponse = await fetch(img.url);
            const buffer = await imgResponse.arrayBuffer();
            base64Data = Buffer.from(buffer).toString('base64');
          }

          images.push({ base64Data, mimeType });
        }
      }
    }

    if (data.description) {
      revisedPrompt = data.description;
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
    console.error('[FalImageAdapter] Error:', error);
    return {
      success: false,
      images: [],
      error: error.message || 'Unknown error generating image',
    };
  }
}
