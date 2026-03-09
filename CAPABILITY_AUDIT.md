# FocusParty Capability Audit

> Architectural reality map — what exists, what's reusable, what's missing, what's wrong-shaped.
> Generated 2026-03-08

---

## 1. Summary

### What the app already has
FocusParty is a functional co-working focus session platform with:
- **Auth + profiles** — Magic link OTP, auto-profile creation, 3-step onboarding
- **Party system** — Create/join rooms, invite links with OG metadata, participant tracking
- **Full session engine** — Setup → breathing → sprint → review → break phases, timer, webcam, screen share
- **Global task system** — Kanban board, projects, labels, drag-and-drop, priority/status, realtime sync
- **Character-driven theming** — 3 personas (Ember/Moss/Byte) with full color territories, room gradients, dynamic accent injection
- **Responsive app shell** — HubShell with collapsible sidebar, client-side SPA nav, lazy-loaded tabs
- **Realtime foundation** — 3 active Supabase channels (tasks, projects, parties) with proper lifecycle management

### Biggest reusable strengths
1. **Design token system** — CSS custom properties + character-driven accent injection is already multi-world ready (8/10)
2. **App shell** — HubShell + Sidebar + client-side nav is production quality, responsive, and extensible
3. **Task domain** — Full CRUD with realtime, optimistic updates, drag-and-drop — maps directly to goals/sprints
4. **Auth + middleware** — PKCE flow, onboarding redirect, session refresh — complete and correct
5. **Session flow architecture** — Phase-based state machine (setup→breathing→sprint→review→break) is the exact pattern FocusParty needs

### Biggest missing primitives
1. **AI orchestration** — Zero LLM infrastructure. No edge functions, no providers, no structured output, no prompts
2. **Presence system** — No Supabase Presence, no broadcast, no typing indicators, no "who's online"
3. **Persistent chat/messages** — Chat is client-side state only, no database table, no history
4. **Session persistence** — SessionRecord type exists but no backing table — sessions aren't saved
5. **Background jobs** — No cron, no queues, no workers, no async processing
6. **Feature flags** — No experimentation framework

### Biggest architectural risks
1. **Shared Supabase project with Inflow** — Migration discipline is critical; `fp_` prefix helps but namespace collisions are possible
2. **No server actions** — Everything runs client-side; AI hosts will need a server-side execution layer
3. **Session state is ephemeral** — All session progress lives in React component state; a refresh kills it
4. **No event/activity persistence** — Momentum feed has no backing store

---

## 2. Existing Capabilities by Layer

### Frontend Shell
| Component | State | Notes |
|-----------|-------|-------|
| HubShell | Production | Responsive, sidebar collapse, client-side nav, lazy loading |
| Sidebar | Production | Expanded/rails modes, profile menu, theme toggle |
| Header bar | Production | Dynamic actions per route, responsive button text/icon |
| Modal system | Production | Portal-based, focus trap, keyboard dismiss, backdrop blur |
| Toast notifications | Production | Typed (info/success/warning/error), auto-dismiss, stacked |
| Mobile layout | Production | Overlay drawer, tab-based kanban, touch-optimized tap targets |

### Design System
| Token | State | Notes |
|-------|-------|-------|
| Color palette | Complete | 8 full scales (blue→navy), semantic mappings, light/dark |
| Character themes | Complete | 3 territories with primary/secondary/accent/glow/roomBg |
| Accent injection | Complete | ThemeProvider dynamically sets CSS vars per character |
| Spacing scale | Complete | 4px–96px via --space-1 through --space-24 |
| Border radius | Complete | sm(6)/md(10)/lg(16)/xl(24)/full tokens |
| Shadows | Complete | 4 levels + 3 character glow variants |
| Transitions | Complete | fast(150ms)/normal(250ms)/slow(400ms)/ambient(2s) |
| Z-index stack | Complete | 7 layers from base(0) to notification(60) |
| Animations | Rich | 10+ keyframe animations for breathing, celebrations, transitions |
| Typography | Basic | Inter font, Tailwind scale, no formal type tokens |
| Icons | Lucide | Consistent 20px/1.8 stroke weight throughout |
| Reduced motion | Supported | Global prefers-reduced-motion respect |

