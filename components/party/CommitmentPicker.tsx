"use client";

import { User, Users, Lock } from "lucide-react";
import type { CommitmentType } from "@/lib/types";

interface CommitmentPickerProps {
  value: CommitmentType;
  onChange: (type: CommitmentType) => void;
  accentColor: string;
}

const OPTIONS: { type: CommitmentType; icon: typeof User; label: string; desc: string }[] = [
  { type: "personal", icon: User, label: "Personal", desc: "Private focus commitment" },
  { type: "social", icon: Users, label: "Social", desc: "Room sees your commitment" },
  { type: "locked", icon: Lock, label: "Locked In", desc: "Must resolve before leaving" },
];

export function CommitmentPicker({ value, onChange, accentColor }: CommitmentPickerProps) {
  return (
    <div className="px-5 pt-4">
      <label className="mb-2 block text-sm font-semibold text-white">
        Commitment
      </label>
      <div className="flex gap-2">
        {OPTIONS.map(({ type, icon: Icon, label, desc }) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-3 text-center transition-all"
              style={{
                background: selected ? `${accentColor}0C` : "transparent",
                border: selected
                  ? `1.5px solid ${accentColor}60`
                  : "1.5px solid rgba(255,255,255,0.08)",
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.8}
                style={{ color: selected ? accentColor : "rgba(255,255,255,0.5)" }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: selected ? "white" : "rgba(255,255,255,0.7)" }}
              >
                {label}
              </span>
              <span className="text-[10px] text-white/40">{desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
