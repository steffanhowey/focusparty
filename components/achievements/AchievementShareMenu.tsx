"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Link2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MenuItem } from "@/components/ui/MenuItem";
import {
  getProgressEvidenceImageRoute,
  getProgressEvidenceRoute,
} from "@/lib/appRoutes";

interface AchievementShareMenuProps {
  shareSlug?: string | null;
  pathTitle: string;
  pathTopics: string[];
}

function toFileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function AchievementShareMenu({
  shareSlug,
  pathTitle,
  pathTopics,
}: AchievementShareMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timer = setTimeout(() => setIsCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [isCopied]);

  if (!shareSlug) {
    return (
      <Button variant="secondary" loading>
        Preparing evidence
      </Button>
    );
  }

  const resolvedShareSlug = shareSlug;

  function getShareUrl(): string {
    return `${window.location.origin}${getProgressEvidenceRoute(resolvedShareSlug)}`;
  }

  function getImageUrl(): string {
    return `${window.location.origin}${getProgressEvidenceImageRoute(resolvedShareSlug)}`;
  }

  async function handleCopyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setIsCopied(true);
    } catch {
      // Copy failure should never block the rest of the menu.
    } finally {
      setIsOpen(false);
    }
  }

  function handleShareLinkedIn(): void {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`,
      "_blank",
      "noopener,noreferrer",
    );
    setIsOpen(false);
  }

  function handleShareX(): void {
    const topics = pathTopics.slice(0, 3).join(", ");
    const text = topics.length
      ? `I just completed "${pathTitle}" on SkillGap.ai. Skills demonstrated: ${topics}.`
      : `I just completed "${pathTitle}" on SkillGap.ai.`;

    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getShareUrl())}`,
      "_blank",
      "noopener,noreferrer",
    );
    setIsOpen(false);
  }

  function handleDownloadImage(): void {
    const link = document.createElement("a");
    link.href = getImageUrl();
    link.download = `${toFileSlug(pathTitle) || "skillgap-evidence"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="secondary"
        leftIcon={isCopied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isCopied ? "Link copied" : "Share Evidence"}
      </Button>

      {isOpen && (
        <Card
          className="absolute left-1/2 top-full z-[var(--z-dropdown)] mt-3 min-w-[220px] -translate-x-1/2 p-1"
          style={{
            background: "var(--sg-white)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <MenuItem icon={<Copy size={14} />} onClick={handleCopyLink}>
            Copy link
          </MenuItem>
          <MenuItem icon={<Link2 size={14} />} onClick={handleShareLinkedIn}>
            Share to LinkedIn
          </MenuItem>
          <MenuItem icon={<Share2 size={14} />} onClick={handleShareX}>
            Share to X
          </MenuItem>
          <MenuItem icon={<Download size={14} />} onClick={handleDownloadImage}>
            Download image
          </MenuItem>
        </Card>
      )}
    </div>
  );
}