### Schema (fp_ tables)
| Table | State | Notes |
|-------|-------|-------|
| fp_profiles | Exists | id, email, display_name, first/last_name, onboarding_completed |
| fp_parties | Exists | creator_id, name, character, duration, max_participants, status, invite_code |
| fp_party_participants | Exists | party_id, user_id, display_name, joined_at, left_at |
| fp_projects | Exists | user_id, name, color, emoji, is_default, position |
| fp_labels | Exists | user_id, name, color |
| fp_tasks | Exists | user_id, project_id, title, status, priority, position, completed_at |
| fp_task_labels | Exists | Junction: task_id ↔ label_id |
| fp_sessions | Missing | Types defined (SessionRecord) but no table |
| fp_messages | Missing | Chat is ephemeral client-side state |
| fp_streaks | Missing | Streak type defined but no persistence |

### Realtime
| Channel | State | Notes |
|---------|-------|-------|
| tasks-realtime | Active | postgres_changes on fp_tasks, user-filtered |
| projects-realtime | Active | postgres_changes on fp_projects, user-filtered |
| party-list / party-lobby-{id} | Active | postgres_changes on fp_parties + fp_party_participants |
| Presence | Not implemented | No .track(), no "who's online" |
| Broadcast | Not implemented | No peer-to-peer messaging layer |
| Typing indicators | Not implemented | — |

### AI Orchestration
| Capability | State | Notes |
|------------|-------|-------|
| LLM providers | None | No openai/anthropic dependencies |
| Edge functions | None | supabase/functions/ is empty |
| Server actions | None | No 'use server' directives |
| Structured output | None | — |
| Prompt management | None | — |
| Agent/tool orchestration | None | — |
| Event-driven triggers | None | — |
| Background jobs | None | No cron, queues, or workers |

**However:** SessionRecord type already has `ai_messages_count` and `user_messages_count` fields — the data model anticipated AI.

### Infrastructure
| Component | State | Notes |
|-----------|-------|-------|
| Next.js 16 App Router | Current | Latest framework |
| Supabase SSR | Current | @supabase/ssr 0.9, proper middleware |
| Vercel deployment | Assumed | Standard Next.js target |
| Storage bucket | Active | `avatars` bucket with public read |
| Migrations | 6 files | Clean, sequential, well-documented |
| RLS policies | Complete | All fp_ tables scoped to user_id |
| Rate limiting | Passive | Client-side Supabase error detection only |
| Feature flags | None | — |
| Logging/monitoring | None | — |

---

## 3. Reuse Matrix

### Keep As-Is
| Capability | Current Implementation | FocusParty Mapping |
|------------|----------------------|-------------------|
| Auth / magic link | Supabase OTP + PKCE via AuthProvider | Same — no changes needed |
| Middleware | JWT refresh, onboarding redirect, route protection | Same — add new protected routes as needed |
| Profile auto-creation | Trigger on auth.users INSERT → fp_profiles | Same — extend profile fields later |
| Avatar storage | `avatars` bucket with user-scoped upload | Same |
| Toast notifications | NotificationProvider with typed toasts | Same |
| CSS token system | Full custom property system in globals.css | Same — add new tokens as needed |
| Spacing / radius / shadow / z-index tokens | Complete scales | Same |

