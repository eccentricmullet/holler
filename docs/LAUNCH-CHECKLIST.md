# Step 12 launch checklist (Spring Hill)

Goal from the spec: **100+ real reactions, and testers find a pro in under 60 seconds.**

## 1. Before anyone new sees it

- [ ] **Vercel:** fix `CRON_SECRET` (no extra spaces), then Deployments → ⋯ → Redeploy. Check the newest deployment says "Ready."
- [ ] **Your own account:** Profile → Privacy and details. Change your name back from "Zooky" to your real first name.
- [ ] **Legal:** fill in the contact email and operator name (tell Claude), and have a lawyer skim `docs/DATA-NOTES.md`, `/privacy` and `/terms`. Then Claude removes the "Draft" banner.
- [ ] **Spending alerts:** Twilio (about $10) and Google Cloud (about $10) budget alerts are set.
- [ ] **Clear the test data** (Claude runs this only when you say go):

      node scripts/seed-test-data.mjs --clean

  This removes the 24 pretend neighbors, the pretend pros (Greenway, Two Brothers, Crystal Clear Pools…), their reactions and Porch posts, and the practice flag and duplicate. **Your own reactions to those pretend pros go too** (for example your Greenway note). Real businesses you added from Google, like Trinity Pools Inc., stay.

## 2. Seed it (week 1)

- [ ] Ask 10 Spring Hill friends and neighbors to sign up. Text them the site link. New sign-ups land on "Add 3 pros you use."
- [ ] You add every pro you've used (lawn, HVAC, plumber, pest, pool, cleaner…). Aim for 15+.
- [ ] Each tester: open a category, find a pro, tap Call or text. Time it: under 60 seconds is the goal.
- [ ] Post a couple of things on The Porch yourself (a curb alert, a "Just hired" shout-out) so it isn't empty.

**Message to send friends (copy and edit):**

> I'm building a little map of the local pros Spring Hill neighbors actually trust: lawn, HVAC, plumbers, all of it. Would you add the 3 you use? Takes a minute: holler-smoky.vercel.app

## 3. Spread the word (weeks 2–4)

- [ ] One post in the Spring Hill Facebook groups: "Who's your lawn guy? I made a map where neighbors share theirs."
- [ ] A short TikTok or Reel showing the map with real pros (no addresses on screen).
- [ ] When a pro has 3+ reactions, send them their invite link (Admin → Pros → the pro → Invite link → Share). Their customers become your users.
- [ ] Optional: door hangers or a neighborhood newsletter blurb with the link (Claude can make a QR code).

## 4. Watch it each week

- [ ] **PostHog funnel** (link opened → signed up → reacted → tapped Call): where do people drop off?
- [ ] **Admin → Flags:** anything to clear (most Porch problems hide themselves after 3 reports).
- [ ] **Admin → Counts:** reactions by city. When you pass 100 real reactions, step 12 is done.
