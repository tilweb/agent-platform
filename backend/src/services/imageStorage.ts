/**
 * Image Storage Service
 * Handles storing and retrieving generated images
 */

import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { GENERATED_IMAGES_DIR as IMAGES_DIR } from '../utils/paths';
import { dateBucketFromId, currentDateBucket } from '../utils/dateBucket';

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
 * Ensure a directory exists (recursive).
 */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * Get bucketed path for an image ID: IMAGES_DIR/YYYY/MM/
 */
function getImageBucketDir(id: string): string {
  const bucket = dateBucketFromId(id) || currentDateBucket();
  return resolve(IMAGES_DIR, bucket);
}

/**
 * Resolve an image file by trying bucketed path first, then flat (backward-compat).
 * Returns the full path if found, null otherwise.
 */
async function resolveImageFile(id: string, ext: string): Promise<string | null> {
  // Try bucketed path first
  const bucketPath = resolve(getImageBucketDir(id), `${id}.${ext}`);
  if (await Bun.file(bucketPath).exists()) return bucketPath;
  // Fallback to flat path
  const flatPath = resolve(IMAGES_DIR, `${id}.${ext}`);
  if (await Bun.file(flatPath).exists()) return flatPath;
  return null;
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
  const bucketDir = getImageBucketDir(input.id);
  await ensureDirExists(bucketDir);

  const extension = getExtension(input.mimeType);
  const filename = `${input.id}.${extension}`;
  const metaFilename = `${input.id}.json`;

  const imagePath = resolve(bucketDir, filename);
  const metaPath = resolve(bucketDir, metaFilename);

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
  // Try common extensions, checking bucketed then flat paths
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

  for (const ext of extensions) {
    const resolvedPath = await resolveImageFile(id, ext);
    if (resolvedPath) {
      const arrayBuffer = await Bun.file(resolvedPath).arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  return null;
}

/**
 * Get image metadata by ID
 */
export async function getImageMetadata(id: string): Promise<SavedImageMetadata | null> {
  const resolvedPath = await resolveImageFile(id, 'json');
  if (resolvedPath) {
    const content = await Bun.file(resolvedPath).text();
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
  let images: SavedImageMetadata[] = [];

  // Scan recursively for bucketed + flat metadata files
  const glob = new Bun.Glob('**/*.json');
  try {
    for await (const relPath of glob.scan(IMAGES_DIR)) {
      const metaPath = resolve(IMAGES_DIR, relPath);
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
  } catch {
    // Directory doesn't exist yet
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

  // Delete image file (try bucketed then flat)
  for (const ext of extensions) {
    const resolvedPath = await resolveImageFile(id, ext);
    if (resolvedPath) {
      try {
        await fs.unlink(resolvedPath);
        deleted = true;
        break;
      } catch {
        // Ignore
      }
    }
  }

  // Delete metadata file (try bucketed then flat)
  const metaPath = await resolveImageFile(id, 'json');
  if (metaPath) {
    try {
      await fs.unlink(metaPath);
      deleted = true;
    } catch {
      // Metadata doesn't exist
    }
  }

  return deleted;
}
