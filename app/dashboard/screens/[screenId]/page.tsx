import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, asc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { screens, media, screenMedia, screenCollaborators, users } from "@/lib/db/schema";
import { getDownloadUrl } from "@/lib/storage/r2";
import { getScreenRole } from "@/lib/screen/access";
import { isScreenOnline, formatLastSeen } from "@/lib/screen/online-status";
import { UploadMedia } from "@/components/dashboard/upload-media";
import { MediaList, type MediaListItem } from "@/components/dashboard/media-list";
import { DisconnectScreenButton } from "@/components/dashboard/disconnect-screen-button";
import { CopyCodeButton } from "@/components/dashboard/copy-code-button";
import { ShareScreenButton } from "@/components/dashboard/share-screen-button";
import { CollaboratorsList } from "@/components/dashboard/collaborators-list";
import { RenameScreenForm } from "@/components/dashboard/rename-screen-form";
import { DeleteScreenButton } from "@/components/dashboard/delete-screen-button";
import { DuplicateScreenButton } from "@/components/dashboard/duplicate-screen-button";
import { ScreenDetailsForm } from "@/components/dashboard/screen-details-form";

export default async function ScreenDetailPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const role = await getScreenRole(user.id, screenId);
  if (!role) notFound();

  const isOwner = role === "owner";

  const [screen] = await db.select().from(screens).where(eq(screens.id, screenId)).limit(1);
  if (!screen) notFound();

  const rows = await db
    .select({
      id: media.id,
      filename: media.filename,
      type: media.type,
      mimeType: media.mimeType,
      storageKey: media.storageKey,
      durationSeconds: media.durationSeconds,
      imageDurationSeconds: media.imageDurationSeconds,
      expiresAt: media.expiresAt,
      sortOrder: screenMedia.sortOrder,
      uploaderUserId: media.userId,
      uploaderEmail: users.email,
    })
    .from(screenMedia)
    .innerJoin(media, eq(screenMedia.mediaId, media.id))
    .innerJoin(users, eq(media.userId, users.id))
    .where(eq(screenMedia.screenId, screenId))
    .orderBy(asc(screenMedia.sortOrder));

  const items: MediaListItem[] = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      filename: row.filename,
      type: row.type,
      durationSeconds: row.durationSeconds,
      imageDurationSeconds: row.imageDurationSeconds,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      sortOrder: row.sortOrder,
      uploaderUserId: row.uploaderUserId,
      uploaderEmail: row.uploaderEmail,
      thumbnailUrl:
        row.type === "image"
          ? await getDownloadUrl(row.storageKey).catch(() => null)
          : null,
    }))
  );

  const collaborators = isOwner
    ? await db
        .select({ userId: screenCollaborators.userId, email: users.email })
        .from(screenCollaborators)
        .innerJoin(users, eq(users.id, screenCollaborators.userId))
        .where(eq(screenCollaborators.screenId, screenId))
    : [];

  const isPaired = screen.screenTokenHash !== null;
  const online = isPaired && isScreenOnline(screen.lastSeenAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline">
          ← All screens
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            {isOwner ? (
              <RenameScreenForm screenId={screen.id} initialName={screen.name} />
            ) : (
              <h1 className="text-xl font-semibold tracking-tight">{screen.name}</h1>
            )}
            {!isOwner && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                You&apos;re a contributor on this screen
              </p>
            )}
            {isOwner &&
              (isPaired ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span>{online ? "🟢" : "⚪️"}</span>
                  <span>{online ? "Online" : "Offline"}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>Last seen {formatLastSeen(screen.lastSeenAt)}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Not paired — enter code <CopyCodeButton code={screen.pairingCode} /> on the TV
                </p>
              ))}
            {isOwner ? (
              <ScreenDetailsForm
                screenId={screen.id}
                initialAddress={screen.address}
                initialBusinessType={screen.businessType}
              />
            ) : (
              (screen.address || screen.businessType) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[screen.businessType, screen.address].filter(Boolean).join(" · ")}
                </p>
              )
            )}
          </div>
          {isOwner && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <ShareScreenButton screenId={screen.id} />
                {isPaired && <DisconnectScreenButton screenId={screen.id} />}
              </div>
              <DuplicateScreenButton screenId={screen.id} screenName={screen.name} />
              <DeleteScreenButton screenId={screen.id} screenName={screen.name} />
            </div>
          )}
        </div>
      </div>

      <UploadMedia screenId={screen.id} />
      <MediaList
        screenId={screen.id}
        initialItems={items}
        isOwner={isOwner}
        currentUserId={user.id}
      />

      {isOwner && (
        <CollaboratorsList screenId={screen.id} collaborators={collaborators} />
      )}
    </div>
  );
}
