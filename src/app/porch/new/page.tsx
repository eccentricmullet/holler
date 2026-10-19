import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { KINDS, type PorchKind } from "@/lib/porch-kinds";
import NewPost from "./NewPost";

export const metadata: Metadata = { title: `New post · The Porch · ${SITE.name}` };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string }> }) {
  const { tab, kind } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/porch/new");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/signup?next=/porch/new");

  // Coming from a tab narrows the choices to that tab's post types
  const kinds = (Object.keys(KINDS) as PorchKind[]).filter((k) => !tab || tab === "all" || KINDS[k].tab === tab);
  const preset = kind && kind in KINDS ? (kind as PorchKind) : kinds.length === 1 ? kinds[0] : null;
  return <NewPost kinds={kinds.length ? kinds : (Object.keys(KINDS) as PorchKind[])} preset={preset} />;
}