### Extend
| Capability | Current Implementation | FocusParty Mapping | What to Add |
|------------|----------------------|-------------------|------------|
| Character themes | 3 personas (Ember/Moss/Byte) with color territories | World/territory system | Add world metadata, ambient config, host personality per character |
| App shell (HubShell) | Sidebar + header + lazy tabs | FocusParty hub shell | Add room/world route, adapt header for session context |
| Task system | Full CRUD kanban with realtime | Goal/sprint system | Add session linkage, sprint tracking fields, completion attribution |
| Party system | Create/join rooms, invite links, participants | FocusParty room instances | Add room state machine, host config, world assignment |
| Realtime channels | 3 postgres_changes channels | Room-scoped realtime | Add Presence for "who's here", Broadcast for host messages |
| Session phases | setup→breathing→sprint→review→break | Sprint engine | Persist sessions to DB, add AI host triggers per phase |
| fp_profiles | Basic profile fields | Rich participant profiles | Add generated handles, avatar pipeline, stats fields |
| Onboarding | 3-step (name→avatar→start) | Extended onboarding | Add character preference, initial world selection |

### Refactor
| Capability | Current Implementation | Problem | FocusParty Target |
|------------|----------------------|---------|------------------|
| Session state | Ephemeral React state in SessionPage | Refresh kills everything | Persistent session records in fp_sessions table |
| Chat system | Client-side useState only | No persistence, no AI | Persistent messages table + AI host message pipeline |
| Timer | useSyncExternalStore, local only | Not shared across participants | Shared timer state via Supabase Realtime Broadcast |
| Event system | Single DOM CustomEvent (fp:create-task) | Not scalable | Proper event bus or Supabase-based activity events |

### Replace
| Capability | Current Implementation | Why Replace | FocusParty Target |
|------------|----------------------|------------|------------------|
| — | — | — | — |

> **Nothing needs full replacement.** The existing codebase is architecturally sound. Every system can be extended or refactored rather than rebuilt.

### Build New
| System | Why It Doesn't Exist Yet | Priority |
|--------|------------------------|----------|
| AI host orchestration | No LLM infrastructure at all | P0 — core differentiator |
| Momentum feed / activity events | No event persistence layer | P0 — social proof engine |
| Session persistence (fp_sessions) | Types exist, table doesn't | P0 — needed for progress tracking |
| Presence system | No Supabase Presence usage | P1 — "who's in the room" |
| Broadcast messaging | No peer-to-peer layer | P1 — host messages to room |
| Synthetic participants | Concept doesn't exist yet | P2 — AI-generated co-workers |
| World config system | Characters exist but no "worlds" | P2 — themed room experiences |
| Progress engine | /progress route is a stub | P1 — streaks, stats, history |
| Background jobs | No async processing | P1 — AI completions, notifications |
| Feature flags | No experimentation | P2 — staged rollout |

---

## 4. Missing Systems (Delta from Target Architecture)

### P0 — Core (must build before launch)

**AI Host Orchestration Engine**
- Edge function or server action for LLM completions
- Structured output schemas for host messages (encouragement, phase transitions, reflections)
- Provider abstraction (start with one, swap later)
- Prompt templates per character personality
- Trigger system: phase changes, idle detection, sprint completion
- Rate limiting and cost controls

**Session Persistence Layer**
- `fp_sessions` table: user_id, party_id, character, goal, duration, outcome, started_at, ended_at
- `fp_session_sprints` table: session_id, sprint_number, duration, completed
- Persist SessionReflection (mood, productivity) to database
- Link tasks to sessions (which task was worked on during which session)

**Momentum Feed Domain**
- `fp_activity_events` table: user_id, party_id, session_id, event_type, payload, created_at
- Event types: sprint_started, sprint_completed, task_completed, streak_achieved, reflection_submitted
- Feed query: chronological + filterable by party/user
- UI: feed component in room and profile views

### P1 — Essential (build in first iteration)

**Presence System**
- Supabase Presence on party channels (.track() with user metadata)
- "Who's in this room" indicator
- Online/focusing/on-break status per participant
- Automatic leave detection

**Broadcast Messaging**
- Host-to-room messages via Supabase Broadcast
- Phase transition announcements
- Encouragement/nudge messages from AI host
- System messages (participant joined/left)

**Progress Engine**
- `/progress` page implementation (currently stub)
- Streak calculation from fp_sessions data
- Weekly/monthly session stats
- Goal completion rates
- Productivity trend from reflections

