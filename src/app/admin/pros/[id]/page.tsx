import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { adminPageGuard } from "../../guard";
import { createInviteAction, mergeProsAction, setProStatus, updatePro } from "../../actions";
import InviteLink from "./InviteLink";
import ConfirmButton from "../../ConfirmButton";

export const metadata: Metadata = { title: `Edit pro · ${SITE.name}`, robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const card = "rounded-[18px] bg-surface p-4 shadow-card";
const input = "h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none";

export default async function AdminProPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mq?: string; saved?: string; merged?: string; error?: string }>;
}) {
  const { id } = await params;
  const { mq = "", saved, merged, error } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await adminPageGuard(`/admin/pros/${id}`);

  const { data: pro } = await db
    .from("pros")
    .select("id, name, phone, website, social_url, tags, status, merged_into_id, google_place_id, vouches(reaction, status, via_invite), flags(status)")
    .eq("id", id)
    .maybeSingle();
  if (!pro) notFound();
  const vouches = (pro.vouches ?? []) as { reaction: string; status: string; via_invite: boolean }[];
  const viaInvite = vouches.filter((v) => v.via_invite).length;
  const { data: invite } = await db.from("invites").select("code, uses").eq("pro_id", id).limit(1).maybeSingle();
  const openFlags = ((pro.flags ?? []) as { status: string }[]).filter((f) => f.status === "open").length;
  const { data: cats } = await db.from("categories").select("slug, name, icon").order("sort_order");

  const { data: candidates } = mq
    ? await db
        .from("pros")
        .select("id, name, phone, vouches(count)")
        .is("merged_into_id", null)
        .neq("id", id)
        .ilike("name", `%${mq.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
        .limit(10)
    : { data: [] };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-5">
      <Link href="/admin?tab=pros" className="text-sm font-semibold text-green-deep">
        ‹ All pros
      </Link>
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{pro.name}</h1>
        <p className="text-[13px] text-muted">
          👍 {vouches.filter((v) => v.reaction === "thumbs_up").length} · ❤️ {vouches.filter((v) => v.reaction === "love").length} ·{" "}
          {openFlags} open flags · {pro.status}
          {pro.google_place_id ? " · from Google" : " · added by hand"}
        </p>
        {pro.status === "active" && (
          <Link href={`/pro/${pro.id}`} className="text-sm font-semibold text-green-deep">
            View public page ›
          </Link>
        )}
      </div>

      {saved && <p className="rounded-xl bg-green-tint p-3 text-sm font-semibold text-green-deep">Saved ✓</p>}
      {merged && (
        <p className="rounded-xl bg-green-tint p-3 text-sm font-semibold text-green-deep">Merged ✓ Moved {merged} reactions here.</p>
      )}
      {error && (
        <p className="rounded-xl bg-love-tint p-3 text-sm font-semibold text-love">
          {error === "check" ? "Check the name, phone number and Instagram or Facebook link." : error === "tags" ? "Pick at least one thing they do." : error}
        </p>
      )}
      {pro.merged_into_id && (
        <p className="rounded-xl bg-field p-3 text-sm">
          This pro was merged into{" "}
          <Link href={`/admin/pros/${pro.merged_into_id}`} className="font-semibold text-green-deep">
            another pro
          </Link>
          .
        </p>
      )}

      <form action={updatePro} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="proId" value={pro.id} />
        <label className="text-sm font-semibold" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" defaultValue={pro.name} maxLength={80} className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="phone">
          Phone
        </label>
        <input id="phone" name="phone" type="tel" defaultValue={pro.phone ?? ""} className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="website">
          Website
        </label>
        <input id="website" name="website" defaultValue={pro.website ?? ""} className={input} />
        <label className="mt-2 text-sm font-semibold" htmlFor="social">
          Instagram or Facebook
        </label>
        <input id="social" name="social" placeholder="@name or facebook.com/page" defaultValue={pro.social_url ?? ""} className={input} />
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold">
            What they do <span className="font-normal text-muted">first one is their main service</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(cats ?? []).map((c) => (
              <label
                key={c.slug}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold has-checked:border-neon has-checked:bg-neon has-checked:text-on-neon"
              >
                <input type="checkbox" name="tags" value={c.slug} defaultChecked={((pro.tags ?? []) as string[]).includes(c.slug)} className="sr-only" />
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="mt-3 h-12 rounded-xl bg-neon text-[15px] font-semibold text-on-neon">
          Save
        </button>
      </form>

      {!pro.merged_into_id && pro.status === "active" && (
        <section className={card}>
          <p className="text-[15px] font-semibold">Invite link for this pro</p>
          <p className="mt-1 text-[13px] text-muted">
            Give it to the pro to share with customers. It opens straight to &ldquo;How was {pro.name.split(" ")[0]}?&rdquo;
          </p>
          {invite ? (
            <>
              <InviteLink code={invite.code} proName={pro.name} />
              <p className="mt-2 text-xs text-muted">
                Opened {invite.uses} {invite.uses === 1 ? "time" : "times"} · {viaInvite} reactions came through it
              </p>
            </>
          ) : (
            <form action={createInviteAction}>
              <input type="hidden" name="proId" value={pro.id} />
              <button type="submit" className="mt-3 h-11 rounded-xl bg-neon px-4 text-sm font-semibold text-on-neon">
                Make invite link
              </button>
            </form>
          )}
        </section>
      )}

      {!pro.merged_into_id && (
        <form action={setProStatus} className={card}>
          <input type="hidden" name="proId" value={pro.id} />
          <input type="hidden" name="status" value={pro.status === "active" ? "hidden" : "active"} />
          <p className="text-[15px] font-semibold">{pro.status === "active" ? "Hide from the map" : "Hidden from the map"}</p>
          <p className="mt-1 text-[13px] text-muted">Hidden pros don&apos;t show anywhere. Their reactions stay saved.</p>
          <ConfirmButton
            message={pro.status === "active" ? `Hide ${pro.name}?` : `Show ${pro.name} again?`}
            className={`mt-3 h-11 rounded-xl px-4 text-sm font-semibold ${pro.status === "active" ? "bg-love text-white" : "bg-field"}`}
          >
            {pro.status === "active" ? "Hide pro" : "Show pro again"}
          </ConfirmButton>
        </form>
      )}

      {!pro.merged_into_id && (
        <section className={card}>
          <p className="text-[15px] font-semibold">Is this a duplicate?</p>
          <p className="mt-1 text-[13px] text-muted">
            Find the pro to keep. This one&apos;s reactions move there, and this one gets hidden.
          </p>
          <form className="mt-3 flex gap-2" action={`/admin/pros/${pro.id}`}>
            <input name="mq" defaultValue={mq} placeholder="Search the pro to keep" className={`${input} min-w-0 flex-1`} />
            <button type="submit" className="h-12 rounded-xl bg-field px-4 text-sm font-semibold">
              Search
            </button>
          </form>
          <div className="mt-3 flex flex-col gap-2">
            {mq && (candidates ?? []).length === 0 && <p className="text-sm text-muted">No matches.</p>}
            {(candidates ?? []).map((c) => (
              <form key={c.id} action={mergeProsAction} className="flex items-center justify-between gap-3 rounded-xl bg-field p-3">
                <input type="hidden" name="sourceId" value={pro.id} />
                <input type="hidden" name="targetId" value={c.id} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">
                    {(c.vouches as unknown as { count: number }[])[0]?.count ?? 0} reactions{c.phone ? ` · ${c.phone}` : ""}
                  </span>
                </span>
                <ConfirmButton
                  message={`Merge "${pro.name}" into "${c.name}"? This can't be undone from the app.`}
                  className="h-10 shrink-0 rounded-xl bg-neon px-3 text-sm font-semibold text-on-neon"
                >
                  Merge into this
                </ConfirmButton>
              </form>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
