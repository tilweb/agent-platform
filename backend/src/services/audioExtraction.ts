/**
 * Audio-Extraktion + Chunking für die Podcast-Repurposing-Pipeline.
 *
 * - extractAudioToMp3: Audiospur aus einem Video ziehen (ffmpeg, 16 kHz mono).
 * - chunkAudioBySize:  MP3 in < 24-MB-Stücke splitten, damit jedes Stück unter
 *   dem 25-MB-Limit der Whisper-API bleibt.
 *
 * Nutzt dieselbe ffmpeg-Aufruf-Konvention wie `routes/transcription.ts`.
 */

import { $ } from 'bun';
import { randomUUID } from 'crypto';
import { mkdir, unlink, readdir } from 'fs/promises';
import path from 'path';

const TEMP_DIR = '/tmp/agent-platform-podcast';

/** Whisper-Limit ist 25 MB — wir bleiben mit 24 MB sicher darunter. */
export const MAX_CHUNK_BYTES = 24 * 1024 * 1024;

async function ensureTemp(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
}

async function safeUnlink(p: string): Promise<void> {
  try {
    await unlink(p);
  } catch {
    /* ignore */
  }
}

/** Prüft, ob ffmpeg/ffprobe aufrufbar sind (für Health-Checks). */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    const res = await $`ffmpeg -version`.quiet();
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Extrahiert die Audiospur eines Videos als MP3.
 * - Default (Transkription): 16 kHz, mono, 64 kbit/s — minimale Dateigröße.
 * - `hq: true` (Publishing): 44,1 kHz, stereo, 192 kbit/s — publish-taugliche Qualität.
 */
export async function extractAudioToMp3(
  video: ArrayBuffer | Buffer,
  inputExt = 'mp4',
  opts?: { hq?: boolean },
): Promise<Buffer> {
  await ensureTemp();
  const id = randomUUID();
  const ext = /^[a-zA-Z0-9]{1,8}$/.test(inputExt) ? inputExt : 'mp4';
  const inputPath = path.join(TEMP_DIR, `${id}.${ext}`);
  const outputPath = path.join(TEMP_DIR, `${id}.mp3`);

  try {
    await Bun.write(inputPath, video);
    const result = opts?.hq
      ? await $`ffmpeg -y -i ${inputPath} -vn -ar 44100 -ac 2 -b:a 192k ${outputPath}`.quiet()
      : await $`ffmpeg -y -i ${inputPath} -vn -ar 16000 -ac 1 -b:a 64k ${outputPath}`.quiet();
    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg audio extraction failed: ${result.stderr.toString().slice(0, 500)}`);
    }
    const out = await Bun.file(outputPath).arrayBuffer();
    return Buffer.from(out);
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

/** Ermittelt die Dauer (Sekunden) einer Audiodatei via ffprobe; 0 bei Fehler. */
async function probeDurationSec(filePath: string): Promise<number> {
  try {
    const res =
      await $`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`.quiet();
    const d = parseFloat(res.stdout.toString().trim());
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

/**
 * Splittet ein MP3 in Stücke < maxBytes. Liegt das MP3 bereits darunter, wird
 * es unverändert als einzelnes Stück zurückgegeben. Sonst wird anhand von Dauer
 * und Größe eine Segmentlänge berechnet und mit ffmpeg `-f segment` gesplittet.
 */
export async function chunkAudioBySize(
  mp3: Buffer,
  maxBytes = MAX_CHUNK_BYTES,
): Promise<Buffer[]> {
  if (mp3.length <= maxBytes) return [mp3];

  await ensureTemp();
  const id = randomUUID();
  const inputPath = path.join(TEMP_DIR, `${id}.mp3`);
  const pattern = path.join(TEMP_DIR, `${id}_%03d.mp3`);

  try {
    await Bun.write(inputPath, mp3);
    const durationSec = await probeDurationSec(inputPath);

    // Segmentlänge so wählen, dass ein Stück ~90 % von maxBytes erreicht.
    // Fallback (keine Dauer): 600 s (10 min) Segmente.
    const ratio = (maxBytes * 0.9) / mp3.length;
    const segmentSec = durationSec > 0 ? Math.max(60, Math.floor(durationSec * ratio)) : 600;

    const result =
      await $`ffmpeg -y -i ${inputPath} -f segment -segment_time ${segmentSec} -c copy ${pattern}`.quiet();
    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg segmenting failed: ${result.stderr.toString().slice(0, 500)}`);
    }

    const files = (await readdir(TEMP_DIR))
      .filter((f) => f.startsWith(`${id}_`) && f.endsWith('.mp3'))
      .sort();

    const chunks: Buffer[] = [];
    for (const f of files) {
      const full = path.join(TEMP_DIR, f);
      const buf = Buffer.from(await Bun.file(full).arrayBuffer());
      chunks.push(buf);
      await safeUnlink(full);
    }
    return chunks.length > 0 ? chunks : [mp3];
  } finally {
    await safeUnlink(inputPath);
  }
}
