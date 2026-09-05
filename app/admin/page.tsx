import { sql, gte, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, screens, media, screenMedia } from "@/lib/db/schema";
import { formatBytes } from "@/lib/format-bytes";
import { buildDailySeries } from "@/lib/build-daily-series";
import { BarChart } from "@/components/admin/bar-chart";

const DAYS = 30;

export default async function AdminPage() {
  const thirtyDaysAgo = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const [[userCount], [screenCounts], [mediaStats]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        total: sql<number>`count(*)::int`,
        paired: sql<number>`count(*) filter (where ${screens.screenTokenHash} is not null)::int`,
      })
      .from(screens),
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalBytes: sql<number>`coalesce(sum(${media.size}), 0)::bigint`,
      })
      .from(media),
  ]);

  const [dailySignups, dailyScreens] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', ${users.createdAt})`)
      .orderBy(sql`date_trunc('day', ${users.createdAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${screens.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(screens)
      .where(gte(screens.createdAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', ${screens.createdAt})`)
      .orderBy(sql`date_trunc('day', ${screens.createdAt})`),
  ]);

  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      screenCount: sql<number>`(select count(*) from ${screens} where ${screens.userId} = ${users.id})::int`,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);

  const screenList = await db
    .select({
      id: screens.id,
      name: screens.name,
      ownerEmail: users.email,
      isPaired: sql<boolean>`${screens.screenTokenHash} is not null`,
      createdAt: screens.createdAt,
      mediaCount: sql<number>`(select count(*) from ${screenMedia} where ${screenMedia.screenId} = ${screens.id})::int`,
    })
    .from(screens)
    .innerJoin(users, eq(users.id, screens.userId))
    .orderBy(desc(screens.createdAt))
    .limit(200);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Users" value={userCount?.count ?? 0} />
        <StatCard
          label="Screens"
          value={screenCounts?.total ?? 0}
          sub={`${screenCounts?.paired ?? 0} paired`}
        />
        <StatCard label="Media items" value={mediaStats?.count ?? 0} />
        <StatCard label="Storage used" value={formatBytes(Number(mediaStats?.totalBytes ?? 0))} />
      </div>

      <div className="grid gap-6 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
        <BarChart title="Signups (last 30 days)" data={buildDailySeries(dailySignups, DAYS)} />
        <BarChart
          title="Screens created (last 30 days)"
          data={buildDailySeries(dailyScreens, DAYS)}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium">Users ({userList.length})</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Screens</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 text-muted-foreground">
                    {u.createdAt.toLocaleDateString()}
                  </td>
                  <td className="p-3">{u.screenCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium">Screens ({screenList.length})</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Status</th>
                <th className="p-3">Media</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {screenList.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.ownerEmail}</td>
                  <td className="p-3">{s.isPaired ? "🟢 Paired" : "⚪️ Unpaired"}</td>
                  <td className="p-3">{s.mediaCount}</td>
                  <td className="p-3 text-muted-foreground">
                    {s.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
