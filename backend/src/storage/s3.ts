/**
 * S3-Client gegen Flow.swiss (S3-kompatibler Object-Storage).
 *
 * Lazy-init — die Modul-Imports anderer Stellen sollen nicht zur Connect-Zeit
 * fehlschlagen, falls FLOW_S3_* nicht gesetzt ist (z.B. lokale Dev ohne S3).
 *
 * Convention: alle Pfade aus storage/paths.ts; Bucket-Name aus FLOW_S3_BUCKET
 * (Default `workplace-poc-demo`).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';

let _client: S3Client | null = null;

export const BUCKET = process.env.FLOW_S3_BUCKET || 'workplace-poc-demo';

export function getS3(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.FLOW_S3_ENDPOINT;
  const accessKeyId = process.env.FLOW_S3_MASTER;
  const secretAccessKey = process.env.FLOW_S3_SECRET;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'FLOW_S3_ENDPOINT / FLOW_S3_MASTER / FLOW_S3_SECRET missing — cannot initialize S3 client.',
    );
  }
  _client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return _client;
}

export function isS3Configured(): boolean {
  return Boolean(
    process.env.FLOW_S3_ENDPOINT && process.env.FLOW_S3_MASTER && process.env.FLOW_S3_SECRET,
  );
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
  extra?: Partial<PutObjectCommandInput>,
): Promise<void> {
  const client = getS3();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...extra,
  }));
}

export async function getObject(key: string): Promise<Buffer> {
  const client = getS3();
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function objectSignedUrl(key: string, ttlSec = 300): Promise<string> {
  const client = getS3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: ttlSec });
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getS3();
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode ?? 0;
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') return false;
    throw err;
  }
}

/**
 * List S3-Keys mit Prefix. Gibt {key, size, lastModified} zurueck.
 * Pagination wird automatisch abgewickelt.
 */
export async function listObjectsByPrefix(prefix: string): Promise<Array<{ key: string; size: number; lastModified?: string }>> {
  const client = getS3();
  const out: Array<{ key: string; size: number; lastModified?: string }> = [];
  let continuationToken: string | undefined;
  do {
    const res: any = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ? new Date(obj.LastModified).toISOString() : undefined,
      });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

/**
 * Idempotent: HeadBucket — bei 404/NoSuchBucket erst CreateBucket.
 * Wird beim Server-Start einmalig aufgerufen.
 */
export async function ensureBucket(): Promise<void> {
  if (!isS3Configured()) {
    console.log('[s3] FLOW_S3_* not set — skipping bucket init.');
    return;
  }
  const client = getS3();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`[s3] bucket "${BUCKET}" exists.`);
    return;
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode ?? 0;
    const code = err?.name ?? '';
    if (status !== 404 && code !== 'NotFound' && code !== 'NoSuchBucket') {
      console.error('[s3] HeadBucket unexpected error:', code, status, err?.message);
      throw err;
    }
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`[s3] bucket "${BUCKET}" created.`);
  } catch (err: any) {
    if (err?.name === 'BucketAlreadyOwnedByYou' || err?.name === 'BucketAlreadyExists') {
      console.log(`[s3] bucket "${BUCKET}" race — already exists.`);
      return;
    }
    console.error('[s3] CreateBucket failed:', err);
    throw err;
  }
}
