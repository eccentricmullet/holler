import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <span className="mt-20 size-20 rounded-[28px] bg-green-tint text-center text-[42px] leading-[80px]" aria-hidden>
        🧭
      </span>
      <h1 className="mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">We couldn&apos;t find that</h1>
      <p className="mt-2.5 text-base leading-snug text-muted">
        The link may be old, or that pro isn&apos;t on the map anymore. Your neighbors&apos; picks are one tap away.
      </p>
      <Link href="/" className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white">
        Back to the map
      </Link>
    </main>
  );
}
