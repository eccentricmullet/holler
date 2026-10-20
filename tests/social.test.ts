// Instagram / Facebook links for pros without a phone number.
import { describe, expect, it } from "vitest";
import { cleanSocialUrl, socialKind } from "@/lib/social";

describe("cleanSocialUrl", () => {
  it("accepts the ways people paste Instagram", () => {
    expect(cleanSocialUrl("@lawn.bros")).toBe("https://www.instagram.com/lawn.bros");
    expect(cleanSocialUrl("instagram.com/lawnbros/")).toBe("https://www.instagram.com/lawnbros");
    expect(cleanSocialUrl("https://www.instagram.com/lawnbros?igsh=abc123")).toBe("https://www.instagram.com/lawnbros");
  });

  it("accepts Facebook pages, keeping profile ids", () => {
    expect(cleanSocialUrl("https://m.facebook.com/SpringHillCakes")).toBe("https://www.facebook.com/SpringHillCakes");
    expect(cleanSocialUrl("facebook.com/profile.php?id=123&ref=x")).toBe("https://www.facebook.com/profile.php?id=123");
  });

  it("rejects other sites and bare home pages", () => {
    expect(cleanSocialUrl("https://example.com/lawnbros")).toBeNull();
    expect(cleanSocialUrl("instagram.com")).toBeNull();
    expect(cleanSocialUrl("not a link")).toBeNull();
    expect(cleanSocialUrl("")).toBeNull();
  });

  it("knows which one it is", () => {
    expect(socialKind("https://www.instagram.com/x")).toBe("instagram");
    expect(socialKind("https://www.facebook.com/x")).toBe("facebook");
    expect(socialKind(null)).toBeNull();
  });
});
