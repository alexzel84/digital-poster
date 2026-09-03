import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screenInvites, screenCollaborators, screens } from "@/lib/db/schema";
import { acceptInviteSchema } from "@/lib/validation/invite";
import { hashInviteToken } from "@/lib/screen/invite-token";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  const [invite] = await db
    .select()
    .from(screenInvites)
    .where(and(eq(screenInvites.tokenHash, tokenHash), isNull(screenInvites.acceptedByUserId)))
    .limit(1);

  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite is invalid or has expired" }, { status: 401 });
  }

  const [screen] = await db
    .select({ id: screens.id, userId: screens.userId, name: screens.name })
    .from(screens)
    .where(eq(screens.id, invite.screenId))
    .limit(1);

  if (!screen) {
    return NextResponse.json({ error: "Screen no longer exists" }, { status: 404 });
  }

  if (screen.userId === user.id) {
    return NextResponse.json({ error: "You already own this screen" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(screenCollaborators)
      .values({ screenId: screen.id, userId: user.id })
      .onConflictDoNothing();

    await tx
      .update(screenInvites)
      .set({ acceptedByUserId: user.id, acceptedAt: new Date() })
      .where(eq(screenInvites.id, invite.id));
  });

  return NextResponse.json({ screenId: screen.id, screenName: screen.name });
}
