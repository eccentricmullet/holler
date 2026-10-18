import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import MyReactions, { type MyReaction } from "./MyReactions";

export const metadata: Metadata = { title: `My reactions · ${SITE.name}` };

export default async function MyReactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile/reactions");

  // Runs as the user: the database only returns their own reactions
  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from("vouches")
      .select("id, reaction, note, pros(id, name, logo_url), categories(name)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("privacy").eq("id", user.id).maybeSingle(),
  ]);

  const reactions: MyReaction[] = (rows ?? []).map((r) => {
    const pro = r.pros as unknown as { id: string; name: string; logo_url: string | null } | null;
    return {
      id: r.id,
      reaction: r.reaction as MyReaction["reaction"],
      note: r.note,
      proId: pro?.id ?? "",
      proName: pro?.name ?? "A pro",
      logoUrl: pro?.logo_url ?? null,
      categoryName: (r.categories as unknown as { name: string } | null)?.name ?? "",
    };
  });

  return <MyReactions reactions={reactions} hidden={profile?.privacy === "hidden"} />;
}
