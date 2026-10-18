import Link from "next/link";

// Placeholder until the react flow is built (build order step 6).
export default function ReactPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-6 pt-16">
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Reacting is almost here</h1>
      <p className="mt-2.5 text-base text-muted">Soon you&apos;ll be able to 👍 or ❤️ the pros you use, in under 30 seconds.</p>
      <Link
        href="/"
        className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white"
      >
        Back to the map
      </Link>
    </main>
  );
}
