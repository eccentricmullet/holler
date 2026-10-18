import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { getProPage, isSaved, viewerCenter } from "@/lib/pros";
import ProView from "@/components/pro/ProView";
import PanelShell, { PanelCloseButton } from "@/components/pro/PanelShell";

// Opened from inside the app (map, lists): the pro page slides in over the map
// as a side panel on laptops, or full screen on phones. Direct links get the full page.
export default async function ProPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const near = await viewerCenter(supabase, SITE.launchCenter);
  const result = await getProPage(id, near);
  if (result.kind === "missing") notFound();
  if (result.kind === "merged") {
    const merged = await getProPage(result.into, near);
    if (merged.kind !== "found") notFound();
    return (
      <PanelShell>
        <ProView pro={merged.pro} backButton={<PanelCloseButton />} inPanel saved={await isSaved(supabase, merged.pro.id)} />
      </PanelShell>
    );
  }
  return (
    <PanelShell>
      <ProView pro={result.pro} backButton={<PanelCloseButton />} inPanel saved={await isSaved(supabase, result.pro.id)} />
    </PanelShell>
  );
}
