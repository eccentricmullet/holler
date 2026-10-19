# Holler design rules

The approved look is the **green** set in `docs/mockups/`. Open any `.dc.html` file in a text editor to read exact sizes, spacing and colors. (They were made in a design tool, so they won't render on their own in a browser; treat them as reference, not code to copy.)

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| `green` | #2BB24C | Shapes, selected rings, outlines |
| `lime` | #7ED957 | Tile outlines, soft shapes, dashed borders |
| `lime-soft` | #B8F27C | Decorative circles |
| `green-deep` | #178A35 | Buttons with white text (passes contrast) |
| `green-tint` | #E6F8DC | Emoji tile backgrounds, soft buttons |
| `green-wash` | #F1FBEA | Selected card background |
| `love` | #E5486A | Selected ❤️ border |
| `love-tint` | #FFF0F2 | ❤️ tile background |
| `ink` | #1A1D24 | Text, dark buttons |
| `muted` | #6B7079 | Secondary text |
| `dark-card` | #23262F | Promo cards |
| `surface` | #FFFFFF | Screens, cards |
| `field` | #F1F2F0 | Inputs, light buttons, map ground |
| `line` | #EEEFED | Dividers, unselected borders |

Business logos bring their own colors; the app stays green and neutral around them.

**Pro colors (step 11j).** Until a pro has a real logo, their pin and logo circle use their own saved color, chosen so no two pros in the same category share one. No greens (green is Holler's own color). Defined in `src/lib/pro-colors.ts`:

| Orange | Blue | Raspberry | Purple | Teal | Amber | Red | Indigo | Plum | Brown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #E8590C | #1971C2 | #C2255C | #6741D9 | #0C8599 | #F08C00 | #E03131 | #364FC7 | #862E9C | #8D5524 |

## Type

- Rubik from Google Fonts: 400, 500, 600, 700, 800.
- Screen titles 34px / 800 / -0.02em. Card titles 18–20px / 700. Body 15–16px. Small 13–14px muted.

## Shape and spacing

- Corner radius: buttons 16–20px, cards 20–28px, sheets 32px top corners, map controls 16px squares (48px).
- Spacing on a 4/8px grid; screen padding 24px (20px on the map).
- Shadows: soft and consistent, e.g. `0 4px 14px rgba(26,29,36,0.10)` for controls, `0 10px 30px rgba(26,29,36,0.14)` for floating cards.
- Touch targets at least 44px.

## Reactions

- Use real emoji: 👍 Thumbs up, ❤️ Love them. 🏡 for "within 1 mile", 📍/🕶️ for privacy choices, 📣 for invites.
- Emoji sit in rounded tiles (green-tint for 👍, love-tint for ❤️).
- Map logos get a small white circle with ❤️ when that neighbor chose Love.

## Map

- Mapbox Standard style (step 11i), darkened slightly, with store and transit labels hidden so pro logos stand out.
- Logo pins: 42px circles, 3px white border, soft shadow. Selected pro: 3px green ring; others fade to 30%.
- Street is default, satellite is a toggle.

## Screens in `docs/mockups/`

GreenMap (home), GreenPro (pro page), GreenFind (find a pro), GreenReact (👍/❤️), GreenDone (celebration), GreenProfile, GreenMine (my reactions), GreenSignup (address + privacy).
