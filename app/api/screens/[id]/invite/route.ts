import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screenInvites } from "@/lib/db/schema";
import { getScreenRole } from "@/lib/screen/access";
import { generateInviteToken, hashInviteToken, inviteExpiresAt } from "@/lib/screen/invite-token";

export async function POST(
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

  // Only the owner can invite others — a contributor can't re-share.
  const role = await getScreenRole(user.id, screenId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const token = generateInviteToken();

  await db.insert(screenInvites).values({
    screenId,
    tokenHash: hashInviteToken(token),
    createdByUserId: user.id,
    expiresAt: inviteExpiresAt(),
  });

  const origin = new URL(request.url).origin;

  return NextResponse.json({ inviteUrl: `${origin}/invite/${token}` });
}
