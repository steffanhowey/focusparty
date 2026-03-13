"use client";

import { useState, useCallback } from "react";
import {
  Code,
  Pen,
  Rocket,
  Flower2,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  Copy,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

// ─── Types ──────────────────────────────────────────────────

type RoomArchetype = "coder" | "writer" | "founder" | "gentle" | "custom";
type WizardStep = "archetype" | "details" | "review" | "done";

interface BlueprintResult {
  world_config: {
    label: string;
    description: string;
    defaultSprintLength: number;
    targetRoomSize: number;
    accentColor: string;
    vibeKey: string;
  };
  host_config: {
    hostName: string;
    tone: string;
    toneInstruction: string;
    cooldownSeconds: number;
  };
  synthetic_config: {
    archetypeMix: Record<string, number>;
    targetCount: number;
  };
  break_profile: {
    queries: string[];
    persona: { name: string; voicePrompt: string };
  };
  visual_profile: {
    masterPrompt: string;
    continuityAnchors: string[];
  };
  discovery_config: {
    tags: string[];
    category: string;
    lobbyDescription: string;
  };
}

// ─── Constants ──────────────────────────────────────────────

const ARCHETYPES: {
  id: RoomArchetype;
  label: string;
  description: string;
  icon: typeof Code;
  color: string;
}[] = [
  {
    id: "coder",
    label: "Coding Room",
    description: "Developers and builders shipping code",
    icon: Code,
    color: "#10B981",
  },
  {
    id: "writer",
    label: "Writing Room",
    description: "Writers, editors, and content creators",
    icon: Pen,
    color: "#8B5CF6",
  },
  {
    id: "founder",
    label: "Builder Room",
    description: "Founders and operators building products",
    icon: Rocket,
    color: "#F59E0B",
  },
  {
    id: "gentle",
    label: "Gentle Room",
    description: "Low-pressure momentum building",
    icon: Flower2,
    color: "#EC4899",
  },
  {
    id: "custom",
    label: "Custom Room",
    description: "Define your own room type",
    icon: Sparkles,
    color: "#3B82F6",
  },
];

// ─── Component ──────────────────────────────────────────────

interface CreateRoomWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRoomWizard({
  isOpen,
  onClose,
  onCreated,
}: CreateRoomWizardProps) {
  const [step, setStep] = useState<WizardStep>("archetype");
  const [archetype, setArchetype] = useState<RoomArchetype>("custom");

  // Details form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");

  // Blueprint state
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    partyId: string;
    worldKey: string;
    inviteCode: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => {
    setStep("archetype");
    setArchetype("custom");
    setName("");
    setDescription("");
    setTopic("");
    setAudience("");
    setBlueprintId(null);
    setBlueprint(null);
    setGenerating(false);
    setProvisioning(false);
    setError(null);
    setResult(null);
    setCopied(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ─── Generate Blueprint ───────────────────────────────────

  const generateBlueprint = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/rooms/generate-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archetype,
          name: name.trim(),
          description: description.trim(),
          topic: topic.trim(),
          audience: audience.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }

      setBlueprintId(data.blueprintId);
      setBlueprint(data.blueprint);
      setStep("review");
    } catch (err) {
      setError("Network error — please try again");
    } finally {
      setGenerating(false);
    }
  }, [archetype, name, description, topic, audience]);

  // ─── Provision Room ───────────────────────────────────────

  const provisionRoom = useCallback(async () => {
    if (!blueprintId) return;
    setProvisioning(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/rooms/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Provisioning failed");
        return;
      }

      setResult(data);
      setStep("done");
      onCreated();
    } catch (err) {
      setError("Network error — please try again");
    } finally {
      setProvisioning(false);
    }
  }, [blueprintId, onCreated]);

  // ─── Details form validation ──────────────────────────────

  const detailsValid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    topic.trim().length > 0 &&
    audience.trim().length > 0;

  // ─── Render Steps ─────────────────────────────────────────

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Room">
      {step === "archetype" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Choose a room archetype. AI will generate the full configuration.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {ARCHETYPES.map((a) => {
              const Icon = a.icon;
              const selected = archetype === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setArchetype(a.id)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                  style={{
                    borderColor: selected
                      ? a.color
                      : "var(--color-border-default)",
                    backgroundColor: selected
                      ? `${a.color}10`
                      : "transparent",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${a.color}20`, color: a.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.label}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                      {a.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep("details")}
            className="w-full rounded-full bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            Next
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lovable Builders"
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Build apps using Lovable with other founders"
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
              Primary Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. AI app building, vibe coding"
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
              Target Audience
            </label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Founders, indie hackers, builders"
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("archetype")}
              className="flex-1 rounded-full border border-[var(--color-border-default)] py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/5"
            >
              Back
            </button>
            <button
              type="button"
              onClick={generateBlueprint}
              disabled={!detailsValid || generating}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Blueprint"
              )}
            </button>
          </div>
        </div>
      )}

      {step === "review" && blueprint && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            AI generated the following room configuration. Review and publish.
          </p>

          {/* Host */}
          <Section title="Host">
            <Detail label="Name" value={blueprint.host_config.hostName} />
            <Detail label="Tone" value={blueprint.host_config.tone} />
          </Section>

          {/* Environment */}
          <Section title="Environment">
            <Detail label="Label" value={blueprint.world_config.label} />
            <Detail
              label="Sprint"
              value={`${blueprint.world_config.defaultSprintLength}min`}
            />
            <Detail
              label="Room Size"
              value={`${blueprint.world_config.targetRoomSize} participants`}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Accent
              </span>
              <div
                className="h-4 w-4 rounded-full border border-white/10"
                style={{
                  backgroundColor: blueprint.world_config.accentColor,
                }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {blueprint.world_config.accentColor}
              </span>
            </div>
          </Section>

          {/* Breaks */}
          <Section title="Break Content">
            <Detail
              label="Persona"
              value={blueprint.break_profile.persona.name}
            />
            <Detail
              label="Topics"
              value={blueprint.break_profile.queries.slice(0, 3).join(", ")}
            />
          </Section>

          {/* Synthetics */}
          <Section title="Synthetics">
            <Detail
              label="Count"
              value={`${blueprint.synthetic_config.targetCount} ambient coworkers`}
            />
            <Detail
              label="Mix"
              value={Object.entries(blueprint.synthetic_config.archetypeMix)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                .join(", ")}
            />
          </Section>

          {/* Discovery */}
          <Section title="Discovery">
            <Detail
              label="Tags"
              value={blueprint.discovery_config.tags.join(", ")}
            />
            <Detail
              label="Category"
              value={blueprint.discovery_config.category}
            />
          </Section>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBlueprint(null);
                setBlueprintId(null);
                setError(null);
                setStep("details");
              }}
              className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/5"
            >
              <RefreshCw size={13} />
              Regenerate
            </button>
            <button
              type="button"
              onClick={provisionRoom}
              disabled={provisioning}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {provisioning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish Room"
              )}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <Check size={18} />
            <span className="text-sm font-medium">Room created</span>
          </div>

          <Section title="Details">
            <Detail label="Name" value={result.name} />
            <Detail label="World Key" value={result.worldKey} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Invite Code
              </span>
              <code className="rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-text-primary)]">
                {result.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.inviteCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[var(--color-text-tertiary)] hover:text-white"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </Section>

          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-full bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-default)] p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-16 shrink-0 text-xs text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text-secondary)]">
        {value}
      </span>
    </div>
  );
}