**Background Job Strategy**
- Supabase Edge Functions for async AI completions
- Webhook triggers on session events
- Scheduled jobs for streak calculations, inactive user nudges

### P2 — Differentiation (build in second iteration)

**Synthetic Participants**
- AI-generated co-worker profiles (name, avatar, personality)
- Simulated focus sessions running alongside real users
- Presence in room as motivational company
- Configurable density (1-3 synthetic participants per room)

**World Config System**
- Extend CharacterDef → WorldDef (character + ambient + rules + host personality)
- World-specific session rules (sprint duration, break activities, music)
- World-specific UI skins (beyond just color — shapes, icons, ambient backgrounds)
- User world preference saved to profile

**Feature Flags & Staged Rollout**
- Simple flag system (edge config or database-backed)
- Gradual AI host rollout
- A/B test host personalities
- Beta access for new worlds

---

## 5. Recommended Build Path

### Phase 1: Foundation Persistence (1-2 weeks)
> Make the existing session flow durable and measurable.

1. **Create `fp_sessions` + `fp_session_sprints` tables** — migrate ephemeral session state to database
2. **Persist session reflections** — wire up the existing handleReflectionComplete stub
3. **Create `fp_activity_events` table** — start logging session events (sprint start/complete, task done)
4. **Implement `/progress` page** — basic stats from persisted session data (streak, count, avg duration)
5. **Add Supabase Presence to party channels** — "who's in the room" for real-time co-working feel

### Phase 2: AI Host MVP (2-3 weeks)
> Introduce the AI host as the core differentiator.

1. **Create first edge function** — LLM completion endpoint with character-personality prompts
2. **Create `fp_messages` table** — persistent chat with host_message flag
3. **Wire AI triggers to session phases** — host speaks at: session start, mid-sprint encouragement, sprint complete, reflection prompt
4. **Build host message UI** — extend existing ChatFlyout to show host messages inline
5. **Add Broadcast channel** — host messages pushed to all room participants in real-time

### Phase 3: Social & Momentum (2-3 weeks)
> Build the social proof engine that makes FocusParty sticky.

1. **Momentum feed UI** — chronological activity stream in room view
2. **Feed events from all participants** — see when others complete sprints, finish tasks
3. **Streak system** — calculate and display streaks from session history
4. **Progress dashboard** — weekly charts, productivity trends, goal completion rates
5. **Participant status indicators** — focusing/on-break/idle badges in room

### Phase 4: Worlds & Synthetic Participants (3-4 weeks)
> Expand the character system into full "worlds" and add AI co-workers.

1. **World config system** — extend characters into full world definitions
2. **Synthetic participant engine** — AI co-workers with generated profiles
3. **World-specific ambient experiences** — music, backgrounds, session rules per world
4. **Feature flag system** — staged rollout of new worlds and AI features

---

## 6. Architecture Confidence Score

| Layer | Score | Verdict |
|-------|-------|---------|
| Auth & profiles | 9/10 | **Keep** — production ready |
| App shell & navigation | 9/10 | **Keep** — extend for new routes |
| Design token system | 8/10 | **Keep** — already multi-world capable |
| Task domain | 8/10 | **Extend** — add session linkage |
| Party/room system | 7/10 | **Extend** — add presence, state machine, world config |
| Realtime foundation | 7/10 | **Extend** — add Presence + Broadcast channels |
| Session engine | 6/10 | **Refactor** — persist state, add AI triggers |
| Chat system | 3/10 | **Refactor** — needs persistence + AI pipeline |
| AI orchestration | 0/10 | **Build new** — nothing exists |
| Background jobs | 0/10 | **Build new** — nothing exists |
| Progress/analytics | 1/10 | **Build new** — route exists but empty |
| Event/activity system | 1/10 | **Build new** — single DOM event only |

**Overall reuse potential: ~65%** — The majority of the frontend shell, design system, auth, and task domain carry forward intact. The gaps are all backend: AI, persistence, events, and background processing.

---

*This audit is the bridge between present reality and FocusParty's target architecture. No greenfield rebuild needed — this is a delta plan.*
