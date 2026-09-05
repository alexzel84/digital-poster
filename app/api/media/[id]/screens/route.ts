import { NextResponse } from "next/server";
import { and, eq, max, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, screenMedia } from "@/lib/db/schema";
import { canManageMedia } from "@/lib/media/access";
import { z } from "zod";

const linkSchema = z.object({ screenId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: mediaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { screenId } = parsed.data;

  if (!(await canManageMedia(user.id, mediaId))) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  // Linking a media item onto a screen is scoped to screens the caller
  // owns outright — not just any screen they happen to have contributor
  // access to. Keeps "which screens can this item show up on" fully
  // under the media manager's own control.
  const [targetScreen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(and(eq(screens.id, screenId), eq(screens.userId, user.id)))
    .limit(1);

  if (!targetScreen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const [alreadyLinked] = await db
    .select({ id: screenMedia.id })
    .from(screenMedia)
    .where(and(eq(screenMedia.screenId, screenId), eq(screenMedia.mediaId, mediaId)))
    .limit(1);

  if (alreadyLinked) {
    return NextResponse.json({ error: "Already linked to that screen" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    const [nextOrderRow] = await tx
      .select({ nextOrder: sql<number>`coalesce(${max(screenMedia.sortOrder)}, -1) + 1` })
      .from(screenMedia)
      .where(eq(screenMedia.screenId, screenId));
    const nextOrder = nextOrderRow?.nextOrder ?? 0;

    await tx.insert(screenMedia).values({ screenId, mediaId, sortOrder: nextOrder });

    await tx
      .update(screens)
      .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  });

  return NextResponse.json({ ok: true });
}
