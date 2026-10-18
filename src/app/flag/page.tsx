import Link from "next/link";

// Placeholder until private flags are built (build order step 9).
export default function FlagPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-6 pt-16">
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Sorry to hear that</h1>
      <p className="mt-2.5 text-base text-muted">Private reports are coming soon. Only the admin will ever see them.</p>
      <Link
        href="/"
        className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white"
      >
        Back to the map
      </Link>
    </main>
  );
}
