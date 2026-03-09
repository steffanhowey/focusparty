"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Project } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/taskConstants";
import { Pencil, Trash2, Plus } from "lucide-react";

const EMOJI_OPTIONS = ["📁", "📥", "🚀", "🎯", "💡", "🔧", "📊", "🎨", "📝", "⭐", "🏠", "🔥"];

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onCreateProject: (input: { name: string; color: string; emoji: string }) => void;
  onUpdateProject: (
    projectId: string,
    updates: Partial<Pick<Project, "name" | "color" | "emoji">>
  ) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectManager({
  isOpen,
  onClose,
  projects,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [emoji, setEmoji] = useState("📁");

  const resetForm = useCallback(() => {
    setName("");
    setColor(PROJECT_COLORS[0]);
    setEmoji("📁");
    setCreating(false);
    setEditingId(null);
  }, []);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateProject({ name: trimmed, color, emoji });
    resetForm();
  }, [name, color, emoji, onCreateProject, resetForm]);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateProject(editingId, { name: trimmed, color, emoji });
    resetForm();
  }, [editingId, name, color, emoji, onUpdateProject, resetForm]);

  const startEdit = useCallback((project: Project) => {
    setEditingId(project.id);
    setName(project.name);
    setColor(project.color);
    setEmoji(project.emoji);
    setCreating(false);
  }, []);

  const isEditing = creating || editingId !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Projects">
      <div className="space-y-4">
        {/* Project list */}
        {projects.length > 0 && (
          <div className="space-y-1">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded text-sm"
                  style={{ background: p.color + "22" }}
                >
                  {p.emoji}
                </span>
                <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                  {p.name}
                </span>
                {!p.is_default && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(p.id)}
                      className="rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-red-400"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
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
              placeholder="Project name"
              className="w-full"
            />

            {/* Emoji picker */}
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-tertiary)]">
                Emoji
              </label>
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
                      emoji === e
                        ? "bg-white/10 ring-1 ring-white/30"
                        : "hover:bg-white/[0.06]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

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
            New project
          </button>
        )}
      </div>
    </Modal>
  );
}
