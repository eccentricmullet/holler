# Holler v1 Build Spec

Owner: Zak · Last updated Oct 18, 2026

## Overview

Holler v1 is a mobile-first web app that shows which local pros your neighbors trust, on a map. Tagline: **A map of the pros your neighbors trust.** It does one loop and does it well.

**The core loop**

1. A neighbor opens a texted link (no install).
2. They pick a category and see the logos of the pros their neighbors use, placed on the map at each neighbor's block.
3. They tap a pro, see 👍 and ❤️ counts from neighbors, and call or text.
4. They react to the pros they use in under 30 seconds.

**Success metric:** a Spring Hill neighbor opens a link, finds a trusted pro within a mile, and taps call within 60 seconds.

**Launch strategy:** the code works for any address in the US. Seeding, marketing and effort go only into Spring Hill (one or two neighborhoods first) until the map there is dense. TikTok builds a nationwide waitlist; towns unlock when they hit a signup threshold.

**Locked decisions**

- Public reactions are positive-only, and there are two: 👍 Thumbs up (good work, would hire again) and ❤️ Love them (awesome, tell everyone). No thumbs-down, no star ratings.
- Bad experiences go through a private flag that only the admin sees.
- Exact home addresses are never shown. Logos are placed at block level, and users can hide entirely.
- "Holler" is a working name; keep it in one config value so a rename is a one-line change.
- Phone-first design, plus a desktop layout in v1 (see Screens).

## Stack

| Piece | Tool | What it does |
| --- | --- | --- |
| App | Next.js (App Router, TypeScript) + Tailwind | The web app, mobile-first, installable as a home-screen app |
| Database + login | Supabase (Postgres + PostGIS) | Users, pros, reactions; "within 1 mile" queries; phone login |
| SMS codes | Twilio, connected inside Supabase | Sends the 6-digit login code |
| Map | Mapbox GL JS | The map (street + satellite), logo pins, clustering |
| Business lookup | Google Places API (New) | Autocomplete for pros so each business exists once; logos/photos |
| Hosting | Vercel | Deploys from GitHub on every push |
| Code | GitHub (private repo `holler`) | Source of truth |
| Analytics | PostHog | Funnel: link opened, signed up, reacted, tapped call |

Keys live in `.env.local` (never committed) and in Vercel environment variables. Template: `docs/env.template`.

## Screens

Anyone can browse the map and pro pages without an account. Signing up is required only to react or flag. Visual reference for every screen: `docs/mockups/` (see `docs/DESIGN.md`).

**1. Map (home)** — `mockups/GreenMap.dc.html`

- Full-screen light map. Big bold category title top-left ("Lawn ⌄") with "Who Wades Grove uses" under it.
- Square white floating buttons on the right: profile, all categories, map/satellite toggle, center on my home.
- Categories started as 12 (Pool, Lawn, HVAC, Plumbing, Electrical, Roofing, Pest, Cleaning, Handyman, Painting, Pressure washing, Tree service) and grow to about 24 in groups in step 11a.
- Each reaction shows as the pro's logo at the neighbor's block. A small ❤️ badge marks neighbors who love that pro. Selecting a pro highlights their logos and fades the rest. Logos group when zoomed out; hide individual logos at the closest zoom levels.
- Swipeable pro cards along the bottom: logo, name, 👍 and ❤️ counts, "N on map", green Call button, open-pro button. Sorted by reactions within 1 mile, then total.
- Green "+" button to react to a pro.
- Street map is the default; satellite is a toggle.
- Empty state: "No one's reacted to an HVAC pro near you yet. Know a good one?"

**2. Pro page** — `mockups/GreenPro.dc.html`

- Green header with soft circle shapes, logo overlapping it, name and category.
- Three outlined tiles: 👍 count, ❤️ count, 🏡 customers within 1 mile.
- "What neighbors say": notes tagged with each neighbor's 👍 or ❤️ (first name + last initial + neighborhood).
- Call (primary), Text, and react buttons. Share button. Quiet "Had a bad experience?" private flag link.
- Clean URL per pro with a good link preview when texted (name, category, counts).

**3. React to a pro (under 30 seconds)** — `mockups/GreenFind.dc.html`, `GreenReact.dc.html`, `GreenDone.dc.html`

