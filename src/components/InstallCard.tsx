"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/config/site";

// "Add Holler to your home screen" so neighbors can get back with one tap.
// Android/Chrome: one-tap install. iPhone: shows the two Safari steps. Hidden once installed,
// on laptops, or after "Not now".
type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "holler-install-dismissed";
let deferred: BeforeInstallPrompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own friendlier button
    deferred = e as BeforeInstallPrompt;
  });
}

export default function InstallCard({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const phone = window.matchMedia("(max-width: 1023px)").matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // storage blocked: just show it
    }
    if (standalone || !phone || dismissed) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) return setMode("ios");
    if (deferred) return setMode("android");
    const onPrompt = () => setMode("android");
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked: hide for this visit
    }
    setMode("hidden");
  }

  async function install() {
    if (mode === "ios") return setSteps(true);
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") setMode("hidden");
  }

  const box = dark ? "bg-surface text-ink" : "bg-surface text-ink shadow-card";
  const sub = "text-muted";

  return (
    <div className={`rounded-[18px] p-4 ${box} ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">Keep {SITE.name} one tap away</span>
          <span className={`text-[13px] ${sub}`}>Add it to your home screen like an app.</span>
        </span>
      </div>
      {steps ? (
        <ol className="mt-3 flex flex-col gap-1.5 text-[15px]">
          <li>
            1. Tap <span className="font-semibold">Share</span> (the square with an arrow ⬆️) at the bottom of Safari
          </li>
          <li>
            2. Tap <span className="font-semibold">Add to Home Screen</span>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={install} className="h-10 flex-1 rounded-xl bg-neon text-sm font-semibold text-on-neon">
            {mode === "ios" ? "Show me how" : "Add to home screen"}
          </button>
          <button type="button" onClick={dismiss} className={`h-10 rounded-xl px-3 text-sm font-semibold ${sub}`}>
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
