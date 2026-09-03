import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client, scoped to the current request's cookies.
 * Use this in Server Components, Server Actions, and Route Handlers.
 * Never use this for the /screen manifest route — that route authenticates
 * via a hashed screen token instead (see lib/screen/auth.ts, added in Phase 2).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to — safe to ignore as long as middleware also
            // refreshes the session (it does, see middleware.ts).
          }
        },
      },
    }
  );
}

/**
 * Admin client using the service-role key. Bypasses RLS entirely.
 * ONLY use this server-side, for trusted operations like the screen
 * manifest endpoint (Phase 2) after independently verifying a screen token.
 * Never import this into a Client Component or expose the key to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
