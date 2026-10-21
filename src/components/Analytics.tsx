"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { track } from "./Track";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
// Only the live site sends analytics, so testing on a computer doesn't muddy the numbers.
const ENABLED = !!KEY && process.env.NODE_ENV === "production";

// Start right away (before any page effects run) so the first page view isn't missed.
if (typeof window !== "undefined" && ENABLED && !posthog.__loaded) {
  posthog.init(KEY!, {
    api_host: HOST,
    capture_pageview: false, // sent below on every route change
    person_profiles: "identified_only",
    autocapture: false,
    disable_session_recording: true,
    // Don't download extras we don't use (keeps the page light on phones)
    disable_surveys: true,
    capture_dead_clicks: false,
    respect_dnt: true,
  });
}

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!ENABLED || !posthog.__loaded) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
    // First step of the funnel: the first page of each visit, wherever the link pointed
    // (the home page counts too, since that's the link people text each other)
    const from = search.get("from") ?? (search.get("next")?.includes("from=invite") ? "invite" : null);
    let firstPage = true;
    try {
      firstPage = !sessionStorage.getItem("holler-visit");
      sessionStorage.setItem("holler-visit", "1");
    } catch {
      // storage blocked: count every page
    }
    if (firstPage || from === "invite") {
      const kind = from === "invite" ? "invite" : pathname.startsWith("/pro/") ? "pro_page" : pathname === "/" ? "home" : "other";
      track("link_opened", { kind, path: pathname });
    }
  }, [pathname, search]);
  return null;
}

export default function Analytics() {
  useEffect(() => {
    if (!ENABLED || !posthog.__loaded) return;
    // Tie events to the account id (never the name or phone)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) posthog.identify(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) posthog.identify(session.user.id);
      if (event === "SIGNED_OUT") posthog.reset();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  );
}
