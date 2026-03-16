# SkillGap.ai — Brand Guidelines

> Extracted from GrowthAssistant mockups (Figma). Adapted for SkillGap.ai.
> Last updated: March 2026

---

## Brand Essence

**Tagline:** Close the gap.

**Voice:** Confident but not arrogant. Warm but not soft. Direct but not cold. We speak to professionals who are already good at what they do — we're not talking down to beginners, we're helping experts navigate unfamiliar territory.

**Visual Identity:** Deep forest greens grounded in nature and growth. Gold for achievement. Teal for exploration. Color is earned — it signals state or accomplishment. Everything else is grayscale or neutral.

---

## Color System

### Primary — Forest Green
The foundation. Used for backgrounds, CTAs, and primary text.

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Forest 900 | `#0F2318` | `--sg-forest-900` | Deepest dark, overlays |
| Forest 800 | `#162E21` | `--sg-forest-800` | Primary dark background |
| Forest 700 | `#1E3A2C` | `--sg-forest-700` | CTA buttons, elevated surfaces |
| Forest 600 | `#2A5340` | `--sg-forest-600` | Hover states, secondary surfaces |
| Forest 500 | `#3A7D53` | `--sg-forest-500` | Primary accent, interactive |
| Forest 400 | `#4A9E6A` | `--sg-forest-400` | Success, check marks |
| Forest 300 | `#6BBF87` | `--sg-forest-300` | Light accent on dark bg |
| Forest 200 | `#A3D9B5` | `--sg-forest-200` | Proficient badge bg |
| Forest 100 | `#D1ECDA` | `--sg-forest-100` | Subtle tints |
| Forest 50 | `#EEF5EC` | `--sg-forest-50` | Lightest tint |

### Light Surfaces — Sage
For light mode backgrounds and card surfaces.

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Sage 50 | `#F5F9F5` | `--sg-sage-50` | Primary light background |
| Sage 100 | `#EDF4EE` | `--sg-sage-100` | Card backgrounds |
| Sage 200 | `#DCE9DD` | `--sg-sage-200` | Exploring badge bg |
| Sage 300 | `#C4D9C6` | `--sg-sage-300` | Borders on light |
| Sage 500 | `#8BAF8E` | `--sg-sage-500` | Muted text on dark |
| Sage 700 | `#5A7A5E` | `--sg-sage-700` | Secondary text on light |

### Secondary — Teal
For accents, secondary actions, and exploration.

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Teal 700 | `#2D7272` | `--sg-teal-700` | Deep teal, overlays |
| Teal 600 | `#3D8E8B` | `--sg-teal-600` | Diagonal pattern |
| Teal 500 | `#5BA8A0` | `--sg-teal-500` | Secondary accent |
| Teal 400 | `#7CC0B8` | `--sg-teal-400` | Links, hover |
| Teal 200 | `#CCEAE6` | `--sg-teal-200` | Practicing badge bg |

### Highlight — Gold
For achievement, trending content, and celebration. Use sparingly.

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Gold 700 | `#9E8518` | `--sg-gold-700` | Deep gold |
| Gold 600 | `#B89C1E` | `--sg-gold-600` | Warning states |
| Gold 500 | `#CDBE3D` | `--sg-gold-500` | Primary highlight |
| Gold 400 | `#D9CF5C` | `--sg-gold-400` | CTA button hover |
| Gold 200 | `#F0ECB8` | `--sg-gold-200` | Advanced badge bg |

### Color Principles

1. **Color = achievement or state.** If something isn't communicating status, progress, or a call to action, it should be neutral.
2. **Gold is earned.** Never use gold decoratively. It signals: trending, completed, advanced, or celebration.
3. **Forest is the anchor.** Every composition should be grounded in forest green. Teal and gold are accents that complement it.
4. **Never hardcode hex.** Always reference CSS custom properties (`var(--sg-*)`) or import from the token file.

---

## Typography

### Font Pairing

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display | **Fraunces** | 600, 700, 800 | Hero headlines, section titles, taglines |
| Body | **DM Sans** | 400, 500, 600, 700 | Everything else: body, UI, labels, nav |

### Type Scale

