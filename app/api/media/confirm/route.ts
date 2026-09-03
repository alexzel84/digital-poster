import { NextResponse } from "next/server";
import { eq, max, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, media, screenMedia } from "@/lib/db/schema";
import {
  confirmUploadSchema,
  mediaTypeForMime,
  DEFAULT_IMAGE_DURATION_SECONDS,
} from "@/lib/validation/media";
import { getScreenRole } from "@/lib/screen/access";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmUploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { screenId, mediaId, storageKey, filename, mimeType, size, hash, durationSeconds } =
    parsed.data;

  const type = mediaTypeForMime(mimeType);
  if (!type) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  // Owner or contributor — the media row itself is always tagged with the
  // uploader's own userId below, regardless of which role they have.
  const role = await getScreenRole(user.id, screenId);
  if (!role) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const result = await db.transaction(async (tx) => {
    await tx.insert(media).values({
      id: mediaId,
      userId: user.id,
      filename,
      type,
      mimeType,
      storageKey,
      size,
      hash,
      durationSeconds: type === "video" ? durationSeconds ?? null : null,
      imageDurationSeconds: type === "image" ? DEFAULT_IMAGE_DURATION_SECONDS : null,
    });

    const [nextOrderRow] = await tx
      .select({ nextOrder: sql<number>`coalesce(${max(screenMedia.sortOrder)}, -1) + 1` })
      .from(screenMedia)
      .where(eq(screenMedia.screenId, screenId));
    const nextOrder = nextOrderRow?.nextOrder ?? 0;

    await tx.insert(screenMedia).values({
      screenId,
      mediaId,
      sortOrder: nextOrder,
    });

    await tx
      .update(screens)
      .set({
        manifestVersion: sql`${screens.manifestVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(screens.id, screenId));

    return { mediaId };
  });

  return NextResponse.json({ ok: true, mediaId: result.mediaId }, { status: 201 });
}
