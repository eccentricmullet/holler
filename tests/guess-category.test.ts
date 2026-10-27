import { describe, expect, it } from "vitest";
import { guessCategory } from "@/lib/guess-category";

describe("category guess from a business name", () => {
  it.each([
    ["Spring Hill Gutter Pros", "gutter-cleaning"],
    ["Clean Gutters & Roofs", "gutter-cleaning"],
    ["Tennessee Pressure Washing", "pressure-washing"],
    ["Crystal Window Cleaning", "window-cleaning"],
    ["Greenway Lawn Care", "lawn"],
    ["Rolling Hills Landscape", "landscaping"],
    ["Big Oak Tree Service", "tree-service"],
    ["Happy Paws Dog Walking", "dog-walking"],
    ["Fluffy Pet Grooming", "pet-grooming"],
    ["Two Guys Junk Hauling", "junk-removal"],
    ["Music City Movers", "movers"],
    ["Bloom & Petal Florist", "florist"],
    ["Mobile Auto Detailing", "mobile-car-detailing"],
    ["Main Street Auto Detail", "car-care"],
    ["Overhead Door of Columbia", "garage-doors"],
    ["Cool Breeze HVAC", "hvac"],
    ["Joe's Plumbing", "plumbing"],
    ["Hardwood Floors Plus", "flooring"],
    ["Maid Right Cleaning", "cleaning"],
    ["Glow Med Spa", "botox"],
    ["Lash Lounge", "lash-extensions"],
    ["Polished Nail Bar", "nails"],
    ["Salon 615", "hair-salon"],
    ["Spring Hill Animal Hospital", "vet"],
    ["Happy Tails Pet Resort", "dog-boarding"],
    ["Pampered Paws Mobile Grooming", "mobile-dog-grooming"],
    ["Crystal Clear Pools", "pool"],
  ])("%s → %s", (name, slug) => {
    expect(guessCategory(name)).toBe(slug);
  });

  it("returns nothing when it can't tell", () => {
    expect(guessCategory("Smith & Sons LLC")).toBeNull();
  });
});
