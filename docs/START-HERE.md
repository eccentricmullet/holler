# Start here

## Your checklist

- [ ] Supabase project `holler` (US East), database password saved, PostGIS enabled
- [ ] Mapbox default public token
- [ ] Google Cloud: Places API (New) enabled, API key, billing on, budget alert set
- [ ] GitHub private repo `holler` (copy its web address)
- [x] Node.js installed
- [ ] Git installed (git-scm.com → Download for Windows → Next through every screen)

## Finish step 1

The starter app is already written. Open this folder (`C:\Users\zakhi\Code\holler`) in Claude Code desktop and paste:

> Read CLAUDE.md. We're finishing step 1.
> 1. Check that Node.js 20+, npm and Git are installed.
> 2. Run npm install, then npm run dev. Fix anything that errors, then tell me the address to open.
> 3. Set up git, make the first commit, and connect it to my GitHub repo. Here's the address: [PASTE YOUR GITHUB REPO ADDRESS]
> 4. Confirm .env.local is NOT in the commit.

You should see a white page with green circles, a big "holler," and the 👍 / ❤️ tiles.

Then paste your keys into `.env.local` yourself (right-click → Open with → Notepad). Never paste keys into a chat.

## Every session after that

> Read CLAUDE.md. We're on step N.

When a step's "done when" is true, commit and move to the next one.
