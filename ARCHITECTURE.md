# PosterDeck — Architecture & Handoff Guide

This document is for an engineer picking up this codebase for the first
time. It's organized by topic, not chronologically — for the
phase-by-phase build history and detailed testing notes for every
individual feature, see `README.md` in the repo root, which is more of a
build log than a reference.

---

## 1. What this is

PosterDeck turns any TV into a continuously-playing digital poster. A
business owner uploads images/videos from their phone; any TV with a
browser can be paired to a "screen" and will loop through that content
indefinitely, working offline once media is cached locally. It's built
to be as simple as Dropbox or Google Photos, not enterprise digital
signage software — deliberately no campaigns, playlists, zones, or
scheduling complexity.

Live at: **posterdeck.app** (Vercel + Supabase + Cloudflare R2).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript, strict mode |
| Styling | Tailwind CSS |
| Auth + Database | Supabase (Postgres + Auth) |
| ORM | Drizzle ORM, `postgres-js` driver |
| Media storage | Cloudflare R2 (S3-compatible), signed URLs |
| Email | SendGrid via Supabase custom SMTP |
| Address autocomplete | Google Places API (optional, degrades gracefully) |
| Hosting | Vercel |
| Tests | Vitest |

---

## 3. The two apps inside one codebase

This is the single most important architectural fact about the project.
There are **two completely separate applications** sharing one Next.js
project, one database, and one deploy:

- **`/dashboard`** — the admin UI. Full React app, Supabase session-cookie
  auth, used by business owners on their phone/laptop.
- **`/screen`** — the TV player. A deliberately tiny, dependency-light
  client bundle. Authenticated by a **hashed bearer token**, never
  Supabase session cookies, never admin credentials. The TV must never be
  able to see or derive admin access.

These two route trees do not share components. `/screen` never imports
anything from `components/dashboard`, and vice versa — this keeps the TV
bundle small and keeps a compromised/cloned TV device from ever getting
admin capability.

A third, much smaller surface: **`/admin`** (the founder dashboard — see
§10). Gated by an email allowlist in an env var, not a database flag.

---

## 4. Directory structure

```
app/
  (auth)/login, signup, forgot-password, reset-password/   — admin auth pages
  dashboard/                                                — admin UI
    page.tsx                                                — screen list
    screens/[screenId]/page.tsx                              — the big one; per-screen management
    settings/page.tsx                                        — change password
  screen/                                                    — the TV player route
    page.tsx → components/screen/screen-app.tsx              — state machine entry point
  admin/                                                      — founder-only internal dashboard
  api/                                                        — all backend routes (see §7)
  invite/[token]/page.tsx                                     — screen-sharing invite acceptance
  help/keep-tv-awake/page.tsx                                 — static help content
  privacy/, terms/                                            — legal pages

components/
  dashboard/    — admin-only UI components
  screen/       — TV-only UI components (pairing form, start screen, player)
  ui/           — shared primitives (Button, Input)
  admin/        — founder dashboard components

player/         — the TV playback engine, plain TypeScript classes, NO React
  PlaybackEngine.ts       — pure state machine: what plays next, looping, error-skip
  ManifestManager.ts      — polls the manifest every 60s
  SyncManager.ts          — offline-first reconciliation (diff, download, cache)
  LocalMediaStore.ts      — Cache Storage wrapper (the TV's local media cache)
  ManifestStore.ts        — IndexedDB record of last-synced manifest
  ConnectivityManager.ts  — reacts to browser online/offline events
  WakeLockManager.ts      — Screen Wake Lock API wrapper
  manifest-diff.ts        — pure diff logic (new/changed/deleted/unchanged)

lib/
  db/schema.ts            — the entire data model, single source of truth
  db/index.ts             — Drizzle client
  supabase/               — client.ts (browser), server.ts (SSR + admin), middleware.ts
  screen/                 — pairing codes, tokens, invite tokens, access control, admin-access
  storage/r2.ts            — the ONLY file that touches the R2/S3 SDK directly
  media/                  — status logic, shared delete/access helpers
  validation/             — Zod schemas per resource

db/migrations/            — see §9, this is NOT what it looks like
```

---

## 5. Data model

Defined in `lib/db/schema.ts`. Key tables:

- **`users`** — mirrors `auth.users`, kept in sync by a Postgres trigger
  (`handle_new_user`, see `db/migrations/0001_rls_policies.sql` and
  `0004_terms_consent.sql`). Also stores `terms_accepted_at`.
