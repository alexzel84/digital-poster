import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { screens, media, screenMedia } from "@/lib/db/schema";
import { hashScreenToken } from "@/lib/screen/token";
import { getDownloadUrl } from "@/lib/storage/r2";

/**
 * The TV's one and only endpoint. Authenticated purely via the screen's
 * bearer token — never Supabase session cookies, never admin credentials.
 * Ownership of the screen doesn't matter here; only "does this token match
 * this screen's stored hash" does.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: screenId } = await params;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing screen token" }, { status: 401 });
  }

  const tokenHash = hashScreenToken(token);

  const [screen] = await db
    .select()
    .from(screens)
    .where(and(eq(screens.id, screenId), eq(screens.screenTokenHash, tokenHash)))
    .limit(1);

  if (!screen) {
    // Covers: wrong id, wrong token, or a disconnected screen (token hash
    // cleared by the dashboard's "Disconnect" action) — all the same 401
    // to the TV, which should fall back to the pairing screen.
    return NextResponse.json({ error: "Invalid screen token" }, { status: 401 });
  }

  await db
    .update(screens)
    .set({ lastSeenAt: new Date() })
    .where(eq(screens.id, screen.id));

  const rows = await db
    .select({
      id: media.id,
      type: media.type,
      storageKey: media.storageKey,
      hash: media.hash,
      durationSeconds: media.durationSeconds,
      imageDurationSeconds: media.imageDurationSeconds,
      expiresAt: media.expiresAt,
      sortOrder: screenMedia.sortOrder,
    })
    .from(screenMedia)
    .innerJoin(media, eq(screenMedia.mediaId, media.id))
    .where(eq(screenMedia.screenId, screen.id))
    .orderBy(asc(screenMedia.sortOrder));

  // Expiration is filtered here too, server-side, per spec — but the
  // player must ALSO re-check locally against its own clock, since the
  // TV may be offline when something crosses its expiry instant.
  const now = Date.now();
  const activeRows = rows.filter(
    (row) => !row.expiresAt || row.expiresAt.getTime() > now
  );

  const items = await Promise.all(
    activeRows.map(async (row) => ({
      id: row.id,
      type: row.type,
      url: await getDownloadUrl(row.storageKey),
      hash: row.hash,
      duration: row.type === "image" ? row.imageDurationSeconds ?? 8 : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      sortOrder: row.sortOrder,
    }))
  );

  return NextResponse.json({
    screenId: screen.id,
    version: screen.manifestVersion,
    items,
  });
}
