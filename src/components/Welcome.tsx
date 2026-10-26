import { SITE } from "@/config/site";

// What Holler is, in one screen. Shown before signing up.
export const WELCOME_POINTS = [
  { emoji: "👍", title: "See who neighbors hired", body: "Real reactions from homes near you, not anonymous reviews." },
  { emoji: "📞", title: "Call or text in one tap", body: "Find a good plumber, hair stylist or vet in under a minute." },
  { emoji: "🏡", title: "The Porch", body: "Curb alerts, garage sales, lost pets and heads-ups nearby." },
];

export default function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-page px-6 pb-6 pt-10 text-ink lg:rounded-[18px]">
      <span className="text-[22px] font-bold tracking-[-0.02em] text-green-deep">{SITE.wordmark}</span>
      <h1 className="mt-8 text-[32px] font-bold leading-[1.1] tracking-[-0.02em]">The pros your {SITE.launchTownShort} neighbors trust.</h1>
      <p className="mt-3 text-[15px] leading-snug text-muted">
        {SITE.name} is a map of the local pros people around you actually use, shared by neighbors.
      </p>

      <ul className="mt-7 flex flex-col gap-3">
        {WELCOME_POINTS.map((p) => (
          <li key={p.title} className="flex items-start gap-3.5 rounded-[18px] bg-surface p-4 shadow-card">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-green-tint text-[22px]" aria-hidden>
              {p.emoji}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-bold">{p.title}</span>
              <span className="text-sm leading-snug text-muted">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col pt-8">
        <button type="button" onClick={onStart} className="h-[54px] rounded-[16px] bg-neon text-[16px] font-bold text-on-neon">
          Get started
        </button>
        <button type="button" onClick={onStart} className="mt-2 h-11 text-[15px] font-semibold text-green-deep">
          I already have an account · Log in
        </button>
        <span className="mt-1 text-center text-[13px] text-muted">Free for neighbors. Your address is never shown.</span>
      </div>
    </main>
  );
}
