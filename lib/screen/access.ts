import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { screens, screenCollaborators } from "@/lib/db/schema";

export type ScreenRole = "owner" | "contributor" | null;

/**
 * The single source of truth for screen access. Owners get full control
 * (pairing code, disconnect, reorder, delete/edit anyone's media).
 * Contributors can view the screen and manage only their own uploaded
 * media (upload, edit their own item's expiration/duration, delete their
 * own items) — never anyone else's, never the screen's pairing/connection
 * state, never reordering (the shared queue order is an owner-only call).
 */
export async function getScreenRole(userId: string, screenId: string): Promise<ScreenRole> {
  const [screen] = await db
    .select({ userId: screens.userId })
    .from(screens)
    .where(eq(screens.id, screenId))
    .limit(1);

  if (!screen) return null;
  if (screen.userId === userId) return "owner";

  const [collaborator] = await db
    .select({ id: screenCollaborators.id })
    .from(screenCollaborators)
    .where(
      and(
        eq(screenCollaborators.screenId, screenId),
        eq(screenCollaborators.userId, userId)
      )
    )
    .limit(1);

  return collaborator ? "contributor" : null;
}
