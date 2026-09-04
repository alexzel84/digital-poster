# PosterDeck (formerly "Digital Poster") — Phase 1

> **Renamed from "Digital Poster" to "PosterDeck."** All user-facing text
> (site title, dashboard header, TV pairing screen, help page, legal
> pages) uses the new name. Internal-only identifiers — the npm package
> name, localStorage/IndexedDB/Cache Storage keys — were deliberately
> left as `digital-poster` to avoid invalidating already-paired TVs'
> local storage; renaming those has no user-visible effect and isn't
> worth the churn.

Turn a TV into a continuously playing digital poster. This is Phase 1 of a
7-phase MVP build: project setup, database schema, authentication, and a
minimal dashboard shell. No screens, pairing, uploads, or playback yet —
those come in Phases 2–4.

## What's in this phase

- Next.js 15 (App Router) + TypeScript + Tailwind, strict mode
- Supabase Auth (email/password) with `@supabase/ssr` cookie-based sessions
- Drizzle ORM schema for `users`, `screens`, `media`, `screen_media`
- Row Level Security policies (`db/migrations/0001_rls_policies.sql`)
- A trigger that mirrors new `auth.users` rows into `public.users`
- `/login`, `/signup`, and an auth-gated `/dashboard` that lists (currently
  empty) screens for the signed-in user
- Middleware that protects `/dashboard` and explicitly never touches
  `/screen` (that route doesn't exist until Phase 2, but the exclusion is
  already in place so the TV player is never gated by admin auth)

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at supabase.com, then copy `.env.example`
   to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings > API
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings > API (keep secret, server-only)
   - `DATABASE_URL` — Settings > Database > Connection string (use the
     "Session pooler" or direct connection string, not the pgbouncer
     transaction-mode one, since `drizzle-kit` needs a direct connection)

   R2 variables can stay blank for now — they're not used until Phase 3.

3. **Run the Drizzle migration** to create the tables:
   ```bash
   npm run db:generate   # generates SQL from lib/db/schema.ts
   npm run db:migrate    # applies it to your Supabase Postgres
   ```

4. **Apply Row Level Security** — open the Supabase SQL editor and run the
   contents of `db/migrations/0001_rls_policies.sql` once, by hand. (Drizzle
   Kit manages table shape, not RLS policies or triggers, so this stays a
   plain SQL file you run directly.)

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## How to test Phase 1

1. Go to `/signup`, create an account with a real-ish email + password.
2. If your Supabase project has email confirmations on, confirm via the
   email link (or turn off "Confirm email" in Supabase Auth settings for
   faster local iteration).
3. Sign in at `/login` — you should land on `/dashboard` and see "No
   screens yet."
4. Confirm a row was created in `public.users` matching your `auth.users`
   row (Supabase Table Editor) — this proves the trigger fired.
5. Sign out, then try visiting `/dashboard` directly while logged out — you
   should be redirected to `/login`.

Before moving to Phase 2, also run:
```bash
npm run typecheck
npm run lint
npm run build
```
All three should pass cleanly.

## Known Phase 1 limitations (expected — not bugs)

- "Connect a screen" button is disabled — screens can be listed but not
  created yet.
- No `/screen` route yet at all.
- R2/media/upload code doesn't exist yet.
- No automated tests yet — Phase 1 has no business logic worth unit testing
  beyond auth wiring, which is better verified manually as above. Expiration,
  manifest sync, playback, and pairing tests land alongside their features
  in later phases.

## Next: Phase 2 — done

Screen creation, pairing codes, screen token issuance, and the `/screen`
pairing UI.

## Phase 3 — R2 uploads, media library, expiration, ordering

### What's new

- Direct-to-R2 uploads: the browser PUTs the file straight to Cloudflare R2
  using a signed URL; large files never pass through the Next.js server.
- `POST /api/media/upload-url` → `POST /api/media/confirm` two-step flow.
  Confirm creates the `Media` row, attaches it to the screen via
  `ScreenMedia` with the next `sortOrder`, and bumps `manifestVersion`.
- `PATCH /api/media/:id` — set/clear expiration, change image display
  duration.
- `DELETE /api/media/:id` — deletes the DB row and the R2 object.
- `PATCH /api/screens/:id/media/order` — persists drag/reorder.
- A per-screen dashboard page at `/dashboard/screens/[screenId]` — upload
  and manage that screen's media there (click a screen name from the main
  dashboard).
- Client-side SHA-256 hashing and video-duration reading before upload
  (`lib/media/client-file.ts`).

### Setup required before this works

You need real Cloudflare R2 credentials in `.env` — the R2_* placeholders
from Phase 1 need real values now:

1. Cloudflare dashboard → R2 → create a bucket (keep it **private**).
2. R2 → Manage API Tokens → create a token with read/write access to that
   bucket. Copy the Account ID, Access Key ID, and Secret Access Key.
