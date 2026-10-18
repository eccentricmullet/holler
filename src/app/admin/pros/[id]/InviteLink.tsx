"use client";

import { useEffect, useState } from "react";

// Shows the pro's invite link and lets the admin share or copy it.
export default function InviteLink({ code, proName }: { code: string; proName: string }) {
  const [url, setUrl] = useState(`/i/${code}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/i/${code}`), [code]);

  async function share() {
    const text = `${proName}: your customers can tap this to give you a 👍 or ❤️ on the neighborhood map.`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        // closed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-xl bg-field px-3 py-3 text-sm">{url}</code>
      <button type="button" onClick={share} className="h-11 shrink-0 rounded-xl bg-green-deep px-4 text-sm font-semibold text-white">
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}
