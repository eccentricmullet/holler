// Skeleton while profile screens load
export default function LoadingProfile() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-full bg-field" />
        <div className="h-6 w-32 animate-pulse rounded-lg bg-field" />
      </div>
      <div className="mt-11 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[18px] bg-field" />
        ))}
      </div>
      <div className="mt-6 h-[76px] animate-pulse rounded-[18px] bg-field" />
    </main>
  );
}
