import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { media, screenMedia, screens } from "@/lib/db/schema";
import { updateMediaSchema } from "@/lib/validation/media";
import { deleteObject } from "@/lib/storage/r2";

async function bumpManifestVersionsForMedia(mediaId: string) {
  const affectedScreens = await db
    .select({ screenId: screenMedia.screenId })
    .from(screenMedia)
    .where(eq(screenMedia.mediaId, mediaId));

  for (const { screenId } of affectedScreens) {
    await db
      .update(screens)
      .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  }
}

/**
 * Can this user manage this media item? True if they uploaded it
 * themselves, OR if they own any screen the item is currently attached
 * to (an owner can manage a contributor's uploads on their own screen —
 * "not full control" for contributors, but full control for the owner).
 */
async function canManageMedia(userId: string, mediaId: string): Promise<boolean> {
  const [ownRow] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
    .limit(1);
  if (ownRow) return true;

  const [ownedScreenRow] = await db
    .select({ screenId: screenMedia.screenId })
    .from(screenMedia)
    .innerJoin(screens, eq(screens.id, screenMedia.screenId))
    .where(and(eq(screenMedia.mediaId, mediaId), eq(screens.userId, userId)))
    .limit(1);

  return Boolean(ownedScreenRow);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMediaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  if (!(await canManageMedia(user.id, id))) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if ("expiresAt" in parsed.data) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.imageDurationSeconds !== undefined) {
    updates.imageDurationSeconds = parsed.data.imageDurationSeconds;
  }

  await db.update(media).set(updates).where(eq(media.id, id));
  await bumpManifestVersionsForMedia(id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageMedia(user.id, id))) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  // Capture affected screens before the cascade delete removes the join rows.
  const affectedScreens = await db
    .select({ screenId: screenMedia.screenId })
    .from(screenMedia)
    .where(eq(screenMedia.mediaId, id));

  await db.delete(media).where(eq(media.id, id)); // screen_media rows cascade automatically

  for (const { screenId } of affectedScreens) {
    await db
      .update(screens)
      .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  }

  // Screen duplication (see /api/screens/:id/duplicate) creates new media
  // rows that intentionally share a storageKey with an existing row —
  // same underlying R2 file, so it isn't re-uploaded/duplicated in
  // storage. That means deleting ONE of those rows must not delete the
  // shared file out from under any row that still references it.
  const [stillReferenced] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.storageKey, existing.storageKey), ne(media.id, id)))
    .limit(1);

  if (!stillReferenced) {
    try {
      await deleteObject(existing.storageKey);
    } catch (err) {
      // The DB record is already gone — log and move on rather than
      // leaving the user stuck with an item they can't delete because R2
      // hiccuped.
      console.error("[media DELETE] failed to delete R2 object", err);
    }
  }

  return NextResponse.json({ ok: true });
}
