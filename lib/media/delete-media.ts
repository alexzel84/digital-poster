import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, screenMedia, screens } from "@/lib/db/schema";
import { deleteObject } from "@/lib/storage/r2";

/**
 * Fully deletes a media row and, if no other media row still shares its
 * storageKey (see screen duplication — duplicated screens intentionally
 * reuse the same underlying R2 file across multiple rows), deletes the
 * actual R2 object too. Bumps manifestVersion on every screen the item
 * was attached to. Shared by the explicit DELETE endpoint and by
 * "unlinking from the last screen it's attached to."
 */
export async function deleteMediaCompletely(mediaId: string): Promise<void> {
  const [existing] = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  if (!existing) return;

  const affectedScreens = await db
    .select({ screenId: screenMedia.screenId })
    .from(screenMedia)
    .where(eq(screenMedia.mediaId, mediaId));

  await db.delete(media).where(eq(media.id, mediaId)); // screen_media rows cascade automatically

  for (const { screenId } of affectedScreens) {
    await db
      .update(screens)
      .set({ manifestVersion: sql`${screens.manifestVersion} + 1`, updatedAt: new Date() })
      .where(eq(screens.id, screenId));
  }

  const [stillReferenced] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.storageKey, existing.storageKey), ne(media.id, mediaId)))
    .limit(1);

  if (!stillReferenced) {
    try {
      await deleteObject(existing.storageKey);
    } catch (err) {
      console.error("[deleteMediaCompletely] failed to delete R2 object", err);
    }
  }
}