- **`screens`** — one row per physical TV. `pairing_code` +
  `pairing_code_expires_at` for the unpaired state, `screen_token_hash`
  once paired (raw token never stored — see §6). `manifest_version` is
  bumped on any change so the TV's poll can cheaply detect "did anything
  change" without diffing content every time. Also holds `address` and
  `business_type` (optional, free text).
- **`media`** — one row per uploaded file *reference* (not necessarily
  per physical file — see the R2/storageKey note in §5.1).
  `cloned_from_id` (nullable, self-referencing) tracks duplication
  lineage — always points at the root, never chained.
- **`screen_media`** — the join table between screens and media. This is
  a genuine many-to-many relationship: one media row can be attached to
  multiple screens (see §8's "cross-screen linking"), each attachment
  having its own `sort_order`.
- **`screen_collaborators`** / **`screen_invites`** — minimal
  owner/contributor sharing (§8).

### 5.1 — Important: media rows vs. actual files

A `media` row's `storage_key` points at an R2 object, but **multiple
media rows can share the same `storage_key`** — this is deliberate, not
a bug:

- **Screen duplication** creates a new independent `media` row (so it can
  be edited/deleted separately) but reuses the same file — no
  re-upload, no extra storage cost.
- Because of this, **every delete path must check whether any other
  media row still shares the `storage_key` before actually deleting the
  R2 object.** This logic lives in `lib/media/delete-media.ts`
  (`deleteMediaCompletely`) — always call this rather than writing a new
  ad-hoc delete, or you will risk deleting a file another screen is still
  using.

### 5.2 — "Also on" vs "Also duplicated to"

Two visually similar but architecturally different things show up in the
media list UI:

- **"Also on: Screen X"** — a *real* link. Same `media.id` attached to
  multiple screens via `screen_media`. Editing it anywhere edits it
  everywhere. Removable per-screen.
- **"Also duplicated to: Screen X"** — a *different* `media.id` that
  shares `cloned_from_id` ancestry. Independent, not removable from here
  (go to that screen and delete its own copy). This distinction exists
  specifically to prevent a real bug: without it, duplicating a screen
  and then using "also show on" to link back to the origin screen created
  a visually duplicate entry. See the family-tracking logic in
  `app/dashboard/screens/[screenId]/page.tsx`.

---

## 6. Authentication & authorization — three separate systems

Don't assume these are unified; they're intentionally not.

1. **Admin auth** — Supabase Auth, cookie-based session, via
   `@supabase/ssr`. `lib/supabase/{client,server,middleware}.ts`.
   Middleware only redirects unauthenticated users away from
   `/dashboard`; every other route does its own check in a layout or
   page (the middleware redirect is a UX nicety, not the security
   boundary).

2. **Screen (TV) auth** — a raw, high-entropy bearer token, generated once
   at pairing time (`lib/screen/token.ts`), stored **hashed** in
   `screens.screen_token_hash`. The raw token lives only in the TV
   browser's `localStorage` (`lib/screen/local-auth.ts`) and in the
   pairing response — never persisted server-side, never derivable from
   the hash. The manifest endpoint (`app/api/screens/[id]/manifest`)
   authenticates purely via `Authorization: Bearer <token>`, nothing
   else. A 401 here means "disconnected" and the player bounces back to
   pairing.

3. **Screen role (owner/contributor)** — `lib/screen/access.ts`,
   `getScreenRole()`. Two roles only, deliberately not a general
   permissions system:
   - **Owner**: full control (pairing, disconnect, reorder, delete/edit
     anyone's media on their screen, invite/remove collaborators).
   - **Contributor**: can upload their own media and edit/delete *only
     their own* uploads. No pairing code visibility, no disconnect, no
     reorder.
   - `lib/media/access.ts`'s `canManageMedia()` is the actual enforcement
     point most API routes call — it's not just "isOwner", it correctly
     handles "owner of a screen this media is attached to" too.

4. **Founder/admin** (`/admin`) — a fourth, much simpler tier:
   `lib/screen/admin-access.ts` checks the logged-in user's email against
   `ADMIN_EMAILS` (comma-separated env var, server-only, never a database
   column). Non-matching users get a plain 404, not a "no permission"
   page — deliberately doesn't reveal the panel exists.

**A general note on RLS**: Supabase Row Level Security policies exist
(`db/migrations/0001...sql`, `0002_collaborators_rls.sql`) but they are
**defense-in-depth, not the primary enforcement mechanism**. All of the
app's own API routes connect via Drizzle over a direct Postgres
connection (effectively bypassing RLS), so the actual security boundary
is the ownership/role checks written into each route handler. RLS matters
if/when anything ever queries Supabase directly from the client via
`supabase-js` instead of going through the app's own API.

---

## 7. API surface (`app/api/`)

Grouped by resource. All except `/screens/[id]/manifest` and
`/screens/pair` require an authenticated admin session.

- `screens/` — create, rename/update (`PATCH /screens/:id`), delete
  (cleans up now-orphaned media, see §5.1), duplicate, pair (public,
  rate-limited — `lib/screen/rate-limit.ts`, **in-memory, not distributed
  across serverless instances**, a known MVP limitation), unpair
  (disconnect + regenerate pairing code), invite, collaborators, media
  ordering.
- `screens/[id]/manifest` — **the only endpoint the TV ever calls.**
  Bearer-token auth. Returns active (non-expired), sorted items with
  freshly-signed R2 download URLs.
- `media/` — upload-url (signed PUT), confirm (creates the DB row after
  upload), `PATCH`/`DELETE /media/:id`, plus `media/:id/screens` (the
  cross-screen linking endpoints — POST to attach, DELETE to detach,
  auto-fully-deletes if that was the last screen it was on).
- `invites/accept` — redeems a screen-sharing invite token.

---

## 8. Feature-by-feature quick reference

Beyond the original spec's 7 phases (accounts → pairing → uploads →
playback → offline sync → wake lock/fullscreen → polish), several things
were added after real-world use surfaced gaps:

- **Screen sharing** (owner/contributor, invite links) — §6.3.
- **Screen duplication** — independent copies, same underlying file,
  lineage-tracked to prevent the "also show on" double-link bug (§5.2).
- **Cross-screen media linking** ("Also show on…") — genuinely the same
  row on multiple screens, the better fit for "identical content on
  several TVs" vs. duplication.
- **Screen address / business type** — free text, optional, with Google
  Places autocomplete that degrades to a plain input if the API key isn't
  configured (`lib/screen/load-google-maps.ts`,
  `components/dashboard/address-autocomplete-input.tsx`).
- **Founder dashboard** (`/admin`) — totals, 30-day growth charts (plain
  CSS bars, no charting library), browsable user/screen lists.
- **Forgot/change password**, **Terms/Privacy + signup consent
  timestamp**.
- **Periodic reload** (`components/screen/player.tsx`,
  `PERIODIC_RELOAD_MS`, currently 6h) — a signage-industry best practice
  for long-running browser self-healing. **Does not and cannot affect a
  TV's own firmware-level auto-power-off** — that can only be disabled in
  the TV's own settings (see `/help/keep-tv-awake`); no web API exists
  that lets a page influence that.

---

## 9. Known gotchas — read this before touching migrations or env vars

These cost real debugging time during development; save the next person
the trouble.

- **`drizzle-kit generate` got into a desynced state partway through
  development** and started reporting "no schema changes" even when the
  schema.ts clearly had new tables/columns the database didn't have yet.
  Root cause was never fully diagnosed. **Workaround in place**: several
  migrations in `db/migrations/` (e.g. `0002a_collaborators_tables.sql`,
  `0003_screen_address_business_type.sql`, `0005_media_clone_tracking.sql`)
  are **hand-written SQL**, not `drizzle-kit` output, and were run
  directly in Supabase's SQL editor. **If you add a new column/table,
  try `drizzle-kit generate` first — but if it claims "no changes"
  when you know there should be some, don't trust it. Write the SQL by
  hand instead of debugging the tool further.**
- **Vercel's environment variable UI does not show you the current value
  after saving** (by design, for secrets) — it shows a placeholder-format
  hint. This looks identical whether the save worked or the field is
  genuinely empty, and it bit us more than once. **When in doubt, delete
  and recreate the variable from scratch** rather than trying to "edit"
  an existing one.
- **`NEXT_PUBLIC_*` variables in Vercel prompt Secret vs Config** — always
  choose **Config** for these (they're meant to be public; the browser
  needs them directly). Choosing "remove the prefix" instead renames the
  variable and breaks anything expecting `NEXT_PUBLIC_...`.
- **Some embedded/commercial-display TV browsers (confirmed: Samsung
  QM32C) have Fullscreen API and/or Wake Lock API implementations where
  the returned promise never resolves *or* rejects — it just hangs
  forever.** An unguarded `await` on either can block the entire startup
  flow indefinitely. Both `lib/screen/fullscreen.ts` and
  `player/WakeLockManager.ts` race the real browser call against a 1.5s
  timeout for exactly this reason. **Apply the same pattern to any new
  raw browser API call in the player** — never trust that a promise will
  settle.
- **Same class of TV also failed to transition from the pairing screen to
  the player within the same page session** (worked fine after a manual
  refresh). Root cause not fully diagnosed either — the pragmatic fix in
  `components/screen/pairing-form.tsx` is a `window.location.reload()`
  immediately after saving the token, rather than a React state
  transition. If you're tempted to "clean this up" back to a state
  transition, test it on real TV hardware first, not just a browser.
- **`www.yourdomain.com` and `yourdomain.com` are two completely
  different origins to a browser (and therefore to CORS), even though
  they look like "the same site" to a human.** Uploads broke in
  production despite `posterdeck.app` being correctly listed in R2's
  `AllowedOrigins` — because the browser was actually loading
  `www.posterdeck.app`, which wasn't separately listed. **Always add
  both the `www` and non-`www` versions** to any allowlist: R2 CORS,
  Supabase redirect URLs, Google Maps key restrictions, everywhere.
- **R2 requires an explicit CORS policy per allowed origin** — uploads
  fail with a generic, unhelpful error if the current domain isn't in the
  bucket's CORS `AllowedOrigins`. Update this every time you add a new
  domain (custom domain, a new preview URL pattern, etc).
- **Supabase's built-in email sender is capped at ~2–4 emails/hour,
  project-wide** (not per-recipient) and is explicitly documented as
  test-only. Production email goes through SendGrid via Supabase's custom
  SMTP settings (Authentication → Emails/SMTP Settings). If auth emails
  mysteriously stop working, check this first.
- **`DATABASE_URL` pooler switch (port 6543) was attempted in production and caused
  the manifest endpoint to hang indefinitely** (not error — genuinely never
  resolve), which left paired TVs stuck on a black screen after their next
  reload. Reverted back to the direct connection (port 5432) immediately.
  Root cause not fully confirmed, but the working theory is a mismatch
  between `postgres-js`'s own connection-pool settings (`max`,
  `idle_timeout`, `connect_timeout`) and how Supabase's Transaction-mode
  pooler manages connections — `{ prepare: false }` alone (already set in
  `lib/db/index.ts`, required for transaction pooling) wasn't sufficient.
  **Before attempting this again**: test on a Vercel preview deployment
  with its own `DATABASE_URL` first, not directly on production, and
  research the specific `postgres-js` connection options Supabase's docs
  recommend for transaction-mode pooling (there are usually several,
  not just `prepare: false`). The direct connection has a real downside
  (Postgres's connection limit under heavy serverless load) but at MVP
  scale it's the known-working option — don't swap it again without a
  proper test environment.

---

## 10. Environment variables

See `.env.example` for the full list with inline comments. Grouped:

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (both genuinely public), `SUPABASE_SERVICE_ROLE_KEY` (secret),
  `DATABASE_URL` — currently the **direct connection (port 5432)** for
  both local dev and the Vercel-deployed production copy. A switch to
  the connection pooler (port 6543) was attempted to avoid Postgres's
  connection limit under serverless load, but it broke production (see
  §9's pooler gotcha) and was reverted. Revisit only with the
  precautions described there.
- **R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME`. `R2_PUBLIC_URL` is unused (the app uses signed URLs,
  not a public bucket domain) — safe to leave blank.
- **Google Maps**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — optional, address
  field degrades to a plain input if unset. Restrict the key to your
  actual domains in Google Cloud Console (Websites restriction) — it's
  used client-side by design.
- **Admin**: `ADMIN_EMAILS` — comma-separated, server-only, gates
  `/admin`.

---

## 11. Testing

`npm test` (Vitest). Deliberately scoped to **pure logic only** — nothing
that requires a live database or R2 connection. Covers: pairing
eligibility, token hashing, media expiration status, screen online
status, invite tokens, the entire `PlaybackEngine` loop (advance,
error-skip, loop-back), `ManifestManager` sync decisions, manifest
diffing (new/changed/deleted/unchanged), `WakeLockManager`'s
graceful-degradation path, byte/date formatting for the admin dashboard.

**Not covered by automated tests** (and would need real integration-test
infra to add): anything touching Drizzle queries against a real
database, R2 upload/download, Supabase Auth flows, the actual pairing →
manifest → playback flow end to end. These have all been manually tested
per the README's phase-by-phase "How to test" sections, but there's no
CI-runnable coverage for them today.

---

## 12. Deployment

- **Vercel**, auto-deploys on push to `main`.
- **Supabase** project — one database, shared by local dev and
  production (no separate staging database currently exists — a real gap
  if this project grows a team).
- **Cloudflare R2** — one bucket, CORS policy must list every domain that
  uploads from (see §9).
- **SendGrid** — production email via Supabase custom SMTP.

There is currently **no staging/preview environment with its own
database** — local dev and production share the same Supabase project.
This was fine for a single-founder MVP but is worth fixing before a team
grows, since local testing can affect real production data.

---

## 13. Deliberately deferred / known limitations

Worth knowing so you don't "fix" things that were left this way on
purpose, and worth revisiting once they actually start to matter:

- **Next.js 15 → 16 upgrade** — deferred. Fixes a real `npm audit`
  advisory (postcss, via Next's bundled copy) but is a major version
  bump; wanted a dedicated testing pass, not a rushed `--force` on a live
  app. `drizzle-orm` *was* upgraded (0.36→0.45) to fix its own advisory,
  successfully, with full regression testing.
- **esbuild/drizzle-kit/vite/vitest advisories** — all dev-tooling only,
  never shipped to production. Low real-world risk; left alone.
- **In-memory pairing rate limiter** — not distributed across serverless
  instances. Fine for MVP-scale abuse resistance, not a real guarantee at
  higher scale.
- **No storage quota/eviction policy** in `LocalMediaStore` (the TV's
  local cache) — fails soft on quota errors but doesn't proactively
  evict. Unlikely to matter at MVP content volume.
- **Admin user/screen lists capped at 200**, no pagination yet.
- **No account-deletion self-service flow** — currently a manual request
  via the privacy policy's contact email.
- Two roles only (owner/contributor) — intentionally not a granular
  permissions system; expand only if a real need shows up, not
  speculatively.

---

## 14. Suggested reading order for a new engineer

1. `lib/db/schema.ts` — understand the data model first, everything else
   makes more sense after this.
2. `app/dashboard/screens/[screenId]/page.tsx` — the single most complex
   page in the app; touches nearly every feature (roles, linking,
   duplication family tracking, sharing).
3. `player/PlaybackEngine.ts` → `ManifestManager.ts` → `SyncManager.ts`
   → `LocalMediaStore.ts`, in that order — the TV player's actual
   runtime logic, deliberately framework-free and unit-tested.
4. `app/api/screens/[id]/manifest/route.ts` — the one endpoint the TV
   ever calls; shows the server side of what the player consumes.
5. `lib/media/access.ts` + `lib/media/delete-media.ts` — the
   ownership/cleanup logic that most other routes depend on.
6. `README.md` — for the historical "why" behind specific decisions and
   detailed manual test steps per feature, once the architecture itself
   makes sense.


## Addendum: pairing code refresh

Pairing codes live 15 minutes (`PAIRING_CODE_TTL_MINUTES`). Previously an unpaired screen's code simply expired and
nothing regenerated it. `POST /api/screens/regenerate-code` (owner only, unpaired screens only) issues a fresh code;
the dashboard shows a "New code" button and flags an expired code in red.


## Addendum: scheduled playback

- Data: `screens.timezone` (IANA, default UTC) and `screen_media.schedule` (jsonb array of rules, null = default content). Migration 0006.
- Pure logic in `lib/schedule/schedule.ts` (rule matching, `selectPlayable`); validation in `lib/validation/schedule.ts`.
- Semantics: active scheduled items replace the whole loop; otherwise unscheduled items play; otherwise dark screen. Overnight windows are intentionally unsupported (two rules instead).
- The manifest carries `timezone` and each item's `schedule`; the TV evaluates them with its own clock (`PlaybackEngine.refresh`, called from the 30s local sweep in `components/screen/player.tsx`), so scheduling works offline. A wrong TV clock means wrong schedule times.
- API: `PATCH /api/media/[id]/screens/[screenId]` sets/clears one placement's schedule (owner: any item; contributor: own uploads). `PATCH /api/screens/[id]` accepts `timezone`. Both bump `manifest_version`.
- Duplicating a screen copies schedules and the time zone.


## Addendum: reload only when the server is truly reachable

The 6-hour reload used `navigator.onLine`, which is true on Wi-Fi with no internet, so the TV reloaded into the browser's error page. It now calls `canReachServer()` (`lib/screen/connectivity-probe.ts`: HEAD `/screen`, 8s timeout) and defers/retries every 5 min if that fails.
