# SkillGap

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
- **app/(hub)** — Dashboard (sidebar + Home, Rooms, Tasks, Progress, Settings)
- **app/session** — Fullscreen focus session (state machine)
- **app/join/[id]** — Room invite entry
- **app/onboard** — First-time onboarding

## Tech

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Inter (design system font)
- Supabase (auth, database, realtime, storage)
- OpenAI (gpt-4o-mini, gpt-image-1)
