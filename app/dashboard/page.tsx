import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, screenCollaborators } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { isScreenOnline, formatLastSeen } from "@/lib/screen/online-status";
import { CreateScreenForm } from "@/components/dashboard/create-screen-form";
import { DisconnectScreenButton } from "@/components/dashboard/disconnect-screen-button";
import { CopyCodeButton } from "@/components/dashboard/copy-code-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user is guaranteed non-null here — DashboardLayout redirects otherwise.
  const ownedScreens = user
    ? await db
        .select()
        .from(screens)
        .where(eq(screens.userId, user.id))
        .orderBy(desc(screens.createdAt))
    : [];

  const sharedScreens = user
    ? await db
        .select({ screen: screens })
        .from(screenCollaborators)
        .innerJoin(screens, eq(screens.id, screenCollaborators.screenId))
        .where(eq(screenCollaborators.userId, user.id))
        .orderBy(desc(screens.createdAt))
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your screens</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ownedScreens.length === 0
                ? "Get started by connecting your first TV"
                : `${ownedScreens.length} screen${ownedScreens.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <CreateScreenForm />
        </div>

        {ownedScreens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No screens yet. Click &ldquo;Connect a screen&rdquo; to get a
              pairing code, then open <span className="font-mono">/screen</span> on
              your TV&apos;s browser and enter it.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ownedScreens.map((screen) => {
              const isPaired = screen.screenTokenHash !== null;
              const online = isPaired && isScreenOnline(screen.lastSeenAt);

              return (
                <li
                  key={screen.id}
                  className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/screens/${screen.id}`}
                        className="font-medium underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                      >
                        {screen.name}
                      </Link>
                      {(screen.businessType || screen.address) && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {[screen.businessType, screen.address].filter(Boolean).join(" · ")}
                        </p>
                      )}

                      {isPaired ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span>{online ? "🟢" : "⚪️"}</span>
                          <span>{online ? "Online" : "Offline"}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>Last seen {formatLastSeen(screen.lastSeenAt)}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Not paired — enter code{" "}
                          <CopyCodeButton code={screen.pairingCode} /> on the TV
                        </p>
                      )}
                    </div>

                    {isPaired && <DisconnectScreenButton screenId={screen.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {sharedScreens.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Shared with you</h2>
          <ul className="space-y-3">
            {sharedScreens.map(({ screen }) => (
              <li
                key={screen.id}
                className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-foreground/20"
              >
                <Link
                  href={`/dashboard/screens/${screen.id}`}
                  className="font-medium underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                >
                  {screen.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can add your own media to this screen
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
