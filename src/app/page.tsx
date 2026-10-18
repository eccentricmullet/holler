import Link from "next/link";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-6 pb-8 pt-10">
      {/* soft green shapes, like the mockups */}
      <span aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-green" />
      <span aria-hidden className="absolute -right-4 -top-32 size-56 rounded-full bg-lime" />
      <span aria-hidden className="absolute -left-28 top-72 size-64 rounded-full bg-lime-soft opacity-40" />

      <div className="relative mt-40">
        <h1 className="text-6xl font-extrabold tracking-tight text-ink">{SITE.wordmark}</h1>
        <p className="mt-3 text-lg text-muted">{SITE.tagline}.</p>
      </div>

      <div className="relative mt-10 grid grid-cols-2 gap-3">
        <div className="relative rounded-[20px] border-2 border-lime px-3 pb-3 pt-7 text-center">
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-[14px] bg-green-tint px-2.5 py-1.5 text-xl">
            👍
          </span>
          <p className="text-sm text-muted">Good work, would hire again</p>
        </div>
        <div className="relative rounded-[20px] border-2 border-lime px-3 pb-3 pt-7 text-center">
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-[14px] bg-love-tint px-2.5 py-1.5 text-xl">
            ❤️
          </span>
          <p className="text-sm text-muted">Awesome, tell everyone</p>
        </div>
      </div>

      <p className="relative mt-8 text-sm text-muted">Coming soon to {SITE.launchTown}.</p>

      {profile ? (
        <p className="relative mt-auto rounded-[18px] bg-green-tint px-4 py-4 text-center text-lg font-semibold text-green-deep">
          You&apos;re in, {profile.first_name}! 🎉
        </p>
      ) : (
        <Link
          href="/signup"
          className="relative mt-auto flex h-14 items-center justify-center rounded-[18px] bg-green-deep text-lg font-semibold text-white shadow-float"
        >
          See who my neighbors use
        </Link>
      )}
    </main>
  );
}
