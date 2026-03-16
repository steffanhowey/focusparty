# SkillGap.ai — End-to-End UX Blueprint

**The complete user experience, moment by moment.**

This document traces the experience of a real user — from first touch to loyal practitioner — through every screen, every decision point, every emotional beat. It's written against what EXISTS today in the codebase and identifies exactly where the experience breaks, where it works, and what needs to change.

---

## The User

**Sarah.** Senior marketing manager at a B2B SaaS company. 34 years old, 8 years of experience. She's good at what she does. But in the last three months, her junior colleagues have been using Claude for campaign briefs and ChatGPT for content calendars, and the output is... embarrassingly close to what takes her a full day. She's not threatened yet. But the gap is growing and she can feel it.

She found SkillGap from a LinkedIn post — a colleague shared a skill receipt after completing a path on prompt engineering. The card looked professional. The skills listed were specific. She clicked.

---

## Act 1: Arrival and First Impression

### Scene 1: Landing Page → Sign Up

**What exists:** Marketing homepage at `/`. Sign up page at `/signup`. Magic link auth.

**What Sarah experiences:** She lands on the homepage. She sees the value proposition — "Close the gap." She clicks "Get Started." She enters her email. A magic link arrives. She clicks it.

**What's working:** The magic link flow is frictionless. No password to forget. She's in within 60 seconds.

**What's missing:** No welcome email after she authenticates. She signed up because of a LinkedIn credential post, but there's no acknowledgment — no "Welcome to SkillGap, here's what you can expect" email. The first email she ever gets from us is... nothing. That's a missed emotional beat. The moment someone gives you their email is the highest-trust moment. We should meet it with a short, warm, well-designed welcome message that reinforces her decision and sets expectations.

**Design note — Welcome Email:**
> Subject: "You're in. Here's how this works."
>
> Body: Three short paragraphs. (1) What SkillGap does — learn AI skills by doing, not watching. (2) What happens next — you'll pick your professional function and get a recommended first path. (3) Your first path takes ~35 minutes and ends with a verified skill receipt. That's it. No feature tour. No feature dump. Just the one thing she should do next and why it matters.

---

### Scene 2: Onboarding

**What exists:** Full onboarding flow at `/onboard` with four steps:
1. **FunctionStep** — pick your professional function (Engineering, Marketing, Design, Product, Data, Sales, Operations). Primary + up to 2 secondary.
2. **FluencyStep** — self-assess AI fluency level (Exploring, Practicing, Proficient, Advanced).
3. **PathRecommendationStep** — see a recommended first path based on function + fluency.
4. **UsernameStep** — pick a username.

**What Sarah experiences:** She selects "Marketing" as her primary function. She honestly picks "Exploring" as her fluency — she's used ChatGPT a few times but never systematically. The system recommends a path: "AI-Powered Content Strategy." She sees the title, the estimated time (38 minutes), the skills it develops (Content Strategy with AI, Prompt Engineering). She picks a username. She's done.

**What's working:** This is solid. The function capture is the single most valuable piece of data we collect — it determines everything downstream. Fluency self-assessment gives us a starting point (even if imperfect — we'll refine as she completes paths). The recommended first path is personalized. Username gives her identity.

**What's missing:** Two things.

First, the transition from onboarding to the app. After she completes onboarding, where does she land? She should land on the Learn page with her recommended path prominently featured — not mixed into a grid of 68 paths. The recommended path should feel like a personal invitation: "Based on your profile, we think you should start here." Not a search result.

**Design note — Post-Onboarding Landing:**
The Learn page should detect `recommended_first_path_id` on the user's profile and, if the user hasn't started any path yet, render a hero-style card above everything else:

> **Your first path**
> "AI-Powered Content Strategy"
> 38 min · 4 modules · Develops: Content Strategy, Prompt Engineering
> [Start Path →]

Below that, the normal discovery grid. This hero disappears once she starts the path.

Second, the onboarding doesn't explain what skills ARE in this system. Sarah sees "Content Strategy with AI" on the path recommendation, but she doesn't know what that means in SkillGap terms — that it's a tracked, verified, portable skill with fluency levels. A single line of context would help: "This path develops two AI skills. Complete it to add them to your skill portfolio."

---

## Act 2: The First Learning Path

### Scene 3: Path Detail → Starting

