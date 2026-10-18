import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FlagForm from "./FlagForm";

export const metadata: Metadata = { title: `Private report · ${SITE.name}` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Private report about a pro (bad experience) or a note (report it). Only the admin sees these.
export default async function FlagPage({ searchParams }: { searchParams: Promise<{ pro?: string; note?: string }> }) {
  const { pro, note } = await searchParams;
  const target = pro && UUID.test(pro) ? { kind: "pro" as const, id: pro } : note && UUID.test(note) ? { kind: "note" as const, id: note } : null;
  if (!target) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const here = `/flag?${target.kind}=${target.id}`;
  if (!user) redirect(`/signup?next=${encodeURIComponent(here)}`);

  const db = createAdminClient();
  let label: string;
  let backHref: string;
  if (target.kind === "pro") {
    const { data } = await db.from("pros").select("id, name").eq("id", target.id).maybeSingle();
    if (!data) notFound();
    label = data.name;
    backHref = `/pro/${data.id}`;
  } else {
    const { data } = await db.from("vouches").select("note, pro_id, pros(name)").eq("id", target.id).maybeSingle();
    if (!data?.note) notFound();
    label = `“${data.note}”`;
    backHref = `/pro/${data.pro_id}`;
  }

  return <FlagForm target={target} label={label} backHref={backHref} />;
}
