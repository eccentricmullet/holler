// Service tags on pros: how they're shown and merged (redesign phase 2).
import { describe, expect, it } from "vitest";
import { formatTags, mergeTags, tagNames, type TagInfo } from "@/lib/pro-tags";

const cats: TagInfo[] = [
  { slug: "lawn", name: "Lawn", icon: "🌿" },
  { slug: "landscaping", name: "Landscaping", icon: "🌳" },
  { slug: "gutter-cleaning", name: "Gutters", icon: "🪜" },
  { slug: "pool", name: "Pool", icon: "🏊" },
];

describe("pro tags", () => {
  it("shows tags like the cards do, main one first", () => {
    expect(formatTags(["lawn", "landscaping", "gutter-cleaning"], cats)).toBe("🌿 Lawn · 🌳 Landscaping · 🪜 Gutters");
    expect(formatTags(["lawn", "landscaping", "gutter-cleaning", "pool"], cats, 2)).toBe("🌿 Lawn · 🌳 Landscaping");
    expect(formatTags(["nope", "pool"], cats)).toBe("🏊 Pool");
    expect(formatTags(null, cats)).toBe("");
    expect(tagNames(["pool", "lawn"], cats)).toEqual(["Pool", "Lawn"]);
  });

  it("adds new tags on the end without reordering or duplicating, and drops unknown ones", () => {
    expect(mergeTags(["pool"], ["lawn", "pool", "made-up"], cats)).toEqual(["pool", "lawn"]);
    expect(mergeTags([], ["gutter-cleaning"], cats)).toEqual(["gutter-cleaning"]);
  });
});
