/**
 * Image Edit Tool
 * Edits/transforms uploaded images based on text instructions
 */

import { ApiTool } from '../base/ApiTool';
import type { ToolContext } from '../types';
import { imageGenerationService } from '../../services/imageGeneration';
import { saveGeneratedImage } from '../../services/imageStorage';
import { attachmentsService } from '../../services/attachments';

export class ImageEditTool extends ApiTool {
  constructor() {
    super({
      name: 'edit_image',
      description: 'Edit or transform an uploaded image based on text instructions. Use this when the user wants to modify, change, or transform an existing image they have uploaded.',
      parameters: {
        type: 'object',
        properties: {
          attachment_id: {
            type: 'string',
            description: 'The ID of the uploaded image attachment to edit. This should be from a previously uploaded image in the conversation.',
          },
          prompt: {
            type: 'string',
            description: 'Instructions describing how to modify the image. Be specific about what changes to make.',
          },
        },
        required: ['attachment_id', 'prompt'],
      },
      category: 'image',
    });
  }

  async execute(
    args: { attachment_id: string; prompt: string },
    context?: ToolContext
  ): Promise<string> {
    const { attachment_id, prompt } = args;

    if (!attachment_id || !prompt) {
      return JSON.stringify({
        success: false,
        error: 'Both attachment_id and prompt are required',
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

    // Get the attachment
    const sessionId = context?.parentSessionId || context?.sessionId;
    if (!sessionId) {
      return JSON.stringify({
        success: false,
        error: 'No session context available to retrieve attachment',
      });
    }

    const attachment = await attachmentsService.getAttachment(attachment_id, sessionId);
    if (!attachment) {
      return JSON.stringify({
        success: false,
        error: `Attachment with ID "${attachment_id}" not found in the current session`,
      });
    }

    // Verify it's an image
    if (!attachment.mimeType.startsWith('image/')) {
      return JSON.stringify({
        success: false,
        error: `Attachment "${attachment_id}" is not an image (type: ${attachment.mimeType})`,
      });
    }

    try {
      // Read the image file
      const filePath = attachment.metadata.originalPath;
      if (!filePath) {
        return JSON.stringify({
          success: false,
          error: 'Attachment file path not found',
        });
      }

      const imageBuffer = await Bun.file(filePath).arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');

      const result = await imageGenerationService.generate({
        prompt,
        sourceImage: {
          base64: base64Data,
          mimeType: attachment.mimeType,
        },
      });

      if (!result.success || result.images.length === 0) {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to edit image',
        });
      }

      // Save the edited image
      const image = result.images[0];
      const saved = await saveGeneratedImage({
        id: image.id,
        base64Data: image.base64Data,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        prompt: `Edit: ${prompt} (from: ${attachment.filename})`,
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
        sourceImage: attachment.filename,
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