**What exists:** Path detail page at `/learn/paths/[id]`. Content viewer + sidebar with outline, progress, skills section.

**What Sarah experiences:** She taps "Start Path." The focused learning environment loads. She sees the sidebar with the path outline — 4 modules, each with 2-3 items. The first module is "Understanding AI Content Strategy." The first item is a 6-minute YouTube video from a trusted creator.

**What's working:** The focused environment strips away navigation distractions. She can see exactly where she is in the path. The sidebar shows skill tags for the path (Content Strategy with AI, Prompt Engineering) — this is the Phase 5 work we wired earlier.

**What's missing:** The sidebar shows skills, but there's no context about what they mean for HER. The `loadSkillTagsWithUser` function exists and returns user fluency — but for a new user, all fluency levels are null. The sidebar should still show the skills but frame them as what she's about to develop: "Skills you'll develop" rather than just "Skills." For returning users with existing fluency, it should show current level → projected level.

---

### Scene 4: Watch → Do → Check → Reflect

**What exists:** Content types: video, practice (missions), article. Mission submission with AI evaluation. Transition cards between items.

**What Sarah experiences:**

**Module 1 — Watch:** She watches a 6-minute video on AI content strategy. The creator is energetic, the examples are real. She understands the concept. She clicks "Mark Complete."

**Module 2 — Do (Guided Mission):** She's given a prompt to paste into ChatGPT: "Create a content calendar for a B2B SaaS company targeting marketing leaders. Include 4 weeks of content across blog, LinkedIn, and email." She opens ChatGPT in another tab. She pastes. She gets a result. She comes back and submits what she built.

**Module 3 — Do (Scaffolded Mission):** Less hand-holding. She's given an objective — "Create a content brief for a thought leadership piece about AI in marketing" — but she writes the prompt herself. She submits.

**Module 4 — Reflect:** She writes a short reflection on what she learned and how it applies to her actual work.

**What's working:** The progression from guided → scaffolded → independent is the core pedagogy and it's implemented. Real tools, real tasks. She's not watching a 45-minute tutorial — she's building something in 38 minutes.

**What's missing:** Two things.

First, the mission evaluation feedback. The AI evaluates her submission, but how visible is this to her? She should see concrete, specific feedback: "Your prompt was specific about audience but didn't specify tone. Try adding 'Write in a conversational, practitioner-focused tone' to get more on-brand output." This is the difference between "I did a thing" and "I learned something." The evaluation exists in the backend (item_states with evaluation data), but the feedback rendering needs to be prominent, not buried.

Second, there's no visible skill progression DURING the path. She's developing Content Strategy with AI across 4 modules, but she doesn't see that skill bar moving as she completes items. A subtle progress indicator in the sidebar — next to each skill — that fills as she completes missions would create a satisfying sense of accumulation. Not gamification. Just honest reflection of what she's building.

---

### Scene 5: Path Completion

**What exists:** Completion screen with celebration animation, achievement card, skill receipt with before/after fluency, share options (LinkedIn, Twitter, Copy Link), recommended next paths.

**What Sarah experiences:** She finishes the last module. A celebration screen appears. She sees her skill receipt:

> **Skills Developed**
> ✦ Content Strategy with AI — Exploring → Practicing (↑ Level Up!)
> ✦ Prompt Engineering — Exploring (new skill)
>
> "Your skill profile is starting to take shape."

Below that, share buttons. Below that, 2-3 recommended next paths.

**What's working:** This is the strongest moment in the product. She went from "I should probably learn this" to "I did this and I have proof." The skill receipt is concrete. The before/after is motivating. The "first receipt" message acknowledges this is the beginning of something.

**What's missing:** Three things, all about momentum.

First, the recommended next paths need to be skill-aware and speak to her. Right now the recommendations exist but are they framed as skill development? They should say: "You just developed Content Strategy and Prompt Engineering. Here's what to learn next to deepen those skills — or branch into something adjacent." Not just "More paths you might like."

Second, the share experience. She taps "Share on LinkedIn." What does the card look like when her colleagues see it? This is the growth loop. The shared card should show her name (or username), the path title, the specific skills developed with fluency levels, and a "Start this path" CTA that links back to SkillGap. This is the artifact her colleague clicked that brought Sarah here in the first place. It needs to be beautiful and specific.

