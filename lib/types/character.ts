// Character types and definitions

export type CharacterId = "ember" | "moss" | "byte";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  roomBg: string;
}
