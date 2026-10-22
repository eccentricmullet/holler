"use client";

import { useEffect, useState } from "react";

export const PORCH_SEEN_KEY = "holler-porch-seen";

// How many Porch posts are new since your last visit (the badge on the Porch tab).
export function usePorchCount(signedIn: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let since = "";
    try {
      since = localStorage.getItem(PORCH_SEEN_KEY) ?? "";
    } catch {
      // storage blocked: count the last few days
    }
    fetch(`/api/porch/summary${since ? `?since=${encodeURIComponent(since)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});
  }, [signedIn]);
  return count;
}

// Called when the Porch page is opened, so the badge resets
export function SeenPorch() {
  useEffect(() => {
    try {
      localStorage.setItem(PORCH_SEEN_KEY, new Date().toISOString());
    } catch {
      // storage blocked: badge just won't reset
    }
  }, []);
  return null;
}
