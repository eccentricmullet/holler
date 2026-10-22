import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { FLAG_ALERT_THRESHOLD, openFlags } from "@/lib/admin";
import { adminPageGuard } from "./guard";
import { resolveFlag, setUserBanned, setUserReactionsHidden } from "./actions";
import ConfirmButton from "./ConfirmButton";

export const metadata: Metadata = { title: `Admin · ${SITE.name}`, robots: { index: false } };

type Tab = "flags" | "pros" | "users" | "stats";
const TABS: { id: Tab; label: string }[] = [
  { id: "flags", label: "Flags" },
  { id: "pros", label: "Pros" },
  { id: "users", label: "Users" },
  { id: "stats", label: "Counts" },
];

const btn = "h-10 rounded-xl px-3.5 text-sm font-semibold";
const card = "rounded-[18px] bg-surface p-4 shadow-card";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab: tabParam, q = "" } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "flags";
  const db = await adminPageGuard(`/admin?tab=${tab}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Admin</h1>
        <Link href="/" className="text-sm font-semibold text-green-deep">
          Back to map
        </Link>
      </div>
      <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${
              tab === t.id ? "border-neon bg-green-wash" : "border-line"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 flex flex-col gap-3">
        {tab === "flags" && <FlagsTab db={db} />}
        {tab === "pros" && <ProsTab db={db} q={q} />}
        {tab === "users" && <UsersTab db={db} q={q} />}
        {tab === "stats" && <StatsTab db={db} />}
      </div>
    </main>
  );
}

type Db = Awaited<ReturnType<typeof adminPageGuard>>;

async function FlagsTab({ db }: { db: Db }) {
  const flags = await openFlags(db);
  const perPro = new Map<string, { name: string; n: number }>();
  for (const f of flags) {
    if (!f.pro) continue;
    const e = perPro.get(f.pro.id) ?? { name: f.pro.name, n: 0 };
    e.n++;
    perPro.set(f.pro.id, e);
  }
  const alerts = [...perPro.entries()].filter(([, v]) => v.n >= FLAG_ALERT_THRESHOLD);

  return (
    <>
      {alerts.map(([id, v]) => (
        <Link key={id} href={`/admin/pros/${id}`} className="rounded-[18px] border border-love bg-love-tint p-4 text-[15px] font-semibold">
          ⚠️ {v.name} has {v.n} open flags. Take a look →
        </Link>
      ))}
      {flags.length === 0 && <p className="text-[15px] text-muted">No open flags. All clear 🎉</p>}
      {flags.map((f) => (
        <div key={f.id} className={card}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{f.note ? "Reported note" : "Bad experience"}</p>
              {f.pro && (
                <Link href={`/admin/pros/${f.pro.id}`} className="text-[17px] font-bold">
                  {f.pro.name}
                </Link>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted">{new Date(f.createdAt).toLocaleDateString()}</span>
          </div>
          {f.note && (
            <p className="mt-2 rounded-xl bg-field p-3 text-[15px]">
              &ldquo;{f.note.text}&rdquo; <span className="text-muted">— {f.note.author}</span>
              {f.note.status === "hidden" && <span className="ml-1 text-xs font-semibold text-love">(hidden)</span>}
            </p>
          )}
          <p className="mt-2 text-[15px]">
            <span className="font-semibold">{f.reason}</span>
            {f.details && <span className="text-muted"> · {f.details}</span>}
          </p>
          <p className="mt-1 text-xs text-muted">From {f.reporter}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={resolveFlag}>
              <input type="hidden" name="flagId" value={f.id} />
              <button type="submit" className={`${btn} bg-neon text-on-neon`}>
                Clear flag
              </button>
            </form>
            {f.note && f.note.status !== "hidden" && (
              <form action={resolveFlag}>
                <input type="hidden" name="flagId" value={f.id} />
                <input type="hidden" name="also" value="hide-note" />
                <ConfirmButton message="Hide this note and clear the flag?" className={`${btn} bg-field`}>
                  Hide note + clear
                </ConfirmButton>
              </form>
            )}
            {!f.note && f.pro && (
              <form action={resolveFlag}>
                <input type="hidden" name="flagId" value={f.id} />
                <input type="hidden" name="also" value="hide-pro" />
                <ConfirmButton message={`Hide ${f.pro.name} from the map and clear the flag?`} className={`${btn} bg-field`}>
                  Hide pro + clear
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

async function ProsTab({ db, q }: { db: Db; q: string }) {
  let query = db
    .from("pros")
    .select("id, name, phone, status, merged_into_id, vouches(count), flags(count)")
    .is("merged_into_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data: pros } = await query;

  return (
    <>
      <SearchBox tab="pros" q={q} placeholder="Search pros by name" />
      {(pros ?? []).map((p) => {
        const reactions = (p.vouches as unknown as { count: number }[])[0]?.count ?? 0;
        const flags = (p.flags as unknown as { count: number }[])[0]?.count ?? 0;
        return (
          <Link key={p.id} href={`/admin/pros/${p.id}`} className={`${card} flex items-center justify-between gap-3`}>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold">{p.name}</span>
              <span className="text-[13px] text-muted">
                {reactions} reactions · {flags} flags{p.status === "hidden" ? " · hidden" : ""}
              </span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        );
      })}
    </>
  );
}

async function UsersTab({ db, q }: { db: Db; q: string }) {
  let query = db
    .from("profiles")
    .select("id, first_name, last_initial, privacy, banned, role, households(city), vouches(status)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("first_name", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data: people } = await query;

  return (
    <>
      <SearchBox tab="users" q={q} placeholder="Search by first name" />
      {(people ?? []).map((p) => {
        const vouches = (p.vouches ?? []) as { status: string }[];
        const hiddenCount = vouches.filter((v) => v.status === "hidden").length;
        const allHidden = vouches.length > 0 && hiddenCount === vouches.length;
        const hood = (p.households as unknown as { city: string | null } | null)?.city;
        return (
          <div key={p.id} className={card}>
            <p className="text-base font-bold">
              {p.first_name} {p.last_initial}.{p.role === "admin" && <span className="ml-1 text-xs text-green-deep">admin</span>}
              {p.banned && <span className="ml-1 text-xs font-semibold text-love">banned</span>}
            </p>
            <p className="text-[13px] text-muted">
              {vouches.length} reactions{hiddenCount ? ` (${hiddenCount} hidden)` : ""} · {p.privacy === "hidden" ? "hidden on map" : "near block"}
              {hood ? ` · ${hood}` : ""}
            </p>
            {p.role !== "admin" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {vouches.length > 0 && (
                  <form action={setUserReactionsHidden}>
                    <input type="hidden" name="profileId" value={p.id} />
                    <input type="hidden" name="hidden" value={allHidden ? "0" : "1"} />
                    <ConfirmButton
                      message={allHidden ? "Show this person's reactions again?" : "Hide all of this person's reactions?"}
                      className={`${btn} bg-field`}
                    >
                      {allHidden ? "Show reactions" : "Hide reactions"}
                    </ConfirmButton>
                  </form>
                )}
                <form action={setUserBanned}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="hidden" name="banned" value={p.banned ? "0" : "1"} />
                  <ConfirmButton
                    message={p.banned ? "Unban this person?" : "Ban this person? Their reactions stop counting."}
                    className={`${btn} ${p.banned ? "bg-field" : "bg-love text-white"}`}
                  >
                    {p.banned ? "Unban" : "Ban"}
                  </ConfirmButton>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

async function StatsTab({ db }: { db: Db }) {
  const [{ data: homes }, { data: vouches }, { count: users }, { count: openFlagCount }] = await Promise.all([
    db.from("households").select("id, city"),
    db.from("vouches").select("household_id, status"),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("flags").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const hoodOf = new Map((homes ?? []).map((h) => [h.id, h.city ?? "Unknown city"]));
  const rows = new Map<string, { homes: number; reactions: number }>();
  for (const h of homes ?? []) {
    const k = h.city ?? "Unknown city";
    const r = rows.get(k) ?? { homes: 0, reactions: 0 };
    r.homes++;
    rows.set(k, r);
  }
  for (const v of vouches ?? []) {
    if (v.status !== "visible") continue;
    const k = hoodOf.get(v.household_id) ?? "Unknown city";
    const r = rows.get(k) ?? { homes: 0, reactions: 0 };
    r.reactions++;
    rows.set(k, r);
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].reactions - a[1].reactions);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["People", users ?? 0],
          ["Reactions", (vouches ?? []).filter((v) => v.status === "visible").length],
          ["Open flags", openFlagCount ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="rounded-[18px] bg-surface p-3 text-center shadow-card">
            <p className="text-[26px] font-bold">{n}</p>
            <p className="text-[13px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className={card}>
        <table className="w-full text-left text-[15px]">
          <thead className="text-[13px] text-muted">
            <tr>
              <th className="pb-2 font-medium">City</th>
              <th className="pb-2 text-right font-medium">Homes</th>
              <th className="pb-2 text-right font-medium">Reactions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([hood, r]) => (
              <tr key={hood} className="border-t border-line">
                <td className="py-2">{hood}</td>
                <td className="py-2 text-right">{r.homes}</td>
                <td className="py-2 text-right">{r.reactions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Test data (from the seed script) is included until it&apos;s removed before launch.</p>
    </>
  );
}

function SearchBox({ tab, q, placeholder }: { tab: string; q: string; placeholder: string }) {
  return (
    <form className="flex gap-2" action="/admin">
      <input type="hidden" name="tab" value={tab} />
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-12 min-w-0 flex-1 rounded-xl bg-field px-4 text-base outline-none placeholder:text-muted"
      />
      <button type="submit" className="h-12 rounded-xl bg-neon px-4 text-sm font-semibold text-on-neon">
        Search
      </button>
    </form>
  );
}
