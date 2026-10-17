# Holler — instructions for Claude Code

- Always read docs/SPEC.md and docs/DESIGN.md before starting work. The screens to match are in docs/mockups/ (reference only).
- Follow the build order in docs/SPEC.md one step at a time. Don't start the next step until the current step's "done when" is true, then commit.
- Use the design tokens in src/app/globals.css (bg-green, bg-green-deep, text-ink, text-muted, etc.). Don't invent new colors or fonts.
- The app name lives only in src/config/site.ts.
- Never commit .env.local, never print or log keys, and never put SUPABASE_SERVICE_ROLE_KEY in browser code.
- This is a Windows machine (PowerShell). The owner is not a developer: explain what you did in plain language and ask before anything destructive.
