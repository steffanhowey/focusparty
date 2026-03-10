// ─── Room Visual Profiles ───────────────────────────────────
// Art bible for each world. Defines the stable visual identity
// that the prompt compiler uses to generate consistent backgrounds.
// Mirrors the pattern of worlds.ts and hosts.ts — code-based config
// keyed by WorldKey.

import type { WorldKey } from "./worlds";
import type { TimeOfDayState } from "./timeOfDay";

/** Lighting/mood/palette overrides for a specific time of day. */
export interface TimeOfDayOverrides {
  /** Replaces the base profile lighting description. */
  lighting: string;
  /** Merged over base palette — dominant/accent only, avoid stays. */
  paletteAdjust?: {
    dominant?: string[];
    accent?: string[];
  };
  /** Atmospheric mood description, added to the prompt as context. */
  mood: string;
}

export interface RoomVisualProfile {
  worldKey: WorldKey;
  /** Core scene description — the "what" of the background. */
  masterPrompt: string;
  /** Visual anchors that must appear in every generation for continuity. */
  continuityAnchors: string[];
  /** Color palette constraints. */
  palette: {
    dominant: string[];
    accent: string[];
    avoid: string[];
  };
  /** Lighting direction and mood (base/afternoon state). */
  lighting: string;
  /** Camera framing rules. */
  cameraRules: string;
  /** Things to never include. */
  negativeRules: string[];
  /** UI safe zone instructions for overlay compatibility. */
  uiSafeZones: string;
  /** Per-time-state overrides. Afternoon uses the base profile as-is. */
  timeOverrides?: Partial<Record<TimeOfDayState, TimeOfDayOverrides>>;
}