| Level | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| Display XL | Fraunces | 56px | 700 | 1.05 | -0.02em |
| Display | Fraunces | 40px | 700 | 1.1 | -0.02em |
| Heading 1 | Fraunces | 32px | 600 | 1.15 | -0.01em |
| Heading 2 | DM Sans | 24px | 700 | 1.2 | 0 |
| Heading 3 | DM Sans | 20px | 600 | 1.3 | 0 |
| Body | DM Sans | 16px | 400 | 1.6 | 0 |
| Body Small | DM Sans | 14px | 400 | 1.5 | 0 |
| Caption | DM Sans | 12px | 500 | 1.4 | 0 |
| Label | DM Sans | 11px | 600 | 1.25 | 0.06em (uppercase) |

### Typography Rules

- Fraunces is for display only — never in body text or UI components
- Use Fraunces italic sparingly — reserved for taglines ("Close the gap.")
- All-caps labels use DM Sans 600, never Fraunces
- Minimum font size: 11px
- Maximum 3 font weights per view

---

## Patterns

Four signature patterns from the brand system:

| Pattern | Colors | Usage |
|---------|--------|-------|
| **Wave** | Forest 500 + Forest 300 | Hero backgrounds, section dividers |
| **Checker** | Forest 500 + Gold 500 | Achievement moments, celebrations |
| **Diagonal** | Teal 600 + Teal 400 | Portrait backdrops, card decorations |
| **Grid** | Teal 500 + fine white lines | Subtle texture on dark backgrounds |

Patterns should always be rendered in brand colors (never grayscale or off-brand). Use at reduced opacity (0.3–0.6) when overlaying readable content.

---

## Photography

### Style
- **Subjects:** Working professionals — diverse ages, ethnicities, contexts
- **Mood:** Warm, competent, focused, approachable
- **Lighting:** Natural, warm tones. Green and teal environment accents welcome
- **Context:** People actively working (laptops, phones, whiteboards, collaboration)

### Treatments
- **Stripe Backdrop:** Diagonal stripe pattern (forest tones) behind portrait subjects
- **Color Overlay:** Teal duotone for moody/editorial usage
- **Cropping:** Tight crops (shoulders and up) for profile imagery
- **Corners:** Always rounded (12–16px border-radius)

### Avoid
- Generic stock photography with forced smiles
- Cold, blue-tinted corporate lighting
- Subjects without professional context
- Images disconnected from brand color palette

---

## Fluency Level Visual System

Each fluency level has a dedicated color treatment:

| Level | Badge Background | Dot Color | Semantic |
|-------|-----------------|-----------|----------|
| Exploring | Sage 200 | Sage 700 | Just starting, curious |
| Practicing | Teal 200 | Teal 600 | Actively learning, building confidence |
| Proficient | Forest 200 | Forest 500 | Capable, applying independently |
| Advanced | Gold 200 | Gold 700 | Fluent, pushing boundaries |

---

## Component Patterns

### Buttons
- **Primary:** Forest 700 bg, white text. Hover: Forest 600.
- **CTA:** Gold 500 bg, Forest 800 text. Hover: Gold 400 + slight lift.
- **Outline:** Forest 700 border + text, transparent bg. Hover: filled.
- **Ghost:** Sage 500 text, transparent. Hover: subtle white overlay.

### Tags / Pills
- **Dark:** Forest 700 bg, white text. For skill labels.
- **Gold:** Gold 500 bg, Forest 800 text. For "trending" indicators.
- **Teal:** Teal 500 bg, white text. For "new" indicators.
- **Outline:** Forest 700 border on light backgrounds.

### Cards
- Dark mode: Forest 700 bg with sage text
- Light mode: White bg on Sage 50 surface, subtle shadow
- Always rounded corners (12–16px)
- Content hierarchy: badge/meta → title (Fraunces) → description (DM Sans) → skill tags

---

## Figma Source

Original mockups: [GrowthAssistant Figma File](https://www.figma.com/design/I58TVBFB0Yr6kalBqiTDNH/GrowthAssistant?node-id=13-601)

Page 3, 30 frames covering: pattern library, iconography, imagery guidelines, application examples (website hero, billboard, LinkedIn ads), typography specimens, and logo lockups.
