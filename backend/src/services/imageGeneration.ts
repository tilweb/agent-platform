/**
 * Image Generation Service
 * Provides unified interface for generating images using different providers
 */

import { resolveActiveModel, resolveModel, getImageGenModels } from './providers';
import { generateWithGoogle } from './imageGeneration/adapters/google';
import { generateWithOpenAI } from './imageGeneration/adapters/openai';
import type { ResolvedModel, ProviderConfig, ModelConfig } from '../types/providers';
import { generateId } from '../utils/id';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;           // "1:1", "16:9", etc.
  size?: string;                  // "1024x1024" for OpenAI-compatible
  numberOfImages?: number;
  sourceImage?: {                 // For image-to-image
    base64: string;
    mimeType: string;
  };
}

export interface GeneratedImage {
  id: string;
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  revisedPrompt?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  images: GeneratedImage[];
  error?: string;
  provider: string;
  model: string;
  durationMs: number;
}

/**
 * Parse dimensions from size string (e.g., "1024x1024" -> { width: 1024, height: 1024 })
 */
function parseDimensions(size: string): { width: number; height: number } {
  const match = size.match(/(\d+)x(\d+)/);
  if (match) {
    return { width: parseInt(match[1]), height: parseInt(match[2]) };
  }
  return { width: 1024, height: 1024 }; // Default
}

/**
 * Get size from aspect ratio
 */
function getSizeFromAspectRatio(aspectRatio: string): { width: number; height: number } {
  const aspectMap: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1792, height: 1024 },
    '9:16': { width: 1024, height: 1792 },
    '4:3': { width: 1366, height: 1024 },
    '3:4': { width: 1024, height: 1366 },
  };
  return aspectMap[aspectRatio] || { width: 1024, height: 1024 };
}

/**
 * Generate a unique image ID
 */
function generateImageId(): string {
  return generateId('img');
}

export class ImageGenerationService {
  private textToImageModel: ResolvedModel | null = null;
  private imageToImageModel: ResolvedModel | null = null;

  /**
   * Initialize or reload the service with current active models
   */
  async reload(): Promise<void> {
    this.textToImageModel = await resolveActiveModel('text_to_image');
    this.imageToImageModel = await resolveActiveModel('image_to_image');

    if (this.textToImageModel) {
      console.log(`[ImageGenService] Text-to-Image: ${this.textToImageModel.provider.name} / ${this.textToImageModel.model.name}`);
    } else {
      console.log('[ImageGenService] No text-to-image model configured');
    }

    if (this.imageToImageModel) {
      console.log(`[ImageGenService] Image-to-Image: ${this.imageToImageModel.provider.name} / ${this.imageToImageModel.model.name}`);
    } else {
      console.log('[ImageGenService] No image-to-image model configured');
    }
  }

  /**
   * Get current model info for text-to-image
   */
  getCurrentModel(): { provider: string; model: string } | null {
    if (!this.textToImageModel) return null;
    return {
      provider: this.textToImageModel.provider.name,
      model: this.textToImageModel.model.name,
    };
  }

  /**
   * Get current model info for image-to-image
   */
  getImageToImageModel(): { provider: string; model: string } | null {
    if (!this.imageToImageModel) return null;
    return {
      provider: this.imageToImageModel.provider.name,
      model: this.imageToImageModel.model.name,
    };
  }

  /**
   * Check if image-to-image is available (has configured model)
   */
  supportsImageToImage(): boolean {
    return this.imageToImageModel !== null;
  }

  /**
   * Generate images from request
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    // Ensure we have models loaded
    if (!this.textToImageModel && !this.imageToImageModel) {
      await this.reload();
    }

    // Select the appropriate model based on request type
    const isImageToImage = !!request.sourceImage;
    const resolvedModel = isImageToImage ? this.imageToImageModel : this.textToImageModel;

    if (!resolvedModel) {
      const modelType = isImageToImage ? 'image-to-image' : 'text-to-image';
      return {
        success: false,
        images: [],
        error: `No ${modelType} model configured. Please configure one in Settings > KI-Modelle.`,
        provider: '',
        model: '',
        durationMs: Date.now() - startTime,
      };
    }

    let result;
    const apiMode = resolvedModel.api_mode;

    try {
      if (apiMode === 'google_gemini') {
        result = await generateWithGoogle({
          prompt: request.prompt,
          sourceImage: request.sourceImage,
          aspectRatio: request.aspectRatio,
          numberOfImages: request.numberOfImages,
        }, resolvedModel);
      } else if (apiMode === 'openai_images') {
        // Convert aspect ratio to size if needed
        let size = request.size;
        if (!size && request.aspectRatio) {
          const dims = getSizeFromAspectRatio(request.aspectRatio);
          size = `${dims.width}x${dims.height}`;
        }
        size = size || '1024x1024';

        result = await generateWithOpenAI({
          prompt: request.prompt,
          size,
          numberOfImages: request.numberOfImages,
        }, resolvedModel);
      } else {
        return {
          success: false,
          images: [],
          error: `Unsupported API mode for image generation: ${apiMode}`,
          provider: resolvedModel.provider.name,
          model: resolvedModel.model.name,
          durationMs: Date.now() - startTime,
        };
      }

      if (!result.success) {
        return {
          success: false,
          images: [],
          error: result.error || 'Failed to generate image',
          provider: resolvedModel.provider.name,
          model: resolvedModel.model.name,
          durationMs: Date.now() - startTime,
        };
      }

      // Convert to GeneratedImage format
      const dimensions = request.size
        ? parseDimensions(request.size)
        : request.aspectRatio
          ? getSizeFromAspectRatio(request.aspectRatio)
          : { width: 1024, height: 1024 };

      const images: GeneratedImage[] = result.images.map((img) => ({
        id: generateImageId(),
        base64Data: img.base64Data,
        mimeType: img.mimeType,
        width: dimensions.width,
        height: dimensions.height,
        revisedPrompt: result.revisedPrompt,
      }));

      return {
        success: true,
        images,
        provider: resolvedModel.provider.name,
        model: resolvedModel.model.name,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[ImageGenService] Error:', error);
      return {
        success: false,
        images: [],
        error: error.message || 'Unknown error',
        provider: resolvedModel?.provider.name || '',
        model: resolvedModel?.model.name || '',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate image using a specific provider/model
   */
  async generateWithModel(
    providerId: string,
    modelId: string,
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    const resolved = await resolveModel(providerId, modelId);
    if (!resolved) {
      return {
        success: false,
        images: [],
        error: `Model ${providerId}/${modelId} not found`,
        provider: providerId,
        model: modelId,
        durationMs: Date.now() - startTime,
      };
    }

    // Temporarily set as current model based on request type and generate
    const isImageToImage = !!request.sourceImage;
    let previousModel: ResolvedModel | null;

    if (isImageToImage) {
      previousModel = this.imageToImageModel;
      this.imageToImageModel = resolved;
    } else {
      previousModel = this.textToImageModel;
      this.textToImageModel = resolved;
    }

    const result = await this.generate(request);

    // Restore previous model
    if (isImageToImage) {
      this.imageToImageModel = previousModel;
    } else {
      this.textToImageModel = previousModel;
    }

    return result;
  }
}

// Singleton instance
export const imageGenerationService = new ImageGenerationService();

// Export adapter types for direct usage
export { generateWithGoogle } from './imageGeneration/adapters/google';
export { generateWithOpenAI } from './imageGeneration/adapters/openai';
