# FocusParty — Development Standards

## Critical: Supabase MCP
- NEVER use Supabase MCP tools (execute_sql, apply_migration, etc.) — the MCP is connected to the WRONG project (Inflow, not FocusParty)
- Always provide SQL in chat for the user to copy/paste and run themselves

## Architecture
- Next.js App Router, dark-theme only, Supabase backend
- Data modules in `lib/` (raw queries), hooks in `lib/` (state + realtime)
- All FocusParty tables prefixed `fp_`

## Design System — Always Use Tokens, Never Hardcode

### Colors
- **Source of truth:** `lib/palette.ts` (JS constants) + `app/globals.css` (CSS custom properties)
- In Tailwind classes: `text-[var(--color-green-700)]`, `bg-[var(--color-bg-secondary)]`
- In inline styles: `color: "var(--color-green-700)"`, `background: "var(--color-bg-elevated)"`
- In JS config objects: `import { GREEN_700 } from "@/lib/palette"`
- **NEVER** hardcode hex values (`#5BC682`), Tailwind defaults (`text-red-500`), or raw rgba in component files

### Shadows
- **Tokens defined in globals.css:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-float`
- In Tailwind: `shadow-sm`, `shadow-lg` (resolves to our tokens via @theme)
- In inline styles: `boxShadow: "var(--shadow-float)"`
- **NEVER** write raw `boxShadow: "0 8px 32px rgba(..."` — use the token

### Border Radius
- Tokens: `--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (16px), `--radius-xl` (24px), `--radius-full` (9999px)
- Use short Tailwind: `rounded-md`, `rounded-lg` — NOT `rounded-[var(--radius-md)]`

## Component System — Reuse Before Creating

### ALWAYS check existing components before writing inline JSX:

| Need | Use | File |
|------|-----|------|
| Any clickable action | `<Button>` | `components/ui/Button.tsx` |
| Icon-only button | `<IconButton>` | `components/ui/IconButton.tsx` |
| Dropdown/menu item | `<MenuItem>` | `components/ui/MenuItem.tsx` |
| Content container | `<Card>` | `components/ui/Card.tsx` |
| Form text input | `<Input>` | `components/ui/Input.tsx` |
| Dialog/overlay | `<Modal>` | `components/ui/Modal.tsx` |
| Selection card | `<ToggleCard>` | `components/ui/ToggleCard.tsx` |

### Button variants (don't reinvent these):
- `primary` — filled accent, white text (main actions)
- `secondary` — accent border, accent text (paired with primary)
- `outline` — neutral border, secondary text (cancel/back/dismiss)
- `ghost` — transparent, hover bg (subtle actions)
- `danger` — coral text, coral hover bg (destructive)
- `cta` — filled accent + scale hover (hero CTAs)
- `link` — text link with underline hover

### Button sizes: `xs` (h-8), `sm` (h-9), `default` (h-12)
### Button props: `fullWidth`, `leftIcon`, `rightIcon`, `loading`, `disabled`

### When to create new components vs extend existing:
- **Add a variant/prop** to an existing component if the pattern is repeated 3+ times
- **Create a new component** only if it has genuinely different structure/behavior
- **Leave inline** only for one-off session-environment effects (animations, particle effects, character glows)

## Color Philosophy (Linear-Inspired)
- Color = achievement or state only. Everything else is grayscale.
- Activity feed: green = win/completion, gray = everything else
- Task status: green (done), indigo (in-progress), gray (todo)
- Priorities: red (urgent), orange (high), amber (medium), gray (low)
- Break categories, check-in types, commitment types: all gray (icon shape carries meaning)
