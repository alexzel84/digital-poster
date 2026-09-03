import { and, eq, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screenInvites, screens } from "@/lib/db/schema";
import { hashInviteToken } from "@/lib/screen/invite-token";
import { InviteAcceptCard } from "@/components/dashboard/invite-accept-card";
import Link from "next/link";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashInviteToken(token);

  const [invite] = await db
    .select()
    .from(screenInvites)
    .where(and(eq(screenInvites.tokenHash, tokenHash), isNull(screenInvites.acceptedByUserId)))
    .limit(1);

  const invalid = !invite || invite.expiresAt.getTime() < Date.now();

  let screen: { name: string } | undefined;
  if (!invalid && invite) {
    const rows = await db
      .select({ name: screens.name })
      .from(screens)
      .where(eq(screens.id, invite.screenId))
      .limit(1);
    screen = rows[0];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        {invalid || !screen ? (
          <>
            <p className="font-medium">This invite link is invalid or has expired</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the screen&apos;s owner to send you a new one.
            </p>
          </>
        ) : !user ? (
          <>
            <p className="font-medium">You&apos;ve been invited to help manage</p>
            <p className="mt-1 text-lg font-semibold">{screen.name}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Log in or create an account to accept.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href={`/login?next=/invite/${token}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Log in
              </Link>
              <Link
                href={`/signup?next=/invite/${token}`}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Sign up
              </Link>
            </div>
          </>
        ) : (
          <InviteAcceptCard token={token} screenName={screen.name} />
        )}
      </div>
    </div>
  );
}
