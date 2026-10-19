"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { forgetDevice, saveAlerts, type AlertPrefs } from "./actions";
import { SITE } from "@/config/site";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = "checking" | "ok" | "ios-needs-home-screen" | "unsupported" | "blocked";

// Three opt-in alerts, all off until turned on. Turning one on asks the phone for permission.
export default function AlertSettings({ initial, publicKey }: { initial: AlertPrefs; publicKey: string }) {
  const [prefs, setPrefs] = useState(initial);
  const [support, setSupport] = useState<Support>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupport(ios && !standalone ? "ios-needs-home-screen" : "unsupported");
    } else if (Notification.permission === "denied") {
      setSupport("blocked");
    } else {
      setSupport("ok");
    }
  }, []);

  async function subscription() {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("denied");
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
  }

  function update(next: AlertPrefs) {
    setMsg(null);
    const anyOn = next.asks || next.answers || next.porchDaily;
    startTransition(async () => {
      try {
        let sub: PushSubscriptionJSON | null = null;
        if (anyOn) sub = (await subscription()).toJSON();
        const r = await saveAlerts(next, sub as never);
        if (!r.ok) return setMsg(r.error ?? "Couldn't save that.");
        if (!anyOn) {
          const reg = await navigator.serviceWorker.getRegistration();
          const s = await reg?.pushManager.getSubscription();
          if (s) {
            await forgetDevice(s.endpoint);
            await s.unsubscribe();
          }
        }
        setPrefs(next);
        setMsg("Saved ✓");
      } catch {
        setSupport(Notification.permission === "denied" ? "blocked" : support);
        setMsg("Your phone didn't allow alerts. You can turn them on in its settings.");
      }
    });
  }

  const rows: { key: keyof AlertPrefs; emoji: string; title: string; body: string }[] = [
    { key: "asks", emoji: "🙋", title: "A neighbor needs a pro", body: "When someone near you asks who to hire (your Porch distance)." },
    { key: "answers", emoji: "📬", title: "Someone answered your ask", body: "When a neighbor recommends a pro to you." },
    { key: "porchDaily", emoji: "🏡", title: "Daily Porch roundup", body: "One evening alert, only on days neighbors posted." },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/profile" aria-label="Back to profile" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="mt-7 text-[34px] font-extrabold tracking-[-0.02em]">Alerts</h1>
      <p className="mt-1.5 text-base text-muted">All off unless you turn them on. Change anytime.</p>

      {support === "ios-needs-home-screen" && (
        <div className="mt-5 rounded-[20px] bg-green-tint p-4 text-[15px] leading-snug">
          <p className="font-bold">On iPhone, add {SITE.name} to your home screen first</p>
          <p className="mt-1">
            Tap <span className="font-semibold">Share</span> (the square with an arrow) → <span className="font-semibold">Add to Home Screen</span>, then open {SITE.name} from
            the new icon and come back here.
          </p>
        </div>
      )}
      {support === "unsupported" && (
        <p className="mt-5 rounded-[20px] bg-field p-4 text-[15px]">This browser can&apos;t show alerts. Try {SITE.name} in Chrome or Safari on your phone.</p>
      )}
      {support === "blocked" && (
        <p className="mt-5 rounded-[20px] bg-love-tint p-4 text-[15px]">
          Alerts are blocked for {SITE.name} on this phone. Turn them on in your phone&apos;s settings for this site, then come back.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {rows.map((r) => {
          const on = prefs[r.key];
          const disabled = pending || support !== "ok";
          return (
            <button
              key={r.key}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={disabled}
              onClick={() => update({ ...prefs, [r.key]: !on })}
              className={`flex items-center gap-3.5 rounded-[22px] border-[2.5px] p-4 text-left transition-colors disabled:opacity-50 ${
                on ? "border-green-deep bg-green-tint" : "border-line bg-surface"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {r.emoji}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[17px] font-bold">{r.title}</span>
                <span className="text-sm text-muted">{r.body}</span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-green-deep" : "bg-line"}`} aria-hidden>
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
              </span>
            </button>
          );
        })}
      </div>
      {msg && <p className="mt-4 text-[15px] font-medium text-green-deep">{msg}</p>}
    </main>
  );
}