1. Search the business (Google Places autocomplete, Spring Hill first). Not listed → name + phone.
2. Confirm category, tap 👍 Thumbs up or ❤️ Love them.
3. Optional note, 140 characters max.
4. Celebration screen: "React to another pro" + "Invite a neighbor".

**4. Sign up** — `mockups/GreenSignup.dc.html`

- Phone number → 6-digit code → first name, last initial → home address (autocomplete).
- Map privacy choice on the same screen: 📍 Near my block (default) or 🕶️ Keep me hidden.
- Arriving from a pro's invite link lands them straight in the react flow for that pro.

**5. Profile + My reactions** — `mockups/GreenProfile.dc.html`, `GreenMine.dc.html`

- Profile: greeting, outlined tiles (👍 given, ❤️ given, neighbors helped), dark "Invite your neighbors" card, menu list.
- My reactions: list with each reaction emoji; tap to switch 👍/❤️ or remove. Delete account removes all their data.

**6. Admin (only Zak)**

- Review queue of private flags and reported notes; merge duplicate pros; edit or hide a pro; hide a user's reactions or ban a user; simple counts by neighborhood.

**Desktop layout (v1)**

- Map fills the screen; pro list in a left sidebar instead of bottom cards; hovering a pro highlights their logos.
- Pro page opens as a side panel beside the map. React, sign-up and profile open as centered modals.
- Same components and styles; layout switches by screen width.

## Data model

Locations are PostGIS points so "within 1 mile" is a single fast query.

| Table | Key fields | Notes |
| --- | --- | --- |
| `households` | id, address (private), location (exact, private), display_location (fuzzed), neighborhood, created_at | One per home. Exact address never sent to the browser. |
| `profiles` | id (= auth user), household_id, first_name, last_initial, phone_verified, privacy (block / hidden), role (user / admin), banned | Several people can share a household. |
| `categories` | id, slug, name, icon, sort_order | Seeded list (12 at launch of v1, about 24 in groups after step 11a). Has a `group` for the category sheet. |
| `pros` | id, google_place_id (unique, nullable), name, phone, website, logo_url (site or Google Places; colored initials fallback), photo_url, location, service_area_text, status (active / hidden), merged_into_id, created_by | One row per real business. |
| `vouches` | id, household_id, profile_id, pro_id, category_id, reaction (thumbs_up / love), note (≤140), status (visible / hidden), created_at | **Unique on (household_id, pro_id, category_id).** |
| `flags` | id, pro_id or vouch_id, profile_id, reason, details, status (open / resolved), created_at | Private. Admins only. |

Also: `invites` (id, pro_id, code, created_at, uses), `waitlist` (id, phone or email, zip, town, created_at). Row Level Security on every table; browsers read only public pro data, reaction counts and fuzzed locations. Database function `pros_near(lat, lng, radius_m, category)` returns pros with 👍/❤️ counts within radius and in total.

## Trust, privacy and moderation

- Phone-verified account required to react or flag.
- One reaction per household per pro per category (database constraint).
- No self-reacting: block when the user's phone matches the pro's phone.
- Rate limits: max 15 reactions per account per day; max 3 accounts per address.
- Reactions arriving through a pro's invite link are labeled internally.
- Display locations snapped to a ~150 m grid cell, never the house.
- Hidden users count toward totals but show no logo and appear as "a neighbor."
- Names show as first name + last initial only.
- Account deletion removes household link, profile and reactions within 24 hours.
- Notes checked for phone numbers, links and profanity; any note can be reported.
- A pro with 3+ open flags alerts the admin; nothing public.
- Privacy policy and terms before launch.

## Design rules

Full details in `docs/DESIGN.md`. Summary: Rubik (800 for headings), fresh green palette, white surfaces, big rounded corners, square floating map controls, real emoji for reactions, phone-first at 390 px, map interactive in under 2 seconds on 4G, skeleton loaders, friendly local copy, no fake data in production.

## Build order

Finish each step's "done when" before starting the next, and commit after every step.

