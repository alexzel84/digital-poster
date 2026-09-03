import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens } from "@/lib/db/schema";
import { unpairScreenSchema } from "@/lib/validation/screen";
import { generatePairingCode, pairingCodeExpiresAt } from "@/lib/screen/pairing-code";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = unpairScreenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Ownership derived from the authenticated session — the screenId alone
  // is never trusted to belong to the caller.
  const [updated] = await db
    .update(screens)
    .set({
      screenTokenHash: null,
      pairingCode: generatePairingCode(),
      pairingCodeExpiresAt: pairingCodeExpiresAt(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(screens.id, parsed.data.screenId), eq(screens.userId, user.id))
    )
    .returning({ id: screens.id });

  if (!updated) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
