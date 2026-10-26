import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { adminPageGuard } from "../../guard";
import { addProFromRequestAction, declineVendorRequestAction } from "../../actions";
import { adminVendorRequests } from "@/lib/vendor-requests";

export const metadata: Metadata = { title: `Pro request · ${SITE.name}`, robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const card = "rounded-[18px] bg-surface p-4 shadow-card";
const input = "h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none";

// One neighbor request: fix up the details and create the pro, or decline with a short reason.
export default async function AdminRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await adminPageGuard(`/admin/requests/${id}`);
  const { waiting } = await adminVendorRequests(db);
  const req = waiting.find((r) => r.id === id);
  if (!req) notFound();
  const { data: cats } = await db.from("categories").select("slug, name, icon").order("sort_order");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-5">
      <Link href="/admin?tab=requests" className="text-sm font-semibold text-green-deep">
        ‹ All requests
      </Link>
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">{req.name}</h1>

      <div className={card}>
        <p className="text-sm text-muted">From {req.who ?? "a neighbor"}</p>
        <p className="mt-1 text-[15px]">{req.tagLine}</p>
        {req.details ? <p className="mt-2 whitespace-pre-line text-[15px]">{req.details}</p> : <p className="mt-2 text-sm text-muted">No other details.</p>}
      </div>

      {error && <p className="rounded-xl bg-love-tint p-3 text-sm font-semibold text-love">{error}</p>}

      <form action={addProFromRequestAction} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="requestId" value={req.id} />
        <h2 className="text-lg font-bold">Create the pro</h2>
        <label className="text-sm font-semibold" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" defaultValue={req.name} maxLength={80} className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="phone">
          Phone <span className="font-normal text-muted">or Instagram/Facebook below</span>
        </label>
        <input id="phone" name="phone" type="tel" className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="social">
          Instagram or Facebook
        </label>
        <input id="social" name="social" placeholder="@name or facebook.com/page" className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="website">
          Website
        </label>
        <input id="website" name="website" className={input} />
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold">What they do</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(cats ?? []).map((c) => (
              <label
                key={c.slug}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold has-checked:border-neon has-checked:bg-neon has-checked:text-on-neon"
              >
                <input type="checkbox" name="tags" value={c.slug} defaultChecked={req.tags.includes(c.slug)} className="sr-only" />
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="mt-3 h-12 rounded-xl bg-neon text-[15px] font-bold text-on-neon">
          Create pro and tell the neighbor
        </button>
      </form>

      <form action={declineVendorRequestAction} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="requestId" value={req.id} />
        <h2 className="text-lg font-bold">Or decline</h2>
        <label className="text-sm font-semibold" htmlFor="reason">
          Short reason <span className="font-normal text-muted">the neighbor sees this</span>
        </label>
        <input id="reason" name="reason" maxLength={120} placeholder="Couldn't find them" className={input} />
        <button type="submit" className="mt-2 h-12 rounded-xl border border-line bg-surface text-[15px] font-semibold">
          Decline request
        </button>
      </form>
    </main>
  );
}
