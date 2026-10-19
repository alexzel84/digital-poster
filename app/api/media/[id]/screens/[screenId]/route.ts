import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, screenMedia, media } from "@/lib/db/schema";
import { canManageMedia } from "@/lib/media/access";
import { getScreenRole } from "@/lib/screen/access";
import { updateScheduleSchema } from "@/lib/validation/schedule";
import { deleteMediaCompletely } from "@/lib/media/delete-media";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; screenId: string }> }
) {
  const { id: mediaId, screenId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageMedia(user.id, mediaId))) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const [link] = await db
    .select({ id: screenMedia.id })
    .from(screenMedia)
    .where(and(eq(screenMedia.screenId, screenId), eq(screenMedia.mediaId, mediaId)))
    .limit(1);

  if (!link) {
    return NextResponse.json({ error: "Not linked to that screen" }, { status: 404 });
  }

  await db.delete(screenMedia).where(eq(screenMedia.id, link.id));

  await db
    .update(screens)
    .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
    .where(eq(screens.id, screenId));

  // If that was the only screen this media item was on, it's now fully
  // orphaned — clean it up completely (DB row + R2 file, unless another
  // row still shares the same storageKey) rather than leaving an
  // unreachable item sitting in storage forever.
  const remaining = await db
    .select({ id: screenMedia.id })
    .from(screenMedia)
    .where(eq(screenMedia.mediaId, mediaId))
    .limit(1);

  if (remaining.length === 0) {
    await deleteMediaCompletely(mediaId);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Sets (or clears) the play schedule for ONE placement: this media item on
 * this screen. Same media on another screen keeps its own schedule.
 * Owner: any item on the screen. Contributor: only items they uploaded.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; screenId: string }> }
) {
  const { id: mediaId, screenId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid schedule" },
      { status: 400 }
    );
  }

  const role = await getScreenRole(user.id, screenId);
  if (!role) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  if (role === "contributor") {
    const [own] = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.userId, user.id)))
      .limit(1);
    if (!own) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
  }

  const rules = parsed.data.schedule;
  const [updated] = await db
    .update(screenMedia)
    .set({ schedule: rules && rules.length > 0 ? rules : null })
    .where(and(eq(screenMedia.screenId, screenId), eq(screenMedia.mediaId, mediaId)))
    .returning({ id: screenMedia.id });

  if (!updated) {
    return NextResponse.json({ error: "Not linked to that screen" }, { status: 404 });
  }

  await db
    .update(screens)
    .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
    .where(eq(screens.id, screenId));

  return NextResponse.json({ ok: true });
}
