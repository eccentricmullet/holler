import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { metersBetween, ONE_MILE_M, parsePoint } from "@/lib/geo";
import InviteButton from "@/components/InviteButton";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-lg font-bold text-white shadow-[0_0_0_3px_#7ED957]">
          {profile.first_name.charAt(0).toUpperCase()}
        </span>
        <span className="text-xl font-bold">Hi, {profile.first_name}!</span>
        <Link href="/" aria-label="Close" className="ml-auto flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
          <svg {...iconProps}>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      <div className="mt-11 grid grid-cols-3 gap-3">
        <Tile emoji="👍" value={thumbs} label="Thumbs up" />
        <Tile emoji="❤️" value={love} label="Loved" />
        <Tile emoji="🏡" value={helped} label="Neighbors helped" />
      </div>

      <InviteButton className="relative mt-6 flex h-[76px] items-center gap-3.5 overflow-hidden rounded-[22px] bg-dark-card px-5 text-left text-white">
        <span className="text-[32px]" aria-hidden>
          📣
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold">Invite your neighbors</span>
          <span className="text-[13px] text-white/70">More neighbors, a better map for everyone</span>
        </span>
        <span className="absolute right-[18px] top-3.5 size-1.5 rounded-full bg-lime" aria-hidden />
      </InviteButton>

      <nav aria-label="Profile menu" className="mt-[18px] flex flex-col">
        <MenuLink href="/profile/reactions" label="My reactions">
          <path d="M7 10v11M15 5.9L14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 3 3.9z" />
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
    </main>
  );
}

function Tile({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="relative flex flex-col items-center rounded-[20px] border-2 border-lime px-2 pb-3 pt-7">
      <span className="absolute -top-[22px] size-11 rounded-[15px] bg-green text-center text-[21px] leading-[44px]" aria-hidden>
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
