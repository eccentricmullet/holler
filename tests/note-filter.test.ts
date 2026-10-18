import { describe, expect, it } from "vitest";
import { checkNote } from "@/lib/note-filter";

describe("note filter", () => {
  it.each([
    "Always on time.",
    "Fair price, great work.",
    "Saved our summer! 10/10",
    "Fixed it in 2 hours for $150",
    "Class act, would hire again",
    "Cocktail of good vibes",
    "",
  ])("allows a friendly note: %s", (note) => {
    expect(checkNote(note).ok).toBe(true);
  });

  it.each(["Call him at 615-555-0123", "(615) 555 0123", "text 6155550123", "+1 615.555.0123", "615 5550123"])(
    "blocks phone numbers: %s",
    (note) => {
      expect(checkNote(note)).toMatchObject({ ok: false, reason: expect.stringMatching(/phone/i) });
    }
  );

  it.each(["see greenway.com", "https://example.org", "www.mowers", "email me joe@gmail.com"])("blocks links and emails: %s", (note) => {
    expect(checkNote(note)).toMatchObject({ ok: false, reason: expect.stringMatching(/link/i) });
  });

  it.each(["this guy is shit", "F*CK yes", "total b1tch", "shiiiit work", "Asshole."])("blocks profanity: %s", (note) => {
    expect(checkNote(note)).toMatchObject({ ok: false, reason: expect.stringMatching(/friendly/i) });
  });

  it("blocks notes over 140 characters", () => {
    expect(checkNote("a".repeat(141)).ok).toBe(false);
  });
});
