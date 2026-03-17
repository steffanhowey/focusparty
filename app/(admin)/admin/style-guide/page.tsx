"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Settings,
  Music,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Volume2,
  Zap,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { MenuItem } from "@/components/ui/MenuItem";
import { ToggleCard } from "@/components/ui/ToggleCard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        className="mb-4 text-lg font-bold text-white"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-[var(--sg-shell-500)]">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function StyleGuidePage() {
  const [selectedToggle, setSelectedToggle] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <h1
        className="mb-2 text-2xl font-bold text-white"
      >
        Button Style Guide
      </h1>
      <p className="mb-8 text-sm text-[var(--sg-shell-600)]">
        All interactive button components in the SkillGap design system.
      </p>

      {/* ── Button ── */}
      <Section title="Button">
        <Row label="Variants (default size)">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="cta">CTA</Button>
          <Button variant="link">Link</Button>
        </Row>

        <Row label="Sizes (primary)">
          <Button size="xs">Extra Small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
        </Row>

        <Row label="With Icons">
          <Button size="sm" leftIcon={<Plus size={16} />}>New Item</Button>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={14} />}>Back</Button>
          <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />}>Delete</Button>
        </Row>

        <Row label="Loading">
          <Button loading>Loading...</Button>
          <Button size="sm" loading>Saving</Button>
        </Row>

        <Row label="Disabled">
          <Button disabled>Disabled Primary</Button>
          <Button variant="secondary" disabled>Disabled Secondary</Button>
          <Button variant="cta" disabled>Disabled CTA</Button>
        </Row>

        <Row label="Full Width">
          <div className="w-full max-w-sm">
            <Button variant="cta" fullWidth>Full Width CTA</Button>
          </div>
        </Row>

        <Row label="Full Width (secondary)">
          <div className="w-full max-w-sm">
            <Button variant="secondary" fullWidth>Full Width Secondary</Button>
          </div>
        </Row>
      </Section>

      {/* ── IconButton ── */}
      <Section title="IconButton">
        <Row label="Variants (default size)">
          <IconButton variant="ghost" icon={<Settings size={18} />} aria-label="Settings" />
          <IconButton variant="outline" icon={<ChevronLeft size={16} />} aria-label="Previous" />
          <IconButton variant="danger" icon={<Trash2 size={18} />} aria-label="Delete" />
        </Row>

        <Row label="Sizes (ghost)">
          <IconButton size="xs" icon={<Volume2 size={14} />} aria-label="Volume" />
          <IconButton size="sm" icon={<X size={15} />} aria-label="Close" />
          <IconButton size="default" icon={<Music size={18} />} aria-label="Music" />
        </Row>

        <Row label="Active State">
          <IconButton icon={<Music size={18} />} active aria-label="Music (active)" />
          <IconButton icon={<Settings size={18} />} aria-label="Settings (inactive)" />
        </Row>

        <Row label="Disabled">
          <IconButton icon={<Play size={18} />} disabled aria-label="Play (disabled)" />
          <IconButton variant="outline" icon={<ChevronRight size={16} />} disabled aria-label="Next (disabled)" />
        </Row>
      </Section>

      {/* ── MenuItem ── */}
      <Section title="MenuItem">
        <div className="flex gap-8">
          <div className="w-64">
            <p className="mb-2 text-xs font-medium text-[var(--sg-shell-500)]">Size: sm (popovers)</p>
            <div
              className="overflow-hidden rounded-xl py-1"
              style={{
                background: "rgba(20,20,20,0.96)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <MenuItem icon={<CheckCircle2 size={14} />}>Mark complete</MenuItem>
              <MenuItem icon={<Archive size={14} />}>Archive</MenuItem>
              <MenuItem icon={<Trash2 size={14} />} danger>Delete</MenuItem>
            </div>
          </div>

          <div className="w-64">
            <p className="mb-2 text-xs font-medium text-[var(--sg-shell-500)]">Size: default (sidebar)</p>
            <div
              className="overflow-hidden rounded-xl py-1"
              style={{
                background: "rgba(20,20,20,0.96)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <MenuItem size="default" icon={<Settings size={18} />} className="text-[var(--sg-shell-900)]">Settings</MenuItem>
              <MenuItem size="default" icon={<Music size={18} />} active>Active Item</MenuItem>
              <MenuItem size="default" icon={<Trash2 size={18} />} danger>Sign out</MenuItem>
            </div>
          </div>
        </div>
      </Section>

      {/* ── ToggleCard ── */}
      <Section title="ToggleCard">
        <Row label="Selection Cards">
          {["Energized", "Focused", "Neutral"].map((label) => {
            const icons: Record<string, typeof Zap> = { Energized: Zap, Focused: Target, Neutral: Settings };
            const Icon = icons[label];
            const isSelected = selectedToggle === label;
            return (
              <ToggleCard
                key={label}
                selected={isSelected}
                onClick={() => setSelectedToggle(isSelected ? null : label)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 ${
                  isSelected ? "text-white" : "text-[var(--sg-shell-500)]"
                }`}
              >
                <Icon size={20} strokeWidth={1.6} />
                <span className="text-xs font-medium">{label}</span>
              </ToggleCard>
            );
          })}
        </Row>

        <Row label="Content Cards">
          <ToggleCard selected={false} className="flex items-start gap-2.5 w-48">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--sg-shell-500)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--sg-shell-600)]">Completed</p>
              <p className="text-2xs text-[var(--sg-shell-500)]">Finished what I set out to do</p>
            </div>
          </ToggleCard>
          <ToggleCard selected={true} className="flex items-start gap-2.5 w-48">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--sg-forest-500)]" />
            <div>
              <p className="text-xs font-semibold text-white">Selected Card</p>
              <p className="text-2xs text-[var(--sg-shell-500)]">This one is selected</p>
            </div>
          </ToggleCard>
        </Row>
      </Section>

      {/* ── Contextual Patterns ── */}
      <Section title="Contextual Patterns (Not Componentized)">
        <div className="rounded-xl border border-[var(--sg-shell-border)] p-4 text-sm text-[var(--sg-shell-600)]">
          <p className="mb-2 font-medium text-white">These patterns are intentionally left inline:</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-[var(--sg-shell-500)]">
            <li><strong className="text-[var(--sg-shell-600)]">ActionBar toolbar buttons</strong> — frosted-glass icon buttons in the session action bar</li>
            <li><strong className="text-[var(--sg-shell-600)]">TopBar overlay buttons</strong> — video overlay with drop-shadow context</li>
            <li><strong className="text-[var(--sg-shell-600)]">EnvironmentActionBar</strong> — glass toolbar with labeled icon buttons</li>
            <li><strong className="text-[var(--sg-shell-600)]">RoomCard vibe check</strong> — animated glassmorphism overlay</li>
            <li><strong className="text-[var(--sg-shell-600)]">DurationPills</strong> — selection pill pattern</li>
            <li><strong className="text-[var(--sg-shell-600)]">World picker cards</strong> — dynamic accent color on hover</li>
            <li><strong className="text-[var(--sg-shell-600)]">DataTable sort headers</strong> — table header interactive elements</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}