Third, the room bridge. The completion screen should suggest: "3 other marketers are practicing AI content strategy right now in the Marketing room. Join a sprint?" This bridges the solo learning experience into the social experience. The room bridge overlay exists in the codebase (`first mission celebration overlay suggests practice room`) but it's for missions, not completion. The completion moment is the better placement — she's just proven she can do the thing. Now she can do it alongside others.

---

## Act 3: The Return

### Scene 6: Coming Back (Day 2-7)

**What exists:** The Learn page with "Continue Learning" section showing in-progress paths. The Skills page showing her skill portfolio.

**What Sarah experiences:** She comes back the next evening. She opens SkillGap. She sees the Learn page. Her "Continue Learning" section is empty (she finished her only path). The discovery grid shows 68 paths.

**What's broken:** She has NO reason to come back. There was no email nudging her. No notification that her skills are still at Exploring level while others in Marketing have progressed. No "here's what's trending in marketing AI this week" digest. The intelligence engine, the authority position, the weekly summaries — none of it reaches her.

**Design note — The Weekly Digest Email:**

This is the single highest-value feature not built. It should send every Monday morning:

> **Your Week in AI Skills**
>
> Sarah, here's where you stand:
>
> **Your Skills**
> Content Strategy with AI: Practicing
> Prompt Engineering: Exploring
>
> **This Week in Marketing AI**
> "Claude's new Projects feature" is trending — 340 marketers practiced this week.
> "AI-Powered Ad Copy" is the fastest-growing skill among marketers.
>
> **Your Next Move**
> Based on your Content Strategy skill, the highest-leverage path for you:
> "Mastering AI-Powered Email Campaigns" (32 min, develops Email Generation & Outreach)
>
> [Continue Learning →]

This email does four things: (1) mirrors her current state, (2) shows what's happening in her professional world, (3) gives her a specific next action, (4) creates urgency through social proof. Every element is personalized by her function, fluency level, and skill portfolio.

Without this email, re-engagement depends entirely on Sarah remembering to open SkillGap on her own. With it, she's pulled back by relevance.

---

### Scene 7: The Skills Page (Week 2+)

**What exists:** `/skills` page with domain sections, fluency distribution bar, skill cards with market state indicators. Unlocks after 2-3 completed paths.

**What Sarah experiences:** After completing her second path, she notices the "Skills" nav item. She taps it. She sees her skill portfolio for the first time:

> **Your AI Skill Portfolio**
>
> Skills: 4 of 40 | Paths Completed: 2 | Practicing+: 1 | Domains: 1
>
> [Fluency bar: ████████░░░░ Exploring (3) | Practicing (1)]
>
> **Writing & Communication**
> ✦ Content Strategy with AI — Practicing
> ✦ Prompt Engineering — Exploring
> ✦ AI-Assisted Writing — Exploring
> ✦ Tone & Voice Calibration — not started
> ✦ Email Generation & Outreach — not started

**What's working:** She can see her portfolio. The domain organization makes sense. Active skills are sorted above undiscovered ones. The fluency bar gives a visual sense of overall progress. Market state indicators (rising/declining arrows) on each skill card connect her personal progress to the market.

**What's missing:** The most important thing the skills page could show her — and doesn't:

**"What should I learn next and why?"**

The skills page shows her current state but doesn't guide her forward. It should have a section — prominently placed between the summary stats and the domain breakdown — that says:

> **Your Next Skill**
> Based on your Marketing function and current skills, the highest-leverage skill for you is:
>
> **Email Generation & Outreach** — Rising ↑ (demand up 34% among marketers this quarter)
> You're 60% of the way there based on your Prompt Engineering and Content Strategy skills.
> [Start the path →]

This uses three data sources we already have: (1) her function from onboarding, (2) her current skills from fp_user_skills, (3) market state from fp_skill_market_state. The recommendation engine exists in `lib/skills/recommendations.ts`. The skill adjacency concept is in the strategy doc. But it's not surfaced at this critical moment — the moment she's looking at her portfolio and asking "what should I do about these gaps?"

---

### Scene 8: The Skill Detail Page

**What exists:** `/skills/[slug]` — public page for individual skills. Shows skill description, related paths.

