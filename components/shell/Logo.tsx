"use client";

import Link from "next/link";
import Image from "next/image";

const LOGO_DARK_MODE = "/logo/Group%2039.png";
const LOGO_LIGHT_MODE = "/logo/Group%2040.png";
const LOGO_SMALL = "/logo/small.png";

/** Nav logo height in pixels. Kept modest for a refined sidebar presence. */
const NAV_LOGO_HEIGHT = 28;

/** Height for small (rails) logo. */
const SMALL_LOGO_HEIGHT = 24;

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
    variant === "small"
      ? LOGO_SMALL
      : variant === "light"
        ? LOGO_LIGHT_MODE
        : LOGO_DARK_MODE;
  const resolvedHeight = height ?? (variant === "small" ? SMALL_LOGO_HEIGHT : NAV_LOGO_HEIGHT);
  const resolvedMaxWidth = variant === "small" ? 40 : maxWidth;

  const image = (
    <span
      className="relative block shrink-0"
      style={{ height: resolvedHeight, width: resolvedMaxWidth }}
    >
      <Image
        src={src}
        alt="FocusParty"
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
        aria-label="FocusParty Home"
      >
        {image}
      </Link>
    );
  }
  return image;
}
