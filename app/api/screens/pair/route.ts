import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { screens } from "@/lib/db/schema";
import { pairScreenSchema } from "@/lib/validation/screen";
import { normalizePairingCode } from "@/lib/screen/pairing-code";
import { generateScreenToken, hashScreenToken } from "@/lib/screen/token";
import { evaluatePairing } from "@/lib/screen/pairing-logic";
import { isRateLimited } from "@/lib/screen/rate-limit";

/**
 * Public endpoint — the TV has no admin credentials and must never be asked
 * for any. It only ever proves it knows the pairing code shown in the
 * dashboard, once, within the code's TTL.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (isRateLimited(`pair:${ip}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pairScreenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const code = normalizePairingCode(parsed.data.pairingCode);

  const [screen] = await db
    .select()
    .from(screens)
    .where(eq(screens.pairingCode, code))
    .limit(1);

  const result = evaluatePairing(screen ?? null, code);

  if (!result.ok) {
    // Deliberately vague — don't reveal which specific reason to a caller
    // brute-forcing codes.
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 401 }
    );
  }

  const token = generateScreenToken();
  const tokenHash = hashScreenToken(token);

  const [updated] = await db
    .update(screens)
    .set({
      screenTokenHash: tokenHash,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(screens.id, screen!.id))
    .returning({ id: screens.id, name: screens.name });

  // The raw token is returned exactly once. The TV must store it locally —
  // the server only ever keeps the hash from this point forward.
  return NextResponse.json({
    screenId: updated!.id,
    screenName: updated!.name,
    screenToken: token,
  });
}
