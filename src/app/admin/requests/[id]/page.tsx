import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { adminPageGuard } from "../../guard";
import { addCategoryFromRequestAction, declineCategoryRequestAction } from "../../actions";
import { adminCategoryRequests, categorySections } from "@/lib/category-requests";

export const metadata: Metadata = { title: `Service request · ${SITE.name}`, robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const card = "rounded-[18px] bg-surface p-4 shadow-card";
const input = "h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none";

// One neighbor request: fix up the name, pick an emoji and a group, and add the service. Or decline with a short reason.
export default async function AdminRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await adminPageGuard(`/admin/requests/${id}`);
  const [{ waiting }, sections] = await Promise.all([adminCategoryRequests(db), categorySections(db)]);
  const req = waiting.find((r) => r.id === id);
  if (!req) notFound();
  // Tidy capitalization for the suggested name: "babysitting" -> "Babysitting"
  const suggested = req.name.charAt(0).toUpperCase() + req.name.slice(1);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-5">
      <Link href="/admin?tab=requests" className="text-sm font-semibold text-green-deep">
        ‹ All requests
      </Link>
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">&ldquo;{req.name}&rdquo;</h1>

      <div className={card}>
        <p className="text-sm text-muted">From {req.who ?? "a neighbor"}</p>
        {req.details ? <p className="mt-2 whitespace-pre-line text-[15px]">{req.details}</p> : <p className="mt-2 text-sm text-muted">No other details.</p>}
      </div>

      {error && <p className="rounded-xl bg-love-tint p-3 text-sm font-semibold text-love">{error}</p>}

      <form action={addCategoryFromRequestAction} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="requestId" value={req.id} />
        <h2 className="text-lg font-bold">Add the service</h2>
        <label className="text-sm font-semibold" htmlFor="name">
          Name <span className="font-normal text-muted">short, like &ldquo;Babysitting&rdquo;</span>
        </label>
        <input id="name" name="name" defaultValue={suggested} maxLength={40} required className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="icon">
          Emoji <span className="font-normal text-muted">tap the box, then the emoji key on your keyboard</span>
        </label>
        <input id="icon" name="icon" maxLength={8} required placeholder="🧽" className={`${input} w-24 text-center text-2xl`} />
        <label className="mt-2 text-sm font-semibold" htmlFor="section">
          Group <span className="font-normal text-muted">pick one, or type a new group</span>
        </label>
        <input id="section" name="section" list="sections" required defaultValue={sections[0] ?? ""} className={input} />
        <datalist id="sections">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <p className="text-[13px] text-muted">Groups now: {sections.join(" · ")}</p>
        <button type="submit" className="mt-3 h-12 rounded-xl bg-neon text-[15px] font-bold text-on-neon">
          Add service and tell the neighbor
        </button>
      </form>

      <form action={declineCategoryRequestAction} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="requestId" value={req.id} />
        <h2 className="text-lg font-bold">Or decline</h2>
        <label className="text-sm font-semibold" htmlFor="reason">
          Short reason <span className="font-normal text-muted">the neighbor sees this</span>
        </label>
        <input id="reason" name="reason" maxLength={120} placeholder="Use Handyman for this one" className={input} />
        <button type="submit" className="mt-2 h-12 rounded-xl border border-line bg-surface text-[15px] font-semibold">
          Decline request
        </button>
      </form>
    </main>
  );
}
