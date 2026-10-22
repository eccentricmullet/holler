import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <span className="mt-20 size-20 rounded-[18px] bg-green-tint text-center text-[42px] leading-[80px]" aria-hidden>
        🧭
      </span>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">We couldn&apos;t find that</h1>
      <p className="mt-2.5 text-base leading-snug text-muted">
        The link may be old, or that pro isn&apos;t on the map anymore. Your neighbors&apos; picks are one tap away.
      </p>
      <Link href="/" className="mt-auto flex h-[54px] items-center justify-center rounded-[18px] bg-neon text-[17px] font-semibold text-on-neon">
        Back to the map
      </Link>
    </main>
  );
}
