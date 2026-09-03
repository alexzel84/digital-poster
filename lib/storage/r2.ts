import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Thin adapter around Cloudflare R2 (S3-compatible API). Every R2 call in
 * the app goes through this module — nothing else imports the AWS SDK
 * directly. That keeps the integration swappable (e.g. for local dev
 * without real R2 credentials) and keeps R2 credentials out of every other
 * file.
 */

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials are not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env."
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not configured in .env.");
  }
  return bucket;
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes to complete the PUT
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60; // 1 hour, refreshed on each manifest/dashboard fetch

/** A signed URL the browser can PUT the raw file bytes to directly, bypassing our server. */
export async function getUploadUrl(
  storageKey: string,
  contentType: string
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/** A signed, time-limited URL for reading a private object (thumbnails, playback). */
export async function getDownloadUrl(storageKey: string): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  return getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

export async function deleteObject(storageKey: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: storageKey })
  );
}

/** Generates a storage key namespaced by user, so one user's files never collide with another's. */
export function buildStorageKey(userId: string, mediaId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${mediaId}-${safeName}`;
}
