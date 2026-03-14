"use client";

import Link from "next/link";
import Image from "next/image";

const LOGO_DARK_MODE = "/logo/skillgap_light.png";
const LOGO_MARK = "/logo/focusparty_logo_mark.png";
const LOGO_LIGHT_MODE = "/logo/Group%2040.png";

/** Nav logo height in pixels. */
const NAV_LOGO_HEIGHT = 28;

interface LogoProps {
  /** Height in pixels. Default 28 for nav, 24 for small variant. */
  height?: number;
  href?: string;
  variant?: "dark" | "light" | "small";
  /** Optional: constrain max width (px). */
  maxWidth?: number;
}

export function Logo({
  height,
  href = "/",
  variant = "dark",
  maxWidth = 120,
}: LogoProps) {
  const src =
    variant === "light"
      ? LOGO_LIGHT_MODE
      : variant === "small"
        ? LOGO_MARK
        : LOGO_DARK_MODE;
  const resolvedHeight = height ?? NAV_LOGO_HEIGHT;
  const resolvedMaxWidth = variant === "small" ? 28 : maxWidth;

  const image = (
    <span
      className="relative block shrink-0"
      style={{ height: resolvedHeight, width: resolvedMaxWidth }}
    >
      <Image
        src={src}
        alt="SkillGap"
        fill
        className={`object-contain ${variant === "small" ? "object-center" : "object-left"}`}
        sizes={`(max-width: 240px) 120px, ${resolvedMaxWidth}px`}
      />
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center"
        aria-label="SkillGap Home"
      >
        {image}
      </Link>
    );
  }
  return image;
}
