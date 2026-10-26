import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { metersBetween, ONE_MILE_M, parsePoint } from "@/lib/geo";
import InviteButton from "@/components/InviteButton";
import InstallCard from "@/components/InstallCard";
import { myCategoryRequests } from "@/lib/category-requests";
import { signOut } from "./actions";

export const metadata: Metadata = { title: `Profile · ${SITE.name}` };

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 22,
  height: 22,
  "aria-hidden": true,
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile");

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("first_name, role, household_id, households(display_location)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/signup?next=/profile");

  const { data: mine } = await db.from("vouches").select("reaction").eq("profile_id", user.id);
  const requests = await myCategoryRequests(db, user.id);
  const thumbs = (mine ?? []).filter((v) => v.reaction === "thumbs_up").length;
  const love = (mine ?? []).filter((v) => v.reaction === "love").length;

  // Neighbors helped: other homes within a mile who can see your reactions on the map
  let helped = 0;
  const myHome = parsePoint((profile.households as unknown as { display_location: unknown } | null)?.display_location);
  if (myHome && (mine?.length ?? 0) > 0) {
    const { data: homes } = await db.from("households").select("id, display_location").neq("id", profile.household_id);
    helped = (homes ?? []).filter((h) => {
      const p = parsePoint(h.display_location);
      return p && metersBetween(p, myHome) <= ONE_MILE_M;
    }).length;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6 pb-[calc(var(--tabbar)+24px)]">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-green-tint text-lg font-bold text-green-deep">
          {profile.first_name.charAt(0).toUpperCase()}
        </span>
        <span className="text-xl font-bold">Hi, {profile.first_name}!</span>
      </div>

      <div className="mt-11 grid grid-cols-3 gap-3">
        <Tile emoji="👍" value={thumbs} label="Thumbs up" />
        <Tile emoji="❤️" value={love} label="Loved" />
        <Tile emoji="🏡" value={helped} label="Neighbors helped" />
      </div>

      <InviteButton className="relative mt-6 flex h-[76px] items-center gap-3.5 overflow-hidden rounded-[18px] bg-surface px-5 text-left text-ink shadow-card">
        <span className="text-[32px]" aria-hidden>
          📣
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold">Invite your neighbors</span>
          <span className="text-[13px] text-muted">More neighbors, a better map for everyone</span>
        </span>
      </InviteButton>

      <InstallCard className="mt-4" />

      {requests.length > 0 && (
        <section className="mt-6" aria-label="Services you suggested">
          <h2 className="text-[17px] font-bold">Services you suggested</h2>
          <ul className="mt-2 flex flex-col overflow-hidden rounded-[18px] bg-surface shadow-card">
            {requests.slice(0, 5).map((r) => (
              // Tap a row to open it and read the whole reply
              <li key={r.id} className="border-b border-line last:border-b-0">
                <details className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{r.name}</span>
                      <span className="truncate text-[13px] text-muted group-open:hidden">
                        {r.status === "added" ? "Added for everyone" : r.status === "declined" ? r.declineReason || "Not added" : "We'll take a look"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] ${r.status === "added" ? "bg-green-tint font-semibold text-green-deep" : "bg-field font-medium text-ink-soft"}`}
                    >
                      {r.status === "added" ? "Added" : r.status === "declined" ? "Declined" : "Waiting"}
                    </span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="flex flex-col gap-2.5 px-4 pb-4 text-[15px] leading-snug">
                    {r.status === "waiting" && <p className="text-muted">We&apos;ll take a look and let you know here.</p>}
                    {r.status === "declined" && (
                      <p>
                        <span className="block text-[13px] font-semibold text-muted">Reply from the {SITE.name} team</span>
                        {r.declineReason || "We couldn't add this one right now."}
                      </p>
                    )}
                    {r.status === "added" && <p>Added for everyone. Know someone good? Recommend them so neighbors can find them.</p>}
                    {r.details && (
                      <p>
                        <span className="block text-[13px] font-semibold text-muted">Your note</span>
                        {r.details}
                      </p>
                    )}
                    {r.status === "added" && r.categorySlug && (
                      <Link href={`/react?category=${r.categorySlug}`} className="flex h-11 items-center justify-center rounded-[14px] bg-neon text-[15px] font-bold text-on-neon">
                        Recommend a pro
                      </Link>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Profile menu" className="mt-[18px] flex flex-col">
        <MenuLink href="/profile/reactions" label="My reactions">
          <path d="M7 10v11M15 5.9L14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 3 3.9z" />
        </MenuLink>
        <MenuLink href="/asks" label="Asks">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 16h.01" />
        </MenuLink>
        <MenuLink href="/profile/alerts" label="Alerts">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </MenuLink>
        <MenuLink href="/profile/pros" label="My pros">
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        </MenuLink>
        <MenuLink href="/profile/details" label="Privacy and details">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
        </MenuLink>
        {profile.role === "admin" && (
          <MenuLink href="/admin" label="Admin">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </MenuLink>
        )}
        <form action={signOut}>
          <button type="submit" className="flex h-14 w-full items-center gap-4 text-left text-lg font-semibold">
            <svg {...iconProps}>
              <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Sign out
          </button>
        </form>
      </nav>

      <p className="mt-auto pt-6 text-center text-[13px] text-muted">
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
      </p>
    </main>
  );
}

function Tile({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="relative flex flex-col items-center rounded-[18px] bg-surface shadow-card px-2 pb-3 pt-7">
      <span className="absolute -top-[22px] size-11 rounded-[15px] bg-neon text-center text-[21px] leading-[44px]" aria-hidden>
        {emoji}
      </span>
      <span className="text-[30px] font-bold leading-none">{value}</span>
      <span className="mt-1 text-center text-[13px] text-muted">{label}</span>
    </div>
  );
}

function MenuLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-14 items-center gap-4 text-lg font-semibold">
      <svg {...iconProps}>{children}</svg>
      {label}
    </Link>
  );
}
