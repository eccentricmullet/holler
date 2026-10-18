"use client";

// Opens the phone's share sheet with a link to the map; falls back to a text message.
export function shareInvite() {
  const url = `${window.location.origin}/`;
  const text = "I've been sharing the local pros I trust on this map. Add yours!";
  if (navigator.share) {
    navigator.share({ text, url }).catch(() => {
      // closed the share sheet
    });
  } else {
    window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;
  }
}

export default function InviteButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={shareInvite} className={className}>
      {children}
    </button>
  );
}
