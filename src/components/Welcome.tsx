import { SITE } from "@/config/site";

// What Holler is, in one screen. Shown before signing up.
export const WELCOME_POINTS = [
  { emoji: "👍", title: "See who neighbors hired", body: "Real reactions from homes near you, not anonymous reviews." },
  { emoji: "📞", title: "Call or text in one tap", body: "Find a good plumber, lawn crew or cleaner in under a minute." },
  { emoji: "🏡", title: "The Porch", body: "Curb alerts, garage sales, lost pets and heads-ups nearby." },
];

export default function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-green px-6 pb-6 pt-10 text-white lg:rounded-[32px]">
      <span className="absolute -right-24 -top-24 size-[260px] rounded-full bg-lime/50" aria-hidden />
      <span className="relative text-[22px] font-extrabold tracking-[-0.02em]">{SITE.wordmark}</span>
      <h1 className="relative mt-10 text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em]">
        The pros your {SITE.launchTownShort} neighbors trust.
      </h1>
      <p className="relative mt-3 text-[17px] leading-snug text-white/90">
        {SITE.name} is a map of the local pros people around you actually use, shared by neighbors.
      </p>

      <ul className="relative mt-8 flex flex-col gap-4">
        {WELCOME_POINTS.map((p) => (
          <li key={p.title} className="flex items-start gap-3.5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl" aria-hidden>
              {p.emoji}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[17px] font-bold">{p.title}</span>
              <span className="text-sm leading-snug text-white/85">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto flex flex-col pt-8">
        <button type="button" onClick={onStart} className="h-[58px] rounded-[20px] bg-surface text-[17px] font-semibold text-green-deep shadow-float">
          Get started
        </button>
        <button type="button" onClick={onStart} className="mt-3 h-11 text-[15px] font-semibold text-white">
          I already have an account · Log in
        </button>
        <span className="mt-1 text-center text-[13px] text-white/80">Free for neighbors. Your address is never shown.</span>
      </div>
    </main>
  );
}
