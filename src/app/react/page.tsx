import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startingTags } from "./actions";
import { askForAnswer, myOpenAsk } from "@/lib/asks";
import ReactFlow from "./ReactFlow";

export const metadata: Metadata = { title: `React to a pro · ${SITE.name}` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReactPage({ searchParams }: { searchParams: Promise<{ pro?: string; from?: string; onboard?: string; category?: string; ask?: string; found?: string }> }) {
  const { pro: proParam, from, onboard, category: categoryParam, ask: askParam, found: foundParam } = await searchParams;
  // Keep "from=invite" through sign-up so the visit still counts as an invite
  const keep = new URLSearchParams();
  if (proParam) keep.set("pro", proParam);
  if (from === "invite") keep.set("from", "invite");
  if (categoryParam) keep.set("category", categoryParam);
  if (onboard === "1") keep.set("onboard", "1");
  if (askParam) keep.set("ask", askParam);
  if (foundParam) keep.set("found", foundParam);
  const here = keep.size ? `/react?${keep}` : "/react";

  // Reacting needs a finished, phone-verified account
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(here)}`);
  const { data: profile } = await supabase.from("profiles").select("id, household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) redirect(`/signup?next=${encodeURIComponent(here)}`);

  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");

  // Came from a pro page: skip the search
  let start: { proId: string; name: string; logoUrl: string | null; category: string | null } | null = null;
  if (proParam && UUID.test(proParam)) {
    const { data: pro } = await createAdminClient()
      .from("pros")
      .select("id, name, logo_url, status")
      .eq("id", proParam)
      .maybeSingle();
    if (pro && pro.status === "active") {
      const category = (await startingTags({ kind: "holler", proId: pro.id }, pro.name)).tags[0] ?? null;
      start = { proId: pro.id, name: pro.name, logoUrl: pro.logo_url, category };
    }
  }

  // Answering a neighbor's ask: the ask's category is locked in (11h)
  const answerTo = askParam && UUID.test(askParam) ? await askForAnswer(createAdminClient(), user.id, askParam) : null;
  if (askParam && !answerTo) redirect("/asks");

  // "Found someone" on your own request: reacting to the pro you went with closes it
  const foundFor = foundParam && UUID.test(foundParam) ? await myOpenAsk(createAdminClient(), user.id, foundParam) : null;
  if (foundParam && !foundFor) redirect("/asks");

  // From the seasonal banner: that category comes pre-picked
  const presetCategory = answerTo?.categorySlug ?? (categories?.some((c) => c.slug === categoryParam) ? categoryParam! : null);

  return (
    <ReactFlow
      categories={categories ?? []}
      start={answerTo ? null : start}
      onboarding={onboard === "1" && !start && !answerTo}
      presetCategory={presetCategory}
      answerTo={answerTo ? { id: answerTo.id, who: answerTo.who } : null}
      foundFor={foundFor ? foundFor.id : null}
    />
  );
}
