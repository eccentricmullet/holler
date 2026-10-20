// Small businesses without a phone number can be reached on Instagram or Facebook instead.
export type SocialKind = "instagram" | "facebook";

const HOSTS: Record<string, SocialKind> = {
  "instagram.com": "instagram",
  "instagr.am": "instagram",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.me": "facebook",
};

// "@lawnbros", "instagram.com/lawnbros", "https://m.facebook.com/LawnBros?ref=x" ->
// a clean https link, or null if it isn't an Instagram or Facebook page.
export function cleanSocialUrl(input: string | null | undefined): string | null {
  let s = (input ?? "").trim();
  if (!s) return null;
  // A bare @handle is an Instagram handle
  const handle = s.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (handle) return `https://www.instagram.com/${handle[1]}`;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|web|business)\./, "");
  const kind = HOSTS[host];
  if (!kind) return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return null; // needs a page, not just the home page
  const canonical = kind === "instagram" ? "www.instagram.com" : host === "facebook.com" ? "www.facebook.com" : host;
  // Facebook page links sometimes need ?id=… (profile.php?id=123); Instagram never does
  const query = kind === "facebook" && url.searchParams.get("id") ? `?id=${url.searchParams.get("id")}` : "";
  return `https://${canonical}${path}${query}`;
}

export function socialKind(url: string | null | undefined): SocialKind | null {
  if (!url) return null;
  try {
    return HOSTS[new URL(url).hostname.toLowerCase().replace(/^(www|m|web|business)\./, "")] ?? null;
  } catch {
    return null;
  }
}

export const SOCIAL_LABEL: Record<SocialKind, string> = { instagram: "Instagram", facebook: "Facebook" };
