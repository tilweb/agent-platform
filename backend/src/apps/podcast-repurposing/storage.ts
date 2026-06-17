/**
 * Podcast-Repurposing — S3-Storage-Helfer (Flow.swiss via storage/s3).
 */

import { putObject, getObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';

/** Speichert das hochgeladene Video, gibt den S3-Key zurück. */
export async function saveEpisodeVideo(
  episodeId: string,
  ext: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = s3Paths.prVideo(episodeId, ext);
  await putObject(key, body, contentType);
  return key;
}

/** Lädt das Video-Binary zurück (zum Audio-Extrahieren). */
export async function getEpisodeVideo(s3Key: string): Promise<Buffer> {
  return getObject(s3Key);
}

/** Speichert die extrahierte Audiospur (mp3), gibt den S3-Key zurück. */
export async function saveEpisodeAudio(episodeId: string, mp3: Buffer): Promise<string> {
  const key = s3Paths.prAudio(episodeId);
  await putObject(key, mp3, 'audio/mpeg');
  return key;
}
