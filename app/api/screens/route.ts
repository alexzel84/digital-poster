import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens } from "@/lib/db/schema";
import { createScreenSchema } from "@/lib/validation/screen";
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
  const parsed = createScreenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const [screen] = await db
    .insert(screens)
    .values({
      userId: user.id, // ownership derived from the authenticated session, never from the client
      name: parsed.data.name,
      pairingCode: generatePairingCode(),
      pairingCodeExpiresAt: pairingCodeExpiresAt(),
      manifestVersion: 0,
    })
    .returning();

  return NextResponse.json({ screen }, { status: 201 });
}
