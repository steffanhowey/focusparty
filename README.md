# FocusParty

Your AI co-working partner. Always there. Never no-shows.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

- **app/(marketing)** — Landing page (public)
- **app/(auth)** — Login, signup, OAuth callback
- **app/(hub)** — Dashboard (sidebar + Home, Progress, Party, Settings)
- **app/session** — Fullscreen focus session (state machine)
- **app/join/[id]** — Focus Party invite entry
- **app/onboard** — First-time onboarding

## Tech

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Montserrat (design system font)
