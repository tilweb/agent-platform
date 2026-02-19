/**
 * Image Generation Routes
 * API endpoints for generating and retrieving images
 */

import { Hono } from 'hono';
import { imageGenerationService } from '../services/imageGeneration';
import { parseIntSafe } from '../utils/parseIntSafe';
import {
  saveGeneratedImage,
  getGeneratedImage,
  getImageMetadata,
  getImageMimeType,
  listGeneratedImages,
  deleteGeneratedImage,
} from '../services/imageStorage';
import { authMiddleware } from '../auth';
import { imageGenRateLimit } from '../middleware/rateLimit';

export const imageRoutes = new Hono();

// Require authentication for all image operations
imageRoutes.use('/*', authMiddleware);

// Validate resource IDs to prevent path traversal attacks
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function isValidImageId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 128;
}

/**
 * POST /api/images/generate
 * Generate an image from a prompt
 */
imageRoutes.post('/generate', imageGenRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, aspectRatio, size, numberOfImages, sessionId } = body;

    if (!prompt) {
      return c.json({ success: false, error: 'Prompt is required' }, 400);
    }

    // Limit number of images per request
    const maxImages = 4;
    const imageCount = Math.min(Math.max(1, parseInt(numberOfImages) || 1), maxImages);

    // Ensure service is initialized
    await imageGenerationService.reload();

    const result = await imageGenerationService.generate({
      prompt,
      aspectRatio,
      size,
      numberOfImages: imageCount,
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
      error: 'Fehler bei der Bildgenerierung',
    }, 500);
  }
});

/**
 * GET /api/images/generated/:id
 * Retrieve a generated image by ID
 */
imageRoutes.get('/generated/:id', async (c) => {
  const id = c.req.param('id');

  if (!isValidImageId(id)) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }

  const imageBuffer = await getGeneratedImage(id);
  if (!imageBuffer) {
    return c.json({ error: 'Image not found' }, 404);
  }

  const mimeType = await getImageMimeType(id) || 'image/png';

  return new Response(imageBuffer, {
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

  if (!isValidImageId(id)) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }

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
  const limit = parseIntSafe(c.req.query('limit'), 50);
  const offset = parseIntSafe(c.req.query('offset'), 0);

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

  if (!isValidImageId(id)) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }

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
