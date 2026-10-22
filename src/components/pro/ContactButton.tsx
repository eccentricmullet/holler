"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/Track";
import { socialKind, SOCIAL_LABEL } from "@/lib/social";

// One button to reach a pro. Tapping it offers Call or Text, so there's no
// separate chat-bubble button that looks like "leave a comment".
// No phone? It opens their Instagram or Facebook instead.
export default function ContactButton({
  proId,
  proName,
  phone,
  social = null,
  from,
  label = "Contact",
  size = "lg",
  className = "",
}: {
  proId: string;
  proName: string;
  phone: string | null;
  social?: string | null;
  from: string;
  label?: string;
  size?: "lg" | "md" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when tapping anywhere else
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const sizes = {
    lg: "h-14 gap-2 rounded-[18px] text-[17px]",
    md: "h-12 gap-1.5 rounded-2xl text-[15px]",
    icon: "size-10 rounded-xl",
  };
  const shortName = proName.split(" ")[0];
  const kind = socialKind(social);
  const button = `flex w-full items-center justify-center bg-neon font-semibold text-on-neon ${sizes[size]}`;

  // Instagram/Facebook only: one tap straight to their page
  if (!phone) {
    if (!social || !kind) return null;
    return (
      <a
        href={social}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={size === "icon" ? `Message ${proName} on ${SOCIAL_LABEL[kind]}` : undefined}
        onClick={(e) => {
          e.stopPropagation();
          track("tapped_social", { pro_id: proId, from, network: kind });
        }}
        className={`${button} ${className}`}
      >
        <SocialIcon kind={kind} />
        {size !== "icon" && (size === "lg" ? `Message on ${SOCIAL_LABEL[kind]}` : SOCIAL_LABEL[kind])}
      </a>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={size === "icon" ? `Contact ${proName}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={button}
      >
        <PhoneIcon />
        {size !== "icon" && label}
      </button>

      {open && (
        // A small sheet from the bottom of the screen (cards and panels would clip a pop-up menu)
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
        <div
          role="menu"
          aria-label={`Contact ${proName}`}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-[18px] bg-surface p-2 shadow-float"
        >
          <p className="px-3.5 pb-1 pt-2 text-[13px] font-semibold text-muted">{proName}</p>
          <a
            role="menuitem"
            href={`tel:${phone}`}
            onClick={() => {
              track("tapped_call", { pro_id: proId, from });
              setOpen(false);
            }}
            className="flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[16px] font-semibold text-ink hover:bg-field"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-green-tint text-green-deep">
              <PhoneIcon />
            </span>
            Call {shortName}
          </a>
          <a
            role="menuitem"
            href={`sms:${phone}`}
            onClick={() => {
              track("tapped_text", { pro_id: proId, from });
              setOpen(false);
            }}
            className="flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[16px] font-semibold text-ink hover:bg-field"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-green-tint text-green-deep">
              <TextIcon />
            </span>
            Text {shortName}
          </a>
          {social && kind && (
            <a
              role="menuitem"
              href={social}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track("tapped_social", { pro_id: proId, from, network: kind });
                setOpen(false);
              }}
              className="flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[16px] font-semibold text-ink hover:bg-field"
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-green-tint text-green-deep">
                <SocialIcon kind={kind} />
              </span>
              Message on {SOCIAL_LABEL[kind]}
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 h-12 rounded-2xl bg-field text-[15px] font-semibold text-ink"
          >
            Cancel
          </button>
        </div>
        </div>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="3" />
      <path d="M8 21l3-4" />
    </svg>
  );
}

function SocialIcon({ kind }: { kind: "instagram" | "facebook" }) {
  return kind === "instagram" ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" />
    </svg>
  );
}
