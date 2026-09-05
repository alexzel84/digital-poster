import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { media, screenMedia, screens } from "@/lib/db/schema";
import { updateMediaSchema } from "@/lib/validation/media";
import { canManageMedia } from "@/lib/media/access";
import { deleteMediaCompletely } from "@/lib/media/delete-media";

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

  await deleteMediaCompletely(id);

  return NextResponse.json({ ok: true });
}
