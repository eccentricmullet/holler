import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { getProPage, viewerCenter } from "@/lib/pros";
import ProView from "@/components/pro/ProView";

type Params = { params: Promise<{ id: string }> };

// Link preview text when the page is texted or shared
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const result = await getProPage(id, SITE.launchCenter);
  if (result.kind !== "found") return { title: SITE.name };
  const { pro } = result;
  const title = pro.categoryName ? `${pro.name} · ${pro.categoryName}` : pro.name;
  const description = `👍 ${pro.thumbs} · ❤️ ${pro.love} from ${SITE.launchTownShort} neighbors on ${SITE.name}`;
  return {
    title: `${title} · ${SITE.name}`,
    description,
    openGraph: { title, description, siteName: SITE.name, type: "website", url: `/pro/${pro.id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Full page: someone opened a texted or shared link directly.
export default async function ProPageRoute({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const near = await viewerCenter(supabase, SITE.launchCenter);
  const result = await getProPage(id, near);
  if (result.kind === "merged") permanentRedirect(`/pro/${result.into}`);
  if (result.kind === "missing") notFound();

  return (
    <main className="lg:min-h-dvh lg:bg-field lg:py-10">
      <div className="lg:mx-auto lg:max-w-md lg:overflow-hidden lg:rounded-[32px] lg:shadow-float">
        <ProView
          pro={result.pro}
          backButton={
            <Link href="/" aria-label="Back to map" className="flex size-[46px] items-center justify-center rounded-2xl bg-surface text-ink">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
          }
        />
      </div>
    </main>
  );
}
