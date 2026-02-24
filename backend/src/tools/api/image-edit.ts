/**
 * Image Edit Tool
 * Edits/transforms uploaded images based on text instructions
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext } from '../types';
import { imageGenerationService } from '../../services/imageGeneration';
import { saveGeneratedImage, getGeneratedImage, getImageMetadata } from '../../services/imageStorage';
import { attachmentsService } from '../../services/attachments';

export class ImageEditTool extends ApiTool {
  constructor() {
    super({
      name: 'edit_image',
      description: 'Edit or transform an image based on text instructions. Use this when the user wants to modify, change, or transform an existing image — either an uploaded attachment or a previously generated image.',
      parameters: {
        type: 'object',
        properties: {
          attachment_id: {
            type: 'string',
            description: 'The ID of the uploaded image attachment to edit. This should be from a previously uploaded image in the conversation.',
          },
          image_id: {
            type: 'string',
            description: 'The ID of a previously generated image to edit (e.g. img_xxx). Use this when modifying an image that was generated earlier in the conversation.',
          },
          prompt: {
            type: 'string',
            description: 'Instructions describing how to modify the image. Be specific about what changes to make.',
          },
        },
        required: ['prompt'],
      },
      category: 'image',
    });
  }

  async execute(
    args: { attachment_id?: string; image_id?: string; prompt: string },
    context?: ToolContext
  ): Promise<string> {
    const { attachment_id, image_id, prompt } = args;

    if (!prompt) {
      return JSON.stringify({
        success: false,
        error: 'prompt is required',
      });
    }

    if (!attachment_id && !image_id) {
      return JSON.stringify({
        success: false,
        error: 'Either attachment_id or image_id must be provided',
      });
    }

    // Ensure service is initialized
    await imageGenerationService.reload();

    // Check if image-to-image model is configured
    if (!imageGenerationService.supportsImageToImage()) {
      return JSON.stringify({
        success: false,
        error: 'No image-to-image model configured. Please configure one in Settings > KI-Modelle under "Bild → Bild".',
      });
    }

    try {
      let base64Data: string;
      let mimeType: string;
      let sourceName: string;

      if (image_id) {
        // Load a previously generated image
        const imageBuffer = await getGeneratedImage(image_id);
        if (!imageBuffer) {
          return JSON.stringify({
            success: false,
            error: `Generated image "${image_id}" not found`,
          });
        }

        const metadata = await getImageMetadata(image_id);
        mimeType = metadata?.mimeType || 'image/png';
        base64Data = imageBuffer.toString('base64');
        sourceName = image_id;
      } else {
        // Load an uploaded attachment
        const sessionId = context?.parentSessionId || context?.sessionId;
        if (!sessionId) {
          return JSON.stringify({
            success: false,
            error: 'No session context available to retrieve attachment',
          });
        }

        const attachment = await attachmentsService.getAttachment(attachment_id!, sessionId);
        if (!attachment) {
          return JSON.stringify({
            success: false,
            error: `Attachment with ID "${attachment_id}" not found in the current session`,
          });
        }

        if (!attachment.mimeType.startsWith('image/')) {
          return JSON.stringify({
            success: false,
            error: `Attachment "${attachment_id}" is not an image (type: ${attachment.mimeType})`,
          });
        }

        const filePath = attachment.metadata.originalPath;
        if (!filePath) {
          return JSON.stringify({
            success: false,
            error: 'Attachment file path not found',
          });
        }

        const fileBuffer = await Bun.file(filePath).arrayBuffer();
        base64Data = Buffer.from(fileBuffer).toString('base64');
        mimeType = attachment.mimeType;
        sourceName = attachment.filename;
      }

      const result = await imageGenerationService.generate({
        prompt,
        sourceImage: {
          base64: base64Data,
          mimeType,
        },
      });

      const image = result.images[0];
      if (!result.success || !image) {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to edit image',
        });
      }

      // Save the edited image
      const saved = await saveGeneratedImage({
        id: image.id,
        base64Data: image.base64Data,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        prompt: `Edit: ${prompt} (from: ${sourceName})`,
        provider: result.provider,
        model: result.model,
        sessionId: context?.sessionId,
        revisedPrompt: image.revisedPrompt,
      });

      // Return structured JSON that the frontend can parse
      return JSON.stringify({
        type: 'generated_image',
        imageId: saved.id,
        url: saved.url,
        prompt: prompt,
        sourceImage: sourceName,
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        revisedPrompt: image.revisedPrompt,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Unknown error editing image',
      });
    }
  }

  override async isAvailable(): Promise<boolean> {
    await imageGenerationService.reload();
    return imageGenerationService.supportsImageToImage();
  }
}

// Factory function
export const createImageEditTool = () => new ImageEditTool();
