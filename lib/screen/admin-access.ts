/**
 * Founder/admin access is deliberately NOT a database flag — it's a
 * server-only env var (ADMIN_EMAILS, comma-separated), so there's no
 * "isAdmin" column that could ever be exposed via an API response or
 * client-side query by mistake. Simple and sufficient for a single (or
 * small handful of) founder(s); revisit if this ever needs to scale to a
 * real team with varying permission levels.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
