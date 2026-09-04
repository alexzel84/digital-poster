import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, media, screenMedia } from "@/lib/db/schema";
import { updateScreenSchema } from "@/lib/validation/screen";
import { deleteObject } from "@/lib/storage/r2";

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
  const parsed = updateScreenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if ("address" in parsed.data) updates.address = parsed.data.address || null;
  if ("businessType" in parsed.data) updates.businessType = parsed.data.businessType || null;

  // Owner only — editing screen details is not a contributor privilege.
  const [updated] = await db
    .update(screens)
    .set(updates)
    .where(and(eq(screens.id, id), eq(screens.userId, user.id)))
    .returning({ id: screens.id });

  if (!updated) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

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

  // Owner only — deleting the whole screen is not a contributor privilege.
  const [screen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(and(eq(screens.id, id), eq(screens.userId, user.id)))
    .limit(1);

  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  // Capture attached media before the cascade delete removes the
  // screen_media join rows.
  const attachedMedia = await db
    .select({ mediaId: screenMedia.mediaId })
    .from(screenMedia)
    .where(eq(screenMedia.screenId, id));

  // screen_media, screen_collaborators, and screen_invites rows all cascade
  // away automatically via their FK constraints (see lib/db/schema.ts).
  await db.delete(screens).where(eq(screens.id, id));

  // Clean up media that's now orphaned — i.e. was only ever attached to
  // this screen — so it doesn't sit unused in storage with no way to
  // manage it. Media that's (in principle) still attached to another
  // screen is left alone.
  for (const { mediaId } of attachedMedia) {
    const stillAttached = await db
      .select({ id: screenMedia.id })
      .from(screenMedia)
      .where(eq(screenMedia.mediaId, mediaId))
      .limit(1);

    if (stillAttached.length > 0) continue;

    const [mediaRow] = await db
      .select({ storageKey: media.storageKey })
      .from(media)
      .where(eq(media.id, mediaId))
      .limit(1);

    await db.delete(media).where(eq(media.id, mediaId));

    if (mediaRow) {
      // Duplicated screens (see /api/screens/:id/duplicate) create media
      // rows that intentionally share a storageKey — same underlying R2
      // file, never re-uploaded. Only delete the actual file if no other
      // media row still points at it.
      const [stillReferenced] = await db
        .select({ id: media.id })
        .from(media)
        .where(and(eq(media.storageKey, mediaRow.storageKey), ne(media.id, mediaId)))
        .limit(1);

      if (!stillReferenced) {
        try {
          await deleteObject(mediaRow.storageKey);
        } catch (err) {
          console.error("[screens DELETE] failed to delete orphaned R2 object", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
