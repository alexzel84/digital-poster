import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, media, screenMedia } from "@/lib/db/schema";
import { duplicateScreenSchema } from "@/lib/validation/screen";
import { generatePairingCode, pairingCodeExpiresAt } from "@/lib/screen/pairing-code";

/**
 * Duplicates a screen's whole media library into a brand-new screen with
 * its own fresh pairing code. New media DB rows are created (so each
 * screen's copy can be edited/deleted independently later), but they
 * intentionally reuse the SAME storageKey as the originals — the actual
 * file in R2 is never re-uploaded or duplicated, so this costs no extra
 * storage. See media DELETE and screen DELETE for the matching logic that
 * only removes an R2 object once no media row references it anymore.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceScreenId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = duplicateScreenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Owner only — duplicating is not a contributor privilege.
  const [sourceScreen] = await db
    .select()
    .from(screens)
    .where(and(eq(screens.id, sourceScreenId), eq(screens.userId, user.id)))
    .limit(1);

  if (!sourceScreen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const sourceItems = await db
    .select({
      mediaId: media.id,
      filename: media.filename,
      type: media.type,
      mimeType: media.mimeType,
      storageKey: media.storageKey,
      size: media.size,
      hash: media.hash,
      durationSeconds: media.durationSeconds,
      imageDurationSeconds: media.imageDurationSeconds,
      expiresAt: media.expiresAt,
      sortOrder: screenMedia.sortOrder,
    })
    .from(screenMedia)
    .innerJoin(media, eq(screenMedia.mediaId, media.id))
    .where(eq(screenMedia.screenId, sourceScreenId))
    .orderBy(asc(screenMedia.sortOrder));

  const newScreenId = await db.transaction(async (tx) => {
    const [newScreen] = await tx
      .insert(screens)
      .values({
        userId: user.id,
        name: parsed.data.name ?? `${sourceScreen.name} (Copy)`,
        address: sourceScreen.address,
        businessType: sourceScreen.businessType,
        pairingCode: generatePairingCode(),
        pairingCodeExpiresAt: pairingCodeExpiresAt(),
        manifestVersion: 0,
      })
      .returning({ id: screens.id });

    for (const item of sourceItems) {
      const newMediaId = crypto.randomUUID();

      await tx.insert(media).values({
        id: newMediaId,
        userId: user.id,
        filename: item.filename,
        type: item.type,
        mimeType: item.mimeType,
        storageKey: item.storageKey, // same file — not re-uploaded
        size: item.size,
        hash: item.hash,
        durationSeconds: item.durationSeconds,
        imageDurationSeconds: item.imageDurationSeconds,
        expiresAt: item.expiresAt,
      });

      await tx.insert(screenMedia).values({
        screenId: newScreen!.id,
        mediaId: newMediaId,
        sortOrder: item.sortOrder,
      });
    }

    return newScreen!.id;
  });

  return NextResponse.json({ screenId: newScreenId });
}
