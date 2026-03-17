"use client";

import { ChevronDown } from "lucide-react";
import type { Project, Label, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/taskConstants";

interface FilterBarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  selectedPriorities: TaskPriority[];
  onPriorityChange: (priorities: TaskPriority[]) => void;
  selectedStatuses: TaskStatus[];
  onStatusChange: (statuses: TaskStatus[]) => void;
  labels: Label[];
  selectedLabelIds: string[];
  onLabelChange: (labelIds: string[]) => void;
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="cursor-pointer appearance-none rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-2 pr-8 text-sm text-[var(--sg-shell-600)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sg-shell-400)]"
      />
    </div>
  );
}

export function FilterBar({
  projects,
  selectedProjectId,
  onProjectChange,
  selectedPriorities,
  onPriorityChange,
  labels,
  selectedLabelIds,
  onLabelChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Project filter */}
      {projects.length > 0 && (
        <FilterSelect
          value={selectedProjectId ?? ""}
          onChange={(e) => onProjectChange(e.target.value || null)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
      )}

      {/* Priority filter */}
      <FilterSelect
        value={selectedPriorities.length === 1 ? selectedPriorities[0] : ""}
        onChange={(e) => {
          const val = e.target.value as TaskPriority | "";
          onPriorityChange(val ? [val] : []);
        }}
      >
        <option value="">All priorities</option>
        {(["p1", "p2", "p3", "p4"] as TaskPriority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
          </option>
        ))}
      </FilterSelect>

      {/* Label filter */}
      {labels.length > 0 && (
        <FilterSelect
          value={selectedLabelIds.length === 1 ? selectedLabelIds[0] : ""}
          onChange={(e) => {
            const val = e.target.value;
            onLabelChange(val ? [val] : []);
          }}
        >
          <option value="">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </FilterSelect>
      )}

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