**What Sarah experiences:** She clicks on "Prompt Engineering" from her skills page. She lands on a page that shows what this skill is, related learning paths, and (if market state is flowing) where it sits in the landscape.

**What's missing:** This page should be the richest page in the product for authenticated users. It should show:

1. **Her personal progress** — fluency level, paths completed for this skill, missions done, avg score trajectory
2. **Market context** — "Prompt Engineering is the #2 most-practiced skill on SkillGap. 67% of practitioners are at Practicing or higher. You're at Exploring — the gap is closeable with 2 more paths."
3. **Recommended paths** — specifically for this skill, ordered by what's most effective at moving her fluency forward
4. **Skill adjacencies** — "Practitioners who are Practicing in Prompt Engineering also tend to be developing: AI-Assisted Writing, AI Code Generation, Research Synthesis"

This is the page that makes a skill feel real and alive — not just a tag on a card. Right now it's a public SEO page. For authenticated users, it should be personal.

---

## Act 4: The Social Layer

### Scene 9: Discovering Rooms

**What exists:** `/practice` page with room cards. Persistent domain rooms (AI + Engineering, Marketing, etc.). Filters by vibe. Synthetic participants creating ambient activity.

**What Sarah experiences:** She notices the "Practice" nav item. She taps it. She sees rooms — "Marketing Flow," "Vibe Coding," "Writer's Room." She sees participant counts. She sees vibes.

**What's broken:** She doesn't know why she should enter a room. The rooms are organized by vibe, not by what she's learning. There's no connection between her skill development and the rooms. She just completed a Content Strategy path — but the Marketing room doesn't tell her "3 others practicing Content Strategy right now." She doesn't know if these people are learning the same things she is.

**Design note — Skill Context on Room Cards:**

Each room card should show:

> **Marketing Flow** — 12 practicing now
> Top skills being practiced: Content Strategy, Prompt Engineering, Email Generation
> [Join Sprint →]

And on the Learn page, after path completion or on the "Continue Learning" section:

> **Practice with others** — 4 marketers are sprinting right now in Marketing Flow
> [Join →]

This doesn't require deep room-path integration. It requires: (1) knowing what paths/skills are common in each room's domain (we have this data via function → skill mapping), (2) showing that data on the card. The AI host already knows what people are working on — surface that context.

---

### Scene 10: Inside a Room

**What exists:** Room environment at `/environment/[id]`. Real-time participants, sprint timer, AI host messages, break content.

**What Sarah experiences:** She enters the Marketing room. She sees 12 participants (mix of real and synthetic). The AI host greets her: "Welcome, Sarah. What are you working on this sprint?" She types: "Practicing AI content briefs." A timer starts — 25 minutes.

**What's working:** The core sprint ritual works. Check-in, sprint, break, reflection. The presence of others — even synthetic ones — makes the work feel different than doing it alone.

**What's missing:** The room doesn't know what she's capable of or what she's learning. The AI host could be so much smarter:

> "Welcome, Sarah. I see you just completed AI-Powered Content Strategy and you're Practicing in Content Strategy. Marcus and Priya are also working on content this sprint. You might compare approaches at the break."

This requires the host to read her skill profile (already in fp_user_skills) and match it against other participants' active paths. The synthetic participants already share what they're working on — real context from her skill data would make the host feel genuinely aware.

---

## Act 5: The Flywheel

### Scene 11: Sharing and Bringing Others

**What exists:** Share buttons on completion screen (LinkedIn, Twitter, Copy Link). Achievement pages with share slugs. Skill receipts.

**What Sarah experiences:** After her third completed path, she decides to share on LinkedIn. She taps "Share on LinkedIn." A post is pre-composed with her skill receipt — the specific skills she developed, her fluency levels, and a link back to the path.

Her colleague David sees the post. He clicks the link. He lands on the path's public preview page — title, modules, skills covered, estimated time. He sees "Start This Path →." He signs up.

**What's working:** The growth loop architecture is in place. Completion → share → colleague discovers → signs up. This is the credential loop from the strategy.

**What's missing:**

First, the shared card needs to be visually compelling enough that people stop scrolling. Right now, what does the LinkedIn card look like? Does the path's public page have proper Open Graph metadata? Does it render a preview card with her skill receipt? This is the most important growth surface — if the card is generic, the loop dies.

