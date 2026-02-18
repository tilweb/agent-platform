/**
 * Image Storage Service
 * Handles storing and retrieving generated images
 */

import { resolve } from 'path';

const IMAGES_DIR = resolve(process.cwd(), '../data/generated-images');

export interface SavedImageMetadata {
  id: string;
  prompt: string;
  mimeType: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  createdAt: string;
  sessionId?: string;
  revisedPrompt?: string;
}

/**
 * Ensure the images directory exists
 */
async function ensureImagesDir(): Promise<void> {
  const dir = Bun.file(IMAGES_DIR);
  try {
    const dirPath = IMAGES_DIR;
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Get file extension from MIME type
 */
function getExtension(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mimeMap[mimeType] || 'png';
}

/**
 * Save a generated image to disk
 */
export async function saveGeneratedImage(input: {
  id: string;
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  prompt: string;
  provider: string;
  model: string;
  sessionId?: string;
  revisedPrompt?: string;
}): Promise<{ id: string; url: string; path: string }> {
  await ensureImagesDir();

  const extension = getExtension(input.mimeType);
  const filename = `${input.id}.${extension}`;
  const metaFilename = `${input.id}.json`;

  const imagePath = resolve(IMAGES_DIR, filename);
  const metaPath = resolve(IMAGES_DIR, metaFilename);

  // Decode and save the image
  const imageBuffer = Buffer.from(input.base64Data, 'base64');
  await Bun.write(imagePath, imageBuffer);

  // Save metadata
  const metadata: SavedImageMetadata = {
    id: input.id,
    prompt: input.prompt,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    provider: input.provider,
    model: input.model,
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    revisedPrompt: input.revisedPrompt,
  };

  await Bun.write(metaPath, JSON.stringify(metadata, null, 2));

  return {
    id: input.id,
    url: `/api/images/generated/${input.id}`,
    path: imagePath,
  };
}

/**
 * Get a generated image by ID
 */
export async function getGeneratedImage(id: string): Promise<Buffer | null> {
  await ensureImagesDir();

  // Try common extensions
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

  for (const ext of extensions) {
    const path = resolve(IMAGES_DIR, `${id}.${ext}`);
    const file = Bun.file(path);

    if (await file.exists()) {
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  return null;
}

/**
 * Get image metadata by ID
 */
export async function getImageMetadata(id: string): Promise<SavedImageMetadata | null> {
  await ensureImagesDir();

  const metaPath = resolve(IMAGES_DIR, `${id}.json`);
  const file = Bun.file(metaPath);

  if (await file.exists()) {
    const content = await file.text();
    return JSON.parse(content) as SavedImageMetadata;
  }

  return null;
}

/**
 * Get MIME type for an image ID
 */
export async function getImageMimeType(id: string): Promise<string | null> {
  const metadata = await getImageMetadata(id);
  return metadata?.mimeType || null;
}

/**
 * List all generated images with metadata
 */
export async function listGeneratedImages(options?: {
  sessionId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ images: SavedImageMetadata[]; total: number }> {
  await ensureImagesDir();

  const fs = await import('fs/promises');
  const files = await fs.readdir(IMAGES_DIR);

  // Filter to only metadata files
  const metaFiles = files.filter((f) => f.endsWith('.json'));

  let images: SavedImageMetadata[] = [];

  for (const metaFile of metaFiles) {
    const metaPath = resolve(IMAGES_DIR, metaFile);
    try {
      const content = await Bun.file(metaPath).text();
      const metadata = JSON.parse(content) as SavedImageMetadata;

      // Filter by session if specified
      if (options?.sessionId && metadata.sessionId !== options.sessionId) {
        continue;
      }

      images.push(metadata);
    } catch {
      // Skip invalid files
    }
  }

  // Sort by creation date (newest first)
  images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = images.length;

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;
  images = images.slice(offset, offset + limit);

  return { images, total };
}

/**
 * Delete a generated image
 */
export async function deleteGeneratedImage(id: string): Promise<boolean> {
  const fs = await import('fs/promises');

  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  let deleted = false;

  // Delete image file
  for (const ext of extensions) {
    const path = resolve(IMAGES_DIR, `${id}.${ext}`);
    try {
      await fs.unlink(path);
      deleted = true;
      break;
    } catch {
      // File doesn't exist with this extension
    }
  }

  // Delete metadata file
  try {
    await fs.unlink(resolve(IMAGES_DIR, `${id}.json`));
    deleted = true;
  } catch {
    // Metadata doesn't exist
  }

  return deleted;
}
