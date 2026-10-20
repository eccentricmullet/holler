"use client";

import { useEffect } from "react";

// Registers the app's service worker on every page so phones treat Holler as installable
// (and opt-in alerts can be delivered).
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