3. Fill in `.env`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=your-bucket-name
   ```
   `R2_PUBLIC_URL` can stay blank — Phase 3 uses signed URLs, not a public
   bucket domain.
4. **Add a CORS policy to the bucket** — this step is easy to miss and
   causes uploads to fail silently with a generic error. R2 blocks
   cross-origin browser requests by default, and direct-to-R2 uploads are
   exactly that. In the bucket's Settings tab, add:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Add your production domain to `AllowedOrigins` once deployed.
5. Restart `npm run dev` after editing `.env` (env vars are read at server
   start, same gotcha as Phase 1/2).

### How to test Phase 3

1. From `/dashboard`, click into a screen you created in Phase 2.
2. Drag an image onto the upload area (or tap it to pick a file on
   mobile). Watch the progress percentage, then confirm it appears in the
   list below with a thumbnail, "image", and "8s" duration.
3. Upload an MP4. Confirm it shows "video" and its actual duration (not 8s).
4. Click a media item's status text (e.g. "Never expires"), pick a date,
   click Save. Confirm the status line updates to "Expires <date>".
   Pick a past date and confirm it shows "Expired" in red.
5. Upload 3+ items, use the ▲/▼ buttons to reorder them, refresh the page,
   and confirm the new order persisted (this is proof `sortOrder` round-trips
   through the database, not just local state).
6. Delete an item and confirm it disappears from the list. Check your R2
   bucket dashboard to confirm the object was actually removed, not just
   hidden.

Run `npm run typecheck && npm run lint && npm run build && npm test` before
moving on — same gate as every phase.

### Known Phase 3 limitations (expected)

- Reordering uses up/down buttons, not native drag handles. True
  touch-drag reordering was skipped deliberately: HTML5's native
  drag-and-drop API doesn't work reliably on mobile browsers without extra
  polyfills, and mobile is the primary upload device per the spec. Buttons
  are a reliable, honest MVP substitute; a touch-drag library can replace
  this later without changing the API.
- Video thumbnails aren't generated (no transcoding pipeline yet, per
  spec) — videos show a generic icon instead of a frame preview.
- The manifest itself (what the TV actually fetches and plays) doesn't
  exist yet — that's Phase 4/5. Uploading here doesn't yet make anything
  appear on a paired TV.
- Signed download URLs for thumbnails expire after 1 hour; a long-open
  dashboard tab may show broken thumbnails until refreshed. Fine for MVP.

## Next: Phase 4 — done

The playback engine — portrait rendering, image/video looping,
auto-advance, on the `/screen` route.

## Phase 4 — playback engine

### What's new

- `GET /api/screens/:id/manifest` — the TV's one and only endpoint,
  authenticated purely by a `Bearer <screenToken>` header, never Supabase
  session cookies. Returns active (non-expired), sorted items with
  freshly-signed R2 download URLs.
- `player/PlaybackEngine.ts` — a pure, DOM-free state machine: current
  item, advance (loops at the end), error-skip, and manifest-driven item
  replacement that tries to stay on the same item across updates.
- `player/ManifestManager.ts` — polls the manifest every 60s, only fires
  its callback when the version actually changes, and distinguishes
  "screen was disconnected" (401 → bounce back to pairing) from "network
  is just down" (never shows an error over the content).
- `components/screen/player.tsx` — wires the engine to real `<img>`/
  `<video>` elements: a timer for images, the native `ended` event for
  video, `onError` on either one skips to the next item without stopping
  playback.
- A local, client-clock-based expiration sweep every 30s, independent of
  server reachability, per the spec's offline-expiration requirement.
- `/screen` now actually plays content once paired, instead of the static
  "ready" placeholder from Phase 2/3.

### How to test Phase 4

**Test on a regular desktop browser tab first, per the spec — not a TV yet.**

1. Make sure a paired screen (from Phase 2/3 testing) has at least 2–3
   active media items with expiration left blank ("Never expires").
2. Open `/screen` in the tab that's already paired to that screen (or
   re-pair in a fresh tab/incognito window). Within a few seconds it
   should start playing your uploaded images/videos automatically —
   full-bleed, no UI, no browser chrome.
3. Confirm an image advances on its own after ~8 seconds (or whatever
   duration you set on it in Phase 3), and a video advances right when it
   finishes playing — not before, not stuck after.
4. Let it run past your last item and confirm it loops back to the first
   one, continuously.
5. Rename one image's file to something invalid directly in your R2
   bucket (or temporarily break its URL) and confirm playback skips it and
   keeps going, rather than freezing.
6. While `/screen` is playing, go to `/dashboard`, upload a new item to
   that screen, and wait up to 60 seconds — the new item should join the
   loop without a page reload or any visible interruption to what's
   currently playing.
7. Set an item's expiration to a past date from the dashboard. Within 60
   seconds (next manifest poll) or 30 seconds (local expiry sweep,
   whichever is sooner) it should stop appearing in the loop.
8. Click "Disconnect" on this screen from `/dashboard`. Within 60 seconds
   the `/screen` tab should bounce back to the pairing UI on its own.

Run `npm run typecheck && npm run lint && npm run build && npm test`
before moving on. You should see 5 test files pass now (pairing-logic,
token, media-status, playback-engine, manifest-manager).

### Known Phase 4 limitations (expected)

- **No offline caching yet.** The player streams directly from R2's
  signed URLs — if the network drops mid-playback, whatever's already
  loaded in the browser keeps playing, but nothing new can load until
  connectivity returns. True offline-first caching (Service Worker,
  Cache Storage, IndexedDB) is Phase 5.
- **No wake lock or fullscreen entry UI yet** — those are Phase 6,
  alongside broader error recovery and reconnect hardening.
- Signed URLs refresh every manifest poll (60s), so this isn't a security
  concern, but it does mean the player re-requests the same file's URL
  periodically even though Phase 5's local caching will stop it from
  re-downloading the actual bytes.

## Next: Phase 5 — done

Service Worker, `LocalMediaStore`, and true offline-first manifest
synchronization — so the TV survives a dropped connection without missing
a beat.

## Phase 5 — offline-first sync

### What's new

- `player/LocalMediaStore.ts` — explicit Cache Storage wrapper. This is
  the only place in the app that touches the Cache API; everything else
  asks it for media by id.
- `player/ManifestStore.ts` — IndexedDB record of the last successfully
  synced manifest metadata, so a page reload doesn't force a full
  re-download of everything already cached.
- `player/manifest-diff.ts` — pure diff logic (new / changed / deleted /
  unchanged), fully unit tested per the spec's manifest-sync test list.
- `player/SyncManager.ts` — orchestrates the diff: downloads new/changed
  files into `LocalMediaStore`, deletes obsolete ones, and resolves
  playback items to local blob URLs (with object-URL caching so unchanged
  items don't flicker to a new URL every poll).
- `player/ConnectivityManager.ts` — reacts to the browser's native
  online/offline events and triggers an immediate re-sync the moment
  connectivity returns, rather than waiting for the next scheduled 60s
  poll.
- `public/sw.js` + `lib/screen/register-sw.ts` — a deliberately thin
  Service Worker. It doesn't intercept fetches or implement its own
  caching strategy; all caching logic stays in `LocalMediaStore` where
  it's testable. The worker's only job is existing, since some browsers
  keep Cache Storage warmer across reloads when one is registered.
  Registration fails silently on browsers without Service Worker support.

### How to test Phase 5

1. With a screen already playing (from Phase 4), open DevTools > Application
   (Chrome) > Cache Storage. Confirm a `digital-poster-media-v1` cache
   exists and contains entries — that's your uploaded media actually
   sitting in the browser now, not just streaming from R2 each time.
2. Also check Application > IndexedDB > `digital-poster` > `manifest` —
   confirm it holds an array of media metadata (ids and hashes).
3. **The real test:** with `/screen` actively playing, open DevTools >
   Network tab and switch to "Offline" (or turn off your wifi). Watch
   playback keep looping through your existing items with no error shown
   — this is the whole point of this phase.
4. While still offline, confirm the browser tab doesn't show any "no
   internet" UI — just the content, uninterrupted.
5. Turn network back on. Within a few seconds (not the full 60s) it should
   sync — check the console for a fresh `NETWORK_ONLINE` log line
   triggered by the browser's own online event, not just the next
   scheduled poll.
6. Upload a new item from the dashboard while `/screen` is offline, then
   reconnect. Confirm the new item eventually joins the loop once back
   online (it has to actually download this time, so it may take a moment
   longer than an already-cached item would).
7. Delete an item from the dashboard, wait for the next sync, then check
   Cache Storage again — confirm that item's entry is actually gone, not
   just hidden from the playback loop.

Run `npm run typecheck && npm run lint && npm run build && npm test`
before moving on. You should see 6 test files pass now, including the new
`manifest-diff` tests (7 tests) covering unchanged/new/deleted/changed
manifest scenarios exactly as the spec's test plan calls for.

### Known Phase 5 limitations (expected)

- **Network-URL fallback, not strict local-only.** If an item hasn't
  finished downloading yet (or its download failed), the player falls
  back to the signed network URL rather than refusing to show it. This is
  a deliberate MVP trade-off — documented in `SyncManager.ts` — that
  avoids unnecessarily delaying new content while still keeping the
  common case (everything already cached) fully offline-capable.
- **No storage quota management yet.** `LocalMediaStore` fails soft on
  quota errors (logs and skips), but doesn't proactively evict old items
  to make room. For an MVP-scale poster (handful of images/short videos),
  this is unlikely to matter; a real eviction policy is a good candidate
  for post-MVP hardening.
- **Cache Storage/IndexedDB support varies across embedded TV browsers.**
  Both `LocalMediaStore` and `ManifestStore` detect missing support and
  degrade to "nothing cached, always fetch fresh" rather than crashing —
  but that means some low-end TV browsers may not get true offline
  playback even after this phase, only best-effort.
- Wake lock and fullscreen entry are still Phase 6, alongside broader
  error recovery and reconnect UX polish.

## Next: Phase 6 — done

Wake lock, error recovery, reconnect behavior, fullscreen entry, and
production hardening.

## Phase 6 — wake lock, fullscreen, and hardening

### What's new

- `player/WakeLockManager.ts` — requests the Screen Wake Lock API when
  playback starts, re-requests it automatically when the tab becomes
  visible again (wake locks are released on backgrounding by design), and
  fails completely silently on browsers without support.
- `lib/screen/fullscreen.ts` + `components/screen/start-screen.tsx` — a
  one-time "Start" screen shown right after pairing. Tapping it is the
  user gesture browsers require before granting fullscreen, and also
  triggers the first wake lock request. After tapping, all further UI is
  gone (the cursor is hidden too) for the rest of the session.
- `/help/keep-tv-awake` — a plain help page (linked from the Start screen)
  explaining how to disable sleep timers, screensavers, and energy-saving
  modes on Samsung, LG, Fire TV, and Android TV/Google TV, since wake lock
  support varies a lot across embedded TV browsers.
- `app/screen/error.tsx` — a production error boundary. If something
  genuinely crashes the player (distinct from a single media item failing
  to load, which was already handled without crashing back in Phase 4),
  the TV shows a plain black recovery screen instead of a raw error page.
- **Reconnect behavior** was already covered by earlier phases and isn't
  duplicated here: a disconnected screen (401 from the manifest endpoint)
  bounces back to the pairing UI (Phase 2/4), the browser's native
  online/offline events trigger an immediate re-sync (Phase 5), and a
  full page reload rebuilds state cleanly from the locally stored token
  (Phase 2). Phase 6 only adds what was still missing: wake lock,
  fullscreen, and the crash boundary.

### How to test Phase 6

1. Open `/screen` fresh on an already-paired screen (clear localStorage or
   use a new profile if needed to see the pairing flow again first, then
   pair). After pairing succeeds, confirm you see the new "Your screen is
   ready. Tap below to start playing." screen with a Start button — not
   playback yet.
2. Click Start. Confirm the browser enters fullscreen (or at least
   attempts to — some browsers/OSes restrict this) and that playback
   begins immediately after.
3. Move your mouse over the playing content — confirm the cursor is
   hidden (CSS `cursor: none`).
4. Open DevTools > Application > (search "wake lock" isn't directly
   visible in most browsers' DevTools, so instead) just confirm no
   console errors appear related to wake lock — Chrome on a laptop with
   the lid open should acquire it silently. This is hard to visually
   verify without an actual screen-off timeout, so trust the console log
   absence of errors as the practical signal here.
5. Switch to a different browser tab for a few seconds, then switch back
   to `/screen`. This simulates the wake lock being released and
   reacquired — check for no errors in the console around that moment.
6. Visit `/help/keep-tv-awake` directly and confirm it renders — this is
   meant to be read by the business owner on their phone, not on the TV
   itself.
7. Force an actual crash to test the error boundary: temporarily add
   `throw new Error("test")` near the top of the `Player` component's
   function body, reload `/screen`, confirm you see the plain black "Something
   went wrong" screen (not Next.js's dev overlay) with a working "Try
   again" button, then remove the test line.

Run `npm run typecheck && npm run lint && npm run build && npm test`
before moving on. You should see 7 test files pass now, including the new
`wake-lock-manager` tests confirming graceful degradation when the API is
unsupported.

### Known Phase 6 limitations (expected)

- Wake lock and fullscreen genuinely can't be verified end-to-end without
  a real screen-off timeout or a real TV browser — the manual test above
  is a reasonable proxy (no console errors, cursor hidden, fullscreen
  attempted) but isn't the same as leaving a real Samsung/LG TV running
  for hours. Real hardware testing before shipping is still worth doing.
- Some embedded TV browsers may reject both Fullscreen and Wake Lock APIs
  outright even from a genuine tap — this is expected and by design
  handled as a silent no-op, not a bug, per the spec's own note that
  Smart TV browser support varies.
- This is the last phase in the original 6-phase plan focused on new
  functionality. What's left is polish: revisiting copy/spacing across
  the dashboard, and a final pass making sure every error-handling case
  from the spec's section 29 list has been exercised at least once.

## Phase 7 — UX polish

### What's new

- **Real online/offline status**, matching the spec's own example
  (`🟢 Online` / `Last seen 2 minutes ago`) — computed from `lastSeenAt`
  against the 60s poll interval (with a small grace window), not just a
  static "Paired" label. Shown on both the main dashboard and each
  screen's detail page.
- **Copy-to-clipboard on pairing codes** — since the business owner reads
  the code off their phone, a tap-to-copy button is a small but real
  convenience for typing it into a TV remote's on-screen keyboard.
- **No more silent failures.** `DisconnectScreenButton`, media delete,
  expiration editing, and reordering all previously ignored a failed
  request and just sat there looking like it worked. They now check the
  response, show an inline error, and (for reordering specifically) roll
  back the optimistic UI update if the server rejected it.
- **A styled "Screen not found" page** for `/dashboard/screens/[id]`
  instead of Next's generic 404, for a mistyped URL or a screen that was
  deleted/isn't yours.
- Minor dashboard visual polish: clearer empty state copy, a screen count
  subheading, consistent status styling shared between the list and
  detail pages.
- **Per-image play duration editor.** The spec calls for "allow the user
  to change duration per image" — the backend for this existed since
  Phase 3 (`PATCH /api/media/:id` already accepted `imageDurationSeconds`)
  but no UI ever exposed it. Click an image's "image · 8s" text in the
  media list to edit it inline (1–300 seconds), same interaction pattern
  as the expiration editor. Videos aren't editable here since they play
  for their natural duration, not a configured one.

### How to test Phase 7

1. Pair a screen and leave `/screen` open and playing. On the dashboard,
   confirm it shows 🟢 Online within a few seconds.
2. Close the `/screen` tab entirely (or turn off its network). Wait about
   90 seconds, then refresh the dashboard — it should flip to ⚪️ Offline
   with a "Last seen X ago" that keeps growing.
3. Click a pairing code on an unpaired screen — confirm it copies (paste
   it somewhere to check) and shows a brief "Copied" confirmation.
4. Temporarily turn off your WiFi, then try clicking Disconnect on a
   paired screen or Delete on a media item — confirm you now see a red
   inline error message instead of the button just quietly doing nothing.
   Turn WiFi back on afterward.
5. Visit a screen URL with a random/wrong UUID, e.g.
   `/dashboard/screens/00000000-0000-0000-0000-000000000000` — confirm
   you see the styled "Screen not found" page, not a raw Next.js 404.

Run `npm run typecheck && npm run lint && npm run build && npm test`
before wrapping up. You should see 8 test files pass now, including the
new `online-status` tests.

## Screen sharing (owner + contributors)

This is beyond the original 7-phase spec — added by request, kept
deliberately minimal per the spec's own "no teams/permissions" MVP
philosophy. There are exactly two roles, no granular permissions:

- **Owner** (whoever created the screen): full control — pairing code,
  disconnect, reorder the queue, edit/delete any media on the screen
  (including a contributor's uploads), invite/remove people.
- **Contributor** (someone the owner shared the screen with): can upload
  their own media to the screen, and edit the expiration/duration or
  delete *only their own* uploaded items. Can't see the pairing code,
  can't disconnect the screen, can't reorder the queue, can't touch
  anyone else's media.

### How sharing works

There's no email-sending infrastructure — the owner generates a link and
sends it however they want (copy-paste into their own email, text
message, Slack, whatever). This deliberately avoids adding a transactional
email service as a new dependency for an MVP.

1. On a screen's detail page, the owner clicks **Share screen** →
   generates a one-time invite link (`/invite/<token>`), valid 7 days,
   single-use. The raw token is never stored — only its hash, same pattern
   as screen pairing tokens.
2. The owner copies and sends that link themselves.
3. Whoever opens it either logs in or signs up (redirected back to the
   invite afterward via a `?next=` param threaded through login/signup/the
   email-confirmation callback), then clicks **Accept and join**.
3. They become a contributor: the screen now shows up under **"Shared
   with you"** on their dashboard, and they can upload media to it —
   which shows up in the owner's view labeled "Added by their@email.com".
4. The owner can remove anyone's access anytime from the **"People with
   access"** list on the screen's detail page.

### Setup after pulling this in

Two new tables (`screen_collaborators`, `screen_invites`) need a fresh
migration:
```bash
npm run db:generate
npm run db:migrate
```
Then run `db/migrations/0002_collaborators_rls.sql` in the Supabase SQL
editor, same as the earlier RLS files — it's not applied automatically.

### How to test

1. As the screen owner, generate a share link and copy it.
2. Open it in an incognito window (simulating a different person). Sign
   up for a brand-new account there.
3. Confirm you land back on the invite page after signup/login (not just
   dropped on the generic dashboard), and that clicking "Accept and join"
   takes you to the shared screen.
4. As the contributor, upload an image. Confirm it appears in the shared
   screen's media list.
5. Switch back to the owner's browser/account, refresh the screen page —
   confirm the contributor's upload shows up labeled "Added by
   <their email>", and that the owner can edit its expiration or delete it
   (owner has full control over everyone's items).
6. Still as the contributor, try to edit or delete a media item the
   *owner* uploaded — confirm there's no edit/delete control shown for it
   at all (read-only for anything not yours).
7. Confirm the contributor's view has no pairing code, no Disconnect
   button, no ▲▼ reorder buttons, and no Share button anywhere.
8. As the owner, click Remove next to the contributor's email in "People
   with access." Confirm the screen disappears from that person's
   dashboard on their next visit.

Run `npm run typecheck && npm run lint && npm run build && npm test`
— you should see 10 test files pass now, including the new
`invite-token` tests.

### Known limitations of this feature (by design, for MVP)

- No email is actually sent — the owner shares the link themselves. Real
  transactional email (e.g. via Resend) is a reasonable next step if this
  becomes a real pain point, not added now to avoid a new infrastructure
  dependency for an MVP.
- Exactly two roles, no customization — matches what was asked for
  ("not full control... just add their own media and set up only its
  media schedule"). A richer permissions system would be real scope creep
  beyond this request.
- An invite link, once generated, isn't revocable on its own before
  acceptance (only after — via removing the resulting collaborator). For
  MVP scale this is an acceptable gap; a "revoke pending invite" action
  would be a small, easy follow-up if needed.

## Rename and delete a screen

Two small owner-only gaps, added after noticing they were missing:

- **Rename**: click the screen name itself on its detail page (owner only)
  — same inline-edit pattern as everything else in the dashboard.
- **Delete**: a "Delete screen" link on the detail page, owner only.
  Permanently removes the screen and, importantly, cleans up any media
  that was *only* attached to that screen (both the database row and the
  actual R2 file) — so deleting a test screen doesn't leave orphaned files
  silently costing storage forever. Media still attached to another screen
  (in principle — the current upload flow always attaches to exactly one
  screen, but the data model allows more) is left untouched.

No migration needed for this — no schema changes, just new API routes
(`PATCH`/`DELETE /api/screens/:id`) and UI.

### How to test

1. Create a throwaway test screen, upload one image to it.
2. Click the screen's name on its detail page, type a new name, press
   Enter or click Save — confirm it updates immediately and persists
   after a refresh.
3. Click "Delete screen," confirm the warning dialog, confirm it redirects
   to the main dashboard and the screen is gone from the list.
4. Check your R2 bucket — confirm the image you uploaded to that screen
   is actually gone, not just hidden.
5. As a contributor (not owner) on a *different* screen, confirm you
   don't see a rename control or delete option at all — screen name should
   render as plain, non-interactive text.

Run `npm run typecheck && npm run lint && npm run build && npm test`.

## Duplicate a screen (multiple TVs, same content)

For the case where you want several physical TVs showing identical
content (e.g. 3 TVs in a lobby all playing the same poster rotation),
without re-uploading everything for each one.

**Deliberately not implemented:** a single shared pairing code/token
across multiple physical TVs. That would break per-device online/offline
status, and disconnecting would kick every TV off at once instead of
just one. Each physical TV still pairs independently and keeps its own
status.

**What it does instead:** "Duplicate to a new screen" on a screen's
detail page (owner only) creates a brand-new screen — its own pairing
code, its own independent media rows you can edit/delete without
affecting the original — but reuses the exact same files in R2. Nothing
gets re-uploaded, so this costs no extra storage. The only place bytes
actually get duplicated is each physical TV's own local offline cache
(Phase 5), which is unavoidable either way.

This required a correctness fix alongside it: deleting a media item, or
deleting a whole screen, now checks whether any *other* media row still
references the same R2 file before actually deleting it from storage.

### How to test

1. Set up a screen with 2-3 media items, some with expiration dates set.
2. Click "Duplicate to a new screen," confirm it redirects to a new
   screen with all the same media, order, durations, and expirations —
   plus its own fresh, unused pairing code.
3. Edit an item's expiration on the *new* screen, then confirm the
   *original* screen's copy is unaffected.
4. Delete an item from the new screen only. Check R2 — the file should
   still be there (the original screen's copy still references it).
5. Delete that same item from the original screen too. Only now should
   the R2 file actually disappear.

Run `npm run typecheck && npm run lint && npm run build`.

## Screen address and business type

Two optional fields on each screen (not the user account, since one
owner can have screens at different locations/businesses): address and
type of business, both free text.

### Setup — needs a fresh migration

```bash
npm run db:generate
npm run db:migrate
```
No RLS changes needed — these are just two new nullable columns on the
existing `screens` table, already covered by the existing policies.

### Where to find it

- **On creation**: the "Connect a screen" form now has two more optional
  fields under the name.
- **On an existing screen**: click the small "Add address / business
  type" text under a screen's name/status on its detail page (owner
  only) to add or edit them later.
- Shown as a subtitle under the screen name on the main dashboard list
  too, when filled in.
- **Duplicating a screen** carries these over automatically, since a
  duplicate is usually for the same physical location.

### How to test

1. Create a new screen, fill in both fields, confirm they show up on the
   dashboard list and the screen's detail page.
2. Create another screen leaving both blank — confirm nothing broken,
   just shows "Add address / business type" as a prompt instead.
3. Click that prompt on the blank one, fill it in, save, confirm it
   updates immediately.
4. As a contributor (not owner) on a shared screen, confirm you see the
   address/business type as plain read-only text (if set) with no way to
   edit it.

Run `npm run typecheck && npm run lint && npm run build`.

Every core product requirement from the spec has a real, tested
implementation: accounts and screens, pairing without admin credentials on
the TV, direct-to-R2 uploads with no publish step, expiration enforced
both server- and client-side, offline-first playback that survives a
dropped connection, wake lock/fullscreen for unattended TV use, a
dashboard that gives honest, real-time feedback instead of silently
failing, minimal owner/contributor screen sharing, full screen
lifecycle management (create, rename, duplicate, disconnect, delete), and
per-screen address/business-type metadata. It's deployed and running
live on Vercel.

## Privacy Policy, Terms of Service, and signup consent

**This is not legal advice, and neither are the pages this adds** — see
the important caveat at the end of this section.

### What this adds

- `/privacy` and `/terms` — plain pages describing what the app actually
  does with data today (Supabase for auth/DB, Cloudflare R2 for files,
  Vercel for hosting; no ads, no analytics, no selling data) and basic
  terms of use. Both have `[PLACEHOLDER]` values (company name, contact
  email, governing law, last-updated date) you need to fill in, and both
  have a visible banner marking them as a starting template.
- Signup now has a **required** checkbox — "I agree to the Terms of
  Service and Privacy Policy" — linking to both pages. The submit button
  is disabled until it's checked.
- The exact moment of consent is recorded: a new `terms_accepted_at`
  column on the `users` table, populated via Supabase's signup metadata
  and a small update to the existing signup trigger — this works whether
  or not email confirmation is required, since it's captured immediately
  at signup rather than needing a later authenticated API call.

### Setup — needs a fresh migration

```sql
alter table users add column if not exists terms_accepted_at timestamptz;
```
Then also run the updated trigger function from
`db/migrations/0004_terms_consent.sql` in the Supabase SQL editor — it
replaces the `handle_new_user` trigger from `0001_rls_policies.sql` with
a version that also captures consent timestamp at signup.

### Before this is real

- **Fill in every `[PLACEHOLDER]`** in both pages — company/entity name,
  a real contact email, your actual jurisdiction, and a real "last
  updated" date.
- **Have someone with legal expertise review both pages** before relying
  on them for actual customers, especially if you'll have users in the
  EU (GDPR), California (CCPA/CPRA), or other regions with their own
  requirements — those have specific rules about what a valid privacy
  policy and consent flow need to include that go beyond what's written
  here.
- This covers the *signup* consent flow. It does not implement things
  like a full account-deletion self-service flow, a cookie-consent
  banner (not currently needed since only an essential auth cookie is
  used, but worth re-checking if that changes), or data export — add
  those if/when you determine you need them.

### How to test

1. Go to `/signup`. Confirm the "Create account" button is disabled until
   you check the consent checkbox.
2. Click the Terms/Privacy links — confirm they open the actual pages in
   a new tab.
3. Complete signup with the box checked. In Supabase's Table Editor,
   check the `users` table — confirm the new row has a real timestamp in
   `terms_accepted_at`, not null.

Run `npm run typecheck && npm run lint && npm run build`.

## Forgot password

Standard Supabase Auth password recovery — no new database columns, no
new Supabase redirect URL needed (it reuses the existing `/auth/callback`
route with a different `?next=` value, same trick as the invite flow).

### What's new

- "Forgot password?" link next to the password field on `/login`.
- `/forgot-password` — enter your email, get a reset link. Shows the same
  message whether or not the email has an account, so it doesn't leak
  which emails are registered.
- `/reset-password` — where the emailed link lands (via `/auth/callback`
  exchanging the code for a temporary recovery session first). Set a new
  password here. If someone reaches this page without a valid recovery
  session (e.g. an expired or reused link), it shows an explicit "this
  link is invalid or expired" message with a link back to
  `/forgot-password`, rather than a confusing broken form.

### How to test

1. Go to `/login`, click "Forgot password?"
2. Enter a real test account's email, submit. Confirm you see the "check
   your inbox" message.
3. Check your email (or Supabase's Auth logs if using a test project
   without real email delivery configured) for the reset link. Click it.
4. Confirm you land on `/reset-password` with an actual form, not the
   "invalid link" message.
5. Set a new password, confirm it redirects you straight to `/dashboard`
   already logged in.
6. Log out, log back in with the NEW password to confirm it actually
   took effect.
7. Visit `/reset-password` directly without ever clicking a real link —
   confirm it shows the "invalid or expired" message instead of a broken
   form.

Run `npm run typecheck && npm run lint && npm run build`.

## Address autocomplete (Google Places)

Optional — the address field works as a plain text input either way.
When a Google Maps API key is configured, typing in the address field
shows real address suggestions instead.

### Setup

1. In Google Cloud Console, for the project tied to your API key, make
   sure both **"Maps JavaScript API"** and **"Places API"** are enabled
   (Google Cloud > APIs & Services > Library — search and enable each).
   A key without these enabled will fail silently (falls back to a plain
   input, per the design below) rather than erroring visibly.
2. **Restrict the key** (Google Cloud > APIs & Services > Credentials >
   your key > Application restrictions): set it to "Websites" and add
   `http://localhost:3000/*` and your production domain
   (`https://your-app.vercel.app/*` or your custom domain). This key is
   used client-side (it has to be, for the autocomplete widget to run in
   the browser), so this restriction is what actually keeps it from
   being usable by anyone who happens to see it in your page source.
