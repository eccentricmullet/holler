# What Holler stores, and open questions for a lawyer

Plain-English summary for a quick legal review before launch. Written October 19, 2026.

## The short version

- Neighbors' exact addresses and locations are stored privately and never shown. The map shows a blurred spot about 150 m (one block) wide.
- Phone numbers are used only for login codes and to stop people reacting to their own business. They're never shown.
- Public: first name + last initial, city, which pros someone reacted to (👍/❤️), short notes, and Porch posts. People can choose "Keep me hidden" and show as "a neighbor."
- Deleting an account removes reactions, notes, Porch posts and photos, reports, profile, login, and the home (if no one else in the household uses it), right away.

## What we store, by source

| Data | Comes from | Kept for | Shown publicly? |
| --- | --- | --- | --- |
| Phone number | The neighbor (verified by text code via Twilio) | Until account deletion | No |
| First name, last initial | The neighbor | Until deletion | Yes (unless "hidden") |
| Home address, exact location | The neighbor, looked up with Google | Until deletion | No |
| Blurred block location, city | Calculated from the address / Google | Until deletion | Block spot on the map; city in bylines |
| Reactions, tags, price hint, notes | The neighbor | Until they remove it or delete their account | Yes |
| Porch posts and photos | The neighbor | Hidden when the post expires (1–14 days); deleted for good, photos included, a week after that | Yes, to signed-in neighbors within their chosen distance |
| Private reports and flags | The neighbor | Until resolved / account deletion | No (admin only) |
| Waitlist phone/email + ZIP | The person joining | Until their town unlocks | No |
| Usage events (opened a link, tapped Call…) | The app (PostHog) | PostHog's retention | No. Tied to an account ID, never name or phone |
| Business: Google place ID | Google Places | Indefinitely (allowed by Google) | No |
| Business: name, phone, website | Google Places, when a neighbor picks a business | Until the pro is removed | Yes, on the pro page |
| Business: own pin color, logo (future) | Holler / the business owner | Until removed | Yes |

Service providers: Supabase (database and login), Twilio (text codes), Google Places (address and business search), Mapbox (map), Vercel (hosting), PostHog (usage counts).

## Questions for the lawyer

1. **Google business details.** Google's Places policies say apps "must not pre-fetch, cache, or store Places API content" except place IDs, which may be stored indefinitely ([policy](https://developers.google.com/maps/documentation/places/web-service/policies)). When a neighbor picks a business from Google's search, Holler saves its name, phone and website so the pro page and map work. Options:
   - **A.** Keep as is. The neighbor chose and confirmed the business, so treat it as neighbor-submitted info.
   - **B.** Show a quick "Is this right?" step where the neighbor confirms or edits the name and phone before saving, so it's clearly neighbor-submitted.
   - **C.** Store only the place ID and fetch name/phone/website from Google each time the page is viewed (costs about 1–2¢ per view and adds a little delay).

   Already done: we show the required "Google Maps" credit under search results, we no longer save Google's map location for businesses, and we never bulk-import businesses.
2. **Business pages.** Pro pages exist because neighbors react to a business. Is anything needed (like a takedown/claim process) for a business that doesn't want to be listed? Planned: "Own this business? Claim it" with phone verification.
3. **The Porch.** Neighbor posts (garage sales, lost pets, local heads-ups) with photos. Posts auto-expire, filters block phone numbers/links/profanity, and 3 reports from different homes hide a post automatically. Is the current terms page enough for user posts and photos (Section 230 / takedown process)?
4. **Texts.** Login codes only (Twilio Verify). Opt-in browser alerts for asks and a daily Porch roundup. No marketing texts. Anything required beyond the consent line on the sign-up screen?
5. **Privacy policy and terms.** Drafts at /privacy and /terms (marked "Draft"). Need the operator name and a contact email filled in.

