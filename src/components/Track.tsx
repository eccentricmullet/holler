"use client";

import posthog from "posthog-js";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

// Funnel events: link_opened → signed_up → reacted → tapped_call.
// Never send names, phone numbers or addresses; ids and categories only.
export type TrackEvent =
  | "link_opened"
  | "signed_up"
  | "logged_in"
  | "reacted"
  | "tapped_call"
  | "tapped_text"
  | "shared_pro"
  | "invited_neighbor"
  | "joined_waitlist"
  | "porch_posted";

export function track(event: TrackEvent, props?: Record<string, string | number | boolean | null>) {
  try {
    if (posthog.__loaded) posthog.capture(event, props);
  } catch {
    // analytics must never break the app
  }
}

// A link (tel:, sms:, or page) that records an event when tapped.
export function TrackedLink({
  event,
  props,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { event: TrackEvent; props?: Record<string, string | number | boolean | null> }) {
  return (
    <a
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        track(event, props);
        onClick?.(e);
      }}
    />
  );
}
