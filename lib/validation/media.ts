import { z } from "zod";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4"] as const;
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const;

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export const DEFAULT_IMAGE_DURATION_SECONDS = 8;

export function mediaTypeForMime(mimeType: string): "image" | "video" | null {
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType)) return "video";
  return null;
}

export function maxSizeForMime(mimeType: string): number {
  return mimeType.startsWith("video/") ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
}

export const requestUploadUrlSchema = z.object({
  screenId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive(),
});

export const confirmUploadSchema = z.object({
  screenId: z.string().uuid(),
  mediaId: z.string().uuid(),
  storageKey: z.string().min(1),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive(),
  hash: z.string().min(1),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export const updateMediaSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
  imageDurationSeconds: z.number().int().positive().max(120).optional(),
});

export const reorderSchema = z.object({
  order: z
    .array(z.object({ mediaId: z.string().uuid(), sortOrder: z.number().int() }))
    .min(1),
});