3. Add it locally: `.env` → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key`.
4. Add it in Vercel: Settings > Environment Variables > new variable,
   name `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Since it starts with
   `NEXT_PUBLIC_`, Vercel will ask Secret vs Config — same as the
   Supabase public variables, choose **Config** (it's meant to be public;
   the URL-restriction from step 2 is the actual security boundary, not
   secrecy).
5. Restart `npm run dev` locally / redeploy on Vercel.

### Design note — this fails soft, on purpose

`lib/screen/load-google-maps.ts` and
`components/dashboard/address-autocomplete-input.tsx` are the only two
files that know about Google Maps. If the key is missing, not yet
configured, or Google's script fails to load for any reason, the address
field just silently behaves like a normal text input — it never blocks
screen creation or shows an error. This matches the spec's own guidance
on isolating external integrations behind an adapter with a working
fallback.

### How to test

1. With the key configured, start creating a screen and type a few
   characters into the Address field — confirm a dropdown of real address
   suggestions appears, and selecting one fills in the full formatted
   address.
2. Same test on the "Add address / business type" editor on an existing
   screen's detail page.
3. Temporarily remove/comment out `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from
   `.env`, restart the dev server, and confirm the address field still
   works fine as a plain text input with no errors in the console.

Run `npm install` (to pull in `@types/google.maps`), then
`npm run typecheck && npm run lint && npm run build`.

## Fix: startup could hang forever on some commercial-display browsers

Real hardware testing on a Samsung QM32C (a commercial signage display)
found that both the manual "Start" button and the 2-second auto-start
fallback got stuck on the black start screen indefinitely — playback
never began at all, even after a full power cycle ruled out caching.

**Root cause:** `handleStart()` does `await enterFullscreen()` then
`await wakeLockRef.current.request()`. Both of those already had
try/catch around them — but a try/catch only helps if the underlying
promise actually rejects. Some embedded/commercial-display browsers have
incomplete Fullscreen API and/or Wake Lock API implementations where the
returned promise never resolves OR rejects — it just hangs forever. An
`await` on a promise that never settles blocks forever, which meant
playback could never start on that hardware, regardless of how it was
triggered.

**Fix:** both `lib/screen/fullscreen.ts` and `player/WakeLockManager.ts`
now race the actual browser API call against a 1.5s timeout. If the API
hasn't settled by then, it's treated as a failure (logged, not fatal) and
execution moves on immediately. Fullscreen and wake lock remain
best-effort nice-to-haves; this just guarantees neither can block
playback from starting, no matter how badly a given browser implements
either API.

### How to test

Hard to fully simulate the exact hang on a normal browser, but at
minimum:
1. Run the existing test suites (`npm test`) — confirm
   `wake-lock-manager.test.ts` still passes (it exercises the
   unsupported-API path, which is unaffected by this change).
2. Manually retest Start/auto-start on a regular browser and TV — confirm
   no regression, still starts promptly.
3. **Most importantly**: retest on the actual Samsung QM32C. This is the
   one environment where the original bug was reproducible, so it's the
   real confirmation this fix works.

Run `npm run typecheck && npm run lint && npm run build && npm test`.

## Fix: pairing required a manual refresh on some TVs

After the fullscreen/wake-lock hang fix above, pairing worked and
playback started — but only after manually refreshing the page. The
in-session React transition from the pairing screen straight to the
Player component worked unreliably on the same commercial-display
hardware; a genuine fresh page load worked every time.

**Fix:** rather than root-causing the exact browser quirk, `PairingForm`
now calls `window.location.reload()` immediately after a successful pair
(the token is already saved to `localStorage` by then), so the app lands
back in the Player via a completely fresh page load automatically — no
one needs to be physically at the TV to press refresh.

### How to test

1. Pair a fresh screen on a regular browser — confirm it still reloads
   and starts playing smoothly, no regression.
2. Retest the full pairing flow on the actual Samsung QM32C — confirm it
   now plays automatically right after entering the code, with no manual
   refresh needed.

Run `npm run typecheck && npm run lint && npm run build`.
