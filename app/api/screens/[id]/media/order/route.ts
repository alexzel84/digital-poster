import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, screenMedia } from "@/lib/db/schema";
import { reorderSchema } from "@/lib/validation/media";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: screenId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // Ownership check on the screen itself.
  const [screen] = await db
    .select({ id: screens.id })
    .from(screens)
    .where(and(eq(screens.id, screenId), eq(screens.userId, user.id)))
    .limit(1);

  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    for (const { mediaId, sortOrder } of parsed.data.order) {
      await tx
        .update(screenMedia)
        .set({ sortOrder })
        .where(
          and(eq(screenMedia.screenId, screenId), eq(screenMedia.mediaId, mediaId))
        );
    }

    await tx
      .update(screens)
      .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  });

  return NextResponse.json({ ok: true });
}
