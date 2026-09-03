import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screenCollaborators } from "@/lib/db/schema";
import { getScreenRole } from "@/lib/screen/access";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: screenId, userId: collaboratorUserId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getScreenRole(user.id, screenId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  await db
    .delete(screenCollaborators)
    .where(
      and(
        eq(screenCollaborators.screenId, screenId),
        eq(screenCollaborators.userId, collaboratorUserId)
      )
    );

  return NextResponse.json({ ok: true });
}
