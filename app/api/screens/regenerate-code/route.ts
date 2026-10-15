import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens } from "@/lib/db/schema";
import { unpairScreenSchema } from "@/lib/validation/screen";
import { generatePairingCode, pairingCodeExpiresAt } from "@/lib/screen/pairing-code";

// Issues a fresh pairing code (and expiry) for an UNPAIRED screen the caller owns.
// Paired screens must be disconnected first, so a live token is never orphaned.
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

  const [updated] = await db
    .update(screens)
    .set({
      pairingCode: generatePairingCode(),
      pairingCodeExpiresAt: pairingCodeExpiresAt(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(screens.id, parsed.data.screenId),
        eq(screens.userId, user.id),
        isNull(screens.screenTokenHash)
      )
    )
    .returning({ id: screens.id });

  if (!updated) {
    return NextResponse.json(
      { error: "Screen not found or already paired" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