| # | Build | Done when |
| --- | --- | --- |
| 0 | Clickable mockup + design rules | Done (see `docs/mockups/`) |
| 1 | Next.js project, Tailwind, design tokens, Rubik, deploy to Vercel | A styled placeholder page is live on a URL |
| 2 | Supabase schema: all tables, PostGIS, RLS, 12 categories seeded | Tables exist; a browser can't read private columns |
| 3 | Phone login + sign-up with address and privacy choice | You can sign up on your phone with a real code |
| 4 | Map screen: Mapbox, categories, logo pins, ❤️ badges, `pros_near` | Seeded test pros show and filter by category |
| 5 | Pro page with call, text, share, link previews | A texted pro link shows a clean preview card |
| 6 | React flow with Google Places search and manual fallback | Reacting to a new business takes under 30 seconds |
| 7 | Trust rules: unique reaction, self-react block, rate limits, note filter | Each rule is tested and blocks what it should |
| 8 | Profile, My reactions, delete account | A user can edit, remove and delete everything |
| 9 | Private flags, admin queue, merge duplicates | You can clear a flag and merge two pros from your phone |
| 10 | Pro invite links + waitlist "unlock your town" page | A pro's link lands a new user in their react flow |
| 11 | Desktop layout, PostHog events, empty states, errors, speed pass, privacy policy | Works well on a laptop; funnel shows in PostHog |
| 11a | More categories: ~24 in groups (Outside, Inside, Moving & hauling, Pets, Cars) with search in the category sheet. No childcare for now. | All categories show on the map and in the react flow; search finds them |
| 11b | Quick tags on a reaction (optional, one tap each): On time, Fair price, Quick to reply, Clean work, Would rehire | Tags save with a reaction; pro page shows "N neighbors say fair price" |
| 11c | Price hint on a reaction (optional): $ / $$ / $$$ | Pro page shows the typical price level from neighbors |
| 11d | Recency: show when neighbors used a pro ("Used this spring") on notes and cards | Older reactions read as older; recent use is visible at a glance |
| 11e | "React to 3 pros" right after sign-up (skippable) | A new neighbor can add 3 pros in about a minute |
| 11f | Saved pros ("My pros") plus a shareable "My Spring Hill pros" link | Save from a pro page; list in profile; share link opens a clean page |
| 11g | Seasonal nudges as an in-app map banner ("Gutter season: who cleaned yours?"). Texts come later (needs Twilio A2P 10DLC registration). | The right banner shows for the season and opens the react flow for that category |
| 11h | Ask the neighborhood: one-tap "Need a plumber? Ask neighbors." Neighbors within a mile answer by tapping a pro, not typing. In-app "Asks near you" list plus optional browser push. Not a message board. | An ask gets answered with a pro, and the answer adds a reaction |
| 11i | Map style: Mapbox Standard, darkened slightly so parks, water and streets read clearly and pins pop | The map looks lively, not washed out, on phone and laptop |
| 11j | Every pro gets its own color (no two pros in the same category nearby share one); a real logo replaces it | Three lawn pros in Spring Hill show three different colors everywhere |
| 11k | **The Porch**: a self-running neighborhood board. Tabs: All · Pros (Need a pro, Just hired) · Sales & free (garage sales, curb alerts) · Pets (lost & found) · Events · Heads-up (roads, weather, power, water only). Also "New neighbor" posts. Short post + optional photo; 👍/❤️ and one-tap action buttons instead of comment threads; posts expire automatically; 3 reports from different homes auto-hides a post | A neighbor can post a curb alert with a photo in under 30 seconds; others see it in their area; it disappears on schedule |
| 11l | Opt-in alerts (browser push): someone near you needs a pro; someone answered your ask; optional daily "Today on The Porch" | Opted-in phone gets the alert and tapping it opens the right screen |
| 12 | Seed Spring Hill with real reactions; test with 10 neighbors | 100+ real reactions; testers find a pro in under 60 seconds |

**v1.1 principles (steps 11a–11h):** every addition is one tap and optional; reactions stay positive-only with just 👍 and ❤️ (tags add detail instead of more emoji); no open comment threads or chat (The Porch, step 11k, uses reactions and one-tap actions instead and moderates itself); never sell leads or share a neighbor's number with pros; ranking stays purely neighbor reactions.

## Out of scope for v1

Open comment threads or chat, private messaging, pro accounts/dashboards, payments or ads, star ratings or long reviews, native apps, marketing outside Spring Hill.

## Open questions

- Final name and domain
- Which one or two Spring Hill neighborhoods launch first
- Waitlist threshold to unlock a new town (100 signups is a starting guess)
