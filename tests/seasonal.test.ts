import { describe, expect, it } from "vitest";
import { currentNudge } from "@/lib/seasonal";
import { readFileSync } from "node:fs";

describe("seasonal banner", () => {
  it("shows gutters in the fall, mowing in spring, AC in summer, heat in winter", () => {
    expect(currentNudge(new Date(2026, 9, 1)).category).toBe("gutter-cleaning");
    expect(currentNudge(new Date(2026, 3, 1)).category).toBe("lawn");
    expect(currentNudge(new Date(2026, 5, 1)).category).toBe("hvac");
    expect(currentNudge(new Date(2026, 0, 1)).category).toBe("hvac");
  });

  it("only points at categories that exist", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261018200000_more_categories.sql", import.meta.url), "utf8");
    for (let m = 0; m < 12; m++) {
      for (const day of [1, 8, 15, 22, 29]) {
        const n = currentNudge(new Date(2026, m, Math.min(day, 28)));
        expect(sql).toContain(`('${n.category}',`);
      }
    }
  });
});