**Design note — OG Card for Shared Credentials:**
The OG image should be dynamically generated per completion:
- User's username (not real name — privacy)
- Path title
- Skills developed with fluency levels (visual pills)
- "Built on SkillGap.ai — Close the gap"
- Clean, dark, professional design that looks native to LinkedIn

Second, the skill graph share. After completing 3-4 paths, Sarah has a meaningful skill portfolio. The `/skills` page should have a "Share Your Portfolio" button that generates a snapshot of her skill graph — domains, fluency levels, skills count — as a shareable card. This is the Skill Graph Loop from the strategy. "Here's my AI skill portfolio after 3 weeks of focused practice."

---

### Scene 12: Week 4 and Beyond

**What Sarah's experience should look like:**

Every Monday, she gets a digest email showing her progress, what's trending in marketing AI, and one specific path recommendation. She opens the app 2-3 times per week. Her skill portfolio now shows:

> Skills: 8 of 40 | Paths Completed: 5 | Practicing+: 3 | Domains: 2
>
> Writing & Communication: 4/5 skills started
> Strategy & Planning: 1/5 skills started (she branched out)

She can see her trajectory. She can see that Email Generation is rising in demand among marketers. She can see that she's 70% of the way to being "Practicing" in AI-Assisted Writing based on what she's already demonstrated.

She's in the Marketing room twice a week for 25-minute sprints. The regulars recognize each other's usernames. The AI host notes that the group has collectively completed 47 paths this month.

She shared her skill receipt once, her skill graph once. Two colleagues signed up from her shares. One of them asked their manager about team licenses.

The gap is closing.

---

## The Gap Map: What Exists vs. What's Needed

### BUILT and working:
- ✅ Magic link auth
- ✅ Onboarding (function, fluency, username, recommended path)
- ✅ Path discovery with skill pills and trending skills
- ✅ Path generation (on-demand, AI-powered)
- ✅ Focused learning environment (Watch → Do → Check → Reflect)
- ✅ Mission evaluation (AI feedback)
- ✅ Path completion with skill receipt
- ✅ fp_user_skills upsert on completion
- ✅ Skills page with domain sections, fluency distribution, market state
- ✅ Achievement credentials with shareable slugs
- ✅ Share buttons (LinkedIn, Twitter, Copy)
- ✅ Recommended next paths on completion
- ✅ Rooms with sprint timer, AI host, synthetic participants
- ✅ Public Pulse Dashboard and Skills Index
- ✅ Skill market state intelligence pipeline (infrastructure)
- ✅ Signal collection and topic clustering (infrastructure)
- ✅ Admin panel for content, rooms, users, pipeline

### BUILT but not connected:
- ⚠️ Post-onboarding landing doesn't hero the recommended path
- ⚠️ Skill recommendations exist but aren't framed as "your next skill"
- ⚠️ Market state exists but trending pills are empty (no signal data flowing)
- ⚠️ Room bridge overlay exists for missions but not for completion
- ⚠️ Skills page shows portfolio but doesn't guide forward action
- ⚠️ Skill detail pages are public/SEO but not personalized for auth'd users

### NOT BUILT (highest user value):
- ❌ **Welcome email** — First touchpoint after signup. Sets expectations.
- ❌ **Weekly progress digest email** — The re-engagement loop. Without it, retention depends on memory.
- ❌ **"Your Next Skill" recommendation on /skills** — The most actionable thing the skills page could show.
- ❌ **Skill context on room cards** — "3 others practicing Content Strategy" on Marketing room.
- ❌ **Dynamic OG images for shared credentials** — The growth loop card.
- ❌ **Post-onboarding hero card** — Personal invitation to start recommended path.
- ❌ **Skill adjacency display** — "You're 70% of the way to X."
- ❌ **Skill detail page personalization** — Personal progress + market context + recommended paths.
- ❌ **Settings page** — Profile editing, email preferences, function/fluency updates.
- ❌ **In-app notifications** — No bell, no activity feed.

---

## Priority Stack: Build Order by User Value

### Tier 1: The Return Loop (without this, nothing else matters)

**1. Weekly digest email**
Impact: Retention. Every other feature is wasted if users don't come back.
Requires: Email provider (Resend), user data aggregation, skill market state, path recommendations.
Complexity: Medium. Template + cron job + data assembly.

