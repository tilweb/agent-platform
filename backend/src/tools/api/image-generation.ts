/**
 * Image Generation Tool
 * Generates images from text descriptions using the configured image generation provider
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext } from '../types';
import { imageGenerationService } from '../../services/imageGeneration';
import { saveGeneratedImage } from '../../services/imageStorage';

export class ImageGenerationTool extends ApiTool {
  constructor() {
    super({
      name: 'generate_image',
      description: 'Generate an image from a text description. Use this when the user asks you to create, draw, or generate an image or picture.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to generate. Be specific about style, composition, colors, and subject matter.',
          },
          aspect_ratio: {
            type: 'string',
            description: 'Aspect ratio of the image. Options: "1:1" (square), "16:9" (landscape), "9:16" (portrait), "4:3", "3:4". Default is "1:1".',
          },
          style: {
            type: 'string',
            description: 'Optional style hint to append to prompt. Examples: "photorealistic", "digital art", "oil painting", "watercolor", "illustration", "3D render".',
          },
        },
        required: ['prompt'],
      },
      category: 'image',
    });
  }

  async execute(
    args: { prompt: string; aspect_ratio?: string; style?: string },
    context?: ToolContext
  ): Promise<string> {
    const { prompt, aspect_ratio = '1:1', style } = args;

    if (!prompt) {
      return JSON.stringify({
        success: false,
        error: 'Prompt is required',
      });
    }

    // Ensure service is initialized
    await imageGenerationService.reload();

    const currentModel = imageGenerationService.getCurrentModel();
    if (!currentModel) {
      return JSON.stringify({
        success: false,
        error: 'No image generation model configured. Please configure an image generation provider in settings.',
      });
    }

    // Build enhanced prompt with style if provided
    const fullPrompt = style ? `${prompt}, ${style} style` : prompt;

    try {
      const result = await imageGenerationService.generate({
        prompt: fullPrompt,
        aspectRatio: aspect_ratio,
        numberOfImages: 1,
      });

      if (!result.success || result.images.length === 0) {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to generate image',
        });
      }

      // Save the first image
      const image = result.images[0];
      const saved = await saveGeneratedImage({
        id: image.id,
        base64Data: image.base64Data,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        prompt: fullPrompt,
        provider: result.provider,
        model: result.model,
        sessionId: context?.sessionId,
        revisedPrompt: image.revisedPrompt,
      });

      // Return structured JSON that the frontend can parse
      // Note: revisedPrompt is excluded to avoid bloating LLM context (saved in metadata)
      return JSON.stringify({
        type: 'generated_image',
        imageId: saved.id,
        url: saved.url,
        prompt: fullPrompt,
        aspectRatio: aspect_ratio,
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Unknown error generating image',
      });
    }
  }

  override async isAvailable(): Promise<boolean> {
    await imageGenerationService.reload();
    return imageGenerationService.getCurrentModel() !== null;
  }
}

// Factory function
export const createImageGenerationTool = () => new ImageGenerationTool();