export const ROOM_VISUAL_PROFILES: Record<WorldKey, RoomVisualProfile> = {
  // ─── Focus Room ─────────────────────────────────────────
  // Who's here: anyone doing deep work — studying, planning, designing.
  // What they need to feel: calm clarity, "I can think here."
  // The space: a beautifully designed personal study. Think Japanese-
  // inspired minimalism meets Scandinavian warmth. Not a corporate office.
  // Time-neutral — works at any hour.
  default: {
    worldKey: "default",
    masterPrompt:
      "A beautifully designed personal study with clean lines and intentional simplicity. Large floor-to-ceiling windows let in generous natural light. A single clean desk with a comfortable chair faces the windows. The architecture is modern but warm — light wood, soft textiles, subtle curves. Outside the windows, a calm cityscape or natural landscape provides depth without distraction. The space feels like it was designed by someone who understands deep work — every object has purpose, nothing is excess. The overall feeling is calm clarity and quiet confidence.",
    continuityAnchors: [
      "large windows with generous natural light",
      "clean single desk with warm wood tones",
      "modern minimal architecture with soft curves",
      "calm view through windows",
      "intentional simplicity throughout",
    ],
    palette: {
      dominant: ["warm white", "light oak", "soft gray"],
      accent: ["muted blue from sky or view", "warm brass or copper details", "sage green from a single plant"],
      avoid: ["saturated primary colors", "neon", "dark moody tones", "industrial gray"],
    },
    lighting:
      "Generous natural light as the primary source — the room feels bright and airy. Supplemented by one or two warm accent lights. Shadows are soft and gentle. The overall impression is well-lit and inviting, never gloomy.",
    cameraRules:
      "Wide environmental shot at seated eye level. Camera faces toward the windows to maximize the sense of light and openness. Shallow depth of field on the exterior view.",
    negativeRules: [
      "no readable text on any surface",
      "no visible screens or monitors",
      "no floating UI elements",
      "no watermarks or logos",
      "no people",
      "no surreal or fantasy elements",
      "no clutter or mess",
      "no dark or moody atmosphere",
    ],
    uiSafeZones:
      "The bottom 40% of the image should transition to darker tones via desk surface and natural shadow to support a dark gradient overlay. Avoid bright focal elements in the center-right zone where a translucent panel may appear. Keep the top-center area relatively uniform for a floating timer pill.",
    timeOverrides: {
      morning: {
        lighting:
          "Early morning golden hour light streams through the floor-to-ceiling windows at a low angle, casting long warm shadows across the desk and floor. The light has a gentle amber-peach warmth — the day is just beginning. One warm accent light is on but barely needed. The room feels fresh, quiet, and full of potential.",
        paletteAdjust: {
          accent: ["warm golden morning light", "soft peach sunrise tones through windows", "long amber shadows on light wood"],
        },
        mood: "Fresh and quiet. The calm clarity of early morning — the day hasn't started yet, full of potential. A cup of coffee, a clean desk, a clear mind.",
      },
      evening: {
        lighting:
          "Warm amber light from a desk lamp and soft wall sconces. Outside the windows, the sky shows deep blue twilight fading to indigo. The room's warm interior contrasts beautifully with the cool evening sky. The lamp creates a focused pool of golden light on the desk. Soft, intimate, cozy.",
        paletteAdjust: {
          dominant: ["warm amber", "soft charcoal", "muted cream"],
          accent: ["deep blue twilight through windows", "warm brass lamp glow", "subtle warm reflections on wood"],
        },
        mood: "Intimate and cozy. A thoughtful evening of deep work by lamplight. The world is winding down but your mind is clear and engaged.",
      },
      late_night: {
        lighting:
          "The room is lit by a single quality desk lamp and soft ambient undershelf lighting. Outside the windows, the city or landscape is dark with scattered distant points of light. The contrast is dramatic — a warm island of focus in a sleeping world. Shadows are deep but the desk area is comfortably lit. The atmosphere is quiet and concentrated.",
        paletteAdjust: {
          dominant: ["deep navy", "warm charcoal", "dark walnut tones"],
          accent: ["warm amber desk lamp pool", "distant city or starlight through windows", "subtle brass reflections"],
        },
        mood: "Quiet intensity. The world is asleep but you're getting things done. Nocturnal focus — unhurried, deep, solitary in the best way.",
      },
    },
  },

  // ─── Vibe Coding ────────────────────────────────────────
  // Who's here: developers, designers, builders shipping product.
  // What they need to feel: creative energy, builder momentum, "let's go."
  // The space: a converted warehouse loft or industrial studio with
  // character — exposed brick, interesting architecture, lived-in tech.
  // Not a sterile server room. Think the space a small studio team
  // would actually choose to work in.
  "vibe-coding": {
    worldKey: "vibe-coding",
    masterPrompt:
      "A converted industrial loft studio where a small team builds software. High ceilings with exposed architectural details — steel beams, large factory windows, raw concrete accents. Workstations with large monitors are arranged organically, not in corporate rows. The space has personality — a mix of industrial structure and creative warmth. Warm pendant lights hang at different heights. A large window wall lets in natural light with a city or skyline view adding depth. The atmosphere is energetic and creative but organized — this is where things get built, not where things are messy.",
    continuityAnchors: [
      "high ceilings with exposed architectural details",
      "large monitors on workstations",
      "warm pendant lights at varying heights",
      "large window wall with city or skyline view",
      "mix of industrial structure and creative warmth",
    ],
    palette: {
      dominant: ["warm concrete gray", "exposed brick warmth", "dark wood"],
      accent: ["warm amber from pendant lights", "soft teal or green from plants or accents", "muted copper highlights"],
      avoid: ["RGB gamer lighting", "neon colors", "sterile white", "pitch black"],
    },
    lighting:
      "Warm pendant lights as primary source, creating pools of inviting light. Natural light from large windows adds brightness and depth. Monitors provide subtle secondary glow. The space is well-lit — energetic and alive, not cave-like.",
    cameraRules:
      "Wide shot at standing eye level showing the volume of the space. Emphasize the height and the windows. Slight asymmetric composition for creative energy. Depth through layered workstations receding into the background.",
    negativeRules: [
      "no readable code or text on monitors",
      "no fake UI or dashboards visible on screens",
      "no visible brand logos",
      "no cartoon or pixel art style",
      "no people dominating the frame",
      "no cable mess",
      "no pitch-dark or cave-like atmosphere",
    ],
    uiSafeZones:
      "Bottom 40% should darken naturally via desk surfaces and floor. Center-right should remain visually quiet for overlay panels. Avoid bright screen glare directly in the upper-center zone.",
    timeOverrides: {
      morning: {
        lighting:
          "Morning sun breaks through the large factory windows, casting dramatic warm shafts of light across the exposed brick and concrete floor. The pendant lights are off — natural light dominates. Dust motes catch the light. The space feels energized and fresh, like the team just arrived with coffee and big plans.",
        paletteAdjust: {
          accent: ["warm golden sun shafts on brick", "coffee-warm tones", "morning blue sky through factory windows"],
        },
        mood: "Fresh builder energy. Coffee in hand, monitors warming up, the day's work laid out ahead. The excitement of a new sprint.",
      },
      evening: {
        lighting:
          "The pendant lights are the dominant light source now — warm amber pools at different heights creating a layered, atmospheric glow. Outside the window wall, sunset paints the city skyline in warm orange and purple. Monitors cast a soft secondary glow on nearby surfaces. The space feels focused and alive — deep into the build.",
        paletteAdjust: {
          dominant: ["warm amber", "deep brick tones", "rich dark wood"],
          accent: ["sunset orange and purple through windows", "warm pendant light pools", "soft monitor glow on surfaces"],
        },
        mood: "Deep in the build. The team is locked in. Sunset energy — the productive flow state where hours disappear and the work is good.",
      },
      late_night: {
        lighting:
          "Pendant lights turned low, monitors providing the primary illumination with soft cool-warm glow on nearby surfaces. Through the factory windows, the city is a field of scattered lights against deep dark blue. The space feels like a hacker's sanctuary — quiet, focused, the rest of the world asleep while builders ship.",
        paletteAdjust: {
          dominant: ["deep charcoal", "warm dark brick", "midnight blue"],
          accent: ["soft monitor glow reflecting on surfaces", "warm pendant spots turned low", "city lights twinkling through windows"],
        },
        mood: "Hacker hours. Quiet intensity, the sound of keyboards, the glow of monitors. Shipping at midnight because the work demands it and the flow is too good to break.",
      },
    },
  },

  // ─── Writer Room ────────────────────────────────────────
  // Who's here: writers, editors, thinkers crafting words.
  // What they need to feel: literary warmth, "the words will come here."
  // The space: a personal library study with real character. Think a
  // brownstone study, a bookshop backroom, a university library alcove.
  // Rich in texture — leather, wood, paper, fabric. Warm but bright
  // enough to actually read and write comfortably.
  "writer-room": {
    worldKey: "writer-room",
    masterPrompt:
      "A personal library study filled with warmth and character. Floor-to-ceiling bookshelves line the walls, packed with books of varying sizes and colors. A worn leather reading chair sits near a large window that lets in warm natural light. A substantial wood desk with a quality task lamp. Rich textures everywhere — aged wood, leather bindings, soft rugs, linen curtains filtering the light. The room feels like it belongs to someone who reads deeply and writes carefully. It is warm and well-lit — a place you want to spend hours, not a dark cave. The atmosphere is intimate, intellectual, and quietly inspiring.",
    continuityAnchors: [
      "floor-to-ceiling bookshelves packed with books",
      "substantial wood desk with task lamp",
      "large window letting in warm natural light",
      "rich textures — leather, aged wood, fabric",
      "intimate intellectual atmosphere",
    ],
    palette: {
      dominant: ["warm walnut", "aged leather brown", "cream parchment"],
      accent: ["amber lamp glow", "soft golden natural light", "deep burgundy or forest green from book spines"],
      avoid: ["cool blues", "neon", "chrome or metal", "stark white"],
    },
    lighting:
      "Warm natural light from a large window as the primary source — the room is comfortably bright. A quality desk lamp adds focused golden light. The bookshelves catch warm ambient light. Shadows exist in corners but the overall impression is warm and inviting, not dim.",
    cameraRules:
      "Slightly elevated three-quarter view looking across the desk toward the bookshelves and window. Shallow depth of field softens background book spines. Intimate framing that makes you feel like you're sitting in the chair.",
    negativeRules: [
      "no readable text on book spines or papers",
      "no visible screens or computers",
      "no floating elements",
      "no watermarks",
      "no people",
      "no modern tech gadgets",
      "no dark gloomy atmosphere",
    ],
    uiSafeZones:
      "Bottom 40% should be naturally darker with desk surface and soft shadows. Keep center area clear of bright lamp sources. Right side should be visually recessive — soft bookshelf texture, not bright window.",
    timeOverrides: {
      morning: {
        lighting:
          "Soft morning light filters through linen curtains at the window, casting a warm gentle glow across the bookshelves and desk. The room has that quiet first-light quality — untouched, peaceful, waiting for the day's words. A cup of coffee or tea steams on the desk. The desk lamp is off — natural light is enough.",
        paletteAdjust: {
          accent: ["soft golden morning light through curtains", "warm steam from a cup", "gentle amber on leather surfaces"],
        },
        mood: "The quiet before the words. Morning in the study — a fresh notebook, a warm cup, and the gentle promise that the words will come. Unhurried literary calm.",
      },
      evening: {
        lighting:
          "The desk lamp is now the primary light source — warm golden light illuminating the desk and nearby book spines. The window shows deep blue evening sky with perhaps a hint of city glow. The bookshelves recede into rich warm shadow. The room feels intimate, enclosed, a cocoon of focused thought. Warm and atmospheric, not dark.",
        paletteAdjust: {
          dominant: ["rich walnut in shadow", "deep warm brown", "amber-lit cream"],
          accent: ["golden desk lamp pool", "deep blue evening through window", "warm burgundy book spines catching lamp light"],
        },
        mood: "The evening session. Lamp-lit pages, the world quieting outside. This is when the best writing happens — intimate, focused, the words flowing by warm golden light.",
      },
      late_night: {
        lighting:
          "Only the desk lamp illuminates the scene — a warm focused pool on the desk surface. The bookshelves fade into deep shadow, their spines barely visible. Through the window, the night is dark with scattered distant lights. The room contracts around the lamp — you are in a small warm world of wood, leather, and thought. Deep shadows everywhere but the desk.",
        paletteAdjust: {
          dominant: ["deep shadow brown", "warm charcoal", "near-black walnut"],
          accent: ["single warm desk lamp cone", "faint distant lights through window", "subtle leather sheen in lamplight"],
        },
        mood: "Midnight in the study. The house is silent, the world is asleep. Just you, the lamp, and the words. The deep quiet where the best, most honest writing emerges.",
      },
    },
  },

  // ─── YC Build Party ─────────────────────────────────────
  // Who's here: founders, operators, people shipping fast.
  // What they need to feel: velocity, ambition, "we're building the future."
  // The space: a premium modern office with panoramic views. Think a
  // top-floor startup HQ — not a garage, not a WeWork. The kind of
  // space you earn after your Series A. Clean, bright, purposeful.
  // Energy comes from the view and the architecture, not from darkness.
  "yc-build": {
    worldKey: "yc-build",
    masterPrompt:
      "A premium modern startup office on a high floor with panoramic city views. Floor-to-ceiling glass walls reveal an expansive skyline. The interior is clean and purposeful — standing desks, large monitors, open floor plan with good sight lines. The architecture is bold — high ceilings, concrete and glass, strong geometric lines. Natural light floods the space. The atmosphere radiates ambition and momentum — this is where consequential things happen. The space feels bright, alive, and forward-looking.",
    continuityAnchors: [
      "panoramic floor-to-ceiling glass walls",
      "expansive city skyline view",
      "standing desks with large monitors",
      "bold modern architecture — concrete, glass, geometric lines",
      "bright ambitious atmosphere",
    ],
    palette: {
      dominant: ["clean concrete", "warm white", "charcoal accents"],
      accent: ["warm amber from natural light", "city skyline colors", "bold orange or red accent furniture"],
      avoid: ["pastels", "cozy cottage tones", "dark moody colors", "cluttered startup mess"],
    },
    lighting:
      "Abundant natural light from panoramic glass walls — the space is bright and energizing. Warm accent lighting at standing desk level. The skyline provides visual depth and aspiration. The overall impression is bright, premium, and alive.",
    cameraRules:
      "Wide establishing shot showing the full open floor plan with the skyline as backdrop. Slightly elevated angle with strong perspective lines from desk rows leading toward the glass walls. Emphasize the scale and the view.",
    negativeRules: [
      "no readable text or dashboards on monitors",
      "no visible brand names or logos",
      "no whiteboards with readable content",
      "no people dominating the composition",
      "no food wrappers or mess",
      "no dark gloomy atmosphere",
      "no cheap or startup-scrappy furniture",
    ],
    uiSafeZones:
      "Bottom 40% should darken via desk surfaces and floor shadows. Upper area should have the skyline — bright but relatively uniform. Right side should be visually subdued compared to center-left.",
    timeOverrides: {
      morning: {
        lighting:
          "Sunrise light breaks over the city skyline, painting the sky in warm peach and gold. The light floods through the glass walls, casting long geometric shadows from the desk frames across the concrete floor. The space feels electric with possibility — a new day, a new sprint, the whole city waking up below you.",
        paletteAdjust: {
          accent: ["warm peach and gold sunrise on skyline", "long geometric desk shadows", "morning-blue sky above warm horizon"],
        },
        mood: "The morning of a big push. Sunrise over the city, the team assembling, energy high. Fresh ambition — today we ship something that matters.",
      },
      evening: {
        lighting:
          "Golden hour paints the city skyline in warm amber and deep orange through the glass walls. Interior warm accent lights at desk level have kicked on. The monitors glow softly. The transition from natural to artificial light creates a rich, layered atmosphere. The space feels locked-in — the productive evening sprint.",
        paletteAdjust: {
          dominant: ["warm concrete in golden light", "rich amber", "darkening charcoal"],
          accent: ["golden hour skyline in amber and orange", "warm desk-level accent lights", "soft monitor glow"],
        },
        mood: "The evening push. Golden hour on the skyline, the team in flow state. This is the productive stretch where momentum builds and the work accelerates.",
      },
      late_night: {
        lighting:
          "The city skyline is a stunning field of lights against deep dark blue sky. Inside, monitors are the dominant light source — cool-warm glow reflecting on glass and concrete surfaces. Warm desk lamps provide secondary pools of focused light. The glass walls become mirrors reflecting the interior. The atmosphere is intense, focused, and powerful — the war room at midnight.",
        paletteAdjust: {
          dominant: ["deep midnight blue", "dark concrete", "charcoal black"],
          accent: ["city skyline lights in warm gold and cool white", "monitor glow on glass and concrete", "warm desk lamp islands"],
        },
        mood: "The founder war room at midnight. City lights blazing outside, monitors glowing inside. This is when the hardest problems get solved. Intense, focused, undeniable momentum.",
      },
    },
  },

  // ─── Gentle Start ───────────────────────────────────────
  // Who's here: people easing into their day, building momentum gently.
  // What they need to feel: peace, warmth, "there's no rush, just begin."
  // The space: a sunlit home workspace that feels like a sanctuary.
  // Think a bright garden studio, a sunroom desk, a breakfast-nook
  // workspace. Nature is visible and close. Everything is soft, light,
  // and welcoming.
  "gentle-start": {
    worldKey: "gentle-start",
    masterPrompt:
      "A sunlit home workspace that feels like a personal sanctuary. A simple, beautiful desk sits beside a large window or glass door that opens onto a garden, balcony, or natural landscape. Indoor plants thrive on the windowsill and nearby shelves. Morning light fills the room — everything glows with soft warmth. A warm cup of tea or coffee sits on the desk. Natural materials throughout — light wood, linen, ceramic, woven textures. The space is bright, airy, and alive with natural light. It feels like the first perfect hour of a good day — unhurried, hopeful, and gently energizing.",
    continuityAnchors: [
      "large window or glass door with garden or nature view",
      "thriving indoor plants",
      "bright morning light filling the room",
      "natural materials — light wood, linen, ceramic",
      "warm beverage on a simple desk",
    ],
    palette: {
      dominant: ["soft cream", "warm white", "light natural wood"],
      accent: ["living green from plants", "soft gold morning light", "warm terracotta or blush"],
      avoid: ["dark colors", "harsh contrast", "neon", "industrial tones", "anything cold"],
    },
    lighting:
      "Bright, generous morning light as the overwhelming primary source. The room is flooded with natural warmth. Soft shadows from plants create gentle patterns. Everything feels sunlit and alive. This is the brightest of all the rooms.",
    cameraRules:
      "Eye-level view from beside the desk looking toward the window and nature. Shallow depth of field softens the outdoor greenery into a dreamy backdrop. Calm, centered composition. Intimate and personal.",
    negativeRules: [
      "no readable text anywhere",
      "no screens or monitors",
      "no dark or moody atmosphere",
      "no clutter or mess",
      "no people",
      "no harsh artificial lighting",
      "no corporate office furniture",
      "no cold or sterile feeling",
    ],
    uiSafeZones:
      "Bottom 40% should have desk surface and natural shadow for dark overlay compatibility. The image overall is lighter than other worlds, so the overlay gradient will need to compensate. Avoid bright window glare directly in center zone.",
    timeOverrides: {
      morning: {
        lighting:
          "Early sunrise light — the softest, most golden hour. Light streams through the window or glass door at a very low angle, catching dew on the garden plants outside. Everything is bathed in warm peach-gold glow. The plants cast long delicate shadows. The warm beverage steams in the fresh light. This is the earliest, most magical morning light — the world just waking up.",
        paletteAdjust: {
          accent: ["warm peach-gold sunrise glow", "dew drops catching light", "long delicate plant shadows"],
        },
        mood: "The very first light. Dew on the garden, steam from your cup, the world barely awake. Pure peaceful beginning — no rush, just gentle warmth and possibility.",
      },
      evening: {
        lighting:
          "Warm golden hour light from the west paints the garden in rich amber and green-gold. Through the window, the garden is beautiful in evening light — warm, lush, glowing. Inside, a small warm lamp has been turned on, adding soft light to the desk. The warmth feels like the end of a good day — satisfied, calm, grateful.",
        paletteAdjust: {
          dominant: ["warm golden cream", "rich amber-touched wood", "soft warm shadow"],
          accent: ["golden hour on garden foliage", "warm lamp glow on desk", "rich green-gold from plants in evening light"],
        },
        mood: "The gentle close of a good day. Golden hour through the garden, a warm lamp on the desk. Calm satisfaction and quiet gratitude for the day's work done.",
      },
      late_night: {
        lighting:
          "A soft nightlight or small desk lamp provides the only interior light — warm and minimal. Through the window, the garden is visible by moonlight — silvery and peaceful. Perhaps a garden light or two creates small warm spots among the plants. The room is mostly shadow with one warm pocket of light. The atmosphere is deeply peaceful — the world at rest.",
        paletteAdjust: {
          dominant: ["deep warm cream in shadow", "soft midnight blue", "dark natural wood"],
          accent: ["warm desk lamp glow", "cool moonlight on garden", "small garden light spots among plants"],
        },
        mood: "Deep night peace. The garden sleeps in moonlight, one small lamp glows warmly. The quietest, most gentle time — for those who find peace in the late hours.",
      },
    },
  },
};

/** Get a visual profile by world key, falling back to default. */
export function getRoomVisualProfile(worldKey: string): RoomVisualProfile {
  return (
    ROOM_VISUAL_PROFILES[worldKey as WorldKey] ?? ROOM_VISUAL_PROFILES.default
  );
}
