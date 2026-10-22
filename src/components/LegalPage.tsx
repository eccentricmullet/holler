import Link from "next/link";
import { LEGAL } from "@/config/legal";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-16 pt-8">
      <Link href="/" className="text-sm font-semibold text-green-deep">
        ‹ Back to the map
      </Link>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL.lastUpdated}</p>
      {LEGAL.isDraft && (
        <p className="mt-4 rounded-2xl bg-love-tint p-4 text-sm font-medium">
          Draft. This page hasn&apos;t been reviewed by a lawyer yet and may change before launch.
        </p>
      )}
      <div className="legal mt-6 flex flex-col gap-4 text-[16px] leading-relaxed">{children}</div>
    </main>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 text-xl font-bold">{children}</h2>;
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
