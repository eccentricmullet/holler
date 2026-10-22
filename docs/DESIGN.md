# Holler design rules

The current look is the **neon redesign** (Oct 2026): calm off-white screens, white cards, and one bright neon green used sparingly. The older green mockups in `docs/mockups/` are kept for layout reference only; their colors and font are retired.

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| `neon` | #35E07B | ONLY primary buttons, selected chips/tabs, the center + button, request pins, badges |
| `on-neon` | #10241A | Text and icons on neon (never white on neon) |
| `green-deep` | #0E6B33 | Green text on white (never neon text) |
| `green-tint` | #E4F9EC | Emoji tile backgrounds, avatar circles |
| `green-wash` | #F0FCF4 | Selected card background (with a neon border) |
| `love` | #E5486A | Delete / danger buttons |
| `love-tint` | #FFF0F2 | ❤️ tile background |
| `ink` | #1F2421 | Text (charcoal) |
| `muted` | #5B635E | Secondary text |
| `page` | #F6F7F4 | Screen background (off-white) |
| `surface` | #FFFFFF | Cards, sheets, inputs, the tab bar |
| `field` | #EEF0EC | Loading placeholders, quiet buttons |
| `line` | #E3E6E1 | 1px borders on unselected chips and inputs, dividers |

Rules:
- Selected chips and tabs: neon with dark text. Unselected chips: white with a 1px `line` border and dark text. Never black for a selected state.
- No heavy borders, no decorative circles, nothing chunky or game-like.
- Business logos bring their own colors; the app stays neutral around them.

**Pro colors (step 11j).** Until a pro has a real logo, their pin and logo circle use their own saved color, chosen so no two pros in the same category share one. No greens. Defined in `src/lib/pro-colors.ts`:

| Orange | Blue | Raspberry | Purple | Teal | Amber | Red | Indigo | Plum | Brown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #E8590C | #1971C2 | #C2255C | #6741D9 | #0C8599 | #F08C00 | #E03131 | #364FC7 | #862E9C | #8D5524 |

## Type

- Inter (Google Fonts), falling back to the system font.
- Screen titles 28px bold. Card titles 16–20px bold. Body 15px. Small 13px muted. Text inputs stay 16px so iPhones don't zoom in.

## Shape and spacing

- Cards: white, 16–18px corners, shadow `0 1px 3px rgba(20,30,25,0.06)` (`shadow-card`).
- Floating things on the map use `shadow-control` / `shadow-float` (a little stronger so they read over the map).
- Buttons 54px tall with 16px corners; chips are fully rounded pills.
- Sheets: 24px top corners. Spacing on a 4/8px grid; screen padding 24px (20px on the map).
- Touch targets at least 44px.

## Navigation

- Bottom tab bar on the main screens: **Porch · Curb · [+] · Map · Me** (`src/components/TabBar.tsx`). Active tab: neon pill behind the icon, bold dark label. Inactive: gray.
- The + opens a sheet: Recommend a pro, Ask for a pro, List on the Curb, Garage sale, Pet post.
- Screens under the tab bar leave room for it with `pb-[calc(var(--tabbar)+24px)]`.

## Reactions and emoji

- Real emoji for services (🔌 Electrician, 🚰 Plumbing, 🌿 Lawn, 🏊 Pools, 🧹 Cleaning, ❄️ HVAC, 🏠 Roofing, 🪜 Gutters, 🌳 Landscaping) and reactions (👍 ❤️).
- Map logos get a small white circle with ❤️ when that neighbor chose Love.

## Map

- Mapbox Standard style (step 11i), darkened slightly, with store and transit labels hidden so pro logos stand out.
- Logo pins: 42px circles, 3px white border, soft shadow. Selected pro: 3px neon ring; others fade to 30%.
- Street is default, satellite is a toggle.