**2. Post-onboarding hero card for recommended path**
Impact: First session completion rate. The difference between "I started a path" and "I browsed and left."
Requires: Check `recommended_first_path_id` on profile, render hero card on Learn page.
Complexity: Low. One conditional component.

### Tier 2: The Momentum Loop (keeps the flywheel spinning after first path)

**3. "Your Next Skill" section on /skills page**
Impact: Second and third path starts. The moment she's looking at her gaps is the moment to recommend.
Requires: Skill recommendations filtered by function, market state for urgency, framing copy.
Complexity: Low-medium. Recommendation engine exists, needs UI surface + framing.

**4. Skill context on room cards**
Impact: Room entry rate. Bridges solo learning → social learning.
Requires: Map room domain → common skills, show on PartyCard.
Complexity: Low. Static skill mapping per room world_key.

### Tier 3: The Growth Loop (brings new users)

**5. Dynamic OG images for credentials**
Impact: Share-driven signups. The card quality determines whether the loop works.
Requires: Image generation endpoint (Vercel OG or similar), skill receipt data.
Complexity: Medium. Edge function + design.

**6. Skill graph share button on /skills**
Impact: Second sharing surface. Portfolio share vs. single path share.
Requires: Snapshot generation, share flow.
Complexity: Medium.

### Tier 4: Depth Features (deepens engagement for retained users)

**7. Personalized skill detail pages**
Impact: Skill depth perception. Makes skills feel alive, not just tags.
Requires: Auth check on /skills/[slug], personal progress overlay, market context.
Complexity: Medium.

**8. Skill adjacency display**
Impact: Career translation. "You're 70% of the way" is the most motivating insight possible.
Requires: Micro-skill overlap computation, UI component.
Complexity: High. Needs adjacency data model.

**9. Settings page**
Impact: Trust and control. Users need to update function, fluency, email preferences.
Requires: Profile editing API, email preference model.
Complexity: Medium.

**10. Signal pipeline activation**
Impact: Everything marked "trending" or "market state" is empty without this.
Requires: Cron jobs running against real sources. Operational, not code.
Complexity: Operational — crons need to be deployed and monitored.

---

## The Emotional Arc

The complete experience should follow an emotional arc that moves Sarah from anxiety to confidence:

**Arrival** — "I'm behind. Everyone else knows this stuff."
→ Onboarding says: "We know who you are. Here's where to start."

**First Path** — "Can I actually do this?"
→ Guided mission says: "Yes. Paste this prompt. See what happens."
→ She builds something real. She submits. She gets feedback.

**Completion** — "I did it. I have proof."
→ Skill receipt says: "Content Strategy: Practicing. Prompt Engineering: Exploring."
→ She shares on LinkedIn. Her colleague sees it.

**Return** — "What should I do next?"
→ Weekly email says: "Email Generation is rising among marketers. You're one path away."
→ Skills page says: "Your Next Skill: Email Generation & Outreach."

**Depth** — "I'm actually getting good at this."
→ Skills page shows 8/40 skills, 3 at Practicing+, 2 domains active.
→ Skill receipt shows level-ups. Progress is visible and real.

**Community** — "I'm not alone in this."
→ Room shows "12 marketers practicing now. Top skill: Content Strategy."
→ AI host says: "Sarah and Marcus are both working on content briefs."

**Identity** — "This is who I am professionally."
→ Skill graph is shareable. Portfolio is portable. Proof is verified.
→ She's not "a marketer who's learning AI." She's "a marketer with demonstrated Practicing-level AI Content Strategy, Prompt Engineering, and Email Generation."

The gap is closed. Not because she learned everything — but because she can see exactly where she stands, she has proof of what she knows, and she has a clear path to what's next.

---

## What This Means for Implementation

The core product works. The learning loop is intact. The skill infrastructure is solid. What's missing is the connective tissue — the moments between features that turn a tool into a practice.

The weekly email is the foundation. Without re-engagement, nothing else compounds.

The "Your Next Skill" recommendation is the engine. Without forward guidance, users stall after 1-2 paths.

The room-skill context is the bridge. Without it, the social and learning experiences are separate products sharing a nav bar.

The OG cards are the flywheel. Without them, growth depends on paid acquisition instead of organic sharing.

Build in that order. Each one unlocks the next.
