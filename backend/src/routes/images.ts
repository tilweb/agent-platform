/**
 * Image Generation Routes
 * API endpoints for generating and retrieving images
 */

import { Hono } from 'hono';
import { imageGenerationService } from '../services/imageGeneration';
import {
  saveGeneratedImage,
  getGeneratedImage,
  getImageMetadata,
  getImageMimeType,
  listGeneratedImages,
  deleteGeneratedImage,
} from '../services/imageStorage';

export const imageRoutes = new Hono();

/**
 * POST /api/images/generate
 * Generate an image from a prompt
 */
imageRoutes.post('/generate', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, aspectRatio, size, numberOfImages, sessionId } = body;

    if (!prompt) {
      return c.json({ success: false, error: 'Prompt is required' }, 400);
    }

    // Ensure service is initialized
    await imageGenerationService.reload();

    const result = await imageGenerationService.generate({
      prompt,
      aspectRatio,
      size,
      numberOfImages: numberOfImages || 1,
    });

    if (!result.success || result.images.length === 0) {
      return c.json({
        success: false,
        error: result.error || 'Failed to generate image',
      }, 500);
    }

    // Save all generated images
    const savedImages = [];
    for (const image of result.images) {
      const saved = await saveGeneratedImage({
        id: image.id,
        base64Data: image.base64Data,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        prompt,
        provider: result.provider,
        model: result.model,
        sessionId,
        revisedPrompt: image.revisedPrompt,
      });

      savedImages.push({
        id: saved.id,
        url: saved.url,
        width: image.width,
        height: image.height,
        revisedPrompt: image.revisedPrompt,
      });
    }

    return c.json({
      success: true,
      images: savedImages,
      provider: result.provider,
      model: result.model,
      durationMs: result.durationMs,
    });
  } catch (error: any) {
    console.error('[ImageRoutes] Generate error:', error);
    return c.json({
      success: false,
      error: error.message || 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/images/generated/:id
 * Retrieve a generated image by ID
 */
imageRoutes.get('/generated/:id', async (c) => {
  const id = c.req.param('id');

  const imageBuffer = await getGeneratedImage(id);
  if (!imageBuffer) {
    return c.json({ error: 'Image not found' }, 404);
  }

  const mimeType = await getImageMimeType(id) || 'image/png';

  return new Response(imageBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    },
  });
});

/**
 * GET /api/images/generated/:id/metadata
 * Get metadata for a generated image
 */
imageRoutes.get('/generated/:id/metadata', async (c) => {
  const id = c.req.param('id');

  const metadata = await getImageMetadata(id);
  if (!metadata) {
    return c.json({ error: 'Image not found' }, 404);
  }

  return c.json(metadata);
});

/**
 * GET /api/images/list
 * List generated images with optional filters
 */
imageRoutes.get('/list', async (c) => {
  const sessionId = c.req.query('sessionId');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const result = await listGeneratedImages({
    sessionId,
    limit,
    offset,
  });

  return c.json(result);
});

/**
 * DELETE /api/images/generated/:id
 * Delete a generated image
 */
imageRoutes.delete('/generated/:id', async (c) => {
  const id = c.req.param('id');

  const deleted = await deleteGeneratedImage(id);
  if (!deleted) {
    return c.json({ error: 'Image not found' }, 404);
  }

  return c.json({ success: true });
});

/**
 * GET /api/images/current-model
 * Get information about the current image generation model
 */
imageRoutes.get('/current-model', async (c) => {
  await imageGenerationService.reload();
  const model = imageGenerationService.getCurrentModel();

  if (!model) {
    return c.json({
      configured: false,
      message: 'No image generation model configured',
    });
  }

  return c.json({
    configured: true,
    provider: model.provider,
    model: model.model,
    supportsImageToImage: imageGenerationService.supportsImageToImage(),
  });
});
