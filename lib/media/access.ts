import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, screenMedia, screens } from "@/lib/db/schema";

/**
 * Can this user manage this media item? True if they uploaded it
 * themselves, OR if they own any screen the item is currently attached
 * to (an owner can manage a contributor's uploads on their own screen —
 * "not full control" for contributors, but full control for the owner).
 */
export async function canManageMedia(userId: string, mediaId: string): Promise<boolean> {
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
