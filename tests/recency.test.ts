import { describe, expect, it } from "vitest";
import { whenLabel } from "@/lib/recency";

const now = new Date(2026, 9, 18); // Oct 18, 2026 (fall)

describe("recency labels", () => {
  it.each([
    [new Date(2026, 9, 1), "this fall"],
    [new Date(2026, 8, 5), "this fall"],
    [new Date(2026, 6, 4), "last summer"],
    [new Date(2026, 3, 10), "spring 2026"],
    [new Date(2025, 11, 20), "winter 2026"], // December belongs to the winter that ends in 2026
    [new Date(2025, 9, 1), "fall 2025"],
    [new Date(2024, 5, 1), "2024"],
  ])("%s → %s", (date, label) => {
    expect(whenLabel(date, now)).toBe(label);
  });

  it("handles winter across the new year", () => {
    expect(whenLabel(new Date(2026, 11, 20), new Date(2027, 0, 15))).toBe("this winter");
    expect(whenLabel(new Date(2026, 10, 20), new Date(2027, 0, 15))).toBe("last fall");
  });
});
