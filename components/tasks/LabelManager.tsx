"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Label } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/taskConstants";
import { Pencil, Trash2, Plus } from "lucide-react";

interface LabelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  onCreateLabel: (input: { name: string; color: string }) => void;
  onUpdateLabel: (
    labelId: string,
    updates: Partial<Pick<Label, "name" | "color">>
  ) => void;
  onDeleteLabel: (labelId: string) => void;
}

export function LabelManager({
  isOpen,
  onClose,
  labels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: LabelManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);

  const resetForm = useCallback(() => {
    setName("");
    setColor(PROJECT_COLORS[0]);
    setCreating(false);
    setEditingId(null);
  }, []);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateLabel({ name: trimmed, color });
    resetForm();
  }, [name, color, onCreateLabel, resetForm]);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateLabel(editingId, { name: trimmed, color });
    resetForm();
  }, [editingId, name, color, onUpdateLabel, resetForm]);

  const startEdit = useCallback((label: Label) => {
    setEditingId(label.id);
    setName(label.name);
    setColor(label.color);
    setCreating(false);
  }, []);

  const isEditing = creating || editingId !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Labels">
      <div className="space-y-4">
        {/* Label list */}
        {labels.length > 0 && (
          <div className="space-y-1">
            {labels.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: l.color }}
                />
                <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                  {l.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLabel(l.id)}
                    className="rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-red-400"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit form */}
        {isEditing ? (
          <div className="space-y-3 rounded-lg border border-[var(--color-border-default)] p-3">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") editingId ? handleUpdate() : handleCreate();
                if (e.key === "Escape") resetForm();
              }}
              placeholder="Label name"
              className="w-full"
            />

            {/* Color picker */}
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      color === c ? "scale-125 ring-2 ring-white/40" : "hover:scale-110"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm} className="h-9 px-3 text-sm">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={!name.trim()}
                className="h-9 px-3 text-sm"
              >
                {editingId ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-default)] px-3 py-2.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            <Plus size={16} strokeWidth={1.5} />
            New label
          </button>
        )}
      </div>
    </Modal>
  );
}
